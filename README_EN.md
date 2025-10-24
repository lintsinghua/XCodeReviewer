# XCodeReviewer - Your Intelligent Code Audit Partner 🚀

<div style="width: 100%; max-width: 600px; margin: 0 auto;">
  <img src="public/images/logo.png" alt="XCodeReviewer Logo" style="width: 100%; height: auto; display: block; margin: 0 auto;">
</div>

<div align="center">
  <p>
    <a href="README.md">中文</a> •
    <a href="README_EN.md">English</a>
  </p>
</div>

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/lintsinghua/XCodeReviewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.0.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.1.4-646CFF.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E.svg)](https://supabase.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-4285F4.svg)](https://ai.google.dev/)

**XCodeReviewer** is a modern code audit platform powered by Large Language Models (LLM), designed to provide developers with intelligent, comprehensive, and in-depth code quality analysis and review services.

## 🌟 Why Choose XCodeReviewer?

In the fast-paced world of software development, ensuring code quality is crucial. Traditional code audit tools are rigid and inefficient, while manual audits are time-consuming and labor-intensive. XCodeReviewer leverages the powerful capabilities of Google Gemini AI to revolutionize the way code reviews are conducted:

![System Architecture Diagram](public/diagram.svg)

<div div align="center">
  <em>
    System Architecture Diagram of XCodeReviewer
  </em>
</div>

---

- **🤖 AI-Driven Deep Analysis**: Beyond traditional static analysis, understands code intent and discovers deep logical issues.
- **🎯 Multi-dimensional, Comprehensive Assessment**: From **security**, **performance**, **maintainability** to **code style**, providing 360-degree quality evaluation.
- **💡 Clear, Actionable Fix Suggestions**: Innovative **What-Why-How** approach that not only tells you "what" the problem is, but also explains "why" and provides "how to fix" with specific code examples.
- **✅ Multi-Platform LLM/Local Model Support**: Implemented API calling functionality for 10+ mainstream platforms (Gemini, OpenAI, Claude, Qwen, DeepSeek, Zhipu AI, Kimi, ERNIE, MiniMax, Doubao, Ollama Local Models), with support for free configuration and switching
- **✨ Modern, Beautiful User Interface**: Built with React + TypeScript, providing a smooth and intuitive user experience.

## 🎬 Project Demo

### Main Feature Interfaces

#### 📊 Intelligent Dashboard
![Intelligent Dashboard](public/images/example1.png)
*Real-time display of project statistics, quality trends, and system performance, providing comprehensive code audit overview*

#### ⚡ Instant Analysis
![Instant Analysis](public/images/example2.png)
*Support for quick code snippet analysis with detailed What-Why-How explanations and fix suggestions*

#### 🚀 Project Management
![Project Management](public/images/example3.png)
*Integrated GitHub/GitLab repositories, supporting multi-language project audits and batch code analysis*

## 🚀 Quick Start

### 🐳 Docker Deployment (Recommended)

Deploy quickly using Docker without Node.js environment setup.

1. **Clone the project**
   ```bash
   git clone https://github.com/lintsinghua/XCodeReviewer.git
   cd XCodeReviewer
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env file and configure LLM provider and API Key
   # Method 1: Using Universal Configuration (Recommended)
   # VITE_LLM_PROVIDER=gemini
   # VITE_LLM_API_KEY=your_api_key
   # 
   # Method 2: Using Platform-Specific Configuration
   # VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

3. **Build and start**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Access the application**
   
   Open `http://localhost:5174` in your browser

**Common commands:**
```bash
docker-compose logs -f      # View logs
docker-compose restart      # Restart service
docker-compose down         # Stop service
```

### 💻 Local Development Deployment

For development or custom modifications, use local deployment.

#### Requirements

- **Node.js**: `18+`
- **pnpm**: `8+` (recommended) or `npm` / `yarn`
- **Google Gemini API Key**: For AI code analysis

#### Installation & Setup

1.  **Clone the project**
    ```bash
    git clone https://github.com/lintsinghua/XCodeReviewer.git
    cd XCodeReviewer
    ```

2.  **Install dependencies**
    ```bash
    # Using pnpm (recommended)
    pnpm install
    
    # Or using npm
    npm install
    
    # Or using yarn
    yarn install
    ```

3.  **Configure environment variables**
    ```bash
    # Copy environment template
    cp .env.example .env
    ```
    
    Edit the `.env` file and configure the necessary environment variables:
    ```env
    # LLM Universal Configuration (Recommended)
    VITE_LLM_PROVIDER=gemini              # Choose provider (gemini|openai|claude|qwen|deepseek, etc.)
    VITE_LLM_API_KEY=your_api_key_here    # Corresponding API Key
    VITE_LLM_MODEL=gemini-2.5-flash       # Model name (optional)
    
    # Or use platform-specific configuration
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_OPENAI_API_KEY=your_openai_api_key_here
    VITE_CLAUDE_API_KEY=your_claude_api_key_here
    # ... Supports 10+ mainstream platforms
    
    # Database Configuration (Three modes available)
    # 1. Local Database Mode (Recommended) - Data stored in browser IndexedDB
    VITE_USE_LOCAL_DB=true
    
    # 2. Supabase Cloud Mode - Data stored in cloud
    # VITE_SUPABASE_URL=https://your-project.supabase.co
    # VITE_SUPABASE_ANON_KEY=your-anon-key-here
    
    # 3. Demo Mode - No database configuration, uses demo data (not persistent)
    
    # GitHub Integration (Optional, for repository analysis)
    VITE_GITHUB_TOKEN=your_github_token_here
    
    # Application Configuration
    VITE_APP_ID=xcodereviewer
    
    # Analysis Configuration
    VITE_MAX_ANALYZE_FILES=40
    VITE_LLM_CONCURRENCY=2
    VITE_LLM_GAP_MS=500
    
    # Output Language Configuration (zh-CN: Chinese | en-US: English)
    VITE_OUTPUT_LANGUAGE=zh-CN
    ```

4.  **Start development server**
    ```bash
    pnpm dev
    ```

5.  **Access the application**
    Open `http://localhost:5174` in your browser

#### ⚙️ Advanced Configuration (Optional)

If you encounter timeout or connection issues, adjust these settings:

```env
# Increase timeout (default 150000ms)
VITE_LLM_TIMEOUT=150000

# Use custom API endpoint (for proxy or private deployment)
VITE_LLM_BASE_URL=https://your-proxy-url.com

# Reduce concurrency and increase request gap (to avoid rate limiting)
VITE_LLM_CONCURRENCY=1
VITE_LLM_GAP_MS=1000
```

#### 🔧 FAQ

<details>
<summary><b>Q: How to quickly switch between LLM platforms?</b></summary>

Simply modify the `VITE_LLM_PROVIDER` value:

```env
# Switch to OpenAI
VITE_LLM_PROVIDER=openai
VITE_OPENAI_API_KEY=your_openai_key

# Switch to Claude
VITE_LLM_PROVIDER=claude
VITE_CLAUDE_API_KEY=your_claude_key

# Switch to Qwen
VITE_LLM_PROVIDER=qwen
VITE_QWEN_API_KEY=your_qwen_key
```
</details>

<details>
<summary><b>Q: What to do when encountering "Request Timeout" error?</b></summary>

1. **Increase timeout**: Set `VITE_LLM_TIMEOUT=300000` in `.env` (5 minutes)
2. **Check network connection**: Ensure you can access the API endpoint
3. **Use proxy**: Configure `VITE_LLM_BASE_URL` if API is blocked
4. **Switch platform**: Try other LLM providers, such as DeepSeek (good for China)
</details>

<details>
<summary><b>Q: How to use Chinese platforms to avoid network issues?</b></summary>

Recommended Chinese platforms for faster access:

```env
# Use Qwen (Recommended)
VITE_LLM_PROVIDER=qwen
VITE_QWEN_API_KEY=your_qwen_key

# Or use DeepSeek (Cost-effective)
VITE_LLM_PROVIDER=deepseek
VITE_DEEPSEEK_API_KEY=your_deepseek_key

# Or use Zhipu AI
VITE_LLM_PROVIDER=zhipu
VITE_ZHIPU_API_KEY=your_zhipu_key
```
</details>

<details>
<summary><b>Q: What's the API Key format for Baidu ERNIE?</b></summary>

Baidu API Key requires both API Key and Secret Key, separated by colon:

```env
VITE_LLM_PROVIDER=baidu
VITE_BAIDU_API_KEY=your_api_key:your_secret_key
VITE_BAIDU_MODEL=ERNIE-3.5-8K
```

Get API Key and Secret Key from [Baidu Qianfan Platform](https://console.bce.baidu.com/qianfan/).
</details>

<details>
<summary><b>Q: How to configure proxy or relay service?</b></summary>

Use `VITE_LLM_BASE_URL` to configure custom endpoint:

```env
# OpenAI relay example
VITE_LLM_PROVIDER=openai
VITE_OPENAI_API_KEY=your_key
VITE_OPENAI_BASE_URL=https://api.your-proxy.com/v1

# Or use universal config
VITE_LLM_PROVIDER=openai
VITE_LLM_API_KEY=your_key
VITE_LLM_BASE_URL=https://api.your-proxy.com/v1
```
</details>

<details>
<summary><b>Q: How to configure multiple platforms and switch quickly?</b></summary>

Configure all platform keys in `.env`, then switch by modifying `VITE_LLM_PROVIDER`:

```env
# Currently active platform
VITE_LLM_PROVIDER=gemini

# Pre-configure all platforms
VITE_GEMINI_API_KEY=gemini_key
VITE_OPENAI_API_KEY=openai_key
VITE_CLAUDE_API_KEY=claude_key
VITE_QWEN_API_KEY=qwen_key
VITE_DEEPSEEK_API_KEY=deepseek_key

# Just modify the first line's provider value to switch
```
</details>

<details>
<summary><b>Q: How to use Ollama local models?</b></summary>

Ollama allows you to run open-source models locally without an API key, protecting data privacy:

**1. Install Ollama**
```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download and install: https://ollama.com/download
```

**2. Pull and run a model**
```bash
# Pull Llama3 model
ollama pull llama3

# Verify the model is available
ollama list
```

**3. Configure XCodeReviewer**
```env
VITE_LLM_PROVIDER=ollama
VITE_LLM_API_KEY=ollama              # Can be any value
VITE_LLM_MODEL=llama3                # Model name to use
VITE_LLM_BASE_URL=http://localhost:11434/v1  # Ollama API address
```

**Recommended Models:**
- `llama3` - Meta's open-source model with excellent performance
- `codellama` - Code-optimized model
- `qwen2.5` - Open-source version of Alibaba Qwen
- `deepseek-coder` - DeepSeek's code-specialized model

More models available at: https://ollama.com/library
</details>


### 🔑 Getting API Keys

#### 🎯 Supported LLM Platforms

XCodeReviewer now supports multiple mainstream LLM platforms. You can choose freely based on your needs:

**International Platforms:**
- **Google Gemini** - Recommended for code analysis, generous free tier [Get API Key](https://makersuite.google.com/app/apikey)
- **OpenAI GPT** - Stable and reliable, best overall performance [Get API Key](https://platform.openai.com/api-keys)
- **Anthropic Claude** - Strong code understanding capabilities [Get API Key](https://console.anthropic.com/)
- **DeepSeek** - Cost-effective [Get API Key](https://platform.deepseek.com/)

**Chinese Platforms:**
- **Alibaba Qwen (通义千问)** [Get API Key](https://dashscope.console.aliyun.com/)
- **Zhipu AI (GLM)** [Get API Key](https://open.bigmodel.cn/)
- **Moonshot (Kimi)** [Get API Key](https://platform.moonshot.cn/)
- **Baidu ERNIE (文心一言)** [Get API Key](https://console.bce.baidu.com/qianfan/)
- **MiniMax** [Get API Key](https://www.minimaxi.com/)
- **Bytedance Doubao (豆包)** [Get API Key](https://console.volcengine.com/ark)

**Local Deployment:**
- **Ollama** - Run open-source models locally, supports Llama3, Mistral, CodeLlama, etc. [Installation Guide](https://ollama.com/)

#### 📝 Configuration Examples

Configure your chosen platform in the `.env` file:

```env
# Method 1: Using Universal Configuration (Recommended)
VITE_LLM_PROVIDER=gemini          # Choose provider
VITE_LLM_API_KEY=your_api_key     # Corresponding API Key
VITE_LLM_MODEL=gemini-2.5-flash   # Model name (optional)

# Method 2: Using Platform-Specific Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_CLAUDE_API_KEY=your_claude_api_key
# ... Other platform configurations

# Using Ollama Local Models (No API Key Required)
VITE_LLM_PROVIDER=ollama
VITE_LLM_API_KEY=ollama              # Can be any value
VITE_LLM_MODEL=llama3                # Model name to use
VITE_LLM_BASE_URL=http://localhost:11434/v1  # Ollama API address (optional)
```

**Quick Platform Switch:** Simply modify the value of `VITE_LLM_PROVIDER` to switch between different platforms!

> 💡 **Tip:** For detailed configuration instructions, please refer to the `.env.example` file

#### Supabase Configuration (Optional)
1. Visit [Supabase](https://supabase.com/) to create a new project
2. Get the URL and anonymous key from project settings
3. Run database migration scripts:
   ```bash
   # Execute in Supabase SQL Editor
   cat supabase/migrations/full_schema.sql
   ```
4. If Supabase is not configured, functions related to warehouses and project management will be unavailable. Only the instant analysis function can be used, and data will not be persisted, and the system will run in demo mode without data persistence

## ✨ Core Features

<details>
<summary><b>🚀 Project Management</b></summary>

- **One-click Repository Integration**: Seamlessly connect with GitHub, GitLab, and other mainstream platforms.
- **Multi-language "Full Stack" Support**: Covers popular languages like JavaScript, TypeScript, Python, Java, Go, Rust, and more.
- **Flexible Branch Auditing**: Support for precise analysis of specified code branches.
</details>

<details>
<summary><b>⚡ Instant Analysis</b></summary>

- **Code Snippet "Quick Paste"**: Directly paste code in the web interface for immediate analysis results.
- **10+ Language Instant Support**: Meet your diverse code analysis needs.
- **Millisecond Response**: Quickly get code quality scores and optimization suggestions.
</details>

<details>
<summary><b>🧠 Intelligent Auditing</b></summary>

- **AI Deep Code Understanding**: Supports multiple mainstream LLM platforms (Gemini, OpenAI, Claude, Qwen, DeepSeek, etc.), providing intelligent analysis beyond keyword matching.
- **Five Core Detection Dimensions**:
  - 🐛 **Potential Bugs**: Precisely capture logical errors, boundary conditions, and null pointer issues.
  - 🔒 **Security Vulnerabilities**: Identify SQL injection, XSS, sensitive information leakage, and other security risks.
  - ⚡ **Performance Bottlenecks**: Discover inefficient algorithms, memory leaks, and unreasonable asynchronous operations.
  - 🎨 **Code Style**: Ensure code follows industry best practices and unified standards.
  - 🔧 **Maintainability**: Evaluate code readability, complexity, and modularity.
</details>

<details>
<summary><b>💡 Explainable Analysis (What-Why-How)</b></summary>

- **What**: Clearly identify problems in the code.
- **Why**: Detailed explanation of potential risks and impacts the problem may cause.
- **How**: Provide specific, directly usable code fix examples.
- **Precise Code Location**: Quickly jump to the problematic line and column.
</details>

<details>
<summary><b>📊 Visual Reports</b></summary>

- **Code Quality Dashboard**: Provides comprehensive quality assessment from 0-100, making code health status clear at a glance.
- **Multi-dimensional Issue Statistics**: Classify and count issues by type and severity.
- **Quality Trend Analysis**: Display code quality changes over time through charts.
</details>

<details>
<summary><b>💾 Local Database Management</b></summary>

- **Three Database Modes**:
  - 🏠 **Local Mode**: Uses browser IndexedDB, data is completely localized, privacy-secure
  - ☁️ **Cloud Mode**: Uses Supabase, supports multi-device synchronization
  - 🎭 **Demo Mode**: No configuration needed, quick feature preview
- **Data Management Features**:
  - 📤 **Export Backup**: Export data as JSON files
  - 📥 **Import Recovery**: Restore data from backup files
  - 🗑️ **Clear Data**: One-click cleanup of all local data
  - 📊 **Storage Monitoring**: Real-time view of storage space usage
- **Smart Statistics**: Complete statistics and visualization of projects, tasks, and issues
</details>

## 🛠️ Tech Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | `React 18` `TypeScript` `Vite` | Modern frontend development stack with hot reload and type safety |
| **UI Components** | `Tailwind CSS` `Radix UI` `Lucide React` | Responsive design, accessibility, rich icon library |
| **Data Visualization** | `Recharts` | Professional chart library supporting multiple chart types |
| **Routing** | `React Router v6` | Single-page application routing solution |
| **State Management** | `React Hooks` `Sonner` | Lightweight state management and notification system |
| **AI Engine** | `Multi-Platform LLM` | Supports 10+ mainstream platforms including Gemini, OpenAI, Claude, Qwen, DeepSeek |
| **Data Storage** | `IndexedDB` `Supabase` `PostgreSQL` | Dual-mode support for local database + cloud database |
| **Backend Service** | `Supabase` `PostgreSQL` | Full-stack backend-as-a-service with real-time database |
| **HTTP Client** | `Axios` `Ky` | Modern HTTP request libraries |
| **Code Quality** | `Biome` `Ast-grep` `TypeScript` | Code formatting, static analysis, and type checking |
| **Build Tools** | `Vite` `PostCSS` `Autoprefixer` | Fast build tools and CSS processing |

## 📁 Project Structure

```
XCodeReviewer/
├── src/
│   ├── app/                # Application configuration
│   │   ├── App.tsx         # Main application component
│   │   ├── main.tsx        # Application entry point
│   │   └── routes.tsx      # Route configuration
│   ├── components/         # React components
│   │   ├── layout/         # Layout components (Header, Footer, PageMeta)
│   │   ├── ui/             # UI component library (based on Radix UI)
│   │   ├── database/       # Database management components
│   │   └── debug/          # Debug components
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx   # Dashboard
│   │   ├── Projects.tsx    # Project management
│   │   ├── InstantAnalysis.tsx # Instant analysis
│   │   ├── AuditTasks.tsx  # Audit tasks
│   │   └── AdminDashboard.tsx # Database management
│   ├── features/           # Feature modules
│   │   ├── analysis/       # Analysis related services
│   │   │   └── services/   # AI code analysis engine
│   │   └── projects/       # Project related services
│   │       └── services/   # Repository scanning, ZIP file scanning
│   ├── shared/             # Shared utilities
│   │   ├── config/         # Configuration files
│   │   │   ├── database.ts      # Unified database interface
│   │   │   ├── localDatabase.ts # IndexedDB implementation
│   │   │   └── env.ts           # Environment variable configuration
│   │   ├── types/          # TypeScript type definitions
│   │   ├── hooks/          # Custom React Hooks
│   │   ├── utils/          # Utility functions
│   │   │   └── initLocalDB.ts   # Local database initialization
│   │   └── constants/      # Constants definition
│   └── assets/             # Static assets
│       └── styles/         # Style files
├── supabase/
│   └── migrations/         # Database migration files
├── public/
│   └── images/             # Image resources
├── scripts/                # Build and setup scripts
└── rules/                  # Code rules configuration
```

## 🎯 Usage Guide

### Instant Code Analysis
1. Visit the `/instant-analysis` page
2. Select programming language (supports 10+ languages)
3. Paste code or upload file
4. Click "Start Analysis" to get AI analysis results
5. View detailed issue reports and fix suggestions

### Project Management
1. Visit the `/projects` page
2. Click "New Project" to create a project
3. Configure repository URL and scan parameters
4. Start code audit task
5. View audit results and issue statistics

### Audit Tasks
1. Create audit tasks in project detail page
2. Select scan branch and exclusion patterns
3. Configure analysis depth and scope
4. Monitor task execution status
5. View detailed issue reports

### Build and Deploy
```bash
# Development mode
pnpm dev

# Build production version
pnpm build

# Preview build results
pnpm preview

# Code linting
pnpm lint
```

### Environment Variables

#### Core LLM Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_LLM_PROVIDER` | ✅ | `gemini` | LLM provider: `gemini`\|`openai`\|`claude`\|`qwen`\|`deepseek`\|`zhipu`\|`moonshot`\|`baidu`\|`minimax`\|`doubao` |
| `VITE_LLM_API_KEY` | ✅ | - | Universal API Key (higher priority than platform-specific config) |
| `VITE_LLM_MODEL` | ❌ | Auto | Model name (uses platform default if not specified) |
| `VITE_LLM_BASE_URL` | ❌ | - | Custom API endpoint (for proxy, relay, or private deployment) |
| `VITE_LLM_TIMEOUT` | ❌ | `150000` | Request timeout (milliseconds) |
| `VITE_LLM_TEMPERATURE` | ❌ | `0.2` | Temperature parameter (0.0-2.0), controls output randomness |
| `VITE_LLM_MAX_TOKENS` | ❌ | `4096` | Maximum output tokens |

#### Platform-Specific API Key Configuration (Optional)
| Variable | Description | Special Requirements |
|----------|-------------|---------------------|
| `VITE_GEMINI_API_KEY` | Google Gemini API Key | - |
| `VITE_GEMINI_MODEL` | Gemini model (default: gemini-2.5-flash) | - |
| `VITE_OPENAI_API_KEY` | OpenAI API Key | - |
| `VITE_OPENAI_MODEL` | OpenAI model (default: gpt-4o-mini) | - |
| `VITE_OPENAI_BASE_URL` | OpenAI custom endpoint | For relay services |
| `VITE_CLAUDE_API_KEY` | Anthropic Claude API Key | - |
| `VITE_CLAUDE_MODEL` | Claude model (default: claude-3-5-sonnet-20241022) | - |
| `VITE_QWEN_API_KEY` | Alibaba Qwen API Key | - |
| `VITE_QWEN_MODEL` | Qwen model (default: qwen-turbo) | - |
| `VITE_DEEPSEEK_API_KEY` | DeepSeek API Key | - |
| `VITE_DEEPSEEK_MODEL` | DeepSeek model (default: deepseek-chat) | - |
| `VITE_ZHIPU_API_KEY` | Zhipu AI API Key | - |
| `VITE_ZHIPU_MODEL` | Zhipu model (default: glm-4-flash) | - |
| `VITE_MOONSHOT_API_KEY` | Moonshot Kimi API Key | - |
| `VITE_MOONSHOT_MODEL` | Kimi model (default: moonshot-v1-8k) | - |
| `VITE_BAIDU_API_KEY` | Baidu ERNIE API Key | ⚠️ Format: `API_KEY:SECRET_KEY` |
| `VITE_BAIDU_MODEL` | ERNIE model (default: ERNIE-3.5-8K) | - |
| `VITE_MINIMAX_API_KEY` | MiniMax API Key | - |
| `VITE_MINIMAX_MODEL` | MiniMax model (default: abab6.5-chat) | - |
| `VITE_DOUBAO_API_KEY` | Bytedance Doubao API Key | - |
| `VITE_DOUBAO_MODEL` | Doubao model (default: doubao-pro-32k) | - |

#### Database Configuration (Optional)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ❌ | Supabase project URL (for data persistence) |
| `VITE_SUPABASE_ANON_KEY` | ❌ | Supabase anonymous key |

> 💡 **Note**: Without Supabase config, system runs in demo mode without data persistence

#### GitHub Integration Configuration (Optional)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GITHUB_TOKEN` | ❌ | GitHub Personal Access Token (for repository analysis) |

#### Analysis Behavior Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_MAX_ANALYZE_FILES` | `40` | Maximum files per analysis |
| `VITE_LLM_CONCURRENCY` | `2` | LLM concurrent requests (reduce to avoid rate limiting) |
| `VITE_LLM_GAP_MS` | `500` | Gap between LLM requests (milliseconds, increase to avoid rate limiting) |

#### Application Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_ID` | `xcodereviewer` | Application identifier |

## 🤝 Contributing

We warmly welcome all forms of contributions! Whether it's submitting issues, creating PRs, or improving documentation, every contribution is important to us. Please contact us for detailed information.

### Development Workflow

1.  **Fork** this project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Create a **Pull Request**

## 🙏 Acknowledgments

- **[Google Gemini AI](https://ai.google.dev/)**: Providing powerful AI analysis capabilities
- **[Supabase](https://supabase.com/)**: Providing convenient backend-as-a-service support
- **[Radix UI](https://www.radix-ui.com/)**: Providing accessible UI components
- **[Tailwind CSS](https://tailwindcss.com/)**: Providing modern CSS framework
- **[Recharts](https://recharts.org/)**: Providing professional chart components
- And all the authors of open source software used in this project!

## 📞 Contact Us

- **Project Link**: [https://github.com/lintsinghua/XCodeReviewer](https://github.com/lintsinghua/XCodeReviewer)
- **Issue Reports**: [Issues](https://github.com/lintsinghua/XCodeReviewer/issues)
- **Author Email**: tsinghuaiiilove@gmail.com
 
## 🎯 Future Plans

Currently, XCodeReviewer is positioned in the rapid prototype verification stage, and its functions need to be gradually improved. Based on the subsequent development of the project and everyone's suggestions, the future development plan is as follows (to be implemented as soon as possible):

- **✅ Multi-Platform LLM Support**: Implemented API calling functionality for 10+ mainstream platforms (Gemini, OpenAI, Claude, Qwen, DeepSeek, Zhipu AI, Kimi, ERNIE, MiniMax, Doubao, Ollama Local Models), with support for free configuration and switching
- **✅ Local Model Support**: Added support for Ollama local large models to meet data privacy requirements
- **Multi-Agent Collaboration**: Consider introducing a multi-agent collaboration architecture, which will implement the `Agent + Human Dialogue` feedback function, including multi-round dialogue process display, human dialogue interruption intervention, etc., to obtain a clearer, more transparent, and supervised auditing process, thereby improving audit quality.
- **Professional Report File Generation**: Generate professional audit report files in relevant formats according to different needs, supporting customization of file report formats, etc.
- **Custom Audit Standards**: Different teams have their own coding standards, and different projects have specific security requirements, which is exactly what we want to do next in this project. The current version is still in a "semi-black box mode", where the project guides the analysis direction and defines audit standards through Prompt engineering, and the actual analysis effect is determined by the built-in knowledge of powerful pre-trained AI models. In the future, we will combine methods such as reinforcement learning and supervised learning fine-tuning to develop support for custom rule configuration, define team-specific rules through YAML or JSON, provide best practice templates for common frameworks, etc., to obtain audit results that are more in line with requirements and standards.

---

⭐ If this project helps you, please give us a **Star**! Your support is our motivation to keep moving forward!

[![Star History](https://api.star-history.com/svg?repos=lintsinghua/XCodeReviewer&type=Date)](https://star-history.com/#lintsinghua/XCodeReview)
---

## 📄 Disclaimer

This disclaimer is intended to clarify the responsibilities and risks associated with the use of this open source project and to protect the legitimate rights and interests of project authors, contributors and maintainers. The code, tools and related content provided by this open source project are for reference and learning purposes only.

#### 1. **Code Privacy and Security Warning**
- ⚠️ **Important Notice**: This tool analyzes code by calling third-party LLM service provider APIs, which means **your code will be sent to the servers of the selected LLM service provider**.
- **It is strictly prohibited to upload the following types of code**:
  - Code containing trade secrets, proprietary algorithms, or core business logic
  - Code involving state secrets, national defense security, or other classified information
  - Code containing sensitive data (such as user data, keys, passwords, tokens, etc.)
  - Code restricted by laws and regulations from being transmitted externally
  - Proprietary code of clients or third parties (without authorization)
- Users **must independently assess the sensitivity of their code** and bear full responsibility for uploading code and any resulting information disclosure.
- **Recommendation**: For sensitive code, please wait for future local model deployment support in this project, or use privately deployed LLM services.
- Project authors, contributors, and maintainers **assume no responsibility for any information disclosure, intellectual property infringement, legal disputes, or other losses resulting from users uploading sensitive code**.

#### 2. **Non-Professional Advice**
- The code analysis results and suggestions provided by this tool are **for reference only** and do not constitute professional security audits, code reviews, or legal advice.
- Users must combine manual reviews, professional tools, and other reliable resources to thoroughly validate critical code (especially in high-risk areas such as security, finance, or healthcare).

#### 3. **No Warranty and Liability Disclaimer**
- This project is provided "as is" **without any express or implied warranties**, including but not limited to merchantability, fitness for a particular purpose, and non-infringement.
- Authors, contributors, and maintainers **shall not be liable for any direct, indirect, incidental, special, punitive, or consequential damages**, including but not limited to data loss, system failures, security breaches, or business losses, even if advised of the possibility.

#### 4. **Limitations of AI Analysis**
- This tool relies on AI models such as Google Gemini, and results may contain **errors, omissions, or inaccuracies**, with no guarantee of completeness or reliability.
- AI outputs **cannot replace human expert judgment**; users are solely responsible for the final code quality and any outcomes.

#### 5. **Third-Party Services and Data Privacy**
- This project integrates multiple third-party LLM services including Google Gemini, OpenAI, Claude, Qwen, DeepSeek, as well as Supabase, GitHub, and other services. Usage is subject to their respective terms of service and privacy policies.
- **Code Transmission Notice**: User-submitted code will be sent via API to the selected LLM service provider for analysis. The transmission process and data processing follow each service provider's privacy policy.
- Users must obtain and manage API keys independently; this project **does not store, transmit, or process user API keys and sensitive information**.
- Availability, accuracy, privacy protection, data retention policies, or disruptions of third-party services are the responsibility of the providers; project authors assume no joint liability.
- **Data Retention Warning**: Different LLM service providers have varying policies on API request data retention and usage. Users should carefully read the privacy policy and terms of use of their chosen service provider before use.

#### 6. **User Responsibilities**
- Users must ensure their code does not infringe third-party intellectual property rights, does not contain confidential information, and complies with open-source licenses and applicable laws.
- Users **bear full responsibility for the content, nature, and compliance of uploaded code**, including but not limited to:
  - Ensuring code does not contain sensitive information or trade secrets
  - Ensuring they have the right to use and analyze the code
  - Complying with data protection and privacy laws in their country/region
  - Adhering to confidentiality agreements and security policies of their company or organization
- **This tool must not be used for illegal, malicious, or rights-infringing purposes**; users bear full legal and financial responsibility for all consequences. Authors, contributors, and maintainers **shall bear no responsibility** for such activities or their consequences and reserve the right to pursue abusers.

#### 7. **Open Source Contributions**
- Code, content, or suggestions from contributors **do not represent the project's official stance**; contributors are responsible for their accuracy, security, and compliance.
- Maintainers reserve the right to review, modify, reject, or remove any contributions.

For questions, please contact maintainers via GitHub Issues. This disclaimer is governed by the laws of the project's jurisdiction.
