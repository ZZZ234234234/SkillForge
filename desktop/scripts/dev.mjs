// 开发模式：启动 Vite 开发服务器，再用 Electron 加载它（界面改动即时生效）。
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const app = path.resolve(here, "..");
const require = createRequire(import.meta.url);
const PORT = 7799;

const vite = spawn(
  process.execPath,
  [
    path.join(repo, "node_modules", "vite", "bin", "vite.js"),
    "--config",
    path.join(app, "vite.config.ts"),
  ],
  { cwd: repo, stdio: ["ignore", "inherit", "inherit"] },
);

const ready = new Promise((resolve, reject) => {
  const end = setTimeout(() => reject(new Error("Vite dev server did not start")), 60_000);
  const probe = () => {
    const s = net.connect(PORT, "127.0.0.1");
    s.on("connect", () => {
      s.end();
      clearTimeout(end);
      resolve();
    });
    s.on("error", () => setTimeout(probe, 300));
  };
  probe();
});

let electron = null;
const shutdown = () => {
  vite.kill();
  electron?.kill();
};
process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

try {
  await ready;
  electron = spawn(
    require("electron"),
    [app, `--user-data=${path.join(app, ".dev-data")}`],
    {
      stdio: "inherit",
      env: { ...process.env, SKILLFORGE_DEV_URL: `http://127.0.0.1:${PORT}` },
    },
  );
  electron.on("exit", () => {
    shutdown();
    process.exit(0);
  });
} catch (e) {
  console.error(e.message);
  shutdown();
  process.exit(1);
}
