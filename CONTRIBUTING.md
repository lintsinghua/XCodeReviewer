# 贡献指南

感谢你对 XCodeReviewer 的关注！我们热烈欢迎所有形式的贡献，无论是提交 Issue、创建 PR，还是改进文档。

## 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境搭建](#开发环境搭建)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)

---

## 行为准则

请在参与项目时保持友善和尊重。我们致力于为每个人提供一个开放、包容的环境。

---

## 如何贡献

### 报告 Bug

1. 先搜索 [Issues](https://github.com/lintsinghua/XCodeReviewer/issues) 确认问题未被报告
2. 创建新 Issue，使用 Bug 报告模板
3. 提供详细信息：
   - 操作系统和版本
   - 部署方式（Docker/本地）
   - 复现步骤
   - 错误日志或截图
   - 期望行为 vs 实际行为

### 提出新功能

1. 先搜索 Issues 确认功能未被提出
2. 创建新 Issue，描述：
   - 功能需求背景
   - 期望的实现方式
   - 可能的替代方案

### 改进文档

文档改进同样重要！你可以：
- 修复文档中的错误
- 补充缺失的说明
- 改进文档结构
- 添加使用示例

### 贡献代码

1. Fork 本项目
2. 创建功能分支
3. 编写代码和测试
4. 提交 Pull Request

---

## 开发环境搭建

### 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | 18+ | 前端运行环境 |
| Python | 3.13+ | 后端运行环境 |
| PostgreSQL | 15+ | 数据库 |
| pnpm | 8+ | 推荐的前端包管理器 |
| uv | 最新版 | 推荐的 Python 包管理器 |

### 数据库准备

```bash
# 使用 Docker 启动 PostgreSQL（推荐）
docker run -d \
  --name xcodereviewer-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=xcodereviewer \
  -p 5432:5432 \
  postgres:15-alpine
```

### 后端启动

```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境
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

### 前端启动

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
pnpm install

# 3. 配置环境变量（可选）
cp .env.example .env

# 4. 启动开发服务器
pnpm dev
```

---

## 代码规范

### 后端 (Python)

- 使用 Python 3.13+ 类型注解
- 遵循 PEP 8 代码风格
- 使用 Ruff 进行代码格式化和检查
- 使用 mypy 进行类型检查

```bash
# 代码格式化
ruff format app

# 代码检查
ruff check app

# 类型检查
mypy app
```

### 前端 (TypeScript/React)

- 使用 TypeScript 严格模式
- 遵循 React 最佳实践
- 使用 Biome 进行代码格式化和检查

```bash
# 代码检查
pnpm lint

# 类型检查
pnpm type-check

# 代码格式化
pnpm format
```

### 通用规范

- 变量和函数使用有意义的命名
- 添加必要的注释，特别是复杂逻辑
- 保持函数简短，单一职责
- 避免硬编码，使用配置或常量

---

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 代码重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |
| `ci` | CI/CD 相关 |

### 示例

```bash
# 新功能
git commit -m "feat(llm): add support for DeepSeek API"

# Bug 修复
git commit -m "fix(scan): handle empty file content"

# 文档更新
git commit -m "docs: update deployment guide"

# 代码重构
git commit -m "refactor(api): simplify error handling"
```

---

## Pull Request 流程

### 1. Fork 和克隆

```bash
# Fork 项目到你的 GitHub 账号
# 然后克隆到本地
git clone https://github.com/YOUR_USERNAME/XCodeReviewer.git
cd XCodeReviewer

# 添加上游仓库
git remote add upstream https://github.com/lintsinghua/XCodeReviewer.git
```

### 2. 创建分支

```bash
# 同步上游代码
git fetch upstream
git checkout main
git merge upstream/main

# 创建功能分支
git checkout -b feature/your-feature-name
```

### 3. 开发和测试

```bash
# 编写代码...

# 确保代码通过检查
cd frontend && pnpm lint && pnpm type-check
cd backend && ruff check app && mypy app

# 提交代码
git add .
git commit -m "feat: your feature description"
```

### 4. 推送和创建 PR

```bash
# 推送到你的 Fork
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request：

1. 填写 PR 标题（遵循提交规范）
2. 描述改动内容和原因
3. 关联相关 Issue（如有）
4. 等待 Review

### 5. 代码审查

- 回应 Review 意见
- 根据反馈修改代码
- 保持 PR 更新（rebase 上游代码）

---

## 项目结构

```
XCodeReviewer/
├── backend/                 # 后端 (FastAPI)
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── core/           # 核心配置
│   │   ├── db/             # 数据库
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic 模式
│   │   └── services/       # 业务逻辑
│   │       └── llm/        # LLM 适配器
│   ├── alembic/            # 数据库迁移
│   └── pyproject.toml
├── frontend/               # 前端 (React + TypeScript)
│   ├── src/
│   │   ├── app/           # 应用配置
│   │   ├── components/    # UI 组件
│   │   ├── features/      # 功能模块
│   │   ├── pages/         # 页面组件
│   │   └── shared/        # 共享工具
│   └── package.json
├── docs/                   # 文档
├── docker-compose.yml      # Docker 编排
└── README.md
```

---

## 贡献者

感谢所有贡献者的付出！

[![Contributors](https://contrib.rocks/image?repo=lintsinghua/XCodeReviewer)](https://github.com/lintsinghua/XCodeReviewer/graphs/contributors)

---

## 问题反馈

如有问题，请通过以下方式联系：

- [GitHub Issues](https://github.com/lintsinghua/XCodeReviewer/issues)
- 邮箱: lintsinghua@qq.com
