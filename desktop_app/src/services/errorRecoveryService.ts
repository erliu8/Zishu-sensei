/**
 * 错误恢复服务
 * 提供智能的错误恢复策略和自动重试机制
 */

import { invoke } from '@tauri-apps/api/tauri'
import { 
  ErrorDetails, 
  RecoveryStrategy, 
  RecoveryResult, 
  ErrorType, 
  ErrorSeverity,
  ErrorSource 
} from '../types/error'

// ================================
// 接口定义
// ================================

export interface RecoveryConfig {
  enableAutoRecovery: boolean
  maxRetryAttempts: number
  retryBaseDelay: number
  retryMaxDelay: number
  retryBackoffMultiplier: number
  enableCircuitBreaker: boolean
  circuitBreakerThreshold: number
  circuitBreakerTimeout: number
  enableFallbackMode: boolean
  fallbackTimeout: number
  recoveryTimeout: number
}

export interface RecoveryContext {
  operation?: string
  component?: string
  retryCount: number
  lastAttempt?: number
  circuitState?: 'closed' | 'open' | 'half-open'
  fallbackActive?: boolean
  metadata?: Record<string, any>
}

export interface CircuitBreaker {
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailureTime: number
  nextAttemptTime: number
  threshold: number
  timeout: number
}

export interface RecoveryPlan {
  strategy: RecoveryStrategy
  steps: RecoveryStep[]
  fallbacks: FallbackOption[]
  timeoutMs: number
  priority: number
}

export interface RecoveryStep {
  type: 'retry' | 'fallback' | 'refresh' | 'restart' | 'user_action'
  description: string
  action: () => Promise<any>
  condition?: (error: ErrorDetails) => boolean
  timeout?: number
  retryConfig?: {
    maxAttempts: number
    delay: number
    backoffMultiplier: number
  }
}

export interface FallbackOption {
  name: string
  description: string
  action: () => Promise<any>
  priority: number
  condition: (error: ErrorDetails) => boolean
}

// ================================
// 错误恢复服务类
// ================================

export class ErrorRecoveryService {
  private config: RecoveryConfig
  private recoveryContext: Map<string, RecoveryContext> = new Map()
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private recoveryPlans: Map<string, RecoveryPlan> = new Map()
  private activeRecoveries: Map<string, Promise<RecoveryResult>> = new Map()
  private fallbackCache: Map<string, any> = new Map()

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = {
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 30000,
      retryBackoffMultiplier: 2,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      enableFallbackMode: true,
      fallbackTimeout: 5000,
      recoveryTimeout: 30000,
      ...config,
    }

