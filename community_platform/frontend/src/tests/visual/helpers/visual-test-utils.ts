import { Page, expect } from '@playwright/test';

/**
 * 视觉测试工具类
 * 提供常用的视觉测试辅助方法
 */

/**
 * 等待页面完全加载（包括图片、字体等）
 */
export async function waitForPageReady(page: Page) {
  // 等待网络空闲
  await page.waitForLoadState('networkidle');
  
  // 等待字体加载完成
  await page.evaluate(() => document.fonts.ready);
  
  // 等待图片加载完成
  await page.evaluate(() => {
    const images = Array.from(document.images);
    return Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', reject);
        });
      })
    );
  });
  
  // 额外等待一小段时间确保渲染完成
  await page.waitForTimeout(500);
}

/**
 * 隐藏动态内容（如时间戳、动画等）
 */
export async function hideFlakySections(page: Page, selectors: string[] = []) {
  const defaultSelectors = [
    '[data-testid="timestamp"]',
    '[data-testid="live-indicator"]',
    '.animated',
    '.loading-spinner',
    ...selectors,
  ];
  
  await page.evaluate((sels) => {
    sels.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
  }, defaultSelectors);
}

/**
 * 冻结时间（用于测试包含时间的UI）
 */
export async function freezeTime(page: Page, timestamp: Date | string = '2025-10-25T12:00:00.000Z') {
  const dateStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
  
  await page.addInitScript(`{
    const originalDate = Date;
    const fixedDate = new originalDate('${dateStr}');
    
    Date = class extends originalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedDate);
        } else {
          super(...args);
        }
      }
      
      static now() {
        return fixedDate.getTime();
      }
    }
  }`);
}

/**
 * 禁用所有动画
 */
export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/**
 * 设置固定视口
 */
export async function setViewport(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
}

/**
 * 截取完整页面截图（包括滚动区域）
 */
export async function takeFullPageScreenshot(
  page: Page,
  name: string,
  options?: {
    maxDiffPixels?: number;
    threshold?: number;
  }
) {
  await waitForPageReady(page);
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    maxDiffPixels: options?.maxDiffPixels,
    threshold: options?.threshold,
  });
}

/**
 * 截取元素截图
 */
export async function takeElementScreenshot(
  page: Page,
  selector: string,
  name: string,
  options?: {
    maxDiffPixels?: number;
    threshold?: number;
  }
) {
  await waitForPageReady(page);
  const element = page.locator(selector);
  await expect(element).toHaveScreenshot(name, {
    maxDiffPixels: options?.maxDiffPixels,
    threshold: options?.threshold,
  });
}

/**
 * 测试不同状态的组件
 */
export async function testComponentStates(
  page: Page,
  states: Array<{
    name: string;
    action: (page: Page) => Promise<void>;
    screenshot: string;
  }>
) {
  for (const state of states) {
    await state.action(page);
    await waitForPageReady(page);
    await expect(page).toHaveScreenshot(state.screenshot);
  }
}

/**
 * 测试响应式布局
 */
export async function testResponsiveLayout(
  page: Page,
  url: string,
  viewports: Array<{ name: string; width: number; height: number }>
) {
  const results: Array<{ name: string; screenshot: string }> = [];
  
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url);
    await waitForPageReady(page);
    
    const screenshotName = `${viewport.name}-${viewport.width}x${viewport.height}.png`;
    await expect(page).toHaveScreenshot(screenshotName);
    
    results.push({
      name: viewport.name,
      screenshot: screenshotName,
    });
  }
  
  return results;
}

/**
 * 测试主题切换
 */
export async function testThemes(
  page: Page,
  url: string,
  themes: Array<{ name: string; className: string }>
) {
  await page.goto(url);
  
  for (const theme of themes) {
    // 添加主题类名到 body
    await page.evaluate((className) => {
      document.body.className = className;
    }, theme.className);
    
    await waitForPageReady(page);
    await expect(page).toHaveScreenshot(`${theme.name}-theme.png`);
  }
}

/**
 * 测试交互状态（hover, focus, active）
 */
export async function testInteractionStates(
  page: Page,
  selector: string,
  baseName: string
) {
  const element = page.locator(selector);
  
  // 默认状态
  await waitForPageReady(page);
  await expect(element).toHaveScreenshot(`${baseName}-default.png`);
  
  // Hover 状态
  await element.hover();
  await page.waitForTimeout(200);
  await expect(element).toHaveScreenshot(`${baseName}-hover.png`);
  
  // Focus 状态
  await element.focus();
  await page.waitForTimeout(200);
  await expect(element).toHaveScreenshot(`${baseName}-focus.png`);
  
  // Active 状态（按下但未释放）
  await element.dispatchEvent('mousedown');
  await page.waitForTimeout(100);
  await expect(element).toHaveScreenshot(`${baseName}-active.png`);
}

/**
 * 比对两个页面的视觉差异
 */
export async function comparePages(
  page: Page,
  url1: string,
  url2: string,
  name: string
) {
  // 截取第一个页面
  await page.goto(url1);
  await waitForPageReady(page);
  const screenshot1 = await page.screenshot();
  
  // 截取第二个页面
  await page.goto(url2);
  await waitForPageReady(page);
  const screenshot2 = await page.screenshot();
  
  // 这里可以集成图片比对工具
  // 目前只是简单存储
  return {
    url1,
    url2,
    screenshot1,
    screenshot2,
  };
}

/**
 * 批量测试页面列表
 */
export async function testPageList(
  page: Page,
  pages: Array<{ name: string; url: string }>
) {
  for (const pageInfo of pages) {
    await page.goto(pageInfo.url);
    await waitForPageReady(page);
    await expect(page).toHaveScreenshot(`${pageInfo.name}.png`);
  }
}

/**
 * 模拟慢速网络
 */
export async function simulateSlowNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (500 * 1024) / 8, // 500 kbps
    uploadThroughput: (500 * 1024) / 8,
    latency: 100, // 100ms
  });
}

/**
 * 等待特定元素加载完成
 */
export async function waitForElement(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * 滚动到元素位置
 */
export async function scrollToElement(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); // 等待滚动动画完成
}

/**
 * 测试打印样式
 */
export async function testPrintStyle(page: Page, name: string) {
  await page.emulateMedia({ media: 'print' });
  await waitForPageReady(page);
  await expect(page).toHaveScreenshot(name);
}

/**
 * 隐藏文本光标（避免闪烁）
 */
export async function hideCursor(page: Page) {
  await page.addStyleTag({
    content: `
      * {
        caret-color: transparent !important;
      }
    `,
  });
}

/**
 * 设置确定性随机数（用于测试包含随机元素的UI）
 */
export async function setDeterministicRandom(page: Page, seed = 12345) {
  await page.addInitScript(`{
    let seed = ${seed};
    Math.random = function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
  }`);
}

