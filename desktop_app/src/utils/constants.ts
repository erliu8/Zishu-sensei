/**
 * 应用常量定义
 * 
 * 集中管理应用中使用的所有常量值
 * 包括API配置、UI配置、系统配置、默认值等
 * 
 * @module utils/constants
 * @author zishu-sensei
 * @version 1.0.0
 */

// ================================
// API 相关常量
// ================================

/**
 * API 基础配置
 */
export const API_CONFIG = {
    /** API 基础 URL */
    BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
    /** API 版本 */
    VERSION: 'v1',
    /** API 前缀 */
    PREFIX: '/api',
    /** 请求超时时间（毫秒） */
    TIMEOUT: 30000,
    /** 最大重试次数 */
    MAX_RETRIES: 3,
    /** 重试延迟（毫秒） */
    RETRY_DELAY: 1000,
} as const

/**
 * API 端点
 */
export const API_ENDPOINTS = {
    // 聊天相关
    CHAT: '/api/chat',
    CHAT_HISTORY: '/api/chat/history',
    CHAT_CLEAR: '/api/chat/clear',
    
    // 角色相关
    CHARACTER_LIST: '/api/characters',
    CHARACTER_INFO: '/api/characters/:id',
    CHARACTER_SWITCH: '/api/characters/switch',
    
    // 适配器相关
    ADAPTER_LIST: '/api/adapters',
    ADAPTER_INSTALL: '/api/adapters/install',
    ADAPTER_UNINSTALL: '/api/adapters/uninstall',
    ADAPTER_EXECUTE: '/api/adapters/execute',
    ADAPTER_CONFIG: '/api/adapters/:id/config',
    ADAPTER_STATUS: '/api/adapters/:id/status',
    
    // 系统相关
    SYSTEM_INFO: '/api/system/info',
    SYSTEM_HEALTH: '/api/system/health',
    SYSTEM_METRICS: '/api/system/metrics',
    
    // 设置相关
    SETTINGS_GET: '/api/settings',
    SETTINGS_UPDATE: '/api/settings',
    SETTINGS_RESET: '/api/settings/reset',
    
    // 任务相关
    TASK_LIST: '/api/tasks',
    TASK_CREATE: '/api/tasks/create',
    TASK_STATUS: '/api/tasks/:id/status',
    TASK_CANCEL: '/api/tasks/:id/cancel',
    TASK_RETRY: '/api/tasks/:id/retry',
    
    // 工作流相关
    WORKFLOW_LIST: '/api/workflows',
    WORKFLOW_CREATE: '/api/workflows/create',
    WORKFLOW_EXECUTE: '/api/workflows/:id/execute',
    WORKFLOW_DELETE: '/api/workflows/:id',
} as const

/**
 * HTTP 状态码
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
} as const

// ================================
// 应用配置常量
// ================================

/**
 * 应用基础信息
 */
export const APP_INFO = {
    /** 应用名称 */
    NAME: 'Zishu Sensei',
    /** 应用版本 */
    VERSION: '1.0.0',
    /** 应用描述 */
    DESCRIPTION: '紫舒老师 - AI桌面宠物助手',
    /** 作者 */
    AUTHOR: 'Zishu Team',
    /** 许可证 */
    LICENSE: 'MIT',
    /** 主页 */
    HOMEPAGE: 'https://github.com/your-org/zishu-sensei',
    /** 仓库 */
    REPOSITORY: 'https://github.com/your-org/zishu-sensei',
    /** 问题追踪 */
    ISSUES: 'https://github.com/your-org/zishu-sensei/issues',
} as const

/**
 * 应用环境
 */
export const APP_ENV = {
    /** 是否为开发环境 */
    IS_DEV: import.meta.env.DEV,
    /** 是否为生产环境 */
    IS_PROD: import.meta.env.PROD,
    /** 模式 */
    MODE: import.meta.env.MODE,
} as const

// ================================
// 窗口配置常量
// ================================

/**
 * 窗口默认配置
 */
export const WINDOW_CONFIG = {
    /** 默认宽度 */
    DEFAULT_WIDTH: 400,
    /** 默认高度 */
    DEFAULT_HEIGHT: 600,
    /** 最小宽度 */
    MIN_WIDTH: 200,
    /** 最小高度 */
    MIN_HEIGHT: 200,
    /** 最大宽度 */
    MAX_WIDTH: 4000,
    /** 最大高度 */
    MAX_HEIGHT: 4000,
    /** 默认透明度 */
    DEFAULT_OPACITY: 1.0,
    /** 最小透明度 */
    MIN_OPACITY: 0.1,
    /** 最大透明度 */
    MAX_OPACITY: 1.0,
    /** 默认层级 */
    DEFAULT_Z_INDEX: 1000,
} as const

