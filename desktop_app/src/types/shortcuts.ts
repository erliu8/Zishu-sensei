/**
 * 键盘快捷键类型定义
 * 
 * 提供完整的快捷键系统类型约束和配置
 */

/**
 * 修饰键类型
 */
export interface ModifierKeys {
    /** Ctrl 键（在 Mac 上是 Cmd） */
    ctrl?: boolean
    /** Alt 键（在 Mac 上是 Option） */
    alt?: boolean
    /** Shift 键 */
    shift?: boolean
    /** Meta/Win 键（Windows 键或 Mac Command 键） */
    meta?: boolean
}

/**
 * 快捷键作用域
 */
export type ShortcutScope = 'global' | 'local' | 'window'

/**
 * 快捷键分类
 */
export type ShortcutCategory = 
    | 'window'      // 窗口管理
    | 'chat'        // 聊天相关
    | 'character'   // 角色相关
    | 'settings'    // 设置相关
    | 'navigation'  // 导航相关
    | 'system'      // 系统相关
    | 'custom'      // 自定义

/**
 * 快捷键配置
 */
export interface ShortcutConfig {
    /** 快捷键ID（唯一标识） */
    id: string
    /** 快捷键名称 */
    name: string
    /** 快捷键描述 */
    description: string
    /** 主键 */
    key: string
    /** 修饰键 */
    modifiers: ModifierKeys
    /** 作用域 */
    scope: ShortcutScope
    /** 分类 */
    category: ShortcutCategory
    /** 是否启用 */
    enabled: boolean
    /** 是否阻止默认行为 */
    preventDefault?: boolean
    /** 是否可自定义 */
    customizable?: boolean
    /** 回调函数 */
    callback?: (event?: KeyboardEvent) => void | Promise<void>
}

/**
 * 快捷键组
 */
export interface ShortcutGroup {
    /** 组ID */
    id: string
    /** 组名称 */
    name: string
    /** 组描述 */
    description?: string
    /** 分类 */
    category: ShortcutCategory
    /** 快捷键列表 */
    shortcuts: ShortcutConfig[]
}

/**
 * 快捷键冲突信息
 */
export interface ShortcutConflict {
    /** 冲突的快捷键ID列表 */
    conflictingIds: string[]
    /** 快捷键字符串 */
    shortcutString: string
    /** 冲突类型 */
    type: 'duplicate' | 'system' | 'reserved'
    /** 冲突描述 */
    message: string
}

/**
 * 快捷键验证结果
 */
export interface ShortcutValidationResult {
    /** 是否有效 */
    valid: boolean
    /** 错误信息 */
    error?: string
    /** 冲突信息 */
    conflicts?: ShortcutConflict[]
    /** 警告信息 */
    warnings?: string[]
}

/**
 * 平台类型
 */
export type Platform = 'windows' | 'macos' | 'linux' | 'unknown'

/**
 * 平台特定快捷键配置
 */
export interface PlatformShortcutConfig {
    /** Windows 快捷键 */
    windows?: Partial<ShortcutConfig>
    /** macOS 快捷键 */
    macos?: Partial<ShortcutConfig>
    /** Linux 快捷键 */
    linux?: Partial<ShortcutConfig>
    /** 通用配置（作为后备） */
    default: ShortcutConfig
}

/**
 * 快捷键事件
 */
export interface ShortcutEvent {
    /** 事件类型 */
    type: 'registered' | 'unregistered' | 'triggered' | 'conflict' | 'error'
    /** 快捷键ID */
    shortcutId: string
    /** 快捷键配置 */
    config?: ShortcutConfig
    /** 事件数据 */
    data?: any
    /** 时间戳 */
    timestamp: number
}

/**
 * 快捷键存储配置
 */
export interface ShortcutsStorageData {
    /** 版本号 */
    version: string
    /** 自定义快捷键 */
    customShortcuts: Record<string, Partial<ShortcutConfig>>
    /** 禁用的快捷键ID列表 */
    disabledShortcuts: string[]
    /** 最后更新时间 */
    lastUpdated: number
}

/**
 * 快捷键动作类型
 */
