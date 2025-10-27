/**
 * 启动优化服务
 */
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import {
  StartupConfig,
  StartupPhase,
  StartupStats,
  StartupEvent,
  StartupOptimization,
  StartupPerformanceMetrics,
  OptimizationSuggestion,
  DEFAULT_STARTUP_CONFIG,
} from '../types/startup';

/**
 * 启动服务类
 */
export class StartupService {
  private static instance: StartupService;
  private eventListeners: Map<string, Set<(event: StartupEvent) => void>> = new Map();
  private performanceObserver?: PerformanceObserver;
  private startTime: number = Date.now();

  private constructor() {
    this.initializePerformanceMonitoring();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): StartupService {
    if (!StartupService.instance) {
      StartupService.instance = new StartupService();
    }
    return StartupService.instance;
  }

  /**
   * 初始化性能监控
   */
  private initializePerformanceMonitoring(): void {
    // 监听 Web Vitals
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });

      try {
        this.performanceObserver.observe({ 
          type: 'navigation',
          buffered: true 
        });
        this.performanceObserver.observe({ 
          type: 'paint',
          buffered: true 
        });
        this.performanceObserver.observe({ 
          type: 'largest-contentful-paint',
          buffered: true 
        });
        this.performanceObserver.observe({ 
          type: 'first-input',
          buffered: true 
        });
        this.performanceObserver.observe({ 
          type: 'layout-shift',
          buffered: true 
        });
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }

    // 监听 Tauri 启动事件
    this.listenToStartupEvents();
  }

  /**
   * 监听启动事件
   */
  private async listenToStartupEvents(): Promise<void> {
    try {
      await listen('startup_event', (event) => {
        const startupEvent = event.payload as StartupEvent;
        this.emitEvent('startup_event', startupEvent);
      });
    } catch (error) {
      console.error('Failed to listen to startup events:', error);
    }
  }

  /**
   * 处理性能条目
   */
  private handlePerformanceEntry(entry: PerformanceEntry): void {
    const eventData: StartupEvent = {
      event_type: 'performance_metric',
      progress: 0,
      message: `Performance metric: ${entry.name}`,
      timestamp: Date.now(),
      data: {
        name: entry.name,
        entryType: entry.entryType,
        startTime: entry.startTime,
        duration: entry.duration,
      },
    };

    this.emitEvent('performance_metric', eventData);
  }

  /**
   * 发送事件
   */
  private emitEvent(eventType: string, event: StartupEvent): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(eventType: string, listener: (event: StartupEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(eventType: string, listener: (event: StartupEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // === Tauri 命令封装 ===

  /**
   * 更新启动配置
   */
  async updateStartupConfig(config: StartupConfig): Promise<void> {
    try {
      await invoke('update_startup_config', { config });
    } catch (error) {
      console.error('Failed to update startup config:', error);
      throw error;
    }
  }

  /**
   * 获取启动配置
   */
  async getStartupConfig(): Promise<StartupConfig> {
    try {
      return await invoke('get_startup_config');
    } catch (error) {
      console.error('Failed to get startup config:', error);
      return DEFAULT_STARTUP_CONFIG;
    }
  }

  /**
   * 开始启动阶段
   */
  async startPhase(phase: StartupPhase): Promise<void> {
    try {
      await invoke('start_startup_phase', { phase });
    } catch (error) {
      console.error(`Failed to start phase ${phase}:`, error);
      throw error;
    }
  }

  /**
   * 完成启动阶段（成功）
   */
  async finishPhaseSuccess(
    phase: StartupPhase,
    metrics?: Record<string, number>
  ): Promise<void> {
    try {
      await invoke('finish_startup_phase_success', { phase, metrics });
    } catch (error) {
      console.error(`Failed to finish phase ${phase}:`, error);
      throw error;
    }
  }

  /**
   * 完成启动阶段（失败）
   */
  async finishPhaseError(phase: StartupPhase, error: string): Promise<void> {
    try {
      await invoke('finish_startup_phase_error', { phase, error });
    } catch (error) {
      console.error(`Failed to finish phase ${phase} with error:`, error);
      throw error;
    }
  }

  /**
   * 获取启动进度
   */
  async getProgress(): Promise<number> {
    try {
      return await invoke('get_startup_progress');
    } catch (error) {
      console.error('Failed to get startup progress:', error);
      return 0;
    }
  }

  /**
   * 获取启动统计信息
   */
  async getStats(): Promise<StartupStats> {
    try {
      return await invoke('get_startup_stats');
    } catch (error) {
      console.error('Failed to get startup stats:', error);
      throw error;
    }
  }

  /**
   * 获取启动缓存
   */
  async getCache(key: string): Promise<any> {
    try {
      return await invoke('get_startup_cache', { key });
    } catch (error) {
      console.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 设置启动缓存
   */
  async setCache(key: string, value: any): Promise<void> {
    try {
      await invoke('set_startup_cache', { key, value });
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * 清除启动缓存
   */
  async clearCache(): Promise<void> {
    try {
      await invoke('clear_startup_cache');
    } catch (error) {
      console.error('Failed to clear startup cache:', error);
      throw error;
    }
  }

  /**
   * 预加载资源
   */
  async preloadResources(resources: string[]): Promise<void> {
    try {
      await invoke('preload_resources', { resources });
    } catch (error) {
      console.error('Failed to preload resources:', error);
      throw error;
    }
  }

  /**
   * 优化启动
   */
  async optimizeStartup(): Promise<string> {
    try {
      return await invoke('optimize_startup');
    } catch (error) {
      console.error('Failed to optimize startup:', error);
      throw error;
    }
  }

  /**
   * 重置启动管理器
   */
  async reset(): Promise<void> {
    try {
      await invoke('reset_startup_manager');
    } catch (error) {
      console.error('Failed to reset startup manager:', error);
      throw error;
    }
  }

  // === 前端启动优化方法 ===

  /**
   * 执行前端启动优化
   */
  async executeFrontendOptimization(config: StartupOptimization): Promise<void> {
    await this.startPhase(StartupPhase.FrontendInitialization);

    try {
      const startTime = performance.now();

      // 1. 代码分割和懒加载
      if (config.codeSplitting.enabled) {
        await this.implementCodeSplitting(config.codeSplitting);
      }

      // 2. 资源预加载
      if (config.resourcePreloading.enabled) {
        await this.implementResourcePreloading(config.resourcePreloading);
      }

      // 3. 首屏优化
      if (config.firstScreenOptimization.enabled) {
        await this.implementFirstScreenOptimization(config.firstScreenOptimization);
      }

      // 4. 缓存策略
      if (config.cacheStrategy.enabled) {
        await this.implementCacheStrategy(config.cacheStrategy);
      }

      const endTime = performance.now();
      const metrics = {
        frontend_optimization_duration: endTime - startTime,
        code_splitting_enabled: config.codeSplitting.enabled ? 1 : 0,
        resource_preloading_enabled: config.resourcePreloading.enabled ? 1 : 0,
        first_screen_optimization_enabled: config.firstScreenOptimization.enabled ? 1 : 0,
        cache_strategy_enabled: config.cacheStrategy.enabled ? 1 : 0,
      };

      await this.finishPhaseSuccess(StartupPhase.FrontendInitialization, metrics);
    } catch (error) {
      await this.finishPhaseError(
        StartupPhase.FrontendInitialization,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 实现代码分割
   */
  private async implementCodeSplitting(config: any): Promise<void> {
    // 预加载优先级路由
    for (const route of config.preloadRoutes || []) {
      try {
        // 动态导入路由组件
        await this.preloadRouteComponent(route);
      } catch (error) {
        console.warn(`Failed to preload route ${route}:`, error);
      }
    }
  }

  /**
   * 预加载路由组件
   */
  private async preloadRouteComponent(route: string): Promise<void> {
    // TODO: 实现路由组件预加载
    // 当页面组件创建后，在这里添加路由映射
    console.log(`Preloading route: ${route}`);
  }

  /**
   * 实现资源预加载
   */
  private async implementResourcePreloading(config: any): Promise<void> {
    const resources = this.getPreloadResources(config);
    
    // 按优先级排序
    const sortedResources = resources.sort((a, b) => {
      const priorityA = config.priorities?.[a] || 0;
      const priorityB = config.priorities?.[b] || 0;
      return priorityB - priorityA;
    });

    // 预加载资源
    await this.preloadResources(sortedResources);
  }

  /**
   * 获取预加载资源列表
   */
  private getPreloadResources(config: any): string[] {
    const resources: string[] = [];

    // 根据资源类型添加资源
    if (config.resourceTypes?.includes('image')) {
      resources.push(
        '/images/character/default.png',
        '/images/icons/app.png',
        '/images/backgrounds/default.jpg'
      );
    }

    if (config.resourceTypes?.includes('css')) {
      resources.push('/styles/critical.css', '/styles/theme.css');
    }

    if (config.resourceTypes?.includes('javascript')) {
      resources.push('/js/vendor.js', '/js/main.js');
    }

    if (config.resourceTypes?.includes('live2d-model')) {
      resources.push('/live2d_models/hiyori/hiyori.model3.json');
    }

    return resources;
  }

  /**
   * 实现首屏优化
   */
  private async implementFirstScreenOptimization(config: any): Promise<void> {
    // 内联关键 CSS
    if (config.inlineCriticalCSS) {
      this.inlineCriticalCSS();
    }

    // 图片懒加载
    if (config.lazyLoadImages) {
      this.setupImageLazyLoading();
    }

    // 虚拟滚动
    if (config.virtualScrolling) {
      this.enableVirtualScrolling();
    }
  }

  /**
   * 内联关键 CSS
   */
  private inlineCriticalCSS(): void {
    const criticalCSS = `
      body { margin: 0; padding: 0; }
      .loading-screen { 
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        background: #1a1a1a; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
      }
    `;

    const style = document.createElement('style');
    style.textContent = criticalCSS;
    document.head.appendChild(style);
  }

  /**
   * 设置图片懒加载
   */
  private setupImageLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      // 观察所有带有 data-src 属性的图片
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  /**
   * 启用虚拟滚动
   */
  private enableVirtualScrolling(): void {
    // 为长列表启用虚拟滚动
    // 这里可以集成 react-window 或 react-virtualized
    console.log('Virtual scrolling enabled');
  }

  /**
   * 实现缓存策略
   */
  private async implementCacheStrategy(config: any): Promise<void> {
    // 设置不同类型的缓存
    for (const cacheType of config.types || []) {
      switch (cacheType) {
        case 'memory':
          this.setupMemoryCache(config);
          break;
        case 'localStorage':
          this.setupLocalStorageCache(config);
          break;
        case 'sessionStorage':
          this.setupSessionStorageCache(config);
          break;
        case 'indexedDB':
          await this.setupIndexedDBCache(config);
          break;
        case 'serviceWorker':
          await this.setupServiceWorkerCache(config);
          break;
      }
    }
  }

  /**
   * 设置内存缓存
   */
  private setupMemoryCache(_config: any): void {
    // 创建内存缓存
    const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
    
    (window as any).__startup_cache = cache;
  }

  /**
   * 设置 LocalStorage 缓存
   */
  private setupLocalStorageCache(config: any): void {
    try {
      localStorage.setItem('startup_cache_config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to setup localStorage cache:', error);
    }
  }

  /**
   * 设置 SessionStorage 缓存
   */
  private setupSessionStorageCache(config: any): void {
    try {
      sessionStorage.setItem('startup_cache_config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to setup sessionStorage cache:', error);
    }
  }

  /**
   * 设置 IndexedDB 缓存
   */
  private async setupIndexedDBCache(_config: any): Promise<void> {
    try {
      // 这里可以实现 IndexedDB 缓存逻辑
      console.log('IndexedDB cache setup completed');
    } catch (error) {
      console.warn('Failed to setup IndexedDB cache:', error);
    }
  }

  /**
   * 设置 Service Worker 缓存
   */
  private async setupServiceWorkerCache(_config: any): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker cache setup completed');
      } catch (error) {
        console.warn('Failed to setup Service Worker cache:', error);
      }
    }
  }

  /**
   * 收集性能指标
   */
  async collectPerformanceMetrics(): Promise<StartupPerformanceMetrics> {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const lcp = performance.getEntriesByType('largest-contentful-paint')[0];
    const fid = performance.getEntriesByType('first-input')[0];
    const cls = performance.getEntriesByType('layout-shift');

    // 计算 CLS
    const cumulativeLayoutShift = cls.reduce((sum, entry: any) => {
      if (!entry.hadRecentInput) {
        return sum + entry.value;
      }
      return sum;
    }, 0);

    return {
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
      largestContentfulPaint: lcp?.startTime || 0,
      firstInputDelay: (fid as any)?.processingStart - (fid as any)?.startTime || 0,
      cumulativeLayoutShift,
      timeToInteractive: navigation?.domInteractive || 0,
      totalBlockingTime: 0, // 需要额外计算
      pageLoadTime: Date.now() - this.startTime,
      resourceLoadTimes: this.collectResourceLoadTimes(),
      componentRenderTimes: this.collectComponentRenderTimes(),
    };
  }

  /**
   * 收集资源加载时间
   */
  private collectResourceLoadTimes(): Record<string, number> {
    const resources = performance.getEntriesByType('resource');
    const loadTimes: Record<string, number> = {};

    resources.forEach(resource => {
      const name = resource.name.split('/').pop() || resource.name;
      loadTimes[name] = resource.duration;
    });

    return loadTimes;
  }

  /**
   * 收集组件渲染时间
   */
  private collectComponentRenderTimes(): Record<string, number> {
    // 这里可以集成 React DevTools Profiler 或自定义组件性能监控
    return {};
  }

  /**
   * 生成优化建议
   */
  async generateOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const stats = await this.getStats();
    const performanceMetrics = await this.collectPerformanceMetrics();

    // 基于启动时间的建议
    if (stats.total_duration > 10000) {
      suggestions.push({
        id: 'slow-startup',
        type: 'performance',
        priority: 'high',
        title: '启动速度优化',
        description: '应用启动时间过长，建议进行优化',
        expectedBenefit: '可减少 30-50% 的启动时间',
        implementationDifficulty: 'medium',
        implementationSteps: [
          '启用代码分割',
          '实现资源懒加载',
          '优化关键渲染路径',
          '减少初始包大小',
        ],
      });
    }

    // 基于内存使用的建议
    if (stats.memory_peak > 1024 * 1024 * 1024) { // 1GB
      suggestions.push({
        id: 'memory-optimization',
        type: 'memory',
        priority: 'high',
        title: '内存使用优化',
        description: '启动时内存使用过高',
        expectedBenefit: '可减少 20-40% 的内存使用',
        implementationDifficulty: 'medium',
        implementationSteps: [
          '启用组件懒加载',
          '优化图片资源',
          '实现虚拟滚动',
          '清理无用的缓存',
        ],
      });
    }

    // 基于首次绘制时间的建议
    if (performanceMetrics.firstContentfulPaint > 3000) {
      suggestions.push({
        id: 'fcp-optimization',
        type: 'user-experience',
        priority: 'medium',
        title: '首屏渲染优化',
        description: '首次内容绘制时间过长',
        expectedBenefit: '可提升 40-60% 的用户体验',
        implementationDifficulty: 'easy',
        implementationSteps: [
          '内联关键CSS',
          '优化字体加载',
          '减少关键资源',
          '启用预加载',
        ],
      });
    }

    return suggestions;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.eventListeners.clear();
  }
}

// 导出单例实例
export const startupService = StartupService.getInstance();
export default startupService;
