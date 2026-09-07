// ZIP container adapter: bounded deflate import/export via fflate.
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { parseSkill } from "./parser";
import type { Skill } from "../../types/skill";
export function exportZip(files: Record<string, string>): Uint8Array {
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
    { level: 6 },
  );
}
export function safePath(path: string) {
  return (
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..") &&
    !/^[A-Za-z]:/.test(path)
  );
}
export function readZip(data: Uint8Array): Record<string, string> {
  if (data.length > 5_000_000) throw new Error("ZIP exceeds 5 MB");
  let total = 0;
  let count = 0;
  const files = unzipSync(data, {
    filter: (e) => {
      if (!safePath(e.name)) throw new Error("Unsafe ZIP path");
      total += e.originalSize;
      count++;
      if (total > 10_000_000 || count > 100 || e.originalSize > 2_000_000)
        throw new Error("ZIP expansion limit exceeded");
      return !e.name.endsWith("/");
    },
  });
  return Object.fromEntries(
    Object.entries(files).map(([k, v]) => [k, strFromU8(v)]),
  );
}
export function importFiles(files: Record<string, string>): Skill[] {
  for (const k of Object.keys(files))
    if (!safePath(k)) throw new Error("Unsafe import path");
  const json = Object.keys(files).filter((k) => /(^|\/)skill\.json$/i.test(k));
  const markdown = Object.keys(files).filter(
    (k) =>
      /(^|\/)SKILL\.md$/i.test(k) &&
      !json.some((j) => j.slice(0, -10) === k.slice(0, -8)),
  );
  const keys = [...json, ...markdown];
  if (!keys.length) {
    const lone = Object.keys(files).filter((k) => /\.(json|md)$/i.test(k));
    if (lone.length === 1) keys.push(lone[0]);
  }
  if (!keys.length) throw new Error("No SKILL.md or skill.json found");
  return keys.map((k) => ({
    ...parseSkill(files[k], k),
    id: crypto.randomUUID(),
    status: "Local",
    metadata: { ...parseSkill(files[k], k).metadata, imported: true },
  }));
}
export async function importGitHub(url: string) {
  const u = new URL(url);
  if (
    u.hostname !== "github.com" ||
    u.protocol !== "https:" ||
    u.username ||
    u.password
  )
    throw new Error("Use an HTTPS github.com file URL");
  const parts = u.pathname.split("/").filter(Boolean);
  if (
    parts.length < 5 ||
    parts[2] !== "blob" ||
    !/\.(md|json)$/.test(parts.at(-1) ?? "")
  )
    throw new Error("Use a GitHub blob URL pointing to SKILL.md or skill.json");
  const raw = `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts.slice(3).join("/")}`;
  const r = await fetch(raw, {
    signal: AbortSignal.timeout(15000),
    credentials: "omit",
    redirect: "error",
  });
  if (!r.ok) throw new Error(`GitHub fetch failed: ${r.status}`);
  const body = await r.text();
  return parseSkill(body, parts.at(-1));
}
