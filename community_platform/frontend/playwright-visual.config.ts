import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 视觉回归测试配置
 * 专门用于视觉回归测试，独立于 E2E 测试配置
 * @see https://playwright.dev/docs/test-snapshots
 */
export default defineConfig({
  // 视觉测试目录
  testDir: './src/tests/visual',
  
  // 测试匹配模式
  testMatch: '**/*.visual.test.ts',

  // 并行运行测试
  fullyParallel: true,

  // CI 上失败时禁止重试
  forbidOnly: !!process.env['CI'],

  // 失败重试次数（视觉测试建议不重试，除非网络问题）
  retries: 0,

  // 工作线程数量
  workers: process.env['CI'] ? 2 : undefined,

  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'playwright-visual-report', open: 'never' }],
    ['json', { outputFile: 'playwright-visual-report/results.json' }],
    ['list'],
    // 如果使用 Percy，可以添加 Percy reporter
    // ['@percy/playwright'],
  ],

  // 共享配置
  use: {
    // 基础 URL
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] || 'http://localhost:3000',

    // 追踪配置 - 视觉测试关闭追踪以提高性能
    trace: 'off',

    // 截图配置 - 视觉测试不需要失败截图，因为本身就在比对截图
    screenshot: 'off',

    // 视频配置 - 关闭以提高性能
    video: 'off',

    // 浏览器上下文选项
    viewport: { width: 1280, height: 720 },
    
    // 忽略 HTTPS 错误
    ignoreHTTPSErrors: true,

    // 超时配置
    actionTimeout: 15 * 1000, // 15秒
    navigationTimeout: 30 * 1000, // 30秒
  },

  // 全局超时配置
  timeout: 90 * 1000, // 单个测试 90秒超时（视觉测试可能需要更长时间）
  expect: {
    timeout: 15 * 1000, // 断言 15秒超时
    
    // 截图比对配置
    toHaveScreenshot: {
      // 最大像素差异数量（可接受的不同像素数）
      maxDiffPixels: 100,
      
      // 最大像素差异百分比
      maxDiffPixelRatio: 0.01, // 1%
      
      // 阈值：0-1 之间，值越小越严格
      threshold: 0.2,
      
      // 动画：等待动画完成
      animations: 'disabled',
      
      // 截图规模
      scale: 'css',
    },
  },

  // 项目配置 - 多浏览器和多分辨率测试
  projects: [
    // 桌面 - Chromium
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    
    // 桌面 - Firefox
    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    
    // 桌面 - Safari
    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // 移动设备 - iPhone
    {
      name: 'Mobile iPhone 12',
      use: {
        ...devices['iPhone 12'],
      },
    },
    
    // 移动设备 - Android
    {
      name: 'Mobile Pixel 5',
      use: {
        ...devices['Pixel 5'],
      },
    },

    // 平板设备 - iPad
    {
      name: 'Tablet iPad Pro',
      use: {
        ...devices['iPad Pro'],
      },
    },

    // 不同主题和状态测试
    {
      name: 'Dark Mode Desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark',
      },
    },

    // 高分辨率显示
    {
      name: 'Desktop Chrome 4K',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 2,
      },
    },

    // 小屏幕桌面
    {
      name: 'Desktop Chrome Small',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],

  // 开发服务器配置
  webServer: process.env['CI']
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env['CI'],
        timeout: 120 * 1000,
        stdout: 'ignore',
        stderr: 'pipe',
      },

  // 全局设置
  globalSetup: './src/tests/visual/helpers/global-setup.ts',
  
  // 截图存储路径
  snapshotDir: './src/tests/visual/__screenshots__',
  
  // 输出目录
  outputDir: './playwright-visual-output',
});

