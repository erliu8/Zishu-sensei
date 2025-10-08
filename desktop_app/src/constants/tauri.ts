/**
 * Tauri 常量定义
 * 
 * 包含 Tauri 应用中使用的各种常量
 */

/**
 * 应用信息常量
 */
export const APP_INFO = {
    NAME: 'Zishu Sensei',
    VERSION: '1.0.0',
    DESCRIPTION: 'AI桌面助手应用',
    AUTHOR: 'Zishu Team',
    HOMEPAGE: 'https://zishu.ai',
    REPOSITORY: 'https://github.com/zishu-ai/desktop-app'
} as const

/**
 * 窗口标签常量
 */
export const WINDOW_LABELS = {
    MAIN: 'main',
    SETTINGS: 'settings',
    CHAT: 'chat',
    CHARACTER: 'character',
    ADAPTER: 'adapter',
    ABOUT: 'about',
    SPLASH: 'splash',
    OVERLAY: 'overlay'
} as const

/**
 * 窗口尺寸预设
 */
export const WINDOW_SIZES = {
    SMALL: { width: 800, height: 600 },
    MEDIUM: { width: 1200, height: 800 },
    LARGE: { width: 1600, height: 1000 },
    FULL_HD: { width: 1920, height: 1080 },
    MOBILE: { width: 375, height: 667 },
    TABLET: { width: 768, height: 1024 },
    CHAT: { width: 400, height: 600 },
    SETTINGS: { width: 800, height: 700 },
    SPLASH: { width: 400, height: 300 }
} as const

/**
 * 事件名称常量
 */
export const EVENT_NAMES = {
    // 窗口事件
    WINDOW_CREATED: 'window-created',
    WINDOW_DESTROYED: 'window-destroyed',
    WINDOW_FOCUSED: 'window-focused',
    WINDOW_BLURRED: 'window-blurred',
    WINDOW_MOVED: 'window-moved',
    WINDOW_RESIZED: 'window-resized',
    WINDOW_MINIMIZED: 'window-minimized',
    WINDOW_MAXIMIZED: 'window-maximized',
    WINDOW_RESTORED: 'window-restored',

    // 应用事件
    APP_READY: 'app-ready',
    APP_BEFORE_QUIT: 'app-before-quit',
    APP_WILL_QUIT: 'app-will-quit',
    APP_ERROR: 'app-error',

    // 系统事件
    SYSTEM_THEME_CHANGED: 'system-theme-changed',
    SYSTEM_LOCALE_CHANGED: 'system-locale-changed',
    SYSTEM_SLEEP: 'system-sleep',
    SYSTEM_WAKE: 'system-wake',

    // 文件事件
    FILE_DROPPED: 'file-dropped',
    FILE_DROP_HOVER: 'file-drop-hover',
    FILE_DROP_CANCELLED: 'file-drop-cancelled',

    // 应用特定事件
    CHARACTER_CHANGED: 'character-changed',
    SETTINGS_CHANGED: 'settings-changed',
    ADAPTER_INSTALLED: 'adapter-installed',
    ADAPTER_UNINSTALLED: 'adapter-uninstalled',
    ADAPTER_EXECUTED: 'adapter-executed',
    CHAT_MESSAGE: 'chat-message',
    LIVE2D_LOADED: 'live2d-loaded',
    LIVE2D_ERROR: 'live2d-error'
} as const

/**
 * 命令名称常量
 */
