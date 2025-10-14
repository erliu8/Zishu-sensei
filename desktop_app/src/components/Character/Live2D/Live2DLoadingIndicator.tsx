/**
 * Live2D加载指示器组件
 * 
 * 显示Live2D模型的加载状态和进度
 */

import React from 'react'
import {
  Live2DLoadingIndicatorProps,
  Live2DLoadState
} from '@/types/live2d'
import './Live2DLoadingIndicator.css'

/**
 * Live2D加载指示器组件
 */
export const Live2DLoadingIndicator: React.FC<Live2DLoadingIndicatorProps> = ({
  loadState,
  progress = 0,
  stage = '',
  theme,
  message = ''
}) => {
  // 根据加载状态确定显示内容
  const getLoadingContent = () => {
    switch (loadState) {
      case Live2DLoadState.LOADING:
        return {
          icon: '🔄',
          title: '正在加载',
          description: stage || '正在加载Live2D模型...',
          showProgress: true
        }
      
      case Live2DLoadState.SWITCHING:
        return {
          icon: '🔄',
          title: '切换中',
          description: '正在切换模型...',
          showProgress: true
        }
      
      case Live2DLoadState.ERROR:
        return {
          icon: '❌',
          title: '加载失败',
          description: message || '模型加载失败，请检查文件路径或网络连接',
          showProgress: false
        }
      
      default:
        return {
          icon: '⏳',
          title: '准备中',
          description: '正在初始化...',
          showProgress: false
        }
    }
  }

  const content = getLoadingContent()
  const progressPercentage = Math.round(progress * 100)

  // 组件样式
  const containerStyle: React.CSSProperties = {
    backgroundColor: theme?.loading?.backgroundColor || 'rgba(0, 0, 0, 0.8)',
    color: theme?.loading?.color || '#ffffff',
  }

  const progressBarStyle: React.CSSProperties = {
    width: `${progressPercentage}%`,
    backgroundColor: theme?.loading?.color || '#4CAF50',
  }

  return (
    <div className="live2d-loading-indicator" style={containerStyle}>
      <div className="live2d-loading-indicator__content">
        {/* 加载图标 */}
        <div className="live2d-loading-indicator__icon">
          <span className={`live2d-loading-indicator__icon-text ${
            loadState === Live2DLoadState.LOADING || loadState === Live2DLoadState.SWITCHING
              ? 'live2d-loading-indicator__icon-text--spinning'
              : ''
          }`}>
            {content.icon}
          </span>
        </div>

        {/* 加载标题 */}
        <h3 className="live2d-loading-indicator__title">
          {content.title}
        </h3>

        {/* 加载描述 */}
        <p className="live2d-loading-indicator__description">
          {content.description}
        </p>

        {/* 进度条 */}
        {content.showProgress && (
          <div className="live2d-loading-indicator__progress">
            <div className="live2d-loading-indicator__progress-bar">
              <div 
                className="live2d-loading-indicator__progress-fill"
                style={progressBarStyle}
              />
            </div>
            <span className="live2d-loading-indicator__progress-text">
              {progressPercentage}%
            </span>
          </div>
        )}

        {/* 自定义消息 */}
        {message && message !== content.description && (
          <p className="live2d-loading-indicator__message">
            {message}
          </p>
        )}

        {/* 加载状态指示点 */}
        {(loadState === Live2DLoadState.LOADING || loadState === Live2DLoadState.SWITCHING) && (
          <div className="live2d-loading-indicator__dots">
            <span className="live2d-loading-indicator__dot"></span>
            <span className="live2d-loading-indicator__dot"></span>
            <span className="live2d-loading-indicator__dot"></span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Live2DLoadingIndicator
