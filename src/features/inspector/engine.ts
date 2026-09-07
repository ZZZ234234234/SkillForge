import type { Skill } from "../../types/skill";
export interface Finding {
  id: string;
  severity: "Critical" | "Warning" | "Suggestion" | "Pass";
  message: string;
  zh: string;
  detail: string;
  dimension: string;
}
const secretPatterns = [
  /\bsk-[a-zA-Z0-9_-]{12,}\b/g,
  /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/gi,
  /\b(?:password|token|api[_-]?key|cookie|authorization)\s*[:=]\s*["']?(?!\[REDACTED\]|<|\$\{|YOUR_|process\.env|example)[^\s"',;}{]{6,}/gi,
];
export function detectSecrets(text: string) {
  return secretPatterns.flatMap((p, i) =>
    Array.from(text.matchAll(new RegExp(p.source, p.flags))).map((m) => ({
      pattern: i,
      index: m.index ?? 0,
      length: m[0].length,
    })),
  );
}
export function redactSecrets(text: string) {
  return secretPatterns.reduce(
    (s, p) => s.replace(new RegExp(p.source, p.flags), "[REDACTED]"),
    text,
  );
}
export function inspectSkill(s: Skill): Finding[] {
  const f: Finding[] = [];
  const check = (
    id: string,
    ok: boolean,
    severity: Finding["severity"],
    message: string,
    zh: string,
    detail: string,
    dimension: string,
  ) =>
    f.push({
      id,
      severity: ok ? "Pass" : severity,
      message: ok ? `${message} — checked` : message,
      zh: ok ? `${zh}：已满足` : zh,
      detail,
      dimension,
    });
  check(
    "goals",
    s.goals.some((g) => g.trim().length >= 15),
    "Warning",
    "Define a concrete goal",
    "需要明确的任务目标",
    "At least one goal with 15 characters; length is a proxy, not semantic proof.",
    "Clarity",
  );
  check(
    "description",
    s.description.length >= 30,
    "Suggestion",
    "Describe the trigger and outcome",
    "说明触发场景和预期结果",
    "Description has at least 30 characters.",
    "Clarity",
  );
  check(
    "role",
    s.role.length >= 10,
    "Warning",
    "Define the role",
    "定义专业角色",
    "Role contains at least 10 characters.",
    "Completeness",
  );
  check(
    "instructions",
    s.instructions.length >= 50,
    "Warning",
    "Provide actionable instructions",
    "补充可执行的说明",
    "Instructions contain at least 50 characters.",
    "Completeness",
  );
  check(
    "workflow",
    s.workflow.filter((x) => x.trim()).length >= 3,
    "Warning",
    "Structure the workflow",
    "工作流至少包含三个步骤",
    "Three or more nonempty steps.",
    "Workflow",
  );
  check(
    "tools",
    s.tools.every((t) => t.description.trim() && t.permissions.trim()),
    "Warning",
    "Explain tool usage and permissions",
    "补全工具用途与权限",
    "Every declared tool needs a description and scope; no tools is allowed.",
    "Tool Safety",
  );
  check(
    "broad-tools",
    !s.tools.some((t) =>
      /\*|unrestricted|all access|full access|sudo|全部权限|无限制/i.test(
        t.permissions,
      ),
    ),
    "Critical",
    "Tool permissions may be too broad",
    "工具权限可能过宽",
    "Detects wildcard, unrestricted, sudo and full-access phrases.",
    "Tool Safety",
  );
  check(
    "constraints",
    s.constraints.length > 0,
    "Warning",
    "Add explicit constraints",
    "缺少明确约束",
    "At least one constraint.",
    "Tool Safety",
  );
  check(
    "secrets",
    detectSecrets(JSON.stringify(s)).length === 0,
    "Critical",
    "Potential Secret Detected",
    "检测到疑似敏感信息",
    "Pattern detection only; manual review is still necessary.",
    "Tool Safety",
  );
  check(
    "errors",
    s.errorHandling.trim().length >= 25,
    "Warning",
    "Missing failure handling",
    "缺少失败处理",
    "Failure handling should explain what to do when blocked.",
    "Error Handling",
  );
  check(
    "output",
    s.outputFormat.length >= 15,
    "Warning",
    "Output format is not defined",
    "未定义输出格式",
    "Output format contains at least 15 characters.",
    "Testability",
  );
  check(
    "tests",
    s.tests.length > 0 && s.tests.every((t) => t.input && t.expectedBehavior),
    "Warning",
    "Add meaningful test cases",
    "补充输入与预期行为测试",
    "At least one test with input and expected behavior.",
    "Testability",
  );
  check(
    "assertions",
    s.tests.some((t) => t.assertions.length > 0),
    "Suggestion",
    "Add executable rule assertions",
    "添加可执行规则断言",
    "Assertions inspect skill text, not agent behavior.",
    "Testability",
  );
  check(
    "examples",
    s.examples.some((e) => e.input && e.output),
    "Warning",
    "Add an input/output example",
    "补充输入输出示例",
    "At least one complete example.",
    "Documentation",
  );
  check(
    "compatibility",
    s.compatibility.length > 0 &&
      !s.compatibility.some(
        (c) =>
          ![
            "Generic",
            "Codex",
            "Claude Code",
            "OpenAI Agents SDK",
            "MCP",
          ].includes(c),
      ),
    "Warning",
    "Review platform compatibility",
    "检查平台兼容标记",
    "SDK and MCP export are experimental instruction bundles.",
    "Portability",
  );
  check(
    "platform-fields",
    !Object.keys(s.metadata).some((k) =>
      ["allowed-tools", "model", "context", "agent", "hooks"].includes(k),
    ),
    "Suggestion",
    "Platform-specific fields require review",
    "平台专有字段需要人工检查",
    "Host-specific metadata is preserved in JSON but not promoted to portable frontmatter.",
    "Portability",
  );
  check(
    "version",
    /^\d+\.\d+\.\d+/.test(s.version) && !!s.author && !!s.license,
    "Warning",
    "Document ownership and version",
    "补全作者、版本和许可证",
    "Semantic version, author and license are present.",
    "Maintainability",
  );
  const lines = s.instructions
    .split("\n")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 15);
  check(
    "duplicates",
    new Set(lines).size === lines.length,
    "Suggestion",
    "Repeated instructions",
    "存在重复说明",
    "Exact repeated lines longer than 15 characters.",
    "Maintainability",
  );
  check(
    "length",
    s.instructions.length < 20000,
    "Suggestion",
    "Instructions may be too long",
    "说明可能过于冗长",
    "20,000-character threshold; move reference material to separate files.",
    "Maintainability",
  );
  check(
    "vague",
    !/\b(?:do your best|as needed|whatever|etc\.)|酌情处理|尽量做好/i.test(
      s.instructions,
    ),
    "Suggestion",
    "Replace vague wording",
    "替换模糊措辞",
    "Limited phrase matching, not a language-model assessment.",
    "Clarity",
  );
  const whole = [s.instructions, ...s.constraints].join("\n");
  check(
    "conflict",
    !(
      /always (?:use|run) ([\w-]+)/i.exec(whole)?.[1] &&
      new RegExp(
        `never (?:use|run) ${/always (?:use|run) ([\w-]+)/i.exec(whole)?.[1]}`,
        "i",
      ).test(whole)
    ),
    "Warning",
    "Possible conflicting instructions",
    "可能存在冲突说明",
    "Detects simple English always/never pairs; cannot prove consistency.",
    "Workflow",
  );
  return f;
}
export function scoreSkill(s: Skill) {
  const findings = inspectSkill(s);
  const dimensions = Object.fromEntries(
    [
      "Clarity",
      "Completeness",
      "Tool Safety",
      "Workflow",
      "Error Handling",
      "Testability",
      "Portability",
      "Maintainability",
      "Documentation",
    ].map((d) => {
      const a = findings.filter((f) => f.dimension === d);
      return [
        d,
        Math.round(
          (100 * a.filter((f) => f.severity === "Pass").length) / a.length,
        ),
      ];
    }),
  );
  return {
    overall: Math.round(
      Object.values(dimensions).reduce((a, b) => a + b, 0) / 9,
    ),
    dimensions,
    findings,
  };
}
