import { test, expect } from '@playwright/test';
import { quickLoginWorkflow } from '../../workflows/auth-workflows';
import { DashboardPage } from '../../page-objects/DashboardPage';

test.describe('用户设置', () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前先登录
    await quickLoginWorkflow(page);
    
    // 导航到设置页面
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goToSettings();
  });

  test('应该显示设置页面', async ({ page }) => {
    // 验证设置页面已加载
    expect(page.url()).toContain('/settings');
    
    // 验证设置选项可见
    const settingsContainer = page.locator('[data-testid="settings-container"]');
    await expect(settingsContainer).toBeVisible();
  });

  test('应该能够更改语言设置', async ({ page }) => {
    // 找到语言选择器
    const languageSelect = page.locator('select[name="language"]');
    await expect(languageSelect).toBeVisible();
    
    // 更改语言
    await languageSelect.selectOption('en');
    
    // 保存设置
    const saveButton = page.getByRole('button', { name: /保存|save/i });
    await saveButton.click();
    
    // 验证保存成功
    const toast = page.getByTestId('ui-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/保存成功|saved successfully/i);
  });

  test('应该能够更改主题设置', async ({ page }) => {
    // 找到主题选择器
    const themeSelect = page.locator('select[name="theme"]');
    
    if (await themeSelect.isVisible()) {
      // 更改主题
      await themeSelect.selectOption('dark');
      
      // 保存设置
      const saveButton = page.getByRole('button', { name: /保存|save/i });
      await saveButton.click();
      
      // 验证主题已应用
      await page.reload();
      const body = page.locator('body');
      const theme = await body.getAttribute('data-theme');
      expect(theme).toBe('dark');
    }
  });

  test('应该能够管理通知设置', async ({ page }) => {
    // 找到通知设置区域
    const notificationSettings = page.locator('[data-testid="notification-settings"]');
    
    if (await notificationSettings.isVisible()) {
      // 切换邮件通知
      const emailNotification = page.getByRole('checkbox', { name: /邮件通知|email notification/i });
      await emailNotification.click();
      
      // 保存设置
      const saveButton = page.getByRole('button', { name: /保存|save/i });
      await saveButton.click();
      
      // 验证保存成功
      const toast = page.getByTestId('ui-toast');
      await expect(toast).toBeVisible();
    }
  });

  test('应该能够管理隐私设置', async ({ page }) => {
    // 切换到隐私设置标签
    const privacyTab = page.getByRole('tab', { name: /隐私|privacy/i });
    
    if (await privacyTab.isVisible()) {
      await privacyTab.click();
      
      // 更改个人资料可见性
      const profileVisibility = page.locator('select[name="profileVisibility"]');
      await profileVisibility.selectOption('private');
      
      // 保存设置
      const saveButton = page.getByRole('button', { name: /保存|save/i });
      await saveButton.click();
      
      // 验证保存成功
      const toast = page.getByTestId('ui-toast');
      await expect(toast).toBeVisible();
    }
  });

  test('应该能够更改密码', async ({ page }) => {
    // 切换到安全设置标签
    const securityTab = page.getByRole('tab', { name: /安全|security/i });
    
    if (await securityTab.isVisible()) {
      await securityTab.click();
      
      // 填写密码更改表单
      const currentPassword = page.locator('input[name="currentPassword"]');
      const newPassword = page.locator('input[name="newPassword"]');
      const confirmPassword = page.locator('input[name="confirmPassword"]');
      
      await currentPassword.fill('OldPassword123!');
      await newPassword.fill('NewPassword123!');
      await confirmPassword.fill('NewPassword123!');
      
      // 提交更改
      const changePasswordButton = page.getByRole('button', { name: /更改密码|change password/i });
      await changePasswordButton.click();
      
      // 验证更改成功或显示错误（取决于当前密码是否正确）
      const message = page.locator('[data-testid="password-change-message"]');
      await expect(message).toBeVisible();
    }
  });

  test('应该能够查看账户统计', async ({ page }) => {
    // 切换到账户标签
    const accountTab = page.getByRole('tab', { name: /账户|account/i });
    
    if (await accountTab.isVisible()) {
      await accountTab.click();
      
      // 验证统计信息可见
      const stats = page.locator('[data-testid="account-stats"]');
      await expect(stats).toBeVisible();
      
      // 验证显示注册日期
      const registrationDate = page.locator('[data-testid="registration-date"]');
      await expect(registrationDate).toBeVisible();
    }
  });

  test('应该能够删除账户', async ({ page }) => {
    // 切换到账户标签
    const accountTab = page.getByRole('tab', { name: /账户|account/i });
    
    if (await accountTab.isVisible()) {
      await accountTab.click();
      
      // 找到删除账户按钮
      const deleteButton = page.getByRole('button', { name: /删除账户|delete account/i });
      
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // 应该显示确认对话框
        const confirmDialog = page.locator('[data-testid="confirm-delete-dialog"]');
        await expect(confirmDialog).toBeVisible();
        
        // 取消删除（为了不影响后续测试）
        const cancelButton = page.getByRole('button', { name: /取消|cancel/i });
        await cancelButton.click();
        
        // 验证对话框已关闭
        await expect(confirmDialog).not.toBeVisible();
      }
    }
  });
});

test.describe('设置持久性', () => {
  test('设置应该在刷新后保持', async ({ page }) => {
    await quickLoginWorkflow(page);
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goToSettings();
    
    // 更改设置
    const languageSelect = page.locator('select[name="language"]');
    await languageSelect.selectOption('en');
    
    const saveButton = page.getByRole('button', { name: /保存|save/i });
    await saveButton.click();
    
    // 刷新页面
    await page.reload();
    
    // 验证设置保持
    const selectedLanguage = await languageSelect.inputValue();
    expect(selectedLanguage).toBe('en');
  });

  test('设置应该在重新登录后保持', async ({ page, context }) => {
    await quickLoginWorkflow(page);
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goToSettings();
    
    // 更改设置
    const languageSelect = page.locator('select[name="language"]');
    await languageSelect.selectOption('en');
    
    const saveButton = page.getByRole('button', { name: /保存|save/i });
    await saveButton.click();
    
    // 登出
    await dashboardPage.logout();
    
    // 清除 Cookie 和存储
    await context.clearCookies();
    
    // 重新登录
    await quickLoginWorkflow(page);
    await dashboardPage.goToSettings();
    
    // 验证设置保持
    const selectedLanguage = await languageSelect.inputValue();
    expect(selectedLanguage).toBe('en');
  });
});

