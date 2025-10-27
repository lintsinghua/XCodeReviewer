/**
 * OpenAI适配器 (支持GPT系列)
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class OpenAIAdapter extends BaseLLMAdapter {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.validateConfig();

      return await this.retry(async () => {
        return await this.withTimeout(this._sendRequest(request));
      });
    } catch (error) {
      this.handleError(error, 'OpenAI API调用失败');
    }
  }

  private async _sendRequest(request: LLMRequest): Promise<LLMResponse> {
    // 构建请求头
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    // 合并自定义请求头
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    // 检测是否为推理模型（GPT-5 或 o1 系列，但排除 gpt-5-chat 等非推理模型）
    const modelName = this.config.model.toLowerCase();
    const isReasoningModel = (modelName.includes('o1') || modelName.includes('o3')) || 
                             (modelName.includes('gpt-5') && !modelName.includes('chat'));

    // 构建请求体
    const requestBody: any = {
      model: this.config.model,
      messages: request.messages,
      temperature: request.temperature ?? this.config.temperature,
      top_p: request.topP ?? this.config.topP,
      frequency_penalty: this.config.frequencyPenalty,
      presence_penalty: this.config.presencePenalty,
    };

    // GPT-5 推理模型使用 max_completion_tokens，其他模型使用 max_tokens
    if (isReasoningModel) {
      requestBody.max_completion_tokens = request.maxTokens ?? this.config.maxTokens;
    } else {
      requestBody.max_tokens = request.maxTokens ?? this.config.maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(headers),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('API响应格式异常: 缺少choices字段');
    }

    return {
      content: choice.message?.content || '',
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      finishReason: choice.finish_reason,
    };
  }

  async validateConfig(): Promise<boolean> {
    await super.validateConfig();
    
    if (!this.config.model) {
      throw new Error('未指定OpenAI模型');
    }
    
    return true;
  }
}

