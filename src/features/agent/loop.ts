import type {
  AgentStep,
  AgentTrace,
  ConfirmFn,
  PermissionKind,
  RuntimeTool,
} from "../../types/agent";
import type { ModelSettings } from "../../types/skill";
import { postChat } from "../generator/service";
/** 单次模型调用返回的工具请求 */
export interface ToolRequest {
  id: string;
  name: string;
  args: string;
}
/** 发给模型的对话消息（含工具调用与工具结果） */
export interface LoopMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
}
function parseArgs(text: unknown) {
  if (typeof text !== "string" || !text.trim()) return {};
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
/** 一次带工具定义的模型请求；解析 tool_calls，容错不规范的返回 */
export async function chatWithTools(
  settings: ModelSettings,
  messages: LoopMessage[],
  tools: Pick<RuntimeTool, "name" | "description" | "parameters">[],
  signal?: AbortSignal,
): Promise<{
  content: string;
  toolCalls: ToolRequest[];
  tokens: number | null;
}> {
  const d = await postChat(
    settings,
    {
      model: settings.model,
      messages,
      temperature: 0.2,
      ...(tools.length
        ? {
            tools: tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            })),
            tool_choice: "auto",
          }
        : {}),
    },
    signal,
  );
  const message = d.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content : "";
  const raw = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const toolCalls = raw.flatMap((c) => {
    const call = c as {
      id?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    if (typeof call.function?.name !== "string") return [];
    return [
      {
        id:
          typeof call.id === "string" && call.id
            ? call.id
            : crypto.randomUUID(),
        name: call.function.name,
        args: JSON.stringify(parseArgs(call.function.arguments)),
      },
    ];
  });
  if (!content.trim() && !toolCalls.length)
    throw new Error("Model returned no text");
  return {
    content,
    toolCalls,
    tokens:
      typeof d.usage?.total_tokens === "number" ? d.usage.total_tokens : null,
  };
}
export interface LoopOptions {
  system: string;
  /** 本轮用户消息 */
  input: string;
  /** 之前的对话（只含 user 与 assistant 的最终回复） */
  history?: { role: "user" | "assistant"; content: string }[];
  tools: RuntimeTool[];
  settings: ModelSettings;
  /** 写入 / 联网 / 过宽权限的确认回调；未提供时一律拒绝 */
  confirm?: ConfirmFn;
  signal?: AbortSignal;
  onEvent?: (trace: AgentTrace) => void;
  maxSteps?: number;
  /** 即使是只读工具也要逐次确认的工具名（声明权限过宽时使用） */
  forceConfirm?: string[];
  /** 单条工具结果送入上下文的上限（字符） */
  resultLimit?: number;
}
const DENIED =
  "DENIED: the user did not authorize this operation. Continue without it, or state exactly what is blocked.";
const NOT_AVAILABLE =
  "ERROR: this tool is not available in the current run. Never claim to have used it.";
/**
 * Agent 循环：模型 → 工具调用 → 权限门控 → 执行 → 回灌结果，直到模型给出最终回复。
 * 每一步都写入 trace 并通过 onEvent 推给界面；取消、出错、达到步数上限都会如实记录状态。
 */
export async function runAgentLoop(o: LoopOptions): Promise<AgentTrace> {
  const maxSteps = o.maxSteps ?? 12,
    resultLimit = o.resultLimit ?? 12000,
    forced = new Set(o.forceConfirm ?? []);
  const trace: AgentTrace = {
    steps: [],
    output: "",
    tokens: null,
    status: "running",
    reason: "",
  };
  const emit = () => o.onEvent?.(structuredClone(trace));
  const messages: LoopMessage[] = [
    { role: "system", content: o.system },
    ...(o.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: o.input },
  ];
  emit();
  for (let i = 0; i < maxSteps; i++) {
    if (o.signal?.aborted) {
      trace.status = "stopped";
      trace.reason = "aborted";
      break;
    }
    let res: Awaited<ReturnType<typeof chatWithTools>>;
    try {
      res = await chatWithTools(o.settings, messages, o.tools, o.signal);
    } catch (e) {
      trace.status = o.signal?.aborted ? "stopped" : "error";
      trace.reason = o.signal?.aborted
        ? "aborted"
        : e instanceof Error
          ? e.message
          : "Model request failed";
      break;
    }
    trace.tokens =
      trace.tokens === null
        ? res.tokens
        : res.tokens === null
          ? trace.tokens
          : trace.tokens + res.tokens;
    if (!res.toolCalls.length) {
      trace.output = res.content;
      trace.status = "done";
      break;
    }
    messages.push({
      role: "assistant",
      content: res.content,
      tool_calls: res.toolCalls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: c.args },
      })),
    });
    for (const call of res.toolCalls) {
      const tool = o.tools.find((t) => t.name === call.name);
      const kind: PermissionKind = tool?.kind ?? "write";
      const step: AgentStep = {
        id: crypto.randomUUID(),
        index: trace.steps.length + 1,
        tool: call.name,
        args: call.args.slice(0, 800),
        kind,
        decision: "auto",
        status: "ok",
        result: "",
        ms: 0,
      };
      const started = performance.now();
      let result = "";
      if (!tool) {
        // 不是用户拒绝，而是这次运行里根本没有这个工具：单独标记，避免看成一次授权决定
        step.decision = "unavailable";
        step.status = "error";
        result = NOT_AVAILABLE;
      } else if (tool.kind !== "read" || forced.has(tool.name)) {
        const allowed = o.confirm
          ? await o.confirm({
              tool: tool.name,
              args: call.args,
              kind: tool.kind,
            })
          : false;
        step.decision = allowed ? "confirmed" : "denied";
        // 用户在确认框打开期间点了停止：即使刚点了允许也不执行
        if (allowed && o.signal?.aborted) step.decision = "denied";
        if (step.decision !== "confirmed") {
          step.status = "denied";
          result = DENIED;
        }
      }
      if (step.status === "ok" && tool) {
        try {
          const out = await tool.execute(
            parseArgs(call.args) as Record<string, unknown>,
          );
          result = typeof out === "string" ? out : JSON.stringify(out);
          // 运行时工具用 "ERROR:" 前缀报告失败；这类调用不算成功执行
          if (result.startsWith("ERROR:")) step.status = "error";
        } catch (e) {
          step.status = "error";
          result = `ERROR: ${e instanceof Error ? e.message : "Tool failed"}`;
        }
      }
      step.ms = Math.round(performance.now() - started);
      step.result = result.slice(0, 2000);
      trace.steps.push(step);
      emit();
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.slice(0, resultLimit),
      });
    }
    if (i === maxSteps - 1 && trace.status === "running") {
      trace.status = "stopped";
      trace.reason = "max-steps";
    }
  }
  if (trace.status === "running") {
    trace.status = "stopped";
    trace.reason = "max-steps";
  }
  emit();
  return trace;
}
