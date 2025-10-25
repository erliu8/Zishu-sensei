/**
 * Lighthouse CI 配置
 * 用于自动化 Lighthouse 性能测试
 */

module.exports = {
  ci: {
    collect: {
      // 要测试的 URL
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/content',
        'http://localhost:3000/learning',
      ],
      
      // 每个 URL 运行的次数
      numberOfRuns: 3,
      
      // 服务器配置
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'ready on',
      startServerReadyTimeout: 30000,
      
      // Lighthouse 设置
      settings: {
        // 仅收集性能数据
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
        
        // 桌面配置
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
        
        // 节流配置（模拟真实网络）
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    
    assert: {
      // 性能断言
      assertions: {
        // Core Web Vitals
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        
        // 特定指标
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['error', { maxNumericValue: 3000 }],
        'interactive': ['error', { maxNumericValue: 3500 }],
        
        // 资源优化
        'uses-text-compression': 'off',
        'uses-optimized-images': 'warn',
        'modern-image-formats': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': 'warn',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        
        // 缓存策略
        'uses-long-cache-ttl': 'warn',
        
        // 其他最佳实践
        'dom-size': 'warn',
        'bootup-time': ['warn', { maxNumericValue: 3500 }],
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 4000 }],
      },
    },
    
    upload: {
      // 上传到临时公共存储
      target: 'temporary-public-storage',
      
      // 或者上传到 Lighthouse CI 服务器
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: 'your-build-token',
    },
    
    // 服务器配置（如果使用 Lighthouse CI Server）
    // server: {
    //   port: 9001,
    //   storage: {
    //     storageMethod: 'sql',
    //     sqlDialect: 'sqlite',
    //     sqlDatabasePath: './lhci.db',
    //   },
    // },
  },
};
