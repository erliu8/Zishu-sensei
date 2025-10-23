/**
 * Web Vitals 性能监控
 * 监控 LCP, FID, CLS, TTFB, FCP 等核心性能指标
 */

import type { Metric } from 'web-vitals';

/**
 * 性能指标类型
 */
export type WebVitalMetricName = 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP';

/**
 * 性能指标数据
 */
export interface WebVitalMetric {
  id: string;
  name: WebVitalMetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
}

/**
 * 性能监控配置
 */
export interface WebVitalsConfig {
  enabled: boolean;
  reportToAnalytics?: boolean;
  reportToSentry?: boolean;
  reportToConsole?: boolean;
  onMetric?: (metric: WebVitalMetric) => void;
}

/**
 * 性能指标阈值
 */
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

/**
 * 获取性能评级
 */
function getRating(
  name: WebVitalMetricName,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * 格式化指标数据
 */
function formatMetric(metric: Metric): WebVitalMetric {
  return {
    id: metric.id,
    name: metric.name as WebVitalMetricName,
    value: metric.value,
    rating: getRating(metric.name as WebVitalMetricName, metric.value),
    delta: metric.delta,
    navigationType: metric.navigationType,
  };
}

/**
 * 初始化 Web Vitals 监控
 */
export async function initWebVitals(config: WebVitalsConfig): Promise<void> {
  if (!config.enabled) {
    console.warn('Web Vitals monitoring is disabled');
    return;
  }

  try {
    // 动态导入 web-vitals 以避免增加初始包大小
    const { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals');

    const handleMetric = (metric: Metric) => {
      const formattedMetric = formatMetric(metric);

      // 控制台输出
      if (config.reportToConsole) {
        console.log(
          `[Web Vitals] ${formattedMetric.name}:`,
          `${formattedMetric.value.toFixed(2)}ms`,
          `(${formattedMetric.rating})`
        );
      }

      // 上报到 Google Analytics
      if (config.reportToAnalytics && window.gtag) {
        window.gtag('event', formattedMetric.name, {
          value: Math.round(formattedMetric.value),
          metric_id: formattedMetric.id,
          metric_value: formattedMetric.value,
          metric_delta: formattedMetric.delta,
          metric_rating: formattedMetric.rating,
          event_category: 'Web Vitals',
          event_label: formattedMetric.id,
          non_interaction: true,
        });
      }

      // 上报到 Sentry
      if (config.reportToSentry) {
        import('./sentry').then(({ Sentry }) => {
          Sentry.setMeasurement(formattedMetric.name, formattedMetric.value, 'millisecond');
        });
      }

      // 自定义回调
      if (config.onMetric) {
        config.onMetric(formattedMetric);
      }
    };

    // 监听各项指标
    onCLS(handleMetric);
    onFID(handleMetric);
    onFCP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
    onINP(handleMetric);
  } catch (error) {
    console.error('Failed to initialize Web Vitals:', error);
  }
}

/**
 * 手动获取性能指标
 */
export async function getWebVitals(): Promise<Record<WebVitalMetricName, number>> {
  const vitals: Partial<Record<WebVitalMetricName, number>> = {};

  try {
    const { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals');

    await Promise.all([
      new Promise<void>((resolve) => {
        onCLS((metric) => {
          vitals.CLS = metric.value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        onFID((metric) => {
          vitals.FID = metric.value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        onFCP((metric) => {
          vitals.FCP = metric.value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        onLCP((metric) => {
          vitals.LCP = metric.value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        onTTFB((metric) => {
          vitals.TTFB = metric.value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        onINP((metric) => {
          vitals.INP = metric.value;
          resolve();
        });
      }),
    ]);
  } catch (error) {
    console.error('Failed to get Web Vitals:', error);
  }

  return vitals as Record<WebVitalMetricName, number>;
}

/**
 * 性能报告生成器
 */
export async function generatePerformanceReport(): Promise<{
  vitals: Record<WebVitalMetricName, number>;
  ratings: Record<WebVitalMetricName, 'good' | 'needs-improvement' | 'poor'>;
  score: number;
}> {
  const vitals = await getWebVitals();
  const ratings: Partial<Record<WebVitalMetricName, 'good' | 'needs-improvement' | 'poor'>> = {};
  
  let totalScore = 0;
  let metricCount = 0;

  Object.entries(vitals).forEach(([name, value]) => {
    const metricName = name as WebVitalMetricName;
    ratings[metricName] = getRating(metricName, value);
    
    // 计算得分 (good=100, needs-improvement=50, poor=0)
    const ratingScore = ratings[metricName] === 'good' ? 100 : 
                       ratings[metricName] === 'needs-improvement' ? 50 : 0;
    totalScore += ratingScore;
    metricCount++;
  });

  const score = metricCount > 0 ? Math.round(totalScore / metricCount) : 0;

  return {
    vitals,
    ratings: ratings as Record<WebVitalMetricName, 'good' | 'needs-improvement' | 'poor'>,
    score,
  };
}

/**
 * 监控资源加载性能
 */
export function monitorResourceTiming(): void {
  if (!window.performance || !window.performance.getEntriesByType) {
    return;
  }

  const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  const slowResources = resources.filter((resource) => resource.duration > 1000);
  
  if (slowResources.length > 0) {
    console.warn('Slow resources detected:', slowResources);
    
    // 上报到分析系统
    slowResources.forEach((resource) => {
      if (window.gtag) {
        window.gtag('event', 'slow_resource', {
          resource_name: resource.name,
          duration: Math.round(resource.duration),
          event_category: 'Performance',
          non_interaction: true,
        });
      }
    });
  }
}

/**
 * 监控长任务
 */
export function monitorLongTasks(): void {
  if (!('PerformanceObserver' in window)) {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.warn('Long task detected:', entry);
        
        if (window.gtag) {
          window.gtag('event', 'long_task', {
            duration: Math.round(entry.duration),
            start_time: Math.round(entry.startTime),
            event_category: 'Performance',
            non_interaction: true,
          });
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    console.error('Failed to observe long tasks:', error);
  }
}

/**
 * Next.js 专用：上报 Web Vitals
 * 在 _app.tsx 中使用
 */
export function reportWebVitals(metric: Metric): void {
  const formattedMetric = formatMetric(metric);

  // 上报到 Google Analytics
  if (window.gtag) {
    window.gtag('event', formattedMetric.name, {
      value: Math.round(formattedMetric.value),
      metric_id: formattedMetric.id,
      metric_rating: formattedMetric.rating,
      event_category: 'Web Vitals',
      non_interaction: true,
    });
  }

  // 在开发环境下输出到控制台
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${formattedMetric.name}:`, formattedMetric);
  }
}

