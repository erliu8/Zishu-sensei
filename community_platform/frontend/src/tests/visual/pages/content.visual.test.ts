import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * 内容页面视觉回归测试
 */
test.describe('Content Pages - Visual Tests', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.mockAuth();
  });

  // 内容列表页
  test.describe('Content List', () => {
    test('content list full view', async ({ visualPage, page }) => {
      await visualPage.goto('/content');
      await expect(page).toHaveScreenshot('content-list.png', {
        fullPage: true,
      });
    });

    test('content list grid view', async ({ visualPage, page }) => {
      await visualPage.goto('/content?view=grid');
      const grid = page.locator('[data-testid="content-grid"]');
      await expect(grid).toHaveScreenshot('content-grid.png');
    });

    test('content list table view', async ({ visualPage, page }) => {
      await visualPage.goto('/content?view=table');
      const table = page.locator('[data-testid="content-table"]');
      await expect(table).toHaveScreenshot('content-table.png');
    });

    test('content list with filters', async ({ visualPage, page }) => {
      await visualPage.goto('/content');
      await visualPage.click('[data-testid="filter-button"]');
      await expect(page).toHaveScreenshot('content-filters.png');
    });

    test('content list empty state', async ({ visualPage, page }) => {
      await visualPage.goto('/content?filter=none');
      await expect(page).toHaveScreenshot('content-empty.png');
    });

    test('content list loading state', async ({ visualPage, page }) => {
      await page.route('**/api/content', async (route) => {
        await page.waitForTimeout(5000);
        await route.continue();
      });
      
      await visualPage.goto('/content');
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot('content-loading.png');
    });
  });

  // 内容详情页
  test.describe('Content Detail', () => {
    test('content detail full view', async ({ visualPage, page }) => {
      await visualPage.goto('/content/1');
      await expect(page).toHaveScreenshot('content-detail.png', {
        fullPage: true,
      });
    });

    test('content detail header', async ({ visualPage, page }) => {
      await visualPage.goto('/content/1');
      const header = page.locator('[data-testid="content-header"]');
      await expect(header).toHaveScreenshot('content-header.png');
    });

    test('content detail body', async ({ visualPage, page }) => {
      await visualPage.goto('/content/1');
      const body = page.locator('[data-testid="content-body"]');
      await expect(body).toHaveScreenshot('content-body.png');
    });

    test('content detail comments', async ({ visualPage, page }) => {
      await visualPage.goto('/content/1');
      await visualPage.scrollTo('[data-testid="comments-section"]');
      const comments = page.locator('[data-testid="comments-section"]');
      await expect(comments).toHaveScreenshot('content-comments.png');
    });

    test('content detail sidebar', async ({ visualPage, page }) => {
      await visualPage.goto('/content/1');
      const sidebar = page.locator('[data-testid="content-sidebar"]');
      await expect(sidebar).toHaveScreenshot('content-sidebar.png');
    });

    test('content detail dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/content/1');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('content-detail-dark.png', {
        fullPage: true,
      });
    });

    test('content detail mobile', async ({ visualPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await visualPage.goto('/content/1');
      await expect(page).toHaveScreenshot('content-detail-mobile.png', {
        fullPage: true,
      });
    });
  });

  // 内容创建/编辑页
  test.describe('Content Editor', () => {
    test('content editor new', async ({ visualPage, page }) => {
      await visualPage.goto('/content/new');
      await expect(page).toHaveScreenshot('content-editor-new.png', {
        fullPage: true,
      });
    });

    test('content editor with content', async ({ visualPage, page }) => {
      await visualPage.goto('/content/1/edit');
      await expect(page).toHaveScreenshot('content-editor-edit.png', {
        fullPage: true,
      });
    });

    test('content editor toolbar', async ({ visualPage, page }) => {
      await visualPage.goto('/content/new');
      const toolbar = page.locator('[data-testid="editor-toolbar"]');
      await expect(toolbar).toHaveScreenshot('editor-toolbar.png');
    });

    test('content editor preview', async ({ visualPage, page }) => {
      await visualPage.goto('/content/new');
      await visualPage.click('[data-testid="preview-tab"]');
      const preview = page.locator('[data-testid="editor-preview"]');
      await expect(preview).toHaveScreenshot('editor-preview.png');
    });

    test('content editor split view', async ({ visualPage, page }) => {
      await visualPage.goto('/content/new');
      await visualPage.click('[data-testid="split-view-button"]');
      await expect(page).toHaveScreenshot('editor-split-view.png');
    });

    test('content editor settings panel', async ({ visualPage, page }) => {
      await visualPage.goto('/content/new');
      await visualPage.click('[data-testid="settings-button"]');
      await expect(page).toHaveScreenshot('editor-settings.png');
    });

    test('content editor dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/content/new');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('editor-dark.png', {
        fullPage: true,
      });
    });
  });
});

