# 监控与分析系统

完整的前端监控解决方案，包括错误监控、性能监控、用户行为分析和自定义日志系统。

## 功能特性

### 1. Sentry 错误监控
- ✅ 自动错误捕获和上报
- ✅ 性能监控和追踪
- ✅ Session Replay
- ✅ 用户反馈
- ✅ 面包屑追踪
- ✅ 自定义上下文和标签

### 2. Google Analytics
- ✅ 页面浏览跟踪
- ✅ 自定义事件跟踪
- ✅ 用户属性设置
- ✅ 预定义事件跟踪器
- ✅ 自定义维度支持

### 3. Web Vitals 性能监控
- ✅ Core Web Vitals (LCP, FID, CLS)
- ✅ 其他性能指标 (TTFB, FCP, INP)
- ✅ 自动评级 (good/needs-improvement/poor)
- ✅ 性能报告生成
- ✅ 资源加载监控
- ✅ 长任务监控

### 4. 自定义日志系统
- ✅ 多级别日志 (DEBUG, INFO, WARN, ERROR, FATAL)
- ✅ 本地持久化 (localStorage)
- ✅ 远程日志上传
- ✅ 批量日志处理
- ✅ 日志导出 (JSON/TXT)
- ✅ 日志筛选和查询

## 快速开始

### 1. 环境变量配置

在 `.env.local` 中添加以下配置：

```bash
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_ENV=production

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# 日志远程上传（可选）
NEXT_PUBLIC_LOG_ENDPOINT=https://your-api.com/logs
```

### 2. 在应用中集成

在 `app/layout.tsx` 或 `pages/_app.tsx` 中添加 MonitoringProvider：

```tsx
import { MonitoringProvider, getMonitoringConfig } from '@/infrastructure/monitoring';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const monitoringConfig = getMonitoringConfig();

  return (
    <html lang="zh-CN">
      <body>
        <MonitoringProvider config={monitoringConfig}>
          {children}
        </MonitoringProvider>
      </body>
    </html>
  );
}
```

### 3. 设置用户信息

```tsx
import { setSentryUser, setAnalyticsUserId } from '@/infrastructure/monitoring';

// 用户登录后
setSentryUser({
  id: user.id,
  email: user.email,
  username: user.username,
});
setAnalyticsUserId(user.id);

// 用户登出后
setSentryUser(null);
setAnalyticsUserId(null);
```

### 4. Next.js Web Vitals 集成

在 `app/layout.tsx` 中添加：

```tsx
import { reportWebVitals } from '@/infrastructure/monitoring';

export { reportWebVitals };
```

## 使用示例

### Sentry 错误监控

```tsx
import { captureException, captureMessage, addBreadcrumb } from '@/infrastructure/monitoring';

try {
  // 危险操作
  riskyOperation();
} catch (error) {
  // 捕获异常
  captureException(error as Error, {
    extra: { userId: user.id, action: 'riskyOperation' }
  });
}

// 记录信息
captureMessage('重要操作完成', 'info', {
  userId: user.id,
  timestamp: Date.now(),
});

// 添加面包屑
addBreadcrumb({
  message: '用户点击了提交按钮',
  level: 'info',
  category: 'user-action',
  data: { formId: 'create-post' }
});
```

### Google Analytics 事件跟踪

```tsx
import { Analytics } from '@/infrastructure/monitoring';

// 跟踪用户登录
Analytics.user.login('email');

// 跟踪帖子浏览
Analytics.post.view(postId);

// 跟踪适配器下载
Analytics.adapter.download(adapterId, version);

// 跟踪角色创建
Analytics.character.create(characterId);

// 跟踪搜索
Analytics.search.perform(query, resultCount);
```

### 自定义事件跟踪

```tsx
import { trackEvent } from '@/infrastructure/monitoring';

trackEvent('custom_event', {
  category: 'engagement',
  label: 'button_click',
  value: 1,
  custom_param: 'custom_value',
});
```

### 日志系统

```tsx
import { logger } from '@/infrastructure/monitoring';

// 调试日志
logger.debug('调试信息', { data: debugData });

// 信息日志
logger.info('用户登录成功', { userId: user.id });

// 警告日志
logger.warn('API 响应缓慢', { endpoint: '/api/posts', duration: 3000 });

// 错误日志
logger.error('请求失败', error, { endpoint: '/api/posts' });

// 致命错误日志
logger.fatal('系统崩溃', error, { reason: 'out_of_memory' });
```

### 日志管理

```tsx
import { getLogger } from '@/infrastructure/monitoring';

const logger = getLogger();

// 获取所有日志
const logs = logger.getLogs();

// 按级别获取日志
const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);

// 按标签获取日志
const apiLogs = logger.getLogsByTag('api');

// 按时间范围获取日志
const recentLogs = logger.getLogsByTimeRange(
  Date.now() - 3600000, // 1小时前
  Date.now()
);

// 导出日志
logger.download('json'); // 下载 JSON 格式
logger.download('txt');  // 下载文本格式

// 清空日志
logger.clear();
```

### 性能监控

```tsx
import { startTransaction, withTransaction } from '@/infrastructure/monitoring';

// 手动性能追踪
const transaction = startTransaction({
  name: 'fetch-posts',
  op: 'http.client',
  tags: { api: 'posts' }
});

try {
  await fetchPosts();
  transaction.finish();
} catch (error) {
  transaction.setStatus('internal_error');
  transaction.finish();
  throw error;
}

// 使用装饰器
await withTransaction('fetch-posts', 'http.client', async () => {
  return await fetchPosts();
});
```

### 错误边界

