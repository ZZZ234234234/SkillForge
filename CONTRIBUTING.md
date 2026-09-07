# Contributing to SkillForge

Thanks for helping build useful, verifiable Agent Skills tooling.

1. Discuss a concrete bug or focused feature in an issue. Avoid unrelated rewrites.
2. Fork the official repository once available and create a focused branch.
3. Use Node.js 22.13+, run `npm ci`, then `npm run dev`.
4. Keep domain logic in `src/features`, platform conversions in `src/adapters`, storage behind `SkillStorage`, and UI in `src/components`.
5. Add behavioral tests for parser, archive, scoring, evaluation or security changes.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:integration`.
7. Describe the user problem, resulting behavior and actual verification in your PR. Include real screenshots for visual changes when available.

Do not submit secrets, invented metrics, unsupported compatibility claims or copied skills without permission and attribution. UI labels support Simplified Chinese and English. Code and third-party license notices must remain intact. New dependencies should solve a concrete requirement.

Skill submissions have their own process in CONTRIBUTING_SKILLS.md. All participation follows CODE_OF_CONDUCT.md.
