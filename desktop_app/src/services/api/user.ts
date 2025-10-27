/**
 * 用户 API 服务
 * 
 * 提供用户相关的 API 接口，包括：
 * - 用户信息管理
 * - 用户配置
 * - 用户统计
 * - 用户偏好设置
 */

import type { ApiClient, ApiResponse } from '../api'

// ================================
// 类型定义
// ================================

/**
 * 用户信息
 */
export interface User {
  id: string
  username: string
  email: string
  nickname?: string
  avatar?: string
  bio?: string
  createdAt: number
  updatedAt: number
  lastLoginAt?: number
  isActive: boolean
  role: 'user' | 'admin' | 'moderator'
  verified: boolean
  preferences?: UserPreferences
  stats?: UserStats
}

/**
 * 用户配置
 */
export interface UserPreferences {
  language: string
  timezone: string
  theme: 'light' | 'dark' | 'auto'
  notifications: NotificationPreferences
  privacy: PrivacyPreferences
  accessibility: AccessibilityPreferences
}

/**
 * 通知偏好
 */
export interface NotificationPreferences {
  email: boolean
  push: boolean
  desktop: boolean
  sound: boolean
  messageNotifications: boolean
  systemNotifications: boolean
  updateNotifications: boolean
}

/**
 * 隐私偏好
 */
export interface PrivacyPreferences {
  showOnlineStatus: boolean
  showLastSeen: boolean
  allowDataCollection: boolean
  allowAnalytics: boolean
  shareUsageData: boolean
}

/**
 * 无障碍偏好
 */
export interface AccessibilityPreferences {
  fontSize: 'small' | 'medium' | 'large' | 'x-large'
  highContrast: boolean
  reduceMotion: boolean
  screenReader: boolean
  keyboardNavigation: boolean
}

/**
 * 用户统计
 */
export interface UserStats {
  totalConversations: number
  totalMessages: number
  totalCharacters: number
  activeTime: number
  favoriteModels: string[]
  mostUsedFeatures: Array<{ feature: string; count: number }>
  lastActivity: number
}

/**
 * 用户更新参数
 */
export interface UpdateUserParams {
  nickname?: string
  avatar?: string
  bio?: string
  email?: string
}

/**
 * 密码更新参数
 */
export interface UpdatePasswordParams {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * 用户搜索参数
 */
export interface SearchUsersParams {
  query?: string
  role?: string
  verified?: boolean
  isActive?: boolean
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'username'
  sortOrder?: 'asc' | 'desc'
}

// ================================
// 用户 API 服务类
// ================================

export class UserApiService {
  constructor(private apiClient: ApiClient) {}

  // ================================
  // 用户信息
  // ================================

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.apiClient.get<User>('/user/me', {
      cache: true,
      cacheTTL: 300, // 5分钟
    })
  }

  /**
   * 获取用户信息
   */
  async getUser(userId: string): Promise<ApiResponse<User>> {
    return this.apiClient.get<User>(`/users/${userId}`, {
      cache: true,
      cacheTTL: 300,
    })
  }

  /**
   * 更新当前用户信息
   */
  async updateCurrentUser(params: UpdateUserParams): Promise<ApiResponse<User>> {
    const response = await this.apiClient.put<User>('/user/me', params)
    
    // 更新成功后清除缓存
    if (response.success) {
      this.apiClient.clearCache('/user/me')
    }
    
    return response
  }

