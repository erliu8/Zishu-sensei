/**
 * Tauri 错误处理工具
 * 
 * 提供统一的错误处理、日志记录和用户友好的错误消息
 */

import { ERROR_CODES, LOG_LEVELS } from '../constants/tauri'
import type { ErrorContext, ErrorHandler, ErrorDetails } from '../types/error'
import { ErrorType, ErrorSource, ErrorSeverity as ErrorSeverityEnum, ErrorStatus } from '../types/error'

/**
 * Tauri 错误接口 - 扩展 ErrorDetails
 */
export interface TauriError extends ErrorDetails {
  // 继承 ErrorDetails 的所有属性，同时保持向后兼容
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * 错误分类
 */
export enum ErrorCategory {
    SYSTEM = 'system',
    NETWORK = 'network',
    FILE = 'file',
    WINDOW = 'window',
    COMMAND = 'command',
    EVENT = 'event',
    USER = 'user',
    VALIDATION = 'validation'
}

/**
 * 创建标准化的 Tauri 错误
 */
export function createTauriError(
    message: string,
    code: string = ERROR_CODES.UNKNOWN_ERROR,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    severity: string = 'medium',
    context?: Partial<ErrorContext>
): TauriError {
    const timestamp = new Date().toISOString()
    const errorId = `${code}_${Date.now()}`
    
    // Create a proper ErrorContext with required fields
    const fullContext: ErrorContext = {
        timestamp,
        sessionId: 'default-session',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
        appVersion: '1.0.0',
        buildVersion: '1.0.0',
        ...context
    }

    // Map category to ErrorType
    const mapCategoryToErrorType = (cat: ErrorCategory): ErrorType => {
        switch (cat) {
            case ErrorCategory.NETWORK: return ErrorType.NETWORK
            case ErrorCategory.FILE: return ErrorType.FILE
            case ErrorCategory.VALIDATION: return ErrorType.VALIDATION
            case ErrorCategory.USER: return ErrorType.USER_INPUT
            case ErrorCategory.SYSTEM: return ErrorType.SYSTEM
            default: return ErrorType.UNKNOWN
        }
    }

    // Map severity string to enum
    const mapSeverityToEnum = (sev: string): ErrorSeverityEnum => {
        switch (sev) {
            case 'low': return ErrorSeverityEnum.LOW
            case 'medium': return ErrorSeverityEnum.MEDIUM
            case 'high': return ErrorSeverityEnum.HIGH
            case 'critical': return ErrorSeverityEnum.CRITICAL
            default: return ErrorSeverityEnum.MEDIUM
        }
    }

    const error: TauriError = {
        id: errorId,
        errorId,
        name: 'TauriError',
        message,
        type: mapCategoryToErrorType(category),
        source: ErrorSource.FRONTEND,
        severity: mapSeverityToEnum(severity),
        status: ErrorStatus.NEW,
        context: fullContext,
        occurrenceCount: 1,
        firstOccurred: timestamp,
        lastOccurred: timestamp,
        stack: new Error().stack
    }

    return error
}

/**
 * 错误处理器类
 */
export class TauriErrorHandler {
    private handlers = new Map<string, ErrorHandler>()
    private globalHandler?: ErrorHandler
    private errorHistory: TauriError[] = []
    private maxHistorySize = 100

    /**
     * 注册错误处理器
     */
    public register(code: string, handler: ErrorHandler): void {
        this.handlers.set(code, handler)
    }

    /**
     * 注册全局错误处理器
     */
    public registerGlobal(handler: ErrorHandler): void {
        this.globalHandler = handler
    }

    /**
     * 处理错误
     */
    public async handle(error: Error | TauriError | string, context?: Partial<ErrorContext>): Promise<void> {
        const tauriError = this.normalizeError(error, context)

        // 记录错误历史
        this.addToHistory(tauriError)

        // 记录日志
        this.logError(tauriError)

        // 查找特定处理器
        const handler = this.handlers.get(tauriError.errorId)
        if (handler) {
            try {
                await handler(tauriError)
                return
            } catch (handlerError) {
                console.error('Error handler failed:', handlerError)
            }
        }

        // 使用全局处理器
        if (this.globalHandler) {
            try {
                await this.globalHandler(tauriError)
                return
            } catch (handlerError) {
                console.error('Global error handler failed:', handlerError)
            }
        }

        // 默认处理
        this.defaultHandle(tauriError)
    }

    /**
     * 标准化错误对象
     */
    private normalizeError(error: Error | TauriError | string, context?: Partial<ErrorContext>): TauriError {
        if (typeof error === 'string') {
            return createTauriError(error, ERROR_CODES.UNKNOWN_ERROR, ErrorCategory.SYSTEM, 'medium', context)
        }

        if (this.isTauriError(error)) {
            if (context) {
                error.context = { ...error.context, ...context }
            }
            return error
        }

        // 转换普通 Error 为 TauriError
        const tauriError = createTauriError(
            error.message || 'Unknown error',
            ERROR_CODES.UNKNOWN_ERROR,
            ErrorCategory.SYSTEM,
            'medium',
            context
        )

        tauriError.stack = error.stack
        return tauriError
    }

