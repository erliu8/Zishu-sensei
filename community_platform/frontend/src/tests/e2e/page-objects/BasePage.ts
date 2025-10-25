import { Page, Locator, expect } from '@playwright/test';
import { TEST_IDS } from '../../test-ids';
import { waitForPageLoad, waitForToast } from '../helpers/test-utils';

/**
 * 基础页面对象类
 * 所有页面对象都应该继承此类
 */
export class BasePage {
  readonly page: Page;
  readonly baseURL: string;

  // 通用元素
  readonly header: Locator;
  readonly footer: Locator;
  readonly loading: Locator;
  readonly toast: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page, baseURL = '') {
    this.page = page;
    this.baseURL = baseURL;

    // 初始化通用元素
    this.header = page.getByTestId(TEST_IDS.NAV.HEADER);
    this.loading = page.getByTestId(TEST_IDS.UI.LOADING);
    this.toast = page.getByTestId(TEST_IDS.UI.TOAST);
    this.errorMessage = page.getByTestId(TEST_IDS.UI.ERROR);
    this.footer = page.locator('footer');
  }

  /**
   * 访问页面
   */
  async goto(path?: string) {
    const url = path ? `${this.baseURL}${path}` : this.baseURL;
    await this.page.goto(url);
    await waitForPageLoad(this.page);
  }

  /**
   * 等待页面加载完成
   */
  async waitForLoad() {
    await waitForPageLoad(this.page);
  }

  /**
   * 获取页面标题
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * 获取当前 URL
   */
  getCurrentURL(): string {
    return this.page.url();
  }

  /**
   * 等待导航完成
   */
  async waitForNavigation(url?: string | RegExp) {
    if (url) {
      await this.page.waitForURL(url);
    } else {
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * 点击元素
   */
  async click(locator: Locator) {
    await locator.click();
  }

  /**
   * 填写输入框
   */
  async fill(locator: Locator, value: string) {
    await locator.fill(value);
  }

  /**
   * 获取文本内容
   */
  async getText(locator: Locator): Promise<string> {
    return await locator.textContent() || '';
  }

  /**
   * 检查元素是否可见
   */
  async isVisible(locator: Locator): Promise<boolean> {
    return await locator.isVisible();
  }

  /**
   * 等待元素可见
   */
  async waitForVisible(locator: Locator, timeout = 5000) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * 等待元素隐藏
   */
  async waitForHidden(locator: Locator, timeout = 5000) {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * 等待加载完成
   */
  async waitForLoadingToDisappear() {
    await this.loading.waitFor({ state: 'hidden' }).catch(() => {
      // 如果没有加载指示器，忽略错误
    });
  }

  /**
   * 等待并验证 Toast 消息
   */
  async expectToast(message: string) {
    await waitForToast(this.page, message);
  }

  /**
   * 等待并验证错误消息
   */
  async expectError(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  /**
   * 截图
   */
  async screenshot(name: string) {
    return await this.page.screenshot({ 
      path: `playwright-report/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  /**
   * 重新加载页面
   */
  async reload() {
    await this.page.reload();
    await waitForPageLoad(this.page);
  }

  /**
   * 返回上一页
   */
  async goBack() {
    await this.page.goBack();
    await waitForPageLoad(this.page);
  }

  /**
   * 前进到下一页
   */
  async goForward() {
    await this.page.goForward();
    await waitForPageLoad(this.page);
  }

  /**
   * 滚动到顶部
   */
  async scrollToTop() {
    await this.page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /**
   * 滚动到底部
   */
  async scrollToBottom() {
    await this.page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }

  /**
   * 滚动到元素
   */
  async scrollToElement(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * 等待特定时间（仅用于调试，生产环境应避免使用）
   */
  async wait(ms: number) {
    await this.page.waitForTimeout(ms);
  }

  /**
   * 获取 localStorage 值
   */
  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((key) => {
      return localStorage.getItem(key);
    }, key);
  }

  /**
   * 设置 localStorage 值
   */
  async setLocalStorageItem(key: string, value: string) {
    await this.page.evaluate(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      { key, value }
    );
  }

  /**
   * 清除 localStorage
   */
  async clearLocalStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
    });
  }

  /**
   * 获取 Cookie
   */
  async getCookie(name: string) {
    const cookies = await this.page.context().cookies();
    return cookies.find((cookie) => cookie.name === name);
  }

  /**
   * 设置 Cookie
   */
  async setCookie(name: string, value: string) {
    await this.page.context().addCookies([
      {
        name,
        value,
        domain: new URL(this.page.url()).hostname,
        path: '/',
      },
    ]);
  }

  /**
   * 模拟网络请求
   */
  async mockApiResponse(url: string | RegExp, response: any, status = 200) {
    await this.page.route(url, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * 等待 API 响应
   */
  async waitForApiResponse(url: string | RegExp) {
    return await this.page.waitForResponse(
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
   * 检查页面是否有错误
   */
  async hasErrors(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * 关闭 Toast
   */
  async closeToast() {
    const closeButton = this.toast.locator('button[aria-label="Close"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }
}

