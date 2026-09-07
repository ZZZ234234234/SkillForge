# SkillForge v0.1.0 交付报告

日期：2026-09-07。定位：可运行的首版候选版本，尚不是已完成 GitHub 正式发布的版本。

在线入口：[SkillForge](https://skillforge.honey-chick-7267.chatgpt.site)。部署服务已返回成功，访问范围为 public；浏览器交互、手机与 iPad 视觉验收受当前环境阻断，未声称通过。

| 项目 | 实际状态 |
| --- | --- |
| 1. 项目目录 | `/workspace/sites/skillforge`；代码已提交并保存至项目源码远端 |
| 2. 核心功能 | 技能库、搜索/分类/标签/排序/收藏、浏览器内安装、表单与代码编辑、撤销重做、自动保存、结构检查、评分、敏感信息遮盖、导入导出、生成器、规则/模拟/模型评估路径、共享测试集比较、18 个 Demo、双语、深浅色、设置 |
| 3. 尚未完成 | 真正 Agent 工具沙箱、电脑文件夹实时管理、桌面端、CLI、社区热度数据、SDK/MCP 直接集成；已标 Coming Soon 或 Experimental |
| 4. Build | 通过。Vinext/Vite 编译，使用 Next.js App Router 约定；非标准 Vercel Next.js 部署。存在大于 500 kB 的分块提示，非失败 |
| 5. Tests | 22 项领域测试、4 项构建后路由/HTML 集成检查全部通过；typecheck 和 lint 通过，无 lint 错误或警告 |
| 6. GitHub Topics | 16 个关键词与设置脚本已准备；尚未在 GitHub 仓库应用 |
| 7. Description | 已确认 GitHub 仓库显示正确的中英简介 |
| 8. Demo 可用 | `/demo` 已实现，独立本地存档，免 API Key 的演示功能；服务端渲染检查通过 |
| 9. Demo 部署 | 已公开部署成功；匿名浏览器和按钮交互未实测 |
| 10. Homepage | 已确定在线地址，尚未应用至 GitHub 仓库 |
| 11. Social Preview | `docs/social-preview.png` 已完成，1774×887，2:1 品牌图；已获得部署服务的真实首页截图 docs/screenshot.jpg，尚未上传 GitHub 设置 |
| 12. README | 英文优先、中文辅助，真实能力边界、安装、Demo、贡献、Roadmap 和作者信息已完成 |
| 13. Release | v0.1.0 说明、归档脚本和工作流已完成；正式 GitHub Release 未创建 |
| 14. SHA256 | 源码包和网页构建包已生成 SHA256SUMS.txt 并成功校验；随交付包提供 |
| 15. Attestation | 工作流已配置；GitHub 未运行，不能声称已启用验证成功 |
| 16. 防伪说明 | README、SECURITY.md 和发行说明已完成：仅官方 GitHub Releases 作为正式发布入口 |
| 17. TRADEMARKS.md | 已完成，区分 MIT 代码权利与官方身份，不宣称注册商标 |
| 18. 作者 | 爱吃孜然芥末，正确 |
| 19. 邮箱 | 2014546082@qq.com，正确 |
| 20. Secret 检查 | 已扫描初次提交中 222 个文本文件；3 处候选均为类型/变量引用，未发现真实硬编码密钥。模式扫描不能证明绝无泄漏 |
| 21. 需要外部条件 | GitHub 仓库已创建并确认写入权限；仓库元数据/Release 的现有连接接口受限；Social Preview 需仓库设置上传；真实模型联调需自行在设置填写密钥；视觉验收需可用浏览器 |

## 关键边界

- 所谓“安装”是写入浏览器技能库，不是安装到电脑或 Agent。
- 离线生成使用模板，界面明确标记非 AI。AI 模式有真实请求实现，但只用隔离模拟传输验证，未消费付费模型。
- Rule Evaluation 检查说明文本与章节；不会执行测试输入。Mock 回放示例并标 skipped。LLM 评估会发出模型请求和模型评审，无工具执行。
- 分数是启发式开发辅助，不是绝对质量或安全认证。冲突与模糊性检测是有限文本规则。
- Codex/Claude 是目录导出适配；SDK/MCP 是实验性说明包，不伪造官方格式。
- 数据保存在本浏览器，清除浏览器数据会删除；密钥仅内存保存。请导出备份。
- 导入不执行附带脚本，不保留任意二进制资源；公开 GitHub 导入只接受具体 Markdown/JSON 文件地址。
- 真实首页截图已取得；交互 GIF 仍未录制，步骤见 DEMO_RECORDING.md。

## GitHub 下一步

官方仓库：https://github.com/ZZZ234234234/SkillForge 。简介已确认正确。Website、16 个 Topics 和 Social Preview 操作见 GITHUB_SETUP.md。源码上传后由 GitHub Actions 执行构建与发布；应以真实运行结果判断 Release 和 Attestation 状态。
