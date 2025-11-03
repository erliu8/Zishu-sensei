/**
 * API 错误处理器
 * @module infrastructure/api/error-handler
 */

import type { AxiosError } from 'axios';
import { ApiError } from './types';

/**
 * 错误代码映射
 */
const ERROR_CODE_MAP: Record<number, string> = {
  400: '请求参数错误',
  401: '未授权，请重新登录',
  403: '拒绝访问',
  404: '请求的资源不存在',
  405: '请求方法不允许',
  408: '请求超时',
  409: '数据冲突',
  422: '数据验证失败',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务不可用',
  504: '网关超时',
};

/**
 * 可重试的HTTP状态码
 */
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * 错误处理器类
 */
export class ErrorHandler {
  /**
   * 处理API错误
   */
  static handleError(error: AxiosError): ApiError {
    // 网络错误
    if (!error.response) {
      return this.handleNetworkError(error);
    }

    // HTTP错误
    return this.handleHttpError(error);
  }

  /**
   * 处理网络错误
   */
  private static handleNetworkError(error: AxiosError): ApiError {
    const message = error.code === 'ECONNABORTED' 
      ? '请求超时，请检查网络连接'
      : '网络连接失败，请检查网络设置';

    return new ApiError(
      message,
      0,
      undefined,
      error.config,
      true // 网络错误可重试
    );
  }

  /**
   * 处理HTTP错误
   */
  private static handleHttpError(error: AxiosError): ApiError {
    const { response, config } = error;
    const status = response?.status || 500;
    const data = response?.data as any;

    // 从响应中提取错误信息
    const message = data?.message || 
                   data?.error?.message ||
                   ERROR_CODE_MAP[status] || 
                   '未知错误';

    const code = data?.code || status;
    const retryable = RETRYABLE_STATUS_CODES.includes(status);

    return new ApiError(message, code, response, config, retryable);
  }

  /**
   * 检查错误是否可重试
   */
  static isRetryable(error: ApiError): boolean {
    if (!error.retryable) {
      return false;
    }

    // 401、403 不应重试（认证/授权错误）
    if (error.code === 401 || error.code === 403) {
      return false;
    }

    return true;
  }

  /**
   * 格式化错误消息用于用户显示
   */
  static formatUserMessage(error: ApiError): string {
    // 开发环境显示详细信息
    if (process.env.NODE_ENV === 'development') {
      return `${error.message} (Code: ${error.code}, TraceId: ${error.traceId || 'N/A'})`;
    }

    // 生产环境简化消息
    return error.message;
  }

  /**
   * 格式化错误用于日志记录
   */
  static formatLogMessage(error: ApiError): Record<string, any> {
    return {
      message: error.message,
      code: error.code,
      traceId: error.traceId,
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 根据错误类型执行特定操作
   */
  static handleSpecificError(error: ApiError): void {
    switch (error.code) {
      case 401:
        // 触发登录
        this.handleUnauthorized();
        break;
      case 403:
        // 显示权限不足提示
        this.handleForbidden();
        break;
      case 429:
        // 显示限流提示
        this.handleRateLimited();
        break;
      default:
        // 默认处理
        break;
    }
  }

  /**
   * 处理未授权错误
   */
  private static handleUnauthorized(): void {
    // 清除认证信息
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_access_token');
      // 重定向到登录页（避免循环重定向）
      if (!window.location.pathname.includes('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
  }

  /**
   * 处理禁止访问错误
   */
  private static handleForbidden(): void {
    // 可以显示全局提示
    console.warn('Access forbidden');
  }

  /**
   * 处理限流错误
   */
  private static handleRateLimited(): void {
    // 可以显示全局提示
    console.warn('Rate limited');
  }
}

/**
 * 错误处理中间件
 */
export const errorHandlerMiddleware = (error: AxiosError): Promise<never> => {
  const apiError = ErrorHandler.handleError(error);
  
  // 记录错误
  console.error('[API Error]', ErrorHandler.formatLogMessage(apiError));
  
  // 执行特定错误处理
  ErrorHandler.handleSpecificError(apiError);
  
  return Promise.reject(apiError);
};

