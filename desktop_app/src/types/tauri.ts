/**
 * Tauri 相关类型定义
 */

/**
 * Tauri 环境信息
 */
export interface TauriEnvironment {
    platform: string
    arch: string
    os: string
    version: string
    tauriVersion: string
    webviewVersion: string
}

/**
 * Tauri 窗口配置
 */
export interface TauriWindowConfig {
    label: string
    title: string
    url: string
    width: number
    height: number
    x?: number
    y?: number
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    resizable: boolean
    fullscreen: boolean
    alwaysOnTop: boolean
    decorations: boolean
    transparent: boolean
    visible: boolean
    center: boolean
    skipTaskbar: boolean
}

/**
 * Tauri 文件对话框选项
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
 * Tauri 通知选项
 */
export interface TauriNotificationOptions {
    title: string
    body?: string
    icon?: string
    sound?: string
}

/**
 * Tauri 系统托盘菜单项
 */
export interface TauriTrayMenuItem {
    id: string
    title: string
    enabled?: boolean
    checked?: boolean
    icon?: string
}

/**
 * Tauri 快捷键配置
 */
export interface TauriShortcut {
    shortcut: string
    callback: () => void | Promise<void>
    global?: boolean
}

/**
 * Tauri 事件类型
 */
export type TauriEventType =
    | 'tauri://window-created'
    | 'tauri://window-destroyed'
    | 'tauri://window-focus'
    | 'tauri://window-blur'
    | 'tauri://window-scale-factor-changed'
    | 'tauri://window-theme-changed'
    | 'tauri://menu'
    | 'tauri://file-drop'
    | 'tauri://file-drop-hover'
    | 'tauri://file-drop-cancelled'
    | 'tauri://update-available'
    | 'tauri://update-install'
    | string

/**
 * Tauri 事件载荷
 */
export interface TauriEvent<T = any> {
    event: TauriEventType
    windowLabel: string
    payload: T
    id: number
}

/**
 * Tauri 命令调用选项
 */
export interface TauriInvokeOptions {
    timeout?: number
}

/**
 * Tauri 文件系统操作选项
 */
export interface TauriFsOptions {
    dir?: 'audio' | 'cache' | 'config' | 'data' | 'document' | 'download' | 'executable' | 'font' | 'home' | 'log' | 'picture' | 'public' | 'runtime' | 'template' | 'video' | 'resource' | 'app' | 'appConfig' | 'appData' | 'appLocalData' | 'appCache' | 'appLog'
    recursive?: boolean
}

/**
 * Tauri HTTP 请求选项
 */
export interface TauriHttpOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    headers?: Record<string, string>
    body?: any
    timeout?: number
}

/**
 * Tauri HTTP 响应
 */
export interface TauriHttpResponse<T = any> {
    status: number
    ok: boolean
    headers: Record<string, string>
    data: T
}

/**
 * Tauri 应用信息
 */
export interface TauriAppInfo {
    name: string
    version: string
    tauriVersion: string
}

/**
 * Tauri 更新信息
 */
export interface TauriUpdateInfo {
    available: boolean
    currentVersion: string
    latestVersion?: string
    releaseNotes?: string
    publishedAt?: string
    downloadUrl?: string
}

/**
 * Tauri Store 配置
 */
export interface TauriStoreConfig {
    path?: string
    defaults?: Record<string, any>
}

/**
 * Tauri 日志级别
 */
export type TauriLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

/**
 * Tauri 日志配置
 */
export interface TauriLogConfig {
    level: TauriLogLevel
    targets?: Array<{
        target: string
        level: TauriLogLevel
    }>
}

/**
 * Tauri 应用命令类型
 */
export type AppCommand =
    | 'get_app_info'
    | 'get_system_info'
    | 'open_url'
    | 'show_in_folder'
    | 'exit_app'
    | 'minimize_window'
    | 'maximize_window'
    | 'close_window'
    | 'set_window_title'
    | 'set_window_size'
    | 'set_window_position'
    | 'show_notification'
    | 'read_file'
    | 'write_file'
    | 'copy_to_clipboard'
    | 'read_from_clipboard'

/**
 * 命令状态
 */
export interface CommandState {
    loading: boolean
    error: string | null
    data: any
}

/**
 * 提取命令载荷类型
 */
export type ExtractCommandPayload<T extends AppCommand> =
    T extends 'get_app_info' ? void :
    T extends 'get_system_info' ? void :
    T extends 'open_url' ? { url: string } :
    T extends 'show_in_folder' ? { path: string } :
    T extends 'exit_app' ? void :
    T extends 'minimize_window' ? void :
    T extends 'maximize_window' ? void :
    T extends 'close_window' ? void :
    T extends 'set_window_title' ? { title: string } :
    T extends 'set_window_size' ? { width: number; height: number } :
    T extends 'set_window_position' ? { x: number; y: number } :
    T extends 'show_notification' ? TauriNotificationOptions :
    T extends 'read_file' ? { path: string } :
    T extends 'write_file' ? { path: string; content: string } :
    T extends 'copy_to_clipboard' ? { text: string } :
    T extends 'read_from_clipboard' ? void :
    any

/**
 * Tauri 响应类型
 */
export interface TauriResponse<T = any> {
    success: boolean
    data?: T
    error?: string
}