/**
 * 动态导入工具
 * 提供组件懒加载和代码分割功能
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';
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
 * 动态导入配置选项
 */
export interface DynamicImportOptions {
  /**
   * 自定义加载组件
   */
  loading?: ComponentType<any>;
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
  } = options;

  return dynamic(importFn, {
    loading: loading as any,
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
 * 占位符页面组件
 */
const PlaceholderPage = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <p className="text-lg font-semibold text-muted-foreground">页面开发中</p>
      <p className="text-sm text-muted-foreground mt-2">此页面尚未实现</p>
    </div>
  </div>
);

/**
 * 路由级别的代码分割
 */
export const LazyPages = {
  // Auth pages (using placeholder until implemented)
  LoginPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),
  RegisterPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),

  // Post pages (using placeholder until implemented)
  PostListPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage })
  ),
  PostDetailPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage })
  ),
  PostCreatePage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),

  // Adapter pages (using placeholder until implemented)
  AdapterMarketPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage })
  ),
  AdapterDetailPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage })
  ),
  AdapterUploadPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),

  // Character pages (using placeholder until implemented)
  CharacterListPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage })
  ),
  CharacterDetailPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage })
  ),
  CharacterCreatePage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),

  // Packaging pages (using placeholder until implemented)
  PackagingPage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),

  // Profile pages (using placeholder until implemented)
  ProfilePage: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
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
  
  // 角色相关 (using placeholder until implemented)
  PersonalityEditor: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),
  ExpressionManager: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),
  ModelPreview: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),
  
  // 图表组件 (using placeholder until implemented)
  Chart: createLazyComponent(
    () => Promise.resolve({ default: PlaceholderPage }),
    { ssr: false }
  ),
};

/**
 * 预加载关键路由
 */
export function preloadCriticalRoutes(): void {
  if (typeof window === 'undefined') return;

  // 预加载首页关键组件 (disabled until pages are implemented)
  // preloadComponent(() => import('@/app/(main)/posts/page'));
  // preloadComponent(() => import('@/app/(main)/adapters/page'));
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

