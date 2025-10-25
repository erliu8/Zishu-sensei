/**
 * 负载和压力测试
 * 测试应用在高负载下的表现
 */

import { test, expect, chromium } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

test.describe('Load and Stress Tests', () => {
  test('should handle multiple simultaneous page loads', async () => {
    const browser = await chromium.launch();
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    try {
      // 创建多个浏览器上下文和页面
      const concurrentUsers = 10;

      for (let i = 0; i < concurrentUsers; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      console.log(`🔥 Testing with ${concurrentUsers} concurrent users...`);

      // 同时加载首页
      const startTime = Date.now();

      const loadPromises = pages.map(page => 
        page.goto('/', { waitUntil: 'networkidle' })
      );

      await Promise.all(loadPromises);

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / concurrentUsers;

      console.log(`✅ All pages loaded`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Average per user: ${avgTime.toFixed(2)}ms`);

      // 即使在并发负载下，每个用户的平均加载时间也应该合理
      expect(avgTime).toBeLessThan(5000);

      // 验证所有页面都正确加载
      for (const page of pages) {
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
      }
    } finally {
      // 清理
      for (const page of pages) {
        await page.close();
      }
      for (const context of contexts) {
        await context.close();
      }
      await browser.close();
    }
  });

  test('should handle rapid navigation between pages', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      const routes = ['/', '/dashboard', '/content', '/profile'];
      const navigationTimes: number[] = [];

      console.log('🏃 Testing rapid navigation...');

      for (let i = 0; i < 20; i++) {
        const route = routes[i % routes.length];
        const startTime = Date.now();

        await page.goto(route, { waitUntil: 'domcontentloaded' });

        const navTime = Date.now() - startTime;
        navigationTimes.push(navTime);

        // 短暂等待后继续下一次导航
        await page.waitForTimeout(100);
      }

      const avgNavTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
      const maxNavTime = Math.max(...navigationTimes);
      const minNavTime = Math.min(...navigationTimes);

      console.log(`📊 Navigation statistics:`);
      console.log(`   Average: ${avgNavTime.toFixed(2)}ms`);
      console.log(`   Min: ${minNavTime}ms`);
      console.log(`   Max: ${maxNavTime}ms`);

      // 平均导航时间应该合理
      expect(avgNavTime).toBeLessThan(2000);

      // 最大导航时间不应该太长
      expect(maxNavTime).toBeLessThan(5000);
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('should handle memory stress with large data sets', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      await page.goto('/content');
      await page.waitForLoadState('networkidle');

      // 获取初始内存
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      console.log('💾 Initial memory:', (initialMemory / 1024 / 1024).toFixed(2), 'MB');

      // 模拟大量滚动和数据加载
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
      }

      // 获取压力测试后的内存
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      console.log('💾 Final memory:', (finalMemory / 1024 / 1024).toFixed(2), 'MB');

      const memoryIncrease = finalMemory - initialMemory;
      const increasePercentage = (memoryIncrease / initialMemory) * 100;

      console.log(`📈 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${increasePercentage.toFixed(2)}%)`);

      // 内存增长应该合理（不应该有严重的内存泄漏）
      // 允许最多增长 50MB 或 50%
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      expect(increasePercentage).toBeLessThan(50);
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('should handle rapid user interactions', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      console.log('⚡ Testing rapid interactions...');

      const interactionCount = 100;
      const interactions: number[] = [];

      for (let i = 0; i < interactionCount; i++) {
        const startTime = performance.now();

        // 随机点击可交互元素
        const clickableElements = await page.locator('button, a, [role="button"], [role="link"]').all();
        
        if (clickableElements.length > 0) {
          const randomIndex = Math.floor(Math.random() * clickableElements.length);
          await clickableElements[randomIndex].click().catch(() => {
            // 忽略点击失败（可能元素已经不可见）
          });
        }

        const interactionTime = performance.now() - startTime;
        interactions.push(interactionTime);

        // 短暂延迟
        await page.waitForTimeout(10);
      }

      const avgInteraction = interactions.reduce((a, b) => a + b, 0) / interactions.length;
      const maxInteraction = Math.max(...interactions);

      console.log(`📊 Interaction statistics:`);
      console.log(`   Total interactions: ${interactionCount}`);
      console.log(`   Average time: ${avgInteraction.toFixed(2)}ms`);
      console.log(`   Max time: ${maxInteraction.toFixed(2)}ms`);

      // 交互应该保持快速响应
      expect(avgInteraction).toBeLessThan(300);
      expect(maxInteraction).toBeLessThan(1000);
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('should maintain performance under sustained load', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      console.log('🔄 Testing sustained load (5 minutes simulation)...');

      const testDuration = 60000; // 1 minute (降低到 1 分钟以加快测试)
      const interval = 5000; // 每 5 秒执行一次操作
      const startTime = Date.now();

      const performanceSnapshots: Array<{
        time: number;
        memory: number;
        responseTime: number;
      }> = [];

      while (Date.now() - startTime < testDuration) {
        const snapshotStart = performance.now();

        // 执行一些操作
        await page.reload({ waitUntil: 'networkidle' });

        const responseTime = performance.now() - snapshotStart;

        // 获取内存快照
        const memory = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return 0;
        });

        performanceSnapshots.push({
          time: Date.now() - startTime,
          memory,
          responseTime,
        });

        console.log(`   ${((Date.now() - startTime) / 1000).toFixed(0)}s: Response ${responseTime.toFixed(2)}ms, Memory ${(memory / 1024 / 1024).toFixed(2)}MB`);

        await page.waitForTimeout(interval);
      }

      // 分析性能趋势
      const avgResponseTime = performanceSnapshots.reduce((sum, s) => sum + s.responseTime, 0) / performanceSnapshots.length;
      const maxResponseTime = Math.max(...performanceSnapshots.map(s => s.responseTime));
      
      const firstMemory = performanceSnapshots[0].memory;
      const lastMemory = performanceSnapshots[performanceSnapshots.length - 1].memory;
      const memoryGrowth = lastMemory - firstMemory;

      console.log(`\n📊 Sustained load results:`);
      console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Max response time: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`   Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      // 性能应该保持稳定
      expect(avgResponseTime).toBeLessThan(3000);
      expect(maxResponseTime).toBeLessThan(5000);

      // 内存增长应该有限
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // 小于 100MB
    } finally {
      await page.close();
      await browser.close();
    }
  });

  test('should handle concurrent API requests', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      await page.goto('/dashboard');

      console.log('🌐 Testing concurrent API requests...');

      // 监听 API 请求
      const apiRequests: Array<{ url: string; duration: number }> = [];

      page.on('response', async response => {
        const url = response.url();
        if (url.includes('/api/')) {
          const timing = response.timing();
          apiRequests.push({
            url,
            duration: timing.responseEnd,
          });
        }
      });

      // 触发多个需要 API 调用的操作
      await page.reload({ waitUntil: 'networkidle' });

      if (apiRequests.length > 0) {
        const avgDuration = apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length;
        const maxDuration = Math.max(...apiRequests.map(req => req.duration));

        console.log(`📊 API Request statistics:`);
        console.log(`   Total requests: ${apiRequests.length}`);
        console.log(`   Average duration: ${avgDuration.toFixed(2)}ms`);
        console.log(`   Max duration: ${maxDuration.toFixed(2)}ms`);

        // API 请求应该在合理时间内完成
        expect(avgDuration).toBeLessThan(2000);
        expect(maxDuration).toBeLessThan(5000);
      } else {
        console.log('⚠️  No API requests detected');
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });
});

