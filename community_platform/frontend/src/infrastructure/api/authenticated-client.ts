/**
 * 带认证的 API Client
 * @module infrastructure/api/authenticated-client
 */

import { ApiClient, createApiClient } from './client';
import type { ApiClientConfig } from './types';
import { authRequestInterceptor, authResponseInterceptor } from './auth.interceptor';

/**
 * 创建带认证的 API Client
 */
export function createAuthenticatedApiClient(
  config?: Partial<ApiClientConfig>
): ApiClient {
  const client = createApiClient({
    ...config,
    ...(config?.interceptors && { interceptors: {
      request: [
        ...(config.interceptors.request || []),
        authRequestInterceptor as any,
      ],
      response: [
        ...(config.interceptors.response || []),
        (response: any) => response,
        authResponseInterceptor as any,
      ],
    }}),
  } as any);

  return client;
}

/**
 * 默认的认证 API Client 实例
 */
export const authenticatedApiClient = createAuthenticatedApiClient();

