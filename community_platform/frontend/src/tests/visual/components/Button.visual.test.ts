import { visualTest as test, expect } from '../helpers/BaseVisualTest';
import { testInteractionStates } from '../helpers/visual-test-utils';

/**
 * Button 组件视觉回归测试
 * 测试按钮在不同状态、主题和尺寸下的显示效果
 */
test.describe('Button Component - Visual Tests', () => {
  test.beforeEach(async ({ visualPage }) => {
    // 导航到按钮测试页面（可以是 Storybook 或专门的测试页面）
    await visualPage.goto('/test/components/button');
  });

  test('default button', async ({ page }) => {
    const button = page.locator('[data-testid="button-default"]');
    await expect(button).toHaveScreenshot('button-default.png');
  });

  test('primary button', async ({ page }) => {
    const button = page.locator('[data-testid="button-primary"]');
    await expect(button).toHaveScreenshot('button-primary.png');
  });

  test('secondary button', async ({ page }) => {
    const button = page.locator('[data-testid="button-secondary"]');
    await expect(button).toHaveScreenshot('button-secondary.png');
  });

  test('destructive button', async ({ page }) => {
    const button = page.locator('[data-testid="button-destructive"]');
    await expect(button).toHaveScreenshot('button-destructive.png');
  });

  test('outline button', async ({ page }) => {
    const button = page.locator('[data-testid="button-outline"]');
    await expect(button).toHaveScreenshot('button-outline.png');
  });

  test('ghost button', async ({ page }) => {
    const button = page.locator('[data-testid="button-ghost"]');
    await expect(button).toHaveScreenshot('button-ghost.png');
  });

  test('link button', async ({ page }) => {
    const button = page.locator('[data-testid="button-link"]');
    await expect(button).toHaveScreenshot('button-link.png');
  });

  // 按钮尺寸
  test('button sizes', async ({ page }) => {
    const container = page.locator('[data-testid="button-sizes"]');
    await expect(container).toHaveScreenshot('button-sizes.png');
  });

  test('small button', async ({ page }) => {
    const button = page.locator('[data-testid="button-sm"]');
    await expect(button).toHaveScreenshot('button-sm.png');
  });

  test('large button', async ({ page }) => {
    const button = page.locator('[data-testid="button-lg"]');
    await expect(button).toHaveScreenshot('button-lg.png');
  });

  // 按钮状态
  test('disabled button', async ({ page }) => {
    const button = page.locator('[data-testid="button-disabled"]');
    await expect(button).toHaveScreenshot('button-disabled.png');
  });

  test('loading button', async ({ page }) => {
    const button = page.locator('[data-testid="button-loading"]');
    await expect(button).toHaveScreenshot('button-loading.png');
  });

  test('button with icon', async ({ page }) => {
    const button = page.locator('[data-testid="button-with-icon"]');
    await expect(button).toHaveScreenshot('button-with-icon.png');
  });

  test('icon only button', async ({ page }) => {
    const button = page.locator('[data-testid="button-icon-only"]');
    await expect(button).toHaveScreenshot('button-icon-only.png');
  });

  // 交互状态测试
  test('button interaction states', async ({ page }) => {
    await testInteractionStates(
      page,
      '[data-testid="button-interactive"]',
      'button-interactive'
    );
  });

  test('button hover state', async ({ visualPage, page }) => {
    const button = page.locator('[data-testid="button-primary"]');
    await visualPage.hover('[data-testid="button-primary"]');
    await expect(button).toHaveScreenshot('button-primary-hover.png');
  });

  test('button focus state', async ({ page }) => {
    const button = page.locator('[data-testid="button-primary"]');
    await button.focus();
    await page.waitForTimeout(200);
    await expect(button).toHaveScreenshot('button-primary-focus.png');
  });

  // 深色主题
  test('button in dark mode', async ({ visualPage, page }) => {
    await visualPage.switchTheme('dark');
    const container = page.locator('[data-testid="button-container"]');
    await expect(container).toHaveScreenshot('button-dark-mode.png');
  });

  // 按钮组合
  test('button group', async ({ page }) => {
    const group = page.locator('[data-testid="button-group"]');
    await expect(group).toHaveScreenshot('button-group.png');
  });

  test('button with dropdown', async ({ page }) => {
    const button = page.locator('[data-testid="button-dropdown"]');
    await expect(button).toHaveScreenshot('button-dropdown.png');
  });

  // 响应式测试
  test('button on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const button = page.locator('[data-testid="button-primary"]');
    await expect(button).toHaveScreenshot('button-mobile.png');
  });
});

