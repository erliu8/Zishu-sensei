/**
 * 性能监控工具
 * 提供 Web Vitals 监控、性能指标收集等功能
 */

/**
 * Web Vitals 指标
 */
export interface WebVitalsMetric {
  name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  // 首次内容绘制
  fcp?: number;
  // 最大内容绘制
  lcp?: number;
  // 首次输入延迟
  fid?: number;
  // 累积布局偏移
  cls?: number;
  // 首字节时间
  ttfb?: number;
  // 交互到下一次绘制
  inp?: number;
  // 总阻塞时间
  tbt?: number;
  // 页面加载时间
  loadTime?: number;
  // DOM 内容加载时间
  domContentLoaded?: number;
  // 资源加载时间
  resourceLoadTime?: number;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  /**
   * 初始化监控
   */
  private init(): void {
    // 监听 Web Vitals
    this.observeWebVitals();
    
    // 监听导航计时
    this.observeNavigationTiming();
    
    // 监听资源计时
    this.observeResourceTiming();
    
    // 监听长任务
    this.observeLongTasks();
  }

  /**
   * 监听 Web Vitals
   */
  private observeWebVitals(): void {
    // 使用 web-vitals 库
    import('web-vitals').then(({ onFCP, onLCP, onCLS, onTTFB, onINP }) => {
      onFCP((metric) => this.handleMetric(metric));
      onLCP((metric) => this.handleMetric(metric));
      onINP((metric) => this.handleMetric(metric));
      onCLS((metric) => this.handleMetric(metric));
      onTTFB((metric) => this.handleMetric(metric));
      onINP((metric) => this.handleMetric(metric));
    });
  }

