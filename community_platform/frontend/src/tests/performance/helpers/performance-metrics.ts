/**
 * 性能指标辅助工具
 * 用于收集和分析性能数据
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint

  // 其他性能指标
  domContentLoaded?: number;
  loadComplete?: number;
  firstPaint?: number;
  memoryUsage?: number;
}

export interface PerformanceThresholds {
  LCP: { good: number; needsImprovement: number };
  FID: { good: number; needsImprovement: number };
  CLS: { good: number; needsImprovement: number };
  FCP: { good: number; needsImprovement: number };
  TTFB: { good: number; needsImprovement: number };
  INP: { good: number; needsImprovement: number };
}

/**
 * Web Vitals 性能阈值（基于 Google 标准）
 */
export const WEB_VITALS_THRESHOLDS: PerformanceThresholds = {
  LCP: { good: 2500, needsImprovement: 4000 }, // ms
  FID: { good: 100, needsImprovement: 300 }, // ms
  CLS: { good: 0.1, needsImprovement: 0.25 }, // 分数
  FCP: { good: 1800, needsImprovement: 3000 }, // ms
  TTFB: { good: 800, needsImprovement: 1800 }, // ms
  INP: { good: 200, needsImprovement: 500 }, // ms
};

/**
 * 评估单个性能指标
 */
export function evaluateMetric(
  metric: keyof PerformanceThresholds,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = WEB_VITALS_THRESHOLDS[metric];
  
  if (value <= threshold.good) {
    return 'good';
  } else if (value <= threshold.needsImprovement) {
    return 'needs-improvement';
  } else {
    return 'poor';
  }
}

/**
 * 生成性能报告
 */
export function generatePerformanceReport(metrics: PerformanceMetrics): {
  metrics: PerformanceMetrics;
  evaluations: Record<string, string>;
  score: number;
  passed: boolean;
} {
  const evaluations: Record<string, string> = {};
  let totalScore = 0;
  let metricCount = 0;

  // 评估 Core Web Vitals
  if (metrics.LCP !== undefined) {
    evaluations.LCP = evaluateMetric('LCP', metrics.LCP);
    totalScore += evaluations.LCP === 'good' ? 100 : evaluations.LCP === 'needs-improvement' ? 50 : 0;
    metricCount++;
  }

  if (metrics.FID !== undefined) {
    evaluations.FID = evaluateMetric('FID', metrics.FID);
    totalScore += evaluations.FID === 'good' ? 100 : evaluations.FID === 'needs-improvement' ? 50 : 0;
    metricCount++;
  }

  if (metrics.CLS !== undefined) {
    evaluations.CLS = evaluateMetric('CLS', metrics.CLS);
    totalScore += evaluations.CLS === 'good' ? 100 : evaluations.CLS === 'needs-improvement' ? 50 : 0;
    metricCount++;
  }

  if (metrics.FCP !== undefined) {
    evaluations.FCP = evaluateMetric('FCP', metrics.FCP);
    totalScore += evaluations.FCP === 'good' ? 100 : evaluations.FCP === 'needs-improvement' ? 50 : 0;
    metricCount++;
  }

  if (metrics.TTFB !== undefined) {
    evaluations.TTFB = evaluateMetric('TTFB', metrics.TTFB);
    totalScore += evaluations.TTFB === 'good' ? 100 : evaluations.TTFB === 'needs-improvement' ? 50 : 0;
    metricCount++;
  }

  const averageScore = metricCount > 0 ? totalScore / metricCount : 0;
  const passed = averageScore >= 70; // 70分及以上算通过

  return {
    metrics,
    evaluations,
    score: Math.round(averageScore),
    passed,
  };
}

/**
 * 格式化性能指标用于显示
 */
export function formatMetric(metric: keyof PerformanceMetrics, value: number): string {
  if (metric === 'CLS') {
    return value.toFixed(3);
  }
  if (metric === 'memoryUsage') {
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${Math.round(value)} ms`;
}

/**
 * 比较性能指标
 */
export function compareMetrics(
  baseline: PerformanceMetrics,
  current: PerformanceMetrics
): Record<string, { diff: number; percentage: number }> {
  const comparison: Record<string, { diff: number; percentage: number }> = {};

  for (const key in baseline) {
    const metricKey = key as keyof PerformanceMetrics;
    const baseValue = baseline[metricKey];
    const currentValue = current[metricKey];

    if (baseValue !== undefined && currentValue !== undefined) {
      const diff = currentValue - baseValue;
      const percentage = (diff / baseValue) * 100;
      comparison[key] = { diff, percentage };
    }
  }

  return comparison;
}