    /**
     * 检查是否为 TauriError
     */
    private isTauriError(error: any): error is TauriError {
        return error && (error.name === 'TauriError' || error.errorId) && typeof error.id === 'string'
    }

    /**
     * 记录错误到历史
     */
    private addToHistory(error: TauriError): void {
        this.errorHistory.unshift(error)
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize)
        }
    }

    /**
     * 记录错误日志
     */
    private logError(error: TauriError): void {
        const logLevel = this.getLogLevel(error.severity)
        const logMessage = this.formatErrorMessage(error)

        switch (logLevel) {
            case LOG_LEVELS.ERROR:
                console.error(logMessage, error)
                break
            case LOG_LEVELS.WARN:
                console.warn(logMessage, error)
                break
            case LOG_LEVELS.INFO:
                console.info(logMessage, error)
                break
            default:
                console.log(logMessage, error)
        }
    }

    /**
     * 获取日志级别
     */
    private getLogLevel(severity: string): string {
        switch (severity) {
            case 'critical':
            case 'high':
                return LOG_LEVELS.ERROR
            case 'medium':
                return LOG_LEVELS.WARN
            case 'low':
                return LOG_LEVELS.INFO
            default:
                return LOG_LEVELS.DEBUG
        }
    }

    /**
     * 格式化错误消息
     */
    private formatErrorMessage(error: TauriError): string {
        const timestamp = error.context.timestamp
        const severity = error.severity.toString()
        const type = error.type.toString()
        return `[${timestamp}] [${severity.toUpperCase()}] [${type}] ${error.errorId}: ${error.message}`
    }

    /**
     * 默认错误处理
     */
    private defaultHandle(error: TauriError): void {
        const severity = error.severity.toString()
        // 根据严重程度决定处理方式
        switch (severity) {
            case 'critical':
                // 关键错误，可能需要重启应用
                console.error('Critical error occurred:', error)
                break
            case 'high':
                // 高级错误，显示错误对话框
                console.error('High severity error:', error)
                break
            case 'medium':
                // 中级错误，显示通知
                console.warn('Medium severity error:', error)
                break
            case 'low':
                // 低级错误，仅记录日志
                console.info('Low severity error:', error)
                break
        }
    }

    /**
     * 获取错误历史
     */
    public getErrorHistory(): TauriError[] {
        return [...this.errorHistory]
    }

    /**
     * 清除错误历史
     */
    public clearHistory(): void {
        this.errorHistory = []
    }

    /**
     * 获取错误统计
     */
    public getErrorStats(): {
        total: number
        bySeverity: Record<string, number>
        byCategory: Record<ErrorCategory, number>
        byCode: Record<string, number>
    } {
        const stats = {
            total: this.errorHistory.length,
            bySeverity: {} as Record<string, number>,
            byCategory: {} as Record<ErrorCategory, number>,
            byCode: {} as Record<string, number>
        }

        // 初始化计数器
        const severities = ['critical', 'high', 'medium', 'low']
        for (const severity of severities) {
            stats.bySeverity[severity] = 0
        }
        Object.values(ErrorCategory).forEach(category => {
            stats.byCategory[category] = 0
        })

        // 统计错误
        this.errorHistory.forEach(error => {
            const severity = error.severity.toString()
            const type = error.type.toString()
            stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1
            stats.byCategory[type as ErrorCategory] = (stats.byCategory[type as ErrorCategory] || 0) + 1
            stats.byCode[error.errorId] = (stats.byCode[error.errorId] || 0) + 1
        })

        return stats
    }
}

/**
 * 全局错误处理器实例
 */
export const errorHandler = new TauriErrorHandler()

/**
 * 预定义的错误处理器
 */
export const predefinedHandlers = {
    /**
     * 网络错误处理器
     */
    networkError: async (error: TauriError) => {
        console.warn('Network error occurred:', error.message)
        // 可以在这里添加重试逻辑或显示网络错误提示
    },

    /**
     * 文件操作错误处理器
     */
    fileError: async (error: TauriError) => {
        console.error('File operation failed:', error.message)
        // 可以在这里添加文件权限检查或路径验证
    },

    /**
     * 窗口操作错误处理器
     */
    windowError: async (error: TauriError) => {
        console.error('Window operation failed:', error.message)
        // 可以在这里添加窗口状态恢复逻辑
    },

    /**
     * 命令执行错误处理器
     */
    commandError: async (error: TauriError) => {
        console.error('Command execution failed:', error.message)
        // 可以在这里添加命令重试或回退逻辑
    }
}

/**
 * 注册预定义的错误处理器
 */
