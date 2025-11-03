import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  test: {
    // 测试环境
    environment: 'jsdom',
    
    // 全局测试设置
    globals: true,
    
    // 测试覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
        'src/**/*.d.ts',
        'src/examples/**',
        'src/tests/**',
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
    
    // 测试文件匹配模式 - 集成测试
    include: [
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.integration.{test,spec}.{ts,tsx}',
    ],
    
    // 排除的文件
    exclude: [
      'node_modules',
      'dist',
      'build',
      '.idea',
      '.git',
      '.cache',
      'tests/unit/**',
      'tests/e2e/**',
    ],
    
    // 设置文件
    setupFiles: ['./tests/setup.ts'],
    
    // 测试超时时间 - 集成测试需要更长时间
    testTimeout: 30000,
    
    // Hook 超时时间
    hookTimeout: 30000,
    
    // 是否在测试结束后清理 mock
    clearMocks: true,
    
    // 是否在每个测试前重置 mock
    mockReset: true,
    
    // 是否在每个测试前恢复 mock
    restoreMocks: true,
    
    // 测试隔离
    isolate: true,
    
    // 并发测试
    threads: false, // 集成测试建议串行执行
    
    // 监视模式配置
    watch: false,
    
    // 报告器
    reporters: ['verbose'],
    
    // 别名
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
});
