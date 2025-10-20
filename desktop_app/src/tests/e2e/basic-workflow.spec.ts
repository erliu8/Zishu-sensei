/**
 * E2E 测试 - 基础工作流
 * 测试应用启动、聊天交互、设置更改等核心功能
 */

import { test, expect, type Page } from '@playwright/test';
import {
  E2E_SELECTORS,
  E2E_TIMEOUTS,
  waitForAppReady,
  waitForElement,
  sendChatMessage,
  waitForAIResponse,
  getLastMessage,
  getUserMessages,
  getAIMessages,
  openSettings,
  closeSettings,
  switchTheme,
  takeScreenshot,
  hasErrorMessage,
  hasSuccessMessage,
  clearChatHistory,
  pressShortcut,
  mockTauriCommand,
  resetMocks,
} from './setup';

test.describe('基础工作流 E2E 测试', () => {
  let page: Page;
  
  test.beforeEach(async ({ page: p }) => {
    page = p;
    
    // 访问应用
    await page.goto('/');
    
    // 等待应用完全加载
    await waitForAppReady(page);
  });
  
  test.afterEach(async () => {
    // 截图记录最终状态
    const testInfo = test.info();
    if (testInfo.status !== 'passed') {
      await takeScreenshot(page, `${testInfo.title}-failure`);
    }
    
    // 重置所有 Mock
    await resetMocks(page);
  });
  
  test.describe('应用启动', () => {
    test('应该显示欢迎界面', async () => {
      // 验证主布局已渲染
      await expect(page.locator(E2E_SELECTORS.MAIN_LAYOUT)).toBeVisible();
      
      // 验证侧边栏已渲染
      await expect(page.locator(E2E_SELECTORS.SIDEBAR)).toBeVisible();
      
      // 验证内容区域已渲染
      await expect(page.locator(E2E_SELECTORS.CONTENT_AREA)).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'app-launched');
    });
    
    test('应该加载默认角色', async () => {
      // Mock Tauri 命令
      await mockTauriCommand(page, 'get_character_config', {
        current_character: 'hiyori',
        characters: [
          { id: 'hiyori', name: 'Hiyori', model_path: '/models/hiyori' },
        ],
      });
      
      // 等待角色查看器出现
      await waitForElement(
        page,
        E2E_SELECTORS.CHARACTER_VIEWER,
        E2E_TIMEOUTS.MODEL_LOAD
      );
      
      // 验证角色已加载
      await expect(page.locator(E2E_SELECTORS.CHARACTER_VIEWER)).toBeVisible();
      
      // 验证没有加载指示器
      await expect(page.locator(E2E_SELECTORS.CHARACTER_LOADING)).not.toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'character-loaded');
    });
    
    test('应该在5秒内完成启动', async () => {
      const startTime = Date.now();
      
      // 等待应用完全加载
      await waitForAppReady(page);
      
      const loadTime = Date.now() - startTime;
      
      // 验证启动时间小于5秒
      expect(loadTime).toBeLessThan(5000);
      
      console.log(`✅ 应用启动时间: ${loadTime}ms`);
    });
    
    test('应该正确设置应用标题', async () => {
      // 验证页面标题
      await expect(page).toHaveTitle(/紫书先生|Zishu Sensei/i);
    });
    
    test('不应该显示错误消息', async () => {
      // 验证没有错误提示
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(false);
    });
  });
  
  test.describe('基础对话', () => {
    test('应该发送消息并收到回复', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '你好！我是紫书先生，很高兴认识你！',
        timestamp: Date.now(),
      });
      
      // 发送消息
      const userMessage = '你好，紫书先生！';
      await sendChatMessage(page, userMessage);
      
      // 验证用户消息已显示
      const userMessages = await getUserMessages(page);
      expect(userMessages).toContain(userMessage);
      
      // 等待 AI 回复
      await waitForAIResponse(page);
      
      // 验证 AI 回复已显示
      const aiMessages = await getAIMessages(page);
      expect(aiMessages.length).toBeGreaterThan(0);
      expect(aiMessages[aiMessages.length - 1]).toContain('紫书先生');
      
      // 截图记录
      await takeScreenshot(page, 'chat-reply-received');
    });
    
    test('应该显示输入指示器', async () => {
      // Mock AI 响应（延迟）
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '这是一个延迟的回复',
        timestamp: Date.now(),
        delay: 2000,
      });
      
      // 发送消息
      await sendChatMessage(page, '测试输入指示器');
      
      // 验证输入指示器出现
      await waitForElement(page, E2E_SELECTORS.TYPING_INDICATOR, 2000);
      await expect(page.locator(E2E_SELECTORS.TYPING_INDICATOR)).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'typing-indicator');
      
      // 等待回复
      await waitForAIResponse(page);
      
      // 验证输入指示器消失
      await expect(page.locator(E2E_SELECTORS.TYPING_INDICATOR)).not.toBeVisible();
    });
    
    test('应该支持多轮对话', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '这是回复',
        timestamp: Date.now(),
      });
      
      // 第一轮对话
      await sendChatMessage(page, '第一条消息');
      await waitForAIResponse(page);
      
      // 第二轮对话
      await sendChatMessage(page, '第二条消息');
      await waitForAIResponse(page);
      
      // 第三轮对话
      await sendChatMessage(page, '第三条消息');
      await waitForAIResponse(page);
      
      // 验证消息数量（3条用户 + 3条AI = 6条）
      const allMessages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).all();
      expect(allMessages.length).toBe(6);
      
      // 截图记录
      await takeScreenshot(page, 'multiple-conversations');
    });
    
    test('应该自动滚动到最新消息', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '回复',
        timestamp: Date.now(),
      });
      
      // 发送多条消息填充列表
      for (let i = 1; i <= 10; i++) {
        await sendChatMessage(page, `消息 ${i}`);
        await page.waitForTimeout(300);
      }
      
      // 获取消息列表滚动位置
      const messageList = page.locator(E2E_SELECTORS.MESSAGE_LIST);
      const scrollTop = await messageList.evaluate((el) => el.scrollTop);
      const scrollHeight = await messageList.evaluate((el) => el.scrollHeight);
      const clientHeight = await messageList.evaluate((el) => el.clientHeight);
      
      // 验证已滚动到底部（允许10px误差）
      expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 10);
    });
    
    test('应该正确显示消息时间戳', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '回复',
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '测试时间戳');
      
      // 验证消息项包含时间戳
      const messageItem = page.locator(E2E_SELECTORS.MESSAGE_ITEM).last();
      const timestamp = messageItem.locator('[data-testid="message-timestamp"]');
      await expect(timestamp).toBeVisible();
      
      // 验证时间戳格式（例如：14:30）
      const timestampText = await timestamp.textContent();
      expect(timestampText).toMatch(/\d{1,2}:\d{2}/);
    });
    
    test('应该支持快捷键发送消息（Enter）', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '回复',
        timestamp: Date.now(),
      });
      
      // 聚焦输入框
      await page.click(E2E_SELECTORS.MESSAGE_INPUT);
      
      // 输入消息
      await page.type(E2E_SELECTORS.MESSAGE_INPUT, '快捷键测试');
      
      // 按 Enter 发送
      await page.keyboard.press('Enter');
      
      // 等待回复
      await waitForAIResponse(page);
      
      // 验证消息已发送
      const userMessages = await getUserMessages(page);
      expect(userMessages).toContain('快捷键测试');
    });
    
    test('应该支持 Shift+Enter 换行', async () => {
      // 聚焦输入框
      await page.click(E2E_SELECTORS.MESSAGE_INPUT);
      
      // 输入第一行
      await page.type(E2E_SELECTORS.MESSAGE_INPUT, '第一行');
      
      // Shift+Enter 换行
      await page.keyboard.press('Shift+Enter');
      
      // 输入第二行
      await page.type(E2E_SELECTORS.MESSAGE_INPUT, '第二行');
      
      // 验证输入框包含换行
      const inputValue = await page.inputValue(E2E_SELECTORS.MESSAGE_INPUT);
      expect(inputValue).toContain('\n');
      expect(inputValue).toBe('第一行\n第二行');
    });
    
    test('应该处理空消息', async () => {
      // 尝试发送空消息
      await page.click(E2E_SELECTORS.SEND_BUTTON);
      
      // 验证发送按钮被禁用或没有发送消息
      const messages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).all();
      expect(messages.length).toBe(0);
    });
    
    test('应该处理超长消息', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '收到你的长消息了',
        timestamp: Date.now(),
      });
      
      // 生成超长消息（1000字符）
      const longMessage = 'A'.repeat(1000);
      
      // 发送消息
      await sendChatMessage(page, longMessage);
      await waitForAIResponse(page);
      
      // 验证消息已显示
      const userMessages = await getUserMessages(page);
      expect(userMessages[0]).toContain('A'.repeat(50)); // 至少显示部分内容
    });
    
    test('应该清空聊天历史', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '回复',
        timestamp: Date.now(),
      });
      
      // 发送几条消息
      await sendChatMessage(page, '消息1');
      await page.waitForTimeout(300);
      await sendChatMessage(page, '消息2');
      await page.waitForTimeout(300);
      
      // 验证有消息
      let messages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).all();
      expect(messages.length).toBeGreaterThan(0);
      
      // 清空历史
      await clearChatHistory(page);
      
      // 验证消息已清空
      messages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).all();
      expect(messages.length).toBe(0);
    });
  });
  
  test.describe('设置更改', () => {
    test('应该打开设置面板', async () => {
      // 打开设置
      await openSettings(page);
      
      // 验证设置面板可见
      await expect(page.locator(E2E_SELECTORS.SETTINGS_PANEL)).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'settings-panel-opened');
    });
    
    test('应该关闭设置面板', async () => {
      // 打开设置
      await openSettings(page);
      
      // 关闭设置
      await closeSettings(page);
      
      // 验证设置面板不可见
      await expect(page.locator(E2E_SELECTORS.SETTINGS_PANEL)).not.toBeVisible();
    });
    
    test('应该切换到暗色主题', async () => {
      // Mock 主题配置
      await mockTauriCommand(page, 'update_theme_config', {
        theme: 'dark',
        success: true,
      });
      
      // 切换到暗色主题
      await switchTheme(page, 'dark');
      
      // 等待主题应用
      await page.waitForTimeout(500);
      
      // 验证 body 有暗色主题类名
      const bodyClass = await page.getAttribute('body', 'class');
      expect(bodyClass).toContain('dark');
      
      // 截图记录
      await takeScreenshot(page, 'dark-theme');
    });
    
    test('应该切换到亮色主题', async () => {
      // Mock 主题配置
      await mockTauriCommand(page, 'update_theme_config', {
        theme: 'light',
        success: true,
      });
      
      // 切换到亮色主题
      await switchTheme(page, 'light');
      
      // 等待主题应用
      await page.waitForTimeout(500);
      
      // 验证 body 有亮色主题类名
      const bodyClass = await page.getAttribute('body', 'class');
      expect(bodyClass).not.toContain('dark');
      
      // 截图记录
      await takeScreenshot(page, 'light-theme');
    });
    
    test('主题切换应该立即生效', async () => {
      // Mock 主题配置
      await mockTauriCommand(page, 'update_theme_config', {
        success: true,
      });
      
      // 获取当前背景色
      const initialBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      
      // 切换主题
      await switchTheme(page, 'dark');
      await page.waitForTimeout(300);
      
      // 获取切换后的背景色
      const newBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      
      // 验证背景色已改变
      expect(newBg).not.toBe(initialBg);
    });
    
    test('应该保存设置更改', async () => {
      // Mock 设置保存
      await mockTauriCommand(page, 'update_app_settings', {
        success: true,
      });
      
      // 打开设置
      await openSettings(page);
      
      // 更改某个设置
      await page.click('[data-testid="auto-start-checkbox"]');
      
      // 保存设置
      await page.click(E2E_SELECTORS.SAVE_SETTINGS_BUTTON);
      
      // 验证成功消息
      const hasSuccess = await hasSuccessMessage(page);
      expect(hasSuccess).toBe(true);
    });
    
    test('应该显示设置分类', async () => {
      // 打开设置
      await openSettings(page);
      
      // 验证设置分类标签
      const tabs = [
        '[data-testid="general-settings-tab"]',
        '[data-testid="character-settings-tab"]',
        '[data-testid="voice-settings-tab"]',
        '[data-testid="adapter-settings-tab"]',
      ];
      
      for (const tab of tabs) {
        await expect(page.locator(tab)).toBeVisible();
      }
    });
    
    test('应该切换设置分类', async () => {
      // 打开设置
      await openSettings(page);
      
      // 点击角色设置标签
      await page.click('[data-testid="character-settings-tab"]');
      
      // 验证角色设置面板可见
      await expect(
        page.locator('[data-testid="character-settings-content"]')
      ).toBeVisible();
      
      // 验证通用设置面板不可见
      await expect(
        page.locator('[data-testid="general-settings-content"]')
      ).not.toBeVisible();
    });
  });
  
  test.describe('键盘快捷键', () => {
    test('应该支持 Ctrl+K 快速打开设置', async () => {
      // 按快捷键
      await pressShortcut(page, 'Control+K');
      
      // 验证设置面板打开
      await expect(page.locator(E2E_SELECTORS.SETTINGS_PANEL)).toBeVisible();
    });
    
    test('应该支持 ESC 关闭弹窗', async () => {
      // 打开设置
      await openSettings(page);
      
      // 按 ESC
      await page.keyboard.press('Escape');
      
      // 验证设置面板关闭
      await expect(page.locator(E2E_SELECTORS.SETTINGS_PANEL)).not.toBeVisible();
    });
    
    test('应该支持 Ctrl+Shift+C 清空聊天', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '回复',
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '测试消息');
      await page.waitForTimeout(300);
      
      // 按快捷键清空
      await pressShortcut(page, 'Control+Shift+C');
      
      // 确认清空
      await page.click(E2E_SELECTORS.CONFIRM_BUTTON);
      await page.waitForTimeout(300);
      
      // 验证消息已清空
      const messages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).all();
      expect(messages.length).toBe(0);
    });
  });
  
  test.describe('错误处理', () => {
    test('应该处理网络错误', async () => {
      // Mock 网络错误
      await mockTauriCommand(page, 'send_message', {
        error: 'Network error',
      });
      
      // 发送消息
      await sendChatMessage(page, '测试网络错误');
      
      // 等待错误提示
      await page.waitForTimeout(1000);
      
      // 验证显示错误消息
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(true);
      
      // 截图记录
      await takeScreenshot(page, 'network-error');
    });
    
    test('应该处理服务器错误', async () => {
      // Mock 服务器错误
      await mockTauriCommand(page, 'send_message', {
        error: 'Server error: 500',
      });
      
      // 发送消息
      await sendChatMessage(page, '测试服务器错误');
      
      // 等待错误提示
      await page.waitForTimeout(1000);
      
      // 验证显示错误消息
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(true);
    });
    
    test('应该允许重试失败的消息', async () => {
      // Mock 第一次失败，第二次成功
      let callCount = 0;
      await page.evaluate(() => {
        // @ts-ignore
        window.__RETRY_TEST__ = {
          callCount: 0,
          responses: [
            { error: 'Network error' },
            { role: 'assistant', content: '重试成功', timestamp: Date.now() },
          ],
        };
      });
      
      // 发送消息（失败）
      await sendChatMessage(page, '测试重试');
      await page.waitForTimeout(1000);
      
      // 点击重试按钮
      const retryButton = page.locator('[data-testid="retry-message"]').last();
      await retryButton.click();
      
      // 等待重试完成
      await page.waitForTimeout(1000);
      
      // 验证收到回复
      const aiMessages = await getAIMessages(page);
      expect(aiMessages.length).toBeGreaterThan(0);
    });
  });
  
  test.describe('性能测试', () => {
    test('消息列表应该流畅滚动', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '回复',
        timestamp: Date.now(),
      });
      
      // 发送大量消息
      for (let i = 1; i <= 50; i++) {
        await sendChatMessage(page, `性能测试消息 ${i}`);
        await page.waitForTimeout(50);
      }
      
      // 测试滚动性能
      const messageList = page.locator(E2E_SELECTORS.MESSAGE_LIST);
      
      const startTime = Date.now();
      await messageList.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(100);
      await messageList.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const scrollTime = Date.now() - startTime;
      
      // 验证滚动时间合理（< 1秒）
      expect(scrollTime).toBeLessThan(1000);
    });
    
    test('应该在3秒内渲染100条消息', async () => {
      // Mock 大量消息历史
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`,
        timestamp: Date.now() - (100 - i) * 1000,
      }));
      
      await mockTauriCommand(page, 'get_chat_history', { messages });
      
      // 重新加载页面
      const startTime = Date.now();
      await page.reload();
      await waitForAppReady(page);
      const renderTime = Date.now() - startTime;
      
      // 验证渲染时间
      expect(renderTime).toBeLessThan(3000);
      
      // 验证所有消息已渲染
      const renderedMessages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).all();
      expect(renderedMessages.length).toBe(100);
    });
  });
});

