/**
 * 首页 - Zishu 社区平台
 * 展示精选内容、热门帖子、最新适配器和热门角色
 */

import { Suspense } from 'react';
import { FeaturedSection, TrendingPosts, LatestAdapters, TrendingCharacters } from '@/features/home/components';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Separator } from '@/shared/components/ui/separator';

// 示例精选内容数据（实际应该从API获取）
const featuredItems = [
  {
    id: '1',
    title: 'Zishu AI 社区平台正式上线',
    description: '一个全新的AI角色社区平台，让你轻松创建、分享和探索AI角色',
    image: '/images/featured/main.jpg',
    type: 'post' as const,
    link: '/posts/1',
    badge: '置顶',
  },
  {
    id: '2',
    title: '智能对话适配器 v2.0',
    description: '全新升级的对话适配器，支持多轮对话和上下文理解',
    image: '/images/featured/adapter.jpg',
    type: 'adapter' as const,
    link: '/adapters/2',
  },
  {
    id: '3',
    title: '小艾 - 智能助手角色',
    description: '温柔贴心的AI助手，随时为你提供帮助',
    image: '/images/featured/character.jpg',
    type: 'character' as const,
    link: '/characters/3',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* 主内容容器 */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 精选推荐区 */}
        <section className="mb-12">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <FeaturedSection items={featuredItems} />
          </Suspense>
        </section>

        <Separator className="my-12" />

        {/* 热门帖子区 */}
        <section className="mb-12">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <TrendingPosts />
          </Suspense>
        </section>

        <Separator className="my-12" />

        {/* 最新适配器区 */}
        <section className="mb-12">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <LatestAdapters />
          </Suspense>
        </section>

        <Separator className="my-12" />

        {/* 热门角色区 */}
        <section className="mb-12">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <TrendingCharacters />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
