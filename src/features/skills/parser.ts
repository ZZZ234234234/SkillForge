import { parse as parseYaml } from "yaml";
import type { Skill } from "../../types/skill";
import { blankSkill, skillSchema } from "./schema";
export function parseSkill(text: string, filename = "SKILL.md"): Skill {
  if (text.length > 2_000_000) throw new Error("File exceeds 2 MB limit");
  if (filename.endsWith(".json") || text.trim().startsWith("{"))
    return skillSchema.parse(JSON.parse(text));
  const s = blankSkill();
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  let body = text;
  if (match) {
    const meta = parseYaml(match[1], { maxAliasCount: 20 }) as Record<
      string,
      unknown
    >;
    if (!meta || typeof meta !== "object")
      throw new Error("Invalid frontmatter");
    if (typeof meta.name === "string") {
      s.name = meta.name;
      s.displayName = meta.name
        .split("-")
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(" ");
    }
    if (typeof meta.description === "string") s.description = meta.description;
    if (typeof meta.license === "string") s.license = meta.license;
    s.metadata = { importedFrontmatter: meta };
    body = text.slice(match[0].length);
  }
  const sections: Record<string, string> = {};
  const re = /^## (.+)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm;
  for (const m of body.matchAll(re))
    sections[m[1].trim().toLowerCase()] = m[2].trim();
  const list = (v: string | undefined) =>
    (v ?? "")
      .split("\n")
      .map((x) => x.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
      .filter(Boolean);
  s.role = sections.role ?? "";
  s.goals = list(sections.goals);
  s.instructions = sections.instructions ?? body.trim();
  s.workflow = list(sections.workflow);
  s.constraints = list(sections.constraints);
  s.inputFormat = sections["input format"] ?? "";
  s.outputFormat = sections["output format"] ?? "";
  s.errorHandling = sections["error handling"] ?? "";
  if (sections.tools) {
    try {
      s.tools = JSON.parse(sections.tools.replace(/^```json\n|\n```$/g, ""));
    } catch {
      s.metadata.importWarning = "Tools preserved as text; review permissions";
    }
  }
  for (const key of ["examples", "tests"] as const) {
    if (sections[key]) {
      try {
        s[key] = JSON.parse(sections[key].replace(/^```json\n|\n```$/g, ""));
      } catch {
        s.metadata[`${key}Text`] = sections[key];
      }
    }
  }
  return skillSchema.parse(s);
}
export function skillMarkdown(s: Skill) {
  const l = (a: string[]) => a.map((x, i) => `${i + 1}. ${x}`).join("\n");
  const j = (v: unknown) => "```json\n" + JSON.stringify(v, null, 2) + "\n```";
  return `---\nname: ${JSON.stringify(s.name)}\ndescription: ${JSON.stringify(s.description)}\nlicense: ${JSON.stringify(s.license)}\n---\n\n# ${s.displayName}\n\n## Role\n${s.role}\n\n## Goals\n${l(s.goals)}\n\n## Instructions\n${s.instructions}\n\n## Workflow\n${l(s.workflow)}\n\n## Tools\n${j(s.tools)}\n\n## Constraints\n${l(s.constraints)}\n\n## Input Format\n${s.inputFormat}\n\n## Output Format\n${s.outputFormat}\n\n## Error Handling\n${s.errorHandling}\n\n## Examples\n${j(s.examples)}\n\n## Tests\n${j(s.tests)}\n`;
}
export function skillReadme(s: Skill) {
  return `# ${s.displayName}\n\n${s.description}\n\n- Author: ${s.author}\n- Version: ${s.version}\n- License: ${s.license}\n- Compatibility targets: ${s.compatibility.join(", ")}\n\n## Usage\n\nRead SKILL.md before use. Review tool permissions in skill.json. No tools are executed by SkillForge.\n\n## Inputs\n${s.inputFormat}\n\n## Outputs\n${s.outputFormat}\n\n## Testing\n\nImport skill.json into SkillForge and run Rule Evaluation. Rule checks inspect instructions, not real agent execution. Tests are in tests/cases.json.\n\n## Security\n\nReview every imported skill. Never embed credentials. Platform support depends on the receiving agent.\n`;
}
