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

## 最后需要在 GitHub 设置的三项

源码、构建、Release、SHA256 和 Attestation 均已完成。当前连接未提供以下仓库设置的写入接口：

1. 打开仓库首页，点右侧 About（关于）旁边的齿轮，在 Website 填 `https://skillforge.honey-chick-7267.chatgpt.site`。
2. 在同一窗口的 Topics 输入上方 16 个关键词，每个词按回车确认，再保存。Description 已正确，无需重填。
3. 在仓库 Settings（设置）→ General（常规）→ Social preview（社交预览）上传仓库中的 `docs/social-preview.png`。该图片已生成并提交。

操作后，仓库首页会出现在线体验入口和搜索标签；分享仓库链接时会展示预览图。
