import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TEST_IDS } from '../../test-ids';

/**
 * 个人资料页面对象
 */
export class ProfilePage extends BasePage {
  // 页面元素
  readonly profileCard: Locator;
  readonly avatar: Locator;
  readonly userName: Locator;
  readonly userEmail: Locator;
  readonly userBio: Locator;
  readonly editButton: Locator;
  readonly followButton: Locator;
  readonly followersCount: Locator;
  readonly followingCount: Locator;
  readonly contentTab: Locator;
  readonly activityTab: Locator;
  readonly followersTab: Locator;
  readonly followingTab: Locator;
  readonly userContents: Locator;

  constructor(page: Page, userId?: string) {
    super(page, userId ? `/profile/${userId}` : '/profile');

    // 初始化页面元素
    this.profileCard = page.getByTestId(TEST_IDS.USER.PROFILE_CARD);
    this.avatar = page.getByTestId(TEST_IDS.USER.AVATAR);
    this.userName = page.getByTestId(TEST_IDS.USER.NAME);
    this.userEmail = page.getByTestId(TEST_IDS.USER.EMAIL);
    this.userBio = page.getByTestId(TEST_IDS.USER.BIO);
    this.editButton = page.getByTestId(TEST_IDS.USER.EDIT_BUTTON);
    this.followButton = page.getByTestId(TEST_IDS.USER.FOLLOW_BUTTON);
    this.followersCount = page.getByTestId(TEST_IDS.USER.FOLLOWERS_COUNT);
    this.followingCount = page.getByTestId(TEST_IDS.USER.FOLLOWING_COUNT);
    
    // 标签页
    this.contentTab = page.getByRole('tab', { name: /内容|content/i });
    this.activityTab = page.getByRole('tab', { name: /活动|activity/i });
    this.followersTab = page.getByRole('tab', { name: /粉丝|followers/i });
    this.followingTab = page.getByRole('tab', { name: /关注|following/i });
    
    this.userContents = page.getByTestId(TEST_IDS.CONTENT.CARD);
  }

  /**
   * 访问个人资料页面
   */
  async goto() {
    await super.goto();
    await expect(this.profileCard).toBeVisible();
  }

  /**
   * 获取用户名
   */
  async getUserName(): Promise<string> {
    return await this.userName.textContent() || '';
  }

  /**
   * 获取用户邮箱
   */
  async getUserEmail(): Promise<string> {
    return await this.userEmail.textContent() || '';
  }

  /**
   * 获取用户简介
   */
  async getUserBio(): Promise<string> {
    return await this.userBio.textContent() || '';
  }

  /**
   * 编辑个人资料
   */
  async editProfile() {
    await this.editButton.click();
    await this.page.waitForURL('**/profile/edit');
  }

  /**
   * 关注用户
   */
  async follow() {
    await this.followButton.click();
    await this.waitForLoadingToDisappear();
  }

  /**
   * 取消关注用户
   */
  async unfollow() {
    await this.followButton.click();
    await this.waitForLoadingToDisappear();
  }

  /**
   * 获取粉丝数量
   */
  async getFollowersCount(): Promise<number> {
    const text = await this.followersCount.textContent() || '0';
    return parseInt(text.match(/\d+/)?.[0] || '0');
  }

  /**
   * 获取关注数量
   */
  async getFollowingCount(): Promise<number> {
    const text = await this.followingCount.textContent() || '0';
    return parseInt(text.match(/\d+/)?.[0] || '0');
  }

  /**
   * 切换到内容标签页
   */
  async switchToContentTab() {
    await this.contentTab.click();
    await this.waitForLoad();
  }

  /**
   * 切换到活动标签页
   */
  async switchToActivityTab() {
    await this.activityTab.click();
    await this.waitForLoad();
  }

  /**
   * 切换到粉丝标签页
   */
  async switchToFollowersTab() {
    await this.followersTab.click();
    await this.waitForLoad();
  }

  /**
   * 切换到关注标签页
   */
  async switchToFollowingTab() {
    await this.followingTab.click();
    await this.waitForLoad();
  }

  /**
   * 获取用户内容数量
   */
  async getUserContentCount(): Promise<number> {
    return await this.userContents.count();
  }

  /**
   * 验证个人资料可见
   */
  async expectProfileVisible() {
    await expect(this.profileCard).toBeVisible();
    await expect(this.avatar).toBeVisible();
    await expect(this.userName).toBeVisible();
  }

  /**
   * 验证编辑按钮可见（自己的个人资料）
   */
  async expectEditButtonVisible() {
    await expect(this.editButton).toBeVisible();
  }

  /**
   * 验证关注按钮可见（他人的个人资料）
   */
  async expectFollowButtonVisible() {
    await expect(this.followButton).toBeVisible();
  }

  /**
   * 验证是否已关注
   */
  async isFollowing(): Promise<boolean> {
    const text = await this.followButton.textContent() || '';
    return text.includes('已关注') || text.includes('Following');
  }
}

/**
 * 个人资料编辑页面对象
 */
export class ProfileEditPage extends BasePage {
  // 页面元素
  readonly avatarUpload: Locator;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly bioInput: Locator;
  readonly locationInput: Locator;
  readonly websiteInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, '/profile/edit');

    // 初始化页面元素
    this.avatarUpload = page.locator('input[type="file"][name="avatar"]');
    this.usernameInput = page.locator('input[name="username"]');
    this.emailInput = page.locator('input[name="email"]');
    this.bioInput = page.locator('textarea[name="bio"]');
    this.locationInput = page.locator('input[name="location"]');
    this.websiteInput = page.locator('input[name="website"]');
    this.saveButton = page.getByRole('button', { name: /保存|save/i });
    this.cancelButton = page.getByRole('button', { name: /取消|cancel/i });
  }

  /**
   * 访问编辑页面
   */
  async goto() {
    await super.goto();
    await this.waitForLoad();
  }

  /**
   * 更新个人资料
   */
  async updateProfile(profile: {
    username?: string;
    email?: string;
    bio?: string;
    location?: string;
    website?: string;
  }) {
    if (profile.username) {
      await this.usernameInput.fill(profile.username);
    }
    if (profile.email) {
      await this.emailInput.fill(profile.email);
    }
    if (profile.bio) {
      await this.bioInput.fill(profile.bio);
    }
    if (profile.location) {
      await this.locationInput.fill(profile.location);
    }
    if (profile.website) {
      await this.websiteInput.fill(profile.website);
    }
  }

  /**
   * 上传头像
   */
  async uploadAvatar(filePath: string) {
    await this.avatarUpload.setInputFiles(filePath);
  }

  /**
   * 保存更改
   */
  async save() {
    await this.saveButton.click();
    await this.waitForLoadingToDisappear();
    await this.page.waitForURL('**/profile');
  }

  /**
   * 取消编辑
   */
  async cancel() {
    await this.cancelButton.click();
    await this.page.waitForURL('**/profile');
  }

  /**
   * 验证表单可见
   */
  async expectFormVisible() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.bioInput).toBeVisible();
  }

  /**
   * 验证保存按钮是否禁用
   */
  async expectSaveDisabled() {
    await expect(this.saveButton).toBeDisabled();
  }

  /**
   * 验证保存按钮是否启用
   */
  async expectSaveEnabled() {
    await expect(this.saveButton).toBeEnabled();
  }
}

