/**
 * 懒加载路由配置
 */
import { RouteObject } from 'react-router-dom';
import { enhancedLazy } from '../components/LazyLoad/LazyComponent';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

// === 懒加载页面组件 ===

const SettingsPage = enhancedLazy(
  () => import('../components/Settings'),
  {
    fallback: <SkeletonLoader type="settings" />,
    displayName: 'SettingsPage',
  }
);

const WorkflowPage = enhancedLazy(
  () => import('../pages/Workflow'),
  {
    fallback: <SkeletonLoader type="workflow" />,
    displayName: 'WorkflowPage',
  }
);

const AdapterManagementPage = enhancedLazy(
  () => import('../pages/AdapterManagement'),
  {
    fallback: <SkeletonLoader type="adapter" />,
    displayName: 'AdapterManagementPage',
  }
);

const PerformancePage = enhancedLazy(
  () => import('../pages/Performance'),
  {
    fallback: <SkeletonLoader type="monitor" />,
    displayName: 'PerformancePage',
  }
);

const DebugPage = enhancedLazy(
  () => import('../pages/Debug'),
  {
    fallback: <SkeletonLoader type="default" />,
    displayName: 'DebugPage',
  }
);

const AboutPage = enhancedLazy(
  () => import('../pages/About'),
  {
    fallback: <LoadingSpinner />,
    displayName: 'AboutPage',
  }
);

const TriggerManagementPage = enhancedLazy(
  () => import('../pages/TriggerManagement'),
  {
    fallback: <SkeletonLoader type="workflow" />,
    displayName: 'TriggerManagementPage',
  }
);

const Live2DDemoPage = enhancedLazy(
  () => import('../pages/Live2DDemo'),
  {
    fallback: <SkeletonLoader type="model-viewer" />,
    displayName: 'Live2DDemoPage',
  }
);

// === 路由配置 ===

/**
 * 主要路由配置
 */
export const lazyRoutes: RouteObject[] = [
  {
    path: '/',
    element: <div>Home Page - To be implemented</div>,
  },
  {
    path: '/workflow',
    element: <WorkflowPage />,
  },
  {
    path: '/workflows/:workflowId/triggers',
    element: <TriggerManagementPage />,
  },
  {
    path: '/adapter',
    element: <AdapterManagementPage />,
  },
  {
    path: '/performance',
    element: <PerformancePage />,
  },
  {
    path: '/debug',
    element: <DebugPage />,
  },
  {
    path: '/about',
    element: <AboutPage />,
  },
  {
    path: '/live2d-demo',
    element: <Live2DDemoPage />,
  },
  {
    path: '/settings',
    element: <SettingsPage />,
  },
];

// === 路由预加载配置 ===

/**
 * 路由预加载优先级
 */
export const ROUTE_PRELOAD_PRIORITIES = {
  // 高优先级：用户常用的页面
  high: [
    () => import('../components/Settings'),
    () => import('../components/Settings/GeneralSettings'),
  ],
  
  // 中优先级：功能页面
  medium: [
    () => import('../components/Settings/ThemeSettings'),
    () => import('../components/Settings/CharacterSettings'),
  ],
  
  // 低优先级：管理和工具页面
  low: [
    () => import('../pages/Workflow'),
    () => import('../pages/AdapterManagement'),
    () => import('../pages/Performance'),
    () => import('../components/Settings/AdapterSettings'),
    () => import('../components/Settings/ShortcutsPanel'),
    () => import('../components/Settings/PrivacySettings'),
    () => import('../components/Settings/PerformanceSettings'),
  ],
  
  // 最低优先级：调试和关于页面
  lowest: [
    () => import('../pages/Debug'),
    () => import('../pages/About'),
  ],
};

/**
 * 路由预加载策略
 */
export class RoutePreloader {
  private preloadedRoutes = new Set<string>();
  private preloadPromises = new Map<string, Promise<any>>();

