/**
 * 配置错误处理和类型安全工具
 * 
 * 提供配置相关的错误处理、类型转换和安全性检查
 */

import { 
    AppConfig, 
    ConfigValidationResult,
    ConfigValidationError,
    CharacterId,
    ThemeName,
    ScaleValue,
    WindowPosition,
    TypeGuards,
    TypeConverters,
    DEFAULT_CONFIG
} from '../types/settings'

/**
 * 配置错误类型
 */
export enum ConfigErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    TYPE_ERROR = 'TYPE_ERROR',
    RANGE_ERROR = 'RANGE_ERROR',
    FORMAT_ERROR = 'FORMAT_ERROR',
    REQUIRED_ERROR = 'REQUIRED_ERROR',
    BUSINESS_RULE_ERROR = 'BUSINESS_RULE_ERROR',
    IO_ERROR = 'IO_ERROR',
    PARSE_ERROR = 'PARSE_ERROR'
}

/**
 * 配置错误类
 */
export class ConfigError extends Error {
    public readonly type: ConfigErrorType
    public readonly path: string
    public readonly value?: any
    public readonly code?: string

    constructor(
        message: string,
        type: ConfigErrorType,
        path: string = '',
        value?: any,
        code?: string
    ) {
        super(message)
        this.name = 'ConfigError'
        this.type = type
        this.path = path
        this.value = value
        this.code = code
    }

    /**
     * 转换为验证错误
     */
    toValidationError(): ConfigValidationError {
        return {
            path: this.path,
            message: this.message,
            value: this.value,
            code: this.code
        }
    }
}

/**
 * 配置结果类型
 */
export type ConfigResult<T> = 
    | { success: true; data: T }
    | { success: false; error: ConfigError }

/**
 * 配置安全工具类
 */
export class ConfigSafetyUtils {
    /**
     * 安全地获取嵌套属性
     */
    static safeGet<T>(obj: any, path: string, defaultValue: T): T {
        try {
            const keys = path.split('.')
            let current = obj
            
            for (const key of keys) {
                if (current === null || current === undefined || typeof current !== 'object') {
                    return defaultValue
                }
                current = current[key]
            }
            
            return current !== undefined ? current : defaultValue
        } catch {
            return defaultValue
        }
    }

    /**
     * 安全地设置嵌套属性
     */
    static safeSet(obj: any, path: string, value: any): boolean {
        try {
            const keys = path.split('.')
            let current = obj
            
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i]
                if (!(key in current) || typeof current[key] !== 'object') {
                    current[key] = {}
                }
                current = current[key]
            }
            
            current[keys[keys.length - 1]] = value
            return true
        } catch {
            return false
        }
    }

    /**
     * 深度克隆对象
     */
    static deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') {
            return obj
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime()) as T
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item)) as T
        }
        
        if (typeof obj === 'object') {
            const cloned = {} as T
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key])
                }
            }
            return cloned
        }
        
        return obj
    }

    /**
     * 深度合并对象
     */
    static deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
        const result = { ...target }
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                const sourceValue = source[key]
                const targetValue = result[key]
                
                if (this.isObject(sourceValue) && this.isObject(targetValue)) {
                    result[key] = this.deepMerge(targetValue, sourceValue as any)
                } else if (sourceValue !== undefined) {
                    result[key] = sourceValue as any
                }
            }
        }
        
        return result
    }

    /**
     * 检查是否为对象
     */
    private static isObject(value: any): value is Record<string, any> {
        return value !== null && typeof value === 'object' && !Array.isArray(value)
    }
}

/**
 * 配置类型转换工具
 */
export class ConfigTypeConverter {
    /**
     * 安全地转换为角色ID
     */
    static toCharacterId(value: any): ConfigResult<CharacterId> {
        try {
            if (typeof value !== 'string') {
                throw new ConfigError(
                    'Character ID must be a string',
                    ConfigErrorType.TYPE_ERROR,
                    'character.current_character',
                    value
                )
            }
            
            const characterId = TypeConverters.toCharacterId(value)
            return { success: true, data: characterId }
        } catch (error) {
            return {
                success: false,
                error: error instanceof ConfigError ? error : new ConfigError(
                    'Invalid character ID',
                    ConfigErrorType.FORMAT_ERROR,
                    'character.current_character',
                    value
                )
            }
        }
    }

    /**
     * 安全地转换为缩放值
     */
    static toScaleValue(value: any): ConfigResult<ScaleValue> {
        try {
            const numValue = Number(value)
            if (isNaN(numValue)) {
                throw new ConfigError(
                    'Scale value must be a number',
                    ConfigErrorType.TYPE_ERROR,
                    'character.scale',
                    value
                )
            }
            
            const scaleValue = TypeConverters.toScaleValue(numValue)
            return { success: true, data: scaleValue }
        } catch (error) {
            return {
                success: false,
                error: error instanceof ConfigError ? error : new ConfigError(
                    'Invalid scale value',
                    ConfigErrorType.RANGE_ERROR,
                    'character.scale',
                    value
                )
            }
        }
    }

