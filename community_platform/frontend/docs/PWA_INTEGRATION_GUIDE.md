# PWA 集成指南

本指南提供详细的步骤来在您的项目中集成和使用 PWA 功能。

## 目录

1. [前置准备](#前置准备)
2. [基础集成](#基础集成)
3. [高级配置](#高级配置)
4. [推送通知设置](#推送通知设置)
5. [测试和调试](#测试和调试)
6. [生产部署](#生产部署)

## 前置准备

### 1. 检查依赖

确保已安装所有必需的依赖：

```bash
npm install
```

### 2. 准备图标

准备一个 512x512 像素的 PNG 图标作为源图标：

```bash
# 将图标保存为 public/source-icon.png
# 然后运行图标生成脚本
npm run pwa:icons
```

如果没有自定义图标，脚本会自动生成占位图标。

## 基础集成

### 步骤 1: 配置环境变量

复制并编辑 `.env.example`:

```bash
cp .env.example .env.local
```

基本 PWA 功能不需要额外的环境变量，但如果要使用推送通知，需要配置 VAPID 密钥。

### 步骤 2: 在布局中添加 PWA Manager

在主布局文件中添加 PWA Manager 组件：

```tsx
// src/app/(main)/layout.tsx
import PWAManager from '@/infrastructure/pwa/PWAManager'

export default function MainLayout({ children }) {
  return (
    <>
      <PWAManager
        enableInstallPrompt={true}
        enableUpdatePrompt={true}
        enableNetworkStatus={true}
      />
      {children}
    </>
  )
}
```

### 步骤 3: 添加 Metadata

确保在布局中添加 PWA 相关的 metadata：

```tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  manifest: '/manifest.json',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Zishu',
  },
}
```

### 步骤 4: 验证基础功能

启动开发服务器：

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000`，然后：

1. 打开 DevTools > Application > Service Workers
2. 确认 Service Worker 已注册
3. 查看 Manifest 是否正确加载
4. 检查缓存策略是否工作

## 高级配置

### 自定义 Manifest

编辑 `public/manifest.json` 来自定义应用信息：

```json
{
  "name": "您的应用名称",
  "short_name": "应用简称",
  "description": "应用描述",
  "theme_color": "#您的主题色",
  "background_color": "#您的背景色",
  "start_url": "/",
  "display": "standalone"
}
```

### 自定义缓存策略

编辑 `public/sw.js`:

```javascript
// 修改缓存版本（每次更新时递增）
const CACHE_VERSION = 'v2';

// 添加需要预缓存的资源
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/your-important-page',
];

// 添加需要缓存的文件类型
const CACHEABLE_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.svg',
];
```

### 添加安装按钮

在导航栏或设置中添加安装按钮：

```tsx
import PWAInstallButton from '@/infrastructure/pwa/PWAInstallButton'

function Header() {
  return (
    <header>
      <PWAInstallButton variant="outline" size="md" />
    </header>
  )
}
```

### 创建设置页面

使用 PWASettings 组件创建完整的设置页面：

```tsx
// src/app/(main)/settings/pwa/page.tsx
import PWASettings from '@/infrastructure/pwa/PWASettings'

export default function PWASettingsPage() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <PWASettings />
    </div>
  )
}
```

## 推送通知设置

### 1. 生成 VAPID 密钥

首先安装 web-push：

```bash
npm install -g web-push
```

生成密钥对：

```bash
web-push generate-vapid-keys
```

### 2. 配置环境变量

将生成的密钥添加到 `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="你的公钥"
VAPID_PRIVATE_KEY="你的私钥"
```

### 3. 创建推送 API 端点

创建订阅端点：

```typescript
// src/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const subscription = await request.json()
  
  // 将订阅信息保存到数据库
  // await saveSubscription(subscription)
  
  return NextResponse.json({ success: true })
}
```

创建取消订阅端点：

```typescript
// src/app/api/push/unsubscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const subscription = await request.json()
  
  // 从数据库删除订阅
  // await deleteSubscription(subscription)
  
  return NextResponse.json({ success: true })
}
```

### 4. 使用推送通知

在组件中使用推送通知 Hook：

```tsx
import { usePushNotification } from '@/infrastructure/pwa'

function NotificationSettings() {
  const {
    permission,
    subscription,
    requestPermission,
    subscribe,
    testNotification,
  } = usePushNotification(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)

  const handleEnable = async () => {
    const perm = await requestPermission()
    if (perm === 'granted') {
      await subscribe()
    }
  }

  return (
    <div>
      <button onClick={handleEnable}>启用通知</button>
      {subscription && (
        <button onClick={testNotification}>测试通知</button>
      )}
    </div>
  )
}
```

## 测试和调试

### Chrome DevTools 调试

1. **Service Worker 调试**
   - 打开 DevTools > Application > Service Workers
   - 勾选 "Update on reload" (开发时)
   - 勾选 "Bypass for network" (测试网络优先)
   - 点击 "Unregister" 卸载 SW (清理时)

2. **缓存检查**
   - Application > Cache Storage
   - 查看缓存的资源
   - 手动删除缓存进行测试

3. **Manifest 验证**
   - Application > Manifest
   - 检查所有字段是否正确
   - 验证图标是否加载

### 离线测试

测试离线功能：

```bash
# 方法 1: DevTools
# Network > Offline 复选框

