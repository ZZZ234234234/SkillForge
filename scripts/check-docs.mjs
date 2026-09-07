import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
const files = [
  "README.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING_SKILLS.md",
  "SECURITY.md",
  "TRADEMARKS.md",
  "CHANGELOG.md",
  ...readdirSync("docs")
    .filter((x) => x.endsWith(".md"))
    .map((x) => "docs/" + x),
];
const failures = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const local = path.resolve(path.dirname(file), link.split("#")[0]);
    if (!existsSync(local)) failures.push(`${file}: ${link}`);
  }
}
for (const dir of [".github/workflows", ".github/ISSUE_TEMPLATE"])
  for (const file of readdirSync(dir)) {
    const d = parse(readFileSync(`${dir}/${file}`, "utf8"));
    if (!d?.name) failures.push(file + ": missing name");
    if (dir.endsWith("workflows") && (!d.on || !d.jobs))
      failures.push(file + ": missing trigger or jobs");
  }
for (const file of ["README.md", "SECURITY.md", "TRADEMARKS.md"])
  if (!readFileSync(file, "utf8").includes("2014546082@qq.com"))
    failures.push(file + ": missing author email");
if (failures.length) throw new Error(failures.join("\n"));
console.log(
  `Validated ${files.length} Markdown files, local links, author email and YAML workflow/template structure. Remote Actions execution is not implied.`,
);
