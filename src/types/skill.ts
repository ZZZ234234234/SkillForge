export type SkillStatus = "Local" | "Installed" | "Registry" | "Draft";
export interface SkillTest {
  id: string;
  name: string;
  input: string;
  expectedBehavior: string;
  expectedOutput?: string;
  assertions: { kind: "contains" | "notContains" | "section"; value: string }[];
}
export interface Skill {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  license: string;
  tags: string[];
  category: string;
  compatibility: string[];
  role: string;
  goals: string[];
  instructions: string;
  workflow: string[];
  tools: { name: string; permissions: string; description: string }[];
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  errorHandling: string;
  examples: { input: string; output: string }[];
  tests: SkillTest[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: SkillStatus;
  favorite: boolean;
}
export type Language = "zh" | "en";
/** agent = 真实工具调用评测：按技能执行任务，再对真实输出判定断言 */
export type TestMode = "rule" | "mock" | "llm" | "agent";
export interface TestResult {
  id: string;
  skillId: string;
  testId: string;
  mode: TestMode;
  status: "pass" | "fail" | "error" | "skipped";
  duration: number;
  model: string;
  tokens: number | null;
  toolCalls: number;
  result: string;
  notes: string;
  createdAt: string;
}
export interface ModelSettings {
  endpoint: string;
  model: string;
  apiKey: string;
}
