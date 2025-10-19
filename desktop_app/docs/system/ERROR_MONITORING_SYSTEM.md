# 错误监控系统文档

> **完成状态**: ✅ 已完成  
> **完成日期**: 2025-10-19  
> **负责范围**: 桌面应用本地错误监控和上报

## 🎯 系统概述

紫舒老师桌面应用的错误监控系统是一个全面、健壮的错误处理和监控解决方案，包含错误捕获、分类、上报、恢复和管理等完整功能。

### 核心功能

1. **全局错误捕获** - 自动捕获各类错误
2. **错误分类和分析** - 智能分类和严重程度评估
3. **错误上报机制** - 批量上报和重试机制
4. **错误恢复策略** - 自动恢复和降级处理
5. **错误管理界面** - 完整的用户界面
6. **崩溃报告** - 详细的崩溃信息收集

## 🏗️ 架构设计

### 职责划分

**桌面应用负责** (已实现):
- ✅ 本地错误监控和捕获
- ✅ 错误数据库存储和管理
- ✅ 错误上报到外部服务
- ✅ 错误恢复策略执行
- ✅ 错误管理用户界面
- ✅ 本地错误统计和分析

**社区平台负责** (不在桌面应用范围):
- 错误数据的服务器端收集和分析
- 全局错误趋势分析和报告
- 多用户错误数据聚合

## 📁 文件结构

```
src/
├── components/ErrorMonitor/          # 错误监控UI组件
│   ├── ErrorMonitorPanel.tsx        # 主监控面板
│   ├── ErrorMonitorPanel.css        # 面板样式
│   ├── ErrorDetailsModal.tsx        # 错误详情模态框
│   ├── ErrorDetailsModal.css        # 模态框样式
│   └── index.ts                      # 组件导出
├── services/                         # 服务层
│   ├── errorMonitoringService.ts     # 错误监控服务
│   ├── errorReportingService.ts      # 错误上报服务
│   └── errorRecoveryService.ts       # 错误恢复服务
├── utils/                           
│   └── globalErrorCatcher.ts         # 全局错误捕获器
├── hooks/
│   └── useErrorMonitor.ts            # 错误监控Hooks
├── types/
│   └── error.ts                      # 错误相关类型定义
└── src-tauri/src/
    ├── database/error.rs             # 错误数据库模型
    └── commands/error_monitoring.rs  # Rust命令接口
```

## 🔧 核心组件

### 1. 全局错误捕获器 (`globalErrorCatcher.ts`)

**功能**:
- JavaScript 错误捕获 (`window.onerror`)
- Promise 未处理拒绝捕获 (`unhandledrejection`)
- 资源加载错误捕获
- React 错误边界集成
- Console 错误捕获（可选）

**特性**:
- 🎯 智能错误分类和严重程度判断
- 🔍 敏感信息过滤和排除模式
- 📊 会话级错误计数限制
- ⚡ 自动上报机制
- 🎨 React 集成支持

**使用示例**:
```typescript
import { initializeGlobalErrorCatcher } from '@/utils/globalErrorCatcher'

// 初始化全局错误捕获器
initializeGlobalErrorCatcher({
  enableJSErrorCapture: true,
  enablePromiseRejectionCapture: true,
  enableResourceErrorCapture: true,
  autoReport: true,
  debugMode: process.env.NODE_ENV === 'development'
})
```

### 2. 错误上报服务 (`errorReportingService.ts`)

**功能**:
- 批量错误上报
- 频率限制和重试机制
- 敏感数据脱敏
- 网络错误处理
- 上报队列管理

**特性**:
- 📦 批量上报优化网络使用
- 🔄 指数退避重试策略
- 🎭 敏感信息自动脱敏
- ⚡ 优先级队列管理
- 📊 上报状态追踪

**配置示例**:
```typescript
const reportingConfig: ErrorReportConfig = {
  enabled: true,
  endpoint: 'https://api.example.com/errors',
  minSeverity: ErrorSeverity.MEDIUM,
  batchEnabled: true,
  batchSize: 10,
  maskSensitiveData: true
}
```

### 3. 错误恢复服务 (`errorRecoveryService.ts`)

**功能**:
- 智能恢复策略选择
- 自动重试机制
- 降级处理
- 断路器模式
- 恢复状态管理

**恢复策略**:
- 🔄 **重试策略**: 指数退避重试
- 📉 **降级策略**: 使用备用方案
- 🔄 **刷新策略**: 刷新页面恢复
- 🔄 **重启策略**: 重启应用
- 👤 **用户操作**: 需要用户干预

