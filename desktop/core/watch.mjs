import fs from "node:fs";

/**
 * 监听一组目录（paths 是函数，每次重新取值，目录增减时自动跟随）。
 * Windows / macOS / 新版 Linux 使用递归 fs.watch；目录尚不存在时，
 * 由轮询在它出现后补上监听。onChange 已做防抖。
 */
export function watchPaths(paths, onChange, { debounce = 500, pollMs = 10000 } = {}) {
  const watchers = new Map();
  let timer = null;
  let stopped = false;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!stopped) onChange();
    }, debounce);
  };
  const closeOne = (p) => {
    watchers.get(p)?.close();
    watchers.delete(p);
  };
  const sync = () => {
    let changed = false;
    const wanted = new Map();
    for (const p of paths()) if (fs.existsSync(p)) wanted.set(p, true);
    for (const p of [...watchers.keys()])
      if (!wanted.has(p)) {
        closeOne(p);
        changed = true;
      }
    for (const p of wanted.keys())
      if (!watchers.has(p)) {
        try {
          const w = fs.watch(p, { recursive: true }, schedule);
          w.on("error", () => closeOne(p));
          watchers.set(p, w);
          changed = true;
        } catch {
          changed = true; // 读不了，交给下一次扫描去报错
        }
      }
    return changed;
  };
  sync();
  const poll = setInterval(() => {
    if (sync()) onChange();
  }, pollMs);
  poll.unref?.();
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearInterval(poll);
    for (const p of [...watchers.keys()]) closeOne(p);
  };
}
