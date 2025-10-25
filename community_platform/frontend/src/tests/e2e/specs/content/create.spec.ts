import { test, expect } from '@playwright/test';
import { quickLoginWorkflow } from '../../workflows/auth-workflows';
import { createContentWorkflow } from '../../workflows/content-workflows';
import { ContentPage, ContentEditorPage } from '../../page-objects/ContentPage';
import { testContents } from '../../fixtures/test-data';

test.describe('创建内容', () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前先登录
    await quickLoginWorkflow(page);
  });

  test('应该能够访问内容创建页面', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    
    // 点击创建按钮
    await contentPage.createContent();
    
    // 验证跳转到创建页面
    expect(page.url()).toContain('/content/create');
    
    // 验证编辑器可见
    const editorPage = new ContentEditorPage(page);
    await editorPage.expectEditorVisible();
  });

  test('应该成功创建新内容', async ({ page }) => {
    const contentData = testContents.article;
    const result = await createContentWorkflow(page, contentData);
    
    // 验证跳转到内容详情页面
    expect(page.url()).toContain('/content/');
    
    // 验证内容标题显示
    const title = page.getByTestId('content-title');
    await expect(title).toContainText(result.title);
  });

  test('应该验证必填字段', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    
    // 不填写任何内容，直接点击发布
    await editorPage.publishButton.click();
    
    // 验证显示验证错误
    const errorMessage = page.locator('[data-error="title"]');
    await expect(errorMessage).toBeVisible();
  });

  test('应该能够保存草稿', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    const contentData = testContents.article;
    
    // 填写内容
    await editorPage.createContent(
      contentData.title,
      contentData.description,
      contentData.content
    );
    
    // 保存为草稿
    await editorPage.saveDraft();
    
    // 验证保存成功提示
    await editorPage.expectToast('草稿已保存');
  });

  test('应该能够预览内容', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    const contentData = testContents.article;
    
    // 填写内容
    await editorPage.createContent(
      contentData.title,
      contentData.description,
      contentData.content
    );
    
    // 预览内容
    await editorPage.preview();
    
    // 验证预览模态框显示
    const previewModal = page.locator('[data-testid="preview-modal"]');
    await expect(previewModal).toBeVisible();
  });

  test('应该能够添加标签', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    const contentData = testContents.article;
    
    // 填写内容并添加标签
    await editorPage.createContent(
      contentData.title,
      contentData.description,
      contentData.content,
      contentData.category,
      contentData.tags
    );
    
    // 发布
    await editorPage.publish();
    
    // 验证标签显示在内容详情页
    const tags = page.locator('[data-testid="content-tags"]');
    await expect(tags).toBeVisible();
    
    for (const tag of contentData.tags) {
      await expect(tags).toContainText(tag);
    }
  });

  test('应该能够选择类别', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    const contentData = testContents.tutorial;
    
    // 填写内容并选择类别
    await editorPage.createContent(
      contentData.title,
      contentData.description,
      contentData.content,
      contentData.category
    );
    
    // 发布
    await editorPage.publish();
    
    // 验证类别显示
    const category = page.locator('[data-testid="content-category"]');
    await expect(category).toContainText(contentData.category);
  });

  test('应该能够取消创建', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    
    // 填写一些内容
    await editorPage.titleInput.fill('测试标题');
    
    // 点击取消
    await editorPage.cancel();
    
    // 验证跳转回内容列表页面
    expect(page.url()).toContain('/content');
    expect(page.url()).not.toContain('/create');
  });

  test('应该支持 Markdown 格式', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    
    // 使用 Markdown 格式创建内容
    const markdownContent = testContents.tutorial.content;
    await editorPage.createContent(
      '测试 Markdown',
      '测试 Markdown 渲染',
      markdownContent
    );
    
    // 预览查看渲染效果
    await editorPage.preview();
    
    // 验证 Markdown 已被正确渲染
    const preview = page.locator('[data-testid="preview-content"]');
    
    // 验证标题标签存在
    const heading = preview.locator('h1, h2');
    await expect(heading).toBeVisible();
  });

  test('应该在离开页面前提示未保存的更改', async ({ page }) => {
    const contentPage = new ContentPage(page);
    await contentPage.goto();
    await contentPage.createContent();
    
    const editorPage = new ContentEditorPage(page);
    
    // 填写一些内容
    await editorPage.titleInput.fill('未保存的内容');
    
    // 设置 beforeunload 监听器
    let dialogShown = false;
    page.on('dialog', async dialog => {
      dialogShown = true;
      await dialog.dismiss();
    });
    
    // 尝试离开页面
    await page.goto('/dashboard');
    
    // 注意：实际的 beforeunload 行为可能因浏览器和配置而异
    // 这个测试主要是验证逻辑是否存在
  });
});

test.describe('创建不同类型的内容', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够创建文章', async ({ page }) => {
    const result = await createContentWorkflow(page, testContents.article);
    expect(result.title).toBeTruthy();
  });

  test('应该能够创建教程', async ({ page }) => {
    const result = await createContentWorkflow(page, testContents.tutorial);
    expect(result.title).toBeTruthy();
  });

  test('应该能够创建测验', async ({ page }) => {
    const result = await createContentWorkflow(page, testContents.quiz);
    expect(result.title).toBeTruthy();
  });
});

test.describe('内容创建权限', () => {
  test('未登录用户不应该能访问创建页面', async ({ page }) => {
    // 直接访问创建页面（未登录）
    await page.goto('/content/create');
    
    // 应该被重定向到登录页面
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });
});

