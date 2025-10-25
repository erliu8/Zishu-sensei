import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TEST_IDS } from '../../test-ids';

/**
 * Dashboard 页面对象
 */
export class DashboardPage extends BasePage {
  // 页面元素
  readonly dashboard: Locator;
  readonly welcomeMessage: Locator;
  readonly userAvatar: Locator;
  readonly userName: Locator;
  readonly logoutButton: Locator;
  readonly sidebar: Locator;
  readonly mainContent: Locator;
  readonly notifications: Locator;
  readonly searchInput: Locator;
  readonly userMenu: Locator;

  // Dashboard 统计卡片
  readonly progressCard: Locator;
  readonly streakCard: Locator;
  readonly pointsCard: Locator;
  readonly levelCard: Locator;

  // 导航菜单项
  readonly homeMenuItem: Locator;
  readonly learningMenuItem: Locator;
  readonly contentMenuItem: Locator;
  readonly profileMenuItem: Locator;
  readonly settingsMenuItem: Locator;

  constructor(page: Page) {
    super(page, '/dashboard');

    // 初始化页面元素
    this.dashboard = page.getByTestId(TEST_IDS.LEARNING.DASHBOARD);
    this.welcomeMessage = page.locator('[data-testid="welcome-message"]');
    this.userAvatar = page.getByTestId(TEST_IDS.USER.AVATAR);
    this.userName = page.getByTestId(TEST_IDS.USER.NAME);
    this.logoutButton = page.getByTestId(TEST_IDS.AUTH.LOGOUT_BUTTON);
    this.sidebar = page.getByTestId(TEST_IDS.NAV.SIDEBAR);
    this.mainContent = page.locator('main');
    this.notifications = page.getByTestId(TEST_IDS.NAV.NOTIFICATIONS);
    this.searchInput = page.getByTestId(TEST_IDS.SEARCH.INPUT);
    this.userMenu = page.getByTestId(TEST_IDS.NAV.USER_MENU);

    // 统计卡片
    this.progressCard = page.getByTestId(TEST_IDS.LEARNING.PROGRESS_BAR);
    this.streakCard = page.getByTestId(TEST_IDS.LEARNING.STREAK);
    this.pointsCard = page.getByTestId(TEST_IDS.LEARNING.POINTS);
    this.levelCard = page.getByTestId(TEST_IDS.LEARNING.LEVEL);

    // 导航菜单
    this.homeMenuItem = page.getByRole('link', { name: /首页|home/i });
    this.learningMenuItem = page.getByRole('link', { name: /学习|learning/i });
    this.contentMenuItem = page.getByRole('link', { name: /内容|content/i });
    this.profileMenuItem = page.getByRole('link', { name: /个人资料|profile/i });
    this.settingsMenuItem = page.getByRole('link', { name: /设置|settings/i });
  }

  /**
   * 访问 Dashboard 页面
   */
  async goto() {
    await super.goto();
    await expect(this.dashboard).toBeVisible();
  }

  /**
   * 验证用户已登录
   */
  async expectUserLoggedIn(username?: string) {
    await expect(this.userAvatar).toBeVisible();
    await expect(this.userName).toBeVisible();
    
    if (username) {
      await expect(this.userName).toHaveText(username);
    }
  }

  /**
   * 登出
   */
  async logout() {
    // 点击用户菜单
    await this.userMenu.click();
    // 点击登出按钮
    await this.logoutButton.click();
    // 等待跳转到登录页面
    await this.page.waitForURL('**/login', { timeout: 10000 });
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
   * 打开通知
   */
  async openNotifications() {
    await this.notifications.click();
    const notificationPanel = this.page.locator('[data-testid="notification-panel"]');
    await expect(notificationPanel).toBeVisible();
  }

  /**
   * 导航到学习页面
   */
  async goToLearning() {
    await this.learningMenuItem.click();
    await this.page.waitForURL('**/learning');
  }

  /**
   * 导航到内容页面
   */
  async goToContent() {
    await this.contentMenuItem.click();
    await this.page.waitForURL('**/content');
  }

  /**
   * 导航到个人资料页面
   */
  async goToProfile() {
    await this.profileMenuItem.click();
    await this.page.waitForURL('**/profile');
  }

  /**
   * 导航到设置页面
   */
  async goToSettings() {
    await this.settingsMenuItem.click();
    await this.page.waitForURL('**/settings');
  }

  /**
   * 获取学习进度
   */
  async getLearningProgress(): Promise<string> {
    return await this.progressCard.textContent() || '';
  }

  /**
   * 获取连续学习天数
   */
  async getStreak(): Promise<number> {
    const text = await this.streakCard.textContent() || '0';
    return parseInt(text.match(/\d+/)?.[0] || '0');
  }

  /**
   * 获取积分
   */
  async getPoints(): Promise<number> {
    const text = await this.pointsCard.textContent() || '0';
    return parseInt(text.match(/\d+/)?.[0] || '0');
  }

  /**
   * 获取等级
   */
  async getLevel(): Promise<number> {
    const text = await this.levelCard.textContent() || '1';
    return parseInt(text.match(/\d+/)?.[0] || '1');
  }

  /**
   * 验证统计卡片可见
   */
  async expectStatsVisible() {
    await expect(this.progressCard).toBeVisible();
    await expect(this.streakCard).toBeVisible();
    await expect(this.pointsCard).toBeVisible();
    await expect(this.levelCard).toBeVisible();
  }

  /**
   * 验证侧边栏可见
   */
  async expectSidebarVisible() {
    await expect(this.sidebar).toBeVisible();
  }

  /**
   * 验证欢迎消息
   */
  async expectWelcomeMessage(username?: string) {
    await expect(this.welcomeMessage).toBeVisible();
    
    if (username) {
      await expect(this.welcomeMessage).toContainText(username);
    }
  }

  /**
   * 切换侧边栏
   */
  async toggleSidebar() {
    const toggleButton = this.page.locator('[data-testid="sidebar-toggle"]');
    await toggleButton.click();
  }

  /**
   * 验证侧边栏是否展开
   */
  async isSidebarExpanded(): Promise<boolean> {
    const expanded = await this.sidebar.getAttribute('data-expanded');
    return expanded === 'true';
  }
}

