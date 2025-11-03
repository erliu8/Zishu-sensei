/**
 * 资源预加载器
 * 负责预加载关键资源以提升首屏渲染性能
 */

interface PreloadResource {
  url: string;
  type: 'script' | 'style' | 'image' | 'font' | 'audio' | 'video' | 'document';
  priority: 'high' | 'medium' | 'low';
  crossOrigin?: 'anonymous' | 'use-credentials';
  integrity?: string;
  media?: string;
}

interface PreloadOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  onProgress?: (loaded: number, total: number) => void;
  onSuccess?: (resource: PreloadResource) => void;
  onError?: (resource: PreloadResource, error: Error) => void;
}

interface PreloadStats {
  total: number;
  loaded: number;
  failed: number;
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * 资源预加载器类
 */
export class ResourcePreloader {
  private preloadedResources = new Set<string>();
  private loadingResources = new Map<string, Promise<void>>();
  private stats: PreloadStats = {
    total: 0,
    loaded: 0,
    failed: 0,
    startTime: Date.now(),
  };

  /**
   * 预加载单个资源
   */
  async preloadResource(
    resource: PreloadResource,
    options: PreloadOptions = {}
  ): Promise<void> {
    const { url } = resource;
    const {
      timeout = 10000,
      retryCount = 2,
      retryDelay = 1000,
      onSuccess,
      onError,
    } = options;

    // 避免重复加载
    if (this.preloadedResources.has(url)) {
      return;
    }

    // 如果正在加载中，返回现有的 Promise
    if (this.loadingResources.has(url)) {
      return this.loadingResources.get(url);
    }

    const loadPromise = this.createPreloadPromise(
      resource,
      timeout,
      retryCount,
      retryDelay
    );

    this.loadingResources.set(url, loadPromise);

    try {
      await loadPromise;
      this.preloadedResources.add(url);
      this.stats.loaded++;
      onSuccess?.(resource);
    } catch (error) {
      this.stats.failed++;
      onError?.(resource, error as Error);
      throw error;
    } finally {
      this.loadingResources.delete(url);
    }
  }

  /**
   * 创建预加载 Promise
   */
  private createPreloadPromise(
    resource: PreloadResource,
    timeout: number,
    retryCount: number,
    retryDelay: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const attemptLoad = () => {
        attempts++;
        const link = document.createElement('link');
        let timeoutId: NodeJS.Timeout;

        const cleanup = () => {
          clearTimeout(timeoutId);
          link.remove();
        };

        const handleSuccess = () => {
          cleanup();
          console.log(`Resource preloaded: ${resource.url}`);
          resolve();
        };

        const handleError = (error: Event | string) => {
          cleanup();
          
          if (attempts < retryCount) {
            console.warn(`Retrying resource preload (${attempts}/${retryCount}): ${resource.url}`);
            setTimeout(attemptLoad, retryDelay);
          } else {
            const errorMsg = `Failed to preload resource: ${resource.url}`;
            console.error(errorMsg, error);
            reject(new Error(errorMsg));
          }
        };

        // 设置超时
        timeoutId = setTimeout(() => {
          handleError('timeout');
        }, timeout);

        // 配置 link 元素
        link.rel = 'preload';
        link.href = resource.url;
        link.as = this.getAsAttribute(resource.type);
        
        if (resource.crossOrigin) {
          link.crossOrigin = resource.crossOrigin;
        }
        
        if (resource.integrity) {
          link.integrity = resource.integrity;
        }
        
        if (resource.media) {
          link.media = resource.media;
        }

        // 设置优先级
        if ('fetchPriority' in link) {
          (link as any).fetchPriority = resource.priority;
        }

        // 事件监听
        link.onload = handleSuccess;
        link.onerror = handleError;

        // 添加到文档头部
        document.head.appendChild(link);
      };

      attemptLoad();
    });
  }

  /**
   * 获取 as 属性值
   */
  private getAsAttribute(type: PreloadResource['type']): string {
    const asMap: Record<PreloadResource['type'], string> = {
      script: 'script',
      style: 'style',
      image: 'image',
      font: 'font',
      audio: 'audio',
      video: 'video',
      document: 'document',
    };
    return asMap[type] || 'fetch';
  }

  /**
   * 批量预加载资源
   */
  async preloadResources(
    resources: PreloadResource[],
    options: PreloadOptions = {}
  ): Promise<void> {
    this.stats.total = resources.length;
    this.stats.startTime = Date.now();

    const { onProgress } = options;

    // 按优先级分组
    const priorityGroups = this.groupByPriority(resources);

    // 依次加载不同优先级的资源
    for (const [priority, groupResources] of priorityGroups) {
      console.log(`Loading ${priority} priority resources (${groupResources.length})`);
      
      const promises = groupResources.map(async (resource) => {
        try {
          await this.preloadResource(resource, {
            ...options,
            onSuccess: (res) => {
              onProgress?.(this.stats.loaded, this.stats.total);
              options.onSuccess?.(res);
            },
          });
        } catch (error) {
          console.error(`Failed to preload resource: ${resource.url}`, error);
        }
      });

      // 高优先级资源串行加载，其他并行加载
      if (priority === 'high') {
        for (const promise of promises) {
          await promise;
        }
      } else {
        await Promise.allSettled(promises);
      }
    }

    this.stats.endTime = Date.now();
    this.stats.duration = this.stats.endTime - this.stats.startTime;

    console.log('Resource preloading completed:', this.stats);
  }

  /**
   * 按优先级分组资源
   */
  private groupByPriority(resources: PreloadResource[]): Map<string, PreloadResource[]> {
    const groups = new Map<string, PreloadResource[]>();
    const priorities = ['high', 'medium', 'low'];

    priorities.forEach(priority => {
      const groupResources = resources.filter(r => r.priority === priority);
      if (groupResources.length > 0) {
        groups.set(priority, groupResources);
      }
    });

    return groups;
  }

  /**
   * 预加载字体资源
   */
  async preloadFonts(fontUrls: string[]): Promise<void> {
    const fontResources: PreloadResource[] = fontUrls.map(url => ({
      url,
      type: 'font',
      priority: 'high',
      crossOrigin: 'anonymous',
    }));

    await this.preloadResources(fontResources);
  }

  /**
   * 预加载关键图片
   */
  async preloadImages(imageUrls: string[]): Promise<void> {
    const imageResources: PreloadResource[] = imageUrls.map(url => ({
      url,
      type: 'image',
      priority: 'medium',
    }));

    await this.preloadResources(imageResources);
  }

  /**
   * 预加载 CSS 文件
   */
  async preloadStyles(styleUrls: string[]): Promise<void> {
    const styleResources: PreloadResource[] = styleUrls.map(url => ({
      url,
      type: 'style',
      priority: 'high',
    }));

    await this.preloadResources(styleResources);
  }

  /**
   * 预加载 JavaScript 文件
   */
  async preloadScripts(scriptUrls: string[]): Promise<void> {
    const scriptResources: PreloadResource[] = scriptUrls.map(url => ({
      url,
      type: 'script',
      priority: 'medium',
    }));

    await this.preloadResources(scriptResources);
  }

  /**
   * 获取预加载统计信息
   */
  getStats(): PreloadStats {
    return { ...this.stats };
  }

  /**
   * 重置预加载器
   */
  reset(): void {
    this.preloadedResources.clear();
    this.loadingResources.clear();
    this.stats = {
      total: 0,
      loaded: 0,
      failed: 0,
      startTime: Date.now(),
    };
  }

  /**
   * 检查资源是否已预加载
   */
  isPreloaded(url: string): boolean {
    return this.preloadedResources.has(url);
  }

  /**
   * 检查资源是否正在加载
   */
  isLoading(url: string): boolean {
    return this.loadingResources.has(url);
  }

  /**
   * 获取预加载进度
   */
  getProgress(): { loaded: number; total: number; percentage: number } {
    const percentage = this.stats.total > 0 
      ? Math.round((this.stats.loaded / this.stats.total) * 100)
      : 0;
    
    return {
      loaded: this.stats.loaded,
      total: this.stats.total,
      percentage,
    };
  }
}

