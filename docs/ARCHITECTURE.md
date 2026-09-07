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
| `src/features/tester/runner.ts` | Rule/mock/model evaluation and same-run comparison |
| `src/adapters` | Platform package paths and experimental labels |
| `src/storage` | Async storage interface and browser localStorage implementation |
| `src/components` | Working surfaces: library, editor, generator, tester, inspector and settings |
| `registry` | Publicly intended source-controlled examples and catalog |
| `app` | Next.js-style page routing and metadata, served by Vinext |
| `worker` / `build` | Cloudflare-compatible application entry and Sites packaging |

The browser is the data boundary. No cloud database, user account system or tool executor is part of v0.1.0. Library state and evaluation history use an origin-scoped JSON snapshot. Keys remain in component memory. Demo and normal data use separate keys. Invalid draft text fields survive reload; export requires a valid schema. Unreadable persisted data disables autosave instead of overwriting it.

AI requests are direct browser fetches to a user-configured compatible provider, with HTTPS/localhost validation, timeouts, redirects disabled and secret-pattern checks on the payload. They require CORS support. A provider error becomes a visible error; no simulated fallback is presented as real AI.

Scoring gives each of nine dimensions equal weight. A dimension is the proportion of its checks that pass. The overall score is their arithmetic mean. Checks explain thresholds and limitations. No quality score is a security guarantee.

Rule assertions inspect the serialized skill, not the test input. Model evaluation is a response request plus a judge request; returned usage is counted only when both calls report it. Mock runs replay examples and are skipped. Comparison receives one current-run result set and separates modes.

ZIP input uses fflate with pre-extraction limits, rejects absolute/traversal paths and never executes contents. Canonical JSON takes precedence over adjacent SKILL.md. Noncanonical Markdown headings stay in the instructions body. Supporting scripts/binaries are not installed.

Future extension points: replace `SkillStorage` with IndexedDB/filesystem; add tested `SkillAdapter`s; introduce an isolated agent runtime only after explicit tool permissions and a real sandbox design.
