/**
 * 配置系统使用示例
 * 
 * 展示如何使用配置类型定义、验证和错误处理工具
 */

import { 
    // AppConfig, 
    DEFAULT_CONFIG,
    TypeGuards,
    TypeConverters 
} from '../types/settings'
import { /* ConfigValidator, */ ConfigValidationUtils } from '../utils/configValidator'
import { 
    ConfigError, 
    ConfigErrorType, 
    ConfigSafetyUtils, 
    ConfigTypeConverter, 
    ConfigFixer,
    ConfigErrorHandler 
} from '../utils/configErrorHandler'

/**
 * 示例1: 基本配置验证
 */
export function exampleBasicValidation() {
    console.log('=== 基本配置验证示例 ===')
    
    // 使用默认配置
    const defaultConfig = DEFAULT_CONFIG
    const result = ConfigValidationUtils.validateConfig(defaultConfig)
    
    console.log('默认配置验证结果:', result.valid ? '✅ 有效' : '❌ 无效')
    if (!result.valid) {
        console.log('错误:', result.errors)
    }
    if (result.warnings.length > 0) {
        console.log('警告:', result.warnings)
    }
}

/**
 * 示例2: 无效配置处理
 */
export function exampleInvalidConfig() {
    console.log('\n=== 无效配置处理示例 ===')
    
    const invalidConfig = {
        window: {
            width: 50, // 太小
            height: 5000, // 太大
            always_on_top: 'yes', // 应该是布尔值
            transparent: true,
            decorations: false,
            resizable: true,
            position: [100, 200, 300] // 应该是2个元素
        },
        character: {
            current_character: 'invalid@character', // 包含非法字符
            scale: 10.0, // 超出范围
            auto_idle: true,
            interaction_enabled: true
        },
        theme: {
            current_theme: 'unknown_theme', // 无效主题
            custom_css: 'a'.repeat(20000) // 太长
        },
        system: {
            auto_start: 'maybe', // 应该是布尔值
            minimize_to_tray: true,
            close_to_tray: true,
            show_notifications: true
        }
    }
    
    const result = ConfigValidationUtils.validateConfig(invalidConfig)
    console.log('无效配置验证结果:', result.valid ? '✅ 有效' : '❌ 无效')
    
    if (!result.valid) {
        console.log('错误详情:')
        result.errors.forEach(error => {
            console.log(`  - ${error.path}: ${error.message}`)
        })
    }
    
    if (result.warnings.length > 0) {
        console.log('警告:')
        result.warnings.forEach(warning => {
            console.log(`  - ${warning}`)
        })
    }
}

/**
 * 示例3: 配置修复
 */
