import { Page } from '@playwright/test';
import { ContentPage, ContentDetailPage, ContentEditorPage } from '../page-objects/ContentPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { generateRandomString } from '../helpers/test-utils';

/**
 * 内容相关工作流
 */

/**
 * 创建内容的完整流程
 */
export async function createContentWorkflow(page: Page, contentData?: {
  title?: string;
  description?: string;
  content?: string;
  category?: string;
  tags?: string[];
}) {
  // 1. 从 Dashboard 导航到内容页面
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.goToContent();
  
  // 2. 点击创建按钮
  const contentPage = new ContentPage(page);
  await contentPage.createContent();
  
  // 3. 填写内容表单
  const editorPage = new ContentEditorPage(page);
  const title = contentData?.title || `测试内容 ${generateRandomString(6)}`;
  const description = contentData?.description || '这是一个测试内容的描述';
  const content = contentData?.content || '这是测试内容的正文部分，包含了详细的内容信息。';
  
  await editorPage.createContent(
    title,
    description,
    content,
    contentData?.category,
    contentData?.tags
  );
  
  // 4. 发布内容
  await editorPage.publish();
  
  // 5. 等待跳转到内容详情页面
  await page.waitForURL('**/content/**', { timeout: 10000 });
  
  return {
    title,
    description,
    content,
  };
}

/**
 * 浏览和搜索内容流程
 */
export async function browseAndSearchContentWorkflow(page: Page, searchQuery: string) {
  // 1. 访问内容页面
  const contentPage = new ContentPage(page);
  await contentPage.goto();
  
  // 2. 搜索内容
  await contentPage.search(searchQuery);
  
  // 3. 点击第一个搜索结果
  const contentCount = await contentPage.getContentCount();
  if (contentCount > 0) {
    await contentPage.clickContent(0);
    await page.waitForURL('**/content/**');
  }
  
  return contentCount;
}

/**
 * 查看内容详情流程
 */
export async function viewContentDetailWorkflow(page: Page, contentId: string) {
  // 访问内容详情页面
  const detailPage = new ContentDetailPage(page, contentId);
  await detailPage.goto();
  
  // 验证内容可见
  await detailPage.expectContentVisible();
  
  // 获取内容信息
  const title = await detailPage.getTitle();
  const description = await detailPage.getDescription();
  const author = await detailPage.getAuthor();
  
  return { title, description, author };
}

/**
 * 点赞和评论内容流程
 */
export async function likeAndCommentContentWorkflow(
  page: Page,
  contentId: string,
  comment: string
) {
  // 1. 访问内容详情页面
  const detailPage = new ContentDetailPage(page, contentId);
  await detailPage.goto();
  
  // 2. 点赞
  await detailPage.like();
  
  // 3. 添加评论
  await detailPage.addComment(comment);
  
  // 4. 验证评论已添加
  const commentCount = await detailPage.getCommentCount();
  
  return commentCount;
}

/**
 * 编辑内容流程
 */
export async function editContentWorkflow(
  page: Page,
  contentIndex: number,
  updatedData: {
    title?: string;
    description?: string;
    content?: string;
  }
) {
  // 1. 访问内容列表
  const contentPage = new ContentPage(page);
  await contentPage.goto();
  
  // 2. 点击编辑按钮
  await contentPage.editContent(contentIndex);
  
  // 3. 更新内容
  const editorPage = new ContentEditorPage(page);
  if (updatedData.title || updatedData.description || updatedData.content) {
    await editorPage.createContent(
      updatedData.title || '',
      updatedData.description || '',
      updatedData.content || ''
    );
  }
  
  // 4. 发布更新
  await editorPage.publish();
  
  // 5. 等待跳转
  await page.waitForURL('**/content/**');
  
  return updatedData;
}

/**
 * 删除内容流程
 */
export async function deleteContentWorkflow(page: Page, contentIndex: number) {
  // 1. 访问内容列表
  const contentPage = new ContentPage(page);
  await contentPage.goto();
  
  // 2. 获取删除前的内容数量
  const beforeCount = await contentPage.getContentCount();
  
  // 3. 删除内容
  await contentPage.deleteContent(contentIndex);
  
  // 4. 验证内容已删除
  await contentPage.waitForLoad();
  const afterCount = await contentPage.getContentCount();
  
  return {
    beforeCount,
    afterCount,
    deleted: beforeCount - afterCount === 1,
  };
}

/**
 * 完整的内容生命周期流程：创建 -> 查看 -> 编辑 -> 删除
 */
export async function fullContentLifecycleWorkflow(page: Page) {
  // 1. 创建内容
  const contentData = await createContentWorkflow(page);
  
  // 2. 返回内容列表
  const contentPage = new ContentPage(page);
  await contentPage.goto();
  
  // 3. 验证内容存在
  await contentPage.expectContentExists(contentData.title);
  
  // 4. 编辑内容
  const updatedTitle = `${contentData.title} (已编辑)`;
  await editContentWorkflow(page, 0, {
    title: updatedTitle,
  });
  
  // 5. 返回列表并删除内容
  await contentPage.goto();
  await deleteContentWorkflow(page, 0);
  
  // 6. 验证内容已删除
  await contentPage.expectContentNotExists(updatedTitle);
  
  return contentData;
}

/**
 * 内容筛选和排序流程
 */
export async function filterAndSortContentWorkflow(
  page: Page,
  category: string,
  sortBy: 'latest' | 'popular' | 'oldest'
) {
  const contentPage = new ContentPage(page);
  await contentPage.goto();
  
  // 筛选
  await contentPage.filterBy(category);
  
  // 排序
  await contentPage.sortBy(sortBy);
  
  // 获取筛选后的内容数量
  const contentCount = await contentPage.getContentCount();
  
  return contentCount;
}

