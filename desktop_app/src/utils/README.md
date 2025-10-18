# 工具函数使用指南

本目录包含了桌面应用中使用的所有工具函数，提供了完整、高效、类型安全的解决方案。

## 📚 目录结构

```
utils/
├── constants.ts      # 应用常量定义
├── helpers.ts        # 通用辅助函数
├── debounce.ts       # 防抖和节流工具
├── formatters.ts     # 格式化函数
├── validators.ts     # 验证函数
├── logger.ts         # 日志工具
├── storage.ts        # 存储工具
├── errorHandler.ts   # 错误处理
└── index.ts          # 统一导出
```

## 🔧 核心模块

### 1. constants.ts - 常量定义

集中管理应用中使用的所有常量值。

```typescript
import { API_CONFIG, WINDOW_CONFIG, THEMES, ERROR_CODES } from '@/utils/constants'

// API 配置
console.log(API_CONFIG.BASE_URL) // 'http://127.0.0.1:8000'
console.log(API_CONFIG.TIMEOUT)  // 30000

// 窗口配置
console.log(WINDOW_CONFIG.DEFAULT_WIDTH)  // 400
console.log(WINDOW_CONFIG.MIN_WIDTH)      // 200

// 主题配置
console.log(THEMES.ANIME.name)            // '动漫风格'
console.log(THEMES.DARK.cssFile)          // '/styles/themes/dark.css'

// 错误码
console.log(ERROR_CODES.NETWORK_ERROR)    // 'NETWORK_ERROR'
```

**主要常量分类：**
- `API_CONFIG` - API 基础配置
- `API_ENDPOINTS` - API 端点定义
- `HTTP_STATUS` - HTTP 状态码
- `APP_INFO` - 应用基础信息
- `WINDOW_CONFIG` - 窗口配置
- `CHARACTERS` - 可用角色列表
- `THEMES` - 可用主题
- `LIVE2D_CONFIG` - Live2D 配置
- `STORAGE_KEYS` - 本地存储键名
- `ERROR_CODES` - 错误码定义
- `TASK_STATUS` - 任务状态
- `ADAPTER_TYPES` - 适配器类型
- `SHORTCUTS` - 快捷键定义
- `REGEX_PATTERNS` - 常用正则表达式
- `TIME_FORMATS` - 时间格式
- `FILE_TYPES` - 文件类型
- `LOG_LEVELS` - 日志级别
- `FEATURE_FLAGS` - 功能开关

### 2. helpers.ts - 辅助函数

提供各种实用的辅助函数。

#### 对象处理

```typescript
import { deepClone, deepMerge, pick, omit, isEmpty } from '@/utils/helpers'

// 深度克隆
const original = { a: 1, b: { c: 2 } }
const cloned = deepClone(original)

// 深度合并
const merged = deepMerge({ a: 1 }, { b: 2 }, { c: 3 })
// { a: 1, b: 2, c: 3 }

// 选取属性
const obj = { a: 1, b: 2, c: 3 }
const picked = pick(obj, ['a', 'c'])  // { a: 1, c: 3 }

// 排除属性
const omitted = omit(obj, ['b'])      // { a: 1, c: 3 }

// 检查是否为空
isEmpty({})        // true
isEmpty([])        // true
isEmpty(null)      // true
isEmpty('hello')   // false
```

#### 数组处理

