'use client'

import { useState, useEffect } from 'react'
import { X, Download, Smartphone, Sparkles, Zap, Shield } from 'lucide-react'
import { usePWA } from './usePWA'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'

/**
 * PWA 安装提示组件
 * 增强版：提供更好的用户体验和视觉效果
 */
export default function PWAInstallPrompt() {
  const { canInstall, isInstalled, install } = usePWA()
  const [showPrompt, setShowPrompt] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [dismissCount, setDismissCount] = useState(0)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    // 检查是否已关闭提示
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    const count = parseInt(localStorage.getItem('pwa-install-dismiss-count') || '0', 10)
    setDismissCount(count)

    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10)
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      
      // 根据关闭次数决定再次显示的时间
      // 第1次关闭：3天后
      // 第2次关闭：7天后
      // 第3次及以上：30天后
      let daysToWait = 3
      if (count >= 2) {
        daysToWait = 30
      } else if (count === 1) {
        daysToWait = 7
      }

      if (daysSinceDismissed < daysToWait) {
        setIsDismissed(true)
        return
      }
    }

    // 延迟显示提示（避免打扰用户）
    // 根据用户访问次数调整延迟时间
    const visitCount = parseInt(localStorage.getItem('pwa-visit-count') || '0', 10)
    localStorage.setItem('pwa-visit-count', (visitCount + 1).toString())
    
    // 第一次访问不显示，第2-3次访问10秒后显示，之后30秒后显示
    let delay = 30000
    if (visitCount === 0) {
      return // 第一次访问不显示
    } else if (visitCount <= 2) {
      delay = 10000
    }

    const timer = setTimeout(() => {
      if (canInstall && !isInstalled && !isDismissed) {
        setShowPrompt(true)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [canInstall, isInstalled, isDismissed])

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      const result = await install()
      if (result.outcome === 'accepted') {
        setShowPrompt(false)
        // 清除关闭计数
        localStorage.removeItem('pwa-install-dismiss-count')
        localStorage.removeItem('pwa-install-dismissed')
      }
    } finally {
      setIsInstalling(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    const newCount = dismissCount + 1
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
    localStorage.setItem('pwa-install-dismiss-count', newCount.toString())
  }

  if (!showPrompt) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md sm:left-auto sm:right-4"
      >
        <Card className="shadow-2xl border-2">
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors z-10"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>

          <CardHeader className="pb-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-lg opacity-50 animate-pulse" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
                    <Smartphone className="h-7 w-7 text-white" />
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <span>安装 Zishu 应用</span>
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                </CardTitle>
                <CardDescription>
                  获得更好的体验，随时随地访问
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 特性列表 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/30 p-1">
                  <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-muted-foreground">快速启动，无需浏览器</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex-shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 p-1">
                  <Shield className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-muted-foreground">离线可用，数据安全</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex-shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/30 p-1">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-muted-foreground">桌面通知，不错过更新</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex space-x-2 pt-2">
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex-1 h-10"
                size="default"
              >
                {isInstalling ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    安装中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    立即安装
                  </>
                )}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="outline"
                className="px-4"
                size="default"
              >
                稍后
              </Button>
            </div>

            {/* 提示信息 */}
            <div className="text-xs text-muted-foreground text-center">
              安装后可随时从桌面或应用列表访问
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}

