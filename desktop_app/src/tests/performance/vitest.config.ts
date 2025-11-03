/**
 * 性能测试专用 Vitest 配置
 * 
 * 针对性能测试优化的配置，包括：
 * - 更长的超时时间
 * - 串行执行（避免测试间相互干扰）
 * - 性能监控工具
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  
  test: {
    // 性能测试单独运行，不与其他测试并行
    include: ['src/tests/performance/**/*.test.{ts,tsx}'],
    
    // 性能测试设置
    testTimeout: 30000, // 30秒超时（某些性能测试需要更长时间）
    hookTimeout: 10000, // 10秒钩子超时
    
    // 性能测试通常不需要覆盖率
    coverage: {
      enabled: false,
    },
    
    // 性能测试环境配置
    environment: 'jsdom',
    
    // 全局配置
    globals: true,
    
    // 性能测试报告
    reporters: ['verbose'],
    
    // 设置文件
    setupFiles: ['./src/tests/setup.ts'],
    
    // 禁用隔离，提高性能测试准确性
    isolate: false,
    
    // 测试隔离
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../..'),
      '@components': path.resolve(__dirname, '../../../components'),
      '@hooks': path.resolve(__dirname, '../../../hooks'),
      '@services': path.resolve(__dirname, '../../../services'),
      '@stores': path.resolve(__dirname, '../../../stores'),
      '@utils': path.resolve(__dirname, '../../../utils'),
      '@types': path.resolve(__dirname, '../../../types'),
      '@styles': path.resolve(__dirname, '../../../styles'),
      '@assets': path.resolve(__dirname, '../../../assets'),
      '@tauri-apps/api/core': path.resolve(__dirname, '../../mocks/tauri-api.ts'),
    },
  },
})


