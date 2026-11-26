import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 内置的 Agent 技能目录。只收录在官方文档里核对过的位置；
 * 其余 Agent 可以在界面里“添加文件夹”后一并扫描。
 * readers：除了该目录的主人之外，还有哪些 Agent 会读取它。
 */
export const BUILTIN_AGENTS = [
  {
    id: "claude",
    name: "Claude Code",
    dir: ".claude/skills",
    readers: ["Cursor", "OpenCode"],
    doc: "https://code.claude.com/docs/en/skills",
    reserved: ["synced", "anthropic-skills"],
  },
  {
    id: "cursor",
    name: "Cursor",
    dir: ".cursor/skills",
    readers: [],
    doc: "https://cursor.com/docs/context/skills",
  },
  {
    id: "codex",
    name: "Codex",
    dir: ".agents/skills",
    readers: ["GitHub Copilot", "OpenCode"],
    doc: "https://developers.openai.com/codex/skills",
  },
  {
    id: "codex-home",
    name: "Codex（.codex 目录）",
    dir: ".codex/skills",
    readers: ["Cursor"],
    doc: "https://cursor.com/docs/context/skills",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    dir: ".copilot/skills",
    readers: [],
    doc: "https://docs.github.com/en/copilot/concepts/agents/about-agent-skills",
  },
  {
    id: "opencode",
    name: "OpenCode",
    dir: ".config/opencode/skills",
    readers: [],
    doc: "https://opencode.ai/docs/skills/",
  },
  {
    id: "doubao",
    name: "豆包",
    dir: "Doubao/skills",
    readers: [],
    doc: "",
  },
];

/**
 * 豆包 Agent 模式的技能目录：内置技能与用户自己的技能各一个。
 * 位置来自本机豆包运行时登记的技能根目录，没有公开文档；只有装了豆包 Agent 模式的电脑才有，
 * 所以目录不存在时不显示。
 */
const DOUBAO_WORKSPACE = [
  "Doubao",
  "User Data",
  "Default",
  ".doubao",
  "agent_mode",
  "workspace",
];
const DOUBAO_OPTIONAL = [
  { id: "doubao-builtin", name: "豆包（内置技能）", dir: ".skills" },
  { id: "doubao-user", name: "豆包（我的技能）", dir: ".user_skills" },
];

/** 生成内置目录列表。home 与 env 可注入，便于测试。 */
export function builtinRoots(home = os.homedir(), env = process.env) {
  const base = env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
  const workspace = path.join(base, ...DOUBAO_WORKSPACE);
  const optional = DOUBAO_OPTIONAL.filter((a) =>
    fs.existsSync(path.join(workspace, a.dir)),
  ).map((a) => ({
    id: a.id,
    name: a.name,
    dir: path.relative(home, path.join(workspace, a.dir)),
    readers: [],
    doc: "",
  }));
  return [...BUILTIN_AGENTS, ...optional].map((a) => {
    const dir =
      a.id === "codex-home" && env.CODEX_HOME
        ? path.join(env.CODEX_HOME, "skills")
        : path.join(home, a.dir);
    return {
      id: a.id,
      agentId: a.id,
      label: a.name,
      readers: a.readers,
      doc: a.doc,
      reserved: a.reserved ?? [],
      path: dir,
      builtin: true,
    };
  });
}
