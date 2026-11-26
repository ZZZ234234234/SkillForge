import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeTool } from "../src/types/agent";
import type { Skill, TestResult } from "../src/types/skill";
import { blankSkill } from "../src/features/skills/schema";
import {
  classifyPermission,
  bindTools,
  createRuntimeTools,
  buildSkillSystem,
  runSkill,
} from "../src/features/agent/runtime";
import { runAgentLoop } from "../src/features/agent/loop";
import { runTest } from "../src/features/tester/runner";
import { registrySkills } from "../src/features/skills/registry";

const settings = {
  endpoint: "https://example.com/v1",
  model: "test-model",
  apiKey: "",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
const call = (name: string, args: unknown, id = "c1") => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});
const tool = (
  name: string,
  kind: RuntimeTool["kind"],
  out: string,
): RuntimeTool => ({
  name,
  kind,
  description: name,
  parameters: { type: "object", properties: {} },
  execute: () => out,
});

test("free-text permissions are classified conservatively", () => {
  assert.deepEqual(
    classifyPermission("Read-only files explicitly supplied by the user"),
    {
      kind: "read",
      broad: false,
    },
  );
  assert.equal(classifyPermission("fetch web pages").kind, "network");
  assert.equal(classifyPermission("write and modify files").kind, "write");
  assert.equal(classifyPermission("").kind, "write");
  assert.equal(classifyPermission("something unclear").kind, "write");
  assert.equal(classifyPermission("Read-only files, *").broad, true);
  assert.equal(classifyPermission("全部权限").broad, true);
});

const skillWith = (tools: Skill["tools"]): Skill => {
  const s = blankSkill("Agent Sample");
  s.name = "agent-sample";
  s.tools = tools;
  s.tests = [];
  return s;
};

test("declared tools bind to runtime tools only within their permission class", () => {
  const available = createRuntimeTools({ files: [], skills: [] });
  const read = skillWith([
    { name: "read_files", permissions: "Read-only files", description: "d" },
    { name: "web_fetch", permissions: "Fetch a web page", description: "d" },
    { name: "shell", permissions: "Run commands", description: "d" },
  ]);
  const b = bindTools(read, available);
  assert.deepEqual(b[0].runtime, ["list_files", "read_file"]);
  assert.equal(b[0].kind, "read");
  assert.equal(b[1].kind, "network");
  assert.deepEqual(b[1].runtime, ["web_fetch"]);
  assert.equal(b[2].note, "not-executable");
  assert.deepEqual(b[2].runtime, []);
  // A tool declared read-only must not fall through to write-capable runtime tools.
  const strict = skillWith([
    { name: "filesystem", permissions: "read-only", description: "d" },
  ]);
  const fs = bindTools(strict, available)[0];
  assert.deepEqual(fs.runtime, ["list_files", "read_file"]);
  assert.equal(fs.note, "partial");
  const broad = skillWith([
    { name: "read_files", permissions: "* all access", description: "d" },
  ]);
  assert.equal(bindTools(broad, available)[0].broad, true);
});

