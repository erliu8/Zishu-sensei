/**
 * 懒加载路由配置
 */
import React, { Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { enhancedLazy } from '../components/LazyLoad/LazyComponent';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

// === 懒加载页面组件 ===

const ChatPage = enhancedLazy(
  () => import('../pages/Chat'),
  {
    fallback: <SkeletonLoader type="chat" />,
    displayName: 'ChatPage',
  }
);

const SettingsPage = enhancedLazy(
  () => import('../pages/Settings'),
  {
    fallback: <SkeletonLoader type="settings" />,
    displayName: 'SettingsPage',
  }
);

const CharacterPage = enhancedLazy(
  () => import('../pages/Character'),
  {
    fallback: <SkeletonLoader type="character" />,
    displayName: 'CharacterPage',
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

const ThemeMarketPage = enhancedLazy(
  () => import('../pages/ThemeMarket'),
  {
    fallback: <SkeletonLoader type="market" />,
    displayName: 'ThemeMarketPage',
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
    fallback: <SkeletonLoader type="debug" />,
    displayName: 'DebugPage',
  }
);

const AboutPage = enhancedLazy(
  () => import('../pages/About'),
  {
    fallback: <LoadingSpinner message="加载关于页面..." />,
    displayName: 'AboutPage',
  }
);

// === 设置子页面 ===

const GeneralSettings = enhancedLazy(
  () => import('../components/Settings/GeneralSettings'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'GeneralSettings',
  }
);

const ThemeSettings = enhancedLazy(
  () => import('../components/Settings/ThemeSettings'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'ThemeSettings',
  }
);

const CharacterSettings = enhancedLazy(
  () => import('../components/Settings/CharacterSettings'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'CharacterSettings',
  }
);

const AdapterSettings = enhancedLazy(
  () => import('../components/Settings/AdapterSettings'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'AdapterSettings',
  }
);

const ShortcutsSettings = enhancedLazy(
  () => import('../components/Settings/ShortcutsPanel'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'ShortcutsSettings',
  }
);

const PrivacySettings = enhancedLazy(
  () => import('../components/Settings/PrivacySettings'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'PrivacySettings',
  }
);

const PerformanceSettings = enhancedLazy(
  () => import('../components/Settings/PerformanceSettings'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'PerformanceSettings',
  }
);

const AdvancedSettings = enhancedLazy(
  () => import('../components/Settings/AdvancedSettings'),
  {
    fallback: <SkeletonLoader type="settings-panel" />,
    displayName: 'AdvancedSettings',
  }
);

// === 路由配置 ===

/**
 * 创建带有错误边界的路由
 */
function createRouteWithErrorBoundary(
  Component: React.ComponentType,
  displayName: string
): React.FC {
  const RouteComponent: React.FC = () => (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="route-error">
          <h2>页面加载失败</h2>
          <p>页面: {displayName}</p>
          <p>错误: {error.message}</p>
          <button onClick={retry} className="retry-button">
            重新加载
          </button>
        </div>
      )}
    >
      <Component />
    </ErrorBoundary>
  );
  
  RouteComponent.displayName = `RouteWrapper(${displayName})`;
  return RouteComponent;
}

/**
 * 主要路由配置
 */
export const lazyRoutes: RouteObject[] = [
  {
    path: '/',
    element: createRouteWithErrorBoundary(ChatPage, 'Home')(),
  },
  {
    path: '/chat',
    element: createRouteWithErrorBoundary(ChatPage, 'Chat')(),
  },
  {
    path: '/character',
    element: createRouteWithErrorBoundary(CharacterPage, 'Character')(),
  },
  {
    path: '/workflow',
    element: createRouteWithErrorBoundary(WorkflowPage, 'Workflow')(),
  },
  {
    path: '/adapter',
    element: createRouteWithErrorBoundary(AdapterManagementPage, 'Adapter')(),
  },
  {
    path: '/theme-market',
    element: createRouteWithErrorBoundary(ThemeMarketPage, 'ThemeMarket')(),
  },
  {
    path: '/performance',
    element: createRouteWithErrorBoundary(PerformancePage, 'Performance')(),
  },
  {
    path: '/debug',
    element: createRouteWithErrorBoundary(DebugPage, 'Debug')(),
  },
  {
    path: '/about',
    element: createRouteWithErrorBoundary(AboutPage, 'About')(),
  },
  {
    path: '/settings',
    element: createRouteWithErrorBoundary(SettingsPage, 'Settings')(),
    children: [
      {
        path: '',
        element: createRouteWithErrorBoundary(GeneralSettings, 'GeneralSettings')(),
      },
      {
        path: 'general',
        element: createRouteWithErrorBoundary(GeneralSettings, 'GeneralSettings')(),
      },
      {
        path: 'theme',
        element: createRouteWithErrorBoundary(ThemeSettings, 'ThemeSettings')(),
      },
      {
        path: 'character',
        element: createRouteWithErrorBoundary(CharacterSettings, 'CharacterSettings')(),
      },
      {
        path: 'adapter',
        element: createRouteWithErrorBoundary(AdapterSettings, 'AdapterSettings')(),
      },
      {
        path: 'shortcuts',
        element: createRouteWithErrorBoundary(ShortcutsSettings, 'ShortcutsSettings')(),
      },
      {
        path: 'privacy',
        element: createRouteWithErrorBoundary(PrivacySettings, 'PrivacySettings')(),
      },
      {
        path: 'performance',
        element: createRouteWithErrorBoundary(PerformanceSettings, 'PerformanceSettings')(),
      },
      {
        path: 'advanced',
        element: createRouteWithErrorBoundary(AdvancedSettings, 'AdvancedSettings')(),
      },
    ],
  },
];

// === 路由预加载配置 ===

/**
 * 路由预加载优先级
 */
export const ROUTE_PRELOAD_PRIORITIES = {
  // 高优先级：用户常用的页面
  high: [
    () => import('../pages/Chat'),
    () => import('../pages/Settings'),
    () => import('../components/Settings/GeneralSettings'),
  ],
  
  // 中优先级：功能页面
  medium: [
    () => import('../pages/Character'),
    () => import('../components/Settings/ThemeSettings'),
    () => import('../components/Settings/CharacterSettings'),
  ],
  
  // 低优先级：管理和工具页面
  low: [
    () => import('../pages/Workflow'),
    () => import('../pages/AdapterManagement'),
    () => import('../pages/ThemeMarket'),
    () => import('../pages/Performance'),
    () => import('../components/Settings/AdapterSettings'),
    () => import('../components/Settings/ShortcutsPanel'),
    () => import('../components/Settings/PrivacySettings'),
    () => import('../components/Settings/PerformanceSettings'),
    () => import('../components/Settings/AdvancedSettings'),
  ],
  
  // 最低优先级：调试和关于页面
  lowest: [
    () => import('../pages/Debug'),
    () => import('../pages/About'),
  ],
} as const;

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
      ROUTE_PRELOAD_PRIORITIES.high,
      ['Chat', 'Settings', 'GeneralSettings'],
      0
    );

    // 1秒后预加载中优先级路由
    setTimeout(() => {
      this.preloadRoutes(
        ROUTE_PRELOAD_PRIORITIES.medium,
        ['Character', 'ThemeSettings', 'CharacterSettings'],
        0
      ).catch(console.error);
    }, 1000);

    // 3秒后预加载低优先级路由
    setTimeout(() => {
      this.preloadRoutes(
        ROUTE_PRELOAD_PRIORITIES.low,
        [
          'Workflow', 'AdapterManagement', 'ThemeMarket', 'Performance',
          'AdapterSettings', 'ShortcutsSettings', 'PrivacySettings',
          'PerformanceSettings', 'AdvancedSettings'
        ],
        0
      ).catch(console.error);
    }, 3000);

    // 10秒后预加载最低优先级路由
    setTimeout(() => {
      this.preloadRoutes(
        ROUTE_PRELOAD_PRIORITIES.lowest,
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
      '/': ROUTE_PRELOAD_PRIORITIES.high,
      '/chat': [
        () => import('../pages/Settings'),
        () => import('../pages/Character'),
      ],
      '/settings': [
        () => import('../components/Settings/ThemeSettings'),
        () => import('../components/Settings/CharacterSettings'),
      ],
      '/character': [
        () => import('../pages/Chat'),
        () => import('../components/Settings/CharacterSettings'),
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
