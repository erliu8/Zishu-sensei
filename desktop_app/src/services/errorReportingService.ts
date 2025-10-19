/**
 * 错误上报服务
 * 提供错误的批量上报、重试机制和上报配置管理
 */

import { invoke } from '@tauri-apps/api/tauri'
import { 
  ErrorDetails, 
  ErrorReportConfig, 
  ErrorReport,
  ErrorSeverity,
  ErrorType 
} from '../types/error'

// ================================
// 接口定义
// ================================

interface ReportQueueItem {
  errorId: string
  error: ErrorDetails
  timestamp: number
  retryCount: number
  priority: number
}

interface BatchReport {
  id: string
  errors: ErrorDetails[]
  timestamp: number
  endpoint: string
  retryCount: number
}

interface ReportResult {
  success: boolean
  reportId?: string
  error?: string
  retryAfter?: number
}

// ================================
// 错误上报服务类
// ================================

export class ErrorReportingService {
  private config: ErrorReportConfig
  private reportQueue: ReportQueueItem[] = []
  private batchQueue: BatchReport[] = []
  private isProcessing = false
  private batchTimer: NodeJS.Timeout | null = null
  private rateLimitTracker: Map<string, number[]> = new Map()
  private lastReportTime = 0
  private networkRetryDelay = 1000

  constructor(config: ErrorReportConfig) {
    this.config = config
    this.startBatchProcessor()
  }

  /**
   * 报告单个错误
   */
  public async reportError(error: ErrorDetails, options: {
    priority?: number
    immediate?: boolean
    endpoint?: string
  } = {}): Promise<ReportResult> {
    // 检查是否启用上报
    if (!this.config.enabled) {
      return { success: false, error: 'Reporting disabled' }
    }

    // 检查错误是否应该上报
    if (!this.shouldReportError(error)) {
      return { success: false, error: 'Error filtered out' }
    }

    // 检查频率限制
    if (this.isRateLimited()) {
      return { success: false, error: 'Rate limited' }
    }

    // 立即上报
    if (options.immediate) {
      return await this.sendSingleError(error, options.endpoint)
    }

    // 添加到队列
    const queueItem: ReportQueueItem = {
      errorId: error.id,
      error,
      timestamp: Date.now(),
      retryCount: 0,
      priority: options.priority || this.calculatePriority(error),
    }

    this.addToQueue(queueItem)
    return { success: true, reportId: error.id }
  }

  /**
   * 批量报告错误
   */
  public async reportErrors(errors: ErrorDetails[], endpoint?: string): Promise<ReportResult[]> {
    const results: ReportResult[] = []

    for (const error of errors) {
      const result = await this.reportError(error, { endpoint })
      results.push(result)
    }

    return results
  }

  /**
   * 立即发送所有待处理的错误
   */
  public async flushReports(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    await this.processBatch()
    await this.processQueue()
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<ErrorReportConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // 重新启动批处理器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }
    this.startBatchProcessor()
  }

  /**
   * 获取上报统计
   */
  public getReportStats(): {
    queueSize: number
    batchQueueSize: number
    isProcessing: boolean
    lastReportTime: number
    rateLimitStatus: boolean
  } {
    return {
      queueSize: this.reportQueue.length,
      batchQueueSize: this.batchQueue.length,
      isProcessing: this.isProcessing,
      lastReportTime: this.lastReportTime,
      rateLimitStatus: this.isRateLimited(),
    }
  }

  /**
   * 清空队列
   */
  public clearQueue(): void {
    this.reportQueue = []
    this.batchQueue = []
  }

  // ================================
  // 私有方法
  // ================================

  /**
   * 判断错误是否应该上报
   */
  private shouldReportError(error: ErrorDetails): boolean {
    // 检查最小严重级别
    const severityLevels = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 2,
      [ErrorSeverity.HIGH]: 3,
      [ErrorSeverity.CRITICAL]: 4,
    }

    const minLevel = severityLevels[this.config.minSeverity as ErrorSeverity] || 2
    const errorLevel = severityLevels[error.severity] || 1

    if (errorLevel < minLevel) {
      return false
    }

    // 检查黑名单
    if (this.config.blacklistedTypes.includes(error.type)) {
      return false
    }

    // 检查白名单（如果存在）
    if (this.config.whitelistedTypes && 
        !this.config.whitelistedTypes.includes(error.type)) {
      return false
    }

