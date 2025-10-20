/**
 * Playwright E2E 测试配置
 * 用于 Tauri 桌面应用的端到端测试
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * 从环境变量读取配置
 */
const CI = !!process.env.CI;
const PORT = process.env.PORT || 1420;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',
  
  // 测试匹配模式
  testMatch: '**/*.spec.ts',
  
  // 并行执行测试
  fullyParallel: !CI,
  
  // CI 环境不允许失败重试
  forbidOnly: CI,
  
  // 失败重试次数
  retries: CI ? 2 : 0,
  
  // 并行 worker 数量
  workers: CI ? 1 : undefined,
  
  // 测试报告
  reporter: [
    ['html', { outputFolder: 'tests/e2e/report' }],
    ['json', { outputFile: 'tests/e2e/report/results.json' }],
    ['junit', { outputFile: 'tests/e2e/report/junit.xml' }],
    ['list'],
  ],
  
  // 全局超时
  timeout: 60000,
  
  // 全局设置
  use: {
    // 基础 URL
    baseURL: BASE_URL,
    
    // 追踪配置 - 仅在失败时保留
    trace: 'retain-on-failure',
    
    // 截图配置 - 仅在失败时截图
    screenshot: 'only-on-failure',
    
    // 视频配置 - 仅在失败时录制
    video: 'retain-on-failure',
    
    // 操作超时
    actionTimeout: 10000,
    
    // 导航超时
    navigationTimeout: 30000,
    
    // 视口大小
    viewport: { width: 1280, height: 720 },
    
    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,
    
    // 区域设置
    locale: 'zh-CN',
    
    // 时区
    timezoneId: 'Asia/Shanghai',
  },
  
  // 输出目录
  outputDir: 'tests/e2e/results',
  
  // 全局设置钩子
  globalSetup: path.join(__dirname, 'tests/e2e/global-setup.ts'),
  
  // 全局清理钩子
  globalTeardown: path.join(__dirname, 'tests/e2e/global-teardown.ts'),
  
  // Web Server 配置 (用于开发模式)
  webServer: CI
    ? undefined
    : {
        command: 'npm run dev',
        port: Number(PORT),
        timeout: 120000,
        reuseExistingServer: true,
      },
  
  // 项目配置 - 针对不同平台
  projects: [
    {
      name: 'Desktop App',
      use: {
        ...devices['Desktop Chrome'],
        // Tauri 应用特定配置
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
    },
  ],
});
