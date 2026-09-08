# SkillForge 交付与验证报告

核验日期：2026-09-08。

- 官方仓库：https://github.com/ZZZ234234234/SkillForge
- 在线 Demo：https://skillforge.honey-chick-7267.chatgpt.site/demo
- 已发布版本：https://github.com/ZZZ234234234/SkillForge/releases/tag/v0.1.0
- v0.1.1 修复规则检查将测试说明本身纳入判断的问题；本地回归通过，发布状态以 Actions 为准。

| 项目 | 实际状态 |
| --- | --- |
| 1. 项目目录 | `/workspace/sites/skillforge`；完整代码已在官方 GitHub 仓库，另有在线项目源码远端 |
| 2. 核心功能 | 技能库、搜索/分类/标签/排序/收藏、浏览器内安装、表单与代码编辑、撤销重做、自动保存、Inspector、九维评分、敏感信息遮盖、文件夹/ZIP/Markdown/JSON 导入导出、生成器、规则/模拟/模型评估路径、共同测试集比较、18 个 Demo、双语、深浅色、设置 |
| 3. 尚未完成 | 真正 Agent 工具沙箱、电脑文件夹实时管理、桌面端、CLI、社区热度数据、SDK/MCP 直接集成；已标 Coming Soon 或 Experimental |
| 4. Build | v0.1.0 的本地和 GitHub 构建均通过。Vinext/Vite 编译 Next.js App Router 约定，不是标准 Vercel Next.js 部署；存在大于 500 kB 的分块提示 |
| 5. Tests | v0.1.0：22 项领域测试和 4 项路由/HTML 集成检查通过。v0.1.1：新增回归后 23 项领域测试通过；typecheck、lint 和文档链接检查通过 |
| 6. GitHub Topics | 当前仍为空；16 个关键词和设置脚本已准备，连接接口未提供元数据写入能力 |
| 7. Description | 已确认 GitHub 显示正确的中英简介 |
| 8. Demo 可用 | `/demo` 可公开打开，18 个示例明确标 Demo Data，无需注册或 API Key；已真实操作搜索、编辑、评分、离线生成、比较和设置 |
| 9. Demo 部署 | 已公开部署；生成和编辑的技能可在本浏览器刷新后恢复 |
| 10. Homepage | 当前为空，需要仓库 About 齿轮中填写在线地址 |
| 11. Social Preview | `docs/social-preview.png` 已生成且已提交 GitHub，1774×887，2:1；`docs/screenshot.jpg` 为真实部署截图。尚未应用至仓库 Social preview 设置 |
| 12. README | 英文优先、中文辅助，首屏图片、真实构建徽章、功能与边界、安装、Demo、贡献、Roadmap、作者与防伪说明完整 |
| 13. Release | v0.1.0 已正式创建，源码和网页构建 ZIP 均已上传 |
| 14. SHA256 | v0.1.0 Release 已包含 SHA256SUMS.txt；GitHub 返回两个下载资产的 SHA256 摘要，见下方 |
| 15. Attestation | 已实际生成并上传：v0.1.0 两个 ZIP 共同对应证明 45767095；成功日志确认签名与透明日志记录 |
| 16. 防伪说明 | README、SECURITY.md、发行说明均明确仅官方 GitHub Releases 是正式发行入口 |
| 17. TRADEMARKS.md | 已完成，区分 MIT 代码权利与官方身份，不宣称注册商标 |
| 18. 作者 | 爱吃孜然芥末，正确 |
| 19. 邮箱 | 2014546082@qq.com，正确 |
| 20. Secret 检查 | 初次提交的 222 个文本文件中，3 处候选均为类型/变量引用，未发现真实硬编码密钥。模式扫描不等同于安全审计 |
| 21. 外部条件 | 需手动设置 Topics、Homepage 和 Social Preview。真实模型测试需要服务商密钥；手机/iPad 视觉检查和浏览器下载完成状态仍未验证 |

## 已验证的发布证据

- [Build / Lint / Test 成功](https://github.com/ZZZ234234234/SkillForge/actions/runs/34134904302)
- [Release 成功](https://github.com/ZZZ234234234/SkillForge/actions/runs/34134904392)
- [v0.1.0 构建来源证明](https://github.com/ZZZ234234234/SkillForge/attestations/45767095)

GitHub 资产摘要：

```text
bc76294f0f3045f8204c4e79aceefcaa54823530b732adf2061297940b93a6c9  SkillForge-v0.1.0-source.zip
a627a445844137570f7c11da9e3201e60a9a970d5094a8c77d0cac98bca4f952  SkillForge-v0.1.0-web.zip
```

## 能力边界与剩余操作

“安装”写入浏览器技能库，不会安装到电脑或 Agent。离线生成明确为模板；真实模型请求路径存在，但没有消费付费模型验证。规则检查不执行任务，模拟模式回放示例并标 skipped；LLM 评估包含模型回答和评审，没有工具调用。分数是启发式开发辅助。Codex/Claude 是目录导出；SDK/MCP 是实验性说明包。

浏览器交互记录见 [BROWSER_QA.md](BROWSER_QA.md)。导出按钮提示文件已生成，没有观察到应用错误；当前云端浏览器的下载事件观察超时，因此不声称实际下载文件已验收。ZIP 编解码、导入导出往返测试已通过。手机和 iPad 未完成视觉验收。GIF 尚未录制，真实截图已提供。

仓库剩余设置见 [GITHUB_SETUP.md](GITHUB_SETUP.md)：About 齿轮填写 Website 和 Topics；Settings → General → Social preview 上传现有图片。无需重新创建仓库、手动上传源码或重新创建 v0.1.0 Release。
