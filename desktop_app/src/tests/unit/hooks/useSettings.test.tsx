/**
 * useSettings Hooks 测试套件
 * 
 * 测试设置管理相关的所有 Hooks，包括基础设置、高级设置、导入导出等
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { 
  useSettings,
  useSimpleSettings,
  useThemeSettings,
  useLanguageSettings
} from '@/hooks/useSettings'
import { renderHook, mockConsole } from '../../utils/test-utils'

// ==================== Mock Store and Services ====================

// Mock useSettingsStore
const mockSettingsStore = {
  appSettings: {
    theme: 'system' as const,
    language: 'zh-CN',
    autoStart: false,
    windowState: {
      mode: 'pet' as const,
      position: { x: 0, y: 0 },
      size: { width: 400, height: 600 },
      isVisible: true,
      isAlwaysOnTop: true,
      isResizable: true,
      title: '紫舒老师桌面版',
    },
    notifications: {
      enabled: true,
      sound: true,
      desktop: true,
    },
    ai: {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
    },
    character: {
      model: 'shizuku',
      voice: 'female',
      personality: 'friendly',
    },
  },
  appConfig: {},
  isLoading: false,
  isInitialized: true,
  syncStatus: 'idle' as const,
  error: null,
  needsSync: vi.fn().mockReturnValue(false),
  initialize: vi.fn().mockImplementation(() => Promise.resolve()),
  updateAppSettings: vi.fn().mockResolvedValue(undefined),
  resetAppSettings: vi.fn().mockResolvedValue(undefined),
  updateTheme: vi.fn().mockResolvedValue(undefined),
  updateLanguage: vi.fn().mockResolvedValue(undefined),
  toggleAutoStart: vi.fn().mockResolvedValue(undefined),
  updateNotifications: vi.fn().mockResolvedValue(undefined),
  updateAISettings: vi.fn().mockResolvedValue(undefined),
  updateConfig: vi.fn().mockResolvedValue(undefined),
  updatePartialConfig: vi.fn().mockResolvedValue(undefined),
  resetAppConfig: vi.fn().mockResolvedValue(undefined),
  exportSettings: vi.fn().mockResolvedValue('{}'),
  importSettings: vi.fn().mockResolvedValue(undefined),
  syncToBackend: vi.fn().mockResolvedValue(undefined),
  syncFromBackend: vi.fn().mockResolvedValue(undefined),
  forceSync: vi.fn().mockResolvedValue(undefined),
  refreshConfig: vi.fn().mockResolvedValue(undefined),
  clearError: vi.fn(),
  resetAllSettings: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn().mockReturnValue(() => {}),
}

// Mock useTauri
const mockUseTauri = {
  isAvailable: true,
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
}

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: () => mockSettingsStore,
  SyncStatus: {
    IDLE: 'idle',
    SYNCING: 'syncing', 
    SUCCESS: 'success',
    FAILED: 'failed'
  }
}))

vi.mock('@/hooks/useTauri', () => ({
  useTauri: () => mockUseTauri,
}))

// ==================== Test Data ====================

// Expected default settings (matching mockSettingsStore.appSettings)
const expectedSettings = {
  theme: 'system',
  language: 'zh-CN',
  autoStart: false,
  windowState: {
    mode: 'pet',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 600 },
    isVisible: true,
    isAlwaysOnTop: true,
    isResizable: true,
    title: '紫舒老师桌面版',
  },
  notifications: {
    enabled: true,
    sound: true,
    desktop: true,
  },
  ai: {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2000,
  },
  character: {
    model: 'shizuku',
    voice: 'female',
    personality: 'friendly',
  },
}



// ==================== 测试套件 ====================

describe('useSettings Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock store state
    mockSettingsStore.isLoading = false
    mockSettingsStore.isInitialized = true
    mockSettingsStore.error = null
    mockSettingsStore.appSettings = { 
      ...expectedSettings,
      theme: 'system' as const,
      windowState: {
        ...expectedSettings.windowState,
        mode: 'pet' as const
      }
    }
    
    // Properly reset mock functions
    mockSettingsStore.initialize = vi.fn().mockResolvedValue(undefined)
    mockSettingsStore.updateAppSettings = vi.fn().mockResolvedValue(undefined)
    mockSettingsStore.resetAppSettings = vi.fn().mockResolvedValue(undefined)
    mockSettingsStore.updateTheme = vi.fn().mockResolvedValue(undefined)
    mockSettingsStore.updateLanguage = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础设置管理', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useSettings())

      expect(result.current.settings).toBeDefined()
      expect(result.current.isLoading).toBe(false) // Mock starts as not loading
      expect(result.current.error).toBe(null)
      expect(typeof result.current.updateSettings).toBe('function')
      expect(typeof result.current.resetSettings).toBe('function')
      expect(typeof result.current.updateTheme).toBe('function')
      expect(typeof result.current.updateLanguage).toBe('function')
    })

    it('应该获取初始设置', async () => {
      // Set up to test initialization
      mockSettingsStore.isInitialized = false

      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toEqual(expectedSettings)
      })

      expect(mockSettingsStore.initialize).toHaveBeenCalled()
    })

    it('应该更新设置', async () => {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toEqual(expectedSettings)
      })

      const updates = { language: 'en-US', theme: 'dark' as const }

      await act(async () => {
        await result.current.updateSettings(updates)
      })

      expect(mockSettingsStore.updateAppSettings).toHaveBeenCalledWith(updates)
    })

    it('应该处理部分设置更新', async () => {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      const characterUpdates = {
        character: {
          model: 'sakura',
          voice: 'female',
          personality: 'cheerful',
        },
      }

      await act(async () => {
        await result.current.updateSettings(characterUpdates)
      })

      expect(mockSettingsStore.updateAppSettings).toHaveBeenCalledWith(characterUpdates)
    })

    it('应该重置设置', async () => {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      await act(async () => {
        await result.current.resetSettings()
      })

      expect(mockSettingsStore.resetAppSettings).toHaveBeenCalled()
    })

    it('应该处理更新错误', async () => {
      const testError = new Error('Update failed')
      mockSettingsStore.updateAppSettings.mockRejectedValue(testError)

      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      // Expect the updateSettings call to throw an error
      await expect(
        act(async () => {
          await result.current.updateSettings({ theme: 'dark' })
        })
      ).rejects.toThrow('Update failed')

      expect(mockSettingsStore.updateAppSettings).toHaveBeenCalledWith({ theme: 'dark' })
    })

    it('应该处理初始化错误', async () => {
      const testError = new Error('Init failed')
      mockSettingsStore.error = testError
      mockSettingsStore.isLoading = false

      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.error).toBe(testError)
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})

// ==================== Simple Settings Hook Tests ====================

describe('useSimpleSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock store state for this hook test
    mockSettingsStore.isLoading = false
    mockSettingsStore.isInitialized = true
    mockSettingsStore.error = null
    mockSettingsStore.appSettings = { 
      ...expectedSettings,
      theme: 'system' as const,
      windowState: {
        ...expectedSettings.windowState,
        mode: 'pet' as const
      }
    }
  })

  it('应该返回简化的设置接口', () => {
    const { result } = renderHook(() => useSimpleSettings())

    expect(result.current.settings).toEqual(expectedSettings)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(typeof result.current.updateSettings).toBe('function')
  })

  it('应该调用基础的更新设置方法', async () => {
    const { result } = renderHook(() => useSimpleSettings())

    await act(async () => {
      await result.current.updateSettings({ theme: 'dark' })
    })

    expect(mockSettingsStore.updateAppSettings).toHaveBeenCalledWith({ theme: 'dark' })
  })
})

// ==================== Theme Settings Hook Tests ====================

describe('useThemeSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock store state for this hook test
    mockSettingsStore.isLoading = false
    mockSettingsStore.isInitialized = true
    mockSettingsStore.error = null
    mockSettingsStore.appSettings = { 
      ...expectedSettings,
      theme: 'system' as const,
      windowState: {
        ...expectedSettings.windowState,
        mode: 'pet' as const
      }
    }
  })

  it('应该返回主题相关的接口', () => {
    const { result } = renderHook(() => useThemeSettings())

    expect(result.current.theme).toBe('system')
    expect(typeof result.current.updateTheme).toBe('function')
  })

  it('应该更新主题', async () => {
    const { result } = renderHook(() => useThemeSettings())

    await act(async () => {
      await result.current.updateTheme('light')
    })

    expect(mockSettingsStore.updateTheme).toHaveBeenCalledWith('light')
  })
})

// ==================== Language Settings Hook Tests ====================

describe('useLanguageSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock store state for this hook test
    mockSettingsStore.isLoading = false
    mockSettingsStore.isInitialized = true
    mockSettingsStore.error = null
    mockSettingsStore.appSettings = { 
      ...expectedSettings,
      theme: 'system' as const,
      windowState: {
        ...expectedSettings.windowState,
        mode: 'pet' as const
      }
    }
  })

  it('应该返回语言相关的接口', () => {
    const { result } = renderHook(() => useLanguageSettings())

    expect(result.current.language).toBe('zh-CN')
    expect(typeof result.current.updateLanguage).toBe('function')
  })

  it('应该更新语言', async () => {
    const { result } = renderHook(() => useLanguageSettings())

    await act(async () => {
      await result.current.updateLanguage('ja-JP')
    })

    expect(mockSettingsStore.updateLanguage).toHaveBeenCalledWith('ja-JP')
  })
})

// ==================== 集成测试 ====================

describe('Settings Hooks 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mocks for integration tests
    mockSettingsStore.appSettings = { 
      ...expectedSettings,
      theme: 'system' as const,
      windowState: {
        ...expectedSettings.windowState,
        mode: 'pet' as const
      }
    }
    mockSettingsStore.updateAppSettings.mockResolvedValue(undefined)
    mockSettingsStore.exportSettings.mockResolvedValue('{"settings": "exported"}')
  })

  it('应该完成设置管理完整流程', async () => {
    const { result } = renderHook(() => useSettings())

    // 1. 加载设置
    await waitFor(() => {
      expect(result.current.settings).toEqual(expectedSettings)
      expect(result.current.isInitialized).toBe(true)
    })

    // 2. 更新设置
    await act(async () => {
      await result.current.updateSettings({ language: 'en-US' })
    })

    expect(mockSettingsStore.updateAppSettings).toHaveBeenCalledWith({ language: 'en-US' })

    // 3. 导出设置
    let exportData: string
    await act(async () => {
      exportData = await result.current.exportSettings()
    })

    expect(exportData!).toBe('{"settings": "exported"}')
    expect(mockSettingsStore.exportSettings).toHaveBeenCalled()

    // 4. 重置设置
    await act(async () => {
      await result.current.resetSettings()
    })

    expect(mockSettingsStore.resetAppSettings).toHaveBeenCalled()
  })

  it('应该处理设置同步', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.settings).toBeTruthy()
    })

    // 测试同步到后端
    await act(async () => {
      await result.current.syncToBackend()
    })

    expect(mockSettingsStore.syncToBackend).toHaveBeenCalled()

    // 测试从后端同步
    await act(async () => {
      await result.current.syncFromBackend()
    })

    expect(mockSettingsStore.syncFromBackend).toHaveBeenCalled()

    // 测试强制同步
    await act(async () => {
      await result.current.forceSync()
    })

    expect(mockSettingsStore.forceSync).toHaveBeenCalled()
  })

  it('应该处理主题更新', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.settings).toBeTruthy()
    })

    await act(async () => {
      await result.current.updateTheme('dark')
    })

    expect(mockSettingsStore.updateTheme).toHaveBeenCalledWith('dark')
  })

  it('应该处理语言更新', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.settings).toBeTruthy()
    })

    await act(async () => {
      await result.current.updateLanguage('en-US')
    })

    expect(mockSettingsStore.updateLanguage).toHaveBeenCalledWith('en-US')
  })
})

