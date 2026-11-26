// 构建桌面端界面：复用仓库根目录的 Vite 与依赖，输出到 desktop/dist。
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const r = spawnSync(
  process.execPath,
  [
    path.join(repo, "node_modules", "vite", "bin", "vite.js"),
    "build",
    "--config",
    path.join(here, "..", "vite.config.ts"),
  ],
  { cwd: repo, stdio: "inherit" },
);
process.exit(r.status ?? 1);
