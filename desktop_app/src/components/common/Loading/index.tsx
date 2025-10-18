/**
 * Loading 加载组件
 * 
 * 功能特性：
 * - 多种加载样式（spinner, dots, bars, pulse, ring）
 * - 多种尺寸支持
 * - 进度显示
 * - 文本提示
 * - 全屏覆盖
 * - 自定义颜色
 */

import React from 'react'
import './styles.css'

/**
 * 加载样式类型
 */
export type LoadingVariant = 'spinner' | 'dots' | 'bars' | 'pulse' | 'ring' | 'progress'

/**
 * 加载尺寸
 */
export type LoadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * Loading 组件属性
 */
export interface LoadingProps {
  /** 加载样式 */
  variant?: LoadingVariant
  
  /** 尺寸 */
  size?: LoadingSize
  
  /** 提示文本 */
  text?: string
  
  /** 进度值 (0-100) */
  progress?: number
  
  /** 是否显示进度文本 */
  showProgress?: boolean
  
  /** 是否全屏显示 */
  fullScreen?: boolean
  
  /** 自定义颜色 */
  color?: string
  
  /** 自定义类名 */
  className?: string
  
  /** 是否显示 */
  visible?: boolean
  
  /** 遮罩层透明度 (0-1) */
  overlayOpacity?: number
}

/**
 * Loading 组件
 */
export const Loading: React.FC<LoadingProps> = ({
  variant = 'spinner',
  size = 'md',
  text,
  progress,
  showProgress = true,
  fullScreen = false,
  color,
  className = '',
  visible = true,
  overlayOpacity = 0.3,
}) => {
  if (!visible) return null

  const renderLoadingIcon = () => {
    const sizeClass = `loading-${size}`
    const style = color ? { color } : undefined

    switch (variant) {
      case 'spinner':
        return (
          <div className={`loading-spinner ${sizeClass}`} style={style}>
            <div className="loading-spinner-circle" />
          </div>
        )

      case 'dots':
        return (
          <div className={`loading-dots ${sizeClass}`} style={style}>
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
        )

      case 'bars':
        return (
          <div className={`loading-bars ${sizeClass}`} style={style}>
            <div className="loading-bar" />
            <div className="loading-bar" />
            <div className="loading-bar" />
            <div className="loading-bar" />
            <div className="loading-bar" />
          </div>
        )

      case 'pulse':
        return (
          <div className={`loading-pulse ${sizeClass}`} style={style}>
            <div className="loading-pulse-ring" />
            <div className="loading-pulse-ring" />
          </div>
        )

      case 'ring':
        return (
          <div className={`loading-ring ${sizeClass}`} style={style}>
            <div className="loading-ring-inner" />
          </div>
        )

      case 'progress':
        return (
          <div className={`loading-progress ${sizeClass}`} style={style}>
            <div
              className="loading-progress-bar"
              style={{ width: `${progress || 0}%` }}
            />
          </div>
        )

      default:
        return null
    }
  }

  const content = (
    <div className={`loading-container ${className}`}>
      {renderLoadingIcon()}
      
      {text && (
        <div className="loading-text" style={color ? { color } : undefined}>
          {text}
        </div>
      )}
      
      {variant === 'progress' && showProgress && progress !== undefined && (
        <div className="loading-progress-text" style={color ? { color } : undefined}>
          {Math.round(progress)}%
        </div>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="loading-overlay"
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      >
        {content}
      </div>
    )
  }

  return content
}

/**
 * 内联 Loading 组件
 */
export const InlineLoading: React.FC<{
  variant?: LoadingVariant
  size?: LoadingSize
  className?: string
}> = ({ variant = 'spinner', size = 'sm', className = '' }) => {
  return (
    <span className={`loading-inline ${className}`}>
      <Loading variant={variant} size={size} />
    </span>
  )
}

export default Loading

