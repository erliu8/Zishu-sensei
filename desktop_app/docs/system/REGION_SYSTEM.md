# 区域适配系统文档

> 生成日期：2025-10-19  
> 版本：v1.0.0  
> 状态：已完成

## 📋 概述

区域适配系统提供了完整的国际化和本地化支持，包括时区处理、货币格式化、度量单位转换、文化习惯适配等功能。系统设计采用了前后端分离的架构，确保了高性能和灵活性。

## 🎯 主要功能

### 1. 系统区域检测
- 自动检测操作系统的语言、时区和货币设置
- 跨平台支持（Windows、macOS、Linux）
- 智能推荐适合的区域配置
- 检测置信度评估

### 2. 格式化服务
- **日期时间**: 支持多种日期和时间格式
- **数字格式**: 千位分隔符、小数点符号自定义
- **货币格式**: 多币种支持，符号位置可配置
- **温度单位**: 摄氏度、华氏度、开尔文转换
- **距离单位**: 公制、英制、混合模式
- **重量单位**: 千克、磅等多种单位
- **文件大小**: 智能单位选择（B、KB、MB、GB等）
- **百分比**: 精度可配置

### 3. 单位转换
- 温度单位间转换
- 距离单位间转换
- 重量单位间转换
- 高精度计算保证

### 4. 用户偏好管理
- 个人区域设置存储
- 设置导入/导出
- 实时生效
- 历史记录追踪

## 🏗️ 架构设计

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端组件层     │    │   服务层        │    │   后端命令层     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ RegionSettings   │    │ RegionService   │    │ region.rs       │
│ RegionSelector   │    │ FormatCache     │    │ region_detector │
│ FormatPreview    │    │ Hooks           │    │ region_formatter│
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   数据库层       │
                    ├─────────────────┤
                    │ region.rs       │
                    │ SQLite 存储     │
                    └─────────────────┘
```

## 📁 文件结构

### 后端 (Rust)

```
src-tauri/src/
├── database/
│   └── region.rs              # 区域数据库模型和操作
├── utils/
│   ├── region_detector.rs     # 系统区域检测
│   └── region_formatter.rs    # 格式化工具
└── commands/
    └── region.rs             # Tauri 命令接口
```

### 前端 (TypeScript/React)

```
src/
├── types/
│   └── region.ts             # 类型定义和工具函数
├── services/
│   └── regionService.ts      # 服务层接口
├── hooks/
│   └── useRegion.ts         # React Hooks
└── components/Settings/
    ├── RegionSettings.tsx    # 主设置组件
    ├── RegionSettings.css    # 主设置样式
    ├── RegionSelector.tsx    # 区域选择器
    ├── RegionSelector.css    # 选择器样式
    ├── FormatPreview.tsx     # 格式化预览
    └── FormatPreview.css     # 预览样式
```

## 🚀 快速开始

### 1. 基本使用

```typescript
import { useRegion, useFormat } from '../hooks/useRegion';

function MyComponent() {
  const { preferences, saveUserPreferences } = useRegion();
  const { formatCurrency, formatDateTime } = useFormat();

  // 格式化货币
  const formatPrice = async (amount: number) => {
    const formatted = await formatCurrency(amount);
    return formatted.value;
  };

  // 格式化日期
  const formatDate = async (timestamp: number) => {
    const formatted = await formatDateTime(timestamp);
    return formatted.value;
  };

  return (
    <div>
      <p>当前区域: {preferences?.locale}</p>
      <button onClick={() => formatPrice(1234.56)}>
        格式化价格
      </button>
    </div>
  );
}
```

### 2. 添加区域设置

```typescript
import { RegionSettings } from '../components/Settings/RegionSettings';

function SettingsPage() {
  return (
    <div>
      <h1>应用设置</h1>
      <RegionSettings
        onSaved={(preferences) => {
          console.log('区域设置已保存:', preferences);
        }}
      />
    </div>
  );
}
```

### 3. 自定义格式化

```typescript
import { RegionService } from '../services/regionService';

// 直接调用服务
const formatCustomNumber = async (number: number) => {
  return await RegionService.formatNumber(number, 3);
};