export function registerPredefinedHandlers(): void {
    errorHandler.register(ERROR_CODES.NETWORK_ERROR, predefinedHandlers.networkError)
    errorHandler.register(ERROR_CODES.CONNECTION_FAILED, predefinedHandlers.networkError)
    errorHandler.register(ERROR_CODES.REQUEST_TIMEOUT, predefinedHandlers.networkError)

    errorHandler.register(ERROR_CODES.FILE_NOT_FOUND, predefinedHandlers.fileError)
    errorHandler.register(ERROR_CODES.FILE_ACCESS_DENIED, predefinedHandlers.fileError)
    errorHandler.register(ERROR_CODES.FILE_OPERATION_FAILED, predefinedHandlers.fileError)

    errorHandler.register(ERROR_CODES.WINDOW_NOT_FOUND, predefinedHandlers.windowError)
    errorHandler.register(ERROR_CODES.WINDOW_CREATION_FAILED, predefinedHandlers.windowError)
    errorHandler.register(ERROR_CODES.WINDOW_OPERATION_FAILED, predefinedHandlers.windowError)

    errorHandler.register(ERROR_CODES.COMMAND_NOT_FOUND, predefinedHandlers.commandError)
    errorHandler.register(ERROR_CODES.INVOKE_FAILED, predefinedHandlers.commandError)
}

/**
 * 错误恢复工具
 */
export const errorRecovery = {
    /**
     * 重试操作
     */
    async retry<T>(
        operation: () => Promise<T>,
        maxAttempts: number = 3,
        delay: number = 1000
    ): Promise<T> {
        let lastError: Error

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation()
            } catch (error) {
                lastError = error as Error

                if (attempt === maxAttempts) {
                    break
                }

                console.warn(`Operation failed, retrying... (${attempt}/${maxAttempts})`)
                await new Promise(resolve => setTimeout(resolve, delay * attempt))
            }
        }

        throw createTauriError(
            `Operation failed after ${maxAttempts} attempts: ${lastError!.message}`,
            ERROR_CODES.OPERATION_FAILED,
            ErrorCategory.SYSTEM,
            'high',
            { 
                metadata: { 
                    originalError: lastError!.message, 
                    attempts: maxAttempts 
                } 
            }
        )
    },

    /**
     * 带超时的操作
     */
    async withTimeout<T>(
        operation: () => Promise<T>,
        timeout: number = 10000
    ): Promise<T> {
        return Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(createTauriError(
                        `Operation timed out after ${timeout}ms`,
                        ERROR_CODES.TIMEOUT,
                        ErrorCategory.SYSTEM,
                        'medium',
                        { metadata: { timeout } }
                    ))
                }, timeout)
            })
        ])
    },

    /**
     * 安全执行操作
     */
    async safe<T>(
        operation: () => Promise<T>,
        fallback?: T
    ): Promise<T | undefined> {
        try {
            return await operation()
        } catch (error) {
            await errorHandler.handle(error as Error)
            return fallback
        }
    }
}

/**
 * 用户友好的错误消息映射
 */
export const userFriendlyMessages: Record<string, string> = {
    [ERROR_CODES.NOT_TAURI_ENV]: '应用程序未在桌面环境中运行',
    [ERROR_CODES.WINDOW_NOT_FOUND]: '找不到指定的窗口',
    [ERROR_CODES.FILE_NOT_FOUND]: '找不到指定的文件',
    [ERROR_CODES.FILE_ACCESS_DENIED]: '没有访问文件的权限',
    [ERROR_CODES.NETWORK_ERROR]: '网络连接出现问题',
    [ERROR_CODES.CONNECTION_FAILED]: '无法连接到服务器',
    [ERROR_CODES.TIMEOUT]: '操作超时，请重试',
    [ERROR_CODES.INVALID_PARAMETER]: '参数无效',
    [ERROR_CODES.OPERATION_FAILED]: '操作失败',
    [ERROR_CODES.CHARACTER_LOAD_FAILED]: '角色加载失败',
    [ERROR_CODES.SETTINGS_SAVE_FAILED]: '设置保存失败',
    [ERROR_CODES.ADAPTER_INSTALL_FAILED]: '适配器安装失败',
    [ERROR_CODES.LIVE2D_LOAD_FAILED]: 'Live2D 模型加载失败'
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyMessage(error: TauriError | string): string {
    const code = typeof error === 'string' ? error : error.errorId
    return userFriendlyMessages[code] || '发生了未知错误'
}

/**
 * 初始化错误处理系统
 */
export function initializeErrorHandling(): void {
    // 注册预定义处理器
    registerPredefinedHandlers()

    // 设置全局错误处理器
    errorHandler.registerGlobal(async (error: TauriError) => {
        console.error('Unhandled Tauri error:', error)

        // 在开发环境中显示详细错误信息
        if (process.env.NODE_ENV === 'development') {
            console.group('Error Details')
            console.log('ID:', error.errorId)
            console.log('Type:', error.type)
            console.log('Severity:', error.severity)
            console.log('Context:', error.context)
            console.log('Stack:', error.stack)
            console.groupEnd()
        }
    })

    // 监听未捕获的 Promise 拒绝
    if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', (event) => {
            errorHandler.handle(event.reason).catch(console.error)
        })

        // 监听未捕获的错误
        window.addEventListener('error', (event) => {
            errorHandler.handle(event.error).catch(console.error)
        })
    }
}
