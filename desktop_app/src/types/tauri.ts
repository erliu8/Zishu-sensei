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
 * 窗口配置（简化版，用于窗口服务）
 */
export interface WindowConfig {
    label: string
    url?: string
    title?: string
    width?: number
    height?: number
    x?: number
    y?: number
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    center?: boolean
    resizable?: boolean
    maximizable?: boolean
    minimizable?: boolean
    closable?: boolean
    decorations?: boolean
    alwaysOnTop?: boolean
    fullscreen?: boolean
    transparent?: boolean
    visible?: boolean
    focus?: boolean
    skipTaskbar?: boolean
    theme?: 'light' | 'dark' | null
}

/**
 * 窗口状态
 */
export interface WindowState {
    label: string
    title?: string
    isVisible?: boolean
    isMaximized?: boolean
    isMinimized?: boolean
    isFullscreen?: boolean
    isFocused?: boolean
    isResizable?: boolean
    isDecorated?: boolean
    isAlwaysOnTop?: boolean
    position?: { x: number; y: number }
    size?: { width: number; height: number }
    scaleFactor?: number
}

/**
 * 窗口事件类型
 */
export type WindowEventType =
    | 'tauri://created'
    | 'tauri://close-requested'
    | 'tauri://destroyed'
    | 'tauri://focus'
    | 'tauri://blur'
    | 'tauri://move'
    | 'tauri://resize'
    | 'tauri://scale-change'
    | 'tauri://error'
    | string

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
    dir?: BaseDirectory
    recursive?: boolean
}

/**
 * Tauri 基础目录类型
 */
export type BaseDirectory = 
    | 'Audio' | 'Cache' | 'Config' | 'Data' | 'Document' | 'Download' 
    | 'Executable' | 'Font' | 'Home' | 'Log' | 'Picture' | 'Public' 
    | 'Runtime' | 'Template' | 'Video' | 'Resource' | 'App' 
    | 'AppConfig' | 'AppData' | 'AppLocalData' | 'AppCache' | 'AppLog'

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
 * Tauri 命令载荷类型（通用）
 */
export type TauriCommandPayload = Record<string, any>

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
    | 'show_window'
    | 'hide_window'
    | 'focus_window'
    | 'set_window_title'
    | 'set_window_size'
    | 'set_window_position'
    | 'set_always_on_top'
    | 'create_window'
    | 'show_notification'
    | 'read_file'
    | 'write_file'
    | 'read_dir'
    | 'create_dir'
    | 'remove_file'
    | 'remove_dir'
    | 'copy_file'
    | 'move_file'
    | 'file_exists'
    | 'show_message'
    | 'show_confirm'
    | 'show_open_dialog'
    | 'show_save_dialog'
    | 'set_tray_menu'
    | 'set_tray_icon'
    | 'set_tray_tooltip'
    | 'send_notification'
    | 'read_clipboard'
    | 'write_clipboard'
    | 'register_shortcut'
    | 'unregister_shortcut'
    | 'get_character_list'
    | 'load_character'
    | 'save_settings'
    | 'load_settings'
    | 'install_adapter'
    | 'uninstall_adapter'
    | 'execute_adapter'
    | 'get_adapter_list'
    | 'copy_to_clipboard'
    | 'read_from_clipboard'
    | string

/**
 * 命令状态
 */
export interface CommandState<T = any> {
    loading: boolean
    error: string | null
    data: T
    isReady: boolean
    execute: () => Promise<T>
    reset: () => void
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

/**
 * 应用事件类型定义
 */
export type AppEventType =
    // 窗口事件
    | 'window-created'
    | 'window-destroyed'
    | 'window-focused'
    | 'window-blurred'
    | 'window-moved'
    | 'window-resized'
    | 'window-minimized'
    | 'window-maximized'
    | 'window-restored'
    // 应用事件
    | 'app-ready'
    | 'app-before-quit'
    | 'app-will-quit'
    // 系统事件
    | 'system-theme-changed'
    | 'system-locale-changed'
    // 文件事件
    | 'file-dropped'
    | 'file-drop-hover'
    | 'file-drop-cancelled'
    // 应用特定事件
    | 'character-changed'
    | 'settings-changed'
    | 'adapter-installed'
    | 'adapter-uninstalled'
    | 'adapter-executed'
    | 'chat-message'
    | 'live2d-loaded'
    | 'live2d-error'
    | string

/**
 * 事件载荷类型映射
 */
export interface AppEventPayloadMap {
    'window-created': { label: string }
    'window-destroyed': { label: string }
    'window-focused': { label: string }
    'window-blurred': { label: string }
    'window-moved': { label: string; x: number; y: number }
    'window-resized': { label: string; width: number; height: number }
    'window-minimized': { label: string }
    'window-maximized': { label: string }
    'window-restored': { label: string }
    'app-ready': void
    'app-before-quit': void
    'app-will-quit': void
    'system-theme-changed': { theme: 'light' | 'dark' }
    'system-locale-changed': { locale: string }
    'file-dropped': { paths: string[] }
    'file-drop-hover': { paths: string[] }
    'file-drop-cancelled': void
    'character-changed': { characterId: string }
    'settings-changed': { key: string; value: any }
    'adapter-installed': { adapterId: string; name: string }
    'adapter-uninstalled': { adapterId: string }
    'adapter-executed': { adapterId: string; result: any }
    'chat-message': { message: string; sender: string }
    'live2d-loaded': { modelName: string }
    'live2d-error': { error: string }
}

/**
 * 提取事件载荷类型
 */
export type ExtractEventPayload<T extends AppEventType> =
    T extends keyof AppEventPayloadMap ? AppEventPayloadMap[T] : any

/**
 * 事件监听器状态
 */
export interface EventListenerState<T = any> {
    data: T[]
    loading: boolean
    error: string | null
    isReady: boolean
    events: T[]
    lastEvent: T | null
    subscribe: () => Promise<() => void>
    unsubscribe: () => void
    clear: () => void
}