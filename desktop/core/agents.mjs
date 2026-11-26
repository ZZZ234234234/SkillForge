import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 除 Codex 外，还会读取 ~/.agents/skills 的 Agent（各家文档都写明支持这个通用目录）。 */
const AGENTS_SKILLS_READERS = [
  "GitHub Copilot",
  "OpenCode",
  "Gemini CLI",
  "Windsurf",
  "Goose",
  "ZCode",
  "Qwen Code",
  "Roo Code",
  "Amp",
  "Zed",
  "Kimi Code CLI",
];

/**
 * 内置的 Agent 技能目录。只收录在官方文档里核对过的位置（doc 为出处）；
 * 其余 Agent 由 discover.mjs 按同一约定自动发现，也可以在界面里“添加文件夹”。
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
    readers: AGENTS_SKILLS_READERS,
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
  {
    id: "gemini",
    name: "Gemini CLI",
    dir: ".gemini/skills",
    readers: [],
    doc: "https://geminicli.com/docs/cli/skills/",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    dir: ".gemini/config/skills",
    readers: [],
    doc: "https://antigravity.google/docs/skills",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    dir: ".codeium/windsurf/skills",
    readers: [],
    doc: "https://docs.windsurf.com/windsurf/cascade/skills",
  },
  {
    id: "kiro",
    name: "Kiro",
    dir: ".kiro/skills",
    readers: [],
    doc: "https://kiro.dev/docs/cli/skills/",
  },
  {
    id: "trae",
    name: "Trae",
    dir: ".trae/skills",
    readers: [],
    doc: "https://docs.trae.ai/ide/skills",
  },
  {
    id: "trae-cli",
    name: "Trae CLI",
    dir: ".traecli/skills",
    readers: [],
    doc: "https://www.volcengine.com/docs/86677/2272059",
  },
  {
    id: "qoder",
    name: "Qoder CLI",
    dir: ".qoder/skills",
    readers: [],
    doc: "https://docs.qoder.com/cli/Skills",
  },
  {
    id: "qoderwork",
    name: "QoderWork",
    dir: ".qoderwork/skills",
    readers: [],
    doc: "https://docs.qoder.com/qoderwork/skills",
  },
  {
    id: "codebuddy",
    name: "CodeBuddy Code",
    dir: ".codebuddy/skills",
    readers: [],
    doc: "https://www.codebuddy.ai/docs/zh/cli/skills",
  },
  {
    id: "zcode",
    name: "ZCode",
    dir: ".zcode/skills",
    readers: [],
    doc: "https://zcode.z.ai/en/docs/skill",
  },
  {
    id: "kimi",
    name: "Kimi Code CLI",
    dir: ".config/agents/skills",
    readers: ["Amp"],
    doc: "https://moonshotai.github.io/kimi-cli/zh/customization/skills.html",
  },
  {
    id: "amp",
    name: "Amp",
    dir: ".config/amp/skills",
    readers: [],
    doc: "https://ampcode.com/docs/markdown/cli/settings",
  },
  {
    id: "iflow",
    name: "iFlow CLI",
    dir: ".iflow/skills",
    readers: [],
    doc: "https://platform.iflow.cn/cli/examples/skill",
  },
  {
    id: "qwen",
    name: "Qwen Code",
    dir: ".qwen/skills",
    readers: [],
    doc: "https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/",
  },
  {
    id: "cline",
    name: "Cline",
    dir: ".cline/skills",
    readers: [],
    doc: "https://docs.cline.bot/customization/skills",
  },
  {
    id: "roo",
    name: "Roo Code",
    dir: ".roo/skills",
    readers: [],
    doc: "https://roocodeinc.github.io/Roo-Code/features/skills/",
  },
  {
    id: "openhands",
    name: "OpenHands",
    dir: ".openhands/skills",
    readers: [],
    doc: "https://docs.openhands.dev/cookbook/upload-skills",
  },
  {
    id: "devin",
    name: "Devin",
    dir: ".config/devin/skills",
    readers: [],
    doc: "https://cli.devinenterprise.com/docs/extensibility/skills/overview",
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
