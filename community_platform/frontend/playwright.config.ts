import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 测试目录
  testDir: './src/tests/e2e',
  
  // 测试匹配模式
  testMatch: '**/*.spec.ts',

  // 完全并行运行测试
  fullyParallel: true,

  // CI 上失败时禁止重试
  forbidOnly: !!process.env['CI'],

  // CI 上重试失败的测试
  retries: process.env['CI'] ? 2 : 0,

  // 工作线程数量
  workers: process.env['CI'] ? 1 : undefined,

  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
    ['list'],
  ],

  // 共享配置
  use: {
    // 基础 URL
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:3000',

    // 追踪配置
    trace: 'on-first-retry',

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频配置
    video: 'retain-on-failure',

    // 浏览器上下文选项
    viewport: { width: 1280, height: 720 },
    
    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,

    // 超时配置
    actionTimeout: 10 * 1000, // 10秒
    navigationTimeout: 30 * 1000, // 30秒
  },

  // 全局超时配置
  timeout: 60 * 1000, // 单个测试 60秒超时
  expect: {
    timeout: 10 * 1000, // 断言 10秒超时
  },

  // 项目配置 - 多浏览器测试
  projects: [
    // 桌面浏览器
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

    // 移动浏览器
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // 平板设备
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },

    // 认证测试专用配置
    {
      name: 'chromium-authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // 开发服务器配置
  webServer: process.env['CI']
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env['CI'],
        timeout: 120 * 1000, // 2分钟启动超时
        stdout: 'ignore',
        stderr: 'pipe',
      },

  // 全局设置和清理
  globalSetup: './src/tests/e2e/helpers/global-setup.ts',
  globalTeardown: './src/tests/e2e/helpers/global-teardown.ts',
});

