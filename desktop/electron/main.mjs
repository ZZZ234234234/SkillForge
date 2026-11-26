import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  shell,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { builtinRoots } from "../core/agents.mjs";
import { scan, readLocalFiles } from "../core/scan.mjs";
import { planInstall, applyInstall, removeInstall } from "../core/install.mjs";
import { watchPaths } from "../core/watch.mjs";
import { openStore } from "../core/store.mjs";
import { containsPath, samePath } from "../core/paths.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, "..", "dist");
const APP_ORIGIN = "app://skillforge";
const DEV_URL = process.env.SKILLFORGE_DEV_URL || "";
/** 存档名：字母、数字、连字符、下划线（应用自己的键形如 skillforge-local-v1） */
const KEY_RE = /^[a-z0-9_-]{1,64}$/i;
const MAX_DOC = 64 * 1024 * 1024;

const opt = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : "";
};

/** 自动化验证模式：界面照常加载，由脚本驱动并输出报告，不触碰真实用户数据。 */
const smokeOut = opt("smoke");
/** 仅供测试：把“用户主目录”指到别处。 */
const homeOverride = opt("home");
/** 仅供验证：对着真实目录扫描一次、截图后退出，不执行任何安装。 */
const snapshotOut = opt("snapshot");
/** 开发模式：把应用数据指到别处，避免和正式版共用技能库。 */
const userDataOverride = opt("user-data");

app.setName("SkillForge");
if (userDataOverride) app.setPath("userData", path.resolve(userDataOverride));
if (snapshotOut)
  app.setPath("userData", path.join(os.tmpdir(), "skillforge-snapshot-" + process.pid));
if (smokeOut) {
  // 验证模式每次都从空的技能库开始；这个目录只存放验证数据
  const dir = path.join(path.dirname(path.resolve(smokeOut)), "smoke-user-data");
  fs.rmSync(dir, { force: true, recursive: true });
  app.setPath("userData", dir);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let win = null;
let store = null;
let lastSig = null;
let scanning = null;

const home = () => (homeOverride ? path.resolve(homeOverride) : app.getPath("home"));
const fsp = fs.promises;

function allRoots() {
  const custom = store
    .get()
    .customRoots.map((r) => ({
      id: r.id,
      agentId: r.id,
      label: r.label,
      readers: [],
      doc: "",
      reserved: [],
      path: r.path,
      builtin: false,
    }));
  return [...builtinRoots(home(), process.env), ...custom];
}

function insideAnyRoot(p) {
  return (
    typeof p === "string" &&
    path.isAbsolute(p) &&
    allRoots().some((r) => containsPath(r.path, p))
  );
}

/** 扫描所有技能目录；结果与上次不同时才通知界面。 */
function runScan() {
  if (scanning) return scanning;
  scanning = (async () => {
    const roots = allRoots();
    const meta = Object.fromEntries(roots.map((r) => [r.id, r]));
    const result = await scan(roots);
    result.roots = result.roots.map((r) => ({ ...meta[r.id], ...r }));
    result.home = home();
    const sig =JSON.stringify([result.roots.map((r) => [r.id, r.exists, r.error, r.count]), result.items, result.problems]);
    const changed = sig !== lastSig;
    lastSig = sig;
    if (changed && win && !win.isDestroyed())
      win.webContents.send("scan:changed", result);
    return { result, changed };
  })().finally(() => {
    scanning = null;
  });
  return scanning;
}

/**
 * 被覆盖的旧文件移入回收站。回收站不可用时挪到应用数据目录下的 backups，
 * 任何情况下都不直接删除用户已有的文件。
 */
async function moveToTrash(p) {
  if (smokeOut) return fsp.rm(p, { force: true, recursive: true });
  try {
    await shell.trashItem(p);
    return;
  } catch {}
  const dir = path.join(app.getPath("userData"), "backups", String(Date.now()));
  await fsp.mkdir(dir, { recursive: true });
  await fsp.rename(
    p,
    path.join(dir, crypto.randomUUID().slice(0, 6) + "-" + path.basename(p)),
  );
}

const ok = (data) => ({ ok: true, data });
const fail = (e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const isStr = (v, max = 4096) => typeof v === "string" && v.length > 0 && v.length <= max;

function trusted(event) {
  const url = event.senderFrame?.url ?? "";
  return url.startsWith(APP_ORIGIN + "/") || Boolean(DEV_URL) && url.startsWith(DEV_URL);
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      if (!trusted(event)) throw new Error("Untrusted sender");
      return ok(await fn(payload && typeof payload === "object" ? payload : {}));
    } catch (e) {
      return fail(e);
    }
  });
}

