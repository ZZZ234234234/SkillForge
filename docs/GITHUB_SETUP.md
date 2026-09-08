# GitHub repository setup

Repository name: `SkillForge`

Owner: `ZZZ234234234`

Visibility: Public

Description:

```text
Open-source platform to build, test, inspect and manage skills for AI agents | AI Agent Skills 开发与管理工具
```

The public repository is created, source is uploaded, and Description is verified. The remaining repository settings are Website, Topics and Social Preview.

Website/Homepage: `https://skillforge.honey-chick-7267.chatgpt.site`

Topics:

```text
ai ai-agent agent agentic-ai agent-skills skills llm developer-tools codex claude-code mcp prompt-engineering open-source nextjs typescript local-first
```

After code is uploaded, open the repository About panel's gear icon to set Description, Website and Topics. Under repository Settings → General → Social preview, upload `docs/social-preview.png`. It is generated brand artwork (1774×887, 2:1), not a product screenshot.

If you have the official GitHub CLI installed and authenticated, `npm run github:setup` creates the repository when missing and sets Description, Topics and the verified Homepage. This helper does not push code or create a release.

v0.1.0 is published with successful CI, SHA256SUMS and an attestation for both ZIP files. Future package-version commits on main trigger the same verified release process; tags and manual dispatch are also supported. Existing releases are left intact.
