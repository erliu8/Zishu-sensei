import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TEST_IDS } from '../../test-ids';

/**
 * 内容页面对象
 */
export class ContentPage extends BasePage {
  // 页面元素
  readonly contentList: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly sortButton: Locator;
  readonly contentCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page, '/content');

    // 初始化页面元素
    this.contentList = page.locator('[data-testid="content-list"]');
    this.createButton = page.getByRole('button', { name: /创建|create/i });
    this.searchInput = page.getByTestId(TEST_IDS.SEARCH.INPUT);
    this.filterButton = page.getByRole('button', { name: /筛选|filter/i });
    this.sortButton = page.getByRole('button', { name: /排序|sort/i });
    this.contentCards = page.getByTestId(TEST_IDS.CONTENT.CARD);
    this.emptyState = page.locator('[data-testid="empty-state"]');
  }

  /**
   * 访问内容页面
   */
  async goto() {
    await super.goto();
    await this.waitForLoad();
  }

  /**
   * 创建新内容
   */
  async createContent() {
    await this.createButton.click();
    await this.page.waitForURL('**/content/create');
  }

  /**
   * 搜索内容
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForLoad();
  }

  /**
   * 获取内容卡片数量
   */
  async getContentCount(): Promise<number> {
    return await this.contentCards.count();
  }

  /**
   * 点击内容卡片
   */
  async clickContent(index: number) {
    await this.contentCards.nth(index).click();
  }

  /**
   * 点击内容卡片（通过标题）
   */
  async clickContentByTitle(title: string) {
    const card = this.page.locator(`[data-testid="${TEST_IDS.CONTENT.CARD}"]`, {
      has: this.page.getByText(title),
    });
    await card.click();
  }

  /**
   * 获取第一个内容的标题
   */
  async getFirstContentTitle(): Promise<string> {
    const firstCard = this.contentCards.first();
    const title = firstCard.getByTestId(TEST_IDS.CONTENT.TITLE);
    return await title.textContent() || '';
  }

  /**
   * 点赞内容
   */
  async likeContent(index: number) {
    const card = this.contentCards.nth(index);
    const likeButton = card.getByTestId(TEST_IDS.CONTENT.LIKE_BUTTON);
    await likeButton.click();
  }

  /**
   * 分享内容
   */
  async shareContent(index: number) {
    const card = this.contentCards.nth(index);
    const shareButton = card.getByTestId(TEST_IDS.CONTENT.SHARE_BUTTON);
    await shareButton.click();
  }

  /**
   * 删除内容
   */
  async deleteContent(index: number) {
    const card = this.contentCards.nth(index);
    const deleteButton = card.getByTestId(TEST_IDS.CONTENT.DELETE_BUTTON);
    await deleteButton.click();
    
    // 确认删除
    const confirmButton = this.page.getByRole('button', { name: /确认|confirm/i });
    await confirmButton.click();
    
    await this.waitForLoadingToDisappear();
  }

  /**
   * 编辑内容
   */
  async editContent(index: number) {
    const card = this.contentCards.nth(index);
    const editButton = card.getByTestId(TEST_IDS.CONTENT.EDIT_BUTTON);
    await editButton.click();
    await this.page.waitForURL('**/content/**/edit');
  }

  /**
   * 验证内容列表可见
   */
  async expectContentListVisible() {
    await expect(this.contentList).toBeVisible();
  }

  /**
   * 验证空状态
   */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * 验证内容存在
   */
  async expectContentExists(title: string) {
    const card = this.page.locator(`[data-testid="${TEST_IDS.CONTENT.CARD}"]`, {
      has: this.page.getByText(title),
    });
    await expect(card).toBeVisible();
  }

  /**
   * 验证内容不存在
   */
  async expectContentNotExists(title: string) {
    const card = this.page.locator(`[data-testid="${TEST_IDS.CONTENT.CARD}"]`, {
      has: this.page.getByText(title),
    });
    await expect(card).not.toBeVisible();
  }

  /**
   * 筛选内容
   */
  async filterBy(category: string) {
    await this.filterButton.click();
    const categoryOption = this.page.getByRole('option', { name: category });
    await categoryOption.click();
    await this.waitForLoad();
  }

  /**
   * 排序内容
   */
  async sortBy(option: 'latest' | 'popular' | 'oldest') {
    await this.sortButton.click();
    const sortOption = this.page.getByRole('option', { name: new RegExp(option, 'i') });
    await sortOption.click();
    await this.waitForLoad();
  }
}

/**
 * 内容详情页面对象
 */
export class ContentDetailPage extends BasePage {
  // 页面元素
  readonly contentTitle: Locator;
  readonly contentDescription: Locator;
  readonly contentAuthor: Locator;
  readonly contentCreatedAt: Locator;
  readonly likeButton: Locator;
  readonly shareButton: Locator;
  readonly deleteButton: Locator;
  readonly editButton: Locator;
  readonly commentSection: Locator;
  readonly commentInput: Locator;
  readonly commentSubmitButton: Locator;
  readonly comments: Locator;

