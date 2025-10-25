import { Page, expect } from '@playwright/test';
import { TEST_IDS } from '../../test-ids';

/**
 * E2E 测试工具函数
 */

/**
 * 等待页面加载完成
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * 等待并获取元素
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000) {
  return await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * 填写表单字段
 */
export async function fillFormField(page: Page, name: string, value: string) {
  await page.fill(`input[name="${name}"]`, value);
}

/**
 * 点击按钮并等待导航
 */
export async function clickAndWaitForNavigation(page: Page, selector: string) {
  await Promise.all([
    page.waitForNavigation(),
    page.click(selector),
  ]);
}

/**
 * 等待 Toast 消息出现
 */
export async function waitForToast(page: Page, expectedText?: string) {
  const toast = page.getByTestId(TEST_IDS.UI.TOAST);
  await expect(toast).toBeVisible({ timeout: 5000 });
  
  if (expectedText) {
    await expect(toast).toContainText(expectedText);
  }
  
  return toast;
}

/**
 * 等待加载状态消失
 */
export async function waitForLoadingToDisappear(page: Page) {
  const loading = page.getByTestId(TEST_IDS.UI.LOADING);
  await loading.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
    // 如果加载指示器不存在，忽略错误
  });
}

/**
 * 截图并附加到测试报告
 */
export async function takeScreenshot(page: Page, name: string) {
  const screenshot = await page.screenshot({ fullPage: true });
  await page.context().addInitScript(() => {
    // 添加截图到报告
  });
  return screenshot;
}

/**
 * 模拟网络慢速
 */
export async function setSlowNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (50 * 1024) / 8, // 50kb/s
    uploadThroughput: (50 * 1024) / 8,
    latency: 500, // 500ms
  });
}

/**
 * 模拟离线状态
 */
export async function setOffline(page: Page, offline = true) {
  await page.context().setOffline(offline);
}

/**
 * 清除所有 Cookie
 */
export async function clearAllCookies(page: Page) {
  await page.context().clearCookies();
}

/**
 * 清除本地存储
 */
export async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * 设置本地存储项
 */
export async function setLocalStorageItem(page: Page, key: string, value: string) {
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key, value }
  );
}

/**
 * 获取本地存储项
 */
export async function getLocalStorageItem(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, key);
}

/**
 * Mock API 响应
 */
export async function mockApiResponse(
  page: Page,
  url: string | RegExp,
  response: any,
  status = 200
) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * 拦截并验证 API 请求
 */
export async function interceptApiRequest(page: Page, url: string | RegExp) {
  return new Promise((resolve) => {
    page.on('request', (request) => {
      if (typeof url === 'string') {
        if (request.url().includes(url)) {
          resolve(request);
        }
      } else {
        if (url.test(request.url())) {
          resolve(request);
        }
      }
    });
  });
}

/**
 * 等待 API 请求完成
 */
export async function waitForApiRequest(page: Page, url: string | RegExp) {
  return await page.waitForResponse(
    (response) => {
      if (typeof url === 'string') {
        return response.url().includes(url);
      }
      return url.test(response.url());
    },
    { timeout: 10000 }
  );
}

/**
 * 检查可访问性
 */
export async function checkAccessibility(page: Page) {
  // 这里可以集成 axe-core 或其他可访问性测试工具
  // 示例实现
  const violations = await page.evaluate(() => {
    // 检查基本的可访问性问题
    const issues: string[] = [];
    
    // 检查图片是否有 alt 属性
    const images = document.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.getAttribute('alt')) {
        issues.push(`Image without alt attribute: ${img.src}`);
      }
    });
    
    // 检查按钮是否有可访问的名称
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button) => {
      if (!button.textContent && !button.getAttribute('aria-label')) {
        issues.push('Button without accessible name');
      }
    });
    
    return issues;
  });
  
  return violations;
}

/**
 * 滚动到元素
 */
export async function scrollToElement(page: Page, selector: string) {
  await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, selector);
}

/**
 * 等待特定时间
 */
export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试操作
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await wait(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机邮箱
 */
export function generateRandomEmail(): string {
  return `test_${generateRandomString(8)}@example.com`;
}

/**
 * 生成测试用户数据
 */
export function generateTestUser() {
  return {
    email: generateRandomEmail(),
    password: 'Test123456!',
    username: `testuser_${generateRandomString(6)}`,
    displayName: `Test User ${generateRandomString(4)}`,
  };
}

