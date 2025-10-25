import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 性能测试配置
 * 专门用于性能测试，与常规 E2E 测试分离
 */
export default defineConfig({
  // 性能测试目录
  testDir: './src/tests/performance',

  // 测试匹配模式
  testMatch: '**/*.{perf,bench}.test.ts',

  // 性能测试通常不需要完全并行
  fullyParallel: false,

  // 性能测试不应该重试（需要一致的环境）
  retries: 0,

  // 单线程运行以保证性能测试的准确性
  workers: 1,

  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'playwright-report/performance', open: 'never' }],
    ['json', { outputFile: 'playwright-report/performance/results.json' }],
    ['list'],
  ],

  // 共享配置
  use: {
    // 基础 URL
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // 追踪配置 - 性能测试不需要追踪
    trace: 'off',

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频配置 - 性能测试不需要视频
    video: 'off',

    // 浏览器上下文选项
    viewport: { width: 1920, height: 1080 },

    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,

    // 超时配置 - 性能测试需要更长的超时
    actionTimeout: 30 * 1000, // 30秒
    navigationTimeout: 60 * 1000, // 60秒
  },

  // 全局超时配置 - 性能测试可能需要更长时间
  timeout: 120 * 1000, // 单个测试 120秒超时
  expect: {
    timeout: 30 * 1000, // 断言 30秒超时
  },

  // 项目配置 - 性能测试只在 Chromium 上运行
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        // 确保使用稳定的浏览器配置
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
          ],
        },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],

  // 开发服务器配置
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});