```typescript
import {
    unique,
    uniqueBy,
    chunk,
    flatten,
    groupBy,
    shuffle,
    sum,
    average
} from '@/utils/helpers'

// 数组去重
unique([1, 2, 2, 3, 3, 4])  // [1, 2, 3, 4]

// 根据属性去重
const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 1, name: 'Charlie' }
]
uniqueBy(users, 'id')  // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]

// 数组分块
chunk([1, 2, 3, 4, 5], 2)  // [[1, 2], [3, 4], [5]]

// 数组扁平化
flatten([[1, 2], [3, [4, 5]]])  // [1, 2, 3, 4, 5]

// 根据属性分组
const items = [
    { type: 'a', value: 1 },
    { type: 'b', value: 2 },
    { type: 'a', value: 3 }
]
groupBy(items, 'type')
// { a: [{type: 'a', value: 1}, {type: 'a', value: 3}], b: [{type: 'b', value: 2}] }

// 数组随机打乱
shuffle([1, 2, 3, 4, 5])  // [3, 1, 5, 2, 4] (随机顺序)

// 数组求和
sum([1, 2, 3, 4, 5])  // 15

// 数组平均值
average([1, 2, 3, 4, 5])  // 3
```

#### 字符串处理

```typescript
import {
    capitalize,
    camelToSnake,
    snakeToCamel,
    truncate,
    randomString,
    uuid
} from '@/utils/helpers'

// 首字母大写
capitalize('hello')  // 'Hello'

// 驼峰转下划线
camelToSnake('helloWorld')  // 'hello_world'

// 下划线转驼峰
snakeToCamel('hello_world')  // 'helloWorld'

// 截断字符串
truncate('Hello World', 8)  // 'Hello...'
truncate('Hello World', 8, '…')  // 'Hello W…'

// 生成随机字符串
randomString(10)  // 'aB3kL9mP2q'

// 生成UUID
uuid()  // 'a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p'
```

#### 数字处理

```typescript
import {
    formatNumber,
    formatThousands,
    formatPercent,
    clamp,
    randomInt
} from '@/utils/helpers'

// 数字格式化
formatNumber(3.14159, 2)  // '3.14'

// 千分位格式化
formatThousands(1234567)  // '1,234,567'

// 百分比格式化
formatPercent(75, 100)  // '75.00%'
formatPercent(1, 3, 1)  // '33.3%'

// 数字范围限制
clamp(15, 0, 10)   // 10
clamp(-5, 0, 10)   // 0
clamp(5, 0, 10)    // 5

// 生成随机整数
randomInt(1, 10)  // 1-10 之间的随机整数
```

#### 日期时间处理

```typescript
import {
    formatDate,
    formatRelativeTime,
    formatDuration,
    isToday,
    isYesterday
} from '@/utils/helpers'

// 格式化日期
formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')  // '2024-01-15 14:30:00'

// 相对时间格式化
formatRelativeTime(Date.now() - 60000)    // '1分钟前'
formatRelativeTime(Date.now() - 3600000)  // '1小时前'
formatRelativeTime(Date.now() - 86400000) // '1天前'

// 持续时间格式化
formatDuration(1500)       // '1.5秒'
formatDuration(65000)      // '1分5秒'
formatDuration(3665000)    // '1小时1分'

// 检查是否为今天
isToday(new Date())  // true

// 检查是否为昨天
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
isYesterday(yesterday)  // true
```

#### 文件处理

```typescript
import {
    formatFileSize,
    getFileExtension,
    getFileNameWithoutExtension,
    isFileType
} from '@/utils/helpers'

// 格式化文件大小
formatFileSize(1024)       // '1.00 KB'
formatFileSize(1048576)    // '1.00 MB'
formatFileSize(1073741824) // '1.00 GB'

// 获取文件扩展名
getFileExtension('document.pdf')  // 'pdf'

// 获取文件名（不含扩展名）
getFileNameWithoutExtension('document.pdf')  // 'document'

// 检查文件类型
isFileType('image.jpg', ['jpg', 'png', 'gif'])  // true
```

#### 性能优化