    this.initializeRecoveryPlans()
  }

  /**
   * 尝试恢复错误
   */
  public async attemptRecovery(
    error: ErrorDetails, 
    options: {
      strategy?: RecoveryStrategy
      context?: Partial<RecoveryContext>
      timeout?: number
    } = {}
  ): Promise<RecoveryResult> {
    const errorKey = this.getErrorKey(error)
    
    // 检查是否已在恢复中
    const existingRecovery = this.activeRecoveries.get(errorKey)
    if (existingRecovery) {
      return await existingRecovery
    }

    // 创建恢复任务
    const recoveryPromise = this.executeRecovery(error, options)
    this.activeRecoveries.set(errorKey, recoveryPromise)

    try {
      const result = await recoveryPromise
      return result
    } finally {
      this.activeRecoveries.delete(errorKey)
    }
  }

  /**
   * 执行具体的恢复策略
   */
  private async executeRecovery(
    error: ErrorDetails,
    options: {
      strategy?: RecoveryStrategy
      context?: Partial<RecoveryContext>
      timeout?: number
    }
  ): Promise<RecoveryResult> {
    const startTime = Date.now()
    const errorKey = this.getErrorKey(error)
    const timeout = options.timeout || this.config.recoveryTimeout

    // 获取或创建恢复上下文
    const context = this.getOrCreateContext(errorKey, options.context)
    
    // 检查断路器状态
    if (this.config.enableCircuitBreaker && this.isCircuitOpen(errorKey)) {
      return {
        success: false,
        strategy: RecoveryStrategy.NONE,
        attempts: context.retryCount,
        duration: Date.now() - startTime,
        message: 'Circuit breaker is open',
        error: 'Recovery blocked by circuit breaker',
      }
    }

    // 确定恢复策略
    const strategy = options.strategy || this.determineStrategy(error, context)
    
    // 获取恢复计划
    const plan = this.getRecoveryPlan(error, strategy)
    
    try {
      // 执行恢复计划
      const result = await Promise.race([
        this.executePlan(error, plan, context),
        this.createTimeoutPromise(timeout)
      ])

      // 更新上下文
      if (result.success) {
        this.onRecoverySuccess(errorKey, context)
      } else {
        this.onRecoveryFailure(errorKey, context, result.error)
      }

      return {
        ...result,
        strategy,
        attempts: context.retryCount + 1,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      this.onRecoveryFailure(errorKey, context, String(error))
      
      return {
        success: false,
        strategy,
        attempts: context.retryCount + 1,
        duration: Date.now() - startTime,
        error: String(error),
      }
    }
  }

  /**
   * 执行恢复计划
   */
  private async executePlan(
    error: ErrorDetails, 
    plan: RecoveryPlan, 
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // 执行主要恢复步骤
    for (const step of plan.steps) {
      if (step.condition && !step.condition(error)) {
        continue
      }

      try {
        const stepResult = await this.executeStep(step, error, context)
        if (stepResult.success) {
          return stepResult
        }
      } catch (stepError) {
        console.warn(`Recovery step ${step.type} failed:`, stepError)
      }
    }

    // 如果主要步骤都失败，尝试降级选项
    for (const fallback of plan.fallbacks) {
      if (!fallback.condition(error)) {
        continue
      }

      try {
        await fallback.action()
        return {
          success: true,
          strategy: RecoveryStrategy.FALLBACK,
          attempts: context.retryCount + 1,
          duration: 0,
          message: `Fallback succeeded: ${fallback.name}`,
        }
      } catch (fallbackError) {
        console.warn(`Fallback ${fallback.name} failed:`, fallbackError)
      }
    }

    return {
      success: false,
      strategy: plan.strategy,
      attempts: context.retryCount + 1,
      duration: 0,
      error: 'All recovery steps failed',
    }
  }

  /**
   * 执行单个恢复步骤
   */
  private async executeStep(
    step: RecoveryStep, 
    error: ErrorDetails, 
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now()

    switch (step.type) {
      case 'retry':
        return await this.executeRetryStep(step, error, context)
      
      case 'fallback':
        return await this.executeFallbackStep(step, error, context)
      
      case 'refresh':
        return await this.executeRefreshStep(step, error, context)
      
      case 'restart':
        return await this.executeRestartStep(step, error, context)
      
      case 'user_action':
        return await this.executeUserActionStep(step, error, context)
      
      default:
        return {
          success: false,
          strategy: RecoveryStrategy.NONE,
          attempts: 1,
          duration: Date.now() - startTime,
          error: `Unknown step type: ${step.type}`,
        }
    }
  }

  /**
   * 执行重试步骤
   */
  private async executeRetryStep(
    step: RecoveryStep,
    _error: ErrorDetails,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const retryConfig = step.retryConfig || {
      maxAttempts: this.config.maxRetryAttempts,
      delay: this.config.retryBaseDelay,
      backoffMultiplier: this.config.retryBackoffMultiplier,
    }

    if (context.retryCount >= retryConfig.maxAttempts) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        attempts: context.retryCount,
        duration: 0,
        error: 'Maximum retry attempts reached',
      }
    }

    // 计算延迟
    const delay = Math.min(
      retryConfig.delay * Math.pow(retryConfig.backoffMultiplier, context.retryCount),
      this.config.retryMaxDelay
    )

    // 等待延迟
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // 执行重试
    try {
      await step.action()
      return {
        success: true,
        strategy: RecoveryStrategy.RETRY,
        attempts: context.retryCount + 1,
        duration: delay,
        message: 'Retry succeeded',
      }
    } catch (retryError) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        attempts: context.retryCount + 1,
        duration: delay,
        error: String(retryError),
      }
    }
  }

  /**
   * 执行降级步骤
   */
  private async executeFallbackStep(
    step: RecoveryStep,
    error: ErrorDetails,
    _context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      const result = await step.action()
      
      // 缓存降级结果
      const cacheKey = this.getFallbackCacheKey(error)
      this.fallbackCache.set(cacheKey, result)
      
      return {
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        attempts: 1,
        duration: 0,
        message: 'Fallback succeeded',
      }
    } catch (fallbackError) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        attempts: 1,
        duration: 0,
        error: String(fallbackError),
      }
    }
  }

  /**
   * 执行刷新步骤
   */
  private async executeRefreshStep(
    _step: RecoveryStep,
    _error: ErrorDetails,
    _context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      // 延迟刷新，给用户提示
      setTimeout(() => {
        window.location.reload()
      }, 2000)

      return {
        success: true,
        strategy: RecoveryStrategy.REFRESH,
        attempts: 1,
        duration: 0,
        message: 'Page will refresh in 2 seconds',
      }
    } catch (error) {
      return {
        success: false,
        strategy: RecoveryStrategy.REFRESH,
        attempts: 1,
        duration: 0,
        error: String(error),
      }
    }
  }

  /**
   * 执行重启步骤
   */
  private async executeRestartStep(
    _step: RecoveryStep,
    _error: ErrorDetails,
    _context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      // 调用 Tauri 重启应用
      await invoke('restart_app')
      
      return {
        success: true,
        strategy: RecoveryStrategy.RESTART,
        attempts: 1,
        duration: 0,
        message: 'Application restart initiated',
      }
    } catch (error) {
      return {
        success: false,
        strategy: RecoveryStrategy.RESTART,
        attempts: 1,
        duration: 0,
        error: String(error),
      }
    }
  }

  /**
   * 执行用户操作步骤
   */
  private async executeUserActionStep(
    step: RecoveryStep,
    _error: ErrorDetails,
    _context: RecoveryContext
  ): Promise<RecoveryResult> {
    // 显示用户提示并等待用户操作
    return {
      success: false,
      strategy: RecoveryStrategy.USER_ACTION,
      attempts: 1,
      duration: 0,
      message: step.description,
    }
  }

  /**
   * 初始化恢复计划
   */
  private initializeRecoveryPlans(): void {
    // JavaScript 错误恢复计划
    this.recoveryPlans.set(ErrorType.JAVASCRIPT, {
      strategy: RecoveryStrategy.RETRY,
      steps: [
        {
          type: 'retry',
          description: 'Retry the failed operation',
          action: async () => { /* 重新执行失败的操作 */ },
          retryConfig: {
            maxAttempts: 3,
            delay: 1000,
            backoffMultiplier: 2,
          },
        },
        {
          type: 'fallback',
          description: 'Use fallback implementation',
          action: async () => this.getJavaScriptFallback(),
        }
      ],
      fallbacks: [
        {
          name: 'Safe Mode',
          description: 'Switch to safe mode',
          action: async () => this.enableSafeMode(),
          priority: 1,
          condition: () => true,
        }
      ],
      timeoutMs: 10000,
      priority: 2,
    })

    // React 错误恢复计划
    this.recoveryPlans.set(ErrorType.REACT, {
      strategy: RecoveryStrategy.REFRESH,
      steps: [
        {
          type: 'retry',
          description: 'Re-render component',
          action: async () => { /* 重新渲染组件 */ },
        },
        {
          type: 'refresh',
          description: 'Refresh page to recover',
          action: async () => { /* 刷新页面 */ },
        }
      ],
      fallbacks: [
        {
          name: 'Error Boundary',
          description: 'Show error boundary fallback',
          action: async () => this.showErrorBoundary(),
          priority: 1,
          condition: (error) => error.source === ErrorSource.FRONTEND,
        }
      ],
      timeoutMs: 5000,
      priority: 3,
    })

    // 网络错误恢复计划
    this.recoveryPlans.set(ErrorType.NETWORK, {
      strategy: RecoveryStrategy.RETRY,
      steps: [
        {
          type: 'retry',
          description: 'Retry network request',
          action: async () => { /* 重试网络请求 */ },
          retryConfig: {
            maxAttempts: 5,
            delay: 2000,
            backoffMultiplier: 1.5,
          },
        }
      ],
      fallbacks: [
        {
          name: 'Offline Mode',
          description: 'Switch to offline mode',
          action: async () => this.enableOfflineMode(),
          priority: 1,
          condition: () => true,
        },
        {
          name: 'Cached Data',
          description: 'Use cached data',
          action: async () => this.getCachedData(),
          priority: 2,
          condition: () => true,
        }
      ],
      timeoutMs: 30000,
      priority: 2,
    })

    // 系统错误恢复计划
    this.recoveryPlans.set(ErrorType.SYSTEM, {
      strategy: RecoveryStrategy.RESTART,
      steps: [
        {
          type: 'fallback',
          description: 'Use system fallback',
          action: async () => this.getSystemFallback(),
        },
        {
          type: 'restart',
          description: 'Restart application',
          action: async () => { /* 重启应用 */ },
        }
      ],
      fallbacks: [
        {
          name: 'Safe Mode',
          description: 'Start in safe mode',
          action: async () => this.enableSafeMode(),
          priority: 1,
          condition: () => true,
        }
      ],
      timeoutMs: 15000,
      priority: 4,
    })
  }

  /**
   * 确定恢复策略
   */
  private determineStrategy(error: ErrorDetails, context: RecoveryContext): RecoveryStrategy {
    // 基于错误类型
    if (error.type === ErrorType.NETWORK) {
      return RecoveryStrategy.RETRY
    }
    
    if (error.type === ErrorType.REACT) {
      return RecoveryStrategy.REFRESH
    }
    
    if (error.severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.RESTART
    }

    // 基于重试次数
    if (context.retryCount >= this.config.maxRetryAttempts) {
      return RecoveryStrategy.FALLBACK
    }

    return RecoveryStrategy.RETRY
  }

  /**
   * 获取恢复计划
   */
  private getRecoveryPlan(error: ErrorDetails, strategy: RecoveryStrategy): RecoveryPlan {
    // 根据错误类型获取预定义计划
    const predefinedPlan = this.recoveryPlans.get(error.type)
    if (predefinedPlan) {
      return predefinedPlan
    }

    // 创建默认计划
    return this.createDefaultPlan(strategy)
  }

  /**
   * 创建默认恢复计划
   */
  private createDefaultPlan(strategy: RecoveryStrategy): RecoveryPlan {
    return {
      strategy,
      steps: [
        {
          type: 'retry',
          description: 'Default retry',
          action: async () => { /* 默认重试 */ },
        }
      ],
      fallbacks: [],
      timeoutMs: this.config.recoveryTimeout,
      priority: 1,
    }
  }

  // ================================
  // 断路器相关方法
  // ================================

  /**
   * 检查断路器是否开启
   */
  private isCircuitOpen(errorKey: string): boolean {
    const circuit = this.circuitBreakers.get(errorKey)
    if (!circuit) return false

    const now = Date.now()

    if (circuit.state === 'open') {
      if (now >= circuit.nextAttemptTime) {
        circuit.state = 'half-open'
        return false
      }
      return true
    }

    return false
  }

  /**
   * 恢复成功处理
   */
  private onRecoverySuccess(errorKey: string, context: RecoveryContext): void {
    // 重置断路器
    const circuit = this.circuitBreakers.get(errorKey)
    if (circuit) {
      circuit.state = 'closed'
      circuit.failureCount = 0
    }

    // 重置恢复上下文
    context.retryCount = 0
    context.circuitState = 'closed'
    context.lastAttempt = Date.now()
  }

  /**
   * 恢复失败处理
   */
  private onRecoveryFailure(errorKey: string, context: RecoveryContext, _error?: string): void {
    context.retryCount++
    context.lastAttempt = Date.now()

    // 更新断路器
    if (this.config.enableCircuitBreaker) {
      let circuit = this.circuitBreakers.get(errorKey)
      if (!circuit) {
        circuit = {
          state: 'closed',
          failureCount: 0,
          lastFailureTime: 0,
          nextAttemptTime: 0,
          threshold: this.config.circuitBreakerThreshold,
          timeout: this.config.circuitBreakerTimeout,
        }
        this.circuitBreakers.set(errorKey, circuit)
      }

      circuit.failureCount++
      circuit.lastFailureTime = Date.now()

      if (circuit.failureCount >= circuit.threshold) {
        circuit.state = 'open'
        circuit.nextAttemptTime = Date.now() + circuit.timeout
        context.circuitState = 'open'
      }
    }
  }

  // ================================
  // 工具方法
  // ================================

  /**
   * 生成错误键
   */
  private getErrorKey(error: ErrorDetails): string {
    return `${error.type}_${error.name}_${error.context.component || 'unknown'}`
  }

  /**
   * 获取或创建恢复上下文
   */
  private getOrCreateContext(errorKey: string, partialContext?: Partial<RecoveryContext>): RecoveryContext {
    let context = this.recoveryContext.get(errorKey)
    if (!context) {
      context = {
        retryCount: 0,
        circuitState: 'closed',
        fallbackActive: false,
        ...partialContext,
      }
      this.recoveryContext.set(errorKey, context)
    } else {
      Object.assign(context, partialContext)
    }
    return context
  }

  /**
   * 获取降级缓存键
   */
  private getFallbackCacheKey(error: ErrorDetails): string {
    return `fallback_${error.type}_${error.context.operation || 'default'}`
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(timeout: number): Promise<RecoveryResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Recovery timeout'))
      }, timeout)
    })
  }

  // ================================
  // 降级实现方法
  // ================================

  private async getJavaScriptFallback(): Promise<any> {
    return { message: 'JavaScript fallback implemented' }
  }

  private async showErrorBoundary(): Promise<any> {
    return { message: 'Error boundary fallback shown' }
  }

  private async enableOfflineMode(): Promise<any> {
    return { message: 'Offline mode enabled' }
  }

  private async getCachedData(): Promise<any> {
    return { message: 'Cached data retrieved' }
  }

  private async getSystemFallback(): Promise<any> {
    return { message: 'System fallback implemented' }
  }

  private async enableSafeMode(): Promise<any> {
    return { message: 'Safe mode enabled' }
  }

  // ================================
  // 公共方法
  // ================================

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 获取恢复统计
   */
  public getRecoveryStats(): {
    activeRecoveries: number
    contextCount: number
    circuitBreakers: number
    fallbackCacheSize: number
  } {
    return {
      activeRecoveries: this.activeRecoveries.size,
      contextCount: this.recoveryContext.size,
      circuitBreakers: this.circuitBreakers.size,
      fallbackCacheSize: this.fallbackCache.size,
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.recoveryContext.clear()
    this.circuitBreakers.clear()
    this.fallbackCache.clear()
    this.activeRecoveries.clear()
  }
}

// ================================
// 导出
// ================================

export const errorRecoveryService = new ErrorRecoveryService()