/**
 * 窗口模式
 */
export const WINDOW_MODES = {
    PET: 'pet',
    CHAT: 'chat',
    SETTINGS: 'settings',
    MINIMIZED: 'minimized',
    MAXIMIZED: 'maximized',
    FULLSCREEN: 'fullscreen',
} as const

// ================================
// 角色配置常量
// ================================

/**
 * 可用角色列表
 */
export const CHARACTERS = {
    SHIZUKU: {
        id: 'shizuku',
        name: '志鹤',
        description: '活泼可爱的桌面助手',
        modelPath: '/assets/live2d/shizuku/model.json',
        thumbnail: '/assets/images/characters/shizuku.png',
    },
    HIYORI: {
        id: 'hiyori',
        name: '日和',
        description: '温柔体贴的桌面伙伴',
        modelPath: '/assets/live2d/hiyori/model.json',
        thumbnail: '/assets/images/characters/hiyori.png',
    },
} as const

/**
 * 角色缩放范围
 */
export const CHARACTER_SCALE = {
    MIN: 0.1,
    MAX: 5.0,
    DEFAULT: 1.0,
    STEP: 0.1,
} as const

// ================================
// 主题配置常量
// ================================

/**
 * 可用主题
 */
export const THEMES = {
    ANIME: {
        id: 'anime',
        name: '动漫风格',
        description: '粉色渐变，可爱圆角设计',
        cssFile: '/styles/themes/anime.css',
    },
    DARK: {
        id: 'dark',
        name: '暗色主题',
        description: '深色背景，高对比度',
        cssFile: '/styles/themes/dark.css',
    },
    LIGHT: {
        id: 'light',
        name: '亮色主题',
        description: '清新明亮，简洁大方',
        cssFile: '/styles/themes/light.css',
    },
    CYBERPUNK: {
        id: 'cyberpunk',
        name: '赛博朋克',
        description: '科技感配色，流光效果',
        cssFile: '/styles/themes/cyberpunk.css',
    },
} as const

/**
 * 主题名称列表
 */
export const THEME_NAMES = Object.keys(THEMES) as Array<keyof typeof THEMES>

// ================================
// Live2D 配置常量
// ================================

/**
 * Live2D 配置
 */
export const LIVE2D_CONFIG = {
    /** 模型基础路径 */
    MODEL_BASE_PATH: '/assets/live2d',
    /** FPS 上限 */
    MAX_FPS: 60,
    /** 默认缩放 */
    DEFAULT_SCALE: 1.0,
    /** 默认位置 X */
    DEFAULT_POSITION_X: 0,
    /** 默认位置 Y */
    DEFAULT_POSITION_Y: 0,
    /** 是否启用抗锯齿 */
    ENABLE_ANTIALIASING: true,
    /** 是否启用透明度 */
    ENABLE_TRANSPARENCY: true,
} as const

/**
 * Live2D 动作类型
 */
export const LIVE2D_MOTIONS = {
    IDLE: 'idle',
    TAP_HEAD: 'tap_head',
    TAP_BODY: 'tap_body',
    SHAKE: 'shake',
    FLICK_HEAD: 'flick_head',
    PINCH_IN: 'pinch_in',
    PINCH_OUT: 'pinch_out',
} as const

/**
 * Live2D 表情类型
 */
export const LIVE2D_EXPRESSIONS = {
    NORMAL: 'normal',
    HAPPY: 'happy',
    ANGRY: 'angry',
    SAD: 'sad',
    SURPRISED: 'surprised',
    RELAXED: 'relaxed',
} as const

// ================================
// 存储相关常量
// ================================

/**
 * 本地存储键名
 */
export const STORAGE_KEYS = {
    /** 用户设置 */
    SETTINGS: 'zishu_settings',
    /** 聊天历史 */
    CHAT_HISTORY: 'zishu_chat_history',
    /** 窗口状态 */
    WINDOW_STATE: 'zishu_window_state',
    /** 主题配置 */
    THEME: 'zishu_theme',
    /** 角色配置 */
    CHARACTER: 'zishu_character',
    /** 适配器配置 */
    ADAPTERS: 'zishu_adapters',
    /** 用户偏好 */
    PREFERENCES: 'zishu_preferences',
    /** 缓存数据 */
    CACHE: 'zishu_cache',
    /** 最后同步时间 */
    LAST_SYNC: 'zishu_last_sync',
} as const

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
    /** 默认过期时间（毫秒） */
    DEFAULT_TTL: 1000 * 60 * 60, // 1小时
    /** 最大缓存大小（字节） */
    MAX_SIZE: 1024 * 1024 * 10, // 10MB
    /** 缓存版本 */
    VERSION: '1.0.0',
} as const

