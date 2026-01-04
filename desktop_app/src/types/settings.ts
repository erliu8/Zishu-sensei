/**
 * 应用配置类型定义
 * 
 * 与 Rust 端 AppConfig 结构保持一致
 * 提供严格的类型约束和运行时验证
 */

/**
 * 窗口位置类型
 */
export type WindowPosition = [number, number]

/**
 * 角色ID类型 - 只允许字母、数字、下划线和连字符
 */
export type CharacterId = string & { readonly __brand: 'CharacterId' }

/**
 * 主题名称类型
 */
export type ThemeName = 'anime' | 'modern' | 'classic' | 'dark' | 'light' | 'custom'

/**
 * 缩放值类型 - 0.1 到 5.0 之间的数值
 */
export type ScaleValue = number & { readonly __brand: 'ScaleValue' }

/**
 * 窗口配置
 */
export interface WindowConfig {
    /** 窗口宽度 (200-4000) */
    readonly width: number
    /** 窗口高度 (200-4000) */
    readonly height: number
    /** 是否置顶 */
    readonly always_on_top: boolean
    /** 是否透明 */
    readonly transparent: boolean
    /** 是否显示装饰（标题栏等） */
    readonly decorations: boolean
    /** 是否可调整大小 */
    readonly resizable: boolean
    /** 窗口位置 [x, y] */
    readonly position: WindowPosition | null
}

/**
 * 角色配置
 */
export interface CharacterConfig {
    /** 当前角色ID */
    readonly current_character: CharacterId
    /** 角色缩放比例 (0.1-5.0) */
    readonly scale: ScaleValue
    /** 自动待机 */
    readonly auto_idle: boolean
    /** 启用交互 */
    readonly interaction_enabled: boolean
}

/**
 * 主题配置
 */
export interface ThemeConfig {
    /** 当前主题名称 */
    readonly current_theme: ThemeName
    /** 自定义CSS */
    readonly custom_css: string | null
}

/**
 * 系统配置
 */
export interface SystemConfig {
    /** 开机自启动 */
    readonly auto_start: boolean
    /** 最小化到托盘 */
    readonly minimize_to_tray: boolean
    /** 关闭到托盘 */
    readonly close_to_tray: boolean
    /** 显示通知 */
    readonly show_notifications: boolean
}

/**
 * 完整应用配置
 */
export interface AppConfig {
    readonly window: WindowConfig
    readonly character: CharacterConfig
    readonly theme: ThemeConfig
    readonly system: SystemConfig
}

/**
 * 窗口配置更新请求
 */
export interface UpdateWindowConfigRequest {
    width?: number
    height?: number
    always_on_top?: boolean
    transparent?: boolean
    decorations?: boolean
    resizable?: boolean
    position?: WindowPosition
}

/**
 * 角色配置更新请求
 */
export interface UpdateCharacterConfigRequest {
    current_character?: CharacterId
    scale?: ScaleValue
    auto_idle?: boolean
    interaction_enabled?: boolean
}

/**
 * 主题配置更新请求
 */
export interface UpdateThemeConfigRequest {
    current_theme?: ThemeName
    custom_css?: string
}

/**
 * 系统配置更新请求
 */
export interface UpdateSystemConfigRequest {
    auto_start?: boolean
    minimize_to_tray?: boolean
    close_to_tray?: boolean
    show_notifications?: boolean
}

/**
 * 部分配置更新请求
 */
export type PartialConfigUpdate = Partial<{
    window: Partial<WindowConfig>
    character: Partial<CharacterConfig>
    theme: Partial<ThemeConfig>
    system: Partial<SystemConfig>
}>

/**
 * 配置文件路径信息
 */
export interface ConfigPaths {
    /** 主配置文件路径 */
    config: string
    /** 备份配置文件路径 */
    backup: string
    /** 数据目录路径 */
    data_dir: string
}

/**
 * 配置导出选项
 */
export interface ConfigExportOptions {
    /** 导出文件路径 */
    filePath: string
    /** 是否格式化 JSON */
    pretty?: boolean
    /** 是否包含备份 */
    includeBackup?: boolean
}

/**
 * 配置导入选项
 */
export interface ConfigImportOptions {
    /** 导入文件路径 */
    filePath: string
    /** 导入前是否备份当前配置 */
    backupCurrent?: boolean
    /** 是否验证配置 */
    validate?: boolean
}