  /**
   * 处理指标
   */
  private handleMetric(metric: WebVitalsMetric): void {
    const metricName = metric.name.toLowerCase() as keyof PerformanceMetrics;
    this.metrics[metricName] = metric.value;

    // 发送到监控服务
    this.sendMetric(metric);

    // 控制台输出（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${metric.name}:`, {
        value: metric.value.toFixed(2),
        rating: metric.rating,
      });
    }
  }

  /**
   * 监听导航计时
   */
  private observeNavigationTiming(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      
      if (navigationEntries.length > 0) {
        const entry = navigationEntries[0];
        
        if (entry) {
          this.metrics.loadTime = entry.loadEventEnd - entry.fetchStart;
          this.metrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.fetchStart;
          this.metrics.ttfb = entry.responseStart - entry.requestStart;
        }
      }
    }
  }

  /**
   * 监听资源计时
   */
  private observeResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              this.analyzeResource(resourceEntry);
            }
          }
        });

        observer.observe({ entryTypes: ['resource'] });
        this.observers.push(observer);
      } catch (error) {
        console.error('资源计时监控失败:', error);
      }
    }
  }

  /**
   * 分析资源
   */
  private analyzeResource(entry: PerformanceResourceTiming): void {
    const duration = entry.duration;
    const size = entry.transferSize || 0;

    // 检查慢资源
    if (duration > 1000) {
      console.warn(`慢资源: ${entry.name} (${duration.toFixed(2)}ms)`);
    }

    // 检查大资源
    if (size > 500 * 1024) {
      console.warn(`大资源: ${entry.name} (${(size / 1024 / 1024).toFixed(2)}MB)`);
    }
  }

  /**
   * 监听长任务
   */
  private observeLongTasks(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn(`长任务检测: ${entry.duration.toFixed(2)}ms`);
            }
          }
        });

        observer.observe({ entryTypes: ['longtask'] });
        this.observers.push(observer);
      } catch (error) {
        // longtask API 可能不支持
        console.debug('长任务监控不支持');
      }
    }
  }

  /**
   * 发送指标到监控服务
   */
  private sendMetric(metric: WebVitalsMetric): void {
    // 发送到 Google Analytics
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', metric.name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }

    // 发送到自定义监控服务
    this.sendToCustomService(metric);
  }

  /**
   * 发送到自定义监控服务
   */
  private async sendToCustomService(metric: WebVitalsMetric): Promise<void> {
    try {
      await fetch('/api/performance/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          timestamp: Date.now(),
          url: window.location.pathname,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('发送性能指标失败:', error);
    }
  }

  /**
   * 获取所有指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 清理
   */
  cleanup(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

/**
 * 性能标记工具
 */
export class PerformanceMark {
  /**
   * 开始标记
   */
  static start(name: string): void {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * 结束标记
   */
  static end(name: string): number | null {
    if ('performance' in window && 'mark' in performance && 'measure' in performance) {
      performance.mark(`${name}-end`);
      
      try {
        const measure = performance.measure(
          name,
          `${name}-start`,
          `${name}-end`
        );
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Performance] ${name}:`, `${measure.duration.toFixed(2)}ms`);
        }
        
        return measure.duration;
      } catch (error) {
        console.error('性能测量失败:', error);
        return null;
      }
    }
    
    return null;
  }

  /**
   * 清除标记
   */
  static clear(name?: string): void {
    if ('performance' in window) {
      if (name) {
        performance.clearMarks(`${name}-start`);
        performance.clearMarks(`${name}-end`);
        performance.clearMeasures(name);
      } else {
        performance.clearMarks();
        performance.clearMeasures();
      }
    }
  }
}

/**
 * 内存监控
 */
export class MemoryMonitor {
  /**
   * 获取内存使用情况
   */
  static getMemoryUsage(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    percentage: number;
  } | null {
    if (
      'performance' in window &&
      'memory' in performance &&
      (performance as never)['memory']
    ) {
      const memory = (performance as never)['memory'] as {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };

      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }

    return null;
  }

  /**
   * 监听内存使用
   */
  static monitorMemory(interval = 5000): () => void {
    const timer = setInterval(() => {
      const usage = this.getMemoryUsage();
      if (usage) {
        console.log('[Memory]', {
          used: `${(usage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(usage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(usage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
          percentage: `${usage.percentage.toFixed(2)}%`,
        });

        // 内存使用过高警告
        if (usage.percentage > 90) {
          console.warn('内存使用过高!', usage);
        }
      }
    }, interval);

    return () => clearInterval(timer);
  }
}

/**
 * FPS 监控
 */
export class FPSMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;
  private rafId: number | null = null;

  /**
   * 开始监控
   */
  start(callback?: (fps: number) => void): void {
    const loop = (time: number) => {
      this.frameCount++;
      const delta = time - this.lastTime;

      if (delta >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / delta);
        this.frameCount = 0;
        this.lastTime = time;

        if (callback) {
          callback(this.fps);
        }

        // FPS 过低警告
        if (this.fps < 30) {
          console.warn(`FPS 过低: ${this.fps}`);
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 获取当前 FPS
   */
  getFPS(): number {
    return this.fps;
  }
}

/**
 * 性能监控单例
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * 性能报告生成器
 */
export class PerformanceReportGenerator {
  /**
   * 生成性能报告
   */
  static async generateReport(): Promise<string> {
    const metrics = performanceMonitor.getMetrics();
    const memory = MemoryMonitor.getMemoryUsage();

    const lines: string[] = [];

    lines.push('# 性能监控报告\n');
    lines.push(`生成时间: ${new Date().toLocaleString()}\n`);
    lines.push(`页面: ${window.location.pathname}\n`);

    lines.push('## Web Vitals\n');
    lines.push('| 指标 | 值 | 状态 |');
    lines.push('|------|-----|------|');

    if (metrics.fcp) {
      const rating = this.getRating('FCP', metrics.fcp);
      lines.push(`| FCP | ${metrics.fcp.toFixed(2)}ms | ${rating} |`);
    }
    if (metrics.lcp) {
      const rating = this.getRating('LCP', metrics.lcp);
      lines.push(`| LCP | ${metrics.lcp.toFixed(2)}ms | ${rating} |`);
    }
    if (metrics.fid) {
      const rating = this.getRating('FID', metrics.fid);
      lines.push(`| FID | ${metrics.fid.toFixed(2)}ms | ${rating} |`);
    }
    if (metrics.cls) {
      const rating = this.getRating('CLS', metrics.cls);
      lines.push(`| CLS | ${metrics.cls.toFixed(3)} | ${rating} |`);
    }
    if (metrics.ttfb) {
      const rating = this.getRating('TTFB', metrics.ttfb);
      lines.push(`| TTFB | ${metrics.ttfb.toFixed(2)}ms | ${rating} |`);
    }

    if (memory) {
      lines.push('\n## 内存使用\n');
      lines.push(`- 已使用: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      lines.push(`- 总计: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      lines.push(`- 限制: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
      lines.push(`- 使用率: ${memory.percentage.toFixed(2)}%`);
    }

    return lines.join('\n');
  }

  /**
   * 获取指标评级
   */
  private static getRating(name: string, value: number): string {
    const thresholds: Record<string, { good: number; poor: number }> = {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1800 },
    };

    const threshold = thresholds[name];
    if (!threshold) return '⚪';

    if (value <= threshold.good) return '🟢 良好';
    if (value <= threshold.poor) return '🟡 需要改进';
    return '🔴 差';
  }
}

