# Architecture

SkillForge keeps domain logic independent from React and platform conventions.

| Area | Responsibility |
| --- | --- |
| `src/types/skill.ts` | Skill, tests, results, model settings and localization types |
| `src/features/skills/schema.ts` | Runtime Zod validation and defaults |
| `src/features/skills/parser.ts` | YAML/Markdown parsing, Markdown and README generation |
| `src/features/skills/archive.ts` | Bounded ZIP import/export and explicit GitHub file import |
| `src/features/inspector/engine.ts` | Secret detection/redaction, explainable findings and scores |
| `src/features/generator/service.ts` | Offline templates and explicit provider requests |
| `src/features/tester/runner.ts` | Rule/mock/model/agent evaluation and same-run comparison |
| `src/types/agent.ts` | Runtime tools, agent steps and trace, permission bindings, run records |
| `src/features/agent/loop.ts` | Model → tool-call → permission gate → execute loop with a recorded trace |
| `src/features/agent/runtime.ts` | Permission classification, tool binding, in-browser tools and system prompts |
| `src/adapters` | Platform package paths and experimental labels |
| `src/storage` | Async storage interface and browser localStorage implementation |
| `src/components` | Working surfaces: library, editor, generator, tester, agent run, steward, inspector and settings |
| `registry` | Publicly intended source-controlled examples and catalog |
| `app` | Next.js-style page routing and metadata, served by Vinext |
| `worker` / `build` | Cloudflare-compatible application entry and Sites packaging |

The browser is the data boundary. No cloud database or user account system is part of v0.2.0. Library state and evaluation history use an origin-scoped JSON snapshot. Keys remain in component memory. Demo and normal data use separate keys. Invalid draft text fields survive reload; export requires a valid schema. Unreadable persisted data disables autosave instead of overwriting it.

AI requests are direct browser fetches to a user-configured compatible provider, with HTTPS/localhost validation, timeouts, redirects disabled and secret-pattern checks on the payload. They require CORS support. A provider error becomes a visible error; no simulated fallback is presented as real AI. `postChat` is the single request path shared by the generator, LLM evaluation and the agent loop.

Scoring gives each of nine dimensions equal weight. A dimension is the proportion of its checks that pass. The overall score is their arithmetic mean. Checks explain thresholds and limitations. No quality score is a security guarantee.

Rule assertions inspect the serialized skill, not the test input. Model evaluation is a response request plus a judge request; returned usage is counted only when both calls report it. Mock runs replay examples and are skipped. Comparison receives one current-run result set and separates modes.

The agent runtime (`src/features/agent`) is a bounded loop, not a sandbox or a framework. Each turn sends the conversation plus the bound tool schemas; the model returns zero or more OpenAI-style `tool_calls`; each call is gated, executed sequentially and appended as a `tool` message. The loop ends on a reply without tool calls, an abort, an error or the step limit (12, or 10 for the Steward). Every call is written to a `AgentTrace` and pushed to the UI as a structured clone.

Permission gating works in two places. Before the run, `bindTools` maps each tool the skill declares to runtime tools by alias, within the permission class read from the skill's free-text `permissions` (`classifyPermission`: write > network > read, unknown counts as write, broad wording flagged). Only bound tools are sent to the model. During the run, a read-only call executes immediately unless its declaration was broad; any other call must be approved through a `ConfirmFn`, and no callback means refusal. A tool that is not part of the run is recorded as `unavailable`; a tool that throws or returns `ERROR:` is recorded as failed. Neither is counted as a successful call. Stop aborts the request and cancels an approval that is still open.

Runtime tools are deliberately few and in-app only: attached material files, library search and read, a CORS-bound `web_fetch`, a per-run `save_artifact`, and library writes (`create_skill`, `update_skill`) that exist only when the Steward supplies the callbacks and are validated with the same Zod schema as the editor. The model cannot set a skill's id, creation time or status. The skill system prompt contains the skill's behavioral fields and examples but never its tests, and an example whose input equals the task input is dropped so its output cannot leak the expected answer.

ZIP input uses fflate with pre-extraction limits, rejects absolute/traversal paths and never executes contents. Canonical JSON takes precedence over adjacent SKILL.md. Noncanonical Markdown headings stay in the instructions body. Supporting scripts/binaries are not installed.

Future extension points: replace `SkillStorage` with IndexedDB/filesystem; add tested `SkillAdapter`s; move tool execution into a worker or sandbox with a real isolation design before adding shell, filesystem or package-installation tools.
