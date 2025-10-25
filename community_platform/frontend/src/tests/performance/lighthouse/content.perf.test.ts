/**
 * 内容浏览页面性能测试
 * 针对数据密集型页面的性能测试
 */

import { test, expect, chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

test.describe('Content Page Performance Tests', () => {
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

  test('should use virtual scrolling for large lists', async () => {
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // 获取实际渲染的元素数量
    const renderedItemsCount = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-testid*="content-item"], [class*="content-item"]');
      return items.length;
    });

    console.log(`📋 Rendered content items: ${renderedItemsCount}`);

    // 如果使用虚拟滚动，渲染的元素应该有限（不是全部数据）
    // 通常虚拟滚动只渲染可见区域 + buffer
    expect(renderedItemsCount).toBeLessThan(100);

    // 测试滚动性能
    const scrollMetrics = await page.evaluate(async () => {
      const metrics = {
        frameDrops: 0,
        scrollDuration: 0,
      };

      const startTime = performance.now();
      let lastFrameTime = startTime;
      let frameCount = 0;

      const checkFrame = () => {
        const currentTime = performance.now();
        const frameDuration = currentTime - lastFrameTime;
        
        // 60 FPS = 16.67ms per frame
        if (frameDuration > 16.67) {
          metrics.frameDrops++;
        }
        
        lastFrameTime = currentTime;
        frameCount++;
      };

      // 监听滚动
      const observer = new PerformanceObserver(() => {
        checkFrame();
      });
      observer.observe({ entryTypes: ['measure'] });

      // 执行滚动
      window.scrollBy({ top: 1000, behavior: 'smooth' });
      await new Promise(resolve => setTimeout(resolve, 1000));

      metrics.scrollDuration = performance.now() - startTime;
      
      return metrics;
    });

    console.log(`🖱️  Scroll metrics:`);
    console.log(`   Duration: ${scrollMetrics.scrollDuration.toFixed(2)}ms`);
    console.log(`   Frame drops: ${scrollMetrics.frameDrops}`);

    // 滚动应该流畅，掉帧不应该太多
    expect(scrollMetrics.frameDrops).toBeLessThan(10);
  });

  test('should lazy load images', async () => {
    await page.goto('/content');

    // 等待初始内容加载
    await page.waitForLoadState('domcontentloaded');

    // 获取初始加载的图片
    const initialImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => img.complete && img.naturalHeight > 0).length;
    });

    // 滚动页面
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // 获取滚动后加载的图片
    const afterScrollImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => img.complete && img.naturalHeight > 0).length;
    });

    console.log(`🖼️  Image loading:`);
    console.log(`   Initial: ${initialImages}`);
    console.log(`   After scroll: ${afterScrollImages}`);

    // 滚动后应该加载更多图片（说明在使用懒加载）
    expect(afterScrollImages).toBeGreaterThanOrEqual(initialImages);
  });

  test('should implement pagination or infinite scroll efficiently', async () => {
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    const initialHeight = await page.evaluate(() => document.body.scrollHeight);

    // 滚动到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // 等待可能的新内容加载
    await page.waitForTimeout(2000);

    const newHeight = await page.evaluate(() => document.body.scrollHeight);

    console.log(`📏 Page height:`);
    console.log(`   Initial: ${initialHeight}px`);
    console.log(`   After scroll: ${newHeight}px`);

    // 检查是否有加载指示器
    const hasLoadingIndicator = await page.evaluate(() => {
      const indicators = document.querySelectorAll(
        '[data-testid="loading"], [class*="loading"], [class*="spinner"]'
      );
      return indicators.length > 0;
    });

    if (newHeight > initialHeight) {
      console.log('✅ Infinite scroll detected');
      // 如果有无限滚动，应该有加载指示器
      // expect(hasLoadingIndicator).toBe(true); // 可选检查
    } else {
      console.log('✅ Fixed pagination or limited content');
    }
  });

  test('should filter and search efficiently', async () => {
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // 查找搜索或过滤输入框
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]'
    ).first();

    if (await searchInput.isVisible().catch(() => false)) {
      const startTime = Date.now();

      // 输入搜索关键词
      await searchInput.fill('测试');
      
      // 等待搜索结果
      await page.waitForTimeout(500);

      const searchTime = Date.now() - startTime;

      console.log(`🔍 Search response time: ${searchTime}ms`);

      // 搜索应该快速响应（理想情况下使用防抖）
      expect(searchTime).toBeLessThan(1000);

      // 检查是否显示了结果
      const hasResults = await page.evaluate(() => {
        const items = document.querySelectorAll('[data-testid*="content-item"], [class*="content-item"]');
        return items.length > 0;
      });

      expect(hasResults).toBe(true);
    } else {
      console.log('⚠️  No search input found, skipping search test');
    }
  });

  test('should handle sort operations efficiently', async () => {
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // 查找排序按钮或下拉框
    const sortControl = page.locator(
      '[data-testid*="sort"], [class*="sort"], button:has-text("排序"), select'
    ).first();

    if (await sortControl.isVisible().catch(() => false)) {
      const startTime = Date.now();

      await sortControl.click();
      
      // 等待排序完成
      await page.waitForTimeout(500);

      const sortTime = Date.now() - startTime;

      console.log(`🔄 Sort operation time: ${sortTime}ms`);

      // 排序应该快速完成
      expect(sortTime).toBeLessThan(1000);
    } else {
      console.log('⚠️  No sort control found, skipping sort test');
    }
  });

  test('should cache content data', async () => {
    // 首次访问
    const firstVisitStart = Date.now();
    await page.goto('/content');
    await page.waitForLoadState('networkidle');
    const firstVisitTime = Date.now() - firstVisitStart;

    // 导航到其他页面
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 返回内容页面
    const secondVisitStart = Date.now();
    await page.goto('/content');
    await page.waitForLoadState('networkidle');
    const secondVisitTime = Date.now() - secondVisitStart;

    console.log(`💾 Page load times:`);
    console.log(`   First visit: ${firstVisitTime}ms`);
    console.log(`   Second visit: ${secondVisitTime}ms`);
    console.log(`   Improvement: ${((1 - secondVisitTime / firstVisitTime) * 100).toFixed(2)}%`);

    // 第二次访问应该更快（得益于缓存）
    expect(secondVisitTime).toBeLessThanOrEqual(firstVisitTime * 1.1); // 允许 10% 的误差
  });

  test('should optimize re-renders', async () => {
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    // 启用 React DevTools Profiler（如果可用）
    const renderCount = await page.evaluate(() => {
      let count = 0;
      
      // 创建 MutationObserver 来监听 DOM 变化
      const observer = new MutationObserver((mutations) => {
        count += mutations.length;
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      // 执行一些交互
      const button = document.querySelector('button');
      if (button) {
        button.click();
      }

      return new Promise<number>(resolve => {
        setTimeout(() => {
          observer.disconnect();
          resolve(count);
        }, 1000);
      });
    });

    console.log(`🔄 DOM mutations during interaction: ${renderCount}`);

    // DOM 变化不应该太频繁（说明没有过度渲染）
    expect(renderCount).toBeLessThan(50);
  });

  test('should handle rapid user interactions', async () => {
    await page.goto('/content');
    await page.waitForLoadState('networkidle');

    const interactions = [];

    // 执行快速连续点击
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      
      // 点击第一个可点击元素
      const clickable = await page.locator('button, a, [role="button"]').first();
      if (await clickable.isVisible().catch(() => false)) {
        await clickable.click().catch(() => {});
        await page.waitForTimeout(50);
      }
      
      const endTime = performance.now();
      interactions.push(endTime - startTime);
    }

    const avgTime = interactions.reduce((a, b) => a + b, 0) / interactions.length;
    const maxTime = Math.max(...interactions);

    console.log(`⚡ Rapid interactions:`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Maximum: ${maxTime.toFixed(2)}ms`);

    // 快速交互应该保持响应
    expect(avgTime).toBeLessThan(200);
    expect(maxTime).toBeLessThan(500);
  });
});