**使用示例**:
```typescript
import { errorRecoveryService } from '@/services/errorRecoveryService'

// 尝试恢复错误
const result = await errorRecoveryService.attemptRecovery(error, {
  strategy: RecoveryStrategy.RETRY,
  timeout: 30000
})
```

### 4. 错误监控面板 (`ErrorMonitorPanel.tsx`)

**功能**:
- 错误列表显示和筛选
- 错误统计和趋势分析
- 错误配置管理
- 错误操作（解决、重试等）

**界面特性**:
- 📋 **错误列表**: 分页、筛选、搜索
- 📊 **统计分析**: 图表和趋势显示
- ⚙️ **配置管理**: 监控配置界面
- 🎨 **响应式设计**: 支持桌面和移动端
- 🌙 **主题支持**: 明暗主题切换

### 5. 数据库存储 (`error.rs`)

**数据表**:
- `error_records`: 错误记录表
- `error_sessions`: 错误会话表
- `error_reports`: 错误上报记录表

**功能**:
- 🗄️ 错误数据持久化存储
- 🔍 高效的查询和索引
- 📊 统计信息计算
- 🧹 自动清理过期数据
- 📈 趋势数据生成

## 🎛️ 配置选项

### 全局错误捕获配置
```typescript
interface GlobalErrorConfig {
  enableJSErrorCapture: boolean          // JavaScript错误捕获
  enablePromiseRejectionCapture: boolean // Promise拒绝捕获
  enableResourceErrorCapture: boolean    // 资源错误捕获
  enableConsoleErrorCapture: boolean     // Console错误捕获
  autoReport: boolean                    // 自动上报
  maxErrorsPerSession: number            // 会话最大错误数
  excludePatterns: RegExp[]              // 排除模式
  debugMode: boolean                     // 调试模式
}
```

### 错误上报配置
```typescript
interface ErrorReportConfig {
  enabled: boolean                       // 启用上报
  endpoint?: string                      // 上报端点
  apiKey?: string                        // API密钥
  minSeverity: ErrorSeverity            // 最小严重级别
  rateLimitEnabled: boolean             // 频率限制
  maxReportsPerMinute: number           // 每分钟最大上报数
  batchEnabled: boolean                 // 批量上报
  batchSize: number                     // 批次大小
  maskSensitiveData: boolean            // 敏感数据脱敏
}
```

### 错误恢复配置
```typescript
interface RecoveryConfig {
  enableAutoRecovery: boolean           // 启用自动恢复
  maxRetryAttempts: number             // 最大重试次数
  retryBaseDelay: number               // 重试基础延迟
  enableCircuitBreaker: boolean        // 启用断路器
  circuitBreakerThreshold: number      // 断路器阈值
  recoveryTimeout: number              // 恢复超时时间
}
```

## 📊 错误分类

### 错误类型 (`ErrorType`)
- `JAVASCRIPT` - JavaScript运行时错误
- `REACT` - React组件错误
- `RUST` - Rust后端错误
- `SYSTEM` - 系统级错误
- `NETWORK` - 网络请求错误
- `API` - API调用错误
- `VALIDATION` - 数据验证错误
- `PERMISSION` - 权限相关错误
- `FILE` - 文件操作错误
- `MEMORY` - 内存相关错误

### 严重程度 (`ErrorSeverity`)
- `LOW` - 低：轻微错误，不影响核心功能
- `MEDIUM` - 中：影响部分功能，用户可继续使用
- `HIGH` - 高：影响重要功能，需要用户注意
- `CRITICAL` - 严重：系统性错误，可能导致崩溃

### 错误状态 (`ErrorStatus`)
- `NEW` - 新发生的错误
- `REPORTED` - 已上报到服务器
- `ACKNOWLEDGED` - 已确认处理
- `RECOVERING` - 正在恢复中
- `RESOLVED` - 已解决
- `IGNORED` - 已忽略

## 🚀 使用指南

### 1. 基础集成

错误监控系统已自动集成到应用主入口 (`App.tsx`)：

```typescript
import { initializeGlobalErrorCatcher } from '@/utils/globalErrorCatcher'

useEffect(() => {
  // 初始化全局错误捕获器
  initializeGlobalErrorCatcher({
    enableJSErrorCapture: true,
    enablePromiseRejectionCapture: true,
    enableResourceErrorCapture: true,
    enableConsoleErrorCapture: false,
    autoReport: true,
    debugMode: process.env.NODE_ENV === 'development',
  })
}, [])
```

### 2. 手动报告错误

