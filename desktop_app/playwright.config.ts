import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 
 * 用于测试完整的用户交互流程
 */
export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',
  
  // 全局测试超时
  timeout: 30 * 1000,
  
  // 期望超时
  expect: {
    timeout: 5000,
  },
  
  // 失败时重试次数
  retries: process.env.CI ? 2 : 0,
  
  // 并行工作进程数
  workers: process.env.CI ? 1 : undefined,
  
  // 报告器配置
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
  
  // 全局设置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:1424',
    
    // 浏览器上下文选项
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,
    
    // 视口大小
    viewport: { width: 1280, height: 720 },
    
    // 用户代理
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  
  // 项目配置 - 测试不同浏览器
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Web 服务器配置
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1424',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  
  // 输出目录
  outputDir: 'test-results/',
  
  // 全局设置文件
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
});
