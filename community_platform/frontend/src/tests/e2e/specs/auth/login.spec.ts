import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
import { DashboardPage } from '../../page-objects/DashboardPage';
import { testUsers, invalidCredentials } from '../../fixtures/test-data';

test.describe('用户登录', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('应该显示登录表单', async () => {
    await loginPage.expectFormVisible();
  });

  test('应该成功登录并跳转到 Dashboard', async ({ page }) => {
    await loginPage.login(testUsers.regularUser.email, testUsers.regularUser.password);
    
    // 验证跳转到 Dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // 验证用户已登录
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.expectUserLoggedIn(testUsers.regularUser.username);
  });

  test('应该在使用无效凭证时显示错误', async () => {
    const { email, password, expectedError } = invalidCredentials[0];
    
    await loginPage.loginAndExpectError(email, password, expectedError);
  });

  test('应该验证邮箱格式', async () => {
    await loginPage.emailInput.fill('invalid-email');
    await loginPage.passwordInput.fill('password123');
    await loginPage.submitButton.click();
    
    // 验证邮箱格式错误提示
    await loginPage.expectEmailError();
  });

  test('应该验证必填字段', async () => {
    // 不填写任何内容，直接提交
    await loginPage.submitButton.click();
    
    // 验证错误提示
    await loginPage.expectEmailError('邮箱不能为空');
  });

  test('应该能够切换密码可见性', async () => {
    await loginPage.passwordInput.fill('password123');
    
    // 默认密码应该是隐藏的
    let isVisible = await loginPage.isPasswordVisible();
    expect(isVisible).toBe(false);
    
    // 点击显示密码按钮
    await loginPage.togglePasswordVisibility();
    
    // 密码应该变为可见
    isVisible = await loginPage.isPasswordVisible();
    expect(isVisible).toBe(true);
  });

  test('应该能够导航到注册页面', async ({ page }) => {
    await loginPage.goToRegister();
    
    // 验证已跳转到注册页面
    expect(page.url()).toContain('/register');
  });

  test('应该能够导航到忘记密码页面', async ({ page }) => {
    await loginPage.goToForgotPassword();
    
    // 验证已跳转到忘记密码页面
    expect(page.url()).toContain('/forgot-password');
  });

  test('应该支持记住我功能', async ({ page, context }) => {
    // 勾选"记住我"
    await loginPage.login(
      testUsers.regularUser.email,
      testUsers.regularUser.password,
      true
    );
    
    // 等待登录成功
    await page.waitForURL('**/dashboard');
    
    // 获取 Cookie
    const cookies = await context.cookies();
    const rememberMeCookie = cookies.find(c => c.name.includes('remember'));
    
    // 验证记住我 Cookie 存在
    expect(rememberMeCookie).toBeDefined();
  });

  test('应该在登录失败后清空密码字段', async () => {
    const { email, password } = invalidCredentials[0];
    
    await loginPage.login(email, password);
    
    // 等待错误消息出现
    await expect(loginPage.errorMessage).toBeVisible();
    
    // 验证密码字段已被清空
    const passwordValue = await loginPage.passwordInput.inputValue();
    expect(passwordValue).toBe('');
  });

  test('应该能够使用键盘提交表单', async ({ page }) => {
    await loginPage.emailInput.fill(testUsers.regularUser.email);
    await loginPage.passwordInput.fill(testUsers.regularUser.password);
    
    // 按 Enter 键提交
    await loginPage.passwordInput.press('Enter');
    
    // 验证登录成功
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('应该在加载时显示加载指示器', async () => {
    await loginPage.emailInput.fill(testUsers.regularUser.email);
    await loginPage.passwordInput.fill(testUsers.regularUser.password);
    await loginPage.submitButton.click();
    
    // 验证加载指示器出现
    await expect(loginPage.loading).toBeVisible();
  });
});

test.describe('登录安全性', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('应该防止 SQL 注入攻击', async () => {
    const sqlInjection = "admin' OR '1'='1";
    await loginPage.loginAndExpectError(sqlInjection, 'password');
  });

  test('应该防止 XSS 攻击', async () => {
    const xssPayload = '<script>alert("XSS")</script>';
    await loginPage.emailInput.fill(xssPayload);
    await loginPage.passwordInput.fill('password');
    await loginPage.submitButton.click();
    
    // 验证没有执行脚本
    const alerts = [];
    loginPage.page.on('dialog', dialog => {
      alerts.push(dialog);
      dialog.dismiss();
    });
    
    // 等待一小段时间
    await loginPage.wait(1000);
    
    // 验证没有弹出警告
    expect(alerts.length).toBe(0);
  });

  test('应该在多次失败登录后限制尝试', async () => {
    // 尝试多次失败登录
    for (let i = 0; i < 5; i++) {
      await loginPage.login('test@example.com', 'wrongpassword');
      await expect(loginPage.errorMessage).toBeVisible();
      await loginPage.clearForm();
    }
    
    // 第6次尝试应该被阻止
    await loginPage.login('test@example.com', 'wrongpassword');
    
    // 验证显示限制消息
    await expect(loginPage.errorMessage).toContainText(/尝试次数过多|too many attempts/i);
  });
});

test.describe('登录响应式设计', () => {
  test('应该在移动设备上正常显示', async ({ page }) => {
    // 设置移动设备视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 验证表单可见
    await loginPage.expectFormVisible();
  });

  test('应该在平板设备上正常显示', async ({ page }) => {
    // 设置平板设备视口
    await page.setViewportSize({ width: 768, height: 1024 });
    
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 验证表单可见
    await loginPage.expectFormVisible();
  });
});

