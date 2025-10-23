# PWA 设置指南

## 概述

本指南介绍如何设置和配置 Zishu 社区平台的 PWA（渐进式 Web 应用）功能。

## 功能特性

### ✅ 已实现的功能

1. **Service Worker 优化**
   - 多层缓存策略（Runtime、API、Image）
   - Stale-While-Revalidate 策略
   - 缓存大小和过期时间管理
   - 智能缓存清理

2. **离线支持**
   - 离线页面
   - 离线指示器
   - 离线数据同步
   - 待同步操作队列

3. **推送通知**
   - VAPID 推送订阅
   - 本地通知
   - 通知权限管理
   - 通知类型配置

4. **安装提示**
   - 智能安装提示（基于访问次数）
   - 优雅的关闭策略
   - 安装进度显示

5. **PWA 配置**
   - 完整的 manifest.json
   - Apple Touch 图标
   - 启动画面（iOS）
   - Maskable 图标
   - 快捷方式

## 快速开始

### 1. 环境配置

确保在 `.env.local` 中配置以下环境变量：

```env
# PWA 配置
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key

# 应用信息
NEXT_PUBLIC_APP_NAME=Zishu 社区平台
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 2. 生成 PWA 图标

```bash
# 准备一个 512x512 的源图标
cp your-icon.png public/icon-source.png

# 生成所有 PWA 图标
npm run pwa:icons

# 生成启动画面（可选）
npm run pwa:splash
```

### 3. 在应用中启用 PWA

在根布局文件中添加 PWA 组件：

```tsx
// app/layout.tsx
import PWAManager from '@/infrastructure/pwa/PWAManager'
import PWAHead from '@/shared/components/common/PWAHead'
import OfflineIndicator from '@/shared/components/common/OfflineIndicator'

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <PWAHead />
      </head>
      <body>
        {children}
        <PWAManager />
        <OfflineIndicator />
      </body>
    </html>
  )
}
```

## 组件使用

### PWAManager

主 PWA 管理器，自动处理 Service Worker 注册和状态管理。

```tsx
<PWAManager
  enableInstallPrompt={true}
  enableUpdatePrompt={true}
  enableNetworkStatus={true}
/>
```

### OfflineIndicator

显示离线/在线状态的指示器。

```tsx
import OfflineIndicator, { OfflineBadge } from '@/shared/components/common/OfflineIndicator'

// 全屏通知
<OfflineIndicator />

// 简洁徽章（导航栏）
<OfflineBadge />
```

### OfflineSyncManager

管理离线数据同步。

```tsx
import OfflineSyncManager from '@/infrastructure/pwa/OfflineSyncManager'

<OfflineSyncManager
  showPanel={true}
  showNotifications={true}
/>
```

### PushNotificationManager

推送通知管理界面。

```tsx
import PushNotificationManager from '@/infrastructure/pwa/PushNotificationManager'

<PushNotificationManager
  vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
  showTestButton={true}
/>
```

## Hooks 使用

### usePWA

主 PWA Hook，提供所有 PWA 相关功能。

```tsx
import { usePWA } from '@/infrastructure/pwa/usePWA'

function MyComponent() {
  const {
    isInstalled,
    isUpdateAvailable,
    isOnline,
    canInstall,
    registration,
    install,
    update,
    cacheURLs,
    clearCache,
  } = usePWA()

  return (
    <div>
      {canInstall && (
        <button onClick={install}>安装应用</button>
      )}
      {isUpdateAvailable && (
        <button onClick={update}>更新应用</button>
      )}
    </div>
  )
}
```

### useOfflineSync

离线数据同步 Hook。

```tsx
import { useOfflineSync } from '@/infrastructure/pwa/useOfflineSync'

