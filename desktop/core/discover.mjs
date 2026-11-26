import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { containsPath } from "./paths.mjs";

/**
 * 自动发现没有收录在 agents.mjs 里的技能目录。
 *
 * 各家 Agent 的全局技能目录几乎都是同一种形状：<某个文件夹>/skills/<技能名>/SKILL.md，
 * 这个“某个文件夹”在主目录下一层（~/.kiro/skills）或两层（~/.codeium/windsurf/skills）。
 * 这里按这个形状去找：目录里至少要有一个技能文件夹才算，避免把不相干的 skills 目录当成技能目录。
 *
 * 只读目录名和少量文件状态，不读文件内容；与已知目录重叠的候选一律跳过。
 */

/** 明确不是 Agent 配置的目录：包管理器缓存、构建产物、系统目录。 */
const SKIP = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "AppData", // Windows 程序数据；豆包的技能目录由 agents.mjs 单独处理
  "Library", // macOS 系统库
  ".Trash",
  ".cache",
  ".npm",
  ".pnpm-store",
  ".yarn",
  ".cargo",
  ".rustup",
  ".m2",
  ".gradle",
  ".nuget",
  "go",
  "site-packages",
  "__pycache__",
  "vendor",
  "dist",
  "build",
  "target",
]);
/** 目录条目超过这个数就不往下展开（扩展目录、缓存之类的目录不值得找）。 */
const MAX_CHILDREN = 800;
/** 一个候选目录里最多看这么多项。 */
const MAX_SKILL_ENTRIES = 500;

const stat = (p) =>
  fs.stat(p).then(
    (s) => s,
    () => null,
  );

async function list(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** 这个目录是不是技能目录：<目录>/<技能名>/SKILL.md（或 skill.json）至少有一个。 */
async function isSkillsFolder(dir) {
  const st = await stat(dir);
  if (!st?.isDirectory()) return false;
  const entries = (await list(dir)).slice(0, MAX_SKILL_ENTRIES);
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory() || e.isSymbolicLink()) {
      const inner = await stat(path.join(dir, e.name, "SKILL.md"));
      if (inner?.isFile()) return true;
      const json = await stat(path.join(dir, e.name, "skill.json"));
      if (json?.isFile()) return true;
    }
  }
  return false;
}

/** 路径指纹：同一个相对路径每次得到同一个 id，安装记录才找得回来。 */
const idFor = (rel) =>
  "found-" + crypto.createHash("sha1").update(rel).digest("hex").slice(0, 8);

/**
 * 在 home 下找技能目录。known 是已知的目录（内置与用户添加的），与它们重叠的候选不重复列出。
 * 返回与 builtinRoots 同一形状的条目，found 为 true。
 */
export async function discoverRoots(home, known = []) {
  const out = [];
  if (typeof home !== "string" || !home) return out;
  const overlaps = (p) =>
    [...known, ...out].some(
      (k) => k && (containsPath(k.path ?? k, p) || containsPath(p, k.path ?? k)),
    );

  const take = async (p) => {
    const rel = path.relative(home, p);
    if (!rel || rel.startsWith("..")) return;
    if (overlaps(p)) return;
    if (!(await isSkillsFolder(p))) return;
    const posix = rel.split(path.sep).join("/").toLowerCase();
    // 名字用去掉开头小数点和末尾 skills 的相对路径：.workbuddy/connectors/skills -> workbuddy/connectors
    const owner = posix
      .replace(/\/skills$/i, "")
      .split("/")
      .map((s) => s.replace(/^\./, ""))
      .join("/");
    out.push({
      id: idFor(posix),
      agentId: idFor(posix),
      label: owner || posix,
      readers: [],
      doc: "",
      reserved: [],
      path: p,
      builtin: true,
      found: true,
    });
  };

  for (const top of await list(home)) {
    if (!top.isDirectory() || top.isSymbolicLink()) continue;
    if (SKIP.has(top.name) || top.name.startsWith("$")) continue;
    const dir = path.join(home, top.name);
    await take(path.join(dir, "skills"));
    const children = await list(dir);
    if (children.length > MAX_CHILDREN) continue;
    for (const c of children) {
      if (!c.isDirectory() || c.isSymbolicLink()) continue;
      if (SKIP.has(c.name)) continue;
      await take(path.join(dir, c.name, "skills"));
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "en"));
}
