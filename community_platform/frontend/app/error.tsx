'use client'

import { useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 记录错误到错误报告服务
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md mx-auto text-center space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-destructive">出错了</h1>
          <p className="text-muted-foreground">
            很抱歉，页面遇到了一个错误
          </p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-left">
          <p className="font-medium text-destructive mb-2">错误详情：</p>
          <code className="text-xs text-muted-foreground">
            {error.message || '未知错误'}
          </code>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-2">
              错误ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={reset}
            variant="default"
          >
            重试
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
          >
            返回首页
          </Button>
        </div>
      </div>
    </div>
  )
}
