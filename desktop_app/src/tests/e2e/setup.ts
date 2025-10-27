/**
 * E2E 测试设置和工具函数
 * 提供 Tauri 应用的端到端测试支持
 */

import { type Page } from '@playwright/test';

/**
 * E2E 测试超时配置
 */
export const E2E_TIMEOUTS = {
  /** 应用启动超时 */
  APP_LAUNCH: 30000,
  /** 页面加载超时 */
  PAGE_LOAD: 10000,
  /** 模型加载超时 */
  MODEL_LOAD: 15000,
  /** API 请求超时 */
  API_REQUEST: 5000,
  /** 动画完成超时 */
  ANIMATION: 3000,
  /** 普通操作超时 */
  DEFAULT: 5000,
} as const;

/**
 * E2E 测试选择器
 */
export const E2E_SELECTORS = {
  // 主布局
  MAIN_LAYOUT: '[data-testid="main-layout"]',
  SIDEBAR: '[data-testid="sidebar"]',
  CONTENT_AREA: '[data-testid="content-area"]',
  
  // 聊天相关
  CHAT_WINDOW: '[data-testid="chat-window"]',
  MESSAGE_INPUT: '[data-testid="message-input"]',
  SEND_BUTTON: '[data-testid="send-button"]',
  MESSAGE_LIST: '[data-testid="message-list"]',
  MESSAGE_ITEM: '[data-testid="message-item"]',
  USER_MESSAGE: '[data-testid="user-message"]',
  AI_MESSAGE: '[data-testid="ai-message"]',
  TYPING_INDICATOR: '[data-testid="typing-indicator"]',
  
  // 角色相关
  CHARACTER_VIEWER: '[data-testid="character-viewer"]',
  CHARACTER_SELECTOR: '[data-testid="character-selector"]',
  CHARACTER_OPTION: '[data-testid="character-option"]',
  CHARACTER_LOADING: '[data-testid="character-loading"]',
  
  // 设置相关
  SETTINGS_BUTTON: '[data-testid="settings-button"]',
  SETTINGS_PANEL: '[data-testid="settings-panel"]',
  THEME_SELECTOR: '[data-testid="theme-selector"]',
  SAVE_SETTINGS_BUTTON: '[data-testid="save-settings"]',
  
  // 适配器相关
  ADAPTER_BUTTON: '[data-testid="adapter-button"]',
  ADAPTER_PANEL: '[data-testid="adapter-panel"]',
  ADAPTER_SEARCH: '[data-testid="adapter-search"]',
  ADAPTER_LIST: '[data-testid="adapter-list"]',
  ADAPTER_ITEM: '[data-testid="adapter-item"]',
  INSTALL_ADAPTER_BUTTON: '[data-testid="install-adapter"]',
  UNINSTALL_ADAPTER_BUTTON: '[data-testid="uninstall-adapter"]',
  START_ADAPTER_BUTTON: '[data-testid="start-adapter"]',
  STOP_ADAPTER_BUTTON: '[data-testid="stop-adapter"]',
  ADAPTER_CONFIG_BUTTON: '[data-testid="adapter-config"]',
  ADAPTER_CONFIG_DIALOG: '[data-testid="adapter-config-dialog"]',
  
  // 通用组件
  MODAL: '[data-testid="modal"]',
  MODAL_CLOSE: '[data-testid="modal-close"]',
  CONFIRM_BUTTON: '[data-testid="confirm-button"]',
  CANCEL_BUTTON: '[data-testid="cancel-button"]',
  LOADING_SPINNER: '[data-testid="loading-spinner"]',
  ERROR_MESSAGE: '[data-testid="error-message"]',
  SUCCESS_MESSAGE: '[data-testid="success-message"]',
} as const;

/**
 * 等待元素出现
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = E2E_TIMEOUTS.DEFAULT
): Promise<void> {
  await page.waitForSelector(selector, { timeout, state: 'visible' });
}

/**
 * 等待元素消失
 */
export async function waitForElementHidden(
  page: Page,
  selector: string,
  timeout: number = E2E_TIMEOUTS.DEFAULT
): Promise<void> {
  await page.waitForSelector(selector, { timeout, state: 'hidden' });
}

/**
 * 等待加载完成
 */
export async function waitForLoading(page: Page): Promise<void> {
  // 等待加载指示器出现
  try {
    await page.waitForSelector(E2E_SELECTORS.LOADING_SPINNER, {
      timeout: 1000,
      state: 'visible',
    });
  } catch {
    // 如果没有出现加载指示器，直接返回
    return;
  }
  
  // 等待加载指示器消失
  await waitForElementHidden(page, E2E_SELECTORS.LOADING_SPINNER, 10000);
}

