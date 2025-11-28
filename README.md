# XCodeReviewer - 您的智能代码审计伙伴 🚀

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

**XCodeReviewer** 是一个由大型语言模型（LLM）驱动的现代化代码审计平台，采用前后端分离架构，旨在为开发者提供智能、全面且极具深度的代码质量分析和审查服务。

## 🌟 为什么选择 XCodeReviewer？

在快节奏的软件开发中，保证代码质量至关重要。传统代码审计工具规则死板、效率低下，而人工审计则耗时耗力。XCodeReviewer 借助 LLM 的强大能力，彻底改变了代码审查的方式：

- **AI 驱动的深度分析**：超越传统静态分析，理解代码意图，发现深层逻辑问题。
- **多维度、全方位评估**：从**安全性**、**性能**、**可维护性**到**代码风格**，提供 360 度无死角的质量评估。
- **清晰、可行的修复建议**：独创 **What-Why-How** 模式，不仅告诉您"是什么"问题，还解释"为什么"，并提供"如何修复"的具体代码示例。
- **多平台LLM/本地LLM支持**: 已实现 10+ 主流平台API调用功能（Gemini、OpenAI、Claude、通义千问、DeepSeek、智谱AI、Kimi、文心一言、MiniMax、豆包、Ollama本地大模型），支持用户自由配置和切换。
- **前后端分离架构**：采用 React + FastAPI 现代化架构，支持独立部署和扩展，后端使用 LiteLLM 统一适配多种 LLM 平台。
- **可视化运行时配置**：无需重新构建镜像，直接在浏览器中配置所有 LLM 参数和 API Keys，支持 API 中转站，配置保存在本地浏览器，安全便捷。
- **现代化、高颜值的用户界面**：基于 React + TypeScript 构建，提供流畅、直观的操作体验。

## 🎬 项目演示

### 主要功能界面

#### 智能仪表盘
![智能仪表盘](frontend/public/images/example1.png)
*实时展示项目统计、质量趋势和系统性能，提供全面的代码审计概览*

#### 即时分析
![即时分析](frontend/public/images/example2.png)
*支持代码片段快速分析，提供详细的 What-Why-How 解释和修复建议*

#### 项目管理
![项目管理](frontend/public/images/example3.png)
*集成 GitHub/GitLab 仓库，支持多语言项目审计和批量代码分析*

## 🚀 快速开始

### 🐳 Docker Compose 部署（推荐）

完整的前后端分离部署方案，包含前端、后端和 PostgreSQL 数据库，一键启动所有服务。

```bash
# 1. 克隆项目
git clone https://github.com/lintsinghua/XCodeReviewer.git
cd XCodeReviewer

# 2. 配置后端环境变量
cp backend/env.example backend/.env
# 编辑 backend/.env 文件，配置 LLM API Key 等参数

# 3. 使用 Docker Compose 启动所有服务
docker-compose up -d

# 4. 访问应用
# 前端: http://localhost:5173
# 后端 API: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

**服务说明**：
| 服务 | 端口 | 说明 |
|------|------|------|
| `frontend` | 5173 | React 前端应用（开发模式） |
| `backend` | 8000 | FastAPI 后端 API |
| `db` | 5432 | PostgreSQL 数据库 |

**生产环境部署**：

如需生产环境部署，可使用根目录的 `Dockerfile` 构建前端静态文件并通过 Nginx 提供服务：

```bash
# 构建前端生产镜像
docker build -t xcodereviewer-frontend .

# 运行前端容器（端口 8888）
docker run -d -p 8888:80 --name xcodereviewer-frontend xcodereviewer-frontend

# 后端和数据库仍使用 docker-compose
docker-compose up -d db backend
```

---

### 💻 本地开发部署

适合需要开发或自定义修改的场景。

#### 环境要求
- Node.js 18+
- Python 3.13+
- PostgreSQL 15+
- pnpm 8+ (推荐) 或 npm/yarn

#### 后端启动

```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境（推荐使用 uv）
uv venv
source .venv/bin/activate  # Linux/macOS
# 或 .venv\Scripts\activate  # Windows

