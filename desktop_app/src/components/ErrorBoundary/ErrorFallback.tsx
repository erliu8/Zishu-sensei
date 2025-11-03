/**
 * 错误降级显示组件
 * 当错误边界捕获到错误时显示的用户友好界面
 */

import React from 'react'
import { 
  ErrorBoundaryFallbackProps, 
  ErrorDetails as ErrorDetailsType, 
  ErrorSeverity,
  RecoveryStrategy,
} from '../../types/error'
import './ErrorFallback.css'

// ================================
// 扩展的降级组件属性
// ================================

interface ExtendedErrorFallbackProps extends ErrorBoundaryFallbackProps {
  onRetry?: () => void
  onRefresh?: () => void
  canRetry?: boolean
  retryCount?: number
  maxRetries?: number
  isRecovering?: boolean
  recoveryStrategy?: RecoveryStrategy
}

// ================================
// 错误图标组件
// ================================

const ErrorIcon: React.FC<{ severity: ErrorSeverity }> = ({ severity }) => {
  const getIconColor = () => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '#dc2626' // 红色
      case ErrorSeverity.HIGH:
        return '#ea580c' // 橙色
      case ErrorSeverity.MEDIUM:
        return '#ca8a04' // 黄色
      case ErrorSeverity.LOW:
        return '#059669' // 绿色
      default:
        return '#6b7280' // 灰色
    }
  }

  return (
    <div className="error-icon" style={{ color: getIconColor() }}>
      {severity === ErrorSeverity.CRITICAL ? (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      ) : (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      )}
    </div>
  )
}

// ================================
// 错误详情组件
// ================================

