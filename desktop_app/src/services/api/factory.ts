/**
 * API 服务工厂
 * 
 * 提供统一的 API 服务访问入口，包括：
 * - 所有 API 服务的创建和管理
 * - 服务生命周期管理
 * - 服务依赖注入
 * - 配置管理
 */

import { apiClient, ApiClient, ApiConfig } from '../api'
import { createAuthApiService, AuthApiService } from './auth'
import { createUserApiService, UserApiService } from './user'
import { createConversationApiService, ConversationApiService } from './conversation'
import { createWebSocketManager, WebSocketManager, WebSocketConfig } from './websocket'
import { createSyncManager, SyncManager, SyncConfig } from './sync'
import { createVersionManager, VersionManager, VersionManagerConfig } from './version'

// ================================
// 类型定义
// ================================

/**
 * API 服务配置
 */
export interface ApiServicesConfig {
  api?: Partial<ApiConfig>
  websocket?: Partial<WebSocketConfig>
  sync?: Partial<SyncConfig>
  version?: Partial<VersionManagerConfig>
}

/**
 * API 服务集合
 */
export interface ApiServices {
  /** 核心 API 客户端 */
  client: ApiClient
  /** 认证服务 */
  auth: AuthApiService
  /** 用户服务 */
  user: UserApiService
  /** 对话服务 */
  conversation: ConversationApiService
  /** WebSocket 管理器 */
  websocket: WebSocketManager
  /** 同步管理器 */
  sync: SyncManager
  /** 版本管理器 */
  version: VersionManager
}

// ================================
// API 服务工厂类
// ================================

export class ApiServiceFactory {
  private static instance: ApiServiceFactory | null = null
  private services: ApiServices | null = null
  private initialized: boolean = false

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ApiServiceFactory {
    if (!ApiServiceFactory.instance) {
      ApiServiceFactory.instance = new ApiServiceFactory()
    }
    return ApiServiceFactory.instance
  }

  /**
   * 初始化所有服务
   */
  async initialize(config: ApiServicesConfig = {}): Promise<ApiServices> {
    if (this.initialized && this.services) {
      console.log('[ApiServiceFactory] Already initialized, returning existing services')
      return this.services
    }

    console.log('[ApiServiceFactory] Initializing API services...')

    try {
      // 1. 配置核心 API 客户端
      if (config.api) {
        apiClient.updateConfig(config.api)
      }

      // 2. 创建版本管理器并协商版本
      const versionManager = createVersionManager(apiClient, {
        currentVersion: config.version?.currentVersion || 'v1',
        supportedVersions: config.version?.supportedVersions || ['v1'],
        autoNegotiate: config.version?.autoNegotiate !== undefined ? config.version.autoNegotiate : true,
        enableLogging: config.version?.enableLogging !== undefined ? config.version.enableLogging : import.meta.env.DEV,
      })

      if (versionManager.getConfig().autoNegotiate) {
        try {
          await versionManager.negotiateVersion()
        } catch (error) {
          console.warn('[ApiServiceFactory] Version negotiation failed, using default version:', error)
        }
      }

      // 3. 创建认证服务
      const authService = createAuthApiService(apiClient)

      // 4. 创建用户服务
      const userService = createUserApiService(apiClient)

      // 5. 创建对话服务
      const conversationService = createConversationApiService(apiClient)

      // 6. 创建 WebSocket 管理器
      const wsUrl = config.websocket?.url || import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000/ws'
      const websocketManager = createWebSocketManager({
        url: wsUrl,
        autoConnect: config.websocket?.autoConnect !== undefined ? config.websocket.autoConnect : true,
        enableLogging: config.websocket?.enableLogging !== undefined ? config.websocket.enableLogging : import.meta.env.DEV,
        ...config.websocket,
      })

      // 7. 创建同步管理器
      const syncManager = createSyncManager(apiClient, {
        autoSync: config.sync?.autoSync !== undefined ? config.sync.autoSync : true,
        enableLogging: config.sync?.enableLogging !== undefined ? config.sync.enableLogging : import.meta.env.DEV,
        ...config.sync,
      })

      // 8. 组装服务集合
      this.services = {
        client: apiClient,
        auth: authService,
        user: userService,
        conversation: conversationService,
        websocket: websocketManager,
        sync: syncManager,
        version: versionManager,
      }

      this.initialized = true

      console.log('[ApiServiceFactory] API services initialized successfully')

      return this.services
    } catch (error) {
      console.error('[ApiServiceFactory] Failed to initialize API services:', error)
      throw error
    }
  }

