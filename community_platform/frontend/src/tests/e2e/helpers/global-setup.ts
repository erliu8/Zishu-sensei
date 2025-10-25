import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * 全局测试设置
 * 在所有测试运行之前执行
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 开始全局设置...');

  // 创建必要的目录
  const authDir = path.join(process.cwd(), 'playwright/.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 创建测试报告目录
  const reportDir = path.join(process.cwd(), 'playwright-report');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // 预认证用户（可选）
  // 这样可以在测试中复用认证状态，加快测试速度
  const baseURL = config.use?.baseURL || 'http://localhost:3000';
  
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // 访问登录页面
    await page.goto(`${baseURL}/login`);
    
    // 执行登录（如果有测试账号）
    const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'test123456';
    
    // 填写登录表单
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    
    // 等待登录成功
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
      console.log('⚠️  预认证失败，将在测试中进行认证');
    });
    
    // 保存认证状态
    await page.context().storageState({ 
      path: path.join(authDir, 'user.json') 
    });
    
    await browser.close();
    console.log('✅ 用户认证状态已保存');
  } catch (error) {
    console.log('⚠️  无法预认证，测试将独立处理认证');
  }

  console.log('✅ 全局设置完成');
}

export default globalSetup;

