import { Page, test as base } from '@playwright/test';
import {
  waitForPageReady,
  disableAnimations,
  freezeTime,
  hideCursor,
} from './visual-test-utils';

/**
 * 视觉测试基类
 * 提供通用的测试设置和方法
 */
export class BaseVisualTest {
  constructor(public readonly page: Page) {}

  /**
   * 导航到指定页面并准备进行视觉测试
   */
  async goto(url: string, options?: {
    freezeTime?: boolean;
    disableAnimations?: boolean;
    hideCursor?: boolean;
  }) {
    const opts = {
      freezeTime: true,
      disableAnimations: true,
      hideCursor: true,
      ...options,
    };

    // 设置初始化脚本
    if (opts.freezeTime) {
      await freezeTime(this.page);
    }

    if (opts.disableAnimations) {
      await disableAnimations(this.page);
    }

    if (opts.hideCursor) {
      await hideCursor(this.page);
    }

    // 导航到页面
    await this.page.goto(url);

    // 等待页面就绪
    await waitForPageReady(this.page);
  }

  /**
   * 等待元素可见
   */
  async waitForElement(selector: string, timeout = 10000) {
    await this.page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    });
  }

  /**
   * 滚动到元素
   */
  async scrollTo(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
  }

  /**
   * 点击元素
   */
  async click(selector: string) {
    await this.page.click(selector);
    await waitForPageReady(this.page);
  }

  /**
   * 填写表单
   */
  async fill(selector: string, value: string) {
    await this.page.fill(selector, value);
    await this.page.waitForTimeout(100);
  }

  /**
   * 悬停在元素上
   */
  async hover(selector: string) {
    await this.page.hover(selector);
    await this.page.waitForTimeout(200);
  }

  /**
   * 切换主题
   */
  async switchTheme(theme: 'light' | 'dark') {
    await this.page.evaluate((t) => {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);
    await this.page.waitForTimeout(300);
  }

  /**
   * 模拟用户登录
   */
  async mockAuth(user?: {
    id: string;
    name: string;
    email: string;
  }) {
    const defaultUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
    };
    
    const authUser = user || defaultUser;
    
    await this.page.evaluate((u) => {
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('isAuthenticated', 'true');
    }, authUser);
  }

  /**
   * 清除认证
   */
  async clearAuth() {
    await this.page.evaluate(() => {
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
    });
  }

  /**
   * 设置 localStorage 数据
   */
  async setLocalStorage(key: string, value: any) {
    await this.page.evaluate(
      ({ k, v }) => {
        localStorage.setItem(k, JSON.stringify(v));
      },
      { k: key, v: value }
    );
  }

  /**
   * 获取 localStorage 数据
   */
  async getLocalStorage(key: string) {
    return await this.page.evaluate((k) => {
      const value = localStorage.getItem(k);
      return value ? JSON.parse(value) : null;
    }, key);
  }

  /**
   * 清除 localStorage
   */
  async clearLocalStorage() {
    await this.page.evaluate(() => localStorage.clear());
  }
}

/**
 * 扩展的 Playwright test，包含 BaseVisualTest
 */
export const visualTest = base.extend<{ visualPage: BaseVisualTest }>({
  visualPage: async ({ page }, use) => {
    const visualPage = new BaseVisualTest(page);
    await use(visualPage);
  },
});

/**
 * 导出 expect 以便使用
 */
export { expect } from '@playwright/test';

