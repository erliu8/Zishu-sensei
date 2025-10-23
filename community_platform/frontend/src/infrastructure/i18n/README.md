# 国际化 (i18n) 模块

本模块提供完整的国际化支持,包括多语言翻译、日期/数字格式化、语言切换等功能。

## 📁 目录结构

```
i18n/
├── components/          # i18n 相关组件
│   ├── LanguageSwitcher.tsx  # 语言切换组件
│   └── index.ts
├── hooks/              # i18n Hooks
│   ├── useI18n.ts      # 基础 i18n Hook
│   ├── useTranslation.ts    # 翻译 Hook
│   └── index.ts
├── locales/            # 翻译文件
│   ├── zh-CN/          # 简体中文
│   ├── en-US/          # 英文
│   └── ja-JP/          # 日文
├── utils/              # 工具函数
│   ├── dateFormatter.ts     # 日期格式化
│   └── numberFormatter.ts   # 数字格式化
├── scripts/            # 辅助脚本
│   └── validateTranslations.ts  # 翻译文件验证
├── config.ts           # 配置文件
├── types.ts            # 类型定义
├── utils.ts            # 通用工具
├── I18nProvider.tsx    # i18n Provider
└── index.ts            # 模块导出
```

## 🌍 支持的语言

- `zh-CN` - 简体中文 (默认)
- `en-US` - English
- `ja-JP` - 日本語

## 🚀 快速开始

### 1. 使用 i18n Provider

```tsx
import { I18nProvider } from '@/infrastructure/i18n';

function App() {
  return (
    <I18nProvider>
      <YourApp />
    </I18nProvider>
  );
}
```

### 2. 使用翻译 Hook

```tsx
import { useTranslation } from '@/infrastructure/i18n';

function MyComponent() {
  const { t } = useTranslation('common');
  
  return (
    <div>
      <h1>{t('app.name')}</h1>
      <p>{t('app.description')}</p>
      <button>{t('actions.submit')}</button>
    </div>
  );
}
```

### 3. 带参数的翻译

```tsx
const { t } = useTranslation('common');

// 使用参数
t('time.minutesAgo', { count: 5 });  // "5 分钟前"
t('pagination.showing', { start: 1, end: 10, total: 100 });  // "显示 1 - 10 条，共 100 条"
```

### 4. 使用语言切换组件

```tsx
import { LanguageSwitcher } from '@/infrastructure/i18n';

function Header() {
  return (
    <header>
      {/* 下拉菜单形式 */}
      <LanguageSwitcher variant="dropdown" />
      
      {/* 内联按钮形式 */}
      <LanguageSwitcher variant="inline" showFlag showName />
      
      {/* 模态框形式 */}
      <LanguageSwitcher variant="modal" />
    </header>
  );
}
```

## 📅 日期格式化

```tsx
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  getFriendlyDate,
} from '@/infrastructure/i18n';

// 格式化日期
formatDate(new Date(), { locale: 'zh-CN', dateStyle: 'long' });
// "2025年10月23日"

// 格式化日期时间
formatDateTime(new Date());
// "2025年10月23日 14:30"

// 相对时间
formatRelativeTime(Date.now() - 1000 * 60 * 5);
// "5分钟前"

// 友好的日期显示
getFriendlyDate(new Date());
// "今天"
```

## 🔢 数字格式化

```tsx
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,
  formatCompactNumber,
} from '@/infrastructure/i18n';

// 格式化数字
formatNumber(1234567.89, { locale: 'zh-CN' });
// "1,234,567.89"

// 格式化货币
formatCurrency(1234.56, { locale: 'zh-CN', currency: 'CNY' });
// "¥1,234.56"

// 格式化百分比
formatPercent(0.1234);
// "12.34%"

// 格式化文件大小
formatFileSize(1048576);
// "1 MB"

// 紧凑数字
formatCompactNumber(1234567);
// "1.2M"
```

## 📝 翻译文件结构

每个语言目录下包含以下翻译文件:

- `common.json` - 通用翻译
- `auth.json` - 认证相关
- `user.json` - 用户相关
- `post.json` - 帖子相关
- `adapter.json` - 适配器相关
- `character.json` - 角色相关
- `comment.json` - 评论相关
- `social.json` - 社交相关
- `settings.json` - 设置相关
- `error.json` - 错误信息
- `validation.json` - 验证信息
- `notification.json` - 通知相关
- `packaging.json` - 打包相关
- `profile.json` - 个人资料相关
- `search.json` - 搜索相关

## 🔍 验证翻译文件

运行验证脚本检查所有语言的翻译文件是否完整:

```bash
npm run i18n:validate
```

或者:

```bash
ts-node src/infrastructure/i18n/scripts/validateTranslations.ts
```

## 🛠️ API 参考

### Hooks

#### `useI18n()`

基础 i18n Hook,提供语言切换和翻译功能。

```tsx
const { locale, t, changeLocale, formatMessage } = useI18n();
```

#### `useTranslation(namespace?)`

命名空间翻译 Hook。

```tsx
const { t, locale } = useTranslation('common');
```

### Components

#### `<LanguageSwitcher />`

语言切换组件。

**Props:**
- `variant?: 'dropdown' | 'modal' | 'inline'` - 组件形式
- `showFlag?: boolean` - 是否显示国旗
- `showName?: boolean` - 是否显示语言名称
- `className?: string` - 自定义类名
- `onChange?: (locale: Locale) => void` - 切换语言回调

### 工具函数

#### 日期格式化

- `formatDate(date, options?)` - 格式化日期
- `formatDateTime(date, options?)` - 格式化日期时间
- `formatTime(date, options?)` - 格式化时间
- `formatRelativeTime(date, options?)` - 格式化相对时间
- `formatDateRange(start, end, options?)` - 格式化日期范围
- `getFriendlyDate(date, locale?)` - 获取友好的日期描述

#### 数字格式化

- `formatNumber(value, options?)` - 格式化数字
- `formatCurrency(value, options?)` - 格式化货币
- `formatPercent(value, options?)` - 格式化百分比
- `formatFileSize(bytes, options?)` - 格式化文件大小
- `formatCompactNumber(value, options?)` - 格式化紧凑数字
- `formatOrdinal(value, locale?)` - 格式化序数
- `formatRange(start, end, options?)` - 格式化范围
- `abbreviateNumber(value)` - 缩写大数字
- `formatDuration(seconds, locale?)` - 格式化持续时间

## 🌐 中间件

i18n 中间件会自动处理语言路由:

1. 检测用户语言偏好 (Cookie > Accept-Language > 默认语言)
2. 重定向到带语言前缀的路径 (如: `/zh-CN/posts`)
3. 保存语言设置到 Cookie

## 🎨 最佳实践

1. **使用命名空间**: 使用 `useTranslation` 时指定命名空间以提高性能
2. **避免硬编码文本**: 所有用户可见的文本都应该使用翻译
3. **使用参数化翻译**: 对于动态内容,使用参数而不是字符串拼接
4. **保持翻译文件同步**: 添加新的翻译键时,确保在所有语言中都添加
5. **定期验证**: 使用验证脚本检查翻译文件的完整性

## 📚 添加新的翻译

1. 在 `locales/zh-CN/` 中添加新的翻译键
2. 在 `locales/en-US/` 和 `locales/ja-JP/` 中添加对应的翻译
3. 运行验证脚本确保所有语言都包含新的键
4. 更新类型定义 (如果需要)

## 🔧 配置

在 `config.ts` 中可以配置:

- 默认语言
- 支持的语言列表
- 语言信息 (名称、标志等)
- Cookie 设置
- 浏览器语言检测

## 📄 许可证

MIT

