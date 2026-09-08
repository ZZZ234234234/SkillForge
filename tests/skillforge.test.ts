import assert from "node:assert/strict";
import test from "node:test";
import type { SkillTest } from "../src/types/skill";
import { validateSkill } from "../src/features/skills/schema";
import {
  parseSkill,
  skillMarkdown,
  skillReadme,
} from "../src/features/skills/parser";
import {
  inspectSkill,
  scoreSkill,
  detectSecrets,
  redactSecrets,
} from "../src/features/inspector/engine";
import {
  exportZip,
  readZip,
  importFiles,
  importGitHub,
} from "../src/features/skills/archive";
import { packageFiles, adapters } from "../src/adapters";
import { registrySkills } from "../src/features/skills/registry";
import {
  templateSkill,
  refineTemplate,
  complete,
  generateSkill,
} from "../src/features/generator/service";
import { runTest, compareSkills } from "../src/features/tester/runner";
import { zipSync, strToU8 } from "fflate";
const sample = registrySkills()[1];
test("registry contains 18 valid, unique, attributed demo skills", () => {
  const a = registrySkills();
  assert.equal(a.length, 18);
  assert.equal(new Set(a.map((s) => s.id)).size, 18);
  for (const s of a) {
    assert.ok(validateSkill(s).success);
    assert.equal(s.metadata.demo, true);
    assert.equal(s.author, "爱吃孜然芥末");
    assert.ok(s.tests.length >= 2);
    assert.ok(s.examples.length);
    assert.equal(detectSecrets(JSON.stringify(s)).length, 0);
  }
});
test("JSON round-trip preserves the entire schema", () =>
  assert.deepEqual(parseSkill(JSON.stringify(sample), "skill.json"), sample));
test("Markdown round-trip preserves behavioral fields and real frontmatter", () => {
  const s = parseSkill(skillMarkdown(sample));
  for (const key of [
    "name",
    "description",
    "instructions",
    "role",
    "goals",
    "workflow",
    "constraints",
    "outputFormat",
    "errorHandling",
    "tools",
    "examples",
    "tests",
  ] as const)
    assert.deepEqual(s[key], sample[key], key);
});
test("YAML supports folded descriptions and unknown metadata without execution", () => {
  const s = parseSkill(
    "---\nname: review-skill\ndescription: >\n  Review code\n  with evidence.\nmodel: custom\n---\n\nRead files carefully.",
  );
  assert.match(s.description, /Review code with evidence/);
  assert.ok(s.metadata.importedFrontmatter);
});
test("plain Markdown imports as draft instructions", () =>
  assert.match(
    parseSkill("# Task\nRead the source and report evidence.").instructions,
    /Read the source/,
  ));
