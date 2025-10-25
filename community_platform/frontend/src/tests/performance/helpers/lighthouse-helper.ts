/**
 * Lighthouse 测试辅助工具
 */

export interface LighthouseThresholds {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa?: number;
}

/**
 * 默认 Lighthouse 阈值
 */
export const DEFAULT_LIGHTHOUSE_THRESHOLDS: LighthouseThresholds = {
  performance: 90,
  accessibility: 90,
  bestPractices: 90,
  seo: 90,
  pwa: 80,
};

/**
 * 严格的 Lighthouse 阈值（用于关键页面）
 */
export const STRICT_LIGHTHOUSE_THRESHOLDS: LighthouseThresholds = {
  performance: 95,
  accessibility: 95,
  bestPractices: 95,
  seo: 95,
  pwa: 90,
};

/**
 * 宽松的 Lighthouse 阈值（用于复杂页面）
 */
export const RELAXED_LIGHTHOUSE_THRESHOLDS: LighthouseThresholds = {
  performance: 80,
  accessibility: 85,
  bestPractices: 85,
  seo: 85,
  pwa: 70,
};

/**
 * 页面配置接口
 */
export interface PageConfig {
  name: string;
  path: string;
  thresholds: LighthouseThresholds;
  description?: string;
  beforeTest?: () => Promise<void>;
  afterTest?: () => Promise<void>;
}

/**
 * 需要测试的页面列表
 */
export const PAGES_TO_TEST: PageConfig[] = [
  {
    name: 'Home',
    path: '/',
    thresholds: STRICT_LIGHTHOUSE_THRESHOLDS,
    description: '首页 - 应用入口，性能要求最高',
  },
  {
    name: 'Dashboard',
    path: '/dashboard',
    thresholds: DEFAULT_LIGHTHOUSE_THRESHOLDS,
    description: '用户仪表板',
  },
  {
    name: 'Learning',
    path: '/learning',
    thresholds: DEFAULT_LIGHTHOUSE_THRESHOLDS,
    description: '学习中心页面',
  },
  {
    name: 'Content Browse',
    path: '/content',
    thresholds: RELAXED_LIGHTHOUSE_THRESHOLDS,
    description: '内容浏览页面 - 数据量大',
  },
  {
    name: 'Profile',
    path: '/profile',
    thresholds: DEFAULT_LIGHTHOUSE_THRESHOLDS,
    description: '用户个人资料页面',
  },
];

/**
 * Lighthouse 配置选项
 */
export const LIGHTHOUSE_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
    formFactor: 'desktop' as const,
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
  },
};

/**
 * 移动端 Lighthouse 配置
 */
export const LIGHTHOUSE_MOBILE_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
    formFactor: 'mobile' as const,
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: {
      mobile: true,
      width: 360,
      height: 640,
      deviceScaleFactor: 2.625,
      disabled: false,
    },
  },
};

/**
 * 评估 Lighthouse 分数
 */
export function evaluateLighthouseScore(
  score: number,
  threshold: number
): { passed: boolean; status: 'excellent' | 'good' | 'needs-improvement' | 'poor' } {
  const passed = score >= threshold;
  let status: 'excellent' | 'good' | 'needs-improvement' | 'poor';

  if (score >= 95) {
    status = 'excellent';
  } else if (score >= 90) {
    status = 'good';
  } else if (score >= 80) {
    status = 'needs-improvement';
  } else {
    status = 'poor';
  }

  return { passed, status };
}

/**
 * 生成 Lighthouse 报告摘要
 */
export function generateLighthouseSummary(results: {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa?: number;
}): string {
  const lines = [
    '🚀 Lighthouse 测试结果:',
    `   性能 (Performance): ${results.performance}`,
    `   可访问性 (Accessibility): ${results.accessibility}`,
    `   最佳实践 (Best Practices): ${results.bestPractices}`,
    `   SEO: ${results.seo}`,
  ];

  if (results.pwa !== undefined) {
    lines.push(`   PWA: ${results.pwa}`);
  }

  return lines.join('\n');
}