export const COMMAND_NAMES = {
    // 窗口管理
    CREATE_WINDOW: 'create_window',
    CLOSE_WINDOW: 'close_window',
    SHOW_WINDOW: 'show_window',
    HIDE_WINDOW: 'hide_window',
    FOCUS_WINDOW: 'focus_window',
    MINIMIZE_WINDOW: 'minimize_window',
    MAXIMIZE_WINDOW: 'maximize_window',
    SET_WINDOW_POSITION: 'set_window_position',
    SET_WINDOW_SIZE: 'set_window_size',
    SET_WINDOW_TITLE: 'set_window_title',
    SET_ALWAYS_ON_TOP: 'set_always_on_top',

    // 文件操作
    READ_FILE: 'read_file',
    WRITE_FILE: 'write_file',
    READ_DIR: 'read_dir',
    CREATE_DIR: 'create_dir',
    REMOVE_FILE: 'remove_file',
    REMOVE_DIR: 'remove_dir',
    COPY_FILE: 'copy_file',
    MOVE_FILE: 'move_file',
    FILE_EXISTS: 'file_exists',

    // 对话框
    SHOW_MESSAGE: 'show_message',
    SHOW_CONFIRM: 'show_confirm',
    SHOW_OPEN_DIALOG: 'show_open_dialog',
    SHOW_SAVE_DIALOG: 'show_save_dialog',

    // 系统信息
    GET_SYSTEM_INFO: 'get_system_info',
    GET_APP_VERSION: 'get_app_version',
    RESTART_APP: 'restart_app',
    EXIT_APP: 'exit_app',
    OPEN_URL: 'open_url',
    SHOW_IN_FOLDER: 'show_in_folder',

    // 应用特定
    GET_CHARACTER_LIST: 'get_character_list',
    LOAD_CHARACTER: 'load_character',
    SAVE_SETTINGS: 'save_settings',
    LOAD_SETTINGS: 'load_settings',
    GET_ADAPTER_LIST: 'get_adapter_list',
    INSTALL_ADAPTER: 'install_adapter',
    UNINSTALL_ADAPTER: 'uninstall_adapter',
    EXECUTE_ADAPTER: 'execute_adapter'
} as const

/**
 * 文件类型常量
 */
export const FILE_TYPES = {
    IMAGE: 'image',
    AUDIO: 'audio',
    VIDEO: 'video',
    TEXT: 'text',
    ARCHIVE: 'archive',
    EXECUTABLE: 'executable',
    UNKNOWN: 'unknown'
} as const

/**
 * 支持的文件扩展名
 */
export const FILE_EXTENSIONS = {
    IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'],
    AUDIO: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'],
    VIDEO: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'mpg'],
    TEXT: ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'],
    ARCHIVE: ['zip', 'rar', 'tar', 'gz', '7z', 'bz2'],
    EXECUTABLE: ['exe', 'msi', 'dmg', 'deb', 'rpm', 'app']
} as const

/**
 * 平台常量
 */
export const PLATFORMS = {
    WINDOWS: 'win32',
    MACOS: 'darwin',
    LINUX: 'linux',
    ANDROID: 'android',
    IOS: 'ios'
} as const

/**
 * 架构常量
 */
export const ARCHITECTURES = {
    X86: 'x86',
    X64: 'x86_64',
    ARM: 'arm',
    ARM64: 'aarch64'
} as const

/**
 * 主题常量
 */
export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
} as const

/**
 * 错误代码常量
 */
