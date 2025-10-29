/**
 * API拦截器
 * 自动记录所有API调用和响应
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { logger, LogCategory } from './logger';
import { errorHandler } from './errorHandler';

interface RequestMetadata {
  startTime: number;
  url: string;
  method: string;
}

const requestMetadataMap = new WeakMap<any, RequestMetadata>();

/**
 * 设置Axios拦截器
 */
export function setupAxiosInterceptors(instance: AxiosInstance) {
  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      const metadata: RequestMetadata = {
        startTime: Date.now(),
        url: config.url || '',
        method: (config.method || 'GET').toUpperCase(),
      };
      requestMetadataMap.set(config, metadata);

      logger.debug(
        LogCategory.API_CALL,
        `→ ${metadata.method} ${metadata.url}`,
        {
          method: metadata.method,
          url: metadata.url,
          params: config.params,
          data: config.data,
        }
      );

      return config;
    },
    (error) => {
      logger.error(LogCategory.API_CALL, 'Request interceptor error', { error });
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  instance.interceptors.response.use(
    (response) => {
      const metadata = requestMetadataMap.get(response.config);
      if (metadata) {
        const duration = Date.now() - metadata.startTime;
        
        logger.info(
          LogCategory.API_CALL,
          `← ${metadata.method} ${metadata.url} (${response.status}) - ${duration}ms`,
          {
            method: metadata.method,
            url: metadata.url,
            status: response.status,
            duration,
            data: response.data,
          }
        );

        // 记录性能
        if (duration > 1000) {
          logger.warn(
            LogCategory.PERFORMANCE,
            `Slow API call: ${metadata.method} ${metadata.url} took ${duration}ms`,
            { method: metadata.method, url: metadata.url, duration }
          );
        }
      }

      return response;
    },
    (error: AxiosError) => {
      const metadata = requestMetadataMap.get(error.config);
      if (metadata) {
        const duration = Date.now() - metadata.startTime;
        
        logger.error(
          LogCategory.API_CALL,
          `✗ ${metadata.method} ${metadata.url} - ${duration}ms`,
          {
            method: metadata.method,
            url: metadata.url,
            status: error.response?.status,
            duration,
            error: error.response?.data || error.message,
          },
          error.stack
        );
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * 创建带拦截器的Axios实例
 */
export function createApiClient(config?: AxiosRequestConfig): AxiosInstance {
  const instance = axios.create(config);
  return setupAxiosInterceptors(instance);
}

/**
 * Fetch API包装器
 */
export async function fetchWithLogging(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const method = options?.method || 'GET';
  const startTime = Date.now();

  logger.debug(LogCategory.API_CALL, `→ ${method} ${url}`, {
    method,
    url,
    options,
  });

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    logger.info(
      LogCategory.API_CALL,
      `← ${method} ${url} (${response.status}) - ${duration}ms`,
      {
        method,
        url,
        status: response.status,
        duration,
      }
    );

    if (duration > 1000) {
      logger.warn(
        LogCategory.PERFORMANCE,
        `Slow fetch call: ${method} ${url} took ${duration}ms`,
        { method, url, duration }
      );
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error(
      LogCategory.API_CALL,
      `✗ ${method} ${url} - ${duration}ms`,
      {
        method,
        url,
        duration,
        error,
      }
    );

    throw error;
  }
}

/**
 * 包装异步函数以自动记录错误
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler.handle(error, context);
      throw error;
    }
  }) as T;
}
