'use client'

import { useState, useEffect, useCallback } from 'react'

interface PendingAction {
  id?: number
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  timestamp: number
}

/**
 * 离线数据同步 Hook
 * 管理离线时的操作队列和同步
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // 打开 IndexedDB
  const openDB = useCallback((): Promise<IDBDatabase> => {
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
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }, [])

  // 添加待同步操作
  const addPendingAction = useCallback(
    async (action: Omit<PendingAction, 'id' | 'timestamp'>) => {
      try {
        const db = await openDB()
        const transaction = db.transaction(['pending-actions'], 'readwrite')
        const store = transaction.objectStore('pending-actions')

        const actionWithTimestamp: Omit<PendingAction, 'id'> = {
          ...action,
          timestamp: Date.now(),
        }

        return new Promise<number>((resolve, reject) => {
          const request = store.add(actionWithTimestamp)

          request.onsuccess = () => {
            console.log('[OfflineSync] Action added:', request.result)
            updatePendingCount()
            resolve(request.result as number)
          }

          request.onerror = () => reject(request.error)
        })
      } catch (error) {
        console.error('[OfflineSync] Failed to add action:', error)
        throw error
      }
    },
    [openDB]
  )

  // 获取待同步操作数量
  const updatePendingCount = useCallback(async () => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['pending-actions'], 'readonly')
      const store = transaction.objectStore('pending-actions')

      return new Promise<void>((resolve, reject) => {
        const request = store.count()

        request.onsuccess = () => {
          setPendingCount(request.result)
          resolve()
        }

        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('[OfflineSync] Failed to update count:', error)
    }
  }, [openDB])

  // 执行同步
  const sync = useCallback(async () => {
    if (!isOnline || isSyncing) {
      return
    }

    setIsSyncing(true)

    try {
      const db = await openDB()
      const transaction = db.transaction(['pending-actions'], 'readonly')
      const store = transaction.objectStore('pending-actions')

      const actions = await new Promise<PendingAction[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      console.log(`[OfflineSync] Syncing ${actions.length} actions...`)

      // 同步每个操作
      for (const action of actions) {
        try {
          const response = await fetch(action.url, {
            method: action.method,
            headers: action.headers,
            body: action.body,
          })

          if (response.ok) {
            // 删除已同步的操作
            const deleteTransaction = db.transaction(
              ['pending-actions'],
              'readwrite'
            )
            const deleteStore = deleteTransaction.objectStore('pending-actions')

            await new Promise<void>((resolve, reject) => {
              const request = deleteStore.delete(action.id!)
              request.onsuccess = () => resolve()
              request.onerror = () => reject(request.error)
            })

            console.log('[OfflineSync] Action synced:', action.id)
          } else {
            console.warn('[OfflineSync] Action sync failed:', action.id, response.status)
          }
        } catch (error) {
          console.error('[OfflineSync] Failed to sync action:', action.id, error)
          // 继续同步其他操作
        }
      }

      await updatePendingCount()
      setLastSyncTime(new Date())
      console.log('[OfflineSync] Sync completed')
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing, openDB, updatePendingCount])

  // 清空待同步队列
  const clearPending = useCallback(async () => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['pending-actions'], 'readwrite')
      const store = transaction.objectStore('pending-actions')

      await new Promise<void>((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      await updatePendingCount()
      console.log('[OfflineSync] Pending actions cleared')
    } catch (error) {
      console.error('[OfflineSync] Failed to clear:', error)
    }
  }, [openDB, updatePendingCount])

  // 监听网络状态
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      console.log('[OfflineSync] Online')
      setIsOnline(true)
      // 网络恢复时自动同步
      setTimeout(() => sync(), 1000)
    }

    const handleOffline = () => {
      console.log('[OfflineSync] Offline')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  // 初始化时更新待同步数量
  useEffect(() => {
    updatePendingCount()
  }, [updatePendingCount])

  // 定期检查待同步操作
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && pendingCount > 0 && !isSyncing) {
        sync()
      }
    }, 60000) // 每分钟检查一次

    return () => clearInterval(interval)
  }, [isOnline, pendingCount, isSyncing, sync])

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    addPendingAction,
    sync,
    clearPending,
  }
}

