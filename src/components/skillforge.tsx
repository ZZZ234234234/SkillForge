"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Compass,
  Package,
  FolderCode,
  WandSparkles,
  FlaskConical,
  Globe,
  Settings,
  Info,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Sun,
  Moon,
  Download,
  Upload,
  Lock,
  Terminal,
  PanelLeft,
  Bot,
  Play,
  HardDrive,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Toaster, toast } from "sonner";
import { Library } from "./library";
import { Editor } from "./editor";
import { Inspector } from "./inspector";
import { Generator } from "./generator";
import { Tester } from "./tester";
import { Runner } from "./runner";
import { Steward } from "./steward";
import { InstallDialog, LocalView, type InstallRequest } from "./local";
import { Pick, words, download } from "./controls";
import { registrySkills } from "../features/skills/registry";
import { blankSkill, skillSchema } from "../features/skills/schema";
import { skillMarkdown, skillReadme } from "../features/skills/parser";
import {
  exportZip,
  readZip,
  importFiles,
  importGitHub,
} from "../features/skills/archive";
import { packageFiles, adapters } from "../adapters";
import { detectSecrets, redactSecrets } from "../features/inspector/engine";
import { BrowserStorage, type SkillStorage } from "../storage";
import {
  desktop as dk,
  fileKey,
  linkOf,
  mainPath,
  DesktopStorage,
  type DesktopEnv,
  type InstallRecord,
  type LocalFile,
  type LocalItem,
  type ScanResult,
} from "../features/local/bridge";
import {
  adopt,
  contentHash,
  fromLocal,
  hashAfterWriteBack,
  keepLibrary,
  reconcile,
  sourceOf,
  stamp,
  type SyncNote,
} from "../features/local/convert";
import type {
  Skill,
  Language,
  ModelSettings,
  TestResult,
} from "../types/skill";
const HOME_VIEW = dk ? "local" : "explore";
/** 写入磁盘的安装包：与网页版导出的目录结构一致，去掉最外层目录名。 */
function packageFor(s: Skill): Record<string, string> {
  return Object.fromEntries(
    Object.entries(packageFiles(s, "generic")).map(([k, v]) => [
      k.slice(s.name.length + 1),
      v,
    ]),
  );
}
export default function SkillForge({ demo = false }: { demo?: boolean }) {
  const [skills, setSkills] = useState<Skill[]>(registrySkills),
    [results, setResults] = useState<TestResult[]>([]),
    [ready, setReady] = useState(false),
    [storageBlocked, setStorageBlocked] = useState(false),
    [view, setView] = useState(HOME_VIEW),
    [selected, setSelected] = useState<string | null>(null),
    [lang, setLang] = useState<Language>("zh"),
    [light, setLight] = useState(false),
    [dialog, setDialog] = useState<"import" | "export" | null>(null),
    [target, setTarget] = useState("generic"),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState<ModelSettings>({
      endpoint: "https://api.openai.com/v1",
      model: "",
      apiKey: "",
    }),
    [saveStatus, setSaveStatus] = useState(""),
    [imported, setImported] = useState<Skill[] | null>(null),
    [scan, setScan] = useState<ScanResult | null>(null),
    [contents, setContents] = useState<Map<string, LocalFile>>(new Map()),
    [installs, setInstalls] = useState<Record<string, InstallRecord>>({}),
    [scanError, setScanError] = useState<string | null>(null),
    [env, setEnv] = useState<DesktopEnv | null>(null),
    [refreshing, setRefreshing] = useState(false),
    [installReq, setInstallReq] = useState<InstallRequest | null>(null);
  const storage = useRef<SkillStorage>(
    dk
      ? new DesktopStorage(demo ? "skillforge-demo-v1" : "skillforge-local-v1")
      : new BrowserStorage(demo ? "skillforge-demo-v1" : "skillforge-local-v1"),
  );
  const uploader = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null),
    skillsRef = useRef<Skill[]>(skills),
    scanSeq = useRef(0),
    mounted = useRef(true),
    applyScanRef = useRef<(r: ScanResult, notify: boolean) => Promise<void>>(
      async () => {},
    );
  const t = words(lang),
    skill = skills.find((s) => s.id === selected);
  const loadInstalls = useCallback(async () => {
    if (dk) setInstalls((await dk.installs()) ?? {});
  }, []);
  /** 把一次扫描结果落到界面：读取文件内容，并让链接到本机文件的技能跟上磁盘。 */
  const applyScan = useCallback(
    async (result: ScanResult, notify: boolean) => {
      if (!dk) return;
      const seq = ++scanSeq.current;
      const linked = skillsRef.current.flatMap((s) => {
        const p = linkOf(s)?.path;
        return p ? [p] : [];
      });
      const paths = [...new Set([...result.items.map(mainPath), ...linked])];
      const files = await dk.read(paths);
      if (seq !== scanSeq.current || !mounted.current) return;
      const map = new Map(files.map((f) => [fileKey(f.path), f]));
      let notes: SyncNote[] = [];
      setSkills((all) => {
        const r = reconcile({
          skills: all,
          items: result.items,
          files: map,
          roots: result.roots,
          now: Date.now(),
        });
        notes = r.notes;
        return r.next;
      });
      setContents(map);
      setScan(result);
      setScanError(
        result.roots.find((r) => r.error)?.error ??
          files.find((f) => f.error)?.error ??
          null,
      );
      if (notify && notes.length) {
        const count = (k: SyncNote["kind"]) => notes.filter((n) => n.kind === k).length;
        const updated = count("updated"),
          conflicts = notes.filter((n) => n.kind === "conflict"),
          missing = notes.filter((n) => n.kind === "missing");
        if (updated)
          toast.message(
            t(
              `已按磁盘内容更新 ${updated} 个技能`,
              `${updated} skill(s) updated from disk`,
            ),
          );
        for (const n of conflicts)
          toast.warning(
            t(
              `「${n.name}」在磁盘和技能库里都有修改，请在本机技能里选择保留哪一版`,
              `“${n.name}” changed on disk and in the library. Choose which version to keep in Local Skills`,
            ),
          );
        for (const n of missing)
          toast.warning(
            t(`「${n.name}」的源文件已被移除`, `The source file of “${n.name}” was removed`),
          );
      }
    },
    [t],
  );
  useEffect(() => {
    let active = true;
    void storage.current
      .read()
      .then(async (d) => {
        if (!active) return;
        setSkills(d?.skills ?? registrySkills());
        setResults(d?.results ?? []);
        try {
          const p = JSON.parse(
            localStorage.getItem("skillforge-preferences") ?? "{}",
          );
          if (p.lang) setLang(p.lang === "en" ? "en" : "zh");
          if (p.light) setLight(true);
          if (p.endpoint)
            setSettings((s) => ({
              ...s,
              endpoint: p.endpoint,
              model: p.model ?? "",
            }));
        } catch {}
        setReady(true);
        // 桌面端：先读技能库，再做第一次扫描，这样才知道哪些技能链接到了本机文件
        if (dk)
          return applyScanRef.current(await dk.scan(), false)
            .then(() => loadInstalls())
            .catch((e) => {
              if (active)
                setScanError(e instanceof Error ? e.message : String(e));
            });
      })
      .catch(() => {
        if (active) {
          setSkills(registrySkills());
          setStorageBlocked(true);
          setReady(true);
          toast.error(
            "Unable to read saved data. Export your work; browser storage may be unavailable.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [loadInstalls]);
  useEffect(() => {
    skillsRef.current = skills;
  }, [skills]);
  useEffect(() => {
    mounted.current = true;
    applyScanRef.current = applyScan;
  });
  useEffect(() => {
    if (!dk || !ready) return;
    const off = dk.onScan((r) => {
      void applyScanRef.current(r, true);
    });
    return () => {
      off();
      mounted.current = false;
    };
  }, [ready]);
  useEffect(() => {
    if (dk) void dk.env().then(setEnv).catch(() => {});
  }, []);
  useEffect(() => {
    if (!dk) return;
    let active = true;
    void dk
      .installs()
      .then((r) => {
        if (active) setInstalls(r ?? {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [light, lang]);
  useEffect(() => {
    if (!ready || storageBlocked) return;
    const timer = setTimeout(() => {
      void storage.current
        .write({ skills, results })
        .then(() =>
          setSaveStatus(
            dk
              ? lang === "zh"
                ? "已保存到本机文件"
                : "Saved on this computer"
              : lang === "zh"
                ? "已保存到浏览器"
                : "Saved in browser",
          ),
        )
        .catch(() => {
          setSaveStatus(
            lang === "zh"
              ? "保存失败，请导出备份"
              : "Save failed; export a backup",
          );
          toast.error("Local save failed. Export your work now.");
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [skills, results, ready, lang, storageBlocked]);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          "skillforge-preferences",
          JSON.stringify({
            lang,
            light,
            endpoint: settings.endpoint,
            model: settings.model,
          }),
        );
      } catch {}
    }
  }, [lang, light, settings.endpoint, settings.model, ready]);
  const change = (s: Skill) => {
    setSkills((all) =>
      all.map((x) =>
        x.id === s.id
          ? {
              ...s,
              status: s.status === "Registry" ? "Local" : s.status,
              updatedAt: new Date().toISOString(),
            }
          : x,
      ),
    );
  };
  const open = (s: Skill) => {
    setSelected(s.id);
    setView("editor");
  };
  /** 只加入技能库、不切换页面：管家 Agent 新建技能时用，避免把对话页面顶掉 */
  const addQuietly = (s: Skill) =>
    setSkills((all) => [s, ...all.filter((x) => x.id !== s.id)]);
  const add = (s: Skill) => {
    addQuietly(s);
    open(s);
  };
  const create = () => add(blankSkill());
  const nav = (v: string) => {
    setView(v);
    setSelected(null);
  };
  const install = (s: Skill) => {
    // 桌面版：“安装”是写入所选 Agent 的技能文件夹，完成后再标记为已安装
    if (dk) {
      setInstallReq({
        title: s.displayName,
        name: s.name,
        files: packageFor(s),
        skillId: s.id,
      });
      return;
    }
    change({ ...s, status: "Installed" });
    toast.success(
      t(
        "已安装到浏览器技能库；导出后可放入 Agent 目录。",
        "Installed in the browser library; export to add it to your agent.",
      ),
    );
  };
  const fail = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : String(e));
  const refreshScan = async () => {
    if (!dk) return;
    setRefreshing(true);
    try {
      await applyScanRef.current(await dk.scan(), true);
    } catch (e) {
      fail(e);
    } finally {
      setRefreshing(false);
    }
  };
  const addRoot = async () => {
    if (!dk) return;
    try {
      await dk.addRoot();
      await refreshScan();
    } catch (e) {
      fail(e);
    }
  };
  const removeRoot = async (id: string) => {
    if (!dk) return;
    try {
      await dk.removeRoot(id);
      await refreshScan();
    } catch (e) {
      fail(e);
    }
  };
  /** 导入本机技能：副本链接到磁盘上的文件，之后磁盘有改动会自动跟进。 */
  const importLocal = (item: LocalItem) => {
    if (!dk || !scan) return;
    const key = fileKey(mainPath(item));
    const existing = skills.find(
      (s) => linkOf(s) && fileKey(linkOf(s)!.path) === key,
    );
    if (existing) return open(existing);
    const { skill: fresh, warning } = fromLocal(
      sourceOf(item, scan.roots, contents),
    );
    // 留在“本机技能”页，方便连续导入；行内会出现“打开”按钮
    addQuietly(stamp(fresh));
    toast.success(
      t(
        `已导入「${fresh.displayName}」，并与本机文件保持同步`,
        `Added “${fresh.displayName}”; it now follows the file on disk`,
      ),
    );
    if (warning) toast.warning(warning);
  };
  const withLocal = (s: Skill, local: NonNullable<ReturnType<typeof linkOf>>): Skill => ({
    ...s,
    metadata: { ...s.metadata, local },
  });
  /** 把技能库里的版本写回它来源的 SKILL.md。 */
  const writeBack = async (s: Skill) => {
    const link = linkOf(s);
    if (!dk || !link) return;
    const md = skillMarkdown(s);
    const name = link.dir.split(/[\\/]/).pop() ?? s.name;
    try {
      await dk.install({
        rootId: link.rootId,
        name,
        files: { "SKILL.md": md, "skill.json": JSON.stringify(s, null, 2) },
        overwrite: true,
        skillId: s.id,
      });
      const round = hashAfterWriteBack(s, md),
        lib = contentHash(s);
      change(withLocal(s, { ...link, syncedHash: round ?? lib, conflict: false, missing: false }));
      toast.success(t("已写回 SKILL.md", "Written back to SKILL.md"));
      if (round !== null && round !== lib)
        toast.info(
          t(
            "技能库里有 SKILL.md 表达不了的内容（例如 Instructions 中的二级标题），它们不会出现在文件里。",
            "Some content cannot be expressed in SKILL.md (for example level-2 headings inside Instructions) and is not in the file.",
          ),
        );
      await loadInstalls();
    } catch (e) {
      fail(e);
    }
  };
  const useDisk = (s: Skill) => {
    const link = linkOf(s);
    if (!scan || !link) return;
    const item = scan.items.find((i) => fileKey(mainPath(i)) === fileKey(link.path));
    if (!item) return;
    change(adopt(s, fromLocal(sourceOf(item, scan.roots, contents)).skill, Date.now()));
    toast.success(t("已改用磁盘上的版本", "Switched to the version on disk"));
  };
  const keepMine = (s: Skill, diskHash: string) => {
    change(keepLibrary(s, diskHash));
    toast.message(
      t("保留了技能库里的版本，可点“写回 SKILL.md”更新磁盘文件", "Kept the library version. Use “Write back” to update the file on disk"),
    );
  };
  const uninstallLocal = async (record: InstallRecord) => {
    if (!dk) return;
    try {
      const r = await dk.uninstall({ dir: record.dir });
      await loadInstalls();
      toast.success(
        t(
          `已卸载，${r.removed} 个文件移入回收站`,
          `Uninstalled; ${r.removed} file(s) moved to the Recycle Bin`,
        ),
      );
    } catch (e) {
      fail(e);
    }
  };
  const show = (path: string) => dk?.showItem({ path }).catch(fail);
  const openFile = (path: string) => dk?.openFile({ path }).catch(fail);
  const read = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const contents: Record<string, string> = {};
      if (files.length > 100) throw new Error("Maximum 100 files");
      let total = 0;
      for (const f of Array.from(files)) {
        total += f.size;
        if (total > 10_000_000) throw new Error("Import exceeds 10 MB");
        if (f.name.toLowerCase().endsWith(".zip"))
          Object.assign(
            contents,
            readZip(new Uint8Array(await f.arrayBuffer())),
          );
        else if (/\.(md|json)$/i.test(f.name)) {
          if (f.size > 2_000_000) throw new Error("File exceeds 2 MB");
          contents[f.webkitRelativePath || f.name] = await f.text();
        }
      }
      setImported(importFiles(contents));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (uploader.current) uploader.current.value = "";
      if (folder.current) folder.current.value = "";
    }
  };
  const exportSkill = (format: string) => {
    if (!skill) return;
    const valid = skillSchema.safeParse(skill);
    if (!valid.success)
      return toast.error(
        t("请先修复数据格式：", "Fix schema errors: ") +
          valid.error.issues[0].message,
      );
    if (detectSecrets(JSON.stringify(skill)).length)
      return toast.error(
        t(
          "检测到疑似敏感信息，请先在编辑器中遮盖。",
          "Potential Secret Detected. Redact it in the editor before export.",
        ),
      );
    if (format === "zip")
      download(
        `${skill.name}-${skill.version}-${target}.zip`,
        exportZip(packageFiles(skill, target)),
        "application/zip",
      );
    else
      download(
        format === "readme"
          ? "README.md"
          : format === "json"
            ? "skill.json"
            : "SKILL.md",
        format === "json"
          ? JSON.stringify(skill, null, 2)
          : format === "readme"
            ? skillReadme(skill)
            : skillMarkdown(skill),
        format === "json" ? "application/json" : "text/markdown",
      );
    toast.success(t("已生成下载文件", "Download prepared"));
  };
  const navigation = [
    ...(dk
      ? [{ id: "local", icon: HardDrive, zh: "本机技能", en: "Local Skills" }]
      : []),
    { id: "explore", icon: Compass, zh: "发现", en: "Explore" },
    { id: "installed", icon: Package, zh: "已安装", en: "Installed" },
    { id: "mine", icon: FolderCode, zh: "我的技能", en: "My Skills" },
    { id: "generator", icon: WandSparkles, zh: "生成器", en: "Generator" },
    { id: "tester", icon: FlaskConical, zh: "测试与比较", en: "Tester" },
    { id: "runner", icon: Play, zh: "Agent 试运行", en: "Agent Run" },
    { id: "steward", icon: Bot, zh: "管家 Agent", en: "Steward" },
    { id: "registry", icon: Globe, zh: "开放目录", en: "Registry" },
  ];
  return (
    <SidebarProvider>
      <div className="sf-shell">
        <Sidebar className="sf-sidebar">
          <SidebarHeader>
            {/*
              这个组件同时给网页版和 Electron 桌面版用，桌面版不能依赖 next/link，
              所以这里用普通链接：网页版回到首页，桌面版回到起始视图。
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="brand"
              onClick={(e) => {
                if (dk) {
                  e.preventDefault();
                  nav(HOME_VIEW);
                }
              }}
            >
              <span className="brand-mark">
                <Terminal size={22} />
              </span>
              <strong>SkillForge</strong>
              <span className="version-badge">BETA</span>
            </a>
            <div className="workspace-picker">
              <span className="workspace-avatar">S</span>
              <span>
                {t("个人工作区", "Personal workspace")}
                <small>
                  {t("本地优先 · 无需账号", "Local-first · No account")}
                </small>
              </span>
              <ChevronRight size={14} />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <div className="nav-label">WORKSPACE</div>
            <SidebarMenu>
              {navigation.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton
                    isActive={view === n.id}
                    onClick={() => nav(n.id)}
                  >
                    <n.icon size={18} />
                    <span>{t(n.zh, n.en)}</span>
                    {n.id === "installed" && (
                      <span className="nav-count">
                        {skills.filter((s) => s.status === "Installed").length}
                      </span>
                    )}
                    {n.id === "generator" && (
                      <span className="new-pill">AI</span>
                    )}
                    {(n.id === "runner" || n.id === "steward") && (
                      <span className="new-pill">
                        {n.id === "runner" ? "NEW" : "AI"}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <div className="sidebar-create">
              <button onClick={create}>
                <Plus size={15} />
                {t("新建 Skill", "New Skill")}
                <kbd>+</kbd>
              </button>
            </div>
            <div className="sidebar-note">
              <span className="note-icon">
                <ShieldCheck size={19} />
              </span>
              <h4>{t("你的技能，始终属于你", "Your skills. Your control.")}</h4>
              <p>
                {dk
                  ? t(
                      "技能库保存在这台电脑的本地文件里。只有你主动调用模型时才发送内容。",
                      "Your library is stored in a local file on this computer. Content is sent only when you invoke a model.",
                    )
                  : t(
                      "默认保存在浏览器。只有你主动调用模型时才发送内容。",
                      "Stored in your browser. Content is sent only when you invoke a model.",
                    )}
              </p>
              <button onClick={() => nav("about")}>
                {t("了解本地优先", "About local-first")}
                <ArrowUpRight size={13} />
              </button>
            </div>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              {[
                { id: "settings", icon: Settings, zh: "设置", en: "Settings" },
                {
                  id: "about",
                  icon: Info,
                  zh: "关于 SkillForge",
                  en: "About SkillForge",
                },
              ].map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton
                    isActive={view === n.id}
                    onClick={() => nav(n.id)}
                  >
                    <n.icon size={17} />
                    {t(n.zh, n.en)}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <div className="author-mini">
              <span>芥</span>
              <div>
                爱吃孜然芥末<small>Independent developer</small>
              </div>
              <button
                aria-label="Toggle color theme"
                className="icon-button"
                onClick={() => setLight(!light)}
              >
                {light ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="sf-main" inert={!ready}>
          <header className="topbar">
            <div className="breadcrumb">
              <SidebarTrigger />
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>
                {view === "editor"
                  ? skill?.displayName
                  : (navigation.find((n) => n.id === view)?.en ?? view)}
              </strong>
            </div>
            <div className="topbar-right">
              <span className="local-status">
                <Lock size={12} />
                {demo ? "Demo Data" : t("本地工作区", "Local workspace")}
              </span>
              <button
                className="text-button language-toggle"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              >
                <Globe size={14} />
                {lang === "zh" ? "EN" : "中文"}
              </button>
              <button
                className="icon-button"
                aria-label="About source code"
                onClick={() => nav("about")}
              >
                <FolderCode size={17} />
              </button>
            </div>
          </header>
          {view === "local" && dk ? (
            <LocalView
              lang={lang}
              scan={scan}
              contents={contents}
              library={skills}
              installs={installs}
              refreshing={refreshing}
              error={scanError}
              onRefresh={() => void refreshScan()}
              onAddRoot={() => void addRoot()}
              onRemoveRoot={(id) => void removeRoot(id)}
              onImport={importLocal}
              onOpen={open}
              onInstall={(request) => {
                const item = scan?.items.find((i) => i.dir === request.source);
                const key = item ? fileKey(mainPath(item)) : "";
                const linked = skills.find(
                  (s) => linkOf(s) && fileKey(linkOf(s)!.path) === key,
                );
                if (!linked || !item) return setInstallReq(request);
                // 技能库里有改动：整目录复制，再用技能库版本覆盖 SKILL.md；否则原样复制
                const edited = contentHash(linked) !== linkOf(linked)?.syncedHash;
                setInstallReq({
                  ...request,
                  skillId: linked.id,
                  ...(edited
                    ? {
                        files: {
                          "SKILL.md": skillMarkdown(linked),
                          "skill.json": JSON.stringify(linked, null, 2),
                        },
                      }
                    : {}),
                });
              }}
              onUninstall={(record) => void uninstallLocal(record)}
              onWriteBack={(s) => void writeBack(s)}
              onUseDisk={useDisk}
              onKeepMine={keepMine}
              onShow={show}
              onOpenFile={openFile}
            />
          ) : view === "editor" && skill ? (
            <Editor
              key={skill.id}
              skill={skill}
              lang={lang}
              onChange={change}
              onBack={() => nav("explore")}
              onExport={() => setDialog("export")}
              onDuplicate={() =>
                add({
                  ...structuredClone(skill),
                  id: crypto.randomUUID(),
                  name: skill.name.slice(0, 58) + "-copy",
                  displayName: skill.displayName + " Copy",
                  status: "Draft",
                  metadata: { ...skill.metadata, demo: false },
                })
              }
              onDelete={() => {
                setSkills((all) => all.filter((s) => s.id !== skill.id));
                nav("mine");
              }}
            />
          ) : view === "generator" ? (
            <Generator lang={lang} settings={settings} onSave={add} />
          ) : view === "tester" ? (
            <Tester
              lang={lang}
              skills={skills}
              settings={settings}
              results={results}
              onResults={setResults}
              onChange={change}
            />
          ) : view === "runner" ? (
            <Runner lang={lang} skills={skills} settings={settings} />
          ) : view === "steward" ? (
            <Steward
              lang={lang}
              skills={skills}
              settings={settings}
              onAdd={addQuietly}
              onChange={change}
              onOpen={open}
            />
          ) : view === "settings" ? (
            <div className="tool-page settings-page">
              <p className="eyebrow">MAKE IT YOURS</p>
              <h1>{t("设置", "Settings")}</h1>
              <section className="surface">
                <h3>{t("外观与语言", "Appearance & language")}</h3>
                <div className="setting-row">
                  <span>{t("浅色模式", "Light mode")}</span>
                  <Switch
                    checked={light}
                    onCheckedChange={setLight}
                    aria-label="Light mode"
                  />
                </div>
                <div className="setting-row">
                  <span>{t("界面语言", "Interface language")}</span>
                  <Pick
                    value={lang}
                    onChange={(v) => setLang(v as Language)}
                    label="Language"
                    items={[
                      { value: "zh", label: "简体中文" },
                      { value: "en", label: "English" },
                    ]}
                  />
                </div>
              </section>
              <section className="surface">
                <h3>{t("模型连接", "Model connection")}</h3>
                <p className="muted">
                  {t(
                    "支持兼容 Chat Completions 的接口。浏览器直接调用，需要服务商允许跨域请求。模型名称需填写服务商提供的真实型号。",
                    "Supports Chat Completions-compatible endpoints. Requests go directly from your browser; provider CORS support is required. Enter an actual model ID from your provider.",
                  )}
                </p>
                <label>
                  API Base URL
                  <input
                    type="url"
                    value={settings.endpoint}
                    onChange={(e) =>
                      setSettings({ ...settings, endpoint: e.target.value })
                    }
                  />
                </label>
                <label>
                  {t("模型名称", "Model ID")}
                  <input
                    placeholder="Your provider’s model ID"
                    value={settings.model}
                    onChange={(e) =>
                      setSettings({ ...settings, model: e.target.value })
                    }
                  />
                </label>
                <label>
                  API Key{" "}
                  <span className="badge">
                    {t("仅内存保存", "MEMORY ONLY")}
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={settings.apiKey}
                    onChange={(e) =>
                      setSettings({ ...settings, apiKey: e.target.value })
                    }
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() => {
                    setSettings({ ...settings, apiKey: "" });
                    toast.success(t("密钥已清除", "Key cleared"));
                  }}
                >
                  {t("清除密钥", "Clear key")}
                </button>
                <p className="small muted">
                  {t(
                    "密钥不会写入浏览器存储、Skill 或导出包；刷新页面后需要重新填写。",
                    "Keys are not written to browser storage, skills or exports. Re-enter after refreshing.",
                  )}
                </p>
              </section>
              <section className="surface">
                <h3>{t("数据与备份", "Data & backups")}</h3>
                {dk ? (
                  <>
                    <p className="muted">
                      {t(
                        "技能库保存为本机文件，路径如下。清除浏览器数据不会影响它；建议仍定期导出备份。",
                        "Your library is stored in a local file at the path below. Clearing browser data does not affect it; exporting backups regularly is still recommended.",
                      )}
                    </p>
                    <code className="small mono sf-local-path">{env?.userData}</code>
                  </>
                ) : (
                <p className="muted">
                  {t(
                    "使用本地存储适配层。清除浏览器数据会删除工作区；此版本不直接写入电脑文件夹。",
                    "Uses a browser storage adapter. Clearing browser data deletes your workspace. This version does not directly write to filesystem folders.",
                  )}
                </p>
                )}
                <button
                  className="secondary"
                  onClick={() => {
                    const local = skills.filter((s) => s.status !== "Registry");
                    if (!local.length)
                      return toast.error(
                        t("没有本地技能可导出", "No local skills to export"),
                      );
                    if (detectSecrets(JSON.stringify(local)).length)
                      return toast.error("Potential Secret Detected");
                    download(
                      "skillforge-backup.zip",
                      exportZip(
                        Object.assign(
                          {},
                          ...local.map((s) =>
                            Object.fromEntries(
                              Object.entries(packageFiles(s)).map(([k, v]) => [
                                `${s.id}/${k}`,
                                v,
                              ]),
                            ),
                          ),
                        ),
                      ),
                      "application/zip",
                    );
                  }}
                >
                  <Download size={15} />
                  {t("导出全部本地技能", "Export all local skills")}
                </button>
                <p className="small muted">{saveStatus}</p>
              </section>
            </div>
          ) : view === "about" ? (
            <div className="tool-page about-page">
              <div className="brand-mark large">
                <Terminal size={34} />
              </div>
              <p className="eyebrow">OPEN SOURCE · LOCAL-FIRST</p>
              <h1>SkillForge</h1>
              <p className="lead">
                Build, test, inspect and manage skills for AI agents.
              </p>
              <p>
                {t(
                  "Skill 是教 AI Agent 专业完成某项任务的可复用说明书。SkillForge 把角色、工作流、工具权限、输出规范和测试放在同一工作区。",
                  "A skill is a reusable playbook that teaches an AI agent a specialized task. SkillForge brings roles, workflows, tool scopes, outputs and tests into one workspace.",
                )}
              </p>
              <div className="surface">
                <h3>{t("作者与联系", "Author & contact")}</h3>
                <p>Created and maintained independently by 爱吃孜然芥末.</p>
                <a href="mailto:2014546082@qq.com">2014546082@qq.com</a>
              </div>
              <div className="surface">
                <h3>Official Distribution & Authenticity</h3>
                <p>
                  {t(
                    "官方仓库：ZZZ234234234/SkillForge。正式版本仅通过该仓库 GitHub Releases 发布；请核对具体版本的发布记录。",
                    "Official repository: ZZZ234234234/SkillForge. Official releases are distributed only through its GitHub Releases page. Verify the publication record for the exact version.",
                  )}
                </p>
                <p>
                  {t(
                    "SHA256 可核对文件是否一致；Attestation 可证明构建来源，需以实际成功发布的证明为准。第三方 Fork 可以使用 MIT 代码，但不代表官方发行。",
                    "SHA256 verifies file integrity. Attestations verify build provenance when actually issued. MIT forks are permitted and do not represent official distributions.",
                  )}
                </p>
              </div>
              <div className="surface">
                <h3>{t("兼容性与边界", "Compatibility & limitations")}</h3>
                <p>
                  Codex / Claude Code: SKILL.md{" "}
                  {dk
                    ? t(
                        "目录导出；桌面版可在你确认后写入所选 Agent 的技能目录。",
                        "directory exports; the desktop app writes into the agent folder you choose, after you confirm.",
                      )
                    : t(
                        "目录导出，不自动安装或执行。",
                        "directory exports, without automatic installation or execution.",
                      )}
                </p>
                <p>
                  OpenAI Agents SDK / MCP: Experimental{" "}
                  {t(
                    "说明包，不是 SDK 适配器或 MCP 服务。",
                    "instruction bundles, not SDK integrations or MCP servers.",
                  )}
                </p>
                <p>
                  {t(
                    "已在浏览器内提供 Agent 运行时（应用内工具，按技能权限放行或确认）。CLI 与 shell 执行仍在计划中。",
                    "An in-browser agent runtime is available (in-app tools, allowed or confirmed by skill permissions). CLI and shell execution are still planned.",
                  )}
                </p>
                {dk && (
                  <p>
                    {t(
                      "这是桌面版：可以扫描本机各 Agent 的技能文件夹、安装与同步技能，目录变化会自动刷新。技能库保存为本机文件，安装或覆盖时旧文件移入回收站。",
                      "This is the desktop app: it scans the skill folders of local agents, installs and syncs skills, and refreshes when folders change. The library is a local file; replaced files go to the Recycle Bin.",
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Library
              skills={skills}
              lang={lang}
              view={view}
              open={open}
              onFavorite={(s) =>
                setSkills((all) =>
                  all.map((x) =>
                    x.id === s.id ? { ...x, favorite: !x.favorite } : x,
                  ),
                )
              }
              onInstall={install}
              onCreate={create}
              onGenerator={() => nav("generator")}
              onImport={() => {
                setImported(null);
                setDialog("import");
              }}
            />
          )}
          <div className="statusbar">
            <span>
              <PanelLeft size={12} />
              {demo ? "Demo workspace" : t("本地工作区", "Local workspace")}
            </span>
            <span>
              {storageBlocked
                ? t(
                    "原存档读取失败，自动保存已停用，请导出备份",
                    "Saved data could not be read; autosave paused. Export a backup.",
                  )
                : saveStatus}{" "}
              <span className="mono">UTF-8</span>
            </span>
          </div>
        </main>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(v) => {
          if (!v) {
            setDialog(null);
            setImported(null);
          }
        }}
      >
        <DialogContent className="import-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog === "export"
                ? t("导出 Skill", "Export Skill")
                : t("导入 Skill", "Import Skill")}
            </DialogTitle>
            <DialogDescription>
              {dialog === "export"
                ? t(
                    "导出可阅读、可解析的完整包。平台格式转换不执行任何工具。",
                    "Export a readable, parseable package. Platform adapters never execute tools.",
                  )
                : t(
                    "支持 SKILL.md、skill.json、文件夹或 ZIP。导入内容会先进行检查。",
                    "Import SKILL.md, skill.json, folders or ZIP archives. Review findings before saving.",
                  )}
            </DialogDescription>
          </DialogHeader>
          {dialog === "export" ? (
            <div className="export-options">
              <Pick
                label="Export platform"
                value={target}
                onChange={setTarget}
                items={adapters.map((a) => ({
                  value: a.id,
                  label: a.label + (a.experimental ? " · Experimental" : ""),
                }))}
              />
              <button className="primary" onClick={() => exportSkill("zip")}>
                <Package size={16} />
                {t("下载完整 ZIP 包", "Download full ZIP package")}
              </button>
              <div className="actions">
                <button className="secondary" onClick={() => exportSkill("md")}>
                  SKILL.md
                </button>
                <button
                  className="secondary"
                  onClick={() => exportSkill("json")}
                >
                  skill.json
                </button>
                <button
                  className="secondary"
                  onClick={() => exportSkill("readme")}
                >
                  README.md
                </button>
              </div>
              {dk && skill && (
                <>
                  <button
                    className="secondary"
                    data-act="install-skill"
                    onClick={() =>
                      setInstallReq({
                        title: skill.displayName,
                        name: skill.name,
                        files: packageFor(skill),
                        skillId: skill.id,
                      })
                    }
                  >
                    <HardDrive size={15} />
                    {t("安装到本机 Agent…", "Install to a local agent…")}
                  </button>
                  <p className="small muted">
                    {t(
                      "写入所选 Agent 的技能文件夹（SKILL.md、skill.json 等）。",
                      "Writes into the selected agent's skill folder (SKILL.md, skill.json, …).",
                    )}
                  </p>
                </>
              )}
              <pre className="package-tree">
                SKILL.md
                <br />
                skill.json
                <br />
                README.md
                <br />
                examples/examples.json
                <br />
                tests/cases.json
                <br />
                assets/
              </pre>
            </div>
          ) : (
            <>
              <input
                ref={uploader}
                hidden
                type="file"
                multiple
                accept=".md,.json,.zip"
                onChange={(e) => read(e.target.files)}
              />
              <input
                ref={folder}
                hidden
                type="file"
                multiple
                {...{ webkitdirectory: "" }}
                onChange={(e) => read(e.target.files)}
              />
              <button
                disabled={busy}
                className="upload-zone"
                onClick={() => uploader.current?.click()}
              >
                <Upload size={25} />
                <strong>{t("选择文件或 ZIP", "Choose files or ZIP")}</strong>
                <span className="muted small">
                  ZIP ≤ 5 MB · expanded ≤ 10 MB · 100 files
                </span>
              </button>
              <button
                disabled={busy}
                className="secondary"
                onClick={() => folder.current?.click()}
              >
                {t("选择 Skill 文件夹", "Choose skill folder")}
              </button>
              <label>
                GitHub file URL
                <input
                  placeholder="https://github.com/owner/repo/blob/main/SKILL.md"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !url}
                className="secondary"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const s = await importGitHub(url);
                    setImported([{ ...s, status: "Local" }]);
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Import failed",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("从公开 GitHub 文件导入", "Import public GitHub file")}
              </button>
              {imported && (
                <div className="import-review">
                  <p>
                    {imported.length} {t("个 Skill 待审阅", "skills to review")}
                  </p>
                  <Inspector skill={imported[0]} lang={lang} />
                  {detectSecrets(JSON.stringify(imported)).length > 0 ? (
                    <button
                      className="secondary"
                      onClick={() =>
                        setImported(
                          JSON.parse(redactSecrets(JSON.stringify(imported))),
                        )
                      }
                    >
                      {t("遮盖敏感信息", "Redact secrets")}
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => {
                        setSkills((all) => [...imported, ...all]);
                        open(imported[0]);
                        setDialog(null);
                        setImported(null);
                        toast.success(t("导入完成", "Import complete"));
                      }}
                    >
                      {t("确认导入", "Save imported skills")}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {dk && (
        <InstallDialog
          lang={lang}
          request={installReq}
          scan={scan}
          installs={installs}
          run={(rootId, overwrite) => {
            if (!dk || !installReq)
              return Promise.reject(new Error("No installation in progress"));
            return dk.install({
              rootId,
              name: installReq.name,
              source: installReq.source,
              files: installReq.files,
              overwrite,
              skillId: installReq.skillId,
            });
          }}
          onClose={() => setInstallReq(null)}
          onDone={() => {
            const id = installReq?.skillId;
            setInstallReq(null);
            void loadInstalls().then(() => refreshScan());
            if (id)
              setSkills((all) =>
                all.map((s) =>
                  s.id === id ? { ...s, status: "Installed" } : s,
                ),
              );
          }}
        />
      )}
      <Toaster
        richColors
        position="bottom-right"
        theme={light ? "light" : "dark"}
      />
    </SidebarProvider>
  );
}
