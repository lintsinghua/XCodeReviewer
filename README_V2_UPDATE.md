# XCodeReviewer 2.0 - README 更新指南

## 🎉 2.0 版本重大更新

XCodeReviewer 2.0 采用全新的前后端分离架构，提供企业级代码审计解决方案：

### 🏗️ 全新架构

```
┌─────────────────────────────────────────────────────────────┐
│                     XCodeReviewer 2.0                        │
├─────────────────────────────────────────────────────────────┤
│  前端 (React + TypeScript + Vite)                            │
│  • 现代化 UI 界面                                              │
│  • 实时任务进度展示                                            │
│  • LLM Provider 管理                                          │
├─────────────────────────────────────────────────────────────┤
│  后端 API (FastAPI + Python 3.11)                            │
│  • RESTful API 设计                                           │
│  • JWT 身份认证                                               │
│  • 异步任务处理                                               │
│  • LLM Provider CRUD                                          │
├─────────────────────────────────────────────────────────────┤
│  任务队列 (Celery + Redis)                                   │
│  • 异步代码扫描                                               │
│  • 分布式任务调度                                             │
│  • 实时进度更新                                               │
├─────────────────────────────────────────────────────────────┤
│  数据层 (PostgreSQL + Redis)                                 │
│  • PostgreSQL: 主数据库                                       │
│  • Redis: 缓存 + 消息队列                                     │
│  • MinIO: 对象存储 (可选)                                     │
└─────────────────────────────────────────────────────────────┘
```

### ⭐ 核心特性

- **🎯 企业级架构**: 前后端分离，支持水平扩展
- **📦 开箱即用**: Docker Compose 一键部署所有服务
- **🔐 安全加固**: API Key 加密存储，JWT 认证
- **⚡ 异步处理**: Celery 任务队列，支持大规模项目扫描
- **🎨 LLM 灵活配置**: 
  - 支持 11+ 主流 LLM 平台（Gemini、OpenAI、Claude、Qwen、DeepSeek、Zhipu、Moonshot、Baidu、MiniMax、Doubao、Ollama、**AWS Bedrock**）
  - 可视化 LLM Provider 管理（CRUD）
  - API Key 加密存储和管理
  - 任务级 LLM 选择
- **📊 实时监控**: WebSocket 实时任务进度，系统健康检查

---

## 🚀 快速开始

### 方式一：Docker Compose 部署（推荐）⭐

**适用场景**: 生产环境、测试环境、快速体验

#### 1. 克隆项目

```bash
git clone https://github.com/lintsinghua/XCodeReviewer.git
cd XCodeReviewer/backend
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置必要参数
vi .env
```

**最小化配置（开始体验）**:
```env
# 数据库（使用默认配置即可）
DATABASE_URL=postgresql+asyncpg://xcodereviewer:xcodereviewer@postgres:5432/xcodereviewer

# Redis（使用默认配置即可）
REDIS_URL=redis://redis:6379/0

# JWT Secret（请修改为随机字符串）
SECRET_KEY=your-super-secret-key-change-in-production

# 默认 LLM 配置（选择一个）
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

#### 3. 启动所有服务

```bash
# 启动所有服务（PostgreSQL + Redis + MinIO + Backend + Frontend + Celery）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 4. 访问应用

```bash
# 前端应用
http://localhost:5173

# 后端 API 文档
http://localhost:8000/docs

# MinIO 控制台（可选）
http://localhost:9001
```

#### 5. 创建管理员账户

```bash
# 进入后端容器
docker-compose exec backend bash

# 创建管理员
python scripts/create_admin.py

# 输入用户名、邮箱、密码
```

#### 服务说明

| 服务 | 端口 | 说明 |
|-----|------|------|
| **frontend** | 5173 | React 前端应用 |
| **backend** | 8000 | FastAPI 后端服务 |
| **postgres** | 5432 | PostgreSQL 数据库 |
| **redis** | 6379 | Redis 缓存/消息队列 |
| **celery** | - | Celery 任务队列 worker |
| **minio** | 9000/9001 | MinIO 对象存储（可选） |

---

### 方式二：本地开发部署

**适用场景**: 开发调试、功能定制

#### 环境要求

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 14+**
- **Redis 6+**
- **pnpm 8+** (推荐) 或 npm/yarn

