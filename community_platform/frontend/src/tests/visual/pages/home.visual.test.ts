import { visualTest as test, expect } from '../helpers/BaseVisualTest';
import { takeFullPageScreenshot } from '../helpers/visual-test-utils';

/**
 * 首页视觉回归测试
 */
test.describe('Home Page - Visual Tests', () => {
  test('home page desktop view', async ({ visualPage, page }) => {
    await visualPage.goto('/');
    await expect(page).toHaveScreenshot('home-desktop.png', {
      fullPage: true,
    });
  });

  test('home page tablet view', async ({ visualPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await visualPage.goto('/');
    await expect(page).toHaveScreenshot('home-tablet.png', {
      fullPage: true,
    });
  });

  test('home page mobile view', async ({ visualPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await visualPage.goto('/');
    await expect(page).toHaveScreenshot('home-mobile.png', {
      fullPage: true,
    });
  });

  test('home page dark mode', async ({ visualPage, page }) => {
    await visualPage.goto('/');
    await visualPage.switchTheme('dark');
    await expect(page).toHaveScreenshot('home-dark-mode.png', {
      fullPage: true,
    });
  });

  test('home page hero section', async ({ visualPage, page }) => {
    await visualPage.goto('/');
    const hero = page.locator('[data-testid="hero-section"]');
    await expect(hero).toHaveScreenshot('home-hero.png');
  });

  test('home page features section', async ({ visualPage, page }) => {
    await visualPage.goto('/');
    await visualPage.scrollTo('[data-testid="features-section"]');
    const features = page.locator('[data-testid="features-section"]');
    await expect(features).toHaveScreenshot('home-features.png');
  });

  test('home page testimonials section', async ({ visualPage, page }) => {
    await visualPage.goto('/');
    await visualPage.scrollTo('[data-testid="testimonials-section"]');
    const testimonials = page.locator('[data-testid="testimonials-section"]');
    await expect(testimonials).toHaveScreenshot('home-testimonials.png');
  });

  test('home page footer', async ({ visualPage, page }) => {
    await visualPage.goto('/');
    await visualPage.scrollTo('[data-testid="footer"]');
    const footer = page.locator('[data-testid="footer"]');
    await expect(footer).toHaveScreenshot('home-footer.png');
  });

  test('home page with authenticated user', async ({ visualPage, page }) => {
    await visualPage.mockAuth();
    await visualPage.goto('/');
    await expect(page).toHaveScreenshot('home-authenticated.png', {
      fullPage: true,
    });
  });

  test('home page CTA buttons hover', async ({ visualPage, page }) => {
    await visualPage.goto('/');
    await visualPage.hover('[data-testid="cta-primary"]');
    const hero = page.locator('[data-testid="hero-section"]');
    await expect(hero).toHaveScreenshot('home-cta-hover.png');
  });
});

