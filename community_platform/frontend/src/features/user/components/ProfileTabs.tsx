/**
 * 个人资料标签页组件
 * @module features/user/components
 */

'use client';

import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { FileText, Package, Bot, Heart, Star, Activity } from 'lucide-react';

interface ProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showActivity?: boolean;
}

export function ProfileTabs({ activeTab, onTabChange, showActivity = true }: ProfileTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
        <TabsTrigger value="posts" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">帖子</span>
        </TabsTrigger>
        <TabsTrigger value="adapters" className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">技能包</span>
        </TabsTrigger>
        <TabsTrigger value="characters" className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">角色</span>
        </TabsTrigger>
        <TabsTrigger value="likes" className="flex items-center gap-2">
          <Heart className="h-4 w-4" />
          <span className="hidden sm:inline">点赞</span>
        </TabsTrigger>
        <TabsTrigger value="favorites" className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          <span className="hidden sm:inline">收藏</span>
        </TabsTrigger>
        {showActivity && (
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">动态</span>
          </TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  );
}

