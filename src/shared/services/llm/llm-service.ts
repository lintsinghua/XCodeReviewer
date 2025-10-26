/**
 * LLM服务 - 统一的LLM调用接口
 */

import type { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse } from './types';
import { LLMFactory } from './llm-factory';
import { env } from '@/shared/config/env';

/**
 * LLM服务类
 */
export class LLMService {
  private adapter: ILLMAdapter;

  constructor(config: LLMConfig) {
    this.adapter = LLMFactory.createAdapter(config);
  }

  /**
   * 发送请求
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    return await this.adapter.complete(request);
  }

  /**
   * 简单的文本补全
   */
  async simpleComplete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: any[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.adapter.complete({ messages });
    return response.content;
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    return await this.adapter.validateConfig();
  }

  /**
   * 获取提供商
   */
  getProvider() {
    return this.adapter.getProvider();
  }

  /**
   * 获取模型
   */
  getModel() {
    return this.adapter.getModel();
  }

  /**
   * 从环境变量创建默认实例
   */
  static createFromEnv(): LLMService {
    const provider = env.LLM_PROVIDER as any || 'gemini';
    const apiKey = env.LLM_API_KEY || env.GEMINI_API_KEY;
    const model = env.LLM_MODEL || env.GEMINI_MODEL;

    if (!apiKey) {
      throw new Error('未配置LLM API Key，请在环境变量中设置');
    }

    // 获取 baseUrl，优先使用通用配置，然后是平台专用配置
    let baseUrl = env.LLM_BASE_URL;
    if (!baseUrl && provider === 'openai') {
      baseUrl = env.OPENAI_BASE_URL;
    } else if (!baseUrl && provider === 'ollama') {
      baseUrl = env.OLLAMA_BASE_URL;
    }

    // 解析自定义请求头
    let customHeaders: Record<string, string> | undefined;
    if (env.LLM_CUSTOM_HEADERS) {
      try {
        customHeaders = JSON.parse(env.LLM_CUSTOM_HEADERS);
      } catch (e) {
        console.warn('Invalid LLM_CUSTOM_HEADERS format, should be JSON string');
      }
    }

    const config: LLMConfig = {
      provider,
      apiKey,
      model,
      baseUrl,
      timeout: env.LLM_TIMEOUT || env.GEMINI_TIMEOUT_MS,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
      customHeaders,
    };

    return new LLMService(config);
  }
}

/**
 * 创建LLM服务实例的便捷函数
 */
export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config);
}

/**
 * 获取默认的LLM服务实例
 */
export function getDefaultLLMService(): LLMService {
  return LLMService.createFromEnv();
}

