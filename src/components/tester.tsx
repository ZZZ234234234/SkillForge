"use client";
import { useState } from "react";
import { Play, Plus, FlaskConical, ArrowDownToLine } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type {
  Skill,
  Language,
  ModelSettings,
  TestMode,
  TestResult,
  SkillTest,
} from "../types/skill";
import { runTest, compareSkills } from "../features/tester/runner";
import { Pick, words, download } from "./controls";
export function Tester({
  lang,
  skills,
  settings,
  results,
  onResults,
  onChange,
}: {
  lang: Language;
  skills: Skill[];
  settings: ModelSettings;
  results: TestResult[];
  onResults: (r: TestResult[]) => void;
  onChange: (s: Skill) => void;
}) {
  const t = words(lang),
    [ids, setIds] = useState<string[]>(skills.slice(0, 2).map((s) => s.id)),
    [source, setSource] = useState(skills[0]?.id ?? ""),
    [mode, setMode] = useState<TestMode>("rule"),
    [busy, setBusy] = useState(false),
    [batch, setBatch] = useState<TestResult[]>([]),
    [test, setTest] = useState({
      name: "",
      input: "",
      expectedBehavior: "",
      expectedOutput: "",
      contains: "",
    });
  const s = skills.find((x) => x.id === source),
    selected = skills.filter((s) => ids.includes(s.id));
  const run = async () => {
    if (!s?.tests.length || !selected.length)
      return toast.error(
        t("请选择技能和非空测试集", "Select skills and a nonempty test suite"),
      );
    setBusy(true);
    const current: TestResult[] = [];
    for (const sk of selected)
      for (const test of s.tests) {
        const r = await runTest(sk, test, mode, settings);
        current.push(r);
        setBatch([...current]);
      }
    onResults([...results, ...current].slice(-500));
    setBusy(false);
    toast.success(t("本轮测试完成", "Evaluation complete"));
  };
  const add = () => {
    if (!s || !test.input.trim() || !test.expectedBehavior.trim())
      return toast.error(
        t("填写输入与预期行为", "Enter input and expected behavior"),
      );
    const c: SkillTest = {
      id: crypto.randomUUID(),
      name: test.name || "Custom test",
      input: test.input,
      expectedBehavior: test.expectedBehavior,
      expectedOutput: test.expectedOutput || undefined,
      assertions: test.contains
        ? [{ kind: "contains", value: test.contains }]
        : [],
    };
    onChange({ ...s, tests: [...s.tests, c] });
    setTest({
      name: "",
      input: "",
      expectedBehavior: "",
      expectedOutput: "",
      contains: "",
    });
  };
  const rows = compareSkills(selected, batch, mode);
  return (
    <div className="tool-page">
      <p className="eyebrow">TEST. COMPARE. ITERATE.</p>
      <div className="spread">
        <h1>{t("测试与比较", "Test Bench")}</h1>
        <button
          className="secondary"
          onClick={() =>
            download(
              "skillforge-test-results.json",
              JSON.stringify(results, null, 2),
              "application/json",
            )
          }
        >
          <ArrowDownToLine size={15} />
          {t("导出记录", "Export results")}
        </button>
      </div>
      <p className="muted">
        {t(
          "对同一个测试集运行多个 Skill，比较可核实的结果。",
          "Run multiple skills against the same test suite and compare recorded results.",
        )}
      </p>
      <div className="surface test-controls">
        <div>
          <label>{t("选择参与比较的技能", "Skills to compare")}</label>
          <div className="compare-pickers">
            {skills.map((sk) => (
              <label key={sk.id}>
                <Checkbox
                  disabled={busy}
                  checked={ids.includes(sk.id)}
                  onCheckedChange={(v) =>
                    setIds(
                      v ? [...ids, sk.id] : ids.filter((id) => id !== sk.id),
                    )
                  }
                />
                {sk.displayName}
              </label>
            ))}
          </div>
        </div>
        <div className="test-run-settings">
          <label>
            {t("使用同一测试集", "Shared test suite")}
            <Pick
              value={source}
              onChange={setSource}
              label="Test suite"
              items={skills.map((s) => ({
                value: s.id,
                label: `${s.displayName} (${s.tests.length})`,
              }))}
            />
          </label>
          <label>
            {t("评估模式", "Evaluation mode")}
            <Pick
              value={mode}
              onChange={(v) => {
                setMode(v as TestMode);
                setBatch([]);
              }}
              label="Evaluation mode"
              items={[
                { value: "rule", label: "Rule Evaluation" },
                { value: "mock", label: "Mock Evaluation" },
                { value: "llm", label: "LLM Evaluation" },
              ]}
            />
          </label>
          <button className="primary" disabled={busy} onClick={run}>
            <Play size={16} />
            {busy
              ? t("正在运行…", "Running…")
              : t("运行对比", "Run comparison")}
          </button>
        </div>
        <p className="notice">
          {mode === "rule"
            ? t(
                "规则模式：检查 Skill 文本是否包含断言内容、是否存在指定章节。不会执行测试输入，也不判断真实任务效果。",
                "Rule mode checks instruction text and required sections; it does not execute the test input or evaluate real task performance.",
              )
            : mode === "mock"
              ? t(
                  "模拟模式：回放第一个示例，状态为 skipped；不计算通过率。",
                  "Mock mode replays the first example, marks it skipped and provides no pass rate.",
                )
              : t(
                  "模型模式：会向设置中的接口发送 Skill 与测试输入，并调用模型评审结果，可能产生费用。无工具执行；模型评审可能出错。",
                  "LLM mode sends the skill and test inputs to your provider and uses a model judge. May incur costs. No tools are executed; the judge can be wrong.",
                )}
        </p>
      </div>
      <div className="surface comparison">
        <h3>
          <FlaskConical size={17} />
          {t("当前轮次比较", "Current run comparison")}
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Skill",
                t("通过 / 已评估", "Passed / evaluated"),
                "Tokens",
                t("耗时", "Duration"),
                t("工具调用", "Tool calls"),
                t("指令字符", "Characters"),
                t("错误", "Errors"),
                t("质量分", "Quality"),
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  {r.evaluated ? `${r.passed} / ${r.evaluated}` : "—"}
                </TableCell>
                <TableCell>{r.tokens ?? "N/A"}</TableCell>
                <TableCell>{batch.length ? `${r.duration} ms` : "—"}</TableCell>
                <TableCell>0</TableCell>
                <TableCell>{r.length.toLocaleString()}</TableCell>
                <TableCell>{r.errors}</TableCell>
                <TableCell>{r.quality}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="small muted">
          {t(
            "耗时为本次客户端测量；规则检查耗时不是 Agent 性能基准。Token 未返回时显示 N/A。",
            "Duration is measured client-side for this run. Rule-check duration is not an agent benchmark. Unreported tokens display N/A.",
          )}
        </p>
      </div>
      <div className="surface">
        <h3>{t("测试集与新增用例", "Test suite & new case")}</h3>
        {s?.tests.map((c) => (
          <details className="test-case" key={c.id}>
            <summary>
              {c.name}
              <span className="mono">{c.assertions.length} rules</span>
            </summary>
            <p>
              <strong>Input:</strong> {c.input}
            </p>
            <p>
              <strong>Expected:</strong> {c.expectedBehavior}
            </p>
            <pre>{JSON.stringify(c.assertions, null, 2)}</pre>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                onChange({ ...s, tests: s.tests.filter((t) => t.id !== c.id) })
              }
            >
              {t("移除用例", "Remove case")}
            </button>
          </details>
        ))}
        <div className="form-row">
          {(
            [
              "name",
              "input",
              "expectedBehavior",
              "expectedOutput",
              "contains",
            ] as const
          ).map((k) => (
            <label key={k}>
              {
                {
                  name: t("名称", "Name"),
                  input: t("输入", "Input"),
                  expectedBehavior: t("预期行为", "Expected behavior"),
                  expectedOutput: t(
                    "预期输出 · 可选",
                    "Expected output · optional",
                  ),
                  contains: t(
                    "文本包含规则 · 可选",
                    "Contains assertion · optional",
                  ),
                }[k]
              }
              <textarea
                value={test[k]}
                onChange={(e) => setTest({ ...test, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button disabled={busy} className="secondary" onClick={add}>
          <Plus size={15} />
          {t("添加测试用例", "Add test case")}
        </button>
      </div>
      <div className="surface">
        <div className="spread">
          <h3>{t("执行记录", "Execution history")}</h3>
          <span className="badge">{results.length}</span>
        </div>
        {[...batch].reverse().map((r) => (
          <details className="test-case" key={r.id}>
            <summary>
              <span className={"result-status " + r.status}>{r.status}</span>
              {skills.find((s) => s.id === r.skillId)?.displayName}
              <span className="mono">{r.duration} ms</span>
            </summary>
            <p className="small muted">
              {r.mode} · {r.model} · {r.createdAt}
            </p>
            <p>{r.notes}</p>
            <pre>{r.result}</pre>
          </details>
        ))}
        {!batch.length && (
          <p className="muted">
            {t(
              "运行后在此查看每项结果。历史记录可导出为 JSON。",
              "Run a comparison to inspect individual results. Export JSON for the saved history.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
