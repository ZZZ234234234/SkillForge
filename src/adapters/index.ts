import type { Skill } from "../types/skill";
import { skillMarkdown, skillReadme } from "../features/skills/parser";
export interface SkillAdapter {
  id: string;
  label: string;
  experimental: boolean;
  path: (s: Skill) => string;
}
export const adapters: SkillAdapter[] = [
  { id: "generic", label: "Generic", experimental: false, path: (s) => s.name },
  {
    id: "codex",
    label: "Codex",
    experimental: false,
    path: (s) => `.agents/skills/${s.name}`,
  },
  {
    id: "claude",
    label: "Claude Code",
    experimental: false,
    path: (s) => `.claude/skills/${s.name}`,
  },
  {
    id: "sdk",
    label: "OpenAI Agents SDK",
    experimental: true,
    path: (s) => s.name,
  },
  {
    id: "mcp",
    label: "MCP-based Agents",
    experimental: true,
    path: (s) => s.name,
  },
];
export function packageFiles(
  s: Skill,
  adapter = "generic",
): Record<string, string> {
  const a = adapters.find((x) => x.id === adapter);
  if (!a) throw new Error("Unknown adapter");
  const root = a.path(s);
  return Object.fromEntries(
    Object.entries({
      "SKILL.md": skillMarkdown(s),
      "skill.json": JSON.stringify(s, null, 2),
      "README.md":
        skillReadme(s) +
        (a.experimental
          ? "\nExperimental: this is an instruction bundle, not an official SDK configuration or MCP server.\n"
          : ""),
      "examples/examples.json": JSON.stringify(s.examples, null, 2),
      "tests/cases.json": JSON.stringify(s.tests, null, 2),
      "assets/.gitkeep": "",
      LICENSE: `Skill license identifier: ${s.license}\nAuthor: ${s.author}\nReview the applicable license terms before redistribution.\n`,
    }).map(([k, v]) => [`${root}/${k}`, v]),
  );
}
