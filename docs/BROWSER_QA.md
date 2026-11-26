# Desktop browser verification

Checked on 2026-09-08 against the public `/demo` deployment, initially v0.1.0.

| Check | Observed result |
| --- | --- |
| Public Demo | Opens without a SkillForge login; 18 labeled Demo Skills |
| Search | Searching React shows one matching card |
| Editor and inspector | React Code Reviewer opens with a missing-error-handling warning and score 89 |
| Live scoring | Adding an error policy changes Error Handling from 0 to 100 |
| Offline generation | Creates a reviewable Next.js skill; explicitly labeled Offline template |
| Saved data | Generated skill and edited React skill survive reload; library becomes 19 entries |
| Language and theme | English and light-mode controls work; English survives reload |
| Comparison | Two selected skills run against one suite; no invented tokens or tool calls |
| Export | App reports Download prepared without an application console error; browser download event observation times out |

The comparison check exposed a v0.1.0 bug: a negative text assertion matched its own serialized test definition. v0.1.1 restricts rule matching to authored behavioral fields and includes a regression test for both false passes and false failures.

The browser console contained extension metadata errors, with `chrome-extension://` origins; no application error was observed during these checks. This is a sampled interaction check, not exhaustive browser coverage. Phone/iPad layouts, file download completion and real paid-model calls are not claimed as verified. ZIP creation and import round-trip are covered by automated domain tests.

## v0.1.1 follow-up

After deployment on 2026-09-08, the browser loaded the v0.1.1 footer and reran the same saved Next.js-generated suite against the same two skills. Both now pass 1/1; the previously failing Next.js skill no longer matches the negative assertion in its own test definition. Tokens remain N/A and no tool calls are reported.

## v0.2.0 agent runtime

Checked on 2026-11-26 with headless Microsoft Edge against a local Vite dev server at `/demo`, 1440×900, Chinese interface. The model endpoint (`https://model.test/v1`) and the fetched page (`https://example.org/spec`) were **scripted responses intercepted in the browser**, so these checks cover the application's own behavior, not a real provider or a real third-party site. 40 checks passed with no JavaScript exception or `console.error`.

| Area | Observed result |
| --- | --- |
| Navigation | Sidebar shows “Agent 试运行” (NEW) and “管家 Agent” (AI); pages hydrate and render |
| Permission table | The demo skill's read-only declaration binds to `list_files` and `read_file` and is marked automatic |
| Attach files | A text file appears as a removable chip and its content is returned by `read_file` |
| Agent Run | Read-only calls run without a prompt; an undeclared `shell` call and a `web_fetch` beyond the declared permission are both recorded as errors and not executed; the final answer, call count, tokens and duration match the three scripted requests; tool results are fed back to the model |
| Steward approval | `create_skill` opens a dialog showing the tool and arguments; the library is unchanged before approval; approving adds one Draft that passes the schema |
| Steward denial | A following `update_skill` asks again; denying records the denial, the model is told, and the constraint is not written |
| Steward follow-through | The reply renders with the three steps; “打开刚创建的技能” opens the new skill in the editor |
| Agent Evaluation | The mode is selectable; an empty test suite is refused without any model request; a real suite runs and records `agent` results with the model's real output |

Not covered: a paid model or real provider, real cross-origin `web_fetch`, light theme, mobile layouts, the artifact download button and the English interface on these new pages. Two issues found during this pass were fixed before recording it: creating a skill from the Steward navigated away from the conversation, and an unavailable tool was labelled as if the user had denied it.