test("the run-bench system prompt lists bound tools and never leaks the test's answer", async (t) => {
  const s = registrySkills()[0];
  const tools = createRuntimeTools({ files: [], skills: [s] });
  const text = buildSkillSystem(s, bindTools(s, tools), tools);
  assert.match(text, /read_file/);
  assert.doesNotMatch(text, /create_skill/);
  const leak = s.examples.find((e) =>
    s.tests.some((c) => c.input.trim() === e.input.trim()),
  );
  assert.ok(leak, "fixture needs an example that repeats a test input");
  // A sample whose input equals the task would hand the model its expected output.
  const { mock, seen } = scripted([
    { choices: [{ message: { content: "ok" } }] },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  await runSkill({ skill: s, input: leak.input, skills: [s], settings });
  const system = String(seen[0].messages[0].content);
  assert.ok(!system.includes(leak.output));
  const kept = s.examples.filter((e) => e.input.trim() !== leak.input.trim());
  for (const e of kept.slice(0, 2)) assert.ok(system.includes(e.output));
});

function scripted(responses: unknown[]) {
  let i = 0;
  const seen: {
    tools?: { function: { name: string } }[];
    messages: { role: string; content?: string }[];
  }[] = [];
  const mock = async (_u: unknown, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    const next = responses[Math.min(i++, responses.length - 1)];
    return json(next);
  };
  return { mock, seen };
}

test("read-only tools run without confirmation; write tools need it", async (t) => {
  const { mock, seen } = scripted([
    {
      choices: [
        {
          message: {
            tool_calls: [
              call("list_files", {}),
              call("save_artifact", { name: "a.txt", content: "x" }),
            ],
          },
        },
      ],
      usage: { total_tokens: 10 },
    },
    { choices: [{ message: { content: "done" } }], usage: { total_tokens: 5 } },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  const ran: string[] = [];
  const asked: string[] = [];
  const trace = await runAgentLoop({
    system: "sys",
    input: "go",
    settings,
    tools: [
      {
        ...tool("list_files", "read", "none"),
        execute: () => (ran.push("list"), "none"),
      },
      {
        ...tool("save_artifact", "write", "saved"),
        execute: () => (ran.push("save"), "saved"),
      },
    ],
    confirm: async (r) => (asked.push(r.tool), true),
  });
  assert.equal(trace.status, "done");
  assert.equal(trace.output, "done");
  assert.equal(trace.tokens, 15);
  assert.deepEqual(ran, ["list", "save"]);
  assert.deepEqual(asked, ["save_artifact"]);
  assert.deepEqual(
    trace.steps.map((s) => s.decision),
    ["auto", "confirmed"],
  );
  assert.equal(seen[1].tools?.length, 2);
  assert.equal(seen[1].messages.at(-1)?.role, "tool");
});

test("write tools are denied without a confirm callback or when the user refuses", async (t) => {
  const replies = () =>
    scripted([
      { choices: [{ message: { tool_calls: [call("save_artifact", {})] } }] },
      { choices: [{ message: { content: "blocked" } }] },
    ]);
  const tools = [
    {
      ...tool("save_artifact", "write", "saved"),
      execute: () => assert.fail("must not run"),
    },
  ];
  t.mock.method(globalThis, "fetch", replies().mock);
  const a = await runAgentLoop({ system: "s", input: "i", settings, tools });
  assert.equal(a.steps[0].status, "denied");
  assert.equal(a.steps[0].decision, "denied");
  t.mock.method(globalThis, "fetch", replies().mock);
  const b = await runAgentLoop({
    system: "s",
    input: "i",
    settings,
    tools,
    confirm: async () => false,
  });
  assert.equal(b.steps[0].status, "denied");
  assert.equal(b.output, "blocked");
});

test("broad permissions force confirmation even for read-only tools", async (t) => {
  const { mock } = scripted([
    { choices: [{ message: { tool_calls: [call("read_file", {})] } }] },
    { choices: [{ message: { content: "ok" } }] },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  const trace = await runAgentLoop({
    system: "s",
    input: "i",
    settings,
    tools: [tool("read_file", "read", "data")],
    confirm: async () => false,
    forceConfirm: ["read_file"],
  });
  assert.equal(trace.steps[0].decision, "denied");
});

test("stopping while the approval dialog is open never runs the approved tool", async (t) => {
  const { mock } = scripted([
    { choices: [{ message: { tool_calls: [call("save_artifact", {})] } }] },
    { choices: [{ message: { content: "" } }] },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  const ac = new AbortController();
  const trace = await runAgentLoop({
    system: "s",
    input: "i",
    settings,
    tools: [
      {
        ...tool("save_artifact", "write", "saved"),
        execute: () => assert.fail("must not run after Stop"),
      },
    ],
    signal: ac.signal,
    confirm: async () => {
      ac.abort();
      return true;
    },
  });
  assert.equal(trace.steps[0].decision, "denied");
  assert.equal(trace.status, "stopped");
  assert.equal(trace.reason, "aborted");
});

test("unknown tools are reported as unavailable and never claimed as run", async (t) => {
  const { mock } = scripted([
    { choices: [{ message: { tool_calls: [call("shell", { cmd: "rm" })] } }] },
    { choices: [{ message: { content: "no shell" } }] },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  const trace = await runAgentLoop({
    system: "s",
    input: "i",
    settings,
    tools: [tool("read_file", "read", "data")],
    confirm: async () => true,
  });
  assert.equal(trace.steps[0].status, "error");
  assert.equal(trace.steps[0].decision, "unavailable");
  assert.match(trace.steps[0].result, /not available/);
});

test("cancellation, errors and the step limit are recorded truthfully", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Aborted", "AbortError");
  });
  const ac = new AbortController();
  ac.abort();
  const stopped = await runAgentLoop({
    system: "s",
    input: "i",
    settings,
    tools: [],
    signal: ac.signal,
  });
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.reason, "aborted");
  t.mock.method(globalThis, "fetch", async () => json({ choices: [] }));
  const errored = await runAgentLoop({
    system: "s",
    input: "i",
    settings,
    tools: [],
  });
  assert.equal(errored.status, "error");
  const { mock } = scripted([
    { choices: [{ message: { tool_calls: [call("read_file", {})] } }] },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  const limited = await runAgentLoop({
    system: "s",
    input: "i",
    settings,
    tools: [tool("read_file", "read", "data")],
    maxSteps: 3,
  });
  assert.equal(limited.status, "stopped");
  assert.equal(limited.reason, "max-steps");
  assert.equal(limited.steps.length, 3);
});

test("runtime tools read attachments, search the library and validate URL and size", async () => {
  const a = registrySkills()[0];
  const tools = createRuntimeTools({
    files: [{ name: "notes.txt", content: "one\ntwo\nthree" }],
    skills: registrySkills(),
    saveArtifact: () => {},
  });
  const run = (name: string, args: unknown = {}) =>
    tools
      .find((x) => x.name === name)!
      .execute(args as Record<string, unknown>);
  assert.match(String(await run("list_files")), /notes\.txt/);
  assert.match(
    String(await run("read_file", { name: "notes.txt", offset: 2, limit: 1 })),
    /^File: .*\(lines 2-2 of 3\)\ntwo$/,
  );
  assert.match(String(await run("read_file", { name: "x.txt" })), /ERROR/);
  assert.match(
    String(await run("search_skills", { query: a.name })),
    new RegExp(a.name),
  );
  assert.match(String(await run("read_skill", { name: a.id })), /"name"/);
  assert.match(
    String(await run("web_fetch", { url: "javascript:alert(1)" })),
    /ERROR/,
  );
  assert.match(
    String(await run("web_fetch", { url: "https://u:p@example.com" })),
    /ERROR/,
  );
  assert.match(
    String(await run("save_artifact", { name: ".hidden", content: "" })),
    /ERROR/,
  );
  assert.match(
    String(
      await run("save_artifact", {
        name: "big.txt",
        content: "x".repeat(200_001),
      }),
    ),
    /exceeds/,
  );
  assert.match(
    String(await run("save_artifact", { name: "ok/../x.txt", content: "hi" })),
    /Saved artifact "ok_.._x\.txt"/,
  );
});

test("steward write tools validate the schema and reject reserved fields", async () => {
  const existing = registrySkills()[0];
  let created: Skill | undefined, updated: Skill | undefined;
  const tools = createRuntimeTools({
    files: [],
    skills: [existing],
    createSkill: (s) => (created = s),
    updateSkill: (s) => (updated = s),
  });
  const run = (name: string, args: unknown) =>
    tools
      .find((x) => x.name === name)!
      .execute(args as Record<string, unknown>);
  assert.match(
    String(
      await run("create_skill", {
        skill: {
          displayName: "Commit Checker",
          id: "evil",
          status: "Published",
        },
      }),
    ),
    /Created draft skill "commit-checker"/,
  );
  assert.equal(created?.status, "Draft");
  assert.notEqual(created?.id, "evil");
  assert.match(
    String(
      await run("create_skill", {
        skill: { displayName: existing.displayName },
      }),
    ),
    /already exists/,
  );
  assert.match(
    String(await run("create_skill", { skill: { name: "Bad Name" } })),
    /ERROR: invalid skill/,
  );
  assert.match(
    String(await run("update_skill", { name: "nope", patch: {} })),
    /ERROR: no skill/,
  );
  assert.match(
    String(
      await run("update_skill", { name: existing.id, patch: { id: "x" } }),
    ),
    /cannot be changed/,
  );
  assert.match(
    String(
      await run("update_skill", {
        name: existing.id,
        patch: { role: "Better role" },
      }),
    ),
    /Updated/,
  );
  assert.equal(updated?.role, "Better role");
  assert.equal(updated?.id, existing.id);
  const plain = createRuntimeTools({ files: [], skills: [] });
  assert.equal(
    plain.some((x) => x.kind === "write" && x.name === "create_skill"),
    false,
  );
});

test("runSkill executes only the bound tools and returns artifacts and bindings", async (t) => {
  const s = skillWith([
    {
      name: "write_files",
      permissions: "Write output files",
      description: "d",
    },
  ]);
  const { mock } = scripted([
    {
      choices: [
        {
          message: {
            tool_calls: [
              call("save_artifact", { name: "out.md", content: "# hi" }),
              call("create_skill", {}),
            ],
          },
        },
      ],
    },
    {
      choices: [{ message: { content: "final" } }],
      usage: { total_tokens: 7 },
    },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  const run = await runSkill({
    skill: s,
    input: "task",
    skills: [s],
    settings,
    confirm: async () => true,
  });
  assert.deepEqual(run.bindings[0].runtime, ["save_artifact"]);
  assert.equal(run.trace.output, "final");
  assert.equal(run.trace.tokens, 7);
  assert.equal(run.trace.steps[1].tool, "create_skill");
  assert.equal(run.trace.steps[1].status, "error");
  assert.deepEqual(run.artifacts, [{ name: "out.md", content: "# hi" }]);
  assert.equal(run.skillName, "Agent Sample");
});

test("agent evaluation scores real output, counts real tool calls and reports denials", async (t) => {
  const s = registrySkills()[0];
  const test0 = s.tests[0];
  const base = {
    id: s.id,
    testId: test0.id,
    mode: "agent" as const,
    model: "test-model",
  };
  const { mock } = scripted([
    {
      choices: [
        {
          message: {
            tool_calls: [
              call("read_file", { name: "none.txt" }),
              call("save_artifact", { name: "x", content: "y" }),
            ],
          },
        },
      ],
    },
    {
      choices: [{ message: { content: "FINAL ANSWER" } }],
      usage: { total_tokens: 9 },
    },
  ]);
  t.mock.method(globalThis, "fetch", mock);
  const withAssert: Skill = {
    ...s,
    tests: [
      { ...test0, assertions: [{ kind: "contains", value: "final answer" }] },
    ],
  };
  const pass: TestResult = await runTest(
    withAssert,
    withAssert.tests[0],
    "agent",
    settings,
    {
      confirm: async () => false,
      skills: [s],
    },
  );
  assert.equal(pass.status, "pass");
  assert.equal(pass.toolCalls, 0, "a failed read is not a successful call");
  assert.match(pass.notes, /0 approved, 0 denied, 1 unavailable/);
  assert.equal(pass.tokens, 9);
  assert.equal(pass.model, base.model);
  const fail = await runTest(
    {
      ...s,
      tests: [{ ...test0, assertions: [{ kind: "contains", value: "zebra" }] }],
    },
    { ...test0, assertions: [{ kind: "contains", value: "zebra" }] },
    "agent",
    settings,
    { confirm: async () => false, skills: [s] },
  );
  assert.equal(fail.status, "fail");
  assert.match(fail.result, /--- assertions ---/);
  const noAssert = await runTest(
    s,
    { ...test0, assertions: [] },
    "agent",
    settings,
    { skills: [s] },
  );
  assert.equal(noAssert.status, "skipped");
  t.mock.method(globalThis, "fetch", async () => json({ choices: [] }));
  const errored = await runTest(s, test0, "agent", settings, { skills: [s] });
  assert.equal(errored.status, "error");
  const noModel = await runTest(s, test0, "agent");
  assert.equal(noModel.status, "error");
  assert.match(noModel.result, /Configure a model/);
});