#### 1. 启动基础服务

使用 Docker 启动数据库和 Redis：

```bash
cd backend
docker-compose -f docker-compose.dev.yml up -d postgres redis minio
```

#### 2. 后端设置

```bash
cd backend

# 创建 Python 虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，配置数据库和 LLM

# 初始化数据库
python scripts/init_db.py
python scripts/init_llm_providers.py
python scripts/create_admin.py

# 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 另开终端，启动 Celery worker
celery -A tasks.celery_app worker --loglevel=info --concurrency=4
```

#### 3. 前端设置

```bash
cd ..  # 回到项目根目录

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，配置后端 API 地址

# 启动开发服务器
pnpm dev
```

#### 4. 访问应用

```bash
# 前端应用
http://localhost:5173

# 后端 API 文档
http://localhost:8000/docs
```

---

## 🛠️ 技术栈

### 前端

| 分类 | 技术 | 版本 | 说明 |
|-----|------|------|------|
| **框架** | React | 18.x | 声明式 UI 框架 |
| | TypeScript | 5.7 | 类型安全 |
| | Vite | 5.1 | 现代化构建工具 |
| **UI** | Tailwind CSS | 3.x | 原子化 CSS |
| | Radix UI | - | 无障碍组件库 |
| | Lucide React | - | 图标库 |
| **可视化** | Recharts | - | 图表库 |
| **状态管理** | React Hooks | - | 轻量级状态管理 |
| **路由** | React Router | 6.x | 单页应用路由 |
| **通知** | Sonner | - | Toast 通知 |

### 后端

| 分类 | 技术 | 版本 | 说明 |
|-----|------|------|------|
| **框架** | FastAPI | 0.115.x | 高性能异步 API 框架 |
| | Python | 3.11+ | 编程语言 |
| | Pydantic | 2.x | 数据验证 |
| **数据库** | PostgreSQL | 14+ | 主数据库 |
| | SQLAlchemy | 2.x | ORM 框架 |
| | Alembic | 1.x | 数据库迁移 |
| **缓存/队列** | Redis | 6+ | 缓存 + 消息队列 |
| | Celery | 5.x | 分布式任务队列 |
| **存储** | MinIO | - | 对象存储（可选） |
| **认证** | JWT | - | JSON Web Token |
| | PassLib | - | 密码哈希 |
| **加密** | Cryptography | 41.x | API Key 加密 |
| **HTTP** | httpx | 0.25.x | 异步 HTTP 客户端 |
| **LLM** | 多平台 SDK | - | 11+ LLM 平台集成 |
| **监控** | Prometheus | - | 指标收集 |
| | Grafana | - | 可视化监控 |

### LLM 平台支持

| 平台类型 | 平台名称 | 特点 | 状态 |
|---------|---------|------|------|
| **国际平台** | Google Gemini | 免费配额充足 | ✅ |
| | OpenAI GPT | 性能最佳 | ✅ |
| | Anthropic Claude | 代码理解强 | ✅ |
| | **AWS Bedrock** | 企业级服务 | ✅ NEW |
| | DeepSeek | 性价比高 | ✅ |
| **国内平台** | 阿里通义千问 | 国内访问快 | ✅ |
| | 智谱 AI (GLM) | 中文支持好 | ✅ |
| | 月之暗面 Kimi | 长文本处理 | ✅ |
| | 百度文心一言 | 企业级服务 | ✅ |
| | MiniMax | 多模态能力 | ✅ |
| | 字节豆包 | 高性价比 | ✅ |
| **本地部署** | Ollama | 完全本地化 | ✅ |

---

## ✨ 核心功能

### 1. 🎯 LLM Provider 管理

**2.0 新增功能**: 可视化管理 LLM 提供商

- **CRUD 操作**: 创建、查看、编辑、删除 LLM Provider
- **API Key 管理**: 
  - AES-256 加密存储
  - 可视化配置界面
  - 支持预览（前几位+后几位）
  - 优先级：数据库 > 环境变量
- **任务级选择**: 每个审计任务可选择特定的 LLM Provider
- **即时分析**: 即时分析支持选择不同的 LLM
- **内置 Provider**: 系统预置 11+ 主流平台配置

**使用方式**:
1. 访问 `/admin` → LLM 提供商
2. 点击"配置 API Key"按钮
3. 输入 API Key 并保存
4. 创建任务时选择对应的 Provider

