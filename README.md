# XCodeReviewer - 您的智能代码审计伙伴 🚀

<div style="width: 100%; max-width: 600px; margin: 0 auto;">
  <img src="public/images/logo.png" alt="XCodeReviewer Logo" style="width: 100%; height: auto; display: block; margin: 0 auto;">
</div>

<div align="center">
  <p>
    <a href="README.md">中文</a> •
    <a href="README_EN.md">English</a>
  </p>
</div>

[![构建状态](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/lintsinghua/XCodeReviewer)
[![许可证: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.0.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.1.4-646CFF.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E.svg)](https://supabase.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-4285F4.svg)](https://ai.google.dev/)

**XCodeReviewer** 是一个由大型语言模型（LLM）驱动的现代化代码审计平台，旨在为开发者提供智能、全面且极具深度的代码质量分析和审查服务。

## 🌟 为什么选择 XCodeReviewer？

在快节奏的软件开发中，保证代码质量至关重要。传统代码审计工具规则死板、效率低下，而人工审计则耗时耗力。XCodeReviewer 借助 Google Gemini AI 的强大能力，彻底改变了代码审查的方式：

- **AI 驱动的深度分析**：超越传统静态分析，理解代码意图，发现深层逻辑问题。
- **多维度、全方位评估**：从**安全性**、**性能**、**可维护性**到**代码风格**，提供 360 度无死角的质量评估。
- **清晰、可行的修复建议**：独创 **What-Why-How** 模式，不仅告诉您“是什么”问题，还解释“为什么”，并提供“如何修复”的具体代码示例。
- **实时反馈，即时提升**：无论是代码片段还是整个代码仓库，都能获得快速、准确的分析结果。
- **现代化、高颜值的用户界面**：基于 React + TypeScript 构建，提供流畅、直观的操作体验。

## 🎬 项目演示

### 主要功能界面

#### 智能仪表盘
![智能仪表盘](public/images/example1.png)
*实时展示项目统计、质量趋势和系统性能，提供全面的代码审计概览*

#### 即时分析
![即时分析](public/images/example2.png)
*支持代码片段快速分析，提供详细的 What-Why-How 解释和修复建议*

#### 项目管理
![项目管理](public/images/example3.png)
*集成 GitHub/GitLab 仓库，支持多语言项目审计和批量代码分析*

## 🚀 快速开始

### 🐳 Docker 部署（推荐）

使用 Docker 可以快速部署应用，无需配置 Node.js 环境。

1. **克隆项目**
   ```bash
   git clone https://github.com/lintsinghua/XCodeReviewer.git
   cd XCodeReviewer
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，至少需要配置 VITE_GEMINI_API_KEY
   ```

3. **构建并启动**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **访问应用**
   
   在浏览器中打开 `http://localhost:5174`

### 💻 本地开发部署

如果需要进行开发或自定义修改，可以使用本地部署方式。

#### 环境要求

- **Node.js**: `18+`
- **pnpm**: `8+` (推荐) 或 `npm` / `yarn`
- **Google Gemini API Key**: 用于 AI 代码分析

#### 安装与启动

1.  **克隆项目**
    ```bash
    git clone https://github.com/lintsinghua/XCodeReviewer.git
    cd XCodeReviewer
    ```

2.  **安装依赖**
    ```bash
    # 使用 pnpm (推荐)
    pnpm install
    
    # 或使用 npm
    npm install
    
    # 或使用 yarn
    yarn install
    ```

3.  **配置环境变量**
    ```bash
    # 复制环境变量模板
    cp .env.example .env
    ```
    
    编辑 `.env` 文件，配置必要的环境变量：
    ```env
    # Google Gemini AI 配置 (必需)
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_GEMINI_MODEL=gemini-2.5-flash
    VITE_GEMINI_TIMEOUT_MS=25000
    
    # Supabase 配置 (可选，用于数据持久化)
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key-here
    
    # GitHub 集成 (可选，用于仓库分析)
    VITE_GITHUB_TOKEN=your_github_token_here
    
    # 应用配置
    VITE_APP_ID=xcodereviewer
    
    # 分析配置
    VITE_MAX_ANALYZE_FILES=40
    VITE_LLM_CONCURRENCY=2
    VITE_LLM_GAP_MS=500
    ```

4.  **启动开发服务器**
    ```bash
    pnpm dev
    ```

5.  **访问应用**
    在浏览器中打开 `http://localhost:5173`

### 🔑 获取 API Key

#### Google Gemini API Key（预计后续会开放更多主流平台API功能）
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新的 API Key
3. 将 API Key 添加到 `.env` 文件中的 `VITE_GEMINI_API_KEY`

#### Supabase 配置（可选）
1. 访问 [Supabase](https://supabase.com/) 创建新项目
2. 在项目设置中获取 URL 和匿名密钥
3. 运行数据库迁移脚本：
   ```bash
   # 在 Supabase SQL 编辑器中执行
   cat supabase/migrations/full_schema.sql
   ```
4. 如果不配置 Supabase，系统将以演示模式运行，数据不会持久化

## ✨ 核心功能

<details>
<summary><b>🚀 项目管理</b></summary>

- **一键集成代码仓库**：无缝对接 GitHub、GitLab 等主流平台。
- **多语言“全家桶”支持**：覆盖 JavaScript, TypeScript, Python, Java, Go, Rust 等热门语言。
- **灵活的分支审计**：支持对指定代码分支进行精确分析。
</details>

<details>
<summary><b>⚡ 即时分析</b></summary>

- **代码片段“随手贴”**：直接在 Web 界面粘贴代码，立即获得分析结果。
- **10+ 种语言即时支持**：满足您多样化的代码分析需求。
- **毫秒级响应**：快速获取代码质量评分和优化建议。
</details>

<details>
<summary><b>🧠 智能审计</b></summary>

- **AI 深度代码理解**：基于 Google Gemini（预计后续会开放更多主流平台API功能），提供超越关键词匹配的智能分析。
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
</details>

## 🛠️ 技术栈

| 分类 | 技术 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | `React 18` `TypeScript` `Vite` | 现代化前端开发栈，支持热重载和类型安全 |
| **UI 组件** | `Tailwind CSS` `Radix UI` `Lucide React` | 响应式设计，无障碍访问，丰富的图标库 |
| **数据可视化** | `Recharts` | 专业的图表库，支持多种图表类型 |
| **路由管理** | `React Router v6` | 单页应用路由解决方案 |
| **状态管理** | `React Hooks` `Sonner` | 轻量级状态管理和通知系统 |
| **AI 引擎** | `Google Gemini 2.5 Flash` （预计后续会开放更多主流平台API功能）| 强大的大语言模型，支持代码分析 |
| **后端服务** | `Supabase` `PostgreSQL` | 全栈后端即服务，实时数据库 |
| **HTTP 客户端** | `Axios` `Ky` | 现代化的 HTTP 请求库 |
| **代码质量** | `Biome` `Ast-grep` `TypeScript` | 代码格式化、静态分析和类型检查 |
| **构建工具** | `Vite` `PostCSS` `Autoprefixer` | 快速的构建工具和 CSS 处理 |

## 📁 项目结构

```
XCodeReviewer/
├── src/
│   ├── app/                # 应用配置
│   │   ├── App.tsx         # 主应用组件
│   │   ├── main.tsx        # 应用入口点
│   │   └── routes.tsx      # 路由配置
│   ├── components/         # React 组件
│   │   ├── layout/         # 布局组件 (Header, Footer, PageMeta)
│   │   ├── ui/             # UI 组件库 (基于 Radix UI)
│   │   └── debug/          # 调试组件
│   ├── pages/              # 页面组件
│   │   ├── Dashboard.tsx   # 仪表盘
│   │   ├── Projects.tsx    # 项目管理
│   │   ├── InstantAnalysis.tsx # 即时分析
│   │   ├── AuditTasks.tsx  # 审计任务
│   │   └── AdminDashboard.tsx # 系统管理
│   ├── features/           # 功能模块
│   │   ├── analysis/       # 分析相关服务
│   │   │   └── services/   # AI 代码分析引擎
│   │   └── projects/       # 项目相关服务
│   │       └── services/   # 仓库扫描、ZIP 文件扫描
│   ├── shared/             # 共享工具
│   │   ├── config/         # 配置文件 (数据库、环境变量)
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── hooks/          # 自定义 React Hooks
│   │   ├── utils/          # 工具函数
│   │   └── constants/      # 常量定义
│   └── assets/             # 静态资源
│       └── styles/         # 样式文件
├── supabase/
│   └── migrations/         # 数据库迁移文件
├── public/
│   └── images/             # 图片资源
├── scripts/                # 构建和设置脚本
└── rules/                  # 代码规则配置
```

## 🎯 使用指南

### 即时代码分析
1. 访问 `/instant-analysis` 页面
2. 选择编程语言（支持 10+ 种语言）
3. 粘贴代码或上传文件
4. 点击"开始分析"获得 AI 分析结果
5. 查看详细的问题报告和修复建议

### 项目管理
1. 访问 `/projects` 页面
2. 点击"新建项目"创建项目
3. 配置仓库 URL 和扫描参数
4. 启动代码审计任务
5. 查看审计结果和问题统计

### 审计任务
1. 在项目详情页创建审计任务
2. 选择扫描分支和排除模式
3. 配置分析深度和范围
4. 监控任务执行状态
5. 查看详细的问题报告

### 构建和部署

```bash
# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview

# 代码检查
pnpm lint
```

### 环境变量说明
| 变量名 | 必需 | 说明 |
|--------|------|------|
| `VITE_GEMINI_API_KEY` | ✅ | Google Gemini API 密钥 |
| `VITE_GEMINI_MODEL` | ❌ | AI 模型名称 (默认: gemini-2.5-flash) |
| `VITE_GEMINI_TIMEOUT_MS` | ❌ | 请求超时时间 (默认: 25000ms) |
| `VITE_SUPABASE_URL` | ❌ | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | ❌ | Supabase 匿名密钥 |
| `VITE_APP_ID` | ❌ | 应用标识符 (默认: xcodereviewer) |

## 🤝 贡献指南

我们热烈欢迎所有形式的贡献！无论是提交 issue、创建 PR，还是改进文档，您的每一次贡献对我们都至关重要。请联系我们了解详细信息。

### 开发流程

1.  **Fork** 本项目
2.  创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3.  提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4.  推送到分支 (`git push origin feature/AmazingFeature`)
5.  创建一个 **Pull Request**

## 🙏 致谢

- **[Google Gemini AI](https://ai.google.dev/)**: 提供强大的 AI 分析能力
- **[Supabase](https://supabase.com/)**: 提供便捷的后端即服务支持
- **[Radix UI](https://www.radix-ui.com/)**: 提供无障碍的 UI 组件
- **[Tailwind CSS](https://tailwindcss.com/)**: 提供现代化的 CSS 框架
- **[Recharts](https://recharts.org/)**: 提供专业的图表组件
- 以及所有本项目所使用的开源软件的作者们！

## 📞 联系我们

- **项目链接**: [https://github.com/lintsinghua/XCodeReviewer](https://github.com/lintsinghua/XCodeReviewer)
- **问题反馈**: [Issues](https://github.com/lintsinghua/XCodeReviewer/issues)
- **作者邮箱**: tsinghuaiiilove@gmail.com

## 🎯 未来计划（正在加急中）

目前 XCodeReviewer 定位为快速原型验证阶段，功能需要逐渐完善，根据项目后续发展和大家的建议，未来开发计划如下（尽快实现）：

- **多平台/本地模型支持**: 未来会尽快加入OpenAI、Claude、通义千问等各大国内外主流模型API调用功能，以及对本地大模型调用的功能（满足数据隐私需求）
- **Multi-Agent Collaboration**: 考虑引入多智能体协作架构，会实现`Agent+人工对话`反馈的功能，包括多轮对话流程展示，人工对话中断干涉等，以获得更清晰、透明、监督性的审计过程，提升审计质量
- **专业报告文件生成**: 根据不同的需求生成相关格式的专业审计报告文件，支持文件报告格式定制等
- **审计标准自定义**: 不同团队有自己的编码规范，不同项目有特定的安全要求，也正是我们这个项目想后续做的东西。当前的版本还属于一个“半黑盒模式”，项目通过 Prompt 工程来引导分析方向和定义审计标准，实际分析效果由强大的预训练AI 模型内置知识决定。后续将结合强化学习、监督学习微调等方法，开发以支持自定义规则配置，通过YAML或者JSON定义团队特定规则，提供常见框架的最佳实践模板等等，以获得更加符合需求和标准的审计结果
---

⭐ 如果这个项目对您有帮助，请给我们一个 **Star**！您的支持是我们不断前进的动力！
[![Star History](https://api.star-history.com/svg?repos=lintsinghua/XCodeReviewer&type=Date)](https://star-history.com/#lintsinghua/XCodeReviewer&Date)
---

## 📄 免责声明 (Disclaimer)

#### 1. **非专业建议 (Non-Professional Advice)**
- 本工具提供的代码分析结果和建议**仅供参考**，不构成专业的安全审计、代码审查或法律意见。
- 用户必须结合人工审查、专业工具及其他可靠资源，对关键代码（尤其是涉及安全、金融、医疗等高风险领域）进行全面验证。

#### 2. **无担保与免责 (No Warranty and Liability Disclaimer)**
- 本项目以“原样”形式提供，**不附带任何明示或默示担保**，包括但不限于适销性、特定用途适用性及非侵权性。
- 作者、贡献者和维护者**不对任何直接、间接、附带、特殊、惩戒性或后果性损害承担责任**，包括但不限于数据丢失、系统中断、安全漏洞或商业损失，即使已知此类风险存在。

#### 3. **AI 分析局限性 (Limitations of AI Analysis)**
- 本工具依赖 Google Gemini 等 AI 模型，分析结果可能包含**错误、遗漏或不准确信息**，无法保证100% 可靠性。
- AI 输出**不能替代人类专家判断**，用户应对最终代码质量及应用后果全权负责。

#### 4. **第三方服务与数据隐私 (Third-Party Services and Data Privacy)**
- 本项目集成 Google Gemini、Supabase、GitHub 等第三方服务，使用时须遵守其各自服务条款。
- 用户需自行获取、管理 API 密钥，本项目**不存储、传输或处理用户敏感信息**。
- 第三方服务的可用性、准确性、隐私保护或中断风险，由服务提供商负责，本项目作者不承担任何连带责任。

#### 5. **用户责任 (User Responsibilities)**
- 用户在使用前须确保其代码不侵犯第三方知识产权，并严格遵守开源许可证及相关法规。
- **严禁将本工具用于非法、恶意或损害他人权益的活动**，用户对所有使用后果承担全部法律与经济责任。作者、贡献者和维护者对此类活动及其后果**不承担任何责任**，并保留追究滥用者的权利。

#### 6. **开源贡献 (Open Source Contributions)**
- 贡献者的代码、内容或建议**不代表项目官方观点**，其准确性、安全性及合规性由贡献者自行负责。
- 项目维护者保留审查、修改、拒绝或移除任何贡献的权利。

如有疑问，请通过 GitHub Issues 联系维护者。本免责声明受项目所在地法律管辖。