// ================================
// 性能监控常量
// ================================

/**
 * 性能监控配置
 */
export const PERFORMANCE_CONFIG = {
    /** 监控间隔（毫秒） */
    MONITORING_INTERVAL: 5000,
    /** 采样率（0-1） */
    SAMPLE_RATE: 1.0,
    /** 是否启用 */
    ENABLED: true,
    /** 内存警告阈值（MB） */
    MEMORY_WARNING_THRESHOLD: 512,
    /** CPU警告阈值（百分比） */
    CPU_WARNING_THRESHOLD: 80,
} as const

/**
 * 性能指标阈值
 */
export const PERFORMANCE_THRESHOLDS = {
    /** FPS 下限 */
    MIN_FPS: 30,
    /** 内存使用上限（MB） */
    MAX_MEMORY_MB: 1024,
    /** CPU使用上限（%） */
    MAX_CPU_PERCENT: 90,
    /** 响应时间上限（ms） */
    MAX_RESPONSE_TIME_MS: 1000,
} as const

// ================================
// 错误处理常量
// ================================

/**
 * 错误码
 */
export const ERROR_CODES = {
    // 通用错误
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    
    // 网络错误
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    
    // API 错误
    API_ERROR: 'API_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    
    // 验证错误
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_PARAMETER: 'MISSING_PARAMETER',
    
    // 权限错误
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    
    // 资源错误
    NOT_FOUND: 'NOT_FOUND',
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
    
    // 系统错误
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    FILE_ERROR: 'FILE_ERROR',
    CONFIG_ERROR: 'CONFIG_ERROR',
} as const

/**
 * 错误消息
 */
export const ERROR_MESSAGES: Record<string, string> = {
    [ERROR_CODES.UNKNOWN_ERROR]: '发生未知错误',
    [ERROR_CODES.NETWORK_ERROR]: '网络连接失败',
    [ERROR_CODES.TIMEOUT_ERROR]: '请求超时',
    [ERROR_CODES.API_ERROR]: 'API调用失败',
    [ERROR_CODES.VALIDATION_ERROR]: '数据验证失败',
    [ERROR_CODES.PERMISSION_DENIED]: '权限不足',
    [ERROR_CODES.NOT_FOUND]: '资源未找到',
    [ERROR_CODES.SYSTEM_ERROR]: '系统错误',
} as const

/**
 * 重试配置
 */
export const RETRY_CONFIG = {
    /** 默认最大重试次数 */
    DEFAULT_MAX_ATTEMPTS: 3,
    /** 基础延迟（毫秒） */
    BASE_DELAY: 1000,
    /** 最大延迟（毫秒） */
    MAX_DELAY: 10000,
    /** 退避倍数 */
    BACKOFF_MULTIPLIER: 2,
    /** 是否启用抖动 */
    ENABLE_JITTER: true,
} as const

// ================================
// 任务和工作流常量
// ================================

/**
 * 任务状态
 */
export const TASK_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
} as const

/**
 * 任务优先级
 */
export const TASK_PRIORITY = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent',
} as const

/**
 * 任务类型
 */
export const TASK_TYPES = {
    WORKFLOW: 'workflow',
    ADAPTER: 'adapter',
    SYSTEM: 'system',
    CUSTOM: 'custom',
} as const

/**
 * 任务配置
 */
export const TASK_CONFIG = {
    /** 默认超时时间（毫秒） */
    DEFAULT_TIMEOUT: 60000,
    /** 最大并发任务数 */
    MAX_CONCURRENT: 5,
    /** 任务队列最大长度 */
    MAX_QUEUE_SIZE: 100,
    /** 自动清理已完成任务的延迟（毫秒） */
    AUTO_CLEANUP_DELAY: 300000, // 5分钟
} as const

// ================================
// 适配器常量
// ================================

/**
 * 适配器类型
 */
export const ADAPTER_TYPES = {
    SOFT: 'soft',
    HARD: 'hard',
    INTELLIGENT: 'intelligent',
} as const

/**
 * 适配器状态
 */
