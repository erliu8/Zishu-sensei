/**
 * 认证 API 服务
 * 
 * 提供用户认证相关的 API 接口，包括：
 * - 登录/登出
 * - 注册
 * - Token 管理
 * - OAuth 认证
 * - 双因素认证
 */

import type { ApiClient, ApiResponse } from '../api'
import { invoke } from '@tauri-apps/api/tauri'

// ================================
// 类型定义
// ================================

/**
 * 登录参数
 */
export interface LoginParams {
  username?: string
  email?: string
  password: string
  rememberMe?: boolean
  deviceName?: string
}

/**
 * 注册参数
 */
export interface RegisterParams {
  username: string
  email: string
  password: string
  confirmPassword: string
  agreeToTerms: boolean
  deviceName?: string
}

/**
 * 认证响应
 */
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  user: {
    id: string
    username: string
    email: string
    verified: boolean
  }
}

/**
 * Token 刷新响应
 */
export interface RefreshTokenResponse {
  accessToken: string
  expiresIn: number
  tokenType: string
}

/**
 * OAuth 提供商
 */
export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'apple'

/**
 * OAuth 认证参数
 */
export interface OAuthParams {
  provider: OAuthProvider
  code: string
  redirectUri: string
  state?: string
}

/**
 * 双因素认证设置
 */
export interface TwoFactorSetup {
  secret: string
  qrCode: string
  backupCodes: string[]
}

/**
 * 双因素认证验证参数
 */
export interface TwoFactorVerifyParams {
  code: string
  trustDevice?: boolean
}

// ================================
// 认证 API 服务类
// ================================

