/**
 * Input 通用输入组件
 * 
 * 功能特性：
 * - 多种输入类型支持
 * - 多种尺寸和变体
 * - 验证状态显示
 * - 前缀和后缀图标
 * - 清除按钮
 * - 字符计数
 * - 禁用和只读状态
 */

import React, { forwardRef, useState, useCallback } from 'react'
import { Eye, EyeOff, X, AlertCircle } from 'lucide-react'

/**
 * 输入框类型
 */
export type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search'

/**
 * 输入框尺寸
 */
export type InputSize = 'sm' | 'md' | 'lg'

/**
 * 输入框变体
 */
export type InputVariant = 'default' | 'filled' | 'outlined' | 'borderless'

/**
 * 验证状态
 */
export type ValidationStatus = 'success' | 'warning' | 'error'

/**
 * Input 组件属性
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 输入框类型 */
  type?: InputType
  
  /** 尺寸 */
  size?: InputSize
  
  /** 变体样式 */
  variant?: InputVariant
  
  /** 标签文本 */
  label?: string
  
  /** 帮助文本 */
  helperText?: string
  
  /** 错误文本 */
  errorText?: string
  
  /** 验证状态 */
  status?: ValidationStatus
  
  /** 前缀图标 */
  prefix?: React.ReactNode
  
  /** 后缀图标 */
  suffix?: React.ReactNode
  
  /** 是否显示清除按钮 */
  clearable?: boolean
  
  /** 是否显示密码切换按钮 */
  showPasswordToggle?: boolean
  
  /** 最大字符数 */
  maxLength?: number
  
  /** 是否显示字符计数 */
  showCount?: boolean
  
  /** 是否为块级元素 */
  block?: boolean
  
  /** 自定义容器类名 */
  containerClassName?: string
  
  /** 清除按钮点击回调 */
  onClear?: () => void
}

/**
 * 工具函数：组合类名
 */
const combineClasses = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ')
}

