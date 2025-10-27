/**
 * 错误监控服务
 * 提供全面的错误捕获、处理、上报和恢复功能
 */

import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { 
  ErrorDetails, 
  ErrorStatistics, 
  ErrorSeverity, 
  ErrorType, 
  ErrorSource, 
  ErrorStatus,
  ErrorContext,
  ErrorMonitorConfig,
  RecoveryStrategy,
  RecoveryResult,
  // RecoveryAction,
  // ErrorMatcher,
  // ErrorHandler,
  ErrorFilter,
  ErrorClassifier,
  ErrorAggregator
} from '../types/error'

// ================================
// 服务接口
// ================================

export interface IErrorMonitoringService {
  // 初始化和配置
  initialize(): Promise<void>
  updateConfig(config: Partial<ErrorMonitorConfig>): Promise<void>
  getConfig(): ErrorMonitorConfig
  
  // 错误处理
  reportError(error: Error | ErrorDetails, context?: Partial<ErrorContext>): Promise<string>
  handleError(error: Error, context?: Partial<ErrorContext>): Promise<RecoveryResult>
  
  // 错误查询
  getErrors(filter?: ErrorFilter, limit?: number, offset?: number): Promise<ErrorDetails[]>
  getErrorDetails(errorId: string): Promise<ErrorDetails | null>
  getStatistics(): Promise<ErrorStatistics>
  
  // 错误管理
  resolveError(errorId: string, resolution?: string): Promise<void>
  updateErrorStatus(errorId: string, status: ErrorStatus, resolution?: string): Promise<void>
  batchResolveErrors(errorIds: string[], resolution: string): Promise<number>
  
  // 清理和维护
  cleanupOldErrors(retentionDays?: number): Promise<number>
  
  // 监听器
  onError(callback: (error: ErrorDetails) => void): () => void
  onRecovery(callback: (result: RecoveryResult) => void): () => void
}

// ================================
// 错误分类器实现
// ================================

export class DefaultErrorClassifier implements ErrorClassifier {
  classifyError(error: Error): { type: ErrorType; severity: ErrorSeverity } {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''
    
    // 基于错误名称和消息分类
    let type: ErrorType = ErrorType.UNKNOWN
    let severity: ErrorSeverity = ErrorSeverity.MEDIUM
    
    // 网络错误
    if (message.includes('network') || message.includes('fetch') || message.includes('request')) {
      type = ErrorType.NETWORK
      severity = ErrorSeverity.MEDIUM
    }
    // API错误
    else if (message.includes('api') || message.includes('response') || message.includes('status')) {
      type = ErrorType.API
      severity = ErrorSeverity.MEDIUM
    }
    // 超时错误
    else if (message.includes('timeout') || message.includes('aborted')) {
      type = ErrorType.TIMEOUT
      severity = ErrorSeverity.LOW
    }
    // 权限错误
    else if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      type = ErrorType.PERMISSION
      severity = ErrorSeverity.HIGH
    }
    // 验证错误
    else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      type = ErrorType.VALIDATION
      severity = ErrorSeverity.LOW
    }
    // 内存错误
    else if (message.includes('memory') || message.includes('out of memory') || message.includes('allocation')) {
      type = ErrorType.MEMORY
      severity = ErrorSeverity.CRITICAL
    }
    // 文件错误
    else if (message.includes('file') || message.includes('directory') || message.includes('path')) {
      type = ErrorType.FILE
      severity = ErrorSeverity.MEDIUM
    }
    // React错误
    else if (stack.includes('react') || error.name.includes('React')) {
      type = ErrorType.REACT
      severity = ErrorSeverity.HIGH
    }
    // JavaScript错误
    else if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
      type = ErrorType.JAVASCRIPT
      severity = ErrorSeverity.HIGH
    }
    
    // 基于错误名称调整严重程度
    if (error.name === 'ChunkLoadError' || error.name === 'Loading chunk') {
      type = ErrorType.JAVASCRIPT
      severity = ErrorSeverity.MEDIUM
    }
    
    return { type, severity }
  }
  
  isRetryable(error: ErrorDetails): boolean {
    // 可重试的错误类型
    const retryableTypes = [
      ErrorType.NETWORK,
      ErrorType.API,
      ErrorType.TIMEOUT,
      ErrorType.SYSTEM
    ]
    
    return retryableTypes.includes(error.type) && error.severity !== ErrorSeverity.CRITICAL
  }
  
  shouldReport(error: ErrorDetails): boolean {
    // 不上报的错误类型
    const skipReportTypes = [ErrorType.USER_INPUT, ErrorType.VALIDATION]
    
    // 只上报中等以上严重程度的错误
    return !skipReportTypes.includes(error.type) && 
           error.severity !== ErrorSeverity.LOW &&
           error.occurrenceCount <= 10 // 避免重复上报过多次的错误
  }
  
  canRecover(error: ErrorDetails): boolean {
    // 可以自动恢复的错误类型
    const recoverableTypes = [
      ErrorType.NETWORK,
      ErrorType.API,
      ErrorType.TIMEOUT,
      ErrorType.JAVASCRIPT
    ]
    
    return recoverableTypes.includes(error.type) && error.severity !== ErrorSeverity.CRITICAL
  }
}

