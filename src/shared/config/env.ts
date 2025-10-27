// 从 localStorage 读取运行时配置
const STORAGE_KEY = 'xcodereviewer_runtime_config';
const getRuntimeConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const runtimeConfig = getRuntimeConfig();

// 环境变量配置（支持运行时配置覆盖）
export const env = {
  // ==================== LLM 通用配置 ====================
  // 当前使用的LLM提供商 (gemini|openai|claude|qwen|deepseek|zhipu|moonshot|baidu|minimax|doubao|ollama)
  LLM_PROVIDER: runtimeConfig?.llmProvider || import.meta.env.VITE_LLM_PROVIDER || 'gemini',
  // LLM API Key
  LLM_API_KEY: runtimeConfig?.llmApiKey || import.meta.env.VITE_LLM_API_KEY || '',
  // LLM 模型名称
  LLM_MODEL: runtimeConfig?.llmModel || import.meta.env.VITE_LLM_MODEL || '',
  // LLM API 基础URL (可选，用于自定义端点或代理)
  LLM_BASE_URL: runtimeConfig?.llmBaseUrl || import.meta.env.VITE_LLM_BASE_URL || '',
  // LLM 请求超时时间(ms)
  LLM_TIMEOUT: runtimeConfig?.llmTimeout || Number(import.meta.env.VITE_LLM_TIMEOUT) || 150000,
  // LLM 温度参数 (0.0-2.0)
  LLM_TEMPERATURE: runtimeConfig?.llmTemperature !== undefined ? runtimeConfig.llmTemperature : (Number(import.meta.env.VITE_LLM_TEMPERATURE) || 0.2),
  // LLM 最大token数
  LLM_MAX_TOKENS: runtimeConfig?.llmMaxTokens || Number(import.meta.env.VITE_LLM_MAX_TOKENS) || 4096,
  // LLM 自定义请求头 (JSON字符串格式)
  LLM_CUSTOM_HEADERS: runtimeConfig?.llmCustomHeaders || import.meta.env.VITE_LLM_CUSTOM_HEADERS || '',

  // ==================== Gemini AI 配置 (兼容旧配置) ====================
  GEMINI_API_KEY: runtimeConfig?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
  GEMINI_MODEL: import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash',
  GEMINI_TIMEOUT_MS: Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS) || 25000,

  // ==================== OpenAI 配置 ====================
  OPENAI_API_KEY: runtimeConfig?.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY || '',
  OPENAI_MODEL: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
  OPENAI_BASE_URL: import.meta.env.VITE_OPENAI_BASE_URL || '',

  // ==================== Claude 配置 ====================
  CLAUDE_API_KEY: runtimeConfig?.claudeApiKey || import.meta.env.VITE_CLAUDE_API_KEY || '',
  CLAUDE_MODEL: import.meta.env.VITE_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',

  // ==================== 通义千问 配置 ====================
  QWEN_API_KEY: runtimeConfig?.qwenApiKey || import.meta.env.VITE_QWEN_API_KEY || '',
  QWEN_MODEL: import.meta.env.VITE_QWEN_MODEL || 'qwen-turbo',

  // ==================== DeepSeek 配置 ====================
  DEEPSEEK_API_KEY: runtimeConfig?.deepseekApiKey || import.meta.env.VITE_DEEPSEEK_API_KEY || '',
  DEEPSEEK_MODEL: import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat',

  // ==================== 智谱AI 配置 ====================
  ZHIPU_API_KEY: runtimeConfig?.zhipuApiKey || import.meta.env.VITE_ZHIPU_API_KEY || '',
  ZHIPU_MODEL: import.meta.env.VITE_ZHIPU_MODEL || 'glm-4-flash',

  // ==================== Moonshot 配置 ====================
  MOONSHOT_API_KEY: runtimeConfig?.moonshotApiKey || import.meta.env.VITE_MOONSHOT_API_KEY || '',
  MOONSHOT_MODEL: import.meta.env.VITE_MOONSHOT_MODEL || 'moonshot-v1-8k',

  // ==================== 百度文心一言 配置 ====================
  BAIDU_API_KEY: runtimeConfig?.baiduApiKey || import.meta.env.VITE_BAIDU_API_KEY || '',
  BAIDU_MODEL: import.meta.env.VITE_BAIDU_MODEL || 'ERNIE-3.5-8K',

  // ==================== MiniMax 配置 ====================
  MINIMAX_API_KEY: runtimeConfig?.minimaxApiKey || import.meta.env.VITE_MINIMAX_API_KEY || '',
  MINIMAX_MODEL: import.meta.env.VITE_MINIMAX_MODEL || 'abab6.5-chat',

  // ==================== 豆包 配置 ====================
  DOUBAO_API_KEY: runtimeConfig?.doubaoApiKey || import.meta.env.VITE_DOUBAO_API_KEY || '',
  DOUBAO_MODEL: import.meta.env.VITE_DOUBAO_MODEL || 'doubao-pro-32k',

  // ==================== Ollama 本地模型配置 ====================
  OLLAMA_API_KEY: import.meta.env.VITE_OLLAMA_API_KEY || 'ollama',
  OLLAMA_MODEL: import.meta.env.VITE_OLLAMA_MODEL || 'llama3',
  OLLAMA_BASE_URL: runtimeConfig?.ollamaBaseUrl || import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434/v1',

  // ==================== Supabase 配置 ====================
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // ==================== GitHub 配置 ====================
  GITHUB_TOKEN: runtimeConfig?.githubToken || import.meta.env.VITE_GITHUB_TOKEN || '',

  // ==================== GitLab 配置 ====================
  GITLAB_TOKEN: runtimeConfig?.gitlabToken || import.meta.env.VITE_GITLAB_TOKEN || '',

  // ==================== 应用配置 ====================
  APP_ID: import.meta.env.VITE_APP_ID || 'xcodereviewer',

  // ==================== 分析配置 ====================
  MAX_ANALYZE_FILES: runtimeConfig?.maxAnalyzeFiles || Number(import.meta.env.VITE_MAX_ANALYZE_FILES) || 40,
  LLM_CONCURRENCY: runtimeConfig?.llmConcurrency || Number(import.meta.env.VITE_LLM_CONCURRENCY) || 2,
  LLM_GAP_MS: runtimeConfig?.llmGapMs || Number(import.meta.env.VITE_LLM_GAP_MS) || 500,
  
  // ==================== 语言配置 ====================
  OUTPUT_LANGUAGE: runtimeConfig?.outputLanguage || import.meta.env.VITE_OUTPUT_LANGUAGE || 'zh-CN', // zh-CN | en-US

  // ==================== 开发环境标识 ====================
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

