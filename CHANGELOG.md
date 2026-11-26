# Changelog

## 0.2.0 — 2026-11-26

### Added
- In-browser agent runtime: a bounded model → tool-call → permission gate → execute loop with a recorded trace, Stop, and a step limit.
- **Agent Run**: run one skill on a task with attached material files, a per-tool permission table, a live trace and a downloadable JSON record.
- **Steward Agent**: manage the library by conversation (`search_skills`, `read_skill`, `create_skill`, `update_skill`); created skills are Drafts and every write needs approval.
- **Agent Evaluation** in the tester: real tool calls, assertions checked against the real output, no model judge, real tool-call counts.
- Permission gating from the skill's own `permissions` text: read-only runs automatically, write and network are confirmed each time, broad declarations are confirmed even when read-only, and tools without an in-browser equivalent are reported as not bound.
- 13 tests for the agent runtime (`tests/agent.test.ts`); `npm test` now runs both test files.

### Changed
- `complete` and the agent loop share one validated request path (`postChat`).
- The skill system prompt excludes tests, and drops an example whose input equals the task input so its output cannot leak the expected answer.
- Package version 0.2.0; README, architecture and release notes describe the runtime and its limits.

### Known limitations
- No shell, local filesystem access, package installation or sandboxed execution. `web_fetch` is subject to browser CORS.
- Requires a model that returns OpenAI-style `tool_calls`; provider support varies.
- Verified against a scripted mock provider in a desktop browser, not against a paid model.
- Published automatically as v0.2.0 by the Release workflow on push to `main`; the hosted Demo was not redeployed.

## 0.1.1 — 2026-09-08

- Fix rule evaluation matching against its own assertions and examples. Only authored behavioral fields now participate in text rules.
- Add a regression test covering false passes and false failures.
- Record verified GitHub release provenance and real desktop browser checks.
- Resolve the official repository link in the deployed About page.
- Select release notes by the actual package version.

## 0.1.0 — 2026-09-07

### Added
- Local browser skill library with 18 labeled demo entries, filters, search and favorites.
- Form and code editor, autosave, undo/redo and safe basic Markdown preview.
- Explainable inspector and nine-dimensional heuristic quality score.
- Offline template generator and configurable Chat Completions request path.
- Rule, mock and optional LLM evaluation; same-suite multi-skill comparison.
- Bounded ZIP, folder, Markdown, JSON and public GitHub file import.
- Markdown, JSON, README and adapter-based ZIP export.
- Chinese/English interface, dark/light themes, secret detection and redaction.
- Open-source contribution files, release packaging, checksums and attestation workflow configuration.

### Known limitations
- No official GitHub Release or successful attestation run has yet been verified.
- No real agent tools, direct filesystem management, CLI or desktop application.
- Real-provider integration and browser visual QA were not completed in the creation environment.
- SDK/MCP exports are experimental instruction bundles, not integrations.