test("validator rejects traversal names and invalid versions", () => {
  assert.equal(validateSkill({ ...sample, name: "../../x" }).success, false);
  assert.equal(validateSkill({ ...sample, version: "latest" }).success, false);
});
test("parser rejects malformed JSON and oversized text", () => {
  assert.throws(() => parseSkill("{bad", "x.json"));
  assert.throws(() => parseSkill("a".repeat(2_000_001)));
});
test("scorer is deterministic, bounded and improves after missing error policy is repaired", () => {
  const s = registrySkills()[0],
    a = scoreSkill(s),
    b = scoreSkill({ ...s, errorHandling: sample.errorHandling });
  assert.ok(a.overall >= 0 && a.overall <= 100);
  assert.ok(b.overall > a.overall);
  assert.deepEqual(a, scoreSkill(s));
  assert.equal(Object.keys(a.dimensions).length, 9);
});
test("inspector detects overbroad permissions, duplicate and conflicting rules", () => {
  const s = {
    ...sample,
    tools: [
      { name: "shell", permissions: "*", description: "Execute commands" },
    ],
    instructions:
      "Always run shell.\nNever run shell.\nRepeat a sufficiently long instruction.\nRepeat a sufficiently long instruction.",
  };
  const f = inspectSkill(s);
  assert.equal(f.find((x) => x.id === "broad-tools")?.severity, "Critical");
  assert.equal(f.find((x) => x.id === "duplicates")?.severity, "Suggestion");
  assert.equal(f.find((x) => x.id === "conflict")?.severity, "Warning");
});
test("secret detection and redaction cover several credential styles", () => {
  for (const value of [
    "sk-" + "a".repeat(25),
    "Bearer " + "b".repeat(20),
    "password=" + "c".repeat(15),
    "ghp_" + "d".repeat(20),
    "token=" + "e".repeat(20),
  ]) {
    assert.ok(detectSecrets(value).length);
    assert.equal(detectSecrets(redactSecrets(value)).length, 0);
  }
  assert.equal(detectSecrets("Use ${API_KEY} or <YOUR_TOKEN>").length, 0);
});
test("package ZIP round-trip imports one full skill and all support files", () => {
  const files = packageFiles(sample);
  assert.equal(Object.keys(files).length, 7);
  assert.deepEqual(readZip(exportZip(files)), files);
  const imported = importFiles(files);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].instructions, sample.instructions);
  assert.notEqual(imported[0].id, sample.id);
  assert.equal(imported[0].status, "Local");
});
test("all platform adapters export expected paths and experimental notices", () => {
  for (const a of adapters) {
    const files = packageFiles(sample, a.id);
    assert.ok(files[a.path(sample) + "/SKILL.md"]);
    if (a.experimental)
      assert.match(files[a.path(sample) + "/README.md"], /Experimental/);
  }
  assert.throws(() => packageFiles(sample, "imaginary"));
});
test("unsafe ZIP entries and decompression bombs are rejected before extraction", () => {
  assert.throws(
    () => readZip(zipSync({ "../escape": strToU8("x") })),
    /Unsafe/,
  );
  assert.throws(
    () => readZip(zipSync({ "SKILL.md": new Uint8Array(2_000_001) })),
    /limit/,
  );
  assert.throws(() => readZip(new Uint8Array(5_000_001)), /5 MB/);
  assert.throws(() => importFiles({ "../SKILL.md": "x" }), /Unsafe/);
});
test("folder import accepts multiple packages without double-importing Markdown", () => {
  const other = registrySkills()[2];
  assert.equal(
    importFiles({ ...packageFiles(sample), ...packageFiles(other) }).length,
    2,
  );
});
test("GitHub import rejects non-GitHub hosts and tree URLs without fetching", async () => {
  await assert.rejects(() => importGitHub("http://localhost/private"));
  await assert.rejects(() => importGitHub("https://github.com/a/b/tree/main"));
});
test("offline generator and all refinement actions produce schema-valid skills", () => {
  const s = templateSkill("Create a Next.js reviewer");
  assert.equal(s.metadata.generation, "offline-template");
  assert.ok(validateSkill(s).success);
  for (const action of [
    "Improve",
    "Simplify",
    "Make More Strict",
    "Add Tests",
    "Add Failure Handling",
    "Regenerate Section",
  ])
    assert.ok(validateSkill(refineTemplate(s, action, "instructions")).success);
  assert.match(skillReadme(s), /Next.js/);
});
test("rule evaluation checks contracts and does not fabricate model usage", async () => {
  const r = await runTest(sample, sample.tests[0], "rule");
  assert.equal(r.status, "pass");
  assert.equal(r.tokens, null);
  assert.equal(r.toolCalls, 0);
  assert.equal(r.model, "none");
  const fail = await runTest(
    sample,
    {
      ...sample.tests[0],
      assertions: [{ kind: "contains", value: "nonexistent-marker-xxxxx" }],
    },
    "rule",
  );
  assert.equal(fail.status, "fail");
});
test("rule evaluation excludes its own assertions and example text", async () => {
  const skill = structuredClone(sample);
  const testCase: SkillTest = {
    ...skill.tests[0],
    assertions: [{ kind: "contains", value: "assertion-only-marker" }],
  };
  skill.tests = [testCase];
  skill.examples = [
    { input: "assertion-only-marker", output: "example-only-marker" },
  ];
  assert.equal((await runTest(skill, testCase, "rule")).status, "fail");
  testCase.assertions = [
    { kind: "notContains", value: "assertion-only-marker" },
  ];
  assert.equal((await runTest(skill, testCase, "rule")).status, "pass");
  skill.instructions += "\nassertion-only-marker";
  assert.equal((await runTest(skill, testCase, "rule")).status, "fail");
});
test("empty rules and mock examples are skipped, not fake passes", async () => {
  assert.equal(
    (await runTest(sample, { ...sample.tests[0], assertions: [] }, "rule"))
      .status,
    "skipped",
  );
  const r = await runTest(sample, sample.tests[0], "mock");
  assert.equal(r.status, "skipped");
  assert.equal(r.result, sample.examples[0].output);
});
test("comparison uses the supplied run and excludes mock from pass denominator", async () => {
  const a = await runTest(sample, sample.tests[0], "rule"),
    b = await runTest(sample, sample.tests[0], "mock");
  const [r] = compareSkills([sample], [a, b], "rule");
  assert.equal(r.passed, 1);
  assert.equal(r.evaluated, 1);
  assert.equal(r.tokens, null);
  assert.equal(r.toolCalls, 0);
});
test("LLM failure is captured as an error, never a passing result", async () => {
  const r = await runTest(sample, sample.tests[0], "llm", {
    endpoint: "http://evil.invalid/v1",
    model: "example",
    apiKey: "",
  });
  assert.equal(r.status, "error");
  assert.match(r.result, /HTTPS/);
});
test("model requests reject insecure endpoints and embedded secrets", async () => {
  await assert.rejects(() =>
    complete({ endpoint: "http://example.com/v1", model: "x", apiKey: "" }, []),
  );
  await assert.rejects(
    () =>
      complete({ endpoint: "https://example.com/v1", model: "x", apiKey: "" }, [
        { role: "user", content: "sk-" + "a".repeat(30) },
      ]),
    /Secret/,
  );
});
test("AI generation validates returned JSON and token usage with an isolated mock transport", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(sample) } }],
          usage: { total_tokens: 123 },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  );
  const r = await generateSkill("Review Next.js", {
    endpoint: "https://example.com/v1",
    model: "test-model",
    apiKey: "",
  });
  assert.equal(r.skill.id, sample.id);
  assert.equal(r.tokens, 123);
});
