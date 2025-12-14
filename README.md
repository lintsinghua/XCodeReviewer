# DeepAudit - AI 驱动的智能代码安全审计平台 🛡️

<div style="width: 100%; max-width: 600px; margin: 0 auto;">
  <img src="frontend/public/images/logo.png" alt="DeepAudit Logo" style="width: 100%; height: auto; display: block; margin: 0 auto;">
</div>

<div align="center">

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/lintsinghua/DeepAudit/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13+-3776ab.svg)](https://www.python.org/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lintsinghua/DeepAudit)

[![Stars](https://img.shields.io/github/stars/lintsinghua/DeepAudit?style=social)](https://github.com/lintsinghua/DeepAudit/stargazers)
[![Forks](https://img.shields.io/github/forks/lintsinghua/DeepAudit?style=social)](https://github.com/lintsinghua/DeepAudit/network/members)

</div>

## 🚀 v3.0.0 新特性

**DeepAudit v3.0.0** 带来了革命性的 **Multi-Agent 智能审计系统**：

- 🤖 **Multi-Agent 架构** — Orchestrator 编排决策，Analysis/Recon/Verification 多智能体协作
- 🧠 **RAG 知识库增强** — 代码语义理解 + CWE/CVE 漏洞知识库，精准识别安全风险
- 🔒 **沙箱漏洞验证** — Docker 安全容器自动执行 PoC，验证漏洞真实有效性
- 🛠️ **专业安全工具集成** — Semgrep、Bandit、Gitleaks、TruffleHog、OSV-Scanner

---

## 💡 这是什么？

**你是否也有这样的困扰？**

- 😫 人工审计的无力：哪怕我不吃不睡，也追不上代码迭代的速度
- 🤯 传统工具的噪音：每天都在清理误报，感觉自己像个垃圾分类员
- 😰 代码隐私的风险：想用 AI 却不敢"裸奔"，生怕源码泄露给云端 
- 🥺 外包项目的隐患：不知道里面藏了多少雷，却不得不签字验收

**DeepAudit 来拯救你！** 🦸‍♂️

- 全自动智能审计：AI 驱动的 Multi-Agent 系统自主编排审计策略
- 上下文精准理解：RAG 增强的代码语义理解，大大降低误报率
- 沙箱验证漏洞：自动生成 PoC 并在隔离环境验证，确保漏洞真实有效
- 支持本地私有部署：支持 Ollama 本地模型，代码数据可以不出内网

## 🎬 眼见为实：

| 智能仪表盘 | 即时分析 |
|:---:|:---:|
| ![仪表盘](frontend/public/images/example1.png) | ![即时分析](frontend/public/images/example2.png) |
| *一眼掌握项目安全态势* | *粘贴代码/上传文件，秒出结果* |

| Agent 审计 | 审计报告 |
|:---:|:---:|
| <img src="frontend/public/images/example3.png" alt="Agent审计" width="400"> | <img src="frontend/public/images/审计报告示例.png" alt="审计报告" width="400"> |
| *Multi-Agent 深度安全分析* | *专业报告，一键导出* |

| 审计规则管理 | 提示词模板管理 |
|:---:|:---:|
| ![审计规则](frontend/public/images/audit-rules.png) | ![提示词管理](frontend/public/images/prompt-manager.png) |
| *内置 OWASP Top 10，支持自定义规则* | *提示词可视化管理，支持在线测试* |

## ✨ 为什么选择我们？

<table>
<tr>
<td width="50%">

### 🤖 Multi-Agent 智能协作
- **Orchestrator Agent**: 统筹编排，自主决策审计策略
- **Recon Agent**: 信息收集，识别技术栈和入口点
- **Analysis Agent**: 深度分析，挖掘潜在安全漏洞
- **Verification Agent**: 沙箱验证，确认漏洞真实有效

### 🧠 RAG 知识库增强
- 代码语义理解，不只是关键词匹配
- CWE/CVE 漏洞知识库集成
- 精准漏洞识别，大幅降低误报

### 🎯 What-Why-How 三步修复
- **What**: 精准定位问题所在
- **Why**: 解释为什么这是个问题
- **How**: 给出可直接使用的修复建议

</td>
<td width="50%">

### 🔒 沙箱安全验证
- Docker 隔离容器执行 PoC
- 资源限制 + 网络隔离 + seccomp 策略
- 自动验证漏洞可利用性

### 🛠️ 专业安全工具集成
- **Semgrep**: 多语言静态分析
- **Bandit**: Python 安全扫描
- **Gitleaks/TruffleHog**: 密钥泄露检测
- **OSV-Scanner**: 依赖漏洞扫描

### 🔌 10+ LLM 平台任你选
OpenAI、Claude、Gemini、通义千问、DeepSeek、智谱AI...
还支持 Ollama 本地私有化部署！

</td>
</tr>
</table>

## 🚀 快速开始

### Docker Compose 一键部署（推荐）

```bash
# 1️⃣ 克隆项目
git clone https://github.com/lintsinghua/DeepAudit.git && cd DeepAudit

# 2️⃣ 配置你的 LLM API Key
cp backend/env.example backend/.env
# 编辑 backend/.env，填入你的 API Key

# 3️⃣ 一键启动！
docker compose up -d
```

🎉 **搞定！** 打开 http://localhost:3000 开始体验吧！

### Agent 审计模式部署（可选）

如需使用 Multi-Agent 深度审计功能：

```bash
# 启动包含 Milvus 向量数据库的完整服务
docker compose --profile agent up -d

# 构建安全沙箱镜像（用于漏洞验证）
cd docker/sandbox && ./build.sh
```

### 演示账户

系统内置演示账户，包含示例项目和审计数据：

- 📧 邮箱：`demo@example.com`
- 🔑 密码：`demo123`

> ⚠️ **生产环境请删除演示账户或修改密码！**

> 📖 更多部署方式请查看 [部署指南](docs/DEPLOYMENT.md)

## ✨ 核心能力

| 功能 | 说明 |
|------|------|
| 🤖 **Agent 审计** | Multi-Agent 架构，Orchestrator 自主编排决策，深度漏洞挖掘 |
| 🧠 **RAG 增强** | 代码语义理解，CWE/CVE 知识库检索，精准漏洞识别 |
| 🔒 **沙箱验证** | Docker 安全容器执行 PoC，自动验证漏洞有效性 |
| 🗂️ **项目管理** | GitHub/GitLab 一键导入，ZIP 上传，支持 10+ 编程语言 |
| ⚡ **即时分析** | 代码片段秒级分析，粘贴即用，无需创建项目 |
| 🔍 **智能审计** | Bug、安全、性能、风格、可维护性五维检测 |
| 💡 **可解释分析** | What-Why-How 模式，精准定位 + 修复建议 |
| 📋 **审计规则** | 内置 OWASP Top 10、代码质量、性能优化规则集 |
| 📝 **提示词模板** | 可视化管理审计提示词，支持中英文双语 |
| 📊 **可视化报告** | 质量仪表盘、趋势分析、PDF/JSON 一键导出 |
| ⚙️ **灵活配置** | 浏览器运行时配置 LLM，无需重启服务 |

## 🤖 支持的 LLM 平台

| 类型 | 平台 |
|------|------|
| 🌍 **国际平台** | OpenAI GPT · Claude · Gemini · DeepSeek |
| 🇨🇳 **国内平台** | 通义千问 · 智谱AI · Kimi · 文心一言 · MiniMax · 豆包 |
| 🏠 **本地部署** | Ollama (Llama3, CodeLlama, Qwen2.5, DeepSeek-Coder...) |

> 💡 支持 API 中转站，解决网络访问问题

详细配置请查看 [LLM 平台支持](docs/LLM_PROVIDERS.md)

## 🎯 未来蓝图

### ✅ 已完成

- ✅ **RAG 知识库** — 代码语义理解 + CWE/CVE 漏洞知识库集成
- ✅ **多 Agent 协作** — Orchestrator/Analysis/Recon/Verification 多智能体架构
- ✅ **沙箱验证** — Docker 安全容器自动执行 PoC 验证

### 🚧 开发中

- 🔄 **CI/CD 集成** — GitHub/GitLab 流水线自动审计，PR 批量扫描
- 🔄 **自动生成补丁** — 基于漏洞分析自动生成修复代码
- 🔄 **跨文件分析** — 代码知识图谱，理解模块间调用关系

### 📋 计划中

- 📋 **混合分析** — AI 分析 + 传统 SAST 工具验证，减少误报漏报
- 📋 **多仓库支持** — Gitea、Bitbucket 等更多平台支持

💡 **您的 Star 和反馈是我们前进的最大动力！有任何想法欢迎提 Issue 一起讨论~**

## 📚 文档

| 文档 | 说明 |
|------|------|
| [部署指南](docs/DEPLOYMENT.md) | Docker 部署 / 本地开发环境搭建 |
| [Agent 审计](docs/AGENT_AUDIT.md) | Multi-Agent 审计模块详解 |
| [配置说明](docs/CONFIGURATION.md) | 后端配置、审计规则、提示词模板 |
| [LLM 平台支持](docs/LLM_PROVIDERS.md) | 各家 LLM 的配置方法和 API Key 获取 |
| [常见问题](docs/FAQ.md) | 遇到问题先看这里 |
| [更新日志](CHANGELOG.md) | 版本更新记录 |
| [贡献指南](CONTRIBUTING.md) | 想参与开发？看这个 |
| [安全政策](SECURITY.md) / [免责声明](DISCLAIMER.md) | 使用前建议读一下 |

## 🤝 贡献

开源项目离不开社区的支持！无论是提 Issue、贡献代码，还是分享使用心得，都非常欢迎。

> 有想和我一起让工具变得更好的佬友们，欢迎联系我，和我一起为开源做一点贡献

**感谢每一位贡献者！**

[![Contributors](https://contrib.rocks/image?repo=lintsinghua/DeepAudit)](https://github.com/lintsinghua/DeepAudit/graphs/contributors)

## 📞 联系我们

- **项目链接**: [https://github.com/lintsinghua/DeepAudit](https://github.com/lintsinghua/DeepAudit)
- **问题反馈**: [Issues](https://github.com/lintsinghua/DeepAudit/issues)
- **作者邮箱**: lintsinghua@qq.com

---

<p align="center">
  <strong>⭐ 如果这个项目对你有帮助，请给我们一个 Star！</strong>
  <br>
  <em>你的支持是我们持续迭代的最大动力 💪</em>
</p>

## 📈 项目统计

[![Star History Chart](https://api.star-history.com/svg?repos=lintsinghua/DeepAudit&type=date&legend=top-left)](https://www.star-history.com/#lintsinghua/DeepAudit&type=date&legend=top-left)

---

<p align="center">
  ⚠️ 使用前请阅读 <a href="SECURITY.md">安全政策</a> 和 <a href="DISCLAIMER.md">免责声明</a>
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/lintsinghua">lintsinghua</a>
</p>
