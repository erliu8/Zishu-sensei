/**
 * 核心 API 客户端
 * 
 * 提供完整的 RESTful API 封装，包括：
 * - 请求/响应拦截器
 * - 错误处理和重试机制
 * - 请求缓存
 * - 离线队列
 * - API 版本管理
 * - 请求取消
 * - 进度跟踪
 */

import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError,
  InternalAxiosRequestConfig 
} from 'axios'
import { invoke } from '@tauri-apps/api/core'

// ================================
// 类型定义
// ================================

/**
 * API 响应结构
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string | number
  timestamp?: number
}

/**
 * API 错误结构
 */
export interface ApiError {
  message: string
  code?: string | number
  status?: number
  details?: any
  timestamp: number
  requestId?: string
  path?: string
}

/**
 * API 配置
 */
export interface ApiConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
  withCredentials?: boolean
  apiVersion?: string
  retryAttempts?: number
  retryDelay?: number
  enableCache?: boolean
  enableOfflineQueue?: boolean
  enableLogging?: boolean
}

/**
 * 请求配置扩展
 */
export interface RequestConfig extends AxiosRequestConfig {
  /** 是否缓存响应 */
  cache?: boolean
  /** 缓存时间（秒） */
  cacheTTL?: number
  /** 是否跳过拦截器 */
  skipInterceptors?: boolean
  /** 是否重试 */
  retry?: boolean
  /** 重试次数 */
  retryAttempts?: number
  /** 离线时是否入队 */
  offlineQueue?: boolean
  /** 请求优先级 */
  priority?: 'low' | 'normal' | 'high'
  /** 自定义错误处理 */
  customErrorHandler?: (error: ApiError) => void
  /** 上传进度回调 */
  onUploadProgress?: (progress: number) => void
  /** 下载进度回调 */
  onDownloadProgress?: (progress: number) => void
}

/**
 * 缓存项
 */
interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
}

/**
 * 离线队列项
 */
interface OfflineQueueItem {
  id: string
  config: RequestConfig
  timestamp: number
  priority: 'low' | 'normal' | 'high'
  retryCount: number
}

/**
 * 请求拦截器
 */
export type RequestInterceptor = (
  config: InternalAxiosRequestConfig
) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>

/**
 * 响应拦截器
 */
export type ResponseInterceptor = (
  response: AxiosResponse
) => AxiosResponse | Promise<AxiosResponse>

/**
 * 错误拦截器
 */
export type ErrorInterceptor = (error: AxiosError) => Promise<any>

// ================================
// 核心 API 客户端类
// ================================

export class ApiClient {
  private client: AxiosInstance
  private config: Required<ApiConfig>
  private cache: Map<string, CacheEntry> = new Map()
  private offlineQueue: OfflineQueueItem[] = []
  private isOnline: boolean = true
  private requestCancellers: Map<string, AbortController> = new Map()
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []
  private errorInterceptors: ErrorInterceptor[] = []

  constructor(config: ApiConfig) {
    // 合并默认配置
    this.config = {
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: config.headers || {},
      withCredentials: config.withCredentials !== undefined ? config.withCredentials : true,
      apiVersion: config.apiVersion || 'v1',
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      enableCache: config.enableCache !== undefined ? config.enableCache : true,
      enableOfflineQueue: config.enableOfflineQueue !== undefined ? config.enableOfflineQueue : true,
      enableLogging: config.enableLogging !== undefined ? config.enableLogging : true,
    }

    // 创建 axios 实例
    this.client = axios.create({
      baseURL: `${this.config.baseURL}/api/${this.config.apiVersion}`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Client-Platform': 'desktop',
        ...this.config.headers,
      },
      withCredentials: this.config.withCredentials,
    })

    // 设置拦截器
    this.setupInterceptors()

    // 监听网络状态
    this.setupNetworkMonitoring()

