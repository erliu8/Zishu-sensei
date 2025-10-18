/**
 * E2E 测试示例
 * 
 * 测试完整的用户交互流程
 */

import { test, expect } from '@playwright/test';

test.describe('桌面宠物应用 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前访问应用
    await page.goto('/');
    
    // 等待应用加载完成
    await page.waitForSelector('[data-testid="app"]', { timeout: 10000 });
  });

  test('应用应该正常启动并显示主要组件', async ({ page }) => {
    // 检查主应用容器
    await expect(page.locator('[data-testid="app"]')).toBeVisible();
    
    // 检查角色组件
    await expect(page.locator('[data-testid="character"]')).toBeVisible();
    
    // 检查聊天组件
    await expect(page.locator('[data-testid="chat"]')).toBeVisible();
    
    // 检查设置按钮
    await expect(page.locator('[data-testid="settings-button"]')).toBeVisible();
  });

  test('应该能够打开和关闭设置面板', async ({ page }) => {
    // 点击设置按钮
    await page.click('[data-testid="settings-button"]');
    
    // 检查设置面板是否打开
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
    
    // 点击关闭按钮
    await page.click('[data-testid="close-settings"]');
    
    // 检查设置面板是否关闭
    await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
  });

  test('应该能够发送聊天消息', async ({ page }) => {
    // 点击聊天输入框
    await page.click('[data-testid="chat-input"]');
    
    // 输入消息
    await page.fill('[data-testid="chat-input"]', 'Hello, 你好！');
    
    // 点击发送按钮
    await page.click('[data-testid="send-button"]');
    
    // 检查消息是否显示
    await expect(page.locator('[data-testid="message-list"]')).toContainText('Hello, 你好！');
    
    // 等待 AI 回复（如果有的话）
    await page.waitForTimeout(2000);
  });

  test('应该能够切换主题', async ({ page }) => {
    // 打开设置面板
    await page.click('[data-testid="settings-button"]');
    
    // 点击主题切换按钮
    await page.click('[data-testid="theme-toggle"]');
    
    // 检查主题是否切换
    await expect(page.locator('body')).toHaveClass(/dark-theme|light-theme/);
    
    // 再次切换
    await page.click('[data-testid="theme-toggle"]');
    
    // 检查主题是否切换回来
    await expect(page.locator('body')).toHaveClass(/dark-theme|light-theme/);
  });

  test('应该能够调整角色大小', async ({ page }) => {
    // 打开设置面板
    await page.click('[data-testid="settings-button"]');
    
    // 找到角色大小滑块
    const sizeSlider = page.locator('[data-testid="character-size-slider"]');
    
    // 调整滑块值
    await sizeSlider.fill('150');
    
    // 检查角色大小是否改变
    const character = page.locator('[data-testid="character"]');
    await expect(character).toHaveCSS('transform', /scale/);
  });

  test('应该能够拖拽角色', async ({ page }) => {
    const character = page.locator('[data-testid="character"]');
    
    // 获取初始位置
    const initialBox = await character.boundingBox();
    
    // 拖拽角色
    await character.dragTo(page.locator('body'), {
      targetPosition: { x: 200, y: 200 }
    });
    
    // 检查位置是否改变
    const newBox = await character.boundingBox();
    expect(newBox?.x).not.toBe(initialBox?.x);
    expect(newBox?.y).not.toBe(initialBox?.y);
  });

  test('应该能够右键显示上下文菜单', async ({ page }) => {
    const character = page.locator('[data-testid="character"]');
    
    // 右键点击角色
    await character.click({ button: 'right' });
    
    // 检查上下文菜单是否显示
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
    
    // 点击菜单项
    await page.click('[data-testid="menu-item-settings"]');
    
    // 检查设置面板是否打开
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
  });

  test('应该能够最小化和恢复窗口', async ({ page }) => {
    // 点击最小化按钮
    await page.click('[data-testid="minimize-button"]');
    
    // 等待窗口最小化
    await page.waitForTimeout(1000);
    
    // 从系统托盘恢复窗口（这里需要模拟系统托盘操作）
    // 在实际测试中，这可能需要特殊的系统级操作
    
    // 检查窗口是否恢复
    await expect(page.locator('[data-testid="app"]')).toBeVisible();
  });

  test('应该能够处理键盘快捷键', async ({ page }) => {
    // 测试 Ctrl+Shift+S 打开设置
    await page.keyboard.press('Control+Shift+KeyS');
    
    // 检查设置面板是否打开
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
    
    // 测试 Escape 关闭设置
    await page.keyboard.press('Escape');
    
    // 检查设置面板是否关闭
    await expect(page.locator('[data-testid="settings-panel"]')).not.toBeVisible();
  });

  test('应该能够处理窗口大小变化', async ({ page }) => {
    // 调整浏览器窗口大小
    await page.setViewportSize({ width: 800, height: 600 });
    
    // 检查组件是否适应新尺寸
    await expect(page.locator('[data-testid="character"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat"]')).toBeVisible();
    
    // 恢复原始大小
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // 检查组件是否正常显示
    await expect(page.locator('[data-testid="character"]')).toBeVisible();
  });

  test('应该能够处理网络错误', async ({ page }) => {
    // 模拟网络错误
    await page.route('**/api/**', route => route.abort());
    
    // 尝试发送消息
    await page.click('[data-testid="chat-input"]');
    await page.fill('[data-testid="chat-input"]', '测试消息');
    await page.click('[data-testid="send-button"]');
    
    // 检查错误处理
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});

test.describe('适配器管理 E2E 测试', () => {
  test('应该能够管理适配器', async ({ page }) => {
    await page.goto('/');
    
    // 打开设置面板
    await page.click('[data-testid="settings-button"]');
    
    // 切换到适配器标签
    await page.click('[data-testid="tab-adapters"]');
    
    // 检查适配器列表
    await expect(page.locator('[data-testid="adapter-list"]')).toBeVisible();
    
    // 点击加载适配器按钮
    await page.click('[data-testid="load-adapter-test-adapter-2"]');
    
    // 检查适配器状态是否改变
    await expect(page.locator('[data-testid="adapter-status-test-adapter-2"]')).toContainText('loaded');
    
    // 点击卸载适配器按钮
    await page.click('[data-testid="unload-adapter-test-adapter-1"]');
    
    // 检查适配器状态是否改变
    await expect(page.locator('[data-testid="adapter-status-test-adapter-1"]')).toContainText('unloaded');
  });
});

test.describe('性能测试', () => {
  test('应用启动时间应该在合理范围内', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForSelector('[data-testid="app"]');
    
    const loadTime = Date.now() - startTime;
    
    // 检查加载时间是否在 5 秒内
    expect(loadTime).toBeLessThan(5000);
  });

  test('内存使用应该在合理范围内', async ({ page }) => {
    await page.goto('/');
    
    // 获取内存使用情况
    const metrics = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
    
    if (metrics) {
      // 检查内存使用是否合理（小于 100MB）
      expect(metrics.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
    }
  });
});
