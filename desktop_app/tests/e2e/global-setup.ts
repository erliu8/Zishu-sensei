/**
 * Playwright 全局设置
 * 
 * 在所有 E2E 测试运行前执行
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 开始 E2E 测试全局设置...');
  
  // 启动浏览器实例进行预检查
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // 检查应用是否可访问
    console.log('📡 检查应用可访问性...');
    await page.goto('http://localhost:1424', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 等待应用加载完成
    await page.waitForSelector('[data-testid="app"]', { timeout: 10000 });
    console.log('✅ 应用加载成功');
    
    // 检查关键功能是否可用
    const characterElement = await page.$('[data-testid="character"]');
    if (characterElement) {
      console.log('✅ 角色组件加载成功');
    }
    
    const chatElement = await page.$('[data-testid="chat"]');
    if (chatElement) {
      console.log('✅ 聊天组件加载成功');
    }
    
  } catch (error) {
    console.error('❌ 全局设置失败:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('🎉 E2E 测试全局设置完成');
}

export default globalSetup;
