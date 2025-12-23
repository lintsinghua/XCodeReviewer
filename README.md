# DeepAudit - 人人拥有的 AI 审计战队，让漏洞挖掘触手可及 🦸‍♂️

<div style="width: 100%; max-width: 600px; margin: 0 auto;">
  <img src="frontend/public/images/logo.png" alt="DeepAudit Logo" style="width: 100%; height: auto; display: block; margin: 0 auto;">
</div>

<div align="center">

[![Version](https://img.shields.io/badge/version-3.0.2-blue.svg)](https://github.com/lintsinghua/DeepAudit/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776ab.svg)](https://www.python.org/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lintsinghua/DeepAudit)

[![Stars](https://img.shields.io/github/stars/lintsinghua/DeepAudit?style=social)](https://github.com/lintsinghua/DeepAudit/stargazers)
[![Forks](https://img.shields.io/github/forks/lintsinghua/DeepAudit?style=social)](https://github.com/lintsinghua/DeepAudit/network/members)

<a href="https://trendshift.io/repositories/15634" target="_blank"><img src="https://trendshift.io/api/badge/repositories/15634" alt="lintsinghua%2FDeepAudit | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

<p align="center">
  <strong>简体中文</strong> | <a href="README_EN.md">English</a>
</p>

</div>

<div align="center">
  <img src="frontend/public/DeepAudit.gif" alt="DeepAudit Demo" width="90%">
</div>

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

👉 [查看Agent审计完整报告示例](https://lintsinghua.github.io/)

</div>

---

## ⚡ 项目概述

**DeepAudit** 是一个基于 **Multi-Agent 协作架构**的下一代代码安全审计平台。它不仅仅是一个静态扫描工具，而是模拟安全专家的思维模式，通过多个智能体（**Orchestrator**, **Recon**, **Analysis**, **Verification**）的自主协作，实现对代码的深度理解、漏洞挖掘和 **自动化沙箱 PoC 验证**。

我们致力于解决传统 SAST 工具的三大痛点：
- **误报率高** — 缺乏语义理解，大量误报消耗人力
- **业务逻辑盲点** — 无法理解跨文件调用和复杂逻辑
- **缺乏验证手段** — 不知道漏洞是否真实可利用

用户只需导入项目，DeepAudit 便全自动开始工作：识别技术栈 → 分析潜在风险 → 生成脚本 → 沙箱验证 → 生成报告，最终输出一份专业审计报告。

> **核心理念**: 让 AI 像黑客一样攻击，像专家一样防御。

## 💡 为什么选择 DeepAudit？

<div align="center">

| 😫 传统审计的痛点 | 💡 DeepAudit 解决方案 |
| :--- | :--- |
| **人工审计效率低**<br>跨不上 CI/CD 代码迭代速度，拖慢发布流程 | **🤖 Multi-Agent 自主审计**<br>AI 自动编排审计策略，全天候自动化执行 |
| **传统工具误报多**<br>缺乏语义理解，每天花费大量时间清洗噪音 | **🧠 RAG 知识库增强**<br>结合代码语义与上下文，大幅降低误报率 |
| **数据隐私担忧**<br>担心核心源码泄露给云端 AI，无法满足合规要求 | **🔒 支持 Ollama 本地部署**<br>数据不出内网，支持 Llama3/DeepSeek 等本地模型 |
| **无法确认真实性**<br>外包项目漏洞多，不知道哪些漏洞真实可被利用 | **💥 沙箱 PoC 验证**<br>自动生成并执行攻击脚本，确认漏洞真实危害 |

</div>

---

## 🏗️ 系统架构

### 整体架构图

DeepAudit 采用微服务架构，核心由 Multi-Agent 引擎驱动。

<div align="center">
<img src="frontend/public/images/README-show/架构图.png" alt="DeepAudit 架构图" width="90%">
</div>

### 🔄 审计工作流

| 步骤 | 阶段 | 负责 Agent | 主要动作 |
|:---:|:---:|:---:|:---|
| 1 | **策略规划** | **Orchestrator** | 接收审计任务，分析项目类型，制定审计计划，下发任务给子 Agent |
| 2 | **信息收集** | **Recon Agent** | 扫描项目结构，识别框架/库/API，提取攻击面（Entry Points） |
| 3 | **漏洞挖掘** | **Analysis Agent** | 结合 RAG 知识库与 AST 分析，深度审查代码，发现潜在漏洞 |
| 4 | **PoC 验证** | **Verification Agent** | **(关键)** 编写 PoC 脚本，在 Docker 沙箱中执行。如失败则自我修正重试 |
| 5 | **报告生成** | **Orchestrator** | 汇总所有发现，剔除被验证为误报的漏洞，生成最终报告 |

### 📂 项目代码结构

```text
DeepAudit/
├── backend/                        # Python FastAPI 后端
│   ├── app/
│   │   ├── agents/                 # Multi-Agent 核心逻辑
│   │   │   ├── orchestrator.py     # 总指挥：任务编排
│   │   │   ├── recon.py            # 侦察兵：资产识别
│   │   │   ├── analysis.py         # 分析师：漏洞挖掘
│   │   │   └── verification.py     # 验证者：沙箱 PoC
│   │   ├── core/                   # 核心配置与沙箱接口
│   │   ├── models/                 # 数据库模型
│   │   └── services/               # RAG, LLM 服务封装
│   └── tests/                      # 单元测试
├── frontend/                       # React + TypeScript 前端
│   ├── src/
│   │   ├── components/             # UI 组件库
│   │   ├── pages/                  # 页面路由
│   │   └── stores/                 # Zustand 状态管理
├── docker/                         # Docker 部署配置
│   ├── sandbox/                    # 安全沙箱镜像构建
│   └── postgres/                   # 数据库初始化
└── docs/                           # 详细文档
```

---

## 🚀 快速开始

### 方式一：一行命令部署（推荐）

使用预构建的 Docker 镜像，无需克隆代码，一行命令即可启动：

```bash
curl -fsSL https://raw.githubusercontent.com/lintsinghua/DeepAudit/v3.0.0/docker-compose.prod.yml | docker compose -f - up -d
```

## 🇨🇳 国内加速部署（作者亲测非常无敌之快）

使用南京大学镜像站加速拉取 Docker 镜像（将 `ghcr.io` 替换为 `ghcr.nju.edu.cn`）：

```bash
# 国内加速版 - 使用南京大学 GHCR 镜像站
curl -fsSL https://raw.githubusercontent.com/lintsinghua/DeepAudit/v3.0.0/docker-compose.prod.cn.yml | docker compose -f - up -d
```
<details>
<summary>手动拉取镜像（如需单独拉取）（点击展开）</summary>

```bash
# 前端镜像
docker pull ghcr.nju.edu.cn/lintsinghua/deepaudit-frontend:latest

# 后端镜像
docker pull ghcr.nju.edu.cn/lintsinghua/deepaudit-backend:latest

# 沙箱镜像
docker pull ghcr.nju.edu.cn/lintsinghua/deepaudit-sandbox:latest
```
</details>

> 💡 镜像源由 [南京大学开源镜像站](https://mirrors.nju.edu.cn/) 提供支持

> 🎉 **启动成功！** 访问 http://localhost:3000 开始体验。

---

### 方式二：克隆代码部署

适合需要自定义配置或二次开发的用户：

```bash
# 1. 克隆项目
git clone https://github.com/lintsinghua/DeepAudit.git && cd DeepAudit

# 2. 配置环境变量
cp backend/env.example backend/.env
# 编辑 backend/.env 填入你的 LLM API Key

# 3. 一键启动
docker compose up -d
```

> 首次启动会自动构建沙箱镜像，可能需要几分钟。

---

## 🔧 源码开发指南

适合开发者进行二次开发调试。

### 环境要求
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- Docker (用于沙箱)

### 1. 后端启动

```bash
cd backend
# 使用 uv 管理环境（推荐）
uv sync
source .venv/bin/activate

# 启动 API 服务
uvicorn app.main:app --reload
```

### 2. 前端启动

```bash
cd frontend
pnpm install
pnpm dev
```

### 3. 沙箱环境

开发模式下需要本地 Docker 拉取沙箱镜像：

```bash
# 标准拉取
docker pull ghcr.io/lintsinghua/deepaudit-sandbox:latest

# 国内加速（南京大学镜像站）
docker pull ghcr.nju.edu.cn/lintsinghua/deepaudit-sandbox:latest
```

---

## 🤖 Multi-Agent 智能审计

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

💡 支持 API 中转站，解决网络访问问题 | 详细配置 → [LLM 平台支持](docs/LLM_PROVIDERS.md)

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

## 🦖 发展路线图

我们正在持续演进，未来将支持更多语言和更强大的 Agent 能力。

- [x] 基础静态分析，集成 Semgrep
- [x] 引入 RAG 知识库，支持 Docker 安全沙箱
- [x] **Multi-Agent 协作架构** (Current)
- [ ] 支持更真实的模拟服务环境，进行更真实漏洞验证流程
- [ ] 沙箱从function_call优化集成为稳定MCP服务
- [ ] **自动修复 (Auto-Fix)**: Agent 直接提交 PR 修复漏洞
- [ ] **增量PR审计**: 持续跟踪 PR 变更，智能分析漏洞，并集成CI/CD流程
- [ ] **优化RAG**: 支持自定义知识库

---

## 🤝 贡献与社区

### 贡献指南
我们非常欢迎您的贡献！无论是提交 Issue、PR 还是完善文档。
请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详情。

### 📬 联系作者

<div align="center">

**欢迎大家来和我交流探讨！无论是技术问题、功能建议还是合作意向，都期待与你沟通~**

| 联系方式 | |
|:---:|:---:|
| 📧 **邮箱** | **lintsinghua@qq.com** |
| 🐙 **GitHub** | [@lintsinghua](https://github.com/lintsinghua) |

</div>

### 💬 交流群

<div align="center">

**欢迎大家入群交流分享、学习、摸鱼~**

<img src="frontend/public/images/DeepAudit群聊.png" alt="QQ交流群" width="200">

</div>

## 📄 许可证

本项目采用 [AGPL-3.0 License](LICENSE) 开源。

## 📈 项目热度

<a href="https://star-history.com/#lintsinghua/DeepAudit&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lintsinghua/DeepAudit&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lintsinghua/DeepAudit&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lintsinghua/DeepAudit&type=Date" />
 </picture>
</a>

---

<div align="center">
  <strong>Made with ❤️ by <a href="https://github.com/lintsinghua">lintsinghua</a></strong>
</div>

---

## 致谢

感谢以下开源项目的支持：

[FastAPI](https://fastapi.tiangolo.com/) · [LangChain](https://langchain.com/) · [LangGraph](https://langchain-ai.github.io/langgraph/) · [ChromaDB](https://www.trychroma.com/) · [LiteLLM](https://litellm.ai/) · [Tree-sitter](https://tree-sitter.github.io/) · [Kunlun-M](https://github.com/LoRexxar/Kunlun-M) · [Strix](https://github.com/usestrix/strix) · [React](https://react.dev/) · [Vite](https://vitejs.dev/) · [Radix UI](https://www.radix-ui.com/) · [TailwindCSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)

---

## ⚠️ 重要安全声明

### 法律合规声明
1. 禁止**任何未经授权的漏洞测试、渗透测试或安全评估**
2. 本项目仅供网络空间安全学术研究、教学和学习使用
3. 严禁将本项目用于任何非法目的或未经授权的安全测试

### 漏洞上报责任
1. 发现任何安全漏洞时，请及时通过合法渠道上报
2. 严禁利用发现的漏洞进行非法活动
3. 遵守国家网络安全法律法规，维护网络空间安全

### 使用限制
- 仅限在授权环境下用于教育和研究目的
- 禁止用于对未授权系统进行安全测试
- 使用者需对自身行为承担全部法律责任

### 免责声明
作者不对任何因使用本项目而导致的直接或间接损失负责，使用者需对自身行为承担全部法律责任。

---

## 📖 详细安全政策

有关安装政策、免责声明、代码隐私、API使用安全和漏洞报告的详细信息，请参阅 [DISCLAIMER.md](DISCLAIMER.md) 和 [SECURITY.md](SECURITY.md) 文件。

### 快速参考
- 🔒 **代码隐私警告**: 您的代码将被发送到所选择的LLM服务商服务器
- 🛡️ **敏感代码处理**: 使用本地模型处理敏感代码
- ⚠️ **合规要求**: 遵守数据保护和隐私法律法规
- 📧 **漏洞报告**: 发现安全问题请通过合法渠道上报
