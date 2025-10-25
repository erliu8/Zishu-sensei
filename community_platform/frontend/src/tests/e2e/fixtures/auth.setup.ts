import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { LoginPage } from '../page-objects/LoginPage';
import { testUsers } from './test-data';

/**
 * 认证设置脚本
 * 在测试运行前预先登录，保存认证状态
 */

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');

setup('authenticate as regular user', async ({ page }) => {
  // 访问登录页面
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  
  // 使用测试用户登录
  await loginPage.login(testUsers.regularUser.email, testUsers.regularUser.password);
  
  // 等待登录成功
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // 验证登录成功
  expect(page.url()).toContain('dashboard');
  
  // 保存认证状态
  await page.context().storageState({ path: authFile });
});

