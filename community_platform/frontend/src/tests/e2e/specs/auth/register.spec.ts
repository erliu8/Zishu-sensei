import { test, expect } from '@playwright/test';
import { RegisterPage } from '../../page-objects/RegisterPage';
import { LoginPage } from '../../page-objects/LoginPage';
import { generateTestUser } from '../../helpers/test-utils';
import { invalidRegistrations } from '../../fixtures/test-data';

test.describe('用户注册', () => {
  let registerPage: RegisterPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.goto();
  });

  test('应该显示注册表单', async () => {
    await registerPage.expectFormVisible();
  });

  test('应该成功注册新用户', async ({ page }) => {
    const testUser = generateTestUser();
    
    await registerPage.register(
      testUser.username,
      testUser.email,
      testUser.password
    );
    
    // 验证注册成功消息
    await expect(registerPage.successMessage).toBeVisible();
    
    // 验证跳转到登录页面
    await page.waitForURL('**/login', { timeout: 10000 });
  });

  test('应该在密码不匹配时显示错误', async () => {
    const testUser = generateTestUser();
    
    await registerPage.register(
      testUser.username,
      testUser.email,
      testUser.password,
      'different-password' // 不同的确认密码
    );
    
    // 验证密码不匹配错误
    await registerPage.expectPasswordMismatchError();
  });

  test('应该验证邮箱格式', async () => {
    const testUser = generateTestUser();
    
    await registerPage.usernameInput.fill(testUser.username);
    await registerPage.emailInput.fill('invalid-email');
    await registerPage.passwordInput.fill(testUser.password);
    await registerPage.confirmPasswordInput.fill(testUser.password);
    await registerPage.termsCheckbox.check();
    await registerPage.submitButton.click();
    
    // 验证邮箱格式错误
    await registerPage.expectValidationError('email', '请输入有效的邮箱地址');
  });

  test('应该验证用户名长度', async () => {
    const { username, email, password, expectedError } = invalidRegistrations[0];
    
    await registerPage.registerAndExpectError(username, email, password, expectedError);
  });

  test('应该验证密码强度', async () => {
    const testUser = generateTestUser();
    
    // 弱密码
    await registerPage.passwordInput.fill('123');
    await registerPage.expectPasswordStrength('weak');
    
    // 中等密码
    await registerPage.passwordInput.fill('Password123');
    await registerPage.expectPasswordStrength('medium');
    
    // 强密码
    await registerPage.passwordInput.fill('Password123!@#');
    await registerPage.expectPasswordStrength('strong');
  });

  test('应该要求同意条款才能注册', async () => {
    const testUser = generateTestUser();
    
    await registerPage.register(
      testUser.username,
      testUser.email,
      testUser.password,
      testUser.password,
      false // 不同意条款
    );
    
    // 验证提交按钮被禁用
    await registerPage.expectSubmitDisabled();
  });

  test('应该在用户名已存在时显示错误', async () => {
    const testUser = generateTestUser();
    
    // 第一次注册
    await registerPage.register(
      testUser.username,
      testUser.email,
      testUser.password
    );
    
    // 等待注册成功
    await expect(registerPage.successMessage).toBeVisible();
    
    // 返回注册页面
    await registerPage.goto();
    
    // 使用相同用户名注册
    await registerPage.registerAndExpectError(
      testUser.username,
      `different_${testUser.email}`,
      testUser.password,
      '用户名已存在'
    );
  });

  test('应该在邮箱已存在时显示错误', async () => {
    const testUser = generateTestUser();
    
    // 第一次注册
    await registerPage.register(
      testUser.username,
      testUser.email,
      testUser.password
    );
    
    // 等待注册成功
    await expect(registerPage.successMessage).toBeVisible();
    
    // 返回注册页面
    await registerPage.goto();
    
    // 使用相同邮箱注册
    await registerPage.registerAndExpectError(
      `different_${testUser.username}`,
      testUser.email,
      testUser.password
    );
    
    // 验证邮箱已存在错误
    await registerPage.expectEmailExistsError();
  });

  test('应该能够导航到登录页面', async ({ page }) => {
    await registerPage.goToLogin();
    
    // 验证已跳转到登录页面
    expect(page.url()).toContain('/login');
  });

  test('应该能够切换密码可见性', async () => {
    const testUser = generateTestUser();
    
    await registerPage.passwordInput.fill(testUser.password);
    
    // 点击显示密码按钮
    await registerPage.showPasswordButton.click();
    
    // 验证密码可见
    const type = await registerPage.passwordInput.getAttribute('type');
    expect(type).toBe('text');
  });

  test('应该在所有字段填写后启用提交按钮', async () => {
    const testUser = generateTestUser();
    
    // 初始状态应该禁用
    await registerPage.expectSubmitDisabled();
    
    // 填写所有字段
    await registerPage.register(
      testUser.username,
      testUser.email,
      testUser.password
    );
    
    // 提交按钮应该启用
    await registerPage.expectSubmitEnabled();
  });

  test('应该实时验证表单字段', async () => {
    const testUser = generateTestUser();
    
    // 填写无效邮箱
    await registerPage.emailInput.fill('invalid-email');
    await registerPage.emailInput.blur();
    
    // 验证错误提示立即出现
    await registerPage.expectValidationError('email', '请输入有效的邮箱地址');
    
    // 修正邮箱
    await registerPage.emailInput.fill(testUser.email);
    await registerPage.emailInput.blur();
    
    // 验证错误提示消失
    const emailError = registerPage.page.locator('[data-error="email"]');
    await expect(emailError).not.toBeVisible();
  });

  test('应该清空表单', async () => {
    const testUser = generateTestUser();
    
    // 填写表单
    await registerPage.usernameInput.fill(testUser.username);
    await registerPage.emailInput.fill(testUser.email);
    await registerPage.passwordInput.fill(testUser.password);
    
    // 清空表单
    await registerPage.clearForm();
    
    // 验证所有字段为空
    expect(await registerPage.usernameInput.inputValue()).toBe('');
    expect(await registerPage.emailInput.inputValue()).toBe('');
    expect(await registerPage.passwordInput.inputValue()).toBe('');
  });
});

test.describe('注册流程集成', () => {
  test('应该完成注册并能够立即登录', async ({ page }) => {
    const testUser = generateTestUser();
    
    // 注册
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.register(
      testUser.username,
      testUser.email,
      testUser.password
    );
    
    // 等待跳转到登录页面
    await page.waitForURL('**/login', { timeout: 10000 });
    
    // 登录
    const loginPage = new LoginPage(page);
    await loginPage.login(testUser.email, testUser.password);
    
    // 验证登录成功
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('dashboard');
  });
});

test.describe('注册表单可访问性', () => {
  test('应该支持键盘导航', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    
    // 使用 Tab 键导航
    await page.keyboard.press('Tab'); // 用户名
    expect(await registerPage.usernameInput.evaluate(el => el === document.activeElement)).toBe(true);
    
    await page.keyboard.press('Tab'); // 邮箱
    expect(await registerPage.emailInput.evaluate(el => el === document.activeElement)).toBe(true);
    
    await page.keyboard.press('Tab'); // 密码
    expect(await registerPage.passwordInput.evaluate(el => el === document.activeElement)).toBe(true);
  });

  test('应该有适当的 ARIA 标签', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    
    // 验证表单有 role 属性
    const form = registerPage.registerForm;
    await expect(form).toHaveAttribute('role', 'form');
    
    // 验证输入框有 aria-label 或 label
    const usernameLabel = await registerPage.usernameInput.getAttribute('aria-label');
    expect(usernameLabel).toBeTruthy();
  });
});

