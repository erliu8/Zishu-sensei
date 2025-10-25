import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TEST_IDS } from '../../test-ids';

/**
 * 注册页面对象
 */
export class RegisterPage extends BasePage {
  // 页面元素
  readonly registerForm: Locator;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly loginLink: Locator;
  readonly termsCheckbox: Locator;
  readonly showPasswordButton: Locator;
  readonly passwordStrengthIndicator: Locator;

  constructor(page: Page) {
    super(page, '/register');

    // 初始化页面元素
    this.registerForm = page.getByTestId(TEST_IDS.AUTH.REGISTER_FORM);
    this.usernameInput = page.getByTestId(TEST_IDS.AUTH.USERNAME_INPUT);
    this.emailInput = page.getByTestId(TEST_IDS.AUTH.EMAIL_INPUT);
    this.passwordInput = page.getByTestId(TEST_IDS.AUTH.PASSWORD_INPUT);
    this.confirmPasswordInput = page.getByTestId(TEST_IDS.AUTH.CONFIRM_PASSWORD_INPUT);
    this.submitButton = page.getByTestId(TEST_IDS.AUTH.SUBMIT_BUTTON);
    this.errorMessage = page.getByTestId(TEST_IDS.AUTH.ERROR_MESSAGE);
    this.successMessage = page.getByTestId(TEST_IDS.AUTH.SUCCESS_MESSAGE);
    this.loginLink = page.getByRole('link', { name: /登录|login/i });
    this.termsCheckbox = page.getByRole('checkbox', { name: /同意|agree|terms/i });
    this.showPasswordButton = page.getByRole('button', { name: /显示密码|show password/i });
    this.passwordStrengthIndicator = page.locator('[data-testid="password-strength"]');
  }

  /**
   * 访问注册页面
   */
  async goto() {
    await super.goto();
    await expect(this.registerForm).toBeVisible();
  }

  /**
   * 执行注册
   */
  async register(
    username: string,
    email: string,
    password: string,
    confirmPassword?: string,
    agreeTerms = true
  ) {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword || password);
    
    if (agreeTerms) {
      await this.termsCheckbox.check();
    }
    
    await this.submitButton.click();
  }

  /**
   * 快速注册（生成随机测试数据）
   */
  async quickRegister() {
    const timestamp = Date.now();
    const username = `testuser_${timestamp}`;
    const email = `test_${timestamp}@example.com`;
    const password = 'Test123456!';
    
    await this.register(username, email, password);
    
    return { username, email, password };
  }

  /**
   * 注册并等待成功
   */
  async registerAndWaitForSuccess(
    username: string,
    email: string,
    password: string,
    redirectPath = '/login'
  ) {
    await this.register(username, email, password);
    await expect(this.successMessage).toBeVisible({ timeout: 5000 });
    await this.page.waitForURL(`**${redirectPath}`, { timeout: 10000 });
  }

  /**
   * 注册并期望失败
   */
  async registerAndExpectError(
    username: string,
    email: string,
    password: string,
    expectedError?: string
  ) {
    await this.register(username, email, password);
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
    
    if (expectedError) {
      await expect(this.errorMessage).toContainText(expectedError);
    }
  }

  /**
   * 点击登录链接
   */
  async goToLogin() {
    await this.loginLink.click();
    await this.page.waitForURL('**/login');
  }

  /**
   * 验证注册表单是否显示
   */
  async expectFormVisible() {
    await expect(this.registerForm).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
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
   * 获取密码强度
   */
  async getPasswordStrength(): Promise<string> {
    return await this.passwordStrengthIndicator.textContent() || '';
  }

  /**
   * 验证密码强度指示器
   */
  async expectPasswordStrength(strength: 'weak' | 'medium' | 'strong') {
    await expect(this.passwordStrengthIndicator).toBeVisible();
    await expect(this.passwordStrengthIndicator).toHaveAttribute('data-strength', strength);
  }

  /**
   * 验证密码不匹配错误
   */
  async expectPasswordMismatchError() {
    const error = this.page.locator('[data-error="confirmPassword"]');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/密码不匹配|passwords do not match/i);
  }

  /**
   * 验证用户名已存在错误
   */
  async expectUsernameExistsError() {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(/用户名已存在|username already exists/i);
  }

  /**
   * 验证邮箱已存在错误
   */
  async expectEmailExistsError() {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(/邮箱已被注册|email already registered/i);
  }

  /**
   * 验证表单验证错误
   */
  async expectValidationError(field: string, errorMessage: string) {
    const error = this.page.locator(`[data-error="${field}"]`);
    await expect(error).toBeVisible();
    await expect(error).toContainText(errorMessage);
  }

  /**
   * 清空表单
   */
  async clearForm() {
    await this.usernameInput.clear();
    await this.emailInput.clear();
    await this.passwordInput.clear();
    await this.confirmPasswordInput.clear();
  }
}

