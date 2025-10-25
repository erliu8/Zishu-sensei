import { test, expect } from '@playwright/test';
import { quickLoginWorkflow } from '../../workflows/auth-workflows';
import { ProfilePage } from '../../page-objects/ProfilePage';

test.describe('关注用户', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够关注其他用户', async ({ page }) => {
    // 访问其他用户的资料页面
    const otherUserId = 'test-user-id';
    const profilePage = new ProfilePage(page, otherUserId);
    await profilePage.goto();
    
    // 获取关注前的粉丝数
    const beforeFollowers = await profilePage.getFollowersCount();
    
    // 关注用户
    await profilePage.follow();
    
    // 等待操作完成
    await profilePage.waitForLoadingToDisappear();
    
    // 验证粉丝数增加
    await page.reload();
    const afterFollowers = await profilePage.getFollowersCount();
    expect(afterFollowers).toBe(beforeFollowers + 1);
  });

  test('应该能够取消关注用户', async ({ page }) => {
    const otherUserId = 'test-user-id';
    const profilePage = new ProfilePage(page, otherUserId);
    await profilePage.goto();
    
    // 先关注
    await profilePage.follow();
    await page.reload();
    
    // 获取关注后的粉丝数
    const beforeUnfollow = await profilePage.getFollowersCount();
    
    // 取消关注
    await profilePage.unfollow();
    await profilePage.waitForLoadingToDisappear();
    
    // 验证粉丝数减少
    await page.reload();
    const afterUnfollow = await profilePage.getFollowersCount();
    expect(afterUnfollow).toBe(beforeUnfollow - 1);
  });

  test('应该显示关注状态', async ({ page }) => {
    const otherUserId = 'test-user-id';
    const profilePage = new ProfilePage(page, otherUserId);
    await profilePage.goto();
    
    // 关注用户
    await profilePage.follow();
    await page.reload();
    
    // 验证显示"已关注"状态
    const isFollowing = await profilePage.isFollowing();
    expect(isFollowing).toBe(true);
  });

  test('应该能够查看关注列表', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 切换到关注标签页
    await profilePage.switchToFollowingTab();
    
    // 验证关注列表显示
    await profilePage.waitForLoad();
    expect(page.url()).toContain('following');
  });

  test('应该能够查看粉丝列表', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 切换到粉丝标签页
    await profilePage.switchToFollowersTab();
    
    // 验证粉丝列表显示
    await profilePage.waitForLoad();
    expect(page.url()).toContain('followers');
  });
});

test.describe('评论功能', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够添加评论', async ({ page }) => {
    // 访问一个内容详情页
    await page.goto('/content/test-content-id');
    
    // 找到评论输入框
    const commentInput = page.getByTestId('comment-input');
    const commentSubmit = page.getByTestId('comment-submit-button');
    
    // 填写评论
    const commentText = '这是一条测试评论';
    await commentInput.fill(commentText);
    await commentSubmit.click();
    
    // 验证评论已添加
    const comment = page.locator('[data-testid="comment-item"]', {
      has: page.getByText(commentText),
    });
    await expect(comment).toBeVisible();
  });

  test('应该能够回复评论', async ({ page }) => {
    await page.goto('/content/test-content-id');
    
    // 找到第一条评论
    const firstComment = page.getByTestId('comment-item').first();
    
    if (await firstComment.isVisible()) {
      // 点击回复按钮
      const replyButton = firstComment.getByTestId('comment-reply-button');
      await replyButton.click();
      
      // 填写回复
      const replyInput = page.locator('[data-testid="reply-input"]');
      await replyInput.fill('这是一条回复');
      
      const replySubmit = page.getByRole('button', { name: /回复|reply/i });
      await replySubmit.click();
      
      // 验证回复已添加
      const reply = firstComment.locator('[data-testid="comment-reply"]');
      await expect(reply).toBeVisible();
    }
  });

  test('应该能够删除自己的评论', async ({ page }) => {
    await page.goto('/content/test-content-id');
    
    // 添加一条评论
    const commentInput = page.getByTestId('comment-input');
    const commentSubmit = page.getByTestId('comment-submit-button');
    
    const commentText = '待删除的评论';
    await commentInput.fill(commentText);
    await commentSubmit.click();
    
    // 等待评论出现
    const comment = page.locator('[data-testid="comment-item"]', {
      has: page.getByText(commentText),
    });
    await expect(comment).toBeVisible();
    
    // 删除评论
    const deleteButton = comment.getByTestId('comment-delete-button');
    await deleteButton.click();
    
    // 确认删除
    const confirmButton = page.getByRole('button', { name: /确认|confirm/i });
    await confirmButton.click();
    
    // 验证评论已删除
    await expect(comment).not.toBeVisible();
  });
});

test.describe('分享功能', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够分享内容', async ({ page }) => {
    await page.goto('/content/test-content-id');
    
    // 点击分享按钮
    const shareButton = page.getByTestId('content-share-button');
    await shareButton.click();
    
    // 验证分享模态框显示
    const shareModal = page.locator('[data-testid="share-modal"]');
    await expect(shareModal).toBeVisible();
  });

  test('应该显示多种分享选项', async ({ page }) => {
    await page.goto('/content/test-content-id');
    
    // 打开分享模态框
    const shareButton = page.getByTestId('content-share-button');
    await shareButton.click();
    
    // 验证分享选项
    const shareModal = page.locator('[data-testid="share-modal"]');
    const copyLinkButton = shareModal.getByRole('button', { name: /复制链接|copy link/i });
    
    await expect(copyLinkButton).toBeVisible();
  });

  test('应该能够复制分享链接', async ({ page }) => {
    await page.goto('/content/test-content-id');
    
    // 打开分享模态框
    const shareButton = page.getByTestId('content-share-button');
    await shareButton.click();
    
    // 复制链接
    const copyLinkButton = page.getByRole('button', { name: /复制链接|copy link/i });
    await copyLinkButton.click();
    
    // 验证成功提示
    const toast = page.getByTestId('ui-toast');
    await expect(toast).toContainText(/已复制|copied/i);
  });
});

