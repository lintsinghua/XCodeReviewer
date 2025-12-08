# LLM 平台支持

DeepAudit 支持 10+ 主流 LLM 平台，可根据需求自由选择。本文档介绍各平台的配置方法。

## 目录

- [平台概览](#平台概览)
- [国际平台](#国际平台)
- [国内平台](#国内平台)
- [本地部署](#本地部署)
- [API 中转站](#api-中转站)
- [选择建议](#选择建议)

---

## 平台概览

| 平台类型 | 平台名称 | Provider | 特点 | 获取 API Key |
|---------|---------|----------|------|-------------|
| **国际平台** | OpenAI GPT | `openai` | 稳定可靠，生态完善 | [获取](https://platform.openai.com/api-keys) |
| | Google Gemini | `gemini` | 免费配额充足 | [获取](https://makersuite.google.com/app/apikey) |
| | Anthropic Claude | `claude` | 代码理解能力强 | [获取](https://console.anthropic.com/) |
| | DeepSeek | `deepseek` | 性价比极高，代码能力强 | [获取](https://platform.deepseek.com/) |
| **国内平台** | 阿里云通义千问 | `qwen` | 国内访问快，中文好 | [获取](https://dashscope.console.aliyun.com/) |
| | 智谱 AI (GLM) | `zhipu` | 中文支持好 | [获取](https://open.bigmodel.cn/) |
| | 月之暗面 Kimi | `moonshot` | 长文本处理强 | [获取](https://platform.moonshot.cn/) |
| | 百度文心一言 | `baidu` | 企业级服务 | [获取](https://console.bce.baidu.com/qianfan/) |
| | MiniMax | `minimax` | 多模态能力 | [获取](https://www.minimaxi.com/) |
| | 字节豆包 | `doubao` | 高性价比 | [获取](https://console.volcengine.com/ark) |
| **本地部署** | Ollama | `ollama` | 完全本地化，隐私安全 | [安装](https://ollama.com/) |

---

## 国际平台

### OpenAI GPT

OpenAI 是最成熟的 LLM 平台，模型性能稳定，代码理解能力强。

**获取 API Key**: https://platform.openai.com/api-keys

**配置示例**:

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini
```

**常用模型**: `gpt-4o`、`gpt-4o-mini`、`gpt-4-turbo`、`o1`、`o1-mini` 等

> 💡 模型列表会持续更新，请访问 [OpenAI 官网](https://platform.openai.com/docs/models) 查看最新模型。

---

### Google Gemini

Google 的 Gemini 系列模型，免费配额充足，适合个人使用。

**获取 API Key**: https://makersuite.google.com/app/apikey

**配置示例**:

```env
LLM_PROVIDER=gemini
LLM_API_KEY=your-api-key
LLM_MODEL=gemini-2.0-flash
```

**常用模型**: `gemini-2.0-flash`、`gemini-1.5-pro`、`gemini-1.5-flash` 等

> 💡 Gemini 有免费配额限制，超出后需付费。请访问 [Google AI Studio](https://ai.google.dev/) 查看最新模型。

---

### Anthropic Claude

Claude 在代码理解和生成方面表现优秀，特别适合代码审计场景。

**获取 API Key**: https://console.anthropic.com/

**配置示例**:

```env
LLM_PROVIDER=claude
LLM_API_KEY=sk-ant-your-api-key
LLM_MODEL=claude-sonnet-4-20250514
```

**常用模型**: `claude-sonnet-4-*`、`claude-opus-4-*`、`claude-3.5-sonnet-*` 等

> 💡 Claude 模型名称包含日期后缀，请访问 [Anthropic 官网](https://docs.anthropic.com/en/docs/about-claude/models) 查看最新模型。

---

### DeepSeek

DeepSeek 是国产模型中代码能力最强的之一，性价比极高。

**获取 API Key**: https://platform.deepseek.com/

**配置示例**:

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-your-api-key
LLM_MODEL=deepseek-chat
```

**常用模型**: `deepseek-chat`、`deepseek-coder`、`deepseek-reasoner` 等

> 💡 DeepSeek 价格仅为 GPT-4 的 1/10，代码能力接近 GPT-4，性价比极高。

---

## 国内平台

### 阿里云通义千问

通义千问是阿里云的大模型服务，国内访问速度快，中文理解能力强。

**获取 API Key**: https://dashscope.console.aliyun.com/

**配置示例**:

```env
LLM_PROVIDER=qwen
LLM_API_KEY=sk-your-dashscope-key
LLM_MODEL=qwen-turbo
```

**常用模型**: `qwen-max`、`qwen-plus`、`qwen-turbo`、`qwen-coder-*` 等

---

### 智谱 AI (GLM)

智谱 AI 的 GLM 系列模型，中文支持好，有免费配额。

**获取 API Key**: https://open.bigmodel.cn/

**配置示例**:

```env
LLM_PROVIDER=zhipu
LLM_API_KEY=your-api-key
LLM_MODEL=glm-4-flash
```

**常用模型**: `glm-4`、`glm-4-flash`、`glm-4-air`、`codegeex-4` 等

---

### 月之暗面 Kimi

Kimi 以长文本处理能力著称，适合分析大型代码文件。

**获取 API Key**: https://platform.moonshot.cn/

**配置示例**:

```env
LLM_PROVIDER=moonshot
LLM_API_KEY=sk-your-api-key
LLM_MODEL=moonshot-v1-8k
```

**常用模型**: `moonshot-v1-8k`、`moonshot-v1-32k`、`moonshot-v1-128k`、`kimi-*` 等

---

### 百度文心一言

百度的企业级大模型服务，适合企业用户。

**获取 API Key**: https://console.bce.baidu.com/qianfan/

**⚠️ 特殊配置**: 百度需要同时提供 API Key 和 Secret Key，用冒号分隔：

```env
LLM_PROVIDER=baidu
LLM_API_KEY=your_api_key:your_secret_key
LLM_MODEL=ernie-bot-4
```

**常用模型**: `ernie-bot-4`、`ernie-bot-turbo`、`ernie-bot` 等

---

### MiniMax

MiniMax 提供多模态能力，支持文本、语音等多种输入。

**获取 API Key**: https://www.minimaxi.com/

**配置示例**:

```env
LLM_PROVIDER=minimax
LLM_API_KEY=your-api-key
LLM_MODEL=abab6.5-chat
```

---

### 字节豆包

字节跳动的大模型服务，性价比高。

**获取 API Key**: https://console.volcengine.com/ark

**配置示例**:

```env
LLM_PROVIDER=doubao
LLM_API_KEY=your-api-key
LLM_MODEL=doubao-pro-4k
```

---

## 本地部署

### Ollama

Ollama 支持在本地运行开源大模型，完全本地化，隐私安全，适合处理敏感代码。

**安装 Ollama**:

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# 访问 https://ollama.com/download 下载安装包
```

**拉取模型**:

```bash
# 通用模型
ollama pull llama3
ollama pull qwen2.5

# 代码专用模型
ollama pull codellama
ollama pull deepseek-coder
ollama pull qwen2.5-coder
```

**配置示例**:

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3
LLM_BASE_URL=http://localhost:11434/v1
```

**推荐模型**:

| 模型 | 特点 |
|------|------|
| `llama3` / `llama3.1` / `llama3.2` | Meta 开源，综合能力强 |
| `qwen2.5` / `qwen2.5-coder` | 阿里开源，中文支持好 |
| `codellama` | Meta 代码专用模型 |
| `deepseek-coder` / `deepseek-coder-v2` | DeepSeek 代码模型 |
| `mistral` / `mixtral` | Mistral AI 开源模型 |

**硬件要求**:

| 模型参数 | 最低内存 | 推荐内存 |
|---------|---------|---------|
| 7B | 8GB | 16GB |
| 13B | 16GB | 32GB |
| 70B | 64GB | 128GB |

> 💡 访问 [Ollama 模型库](https://ollama.com/library) 查看所有可用模型。

---

## API 中转站

如果直接访问国际平台有困难，可以使用 API 中转站。

**配置方式**:

```env
LLM_PROVIDER=openai
LLM_API_KEY=中转站提供的Key
LLM_BASE_URL=https://your-proxy.com/v1
LLM_MODEL=gpt-4o-mini
```

**常见中转站**:

| 中转站 | 特点 |
|--------|------|
| [OpenRouter](https://openrouter.ai/) | 支持多种模型，统一接口 |
| [API2D](https://api2d.com/) | 国内访问友好 |
| [CloseAI](https://www.closeai-asia.com/) | 价格实惠 |

---

## 选择建议

### 按场景选择

| 场景 | 推荐 | 原因 |
|------|------|------|
| 日常使用 | OpenAI / 通义千问 / DeepSeek | 性价比高，稳定 |
| 深度分析 | Claude / GPT-4o | 代码理解能力最强 |
| 敏感代码 | Ollama 本地模型 | 完全本地化，隐私安全 |
| 预算有限 | DeepSeek / 智谱 GLM-4-Flash | 价格极低或有免费配额 |
| 长文件分析 | Kimi / Gemini | 支持长上下文 |

### 按预算选择

| 预算 | 推荐方案 |
|------|---------|
| 免费 | Gemini (免费配额) / 智谱 GLM-4-Flash / Ollama |
| 低预算 | DeepSeek / 通义千问 Turbo |
| 中等预算 | GPT-4o-mini / Claude Haiku |
| 高预算 | GPT-4o / Claude Sonnet |

---

## 更多资源

- [配置说明](CONFIGURATION.md) - 详细的配置参数说明
- [部署指南](DEPLOYMENT.md) - 部署相关说明
- [常见问题](FAQ.md) - LLM 相关问题解答
