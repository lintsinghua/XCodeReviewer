# XCodeReviewer - Your Intelligent Code Review Partner 🚀

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
[![Star History](https://api.star-history.com/svg?repos=lintsinghua/XCodeReviewer&type=Date)](https://star-history.com/#lintsinghua/XCodeReviewer&Date)

**XCodeReviewer** is a modern code auditing platform powered by Large Language Models (LLM), designed to provide developers with intelligent, comprehensive, and in-depth code quality analysis and review services.

## 🌟 Why Choose XCodeReviewer?

In the fast-paced world of software development, ensuring code quality is crucial. Traditional code auditing tools are rigid and inefficient, while manual auditing is time-consuming and labor-intensive. XCodeReviewer leverages the powerful capabilities of Google Gemini AI to revolutionize the way code review is conducted:

- **🤖 AI-Driven Deep Analysis**: Beyond traditional static analysis, understanding code intent and discovering deep logical issues.
- **🎯 Multi-dimensional, Comprehensive Assessment**: From **security**, **performance**, **maintainability** to **code style**, providing 360-degree quality evaluation.
- **💡 Clear, Actionable Fix Suggestions**: Innovative **What-Why-How** pattern that not only tells you "what" the problem is, but also explains "why" and provides "how to fix" with specific code examples.
- **⚡ Real-time Feedback, Instant Improvement**: Whether it's code snippets or entire code repositories, you can get fast and accurate analysis results.
- **✨ Modern, High-Quality User Interface**: Built with React + TypeScript, providing smooth and intuitive user experience.

## 🎬 Project Demo

### Main Feature Interfaces

#### 📊 Intelligent Dashboard
![Intelligent Dashboard](public/images/example1.png)
*Real-time display of project statistics, quality trends and system performance, providing comprehensive code audit overview*

#### ⚡ Instant Analysis
![Instant Analysis](public/images/example3.png)
*Support for rapid code snippet analysis, providing detailed What-Why-How explanations and fix suggestions*

#### 🚀 Project Management
![Project Management](public/images/example2.png)
*Integration with GitHub/GitLab repositories, supporting multi-language project auditing and batch code analysis*

## ✨ Core Features

<details>
<summary><b>🚀 Project Management</b></summary>

- **One-click Repository Integration**: Seamless integration with mainstream platforms like GitHub, GitLab.
- **Multi-language "Full Suite" Support**: Covering popular languages like JavaScript, TypeScript, Python, Java, Go, Rust.
- **Flexible Branch Auditing**: Support for precise analysis of specified code branches.
</details>

<details>
<summary><b>⚡ Instant Analysis</b></summary>

- **Code Snippet "Paste & Go"**: Directly paste code in the web interface and get instant analysis results.
- **10+ Language Instant Support**: Meeting your diverse code analysis needs.
- **Millisecond Response**: Quickly get code quality scores and optimization suggestions.
</details>

<details>
<summary><b>🧠 Intelligent Auditing</b></summary>

- **AI Deep Code Understanding**: Based on Google Gemini, providing intelligent analysis beyond keyword matching.
- **Five Core Dimension Detection**:
  - 🐛 **Potential Bugs**: Accurately capture logic errors, boundary conditions, and null pointer issues.
  - 🔒 **Security Vulnerabilities**: Identify security risks like SQL injection, XSS, sensitive information leakage.
  - ⚡ **Performance Bottlenecks**: Discover inefficient algorithms, memory leaks, and unreasonable async operations.
  - 🎨 **Code Style**: Ensure code follows industry best practices and unified standards.
  - 🔧 **Maintainability**: Evaluate code readability, complexity, and modularity.
</details>

<details>
<summary><b>💡 Explainable Analysis (What-Why-How)</b></summary>

- **What (What is it)**: Clearly point out problems in the code.
- **Why (Why)**: Detailed explanation of potential risks and impacts this problem may bring.
- **How (How to fix)**: Provide specific, directly usable code fix examples.
- **Precise Code Location**: Quickly jump to the line and column where the problem is located.
</details>

<details>
<summary><b>📊 Visual Reports</b></summary>

- **Code Quality Dashboard**: Provide 0-100 comprehensive quality assessment, making code health status clear at a glance.
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
| **AI Engine** | `Google Gemini 2.5 Flash` | Powerful large language model for code analysis |
| **Backend Service** | `Supabase` `PostgreSQL` | Full-stack backend-as-a-service with real-time database |
| **HTTP Client** | `Axios` `Ky` | Modern HTTP request libraries |
| **Code Quality** | `Biome` `Ast-grep` `TypeScript` | Code formatting, static analysis, and type checking |
| **Build Tools** | `Vite` `PostCSS` `Autoprefixer` | Fast build tools and CSS processing |

## 🚀 Quick Start

### Requirements

- **Node.js**: `18+`
- **pnpm**: `8+` (recommended) or `npm` / `yarn`
- **Google Gemini API Key**: For AI code analysis
- **Supabase Project**: For data storage (optional, supports offline mode)

### Installation & Setup

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
    # Create environment variables file
    touch .env
    ```
    
    Add the following configuration to the `.env` file:
    ```env
    # Google Gemini AI Configuration (Required)
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_GEMINI_MODEL=gemini-2.5-flash
    VITE_GEMINI_TIMEOUT_MS=25000
    
    # Supabase Configuration (Optional, for data persistence)
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key-here
    
    # App Configuration
    VITE_APP_ID=xcodereviewer
    ```

4.  **Start development server**
    ```bash
    pnpm dev
    ```

5.  **Access the application**
    Open `http://localhost:5173` in your browser

### 🔑 Getting API Keys

#### Google Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API Key
3. Add the API Key to `VITE_GEMINI_API_KEY` in the `.env` file

#### Supabase Configuration
1. Visit [Supabase](https://supabase.com/) to create a new project
2. Get the URL and anonymous key from project settings
3. Run the database migration script:
   ```bash
   # Execute in Supabase SQL editor
   cat supabase/migrations/full_schema.sql
   ```

## 📁 Project Structure

```
XCodeReviewer/
├── src/
│   ├── components/          # React Components
│   │   ├── common/         # Common Components (Header, Footer, PageMeta)
│   │   ├── ui/             # UI Component Library (Based on Radix UI)
│   │   └── debug/          # Debug Components
│   ├── pages/              # Page Components
│   │   ├── Dashboard.tsx   # Dashboard
│   │   ├── Projects.tsx    # Project Management
│   │   ├── InstantAnalysis.tsx # Instant Analysis
│   │   ├── AuditTasks.tsx  # Audit Tasks
│   │   └── AdminDashboard.tsx # System Management
│   ├── services/           # Service Layer
│   │   ├── codeAnalysis.ts # AI Code Analysis Engine
│   │   ├── repoScan.ts     # Repository Scanning Service
│   │   └── repoZipScan.ts  # ZIP File Scanning
│   ├── db/                 # Database Configuration
│   │   └── supabase.ts     # Supabase Client and API
│   ├── types/              # TypeScript Type Definitions
│   ├── hooks/              # Custom React Hooks
│   ├── lib/                # Utility Functions
│   └── routes.tsx          # Route Configuration
├── supabase/
│   └── migrations/         # Database Migration Files
├── public/                 # Static Assets
└── docs/                   # Documentation
```

## 🎯 User Guide

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
4. Start code audit tasks
5. View audit results and issue statistics

### Audit Tasks
1. Create audit tasks in project details page
2. Select scan branch and exclude patterns
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

# Code checking
pnpm lint
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | ✅ | Google Gemini API Key |
| `VITE_GEMINI_MODEL` | ❌ | AI Model Name (default: gemini-2.5-flash) |
| `VITE_GEMINI_TIMEOUT_MS` | ❌ | Request Timeout (default: 25000ms) |
| `VITE_SUPABASE_URL` | ❌ | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | ❌ | Supabase Anonymous Key |
| `VITE_APP_ID` | ❌ | App Identifier (default: xcodereviewer) |

## 🤝 Contributing

We warmly welcome all forms of contributions! Whether it's submitting issues, creating PRs, or improving documentation, every contribution is crucial to us. Please contact us for detailed information.

### Development Workflow

1.  **Fork** this project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Create a **Pull Request**

#### 4. Build Failure
**Problem**: `pnpm build` command fails
**Solution**:
```bash
# Clear cache
pnpm clean
rm -rf node_modules
pnpm install

# Check TypeScript type errors
pnpm type-check
```

## 🙏 Acknowledgments

- **[Google Gemini AI](https://ai.google.dev/)**: Providing powerful AI analysis capabilities
- **[Supabase](https://supabase.com/)**: Providing convenient backend-as-a-service support
- **[Radix UI](https://www.radix-ui.com/)**: Providing accessible UI components
- **[Tailwind CSS](https://tailwindcss.com/)**: Providing modern CSS framework
- **[Recharts](https://recharts.org/)**: Providing professional chart components
- And all the authors of the open source software used in this project!

## 📞 Contact Us

- **Project Link**: [https://github.com/lintsinghua/XCodeReviewer](https://github.com/lintsinghua/XCodeReviewer)
- **Issue Feedback**: [Issues](https://github.com/lintsinghua/XCodeReviewer/issues)
- **Email**: tsinghuaiiilove@gmail.com

---

⭐ If this project is helpful to you, please give us a **Star**! Your support is the driving force for our continuous progress!
