# 配置说明

## 后端核心配置

编辑 `backend/.env` 文件：

```env
# ========== 数据库配置 ==========
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=xcodereviewer

# ========== 安全配置 ==========
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# ========== LLM配置 ==========
# 支持的provider: openai, gemini, claude, qwen, deepseek, zhipu, moonshot, baidu, minimax, doubao, ollama
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=  # API中转站地址（可选）
LLM_TIMEOUT=150
LLM_TEMPERATURE=0.1
LLM_MAX_TOKENS=4096

# ========== 仓库扫描配置 ==========
GITHUB_TOKEN=your_github_token
GITLAB_TOKEN=your_gitlab_token
MAX_ANALYZE_FILES=50
LLM_CONCURRENCY=3
LLM_GAP_MS=2000
```

## 运行时配置（浏览器）

访问 `/admin` 系统管理页面，可在浏览器中直接配置：

- **LLM 配置**：API Keys、模型、超时等参数
- **平台密钥**：管理 10+ LLM 平台的 API Keys
- **分析参数**：并发数、间隔时间、最大文件数等
- **API 中转站**：配置第三方 API 代理服务

## 数据库模式

### 本地模式（推荐）

数据存储在浏览器 IndexedDB，开箱即用，隐私安全：

```env
VITE_USE_LOCAL_DB=true
```

### 云端模式

数据存储在 Supabase，支持多设备同步：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key
```

### 后端数据库模式

使用 PostgreSQL 存储，适合团队协作。

## API 中转站配置

许多用户使用 API 中转服务来访问 LLM（更稳定、更便宜）。

### 后端配置（推荐）

```env
LLM_PROVIDER=openai
LLM_API_KEY=中转站提供的Key
LLM_BASE_URL=https://your-proxy.com/v1
LLM_MODEL=gpt-4o-mini
```

### 前端运行时配置

1. 访问系统管理页面（`/admin`）
2. 在"系统配置"标签页中配置 API 基础 URL 和 Key
3. 保存并刷新页面