// ================================
// 错误聚合器实现
// ================================

export class DefaultErrorAggregator implements ErrorAggregator {
  groupSimilarErrors(errors: ErrorDetails[]): Map<string, ErrorDetails[]> {
    const groups = new Map<string, ErrorDetails[]>()
    
    for (const error of errors) {
      const signature = this.generateSignature(error)
      if (!groups.has(signature)) {
        groups.set(signature, [])
      }
      groups.get(signature)!.push(error)
    }
    
    return groups
  }
  
  generateSignature(error: ErrorDetails): string {
    // 基于错误特征生成签名
    const components = [
      error.type,
      error.name,
      error.message.substring(0, 100), // 取消息的前100个字符
      error.context.component || 'unknown',
      error.context.function || 'unknown'
    ]
    
    return components.join('|').replace(/\s+/g, ' ').toLowerCase()
  }
  
  findDuplicates(error: ErrorDetails, existing: ErrorDetails[]): ErrorDetails[] {
    const signature = this.generateSignature(error)
    
    return existing.filter(e => this.generateSignature(e) === signature)
  }
}

// ================================
// 主要服务实现
// ================================

export class ErrorMonitoringService implements IErrorMonitoringService {
  private config: ErrorMonitorConfig
  private errorListeners: ((error: ErrorDetails) => void)[] = []
  private recoveryListeners: ((result: RecoveryResult) => void)[] = []
  private classifier: ErrorClassifier
  // private aggregator: ErrorAggregator
  // private errorHandlers: Map<string, ErrorHandler> = new Map()
  // private globalErrorHandler?: ErrorHandler
  private sessionId: string
  private isInitialized = false
  
  constructor() {
    this.config = this.getDefaultConfig()
    this.classifier = new DefaultErrorClassifier()
    // this.aggregator = new DefaultErrorAggregator()
    this.sessionId = this.generateSessionId()
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    try {
      // 获取服务器配置
      const result = await invoke<{success: boolean; data?: ErrorMonitorConfig}>('get_error_monitor_config')
      if (result.success && result.data) {
        this.config = { ...this.config, ...result.data }
      }
      
      // 设置全局错误捕获
      this.setupGlobalErrorHandlers()
      
      // 监听系统事件
      this.setupEventListeners()
      
      this.isInitialized = true
      
      console.log('Error monitoring service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize error monitoring service:', error)
      throw error
    }
  }
  
  async updateConfig(newConfig: Partial<ErrorMonitorConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }
    
