import { test, expect } from '@playwright/test';
import { quickLoginWorkflow, logoutWorkflow } from '../../workflows/auth-workflows';
import { DashboardPage } from '../../page-objects/DashboardPage';
import { LoginPage } from '../../page-objects/LoginPage';

test.describe('用户登出', () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前先登录
    await quickLoginWorkflow(page);
  });

  test('应该成功登出并跳转到登录页面', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // 验证当前已登录
    await dashboardPage.expectUserLoggedIn();
    
    // 登出
    await logoutWorkflow(page);
    
    // 验证已跳转到登录页面
    expect(page.url()).toContain('/login');
  });

  test('应该清除认证信息', async ({ page }) => {
    // 登出
    await logoutWorkflow(page);
    
    // 验证 localStorage 中的 token 已被清除
    const token = await page.evaluate(() => {
      return localStorage.getItem('auth_token');
    });
    
    expect(token).toBeNull();
  });

  test('登出后不应该能访问受保护的页面', async ({ page }) => {
    // 登出
    await logoutWorkflow(page);
    
    // 尝试访问 Dashboard
    await page.goto('/dashboard');
    
    // 应该被重定向到登录页面
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('应该在登出后能够重新登录', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // 登出
    await dashboardPage.logout();
    
    // 重新登录
    const loginPage = new LoginPage(page);
    await loginPage.quickLogin();
    
    // 验证登录成功
    await page.waitForURL('**/dashboard');
    await dashboardPage.expectUserLoggedIn();
  });

  test('应该清除所有会话数据', async ({ page, context }) => {
    // 登出
    await logoutWorkflow(page);
    
    // 验证所有 Cookie 已被清除
    const cookies = await context.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('auth') || c.name.includes('token') || c.name.includes('session')
    );
    
    expect(authCookies.length).toBe(0);
  });
});

test.describe('登出边界情况', () => {
  test('应该处理网络错误时的登出', async ({ page }) => {
    await quickLoginWorkflow(page);
    
    // 模拟网络离线
    await page.context().setOffline(true);
    
    const dashboardPage = new DashboardPage(page);
    
    // 尝试登出
    await dashboardPage.userMenu.click();
    await dashboardPage.logoutButton.click();
    
    // 即使网络错误，也应该清除本地状态
    const token = await page.evaluate(() => {
      return localStorage.getItem('auth_token');
    });
    
    expect(token).toBeNull();
  });

  test('应该处理重复登出请求', async ({ page }) => {
    await quickLoginWorkflow(page);
    
    // 第一次登出
    await logoutWorkflow(page);
    
    // 验证已在登录页面
    expect(page.url()).toContain('/login');
    
    // 尝试再次访问登出端点（模拟重复请求）
    await page.goto('/api/auth/logout');
    
    // 应该不会出错
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectFormVisible();
  });
});

