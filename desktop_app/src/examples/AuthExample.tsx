/**
 * 认证功能使用示例
 * 
 * 这个文件展示了如何在应用中使用认证和权限控制功能
 */

import React, { useState } from 'react'
import { useAuthContext, PermissionGuard, withAuthGuard } from '../contexts/AuthContext'
import { UserPermission } from '../stores/authStore'
import { AuthModal, UserMenu } from '../components/Auth'

// ============================================
// 示例 1: 基本使用 - 显示登录状态
// ============================================

export const AuthStatusExample: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuthContext()

  if (isLoading) {
    return <div>加载中...</div>
  }

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="text-lg font-bold mb-2">认证状态</h3>
      {isAuthenticated ? (
        <div>
          <p>✅ 已登录</p>
          <p>用户名: {user?.username}</p>
          <p>邮箱: {user?.email}</p>
        </div>
      ) : (
        <div>
          <p>❌ 未登录（访客模式）</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// 示例 2: 使用权限守卫组件
// ============================================

export const PermissionGuardExample: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* 需要登录才能查看 */}
      <PermissionGuard
        permissions={[UserPermission.CHARACTER_CREATE]}
        fallback={
          <div className="p-4 bg-yellow-100 rounded">
            <p>⚠️ 你需要登录才能创建角色模板</p>
          </div>
        }
      >
        <div className="p-4 bg-green-100 rounded">
          <p>✅ 你可以创建角色模板</p>
          <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
            创建角色
          </button>
        </div>
      </PermissionGuard>

      {/* 需要工作流权限 */}
      <PermissionGuard
        permissions={[UserPermission.WORKFLOW_CREATE, UserPermission.WORKFLOW_EDIT]}
        fallback={<div className="p-4 bg-yellow-100 rounded">需要登录</div>}
      >
        <div className="p-4 bg-green-100 rounded">
          <p>✅ 你可以编辑工作流</p>
          <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
            编辑工作流
          </button>
        </div>
      </PermissionGuard>
    </div>
  )
}

// ============================================
// 示例 3: 使用 HOC 权限守卫
// ============================================

const CharacterEditorComponent: React.FC = () => {
  return (
    <div className="p-4 bg-blue-100 rounded">
      <h3 className="text-lg font-bold mb-2">角色编辑器</h3>
      <p>这个组件只有登录用户可以访问</p>
      <div className="mt-4">
        <input
          type="text"
          placeholder="角色名称"
          className="px-3 py-2 border rounded mr-2"
        />
        <button className="px-4 py-2 bg-blue-500 text-white rounded">
          保存角色
        </button>
      </div>
    </div>
  )
}

// 使用 HOC 包装组件
export const CharacterEditor = withAuthGuard(CharacterEditorComponent, {
  permissions: [UserPermission.CHARACTER_CREATE, UserPermission.CHARACTER_EDIT],
})

// ============================================
// 示例 4: 条件渲染
// ============================================

export const ConditionalRenderExample: React.FC = () => {
  const { hasPermission, hasAnyPermission } = useAuthContext()

  const canCreateCharacter = hasPermission(UserPermission.CHARACTER_CREATE)
  const canEditWorkflow = hasAnyPermission([
    UserPermission.WORKFLOW_CREATE,
    UserPermission.WORKFLOW_EDIT,
  ])

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="text-lg font-bold mb-2">功能列表</h3>
      <ul className="space-y-2">
        <li className="flex items-center">
          <span className="mr-2">{canCreateCharacter ? '✅' : '❌'}</span>
          <span>创建角色模板</span>
          {!canCreateCharacter && (
            <span className="ml-2 text-sm text-gray-500">(需要登录)</span>
          )}
        </li>
        <li className="flex items-center">
          <span className="mr-2">{canEditWorkflow ? '✅' : '❌'}</span>
          <span>编辑工作流</span>
          {!canEditWorkflow && (
            <span className="ml-2 text-sm text-gray-500">(需要登录)</span>
          )}
        </li>
      </ul>
    </div>
  )
}

// ============================================
// 示例 5: 完整的应用布局
// ============================================

export const AppLayoutExample: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { isAuthenticated, logout } = useAuthContext()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Zishu Sensei</h1>
          
          {/* 用户菜单 */}
          <div className="flex items-center space-x-4">
            <UserMenu onOpenAuth={() => setShowAuthModal(true)} />
            
            {/* 或者自定义按钮 */}
            {!isAuthenticated && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                登录 / 注册
              </button>
            )}
            
            {isAuthenticated && (
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                登出
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <AuthStatusExample />
          <PermissionGuardExample />
          <ConditionalRenderExample />
          <CharacterEditor />
        </div>
      </main>

      {/* 认证模态框 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="login"
      />
    </div>
  )
}

// ============================================
// 示例 6: 受保护的路由（如果使用 React Router）
// ============================================

export const ProtectedRouteExample: React.FC = () => {
  return (
    <PermissionGuard
      permissions={[UserPermission.USER_PROFILE]}
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">需要登录</h2>
            <p className="text-gray-600 mb-4">请先登录以访问此页面</p>
            <button className="px-6 py-3 bg-blue-500 text-white rounded">
              立即登录
            </button>
          </div>
        </div>
      }
    >
      {/* 受保护的页面内容 */}
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">个人资料</h1>
        <p>这是一个受保护的页面，只有登录用户可以访问。</p>
      </div>
    </PermissionGuard>
  )
}

// ============================================
// 导出所有示例
// ============================================

export default {
  AuthStatusExample,
  PermissionGuardExample,
  CharacterEditor,
  ConditionalRenderExample,
  AppLayoutExample,
  ProtectedRouteExample,
}
