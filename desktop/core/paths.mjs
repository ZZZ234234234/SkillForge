import path from "node:path";

const WIN = process.platform === "win32";
const fold = (p) => (WIN ? p.toLowerCase() : p);

/** 解析为绝对路径并做大小写归一（仅 Windows），用于比较。 */
export const resolveKey = (p) => fold(path.resolve(p));

export function samePath(a, b) {
  return resolveKey(a) === resolveKey(b);
}

/** child 是否位于 parent 目录内部（不含 parent 自身）。 */
export function isInside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** child 是否等于 parent 或位于其内部。 */
export function containsPath(parent, child) {
  return samePath(parent, child) || isInside(parent, child);
}

/** 把用户在界面上看到的绝对路径缩短显示：C:\Users\x\... -> ~\... */
export function displayPath(p, home) {
  if (home && (samePath(p, home) || isInside(home, p)))
    return "~" + p.slice(home.replace(/[\\/]+$/, "").length);
  return p;
}
