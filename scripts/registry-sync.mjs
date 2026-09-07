import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const skills = readdirSync("registry/skills")
  .filter((n) => !n.startsWith("."))
  .map((n) =>
    JSON.parse(readFileSync(`registry/skills/${n}/skill.json`, "utf8")),
  )
  .sort(
    (a, b) =>
      (a.metadata.curatedOrder ?? 999) - (b.metadata.curatedOrder ?? 999),
  );
writeFileSync("registry/registry.json", JSON.stringify(skills, null, 2) + "\n");
console.log(
  `Synced ${skills.length} registry skills. Run npm test to validate.`,
);
