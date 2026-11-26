// 打包 Windows 安装包与便携版。国内网络可先设置：
//   ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
//   ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "..");
// 桌面包的版本必须与仓库版本一致：Release 的标签按仓库版本生成，安装包的文件名按桌面版本生成
const readVersion = (dir) =>
  JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
const rootVersion = readVersion(path.join(app, ".."));
const appVersion = readVersion(app);
if (rootVersion !== appVersion) {
  console.error(
    `Version mismatch: package.json is ${rootVersion}, desktop/package.json is ${appVersion}. Make them equal before packaging.`,
  );
  process.exit(1);
}
// electron-builder 会调用 powershell.exe 来枚举依赖；个别精简的 PATH 里没有它，这里补上系统目录
const psDir = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0");
const env = { ...process.env };
// Windows 上这个变量的键可能写作 Path 或 PATH
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "PATH";
if (
  process.platform === "win32" &&
  !(env[pathKey] ?? "").split(";").some((p) => p.toLowerCase() === psDir.toLowerCase())
)
  env[pathKey] = psDir + ";" + (env[pathKey] ?? "");
const run = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: app, stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run([path.join(here, "build-ui.mjs")]);
run([
  path.join(app, "node_modules", "electron-builder", "cli.js"),
  "--config",
  path.join(app, "electron-builder.yml"),
]);

// 打包后核对包内文件：主进程漏掉任何一个模块，程序启动时只会弹错误框
const asar = createRequire(import.meta.url)(
  path.join(app, "node_modules", "@electron", "asar"),
);
const archive = path.join(app, "release", "win-unpacked", "resources", "app.asar");
const packed = asar.listPackage(archive).map((p) => p.replace(/\\/g, "/"));
const needed = [
  "electron/main.mjs",
  "electron/preload.cjs",
  "electron/smoke.mjs",
  "core/agents.mjs",
  "core/discover.mjs",
  "core/install.mjs",
  "core/paths.mjs",
  "core/scan.mjs",
  "core/store.mjs",
  "core/watch.mjs",
  "dist/index.html",
];
const missing = needed.filter((f) => !packed.some((p) => p === "/content/" + f || p.endsWith("/" + f)));
if (missing.length) {
  console.error("Packaged app is missing: " + missing.join(", "));
  process.exit(1);
}
console.log(`Packaged ${packed.length} entries; all ${needed.length} required files are inside.`);