```typescript
import { sleep, retry, timeout, batchProcess } from '@/utils/helpers'

// 延迟执行
await sleep(1000)  // 延迟 1 秒

// 重试函数
const result = await retry(
    async () => {
        // 可能失败的操作
        return await fetchData()
    },
    {
        maxAttempts: 3,
        delay: 1000,
        backoff: 2,
        onRetry: (error, attempt) => {
            console.log(`重试第 ${attempt} 次:`, error.message)
        }
    }
)

// 超时控制
try {
    const data = await timeout(
        fetchLargeData(),
        5000,
        '数据获取超时'
    )
} catch (error) {
    console.error(error)  // '数据获取超时'
}

// 批量处理
const items = Array.from({ length: 100 }, (_, i) => i)
const results = await batchProcess(
    items,
    async (item) => processItem(item),
    {
        batchSize: 10,
        concurrency: 3,
        onProgress: (processed, total) => {
            console.log(`进度: ${processed}/${total}`)
        }
    }
)
```

### 3. debounce.ts - 防抖和节流

提供高性能的防抖和节流实现，支持多种高级选项。

#### 基础防抖

```typescript
import { debounce } from '@/utils/debounce'

// 基础防抖
const searchDebounced = debounce((query: string) => {
    console.log('搜索:', query)
}, 300)

// 用户快速输入时，只会在停止输入300ms后执行一次
searchDebounced('h')
searchDebounced('he')
searchDebounced('hel')
searchDebounced('hello')
// 只会输出一次: '搜索: hello'

// 取消防抖
searchDebounced.cancel()

// 立即执行
searchDebounced.flush()

// 检查是否有待处理的调用
searchDebounced.pending()  // true/false
```

#### 高级防抖选项

```typescript
import { debounce } from '@/utils/debounce'

// 前导边缘执行（立即执行，之后冷却）
const leadingDebounced = debounce(
    () => console.log('执行'),
    1000,
    { leading: true, trailing: false }
)

// 最大等待时间（即使一直触发，最多等待 maxWait）
const maxWaitDebounced = debounce(
    () => console.log('执行'),
    500,
    { maxWait: 2000 }
)
```

#### 基础节流

```typescript
import { throttle } from '@/utils/debounce'

// 基础节流
const scrollThrottled = throttle(() => {
    console.log('滚动处理')
}, 100)

// 无论滚动多快，每100ms最多执行一次
window.addEventListener('scroll', scrollThrottled)
```

#### 帧节流

```typescript
import { rafThrottle } from '@/utils/debounce'

// 使用 requestAnimationFrame 进行节流
const animationThrottled = rafThrottle((deltaTime: number) => {
    // 动画更新逻辑
    updateAnimation(deltaTime)
})

// 适用于动画和视觉更新
requestAnimationFrame(animationThrottled)
```

#### Promise 防抖/节流

```typescript
import { debouncePromise, throttlePromise } from '@/utils/debounce'

// Promise 防抖
const fetchDataDebounced = debouncePromise(
    async (query: string) => {
        const response = await fetch(`/api/search?q=${query}`)
        return response.json()
    },
    300
)

// 返回 Promise
const data = await fetchDataDebounced('hello')

// Promise 节流
const saveDataThrottled = throttlePromise(
    async (data: any) => {
        const response = await fetch('/api/save', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        return response.json()
    },
    1000
)
```

#### 高级变体

```typescript
import {
    adaptiveDebounce,
    throttleWithCount,
    conditionalDebounce
} from '@/utils/debounce'

// 自适应防抖（根据调用频率动态调整等待时间）
const adaptiveSearch = adaptiveDebounce(
    (query: string) => console.log('搜索:', query),
    100,  // 最小等待时间
    2000  // 最大等待时间
)

// 带计数的节流（记录跳过的调用次数）
const countThrottled = throttleWithCount(
    () => console.log('执行'),
    1000,
    (skipCount) => console.log(`跳过了 ${skipCount} 次调用`)
)

// 条件防抖（只在满足条件时防抖）
const conditionalSearch = conditionalDebounce(
    (query: string) => console.log('搜索:', query),
    300,
    (query) => query.length > 2  // 只在查询长度大于2时防抖
)
```

## 📋 最佳实践

### 1. 使用常量而非硬编码

