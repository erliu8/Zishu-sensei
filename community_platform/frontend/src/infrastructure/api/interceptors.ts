/**
 * API 请求/响应拦截器
 * @module infrastructure/api/interceptors
 */

import type { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse,
  InternalAxiosRequestConfig 
} from 'axios';
import { ApiError } from './types';

/**
 * 请求拦截器：添加认证令牌
 */
export function authRequestInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  // 跳过认证的请求
  const customConfig = config as any;
  if (customConfig.skipAuth) {
    return config;
  }

  // 从 localStorage 获取令牌
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
}

/**
 * 请求拦截器：添加请求ID
 */
export function requestIdInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  config.headers = config.headers || {};
  config.headers['X-Request-Id'] = generateRequestId();
  return config;
}

/**
 * 请求拦截器：添加时间戳
 */
export function timestampInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  config.headers = config.headers || {};
  config.headers['X-Request-Time'] = Date.now().toString();
  return config;
}

/**
 * 请求拦截器：添加语言标识
 */
export function localeInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  config.headers = config.headers || {};
  
  // 从 localStorage 或浏览器获取语言
  let locale = 'zh-CN';
  if (typeof window !== 'undefined') {
    locale = localStorage.getItem('locale') || navigator.language || 'zh-CN';
  }
  
  config.headers['Accept-Language'] = locale;
  return config;
}

/**
 * 请求拦截器：日志记录
 */
export function loggingRequestInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  if (process.env.NODE_ENV === 'development') {
    console.log('[API Request]', {
      method: config.method?.toUpperCase(),
      url: config.url,
      params: config.params,
      data: config.data,
    });
  }
  return config;
}

/**
 * 响应拦截器：数据转换
 */
export function transformResponseInterceptor(
  response: AxiosResponse
): AxiosResponse {
  // 如果响应包含标准的 API 响应格式，提取 data
  if (response.data && typeof response.data === 'object') {
    if ('code' in response.data && 'data' in response.data) {
      // 检查业务错误码
      if (response.data.code !== 0 && response.data.code !== 200) {
        throw new ApiError(
          response.data.message || 'Request failed',
          response.data.code,
          response,
          response.config,
          false
        );
      }
      // 提取实际数据
      response.data = response.data.data;
    }
  }
  return response;
}

/**
 * 响应拦截器：日志记录
 */
export function loggingResponseInterceptor(
  response: AxiosResponse
): AxiosResponse {
  if (process.env.NODE_ENV === 'development') {
    const duration = calculateDuration(response.config);
    console.log('[API Response]', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      duration: `${duration}ms`,
      data: response.data,
    });
  }
  return response;
}

/**
 * 响应拦截器：性能监控
 */
export function performanceInterceptor(
  response: AxiosResponse
): AxiosResponse {
  const duration = calculateDuration(response.config);
  
  // 记录慢请求（超过3秒）
  if (duration > 3000) {
    console.warn('[API Performance]', {
      url: response.config.url,
      duration: `${duration}ms`,
      message: 'Slow request detected',
    });
  }

  // 可以发送到监控服务
  if (typeof window !== 'undefined' && (window as any).performance) {
    // 发送性能数据到监控服务
    recordPerformanceMetric({
      url: response.config.url || '',
      method: response.config.method || 'unknown',
      duration,
      status: response.status,
    });
  }

  return response;
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 计算请求耗时
 */
function calculateDuration(config: AxiosRequestConfig): number {
  const requestTime = (config.headers as any)?.[' X-Request-Time'];
  if (requestTime) {
    return Date.now() - parseInt(requestTime, 10);
  }
  return 0;
}

/**
 * 记录性能指标
 */
function recordPerformanceMetric(metric: {
  url: string;
  method: string;
  duration: number;
  status: number;
}): void {
  // 这里可以集成到实际的监控服务（如 Sentry, DataDog 等）
  if (process.env.NODE_ENV === 'development') {
    console.debug('[Performance Metric]', metric);
  }
}

/**
 * 安装所有默认拦截器
 */
export function installDefaultInterceptors(axios: AxiosInstance): void {
  // 请求拦截器（按顺序执行）
  axios.interceptors.request.use(authRequestInterceptor);
  axios.interceptors.request.use(requestIdInterceptor);
  axios.interceptors.request.use(timestampInterceptor);
  axios.interceptors.request.use(localeInterceptor);
  axios.interceptors.request.use(loggingRequestInterceptor);

  // 响应拦截器（按顺序执行）
  axios.interceptors.response.use(transformResponseInterceptor);
  axios.interceptors.response.use(loggingResponseInterceptor);
  axios.interceptors.response.use(performanceInterceptor);
}

