/**
 * API 请求重试逻辑
 * @module infrastructure/api/retry
 */

import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ApiError, RetryConfig } from './types';
import { ErrorHandler } from './error-handler';

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND'],
};

/**
 * 重试管理器类
 */
export class RetryManager {
  private config: RetryConfig;
  private retryCountMap: Map<string, number> = new Map();

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * 计算重试延迟
   */
  private calculateDelay(retryCount: number): number {
    if (this.config.exponentialBackoff) {
      // 指数退避: delay * 2^retryCount + 随机抖动
      const exponentialDelay = this.config.retryDelay * Math.pow(2, retryCount);
      const jitter = Math.random() * 1000; // 0-1000ms 随机抖动
      return Math.min(exponentialDelay + jitter, 30000); // 最大30秒
    }
    return this.config.retryDelay;
  }

  /**
   * 生成请求唯一标识
   */
  private generateRequestKey(config: AxiosRequestConfig): string {
    return `${config.method}:${config.url}`;
  }

  /**
   * 获取重试次数
   */
  private getRetryCount(requestKey: string): number {
    return this.retryCountMap.get(requestKey) || 0;
  }

  /**
   * 增加重试次数
   */
  private incrementRetryCount(requestKey: string): void {
    const count = this.getRetryCount(requestKey);
    this.retryCountMap.set(requestKey, count + 1);
  }

  /**
   * 重置重试次数
   */
  private resetRetryCount(requestKey: string): void {
    this.retryCountMap.delete(requestKey);
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(error: ApiError): boolean {
    if (!error.config) {
      return false;
    }

    const requestKey = this.generateRequestKey(error.config);
    const retryCount = this.getRetryCount(requestKey);

    // 超过最大重试次数
    if (retryCount >= this.config.maxRetries) {
      this.resetRetryCount(requestKey);
      return false;
    }

    // 使用自定义重试条件
    if (this.config.shouldRetry) {
      return this.config.shouldRetry(error);
    }

    // 检查错误是否可重试
    return ErrorHandler.isRetryable(error);
  }

  /**
   * 执行重试
   */
  async retry(
    axios: AxiosInstance,
    error: ApiError
  ): Promise<any> {
    if (!error.config) {
      return Promise.reject(error);
    }

    const requestKey = this.generateRequestKey(error.config);
    const retryCount = this.getRetryCount(requestKey);

    // 计算延迟
    const delay = this.calculateDelay(retryCount);

    console.warn(
      `[Retry] Attempt ${retryCount + 1}/${this.config.maxRetries} for ${error.config.method?.toUpperCase()} ${error.config.url} after ${delay}ms`
    );

    // 增加重试计数
    this.incrementRetryCount(requestKey);

    // 延迟后重试
    await this.sleep(delay);

    try {
      const response = await axios.request(error.config);
      // 成功后重置计数
      this.resetRetryCount(requestKey);
      return response;
    } catch (retryError) {
      // 重试失败，继续处理
      throw retryError;
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理重试计数（用于内存管理）
   */
  clearRetryCount(): void {
    this.retryCountMap.clear();
  }
}

/**
 * 创建重试拦截器
 */
export function createRetryInterceptor(
  axios: AxiosInstance,
  config: Partial<RetryConfig> = {}
) {
  const retryManager = new RetryManager(config);

  return async (error: any): Promise<any> => {
    const apiError = error as ApiError;

    // 检查是否应该重试
    if (retryManager.shouldRetry(apiError)) {
      return retryManager.retry(axios, apiError);
    }

    return Promise.reject(error);
  };
}

