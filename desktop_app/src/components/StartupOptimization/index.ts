/**
 * 启动优化组件导出
 */

// 懒加载组件
export { LazyComponent, enhancedLazy, createLazyComponent } from './LazyComponent';
export type { LazyComponentProps, LazyComponentOptions } from './LazyComponent';

// 常用懒加载组件
export * from '../LazyLoad/lazyComponents';

// 首屏渲染优化
export { 
  FirstScreenOptimizer, 
  withFirstScreenOptimization 
} from './FirstScreenOptimizer';
export type { FirstScreenOptimizerProps } from './FirstScreenOptimizer';

// 启动进度组件
export { 
  StartupProgress, 
  SimpleStartupProgress, 
  FullStartupProgress 
} from './StartupProgress';
export type { StartupProgressProps } from './StartupProgress';

// 启动性能监控
export { 
  StartupMonitor, 
  SimpleStartupMonitor 
} from './StartupMonitor';
export type { StartupMonitorProps } from './StartupMonitor';

// 懒加载路由
export { default as lazyRoutes, routePreloader } from '../router/lazyRoutes';
export type { RoutePreloader } from '../router/lazyRoutes';