  /**
   * 更新用户头像
   */
  async updateAvatar(file: File): Promise<ApiResponse<{ avatar: string }>> {
    const formData = new FormData()
    formData.append('avatar', file)

    const response = await this.apiClient.post<{ avatar: string }>(
      '/user/me/avatar',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progress) => {
          console.log(`Avatar upload progress: ${progress}%`)
        },
      }
    )

    // 更新成功后清除缓存
    if (response.success) {
      this.apiClient.clearCache('/user/me')
    }

    return response
  }

  /**
   * 删除用户头像
   */
  async deleteAvatar(): Promise<ApiResponse<void>> {
    const response = await this.apiClient.delete<void>('/user/me/avatar')
    
    // 删除成功后清除缓存
    if (response.success) {
      this.apiClient.clearCache('/user/me')
    }
    
    return response
  }

  // ================================
  // 密码管理
  // ================================

  /**
   * 更新密码
   */
  async updatePassword(params: UpdatePasswordParams): Promise<ApiResponse<void>> {
    return this.apiClient.put<void>('/user/me/password', params)
  }

  /**
   * 请求重置密码
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>('/user/password/reset', { email })
  }

  /**
   * 重置密码
   */
  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>('/user/password/reset/confirm', {
      token,
      newPassword,
    })
  }

  // ================================
  // 用户偏好设置
  // ================================

  /**
   * 获取用户偏好设置
   */
  async getPreferences(): Promise<ApiResponse<UserPreferences>> {
    return this.apiClient.get<UserPreferences>('/user/me/preferences', {
      cache: true,
      cacheTTL: 600, // 10分钟
    })
  }

  /**
   * 更新用户偏好设置
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<ApiResponse<UserPreferences>> {
    const response = await this.apiClient.patch<UserPreferences>(
      '/user/me/preferences',
      preferences
    )

    // 更新成功后清除缓存
    if (response.success) {
      this.apiClient.clearCache('/user/me/preferences')
    }

    return response
  }

  /**
   * 重置用户偏好设置
   */
  async resetPreferences(): Promise<ApiResponse<UserPreferences>> {
    const response = await this.apiClient.post<UserPreferences>(
      '/user/me/preferences/reset'
    )

    // 重置成功后清除缓存
    if (response.success) {
      this.apiClient.clearCache('/user/me/preferences')
    }

    return response
  }

  // ================================
  // 用户统计
  // ================================

  /**
   * 获取用户统计
   */
  async getStats(): Promise<ApiResponse<UserStats>> {
    return this.apiClient.get<UserStats>('/user/me/stats', {
      cache: true,
      cacheTTL: 60, // 1分钟
    })
  }

  /**
   * 刷新用户统计
   */
  async refreshStats(): Promise<ApiResponse<UserStats>> {
    this.apiClient.clearCache('/user/me/stats')
    return this.getStats()
  }

  // ================================
  // 用户搜索
  // ================================

  /**
   * 搜索用户
   */
  async searchUsers(params: SearchUsersParams): Promise<ApiResponse<{
    users: User[]
    total: number
    limit: number
    offset: number
  }>> {
    return this.apiClient.get('/users/search', {
      params,
      cache: true,
      cacheTTL: 60,
    })
  }

  // ================================
  // 账户管理
  // ================================

  /**
   * 停用账户
   */
  async deactivateAccount(password: string): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>('/user/me/deactivate', { password })
  }

  /**
   * 激活账户
   */
  async activateAccount(token: string): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>('/user/activate', { token })
  }

  /**
   * 删除账户
   */
  async deleteAccount(password: string, reason?: string): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>('/user/me', {
      data: { password, reason },
    })
  }

  /**
   * 导出用户数据
   */
  async exportData(): Promise<ApiResponse<{ downloadUrl: string }>> {
    return this.apiClient.post<{ downloadUrl: string }>('/user/me/export')
  }

  // ================================
  // 邮箱验证
  // ================================

  /**
   * 发送验证邮件
   */
  async sendVerificationEmail(): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>('/user/me/verify/email')
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>('/user/verify/email', { token })
  }

  /**
   * 更新邮箱
   */
  async updateEmail(email: string, password: string): Promise<ApiResponse<void>> {
    return this.apiClient.put<void>('/user/me/email', { email, password })
  }

  // ================================
  // 会话管理
  // ================================

  /**
   * 获取活动会话
   */
  async getActiveSessions(): Promise<ApiResponse<Array<{
    id: string
    deviceId: string
    deviceName: string
    ip: string
    location?: string
    lastActive: number
    current: boolean
  }>>> {
    return this.apiClient.get('/user/me/sessions')
  }

  /**
   * 撤销会话
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(`/user/me/sessions/${sessionId}`)
  }

  /**
   * 撤销所有其他会话
   */
  async revokeAllOtherSessions(): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>('/user/me/sessions/revoke-all')
  }

  // ================================
  // 通知设置
  // ================================

  /**
   * 获取通知设置
   */
  async getNotificationSettings(): Promise<ApiResponse<NotificationPreferences>> {
    return this.apiClient.get<NotificationPreferences>('/user/me/notifications', {
      cache: true,
      cacheTTL: 300,
    })
  }

  /**
   * 更新通知设置
   */
  async updateNotificationSettings(
    settings: Partial<NotificationPreferences>
  ): Promise<ApiResponse<NotificationPreferences>> {
    const response = await this.apiClient.patch<NotificationPreferences>(
      '/user/me/notifications',
      settings
    )

    if (response.success) {
      this.apiClient.clearCache('/user/me/notifications')
    }

    return response
  }

  // ================================
  // 隐私设置
  // ================================

  /**
   * 获取隐私设置
   */
  async getPrivacySettings(): Promise<ApiResponse<PrivacyPreferences>> {
    return this.apiClient.get<PrivacyPreferences>('/user/me/privacy', {
      cache: true,
      cacheTTL: 300,
    })
  }

  /**
   * 更新隐私设置
   */
  async updatePrivacySettings(
    settings: Partial<PrivacyPreferences>
  ): Promise<ApiResponse<PrivacyPreferences>> {
    const response = await this.apiClient.patch<PrivacyPreferences>(
      '/user/me/privacy',
      settings
    )

    if (response.success) {
      this.apiClient.clearCache('/user/me/privacy')
    }

    return response
  }

  // ================================
  // 辅助方法
  // ================================

  /**
   * 清除所有用户相关缓存
   */
  clearAllCache(): void {
    this.apiClient.clearCache('/user/')
  }
}

// ================================
// 导出
// ================================

/**
 * 创建用户 API 服务
 */
export function createUserApiService(apiClient: ApiClient): UserApiService {
  return new UserApiService(apiClient)
}