### 2. 🚀 异步任务处理

- **Celery 任务队列**: 支持大规模项目扫描
- **实时进度更新**: WebSocket 推送任务进度
- **分布式部署**: 支持多 Worker 水平扩展
- **任务重试**: 自动重试失败的任务
- **任务优先级**: 支持设置任务优先级

### 3. 🔐 安全加固

- **JWT 认证**: 基于 Token 的身份认证
- **API Key 加密**: 使用 AES-256 加密存储
- **密码哈希**: 使用 bcrypt 加密用户密码
- **CORS 配置**: 跨域请求安全控制
- **SQL 注入防护**: 使用 ORM 防止 SQL 注入

### 4. 📊 实时监控

- **系统指标**: CPU、内存、磁盘使用率
- **API 性能**: 请求响应时间、错误率
- **任务统计**: 任务成功/失败率、平均时长
- **数据库监控**: 连接池、慢查询
- **Prometheus + Grafana**: 完整的监控解决方案

### 5. 📁 项目管理

- **GitHub/GitLab 集成**: 一键导入代码仓库
- **多语言支持**: 10+ 编程语言
- **分支审计**: 支持指定分支扫描
- **排除模式**: 灵活配置文件过滤规则
- **项目统计**: 代码量、问题数、质量评分

### 6. ⚡ 即时分析

- **代码片段分析**: 快速分析代码片段
- **多语言支持**: 10+ 语言即时分析
- **LLM 选择**: 可选择不同的 LLM Provider
- **详细建议**: What-Why-How 三段式解释
- **修复示例**: 提供可直接使用的代码示例

### 7. 🧠 智能审计

- **AI 深度理解**: 超越传统静态分析
- **五大维度检测**:
  - 🐛 潜在 Bug
  - 🔒 安全漏洞
  - ⚡ 性能瓶颈
  - 🎨 代码风格
  - 🔧 可维护性
- **精准定位**: 文件、行号、列号
- **修复建议**: 具体可执行的代码示例

### 8. 📈 审计报告

- **JSON 导出**: 结构化数据，便于集成
- **PDF 导出**: 专业报告，便于分享
- **多维度统计**: 按严重程度、类别分类
- **趋势分析**: 代码质量变化趋势
- **自定义报告**: 支持报告模板定制

---

## ⚙️ 环境变量配置

### 必需配置

```env
# ==================== 数据库配置 ====================
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/xcodereviewer
REDIS_URL=redis://localhost:6379/0

# ==================== 安全配置 ====================
SECRET_KEY=your-super-secret-key-change-in-production
ENCRYPTION_KEY=your-encryption-key-for-api-keys  # 可选，用于 API Key 加密

# ==================== LLM 配置 ====================
# 选择默认的 LLM Provider
LLM_PROVIDER=gemini

# 至少配置一个 LLM 平台的 API Key
GEMINI_API_KEY=your_gemini_api_key
# 或
OPENAI_API_KEY=your_openai_api_key
# 或
CLAUDE_API_KEY=your_claude_api_key
```

### LLM 平台配置

```env
# Google Gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash  # 可选

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini  # 可选
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，支持中转站

# Anthropic Claude
CLAUDE_API_KEY=your_key
CLAUDE_MODEL=claude-3-5-sonnet-20241022  # 可选

# AWS Bedrock (NEW)
BEDROCK_API_KEY=your_key
BEDROCK_REGION=us-east-1  # 可选

# 阿里通义千问
QWEN_API_KEY=your_key
QWEN_MODEL=qwen-turbo  # 可选

# DeepSeek
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-chat  # 可选

# 智谱 AI
ZHIPU_API_KEY=your_key
ZHIPU_MODEL=glm-4-flash  # 可选

# 月之暗面 Kimi
MOONSHOT_API_KEY=your_key
MOONSHOT_MODEL=moonshot-v1-8k  # 可选

# 百度文心一言
BAIDU_API_KEY=api_key:secret_key  # 注意格式
BAIDU_MODEL=ERNIE-3.5-8K  # 可选

# MiniMax
MINIMAX_API_KEY=your_key
MINIMAX_MODEL=abab6.5-chat  # 可选

# 字节豆包
DOUBAO_API_KEY=your_key
DOUBAO_MODEL=doubao-pro-32k  # 可选

# Ollama (本地部署)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3  # 可选
```