export const ADAPTER_STATUS = {
    LOADED: 'loaded',
    UNLOADED: 'unloaded',
    LOADING: 'loading',
    UNLOADING: 'unloading',
    ERROR: 'error',
    UNKNOWN: 'unknown',
    MAINTENANCE: 'maintenance',
} as const

/**
 * 适配器分类
 */
export const ADAPTER_CATEGORIES = {
    OFFICE: 'office',
    DEVELOPMENT: 'development',
    MEDIA: 'media',
    SYSTEM: 'system',
    PRODUCTIVITY: 'productivity',
    ENTERTAINMENT: 'entertainment',
    EDUCATION: 'education',
    COMMUNICATION: 'communication',
} as const

// ================================
// UI 配置常量
// ================================

/**
 * 动画配置
 */
export const ANIMATION_CONFIG = {
    /** 默认动画时长（毫秒） */
    DEFAULT_DURATION: 300,
    /** 快速动画时长 */
    FAST_DURATION: 150,
    /** 慢速动画时长 */
    SLOW_DURATION: 500,
    /** 默认缓动函数 */
    DEFAULT_EASING: 'ease-in-out',
} as const

/**
 * 通知配置
 */
export const NOTIFICATION_CONFIG = {
    /** 默认显示时长（毫秒） */
    DEFAULT_DURATION: 3000,
    /** 成功通知时长 */
    SUCCESS_DURATION: 2000,
    /** 错误通知时长 */
    ERROR_DURATION: 5000,
    /** 最大同时显示数量 */
    MAX_VISIBLE: 3,
    /** 通知位置 */
    POSITION: 'top-right' as const,
} as const

/**
 * 消息类型
 */
export const MESSAGE_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
} as const

/**
 * 加载状态文本
 */
export const LOADING_MESSAGES = {
    DEFAULT: '加载中...',
    INITIALIZING: '初始化中...',
    CONNECTING: '连接中...',
    PROCESSING: '处理中...',
    SAVING: '保存中...',
    LOADING_MODEL: '加载模型中...',
    EXECUTING: '执行中...',
} as const

// ================================
// 聊天配置常量
// ================================

/**
 * 聊天配置
 */
export const CHAT_CONFIG = {
    /** 最大消息长度 */
    MAX_MESSAGE_LENGTH: 2000,
    /** 最大历史记录数 */
    MAX_HISTORY: 100,
    /** 默认流式输出 */
    DEFAULT_STREAMING: true,
    /** 输入框占位符 */
    INPUT_PLACEHOLDER: '和紫舒老师聊天吧...',
    /** 自动滚动延迟（毫秒） */
    AUTO_SCROLL_DELAY: 100,
} as const

/**
 * 消息角色
 */
export const MESSAGE_ROLES = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
} as const

// ================================
// 快捷键配置
// ================================

/**
 * 快捷键定义
 */
export const SHORTCUTS = {
    /** 打开设置 */
    OPEN_SETTINGS: 'Ctrl+,',
    /** 打开聊天 */
    OPEN_CHAT: 'Ctrl+Shift+C',
    /** 切换窗口 */
    TOGGLE_WINDOW: 'Ctrl+Shift+T',
    /** 退出应用 */
    QUIT_APP: 'Ctrl+Q',
    /** 开发者工具 */
    OPEN_DEVTOOLS: 'Ctrl+Shift+I',
    /** 重新加载 */
    RELOAD: 'Ctrl+R',
    /** 全屏 */
    TOGGLE_FULLSCREEN: 'F11',
    /** 最小化 */
    MINIMIZE: 'Ctrl+M',
    /** 新建对话 */
    NEW_CHAT: 'Ctrl+N',
    /** 清空历史 */
    CLEAR_HISTORY: 'Ctrl+Shift+Delete',
} as const

// ================================
// 正则表达式常量
// ================================

/**
 * 常用正则表达式
 */
export const REGEX_PATTERNS = {
    /** 邮箱 */
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    /** URL */
    URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    /** 版本号 */
    VERSION: /^\d+\.\d+\.\d+$/,
    /** 十六进制颜色 */
    HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    /** IPv4 */
    IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    /** 端口号 */
    PORT: /^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/,
    /** 路径 */
    PATH: /^[a-zA-Z0-9_\-\/\.]+$/,
    /** 文件名 */
    FILENAME: /^[a-zA-Z0-9_\-\.]+$/,
} as const

// ================================
// 时间格式化常量
// ================================

/**
 * 时间格式
 */
