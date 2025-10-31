/**
 * 我的适配器页面
 * @route /profile/adapters
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Upload } from 'lucide-react';

export default function MyAdaptersPage() {
  const router = useRouter();
  const [adapters] = useState([]); // TODO: 从API获取适配器列表

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">我的适配器</h1>
            <p className="text-muted-foreground mt-2">管理你上传的所有适配器</p>
          </div>
          <Button onClick={() => router.push('/adapters/upload')}>
            <Upload className="h-4 w-4 mr-2" />
            上传适配器
          </Button>
        </div>

        {/* 适配器列表 */}
        {adapters.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="暂无适配器"
              description="你还没有上传任何适配器"
              action={{
                label: '上传第一个适配器',
                onClick: () => router.push('/adapters/upload'),
              }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* TODO: 渲染适配器卡片 */}
          </div>
        )}
      </div>
    </div>
  );
}