// 转换温度
const convertTemp = async (celsius: number) => {
  return await RegionService.convertTemperature(celsius, 'celsius', 'fahrenheit');
};
```

## 🔧 配置选项

### 支持的区域代码

```typescript
// 主要支持的区域
const SUPPORTED_LOCALES = [
  'zh-CN',    // 中文（简体）
  'zh-TW',    // 中文（繁体）
  'en-US',    // 英语（美国）
  'en-GB',    // 英语（英国）
  'ja-JP',    // 日语（日本）
  'ko-KR',    // 韩语（韩国）
  'de-DE',    // 德语（德国）
  'fr-FR',    // 法语（法国）
  // ... 更多
];
```

### 货币配置

```typescript
// 支持的货币代码
const SUPPORTED_CURRENCIES = [
  'CNY',      // 人民币
  'USD',      // 美元
  'EUR',      // 欧元
  'GBP',      // 英镑
  'JPY',      // 日元
  'KRW',      // 韩元
  // ... 更多
];
```

### 时区配置

```typescript
// 主要支持的时区
const SUPPORTED_TIMEZONES = [
  'Asia/Shanghai',     // 中国标准时间
  'America/New_York',  // 美国东部时间
  'Europe/London',     // 格林威治时间
  'Asia/Tokyo',        // 日本标准时间
  // ... 更多
];
```

## 📊 数据库结构

### 用户区域偏好表 (region_preferences)

```sql
CREATE TABLE region_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    locale TEXT NOT NULL DEFAULT 'zh-CN',
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    currency TEXT NOT NULL DEFAULT 'CNY',
    number_format TEXT NOT NULL DEFAULT '1,234.56',
    date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    time_format TEXT NOT NULL DEFAULT '24h',
    temperature_unit TEXT NOT NULL DEFAULT 'celsius',
    distance_unit TEXT NOT NULL DEFAULT 'metric',
    weight_unit TEXT NOT NULL DEFAULT 'kg',
    first_day_of_week INTEGER NOT NULL DEFAULT 1,
    rtl_support BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 区域配置缓存表 (region_configs)

