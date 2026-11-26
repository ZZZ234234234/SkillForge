"use client";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  FileText,
  FolderCode,
  FolderOpen,
  FolderPlus,
  HardDrive,
  PackageCheck,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Language, Skill } from "../types/skill";
import { toast } from "sonner";
import {
  fileKey,
  linkOf,
  mainPath,
  type InstallRecord,
  type InstallResult,
  type LocalFile,
  type LocalItem,
  type ScanResult,
} from "../features/local/bridge";
import {
  contentHash,
  fromLocal,
  peek,
  sourceOf,
  syncState,
} from "../features/local/convert";
import { words } from "./controls";

/** 一次安装请求：要么复制本机技能文件夹（source），要么写入技能库生成的文件（files）。 */
export interface InstallRequest {
  title: string;
  name: string;
  source?: string;
  files?: Record<string, string>;
  skillId?: string;
  /** 源文件所在的目录，不能装回它自己 */
  excludeRootId?: string;
}

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sameFile = (a: string, b: string) => fileKey(a) === fileKey(b);
const validName = (n: string | null | undefined): n is string =>
  Boolean(n) && NAME_RE.test(n!) && n!.length <= 64;

function rel(p: string, home: string) {
  const h = home.replace(/[\\/]+$/, "");
  const fold = (s: string) => (/^[a-zA-Z]:[\\/]/.test(s) ? s.toLowerCase() : s);
  return fold(p).startsWith(fold(h)) ? "~" + p.slice(h.length) : p;
}
function ago(ms: number, lang: Language) {
  const d = Date.now() - ms;
  if (d < 60_000) return lang === "zh" ? "刚刚" : "just now";
  if (d < 3_600_000)
    return lang === "zh"
      ? `${Math.floor(d / 60_000)} 分钟前`
      : `${Math.floor(d / 60_000)} min ago`;
  return new Date(ms).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LocalView({
  lang,
  scan,
  contents,
  library,
  installs,
  refreshing,
  error,
  onRefresh,
  onAddRoot,
  onRemoveRoot,
  onImport,
  onOpen,
  onInstall,
  onUninstall,
  onWriteBack,
  onUseDisk,
  onKeepMine,
  onShow,
  onOpenFile,
}: {
  lang: Language;
  scan: ScanResult | null;
  contents: Map<string, LocalFile>;
  library: Skill[];
  installs: Record<string, InstallRecord>;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddRoot: () => void;
  onRemoveRoot: (id: string) => void;
  onImport: (item: LocalItem) => void;
  onOpen: (skill: Skill) => void;
  onInstall: (request: InstallRequest) => void;
  onUninstall: (record: InstallRecord) => void;
  onWriteBack: (skill: Skill) => void;
  onUseDisk: (skill: Skill) => void;
  onKeepMine: (skill: Skill, diskHash: string) => void;
  onShow: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const t = words(lang);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showProblems, setShowProblems] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const roots = useMemo(() => scan?.roots ?? [], [scan]);
  const home = scan?.home ?? "";
  const byRoot = useMemo(() => Object.fromEntries(roots.map((r) => [r.id, r])), [roots]);

  const rows = useMemo(() => {
    if (!scan) return [];
    const q = query.trim().toLowerCase();
    return scan.items
      .map((item) => {
        const key = fileKey(mainPath(item));
        const file = contents.get(key);
        const meta = peek(file?.text);
        const linked = library.find(
          (s) => linkOf(s) && fileKey(linkOf(s)!.path) === key,
        );
        const disk =
          file?.text != null
            ? contentHash(fromLocal(sourceOf(item, scan.roots, contents)).skill)
            : null;
        const records = Object.values(installs).filter(
          (r) =>
            (linked && r.skillId === linked.id) ||
            (r.source && sameFile(r.source, item.dir) && (!item.flat || r.name === item.dirName)),
        );
        const root = byRoot[item.rootId];
        const name = validName(item.dirName)
          ? item.dirName
          : validName(meta.name)
            ? meta.name
            : null;
        const state = linked ? syncState(linked, disk, item) : null;
        return {
          item,
          meta,
          linked,
          disk,
          state,
          records: records.map((r) => ({
            record: r,
            root: byRoot[r.rootId],
            stale: Boolean(item.self || (!item.flat && r.sourceSig && r.sourceSig !== item.sig)),
          })),
          root,
          name,
          error: file?.error ?? null,
          text: `${item.dirName} ${meta.name ?? ""} ${meta.description} ${root?.label ?? ""} ${item.group ?? ""}`.toLowerCase(),
        };
      })
      .filter(
        (r) =>
          (filter === "all" || r.item.rootId === filter) &&
          (!q || r.text.includes(q)),
      );
  }, [scan, contents, library, installs, byRoot, query, filter]);

  const live = roots.filter((r) => r.exists);
  const count = scan?.items.length ?? 0;
  const unreadable = roots.filter((r) => r.error).length;

  return (
    <div className="tool-page sf-local" data-local-view>
      <div className="page-title">
        <p className="eyebrow">ON THIS COMPUTER</p>
        <h1>{t("本机技能", "Local Skills")}</h1>
        <p className="muted">
          {t(
            "扫描这台电脑上各个 Agent 的技能文件夹。文件夹有增删改时会自动刷新；已加入技能库的技能会跟着磁盘更新。",
            "Scan the skill folders of every agent on this computer. The list refreshes when folders change, and skills added to the library follow the files on disk.",
          )}
        </p>
      </div>
      <div className="sf-local-bar">
        <span className={"sf-live" + (refreshing ? " busy" : "")} data-local-status>
          <span className="sf-live-dot" />
          {refreshing
            ? t("正在扫描…", "Scanning…")
            : scan
              ? t(
                  `自动刷新已开启 · ${count} 个技能 · ${scan.at ? ago(scan.at, lang) : ""}`,
                  `Auto-refresh on · ${count} skills · ${scan.at ? ago(scan.at, lang) : ""}`,
                )
              : t("还没有扫描", "Not scanned yet")}
        </span>
        <div className="actions">
          <button className="secondary" onClick={onAddRoot} data-act="add-root">
            <FolderPlus size={15} />
            {t("添加文件夹", "Add folder")}
          </button>
          <button className="secondary" onClick={onRefresh} disabled={refreshing} data-act="refresh">
            <RefreshCw size={15} className={refreshing ? "sf-spin" : ""} />
            {t("重新扫描", "Rescan")}
          </button>
        </div>
      </div>
      {error && (
        <div className="sf-local-alert" role="alert">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <section className="surface sf-local-roots">
        <div className="spread">
          <h3>
            <FolderOpen size={16} /> {t("扫描位置", "Scanned folders")}
          </h3>
          <span className="small muted">
            {t(
              "内置目录按各 Agent 官方文档的约定；其他 Agent 可用“添加文件夹”加入。",
              "Built-in folders follow each agent's official documentation. Add any other folder with “Add folder”.",
            )}
          </span>
        </div>
        <ul>
          {roots.map((r) => (
            <li key={r.id} data-root={r.id}>
              <span className="sf-local-root-name">
                {r.label}
                {r.readers?.length > 0 && (
                  <span className="small muted">
                    {t(" · ", " · also read by ")}
                    {r.readers.join(" / ")}
                  </span>
                )}
              </span>
              <code className="sf-local-path" title={r.path}>
                {rel(r.path, home)}
              </code>
              <span className={"sf-local-state " + (r.exists ? "on" : r.error ? "bad" : "off")}>
                {r.error
                  ? t("读取失败", "Unreadable")
                  : r.exists
                    ? t(`${r.count ?? 0} 个技能`, `${r.count ?? 0} skills`)
                    : t("目录不存在", "Not found")}
              </span>
              <span className="sf-local-root-actions">
                {r.exists && (
                  <button
                    className="icon-button"
                    aria-label={t("打开文件夹", "Open folder")}
                    title={t("打开文件夹", "Open folder")}
                    onClick={() => onShow(r.path)}
                  >
                    <ExternalLink size={15} />
                  </button>
                )}
                {r.doc && (
                  <button
                    className="icon-button"
                    aria-label={t("目录约定文档", "Documentation")}
                    title={t("目录约定文档", "Documentation")}
                    onClick={() => window.skillforgeDesktop?.openExternal({ url: r.doc! })}
                  >
                    <FileText size={15} />
                  </button>
                )}
                {!r.builtin &&
                  (confirmRemove === r.id ? (
                    <>
                      <button
                        className="text-button"
                        data-act="remove-root"
                        onClick={() => {
                          onRemoveRoot(r.id);
                          setConfirmRemove(null);
                        }}
                      >
                        {t("确认移除", "Remove")}
                      </button>
                      <button className="icon-button" aria-label={t("取消", "Cancel")} onClick={() => setConfirmRemove(null)}>
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="icon-button"
                      aria-label={t("停止扫描这个文件夹", "Stop scanning this folder")}
                      title={t("停止扫描这个文件夹", "Stop scanning this folder")}
                      onClick={() => setConfirmRemove(r.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ))}
              </span>
            </li>
          ))}
        </ul>
        {unreadable > 0 && (
          <p className="small sf-local-warn">
            {t(
              `有 ${unreadable} 个目录无法读取，详见上面的状态。`,
              `${unreadable} folder(s) could not be read.`,
            )}
          </p>
        )}
      </section>

      <div className="library-toolbar sf-local-toolbar">
        <div className="search-field">
          <FolderCode size={16} />
          <input
            aria-label={t("搜索本机技能", "Search local skills")}
            placeholder={t("搜索名称、描述或 Agent…", "Search name, description or agent…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="category-tabs">
        <button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>
          {t("全部", "All")} <span className="sf-tab-n">{count}</span>
        </button>
        {live.map((r) => (
          <button
            key={r.id}
            className={filter === r.id ? "selected" : ""}
            onClick={() => setFilter(r.id)}
          >
            {r.label} <span className="sf-tab-n">{r.count ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="sf-local-list">
        {rows.map((r) => {
          const { item } = r;
          return (
            <article
              key={item.key}
              className="sf-local-row"
              data-local-item={item.dirName}
              data-state={r.state ?? "new"}
            >
              <div className="sf-local-main">
                <div className="sf-local-title">
                  <span className="mono sf-local-name">{item.dirName}</span>
                  {r.meta.name && r.meta.name !== item.dirName && (
                    <span className="badge" title={t("SKILL.md 里声明的名称", "Name declared in SKILL.md")}>
                      {r.meta.name}
                    </span>
                  )}
                  <span className="sf-local-origin">
                    {r.root?.label ?? item.rootId}
                    {item.group ? ` › ${item.group}` : ""}
                  </span>
                </div>
                <p className="sf-local-desc">
                  {r.meta.description ||
                    r.error ||
                    t("（这个技能没有写描述）", "(this skill has no description)")}
                </p>
                <div className="sf-local-meta small muted">
                  <span>{item.skillMd ? "SKILL.md" : "skill.json"}</span>
                  {item.files > 1 && <span>{t(`+${item.files - 1} 个文件`, `+${item.files - 1} files`)}</span>}
                  {item.hasScripts && <span>{t("含脚本", "scripts")}</span>}
                  <code className="sf-local-path" title={item.dir}>
                    {rel(item.dir, home)}
                  </code>
                </div>
              </div>
              <div className="sf-local-flags">
                {r.linked && r.state === "in-sync" && (
                  <span className="sf-flag ok" data-flag="linked">
                    <PackageCheck size={13} /> {t("已在技能库", "In library")}
                  </span>
                )}
                {r.linked && r.state === "pending" && (
                  <span className="sf-flag info" data-flag="pending">
                    <AlertTriangle size={13} /> {t("技能库有修改，尚未写回", "Edited in library, not written back")}
                  </span>
                )}
                {r.linked && r.state === "conflict" && (
                  <span className="sf-flag bad" data-flag="conflict">
                    <AlertTriangle size={13} /> {t("磁盘和技能库都改了", "Changed on disk and in library")}
                  </span>
                )}
                {r.records.map(({ record, root, stale }) => (
                  <span key={record.dir} className="sf-flag ok" data-flag="installed">
                    <HardDrive size={13} />
                    {t("已安装到 ", "Installed to ")}
                    {root?.label ?? record.rootId}
                    {stale && <em data-flag="stale"> · {t("源文件已更新", "source changed")}</em>}
                    {confirmUninstall === record.dir ? (
                      <span className="sf-flag-act">
                        <button
                          data-act="uninstall"
                          onClick={() => {
                            onUninstall(record);
                            setConfirmUninstall(null);
                          }}
                        >
                          {t("确认卸载", "Uninstall")}
                        </button>
                        <button className="icon-button" aria-label={t("取消", "Cancel")} onClick={() => setConfirmUninstall(null)}>
                          <X size={13} />
                        </button>
                      </span>
                    ) : (
                      <button
                        className="sf-flag-x"
                        aria-label={t("卸载", "Uninstall")}
                        title={t("卸载：只移除 SkillForge 写入的文件，移入回收站", "Uninstall: moves only the files SkillForge wrote to the Recycle Bin")}
                        onClick={() => setConfirmUninstall(record.dir)}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="sf-local-actions">
                {r.linked && r.state === "conflict" && r.disk && (
                  <>
                    <button className="text-button small" data-act="use-disk" onClick={() => onUseDisk(r.linked!)}>
                      {t("用磁盘版本", "Use disk version")}
                    </button>
                    <button className="text-button small" data-act="keep-mine" onClick={() => onKeepMine(r.linked!, r.disk!)}>
                      {t("保留技能库版本", "Keep library version")}
                    </button>
                  </>
                )}
                {r.linked && r.state === "pending" && !item.flat && (
                  <button className="secondary small" data-act="write-back" onClick={() => onWriteBack(r.linked!)}>
                    {t("写回 SKILL.md", "Write back")}
                  </button>
                )}
                {!r.linked && (
                  <button className="primary small" data-act="import" onClick={() => onImport(item)}>
                    {t("导入到技能库", "Add to library")}
                    <ArrowRight size={14} />
                  </button>
                )}
                {r.linked && (
                  <button className="secondary small" data-act="open" onClick={() => onOpen(r.linked!)}>
                    {t("打开", "Open")}
                  </button>
                )}
                <button
                  className="secondary small"
                  data-act="install"
                  disabled={!r.name}
                  title={
                    r.name
                      ? undefined
                      : t("文件夹名和 SKILL.md 里的名称都不符合规范（小写字母、数字、连字符）", "Neither the folder name nor the name in SKILL.md is valid")
                  }
                  onClick={() =>
                    onInstall({
                      title: item.dirName,
                      name: r.name!,
                      source: item.dir,
                      excludeRootId: item.rootId,
                    })
                  }
                >
                  <HardDrive size={14} />
                  {r.records.length ? t("同步到…", "Sync to…") : t("安装到…", "Install to…")}
                </button>
                {item.dir !== item.skillMd && (
                  <button
                    className="icon-button"
                    aria-label={t("打开所在文件夹", "Show in folder")}
                    title={t("打开所在文件夹", "Show in folder")}
                    data-act="show"
                    onClick={() => onShow(item.dir)}
                  >
                    <FolderOpen size={16} />
                  </button>
                )}
                {item.skillMd && (
                  <button
                    className="icon-button"
                    aria-label={t("打开 SKILL.md", "Open SKILL.md")}
                    title={t("用默认程序打开", "Open with the default app")}
                    data-act="file"
                    onClick={() => onOpenFile(item.skillMd!)}
                  >
                    <FileText size={16} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {scan && !rows.length && (
          <div className="empty">
            <HardDrive size={28} />
            <h3>{t("没有找到技能", "No skills found")}</h3>
            <p>
              {count
                ? t("换个搜索词或切换上方的 Agent 分类。", "Try another search or switch agent above.")
                : t(
                    "这些目录里还没有带 SKILL.md 的技能文件夹。可以用 SkillForge 新建一个，再“安装到”对应目录。",
                    "No skill folders with a SKILL.md in these locations yet. Create one with SkillForge, then “Install to” a folder.",
                  )}
            </p>
          </div>
        )}
        {!scan && !error && (
          <div className="empty">
            <RefreshCw size={28} className="sf-spin" />
            <h3>{t("正在扫描本机目录…", "Scanning this computer…")}</h3>
          </div>
        )}
      </div>

      {scan && scan.problems.length > 0 && (
        <section className="surface sf-local-problems">
          <button className="text-button" data-act="problems" onClick={() => setShowProblems(!showProblems)}>
            <AlertTriangle size={15} />
            {t(
              `${scan.problems.length} 个文件夹没有 SKILL.md`,
              `${scan.problems.length} folders without SKILL.md`,
            )}
          </button>
          {showProblems && (
            <ul>
              {scan.problems.map((p) => (
                <li key={p.path}>
                  <code className="sf-local-path">{rel(p.path, home)}</code>
                  <span className="small muted">
                    {p.reason === "no-skill-md"
                      ? t("未被发现：缺少 SKILL.md", "Not discovered: SKILL.md missing")
                      : (p.message ?? t("无法读取", "Unreadable"))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** 选择目标目录并执行安装；遇到已有文件时，先告诉用户再覆盖。 */
export function InstallDialog({
  lang,
  request,
  scan,
  installs,
  run,
  onClose,
  onDone,
}: {
  lang: Language;
  request: InstallRequest | null;
  scan: ScanResult | null;
  installs: Record<string, InstallRecord>;
  run: (rootId: string, overwrite: boolean) => Promise<InstallResult>;
  onClose: () => void;
  onDone: (dirs: string[]) => void;
}) {
  const t = words(lang);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = (scan?.roots ?? []).filter((r) => r.id !== request?.excludeRootId);
  const installed = Object.values(installs).filter(
    (r) => request?.skillId && r.skillId === request.skillId,
  );
  const toggle = (id: string) => {
    setError(null);
    setConflicts(null);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const go = async (overwrite: boolean) => {
    if (!request) return;
    const list = overwrite && conflicts ? conflicts : [...selected];
    setBusy(true);
    setError(null);
    try {
      const done: string[] = [];
      const exist: string[] = [];
      for (const rootId of list) {
        const r = await run(rootId, overwrite);
        if (r.status === "exists") exist.push(rootId);
        else done.push(r.dir);
      }
      if (exist.length) {
        setConflicts(exist);
        return;
      }
      toast.success(
        overwrite
          ? t(`已覆盖更新到 ${done.length} 个目录`, `Updated in ${done.length} folder(s)`)
          : t(`已安装到 ${done.length} 个目录`, `Installed to ${done.length} folder(s)`),
      );
      onDone(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(v) => {
        if (!v && !busy) {
          setSelected(new Set());
          setConflicts(null);
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="import-dialog sf-install" data-install-dialog>
        <DialogHeader>
          <DialogTitle>
            {t("安装到本机 Agent", "Install to a local agent")} ·{" "}
            <span className="mono">{request?.title}</span>
          </DialogTitle>
          <DialogDescription>
            {t(
              "把技能写入所选 Agent 的技能文件夹。同名文件会被覆盖，旧文件移入回收站；文件夹里的其他文件不会改动。",
              "Write the skill into each selected agent's skill folder. Files with the same name are replaced and the old ones go to the Recycle Bin. Other files in the folder are left alone.",
            )}
          </DialogDescription>
        </DialogHeader>
        {conflicts ? (
          <div className="sf-local-alert" data-install-conflicts={conflicts.length} role="alert">
            <AlertTriangle size={15} />
            <span>
              {t(
                `${conflicts.length} 个目录里已经有同名文件：${conflicts
                  .map((id) => targets.find((x) => x.id === id)?.label ?? id)
                  .join("、")}。`,
                `${conflicts.length} target(s) already contain files with the same name: ${conflicts
                  .map((id) => targets.find((x) => x.id === id)?.label ?? id)
                  .join(", ")}.`,
              )}
            </span>
          </div>
        ) : (
          <ul className="sf-install-targets">
            {targets.map((r) => {
              const mine = Object.values(installs).find(
                (x) => x.rootId === r.id && request?.skillId && x.skillId === request.skillId,
              );
              return (
                <li key={r.id} data-install-target={r.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                    <span className="sf-install-text">
                      <span className="sf-install-name">{r.label}</span>
                      <code className="sf-local-path">{rel(r.path, scan?.home ?? "")}</code>
                    </span>
                  </label>
                  <span className="small muted">
                    {!r.exists
                      ? t("目录不存在，安装时创建", "Folder created on install")
                      : mine
                        ? t("已安装，再次安装即更新", "Installed · reinstall to update")
                        : r.readers?.length
                          ? t(`${r.readers.join("、")} 也会读取`, `also read by ${r.readers.join(", ")}`)
                          : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <div className="sf-local-alert" role="alert">
            <AlertTriangle size={15} /> {error}
          </div>
        )}
        {installed.length > 0 && !conflicts && (
          <p className="small muted" data-install-done={installed.length}>
            {t(
              `之前安装到：${installed
                .map((r) => targets.find((x) => x.id === r.rootId)?.label ?? r.rootId)
                .join("、")}。重新安装会覆盖那次写入的文件。`,
              `Previously installed to: ${installed
                .map((r) => targets.find((x) => x.id === r.rootId)?.label ?? r.rootId)
                .join(", ")}. Reinstalling replaces the files written then.`,
            )}
          </p>
        )}
        <div className="actions">
          {conflicts ? (
            <>
              <button className="primary" disabled={busy} data-install-confirm="overwrite" onClick={() => go(true)}>
                {t("覆盖安装", "Replace and install")}
              </button>
              <button className="secondary" disabled={busy} onClick={() => setConflicts(null)}>
                {t("返回", "Back")}
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={busy || !selected.size}
              data-install-confirm
              onClick={() => go(false)}
            >
              <HardDrive size={15} />
              {busy
                ? t("安装中…", "Installing…")
                : t(`安装到 ${selected.size} 个目录`, `Install to ${selected.size} folder(s)`)}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
