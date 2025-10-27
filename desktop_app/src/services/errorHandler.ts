/**
 * 桌面应用错误处理和重试机制
 * 
 * 提供全面的错误处理、重试机制和恢复策略，包括：
 * - 错误分类和处理
 * - 自动重试机制
 * - 错误恢复策略
 * - 错误报告和日志
 * - 降级处理
 */

// 导入保留以供将来使用
// import { invoke } from '@tauri-apps/api/tauri'
// import { listen } from '@tauri-apps/api/event'
// import type { ApiResponse } from '../types/app'

/**
 * 错误类型
 */
export enum ErrorType {
    NETWORK = 'network',
    PERMISSION = 'permission',
    VALIDATION = 'validation',
    SYSTEM = 'system',
    API = 'api',
    FILE = 'file',
    CONFIG = 'config',
    UNKNOWN = 'unknown',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * 错误信息
 */
export interface ErrorInfo {
    id: string
    type: ErrorType
    severity: ErrorSeverity
    message: string
    stack?: string
    context?: Record<string, any>
    timestamp: number
    operation?: string
    retryCount: number
    maxRetries: number
    isRecoverable: boolean
    recoveryStrategy?: RecoveryStrategy
}

/**
 * 恢复策略
 */
export interface RecoveryStrategy {
    type: 'retry' | 'fallback' | 'skip' | 'user_intervention'
    maxAttempts: number
    delay: number
    backoffMultiplier?: number
    fallbackAction?: () => Promise<any>
    userPrompt?: string
}

/**
 * 重试配置
 */
export interface RetryConfig {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    backoffMultiplier: number
    jitter: boolean
    retryCondition?: (error: Error) => boolean
}

/**
 * 错误处理配置
 */
export interface ErrorHandlerConfig {
    enableRetry: boolean
    enableFallback: boolean
    enableLogging: boolean
    enableReporting: boolean
    maxErrorHistory: number
    retryConfigs: Record<ErrorType, RetryConfig>
}

/**
 * 错误处理结果
 */
export interface ErrorHandleResult {
    success: boolean
    error?: ErrorInfo
    result?: any
    recovered: boolean
    strategy?: RecoveryStrategy
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
    private config: ErrorHandlerConfig
    private errorHistory: ErrorInfo[] = []
    // private retryQueues: Map<string, ErrorInfo[]> = new Map()
    // private isProcessing: boolean = false

    constructor(config: Partial<ErrorHandlerConfig> = {}) {
        this.config = {
            enableRetry: true,
            enableFallback: true,
            enableLogging: true,
            enableReporting: true,
            maxErrorHistory: 1000,
            retryConfigs: this.getDefaultRetryConfigs(),
            ...config,
        }
    }

    /**
     * 处理错误
     */
    async handleError(
        error: Error,
        context: {
            operation?: string
            type?: ErrorType
            severity?: ErrorSeverity
            context?: Record<string, any>
            retryCount?: number
        } = {}
    ): Promise<ErrorHandleResult> {
        const errorInfo = this.createErrorInfo(error, context)
        
        // 记录错误
        this.recordError(errorInfo)
        
        // 确定恢复策略
        const strategy = this.determineRecoveryStrategy(errorInfo)
        errorInfo.recoveryStrategy = strategy
        
        // 执行恢复策略
        const result = await this.executeRecoveryStrategy(errorInfo, strategy)
        
        // 报告错误（如果需要）
        if (this.config.enableReporting && errorInfo.severity !== ErrorSeverity.LOW) {
            await this.reportError(errorInfo)
        }
        
        return result
    }

    /**
     * 执行操作并处理错误
     */
    async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        context: {
            operation?: string
            type?: ErrorType
            severity?: ErrorSeverity
            context?: Record<string, any>
        } = {}
    ): Promise<T> {
        try {
            return await operation()
        } catch (error) {
            const result = await this.handleError(error as Error, context)
            
            if (result.success && result.result !== undefined) {
                return result.result
            }
            
            throw new Error(result.error?.message || 'Operation failed')
        }
    }