```sql
CREATE TABLE region_configs (
    locale TEXT PRIMARY KEY,
    config_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 🎨 UI 组件

### RegionSettings 主组件

完整的区域设置界面，包含：
- 基本设置（区域、时区、货币）
- 格式设置（日期、时间、数字）
- 单位设置（温度、距离、重量）
- 预览效果

**Props:**
```typescript
interface RegionSettingsProps {
  modal?: boolean;                    // 是否为模态对话框
  onClose?: () => void;              // 关闭回调
  onSaved?: (preferences: RegionPreferences) => void; // 保存回调
}
```

### RegionSelector 选择器

区域语言选择组件，支持：
- 搜索过滤
- 推荐区域
- 本地化显示

**Props:**
```typescript
interface RegionSelectorProps {
  value?: string;                     // 当前值
  onChange?: (locale: string) => void; // 变化回调
  disabled?: boolean;                 // 是否禁用
  placeholder?: string;               // 占位符
  showRecommended?: boolean;          // 显示推荐
  className?: string;                 // 自定义样式
}
```

### FormatPreview 预览组件

格式化效果预览，显示：
- 日期时间格式
- 数字货币格式
- 单位格式
- 区域信息

**Props:**
```typescript
interface FormatPreviewProps {
  preferences: RegionPreferences;     // 区域偏好
  sampleData?: SampleData;           // 示例数据
  className?: string;                // 自定义样式
}
```

## 🔌 API 接口

### Tauri 命令

区域适配系统提供了 23 个 Tauri 命令：

#### 系统检测命令
- `detect_system_region` - 检测系统区域
- `get_recommended_regions` - 获取推荐区域

#### 偏好管理命令
- `get_user_region_preferences` - 获取用户偏好
- `save_user_region_preferences` - 保存用户偏好
- `delete_user_region_preferences` - 删除用户偏好

#### 配置管理命令
- `get_all_region_configs` - 获取所有配置
- `get_region_config` - 获取指定配置
- `cache_region_config` - 缓存配置

#### 初始化命令
- `initialize_region_system` - 初始化系统

#### 格式化命令
- `format_datetime` - 格式化日期时间
- `format_date` - 格式化日期
- `format_time` - 格式化时间
- `format_number` - 格式化数字
- `format_currency` - 格式化货币
- `format_temperature` - 格式化温度
- `format_distance` - 格式化距离
- `format_weight` - 格式化重量
- `format_file_size` - 格式化文件大小
- `format_percentage` - 格式化百分比

#### 转换命令
- `convert_temperature` - 转换温度
- `convert_distance` - 转换距离
- `convert_weight` - 转换重量

#### 维护命令
- `cleanup_expired_region_cache` - 清理过期缓存
- `get_region_format_stats` - 获取格式化统计

### React Hooks

#### useRegion()
主要的区域适配 Hook，提供完整的状态管理和操作。

```typescript
const {
  preferences,           // 当前用户偏好
  systemRegion,         // 系统检测到的区域
  availableRegions,     // 可用区域列表
  loading,              // 加载状态
  error,                // 错误信息
  initialized,          // 是否已初始化
  saveUserPreferences,  // 保存偏好
  detectSystemRegion,   // 检测系统区域
  // ... 更多操作
} = useRegion();
```

#### useFormat()
格式化功能 Hook，提供各种格式化操作。

```typescript
const {
  formatDateTime,       // 格式化日期时间
  formatCurrency,       // 格式化货币
  formatNumber,         // 格式化数字
  // ... 更多格式化方法
  formatting,           // 格式化状态
  clearCache,           // 清理缓存
} = useFormat();
```

#### useUnitConversion()
单位转换 Hook，提供单位转换功能。

```typescript
const {
  convertTemperature,   // 转换温度
  convertDistance,      // 转换距离
  convertWeight,        // 转换重量
  loading,              // 转换状态
  error,                // 错误信息
} = useUnitConversion();
```

## 🎭 使用场景

### 1. 聊天界面本地化

```typescript
function ChatMessage({ message }: { message: Message }) {
  const { formatDateTime, formatFileSize } = useFormat();
  const [formattedTime, setFormattedTime] = useState('');
  
  useEffect(() => {
    formatDateTime(message.timestamp).then(result => {
      setFormattedTime(result.value);
    });
  }, [message.timestamp]);

  return (
    <div className="message">
      <div className="message-content">{message.content}</div>
      <div className="message-time">{formattedTime}</div>
      {message.attachments?.map(file => (
        <div key={file.id} className="attachment">
          {file.name} ({formatFileSize(file.size)})
        </div>
      ))}
    </div>
  );
}
```

### 2. 系统设置集成

```typescript
function SystemSettings() {
  const { preferences, saveUserPreferences } = useRegion();
  
  const handleLanguageChange = async (locale: string) => {
    if (preferences) {
      const updated = { ...preferences, locale };
      await saveUserPreferences(updated);
    }
  };

  return (
    <div className="settings">
      <h2>语言和区域</h2>
      <RegionSelector
        value={preferences?.locale}
        onChange={handleLanguageChange}
        showRecommended
      />
      <RegionSettings modal={false} />
    </div>
  );
}
```

### 3. 数据展示本地化

```typescript
function DataDashboard({ stats }: { stats: Statistics }) {
  const { formatCurrency, formatPercentage, formatNumber } = useFormat();
  
  return (
    <div className="dashboard">
      <div className="stat-card">
        <h3>总收入</h3>
        <AsyncValue 
          asyncValue={() => formatCurrency(stats.totalRevenue)}
          fallback="加载中..."
        />
      </div>
      <div className="stat-card">
        <h3>增长率</h3>
        <AsyncValue 
          asyncValue={() => formatPercentage(stats.growthRate)}
        />
      </div>
      <div className="stat-card">
        <h3>用户数</h3>
        <AsyncValue 
          asyncValue={() => formatNumber(stats.userCount)}
        />
      </div>
    </div>
  );
}
```

## 🔧 自定义和扩展

### 1. 添加新的区域配置

```rust
// 在 region.rs 中添加新的区域配置
RegionConfig {
    locale: "es-ES".to_string(),
    name: "Spanish (Spain)".to_string(),
    native_name: "Español (España)".to_string(),
    language_code: "es".to_string(),
    country_code: "ES".to_string(),
    currency: "EUR".to_string(),
    timezone: vec!["Europe/Madrid".to_string()],
    // ... 其他配置
}
```

### 2. 扩展格式化功能

```rust
// 在 region_formatter.rs 中添加新的格式化方法
impl RegionFormatter {
    pub fn format_custom_unit(&self, value: f64, unit: &str) -> FormattedValue {
        // 自定义格式化逻辑
        FormattedValue {
            value: format!("{} {}", value, unit),
            unit: Some(unit.to_string()),
            symbol: Some(unit.to_string()),
        }
    }
}
```

### 3. 自定义 Hook

```typescript
// 创建自定义格式化 Hook
function useCustomFormat() {
  const { preferences } = useRegion();
  
  const formatCustomData = useCallback(async (data: CustomData) => {
    // 自定义格式化逻辑
    return formatCustomValue(data, preferences);
  }, [preferences]);

  return { formatCustomData };
}
```

## ⚡ 性能优化

### 1. 缓存机制

系统内置了多级缓存：
- **内存缓存**: 格式化结果缓存（TTL: 5分钟）
- **数据库缓存**: 区域配置缓存
- **请求缓存**: 避免重复的系统检测

### 2. 懒加载

- 区域配置按需加载
- 格式化工具延迟初始化
- UI 组件懒加载

### 3. 批量操作

```typescript
// 批量格式化
const formatMultiple = async (values: number[]) => {
  const promises = values.map(v => formatCurrency(v));
  return await Promise.all(promises);
};
```

## 🐛 调试和故障排除

### 1. 常见问题

**Q: 系统检测不准确怎么办？**
A: 可以手动设置区域偏好，系统检测仅作为初始建议。

**Q: 格式化结果不符合预期？**
A: 检查区域偏好设置，确认时区、货币、格式配置是否正确。

**Q: 性能问题？**
A: 检查缓存设置，避免频繁的格式化调用。

### 2. 调试工具

```typescript
// 启用调试模式
import { FormatCache } from '../services/regionService';