    /**
     * 安全地转换为主题名称
     */
    static toThemeName(value: any): ConfigResult<ThemeName> {
        try {
            if (typeof value !== 'string') {
                throw new ConfigError(
                    'Theme name must be a string',
                    ConfigErrorType.TYPE_ERROR,
                    'theme.current_theme',
                    value
                )
            }
            
            const themeName = TypeConverters.toThemeName(value)
            return { success: true, data: themeName }
        } catch (error) {
            return {
                success: false,
                error: error instanceof ConfigError ? error : new ConfigError(
                    'Invalid theme name',
                    ConfigErrorType.FORMAT_ERROR,
                    'theme.current_theme',
                    value
                )
            }
        }
    }

    /**
     * 安全地转换为窗口位置
     */
    static toWindowPosition(value: any): ConfigResult<WindowPosition | null> {
        try {
            if (value === null || value === undefined) {
                return { success: true, data: null }
            }
            
            const position = TypeConverters.toWindowPosition(value)
            return { success: true, data: position }
        } catch (error) {
            return {
                success: false,
                error: error instanceof ConfigError ? error : new ConfigError(
                    'Invalid window position',
                    ConfigErrorType.FORMAT_ERROR,
                    'window.position',
                    value
                )
            }
        }
    }

    /**
     * 安全地转换为布尔值
     */
    static toBoolean(value: any, path: string): ConfigResult<boolean> {
        if (typeof value === 'boolean') {
            return { success: true, data: value }
        }
        
        if (typeof value === 'string') {
            const lowerValue = value.toLowerCase()
            if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
                return { success: true, data: true }
            }
            if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
                return { success: true, data: false }
            }
        }
        
        if (typeof value === 'number') {
            return { success: true, data: value !== 0 }
        }
        
        return {
            success: false,
            error: new ConfigError(
                'Value must be a boolean',
                ConfigErrorType.TYPE_ERROR,
                path,
                value
            )
        }
    }

    /**
     * 安全地转换为整数
     */
    static toInteger(value: any, path: string, min?: number, max?: number): ConfigResult<number> {
        const numValue = Number(value)
        
        if (isNaN(numValue) || !Number.isInteger(numValue)) {
            return {
                success: false,
                error: new ConfigError(
                    'Value must be an integer',
                    ConfigErrorType.TYPE_ERROR,
                    path,
                    value
                )
            }
        }
        
        if (min !== undefined && numValue < min) {
            return {
                success: false,
                error: new ConfigError(
                    `Value must be at least ${min}`,
                    ConfigErrorType.RANGE_ERROR,
                    path,
                    value
                )
            }
        }
        
        if (max !== undefined && numValue > max) {
            return {
                success: false,
                error: new ConfigError(
                    `Value must be at most ${max}`,
                    ConfigErrorType.RANGE_ERROR,
                    path,
                    value
                )
            }
        }
        
        return { success: true, data: numValue }
    }
}

/**
 * 配置修复工具
 */
export class ConfigFixer {
    /**
     * 修复配置中的常见问题
     */
    static fixConfig(config: any): AppConfig {
        const fixed = ConfigSafetyUtils.deepClone(DEFAULT_CONFIG) as any
        
        // 修复窗口配置
        if (config.window) {
            fixed.window = {
                width: this.fixInteger(config.window.width, 400, 200, 4000),
                height: this.fixInteger(config.window.height, 600, 200, 4000),
                always_on_top: this.fixBoolean(config.window.always_on_top, true),
                transparent: this.fixBoolean(config.window.transparent, true),
                decorations: this.fixBoolean(config.window.decorations, false),
                resizable: this.fixBoolean(config.window.resizable, true),
                position: this.fixWindowPosition(config.window.position)
            }
        }
        
        // 修复角色配置
        if (config.character) {
            fixed.character = {
                current_character: this.fixCharacterId(config.character.current_character),
                scale: this.fixScaleValue(config.character.scale),
                auto_idle: this.fixBoolean(config.character.auto_idle, true),
                interaction_enabled: this.fixBoolean(config.character.interaction_enabled, true)
            }
        }
        
        // 修复主题配置
        if (config.theme) {
            fixed.theme = {
                current_theme: this.fixThemeName(config.theme.current_theme),
                custom_css: this.fixCustomCss(config.theme.custom_css)
            }
        }
        
        // 修复系统配置
        if (config.system) {
            fixed.system = {
                auto_start: this.fixBoolean(config.system.auto_start, false),
                minimize_to_tray: this.fixBoolean(config.system.minimize_to_tray, true),
                close_to_tray: this.fixBoolean(config.system.close_to_tray, true),
                show_notifications: this.fixBoolean(config.system.show_notifications, true)
            }
        }
        
        return fixed as AppConfig
    }

