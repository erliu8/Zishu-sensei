/**
 * 应用程序状态类型定义
 */

/**
 * 应用程序错误类型
 */
export interface AppError {
    message: string
    code?: string
    details?: any
    stack?: string
    timestamp: number
}

/**
 * 应用程序状态
 */
export interface AppState {
    isLoading: boolean
    error: AppError | null
    initialized: boolean
    version: string
}

/**
 * 窗口模式
 */
export type WindowMode = 'windowed' | 'fullscreen' | 'minimized' | 'maximized'

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
}

/**
 * 主题模式
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * 应用设置
 */
export interface AppSettings {
    theme: ThemeMode
    language: string
    autoStart: boolean
    windowState: WindowState
    notifications: {
        enabled: boolean
        sound: boolean
        desktop: boolean
    }
    ai: {
        model: string
        apiKey?: string
        endpoint?: string
        temperature: number
        maxTokens: number
    }
    character: {
        model: string
        voice: string
        personality: string
    }
}

/**
 * 用户配置
 */
export interface UserConfig {
    id: string
    name: string
    avatar?: string
    settings: AppSettings
    createdAt: number
    updatedAt: number
}

/**
 * 应用事件类型
 */
export type AppEvent =
    | { type: 'APP_INIT'; payload: { version: string } }
    | { type: 'APP_ERROR'; payload: AppError }
    | { type: 'WINDOW_STATE_CHANGED'; payload: WindowState }
    | { type: 'THEME_CHANGED'; payload: ThemeMode }
    | { type: 'SETTINGS_UPDATED'; payload: Partial<AppSettings> }
    | { type: 'USER_CONFIG_LOADED'; payload: UserConfig }

/**
 * API响应基础结构
 */
export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: {
        message: string
        code?: string
        details?: any
    }
    meta?: {
        timestamp: number
        requestId: string
        version: string
    }
}

/**
 * 分页参数
 */
export interface PaginationParams {
    page: number
    limit: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

/**
 * 文件信息
 */
export interface FileInfo {
    name: string
    path: string
    size: number
    type: string
    lastModified: number
    isDirectory: boolean
}

/**
 * 导出/导入数据格式
 */
export interface ExportData {
    version: string
    timestamp: number
    userConfig: UserConfig
    chatHistory?: any[]
    characterData?: any[]
}