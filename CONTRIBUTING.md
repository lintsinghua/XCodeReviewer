# 贡献指南

我们热烈欢迎所有形式的贡献！无论是提交 issue、创建 PR，还是改进文档，您的每一次贡献对我们都至关重要。

## 开发流程

1. **Fork** 本项目
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建一个 **Pull Request**

## 环境要求

- Node.js 18+
- Python 3.13+
- PostgreSQL 15+
- pnpm 8+ (推荐) 或 npm/yarn

## 本地开发

### 后端启动

```bash
cd backend
uv venv
source .venv/bin/activate  # Linux/macOS
# 或 .venv\Scripts\activate  # Windows
uv pip install -e .
cp env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 前端启动

```bash
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

## 代码规范

- 后端使用 Python 类型注解
- 前端使用 TypeScript
- 提交前请确保代码通过 lint 检查

## 问题反馈

如有问题，请通过 [Issues](https://github.com/lintsinghua/XCodeReviewer/issues) 反馈。

## 贡献者

感谢以下优秀的贡献者们！

[![Contributors](https://contrib.rocks/image?repo=lintsinghua/XCodeReviewer)](https://github.com/lintsinghua/XCodeReviewer/graphs/contributors)