  constructor(page: Page, contentId?: string) {
    super(page, contentId ? `/content/${contentId}` : '/content');

    // 初始化页面元素
    this.contentTitle = page.getByTestId(TEST_IDS.CONTENT.TITLE);
    this.contentDescription = page.getByTestId(TEST_IDS.CONTENT.DESCRIPTION);
    this.contentAuthor = page.getByTestId(TEST_IDS.CONTENT.AUTHOR);
    this.contentCreatedAt = page.getByTestId(TEST_IDS.CONTENT.CREATED_AT);
    this.likeButton = page.getByTestId(TEST_IDS.CONTENT.LIKE_BUTTON);
    this.shareButton = page.getByTestId(TEST_IDS.CONTENT.SHARE_BUTTON);
    this.deleteButton = page.getByTestId(TEST_IDS.CONTENT.DELETE_BUTTON);
    this.editButton = page.getByTestId(TEST_IDS.CONTENT.EDIT_BUTTON);
    this.commentSection = page.getByTestId(TEST_IDS.COMMENT.SECTION);
    this.commentInput = page.getByTestId(TEST_IDS.COMMENT.INPUT);
    this.commentSubmitButton = page.getByTestId(TEST_IDS.COMMENT.SUBMIT_BUTTON);
    this.comments = page.getByTestId(TEST_IDS.COMMENT.ITEM);
  }

  /**
   * 访问内容详情页面
   */
  async goto() {
    await super.goto();
    await expect(this.contentTitle).toBeVisible();
  }

  /**
   * 获取内容标题
   */
  async getTitle(): Promise<string> {
    return await this.contentTitle.textContent() || '';
  }

  /**
   * 获取内容描述
   */
  async getDescription(): Promise<string> {
    return await this.contentDescription.textContent() || '';
  }

  /**
   * 获取作者名称
   */
  async getAuthor(): Promise<string> {
    return await this.contentAuthor.textContent() || '';
  }

  /**
   * 点赞
   */
  async like() {
    await this.likeButton.click();
    await this.waitForLoadingToDisappear();
  }

  /**
   * 分享
   */
  async share() {
    await this.shareButton.click();
  }

  /**
   * 删除
   */
  async delete() {
    await this.deleteButton.click();
    
    // 确认删除
    const confirmButton = this.page.getByRole('button', { name: /确认|confirm/i });
    await confirmButton.click();
    
    await this.page.waitForURL('**/content');
  }

  /**
   * 编辑
   */
  async edit() {
    await this.editButton.click();
    await this.page.waitForURL('**/edit');
  }

  /**
   * 添加评论
   */
  async addComment(text: string) {
    await this.commentInput.fill(text);
    await this.commentSubmitButton.click();
    await this.waitForLoadingToDisappear();
  }

  /**
   * 获取评论数量
   */
  async getCommentCount(): Promise<number> {
    return await this.comments.count();
  }

  /**
   * 验证内容详情可见
   */
  async expectContentVisible() {
    await expect(this.contentTitle).toBeVisible();
    await expect(this.contentDescription).toBeVisible();
    await expect(this.contentAuthor).toBeVisible();
  }

  /**
   * 验证评论区可见
   */
  async expectCommentSectionVisible() {
    await expect(this.commentSection).toBeVisible();
    await expect(this.commentInput).toBeVisible();
  }
}

/**
 * 内容编辑器页面对象
 */
export class ContentEditorPage extends BasePage {
  // 页面元素
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly contentEditor: Locator;
  readonly categorySelect: Locator;
  readonly tagsInput: Locator;
  readonly publishButton: Locator;
  readonly saveDraftButton: Locator;
  readonly cancelButton: Locator;
  readonly previewButton: Locator;

  constructor(page: Page) {
    super(page, '/content/create');

    // 初始化页面元素
    this.titleInput = page.locator('input[name="title"]');
    this.descriptionInput = page.locator('textarea[name="description"]');
    this.contentEditor = page.locator('[data-testid="content-editor"]');
    this.categorySelect = page.locator('select[name="category"]');
    this.tagsInput = page.locator('input[name="tags"]');
    this.publishButton = page.getByRole('button', { name: /发布|publish/i });
    this.saveDraftButton = page.getByRole('button', { name: /保存草稿|save draft/i });
    this.cancelButton = page.getByRole('button', { name: /取消|cancel/i });
    this.previewButton = page.getByRole('button', { name: /预览|preview/i });
  }

  /**
   * 创建内容
   */
  async createContent(
    title: string,
    description: string,
    content: string,
    category?: string,
    tags?: string[]
  ) {
    await this.titleInput.fill(title);
    await this.descriptionInput.fill(description);
    await this.contentEditor.fill(content);
    
    if (category) {
      await this.categorySelect.selectOption(category);
    }
    
    if (tags && tags.length > 0) {
      await this.tagsInput.fill(tags.join(', '));
    }
  }

  /**
   * 发布内容
   */
  async publish() {
    await this.publishButton.click();
    await this.waitForLoadingToDisappear();
  }

  /**
   * 保存草稿
   */
  async saveDraft() {
    await this.saveDraftButton.click();
    await this.waitForLoadingToDisappear();
  }

  /**
   * 取消编辑
   */
  async cancel() {
    await this.cancelButton.click();
  }

  /**
   * 预览内容
   */
  async preview() {
    await this.previewButton.click();
    const previewModal = this.page.locator('[data-testid="preview-modal"]');
    await expect(previewModal).toBeVisible();
  }

  /**
   * 验证编辑器可见
   */
  async expectEditorVisible() {
    await expect(this.titleInput).toBeVisible();
    await expect(this.descriptionInput).toBeVisible();
    await expect(this.contentEditor).toBeVisible();
  }
}