export const TIME_FORMATS = {
    /** 完整日期时间 */
    FULL: 'YYYY-MM-DD HH:mm:ss',
    /** 日期 */
    DATE: 'YYYY-MM-DD',
    /** 时间 */
    TIME: 'HH:mm:ss',
    /** 短时间 */
    SHORT_TIME: 'HH:mm',
    /** ISO格式 */
    ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    /** 友好格式 */
    FRIENDLY: 'MM月DD日 HH:mm',
} as const

/**
 * 时间单位（毫秒）
 */
export const TIME_UNITS = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
    YEAR: 365 * 24 * 60 * 60 * 1000,
} as const

// ================================
// 文件相关常量
// ================================

/**
 * 文件大小单位
 */
export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * 文件类型
 */
export const FILE_TYPES = {
    IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
    VIDEO: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
    AUDIO: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'],
    DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    ARCHIVE: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
    CODE: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs'],
} as const

/**
 * MIME 类型
 */
export const MIME_TYPES = {
    JSON: 'application/json',
    XML: 'application/xml',
    PDF: 'application/pdf',
    ZIP: 'application/zip',
    TEXT: 'text/plain',
    HTML: 'text/html',
    CSS: 'text/css',
    JAVASCRIPT: 'text/javascript',
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    GIF: 'image/gif',
    SVG: 'image/svg+xml',
    MP4: 'video/mp4',
    MP3: 'audio/mpeg',
} as const

// ================================
// 调试和日志常量
// ================================

/**
 * 日志级别
 */
export const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'fatal',
} as const

/**
 * 日志配置
 */
export const LOG_CONFIG = {
    /** 是否启用日志 */
    ENABLED: true,
    /** 默认日志级别 */
    DEFAULT_LEVEL: APP_ENV.IS_DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO,
    /** 是否在控制台输出 */
    CONSOLE_OUTPUT: true,
    /** 是否输出到文件 */
    FILE_OUTPUT: false,
    /** 最大日志文件大小（MB） */
    MAX_FILE_SIZE: 10,
    /** 保留的日志文件数量 */
    MAX_FILES: 5,
} as const

// ================================
// 功能开关
// ================================

/**
 * 功能标志
 */
export const FEATURE_FLAGS = {
    /** 启用语音输入 */
    ENABLE_VOICE_INPUT: false,
    /** 启用实验性功能 */
    ENABLE_EXPERIMENTAL: APP_ENV.IS_DEV,
    /** 启用性能监控 */
    ENABLE_PERFORMANCE_MONITORING: true,
    /** 启用错误上报 */
    ENABLE_ERROR_REPORTING: APP_ENV.IS_PROD,
    /** 启用分析统计 */
    ENABLE_ANALYTICS: false,
    /** 启用自动更新 */
    ENABLE_AUTO_UPDATE: APP_ENV.IS_PROD,
    /** 启用开发者工具 */
    ENABLE_DEVTOOLS: APP_ENV.IS_DEV,
} as const

// ================================
// 导出所有常量
// ================================

export default {
    API_CONFIG,
    API_ENDPOINTS,
    HTTP_STATUS,
    APP_INFO,
    APP_ENV,
    WINDOW_CONFIG,
    WINDOW_MODES,
    CHARACTERS,
    CHARACTER_SCALE,
    THEMES,
    THEME_NAMES,
    LIVE2D_CONFIG,
    LIVE2D_MOTIONS,
    LIVE2D_EXPRESSIONS,
    STORAGE_KEYS,
    CACHE_CONFIG,
    PERFORMANCE_CONFIG,
    PERFORMANCE_THRESHOLDS,
    ERROR_CODES,
    ERROR_MESSAGES,
    RETRY_CONFIG,
    TASK_STATUS,
    TASK_PRIORITY,
    TASK_TYPES,
    TASK_CONFIG,
    ADAPTER_TYPES,
    ADAPTER_STATUS,
    ADAPTER_CATEGORIES,
    ANIMATION_CONFIG,
    NOTIFICATION_CONFIG,
    MESSAGE_TYPES,
    LOADING_MESSAGES,
    CHAT_CONFIG,
    MESSAGE_ROLES,
    SHORTCUTS,
    REGEX_PATTERNS,
    TIME_FORMATS,
    TIME_UNITS,
    FILE_SIZE_UNITS,
    FILE_TYPES,
    MIME_TYPES,
    LOG_LEVELS,
    LOG_CONFIG,
    FEATURE_FLAGS,
} as const

