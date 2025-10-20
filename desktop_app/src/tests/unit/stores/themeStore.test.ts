/**
 * 主题状态管理 Store 测试
 * 
 * 测试主题状态管理的所有功能，包括：
 * - 主题模式管理（light/dark/system）
 * - 系统主题检测和监听
 * - CSS变量管理
 * - 主题切换动画
 * - 自动切换功能
 * - 事件系统
 * - 主题持久化
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { 
  useThemeStore,
  type ThemeStore,
  type ThemeConfiguration,
  type ThemeCSSVariables,
  type ThemeEvent,
  type ThemeEventListener,
  useThemeMode,
  useThemeConfig,
  useThemeTransitions,
  useThemeAutoSwitch
} from '@/stores/themeStore'
import type { ThemeMode } from '@/types/app'

// Mock dependencies
vi.mock('zustand/middleware', () => ({
  devtools: vi.fn((fn) => fn),
  persist: vi.fn((fn, options) => fn),
  subscribeWithSelector: vi.fn((fn) => fn),
}))

// Mock DOM APIs
const mockMatchMedia = vi.fn()
const mockDocumentElement = {
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
  style: {
    setProperty: vi.fn(),
  },
  setAttribute: vi.fn(),
  offsetHeight: 0,
}

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
}

// Mock global objects
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
})

Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: mockDocumentElement,
})

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: mockLocalStorage,
})

// ==================== 测试数据工厂 ====================

const createMockMediaQueryList = (matches: boolean = false): MediaQueryList => ({
  matches,
  media: '(prefers-color-scheme: dark)',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

const createMockCSSVariables = (): ThemeCSSVariables => ({
  '--color-primary': '0 0% 9%',
  '--color-secondary': '0 0% 96.1%',
  '--color-background': '0 0% 100%',
  '--color-foreground': '0 0% 3.9%',
  '--color-card': '0 0% 100%',
  '--color-card-foreground': '0 0% 3.9%',
  '--color-popover': '0 0% 100%',
  '--color-popover-foreground': '0 0% 3.9%',
  '--color-muted': '0 0% 96.1%',
  '--color-muted-foreground': '0 0% 45.1%',
  '--color-accent': '0 0% 96.1%',
  '--color-accent-foreground': '0 0% 9%',
  '--color-destructive': '0 84.2% 60.2%',
  '--color-destructive-foreground': '0 0% 98%',
  '--color-border': '0 0% 89.8%',
  '--color-input': '0 0% 89.8%',
  '--color-ring': '0 0% 3.9%',
  '--radius-sm': '0.125rem',
  '--radius-md': '0.375rem',
  '--radius-lg': '0.5rem',
  '--spacing-xs': '0.25rem',
  '--spacing-sm': '0.5rem',
  '--spacing-md': '1rem',
  '--spacing-lg': '1.5rem',
  '--spacing-xl': '2rem',
  '--font-size-xs': '0.75rem',
  '--font-size-sm': '0.875rem',
  '--font-size-base': '1rem',
  '--font-size-lg': '1.125rem',
  '--font-size-xl': '1.25rem',
})

// ==================== 测试套件 ====================

describe('ThemeStore', () => {
  beforeEach(() => {
    // 重置 Store
    act(() => {
      useThemeStore.getState().reset()
    })
    
    // 重置所有 mocks
    vi.clearAllMocks()
    
    // 设置默认的 mock 行为
    mockMatchMedia.mockReturnValue(createMockMediaQueryList(false))
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 初始状态测试 ====================
  
  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useThemeStore.getState()
      
      expect(state.theme).toBe('system')
      expect(state.systemTheme).toBe('light')
      expect(state.effectiveTheme).toBe('light')
      expect(state.enableTransitions).toBe(true)
      expect(state.autoSwitch).toBe(false)
      expect(state.autoSwitchTime.lightTime).toBe('06:00')
      expect(state.autoSwitchTime.darkTime).toBe('18:00')
      expect(state.cssVariables).toEqual({})
      expect(state.isInitialized).toBe(false)
      expect(state.error).toBeNull()
      expect(state.eventListeners).toEqual([])
      expect(state.systemThemeCleanup).toBeNull()
    })

    it('计算属性应该返回正确的初始值', () => {
      const state = useThemeStore.getState()
      
      expect(state.isDark()).toBe(false)
      expect(state.isLight()).toBe(true)
      expect(state.isSystemTheme()).toBe(true)
      
      const config = state.getThemeConfig()
      expect(config.mode).toBe('system')
      expect(config.systemTheme).toBe('light')
      expect(config.effectiveTheme).toBe('light')
    })
  })

  // ==================== 初始化测试 ====================

  describe('初始化', () => {
    it('应该正确初始化主题系统', () => {
      // Mock localStorage 返回保存的主题
      mockLocalStorage.getItem.mockReturnValue('dark')
      
      // Mock 系统主题检测
      mockMatchMedia.mockReturnValue(createMockMediaQueryList(true))
      
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.systemTheme).toBe('dark')
      expect(state.effectiveTheme).toBe('dark')
      expect(state.isInitialized).toBe(true)
      expect(state.systemThemeCleanup).toBeDefined()
      
      // 应该应用主题到 DOM
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('light', 'dark')
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark')
      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('系统主题模式下应该使用检测到的系统主题', () => {
      mockLocalStorage.getItem.mockReturnValue('system')
      mockMatchMedia.mockReturnValue(createMockMediaQueryList(true)) // 系统深色主题
      
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('system')
      expect(state.systemTheme).toBe('dark')
      expect(state.effectiveTheme).toBe('dark')
    })

    it('应该处理 localStorage 不可用的情况', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('system') // 应该回退到默认值
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('应该正确清理系统主题监听器', () => {
      const mockCleanup = vi.fn()
      
      // Mock 系统主题监听器返回清理函数
      mockMatchMedia.mockReturnValue({
        ...createMockMediaQueryList(false),
        addEventListener: vi.fn(),
        removeEventListener: mockCleanup,
      })
      
      act(() => {
        useThemeStore.getState().initialize()
        useThemeStore.getState().cleanup()
      })
      
      expect(useThemeStore.getState().systemThemeCleanup).toBeNull()
    })

    it('初始化错误应该被正确处理', () => {
      // Mock matchMedia 抛出错误
      mockMatchMedia.mockImplementation(() => {
        throw new Error('matchMedia error')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      const state = useThemeStore.getState()
      expect(state.error).toBeInstanceOf(Error)
      expect(state.isInitialized).toBe(true) // 即使出错也应该标记为已初始化
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 主题管理测试 ====================

  describe('主题管理', () => {
    beforeEach(() => {
      // 初始化主题系统
      act(() => {
        useThemeStore.getState().initialize()
      })
    })

    it('应该正确设置主题', () => {
      act(() => {
        useThemeStore.getState().setTheme('dark')
      })
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.effectiveTheme).toBe('dark')
      
      // 应该保存到 localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
      
      // 应该应用到 DOM
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark')
    })

    it('设置相同主题应该被忽略', () => {
      act(() => {
        useThemeStore.getState().setTheme('light')
        useThemeStore.getState().setTheme('light') // 再次设置相同主题
      })
      
      // setItem 只应该被调用一次
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1)
    })

    it('应该正确切换主题', () => {
      // 从 light 切换到 dark
      act(() => {
        useThemeStore.getState().setTheme('light')
        useThemeStore.getState().toggleTheme()
      })
      
      expect(useThemeStore.getState().theme).toBe('dark')
      
      // 从 dark 切换到 light
      act(() => {
        useThemeStore.getState().toggleTheme()
      })
      
      expect(useThemeStore.getState().theme).toBe('light')
    })

    it('在系统主题模式下切换应该根据当前实际主题切换', () => {
      act(() => {
        useThemeStore.setState({ 
          theme: 'system',
          systemTheme: 'light',
          effectiveTheme: 'light'
        })
        useThemeStore.getState().toggleTheme()
      })
      
      expect(useThemeStore.getState().theme).toBe('dark')
    })

    it('应该正确循环切换主题', () => {
      // light -> dark
      act(() => {
        useThemeStore.getState().setTheme('light')
        useThemeStore.getState().cycleTheme()
      })
      
      expect(useThemeStore.getState().theme).toBe('dark')
      
      // dark -> system
      act(() => {
        useThemeStore.getState().cycleTheme()
      })
      
      expect(useThemeStore.getState().theme).toBe('system')
      
      // system -> light
      act(() => {
        useThemeStore.getState().cycleTheme()
      })
      
      expect(useThemeStore.getState().theme).toBe('light')
    })

    it('应该正确设置系统主题', () => {
      act(() => {
        useThemeStore.getState().setSystemTheme('dark')
      })
      
      expect(useThemeStore.getState().systemTheme).toBe('dark')
    })

    it('系统主题变化时应该更新实际主题（如果使用系统主题）', () => {
      act(() => {
        useThemeStore.setState({ theme: 'system' })
        useThemeStore.getState().setSystemTheme('dark')
      })
      
      const state = useThemeStore.getState()
      expect(state.systemTheme).toBe('dark')
      expect(state.effectiveTheme).toBe('dark')
    })

    it('系统主题变化时不应该影响实际主题（如果不使用系统主题）', () => {
      act(() => {
        useThemeStore.setState({ 
          theme: 'light',
          effectiveTheme: 'light'
        })
        useThemeStore.getState().setSystemTheme('dark')
      })
      
      const state = useThemeStore.getState()
      expect(state.systemTheme).toBe('dark')
      expect(state.effectiveTheme).toBe('light') // 应该保持不变
    })

    it('应该正确应用主题到 DOM', () => {
      act(() => {
        useThemeStore.getState().applyTheme('dark')
      })
      
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('light', 'dark')
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark')
      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('应该正确刷新当前主题', () => {
      act(() => {
        useThemeStore.setState({ effectiveTheme: 'dark' })
        useThemeStore.getState().refreshTheme()
      })
      
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark')
    })

    it('主题设置错误应该被正确处理', () => {
      // Mock localStorage.setItem 抛出错误
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      act(() => {
        useThemeStore.getState().setTheme('dark')
      })
      
      const state = useThemeStore.getState()
      expect(state.error).toBeInstanceOf(Error)
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== CSS 变量管理测试 ====================

  describe('CSS 变量管理', () => {
    it('应该正确更新 CSS 变量', () => {
      const variables = {
        '--color-primary': '255 0 0',
        '--color-secondary': '0 255 0',
      }
      
      act(() => {
        useThemeStore.getState().updateCSSVariables(variables)
      })
      
      const state = useThemeStore.getState()
      expect(state.cssVariables).toEqual(expect.objectContaining(variables))
      
      // 应该应用到 DOM
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--color-primary', '255 0 0')
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--color-secondary', '0 255 0')
    })

    it('应该正确应用 CSS 变量到 DOM', () => {
      const variables = {
        '--color-primary': '255 0 0',
        '--radius-md': '8px',
      }
      
      act(() => {
        useThemeStore.setState({ cssVariables: variables })
        useThemeStore.getState().applyCSSVariables()
      })
      
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--color-primary', '255 0 0')
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--radius-md', '8px')
    })

    it('应该正确重置 CSS 变量', () => {
      act(() => {
        useThemeStore.getState().updateCSSVariables({
          '--color-primary': '255 0 0',
        })
        useThemeStore.getState().resetCSSVariables()
      })
      
      expect(useThemeStore.getState().cssVariables).toEqual({})
    })

    it('CSS 变量更新错误应该被正确处理', () => {
      // Mock setProperty 抛出错误
      mockDocumentElement.style.setProperty.mockImplementation(() => {
        throw new Error('CSS error')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      act(() => {
        useThemeStore.getState().updateCSSVariables({
          '--color-primary': '255 0 0',
        })
      })
      
      const state = useThemeStore.getState()
      expect(state.error).toBeInstanceOf(Error)
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 自动切换测试 ====================

  describe('自动切换', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该正确启用自动切换', () => {
      act(() => {
        useThemeStore.getState().setAutoSwitch(true)
      })
      
      expect(useThemeStore.getState().autoSwitch).toBe(true)
    })

    it('应该正确设置自动切换时间', () => {
      act(() => {
        useThemeStore.getState().setAutoSwitchTime('07:00', '19:00')
      })
      
      const state = useThemeStore.getState()
      expect(state.autoSwitchTime.lightTime).toBe('07:00')
      expect(state.autoSwitchTime.darkTime).toBe('19:00')
    })

    it('应该正确检查并应用自动切换（白天时间）', () => {
      // Mock 当前时间为上午10点
      const mockDate = new Date('2023-01-01T10:00:00')
      vi.setSystemTime(mockDate)
      
      act(() => {
        useThemeStore.setState({ 
          autoSwitch: true,
          theme: 'dark', // 当前是深色主题
          autoSwitchTime: { lightTime: '06:00', darkTime: '18:00' }
        })
        useThemeStore.getState().checkAutoSwitch()
      })
      
      // 应该切换到浅色主题
      expect(useThemeStore.getState().theme).toBe('light')
    })

    it('应该正确检查并应用自动切换（夜间时间）', () => {
      // Mock 当前时间为晚上20点
      const mockDate = new Date('2023-01-01T20:00:00')
      vi.setSystemTime(mockDate)
      
      act(() => {
        useThemeStore.setState({ 
          autoSwitch: true,
          theme: 'light', // 当前是浅色主题
          autoSwitchTime: { lightTime: '06:00', darkTime: '18:00' }
        })
        useThemeStore.getState().checkAutoSwitch()
      })
      
      // 应该切换到深色主题
      expect(useThemeStore.getState().theme).toBe('dark')
    })

    it('系统主题模式下不应该自动切换', () => {
      act(() => {
        useThemeStore.setState({ 
          autoSwitch: true,
          theme: 'system' // 系统主题模式
        })
        useThemeStore.getState().checkAutoSwitch()
      })
      
      // 主题应该保持为 system
      expect(useThemeStore.getState().theme).toBe('system')
    })

    it('未启用自动切换时不应该切换主题', () => {
      const originalTheme = 'light'
      
      act(() => {
        useThemeStore.setState({ 
          autoSwitch: false,
          theme: originalTheme
        })
        useThemeStore.getState().checkAutoSwitch()
      })
      
      expect(useThemeStore.getState().theme).toBe(originalTheme)
    })
  })

  // ==================== 动画控制测试 ====================

  describe('动画控制', () => {
    it('应该正确设置过渡动画开关', () => {
      act(() => {
        useThemeStore.getState().setEnableTransitions(false)
      })
      
      expect(useThemeStore.getState().enableTransitions).toBe(false)
      
      act(() => {
        useThemeStore.getState().setEnableTransitions(true)
      })
      
      expect(useThemeStore.getState().enableTransitions).toBe(true)
    })

    it('应该正确执行无过渡动画的操作', () => {
      const mockCallback = vi.fn()
      
      act(() => {
        useThemeStore.getState().setEnableTransitions(true)
      })
      
      act(() => {
        useThemeStore.getState().withoutTransition(mockCallback)
      })
      
      expect(mockCallback).toHaveBeenCalled()
      
      // 使用异步检查，因为恢复动画是异步的
      setTimeout(() => {
        expect(useThemeStore.getState().enableTransitions).toBe(true)
      }, 10)
    })
  })

  // ==================== 事件系统测试 ====================

  describe('事件系统', () => {
    it('应该正确添加和触发事件监听器', () => {
      const listener = vi.fn()
      
      act(() => {
        useThemeStore.getState().addEventListener(listener)
      })
      
      const event: ThemeEvent = {
        type: 'theme:changed',
        payload: { from: 'light', to: 'dark' }
      }
      
      act(() => {
        useThemeStore.getState().emitEvent(event)
      })
      
      expect(listener).toHaveBeenCalledWith(event)
    })

    it('addEventListener 应该返回移除函数', () => {
      const listener = vi.fn()
      
      let removeListener: () => void
      
      act(() => {
        removeListener = useThemeStore.getState().addEventListener(listener)
      })
      
      act(() => {
        removeListener()
      })
      
      const event: ThemeEvent = {
        type: 'theme:changed',
        payload: { from: 'light', to: 'dark' }
      }
      
      act(() => {
        useThemeStore.getState().emitEvent(event)
      })
      
      expect(listener).not.toHaveBeenCalled()
    })

    it('应该正确移除事件监听器', () => {
      const listener = vi.fn()
      
      act(() => {
        useThemeStore.getState().addEventListener(listener)
        useThemeStore.getState().removeEventListener(listener)
      })
      
      const event: ThemeEvent = {
        type: 'theme:changed',
        payload: { from: 'light', to: 'dark' }
      }
      
      act(() => {
        useThemeStore.getState().emitEvent(event)
      })
      
      expect(listener).not.toHaveBeenCalled()
    })

    it('事件监听器执行错误不应影响其他监听器', () => {
      const listener1 = vi.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })
      const listener2 = vi.fn()
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      act(() => {
        useThemeStore.getState().addEventListener(listener1)
        useThemeStore.getState().addEventListener(listener2)
      })
      
      const event: ThemeEvent = {
        type: 'theme:changed',
        payload: { from: 'light', to: 'dark' }
      }
      
      act(() => {
        useThemeStore.getState().emitEvent(event)
      })
      
      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('主题变化时应该触发事件', () => {
      const listener = vi.fn()
      
      act(() => {
        useThemeStore.getState().addEventListener(listener)
        useThemeStore.getState().initialize()
        useThemeStore.getState().setTheme('dark')
      })
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'theme:changed',
        payload: expect.objectContaining({
          from: 'system',
          to: 'dark'
        })
      }))
    })

    it('系统主题变化时应该触发事件', () => {
      const listener = vi.fn()
      
      act(() => {
        useThemeStore.getState().addEventListener(listener)
        useThemeStore.getState().setSystemTheme('dark')
      })
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'theme:system-changed',
        payload: { theme: 'dark' }
      }))
    })

    it('主题应用时应该触发事件', () => {
      const listener = vi.fn()
      
      act(() => {
        useThemeStore.getState().addEventListener(listener)
        useThemeStore.getState().applyTheme('dark')
      })
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'theme:applied',
        payload: { theme: 'dark' }
      }))
    })

    it('CSS变量更新时应该触发事件', () => {
      const listener = vi.fn()
      const variables = { '--color-primary': '255 0 0' }
      
      act(() => {
        useThemeStore.getState().addEventListener(listener)
        useThemeStore.getState().updateCSSVariables(variables)
      })
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'theme:css-updated',
        payload: { variables }
      }))
    })

    it('错误时应该触发错误事件', () => {
      const listener = vi.fn()
      
      // Mock setProperty 抛出错误
      mockDocumentElement.style.setProperty.mockImplementation(() => {
        throw new Error('CSS error')
      })
      
      act(() => {
        useThemeStore.getState().addEventListener(listener)
        useThemeStore.getState().updateCSSVariables({
          '--color-primary': '255 0 0',
        })
      })
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'theme:error',
        payload: expect.objectContaining({
          error: expect.any(Error),
          context: 'updateCSSVariables'
        })
      }))
    })
  })

  // ==================== 工具方法测试 ====================

  describe('工具方法', () => {
    it('clearError 应该清除错误信息', () => {
      act(() => {
        useThemeStore.setState({ error: new Error('Test error') })
        useThemeStore.getState().clearError()
      })
      
      expect(useThemeStore.getState().error).toBeNull()
    })

    it('reset 应该重置所有状态并重新初始化', () => {
      // 设置一些状态
      act(() => {
        useThemeStore.setState({
          theme: 'dark',
          cssVariables: { '--color-primary': '255 0 0' },
          autoSwitch: true,
          error: new Error('Test error'),
        })
      })
      
      act(() => {
        useThemeStore.getState().reset()
      })
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('system')
      expect(state.cssVariables).toEqual({})
      expect(state.autoSwitch).toBe(false)
      expect(state.error).toBeNull()
      expect(state.isInitialized).toBe(true) // 应该重新初始化
    })
  })

  // ==================== 辅助 Hooks 测试 ====================

  describe('辅助 Hooks', () => {
    it('useThemeMode 应该返回主题模式相关状态和方法', () => {
      const { result } = renderHook(() => useThemeMode())
      
      expect(result.current.theme).toBe('system')
      expect(result.current.systemTheme).toBe('light')
      expect(result.current.effectiveTheme).toBe('light')
      expect(result.current.isDark).toBe(false)
      expect(result.current.isLight).toBe(true)
      expect(result.current.isSystemTheme).toBe(true)
      expect(typeof result.current.setTheme).toBe('function')
      expect(typeof result.current.toggleTheme).toBe('function')
      expect(typeof result.current.cycleTheme).toBe('function')
    })

    it('useThemeConfig 应该返回主题配置相关状态和方法', () => {
      const { result } = renderHook(() => useThemeConfig())
      
      expect(result.current.config).toBeDefined()
      expect(result.current.cssVariables).toEqual({})
      expect(typeof result.current.updateCSSVariables).toBe('function')
      expect(typeof result.current.resetCSSVariables).toBe('function')
    })

    it('useThemeTransitions 应该返回动画相关状态和方法', () => {
      const { result } = renderHook(() => useThemeTransitions())
      
      expect(result.current.enableTransitions).toBe(true)
      expect(typeof result.current.setEnableTransitions).toBe('function')
      expect(typeof result.current.withoutTransition).toBe('function')
    })

    it('useThemeAutoSwitch 应该返回自动切换相关状态和方法', () => {
      const { result } = renderHook(() => useThemeAutoSwitch())
      
      expect(result.current.autoSwitch).toBe(false)
      expect(result.current.autoSwitchTime).toBeDefined()
      expect(typeof result.current.setAutoSwitch).toBe('function')
      expect(typeof result.current.setAutoSwitchTime).toBe('function')
      expect(typeof result.current.checkAutoSwitch).toBe('function')
    })
  })

  // ==================== 系统主题监听测试 ====================

  describe('系统主题监听', () => {
    it('应该正确监听系统主题变化', () => {
      const mockMediaQuery = createMockMediaQueryList(false)
      let changeHandler: (e: MediaQueryListEvent) => void
      
      mockMediaQuery.addEventListener = vi.fn((event, handler) => {
        if (event === 'change') {
          changeHandler = handler as (e: MediaQueryListEvent) => void
        }
      })
      
      mockMatchMedia.mockReturnValue(mockMediaQuery)
      
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      // 模拟系统主题变化
      act(() => {
        changeHandler!({ matches: true } as MediaQueryListEvent)
      })
      
      expect(useThemeStore.getState().systemTheme).toBe('dark')
    })

    it('应该正确处理旧版浏览器的兼容性', () => {
      const mockMediaQuery = {
        ...createMockMediaQueryList(false),
        addEventListener: undefined,
        addListener: vi.fn(),
      }
      
      mockMatchMedia.mockReturnValue(mockMediaQuery)
      
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      expect(mockMediaQuery.addListener).toHaveBeenCalled()
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('应该正确处理 matchMedia 不存在的情况', () => {
      // Mock window.matchMedia 不存在
      Object.defineProperty(window, 'matchMedia', {
        value: undefined,
        writable: true,
      })
      
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      // 应该使用默认值
      expect(useThemeStore.getState().systemTheme).toBe('light')
    })

    it('应该正确处理 document 不存在的情况', () => {
      // Mock document 不存在（SSR 环境）
      const originalDocument = global.document
      delete (global as any).document
      
      act(() => {
        useThemeStore.getState().applyTheme('dark')
      })
      
      // 不应该抛出错误
      expect(useThemeStore.getState().error).toBeNull()
      
      // 恢复 document
      global.document = originalDocument
    })

    it('应该正确处理 localStorage 写入错误', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      act(() => {
        useThemeStore.getState().setTheme('dark')
      })
      
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 性能测试 ====================

  describe('性能测试', () => {
    it('应该能处理大量事件监听器', () => {
      const listeners: ThemeEventListener[] = []
      
      // 添加大量监听器
      for (let i = 0; i < 1000; i++) {
        const listener = vi.fn()
        listeners.push(listener)
        
        act(() => {
          useThemeStore.getState().addEventListener(listener)
        })
      }
      
      // 触发事件
      const event: ThemeEvent = {
        type: 'theme:changed',
        payload: { from: 'light', to: 'dark' }
      }
      
      act(() => {
        useThemeStore.getState().emitEvent(event)
      })
      
      // 所有监听器都应该被调用
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledWith(event)
      })
    })

    it('应该能处理频繁的主题切换', () => {
      act(() => {
        useThemeStore.getState().initialize()
      })
      
      // 频繁切换主题
      for (let i = 0; i < 100; i++) {
        act(() => {
          useThemeStore.getState().setTheme(i % 2 === 0 ? 'light' : 'dark')
        })
      }
      
      // 应该没有错误
      expect(useThemeStore.getState().error).toBeNull()
    })

    it('应该能处理大量 CSS 变量更新', () => {
      const largeVariables: Partial<ThemeCSSVariables> = {}
      
      // 创建大量 CSS 变量
      for (let i = 0; i < 1000; i++) {
        largeVariables[`--custom-${i}` as keyof ThemeCSSVariables] = `${i}px`
      }
      
      act(() => {
        useThemeStore.getState().updateCSSVariables(largeVariables)
      })
      
      expect(useThemeStore.getState().cssVariables).toEqual(
        expect.objectContaining(largeVariables)
      )
    })
  })
})
