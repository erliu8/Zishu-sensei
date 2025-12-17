/**
 * 认证状态管理 Store
 * 
 * 提供用户认证相关的状态管理，包括：
 * - 登录/登出状态
 * - 用户信息
 * - Token 管理
 * - 权限管理
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ================================
// 类型定义
// ================================

/**
 * 用户信息
 */
export interface UserInfo {
  id: string
  username: string
  email: string
  verified: boolean
  role?: string
  avatar?: string
  createdAt?: string
  lastLogin?: string
}

/**
 * 用户权限
 */
export enum UserPermission {
  // 访客权限
  GUEST_CHAT = 'guest:chat', // 与AI聊天
  
  // 基础权限
  USER_PROFILE = 'user:profile', // 查看个人资料
  USER_SETTINGS = 'user:settings', // 修改设置
  
  // 角色模板权限
  CHARACTER_VIEW = 'character:view', // 查看角色模板
  CHARACTER_CREATE = 'character:create', // 创建角色模板
  CHARACTER_EDIT = 'character:edit', // 编辑角色模板
  CHARACTER_DELETE = 'character:delete', // 删除角色模板
  CHARACTER_PUBLISH = 'character:publish', // 发布角色模板到社区
  
  // 工作流权限
  WORKFLOW_VIEW = 'workflow:view', // 查看工作流
  WORKFLOW_CREATE = 'workflow:create', // 创建工作流
  WORKFLOW_EDIT = 'workflow:edit', // 编辑工作流
  WORKFLOW_DELETE = 'workflow:delete', // 删除工作流
  WORKFLOW_EXECUTE = 'workflow:execute', // 执行工作流
  
  // 适配器权限
  ADAPTER_VIEW = 'adapter:view', // 查看适配器
  ADAPTER_INSTALL = 'adapter:install', // 安装适配器
  ADAPTER_CONFIG = 'adapter:config', // 配置适配器
  
  // 市场权限
  MARKET_BROWSE = 'market:browse', // 浏览市场
  MARKET_DOWNLOAD = 'market:download', // 下载资源
  MARKET_UPLOAD = 'market:upload', // 上传资源
  
  // 管理员权限
  ADMIN_USERS = 'admin:users', // 用户管理
  ADMIN_SYSTEM = 'admin:system', // 系统管理
}

/**
 * 认证状态
 */
export interface AuthState {
  // 状态
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // 用户信息
  user: UserInfo | null
  permissions: Set<UserPermission>
  
  // Token
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: number | null
  
  // Actions
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  checkAuth: () => Promise<boolean>
  
  // 用户信息
  updateUser: (user: Partial<UserInfo>) => void
  fetchCurrentUser: () => Promise<void>
  
  // 权限
  hasPermission: (permission: UserPermission) => boolean
  hasAnyPermission: (permissions: UserPermission[]) => boolean
  hasAllPermissions: (permissions: UserPermission[]) => boolean
  updatePermissions: (permissions: UserPermission[]) => void
  
  // 辅助方法
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  reset: () => void
}

// ================================
// 默认访客权限
// ================================

const GUEST_PERMISSIONS: UserPermission[] = [
  UserPermission.GUEST_CHAT,
]

// ================================
// 默认用户权限（登录后）
// ================================

const DEFAULT_USER_PERMISSIONS: UserPermission[] = [
  ...GUEST_PERMISSIONS,
  UserPermission.USER_PROFILE,
  UserPermission.USER_SETTINGS,
  UserPermission.CHARACTER_VIEW,
  UserPermission.CHARACTER_CREATE,
  UserPermission.CHARACTER_EDIT,
  UserPermission.WORKFLOW_VIEW,
  UserPermission.WORKFLOW_CREATE,
  UserPermission.WORKFLOW_EDIT,
  UserPermission.WORKFLOW_EXECUTE,
  UserPermission.ADAPTER_VIEW,
  UserPermission.ADAPTER_INSTALL,
  UserPermission.ADAPTER_CONFIG,
  UserPermission.MARKET_BROWSE,
  UserPermission.MARKET_DOWNLOAD,
]

