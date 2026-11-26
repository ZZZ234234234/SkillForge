import fs from "node:fs";
import path from "node:path";

const DEFAULTS = {
  version: 1,
  customRoots: [],
  installs: {},
  // 安装时由 SkillForge 顺带创建出来的 Agent 技能目录（绝对路径 -> true）。
  // 卸载时据此决定要不要把这些空目录清掉；用户本来就有的目录不在这里，不会被删。
  createdRoots: {},
};

/**
 * 一个很小的 JSON 存档：自定义目录、安装记录，以及安装时顺带创建的目录。
 * 写入先落临时文件再重命名，避免写一半留下损坏的存档。
 */
export function openStore(file) {
  let data = load(file);
  function load(f) {
    try {
      const d = JSON.parse(fs.readFileSync(f, "utf8"));
      if (!d || typeof d !== "object") return structuredClone(DEFAULTS);
      return {
        version: 1,
        customRoots: sanitizeRoots(d.customRoots),
        installs:
          d.installs && typeof d.installs === "object" ? d.installs : {},
        createdRoots: sanitizeMap(d.createdRoots),
      };
    } catch {
      return structuredClone(DEFAULTS);
    }
  }
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  };
  return {
    get: () => data,
    save,
    reload: () => {
      data = load(file);
    },
    /** 写入一份 JSON 文档（技能库存档），同样采用临时文件 + 重命名。 */
    writeDoc(name, value) {
      const target = path.join(path.dirname(file), name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = target + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(value));
      fs.renameSync(tmp, target);
    },
    readDoc(name) {
      try {
        return JSON.parse(fs.readFileSync(path.join(path.dirname(file), name), "utf8"));
      } catch {
        return null;
      }
    },
  };
}

/** 绝对路径 -> true 的表；其余条目丢弃。 */
function sanitizeMap(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj))
    if (path.isAbsolute(k) && v === true) out[k] = true;
  return out;
}

function sanitizeRoots(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (r) =>
        r &&
        typeof r === "object" &&
        typeof r.id === "string" &&
        typeof r.path === "string" &&
        path.isAbsolute(r.path),
    )
    .map((r) => ({
      id: r.id,
      path: r.path,
      label: typeof r.label === "string" && r.label ? r.label : path.basename(r.path),
      addedAt: typeof r.addedAt === "number" ? r.addedAt : Date.now(),
    }));
}
