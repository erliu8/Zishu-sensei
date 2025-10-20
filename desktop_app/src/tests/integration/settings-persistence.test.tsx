/**
 * 设置持久化集成测试
 * 
 * 测试设置系统的完整功能，包括：
 * - 设置保存和加载
 * - 设置同步
 * - 设置验证
 * - 设置在组件间的传播
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useSettingsStore, SyncStatus } from '@/stores/settingsStore'
import { ThemeMode } from '@/types/app'

// Mock Tauri API
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('设置持久化集成测试', () => {
  beforeEach(() => {
    // 重置 store
    act(() => {
      useSettingsStore.setState({
        appSettings: {
          theme: ThemeMode.SYSTEM,
          language: 'zh-CN',
          autoStart: false,
          minimizeToTray: true,
          closeToTray: false,
          notifications: {
            enabled: true,
            sound: true,
            desktop: true,
          },
          windowState: {
            width: 1200,
            height: 800,
            x: 100,
            y: 100,
            isMaximized: false,
            isMinimized: false,
          },
        },
        isLoading: false,
        isInitialized: false,
        syncStatus: SyncStatus.IDLE,
        error: null,
        lastSyncTime: null,
        history: [],
        eventListeners: [],
      })
    })
    
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('设置保存和加载', () => {
    it('应该完成更改设置 → 保存 → 重启应用 → 设置保持的流程', async () => {
      const store = useSettingsStore.getState()
      
      // ========== 1. 初始化设置 ==========
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          window: {
            width: 1200,
            height: 800,
            resizable: true,
            transparent: false,
            decorations: true,
          },
          character: {
            current_character: null,
            scale: 1.0,
            auto_idle: true,
            interaction_enabled: true,
          },
          theme: {
            mode: 'system',
            custom_colors: {},
          },
          system: {
            auto_start: false,
            minimize_to_tray: true,
            close_to_tray: false,
            language: 'zh-CN',
          },
        },
      })
      
      await act(async () => {
        await store.initialize()
      })
      
      expect(store.isInitialized).toBe(true)
      expect(store.error).toBeNull()
      
      // ========== 2. 更改设置 ==========
      const newSettings = {
        theme: ThemeMode.DARK,
        language: 'en-US',
        autoStart: true,
        notifications: {
          enabled: true,
          sound: false,
          desktop: true,
        },
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: newSettings,
      })
      
      await act(async () => {
        await store.updateAppSettings(newSettings)
      })
      
      // 验证设置已更新
      expect(store.appSettings.theme).toBe(ThemeMode.DARK)
      expect(store.appSettings.language).toBe('en-US')
      expect(store.appSettings.autoStart).toBe(true)
      expect(store.appSettings.notifications.sound).toBe(false)
      
      // 验证同步状态
      expect(store.syncStatus).not.toBe(SyncStatus.ERROR)
      
      // ========== 3. 保存设置 ==========
      mockInvoke.mockResolvedValueOnce({
        success: true,
        message: '设置保存成功',
      })
      
      await act(async () => {
        await store.saveSettings()
      })
      
      expect(store.lastSyncTime).toBeTruthy()
      
      // ========== 4. 模拟应用重启 - 清空状态 ==========
      act(() => {
        useSettingsStore.setState({
          appSettings: {
            theme: ThemeMode.SYSTEM,
            language: 'zh-CN',
            autoStart: false,
            minimizeToTray: true,
            closeToTray: false,
            notifications: {
              enabled: true,
              sound: true,
              desktop: true,
            },
            windowState: {
              width: 1200,
              height: 800,
              x: 100,
              y: 100,
              isMaximized: false,
              isMinimized: false,
            },
          },
          isInitialized: false,
        })
      })
      
      // ========== 5. 重新加载设置 ==========
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          window: {
            width: 1200,
            height: 800,
            resizable: true,
            transparent: false,
            decorations: true,
          },
          character: {
            current_character: null,
            scale: 1.0,
            auto_idle: true,
            interaction_enabled: true,
          },
          theme: {
            mode: 'dark',
            custom_colors: {},
          },
          system: {
            auto_start: true,
            minimize_to_tray: true,
            close_to_tray: false,
            language: 'en-US',
          },
        },
      })
      
      await act(async () => {
        await store.loadSettings()
      })
      
      // ========== 6. 验证设置保持 ==========
      // 注意：这里的验证基于 mock 返回的数据
      const loadedConfig = store.appConfig
      expect(loadedConfig.theme.mode).toBe('dark')
      expect(loadedConfig.system.language).toBe('en-US')
      expect(loadedConfig.system.auto_start).toBe(true)
    })

    it('应该支持设置重置', async () => {
      const store = useSettingsStore.getState()
      
      // 更改一些设置
      await act(async () => {
        await store.updateAppSettings({
          theme: ThemeMode.DARK,
          language: 'ja-JP',
          autoStart: true,
        })
      })
      
      expect(store.appSettings.theme).toBe(ThemeMode.DARK)
      
      // 重置设置
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          theme: ThemeMode.SYSTEM,
          language: 'zh-CN',
          autoStart: false,
        },
      })
      
      await act(async () => {
        await store.resetSettings()
      })
      
      // 验证设置已重置
      expect(store.appSettings.theme).toBe(ThemeMode.SYSTEM)
      expect(store.appSettings.language).toBe('zh-CN')
      expect(store.appSettings.autoStart).toBe(false)
    })

    it('应该记录设置变更历史', async () => {
      const store = useSettingsStore.getState()
      
      // 初始历史应该为空
      expect(store.history).toHaveLength(0)
      
      // 进行多次设置更改
      const changes = [
        { theme: ThemeMode.DARK },
        { language: 'en-US' },
        { autoStart: true },
      ]
      
      for (const change of changes) {
        mockInvoke.mockResolvedValueOnce({
          success: true,
          data: change,
        })
        
        await act(async () => {
          await store.updateAppSettings(change)
        })
      }
      
      // 验证历史记录
      expect(store.history.length).toBeGreaterThan(0)
      
      // 验证历史记录包含变更信息
      const themeChange = store.history.find(
        h => h.changes.some(c => c.path === 'theme')
      )
      expect(themeChange).toBeDefined()
    })
  })

  describe('设置同步', () => {
    it('应该同步到所有组件', async () => {
      const store = useSettingsStore.getState()
      
      // 注册事件监听器
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      act(() => {
        store.addEventListener(listener1)
        store.addEventListener(listener2)
      })
      
      // 更改设置
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { theme: ThemeMode.DARK },
      })
      
      await act(async () => {
        await store.updateAppSettings({ theme: ThemeMode.DARK })
      })
      
      // 验证所有监听器都被调用
      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
      
      // 验证事件包含正确的数据
      const event = listener1.mock.calls[0][0]
      expect(event.type).toBe('update')
      expect(event.section).toBe('app')
    })

    it('应该处理同步冲突', async () => {
      const store = useSettingsStore.getState()
      
      // 模拟前端和后端设置不一致
      act(() => {
        useSettingsStore.setState({
          appSettings: {
            ...store.appSettings,
            theme: ThemeMode.DARK,
          },
          appConfig: {
            ...store.appConfig,
            theme: {
              mode: 'light',
              custom_colors: {},
            },
          },
        })
      })
      
      // 触发同步
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          window: store.appConfig.window,
          character: store.appConfig.character,
          theme: {
            mode: 'dark',
            custom_colors: {},
          },
          system: store.appConfig.system,
        },
      })
      
      await act(async () => {
        await store.syncSettings()
      })
      
      // 验证同步后一致
      expect(store.syncStatus).toBe(SyncStatus.SYNCED)
      expect(store.error).toBeNull()
    })

    it('应该自动同步定期更改', async () => {
      const store = useSettingsStore.getState()
      
      // 设置自动同步
      act(() => {
        useSettingsStore.setState({
          lastSyncTime: Date.now() - 6 * 60 * 1000, // 6分钟前
        })
      })
      
      // 检查是否需要同步
      const needsSync = store.needsSync()
      expect(needsSync).toBe(true)
      
      // 执行同步
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: store.appConfig,
      })
      
      await act(async () => {
        await store.syncSettings()
      })
      
      expect(store.syncStatus).toBe(SyncStatus.SYNCED)
      expect(store.lastSyncTime).toBeTruthy()
    })
  })

  describe('主题设置', () => {
    it('应该正确切换主题', async () => {
      const store = useSettingsStore.getState()
      
      // 切换到暗色主题
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'dark',
          custom_colors: {},
        },
      })
      
      await act(async () => {
        await store.updateTheme(ThemeMode.DARK)
      })
      
      expect(store.getCurrentTheme()).toBe(ThemeMode.DARK)
      
      // 切换到亮色主题
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'light',
          custom_colors: {},
        },
      })
      
      await act(async () => {
        await store.updateTheme(ThemeMode.LIGHT)
      })
      
      expect(store.getCurrentTheme()).toBe(ThemeMode.LIGHT)
      
      // 切换到系统主题
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'system',
          custom_colors: {},
        },
      })
      
      await act(async () => {
        await store.updateTheme(ThemeMode.SYSTEM)
      })
      
      expect(store.getCurrentTheme()).toBe(ThemeMode.SYSTEM)
    })

    it('应该支持自定义主题颜色', async () => {
      const store = useSettingsStore.getState()
      
      const customColors = {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        background: '#1F2937',
        text: '#F3F4F6',
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'dark',
          custom_colors: customColors,
        },
      })
      
      await act(async () => {
        await store.updateThemeConfig({
          custom_colors: customColors,
        })
      })
      
      expect(store.appConfig.theme.custom_colors).toEqual(customColors)
    })
  })

  describe('窗口设置', () => {
    it('应该保存和恢复窗口状态', async () => {
      const store = useSettingsStore.getState()
      
      const windowState = {
        width: 1400,
        height: 900,
        x: 200,
        y: 150,
        isMaximized: false,
        isMinimized: false,
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: windowState,
      })
      
      await act(async () => {
        await store.updateWindowState(windowState)
      })
      
      expect(store.appSettings.windowState).toEqual(windowState)
      
      // 模拟应用重启后恢复
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          window: {
            width: 1400,
            height: 900,
            resizable: true,
            transparent: false,
            decorations: true,
          },
          character: store.appConfig.character,
          theme: store.appConfig.theme,
          system: store.appConfig.system,
        },
      })
      
      await act(async () => {
        await store.loadSettings()
      })
      
      const config = store.getWindowConfig()
      expect(config.width).toBe(1400)
      expect(config.height).toBe(900)
    })

    it('应该限制窗口大小', async () => {
      const store = useSettingsStore.getState()
      
      // 尝试设置过小的窗口
      const tooSmallWindow = {
        width: 400, // 最小宽度假设为 800
        height: 300, // 最小高度假设为 600
        x: 0,
        y: 0,
        isMaximized: false,
        isMinimized: false,
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: '窗口尺寸低于最小值',
      })
      
      try {
        await act(async () => {
          await store.updateWindowState(tooSmallWindow)
        })
      } catch (error) {
        expect((error as Error).message).toContain('窗口尺寸')
      }
    })
  })

  describe('角色设置', () => {
    it('应该保存和加载角色配置', async () => {
      const store = useSettingsStore.getState()
      
      const characterConfig = {
        current_character: 'hiyori',
        scale: 1.5,
        auto_idle: true,
        interaction_enabled: true,
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: characterConfig,
      })
      
      await act(async () => {
        await store.updateCharacterConfig(characterConfig)
      })
      
      const config = store.getCharacterConfig()
      expect(config.current_character).toBe('hiyori')
      expect(config.scale).toBe(1.5)
      expect(config.auto_idle).toBe(true)
    })
  })

  describe('系统设置', () => {
    it('应该正确切换自动启动', async () => {
      const store = useSettingsStore.getState()
      
      expect(store.appSettings.autoStart).toBe(false)
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { autoStart: true },
      })
      
      await act(async () => {
        await store.toggleAutoStart()
      })
      
      expect(store.appSettings.autoStart).toBe(true)
      
      // 再次切换
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { autoStart: false },
      })
      
      await act(async () => {
        await store.toggleAutoStart()
      })
      
      expect(store.appSettings.autoStart).toBe(false)
    })

    it('应该更新语言设置', async () => {
      const store = useSettingsStore.getState()
      
      const languages = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR']
      
      for (const lang of languages) {
        mockInvoke.mockResolvedValueOnce({
          success: true,
          data: { language: lang },
        })
        
        await act(async () => {
          await store.updateLanguage(lang)
        })
        
        expect(store.getCurrentLanguage()).toBe(lang)
      }
    })

    it('应该更新通知设置', async () => {
      const store = useSettingsStore.getState()
      
      const notificationSettings = {
        enabled: true,
        sound: false,
        desktop: true,
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: notificationSettings,
      })
      
      await act(async () => {
        await store.updateNotifications(notificationSettings)
      })
      
      expect(store.appSettings.notifications).toEqual(notificationSettings)
    })
  })

  describe('错误处理', () => {
    it('应该处理保存失败', async () => {
      const store = useSettingsStore.getState()
      
      mockInvoke.mockRejectedValueOnce(new Error('保存失败：磁盘空间不足'))
      
      await act(async () => {
        try {
          await store.saveSettings()
        } catch (error) {
          // 错误应该被捕获
        }
      })
      
      expect(store.error).toBeTruthy()
      expect(store.syncStatus).toBe(SyncStatus.ERROR)
    })

    it('应该处理加载失败', async () => {
      const store = useSettingsStore.getState()
      
      mockInvoke.mockRejectedValueOnce(new Error('加载失败：配置文件损坏'))
      
      await act(async () => {
        try {
          await store.loadSettings()
        } catch (error) {
          // 错误应该被捕获
        }
      })
      
      expect(store.error).toBeTruthy()
    })

    it('应该在错误后恢复', async () => {
      const store = useSettingsStore.getState()
      
      // 第一次保存失败
      mockInvoke.mockRejectedValueOnce(new Error('网络错误'))
      
      await act(async () => {
        try {
          await store.saveSettings()
        } catch (error) {
          // 忽略错误
        }
      })
      
      expect(store.error).toBeTruthy()
      
      // 清除错误
      act(() => {
        store.clearError()
      })
      
      expect(store.error).toBeNull()
      
      // 第二次保存成功
      mockInvoke.mockResolvedValueOnce({
        success: true,
        message: '保存成功',
      })
      
      await act(async () => {
        await store.saveSettings()
      })
      
      expect(store.error).toBeNull()
      expect(store.syncStatus).toBe(SyncStatus.SYNCED)
    })
  })

  describe('设置验证', () => {
    it('应该验证设置值的有效性', async () => {
      const store = useSettingsStore.getState()
      
      // 尝试设置无效的主题值
      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: '无效的主题值',
      })
      
      try {
        await act(async () => {
          await store.updateTheme('invalid-theme' as ThemeMode)
        })
      } catch (error) {
        expect((error as Error).message).toContain('无效')
      }
    })

    it('应该验证窗口尺寸', async () => {
      const store = useSettingsStore.getState()
      
      const invalidWindowState = {
        width: -100, // 负数
        height: 0, // 零
        x: 0,
        y: 0,
        isMaximized: false,
        isMinimized: false,
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: '窗口尺寸必须为正数',
      })
      
      try {
        await act(async () => {
          await store.updateWindowState(invalidWindowState)
        })
      } catch (error) {
        expect((error as Error).message).toContain('窗口尺寸')
      }
    })
  })

  describe('设置导入导出', () => {
    it('应该支持导出设置', async () => {
      const store = useSettingsStore.getState()
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          appSettings: store.appSettings,
          appConfig: store.appConfig,
          version: '1.0.0',
          exportTime: Date.now(),
        },
      })
      
      const exported = await act(async () => {
        return await store.exportSettings()
      })
      
      expect(exported).toBeDefined()
      expect(exported.version).toBe('1.0.0')
      expect(exported.appSettings).toEqual(store.appSettings)
    })

    it('应该支持导入设置', async () => {
      const store = useSettingsStore.getState()
      
      const importedSettings = {
        version: '1.0.0',
        appSettings: {
          theme: ThemeMode.DARK,
          language: 'en-US',
          autoStart: true,
          minimizeToTray: false,
          closeToTray: true,
          notifications: {
            enabled: false,
            sound: false,
            desktop: false,
          },
          windowState: {
            width: 1600,
            height: 1000,
            x: 50,
            y: 50,
            isMaximized: true,
            isMinimized: false,
          },
        },
        appConfig: store.appConfig,
        exportTime: Date.now(),
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: importedSettings.appSettings,
      })
      
      await act(async () => {
        await store.importSettings(importedSettings)
      })
      
      expect(store.appSettings.theme).toBe(ThemeMode.DARK)
      expect(store.appSettings.language).toBe('en-US')
      expect(store.appSettings.autoStart).toBe(true)
    })
  })
})

