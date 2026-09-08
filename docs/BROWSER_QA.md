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
