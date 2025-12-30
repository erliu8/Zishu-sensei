/**
 * LatestAdapters - 最新适配器组件
 * 展示最新发布和热门的适配器
 */

'use client';

import { FC } from 'react';
import { Package, Star } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useAdapters } from '@/features/adapter/hooks/useAdapters';
import { AdapterType } from '@/features/adapter/domain';
import { cn } from '@/shared/utils/cn';
import Link from 'next/link';

export interface LatestAdaptersProps {
  className?: string;
}

const adapterTypeConfig = {
  [AdapterType.SOFT]: { label: '软技能包', color: 'bg-blue-500' },
  [AdapterType.HARD]: { label: '硬技能包', color: 'bg-green-500' },
  [AdapterType.INTELLIGENT]: { label: '智能硬技能包', color: 'bg-purple-500' },
};

export const LatestAdapters: FC<LatestAdaptersProps> = ({ className }) => {
  const { data, isLoading, isError, error } = useAdapters({
    page: 1,
    pageSize: 6,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">最新技能包</h2>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/adapters">浏览市场</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : isError ? (
        <EmptyState
          title="加载失败"
          description={error?.message || '无法加载技能包列表，请稍后重试'}
        />
      ) : data?.data && data.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.data.map((adapter) => (
            <Link key={adapter.id} href={`/adapters/${adapter.id}`} className="block">
              <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn(adapterTypeConfig[adapter.type].color, 'text-white')}>
                          {adapterTypeConfig[adapter.type].label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          v{adapter.version || '1.0.0'}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">
                        {adapter.name}
                      </h3>
                    </div>
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {adapter.description}
                  </p>

                  {/* 作者信息 */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={adapter.author?.avatar} alt={adapter.author?.displayName} />
                      <AvatarFallback>{adapter.author?.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {adapter.author?.displayName}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span>{adapter.stats?.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span>{adapter.stats?.downloads?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8">
                    查看详情
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="暂无技能包"
          description="还没有技能包发布，快来上传第一个吧！"
          action={{
            label: '上传技能包',
            onClick: () => window.location.href = '/adapters/upload'
          }}
        />
      )}
    </div>
  );
};

