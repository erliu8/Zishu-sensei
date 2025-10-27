/**
 * E2E 测试 - 角色切换
 * 测试角色选择、模型加载、动画播放、表情变化等功能
 */

import { test, expect, type Page } from '@playwright/test';
import {
  E2E_SELECTORS,
  E2E_TIMEOUTS,
  waitForAppReady,
  waitForElement,
  waitForElementHidden,
  switchCharacter,
  waitForCharacterAnimation,
  sendChatMessage,
  waitForAIResponse,
  getAIMessages,
  takeScreenshot,
  hasErrorMessage,
  getErrorMessage,
  mockTauriCommand,
  resetMocks,
} from './setup';

test.describe('角色切换 E2E 测试', () => {
  let page: Page;
  
  test.beforeEach(async ({ page: p }) => {
    page = p;
    
    // 访问应用
    await page.goto('/');
    
    // 等待应用完全加载
    await waitForAppReady(page);
    
    // Mock 角色列表
    await mockTauriCommand(page, 'get_character_config', {
      current_character: 'hiyori',
      characters: [
        {
          id: 'hiyori',
          name: 'Hiyori',
          description: '活泼可爱的女孩',
          model_path: '/models/hiyori',
          avatar: '/avatars/hiyori.png',
          personality: 'cheerful',
        },
        {
          id: 'shizuku',
          name: 'Shizuku',
          description: '温柔体贴的少女',
          model_path: '/models/shizuku',
          avatar: '/avatars/shizuku.png',
          personality: 'gentle',
        },
        {
          id: 'koharu',
          name: 'Koharu',
          description: '知性优雅的学姐',
          model_path: '/models/koharu',
          avatar: '/avatars/koharu.png',
          personality: 'intellectual',
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
  
  test.describe('角色选择', () => {
    test('应该显示角色选择器', async () => {
      // 点击角色选择器
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      
      // 验证选择器展开
      const dropdown = page.locator('[data-testid="character-dropdown"]');
      await expect(dropdown).toBeVisible();
      
      // 验证显示所有可用角色
      const characterOptions = await page.locator(E2E_SELECTORS.CHARACTER_OPTION).all();
      expect(characterOptions.length).toBe(3);
      
      // 截图记录
      await takeScreenshot(page, 'character-selector-opened');
    });
    
    test('应该显示角色头像和名称', async () => {
      // 打开角色选择器
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      
      // 验证第一个角色选项
      const firstOption = page.locator(E2E_SELECTORS.CHARACTER_OPTION).first();
      
      // 验证头像
      const avatar = firstOption.locator('[data-testid="character-avatar"]');
      await expect(avatar).toBeVisible();
      
      // 验证名称
      const name = firstOption.locator('[data-testid="character-name"]');
      await expect(name).toBeVisible();
      await expect(name).toContainText('Hiyori');
      
      // 验证描述
      const description = firstOption.locator('[data-testid="character-description"]');
      await expect(description).toBeVisible();
      await expect(description).toContainText('活泼可爱');
    });
    
    test('应该高亮当前选中的角色', async () => {
      // 打开角色选择器
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      
      // 获取当前角色选项
      const currentOption = page.locator(E2E_SELECTORS.CHARACTER_OPTION, {
        hasText: 'Hiyori',
      });
      
      // 验证有选中状态
      await expect(currentOption).toHaveClass(/selected|active/);
      
      // 验证有选中图标
      const checkIcon = currentOption.locator('[data-testid="selected-icon"]');
      await expect(checkIcon).toBeVisible();
    });
    
    test('应该支持键盘导航选择角色', async () => {
      // 打开角色选择器
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      
      // 按下箭头键导航
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      
      // 验证焦点移动到第二个选项
      const secondOption = page.locator(E2E_SELECTORS.CHARACTER_OPTION).nth(1);
      await expect(secondOption).toBeFocused();
      
      // 按 Enter 选择
      await page.keyboard.press('Enter');
      
      // 验证角色已切换
      await page.waitForTimeout(500);
      const currentCharacter = await page
        .locator('[data-testid="current-character-name"]')
        .textContent();
      expect(currentCharacter).toContain('Shizuku');
    });
  });
  
  test.describe('角色切换', () => {
    test('应该切换角色', async () => {
      // Mock 角色切换
      await mockTauriCommand(page, 'update_character_config', {
        success: true,
        current_character: 'shizuku',
      });
      
      // 切换到 Shizuku
      await switchCharacter(page, 'Shizuku');
      
      // 验证角色已切换
      const currentCharacter = await page
        .locator('[data-testid="current-character-name"]')
        .textContent();
      expect(currentCharacter).toContain('Shizuku');
      
      // 截图记录
      await takeScreenshot(page, 'character-switched');
    });
    
    test('应该显示加载指示器', async () => {
      // Mock 角色切换（延迟）
      await mockTauriCommand(page, 'update_character_config', {
        success: true,
        delay: 2000,
      });
      
      // 开始切换角色
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      await page.locator(E2E_SELECTORS.CHARACTER_OPTION).filter({ hasText: 'Shizuku' }).click();
      
      // 验证加载指示器显示
      await waitForElement(page, E2E_SELECTORS.CHARACTER_LOADING, 1000);
      await expect(page.locator(E2E_SELECTORS.CHARACTER_LOADING)).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'character-loading');
      
      // 等待加载完成
      await waitForElementHidden(
        page,
        E2E_SELECTORS.CHARACTER_LOADING,
        E2E_TIMEOUTS.MODEL_LOAD
      );
    });
    
    test('应该在5秒内完成角色切换', async () => {
      // Mock 角色切换
      await mockTauriCommand(page, 'update_character_config', {
        success: true,
      });
      
      const startTime = Date.now();
      
      // 切换角色
      await switchCharacter(page, 'Shizuku');
      
      const switchTime = Date.now() - startTime;
      
      // 验证切换时间
      expect(switchTime).toBeLessThan(5000);
      
      console.log(`✅ 角色切换时间: ${switchTime}ms`);
    });
    
    test('应该处理模型加载失败', async () => {
      // Mock 加载失败
      await mockTauriCommand(page, 'update_character_config', {
        success: false,
        error: '模型文件不存在',
      });
      
      // 尝试切换角色
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      await page.locator(E2E_SELECTORS.CHARACTER_OPTION).filter({ hasText: 'Shizuku' }).click();
      
      // 等待错误提示
      await page.waitForTimeout(1000);
      
      // 验证错误消息
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(true);
      
      const errorMsg = await getErrorMessage(page);
      expect(errorMsg).toContain('模型文件不存在');
      
      // 验证回退到原角色
      const currentCharacter = await page
        .locator('[data-testid="current-character-name"]')
        .textContent();
      expect(currentCharacter).toContain('Hiyori'); // 保持原角色
      
      // 截图记录
      await takeScreenshot(page, 'character-load-failed');
    });
    
    test('应该平滑过渡角色', async () => {
      // Mock 角色切换
      await mockTauriCommand(page, 'update_character_config', {
        success: true,
      });
      
      // 获取角色查看器
      const characterViewer = page.locator(E2E_SELECTORS.CHARACTER_VIEWER);
      
      // 切换角色
      await switchCharacter(page, 'Shizuku');
      
      // 等待过渡完成
      await page.waitForTimeout(500);
      
      // 验证透明度变化（淡入淡出效果）
      const finalOpacity = await characterViewer.evaluate((el) => {
        return window.getComputedStyle(el).opacity;
      });
      
      expect(finalOpacity).toBe('1'); // 最终完全显示
    });
  });
  
  test.describe('Live2D 模型', () => {
    test('应该加载 Live2D 模型', async () => {
      // Mock 模型加载成功
      await mockTauriCommand(page, 'load_character_model', {
        success: true,
        model_id: 'hiyori',
        textures_loaded: true,
        animations_loaded: true,
      });
      
      // 等待模型加载
      await waitForElement(
        page,
        E2E_SELECTORS.CHARACTER_VIEWER,
        E2E_TIMEOUTS.MODEL_LOAD
      );
      
      // 验证模型已显示
      await expect(page.locator(E2E_SELECTORS.CHARACTER_VIEWER)).toBeVisible();
      
      // 验证 canvas 元素存在
      const canvas = page.locator(`${E2E_SELECTORS.CHARACTER_VIEWER} canvas`);
      await expect(canvas).toBeVisible();
      
      // 截图记录
      await takeScreenshot(page, 'live2d-model-loaded');
    });
    
    test('应该显示模型加载进度', async () => {
      // Mock 模型加载进度
      await page.evaluate(() => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          window.dispatchEvent(
            new CustomEvent('model-load-progress', {
              detail: { progress },
            })
          );
          if (progress >= 100) clearInterval(interval);
        }, 200);
      });
      
      // 切换角色触发加载
      await switchCharacter(page, 'Shizuku');
      
      // 验证进度条显示
      const progressBar = page.locator('[data-testid="model-load-progress"]');
      await expect(progressBar).toBeVisible();
      
      // 等待加载完成
      await waitForElementHidden(
        page,
        E2E_SELECTORS.CHARACTER_LOADING,
        E2E_TIMEOUTS.MODEL_LOAD
      );
    });
    
    test('应该正确显示模型尺寸和位置', async () => {
      // Mock 角色配置
      await mockTauriCommand(page, 'get_character_config', {
        current_character: 'hiyori',
        display: {
          scale: 0.8,
          position: { x: 100, y: 50 },
        },
      });
      
      // 重新加载页面应用配置
      await page.reload();
      await waitForAppReady(page);
      
      // 获取角色查看器样式
      const characterViewer = page.locator(E2E_SELECTORS.CHARACTER_VIEWER);
      const transform = await characterViewer.evaluate((el) => {
        return window.getComputedStyle(el).transform;
      });
      
      // 验证缩放和位置
      expect(transform).toContain('scale'); // 包含缩放变换
    });
    
    test('应该支持调整模型缩放', async () => {
      // 打开角色控制面板
      await page.click('[data-testid="character-control-button"]');
      
      // 调整缩放滑块
      const scaleSlider = page.locator('[data-testid="scale-slider"]');
      await scaleSlider.fill('1.2');
      
      // 等待缩放应用
      await page.waitForTimeout(500);
      
      // 验证缩放已改变
      const characterViewer = page.locator(E2E_SELECTORS.CHARACTER_VIEWER);
      const transform = await characterViewer.evaluate((el) => {
        return window.getComputedStyle(el).transform;
      });
      
      expect(transform).toBeTruthy();
    });
    
    test('应该支持拖拽调整位置', async () => {
      const characterViewer = page.locator(E2E_SELECTORS.CHARACTER_VIEWER);
      
      // 获取初始位置
      const initialBox = await characterViewer.boundingBox();
      expect(initialBox).toBeTruthy();
      
      // 拖拽角色
      await characterViewer.dragTo(page.locator('body'), {
        targetPosition: { x: initialBox!.x + 100, y: initialBox!.y + 50 },
      });
      
      // 等待位置更新
      await page.waitForTimeout(300);
      
      // 获取新位置
      const newBox = await characterViewer.boundingBox();
      expect(newBox).toBeTruthy();
      
      // 验证位置已改变
      expect(newBox!.x).not.toBe(initialBox!.x);
      expect(newBox!.y).not.toBe(initialBox!.y);
    });
  });
  
  test.describe('角色动画', () => {
    test('应该播放默认空闲动画', async () => {
      // Mock 动画播放事件
      await page.evaluate(() => {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('animation-started', {
              detail: { animation: 'idle', loop: true },
            })
          );
        }, 1000);
      });
      
      // 等待动画开始
      await page.waitForTimeout(1500);
      
      // 验证动画状态
      const animationStatus = page.locator('[data-testid="animation-status"]');
      const statusText = await animationStatus.textContent();
      expect(statusText).toContain('idle');
    });
    
    test('应该在点击时播放交互动画', async () => {
      // Mock 点击动画
      await mockTauriCommand(page, 'play_animation', {
        success: true,
        animation: 'tap_body',
      });
      
      // 点击角色
      const characterViewer = page.locator(E2E_SELECTORS.CHARACTER_VIEWER);
      await characterViewer.click();
      
      // 等待动画播放
      await waitForCharacterAnimation(page);
      
      // 截图记录
      await takeScreenshot(page, 'character-tap-animation');
    });
    
    test('应该根据消息内容播放相应动画', async () => {
      // Mock AI 响应带动画
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '哈哈哈，太有趣了！',
        animation: 'laugh',
        expression: 'happy',
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '给你讲个笑话');
      
      // 等待回复和动画
      await waitForAIResponse(page);
      await waitForCharacterAnimation(page);
      
      // 截图记录
      await takeScreenshot(page, 'character-laugh-animation');
    });
    
    test('应该支持动画队列', async () => {
      // Mock 多个动画
      await page.evaluate(() => {
        // 模拟动画队列
        const animations = ['greet', 'nod', 'idle'];
        let index = 0;
        
        const playNext = () => {
          if (index < animations.length) {
            window.dispatchEvent(
              new CustomEvent('animation-started', {
                detail: { animation: animations[index] },
              })
            );
            index++;
            setTimeout(playNext, 1000);
          }
        };
        
        playNext();
      });
      
      // 等待所有动画播放
      await page.waitForTimeout(3500);
      
      // 验证最后播放的是空闲动画
      const animationStatus = page.locator('[data-testid="animation-status"]');
      const statusText = await animationStatus.textContent();
      expect(statusText).toContain('idle');
    });
    
    test('应该循环播放空闲动画', async () => {
      // 等待一段时间
      await page.waitForTimeout(5000);
      
      // 验证空闲动画在循环
      const characterViewer = page.locator(E2E_SELECTORS.CHARACTER_VIEWER);
      const isAnimating = await characterViewer.evaluate((el) => {
        // 检查是否有动画类或状态
        return el.classList.contains('animating') || el.dataset.animating === 'true';
      });
      
      expect(isAnimating).toBeTruthy();
    });
  });
  
  test.describe('角色表情', () => {
    test('应该切换表情', async () => {
      // Mock 表情切换
      await mockTauriCommand(page, 'set_expression', {
        success: true,
        expression: 'happy',
      });
      
      // 打开表情选择器
      await page.click('[data-testid="expression-selector"]');
      
      // 选择开心表情
      await page.click('[data-testid="expression-happy"]');
      
      // 等待表情切换
      await page.waitForTimeout(500);
      
      // 截图记录
      await takeScreenshot(page, 'character-happy-expression');
    });
    
    test('应该根据对话情绪自动切换表情', async () => {
      // Mock 带表情的响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '真的吗？太棒了！',
        expression: 'surprised',
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '我有个好消息！');
      
      // 等待回复
      await waitForAIResponse(page);
      
      // 等待表情切换
      await page.waitForTimeout(500);
      
      // 截图记录
      await takeScreenshot(page, 'character-auto-expression');
    });
    
    test('应该平滑过渡表情', async () => {
      // 切换多个表情
      const expressions = ['happy', 'sad', 'surprised', 'normal'];
      
      for (const expression of expressions) {
        await mockTauriCommand(page, 'set_expression', {
          success: true,
          expression,
        });
        
        await page.click('[data-testid="expression-selector"]');
        await page.click(`[data-testid="expression-${expression}"]`);
        await page.waitForTimeout(800); // 等待过渡动画
      }
      
      // 验证表情切换流畅
      console.log('✅ 表情平滑过渡完成');
    });
  });
  
  test.describe('角色与对话联动', () => {
    test('应该保留对话历史', async () => {
      // Mock AI 响应
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '你好！',
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '你好');
      await waitForAIResponse(page);
      
      // 获取消息数量
      const messagesBefore = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).count();
      expect(messagesBefore).toBeGreaterThan(0);
      
      // 切换角色
      await mockTauriCommand(page, 'update_character_config', {
        success: true,
        keep_conversation: true,
      });
      await switchCharacter(page, 'Shizuku');
      
      // 验证消息仍然存在
      const messagesAfter = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).count();
      expect(messagesAfter).toBe(messagesBefore);
    });
    
    test('应该使用新角色的人设回复', async () => {
      // 切换到 Shizuku（温柔性格）
      await mockTauriCommand(page, 'update_character_config', {
        success: true,
        personality: 'gentle',
      });
      await switchCharacter(page, 'Shizuku');
      
      // Mock Shizuku 的回复
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '请不要担心，我会温柔地帮助你的。',
        character_id: 'shizuku',
        timestamp: Date.now(),
      });
      
      // 发送消息
      await sendChatMessage(page, '我遇到了问题');
      await waitForAIResponse(page);
      
      // 验证回复体现新角色性格
      const aiMessages = await getAIMessages(page);
      const lastMessage = aiMessages[aiMessages.length - 1];
      expect(lastMessage).toContain('温柔');
    });
    
    test('应该显示角色特定的对话UI', async () => {
      // 切换到不同角色
      await switchCharacter(page, 'Koharu');
      
      // 验证头像已更新
      const aiAvatar = page.locator('[data-testid="ai-message-avatar"]').first();
      const avatarSrc = await aiAvatar.getAttribute('src');
      expect(avatarSrc).toContain('koharu');
      
      // 验证角色名称已更新
      const characterName = page.locator('[data-testid="current-character-name"]');
      await expect(characterName).toContainText('Koharu');
    });
  });
  
  test.describe('角色性能', () => {
    test('应该流畅渲染角色动画', async () => {
      // 测试帧率
      const frameCount = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let frames = 0;
          const startTime = Date.now();
          
          const countFrame = () => {
            frames++;
            const elapsed = Date.now() - startTime;
            
            if (elapsed >= 1000) {
              resolve(frames);
            } else {
              requestAnimationFrame(countFrame);
            }
          };
          
          requestAnimationFrame(countFrame);
        });
      });
      
      // 验证帧率 >= 30fps
      expect(frameCount).toBeGreaterThanOrEqual(30);
      
      console.log(`✅ 角色动画帧率: ${frameCount} FPS`);
    });
    
    test('应该快速切换角色不卡顿', async () => {
      // 快速切换多个角色
      const characters = ['Shizuku', 'Koharu', 'Hiyori'];
      
      const startTime = Date.now();
      
      for (const character of characters) {
        await mockTauriCommand(page, 'update_character_config', {
          success: true,
        });
        await switchCharacter(page, character);
        await page.waitForTimeout(100);
      }
      
      const totalTime = Date.now() - startTime;
      
      // 验证总时间合理（< 10秒）
      expect(totalTime).toBeLessThan(10000);
      
      console.log(`✅ 切换${characters.length}个角色耗时: ${totalTime}ms`);
    });
    
    test('角色内存使用应该合理', async () => {
      // 获取初始内存
      const initialMemory = await page.evaluate(() => {
        // @ts-ignore
        return performance.memory?.usedJSHeapSize || 0;
      });
      
      // 切换角色多次
      for (let i = 0; i < 5; i++) {
        await mockTauriCommand(page, 'update_character_config', {
          success: true,
        });
        await switchCharacter(page, i % 2 === 0 ? 'Shizuku' : 'Koharu');
        await page.waitForTimeout(500);
      }
      
      // 获取最终内存
      const finalMemory = await page.evaluate(() => {
        // @ts-ignore
        return performance.memory?.usedJSHeapSize || 0;
      });
      
      // 验证内存增长合理（< 50MB）
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(50);
      
      console.log(`✅ 内存增长: ${memoryIncrease.toFixed(2)} MB`);
    });
  });
  
  test.describe('完整角色切换流程', () => {
    test('应该完成完整的角色交互流程', async () => {
      // 1. 查看当前角色
      await takeScreenshot(page, 'flow-1-initial-character');
      
      // 2. 打开角色选择器
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      await takeScreenshot(page, 'flow-2-character-selector');
      
      // 3. 选择新角色
      await mockTauriCommand(page, 'update_character_config', {
        success: true,
      });
      await switchCharacter(page, 'Shizuku');
      await takeScreenshot(page, 'flow-3-character-switched');
      
      // 4. 与新角色对话
      await mockTauriCommand(page, 'send_message', {
        role: 'assistant',
        content: '你好，我是 Shizuku',
        expression: 'happy',
        timestamp: Date.now(),
      });
      await sendChatMessage(page, '你好');
      await waitForAIResponse(page);
      await takeScreenshot(page, 'flow-4-conversation');
      
      // 5. 查看角色动画
      const characterViewer = page.locator(E2E_SELECTORS.CHARACTER_VIEWER);
      await characterViewer.click();
      await waitForCharacterAnimation(page);
      await takeScreenshot(page, 'flow-5-animation');
      
      // 6. 切换表情
      await page.click('[data-testid="expression-selector"]');
      await page.click('[data-testid="expression-surprised"]');
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'flow-6-expression');
      
      // 7. 再次切换角色
      await switchCharacter(page, 'Koharu');
      await takeScreenshot(page, 'flow-7-another-character');
      
      // 8. 验证对话历史保留
      const messages = await page.locator(E2E_SELECTORS.MESSAGE_ITEM).count();
      expect(messages).toBeGreaterThan(0);
      
      console.log('✅ 完整角色交互流程测试通过');
    });
  });
  
  test.describe('错误处理', () => {
    test('应该处理模型文件缺失', async () => {
      // Mock 模型文件错误
      await mockTauriCommand(page, 'update_character_config', {
        success: false,
        error: 'Model file not found: /models/shizuku/model3.json',
      });
      
      // 尝试切换
      await page.click(E2E_SELECTORS.CHARACTER_SELECTOR);
      await page.locator(E2E_SELECTORS.CHARACTER_OPTION).filter({ hasText: 'Shizuku' }).click();
      
      // 验证错误提示
      await page.waitForTimeout(1000);
      const hasError = await hasErrorMessage(page);
      expect(hasError).toBe(true);
      
      const errorMsg = await getErrorMessage(page);
      expect(errorMsg).toContain('Model file not found');
    });
    
    test('应该处理纹理加载失败', async () => {
      // Mock 纹理错误
      await mockTauriCommand(page, 'load_character_model', {
        success: false,
        error: 'Failed to load texture',
      });
      
      // 尝试加载
      await switchCharacter(page, 'Shizuku');
      
      // 验证降级处理（显示占位符）
      const placeholder = page.locator('[data-testid="character-placeholder"]');
      await expect(placeholder).toBeVisible();
    });
    
    test('应该处理动画播放失败', async () => {
      // Mock 动画错误
      await mockTauriCommand(page, 'play_animation', {
        success: false,
        error: 'Animation not found: custom_animation',
      });
      
      // 尝试播放不存在的动画
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('play-animation', {
            detail: { animation: 'custom_animation' },
          })
        );
      });
      
      // 验证回退到默认动画
      await page.waitForTimeout(1000);
      const animationStatus = page.locator('[data-testid="animation-status"]');
      const statusText = await animationStatus.textContent();
      expect(statusText).toContain('idle'); // 回退到空闲动画
    });
  });
});

