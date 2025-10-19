/**
 * 全局错误捕获器
 * 提供JavaScript、React、Promise等全局错误的统一捕获和处理
 */

import { invoke } from '@tauri-apps/api/tauri'
import { ErrorType, ErrorSource, ErrorSeverity } from '../types/error'

// ================================
// 接口定义
// ================================

export interface GlobalErrorConfig {
  enableJSErrorCapture: boolean
  enablePromiseRejectionCapture: boolean
  enableResourceErrorCapture: boolean
  enableUnhandledRejectionCapture: boolean
  enableConsoleErrorCapture: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  autoReport: boolean
  excludePatterns: RegExp[]
  maxErrorsPerSession: number
  debugMode: boolean
}

export interface CapturedError {
  type: ErrorType
  source: ErrorSource
  severity: ErrorSeverity
  name: string
  message: string
  stack?: string
  filename?: string
  lineno?: number
  colno?: number
  timestamp: number
  userAgent: string
  url: string
  sessionId: string
}

// ================================
// 全局错误捕获器类
// ================================

export class GlobalErrorCatcher {
  private config: GlobalErrorConfig
  private sessionId: string
  private errorCount: number = 0
  private listeners: Array<(error: CapturedError) => void> = []
  private originalConsoleError: typeof console.error

  constructor(config: Partial<GlobalErrorConfig> = {}) {
    this.config = {
      enableJSErrorCapture: true,
      enablePromiseRejectionCapture: true,
      enableResourceErrorCapture: true,
      enableUnhandledRejectionCapture: true,
      enableConsoleErrorCapture: false,
      logLevel: 'error',
      autoReport: true,
      excludePatterns: [
        /Script error/i,
        /Non-Error promise rejection captured/i,
        /Loading chunk \d+ failed/i,
      ],
      maxErrorsPerSession: 100,
      debugMode: false,
      ...config,
    }

    this.sessionId = this.generateSessionId()
    this.originalConsoleError = console.error
    this.setupErrorHandlers()
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 设置全局错误处理器
   */
  private setupErrorHandlers(): void {
    // JavaScript 错误捕获
    if (this.config.enableJSErrorCapture) {
      window.addEventListener('error', this.handleJavaScriptError.bind(this))
    }

    // Promise 未捕获拒绝
    if (this.config.enablePromiseRejectionCapture) {
      window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this))
    }

    // 资源加载错误
    if (this.config.enableResourceErrorCapture) {
      window.addEventListener('error', this.handleResourceError.bind(this), true)
    }

    // Console 错误捕获
    if (this.config.enableConsoleErrorCapture) {
      this.setupConsoleErrorCapture()
    }