/**
 * 等待应用完全加载
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // 等待主布局加载
  await waitForElement(page, E2E_SELECTORS.MAIN_LAYOUT, E2E_TIMEOUTS.PAGE_LOAD);
  
  // 等待所有加载完成
  await waitForLoading(page);
  
  // 等待网络空闲
  await page.waitForLoadState('networkidle');
}

/**
 * 发送聊天消息
 */
export async function sendChatMessage(
  page: Page,
  message: string
): Promise<void> {
  // 输入消息
  await page.fill(E2E_SELECTORS.MESSAGE_INPUT, message);
  
  // 点击发送按钮
  await page.click(E2E_SELECTORS.SEND_BUTTON);
  
  // 等待消息发送
  await page.waitForTimeout(500);
}

/**
 * 等待 AI 回复
 */
export async function waitForAIResponse(
  page: Page,
  timeout: number = E2E_TIMEOUTS.API_REQUEST
): Promise<void> {
  // 等待输入指示器出现
  await waitForElement(page, E2E_SELECTORS.TYPING_INDICATOR, 2000);
  
  // 等待输入指示器消失
  await waitForElementHidden(page, E2E_SELECTORS.TYPING_INDICATOR, timeout);
}

/**
 * 获取最后一条消息内容
 */
export async function getLastMessage(page: Page): Promise<string> {
  const messages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).all();
  const lastMessage = messages[messages.length - 1];
  return (await lastMessage.textContent()) || '';
}

/**
 * 获取所有用户消息
 */
export async function getUserMessages(page: Page): Promise<string[]> {
  const messages = await page.locator(E2E_SELECTORS.USER_MESSAGE).all();
  return Promise.all(messages.map(msg => msg.textContent().then(text => text || '')));
}

/**
 * 获取所有 AI 消息
 */
export async function getAIMessages(page: Page): Promise<string[]> {
  const messages = await page.locator(E2E_SELECTORS.AI_MESSAGE).all();
  return Promise.all(messages.map(msg => msg.textContent().then(text => text || '')));
}

/**
 * 打开设置面板
 */
export async function openSettings(page: Page): Promise<void> {
  await page.click(E2E_SELECTORS.SETTINGS_BUTTON);
  await waitForElement(page, E2E_SELECTORS.SETTINGS_PANEL);
}

/**
 * 关闭设置面板
 */
export async function closeSettings(page: Page): Promise<void> {
  await page.click(E2E_SELECTORS.MODAL_CLOSE);
  await waitForElementHidden(page, E2E_SELECTORS.SETTINGS_PANEL);
}

/**
 * 切换主题
 */
export async function switchTheme(page: Page, theme: 'light' | 'dark' | 'auto'): Promise<void> {
  await openSettings(page);
  await page.selectOption(E2E_SELECTORS.THEME_SELECTOR, theme);
  await page.click(E2E_SELECTORS.SAVE_SETTINGS_BUTTON);
  await closeSettings(page);
}

/**
 * 打开适配器面板
 */
export async function openAdapterPanel(page: Page): Promise<void> {
  await page.click(E2E_SELECTORS.ADAPTER_BUTTON);
  await waitForElement(page, E2E_SELECTORS.ADAPTER_PANEL);
}

/**
 * 关闭适配器面板
 */
export async function closeAdapterPanel(page: Page): Promise<void> {
  await page.click(E2E_SELECTORS.MODAL_CLOSE);
  await waitForElementHidden(page, E2E_SELECTORS.ADAPTER_PANEL);
}

/**
 * 搜索适配器
 */
export async function searchAdapter(page: Page, query: string): Promise<void> {
  await page.fill(E2E_SELECTORS.ADAPTER_SEARCH, query);
  await page.waitForTimeout(500); // 等待搜索防抖
  await waitForLoading(page);
}

/**
 * 安装适配器
 */
export async function installAdapter(
  page: Page,
  adapterName: string
): Promise<void> {
  await openAdapterPanel(page);
  await searchAdapter(page, adapterName);
  
  // 找到适配器并点击安装
  const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
    hasText: adapterName,
  });
  await adapterItem.locator(E2E_SELECTORS.INSTALL_ADAPTER_BUTTON).click();
  
  // 等待安装完成
  await waitForLoading(page);
  await page.waitForTimeout(1000);
}

/**
 * 启动适配器
 */
export async function startAdapter(page: Page, adapterName: string): Promise<void> {
  const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
    hasText: adapterName,
  });
  await adapterItem.locator(E2E_SELECTORS.START_ADAPTER_BUTTON).click();
  await page.waitForTimeout(1000);
}

/**
 * 停止适配器
 */
export async function stopAdapter(page: Page, adapterName: string): Promise<void> {
  const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
    hasText: adapterName,
  });
  await adapterItem.locator(E2E_SELECTORS.STOP_ADAPTER_BUTTON).click();
  await page.waitForTimeout(500);
}

/**
 * 卸载适配器
 */
