'use client'

import { useState } from 'react'
import { Bell, BellOff, Download, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { usePWA } from './usePWA'
import { usePushNotification } from './usePushNotification'

interface PWASettingsProps {
  vapidPublicKey?: string
}

/**
 * PWA 设置面板组件
 * 提供 PWA 相关功能的设置界面
 */
export default function PWASettings({ vapidPublicKey }: PWASettingsProps) {
  const {
    isInstalled,
    isOnline,
    canInstall,
    registration,
    install,
    unregister,
    clearCache,
  } = usePWA()

  const {
    permission,
    subscription,
    isSupported: isPushSupported,
    requestPermission,
    subscribe,
    unsubscribe,
    testNotification,
  } = usePushNotification(vapidPublicKey)

  const [isClearing, setIsClearing] = useState(false)

  const handleClearCache = async () => {
    if (!confirm('确定要清除所有缓存吗？这将删除所有离线数据。')) {
      return
    }

    setIsClearing(true)
    try {
      await clearCache()
      alert('缓存已清除')
    } catch (error) {
      alert('清除缓存失败')
    } finally {
      setIsClearing(false)
    }
  }

  const handleUnregister = async () => {
    if (!confirm('确定要卸载 Service Worker 吗？这将禁用离线功能。')) {
      return
    }

    try {
      await unregister()
      alert('Service Worker 已卸载，页面将刷新')
      window.location.reload()
    } catch (error) {
      alert('卸载失败')
    }
  }

  const handleTogglePush = async () => {
    if (subscription) {
      // 取消订阅
      const success = await unsubscribe()
      if (success) {
        alert('已关闭推送通知')
      }
    } else {
      // 订阅
      if (permission !== 'granted') {
        const newPermission = await requestPermission()
        if (newPermission !== 'granted') {
          alert('需要通知权限才能启用推送通知')
          return
        }
      }

      const newSubscription = await subscribe()
      if (newSubscription) {
        alert('已开启推送通知')
      } else {
        alert('订阅失败')
      }
    }
  }

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      const newPermission = await requestPermission()
      if (newPermission !== 'granted') {
        alert('需要通知权限才能发送测试通知')
        return
      }
    }

    const notification = await testNotification()
    if (!notification) {
      alert('发送测试通知失败')
    }
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
          PWA 设置
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          管理应用安装、缓存和通知设置
        </p>
      </div>

      {/* 状态卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 安装状态 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${isInstalled ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-900'}`}>
              <Download className={`h-5 w-5 ${isInstalled ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                应用安装
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {isInstalled ? '已安装' : '未安装'}
              </div>
            </div>
          </div>
        </div>

        {/* 网络状态 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${isOnline ? 'bg-green-100 dark:bg-green-900/20' : 'bg-yellow-100 dark:bg-yellow-900/20'}`}>
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <WifiOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                网络状态
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {isOnline ? '在线' : '离线'}
              </div>
            </div>
          </div>
        </div>

        {/* 推送通知 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${subscription ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-900'}`}>
              {subscription ? (
                <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <BellOff className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                推送通知
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {subscription ? '已启用' : '未启用'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 操作区域 */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        <h3 className="font-medium text-gray-900 dark:text-gray-50">操作</h3>

        <div className="space-y-3">
          {/* 安装应用 */}
          {canInstall && !isInstalled && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  安装应用
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  安装到主屏幕，快速访问
                </div>
              </div>
              <button
                onClick={() => install()}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                安装
              </button>
            </div>
          )}

          {/* 推送通知 */}
          {isPushSupported && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    推送通知
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    接收新消息和更新提醒
                  </div>
                </div>
                <button
                  onClick={handleTogglePush}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    subscription
                      ? 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-700'
                      : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
                  }`}
                >
                  {subscription ? '关闭' : '开启'}
                </button>
              </div>

              {subscription && (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                      测试通知
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      发送一条测试通知
                    </div>
                  </div>
                  <button
                    onClick={handleTestNotification}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50 dark:hover:bg-gray-900"
                  >
                    测试
                  </button>
                </div>
              )}
            </>
          )}

          {/* 清除缓存 */}
          {registration && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  清除缓存
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  删除所有离线缓存数据
                </div>
              </div>
              <button
                onClick={handleClearCache}
                disabled={isClearing}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50 dark:hover:bg-gray-900"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    清除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    清除
                  </>
                )}
              </button>
            </div>
          )}

          {/* 卸载 Service Worker */}
          {registration && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-800">
              <div>
                <div className="text-sm font-medium text-red-600 dark:text-red-400">
                  卸载 Service Worker
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  禁用所有 PWA 功能
                </div>
              </div>
              <button
                onClick={handleUnregister}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-gray-950 dark:text-red-400 dark:hover:bg-red-950"
              >
                卸载
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 信息 */}
      {registration && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
            Service Worker 信息
          </h3>
          <dl className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <dt>状态：</dt>
              <dd className="font-mono">
                {registration.active ? '激活' : registration.installing ? '安装中' : '未知'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>作用域：</dt>
              <dd className="font-mono">{registration.scope}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}