/**
 * 获取当前配置的LLM服务的API Key
 */
export function getCurrentLLMApiKey(): string {
  const provider = env.LLM_PROVIDER.toLowerCase();
  
  // 优先使用通用配置
  if (env.LLM_API_KEY) {
    return env.LLM_API_KEY;
  }

  // 根据provider获取对应的API Key
  const providerKeyMap: Record<string, string> = {
    gemini: env.GEMINI_API_KEY,
    openai: env.OPENAI_API_KEY,
    claude: env.CLAUDE_API_KEY,
    qwen: env.QWEN_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    zhipu: env.ZHIPU_API_KEY,
    moonshot: env.MOONSHOT_API_KEY,
    baidu: env.BAIDU_API_KEY,
    minimax: env.MINIMAX_API_KEY,
    doubao: env.DOUBAO_API_KEY,
    ollama: env.OLLAMA_API_KEY,
  };

  return providerKeyMap[provider] || '';
}

/**
 * 获取当前配置的LLM模型
 */
export function getCurrentLLMModel(): string {
  const provider = env.LLM_PROVIDER.toLowerCase();
  
  // 优先使用通用配置
  if (env.LLM_MODEL) {
    return env.LLM_MODEL;
  }

  // 根据provider获取对应的模型
  const providerModelMap: Record<string, string> = {
    gemini: env.GEMINI_MODEL,
    openai: env.OPENAI_MODEL,
    claude: env.CLAUDE_MODEL,
    qwen: env.QWEN_MODEL,
    deepseek: env.DEEPSEEK_MODEL,
    zhipu: env.ZHIPU_MODEL,
    moonshot: env.MOONSHOT_MODEL,
    baidu: env.BAIDU_MODEL,
    minimax: env.MINIMAX_MODEL,
    doubao: env.DOUBAO_MODEL,
    ollama: env.OLLAMA_MODEL,
  };

  return providerModelMap[provider] || '';
}

// 验证必需的环境变量
export function validateEnv() {
  const apiKey = getCurrentLLMApiKey();
  
  if (!apiKey) {
    console.warn(`未配置 ${env.LLM_PROVIDER} 的API Key，请在环境变量中配置`);
    return false;
  }
  
  return true;
}