export type ShortcutAction =
    // 窗口管理
    | 'window.minimize'
    | 'window.close'
    | 'window.maximize'
    | 'window.toggleAlwaysOnTop'
    | 'window.focus'
    | 'window.hide'
    | 'window.show'
    // 视图切换
    | 'view.pet'
    | 'view.chat'
    | 'view.settings'
    | 'view.adapters'
    // 聊天相关
    | 'chat.focusInput'
    | 'chat.send'
    | 'chat.newConversation'
    | 'chat.clearHistory'
    | 'chat.search'
    // 角色相关
    | 'character.switch'
    | 'character.interact'
    | 'character.resetPosition'
    // 系统相关
    | 'system.quit'
    | 'system.reload'
    | 'system.toggleDevTools'
    | 'system.openSettings'
    // 导航相关
    | 'nav.back'
    | 'nav.forward'
    | 'nav.home'
    // 自定义
    | 'custom'

/**
 * 快捷键字符串格式
 * 例如: "Ctrl+Shift+A", "Cmd+K", "Alt+Tab"
 */
export type ShortcutString = string

/**
 * 快捷键管理器配置
 */
export interface ShortcutManagerConfig {
    /** 是否启用快捷键 */
    enabled: boolean
    /** 是否允许自定义快捷键 */
    allowCustomization: boolean
    /** 是否记录快捷键日志 */
    logging: boolean
    /** 快捷键事件监听器 */
    eventListeners?: Array<(event: ShortcutEvent) => void>
}

/**
 * 系统保留快捷键（不允许自定义）
 */
export const RESERVED_SHORTCUTS: ShortcutString[] = [
    'Ctrl+C',
    'Ctrl+V',
    'Ctrl+X',
    'Ctrl+A',
    'Ctrl+Z',
    'Ctrl+Y',
    'Alt+F4',
    'Cmd+Q',
    'Cmd+W',
    'Cmd+H',
    'Cmd+M',
]

/**
 * 快捷键优先级
 */
export enum ShortcutPriority {
    /** 系统级（最高优先级） */
    SYSTEM = 0,
    /** 全局级 */
    GLOBAL = 1,
    /** 应用级 */
    APPLICATION = 2,
    /** 窗口级 */
    WINDOW = 3,
    /** 组件级（最低优先级） */
    COMPONENT = 4,
}

/**
 * 快捷键绑定信息
 */
export interface ShortcutBinding {
    /** 快捷键配置 */
    config: ShortcutConfig
    /** 优先级 */
    priority: ShortcutPriority
    /** 注册时间 */
    registeredAt: number
    /** 最后触发时间 */
    lastTriggered?: number
    /** 触发次数 */
    triggerCount: number
}

/**
 * 工具函数类型定义
 */
export namespace ShortcutUtils {
    /**
     * 将快捷键配置转换为字符串
     */
    export type ToStringFn = (config: Pick<ShortcutConfig, 'key' | 'modifiers'>) => string

    /**
     * 解析快捷键字符串
     */
    export type ParseStringFn = (shortcutString: string) => { key: string; modifiers: ModifierKeys }

    /**
     * 检查快捷键是否冲突
     */
    export type CheckConflictFn = (
        shortcut1: ShortcutConfig,
        shortcut2: ShortcutConfig
    ) => boolean

    /**
     * 验证快捷键配置
     */
    export type ValidateConfigFn = (config: ShortcutConfig) => ShortcutValidationResult

    /**
     * 标准化快捷键配置
     */
    export type NormalizeConfigFn = (config: Partial<ShortcutConfig>) => ShortcutConfig

    /**
     * 获取平台特定的修饰键名称
     */
    export type GetPlatformModifierNameFn = (modifier: keyof ModifierKeys) => string
}

/**
 * 快捷键注册表
 */
export interface ShortcutRegistry {
    /** 所有注册的快捷键 */
    shortcuts: Map<string, ShortcutBinding>
    /** 按分类分组的快捷键 */
    byCategory: Map<ShortcutCategory, ShortcutConfig[]>
    /** 按作用域分组的快捷键 */
    byScope: Map<ShortcutScope, ShortcutConfig[]>
    /** 快捷键字符串到ID的映射 */
    stringToId: Map<ShortcutString, string>
}

/**
 * 快捷键统计信息
 */
export interface ShortcutStatistics {
    /** 总快捷键数 */
    total: number
    /** 已启用的快捷键数 */
    enabled: number
    /** 全局快捷键数 */
    global: number
    /** 本地快捷键数 */
    local: number
    /** 自定义快捷键数 */
    custom: number
    /** 按分类统计 */
    byCategory: Record<ShortcutCategory, number>
    /** 最常用的快捷键 */
    mostUsed: Array<{ id: string; count: number }>
}

/**
 * 默认快捷键配置
 */
export const DEFAULT_SHORTCUTS_CONFIG: ShortcutManagerConfig = {
    enabled: true,
    allowCustomization: true,
    logging: false,
    eventListeners: [],
}

