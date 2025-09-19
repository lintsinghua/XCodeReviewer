# XCodeReviewer - 智能代码审计系统

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/lintsinghua/XCodeReviewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.0.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.1.4-646CFF.svg)](https://vitejs.dev/)

**一个基于大语言模型（LLM）驱动的现代化代码审计平台，为开发者提供智能、全面的代码质量分析和审查服务。**

## 📖 项目简介

XCodeReviewer 是一个智能代码审计系统，利用 Google Gemini AI 的强大能力，为代码仓库和代码片段提供深度的质量分析。系统不仅能够发现代码中的问题，还能提供详细的解释和修复建议，帮助开发者提升代码质量。

### 🎯 核心价值

- **AI 驱动分析**：基于 Google Gemini 的智能代码分析引擎
- **多维度评估**：覆盖安全性、性能、可维护性、代码风格等多个维度
- **可解释性**：提供 What-Why-How 模式的详细解释
- **实时分析**：支持即时代码片段分析和仓库级审计
- **现代化界面**：基于 React + TypeScript 的响应式 Web 界面

## ✨ 核心功能

### 🚀 项目管理
- **项目创建与管理**：支持 GitHub、GitLab 等代码仓库集成
- **多语言支持**：支持 JavaScript、TypeScript、Python、Java、Go、Rust 等主流编程语言
- **分支管理**：支持指定分支的代码审计

### ⚡ 即时分析
- **代码片段分析**：直接在 Web 界面中粘贴代码进行即时分析
- **多语言支持**：支持 10+ 种编程语言的代码分析
- **实时反馈**：快速获得代码质量评分和问题建议

### 🧠 智能审计
- **AI 驱动分析**：基于 Google Gemini 的深度代码理解
- **多维度检测**：
  - 🐛 **潜在 Bug**：发现逻辑错误和边界条件问题
  - 🔒 **安全漏洞**：识别安全风险和漏洞
  - ⚡ **性能问题**：检测性能瓶颈和优化点
  - 🎨 **代码风格**：确保代码符合最佳实践
  - 🔧 **可维护性**：评估代码的可读性和可维护性

### 💡 可解释性分析
- **What-Why-How 模式**：
  - **What**：问题是什么
  - **Why**：为什么是问题
  - **How**：如何修复
- **代码定位**：精确定位问题代码行和列
- **修复建议**：提供具体的代码修复示例

### 📊 可视化报告
- **质量评分**：0-100 分的综合质量评估
- **问题统计**：按类型和严重程度分类的问题统计
- **趋势分析**：代码质量变化趋势图表
- **性能指标**：系统性能监控和报告

## 🛠️ 技术栈

### 前端技术
- **React 18** - 现代化的用户界面框架
- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 快速的构建工具和开发服务器
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Radix UI** - 无样式的 UI 组件库
- **Recharts** - 基于 React 的图表库
- **React Router** - 客户端路由管理

### AI 与后端
- **Google Gemini AI** - 大语言模型驱动的代码分析
- **Supabase** - 后端即服务（BaaS）平台
- **PostgreSQL** - 关系型数据库
- **Axios** - HTTP 客户端

### 开发工具
- **Biome** - 快速的代码格式化和检查工具
- **Ast-grep** - 基于 AST 的代码搜索工具
- **ESLint** - JavaScript 代码检查工具

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- pnpm 8+ (推荐) 或 npm/yarn
- Google Gemini API Key

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/lintsinghua/XCodeReviewer.git
cd XCodeReviewer
```

2. **安装依赖**
```bash
pnpm install
# 或
npm install
```

3. **环境配置**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，添加必要的环境变量
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash
VITE_GEMINI_TIMEOUT_MS=25000
```

4. **启动开发服务器**
```bash
pnpm dev
# 或
npm run dev
```

5. **访问应用**
打开浏览器访问 [http://localhost:5173](http://localhost:5173)

### 构建生产版本

```bash
pnpm build
# 或
npm run build
```

### 预览生产版本

```bash
pnpm preview
# 或
npm run preview
```

## 📁 项目结构

```
XCodeReviewer/
├── src/
│   ├── components/          # React 组件
│   │   ├── common/         # 通用组件
│   │   ├── ui/             # UI 组件库
│   │   └── debug/          # 调试组件
│   ├── pages/              # 页面组件
│   ├── services/           # 服务层
│   ├── types/              # TypeScript 类型定义
│   ├── hooks/              # 自定义 React Hooks
│   ├── lib/                # 工具函数
│   └── db/                 # 数据库配置
├── public/                 # 静态资源
├── supabase/              # Supabase 配置
└── docs/                  # 文档
```

## 🔧 配置说明

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `VITE_GEMINI_API_KEY` | Google Gemini API 密钥 | 必填 |
| `VITE_GEMINI_MODEL` | 使用的 Gemini 模型 | `gemini-2.5-flash` |
| `VITE_GEMINI_TIMEOUT_MS` | API 请求超时时间 | `25000` |

### 支持的编程语言

- JavaScript
- TypeScript  
- Python
- Java
- Go
- Rust
- C++
- C#
- PHP
- Ruby

## 📊 功能特性

### 代码分析维度

1. **安全性分析**
   - SQL 注入检测
   - XSS 漏洞识别
   - 敏感信息泄露
   - 权限控制问题

2. **性能优化**
   - 算法复杂度分析
   - 内存泄漏检测
   - 异步操作优化
   - 资源使用效率

3. **代码质量**
   - 代码重复检测
   - 复杂度评估
   - 命名规范检查
   - 注释完整性

4. **最佳实践**
   - 设计模式应用
   - 错误处理规范
   - 测试覆盖率
   - 文档完整性

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

### 开发流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详细信息。

## 🙏 致谢

- [Google Gemini AI](https://ai.google.dev/) - 提供强大的 AI 分析能力
- [Supabase](https://supabase.com/) - 提供后端服务支持
- [React](https://reactjs.org/) - 前端框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Radix UI](https://www.radix-ui.com/) - UI 组件库

## 📞 联系我们

- 项目链接：[https://github.com/lintsinghua/XCodeReviewer](https://github.com/lintsinghua/XCodeReviewer)
- 问题反馈：[Issues](https://github.com/lintsinghua/XCodeReviewer/issues)

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！