export const ERROR_CODES = {
    // 通用错误
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    INVALID_PARAMETER: 'INVALID_PARAMETER',
    OPERATION_FAILED: 'OPERATION_FAILED',
    TIMEOUT: 'TIMEOUT',
    CANCELLED: 'CANCELLED',

    // Tauri 环境错误
    NOT_TAURI_ENV: 'NOT_TAURI_ENV',
    TAURI_NOT_READY: 'TAURI_NOT_READY',
    COMMAND_NOT_FOUND: 'COMMAND_NOT_FOUND',
    INVOKE_FAILED: 'INVOKE_FAILED',

    // 窗口错误
    WINDOW_NOT_FOUND: 'WINDOW_NOT_FOUND',
    WINDOW_CREATION_FAILED: 'WINDOW_CREATION_FAILED',
    WINDOW_OPERATION_FAILED: 'WINDOW_OPERATION_FAILED',

    // 文件错误
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
    FILE_OPERATION_FAILED: 'FILE_OPERATION_FAILED',
    DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',

    // 网络错误
    NETWORK_ERROR: 'NETWORK_ERROR',
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',

    // 应用特定错误
    CHARACTER_LOAD_FAILED: 'CHARACTER_LOAD_FAILED',
    SETTINGS_SAVE_FAILED: 'SETTINGS_SAVE_FAILED',
    ADAPTER_INSTALL_FAILED: 'ADAPTER_INSTALL_FAILED',
    LIVE2D_LOAD_FAILED: 'LIVE2D_LOAD_FAILED'
} as const

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
    // 窗口配置
    WINDOW: {
        WIDTH: 1200,
        HEIGHT: 800,
        MIN_WIDTH: 800,
        MIN_HEIGHT: 600,
        RESIZABLE: true,
        MAXIMIZABLE: true,
        MINIMIZABLE: true,
        CLOSABLE: true,
        DECORATIONS: true,
        TRANSPARENT: false,
        ALWAYS_ON_TOP: false,
        CENTER: true,
        FOCUS: true,
        VISIBLE: true
    },

    // 性能配置
    PERFORMANCE: {
        CACHE_SIZE: 100,
        CACHE_TTL: 5 * 60 * 1000, // 5分钟
        RETRY_COUNT: 3,
        RETRY_DELAY: 1000,
        TIMEOUT: 10000,
        MAX_HISTORY_SIZE: 100
    },

    // 应用配置
    APP: {
        AUTO_SAVE: true,
        AUTO_SAVE_INTERVAL: 30000, // 30秒
        CHECK_UPDATE: true,
        ENABLE_ANALYTICS: false,
        LOG_LEVEL: 'info'
    }
} as const

/**
 * 路径常量
 */
export const PATHS = {
    CONFIG: 'config',
    DATA: 'data',
    CACHE: 'cache',
    LOGS: 'logs',
    TEMP: 'temp',
    CHARACTERS: 'characters',
    ADAPTERS: 'adapters',
    ASSETS: 'assets',
    LIVE2D: 'live2d'
} as const

/**
 * MIME 类型常量
 */
export const MIME_TYPES = {
    JSON: 'application/json',
    TEXT: 'text/plain',
    HTML: 'text/html',
    CSS: 'text/css',
    JS: 'application/javascript',
    PNG: 'image/png',
    JPG: 'image/jpeg',
    GIF: 'image/gif',
    SVG: 'image/svg+xml',
    MP3: 'audio/mpeg',
    MP4: 'video/mp4',
    ZIP: 'application/zip'
} as const

/**
 * 状态常量
 */
export const STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error',
    PENDING: 'pending',
    CANCELLED: 'cancelled'
} as const

/**
 * 日志级别常量
 */
export const LOG_LEVELS = {
    TRACE: 'trace',
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
} as const

/**
 * 快捷键常量
 */
export const SHORTCUTS = {
    // 全局快捷键
    TOGGLE_MAIN_WINDOW: 'CmdOrCtrl+Shift+Z',
    SHOW_SETTINGS: 'CmdOrCtrl+,',
    QUIT_APP: 'CmdOrCtrl+Q',

    // 窗口快捷键
    CLOSE_WINDOW: 'CmdOrCtrl+W',
    MINIMIZE_WINDOW: 'CmdOrCtrl+M',
    MAXIMIZE_WINDOW: 'CmdOrCtrl+Shift+M',

    // 应用快捷键
    NEW_CHAT: 'CmdOrCtrl+N',
    SAVE_SETTINGS: 'CmdOrCtrl+S',
    RELOAD: 'CmdOrCtrl+R',
    TOGGLE_DEVTOOLS: 'F12'
} as const

/**
 * 动画持续时间常量
 */
export const ANIMATION_DURATIONS = {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
    VERY_SLOW: 1000
} as const

/**
 * 网络超时常量
 */
export const TIMEOUTS = {
    COMMAND: 10000,      // 10秒
    FILE_OPERATION: 30000, // 30秒
    NETWORK_REQUEST: 15000, // 15秒
    WINDOW_CREATION: 5000   // 5秒
} as const