    return true
  }

  /**
   * 检查是否受频率限制
   */
  private isRateLimited(): boolean {
    if (!this.config.rateLimitEnabled) {
      return false
    }

    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    const endpoint = this.config.endpoint || 'default'
    
    const reports = this.rateLimitTracker.get(endpoint) || []
    const recentReports = reports.filter(time => time > oneMinuteAgo)
    
    return recentReports.length >= this.config.maxReportsPerMinute
  }

  /**
   * 记录上报时间（用于频率限制）
   */
  private recordReportTime(endpoint: string = 'default'): void {
    const now = Date.now()
    const reports = this.rateLimitTracker.get(endpoint) || []
    const oneMinuteAgo = now - 60 * 1000
    
    // 清理旧记录
    const recentReports = reports.filter(time => time > oneMinuteAgo)
    recentReports.push(now)
    
    this.rateLimitTracker.set(endpoint, recentReports)
    this.lastReportTime = now
  }

  /**
   * 计算错误优先级
   */
  private calculatePriority(error: ErrorDetails): number {
    let priority = 1

    // 基于严重级别
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        priority += 10
        break
      case ErrorSeverity.HIGH:
        priority += 5
        break
      case ErrorSeverity.MEDIUM:
        priority += 2
        break
      case ErrorSeverity.LOW:
        priority += 1
        break
    }

    // 基于错误类型
    if (error.type === ErrorType.SYSTEM || error.type === ErrorType.RUST) {
      priority += 3
    }

    // 基于发生频率
    if (error.occurrenceCount > 5) {
      priority += 2
    }

    return priority
  }

  /**
   * 添加到队列
   */
  private addToQueue(item: ReportQueueItem): void {
    this.reportQueue.push(item)
    
    // 按优先级排序
    this.reportQueue.sort((a, b) => b.priority - a.priority)
    
    // 限制队列大小
    const maxQueueSize = 1000
    if (this.reportQueue.length > maxQueueSize) {
      this.reportQueue = this.reportQueue.slice(0, maxQueueSize)
    }
  }

  /**
   * 启动批处理器
   */
  private startBatchProcessor(): void {
    if (!this.config.batchEnabled) {
      return
    }

    const scheduleNext = () => {
      this.batchTimer = setTimeout(() => {
        this.processBatch().finally(scheduleNext)
      }, this.config.batchTimeout)
    }

    scheduleNext()
  }

  /**
   * 处理批量上报
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.reportQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      // 取出一批错误
      const batchSize = Math.min(this.config.batchSize, this.reportQueue.length)
      const batch = this.reportQueue.splice(0, batchSize)
      
      if (batch.length === 0) {
        return
      }

      // 创建批量报告
      const batchReport: BatchReport = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        errors: batch.map(item => item.error),
        timestamp: Date.now(),
        endpoint: this.config.endpoint || '',
        retryCount: 0,
      }

      // 尝试发送批量报告
      const result = await this.sendBatchReport(batchReport)

      if (!result.success) {
        // 失败时加入重试队列
        this.batchQueue.push(batchReport)
      }
    } catch (error) {
      console.error('Error in batch processor:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 处理重试队列
   */
  private async processQueue(): Promise<void> {
    const maxRetries = 3
    const retryQueue = [...this.batchQueue]
    this.batchQueue = []

    for (const batchReport of retryQueue) {
      if (batchReport.retryCount < maxRetries) {
        batchReport.retryCount++
        
        // 计算重试延迟
        const delay = Math.pow(2, batchReport.retryCount) * this.networkRetryDelay
        
        setTimeout(async () => {
          const result = await this.sendBatchReport(batchReport)
          if (!result.success) {
            this.batchQueue.push(batchReport)
          }
        }, delay)
      }
    }
  }

  /**
   * 发送单个错误
   */
  private async sendSingleError(error: ErrorDetails, endpoint?: string): Promise<ReportResult> {
    try {
      const report = this.createErrorReport([error])
      const targetEndpoint = endpoint || this.config.endpoint || ''
      
      this.recordReportTime(targetEndpoint)
      
      // 记录报告到数据库
      await invoke('record_error_report', {
        reportId: report.reportId,
        errorIds: [error.id],
        endpoint: targetEndpoint,
      })

      // 发送到远程服务器
      if (targetEndpoint) {
        const response = await this.sendToRemoteEndpoint(report, targetEndpoint)
        
        // 更新报告状态
        await invoke('update_report_status', {
          reportId: report.reportId,
          status: response.success ? 'sent' : 'failed',
          responseCode: response.statusCode,
          responseMessage: response.message,
        })

        return response
      }

      return { success: true, reportId: report.reportId }
    } catch (error) {
      console.error('Failed to send single error:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * 发送批量报告
   */
  private async sendBatchReport(batchReport: BatchReport): Promise<ReportResult> {
    try {
      const report = this.createErrorReport(batchReport.errors)
      const errorIds = batchReport.errors.map(e => e.id)
      
      this.recordReportTime(batchReport.endpoint)
      
      // 记录报告到数据库
      await invoke('record_error_report', {
        reportId: report.reportId,
        errorIds,
        endpoint: batchReport.endpoint,
      })

      // 发送到远程服务器
      if (batchReport.endpoint) {
        const response = await this.sendToRemoteEndpoint(report, batchReport.endpoint)
        
        // 更新报告状态
        await invoke('update_report_status', {
          reportId: report.reportId,
          status: response.success ? 'sent' : 'failed',
          responseCode: response.statusCode,
          responseMessage: response.message,
        })

        return response
      }

      return { success: true, reportId: report.reportId }
    } catch (error) {
      console.error('Failed to send batch report:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * 创建错误报告
   */
  private createErrorReport(errors: ErrorDetails[]): ErrorReport {
    return {
      reportId: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      errors: this.sanitizeErrors(errors),
      environment: {
        platform: navigator.platform,
        appVersion: '1.0.0', // 从配置获取
        buildVersion: '1', // 从配置获取
        userAgent: navigator.userAgent,
      },
      user: this.config.includeUserData ? {
        sessionId: errors[0]?.context.sessionId,
      } : undefined,
      system: this.config.includeSystemInfo ? {
        memory: (performance as any).memory?.usedJSHeapSize,
        // 其他系统信息可以从 Tauri 后端获取
      } : undefined,
    }
  }

  /**
   * 清理敏感数据
   */
  private sanitizeErrors(errors: ErrorDetails[]): ErrorDetails[] {
    if (!this.config.maskSensitiveData) {
      return errors
    }

    return errors.map(error => ({
      ...error,
      message: this.maskSensitiveInfo(error.message),
      stack: error.stack ? this.maskSensitiveInfo(error.stack) : undefined,
      context: {
        ...error.context,
        metadata: error.context.metadata ? 
          this.maskSensitiveObject(error.context.metadata) : undefined,
      },
    }))
  }

  /**
   * 掩码敏感信息
   */
  private maskSensitiveInfo(text: string): string {
    // 掩码常见的敏感信息模式
    const patterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // 邮箱
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // 信用卡号
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /(?:password|token|key|secret)['":\s=]+['"]*([^'"\s\n]+)/gi, // 密码/密钥
    ]

    let maskedText = text
    patterns.forEach(pattern => {
      maskedText = maskedText.replace(pattern, (match) => {
        return '*'.repeat(Math.min(match.length, 8))
      })
    })

    return maskedText
  }

  /**
   * 掩码敏感对象
   */
  private maskSensitiveObject(obj: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential']
    const masked = { ...obj }

    for (const [key, value] of Object.entries(masked)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        masked[key] = '***MASKED***'
      } else if (typeof value === 'string') {
        masked[key] = this.maskSensitiveInfo(value)
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveObject(value)
      }
    }

    return masked
  }

  /**
   * 发送到远程端点
   */
  private async sendToRemoteEndpoint(report: ErrorReport, endpoint: string): Promise<ReportResult & { statusCode?: number; message?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // 添加 API Key
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(report),
      })

      const responseData = await response.json().catch(() => ({}))

      return {
        success: response.ok,
        reportId: report.reportId,
        statusCode: response.status,
        message: responseData.message || response.statusText,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: 'Network error',
      }
    }
  }

  /**
   * 销毁服务
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    
    this.clearQueue()
    this.rateLimitTracker.clear()
  }
}

// ================================
// 导出单例实例
// ================================

let reportingServiceInstance: ErrorReportingService | null = null

export function getErrorReportingService(config?: ErrorReportConfig): ErrorReportingService {
  if (!reportingServiceInstance) {
    const defaultConfig: ErrorReportConfig = {
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
    }
    
    reportingServiceInstance = new ErrorReportingService(config || defaultConfig)
  }
  
  return reportingServiceInstance
}

export function updateReportingConfig(config: Partial<ErrorReportConfig>): void {
  const service = getErrorReportingService()
  service.updateConfig(config)
}

export { ErrorReportingService }