/**
 * 默认配置值
 */
export const DEFAULT_CONFIG: AppConfig = {
    window: {
        width: 400,
        height: 600,
        always_on_top: true,
        transparent: true,
        decorations: false,
        resizable: true,
        position: null
    },
    character: {
        current_character: 'hiyori' as CharacterId,
        scale: 1.0 as ScaleValue,
        auto_idle: true,
        interaction_enabled: true
    },
    theme: {
        current_theme: 'anime',
        custom_css: null
    },
    system: {
        auto_start: false,
        minimize_to_tray: true,
        close_to_tray: true,
        show_notifications: true
    }
}

/**
 * 配置验证规则
 */
export const CONFIG_VALIDATION_RULES = {
    window: {
        width: { min: 200, max: 4000 },
        height: { min: 200, max: 4000 }
    },
    character: {
        scale: { min: 0.1, max: 5.0 }
    }
} as const

/**
 * 配置验证错误类型
 */
export interface ConfigValidationError {
    /** 错误路径 */
    path: string
    /** 错误消息 */
    message: string
    /** 错误值 */
    value?: any
    /** 错误代码 */
    code?: string
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
    /** 是否有效 */
    valid: boolean
    /** 错误信息 */
    errors: ConfigValidationError[]
    /** 警告信息 */
    warnings: string[]
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
    /** 变更类型 */
    type: 'window' | 'character' | 'theme' | 'system' | 'full'
    /** 变更前的值 */
    before: any
    /** 变更后的值 */
    after: any
    /** 变更时间戳 */
    timestamp: number
}

/**
 * 配置历史记录
 */
export interface ConfigHistoryEntry {
    /** 记录ID */
    id: string
    /** 配置快照 */
    snapshot: AppConfig
    /** 变更描述 */
    description: string
    /** 创建时间 */
    timestamp: number
}

/**
 * 类型守卫函数
 */
export namespace TypeGuards {
    /**
     * 检查是否为有效的角色ID
     */
    export function isValidCharacterId(value: string): value is CharacterId {
        return /^[a-zA-Z0-9_-]+$/.test(value) && value.length >= 1 && value.length <= 50
    }

    /**
     * 检查是否为有效的缩放值
     */
    export function isValidScaleValue(value: number): value is ScaleValue {
        return value >= 0.1 && value <= 5.0 && Number.isFinite(value)
    }

    /**
     * 检查是否为有效的主题名称
     */
    export function isValidThemeName(value: string): value is ThemeName {
        return ['anime', 'modern', 'classic', 'dark', 'light', 'custom'].includes(value)
    }

    /**
     * 检查是否为有效的窗口位置
     */
    export function isValidWindowPosition(value: any): value is WindowPosition {
        return Array.isArray(value) && 
               value.length === 2 && 
               typeof value[0] === 'number' && 
               typeof value[1] === 'number' &&
               value[0] >= 0 && 
               value[1] >= 0 &&
               Number.isFinite(value[0]) && 
               Number.isFinite(value[1])
    }
}

/**
 * 类型转换函数
 */
export namespace TypeConverters {
    /**
     * 将字符串转换为角色ID
     */
    export function toCharacterId(value: string): CharacterId {
        if (!TypeGuards.isValidCharacterId(value)) {
            throw new Error(`Invalid character ID: ${value}`)
        }
        return value as CharacterId
    }

    /**
     * 将数字转换为缩放值
     */
    export function toScaleValue(value: number): ScaleValue {
        if (!TypeGuards.isValidScaleValue(value)) {
            throw new Error(`Invalid scale value: ${value}`)
        }
        return value as ScaleValue
    }

    /**
     * 将字符串转换为主题名称
     */
    export function toThemeName(value: string): ThemeName {
        if (!TypeGuards.isValidThemeName(value)) {
            throw new Error(`Invalid theme name: ${value}`)
        }
        return value as ThemeName
    }

    /**
     * 将数组转换为窗口位置
     */
    export function toWindowPosition(value: any): WindowPosition {
        if (!TypeGuards.isValidWindowPosition(value)) {
            throw new Error(`Invalid window position: ${JSON.stringify(value)}`)
        }
        return value as WindowPosition
    }
}

