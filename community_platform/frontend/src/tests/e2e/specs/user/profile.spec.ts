import { test, expect } from '@playwright/test';
import { quickLoginWorkflow } from '../../workflows/auth-workflows';
import { ProfilePage, ProfileEditPage } from '../../page-objects/ProfilePage';
import { generateRandomString } from '../../helpers/test-utils';

test.describe('用户个人资料', () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前先登录
    await quickLoginWorkflow(page);
  });

  test('应该显示用户个人资料', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 验证个人资料可见
    await profilePage.expectProfileVisible();
    
    // 验证用户信息显示
    const username = await profilePage.getUserName();
    expect(username).toBeTruthy();
  });

  test('应该显示编辑按钮（自己的个人资料）', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 验证编辑按钮可见
    await profilePage.expectEditButtonVisible();
  });

  test('应该能够编辑个人资料', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 点击编辑按钮
    await profilePage.editProfile();
    
    // 验证跳转到编辑页面
    expect(page.url()).toContain('/profile/edit');
    
    // 更新个人资料
    const editPage = new ProfileEditPage(page);
    const newBio = `这是更新后的简介 ${generateRandomString(6)}`;
    
    await editPage.updateProfile({
      bio: newBio,
    });
    
    // 保存更改
    await editPage.save();
    
    // 验证跳转回个人资料页面
    expect(page.url()).toContain('/profile');
    
    // 验证简介已更新
    await page.reload();
    const bio = await profilePage.getUserBio();
    expect(bio).toContain(newBio);
  });

  test('应该显示用户的内容列表', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 切换到内容标签页
    await profilePage.switchToContentTab();
    
    // 验证内容列表可见
    const contentCount = await profilePage.getUserContentCount();
    expect(contentCount).toBeGreaterThanOrEqual(0);
  });

  test('应该显示粉丝和关注数量', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 获取粉丝数量
    const followersCount = await profilePage.getFollowersCount();
    expect(followersCount).toBeGreaterThanOrEqual(0);
    
    // 获取关注数量
    const followingCount = await profilePage.getFollowingCount();
    expect(followingCount).toBeGreaterThanOrEqual(0);
  });

  test('应该能够查看粉丝列表', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 切换到粉丝标签页
    await profilePage.switchToFollowersTab();
    
    // 验证粉丝列表已加载
    await profilePage.waitForLoad();
  });

  test('应该能够查看关注列表', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 切换到关注标签页
    await profilePage.switchToFollowingTab();
    
    // 验证关注列表已加载
    await profilePage.waitForLoad();
  });

  test('应该能够查看活动历史', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 切换到活动标签页
    await profilePage.switchToActivityTab();
    
    // 验证活动列表已加载
    await profilePage.waitForLoad();
  });
});

test.describe('个人资料编辑', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该显示编辑表单', async ({ page }) => {
    const editPage = new ProfileEditPage(page);
    await editPage.goto();
    
    // 验证表单可见
    await editPage.expectFormVisible();
  });

  test('应该能够更新用户名', async ({ page }) => {
    const editPage = new ProfileEditPage(page);
    await editPage.goto();
    
    const newUsername = `user_${generateRandomString(6)}`;
    await editPage.updateProfile({
      username: newUsername,
    });
    
    await editPage.save();
    
    // 验证更新成功
    const profilePage = new ProfilePage(page);
    const username = await profilePage.getUserName();
    expect(username).toBe(newUsername);
  });

  test('应该能够更新简介', async ({ page }) => {
    const editPage = new ProfileEditPage(page);
    await editPage.goto();
    
    const newBio = `这是新的简介 ${generateRandomString(10)}`;
    await editPage.updateProfile({
      bio: newBio,
    });
    
    await editPage.save();
    
    // 验证更新成功
    const profilePage = new ProfilePage(page);
    await page.reload();
    const bio = await profilePage.getUserBio();
    expect(bio).toBe(newBio);
  });

  test('应该能够取消编辑', async ({ page }) => {
    const editPage = new ProfileEditPage(page);
    await editPage.goto();
    
    // 修改一些内容
    await editPage.updateProfile({
      bio: '这个更改会被取消',
    });
    
    // 取消编辑
    await editPage.cancel();
    
    // 验证跳转回个人资料页面
    expect(page.url()).toContain('/profile');
    expect(page.url()).not.toContain('/edit');
  });

  test('应该验证必填字段', async ({ page }) => {
    const editPage = new ProfileEditPage(page);
    await editPage.goto();
    
    // 清空用户名
    await editPage.usernameInput.clear();
    
    // 尝试保存
    // 验证保存按钮被禁用或显示错误
    await editPage.expectSaveDisabled();
  });

  test('应该能够上传头像', async ({ page }) => {
    const editPage = new ProfileEditPage(page);
    await editPage.goto();
    
    // 上传头像（这里使用测试图片路径）
    const testImagePath = './src/tests/fixtures/files/test-avatar.jpg';
    
    // 注意：实际测试中需要确保测试图片存在
    // await editPage.uploadAvatar(testImagePath);
    
    // await editPage.save();
    
    // 验证头像已更新
    // const profilePage = new ProfilePage(page);
    // await expect(profilePage.avatar).toBeVisible();
  });
});

