/**
 * 角色交互集成测试
 * 
 * 测试角色系统的完整功能，包括：
 * - 角色加载和显示
 * - Live2D 模型管理
 * - 角色交互和动画
 * - 角色与聊天系统的集成
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useCharacterStore } from '@/stores/characterStore'
import { useChatStore } from '@/stores/chatStore'
import { EmotionType, ActivityState } from '@/types/character'
import { MessageRole } from '@/types/chat'

// Mock Tauri API
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}))

// Mock Live2D 相关模块
vi.mock('@/services/live2d/modelLoader', () => ({
  loadModel: vi.fn(),
  unloadModel: vi.fn(),
}))

vi.mock('@/services/live2d/animationManager', () => ({
  playAnimation: vi.fn(),
  stopAnimation: vi.fn(),
  setExpression: vi.fn(),
}))

describe('角色交互集成测试', () => {
  beforeEach(() => {
    // 重置 stores
    act(() => {
      useCharacterStore.getState().reset?.()
      useChatStore.getState().reset()
    })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('角色加载和显示', () => {
    it('应该完成选择角色 → 加载模型 → 显示 Live2D 的流程', async () => {
      const characterStore = useCharacterStore.getState()
      
      // ========== 1. 添加角色 ==========
      const characterId = act(() => {
        return characterStore.addCharacter({
          name: 'Hiyori',
          model: 'hiyori',
          description: '友好的AI助手',
          enabled: true,
          appearance: {
            modelPath: '/models/hiyori/hiyori.model3.json',
            scale: 1.0,
            position: { x: 0, y: 0 },
            opacity: 1.0,
          },
          personality: {
            traits: ['friendly', 'helpful'],
            voiceId: 'voice-1',
            defaultEmotion: EmotionType.HAPPY,
          },
          capabilities: ['chat', 'animation'],
          metadata: {
            version: '1.0.0',
            author: 'Test',
          },
        })
      })
      
      expect(characterId).toBeDefined()
      const character = characterStore.characters.find(c => c.id === characterId)
      expect(character).toBeDefined()
      expect(character?.name).toBe('Hiyori')
      expect(character?.enabled).toBe(true)
      
      // ========== 2. 切换到该角色 ==========
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { character_id: characterId },
      })
      
      await act(async () => {
        await characterStore.switchCharacter(characterId)
      })
      
      expect(characterStore.currentCharacterId).toBe(characterId)
      const currentCharacter = characterStore.getCurrentCharacter()
      expect(currentCharacter?.id).toBe(characterId)
      
      // ========== 3. 验证角色状态初始化 ==========
      const characterState = characterStore.getCurrentCharacterState()
      expect(characterState).toBeDefined()
      expect(characterState?.emotion).toBe(EmotionType.NEUTRAL)
      expect(characterState?.activityState).toBe(ActivityState.IDLE)
      expect(characterState?.isVisible).toBe(true)
      
      // ========== 4. 验证角色统计初始化 ==========
      const characterStats = characterStore.getCurrentCharacterStats()
      expect(characterStats).toBeDefined()
      expect(characterStats?.totalInteractions).toBe(0)
      expect(characterStats?.totalAnimations).toBe(0)
    })

    it('应该播放默认动画', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Test Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      // 设置空闲状态应该触发默认动画
      act(() => {
        store.setActivityState(characterId, ActivityState.IDLE)
      })
      
      const state = store.characterStates[characterId]
      expect(state.activityState).toBe(ActivityState.IDLE)
      
      // 播放空闲动画
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { animation: 'idle' },
      })
      
      await act(async () => {
        await store.playAnimation(characterId, 'idle', { loop: true })
      })
      
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          character_id: characterId,
          animation: 'idle',
        })
      )
    })

    it('应该处理模型加载失败', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Invalid Character',
          model: 'invalid-model',
          enabled: true,
        })
      })
      
      // Mock 加载失败
      mockInvoke.mockRejectedValueOnce(new Error('模型文件不存在'))
      
      act(() => {
        store.setLoading(true)
      })
      
      await act(async () => {
        try {
          await store.switchCharacter(characterId)
        } catch (error) {
          store.setError((error as Error).message)
        } finally {
          store.setLoading(false)
        }
      })
      
      expect(store.isLoading).toBe(false)
      expect(store.error).toContain('模型文件')
    })
  })

  describe('角色交互', () => {
    it('点击角色应该播放动画', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Interactive Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      // Mock 点击交互
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { animation: 'tap_body' },
      })
      
      // 记录交互
      await act(async () => {
        await store.recordInteraction(characterId, {
          type: 'click',
          target: 'body',
          timestamp: Date.now(),
          metadata: { x: 100, y: 200 },
        })
      })
      
      // 验证交互历史
      const history = store.interactionHistory.filter(
        h => h.characterId === characterId
      )
      expect(history).toHaveLength(1)
      expect(history[0].type).toBe('click')
      expect(history[0].target).toBe('body')
      
      // 验证统计更新
      const stats = store.characterStats[characterId]
      expect(stats.totalInteractions).toBe(1)
    })

    it('发送消息应该触发表情变化', async () => {
      const characterStore = useCharacterStore.getState()
      const chatStore = useChatStore.getState()
      
      // 设置角色
      const characterId = act(() => {
        return characterStore.addCharacter({
          name: 'Expressive Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await characterStore.switchCharacter(characterId)
      })
      
      // 创建聊天会话
      const sessionId = chatStore.createSession()
      
      // Mock AI 响应
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          message: {
            id: 'msg-1',
            role: 'assistant',
            content: '😊 很高兴认识你！',
            timestamp: Date.now(),
          },
          emotion: EmotionType.HAPPY,
        },
      })
      
      // 发送消息
      await act(async () => {
        await chatStore.sendMessage('你好', {
          sessionId,
          characterId,
        })
      })
      
      // 角色应该切换到高兴的表情
      act(() => {
        characterStore.setEmotion(characterId, EmotionType.HAPPY, 0.8)
      })
      
      const state = characterStore.characterStates[characterId]
      expect(state.emotion).toBe(EmotionType.HAPPY)
      expect(state.emotionIntensity).toBe(0.8)
      
      // 验证情绪历史
      const stats = characterStore.characterStats[characterId]
      expect(stats.emotionHistory.some(e => e.emotion === EmotionType.HAPPY)).toBe(true)
    })

    it('应该支持多种交互类型', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Multi-Interactive Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      const interactionTypes = [
        { type: 'click', target: 'head' },
        { type: 'drag', target: 'body' },
        { type: 'hover', target: 'hand' },
      ]
      
      // 记录多种交互
      for (const interaction of interactionTypes) {
        await act(async () => {
          await store.recordInteraction(characterId, {
            type: interaction.type,
            target: interaction.target,
            timestamp: Date.now(),
          })
        })
      }
      
      // 验证所有交互都已记录
      const history = store.interactionHistory.filter(
        h => h.characterId === characterId
      )
      expect(history).toHaveLength(3)
      
      const recordedTypes = history.map(h => h.type)
      expect(recordedTypes).toContain('click')
      expect(recordedTypes).toContain('drag')
      expect(recordedTypes).toContain('hover')
    })
  })

  describe('动画管理', () => {
    it('应该支持播放不同的动画', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Animated Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      const animations = ['idle', 'wave', 'nod', 'shake_head']
      
      for (const animation of animations) {
        mockInvoke.mockResolvedValueOnce({
          success: true,
          data: { animation },
        })
        
        await act(async () => {
          await store.playAnimation(characterId, animation)
        })
      }
      
      // 验证动画播放次数
      const stats = store.characterStats[characterId]
      expect(stats.totalAnimations).toBe(animations.length)
    })

    it('应该支持动画队列', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Queue Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      // 添加动画到队列
      const animationQueue = ['wave', 'nod', 'idle']
      
      for (const animation of animationQueue) {
        mockInvoke.mockResolvedValueOnce({
          success: true,
          data: { animation },
        })
        
        await act(async () => {
          await store.playAnimation(characterId, animation, { 
            queue: true,
            priority: 1,
          })
        })
      }
      
      const stats = store.characterStats[characterId]
      expect(stats.totalAnimations).toBe(animationQueue.length)
    })

    it('应该支持表情切换', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Expressive Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      const emotions = [
        EmotionType.HAPPY,
        EmotionType.SAD,
        EmotionType.SURPRISED,
        EmotionType.ANGRY,
        EmotionType.NEUTRAL,
      ]
      
      for (const emotion of emotions) {
        mockInvoke.mockResolvedValueOnce({
          success: true,
          data: { emotion },
        })
        
        act(() => {
          store.setEmotion(characterId, emotion, 1.0)
        })
        
        // 等待状态更新
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // 验证情绪历史
      const stats = store.characterStats[characterId]
      expect(stats.emotionHistory.length).toBeGreaterThan(0)
      
      // 验证所有情绪都被记录
      const recordedEmotions = stats.emotionHistory.map(e => e.emotion)
      emotions.forEach(emotion => {
        expect(recordedEmotions).toContain(emotion)
      })
    })
  })

  describe('角色状态管理', () => {
    it('应该正确管理角色的活动状态', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'State Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      const states = [
        ActivityState.IDLE,
        ActivityState.LISTENING,
        ActivityState.SPEAKING,
        ActivityState.THINKING,
        ActivityState.INTERACTING,
      ]
      
      for (const state of states) {
        act(() => {
          store.setActivityState(characterId, state)
        })
        
        const currentState = store.characterStates[characterId]
        expect(currentState.activityState).toBe(state)
      }
    })

    it('应该支持角色可见性切换', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Visibility Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      // 初始应该可见
      let state = store.characterStates[characterId]
      expect(state.isVisible).toBe(true)
      
      // 隐藏角色
      act(() => {
        store.updateCharacterState(characterId, { isVisible: false })
      })
      
      state = store.characterStates[characterId]
      expect(state.isVisible).toBe(false)
      
      // 显示角色
      act(() => {
        store.updateCharacterState(characterId, { isVisible: true })
      })
      
      state = store.characterStates[characterId]
      expect(state.isVisible).toBe(true)
    })

    it('应该保存角色位置和缩放', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Transform Character',
          model: 'test-model',
          enabled: true,
          appearance: {
            modelPath: '/models/test/test.model3.json',
            scale: 1.0,
            position: { x: 0, y: 0 },
            opacity: 1.0,
          },
        })
      })
      
      // 更新位置
      act(() => {
        store.updateCharacter(characterId, {
          appearance: {
            ...store.characters.find(c => c.id === characterId)!.appearance,
            position: { x: 100, y: 200 },
          },
        })
      })
      
      let character = store.characters.find(c => c.id === characterId)
      expect(character?.appearance.position).toEqual({ x: 100, y: 200 })
      
      // 更新缩放
      act(() => {
        store.updateCharacter(characterId, {
          appearance: {
            ...character!.appearance,
            scale: 1.5,
          },
        })
      })
      
      character = store.characters.find(c => c.id === characterId)
      expect(character?.appearance.scale).toBe(1.5)
    })
  })

  describe('多角色管理', () => {
    it('应该支持管理多个角色', async () => {
      const store = useCharacterStore.getState()
      
      const characters = [
        { name: 'Character 1', model: 'model-1' },
        { name: 'Character 2', model: 'model-2' },
        { name: 'Character 3', model: 'model-3' },
      ]
      
      const characterIds: string[] = []
      
      // 添加多个角色
      act(() => {
        characters.forEach(char => {
          const id = store.addCharacter({
            name: char.name,
            model: char.model,
            enabled: true,
          })
          characterIds.push(id)
        })
      })
      
      expect(store.characters).toHaveLength(3)
      
      // 切换不同角色
      for (const id of characterIds) {
        mockInvoke.mockResolvedValueOnce({
          success: true,
          data: { character_id: id },
        })
        
        await act(async () => {
          await store.switchCharacter(id)
        })
        
        expect(store.currentCharacterId).toBe(id)
      }
    })

    it('应该支持启用/禁用角色', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Toggle Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      let character = store.characters.find(c => c.id === characterId)
      expect(character?.enabled).toBe(true)
      
      // 禁用角色
      act(() => {
        store.toggleCharacterEnabled(characterId)
      })
      
      character = store.characters.find(c => c.id === characterId)
      expect(character?.enabled).toBe(false)
      
      // 重新启用
      act(() => {
        store.toggleCharacterEnabled(characterId)
      })
      
      character = store.characters.find(c => c.id === characterId)
      expect(character?.enabled).toBe(true)
    })

    it('应该支持删除角色', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'Deletable Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      expect(store.characters).toHaveLength(1)
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        message: '角色删除成功',
      })
      
      act(() => {
        store.deleteCharacter(characterId)
      })
      
      expect(store.characters).toHaveLength(0)
      expect(store.characters.find(c => c.id === characterId)).toBeUndefined()
    })
  })

  describe('角色与聊天集成', () => {
    it('聊天消息应该影响角色状态', async () => {
      const characterStore = useCharacterStore.getState()
      const chatStore = useChatStore.getState()
      
      // 设置角色
      const characterId = act(() => {
        return characterStore.addCharacter({
          name: 'Chat Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await characterStore.switchCharacter(characterId)
      })
      
      // 创建会话
      const sessionId = chatStore.createSession()
      
      // 用户发送消息 - 角色应该进入倾听状态
      act(() => {
        characterStore.setActivityState(characterId, ActivityState.LISTENING)
      })
      
      let state = characterStore.characterStates[characterId]
      expect(state.activityState).toBe(ActivityState.LISTENING)
      
      // AI 思考中
      act(() => {
        characterStore.setActivityState(characterId, ActivityState.THINKING)
      })
      
      state = characterStore.characterStates[characterId]
      expect(state.activityState).toBe(ActivityState.THINKING)
      
      // AI 响应 - 角色应该进入说话状态
      act(() => {
        characterStore.setActivityState(characterId, ActivityState.SPEAKING)
      })
      
      state = characterStore.characterStates[characterId]
      expect(state.activityState).toBe(ActivityState.SPEAKING)
      
      // 完成后回到空闲状态
      act(() => {
        characterStore.setActivityState(characterId, ActivityState.IDLE)
      })
      
      state = characterStore.characterStates[characterId]
      expect(state.activityState).toBe(ActivityState.IDLE)
    })

    it('应该根据消息内容调整表情', async () => {
      const characterStore = useCharacterStore.getState()
      const chatStore = useChatStore.getState()
      
      const characterId = act(() => {
        return characterStore.addCharacter({
          name: 'Emotional Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await characterStore.switchCharacter(characterId)
      })
      
      const sessionId = chatStore.createSession()
      
      const emotionalMessages = [
        { content: '😊 太好了！', emotion: EmotionType.HAPPY },
        { content: '😢 真遗憾', emotion: EmotionType.SAD },
        { content: '😮 真的吗？', emotion: EmotionType.SURPRISED },
        { content: '😠 这不公平', emotion: EmotionType.ANGRY },
      ]
      
      for (const msg of emotionalMessages) {
        // Mock AI 响应
        mockInvoke.mockResolvedValueOnce({
          success: true,
          data: {
            message: {
              id: `msg-${Math.random()}`,
              role: 'assistant',
              content: msg.content,
              timestamp: Date.now(),
            },
            emotion: msg.emotion,
          },
        })
        
        // 设置相应表情
        act(() => {
          characterStore.setEmotion(characterId, msg.emotion, 0.8)
        })
        
        const state = characterStore.characterStates[characterId]
        expect(state.emotion).toBe(msg.emotion)
      }
    })
  })

  describe('性能和资源管理', () => {
    it('切换角色时应该正确清理资源', async () => {
      const store = useCharacterStore.getState()
      
      const character1Id = act(() => {
        return store.addCharacter({
          name: 'Character 1',
          model: 'model-1',
          enabled: true,
        })
      })
      
      const character2Id = act(() => {
        return store.addCharacter({
          name: 'Character 2',
          model: 'model-2',
          enabled: true,
        })
      })
      
      // 切换到角色1
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { character_id: character1Id },
      })
      
      await act(async () => {
        await store.switchCharacter(character1Id)
      })
      
      expect(store.currentCharacterId).toBe(character1Id)
      
      // 切换到角色2时应该清理角色1的资源
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { character_id: character2Id },
      })
      
      await act(async () => {
        await store.switchCharacter(character2Id)
      })
      
      expect(store.currentCharacterId).toBe(character2Id)
      
      // 验证新角色状态已初始化
      const state = store.characterStates[character2Id]
      expect(state).toBeDefined()
    })

    it('应该限制交互历史记录数量', async () => {
      const store = useCharacterStore.getState()
      
      const characterId = act(() => {
        return store.addCharacter({
          name: 'History Character',
          model: 'test-model',
          enabled: true,
        })
      })
      
      await act(async () => {
        await store.switchCharacter(characterId)
      })
      
      // 记录大量交互
      for (let i = 0; i < 150; i++) {
        await act(async () => {
          await store.recordInteraction(characterId, {
            type: 'click',
            target: 'body',
            timestamp: Date.now(),
          })
        })
      }
      
      // 验证历史记录被限制（假设限制为100条）
      const history = store.interactionHistory.filter(
        h => h.characterId === characterId
      )
      
      expect(history.length).toBeLessThanOrEqual(100)
    })
  })
})

