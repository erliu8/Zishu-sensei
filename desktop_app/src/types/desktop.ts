/**
 * 桌面应用类型定义
 * 
 * 提供桌面应用相关的 TypeScript 类型定义，包括：
 * - 桌面操作类型
 * - 窗口状态类型
 * - 系统信息类型
 * - 性能监控类型
 * - 通知类型
 * - 文件操作类型
 */

import type { AppSettings, ApiResponse } from '@/types/app'
import type { AppConfig } from '@/types/settings'

/**
 * 桌面环境类型
 */
export type DesktopEnvironment = 'tauri' | 'electron' | 'browser' | 'unknown'

/**
 * 窗口模式
 */
export type WindowMode = 'pet' | 'chat' | 'settings' | 'minimized' | 'maximized' | 'fullscreen'

/**
 * 窗口状态
 */
export interface WindowState {
    mode: WindowMode
    position: { x: number; y: number }
    size: { width: number; height: number }
    isVisible: boolean
    isAlwaysOnTop: boolean
    isResizable: boolean
    title: string
    opacity: number
    zIndex: number
}

/**
 * 系统信息
 */
export interface SystemInfo {
    platform: string
    arch: string
    version: string
    os: string
    tauriVersion: string
    webviewVersion: string
    memory: {
        total: number
        used: number
        available: number
    }
    cpu: {
        cores: number
        usage: number
        frequency: number
    }
    disk: {
        total: number
        used: number
        available: number
    }
}

/**
 * 应用信息
 */
export interface AppInfo {
    name: string
    version: string
    buildDate: string
    environment: DesktopEnvironment
    isPackaged: boolean
    isDev: boolean
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
    memoryUsage: number
    cpuUsage: number
    uptime: number
    lastUpdate: number
    networkLatency?: number
    diskIO?: {
        read: number
        write: number
    }
    gpuUsage?: number
}

/**
 * 连接状态
 */
export interface ConnectivityStatus {
    isOnline: boolean
    apiEndpoint: string
    lastPing: number
    latency: number
    connectionType?: 'wifi' | 'ethernet' | 'cellular' | 'unknown'
}

/**
 * 更新信息
 */
export interface UpdateInfo {
    version: string
    releaseNotes: string
    downloadUrl: string
    publishedAt: string
    size: number
    checksum: string
    isRequired: boolean
    features: string[]
    bugFixes: string[]
}

/**
 * 通知选项
 */
export interface TauriNotificationOptions {
    title: string
    body?: string
    icon?: string
    sound?: boolean
    actions?: Array<{
        label: string
        action: string
    }>
}

/**
 * 文件对话框选项
 */
export interface TauriFileDialogOptions {
    title?: string
    defaultPath?: string
    filters?: Array<{
        name: string
        extensions: string[]
    }>
    multiple?: boolean
    directory?: boolean
}

/**
 * 文件操作结果
 */
export interface FileOperationResult {
    success: boolean
    path: string
    content?: string
    error?: string
}

/**
 * 快捷键配置
 */
export interface ShortcutConfig {
    key: string
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    global: boolean
    description: string
    callback: () => void
}

/**
 * 操作历史记录
 */
export interface OperationHistory {
    id: string
    operation: string
    timestamp: number
    success: boolean
    duration: number
    error?: string
    metadata?: Record<string, any>
}

/**
 * 重试队列项
 */
export interface RetryQueueItem {
    id: string
    operation: string
    timestamp: number
    attempts: number
    maxAttempts: number
    error: string
}

/**
 * 桌面应用状态
 */
export interface DesktopAppState {
    isReady: boolean
    isInitializing: boolean
    isMinimizedToTray: boolean
    hasUpdate: boolean
    updateInfo?: UpdateInfo
    systemInfo: SystemInfo
    appInfo: AppInfo
    performance: PerformanceMetrics
    connectivity: ConnectivityStatus
}

/**
 * 桌面操作状态
 */
export interface DesktopOperationState {
    isLoading: boolean
    error: string | null
    lastOperation: string | null
    operationHistory: OperationHistory[]
    retryQueue: RetryQueueItem[]
}

/**
 * 快捷键状态
 */
export interface ShortcutState {
    registered: Array<ShortcutConfig & { id: string }>
    isEnabled: boolean
    lastTriggered?: {
        shortcut: string
        timestamp: number
    }
}

