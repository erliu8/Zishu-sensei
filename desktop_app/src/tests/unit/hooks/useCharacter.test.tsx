/**
 * useCharacter Hooks 测试套件
 * 
 * 测试虚拟角色管理相关功能，包括模型加载、动画播放、表情控制、语音合成等
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useCharacter,
  useCharacterModel,
  useCharacterAnimations,
  useCharacterExpressions,
  useCharacterVoice,
  useCharacterPhysics,
  useCharacterInteraction,
  useCharacterCustomization
} from '@/hooks/useCharacter'
import { waitForNextTick, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock CharacterService
const mockCharacterService = {
  loadModel: vi.fn(),
  unloadModel: vi.fn(),
  getModelInfo: vi.fn(),
  playAnimation: vi.fn(),
  stopAnimation: vi.fn(),
  setExpression: vi.fn(),
  resetExpression: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  updatePhysics: vi.fn(),
  getAvailableModels: vi.fn(),
  getAvailableAnimations: vi.fn(),
  getAvailableExpressions: vi.fn(),
  saveCustomization: vi.fn(),
  loadCustomization: vi.fn(),
}

// Mock VRM/3D Model APIs
const mockVRMLoader = {
  load: vi.fn(),
  dispose: vi.fn(),
}

// Mock Web Speech API
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(),
}

// Mock Three.js
const mockThree = {
  Scene: vi.fn(),
  WebGLRenderer: vi.fn(),
  PerspectiveCamera: vi.fn(),
  AnimationMixer: vi.fn(),
  Clock: vi.fn(),
}

vi.mock('@/services/characterService', () => ({
  default: mockCharacterService,
}))

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoader: mockVRMLoader,
}))

// ==================== 测试数据 ====================

const mockModelInfo = {
  id: 'default-character',
  name: '默认角色',
  author: 'ZishuAI',
  version: '1.0.0',
  description: '默认虚拟角色模型',
  file_path: '/models/default.vrm',
  thumbnail: '/thumbnails/default.jpg',
  size_bytes: 1024 * 1024 * 5, // 5MB
  format: 'VRM',
  created_at: '2025-01-01T00:00:00Z',
  metadata: {
    bone_count: 60,
    material_count: 8,
    texture_count: 12,
    polygon_count: 15000,
  },
}

const mockCharacterState = {
  model: null,
  loaded: false,
  loading: false,
  error: null,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  visible: true,
}

const mockAnimations = [
  {
    id: 'idle',
    name: '待机',
    duration: 5.0,
    loop: true,
    category: 'basic',
  },
  {
    id: 'wave',
    name: '挥手',
    duration: 2.0,
    loop: false,
    category: 'greeting',
  },
  {
    id: 'talk',
    name: '说话',
    duration: 3.0,
    loop: true,
    category: 'communication',
  },
  {
    id: 'nod',
    name: '点头',
    duration: 1.5,
    loop: false,
    category: 'reaction',
  },
]

const mockExpressions = [
  {
    id: 'neutral',
    name: '中性',
    category: 'basic',
    intensity: 0.0,
  },
  {
    id: 'happy',
    name: '开心',
    category: 'emotion',
    intensity: 0.8,
  },
  {
    id: 'sad',
    name: '难过',
    category: 'emotion',
    intensity: 0.6,
  },
  {
    id: 'surprised',
    name: '惊讶',
    category: 'emotion',
    intensity: 0.9,
  },
  {
    id: 'blink',
    name: '眨眼',
    category: 'automatic',
    intensity: 1.0,
    duration: 0.2,
  },
]

const mockVoiceConfig = {
  enabled: true,
  voice_id: 'female-zh',
  language: 'zh-CN',
  speed: 1.0,
  pitch: 1.0,
  volume: 0.8,
  auto_lip_sync: true,
}

const mockPhysicsConfig = {
  gravity: { x: 0, y: -9.81, z: 0 },
  hair_physics: true,
  cloth_physics: true,
  collision_detection: true,
  physics_quality: 'medium' as const,
}

const mockCustomization = {
  hair_color: '#8B4513',
  eye_color: '#4169E1',
  skin_tone: '#FDBCB4',
  outfit: 'casual',
  accessories: ['glasses', 'earrings'],
  height_scale: 1.0,
  proportions: {
    head: 1.0,
    torso: 1.0,
    legs: 1.0,
  },
}

// ==================== 测试套件 ====================

describe('useCharacter Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
    
    // Mock global APIs
    global.speechSynthesis = mockSpeechSynthesis
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockCharacterService.loadModel.mockResolvedValue(mockModelInfo)
    mockCharacterService.getModelInfo.mockReturnValue(mockModelInfo)
    mockCharacterService.getAvailableModels.mockResolvedValue([mockModelInfo])
    mockCharacterService.playAnimation.mockResolvedValue(undefined)
    mockCharacterService.setExpression.mockResolvedValue(undefined)
    mockVRMLoader.load.mockResolvedValue({ scene: {}, vrm: {} })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础角色管理', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useCharacter())

      expect(result.current.character).toBe(null)
      expect(result.current.loaded).toBe(false)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.loadCharacter).toBe('function')
      expect(typeof result.current.unloadCharacter).toBe('function')
    })

    it('应该加载角色模型', async () => {
      const { result } = renderHook(() => useCharacter())

      await act(async () => {
        await result.current.loadCharacter('default-character')
      })

      expect(mockCharacterService.loadModel).toHaveBeenCalledWith('default-character')
      expect(result.current.character).toEqual(mockModelInfo)
      expect(result.current.loaded).toBe(true)
      expect(result.current.loading).toBe(false)
    })

    it('应该管理加载状态', async () => {
      let resolveLoad: (value: any) => void
      const loadPromise = new Promise(resolve => {
        resolveLoad = resolve
      })

      mockCharacterService.loadModel.mockReturnValue(loadPromise)

      const { result } = renderHook(() => useCharacter())

      act(() => {
        result.current.loadCharacter('default-character')
      })

      expect(result.current.loading).toBe(true)

      await act(async () => {
        resolveLoad!(mockModelInfo)
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.loaded).toBe(true)
    })

    it('应该处理加载错误', async () => {
      const testError = new Error('Model load failed')
      mockCharacterService.loadModel.mockRejectedValue(testError)

      const { result } = renderHook(() => useCharacter())

      await expect(
        act(async () => {
          await result.current.loadCharacter('invalid-model')
        })
      ).rejects.toThrow('Model load failed')

      expect(result.current.error).toBe('加载角色模型失败')
      expect(result.current.loaded).toBe(false)
    })

    it('应该卸载角色模型', async () => {
      const { result } = renderHook(() => useCharacter())

      // 先加载
      await act(async () => {
        await result.current.loadCharacter('default-character')
      })

      expect(result.current.loaded).toBe(true)

      // 再卸载
      await act(async () => {
        await result.current.unloadCharacter()
      })

      expect(mockCharacterService.unloadModel).toHaveBeenCalled()
      expect(result.current.character).toBe(null)
      expect(result.current.loaded).toBe(false)
    })

    it('应该更新角色位置和旋转', () => {
      const { result } = renderHook(() => useCharacter())

      // 更新位置
      act(() => {
        result.current.setPosition({ x: 1, y: 2, z: 3 })
      })

      expect(result.current.position).toEqual({ x: 1, y: 2, z: 3 })

      // 更新旋转
      act(() => {
        result.current.setRotation({ x: 0, y: Math.PI, z: 0 })
      })

      expect(result.current.rotation).toEqual({ x: 0, y: Math.PI, z: 0 })
    })

    it('应该控制角色可见性', () => {
      const { result } = renderHook(() => useCharacter())

      // 隐藏角色
      act(() => {
        result.current.setVisible(false)
      })

      expect(result.current.visible).toBe(false)

      // 显示角色
      act(() => {
        result.current.setVisible(true)
      })

      expect(result.current.visible).toBe(true)
    })
  })
})

describe('useCharacterModel Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCharacterService.getAvailableModels.mockResolvedValue([mockModelInfo])
  })

  describe('角色模型管理', () => {
    it('应该获取可用模型列表', async () => {
      const { result } = renderHook(() => useCharacterModel())

      await waitFor(() => {
        expect(result.current.availableModels).toEqual([mockModelInfo])
        expect(result.current.loading).toBe(false)
      })

      expect(mockCharacterService.getAvailableModels).toHaveBeenCalled()
    })

    it('应该预加载模型', async () => {
      const { result } = renderHook(() => useCharacterModel())

      await act(async () => {
        await result.current.preloadModel('default-character')
      })

      expect(mockCharacterService.loadModel).toHaveBeenCalledWith('default-character')
    })

    it('应该获取模型详细信息', async () => {
      const { result } = renderHook(() => useCharacterModel())

      let modelInfo: any
      await act(async () => {
        modelInfo = await result.current.getModelInfo('default-character')
      })

      expect(mockCharacterService.getModelInfo).toHaveBeenCalledWith('default-character')
      expect(modelInfo).toEqual(mockModelInfo)
    })
  })
})

describe('useCharacterAnimations Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCharacterService.getAvailableAnimations.mockResolvedValue(mockAnimations)
    mockCharacterService.playAnimation.mockResolvedValue(undefined)
    mockCharacterService.stopAnimation.mockResolvedValue(undefined)
  })

  describe('角色动画控制', () => {
    it('应该获取可用动画列表', async () => {
      const { result } = renderHook(() => useCharacterAnimations())

      await waitFor(() => {
        expect(result.current.availableAnimations).toEqual(mockAnimations)
        expect(result.current.loading).toBe(false)
      })

      expect(mockCharacterService.getAvailableAnimations).toHaveBeenCalled()
    })

    it('应该播放动画', async () => {
      const { result } = renderHook(() => useCharacterAnimations())

      await act(async () => {
        await result.current.playAnimation('wave')
      })

      expect(mockCharacterService.playAnimation).toHaveBeenCalledWith('wave', undefined)
      expect(result.current.currentAnimation).toBe('wave')
      expect(result.current.isPlaying).toBe(true)
    })

    it('应该播放动画并设置选项', async () => {
      const { result } = renderHook(() => useCharacterAnimations())

      const options = {
        loop: false,
        speed: 0.5,
        crossfade: 0.3,
      }

      await act(async () => {
        await result.current.playAnimation('talk', options)
      })

      expect(mockCharacterService.playAnimation).toHaveBeenCalledWith('talk', options)
    })

    it('应该停止动画', async () => {
      const { result } = renderHook(() => useCharacterAnimations())

      // 先播放动画
      await act(async () => {
        await result.current.playAnimation('idle')
      })

      expect(result.current.isPlaying).toBe(true)

      // 再停止动画
      await act(async () => {
        await result.current.stopAnimation()
      })

      expect(mockCharacterService.stopAnimation).toHaveBeenCalled()
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.currentAnimation).toBe(null)
    })

    it('应该按分类过滤动画', async () => {
      const { result } = renderHook(() => useCharacterAnimations())

      await waitFor(() => {
        expect(result.current.availableAnimations).toBeTruthy()
      })

      const basicAnimations = result.current.getAnimationsByCategory('basic')
      expect(basicAnimations).toEqual([mockAnimations[0]]) // idle animation

      const greetingAnimations = result.current.getAnimationsByCategory('greeting')
      expect(greetingAnimations).toEqual([mockAnimations[1]]) // wave animation
    })

    it('应该处理动画播放错误', async () => {
      const testError = new Error('Animation playback failed')
      mockCharacterService.playAnimation.mockRejectedValue(testError)

      const { result } = renderHook(() => useCharacterAnimations())

      await expect(
        act(async () => {
          await result.current.playAnimation('invalid-animation')
        })
      ).rejects.toThrow('Animation playback failed')

      expect(result.current.error).toBe('动画播放失败')
    })
  })
})

describe('useCharacterExpressions Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCharacterService.getAvailableExpressions.mockResolvedValue(mockExpressions)
    mockCharacterService.setExpression.mockResolvedValue(undefined)
    mockCharacterService.resetExpression.mockResolvedValue(undefined)
  })

  describe('角色表情控制', () => {
    it('应该获取可用表情列表', async () => {
      const { result } = renderHook(() => useCharacterExpressions())

      await waitFor(() => {
        expect(result.current.availableExpressions).toEqual(mockExpressions)
        expect(result.current.loading).toBe(false)
      })

      expect(mockCharacterService.getAvailableExpressions).toHaveBeenCalled()
    })

    it('应该设置表情', async () => {
      const { result } = renderHook(() => useCharacterExpressions())

      await act(async () => {
        await result.current.setExpression('happy', 0.8)
      })

      expect(mockCharacterService.setExpression).toHaveBeenCalledWith('happy', 0.8)
      expect(result.current.currentExpression).toBe('happy')
    })

    it('应该重置表情到中性', async () => {
      const { result } = renderHook(() => useCharacterExpressions())

      // 先设置表情
      await act(async () => {
        await result.current.setExpression('happy', 0.8)
      })

      expect(result.current.currentExpression).toBe('happy')

      // 再重置
      await act(async () => {
        await result.current.resetExpression()
      })

      expect(mockCharacterService.resetExpression).toHaveBeenCalled()
      expect(result.current.currentExpression).toBe('neutral')
    })

    it('应该设置混合表情', async () => {
      const { result } = renderHook(() => useCharacterExpressions())

      const expressions = [
        { id: 'happy', intensity: 0.6 },
        { id: 'surprised', intensity: 0.4 },
      ]

      await act(async () => {
        await result.current.setMixedExpression(expressions)
      })

      expect(mockCharacterService.setExpression).toHaveBeenCalledTimes(2)
    })

    it('应该启用自动眨眼', () => {
      vi.useFakeTimers()

      const { result } = renderHook(() => useCharacterExpressions())

      act(() => {
        result.current.enableAutoBlink(true)
      })

      expect(result.current.autoBlinkEnabled).toBe(true)

      // 快进时间触发眨眼
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(mockCharacterService.setExpression).toHaveBeenCalledWith('blink', 1.0)

      vi.useRealTimers()
    })
  })
})

describe('useCharacterVoice Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCharacterService.speak.mockResolvedValue(undefined)
    mockCharacterService.stopSpeaking.mockResolvedValue(undefined)
    mockSpeechSynthesis.getVoices.mockReturnValue([
      { name: 'Female Voice', lang: 'zh-CN' },
      { name: 'Male Voice', lang: 'zh-CN' },
    ])
  })

  describe('角色语音合成', () => {
    it('应该返回初始语音配置', () => {
      const { result } = renderHook(() => useCharacterVoice())

      expect(result.current.config).toEqual(mockVoiceConfig)
      expect(result.current.isSpeaking).toBe(false)
      expect(typeof result.current.speak).toBe('function')
      expect(typeof result.current.stopSpeaking).toBe('function')
    })

    it('应该合成语音', async () => {
      const { result } = renderHook(() => useCharacterVoice())

      await act(async () => {
        await result.current.speak('Hello, world!')
      })

      expect(mockCharacterService.speak).toHaveBeenCalledWith('Hello, world!', mockVoiceConfig)
      expect(result.current.isSpeaking).toBe(false) // 异步完成后
    })

    it('应该停止语音合成', async () => {
      const { result } = renderHook(() => useCharacterVoice())

      // 先开始合成
      let resolveSpeech: () => void
      const speechPromise = new Promise<void>(resolve => {
        resolveSpeech = resolve
      })
      mockCharacterService.speak.mockReturnValue(speechPromise)

      act(() => {
        result.current.speak('Long text to speak...')
      })

      expect(result.current.isSpeaking).toBe(true)

      // 停止合成
      await act(async () => {
        await result.current.stopSpeaking()
      })

      expect(mockCharacterService.stopSpeaking).toHaveBeenCalled()
      expect(result.current.isSpeaking).toBe(false)
    })

    it('应该更新语音配置', () => {
      const { result } = renderHook(() => useCharacterVoice())

      const newConfig = {
        speed: 1.2,
        pitch: 0.8,
        volume: 0.9,
      }

      act(() => {
        result.current.updateConfig(newConfig)
      })

      expect(result.current.config).toEqual({
        ...mockVoiceConfig,
        ...newConfig,
      })
    })

    it('应该获取可用语音列表', () => {
      const { result } = renderHook(() => useCharacterVoice())

      const voices = result.current.getAvailableVoices()

      expect(voices).toEqual([
        { name: 'Female Voice', lang: 'zh-CN' },
        { name: 'Male Voice', lang: 'zh-CN' },
      ])
    })

    it('应该处理语音合成错误', async () => {
      const testError = new Error('Speech synthesis failed')
      mockCharacterService.speak.mockRejectedValue(testError)

      const { result } = renderHook(() => useCharacterVoice())

      await expect(
        act(async () => {
          await result.current.speak('Test text')
        })
      ).rejects.toThrow('Speech synthesis failed')

      expect(result.current.error).toBe('语音合成失败')
    })
  })
})

describe('useCharacterPhysics Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCharacterService.updatePhysics.mockResolvedValue(undefined)
  })

  describe('角色物理系统', () => {
    it('应该返回物理配置', () => {
      const { result } = renderHook(() => useCharacterPhysics())

      expect(result.current.config).toEqual(mockPhysicsConfig)
      expect(typeof result.current.updateConfig).toBe('function')
      expect(typeof result.current.resetPhysics).toBe('function')
    })

    it('应该更新物理配置', async () => {
      const { result } = renderHook(() => useCharacterPhysics())

      const newConfig = {
        gravity: { x: 0, y: -5, z: 0 },
        hair_physics: false,
      }

      await act(async () => {
        await result.current.updateConfig(newConfig)
      })

      expect(mockCharacterService.updatePhysics).toHaveBeenCalledWith({
        ...mockPhysicsConfig,
        ...newConfig,
      })

      expect(result.current.config).toEqual({
        ...mockPhysicsConfig,
        ...newConfig,
      })
    })

    it('应该重置物理系统', async () => {
      const { result } = renderHook(() => useCharacterPhysics())

      await act(async () => {
        await result.current.resetPhysics()
      })

      expect(mockCharacterService.updatePhysics).toHaveBeenCalledWith(mockPhysicsConfig)
    })

    it('应该启用和禁用物理效果', async () => {
      const { result } = renderHook(() => useCharacterPhysics())

      // 禁用头发物理
      await act(async () => {
        await result.current.toggleHairPhysics(false)
      })

      expect(result.current.config.hair_physics).toBe(false)

      // 启用布料物理
      await act(async () => {
        await result.current.toggleClothPhysics(true)
      })

      expect(result.current.config.cloth_physics).toBe(true)
    })
  })
})

describe('useCharacterCustomization Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCharacterService.saveCustomization.mockResolvedValue(undefined)
    mockCharacterService.loadCustomization.mockResolvedValue(mockCustomization)
  })

  describe('角色自定义', () => {
    it('应该返回自定义配置', () => {
      const { result } = renderHook(() => useCharacterCustomization())

      expect(result.current.customization).toEqual(mockCustomization)
      expect(typeof result.current.updateCustomization).toBe('function')
      expect(typeof result.current.saveCustomization).toBe('function')
    })

    it('应该更新自定义配置', () => {
      const { result } = renderHook(() => useCharacterCustomization())

      const updates = {
        hair_color: '#FF0000',
        eye_color: '#00FF00',
      }

      act(() => {
        result.current.updateCustomization(updates)
      })

      expect(result.current.customization).toEqual({
        ...mockCustomization,
        ...updates,
      })
    })

    it('应该保存自定义配置', async () => {
      const { result } = renderHook(() => useCharacterCustomization())

      await act(async () => {
        await result.current.saveCustomization()
      })

      expect(mockCharacterService.saveCustomization).toHaveBeenCalledWith(mockCustomization)
    })

    it('应该加载自定义配置', async () => {
      const { result } = renderHook(() => useCharacterCustomization())

      await act(async () => {
        await result.current.loadCustomization('preset-1')
      })

      expect(mockCharacterService.loadCustomization).toHaveBeenCalledWith('preset-1')
      expect(result.current.customization).toEqual(mockCustomization)
    })

    it('应该重置自定义配置', () => {
      const { result } = renderHook(() => useCharacterCustomization())

      // 先更新配置
      act(() => {
        result.current.updateCustomization({ hair_color: '#FF0000' })
      })

      // 再重置
      act(() => {
        result.current.resetCustomization()
      })

      expect(result.current.customization).toEqual(mockCustomization)
    })
  })
})

// ==================== 集成测试 ====================

describe('Character Hooks 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // 设置所有服务的 mock 返回值
    mockCharacterService.loadModel.mockResolvedValue(mockModelInfo)
    mockCharacterService.getAvailableAnimations.mockResolvedValue(mockAnimations)
    mockCharacterService.getAvailableExpressions.mockResolvedValue(mockExpressions)
    mockCharacterService.playAnimation.mockResolvedValue(undefined)
    mockCharacterService.setExpression.mockResolvedValue(undefined)
    mockCharacterService.speak.mockResolvedValue(undefined)
  })

  it('应该完成角色交互完整流程', async () => {
    const characterHook = renderHook(() => useCharacter())
    const animationHook = renderHook(() => useCharacterAnimations())
    const expressionHook = renderHook(() => useCharacterExpressions())
    const voiceHook = renderHook(() => useCharacterVoice())

    // 1. 加载角色模型
    await act(async () => {
      await characterHook.result.current.loadCharacter('default-character')
    })

    expect(characterHook.result.current.loaded).toBe(true)

    // 2. 等待动画和表情数据加载
    await waitFor(() => {
      expect(animationHook.result.current.availableAnimations).toBeTruthy()
      expect(expressionHook.result.current.availableExpressions).toBeTruthy()
    })

    // 3. 播放打招呼动画
    await act(async () => {
      await animationHook.result.current.playAnimation('wave')
    })

    // 4. 设置开心表情
    await act(async () => {
      await expressionHook.result.current.setExpression('happy', 0.8)
    })

    // 5. 合成语音
    await act(async () => {
      await voiceHook.result.current.speak('你好，欢迎使用紫舒AI！')
    })

    // 验证所有操作成功
    expect(mockCharacterService.loadModel).toHaveBeenCalled()
    expect(mockCharacterService.playAnimation).toHaveBeenCalledWith('wave', undefined)
    expect(mockCharacterService.setExpression).toHaveBeenCalledWith('happy', 0.8)
    expect(mockCharacterService.speak).toHaveBeenCalledWith('你好，欢迎使用紫舒AI！', mockVoiceConfig)
  })

  it('应该处理角色自定义和物理效果', async () => {
    const customizationHook = renderHook(() => useCharacterCustomization())
    const physicsHook = renderHook(() => useCharacterPhysics())

    // 1. 更新角色外观
    act(() => {
      customizationHook.result.current.updateCustomization({
        hair_color: '#FF69B4',
        eye_color: '#87CEEB',
      })
    })

    // 2. 保存自定义配置
    await act(async () => {
      await customizationHook.result.current.saveCustomization()
    })

    // 3. 调整物理效果
    await act(async () => {
      await physicsHook.result.current.updateConfig({
        hair_physics: true,
        cloth_physics: true,
        physics_quality: 'high',
      })
    })

    expect(mockCharacterService.saveCustomization).toHaveBeenCalled()
    expect(mockCharacterService.updatePhysics).toHaveBeenCalled()
  })

  it('应该处理多个表情和动画的混合', async () => {
    const animationHook = renderHook(() => useCharacterAnimations())
    const expressionHook = renderHook(() => useCharacterExpressions())

    // 等待数据加载
    await waitFor(() => {
      expect(animationHook.result.current.availableAnimations).toBeTruthy()
      expect(expressionHook.result.current.availableExpressions).toBeTruthy()
    })

    // 同时播放说话动画和设置混合表情
    await Promise.all([
      act(async () => {
        await animationHook.result.current.playAnimation('talk', { loop: true })
      }),
      act(async () => {
        await expressionHook.result.current.setMixedExpression([
          { id: 'happy', intensity: 0.6 },
          { id: 'surprised', intensity: 0.3 },
        ])
      }),
    ])

    expect(mockCharacterService.playAnimation).toHaveBeenCalledWith('talk', { loop: true })
    expect(mockCharacterService.setExpression).toHaveBeenCalledTimes(2)
  })
})