export async function uninstallAdapter(
  page: Page,
  adapterName: string
): Promise<void> {
  const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
    hasText: adapterName,
  });
  await adapterItem.locator(E2E_SELECTORS.UNINSTALL_ADAPTER_BUTTON).click();
  
  // 确认卸载
  await page.click(E2E_SELECTORS.CONFIRM_BUTTON);
  
  // 等待卸载完成
  await waitForLoading(page);
}

/**
 * 配置适配器
 */
export async function configureAdapter(
  page: Page,
  adapterName: string,
  config: Record<string, any>
): Promise<void> {
  const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
    hasText: adapterName,
  });
  await adapterItem.locator(E2E_SELECTORS.ADAPTER_CONFIG_BUTTON).click();
  
  // 等待配置对话框
  await waitForElement(page, E2E_SELECTORS.ADAPTER_CONFIG_DIALOG);
  
  // 填写配置
  for (const [key, value] of Object.entries(config)) {
    await page.fill(`[name="${key}"]`, String(value));
  }
  
  // 保存配置
  await page.click(E2E_SELECTORS.SAVE_SETTINGS_BUTTON);
  await waitForElementHidden(page, E2E_SELECTORS.ADAPTER_CONFIG_DIALOG);
}

/**
 * 切换角色
 */
export async function switchCharacter(
  page: Page,
  characterName: string
): Promise<void> {
  // 打开角色选择器
  await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
  
  // 选择角色
  const characterOption = page.locator(E2E_SELECTORS.CHARACTER_OPTION, {
    hasText: characterName,
  });
  await characterOption.click();
  
  // 等待角色加载
  await waitForElement(page, E2E_SELECTORS.CHARACTER_LOADING, 1000);
  await waitForElementHidden(
    page,
    E2E_SELECTORS.CHARACTER_LOADING,
    E2E_TIMEOUTS.MODEL_LOAD
  );
}

/**
 * 等待角色动画播放
 */
export async function waitForCharacterAnimation(page: Page): Promise<void> {
  await page.waitForTimeout(E2E_TIMEOUTS.ANIMATION);
}

/**
 * 截图并保存
 */
export async function takeScreenshot(
  page: Page,
  name: string
): Promise<void> {
  await page.screenshot({
    path: `tests/e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}

/**
 * 检查是否存在错误提示
 */
export async function hasErrorMessage(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(E2E_SELECTORS.ERROR_MESSAGE, {
      timeout: 1000,
      state: 'visible',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否存在成功提示
 */
export async function hasSuccessMessage(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(E2E_SELECTORS.SUCCESS_MESSAGE, {
      timeout: 1000,
      state: 'visible',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取错误消息内容
 */
export async function getErrorMessage(page: Page): Promise<string> {
  const errorElement = await page.locator(E2E_SELECTORS.ERROR_MESSAGE);
  return (await errorElement.textContent()) || '';
}

/**
 * 等待并关闭错误提示
 */
export async function dismissError(page: Page): Promise<void> {
  await page.click(`${E2E_SELECTORS.ERROR_MESSAGE} button`);
  await waitForElementHidden(page, E2E_SELECTORS.ERROR_MESSAGE);
}

/**
 * 清空聊天历史
 */
export async function clearChatHistory(page: Page): Promise<void> {
  // 打开聊天菜单
  await page.click('[data-testid="chat-menu"]');
  
  // 点击清空历史
  await page.click('[data-testid="clear-history"]');
  
  // 确认
  await page.click(E2E_SELECTORS.CONFIRM_BUTTON);
  
  // 等待清空完成
  await page.waitForTimeout(500);
}

/**
 * 模拟键盘快捷键
 */
export async function pressShortcut(
  page: Page,
  shortcut: string
): Promise<void> {
  await page.keyboard.press(shortcut);
  await page.waitForTimeout(300);
}

/**
 * 等待网络请求完成
 */
export async function waitForRequest(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = E2E_TIMEOUTS.API_REQUEST
): Promise<void> {
  await page.waitForRequest(urlPattern, { timeout });
}

/**
 * 等待网络响应完成
 */
export async function waitForResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = E2E_TIMEOUTS.API_REQUEST
): Promise<void> {
  await page.waitForResponse(urlPattern, { timeout });
}

/**
 * Mock Tauri 命令
 */
export async function mockTauriCommand(
  page: Page,
  command: string,
  response: any
): Promise<void> {
  await page.evaluate(
    ({ cmd, res }) => {
      // @ts-ignore
      if (!window.__TAURI_MOCKS__) {
        // @ts-ignore
        window.__TAURI_MOCKS__ = {};
      }
      // @ts-ignore
      window.__TAURI_MOCKS__[cmd] = res;
    },
    { cmd: command, res: response }
  );
}

/**
 * 重置所有 Mock
 */
export async function resetMocks(page: Page): Promise<void> {
  await page.evaluate(() => {
    // @ts-ignore
    window.__TAURI_MOCKS__ = {};
  });
}

