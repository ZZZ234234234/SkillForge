import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { containsPath, isInside, samePath } from "../core/paths.mjs";
import { builtinRoots } from "../core/agents.mjs";
import { discoverRoots } from "../core/discover.mjs";
import { scan, readLocalFiles } from "../core/scan.mjs";
import {
  planInstall,
  applyInstall,
  removeInstall,
  pruneEmptyDirs,
  validRel,
} from "../core/install.mjs";
import { openStore } from "../core/store.mjs";
import { watchPaths } from "../core/watch.mjs";

const write = (p, text = "x") => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};
const skill = (dir, name = path.basename(dir), body = "Do the thing.") =>
  write(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Skill ${name}\n---\n\n## Instructions\n\n${body}\n`,
  );
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "skillforge-"));

test("paths: containment and traversal", () => {
  const home = path.resolve(os.tmpdir(), "home-a");
  assert.equal(isInside(home, path.join(home, "a", "b")), true);
  assert.equal(isInside(home, home), false);
  assert.equal(containsPath(home, home), true);
  assert.equal(containsPath(home, path.join(home, "..", "home-b")), false);
  assert.equal(containsPath(home, home + "-evil"), false);
  assert.equal(samePath(path.join(home, "A"), path.join(home, "a")), process.platform === "win32");
});

test("agents: builtin roots follow the documented folders", () => {
  const home = path.resolve(os.tmpdir(), "home-agents");
  const roots = builtinRoots(home, { CODEX_HOME: path.join(home, "cx") });
  const by = Object.fromEntries(roots.map((r) => [r.id, r.path]));
  assert.equal(by.claude, path.join(home, ".claude", "skills"));
  assert.equal(by.cursor, path.join(home, ".cursor", "skills"));
  assert.equal(by.codex, path.join(home, ".agents", "skills"));
  assert.equal(by["codex-home"], path.join(home, "cx", "skills"));
  assert.equal(by.copilot, path.join(home, ".copilot", "skills"));
  assert.equal(by.opencode, path.join(home, ".config", "opencode", "skills"));
  assert.deepEqual(roots.find((r) => r.id === "claude").reserved, ["synced", "anthropic-skills"]);
  // 豆包 Agent 工作区的目录只在存在时才列出
  assert.equal(roots.some((r) => r.id.startsWith("doubao-")), false);
});

test("agents: every additional agent folder matches its documentation and has a source", () => {
  const home = path.resolve(os.tmpdir(), "home-agents-more");
  const by = Object.fromEntries(
    builtinRoots(home, {}).map((r) => [r.id, r]),
  );
  const documented = {
    gemini: ".gemini/skills",
    antigravity: ".gemini/config/skills",
    windsurf: ".codeium/windsurf/skills",
    kiro: ".kiro/skills",
    trae: ".trae/skills",
    "trae-cli": ".traecli/skills",
    qoder: ".qoder/skills",
    qoderwork: ".qoderwork/skills",
    codebuddy: ".codebuddy/skills",
    zcode: ".zcode/skills",
    kimi: ".config/agents/skills",
    amp: ".config/amp/skills",
    iflow: ".iflow/skills",
    qwen: ".qwen/skills",
    cline: ".cline/skills",
    roo: ".roo/skills",
    openhands: ".openhands/skills",
    devin: ".config/devin/skills",
  };
  for (const [id, dir] of Object.entries(documented)) {
    assert.equal(by[id]?.path, path.join(home, ...dir.split("/")), id);
    assert.match(by[id].doc, /^https:\/\/\S+\.\w+/, id + " has a documentation link");
  }
  // ~/.agents/skills 是跨 Agent 的通用目录：读它的 Agent 都列在 readers 里
  const readers = by.codex.readers;
  for (const name of ["GitHub Copilot", "Gemini CLI", "Windsurf", "Goose", "ZCode", "Qwen Code"])
    assert.ok(readers.includes(name), name + " reads ~/.agents/skills");
  assert.equal(new Set(readers).size, readers.length);
  // id 与路径都不能重复
  const ids = Object.values(by).map((r) => r.id);
  const paths = Object.values(by).map((r) => r.path);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(paths).size, paths.length);
});

