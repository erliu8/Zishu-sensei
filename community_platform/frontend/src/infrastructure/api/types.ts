/**
 * API 基础类型定义
 * @module infrastructure/api/types
 */

import type { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * API 响应包装类型
 */
export interface ApiResponse<T = any> {
  /** 响应代码 */
  code: number;
  /** 响应消息 */
  message: string;
  /** 响应数据 */
  data: T;
  /** 时间戳 */
  timestamp?: number;
  /** 请求追踪ID */
  traceId?: string;
}

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * API 错误类型
 */
export class ApiError extends Error {
  /** 错误代码 */
  code: number;
  /** 错误消息 */
  message: string;
  /** 原始响应 */
  response?: AxiosResponse;
  /** 请求配置 */
  config?: AxiosRequestConfig;
  /** 追踪ID */
  traceId?: string;
  /** 是否可重试 */
  retryable: boolean;

  constructor(
    message: string,
    code: number = 500,
    response?: AxiosResponse,
    config?: AxiosRequestConfig,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.message = message;
    this.response = response;
    this.config = config;
    this.retryable = retryable;
    this.traceId = response?.headers?.['x-trace-id'];
  }
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
  /** 是否使用指数退避 */
  exponentialBackoff: boolean;
  /** 可重试的HTTP状态码 */
  retryableStatusCodes: number[];
  /** 可重试的错误代码 */
  retryableErrorCodes: string[];
  /** 自定义重试条件 */
  shouldRetry?: (error: ApiError) => boolean;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 缓存时间（毫秒） */
  ttl: number;
  /** 缓存键前缀 */
  keyPrefix?: string;
  /** 自定义缓存键生成函数 */
  keyGenerator?: (config: AxiosRequestConfig) => string;
}

/**
 * API Client 配置
 */
export interface ApiClientConfig {
  /** 基础URL */
  baseURL: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 是否携带凭证 */
  withCredentials?: boolean;
  /** 重试配置 */
  retry?: Partial<RetryConfig>;
  /** 缓存配置 */
  cache?: Partial<CacheConfig>;
  /** 自定义拦截器 */
  interceptors?: {
    request?: Array<(config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>>;
    response?: Array<(response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>>;
  };
}

/**
 * 请求取消器
 */
export interface RequestCanceler {
  /** 取消函数 */
  cancel: (reason?: string) => void;
  /** 取消令牌 */
  token: any;
}

/**
 * 上传进度回调
 */
export type UploadProgressCallback = (progressEvent: {
  loaded: number;
  total: number;
  progress: number;
}) => void;

/**
 * 下载进度回调
 */
export type DownloadProgressCallback = (progressEvent: {
  loaded: number;
  total: number;
  progress: number;
}) => void;

/**
 * 请求配置扩展
 */
export interface RequestConfig extends AxiosRequestConfig {
  /** 是否跳过错误处理 */
  skipErrorHandler?: boolean;
  /** 是否跳过认证 */
  skipAuth?: boolean;
  /** 是否启用缓存 */
  cache?: boolean | CacheConfig;
  /** 是否启用重试 */
  retry?: boolean | Partial<RetryConfig>;
  /** 上传进度回调 */
  onUploadProgress?: UploadProgressCallback;
  /** 下载进度回调 */
  onDownloadProgress?: DownloadProgressCallback;
  /** 自定义元数据 */
  metadata?: Record<string, any>;
}

