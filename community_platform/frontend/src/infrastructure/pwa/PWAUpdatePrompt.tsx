'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePWA } from './usePWA'

/**
 * PWA 更新提示组件
 */
export default function PWAUpdatePrompt() {
  const { isUpdateAvailable, update } = usePWA()
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (isUpdateAvailable) {
      setShowPrompt(true)
    }
  }, [isUpdateAvailable])

  const handleUpdate = () => {
    update()
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
  }

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom sm:left-auto sm:right-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-900 dark:bg-blue-950/50">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-50">
                发现新版本
              </h3>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                有新版本可用，更新以获得最佳体验
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                立即更新
              </button>
              <button
                onClick={handleDismiss}
                className="inline-flex items-center rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              >
                稍后
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