    this.log('API Client initialized', this.config)
  }

  // ================================
  // 拦截器设置
  // ================================

  private setupInterceptors(): void {
    // 请求拦截器
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // 应用自定义请求拦截器
        let processedConfig = config
        for (const interceptor of this.requestInterceptors) {
          processedConfig = await interceptor(processedConfig)
        }

        // 添加时间戳
        processedConfig.headers['X-Request-Time'] = Date.now().toString()

        // 添加请求ID
        const requestId = this.generateRequestId()
        processedConfig.headers['X-Request-ID'] = requestId

        // 添加认证令牌（如果存在）
        const token = await this.getAuthToken()
        if (token) {
          processedConfig.headers['Authorization'] = `Bearer ${token}`
        }

        // 添加设备ID
        const deviceId = await this.getDeviceId()
        if (deviceId) {
          processedConfig.headers['X-Device-ID'] = deviceId
        }

        this.log('Request:', {
          method: processedConfig.method?.toUpperCase(),
          url: processedConfig.url,
          requestId,
        })

        return processedConfig
      },
      (error: AxiosError) => {
        this.log('Request interceptor error:', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      async (response: AxiosResponse) => {
        const requestId = response.config.headers['X-Request-ID'] as string
        const requestTime = parseInt(response.config.headers['X-Request-Time'] as string)
        const duration = Date.now() - requestTime

        this.log('Response:', {
          status: response.status,
          requestId,
          duration: `${duration}ms`,
        })

        // 应用自定义响应拦截器
        let processedResponse = response
        for (const interceptor of this.responseInterceptors) {
          processedResponse = await interceptor(processedResponse)
        }

        // 缓存响应（如果启用）
        const config = response.config as any
        if (this.config.enableCache && config.cache) {
          this.cacheResponse(response)
        }

        return processedResponse
      },
      async (error: AxiosError) => {
        // 应用自定义错误拦截器
        for (const interceptor of this.errorInterceptors) {
          try {
            return await interceptor(error)
          } catch (err) {
            // 继续执行下一个拦截器
          }
        }

        return this.handleError(error)
      }
    )
  }

  // ================================
  // HTTP 方法
  // ================================

  /**
   * GET 请求
   */
  async get<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url })
  }

  /**
   * POST 请求
   */
  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data })
  }

  /**
   * PUT 请求
   */
  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data })
  }

  /**
   * PATCH 请求
   */
  async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data })
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url })
  }

  /**
   * 通用请求方法
   */
  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    try {
      // 检查缓存
      if (this.config.enableCache && config.cache && config.method?.toUpperCase() === 'GET') {
        const cached = this.getCachedResponse(config)
        if (cached) {
          this.log('Cache hit:', config.url)
          return cached
        }
      }

      // 检查网络状态
      if (!this.isOnline) {
        if (this.config.enableOfflineQueue && config.offlineQueue !== false) {
          this.log('Offline: adding request to queue')
          return this.addToOfflineQueue(config)
        }
        throw new Error('No network connection')
      }

      // 设置请求取消器
      const controller = new AbortController()
      const requestKey = `${config.method}-${config.url}`
      this.requestCancellers.set(requestKey, controller)

      // 设置进度回调
      if (config.onUploadProgress) {
        config.onUploadProgress = (progressEvent: any) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          config.onUploadProgress!(progress)
        }
      }

      if (config.onDownloadProgress) {
        config.onDownloadProgress = (progressEvent: any) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          config.onDownloadProgress!(progress)
        }
      }

      // 发起请求
      const response = await this.client.request<ApiResponse<T>>({
        ...config,
        signal: controller.signal,
      })

      // 清理取消器
      this.requestCancellers.delete(requestKey)

      // 统一响应格式
      return this.normalizeResponse<T>(response)
    } catch (error) {
      // 清理取消器
      const requestKey = `${config.method}-${config.url}`
      this.requestCancellers.delete(requestKey)

      // 处理错误
      if (axios.isAxiosError(error)) {
        const apiError = this.transformError(error)
        
        // 自定义错误处理
        if (config.customErrorHandler) {
          config.customErrorHandler(apiError)
        }

        // 重试逻辑
        if (config.retry !== false && this.shouldRetry(error)) {
          const retryAttempts = config.retryAttempts || this.config.retryAttempts
          const currentAttempt = (config as any)._retryCount || 0

          if (currentAttempt < retryAttempts) {
            this.log(`Retrying request (${currentAttempt + 1}/${retryAttempts})`)
            await this.delay(this.config.retryDelay * (currentAttempt + 1))
            
            return this.request<T>({
              ...config,
              _retryCount: currentAttempt + 1,
            } as any)
          }
        }

        return {
          success: false,
          error: apiError.message,
          code: apiError.code,
          timestamp: apiError.timestamp,
        }
      }

      throw error
    }
  }

  // ================================
  // 缓存管理
  // ================================

  /**
   * 缓存响应
   */
  private cacheResponse(response: AxiosResponse): void {
    const config = response.config as any
    const cacheKey = this.getCacheKey(config)
    const ttl = (config.cacheTTL || 300) * 1000 // 默认5分钟

    this.cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
      ttl,
    })

    this.log(`Cached response: ${cacheKey}`)
  }

  /**
   * 获取缓存响应
   */
  private getCachedResponse<T>(config: RequestConfig): ApiResponse<T> | null {
    const cacheKey = this.getCacheKey(config)
    const cached = this.cache.get(cacheKey)

    if (!cached) {
      return null
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(cacheKey)
      return null
    }

    return cached.data
  }

  /**
   * 清除缓存
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      this.log('Cache cleared')
      return
    }

    const keys = Array.from(this.cache.keys())
    const regex = new RegExp(pattern)
    
    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    })

    this.log(`Cache cleared for pattern: ${pattern}`)
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(config: RequestConfig): string {
    const { method, url, params } = config
    const paramsStr = params ? JSON.stringify(params) : ''
    return `${method}-${url}-${paramsStr}`
  }

  // ================================
  // 离线队列管理
  // ================================

  /**
   * 添加到离线队列
   */
  private async addToOfflineQueue<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const item: OfflineQueueItem = {
      id: this.generateRequestId(),
      config,
      timestamp: Date.now(),
      priority: config.priority || 'normal',
      retryCount: 0,
    }

    // 按优先级排序插入
    const index = this.offlineQueue.findIndex(
      item => item.priority === 'low' || item.priority === 'normal'
    )
    
    if (config.priority === 'high') {
      this.offlineQueue.unshift(item)
    } else if (index === -1) {
      this.offlineQueue.push(item)
    } else {
      this.offlineQueue.splice(index, 0, item)
    }

    this.log(`Added to offline queue: ${item.id}`)

    // 保存到本地存储
    await this.saveOfflineQueue()

    return {
      success: false,
      error: 'Request queued for offline processing',
      code: 'OFFLINE_QUEUED',
    }
  }

  /**
   * 处理离线队列
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) {
      return
    }

    this.log(`Processing offline queue (${this.offlineQueue.length} items)`)

    const queue = [...this.offlineQueue]
    this.offlineQueue = []

    for (const item of queue) {
      try {
        await this.request(item.config)
        this.log(`Offline request processed: ${item.id}`)
      } catch (error) {
        this.log(`Offline request failed: ${item.id}`, error)
        
        // 重新入队（有限次数）
        if (item.retryCount < 3) {
          item.retryCount++
          this.offlineQueue.push(item)
        }
      }
    }

    // 保存队列状态
    await this.saveOfflineQueue()
  }

  /**
   * 保存离线队列
   */
  private async saveOfflineQueue(): Promise<void> {
    try {
      await invoke('save_offline_queue', {
        queue: JSON.stringify(this.offlineQueue),
      })
    } catch (error) {
      this.log('Failed to save offline queue:', error)
    }
  }

  /**
   * 加载离线队列
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const queueStr = await invoke<string>('load_offline_queue')
      if (queueStr) {
        this.offlineQueue = JSON.parse(queueStr)
        this.log(`Loaded offline queue (${this.offlineQueue.length} items)`)
      }
    } catch (error) {
      this.log('Failed to load offline queue:', error)
    }
  }

  // ================================
  // 请求取消
  // ================================

  /**
   * 取消请求
   */
  cancelRequest(method: string, url: string): void {
    const key = `${method}-${url}`
    const controller = this.requestCancellers.get(key)
    
    if (controller) {
      controller.abort()
      this.requestCancellers.delete(key)
      this.log(`Request cancelled: ${key}`)
    }
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {
    this.requestCancellers.forEach((controller, key) => {
      controller.abort()
      this.log(`Request cancelled: ${key}`)
    })
    this.requestCancellers.clear()
  }

  // ================================
  // 拦截器管理
  // ================================

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor)
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor)
  }

  /**
   * 添加错误拦截器
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor)
  }

  // ================================
  // 网络状态监控
  // ================================

  /**
   * 设置网络监控
   */
  private setupNetworkMonitoring(): void {
    // 初始检查
    this.checkNetworkStatus()

    // 定期检查
    setInterval(() => {
      this.checkNetworkStatus()
    }, 30000) // 每30秒检查一次

    // 监听在线/离线事件
    window.addEventListener('online', () => {
      this.handleOnline()
    })

    window.addEventListener('offline', () => {
      this.handleOffline()
    })
  }

  /**
   * 检查网络状态
   */
  private async checkNetworkStatus(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseURL}/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      })
      
      const wasOffline = !this.isOnline
      this.isOnline = response.ok

      if (wasOffline && this.isOnline) {
        this.handleOnline()
      }
    } catch (error) {
      const wasOnline = this.isOnline
      this.isOnline = false

      if (wasOnline) {
        this.handleOffline()
      }
    }
  }

  /**
   * 处理上线事件
   */
  private handleOnline(): void {
    this.log('Network online')
    this.isOnline = true
    
    // 处理离线队列
    this.processOfflineQueue()
  }

  /**
   * 处理离线事件
   */
  private handleOffline(): void {
    this.log('Network offline')
    this.isOnline = false
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus(): boolean {
    return this.isOnline
  }

  // ================================
  // 错误处理
  // ================================

  /**
   * 处理错误
   */
  private async handleError(error: AxiosError): Promise<any> {
    const apiError = this.transformError(error)
    
    this.log('API Error:', apiError)

    // 特殊错误处理
    if (apiError.status === 401) {
      // 未授权 - 清除令牌并重定向到登录
      await this.handleUnauthorized()
    } else if (apiError.status === 403) {
      // 禁止访问
      await this.handleForbidden()
    } else if (apiError.status === 429) {
      // 请求过多
      await this.handleRateLimited()
    } else if (apiError.status && apiError.status >= 500) {
      // 服务器错误
      await this.handleServerError(apiError)
    }

    return Promise.reject(apiError)
  }

  /**
   * 转换错误
   */
  private transformError(error: AxiosError): ApiError {
    const response = error.response
    const request = error.request
    const config = error.config

    const apiError: ApiError = {
      message: error.message,
      timestamp: Date.now(),
      requestId: config?.headers?.['X-Request-ID'] as string,
      path: config?.url,
    }

    if (response) {
      // 服务器响应错误
      apiError.status = response.status
      apiError.code = (response.data as any)?.code
      apiError.message = (response.data as any)?.error || 
                        (response.data as any)?.message || 
                        response.statusText
      apiError.details = response.data
    } else if (request) {
      // 请求发出但没有响应
      apiError.message = 'No response from server'
      apiError.code = 'NO_RESPONSE'
    } else {
      // 请求设置错误
      apiError.message = error.message
      apiError.code = 'REQUEST_SETUP_ERROR'
    }

    return apiError
  }

  /**
   * 是否应该重试
   */
  private shouldRetry(error: AxiosError): boolean {
    // 不重试的错误代码
    const noRetryStatuses = [400, 401, 403, 404, 422]
    
    if (error.response && noRetryStatuses.includes(error.response.status)) {
      return false
    }

    // 网络错误或5xx错误应该重试
    return !error.response || (error.response.status >= 500 && error.response.status < 600)
  }

  /**
   * 处理未授权
   */
  private async handleUnauthorized(): Promise<void> {
    this.log('Unauthorized - clearing auth token')
    // 实现清除令牌逻辑
    try {
      await invoke('clear_auth_token')
    } catch (error) {
      this.log('Failed to clear auth token:', error)
    }
  }

  /**
   * 处理禁止访问
   */
  private async handleForbidden(): Promise<void> {
    this.log('Forbidden access')
    // 实现禁止访问处理逻辑
  }

  /**
   * 处理速率限制
   */
  private async handleRateLimited(): Promise<void> {
    this.log('Rate limited - backing off')
    // 实现速率限制处理逻辑
  }

  /**
   * 处理服务器错误
   */
  private async handleServerError(error: ApiError): Promise<void> {
    this.log('Server error:', error)
    // 实现服务器错误处理逻辑（如错误上报）
    try {
      await invoke('report_server_error', { error: JSON.stringify(error) })
    } catch (err) {
      this.log('Failed to report server error:', err)
    }
  }

  // ================================
  // 辅助方法
  // ================================

  /**
   * 规范化响应
   */
  private normalizeResponse<T>(response: AxiosResponse<ApiResponse<T>>): ApiResponse<T> {
    const data = response.data

    // 如果已经是标准格式
    if (typeof data === 'object' && 'success' in data) {
      return data
    }

    // 转换为标准格式
    return {
      success: response.status >= 200 && response.status < 300,
      data: data as T,
      timestamp: Date.now(),
    }
  }

  /**
   * 获取认证令牌
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      return await invoke<string>('get_auth_token')
    } catch (error) {
      return null
    }
  }

  /**
   * 获取设备ID
   */
  private async getDeviceId(): Promise<string | null> {
    try {
      return await invoke<string>('get_device_id')
    } catch (error) {
      return null
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 日志记录
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[ApiClient] ${message}`, ...args)
    }
  }

  // ================================
  // 公共API
  // ================================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ApiConfig>): void {
    Object.assign(this.config, config)
    
    if (config.baseURL || config.apiVersion) {
      this.client.defaults.baseURL = `${this.config.baseURL}/api/${this.config.apiVersion}`
    }
    
    if (config.timeout) {
      this.client.defaults.timeout = config.timeout
    }
    
    if (config.headers) {
      Object.assign(this.client.defaults.headers, config.headers)
    }

    this.log('Configuration updated', config)
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<ApiConfig>> {
    return { ...this.config }
  }

  /**
   * 获取 Axios 实例（用于高级用法）
   */
  getAxiosInstance(): AxiosInstance {
    return this.client
  }
}

// ================================
// 默认实例和导出
// ================================

/**
 * 创建默认 API 客户端
 */
export function createApiClient(config: ApiConfig): ApiClient {
  return new ApiClient(config)
}

/**
 * 默认 API 客户端实例
 */
export const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  apiVersion: 'v1',
  timeout: 30000,
  enableCache: true,
  enableOfflineQueue: true,
  enableLogging: import.meta.env.DEV,
})

/**
 * 导出类型
 */
export type {
  ApiConfig,
  ApiResponse,
  ApiError,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
}

