/**
 * E2E 测试 - 适配器管理
 * 测试适配器搜索、安装、配置、启动、停止、卸载等完整生命周期
 */

import { test, expect, type Page } from '@playwright/test';
import {
  E2E_SELECTORS,
  E2E_TIMEOUTS,
  waitForAppReady,
  waitForElement,
  waitForElementHidden,
  waitForLoading,
  openAdapterPanel,
  closeAdapterPanel,
  searchAdapter,
  installAdapter,
  startAdapter,
  stopAdapter,
  uninstallAdapter,
  configureAdapter,
  sendChatMessage,
  waitForAIResponse,
  takeScreenshot,
  hasErrorMessage,
  hasSuccessMessage,
  getErrorMessage,
  mockTauriCommand,
  resetMocks,
  waitForResponse,
} from './setup';

test.describe('适配器管理 E2E 测试', () => {
  let page: Page;
  
  test.beforeEach(async ({ page: p }) => {
    page = p;
    
    // 访问应用
    await page.goto('/');
    
    // 等待应用完全加载
    await waitForAppReady(page);
    
    // Mock 适配器市场 API
    await mockTauriCommand(page, 'search_adapters', {
      adapters: [
        {
          id: 'openai-adapter',
          name: 'OpenAI Adapter',
          description: 'OpenAI GPT 模型适配器',
          version: '1.0.0',
          author: 'Zishu Team',
          installed: false,
        },
        {
          id: 'claude-adapter',
          name: 'Claude Adapter',
          description: 'Anthropic Claude 模型适配器',
          version: '1.2.0',
          author: 'Zishu Team',
          installed: false,
        },
        {
          id: 'local-llm-adapter',
          name: 'Local LLM Adapter',
          description: '本地大语言模型适配器',
          version: '2.0.0',
          author: 'Community',
          installed: true,
          enabled: false,
        },
      ],
    });
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
  
  test.describe('适配器面板', () => {
    test('应该打开适配器管理面板', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 验证面板可见
      await expect(page.locator(E2E_SELECTORS.ADAPTER_PANEL)).toBeVisible();
      
      // 验证面板包含必要元素
      await expect(page.locator(E2E_SELECTORS.ADAPTER_SEARCH)).toBeVisible();
      await expect(page.locator(E2E_SELECTORS.ADAPTER_LIST)).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'adapter-panel-opened');
    });
    
    test('应该关闭适配器管理面板', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 关闭面板
      await closeAdapterPanel(page);
      
      // 验证面板不可见
      await expect(page.locator(E2E_SELECTORS.ADAPTER_PANEL)).not.toBeVisible();
    });
    
    test('应该显示已安装的适配器', async () => {
      // Mock 已安装适配器列表
      await mockTauriCommand(page, 'list_adapters', {
        adapters: [
          {
            id: 'local-llm-adapter',
            name: 'Local LLM Adapter',
            version: '2.0.0',
            enabled: false,
            status: 'stopped',
          },
        ],
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 验证已安装适配器显示
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await expect(adapterItem).toBeVisible();
      
      // 验证适配器状态标签
      const statusBadge = adapterItem.locator('[data-testid="adapter-status"]');
      await expect(statusBadge).toContainText('已停止');
    });
    
    test('应该显示适配器详细信息', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 点击适配器查看详情
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM).first();
      await adapterItem.click();
      
      // 验证详情面板显示
      const detailPanel = page.locator('[data-testid="adapter-detail-panel"]');
      await expect(detailPanel).toBeVisible();
      
      // 验证详情包含版本、作者、描述等信息
      await expect(detailPanel.locator('[data-testid="adapter-version"]')).toBeVisible();
      await expect(detailPanel.locator('[data-testid="adapter-author"]')).toBeVisible();
      await expect(detailPanel.locator('[data-testid="adapter-description"]')).toBeVisible();
    });
  });
  
  test.describe('适配器搜索', () => {
    test('应该搜索适配器', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 搜索适配器
      await searchAdapter(page, 'OpenAI');
      
      // 验证搜索结果
      const searchResults = await page.locator(E2E_SELECTORS.ADAPTER_ITEM).all();
      expect(searchResults.length).toBeGreaterThan(0);
      
      // 验证结果包含搜索关键词
      const firstResult = searchResults[0];
      const resultText = await firstResult.textContent();
      expect(resultText?.toLowerCase()).toContain('openai');
      
      // 截图记录
      await takeScreenshot(page, 'adapter-search-results');
    });
    
    test('应该处理空搜索结果', async () => {
      // Mock 空搜索结果
      await mockTauriCommand(page, 'search_adapters', {
        adapters: [],
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 搜索不存在的适配器
      await searchAdapter(page, 'NonExistentAdapter');
      
      // 验证显示空状态
      const emptyState = page.locator('[data-testid="empty-search-results"]');
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('未找到');
    });
    
    test('应该支持搜索过滤', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 输入搜索词
      await page.fill(E2E_SELECTORS.ADAPTER_SEARCH, 'claude');
      await page.waitForTimeout(500);
      
      // 验证只显示匹配的适配器
      const visibleItems = await page.locator(E2E_SELECTORS.ADAPTER_ITEM).all();
      
      for (const item of visibleItems) {
        const text = await item.textContent();
        expect(text?.toLowerCase()).toContain('claude');
      }
    });
    
    test('应该清除搜索条件', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 搜索适配器
      await searchAdapter(page, 'OpenAI');
      
      // 清除搜索
      await page.click('[data-testid="clear-search"]');
      
      // 验证显示所有适配器
      const allItems = await page.locator(E2E_SELECTORS.ADAPTER_ITEM).all();
      expect(allItems.length).toBeGreaterThan(1);
    });
  });
  
  test.describe('安装适配器', () => {
    test('应该安装适配器', async () => {
      // Mock 安装响应
      await mockTauriCommand(page, 'install_adapter', {
        success: true,
        adapter_id: 'openai-adapter',
        message: '安装成功',
      });
      
      // 安装适配器
      await installAdapter(page, 'OpenAI Adapter');
      
      // 验证成功消息
      const hasSuccess = await hasSuccessMessage(page);
      expect(hasSuccess).toBe(true);
      
      // 验证适配器状态变为已安装
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'OpenAI Adapter',
      });
      const installedBadge = adapterItem.locator('[data-testid="installed-badge"]');
      await expect(installedBadge).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'adapter-installed');
    });
    
    test('应该显示安装进度', async () => {
      // Mock 安装进度
      await mockTauriCommand(page, 'install_adapter', {
        success: true,
        progress: true,
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 开始安装
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'OpenAI Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.INSTALL_ADAPTER_BUTTON).click();
      
      // 验证进度条显示
      const progressBar = page.locator('[data-testid="install-progress"]');
      await expect(progressBar).toBeVisible();
      
      // 等待安装完成
      await waitForLoading(page);
      
      // 验证进度条消失
      await expect(progressBar).not.toBeVisible();
    });
    
    test('应该处理安装失败', async () => {
      // Mock 安装失败
      await mockTauriCommand(page, 'install_adapter', {
        success: false,
        error: '网络错误，无法下载适配器',
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 尝试安装
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'OpenAI Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.INSTALL_ADAPTER_BUTTON).click();
      
      // 等待错误提示
      await page.waitForTimeout(1000);
      
      // 验证错误消息
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(true);
      
      const errorMsg = await getErrorMessage(page);
      expect(errorMsg).toContain('网络错误');
      
      // 截图记录
      await takeScreenshot(page, 'adapter-install-failed');
    });
    
    test('应该阻止重复安装', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 查找已安装的适配器
      const installedAdapter = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      
      // 验证安装按钮不可用
      const installButton = installedAdapter.locator(E2E_SELECTORS.INSTALL_ADAPTER_BUTTON);
      await expect(installButton).toBeDisabled();
    });
    
    test('应该验证适配器依赖', async () => {
      // Mock 依赖检查失败
      await mockTauriCommand(page, 'install_adapter', {
        success: false,
        error: '缺少依赖: Python 3.8+',
      });
      
      // 尝试安装
      await installAdapter(page, 'Local LLM Adapter');
      
      // 验证依赖错误提示
      const errorMsg = await getErrorMessage(page);
      expect(errorMsg).toContain('缺少依赖');
    });
  });
  
  test.describe('配置适配器', () => {
    test('应该打开配置对话框', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 点击配置按钮
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.ADAPTER_CONFIG_BUTTON).click();
      
      // 验证配置对话框显示
      await expect(page.locator(E2E_SELECTORS.ADAPTER_CONFIG_DIALOG)).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'adapter-config-dialog');
    });
    
    test('应该保存适配器配置', async () => {
      // Mock 配置保存
      await mockTauriCommand(page, 'update_adapter_config', {
        success: true,
        message: '配置已保存',
      });
      
      // 配置适配器
      await configureAdapter(page, 'Local LLM Adapter', {
        api_key: 'test-api-key-123',
        model: 'gpt-4',
        temperature: '0.7',
        max_tokens: '2048',
      });
      
      // 验证成功消息
      const hasSuccess = await hasSuccessMessage(page);
      expect(hasSuccess).toBe(true);
    });
    
    test('应该验证配置参数', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 打开配置对话框
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.ADAPTER_CONFIG_BUTTON).click();
      
      // 输入无效配置
      await page.fill('[name="temperature"]', '2.5'); // 超出范围
      
      // 尝试保存
      await page.click(E2E_SELECTORS.SAVE_SETTINGS_BUTTON);
      
      // 验证验证错误提示
      const validationError = page.locator('[data-testid="validation-error"]');
      await expect(validationError).toBeVisible();
      await expect(validationError).toContainText('temperature 必须在 0-2 之间');
    });
    
    test('应该显示配置帮助文档', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 打开配置对话框
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.ADAPTER_CONFIG_BUTTON).click();
      
      // 点击帮助图标
      await page.click('[data-testid="config-help-icon"]');
      
      // 验证帮助提示显示
      const helpTooltip = page.locator('[data-testid="config-help-tooltip"]');
      await expect(helpTooltip).toBeVisible();
    });
    
    test('应该重置配置为默认值', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 打开配置对话框
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.ADAPTER_CONFIG_BUTTON).click();
      
      // 修改配置
      await page.fill('[name="temperature"]', '1.5');
      
      // 点击重置按钮
      await page.click('[data-testid="reset-config-button"]');
      
      // 验证值恢复为默认
      const temperatureValue = await page.inputValue('[name="temperature"]');
      expect(temperatureValue).toBe('0.7'); // 默认值
    });
  });
  
  test.describe('启动和停止适配器', () => {
    test('应该启动适配器', async () => {
      // Mock 启动响应
      await mockTauriCommand(page, 'load_adapter', {
        success: true,
        adapter_id: 'local-llm-adapter',
        status: 'running',
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 启动适配器
      await startAdapter(page, 'Local LLM Adapter');
      
      // 验证适配器状态变为运行中
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      const statusBadge = adapterItem.locator('[data-testid="adapter-status"]');
      await expect(statusBadge).toContainText('运行中');
      
      // 截图记录
      await takeScreenshot(page, 'adapter-running');
    });
    
    test('应该停止适配器', async () => {
      // Mock 停止响应
      await mockTauriCommand(page, 'unload_adapter', {
        success: true,
        adapter_id: 'local-llm-adapter',
        status: 'stopped',
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 先启动适配器
      await mockTauriCommand(page, 'load_adapter', {
        success: true,
        status: 'running',
      });
      await startAdapter(page, 'Local LLM Adapter');
      
      // 停止适配器
      await stopAdapter(page, 'Local LLM Adapter');
      
      // 验证适配器状态变为已停止
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      const statusBadge = adapterItem.locator('[data-testid="adapter-status"]');
      await expect(statusBadge).toContainText('已停止');
    });
    
    test('应该显示启动进度', async () => {
      // Mock 启动进度
      await mockTauriCommand(page, 'load_adapter', {
        success: true,
        progress: true,
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 启动适配器
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.START_ADAPTER_BUTTON).click();
      
      // 验证加载状态
      const loadingSpinner = adapterItem.locator('[data-testid="adapter-loading"]');
      await expect(loadingSpinner).toBeVisible();
      
      // 等待启动完成
      await waitForLoading(page);
    });
    
    test('应该处理启动失败', async () => {
      // Mock 启动失败
      await mockTauriCommand(page, 'load_adapter', {
        success: false,
        error: '适配器初始化失败：端口已被占用',
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 尝试启动
      await startAdapter(page, 'Local LLM Adapter');
      
      // 验证错误消息
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(true);
      
      const errorMsg = await getErrorMessage(page);
      expect(errorMsg).toContain('端口已被占用');
    });
    
    test('应该自动重启崩溃的适配器', async () => {
      // Mock 适配器崩溃事件
      await page.evaluate(() => {
        // @ts-ignore
        window.__TAURI_INVOKE__ = (cmd: string) => {
          if (cmd === 'load_adapter') {
            // 第一次启动成功
            return Promise.resolve({ success: true, status: 'running' });
          }
          return Promise.resolve({});
        };
        
        // 模拟崩溃事件
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('tauri://adapter-crashed', {
              detail: { adapter_id: 'local-llm-adapter' },
            })
          );
        }, 1000);
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 启动适配器
      await startAdapter(page, 'Local LLM Adapter');
      
      // 等待崩溃和自动重启
      await page.waitForTimeout(2000);
      
      // 验证显示重启提示
      const restartNotice = page.locator('[data-testid="adapter-restarting"]');
      await expect(restartNotice).toBeVisible();
    });
  });
  
  test.describe('卸载适配器', () => {
    test('应该卸载适配器', async () => {
      // Mock 卸载响应
      await mockTauriCommand(page, 'uninstall_adapter', {
        success: true,
        adapter_id: 'local-llm-adapter',
        message: '卸载成功',
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 卸载适配器
      await uninstallAdapter(page, 'Local LLM Adapter');
      
      // 验证成功消息
      const hasSuccess = await hasSuccessMessage(page);
      expect(hasSuccess).toBe(true);
      
      // 验证适配器从列表中移除
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await expect(adapterItem).not.toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'adapter-uninstalled');
    });
    
    test('应该确认卸载操作', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 点击卸载按钮
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.UNINSTALL_ADAPTER_BUTTON).click();
      
      // 验证确认对话框显示
      const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText('确定要卸载');
    });
    
    test('应该阻止卸载运行中的适配器', async () => {
      // Mock 适配器运行状态
      await mockTauriCommand(page, 'list_adapters', {
        adapters: [
          {
            id: 'local-llm-adapter',
            name: 'Local LLM Adapter',
            status: 'running',
            enabled: true,
          },
        ],
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 尝试卸载
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      
      // 验证卸载按钮被禁用
      const uninstallButton = adapterItem.locator(E2E_SELECTORS.UNINSTALL_ADAPTER_BUTTON);
      await expect(uninstallButton).toBeDisabled();
    });
    
    test('应该清理适配器数据', async () => {
      // Mock 卸载并清理数据
      await mockTauriCommand(page, 'uninstall_adapter', {
        success: true,
        data_cleaned: true,
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 卸载适配器（勾选清理数据）
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator(E2E_SELECTORS.UNINSTALL_ADAPTER_BUTTON).click();
      
      // 勾选清理数据选项
      await page.check('[data-testid="clean-data-checkbox"]');
      
      // 确认卸载
      await page.click(E2E_SELECTORS.CONFIRM_BUTTON);
      
      // 验证成功消息包含数据清理提示
      await page.waitForTimeout(500);
      const successMsg = await page.locator(E2E_SELECTORS.SUCCESS_MESSAGE).textContent();
      expect(successMsg).toContain('数据已清理');
    });
  });
  
  test.describe('使用适配器', () => {
    test('应该通过适配器发送消息', async () => {
      // Mock 适配器启动
      await mockTauriCommand(page, 'load_adapter', {
        success: true,
        status: 'running',
      });
      
      // Mock 通过适配器发送消息
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '这是通过适配器返回的回复',
        adapter_id: 'local-llm-adapter',
        timestamp: Date.now(),
      });
      
      // 启动适配器
      await openAdapterPanel(page);
      await startAdapter(page, 'Local LLM Adapter');
      await closeAdapterPanel(page);
      
      // 发送消息
      await sendChatMessage(page, '测试适配器');
      
      // 等待回复
      await waitForAIResponse(page);
      
      // 验证收到适配器回复
      const aiMessages = await page
        .locator(E2E_SELECTORS.AI_MESSAGE)
        .allTextContents();
      expect(aiMessages[aiMessages.length - 1]).toContain('通过适配器返回');
      
      // 截图记录
      await takeScreenshot(page, 'adapter-message-sent');
    });
    
    test('应该显示适配器响应时间', async () => {
      // Mock 适配器响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '回复',
        adapter_id: 'local-llm-adapter',
        response_time: 1250, // 1.25秒
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '测试响应时间');
      await waitForAIResponse(page);
      
      // 验证显示响应时间
      const messageItem = page.locator(E2E_SELECTORS.MESSAGE_ITEM).last();
      const responseTime = messageItem.locator('[data-testid="response-time"]');
      await expect(responseTime).toBeVisible();
      await expect(responseTime).toContainText('1.25s');
    });
    
    test('应该处理适配器超时', async () => {
      // Mock 超时错误
      await mockTauriCommand(page, 'send_message', {
        error: 'Adapter timeout: Request took too long',
        adapter_id: 'local-llm-adapter',
      });
      
      // 发送消息
      await sendChatMessage(page, '测试超时');
      await page.waitForTimeout(1000);
      
      // 验证超时错误提示
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(true);
      
      const errorMsg = await getErrorMessage(page);
      expect(errorMsg).toContain('超时');
    });
    
    test('应该支持切换适配器', async () => {
      // Mock 两个运行中的适配器
      await mockTauriCommand(page, 'list_adapters', {
        adapters: [
          { id: 'adapter-1', name: 'Adapter 1', status: 'running' },
          { id: 'adapter-2', name: 'Adapter 2', status: 'running' },
        ],
      });
      
      // 打开适配器选择器
      await page.click('[data-testid="adapter-selector"]');
      
      // 选择适配器2
      await page.click('[data-testid="adapter-option-2"]');
      
      // Mock 适配器2的响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '来自适配器2的回复',
        adapter_id: 'adapter-2',
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '测试适配器切换');
      await waitForAIResponse(page);
      
      // 验证使用了适配器2
      const aiMessages = await page
        .locator(E2E_SELECTORS.AI_MESSAGE)
        .allTextContents();
      expect(aiMessages[aiMessages.length - 1]).toContain('来自适配器2');
    });
  });
  
  test.describe('适配器更新', () => {
    test('应该检查适配器更新', async () => {
      // Mock 更新检查
      await mockTauriCommand(page, 'check_adapter_updates', {
        updates: [
          {
            adapter_id: 'local-llm-adapter',
            current_version: '2.0.0',
            latest_version: '2.1.0',
            changelog: '修复若干bug，提升性能',
          },
        ],
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 点击检查更新
      await page.click('[data-testid="check-updates-button"]');
      
      // 等待检查完成
      await waitForLoading(page);
      
      // 验证显示更新提示
      const updateBadge = page.locator('[data-testid="update-available-badge"]');
      await expect(updateBadge).toBeVisible();
    });
    
    test('应该更新适配器', async () => {
      // Mock 更新操作
      await mockTauriCommand(page, 'update_adapter', {
        success: true,
        adapter_id: 'local-llm-adapter',
        new_version: '2.1.0',
      });
      
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 点击更新按钮
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator('[data-testid="update-adapter-button"]').click();
      
      // 等待更新完成
      await waitForLoading(page);
      
      // 验证版本号已更新
      const versionText = await adapterItem
        .locator('[data-testid="adapter-version"]')
        .textContent();
      expect(versionText).toContain('2.1.0');
    });
    
    test('应该显示更新日志', async () => {
      // 打开适配器面板
      await openAdapterPanel(page);
      
      // 点击更新按钮
      const adapterItem = page.locator(E2E_SELECTORS.ADAPTER_ITEM, {
        hasText: 'Local LLM Adapter',
      });
      await adapterItem.locator('[data-testid="update-adapter-button"]').click();
      
      // 验证显示更新日志对话框
      const changelogDialog = page.locator('[data-testid="changelog-dialog"]');
      await expect(changelogDialog).toBeVisible();
      
      // 验证包含更新内容
      await expect(changelogDialog).toContainText('修复');
    });
  });
  
  test.describe('完整工作流', () => {
    test('应该完成适配器完整生命周期', async () => {
      // 1. 搜索适配器
      await openAdapterPanel(page);
      await searchAdapter(page, 'OpenAI');
      await takeScreenshot(page, 'workflow-1-search');
      
      // 2. 安装适配器
      await mockTauriCommand(page, 'install_adapter', { success: true });
      await installAdapter(page, 'OpenAI Adapter');
      await takeScreenshot(page, 'workflow-2-install');
      
      // 3. 配置适配器
      await mockTauriCommand(page, 'update_adapter_config', { success: true });
      await configureAdapter(page, 'OpenAI Adapter', {
        api_key: 'test-key',
        model: 'gpt-4',
      });
      await takeScreenshot(page, 'workflow-3-config');
      
      // 4. 启动适配器
      await mockTauriCommand(page, 'load_adapter', {
        success: true,
        status: 'running',
      });
      await startAdapter(page, 'OpenAI Adapter');
      await takeScreenshot(page, 'workflow-4-start');
      
      // 5. 使用适配器发送消息
      await closeAdapterPanel(page);
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '适配器工作正常',
        timestamp: Date.now(),
      });
      await sendChatMessage(page, '测试消息');
      await waitForAIResponse(page);
      await takeScreenshot(page, 'workflow-5-use');
      
      // 6. 停止适配器
      await openAdapterPanel(page);
      await mockTauriCommand(page, 'unload_adapter', {
        success: true,
        status: 'stopped',
      });
      await stopAdapter(page, 'OpenAI Adapter');
      await takeScreenshot(page, 'workflow-6-stop');
      
      // 7. 卸载适配器
      await mockTauriCommand(page, 'uninstall_adapter', { success: true });
      await uninstallAdapter(page, 'OpenAI Adapter');
      await takeScreenshot(page, 'workflow-7-uninstall');
      
      // 验证流程完成
      console.log('✅ 适配器完整生命周期测试通过');
    });
  });
});