/**
 * 默认预加载配置
 */
export const DEFAULT_PRELOAD_RESOURCES: PreloadResource[] = [
  // 关键字体
  {
    url: '/fonts/NotoSansSC-Regular.woff2',
    type: 'font',
    priority: 'high',
    crossOrigin: 'anonymous',
  },
  {
    url: '/fonts/NotoSansSC-Medium.woff2',
    type: 'font',
    priority: 'high',
    crossOrigin: 'anonymous',
  },
  
  // 关键样式
  {
    url: '/css/critical.css',
    type: 'style',
    priority: 'high',
  },
  {
    url: '/css/theme.css',
    type: 'style',
    priority: 'high',
  },
  
  // 关键图片
  {
    url: '/images/logo.png',
    type: 'image',
    priority: 'high',
  },
  {
    url: '/images/avatar-placeholder.svg',
    type: 'image',
    priority: 'medium',
  },
  
  // 核心脚本
  {
    url: '/js/core.js',
    type: 'script',
    priority: 'medium',
  },
];

/**
 * 创建全局资源预加载器实例
 */
export const resourcePreloader = new ResourcePreloader();

/**
 * 智能资源预加载
 * 根据网络状况和设备性能调整预加载策略
 */
export async function smartPreloadResources(
  resources: PreloadResource[] = DEFAULT_PRELOAD_RESOURCES,
  options: PreloadOptions = {}
): Promise<void> {
  // 检查网络状况
  const connection = (navigator as any).connection;
  const isSlowConnection = connection && 
    (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
  
  // 检查设备内存
  const deviceMemory = (navigator as any).deviceMemory;
  const isLowMemoryDevice = deviceMemory && deviceMemory <= 4;

  // 根据条件调整资源列表
  let filteredResources = resources;
  
  if (isSlowConnection) {
    // 慢网络只预加载高优先级资源
    filteredResources = resources.filter(r => r.priority === 'high');
    console.log('Slow connection detected: preloading only high priority resources');
  } else if (isLowMemoryDevice) {
    // 低内存设备减少预加载量
    filteredResources = resources.filter(r => r.priority !== 'low');
    console.log('Low memory device detected: skipping low priority resources');
  }

  await resourcePreloader.preloadResources(filteredResources, {
    timeout: isSlowConnection ? 20000 : 10000,
    retryCount: isSlowConnection ? 1 : 2,
    ...options,
  });
}

/**
 * 页面可见时预加载资源
 */
export function preloadOnVisible(
  resources: PreloadResource[],
  options: PreloadOptions = {}
): void {
  if (document.visibilityState === 'visible') {
    smartPreloadResources(resources, options).catch(console.error);
  } else {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        smartPreloadResources(resources, options).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
}

/**
 * 空闲时预加载资源
 */
export function preloadOnIdle(
  resources: PreloadResource[],
  options: PreloadOptions = {}
): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(
      () => smartPreloadResources(resources, options).catch(console.error),
      { timeout: 5000 }
    );
  } else {
    // 降级处理
    setTimeout(
      () => smartPreloadResources(resources, options).catch(console.error),
      3000
    );
  }
}

// 导出类型
export type { PreloadResource, PreloadOptions, PreloadStats };
