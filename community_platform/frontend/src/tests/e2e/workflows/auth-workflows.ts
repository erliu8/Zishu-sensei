import { Page } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { RegisterPage } from '../page-objects/RegisterPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { generateTestUser } from '../helpers/test-utils';

/**
 * 认证相关工作流
 */

/**
 * 完整的注册和登录流程
 */
export async function registerAndLoginWorkflow(page: Page) {
  // 1. 注册新用户
  const registerPage = new RegisterPage(page);
  await registerPage.goto();
  
  const testUser = generateTestUser();
  await registerPage.register(
    testUser.username,
    testUser.email,
    testUser.password
  );
  
  // 2. 等待注册成功并跳转到登录页面
  await page.waitForURL('**/login', { timeout: 10000 }).catch(async () => {
    // 如果没有自动跳转，手动跳转
    await registerPage.goToLogin();
  });
  
  // 3. 登录
  const loginPage = new LoginPage(page);
  await loginPage.login(testUser.email, testUser.password);
  
  // 4. 验证登录成功
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.expectUserLoggedIn(testUser.username);
  
  return testUser;
}

/**
 * 快速登录流程
 */
export async function quickLoginWorkflow(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.quickLogin();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  return new DashboardPage(page);
}

/**
 * 登出流程
 */
export async function logoutWorkflow(page: Page) {
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.logout();
  await page.waitForURL('**/login', { timeout: 10000 });
}

/**
 * 完整的认证循环：注册 -> 登录 -> 登出
 */
export async function fullAuthCycleWorkflow(page: Page) {
  // 注册并登录
  const testUser = await registerAndLoginWorkflow(page);
  
  // 验证已登录
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.expectUserLoggedIn(testUser.username);
  
  // 登出
  await logoutWorkflow(page);
  
  return testUser;
}

/**
 * 使用已存在账号登录流程
 */
export async function loginWithExistingUserWorkflow(
  page: Page,
  email: string,
  password: string
) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForSuccess(email, password);
  
  return new DashboardPage(page);
}

/**
 * 验证登录失败流程
 */
export async function expectLoginFailureWorkflow(
  page: Page,
  email: string,
  password: string,
  expectedError?: string
) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndExpectError(email, password, expectedError);
}

/**
 * 注册失败流程（邮箱已存在）
 */
export async function expectRegisterFailureWorkflow(
  page: Page,
  existingEmail: string
) {
  const registerPage = new RegisterPage(page);
  await registerPage.goto();
  
  const testUser = generateTestUser();
  await registerPage.registerAndExpectError(
    testUser.username,
    existingEmail, // 使用已存在的邮箱
    testUser.password,
    '邮箱已被注册'
  );
}