// 查看缓存统计
console.log('Cache stats:', FormatCache.getStats());

// 清理缓存
FormatCache.clear();
```

### 3. 日志记录

系统会自动记录重要操作和错误：
- 区域检测结果
- 格式化错误
- 缓存命中率
- 性能统计

## 🔒 安全考虑

### 1. 数据验证

所有用户输入都经过验证：
- 区域代码格式验证
- 时区有效性检查
- 货币代码验证
- 数值范围检查

### 2. 注入防护

- SQL 注入防护（使用参数化查询）
- XSS 防护（输出转义）
- CSRF 防护（命令验证）

### 3. 权限控制

- 用户只能修改自己的偏好设置
- 系统配置需要管理员权限
- 敏感操作需要确认

## 📈 监控和统计

### 1. 使用统计

系统自动收集以下统计信息：
- 格式化调用次数
- 区域配置使用频率
- 缓存命中率
- 错误发生率

### 2. 性能指标

- 格式化平均耗时
- 数据库查询性能
- 内存使用情况
- 缓存效率

## 🔄 维护和升级

### 1. 数据库迁移

系统支持自动数据库迁移，新版本会自动升级数据库结构。

### 2. 配置更新

区域配置可以通过以下方式更新：
- 应用更新时自动更新
- 手动缓存刷新
- API 同步更新

### 3. 版本兼容性

系统向后兼容，旧版本的配置会自动迁移到新格式。

## 🤝 贡献指南

### 1. 添加新区域支持

1. 在 `build_default_region_configs()` 中添加配置
2. 更新 `SUPPORTED_LOCALES` 常量
3. 添加相应的测试用例
4. 更新文档

### 2. 扩展格式化功能

1. 在 `RegionFormatter` 中添加新方法
2. 更新 Tauri 命令接口
3. 添加前端 Hook 支持
4. 更新 UI 组件

### 3. 性能优化

1. 分析性能瓶颈
2. 优化缓存策略
3. 减少不必要的计算
4. 提交性能测试报告

## 📚 相关文档

- [国际化标准 (ISO 639-1)](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
- [时区数据库 (IANA)](https://www.iana.org/time-zones)
- [货币代码标准 (ISO 4217)](https://en.wikipedia.org/wiki/ISO_4217)
- [Unicode 本地化数据](http://cldr.unicode.org/)

## 📄 许可证

本项目采用 Apache 2.0 许可证。详见 `LICENSE` 文件。

---

**文档维护者**: 开发团队  
**最后更新**: 2025-10-19  
**下次审查**: 2025-11-19