/**
 * 文件操作状态
 */
export interface FileOperationState {
    recentFiles: Array<{
        path: string
        name: string
        lastAccessed: number
        size: number
        type: string
    }>
    openFiles: Array<{
        path: string
        content?: string
        isModified: boolean
        lastModified: number
    }>
    clipboard: {
        text: string
        timestamp: number
    }
}

/**
 * 通知状态
 */
export interface NotificationState {
    queue: Array<{
        id: string
        title: string
        body?: string
        icon?: string
        timestamp: number
        read: boolean
        actions?: Array<{
            label: string
            action: string
        }>
    }>
    isEnabled: boolean
    permission: 'granted' | 'denied' | 'default'
}

/**
 * 桌面应用完整状态
 */
export interface DesktopStoreState {
    appState: DesktopAppState
    operationState: DesktopOperationState
    windowState: WindowState
    shortcutState: ShortcutState
    fileOperationState: FileOperationState
    notificationState: NotificationState
    settings: AppSettings
    config: AppConfig
    isInitialized: boolean
    isOnline: boolean
    lastSyncTime: number
}

/**
 * 桌面 API 配置
 */
export interface DesktopApiConfig {
    baseUrl: string
    timeout: number
    retryAttempts: number
    retryDelay: number
    enableLogging: boolean
}

/**
 * 同步状态
 */
export interface SyncStatus {
    lastSync: number
    pendingChanges: number
    conflicts: Array<{
        key: string
        local: any
        remote: any
        timestamp: number
    }>
    isOnline: boolean
    syncInProgress: boolean
}

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
 * 桌面事件类型
 */
export type DesktopEvent = 
    | { type: 'APP_INITIALIZED'; payload: { timestamp: number } }
    | { type: 'APP_ERROR'; payload: { error: string; timestamp: number } }
    | { type: 'WINDOW_STATE_CHANGED'; payload: WindowState }
    | { type: 'OPERATION_COMPLETED'; payload: { operation: string; success: boolean; duration: number } }
    | { type: 'NOTIFICATION_ADDED'; payload: { id: string; title: string } }
    | { type: 'FILE_OPENED'; payload: { path: string; name: string } }
    | { type: 'SHORTCUT_TRIGGERED'; payload: { shortcut: string; timestamp: number } }
    | { type: 'PERFORMANCE_UPDATED'; payload: PerformanceMetrics }
    | { type: 'CONNECTIVITY_CHANGED'; payload: { isOnline: boolean; latency: number } }
    | { type: 'UPDATE_AVAILABLE'; payload: UpdateInfo }
    | { type: 'SYNC_STATUS_CHANGED'; payload: SyncStatus }

/**
 * 桌面 Hook 返回值类型
 */
export interface UseDesktopReturn {
    // 基础状态
    state: DesktopAppState
    operationState: DesktopOperationState
    settings: AppSettings
    config: AppConfig
    isAvailable: boolean
    isLoading: boolean
    error: string | null

    // 应用管理
    initializeApp: () => Promise<void>
    restartApp: () => Promise<void>
    exitApp: () => Promise<void>
    getAppInfo: () => Promise<AppInfo>
    getSystemInfo: () => Promise<SystemInfo>
    checkConnectivity: () => Promise<boolean>

    // 窗口管理
    minimizeToTray: () => Promise<void>
    restoreFromTray: () => Promise<void>
    showInTray: (show: boolean) => Promise<void>
    toggleWindowMode: () => Promise<void>
    setWindowMode: (mode: WindowMode) => Promise<void>
    centerWindow: () => Promise<void>
    setAlwaysOnTop: (enabled: boolean) => Promise<void>

    // 更新管理
    checkForUpdates: () => Promise<void>
    installUpdate: () => Promise<void>
    downloadUpdate: () => Promise<void>
    skipUpdate: () => Promise<void>

    // 系统集成
    setAutoStart: (enabled: boolean) => Promise<void>
    openDevTools: () => Promise<void>
    showNotification: (options: TauriNotificationOptions) => Promise<void>
    openExternal: (url: string) => Promise<void>
    copyToClipboard: (text: string) => Promise<void>
    readFromClipboard: () => Promise<string>

