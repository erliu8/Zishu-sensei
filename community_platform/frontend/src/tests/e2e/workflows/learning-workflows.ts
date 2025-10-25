import { Page } from '@playwright/test';
import { DashboardPage } from '../page-objects/DashboardPage';

/**
 * 学习相关工作流
 */

/**
 * 查看学习进度流程
 */
export async function viewLearningProgressWorkflow(page: Page) {
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.goto();
  
  // 验证统计卡片可见
  await dashboardPage.expectStatsVisible();
  
  // 获取学习数据
  const progress = await dashboardPage.getLearningProgress();
  const streak = await dashboardPage.getStreak();
  const points = await dashboardPage.getPoints();
  const level = await dashboardPage.getLevel();
  
  return {
    progress,
    streak,
    points,
    level,
  };
}

/**
 * 开始学习会话流程
 */
export async function startLearningSessionWorkflow(page: Page) {
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.goToLearning();
  
  // 等待学习页面加载
  await page.waitForURL('**/learning');
  
  // 点击开始学习按钮
  const startButton = page.getByRole('button', { name: /开始学习|start learning/i });
  await startButton.click();
  
  return true;
}

/**
 * 完成学习任务流程
 */
export async function completeLearningTaskWorkflow(page: Page, taskName: string) {
  // 查找学习任务
  const task = page.locator(`[data-testid="learning-task"]`, {
    has: page.getByText(taskName),
  });
  
  // 点击任务
  await task.click();
  
  // 完成任务
  const completeButton = page.getByRole('button', { name: /完成|complete/i });
  await completeButton.click();
  
  // 等待任务完成
  await page.waitForSelector('[data-testid="task-completed"]', { timeout: 5000 });
  
  return true;
}

/**
 * 学习进度追踪流程
 */
export async function trackLearningProgressWorkflow(page: Page) {
  // 记录开始时的数据
  const beforeData = await viewLearningProgressWorkflow(page);
  
  // 进行学习活动
  await startLearningSessionWorkflow(page);
  
  // 返回 Dashboard
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.goto();
  
  // 获取更新后的数据
  const afterData = await viewLearningProgressWorkflow(page);
  
  return {
    before: beforeData,
    after: afterData,
    improved: afterData.points > beforeData.points,
  };
}

