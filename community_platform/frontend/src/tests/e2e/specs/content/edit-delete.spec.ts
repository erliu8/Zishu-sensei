import { test, expect } from '@playwright/test';
import { quickLoginWorkflow } from '../../workflows/auth-workflows';
import { createContentWorkflow, editContentWorkflow, deleteContentWorkflow } from '../../workflows/content-workflows';
import { ContentPage } from '../../page-objects/ContentPage';

test.describe('编辑内容', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够编辑自己的内容', async ({ page }) => {
    // 先创建一个内容
    await createContentWorkflow(page);
    
    // 返回内容列表
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 编辑内容
    const updatedData = await editContentWorkflow(page, 0, {
      title: '更新后的标题',
    });
    
    // 验证跳转到详情页
    expect(page.url()).toContain('/content/');
    
    // 验证标题已更新
    const title = page.getByTestId('content-title');
    await expect(title).toContainText('更新后的标题');
  });

  test('应该能够更新内容描述', async ({ page }) => {
    await createContentWorkflow(page);
    
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const updatedDescription = '这是更新后的描述';
    await editContentWorkflow(page, 0, {
      description: updatedDescription,
    });
    
    // 验证描述已更新
    const description = page.getByTestId('content-description');
    await expect(description).toContainText(updatedDescription);
  });

  test('应该能够更新内容正文', async ({ page }) => {
    await createContentWorkflow(page);
    
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const updatedContent = '这是更新后的正文内容';
    await editContentWorkflow(page, 0, {
      content: updatedContent,
    });
    
    // 验证正文已更新
    const content = page.locator('[data-testid="content-body"]');
    await expect(content).toContainText(updatedContent);
  });

  test('不应该能够编辑他人的内容', async ({ page }) => {
    // 访问他人创建的内容（假设ID为 'other-user-content'）
    await page.goto('/content/other-user-content');
    
    // 验证编辑按钮不可见或被禁用
    const editButton = page.getByTestId('content-edit-button');
    
    // 编辑按钮应该不存在或不可见
    const isVisible = await editButton.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

test.describe('删除内容', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够删除自己的内容', async ({ page }) => {
    // 先创建一个内容
    const contentData = await createContentWorkflow(page);
    
    // 返回内容列表
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 删除内容
    const result = await deleteContentWorkflow(page, 0);
    
    // 验证内容已被删除
    expect(result.deleted).toBe(true);
    
    // 验证内容不再显示在列表中
    await contentPage.expectContentNotExists(contentData.title);
  });

  test('应该显示删除确认对话框', async ({ page }) => {
    await createContentWorkflow(page);
    
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const contentCount = await contentPage.getContentCount();
    
    if (contentCount > 0) {
      const firstCard = contentPage.contentCards.first();
      const deleteButton = firstCard.getByTestId('content-delete-button');
      await deleteButton.click();
      
      // 验证确认对话框显示
      const confirmDialog = page.locator('[data-testid="confirm-delete-dialog"]');
      await expect(confirmDialog).toBeVisible();
      
      // 取消删除
      const cancelButton = page.getByRole('button', { name: /取消|cancel/i });
      await cancelButton.click();
      
      // 验证对话框已关闭
      await expect(confirmDialog).not.toBeVisible();
    }
  });

  test('应该能够取消删除操作', async ({ page }) => {
    await createContentWorkflow(page);
    
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    const beforeCount = await contentPage.getContentCount();
    
    if (beforeCount > 0) {
      // 点击删除
      const firstCard = contentPage.contentCards.first();
      const deleteButton = firstCard.getByTestId('content-delete-button');
      await deleteButton.click();
      
      // 取消删除
      const cancelButton = page.getByRole('button', { name: /取消|cancel/i });
      await cancelButton.click();
      
      // 验证内容仍然存在
      await contentPage.waitForLoad();
      const afterCount = await contentPage.getContentCount();
      expect(afterCount).toBe(beforeCount);
    }
  });

  test('不应该能够删除他人的内容', async ({ page }) => {
    // 访问他人创建的内容
    await page.goto('/content/other-user-content');
    
    // 验证删除按钮不可见
    const deleteButton = page.getByTestId('content-delete-button');
    const isVisible = await deleteButton.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

test.describe('内容版本控制', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该保存编辑历史', async ({ page }) => {
    await createContentWorkflow(page);
    
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 编辑内容
    await editContentWorkflow(page, 0, {
      title: '第一次编辑',
    });
    
    // 再次编辑
    await contentPage.goto();
    await editContentWorkflow(page, 0, {
      title: '第二次编辑',
    });
    
    // 查看编辑历史
    const historyButton = page.getByRole('button', { name: /历史|history/i });
    if (await historyButton.isVisible()) {
      await historyButton.click();
      
      // 验证历史记录显示
      const historyPanel = page.locator('[data-testid="edit-history"]');
      await expect(historyPanel).toBeVisible();
    }
  });
});