  /**
   * 获取服务集合
   */
  getServices(): ApiServices {
    if (!this.services || !this.initialized) {
      throw new Error('API services not initialized. Call initialize() first.')
    }
    return this.services
  }

  /**
   * 获取认证服务
   */
  getAuthService(): AuthApiService {
    return this.getServices().auth
  }

  /**
   * 获取用户服务
   */
  getUserService(): UserApiService {
    return this.getServices().user
  }

  /**
   * 获取对话服务
   */
  getConversationService(): ConversationApiService {
    return this.getServices().conversation
  }

  /**
   * 获取 WebSocket 管理器
   */
  getWebSocketManager(): WebSocketManager {
    return this.getServices().websocket
  }

  /**
   * 获取同步管理器
   */
  getSyncManager(): SyncManager {
    return this.getServices().sync
  }

  /**
   * 获取版本管理器
   */
  getVersionManager(): VersionManager {
    return this.getServices().version
  }

  /**
   * 获取 API 客户端
   */
  getApiClient(): ApiClient {
    return this.getServices().client
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 销毁所有服务
   */
  destroy(): void {
    if (!this.services) {
      return
    }

    console.log('[ApiServiceFactory] Destroying API services...')

    try {
      // 停止 WebSocket 连接
      this.services.websocket.destroy()

      // 停止同步管理器
      this.services.sync.destroy()

      // 停止认证服务的自动刷新
      this.services.auth.destroy()

      // 取消所有挂起的请求
      this.services.client.cancelAllRequests()

      // 清空服务引用
      this.services = null
      this.initialized = false

      console.log('[ApiServiceFactory] API services destroyed successfully')
    } catch (error) {
      console.error('[ApiServiceFactory] Error destroying API services:', error)
    }
  }

  /**
   * 重新初始化服务
   */
  async reinitialize(config: ApiServicesConfig = {}): Promise<ApiServices> {
    this.destroy()
    return this.initialize(config)
  }
}

// ================================
// 便捷导出
// ================================

/**
 * 获取 API 服务工厂实例
 */
export function getApiServiceFactory(): ApiServiceFactory {
  return ApiServiceFactory.getInstance()
}

/**
 * 初始化 API 服务
 */
export async function initializeApiServices(config: ApiServicesConfig = {}): Promise<ApiServices> {
  const factory = getApiServiceFactory()
  return factory.initialize(config)
}

/**
 * 获取 API 服务
 */
export function getApiServices(): ApiServices {
  const factory = getApiServiceFactory()
  return factory.getServices()
}

/**
 * 便捷访问各个服务
 */
export const apiServices = {
  /**
   * 获取认证服务
   */
  get auth(): AuthApiService {
    return getApiServiceFactory().getAuthService()
  },

  /**
   * 获取用户服务
   */
  get user(): UserApiService {
    return getApiServiceFactory().getUserService()
  },

  /**
   * 获取对话服务
   */
  get conversation(): ConversationApiService {
    return getApiServiceFactory().getConversationService()
  },

  /**
   * 获取 WebSocket 管理器
   */
  get websocket(): WebSocketManager {
    return getApiServiceFactory().getWebSocketManager()
  },

  /**
   * 获取同步管理器
   */
  get sync(): SyncManager {
    return getApiServiceFactory().getSyncManager()
  },

  /**
   * 获取版本管理器
   */
  get version(): VersionManager {
    return getApiServiceFactory().getVersionManager()
  },

  /**
   * 获取 API 客户端
   */
  get client(): ApiClient {
    return getApiServiceFactory().getApiClient()
  },
}

