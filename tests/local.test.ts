import { test } from "node:test";
import assert from "node:assert/strict";
import type { Skill } from "../src/types/skill";
import {
  adopt,
  contentHash,
  fromLocal,
  keepLibrary,
  peek,
  reconcile,
  sourceOf,
  stamp,
  syncState,
} from "../src/features/local/convert";
import {
  fileKey,
  linkOf,
  type LocalFile,
  type LocalItem,
  type LocalRoot,
} from "../src/features/local/bridge";

const root: LocalRoot = {
  id: "claude",
  agentId: "claude",
  label: "Claude Code",
  readers: [],
  doc: "",
  reserved: [],
  path: "/home/u/.claude/skills",
  builtin: true,
  exists: true,
};
const item = (dirName: string, flat = false): LocalItem => ({
  key: "claude|" + dirName,
  rootId: "claude",
  dir: flat ? root.path : `${root.path}/${dirName}`,
  dirName,
  group: null,
  skillMd: flat ? `${root.path}/${dirName}.md` : `${root.path}/${dirName}/SKILL.md`,
  skillJson: null,
  mtime: 1,
  size: 10,
  sig: "10:1",
  files: 1,
  extras: [],
  hasScripts: false,
  flat,
});
const filesOf = (...pairs: [LocalItem, string][]): Map<string, LocalFile> =>
  new Map(pairs.map(([i, text]) => [fileKey(i.skillMd ?? ""), { path: i.skillMd!, text }]));
const GOOD = `---\nname: release-notes\ndescription: Draft release notes from commits.\nlicense: MIT\n---\n\n## Instructions\n\n1. List commits.\n2. Group them.\n`;

const imported = (text = GOOD): Skill =>
  stamp(
    fromLocal({
      dirName: "release-notes",
      dir: item("release-notes").dir,
      rootId: "claude",
      rootLabel: "Claude Code",
      skillMd: item("release-notes").skillMd,
      skillJson: null,
      md: text,
    }).skill,
  );

test("peek reads frontmatter leniently", () => {
  const folded = peek(`---\nname: pdf\ndescription: >\n  Extract text.\n  Fill forms.\nlicense: Apache-2.0\n---\nbody`);
  assert.equal(folded.name, "pdf");
  assert.equal(folded.description, "Extract text. Fill forms.");
  assert.equal(folded.license, "Apache-2.0");
  const broken = peek(`---\nname: "quoted name"\ndescription: first line\n\tbroken: [unclosed\n---\nBody first line`);
  assert.equal(broken.name, "quoted name");
  assert.equal(broken.raw && typeof broken.raw, "object");
  const plain = peek("# Title\n\nSome text\n");
  assert.equal(plain.name, null);
  assert.equal(plain.description, "Title");
  assert.deepEqual(peek(null), { name: null, description: "", license: null, raw: {} });
});

test("fromLocal keeps a valid SKILL.md strict and links it to disk", () => {
  const raw = fromLocal({
    dirName: "release-notes",
    dir: item("release-notes").dir,
    rootId: "claude",
    rootLabel: "Claude Code",
    skillMd: item("release-notes").skillMd,
    skillJson: null,
    md: GOOD,
  });
  assert.equal(raw.via, "skill.md");
  assert.equal(raw.warning, null);
  assert.equal(raw.skill.status, "Local");
  assert.match(raw.skill.instructions, /Group them/);
  assert.deepEqual(raw.skill.workflow, []);
  const skill = imported();
  assert.equal(linkOf(skill)?.path, item("release-notes").skillMd);
});

test("fromLocal falls back for names that break the schema without losing the body", () => {
  const text = `---\nname: Git Release\ndescription: Prepare release notes.\nmetadata:\n  author: example\nallowed-tools: Bash\n---\n\n## When to use\n\nUse it before a release.\n\nRun \`scripts/changelog.ts\`.\n`;
  const r = fromLocal({
    dirName: "git-release",
    dir: item("git-release").dir,
    rootId: "claude",
    rootLabel: "Claude Code",
    skillMd: item("git-release").skillMd,
    skillJson: null,
    md: text,
  });
  assert.equal(r.via, "lenient");
  assert.equal(r.skill.name, "git-release");
  assert.equal(r.skill.displayName, "Git Release");
  assert.equal(r.skill.description, "Prepare release notes.");
  assert.match(r.skill.instructions, /scripts\/changelog\.ts/);
  assert.deepEqual(
    (r.skill.metadata.importedFrontmatter as Record<string, unknown>)["allowed-tools"],
    "Bash",
  );
  assert.ok(r.warning);
  const unlicensed = fromLocal({
    dirName: "My_Skill",
    dir: item("My_Skill").dir,
    rootId: "claude",
    rootLabel: "Claude Code",
    skillMd: item("My_Skill").skillMd,
    skillJson: null,
    md: "---\ndescription: x\n---\nBody",
  });
  assert.equal(unlicensed.skill.name, "my-skill");
  assert.equal(unlicensed.skill.license, "UNLICENSED");
  assert.equal(unlicensed.skill.displayName, "My Skill");
});