export function exampleConfigFix() {
    console.log('\n=== 配置修复示例 ===')
    
    const brokenConfig = {
        window: {
            width: '400px', // 字符串
            height: null, // null
            always_on_top: 'true', // 字符串布尔值
            transparent: true,
            decorations: false,
            resizable: true,
            position: [100, 200]
        },
        character: {
            current_character: 'shizuku',
            scale: '1.5', // 字符串数字
            auto_idle: 1, // 数字布尔值
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
    
    console.log('修复前配置:', JSON.stringify(brokenConfig, null, 2))
    
    const fixedConfig = ConfigFixer.fixConfig(brokenConfig)
    console.log('修复后配置:', JSON.stringify(fixedConfig, null, 2))
    
    // 验证修复后的配置
    const validationResult = ConfigValidationUtils.validateConfig(fixedConfig)
    console.log('修复后验证结果:', validationResult.valid ? '✅ 有效' : '❌ 无效')
}

/**
 * 示例4: 类型转换
 */
export function exampleTypeConversion() {
    console.log('\n=== 类型转换示例 ===')
    
    // 角色ID转换
    const characterIdResult = ConfigTypeConverter.toCharacterId('shizuku')
    if (characterIdResult.success) {
        console.log('角色ID转换成功:', characterIdResult.data)
    } else {
        console.log('角色ID转换失败:', characterIdResult.error.message)
    }
    
    // 缩放值转换
    const scaleResult = ConfigTypeConverter.toScaleValue(1.5)
    if (scaleResult.success) {
        console.log('缩放值转换成功:', scaleResult.data)
    } else {
        console.log('缩放值转换失败:', scaleResult.error.message)
    }
    
    // 主题名称转换
    const themeResult = ConfigTypeConverter.toThemeName('anime')
    if (themeResult.success) {
        console.log('主题名称转换成功:', themeResult.data)
    } else {
        console.log('主题名称转换失败:', themeResult.error.message)
    }
    
    // 窗口位置转换
    const positionResult = ConfigTypeConverter.toWindowPosition([100, 200])
    if (positionResult.success) {
        console.log('窗口位置转换成功:', positionResult.data)
    } else {
        console.log('窗口位置转换失败:', positionResult.error.message)
    }
}

/**
 * 示例5: 安全操作
 */
export function exampleSafeOperations() {
    console.log('\n=== 安全操作示例 ===')
    
    const config = {
        window: {
            width: 400,
            height: 600,
            settings: {
                advanced: {
                    debug: true
                }
            }
        }
    }
    
    // 安全获取嵌套属性
    const width = ConfigSafetyUtils.safeGet(config, 'window.width', 0)
    console.log('安全获取宽度:', width)
    
    const debug = ConfigSafetyUtils.safeGet(config, 'window.settings.advanced.debug', false)
    console.log('安全获取调试设置:', debug)
    
    const nonExistent = ConfigSafetyUtils.safeGet(config, 'non.existent.path', 'default')
    console.log('安全获取不存在的路径:', nonExistent)
    
    // 深度克隆
    const clonedConfig = ConfigSafetyUtils.deepClone(config)
    console.log('深度克隆结果:', JSON.stringify(clonedConfig, null, 2))
    
    // 深度合并
    const update = {
        window: {
            width: 500,
            height: 700, // 添加缺少的 height 属性
            settings: {
                advanced: {
                    debug: false
                    // 移除额外的 verbose 属性
                }
            }
        }
    }
    
    const mergedConfig = ConfigSafetyUtils.deepMerge(config, update)
    console.log('深度合并结果:', JSON.stringify(mergedConfig, null, 2))
}

/**
 * 示例6: 错误处理
 */
export function exampleErrorHandling() {
    console.log('\n=== 错误处理示例 ===')
    
    try {
        // 尝试转换无效的角色ID
        const invalidCharacterId = TypeConverters.toCharacterId('invalid@id')
        console.log('转换结果:', invalidCharacterId)
    } catch (error) {
        if (error instanceof ConfigError) {
            console.log('捕获到配置错误:', ConfigErrorHandler.createUserFriendlyMessage(error))
            ConfigErrorHandler.logConfigError(error, 'exampleErrorHandling')
        }
    }
    
    // 创建自定义错误
    const customError = new ConfigError(
        '自定义业务规则错误',
        ConfigErrorType.BUSINESS_RULE_ERROR,
        'character.scale',
        10.0,
        'SCALE_TOO_LARGE'
    )
    
    console.log('自定义错误:', ConfigErrorHandler.createUserFriendlyMessage(customError))
    console.log('错误详情:', customError.toValidationError())
}

/**
 * 示例7: 类型守卫
 */
export function exampleTypeGuards() {
    console.log('\n=== 类型守卫示例 ===')
    
    const testValues = [
        'shizuku',
        'invalid@id',
        'valid-id_123',
        '',
        null,
        undefined
    ]
    
    console.log('角色ID类型守卫测试:')
    testValues.forEach(value => {
        const isValid = TypeGuards.isValidCharacterId(value as string)
        console.log(`  "${value}" -> ${isValid ? '✅ 有效' : '❌ 无效'}`)
    })
    
    const scaleValues = [0.1, 1.0, 2.5, 5.0, 0.05, 10.0, NaN, Infinity]
    console.log('\n缩放值类型守卫测试:')
    scaleValues.forEach(value => {
        const isValid = TypeGuards.isValidScaleValue(value)
        console.log(`  ${value} -> ${isValid ? '✅ 有效' : '❌ 无效'}`)
    })
    
    const themeValues = ['anime', 'modern', 'classic', 'dark', 'light', 'custom', 'unknown']
    console.log('\n主题名称类型守卫测试:')
    themeValues.forEach(value => {
        const isValid = TypeGuards.isValidThemeName(value)
        console.log(`  "${value}" -> ${isValid ? '✅ 有效' : '❌ 无效'}`)
    })
}

/**
 * 运行所有示例
 */
export function runAllExamples() {
    console.log('🚀 配置系统使用示例')
    console.log('=' .repeat(50))
    
    exampleBasicValidation()
    exampleInvalidConfig()
    exampleConfigFix()
    exampleTypeConversion()
    exampleSafeOperations()
    exampleErrorHandling()
    exampleTypeGuards()
    
    console.log('\n' + '=' .repeat(50))
    console.log('✅ 所有示例运行完成')
}

// 如果直接运行此文件，执行所有示例
if (typeof window === 'undefined' && require.main === module) {
    runAllExamples()
}