```tsx
import { SentryErrorBoundary } from '@/infrastructure/monitoring';

export default function MyApp({ Component, pageProps }) {
  return (
    <SentryErrorBoundary
      fallback={({ error, resetError }) => (
        <div>
          <h1>出错了</h1>
          <p>{error.message}</p>
          <button onClick={resetError}>重试</button>
        </div>
      )}
      showDialog={true}
    >
      <Component {...pageProps} />
    </SentryErrorBoundary>
  );
}
```

## 高级配置

### 自定义监控配置

```tsx
import { createMonitoringConfig, MonitoringProvider } from '@/infrastructure/monitoring';

const customConfig = createMonitoringConfig({
  sentry: {
    dsn: 'your-custom-dsn',
    environment: 'staging',
    tracesSampleRate: 0.5,
  },
  analytics: {
    measurementId: 'G-CUSTOM',
    enabled: true,
    debug: true,
  },
  webVitals: {
    enabled: true,
    reportToConsole: true,
  },
  logger: {
    level: LogLevel.DEBUG,
    enableRemote: true,
    remoteEndpoint: 'https://api.example.com/logs',
  },
});

<MonitoringProvider config={customConfig}>
  {children}
</MonitoringProvider>
```

### 自定义日志上报

```tsx
import { initLogger, LogLevel } from '@/infrastructure/monitoring';

const logger = initLogger({
  level: LogLevel.INFO,
  enableConsole: true,
  enablePersistence: true,
  maxLogSize: 2000,
  enableRemote: true,
  remoteEndpoint: 'https://api.example.com/logs',
  batchSize: 100,
  batchInterval: 60000, // 1分钟
});

// 立即上传所有日志
await logger.flush();
```

### 过滤敏感信息

在 `sentry.ts` 中自定义 `beforeSend`：

```typescript
beforeSend(event, hint) {
  // 移除敏感数据
  if (event.request?.cookies) {
    delete event.request.cookies;
  }
  
  if (event.user?.email) {
    event.user.email = '[Filtered]';
  }
  
  return event;
}
```

## API 参考

### Sentry

```typescript
// 初始化
initSentry(config: SentryConfig): void

// 设置用户
setSentryUser(user: { id: string; email?: string; username?: string } | null): void

// 设置标签
setTag(key: string, value: string): void

// 设置上下文
setContext(name: string, context: Record<string, any>): void

// 添加面包屑
addBreadcrumb(breadcrumb: {
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  category?: string;
  data?: Record<string, any>;
}): void

// 捕获异常
captureException(error: Error, context?: Record<string, any>): string

// 捕获消息
captureMessage(message: string, level?: string, context?: Record<string, any>): string
```

### Analytics

```typescript
// 初始化
initAnalytics(config: AnalyticsConfig): void

// 跟踪页面浏览
trackPageView(params?: PageViewParams): void

// 跟踪事件
trackEvent(eventName: string, params?: EventParams): void

// 设置用户属性
setUserProperties(properties: UserProperties): void

// 设置用户 ID
setAnalyticsUserId(userId: string | null): void
```

### Logger

```typescript
// 初始化
initLogger(config?: Partial<LoggerConfig>): Logger

// 获取实例
getLogger(): Logger

// 日志方法
logger.debug(message: string, context?: Record<string, any>, tags?: string[]): void
logger.info(message: string, context?: Record<string, any>, tags?: string[]): void
logger.warn(message: string, context?: Record<string, any>, tags?: string[]): void
logger.error(message: string, error?: Error, context?: Record<string, any>, tags?: string[]): void
logger.fatal(message: string, error?: Error, context?: Record<string, any>, tags?: string[]): void

// 日志管理
getLogs(): LogEntry[]
getLogsByLevel(level: LogLevel): LogEntry[]
getLogsByTag(tag: string): LogEntry[]
clear(): void
download(format: 'json' | 'txt'): void
flush(): Promise<void>
```

## 性能优化

1. **代码分割**: 监控库使用动态导入，不影响初始加载
2. **采样率**: 生产环境建议设置合适的采样率
3. **批量上传**: 日志系统支持批量上传，减少网络请求
4. **本地缓存**: 日志持久化到 localStorage，离线也能记录

## 注意事项

1. **隐私保护**: 
   - 不要记录敏感信息（密码、令牌等）
   - 使用 Sentry 的数据脱敏功能
   - 遵守 GDPR 等隐私法规

2. **性能影响**: 
   - 适当设置采样率
   - 避免过度日志记录
   - 定期清理本地日志

3. **错误处理**: 
   - 监控系统本身的错误不应影响应用
   - 所有监控操作都包含错误处理

4. **环境区分**: 
   - 开发环境启用详细日志
   - 生产环境适当限制日志级别

## 故障排除

### Sentry 未上报错误

1. 检查 DSN 是否正确
2. 检查 `enabled` 配置
3. 检查网络连接
4. 查看浏览器控制台是否有错误

### Analytics 未跟踪事件

1. 检查 Measurement ID 是否正确
2. 检查浏览器是否启用了广告拦截器
3. 使用 GA Debug 模式查看事件
4. 检查控制台是否有警告

### 日志未持久化

1. 检查浏览器 localStorage 配额
2. 检查 `enablePersistence` 配置
3. 查看控制台错误信息

## 相关资源

- [Sentry 文档](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Google Analytics 文档](https://developers.google.com/analytics/devguides/collection/ga4)
- [Web Vitals 文档](https://web.dev/vitals/)
- [Next.js 监控文档](https://nextjs.org/docs/advanced-features/measuring-performance)

## 更新日志

### v1.0.0 (2025-10-23)

- ✅ Sentry 集成
- ✅ Google Analytics 集成  
- ✅ Web Vitals 监控
- ✅ 自定义日志系统
- ✅ 统一 Provider 组件
- ✅ 完整文档和示例