test("discover: finds unknown skills folders, skips known and unrelated ones", async () => {
  const home = tmp();
  skill(path.join(home, ".someagent", "skills", "helper"));
  skill(path.join(home, ".config", "newtool", "skills", "one"));
  // 分了组的目录（<组>/<技能>/SKILL.md）因为第一眼看不到 SKILL.md，不靠自动发现，用“添加文件夹”
  skill(path.join(home, ".grouped", "skills", "team", "grouped-one"));
  // 只有 skill.json 的也算
  write(path.join(home, ".jsononly", "skills", "a", "skill.json"), "{}");
  // 下面这些都不该被发现
  fs.mkdirSync(path.join(home, ".empty", "skills"), { recursive: true }); // 里面没有技能
  skill(path.join(home, "toodeep", "a", "b", "skills", "x")); // 超过两层
  skill(path.join(home, "node_modules", "pkg", "skills", "x")); // 跳过的目录
  skill(path.join(home, ".claude", "skills", "builtin-one")); // 已是内置目录
  skill(path.join(home, "notes", "SKILL.md")); // 不是 skills 目录

  const known = builtinRoots(home, {});
  const found = await discoverRoots(home, known);
  const rels = found
    .map((r) => path.relative(home, r.path).split(path.sep).join("/"))
    .sort();
  assert.deepEqual(rels, [".config/newtool/skills", ".jsononly/skills", ".someagent/skills"]);
  const some = found.find((r) => r.label === "someagent");
  assert.equal(some.found, true);
  assert.equal(some.builtin, true);
  assert.deepEqual(some.readers, []);
  assert.match(some.id, /^found-[0-9a-f]{8}$/);
  // 两层目录的名字用完整相对路径，不只剩最后一段
  assert.equal(found.find((r) => r.path.endsWith("newtool" + path.sep + "skills")).label, "config/newtool");
  // 同一路径再次发现，id 不变
  assert.equal((await discoverRoots(home, known)).find((r) => r.label === "someagent").id, some.id);
  // 发现到的目录能直接参与扫描
  const res = await scan([...known, ...found]);
  assert.deepEqual(
    res.items.filter((i) => i.rootId.startsWith("found-")).map((i) => i.dirName).sort(),
    ["a", "helper", "one"],
  );
});

test("discover: a custom folder on the same path is not listed twice", async () => {
  const home = tmp();
  skill(path.join(home, ".mine", "skills", "x"));
  const custom = { id: "custom:1", path: path.join(home, ".mine", "skills") };
  assert.deepEqual(await discoverRoots(home, [...builtinRoots(home, {}), custom]), []);
  // 与自定义目录只是部分重叠（自定义目录是其中一个技能）时也不重复
  const inner = { id: "custom:2", path: path.join(home, ".mine", "skills", "x") };
  assert.deepEqual(await discoverRoots(home, [inner]), []);
  assert.equal(home && (await discoverRoots("", [])).length, 0);
});

test("agents: Doubao workspace roots appear only when the folder exists", async () => {
  const home = path.resolve(os.tmpdir(), "home-doubao");
  const local = path.join(home, "AppData", "Local");
  const ws = path.join(local, "Doubao", "User Data", "Default", ".doubao", "agent_mode", "workspace");
  skill(path.join(ws, ".skills", "doubao-made"));
  const roots = builtinRoots(home, { LOCALAPPDATA: local });
  const by = Object.fromEntries(roots.map((r) => [r.id, r.path]));
  assert.equal(by["doubao-builtin"], path.join(ws, ".skills"));
  assert.equal("doubao-user" in by, false); // .user_skills 不存在
  assert.equal(roots.find((r) => r.id === "doubao-builtin").builtin, true);
  const res = await scan(roots);
  assert.deepEqual(
    res.items.filter((i) => i.rootId === "doubao-builtin").map((i) => i.dirName),
    ["doubao-made"],
  );
});

