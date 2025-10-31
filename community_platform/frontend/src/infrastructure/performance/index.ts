/**
 * 性能优化模块入口
 * 导出所有性能优化相关工具和组件
 */

// Web Vitals 监控
export {
  WebVitalsReporter,
  usePerformanceMonitor,
  performanceMonitor,
  performanceBudget,
  type PerformanceMetric,
} from './web-vitals'

// 缓存策略
export {
  CacheStrategy,
  CacheManager,
  CacheStrategyExecutor,
  cacheManager,
  cacheExecutor,
  withCache,
  type CacheConfig,
} from './cache-strategy'

// 虚拟滚动
export {
  VirtualScrollList,
  VirtualGrid,
  useVirtualScroll,
  virtualScrollUtils,
  type VirtualScrollConfig,
} from './virtual-scroll'

// 资源预加载
export {
  PreloadType,
  PreloadPriority,
  resourcePreloader,
  criticalResourcePreloader,
  routePreloader,
  useResourcePreload,
  deferExecution,
  codeSplitHelper,
  type PreloadResourceConfig,
} from './resource-preload'

// 图片优化
export {
  OptimizedImage,
  ResponsiveImage,
  AvatarImage,
  ProgressiveImage,
  imagePreloader,
  imageUtils,
  useImageLazyLoad,
} from './image-optimization'

// 动态导入
export {
  createLazyComponent,
  preloadComponent,
  LazyPages,
  LazyComponents,
  preloadCriticalRoutes,
  type DynamicImportOptions,
} from './dynamic-import'

// 性能监控 Hook
export { usePerformanceObserver } from './use-performance-observer'

// Bundle 分析
export { 
  BundleSizeChecker,
  BundleReportGenerator,
  bundleAnalyzerConfig,
  bundleSizebudget
} from './bundle-analyzer'
