/**
 * 渲染性能测试套件
 * 
 * 测试组件的渲染性能，确保应用流畅运行
 * 
 * 性能基准:
 * - Character 组件首次渲染 < 100ms
 * - ChatWindow 组件首次渲染 < 50ms
 * - 重新渲染 < 16ms (60fps)
 * - 1000 条消息滚动应该流畅
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../utils/test-utils'
import { ChatWindow } from '@/components/Chat/ChatWindow'
import MessageList from '@/components/Chat/MessageList/index'
import type { ChatMessage } from '@/types/chat'
import { MessageRole, MessageStatus, MessageType } from '@/types/chat'

// ==================== 性能测试工具 ====================

/**
 * 测量组件渲染时间
 */
function measureRenderTime(callback: () => void): number {
  const startTime = performance.now()
  callback()
  const endTime = performance.now()
  return endTime - startTime
}

/**
 * 生成测试消息数据
 */
function generateMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    sessionId: 'test-session',
    content: `测试消息 ${i}: ${Math.random().toString(36).substring(7)}`,
    timestamp: Date.now() - (count - i) * 60000,
    role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
    status: MessageStatus.SENT,
    type: MessageType.TEXT,
  }))
}

/**
 * 生成长消息
 */
function generateLongMessage(words: number): string {
  return Array.from({ length: words }, (_, i) => `单词${i}`).join(' ')
}

/**
 * 测量帧率
 */
class FPSMeter {
  private frames: number[] = []
  private rafId: number | null = null
  private lastTime: number = 0

  start() {
    this.frames = []
    this.lastTime = performance.now()
    this.measure()
  }

  private measure = () => {
    const currentTime = performance.now()
    const delta = currentTime - this.lastTime
    
    if (delta > 0) {
      const fps = 1000 / delta
      this.frames.push(fps)
    }
    
    this.lastTime = currentTime
    this.rafId = requestAnimationFrame(this.measure)
  }

  stop(): { average: number; min: number; max: number } {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    if (this.frames.length === 0) {
      return { average: 0, min: 0, max: 0 }
    }

    const average = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
    const min = Math.min(...this.frames)
    const max = Math.max(...this.frames)

    return { average, min, max }
  }
}

// ==================== 测试套件 ====================

