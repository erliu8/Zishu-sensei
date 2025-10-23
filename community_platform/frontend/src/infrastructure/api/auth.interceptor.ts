/**
 * API 认证拦截器
 * @module infrastructure/api/auth-interceptor
 */

import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { TokenService } from '@/features/auth/services/token.service';
import { AuthApiClient } from '@/features/auth/api';

/**
 * 请求认证拦截器
 * 在请求头中添加访问令牌
 */
export const authRequestInterceptor = async (
  config: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig> => {
  const accessToken = TokenService.getAccessToken();

  // 如果存在访问令牌，添加到请求头
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
};

/**
 * Token 刷新锁
 * 防止多个请求同时刷新 Token
 */
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * 添加刷新订阅者
 */
function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

/**
 * 通知所有订阅者 Token 已刷新
 */
function onTokenRefreshed(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * 响应认证拦截器
 * 处理 401 错误，自动刷新 Token
 */
export const authResponseInterceptor = async (error: any): Promise<any> => {
  const originalRequest = error.config;

  // 如果是 401 错误且还没有重试过
  if (error.response?.status === 401 && !originalRequest._retry) {
    if (isRefreshing) {
      // 如果正在刷新，等待刷新完成
      return new Promise((resolve) => {
        subscribeTokenRefresh((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(error.config.adapter(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = TokenService.getRefreshToken();

      if (!refreshToken) {
        // 没有刷新令牌，跳转到登录页
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // 刷新访问令牌
      const response = await AuthApiClient.refreshToken(refreshToken);

      // 保存新的访问令牌
      TokenService.saveTokens(
        response.accessToken,
        response.refreshToken,
        response.expiresAt
      );

      // 更新原始请求的认证头
      originalRequest.headers.Authorization = `Bearer ${response.accessToken}`;

      // 通知所有等待的请求
      onTokenRefreshed(response.accessToken);

      // 重试原始请求
      return error.config.adapter(originalRequest);
    } catch (refreshError) {
      // 刷新失败，清除会话并跳转到登录页
      TokenService.clearTokens();

      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }

  // 如果是 403 错误，表示没有权限
  if (error.response?.status === 403) {
    console.error('Access forbidden:', error.response.data);
    
    // 可以在这里处理权限不足的情况
    // 例如显示提示信息或跳转到无权限页面
    if (typeof window !== 'undefined') {
      // 可以显示一个全局提示
      // showNotification('您没有权限访问此资源');
    }
  }

  return Promise.reject(error);
};

/**
 * 创建认证拦截器配置
 */
export function createAuthInterceptors() {
  return {
    request: authRequestInterceptor,
    response: {
      onFulfilled: (response: AxiosResponse) => response,
      onRejected: authResponseInterceptor,
    },
  };
}

