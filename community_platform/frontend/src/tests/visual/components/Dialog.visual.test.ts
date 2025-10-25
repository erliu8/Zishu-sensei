import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * Dialog 组件视觉回归测试
 */
test.describe('Dialog Component - Visual Tests', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.goto('/test/components/dialog');
  });

  test('dialog closed', async ({ page }) => {
    await expect(page).toHaveScreenshot('dialog-closed.png');
  });

  test('dialog open', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-dialog"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveScreenshot('dialog-open.png');
  });

  test('dialog with header and footer', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-dialog-full"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveScreenshot('dialog-full.png');
  });

  test('dialog small size', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-dialog-small"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveScreenshot('dialog-small.png');
  });

  test('dialog large size', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-dialog-large"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveScreenshot('dialog-large.png');
  });

  test('dialog with form', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-dialog-form"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveScreenshot('dialog-form.png');
  });

  test('dialog backdrop', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-dialog"]');
    await expect(page).toHaveScreenshot('dialog-with-backdrop.png');
  });

  test('alert dialog', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-alert-dialog"]');
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toHaveScreenshot('alert-dialog.png');
  });

  test('confirmation dialog', async ({ visualPage, page }) => {
    await visualPage.click('[data-testid="open-confirmation-dialog"]');
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toHaveScreenshot('confirmation-dialog.png');
  });

  test('dialog in dark mode', async ({ visualPage, page }) => {
    await visualPage.switchTheme('dark');
    await visualPage.click('[data-testid="open-dialog"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveScreenshot('dialog-dark-mode.png');
  });
});