function MyComponent() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    addPendingAction,
    sync,
  } = useOfflineSync()

  const handleSubmit = async (data) => {
    if (!isOnline) {
      // 添加到同步队列
      await addPendingAction({
        url: '/api/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      // 直接发送
      await fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }
  }

  return (
    <div>
      <p>待同步: {pendingCount}</p>
      <button onClick={handleSubmit}>提交</button>
    </div>
  )
}
```

### usePushNotification

推送通知 Hook。

```tsx
import { usePushNotification } from '@/infrastructure/pwa/usePushNotification'

function MyComponent() {
  const {
    permission,
    subscription,
    requestPermission,
    subscribe,
    sendLocalNotification,
  } = usePushNotification(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)

  const handleEnableNotifications = async () => {
    const perm = await requestPermission()
    if (perm === 'granted') {
      await subscribe()
    }
  }

  return (
    <button onClick={handleEnableNotifications}>
      启用通知
    </button>
  )
}
```

## 离线 API 客户端

使用离线支持的 API 客户端，自动处理离线情况。

```tsx
import { offlineApi } from '@/infrastructure/pwa/offlineApiClient'

async function createPost(data) {
  // 在线时直接发送，离线时加入队列
  const result = await offlineApi.post('/api/posts', data)
  
  if (result.queued) {
    // 操作已加入队列，将在网络恢复后同步
    console.log('操作已排队，稍后同步')
  }
  
  return result
}
```

## Service Worker 配置

Service Worker 位于 `public/sw.js`，包含以下缓存策略：

### 缓存策略

1. **网络优先**（Network First）
   - 用于：HTML 页面
   - 失败时使用缓存

2. **缓存优先**（Cache First）
   - 用于：图片资源
   - 有缓存过期时间

3. **Stale-While-Revalidate**
   - 用于：JS、CSS、字体、API
   - 立即返回缓存，后台更新

### 缓存配置

```javascript
// Service Worker 配置
const CACHE_EXPIRATION = {
  images: 30 * 24 * 60 * 60 * 1000, // 30 天
  api: 5 * 60 * 1000, // 5 分钟
  runtime: 24 * 60 * 60 * 1000, // 1 天
}

const CACHE_SIZE_LIMITS = {
  images: 50,
  api: 100,
  runtime: 50,
}
```

## Manifest 配置

`public/manifest.json` 包含完整的 PWA 配置：

```json
{
  "name": "Zishu 社区平台",
  "short_name": "Zishu",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [...],
  "shortcuts": [...],
  "share_target": {...}
}
```

## 测试 PWA

### 本地测试

1. 构建生产版本：
   ```bash
   npm run build
   npm run start
   ```

2. 在 Chrome 中打开应用：
   - 打开开发者工具
   - 切换到 Application 标签
   - 检查 Manifest、Service Workers、Cache Storage

3. 测试离线功能：
   - 在 Network 标签中选择 "Offline"
   - 刷新页面，应该能看到离线页面或缓存内容

### Lighthouse 审计

```bash
npm run perf:lighthouse
```

检查 PWA 评分，目标：
- Performance: ≥ 90
- Accessibility: ≥ 90
- Best Practices: ≥ 90
- SEO: ≥ 90
- PWA: 100

## 部署注意事项

### 1. HTTPS 要求

PWA 需要 HTTPS，确保生产环境使用 HTTPS。

### 2. Service Worker 更新

Service Worker 更新需要用户刷新或重新访问。可以提示用户更新：

```tsx
const { isUpdateAvailable, update } = usePWA()

{isUpdateAvailable && (
  <div>
    <p>有新版本可用</p>
    <button onClick={update}>更新</button>
  </div>
)}
```

### 3. 缓存策略

根据应用需求调整缓存策略和过期时间。

### 4. 推送通知后端

需要实现推送通知后端 API：

- `POST /api/push/subscribe` - 保存订阅
- `POST /api/push/unsubscribe` - 删除订阅
- 推送服务器配置 VAPID 密钥

## 故障排查

### Service Worker 未注册

1. 检查浏览器是否支持 Service Worker
2. 确保使用 HTTPS 或 localhost
3. 检查控制台错误信息

### 离线功能不工作

1. 检查 Service Worker 是否激活
2. 查看 Cache Storage 是否有缓存
3. 确认网络请求被 Service Worker 拦截

### 推送通知不工作

1. 检查通知权限是否授予
2. 确认 VAPID 公钥配置正确
3. 检查推送订阅是否成功

### 安装提示不显示

1. 确认浏览器支持（Chrome、Edge）
2. 检查 manifest.json 配置
3. 确保应用通过 PWA 检查清单

## 相关资源

- [PWA 文档](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

## 更新日志

- **v2.0.0** (2025-10-23)
  - 优化 Service Worker 缓存策略
  - 添加离线数据同步
  - 增强推送通知功能
  - 优化安装提示
  - 添加启动画面支持

- **v1.0.0** (2025-10-01)
  - 初始 PWA 实现
  - 基础 Service Worker
  - Manifest 配置

