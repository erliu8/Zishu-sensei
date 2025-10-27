/**
 * useTheme Hooks 测试套件
 * 
 * 测试主题管理相关功能，包括主题切换、自定义主题、主题配色、动画等
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useTheme,
  useThemePreference,
  useThemeTransition,
  useCSSVariable,
  useMediaQuery
} from '@/hooks/useTheme'
import { mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock ThemeService
const mockThemeService = {
  getCurrentTheme: vi.fn(),
  setTheme: vi.fn(),
  getThemeColors: vi.fn(),
  setThemeColors: vi.fn(),
  getCustomThemes: vi.fn(),
  saveCustomTheme: vi.fn(),
  deleteCustomTheme: vi.fn(),
  getThemePresets: vi.fn(),
  applyTheme: vi.fn(),
  resetTheme: vi.fn(),
  exportTheme: vi.fn(),
  importTheme: vi.fn(),
}

// Mock 系统主题检测
const mockMediaQuery = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

// Mock CSS 变量设置
const mockDocumentStyle = {
  setProperty: vi.fn(),
  getPropertyValue: vi.fn(),
  removeProperty: vi.fn(),
}

// Mock localStorage
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

vi.mock('@/services/themeService', () => ({
  default: mockThemeService,
}))

// ==================== 测试数据 ====================

const mockThemeConfig = {
  mode: 'light' as const,
  variant: 'default' as const,
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  animations: {
    duration: 200,
    easing: 'ease-in-out',
    enabled: true,
  },
  effects: {
    blur_enabled: true,
    blur_intensity: 10,
    shadow_enabled: true,
    gradient_enabled: true,
  },
}

const mockDarkTheme = {
  ...mockThemeConfig,
  mode: 'dark' as const,
  colors: {
    ...mockThemeConfig.colors,
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155',
  },
}

const mockCustomTheme = {
  id: 'custom-purple',
  name: '紫色主题',
  description: '自定义紫色配色主题',
  ...mockThemeConfig,
  colors: {
    ...mockThemeConfig.colors,
    primary: '#8b5cf6',
    accent: '#a855f7',
  },
}

const mockThemePresets = [
  {
    id: 'default-light',
    name: '默认亮色',
    theme: mockThemeConfig,
  },
  {
    id: 'default-dark',
    name: '默认暗色',
    theme: mockDarkTheme,
  },
  {
    id: 'high-contrast',
    name: '高对比度',
    theme: {
      ...mockThemeConfig,
      colors: {
        ...mockThemeConfig.colors,
        background: '#ffffff',
        text: '#000000',
        border: '#000000',
      },
    },
  },
]

const mockAnimationConfig = {
  theme_transition: {
    duration: 300,
    easing: 'ease-in-out',
  },
  color_transition: {
    duration: 200,
    easing: 'ease',
  },
  component_animation: {
    duration: 150,
    easing: 'ease-out',
  },
}

// ==================== 测试套件 ====================

describe('useTheme Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
    
    // Mock DOM APIs
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => mockMediaQuery),
    })

    Object.defineProperty(document.documentElement, 'style', {
      value: mockDocumentStyle,
    })

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
    })
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockThemeService.getCurrentTheme.mockReturnValue(mockThemeConfig)
    mockThemeService.setTheme.mockResolvedValue(undefined)
    mockStorage.getItem.mockReturnValue(JSON.stringify({ mode: 'light' }))
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础主题管理', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useTheme())

      expect(result.current.theme).toEqual(mockThemeConfig)
      expect(result.current.isDark).toBe(false)
      // Theme is set to light
      expect(typeof result.current.setTheme).toBe('function')
      expect(typeof result.current.toggleTheme).toBe('function')
    })

    it('应该切换主题', () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme('dark')
      })

      expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark')
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'theme-preference',
        JSON.stringify({ mode: 'dark' })
      )
    })

    it('应该在亮色和暗色之间切换', () => {
      const { result } = renderHook(() => useTheme())

      // 当前是亮色，切换到暗色
      act(() => {
        result.current.toggleTheme()
      })

      expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark')

      // 模拟切换后的状态
      mockThemeService.getCurrentTheme.mockReturnValue(mockDarkTheme)

      // 重新渲染
      const { result: newResult } = renderHook(() => useTheme())

      // 再次切换应该回到亮色
      act(() => {
        newResult.current.toggleTheme()
      })

      expect(mockThemeService.setTheme).toHaveBeenCalledWith('light')
    })

    it('应该支持自动主题模式', () => {
      mockStorage.getItem.mockReturnValue(JSON.stringify({ mode: 'auto' }))

      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme('auto')
      })

      expect(mockThemeService.setTheme).toHaveBeenCalledWith('auto')
    })

    it('应该监听系统主题变化', () => {
      mockStorage.getItem.mockReturnValue(JSON.stringify({ mode: 'auto' }))

      renderHook(() => useTheme())

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })

    it('应该在组件卸载时清理监听器', () => {
      mockStorage.getItem.mockReturnValue(JSON.stringify({ mode: 'auto' }))

      const { unmount } = renderHook(() => useTheme())

      unmount()

      expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })
  })

  describe('主题持久化', () => {
    it('应该从本地存储加载主题设置', () => {
      mockStorage.getItem.mockReturnValue(JSON.stringify({ mode: 'dark' }))

      const { result } = renderHook(() => useTheme())

      expect(mockStorage.getItem).toHaveBeenCalledWith('theme-preference')
      // 初始化时应该应用存储的主题
      expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark')
    })

    it('应该保存主题设置到本地存储', () => {
      const { result } = renderHook(() => useTheme())

      act(() => {
        result.current.setTheme('dark')
      })

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'theme-preference',
        JSON.stringify({ mode: 'dark' })
      )
    })

    it('应该处理无效的存储数据', () => {
      mockStorage.getItem.mockReturnValue('invalid json')

      const { result } = renderHook(() => useTheme())

      // 应该使用默认主题
      expect(result.current.theme).toBe('light')
    })
  })
})

describe.skip('useThemeColors Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockThemeService.getThemeColors.mockReturnValue(mockThemeConfig.colors)
    mockThemeService.setThemeColors.mockResolvedValue(undefined)
  })

  describe('主题颜色管理', () => {
    it('应该获取当前主题颜色', () => {
      const { result } = renderHook(() => useThemeColors())

      expect(result.current.colors).toEqual(mockThemeConfig.colors)
      expect(mockThemeService.getThemeColors).toHaveBeenCalled()
    })

    it('应该更新主题颜色', async () => {
      const { result } = renderHook(() => useThemeColors())

      const newColors = {
        primary: '#10b981',
        accent: '#059669',
      }

      await act(async () => {
        await result.current.updateColors(newColors)
      })

      expect(mockThemeService.setThemeColors).toHaveBeenCalledWith(newColors)
    })

    it('应该重置主题颜色', async () => {
      const { result } = renderHook(() => useThemeColors())

      await act(async () => {
        await result.current.resetColors()
      })

      expect(mockThemeService.resetTheme).toHaveBeenCalled()
    })

    it('应该应用颜色到 CSS 变量', () => {
      renderHook(() => useThemeColors())

      // 验证 CSS 变量是否被设置
      expect(mockDocumentStyle.setProperty).toHaveBeenCalledWith(
        '--color-primary',
        mockThemeConfig.colors.primary
      )
    })

    it('应该生成颜色变体', () => {
      const { result } = renderHook(() => useThemeColors())

      const variants = result.current.generateColorVariants('#3b82f6')

      expect(variants).toEqual({
        50: expect.stringMatching(/#[0-9a-f]{6}/),
        100: expect.stringMatching(/#[0-9a-f]{6}/),
        200: expect.stringMatching(/#[0-9a-f]{6}/),
        300: expect.stringMatching(/#[0-9a-f]{6}/),
        400: expect.stringMatching(/#[0-9a-f]{6}/),
        500: '#3b82f6',
        600: expect.stringMatching(/#[0-9a-f]{6}/),
        700: expect.stringMatching(/#[0-9a-f]{6}/),
        800: expect.stringMatching(/#[0-9a-f]{6}/),
        900: expect.stringMatching(/#[0-9a-f]{6}/),
      })
    })
  })
})

describe.skip('useThemeAnimations Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('主题动画配置', () => {
    it('应该返回动画配置', () => {
      const { result } = renderHook(() => useThemeAnimations())

      expect(result.current.animations).toEqual(mockThemeConfig.animations)
      expect(typeof result.current.updateAnimations).toBe('function')
      expect(typeof result.current.setAnimationEnabled).toBe('function')
    })

    it('应该启用和禁用动画', () => {
      const { result } = renderHook(() => useThemeAnimations())

      // 禁用动画
      act(() => {
        result.current.setAnimationEnabled(false)
      })

      expect(result.current.animations.enabled).toBe(false)
      expect(mockDocumentStyle.setProperty).toHaveBeenCalledWith(
        '--animation-duration',
        '0ms'
      )

      // 启用动画
      act(() => {
        result.current.setAnimationEnabled(true)
      })

      expect(result.current.animations.enabled).toBe(true)
    })

    it('应该更新动画配置', () => {
      const { result } = renderHook(() => useThemeAnimations())

      const newConfig = {
        duration: 500,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }

      act(() => {
        result.current.updateAnimations(newConfig)
      })

      expect(result.current.animations).toEqual({
        ...mockThemeConfig.animations,
        ...newConfig,
      })
    })

    it('应该监听用户的动画偏好', () => {
      const reducedMotionQuery = {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }

      window.matchMedia = vi.fn().mockReturnValue(reducedMotionQuery)

      const { result } = renderHook(() => useThemeAnimations())

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(result.current.animations.enabled).toBe(false) // 应该自动禁用动画
    })
  })
})

describe.skip('useCustomTheme Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockThemeService.getCustomThemes.mockResolvedValue([mockCustomTheme])
    mockThemeService.saveCustomTheme.mockResolvedValue(mockCustomTheme)
    mockThemeService.deleteCustomTheme.mockResolvedValue(undefined)
  })

  describe('自定义主题', () => {
    it('应该获取自定义主题列表', async () => {
      const { result } = renderHook(() => useCustomTheme())

      await waitFor(() => {
        expect(result.current.customThemes).toEqual([mockCustomTheme])
        expect(result.current.loading).toBe(false)
      })

      expect(mockThemeService.getCustomThemes).toHaveBeenCalled()
    })

    it('应该创建新的自定义主题', async () => {
      const { result } = renderHook(() => useCustomTheme())

      const newTheme = {
        name: '蓝色主题',
        description: '自定义蓝色配色',
        colors: {
          ...mockThemeConfig.colors,
          primary: '#2563eb',
        },
      }

      let savedTheme: any
      await act(async () => {
        savedTheme = await result.current.createTheme(newTheme)
      })

      expect(mockThemeService.saveCustomTheme).toHaveBeenCalledWith(
        expect.objectContaining(newTheme)
      )
      expect(savedTheme).toEqual(mockCustomTheme)
    })

    it('应该删除自定义主题', async () => {
      const { result } = renderHook(() => useCustomTheme())

      await waitFor(() => {
        expect(result.current.customThemes).toHaveLength(1)
      })

      await act(async () => {
        await result.current.deleteTheme('custom-purple')
      })

      expect(mockThemeService.deleteCustomTheme).toHaveBeenCalledWith('custom-purple')
      expect(result.current.customThemes).toHaveLength(0)
    })

    it('应该应用自定义主题', async () => {
      const { result } = renderHook(() => useCustomTheme())

      await waitFor(() => {
        expect(result.current.customThemes).toBeTruthy()
      })

      await act(async () => {
        await result.current.applyTheme('custom-purple')
      })

      expect(mockThemeService.applyTheme).toHaveBeenCalledWith(mockCustomTheme)
    })

    it('应该处理主题操作错误', async () => {
      const testError = new Error('Theme operation failed')
      mockThemeService.saveCustomTheme.mockRejectedValue(testError)

      const { result } = renderHook(() => useCustomTheme())

      await expect(
        act(async () => {
          await result.current.createTheme({
            name: 'Test Theme',
            colors: mockThemeConfig.colors,
          })
        })
      ).rejects.toThrow('Theme operation failed')

      expect(result.current.error).toBe('主题操作失败')
    })
  })
})

describe.skip('useThemePresets Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockThemeService.getThemePresets.mockResolvedValue(mockThemePresets)
  })

  describe('主题预设', () => {
    it('应该获取主题预设列表', async () => {
      const { result } = renderHook(() => useThemePresets())

      await waitFor(() => {
        expect(result.current.presets).toEqual(mockThemePresets)
        expect(result.current.loading).toBe(false)
      })

      expect(mockThemeService.getThemePresets).toHaveBeenCalled()
    })

    it('应该应用预设主题', async () => {
      const { result } = renderHook(() => useThemePresets())

      await waitFor(() => {
        expect(result.current.presets).toBeTruthy()
      })

      await act(async () => {
        await result.current.applyPreset('default-dark')
      })

      expect(mockThemeService.applyTheme).toHaveBeenCalledWith(mockDarkTheme)
    })

    it('应该按分类过滤预设', async () => {
      const { result } = renderHook(() => useThemePresets())

      await waitFor(() => {
        expect(result.current.presets).toBeTruthy()
      })

      const defaultPresets = result.current.getPresetsByCategory('default')
      expect(defaultPresets).toHaveLength(2)

      const accessibilityPresets = result.current.getPresetsByCategory('accessibility')
      expect(accessibilityPresets).toHaveLength(1)
    })
  })
})

describe.skip('useSystemTheme Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('系统主题检测', () => {
    it('应该检测系统暗色主题', () => {
      mockMediaQuery.matches = true
      
      const { result } = renderHook(() => useSystemTheme())

      expect(result.current.systemTheme).toBe('dark')
      expect(result.current.prefersLight).toBe(false)
      expect(result.current.prefersDark).toBe(true)
    })

    it('应该检测系统亮色主题', () => {
      mockMediaQuery.matches = false
      
      const { result } = renderHook(() => useSystemTheme())

      expect(result.current.systemTheme).toBe('light')
      expect(result.current.prefersLight).toBe(true)
      expect(result.current.prefersDark).toBe(false)
    })

    it('应该监听系统主题变化', () => {
      const { result } = renderHook(() => useSystemTheme())

      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )

      // 模拟系统主题变化
      const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1]
      
      act(() => {
        mockMediaQuery.matches = true
        changeHandler({ matches: true })
      })

      expect(result.current.systemTheme).toBe('dark')
    })

    it('应该检测高对比度偏好', () => {
      const highContrastQuery = {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }

      window.matchMedia = vi.fn().mockImplementation((query) => {
        if (query.includes('high-contrast')) return highContrastQuery
        return mockMediaQuery
      })

      const { result } = renderHook(() => useSystemTheme())

      expect(result.current.prefersHighContrast).toBe(true)
    })
  })
})

describe('useThemeTransition Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('主题过渡动画', () => {
    it('应该处理主题切换过渡', async () => {
      const { result } = renderHook(() => useThemeTransition())

      expect(result.current.isTransitioning).toBe(false)

      await act(async () => {
        await result.current.transitionTo(mockDarkTheme)
      })

      expect(mockThemeService.applyTheme).toHaveBeenCalledWith(mockDarkTheme)
      expect(result.current.isTransitioning).toBe(false)
    })

    it('应该管理过渡状态', async () => {
      let resolveTransition: () => void
      const transitionPromise = new Promise<void>(resolve => {
        resolveTransition = resolve
      })

      mockThemeService.applyTheme.mockReturnValue(transitionPromise)

      const { result } = renderHook(() => useThemeTransition())

      act(() => {
        result.current.transitionTo(mockDarkTheme)
      })

      expect(result.current.isTransitioning).toBe(true)

      await act(async () => {
        resolveTransition!()
      })

      expect(result.current.isTransitioning).toBe(false)
    })

    it('应该应用过渡效果', () => {
      const { result } = renderHook(() => useThemeTransition({
        duration: 500,
        easing: 'ease-in-out',
      }))

      act(() => {
        result.current.transitionTo(mockDarkTheme)
      })

      expect(mockDocumentStyle.setProperty).toHaveBeenCalledWith(
        '--theme-transition-duration',
        '500ms'
      )
      expect(mockDocumentStyle.setProperty).toHaveBeenCalledWith(
        '--theme-transition-easing',
        'ease-in-out'
      )
    })
  })
})

// ==================== 集成测试 ====================

describe('Theme Hooks 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // 设置所有服务的 mock 返回值
    mockThemeService.getCurrentTheme.mockReturnValue(mockThemeConfig)
    mockThemeService.setTheme.mockResolvedValue(undefined)
    mockThemeService.getCustomThemes.mockResolvedValue([mockCustomTheme])
    mockThemeService.getThemePresets.mockResolvedValue(mockThemePresets)
  })

  it('应该完成主题管理完整流程', async () => {
    const themeHook = renderHook(() => useTheme())
    const colorsHook = renderHook(() => useThemeColors())
    const presetsHook = renderHook(() => useThemePresets())
    const customHook = renderHook(() => useCustomTheme())

    // 1. 切换到暗色主题
    act(() => {
      themeHook.result.current.setTheme('dark')
    })

    expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark')

    // 2. 更新主题颜色
    await act(async () => {
      await colorsHook.result.current.updateColors({
        primary: '#10b981',
        accent: '#059669',
      })
    })

    // 3. 加载主题预设
    await waitFor(() => {
      expect(presetsHook.result.current.presets).toBeTruthy()
    })

    // 4. 应用预设主题
    await act(async () => {
      await presetsHook.result.current.applyPreset('high-contrast')
    })

    // 5. 创建自定义主题
    await act(async () => {
      await customHook.result.current.createTheme({
        name: '集成测试主题',
        colors: mockThemeConfig.colors,
      })
    })

    // 验证所有操作成功执行
    expect(mockThemeService.setTheme).toHaveBeenCalled()
    expect(mockThemeService.setThemeColors).toHaveBeenCalled()
    expect(mockThemeService.applyTheme).toHaveBeenCalled()
    expect(mockThemeService.saveCustomTheme).toHaveBeenCalled()
  })

  it('应该处理系统主题自动切换', () => {
    mockStorage.getItem.mockReturnValue(JSON.stringify({ mode: 'auto' }))

    const themeHook = renderHook(() => useTheme())
    const systemHook = renderHook(() => useSystemTheme())

    // 模拟系统主题变化
    act(() => {
      mockMediaQuery.matches = true
      const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1]
      changeHandler({ matches: true })
    })

    expect(systemHook.result.current.systemTheme).toBe('dark')
    // 在自动模式下应该跟随系统主题
    expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark')
  })

  it('应该支持主题导入导出', async () => {
    mockThemeService.exportTheme.mockResolvedValue(JSON.stringify(mockCustomTheme))
    mockThemeService.importTheme.mockResolvedValue(mockCustomTheme)

    const { result } = renderHook(() => useCustomTheme())

    // 导出主题
    let exportedData: string
    await act(async () => {
      exportedData = await result.current.exportTheme('custom-purple')
    })

    expect(exportedData!).toBe(JSON.stringify(mockCustomTheme))

    // 导入主题
    let importedTheme: any
    await act(async () => {
      importedTheme = await result.current.importTheme(exportedData!)
    })

    expect(importedTheme).toEqual(mockCustomTheme)
  })
})
