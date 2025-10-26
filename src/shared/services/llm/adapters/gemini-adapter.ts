/**
 * Google Gemini适配器 - 支持官方API和中转站
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class GeminiAdapter extends BaseLLMAdapter {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    // 支持自定义baseUrl（中转站）或使用官方API
    this.baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.validateConfig();

      return await this.retry(async () => {
        return await this.withTimeout(this._generateContent(request));
      });
    } catch (error) {
      this.handleError(error, 'Gemini API调用失败');
    }
  }

  private async _generateContent(request: LLMRequest): Promise<LLMResponse> {
    // 转换消息格式为 Gemini 格式
    const contents = request.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // 将系统消息合并到第一条用户消息
    const systemMessage = request.messages.find(msg => msg.role === 'system');
    if (systemMessage && contents.length > 0) {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    // 构建请求体
    const requestBody = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
        topP: request.topP ?? this.config.topP,
      }
    };

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 如果有自定义请求头，合并进去
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    // API Key 可能在 URL 参数或请求头中
    const url = `${this.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(headers),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
        details: error,
      };
    }

    const data = await response.json();
    
    // 解析 Gemini 响应格式
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content) {
      throw new Error('API响应格式异常: 缺少candidates或content字段');
    }

    const text = candidate.content.parts?.map((part: any) => part.text).join('') || '';

    return {
      content: text,
      model: this.config.model,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
      finishReason: candidate.finishReason || 'stop',
    };
  }

  async validateConfig(): Promise<boolean> {
    await super.validateConfig();
    
    if (!this.config.model.startsWith('gemini-')) {
      throw new Error(`无效的Gemini模型: ${this.config.model}`);
    }
    
    return true;
  }
}
