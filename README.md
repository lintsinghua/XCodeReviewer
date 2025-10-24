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

![系统架构图](public/diagram.svg)

<div div align="center">
  <em>
    XCodeReviewer系统架构图
  </em>
</div>

---

- **AI 驱动的深度分析**：超越传统静态分析，理解代码意图，发现深层逻辑问题。
- **多维度、全方位评估**：从**安全性**、**性能**、**可维护性**到**代码风格**，提供 360 度无死角的质量评估。
- **清晰、可行的修复建议**：独创 **What-Why-How** 模式，不仅告诉您“是什么”问题，还解释“为什么”，并提供“如何修复”的具体代码示例。
- **多平台LLM/本地LLM支持**: 已实现 10+ 主流平台API调用功能（Gemini、OpenAI、Claude、通义千问、DeepSeek、智谱AI、Kimi、文心一言、MiniMax、豆包、Ollama本地大模型），支持用户自由配置和切换。
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
   # 编辑 .env 文件，配置LLM提供商和API Key
   # 方式一：使用通用配置（推荐）
   # VITE_LLM_PROVIDER=gemini
   # VITE_LLM_API_KEY=your_api_key
   # 
   # 方式二：使用平台专用配置
   # VITE_GEMINI_API_KEY=your_gemini_api_key
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
    # LLM 通用配置 (推荐方式)
    VITE_LLM_PROVIDER=gemini              # 选择提供商 (gemini|openai|claude|qwen|deepseek等)
    VITE_LLM_API_KEY=your_api_key_here    # 对应的API Key
    VITE_LLM_MODEL=gemini-2.5-flash       # 模型名称 (可选)
    
    # 或使用平台专用配置
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_OPENAI_API_KEY=your_openai_api_key_here
    VITE_CLAUDE_API_KEY=your_claude_api_key_here
    # ... 支持10+主流平台
    
    # 数据库配置 (三种模式可选)
    # 1. 本地数据库模式（推荐）- 数据存储在浏览器 IndexedDB
    VITE_USE_LOCAL_DB=true
    
    # 2. Supabase 云端模式 - 数据存储在云端
    # VITE_SUPABASE_URL=https://your-project.supabase.co
    # VITE_SUPABASE_ANON_KEY=your-anon-key-here
    
    # 3. 演示模式 - 不配置任何数据库，使用演示数据（数据不持久化）
    
    # GitHub 集成 (可选，用于仓库分析)
    VITE_GITHUB_TOKEN=your_github_token_here
    
    # 应用配置
    VITE_APP_ID=xcodereviewer
    
    # 分析配置
    VITE_MAX_ANALYZE_FILES=40
    VITE_LLM_CONCURRENCY=2
    VITE_LLM_GAP_MS=500
    
    # 输出语言配置（zh-CN: 中文 | en-US: 英文）
    VITE_OUTPUT_LANGUAGE=zh-CN
    ```

4.  **启动开发服务器**
    ```bash
    pnpm dev
    ```

5.  **访问应用**
    在浏览器中打开 `http://localhost:5173`

#### ⚙️ 高级配置（可选）

如果遇到超时或连接问题，可以调整以下配置：

```env
# 增加超时时间（默认150000ms）
VITE_LLM_TIMEOUT=150000

# 使用自定义API端点（适用于代理或私有部署）
VITE_LLM_BASE_URL=https://your-proxy-url.com

# 降低并发数和增加请求间隔（避免频率限制）
VITE_LLM_CONCURRENCY=1
VITE_LLM_GAP_MS=1000
```

#### 🔧 常见问题

<details>
<summary><b>Q: 如何快速切换LLM平台？</b></summary>

只需修改 `VITE_LLM_PROVIDER` 的值即可：

```env
# 切换到OpenAI
VITE_LLM_PROVIDER=openai
VITE_OPENAI_API_KEY=your_openai_key

# 切换到Claude
VITE_LLM_PROVIDER=claude
VITE_CLAUDE_API_KEY=your_claude_key

# 切换到通义千问
VITE_LLM_PROVIDER=qwen
VITE_QWEN_API_KEY=your_qwen_key
```
</details>

