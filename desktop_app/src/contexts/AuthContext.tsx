/**
 * 认证上下文
 * 
 * 提供认证状态和方法到整个应用
 */

import React, { createContext, useContext, useEffect } from 'react'
import { useAuthStore, UserInfo, UserPermission } from '../stores/authStore'

// ================================
// 类型定义
// ================================

interface AuthContextValue {
  // 状态
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  user: UserInfo | null
  isGuest: boolean

  // 认证方法
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  checkAuth: () => Promise<boolean>

  // 用户方法
  updateUser: (user: Partial<UserInfo>) => void
  fetchCurrentUser: () => Promise<void>

  // 权限方法
  hasPermission: (permission: UserPermission) => boolean
  hasAnyPermission: (permissions: UserPermission[]) => boolean
  hasAllPermissions: (permissions: UserPermission[]) => boolean

  // 辅助方法
  clearError: () => void
}

// ================================
// Context 创建
// ================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ================================
// Provider 组件
// ================================

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const {
    isAuthenticated,
    isLoading,
    error,
    user,
    login,
    register,
    logout,
    refreshAuth,
    checkAuth,
    updateUser,
    fetchCurrentUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    clearError,
  } = useAuthStore()

  // 判断是否为访客
  const isGuest = !isAuthenticated

  // ================================
  // 初始化认证检查
  // ================================

  useEffect(() => {
    const initAuth = async () => {

      try {
        await checkAuth()
      } catch (error) {
        console.error('❌ 初始化认证检查失败:', error)
      }
    }

    initAuth()
  }, [checkAuth])

  // ================================
  // Token 自动刷新
  // ================================

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    // 每5分钟检查一次 token 是否需要刷新
    const interval = setInterval(() => {
      checkAuth().catch((error) => {
        console.error('❌ Token 检查失败:', error)
      })
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, checkAuth])

  // ================================
  // Context Value
  // ================================

  const value: AuthContextValue = {
    // 状态
    isAuthenticated,
    isLoading,
    error,
    user,
    isGuest,

    // 认证方法
    login,
    register,
    logout,
    refreshAuth,
    checkAuth,

    // 用户方法
    updateUser,
    fetchCurrentUser,

    // 权限方法
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    // 辅助方法
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ================================
// Hook
// ================================

/**
 * 使用认证上下文
 */
export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuthContext 必须在 AuthProvider 内部使用')
  }

  return context
}

// ================================
// 权限守卫 HOC
// ================================

interface WithAuthGuardOptions {
  // 需要的权限（满足任意一个即可）
  permissions?: UserPermission[]
  // 需要同时满足的权限
  requireAllPermissions?: UserPermission[]
  // 未授权时的回退组件
  fallback?: React.ComponentType
  // 是否允许访客访问
  allowGuest?: boolean
}

/**
 * 权限守卫高阶组件
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthGuardOptions = {}
): React.FC<P> {
  const {
    permissions,
    requireAllPermissions,
    fallback: Fallback,
    allowGuest = false,
  } = options

  return (props: P) => {
    const {
      isGuest,
      hasAnyPermission,
      hasAllPermissions,
    } = useAuthContext()

    // 检查是否允许访客访问
    if (isGuest && !allowGuest) {
      if (Fallback) {
        return <Fallback />
      }
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">需要登录</h2>
            <p className="text-gray-600">请先登录以访问此功能</p>
          </div>
        </div>
      )
    }

    // 检查权限
    if (permissions && !hasAnyPermission(permissions)) {
      if (Fallback) {
        return <Fallback />
      }
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">权限不足</h2>
            <p className="text-gray-600">您没有权限访问此功能</p>
          </div>
        </div>
      )
    }

    if (requireAllPermissions && !hasAllPermissions(requireAllPermissions)) {
      if (Fallback) {
        return <Fallback />
      }
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">权限不足</h2>
            <p className="text-gray-600">您没有足够的权限访问此功能</p>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}

// ================================
// 权限守卫组件
// ================================

interface PermissionGuardProps {
  children: React.ReactNode
  // 需要的权限（满足任意一个即可）
  permissions?: UserPermission[]
  // 需要同时满足的权限
  requireAllPermissions?: UserPermission[]
  // 未授权时显示的内容
  fallback?: React.ReactNode
  // 是否允许访客访问
  allowGuest?: boolean
}

/**
 * 权限守卫组件
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permissions,
  requireAllPermissions,
  fallback,
  allowGuest = false,
}) => {
  const {
    isGuest,
    hasAnyPermission,
    hasAllPermissions,
  } = useAuthContext()

  // 检查是否允许访客访问
  if (isGuest && !allowGuest) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">需要登录</h2>
          <p className="text-gray-600">请先登录以访问此功能</p>
        </div>
      </div>
    )
  }

  // 检查权限
  if (permissions && !hasAnyPermission(permissions)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">权限不足</h2>
          <p className="text-gray-600">您没有权限访问此功能</p>
        </div>
      </div>
    )
  }

  if (requireAllPermissions && !hasAllPermissions(requireAllPermissions)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">权限不足</h2>
          <p className="text-gray-600">您没有足够的权限访问此功能</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// ================================
// 默认导出
// ================================

export default AuthContext
