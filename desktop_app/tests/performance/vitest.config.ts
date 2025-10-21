/**
 * 性能测试专用 Vitest 配置
 * 
 * 针对性能测试优化的配置，包括：
 * - 更长的超时时间
 * - 串行执行（避免测试间相互干扰）
 * - 性能监控工具
 */

import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../../vitest.config'

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // 性能测试单独运行，不与其他测试并行
      include: ['tests/performance/**/*.test.{ts,tsx}'],
      
      // 性能测试设置
      testTimeout: 30000, // 30秒超时（某些性能测试需要更长时间）
      hookTimeout: 10000, // 10秒钩子超时
      
      // 串行执行测试，避免性能测试相互影响
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true, // 单进程执行
        },
      },
      
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
      
      // 性能测试时的环境变量
      env: {
        PERFORMANCE_TEST: 'true',
      },
      
      // 禁用隔离，提高性能测试准确性
      isolate: false,
      
      // 性能测试不使用线程池
      threads: false,
      
      // 性能测试序列化执行
      sequence: {
        shuffle: false, // 不随机顺序
        concurrent: false, // 不并发执行
      },
    },
  })
)