    /**
     * 修复整数值
     */
    private static fixInteger(value: any, defaultValue: number, min: number, max: number): number {
        const num = Number(value)
        if (isNaN(num) || !Number.isInteger(num)) {
            return defaultValue
        }
        return Math.max(min, Math.min(max, num))
    }

    /**
     * 修复布尔值
     */
    private static fixBoolean(value: any, defaultValue: boolean): boolean {
        if (typeof value === 'boolean') {
            return value
        }
        if (typeof value === 'string') {
            const lower = value.toLowerCase()
            if (lower === 'true' || lower === '1' || lower === 'yes') {
                return true
            }
            if (lower === 'false' || lower === '0' || lower === 'no') {
                return false
            }
        }
        if (typeof value === 'number') {
            return value !== 0
        }
        return defaultValue
    }

    /**
     * 修复角色ID
     */
    private static fixCharacterId(value: any): CharacterId {
        if (typeof value === 'string' && TypeGuards.isValidCharacterId(value)) {
            return value as CharacterId
        }
        return DEFAULT_CONFIG.character.current_character
    }

    /**
     * 修复缩放值
     */
    private static fixScaleValue(value: any): ScaleValue {
        const num = Number(value)
        if (TypeGuards.isValidScaleValue(num)) {
            return num as ScaleValue
        }
        return DEFAULT_CONFIG.character.scale
    }

    /**
     * 修复主题名称
     */
    private static fixThemeName(value: any): ThemeName {
        if (typeof value === 'string' && TypeGuards.isValidThemeName(value)) {
            return value as ThemeName
        }
        return DEFAULT_CONFIG.theme.current_theme
    }

    /**
     * 修复自定义CSS
     */
    private static fixCustomCss(value: any): string | null {
        if (typeof value === 'string' && value.length <= 10000) {
            return value
        }
        return null
    }

    /**
     * 修复窗口位置
     */
    private static fixWindowPosition(value: any): WindowPosition | null {
        if (value === null || value === undefined) {
            return null
        }
        if (TypeGuards.isValidWindowPosition(value)) {
            return value as WindowPosition
        }
        return null
    }
}

/**
 * 配置错误处理工具
 */
export namespace ConfigErrorHandler {
    /**
     * 处理配置验证错误
     */
    export function handleValidationError(result: ConfigValidationResult): string {
        if (result.valid) {
            return 'Configuration is valid'
        }
        
        const errorMessages = result.errors.map((error: ConfigValidationError) => {
            const path = error.path ? `${error.path}: ` : ''
            return `${path}${error.message}`
        }).join('\n')
        
        const warningMessages = result.warnings.length > 0 
            ? '\n\nWarnings:\n' + result.warnings.join('\n')
            : ''
        
        return `Configuration validation failed:\n${errorMessages}${warningMessages}`
    }

    /**
     * 创建用户友好的错误消息
     */
    export function createUserFriendlyMessage(error: ConfigError): string {
        const pathPrefix = error.path ? `在 ${error.path} 处：` : ''
        
        switch (error.type) {
            case ConfigErrorType.VALIDATION_ERROR:
                return `${pathPrefix}配置验证失败：${error.message}`
            case ConfigErrorType.TYPE_ERROR:
                return `${pathPrefix}类型错误：${error.message}`
            case ConfigErrorType.RANGE_ERROR:
                return `${pathPrefix}数值超出范围：${error.message}`
            case ConfigErrorType.FORMAT_ERROR:
                return `${pathPrefix}格式错误：${error.message}`
            case ConfigErrorType.REQUIRED_ERROR:
                return `${pathPrefix}缺少必需字段：${error.message}`
            case ConfigErrorType.BUSINESS_RULE_ERROR:
                return `${pathPrefix}业务规则错误：${error.message}`
            case ConfigErrorType.IO_ERROR:
                return `${pathPrefix}文件操作错误：${error.message}`
            case ConfigErrorType.PARSE_ERROR:
                return `${pathPrefix}解析错误：${error.message}`
            default:
                return `${pathPrefix}未知错误：${error.message}`
        }
    }

    /**
     * 记录配置错误
     */
    export function logConfigError(error: ConfigError, context?: string): void {
        console.error('ConfigError:', {
            type: error.type,
            path: error.path,
            message: error.message,
            value: error.value,
            code: error.code,
            stack: error.stack,
            context,
            userMessage: createUserFriendlyMessage(error)
        })
        
        // 这里可以添加更多的日志记录逻辑，比如发送到错误监控服务
    }
}

/**
 * 默认导出
 */
export default ConfigSafetyUtils
