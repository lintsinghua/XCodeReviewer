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

- **🤖 AI-Driven Deep Analysis**: Beyond traditional static analysis, understands code intent and discovers deep logical issues.
- **🎯 Multi-dimensional, Comprehensive Assessment**: From **security**, **performance**, **maintainability** to **code style**, providing 360-degree quality evaluation.
- **💡 Clear, Actionable Fix Suggestions**: Innovative **What-Why-How** approach that not only tells you "what" the problem is, but also explains "why" and provides "how to fix" with specific code examples.
- **⚡ Real-time Feedback, Instant Improvement**: Whether it's code snippets or entire repositories, get fast and accurate analysis results.
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
   # Edit .env file and set at least VITE_GEMINI_API_KEY
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
    # Google Gemini AI Configuration (Required)
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_GEMINI_MODEL=gemini-2.5-flash
    VITE_GEMINI_TIMEOUT_MS=25000
    
    # Supabase Configuration (Optional, for data persistence)
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key-here
    
    # GitHub Integration (Optional, for repository analysis)
    VITE_GITHUB_TOKEN=your_github_token_here
    
    # Application Configuration
    VITE_APP_ID=xcodereviewer
    
    # Analysis Configuration
    VITE_MAX_ANALYZE_FILES=40
    VITE_LLM_CONCURRENCY=2
    VITE_LLM_GAP_MS=500
    ```

4.  **Start development server**
    ```bash
    pnpm dev
    ```

5.  **Access the application**
    Open `http://localhost:5174` in your browser

### 🔑 Getting API Keys

#### Google Gemini API Key(It is expected that more mainstream platform API functions will be opened in the future)
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API Key
3. Add the API Key to `VITE_GEMINI_API_KEY` in your `.env` file

