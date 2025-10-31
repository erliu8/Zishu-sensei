/**
 * useCharacter Hook 测试套件
 * 
 * 测试角色管理相关功能
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { useCharacter } from '@/hooks/useCharacter'
import { renderHook, waitForNextTick, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================
// 目前 useCharacter 不需要 mock，因为它是一个简单的状态管理 hook

// ==================== 测试数据 ====================

// 测试用的角色数据
const testCharacters = [
  { 
    id: 'hiyori', 
    name: 'Hiyori', 
    avatar: '🌸', 
    description: '温柔的Live2D助手',
    type: 'live2d' as const,
    modelPath: '/live2d_models/hiyori/hiyori.model3.json',
    previewImage: '/live2d_models/hiyori/icon.jpg'
  },
  { 
    id: 'test-character', 
    name: 'Test Character', 
    avatar: '🎭', 
    description: '测试角色',
    type: 'live2d' as const,
    modelPath: '/live2d_models/test/test.model3.json',
    previewImage: '/live2d_models/test/icon.jpg'
  }
]

// ==================== 测试套件 ====================

describe('useCharacter Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础功能', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useCharacter())

      expect(result.current.characterList).toBeDefined()
      expect(Array.isArray(result.current.characterList)).toBe(true)
      expect(result.current.characterList.length).toBeGreaterThan(0)
      expect(result.current.currentCharacter).toBeDefined()
      expect(typeof result.current.switchCharacter).toBe('function')
    })

    it('应该有默认角色', () => {
      const { result } = renderHook(() => useCharacter())

      expect(result.current.currentCharacter).not.toBeNull()
      expect(result.current.currentCharacter?.id).toBe('hiyori')
      expect(result.current.currentCharacter?.name).toBe('Hiyori')
    })

    it('应该包含角色列表', () => {
      const { result } = renderHook(() => useCharacter())

      expect(result.current.characterList).toHaveLength(1)
      
      const firstCharacter = result.current.characterList[0]
      expect(firstCharacter.id).toBe('hiyori')
      expect(firstCharacter.type).toBe('live2d')
      expect(firstCharacter.modelPath).toBeDefined()
    })

    it('应该切换角色', () => {
      const { result } = renderHook(() => useCharacter())

      // 初始角色
      expect(result.current.currentCharacter?.id).toBe('hiyori')

      // 切换到同一个角色（因为只有一个角色）
      act(() => {
        result.current.switchCharacter('hiyori')
      })

      expect(result.current.currentCharacter?.id).toBe('hiyori')
    })

    it('应该处理切换到不存在的角色', () => {
      const { result } = renderHook(() => useCharacter())

      const initialCharacter = result.current.currentCharacter

      // 尝试切换到不存在的角色
      act(() => {
        result.current.switchCharacter('non-existent')
      })

      // 角色不应该改变
      expect(result.current.currentCharacter).toEqual(initialCharacter)
    })
  })

  describe('角色信息验证', () => {
    it('角色数据应该有正确的类型结构', () => {
      const { result } = renderHook(() => useCharacter())

      const character = result.current.characterList[0]
      
      expect(character).toHaveProperty('id')
      expect(character).toHaveProperty('name')
      expect(character).toHaveProperty('avatar')
      expect(character).toHaveProperty('description')
      expect(character).toHaveProperty('type')
      expect(character).toHaveProperty('modelPath')
      expect(character).toHaveProperty('previewImage')
    })

    it('当前角色应该在角色列表中', () => {
      const { result } = renderHook(() => useCharacter())

      const currentCharacterId = result.current.currentCharacter?.id
      const characterIds = result.current.characterList.map(c => c.id)

      expect(characterIds).toContain(currentCharacterId)
    })
  })
})
