/**
 * LLM适配器基类
 */

import type { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLMProvider } from './types';
import { LLMError, DEFAULT_LLM_CONFIG } from './types';

export abstract class BaseLLMAdapter implements ILLMAdapter {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      ...DEFAULT_LLM_CONFIG,
      ...config,
    };
  }

  abstract complete(request: LLMRequest): Promise<LLMResponse>;

  getProvider(): LLMProvider {
    return this.config.provider;
  }

  getModel(): string {
    return this.config.model;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      throw new LLMError(
        'API Key未配置',
        this.config.provider
      );
    }
    return true;
  }

  /**
   * 处理超时
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = this.config.timeout || 150000
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new LLMError(
          `请求超时 (${timeoutMs}ms)`,
          this.config.provider
        )), timeoutMs)
      ),
    ]);
  }

  /**
   * 处理API错误
   */
  protected handleError(error: any, context?: string): never {
    let message = error.message || error;
    
    // 针对不同错误类型提供更详细的信息
    if (error.name === 'AbortError' || message.includes('超时')) {
      message = `请求超时 (${this.config.timeout}ms)。建议：\n` +
        `1. 检查网络连接是否正常\n` +
        `2. 尝试增加超时时间（在.env中设置 VITE_LLM_TIMEOUT）\n` +
        `3. 验证API端点是否正确`;
    } else if (error.statusCode === 401 || error.statusCode === 403) {
      message = `API认证失败。建议：\n` +
        `1. 检查API Key是否正确配置\n` +
        `2. 确认API Key是否有效且未过期\n` +
        `3. 验证API Key权限是否充足`;
    } else if (error.statusCode === 429) {
      message = `API调用频率超限。建议：\n` +
        `1. 等待一段时间后重试\n` +
        `2. 降低并发数（VITE_LLM_CONCURRENCY）\n` +
        `3. 增加请求间隔（VITE_LLM_GAP_MS）`;
    } else if (error.statusCode >= 500) {
      message = `API服务异常 (${error.statusCode})。建议：\n` +
        `1. 稍后重试\n` +
        `2. 检查服务商状态页面\n` +
        `3. 尝试切换其他LLM提供商`;
    }

    const fullMessage = context ? `${context}: ${message}` : message;

    throw new LLMError(
      fullMessage,
      this.config.provider,
      error.statusCode || error.status,
      error
    );
  }

  /**
   * 重试逻辑
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // 如果是4xx错误（客户端错误），不重试
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // 最后一次尝试时不等待
        if (attempt < maxAttempts - 1) {
          // 指数退避
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 构建请求头
   */
  protected buildHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
  }
}

