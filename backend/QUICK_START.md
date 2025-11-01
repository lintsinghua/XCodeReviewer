# XCodeReviewer 本地开发快速启动指南

## 🚀 快速开始（5分钟）

### 前置要求

确保你的系统已安装：
- **Python 3.11+** 
- **Docker & Docker Compose** (推荐方式)
- **Redis** (如果不使用Docker)
- **Git**

---

## 方式一：使用 Docker Compose（推荐）⭐

这是最简单的方式，一键启动所有服务。

### 1. 启动所有服务

```bash
cd backend

# 启动所有服务（PostgreSQL, Redis, MinIO, Backend, Celery, Flower, Prometheus, Grafana）
docker-compose -f docker-compose.dev.yml up -d

# 查看服务状态
docker-compose -f docker-compose.dev.yml ps

# 查看日志
docker-compose -f docker-compose.dev.yml logs -f backend
```

### 2. 初始化数据库

```bash
# 运行数据库迁移
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head

# 创建管理员用户（可选）
docker-compose -f docker-compose.dev.yml exec backend python scripts/create_admin.py
```

### 3. 访问服务

服务启动后，可以访问：

- **Backend API**: http://localhost:8000
- **API 文档 (Swagger)**: http://localhost:8000/docs
- **API 文档 (ReDoc)**: http://localhost:8000/redoc
- **健康检查**: http://localhost:8000/health
- **Flower (Celery监控)**: http://localhost:5555
- **MinIO 控制台**: http://localhost:9001 (minioadmin/minioadmin)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

### 4. 测试 API

```bash
# 测试健康检查
curl http://localhost:8000/health

# 注册用户
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "SecurePass123!"
  }'

# 登录获取token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "SecurePass123!"
  }'
```

### 5. 停止服务

```bash
# 停止所有服务
docker-compose -f docker-compose.dev.yml down

# 停止并删除数据卷（清空数据）
docker-compose -f docker-compose.dev.yml down -v
```

---

## 方式二：本地 Python 环境

如果你想在本地直接运行Python代码（适合开发调试）。

### 1. 安装依赖

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动基础服务（使用Docker）

```bash
# 只启动 PostgreSQL, Redis, MinIO
docker-compose -f docker-compose.dev.yml up -d postgres redis minio

# 等待服务就绪
sleep 10
```

### 3. 配置环境变量

```bash
# 复制环境变量文件
cp .env.development .env

# 编辑 .env 文件，确保数据库连接正确
# DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/xcodereviewer_dev
```

### 4. 初始化数据库

```bash
# 运行迁移
alembic upgrade head

# 创建管理员用户（可选）
python scripts/create_admin.py
```

### 5. 启动服务

打开多个终端窗口：

**终端 1 - Backend API:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**终端 2 - Celery Worker:**
```bash
cd backend
source venv/bin/activate
celery -A tasks.celery_app worker --loglevel=info
```

**终端 3 - Celery Beat (可选):**
```bash
cd backend
source venv/bin/activate
celery -A tasks.celery_app beat --loglevel=info
```

**终端 4 - Flower (可选):**
```bash
cd backend
source venv/bin/activate
celery -A tasks.celery_app flower --port=5555
```

---

## 方式三：使用 SQLite（最简单，无需Docker）

适合快速测试，不需要PostgreSQL。

### 1. 安装依赖

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 配置使用 SQLite

编辑 `.env` 文件：
```bash
# 使用 SQLite
DATABASE_URL=sqlite+aiosqlite:///./xcodereviewer_dev.db

# 使用内存 Redis（或安装本地Redis）
REDIS_URL=redis://localhost:6379/0

# 禁用 Celery（同步执行任务）
CELERY_TASK_ALWAYS_EAGER=true

# 使用本地存储
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./storage

# 使用 Mock LLM（不需要真实API key）
LLM_MODE=mock
```

### 3. 启动 Redis（可选）

```bash
# macOS (使用 Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# 或使用 Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. 初始化并启动

```bash
# 初始化数据库
alembic upgrade head

# 启动服务
uvicorn app.main:app --reload --port 8000
```

---

## 🧪 运行测试

### 运行所有测试

```bash
cd backend

# 使用 Docker
docker-compose -f docker-compose.dev.yml exec backend pytest

# 本地环境
pytest

# 带覆盖率报告
pytest --cov=. --cov-report=html
```

### 运行特定测试

```bash
# 测试 API 端点
pytest tests/test_api_endpoints.py -v