# 3. 安装依赖
uv pip install -e .

# 4. 配置环境变量
cp env.example .env
# 编辑 .env 文件，配置数据库和 LLM 参数

# 5. 初始化数据库
alembic upgrade head

# 6. 启动后端服务
uvicorn app.main:app --reload --port 8000
```

#### 前端启动

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
pnpm install  # 或 npm install / yarn install

# 3. 配置环境变量（可选，也可使用运行时配置）
cp .env.example .env

# 4. 启动开发服务器
pnpm dev

# 5. 访问应用
# 浏览器打开 http://localhost:5173
```

#### 后端核心配置说明

编辑 `backend/.env` 文件：

```env
# ========== 数据库配置 ==========
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=xcodereviewer

# ========== 安全配置 ==========
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# ========== LLM配置 ==========
# 支持的provider: openai, gemini, claude, qwen, deepseek, zhipu, moonshot, baidu, minimax, doubao, ollama
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=  # API中转站地址（可选）
LLM_TIMEOUT=150
LLM_TEMPERATURE=0.1
LLM_MAX_TOKENS=4096

# ========== 仓库扫描配置 ==========
GITHUB_TOKEN=your_github_token
GITLAB_TOKEN=your_gitlab_token
MAX_ANALYZE_FILES=50
LLM_CONCURRENCY=3
LLM_GAP_MS=2000
```

### 常见问题

<details>
<summary><b>如何快速切换 LLM 平台？</b></summary>

**方式一：浏览器配置（推荐）**

1. 访问 `http://localhost:5173/admin` 系统管理页面
2. 在"系统配置"标签页选择不同的 LLM 提供商
3. 填入对应的 API Key
4. 保存并刷新页面

**方式二：后端环境变量配置**

修改 `backend/.env` 中的配置：

```env
# 切换到 OpenAI
LLM_PROVIDER=openai
LLM_API_KEY=your_key

# 切换到通义千问
LLM_PROVIDER=qwen
LLM_API_KEY=your_key
```
</details>

<details>
<summary><b>遇到请求超时怎么办？</b></summary>

1. 增加超时时间：`LLM_TIMEOUT=300`
2. 使用代理：配置 `LLM_BASE_URL`
3. 切换到国内平台：通义千问、DeepSeek、智谱AI 等
4. 降低并发：`LLM_CONCURRENCY=1`
</details>

<details>
<summary><b>数据库模式如何选择？</b></summary>

**本地模式（推荐）**：数据存储在浏览器 IndexedDB，开箱即用，隐私安全
```env
VITE_USE_LOCAL_DB=true
```

**云端模式**：数据存储在 Supabase，支持多设备同步
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key
```

**后端数据库模式**：使用 PostgreSQL 存储，适合团队协作
</details>

<details>
<summary><b>如何使用 Ollama 本地大模型？</b></summary>

```bash
# 1. 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh  # macOS/Linux
# Windows: 访问 https://ollama.com/download

# 2. 拉取模型
ollama pull llama3  # 或 codellama、qwen2.5、deepseek-coder

