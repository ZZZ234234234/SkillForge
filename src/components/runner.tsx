"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Paperclip,
  X,
  Download,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AgentFile,
  AgentStep,
  AgentTrace,
  PermissionKind,
} from "../types/agent";
import type { Language, ModelSettings, Skill } from "../types/skill";
import {
  bindTools,
  createRuntimeTools,
  runSkill,
} from "../features/agent/runtime";
import { Pick, words, download } from "./controls";
import { useConfirm } from "./confirm";
const MAX_FILES = 10,
  MAX_FILE_CHARS = 200_000;
export function StepList({ steps }: { steps: AgentStep[] }) {
  return (
    <>
      {steps.map((s) => (
        <details className="trace-step" key={s.id} open={s.status !== "ok"}>
          <summary>
            <span className="muted">#{s.index}</span>
            <span className="tool-name">{s.tool}</span>
            <span className={"step-status " + s.status}>{s.status}</span>
            <span className={"step-decision " + s.decision}>{s.decision}</span>
            <span className={"perm-badge " + s.kind}>{s.kind}</span>
            <span className="ms">{s.ms} ms</span>
          </summary>
          <pre>{s.args}</pre>
          <pre>{s.result}</pre>
        </details>
      ))}
    </>
  );
}
export function Runner({
  lang,
  skills,
  settings,
}: {
  lang: Language;
  skills: Skill[];
  settings: ModelSettings;
}) {
  const t = words(lang);
  const { confirm, dialog } = useConfirm(lang);
  const [skillId, setSkillId] = useState(skills[0]?.id ?? ""),
    [input, setInput] = useState(""),
    [files, setFiles] = useState<AgentFile[]>([]),
    [live, setLive] = useState<AgentTrace | null>(null),
    [steps, setSteps] = useState<AgentStep[]>([]),
    [run, setRun] = useState<Awaited<ReturnType<typeof runSkill>> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null),
    picker = useRef<HTMLInputElement>(null);
  const skill = skills.find((s) => s.id === skillId) ?? skills[0];
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  const tools = useMemo(
    () => createRuntimeTools({ files, skills }),
    [files, skills],
  );
  const bindings = useMemo(
    () => (skill ? bindTools(skill, tools) : []),
    [skill, tools],
  );
  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        toast.error(t("最多附加 10 个文件", "Up to 10 files"));
        break;
      }
      if (f.size > 2_000_000) {
        toast.error(`${f.name}: ${t("超过 2 MB", "exceeds 2 MB")}`);
        continue;
      }
      if (next.some((x) => x.name === f.name)) continue;
      try {
        const content = (await f.text()).slice(0, MAX_FILE_CHARS);
        next.push({ name: f.name, content });
      } catch {
        toast.error(
          `${f.name}: ${t("无法读取为文本", "cannot be read as text")}`,
        );
      }
    }
    setFiles(next);
    if (picker.current) picker.current.value = "";
  };
  const start = async () => {
    if (!skill) return;
    if (!input.trim())
      return toast.error(t("先描述这次任务", "Describe the task first"));
    if (!settings.model.trim())
      return toast.error(
        t("请先在设置中填写模型名称", "Enter a model ID in Settings first"),
      );
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    setRun(null);
    setError("");
    setLive(null);
    setSteps([]);
    try {
      const r = await runSkill({
        skill,
        input,
        files,
        skills,
        settings,
        confirm,
        signal: ac.signal,
        onEvent: (trace) => {
          setLive(trace);
          setSteps(trace.steps);
        },
      });
      setRun(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };
  const trace = run?.trace ?? live;
  const statusLabel = {
    running: t("执行中", "Running"),
    done: t("已完成", "Done"),
    stopped: t("已停止", "Stopped"),
    error: t("出错", "Error"),
  };
  const decision = (b: (typeof bindings)[number]) =>
    b.runtime.length
      ? b.runtime
          .map((n) => {
            const k = tools.find((x) => x.name === n)?.kind;
            return k === "read"
              ? b.broad
                ? t(
                    "只读 · 权限声明过宽，逐次确认",
                    "read · broad declaration, confirmed each time",
                  )
                : t("只读 · 自动放行", "read · automatic")
              : k === "network"
                ? t("联网 · 每次确认", "network · confirmed")
                : t("写入 · 每次确认", "write · confirmed");
          })
          .join("；")
      : b.note === "permission-mismatch"
        ? t(
            "未绑定：声明的权限不覆盖这个操作",
            "not bound: the declared permission does not cover it",
          )
        : t(
            "未绑定：浏览器运行时无法执行",
            "not bound: not executable in the browser runtime",
          );
  const kindOf = (b: (typeof bindings)[number]): PermissionKind =>
    tools.find((x) => x.name === b.runtime[0])?.kind ?? "write";
  return (
    <div className="tool-page">
      <p className="eyebrow">RUN THE SKILL. WATCH EVERY CALL.</p>
      <h1>{t("Agent 试运行", "Agent Run")}</h1>
      <p className="muted">
        {t(
          "选一个技能、给出任务，Agent 按技能的工作流真实执行：每次工具调用、每次授权都记录在轨迹里。",
          "Pick a skill and a task. The agent executes the skill's workflow for real, and every tool call and approval is recorded in the trace.",
        )}
      </p>
      <div className="runner-layout">
        <div>
          <div className="surface runner-input">
            <h3>
              <Play size={17} />
              {t("任务", "Task")}
            </h3>
            <label>
              {t("执行的技能", "Skill to run")}
              <Pick
                value={skill?.id ?? ""}
                onChange={setSkillId}
                label="Skill"
                items={skills.map((s) => ({
                  value: s.id,
                  label: s.displayName,
                }))}
              />
            </label>
            <textarea
              aria-label="Task"
              placeholder={t(
                "例如：审查下面这个组件，指出渲染期的副作用和无障碍问题。",
                "For example: review the component below for render-time side effects and accessibility problems.",
              )}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {files.length > 0 && (
              <div className="file-chips">
                {files.map((f) => (
                  <span className="file-chip" key={f.name}>
                    <Paperclip size={12} />
                    {f.name}
                    <button
                      aria-label="Remove file"
                      onClick={() =>
                        setFiles(files.filter((x) => x.name !== f.name))
                      }
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="runner-actions">
              <input
                ref={picker}
                hidden
                type="file"
                multiple
                onChange={(e) => attach(e.target.files)}
              />
              <button
                className="secondary"
                disabled={busy}
                onClick={() => picker.current?.click()}
              >
                <Paperclip size={15} />
                {t("附加材料文件", "Attach files")}
              </button>
              {busy ? (
                <button
                  className="secondary stop-button"
                  onClick={() => abort.current?.abort()}
                >
                  <Square size={15} />
                  {t("停止", "Stop")}
                </button>
              ) : (
                <button className="primary" onClick={start}>
                  <Play size={16} />
                  {t("开始运行", "Run")}
                </button>
              )}
            </div>
            <p className="notice">
              {t(
                "会把你配置的模型、技能说明、任务与材料文件发送到设置中的接口，可能产生费用。只读工具自动放行；写入与联网工具每次都会先问你。Agent 不能执行 shell 命令，也不能改动你电脑上的文件。",
                "Sends the configured model, the skill, the task and attached files to your provider; may incur costs. Read-only tools run automatically; write and network tools ask first. The agent cannot run shell commands or change files on your computer.",
              )}
            </p>
            {error && <p className="run-error">{error}</p>}
          </div>
          {skill && (
            <div className="surface">
              <h3>
                <ShieldCheck size={17} />
                {t("工具与权限判定", "Tools & permissions")}
              </h3>
              {skill.tools.length ? (
                <table className="binding-table">
                  <thead>
                    <tr>
                      <th>{t("技能声明的工具", "Declared tool")}</th>
                      <th>{t("运行时绑定", "Runtime binding")}</th>
                      <th>{t("判定", "Decision")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bindings.map((b) => (
                      <tr key={b.declared.name}>
                        <td>
                          <strong>{b.declared.name}</strong>
                          <br />
                          <span className="muted">
                            {b.declared.permissions}
                          </span>
                        </td>
                        <td>
                          {b.runtime.length ? (
                            b.runtime.map((n) => (
                              <span
                                className={"perm-badge " + kindOf(b)}
                                key={n}
                              >
                                {n}
                              </span>
                            ))
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>{decision(b)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">
                  {t(
                    "这个技能没有声明工具，Agent 只能依据任务输入作答。",
                    "This skill declares no tools, so the agent answers from the task input alone.",
                  )}
                </p>
              )}
              <p className="small muted">
                {t(
                  "判定依据技能里写的 permissions：只读自动放行，写入与联网逐次确认；声明过宽（通配符、无限制、sudo）时即使是只读也会逐次确认。对不上的工具如实标为未绑定，不会假装执行。",
                  "Decisions come from the skill's permissions text: read-only runs automatically, write and network are confirmed each time, and broad declarations are confirmed even when read-only. Unmatched tools are reported as not bound, never simulated.",
                )}
              </p>
            </div>
          )}
        </div>
        <div>
          <div className="surface">
            <div className="spread">
              <h3>
                <FileText size={17} />
                {t("执行轨迹", "Trace")}
              </h3>
              {trace && (
                <span className={"run-status " + trace.status}>
                  {statusLabel[trace.status]}
                </span>
              )}
            </div>
            {trace?.reason && <p className="small muted">{trace.reason}</p>}
            {steps.length ? (
              <StepList steps={steps} />
            ) : (
              <p className="muted">
                {t(
                  "运行后，每一步工具调用、授权结果与耗时都会显示在这里。",
                  "After a run, every tool call, approval and duration appears here.",
                )}
              </p>
            )}
          </div>
          {run && (
            <div className="surface">
              <h3>{t("结果", "Result")}</h3>
              <div className="run-summary">
                <span>
                  {t("工具调用", "Tool calls")}{" "}
                  <strong>{run.trace.steps.length}</strong>
                </span>
                <span>
                  {t("已授权", "Approved")}{" "}
                  <strong>
                    {
                      run.trace.steps.filter((s) => s.decision === "confirmed")
                        .length
                    }
                  </strong>
                </span>
                <span>
                  Tokens <strong>{run.trace.tokens ?? "N/A"}</strong>
                </span>
                <span>
                  {t("耗时", "Duration")} <strong>{run.durationMs} ms</strong>
                </span>
              </div>
              {run.trace.output ? (
                <pre className="run-output">{run.trace.output}</pre>
              ) : (
                <p className="muted">
                  {t(
                    "模型没有给出最终回复。",
                    "The model produced no final answer.",
                  )}
                </p>
              )}
              {run.artifacts.length > 0 && (
                <div className="artifacts">
                  {run.artifacts.map((a) => (
                    <button
                      className="secondary"
                      key={a.name}
                      onClick={() => download(a.name, a.content, "text/plain")}
                    >
                      <Download size={14} />
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="text-button"
                onClick={() =>
                  download(
                    "skillforge-agent-run.json",
                    JSON.stringify(run, null, 2),
                    "application/json",
                  )
                }
              >
                <Download size={14} />
                {t("下载完整记录（JSON）", "Download full record (JSON)")}
              </button>
            </div>
          )}
        </div>
      </div>
      {dialog}
    </div>
  );
}
