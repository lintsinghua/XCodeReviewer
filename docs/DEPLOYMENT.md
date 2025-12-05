# 部署指南

## Docker Compose 部署（推荐）

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

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| `frontend` | 5173 | React 前端应用（开发模式） |
| `backend` | 8000 | FastAPI 后端 API |
| `db` | 5432 | PostgreSQL 数据库 |

### 生产环境部署

如需生产环境部署，可使用根目录的 `Dockerfile` 构建前端静态文件并通过 Nginx 提供服务：

```bash
# 构建前端生产镜像
docker build -t xcodereviewer-frontend .

# 运行前端容器（端口 8888）
docker run -d -p 8888:80 --name xcodereviewer-frontend xcodereviewer-frontend

# 后端和数据库仍使用 docker-compose
docker-compose up -d db backend
```

## 本地开发部署

适合需要开发或自定义修改的场景。

### 环境要求

- Node.js 18+
- Python 3.13+
- PostgreSQL 15+
- pnpm 8+ (推荐) 或 npm/yarn

### 后端启动

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

### 前端启动

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
