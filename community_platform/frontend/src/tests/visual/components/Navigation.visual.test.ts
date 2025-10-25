import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * Navigation 组件视觉回归测试
 */
test.describe('Navigation Components - Visual Tests', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.goto('/test/components/navigation');
  });

  // Header/Navbar
  test.describe('Navbar', () => {
    test('navbar default', async ({ page }) => {
      const navbar = page.locator('[data-testid="navbar"]');
      await expect(navbar).toHaveScreenshot('navbar-default.png');
    });

    test('navbar with user menu', async ({ visualPage, page }) => {
      await visualPage.mockAuth();
      await page.reload();
      const navbar = page.locator('[data-testid="navbar"]');
      await expect(navbar).toHaveScreenshot('navbar-authenticated.png');
    });

    test('navbar mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const navbar = page.locator('[data-testid="navbar"]');
      await expect(navbar).toHaveScreenshot('navbar-mobile.png');
    });

    test('navbar mobile menu open', async ({ visualPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await visualPage.click('[data-testid="mobile-menu-button"]');
      await expect(page).toHaveScreenshot('navbar-mobile-menu-open.png');
    });

    test('navbar scrolled', async ({ visualPage, page }) => {
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(300);
      const navbar = page.locator('[data-testid="navbar"]');
      await expect(navbar).toHaveScreenshot('navbar-scrolled.png');
    });

    test('navbar dark mode', async ({ visualPage, page }) => {
      await visualPage.switchTheme('dark');
      const navbar = page.locator('[data-testid="navbar"]');
      await expect(navbar).toHaveScreenshot('navbar-dark.png');
    });
  });

  // Sidebar
  test.describe('Sidebar', () => {
    test('sidebar default', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toHaveScreenshot('sidebar-default.png');
    });

    test('sidebar collapsed', async ({ visualPage, page }) => {
      await visualPage.click('[data-testid="sidebar-toggle"]');
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toHaveScreenshot('sidebar-collapsed.png');
    });

    test('sidebar with active item', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toHaveScreenshot('sidebar-active-item.png');
    });

    test('sidebar mobile overlay', async ({ visualPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await visualPage.click('[data-testid="sidebar-toggle"]');
      await expect(page).toHaveScreenshot('sidebar-mobile-overlay.png');
    });
  });

  // Breadcrumb
  test.describe('Breadcrumb', () => {
    test('breadcrumb default', async ({ page }) => {
      const breadcrumb = page.locator('[data-testid="breadcrumb"]');
      await expect(breadcrumb).toHaveScreenshot('breadcrumb-default.png');
    });

    test('breadcrumb with icons', async ({ page }) => {
      const breadcrumb = page.locator('[data-testid="breadcrumb-with-icons"]');
      await expect(breadcrumb).toHaveScreenshot('breadcrumb-icons.png');
    });

    test('breadcrumb collapsed', async ({ page }) => {
      const breadcrumb = page.locator('[data-testid="breadcrumb-collapsed"]');
      await expect(breadcrumb).toHaveScreenshot('breadcrumb-collapsed.png');
    });
  });

  // Tabs
  test.describe('Tabs', () => {
    test('tabs default', async ({ page }) => {
      const tabs = page.locator('[data-testid="tabs"]');
      await expect(tabs).toHaveScreenshot('tabs-default.png');
    });

    test('tabs with active state', async ({ page }) => {
      const tabs = page.locator('[data-testid="tabs"]');
      await expect(tabs).toHaveScreenshot('tabs-active.png');
    });

    test('tabs vertical', async ({ page }) => {
      const tabs = page.locator('[data-testid="tabs-vertical"]');
      await expect(tabs).toHaveScreenshot('tabs-vertical.png');
    });

    test('tabs with icons', async ({ page }) => {
      const tabs = page.locator('[data-testid="tabs-with-icons"]');
      await expect(tabs).toHaveScreenshot('tabs-icons.png');
    });
  });

  // Pagination
  test.describe('Pagination', () => {
    test('pagination default', async ({ page }) => {
      const pagination = page.locator('[data-testid="pagination"]');
      await expect(pagination).toHaveScreenshot('pagination-default.png');
    });

    test('pagination first page', async ({ page }) => {
      const pagination = page.locator('[data-testid="pagination-first"]');
      await expect(pagination).toHaveScreenshot('pagination-first.png');
    });

    test('pagination last page', async ({ page }) => {
      const pagination = page.locator('[data-testid="pagination-last"]');
      await expect(pagination).toHaveScreenshot('pagination-last.png');
    });

    test('pagination with many pages', async ({ page }) => {
      const pagination = page.locator('[data-testid="pagination-many"]');
      await expect(pagination).toHaveScreenshot('pagination-many.png');
    });
  });

  // Dropdown Menu
  test.describe('Dropdown Menu', () => {
    test('dropdown closed', async ({ page }) => {
      const dropdown = page.locator('[data-testid="dropdown"]');
      await expect(dropdown).toHaveScreenshot('dropdown-closed.png');
    });

    test('dropdown open', async ({ visualPage, page }) => {
      await visualPage.click('[data-testid="dropdown-trigger"]');
      const menu = page.locator('[data-testid="dropdown-menu"]');
      await expect(menu).toHaveScreenshot('dropdown-open.png');
    });

    test('dropdown with icons', async ({ visualPage, page }) => {
      await visualPage.click('[data-testid="dropdown-icons-trigger"]');
      const menu = page.locator('[data-testid="dropdown-icons-menu"]');
      await expect(menu).toHaveScreenshot('dropdown-icons.png');
    });

    test('dropdown with dividers', async ({ visualPage, page }) => {
      await visualPage.click('[data-testid="dropdown-dividers-trigger"]');
      const menu = page.locator('[data-testid="dropdown-dividers-menu"]');
      await expect(menu).toHaveScreenshot('dropdown-dividers.png');
    });
  });
});

