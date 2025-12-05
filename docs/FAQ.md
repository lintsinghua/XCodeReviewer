# 常见问题

## 如何快速切换 LLM 平台？

### 方式一：浏览器配置（推荐）

1. 访问 `http://localhost:5173/admin` 系统管理页面
2. 在"系统配置"标签页选择不同的 LLM 提供商
3. 填入对应的 API Key
4. 保存并刷新页面

### 方式二：后端环境变量配置

修改 `backend/.env` 中的配置：

```env
# 切换到 OpenAI
LLM_PROVIDER=openai
LLM_API_KEY=your_key

# 切换到通义千问
LLM_PROVIDER=qwen
LLM_API_KEY=your_key
```

## 遇到请求超时怎么办？

1. 增加超时时间：`LLM_TIMEOUT=300`
2. 使用代理：配置 `LLM_BASE_URL`
3. 切换到国内平台：通义千问、DeepSeek、智谱AI 等
4. 降低并发：`LLM_CONCURRENCY=1`

## 如何使用 Ollama 本地大模型？

```bash
# 1. 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh  # macOS/Linux
# Windows: 访问 https://ollama.com/download

# 2. 拉取模型
ollama pull llama3  # 或 codellama、qwen2.5、deepseek-coder

# 3. 配置后端
# 在 backend/.env 中设置：
LLM_PROVIDER=ollama
LLM_MODEL=llama3
LLM_BASE_URL=http://localhost:11434/v1
```

推荐模型：`llama3`（综合）、`codellama`（代码专用）、`qwen2.5`（中文）

## 百度文心一言的 API Key 格式？

百度需要同时提供 API Key 和 Secret Key，用冒号分隔：

```env
LLM_PROVIDER=baidu
LLM_API_KEY=your_api_key:your_secret_key
```

获取地址：https://console.bce.baidu.com/qianfan/

## Windows 导出 PDF 报错怎么办？

PDF 导出功能使用 WeasyPrint 库，在 Windows 系统上需要安装 GTK 依赖：

### 方法一：使用 MSYS2 安装（推荐）

```bash
# 1. 下载并安装 MSYS2: https://www.msys2.org/
# 2. 打开 MSYS2 终端，执行：
pacman -S mingw-w64-x86_64-pango mingw-w64-x86_64-gtk3

# 3. 将 MSYS2 的 bin 目录添加到系统 PATH 环境变量：
# C:\msys64\mingw64\bin
```

### 方法二：使用 GTK3 Runtime 安装包

1. 下载 GTK3 Runtime: https://github.com/nickvidal/gtk3-runtime/releases
2. 安装后将安装目录添加到系统 PATH

### 方法三：使用 Docker 部署（最简单）

使用 Docker 部署后端可以避免 Windows 上的依赖问题：

```bash
docker-compose up -d backend
```

安装完成后重启后端服务即可正常导出 PDF。