/**
 * Input 组件
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  size = 'md',
  variant = 'default',
  label,
  helperText,
  errorText,
  status,
  prefix,
  suffix,
  clearable = false,
  showPasswordToggle = false,
  maxLength,
  showCount = false,
  block = false,
  containerClassName,
  className,
  disabled = false,
  readOnly = false,
  value,
  onChange,
  onClear,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false)
  const [internalValue, setInternalValue] = useState(value || '')

  // 受控/非受控值管理
  const currentValue = value !== undefined ? value : internalValue
  const isControlled = value !== undefined

  // 确定实际的输入类型
  const inputType = type === 'password' && showPassword ? 'text' : type

  // 确定验证状态
  const validationStatus = errorText ? 'error' : status

  // 处理值变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    
    if (!isControlled) {
      setInternalValue(newValue)
    }
    
    onChange?.(e)
  }, [isControlled, onChange])

  // 处理清除
  const handleClear = useCallback(() => {
    if (disabled || readOnly) return
    
    const syntheticEvent = {
      target: { value: '' },
      currentTarget: { value: '' }
    } as React.ChangeEvent<HTMLInputElement>
    
    if (!isControlled) {
      setInternalValue('')
    }
    
    onChange?.(syntheticEvent)
    onClear?.()
  }, [disabled, readOnly, isControlled, onChange, onClear])

  // 切换密码显示
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev)
  }, [])

  // 基础样式类
  const baseClasses = combineClasses(
    'relative flex items-center transition-all duration-200',
    'border rounded-md',
    'focus-within:ring-2 focus-within:ring-offset-1',
    
    // 尺寸样式
    size === 'sm' && 'h-8 text-sm',
    size === 'md' && 'h-10 text-base',
    size === 'lg' && 'h-12 text-lg',
    
    // 变体样式
    variant === 'default' && 'border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-blue-500/20',
    variant === 'filled' && 'border-transparent bg-gray-100 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-blue-500/20',
    variant === 'outlined' && 'border-2 border-gray-300 bg-transparent focus-within:border-blue-500 focus-within:ring-blue-500/20',
    variant === 'borderless' && 'border-transparent bg-transparent focus-within:bg-gray-50',
    
    // 验证状态样式
    validationStatus === 'success' && 'border-green-500 focus-within:border-green-500 focus-within:ring-green-500/20',
    validationStatus === 'warning' && 'border-yellow-500 focus-within:border-yellow-500 focus-within:ring-yellow-500/20',
    validationStatus === 'error' && 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20',
    
    // 禁用状态
    disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
    
    // 只读状态
    readOnly && 'bg-gray-50',
    
    // 块级样式
    block && 'w-full'
  )

  // 输入框样式类
  const inputClasses = combineClasses(
    'flex-1 bg-transparent border-0 outline-none',
    'placeholder:text-gray-400',
    
    // 内边距
    size === 'sm' && (prefix ? 'pl-1' : 'pl-3') && (suffix || clearable || (type === 'password' && showPasswordToggle) ? 'pr-1' : 'pr-3'),
    size === 'md' && (prefix ? 'pl-1' : 'pl-3') && (suffix || clearable || (type === 'password' && showPasswordToggle) ? 'pr-1' : 'pr-3'),
    size === 'lg' && (prefix ? 'pl-1' : 'pl-4') && (suffix || clearable || (type === 'password' && showPasswordToggle) ? 'pr-1' : 'pr-4'),
    
    disabled && 'cursor-not-allowed',
    readOnly && 'cursor-default'
  )

  // 图标尺寸
  const iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18

  return (
    <div className={combineClasses('space-y-1', block && 'w-full', containerClassName)}>
      {/* 标签 */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* 输入框容器 */}
      <div className={baseClasses}>
        {/* 前缀图标 */}
        {prefix && (
          <div className={combineClasses(
            'flex items-center justify-center text-gray-400',
            size === 'sm' ? 'pl-2 pr-1' : 'pl-3 pr-2'
          )}>
            {React.isValidElement(prefix) 
              ? React.cloneElement(prefix, { size: iconSize } as any)
              : prefix
            }
          </div>
        )}
        
        {/* 输入框 */}
        <input
          ref={ref}
          type={inputType}
          value={currentValue}
          onChange={handleChange}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          className={combineClasses(inputClasses, className)}
          {...props}
        />
        
        {/* 清除按钮 */}
        {clearable && currentValue && !disabled && !readOnly && (
          <button
            type="button"
            onClick={handleClear}
            className={combineClasses(
              'flex items-center justify-center text-gray-400 hover:text-gray-600',
              'transition-colors duration-150',
              size === 'sm' ? 'p-1' : 'p-1.5'
            )}
            tabIndex={-1}
          >
            <X size={iconSize} />
          </button>
        )}
        
        {/* 密码切换按钮 */}
        {type === 'password' && showPasswordToggle && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            disabled={disabled || readOnly}
            className={combineClasses(
              'flex items-center justify-center text-gray-400 hover:text-gray-600',
              'transition-colors duration-150',
              size === 'sm' ? 'p-1' : 'p-1.5',
              (disabled || readOnly) && 'cursor-not-allowed opacity-50'
            )}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
          </button>
        )}
        
        {/* 后缀图标 */}
        {suffix && (
          <div className={combineClasses(
            'flex items-center justify-center text-gray-400',
            size === 'sm' ? 'pr-2 pl-1' : 'pr-3 pl-2'
          )}>
            {React.isValidElement(suffix) 
              ? React.cloneElement(suffix, { size: iconSize } as any)
              : suffix
            }
          </div>
        )}
      </div>
      
      {/* 帮助文本和错误文本 */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {errorText && (
            <div className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle size={14} />
              <span>{errorText}</span>
            </div>
          )}
          
          {!errorText && helperText && (
            <div className="text-sm text-gray-500">
              {helperText}
            </div>
          )}
        </div>
        
        {/* 字符计数 */}
        {showCount && maxLength && (
          <div className={combineClasses(
            'text-sm ml-2 flex-shrink-0',
            String(currentValue).length > maxLength * 0.8 
              ? String(currentValue).length >= maxLength 
                ? 'text-red-600' 
                : 'text-yellow-600'
              : 'text-gray-500'
          )}>
            {String(currentValue).length}/{maxLength}
          </div>
        )}
      </div>
    </div>
  )
})

Input.displayName = 'Input'

export default Input
