/**
 * 个人资料统计组件
 * @module features/user/components
 */

'use client';

import { FileText, Package, Users, Heart, Star, Eye } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import type { UserStats } from '../types';

interface ProfileStatsProps {
  stats: UserStats;
  onStatsClick?: (type: string) => void;
}

export function ProfileStats({ stats, onStatsClick }: ProfileStatsProps) {
  const statsItems = [
    {
      label: '帖子',
      value: stats.postsCount,
      icon: FileText,
      type: 'posts',
      color: 'text-blue-500',
    },
    {
      label: '适配器',
      value: stats.adaptersCount,
      icon: Package,
      type: 'adapters',
      color: 'text-purple-500',
    },
    {
      label: '粉丝',
      value: stats.followersCount,
      icon: Users,
      type: 'followers',
      color: 'text-green-500',
    },
    {
      label: '获赞',
      value: stats.likesCount,
      icon: Heart,
      type: 'likes',
      color: 'text-red-500',
    },
    {
      label: '收藏',
      value: stats.favoritesCount,
      icon: Star,
      type: 'favorites',
      color: 'text-yellow-500',
    },
    {
      label: '浏览',
      value: stats.viewsCount,
      icon: Eye,
      type: 'views',
      color: 'text-gray-500',
    },
  ];

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Card className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {statsItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              onClick={() => onStatsClick?.(item.type)}
              className="flex flex-col items-center gap-2 group cursor-pointer hover:scale-105 transition-transform"
            >
              <div className={`${item.color} group-hover:opacity-80 transition-opacity`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(item.value)}</div>
                <div className="text-sm text-muted-foreground">{item.label}</div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

