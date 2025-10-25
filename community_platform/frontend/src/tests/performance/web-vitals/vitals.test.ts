/**
 * Web Vitals 性能测试
 * 测试 Core Web Vitals 和其他关键性能指标
 */

import { test, expect, chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import {
  WEB_VITALS_THRESHOLDS,
  evaluateMetric,
  generatePerformanceReport,
  type PerformanceMetrics,
} from '../helpers/performance-metrics';

test.describe('Web Vitals Tests', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should measure LCP (Largest Contentful Paint) on home page', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          const value = lastEntry.renderTime || lastEntry.loadTime;
          resolve(value);
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // 超时保护
        setTimeout(() => resolve(0), 10000);
      });
    });

    console.log(`🎯 LCP: ${lcp.toFixed(2)}ms`);
    console.log(`   Threshold: ${WEB_VITALS_THRESHOLDS.LCP.good}ms (good)`);
    console.log(`   Rating: ${evaluateMetric('LCP', lcp)}`);

    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(WEB_VITALS_THRESHOLDS.LCP.needsImprovement);
  });

  test('should measure FCP (First Contentful Paint)', async () => {
    await page.goto('/');

    const fcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              resolve(entry.startTime);
            }
          }
        });

        observer.observe({ type: 'paint', buffered: true });

        setTimeout(() => resolve(0), 5000);
      });
    });

    console.log(`🎨 FCP: ${fcp.toFixed(2)}ms`);
    console.log(`   Threshold: ${WEB_VITALS_THRESHOLDS.FCP.good}ms (good)`);
    console.log(`   Rating: ${evaluateMetric('FCP', fcp)}`);

    expect(fcp).toBeGreaterThan(0);
    expect(fcp).toBeLessThan(WEB_VITALS_THRESHOLDS.FCP.needsImprovement);
  });

  test('should measure CLS (Cumulative Layout Shift)', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 等待一段时间让布局稳定
    await page.waitForTimeout(3000);

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            // 只计算非用户输入导致的布局偏移
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });

        observer.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 3000);
      });
    });

    console.log(`📐 CLS: ${cls.toFixed(4)}`);
    console.log(`   Threshold: ${WEB_VITALS_THRESHOLDS.CLS.good} (good)`);
    console.log(`   Rating: ${evaluateMetric('CLS', cls)}`);

    expect(cls).toBeLessThan(WEB_VITALS_THRESHOLDS.CLS.needsImprovement);
  });

  test('should measure FID (First Input Delay)', async () => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // 测量第一次交互的延迟
    const fid = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            const firstEntry = entries[0] as any;
            resolve(firstEntry.processingStart - firstEntry.startTime);
          }
        });

        observer.observe({ type: 'first-input', buffered: true });

        // 模拟用户交互
        setTimeout(() => {
          document.body.click();
        }, 100);

        // 超时保护
        setTimeout(() => resolve(0), 5000);
      });
    });

    if (fid > 0) {
      console.log(`⚡ FID: ${fid.toFixed(2)}ms`);
      console.log(`   Threshold: ${WEB_VITALS_THRESHOLDS.FID.good}ms (good)`);
      console.log(`   Rating: ${evaluateMetric('FID', fid)}`);

      expect(fid).toBeLessThan(WEB_VITALS_THRESHOLDS.FID.needsImprovement);
    } else {
      console.log('⚠️  FID could not be measured (no user interaction detected)');
    }
  });

  test('should measure INP (Interaction to Next Paint)', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 执行多次交互来测量 INP
    const inpValues: number[] = [];

    for (let i = 0; i < 5; i++) {
      const interactionTime = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          const startTime = performance.now();
          
          // 模拟点击交互
          const button = document.querySelector('button') || document.body;
          button.click();

          // 等待下一次绘制
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const endTime = performance.now();
              resolve(endTime - startTime);
            });
          });
        });
      });

      inpValues.push(interactionTime);
      await page.waitForTimeout(200);
    }

    const inp = Math.max(...inpValues);

    console.log(`🖱️  INP: ${inp.toFixed(2)}ms`);
    console.log(`   Individual interactions: ${inpValues.map(v => v.toFixed(2)).join(', ')}ms`);
    console.log(`   Threshold: ${WEB_VITALS_THRESHOLDS.INP.good}ms (good)`);
    console.log(`   Rating: ${evaluateMetric('INP', inp)}`);

    expect(inp).toBeLessThan(WEB_VITALS_THRESHOLDS.INP.needsImprovement);
  });

  test('should measure TTFB (Time to First Byte)', async () => {
    const startTime = Date.now();
    
    await page.goto('/');

    const ttfb = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navigation.responseStart - navigation.requestStart;
    });

    console.log(`📡 TTFB: ${ttfb.toFixed(2)}ms`);
    console.log(`   Threshold: ${WEB_VITALS_THRESHOLDS.TTFB.good}ms (good)`);
    console.log(`   Rating: ${evaluateMetric('TTFB', ttfb)}`);

    expect(ttfb).toBeGreaterThan(0);
    expect(ttfb).toBeLessThan(WEB_VITALS_THRESHOLDS.TTFB.needsImprovement);
  });

  test('should generate comprehensive performance report', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const metrics = await page.evaluate(async () => {
      const performanceMetrics: any = {};

      // LCP
      const lcpPromise = new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.renderTime || lastEntry.loadTime);
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(0), 3000);
      });

      // FCP
      const fcpPromise = new Promise<number>((resolve) => {
        const entry = performance.getEntriesByType('paint')
          .find(e => e.name === 'first-contentful-paint');
        resolve(entry ? entry.startTime : 0);
      });

      // CLS
      const clsPromise = new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 2000);
      });

      // TTFB
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const ttfb = navigation.responseStart - navigation.requestStart;

      performanceMetrics.LCP = await lcpPromise;
      performanceMetrics.FCP = await fcpPromise;
      performanceMetrics.CLS = await clsPromise;
      performanceMetrics.TTFB = ttfb;
      performanceMetrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
      performanceMetrics.loadComplete = navigation.loadEventEnd - navigation.loadEventStart;

      return performanceMetrics;
    });

    const report = generatePerformanceReport(metrics as PerformanceMetrics);

    console.log('\n📊 Performance Report:');
    console.log('='.repeat(50));
    console.log(`Score: ${report.score}/100`);
    console.log(`Status: ${report.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\nMetrics:');
    Object.entries(report.metrics).forEach(([key, value]) => {
      if (value !== undefined) {
        const evaluation = report.evaluations[key];
        const emoji = evaluation === 'good' ? '✅' : evaluation === 'needs-improvement' ? '⚠️' : '❌';
        console.log(`  ${emoji} ${key}: ${typeof value === 'number' ? value.toFixed(2) : value} (${evaluation})`);
      }
    });
    console.log('='.repeat(50));

    // 报告应该通过（分数 >= 70）
    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(70);
  });

  test('should test Web Vitals on different pages', async () => {
    const pages = ['/', '/dashboard', '/content'];
    const results: Record<string, any> = {};

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      const metrics = await page.evaluate(async () => {
        // 测量 LCP
        const lcp = await new Promise<number>((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            resolve(lastEntry.renderTime || lastEntry.loadTime);
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(0), 3000);
        });

        // 测量 FCP
        const entry = performance.getEntriesByType('paint')
          .find(e => e.name === 'first-contentful-paint');
        const fcp = entry ? entry.startTime : 0;

        // 测量 TTFB
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const ttfb = navigation.responseStart - navigation.requestStart;

        return { lcp, fcp, ttfb };
      });

      results[pagePath] = metrics;
    }

    console.log('\n📊 Web Vitals Comparison:');
    console.log('='.repeat(70));
    console.log('Page'.padEnd(20) + 'LCP (ms)'.padEnd(15) + 'FCP (ms)'.padEnd(15) + 'TTFB (ms)');
    console.log('-'.repeat(70));

    for (const [pagePath, metrics] of Object.entries(results)) {
      console.log(
        pagePath.padEnd(20) +
        metrics.lcp.toFixed(2).padEnd(15) +
        metrics.fcp.toFixed(2).padEnd(15) +
        metrics.ttfb.toFixed(2)
      );
    }
    console.log('='.repeat(70));

    // 所有页面的核心指标都应该在合理范围内
    for (const [pagePath, metrics] of Object.entries(results)) {
      expect(metrics.lcp, `${pagePath} LCP`).toBeLessThan(WEB_VITALS_THRESHOLDS.LCP.needsImprovement);
      expect(metrics.fcp, `${pagePath} FCP`).toBeLessThan(WEB_VITALS_THRESHOLDS.FCP.needsImprovement);
      expect(metrics.ttfb, `${pagePath} TTFB`).toBeLessThan(WEB_VITALS_THRESHOLDS.TTFB.needsImprovement);
    }
  });

  test('should measure Web Vitals on mobile devices', async () => {
    // 设置移动设备视口
    await page.setViewportSize({ width: 375, height: 812 });

    // 模拟移动网络（Fast 3G）
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1.5 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 200,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(async () => {
      const lcp = await new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.renderTime || lastEntry.loadTime);
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(0), 5000);
      });

      const entry = performance.getEntriesByType('paint')
        .find(e => e.name === 'first-contentful-paint');
      const fcp = entry ? entry.startTime : 0;

      return { lcp, fcp };
    });

    console.log('\n📱 Mobile Web Vitals (Fast 3G):');
    console.log(`   LCP: ${metrics.lcp.toFixed(2)}ms`);
    console.log(`   FCP: ${metrics.fcp.toFixed(2)}ms`);

    // 移动设备上的指标可以稍微放宽一些
    expect(metrics.lcp).toBeLessThan(WEB_VITALS_THRESHOLDS.LCP.needsImprovement * 1.5);
    expect(metrics.fcp).toBeLessThan(WEB_VITALS_THRESHOLDS.FCP.needsImprovement * 1.5);
  });
});

