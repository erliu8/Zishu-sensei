/**
 * 注册表单组件
 */

import React, { useState } from 'react'
import { useAuthContext } from '../../contexts/AuthContext'

interface RegisterFormProps {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
}) => {
  const { register, isLoading, error, clearError } = useAuthContext()

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  })

  const [validationErrors, setValidationErrors] = useState<{
    username?: string
    email?: string
    password?: string
    confirmPassword?: string
    agreeToTerms?: string
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

    // 用户名验证
    if (!formData.username.trim()) {
      errors.username = '请输入用户名'
    } else if (formData.username.length < 3) {
      errors.username = '用户名至少3个字符'
    } else if (formData.username.length > 20) {
      errors.username = '用户名最多20个字符'
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = '用户名只能包含字母、数字和下划线'
    }

    // 邮箱验证
    if (!formData.email.trim()) {
      errors.email = '请输入邮箱'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '邮箱格式不正确'
    }

    // 密码验证
    if (!formData.password) {
      errors.password = '请输入密码'
    } else if (formData.password.length < 6) {
      errors.password = '密码至少6个字符'
    } else if (formData.password.length > 50) {
      errors.password = '密码最多50个字符'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*\d)|(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = '密码需要包含字母和数字的组合'
    }

    // 确认密码验证
    if (!formData.confirmPassword) {
      errors.confirmPassword = '请确认密码'
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = '两次密码输入不一致'
    }

    // 同意条款验证
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = '请同意服务条款和隐私政策'
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
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.confirmPassword
      )
      onSuccess?.()
    } catch (error) {
      // 错误已经在 store 中处理
      console.error('注册失败:', error)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div 
        className="bg-white rounded-lg shadow-lg"
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          padding: '2.5rem',
        }}
      >
        <div className="text-center" style={{ marginBottom: '2rem' }}>
          <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ color: '#111827', marginBottom: '0.75rem' }}>创建账号</h2>
          <p className="text-gray-600" style={{ color: '#4b5563' }}>加入 Zishu Sensei 社区</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 错误提示 */}
          {error && (
            <div 
              className="bg-red-50 border border-red-200 rounded-lg p-4"
              style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}
            >
              <p className="text-red-600 text-sm" style={{ color: '#dc2626' }}>{error}</p>
            </div>
          )}

          {/* 用户名 */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700"
              style={{ color: '#374151', marginBottom: '0.5rem' }}
            >
              用户名
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              style={{ 
                backgroundColor: 'white', 
                color: '#1f2937',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
              }}
              className={`w-full border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.username
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="3-20个字符"
              disabled={isLoading}
            />
            {validationErrors.username && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.username}</p>
            )}
          </div>

          {/* 邮箱 */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
              style={{ color: '#374151', marginBottom: '0.5rem' }}
            >
              邮箱
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={{ 
                backgroundColor: 'white', 
                color: '#1f2937',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
              }}
              className={`w-full border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="your@email.com"
              disabled={isLoading}
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
            )}
          </div>

          {/* 密码 */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
              style={{ color: '#374151', marginBottom: '0.5rem' }}
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
                backgroundColor: 'white', 
                color: '#1f2937',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
              }}
              className={`w-full border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.password
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="至少6个字符"
              disabled={isLoading}
            />
            {validationErrors.password && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
            )}
          </div>

          {/* 确认密码 */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
              style={{ color: '#374151', marginBottom: '0.5rem' }}
            >
              确认密码
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              style={{ 
                backgroundColor: 'white', 
                color: '#1f2937',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
              }}
              className={`w-full border rounded-lg focus:outline-none focus:ring-2 ${
                validationErrors.confirmPassword
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="再次输入密码"
              disabled={isLoading}
            />
            {validationErrors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.confirmPassword}</p>
            )}
          </div>

          {/* 同意条款 */}
          <div>
            <label className="flex items-start">
              <input
                type="checkbox"
                name="agreeToTerms"
                checked={formData.agreeToTerms}
                onChange={handleChange}
                className={`w-4 h-4 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                  validationErrors.agreeToTerms ? 'border-red-500' : ''
                }`}
                disabled={isLoading}
              />
              <span className="ml-2 text-sm text-gray-700" style={{ color: '#374151' }}>
                我已阅读并同意{' '}
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-700"
                  style={{ color: '#2563eb' }}
                  onClick={(e) => {
                    e.preventDefault()
                    // TODO: 打开服务条款
                    alert('服务条款页面即将上线')
                  }}
                >
                  服务条款
                </a>{' '}
                和{' '}
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-700"
                  style={{ color: '#2563eb' }}
                  onClick={(e) => {
                    e.preventDefault()
                    // TODO: 打开隐私政策
                    alert('隐私政策页面即将上线')
                  }}
                >
                  隐私政策
                </a>
              </span>
            </label>
            {validationErrors.agreeToTerms && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.agreeToTerms}</p>
            )}
          </div>

          {/* 注册按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '0.875rem 1rem',
              marginTop: '0.5rem',
            }}
            className={`w-full rounded-lg text-white font-medium transition-colors ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? '注册中...' : '注册'}
          </button>

          {/* 已有账号 */}
          <div className="text-center">
            <p className="text-sm text-gray-600" style={{ color: '#4b5563' }}>
              已有账号？{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-blue-600 hover:text-blue-700 font-medium"
                style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                立即登录
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterForm
