# Zishu Sensei 配置系统

这是一个全面且健壮的配置管理系统，为 Zishu Sensei 桌面应用提供类型安全的配置定义、验证和错误处理。

## 特性

- ✅ **类型安全**: 严格的 TypeScript 类型定义
- ✅ **运行时验证**: JSON Schema 和业务规则验证
- ✅ **错误处理**: 完善的错误处理和用户友好的错误消息
- ✅ **配置修复**: 自动修复常见配置问题
- ✅ **类型转换**: 安全的类型转换工具
- ✅ **深度操作**: 安全的深度克隆和合并
- ✅ **类型守卫**: 运行时类型检查

## 文件结构

```
src/
├── types/
│   └── settings.ts              # 核心类型定义
├── utils/
│   ├── configValidator.ts       # 配置验证工具
│   └── configErrorHandler.ts    # 错误处理和类型安全工具
├── examples/
│   └── configExamples.ts        # 使用示例
└── config/
    └── settings.schema.json     # JSON Schema 验证文件
```

## 核心类型

### 基础类型

```typescript
// 窗口位置
type WindowPosition = [number, number]

// 角色ID (只允许字母、数字、下划线和连字符)
type CharacterId = string & { readonly __brand: 'CharacterId' }

// 主题名称
type ThemeName = 'anime' | 'modern' | 'classic' | 'dark' | 'light' | 'custom'

// 缩放值 (0.1 到 5.0)
type ScaleValue = number & { readonly __brand: 'ScaleValue' }
```

### 配置接口

```typescript
interface AppConfig {
    readonly window: WindowConfig
    readonly character: CharacterConfig
    readonly theme: ThemeConfig
    readonly system: SystemConfig
}
```

## 使用方法

### 1. 基本配置验证

```typescript
import { ConfigValidationUtils } from '../utils/configValidator'

const config = {
    window: { width: 400, height: 600, /* ... */ },
    character: { current_character: 'shizuku', /* ... */ },
    theme: { current_theme: 'anime', /* ... */ },
    system: { auto_start: false, /* ... */ }
}

const result = ConfigValidationUtils.validateConfig(config)
if (result.valid) {
    console.log('配置有效')
} else {
    console.log('配置错误:', result.errors)
}
```

### 2. 类型转换

```typescript
import { ConfigTypeConverter } from '../utils/configErrorHandler'

// 安全转换角色ID
const characterResult = ConfigTypeConverter.toCharacterId('shizuku')
if (characterResult.success) {
    const characterId: CharacterId = characterResult.data
    // 使用 characterId
} else {
    console.error('转换失败:', characterResult.error.message)
}
```

### 3. 配置修复

```typescript
import { ConfigFixer } from '../utils/configErrorHandler'

const brokenConfig = {
    window: { width: '400px', height: null }, // 类型错误
    character: { scale: '1.5' }, // 字符串数字
    // ...
}

const fixedConfig = ConfigFixer.fixConfig(brokenConfig)
// fixedConfig 现在包含修复后的有效配置
```

### 4. 类型守卫

```typescript
import { TypeGuards } from '../types/settings'

if (TypeGuards.isValidCharacterId(userInput)) {
    // userInput 是有效的 CharacterId
    const characterId = userInput as CharacterId
}

if (TypeGuards.isValidScaleValue(scaleInput)) {
    // scaleInput 是有效的 ScaleValue
    const scale = scaleInput as ScaleValue
}
```

### 5. 安全操作

```typescript
import { ConfigSafetyUtils } from '../utils/configErrorHandler'

// 安全获取嵌套属性
const width = ConfigSafetyUtils.safeGet(config, 'window.width', 400)

// 深度克隆
const clonedConfig = ConfigSafetyUtils.deepClone(config)

// 深度合并
const mergedConfig = ConfigSafetyUtils.deepMerge(config, updates)
```

### 6. 错误处理

```typescript
import { ConfigError, ConfigErrorType, ConfigErrorHandler } from '../utils/configErrorHandler'

try {
    const characterId = TypeConverters.toCharacterId('invalid@id')
} catch (error) {
    if (error instanceof ConfigError) {
        console.log(ConfigErrorHandler.createUserFriendlyMessage(error))
        ConfigErrorHandler.logConfigError(error, 'context')
    }
}
```

## JSON Schema 验证

配置文件 `config/settings.schema.json` 提供了完整的 JSON Schema 定义，支持：

- 类型验证
- 范围检查
- 格式验证
- 必需字段检查
- 自定义约束

## 验证规则

### 窗口配置
- `width`: 200-4000 像素
- `height`: 200-4000 像素
- `position`: null 或 [x, y] 数组

### 角色配置
- `current_character`: 1-50 字符，只允许字母、数字、下划线和连字符
- `scale`: 0.1-5.0 之间的数值

### 主题配置
- `current_theme`: 预定义的主题名称
- `custom_css`: 最大 10000 字符

### 系统配置
- 所有字段都必须是布尔值

## 错误类型

```typescript
enum ConfigErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    TYPE_ERROR = 'TYPE_ERROR',
    RANGE_ERROR = 'RANGE_ERROR',
    FORMAT_ERROR = 'FORMAT_ERROR',
    REQUIRED_ERROR = 'REQUIRED_ERROR',
    BUSINESS_RULE_ERROR = 'BUSINESS_RULE_ERROR',
    IO_ERROR = 'IO_ERROR',
    PARSE_ERROR = 'PARSE_ERROR'
}
```

## 最佳实践

### 1. 始终验证用户输入

```typescript
// ❌ 不推荐
const config = JSON.parse(userInput)

// ✅ 推荐
const parseResult = ConfigValidationUtils.safeValidateConfig(JSON.parse(userInput))
if (parseResult.success) {
    const config = parseResult.data
} else {
    console.error('配置解析失败:', parseResult.error)
}
```

### 2. 使用类型守卫

```typescript
// ❌ 不推荐
if (typeof value === 'string' && value.length > 0) {
    // 假设是有效的角色ID
}

// ✅ 推荐
if (TypeGuards.isValidCharacterId(value)) {
    // 确定是有效的角色ID
    const characterId = value as CharacterId
}
```

### 3. 处理配置更新

```typescript
// ✅ 推荐
const updateResult = ConfigValidationUtils.validatePartialUpdate(update, currentConfig)
if (updateResult.valid) {
    // 应用更新
} else {
    // 显示错误信息
    console.error(ConfigErrorHandler.handleValidationError(updateResult))
}
```

### 4. 使用配置修复

```typescript
// ✅ 推荐：对于用户配置文件
const userConfig = JSON.parse(fs.readFileSync('user-config.json', 'utf8'))
const fixedConfig = ConfigFixer.fixConfig(userConfig)
const validatedConfig = ConfigValidationUtils.validateConfigOrThrow(fixedConfig)
```

## 运行示例

```bash
# 运行配置系统示例
npx ts-node src/examples/configExamples.ts
```

## 依赖

- `ajv`: JSON Schema 验证
- `ajv-formats`: JSON Schema 格式验证

## 许可证

MIT License