    // 处理 React 错误边界未捕获的错误
    this.setupReactErrorCapture()
  }

  /**
   * 处理 JavaScript 错误
   */
  private handleJavaScriptError(event: ErrorEvent): void {
    if (!this.shouldCaptureError(event.message)) {
      return
    }

    const error: CapturedError = {
      type: ErrorType.JAVASCRIPT,
      source: ErrorSource.FRONTEND,
      severity: this.determineSeverity(event.error, event.message),
      name: event.error?.name || 'JavaScript Error',
      message: event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
    }

    this.captureError(error)
  }

  /**
   * 处理 Promise 拒绝
   */
  private handlePromiseRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason
    let message = 'Unhandled Promise Rejection'
    let stack: string | undefined
    let name = 'Promise Rejection'

    if (reason instanceof Error) {
      message = reason.message
      stack = reason.stack
      name = reason.name
    } else if (typeof reason === 'string') {
      message = reason
    } else {
      message = `Promise rejected with: ${JSON.stringify(reason)}`
    }

    if (!this.shouldCaptureError(message)) {
      return
    }

    const error: CapturedError = {
      type: ErrorType.JAVASCRIPT,
      source: ErrorSource.FRONTEND,
      severity: this.determineSeverity(reason, message),
      name,
      message,
      stack,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
    }

    this.captureError(error)

    // 防止控制台错误
    event.preventDefault()
  }

  /**
   * 处理资源加载错误
   */
  private handleResourceError(event: Event): void {
    const target = event.target as HTMLElement
    
    // 只处理资源加载错误，不处理脚本错误
    if (!target || target === window) {
      return
    }

    let resourceType = 'unknown'
    let resourceUrl = ''

    if (target instanceof HTMLImageElement) {
      resourceType = 'image'
      resourceUrl = target.src
    } else if (target instanceof HTMLScriptElement) {
      resourceType = 'script'
      resourceUrl = target.src
    } else if (target instanceof HTMLLinkElement) {
      resourceType = 'stylesheet'
      resourceUrl = target.href
    }

    const error: CapturedError = {
      type: ErrorType.FILE,
      source: ErrorSource.EXTERNAL,
      severity: ErrorSeverity.MEDIUM,
      name: 'Resource Load Error',
      message: `Failed to load ${resourceType}: ${resourceUrl}`,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
    }

    this.captureError(error)
  }

  /**
   * 设置 Console 错误捕获
   */
  private setupConsoleErrorCapture(): void {
    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')

      const error: CapturedError = {
        type: ErrorType.JAVASCRIPT,
        source: ErrorSource.FRONTEND,
        severity: ErrorSeverity.HIGH,
        name: 'Console Error',
        message,
        stack: new Error().stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.sessionId,
      }

      this.captureError(error)
      
      // 调用原始 console.error
      this.originalConsoleError.apply(console, args)
    }
  }

  /**
   * 设置 React 错误捕获
   */
  private setupReactErrorCapture(): void {
    // 监听自定义的 React 错误事件
    window.addEventListener('react-error', ((event: CustomEvent) => {
      const { error, errorInfo } = event.detail

      const capturedError: CapturedError = {
        type: ErrorType.REACT,
        source: ErrorSource.FRONTEND,
        severity: ErrorSeverity.HIGH,
        name: error.name || 'React Error',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.sessionId,
      }

      this.captureError(capturedError)
    }) as EventListener)
  }

  /**
   * 手动捕获错误
   */
  public captureException(
    error: Error,
    context: {
      type?: ErrorType
      source?: ErrorSource
      severity?: ErrorSeverity
      extra?: Record<string, any>
    } = {}
  ): void {
    const capturedError: CapturedError = {
      type: context.type || ErrorType.JAVASCRIPT,
      source: context.source || ErrorSource.FRONTEND,
      severity: context.severity || this.determineSeverity(error, error.message),
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
    }

    this.captureError(capturedError)
  }

  /**
   * 捕获错误的核心处理逻辑
   */
  private captureError(error: CapturedError): void {
    // 检查错误计数限制
    if (this.errorCount >= this.config.maxErrorsPerSession) {
      if (this.config.debugMode) {
        console.warn('Global error catcher: Maximum errors per session reached')
      }
      return
    }

    this.errorCount++

    // 调试模式下打印错误
    if (this.config.debugMode) {
      console.log('Global error captured:', error)
    }

    // 通知监听器
    this.listeners.forEach(listener => {
      try {
        listener(error)
      } catch (e) {
        console.error('Error in global error listener:', e)
      }
    })

    // 自动报告错误
    if (this.config.autoReport) {
      this.reportError(error).catch(e => {
        if (this.config.debugMode) {
          console.error('Failed to auto-report error:', e)
        }
      })
    }
  }

  /**
   * 报告错误到后端
   */
  private async reportError(error: CapturedError): Promise<void> {
    try {
      const context = {
        timestamp: new Date(error.timestamp).toISOString(),
        session_id: error.sessionId,
        user_id: null,
        user_agent: error.userAgent,
        platform: navigator.platform,
        app_version: await this.getAppVersion(),
        build_version: await this.getBuildVersion(),
        url: error.url,
        route: this.getCurrentRoute(),
        component: null,
        function: null,
        line: error.lineno,
        column: error.colno,
        operation: 'global_error_capture',
        parameters: null,
        state: null,
        metadata: {
          filename: error.filename,
          error_count: this.errorCount,
        },
      }

      const result = await invoke('report_error', {
        request: {
          error_type: error.type,
          source: error.source,
          severity: error.severity,
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: null,
          context,
        },
      })

      if (this.config.debugMode) {
        console.log('Error reported successfully:', result)
      }
    } catch (e) {
      console.error('Failed to report error:', e)
    }
  }

  /**
   * 判断是否应该捕获此错误
   */
  private shouldCaptureError(message: string): boolean {
    // 检查排除模式
    for (const pattern of this.config.excludePatterns) {
      if (pattern.test(message)) {
        return false
      }
    }

    return true
  }

  /**
   * 确定错误严重程度
   */
  private determineSeverity(error: any, message: string): ErrorSeverity {
    const lowerMessage = message.toLowerCase()

    // 严重错误
    if (lowerMessage.includes('fatal') || 
        lowerMessage.includes('critical') ||
        lowerMessage.includes('out of memory') ||
        lowerMessage.includes('stack overflow')) {
      return ErrorSeverity.CRITICAL
    }

    // 高级错误
    if (error instanceof TypeError ||
        error instanceof ReferenceError ||
        lowerMessage.includes('cannot read') ||
        lowerMessage.includes('undefined is not')) {
      return ErrorSeverity.HIGH
    }

    // 中级错误
    if (lowerMessage.includes('network') ||
        lowerMessage.includes('fetch') ||
        lowerMessage.includes('timeout')) {
      return ErrorSeverity.MEDIUM
    }

    return ErrorSeverity.LOW
  }

  /**
   * 获取应用版本
   */
  private async getAppVersion(): Promise<string> {
    try {
      return await invoke('get_app_version')
    } catch {
      return '1.0.0'
    }
  }

  /**
   * 获取构建版本
   */
  private async getBuildVersion(): Promise<string> {
    try {
      return await invoke('get_build_version')
    } catch {
      return '100'
    }
  }

  /**
   * 获取当前路由
   */
  private getCurrentRoute(): string {
    return window.location.pathname + window.location.search
  }

  /**
   * 添加错误监听器
   */
  public addListener(listener: (error: CapturedError) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<GlobalErrorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 获取错误统计
   */
  public getErrorStats(): {
    sessionId: string
    errorCount: number
    startTime: number
  } {
    return {
      sessionId: this.sessionId,
      errorCount: this.errorCount,
      startTime: parseInt(this.sessionId.split('-')[1]),
    }
  }

  /**
   * 重置错误计数
   */
  public resetErrorCount(): void {
    this.errorCount = 0
  }

  /**
   * 销毁错误捕获器
   */
  public destroy(): void {
    window.removeEventListener('error', this.handleJavaScriptError.bind(this))
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection.bind(this))
    window.removeEventListener('error', this.handleResourceError.bind(this), true)
    
    // 恢复原始 console.error
    console.error = this.originalConsoleError
    
    // 清空监听器
    this.listeners = []
  }
}

// ================================
// 导出单例实例
// ================================

export const globalErrorCatcher = new GlobalErrorCatcher()

// ================================
// React 错误边界辅助函数
// ================================

/**
 * 为 React 错误边界提供的错误报告函数
 */
export function reportReactError(error: Error, errorInfo: React.ErrorInfo): void {
  // 发送自定义事件给全局错误捕获器
  const event = new CustomEvent('react-error', {
    detail: { error, errorInfo }
  })
  window.dispatchEvent(event)
}

// ================================
// 工具函数
// ================================

/**
 * 初始化全局错误捕获
 */
export function initializeGlobalErrorCatcher(config?: Partial<GlobalErrorConfig>): void {
  if (config) {
    globalErrorCatcher.updateConfig(config)
  }
  
  // 添加页面卸载时的清理
  window.addEventListener('beforeunload', () => {
    globalErrorCatcher.destroy()
  })
}
