"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AgentStep } from "../types/agent";
import type { Language, ModelSettings, Skill } from "../types/skill";
import {
  buildStewardSystem,
  createRuntimeTools,
} from "../features/agent/runtime";
import { runAgentLoop } from "../features/agent/loop";
import { words } from "./controls";
import { useConfirm } from "./confirm";
import { StepList } from "./runner";
interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
  status?: string;
}
/**
 * 管家 Agent：用对话管理技能库。
 * 读操作自动执行；create_skill / update_skill 每次都要用户确认，拒绝后模型会如实得知。
 */
export function Steward({
  lang,
  skills,
  settings,
  onAdd,
  onChange,
  onOpen,
}: {
  lang: Language;
  skills: Skill[];
  settings: ModelSettings;
  onAdd: (s: Skill) => void;
  onChange: (s: Skill) => void;
  onOpen: (s: Skill) => void;
}) {
  const t = words(lang);
  const { confirm, dialog } = useConfirm(lang);
  const [turns, setTurns] = useState<Turn[]>([]),
    [input, setInput] = useState(""),
    [live, setLive] = useState<AgentStep[]>([]),
    [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null),
    latest = useRef(skills),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    latest.current = skills;
  }, [skills]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [turns, live]);
  const tools = () =>
    createRuntimeTools({
      files: [],
      // 循环内刚创建的技能也要能被后续工具看到
      get skills() {
        return latest.current;
      },
      createSkill: (draft) => {
        latest.current = [draft, ...latest.current];
        onAdd(draft);
      },
      updateSkill: (skill) => {
        latest.current = latest.current.map((s) =>
          s.id === skill.id ? skill : s,
        );
        onChange(skill);
      },
    });
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!settings.model.trim())
      return toast.error(
        t("请先在设置中填写模型名称", "Enter a model ID in Settings first"),
      );
    const history = turns.map((x) => ({ role: x.role, content: x.content }));
    setTurns((all) => [...all, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    setLive([]);
    const ac = new AbortController();
    abort.current = ac;
    try {
      const trace = await runAgentLoop({
        system: buildStewardSystem(),
        input: text,
        history,
        tools: tools(),
        settings,
        confirm,
        signal: ac.signal,
        onEvent: (tr) => setLive(tr.steps),
        maxSteps: 10,
      });
      setTurns((all) => [
        ...all,
        {
          role: "assistant",
          content:
            trace.output ||
            (trace.status === "stopped"
              ? t("已停止，未产生回复。", "Stopped before a reply.")
              : t("没有拿到回复：", "No reply: ") + trace.reason),
          steps: trace.steps,
          status: trace.status,
        },
      ]);
    } finally {
      setBusy(false);
      setLive([]);
      abort.current = null;
    }
  };
  const suggestions =
    lang === "zh"
      ? [
          "帮我找一个能审查 SQL 的技能",
          "创建一个检查 Git 提交信息的技能",
          "检查 React Code Reviewer 有哪些问题，并补上错误处理",
        ]
      : [
          "Find a skill that reviews SQL",
          "Create a skill that checks Git commit messages",
          "Inspect React Code Reviewer and add failure handling",
        ];
  return (
    <div className="tool-page steward-page">
      <p className="eyebrow">TALK TO YOUR LIBRARY</p>
      <h1>{t("管家 Agent", "Steward Agent")}</h1>
      <p className="muted">
        {t(
          "用对话管理技能库：检索、查看、检查、新建和修改技能。改动技能库的操作每次都会先征求你的确认。",
          "Manage the library by conversation: search, read, inspect, create and update skills. Every library change asks for your approval first.",
        )}
      </p>
      <div className="steward-chat">
        {!turns.length && (
          <div className="chat-empty">
            <Bot size={26} />
            <p>
              {t(
                "我会通过工具操作你的技能库。例如：",
                "I operate your library through tools. For example:",
              )}
            </p>
            <div
              className="prompt-examples"
              style={{ justifyContent: "center" }}
            >
              {suggestions.map((s) => (
                <button key={s} onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((m, i) => (
          <div className="chat-turn" key={i}>
            {m.role === "user" ? (
              <div className="chat-user">{m.content}</div>
            ) : (
              <div className="chat-assistant">
                {m.steps && m.steps.length > 0 && <StepList steps={m.steps} />}
                <div className="chat-assistant-text">{m.content}</div>
                {m.steps?.some(
                  (s) => s.status === "ok" && s.tool === "create_skill",
                ) && (
                  <button
                    className="text-button"
                    onClick={() => {
                      const created = skills.find(
                        (s) =>
                          s.status === "Draft" &&
                          m.steps?.some(
                            (x) => x.status === "ok" && x.result.includes(s.id),
                          ),
                      );
                      if (created) onOpen(created);
                      else
                        toast.error(
                          t("没有找到刚创建的技能", "Created skill not found"),
                        );
                    }}
                  >
                    <Sparkles size={13} />
                    {t("打开刚创建的技能", "Open the created skill")}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-turn">
            <div className="chat-assistant">
              {live.length ? (
                <StepList steps={live} />
              ) : (
                <p className="muted">{t("思考中…", "Thinking…")}</p>
              )}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="chat-composer">
        <textarea
          aria-label="Message"
          placeholder={t("想让管家做什么？", "What should the steward do?")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <button
            className="secondary stop-button"
            onClick={() => abort.current?.abort()}
          >
            <Square size={15} />
            {t("停止", "Stop")}
          </button>
        ) : (
          <button className="primary" onClick={send} disabled={!input.trim()}>
            <Send size={15} />
            {t("发送", "Send")}
          </button>
        )}
      </div>
      <p className="small muted">
        {t(
          "对话会发送到你配置的模型接口，可能产生费用。新建的技能是草稿状态，修改会直接写入技能库（经你确认）。",
          "Messages go to your configured provider and may incur costs. Created skills are Drafts; updates are written to the library after your approval.",
        )}
      </p>
      {dialog}
    </div>
  );
}