<details>
<summary><b>Q: 遇到"请求超时"错误怎么办？</b></summary>

1. **增加超时时间**：在 `.env` 中设置 `VITE_LLM_TIMEOUT=300000`
2. **检查网络连接**：确保能访问对应的API端点
3. **使用代理**：如果API被墙，配置 `VITE_LLM_BASE_URL` 使用代理
4. **切换平台**：尝试其他LLM提供商，如 DeepSeek（国内访问快）
</details>

<details>
<summary><b>Q: 如何使用国内平台避免网络问题？</b></summary>

推荐使用国内平台，访问速度更快：

```env
# 使用通义千问（推荐）
VITE_LLM_PROVIDER=qwen
VITE_QWEN_API_KEY=your_qwen_key

# 或使用DeepSeek（性价比高）
VITE_LLM_PROVIDER=deepseek
VITE_DEEPSEEK_API_KEY=your_deepseek_key

# 或使用智谱AI
VITE_LLM_PROVIDER=zhipu
VITE_ZHIPU_API_KEY=your_zhipu_key
```
</details>

<details>
<summary><b>Q: 百度文心一言的API Key格式是什么？</b></summary>

百度API Key格式特殊，需要同时提供API Key和Secret Key，用冒号分隔：

```env
VITE_LLM_PROVIDER=baidu
VITE_BAIDU_API_KEY=your_api_key:your_secret_key
VITE_BAIDU_MODEL=ERNIE-3.5-8K
```
</details>

<details>
<summary><b>Q: 数据库有哪些模式可选？如何选择？</b></summary>

XCodeReviewer 支持三种数据库模式：

**1. 本地数据库模式（推荐）**
- 数据存储在浏览器 IndexedDB 中
- 无需配置云端服务，开箱即用
- 数据完全本地化，隐私安全
- 适合个人使用和快速体验

```env
VITE_USE_LOCAL_DB=true
```

**2. Supabase 云端模式**
- 数据存储在 Supabase 云端
- 支持多设备同步
- 需要注册 Supabase 账号并配置
- 适合团队协作和跨设备使用

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**3. 演示模式**
- 不配置任何数据库
- 使用内置演示数据
- 数据不会持久化保存
- 适合快速预览功能
</details>

<details>
<summary><b>Q: 本地数据库的数据存储在哪里？如何备份？</b></summary>

本地数据库使用浏览器的 IndexedDB 存储数据：

- **存储位置**：浏览器本地存储（不同浏览器位置不同）
- **数据安全**：数据仅存储在本地，不会上传到服务器
- **清除数据**：清除浏览器数据会删除所有本地数据
- **备份方法**：可以在管理界面导出数据为 JSON 文件
- **恢复方法**：通过导入 JSON 文件恢复数据

注意：本地数据库数据仅在当前浏览器可用，更换浏览器或设备需要重新导入数据。
</details>

<details>
<summary><b>Q: 如何设置分析结果的输出语言？</b></summary>

在 `.env` 文件中配置 `VITE_OUTPUT_LANGUAGE`：

```env
# 中文输出（默认）
VITE_OUTPUT_LANGUAGE=zh-CN

# 英文输出
VITE_OUTPUT_LANGUAGE=en-US
```

重启应用后，所有 LLM 分析结果将使用指定的语言输出。

