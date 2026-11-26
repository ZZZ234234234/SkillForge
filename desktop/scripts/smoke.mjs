// 自动化验证入口：造一个隔离的“用户主目录”（含几个技能文件夹），
// 启动 Electron 跑完整流程，输出报告与截图到 desktop/smoke/。
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "..");
const require = createRequire(import.meta.url);

const outDir = path.join(app, "smoke");
const home = path.join(outDir, "home");
const out = path.join(outDir, "report.json");
if (!fs.existsSync(path.join(app, "dist", "index.html"))) {
  console.error("desktop/dist not found — run `npm run build:ui` first");
  process.exit(2);
}
fs.rmSync(home, { force: true, recursive: true });

const md = (name, description) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nInstructions for ${name}.\n`;
const put = (rel, text) => {
  const f = path.join(home, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
};

put(".claude/skills/alpha-notes/SKILL.md", md("alpha-notes", "Original description"));
put(".claude/skills/alpha-notes/notes.txt", "helper file\n");
put(".claude/skills/broken/README.md", "not a skill\n");
put(".config/opencode/skills/flat-tool.md", md("flat-tool", "A flat skill file"));
put(".config/opencode/skills/group/inner-skill/SKILL.md", md("inner-skill", "Nested one level"));
put(".cursor/skills/alpha-notes/SKILL.md", md("alpha-notes", "existing skill"));
put(".cursor/skills/alpha-notes/mine.txt", "keep me");
// 不在内置清单里的 Agent：按“<文件夹>/skills/<技能>/SKILL.md”的约定被自动发现
put(".smokeagent/skills/found-skill/SKILL.md", md("found-skill", "Lives in a folder nobody listed"));

const env = { ...process.env, SKILLFORGE_DEV_URL: "" };
delete env.CODEX_HOME; // 否则 Codex 目录会指向真实的 CODEX_HOME

// 设置 SKILLFORGE_EXE 指向打包后的程序，即可验证打包产物而不是源码
const exe = process.env.SKILLFORGE_EXE || require("electron");
const args = exe === require("electron") ? [app] : [];

const child = spawn(exe, [...args, `--smoke=${out}`, `--home=${home}`], {
  stdio: "inherit",
  env,
});
const timer = setTimeout(() => {
  console.error("Smoke run timed out");
  child.kill();
  process.exit(1);
}, 180_000);
child.on("exit", (code) => {
  clearTimeout(timer);
  if (!fs.existsSync(out)) {
    console.error("No report written");
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(out, "utf8"));
  for (const c of report.checks)
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : "  — " + c.detail}`);
  console.log(`\n${report.checks.filter((c) => c.ok).length}/${report.checks.length} checks passed`);
  console.log(`Report: ${out}`);
  process.exit(report.ok && code === 0 ? 0 : 1);
});
