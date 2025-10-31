/**
 * TrendingCharacters - 热门角色组件
 * 展示平台热门和推荐的角色
 */

'use client';

import { FC } from 'react';
import { Users, Heart, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useTrendingCharacters } from '@/features/character/hooks/use-characters';
import { cn } from '@/shared/utils/cn';
import Link from 'next/link';
import Image from 'next/image';

export interface TrendingCharactersProps {
  className?: string;
}

export const TrendingCharacters: FC<TrendingCharactersProps> = ({ className }) => {
  const { data, isLoading, isError, error } = useTrendingCharacters(6);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">热门角色</h2>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/characters">探索更多</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : isError ? (
        <EmptyState
          title="加载失败"
          description={error?.message || '无法加载角色列表，请稍后重试'}
        />
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((character) => (
            <Link key={character.id} href={`/characters/${character.id}`} className="block">
              <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer h-full overflow-hidden">
                {/* 角色头像/封面 */}
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                  {character.avatarUrl ? (
                    <Image
                      src={character.avatarUrl}
                      alt={character.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Users className="h-20 w-20 text-muted-foreground/50" />
                    </div>
                  )}
                  {character.visibility === 'public' && (
                    <div className="absolute top-4 right-4">
                      <Badge variant="secondary">公开</Badge>
                    </div>
                  )}
                </div>

                <CardContent className="pt-4">
                  {/* 角色名称 */}
                  <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1 mb-2">
                    {character.name}
                  </h3>

                  {/* 角色描述 */}
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {character.description || '暂无描述'}
                  </p>

                  {/* 作者信息 */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src="" alt={character.creatorName || 'Unknown'} />
                      <AvatarFallback>{character.creatorName?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {character.creatorName}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      <span>{character.stats?.likes?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      <span>{character.stats?.downloads?.toLocaleString() || 0}</span>
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
          title="暂无角色"
          description="还没有角色发布，快来创建第一个吧！"
          action={{
            label: '创建角色',
            onClick: () => window.location.href = '/characters/create'
          }}
        />
      )}
    </div>
  );
};