# 3. 配置后端
# 在 backend/.env 中设置：
LLM_PROVIDER=ollama
LLM_MODEL=llama3
LLM_BASE_URL=http://localhost:11434/v1
```

推荐模型：`llama3`（综合）、`codellama`（代码专用）、`qwen2.5`（中文）
</details>

<details>
<summary><b>百度文心一言的 API Key 格式？</b></summary>

百度需要同时提供 API Key 和 Secret Key，用冒号分隔：
```env
LLM_PROVIDER=baidu
LLM_API_KEY=your_api_key:your_secret_key
```
获取地址：https://console.bce.baidu.com/qianfan/
</details>

<details>
<summary><b>如何使用 API 中转站？</b></summary>

许多用户使用 API 中转服务来访问 LLM（更稳定、更便宜）。配置方法：

**后端配置**（推荐）：
```env
LLM_PROVIDER=openai
LLM_API_KEY=中转站提供的Key
LLM_BASE_URL=https://your-proxy.com/v1
LLM_MODEL=gpt-4o-mini
```

**前端运行时配置**：
1. 访问系统管理页面（`/admin`）
2. 在"系统配置"标签页中配置 API 基础 URL 和 Key
3. 保存并刷新页面
</details>

### 🔑 获取 API Key

#### 支持的 LLM 平台

XCodeReviewer 支持 10+ 主流 LLM 平台，可根据需求自由选择：

| 平台类型 | 平台名称 | 特点 | 获取地址 |
|---------|---------|------|---------|
| **国际平台** | Google Gemini | 免费配额充足，推荐 | [获取](https://makersuite.google.com/app/apikey) |
| | OpenAI GPT | 稳定可靠，性能最佳 | [获取](https://platform.openai.com/api-keys) |
| | Anthropic Claude | 代码理解能力强 | [获取](https://console.anthropic.com/) |
| | DeepSeek | 性价比高 | [获取](https://platform.deepseek.com/) |
| **国内平台** | 阿里云通义千问 | 国内访问快 | [获取](https://dashscope.console.aliyun.com/) |
| | 智谱AI (GLM) | 中文支持好 | [获取](https://open.bigmodel.cn/) |
| | 月之暗面 Kimi | 长文本处理 | [获取](https://platform.moonshot.cn/) |
| | 百度文心一言 | 企业级服务 | [获取](https://console.bce.baidu.com/qianfan/) |
| | MiniMax | 多模态能力 | [获取](https://www.minimaxi.com/) |
| | 字节豆包 | 高性价比 | [获取](https://console.volcengine.com/ark) |
| **本地部署** | Ollama | 完全本地化，隐私安全 | [安装](https://ollama.com/) |

## ✨ 核心功能

<details>
<summary><b>🚀 项目管理</b></summary>

- **一键集成代码仓库**：无缝对接 GitHub、GitLab 等主流平台。
- **多语言"全家桶"支持**：覆盖 JavaScript, TypeScript, Python, Java, Go, Rust 等热门语言。
- **灵活的分支审计**：支持对指定代码分支进行精确分析。
- **ZIP 文件上传**：支持直接上传 ZIP 压缩包进行代码审计。
</details>

<details>
<summary><b>⚡ 即时分析</b></summary>

- **代码片段"随手贴"**：直接在 Web 界面粘贴代码，立即获得分析结果。
- **10+ 种语言即时支持**：满足您多样化的代码分析需求。
- **毫秒级响应**：快速获取代码质量评分和优化建议。
- **历史记录功能**：自动保存分析历史，支持查看和导出历史分析报告。
- **报告导出**：支持将即时分析结果导出为 JSON 或 PDF 格式。
</details>

<details>
<summary><b>🧠 智能审计</b></summary>

- **AI 深度代码理解**：支持多个主流 LLM 平台，后端使用 LiteLLM 统一适配，提供超越关键词匹配的智能分析。
- **五大核心维度检测**：
  - 🐛 **潜在 Bug**：精准捕捉逻辑错误、边界条件和空指针等问题。
  - 🔒 **安全漏洞**：识别 SQL 注入、XSS、敏感信息泄露等安全风险。
  - ⚡ **性能瓶颈**：发现低效算法、内存泄漏和不合理的异步操作。
  - 🎨 **代码风格**：确保代码遵循行业最佳实践和统一规范。
  - 🔧 **可维护性**：评估代码的可读性、复杂度和模块化程度。
</details>

<details>
<summary><b>💡 可解释性分析 (What-Why-How)</b></summary>

- **What (是什么)**：清晰地指出代码中存在的问题。
- **Why (为什么)**：详细解释该问题可能带来的潜在风险和影响。
- **How (如何修复)**：提供具体的、可直接使用的代码修复示例。
- **精准代码定位**：快速跳转到问题所在的行和列。
</details>

<details>
<summary><b>📊 可视化报告</b></summary>

- **代码质量仪表盘**：提供 0-100 分的综合质量评估，让代码健康状况一目了然。
- **多维度问题统计**：按类型和严重程度对问题进行分类统计。
- **质量趋势分析**：通过图表展示代码质量随时间的变化趋势。
- **报告导出**：支持 JSON 和 PDF 格式导出审计报告。
</details>

<details>
<summary><b>⚙️ 系统管理</b></summary>

访问 `/admin` 页面，提供完整的系统配置和数据管理功能：

- **🔧 可视化配置管理**（运行时配置）：
  - 🎯 **LLM 配置**：在浏览器中直接配置 API Keys、模型、超时等参数
  - 🔑 **平台密钥**：管理 10+ LLM 平台的 API Keys，支持快速切换
  - ⚡ **分析参数**：调整并发数、间隔时间、最大文件数等
  - 🌐 **API 中转站支持**：轻松配置第三方 API 代理服务
  
- **💾 数据库管理**：
  - 🏠 **三种模式**：本地 IndexedDB / Supabase 云端 / PostgreSQL 后端
  - 📤 **导出备份**：将数据导出为 JSON 文件
  - 📥 **导入恢复**：从备份文件恢复数据
  - 🗑️ **清空数据**：一键清理所有本地数据
</details>

<details>
<summary><b>👥 用户管理</b></summary>

- **用户注册与登录**：支持用户账户系统
- **JWT 认证**：安全的 Token 认证机制
- **权限控制**：基于角色的访问控制
</details>

## 🤝 贡献指南

我们热烈欢迎所有形式的贡献！无论是提交 issue、创建 PR，还是改进文档，您的每一次贡献对我们都至关重要。请联系我们了解详细信息。

### 开发流程

1.  **Fork** 本项目
2.  创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3.  提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4.  推送到分支 (`git push origin feature/AmazingFeature`)
5.  创建一个 **Pull Request**

## 👥 贡献者

感谢以下优秀的贡献者们，他们让 XCodeReviewer 更强大！

[![Contributors](https://contrib.rocks/image?repo=lintsinghua/XCodeReviewer)](https://github.com/lintsinghua/XCodeReviewer/graphs/contributors)

## 📞 联系我们

- **项目链接**: [https://github.com/lintsinghua/XCodeReviewer](https://github.com/lintsinghua/XCodeReviewer)
- **问题反馈**: [Issues](https://github.com/lintsinghua/XCodeReviewer/issues)
- **作者邮箱**: lintsinghua@qq.com（合作请注明来意）

## 🎯 未来计划（正在加急中）

目前 XCodeReviewer 定位为快速原型验证阶段，功能需要逐渐完善，根据项目后续发展和大家的建议，未来开发计划如下（尽快实现）：

- **✅ 多平台LLM支持**: 已实现 10+ 主流平台API调用功能
- **✅ 本地模型支持**: 已加入对 Ollama 本地大模型的调用功能
- **✅ 可视化配置管理**: 已实现运行时配置系统
- **✅ 专业报告文件生成**: 支持 JSON 和 PDF 格式导出
- **✅ 前后端分离架构**: 采用 FastAPI + React 现代化架构
- **✅ 用户认证系统**: JWT Token 认证和用户管理
- **🚧 CI/CD 集成与 PR 自动审查**: 计划实现 GitHub/GitLab CI 集成
- **Multi-Agent Collaboration**: 考虑引入多智能体协作架构
- **审计标准自定义**: 支持通过 YAML/JSON 定义团队特定的编码规范

---

⭐ 如果这个项目对您有帮助，请给我们一个 **Star**！您的支持是我们不断前进的动力！

[![Star History](https://api.star-history.com/svg?repos=lintsinghua/XCodeReviewer&type=Date)](https://star-history.com/#lintsinghua/XCodeReviewer&Date)

---

## 📄 免责声明 (Disclaimer)

本免责声明旨在明确用户使用本开源项目的相关责任和风险，保护项目作者、贡献者和维护者的合法权益。本开源项目提供的代码、工具及相关内容仅供参考和学习使用。

#### 1. **代码隐私与安全警告 (Code Privacy and Security Warning)**
- ⚠️ **重要提示**：本工具通过调用第三方LLM服务商API进行代码分析，**您的代码将被发送到所选择的LLM服务商服务器**。
- **严禁上传以下类型的代码**：
  - 包含商业机密、专有算法或核心业务逻辑的代码
  - 涉及国家秘密、国防安全或其他保密信息的代码
  - 包含敏感数据（如用户数据、密钥、密码、token等）的代码
  - 受法律法规限制不得外传的代码
  - 客户或第三方的专有代码（未经授权）
- 用户**必须自行评估代码的敏感性**，对上传代码及其可能导致的信息泄露承担全部责任。
- **建议**：对于敏感代码，请使用 Ollama 本地模型部署功能，或使用私有部署的LLM服务。
- 项目作者、贡献者和维护者**对因用户上传敏感代码导致的任何信息泄露、知识产权侵权、法律纠纷或其他损失不承担任何责任**。

#### 2. **非专业建议 (Non-Professional Advice)**
- 本工具提供的代码分析结果和建议**仅供参考**，不构成专业的安全审计、代码审查或法律意见。
- 用户必须结合人工审查、专业工具及其他可靠资源，对关键代码（尤其是涉及安全、金融、医疗等高风险领域）进行全面验证。

#### 3. **无担保与免责 (No Warranty and Liability Disclaimer)**
- 本项目以"原样"形式提供，**不附带任何明示或默示担保**，包括但不限于适销性、特定用途适用性及非侵权性。
- 作者、贡献者和维护者**不对任何直接、间接、附带、特殊、惩戒性或后果性损害承担责任**，包括但不限于数据丢失、系统中断、安全漏洞或商业损失，即使已知此类风险存在。

#### 4. **AI 分析局限性 (Limitations of AI Analysis)**
- 本工具依赖多种 AI 模型，分析结果可能包含**错误、遗漏或不准确信息**，无法保证100% 可靠性。
- AI 输出**不能替代人类专家判断**，用户应对最终代码质量及应用后果全权负责。

#### 5. **第三方服务与数据隐私 (Third-Party Services and Data Privacy)**
- 本项目集成 Google Gemini、OpenAI、Claude、通义千问、DeepSeek 等多个第三方LLM服务，以及 Supabase、GitHub 等服务，使用时须遵守其各自服务条款和隐私政策。
- **代码传输说明**：用户提交的代码将通过API发送到所选LLM服务商进行分析，传输过程和数据处理遵循各服务商的隐私政策。
- 用户需自行获取、管理 API 密钥，本项目**不存储、传输或处理用户的API密钥和敏感信息**。
- 第三方服务的可用性、准确性、隐私保护、数据留存政策或中断风险，由服务提供商负责，本项目作者不承担任何连带责任。

#### 6. **用户责任 (User Responsibilities)**
- 用户在使用前须确保其代码不侵犯第三方知识产权，不包含保密信息，并严格遵守开源许可证及相关法规。
- 用户**对上传代码的内容、性质和合规性承担全部责任**，包括但不限于：
  - 确保代码不包含敏感信息或商业机密
  - 确保拥有代码的使用和分析权限
  - 遵守所在国家/地区关于数据保护和隐私的法律法规
  - 遵守公司或组织的保密协议和安全政策
- **严禁将本工具用于非法、恶意或损害他人权益的活动**，用户对所有使用后果承担全部法律与经济责任。

#### 7. **开源贡献 (Open Source Contributions)**
- 贡献者的代码、内容或建议**不代表项目官方观点**，其准确性、安全性及合规性由贡献者自行负责。
- 项目维护者保留审查、修改、拒绝或移除任何贡献的权利。

如有疑问，请通过 GitHub Issues 联系维护者。本免责声明受项目所在地法律管辖。
