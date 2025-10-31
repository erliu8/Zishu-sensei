'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

/**
 * 404 页面
 */
export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6 px-4">
        {/* 404 大号文字 */}
        <div className="space-y-2">
          <h1 className="text-9xl font-bold text-primary">404</h1>
          <h2 className="text-3xl font-semibold text-foreground">页面未找到</h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            抱歉，您访问的页面不存在或已被移除。
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button variant="outline" size="lg" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回上一页
          </Button>
          <Button asChild size="lg">
            <Link href="/" className="inline-flex items-center justify-center gap-2">
              <Home className="h-4 w-4" />
              返回首页
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