```typescript
import { globalErrorCatcher } from '@/utils/globalErrorCatcher'

try {
  // 可能出错的代码
  await riskyOperation()
} catch (error) {
  // 手动报告错误
  globalErrorCatcher.captureException(error, {
    type: ErrorType.API,
    severity: ErrorSeverity.HIGH,
    extra: { operation: 'riskyOperation' }
  })
}
```

### 3. 使用错误监控Hook

```typescript
import { useErrorMonitor } from '@/hooks/useErrorMonitor'

function MyComponent() {
  const {
    errors,
    statistics,
    isMonitoring,
    reportError,
    resolveError
  } = useErrorMonitor()
  
  return (
    <div>
      <p>总错误数: {statistics.totalErrors}</p>
      <p>监控状态: {isMonitoring ? '运行中' : '已停止'}</p>
    </div>
  )
}
```

### 4. 显示错误监控面板

```typescript
import { ErrorMonitorPanel } from '@/components/ErrorMonitor'

function SettingsPage() {
  const [showErrorPanel, setShowErrorPanel] = useState(false)
  
  return (
    <div>
      <button onClick={() => setShowErrorPanel(true)}>
        打开错误监控
      </button>
      
      {showErrorPanel && (
        <ErrorMonitorPanel
          onClose={() => setShowErrorPanel(false)}
        />
      )}
    </div>
  )
}
```

## 📈 统计和分析

### 可用统计信息

1. **总体统计**
   - 总错误数量
   - 新错误数量
   - 已解决错误数量

2. **分类统计**
   - 按严重程度统计
   - 按错误类型统计
   - 按错误来源统计

3. **时间趋势**
   - 最近24小时错误趋势
   - 每小时错误统计

4. **热点分析**
   - 最常见错误列表
   - 错误发生频率排序

### 健康评分算法

系统根据以下因素计算健康评分（0-100分）：
- 总错误数量：1000+错误扣20分
- 新错误数量：50+新错误扣15分  
- 严重错误数量：10+严重错误扣25分
- 错误趋势：最近3小时错误20+扣10分

## 🛠️ Tauri 命令接口

### 主要命令

1. **错误报告**
   - `report_error` - 报告新错误
   - `get_error_list` - 获取错误列表
   - `get_error_details` - 获取错误详情

2. **错误管理**
   - `update_error_status` - 更新错误状态
   - `batch_resolve_errors` - 批量解决错误
   - `cleanup_old_errors` - 清理过期错误

3. **统计信息**
   - `get_error_statistics` - 获取错误统计
   - `get_system_health` - 获取系统健康状态

4. **上报管理**
   - `record_error_report` - 记录错误上报
   - `update_report_status` - 更新上报状态
   - `get_pending_reports` - 获取待上报错误

5. **配置管理**
   - `get_error_monitor_config` - 获取监控配置
   - `update_error_monitor_config` - 更新监控配置

## 🔐 安全和隐私

### 敏感数据保护

1. **自动脱敏**
   - 邮箱地址脱敏
   - 密码和密钥脱敏
   - 个人信息脱敏
   - API密钥脱敏

2. **配置选项**
   - 可选择是否包含用户数据
   - 可选择是否包含系统信息
   - 可配置敏感信息脱敏

3. **数据存储**
   - 本地SQLite数据库加密
   - 敏感字段单独加密
   - 自动清理过期数据

## 🚦 性能考虑

### 优化措施

1. **内存管理**
   - 错误记录数量限制
   - 自动清理机制
   - 内存使用监控

2. **网络优化**
   - 批量上报减少请求
   - 压缩数据减少带宽
   - 智能重试避免冗余

3. **存储优化**
   - 数据库索引优化
   - 分页查询支持
   - 压缩历史数据

## 📋 待扩展功能

### 未来规划

1. **高级分析**
   - 错误相关性分析
   - 用户行为关联
   - 性能影响评估

2. **智能预警**
   - 错误趋势预测
   - 异常模式检测
   - 自动告警机制

3. **集成扩展**
   - 第三方服务集成
   - CI/CD 集成
   - 监控平台对接

## 🎯 总结

紫舒老师桌面应用的错误监控系统是一个完整、健壮的解决方案，涵盖了错误处理的各个环节：

- ✅ **全面覆盖**: 涵盖JavaScript、React、系统等各类错误
- ✅ **智能处理**: 自动分类、恢复策略、敏感数据保护
- ✅ **用户友好**: 直观的管理界面和操作流程
- ✅ **高性能**: 优化的存储和网络使用
- ✅ **可扩展**: 模块化设计便于未来扩展

该系统为应用的稳定性和用户体验提供了强有力的保障，同时为开发和运维团队提供了完整的错误诊断和处理工具。
