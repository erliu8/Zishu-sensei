/**
 * 角色状态管理 Store
 * 
 * 使用 Zustand 管理角色相关的所有状态，包括：
 * - 角色列表和当前角色
 * - 角色情绪和状态
 * - 动画播放状态
 * - 交互历史
 * - Live2D 模型实例
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { Live2DAnimationState } from '@/types/live2d'
import type { Live2DModelConfig } from '@/types/live2d'
import type { Live2DModelInstance } from '@/services/live2d/loader'
import type { Live2DAnimationManager } from '@/services/live2d/animation'
import { AnimationType, type AnimationConfig } from '@/services/live2d/animation'
import { InteractionType } from '@/services/live2d/interaction'
import type { Live2DInteractionManager, InteractionEventData } from '@/services/live2d/interaction'

// ==================== 类型定义 ====================

/**
 * 角色情绪类型
 */
export enum EmotionType {
  /** 中性/默认 */
  NEUTRAL = 'neutral',
  /** 快乐 */
  HAPPY = 'happy',
  /** 伤心 */
  SAD = 'sad',
  /** 愤怒 */
  ANGRY = 'angry',
  /** 惊讶 */
  SURPRISED = 'surprised',
  /** 困惑 */
  CONFUSED = 'confused',
  /** 思考 */
  THINKING = 'thinking',
  /** 兴奋 */
  EXCITED = 'excited',
  /** 疲惫 */
  TIRED = 'tired',
  /** 害羞 */
  SHY = 'shy',
  /** 生气 */
  ANNOYED = 'annoyed',
  /** 担心 */
  WORRIED = 'worried',
}

/**
 * 角色活动状态
 */
export enum ActivityState {
  /** 空闲 */
  IDLE = 'idle',
  /** 说话中 */
  SPEAKING = 'speaking',
  /** 听取中 */
  LISTENING = 'listening',
  /** 思考中 */
  THINKING = 'thinking',
  /** 交互中 */
  INTERACTING = 'interacting',
  /** 睡眠中 */
  SLEEPING = 'sleeping',
  /** 工作中 */
  WORKING = 'working',
}

/**
 * 角色基础信息
 */
export interface Character {
  /** 角色ID */
  id: string
  /** 角色名称 */
  name: string
  /** 角色显示名称 */
  displayName: string
  /** 角色描述 */
  description: string
  /** 角色头像 */
  avatar: string
  /** 性格描述 */
  personality: string
  /** 角色标签 */
  tags: string[]
  /** Live2D 模型配置 */
  modelConfig: Live2DModelConfig
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 是否启用 */
  enabled: boolean
  /** 自定义数据 */
  customData?: Record<string, any>
}

/**
 * 角色状态
 */
export interface CharacterState {
  /** 当前情绪 */
  emotion: EmotionType
  /** 情绪强度 (0-1) */
  emotionIntensity: number
  /** 活动状态 */
  activityState: ActivityState
  /** 当前动画 */
  currentAnimation?: string
  /** 动画播放状态 */
  animationState: Live2DAnimationState
  /** 当前表情索引 */
  currentExpression?: number
  /** 是否可交互 */
  isInteractive: boolean
  /** 健康值 (0-100) */
  health: number
  /** 心情值 (0-100) */
  mood: number
  /** 精力值 (0-100) */
  energy: number
  /** 亲密度 (0-100) */
  affection: number
  /** 最后交互时间 */
  lastInteractionTime: number
  /** 最后说话时间 */
  lastSpeakTime: number
  /** 累计交互次数 */
  totalInteractions: number
}

/**
 * 交互记录
 */
export interface InteractionRecord {
  /** 记录ID */
  id: string
  /** 角色ID */
  characterId: string
  /** 交互类型 */
  type: string
  /** 交互数据 */
  data: any
  /** 时间戳 */
  timestamp: number
  /** 结果 */
  result?: any
}

/**
 * 角色统计信息
 */
