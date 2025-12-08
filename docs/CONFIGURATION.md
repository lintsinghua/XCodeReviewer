# 配置说明

本文档详细介绍 DeepAudit 的所有配置选项，包括后端环境变量、前端配置和运行时配置。

## 目录

- [配置方式概览](#配置方式概览)
- [后端配置](#后端配置)
- [前端配置](#前端配置)
- [运行时配置](#运行时配置)
- [API 中转站配置](#api-中转站配置)

---

## 配置方式概览

DeepAudit 采用前后端分离架构，数据存储在后端 PostgreSQL 数据库中。

配置优先级（从高到低）：

| 配置方式 | 适用场景 | 优先级 |
|---------|---------|--------|
| 运行时配置（浏览器 /admin） | 快速切换 LLM、调试 | 最高 |
| 后端环境变量 | 生产部署、团队共享 | 中 |
| 默认值 | 开箱即用 | 最低 |

---

## 后端配置

后端配置文件位于 `backend/.env`，首次使用请复制示例文件：

```bash
cp backend/env.example backend/.env
```

### 完整配置参考

```env
# =============================================
# DeepAudit Backend 配置文件
# =============================================

# ========== 数据库配置 ==========
POSTGRES_SERVER=localhost          # 数据库服务器地址
POSTGRES_USER=postgres             # 数据库用户名
POSTGRES_PASSWORD=postgres         # 数据库密码
POSTGRES_DB=deepaudit              # 数据库名称
# DATABASE_URL=                    # 完整数据库连接字符串（可选，会覆盖上述配置）

# ========== 安全配置 ==========
SECRET_KEY=your-super-secret-key   # JWT 签名密钥（生产环境必须修改！）
ALGORITHM=HS256                    # JWT 加密算法
ACCESS_TOKEN_EXPIRE_MINUTES=11520  # Token 过期时间（分钟），默认 8 天

# ========== LLM 通用配置 ==========
LLM_PROVIDER=openai                # LLM 提供商（见下方支持列表）
LLM_API_KEY=sk-your-api-key        # API 密钥
LLM_MODEL=                         # 模型名称（留空使用默认模型）
LLM_BASE_URL=                      # 自定义 API 端点（API 中转站）
LLM_TIMEOUT=150                    # 请求超时时间（秒）
LLM_TEMPERATURE=0.1                # 生成温度（0-1，越低越确定）
LLM_MAX_TOKENS=4096                # 最大生成 Token 数

# ========== 各平台独立配置（可选） ==========
# 如果需要同时配置多个平台，可以单独设置
# OPENAI_API_KEY=sk-xxx
# OPENAI_BASE_URL=https://api.openai.com/v1
# GEMINI_API_KEY=xxx
# CLAUDE_API_KEY=xxx
# QWEN_API_KEY=xxx
# DEEPSEEK_API_KEY=xxx
# ZHIPU_API_KEY=xxx
# MOONSHOT_API_KEY=xxx
# BAIDU_API_KEY=api_key:secret_key  # 百度格式特殊
# MINIMAX_API_KEY=xxx
# DOUBAO_API_KEY=xxx
# OLLAMA_BASE_URL=http://localhost:11434/v1

# ========== Git 仓库配置 ==========
GITHUB_TOKEN=                      # GitHub Personal Access Token
GITLAB_TOKEN=                      # GitLab Personal Access Token

# ========== 扫描配置 ==========
MAX_ANALYZE_FILES=50               # 单次扫描最大文件数
MAX_FILE_SIZE_BYTES=204800         # 单文件最大大小（字节），默认 200KB
LLM_CONCURRENCY=3                  # LLM 并发请求数
LLM_GAP_MS=2000                    # 请求间隔（毫秒），避免限流

# ========== 存储配置 ==========
ZIP_STORAGE_PATH=./uploads/zip_files  # ZIP 文件存储目录

# ========== 输出配置 ==========
OUTPUT_LANGUAGE=zh-CN              # 输出语言：zh-CN（中文）| en-US（英文）
```

### 支持的 LLM 提供商

| Provider | 说明 | 适配器类型 |
|----------|------|-----------|
| `openai` | OpenAI GPT 系列 | LiteLLM |
| `gemini` | Google Gemini | LiteLLM |
| `claude` | Anthropic Claude | LiteLLM |
| `qwen` | 阿里云通义千问 | LiteLLM |
| `deepseek` | DeepSeek | LiteLLM |
| `zhipu` | 智谱 AI (GLM) | LiteLLM |
| `moonshot` | 月之暗面 Kimi | LiteLLM |
| `ollama` | Ollama 本地模型 | LiteLLM |
| `baidu` | 百度文心一言 | 原生适配器 |
| `minimax` | MiniMax | 原生适配器 |
| `doubao` | 字节豆包 | 原生适配器 |

### 配置示例

#### OpenAI

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini
```

#### 通义千问

```env
LLM_PROVIDER=qwen
LLM_API_KEY=sk-your-dashscope-key
LLM_MODEL=qwen-turbo
```

#### Ollama 本地模型

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3
LLM_BASE_URL=http://localhost:11434/v1
```

#### 百度文心一言

```env
LLM_PROVIDER=baidu
LLM_API_KEY=your_api_key:your_secret_key
LLM_MODEL=ernie-bot-4
```

---

## 前端配置

前端配置文件位于 `frontend/.env`，首次使用请复制示例文件：

```bash
cp frontend/.env.example frontend/.env
```

### 完整配置参考

```env
# ========== 后端 API 配置 ==========
VITE_API_BASE_URL=/api             # 后端 API 地址

# ========== 应用配置 ==========
VITE_APP_ID=deepaudit

# ========== 代码分析配置 ==========
VITE_MAX_ANALYZE_FILES=40          # 最大分析文件数
VITE_LLM_CONCURRENCY=2             # LLM 并发数
VITE_LLM_GAP_MS=500                # 请求间隔（毫秒）
VITE_OUTPUT_LANGUAGE=zh-CN         # 输出语言
```

### 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址，Docker 部署时使用 `/api` | `/api` |
| `VITE_MAX_ANALYZE_FILES` | 单次扫描最大文件数 | `40` |
| `VITE_LLM_CONCURRENCY` | 前端 LLM 并发请求数 | `2` |
| `VITE_LLM_GAP_MS` | 前端请求间隔 | `500` |
| `VITE_OUTPUT_LANGUAGE` | 分析结果输出语言 | `zh-CN` |

---

## 运行时配置

DeepAudit 支持在浏览器中进行运行时配置，无需重启服务。

### 访问方式

1. 登录系统后，访问 `/admin` 系统管理页面
2. 或点击侧边栏的"系统管理"菜单

### 可配置项

#### LLM 配置

- LLM 提供商选择
- API Key 配置
- 模型选择
- 自定义 API 端点（中转站）
- 超时时间
- 温度参数
- 最大 Token 数

#### 分析参数

- 最大分析文件数
- 并发请求数
- 请求间隔时间
- 输出语言

#### Git 集成

- GitHub Token
- GitLab Token

### 配置优先级

运行时配置 > 后端环境变量 > 默认值

---

## 数据存储

DeepAudit 采用前后端分离架构，所有数据存储在后端 PostgreSQL 数据库中。

### 架构说明

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   前端      │────▶│   后端 API  │────▶│ PostgreSQL  │
│  (React)    │     │  (FastAPI)  │     │   数据库    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 特点

- ✅ 数据持久化存储
- ✅ 支持多用户
- ✅ 支持用户认证
- ✅ 数据导入/导出功能
- ✅ 团队协作

### 数据管理

在 `/admin` 页面的"数据库管理"标签页中，可以：

- **导出数据**: 将所有数据导出为 JSON 文件备份
- **导入数据**: 从 JSON 文件恢复数据
- **清空数据**: 删除所有数据（谨慎操作）
- **健康检查**: 检查数据库连接状态

---

## API 中转站配置

许多用户使用 API 中转服务来访问 LLM（更稳定、更便宜、解决网络问题）。

### 后端配置（推荐）

```env
LLM_PROVIDER=openai
LLM_API_KEY=中转站提供的Key
LLM_BASE_URL=https://your-proxy.com/v1
LLM_MODEL=gpt-4o-mini
```

### 运行时配置

1. 访问系统管理页面（`/admin`）
2. 在"系统配置"标签页中：
   - 选择 LLM 提供商
   - 填入中转站提供的 API Key
   - 设置自定义 API 基础 URL
3. 保存配置

### 常见中转站

| 中转站 | 说明 |
|--------|------|
| [OpenRouter](https://openrouter.ai/) | 支持多种模型 |
| [API2D](https://api2d.com/) | 国内访问友好 |
| [CloseAI](https://www.closeai-asia.com/) | 价格实惠 |

### 注意事项

1. 确保中转站支持你选择的模型
2. 中转站的 API 格式需要与 OpenAI 兼容
3. 部分中转站可能有请求限制

---

## 更多资源

- [部署指南](DEPLOYMENT.md) - 详细的部署说明
- [LLM 平台支持](LLM_PROVIDERS.md) - 各 LLM 平台的配置方法
- [常见问题](FAQ.md) - 配置相关问题解答
