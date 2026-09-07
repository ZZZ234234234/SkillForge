# GitHub repository setup

Repository name: `SkillForge`

Owner: `ZZZ234234234`

Visibility: Public

Description:

```text
Open-source platform to build, test, inspect and manage skills for AI agents | AI Agent Skills 开发与管理工具
```

Do not initialize a second README, .gitignore or license when creating the empty repository; all are present in the prepared source.

Website/Homepage: `https://skillforge.honey-chick-7267.chatgpt.site`

Topics:

```text
ai ai-agent agent agentic-ai agent-skills skills llm developer-tools codex claude-code mcp prompt-engineering open-source nextjs typescript local-first
```

After code is uploaded, open the repository About panel's gear icon to set Description, Website and Topics. Under repository Settings → General → Social preview, upload `docs/social-preview.png`. It is generated brand artwork (1774×887, 2:1), not a product screenshot.

If you have the official GitHub CLI installed and authenticated, `npm run github:setup` creates the repository when missing and sets Description, Topics and the verified Homepage. This helper does not push code or create a release.

After reviewing the uploaded source and a successful CI run, tag the release revision `v0.1.0` and push the tag. The release workflow runs the checks, builds archives, creates SHA256SUMS.txt, requests attestations and publishes only after those steps succeed. A workflow definition is not proof of a completed run.
