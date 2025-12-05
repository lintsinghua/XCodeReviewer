# 部署指南

本文档详细介绍 XCodeReviewer 的各种部署方式，包括 Docker Compose 一键部署、生产环境部署和本地开发环境搭建。

## 目录

- [快速开始](#快速开始)
- [Docker Compose 部署（推荐）](#docker-compose-部署推荐)
- [生产环境部署](#生产环境部署)
- [本地开发部署](#本地开发部署)
- [常见部署问题](#常见部署问题)

---

## 快速开始

最快的方式是使用 Docker Compose 一键部署：

```bash
# 1. 克隆项目
git clone https://github.com/lintsinghua/XCodeReviewer.git
cd XCodeReviewer

# 2. 配置后端环境变量
cp backend/env.example backend/.env
# 编辑 backend/.env，配置 LLM API Key

# 3. 启动所有服务
docker-compose up -d

# 4. 访问应用
# 前端: http://localhost:5173
# 后端 API: http://localhost:8000/docs
```

### 演示账户

系统启动时会自动创建演示账户，包含示例项目和审计数据，可直接体验完整功能：

- 📧 邮箱：`demo@example.com`
- 🔑 密码：`demo123`

> ⚠️ **安全提示**: 生产环境部署后，请删除演示账户或修改密码。

---

## Docker Compose 部署（推荐）

完整的前后端分离部署方案，包含前端、后端和 PostgreSQL 数据库。

### 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

### 部署步骤

```bash
# 1. 克隆项目
git clone https://github.com/lintsinghua/XCodeReviewer.git
cd XCodeReviewer

# 2. 配置后端环境变量
cp backend/env.example backend/.env
```

编辑 `backend/.env` 文件，配置必要参数：

```env
# 数据库配置（Docker Compose 会自动处理）
POSTGRES_SERVER=db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=xcodereviewer

# 安全配置（生产环境请修改）
SECRET_KEY=your-super-secret-key-change-this-in-production

# LLM 配置（必填）
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini

# 可选：API 中转站
# LLM_BASE_URL=https://your-proxy.com/v1
```

```bash
# 3. 启动所有服务
docker-compose up -d

# 4. 查看服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f
```

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| `frontend` | 5173 | React 前端应用（开发模式，支持热重载） |
| `backend` | 8000 | FastAPI 后端 API |
| `db` | 5432 | PostgreSQL 15 数据库 |

### 访问地址

- 前端应用: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档 (Swagger): http://localhost:8000/docs
- API 文档 (ReDoc): http://localhost:8000/redoc

### 常用命令

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（清除数据库）
docker-compose down -v

# 重新构建镜像
docker-compose build --no-cache

# 查看特定服务日志
docker-compose logs -f backend

# 进入容器调试
docker-compose exec backend bash
docker-compose exec db psql -U postgres -d xcodereviewer
```

---

## 生产环境部署

生产环境建议使用 Nginx 提供前端静态文件服务，并配置 HTTPS。

### 方式一：使用预构建 Docker 镜像

```bash
# 拉取最新镜像
docker pull ghcr.io/lintsinghua/xcodereviewer-frontend:latest
docker pull ghcr.io/lintsinghua/xcodereviewer-backend:latest

# 启动后端和数据库
docker-compose up -d db backend

# 启动前端（Nginx 生产镜像）
docker run -d \
  --name xcodereviewer-frontend \
  -p 80:80 \
  --network xcodereviewer-network \
  ghcr.io/lintsinghua/xcodereviewer-frontend:latest
```

### 方式二：本地构建生产镜像

```bash
# 构建前端生产镜像（使用 Nginx）
docker build -t xcodereviewer-frontend .

# 运行前端容器
docker run -d \
  -p 80:80 \
  --name xcodereviewer-frontend \
  xcodereviewer-frontend

# 后端和数据库仍使用 docker-compose
docker-compose up -d db backend
```

### 方式三：手动部署

#### 前端部署

```bash
cd frontend

# 安装依赖
pnpm install

# 构建生产版本
pnpm build

# 将 dist 目录部署到 Nginx/Apache 等 Web 服务器
```

Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/xcodereviewer/dist;
    index index.html;

    # 前端路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 后端部署

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp env.example .env
# 编辑 .env 文件

# 初始化数据库
alembic upgrade head

# 使用 Gunicorn 启动（生产环境）
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### 生产环境安全建议

1. **修改默认密钥**：务必修改 `SECRET_KEY` 为随机字符串
2. **配置 HTTPS**：使用 Let's Encrypt 或其他 SSL 证书
3. **限制 CORS**：在生产环境配置具体的前端域名
4. **数据库安全**：修改默认数据库密码，限制访问 IP
5. **API 限流**：配置 Nginx 或应用层限流
6. **日志监控**：配置日志收集和监控告警

---

## 本地开发部署

适合需要开发或自定义修改的场景。

### 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | 18+ | 前端运行环境 |
| Python | 3.13+ | 后端运行环境 |
| PostgreSQL | 15+ | 数据库 |
| pnpm | 8+ | 推荐的包管理器 |
| uv | 最新版 | 推荐的 Python 包管理器 |

### 数据库准备

```bash
# 方式一：使用 Docker 启动 PostgreSQL
docker run -d \
  --name xcodereviewer-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=xcodereviewer \
  -p 5432:5432 \
  postgres:15-alpine

# 方式二：使用本地 PostgreSQL
# 创建数据库
createdb xcodereviewer
```

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
# 或使用 pip
pip install -r requirements.txt

# 4. 配置环境变量
cp env.example .env
# 编辑 .env 文件，配置数据库和 LLM 参数

# 5. 初始化数据库
alembic upgrade head

# 6. 启动后端服务（开发模式，支持热重载）
uvicorn app.main:app --reload --port 8000
```

### 前端启动

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
pnpm install
# 或 npm install / yarn install

# 3. 配置环境变量（可选，也可使用运行时配置）
cp .env.example .env

# 4. 启动开发服务器
pnpm dev

# 5. 访问应用
# 浏览器打开 http://localhost:5173
```

### 开发工具

```bash
# 前端代码检查
cd frontend
pnpm lint
pnpm type-check

# 前端代码格式化
pnpm format

# 后端类型检查
cd backend
mypy app

# 后端代码格式化
ruff format app
```

---

## 数据存储

XCodeReviewer 采用前后端分离架构，所有数据存储在后端 PostgreSQL 数据库中。

### 数据管理

在 `/admin` 页面的"数据库管理"标签页中，可以：

- **导出数据**: 将所有数据导出为 JSON 文件备份
- **导入数据**: 从 JSON 文件恢复数据
- **清空数据**: 删除所有数据（谨慎操作）
- **健康检查**: 检查数据库连接状态和数据完整性

### 数据库备份

```bash
# 导出 PostgreSQL 数据
docker-compose exec db pg_dump -U postgres xcodereviewer > backup.sql

# 恢复数据
docker-compose exec -T db psql -U postgres xcodereviewer < backup.sql
```

---

## 常见部署问题

### Docker 相关

**Q: 容器启动失败，提示端口被占用**

```bash
# 检查端口占用
lsof -i :5173
lsof -i :8000
lsof -i :5432

# 停止占用端口的进程，或修改 docker-compose.yml 中的端口映射
```

**Q: 数据库连接失败**

```bash
# 检查数据库容器状态
docker-compose ps db

# 查看数据库日志
docker-compose logs db

# 确保数据库健康检查通过后再启动后端
docker-compose up -d db
docker-compose exec db pg_isready -U postgres
docker-compose up -d backend
```

### 后端相关

**Q: PDF 导出功能报错（WeasyPrint 依赖问题）**

WeasyPrint 需要系统级依赖，Docker 镜像已包含。本地开发时：

```bash
# macOS
brew install pango cairo gdk-pixbuf libffi

# Ubuntu/Debian
sudo apt-get install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf2.0-0

# Windows - 参见 FAQ.md 中的详细说明
```

**Q: LLM API 请求超时**

```env
# 增加超时时间
LLM_TIMEOUT=300

# 降低并发数
LLM_CONCURRENCY=1

# 增加请求间隔
LLM_GAP_MS=3000
```

### 前端相关

**Q: 前端无法连接后端 API**

检查 `frontend/.env` 中的 API 地址配置：

```env
# 本地开发
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Docker Compose 部署
VITE_API_BASE_URL=/api
```

---

## 更多资源

- [配置说明](CONFIGURATION.md) - 详细的配置参数说明
- [LLM 平台支持](LLM_PROVIDERS.md) - 各 LLM 平台的配置方法
- [常见问题](FAQ.md) - 更多问题解答
- [贡献指南](../CONTRIBUTING.md) - 参与项目开发
