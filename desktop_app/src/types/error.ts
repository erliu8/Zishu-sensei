/**
 * 错误监控系统类型定义
 * 提供全面的错误处理、分类、上报和恢复机制
 */

// ================================
// 错误基础类型
// ================================

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',           // 低：轻微错误，不影响核心功能
  MEDIUM = 'medium',     // 中：影响部分功能，用户可以继续使用
  HIGH = 'high',         // 高：影响重要功能，需要用户注意
  CRITICAL = 'critical', // 严重：系统性错误，可能导致崩溃
}

/**
 * 错误类型分类
 */
export enum ErrorType {
  // 运行时错误
  JAVASCRIPT = 'javascript',
  REACT = 'react',
  RUST = 'rust',
  SYSTEM = 'system',
  
  // 网络错误
  NETWORK = 'network',
  API = 'api',
  TIMEOUT = 'timeout',
  
  // 业务错误
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  
  // 资源错误
  MEMORY = 'memory',
  FILE = 'file',
  DATABASE = 'database',
  
  // 用户错误
  USER_INPUT = 'user_input',
  CONFIGURATION = 'configuration',
  
  // 未知错误
  UNKNOWN = 'unknown',
}

/**
 * 错误来源
 */
export enum ErrorSource {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  SYSTEM = 'system',
  EXTERNAL = 'external',
}

/**
 * 错误状态
 */
export enum ErrorStatus {
  NEW = 'new',                 // 新发生
  REPORTED = 'reported',       // 已上报
  ACKNOWLEDGED = 'acknowledged', // 已确认
  RECOVERING = 'recovering',   // 恢复中
  RESOLVED = 'resolved',       // 已解决
  IGNORED = 'ignored',         // 已忽略
}

/**
 * 恢复策略类型
 */
export enum RecoveryStrategy {
  NONE = 'none',               // 无恢复策略
  RETRY = 'retry',             // 重试
  FALLBACK = 'fallback',       // 降级方案
  REFRESH = 'refresh',         // 刷新页面
  RESTART = 'restart',         // 重启应用
  USER_ACTION = 'user_action', // 需要用户操作
}

// ================================
// 错误信息结构
// ================================

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  // 基础信息
  timestamp: string
  sessionId: string
  userId?: string
  userAgent?: string
  
  // 环境信息
  platform: string
  appVersion: string
  buildVersion: string
  
  // 运行时信息
  url?: string
  route?: string
  component?: string
  function?: string
  line?: number
  column?: number
  
  // 业务上下文
  operation?: string
  parameters?: Record<string, any>
  state?: Record<string, any>
  
  // 额外数据
  metadata?: Record<string, any>
}

/**
 * 错误详情
 */
export interface ErrorDetails {
  id: string
  errorId: string
  
  // 基础信息
  type: ErrorType
  source: ErrorSource
  severity: ErrorSeverity
  status: ErrorStatus
  
  // 错误内容
  name: string
  message: string
  stack?: string
  cause?: string
  
  // 上下文
  context: ErrorContext
  
  // 恢复信息
  recoveryStrategy?: RecoveryStrategy
  recoveryAttempts?: number
  maxRetries?: number
  canRecover?: boolean
  
  // 统计信息
  occurrenceCount: number
  firstOccurred: string
  lastOccurred: string
  
  // 解决信息
  resolved?: boolean
  resolvedAt?: string
  resolution?: string
}

/**
 * 错误统计信息
 */
export interface ErrorStatistics {
  // 总体统计
  totalErrors: number
  newErrors: number
  resolvedErrors: number
  
  // 按严重级别分类
  bySeverity: Record<ErrorSeverity, number>
  
  // 按类型分类
  byType: Record<ErrorType, number>
  
  // 按来源分类
  bySource: Record<ErrorSource, number>
  
  // 时间趋势（最近24小时，每小时一个数据点）
  hourlyTrend: {
    hour: string
    count: number
  }[]
  
  // 最常见错误
  topErrors: {
    errorId: string
    message: string
    count: number
    severity: ErrorSeverity
  }[]
}

// ================================
// 错误报告和上报
// ================================

/**
 * 错误报告配置
 */
export interface ErrorReportConfig {
  // 上报配置
  enabled: boolean
  endpoint?: string
  apiKey?: string
  
  // 过滤配置
  minSeverity: ErrorSeverity
  blacklistedTypes: ErrorType[]
  whitelistedTypes?: ErrorType[]
  
  // 频率限制
  rateLimitEnabled: boolean
  maxReportsPerMinute: number
  
  // 隐私配置
  includeUserData: boolean
  includeSystemInfo: boolean
  maskSensitiveData: boolean
  
  // 批量上报
  batchEnabled: boolean
  batchSize: number
  batchTimeout: number // 毫秒
}

/**
 * 错误报告数据
 */
export interface ErrorReport {
  // 基础信息
  reportId: string
  timestamp: string
  
