import { z } from "zod";
import type { Skill } from "../../types/skill";
export const testSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.string(),
  expectedBehavior: z.string(),
  expectedOutput: z.string().optional(),
  assertions: z
    .array(
      z.object({
        kind: z.enum(["contains", "notContains", "section"]),
        value: z.string(),
      }),
    )
    .default([]),
});
export const skillSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().min(1),
  description: z.string().min(1).max(1024),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/),
  author: z.string(),
  license: z.string(),
  tags: z.array(z.string()),
  category: z.string(),
  compatibility: z.array(z.string()),
  role: z.string(),
  goals: z.array(z.string()),
  instructions: z.string(),
  workflow: z.array(z.string()),
  tools: z.array(
    z.object({
      name: z.string(),
      permissions: z.string(),
      description: z.string(),
    }),
  ),
  constraints: z.array(z.string()),
  inputFormat: z.string(),
  outputFormat: z.string(),
  errorHandling: z.string(),
  examples: z.array(z.object({ input: z.string(), output: z.string() })),
  tests: z.array(testSchema),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["Local", "Installed", "Registry", "Draft"]),
  favorite: z.boolean(),
});
export function blankSkill(title = "Untitled Skill"): Skill {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name:
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64) || "new-skill",
    displayName: title,
    description:
      "Describe when this skill should be used and the result it produces.",
    version: "0.1.0",
    author: "爱吃孜然芥末",
    license: "MIT",
    tags: [],
    category: "Coding",
    compatibility: ["Generic"],
    role: "",
    goals: [],
    instructions: "",
    workflow: [],
    tools: [],
    constraints: [],
    inputFormat: "",
    outputFormat: "",
    errorHandling: "",
    examples: [],
    tests: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    status: "Draft",
    favorite: false,
  };
}
export function validateSkill(value: unknown) {
  return skillSchema.safeParse(value);
}