    // 文件操作
    showSaveDialog: (options?: TauriFileDialogOptions) => Promise<string | null>
    showOpenDialog: (options?: TauriFileDialogOptions) => Promise<string[] | null>
    writeFile: (path: string, content: string) => Promise<FileOperationResult>
    readFile: (path: string) => Promise<FileOperationResult>
    deleteFile: (path: string) => Promise<FileOperationResult>
    createDirectory: (path: string) => Promise<FileOperationResult>
    listDirectory: (path: string) => Promise<string[]>
    getFileInfo: (path: string) => Promise<any>

    // 设置管理
    updateSettings: (settings: Partial<AppSettings>) => Promise<void>
    updateConfig: (config: Partial<AppConfig>) => Promise<void>
    exportSettings: () => Promise<string>
    importSettings: (settingsJson: string) => Promise<void>
    resetSettings: () => Promise<void>

    // 快捷键管理
    registerGlobalShortcuts: () => void
    unregisterGlobalShortcuts: () => void
    registerShortcut: (shortcut: string, callback: () => void) => Promise<void>
    unregisterShortcut: (shortcut: string) => Promise<void>

    // 性能监控
    getPerformanceMetrics: () => Promise<any>
    startPerformanceMonitoring: () => void
    stopPerformanceMonitoring: () => void

    // 工具方法
    clearError: () => void
    clearOperationHistory: () => void
    retryLastOperation: () => Promise<void>
    logOperation: (operation: string, success: boolean, error?: string, metadata?: Record<string, any>) => void
}

/**
 * 桌面 API Hook 返回值类型
 */
export interface UseDesktopApiReturn {
    api: any
    isOnline: boolean
    syncStatus: SyncStatus
    checkConnectivity: () => Promise<boolean>
    getSystemInfo: () => Promise<SystemInfo>
    uploadPerformanceMetrics: (metrics: PerformanceMetrics) => Promise<ApiResponse<{ received: boolean }>>
    syncSettings: (settings: AppSettings) => Promise<ApiResponse<{ synced: boolean; conflicts?: any[] }>>
    getRemoteSettings: () => Promise<ApiResponse<AppSettings>>
    uploadErrorReport: (errorReport: ErrorInfo) => Promise<ApiResponse<{ id: string; processed: boolean }>>
    checkForUpdates: () => Promise<ApiResponse<UpdateInfo | null>>
    downloadUpdate: (updateInfo: UpdateInfo) => Promise<ApiResponse<{ downloadUrl: string; progress?: number }>>
    getDeviceStats: () => Promise<ApiResponse<any>>
    uploadUsageStats: (stats: any) => Promise<ApiResponse<{ received: boolean }>>
    getRemoteConfig: () => Promise<ApiResponse<AppConfig>>
    uploadConfig: (config: AppConfig) => Promise<ApiResponse<{ synced: boolean }>>
    getNotifications: () => Promise<ApiResponse<any[]>>
    markNotificationRead: (id: string) => Promise<ApiResponse<{ marked: boolean }>>
    forceSync: () => Promise<void>
}

/**
 * 错误处理 Hook 返回值类型
 */
export interface UseErrorHandlerReturn {
    errorHandler: any
    handleError: (error: Error, context?: any) => Promise<ErrorHandleResult>
    executeWithErrorHandling: (operation: () => Promise<any>, context?: any) => Promise<any>
    retryOperation: (operation: () => Promise<any>, config?: Partial<RetryConfig>) => Promise<any>
    getErrorHistory: () => ErrorInfo[]
    clearErrorHistory: () => void
    getErrorStats: () => {
        total: number
        byType: Record<ErrorType, number>
        bySeverity: Record<ErrorSeverity, number>
        recent: number
    }
}

/**
 * 类型守卫函数
 */
export const isDesktopEnvironment = (env: string): env is DesktopEnvironment => {
    return ['tauri', 'electron', 'browser', 'unknown'].includes(env)
}

export const isWindowMode = (mode: string): mode is WindowMode => {
    return ['pet', 'chat', 'settings', 'minimized', 'maximized', 'fullscreen'].includes(mode)
}

export const isErrorType = (type: string): type is ErrorType => {
    return Object.values(ErrorType).includes(type as ErrorType)
}

