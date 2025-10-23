/**
 * 离线 API 客户端装饰器
 * 自动处理离线情况，将请求加入同步队列
 */

interface OfflineRequestConfig {
  url: string
  method: string
  headers?: Record<string, string>
  body?: any
}

/**
 * 打开 IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('zishu-offline-db', 1)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('pending-actions')) {
        const store = db.createObjectStore('pending-actions', {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }

      if (!db.objectStoreNames.contains('offline-cache')) {
        const store = db.createObjectStore('offline-cache', { keyPath: 'key' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * 保存到离线缓存
 */
async function saveToOfflineCache(key: string, data: any): Promise<void> {
  try {
    const db = await openDB()
    const transaction = db.transaction(['offline-cache'], 'readwrite')
    const store = transaction.objectStore('offline-cache')

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        key,
        data,
        timestamp: Date.now(),
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    console.log('[OfflineAPI] Data cached:', key)
  } catch (error) {
    console.error('[OfflineAPI] Failed to cache data:', error)
  }
}

/**
 * 从离线缓存读取
 */
async function getFromOfflineCache(key: string): Promise<any | null> {
  try {
    const db = await openDB()
    const transaction = db.transaction(['offline-cache'], 'readonly')
    const store = transaction.objectStore('offline-cache')

    return new Promise<any | null>((resolve, reject) => {
      const request = store.get(key)

      request.onsuccess = () => {
        if (request.result) {
          console.log('[OfflineAPI] Data found in cache:', key)
          resolve(request.result.data)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('[OfflineAPI] Failed to get cached data:', error)
    return null
  }
}

/**
 * 添加到待同步队列
 */
async function addToPendingQueue(config: OfflineRequestConfig): Promise<void> {
  try {
    const db = await openDB()
    const transaction = db.transaction(['pending-actions'], 'readwrite')
    const store = transaction.objectStore('pending-actions')

    const bodyString =
      typeof config.body === 'string'
        ? config.body
        : JSON.stringify(config.body)

    await new Promise<void>((resolve, reject) => {
      const request = store.add({
        url: config.url,
        method: config.method,
        headers: config.headers || {},
        body: bodyString,
        timestamp: Date.now(),
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    console.log('[OfflineAPI] Request queued:', config.method, config.url)
  } catch (error) {
    console.error('[OfflineAPI] Failed to queue request:', error)
    throw error
  }
}

/**
 * 离线 Fetch 包装器
 * 自动处理离线情况
 */
export async function offlineFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method || 'GET'
  const isOnline = navigator.onLine

  // 在线时正常发送请求
  if (isOnline) {
    try {
      const response = await fetch(url, options)

      // GET 请求成功时缓存响应
      if (method === 'GET' && response.ok) {
        const clone = response.clone()
        const data = await clone.json()
        await saveToOfflineCache(url, data)
      }

      return response
    } catch (error) {
      console.warn('[OfflineAPI] Fetch failed, falling back to cache:', error)
      // 网络错误时尝试使用缓存
      if (method === 'GET') {
        const cachedData = await getFromOfflineCache(url)
        if (cachedData) {
          return new Response(JSON.stringify(cachedData), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-From-Cache': 'true',
            },
          })
        }
      }
      throw error
    }
  }

  // 离线处理
  console.log('[OfflineAPI] Offline mode detected')

  // GET 请求尝试使用缓存
  if (method === 'GET') {
    const cachedData = await getFromOfflineCache(url)
    if (cachedData) {
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-From-Cache': 'true',
          'X-Offline': 'true',
        },
      })
    }

    // 无缓存数据
    return new Response(
      JSON.stringify({
        error: 'Offline and no cached data available',
        offline: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // POST/PUT/DELETE 请求加入同步队列
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const headers: Record<string, string> = {}
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value
        })
      } else {
        Object.assign(headers, options.headers)
      }
    }

    await addToPendingQueue({
      url,
      method,
      headers,
      body: options.body,
    })

    // 返回一个"已接受"的响应
    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        message: 'Request queued for synchronization',
      }),
      {
        status: 202, // Accepted
        headers: {
          'Content-Type': 'application/json',
          'X-Queued': 'true',
        },
      }
    )
  }

  // 其他方法不支持离线
  return new Response(
    JSON.stringify({
      error: 'Method not supported offline',
      offline: true,
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * 创建离线支持的 API 客户端
 */
export function createOfflineApiClient() {
  return {
    get: async (url: string, options?: RequestInit) => {
      const response = await offlineFetch(url, { ...options, method: 'GET' })
      return response.json()
    },

    post: async (url: string, data?: any, options?: RequestInit) => {
      const response = await offlineFetch(url, {
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(data),
      })
      return response.json()
    },

    put: async (url: string, data?: any, options?: RequestInit) => {
      const response = await offlineFetch(url, {
        ...options,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(data),
      })
      return response.json()
    },

    patch: async (url: string, data?: any, options?: RequestInit) => {
      const response = await offlineFetch(url, {
        ...options,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(data),
      })
      return response.json()
    },

    delete: async (url: string, options?: RequestInit) => {
      const response = await offlineFetch(url, {
        ...options,
        method: 'DELETE',
      })
      return response.json()
    },
  }
}

/**
 * 默认导出离线 API 客户端实例
 */
export const offlineApi = createOfflineApiClient()