    try {
      await invoke('update_error_monitor_config', { newConfig: this.config })
    } catch (error) {
      console.error('Failed to update error monitor config:', error)
      throw error
    }
  }
  
  getConfig(): ErrorMonitorConfig {
    return { ...this.config }
  }
  
  async reportError(error: Error | ErrorDetails, context?: Partial<ErrorContext>): Promise<string> {
    try {
      let errorDetails: ErrorDetails
      
      if (error instanceof Error) {
        errorDetails = this.transformErrorToDetails(error, context)
      } else {
        errorDetails = error
      }
      
      // 转换为后端请求格式
      const request = {
        errorType: errorDetails.type,
        source: errorDetails.source,
        severity: errorDetails.severity,
        name: errorDetails.name,
        message: errorDetails.message,
        stack: errorDetails.stack,
        cause: errorDetails.cause,
        context: {
          timestamp: errorDetails.context.timestamp,
          sessionId: errorDetails.context.sessionId,
          userId: errorDetails.context.userId,
          userAgent: errorDetails.context.userAgent,
          platform: errorDetails.context.platform,
          appVersion: errorDetails.context.appVersion,
          buildVersion: errorDetails.context.buildVersion,
          url: errorDetails.context.url,
          route: errorDetails.context.route,
          component: errorDetails.context.component,
          function: errorDetails.context.function,
          line: errorDetails.context.line,
          column: errorDetails.context.column,
          operation: errorDetails.context.operation,
          parameters: errorDetails.context.parameters,
          state: errorDetails.context.state,
          metadata: errorDetails.context.metadata,
        }
      }
      
      const result = await invoke<{success: boolean; data?: string; error?: string}>('report_error', { request })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to report error')
      }
      
      const errorId = result.data!
      errorDetails.errorId = errorId
      
      // 通知监听器
      this.errorListeners.forEach(listener => {
        try {
          listener(errorDetails)
        } catch (e) {
          console.error('Error in error listener:', e)
        }
      })
      
      return errorId
    } catch (err) {
      console.error('Failed to report error:', err)
      throw err
    }
  }
  
  async handleError(error: Error, context?: Partial<ErrorContext>): Promise<RecoveryResult> {
    const errorDetails = this.transformErrorToDetails(error, context)
    
    // 报告错误
    try {
      await this.reportError(errorDetails)
    } catch (reportErr) {
      console.error('Failed to report error during handling:', reportErr)
    }
    
    // 尝试恢复
    const result = await this.attemptRecovery(errorDetails)
    
    // 通知恢复监听器
    this.recoveryListeners.forEach(listener => {
      try {
        listener(result)
      } catch (e) {
        console.error('Error in recovery listener:', e)
      }
    })
    
    return result
  }
  
  async getErrors(filter?: ErrorFilter, limit = 50, offset = 0): Promise<ErrorDetails[]> {
    try {
      const request = {
        limit,
        offset,
        severityFilter: undefined,
        typeFilter: undefined,
        statusFilter: undefined,
      }
      
      const result = await invoke<{success: boolean; data?: ErrorDetails[]; error?: string}>('get_error_list', { request })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get error list')
      }
      
      let errors = result.data || []
      
      // 应用前端过滤器
      if (filter) {
        errors = errors.filter(filter)
      }
      
      return errors
    } catch (error) {
      console.error('Failed to get error list:', error)
      throw error
    }
  }
  
  async getErrorDetails(errorId: string): Promise<ErrorDetails | null> {
    try {
      const result = await invoke<{success: boolean; data?: ErrorDetails; error?: string}>('get_error_details', { errorId })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get error details')
      }
      
      return result.data || null
    } catch (error) {
      console.error('Failed to get error details:', error)
      throw error
    }
  }
  
  async getStatistics(): Promise<ErrorStatistics> {
    try {
      const result = await invoke<{success: boolean; data?: ErrorStatistics; error?: string}>('get_error_statistics')
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get error statistics')
      }
      
      return result.data!
    } catch (error) {
      console.error('Failed to get error statistics:', error)
      throw error
    }
  }
  
  async resolveError(errorId: string, resolution?: string): Promise<void> {
    await this.updateErrorStatus(errorId, ErrorStatus.RESOLVED, resolution)
  }
  
  async updateErrorStatus(errorId: string, status: ErrorStatus, resolution?: string): Promise<void> {
    try {
      const request = {
        errorId,
        status,
        resolution,
      }
      
      const result = await invoke<{success: boolean; error?: string}>('update_error_status', { request })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update error status')
      }
    } catch (error) {
      console.error('Failed to update error status:', error)
      throw error
    }
  }
  
  async batchResolveErrors(errorIds: string[], resolution: string): Promise<number> {
    try {
      const result = await invoke<{success: boolean; data?: number; error?: string}>('batch_resolve_errors', { 
        errorIds, 
        resolution 
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to batch resolve errors')
      }
      
      return result.data || 0
    } catch (error) {
      console.error('Failed to batch resolve errors:', error)
      throw error
    }
  }
  
  async cleanupOldErrors(retentionDays?: number): Promise<number> {
    try {
      const result = await invoke<{success: boolean; data?: number; error?: string}>('cleanup_old_errors', { 
        retentionDays 
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to cleanup old errors')
      }
      
      return result.data || 0
    } catch (error) {
      console.error('Failed to cleanup old errors:', error)
      throw error
    }
  }
  
  onError(callback: (error: ErrorDetails) => void): () => void {
    this.errorListeners.push(callback)
    
    return () => {
      const index = this.errorListeners.indexOf(callback)
      if (index > -1) {
        this.errorListeners.splice(index, 1)
      }
    }
  }
  
  onRecovery(callback: (result: RecoveryResult) => void): () => void {
    this.recoveryListeners.push(callback)
    
    return () => {
      const index = this.recoveryListeners.indexOf(callback)
      if (index > -1) {
        this.recoveryListeners.splice(index, 1)
      }
    }
  }
  
  // ================================
  // 内部辅助方法
  // ================================
  
  private setupGlobalErrorHandlers(): void {
    if (!this.config.enabled) return
    
    // JavaScript错误捕获
    if (this.config.captureJSErrors) {
      window.addEventListener('error', (event) => {
        this.handleError(event.error, {
          url: event.filename,
          line: event.lineno,
          column: event.colno,
        })
      })
    }
    
    // Promise拒绝捕获
    if (this.config.capturePromiseRejections) {
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
        this.handleError(error, {
          operation: 'unhandled_promise_rejection',
        })
      })
    }
    
    // 控制台错误捕获
    if (this.config.captureConsoleErrors) {
      const originalError = console.error
      console.error = (...args) => {
        originalError.apply(console, args)
        
        if (args.length > 0 && args[0] instanceof Error) {
          this.handleError(args[0], {
            operation: 'console_error',
          })
        }
      }
    }
  }
  
  private async setupEventListeners(): Promise<void> {
    try {
      // 监听系统事件
      await listen('system-error', (event) => {
        const error = new Error('System error: ' + event.payload)
        const errorDetails = this.transformErrorToDetails(error, {
          metadata: { systemEvent: event.payload },
        })
        errorDetails.source = ErrorSource.SYSTEM
        this.reportError(errorDetails)
      })
      
      await listen('tauri-error', (event) => {
        const error = new Error('Tauri error: ' + event.payload)
        const errorDetails = this.transformErrorToDetails(error, {
          metadata: { tauriEvent: event.payload },
        })
        errorDetails.source = ErrorSource.BACKEND
        this.reportError(errorDetails)
      })
    } catch (error) {
      console.warn('Failed to setup event listeners:', error)
    }
  }
  
  private transformErrorToDetails(error: Error, context?: Partial<ErrorContext>): ErrorDetails {
    const classification = this.classifier.classifyError(error)
    const timestamp = new Date().toISOString()
    
    const errorContext: ErrorContext = {
      timestamp,
      sessionId: this.sessionId,
      userId: undefined,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      appVersion: '1.0.0', // TODO: 从应用配置中获取
      buildVersion: '1', // TODO: 从应用配置中获取
      url: window.location.href,
      route: window.location.pathname,
      ...context,
    }
    
    return {
      id: '', // 将由后端生成
      errorId: '', // 将由后端生成
      type: classification.type,
      source: ErrorSource.FRONTEND,
      severity: classification.severity,
      status: ErrorStatus.NEW,
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: (error as any).cause ? String((error as any).cause) : undefined,
      context: errorContext,
      recoveryStrategy: this.determineRecoveryStrategy(classification.type, classification.severity),
      recoveryAttempts: 0,
      maxRetries: 3,
      canRecover: this.classifier.canRecover({
        type: classification.type,
        severity: classification.severity,
      } as ErrorDetails),
      occurrenceCount: 1,
      firstOccurred: timestamp,
      lastOccurred: timestamp,
      resolved: false,
    }
  }
  
  private determineRecoveryStrategy(type: ErrorType, severity: ErrorSeverity): RecoveryStrategy {
    if (severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.RESTART
    }
    
    switch (type) {
      case ErrorType.NETWORK:
      case ErrorType.API:
      case ErrorType.TIMEOUT:
        return RecoveryStrategy.RETRY
      case ErrorType.JAVASCRIPT:
      case ErrorType.REACT:
        return RecoveryStrategy.REFRESH
      case ErrorType.MEMORY:
        return RecoveryStrategy.RESTART
      default:
        return RecoveryStrategy.USER_ACTION
    }
  }
  
  private async attemptRecovery(error: ErrorDetails): Promise<RecoveryResult> {
    const startTime = Date.now()
    const strategy = error.recoveryStrategy || RecoveryStrategy.NONE
    
    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          return await this.retryOperation(error)
        case RecoveryStrategy.FALLBACK:
          return await this.executeFallback(error)
        case RecoveryStrategy.REFRESH:
          return this.refreshPage()
        case RecoveryStrategy.RESTART:
          return this.restartApplication()
        default:
          return {
            success: false,
            strategy,
            attempts: 0,
            duration: Date.now() - startTime,
            message: 'No recovery strategy available',
          }
      }
    } catch (recoveryError) {
      return {
        success: false,
        strategy,
        attempts: error.recoveryAttempts || 0,
        duration: Date.now() - startTime,
        error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
      }
    }
  }
  
  private async retryOperation(error: ErrorDetails): Promise<RecoveryResult> {
    const maxRetries = error.maxRetries || 3
    const attempts = (error.recoveryAttempts || 0) + 1
    
    if (attempts > maxRetries) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        attempts,
        duration: 0,
        message: 'Maximum retry attempts exceeded',
      }
    }
    
    // 实现指数退避
    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000)
    await new Promise(resolve => setTimeout(resolve, delay))
    
    return {
      success: true,
      strategy: RecoveryStrategy.RETRY,
      attempts,
      duration: delay,
      message: `Retried operation (attempt ${attempts}/${maxRetries})`,
    }
  }
  
  private async executeFallback(_error: ErrorDetails): Promise<RecoveryResult> {
    // TODO: 实现降级逻辑
    return {
      success: true,
      strategy: RecoveryStrategy.FALLBACK,
      attempts: 1,
      duration: 0,
      message: 'Fallback executed',
    }
  }
  
  private refreshPage(): RecoveryResult {
    setTimeout(() => {
      window.location.reload()
    }, 1000)
    
    return {
      success: true,
      strategy: RecoveryStrategy.REFRESH,
      attempts: 1,
      duration: 0,
      message: 'Page refresh initiated',
    }
  }
  
  private restartApplication(): RecoveryResult {
    // TODO: 通过Tauri重启应用
    return {
      success: false,
      strategy: RecoveryStrategy.RESTART,
      attempts: 1,
      duration: 0,
      message: 'Application restart not implemented',
    }
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }
  
  private getDefaultConfig(): ErrorMonitorConfig {
    return {
      enabled: true,
      logLevel: 'error',
      captureJSErrors: true,
      capturePromiseRejections: true,
      captureReactErrors: true,
      captureConsoleErrors: false,
      maxStoredErrors: 10000,
      storageRetentionDays: 30,
      reportConfig: {
        enabled: false,
        endpoint: undefined,
        apiKey: undefined,
        minSeverity: ErrorSeverity.MEDIUM,
        blacklistedTypes: [ErrorType.USER_INPUT],
        whitelistedTypes: undefined,
        rateLimitEnabled: true,
        maxReportsPerMinute: 10,
        includeUserData: false,
        includeSystemInfo: true,
        maskSensitiveData: true,
        batchEnabled: true,
        batchSize: 10,
        batchTimeout: 30000,
      },
      enableAutoRecovery: true,
      recoveryTimeout: 5000,
      showErrorNotifications: true,
      showErrorDialog: true,
      allowUserReporting: true,
    }
  }
}

// ================================
// 单例实例
// ================================

export const errorMonitoringService = new ErrorMonitoringService()

// 自动初始化
if (typeof window !== 'undefined') {
  errorMonitoringService.initialize().catch(error => {
    console.error('Failed to initialize error monitoring service:', error)
  })
}

export default errorMonitoringService
