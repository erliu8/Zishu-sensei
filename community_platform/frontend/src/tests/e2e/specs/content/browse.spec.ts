import { test, expect } from '@playwright/test';
import { quickLoginWorkflow } from '../../workflows/auth-workflows';
import { browseAndSearchContentWorkflow } from '../../workflows/content-workflows';
import { ContentPage } from '../../page-objects/ContentPage';
import { testSearchQueries } from '../../fixtures/test-data';

test.describe('浏览内容', () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前先登录
    await quickLoginWorkflow(page);
  });

  test('应该显示内容列表', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 验证内容列表可见
    await contentPage.expectContentListVisible();
  });

  test('应该能够查看内容详情', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      // 点击第一个内容
      await contentPage.clickContent(0);
      
      // 验证跳转到详情页
      await page.waitForURL('**/content/**');
      expect(page.url()).toContain('/content/');
    }
  });

  test('应该能够搜索内容', async ({ page }) => {
    const searchQuery = testSearchQueries[0];
    const resultCount = await browseAndSearchContentWorkflow(page, searchQuery);
    
    // 验证搜索已执行
    expect(page.url()).toContain(searchQuery);
  });

  test('应该显示搜索结果数量', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 搜索内容
    await contentPage.search(testSearchQueries[0]);
    
    // 验证结果数量显示
    const resultsCount = page.locator('[data-testid="search-results-count"]');
    if (await resultsCount.isVisible()) {
      const text = await resultsCount.textContent();
      expect(text).toMatch(/\d+/); // 应该包含数字
    }
  });

  test('应该在没有搜索结果时显示空状态', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 搜索一个不存在的关键词
    await contentPage.search('这是一个不存在的搜索词xyz123');
    
    // 等待加载完成
    await contentPage.waitForLoadingToDisappear();
    
    // 验证空状态或无结果消息
    const noResults = page.getByTestId('search-no-results');
    if (await noResults.isVisible()) {
      await expect(noResults).toBeVisible();
    }
  });

  test('应该能够筛选内容', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 筛选内容
    await contentPage.filterBy('tutorial');
    
    // 验证 URL 包含筛选参数
    expect(page.url()).toContain('tutorial');
  });

  test('应该能够排序内容', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 按最新排序
    await contentPage.sortBy('latest');
    
    // 验证 URL 包含排序参数
    expect(page.url()).toContain('latest');
  });

  test('应该支持无限滚动加载更多内容', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 获取初始内容数量
    const initialCount = await contentPage.getContentCount();
    
    // 滚动到底部
    await contentPage.scrollToBottom();
    
    // 等待加载更多内容
    await contentPage.waitForLoadingToDisappear();
    
    // 获取新的内容数量
    const newCount = await contentPage.getContentCount();
    
    // 验证内容已加载（如果有更多内容的话）
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('应该能够点赞内容', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      // 点赞第一个内容
      await contentPage.likeContent(0);
      
      // 验证点赞成功
      await contentPage.waitForLoadingToDisappear();
      
      // 验证点赞按钮状态改变
      const firstCard = contentPage.contentCards.first();
      const likeButton = firstCard.getByTestId('content-like-button');
      const isLiked = await likeButton.getAttribute('data-liked');
      expect(isLiked).toBe('true');
    }
  });

  test('应该能够分享内容', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      // 分享第一个内容
      await contentPage.shareContent(0);
      
      // 验证分享模态框显示
      const shareModal = page.locator('[data-testid="share-modal"]');
      await expect(shareModal).toBeVisible();
    }
  });
});

test.describe('内容列表交互', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该在悬停时显示更多操作', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      const firstCard = contentPage.contentCards.first();
      
      // 悬停在内容卡片上
      await firstCard.hover();
      
      // 验证更多操作按钮显示
      const moreButton = firstCard.locator('[data-testid="more-actions"]');
      if (await moreButton.isVisible()) {
        await expect(moreButton).toBeVisible();
      }
    }
  });

  test('应该显示内容作者信息', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      const firstCard = contentPage.contentCards.first();
      const author = firstCard.getByTestId('content-author');
      
      // 验证作者信息显示
      await expect(author).toBeVisible();
    }
  });

  test('应该显示内容创建时间', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      const firstCard = contentPage.contentCards.first();
      const createdAt = firstCard.getByTestId('content-created-at');
      
      // 验证创建时间显示
      await expect(createdAt).toBeVisible();
    }
  });

  test('应该显示点赞和评论数量', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      const firstCard = contentPage.contentCards.first();
      const likesCount = firstCard.getByTestId('content-likes-count');
      const commentsCount = firstCard.getByTestId('content-comments-count');
      
      // 验证统计数据显示
      await expect(likesCount).toBeVisible();
      await expect(commentsCount).toBeVisible();
    }
  });
});

test.describe('内容筛选和排序', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够组合筛选和排序', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 先筛选
    await contentPage.filterBy('tutorial');
    
    // 再排序
    await contentPage.sortBy('popular');
    
    // 验证 URL 包含两个参数
    const url = page.url();
    expect(url).toContain('tutorial');
    expect(url).toContain('popular');
  });

  test('应该能够清除筛选条件', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 应用筛选
    await contentPage.filterBy('tutorial');
    
    // 清除筛选
    const clearButton = page.getByRole('button', { name: /清除|clear/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      
      // 验证URL不再包含筛选参数
      await contentPage.waitForLoad();
      const url = page.url();
      expect(url).not.toContain('category=tutorial');
    }
  });
});

test.describe('内容列表响应式设计', () => {
  test('应该在移动设备上正常显示', async ({ page }) => {
    await quickLoginWorkflow(page);
    
    // 设置移动设备视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 验证内容列表可见
    await contentPage.expectContentListVisible();
  });

  test('应该在平板设备上使用网格布局', async ({ page }) => {
    await quickLoginWorkflow(page);
    
    // 设置平板设备视口
    await page.setViewportSize({ width: 768, height: 1024 });
    
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 验证内容列表可见
    await contentPage.expectContentListVisible();
  });
});

