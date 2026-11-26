import fs from "node:fs/promises";
import path from "node:path";
import { resolveKey } from "./paths.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const MAX_ITEMS = 5000;
const MAX_PROBLEMS = 200;
const MAX_READ = 2_000_000;
const isSkillMd = (n) => n.toLowerCase() === "skill.md";
const isSkillJson = (n) => n.toLowerCase() === "skill.json";
const byName = (a, b) => a.name.localeCompare(b.name, "en");

/** 统计一个技能目录里的文件数（不跟随符号链接，有上限）。 */
async function countFiles(dir) {
  let n = 0;
  async function walk(d, depth) {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (depth < 8 && n < 999) await walk(path.join(d, e.name), depth + 1);
      } else if (e.isFile()) n++;
      if (n >= 999) return;
    }
  }
  await walk(dir, 0);
  return n;
}

/**
 * 目录里有 SKILL.md 或 skill.json 才算一个技能。
 * 返回 null 表示不是技能目录。
 */
async function describe(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let skillMd = null;
  let skillJson = null;
  const extras = [];
  let hasScripts = false;
  for (const e of entries) {
    const isFile = e.isFile() || e.isSymbolicLink();
    if (isFile && isSkillMd(e.name)) skillMd ??= e.name;
    else if (isFile && isSkillJson(e.name)) skillJson ??= e.name;
    else {
      if (extras.length < 12)
        extras.push(e.name + (e.isDirectory() ? "/" : ""));
      if (
        e.name.toLowerCase() === "scripts" ||
        /\.(sh|py|js|mjs|cjs|ts|ps1|bat)$/i.test(e.name)
      )
        hasScripts = true;
    }
  }
  if (!skillMd && !skillJson) return null;
  const main = skillMd ?? skillJson;
  const st = await fs.stat(path.join(dir, main));
  return {
    skillMd,
    skillJson,
    mtime: st.mtimeMs,
    size: st.size,
    sig: `${st.size}:${Math.floor(st.mtimeMs)}`,
    files: await countFiles(dir),
    extras,
    hasScripts,
  };
}

function makeItem(root, dir, dirName, group, d, extra = {}) {
  return {
    key: `${root.id}|${group ? group + "/" : ""}${dirName}${extra.flat ? ".md" : ""}`,
    rootId: root.id,
    dir,
    dirName,
    group,
    skillMd: d.skillMd ? path.join(dir, d.skillMd) : null,
    skillJson: d.skillJson ? path.join(dir, d.skillJson) : null,
    mtime: d.mtime,
    size: d.size,
    sig: d.sig,
    files: d.files,
    extras: d.extras,
    hasScripts: d.hasScripts,
    ...extra,
  };
}

