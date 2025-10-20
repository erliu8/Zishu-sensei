/**
 * 内存泄漏测试套件
 * 
 * 测试组件是否正确清理资源，防止内存泄漏
 * 
 * 测试要点:
 * - 事件监听器清理
 * - 定时器清理
 * - Live2D 资源释放
 * - 订阅清理
 * - DOM 引用清理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../utils/test-utils'
import { ChatWindow } from '@/components/Chat/ChatWindow'
import { MessageList } from '@/components/Chat/MessageList'
import { Chat } from '@/components/Chat'
import type { ChatMessage } from '@/types/chat'

// ==================== 测试工具 ====================

/**
 * 监控事件监听器
 */
class EventListenerMonitor {
  private originalAddEventListener: any
  private originalRemoveEventListener: any
  private listeners: Map<string, number> = new Map()

  install() {
    this.originalAddEventListener = EventTarget.prototype.addEventListener
    this.originalRemoveEventListener = EventTarget.prototype.removeEventListener

    EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
      const current = EventListenerMonitor.instance.listeners.get(type) || 0
      EventListenerMonitor.instance.listeners.set(type, current + 1)
      return EventListenerMonitor.instance.originalAddEventListener.call(this, type, listener, options)
    }

    EventTarget.prototype.removeEventListener = function(type: string, listener: any, options?: any) {
      const current = EventListenerMonitor.instance.listeners.get(type) || 0
      EventListenerMonitor.instance.listeners.set(type, Math.max(0, current - 1))
      return EventListenerMonitor.instance.originalRemoveEventListener.call(this, type, listener, options)
    }
  }

  uninstall() {
    EventTarget.prototype.addEventListener = this.originalAddEventListener
    EventTarget.prototype.removeEventListener = this.originalRemoveEventListener
  }

  getListenerCount(type?: string): number {
    if (type) {
      return this.listeners.get(type) || 0
    }
    return Array.from(this.listeners.values()).reduce((sum, count) => sum + count, 0)
  }

  reset() {
    this.listeners.clear()
  }

  static instance = new EventListenerMonitor()
}

/**
 * 监控定时器
 */
class TimerMonitor {
  private activeTimers: Set<number> = new Set()
  private activeIntervals: Set<number> = new Set()
  private originalSetTimeout: any
  private originalSetInterval: any
  private originalClearTimeout: any
  private originalClearInterval: any

  install() {
    this.originalSetTimeout = global.setTimeout
    this.originalSetInterval = global.setInterval
    this.originalClearTimeout = global.clearTimeout
    this.originalClearInterval = global.clearInterval

    global.setTimeout = ((...args: any[]) => {
      const id = this.originalSetTimeout(...args)
      this.activeTimers.add(id)
      return id
    }) as any

    global.setInterval = ((...args: any[]) => {
      const id = this.originalSetInterval(...args)
      this.activeIntervals.add(id)
      return id
    }) as any

    global.clearTimeout = ((id: number) => {
      this.activeTimers.delete(id)
      return this.originalClearTimeout(id)
    }) as any

    global.clearInterval = ((id: number) => {
      this.activeIntervals.delete(id)
      return this.originalClearInterval(id)
    }) as any
  }

  uninstall() {
    global.setTimeout = this.originalSetTimeout
    global.setInterval = this.originalSetInterval
    global.clearTimeout = this.originalClearTimeout
    global.clearInterval = this.originalClearInterval
  }

  getActiveTimerCount(): number {
    return this.activeTimers.size
  }

  getActiveIntervalCount(): number {
    return this.activeIntervals.size
  }

  getTotalActiveCount(): number {
    return this.activeTimers.size + this.activeIntervals.size
  }

  reset() {
    // 清理所有活动的定时器和间隔
    this.activeTimers.forEach(id => this.originalClearTimeout(id))
    this.activeIntervals.forEach(id => this.originalClearInterval(id))
    this.activeTimers.clear()
    this.activeIntervals.clear()
  }
}

/**
 * 监控 requestAnimationFrame
 */
class RAFMonitor {
  private activeRAFs: Set<number> = new Set()
  private originalRequestAnimationFrame: any
  private originalCancelAnimationFrame: any

  install() {
    this.originalRequestAnimationFrame = global.requestAnimationFrame
    this.originalCancelAnimationFrame = global.cancelAnimationFrame

    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const id = this.originalRequestAnimationFrame(callback)
      this.activeRAFs.add(id)
      return id
    }) as any

    global.cancelAnimationFrame = ((id: number) => {
      this.activeRAFs.delete(id)
      return this.originalCancelAnimationFrame(id)
    }) as any
  }

  uninstall() {
    global.requestAnimationFrame = this.originalRequestAnimationFrame
    global.cancelAnimationFrame = this.originalCancelAnimationFrame
  }

  getActiveRAFCount(): number {
    return this.activeRAFs.size
  }

  reset() {
    this.activeRAFs.forEach(id => this.originalCancelAnimationFrame(id))
    this.activeRAFs.clear()
  }
}