export class AuthApiService {
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private apiClient: ApiClient) {
    this.setupAutoRefresh()
  }

  // ================================
  // 基础认证
  // ================================

  /**
   * 登录
   */
  async login(params: LoginParams): Promise<ApiResponse<AuthResponse>> {
    try {
      // 添加设备信息
      const deviceName = params.deviceName || (await this.getDeviceName())
      const deviceId = await this.getDeviceId()

      const response = await this.apiClient.post<AuthResponse>('/auth/login', {
        ...params,
        deviceName,
        deviceId,
      })

      if (response.success && response.data) {
        // 保存 Token
        await this.saveTokens(response.data)
        
        // 设置自动刷新
        this.scheduleTokenRefresh(response.data.expiresIn)
      }

      return response
    } catch (error) {
      console.error('[AuthApiService] Login failed:', error)
      throw error
    }
  }

  /**
   * 注册
   */
  async register(params: RegisterParams): Promise<ApiResponse<AuthResponse>> {
    try {
      // 添加设备信息
      const deviceName = params.deviceName || (await this.getDeviceName())
      const deviceId = await this.getDeviceId()

      const response = await this.apiClient.post<AuthResponse>('/auth/register', {
        ...params,
        deviceName,
        deviceId,
      })

      if (response.success && response.data) {
        // 保存 Token
        await this.saveTokens(response.data)
        
        // 设置自动刷新
        this.scheduleTokenRefresh(response.data.expiresIn)
      }

      return response
    } catch (error) {
      console.error('[AuthApiService] Registration failed:', error)
      throw error
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      const response = await this.apiClient.post<void>('/auth/logout')

      // 清除本地 Token
      await this.clearTokens()
      
      // 停止自动刷新
      this.stopAutoRefresh()

      return response
    } catch (error) {
      console.error('[AuthApiService] Logout failed:', error)
      
      // 即使请求失败，也清除本地 Token
      await this.clearTokens()
      this.stopAutoRefresh()
      
      throw error
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(): Promise<ApiResponse<RefreshTokenResponse>> {
    try {
      const refreshToken = await invoke<string>('get_refresh_token')

      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await this.apiClient.post<RefreshTokenResponse>(
        '/auth/refresh',
        { refreshToken },
        {
          skipInterceptors: true, // 跳过拦截器避免循环刷新
        }
      )

      if (response.success && response.data) {
        // 更新 Access Token
        await invoke('save_auth_token', { token: response.data.accessToken })
        
        // 重新调度刷新
        this.scheduleTokenRefresh(response.data.expiresIn)
      }

      return response
    } catch (error) {
      console.error('[AuthApiService] Token refresh failed:', error)
      
      // Token 刷新失败，清除所有认证信息
      await this.clearTokens()
      this.stopAutoRefresh()
      
      throw error
    }
  }

  // ================================
  // OAuth 认证
  // ================================

  /**
   * 获取 OAuth 授权 URL
   */
  async getOAuthUrl(provider: OAuthProvider, redirectUri: string): Promise<ApiResponse<{
    url: string
    state: string
  }>> {
    return this.apiClient.get(`/auth/oauth/${provider}/url`, {
      params: { redirectUri },
    })
  }

  /**
   * OAuth 登录
   */
  async oauthLogin(params: OAuthParams): Promise<ApiResponse<AuthResponse>> {
    try {
      const deviceName = await this.getDeviceName()
      const deviceId = await this.getDeviceId()

      const response = await this.apiClient.post<AuthResponse>(
        `/auth/oauth/${params.provider}/callback`,
        {
          code: params.code,
          redirectUri: params.redirectUri,
          state: params.state,
          deviceName,
          deviceId,
        }
      )

      if (response.success && response.data) {
        await this.saveTokens(response.data)
        this.scheduleTokenRefresh(response.data.expiresIn)
      }

      return response
    } catch (error) {
      console.error('[AuthApiService] OAuth login failed:', error)
      throw error
    }
  }

  /**
   * 关联 OAuth 账号
   */
  async linkOAuthAccount(params: OAuthParams): Promise<ApiResponse<void>> {
    return this.apiClient.post(`/auth/oauth/${params.provider}/link`, {
      code: params.code,
      redirectUri: params.redirectUri,
      state: params.state,
    })
  }

  /**
   * 取消关联 OAuth 账号
   */
  async unlinkOAuthAccount(provider: OAuthProvider): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/auth/oauth/${provider}/unlink`)
  }

  // ================================
  // 双因素认证
  // ================================

  /**
   * 设置双因素认证
   */
  async setupTwoFactor(): Promise<ApiResponse<TwoFactorSetup>> {
    return this.apiClient.post<TwoFactorSetup>('/auth/2fa/setup')
  }

  /**
   * 启用双因素认证
   */
  async enableTwoFactor(code: string): Promise<ApiResponse<{ backupCodes: string[] }>> {
    return this.apiClient.post('/auth/2fa/enable', { code })
  }

  /**
   * 禁用双因素认证
   */
  async disableTwoFactor(password: string, code?: string): Promise<ApiResponse<void>> {
    return this.apiClient.post('/auth/2fa/disable', { password, code })
  }

  /**
   * 验证双因素认证
   */
  async verifyTwoFactor(params: TwoFactorVerifyParams): Promise<ApiResponse<AuthResponse>> {
    try {
      const response = await this.apiClient.post<AuthResponse>('/auth/2fa/verify', params)

      if (response.success && response.data) {
        await this.saveTokens(response.data)
        this.scheduleTokenRefresh(response.data.expiresIn)
      }

      return response
    } catch (error) {
      console.error('[AuthApiService] 2FA verification failed:', error)
      throw error
    }
  }

  /**
   * 重新生成备份码
   */
  async regenerateBackupCodes(password: string): Promise<ApiResponse<{ backupCodes: string[] }>> {
    return this.apiClient.post('/auth/2fa/backup-codes', { password })
  }

  // ================================
  // Token 管理
  // ================================

  /**
   * 验证 Token
   */
  async validateToken(): Promise<ApiResponse<{ valid: boolean; expiresAt: number }>> {
    return this.apiClient.get('/auth/validate', {
      cache: false,
    })
  }

  /**
   * 撤销 Token
   */
  async revokeToken(token: string): Promise<ApiResponse<void>> {
    return this.apiClient.post('/auth/revoke', { token })
  }

  /**
   * 撤销所有 Token
   */
  async revokeAllTokens(password: string): Promise<ApiResponse<void>> {
    const response = await this.apiClient.post<void>('/auth/revoke-all', { password })

    if (response.success) {
      await this.clearTokens()
      this.stopAutoRefresh()
    }

    return response
  }

  // ================================
  // 自动刷新
  // ================================

  /**
   * 设置自动刷新
   */
  private setupAutoRefresh(): void {
    // 在应用启动时检查现有 Token 并设置自动刷新
    this.checkAndRefreshToken()
  }

  /**
   * 调度 Token 刷新
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    // 在 Token 过期前 5 分钟刷新
    const refreshTime = Math.max(0, (expiresIn - 300) * 1000)

    this.stopAutoRefresh()

    this.tokenRefreshTimer = setTimeout(() => {
      this.refreshToken().catch(error => {
        console.error('[AuthApiService] Auto refresh failed:', error)
      })
    }, refreshTime)

    console.log(`[AuthApiService] Token refresh scheduled in ${refreshTime / 1000}s`)
  }

  /**
   * 停止自动刷新
   */
  private stopAutoRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer)
      this.tokenRefreshTimer = null
    }
  }

  /**
   * 检查并刷新 Token
   */
  private async checkAndRefreshToken(): Promise<void> {
    try {
      const token = await invoke<string>('get_auth_token')
      
      if (token) {
        // 验证 Token
        const validation = await this.validateToken()
        
        if (validation.success && validation.data?.valid) {
          // 计算剩余时间
          const now = Date.now()
          const expiresIn = Math.floor((validation.data.expiresAt - now) / 1000)
          
          // 如果即将过期（少于 10 分钟），立即刷新
          if (expiresIn < 600) {
            await this.refreshToken()
          } else {
            this.scheduleTokenRefresh(expiresIn)
          }
        } else {
          // Token 无效，尝试刷新
          await this.refreshToken()
        }
      }
    } catch (error) {
      console.error('[AuthApiService] Token check failed:', error)
    }
  }

  // ================================
  // Token 存储
  // ================================

  /**
   * 保存 Token
   */
  private async saveTokens(authResponse: AuthResponse): Promise<void> {
    try {
      await invoke('save_auth_token', { token: authResponse.accessToken })
      await invoke('save_refresh_token', { token: authResponse.refreshToken })
      console.log('[AuthApiService] Tokens saved successfully')
    } catch (error) {
      console.error('[AuthApiService] Failed to save tokens:', error)
      throw error
    }
  }

  /**
   * 清除 Token
   */
  private async clearTokens(): Promise<void> {
    try {
      await invoke('clear_auth_token')
      await invoke('clear_refresh_token')
      console.log('[AuthApiService] Tokens cleared successfully')
    } catch (error) {
      console.error('[AuthApiService] Failed to clear tokens:', error)
    }
  }

  // ================================
  // 认证状态
  // ================================

  /**
   * 检查是否已认证
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await invoke<string>('get_auth_token')
      
      if (!token) {
        return false
      }

      const validation = await this.validateToken()
      return validation.success && validation.data?.valid === true
    } catch {
      return false
    }
  }

  /**
   * 获取当前认证用户
   */
  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.apiClient.get('/user/me', {
      cache: true,
      cacheTTL: 300,
    })
  }

  // ================================
  // 辅助方法
  // ================================

  /**
   * 获取设备名称
   */
  private async getDeviceName(): Promise<string> {
    try {
      return await invoke<string>('get_device_name')
    } catch {
      return 'Unknown Device'
    }
  }

  /**
   * 获取设备 ID
   */
  private async getDeviceId(): Promise<string> {
    try {
      return await invoke<string>('get_device_id')
    } catch {
      return `device-${Date.now()}`
    }
  }

  // ================================
  // 清理
  // ================================

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stopAutoRefresh()
  }
}

// ================================
// 导出
// ================================

/**
 * 创建认证 API 服务
 */
export function createAuthApiService(apiClient: ApiClient): AuthApiService {
  return new AuthApiService(apiClient)
}

