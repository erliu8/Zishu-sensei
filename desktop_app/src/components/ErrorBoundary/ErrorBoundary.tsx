/**
 * React 错误边界组件
 * 捕获子组件中的 JavaScript 错误并提供恢复机制
 */

import React, { Component, ReactNode, ErrorInfo } from 'react'
import {
  ErrorDetails,
  ErrorBoundaryProps,
  ErrorBoundaryFallbackProps,
  ErrorSeverity,
  ErrorType,
  ErrorSource,
  ErrorStatus,
  RecoveryStrategy,
} from '../../types/error'
import { errorMonitoringService } from '../../services/errorMonitoringService'
import { reportReactError } from '../../utils/globalErrorCatcher'
import ErrorFallbackComponent from './ErrorFallback'

// ================================
// 错误边界状态接口
// ================================

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorDetails: ErrorDetails | null
  errorInfo: ErrorInfo | null
  retryCount: number
  isRecovering: boolean
}

// ================================
// 错误边界组件
// ================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null
  private maxRetries = 3
  
  constructor(props: ErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorDetails: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 更新状态以显示错误界面
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    })

    // 创建错误详情
    const errorDetails = this.createErrorDetails(error, errorInfo)
    this.setState({ errorDetails })

    // 报告错误到全局错误捕获器
    reportReactError(error, errorInfo)

    // 报告错误到监控系统
    this.reportErrorToService(errorDetails)

    // 调用外部错误处理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 尝试自动恢复
    if (this.shouldAttemptRecovery(errorDetails)) {
      this.attemptRecovery(errorDetails)
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  // ================================
  // 错误处理方法
  // ================================

  private createErrorDetails(error: Error, errorInfo: ErrorInfo): ErrorDetails {
    const timestamp = new Date().toISOString()
    
    // 从错误信息中提取组件栈
    const componentStack = errorInfo.componentStack || ''
    const firstComponent = componentStack.split('\n')[1]?.trim()
    
    return {
      id: '',
      errorId: '',
      type: ErrorType.REACT,
      source: ErrorSource.FRONTEND,
      severity: this.classifyErrorSeverity(error),
      status: ErrorStatus.NEW,
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: (error as any).cause ? String((error as any).cause) : undefined,
      context: {
        timestamp,
        sessionId: `session_${Date.now()}`,
        userId: undefined,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        appVersion: '1.0.0',
        buildVersion: '1',
        url: window.location.href,
        route: window.location.pathname,
        component: firstComponent,
        function: 'render',
        metadata: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        },
      },
      recoveryStrategy: this.determineRecoveryStrategy(error),
      recoveryAttempts: 0,
      maxRetries: this.maxRetries,
      canRecover: this.canRecover(error),
      occurrenceCount: 1,
      firstOccurred: timestamp,
      lastOccurred: timestamp,
      resolved: false,
    }
  }

  private classifyErrorSeverity(error: Error): ErrorSeverity {
    const errorName = error.name.toLowerCase()
    const errorMessage = error.message.toLowerCase()

    // 严重错误
    if (errorName.includes('chunkloa') || errorMessage.includes('chunk')) {
      return ErrorSeverity.HIGH // 代码分割加载错误
    }
    
    if (errorName.includes('reference') || errorName.includes('type')) {
      return ErrorSeverity.HIGH // 引用错误和类型错误通常很严重
    }

    // 中等严重错误
    if (errorName.includes('render') || errorMessage.includes('render')) {
      return ErrorSeverity.MEDIUM // 渲染错误
    }

    // 默认为中等
    return ErrorSeverity.MEDIUM
  }

  private determineRecoveryStrategy(error: Error): RecoveryStrategy {
    const errorName = error.name.toLowerCase()
    const errorMessage = error.message.toLowerCase()

    // ChunkLoadError 可以通过刷新页面恢复
    if (errorName.includes('chunkloa') || errorMessage.includes('chunk')) {
      return RecoveryStrategy.REFRESH
    }

    // 其他渲染错误可以尝试重试
    if (errorMessage.includes('render')) {
      return RecoveryStrategy.RETRY
    }

    // 默认需要用户操作
    return RecoveryStrategy.USER_ACTION
  }

  private canRecover(error: Error): boolean {
    const errorName = error.name.toLowerCase()
    
    // 一些错误类型可以自动恢复
    const recoverableErrors = [
      'chunkloa', // ChunkLoadError
      'render',   // 渲染错误
      'network',  // 网络错误
    ]

    return recoverableErrors.some(recoverable => 
      errorName.includes(recoverable) || error.message.toLowerCase().includes(recoverable)
    )
  }

  private async reportErrorToService(errorDetails: ErrorDetails) {
    try {
      await errorMonitoringService.reportError(errorDetails)
    } catch (reportError) {
      console.error('Failed to report error to monitoring service:', reportError)
    }
  }

  private shouldAttemptRecovery(errorDetails: ErrorDetails): boolean {
    return (
      (errorDetails.canRecover ?? false) && 
      this.state.retryCount < this.maxRetries &&
      errorDetails.recoveryStrategy !== RecoveryStrategy.USER_ACTION
    )
  }

  private attemptRecovery(errorDetails: ErrorDetails) {
    const { recoveryStrategy } = errorDetails

    this.setState({ isRecovering: true })

    switch (recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        this.scheduleRetry()
        break
      case RecoveryStrategy.REFRESH:
        this.scheduleRefresh()
        break
      case RecoveryStrategy.FALLBACK:
        this.executeFallback()
        break
      default:
        this.setState({ isRecovering: false })
    }
  }

  private scheduleRetry() {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 5000) // 指数退避，最大5秒

    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorDetails: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
        isRecovering: false,
      })
    }, delay)
  }

  private scheduleRefresh() {
    // 延迟刷新，给用户一点时间看到错误信息
    this.retryTimeoutId = setTimeout(() => {
      window.location.reload()
    }, 3000)
  }

  private executeFallback() {
    // TODO: 实现降级逻辑
    this.setState({ 
      isRecovering: false,
      hasError: false,
    })
  }

  // ================================
  // 用户操作方法
  // ================================

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorDetails: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
        isRecovering: false,
      })
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorDetails: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
    })
  }

  private handleReport = async () => {
    if (this.state.errorDetails) {
      try {
        await errorMonitoringService.reportError(this.state.errorDetails, {
          operation: 'user_report',
          metadata: { userInitiated: true },
        })
        // TODO: 显示成功反馈
      } catch (error) {
        console.error('Failed to report error:', error)
        // TODO: 显示错误反馈
      }
    }
  }

  private handleRefresh = () => {
    window.location.reload()
  }

  // ================================
  // 渲染方法
  // ================================

  render(): ReactNode {
    if (this.state.hasError) {
      const fallbackProps: ErrorBoundaryFallbackProps = {
        error: this.state.error!,
        errorDetails: this.state.errorDetails ?? undefined,
        resetError: this.handleReset,
        reportError: this.handleReport,
      }

      // 使用自定义降级组件
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent {...fallbackProps} />
      }

      // 使用默认降级组件
      return (
        <ErrorFallbackComponent 
          {...fallbackProps}
          onRetry={this.handleRetry}
          onRefresh={this.handleRefresh}
          canRetry={this.state.retryCount < this.maxRetries}
          retryCount={this.state.retryCount}
          maxRetries={this.maxRetries}
          isRecovering={this.state.isRecovering}
          recoveryStrategy={this.state.errorDetails?.recoveryStrategy}
        />
      )
    }

    return this.props.children
  }
}

// ================================
// 高阶组件包装器
// ================================

/**
 * 错误边界 HOC
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`

  return WithErrorBoundaryComponent
}

// ================================
// Hook 形式的错误边界
// ================================

/**
 * Hook 形式的错误处理
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, errorInfo?: ErrorInfo) => {
    errorMonitoringService.reportError(error, {
      component: errorInfo ? 'hook_error_handler' : 'manual_error_handler',
      metadata: errorInfo ? {
        componentStack: errorInfo.componentStack,
      } : undefined,
    })
  }, [])

  return handleError
}

// ================================
// 导出
// ================================

export default ErrorBoundary
