// Run locally after installing and authenticating the official GitHub CLI.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("docs/github-metadata.json", "utf8"));
const run = (args) => execFileSync("gh", args, { stdio: "inherit" });
run(["auth", "status"]);
let exists = true;
try {
  execFileSync("gh", ["repo", "view", config.repository], { stdio: "ignore" });
} catch {
  exists = false;
}
if (!exists)
  run([
    "repo",
    "create",
    config.repository,
    "--public",
    "--description",
    config.description,
  ]);
run([
  "repo",
  "edit",
  config.repository,
  "--description",
  config.description,
  "--enable-issues",
  "--add-topic",
  config.topics.join(","),
]);
if (process.env.SKILLFORGE_PUBLIC_DEMO_URL || config.homepage)
  run([
    "repo",
    "edit",
    config.repository,
    "--homepage",
    process.env.SKILLFORGE_PUBLIC_DEMO_URL || config.homepage,
  ]);
console.log(
  "Repository metadata applied. Push reviewed source to the repository, then tag v0.1.0 to run the release workflow. Social Preview remains a manual GitHub setting.",
);
