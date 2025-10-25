import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TEST_IDS } from '../../test-ids';

/**
 * 登录页面对象
 */
export class LoginPage extends BasePage {
  // 页面元素
  readonly loginForm: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly showPasswordButton: Locator;

  constructor(page: Page) {
    super(page, '/login');

    // 初始化页面元素
    this.loginForm = page.getByTestId(TEST_IDS.AUTH.LOGIN_FORM);
    this.emailInput = page.getByTestId(TEST_IDS.AUTH.EMAIL_INPUT);
    this.passwordInput = page.getByTestId(TEST_IDS.AUTH.PASSWORD_INPUT);
    this.submitButton = page.getByTestId(TEST_IDS.AUTH.SUBMIT_BUTTON);
    this.errorMessage = page.getByTestId(TEST_IDS.AUTH.ERROR_MESSAGE);
    this.registerLink = page.getByRole('link', { name: /注册|register/i });
    this.forgotPasswordLink = page.getByRole('link', { name: /忘记密码|forgot password/i });
    this.rememberMeCheckbox = page.getByRole('checkbox', { name: /记住我|remember me/i });
    this.showPasswordButton = page.getByRole('button', { name: /显示密码|show password/i });
  }

  /**
   * 访问登录页面
   */
  async goto() {
    await super.goto();
    await expect(this.loginForm).toBeVisible();
  }

  /**
   * 执行登录
   */
  async login(email: string, password: string, rememberMe = false) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    
    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }
    
    await this.submitButton.click();
  }

  /**
   * 快速登录（使用测试账号）
   */
  async quickLogin() {
    const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'test123456';
    await this.login(testEmail, testPassword);
  }

  /**
   * 登录并等待成功跳转
   */
  async loginAndWaitForSuccess(email: string, password: string, redirectPath = '/dashboard') {
    await this.login(email, password);
    await this.page.waitForURL(`**${redirectPath}`, { timeout: 10000 });
  }

  /**
   * 登录并期望失败
   */
  async loginAndExpectError(email: string, password: string, expectedError?: string) {
    await this.login(email, password);
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
    
    if (expectedError) {
      await expect(this.errorMessage).toContainText(expectedError);
    }
  }

  /**
   * 切换密码可见性
   */
  async togglePasswordVisibility() {
    await this.showPasswordButton.click();
  }

  /**
   * 验证密码是否可见
   */
  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute('type');
    return type === 'text';
  }

  /**
   * 点击注册链接
   */
  async goToRegister() {
    await this.registerLink.click();
    await this.page.waitForURL('**/register');
  }

  /**
   * 点击忘记密码链接
   */
  async goToForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL('**/forgot-password');
  }

  /**
   * 验证登录表单是否显示
   */
  async expectFormVisible() {
    await expect(this.loginForm).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * 验证提交按钮是否禁用
   */
  async expectSubmitDisabled() {
    await expect(this.submitButton).toBeDisabled();
  }

  /**
   * 验证提交按钮是否启用
   */
  async expectSubmitEnabled() {
    await expect(this.submitButton).toBeEnabled();
  }

  /**
   * 清空表单
   */
  async clearForm() {
    await this.emailInput.clear();
    await this.passwordInput.clear();
  }

  /**
   * 获取错误消息文本
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * 验证邮箱格式错误提示
   */
  async expectEmailError(errorMessage = '请输入有效的邮箱地址') {
    const emailError = this.page.locator('[data-error="email"]');
    await expect(emailError).toBeVisible();
    await expect(emailError).toContainText(errorMessage);
  }

  /**
   * 验证密码错误提示
   */
  async expectPasswordError(errorMessage = '密码不能为空') {
    const passwordError = this.page.locator('[data-error="password"]');
    await expect(passwordError).toBeVisible();
    await expect(passwordError).toContainText(errorMessage);
  }
}