export interface CharacterStats {
  /** 总交互次数 */
  totalInteractions: number
  /** 总对话次数 */
  totalConversations: number
  /** 总在线时间(秒) */
  totalOnlineTime: number
  /** 最喜欢的交互类型 */
  favoriteInteraction?: string
  /** 平均心情值 */
  averageMood: number
  /** 平均精力值 */
  averageEnergy: number
  /** 情绪历史 */
  emotionHistory: Array<{
    emotion: EmotionType
    timestamp: number
    duration: number
  }>
}

/**
 * 角色 Store 状态
 */
export interface CharacterStore {
  // ==================== 基础状态 ====================
  /** 角色列表 */
  characters: Character[]
  /** 当前角色ID */
  currentCharacterId: string | null
  /** 角色状态映射 */
  characterStates: Record<string, CharacterState>
  /** 角色统计映射 */
  characterStats: Record<string, CharacterStats>
  /** 交互历史 */
  interactionHistory: InteractionRecord[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null

  // ==================== Live2D 相关 ====================
  /** Live2D 模型实例映射 */
  modelInstances: Record<string, Live2DModelInstance | null>
  /** 动画管理器映射 */
  animationManagers: Record<string, Live2DAnimationManager | null>
  /** 交互管理器映射 */
  interactionManagers: Record<string, Live2DInteractionManager | null>

  // ==================== 计算属性 ====================
  /** 获取当前角色 */
  getCurrentCharacter: () => Character | null
  /** 获取当前角色状态 */
  getCurrentCharacterState: () => CharacterState | null
  /** 获取当前角色统计 */
  getCurrentCharacterStats: () => CharacterStats | null
  /** 获取启用的角色列表 */
  getEnabledCharacters: () => Character[]

  // ==================== 角色管理 ====================
  /** 添加角色 */
  addCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => string
  /** 更新角色 */
  updateCharacter: (id: string, updates: Partial<Character>) => void
  /** 删除角色 */
  deleteCharacter: (id: string) => void
  /** 切换当前角色 */
  switchCharacter: (id: string) => Promise<void>
  /** 启用/禁用角色 */
  toggleCharacterEnabled: (id: string) => void

  // ==================== 状态管理 ====================
  /** 设置角色情绪 */
  setEmotion: (characterId: string, emotion: EmotionType, intensity?: number) => void
  /** 设置活动状态 */
  setActivityState: (characterId: string, state: ActivityState) => void
  /** 更新角色状态 */
  updateCharacterState: (characterId: string, updates: Partial<CharacterState>) => void
  /** 重置角色状态 */
  resetCharacterState: (characterId: string) => void

  // ==================== 动画控制 ====================
  /** 播放动画 */
  playAnimation: (characterId: string, config: AnimationConfig) => Promise<void>
  /** 播放指定类型的随机动画 */
  playRandomAnimation: (characterId: string, type: AnimationType) => Promise<void>
  /** 停止动画 */
  stopAnimation: (characterId: string) => void
  /** 设置表情 */
  setExpression: (characterId: string, index: number) => Promise<void>

  // ==================== 交互管理 ====================
  /** 记录交互 */
  recordInteraction: (characterId: string, type: string, data: any, result?: any) => void
  /** 处理交互事件 */
  handleInteraction: (characterId: string, event: InteractionEventData) => void
  /** 清除交互历史 */
  clearInteractionHistory: (characterId?: string) => void

  // ==================== Live2D 管理 ====================
  /** 设置模型实例 */
  setModelInstance: (characterId: string, instance: Live2DModelInstance | null) => void
  /** 设置动画管理器 */
  setAnimationManager: (characterId: string, manager: Live2DAnimationManager | null) => void
  /** 设置交互管理器 */
  setInteractionManager: (characterId: string, manager: Live2DInteractionManager | null) => void
  /** 获取模型实例 */
  getModelInstance: (characterId: string) => Live2DModelInstance | null
  /** 获取动画管理器 */
  getAnimationManager: (characterId: string) => Live2DAnimationManager | null
  /** 获取交互管理器 */
  getInteractionManager: (characterId: string) => Live2DInteractionManager | null

  // ==================== 统计和分析 ====================
  /** 更新统计信息 */
  updateStats: (characterId: string) => void
  /** 增加交互计数 */
  incrementInteractionCount: (characterId: string) => void
  /** 更新在线时间 */
  updateOnlineTime: (characterId: string, seconds: number) => void
  /** 记录情绪变化 */
  recordEmotionChange: (characterId: string, emotion: EmotionType) => void

  // ==================== 工具方法 ====================
  /** 重置 Store */
  reset: () => void
  /** 清除错误 */
  clearError: () => void
}

// ==================== 默认值 ====================

/**
 * 创建默认角色状态
 */
const createDefaultCharacterState = (): CharacterState => ({
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
})

/**
 * 创建默认角色统计
 */
const createDefaultCharacterStats = (): CharacterStats => ({
  totalInteractions: 0,
  totalConversations: 0,
  totalOnlineTime: 0,
  averageMood: 80,
  averageEnergy: 100,
  emotionHistory: [],
})

// ==================== Store 实现 ====================

/**
 * 角色状态管理 Store
 */
export const useCharacterStore = create<CharacterStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        (set, get) => ({
          // ==================== 初始状态 ====================
          characters: [],
          currentCharacterId: null,
          characterStates: {},
          characterStats: {},
          interactionHistory: [],
          isLoading: false,
          error: null,
          modelInstances: {},
          animationManagers: {},
          interactionManagers: {},

          // ==================== 计算属性 ====================
          getCurrentCharacter: () => {
            const { characters, currentCharacterId } = get()
            return characters.find(c => c.id === currentCharacterId) || null
          },

          getCurrentCharacterState: () => {
            const { characterStates, currentCharacterId } = get()
            if (!currentCharacterId) return null
            return characterStates[currentCharacterId] || null
          },

          getCurrentCharacterStats: () => {
            const { characterStats, currentCharacterId } = get()
            if (!currentCharacterId) return null
            return characterStats[currentCharacterId] || null
          },

          getEnabledCharacters: () => {
            return get().characters.filter(c => c.enabled)
          },

          // ==================== 角色管理 ====================
          addCharacter: (character) => {
            const id = nanoid()
            const now = Date.now()
            
            const newCharacter: Character = {
              ...character,
              id,
              createdAt: now,
              updatedAt: now,
            }
            
            set((state) => ({
              characters: [...state.characters, newCharacter],
              characterStates: {
                ...state.characterStates,
                [id]: createDefaultCharacterState(),
              },
              characterStats: {
                ...state.characterStats,
                [id]: createDefaultCharacterStats(),
              },
              currentCharacterId: state.characters.length === 0 ? id : state.currentCharacterId,
            }))
            
            return id
          },

          updateCharacter: (id, updates) => {
            set((state) => ({
              characters: state.characters.map(c => 
                c.id === id 
                  ? { ...c, ...updates, updatedAt: Date.now() }
                  : c
              ),
            }))
          },

          deleteCharacter: (id) => {
            const state = get()
            const newCharacters = state.characters.filter(c => c.id !== id)
            const { [id]: _, ...newStates } = state.characterStates
            const { [id]: __, ...newStats } = state.characterStats
            const { [id]: ___, ...newInstances } = state.modelInstances
            const { [id]: ____, ...newManagers } = state.animationManagers
            const { [id]: _____, ...newInteractionManagers } = state.interactionManagers
            
            set({
              characters: newCharacters,
              characterStates: newStates,
              characterStats: newStats,
              modelInstances: newInstances,
              animationManagers: newManagers,
              interactionManagers: newInteractionManagers,
              interactionHistory: state.interactionHistory.filter(r => r.characterId !== id),
              currentCharacterId: state.currentCharacterId === id ? (newCharacters[0]?.id || null) : state.currentCharacterId,
            })
          },

          switchCharacter: async (id) => {
            const character = get().characters.find(c => c.id === id)
            if (!character) {
              set({ error: `角色不存在: ${id}` })
              return
            }

            set({ isLoading: true, error: null })
            
            try {
              // 停止当前角色的动画
              const currentId = get().currentCharacterId
              if (currentId) {
                const currentManager = get().animationManagers[currentId]
                currentManager?.stopAnimation()
              }
              
              // 切换角色并初始化状态（如果不存在）
              set((state) => {
                const updates: Partial<CharacterStore> = {
                  currentCharacterId: id,
                }
                
                if (!state.characterStates[id] || !state.characterStats[id]) {
                  updates.characterStates = {
                    ...state.characterStates,
                    [id]: state.characterStates[id] || createDefaultCharacterState(),
                  }
                  updates.characterStats = {
                    ...state.characterStats,
                    [id]: state.characterStats[id] || createDefaultCharacterStats(),
                  }
                }
                
                return updates
              })
              
              set({ isLoading: false })
            } catch (error) {
              console.error('切换角色失败:', error)
              set({ 
                error: `切换角色失败: ${error instanceof Error ? error.message : '未知错误'}`,
                isLoading: false 
              })
            }
          },

          toggleCharacterEnabled: (id) => {
            set((state) => ({
              characters: state.characters.map(c => 
                c.id === id 
                  ? { ...c, enabled: !c.enabled, updatedAt: Date.now() }
                  : c
              ),
            }))
          },

          // ==================== 状态管理 ====================
          setEmotion: (characterId, emotion, intensity = 0.8) => {
            const state = get()
            const charState = state.characterStates[characterId]
            if (charState) {
              set({
                characterStates: {
                  ...state.characterStates,
                  [characterId]: {
                    ...charState,
                    emotion,
                    emotionIntensity: Math.max(0, Math.min(1, intensity)),
                  },
                },
              })
              
              // 记录情绪变化
              get().recordEmotionChange(characterId, emotion)
            }
          },

          setActivityState: (characterId, activityState) => {
            const state = get()
            const charState = state.characterStates[characterId]
            if (charState) {
              set({
                characterStates: {
                  ...state.characterStates,
                  [characterId]: {
                    ...charState,
                    activityState,
                  },
                },
              })
            }
          },

          updateCharacterState: (characterId, updates) => {
            const state = get()
            const charState = state.characterStates[characterId]
            if (charState) {
              set({
                characterStates: {
                  ...state.characterStates,
                  [characterId]: {
                    ...charState,
                    ...updates,
                  },
                },
              })
            }
          },

          resetCharacterState: (characterId) => {
            const state = get()
            set({
              characterStates: {
                ...state.characterStates,
                [characterId]: createDefaultCharacterState(),
              },
            })
          },

          // ==================== 动画控制 ====================
          playAnimation: async (characterId, config) => {
            const manager = get().animationManagers[characterId]
            if (!manager) {
              console.warn(`角色 ${characterId} 的动画管理器不存在`)
              return
            }

            try {
              await manager.playAnimation(config)
              
              const state = get()
              const charState = state.characterStates[characterId]
              if (charState) {
                set({
                  characterStates: {
                    ...state.characterStates,
                    [characterId]: {
                      ...charState,
                      currentAnimation: config.group,
                      animationState: Live2DAnimationState.PLAYING,
                    },
                  },
                })
              }
            } catch (error) {
              console.error('播放动画失败:', error)
              set({ error: `播放动画失败: ${error instanceof Error ? error.message : '未知错误'}` })
            }
          },

          playRandomAnimation: async (characterId, type) => {
            const manager = get().animationManagers[characterId]
            if (!manager) {
              console.warn(`角色 ${characterId} 的动画管理器不存在`)
              return
            }

            try {
              await manager.playRandomAnimationByType(type)
            } catch (error) {
              console.error('播放随机动画失败:', error)
            }
          },

          stopAnimation: (characterId) => {
            const manager = get().animationManagers[characterId]
            if (manager) {
              manager.stopAnimation()
              
              const state = get()
              const charState = state.characterStates[characterId]
              if (charState) {
                set({
                  characterStates: {
                    ...state.characterStates,
                    [characterId]: {
                      ...charState,
                      currentAnimation: undefined,
                      animationState: Live2DAnimationState.STOPPED,
                    },
                  },
                })
              }
            }
          },

          setExpression: async (characterId, index) => {
            const instance = get().modelInstances[characterId]
            if (!instance) {
              console.warn(`角色 ${characterId} 的模型实例不存在`)
              return
            }

            try {
              await instance.model.expression(index)
              
              const state = get()
              const charState = state.characterStates[characterId]
              if (charState) {
                set({
                  characterStates: {
                    ...state.characterStates,
                    [characterId]: {
                      ...charState,
                      currentExpression: index,
                    },
                  },
                })
              }
            } catch (error) {
              console.error('设置表情失败:', error)
            }
          },

          // ==================== 交互管理 ====================
          recordInteraction: (characterId, type, data, result) => {
            const record: InteractionRecord = {
              id: nanoid(),
              characterId,
              type,
              data,
              result,
              timestamp: Date.now(),
            }
            
            const state = get()
            const charState = state.characterStates[characterId]
            const newHistory = [...state.interactionHistory, record]
            
            // 限制历史记录数量
            if (newHistory.length > 1000) {
              newHistory.shift()
            }
            
            set({
              interactionHistory: newHistory,
              characterStates: charState ? {
                ...state.characterStates,
                [characterId]: {
                  ...charState,
                  lastInteractionTime: record.timestamp,
                  totalInteractions: charState.totalInteractions + 1,
                },
              } : state.characterStates,
            })
            
            // 更新统计
            get().incrementInteractionCount(characterId)
          },

          handleInteraction: (characterId, event) => {
            const { recordInteraction, setActivityState } = get()
            
            // 记录交互
            recordInteraction(characterId, event.type as string, event)
            
            // 根据交互类型更新状态
            const eventTypeStr = event.type as string
            if (eventTypeStr === InteractionType.CLICK || 
                eventTypeStr === InteractionType.DOUBLE_CLICK ||
                eventTypeStr === InteractionType.DRAG) {
              setActivityState(characterId, ActivityState.INTERACTING)
            }
          },

          clearInteractionHistory: (characterId) => {
            set((state) => ({
              interactionHistory: characterId 
                ? state.interactionHistory.filter(r => r.characterId !== characterId)
                : []
            }))
          },

          // ==================== Live2D 管理 ====================
          setModelInstance: (characterId, instance) => {
            const state = get()
            set({
              modelInstances: {
                ...state.modelInstances,
                [characterId]: instance,
              },
            })
          },

          setAnimationManager: (characterId, manager) => {
            const state = get()
            set({
              animationManagers: {
                ...state.animationManagers,
                [characterId]: manager,
              },
            })
          },

          setInteractionManager: (characterId, manager) => {
            const state = get()
            set({
              interactionManagers: {
                ...state.interactionManagers,
                [characterId]: manager,
              },
            })
          },

          getModelInstance: (characterId) => {
            return get().modelInstances[characterId] || null
          },

          getAnimationManager: (characterId) => {
            return get().animationManagers[characterId] || null
          },

          getInteractionManager: (characterId) => {
            return get().interactionManagers[characterId] || null
          },

          // ==================== 统计和分析 ====================
          updateStats: (characterId) => {
            const store = get()
            const state = store.characterStates[characterId]
            const stats = store.characterStats[characterId]
            
            if (!state || !stats) return
            
            const history = store.interactionHistory.filter(
              r => r.characterId === characterId
            )
            
            if (history.length > 0) {
              const moodSum = history.length * (state.mood || 0)
              const energySum = history.length * (state.energy || 0)
              
              set({
                characterStats: {
                  ...store.characterStats,
                  [characterId]: {
                    ...stats,
                    averageMood: moodSum / history.length,
                    averageEnergy: energySum / history.length,
                  },
                },
              })
            }
          },

          incrementInteractionCount: (characterId) => {
            const state = get()
            const stats = state.characterStats[characterId]
            if (stats) {
              set({
                characterStats: {
                  ...state.characterStats,
                  [characterId]: {
                    ...stats,
                    totalInteractions: stats.totalInteractions + 1,
                  },
                },
              })
            }
          },

          updateOnlineTime: (characterId, seconds) => {
            const state = get()
            const stats = state.characterStats[characterId]
            if (stats) {
              set({
                characterStats: {
                  ...state.characterStats,
                  [characterId]: {
                    ...stats,
                    totalOnlineTime: stats.totalOnlineTime + seconds,
                  },
                },
              })
            }
          },

          recordEmotionChange: (characterId, emotion) => {
            const state = get()
            const stats = state.characterStats[characterId]
            if (stats) {
              const now = Date.now()
              const emotionHistory = [...stats.emotionHistory]
              const lastEmotion = emotionHistory[emotionHistory.length - 1]
              
              // 如果有上一个情绪记录，更新持续时间
              if (lastEmotion) {
                emotionHistory[emotionHistory.length - 1] = {
                  ...lastEmotion,
                  duration: now - lastEmotion.timestamp,
                }
              }
              
              // 添加新的情绪记录
              emotionHistory.push({
                emotion,
                timestamp: now,
                duration: 0,
              })
              
              // 限制历史记录数量
              if (emotionHistory.length > 100) {
                emotionHistory.shift()
              }
              
              set({
                characterStats: {
                  ...state.characterStats,
                  [characterId]: {
                    ...stats,
                    emotionHistory,
                  },
                },
              })
            }
          },

          // ==================== 工具方法 ====================
          reset: () => {
            set({
              characters: [],
              currentCharacterId: null,
              characterStates: {},
              characterStats: {},
              interactionHistory: [],
              isLoading: false,
              error: null,
              modelInstances: {},
              animationManagers: {},
              interactionManagers: {},
            })
          },

          clearError: () => {
            set({ error: null })
          },
        })
      ),
      {
        name: 'character-store',
        // 只持久化必要的数据，不持久化运行时对象
        partialize: (state) => ({
          characters: state.characters,
          currentCharacterId: state.currentCharacterId,
          characterStates: state.characterStates,
          characterStats: state.characterStats,
          interactionHistory: state.interactionHistory.slice(-100), // 只保存最近 100 条
        }),
      }
    ),
    {
      name: 'CharacterStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)

// ==================== 导出辅助 Hooks ====================

/**
 * 获取当前角色的 Hook
 */
export const useCurrentCharacter = () => {
  return useCharacterStore((state) => ({
    character: state.getCurrentCharacter(),
    state: state.getCurrentCharacterState(),
    stats: state.getCurrentCharacterStats(),
  }))
}

/**
 * 获取角色列表的 Hook
 */
export const useCharacterList = () => {
  return useCharacterStore((state) => ({
    characters: state.characters,
    enabledCharacters: state.getEnabledCharacters(),
  }))
}

/**
 * 获取角色操作方法的 Hook
 */
export const useCharacterActions = () => {
  return useCharacterStore((state) => ({
    addCharacter: state.addCharacter,
    updateCharacter: state.updateCharacter,
    deleteCharacter: state.deleteCharacter,
    switchCharacter: state.switchCharacter,
    toggleCharacterEnabled: state.toggleCharacterEnabled,
  }))
}

/**
 * 获取动画控制方法的 Hook
 */
export const useCharacterAnimation = (characterId?: string) => {
  const currentCharacterId = useCharacterStore((state) => state.currentCharacterId)
  const id = characterId || currentCharacterId || ''
  
  return useCharacterStore((state) => ({
    playAnimation: (config: AnimationConfig) => state.playAnimation(id, config),
    playRandomAnimation: (type: AnimationType) => state.playRandomAnimation(id, type),
    stopAnimation: () => state.stopAnimation(id),
    setExpression: (index: number) => state.setExpression(id, index),
  }))
}

/**
 * 获取交互管理方法的 Hook
 */
export const useCharacterInteraction = (characterId?: string) => {
  const currentCharacterId = useCharacterStore((state) => state.currentCharacterId)
  const id = characterId || currentCharacterId || ''
  
  return useCharacterStore((state) => ({
    recordInteraction: (type: string, data: any, result?: any) => 
      state.recordInteraction(id, type, data, result),
    handleInteraction: (event: InteractionEventData) => 
      state.handleInteraction(id, event),
    clearHistory: () => state.clearInteractionHistory(id),
  }))
}

export default useCharacterStore

