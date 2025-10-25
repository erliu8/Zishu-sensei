import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * 仪表板页面视觉回归测试
 */
test.describe('Dashboard Page - Visual Tests', () => {
  test.beforeEach(async ({ visualPage }) => {
    // 模拟已登录用户
    await visualPage.mockAuth({
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
    });
  });

  test('dashboard full view', async ({ visualPage, page }) => {
    await visualPage.goto('/dashboard');
    await expect(page).toHaveScreenshot('dashboard-full.png', {
      fullPage: true,
    });
  });

  test('dashboard stats section', async ({ visualPage, page }) => {
    await visualPage.goto('/dashboard');
    const stats = page.locator('[data-testid="dashboard-stats"]');
    await expect(stats).toHaveScreenshot('dashboard-stats.png');
  });

  test('dashboard recent activity', async ({ visualPage, page }) => {
    await visualPage.goto('/dashboard');
    const activity = page.locator('[data-testid="recent-activity"]');
    await expect(activity).toHaveScreenshot('dashboard-activity.png');
  });

  test('dashboard progress chart', async ({ visualPage, page }) => {
    await visualPage.goto('/dashboard');
    const chart = page.locator('[data-testid="progress-chart"]');
    await expect(chart).toHaveScreenshot('dashboard-chart.png');
  });

  test('dashboard sidebar collapsed', async ({ visualPage, page }) => {
    await visualPage.goto('/dashboard');
    await visualPage.click('[data-testid="sidebar-toggle"]');
    await expect(page).toHaveScreenshot('dashboard-sidebar-collapsed.png');
  });

  test('dashboard dark mode', async ({ visualPage, page }) => {
    await visualPage.goto('/dashboard');
    await visualPage.switchTheme('dark');
    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      fullPage: true,
    });
  });

  test('dashboard mobile view', async ({ visualPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await visualPage.goto('/dashboard');
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
    });
  });

  test('dashboard tablet view', async ({ visualPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await visualPage.goto('/dashboard');
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
    });
  });

  test('dashboard empty state', async ({ visualPage, page }) => {
    // 设置空数据状态
    await visualPage.setLocalStorage('dashboard_data', { activities: [] });
    await visualPage.goto('/dashboard');
    await expect(page).toHaveScreenshot('dashboard-empty.png');
  });

  test('dashboard with notifications', async ({ visualPage, page }) => {
    await visualPage.goto('/dashboard');
    await visualPage.click('[data-testid="notifications-button"]');
    await expect(page).toHaveScreenshot('dashboard-notifications.png');
  });
});

