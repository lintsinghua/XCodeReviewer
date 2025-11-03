# XCodeReviewer 架构迁移完整方案

> **版本**: v2.0  
> **创建日期**: 2025-10-31  
> **适用范围**: XCodeReviewer 前后端分离架构迁移  
> **预留扩展**: Multi-Agent 服务 + 本地数据库服务

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [架构设计](#2-架构设计)
3. [后端技术栈](#3-后端技术栈)
4. [详细实施方案](#4-详细实施方案)
5. [Multi-Agent 服务设计](#5-multi-agent-服务设计)
6. [本地数据库服务设计](#6-本地数据库服务设计)
7. [部署方案](#7-部署方案)
8. [迁移路线图](#8-迁移路线图)
9. [风险管理](#9-风险管理)
10. [附录](#10-附录)

---

## 1. 执行摘要

### 1.1 项目背景

XCodeReviewer 是一个基于 LLM 的智能代码审计平台，当前采用纯前端架构（React + TypeScript）。随着业务发展，面临以下挑战：

- **安全风险**: API Key 暴露在前端，存在泄露和滥用风险
- **性能瓶颈**: 大型仓库扫描在浏览器端执行，性能受限
- **成本失控**: 无法统一管理 LLM 调用，成本难以控制
- **功能受限**: 浏览器环境限制了复杂功能的实现

### 1.2 迁移目标

1. **安全性提升**: API Key 和敏感数据迁移到后端
2. **性能优化**: 利用服务器资源处理计算密集型任务
3. **成本控制**: 统一管理 LLM 调用，实现缓存和限流
4. **功能扩展**: 支持 Multi-Agent 协作和本地数据库
5. **可扩展性**: 支持更多用户和更大规模的代码库

### 1.3 核心价值

- ✅ **安全**: API Key 不再暴露，数据传输加密
- ✅ **高效**: 缓存机制减少 80% 重复调用
- ✅ **稳定**: 任务不受浏览器限制，支持断点续传
- ✅ **智能**: Multi-Agent 协作提供更深入的分析
- ✅ **灵活**: 支持云端和本地部署两种模式

---


## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          用户层 (User Layer)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Web Browser │  │ Desktop App  │  │  Mobile App  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                      前端层 (Frontend Layer)                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  React 18 + TypeScript + Vite                               │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │ 项目管理 │  │ 即时分析 │  │ 审计任务 │  │ 报告导出 │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │  IndexedDB (本地缓存) + WebSocket (实时通信)         │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTPS/WSS
┌────────────────────────────▼─────────────────────────────────────────┐
│                    API 网关层 (API Gateway)                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Nginx / Traefik                                            │    │
│  │  - 负载均衡  - SSL 终止  - 限流  - 认证  - 日志            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                      应用层 (Application Layer)                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  FastAPI (Python 3.11+)                                     │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │  RESTful API + WebSocket + GraphQL (可选)            │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │    │
│  │  │ 认证授权 │  │ 项目管理 │  │ 任务调度 │  │ 报告生成 │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                      服务层 (Service Layer)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  LLM 服务    │  │  扫描服务    │  │  分析服务    │              │
│  │  - 11+ 适配器│  │  - GitHub    │  │  - 代码质量  │              │
│  │  - 缓存管理  │  │  - GitLab    │  │  - 安全检测  │              │
│  │  - 负载均衡  │  │  - ZIP 处理  │  │  - 性能分析  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │Multi-Agent   │  │  缓存服务    │  │  监控服务    │              │
│  │  - 协调器    │  │  - Redis     │  │  - 日志      │              │
│  │  - 专家Agent │  │  - 结果缓存  │  │  - 指标      │              │
│  │  - 对话管理  │  │  - 会话存储  │  │  - 告警      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                      任务层 (Task Layer)                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Celery + Redis (任务队列)                                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │ 扫描任务 │  │ 分析任务 │  │ 报告任务 │  │ 定时任务 │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                      数据层 (Data Layer)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ PostgreSQL   │  │  Redis       │  │  MinIO/S3    │              │
│  │ - 主数据库   │  │  - 缓存      │  │  - 文件存储  │              │
│  │ - 读写分离   │  │  - 会话      │  │  - 报告存储  │              │
│  │ - 备份恢复   │  │  - 队列      │  │  - 日志归档  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ SQLite       │  │  Vector DB   │                                 │
│  │ - 本地模式   │  │  - 代码向量  │                                 │
│  │ - 离线使用   │  │  - 相似检索  │                                 │
│  └──────────────┘  └──────────────┘                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心设计原则

#### 2.2.1 微服务架构
- **服务拆分**: 按业务领域拆分为独立服务
- **松耦合**: 服务间通过 API 通信，降低依赖
- **独立部署**: 每个服务可独立升级和扩展

#### 2.2.2 异步优先
- **任务队列**: 长时间任务异步执行
- **事件驱动**: 使用消息队列解耦服务
- **实时通信**: WebSocket 推送任务进度

#### 2.2.3 缓存策略
- **多级缓存**: 浏览器 → Redis → 数据库
- **智能失效**: 基于内容哈希的缓存键
- **预热机制**: 常用数据提前加载

#### 2.2.4 安全设计
- **零信任**: 所有请求都需要认证
- **最小权限**: 基于角色的访问控制
- **数据加密**: 传输和存储都加密

---


## 3. 后端技术栈

### 3.1 核心框架选型

| 类别 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| **Web 框架** | FastAPI | 0.104+ | 高性能、异步、自动文档、类型安全 |
| **编程语言** | Python | 3.11+ | 生态丰富、AI 库支持好、开发效率高 |
| **ORM** | SQLAlchemy | 2.0+ | 成熟稳定、支持异步、类型提示 |
| **数据库迁移** | Alembic | 1.12+ | 与 SQLAlchemy 集成好 |
| **任务队列** | Celery | 5.3+ | 成熟稳定、功能强大 |
| **消息代理** | Redis | 7.2+ | 高性能、支持多种数据结构 |
| **数据库** | PostgreSQL | 15+ | 功能强大、支持 JSON、全文搜索 |
| **本地数据库** | SQLite | 3.40+ | 轻量级、零配置、适合本地模式 |
| **向量数据库** | Qdrant | 1.7+ | 高性能、支持过滤、易于部署 |
| **对象存储** | MinIO | RELEASE.2024+ | S3 兼容、可自托管 |
| **缓存** | Redis | 7.2+ | 高性能、丰富的数据类型 |
| **日志** | Loguru | 0.7+ | 简单易用、功能强大 |
| **监控** | Prometheus | 2.48+ | 行业标准、生态丰富 |
| **错误追踪** | Sentry | 1.38+ | 功能强大、易于集成 |
| **API 文档** | Swagger/ReDoc | - | FastAPI 自带 |
| **测试框架** | Pytest | 7.4+ | 功能强大、插件丰富 |
| **代码质量** | Ruff | 0.1+ | 极快的 Linter 和 Formatter |
| **类型检查** | Mypy | 1.7+ | 静态类型检查 |
| **容器化** | Docker | 24+ | 标准化部署 |
| **编排** | Docker Compose | 2.23+ | 本地开发和小规模部署 |
| **生产编排** | Kubernetes | 1.28+ | 大规模生产部署（可选） |

### 3.2 Python 依赖清单

```python
# requirements.txt

# Web 框架
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0

# 数据库
sqlalchemy==2.0.23
alembic==1.12.1
asyncpg==0.29.0          # PostgreSQL 异步驱动
aiosqlite==0.19.0        # SQLite 异步驱动
psycopg2-binary==2.9.9   # PostgreSQL 同步驱动（Celery 用）

# 任务队列
celery==5.3.4
redis==5.0.1
flower==2.0.1            # Celery 监控

# 缓存
redis[hiredis]==5.0.1
aiocache==0.12.2

# LLM 客户端
openai==1.3.7
anthropic==0.7.7
google-generativeai==0.3.1
httpx==0.25.2            # 通用 HTTP 客户端

# 向量数据库
qdrant-client==1.7.0

# 对象存储
minio==7.2.0

# 认证授权
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6

# 工具库
python-dotenv==1.0.0
loguru==0.7.2
tenacity==8.2.3          # 重试机制
pydantic-settings==2.1.0
python-slugify==8.0.1

# 监控和追踪
prometheus-client==0.19.0
sentry-sdk[fastapi]==1.38.0

# 测试
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.25.2            # 测试客户端
faker==20.1.0

# 代码质量
ruff==0.1.7
mypy==1.7.1
black==23.12.0

# 文档生成
mkdocs==1.5.3
mkdocs-material==9.5.2

# 其他
python-dateutil==2.8.2
pytz==2023.3
```

### 3.3 开发工具配置

#### 3.3.1 Ruff 配置 (pyproject.toml)
```toml
[tool.ruff]
line-length = 100
target-version = "py311"
select = ["E", "F", "I", "N", "W", "UP", "B", "C4", "SIM"]
ignore = ["E501"]

[tool.ruff.per-file-ignores]
"__init__.py" = ["F401"]
"tests/*" = ["S101"]

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
```

---


## 4. 详细实施方案

### 4.1 项目结构设计

```
xcodereviewer-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                      # FastAPI 应用入口
│   ├── config.py                    # 配置管理
│   ├── dependencies.py              # 依赖注入
│   └── middleware.py                # 中间件
│
├── api/
│   ├── __init__.py
│   ├── deps.py                      # API 依赖
│   └── v1/
│       ├── __init__.py
│       ├── router.py                # 路由聚合
│       ├── auth.py                  # 认证相关
│       ├── projects.py              # 项目管理
│       ├── tasks.py                 # 任务管理
│       ├── issues.py                # 问题管理
│       ├── llm.py                   # LLM 服务
│       ├── reports.py               # 报告生成
│       ├── agents.py                # Multi-Agent 服务
│       ├── statistics.py            # 统计分析
│       └── websocket.py             # WebSocket 端点
│
├── services/
│   ├── __init__.py
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── base_adapter.py         # 基础适配器
│   │   ├── factory.py              # LLM 工厂
│   │   ├── cache.py                # 结果缓存
│   │   ├── rate_limiter.py         # 限流器
│   │   └── adapters/
│   │       ├── __init__.py
│   │       ├── gemini.py
│   │       ├── openai.py
│   │       ├── claude.py
│   │       ├── qwen.py
│   │       ├── deepseek.py
│   │       ├── zhipu.py
│   │       ├── moonshot.py
│   │       ├── baidu.py
│   │       ├── minimax.py
│   │       ├── doubao.py
│   │       └── ollama.py
│   │
│   ├── repository/
│   │   ├── __init__.py
│   │   ├── scanner.py              # 仓库扫描器
│   │   ├── github_client.py        # GitHub 客户端
│   │   ├── gitlab_client.py        # GitLab 客户端
│   │   ├── file_filter.py          # 文件过滤
│   │   └── zip_handler.py          # ZIP 处理
│   │
│   ├── analysis/
│   │   ├── __init__.py
│   │   ├── code_analyzer.py        # 代码分析器
│   │   ├── quality_scorer.py       # 质量评分
│   │   └── issue_detector.py       # 问题检测
│   │
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── coordinator.py          # Agent 协调器
│   │   ├── base_agent.py           # 基础 Agent
│   │   ├── conversation.py         # 对话管理
│   │   └── agents/
│   │       ├── __init__.py
│   │       ├── security_agent.py   # 安全专家
│   │       ├── performance_agent.py # 性能专家
│   │       ├── architecture_agent.py # 架构专家
│   │       └── code_quality_agent.py # 代码质量专家
│   │
│   ├── report/
│   │   ├── __init__.py
│   │   ├── generator.py            # 报告生成器
│   │   ├── templates/              # 报告模板
│   │   └── exporters/
│   │       ├── json_exporter.py
│   │       ├── pdf_exporter.py
│   │       └── markdown_exporter.py
│   │
│   ├── cache/
│   │   ├── __init__.py
│   │   ├── redis_cache.py          # Redis 缓存
│   │   ├── cache_key.py            # 缓存键生成
│   │   └── ttl_manager.py          # TTL 管理
│   │
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── minio_client.py         # MinIO 客户端
│   │   └── local_storage.py        # 本地存储
│   │
│   └── monitoring/
│       ├── __init__.py
│       ├── logger.py               # 日志服务
│       ├── metrics.py              # 指标收集
│       └── alerting.py             # 告警服务
│
├── models/
│   ├── __init__.py
│   ├── base.py                     # 基础模型
│   ├── user.py                     # 用户模型
│   ├── project.py                  # 项目模型
│   ├── task.py                     # 任务模型
│   ├── issue.py                    # 问题模型
│   ├── analysis.py                 # 分析结果模型
│   └── agent_session.py            # Agent 会话模型
│
├── schemas/
│   ├── __init__.py
│   ├── user.py                     # 用户 Schema
│   ├── project.py                  # 项目 Schema
│   ├── task.py                     # 任务 Schema
│   ├── issue.py                    # 问题 Schema
│   ├── llm.py                      # LLM Schema
│   ├── agent.py                    # Agent Schema
│   └── common.py                   # 通用 Schema
│
├── db/
│   ├── __init__.py
│   ├── session.py                  # 数据库会话
│   ├── base.py                     # 基础配置
│   ├── init_db.py                  # 数据库初始化
│   └── migrations/                 # Alembic 迁移
│       ├── env.py
│       ├── script.py.mako
│       └── versions/
│
├── tasks/
│   ├── __init__.py
│   ├── celery_app.py               # Celery 配置
│   ├── scan_tasks.py               # 扫描任务
│   ├── analysis_tasks.py           # 分析任务
│   ├── report_tasks.py             # 报告任务
│   └── agent_tasks.py              # Agent 任务
│
├── core/
│   ├── __init__.py
│   ├── security.py                 # 安全工具
│   ├── exceptions.py               # 自定义异常
│   └── utils.py                    # 工具函数
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # Pytest 配置
│   ├── test_api/
│   ├── test_services/
│   ├── test_tasks/
│   └── test_models/
│
├── scripts/
│   ├── init_db.py                  # 初始化数据库
│   ├── seed_data.py                # 种子数据
│   └── migrate.py                  # 迁移脚本
│
├── docs/
│   ├── index.md
│   ├── api.md
│   └── deployment.md
│
├── .env.example                    # 环境变量示例
├── .gitignore
├── alembic.ini                     # Alembic 配置
├── docker-compose.yml              # Docker Compose
├── Dockerfile                      # Docker 镜像
├── pyproject.toml                  # 项目配置
├── pytest.ini                      # Pytest 配置
├── README.md
└── requirements.txt                # Python 依赖
```

### 4.2 核心模块实现

#### 4.2.1 FastAPI 应用入口 (app/main.py)

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from app.config import settings
from app.middleware import RequestLoggingMiddleware, RateLimitMiddleware
from api.v1.router import api_router
from core.exceptions import AppException
from services.monitoring.logger import logger
from services.monitoring.metrics import metrics
from db.session import engine
from db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("Starting XCodeReviewer Backend...")
    
    # 初始化数据库
    await init_db()
    
    # 初始化指标收集
    metrics.init()
    
    logger.info("Application started successfully")
    
    yield
    
    # 关闭时执行
    logger.info("Shutting down XCodeReviewer Backend...")
    await engine.dispose()
    logger.info("Application shutdown complete")


# 创建 FastAPI 应用
app = FastAPI(
    title="XCodeReviewer API",
    description="智能代码审计平台后端服务",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip 压缩
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 自定义中间件
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

# 注册路由
app.include_router(api_router, prefix="/api/v1")


# 全局异常处理
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """处理应用自定义异常"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "timestamp": time.time(),
            }
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """处理未捕获的异常"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "服务器内部错误",
                "timestamp": time.time(),
            }
        },
    )


# 健康检查
@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": time.time(),
    }


# 就绪检查
@app.get("/ready")
async def readiness_check():
    """就绪检查端点"""
    # 检查数据库连接
    try:
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": str(e)},
        )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
    )
```

---


#### 4.2.2 配置管理 (app/config.py)

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )
    
    # 应用配置
    APP_NAME: str = "XCodeReviewer"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # CORS 配置
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # 数据库配置
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/xcodereviewer"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # SQLite 本地模式
    SQLITE_URL: str = "sqlite+aiosqlite:///./xcodereviewer.db"
    USE_LOCAL_DB: bool = False
    
    # Redis 配置
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    
    # Celery 配置
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # MinIO/S3 配置
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "xcodereviewer"
    MINIO_SECURE: bool = False
    
    # JWT 配置
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # LLM 配置
    LLM_DEFAULT_PROVIDER: str = "gemini"
    LLM_TIMEOUT: int = 150
    LLM_MAX_RETRIES: int = 3
    LLM_CACHE_TTL: int = 86400  # 24 hours
    
    # LLM API Keys (从环境变量读取)
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    CLAUDE_API_KEY: Optional[str] = None
    QWEN_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    ZHIPU_API_KEY: Optional[str] = None
    MOONSHOT_API_KEY: Optional[str] = None
    BAIDU_API_KEY: Optional[str] = None
    MINIMAX_API_KEY: Optional[str] = None
    DOUBAO_API_KEY: Optional[str] = None
    
    # GitHub/GitLab 配置
    GITHUB_TOKEN: Optional[str] = None
    GITLAB_TOKEN: Optional[str] = None
    
    # 任务配置
    MAX_ANALYZE_FILES: int = 40
    LLM_CONCURRENCY: int = 2
    LLM_GAP_MS: int = 500
    
    # 限流配置
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # 监控配置
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_PORT: int = 9090
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"
    LOG_ROTATION: str = "500 MB"
    LOG_RETENTION: str = "30 days"
    
    # Multi-Agent 配置
    AGENT_MAX_ITERATIONS: int = 10
    AGENT_TIMEOUT: int = 300
    AGENT_MEMORY_SIZE: int = 100
    
    # 向量数据库配置
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    VECTOR_DIMENSION: int = 1536  # OpenAI embedding dimension


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


settings = get_settings()
```

#### 4.2.3 数据库模型 (models/task.py)

```python
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from db.base import Base


class TaskStatus(str, enum.Enum):
    """任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(str, enum.Enum):
    """任务类型"""
    REPOSITORY = "repository"
    ZIP_UPLOAD = "zip_upload"
    INSTANT = "instant"


class AuditTask(Base):
    """审计任务模型"""
    
    __tablename__ = "audit_tasks"
    
    id = Column(String(36), primary_key=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    
    # 任务信息
    task_type = Column(Enum(TaskType), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, index=True)
    
    # 配置信息
    branch_name = Column(String(255), nullable=True)
    exclude_patterns = Column(JSON, default=list)
    scan_config = Column(JSON, default=dict)
    
    # 进度信息
    total_files = Column(Integer, default=0)
    scanned_files = Column(Integer, default=0)
    total_lines = Column(Integer, default=0)
    issues_count = Column(Integer, default=0)
    quality_score = Column(Float, default=0.0)
    
    # 时间信息
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 创建者
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # 错误信息
    error_message = Column(Text, nullable=True)
    
    # 关系
    project = relationship("Project", back_populates="tasks")
    creator = relationship("User", back_populates="created_tasks")
    issues = relationship("AuditIssue", back_populates="task", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<AuditTask(id={self.id}, status={self.status}, type={self.task_type})>"
    
    @property
    def progress_percentage(self) -> float:
        """计算进度百分比"""
        if self.total_files == 0:
            return 0.0
        return (self.scanned_files / self.total_files) * 100
    
    @property
    def duration_seconds(self) -> Optional[int]:
        """计算任务持续时间（秒）"""
        if not self.started_at:
            return None
        end_time = self.completed_at or datetime.utcnow()
        return int((end_time - self.started_at).total_seconds())
```

#### 4.2.4 API Schema (schemas/task.py)

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(str, Enum):
    """任务类型"""
    REPOSITORY = "repository"
    ZIP_UPLOAD = "zip_upload"
    INSTANT = "instant"


class TaskCreate(BaseModel):
    """创建任务请求"""
    project_id: str = Field(..., description="项目ID")
    task_type: TaskType = Field(..., description="任务类型")
    branch_name: Optional[str] = Field(None, description="分支名称")
    exclude_patterns: List[str] = Field(default_factory=list, description="排除模式")
    scan_config: Dict[str, Any] = Field(default_factory=dict, description="扫描配置")
    
    @validator("exclude_patterns")
    def validate_patterns(cls, v):
        """验证排除模式"""
        if len(v) > 100:
            raise ValueError("排除模式数量不能超过100个")
        return v


class TaskUpdate(BaseModel):
    """更新任务请求"""
    status: Optional[TaskStatus] = None
    scanned_files: Optional[int] = None
    total_lines: Optional[int] = None
    issues_count: Optional[int] = None
    quality_score: Optional[float] = None
    error_message: Optional[str] = None


class TaskProgress(BaseModel):
    """任务进度"""
    task_id: str
    status: TaskStatus
    total_files: int
    scanned_files: int
    progress_percentage: float
    current_file: Optional[str] = None
    estimated_time_remaining: Optional[int] = None


class TaskResponse(BaseModel):
    """任务响应"""
    id: str
    project_id: str
    task_type: TaskType
    status: TaskStatus
    branch_name: Optional[str]
    exclude_patterns: List[str]
    scan_config: Dict[str, Any]
    total_files: int
    scanned_files: int
    total_lines: int
    issues_count: int
    quality_score: float
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: str
    error_message: Optional[str]
    progress_percentage: float
    duration_seconds: Optional[int]
    
    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    """任务列表响应"""
    items: List[TaskResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
```

---


## 5. Multi-Agent 服务设计

### 5.1 Multi-Agent 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Agent 协作系统                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Agent 协调器 (Coordinator)                 │    │
│  │  - 任务分解  - 结果聚合  - 冲突解决  - 优先级管理      │    │
│  └───────┬──────────────────────────────────────┬─────────┘    │
│          │                                      │               │
│  ┌───────▼──────┐  ┌──────────┐  ┌──────────┐ │               │
│  │ 对话管理器   │  │ 记忆系统 │  │ 工具调用 │ │               │
│  │ - 上下文维护 │  │ - 短期   │  │ - LLM    │ │               │
│  │ - 多轮对话   │  │ - 长期   │  │ - 代码   │ │               │
│  └──────────────┘  └──────────┘  └──────────┘ │               │
│                                                 │               │
│  ┌──────────────────────────────────────────────▼──────────┐  │
│  │                   专家 Agent 池                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │
│  │  │ 安全专家 │  │ 性能专家 │  │ 架构专家 │  │ 质量专家│ │  │
│  │  │ Agent    │  │ Agent    │  │ Agent    │  │ Agent   │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │ 测试专家 │  │ 文档专家 │  │ 重构专家 │              │  │
│  │  │ Agent    │  │ Agent    │  │ Agent    │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent 基础架构

#### 5.2.1 基础 Agent 类 (services/agent/base_agent.py)

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime

from services.llm.factory import LLMFactory
from services.agent.conversation import ConversationManager


class AgentMessage(BaseModel):
    """Agent 消息"""
    role: str  # system, user, assistant, agent
    content: str
    agent_name: Optional[str] = None
    timestamp: datetime = datetime.utcnow()
    metadata: Dict[str, Any] = {}


class AgentResponse(BaseModel):
    """Agent 响应"""
    agent_name: str
    content: str
    confidence: float  # 0-1
    suggestions: List[str] = []
    metadata: Dict[str, Any] = {}
    reasoning: Optional[str] = None


class BaseAgent(ABC):
    """基础 Agent 抽象类"""
    
    def __init__(
        self,
        name: str,
        description: str,
        llm_provider: str = "gemini",
        temperature: float = 0.2,
    ):
        self.name = name
        self.description = description
        self.llm = LLMFactory.create(llm_provider)
        self.temperature = temperature
        self.conversation = ConversationManager(max_history=10)
        
    @abstractmethod
    def get_system_prompt(self) -> str:
        """获取系统提示词"""
        pass
    
    @abstractmethod
    async def analyze(self, code: str, context: Dict[str, Any]) -> AgentResponse:
        """分析代码"""
        pass
    
    async def chat(self, message: str, context: Dict[str, Any] = None) -> str:
        """对话接口"""
        # 添加用户消息到历史
        self.conversation.add_message("user", message)
        
        # 构建提示
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
            *self.conversation.get_history(),
        ]
        
        # 调用 LLM
        response = await self.llm.complete(
            messages=messages,
            temperature=self.temperature,
        )
        
        # 添加助手响应到历史
        self.conversation.add_message("assistant", response.content)
        
        return response.content
    
    def reset(self):
        """重置 Agent 状态"""
        self.conversation.clear()


class SecurityAgent(BaseAgent):
    """安全专家 Agent"""
    
    def __init__(self):
        super().__init__(
            name="SecurityExpert",
            description="专注于代码安全漏洞检测和修复建议",
            temperature=0.1,  # 安全分析需要更确定性的输出
        )
    
    def get_system_prompt(self) -> str:
        return """你是一位资深的代码安全专家，专注于识别和修复安全漏洞。

你的职责：
1. 识别常见安全漏洞（SQL注入、XSS、CSRF、敏感信息泄露等）
2. 评估漏洞的严重程度和影响范围
3. 提供具体的修复建议和最佳实践
4. 考虑安全合规性要求（OWASP Top 10、CWE等）

分析时请关注：
- 输入验证和数据清理
- 认证和授权机制
- 加密和数据保护
- 依赖库的安全性
- 配置和部署安全

输出格式：
{
  "vulnerabilities": [
    {
      "type": "SQL_INJECTION",
      "severity": "HIGH",
      "location": "line 42",
      "description": "...",
      "impact": "...",
      "fix": "...",
      "references": ["CWE-89", "OWASP A03:2021"]
    }
  ],
  "security_score": 75,
  "recommendations": [...]
}"""
    
    async def analyze(self, code: str, context: Dict[str, Any]) -> AgentResponse:
        """分析代码安全性"""
        language = context.get("language", "unknown")
        
        prompt = f"""请分析以下 {language} 代码的安全性：

```{language}
{code}
```

请识别所有潜在的安全漏洞，并提供详细的修复建议。"""
        
        response_text = await self.chat(prompt, context)
        
        # 解析响应（实际应该解析 JSON）
        return AgentResponse(
            agent_name=self.name,
            content=response_text,
            confidence=0.85,
            suggestions=[],
            metadata={"language": language},
        )


class PerformanceAgent(BaseAgent):
    """性能专家 Agent"""
    
    def __init__(self):
        super().__init__(
            name="PerformanceExpert",
            description="专注于代码性能优化和瓶颈识别",
            temperature=0.2,
        )
    
    def get_system_prompt(self) -> str:
        return """你是一位资深的性能优化专家，专注于识别和优化代码性能问题。

你的职责：
1. 识别性能瓶颈（算法复杂度、内存泄漏、I/O阻塞等）
2. 分析时间和空间复杂度
3. 提供性能优化建议
4. 推荐合适的数据结构和算法

分析时请关注：
- 算法时间复杂度（O(n), O(n²)等）
- 内存使用和泄漏
- 数据库查询优化
- 缓存策略
- 并发和异步处理
- 资源管理（连接池、文件句柄等）

输出格式：
{
  "performance_issues": [
    {
      "type": "INEFFICIENT_ALGORITHM",
      "severity": "MEDIUM",
      "location": "line 15-20",
      "current_complexity": "O(n²)",
      "optimized_complexity": "O(n log n)",
      "description": "...",
      "optimization": "..."
    }
  ],
  "performance_score": 80,
  "recommendations": [...]
}"""
    
    async def analyze(self, code: str, context: Dict[str, Any]) -> AgentResponse:
        """分析代码性能"""
        language = context.get("language", "unknown")
        
        prompt = f"""请分析以下 {language} 代码的性能：

```{language}
{code}
```

请识别所有性能瓶颈，并提供优化建议。"""
        
        response_text = await self.chat(prompt, context)
        
        return AgentResponse(
            agent_name=self.name,
            content=response_text,
            confidence=0.80,
            suggestions=[],
            metadata={"language": language},
        )


class ArchitectureAgent(BaseAgent):
    """架构专家 Agent"""
    
    def __init__(self):
        super().__init__(
            name="ArchitectureExpert",
            description="专注于代码架构设计和模式识别",
            temperature=0.3,
        )
    
    def get_system_prompt(self) -> str:
        return """你是一位资深的软件架构师，专注于代码架构设计和最佳实践。

你的职责：
1. 评估代码架构设计
2. 识别设计模式的使用和误用
3. 提供架构改进建议
4. 评估代码的可扩展性和可维护性

分析时请关注：
- SOLID 原则
- 设计模式（单例、工厂、策略等）
- 模块化和解耦
- 依赖管理
- 接口设计
- 代码组织结构

输出格式：
{
  "architecture_issues": [
    {
      "type": "TIGHT_COUPLING",
      "severity": "MEDIUM",
      "description": "...",
      "impact": "...",
      "refactoring": "..."
    }
  ],
  "architecture_score": 85,
  "patterns_used": ["Factory", "Singleton"],
  "recommendations": [...]
}"""
    
    async def analyze(self, code: str, context: Dict[str, Any]) -> AgentResponse:
        """分析代码架构"""
        language = context.get("language", "unknown")
        
        prompt = f"""请分析以下 {language} 代码的架构设计：

```{language}
{code}
```

请评估架构质量，识别设计模式，并提供改进建议。"""
        
        response_text = await self.chat(prompt, context)
        
        return AgentResponse(
            agent_name=self.name,
            content=response_text,
            confidence=0.75,
            suggestions=[],
            metadata={"language": language},
        )
```

### 5.3 Agent 协调器

#### 5.3.1 协调器实现 (services/agent/coordinator.py)

```python
from typing import List, Dict, Any, Optional
from asyncio import gather
from datetime import datetime

from services.agent.base_agent import BaseAgent, AgentResponse
from services.agent.agents.security_agent import SecurityAgent
from services.agent.agents.performance_agent import PerformanceAgent
from services.agent.agents.architecture_agent import ArchitectureAgent
from services.agent.agents.code_quality_agent import CodeQualityAgent
from services.cache.redis_cache import RedisCache


class AgentCoordinator:
    """Agent 协调器 - 管理多个 Agent 的协作"""
    
    def __init__(self):
        self.agents: Dict[str, BaseAgent] = {
            "security": SecurityAgent(),
            "performance": PerformanceAgent(),
            "architecture": ArchitectureAgent(),
            "quality": CodeQualityAgent(),
        }
        self.cache = RedisCache()
    
    async def analyze_code(
        self,
        code: str,
        language: str,
        agents: Optional[List[str]] = None,
        use_cache: bool = True,
    ) -> Dict[str, Any]:
        """
        协调多个 Agent 分析代码
        
        Args:
            code: 代码内容
            language: 编程语言
            agents: 要使用的 Agent 列表，None 表示使用所有
            use_cache: 是否使用缓存
        
        Returns:
            综合分析结果
        """
        # 生成缓存键
        cache_key = self._generate_cache_key(code, language, agents)
        
        # 尝试从缓存获取
        if use_cache:
            cached_result = await self.cache.get(cache_key)
            if cached_result:
                return cached_result
        
        # 确定要使用的 Agent
        agent_names = agents or list(self.agents.keys())
        selected_agents = [
            self.agents[name] for name in agent_names if name in self.agents
        ]
        
        # 并行执行所有 Agent 分析
        context = {"language": language, "timestamp": datetime.utcnow()}
        
        tasks = [
            agent.analyze(code, context) for agent in selected_agents
        ]
        
        responses: List[AgentResponse] = await gather(*tasks)
        
        # 聚合结果
        result = self._aggregate_responses(responses, code, language)
        
        # 缓存结果
        if use_cache:
            await self.cache.set(cache_key, result, ttl=3600)
        
        return result
    
    def _aggregate_responses(
        self,
        responses: List[AgentResponse],
        code: str,
        language: str,
    ) -> Dict[str, Any]:
        """聚合多个 Agent 的响应"""
        # 收集所有问题
        all_issues = []
        agent_scores = {}
        
        for response in responses:
            agent_scores[response.agent_name] = {
                "confidence": response.confidence,
                "suggestions_count": len(response.suggestions),
            }
            
            # 解析每个 Agent 的问题（实际应该解析 JSON）
            # 这里简化处理
            all_issues.append({
                "agent": response.agent_name,
                "content": response.content,
                "confidence": response.confidence,
            })
        
        # 计算综合评分
        overall_score = self._calculate_overall_score(responses)
        
        # 去重和优先级排序
        deduplicated_issues = self._deduplicate_issues(all_issues)
        
        return {
            "code_hash": hash(code),
            "language": language,
            "overall_score": overall_score,
            "agent_scores": agent_scores,
            "issues": deduplicated_issues,
            "agents_used": [r.agent_name for r in responses],
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "summary": self._generate_summary(responses),
        }
    
    def _calculate_overall_score(self, responses: List[AgentResponse]) -> float:
        """计算综合评分"""
        if not responses:
            return 0.0
        
        # 加权平均（可以根据 Agent 类型调整权重）
        weights = {
            "SecurityExpert": 0.3,
            "PerformanceExpert": 0.25,
            "ArchitectureExpert": 0.25,
            "QualityExpert": 0.2,
        }
        
        total_weight = 0
        weighted_sum = 0
        
        for response in responses:
            weight = weights.get(response.agent_name, 0.25)
            weighted_sum += response.confidence * weight * 100
            total_weight += weight
        
        return weighted_sum / total_weight if total_weight > 0 else 0.0
    
    def _deduplicate_issues(self, issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """去重相似的问题"""
        # 简化实现：基于内容相似度去重
        # 实际应该使用更复杂的算法（如向量相似度）
        unique_issues = []
        seen_contents = set()
        
        for issue in issues:
            content_hash = hash(issue["content"][:100])  # 使用前100字符
            if content_hash not in seen_contents:
                seen_contents.add(content_hash)
                unique_issues.append(issue)
        
        return unique_issues
    
    def _generate_summary(self, responses: List[AgentResponse]) -> str:
        """生成分析摘要"""
        agent_names = [r.agent_name for r in responses]
        return f"已完成 {len(responses)} 个专家 Agent 的分析：{', '.join(agent_names)}"
    
    def _generate_cache_key(
        self,
        code: str,
        language: str,
        agents: Optional[List[str]],
    ) -> str:
        """生成缓存键"""
        code_hash = hash(code)
        agents_str = ",".join(sorted(agents)) if agents else "all"
        return f"agent_analysis:{language}:{code_hash}:{agents_str}"
    
    async def chat(
        self,
        agent_name: str,
        message: str,
        context: Dict[str, Any] = None,
    ) -> str:
        """与特定 Agent 对话"""
        if agent_name not in self.agents:
            raise ValueError(f"Agent '{agent_name}' not found")
        
        agent = self.agents[agent_name]
        return await agent.chat(message, context or {})
    
    def reset_agent(self, agent_name: str):
        """重置特定 Agent 的状态"""
        if agent_name in self.agents:
            self.agents[agent_name].reset()
    
    def reset_all(self):
        """重置所有 Agent 的状态"""
        for agent in self.agents.values():
            agent.reset()
```

---


### 5.4 Multi-Agent API 端点 (api/v1/agents.py)

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from services.agent.coordinator import AgentCoordinator
from api.deps import get_current_user
from models.user import User


router = APIRouter(prefix="/agents", tags=["Multi-Agent"])

# 全局协调器实例
coordinator = AgentCoordinator()


class CodeAnalysisRequest(BaseModel):
    """代码分析请求"""
    code: str
    language: str
    agents: Optional[List[str]] = None
    use_cache: bool = True


class ChatRequest(BaseModel):
    """对话请求"""
    agent_name: str
    message: str
    context: Dict[str, Any] = {}


@router.post("/analyze")
async def analyze_code(
    request: CodeAnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    """
    使用 Multi-Agent 分析代码
    
    - **code**: 代码内容
    - **language**: 编程语言
    - **agents**: 要使用的 Agent 列表（可选，默认使用所有）
    - **use_cache**: 是否使用缓存
    """
    try:
        result = await coordinator.analyze_code(
            code=request.code,
            language=request.language,
            agents=request.agents,
            use_cache=request.use_cache,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat_with_agent(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """
    与特定 Agent 对话
    
    - **agent_name**: Agent 名称（security, performance, architecture, quality）
    - **message**: 用户消息
    - **context**: 上下文信息（可选）
    """
    try:
        response = await coordinator.chat(
            agent_name=request.agent_name,
            message=request.message,
            context=request.context,
        )
        return {"response": response}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_agents(current_user: User = Depends(get_current_user)):
    """获取可用的 Agent 列表"""
    return {
        "agents": [
            {
                "name": "security",
                "display_name": "安全专家",
                "description": "专注于代码安全漏洞检测和修复建议",
            },
            {
                "name": "performance",
                "display_name": "性能专家",
                "description": "专注于代码性能优化和瓶颈识别",
            },
            {
                "name": "architecture",
                "display_name": "架构专家",
                "description": "专注于代码架构设计和模式识别",
            },
            {
                "name": "quality",
                "display_name": "质量专家",
                "description": "专注于代码质量和最佳实践",
            },
        ]
    }


@router.post("/reset/{agent_name}")
async def reset_agent(
    agent_name: str,
    current_user: User = Depends(get_current_user),
):
    """重置特定 Agent 的对话历史"""
    try:
        coordinator.reset_agent(agent_name)
        return {"message": f"Agent '{agent_name}' has been reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-all")
async def reset_all_agents(current_user: User = Depends(get_current_user)):
    """重置所有 Agent 的对话历史"""
    coordinator.reset_all()
    return {"message": "All agents have been reset"}
```

---

## 6. 本地数据库服务设计

### 6.1 本地模式架构

```
┌─────────────────────────────────────────────────────────────┐
│                    本地部署模式                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  前端 (React)                                      │    │
│  │  - 本地 IndexedDB 缓存                             │    │
│  │  - 离线功能支持                                    │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │ HTTP/WebSocket                              │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │  后端 (FastAPI)                                    │    │
│  │  - 单机部署                                        │    │
│  │  - 轻量级配置                                      │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                             │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │  SQLite 数据库                                     │    │
│  │  - 零配置                                          │    │
│  │  - 文件存储                                        │    │
│  │  - 自动备份                                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  本地文件系统                                      │    │
│  │  - 报告存储                                        │    │
│  │  - 日志文件                                        │    │
│  │  - 缓存数据                                        │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 SQLite 数据库配置

#### 6.2.1 数据库会话管理 (db/session.py)

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from typing import AsyncGenerator

from app.config import settings


# 根据配置选择数据库
if settings.USE_LOCAL_DB:
    # SQLite 本地模式
    engine = create_async_engine(
        settings.SQLITE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # SQLite 使用静态连接池
        echo=settings.DEBUG,
    )
else:
    # PostgreSQL 云端模式
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        echo=settings.DEBUG,
    )

# 创建会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

#### 6.2.2 数据库初始化 (db/init_db.py)

```python
from sqlalchemy import text
from loguru import logger

from db.session import engine
from db.base import Base
from app.config import settings


async def init_db():
    """初始化数据库"""
    logger.info("Initializing database...")
    
    try:
        # 创建所有表
        async with engine.begin() as conn:
            # SQLite 特殊配置
            if settings.USE_LOCAL_DB:
                # 启用外键约束
                await conn.execute(text("PRAGMA foreign_keys = ON"))
                # 设置 WAL 模式（提升并发性能）
                await conn.execute(text("PRAGMA journal_mode = WAL"))
                # 设置同步模式
                await conn.execute(text("PRAGMA synchronous = NORMAL"))
                # 设置缓存大小（10MB）
                await conn.execute(text("PRAGMA cache_size = -10000"))
            
            # 创建表
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
        
        # 创建默认数据
        await create_default_data()
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


async def create_default_data():
    """创建默认数据"""
    from db.session import AsyncSessionLocal
    from models.user import User
    from core.security import get_password_hash
    
    async with AsyncSessionLocal() as session:
        # 检查是否已有管理员用户
        result = await session.execute(
            text("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        )
        admin_count = result.scalar()
        
        if admin_count == 0:
            # 创建默认管理员
            admin = User(
                id="admin-001",
                email="admin@xcodereviewer.com",
                full_name="Administrator",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            logger.info("Default admin user created")
```

### 6.3 数据库备份和恢复

#### 6.3.1 备份服务 (services/database/backup.py)

```python
import shutil
import gzip
from pathlib import Path
from datetime import datetime
from typing import Optional
from loguru import logger

from app.config import settings


class DatabaseBackupService:
    """数据库备份服务"""
    
    def __init__(self):
        self.backup_dir = Path("backups")
        self.backup_dir.mkdir(exist_ok=True)
    
    async def create_backup(self, compress: bool = True) -> str:
        """
        创建数据库备份
        
        Args:
            compress: 是否压缩备份文件
        
        Returns:
            备份文件路径
        """
        if not settings.USE_LOCAL_DB:
            raise ValueError("Backup is only supported for local SQLite database")
        
        # 生成备份文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"xcodereviewer_backup_{timestamp}.db"
        
        if compress:
            backup_name += ".gz"
        
        backup_path = self.backup_dir / backup_name
        
        # 获取数据库文件路径
        db_path = Path(settings.SQLITE_URL.replace("sqlite+aiosqlite:///", ""))
        
        try:
            if compress:
                # 压缩备份
                with open(db_path, "rb") as f_in:
                    with gzip.open(backup_path, "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)
            else:
                # 直接复制
                shutil.copy2(db_path, backup_path)
            
            logger.info(f"Database backup created: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            raise
    
    async def restore_backup(self, backup_path: str):
        """
        恢复数据库备份
        
        Args:
            backup_path: 备份文件路径
        """
        if not settings.USE_LOCAL_DB:
            raise ValueError("Restore is only supported for local SQLite database")
        
        backup_file = Path(backup_path)
        if not backup_file.exists():
            raise FileNotFoundError(f"Backup file not found: {backup_path}")
        
        # 获取数据库文件路径
        db_path = Path(settings.SQLITE_URL.replace("sqlite+aiosqlite:///", ""))
        
        try:
            # 创建当前数据库的备份
            current_backup = db_path.with_suffix(".db.before_restore")
            shutil.copy2(db_path, current_backup)
            
            # 恢复备份
            if backup_file.suffix == ".gz":
                # 解压并恢复
                with gzip.open(backup_file, "rb") as f_in:
                    with open(db_path, "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)
            else:
                # 直接复制
                shutil.copy2(backup_file, db_path)
            
            logger.info(f"Database restored from: {backup_path}")
            
        except Exception as e:
            logger.error(f"Failed to restore backup: {e}")
            # 尝试恢复原数据库
            if current_backup.exists():
                shutil.copy2(current_backup, db_path)
            raise
    
    async def list_backups(self) -> list[dict]:
        """列出所有备份文件"""
        backups = []
        
        for backup_file in self.backup_dir.glob("xcodereviewer_backup_*.db*"):
            stat = backup_file.stat()
            backups.append({
                "filename": backup_file.name,
                "path": str(backup_file),
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            })
        
        # 按创建时间倒序排序
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        
        return backups
    
    async def delete_backup(self, backup_path: str):
        """删除备份文件"""
        backup_file = Path(backup_path)
        if backup_file.exists():
            backup_file.unlink()
            logger.info(f"Backup deleted: {backup_path}")
    
    async def auto_backup(self, keep_days: int = 30):
        """
        自动备份（定时任务）
        
        Args:
            keep_days: 保留备份的天数
        """
        # 创建新备份
        await self.create_backup(compress=True)
        
        # 清理旧备份
        cutoff_time = datetime.now().timestamp() - (keep_days * 86400)
        
        for backup_file in self.backup_dir.glob("xcodereviewer_backup_*.db*"):
            if backup_file.stat().st_ctime < cutoff_time:
                backup_file.unlink()
                logger.info(f"Old backup deleted: {backup_file.name}")
```

#### 6.3.2 备份 API 端点 (api/v1/database.py)

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List
from pydantic import BaseModel

from services.database.backup import DatabaseBackupService
from api.deps import get_current_admin_user
from models.user import User


router = APIRouter(prefix="/database", tags=["Database"])

backup_service = DatabaseBackupService()


class BackupResponse(BaseModel):
    """备份响应"""
    filename: str
    path: str
    size: int
    created_at: str


@router.post("/backup")
async def create_backup(
    compress: bool = True,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_admin_user),
):
    """创建数据库备份（仅管理员）"""
    try:
        backup_path = await backup_service.create_backup(compress=compress)
        return {"message": "Backup created successfully", "path": backup_path}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backups", response_model=List[BackupResponse])
async def list_backups(current_user: User = Depends(get_current_admin_user)):
    """列出所有备份（仅管理员）"""
    return await backup_service.list_backups()


@router.post("/restore")
async def restore_backup(
    backup_path: str,
    current_user: User = Depends(get_current_admin_user),
):
    """恢复数据库备份（仅管理员）"""
    try:
        await backup_service.restore_backup(backup_path)
        return {"message": "Database restored successfully"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/backups/{filename}")
async def delete_backup(
    filename: str,
    current_user: User = Depends(get_current_admin_user),
):
    """删除备份文件（仅管理员）"""
    try:
        backup_path = f"backups/{filename}"
        await backup_service.delete_backup(backup_path)
        return {"message": "Backup deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---


## 7. 部署方案

### 7.1 Docker 部署

#### 7.1.1 Dockerfile

```dockerfile
# 多阶段构建
FROM python:3.11-slim as builder

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir --user -r requirements.txt

# 最终镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# 从 builder 复制已安装的包
COPY --from=builder /root/.local /root/.local

# 复制应用代码
COPY . .

# 设置环境变量
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 创建必要的目录
RUN mkdir -p logs backups uploads

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 7.1.2 Docker Compose (docker-compose.yml)

```yaml
version: '3.8'

services:
  # 后端服务
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: xcodereviewer-backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/xcodereviewer
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
      - MINIO_ENDPOINT=minio:9000
      - QDRANT_URL=http://qdrant:6333
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./backups:/app/backups
      - ./uploads:/app/uploads
    depends_on:
      - db
      - redis
      - minio
      - qdrant
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Celery Worker
  celery-worker:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: xcodereviewer-celery-worker
    command: celery -A tasks.celery_app worker -l info -c 4
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/xcodereviewer
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Celery Beat (定时任务)
  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: xcodereviewer-celery-beat
    command: celery -A tasks.celery_app beat -l info
    environment:
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/1
    env_file:
      - .env
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Flower (Celery 监控)
  flower:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: xcodereviewer-flower
    command: celery -A tasks.celery_app flower --port=5555
    ports:
      - "5555:5555"
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/1
    depends_on:
      - redis
      - celery-worker
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # PostgreSQL 数据库
  db:
    image: postgres:15-alpine
    container_name: xcodereviewer-db
    environment:
      - POSTGRES_DB=xcodereviewer
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Redis
  redis:
    image: redis:7-alpine
    container_name: xcodereviewer-redis
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # MinIO (对象存储)
  minio:
    image: minio/minio:latest
    container_name: xcodereviewer-minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio-data:/data
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Qdrant (向量数据库)
  qdrant:
    image: qdrant/qdrant:latest
    container_name: xcodereviewer-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant-data:/qdrant/storage
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Nginx (反向代理)
  nginx:
    image: nginx:alpine
    container_name: xcodereviewer-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - frontend-dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Prometheus (监控)
  prometheus:
    image: prom/prometheus:latest
    container_name: xcodereviewer-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped
    networks:
      - xcodereviewer-network

  # Grafana (可视化)
  grafana:
    image: grafana/grafana:latest
    container_name: xcodereviewer-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - xcodereviewer-network

volumes:
  postgres-data:
  redis-data:
  minio-data:
  qdrant-data:
  prometheus-data:
  grafana-data:
  frontend-dist:

networks:
  xcodereviewer-network:
    driver: bridge
```

#### 7.1.3 Nginx 配置 (nginx.conf)

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # 性能优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;

    # 上游服务器
    upstream backend {
        server backend:8000;
    }

    # HTTP 重定向到 HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # HTTPS 服务器
    server {
        listen 443 ssl http2;
        server_name _;

        # SSL 证书
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # 前端静态文件
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            
            # 缓存策略
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # API 代理
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 超时设置
            proxy_connect_timeout 300s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
        }

        # WebSocket 代理
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket 超时
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }

        # 健康检查
        location /health {
            proxy_pass http://backend/health;
            access_log off;
        }
    }
}
```

### 7.2 Kubernetes 部署（生产环境）

#### 7.2.1 Deployment (k8s/backend-deployment.yaml)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xcodereviewer-backend
  namespace: xcodereviewer
  labels:
    app: xcodereviewer
    component: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: xcodereviewer
      component: backend
  template:
    metadata:
      labels:
        app: xcodereviewer
        component: backend
    spec:
      containers:
      - name: backend
        image: xcodereviewer/backend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: xcodereviewer-secrets
              key: database-url
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
        - name: MINIO_ENDPOINT
          value: "minio-service:9000"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: logs
          mountPath: /app/logs
        - name: uploads
          mountPath: /app/uploads
      volumes:
      - name: logs
        persistentVolumeClaim:
          claimName: logs-pvc
      - name: uploads
        persistentVolumeClaim:
          claimName: uploads-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: xcodereviewer
spec:
  selector:
    app: xcodereviewer
    component: backend
  ports:
  - protocol: TCP
    port: 8000
    targetPort: 8000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: xcodereviewer
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: xcodereviewer-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 7.3 本地开发环境

#### 7.3.1 快速启动脚本 (scripts/dev.sh)

```bash
#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== XCodeReviewer 开发环境启动 ===${NC}"

# 检查 Python 版本
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.11"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo -e "${RED}错误: 需要 Python $required_version 或更高版本${NC}"
    exit 1
fi

# 创建虚拟环境
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}创建虚拟环境...${NC}"
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo -e "${YELLOW}安装依赖...${NC}"
pip install -r requirements.txt

# 复制环境变量文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}创建 .env 文件...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}请编辑 .env 文件配置必要参数${NC}"
fi

# 初始化数据库
echo -e "${YELLOW}初始化数据库...${NC}"
python scripts/init_db.py

# 启动 Redis (如果未运行)
if ! pgrep -x "redis-server" > /dev/null; then
    echo -e "${YELLOW}启动 Redis...${NC}"
    redis-server --daemonize yes
fi

# 启动 Celery Worker (后台)
echo -e "${YELLOW}启动 Celery Worker...${NC}"
celery -A tasks.celery_app worker -l info &

# 启动后端服务
echo -e "${GREEN}启动后端服务...${NC}"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---


## 8. 迁移路线图

### 8.1 总体时间规划

```
阶段一: 基础设施搭建 (2周)
├── Week 1: 项目初始化和环境配置
└── Week 2: 数据库设计和基础 API

阶段二: 核心服务迁移 (6周)
├── Week 3-4: LLM 服务层迁移
├── Week 5-6: 仓库扫描服务迁移
└── Week 7-8: 任务管理和报告服务

阶段三: Multi-Agent 服务 (4周)
├── Week 9-10: Agent 基础架构
└── Week 11-12: 专家 Agent 实现

阶段四: 本地数据库服务 (2周)
├── Week 13: SQLite 集成和备份
└── Week 14: 数据迁移工具

阶段五: 测试和优化 (3周)
├── Week 15: 集成测试
├── Week 16: 性能优化
└── Week 17: 安全加固

阶段六: 部署和上线 (2周)
├── Week 18: 灰度发布
└── Week 19: 全量上线和监控

总计: 19周 (约4.5个月)
```

### 8.2 详细实施计划

#### 阶段一: 基础设施搭建 (Week 1-2)

**Week 1: 项目初始化**
- [ ] 创建后端项目结构
- [ ] 配置开发环境（Python 3.11+, FastAPI）
- [ ] 设置 Git 仓库和分支策略
- [ ] 配置 CI/CD 流水线
- [ ] 编写项目文档和开发规范

**Week 2: 数据库设计**
- [ ] 设计数据库 Schema
- [ ] 创建 SQLAlchemy 模型
- [ ] 编写 Alembic 迁移脚本
- [ ] 实现基础 CRUD API
- [ ] 编写单元测试

**交付物**:
- 完整的项目结构
- 数据库设计文档
- 基础 API 文档
- 开发环境配置指南

---

#### 阶段二: 核心服务迁移 (Week 3-8)

**Week 3-4: LLM 服务层**
- [ ] 实现 LLM 基础适配器
- [ ] 迁移 11 个 LLM 平台适配器
- [ ] 实现 API Key 管理
- [ ] 实现结果缓存（Redis）
- [ ] 实现限流和重试机制
- [ ] 编写集成测试

**Week 5-6: 仓库扫描服务**
- [ ] 实现 GitHub 客户端
- [ ] 实现 GitLab 客户端
- [ ] 实现文件过滤器
- [ ] 实现 ZIP 文件处理
- [ ] 集成 Celery 异步任务
- [ ] 实现进度跟踪（WebSocket）

**Week 7-8: 任务管理和报告**
- [ ] 实现任务生命周期管理
- [ ] 实现任务调度器
- [ ] 实现报告生成服务
- [ ] 支持 JSON/PDF/Markdown 导出
- [ ] 实现文件存储（MinIO）

**交付物**:
- 完整的 LLM 服务 API
- 仓库扫描 API
- 任务管理 API
- 报告生成 API
- API 文档和测试报告

---

#### 阶段三: Multi-Agent 服务 (Week 9-12)

**Week 9-10: Agent 基础架构**
- [ ] 设计 Agent 架构
- [ ] 实现基础 Agent 类
- [ ] 实现 Agent 协调器
- [ ] 实现对话管理器
- [ ] 实现记忆系统
- [ ] 集成向量数据库（Qdrant）

**Week 11-12: 专家 Agent 实现**
- [ ] 实现安全专家 Agent
- [ ] 实现性能专家 Agent
- [ ] 实现架构专家 Agent
- [ ] 实现代码质量专家 Agent
- [ ] 实现 Agent 协作机制
- [ ] 编写 Agent API

**交付物**:
- Multi-Agent 服务 API
- Agent 协作文档
- 使用示例和最佳实践

---

#### 阶段四: 本地数据库服务 (Week 13-14)

**Week 13: SQLite 集成**
- [ ] 实现 SQLite 数据库支持
- [ ] 实现数据库模式切换
- [ ] 优化 SQLite 性能
- [ ] 实现数据库备份服务
- [ ] 实现数据库恢复服务

**Week 14: 数据迁移工具**
- [ ] 实现 IndexedDB → SQLite 迁移
- [ ] 实现 SQLite → PostgreSQL 迁移
- [ ] 实现数据导入导出工具
- [ ] 编写迁移文档

**交付物**:
- 本地数据库服务
- 数据迁移工具
- 备份恢复文档

---

#### 阶段五: 测试和优化 (Week 15-17)

**Week 15: 集成测试**
- [ ] 编写端到端测试
- [ ] 编写性能测试
- [ ] 编写压力测试
- [ ] 修复发现的 Bug
- [ ] 优化测试覆盖率（>80%）

**Week 16: 性能优化**
- [ ] 数据库查询优化
- [ ] 缓存策略优化
- [ ] API 响应时间优化
- [ ] 并发处理优化
- [ ] 资源使用优化

**Week 17: 安全加固**
- [ ] 安全审计
- [ ] 漏洞扫描
- [ ] 权限控制加固
- [ ] 数据加密
- [ ] 日志脱敏

**交付物**:
- 测试报告
- 性能优化报告
- 安全审计报告

---

#### 阶段六: 部署和上线 (Week 18-19)

**Week 18: 灰度发布**
- [ ] 准备生产环境
- [ ] 配置监控和告警
- [ ] 部署到测试环境
- [ ] 内部用户测试
- [ ] 10% 用户灰度

**Week 19: 全量上线**
- [ ] 50% 用户灰度
- [ ] 监控关键指标
- [ ] 100% 用户上线
- [ ] 编写运维文档
- [ ] 团队培训

**交付物**:
- 生产环境部署
- 监控仪表板
- 运维文档
- 用户手册

---

### 8.3 前端适配计划

#### 8.3.1 API 客户端封装

```typescript
// frontend/src/api/client.ts

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class APIClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        if (error.response?.status === 401) {
          // Token 过期，尝试刷新
          await this.refreshToken();
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await this.client.post('/auth/refresh', {
      refresh_token: refreshToken,
    });

    localStorage.setItem('access_token', response.access_token);
    return response;
  }

  // LLM 服务
  async analyzeCode(code: string, language: string) {
    return this.client.post('/llm/analyze', { code, language });
  }

  // 任务管理
  async createTask(data: any) {
    return this.client.post('/tasks', data);
  }

  async getTask(taskId: string) {
    return this.client.get(`/tasks/${taskId}`);
  }

  async cancelTask(taskId: string) {
    return this.client.put(`/tasks/${taskId}/cancel`);
  }

  // Multi-Agent
  async analyzeWithAgents(code: string, language: string, agents?: string[]) {
    return this.client.post('/agents/analyze', { code, language, agents });
  }

  async chatWithAgent(agentName: string, message: string) {
    return this.client.post('/agents/chat', { agent_name: agentName, message });
  }
}

export const apiClient = new APIClient(
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
);
```

#### 8.3.2 WebSocket 连接

```typescript
// frontend/src/api/websocket.ts

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(taskId: string, onMessage: (data: any) => void) {
    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/tasks/${taskId}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.reconnect(taskId, onMessage);
    };
  }

  private reconnect(taskId: string, onMessage: (data: any) => void) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(taskId, onMessage);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
```

---

## 9. 风险管理

### 9.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| **数据迁移失败** | 高 | 中 | 1. 完整备份<br>2. 分批迁移<br>3. 回滚方案 |
| **性能下降** | 中 | 中 | 1. 性能测试<br>2. 缓存优化<br>3. 负载均衡 |
| **API 兼容性** | 高 | 低 | 1. 版本控制<br>2. 向后兼容<br>3. 渐进式迁移 |
| **LLM 服务中断** | 高 | 低 | 1. 多平台备份<br>2. 降级策略<br>3. 本地模型 |
| **安全漏洞** | 高 | 低 | 1. 安全审计<br>2. 渗透测试<br>3. 及时修复 |

### 9.2 业务风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| **用户体验下降** | 高 | 中 | 1. 用户测试<br>2. 反馈收集<br>3. 快速迭代 |
| **成本超支** | 中 | 中 | 1. 成本监控<br>2. 资源优化<br>3. 预算控制 |
| **进度延期** | 中 | 中 | 1. 敏捷开发<br>2. 里程碑管理<br>3. 风险预留 |
| **团队技能不足** | 中 | 低 | 1. 技术培训<br>2. 外部支持<br>3. 知识分享 |

### 9.3 应急预案

#### 9.3.1 数据丢失应急

```bash
# 1. 立即停止服务
docker-compose down

# 2. 恢复最近备份
python scripts/restore_backup.py --backup-file backups/latest.db.gz

# 3. 验证数据完整性
python scripts/verify_data.py

# 4. 重启服务
docker-compose up -d

# 5. 通知用户
python scripts/send_notification.py --type data_recovery
```

#### 9.3.2 服务降级策略

```python
# services/degradation.py

class ServiceDegradation:
    """服务降级管理"""
    
    @staticmethod
    async def check_llm_health() -> bool:
        """检查 LLM 服务健康状态"""
        try:
            # 尝试调用 LLM
            response = await llm_service.simple_call("test")
            return True
        except Exception:
            return False
    
    @staticmethod
    async def fallback_analysis(code: str) -> dict:
        """降级分析（使用本地规则）"""
        return {
            "issues": [],
            "quality_score": 50,
            "message": "LLM 服务暂时不可用，使用基础规则分析",
            "degraded": True,
        }
```

---

## 10. 附录

### 10.1 环境变量完整清单

```bash
# .env.example

# ==================== 应用配置 ====================
APP_NAME=XCodeReviewer
APP_VERSION=2.0.0
DEBUG=false
API_PREFIX=/api/v1

# ==================== 服务器配置 ====================
HOST=0.0.0.0
PORT=8000
WORKERS=4

# ==================== CORS 配置 ====================
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# ==================== 数据库配置 ====================
# PostgreSQL (云端模式)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/xcodereviewer
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# SQLite (本地模式)
SQLITE_URL=sqlite+aiosqlite:///./xcodereviewer.db
USE_LOCAL_DB=false

# ==================== Redis 配置 ====================
REDIS_URL=redis://localhost:6379/0
REDIS_MAX_CONNECTIONS=50

# ==================== Celery 配置 ====================
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# ==================== MinIO/S3 配置 ====================
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=xcodereviewer
MINIO_SECURE=false

# ==================== JWT 配置 ====================
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=30

# ==================== LLM 配置 ====================
LLM_DEFAULT_PROVIDER=gemini
LLM_TIMEOUT=150
LLM_MAX_RETRIES=3
LLM_CACHE_TTL=86400

# LLM API Keys
GEMINI_API_KEY=
OPENAI_API_KEY=
CLAUDE_API_KEY=
QWEN_API_KEY=
DEEPSEEK_API_KEY=
ZHIPU_API_KEY=
MOONSHOT_API_KEY=
BAIDU_API_KEY=
MINIMAX_API_KEY=
DOUBAO_API_KEY=

# ==================== GitHub/GitLab 配置 ====================
GITHUB_TOKEN=
GITLAB_TOKEN=

# ==================== 任务配置 ====================
MAX_ANALYZE_FILES=40
LLM_CONCURRENCY=2
LLM_GAP_MS=500

# ==================== 限流配置 ====================
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# ==================== 监控配置 ====================
SENTRY_DSN=
PROMETHEUS_PORT=9090

# ==================== 日志配置 ====================
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
LOG_ROTATION=500 MB
LOG_RETENTION=30 days

# ==================== Multi-Agent 配置 ====================
AGENT_MAX_ITERATIONS=10
AGENT_TIMEOUT=300
AGENT_MEMORY_SIZE=100

# ==================== 向量数据库配置 ====================
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
VECTOR_DIMENSION=1536
```

### 10.2 常用命令速查

```bash
# 开发环境
python scripts/dev.sh                    # 启动开发环境
pytest tests/                            # 运行测试
ruff check .                             # 代码检查
mypy .                                   # 类型检查

# 数据库
alembic revision --autogenerate -m "msg" # 创建迁移
alembic upgrade head                     # 应用迁移
python scripts/init_db.py                # 初始化数据库
python scripts/backup_db.py              # 备份数据库

# Docker
docker-compose up -d                     # 启动所有服务
docker-compose logs -f backend           # 查看后端日志
docker-compose exec backend bash         # 进入后端容器
docker-compose down -v                   # 停止并删除所有

# Kubernetes
kubectl apply -f k8s/                    # 部署到 K8s
kubectl get pods -n xcodereviewer        # 查看 Pod 状态
kubectl logs -f pod-name                 # 查看日志
kubectl exec -it pod-name -- bash        # 进入容器
```

### 10.3 参考资料

- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [SQLAlchemy 文档](https://docs.sqlalchemy.org/)
- [Celery 文档](https://docs.celeryq.dev/)
- [Docker 文档](https://docs.docker.com/)
- [Kubernetes 文档](https://kubernetes.io/docs/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [Redis 文档](https://redis.io/documentation)

---

**文档版本**: v2.0  
**最后更新**: 2025-10-31  
**维护者**: XCodeReviewer Team  
**联系方式**: lintsinghua@qq.com

---

## 结语

本架构迁移方案提供了从纯前端架构到前后端分离架构的完整路径，包括：

✅ **完整的技术栈选型和理由**  
✅ **详细的代码实现示例**  
✅ **Multi-Agent 服务的完整设计**  
✅ **本地数据库服务的实现方案**  
✅ **生产级的部署方案**  
✅ **19周的详细实施计划**  
✅ **全面的风险管理策略**

该方案已经考虑了：
- 安全性（API Key 保护、数据加密、权限控制）
- 性能（缓存、异步、负载均衡）
- 可扩展性（微服务、容器化、K8s）
- 可维护性（代码规范、文档、测试）
- 用户体验（渐进式迁移、向后兼容）
