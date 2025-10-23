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
}

/**
 * 创建 API 客户端实例
 */
function createApiClient(config?: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config?.baseURL || process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
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
        const token = localStorage.getItem('auth_token');
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
      return response;
    },
    (error: AxiosError) => {
      // 统一错误处理
      if (error.response) {
        // 服务器返回错误状态码
        switch (error.response.status) {
          case 401:
            // 未授权，跳转登录
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            break;
          case 403:
            // 无权限
            console.error('Access forbidden');
            break;
          case 404:
            // 资源不存在
            console.error('Resource not found');
            break;
          case 500:
            // 服务器错误
            console.error('Server error');
            break;
        }
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error('No response received');
      } else {
        // 请求配置出错
        console.error('Request configuration error');
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
 * 导出类型
 */
export type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
};
