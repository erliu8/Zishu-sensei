/**
 * useKeyboardShortcuts Hook 测试套件
 * 
 * 测试键盘快捷键管理相关功能，包括快捷键注册、监听、冲突检测、组合键处理等
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useKeyboardShortcuts,
  useGlobalShortcuts,
  useLocalShortcuts,
  useShortcutRecorder,
  useShortcutConflicts,
  useShortcutCategories,
  useShortcutPresets
} from '@/hooks/useKeyboardShortcuts'
import { waitForNextTick, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock KeyboardService
const mockKeyboardService = {
  registerShortcut: vi.fn(),
  unregisterShortcut: vi.fn(),
  registerGlobalShortcut: vi.fn(),
  unregisterGlobalShortcut: vi.fn(),
  checkConflicts: vi.fn(),
  getActiveShortcuts: vi.fn(),
  isShortcutValid: vi.fn(),
  parseShortcut: vi.fn(),
  formatShortcut: vi.fn(),
  getShortcutCategories: vi.fn(),
  getShortcutPresets: vi.fn(),
  saveCustomPreset: vi.fn(),
  loadPreset: vi.fn(),
}

// Mock event listener
const mockEventListeners = new Map()

// Mock Tauri API for global shortcuts
const mockTauri = {
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
}

// Mock DOM event listeners
const originalAddEventListener = window.addEventListener
const originalRemoveEventListener = window.removeEventListener

vi.mock('@/services/keyboardService', () => ({
  default: mockKeyboardService,
}))

vi.mock('@tauri-apps/api/globalShortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
}))

// ==================== 测试数据 ====================

const mockShortcuts = {
  'ctrl+n': {
    id: 'new-chat',
    key: 'ctrl+n',
    description: '新建对话',
    category: 'chat',
    handler: vi.fn(),
    enabled: true,
    global: false,
  },
  'ctrl+shift+z': {
    id: 'toggle-visibility',
    key: 'ctrl+shift+z',
    description: '切换显示/隐藏',
    category: 'global',
    handler: vi.fn(),
    enabled: true,
    global: true,
  },
  'f12': {
    id: 'screenshot',
    key: 'f12',
    description: '截图',
    category: 'utility',
    handler: vi.fn(),
    enabled: true,
    global: true,
  },
}

const mockCategories = [
  {
    id: 'global',
    name: '全局快捷键',
    description: '在任何地方都可以使用的快捷键',
    shortcuts: ['ctrl+shift+z', 'f12'],
  },
  {
    id: 'chat',
    name: '对话快捷键',
    description: '对话界面中的快捷键',
    shortcuts: ['ctrl+n', 'ctrl+l', 'enter'],
  },
  {
    id: 'utility',
    name: '工具快捷键',
    description: '实用工具相关快捷键',
    shortcuts: ['f12', 'ctrl+,'],
  },
]

const mockPresets = [
  {
    id: 'default',
    name: '默认预设',
    description: '系统默认快捷键配置',
    shortcuts: mockShortcuts,
    built_in: true,
  },
  {
    id: 'vscode-like',
    name: 'VSCode 风格',
    description: '类似 VSCode 的快捷键配置',
    shortcuts: {
      'ctrl+shift+p': { id: 'command-palette', key: 'ctrl+shift+p' },
      'ctrl+`': { id: 'toggle-terminal', key: 'ctrl+`' },
    },
    built_in: true,
  },
]

const mockConflicts = [
  {
    shortcut: 'ctrl+n',
    conflicts: [
      {
        id: 'browser-new-tab',
        source: 'system',
        description: '浏览器新标签页',
      },
    ],
  },
]

// ==================== 测试套件 ====================

describe('useKeyboardShortcuts Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
    
    // Mock DOM event listeners
    window.addEventListener = vi.fn((event, handler, options) => {
      const key = `${event}-${handler.toString().slice(0, 50)}`
      mockEventListeners.set(key, { event, handler, options })
    })

    window.removeEventListener = vi.fn((event, handler) => {
      const key = `${event}-${handler.toString().slice(0, 50)}`
      mockEventListeners.delete(key)
    })
  })

  afterAll(() => {
    consoleMock.restore()
    window.addEventListener = originalAddEventListener
    window.removeEventListener = originalRemoveEventListener
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventListeners.clear()
    
    // Setup default mocks
    mockKeyboardService.registerShortcut.mockResolvedValue(true)
    mockKeyboardService.unregisterShortcut.mockResolvedValue(true)
    mockKeyboardService.getActiveShortcuts.mockReturnValue(mockShortcuts)
    mockKeyboardService.isShortcutValid.mockReturnValue(true)
    mockKeyboardService.parseShortcut.mockImplementation((key) => ({
      ctrl: key.includes('ctrl'),
      shift: key.includes('shift'),
      alt: key.includes('alt'),
      meta: key.includes('meta'),
      key: key.split('+').pop(),
    }))
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础快捷键功能', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      expect(result.current.shortcuts).toEqual({})
      expect(result.current.enabled).toBe(true)
      expect(typeof result.current.register).toBe('function')
      expect(typeof result.current.unregister).toBe('function')
      expect(typeof result.current.enable).toBe('function')
      expect(typeof result.current.disable).toBe('function')
    })

    it('应该注册快捷键', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      const handler = vi.fn()
      
      act(() => {
        result.current.register('ctrl+n', handler, {
          description: '新建对话',
          category: 'chat',
        })
      })

      expect(mockKeyboardService.registerShortcut).toHaveBeenCalledWith({
        key: 'ctrl+n',
        handler,
        description: '新建对话',
        category: 'chat',
      })

      expect(result.current.shortcuts['ctrl+n']).toBeDefined()
      expect(result.current.shortcuts['ctrl+n'].handler).toBe(handler)
    })

    it('应该注销快捷键', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      const handler = vi.fn()
      
      // 先注册
      act(() => {
        result.current.register('ctrl+n', handler)
      })

      expect(result.current.shortcuts['ctrl+n']).toBeDefined()

      // 再注销
      act(() => {
        result.current.unregister('ctrl+n')
      })

      expect(mockKeyboardService.unregisterShortcut).toHaveBeenCalledWith('ctrl+n')
      expect(result.current.shortcuts['ctrl+n']).toBeUndefined()
    })

    it('应该禁用和启用快捷键', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      // 禁用
      act(() => {
        result.current.disable()
      })

      expect(result.current.enabled).toBe(false)

      // 启用
      act(() => {
        result.current.enable()
      })

      expect(result.current.enabled).toBe(true)
    })

    it('应该处理快捷键冲突', async () => {
      mockKeyboardService.registerShortcut.mockRejectedValue(
        new Error('Shortcut conflict detected')
      )

      const { result } = renderHook(() => useKeyboardShortcuts())

      const handler = vi.fn()
      
      await expect(
        act(async () => {
          await result.current.register('ctrl+n', handler)
        })
      ).rejects.toThrow('Shortcut conflict detected')
    })

    it('应该在组件卸载时清理快捷键', () => {
      const { result, unmount } = renderHook(() => useKeyboardShortcuts())

      const handler1 = vi.fn()
      const handler2 = vi.fn()

      // 注册多个快捷键
      act(() => {
        result.current.register('ctrl+n', handler1)
        result.current.register('ctrl+s', handler2)
      })

      // 卸载组件
      unmount()

      expect(mockKeyboardService.unregisterShortcut).toHaveBeenCalledWith('ctrl+n')
      expect(mockKeyboardService.unregisterShortcut).toHaveBeenCalledWith('ctrl+s')
    })
  })

  describe('键盘事件处理', () => {
    it('应该监听键盘事件', () => {
      renderHook(() => useKeyboardShortcuts())

      expect(window.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('应该正确处理按键组合', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      const handler = vi.fn()
      
      act(() => {
        result.current.register('ctrl+n', handler)
      })

      // 模拟按键事件
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      })

      // 找到注册的事件处理器并调用
      const listeners = Array.from(mockEventListeners.values())
      const keydownListener = listeners.find(l => l.event === 'keydown')
      
      if (keydownListener) {
        keydownListener.handler(keyEvent)
        expect(handler).toHaveBeenCalled()
      }
    })

    it('应该阻止默认行为和事件冒泡', () => {
      const { result } = renderHook(() => useKeyboardShortcuts())

      const handler = vi.fn()
      
      act(() => {
        result.current.register('ctrl+n', handler, {
          preventDefault: true,
          stopPropagation: true,
        })
      })

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
      })

      // Mock preventDefault and stopPropagation
      keyEvent.preventDefault = vi.fn()
      keyEvent.stopPropagation = vi.fn()

      const listeners = Array.from(mockEventListeners.values())
      const keydownListener = listeners.find(l => l.event === 'keydown')
      
      if (keydownListener) {
        keydownListener.handler(keyEvent)
        expect(keyEvent.preventDefault).toHaveBeenCalled()
        expect(keyEvent.stopPropagation).toHaveBeenCalled()
      }
    })
  })
})

describe('useGlobalShortcuts Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKeyboardService.registerGlobalShortcut.mockResolvedValue(true)
    mockKeyboardService.unregisterGlobalShortcut.mockResolvedValue(true)
  })

  describe('全局快捷键', () => {
    it('应该注册全局快捷键', async () => {
      const { result } = renderHook(() => useGlobalShortcuts())

      const handler = vi.fn()

      await act(async () => {
        await result.current.register('ctrl+shift+z', handler, {
          description: '切换显示',
        })
      })

      expect(mockKeyboardService.registerGlobalShortcut).toHaveBeenCalledWith({
        key: 'ctrl+shift+z',
        handler,
        description: '切换显示',
      })

      expect(result.current.shortcuts['ctrl+shift+z']).toBeDefined()
    })

    it('应该注销全局快捷键', async () => {
      const { result } = renderHook(() => useGlobalShortcuts())

      const handler = vi.fn()

      // 先注册
      await act(async () => {
        await result.current.register('ctrl+shift+z', handler)
      })

      // 再注销
      await act(async () => {
        await result.current.unregister('ctrl+shift+z')
      })

      expect(mockKeyboardService.unregisterGlobalShortcut).toHaveBeenCalledWith('ctrl+shift+z')
      expect(result.current.shortcuts['ctrl+shift+z']).toBeUndefined()
    })

    it('应该处理全局快捷键注册失败', async () => {
      const testError = new Error('Global shortcut registration failed')
      mockKeyboardService.registerGlobalShortcut.mockRejectedValue(testError)

      const { result } = renderHook(() => useGlobalShortcuts())

      const handler = vi.fn()

      await expect(
        act(async () => {
          await result.current.register('ctrl+shift+z', handler)
        })
      ).rejects.toThrow('Global shortcut registration failed')
    })
  })
})

describe('useShortcutRecorder Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('快捷键录制', () => {
    it('应该开始和停止录制', () => {
      const { result } = renderHook(() => useShortcutRecorder())

      expect(result.current.recording).toBe(false)
      expect(result.current.recordedKeys).toEqual([])

      // 开始录制
      act(() => {
        result.current.startRecording()
      })

      expect(result.current.recording).toBe(true)

      // 停止录制
      act(() => {
        result.current.stopRecording()
      })

      expect(result.current.recording).toBe(false)
    })

    it('应该录制按键序列', () => {
      const { result } = renderHook(() => useShortcutRecorder())

      // 开始录制
      act(() => {
        result.current.startRecording()
      })

      // 模拟按键
      const keyEvent1 = new KeyboardEvent('keydown', {
        key: 'Control',
        ctrlKey: true,
      })

      const keyEvent2 = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
      })

      // 录制按键
      act(() => {
        result.current.recordKey('ctrl')
        result.current.recordKey('n')
      })

      expect(result.current.recordedKeys).toContain('ctrl')
      expect(result.current.recordedKeys).toContain('n')
    })

    it('应该清除录制的按键', () => {
      const { result } = renderHook(() => useShortcutRecorder())

      act(() => {
        result.current.startRecording()
        result.current.recordKey('ctrl')
        result.current.recordKey('n')
      })

      expect(result.current.recordedKeys).toHaveLength(2)

      act(() => {
        result.current.clearRecording()
      })

      expect(result.current.recordedKeys).toEqual([])
    })

    it('应该生成快捷键字符串', () => {
      const { result } = renderHook(() => useShortcutRecorder())

      act(() => {
        result.current.startRecording()
        result.current.recordKey('ctrl')
        result.current.recordKey('shift')
        result.current.recordKey('z')
      })

      const shortcut = result.current.getShortcutString()
      expect(shortcut).toBe('ctrl+shift+z')
    })
  })
})

describe('useShortcutConflicts Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKeyboardService.checkConflicts.mockResolvedValue(mockConflicts)
  })

  describe('快捷键冲突检测', () => {
    it('应该检测快捷键冲突', async () => {
      const { result } = renderHook(() => useShortcutConflicts())

      let conflicts: any
      await act(async () => {
        conflicts = await result.current.checkConflicts('ctrl+n')
      })

      expect(mockKeyboardService.checkConflicts).toHaveBeenCalledWith('ctrl+n')
      expect(conflicts).toEqual(mockConflicts)
    })

    it('应该批量检测冲突', async () => {
      const { result } = renderHook(() => useShortcutConflicts())

      const shortcuts = ['ctrl+n', 'ctrl+s', 'f12']

      let allConflicts: any
      await act(async () => {
        allConflicts = await result.current.checkMultipleConflicts(shortcuts)
      })

      expect(mockKeyboardService.checkConflicts).toHaveBeenCalledTimes(3)
      expect(allConflicts).toHaveLength(3)
    })

    it('应该处理冲突检测错误', async () => {
      const testError = new Error('Conflict check failed')
      mockKeyboardService.checkConflicts.mockRejectedValue(testError)

      const { result } = renderHook(() => useShortcutConflicts())

      await expect(
        act(async () => {
          await result.current.checkConflicts('ctrl+n')
        })
      ).rejects.toThrow('Conflict check failed')
    })
  })
})

describe('useShortcutCategories Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKeyboardService.getShortcutCategories.mockResolvedValue(mockCategories)
  })

  describe('快捷键分类', () => {
    it('应该获取快捷键分类', async () => {
      const { result } = renderHook(() => useShortcutCategories())

      await waitFor(() => {
        expect(result.current.categories).toEqual(mockCategories)
        expect(result.current.loading).toBe(false)
      })

      expect(mockKeyboardService.getShortcutCategories).toHaveBeenCalled()
    })

    it('应该按分类过滤快捷键', async () => {
      const { result } = renderHook(() => useShortcutCategories())

      await waitFor(() => {
        expect(result.current.categories).toBeTruthy()
      })

      const chatShortcuts = result.current.getShortcutsByCategory('chat')
      expect(chatShortcuts).toHaveLength(3) // ctrl+n, ctrl+l, enter
    })

    it('应该处理分类获取错误', async () => {
      const testError = new Error('Categories load failed')
      mockKeyboardService.getShortcutCategories.mockRejectedValue(testError)

      const { result } = renderHook(() => useShortcutCategories())

      await waitFor(() => {
        expect(result.current.error).toBe('获取快捷键分类失败')
      })
    })
  })
})

describe('useShortcutPresets Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKeyboardService.getShortcutPresets.mockResolvedValue(mockPresets)
    mockKeyboardService.loadPreset.mockResolvedValue(undefined)
    mockKeyboardService.saveCustomPreset.mockResolvedValue(undefined)
  })

  describe('快捷键预设', () => {
    it('应该获取快捷键预设', async () => {
      const { result } = renderHook(() => useShortcutPresets())

      await waitFor(() => {
        expect(result.current.presets).toEqual(mockPresets)
        expect(result.current.loading).toBe(false)
      })

      expect(mockKeyboardService.getShortcutPresets).toHaveBeenCalled()
    })

    it('应该加载预设', async () => {
      const { result } = renderHook(() => useShortcutPresets())

      await waitFor(() => {
        expect(result.current.presets).toBeTruthy()
      })

      await act(async () => {
        await result.current.loadPreset('vscode-like')
      })

      expect(mockKeyboardService.loadPreset).toHaveBeenCalledWith('vscode-like')
    })

    it('应该保存自定义预设', async () => {
      const { result } = renderHook(() => useShortcutPresets())

      const customPreset = {
        name: '我的预设',
        description: '自定义快捷键配置',
        shortcuts: mockShortcuts,
      }

      await act(async () => {
        await result.current.saveCustomPreset(customPreset)
      })

      expect(mockKeyboardService.saveCustomPreset).toHaveBeenCalledWith(customPreset)
    })

    it('应该处理预设操作错误', async () => {
      const testError = new Error('Preset load failed')
      mockKeyboardService.loadPreset.mockRejectedValue(testError)

      const { result } = renderHook(() => useShortcutPresets())

      await expect(
        act(async () => {
          await result.current.loadPreset('invalid-preset')
        })
      ).rejects.toThrow('Preset load failed')
    })
  })
})

// ==================== 集成测试 ====================

describe('Keyboard Shortcuts 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // 设置所有服务的 mock 返回值
    mockKeyboardService.registerShortcut.mockResolvedValue(true)
    mockKeyboardService.checkConflicts.mockResolvedValue([])
    mockKeyboardService.getShortcutCategories.mockResolvedValue(mockCategories)
    mockKeyboardService.getShortcutPresets.mockResolvedValue(mockPresets)
  })

  it('应该完成快捷键管理完整流程', async () => {
    const shortcutsHook = renderHook(() => useKeyboardShortcuts())
    const conflictsHook = renderHook(() => useShortcutConflicts())
    const presetsHook = renderHook(() => useShortcutPresets())

    // 1. 检查快捷键冲突
    let conflicts: any
    await act(async () => {
      conflicts = await conflictsHook.result.current.checkConflicts('ctrl+n')
    })

    expect(conflicts).toEqual([])

    // 2. 注册快捷键
    const handler = vi.fn()
    act(() => {
      shortcutsHook.result.current.register('ctrl+n', handler, {
        description: '新建对话',
        category: 'chat',
      })
    })

    expect(shortcutsHook.result.current.shortcuts['ctrl+n']).toBeDefined()

    // 3. 加载预设
    await waitFor(() => {
      expect(presetsHook.result.current.presets).toBeTruthy()
    })

    await act(async () => {
      await presetsHook.result.current.loadPreset('default')
    })

    // 验证所有操作成功
    expect(mockKeyboardService.registerShortcut).toHaveBeenCalled()
    expect(mockKeyboardService.checkConflicts).toHaveBeenCalled()
    expect(mockKeyboardService.loadPreset).toHaveBeenCalled()
  })

  it('应该处理快捷键录制和应用流程', () => {
    const recorderHook = renderHook(() => useShortcutRecorder())
    const shortcutsHook = renderHook(() => useKeyboardShortcuts())

    // 1. 开始录制
    act(() => {
      recorderHook.result.current.startRecording()
    })

    expect(recorderHook.result.current.recording).toBe(true)

    // 2. 录制按键
    act(() => {
      recorderHook.result.current.recordKey('ctrl')
      recorderHook.result.current.recordKey('shift')
      recorderHook.result.current.recordKey('p')
    })

    // 3. 生成快捷键字符串
    const shortcut = recorderHook.result.current.getShortcutString()
    expect(shortcut).toBe('ctrl+shift+p')

    // 4. 停止录制并注册快捷键
    act(() => {
      recorderHook.result.current.stopRecording()
    })

    const handler = vi.fn()
    act(() => {
      shortcutsHook.result.current.register(shortcut, handler)
    })

    expect(shortcutsHook.result.current.shortcuts[shortcut]).toBeDefined()
  })
})
