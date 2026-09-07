# Security Policy

Report a vulnerability privately to **2014546082@qq.com**, maintained by 爱吃孜然芥末. Include the affected version, a minimal reproduction, impact and a redacted example. Do not send live credentials or publish exploit details in a public issue before coordination. No guaranteed response time or completed security audit is claimed.

The supported development line is v0.1.x. Official releases are distributed only through the intended official repository `ZZZ234234234/SkillForge` and its GitHub Releases. The first release and its attestations must be verified before use; workflows alone are not provenance.

Skills are untrusted text. SkillForge does not run their scripts or tool calls. LLM content and verdicts are untrusted and may be incorrect. Imported text is rendered as escaped React text. ZIP imports enforce path and expansion limits. Secret detection is heuristic and may miss credentials.

Browser storage is local, unencrypted and vulnerable to users/extensions with access to the browser profile. Export backups. API keys stay in runtime memory; do not embed keys into skill content or public configuration. Provider calls are explicit, direct browser requests requiring CORS. Avoid using keys on shared computers.

Verify SHA256 against the official Release and, when actually issued, verify GitHub attestation. Never install an unidentified third-party binary merely because its name contains SkillForge. No desktop installer is released by v0.1.0.
