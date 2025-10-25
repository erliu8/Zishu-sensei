import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * Card 组件视觉回归测试
 */
test.describe('Card Component - Visual Tests', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.goto('/test/components/card');
  });

  test('default card', async ({ page }) => {
    const card = page.locator('[data-testid="card-default"]');
    await expect(card).toHaveScreenshot('card-default.png');
  });

  test('card with header', async ({ page }) => {
    const card = page.locator('[data-testid="card-with-header"]');
    await expect(card).toHaveScreenshot('card-with-header.png');
  });

  test('card with footer', async ({ page }) => {
    const card = page.locator('[data-testid="card-with-footer"]');
    await expect(card).toHaveScreenshot('card-with-footer.png');
  });

  test('card with image', async ({ page }) => {
    const card = page.locator('[data-testid="card-with-image"]');
    await expect(card).toHaveScreenshot('card-with-image.png');
  });

  test('interactive card hover', async ({ visualPage, page }) => {
    const card = page.locator('[data-testid="card-interactive"]');
    await visualPage.hover('[data-testid="card-interactive"]');
    await expect(card).toHaveScreenshot('card-hover.png');
  });

  test('card with shadow', async ({ page }) => {
    const card = page.locator('[data-testid="card-shadow"]');
    await expect(card).toHaveScreenshot('card-shadow.png');
  });

  test('card variants', async ({ page }) => {
    const container = page.locator('[data-testid="card-variants"]');
    await expect(container).toHaveScreenshot('card-variants.png');
  });

  test('card in dark mode', async ({ visualPage, page }) => {
    await visualPage.switchTheme('dark');
    const card = page.locator('[data-testid="card-default"]');
    await expect(card).toHaveScreenshot('card-dark-mode.png');
  });

  test('card grid layout', async ({ page }) => {
    const grid = page.locator('[data-testid="card-grid"]');
    await expect(grid).toHaveScreenshot('card-grid.png');
  });
});

