# Contributing a Skill

The registry is bundled source, not an account-based hosted service. Submit a pull request to the official repository when available.

1. Create or import a skill in SkillForge and export the full generic package.
2. Use a lowercase hyphenated name, a semantic version, a concrete trigger description, an author, a license and accurate tags/category/compatibility targets.
3. Include role, goals, instructions, workflow, scoped tools, constraints, input/output format, error handling, examples and meaningful tests.
4. Place the package under `registry/skills/<name>/`. Add its canonical object to `registry/registry.json` (or run `npm run registry:sync` after adding skill.json).
5. Explain the expected audience, original source and license. Do not claim platform execution was tested unless it was.
6. Run the validation/test/build commands in CONTRIBUTING.md. Attach inspector findings and describe remaining warnings. Quality scores are not acceptance guarantees.

No keys, passwords, private documents, malicious payloads or unapproved executable files. Review untrusted instructions for credential disclosure and excessive tool scopes. Binary assets and executable resources are not imported/executed by this first release.

The initial 18 entries are original Demo Data maintained by 爱吃孜然芥末. The React reviewer intentionally lacks error handling to demonstrate an inspector warning. Curated order is editorial, not measured popularity. Trending is Coming Soon until a real attributable data source exists.
