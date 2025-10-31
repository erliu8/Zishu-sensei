/**
 * API Client
 * 基础 API 客户端封装
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * API 客户端配置
 */
interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * 延迟函数
 */
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 判断是否应该重试请求
 */
const shouldRetryRequest = (
  status: number,
  request: AxiosRequestConfig & { _retry?: number },
  maxRetries: number
): boolean => {
  // 已经重试的次数
  const retryCount = request._retry || 0;
  
  // 超过最大重试次数
  if (retryCount >= maxRetries) {
    return false;
  }
  
  // 可重试的状态码
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  return retryableStatusCodes.includes(status);
};

/**
 * 判断网络错误是否应该重试
 */
const shouldRetryNetworkError = (
  request: AxiosRequestConfig & { _retry?: number },
  maxRetries: number
): boolean => {
  // 已经重试的次数
  const retryCount = request._retry || 0;
  
  // 超过最大重试次数
  if (retryCount >= maxRetries) {
    return false;
  }
  
  // 网络错误都可以重试
  return true;
};

/**
 * 创建 API 客户端实例
 */
export function createApiClient(config?: ApiClientConfig): AxiosInstance {
  const retryCount = config?.retryCount ?? 2;
  const retryDelay = config?.retryDelay ?? 1000;
  
  const client = axios.create({
    baseURL: config?.baseURL || process.env['NEXT_PUBLIC_API_URL'] || '/api',
    timeout: config?.timeout || 30000,
    withCredentials: config?.withCredentials ?? true,
      headers: {
        'Content-Type': 'application/json',
    },
  });

  // 请求拦截器
  client.interceptors.request.use(
    (config) => {
      // 添加认证 token
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  client.interceptors.response.use(
    (response) => {
      // 检查响应是否是 JSON
      const contentType = response.headers['content-type'];
      if (contentType && !contentType.includes('application/json')) {
        console.warn(`[API 警告] 期望 JSON 响应但得到了: ${contentType}`);
        console.warn(`[API 警告] URL: ${response.config.url}`);
        console.warn(`[API 警告] 响应数据前200字符:`, typeof response.data === 'string' ? response.data.substring(0, 200) : response.data);
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: number };
      
      // 统一错误处理
      if (error.response) {
        // 服务器返回错误状态码
        const { status, data, config } = error.response;
        const requestUrl = config?.url || '未知';
        const requestMethod = config?.method?.toUpperCase() || '未知';
        const baseURL = config?.baseURL || '未设置';
        const fullUrl = `${baseURL}${requestUrl}`;
        
        // 详细日志
        console.error(`[API 错误详情]`);
        console.error(`  完整 URL: ${fullUrl}`);
        console.error(`  基础 URL: ${baseURL}`);
        console.error(`  请求路径: ${requestUrl}`);
        console.error(`  请求方法: ${requestMethod}`);
        console.error(`  状态码: ${status}`);
        console.error(`  响应数据:`, data);
        console.error(`  请求数据:`, typeof config?.data === 'string' ? config?.data : JSON.stringify(config?.data, null, 2));
        
        // 判断是否需要重试
        const shouldRetry = shouldRetryRequest(status, originalRequest, retryCount);
        
        if (shouldRetry) {
          originalRequest._retry = (originalRequest._retry || 0) + 1;
          const delayTime = retryDelay * Math.pow(2, originalRequest._retry - 1); // 指数退避
          
          console.warn(`[重试 ${originalRequest._retry}/${retryCount}] ${requestMethod} ${requestUrl} - ${delayTime}ms 后重试`);
          
          await delay(delayTime);
          return client(originalRequest);
        }
        
        switch (status) {
          case 401:
            // 未授权，记录错误但不自动跳转
            console.error(`[401 未授权] ${requestMethod} ${requestUrl}`);
            if (typeof window !== 'undefined') {
              // 清除本地存储的认证信息
              localStorage.removeItem('auth_access_token');
              // 让具体的页面组件决定如何处理401错误
            }
            break;
          case 403:
            // 无权限
            console.error(`[403 禁止访问] ${requestMethod} ${requestUrl}`, data);
            break;
          case 404:
            // 资源不存在
            console.error(`[404 资源不存在] ${requestMethod} ${requestUrl}`);
            break;
          case 422:
            // 验证错误
            console.error(`[422 验证失败] ${requestMethod} ${requestUrl}`, data);
            break;
          case 429:
            // 请求过于频繁
            console.error(`[429 请求过于频繁] ${requestMethod} ${requestUrl}`);
            break;
          case 500:
            // 服务器内部错误
            console.error(`[500 服务器内部错误] ${requestMethod} ${requestUrl}`, {
              message: (data as any)?.message || '服务器发生内部错误',
              error: (data as any)?.error,
              timestamp: new Date().toISOString(),
              userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
              retryAttempted: originalRequest._retry || 0
            });
            break;
          case 502:
            // 网关错误
            console.error(`[502 网关错误] ${requestMethod} ${requestUrl} - 服务暂时不可用`);
            break;
          case 503:
            // 服务不可用
            console.error(`[503 服务不可用] ${requestMethod} ${requestUrl} - 服务器维护中`);
            break;
          default:
            console.error(`[${status} 请求错误] ${requestMethod} ${requestUrl}`);
            console.error(`  响应:`, data);
            console.error(`  请求:`, config?.data);
            break;
        }
      } else if (error.request) {
        // 请求已发送但没有收到响应（网络错误）
        console.error('[网络错误详情]');
        console.error('  请求对象:', {
          url: originalRequest.url,
          method: originalRequest.method,
          baseURL: client.defaults.baseURL,
          response: error.request.response ? error.request.response.substring(0, 200) : 'no response',
          responseType: error.request.responseType,
          status: error.request.status,
          statusText: error.request.statusText,
        });
        
        const shouldRetry = shouldRetryNetworkError(originalRequest, retryCount);
        
        if (shouldRetry) {
          originalRequest._retry = (originalRequest._retry || 0) + 1;
          const delayTime = retryDelay * Math.pow(2, originalRequest._retry - 1);
          
          console.warn(`[网络重试 ${originalRequest._retry}/${retryCount}] ${delayTime}ms 后重试`);
          
          await delay(delayTime);
          return client(originalRequest);
        }
        
        const errorDetails = {
          message: '请检查网络连接或稍后重试',
          timeout: error.code === 'ECONNABORTED',
          timestamp: new Date().toISOString(),
          retryAttempted: originalRequest._retry || 0,
          requestUrl: originalRequest.url,
          baseURL: client.defaults.baseURL,
          suggestion: '请确保后端服务器正在运行：npm run dev:backend 或 python manage.py runserver 0.0.0.0:8000'
        };
        
        console.error('[网络错误] 无法连接到服务器', errorDetails);
      } else {
        // 请求配置出错
        console.error('[配置错误] 请求配置有误', {
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * 默认 API 客户端实例
 */
export const apiClient = createApiClient();

/**
 * API Client 类型别名
 */
export type ApiClient = AxiosInstance;

/**
 * 导出类型
 */
export type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  ApiClientConfig,
};