    /**
     * 重试操作
     */
    async retryOperation<T>(
        operation: () => Promise<T>,
        config: Partial<RetryConfig> = {}
    ): Promise<T> {
        const retryConfig = { ...this.getDefaultRetryConfig(), ...config }
        let lastError: Error | null = null
        
        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                return await operation()
            } catch (error) {
                lastError = error as Error
                
                // 检查是否应该重试
                if (retryConfig.retryCondition && !retryConfig.retryCondition(lastError)) {
                    throw lastError
                }
                
                // 如果是最后一次尝试，抛出错误
                if (attempt === retryConfig.maxAttempts) {
                    throw lastError
                }
                
                // 计算延迟时间
                const delay = this.calculateDelay(attempt, retryConfig)
                await this.delay(delay)
                
                this.log(`Retry attempt ${attempt}/${retryConfig.maxAttempts} after ${delay}ms`)
            }
        }
        
        throw lastError || new Error('Retry failed')
    }

    /**
     * 创建错误信息
     */
    private createErrorInfo(
        error: Error,
        context: {
            operation?: string
            type?: ErrorType
            severity?: ErrorSeverity
            context?: Record<string, any>
            retryCount?: number
        }
    ): ErrorInfo {
        const id = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        return {
            id,
            type: context.type || this.classifyError(error),
            severity: context.severity || this.determineSeverity(error),
            message: error.message,
            stack: error.stack,
            context: context.context || {},
            timestamp: Date.now(),
            operation: context.operation,
            retryCount: context.retryCount || 0,
            maxRetries: this.getMaxRetries(context.type || this.classifyError(error)),
            isRecoverable: this.isRecoverable(error),
        }
    }

    /**
     * 分类错误
     */
    private classifyError(error: Error): ErrorType {
        const message = error.message.toLowerCase()
        
        if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
            return ErrorType.NETWORK
        }
        
        if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
            return ErrorType.PERMISSION
        }
        
        if (message.includes('validation') || message.includes('invalid') || message.includes('malformed')) {
            return ErrorType.VALIDATION
        }
        
        if (message.includes('system') || message.includes('os') || message.includes('platform')) {
            return ErrorType.SYSTEM
        }
        
        if (message.includes('api') || message.includes('endpoint') || message.includes('server')) {
            return ErrorType.API
        }
        
        if (message.includes('file') || message.includes('path') || message.includes('directory')) {
            return ErrorType.FILE
        }
        
        if (message.includes('config') || message.includes('setting') || message.includes('preference')) {
            return ErrorType.CONFIG
        }
        
        return ErrorType.UNKNOWN
    }

    /**
     * 确定错误严重程度
     */
    private determineSeverity(error: Error): ErrorSeverity {
        const message = error.message.toLowerCase()
        
        if (message.includes('critical') || message.includes('fatal')) {
            return ErrorSeverity.CRITICAL
        }
        
        if (message.includes('error') || message.includes('failed')) {
            return ErrorSeverity.HIGH
        }
        
        if (message.includes('warning') || message.includes('caution')) {
            return ErrorSeverity.MEDIUM
        }
        
        return ErrorSeverity.LOW
    }

    /**
     * 确定恢复策略
     */
    private determineRecoveryStrategy(errorInfo: ErrorInfo): RecoveryStrategy {
        const retryConfig = this.config.retryConfigs[errorInfo.type]
        
        switch (errorInfo.type) {
            case ErrorType.NETWORK:
                return {
                    type: 'retry',
                    maxAttempts: retryConfig.maxAttempts,
                    delay: retryConfig.baseDelay,
                    backoffMultiplier: retryConfig.backoffMultiplier,
                }
            
            case ErrorType.PERMISSION:
                return {
                    type: 'user_intervention',
                    maxAttempts: 1,
                    delay: 0,
                    userPrompt: '请检查权限设置并重试',
                }
            
            case ErrorType.VALIDATION:
                return {
                    type: 'skip',
                    maxAttempts: 1,
                    delay: 0,
                }
            
            case ErrorType.SYSTEM:
                return {
                    type: 'fallback',
                    maxAttempts: 1,
                    delay: 0,
                    fallbackAction: () => this.getSystemFallback(errorInfo),
                }
            
            case ErrorType.API:
                return {
                    type: 'retry',
                    maxAttempts: retryConfig.maxAttempts,
                    delay: retryConfig.baseDelay,
                    backoffMultiplier: retryConfig.backoffMultiplier,
                }
            
            case ErrorType.FILE:
                return {
                    type: 'fallback',
                    maxAttempts: 1,
                    delay: 0,
                    fallbackAction: () => this.getFileFallback(errorInfo),
                }
            
            case ErrorType.CONFIG:
                return {
                    type: 'fallback',
                    maxAttempts: 1,
                    delay: 0,
                    fallbackAction: () => this.getConfigFallback(errorInfo),
                }
            
            default:
                return {
                    type: 'retry',
                    maxAttempts: 3,
                    delay: 1000,
                    backoffMultiplier: 2,
                }
        }
    }

    /**
     * 执行恢复策略
     */
    private async executeRecoveryStrategy(
        errorInfo: ErrorInfo,
        strategy: RecoveryStrategy
    ): Promise<ErrorHandleResult> {
        switch (strategy.type) {
            case 'retry':
                return await this.executeRetryStrategy(errorInfo, strategy)
            
            case 'fallback':
                return await this.executeFallbackStrategy(errorInfo, strategy)
            
            case 'skip':
                return await this.executeSkipStrategy(errorInfo, strategy)
            
            case 'user_intervention':
                return await this.executeUserInterventionStrategy(errorInfo, strategy)
            
            default:
                return {
                    success: false,
                    error: errorInfo,
                    recovered: false,
                }
        }
    }

    /**
     * 执行重试策略
     */
    private async executeRetryStrategy(
        errorInfo: ErrorInfo,
        strategy: RecoveryStrategy
    ): Promise<ErrorHandleResult> {
        if (!this.config.enableRetry) {
            return {
                success: false,
                error: errorInfo,
                recovered: false,
                strategy,
            }
        }
        
        try {
            // 这里应该重新执行原始操作
            // 简化实现，返回失败
            return {
                success: false,
                error: errorInfo,
                recovered: false,
                strategy,
            }
        } catch (error) {
            return {
                success: false,
                error: errorInfo,
                recovered: false,
                strategy,
            }
        }
    }

    /**
     * 执行降级策略
     */
    private async executeFallbackStrategy(
        errorInfo: ErrorInfo,
        strategy: RecoveryStrategy
    ): Promise<ErrorHandleResult> {
        if (!this.config.enableFallback || !strategy.fallbackAction) {
            return {
                success: false,
                error: errorInfo,
                recovered: false,
                strategy,
            }
        }
        
        try {
            const result = await strategy.fallbackAction()
            return {
                success: true,
                result,
                recovered: true,
                strategy,
            }
        } catch (error) {
            return {
                success: false,
                error: errorInfo,
                recovered: false,
                strategy,
            }
        }
    }

    /**
     * 执行跳过策略
     */
    private async executeSkipStrategy(
        _errorInfo: ErrorInfo,
        strategy: RecoveryStrategy
    ): Promise<ErrorHandleResult> {
        return {
            success: true,
            result: null,
            recovered: true,
            strategy,
        }
    }

    /**
     * 执行用户干预策略
     */
    private async executeUserInterventionStrategy(
        errorInfo: ErrorInfo,
        strategy: RecoveryStrategy
    ): Promise<ErrorHandleResult> {
        // 这里应该显示用户提示
        // 简化实现，返回失败
        return {
            success: false,
            error: errorInfo,
            recovered: false,
            strategy,
        }
    }

    /**
     * 获取系统降级处理
     */
    private async getSystemFallback(_errorInfo: ErrorInfo): Promise<any> {
        // 系统错误的降级处理
        return { fallback: 'system', message: '使用系统默认设置' }
    }

    /**
     * 获取文件降级处理
     */
    private async getFileFallback(_errorInfo: ErrorInfo): Promise<any> {
        // 文件错误的降级处理
        return { fallback: 'file', message: '使用临时文件' }
    }

    /**
     * 获取配置降级处理
     */
    private async getConfigFallback(_errorInfo: ErrorInfo): Promise<any> {
        // 配置错误的降级处理
        return { fallback: 'config', message: '使用默认配置' }
    }

    /**
     * 记录错误
     */
    private recordError(errorInfo: ErrorInfo): void {
        this.errorHistory.unshift(errorInfo)
        
        // 保持错误历史记录在限制范围内
        if (this.errorHistory.length > this.config.maxErrorHistory) {
            this.errorHistory = this.errorHistory.slice(0, this.config.maxErrorHistory)
        }
        
        if (this.config.enableLogging) {
            this.log(`Error recorded: ${errorInfo.type} - ${errorInfo.message}`)
        }
    }

    /**
     * 报告错误
     */
    private async reportError(errorInfo: ErrorInfo): Promise<void> {
        try {
            // 这里应该将错误报告发送到服务器
            // 简化实现，只记录日志
            this.log(`Error reported: ${errorInfo.id}`)
        } catch (error) {
            this.log('Failed to report error:', error)
        }
    }

    /**
     * 计算延迟时间
     */
    private calculateDelay(attempt: number, config: RetryConfig): number {
        let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
        
        if (config.jitter) {
            delay += Math.random() * delay * 0.1
        }
        
        return Math.min(delay, config.maxDelay)
    }

    /**
     * 获取最大重试次数
     */
    private getMaxRetries(errorType: ErrorType): number {
        return this.config.retryConfigs[errorType]?.maxAttempts || 3
    }

    /**
     * 检查是否可恢复
     */
    private isRecoverable(error: Error): boolean {
        const message = error.message.toLowerCase()
        
        // 不可恢复的错误
        if (message.includes('fatal') || message.includes('critical')) {
            return false
        }
        
        // 可恢复的错误
        if (message.includes('timeout') || message.includes('network') || message.includes('temporary')) {
            return true
        }
        
        return true
    }

    /**
     * 获取默认重试配置
     */
    private getDefaultRetryConfig(): RetryConfig {
        return {
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 2,
            jitter: true,
        }
    }

    /**
     * 获取默认重试配置
     */
    private getDefaultRetryConfigs(): Record<ErrorType, RetryConfig> {
        return {
            [ErrorType.NETWORK]: {
                maxAttempts: 5,
                baseDelay: 1000,
                maxDelay: 30000,
                backoffMultiplier: 2,
                jitter: true,
            },
            [ErrorType.PERMISSION]: {
                maxAttempts: 1,
                baseDelay: 0,
                maxDelay: 0,
                backoffMultiplier: 1,
                jitter: false,
            },
            [ErrorType.VALIDATION]: {
                maxAttempts: 1,
                baseDelay: 0,
                maxDelay: 0,
                backoffMultiplier: 1,
                jitter: false,
            },
            [ErrorType.SYSTEM]: {
                maxAttempts: 2,
                baseDelay: 2000,
                maxDelay: 10000,
                backoffMultiplier: 2,
                jitter: true,
            },
            [ErrorType.API]: {
                maxAttempts: 3,
                baseDelay: 1000,
                maxDelay: 15000,
                backoffMultiplier: 2,
                jitter: true,
            },
            [ErrorType.FILE]: {
                maxAttempts: 2,
                baseDelay: 500,
                maxDelay: 5000,
                backoffMultiplier: 2,
                jitter: true,
            },
            [ErrorType.CONFIG]: {
                maxAttempts: 1,
                baseDelay: 0,
                maxDelay: 0,
                backoffMultiplier: 1,
                jitter: false,
            },
            [ErrorType.UNKNOWN]: {
                maxAttempts: 3,
                baseDelay: 1000,
                maxDelay: 10000,
                backoffMultiplier: 2,
                jitter: true,
            },
        }
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * 日志记录
     */
    private log(message: string, ...args: any[]): void {
        if (this.config.enableLogging) {
            console.log(`[ErrorHandler] ${message}`, ...args)
        }
    }

    /**
     * 获取错误历史
     */
    getErrorHistory(): ErrorInfo[] {
        return [...this.errorHistory]
    }

    /**
     * 清除错误历史
     */
    clearErrorHistory(): void {
        this.errorHistory = []
    }

    /**
     * 获取错误统计
     */
    getErrorStats(): {
        total: number
        byType: Record<ErrorType, number>
        bySeverity: Record<ErrorSeverity, number>
        recent: number
    } {
        const byType = {} as Record<ErrorType, number>
        const bySeverity = {} as Record<ErrorSeverity, number>
        
        // 初始化计数器
        Object.values(ErrorType).forEach(type => byType[type] = 0)
        Object.values(ErrorSeverity).forEach(severity => bySeverity[severity] = 0)
        
        // 统计错误
        this.errorHistory.forEach(error => {
            byType[error.type]++
            bySeverity[error.severity]++
        })
        
        const now = Date.now()
        const recent = this.errorHistory.filter(error => now - error.timestamp < 24 * 60 * 60 * 1000).length
        
        return {
            total: this.errorHistory.length,
            byType,
            bySeverity,
            recent,
        }
    }
}

/**
 * 错误处理器实例
 */
export const errorHandler = new ErrorHandler()

/**
 * 错误处理 Hook
 */
export const useErrorHandler = () => {
    return {
        errorHandler,
        handleError: (error: Error, context?: any) => errorHandler.handleError(error, context),
        executeWithErrorHandling: (operation: () => Promise<any>, context?: any) => 
            errorHandler.executeWithErrorHandling(operation, context),
        retryOperation: (operation: () => Promise<any>, config?: Partial<RetryConfig>) => 
            errorHandler.retryOperation(operation, config),
        getErrorHistory: () => errorHandler.getErrorHistory(),
        clearErrorHistory: () => errorHandler.clearErrorHistory(),
        getErrorStats: () => errorHandler.getErrorStats(),
    }
}

/**
 * 错误处理装饰器
 */
export function withErrorHandling(
    errorType: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
) {
    return function (_target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value
        
        descriptor.value = async function (...args: any[]) {
            try {
                return await method.apply(this, args)
            } catch (error) {
                await errorHandler.handleError(error as Error, {
                    operation: propertyName,
                    type: errorType,
                    severity,
                    context: { args },
                })
                throw error
            }
        }
        
        return descriptor
    }
}
