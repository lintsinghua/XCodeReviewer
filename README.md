<div align="center">

# DeepAudit

### **AI-Powered Intelligent Code Security Audit Platform**

*让安全审计像呼吸一样简单*

<br/>

<img src="frontend/public/images/logo.png" alt="DeepAudit Logo" width="100%">

<br/>

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg?style=for-the-badge)](https://github.com/lintsinghua/DeepAudit/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-61dafb.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13+-3776ab.svg?style=for-the-badge&logo=python)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

<br/>

[![Stars](https://img.shields.io/github/stars/lintsinghua/DeepAudit?style=for-the-badge&color=gold)](https://github.com/lintsinghua/DeepAudit/stargazers)
[![Forks](https://img.shields.io/github/forks/lintsinghua/DeepAudit?style=for-the-badge)](https://github.com/lintsinghua/DeepAudit/network/members)
[![Issues](https://img.shields.io/github/issues/lintsinghua/DeepAudit?style=for-the-badge)](https://github.com/lintsinghua/DeepAudit/issues)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lintsinghua/DeepAudit)

<br/>

[🚀 快速开始](#-快速开始) •
[✨ 核心功能](#-核心功能) •
[🤖 Agent 审计](#-multi-agent-智能审计) •
[📚 文档](#-文档) •
[🤝 贡献](#-贡献)

<br/>

<img src="frontend/public/DeepAudit.gif" alt="DeepAudit Demo" width="90%">

</div>

---

## 🎉 v3.0.0 新特性

<table>
<tr>
<td align="center" width="25%">
<h3>🤖 Multi-Agent</h3>
<p>Orchestrator 编排决策<br/>多智能体自主协作</p>
</td>
<td align="center" width="25%">
<h3>🧠 RAG 增强</h3>
<p>代码语义理解<br/>CWE/CVE 知识库检索</p>
</td>
<td align="center" width="25%">
<h3>🔒 沙箱验证</h3>
<p>Docker 安全容器<br/>自动 PoC 验证</p>
</td>
<td align="center" width="25%">
<h3>🛠️ 工具集成</h3>
<p>Semgrep • Bandit<br/>Gitleaks • OSV-Scanner</p>
</td>
</tr>
</table>

---

## 💡 为什么需要 DeepAudit？

> **你是否也有这样的困扰？**

| 😫 痛点 | 💡 DeepAudit 解决方案 |
|---------|----------------------|
| 人工审计跟不上代码迭代速度 | **Multi-Agent 自主审计**，AI 自动编排审计策略 |
| 传统工具误报率高，每天都在清理噪音 | **RAG 知识库增强**，代码语义理解大幅降低误报 |
| 担心源码泄露给云端 AI | **支持 Ollama 本地部署**，代码数据不出内网 |
| 外包项目不知道藏了多少雷 | **沙箱 PoC 验证**，确认漏洞真实可利用 |

---

## 📸 界面预览

<div align="center">

### 🤖 Agent 审计入口

<img src="frontend/public/images/README-show/Agent审计入口（首页）.png" alt="Agent审计入口" width="90%">

*首页快速进入 Multi-Agent 深度审计*

</div>

<table>
<tr>
<td width="50%" align="center">
<strong>📋 审计流日志</strong><br/><br/>
<img src="frontend/public/images/README-show/审计流日志.png" alt="审计流日志" width="95%"><br/>
<em>实时查看 Agent 思考与执行过程</em>
</td>
<td width="50%" align="center">
<strong>🎛️ 智能仪表盘</strong><br/><br/>
<img src="frontend/public/images/README-show/仪表盘.png" alt="仪表盘" width="95%"><br/>
<em>一眼掌握项目安全态势</em>
</td>
</tr>
<tr>
<td width="50%" align="center">
<strong>⚡ 即时分析</strong><br/><br/>
<img src="frontend/public/images/README-show/即时分析.png" alt="即时分析" width="95%"><br/>
<em>粘贴代码 / 上传文件，秒出结果</em>
</td>
<td width="50%" align="center">
<strong>🗂️ 项目管理</strong><br/><br/>
<img src="frontend/public/images/README-show/项目管理.png" alt="项目管理" width="95%"><br/>
<em>GitHub/GitLab 导入，多项目协同管理</em>
</td>
</tr>
</table>

<div align="center">

### 📊 专业报告

<img src="frontend/public/images/README-show/审计报告示例.png" alt="审计报告" width="90%">

*一键导出 PDF / Markdown / JSON*（图中为快速模式，非Agent模式报告）

👉 [查看Agent审计完整报告示例](docs/audit_report_智能漏洞挖掘审计%20-%20完整示例_2025-12-15.html)

</div>

---

## 🚀 快速开始

### 📦 Docker Compose 一键部署（推荐）

```bash
# 1️⃣ 克隆项目
git clone https://github.com/lintsinghua/DeepAudit.git && cd DeepAudit

# 2️⃣ 配置 LLM API Key
cp backend/env.example backend/.env
# 编辑 backend/.env，填入你的 API Key

# 3️⃣ 构建沙箱镜像（Agent 漏洞验证必须）
cd docker/sandbox && chmod +x build.sh && ./build.sh && cd ../..

# 4️⃣ 启动所有服务
docker compose up -d
```

🎉 **完成！** 访问 **http://localhost:3000** 开始体验（包含 Multi-Agent 审计能力）

### 🔑 演示账户

| 📧 邮箱 | 🔑 密码 |
|--------|---------|
| `demo@example.com` | `demo123` |

> ⚠️ **生产环境请务必删除演示账户或修改密码！**

<details>
<summary>📖 更多部署方式（本地开发、生产环境配置）</summary>

查看 **[部署指南](docs/DEPLOYMENT.md)** 了解：
- 本地开发环境搭建
- 生产环境配置
- HTTPS 配置
- 反向代理设置
- 环境变量详解

</details>

---

## ✨ 核心功能

<table>
<tr>
<td width="50%">

### 🤖 Multi-Agent 智能审计

自主编排、深度分析、自动验证

- **Orchestrator Agent** — 统筹编排，制定审计策略
- **Recon Agent** — 信息收集，识别技术栈和入口点
- **Analysis Agent** — 深度分析，挖掘潜在安全漏洞
- **Verification Agent** — 沙箱验证，确认漏洞有效性

### 🧠 RAG 知识库增强

超越简单关键词匹配

- Tree-sitter AST 智能代码分块
- ChromaDB 向量数据库
- CWE / CVE 漏洞知识库集成
- 多语言支持：Python, JS, TS, Java, Go, PHP, Rust

### 🔒 安全沙箱验证

Docker 隔离环境执行 PoC

- 资源限制（CPU / Memory）
- 网络隔离
- seccomp 安全策略
- 自动生成并执行 PoC 代码

</td>
<td width="50%">

### 🛠️ 专业安全工具集成

| 工具 | 功能 |
|------|------|
| Semgrep | 多语言静态分析 |
| Bandit | Python 安全扫描 |
| Gitleaks | 密钥泄露检测 |
| TruffleHog | 深度密钥扫描 |
| OSV-Scanner | 依赖漏洞扫描 |
| npm audit | Node.js 依赖审计 |
| Safety | Python 依赖审计 |

### 🎯 What-Why-How 三步修复

- **What** — 精准定位问题所在
- **Why** — 解释为什么这是个问题
- **How** — 给出可直接使用的修复建议

### 📊 可视化报告

- 智能安全评分
- 漏洞趋势分析
- 一键导出 PDF / JSON

</td>
</tr>
</table>

---

## 🤖 Multi-Agent 智能审计

### 架构概览

<div align="center">
<img src="frontend/public/images/README-show/架构图.png" alt="DeepAudit 架构图" width="90%">
</div>

### 支持的漏洞类型

<table>
<tr>
<td>

| 漏洞类型 | 描述 |
|---------|------|
| `sql_injection` | SQL 注入 |
| `xss` | 跨站脚本攻击 |
| `command_injection` | 命令注入 |
| `path_traversal` | 路径遍历 |
| `ssrf` | 服务端请求伪造 |
| `xxe` | XML 外部实体注入 |

</td>
<td>

| 漏洞类型 | 描述 |
|---------|------|
| `insecure_deserialization` | 不安全反序列化 |
| `hardcoded_secret` | 硬编码密钥 |
| `weak_crypto` | 弱加密算法 |
| `authentication_bypass` | 认证绕过 |
| `authorization_bypass` | 授权绕过 |
| `idor` | 不安全直接对象引用 |

</td>
</tr>
</table>

> 📖 详细文档请查看 **[Agent 审计指南](docs/AGENT_AUDIT.md)**

---

## 🔌 支持的 LLM 平台

<table>
<tr>
<td align="center" width="33%">
<h3>🌍 国际平台</h3>
<p>
OpenAI GPT-4o / GPT-4<br/>
Claude 3.5 Sonnet / Opus<br/>
Google Gemini Pro<br/>
DeepSeek V3
</p>
</td>
<td align="center" width="33%">
<h3>🇨🇳 国内平台</h3>
<p>
通义千问 Qwen<br/>
智谱 GLM-4<br/>
Moonshot Kimi<br/>
文心一言 · MiniMax · 豆包
</p>
</td>
<td align="center" width="33%">
<h3>🏠 本地部署</h3>
<p>
<strong>Ollama</strong><br/>
Llama3 · Qwen2.5 · CodeLlama<br/>
DeepSeek-Coder · Codestral<br/>
<em>代码不出内网</em>
</p>
</td>
</tr>
</table>

> 💡 支持 API 中转站，解决网络访问问题 | 详细配置 → [LLM 平台支持](docs/LLM_PROVIDERS.md)

---

## 🎯 功能矩阵

| 功能 | 说明 | 模式 |
|------|------|------|
| 🤖 **Agent 深度审计** | Multi-Agent 协作，自主编排审计策略 | Agent |
| 🧠 **RAG 知识增强** | 代码语义理解，CWE/CVE 知识库检索 | Agent |
| 🔒 **沙箱 PoC 验证** | Docker 隔离执行，验证漏洞有效性 | Agent |
| 🗂️ **项目管理** | GitHub/GitLab 导入，ZIP 上传，10+ 语言支持 | 通用 |
| ⚡ **即时分析** | 代码片段秒级分析，粘贴即用 | 通用 |
| 🔍 **五维检测** | Bug · 安全 · 性能 · 风格 · 可维护性 | 通用 |
| 💡 **What-Why-How** | 精准定位 + 原因解释 + 修复建议 | 通用 |
| 📋 **审计规则** | 内置 OWASP Top 10，支持自定义规则集 | 通用 |
| 📝 **提示词模板** | 可视化管理，支持中英文双语 | 通用 |
| 📊 **报告导出** | PDF / Markdown / JSON 一键导出 | 通用 |
| ⚙️ **运行时配置** | 浏览器配置 LLM，无需重启服务 | 通用 |

---

## 🗺️ 未来蓝图

### ✅ 已完成 (v3.0.0)

- [x] Multi-Agent 协作架构（Orchestrator/Recon/Analysis/Verification）
- [x] RAG 知识库（代码语义 + CWE/CVE）
- [x] Docker 沙箱 PoC 验证
- [x] 专业安全工具集成

### 🚧 开发中

- [ ] **CI/CD 集成** — GitHub Actions / GitLab CI 流水线自动审计
- [ ] **自动补丁生成** — 基于漏洞分析自动生成修复代码
- [ ] **跨文件分析** — 代码知识图谱，理解模块间调用关系

### 📋 计划中

- [ ] **混合分析** — AI + 传统 SAST 联合验证，减少误报漏报
- [ ] **IDE 插件** — VS Code / JetBrains 集成
- [ ] **多仓库支持** — Gitea, Bitbucket, GitLab Self-hosted

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| 📘 [部署指南](docs/DEPLOYMENT.md) | Docker 部署、本地开发、生产配置 |
| 🤖 [Agent 审计](docs/AGENT_AUDIT.md) | Multi-Agent 模块详解 |
| ⚙️ [配置说明](docs/CONFIGURATION.md) | 后端配置、审计规则、提示词模板 |
| 🔌 [LLM 平台](docs/LLM_PROVIDERS.md) | 各家 LLM 配置方法和 API Key 获取 |
| 🛠️ [安全工具](docs/SECURITY_TOOLS_SETUP.md) | 安全扫描工具本地安装指南 |
| ❓ [常见问题](docs/FAQ.md) | 遇到问题先看这里 |
| 📜 [更新日志](CHANGELOG.md) | 版本更新记录 |
| 👥 [贡献指南](CONTRIBUTING.md) | 参与开发 |

---

## 🏗️ 技术栈

<table>
<tr>
<td width="50%">

### 🖥️ 前端
- **React 18** + TypeScript 5.7
- **Vite** 构建工具
- **TailwindCSS** + 自定义 Cyberpunk 主题
- **Zustand** 状态管理
- **React Query** 数据获取

</td>
<td width="50%">

### ⚙️ 后端
- **FastAPI** + Python 3.13
- **PostgreSQL** 数据存储
- **ChromaDB** 向量数据库
- **Docker** 沙箱容器
- **SSE** 实时事件流

</td>
</tr>
</table>

---

## 🤝 贡献

开源项目离不开社区的支持！无论是提 Issue、PR，还是分享使用心得，都非常欢迎 🙌

<a href="https://github.com/lintsinghua/DeepAudit/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=lintsinghua/DeepAudit" alt="Contributors" />
</a>

> 💬 想和我一起让工具变得更好？欢迎联系我，一起为开源做贡献！

---

## 🙏 致谢

DeepAudit 的诞生离不开以下优秀开源项目的支持与启发，在此表示衷心感谢！

### 🏗️ 架构参考

| 项目 | 说明 | License |
|------|------|---------|
| [**Strix**](https://github.com/AiGptCode/Strix) | Multi-Agent 安全审计架构参考，提供了 Agent 协作编排的优秀设计思路 | MIT |

### 🔧 集成工具

| 项目 | 说明 | License |
|------|------|---------|
| [**Kunlun-M (昆仑镜)**](https://github.com/LoRexxar/Kunlun-M) | PHP/JS 静态代码安全审计工具，集成为 Agent 分析工具之一 | MIT |
| [**Semgrep**](https://github.com/semgrep/semgrep) | 多语言静态分析引擎，支持自定义规则 | LGPL-2.1 |
| [**Bandit**](https://github.com/PyCQA/bandit) | Python 安全漏洞扫描工具 | Apache-2.0 |
| [**Gitleaks**](https://github.com/gitleaks/gitleaks) | Git 仓库密钥泄露检测工具 | MIT |
| [**TruffleHog**](https://github.com/trufflesecurity/trufflehog) | 深度密钥和凭证扫描器 | AGPL-3.0 |
| [**OSV-Scanner**](https://github.com/google/osv-scanner) | Google 开源的依赖漏洞扫描器 | Apache-2.0 |

### 🧠 核心依赖

| 项目 | 说明 | License |
|------|------|---------|
| [**LangChain**](https://github.com/langchain-ai/langchain) | LLM 应用开发框架 | MIT |
| [**LangGraph**](https://github.com/langchain-ai/langgraph) | Agent 状态图工作流引擎 | MIT |
| [**LiteLLM**](https://github.com/BerriAI/litellm) | 统一多 LLM 平台调用接口 | MIT |
| [**ChromaDB**](https://github.com/chroma-core/chroma) | 轻量级向量数据库 | Apache-2.0 |
| [**Tree-sitter**](https://github.com/tree-sitter/tree-sitter) | 增量解析库，用于代码 AST 分析 | MIT |
| [**FastAPI**](https://github.com/fastapi/fastapi) | 高性能 Python Web 框架 | MIT |
| [**React**](https://github.com/facebook/react) | 用户界面构建库 | MIT |

> 💡 感谢所有开源贡献者的无私奉献，让我们能站在巨人的肩膀上构建更好的工具！

---

## 📞 联系我们

<table>
<tr>
<td align="center">🌐 <strong>项目主页</strong></td>
<td><a href="https://github.com/lintsinghua/DeepAudit">github.com/lintsinghua/DeepAudit</a></td>
</tr>
<tr>
<td align="center">🐛 <strong>问题反馈</strong></td>
<td><a href="https://github.com/lintsinghua/DeepAudit/issues">Issues</a></td>
</tr>
<tr>
<td align="center">📧 <strong>作者邮箱</strong></td>
<td>lintsinghua@qq.com</td>
</tr>
</table>

---

<div align="center">

## ⭐ 如果这个项目对你有帮助，请给我们一个 Star！

**你的支持是我们持续迭代的最大动力 💪**

<br/>

[![Star History Chart](https://api.star-history.com/svg?repos=lintsinghua/DeepAudit&type=Date)](https://star-history.com/#lintsinghua/DeepAudit&Date)

<br/>

---

⚠️ 使用前请阅读 [安全政策](SECURITY.md) 和 [免责声明](DISCLAIMER.md)

<br/>

**Made with ❤️ by [lintsinghua](https://github.com/lintsinghua)**

</div>
