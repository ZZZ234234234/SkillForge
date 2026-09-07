"use client";
import {
  ShieldCheck,
  CircleCheck,
  AlertTriangle,
  ChevronDown,
  CircleHelp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { scoreSkill } from "../features/inspector/engine";
import type { Skill, Language } from "../types/skill";
import { words } from "./controls";
export function Inspector({ skill, lang }: { skill: Skill; lang: Language }) {
  const t = words(lang),
    score = scoreSkill(skill),
    issues = score.findings.filter((f) => f.severity !== "Pass");
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <ShieldCheck size={16} />
        <strong>{t("质量检查", "Inspector")}</strong>
        <span className="mono">LIVE</span>
      </div>
      <div className="inspector-inner">
        <p className="eyebrow">SKILL QUALITY</p>
        <div className="score-block">
          <span className="score-number">{score.overall}</span>
          <span className="muted">/ 100</span>
          <span className="score-label">
            {score.overall >= 85
              ? t("结构良好", "Well structured")
              : t("需要完善", "Needs attention")}
          </span>
        </div>
        <p className="muted small">
          {t(
            "启发式评分，用于辅助开发，不代表绝对质量或安全保证。",
            "Quality Score is heuristic and intended as a development aid.",
          )}
        </p>
        <div className="dimensions">
          {Object.entries(score.dimensions).map(([k, v]) => (
            <div key={k}>
              <div className="spread small">
                <span>
                  {
                    (
                      {
                        Clarity: t("清晰度", k),
                        Completeness: t("完整性", k),
                        "Tool Safety": t("工具安全", k),
                        Workflow: t("工作流程", k),
                        "Error Handling": t("错误处理", k),
                        Testability: t("可测试性", k),
                        Portability: t("可移植性", k),
                        Maintainability: t("可维护性", k),
                        Documentation: t("文档", k),
                      } as Record<string, string>
                    )[k]
                  }
                </span>
                <span className="mono">{v}</span>
              </div>
              <Progress value={v} aria-label={k} />
            </div>
          ))}
        </div>
        <div className="spread section-label">
          <strong>{t("检查结果", "Findings")}</strong>
          <span className="badge">
            {issues.length} {t("项建议", "to review")}
          </span>
        </div>
        {[
          ...issues,
          ...score.findings.filter((f) => f.severity === "Pass"),
        ].map((f) => (
          <details className={"finding " + f.severity.toLowerCase()} key={f.id}>
            <summary>
              {f.severity === "Pass" ? (
                <CircleCheck size={15} />
              ) : f.severity === "Suggestion" ? (
                <CircleHelp size={15} />
              ) : (
                <AlertTriangle size={15} />
              )}
              <span>{lang === "zh" ? f.zh : f.message}</span>
              <ChevronDown size={12} />
            </summary>
            <p>
              {f.severity} · {f.detail}
            </p>
          </details>
        ))}
        <p className="small muted">
          {t(
            "冲突和模糊性检查使用有限的文本规则。通过检查仍需人工审阅。",
            "Conflict and ambiguity checks use limited text rules. Passing still requires human review.",
          )}
        </p>
      </div>
    </aside>
  );
}
