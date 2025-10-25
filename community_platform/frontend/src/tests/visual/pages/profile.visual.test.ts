import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * 用户资料页面视觉回归测试
 */
test.describe('Profile Pages - Visual Tests', () => {
  const mockUser = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
  };

  test.beforeEach(async ({ visualPage }) => {
    await visualPage.mockAuth(mockUser);
  });

  // 个人资料查看
  test.describe('Profile View', () => {
    test('profile page full view', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/1');
      await expect(page).toHaveScreenshot('profile-full.png', {
        fullPage: true,
      });
    });

    test('profile header', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/1');
      const header = page.locator('[data-testid="profile-header"]');
      await expect(header).toHaveScreenshot('profile-header.png');
    });

    test('profile stats', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/1');
      const stats = page.locator('[data-testid="profile-stats"]');
      await expect(stats).toHaveScreenshot('profile-stats.png');
    });

    test('profile content tab', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/1');
      await visualPage.click('[data-testid="content-tab"]');
      const content = page.locator('[data-testid="profile-content"]');
      await expect(content).toHaveScreenshot('profile-content-tab.png');
    });

    test('profile activity tab', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/1');
      await visualPage.click('[data-testid="activity-tab"]');
      const activity = page.locator('[data-testid="profile-activity"]');
      await expect(activity).toHaveScreenshot('profile-activity-tab.png');
    });

    test('profile followers tab', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/1');
      await visualPage.click('[data-testid="followers-tab"]');
      const followers = page.locator('[data-testid="profile-followers"]');
      await expect(followers).toHaveScreenshot('profile-followers-tab.png');
    });

    test('profile dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/1');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('profile-dark.png', {
        fullPage: true,
      });
    });

    test('profile mobile view', async ({ visualPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await visualPage.goto('/profile/1');
      await expect(page).toHaveScreenshot('profile-mobile.png', {
        fullPage: true,
      });
    });
  });

  // 个人设置页
  test.describe('Profile Settings', () => {
    test('settings page full view', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      await expect(page).toHaveScreenshot('settings-full.png', {
        fullPage: true,
      });
    });

    test('settings general tab', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      const general = page.locator('[data-testid="settings-general"]');
      await expect(general).toHaveScreenshot('settings-general.png');
    });

    test('settings account tab', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      await visualPage.click('[data-testid="account-tab"]');
      const account = page.locator('[data-testid="settings-account"]');
      await expect(account).toHaveScreenshot('settings-account.png');
    });

    test('settings security tab', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      await visualPage.click('[data-testid="security-tab"]');
      const security = page.locator('[data-testid="settings-security"]');
      await expect(security).toHaveScreenshot('settings-security.png');
    });

    test('settings notifications tab', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      await visualPage.click('[data-testid="notifications-tab"]');
      const notifications = page.locator('[data-testid="settings-notifications"]');
      await expect(notifications).toHaveScreenshot('settings-notifications.png');
    });

    test('settings privacy tab', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      await visualPage.click('[data-testid="privacy-tab"]');
      const privacy = page.locator('[data-testid="settings-privacy"]');
      await expect(privacy).toHaveScreenshot('settings-privacy.png');
    });

    test('settings appearance tab', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      await visualPage.click('[data-testid="appearance-tab"]');
      const appearance = page.locator('[data-testid="settings-appearance"]');
      await expect(appearance).toHaveScreenshot('settings-appearance.png');
    });

    test('settings dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/settings');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('settings-dark.png', {
        fullPage: true,
      });
    });

    test('settings mobile view', async ({ visualPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await visualPage.goto('/settings');
      await expect(page).toHaveScreenshot('settings-mobile.png', {
        fullPage: true,
      });
    });
  });

  // 编辑资料页
  test.describe('Edit Profile', () => {
    test('edit profile page', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/edit');
      await expect(page).toHaveScreenshot('edit-profile.png', {
        fullPage: true,
      });
    });

    test('edit profile form', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/edit');
      const form = page.locator('[data-testid="edit-profile-form"]');
      await expect(form).toHaveScreenshot('edit-profile-form.png');
    });

    test('edit profile avatar upload', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/edit');
      await visualPage.hover('[data-testid="avatar-upload"]');
      const avatar = page.locator('[data-testid="avatar-upload"]');
      await expect(avatar).toHaveScreenshot('edit-profile-avatar.png');
    });

    test('edit profile with validation errors', async ({ visualPage, page }) => {
      await visualPage.goto('/profile/edit');
      await visualPage.click('[data-testid="save-button"]');
      await page.waitForTimeout(300);
      const form = page.locator('[data-testid="edit-profile-form"]');
      await expect(form).toHaveScreenshot('edit-profile-errors.png');
    });
  });
});

