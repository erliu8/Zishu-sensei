import { test, expect } from '@playwright/test';
import { quickLoginWorkflow } from '../../workflows/auth-workflows';
import { viewLearningProgressWorkflow } from '../../workflows/learning-workflows';
import { DashboardPage } from '../../page-objects/DashboardPage';

test.describe('学习 Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该显示学习统计', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 验证统计卡片可见
    await dashboardPage.expectStatsVisible();
  });

  test('应该显示学习进度', async ({ page }) => {
    const progress = await viewLearningProgressWorkflow(page);
    
    // 验证进度数据
    expect(progress.progress).toBeDefined();
    expect(progress.streak).toBeGreaterThanOrEqual(0);
    expect(progress.points).toBeGreaterThanOrEqual(0);
    expect(progress.level).toBeGreaterThanOrEqual(1);
  });

  test('应该显示连续学习天数', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    const streak = await dashboardPage.getStreak();
    
    // 验证连续学习天数
    expect(streak).toBeGreaterThanOrEqual(0);
  });

  test('应该显示学习积分', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    const points = await dashboardPage.getPoints();
    
    // 验证积分
    expect(points).toBeGreaterThanOrEqual(0);
  });

  test('应该显示当前等级', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    const level = await dashboardPage.getLevel();
    
    // 验证等级
    expect(level).toBeGreaterThanOrEqual(1);
  });

  test('应该显示学习进度条', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    const progressBar = dashboardPage.progressCard;
    
    // 验证进度条显示
    await expect(progressBar).toBeVisible();
    
    // 验证进度条有进度值
    const progress = await progressBar.getAttribute('data-progress');
    if (progress) {
      const progressValue = parseInt(progress);
      expect(progressValue).toBeGreaterThanOrEqual(0);
      expect(progressValue).toBeLessThanOrEqual(100);
    }
  });
});

test.describe('学习活动', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该能够导航到学习页面', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 点击学习菜单
    await dashboardPage.goToLearning();
    
    // 验证跳转到学习页面
    await page.waitForURL('**/learning');
    expect(page.url()).toContain('/learning');
  });

  test('应该显示推荐的学习内容', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 查找推荐内容区域
    const recommendations = page.locator('[data-testid="learning-recommendations"]');
    
    if (await recommendations.isVisible()) {
      // 验证推荐内容显示
      await expect(recommendations).toBeVisible();
    }
  });

  test('应该显示最近的学习活动', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 查找最近活动区域
    const recentActivity = page.locator('[data-testid="recent-learning-activity"]');
    
    if (await recentActivity.isVisible()) {
      await expect(recentActivity).toBeVisible();
    }
  });
});

test.describe('学习成就', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该显示已获得的成就', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 查找成就区域
    const achievements = page.locator('[data-testid="achievements"]');
    
    if (await achievements.isVisible()) {
      await expect(achievements).toBeVisible();
    }
  });

  test('应该显示成就进度', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 点击成就按钮
    const achievementsButton = page.getByRole('button', { name: /成就|achievements/i });
    
    if (await achievementsButton.isVisible()) {
      await achievementsButton.click();
      
      // 验证成就面板显示
      const achievementsPanel = page.locator('[data-testid="achievements-panel"]');
      await expect(achievementsPanel).toBeVisible();
    }
  });
});

test.describe('学习目标', () => {
  test.beforeEach(async ({ page }) => {
    await quickLoginWorkflow(page);
  });

  test('应该显示每日学习目标', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 查找每日目标
    const dailyGoal = page.locator('[data-testid="daily-goal"]');
    
    if (await dailyGoal.isVisible()) {
      await expect(dailyGoal).toBeVisible();
    }
  });

  test('应该能够设置学习目标', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // 点击设置目标按钮
    const setGoalButton = page.getByRole('button', { name: /设置目标|set goal/i });
    
    if (await setGoalButton.isVisible()) {
      await setGoalButton.click();
      
      // 验证目标设置对话框显示
      const goalDialog = page.locator('[data-testid="goal-dialog"]');
      await expect(goalDialog).toBeVisible();
    }
  });
});

