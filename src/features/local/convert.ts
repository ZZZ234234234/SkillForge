import { parse as parseYaml } from "yaml";
import type { Skill } from "../../types/skill";
import { blankSkill, skillSchema } from "../skills/schema";
import { parseSkill } from "../skills/parser";
import {
  fileKey,
  linkOf,
  mainPath,
  type LocalFile,
  type LocalItem,
  type LocalLink,
  type LocalRoot,
} from "./bridge";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function split(text: string) {
  const m = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return m
    ? { meta: m[1], body: text.slice(m[0].length) }
    : { meta: null, body: text };
}

/**
 * 宽松地读取 frontmatter 里的 name / description / license，只用于列表展示和兼容导入。
 * 任何真实的 SKILL.md 都不该因为格式问题而不显示。
 */
export function peek(text: string | null | undefined): {
  name: string | null;
  description: string;
  license: string | null;
  raw: Record<string, unknown>;
} {
  const out: {
    name: string | null;
    description: string;
    license: string | null;
    raw: Record<string, unknown>;
  } = { name: null, description: "", license: null, raw: {} };
  if (!text) return out;
  const { meta, body } = split(text);
  let data: Record<string, unknown> | null = null;
  if (meta) {
    try {
      const d = parseYaml(meta, { maxAliasCount: 20 });
      if (d && typeof d === "object" && !Array.isArray(d))
        data = d as Record<string, unknown>;
    } catch {
      data = null;
    }
  }
  const get = (key: string): string | null => {
    const v = data?.[key];
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (data || !meta) return null;
    const m = meta.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m"));
    return m ? m[1].replace(/^["']|["']$/g, "") : null;
  };
  if (data) out.raw = data;
  out.name = get("name");
  out.description = (get("description") ?? "").replace(/\s+/g, " ").trim();
  out.license = get("license");
  if (!out.description && !data) {
    const line = body
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("---"));
    if (line) out.description = line.replace(/^#+\s*/, "");
  }
  return out;
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "") || "local-skill";

const title = (s: string) =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ") || s;

export interface LocalSource {
  dirName: string;
  dir: string;
  rootId: string;
  rootLabel: string;
  skillMd: string | null;
  skillJson: string | null;
  md?: string | null;
  json?: string | null;
}

/**
 * 把本机技能转成技能库里的 Skill。
 * 优先按 SKILL.md 解析；不符合 SkillForge 数据规范时退回到兼容模式，
 * 原文放进 instructions，不丢内容。
 */
export function fromLocal(src: LocalSource): {
  skill: Skill;
  via: "skill.md" | "skill.json" | "lenient";
  warning: string | null;
} {
  let base: Skill | null = null;
  let via: "skill.md" | "skill.json" | "lenient" = "lenient";
  let warning: string | null = null;
  if (src.md) {
    try {
      base = parseSkill(src.md);
      via = "skill.md";
    } catch {
      warning =
        "SKILL.md 不完全符合 SkillForge 的数据规范，已按兼容方式导入，原文完整保留在 Instructions 中。";
    }
  }
  if (!base && src.json) {
    try {
      base = parseSkill(src.json, "skill.json");
      via = "skill.json";
    } catch {
      warning = warning ?? "skill.json 无法解析，已按兼容方式导入。";
    }
  }
  if (base) {
    const head = peek(src.md ?? src.json);
    // 规范要求技能名与所在文件夹同名；SKILL.md 没写 name 时以文件夹名为准
    if (!head.name) {
      base.name = NAME_RE.test(src.dirName) ? src.dirName : slug(src.dirName);
      base.displayName = title(src.dirName);
    }
    // SKILL.md 没声明许可证时，不替作者默认成 MIT
    if (src.md && !head.license) base.license = "UNLICENSED";
    const skill: Skill = {
      ...base,
      status: base.status === "Installed" ? "Installed" : "Local",
      favorite: false,
      metadata: { ...base.metadata, local: link(src, "") },
    };
    return { skill: skillSchema.parse(skill), via, warning };
  }
  const s = blankSkill(src.dirName);
  const p = peek(src.md);
  const { body } = split(src.md ?? "");
  s.name = p.name && NAME_RE.test(p.name) ? p.name : slug(src.dirName);
  s.displayName = p.name?.trim() || title(src.dirName);
  s.description = (
    p.description ||
    "从本机导入的技能：" +
      src.dirName
  ).slice(0, 1024);
  s.license = p.license || "UNLICENSED";
  s.instructions = body.trim();
  s.metadata = {
    importedFrontmatter: p.raw,
    importWarning: warning ?? "compat",
    local: link(src, ""),
  };
  return { skill: skillSchema.parse(s), via, warning };
}

function link(src: LocalSource, syncedHash: string) {
  return {
    path: src.skillMd ?? src.skillJson ?? "",
    dir: src.dir,
    rootId: src.rootId,
    rootLabel: src.rootLabel,
    syncedHash,
  };
}

const BODY = [
  "name",
  "description",
  "license",
  "role",
  "goals",
  "instructions",
  "workflow",
  "tools",
  "constraints",
  "inputFormat",
  "outputFormat",
  "errorHandling",
  "examples",
  "tests",
] as const;

/**
 * SKILL.md 能表达的那部分内容的指纹。版本、标签、作者等只在 skill.json 里的字段不计入，
 * 所以“有没有修改”的判断与写回磁盘的结果一致。
 */
export function contentHash(s: Skill) {
  const str = JSON.stringify(BODY.map((k) => s[k]));
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + ":" + str.length.toString(16);
}

export function sourceOf(
  item: LocalItem,
  roots: LocalRoot[],
  files: Map<string, LocalFile>,
): LocalSource {
  const file = files.get(fileKey(mainPath(item)));
  const text = file?.text ?? null;
  return {
    dirName: item.dirName,
    dir: item.dir,
    rootId: item.rootId,
    rootLabel: roots.find((r) => r.id === item.rootId)?.label ?? item.rootId,
    skillMd: item.skillMd,
    skillJson: item.skillJson,
    md: item.skillMd ? text : null,
    json: item.skillJson && !item.skillMd ? text : null,
  };
}

/** 导入后的初始指纹：磁盘内容本身。调用方应在拿到结果后立刻写入 metadata.local。 */
export function stamp(skill: Skill): Skill {
  const link = linkOf(skill);
  if (!link) return skill;
  return {
    ...skill,
    metadata: { ...skill.metadata, local: { ...link, syncedHash: contentHash(skill) } },
  };
}

export type SyncState = "in-sync" | "pending" | "conflict" | "missing";

/** 技能库副本与本机文件的关系。 */
export function syncState(
  skill: Skill,
  disk: string | null,
  item: LocalItem | undefined,
): SyncState {
  if (!item) return "missing";
  const link = linkOf(skill);
  if (!link || disk === null) return "in-sync";
  const lib = contentHash(skill);
  if (disk === lib) return "in-sync";
  const libChanged = lib !== link.syncedHash;
  const diskChanged = disk !== link.syncedHash;
  return libChanged && diskChanged ? "conflict" : libChanged ? "pending" : "in-sync";
}

export type SyncNote = {
  kind: "updated" | "conflict" | "missing" | "restored";
  name: string;
};

/**
 * 让链接到本机文件的技能跟上磁盘：
 * - 磁盘变了、技能库没动 → 自动采用磁盘版本
 * - 两边都变了 → 标记冲突，等人决定
 * - 文件被删 → 标记“源文件已移除”，保留技能库副本
 * 纯函数：返回新的技能数组（没有变化时返回原数组）和给用户看的提示。
 */
export function reconcile(input: {
  skills: Skill[];
  items: LocalItem[];
  files: Map<string, LocalFile>;
  roots: LocalRoot[];
  now: number;
}): { next: Skill[]; notes: SyncNote[] } {
  const { skills, items, files, roots, now } = input;
  const byPath = new Map(items.map((i) => [fileKey(mainPath(i)), i]));
  const notes: SyncNote[] = [];
  let changed = false;
  const next = skills.map((s) => {
    const link = linkOf(s);
    if (!link) return s;
    const item = byPath.get(fileKey(link.path));
    if (!item) {
      if (link.missing) return s;
      changed = true;
      notes.push({ kind: "missing", name: s.displayName });
      return withLink(s, { ...link, missing: true, conflict: false });
    }
    const file = files.get(fileKey(link.path));
    const lib = contentHash(s);
    if (!file?.text) {
      if (!link.missing) return s;
      changed = true;
      notes.push({ kind: "restored", name: s.displayName });
      return withLink(s, { ...link, missing: false });
    }
    const disk = contentHash(fromLocal(sourceOf(item, roots, files)).skill);
    if (disk === lib) {
      if (!link.conflict && !link.missing && link.syncedHash === lib) return s;
      changed = true;
      if (link.conflict || link.missing)
        notes.push({ kind: "restored", name: s.displayName });
      return withLink(s, { ...link, syncedHash: lib, conflict: false, missing: false });
    }
    const libChanged = lib !== link.syncedHash;
    const diskChanged = disk !== link.syncedHash;
    if (!libChanged && diskChanged) {
      changed = true;
      notes.push({ kind: "updated", name: s.displayName });
      return adopt(s, fromLocal(sourceOf(item, roots, files)).skill, now, disk);
    }
    if (libChanged && diskChanged) {
      if (link.conflict && !link.missing) return s;
      changed = true;
      if (!link.conflict) notes.push({ kind: "conflict", name: s.displayName });
      return withLink(s, { ...link, conflict: true, missing: false });
    }
    if (link.conflict || link.missing) {
      changed = true;
      return withLink(s, { ...link, conflict: false, missing: false });
    }
    return s;
  });
  return { next: changed ? next : skills, notes };
}

/** 用磁盘（或用户选定的）版本替换技能库内容，保留身份、状态与收藏。 */
export function adopt(
  current: Skill,
  fresh: Skill,
  now: number,
  diskHash = contentHash(fresh),
): Skill {
  const link = linkOf(current);
  return {
    ...fresh,
    id: current.id,
    displayName:
      fresh.name === current.name ? current.displayName : fresh.displayName,
    createdAt: current.createdAt,
    updatedAt: new Date(now).toISOString(),
    status: current.status,
    favorite: current.favorite,
    metadata: {
      ...fresh.metadata,
      local: link
        ? { ...link, syncedHash: diskHash, conflict: false, missing: false }
        : fresh.metadata.local,
    },
  };
}

/**
 * 用户选择保留技能库里的版本：以磁盘当前内容为基准，技能库版本进入“待写回”状态，
 * 不会被磁盘版本覆盖；之后磁盘再变才会重新提示冲突。
 */
export function keepLibrary(skill: Skill, diskHash: string): Skill {
  const link = linkOf(skill);
  if (!link) return skill;
  return withLink(skill, {
    ...link,
    syncedHash: diskHash,
    conflict: false,
  });
}

function withLink(s: Skill, local: LocalLink): Skill {
  return { ...s, metadata: { ...s.metadata, local } };
}

/** 生成写回 SKILL.md 之后磁盘会呈现的内容指纹（用于判断写回是否无损）。 */
export function hashAfterWriteBack(skill: Skill, markdown: string) {
  try {
    return contentHash(parseSkill(markdown));
  } catch {
    return null;
  }
}
