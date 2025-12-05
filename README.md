<p align="center">
  <img src="frontend/public/images/logo.png" alt="XCodeReviewer Logo" width="200">
</p>

<h1 align="center">🛡️ XCodeReviewer</h1>

<p align="center">
  <strong>让 AI 成为你的代码安全守护者</strong>
</p>

<p align="center">
  <em>告别繁琐的人工审计，拥抱智能化代码安全新时代</em>
</p>

<p align="center">
  <a href="https://github.com/lintsinghua/XCodeReviewer/releases"><img src="https://img.shields.io/badge/version-2.0.0--beta.1-blue.svg" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"></a>
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-18-61dafb.svg" alt="React"></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.100+-009688.svg" alt="FastAPI"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.13+-3776ab.svg" alt="Python"></a>
  <a href="https://deepwiki.com/lintsinghua/XCodeReviewer"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

<p align="center">
  <a href="https://github.com/lintsinghua/XCodeReviewer/stargazers"><img src="https://img.shields.io/github/stars/lintsinghua/XCodeReviewer?style=social" alt="Stars"></a>
  <a href="https://github.com/lintsinghua/XCodeReviewer/network/members"><img src="https://img.shields.io/github/forks/lintsinghua/XCodeReviewer?style=social" alt="Forks"></a>
  <a href="https://github.com/lintsinghua/lintsinghua.github.io/issues/1"><img src="https://img.shields.io/badge/Sponsor-赞助-blueviolet" alt="Sponsor"></a>
</p>

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
- **How**: 给出可直接使用的修复代码

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
| *一眼掌握项目安全态势* | *粘贴代码，秒出结果* |

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

## 🛠️ 核心能力

| 能力 | 描述 |
|------|------|
| 🚀 **项目管理** | GitHub/GitLab 一键导入，ZIP 上传，多语言支持 |
| ⚡ **即时分析** | 代码片段秒级分析，10+ 编程语言全覆盖 |
| 🧠 **智能审计** | Bug、安全、性能、风格、可维护性五维检测 |
| 💡 **可解释分析** | What-Why-How 模式，精准定位 + 修复建议 |
| 📊 **可视化报告** | 质量仪表盘、趋势分析、PDF/JSON 导出 |
| ⚙️ **灵活配置** | 浏览器运行时配置，无需重启服务 |

## 🤖 支持的 LLM 平台

<table>
<tr>
<td align="center"><strong>🌍 国际平台</strong></td>
<td>OpenAI GPT · Claude · Gemini · DeepSeek</td>
</tr>
<tr>
<td align="center"><strong>🇨🇳 国内平台</strong></td>
<td>通义千问 · 智谱AI · Kimi · 文心一言 · MiniMax · 豆包</td>
</tr>
<tr>
<td align="center"><strong>🏠 本地部署</strong></td>
<td>Ollama (Llama3, CodeLlama, Qwen2.5, DeepSeek-Coder...)</td>
</tr>
</table>

> 📖 详细配置请查看 [LLM 平台支持](docs/LLM_PROVIDERS.md)


## 🎯 未来蓝图

> 🚀 **我们的愿景：打造下一代智能代码安全平台，让每一行代码都值得信赖！**

| 计划 | 描述 |
|------|------|
| 🔄 **DevSecOps Pipeline** | GitHub/GitLab CI 集成，PR 级自动化安全审查 |
| 🔬 **RAG-Enhanced Detection** | CWE/CVE 知识库增强，告别高误报 |
| 🤖 **Multi-Agent Architecture** | 审计-修复-验证多智能体协同工作流 |
| 🔧 **Auto Patch Generation** | 智能漏洞定位与修复补丁自动生成 |
| 🛡️ **Hybrid Analysis Engine** | AI + SAST 工具双重验证机制 |
| 📋 **Custom Security Policies** | 声明式规则引擎，团队规范定制 |

## 📚 文档

| 文档 | 说明 |
|------|------|
| [🚀 部署指南](docs/DEPLOYMENT.md) | Docker / 本地开发部署 |
| [⚙️ 配置说明](docs/CONFIGURATION.md) | 后端配置、数据库、API 中转站 |
| [🤖 LLM 平台](docs/LLM_PROVIDERS.md) | 10+ 平台配置与 API Key 获取 |
| [❓ 常见问题](docs/FAQ.md) | FAQ |
| [🤝 贡献指南](CONTRIBUTING.md) | 如何参与贡献 |
| [🔒 安全政策](SECURITY.md) | 代码隐私与安全 |
| [📜 免责声明](DISCLAIMER.md) | 使用条款 |

## 🤝 一起让它变得更好

我们相信开源的力量！无论是提 Issue、贡献代码，还是分享使用心得，你的每一份参与都让 XCodeReviewer 变得更强大。

<p align="center">
  <a href="CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome">
  </a>
</p>

**感谢每一位贡献者！** 🙏

[![Contributors](https://contrib.rocks/image?repo=lintsinghua/XCodeReviewer)](https://github.com/lintsinghua/XCodeReviewer/graphs/contributors)


## 📞 联系我们

<p align="center">
  <a href="https://github.com/lintsinghua/XCodeReviewer">🏠 项目主页</a> ·
  <a href="https://github.com/lintsinghua/XCodeReviewer/issues">🐛 问题反馈</a> ·
  <a href="mailto:lintsinghua@qq.com">📧 联系作者</a>
</p>

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
