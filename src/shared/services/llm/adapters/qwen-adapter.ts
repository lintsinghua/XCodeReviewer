/**
 * 阿里云通义千问适配器
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class QwenAdapter extends BaseLLMAdapter {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.validateConfig();

      return await this.retry(async () => {
        return await this.withTimeout(this._sendRequest(request));
      });
    } catch (error) {
      this.handleError(error, '通义千问API调用失败');
    }
  }

  private async _sendRequest(request: LLMRequest): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-DashScope-SSE': 'disable',
    };
    if (this.config.customHeaders) Object.assign(headers, this.config.customHeaders);

    const response = await fetch(`${this.baseUrl}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: this.buildHeaders(headers),
      body: JSON.stringify({
        model: this.config.model,
        input: {
          messages: request.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        },
        parameters: {
          temperature: request.temperature ?? this.config.temperature,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          top_p: request.topP ?? this.config.topP,
          result_format: 'message',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (data.code && data.code !== '200') {
      throw new Error(`API错误 (${data.code}): ${data.message}`);
    }

    const output = data.output;
    if (!output?.choices?.[0]) {
      throw new Error('API响应格式异常: 缺少output.choices字段');
    }

    const choice = output.choices[0];

    return {
      content: choice.message?.content || '',
      model: this.config.model,
      usage: output.usage ? {
        promptTokens: output.usage.input_tokens,
        completionTokens: output.usage.output_tokens,
        totalTokens: output.usage.total_tokens || 
          (output.usage.input_tokens + output.usage.output_tokens),
      } : undefined,
      finishReason: choice.finish_reason,
    };
  }

  async validateConfig(): Promise<boolean> {
    await super.validateConfig();
    
    if (!this.config.model) {
      throw new Error('未指定通义千问模型');
    }
    
    return true;
  }
}

