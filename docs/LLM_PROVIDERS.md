# LLM 平台支持

XCodeReviewer 支持 10+ 主流 LLM 平台，可根据需求自由选择。

## 支持的平台

| 平台类型 | 平台名称 | 特点 | 获取地址 |
|---------|---------|------|---------|
| **国际平台** | Google Gemini | 免费配额充足，推荐 | [获取](https://makersuite.google.com/app/apikey) |
| | OpenAI GPT | 稳定可靠，性能最佳 | [获取](https://platform.openai.com/api-keys) |
| | Anthropic Claude | 代码理解能力强 | [获取](https://console.anthropic.com/) |
| | DeepSeek | 性价比高 | [获取](https://platform.deepseek.com/) |
| **国内平台** | 阿里云通义千问 | 国内访问快 | [获取](https://dashscope.console.aliyun.com/) |
| | 智谱AI (GLM) | 中文支持好 | [获取](https://open.bigmodel.cn/) |
| | 月之暗面 Kimi | 长文本处理 | [获取](https://platform.moonshot.cn/) |
| | 百度文心一言 | 企业级服务 | [获取](https://console.bce.baidu.com/qianfan/) |
| | MiniMax | 多模态能力 | [获取](https://www.minimaxi.com/) |
| | 字节豆包 | 高性价比 | [获取](https://console.volcengine.com/ark) |
| **本地部署** | Ollama | 完全本地化，隐私安全 | [安装](https://ollama.com/) |

## 配置示例

### OpenAI

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini
```

### Google Gemini

```env
LLM_PROVIDER=gemini
LLM_API_KEY=your-api-key
LLM_MODEL=gemini-pro
```

### 通义千问

```env
LLM_PROVIDER=qwen
LLM_API_KEY=your-api-key
LLM_MODEL=qwen-turbo
```

### DeepSeek

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=your-api-key
LLM_MODEL=deepseek-chat
```

### 百度文心一言

百度需要同时提供 API Key 和 Secret Key，用冒号分隔：

```env
LLM_PROVIDER=baidu
LLM_API_KEY=your_api_key:your_secret_key
LLM_MODEL=ernie-bot-4
```

### Ollama 本地模型

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3
LLM_BASE_URL=http://localhost:11434/v1
```

推荐模型：
- `llama3` - 综合能力强
- `codellama` - 代码专用
- `qwen2.5` - 中文支持好
- `deepseek-coder` - 代码分析

## 使用 API 中转站

```env
LLM_PROVIDER=openai
LLM_API_KEY=中转站提供的Key
LLM_BASE_URL=https://your-proxy.com/v1
LLM_MODEL=gpt-4o-mini
```
