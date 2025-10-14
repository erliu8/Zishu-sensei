/**
 * 配置验证工具函数
 * 
 * 提供运行时配置验证、类型检查和错误处理功能
 */

import Ajv, { ValidateFunction } from 'ajv'
// import addFormats from 'ajv-formats' // 可选：如果需要格式验证
import { 
    AppConfig, 
    ConfigValidationResult,
    ConfigValidationError,
    TypeGuards,
    CONFIG_VALIDATION_RULES
} from '../types/settings'

// 创建 AJV 实例
const ajv = new Ajv({ 
    allErrors: true, 
    verbose: true,
    removeAdditional: true
})
// addFormats(ajv) // 可选：添加格式验证

/**
 * 配置验证器类
 */
export class ConfigValidator {
    private static instance: ConfigValidator
    private validateFunction: ValidateFunction | null = null
    private schema: any

    private constructor() {
        // 这里需要从 JSON Schema 文件加载模式
        // 由于 TypeScript 限制，我们使用内联模式
        this.schema = this.createInlineSchema()
        this.validateFunction = ajv.compile(this.schema)
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): ConfigValidator {
        if (!ConfigValidator.instance) {
            ConfigValidator.instance = new ConfigValidator()
        }
        return ConfigValidator.instance
    }

    /**
     * 验证完整配置
     */
    public validateConfig(config: any): ConfigValidationResult {
        const errors: ConfigValidationError[] = []
        const warnings: string[] = []

        if (!this.validateFunction) {
            errors.push({
                path: '',
                message: 'Validator not initialized',
                code: 'VALIDATOR_NOT_INITIALIZED'
            })
            return { valid: false, errors, warnings }
        }

        const valid = this.validateFunction(config)
        
        if (!valid && this.validateFunction.errors) {
            for (const error of this.validateFunction.errors) {
                errors.push({
                    path: (error as any).instancePath || error.schemaPath || '',
                    message: error.message || 'Validation error',
                    value: (error as any).data,
                    code: error.keyword
                })
            }
        }

        // 额外的业务逻辑验证
        const businessValidation = this.validateBusinessRules(config)
        errors.push(...businessValidation.errors)
        warnings.push(...businessValidation.warnings)

        return {
            valid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * 验证窗口配置
     */
    public validateWindowConfig(config: any): ConfigValidationResult {
        const errors: ConfigValidationError[] = []
        const warnings: string[] = []

        if (!config || typeof config !== 'object') {
            errors.push({
                path: 'window',
                message: 'Window config must be an object',
                code: 'INVALID_TYPE'
            })
            return { valid: false, errors, warnings }
        }

        // 验证宽度
        if (typeof config.width !== 'number' || 
            config.width < CONFIG_VALIDATION_RULES.window.width.min || 
            config.width > CONFIG_VALIDATION_RULES.window.width.max) {
            errors.push({
                path: 'window.width',
                message: `Width must be between ${CONFIG_VALIDATION_RULES.window.width.min} and ${CONFIG_VALIDATION_RULES.window.width.max}`,
                value: config.width,
                code: 'INVALID_RANGE'
            })
        }

        // 验证高度
        if (typeof config.height !== 'number' || 
            config.height < CONFIG_VALIDATION_RULES.window.height.min || 
            config.height > CONFIG_VALIDATION_RULES.window.height.max) {
            errors.push({
                path: 'window.height',
                message: `Height must be between ${CONFIG_VALIDATION_RULES.window.height.min} and ${CONFIG_VALIDATION_RULES.window.height.max}`,
                value: config.height,
                code: 'INVALID_RANGE'
            })
        }

        // 验证位置
        if (config.position !== null && !TypeGuards.isValidWindowPosition(config.position)) {
            errors.push({
                path: 'window.position',
                message: 'Position must be null or a valid [x, y] array',
                value: config.position,
                code: 'INVALID_POSITION'
            })
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * 验证角色配置
     */
    public validateCharacterConfig(config: any): ConfigValidationResult {
        const errors: ConfigValidationError[] = []
        const warnings: string[] = []

        if (!config || typeof config !== 'object') {
            errors.push({
                path: 'character',
                message: 'Character config must be an object',
                code: 'INVALID_TYPE'
            })
            return { valid: false, errors, warnings }
        }

        // 验证角色ID
        if (!TypeGuards.isValidCharacterId(config.current_character)) {
            errors.push({
                path: 'character.current_character',
                message: 'Character ID must contain only letters, numbers, underscores, and hyphens',
                value: config.current_character,
                code: 'INVALID_CHARACTER_ID'
            })
        }

        // 验证缩放值
        if (!TypeGuards.isValidScaleValue(config.scale)) {
            errors.push({
                path: 'character.scale',
                message: `Scale must be between ${CONFIG_VALIDATION_RULES.character.scale.min} and ${CONFIG_VALIDATION_RULES.character.scale.max}`,
                value: config.scale,
                code: 'INVALID_SCALE'
            })
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * 验证主题配置
     */
    public validateThemeConfig(config: any): ConfigValidationResult {
        const errors: ConfigValidationError[] = []
        const warnings: string[] = []

        if (!config || typeof config !== 'object') {
            errors.push({
                path: 'theme',
                message: 'Theme config must be an object',
                code: 'INVALID_TYPE'
            })
            return { valid: false, errors, warnings }
        }

        // 验证主题名称
        if (!TypeGuards.isValidThemeName(config.current_theme)) {
            errors.push({
                path: 'theme.current_theme',
                message: 'Invalid theme name',
                value: config.current_theme,
                code: 'INVALID_THEME'
            })
        }

        // 验证自定义CSS长度
        if (config.custom_css && config.custom_css.length > 10000) {
            errors.push({
                path: 'theme.custom_css',
                message: 'Custom CSS must be less than 10000 characters',
                value: config.custom_css.length,
                code: 'CSS_TOO_LONG'
            })
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * 验证系统配置
     */
    public validateSystemConfig(config: any): ConfigValidationResult {
        const errors: ConfigValidationError[] = []
        const warnings: string[] = []

        if (!config || typeof config !== 'object') {
            errors.push({
                path: 'system',
                message: 'System config must be an object',
                code: 'INVALID_TYPE'
            })
            return { valid: false, errors, warnings }
        }

        // 所有系统配置项都应该是布尔值
        const booleanFields = ['auto_start', 'minimize_to_tray', 'close_to_tray', 'show_notifications']
        
        for (const field of booleanFields) {
            if (typeof config[field] !== 'boolean') {
                errors.push({
                    path: `system.${field}`,
                    message: `${field} must be a boolean`,
                    value: config[field],
                    code: 'INVALID_TYPE'
                })
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * 验证业务规则
     */
    private validateBusinessRules(config: any): ConfigValidationResult {
        const errors: ConfigValidationError[] = []
        const warnings: string[] = []

        // 检查窗口大小合理性
        if (config.window && config.window.width && config.window.height) {
            const aspectRatio = config.window.width / config.window.height
            if (aspectRatio < 0.3 || aspectRatio > 3.0) {
                warnings.push(`Unusual window aspect ratio: ${aspectRatio.toFixed(2)}`)
            }
        }

        // 检查角色缩放合理性
        if (config.character && config.character.scale) {
            if (config.character.scale < 0.5) {
                warnings.push('Character scale is very small, may be hard to see')
            } else if (config.character.scale > 2.0) {
                warnings.push('Character scale is very large, may cause performance issues')
            }
        }

        // 检查系统配置一致性
        if (config.system) {
            if (config.system.close_to_tray && !config.system.minimize_to_tray) {
                warnings.push('Close to tray is enabled but minimize to tray is disabled')
            }
        }

        return {
            valid: true,
            errors,
            warnings
        }
    }

    /**
     * 创建内联 JSON Schema
     */
    private createInlineSchema(): any {
        return {
            type: 'object',
            required: ['window', 'character', 'theme', 'system'],
            properties: {
                window: {
                    type: 'object',
                    required: ['width', 'height', 'always_on_top', 'transparent', 'decorations', 'resizable'],
                    properties: {
                        width: { type: 'integer', minimum: 200, maximum: 4000 },
                        height: { type: 'integer', minimum: 200, maximum: 4000 },
                        always_on_top: { type: 'boolean' },
                        transparent: { type: 'boolean' },
                        decorations: { type: 'boolean' },
                        resizable: { type: 'boolean' },
                        position: { 
                            type: 'array', 
                            nullable: true,
                            items: { type: 'integer', minimum: 0 },
                            minItems: 2,
                            maxItems: 2
                        }
                    },
                    additionalProperties: false
                },
                character: {
                    type: 'object',
                    required: ['current_character', 'scale', 'auto_idle', 'interaction_enabled'],
                    properties: {
                        current_character: { 
                            type: 'string', 
                            pattern: '^[a-zA-Z0-9_-]+$',
                            minLength: 1,
                            maxLength: 50
                        },
                        scale: { type: 'number', minimum: 0.1, maximum: 5.0 },
                        auto_idle: { type: 'boolean' },
                        interaction_enabled: { type: 'boolean' }
                    },
                    additionalProperties: false
                },
                theme: {
                    type: 'object',
                    required: ['current_theme'],
                    properties: {
                        current_theme: { 
                            type: 'string',
                            enum: ['anime', 'modern', 'classic', 'dark', 'light', 'custom']
                        },
                        custom_css: { type: 'string', nullable: true, maxLength: 10000 }
                    },
                    additionalProperties: false
                },
                system: {
                    type: 'object',
                    required: ['auto_start', 'minimize_to_tray', 'close_to_tray', 'show_notifications'],
                    properties: {
                        auto_start: { type: 'boolean' },
                        minimize_to_tray: { type: 'boolean' },
                        close_to_tray: { type: 'boolean' },
                        show_notifications: { type: 'boolean' }
                    },
                    additionalProperties: false
                }
            },
            additionalProperties: false
        }
    }
}

/**
 * 配置验证工具函数
 */
export namespace ConfigValidationUtils {
    /**
     * 验证配置并返回结果
     */
    export function validateConfig(config: any): ConfigValidationResult {
        return ConfigValidator.getInstance().validateConfig(config)
    }

    /**
     * 验证配置并抛出错误（如果无效）
     */
    export function validateConfigOrThrow(config: any): AppConfig {
        const result = validateConfig(config)
        if (!result.valid) {
            const errorMessages = result.errors.map(e => `${e.path}: ${e.message}`).join(', ')
            throw new Error(`Configuration validation failed: ${errorMessages}`)
        }
        return config as AppConfig
    }

    /**
     * 安全地验证和转换配置
     */
    export function safeValidateConfig(config: any): { success: true; data: AppConfig } | { success: false; error: string } {
        try {
            const validatedConfig = validateConfigOrThrow(config)
            return { success: true, data: validatedConfig }
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown validation error' 
            }
        }
    }

    /**
     * 验证部分配置更新
     */
    export function validatePartialUpdate(update: any, currentConfig: AppConfig): ConfigValidationResult {
        // 合并当前配置和更新
        const mergedConfig = { ...currentConfig }
        
        if (update.window) {
            Object.assign(mergedConfig.window, update.window)
        }
        if (update.character) {
            Object.assign(mergedConfig.character, update.character)
        }
        if (update.theme) {
            Object.assign(mergedConfig.theme, update.theme)
        }
        if (update.system) {
            Object.assign(mergedConfig.system, update.system)
        }

        // 验证合并后的配置
        return validateConfig(mergedConfig)
    }

    /**
     * 获取配置验证摘要
     */
    export function getValidationSummary(result: ConfigValidationResult): string {
        if (result.valid) {
            return `✅ Configuration is valid${result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : ''}`
        } else {
            return `❌ Configuration has ${result.errors.length} error(s)${result.warnings.length > 0 ? ` and ${result.warnings.length} warning(s)` : ''}`
        }
    }
}

/**
 * 默认导出
 */
export default ConfigValidator
