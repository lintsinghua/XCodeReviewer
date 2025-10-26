/**
 * MiniMax适配器
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class MinimaxAdapter extends BaseLLMAdapter {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.minimax.chat/v1';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.validateConfig();

      return await this.retry(async () => {
        return await this.withTimeout(this._sendRequest(request));
      });
    } catch (error) {
      this.handleError(error, 'MiniMax API调用失败');
    }
  }

  private async _sendRequest(request: LLMRequest): Promise<LLMResponse> {
    // MiniMax API兼容OpenAI格式
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
    if (this.config.customHeaders) Object.assign(headers, this.config.customHeaders);

    const response = await fetch(`${this.baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: this.buildHeaders(headers),
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        top_p: request.topP ?? this.config.topP,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.base_resp?.status_msg || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    
    if (data.base_resp?.status_code !== 0) {
      throw new Error(`API错误 (${data.base_resp?.status_code}): ${data.base_resp?.status_msg}`);
    }

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('API响应格式异常: 缺少choices字段');
    }

    return {
      content: choice.message?.content || '',
      model: this.config.model,
      usage: data.usage ? {
        promptTokens: data.usage.total_tokens || 0,
        completionTokens: 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined,
      finishReason: choice.finish_reason,
    };
  }

  async validateConfig(): Promise<boolean> {
    await super.validateConfig();
    
    if (!this.config.model) {
      throw new Error('未指定MiniMax模型');
    }
    
    return true;
  }
}

