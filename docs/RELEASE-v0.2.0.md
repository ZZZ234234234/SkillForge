# SkillForge v0.2.0

## What's New

SkillForge can now **run a skill, not only describe it**. An in-browser agent runtime executes a skill on a task through a small set of in-app tools, and the skill's own `permissions` text decides what happens without asking.

- **Agent Run.** Pick a skill, describe a task, attach material files. The runtime shows how each declared tool was bound and what decision applies, then records every tool call, approval, denial, failure and duration in a trace. The full record downloads as JSON.
- **Steward Agent.** Manage the library by conversation: search, read, create and update skills. Created skills are Drafts; each create or update is shown with its arguments and needs your approval.
- **Agent Evaluation.** A fourth test mode that runs the skill as a real tool-calling agent and checks assertions against the real output. It reports real tool-call counts and does not use a model judge.

## Permissions

Read-only declarations run automatically. Write and network tools are confirmed on every call. A declaration that cannot be classified is treated as write. Broad wording (wildcards, “unrestricted”, “sudo”, “全部权限”) is confirmed even when it binds to a read-only tool. A declared tool with no in-browser equivalent is marked *not bound* and never simulated.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` (36 tests: 23 existing and 13 for the agent runtime), `npm run build:portable` and `npm run test:integration` pass locally on Windows. A 40-check headless Microsoft Edge run against the Vite dev server exercised Agent Run, the Steward approval flow and Agent Evaluation. The model provider and the fetched page were scripted responses intercepted in the browser. See [browser verification](BROWSER_QA.md).

## Known Limitations

The runtime has no shell, no local filesystem access and no package installation, and it is not a sandbox. `web_fetch` depends on each site's CORS headers. It requires a model that returns OpenAI-style `tool_calls`. It has **not** been exercised against a paid model, a real provider or a real third-party site. Prompt injection through fetched content or attached files is mitigated by instruction only. Rule checks and heuristic scores remain fallible.

## Status

Source changes only. No GitHub Release, checksum, attestation or deployment exists for v0.2.0 yet.

## Author

Created and maintained independently by 爱吃孜然芥末. Contact: 2014546082@qq.com.
