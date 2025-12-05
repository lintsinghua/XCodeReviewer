# XCodeReviewer - 您的智能代码审计伙伴 🚀

> 多Agent、PR批量自动审计版本正在开发中，敬请期待......

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

## 📚 文档导航

| 文档 | 说明 |
|------|------|
| [部署指南](docs/DEPLOYMENT.md) | Docker 和本地开发部署说明 |
| [配置说明](docs/CONFIGURATION.md) | 后端配置、数据库模式、API 中转站 |
| [LLM 平台支持](docs/LLM_PROVIDERS.md) | 10+ LLM 平台配置和 API Key 获取 |
| [常见问题](docs/FAQ.md) | 常见问题解答 |
| [贡献指南](CONTRIBUTING.md) | 如何参与项目贡献 |
| [安全政策](SECURITY.md) | 代码隐私与安全说明 |
| [免责声明](DISCLAIMER.md) | 使用条款与免责声明 |

## 🌟 为什么选择 XCodeReviewer？

- **AI 驱动的深度分析**：超越传统静态分析，理解代码意图，发现深层逻辑问题
- **多维度、全方位评估**：从安全性、性能、可维护性到代码风格，提供 360 度无死角的质量评估
- **清晰、可行的修复建议**：独创 What-Why-How 模式，不仅告诉您"是什么"问题，还解释"为什么"，并提供"如何修复"的具体代码示例
- **多平台 LLM 支持**: 已实现 10+ 主流平台 API 调用功能（Gemini、OpenAI、Claude、通义千问、DeepSeek、智谱AI、Kimi、文心一言、MiniMax、豆包、Ollama 本地大模型）
- **前后端分离架构**：采用 React + FastAPI 现代化架构，后端使用 LiteLLM 统一适配多种 LLM 平台
- **可视化运行时配置**：无需重新构建镜像，直接在浏览器中配置所有 LLM 参数和 API Keys

## 🎬 项目演示

#### 智能仪表盘
![智能仪表盘](frontend/public/images/example1.png)
*实时展示项目统计、质量趋势和系统性能*

#### 即时分析
![即时分析](frontend/public/images/example2.png)
*支持代码片段快速分析，提供详细的 What-Why-How 解释和修复建议*

#### 项目管理
![项目管理](frontend/public/images/example3.png)
*集成 GitHub/GitLab 仓库，支持多语言项目审计和批量代码分析*

#### 审计报告
![审计报告](frontend/public/images/审计报告示例.png)
*专业的代码审计报告，支持导出 PDF/JSON 格式*

## 🚀 快速开始

### Docker Compose 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/lintsinghua/XCodeReviewer.git
cd XCodeReviewer

# 配置后端环境变量
cp backend/env.example backend/.env
# 编辑 backend/.env 文件，配置 LLM API Key 等参数

# 启动所有服务
docker-compose up -d

# 访问应用
# 前端: http://localhost:5173
# 后端 API: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

更多部署方式请参考 [部署指南](docs/DEPLOYMENT.md)。

## ✨ 核心功能

- **🚀 项目管理**：一键集成 GitHub/GitLab，支持多语言项目审计，ZIP 文件上传
- **⚡ 即时分析**：代码片段快速分析，10+ 种语言支持，历史记录和报告导出
- **🧠 智能审计**：五大核心维度检测（Bug、安全、性能、风格、可维护性）
- **💡 可解释性分析**：What-Why-How 模式，精准代码定位
- **📊 可视化报告**：质量仪表盘、趋势分析、JSON/PDF 导出
- **⚙️ 系统管理**：运行时配置、数据库管理、用户认证

## 🎯 未来计划

- **✅ 多平台 LLM 支持**: 已实现 10+ 主流平台 API 调用功能
- **✅ 本地模型支持**: 已加入对 Ollama 本地大模型的调用功能
- **✅ 可视化配置管理**: 已实现运行时配置系统
- **✅ 专业报告文件生成**: 支持 JSON 和 PDF 格式导出
- **✅ 前后端分离架构**: 采用 FastAPI + React 现代化架构
- **✅ 用户认证系统**: JWT Token 认证和用户管理
- **🚧 CI/CD 集成与 PR 自动审查**: 计划实现 GitHub/GitLab CI 集成
- **Multi-Agent Collaboration**: 考虑引入多智能体协作架构
- **审计标准自定义**: 支持通过 YAML/JSON 定义团队特定的编码规范

## 🤝 贡献

我们欢迎所有形式的贡献！详情请参考 [贡献指南](CONTRIBUTING.md)。

## 👥 贡献者

[![Contributors](https://contrib.rocks/image?repo=lintsinghua/XCodeReviewer)](https://github.com/lintsinghua/XCodeReviewer/graphs/contributors)

## 📞 联系我们

- **项目链接**: [https://github.com/lintsinghua/XCodeReviewer](https://github.com/lintsinghua/XCodeReviewer)
- **问题反馈**: [Issues](https://github.com/lintsinghua/XCodeReviewer/issues)
- **作者邮箱**: lintsinghua@qq.com（合作请注明来意）

---

⭐ 如果这个项目对您有帮助，请给我们一个 **Star**！

[![Star History](https://api.star-history.com/svg?repos=lintsinghua/XCodeReviewer&type=Date)](https://star-history.com/#lintsinghua/XCodeReviewer&Date)

---

⚠️ **重要提示**：使用本工具前，请务必阅读 [安全政策](SECURITY.md) 和 [免责声明](DISCLAIMER.md)。
