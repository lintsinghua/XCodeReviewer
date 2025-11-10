# XCodeReviewer 2.0 - README Update Guide (English)

## 🎉 Major Updates in 2.0

XCodeReviewer 2.0 adopts a brand-new frontend-backend separation architecture, providing an enterprise-grade code audit solution:

### 🏗️ New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     XCodeReviewer 2.0                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript + Vite)                        │
│  • Modern UI Interface                                        │
│  • Real-time Task Progress                                    │
│  • LLM Provider Management                                    │
├─────────────────────────────────────────────────────────────┤
│  Backend API (FastAPI + Python 3.11)                         │
│  • RESTful API Design                                         │
│  • JWT Authentication                                         │
│  • Async Task Processing                                      │
│  • LLM Provider CRUD                                          │
├─────────────────────────────────────────────────────────────┤
│  Task Queue (Celery + Redis)                                 │
│  • Async Code Scanning                                        │
│  • Distributed Task Scheduling                                │
│  • Real-time Progress Updates                                 │
├─────────────────────────────────────────────────────────────┤
│  Data Layer (PostgreSQL + Redis)                             │
│  • PostgreSQL: Primary Database                               │
│  • Redis: Cache + Message Queue                               │
│  • MinIO: Object Storage (Optional)                           │
└─────────────────────────────────────────────────────────────┘
```

### ⭐ Core Features

- **🎯 Enterprise Architecture**: Frontend-backend separation, horizontally scalable
- **📦 Out-of-the-Box**: One-click Docker Compose deployment
- **🔐 Security Hardened**: Encrypted API Key storage, JWT authentication
- **⚡ Async Processing**: Celery task queue, large-scale project scanning
- **🎨 Flexible LLM Configuration**: 
  - Support for 11+ mainstream LLM platforms (Gemini, OpenAI, Claude, Qwen, DeepSeek, Zhipu, Moonshot, Baidu, MiniMax, Doubao, Ollama, **AWS Bedrock**)
  - Visual LLM Provider management (CRUD)
  - Encrypted API Key storage
  - Task-level LLM selection
- **📊 Real-time Monitoring**: WebSocket real-time task progress, health checks

---

## 🚀 Quick Start

### Method 1: Docker Compose Deployment (Recommended) ⭐

**Use Cases**: Production, Testing, Quick Experience

#### 1. Clone the Project

```bash
git clone https://github.com/lintsinghua/XCodeReviewer.git
cd XCodeReviewer/backend
```

#### 2. Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit .env file, configure necessary parameters
vi .env
```

**Minimal Configuration**:
```env
# Database (use defaults)
DATABASE_URL=postgresql+asyncpg://xcodereviewer:xcodereviewer@postgres:5432/xcodereviewer

# Redis (use defaults)
REDIS_URL=redis://redis:6379/0

# JWT Secret (please change to random string)
SECRET_KEY=your-super-secret-key-change-in-production

# Default LLM Configuration (choose one)
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

#### 3. Start All Services

```bash
# Start all services (PostgreSQL + Redis + MinIO + Backend + Frontend + Celery)
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

#### 4. Access the Application

```bash
# Frontend Application
http://localhost:5173

# Backend API Documentation
http://localhost:8000/docs

# MinIO Console (Optional)
http://localhost:9001
```

#### 5. Create Admin Account

```bash
# Enter backend container
docker-compose exec backend bash

# Create admin
python scripts/create_admin.py

# Enter username, email, password
```

#### Service Overview

| Service | Port | Description |
|---------|------|-------------|
| **frontend** | 5173 | React frontend application |
| **backend** | 8000 | FastAPI backend service |
| **postgres** | 5432 | PostgreSQL database |
| **redis** | 6379 | Redis cache/message queue |
| **celery** | - | Celery task queue worker |
| **minio** | 9000/9001 | MinIO object storage (optional) |

---

## 🛠️ Tech Stack

### Frontend

| Category | Technology | Version | Description |
|----------|-----------|---------|-------------|
| **Framework** | React | 18.x | Declarative UI framework |
| | TypeScript | 5.7 | Type safety |
| | Vite | 5.1 | Modern build tool |
| **UI** | Tailwind CSS | 3.x | Atomic CSS |
| | Radix UI | - | Accessible component library |
| | Lucide React | - | Icon library |
| **Visualization** | Recharts | - | Chart library |
| **State Management** | React Hooks | - | Lightweight state management |
| **Routing** | React Router | 6.x | SPA routing |
| **Notifications** | Sonner | - | Toast notifications |

### Backend

| Category | Technology | Version | Description |
|----------|-----------|---------|-------------|
| **Framework** | FastAPI | 0.115.x | High-performance async API framework |
| | Python | 3.11+ | Programming language |
| | Pydantic | 2.x | Data validation |
| **Database** | PostgreSQL | 14+ | Primary database |
| | SQLAlchemy | 2.x | ORM framework |
| | Alembic | 1.x | Database migrations |
| **Cache/Queue** | Redis | 6+ | Cache + message queue |
| | Celery | 5.x | Distributed task queue |
| **Storage** | MinIO | - | Object storage (optional) |
| **Authentication** | JWT | - | JSON Web Token |
| | PassLib | - | Password hashing |
| **Encryption** | Cryptography | 41.x | API Key encryption |
| **HTTP** | httpx | 0.25.x | Async HTTP client |
| **LLM** | Multi-platform SDKs | - | 11+ LLM platforms |
| **Monitoring** | Prometheus | - | Metrics collection |
| | Grafana | - | Visualization |

### LLM Platform Support