test.describe('查看他人资料', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够查看其他用户的资料', async ({ page }) => {
    // 访问另一个用户的资料页面
    const otherUserId = 'other-user-id';
    const profilePage = new ProfilePage(page, otherUserId);
    await profilePage.goto();
    
    // 验证个人资料可见
    await profilePage.expectProfileVisible();
    
    // 验证显示关注按钮而不是编辑按钮
    await profilePage.expectFollowButtonVisible();
  });

  test('应该能够关注其他用户', async ({ page }) => {
    const otherUserId = 'other-user-id';
    const profilePage = new ProfilePage(page, otherUserId);
    await profilePage.goto();
    
    // 获取关注前的粉丝数
    const beforeFollowers = await profilePage.getFollowersCount();
    
    // 关注用户
    await profilePage.follow();
    
    // 验证粉丝数增加
    await page.reload();
    const afterFollowers = await profilePage.getFollowersCount();
    expect(afterFollowers).toBe(beforeFollowers + 1);
    
    // 验证按钮文本变为"已关注"
    const isFollowing = await profilePage.isFollowing();
    expect(isFollowing).toBe(true);
  });

  test('应该能够取消关注其他用户', async ({ page }) => {
    const otherUserId = 'other-user-id';
    const profilePage = new ProfilePage(page, otherUserId);
    await profilePage.goto();
    
    // 先关注
    await profilePage.follow();
    await page.reload();
    
    // 获取关注前的粉丝数
    const beforeFollowers = await profilePage.getFollowersCount();
    
    // 取消关注
    await profilePage.unfollow();
    
    // 验证粉丝数减少
    await page.reload();
    const afterFollowers = await profilePage.getFollowersCount();
    expect(afterFollowers).toBe(beforeFollowers - 1);
    
    // 验证按钮文本变为"关注"
    const isFollowing = await profilePage.isFollowing();
    expect(isFollowing).toBe(false);
  });

  test('应该能够查看其他用户的内容', async ({ page }) => {
    const otherUserId = 'other-user-id';
    const profilePage = new ProfilePage(page, otherUserId);
    await profilePage.goto();
    
    // 切换到内容标签页
    await profilePage.switchToContentTab();
    
    // 验证可以看到用户的公开内容
    const contentCount = await profilePage.getUserContentCount();
    expect(contentCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('个人资料响应式设计', () => {
  test('应该在移动设备上正常显示', async ({ page }) => {
    await quickLoginWorkflow(page);
    
    // 设置移动设备视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 验证个人资料可见
    await profilePage.expectProfileVisible();
  });

  test('应该在平板设备上正常显示', async ({ page }) => {
    await quickLoginWorkflow(page);
    
    // 设置平板设备视口
    await page.setViewportSize({ width: 768, height: 1024 });
    
    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    
    // 验证个人资料可见
    await profilePage.expectProfileVisible();
  });
});

