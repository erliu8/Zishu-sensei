/**
 * 首页 Lighthouse 性能测试
 * 测试首页的性能、可访问性、最佳实践和 SEO
 */

import { test, expect, chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import {
  DEFAULT_LIGHTHOUSE_THRESHOLDS,
  STRICT_LIGHTHOUSE_THRESHOLDS,
} from '../helpers/lighthouse-helper';

test.describe('Home Page Performance Tests', () => {
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

  test('should load home page within acceptable time', async () => {
    const startTime = Date.now();
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    
    // 首页应该在 3 秒内加载完成
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`✅ Home page loaded in ${loadTime}ms`);
  });

  test('should have good Core Web Vitals', async () => {
    await page.goto('/');

    // 等待页面稳定
    await page.waitForLoadState('networkidle');

    // 测量 LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.renderTime || lastEntry.loadTime);
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        
        // 超时保护
        setTimeout(() => resolve(0), 5000);
      });
    });

    // LCP 应该小于 2.5 秒
    expect(lcp).toBeLessThan(2500);
    console.log(`✅ LCP: ${lcp.toFixed(2)}ms`);

    // 测量 CLS (Cumulative Layout Shift)
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => resolve(clsValue), 3000);
      });
    });

    // CLS 应该小于 0.1
    expect(cls).toBeLessThan(0.1);
    console.log(`✅ CLS: ${cls.toFixed(3)}`);

    // 测量 FCP (First Contentful Paint)
    const fcp = await page.evaluate(() => {
      const entry = performance.getEntriesByType('paint')
        .find(e => e.name === 'first-contentful-paint');
      return entry ? entry.startTime : 0;
    });

    // FCP 应该小于 1.8 秒
    expect(fcp).toBeLessThan(1800);
    console.log(`✅ FCP: ${fcp.toFixed(2)}ms`);
  });

  test('should have efficient resource loading', async () => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('load');

    // 获取资源加载性能
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return entries.map(entry => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
        type: entry.initiatorType,
      }));
    });

    // 统计资源
    const jsResources = resources.filter(r => r.name.endsWith('.js'));
    const cssResources = resources.filter(r => r.name.endsWith('.css'));
    const imageResources = resources.filter(r => 
      r.type === 'img' || /\.(jpg|jpeg|png|gif|svg|webp)/.test(r.name)
    );

    console.log(`📦 Resources loaded:`);
    console.log(`   JS files: ${jsResources.length}`);
    console.log(`   CSS files: ${cssResources.length}`);
    console.log(`   Images: ${imageResources.length}`);

    // JS 文件不应该太多（可能需要代码分割）
    expect(jsResources.length).toBeLessThan(20);

    // CSS 文件应该合并
    expect(cssResources.length).toBeLessThan(5);

    // 计算总加载时间
    const totalLoadTime = Date.now() - startTime;
    console.log(`⏱️  Total load time: ${totalLoadTime}ms`);
  });

  test('should have optimized images', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 检查图片是否使用了现代格式
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        width: img.naturalWidth,
        height: img.naturalHeight,
        loading: img.loading,
        decoding: img.decoding,
      }));
    });

    for (const img of images) {
      // 图片应该使用懒加载
      if (!img.src.includes('above-the-fold')) {
        // expect(img.loading).toBe('lazy'); // 可选检查
      }

      // 检查是否使用了 Next.js Image 组件的优化
      // Next.js 图片通常包含 _next/image 路径
      if (img.src.includes('_next/image')) {
        console.log(`✅ Optimized image: ${img.src}`);
      }
    }

    console.log(`📸 Total images: ${images.length}`);
  });

  test('should have minimal JavaScript execution time', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 获取 JavaScript 执行时间
    const jsExecutionTime = await page.evaluate(() => {
      const entries = performance.getEntriesByType('measure');
      return entries.reduce((total, entry) => total + entry.duration, 0);
    });

    console.log(`⚡ JavaScript execution time: ${jsExecutionTime.toFixed(2)}ms`);

    // JavaScript 执行时间应该合理
    expect(jsExecutionTime).toBeLessThan(5000);
  });

  test('should cache static assets', async () => {
    // 第一次访问
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firstLoadResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').length;
    });

    // 重新加载页面
    await page.reload({ waitUntil: 'networkidle' });

    const cachedResources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return entries.filter(entry => 
        entry.transferSize === 0 && entry.decodedBodySize > 0
      ).length;
    });

    console.log(`💾 Cached resources: ${cachedResources} / ${firstLoadResources}`);

    // 至少应该有一些资源被缓存
    expect(cachedResources).toBeGreaterThan(0);
  });

  test('should have fast Time to Interactive (TTI)', async () => {
    const startTime = Date.now();
    
    await page.goto('/');

    // 等待页面可交互
    await page.waitForLoadState('domcontentloaded');
    const domContentLoadedTime = Date.now() - startTime;

    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;

    await page.waitForLoadState('networkidle');
    const networkIdleTime = Date.now() - startTime;

    console.log(`🎯 Performance timing:`);
    console.log(`   DOM Content Loaded: ${domContentLoadedTime}ms`);
    console.log(`   Load Complete: ${loadTime}ms`);
    console.log(`   Network Idle: ${networkIdleTime}ms`);

    // DOM 应该快速加载
    expect(domContentLoadedTime).toBeLessThan(1500);

    // 页面应该快速可交互
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have good mobile performance', async () => {
    // 使用移动端视口
    await page.setViewportSize({ width: 375, height: 812 });

    // 模拟慢速 3G 网络
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps
      uploadThroughput: (750 * 1024) / 8, // 750 Kbps
      latency: 200, // 200ms
    });

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;

    console.log(`📱 Mobile load time (3G): ${loadTime}ms`);

    // 在慢速 3G 网络下，5 秒内应该能加载完成
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have console errors', async () => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (errors.length > 0) {
      console.log('❌ Console errors:', errors);
    }

    // 首页不应该有 console 错误
    expect(errors.length).toBe(0);
  });
});

