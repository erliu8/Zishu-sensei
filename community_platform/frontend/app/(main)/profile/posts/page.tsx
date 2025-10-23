/**
 * 我的帖子页面
 * @route /profile/posts
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Plus } from 'lucide-react';

export default function MyPostsPage() {
  const router = useRouter();
  const [posts] = useState([]); // TODO: 从API获取帖子列表

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">我的帖子</h1>
            <p className="text-muted-foreground mt-2">管理你发布的所有帖子</p>
          </div>
          <Button onClick={() => router.push('/posts/create')}>
            <Plus className="h-4 w-4 mr-2" />
            创建帖子
          </Button>
        </div>

        {/* 帖子列表 */}
        {posts.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="暂无帖子"
              description="你还没有发布任何帖子"
              action={{
                label: '创建第一篇帖子',
                onClick: () => router.push('/posts/create'),
              }}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {/* TODO: 渲染帖子列表 */}
          </div>
        )}
      </div>
    </div>
  );
}

