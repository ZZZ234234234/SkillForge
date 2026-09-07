"use client";
import { useState } from "react";
import {
  WandSparkles,
  ArrowRight,
  RefreshCw,
  Check,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { Skill, Language, ModelSettings } from "../types/skill";
import {
  templateSkill,
  generateSkill,
  refineTemplate,
} from "../features/generator/service";
import { skillMarkdown } from "../features/skills/parser";
import { Inspector } from "./inspector";
import { Pick, words } from "./controls";
export function Generator({
  lang,
  settings,
  onSave,
}: {
  lang: Language;
  settings: ModelSettings;
  onSave: (s: Skill) => void;
}) {
  const t = words(lang),
    [prompt, setPrompt] = useState(""),
    [mode, setMode] = useState("template"),
    [skill, setSkill] = useState<Skill | null>(null),
    [busy, setBusy] = useState(false),
    [section, setSection] = useState("instructions");
  const run = async (action = "Generate") => {
    if (!prompt.trim())
      return toast.error(t("先描述你的任务", "Describe your task first"));
    setBusy(true);
    try {
      const s =
        mode === "llm"
          ? (
              await generateSkill(
                prompt,
                settings,
                skill ?? undefined,
                action,
                section,
              )
            ).skill
          : skill && action !== "Generate"
            ? refineTemplate(skill, action, section)
            : templateSkill(prompt);
      setSkill(s);
      toast.success(
        mode === "llm"
          ? t(
              "模型生成完成，请审阅",
              "Model generation complete; review the result",
            )
          : t(
              "离线模板已生成，请审阅",
              "Offline template prepared; review the result",
            ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="tool-page">
      <p className="eyebrow">IDEA → INSTRUCTIONS → SKILL</p>
      <h1>{t("Skill 生成器", "Skill Generator")}</h1>
      <p className="muted">
        {t(
          "描述你需要的专业能力，再逐步打磨成可复用的工作说明。",
          "Describe the capability you need, then refine it into a reusable playbook.",
        )}
      </p>
      <div className="generator-layout">
        <div>
          <div className="surface generator-input">
            <div className="spread">
              <h3>
                <WandSparkles size={18} />
                {t("你想创建什么？", "What do you want to build?")}
              </h3>
              <Pick
                value={mode}
                onChange={setMode}
                label="Generation mode"
                items={[
                  {
                    value: "template",
                    label: t("离线模板 · 非 AI", "Offline template · not AI"),
                  },
                  {
                    value: "llm",
                    label: t("AI 模型生成", "AI model generation"),
                  },
                ]}
              />
            </div>
            <textarea
              aria-label="Skill request"
              placeholder={t(
                "例如：帮我创建一个专门检查 Next.js 项目的 Skill，关注服务端与客户端边界和安全问题。",
                "Create a Next.js code review skill focused on server/client boundaries and security.",
              )}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="prompt-examples">
              {[
                "Create a Next.js code review skill",
                "Build an academic research assistant",
                "Review GitHub release security",
              ].map((p) => (
                <button key={p} onClick={() => setPrompt(p)}>
                  {p}
                  <ArrowRight size={12} />
                </button>
              ))}
            </div>
            <p className="small muted">
              {mode === "llm"
                ? t(
                    "点击后会把任务和当前 Skill 发送到设置中的模型接口，可能产生费用。密钥仅保留在内存中。",
                    "Clicking sends your request and current skill to the configured provider and may incur costs. Your key stays in memory.",
                  )
                : t(
                    "离线模式根据模板建立结构，不会调用模型。AI 生成请先配置接口并切换模式。",
                    "Offline mode uses a deterministic template, with no model call. Configure a provider to use AI generation.",
                  )}
            </p>
            <button className="primary" disabled={busy} onClick={() => run()}>
              {busy ? (
                <RefreshCw size={16} className="spin" />
              ) : (
                <WandSparkles size={16} />
              )}{" "}
              {busy
                ? t("正在生成…", "Generating…")
                : t("生成 Skill", "Generate Skill")}
            </button>
          </div>
          {skill && (
            <div className="surface generated-review">
              <div className="spread">
                <h3>
                  <FileText size={17} />
                  {t("审阅生成结果", "Review Generated Skill")}
                </h3>
                <span className="badge">
                  {mode === "llm" ? "AI-generated" : "Offline template"}
                </span>
              </div>
              <div className="refine-actions">
                {[
                  ["Improve", "改进"],
                  ["Simplify", "精简"],
                  ["Make More Strict", "更严格"],
                  ["Add Tests", "添加测试"],
                  ["Add Failure Handling", "添加错误处理"],
                ].map(([a, z]) => (
                  <button
                    className="secondary"
                    key={a}
                    disabled={busy}
                    onClick={() => run(a)}
                  >
                    {t(z, a)}
                  </button>
                ))}
                <Pick
                  label="Section"
                  value={section}
                  onChange={setSection}
                  items={[
                    "instructions",
                    "role",
                    "errorHandling",
                    "outputFormat",
                  ]}
                />
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => run("Regenerate Section")}
                >
                  {t("重新生成此节", "Regenerate Section")}
                </button>
              </div>
              <pre>{skillMarkdown(skill)}</pre>
              <button
                className="primary"
                onClick={() =>
                  onSave({
                    ...skill,
                    status: "Draft",
                    metadata: { ...skill.metadata, generation: mode },
                  })
                }
              >
                <Check size={16} />
                {t("保留并进入编辑器", "Keep & open editor")}
              </button>
            </div>
          )}
        </div>
        {skill ? (
          <Inspector skill={skill} lang={lang} />
        ) : (
          <aside className="generator-guide">
            <p className="eyebrow">A GOOD SKILL STARTS HERE</p>
            {[
              [
                t("明确触发场景", "Define the trigger"),
                t(
                  "什么时候使用？解决什么问题？",
                  "When should it activate? What problem does it solve?",
                ),
              ],
              [
                t("描述工作步骤", "Describe the workflow"),
                t(
                  "把专业判断拆解为可执行步骤。",
                  "Break down the professional process into clear steps.",
                ),
              ],
              [
                t("设定边界", "Set boundaries"),
                t(
                  "什么不能做？失败时如何处理？",
                  "What is out of scope? What happens when a step fails?",
                ),
              ],
              [
                t("用例验证", "Verify with examples"),
                t(
                  "好的输入、预期结果和失败用例。",
                  "Include representative inputs, outputs and failure cases.",
                ),
              ],
            ].map(([a, b], i) => (
              <div key={a}>
                <span className="step-number">0{i + 1}</span>
                <h3>{a}</h3>
                <p>{b}</p>
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