  /**
   * 预加载单个路由
   */
  async preloadRoute(importFunc: () => Promise<any>, routeName: string): Promise<void> {
    if (this.preloadedRoutes.has(routeName)) {
      return;
    }

    if (!this.preloadPromises.has(routeName)) {
      const promise = importFunc()
        .then(() => {
          this.preloadedRoutes.add(routeName);
          this.preloadPromises.delete(routeName);
          console.log(`Route preloaded: ${routeName}`);
        })
        .catch((error) => {
          this.preloadPromises.delete(routeName);
          console.error(`Failed to preload route ${routeName}:`, error);
        });
      
      this.preloadPromises.set(routeName, promise);
    }

    return this.preloadPromises.get(routeName);
  }

  /**
   * 批量预加载路由
   */
  async preloadRoutes(
    importFuncs: Array<() => Promise<any>>,
    routeNames: string[],
    delay: number = 0
  ): Promise<void> {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const promises = importFuncs.map((importFunc, index) =>
      this.preloadRoute(importFunc, routeNames[index])
    );

    await Promise.allSettled(promises);
  }

  /**
   * 根据优先级预加载所有路由
   */
  async preloadByPriority(): Promise<void> {
    // 立即预加载高优先级路由
    await this.preloadRoutes(
      [...ROUTE_PRELOAD_PRIORITIES.high],
      ['Settings', 'GeneralSettings'],
      0
    );

    // 1秒后预加载中优先级路由
    setTimeout(() => {
      this.preloadRoutes(
        [...ROUTE_PRELOAD_PRIORITIES.medium],
        ['ThemeSettings', 'CharacterSettings'],
        0
      ).catch(console.error);
    }, 1000);

    // 3秒后预加载低优先级路由
    setTimeout(() => {
      this.preloadRoutes(
        [...ROUTE_PRELOAD_PRIORITIES.low],
        [
          'Workflow', 'AdapterManagement', 'Performance',
          'AdapterSettings', 'ShortcutsSettings', 'PrivacySettings',
          'PerformanceSettings'
        ],
        0
      ).catch(console.error);
    }, 3000);

    // 10秒后预加载最低优先级路由
    setTimeout(() => {
      this.preloadRoutes(
        [...ROUTE_PRELOAD_PRIORITIES.lowest],
        ['Debug', 'About'],
        0
      ).catch(console.error);
    }, 10000);
  }

  /**
   * 智能预加载（基于用户行为）
   */
  smartPreload(currentPath: string): void {
    // 根据当前路径预测用户可能访问的下一个页面
    const predictions: Record<string, Array<() => Promise<any>>> = {
      '/': [...ROUTE_PRELOAD_PRIORITIES.high],
      '/settings': [
        () => import('../components/Settings/ThemeSettings'),
        () => import('../components/Settings/CharacterSettings'),
      ],
      '/workflow': [
        () => import('../pages/TriggerManagement'),
        () => import('../pages/Performance'),
      ],
    };

    const predictedRoutes = predictions[currentPath];
    if (predictedRoutes) {
      setTimeout(() => {
        predictedRoutes.forEach((importFunc, index) => {
          this.preloadRoute(importFunc, `Predicted-${index}`).catch(console.error);
        });
      }, 500);
    }
  }

  /**
   * 获取预加载状态
   */
  getPreloadStatus(): {
    preloadedCount: number;
    totalRoutes: number;
    preloadedRoutes: string[];
  } {
    const totalRoutes = Object.values(ROUTE_PRELOAD_PRIORITIES).flat().length;
    
    return {
      preloadedCount: this.preloadedRoutes.size,
      totalRoutes,
      preloadedRoutes: Array.from(this.preloadedRoutes),
    };
  }

  /**
   * 清除预加载缓存
   */
  clearCache(): void {
    this.preloadedRoutes.clear();
    this.preloadPromises.clear();
  }
}

// 创建全局路由预加载器实例
export const routePreloader = new RoutePreloader();

// 自动开始预加载
if (typeof window !== 'undefined') {
  // 页面加载完成后开始预加载
  if (document.readyState === 'complete') {
    routePreloader.preloadByPriority().catch(console.error);
  } else {
    window.addEventListener('load', () => {
      routePreloader.preloadByPriority().catch(console.error);
    });
  }
}

export default lazyRoutes;