# 方法 2: Service Worker
# Application > Service Workers > Offline 复选框

# 方法 3: 系统
# 实际断开网络连接
```

### 安装测试

测试应用安装：

1. 使用 HTTPS 或 localhost
2. 确保 manifest.json 正确
3. 等待浏览器显示安装提示
4. 或手动触发（地址栏的安装图标）

### Lighthouse 审计

运行 PWA 审计：

```bash
npm run perf:lighthouse
```

或在 DevTools 中：
- Lighthouse > Progressive Web App
- 生成报告
- 查看 PWA 评分和建议

## 生产部署

### 部署前检查清单

- [ ] 所有图标已生成且大小正确
- [ ] manifest.json 配置完整
- [ ] Service Worker 正常工作
- [ ] 离线页面可访问
- [ ] HTTPS 已配置（必需）
- [ ] 缓存策略合理
- [ ] PWA Lighthouse 评分 > 90
- [ ] 在多个设备/浏览器测试
- [ ] 推送通知配置正确（如使用）

### 部署步骤

1. **构建生产版本**

```bash
npm run build
```

2. **验证构建产物**

检查 `.next` 目录：
- `public/sw.js` 是否存在
- `public/manifest.json` 是否存在
- `public/icons/` 所有图标是否存在

3. **配置 HTTPS**

PWA 在生产环境必须使用 HTTPS（localhost 除外）。

使用 Vercel/Netlify 等平台会自动配置 HTTPS。

如果自己部署，使用 Let's Encrypt：

```bash
# 使用 certbot
sudo certbot --nginx -d yourdomain.com
```

4. **配置 CDN 缓存**

```nginx
# Nginx 示例
location /sw.js {
    add_header Cache-Control "public, max-age=0, must-revalidate";
}

location /manifest.json {
    add_header Cache-Control "public, max-age=0, must-revalidate";
}

location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|webp|avif)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

5. **部署**

```bash
# 使用 Vercel
vercel --prod

# 或使用 Docker
docker build -t zishu-community .
docker run -p 3000:3000 zishu-community

# 或直接运行
npm run start
```

### 验证部署

部署后验证：

1. 访问您的域名
2. 检查 Service Worker 是否注册
3. 测试离线功能
4. 尝试安装到主屏幕
5. 运行 Lighthouse 审计
6. 在不同设备上测试

### 监控

设置监控来跟踪：

- Service Worker 注册成功率
- 缓存命中率
- 安装转化率
- 推送通知送达率
- 错误日志

## 常见问题排查

### Service Worker 不更新

```javascript
// 在 sw.js 中增加版本号
const CACHE_VERSION = 'v2'; // 从 v1 改为 v2
```

### 安装提示不显示

检查：
1. 是否使用 HTTPS
2. manifest.json 是否正确
3. 是否满足 PWA 安装条件
4. 用户是否已拒绝过

### 离线功能不工作

检查：
1. Service Worker 是否激活
2. 资源是否被缓存
3. 缓存策略是否正确
4. 查看 Console 错误

### 推送通知失败

检查：
1. 通知权限是否授予
2. VAPID 密钥是否正确
3. 订阅是否成功
4. 后端推送服务是否正常

## 进阶主题

### 后台同步

实现离线数据同步：

```javascript
// 在 sw.js 中
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts())
  }
})

// 在客户端触发
navigator.serviceWorker.ready.then((registration) => {
  registration.sync.register('sync-posts')
})
```

### 自定义缓存策略

使用 Workbox 实现更复杂的缓存策略：

```bash
npm install workbox-webpack-plugin
```

### App Shortcuts

在 manifest.json 中自定义快捷方式：

```json
{
  "shortcuts": [
    {
      "name": "新建帖子",
      "url": "/posts/create",
      "icons": [{"src": "/icons/shortcut-post.png", "sizes": "96x96"}]
    }
  ]
}
```

### Share Target

允许应用接收分享内容：

```json
{
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

## 资源链接

- [PWA 文档](./README_PWA.md)
- [Next.js PWA 指南](https://nextjs.org/docs/advanced-features/progressive-web-apps)
- [Web.dev PWA](https://web.dev/progressive-web-apps/)
- [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 支持

如有问题，请查看：
- [常见问题](./README_PWA.md#常见问题)
- [GitHub Issues](https://github.com/your-repo/issues)
- [讨论区](https://github.com/your-repo/discussions)

