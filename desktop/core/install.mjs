import fs from "node:fs/promises";
import path from "node:path";
import { containsPath, isInside } from "./paths.mjs";

/** Agent Skills 规范的技能名：小写字母、数字、连字符。 */
export const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_TEXT_BYTES = 8_000_000;
const COPY_MAX_FILES = 2000;
const COPY_MAX_BYTES = 64 * 1024 * 1024;
const COPY_DEPTH = 10;

const exists = (p) =>
  fs
    .stat(p)
    .then((s) => s)
    .catch(() => null);

/** 校验界面传来的相对路径：不允许绝对路径、盘符、反斜杠和 ..。 */
export function validRel(rel) {
  if (typeof rel !== "string" || !rel || rel.length > 240) return false;
  if (rel.includes("\\") || rel.includes(":")) return false;
  const parts = rel.split("/");
  return parts.every((s) => s !== "" && s !== "." && s !== "..");
}

async function collectSource(dir) {
  const files = [];
  let bytes = 0;
  async function walk(d, depth) {
    if (depth > COPY_DEPTH) return;
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) await walk(abs, depth + 1);
      else if (e.isFile()) {
        const st = await fs.stat(abs);
        if (files.length >= COPY_MAX_FILES)
          throw new Error("Source folder has too many files (limit 2000)");
        if (st.size > COPY_MAX_BYTES)
          throw new Error("Source folder is too large (limit 64 MB)");
        bytes += st.size;
        if (bytes > COPY_MAX_BYTES)
          throw new Error("Source folder is too large (limit 64 MB)");
        files.push({
          rel: path.relative(dir, abs).split(path.sep).join("/"),
          abs,
        });
      }
    }
  }
  await walk(dir, 0);
  return files;
}

/**
 * 计算一次安装要写入的内容，不落盘。
 * - source：从本机某个技能文件夹整目录复制（保留 scripts / references 等附属文件）
 * - files：界面生成的文本文件（技能库里有修改时用），会覆盖 source 中的同名文件
 * 返回 conflicts：目标位置上已存在、将被覆盖的文件。
 */
export async function planInstall({
  rootPath,
  name,
  source,
  files,
  reserved = [],
}) {
  if (typeof name !== "string" || !NAME_RE.test(name) || name.length > 64)
    throw new Error("技能名只能使用小写字母、数字和连字符");
  if (reserved.includes(name))
    throw new Error(`“${name}”是该 Agent 的保留名称，请换一个名字`);
  const dir = path.join(rootPath, name);
  if (!isInside(rootPath, dir)) throw new Error("Invalid target folder");
  if (source && (containsPath(source, dir) || containsPath(dir, source)))
    throw new Error("Source and target are the same folder");

  const writes = new Map();
  if (source) {
    const st = await exists(source);
    if (!st?.isDirectory()) throw new Error("找不到要复制的技能文件夹");
    for (const f of await collectSource(source))
      writes.set(f.rel, { rel: f.rel, from: f.abs });
  }
  let textBytes = 0;
  for (const [k, v] of Object.entries(files ?? {})) {
    if (!validRel(k)) throw new Error(`非法的文件路径：${k}`);
    if (typeof v !== "string") throw new Error(`文件内容必须是文本：${k}`);
    textBytes += Buffer.byteLength(v);
    if (textBytes > MAX_TEXT_BYTES) throw new Error("文件总大小超出限制");
    writes.set(k, { rel: k, text: v });
  }
  if (!writes.has("SKILL.md"))
    throw new Error("安装内容必须包含 SKILL.md");
  const dirExists = Boolean(await exists(dir));
  const conflicts = [];
  for (const w of writes.values())
    if (await exists(path.join(dir, w.rel))) conflicts.push(w.rel);
  return {
    dir,
    name,
    writes: [...writes.values()],
    conflicts,
    dirExists,
  };
}

const unlink = (p) => fs.rm(p, { force: true, recursive: true });

/**
 * 执行安装。被覆盖的旧文件先交给 remove 处理（桌面端移入回收站），再写入新文件。
 * 目标文件夹里不在本次写入范围内的文件一律不动。
 */
export async function applyInstall(plan, { remove = unlink } = {}) {
  await fs.mkdir(plan.dir, { recursive: true });
  for (const rel of plan.conflicts) await remove(path.join(plan.dir, rel));
  for (const w of plan.writes) {
    const abs = path.join(plan.dir, w.rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    if (w.text !== undefined) await fs.writeFile(abs, w.text, "utf8");
    else await fs.copyFile(w.from, abs);
  }
  return {
    dir: plan.dir,
    created: !plan.dirExists,
    replaced: plan.conflicts.length,
    files: plan.writes.map((w) => w.rel),
  };
}

/**
 * 卸载一次由 SkillForge 记录在案的安装：只移除当时写入的文件，
 * 文件夹里其余内容保持原样；随后清理由此变空的目录。
 */
export async function removeInstall(record, { remove = unlink } = {}) {
  if (!record?.dir || !Array.isArray(record.files))
    throw new Error("没有这次安装的记录");
  const dirs = new Set();
  let removed = 0;
  for (const rel of record.files) {
    const abs = path.join(record.dir, rel);
    if (await exists(abs)) {
      await remove(abs);
      removed++;
    }
    let d = path.dirname(abs);
    while (containsPath(record.dir, d)) {
      dirs.add(d);
      d = path.dirname(d);
    }
  }
  for (const d of [...dirs].sort((a, b) => b.length - a.length))
    await fs.rmdir(d).catch(() => {});
  await fs.rmdir(record.dir).catch(() => {});
  return { removed };
}

/**
 * 从 start 往上删除空目录，到 stop 为止（stop 本身绝不删除）。安装时顺带创建出来的
 * “Agent 目录/skills”在卸载后不该留下一串空文件夹。
 * 只删空目录；遇到有内容的目录就停。
 */
export async function pruneEmptyDirs(start, stop) {
  const top = path.resolve(stop);
  let d = path.resolve(start);
  let removed = 0;
  while (isInside(top, d)) {
    const entries = await fs.readdir(d).catch(() => null);
    if (!entries || entries.length > 0) break;
    await fsp_rmdir(d);
    removed++;
    d = path.dirname(d);
  }
  return removed;
}

const fsp_rmdir = (d) => fs.rmdir(d).catch(() => {});
