/**
 * 百度文心一言适配器
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class BaiduAdapter extends BaseLLMAdapter {
  private baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.validateConfig();
      await this.ensureAccessToken();

      return await this.retry(async () => {
        return await this.withTimeout(this._sendRequest(request));
      });
    } catch (error) {
      this.handleError(error, '文心一言API调用失败');
    }
  }

  private async ensureAccessToken(): Promise<void> {
    // 如果token存在且未过期，直接返回
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return;
    }

    // 文心一言API Key格式为 "API_KEY:SECRET_KEY"
    const [apiKey, secretKey] = this.config.apiKey.split(':');
    if (!apiKey || !secretKey) {
      throw new Error('百度API Key格式错误，应为 "API_KEY:SECRET_KEY"');
    }

    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    
    const response = await fetch(tokenUrl, { method: 'POST' });
    if (!response.ok) {
      throw new Error('获取百度access_token失败');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // 设置过期时间为29天后（百度token有效期30天）
    this.tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000;
  }

  private async _sendRequest(request: LLMRequest): Promise<LLMResponse> {
    const endpoint = this.getModelEndpoint(this.config.model);
    const url = `${this.baseUrl}/wenxinworkshop/chat/${endpoint}?access_token=${this.accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: request.temperature ?? this.config.temperature,
        top_p: request.topP ?? this.config.topP,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.error_msg || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.error_code) {
      throw new Error(`API错误 (${data.error_code}): ${data.error_msg}`);
    }

    return {
      content: data.result || '',
      model: this.config.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      finishReason: 'stop',
    };
  }

  private getModelEndpoint(model: string): string {
    const endpoints: Record<string, string> = {
      'ERNIE-4.0-8K': 'completions_pro',
      'ERNIE-3.5-8K': 'completions',
      'ERNIE-3.5-128K': 'ernie-3.5-128k',
      'ERNIE-Speed-8K': 'ernie_speed',
      'ERNIE-Speed-128K': 'ernie-speed-128k',
      'ERNIE-Lite-8K': 'ernie-lite-8k',
      'ERNIE-Tiny-8K': 'ernie-tiny-8k',
    };

    return endpoints[model] || 'completions';
  }

  async validateConfig(): Promise<boolean> {
    await super.validateConfig();
    
    if (!this.config.apiKey.includes(':')) {
      throw new Error('百度API Key格式错误，应为 "API_KEY:SECRET_KEY"');
    }
    
    return true;
  }
}

