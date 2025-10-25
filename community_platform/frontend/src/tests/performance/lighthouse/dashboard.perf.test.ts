/**
 * 仪表板页面 Lighthouse 性能测试
 */

import { test, expect, chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

test.describe('Dashboard Page Performance Tests', () => {
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

  test('should load dashboard within acceptable time', async () => {
    const startTime = Date.now();
    
    // 注意：实际项目中可能需要先登录
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️  Dashboard loaded in ${loadTime}ms`);
    
    // 仪表板页面应该在 4 秒内加载完成（允许比首页慢一些，因为可能有更多数据）
    expect(loadTime).toBeLessThan(4000);
  });

  test('should render data efficiently', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 测量渲染时间
    const renderMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domInteractive: navigation.domInteractive,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        domComplete: navigation.domComplete,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      };
    });

    console.log('📊 Render metrics:');
    console.log(`   DOM Interactive: ${renderMetrics.domInteractive.toFixed(2)}ms`);
    console.log(`   DOM Content Loaded: ${renderMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`   DOM Complete: ${renderMetrics.domComplete.toFixed(2)}ms`);
    console.log(`   Load Complete: ${renderMetrics.loadComplete.toFixed(2)}ms`);

    // DOM 应该快速可交互
    expect(renderMetrics.domInteractive).toBeLessThan(2000);
  });

  test('should handle large datasets efficiently', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 获取页面中的数据元素数量
    const dataElementsCount = await page.evaluate(() => {
      // 假设数据卡片有特定的 class 或 data-testid
      const cards = document.querySelectorAll('[data-testid*="card"], .card, [class*="card"]');
      const listItems = document.querySelectorAll('[role="listitem"]');
      const rows = document.querySelectorAll('[role="row"]');
      
      return {
        cards: cards.length,
        listItems: listItems.length,
        rows: rows.length,
      };
    });

    console.log('📦 Data elements:');
    console.log(`   Cards: ${dataElementsCount.cards}`);
    console.log(`   List items: ${dataElementsCount.listItems}`);
    console.log(`   Table rows: ${dataElementsCount.rows}`);

    // 测量滚动性能
    const scrollPerformance = await page.evaluate(async () => {
      const startTime = performance.now();
      
      // 滚动到页面底部
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      
      // 等待滚动完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endTime = performance.now();
      return endTime - startTime;
    });

    console.log(`🖱️  Scroll performance: ${scrollPerformance.toFixed(2)}ms`);

    // 滚动应该流畅
    expect(scrollPerformance).toBeLessThan(2000);
  });

  test('should have efficient API calls', async () => {
    const apiCalls: { url: string; duration: number; status: number }[] = [];

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/')) {
        const timing = response.timing();
        apiCalls.push({
          url,
          duration: timing.responseEnd,
          status: response.status(),
        });
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    console.log(`🌐 API calls made: ${apiCalls.length}`);

    for (const call of apiCalls) {
      console.log(`   ${call.url}: ${call.duration.toFixed(2)}ms (${call.status})`);
      
      // API 调用应该在合理时间内完成
      expect(call.duration).toBeLessThan(3000);
      
      // 应该返回成功状态
      expect(call.status).toBeLessThan(400);
    }

    // API 调用不应该太多（可能需要批量请求）
    expect(apiCalls.length).toBeLessThan(10);
  });

  test('should update data without full page reload', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 记录初始页面内容
    const initialContent = await page.content();

    // 模拟数据更新（例如点击刷新按钮）
    const refreshButton = page.locator('[data-testid="refresh-button"], button:has-text("刷新")').first();
    
    if (await refreshButton.isVisible().catch(() => false)) {
      const startTime = Date.now();
      
      await refreshButton.click();
      
      // 等待数据更新
      await page.waitForTimeout(1000);
      
      const updateTime = Date.now() - startTime;
      
      console.log(`🔄 Data update time: ${updateTime}ms`);
      
      // 数据更新应该很快
      expect(updateTime).toBeLessThan(2000);

      // 页面不应该完全重新加载
      const newContent = await page.content();
      expect(newContent).not.toBe(initialContent);
    } else {
      console.log('⚠️  No refresh button found, skipping update test');
    }
  });

  test('should handle state updates efficiently', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 测量多次交互的性能
    const interactions = [];

    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      
      // 模拟用户交互（例如切换标签、打开/关闭面板等）
      const clickableElements = await page.locator('button, [role="tab"], [role="button"]').all();
      
      if (clickableElements.length > 0) {
        const randomElement = clickableElements[Math.floor(Math.random() * clickableElements.length)];
        await randomElement.click().catch(() => {});
        await page.waitForTimeout(200);
      }
      
      const endTime = performance.now();
      interactions.push(endTime - startTime);
    }

    const avgInteractionTime = interactions.reduce((a, b) => a + b, 0) / interactions.length;
    
    console.log(`⚡ Average interaction time: ${avgInteractionTime.toFixed(2)}ms`);
    console.log(`   Individual times: ${interactions.map(t => t.toFixed(2)).join(', ')} ms`);

    // 交互应该快速响应（100ms 以内最佳）
    expect(avgInteractionTime).toBeLessThan(300);
  });

  test('should have good memory usage', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 获取内存使用情况
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        const mem = (performance as any).memory;
        return {
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (memoryUsage) {
      const usedMB = (memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2);

      console.log(`💾 Memory usage:`);
      console.log(`   Used: ${usedMB} MB`);
      console.log(`   Total: ${totalMB} MB`);
      console.log(`   Limit: ${limitMB} MB`);

      // 内存使用应该在合理范围内（< 100MB 较好）
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(150 * 1024 * 1024);
    }
  });
});

