/**
 * Chat 组件测试环境设置
 * 
 * 统一配置 Chat 组件群的测试环境
 * @module Tests/Setup/Chat
 */

import { beforeAll, beforeEach, afterAll, afterEach, vi, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupChatMocks, cleanupChatMocks } from '@/tests/mocks/chat-mocks'
import { chatTestHelpers } from '@/tests/utils/chat-test-helpers'

// ==================== 全局测试设置 ====================

/**
 * 全局测试前设置
 */
beforeAll(() => {
  // 设置 Chat Mock
  setupChatMocks()
  
  // 模拟 ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
  
  // 模拟 IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }))
  
  // 模拟 PointerEvent
  global.PointerEvent = class PointerEvent extends Event {
    constructor(type: string, init?: PointerEventInit) {
      super(type, init)
    }
  } as any
  
  // 设置测试环境变量
  process.env.NODE_ENV = 'test'
  process.env.VITE_API_BASE_URL = 'http://localhost:3000'
  process.env.VITE_WS_URL = 'ws://localhost:3001'
  
  // 模拟 localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })
  
  // 模拟 sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
  })
  
  // 模拟 matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  
  // 设置默认视口
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  })
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768,
  })
  
  // 模拟 scrollTo
  window.scrollTo = vi.fn() as any
  
  // 模拟 requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
  global.cancelAnimationFrame = vi.fn()
  
  // 模拟 performance API
  Object.defineProperty(window, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
    },
  })
})

/**
 * 每个测试前设置
 */
beforeEach(() => {
  // 清理所有 Mock 调用记录
  vi.clearAllMocks()
  
  // 重置 localStorage
  window.localStorage.clear()
  window.sessionStorage.clear()
  
  // 重置视口大小
  window.innerWidth = 1024
  window.innerHeight = 768
  
  // 重置时间
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
})

/**
 * 每个测试后清理
 */
afterEach(() => {
  // 清理 DOM
  cleanup()
  
  // 恢复真实时间
  vi.useRealTimers()
  
  // 清理事件监听器
  document.removeEventListener = vi.fn()
  window.removeEventListener = vi.fn()
})

/**
 * 全局测试后清理
 */
afterAll(() => {
  // 清理所有 Mock
  cleanupChatMocks()
  
  // 恢复原始 API
  vi.restoreAllMocks()
})

// ==================== Chat 专用测试工具 ====================

/**
 * Chat 测试工具集
 */
export const chatTestUtils = {
  ...chatTestHelpers,
  
  // 快速创建测试环境
  createChatTestEnvironment: (options?: {
    sessions?: number
    messages?: number
    enableRealtime?: boolean
    enableVoice?: boolean
  }) => {
    const { 
      sessions = 3, 
      messages = 5, 
      enableRealtime = false, 
      enableVoice = false 
    } = options || {}
    
    return {
      sessions: chatTestHelpers.createTestSessions(sessions),
      messages: chatTestHelpers.createTestMessageSequence(messages),
      settings: {
        theme: 'auto',
        language: 'zh-CN',
        enableRealtime,
        enableVoice,
        autoSave: true,
      },
    }
  },
  
  // 模拟网络延迟
  simulateNetworkDelay: (ms: number = 1000) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },
  
  // 模拟网络错误
  simulateNetworkError: (type: 'timeout' | 'offline' | 'server_error' = 'server_error') => {
    const errors = {
      timeout: new Error('Request timeout'),
      offline: new Error('Network offline'),
      server_error: new Error('Internal server error'),
    }
    
    return Promise.reject(errors[type])
  },
  
  // 等待动画完成
  waitForAnimation: async (duration: number = 300) => {
    vi.advanceTimersByTime(duration)
    await new Promise(resolve => setTimeout(resolve, 0))
  },
  
  // 模拟用户交互序列
  simulateUserInteractionSequence: async (interactions: Array<{
    type: 'click' | 'type' | 'key' | 'hover'
    target: string
    value?: string
  }>, user: any) => {
    for (const interaction of interactions) {
      const element = document.querySelector(`[data-testid="${interaction.target}"]`)
      
      if (!element) {
        throw new Error(`Element with testid "${interaction.target}" not found`)
      }
      
      switch (interaction.type) {
        case 'click':
          await user.click(element)
          break
        case 'type':
          await user.type(element, interaction.value || '')
          break
        case 'key':
          await user.keyboard(interaction.value || '')
          break
        case 'hover':
          await user.hover(element)
          break
      }
      
      // 等待一小段时间模拟真实用户操作
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  },
}

