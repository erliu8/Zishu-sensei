// Zishu Community Platform - Service Worker
// Version: 2.0.0

const CACHE_VERSION = 'v2';
const CACHE_NAME = `zishu-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `zishu-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `zishu-images-${CACHE_VERSION}`;
const API_CACHE = `zishu-api-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

// 缓存过期时间（毫秒）
const CACHE_EXPIRATION = {
  images: 30 * 24 * 60 * 60 * 1000, // 30 天
  api: 5 * 60 * 1000, // 5 分钟
  runtime: 24 * 60 * 60 * 1000, // 1 天
};

// 缓存大小限制
const CACHE_SIZE_LIMITS = {
  images: 50, // 最多 50 张图片
  api: 100, // 最多 100 个 API 响应
  runtime: 50, // 最多 50 个运行时资源
};

// 需要预缓存的资源
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// 需要缓存的资源类型
const CACHEABLE_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

// API 路径模式（可以缓存的 API）
const CACHEABLE_API_PATTERNS = [
  '/api/posts',
  '/api/adapters',
  '/api/characters',
  '/api/users',
];

// 安装事件 - 预缓存资源
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_URLS).catch((error) => {
        console.error('[SW] Precache failed:', error);
        // 即使预缓存失败也继续安装
        return Promise.resolve();
      });
    }).then(() => {
      // 立即激活新的 Service Worker
      return self.skipWaiting();
    })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE, API_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // 删除不在当前版本列表中的所有缓存
            return !currentCaches.includes(cacheName);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      // 立即控制所有客户端
      return self.clients.claim();
    })
  );
});

// 请求拦截 - 缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 忽略非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 忽略 Chrome 扩展和其他协议
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // API 请求 - Stale-While-Revalidate 策略
  if (url.pathname.startsWith('/api/')) {
    const isCacheableAPI = CACHEABLE_API_PATTERNS.some((pattern) =>
      url.pathname.startsWith(pattern)
    );

    if (isCacheableAPI) {
      event.respondWith(
        staleWhileRevalidate(request, API_CACHE, CACHE_EXPIRATION.api)
      );
    } else {
      // 不可缓存的 API - 仅网络
      event.respondWith(
        fetch(request).catch(() => {
          return new Response(
            JSON.stringify({ error: 'Network error', offline: true }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            }
          );
        })
      );
    }
    return;
  }

  // HTML 页面 - 网络优先，失败则返回离线页面
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, RUNTIME_CACHE).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // 图片资源 - 缓存优先策略
  if (isImageRequest(url)) {
    event.respondWith(
      cacheFirst(request, IMAGE_CACHE, CACHE_EXPIRATION.images)
    );
    return;
  }

  // 静态资源（JS, CSS, 字体）- Stale-While-Revalidate
  const isCacheable = CACHEABLE_EXTENSIONS.some((ext) =>
    url.pathname.endsWith(ext)
  );

  if (isCacheable) {
    event.respondWith(
      staleWhileRevalidate(request, RUNTIME_CACHE, CACHE_EXPIRATION.runtime)
    );
    return;
  }

  // 其他请求 - 网络优先
  event.respondWith(
    networkFirst(request, RUNTIME_CACHE)
  );
});

// 消息处理
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urls);
      })
    );
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  const options = {
    body: 'You have new updates!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: '查看详情',
      },
      {
        action: 'close',
        title: '关闭',
      },
    ],
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || options.body;
      options.icon = data.icon || options.icon;
      options.data = { ...options.data, ...data };
    } catch (error) {
      console.error('[SW] Push data parse error:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Zishu 社区平台', options)
  );
});

// 通知点击
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

// 后台同步
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// 同步数据函数
async function syncData() {
  try {
    console.log('[SW] Syncing data...');
    
    // 获取待同步的数据
    const dbRequest = indexedDB.open('zishu-offline-db', 1);
    
    return new Promise((resolve, reject) => {
      dbRequest.onsuccess = async () => {
        const db = dbRequest.result;
        
        if (!db.objectStoreNames.contains('pending-actions')) {
          resolve();
          return;
        }
        
        const transaction = db.transaction(['pending-actions'], 'readonly');
        const store = transaction.objectStore('pending-actions');
        const request = store.getAll();
        
        request.onsuccess = async () => {
          const pendingActions = request.result;
          
          if (pendingActions.length === 0) {
            resolve();
            return;
          }
          
          // 同步每个待处理的操作
          for (const action of pendingActions) {
            try {
              const response = await fetch(action.url, {
                method: action.method,
                headers: action.headers,
                body: action.body,
              });
              
              if (response.ok) {
                // 删除已同步的操作
                const deleteTransaction = db.transaction(['pending-actions'], 'readwrite');
                const deleteStore = deleteTransaction.objectStore('pending-actions');
                deleteStore.delete(action.id);
              }
            } catch (error) {
              console.error('[SW] Failed to sync action:', error);
            }
          }
          
          resolve();
        };
        
        request.onerror = () => reject(request.error);
      };
      
      dbRequest.onerror = () => reject(dbRequest.error);
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    return Promise.reject(error);
  }
}

// ============ 缓存策略辅助函数 ============

// 网络优先策略
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// 缓存优先策略
async function cacheFirst(request, cacheName, maxAge) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // 检查缓存是否过期
    const cachedTime = new Date(cachedResponse.headers.get('sw-cache-time') || 0);
    const now = Date.now();
    
    if (now - cachedTime.getTime() < maxAge) {
      return cachedResponse;
    }
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = response.clone();
      
      // 添加缓存时间戳
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', new Date().toISOString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, modifiedResponse);
      
      // 清理过期缓存
      await trimCache(cacheName, CACHE_SIZE_LIMITS[cacheName.split('-')[1]]);
    }
    
    return response;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale-While-Revalidate 策略
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = response.clone();
      
      // 添加缓存时间戳
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', new Date().toISOString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, modifiedResponse);
      
      // 清理过期缓存
      await trimCache(cacheName, CACHE_SIZE_LIMITS[cacheName.split('-')[1]]);
    }
    return response;
  }).catch((error) => {
    console.error('[SW] Fetch failed:', error);
    return cachedResponse;
  });
  
  // 如果有缓存且未过期，立即返回缓存，同时后台更新
  if (cachedResponse) {
    const cachedTime = new Date(cachedResponse.headers.get('sw-cache-time') || 0);
    const now = Date.now();
    
    if (now - cachedTime.getTime() < maxAge) {
      return cachedResponse;
    }
  }
  
  // 否则等待网络响应
  return fetchPromise;
}

// 清理缓存（限制大小）
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxItems) {
      // 删除最旧的缓存项
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (error) {
    console.error('[SW] Trim cache failed:', error);
  }
}

// 检查是否是图片请求
function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/i.test(url.pathname);
}

// 初始化 IndexedDB
function initIndexedDB() {
  const dbRequest = indexedDB.open('zishu-offline-db', 1);
  
  dbRequest.onupgradeneeded = (event) => {
    const db = event.target.result;
    
    // 创建存储待同步操作的对象存储
    if (!db.objectStoreNames.contains('pending-actions')) {
      const store = db.createObjectStore('pending-actions', { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }
    
    // 创建存储离线数据的对象存储
    if (!db.objectStoreNames.contains('offline-cache')) {
      const store = db.createObjectStore('offline-cache', { keyPath: 'key' });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }
  };
  
  dbRequest.onsuccess = () => {
    console.log('[SW] IndexedDB initialized');
  };
  
  dbRequest.onerror = () => {
    console.error('[SW] IndexedDB init failed:', dbRequest.error);
  };
}

// 初始化
initIndexedDB();

console.log('[SW] Service Worker loaded - v2.0.0');

