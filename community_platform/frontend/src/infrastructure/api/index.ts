/**
 * API 基础设施模块导出
 * @module infrastructure/api
 */

// 导出类型
export type {
  ApiResponse,
  PaginatedResponse,
  ApiClientConfig,
  RequestConfig,
  RetryConfig,
  CacheConfig,
  RequestCanceler,
  UploadProgressCallback,
  DownloadProgressCallback,
} from './types';

export { ApiError } from './types';

// 导出 API Client
export { ApiClient, createApiClient, apiClient } from './client';

// 导出管理器
export { CacheManager, createCacheInterceptors } from './cache';
export { RetryManager, createRetryInterceptor } from './retry';
export { ErrorHandler, errorHandlerMiddleware } from './error-handler';

// 导出拦截器
export {
  authRequestInterceptor,
  requestIdInterceptor,
  timestampInterceptor,
  localeInterceptor,
  loggingRequestInterceptor,
  transformResponseInterceptor,
  loggingResponseInterceptor,
  performanceInterceptor,
  installDefaultInterceptors,
} from './interceptors';

// 导出认证拦截器
export {
  authRequestInterceptor as authTokenInterceptor,
  authResponseInterceptor,
  createAuthInterceptors,
} from './auth.interceptor';

