/**
 * LLM服务类型定义
 */

// 支持的LLM提供商类型
export type LLMProvider = 
  | 'gemini'      // Google Gemini
  | 'openai'      // OpenAI (GPT系列)
  | 'claude'      // Anthropic Claude
  | 'qwen'        // 阿里云通义千问
  | 'deepseek'    // DeepSeek
  | 'zhipu'       // 智谱AI (GLM系列)
  | 'moonshot'    // 月之暗面 Kimi
  | 'baidu'       // 百度文心一言
  | 'minimax'     // MiniMax
  | 'doubao';     // 字节豆包

// LLM配置接口
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;          // 自定义API端点
  timeout?: number;          // 超时时间(ms)
  temperature?: number;      // 温度参数
  maxTokens?: number;        // 最大token数
  topP?: number;            // Top-p采样
  frequencyPenalty?: number; // 频率惩罚
  presencePenalty?: number;  // 存在惩罚
}

// LLM请求消息
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// LLM请求参数
export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

// LLM响应
export interface LLMResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

// LLM适配器接口
export interface ILLMAdapter {
  /**
   * 发送请求并获取响应
   */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * 流式响应（可选）
   */
  streamComplete?(request: LLMRequest): AsyncGenerator<string, void, unknown>;

  /**
   * 获取提供商名称
   */
  getProvider(): LLMProvider;

  /**
   * 获取模型名称
   */
  getModel(): string;

  /**
   * 验证配置是否有效
   */
  validateConfig(): Promise<boolean>;
}

// 错误类型
export class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// 默认配置
export const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
  timeout: 150000,
  temperature: 0.2,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

// 各平台默认模型
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
  qwen: 'qwen-turbo',
  deepseek: 'deepseek-chat',
  zhipu: 'glm-4-flash',
  moonshot: 'moonshot-v1-8k',
  baidu: 'ERNIE-3.5-8K',
  minimax: 'abab6.5-chat',
  doubao: 'doubao-pro-32k',
};

// 各平台API端点
export const DEFAULT_BASE_URLS: Partial<Record<LLMProvider, string>> = {
  openai: 'https://api.openai.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/api/v1',
  deepseek: 'https://api.deepseek.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  moonshot: 'https://api.moonshot.cn/v1',
  baidu: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
  minimax: 'https://api.minimax.chat/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
};