test("scan: finds skills, groups, flat files and problems", async () => {
  const home = tmp();
  skill(path.join(home, ".claude", "skills", "pdf-tools"));
  write(path.join(home, ".claude", "skills", "pdf-tools", "scripts", "run.sh"));
  write(path.join(home, ".claude", "skills", "pdf-tools", "references", "a.md"));
  fs.mkdirSync(path.join(home, ".claude", "skills", "not-a-skill"));
  skill(path.join(home, ".claude", "skills", "synced", "from-account"));
  skill(path.join(home, ".agents", "skills", "team", "release"));
  write(path.join(home, ".cursor", "skills", "review.md"), "---\nname: review\n---\nBody");
  write(path.join(home, ".cursor", "skills", "README.md"), "ignore me");
  write(path.join(home, ".codex", "skills", "json-only", "skill.json"), "{}");
  skill(path.join(home, ".copilot", "skills", "helper"));

  const roots = builtinRoots(home, {});
  const res = await scan([...roots, ...roots]);
  const names = res.items.map((i) => `${i.rootId}:${i.group ?? ""}/${i.dirName}`).sort();
  assert.deepEqual(names, [
    "claude:/pdf-tools",
    "claude:synced/from-account",
    "codex-home:/json-only",
    "codex:team/release",
    "copilot:/helper",
    "cursor:/review",
  ]);
  assert.equal(res.roots.find((r) => r.id === "opencode").exists, false);
  assert.deepEqual(
    res.problems.map((p) => path.relative(home, p.path).split(path.sep).join("/")),
    [".claude/skills/not-a-skill"],
  );
  const pdf = res.items.find((i) => i.dirName === "pdf-tools");
  assert.equal(pdf.files, 3);
  assert.equal(pdf.hasScripts, true);
  assert.deepEqual(pdf.extras.sort(), ["references/", "scripts/"]);
  assert.match(pdf.sig, /^\d+:\d+$/);
  const review = res.items.find((i) => i.dirName === "review");
  assert.equal(review.flat, true);
  assert.equal(review.dirName, "review");
  const jsonOnly = res.items.find((i) => i.dirName === "json-only");
  assert.equal(jsonOnly.skillMd, null);
  assert.ok(jsonOnly.skillJson);
});

test("scan: a folder that is itself a skill, and one that does not exist", async () => {
  const home = tmp();
  skill(path.join(home, "one-skill"));
  const single = await scan([{ id: "custom:one", path: path.join(home, "one-skill") }]);
  assert.equal(single.items.length, 1);
  assert.equal(single.items[0].self, true);
  assert.equal(single.items[0].dirName, "one-skill");
  const none = await scan([{ id: "custom:gone", path: path.join(home, "missing") }]);
  assert.equal(none.roots[0].exists, false);
  assert.equal(none.items.length, 0);
});

test("scan: reading is restricted to skill folders", async () => {
  const home = tmp();
  const dir = path.join(home, ".claude", "skills", "bom");
  write(path.join(dir, "SKILL.md"), "\uFEFF---\nname: bom\n---\nhi");
  const outside = path.join(home, "secret.txt");
  write(outside, "secret");
  const roots = builtinRoots(home, {});
  const [ok, bad, rel] = await readLocalFiles(
    [path.join(dir, "SKILL.md"), outside, "SKILL.md"],
    roots,
  );
  assert.equal(ok.text.startsWith("---"), true);
  assert.match(ok.sig, /^\d+:\d+$/);
  assert.equal(bad.error, "Outside skill folders");
  assert.equal(rel.error, "Invalid path");
});

