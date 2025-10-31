/**
 * useKeyboardShortcuts Hook 测试套件
 * 
 * 测试键盘快捷键管理相关功能，避免循环依赖导致的内存问题
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act } from '@testing-library/react'
import type { ShortcutConfig } from '@/types/shortcuts'

// ==================== Mock 必须在导入之前设置 ====================

const mockInvoke = vi.fn().mockResolvedValue(undefined)

vi.mock('@/hooks/useTauri', () => ({
  useTauri: () => ({
    isAvailable: false,
    environment: null,
    error: null,
    isTauriEnv: false,
    tauriVersion: '1.0.0',
    invoke: mockInvoke,
    listen: vi.fn().mockResolvedValue(() => {}),
    emit: vi.fn().mockResolvedValue(undefined),
    checkUpdate: vi.fn().mockResolvedValue(null),
    installUpdate: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
  })
}))

// Mock Tauri globals
Object.defineProperty(window, '__TAURI__', {
  value: { invoke: mockInvoke },
  writable: true,
})

// Mock Tauri APIs
vi.mock('@tauri-apps/api/globalShortcut', () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
  unregisterAll: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}))

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { renderHook, mockConsole } from '../../utils/test-utils'

// ==================== 测试数据 ====================

const createMockShortcut = (id: string): ShortcutConfig => ({
  id,
  name: `测试快捷键 ${id}`,
  key: 'n',
  description: '测试用快捷键',
  category: 'chat',
  modifiers: { ctrl: true, alt: false, shift: false, meta: false },
  scope: 'local',
  enabled: true,
  callback: vi.fn(),
})

// ==================== 测试套件 ====================

describe('useKeyboardShortcuts Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础功能测试', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      expect(result.current.getRegisteredShortcuts()).toEqual([])
      expect(result.current.isInitializing).toBe(false)
      expect(typeof result.current.register).toBe('function')
      expect(typeof result.current.unregister).toBe('function')
      expect(typeof result.current.updateShortcut).toBe('function')
      expect(typeof result.current.toggleShortcut).toBe('function')
      expect(typeof result.current.checkConflict).toBe('function')
      expect(typeof result.current.validateConfig).toBe('function')
    })

    it('应该注册快捷键', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const mockShortcut = createMockShortcut('test-1')

      let unregisterFn: (() => void) | undefined
      
      act(() => {
        unregisterFn = result.current.register(mockShortcut)
      })

      const registeredShortcuts = result.current.getRegisteredShortcuts()
      expect(registeredShortcuts).toHaveLength(1)
      expect(registeredShortcuts[0].id).toBe('test-1')
      expect(registeredShortcuts[0].name).toBe('测试快捷键 test-1')
      expect(typeof unregisterFn).toBe('function')
    })

    it('应该注销快捷键', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const mockShortcut = createMockShortcut('test-2')
      
      // 先注册
      act(() => {
        result.current.register(mockShortcut)
      })

      expect(result.current.getRegisteredShortcuts()).toHaveLength(1)

      // 再注销
      await act(async () => {
        await result.current.unregister('test-2')
      })

      expect(result.current.getRegisteredShortcuts()).toHaveLength(0)
    })

    it('应该更新快捷键配置', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const mockShortcut = createMockShortcut('test-3')
      
      // 先注册
      act(() => {
        result.current.register(mockShortcut)
      })

      const updatedConfig = { ...mockShortcut, name: '更新的快捷键' }

      // 更新配置
      await act(async () => {
        await result.current.updateShortcut('test-3', updatedConfig)
      })

      const shortcuts = result.current.getRegisteredShortcuts()
      expect(shortcuts[0].name).toBe('更新的快捷键')
    })

    it('应该切换快捷键启用状态', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const mockShortcut = createMockShortcut('test-4')
      
      // 先注册
      act(() => {
        result.current.register(mockShortcut)
      })

      // 禁用
      await act(async () => {
        await result.current.toggleShortcut('test-4', false)
      })

      let shortcuts = result.current.getRegisteredShortcuts()
      expect(shortcuts[0].enabled).toBe(false)

      // 启用
      await act(async () => {
        await result.current.toggleShortcut('test-4', true)
      })

      shortcuts = result.current.getRegisteredShortcuts()
      expect(shortcuts[0].enabled).toBe(true)
    })

    it('应该检测快捷键冲突', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const mockShortcut1 = createMockShortcut('test-5a')
      const mockShortcut2 = createMockShortcut('test-5b') // Same key/modifiers
      
      // 先注册一个快捷键
      act(() => {
        result.current.register(mockShortcut1)
      })

      // 检查冲突
      const conflicts = await act(async () => {
        return await result.current.checkConflict(mockShortcut2)
      })

      expect(conflicts).toContain('test-5a')
    })

    it('应该验证快捷键配置', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const validConfig = createMockShortcut('valid-shortcut')
      
      const isValid = await act(async () => {
        return await result.current.validateConfig(validConfig)
      })

      expect(isValid).toBe(true)

      // 测试无效配置
      const invalidConfig = { ...validConfig, id: '', name: '' }
      
      const isInvalid = await act(async () => {
        return await result.current.validateConfig(invalidConfig as ShortcutConfig)
      })

      expect(isInvalid).toBe(false)
    })

    it('应该获取统计信息', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const mockShortcut1 = createMockShortcut('stat-1')
      const mockShortcut2 = createMockShortcut('stat-2')
      
      // 注册几个快捷键
      act(() => {
        result.current.register(mockShortcut1)
        result.current.register(mockShortcut2)
      })

      const stats = await act(async () => {
        return await result.current.getStatistics()
      })

      expect(stats).toBeDefined()
      expect(stats.total).toBe(2)
      expect(stats.enabled).toBe(2)
    })

    it('应该检查按键是否被按下', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      // 默认情况下按键未被按下
      expect(result.current.isKeyPressed('n')).toBe(false)
      expect(result.current.isKeyPressed('ctrl')).toBe(false)
    })

    it('应该加载预设快捷键', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      expect(() => {
        result.current.loadPresets()
      }).not.toThrow()
    })

    it('应该处理注销所有快捷键', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())
      const mockShortcut1 = createMockShortcut('cleanup-1')
      const mockShortcut2 = createMockShortcut('cleanup-2')
      
      // 注册多个快捷键
      act(() => {
        result.current.register(mockShortcut1)
        result.current.register(mockShortcut2)
      })

      expect(result.current.getRegisteredShortcuts()).toHaveLength(2)

      // 注销所有快捷键
      await act(async () => {
        await result.current.unregisterAll()
      })

      expect(result.current.getRegisteredShortcuts()).toHaveLength(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理不存在的快捷键操作', async () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      // 尝试注销不存在的快捷键
      await expect(
        act(async () => {
          await result.current.unregister('non-existent')
        })
      ).resolves.toBeUndefined() // 应该不抛出错误

      // 尝试切换不存在的快捷键
      await expect(
        act(async () => {
          await result.current.toggleShortcut('non-existent', true)
        })
      ).rejects.toThrow() // 应该抛出错误
    })
  })
})