可在[百度千帆平台](https://console.bce.baidu.com/qianfan/)获取API Key和Secret Key。
</details>

<details>
<summary><b>Q: 如何配置代理或中转服务？</b></summary>

使用 `VITE_LLM_BASE_URL` 配置自定义端点：

```env
# OpenAI中转示例
VITE_LLM_PROVIDER=openai
VITE_OPENAI_API_KEY=your_key
VITE_OPENAI_BASE_URL=https://api.your-proxy.com/v1

# 或使用通用配置
VITE_LLM_PROVIDER=openai
VITE_LLM_API_KEY=your_key
VITE_LLM_BASE_URL=https://api.your-proxy.com/v1
```
</details>

<details>
<summary><b>Q: 如何同时配置多个平台并快速切换？</b></summary>

在 `.env` 中配置所有平台的Key，然后通过修改 `VITE_LLM_PROVIDER` 切换：

```env
# 当前使用的平台
VITE_LLM_PROVIDER=gemini

# 预配置所有平台
VITE_GEMINI_API_KEY=gemini_key
VITE_OPENAI_API_KEY=openai_key
VITE_CLAUDE_API_KEY=claude_key
VITE_QWEN_API_KEY=qwen_key
VITE_DEEPSEEK_API_KEY=deepseek_key

# 切换时只需修改第一行的provider值即可
```
</details>

<details>
<summary><b>Q: 如何使用 Ollama 本地大模型？</b></summary>

Ollama 允许您在本地运行开源大模型，无需 API Key，保护数据隐私：

**1. 安装 Ollama**
```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# 下载并安装：https://ollama.com/download
```

**2. 拉取并运行模型**
```bash
# 拉取 Llama3 模型
ollama pull llama3

# 验证模型是否可用
ollama list
```

**3. 配置 XCodeReviewer**
```env
VITE_LLM_PROVIDER=ollama
VITE_LLM_API_KEY=ollama              # 填写任意值即可
VITE_LLM_MODEL=llama3                # 使用的模型名称
VITE_LLM_BASE_URL=http://localhost:11434/v1  # Ollama API地址
```

**推荐模型：**
- `llama3` - Meta 的开源大模型，性能优秀
- `codellama` - 专门针对代码优化的模型
- `qwen2.5` - 阿里云通义千问开源版本
- `deepseek-coder` - DeepSeek 代码专用模型

更多模型请访问：https://ollama.com/library
</details>

### 🔑 获取 API Key

#### 🎯 支持的 LLM 平台

XCodeReviewer 现已支持多个主流 LLM 平台，您可以根据需求自由选择：

**国际平台：**
- **Google Gemini** - 推荐用于代码分析，免费配额充足 [获取API Key](https://makersuite.google.com/app/apikey)
- **OpenAI GPT** - 稳定可靠，综合性能最佳 [获取API Key](https://platform.openai.com/api-keys)
- **Anthropic Claude** - 代码理解能力强 [获取API Key](https://console.anthropic.com/)
- **DeepSeek** - 性价比高 [获取API Key](https://platform.deepseek.com/)

**国内平台：**
- **阿里云通义千问** [获取API Key](https://dashscope.console.aliyun.com/)
- **智谱AI (GLM)** [获取API Key](https://open.bigmodel.cn/)
- **月之暗面 Kimi** [获取API Key](https://platform.moonshot.cn/)
- **百度文心一言** [获取API Key](https://console.bce.baidu.com/qianfan/)
- **MiniMax** [获取API Key](https://www.minimaxi.com/)
- **字节豆包** [获取API Key](https://console.volcengine.com/ark)

**本地部署：**
- **Ollama** - 本地运行开源大模型，支持 Llama3、Mistral、CodeLlama 等 [安装指南](https://ollama.com/)

#### 📝 配置示例

在 `.env` 文件中配置您选择的平台：

```env
# 方式一：使用通用配置（推荐）
VITE_LLM_PROVIDER=gemini          # 选择提供商
VITE_LLM_API_KEY=your_api_key     # 对应的API Key
VITE_LLM_MODEL=gemini-2.5-flash   # 模型名称（可选）

# 方式二：使用平台专用配置
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_CLAUDE_API_KEY=your_claude_api_key
# ... 其他平台配置

# 使用 Ollama 本地大模型（无需 API Key）
VITE_LLM_PROVIDER=ollama
VITE_LLM_API_KEY=ollama              # 填写任意值即可
VITE_LLM_MODEL=llama3                # 使用的模型名称
VITE_LLM_BASE_URL=http://localhost:11434/v1  # Ollama API地址（可选）
```

**快速切换平台：** 只需修改 `VITE_LLM_PROVIDER` 的值，即可在不同平台间自由切换！

> 💡 **提示：** 详细的配置说明请参考 `.env.example` 文件

#### Supabase 配置（可选）
1. 访问 [Supabase](https://supabase.com/) 创建新项目
2. 在项目设置中获取 URL 和匿名密钥
3. 运行数据库迁移脚本：
   ```bash
   # 在 Supabase SQL 编辑器中执行
   cat supabase/migrations/full_schema.sql
   ```
4. 如果不配置 Supabase，系统将以演示模式运行，仓库相关、项目管理相关的功能将无法使用，仅能使用即时分析功能，且数据不会持久化

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

- **AI 深度代码理解**：支持多个主流 LLM 平台（Gemini、OpenAI、Claude、通义千问、DeepSeek 等），提供超越关键词匹配的智能分析。
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

<details>
<summary><b>💾 本地数据库管理</b></summary>

- **三种数据库模式**：
  - 🏠 **本地模式**：使用浏览器 IndexedDB，数据完全本地化，隐私安全
  - ☁️ **云端模式**：使用 Supabase，支持多设备同步
  - 🎭 **演示模式**：无需配置，快速体验功能
- **数据管理功能**：
  - 📤 **导出备份**：将数据导出为 JSON 文件
  - 📥 **导入恢复**：从备份文件恢复数据
  - 🗑️ **清空数据**：一键清理所有本地数据
  - 📊 **存储监控**：实时查看存储空间使用情况
- **智能统计**：项目、任务、问题的完整统计和可视化展示
</details>

## 🛠️ 技术栈

| 分类 | 技术 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | `React 18` `TypeScript` `Vite` | 现代化前端开发栈，支持热重载和类型安全 |
| **UI 组件** | `Tailwind CSS` `Radix UI` `Lucide React` | 响应式设计，无障碍访问，丰富的图标库 |
| **数据可视化** | `Recharts` | 专业的图表库，支持多种图表类型 |
| **路由管理** | `React Router v6` | 单页应用路由解决方案 |
| **状态管理** | `React Hooks` `Sonner` | 轻量级状态管理和通知系统 |
| **AI 引擎** | `多平台 LLM` | 支持 Gemini、OpenAI、Claude、通义千问、DeepSeek 等 10+ 主流平台 |
| **数据存储** | `IndexedDB` `Supabase` `PostgreSQL` | 本地数据库 + 云端数据库双模式支持 |
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
│   │   ├── database/       # 数据库管理组件
│   │   └── debug/          # 调试组件
│   ├── pages/              # 页面组件
│   │   ├── Dashboard.tsx   # 仪表盘
│   │   ├── Projects.tsx    # 项目管理
│   │   ├── InstantAnalysis.tsx # 即时分析
│   │   ├── AuditTasks.tsx  # 审计任务
│   │   └── AdminDashboard.tsx # 数据库管理
│   ├── features/           # 功能模块
│   │   ├── analysis/       # 分析相关服务
│   │   │   └── services/   # AI 代码分析引擎
│   │   └── projects/       # 项目相关服务
│   │       └── services/   # 仓库扫描、ZIP 文件扫描
│   ├── shared/             # 共享工具
│   │   ├── config/         # 配置文件
│   │   │   ├── database.ts      # 数据库统一接口
│   │   │   ├── localDatabase.ts # IndexedDB 实现
│   │   │   └── env.ts           # 环境变量配置
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── hooks/          # 自定义 React Hooks
│   │   ├── utils/          # 工具函数
│   │   │   └── initLocalDB.ts   # 本地数据库初始化
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

#### 核心LLM配置
| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_LLM_PROVIDER` | ✅ | `gemini` | LLM提供商：`gemini`\|`openai`\|`claude`\|`qwen`\|`deepseek`\|`zhipu`\|`moonshot`\|`baidu`\|`minimax`\|`doubao` |
| `VITE_LLM_API_KEY` | ✅ | - | 通用API Key（优先级高于平台专用配置） |
| `VITE_LLM_MODEL` | ❌ | 自动 | 模型名称（不指定则使用各平台默认模型） |
| `VITE_LLM_BASE_URL` | ❌ | - | 自定义API端点（用于代理、中转或私有部署） |
| `VITE_LLM_TIMEOUT` | ❌ | `150000` | 请求超时时间（毫秒） |
| `VITE_LLM_TEMPERATURE` | ❌ | `0.2` | 温度参数（0.0-2.0），控制输出随机性 |
| `VITE_LLM_MAX_TOKENS` | ❌ | `4096` | 最大输出token数 |

#### 平台专用API Key配置（可选）
| 变量名 | 说明 | 特殊要求 |
|--------|------|---------|
| `VITE_GEMINI_API_KEY` | Google Gemini API Key | - |
| `VITE_GEMINI_MODEL` | Gemini模型 (默认: gemini-2.5-flash) | - |
| `VITE_OPENAI_API_KEY` | OpenAI API Key | - |
| `VITE_OPENAI_MODEL` | OpenAI模型 (默认: gpt-4o-mini) | - |
| `VITE_OPENAI_BASE_URL` | OpenAI自定义端点 | 用于中转服务 |
| `VITE_CLAUDE_API_KEY` | Anthropic Claude API Key | - |
| `VITE_CLAUDE_MODEL` | Claude模型 (默认: claude-3-5-sonnet-20241022) | - |
| `VITE_QWEN_API_KEY` | 阿里云通义千问 API Key | - |
| `VITE_QWEN_MODEL` | 通义千问模型 (默认: qwen-turbo) | - |
| `VITE_DEEPSEEK_API_KEY` | DeepSeek API Key | - |
| `VITE_DEEPSEEK_MODEL` | DeepSeek模型 (默认: deepseek-chat) | - |
| `VITE_ZHIPU_API_KEY` | 智谱AI API Key | - |
| `VITE_ZHIPU_MODEL` | 智谱模型 (默认: glm-4-flash) | - |
| `VITE_MOONSHOT_API_KEY` | 月之暗面 Kimi API Key | - |
| `VITE_MOONSHOT_MODEL` | Kimi模型 (默认: moonshot-v1-8k) | - |
| `VITE_BAIDU_API_KEY` | 百度文心一言 API Key | ⚠️ 格式: `API_KEY:SECRET_KEY` |
| `VITE_BAIDU_MODEL` | 文心模型 (默认: ERNIE-3.5-8K) | - |
| `VITE_MINIMAX_API_KEY` | MiniMax API Key | - |
| `VITE_MINIMAX_MODEL` | MiniMax模型 (默认: abab6.5-chat) | - |
| `VITE_DOUBAO_API_KEY` | 字节豆包 API Key | - |
| `VITE_DOUBAO_MODEL` | 豆包模型 (默认: doubao-pro-32k) | - |

#### 数据库配置（可选）
| 变量名 | 必需 | 说明 |
|--------|------|------|
| `VITE_SUPABASE_URL` | ❌ | Supabase项目URL（用于数据持久化） |
| `VITE_SUPABASE_ANON_KEY` | ❌ | Supabase匿名密钥 |

> 💡 **提示**：不配置Supabase时，系统以演示模式运行，数据不持久化

#### GitHub集成配置（可选）
| 变量名 | 必需 | 说明 |
|--------|------|------|
| `VITE_GITHUB_TOKEN` | ❌ | GitHub Personal Access Token（用于仓库分析功能） |

#### 分析行为配置
| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `VITE_MAX_ANALYZE_FILES` | `40` | 单次分析的最大文件数 |
| `VITE_LLM_CONCURRENCY` | `2` | LLM并发请求数（降低可避免频率限制） |
| `VITE_LLM_GAP_MS` | `500` | LLM请求间隔（毫秒，增加可避免频率限制） |

#### 应用配置
| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `VITE_APP_ID` | `xcodereviewer` | 应用标识符 |

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

- **✅ 多平台LLM支持**: 已实现 10+ 主流平台API调用功能（Gemini、OpenAI、Claude、通义千问、DeepSeek、智谱AI、Kimi、文心一言、MiniMax、豆包、Ollama本地大模型），支持用户自由配置和切换
- **✅ 本地模型支持**: 已加入对 Ollama 本地大模型的调用功能，满足数据隐私需求
- **Multi-Agent Collaboration**: 考虑引入多智能体协作架构，会实现`Agent+人工对话`反馈的功能，包括多轮对话流程展示，人工对话中断干涉等，以获得更清晰、透明、监督性的审计过程，提升审计质量
- **专业报告文件生成**: 根据不同的需求生成相关格式的专业审计报告文件，支持文件报告格式定制等
- **审计标准自定义**: 不同团队有自己的编码规范，不同项目有特定的安全要求，也正是我们这个项目想后续做的东西。当前的版本还属于一个“半黑盒模式”，项目通过 Prompt 工程来引导分析方向和定义审计标准，实际分析效果由强大的预训练AI 模型内置知识决定。后续将结合强化学习、监督学习微调等方法，开发以支持自定义规则配置，通过YAML或者JSON定义团队特定规则，提供常见框架的最佳实践模板等等，以获得更加符合需求和标准的审计结果
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
- **建议**：对于敏感代码，请等待本项目未来支持本地模型部署功能，或使用私有部署的LLM服务。
- 项目作者、贡献者和维护者**对因用户上传敏感代码导致的任何信息泄露、知识产权侵权、法律纠纷或其他损失不承担任何责任**。

#### 2. **非专业建议 (Non-Professional Advice)**
- 本工具提供的代码分析结果和建议**仅供参考**，不构成专业的安全审计、代码审查或法律意见。
- 用户必须结合人工审查、专业工具及其他可靠资源，对关键代码（尤其是涉及安全、金融、医疗等高风险领域）进行全面验证。

#### 3. **无担保与免责 (No Warranty and Liability Disclaimer)**
- 本项目以“原样”形式提供，**不附带任何明示或默示担保**，包括但不限于适销性、特定用途适用性及非侵权性。
- 作者、贡献者和维护者**不对任何直接、间接、附带、特殊、惩戒性或后果性损害承担责任**，包括但不限于数据丢失、系统中断、安全漏洞或商业损失，即使已知此类风险存在。

#### 4. **AI 分析局限性 (Limitations of AI Analysis)**
- 本工具依赖 Google Gemini 等 AI 模型，分析结果可能包含**错误、遗漏或不准确信息**，无法保证100% 可靠性。
- AI 输出**不能替代人类专家判断**，用户应对最终代码质量及应用后果全权负责。

#### 5. **第三方服务与数据隐私 (Third-Party Services and Data Privacy)**
- 本项目集成 Google Gemini、OpenAI、Claude、通义千问、DeepSeek 等多个第三方LLM服务，以及 Supabase、GitHub 等服务，使用时须遵守其各自服务条款和隐私政策。
- **代码传输说明**：用户提交的代码将通过API发送到所选LLM服务商进行分析，传输过程和数据处理遵循各服务商的隐私政策。
- 用户需自行获取、管理 API 密钥，本项目**不存储、传输或处理用户的API密钥和敏感信息**。
- 第三方服务的可用性、准确性、隐私保护、数据留存政策或中断风险，由服务提供商负责，本项目作者不承担任何连带责任。
- **数据留存警告**：不同LLM服务商对API请求数据的留存和使用政策各不相同，请用户在使用前仔细阅读所选服务商的隐私政策和使用条款。

#### 6. **用户责任 (User Responsibilities)**
- 用户在使用前须确保其代码不侵犯第三方知识产权，不包含保密信息，并严格遵守开源许可证及相关法规。
- 用户**对上传代码的内容、性质和合规性承担全部责任**，包括但不限于：
  - 确保代码不包含敏感信息或商业机密
  - 确保拥有代码的使用和分析权限
  - 遵守所在国家/地区关于数据保护和隐私的法律法规
  - 遵守公司或组织的保密协议和安全政策
- **严禁将本工具用于非法、恶意或损害他人权益的活动**，用户对所有使用后果承担全部法律与经济责任。作者、贡献者和维护者对此类活动及其后果**不承担任何责任**，并保留追究滥用者的权利。

#### 7. **开源贡献 (Open Source Contributions)**
- 贡献者的代码、内容或建议**不代表项目官方观点**，其准确性、安全性及合规性由贡献者自行负责。
- 项目维护者保留审查、修改、拒绝或移除任何贡献的权利。

如有疑问，请通过 GitHub Issues 联系维护者。本免责声明受项目所在地法律管辖。