❌ **不推荐：**
```typescript
const baseUrl = 'http://127.0.0.1:8000'
const timeout = 30000
```

✅ **推荐：**
```typescript
import { API_CONFIG } from '@/utils/constants'

const baseUrl = API_CONFIG.BASE_URL
const timeout = API_CONFIG.TIMEOUT
```

### 2. 使用辅助函数简化代码

❌ **不推荐：**
```typescript
const cloned = JSON.parse(JSON.stringify(obj))  // 无法处理 Date、函数等
```

✅ **推荐：**
```typescript
import { deepClone } from '@/utils/helpers'

const cloned = deepClone(obj)
```

### 3. 正确使用防抖和节流

❌ **不推荐：**
```typescript
// 组件内部定义，每次渲染都会创建新函数
function SearchComponent() {
    const handleSearch = debounce((query) => {
        // 搜索逻辑
    }, 300)
    
    return <input onChange={e => handleSearch(e.target.value)} />
}
```

✅ **推荐：**
```typescript
import { useCallback } from 'react'
import { debounce } from '@/utils/debounce'

function SearchComponent() {
    // 使用 useCallback 保持函数引用稳定
    const handleSearch = useCallback(
        debounce((query: string) => {
            // 搜索逻辑
        }, 300),
        []
    )
    
    return <input onChange={e => handleSearch(e.target.value)} />
}
```

### 4. 错误处理

❌ **不推荐：**
```typescript
try {
    const data = await fetchData()
} catch (error) {
    console.log('出错了')
}
```

✅ **推荐：**
```typescript
import { retry } from '@/utils/helpers'
import { ERROR_CODES } from '@/utils/constants'

try {
    const data = await retry(() => fetchData(), {
        maxAttempts: 3,
        delay: 1000,
        backoff: true
    })
} catch (error) {
    const errorCode = ERROR_CODES.NETWORK_ERROR
    logger.error(errorCode, error)
}
```

## 🔍 类型安全

所有工具函数都提供了完整的 TypeScript 类型定义，享受全面的类型提示和检查：

```typescript
import { deepClone, formatFileSize } from '@/utils/helpers'

interface User {
    id: number
    name: string
    settings: {
        theme: string
        notifications: boolean
    }
}

const user: User = {
    id: 1,
    name: 'Alice',
    settings: {
        theme: 'dark',
        notifications: true
    }
}

// 类型推断正确
const clonedUser = deepClone(user)  // 类型为 User

// 类型检查
const size: string = formatFileSize(1024)  // ✅ 正确
const size2: number = formatFileSize(1024) // ❌ 类型错误
```

## 📦 导入方式

### 命名导入（推荐）

```typescript
import { deepClone, debounce, API_CONFIG } from '@/utils'
```

### 默认导入

```typescript
import { helpers, debounceUtils, constants } from '@/utils'

helpers.deepClone(obj)
debounceUtils.debounce(fn, 300)
console.log(constants.API_CONFIG)
```

### 直接从子模块导入

```typescript
import { deepClone } from '@/utils/helpers'
import { debounce } from '@/utils/debounce'
import { API_CONFIG } from '@/utils/constants'
```

## 🚀 性能优化建议

1. **使用防抖/节流优化高频事件**
   - 搜索输入：使用防抖
   - 滚动事件：使用节流
   - 窗口调整：使用节流
   - 自动保存：使用防抖

2. **使用批量处理处理大量数据**
   - 避免一次性处理大量数据阻塞 UI
   - 使用 `batchProcess` 分批处理

3. **使用重试机制提高可靠性**
   - 网络请求失败时自动重试
   - 配置合理的重试次数和延迟

4. **使用缓存减少重复计算**
   - 对昂贵的计算结果进行缓存
   - 使用 `memoize` 模式

## 📚 更多资源

- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [React 官方文档](https://react.dev/)

---

**如有问题或建议，欢迎提交 Issue！** 🎉

