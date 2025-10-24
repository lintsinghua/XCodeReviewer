/**
 * Google Gemini适配器
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class GeminiAdapter extends BaseLLMAdapter {
  private client: GoogleGenerativeAI;

  constructor(config: any) {
    super(config);
    this.client = new GoogleGenerativeAI(this.config.apiKey);
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
    const model = this.client.getGenerativeModel({ 
      model: this.config.model,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
        topP: request.topP ?? this.config.topP,
      }
    });

    // 将消息转换为Gemini格式
    const contents = request.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // 系统消息作为第一条用户消息的前缀
    const systemMessage = request.messages.find(msg => msg.role === 'system');
    if (systemMessage && contents.length > 0) {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    const result = await model.generateContent({
      contents,
      safetySettings: [],
    });

    const response = result.response;
    const text = response.text();

    return {
      content: text,
      model: this.config.model,
      finishReason: 'stop',
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