const ErrorDetails: React.FC<{ error: Error; errorDetails?: ErrorDetailsType | null }> = ({ 
  error, 
  errorDetails 
}) => {
  const [showDetails, setShowDetails] = React.useState(false)

  return (
    <div className="error-details">
      <button
        className="error-details-toggle"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? '隐藏详情' : '显示详情'}
        <span className={`arrow ${showDetails ? 'arrow-up' : 'arrow-down'}`}>
          ▼
        </span>
      </button>

      {showDetails && (
        <div className="error-details-content">
          <div className="error-section">
            <h4>错误信息</h4>
            <p><strong>类型：</strong>{error.name}</p>
            <p><strong>消息：</strong>{error.message}</p>
            {errorDetails?.type && (
              <p><strong>分类：</strong>{errorDetails.type}</p>
            )}
            {errorDetails?.severity && (
              <p><strong>严重程度：</strong>{errorDetails.severity}</p>
            )}
          </div>

          {error.stack && (
            <div className="error-section">
              <h4>错误堆栈</h4>
              <pre className="error-stack">
                {error.stack}
              </pre>
            </div>
          )}

          {errorDetails?.context && (
            <div className="error-section">
              <h4>上下文信息</h4>
              <div className="error-context">
                {errorDetails.context.component && (
                  <p><strong>组件：</strong>{errorDetails.context.component}</p>
                )}
                {errorDetails.context.function && (
                  <p><strong>函数：</strong>{errorDetails.context.function}</p>
                )}
                {errorDetails.context.url && (
                  <p><strong>页面：</strong>{errorDetails.context.url}</p>
                )}
                {errorDetails.context.timestamp && (
                  <p><strong>时间：</strong>{new Date(errorDetails.context.timestamp).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ================================
// 恢复建议组件
// ================================

const RecoverySuggestions: React.FC<{ 
  error: Error
  errorDetails?: ErrorDetailsType | null
  recoveryStrategy?: RecoveryStrategy 
}> = ({ error, recoveryStrategy }) => {
  const getSuggestions = () => {
    const suggestions: string[] = []

    if (recoveryStrategy === RecoveryStrategy.RETRY) {
      suggestions.push('此错误可能是临时的，请尝试重新加载')
    } else if (recoveryStrategy === RecoveryStrategy.REFRESH) {
      suggestions.push('建议刷新页面以恢复正常状态')
    } else if (recoveryStrategy === RecoveryStrategy.RESTART) {
      suggestions.push('建议重启应用程序以解决问题')
    }

    if (error.message.toLowerCase().includes('network')) {
      suggestions.push('检查网络连接是否正常')
    }

    if (error.message.toLowerCase().includes('chunk')) {
      suggestions.push('可能是代码更新导致的，刷新页面即可解决')
    }

    if (error.name === 'TypeError') {
      suggestions.push('可能是数据格式不匹配，请检查输入数据')
    }

    if (suggestions.length === 0) {
      suggestions.push('请尝试刷新页面，如果问题持续存在，请联系技术支持')
    }

    return suggestions
  }

  const suggestions = getSuggestions()

  return (
    <div className="recovery-suggestions">
      <h4>解决建议</h4>
      <ul>
        {suggestions.map((suggestion, index) => (
          <li key={index}>{suggestion}</li>
        ))}
      </ul>
    </div>
  )
}

// ================================
// 操作按钮组件
// ================================

const ActionButtons: React.FC<{
  onRetry?: () => void
  onRefresh?: () => void
  reportError: () => void
  resetError: () => void
  canRetry?: boolean
  isRecovering?: boolean
  recoveryStrategy?: RecoveryStrategy
}> = ({ 
  onRetry, 
  onRefresh, 
  reportError, 
  resetError, 
  canRetry, 
  isRecovering
}) => {
  return (
    <div className="error-actions">
      <div className="primary-actions">
        {canRetry && onRetry && (
          <button
            className="button button-primary"
            onClick={onRetry}
            disabled={isRecovering}
          >
            {isRecovering ? '恢复中...' : '重试'}
          </button>
        )}

        {onRefresh && (
          <button
            className="button button-secondary"
            onClick={onRefresh}
            disabled={isRecovering}
          >
            刷新页面
          </button>
        )}

        <button
          className="button button-secondary"
          onClick={resetError}
          disabled={isRecovering}
        >
          重置
        </button>
      </div>

      <div className="secondary-actions">
        <button
          className="button button-outline"
          onClick={reportError}
          disabled={isRecovering}
        >
          报告问题
        </button>
      </div>
    </div>
  )
}

// ================================
// 主要降级组件
// ================================

const ErrorFallbackComponent: React.FC<ExtendedErrorFallbackProps> = ({
  error,
  errorDetails,
  resetError,
  reportError,
  onRetry,
  onRefresh,
  canRetry = false,
  retryCount = 0,
  maxRetries = 3,
  isRecovering = false,
  recoveryStrategy,
}) => {
  const severity = errorDetails?.severity || ErrorSeverity.MEDIUM

  const getTitle = () => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '严重错误'
      case ErrorSeverity.HIGH:
        return '应用错误'
      case ErrorSeverity.MEDIUM:
        return '出现了一些问题'
      case ErrorSeverity.LOW:
        return '轻微问题'
      default:
        return '出现了问题'
    }
  }

  const getMessage = () => {
    if (error.message.toLowerCase().includes('chunk')) {
      return '应用代码加载失败，这通常发生在应用更新后。'
    }
    
    if (error.message.toLowerCase().includes('network')) {
      return '网络连接出现问题，请检查您的网络设置。'
    }

    if (severity === ErrorSeverity.CRITICAL) {
      return '应用遇到了严重错误，可能需要重新启动。'
    }

    return '应用在运行过程中遇到了问题，但这通常是可以解决的。'
  }

  return (
    <div className={`error-fallback error-fallback-${severity}`}>
      <div className="error-container">
        <div className="error-header">
          <ErrorIcon severity={severity} />
          <div className="error-title-section">
            <h1 className="error-title">{getTitle()}</h1>
            <p className="error-message">{getMessage()}</p>
            {retryCount > 0 && (
              <p className="error-retry-info">
                已重试 {retryCount}/{maxRetries} 次
              </p>
            )}
          </div>
        </div>

        <div className="error-content">
          <RecoverySuggestions 
            error={error} 
            errorDetails={errorDetails}
            recoveryStrategy={recoveryStrategy}
          />

          <ErrorDetails 
            error={error} 
            errorDetails={errorDetails} 
          />

          <ActionButtons
            onRetry={onRetry}
            onRefresh={onRefresh}
            reportError={reportError}
            resetError={resetError}
            canRetry={canRetry}
            isRecovering={isRecovering}
            recoveryStrategy={recoveryStrategy}
          />
        </div>

        {isRecovering && (
          <div className="error-overlay">
            <div className="recovery-spinner">
              <div className="spinner"></div>
              <p>正在尝试恢复...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ErrorFallbackComponent
