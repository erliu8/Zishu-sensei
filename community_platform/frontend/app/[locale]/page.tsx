/**
 * 国际化首页
 * 根据语言参数渲染对应的首页内容
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isValidLocale } from '@/infrastructure/i18n/config';
import { FeaturedSection, TrendingPosts, LatestAdapters, TrendingCharacters } from '@/features/home/components';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Separator } from '@/shared/components/ui/separator';

export interface LocaleHomePageProps {
  params: Promise<{ locale: string }>;
}

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
    image: '/images/default-avatar.png',
    type: 'character' as const,
    link: '/characters/3',
  },
];

/**
 * 国际化首页组件
 */
export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const { locale } = await params;
  
  // 验证语言参数
  if (!isValidLocale(locale)) {
    notFound();
  }

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

/**
 * 生成静态参数
 */
export async function generateStaticParams() {
  return [
    { locale: 'zh-CN' },
    { locale: 'en-US' },
    { locale: 'ja-JP' },
  ];
}