test("contentHash follows SKILL.md content only", () => {
  const s = imported();
  assert.equal(contentHash({ ...s, version: "9.9.9", tags: ["a"], metadata: { x: 1 } }), contentHash(s));
  assert.notEqual(contentHash({ ...s, instructions: "changed" }), contentHash(s));
  assert.notEqual(contentHash({ ...s, tools: [{ name: "Bash", permissions: "read", description: "" }] }), contentHash(s));
});

test("reconcile adopts disk changes, flags conflicts and remembers missing files", () => {
  const it = item("release-notes");
  const base = imported();
  const ctx = (files: Map<string, LocalFile>, skills: Skill[] = [base]) => ({
    skills,
    items: [it],
    files,
    roots: [root],
    now: Date.parse("2026-01-02T00:00:00Z"),
  });

  // untouched: nothing happens
  const same = reconcile(ctx(filesOf([it, GOOD])));
  assert.equal(same.notes.length, 0);
  assert.equal(same.next[0], base);

  // disk changed, library untouched: adopt silently
  const edited = GOOD.replace("Group them.", "Group them by area.");
  const upd = reconcile(ctx(filesOf([it, edited])));
  assert.equal(upd.notes[0].kind, "updated");
  assert.match(upd.next[0].instructions, /by area/);
  assert.equal(upd.next[0].id, base.id);
  assert.equal(upd.next[0].updatedAt, "2026-01-02T00:00:00.000Z");
  assert.equal(syncState(upd.next[0], contentHash(upd.next[0]), it), "in-sync");

  // library edited in the app, disk the same: left alone, reported as pending
  const libEdit: Skill = { ...base, instructions: "my own edit" };
  const pending = reconcile(ctx(filesOf([it, GOOD]), [libEdit]));
  assert.equal(pending.notes.length, 0);
  assert.equal(pending.next[0], libEdit);
  assert.equal(
    syncState(libEdit, contentHash(imported(GOOD)), it),
    "pending",
  );

  // both changed: conflict, nobody's text is overwritten
  const both = reconcile(ctx(filesOf([it, edited]), [libEdit]));
  assert.equal(both.notes[0].kind, "conflict");
  assert.equal(linkOf(both.next[0])?.conflict, true);
  assert.equal(both.next[0].instructions, "my own edit");

  // keeping the library version turns it into "pending write-back", disk is not re-adopted
  const kept = keepLibrary(both.next[0], contentHash(imported(edited)));
  assert.equal(linkOf(kept)?.conflict, false);
  const keep = reconcile(ctx(filesOf([it, edited]), [kept]));
  assert.equal(keep.notes.length, 0);
  assert.equal(keep.next[0].instructions, "my own edit");
  assert.equal(syncState(kept, contentHash(imported(edited)), it), "pending");
  // adopting the disk version resolves it in the other direction
  const diskVersion = fromLocal(sourceOf(it, [root], filesOf([it, edited]))).skill;
  const adopted = reconcile(
    ctx(filesOf([it, edited]), [adopt(both.next[0], diskVersion, Date.now())]),
  );
  assert.equal(adopted.notes.length, 0);
  assert.match(adopted.next[0].instructions, /by area/);

  // file deleted: keep the library copy, flag it; coming back restores
  const gone = reconcile({ ...ctx(filesOf()), items: [] });
  assert.equal(gone.notes[0].kind, "missing");
  assert.equal(linkOf(gone.next[0])?.missing, true);
  assert.equal(syncState(gone.next[0], null, undefined), "missing");
  const back = reconcile(ctx(filesOf([it, GOOD]), [gone.next[0]]));
  assert.equal(back.notes[0].kind, "restored");
  assert.equal(linkOf(back.next[0])?.missing, false);

  // unreadable file is not mistaken for a deletion
  const unreadable = reconcile(
    ctx(new Map([[fileKey(it.skillMd!), { path: it.skillMd!, text: null, error: "File exceeds 2 MB" }]])),
  );
  assert.equal(unreadable.notes.length, 0);
  assert.equal(unreadable.next[0], base);
});

test("fromLocal handles skill.json only and flat markdown skills", () => {
  const json = JSON.stringify({
    ...imported(),
    metadata: {},
  });
  const r = fromLocal({
    dirName: "release-notes",
    dir: item("release-notes").dir,
    rootId: "claude",
    rootLabel: "Claude Code",
    skillMd: null,
    skillJson: `${item("release-notes").dir}/skill.json`,
    json,
  });
  assert.equal(r.via, "skill.json");
  assert.equal(r.skill.name, "release-notes");
  assert.equal(linkOf(r.skill)?.path.endsWith("skill.json"), true);
  const flat = item("review", true);
  const f = fromLocal({
    dirName: "review",
    dir: flat.dir,
    rootId: "claude",
    rootLabel: "Claude Code",
    skillMd: flat.skillMd,
    skillJson: null,
    md: "---\nname: review\ndescription: Review code.\n---\nReview it.",
  });
  assert.equal(f.via, "skill.md");
  assert.equal(f.skill.status, "Local");
});
