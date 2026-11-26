import type { Skill } from "./skill";
/** 工具的权限类别：只读自动放行；写入与联网需要逐次确认 */
export type PermissionKind = "read" | "write" | "network";
/** 浏览器运行时里真正可执行的工具。没有 shell、没有本地文件系统。 */
export interface RuntimeTool {
  name: string;
  kind: PermissionKind;
  description: string;
  /** JSON Schema 参数定义 */
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string> | string;
}
export interface AgentStep {
  id: string;
  index: number;
  tool: string;
  args: string;
  kind: PermissionKind;
  /** auto = 只读直接放行；confirmed = 用户已确认；denied = 用户拒绝或无确认通道；unavailable = 本次运行没有这个工具 */
  decision: "auto" | "confirmed" | "denied" | "unavailable";
  status: "ok" | "denied" | "error";
  result: string;
  ms: number;
}
export interface AgentTrace {
  steps: AgentStep[];
  /** 模型的最终回复 */
  output: string;
  /** 累计 token；服务商未返回时为 null */
  tokens: number | null;
  status: "running" | "done" | "stopped" | "error";
  /** stopped / error 的原因：aborted、max-steps 或错误信息 */
  reason: string;
}
export interface ConfirmRequest {
  tool: string;
  args: string;
  kind: PermissionKind;
}
export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;
/** 技能声明的工具与运行时工具的绑定结果 */
export interface ToolBinding {
  declared: Skill["tools"][number];
  kind: PermissionKind;
  /** 过宽的权限声明：即使绑定到只读工具也逐次确认 */
  broad: boolean;
  /** 绑定到的运行时工具名；为空表示浏览器运行时无法执行 */
  runtime: string[];
  /** 未绑定或部分绑定的原因 */
  note: string;
}
export interface AgentFile {
  name: string;
  content: string;
}
/** 一次技能试运行的完整记录 */
export interface SkillRun {
  id: string;
  skillId: string;
  skillName: string;
  input: string;
  files: string[];
  bindings: ToolBinding[];
  trace: AgentTrace;
  artifacts: { name: string; content: string }[];
  model: string;
  durationMs: number;
  createdAt: string;
}
