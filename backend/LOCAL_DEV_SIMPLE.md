# 本地开发 - 简化版（无需 Docker）

由于 Docker 镜像拉取遇到网络问题，这里提供一个更简单的本地开发方案。

## 快速开始（使用 SQLite + Mock LLM）

这个方案最简单，不需要安装 PostgreSQL、Redis 等服务。

### 1. 安装 Python 依赖

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # macOS/Linux

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# 复制环境配置文件
cp .env.development .env

# 编辑 .env 文件，确保使用 SQLite
cat > .env << 'EOF'
# 应用配置
APP_NAME=XCodeReviewer
APP_ENV=development
DEBUG=true
LOG_LEVEL=DEBUG

# 服务器
HOST=0.0.0.0
PORT=8000

# 数据库 - 使用 SQLite（无需安装 PostgreSQL）
DATABASE_URL=sqlite+aiosqlite:///./xcodereviewer_dev.db

# Redis - 使用内存模式（无需安装 Redis）
REDIS_URL=redis://localhost:6379/0
REDIS_MAX_CONNECTIONS=10

# 安全
SECRET_KEY=dev-secret-key-change-in-production-min-32-chars-long
JWT_SECRET_KEY=dev-jwt-secret-key-change-in-production-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# Celery - 同步模式（无需 Redis）
CELERY_TASK_ALWAYS_EAGER=true
CELERY_TASK_EAGER_PROPAGATES=true

# 存储 - 本地文件系统
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./storage

# LLM - 使用 Mock 模式（无需真实 API Key）
LLM_MODE=mock

# 功能开关
ENABLE_WEBSOCKET=false
ENABLE_BACKGROUND_TASKS=false
ENABLE_CACHING=false
ENABLE_SWAGGER=true
ENABLE_REDOC=true
EOF
```

### 3. 初始化数据库

```bash
# 创建数据库表
alembic upgrade head

# 创建管理员用户
python scripts/create_admin.py
```

### 4. 启动服务

```bash
# 启动 Backend API
uvicorn app.main:app --reload --port 8000
```

### 5. 访问服务

打开浏览器访问：
- **API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/health

### 6. 测试 API

```bash
# 测试健康检查
curl http://localhost:8000/health

# 注册用户
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass123!"
  }'

# 登录
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "TestPass123!"
  }'
```

---

## 如果需要 Redis（可选）

如果你想使用真实的 Redis（用于缓存和任务队列）：

### macOS 安装 Redis

```bash
# 使用 Homebrew 安装
brew install redis

# 启动 Redis
brew services start redis

# 测试连接
redis-cli ping
```

### Ubuntu/Debian 安装 Redis

```bash
# 安装
sudo apt-get update
sudo apt-get install redis-server

# 启动
sudo systemctl start redis

# 测试
redis-cli ping
```

然后修改 `.env` 文件：
```bash
# 启用 Redis
REDIS_URL=redis://localhost:6379/0
ENABLE_CACHING=true

# 启用 Celery（需要在另一个终端运行 worker）
CELERY_TASK_ALWAYS_EAGER=false
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
```

启动 Celery Worker（在新终端）：
```bash
cd backend
source venv/bin/activate
celery -A tasks.celery_app worker --loglevel=info
```

---

## 如果需要 PostgreSQL（可选）

如果你想使用 PostgreSQL 而不是 SQLite：

### macOS 安装 PostgreSQL

```bash
# 使用 Homebrew 安装
brew install postgresql@15

# 启动服务
brew services start postgresql@15

# 创建数据库
createdb xcodereviewer_dev
```

### Ubuntu/Debian 安装 PostgreSQL

```bash
# 安装
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# 启动
sudo systemctl start postgresql

# 创建数据库
sudo -u postgres createdb xcodereviewer_dev
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

然后修改 `.env` 文件：
```bash
# 使用 PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/xcodereviewer_dev
```

重新运行迁移：
```bash
alembic upgrade head
```

---

## 常见问题

### 1. 端口 8000 被占用

```bash
# 查找占用端口的进程
lsof -ti:8000

# 杀死进程
kill -9 $(lsof -ti:8000)

# 或使用其他端口
uvicorn app.main:app --reload --port 8001
```

### 2. 导入错误

```bash
# 确保在 backend 目录
cd backend

# 设置 PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# 或在 .env 中添加
echo "PYTHONPATH=." >> .env
```

### 3. Alembic 迁移错误

```bash
# 删除数据库文件重新开始
rm xcodereviewer_dev.db

# 重新运行迁移
alembic upgrade head
```

### 4. 依赖安装失败

```bash
# 升级 pip
pip install --upgrade pip

# 单独安装问题依赖
pip install sqlalchemy==2.0.23
pip install fastapi==0.104.1

# 重新安装所有依赖
pip install -r requirements.txt
```

---

## 开发工作流

### 1. 每次开发前

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 2. 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_api_endpoints.py -v

# 带覆盖率
pytest --cov=. --cov-report=html
```

### 3. 代码检查

```bash
# 格式化代码
ruff format .

# 检查代码
ruff check .

# 类型检查
mypy .
```

### 4. 查看日志

```bash
# 日志文件位置
tail -f logs/app.log
```

---

## 下一步

1. ✅ 启动开发服务器
2. 📚 访问 API 文档: http://localhost:8000/docs
3. 🧪 测试 API 端点
4. 💻 开始编写代码

---

**提示**: 这个简化版本适合快速开发和测试。如果需要完整功能（Redis、PostgreSQL、Celery等），可以等网络问题解决后再使用 Docker Compose。