function openExternalSafe(url) {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
}

function registerIpc() {
  handle("env", () => ({
    platform: process.platform,
    home: home(),
    version: app.getVersion(),
    userData: app.getPath("userData"),
    electron: process.versions.electron,
  }));
  handle("roots", () => allRoots().map((r) => ({ ...r, exists: fs.existsSync(r.path) })));
  handle("roots:add", async () => {
    const r = await dialog.showOpenDialog(win, {
      title: "选择技能文件夹",
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = path.resolve(r.filePaths[0]);
    if (allRoots().some((x) => samePath(x.path, p)))
      throw new Error("这个文件夹已经在扫描列表里了");
    const rec = {
      id: "custom:" + crypto.randomUUID().slice(0, 8),
      path: p,
      label: path.basename(p),
      addedAt: Date.now(),
    };
    store.get().customRoots.push(rec);
    store.save();
    await runScan();
    return rec;
  });
  handle("roots:remove", ({ id }) => {
    if (!isStr(id) || !id.startsWith("custom:")) throw new Error("内置目录不能移除");
    const before = store.get().customRoots.length;
    store.get().customRoots = store.get().customRoots.filter((r) => r.id !== id);
    if (store.get().customRoots.length === before) throw new Error("没有找到这个文件夹");
    store.save();
    void runScan();
    return true;
  });
  handle("scan", async () => (await runScan()).result);
  handle("read", ({ paths }) => {
    if (!Array.isArray(paths) || paths.length > 2000)
      throw new Error("一次最多读取 2000 个文件");
    return readLocalFiles(paths.slice(0, 2000), allRoots());
  });
  handle("installs", () => store.get().installs);
  handle("install", async (input) => {
    const { rootId, name, source, files, overwrite, skillId } = input;
    if (!isStr(rootId, 200)) throw new Error("缺少安装目录");
    if (source !== undefined && source !== null && !insideAnyRoot(source))
      throw new Error("只能复制技能目录里的技能");
    if (files !== undefined && (typeof files !== "object" || files === null || Array.isArray(files)))
      throw new Error("文件列表格式不正确");
    const root = allRoots().find((r) => r.id === rootId);
    if (!root) throw new Error("未知的安装目录");
    const plan = await planInstall({
      rootPath: root.path,
      name,
      source: source || undefined,
      files,
      reserved: root.reserved ?? [],
    });
    if (plan.conflicts.length && !overwrite)
      return { status: "exists", dir: plan.dir, conflicts: plan.conflicts };
    const applied = await applyInstall(plan, { remove: moveToTrash });
    let sourceSig = null;
    if (source) {
      const main = path.join(source, "SKILL.md");
      const other = path.join(source, "skill.json");
      const st = (await fsp.stat(main).catch(() => null)) ?? (await fsp.stat(other).catch(() => null));
      if (st) sourceSig = `${st.size}:${Math.floor(st.mtimeMs)}`;
    }
    store.get().installs[plan.dir] = {
      dir: plan.dir,
      rootId,
      name,
      skillId: isStr(skillId, 200) ? skillId : null,
      source: source || null,
      sourceSig,
      created: applied.created,
      files: applied.files,
      at: Date.now(),
    };
    store.save();
    setTimeout(() => void runScan().catch(() => {}), 150);
    return { status: "ok", ...applied };
  });
  handle("uninstall", async ({ dir }) => {
    if (!isStr(dir) || !insideAnyRoot(dir)) throw new Error("只能卸载技能目录里的技能");
    const record = store.get().installs[dir];
    if (!record) throw new Error("没有这次安装的记录");
    const r = await removeInstall(record, { remove: moveToTrash });
    delete store.get().installs[dir];
    store.save();
    setTimeout(() => void runScan().catch(() => {}), 150);
    return r;
  });
  const checked = ({ path: p }) => {
    if (!insideAnyRoot(p)) throw new Error("只能操作技能目录里的文件");
    const st = fs.statSync(p, { throwIfNoEntry: false });
    if (!st) throw new Error("路径不存在：" + p);
    return { p, st };
  };
  handle("show", (input) => {
    const { p, st } = checked(input);
    if (st.isDirectory()) void shell.openPath(p);
    else shell.showItemInFolder(p);
    return true;
  });
  handle("open", async (input) => {
    const { p, st } = checked(input);
    if (!st.isFile()) throw new Error("不是文件");
    const err = await shell.openPath(p);
    if (err) throw new Error(err);
    return true;
  });
  handle("open-external", ({ url }) => {
    if (!isStr(url, 2000) || !/^https?:\/\//i.test(url)) throw new Error("只允许打开网页链接");
    openExternalSafe(url);
    return true;
  });
  handle("storage:read", ({ key }) => {
    if (!isStr(key, 64) || !KEY_RE.test(key)) throw new Error("存档名不合法");
    return store.readDoc(`library-${key}.json`);
  });
  handle("storage:write", ({ key, value }) => {
    if (!isStr(key, 64) || !KEY_RE.test(key)) throw new Error("存档名不合法");
    if (!value || typeof value !== "object") throw new Error("存档内容不合法");
    if (Buffer.byteLength(JSON.stringify(value)) > MAX_DOC) throw new Error("技能库超过 64 MB");
    store.writeDoc(`library-${key}.json`, value);
    return true;
  });
}

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

async function serve(request) {
  const url = new URL(request.url);
  if (url.host !== "skillforge") return new Response("Not found", { status: 404 });
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.join(DIST, rel);
  let target = file;
  try {
    if (!containsPath(DIST, file) || !(await fsp.stat(file)).isFile()) throw 0;
  } catch {
    target = path.join(DIST, "index.html"); // 单页应用：其余路径回首页
  }
  const response = await net.fetch(pathToFileURL(target).href);
  const headers = new Headers(response.headers);
  const type = MIME[path.extname(target).toLowerCase()];
  if (type) headers.set("content-type", type);
  return new Response(response.body, { status: response.status, headers });
}

function createWindow() {
  const icon = path.join(here, "..", "build", "icon.png");
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: !smokeOut && !snapshotOut,
    backgroundColor: "#0a0a0a",
    title: "SkillForge",
    autoHideMenuBar: true,
    ...(fs.existsSync(icon) ? { icon } : {}),
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 隐藏窗口也要持续渲染，否则截图拿到的是上一帧
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_ORIGIN + "/") && !(DEV_URL && url.startsWith(DEV_URL)))
      event.preventDefault();
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadURL(APP_ORIGIN + "/");
  win.on("closed", () => {
    win = null;
  });
}

if (gotTheLock) {
  app.whenReady().then(async () => {
    if (!DEV_URL) protocol.handle("app", serve);
    store = openStore(path.join(app.getPath("userData"), "settings.json"));
    registerIpc();
    createWindow();
    watchPaths(
      () => [...new Set(allRoots().map((r) => r.path).filter((p) => fs.existsSync(p)))],
      () => void runScan().catch(() => {}),
    );
    await runScan().catch(() => {});
    if (smokeOut) {
      const { runSmoke } = await import("./smoke.mjs");
      await runSmoke({ win: () => win, out: path.resolve(smokeOut), home: home() });
    } else if (snapshotOut) {
      const { runSnapshot } = await import("./smoke.mjs");
      await runSnapshot({ win: () => win, out: path.resolve(snapshotOut) });
    }
  });
  app.on("window-all-closed", () => app.quit());
}