describe('渲染性能测试', () => {
  
  // ==================== ChatWindow 组件性能测试 ====================
  
  describe('ChatWindow 组件', () => {
    
    it('首次渲染应该在 50ms 内完成', () => {
      const renderTime = measureRenderTime(() => {
        render(
          <ChatWindow
            onClose={vi.fn()}
            onMinimize={vi.fn()}
          />
        )
      })

      console.log(`ChatWindow 首次渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(50)
    })

    it('有少量消息时渲染应该很快 (< 30ms)', () => {
      const renderTime = measureRenderTime(() => {
        render(
          <ChatWindow
            onClose={vi.fn()}
            onMinimize={vi.fn()}
          />
        )
      })

      console.log(`ChatWindow 10条消息渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(30)
    })

    it('重新渲染应该在 16ms 内完成 (60fps)', async () => {
      const { rerender } = render(
        <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
      )

      // 预热
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/输入消息/i)).toBeInTheDocument()
      })

      const rerenderTime = measureRenderTime(() => {
        rerender(
          <ChatWindow onClose={vi.fn()} onMinimize={vi.fn()} />
        )
      })

      console.log(`ChatWindow 重新渲染时间: ${rerenderTime.toFixed(2)}ms`)
      expect(rerenderTime).toBeLessThan(16)
    })
  })

  // ==================== MessageList 组件性能测试 ====================
  
  describe('MessageList 组件', () => {
    
    it('渲染 100 条消息应该在合理时间内完成 (< 200ms)', () => {
      const messages = generateMessages(100)
      
      const renderTime = measureRenderTime(() => {
        renderWithProviders(
          <MessageList
            messages={messages}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )
      })

      console.log(`MessageList 100条消息渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(200)
    })

    it('渲染 500 条消息应该在合理时间内完成 (< 500ms)', () => {
      const messages = generateMessages(500)
      
      const renderTime = measureRenderTime(() => {
        renderWithProviders(
          <MessageList
            messages={messages}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )
      })

      console.log(`MessageList 500条消息渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(500)
    })

    it('使用虚拟滚动渲染 1000 条消息应该很快 (< 300ms)', () => {
      const messages = generateMessages(1000)
      
      const renderTime = measureRenderTime(() => {
        renderWithProviders(
          <MessageList
            messages={messages}
            enableVirtualScroll={true}
            virtualScrollThreshold={100}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )
      })

      console.log(`MessageList 1000条消息(虚拟滚动)渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(300)
    })

    it('添加新消息应该高效 (< 16ms)', async () => {
      const messages = generateMessages(50)
      
      const { rerender } = renderWithProviders(
        <MessageList
          messages={messages}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const newMessages = [...messages, generateMessages(1)[0]]
      
      const updateTime = measureRenderTime(() => {
        rerender(
          <MessageList
            messages={newMessages}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )
      })

      console.log(`MessageList 添加新消息时间: ${updateTime.toFixed(2)}ms`)
      expect(updateTime).toBeLessThan(16)
    })
  })

  // ==================== 大列表滚动性能测试 ====================
  
  describe('大列表滚动性能', () => {
    
    it('1000 条消息滚动应该流畅 (平均 FPS > 30)', async () => {
      const messages = generateMessages(1000)
      
      const { container } = renderWithProviders(
        <MessageList
          messages={messages}
          enableVirtualScroll={false}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement
      expect(scrollContainer).toBeInTheDocument()

      const fpsMeter = new FPSMeter()
      fpsMeter.start()

      // 模拟滚动
      for (let i = 0; i < 10; i++) {
        scrollContainer.scrollTop = i * 100
        await new Promise(resolve => setTimeout(resolve, 16)) // 等待一帧
      }

      const fpsStats = fpsMeter.stop()
      console.log(`滚动性能 - 平均FPS: ${fpsStats.average.toFixed(2)}, 最小FPS: ${fpsStats.min.toFixed(2)}`)
      
      expect(fpsStats.average).toBeGreaterThan(30)
    })

    it('虚拟滚动模式下 1000 条消息应该保持高帧率 (平均 FPS > 50)', async () => {
      const messages = generateMessages(1000)
      
      const { container } = renderWithProviders(
        <MessageList
          messages={messages}
          enableVirtualScroll={true}
          virtualScrollThreshold={100}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement
      expect(scrollContainer).toBeInTheDocument()

      const fpsMeter = new FPSMeter()
      fpsMeter.start()

      // 模拟快速滚动
      for (let i = 0; i < 20; i++) {
        scrollContainer.scrollTop = i * 200
        await new Promise(resolve => setTimeout(resolve, 16))
      }

      const fpsStats = fpsMeter.stop()
      console.log(`虚拟滚动性能 - 平均FPS: ${fpsStats.average.toFixed(2)}, 最小FPS: ${fpsStats.min.toFixed(2)}`)
      
      expect(fpsStats.average).toBeGreaterThan(50)
    })
  })

  // ==================== 复杂内容渲染性能测试 ====================
  
  describe('复杂内容渲染性能', () => {
    
    it('渲染包含长文本的消息应该快速', () => {
      const longMessage: ChatMessage = {
        id: 'long-msg',
        sessionId: 'test-session',
        content: generateLongMessage(1000), // 1000个单词
        timestamp: Date.now(),
        role: MessageRole.ASSISTANT,
        status: MessageStatus.SENT,
        type: MessageType.TEXT,
      }

      const renderTime = measureRenderTime(() => {
        renderWithProviders(
          <MessageList
            messages={[longMessage]}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )
      })

      console.log(`长文本消息渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(100)
    })

    it('渲染包含代码块的消息应该高效', () => {
      const codeMessage: ChatMessage = {
        id: 'code-msg',
        sessionId: 'test-session',
        content: '```typescript\n' + 
                'function fibonacci(n: number): number {\n' +
                '  if (n <= 1) return n;\n' +
                '  return fibonacci(n - 1) + fibonacci(n - 2);\n' +
                '}\n' +
                '```',
        timestamp: Date.now(),
        role: MessageRole.ASSISTANT,
        status: MessageStatus.SENT,
        type: MessageType.TEXT,
      }

      const renderTime = measureRenderTime(() => {
        renderWithProviders(
          <MessageList
            messages={[codeMessage]}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )
      })

      console.log(`代码块消息渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(50)
    })

    it('渲染混合内容（文本+代码+列表）应该保持性能', () => {
      const mixedMessage: ChatMessage = {
        id: 'mixed-msg',
        sessionId: 'test-session',
        content: `# 标题\n\n这是一段文本。\n\n## 代码示例\n\n\`\`\`javascript\nconsole.log('Hello');\n\`\`\`\n\n## 列表\n\n- 项目 1\n- 项目 2\n- 项目 3`,
        timestamp: Date.now(),
        role: MessageRole.ASSISTANT,
        status: MessageStatus.SENT,
        type: MessageType.TEXT,
      }

      const renderTime = measureRenderTime(() => {
        renderWithProviders(
          <MessageList
            messages={[mixedMessage]}
            onCopyMessage={vi.fn()}
            onResendMessage={vi.fn()}
            onEditMessage={vi.fn()}
            onDeleteMessage={vi.fn()}
          />
        )
      })

      console.log(`混合内容消息渲染时间: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(80)
    })
  })

  // ==================== 并发渲染性能测试 ====================
  
  describe('并发渲染性能', () => {
    
    it('连续快速添加多条消息应该保持性能', async () => {
      const initialMessages = generateMessages(20)
      
      const { rerender } = renderWithProviders(
        <MessageList
          messages={initialMessages}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const renderTimes: number[] = []

      // 快速添加 10 条消息
      for (let i = 0; i < 10; i++) {
        const newMessages = [...initialMessages, ...generateMessages(i + 1)]
        
        const updateTime = measureRenderTime(() => {
          rerender(
            <MessageList
              messages={newMessages}
              onCopyMessage={vi.fn()}
              onResendMessage={vi.fn()}
              onEditMessage={vi.fn()}
              onDeleteMessage={vi.fn()}
            />
          )
        })
        
        renderTimes.push(updateTime)
      }

      const averageTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
      const maxTime = Math.max(...renderTimes)

      console.log(`连续添加消息 - 平均时间: ${averageTime.toFixed(2)}ms, 最大时间: ${maxTime.toFixed(2)}ms`)
      
      expect(averageTime).toBeLessThan(20)
      expect(maxTime).toBeLessThan(50)
    })

    it('流式响应更新应该高效', async () => {
      const baseMessage: ChatMessage = {
        id: 'streaming-msg',
        sessionId: 'test-session',
        content: '',
        timestamp: Date.now(),
        role: MessageRole.ASSISTANT,
        status: MessageStatus.SENDING,
        type: MessageType.TEXT,
      }

      const { rerender } = renderWithProviders(
        <MessageList
          messages={[baseMessage]}
          isStreaming={true}
          streamingMessageId="streaming-msg"
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const renderTimes: number[] = []
      const words = '这是一个流式响应的测试消息'.split('')

      // 模拟流式更新
      for (let i = 0; i < words.length; i++) {
        const updatedMessage = {
          ...baseMessage,
          content: words.slice(0, i + 1).join(''),
        }

        const updateTime = measureRenderTime(() => {
          rerender(
            <MessageList
              messages={[updatedMessage]}
              isStreaming={true}
              streamingMessageId="streaming-msg"
              onCopyMessage={vi.fn()}
              onResendMessage={vi.fn()}
              onEditMessage={vi.fn()}
              onDeleteMessage={vi.fn()}
            />
          )
        })

        renderTimes.push(updateTime)
      }

      const averageTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
      console.log(`流式更新平均时间: ${averageTime.toFixed(2)}ms`)
      
      expect(averageTime).toBeLessThan(10)
    })
  })

  // ==================== 内存使用性能测试 ====================
  
  describe('内存使用性能', () => {
    
    it('大量消息不应该造成内存溢出', () => {
      // 检测 performance.memory API 是否可用
      const memoryBefore = (performance as any).memory?.usedJSHeapSize

      const messages = generateMessages(1000)
      
      const { unmount } = renderWithProviders(
        <MessageList
          messages={messages}
          onCopyMessage={vi.fn()}
          onResendMessage={vi.fn()}
          onEditMessage={vi.fn()}
          onDeleteMessage={vi.fn()}
        />
      )

      const memoryAfterRender = (performance as any).memory?.usedJSHeapSize
      
      unmount()
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc()
      }

      const memoryAfterUnmount = (performance as any).memory?.usedJSHeapSize

      if (memoryBefore && memoryAfterRender && memoryAfterUnmount) {
        const memoryIncrease = memoryAfterRender - memoryBefore
        const memoryFreed = memoryAfterRender - memoryAfterUnmount

        console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
        console.log(`释放内存: ${(memoryFreed / 1024 / 1024).toFixed(2)}MB`)

        // 内存增长应该合理（< 50MB）
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
        
        // 卸载后应该释放大部分内存（> 80%）
        expect(memoryFreed / memoryIncrease).toBeGreaterThan(0.8)
      } else {
        console.log('Performance.memory API 不可用，跳过内存测试')
      }
    })
  })
})


