<div align="center">
  <a href="https://github.com/lintsinghua/DeepAudit">
    <img src="frontend/public/images/logo.png" alt="DeepAudit Logo" width="100%">
  </a>

  <br/>
  <br/>

  <!-- Slogan -->
  <h1>🕵️‍♂️ DeepAudit: The AI-Powered Security Auditor</h1>
  
  <p align="center">
    <strong>基于 Multi-Agent 协作的下一代代码安全审计平台</strong>
  </p>
  
  <p align="center">
    <em>"像黑客一样思考，像专家一样审计"</em>
  </p>
  
  <p align="center">
    🚀 <strong>Multi-Agent 编排</strong> · 🧠 <strong>RAG 知识增强</strong> · 🔒 <strong>沙箱 PoC 验证</strong> · 🛡️ <strong>0 误报目标</strong>
  </p>

  <br/>

  <!-- Badges -->
  <p align="center">
    <a href="https://github.com/lintsinghua/DeepAudit/stargazers"><img src="https://img.shields.io/github/stars/lintsinghua/DeepAudit?style=for-the-badge&logo=starship&color=fbbf24" alt="Stars"/></a>
    <a href="https://github.com/lintsinghua/DeepAudit/network/members"><img src="https://img.shields.io/github/forks/lintsinghua/DeepAudit?style=for-the-badge&logo=git&color=3b82f6" alt="Forks"/></a>
    <a href="https://github.com/lintsinghua/DeepAudit/issues"><img src="https://img.shields.io/github/issues/lintsinghua/DeepAudit?style=for-the-badge&logo=github&color=ef4444" alt="Issues"/></a>
    <a href="docs/DEPLOYMENT.md"><img src="https://img.shields.io/badge/Deployment-Docker-2496ED?style=for-the-badge&logo=docker" alt="Docker"/></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/lintsinghua/DeepAudit?style=for-the-badge&color=22c55e" alt="License"/></a>
  </p>

  <!-- Tech Stack -->
  <p align="center">
    <a href="https://skillicons.dev">
      <img src="https://skillicons.dev/icons?i=react,typescript,vite,tailwind,python,fastapi,postgres,docker,redis&theme=dark" alt="Tech Stack" />
    </a>
  </p>

  <br/>

  <!-- Quick Links -->
  <p align="center">
    <a href="#-快速开始"><strong>🚀 快速开始</strong></a> &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="docs/AGENT_AUDIT.md"><strong>🤖 Agent 原理</strong></a> &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="docs/DEPLOYMENT.md"><strong>📖 部署文档</strong></a> &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="https://github.com/lintsinghua/DeepAudit/issues"><strong>💬 交流反馈</strong></a>
  </p>

  <br/>

  <img src="frontend/public/DeepAudit.gif" alt="DeepAudit Demo" width="100%" style="border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.5);">

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

## 🚀 快速开始 (Docker)

### 1. 启动项目

复制一份 `backend/env.example` 为 `backend/.env`，并按需配置 LLM API Key。
然后执行以下命令一键启动：

```bash
# 1. 准备配置文件
cp backend/env.example backend/.env

# 2. 构建沙箱镜像 (首次运行必须)
cd docker/sandbox && chmod +x build.sh && ./build.sh && cd ../..

# 3. 启动服务
docker compose up -d
```

> 🎉 **启动成功！** 访问 http://localhost:3000 开始体验。

---

## 🔧 源码启动指南

适合开发者进行二次开发调试。

### 环境要求
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Docker (用于沙箱)

### 1. 后端启动

```bash
cd backend
# 激活虚拟环境 (推荐 uv/poetry)
source .venv/bin/activate 

# 安装依赖
pip install -r requirements.txt

# 启动 API 服务
uvicorn app.main:app --reload
```

### 2. 前端启动

```bash
cd frontend
npm install
npm run dev
```

### 3. 沙箱环境
开发模式下，仍需通过 Docker 启动沙箱服务。

```bash
cd docker/sandbox
./build.sh
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

## 🦖 发展路线图

我们正在持续演进，未来将支持更多语言和更强大的 Agent 能力。

- [x] **v1.0**: 基础静态分析，集成 Semgrep
- [x] **v2.0**: 引入 RAG 知识库，支持 Docker 安全沙箱
- [x] **v3.0**: **Multi-Agent 协作架构** (Current)
- [ ] 支持更多漏洞验证 PoC 模板
- [ ] 支持更多语言
- [ ] **自动修复 (Auto-Fix)**: Agent 直接提交 PR 修复漏洞
- [ ] **增量PR审计**: 持续跟踪 PR 变更，智能分析漏洞，并集成CI/CD流程
- [ ] **优化RAG**: 支持自定义知识库
- [ ] **优化Agent**: 支持自定义Agent

---

## 🤝 贡献与社区

### 贡献指南
我们非常欢迎您的贡献！无论是提交 Issue、PR 还是完善文档。
请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详情。

## 📄 许可证

本项目采用 [Apache-2.0 License](LICENSE) 开源。

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