test("install: copies a skill folder and never touches unrelated files", async () => {
  const home = tmp();
  const src = path.join(home, ".claude", "skills", "pdf-tools");
  skill(src);
  write(path.join(src, "scripts", "run.sh"), "echo hi");
  const target = path.join(home, ".cursor", "skills");
  write(path.join(target, "pdf-tools", "notes.txt"), "keep me");

  const plan = await planInstall({ rootPath: target, name: "pdf-tools", source: src });
  assert.equal(plan.dirExists, true);
  assert.deepEqual(plan.conflicts, []);
  const r = await applyInstall(plan);
  assert.equal(r.created, false);
  assert.equal(r.replaced, 0);
  assert.equal(fs.readFileSync(path.join(plan.dir, "SKILL.md"), "utf8"), fs.readFileSync(path.join(src, "SKILL.md"), "utf8"));
  assert.equal(fs.readFileSync(path.join(plan.dir, "scripts", "run.sh"), "utf8"), "echo hi");
  assert.equal(fs.readFileSync(path.join(plan.dir, "notes.txt"), "utf8"), "keep me");
});

test("install: reports conflicts, then replaces only those files", async () => {
  const home = tmp();
  const target = path.join(home, ".cursor", "skills");
  skill(path.join(target, "pdf-tools"), "pdf-tools", "old body");
  const files = { "SKILL.md": "---\nname: pdf-tools\n---\nnew body" };
  const plan = await planInstall({ rootPath: target, name: "pdf-tools", files });
  assert.deepEqual(plan.conflicts, ["SKILL.md"]);
  const trashed = [];
  await applyInstall(plan, { remove: async (p) => trashed.push(p) });
  assert.equal(trashed.length, 1);
  assert.match(fs.readFileSync(path.join(target, "pdf-tools", "SKILL.md"), "utf8"), /new body/);
});

test("install: rejects unsafe input", async () => {
  const target = path.join(tmp(), "skills");
  const files = { "SKILL.md": "---\nname: ok\n---\n" };
  await assert.rejects(planInstall({ rootPath: target, name: "Bad_Name", files }), /技能名/);
  await assert.rejects(planInstall({ rootPath: target, name: "synced", files, reserved: ["synced"] }), /保留名称/);
  await assert.rejects(planInstall({ rootPath: target, name: "ok", files: { "../x/SKILL.md": "y" } }), /非法的文件路径/);
  await assert.rejects(planInstall({ rootPath: target, name: "ok", files: { "a/../../SKILL.md": "y" } }), /非法的文件路径/);
  await assert.rejects(planInstall({ rootPath: target, name: "ok", files: { "README.md": "y" } }), /SKILL.md/);
  assert.equal(validRel("C:/x"), false);
  assert.equal(validRel("a\\b"), false);
  assert.equal(validRel("a/b/c.md"), true);
});

test("install: a folder cannot be installed onto itself", async () => {
  const home = tmp();
  const src = path.join(home, ".claude", "skills", "pdf-tools");
  skill(src);
  await assert.rejects(
    planInstall({ rootPath: path.join(home, ".claude", "skills"), name: "pdf-tools", source: src }),
    /same folder/,
  );
});

test("uninstall: removes recorded files only", async () => {
  const target = path.join(tmp(), "skills");
  const files = { "SKILL.md": "---\nname: ok\n---\n", "examples/a.json": "[]" };
  const r = await applyInstall(await planInstall({ rootPath: target, name: "ok", files }));
  write(path.join(r.dir, "scripts", "mine.sh"));
  await removeInstall({ dir: r.dir, files: r.files });
  assert.equal(fs.existsSync(path.join(r.dir, "SKILL.md")), false);
  assert.equal(fs.existsSync(path.join(r.dir, "examples")), false);
  assert.equal(fs.existsSync(path.join(r.dir, "scripts", "mine.sh")), true);
  // a full copy is removed completely, leaving no empty folder
  const files2 = { ...files };
  const again = await applyInstall(
    await planInstall({ rootPath: target, name: "ok-two", files: files2 }),
  );
  await removeInstall({ dir: again.dir, files: again.files });
  assert.equal(fs.existsSync(again.dir), false);
});