| Platform Type | Platform Name | Features | Status |
|--------------|---------------|----------|--------|
| **International** | Google Gemini | Generous free tier | ✅ |
| | OpenAI GPT | Best performance | ✅ |
| | Anthropic Claude | Strong code understanding | ✅ |
| | **AWS Bedrock** | Enterprise service | ✅ NEW |
| | DeepSeek | Cost-effective | ✅ |
| **Chinese** | Alibaba Qwen | Fast domestic access | ✅ |
| | Zhipu AI (GLM) | Good Chinese support | ✅ |
| | Moonshot (Kimi) | Long context | ✅ |
| | Baidu ERNIE | Enterprise service | ✅ |
| | MiniMax | Multimodal | ✅ |
| | Bytedance Doubao | Cost-effective | ✅ |
| **Local** | Ollama | Fully local | ✅ |

---

## ✨ Core Features

### 1. 🎯 LLM Provider Management

**2.0 New Feature**: Visual management of LLM providers

- **CRUD Operations**: Create, read, update, delete LLM Providers
- **API Key Management**: 
  - AES-256 encrypted storage
  - Visual configuration interface
  - Preview support (first + last few characters)
  - Priority: Database > Environment variables
- **Task-level Selection**: Each audit task can select specific LLM Provider
- **Instant Analysis**: Support for different LLM selection
- **Built-in Providers**: 11+ pre-configured platforms

**Usage**:
1. Visit `/admin` → LLM Providers
2. Click "Configure API Key" button
3. Enter API Key and save
4. Select corresponding Provider when creating tasks

### 2. 🚀 Async Task Processing

- **Celery Task Queue**: Support for large-scale project scanning
- **Real-time Progress Updates**: WebSocket push task progress
- **Distributed Deployment**: Multi-worker horizontal scaling
- **Task Retry**: Automatic retry for failed tasks
- **Task Priority**: Support for task prioritization

### 3. 🔐 Security Hardening

- **JWT Authentication**: Token-based identity authentication
- **API Key Encryption**: AES-256 encrypted storage
- **Password Hashing**: bcrypt encryption for user passwords
- **CORS Configuration**: Cross-origin request security control
- **SQL Injection Protection**: ORM prevents SQL injection

### 4. 📊 Real-time Monitoring

- **System Metrics**: CPU, memory, disk usage
- **API Performance**: Request response time, error rate
- **Task Statistics**: Success/failure rate, average duration
- **Database Monitoring**: Connection pool, slow queries
- **Prometheus + Grafana**: Complete monitoring solution

---

## ⚙️ Environment Variables

### Required Configuration

```env
# ==================== Database Configuration ====================
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/xcodereviewer
REDIS_URL=redis://localhost:6379/0

# ==================== Security Configuration ====================
SECRET_KEY=your-super-secret-key-change-in-production
ENCRYPTION_KEY=your-encryption-key-for-api-keys  # Optional

# ==================== LLM Configuration ====================
# Choose default LLM Provider
LLM_PROVIDER=gemini

# Configure at least one LLM platform API Key
GEMINI_API_KEY=your_gemini_api_key
# Or
OPENAI_API_KEY=your_openai_api_key
# Or
CLAUDE_API_KEY=your_claude_api_key
```

### LLM Platform Configuration

```env
# Google Gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash  # Optional

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini  # Optional
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional

# Anthropic Claude
CLAUDE_API_KEY=your_key
CLAUDE_MODEL=claude-3-5-sonnet-20241022  # Optional

# AWS Bedrock (NEW)
BEDROCK_API_KEY=your_key
BEDROCK_REGION=us-east-1  # Optional

# Alibaba Qwen
QWEN_API_KEY=your_key
QWEN_MODEL=qwen-turbo  # Optional

# DeepSeek
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-chat  # Optional

# Zhipu AI
ZHIPU_API_KEY=your_key
ZHIPU_MODEL=glm-4-flash  # Optional

# Moonshot (Kimi)
MOONSHOT_API_KEY=your_key
MOONSHOT_MODEL=moonshot-v1-8k  # Optional

# Baidu ERNIE
BAIDU_API_KEY=api_key:secret_key  # Note the format
BAIDU_MODEL=ERNIE-3.5-8K  # Optional

# MiniMax
MINIMAX_API_KEY=your_key
MINIMAX_MODEL=abab6.5-chat  # Optional

# Bytedance Doubao
DOUBAO_API_KEY=your_key
DOUBAO_MODEL=doubao-pro-32k  # Optional

# Ollama (Local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3  # Optional
```

---

## 🔄 Upgrade Guide

### Upgrading from 1.x to 2.0

**⚠️ Important Note**: 2.0 uses a brand-new architecture and is not compatible with 1.x data.

1. **Export 1.x Data** (if you want to keep it)
   - Export data as JSON from 1.x admin page

2. **Deploy 2.0 Version**
   ```bash
   git pull origin main
   cd backend
   docker-compose up -d
   ```

3. **Initialize Database**
   ```bash
   docker-compose exec backend python scripts/init_db.py
   docker-compose exec backend python scripts/init_llm_providers.py
   docker-compose exec backend python scripts/create_admin.py
   ```

4. **Migrate Data** (Optional)
   - Use data migration script (in development)
   - Or manually recreate projects and tasks

---

## 📞 Get Help

- **Documentation**: [backend/docs/](backend/docs/)
- **Issues**: https://github.com/lintsinghua/XCodeReviewer/issues
- **Discussions**: https://github.com/lintsinghua/XCodeReviewer/discussions
- **Email**: lintsinghua@qq.com

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

**⭐ If this project helps you, please give us a Star! Your support is our motivation to keep moving forward!**

