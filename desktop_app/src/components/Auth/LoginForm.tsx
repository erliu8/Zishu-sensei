/**
 * 登录表单组件
 */

import React, { useState } from 'react'
import { useAuthContext } from '../../contexts/AuthContext'

interface LoginFormProps {
  onSuccess?: () => void
  onSwitchToRegister?: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
}) => {
  const { login, isLoading, error, clearError } = useAuthContext()

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  })

  const [validationErrors, setValidationErrors] = useState<{
    username?: string
    password?: string
  }>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    // 清除验证错误
    if (validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }))
    }
    // 清除服务器错误
    if (error) {
      clearError()
    }
  }

  const validate = (): boolean => {
    const errors: typeof validationErrors = {}

    if (!formData.username.trim()) {
      errors.username = '请输入用户名或邮箱'
    }

    if (!formData.password) {
      errors.password = '请输入密码'
    } else if (formData.password.length < 6) {
      errors.password = '密码至少6个字符'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    try {
      await login(formData.username, formData.password, formData.rememberMe)
      onSuccess?.()
    } catch (error) {
      // 错误已经在 store 中处理
      console.error('登录失败:', error)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '28rem' }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        padding: '2rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
            欢迎回来
          </h2>
          <p style={{ color: '#4b5563' }}>登录以使用完整功能</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 错误提示 */}
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
            }}>
              <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</p>
            </div>
          )}

          {/* 用户名 */}
          <div>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
              }}
            >
              用户名或邮箱
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                border: `1px solid ${validationErrors.username ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '0.5rem',
                outline: 'none',
                fontSize: '1rem',
                backgroundColor: '#ffffff',
                color: '#1f2937',
              }}
              placeholder="输入用户名或邮箱"
              disabled={isLoading}
            />
            {validationErrors.username && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#dc2626' }}>
                {validationErrors.username}
              </p>
            )}
          </div>

          {/* 密码 */}
          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
              }}
            >
              密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                border: `1px solid ${validationErrors.password ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '0.5rem',
                outline: 'none',
                fontSize: '1rem',
                backgroundColor: '#ffffff',
                color: '#1f2937',
              }}
              placeholder="输入密码"
              disabled={isLoading}
            />
            {validationErrors.password && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#dc2626' }}>
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* 记住我 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                style={{
                  width: '1rem',
                  height: '1rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
                disabled={isLoading}
              />
              <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                记住我
              </span>
            </label>

            <a
              href="#"
              style={{
                fontSize: '0.875rem',
                color: '#2563eb',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1d4ed8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#2563eb'
              }}
              onClick={(e) => {
                e.preventDefault()
                // TODO: 实现忘记密码
                alert('忘记密码功能即将上线')
              }}
            >
              忘记密码？
            </a>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              color: '#ffffff',
              fontWeight: '500',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#1d4ed8'
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }
            }}
          >
            {isLoading ? '登录中...' : '登录'}
          </button>

          {/* 访客模式提示 */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
              没有账号？{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                style={{
                  color: '#2563eb',
                  fontWeight: '500',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1d4ed8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#2563eb'
                }}
              >
                立即注册
              </button>
            </p>
          </div>

          {/* 访客模式 */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '1px',
              backgroundColor: '#d1d5db',
            }}></div>
            <div style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              fontSize: '0.875rem',
            }}>
              <span style={{
                padding: '0 0.5rem',
                backgroundColor: '#ffffff',
                color: '#6b7280',
              }}>
                或
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              // 关闭登录弹窗，以访客模式继续
              onSuccess?.()
            }}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              border: '2px solid #d1d5db',
              borderRadius: '0.5rem',
              color: '#374151',
              fontWeight: '500',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            以访客模式继续
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginForm
