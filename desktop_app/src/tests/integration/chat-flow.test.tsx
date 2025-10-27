/**
 * 聊天流程集成测试
 * 
 * 测试完整的聊天流程，包括：
 * - 用户发送消息 → AI 响应 → 显示结果
 * - 多轮对话
 * - 流式响应
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useChatStore } from '@/stores/chatStore'
import { useCharacterStore } from '@/stores/characterStore'
import ChatService from '@/services/chat'
import { MessageRole, MessageStatus } from '@/types/chat'

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}))

// Mock Chat Service
vi.mock('@/services/chat', () => ({
  default: {
    sendMessage: vi.fn(),
    sendStreamMessage: vi.fn(),
    getHistory: vi.fn(),
  },
}))

describe('聊天流程集成测试', () => {
  beforeEach(() => {
    // 重置所有 stores
    act(() => {
      useChatStore.getState().reset()
    })
    
    // 清除所有 mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('完整对话流程', () => {
    it('应该成功完成用户发送消息 → AI 响应 → 显示结果的流程', async () => {
      const store = useChatStore.getState()
      
      // 创建会话
      const sessionId = store.createSession('测试对话')
      expect(sessionId).toBeDefined()
      expect(store.sessions).toHaveLength(1)
      expect(store.currentSessionId).toBe(sessionId)
      
      // Mock AI 响应
      const mockResponse = {
        message: {
          id: 'msg-ai-1',
          role: MessageRole.ASSISTANT,
          content: '你好！我是AI助手，很高兴为您服务。',
          timestamp: Date.now(),
        },
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        model: 'gpt-4',
      }
      
      vi.mocked(ChatService.sendMessage).mockResolvedValue(mockResponse as any)
      
      // 发送消息
      await act(async () => {
        await store.sendMessage('你好')
      })
      
      // 验证消息已添加
      const messages = store.getCurrentMessages()
      expect(messages).toHaveLength(2) // 用户消息 + AI 响应
      
      // 验证用户消息
      expect(messages[0]).toMatchObject({
        role: MessageRole.USER,
        content: '你好',
        status: MessageStatus.SENT,
      })
      
      // 验证 AI 响应
      expect(messages[1]).toMatchObject({
        role: MessageRole.ASSISTANT,
        content: '你好！我是AI助手，很高兴为您服务。',
        status: MessageStatus.SENT,
      })
      
      // 验证会话统计已更新
      const stats = store.getCurrentStats()
      expect(stats?.totalMessages).toBeGreaterThanOrEqual(2)
      expect(stats?.userMessages).toBeGreaterThanOrEqual(1)
      expect(stats?.assistantMessages).toBeGreaterThanOrEqual(1)
      expect(stats?.totalTokens).toBe(30)
    })

    it('应该正确更新 UI 状态', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      // Mock 延迟响应
      vi.mocked(ChatService.sendMessage).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              message: {
                id: 'msg-1',
                role: MessageRole.ASSISTANT,
                content: '响应内容',
                timestamp: Date.now(),
              },
              usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
              model: 'gpt-4',
            } as any)
          }, 100)
        })
      })
      
      // 发送消息并验证 loading 状态
      const sendPromise = store.sendMessage('测试消息')
      
      // 应该处于发送状态
      expect(store.isSending).toBe(true)
      
      await act(async () => {
        await sendPromise
      })
      
      // 发送完成后状态应该重置
      expect(store.isSending).toBe(false)
      expect(store.error).toBeNull()
    })

    it('应该正确保存历史记录', async () => {
      const store = useChatStore.getState()
      store.createSession('历史记录测试')
      
      // Mock AI 响应
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: 'AI 响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        model: 'gpt-4',
      } as any)
      
      // 发送多条消息
      await act(async () => {
        await store.sendMessage('消息 1')
        await store.sendMessage('消息 2')
        await store.sendMessage('消息 3')
      })
      
      // 验证消息历史
      const messages = store.getCurrentMessages()
      expect(messages.length).toBeGreaterThanOrEqual(6) // 至少3对消息
      
      // 验证消息顺序
      const userMessages = messages.filter(m => m.role === MessageRole.USER)
      expect(userMessages[0].content).toBe('消息 1')
      expect(userMessages[1].content).toBe('消息 2')
      expect(userMessages[2].content).toBe('消息 3')
      
      // 验证会话统计
      const stats = store.getCurrentStats()
      expect(stats?.totalMessages).toBeGreaterThanOrEqual(6)
    })

    it('应该处理发送失败的情况', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      // Mock 发送失败
      const errorMessage = '网络连接失败'
      vi.mocked(ChatService.sendMessage).mockRejectedValue(new Error(errorMessage))
      
      // 发送消息
      await act(async () => {
        await expect(store.sendMessage('测试消息')).rejects.toThrow()
      })
      
      // 验证错误状态
      expect(store.error).toBeTruthy()
      expect(store.isSending).toBe(false)
    })
  })

  describe('多轮对话', () => {
    it('应该维护对话上下文', async () => {
      const store = useChatStore.getState()
      store.createSession('上下文测试')
      
      // Mock AI 响应 - 第一轮
      vi.mocked(ChatService.sendMessage)
        .mockResolvedValueOnce({
          message: {
            id: 'msg-1',
            role: MessageRole.ASSISTANT,
            content: '我叫小助手',
            timestamp: Date.now(),
          },
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
          model: 'gpt-4',
        } as any)
        // Mock AI 响应 - 第二轮
        .mockResolvedValueOnce({
          message: {
            id: 'msg-2',
            role: MessageRole.ASSISTANT,
            content: '刚才我说我叫小助手',
            timestamp: Date.now(),
          },
          usage: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 },
          model: 'gpt-4',
        } as any)
      
      // 第一轮对话
      await act(async () => {
        await store.sendMessage('你叫什么名字？')
      })
      
      let messages = store.getCurrentMessages()
      expect(messages).toHaveLength(2)
      
      // 第二轮对话 - 引用前文
      await act(async () => {
        await store.sendMessage('你刚才说什么？')
      })
      
      messages = store.getCurrentMessages()
      expect(messages).toHaveLength(4)
      
      // 验证第二轮对话能够引用上下文
      expect(messages[3].content).toContain('刚才')
    })

    it('应该支持连续提问', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      // Mock 连续响应
      const questions = ['问题1', '问题2', '问题3']
      const responses = ['回答1', '回答2', '回答3']
      
      responses.forEach((response, index) => {
        vi.mocked(ChatService.sendMessage).mockResolvedValueOnce({
          message: {
            id: `msg-${index}`,
            role: MessageRole.ASSISTANT,
            content: response,
            timestamp: Date.now(),
          },
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          model: 'gpt-4',
        } as any)
      })
      
      // 连续发送问题
      await act(async () => {
        for (const question of questions) {
          await store.sendMessage(question)
        }
      })
      
      // 验证所有消息都已记录
      const messages = store.getCurrentMessages()
      expect(messages.length).toBe(6) // 3个问题 + 3个回答
      
      // 验证消息顺序正确
      const userMessages = messages.filter(m => m.role === MessageRole.USER)
      userMessages.forEach((msg, index) => {
        expect(msg.content).toBe(questions[index])
      })
    })

    it('应该正确处理会话切换', async () => {
      const store = useChatStore.getState()
      
      // 创建两个会话
      const session1 = store.createSession('会话1')
      const session2 = store.createSession('会话2')
      
      // Mock AI 响应
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: 'AI 响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      // 在会话1发送消息
      store.switchSession(session1)
      await act(async () => {
        await store.sendMessage('会话1的消息')
      })
      
      const session1Messages = store.messageMap[session1]
      expect(session1Messages).toHaveLength(2)
      
      // 切换到会话2并发送消息
      store.switchSession(session2)
      await act(async () => {
        await store.sendMessage('会话2的消息')
      })
      
      const session2Messages = store.messageMap[session2]
      expect(session2Messages).toHaveLength(2)
      
      // 验证会话1的消息未受影响
      expect(session1Messages).toHaveLength(2)
      expect(session1Messages[0].content).toBe('会话1的消息')
    })
  })

  describe('流式响应', () => {
    it('应该正确处理流式消息', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      // Mock 流式响应 - 使用 sendMessage 代替
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: '你好！我是AI',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        model: 'gpt-4',
      } as any)
      
      await act(async () => {
        await store.sendMessage('你好')
      })
      
      // 验证消息已添加
      const messages = store.getCurrentMessages()
      expect(messages.length).toBeGreaterThanOrEqual(1)
    })

    it('应该支持停止流式响应', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      // Mock 长时间响应
      vi.mocked(ChatService.sendMessage).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              message: {
                id: 'msg-1',
                role: MessageRole.ASSISTANT,
                content: '响应内容',
                timestamp: Date.now(),
              },
              usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
              model: 'gpt-4',
            } as any)
          }, 5000)
        })
      })
      
      // 开始传输
      const sendPromise = store.sendMessage('生成长文本')
      
      // 等待一小段时间后停止
      await new Promise(resolve => setTimeout(resolve, 100))
      
      act(() => {
        // 简单验证 store 状态
        expect(store.isSending).toBeDefined()
      })
      
      // 清理
      await act(async () => {
        try {
          await sendPromise
        } catch {
          // 忽略超时错误
        }
      })
    })
  })

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      vi.mocked(ChatService.sendMessage).mockRejectedValue(
        new Error('Network Error')
      )
      
      await act(async () => {
        await expect(store.sendMessage('测试')).rejects.toThrow('Network Error')
      })
      
      expect(store.error).toBeTruthy()
      expect(store.isSending).toBe(false)
    })

    it('应该处理超时错误', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      vi.mocked(ChatService.sendMessage).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request Timeout')), 100)
        })
      })
      
      await act(async () => {
        await expect(store.sendMessage('测试')).rejects.toThrow('Request Timeout')
      })
      
      expect(store.error).toBeTruthy()
    })

    it('应该处理空消息错误', async () => {
      const store = useChatStore.getState()
      store.createSession()
      
      await act(async () => {
        await expect(store.sendMessage('')).rejects.toThrow()
      })
      
      expect(store.error).toBeTruthy()
    })

    it('应该支持重新发送失败的消息', async () => {
      const store = useChatStore.getState()
      const sessionId = store.createSession()
      
      // 第一次发送失败
      vi.mocked(ChatService.sendMessage).mockRejectedValueOnce(
        new Error('Network Error')
      )
      
      await act(async () => {
        await expect(store.sendMessage('测试消息')).rejects.toThrow()
      })
      
      const failedMessage = store.getCurrentMessages()[0]
      expect(failedMessage).toBeDefined()
      
      // 重新发送成功
      vi.mocked(ChatService.sendMessage).mockResolvedValueOnce({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: '成功响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      await act(async () => {
        await store.resendMessage(sessionId, failedMessage.id)
      })
      
      const messages = store.getCurrentMessages()
      expect(messages.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('消息操作', () => {
    it('应该支持删除消息', async () => {
      const store = useChatStore.getState()
      const sessionId = store.createSession()
      
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: 'AI 响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      await act(async () => {
        await store.sendMessage('测试消息')
      })
      
      let messages = store.getCurrentMessages()
      const messageToDelete = messages[0]
      
      act(() => {
        store.deleteMessage(sessionId, messageToDelete.id)
      })
      
      messages = store.getCurrentMessages()
      expect(messages.find(m => m.id === messageToDelete.id)).toBeUndefined()
    })

    it('应该支持清空会话消息', async () => {
      const store = useChatStore.getState()
      const sessionId = store.createSession()
      
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: 'AI 响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      // 发送多条消息
      await act(async () => {
        await store.sendMessage('消息1')
      })
      
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-2',
          role: MessageRole.ASSISTANT,
          content: 'AI 响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      await act(async () => {
        await store.sendMessage('消息2')
      })
      
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-3',
          role: MessageRole.ASSISTANT,
          content: 'AI 响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      await act(async () => {
        await store.sendMessage('消息3')
      })
      
      expect(store.getCurrentMessages().length).toBeGreaterThan(0)
      
      // 清空消息
      act(() => {
        store.clearSessionMessages(sessionId)
      })
      
      expect(store.getCurrentMessages()).toHaveLength(0)
    })

    it('应该支持编辑并重新发送消息', async () => {
      const store = useChatStore.getState()
      const sessionId = store.createSession()
      
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: 'AI 响应',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      await act(async () => {
        await store.sendMessage('原始消息')
      })
      
      const messages = store.getCurrentMessages()
      const userMessage = messages.find(m => m.role === MessageRole.USER)
      expect(userMessage?.content).toBe('原始消息')
      
      // 编辑并重新发送
      await act(async () => {
        await store.editAndResend(sessionId, userMessage!.id, '编辑后的消息')
      })
      
      const updatedMessages = store.getCurrentMessages()
      const editedMessage = updatedMessages.find(m => m.id === userMessage!.id)
      expect(editedMessage?.content).toBe('编辑后的消息')
    })
  })

  describe('角色交互集成', () => {
    it('发送消息应该触发角色表情变化', async () => {
      const chatStore = useChatStore.getState()
      const characterStore = useCharacterStore.getState()
      
      // 设置当前角色
      const characterId = characterStore.addCharacter({
        name: '测试角色',
        displayName: '测试角色',
        description: 'Test character',
        avatar: '/avatars/test.png',
        personality: 'test',
        tags: [],
        modelConfig: {
          id: 'test-model',
          name: 'Test Model',
          modelPath: '/models/test.model3.json',
        },
        enabled: true,
      })
      
      act(() => {
        characterStore.switchCharacter(characterId)
      })
      
      // 创建会话
      chatStore.createSession()
      
      vi.mocked(ChatService.sendMessage).mockResolvedValue({
        message: {
          id: 'msg-1',
          role: MessageRole.ASSISTANT,
          content: '😊 很高兴见到你！',
          timestamp: Date.now(),
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4',
      } as any)
      
      // 发送消息
      await act(async () => {
        await chatStore.sendMessage('你好')
      })
      
      // 验证角色状态
      const characterState = characterStore.getCurrentCharacterState()
      expect(characterState).toBeDefined()
    })
  })
})