### 可选配置

```env
# ==================== 应用配置 ====================
DEBUG=false
APP_NAME=XCodeReviewer
APP_VERSION=2.0.0
PORT=8000

# ==================== Celery 配置 ====================
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# ==================== MinIO 配置 (可选) ====================
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=xcodereviewer

# ==================== GitHub/GitLab ====================
GITHUB_TOKEN=your_github_token
GITLAB_TOKEN=your_gitlab_token

# ==================== 输出配置 ====================
OUTPUT_LANGUAGE=zh-CN  # zh-CN 或 en-US
```

---

## 📖 使用指南

### 首次使用

1. **创建管理员账户**
   ```bash
   docker-compose exec backend python scripts/create_admin.py
   ```

2. **登录系统**
   - 访问 http://localhost:5173
   - 使用管理员账户登录

3. **配置 LLM Provider**
   - 进入 `/admin` → LLM 提供商
   - 选择要使用的 Provider
   - 点击"配置 API Key"
   - 输入 API Key 并保存

4. **创建项目**
   - 进入"项目管理"
   - 点击"新建项目"
   - 输入 GitHub/GitLab 仓库 URL
   - 配置扫描参数

5. **创建审计任务**
   - 在项目详情页点击"新建任务"
   - 选择 LLM Provider（可选）
   - 配置扫描分支和排除模式
   - 启动审计

6. **查看结果**
   - 实时查看任务进度
   - 查看发现的问题
   - 导出审计报告

### 即时分析

1. 访问 `/instant-analysis`
2. 选择编程语言
3. 粘贴代码或上传文件
4. 选择 LLM Provider（可选）
5. 点击"开始分析"
6. 查看分析结果和修复建议

### API 文档

访问 http://localhost:8000/docs 查看完整的 API 文档（Swagger UI）

---

## 🔄 升级指南

### 从 1.x 升级到 2.0

**⚠️ 重要提示**: 2.0 版本采用全新架构，不兼容 1.x 版本的数据。

1. **导出 1.x 数据**（如需保留）
   - 在 1.x 版本的管理页面导出数据为 JSON

2. **部署 2.0 版本**
   ```bash
   git pull origin main
   cd backend
   docker-compose up -d
   ```

3. **初始化数据库**
   ```bash
   docker-compose exec backend python scripts/init_db.py
   docker-compose exec backend python scripts/init_llm_providers.py
   docker-compose exec backend python scripts/create_admin.py
   ```

4. **迁移数据**（可选）
   - 使用数据迁移脚本（开发中）
   - 或手动重新创建项目和任务

---

## 🐛 故障排查

### 1. 后端无法连接数据库

```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 查看 PostgreSQL 日志
docker-compose logs postgres

# 检查数据库连接配置
docker-compose exec backend env | grep DATABASE_URL
```

### 2. Celery Worker 未启动

```bash
# 检查 Celery 状态
docker-compose ps celery

# 查看 Celery 日志
docker-compose logs celery

# 检查 Redis 连接
docker-compose exec backend python -c "import redis; r = redis.from_url('redis://redis:6379/1'); print(r.ping())"
```

### 3. LLM API 调用失败

```bash
# 检查 API Key 配置
docker-compose exec backend python -c "from app.config import settings; print(settings.GEMINI_API_KEY)"

# 测试 API 连接
curl http://localhost:8000/api/v1/llm-providers
```

### 4. 前端无法访问后端

```bash
# 检查后端是否运行
curl http://localhost:8000/api/v1/health

# 检查 CORS 配置
docker-compose exec backend env | grep CORS_ORIGINS
```

### 5. 查看详细日志

```bash
# 所有服务日志
docker-compose logs -f

# 特定服务日志
docker-compose logs -f backend
docker-compose logs -f celery
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## 📞 获取帮助

- **文档**: [backend/docs/](backend/docs/)
- **Issues**: https://github.com/lintsinghua/XCodeReviewer/issues
- **讨论**: https://github.com/lintsinghua/XCodeReviewer/discussions
- **邮箱**: lintsinghua@qq.com

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

**⭐ 如果这个项目对您有帮助，请给我们一个 Star！您的支持是我们不断前进的动力！**