  // 错误信息
  errors: ErrorDetails[]
  
  // 环境信息
  environment: {
    platform: string
    appVersion: string
    buildVersion: string
    userAgent?: string
  }
  
  // 用户信息（可选）
  user?: {
    id?: string
    sessionId: string
  }
  
  // 系统信息（可选）
  system?: {
    memory?: number
    cpu?: number
    diskSpace?: number
  }
}

// ================================
// 恢复机制
// ================================

/**
 * 恢复动作配置
 */
export interface RecoveryAction {
  strategy: RecoveryStrategy
  description: string
  
  // 重试配置
  retryConfig?: {
    maxAttempts: number
    delay: number // 毫秒
    backoffMultiplier: number
  }
  
  // 降级配置
  fallbackConfig?: {
    fallbackFunction?: () => Promise<any>
    fallbackComponent?: string
    fallbackValue?: any
  }
  
  // 用户操作配置
  userActionConfig?: {
    message: string
    actions: {
      label: string
      action: () => void
    }[]
  }
}

/**
 * 恢复结果
 */
export interface RecoveryResult {
  success: boolean
  strategy: RecoveryStrategy
  attempts: number
  duration: number // 毫秒
  message?: string
  error?: string
}

// ================================
// 监控配置
// ================================

/**
 * 错误监控配置
 */
export interface ErrorMonitorConfig {
  // 基础配置
  enabled: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  
  // 捕获配置
  captureJSErrors: boolean
  capturePromiseRejections: boolean
  captureReactErrors: boolean
  captureConsoleErrors: boolean
  
  // 存储配置
  maxStoredErrors: number
  storageRetentionDays: number
  
  // 上报配置
  reportConfig: ErrorReportConfig
  
  // 恢复配置
  enableAutoRecovery: boolean
  recoveryTimeout: number // 毫秒
  
  // UI配置
  showErrorNotifications: boolean
  showErrorDialog: boolean
  allowUserReporting: boolean
}

// ================================
// Hooks和服务接口
// ================================

/**
 * 错误监控Hook返回值
 */
export interface UseErrorMonitorResult {
  // 状态
  errors: ErrorDetails[]
  statistics: ErrorStatistics
  isMonitoring: boolean
  
  // 方法
  reportError: (error: Error | ErrorDetails, context?: Partial<ErrorContext>) => Promise<void>
  clearErrors: () => Promise<void>
  resolveError: (errorId: string, resolution?: string) => Promise<void>
  retryError: (errorId: string) => Promise<RecoveryResult>
  
  // 配置
  updateConfig: (config: Partial<ErrorMonitorConfig>) => void
  getConfig: () => ErrorMonitorConfig
}

/**
 * 错误边界Props
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  recovery?: RecoveryAction
  isolate?: boolean // 是否隔离错误，不向上传播
}

/**
 * 错误边界降级组件Props
 */
export interface ErrorBoundaryFallbackProps {
  error: Error
  errorDetails?: ErrorDetails
  resetError: () => void
  reportError: () => void
}

// ================================
// 实用工具类型
// ================================

/**
 * 错误匹配器
 */
export interface ErrorMatcher {
  type?: ErrorType | ErrorType[]
  severity?: ErrorSeverity | ErrorSeverity[]
  source?: ErrorSource | ErrorSource[]
  namePattern?: RegExp
  messagePattern?: RegExp
  stackPattern?: RegExp
}

/**
 * 错误处理器函数
 */
export type ErrorHandler = (error: ErrorDetails) => Promise<RecoveryResult | void>

/**
 * 错误过滤器函数
 */
export type ErrorFilter = (error: ErrorDetails) => boolean

/**
 * 错误转换器函数
 */
export type ErrorTransformer = (error: Error, context?: Partial<ErrorContext>) => ErrorDetails

// ================================
// 工具函数接口
// ================================

/**
 * 错误分类工具
 */
export interface ErrorClassifier {
  classifyError: (error: Error) => { type: ErrorType; severity: ErrorSeverity }
  isRetryable: (error: ErrorDetails) => boolean
  shouldReport: (error: ErrorDetails) => boolean
  canRecover: (error: ErrorDetails) => boolean
}

/**
 * 错误聚合工具
 */
export interface ErrorAggregator {
  groupSimilarErrors: (errors: ErrorDetails[]) => Map<string, ErrorDetails[]>
  generateSignature: (error: ErrorDetails) => string
  findDuplicates: (error: ErrorDetails, existing: ErrorDetails[]) => ErrorDetails[]
}

/**
 * 错误格式化工具
 */
export interface ErrorFormatter {
  formatForUser: (error: ErrorDetails) => string
  formatForDeveloper: (error: ErrorDetails) => string
  formatForReport: (error: ErrorDetails) => Record<string, any>
}

// ================================
// 导出所有类型
// ================================

export * from './common'
