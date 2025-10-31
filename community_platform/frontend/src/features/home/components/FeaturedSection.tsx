/**
 * FeaturedSection - 推荐内容区域组件
 * 展示平台推荐的精选内容
 */

'use client';

import React, { FC } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { HydrationSafeImage } from '@/shared/components/ui/hydration-safe-image';
import { cn } from '@/shared/utils/cn';

export interface FeaturedItem {
  id: string;
  title: string;
  description: string;
  image: string;
  type: 'post' | 'adapter' | 'character';
  link: string;
  badge?: string;
}

export interface FeaturedSectionProps {
  items: FeaturedItem[];
  className?: string;
}

const typeConfig = {
  post: { label: '精选帖子', color: 'bg-blue-500' },
  adapter: { label: '推荐适配器', color: 'bg-green-500' },
  character: { label: '热门角色', color: 'bg-purple-500' },
};

export const FeaturedSection: FC<FeaturedSectionProps> = ({ items, className }) => {
  if (!items || items.length === 0) return null;

  const mainItem = items[0]!; // 确保 mainItem 不为 undefined
  const sideItems = items.slice(1, 3);

  return (
    <div className={cn('space-y-4', className)}>
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-yellow-500" />
        <h2 className="text-2xl font-bold">精选推荐</h2>
      </div>

      {/* 主推荐 + 副推荐 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 主推荐 */}
        <Link href={mainItem.link} className="lg:col-span-2 block group">
          <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
            <div className="relative h-64 lg:h-80">
              <HydrationSafeImage
                src={mainItem.image}
                alt={mainItem.title}
                width={800}
                height={320}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              {/* 内容叠加层 */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn(typeConfig[mainItem.type].color, 'text-white')}>
                    {typeConfig[mainItem.type].label}
                  </Badge>
                  {mainItem.badge && (
                    <Badge variant="secondary">{mainItem.badge}</Badge>
                  )}
                </div>
                <h3 className="text-2xl font-bold mb-2 group-hover:text-yellow-400 transition-colors">
                  {mainItem.title}
                </h3>
                <p className="text-white/90 line-clamp-2">
                  {mainItem.description}
                </p>
              </div>
            </div>
          </Card>
        </Link>

        {/* 副推荐 */}
        <div className="space-y-4">
          {sideItems.map((item) => (
            <Link key={item.id} href={item.link} className="block group">
              <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
                <div className="relative h-32 lg:h-36">
                  <HydrationSafeImage
                    src={item.image}
                    alt={item.title}
                    width={400}
                    height={144}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    sizes="50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <Badge className={cn(typeConfig[item.type].color, 'text-white mb-2')}>
                      {typeConfig[item.type].label}
                    </Badge>
                    <h4 className="font-semibold line-clamp-2 group-hover:text-yellow-400 transition-colors">
                      {item.title}
                    </h4>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