#### Supabase Configuration (Optional)
1. Visit [Supabase](https://supabase.com/) to create a new project
2. Get the URL and anonymous key from project settings
3. Run database migration scripts:
   ```bash
   # Execute in Supabase SQL Editor
   cat supabase/migrations/full_schema.sql
   ```
4. If Supabase is not configured, the system will run in demo mode without data persistence

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

- **AI Deep Code Understanding**: Based on Google Gemini(It is expected that more mainstream platform API functions will be opened in the future), providing intelligent analysis beyond keyword matching.
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

## 🛠️ Tech Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | `React 18` `TypeScript` `Vite` | Modern frontend development stack with hot reload and type safety |
| **UI Components** | `Tailwind CSS` `Radix UI` `Lucide React` | Responsive design, accessibility, rich icon library |
| **Data Visualization** | `Recharts` | Professional chart library supporting multiple chart types |
| **Routing** | `React Router v6` | Single-page application routing solution |
| **State Management** | `React Hooks` `Sonner` | Lightweight state management and notification system |
| **AI Engine** | `Google Gemini 2.5 Flash`(It is expected that more mainstream platform API functions will be opened in the future) | Powerful large language model supporting code analysis |
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
│   │   └── debug/          # Debug components
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx   # Dashboard
│   │   ├── Projects.tsx    # Project management
│   │   ├── InstantAnalysis.tsx # Instant analysis
│   │   ├── AuditTasks.tsx  # Audit tasks
│   │   └── AdminDashboard.tsx # System management
│   ├── features/           # Feature modules
│   │   ├── analysis/       # Analysis related services
│   │   │   └── services/   # AI code analysis engine
│   │   └── projects/       # Project related services
│   │       └── services/   # Repository scanning, ZIP file scanning
│   ├── shared/             # Shared utilities
│   │   ├── config/         # Configuration files (database, environment)
│   │   ├── types/          # TypeScript type definitions
│   │   ├── hooks/          # Custom React Hooks
│   │   ├── utils/          # Utility functions
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

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `VITE_GEMINI_MODEL` | ❌ | AI model name (default: gemini-2.5-flash) |
| `VITE_GEMINI_TIMEOUT_MS` | ❌ | Request timeout (default: 25000ms) |
| `VITE_SUPABASE_URL` | ❌ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ❌ | Supabase anonymous key |
| `VITE_APP_ID` | ❌ | Application identifier (default: xcodereviewer) |
| `VITE_MAX_ANALYZE_FILES` | ❌ | Maximum files to analyze (default: 40) |
| `VITE_LLM_CONCURRENCY` | ❌ | LLM concurrency limit (default: 2) |
| `VITE_LLM_GAP_MS` | ❌ | Gap between LLM requests (default: 500ms) |

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

- **Multi-platform/Local Model Support**: In the future, we will quickly add API calling functions for major mainstream models at home and abroad, such as OpenAI, Claude, Tongyi Qianwen, etc. And the function of calling local large models (to meet data privacy requirements).
- **Multi-Agent Collaboration**: Consider introducing a multi-agent collaboration architecture, which will implement the `Agent + Human Dialogue` feedback function, including multi-round dialogue process display, human dialogue interruption intervention, etc., to obtain a clearer, more transparent, and supervised auditing process, thereby improving audit quality.
- **Professional Report File Generation**: Generate professional audit report files in relevant formats according to different needs, supporting customization of file report formats, etc.
- **Custom Audit Standards**: Different teams have their own coding standards, and different projects have specific security requirements, which is exactly what we want to do next in this project. The current version is still in a "semi-black box mode", where the project guides the analysis direction and defines audit standards through Prompt engineering, and the actual analysis effect is determined by the built-in knowledge of powerful pre-trained AI models. In the future, we will combine methods such as reinforcement learning and supervised learning fine-tuning to develop support for custom rule configuration, define team-specific rules through YAML or JSON, provide best practice templates for common frameworks, etc., to obtain audit results that are more in line with requirements and standards.

---

⭐ If this project helps you, please give us a **Star**! Your support is our motivation to keep moving forward!
[![Star History](https://api.star-history.com/svg?repos=lintsinghua/XCodeReviewer&type=Date)](https://star-history.com/#lintsinghua/XCodeReview)
---

📄 Disclaimer

This disclaimer is intended to clarify the responsibilities and risks associated with the use of this open source project and to protect the legitimate rights and interests of project authors, contributors and maintainers. The code, tools and related content provided by this open source project are for reference and learning purposes only.

#### 1. **Non-Professional Advice**
- The code analysis results and suggestions provided by this tool are **for reference only** and do not constitute professional security audits, code reviews, or legal advice.
- Users must combine manual reviews, professional tools, and other reliable resources to thoroughly validate critical code (especially in high-risk areas such as security, finance, or healthcare).

#### 2. **No Warranty and Liability Disclaimer**
- This project is provided "as is" **without any express or implied warranties**, including but not limited to merchantability, fitness for a particular purpose, and non-infringement.
- Authors, contributors, and maintainers **shall not be liable for any direct, indirect, incidental, special, punitive, or consequential damages**, including but not limited to data loss, system failures, security breaches, or business losses, even if advised of the possibility.

#### 3. **Limitations of AI Analysis**
- This tool relies on AI models such as Google Gemini, and results may contain **errors, omissions, or inaccuracies**, with no guarantee of completeness or reliability.
- AI outputs **cannot replace human expert judgment**; users are solely responsible for the final code quality and any outcomes.

#### 4. **Third-Party Services and Data Privacy**
- This project integrates third-party services like Google Gemini, Supabase, and GitHub, and usage is subject to their respective terms of service.
- Users must obtain and manage API keys independently; this project **does not store, transmit, or process user sensitive credentials**.
- Availability, accuracy, privacy, or disruptions of third-party services are the responsibility of the providers; project authors assume no liability.

#### 5. **User Responsibilities**
- Users must ensure their code does not infringe third-party intellectual property rights and complies with open-source licenses and applicable laws.
- **This tool must not be used for illegal, malicious, or rights-infringing purposes**; users bear full legal and financial responsibility for all consequences. Authors, contributors, and maintainers **shall bear no responsibility** for such activities or their consequences and reserve the right to pursue abusers.

#### 6. **Open Source Contributions**
- Code, content, or suggestions from contributors **do not represent the project's official stance**; contributors are responsible for their accuracy, security, and compliance.
- Maintainers reserve the right to review, modify, reject, or remove any contributions.

For questions, please contact maintainers via GitHub Issues. This disclaimer is governed by the laws of the project's jurisdiction.