# 测试 LLM 服务
pytest tests/test_llm_service.py -v

# 测试 E2E 工作流
pytest tests/test_e2e_workflows.py -v
```

---

## 🔧 常见问题

### 1. 端口被占用

如果端口 8000, 5432, 6379 等被占用：

```bash
# 修改 docker-compose.dev.yml 中的端口映射
# 例如：将 8000:8000 改为 8001:8000

# 或者停止占用端口的服务
lsof -ti:8000 | xargs kill -9  # macOS/Linux
```

### 2. Docker 容器启动失败

```bash
# 查看详细日志
docker-compose -f docker-compose.dev.yml logs backend

# 重新构建镜像
docker-compose -f docker-compose.dev.yml build --no-cache

# 清理并重启
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### 3. 数据库连接错误

```bash
# 检查 PostgreSQL 是否运行
docker-compose -f docker-compose.dev.yml ps postgres

# 测试数据库连接
docker-compose -f docker-compose.dev.yml exec postgres \
  psql -U postgres -d xcodereviewer_dev -c "SELECT 1;"

# 重置数据库
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d postgres
sleep 10
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

### 4. Redis 连接错误

```bash
# 检查 Redis 是否运行
docker-compose -f docker-compose.dev.yml ps redis

# 测试 Redis 连接
docker-compose -f docker-compose.dev.yml exec redis redis-cli ping

# 或本地测试
redis-cli ping
```

### 5. 导入错误 (ModuleNotFoundError)

```bash
# 确保在正确的目录
cd backend

# 设置 PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# 或在 .env 中添加
echo "PYTHONPATH=." >> .env
```

---

## 📝 开发工作流

### 1. 创建新功能

```bash
# 创建新分支
git checkout -b feature/your-feature-name

# 编写代码
# ...

# 运行测试
pytest

# 代码格式化
ruff format .

# 代码检查
ruff check .

# 类型检查
mypy .
```

### 2. 数据库迁移

```bash
# 创建新迁移
alembic revision --autogenerate -m "Add new table"

# 查看迁移
alembic history

# 应用迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 3. 添加新的 API 端点

```python
# 1. 在 models/ 中创建数据模型
# 2. 在 schemas/ 中创建 Pydantic 模式
# 3. 在 api/v1/ 中创建路由
# 4. 在 tests/ 中添加测试
```

### 4. 调试

```python
# 在代码中添加断点
import pdb; pdb.set_trace()

# 或使用 VS Code 调试器
# 创建 .vscode/launch.json
```

---

## 🎯 下一步

1. **阅读文档**:
   - [开发者指南](docs/DEVELOPER_GUIDE.md)
   - [API 文档](docs/API_DOCUMENTATION.md)
   - [架构文档](Architecture.md)

2. **探索 API**:
   - 访问 http://localhost:8000/docs
   - 尝试不同的端点
   - 查看请求/响应示例

3. **运行示例**:
   - 创建项目
   - 运行代码扫描
   - 生成报告

4. **贡献代码**:
   - 查看 [贡献指南](docs/DEVELOPER_GUIDE.md#contributing)
   - 提交 Pull Request

---

## 📞 获取帮助

- **文档**: [backend/docs/](docs/)
- **问题**: 创建 GitHub Issue
- **讨论**: GitHub Discussions
- **邮件**: dev@your-domain.com

---

## 🎉 快速验证

运行这个脚本验证所有服务是否正常：

```bash
#!/bin/bash
# test_services.sh

echo "Testing Backend API..."
curl -f http://localhost:8000/health || echo "❌ Backend API failed"

echo "Testing Swagger UI..."
curl -f http://localhost:8000/docs || echo "❌ Swagger UI failed"

echo "Testing Flower..."
curl -f http://localhost:5555 || echo "❌ Flower failed"

echo "Testing MinIO..."
curl -f http://localhost:9001 || echo "❌ MinIO failed"

echo "Testing Prometheus..."
curl -f http://localhost:9090 || echo "❌ Prometheus failed"

echo "Testing Grafana..."
curl -f http://localhost:3001 || echo "❌ Grafana failed"

echo "✅ All services are running!"
```

保存为 `test_services.sh`，然后运行：
```bash
chmod +x test_services.sh
./test_services.sh
```

---

**祝你开发愉快！** 🚀
