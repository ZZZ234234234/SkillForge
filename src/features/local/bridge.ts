import type { SkillStorage, Snapshot } from "../../storage";
import type { Skill } from "../../types/skill";

/** 一个技能根目录：内置的 Agent 目录，或用户添加的文件夹。 */
export interface LocalRoot {
  id: string;
  agentId: string;
  label: string;
  /** 除目录主人外，还会读取这个目录的其他 Agent */
  readers: string[];
  doc: string;
  /** 该 Agent 保留、不允许占用的技能名 */
  reserved: string[];
  path: string;
  builtin: boolean;
  /** 不在内置清单里、按“<文件夹>/skills/<技能>/SKILL.md”的约定自动发现的目录 */
  found?: boolean;
  exists: boolean;
  error?: string | null;
  count?: number;
}
export interface LocalItem {
  key: string;
  rootId: string;
  dir: string;
  dirName: string;
  group: string | null;
  skillMd: string | null;
  skillJson: string | null;
  mtime: number;
  size: number;
  /** 主文件的大小与修改时间，用来判断“安装后源文件有没有变” */
  sig: string;
  files: number;
  extras: string[];
  hasScripts: boolean;
  /** OpenCode 允许的根目录平铺 <name>.md */
  flat?: boolean;
  /** 用户添加的文件夹本身就是一个技能 */
  self?: boolean;
}
export interface LocalProblem {
  path: string;
  rootId: string;
  reason: "no-skill-md" | "unreadable";
  message?: string;
}
export interface ScanResult {
  roots: LocalRoot[];
  items: LocalItem[];
  problems: LocalProblem[];
  at: number;
  home: string;
}
export interface LocalFile {
  path: string;
  text: string | null;
  sig?: string;
  error?: string;
}
export interface InstallRecord {
  dir: string;
  rootId: string;
  name: string;
  skillId: string | null;
  source: string | null;
  sourceSig: string | null;
  created: boolean;
  files: string[];
  at: number;
}
export interface InstallInput {
  rootId: string;
  name: string;
  source?: string;
  files?: Record<string, string>;
  overwrite?: boolean;
  skillId?: string;
}
export interface InstallResult {
  status: "ok" | "exists";
  dir: string;
  created?: boolean;
  replaced?: number;
  files?: string[];
  conflicts?: string[];
}
export interface DesktopEnv {
  platform: string;
  home: string;
  version: string;
  userData: string;
  electron: string;
}
export interface DesktopApi {
  env(): Promise<DesktopEnv>;
  roots(): Promise<LocalRoot[]>;
  addRoot(): Promise<LocalRoot | null>;
  removeRoot(id: string): Promise<boolean>;
  scan(): Promise<ScanResult>;
  read(paths: string[]): Promise<LocalFile[]>;
  installs(): Promise<Record<string, InstallRecord>>;
  install(input: InstallInput): Promise<InstallResult>;
  uninstall(input: { dir: string }): Promise<{ removed: number }>;
  showItem(input: { path: string }): Promise<boolean>;
  openFile(input: { path: string }): Promise<boolean>;
  openExternal(input: { url: string }): Promise<boolean>;
  storageRead(key: string): Promise<Snapshot | null>;
  storageWrite(key: string, value: Snapshot): Promise<boolean>;
  onScan(callback: (result: ScanResult) => void): () => void;
}

/** 桌面应用里由预加载脚本注入；网页版为 null。 */
export const desktop: DesktopApi | null =
  typeof window !== "undefined" && window.skillforgeDesktop
    ? window.skillforgeDesktop
    : null;

/** 技能库文件落在本机应用数据目录，不再依赖浏览器 localStorage。 */
export class DesktopStorage implements SkillStorage {
  constructor(private key: string) {}
  read() {
    if (!desktop) return Promise.resolve(null);
    return desktop.storageRead(this.key);
  }
  async write(value: Snapshot) {
    if (!desktop) throw new Error("Desktop storage unavailable");
    await desktop.storageWrite(this.key, value);
  }
}

/** 技能库里“链接到本机文件”的记录，存在 metadata.local。 */
export interface LocalLink {
  /** 主文件（SKILL.md 或 skill.json）的绝对路径 */
  path: string;
  dir: string;
  rootId: string;
  rootLabel: string;
  /** 上一次技能库与磁盘达成一致时的内容指纹 */
  syncedHash: string;
  missing?: boolean;
  conflict?: boolean;
}

export function linkOf(s: Skill): LocalLink | null {
  const l = s.metadata.local;
  return l && typeof l === "object" && typeof (l as LocalLink).path === "string"
    ? (l as LocalLink)
    : null;
}

/** 路径比较：Windows 不区分大小写。 */
export function fileKey(p: string) {
  return /^[a-zA-Z]:[\\/]/.test(p) ? p.toLowerCase() : p;
}
export const mainPath = (i: LocalItem) => i.skillMd ?? i.skillJson ?? "";