/** 扫描一个技能根目录。 */
export async function scanRoot(root) {
  const out = {
    id: root.id,
    path: root.path,
    exists: false,
    error: null,
    items: [],
    problems: [],
  };
  let st;
  try {
    st = await fs.stat(root.path);
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "ENOTDIR") return out;
    out.error = e.message;
    return out;
  }
  if (!st.isDirectory()) {
    out.error = "Not a folder";
    return out;
  }
  out.exists = true;

  // 根目录本身就是一个技能文件夹
  const self = await describe(root.path).catch(() => null);
  if (self) {
    out.items.push(
      makeItem(root, root.path, path.basename(root.path), null, self, {
        self: true,
      }),
    );
    return out;
  }

  let entries;
  try {
    entries = await fs.readdir(root.path, { withFileTypes: true });
  } catch (e) {
    out.error = e.message;
    return out;
  }
  for (const e of entries.sort(byName)) {
    if (e.isSymbolicLink() || e.name.startsWith(".") || SKIP_DIRS.has(e.name))
      continue;
    // OpenCode 也支持根目录下直接放 <name>.md
    if (e.isFile() && /\.md$/i.test(e.name) && !/^(skill|readme)\.md$/i.test(e.name)) {
      const abs = path.join(root.path, e.name);
      const s = await fs.stat(abs).catch(() => null);
      if (s) {
        const name = e.name.replace(/\.md$/i, "");
        out.items.push(
          makeItem(root, root.path, name, null, {
            skillMd: e.name,
            skillJson: null,
            mtime: s.mtimeMs,
            size: s.size,
            sig: `${s.size}:${Math.floor(s.mtimeMs)}`,
            files: 1,
            extras: [],
            hasScripts: false,
          }, { flat: true }),
        );
        out.items.at(-1).skillMd = abs;
      }
      continue;
    }
    if (!e.isDirectory()) continue;
    if (out.items.length >= MAX_ITEMS) {
      out.error = `Stopped at ${MAX_ITEMS} skills`;
      break;
    }
    const dir = path.join(root.path, e.name);
    const d = await describe(dir).catch((err) => {
      if (out.problems.length < MAX_PROBLEMS)
        out.problems.push({ path: dir, reason: "unreadable", message: err.message });
      return null;
    });
    if (d) {
      out.items.push(makeItem(root, dir, e.name, null, d));
      continue;
    }
    // 允许再分一层分组目录：<root>/<group>/<skill>/SKILL.md
    let children;
    try {
      children = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    let found = 0;
    for (const c of children.sort(byName)) {
      if (
        c.isSymbolicLink() ||
        !c.isDirectory() ||
        c.name.startsWith(".") ||
        SKIP_DIRS.has(c.name)
      )
        continue;
      const cd = path.join(dir, c.name);
      const dd = await describe(cd).catch(() => null);
      if (dd) {
        out.items.push(makeItem(root, cd, c.name, e.name, dd));
        found++;
      }
    }
    if (!found && out.problems.length < MAX_PROBLEMS)
      out.problems.push({ path: dir, reason: "no-skill-md" });
  }
  return out;
}

/**
 * 扫描多个根目录。同一个文件夹被多个根目录覆盖时只保留第一次出现的结果。
 * 每个条目附带 source：发现它的目录（自定义目录可能是单个技能文件夹）。
 */
export async function scan(roots) {
  const groups = await Promise.all(roots.map((r) => scanRoot(r)));
  const seen = new Set();
  const items = [];
  const problems = [];
  const seenProblems = new Set();
  for (const g of groups) {
    for (const it of g.items) {
      const k = resolveKey(it.skillMd ?? it.skillJson);
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(it);
    }
    for (const p of g.problems) {
      if (problems.length >= MAX_PROBLEMS) break;
      const k = resolveKey(p.path);
      if (seenProblems.has(k)) continue;
      seenProblems.add(k);
      problems.push({ ...p, rootId: g.id });
    }
  }
  return {
    roots: groups.map((g) => ({ id: g.id, path: g.path, exists: g.exists, error: g.error, count: g.items.length })),
    items,
    problems,
    at: Date.now(),
  };
}

/**
 * 读取若干文件（SKILL.md / skill.json），只允许读取技能目录内部的文件。
 * 返回与输入同序的结果，永不为单个失败抛错。
 */
export async function readLocalFiles(paths, roots) {
  const out = [];
  for (const p of paths) {
    if (typeof p !== "string" || !path.isAbsolute(p)) {
      out.push({ path: String(p), text: null, error: "Invalid path" });
      continue;
    }
    if (!roots.some((r) => r.path && contains(r.path, p))) {
      out.push({ path: p, text: null, error: "Outside skill folders" });
      continue;
    }
    try {
      const st = await fs.stat(p);
      if (!st.isFile()) throw new Error("Not a file");
      if (st.size > MAX_READ) throw new Error("File exceeds 2 MB");
      const text = (await fs.readFile(p, "utf8")).replace(/^\uFEFF/, "");
      out.push({ path: p, text, sig: `${st.size}:${Math.floor(st.mtimeMs)}` });
    } catch (e) {
      out.push({ path: p, text: null, error: e.code === "ENOENT" ? "Not found" : e.message });
    }
  }
  return out;
}

function contains(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" ? false : !rel.startsWith("..") && !path.isAbsolute(rel);
}
