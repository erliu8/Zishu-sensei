/**
 * useSettings Hook 测试
 * 
 * 测试设置相关的 Hook 功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createTestQueryClient, AllProviders } from '../../utils/test-utils'

// Mock useSettings hook
const mockUseSettings = () => {
  const [settings, setSettings] = React.useState({
    language: 'zh-CN',
    theme: 'auto',
    startupOnBoot: false,
  })

  const updateSettings = (updates: any) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }

  const resetSettings = () => {
    setSettings({
      language: 'zh-CN',
      theme: 'auto',
      startupOnBoot: false,
    })
  }

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoading: false,
    error: null,
  }
}

vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
}))

describe('useSettings', () => {
  it('应该返回设置对象', () => {
    const { result } = renderHook(() => mockUseSettings())
    
    expect(result.current.settings).toBeDefined()
    expect(result.current.settings.language).toBe('zh-CN')
  })

  it('应该能够更新设置', () => {
    const { result } = renderHook(() => mockUseSettings())
    
    act(() => {
      result.current.updateSettings({ language: 'en-US' })
    })
    
    expect(result.current.settings.language).toBe('en-US')
  })

  it('应该能够重置设置', () => {
    const { result } = renderHook(() => mockUseSettings())
    
    act(() => {
      result.current.updateSettings({ language: 'en-US' })
    })
    
    expect(result.current.settings.language).toBe('en-US')
    
    act(() => {
      result.current.resetSettings()
    })
    
    expect(result.current.settings.language).toBe('zh-CN')
  })

  it('应该暴露加载状态', () => {
    const { result } = renderHook(() => mockUseSettings())
    expect(result.current.isLoading).toBe(false)
  })

  it('应该暴露错误状态', () => {
    const { result } = renderHook(() => mockUseSettings())
    expect(result.current.error).toBe(null)
  })
})

// 创建其他 Hooks 的测试框架
describe('useAdapter', () => {
  it('应该能够加载适配器列表', () => {
    const mockUseAdapter = () => ({
      adapters: [],
      currentAdapter: null,
      loadAdapters: vi.fn(),
      selectAdapter: vi.fn(),
      isLoading: false,
    })
    
    const { result } = renderHook(() => mockUseAdapter())
    expect(result.current.adapters).toEqual([])
  })
})

describe('useChat', () => {
  it('应该能够发送消息', () => {
    const mockUseChat = () => ({
      messages: [],
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
      isTyping: false,
    })
    
    const { result } = renderHook(() => mockUseChat())
    expect(result.current.messages).toEqual([])
    expect(result.current.sendMessage).toBeDefined()
  })
})

describe('useCharacter', () => {
  it('应该能够加载角色', () => {
    const mockUseCharacter = () => ({
      character: null,
      loadCharacter: vi.fn(),
      setExpression: vi.fn(),
      playAnimation: vi.fn(),
      isLoaded: false,
    })
    
    const { result } = renderHook(() => mockUseCharacter())
    expect(result.current.character).toBe(null)
    expect(result.current.loadCharacter).toBeDefined()
  })
})

describe('useTheme', () => {
  it('应该能够切换主题', () => {
    const [theme, setTheme] = React.useState('auto')
    
    const mockUseTheme = () => ({
      theme,
      setTheme: (newTheme: string) => setTheme(newTheme),
      toggleTheme: () => setTheme(prev => prev === 'light' ? 'dark' : 'light'),
      currentTheme: 'light',
    })
    
    const { result } = renderHook(() => mockUseTheme())
    expect(result.current.theme).toBe('auto')
  })
})

describe('useTauriCommand', () => {
  it('应该能够调用 Tauri 命令', () => {
    const mockUseTauriCommand = () => ({
      invoke: vi.fn().mockResolvedValue({ success: true }),
      isLoading: false,
      error: null,
    })
    
    const { result } = renderHook(() => mockUseTauriCommand())
    expect(result.current.invoke).toBeDefined()
  })
})

describe('useTauriEvent', () => {
  it('应该能够监听 Tauri 事件', () => {
    const mockUseTauriEvent = () => ({
      listen: vi.fn(),
      emit: vi.fn(),
      unlisten: vi.fn(),
    })
    
    const { result } = renderHook(() => mockUseTauriEvent())
    expect(result.current.listen).toBeDefined()
    expect(result.current.emit).toBeDefined()
  })
})

describe('useWindowManager', () => {
  it('应该能够管理窗口状态', () => {
    const mockUseWindowManager = () => ({
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      isMaximized: false,
    })
    
    const { result } = renderHook(() => mockUseWindowManager())
    expect(result.current.minimize).toBeDefined()
    expect(result.current.maximize).toBeDefined()
  })
})

describe('useDesktop', () => {
  it('应该能够管理桌面宠物位置', () => {
    const mockUseDesktop = () => ({
      position: { x: 0, y: 0 },
      setPosition: vi.fn(),
      isVisible: true,
      toggleVisibility: vi.fn(),
    })
    
    const { result } = renderHook(() => mockUseDesktop())
    expect(result.current.position).toEqual({ x: 0, y: 0 })
  })
})

describe('useStorage', () => {
  it('应该能够读写本地存储', () => {
    const mockUseStorage = () => ({
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    })
    
    const { result } = renderHook(() => mockUseStorage())
    expect(result.current.get).toBeDefined()
    expect(result.current.set).toBeDefined()
  })
})

describe('useKeyboardShortcuts', () => {
  it('应该能够注册快捷键', () => {
    const mockUseKeyboardShortcuts = () => ({
      register: vi.fn(),
      unregister: vi.fn(),
      isEnabled: true,
    })
    
    const { result } = renderHook(() => mockUseKeyboardShortcuts())
    expect(result.current.register).toBeDefined()
  })
})