test("uninstall: folders created on install are pruned, existing ones are kept", async () => {
  const home = tmp();
  // Agent 的目录本来不存在：安装时逐级创建，卸载后一并清掉
  const fresh = path.join(home, ".newagent", "skills");
  const plan = await planInstall({ rootPath: fresh, name: "one", files: { "SKILL.md": "---\nname: one\n---\n" } });
  const r = await applyInstall(plan);
  assert.equal(fs.existsSync(path.join(home, ".newagent")), true);
  await removeInstall({ dir: r.dir, files: r.files });
  assert.equal(await pruneEmptyDirs(path.dirname(r.dir), home), 2); // skills 与 .newagent
  assert.equal(fs.existsSync(path.join(home, ".newagent")), false);
  // 目录本来就存在：里面的其他内容保持原样，空目录链只删到第一个非空目录为止
  const kept = path.join(home, ".agents", "skills", "mine");
  skill(kept);
  const p2 = await planInstall({
    rootPath: path.join(home, ".agents", "skills"),
    name: "two",
    files: { "SKILL.md": "---\nname: two\n---\n", "refs/a.md": "a" },
  });
  const r2 = await applyInstall(p2);
  await removeInstall({ dir: r2.dir, files: r2.files });
  assert.equal(await pruneEmptyDirs(path.dirname(r2.dir), home), 0);
  assert.equal(fs.existsSync(path.join(kept, "SKILL.md")), true);
  // 不会越过 stop 往上删
  const deep = path.join(home, "x", "y");
  fs.mkdirSync(deep, { recursive: true });
  assert.equal(await pruneEmptyDirs(deep, path.join(home, "x")), 1);
  assert.equal(fs.existsSync(path.join(home, "x", "y")), false);
  assert.equal(fs.existsSync(home), true);
});

test("store: persists documents and survives a corrupt file", () => {
  const dir = tmp();
  const file = path.join(dir, "settings.json");
  let store = openStore(file);
  store.get().customRoots.push({ id: "c1", path: dir, label: "" });
  store.get().customRoots.push({ id: "bad" });
  store.save();
  store.writeDoc("library.json", { skills: [1, 2] });
  store = openStore(file);
  assert.equal(store.get().customRoots.length, 1);
  assert.equal(store.get().customRoots[0].label, path.basename(dir));
  assert.deepEqual(store.readDoc("library.json"), { skills: [1, 2] });
  fs.writeFileSync(file, "{not json");
  assert.deepEqual(openStore(file).get().customRoots, []);
  assert.equal(openStore(file).readDoc("nope.json"), null);
});

test("store: keeps only real entries of folders created on install", () => {
  const file = path.join(tmp(), "settings.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      customRoots: [],
      installs: {},
      createdRoots: { [path.join("relative", "skills")]: true, [path.resolve(os.tmpdir(), "made", "skills")]: true, bad: "yes" },
    }),
  );
  const st = openStore(file);
  assert.deepEqual(Object.keys(st.get().createdRoots), [path.resolve(os.tmpdir(), "made", "skills")]);
  st.get().createdRoots[path.resolve(os.tmpdir(), "made2")] = true;
  st.save();
  st.reload();
  assert.equal(Object.keys(st.get().createdRoots).length, 2);
});

test("watch: reports changes and picks up folders created later", async () => {
  const home = tmp();
  const a = path.join(home, "a");
  fs.mkdirSync(a);
  let changes = 0;
  const stop = watchPaths(
    () => [a, path.join(home, "later")],
    () => changes++,
    { debounce: 60, pollMs: 80 },
  );
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  skill(path.join(a, "s1"));
  const by = async (f, ms = 4000) => {
    const end = Date.now() + ms;
    while (!f() && Date.now() < end) await wait(40);
    assert.ok(f(), "condition not met in time");
  };
  await by(() => changes >= 1);
  fs.mkdirSync(path.join(home, "later"));
  const before = changes;
  await by(() => changes > before);
  stop();
  const stopped = changes;
  skill(path.join(a, "s2"));
  await wait(400);
  assert.equal(changes, stopped);
});