// ================================
// Store 实现
// ================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      isLoading: false,
      error: null,
      user: null,
      permissions: new Set(GUEST_PERMISSIONS),
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,

      // ================================
      // 登录/注册/登出
      // ================================

      /**
       * 登录
       */
      login: async (username: string, password: string, rememberMe = false) => {
        set({ isLoading: true, error: null })

        try {
          // 调用前端 API 服务进行登录
          const { getApiServiceFactory } = await import('../services/api/factory')
          const authService = getApiServiceFactory().getAuthService()
          const response = await authService.login({
            username,
            password,
            rememberMe,
          })

          if (!response.success || !response.data) {
            throw new Error(response.error || response.message || '登录失败')
          }

          const authData = response.data

          // 更新状态
          set({
            isAuthenticated: true,
            user: authData.user,
            accessToken: authData.accessToken,
            refreshToken: authData.refreshToken,
            tokenExpiresAt: Date.now() + authData.expiresIn * 1000,
            permissions: new Set(DEFAULT_USER_PERMISSIONS),
            isLoading: false,
          })

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '登录失败'
          set({ 
            error: errorMessage, 
            isLoading: false,
            isAuthenticated: false,
          })
          console.error('❌ 登录失败:', error)
          throw error
        }
      },

      /**
       * 注册
       */
      register: async (
        username: string,
        email: string,
        password: string,
        confirmPassword: string
      ) => {
        set({ isLoading: true, error: null })

        try {
          // 验证
          if (password !== confirmPassword) {
            throw new Error('两次密码输入不一致')
          }

          // 调用前端 API 服务进行注册
          const { getApiServiceFactory } = await import('../services/api/factory')
          const authService = getApiServiceFactory().getAuthService()
          const response = await authService.register({
            username,
            email,
            password,
            confirmPassword,
            agreeToTerms: true,
          })

          if (!response.success || !response.data) {
            console.error('❌ [authStore] 响应检查失败')
            throw new Error(response.error || response.message || '注册失败')
          }

          const authData = response.data

          // 自动登录
          set({
            isAuthenticated: true,
            user: authData.user,
            accessToken: authData.accessToken,
            refreshToken: authData.refreshToken,
            tokenExpiresAt: Date.now() + authData.expiresIn * 1000,
            permissions: new Set(DEFAULT_USER_PERMISSIONS),
            isLoading: false,
          })

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '注册失败'
          set({ 
            error: errorMessage, 
            isLoading: false,
            isAuthenticated: false,
          })
          console.error('❌ 注册失败:', error)
          throw error
        }
      },

      /**
       * 登出
       */
      logout: async () => {
        set({ isLoading: true })

        try {
          // 调用前端 API 服务进行登出
          const { getApiServiceFactory } = await import('../services/api/factory')
          const authService = getApiServiceFactory().getAuthService()
          await authService.logout()

          // 重置为访客状态
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            permissions: new Set(GUEST_PERMISSIONS),
            isLoading: false,
            error: null,
          })

        } catch (error) {
          console.error('❌ 登出失败:', error)
          // 即使登出失败，也清除本地状态
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            permissions: new Set(GUEST_PERMISSIONS),
            isLoading: false,
          })
        }
      },

      /**
       * 刷新认证
       */
      refreshAuth: async () => {
        try {
          const { getApiServiceFactory } = await import('../services/api/factory')
          const authService = getApiServiceFactory().getAuthService()
          const response = await authService.refreshToken()

          if (response.success && response.data) {
            set({
              accessToken: response.data.accessToken,
              tokenExpiresAt: Date.now() + response.data.expiresIn * 1000,
            })
          }
        } catch (error) {
          console.error('❌ 刷新令牌失败:', error)
          // Token 刷新失败，退出登录
          await get().logout()
        }
      },

      /**
       * 检查认证状态
       */
      checkAuth: async () => {
        try {
          const { getApiServiceFactory } = await import('../services/api/factory')
          const authService = getApiServiceFactory().getAuthService()
          const isAuth = await authService.isAuthenticated()
          
          if (isAuth && !get().isAuthenticated) {
            // 有有效 token 但状态未更新，获取用户信息
            await get().fetchCurrentUser()
          } else if (!isAuth && get().isAuthenticated) {
            // token 无效但状态显示已登录，重置状态
            await get().logout()
          }
          
          return isAuth
        } catch (error) {
          console.error('❌ 检查认证状态失败:', error)
          return false
        }
      },

      // ================================
      // 用户信息
      // ================================

      /**
       * 更新用户信息
       */
      updateUser: (user: Partial<UserInfo>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...user } : null,
        }))
      },

      /**
       * 获取当前用户信息
       */
      fetchCurrentUser: async () => {
        try {
          const { getApiServiceFactory } = await import('../services/api/factory')
          const authService = getApiServiceFactory().getAuthService()
          const response = await authService.getCurrentUser()

          if (response.success && response.data) {
            set({
              isAuthenticated: true,
              user: response.data,
              permissions: new Set(DEFAULT_USER_PERMISSIONS),
            })
          }
        } catch (error) {
          console.error('❌ 获取用户信息失败:', error)
        }
      },

      // ================================
      // 权限管理
      // ================================

      /**
       * 检查是否有指定权限
       */
      hasPermission: (permission: UserPermission) => {
        return get().permissions.has(permission)
      },

      /**
       * 检查是否有任意一个权限
       */
      hasAnyPermission: (permissions: UserPermission[]) => {
        const userPermissions = get().permissions
        return permissions.some((p) => userPermissions.has(p))
      },

      /**
       * 检查是否有所有权限
       */
      hasAllPermissions: (permissions: UserPermission[]) => {
        const userPermissions = get().permissions
        return permissions.every((p) => userPermissions.has(p))
      },

      /**
       * 更新权限列表
       */
      updatePermissions: (permissions: UserPermission[]) => {
        set({ permissions: new Set(permissions) })
      },

      // ================================
      // 辅助方法
      // ================================

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      setError: (error: string | null) => {
        set({ error })
      },

      clearError: () => {
        set({ error: null })
      },

      reset: () => {
        set({
          isAuthenticated: false,
          isLoading: false,
          error: null,
          user: null,
          permissions: new Set(GUEST_PERMISSIONS),
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        })
      },
    }),
    {
      name: 'zishu-auth-storage',
      storage: createJSONStorage(() => localStorage),
      // 只持久化部分状态
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        permissions: Array.from(state.permissions), // Set 转为数组存储
      }),
      // 恢复时转换回 Set
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.permissions)) {
          state.permissions = new Set(state.permissions as UserPermission[])
        }
      },
    }
  )
)

// ================================
// 导出权限枚举供外部使用
// ================================

export { UserPermission as Permission }

// ================================
// 便捷 Hooks
// ================================

/**
 * 使用认证状态
 */
export const useAuth = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const error = useAuthStore((state) => state.error)

  return { isAuthenticated, user, isLoading, error }
}

/**
 * 使用用户信息
 */
export const useUser = () => {
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser)

  return { user, updateUser, fetchCurrentUser }
}

/**
 * 使用权限
 */
export const usePermissions = () => {
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const hasAnyPermission = useAuthStore((state) => state.hasAnyPermission)
  const hasAllPermissions = useAuthStore((state) => state.hasAllPermissions)
  const permissions = useAuthStore((state) => state.permissions)

  return { hasPermission, hasAnyPermission, hasAllPermissions, permissions }
}
