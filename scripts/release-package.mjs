import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { zipSync } from "fflate";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = `v${pkg.version}`;
if (
  process.env.GITHUB_REF_TYPE === "tag" &&
  process.env.GITHUB_REF_NAME !== version
)
  throw new Error("Tag must match package.json version");
const source = {};
const names = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
for (const name of names) {
  if (
    name.startsWith("release/") ||
    name.startsWith(".git/") ||
    name.endsWith(".tsbuildinfo")
  )
    continue;
  if (name.startsWith(".env") && name !== ".env.example")
    throw new Error("Unexpected environment file");
  const content =
    name === ".openai/hosting.json"
      ? Buffer.from(JSON.stringify({ d1: null, r2: null }, null, 2) + "\n")
      : readFileSync(name);
  source[`SkillForge-${version}/${name}`] = content;
}
// Restored artwork is deterministic and may be generated from tracked chunks.
for (const name of ["docs/social-preview.png", "public/og.png"]) {
  source[`SkillForge-${version}/${name}`] = readFileSync(name);
}
const built = {};
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else built[`SkillForge-${version}-web/${p}`] = readFileSync(p);
  }
}
walk("dist");
for (const name of ["LICENSE", "README.md", "docs/DEPLOY_DEMO.md"])
  built[`SkillForge-${version}-web/${name}`] = readFileSync(name);
const digest = [];
mkdirSync("release", { recursive: true });
for (const [suffix, files] of [
  ["source", source],
  ["web", built],
]) {
  const name = `SkillForge-${version}-${suffix}.zip`;
  const bytes = zipSync(files, {
    level: 6,
    mtime: new Date("2026-01-01T00:00:00Z"),
  });
  writeFileSync(`release/${name}`, bytes);
  digest.push(`${createHash("sha256").update(bytes).digest("hex")}  ${name}`);
  console.log(`${name}: ${bytes.length} bytes`);
}
writeFileSync("release/SHA256SUMS.txt", digest.join("\n") + "\n");
console.log(
  "SHA256SUMS.txt generated. This does not create a GitHub Release or attestation.",
);