/**
 * 生成测试消息
 */
function generateMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    content: `测试消息 ${i}`,
    sender: i % 2 === 0 ? 'user' : 'assistant',
    timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
    role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
    status: 'sent' as const,
  }))
}

// ==================== 测试套件 ====================

describe('内存泄漏测试', () => {
  
  let eventMonitor: EventListenerMonitor
  let timerMonitor: TimerMonitor
  let rafMonitor: RAFMonitor

  beforeEach(() => {
    eventMonitor = EventListenerMonitor.instance
    timerMonitor = new TimerMonitor()
    rafMonitor = new RAFMonitor()

    eventMonitor.install()
    timerMonitor.install()
    rafMonitor.install()
  })

  afterEach(() => {
    eventMonitor.uninstall()
    timerMonitor.uninstall()
    rafMonitor.uninstall()

    eventMonitor.reset()
    timerMonitor.reset()
    rafMonitor.reset()
  })

  // ==================== 事件监听器清理测试 ====================
  
  describe('事件监听器清理', () => {
    
    it('ChatWindow 卸载后应该清理所有事件监听器', async () => {
      const beforeCount = eventMonitor.getListenerCount()

      const { unmount } = render(
        <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
      )

      await waitFor(() => {
        expect(eventMonitor.getListenerCount()).toBeGreaterThan(beforeCount)
      })

      const duringCount = eventMonitor.getListenerCount()

      unmount()

      await waitFor(() => {
        const afterCount = eventMonitor.getListenerCount()
        expect(afterCount).toBeLessThanOrEqual(beforeCount)
      }, { timeout: 1000 })

      console.log(`ChatWindow - 挂载前: ${beforeCount}, 挂载中: ${duringCount}, 卸载后: ${eventMonitor.getListenerCount()}`)
    })

    it('MessageList 卸载后应该清理滚动事件监听器', async () => {
      const messages = generateMessages(100)
      const scrollListenersBefore = eventMonitor.getListenerCount('scroll')

      const { unmount } = renderWithProviders(
        <MessageList
          messages={messages}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      await waitFor(() => {
        const scrollListenersDuring = eventMonitor.getListenerCount('scroll')
        expect(scrollListenersDuring).toBeGreaterThanOrEqual(scrollListenersBefore)
      })

      unmount()

      await waitFor(() => {
        const scrollListenersAfter = eventMonitor.getListenerCount('scroll')
        expect(scrollListenersAfter).toBeLessThanOrEqual(scrollListenersBefore)
      })

      console.log(`MessageList scroll 监听器 - 挂载前: ${scrollListenersBefore}, 卸载后: ${eventMonitor.getListenerCount('scroll')}`)
    })

    it('多次挂载和卸载不应该累积事件监听器', async () => {
      const iterations = 5
      const initialCount = eventMonitor.getListenerCount()

      for (let i = 0; i < iterations; i++) {
        const { unmount } = render(
          <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
        )

        await waitFor(() => {
          expect(eventMonitor.getListenerCount()).toBeGreaterThan(initialCount)
        })

        unmount()

        await waitFor(() => {
          const currentCount = eventMonitor.getListenerCount()
          expect(currentCount).toBeLessThanOrEqual(initialCount + 2) // 允许少量波动
        })
      }

      const finalCount = eventMonitor.getListenerCount()
      console.log(`多次挂载卸载 - 初始: ${initialCount}, 最终: ${finalCount}`)
      
      expect(finalCount).toBeLessThanOrEqual(initialCount + 2)
    })
  })

  // ==================== 定时器清理测试 ====================
  
  describe('定时器清理', () => {
    
    it('组件卸载后应该清理所有 setTimeout', async () => {
      const beforeCount = timerMonitor.getActiveTimerCount()

      const { unmount } = render(
        <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
      )

      await waitFor(() => {
        // 组件可能创建了定时器
        expect(timerMonitor.getTotalActiveCount()).toBeGreaterThanOrEqual(beforeCount)
      })

      const duringCount = timerMonitor.getActiveTimerCount()

      unmount()

      await waitFor(() => {
        const afterCount = timerMonitor.getActiveTimerCount()
        expect(afterCount).toBeLessThanOrEqual(beforeCount)
      }, { timeout: 2000 })

      console.log(`定时器 - 挂载前: ${beforeCount}, 挂载中: ${duringCount}, 卸载后: ${timerMonitor.getActiveTimerCount()}`)
    })

    it('组件卸载后应该清理所有 setInterval', async () => {
      const beforeCount = timerMonitor.getActiveIntervalCount()

      const { unmount } = render(
        <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
      )

      // 等待组件初始化
      await new Promise(resolve => setTimeout(resolve, 100))

      unmount()

      await waitFor(() => {
        const afterCount = timerMonitor.getActiveIntervalCount()
        expect(afterCount).toBeLessThanOrEqual(beforeCount)
      }, { timeout: 2000 })

      console.log(`间隔定时器 - 挂载前: ${beforeCount}, 卸载后: ${timerMonitor.getActiveIntervalCount()}`)
    })

    it('流式响应组件应该正确清理定时器', async () => {
      const messages: ChatMessage[] = [{
        id: 'streaming-msg',
        content: '流式消息...',
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        role: 'assistant',
        status: 'sending',
      }]

      const beforeCount = timerMonitor.getTotalActiveCount()

      const { unmount } = renderWithProviders(
        <MessageList
          messages={messages}
          isStreaming={true}
          streamingMessageId="streaming-msg"
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      unmount()

      await waitFor(() => {
        const afterCount = timerMonitor.getTotalActiveCount()
        expect(afterCount).toBeLessThanOrEqual(beforeCount + 1) // 允许测试框架的定时器
      }, { timeout: 2000 })

      console.log(`流式响应定时器 - 挂载前: ${beforeCount}, 卸载后: ${timerMonitor.getTotalActiveCount()}`)
    })
  })

  // ==================== requestAnimationFrame 清理测试 ====================
  
  describe('requestAnimationFrame 清理', () => {
    
    it('组件卸载后应该取消所有 requestAnimationFrame', async () => {
      const beforeCount = rafMonitor.getActiveRAFCount()

      const { unmount } = render(
        <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
      )

      // 等待可能的动画帧请求
      await new Promise(resolve => setTimeout(resolve, 100))

      unmount()

      await waitFor(() => {
        const afterCount = rafMonitor.getActiveRAFCount()
        expect(afterCount).toBeLessThanOrEqual(beforeCount)
      }, { timeout: 1000 })

      console.log(`RAF - 挂载前: ${beforeCount}, 卸载后: ${rafMonitor.getActiveRAFCount()}`)
    })

    it('动画组件应该正确清理 RAF', async () => {
      const messages = generateMessages(10)

      const { unmount, rerender } = renderWithProviders(
        <MessageList
          messages={messages}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      // 触发可能的动画更新
      const newMessages = [...messages, generateMessages(1)[0]]
      rerender(
        <MessageList
          messages={newMessages}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      const beforeUnmount = rafMonitor.getActiveRAFCount()
      
      unmount()

      await waitFor(() => {
        const afterUnmount = rafMonitor.getActiveRAFCount()
        expect(afterUnmount).toBeLessThanOrEqual(beforeUnmount)
      }, { timeout: 1000 })

      console.log(`动画RAF - 卸载前: ${beforeUnmount}, 卸载后: ${rafMonitor.getActiveRAFCount()}`)
    })
  })

  // ==================== DOM 引用清理测试 ====================
  
  describe('DOM 引用清理', () => {
    
    it('卸载后不应该保留 DOM 节点引用', async () => {
      const { container, unmount } = renderWithProviders(
        <MessageList
          messages={generateMessages(50)}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const messageElements = container.querySelectorAll('[class*="message"]')
      expect(messageElements.length).toBeGreaterThan(0)

      unmount()

      await waitFor(() => {
        // 容器应该为空
        expect(container.innerHTML).toBe('')
      })
    })

    it('虚拟滚动组件卸载后应该清理所有 DOM 节点', async () => {
      const { container, unmount } = renderWithProviders(
        <MessageList
          messages={generateMessages(1000)}
          enableVirtualScroll={true}
          virtualScrollThreshold={100}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const childCountBefore = container.childNodes.length
      expect(childCountBefore).toBeGreaterThan(0)

      unmount()

      await waitFor(() => {
        expect(container.childNodes.length).toBe(0)
      })

      console.log(`虚拟滚动DOM节点 - 挂载时: ${childCountBefore}, 卸载后: ${container.childNodes.length}`)
    })
  })

  // ==================== 长时间运行测试 ====================
  
  describe('长时间运行测试', () => {
    
    it('长时间运行不应该导致内存持续增长', async () => {
      // 获取初始内存（如果可用）
      const getMemory = () => (performance as any).memory?.usedJSHeapSize || 0
      
      const memorySnapshots: number[] = []
      const iterations = 20
      const messagesPerIteration = 50

      for (let i = 0; i < iterations; i++) {
        const messages = generateMessages(messagesPerIteration)
        
        const { unmount } = renderWithProviders(
          <MessageList
            messages={messages}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )

        await new Promise(resolve => setTimeout(resolve, 50))
        
        unmount()

        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc()
        }

        await new Promise(resolve => setTimeout(resolve, 50))

        memorySnapshots.push(getMemory())
      }

      if (memorySnapshots[0] > 0) {
        // 计算内存增长趋势
        const firstQuarter = memorySnapshots.slice(0, 5)
        const lastQuarter = memorySnapshots.slice(-5)
        
        const avgFirst = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length
        const avgLast = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length
        
        const memoryGrowth = avgLast - avgFirst
        const memoryGrowthMB = memoryGrowth / 1024 / 1024

        console.log(`长时间运行内存增长: ${memoryGrowthMB.toFixed(2)}MB`)
        console.log(`初始平均: ${(avgFirst / 1024 / 1024).toFixed(2)}MB`)
        console.log(`最终平均: ${(avgLast / 1024 / 1024).toFixed(2)}MB`)

        // 内存增长应该小于 20MB
        expect(memoryGrowthMB).toBeLessThan(20)
      } else {
        console.log('Performance.memory API 不可用，跳过内存增长测试')
      }
    }, 30000) // 30秒超时

    it('持续更新消息不应该导致内存泄漏', async () => {
      const getMemory = () => (performance as any).memory?.usedJSHeapSize || 0
      
      const messages = generateMessages(100)
      
      const { rerender, unmount } = renderWithProviders(
        <MessageList
          messages={messages}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const memoryBefore = getMemory()
      
      // 持续更新 50 次
      for (let i = 0; i < 50; i++) {
        const updatedMessages = [...messages, ...generateMessages(1)]
        
        rerender(
          <MessageList
            messages={updatedMessages}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )

        await new Promise(resolve => setTimeout(resolve, 20))
      }

      const memoryDuring = getMemory()
      
      unmount()

      if (global.gc) {
        global.gc()
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const memoryAfter = getMemory()

      if (memoryBefore > 0) {
        const memoryIncrease = (memoryDuring - memoryBefore) / 1024 / 1024
        const memoryFreed = (memoryDuring - memoryAfter) / 1024 / 1024

        console.log(`持续更新 - 内存增长: ${memoryIncrease.toFixed(2)}MB`)
        console.log(`持续更新 - 释放内存: ${memoryFreed.toFixed(2)}MB`)

        // 内存增长应该合理
        expect(memoryIncrease).toBeLessThan(30)
        
        // 应该释放大部分内存
        if (memoryIncrease > 0) {
          expect(memoryFreed / memoryIncrease).toBeGreaterThan(0.7)
        }
      }
    }, 20000)
  })

  // ==================== 订阅和观察者清理测试 ====================
  
  describe('订阅和观察者清理', () => {
    
    it('IntersectionObserver 应该被正确清理', async () => {
      const observeCount: { current: number } = { current: 0 }
      const disconnectCount: { current: number } = { current: 0 }

      const OriginalIntersectionObserver = global.IntersectionObserver
      
      global.IntersectionObserver = class MockIntersectionObserver {
        observe() {
          observeCount.current++
        }
        unobserve() {}
        disconnect() {
          disconnectCount.current++
        }
        takeRecords() {
          return []
        }
      } as any

      const messages = generateMessages(100)
      
      const { unmount } = renderWithProviders(
        <MessageList
          messages={messages}
          hasMore={true}
          onLoadMore={vi.fn()}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      unmount()

      await waitFor(() => {
        // 每个 observe 应该有对应的 disconnect
        expect(disconnectCount.current).toBeGreaterThan(0)
      })

      console.log(`IntersectionObserver - observe: ${observeCount.current}, disconnect: ${disconnectCount.current}`)

      global.IntersectionObserver = OriginalIntersectionObserver
    })

    it('ResizeObserver 应该被正确清理', async () => {
      const observeCount: { current: number } = { current: 0 }
      const disconnectCount: { current: number } = { current: 0 }

      const OriginalResizeObserver = global.ResizeObserver
      
      global.ResizeObserver = class MockResizeObserver {
        observe() {
          observeCount.current++
        }
        unobserve() {}
        disconnect() {
          disconnectCount.current++
        }
      } as any

      const { unmount } = render(
        <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      unmount()

      await waitFor(() => {
        // 如果使用了 ResizeObserver，应该被清理
        if (observeCount.current > 0) {
          expect(disconnectCount.current).toBeGreaterThan(0)
        }
      })

      console.log(`ResizeObserver - observe: ${observeCount.current}, disconnect: ${disconnectCount.current}`)

      global.ResizeObserver = OriginalResizeObserver
    })
  })
})


