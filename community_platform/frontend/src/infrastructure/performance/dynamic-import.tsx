/**
 * 动态导入工具
 * 提供组件懒加载和代码分割功能
 */

import dynamic from 'next/dynamic';
import { ComponentType, ReactNode } from 'react';
import { LoadingSpinner } from '@/shared/components/common/LoadingSpinner';

/**
 * 加载中组件
 */
const DefaultLoadingComponent = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <LoadingSpinner size="lg" />
  </div>
);

/**
 * 错误回退组件
 */
const DefaultErrorComponent = ({ error }: { error: Error }) => (
  <div className="flex flex-col items-center justify-center min-h-[200px] text-destructive">
    <p className="text-lg font-semibold">加载失败</p>
    <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
  </div>
);

/**
 * 动态导入配置选项
 */
export interface DynamicImportOptions {
  /**
   * 自定义加载组件
   */
  loading?: ComponentType;
  /**
   * 是否禁用 SSR
   */
  ssr?: boolean;
  /**
   * 自定义错误组件
   */
  errorComponent?: ComponentType<{ error: Error }>;
}

/**
 * 创建懒加载组件
 * @param importFn 动态导入函数
 * @param options 配置选项
 */
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: DynamicImportOptions = {}
) {
  const {
    loading = DefaultLoadingComponent,
    ssr = false,
    errorComponent = DefaultErrorComponent,
  } = options;

  return dynamic(importFn, {
    loading,
    ssr,
  });
}

/**
 * 预加载组件
 * @param importFn 动态导入函数
 */
export async function preloadComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
): Promise<void> {
  try {
    await importFn();
  } catch (error) {
    console.error('预加载组件失败:', error);
  }
}

/**
 * 路由级别的代码分割
 */
export const LazyPages = {
  // Auth pages
  LoginPage: createLazyComponent(
    () => import('@/app/(auth)/login/page'),
    { ssr: false }
  ),
  RegisterPage: createLazyComponent(
    () => import('@/app/(auth)/register/page'),
    { ssr: false }
  ),

  // Post pages
  PostListPage: createLazyComponent(
    () => import('@/app/(main)/posts/page')
  ),
  PostDetailPage: createLazyComponent(
    () => import('@/app/(main)/posts/[id]/page')
  ),
  PostCreatePage: createLazyComponent(
    () => import('@/app/(main)/posts/create/page'),
    { ssr: false }
  ),

  // Adapter pages
  AdapterMarketPage: createLazyComponent(
    () => import('@/app/(main)/adapters/page')
  ),
  AdapterDetailPage: createLazyComponent(
    () => import('@/app/(main)/adapters/[id]/page')
  ),
  AdapterUploadPage: createLazyComponent(
    () => import('@/app/(main)/adapters/upload/page'),
    { ssr: false }
  ),

  // Character pages
  CharacterListPage: createLazyComponent(
    () => import('@/app/(main)/characters/page')
  ),
  CharacterDetailPage: createLazyComponent(
    () => import('@/app/(main)/characters/[id]/page')
  ),
  CharacterCreatePage: createLazyComponent(
    () => import('@/app/(main)/characters/create/page'),
    { ssr: false }
  ),

  // Packaging pages
  PackagingPage: createLazyComponent(
    () => import('@/app/(main)/packaging/page'),
    { ssr: false }
  ),

  // Profile pages
  ProfilePage: createLazyComponent(
    () => import('@/app/(main)/profile/page'),
    { ssr: false }
  ),
};

/**
 * 组件级别的懒加载
 */
export const LazyComponents = {
  // 重量级组件
  MarkdownEditor: createLazyComponent(
    () => import('@/shared/components/common/MarkdownEditor'),
    { ssr: false }
  ),
  CodeBlock: createLazyComponent(
    () => import('@/shared/components/common/CodeBlock')
  ),
  ImageGallery: createLazyComponent(
    () => import('@/shared/components/common/ImageGallery')
  ),
  
  // 角色相关
  PersonalityEditor: createLazyComponent(
    () => import('@/features/character/components/PersonalityEditor'),
    { ssr: false }
  ),
  ExpressionManager: createLazyComponent(
    () => import('@/features/character/components/ExpressionManager'),
    { ssr: false }
  ),
  ModelPreview: createLazyComponent(
    () => import('@/features/character/components/ModelManager/ModelPreview'),
    { ssr: false }
  ),
  
  // 图表组件
  Chart: createLazyComponent(
    () => import('@/shared/components/common/Chart'),
    { ssr: false }
  ),
};

/**
 * 预加载关键路由
 */
export function preloadCriticalRoutes(): void {
  if (typeof window === 'undefined') return;

  // 预加载首页关键组件
  preloadComponent(() => import('@/app/(main)/posts/page'));
  preloadComponent(() => import('@/app/(main)/adapters/page'));
}

/**
 * 根据用户行为预加载
 */
export function setupIntelligentPreload(): void {
  if (typeof window === 'undefined') return;

  // 鼠标悬停时预加载
  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-preload]');
    
    if (link) {
      const route = link.getAttribute('data-preload');
      if (route) {
        // 根据路由预加载对应组件
        console.log('预加载路由:', route);
      }
    }
  });

  // Intersection Observer 预加载
  const preloadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          const preloadRoute = target.getAttribute('data-preload');
          if (preloadRoute) {
            console.log('预加载路由:', preloadRoute);
            preloadObserver.unobserve(target);
          }
        }
      });
    },
    { rootMargin: '50px' }
  );

  // 观察需要预加载的元素
  document.querySelectorAll('[data-preload-on-visible]').forEach((el) => {
    preloadObserver.observe(el);
  });
}

