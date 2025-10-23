module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready',
      url: [
        'http://localhost:3000',
        'http://localhost:3000/posts',
        'http://localhost:3000/adapters',
        'http://localhost:3000/characters',
      ],
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // 性能指标
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['error', { maxNumericValue: 3800 }],

        // 核心分数
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],

        // 资源优化
        'modern-image-formats': 'warn',
        'offscreen-images': 'warn',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',

        // 可访问性
        'color-contrast': 'error',
        'image-alt': 'error',
        'button-name': 'error',
        'link-name': 'error',

        // 最佳实践
        'errors-in-console': 'warn',
        'no-vulnerable-libraries': 'error',
        'uses-https': 'error',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

