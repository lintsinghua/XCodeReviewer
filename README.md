# XCodeReviewer - 您的智能代码审计伙伴 🚀

> 多Agent、PR批量自动审计版本正在开发中，敬请期待......

<div style="width: 100%; max-width: 600px; margin: 0 auto;">
  <img src="frontend/public/images/logo.png" alt="XCodeReviewer Logo" style="width: 100%; height: auto; display: block; margin: 0 auto;">
</div>

<div align="center">

[![Version](https://img.shields.io/badge/version-2.0.0--beta.1-blue.svg)](https://github.com/lintsinghua/XCodeReviewer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13+-3776ab.svg)](https://www.python.org/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lintsinghua/XCodeReviewer)

[![Stars](https://img.shields.io/github/stars/lintsinghua/XCodeReviewer?style=social)](https://github.com/lintsinghua/XCodeReviewer/stargazers)
[![Forks](https://img.shields.io/github/forks/lintsinghua/XCodeReviewer?style=social)](https://github.com/lintsinghua/XCodeReviewer/network/members)

[![Sponsor](https://img.shields.io/badge/Sponsor-赞助-blueviolet)](https://github.com/lintsinghua/lintsinghua.github.io/issues/1)
</div>

<div style="width: 100%; max-width: 600px; margin: 0 auto;">
  <a href="https://github.com/lintsinghua/XCodeReviewer">
    <img src="frontend/public/star-me-cn.svg" alt="Star this project" style="width: 100%; height: auto; display: block; margin: 0 auto;" />
  </a>
</div>

---

## 💡 这是什么？

**你是否也有这样的困扰？**

- 😫 代码审计耗时耗力，人工 Review 效率低下
- 🤯 传统 SAST 工具误报率高，修复建议不知所云
- 😰 安全漏洞藏得太深，上线后才发现问题
- 🥺 想用 AI 辅助审计，但配置复杂、门槛太高

**XCodeReviewer 来拯救你！** 🦸‍♂️

我们将 10+ 主流大模型的智慧注入代码审计，让你像和资深安全专家对话一样，轻松发现代码中的安全隐患、性能瓶颈和潜在 Bug。


## ✨ 为什么选择我们？

<table>
<tr>
<td width="50%">

### 🧠 真正理解你的代码
不是简单的关键词匹配，而是深度理解代码逻辑和业务意图，像人类专家一样思考。

### 🎯 What-Why-How 三步修复
- **What**: 精准定位问题所在
- **Why**: 解释为什么这是个问题
- **How**: 给出可直接使用的修复建议

### 🔌 10+ LLM 平台任你选
OpenAI、Claude、Gemini、通义千问、DeepSeek、智谱AI... 想用哪个用哪个，还支持 Ollama 本地部署！

</td>
<td width="50%">

### ⚡ 5 分钟快速上手
Docker 一键部署，浏览器配置 API Key，无需复杂环境搭建。

### 🔒 代码隐私有保障
支持 Ollama 本地模型，敏感代码不出内网，安全合规无忧。

### 📊 专业报告一键导出
JSON、PDF 格式随心选，审计报告直接交付，省去整理时间。

</td>
</tr>
</table>

## 🎬 眼见为实

| 智能仪表盘 | 即时分析 |
|:---:|:---:|
| ![仪表盘](frontend/public/images/example1.png) | ![即时分析](frontend/public/images/example2.png) |
| *一眼掌握项目安全态势* | *链接仓库/粘贴代码，秒出结果* |

| 项目管理 | 审计报告 |
|:---:|:---:|
| ![项目管理](frontend/public/images/example3.png) | ![审计报告](frontend/public/images/审计报告示例.png) |
| *GitHub/GitLab 无缝集成* | *专业报告，一键导出* |


## 🚀 3 步开始你的智能审计之旅

```bash
# 1️⃣ 克隆项目
git clone https://github.com/lintsinghua/XCodeReviewer.git && cd XCodeReviewer

# 2️⃣ 配置你的 LLM API Key
cp backend/env.example backend/.env
# 编辑 backend/.env，填入你的 API Key

# 3️⃣ 一键启动！
docker-compose up -d
```

🎉 **搞定！** 打开 http://localhost:5173 开始体验吧！

> 📖 更多部署方式请查看 [部署指南](docs/DEPLOYMENT.md)

## ✨ 核心能力

- **项目管理** — GitHub/GitLab 一键导入，ZIP 上传，多语言支持
- **即时分析** — 代码片段秒级分析，10+ 编程语言全覆盖
- **智能审计** — Bug、安全、性能、风格、可维护性五维检测
- **可解释分析** — What-Why-How 模式，精准定位 + 修复建议
- **可视化报告** — 质量仪表盘、趋势分析、PDF/JSON 导出
- **灵活配置** — 浏览器运行时配置，无需重启服务

## 🤖 支持的 LLM 平台

- **国际平台**: OpenAI GPT · Claude · Gemini · DeepSeek
- **国内平台**: 通义千问 · 智谱AI · Kimi · 文心一言 · MiniMax · 豆包
- **本地部署**: Ollama (Llama3, CodeLlama, Qwen2.5, DeepSeek-Coder...)

详细配置请查看 [LLM 平台支持](docs/LLM_PROVIDERS.md)

## 🎯 未来蓝图

这个项目目前还比较初级，很多地方做得不够好，我们一直在努力改进！接下来想做的事情：

- **接入 CI/CD** — 让它能跑在 GitHub/GitLab 流水线里，提 PR 的时候自动帮你批量审代码
- **RAG 知识库** — 把 CWE/CVE 这些漏洞库喂给模型，让它真正懂安全，不再瞎报一通
- **多 Agent 协作** — 多智能体架构，模拟真实的安全团队工作流程
- **自动生成补丁** — 光说哪里有问题不够，还得能自动生成能用的修复代码
- **混合分析** — AI 分析完再用传统 SAST 工具验证一遍，两边互相补充，减少误报漏报
- **自定义规则** — 支持用配置文件定义自己团队的编码规范
- **跨文件分析** — 做代码知识图谱，理解模块间的调用关系

💡 **您的 Star 和反馈是我们前进的最大动力！有任何想法欢迎提 Issue 一起讨论~**

## 📚 文档

想了解更多？这里有你需要的：

- [部署指南](docs/DEPLOYMENT.md) - Docker 部署 / 本地开发环境搭建
- [配置说明](docs/CONFIGURATION.md) - 后端配置、数据库、API 中转站怎么配
- [LLM 平台支持](docs/LLM_PROVIDERS.md) - 各家 LLM 的配置方法和 API Key 怎么拿
- [常见问题](docs/FAQ.md) - 遇到问题先看这里
- [贡献指南](CONTRIBUTING.md) - 想参与开发？看这个
- [安全政策](SECURITY.md) / [免责声明](DISCLAIMER.md) - 使用前建议读一下

## 🤝 贡献

开源项目离不开社区的支持！无论是提 Issue、贡献代码，还是分享使用心得，都非常欢迎。

**感谢每一位贡献者！**

[![Contributors](https://contrib.rocks/image?repo=lintsinghua/XCodeReviewer)](https://github.com/lintsinghua/XCodeReviewer/graphs/contributors)

## 📞 联系我们

- **项目链接**: [https://github.com/lintsinghua/XCodeReviewer](https://github.com/lintsinghua/XCodeReviewer)
- **问题反馈**: [Issues](https://github.com/lintsinghua/XCodeReviewer/issues)
- **作者邮箱**: lintsinghua@qq.com（合作请注明来意）

---

<p align="center">
  <strong>⭐ 如果这个项目对你有帮助，请给我们一个 Star！</strong>
  <br>
  <em>你的支持是我们持续迭代的最大动力 💪</em>
</p>

<p align="center">
  <a href="https://star-history.com/#lintsinghua/XCodeReviewer&Date">
    <img src="https://api.star-history.com/svg?repos=lintsinghua/XCodeReviewer&type=Date" alt="Star History">
  </a>
</p>

---

<p align="center">
  ⚠️ 使用前请阅读 <a href="SECURITY.md">安全政策</a> 和 <a href="DISCLAIMER.md">免责声明</a>
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/lintsinghua">lintsinghua</a>
</p>
