# XCodeReviewer Backend

一个功能完整的代码审查平台后端服务，支持多个LLM提供商、异步任务处理和实时更新。

## 🚀 快速开始

### 环境要求
- Python 3.11+
- PostgreSQL 14+ (或 SQLite用于开发)
- Redis 7+
- (可选) MinIO/S3用于文件存储

### 安装

```bash
# 克隆仓库
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加必要的配置

# 初始化数据库
alembic upgrade head

# 启动服务
uvicorn app.main:app --reload
```

### Docker部署

```bash
# 使用Docker Compose
docker-compose up -d

# 查看日志
docker-compose logs -f backend
```

## 📚 核心功能

### ✅ 已实现功能

- **8个LLM提供商**
  - OpenAI (GPT-4, GPT-3.5)
  - Google Gemini
  - Anthropic Claude
  - 阿里通义千问
  - DeepSeek
  - 智谱AI
  - 月之暗面
  - Ollama (本地模型)

- **仓库扫描**
  - GitHub集成
  - GitLab集成
  - ZIP文件上传
  - 智能文件过滤
  - 语言检测

- **异步任务处理**
  - Celery + Redis
  - 实时进度更新
  - WebSocket支持
  - 任务取消

- **完整REST API**
  - 35+ API端点
  - JWT认证
  - 角色权限
  - OpenAPI文档

## 📖 文档

- **API文档**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **实现总结**: [FINAL_IMPLEMENTATION_SUMMARY.md](FINAL_IMPLEMENTATION_SUMMARY.md)
- **LLM服务**: [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)
- **仓库扫描**: [REPOSITORY_SCANNER_COMPLETE.md](REPOSITORY_SCANNER_COMPLETE.md)
- **异步处理**: [ASYNC_PROCESSING_COMPLETE.md](ASYNC_PROCESSING_COMPLETE.md)

## 🔧 配置

### 环境变量

```bash
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/xcodereviewer
REDIS_URL=redis://localhost:6379/0

# LLM API密钥
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
CLAUDE_API_KEY=...
QWEN_API_KEY=...
DEEPSEEK_API_KEY=...
ZHIPU_API_KEY=...
MOONSHOT_API_KEY=...

# 安全
SECRET_KEY=your-secret-key-min-32-chars
ENCRYPTION_KEY=your-encryption-key

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
```

## 🧪 测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_llm_service.py -v

# 生成覆盖率报告
pytest --cov=backend --cov-report=html
```

## 🔄 Celery Worker

```bash
# 启动Worker
celery -A tasks.celery_app worker --loglevel=info

# 启动特定队列
celery -A tasks.celery_app worker -Q scan,analysis --loglevel=info

# 启动Flower监控
celery -A tasks.celery_app flower --port=5555
```

## 📊 监控

- **Flower**: http://localhost:5555 (Celery监控)
- **Prometheus**: http://localhost:9090 (指标)
- **Grafana**: http://localhost:3000 (仪表板)

## 🛠️ 开发

### 项目结构

```
backend/
├── app/                    # 应用配置
├── api/                    # API端点
│   └── v1/                # API v1
├── services/              # 业务服务
│   ├── llm/              # LLM服务
│   ├── repository/       # 仓库扫描
│   ├── cache/            # 缓存服务
│   └── agent/            # Agent服务
├── tasks/                 # Celery任务
├── models/                # 数据模型
├── schemas/               # Pydantic schemas
├── core/                  # 核心工具
├── db/                    # 数据库配置
└── tests/                 # 测试
```

### 添加新的LLM提供商

1. 创建适配器类继承 `BaseLLMAdapter`
2. 实现必需方法：`complete()`, `stream()`, `count_tokens()`
3. 在 `factory.py` 中注册
4. 添加API密钥到配置

示例：
```python
# services/llm/adapters/my_adapter.py
from services.llm.base_adapter import BaseLLMAdapter

class MyAdapter(BaseLLMAdapter):
    async def complete(self, prompt, model, **kwargs):
        # 实现
        pass

# services/llm/factory.py
from services.llm.adapters.my_adapter import MyAdapter
LLMFactory.register("my_provider", MyAdapter)
```

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 📄 许可证

MIT License

## 🙏 致谢

- FastAPI
- Celery
- SQLAlchemy
- 所有LLM提供商

---

**状态**: 🟢 生产就绪

**版本**: 2.0.0

**完成度**: 70% (21/30 主要任务)
