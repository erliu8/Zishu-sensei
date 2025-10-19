# 国际化 (i18n) 系统

这个项目使用 react-i18next 实现国际化功能，支持中文、英文、日文、韩文四种语言。

## 功能特性

- ✅ **多语言支持**: 支持中文、英文、日文、韩文
- ✅ **懒加载**: 按需加载语言包，提升应用启动速度
- ✅ **智能预加载**: 基于用户行为预测并预加载相关资源
- ✅ **系统语言检测**: 自动检测系统语言并设置为默认语言
- ✅ **动态切换**: 运行时动态切换语言，无需重启应用
- ✅ **本地化工具**: 提供日期、数字、货币等本地化格式化工具
- ✅ **Tauri 集成**: 语言设置持久化存储到本地文件
- ✅ **React Suspense**: 支持 Suspense 模式的异步加载

## 使用方法

### 1. 基础使用

```tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

const MyComponent: React.FC = () => {
  const { t } = useTranslation('common');
  
  return (
    <div>
      <h1>{t('app.name')}</h1>
      <p>{t('app.description')}</p>
    </div>
  );
};
```

### 2. 使用语言选择器

```tsx
import React from 'react';
import { LanguageSelector } from '../components/LanguageSelector';

const SettingsPage: React.FC = () => {
  return (
    <div>
      <h2>语言设置</h2>
      
      {/* 下拉菜单样式 */}
      <LanguageSelector variant="dropdown" />
      
      {/* 按钮样式 */}
      <LanguageSelector variant="buttons" />
      
      {/* 紧凑样式 */}
      <LanguageSelector variant="compact" />
    </div>
  );
};
```

### 3. 使用语言 Hook

```tsx
import React from 'react';
import { useLanguage } from '../hooks/useLanguage';

const LanguageStatus: React.FC = () => {
  const { 
    currentLanguage, 
    changeLanguage, 
    isChanging, 
    error 
  } = useLanguage();
  
  const handleLanguageChange = async () => {
    try {
      await changeLanguage('en');
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  };
  
  return (
    <div>
      <p>当前语言: {currentLanguage}</p>
      <button 
        onClick={handleLanguageChange}
        disabled={isChanging}
      >
        切换到英文
      </button>
      {error && <p>错误: {error}</p>}
    </div>
  );
};
```

### 4. 使用本地化工具

```tsx
import React from 'react';
import { 
  formatNumber, 
  formatCurrency, 
  formatDate, 
  formatRelativeTime 
} from '../utils/localization';

const LocalizedContent: React.FC = () => {
  const now = new Date();
  const price = 1234.56;
  
  return (
    <div>
      <p>数字: {formatNumber(price)}</p>
      <p>货币: {formatCurrency(price)}</p>
      <p>日期: {formatDate(now)}</p>
      <p>相对时间: {formatRelativeTime(now)}</p>
    </div>
  );
};
```

### 5. 使用 I18n Provider

```tsx
import React from 'react';
import { I18nProvider } from '../components/I18nProvider';
import App from './App';

const Root: React.FC = () => {
  return (
    <I18nProvider 
      requiredNamespaces={['common', 'chat', 'settings']}
      preloadLanguages={['zh', 'en']}
    >
      <App />
    </I18nProvider>
  );
};
```

## 语言包结构

```
src/locales/
├── index.ts          # 主配置文件
├── zh/              # 中文语言包
│   ├── common.json  # 通用翻译
│   ├── chat.json    # 聊天相关
│   └── settings.json # 设置相关
├── en/              # 英文语言包
├── ja/              # 日文语言包
└── ko/              # 韩文语言包
```

## 添加新的翻译

### 1. 添加到语言包文件

在对应的 JSON 文件中添加新的键值对：

```json
// src/locales/zh/common.json
{
  "newFeature": {
    "title": "新功能",
    "description": "这是一个新功能的描述"
  }
}
```

### 2. 在组件中使用

```tsx
const { t } = useTranslation('common');
return <h1>{t('newFeature.title')}</h1>;
```

## 支持的语言

| 语言代码 | 语言名称 | 本地名称 |
|---------|---------|---------|
| zh      | Chinese | 中文     |
| en      | English | English |
| ja      | Japanese| 日本語   |
| ko      | Korean  | 한국어   |

## 配置选项

### 语言检测配置

```typescript
const languageDetectorOptions = {
  order: ['localStorage', 'navigator', 'htmlTag'],
  caches: ['localStorage'],
  lookupLocalStorage: 'zishu-language',
  excludeCacheFor: ['cimode'],
  checkWhitelist: true
};
```

### 懒加载配置

```typescript
// 预加载常用语言
const preloadLanguages = ['zh', 'en'];

// 预加载常用命名空间
const requiredNamespaces = ['common', 'chat'];
```

## 性能优化

### 1. 懒加载

语言包采用懒加载机制，只在需要时加载：

```typescript
// 自动加载当前语言的资源
await loadLanguageResources('zh', ['common', 'chat']);

// 智能预加载相关资源
await smartPreload('zh');
```

### 2. 缓存管理

系统会自动缓存已加载的语言包，并定期清理未使用的资源：

```typescript
// 启动缓存清理（每5分钟）
startCacheCleanup(300000);

// 手动清理缓存
clearLanguageCache('zh', 'common');
```

### 3. 预加载策略

基于用户行为智能预加载：

```typescript
await smartPreload('zh', {
  frequentNamespaces: ['common', 'chat'],
  fallbackLanguages: ['en']
});
```

## 故障排除

### 1. 翻译键缺失

开发环境下会在控制台显示警告：

```
Missing translation key: zh:common:some.missing.key
```

### 2. 语言加载失败

检查语言文件是否存在，路径是否正确：

```
Failed to load zh/common.json, falling back to default
```

### 3. 性能问题

使用缓存统计信息监控性能：

```typescript
const stats = getCacheStats();
console.log('Cache stats:', stats);
```

## 最佳实践

1. **命名规范**: 使用层级结构组织翻译键
2. **懒加载**: 只加载当前页面需要的命名空间
3. **预加载**: 预加载用户可能访问的页面资源
4. **回退机制**: 始终提供英文作为回退语言
5. **性能监控**: 定期检查缓存使用情况
6. **用户体验**: 使用 Suspense 提供加载状态反馈

## API 参考

详细的 API 文档请参考各个模块的 TypeScript 类型定义。
