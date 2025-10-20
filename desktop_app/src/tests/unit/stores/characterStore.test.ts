/**
 * 角色状态管理 Store 测试
 * 
 * 测试角色状态管理的所有功能，包括：
 * - 角色管理（添加、更新、删除、切换）
 * - 状态管理（情绪、活动状态等）
 * - 动画控制（播放、停止、表情等）
 * - 交互管理（记录、处理交互）
 * - Live2D 管理（模型实例、动画管理器等）
 * - 统计和分析
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { 
  useCharacterStore,
  type CharacterStore,
  type Character,
  type CharacterState,
  type CharacterStats,
  type InteractionRecord,
  EmotionType,
  ActivityState,
  useCurrentCharacter,
  useCharacterList,
  useCharacterActions,
  useCharacterAnimation,
  useCharacterInteraction
} from '@/stores/characterStore'
import { Live2DAnimationState } from '@/types/live2d'
import type { Live2DModelConfig } from '@/types/live2d'
import type { Live2DModelInstance } from '@/services/live2d/loader'
import type { Live2DAnimationManager } from '@/services/live2d/animation'
import { AnimationType, type AnimationConfig } from '@/services/live2d/animation'
import { InteractionType } from '@/services/live2d/interaction'
import type { Live2DInteractionManager, InteractionEventData } from '@/services/live2d/interaction'

// Mock dependencies
vi.mock('zustand/middleware', () => ({
  devtools: vi.fn((fn) => fn),
  persist: vi.fn((fn, options) => fn),
  subscribeWithSelector: vi.fn((fn) => fn),
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-id')
}))

// ==================== 测试数据工厂 ====================

const createMockLive2DModelConfig = (overrides: Partial<Live2DModelConfig> = {}): Live2DModelConfig => ({
  name: 'test-model',
  path: '/models/test',
  scale: 1.0,
  position: { x: 0, y: 0 },
  ...overrides,
})

const createMockCharacter = (overrides: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Character, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'test-character',
  displayName: 'Test Character',
  description: 'A test character',
  avatar: '/avatars/test.png',
  personality: 'Friendly and helpful',
  tags: ['test', 'friendly'],
  modelConfig: createMockLive2DModelConfig(),
  enabled: true,
  ...overrides,
})

const createMockCharacterState = (overrides: Partial<CharacterState> = {}): CharacterState => ({
  emotion: EmotionType.NEUTRAL,
  emotionIntensity: 0.5,
  activityState: ActivityState.IDLE,
  animationState: Live2DAnimationState.IDLE,
  isInteractive: true,
  health: 100,
  mood: 80,
  energy: 100,
  affection: 50,
  lastInteractionTime: Date.now(),
  lastSpeakTime: 0,
  totalInteractions: 0,
  ...overrides,
})

const createMockCharacterStats = (overrides: Partial<CharacterStats> = {}): CharacterStats => ({
  totalInteractions: 0,
  totalConversations: 0,
  totalOnlineTime: 0,
  averageMood: 80,
  averageEnergy: 100,
  emotionHistory: [],
  ...overrides,
})

const createMockAnimationConfig = (overrides: Partial<AnimationConfig> = {}): AnimationConfig => ({
  group: 'test-animation',
  index: 0,
  priority: 1,
  fadeInTime: 0.5,
  fadeOutTime: 0.5,
  loop: false,
  ...overrides,
})

const createMockInteractionEventData = (overrides: Partial<InteractionEventData> = {}): InteractionEventData => ({
  type: InteractionType.CLICK,
  position: { x: 100, y: 100 },
  timestamp: Date.now(),
  data: {},
  ...overrides,
})

const createMockModelInstance = (): jest.Mocked<Live2DModelInstance> => ({
  model: {
    expression: vi.fn(),
  } as any,
  canvas: document.createElement('canvas'),
  dispose: vi.fn(),
} as any)

const createMockAnimationManager = (): jest.Mocked<Live2DAnimationManager> => ({
  playAnimation: vi.fn(),
  playRandomAnimationByType: vi.fn(),
  stopAnimation: vi.fn(),
} as any)

const createMockInteractionManager = (): jest.Mocked<Live2DInteractionManager> => ({
  handleInteraction: vi.fn(),
} as any)

// ==================== 测试套件 ====================

describe('CharacterStore', () => {
  beforeEach(() => {
    // 重置 Store
    act(() => {
      useCharacterStore.getState().reset()
    })
    
    // 重置所有 mocks
    vi.clearAllMocks()
  })

  // ==================== 初始状态测试 ====================
  
  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useCharacterStore.getState()
      
      expect(state.characters).toEqual([])
      expect(state.currentCharacterId).toBeNull()
      expect(state.characterStates).toEqual({})
      expect(state.characterStats).toEqual({})
      expect(state.interactionHistory).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.modelInstances).toEqual({})
      expect(state.animationManagers).toEqual({})
      expect(state.interactionManagers).toEqual({})
    })

    it('计算属性应该返回正确的初始值', () => {
      const state = useCharacterStore.getState()
      
      expect(state.getCurrentCharacter()).toBeNull()
      expect(state.getCurrentCharacterState()).toBeNull()
      expect(state.getCurrentCharacterStats()).toBeNull()
      expect(state.getEnabledCharacters()).toEqual([])
    })
  })

  // ==================== 角色管理测试 ====================

  describe('角色管理', () => {
    it('应该正确添加角色', () => {
      const characterData = createMockCharacter({
        name: 'test-character',
        displayName: 'Test Character'
      })
      
      let characterId: string
      
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(characterData)
      })
      
      const state = useCharacterStore.getState()
      
      expect(state.characters).toHaveLength(1)
      expect(characterId).toBe('mock-id')
      
      const character = state.characters[0]
      expect(character.id).toBe('mock-id')
      expect(character.name).toBe('test-character')
      expect(character.displayName).toBe('Test Character')
      expect(character.createdAt).toBeDefined()
      expect(character.updatedAt).toBeDefined()
      
      // 应该创建默认状态和统计
      expect(state.characterStates['mock-id']).toBeDefined()
      expect(state.characterStats['mock-id']).toBeDefined()
      
      // 第一个角色应该自动设为当前角色
      expect(state.currentCharacterId).toBe('mock-id')
    })

    it('添加第二个角色时不应改变当前角色', () => {
      act(() => {
        useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'character1' }))
      })
      
      const firstCharacterId = useCharacterStore.getState().currentCharacterId
      
      act(() => {
        useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'character2' }))
      })
      
      expect(useCharacterStore.getState().currentCharacterId).toBe(firstCharacterId)
      expect(useCharacterStore.getState().characters).toHaveLength(2)
    })

    it('应该正确更新角色', () => {
      let characterId: string
      
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
      
      const updateData = {
        displayName: 'Updated Character',
        description: 'Updated description'
      }
      
      act(() => {
        useCharacterStore.getState().updateCharacter(characterId!, updateData)
      })
      
      const character = useCharacterStore.getState().characters[0]
      expect(character.displayName).toBe('Updated Character')
      expect(character.description).toBe('Updated description')
      expect(character.updatedAt).toBeGreaterThan(character.createdAt)
    })

    it('应该正确删除角色', () => {
      let characterId: string
      
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
      
      // 添加一些相关数据
      act(() => {
        const store = useCharacterStore.getState()
        store.recordInteraction(characterId!, 'test', {})
        store.setModelInstance(characterId!, createMockModelInstance())
        store.setAnimationManager(characterId!, createMockAnimationManager())
        store.setInteractionManager(characterId!, createMockInteractionManager())
      })
      
      act(() => {
        useCharacterStore.getState().deleteCharacter(characterId!)
      })
      
      const state = useCharacterStore.getState()
      expect(state.characters).toHaveLength(0)
      expect(state.characterStates).toEqual({})
      expect(state.characterStats).toEqual({})
      expect(state.modelInstances).toEqual({})
      expect(state.animationManagers).toEqual({})
      expect(state.interactionManagers).toEqual({})
      expect(state.interactionHistory).toHaveLength(0)
      expect(state.currentCharacterId).toBeNull()
    })

    it('删除角色时应该选择下一个可用角色作为当前角色', () => {
      let characterId1: string, characterId2: string
      
      act(() => {
        characterId1 = useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char1' }))
        characterId2 = useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char2' }))
      })
      
      // 当前角色应该是第一个
      expect(useCharacterStore.getState().currentCharacterId).toBe(characterId1)
      
      // 删除第一个角色
      act(() => {
        useCharacterStore.getState().deleteCharacter(characterId1!)
      })
      
      // 当前角色应该切换到第二个
      expect(useCharacterStore.getState().currentCharacterId).toBe(characterId2)
    })

    it('应该正确切换角色', async () => {
      let characterId1: string, characterId2: string
      
      act(() => {
        characterId1 = useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char1' }))
        characterId2 = useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char2' }))
      })
      
      await act(async () => {
        await useCharacterStore.getState().switchCharacter(characterId2!)
      })
      
      expect(useCharacterStore.getState().currentCharacterId).toBe(characterId2)
      expect(useCharacterStore.getState().isLoading).toBe(false)
      expect(useCharacterStore.getState().error).toBeNull()
    })

    it('切换到不存在的角色应该设置错误', async () => {
      await act(async () => {
        await useCharacterStore.getState().switchCharacter('non-existent')
      })
      
      expect(useCharacterStore.getState().error).toBeTruthy()
      expect(useCharacterStore.getState().isLoading).toBe(false)
    })

    it('应该正确切换角色启用状态', () => {
      let characterId: string
      
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter({ enabled: true }))
      })
      
      expect(useCharacterStore.getState().characters[0].enabled).toBe(true)
      
      act(() => {
        useCharacterStore.getState().toggleCharacterEnabled(characterId!)
      })
      
      expect(useCharacterStore.getState().characters[0].enabled).toBe(false)
      expect(useCharacterStore.getState().characters[0].updatedAt).toBeGreaterThan(useCharacterStore.getState().characters[0].createdAt)
    })

    it('获取启用的角色列表应该只返回启用的角色', () => {
      act(() => {
        useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char1', enabled: true }))
        useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char2', enabled: false }))
        useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char3', enabled: true }))
      })
      
      const enabledCharacters = useCharacterStore.getState().getEnabledCharacters()
      expect(enabledCharacters).toHaveLength(2)
      expect(enabledCharacters.map(c => c.name)).toEqual(['char1', 'char3'])
    })
  })

  // ==================== 状态管理测试 ====================

  describe('状态管理', () => {
    let characterId: string
    
    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
    })

    it('应该正确设置角色情绪', () => {
      act(() => {
        useCharacterStore.getState().setEmotion(characterId, EmotionType.HAPPY, 0.9)
      })
      
      const state = useCharacterStore.getState().characterStates[characterId]
      expect(state.emotion).toBe(EmotionType.HAPPY)
      expect(state.emotionIntensity).toBe(0.9)
    })

    it('情绪强度应该限制在 0-1 之间', () => {
      act(() => {
        useCharacterStore.getState().setEmotion(characterId, EmotionType.SAD, 1.5)
      })
      
      expect(useCharacterStore.getState().characterStates[characterId].emotionIntensity).toBe(1.0)
      
      act(() => {
        useCharacterStore.getState().setEmotion(characterId, EmotionType.SAD, -0.5)
      })
      
      expect(useCharacterStore.getState().characterStates[characterId].emotionIntensity).toBe(0.0)
    })

    it('应该正确设置活动状态', () => {
      act(() => {
        useCharacterStore.getState().setActivityState(characterId, ActivityState.SPEAKING)
      })
      
      const state = useCharacterStore.getState().characterStates[characterId]
      expect(state.activityState).toBe(ActivityState.SPEAKING)
    })

    it('应该正确更新角色状态', () => {
      const updates = {
        health: 90,
        mood: 70,
        energy: 85,
        affection: 60,
      }
      
      act(() => {
        useCharacterStore.getState().updateCharacterState(characterId, updates)
      })
      
      const state = useCharacterStore.getState().characterStates[characterId]
      expect(state.health).toBe(90)
      expect(state.mood).toBe(70)
      expect(state.energy).toBe(85)
      expect(state.affection).toBe(60)
    })

    it('应该正确重置角色状态', () => {
      // 先修改一些状态
      act(() => {
        useCharacterStore.getState().updateCharacterState(characterId, {
          health: 50,
          mood: 30,
          emotion: EmotionType.SAD,
        })
      })
      
      // 重置状态
      act(() => {
        useCharacterStore.getState().resetCharacterState(characterId)
      })
      
      const state = useCharacterStore.getState().characterStates[characterId]
      expect(state.health).toBe(100)
      expect(state.mood).toBe(80)
      expect(state.emotion).toBe(EmotionType.NEUTRAL)
    })

    it('对不存在的角色操作应该被忽略', () => {
      act(() => {
        useCharacterStore.getState().setEmotion('non-existent', EmotionType.HAPPY)
        useCharacterStore.getState().setActivityState('non-existent', ActivityState.SPEAKING)
        useCharacterStore.getState().updateCharacterState('non-existent', { health: 50 })
        useCharacterStore.getState().resetCharacterState('non-existent')
      })
      
      // 不应该抛出错误或影响现有状态
      expect(useCharacterStore.getState().characterStates[characterId]).toBeDefined()
    })
  })

  // ==================== 动画控制测试 ====================

  describe('动画控制', () => {
    let characterId: string
    let mockAnimationManager: jest.Mocked<Live2DAnimationManager>
    let mockModelInstance: jest.Mocked<Live2DModelInstance>
    
    beforeEach(() => {
      mockAnimationManager = createMockAnimationManager()
      mockModelInstance = createMockModelInstance()
      
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
        useCharacterStore.getState().setAnimationManager(characterId, mockAnimationManager)
        useCharacterStore.getState().setModelInstance(characterId, mockModelInstance)
      })
    })

    it('应该正确播放动画', async () => {
      const animationConfig = createMockAnimationConfig({
        group: 'greeting',
        index: 0,
      })
      
      mockAnimationManager.playAnimation.mockResolvedValue(undefined)
      
      await act(async () => {
        await useCharacterStore.getState().playAnimation(characterId, animationConfig)
      })
      
      expect(mockAnimationManager.playAnimation).toHaveBeenCalledWith(animationConfig)
      
      const state = useCharacterStore.getState().characterStates[characterId]
      expect(state.currentAnimation).toBe('greeting')
      expect(state.animationState).toBe(Live2DAnimationState.PLAYING)
    })

    it('播放动画失败时应该设置错误', async () => {
      const animationConfig = createMockAnimationConfig()
      const error = new Error('Animation failed')
      
      mockAnimationManager.playAnimation.mockRejectedValue(error)
      
      await act(async () => {
        await useCharacterStore.getState().playAnimation(characterId, animationConfig)
      })
      
      expect(useCharacterStore.getState().error).toBeTruthy()
    })

    it('没有动画管理器时应该显示警告', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      act(() => {
        useCharacterStore.getState().setAnimationManager(characterId, null)
      })
      
      await act(async () => {
        await useCharacterStore.getState().playAnimation(characterId, createMockAnimationConfig())
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('动画管理器不存在'))
      
      consoleSpy.mockRestore()
    })

    it('应该正确播放随机动画', async () => {
      mockAnimationManager.playRandomAnimationByType.mockResolvedValue(undefined)
      
      await act(async () => {
        await useCharacterStore.getState().playRandomAnimation(characterId, AnimationType.IDLE)
      })
      
      expect(mockAnimationManager.playRandomAnimationByType).toHaveBeenCalledWith(AnimationType.IDLE)
    })

    it('应该正确停止动画', () => {
      act(() => {
        useCharacterStore.getState().stopAnimation(characterId)
      })
      
      expect(mockAnimationManager.stopAnimation).toHaveBeenCalled()
      
      const state = useCharacterStore.getState().characterStates[characterId]
      expect(state.currentAnimation).toBeUndefined()
      expect(state.animationState).toBe(Live2DAnimationState.STOPPED)
    })

    it('应该正确设置表情', async () => {
      const expressionIndex = 2
      
      mockModelInstance.model.expression.mockResolvedValue(undefined)
      
      await act(async () => {
        await useCharacterStore.getState().setExpression(characterId, expressionIndex)
      })
      
      expect(mockModelInstance.model.expression).toHaveBeenCalledWith(expressionIndex)
      
      const state = useCharacterStore.getState().characterStates[characterId]
      expect(state.currentExpression).toBe(expressionIndex)
    })

    it('设置表情失败时应该显示错误', async () => {
      const error = new Error('Expression failed')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockModelInstance.model.expression.mockRejectedValue(error)
      
      await act(async () => {
        await useCharacterStore.getState().setExpression(characterId, 1)
      })
      
      expect(consoleSpy).toHaveBeenCalledWith('设置表情失败:', error)
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 交互管理测试 ====================

  describe('交互管理', () => {
    let characterId: string
    
    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
    })

    it('应该正确记录交互', () => {
      const interactionType = 'click'
      const data = { x: 100, y: 200 }
      const result = { success: true }
      
      act(() => {
        useCharacterStore.getState().recordInteraction(characterId, interactionType, data, result)
      })
      
      const state = useCharacterStore.getState()
      
      expect(state.interactionHistory).toHaveLength(1)
      
      const interaction = state.interactionHistory[0]
      expect(interaction.id).toBe('mock-id')
      expect(interaction.characterId).toBe(characterId)
      expect(interaction.type).toBe(interactionType)
      expect(interaction.data).toEqual(data)
      expect(interaction.result).toEqual(result)
      expect(interaction.timestamp).toBeDefined()
      
      // 应该更新角色状态
      const charState = state.characterStates[characterId]
      expect(charState.lastInteractionTime).toBe(interaction.timestamp)
      expect(charState.totalInteractions).toBe(1)
    })

    it('应该限制交互历史记录数量', () => {
      act(() => {
        const store = useCharacterStore.getState()
        // 添加超过1000个交互记录
        for (let i = 0; i < 1005; i++) {
          store.recordInteraction(characterId, 'test', { index: i })
        }
      })
      
      const history = useCharacterStore.getState().interactionHistory
      expect(history).toHaveLength(1000)
    })

    it('应该正确处理交互事件', () => {
      const event = createMockInteractionEventData({
        type: InteractionType.CLICK,
      })
      
      act(() => {
        useCharacterStore.getState().handleInteraction(characterId, event)
      })
      
      const state = useCharacterStore.getState()
      
      // 应该记录交互
      expect(state.interactionHistory).toHaveLength(1)
      expect(state.interactionHistory[0].type).toBe(InteractionType.CLICK)
      
      // 应该更新活动状态
      expect(state.characterStates[characterId].activityState).toBe(ActivityState.INTERACTING)
    })

    it('应该正确清除交互历史', () => {
      // 添加一些交互记录
      act(() => {
        const store = useCharacterStore.getState()
        store.recordInteraction(characterId, 'test1', {})
        store.recordInteraction(characterId, 'test2', {})
      })
      
      expect(useCharacterStore.getState().interactionHistory).toHaveLength(2)
      
      act(() => {
        useCharacterStore.getState().clearInteractionHistory(characterId)
      })
      
      expect(useCharacterStore.getState().interactionHistory).toHaveLength(0)
    })

    it('应该能清除所有交互历史', () => {
      let characterId2: string
      
      act(() => {
        characterId2 = useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char2' }))
      })
      
      // 为两个角色添加交互记录
      act(() => {
        const store = useCharacterStore.getState()
        store.recordInteraction(characterId, 'test1', {})
        store.recordInteraction(characterId2, 'test2', {})
      })
      
      expect(useCharacterStore.getState().interactionHistory).toHaveLength(2)
      
      act(() => {
        useCharacterStore.getState().clearInteractionHistory()
      })
      
      expect(useCharacterStore.getState().interactionHistory).toHaveLength(0)
    })
  })

  // ==================== Live2D 管理测试 ====================

  describe('Live2D 管理', () => {
    let characterId: string
    let mockModelInstance: Live2DModelInstance
    let mockAnimationManager: Live2DAnimationManager
    let mockInteractionManager: Live2DInteractionManager
    
    beforeEach(() => {
      mockModelInstance = createMockModelInstance()
      mockAnimationManager = createMockAnimationManager()
      mockInteractionManager = createMockInteractionManager()
      
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
    })

    it('应该正确设置和获取模型实例', () => {
      act(() => {
        useCharacterStore.getState().setModelInstance(characterId, mockModelInstance)
      })
      
      const instance = useCharacterStore.getState().getModelInstance(characterId)
      expect(instance).toBe(mockModelInstance)
      
      // 通过 state 直接访问也应该正确
      expect(useCharacterStore.getState().modelInstances[characterId]).toBe(mockModelInstance)
    })

    it('应该正确设置和获取动画管理器', () => {
      act(() => {
        useCharacterStore.getState().setAnimationManager(characterId, mockAnimationManager)
      })
      
      const manager = useCharacterStore.getState().getAnimationManager(characterId)
      expect(manager).toBe(mockAnimationManager)
      
      expect(useCharacterStore.getState().animationManagers[characterId]).toBe(mockAnimationManager)
    })

    it('应该正确设置和获取交互管理器', () => {
      act(() => {
        useCharacterStore.getState().setInteractionManager(characterId, mockInteractionManager)
      })
      
      const manager = useCharacterStore.getState().getInteractionManager(characterId)
      expect(manager).toBe(mockInteractionManager)
      
      expect(useCharacterStore.getState().interactionManagers[characterId]).toBe(mockInteractionManager)
    })

    it('获取不存在的管理器应该返回 null', () => {
      expect(useCharacterStore.getState().getModelInstance('non-existent')).toBeNull()
      expect(useCharacterStore.getState().getAnimationManager('non-existent')).toBeNull()
      expect(useCharacterStore.getState().getInteractionManager('non-existent')).toBeNull()
    })

    it('应该能设置 null 值来清除管理器', () => {
      act(() => {
        const store = useCharacterStore.getState()
        store.setModelInstance(characterId, mockModelInstance)
        store.setAnimationManager(characterId, mockAnimationManager)
        store.setInteractionManager(characterId, mockInteractionManager)
      })
      
      act(() => {
        const store = useCharacterStore.getState()
        store.setModelInstance(characterId, null)
        store.setAnimationManager(characterId, null)
        store.setInteractionManager(characterId, null)
      })
      
      expect(useCharacterStore.getState().getModelInstance(characterId)).toBeNull()
      expect(useCharacterStore.getState().getAnimationManager(characterId)).toBeNull()
      expect(useCharacterStore.getState().getInteractionManager(characterId)).toBeNull()
    })
  })

  // ==================== 统计和分析测试 ====================

  describe('统计和分析', () => {
    let characterId: string
    
    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
    })

    it('应该正确更新统计信息', () => {
      // 添加一些交互记录
      act(() => {
        const store = useCharacterStore.getState()
        store.recordInteraction(characterId, 'test1', {})
        store.recordInteraction(characterId, 'test2', {})
        store.updateCharacterState(characterId, { mood: 90, energy: 85 })
      })
      
      act(() => {
        useCharacterStore.getState().updateStats(characterId)
      })
      
      const stats = useCharacterStore.getState().characterStats[characterId]
      expect(stats.averageMood).toBe(90)
      expect(stats.averageEnergy).toBe(85)
    })

    it('应该正确增加交互计数', () => {
      act(() => {
        useCharacterStore.getState().incrementInteractionCount(characterId)
      })
      
      const stats = useCharacterStore.getState().characterStats[characterId]
      expect(stats.totalInteractions).toBe(1)
      
      act(() => {
        useCharacterStore.getState().incrementInteractionCount(characterId)
      })
      
      expect(useCharacterStore.getState().characterStats[characterId].totalInteractions).toBe(2)
    })

    it('应该正确更新在线时间', () => {
      act(() => {
        useCharacterStore.getState().updateOnlineTime(characterId, 3600) // 1小时
      })
      
      const stats = useCharacterStore.getState().characterStats[characterId]
      expect(stats.totalOnlineTime).toBe(3600)
      
      act(() => {
        useCharacterStore.getState().updateOnlineTime(characterId, 1800) // 再加30分钟
      })
      
      expect(useCharacterStore.getState().characterStats[characterId].totalOnlineTime).toBe(5400)
    })

    it('应该正确记录情绪变化', () => {
      const mockNow = vi.spyOn(Date, 'now')
      mockNow.mockReturnValue(1000000)
      
      act(() => {
        useCharacterStore.getState().recordEmotionChange(characterId, EmotionType.HAPPY)
      })
      
      mockNow.mockReturnValue(1005000) // 5秒后
      
      act(() => {
        useCharacterStore.getState().recordEmotionChange(characterId, EmotionType.SAD)
      })
      
      const stats = useCharacterStore.getState().characterStats[characterId]
      expect(stats.emotionHistory).toHaveLength(2)
      
      const firstEmotion = stats.emotionHistory[0]
      expect(firstEmotion.emotion).toBe(EmotionType.HAPPY)
      expect(firstEmotion.duration).toBe(5000)
      
      const secondEmotion = stats.emotionHistory[1]
      expect(secondEmotion.emotion).toBe(EmotionType.SAD)
      expect(secondEmotion.duration).toBe(0)
      
      mockNow.mockRestore()
    })

    it('应该限制情绪历史记录数量', () => {
      act(() => {
        const store = useCharacterStore.getState()
        // 添加超过100个情绪记录
        for (let i = 0; i < 105; i++) {
          store.recordEmotionChange(characterId, EmotionType.NEUTRAL)
        }
      })
      
      const stats = useCharacterStore.getState().characterStats[characterId]
      expect(stats.emotionHistory).toHaveLength(100)
    })

    it('对不存在角色的统计操作应该被忽略', () => {
      act(() => {
        const store = useCharacterStore.getState()
        store.updateStats('non-existent')
        store.incrementInteractionCount('non-existent')
        store.updateOnlineTime('non-existent', 100)
        store.recordEmotionChange('non-existent', EmotionType.HAPPY)
      })
      
      // 不应该抛出错误
      expect(useCharacterStore.getState().characterStats[characterId]).toBeDefined()
    })
  })

  // ==================== 计算属性测试 ====================

  describe('计算属性', () => {
    let characterId1: string, characterId2: string
    
    beforeEach(() => {
      act(() => {
        characterId1 = useCharacterStore.getState().addCharacter(createMockCharacter({ 
          name: 'char1', 
          enabled: true 
        }))
        characterId2 = useCharacterStore.getState().addCharacter(createMockCharacter({ 
          name: 'char2', 
          enabled: false 
        }))
      })
    })

    it('getCurrentCharacter 应该返回当前角色', () => {
      const currentCharacter = useCharacterStore.getState().getCurrentCharacter()
      expect(currentCharacter?.id).toBe(characterId1)
    })

    it('getCurrentCharacterState 应该返回当前角色状态', () => {
      const currentState = useCharacterStore.getState().getCurrentCharacterState()
      expect(currentState).toBeDefined()
      expect(currentState?.emotion).toBe(EmotionType.NEUTRAL)
    })

    it('getCurrentCharacterStats 应该返回当前角色统计', () => {
      const currentStats = useCharacterStore.getState().getCurrentCharacterStats()
      expect(currentStats).toBeDefined()
      expect(currentStats?.totalInteractions).toBe(0)
    })

    it('getEnabledCharacters 应该只返回启用的角色', () => {
      const enabledCharacters = useCharacterStore.getState().getEnabledCharacters()
      expect(enabledCharacters).toHaveLength(1)
      expect(enabledCharacters[0].name).toBe('char1')
    })

    it('没有当前角色时计算属性应该返回 null', () => {
      act(() => {
        useCharacterStore.getState().reset()
      })
      
      expect(useCharacterStore.getState().getCurrentCharacter()).toBeNull()
      expect(useCharacterStore.getState().getCurrentCharacterState()).toBeNull()
      expect(useCharacterStore.getState().getCurrentCharacterStats()).toBeNull()
    })
  })

  // ==================== 工具方法测试 ====================

  describe('工具方法', () => {
    let characterId: string
    
    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
    })

    it('reset 应该重置所有状态', () => {
      // 设置一些状态
      act(() => {
        const store = useCharacterStore.getState()
        store.setError('Test error')
        store.setModelInstance(characterId, createMockModelInstance())
        store.recordInteraction(characterId, 'test', {})
      })
      
      act(() => {
        useCharacterStore.getState().reset()
      })
      
      const state = useCharacterStore.getState()
      expect(state.characters).toEqual([])
      expect(state.currentCharacterId).toBeNull()
      expect(state.characterStates).toEqual({})
      expect(state.characterStats).toEqual({})
      expect(state.interactionHistory).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.modelInstances).toEqual({})
      expect(state.animationManagers).toEqual({})
      expect(state.interactionManagers).toEqual({})
    })

    it('clearError 应该清除错误信息', () => {
      act(() => {
        useCharacterStore.getState().setError?.('Test error')
      })
      
      // 手动设置错误（因为没有 setError 方法）
      act(() => {
        useCharacterStore.setState({ error: 'Test error' })
      })
      
      act(() => {
        useCharacterStore.getState().clearError()
      })
      
      expect(useCharacterStore.getState().error).toBeNull()
    })
  })

  // ==================== 辅助 Hooks 测试 ====================

  describe('辅助 Hooks', () => {
    let characterId: string
    
    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore.getState().addCharacter(createMockCharacter())
      })
    })

    it('useCurrentCharacter 应该返回当前角色信息', () => {
      const { result } = renderHook(() => useCurrentCharacter())
      
      expect(result.current.character?.id).toBe(characterId)
      expect(result.current.state).toBeDefined()
      expect(result.current.stats).toBeDefined()
    })

    it('useCharacterList 应该返回角色列表', () => {
      const { result } = renderHook(() => useCharacterList())
      
      expect(result.current.characters).toHaveLength(1)
      expect(result.current.enabledCharacters).toHaveLength(1)
    })

    it('useCharacterActions 应该返回角色操作方法', () => {
      const { result } = renderHook(() => useCharacterActions())
      
      expect(typeof result.current.addCharacter).toBe('function')
      expect(typeof result.current.updateCharacter).toBe('function')
      expect(typeof result.current.deleteCharacter).toBe('function')
      expect(typeof result.current.switchCharacter).toBe('function')
      expect(typeof result.current.toggleCharacterEnabled).toBe('function')
    })

    it('useCharacterAnimation 应该返回动画控制方法', () => {
      const { result } = renderHook(() => useCharacterAnimation(characterId))
      
      expect(typeof result.current.playAnimation).toBe('function')
      expect(typeof result.current.playRandomAnimation).toBe('function')
      expect(typeof result.current.stopAnimation).toBe('function')
      expect(typeof result.current.setExpression).toBe('function')
    })

    it('useCharacterInteraction 应该返回交互管理方法', () => {
      const { result } = renderHook(() => useCharacterInteraction(characterId))
      
      expect(typeof result.current.recordInteraction).toBe('function')
      expect(typeof result.current.handleInteraction).toBe('function')
      expect(typeof result.current.clearHistory).toBe('function')
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('切换角色时的动画管理器错误应该被捕获', async () => {
      let characterId1: string, characterId2: string
      const mockAnimationManager = createMockAnimationManager()
      
      act(() => {
        characterId1 = useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char1' }))
        characterId2 = useCharacterStore.getState().addCharacter(createMockCharacter({ name: 'char2' }))
        useCharacterStore.getState().setAnimationManager(characterId1, mockAnimationManager)
      })
      
      // 模拟停止动画时出错
      mockAnimationManager.stopAnimation.mockImplementation(() => {
        throw new Error('Animation stop failed')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await act(async () => {
        await useCharacterStore.getState().switchCharacter(characterId2)
      })
      
      // 切换应该成功，错误应该被捕获
      expect(useCharacterStore.getState().currentCharacterId).toBe(characterId2)
      
      consoleSpy.mockRestore()
    })
  })
})
