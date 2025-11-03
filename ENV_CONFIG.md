# 环境变量配置说明

## 前端环境变量配置

请在项目根目录创建 `.env` 或 `.env.local` 文件，并配置以下环境变量：

### 后端API配置

```bash
# 后端API基础地址
# 开发环境：使用代理模式，配置为 http://localhost:8000/api/v1
# 生产环境：配置为实际的后端API地址
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### LLM配置

```bash
# 当前使用的LLM提供商
VITE_LLM_PROVIDER=gemini

# Gemini AI配置
VITE_GEMINI_API_KEY=你的_gemini_api_key
VITE_GEMINI_MODEL=gemini-1.5-flash

# OpenAI配置
VITE_OPENAI_API_KEY=你的_openai_api_key
VITE_OPENAI_MODEL=gpt-4o-mini

# 其他LLM提供商配置...
```

### 完整环境变量示例

```bash
# ==================== 后端API配置 ====================
VITE_API_BASE_URL=http://localhost:8000/api/v1

# ==================== LLM 通用配置 ====================
VITE_LLM_PROVIDER=gemini
VITE_LLM_API_KEY=
VITE_LLM_MODEL=
VITE_LLM_TIMEOUT=150000
VITE_LLM_TEMPERATURE=0.2
VITE_LLM_MAX_TOKENS=4096

# ==================== Gemini AI 配置 ====================
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-1.5-flash

# ==================== GitHub 配置 ====================
VITE_GITHUB_TOKEN=

# ==================== GitLab 配置 ====================
VITE_GITLAB_TOKEN=

# ==================== 分析配置 ====================
VITE_MAX_ANALYZE_FILES=40
VITE_LLM_CONCURRENCY=2
VITE_LLM_GAP_MS=500

# ==================== 语言配置 ====================
VITE_OUTPUT_LANGUAGE=zh-CN
```

## 后端环境变量配置

后端环境变量配置请参考 `backend/.env` 文件。

## 前后端联动配置

### 1. 代理配置

前端通过 Vite 代理配置自动将 `/api` 和 `/ws` 请求转发到后端：

- `/api/*` → `http://localhost:8000/api/*`
- `/ws/*` → `ws://localhost:8000/ws/*`

### 2. CORS配置

后端已配置允许前端跨域访问：
- 允许来源：`http://localhost:5173`, `http://localhost:3000`
- 允许方法：GET, POST, PUT, DELETE, PATCH, OPTIONS
- 允许携带凭证：是

### 3. API端点

后端API基础路径：`http://localhost:8000/api/v1`

可用端点：
- `/api/v1/auth` - 认证相关
- `/api/v1/projects` - 项目管理
- `/api/v1/tasks` - 任务管理
- `/api/v1/issues` - 问题管理
- `/api/v1/reports` - 报告管理
- `/api/v1/statistics` - 统计数据
- `/api/v1/agents` - AI代理
- `/api/v1/monitoring` - 监控信息
- `/api/v1/migration` - 数据迁移
- `/ws` - WebSocket连接

### 4. 启动步骤

1. **启动后端**：
   ```bash
   cd backend
   # 使用Docker Compose启动
   docker-compose up -d
   # 或直接启动
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **配置前端环境变量**：
   在项目根目录创建 `.env.local` 文件并配置必要的环境变量

3. **启动前端**：
   ```bash
   npm run dev
   ```

4. **访问应用**：
   打开浏览器访问 `http://localhost:5173`

### 5. 健康检查

- 后端健康检查：`http://localhost:8000/health`
- 后端就绪检查：`http://localhost:8000/ready`
- API文档：`http://localhost:8000/api/v1/docs`

## 生产环境配置

生产环境需要：

1. 设置 `VITE_API_BASE_URL` 为实际的后端API地址
2. 确保后端CORS配置包含前端域名
3. 配置正确的LLM API密钥
4. 设置合适的安全配置（HTTPS、CSP等）

## 故障排查

### 前端无法连接后端

1. 检查后端是否正常运行：访问 `http://localhost:8000/health`
2. 检查代理配置是否正确
3. 检查浏览器控制台是否有CORS错误
4. 检查环境变量是否正确配置

### API请求失败

1. 检查API端点是否正确
2. 检查请求参数是否符合后端要求
3. 查看后端日志获取详细错误信息
4. 检查认证token是否有效

### WebSocket连接失败

1. 检查WebSocket代理配置
2. 确保后端WebSocket服务正常运行
3. 检查防火墙和网络配置

