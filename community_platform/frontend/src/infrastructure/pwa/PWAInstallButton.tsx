'use client'

import { Download } from 'lucide-react'
import { usePWA } from './usePWA'

interface PWAInstallButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * PWA 安装按钮组件
 * 可以放置在设置页面或其他需要的地方
 */
export default function PWAInstallButton({
  variant = 'default',
  size = 'md',
  className = '',
}: PWAInstallButtonProps) {
  const { canInstall, isInstalled, install } = usePWA()

  if (!canInstall || isInstalled) {
    return null
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const variantClasses = {
    default: 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200',
    outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50 dark:hover:bg-gray-900',
    ghost: 'bg-transparent text-gray-900 hover:bg-gray-100 dark:text-gray-50 dark:hover:bg-gray-900',
  }

  return (
    <button
      onClick={() => install()}
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-colors ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      <Download className="h-4 w-4" />
      安装应用
    </button>
  )
}