export const isErrorSeverity = (severity: string): severity is ErrorSeverity => {
    return Object.values(ErrorSeverity).includes(severity as ErrorSeverity)
}

/**
 * 任务监控 Hook 返回值类型
 */
export interface UseTaskMonitorReturn {
    // 任务数据
    tasks: Array<{
        id: string
        name: string
        type: 'workflow' | 'adapter' | 'system' | 'custom'
        status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
        priority: 'low' | 'normal' | 'high' | 'urgent'
        progress: {
            current: number
            total: number
            percentage: number
            message?: string
        }
        created_at: string
        started_at?: string
        ended_at?: string
        error?: string
        result?: any
        config?: Record<string, any>
    }>
    
    // 统计信息
    stats: {
        total_tasks: number
        running_tasks: number
        completed_tasks: number
        failed_tasks: number
        pending_tasks: number
        average_execution_time_ms: number
        success_rate_percent: number
    } | null
    
    // 系统资源
    systemResources: {
        cpu_usage: number
        memory: {
            total_mb: number
            used_mb: number
            available_mb: number
            usage_percent: number
        }
        disk: {
            total_mb: number
            used_mb: number
            available_mb: number
            usage_percent: number
        }
        gpu?: {
            name: string
            usage_percent: number
            memory: {
                total_mb: number
                used_mb: number
                usage_percent: number
            }
            temperature?: number
        }
        network: {
            download_speed_kbps: number
            upload_speed_kbps: number
            total_downloaded_mb: number
            total_uploaded_mb: number
        }
    } | null
    
    // 状态
    isLoading: boolean
    error: string | null
    lastRefresh: Date
    
    // 操作
    refreshData: () => Promise<void>
    cancelTask: (taskId: string) => Promise<void>
    retryTask: (taskId: string) => Promise<void>
    getTaskDetails: (taskId: string) => Promise<any>
    clearError: () => void
    
    // 配置
    setAutoRefresh: (enabled: boolean) => void
    setRefreshInterval: (interval: number) => void
    setTaskFilter: (filter: (task: any) => boolean) => void
}

/**
 * 任务执行上下文
 */
export interface TaskExecutionContext {
    taskId: string
    workflowId?: string
    userId?: string
    sessionId?: string
    metadata?: Record<string, any>
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
    success: boolean
    taskId: string
    result?: any
    error?: ErrorInfo
    duration: number
    timestamp: number
}

/**
 * 任务队列配置
 */
export interface TaskQueueConfig {
    maxConcurrent: number
    maxRetries: number
    retryDelay: number
    timeout: number
    priority: 'low' | 'normal' | 'high' | 'urgent'
}

/**
 * 任务调度器状态
 */
export interface TaskSchedulerState {
    isRunning: boolean
    queueSize: number
    activeTasksCount: number
    completedTasksCount: number
    failedTasksCount: number
    lastTaskExecutionTime: number
}

/**
 * 类型工具函数
 */
export const createEmptyWindowState = (): WindowState => ({
    mode: 'pet',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 600 },
    isVisible: true,
    isAlwaysOnTop: true,
    isResizable: true,
    title: '紫舒老师桌面版',
    opacity: 1.0,
    zIndex: 1000,
})

export const createEmptySystemInfo = (): SystemInfo => ({
    platform: 'unknown',
    arch: 'unknown',
    version: 'unknown',
    os: 'unknown',
    tauriVersion: 'unknown',
    webviewVersion: 'unknown',
    memory: { total: 0, used: 0, available: 0 },
    cpu: { cores: 0, usage: 0, frequency: 0 },
    disk: { total: 0, used: 0, available: 0 },
})

export const createEmptyAppInfo = (): AppInfo => ({
    name: 'Zishu Sensei',
    version: '1.0.0',
    buildDate: '',
    environment: 'unknown',
    isPackaged: false,
    isDev: true,
})

export const createEmptyPerformanceMetrics = (): PerformanceMetrics => ({
    memoryUsage: 0,
    cpuUsage: 0,
    uptime: 0,
    lastUpdate: Date.now(),
})

export const createEmptyConnectivityStatus = (): ConnectivityStatus => ({
    isOnline: false,
    apiEndpoint: 'http://127.0.0.1:8000',
    lastPing: 0,
    latency: 0,
})

// 所有类型已通过 export interface/export type 方式导出
