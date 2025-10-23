/**
 * 我的角色页面
 * @route /profile/characters
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Plus } from 'lucide-react';

export default function MyCharactersPage() {
  const router = useRouter();
  const [characters] = useState([]); // TODO: 从API获取角色列表

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">我的角色</h1>
            <p className="text-muted-foreground mt-2">管理你创建的所有角色</p>
          </div>
          <Button onClick={() => router.push('/characters/create')}>
            <Plus className="h-4 w-4 mr-2" />
            创建角色
          </Button>
        </div>

        {/* 角色列表 */}
        {characters.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="暂无角色"
              description="你还没有创建任何角色"
              action={{
                label: '创建第一个角色',
                onClick: () => router.push('/characters/create'),
              }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* TODO: 渲染角色卡片 */}
          </div>
        )}
      </div>
    </div>
  );
}