// ==================== 自定义匹配器 ====================

/**
 * 扩展 expect 匹配器
 */
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toHaveMessage(messageId: string, content: string): T
      toHaveActiveSession(sessionId: string): T
      toBeConnected(): T
      toBeLoading(): T
      toHaveError(message?: string): T
    }
  }
}

// 注册自定义匹配器
expect.extend({
  toHaveMessage: chatTestHelpers.toHaveMessage,
  toHaveActiveSession: chatTestHelpers.toHaveActiveSession,
  
  toBeConnected(received: any) {
    const connectionStatus = received.querySelector('[data-testid="connection-status"]')
    const isConnected = connectionStatus?.textContent?.includes('已连接') || 
                       connectionStatus?.classList.contains('connected')
    
    return {
      pass: !!isConnected,
      message: () => isConnected 
        ? `Expected element not to be connected`
        : `Expected element to be connected`,
    }
  },
  
  toBeLoading(received: any) {
    const loadingIndicator = received.querySelector('[data-testid="loading-indicator"]') ||
                            received.querySelector('.loading')
    
    return {
      pass: !!loadingIndicator,
      message: () => loadingIndicator
        ? `Expected element not to be loading`
        : `Expected element to be loading`,
    }
  },
  
  toHaveError(received: any, expectedMessage?: string) {
    const errorElement = received.querySelector('[data-testid="error-indicator"]') ||
                        received.querySelector('[role="alert"]')
    
    if (!errorElement) {
      return {
        pass: false,
        message: () => `Expected element to have error`,
      }
    }
    
    if (expectedMessage) {
      const hasMessage = errorElement.textContent?.includes(expectedMessage)
      return {
        pass: !!hasMessage,
        message: () => hasMessage
          ? `Expected error not to contain "${expectedMessage}"`
          : `Expected error to contain "${expectedMessage}"`,
      }
    }
    
    return {
      pass: true,
      message: () => `Expected element not to have error`,
    }
  },
})

// ==================== 测试数据生成器 ====================

/**
 * 测试数据生成器
 */
export const testDataGenerator = {
  // 生成测试对话
  generateTestConversation: (length: number = 10) => {
    const conversation = []
    const topics = [
      '如何使用这个功能？',
      '我遇到了一个问题',
      '能帮我解释一下这个概念吗？',
      '有什么建议吗？',
    ]
    
    for (let i = 0; i < length; i++) {
      const isUser = i % 2 === 0
      
      if (isUser) {
        conversation.push({
          role: 'user',
          content: topics[Math.floor(Math.random() * topics.length)],
        })
      } else {
        conversation.push({
          role: 'assistant',
          content: `这是针对您问题的回答 ${Math.floor(i / 2) + 1}`,
        })
      }
    }
    
    return conversation
  },
  
  // 生成性能测试数据
  generatePerformanceTestData: (messageCount: number = 1000) => {
    return {
      sessions: Array.from({ length: 100 }, (_, i) => ({
        id: `perf-session-${i}`,
        title: `性能测试会话 ${i}`,
        messages: chatTestHelpers.createTestMessageSequence(messageCount / 100),
        createdAt: Date.now() - i * 86400000,
        updatedAt: Date.now() - i * 3600000,
      })),
      messages: chatTestHelpers.createTestMessageSequence(messageCount),
    }
  },
  
  // 生成错误测试场景
  generateErrorScenarios: () => {
    return [
      {
        name: '网络连接失败',
        error: new Error('Network connection failed'),
        type: 'network',
      },
      {
        name: '服务器错误',
        error: { status: 500, message: 'Internal server error' },
        type: 'server',
      },
      {
        name: '认证失败',
        error: { status: 401, message: 'Unauthorized' },
        type: 'auth',
      },
      {
        name: '请求超时',
        error: new Error('Request timeout'),
        type: 'timeout',
      },
    ]
  },
}

// ==================== 测试配置 ====================

/**
 * 测试配置
 */
export const chatTestConfig = {
  // 默认超时时间
  defaultTimeout: 5000,
  
  // 动画等待时间
  animationDuration: 300,
  
  // 网络延迟模拟时间
  networkDelay: 100,
  
  // 最大重试次数
  maxRetries: 3,
  
  // 测试环境标识
  isTestEnvironment: true,
  
  // API 端点
  apiEndpoints: {
    base: 'http://localhost:3000',
    websocket: 'ws://localhost:3001',
  },
}

export default {
  chatTestUtils,
  testDataGenerator,
  chatTestConfig,
}
