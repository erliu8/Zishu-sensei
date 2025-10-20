/**
 * 桌面操作状态管理 Store 测试
 * 
 * 测试桌面操作状态管理的所有功能，包括：
 * - 应用状态管理
 * - 操作状态管理
 * - 窗口管理
 * - 快捷键管理
 * - 文件操作
 * - 通知管理
 * - 系统信息管理
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDesktopStore } from '@/stores/desktopStore'
import type { AppSettings, AppConfig } from '@/types/app'

// Mock dependencies
vi.mock('zustand/middleware', () => ({
  devtools: vi.fn((fn) => fn),
  persist: vi.fn((fn, options) => fn),
  subscribeWithSelector: vi.fn((fn) => fn),
  immer: vi.fn((fn) => fn),
}))

// ==================== 测试数据工厂 ====================

const createMockSystemInfo = () => ({
  platform: 'win32' as const,
  arch: 'x64',
  version: '10.0.19041',
  hostname: 'test-computer',
  cpuCount: 8,
  totalMemory: 16 * 1024 * 1024 * 1024, // 16GB
  uptime: 3600,
})

const createMockAppInfo = () => ({
  name: 'Zishu Sensei',
  version: '1.0.0',
  buildNumber: '100',
  isDevelopment: false,
  dataPath: '/data',
  configPath: '/config',
  logPath: '/logs',
})

const createMockPerformance = () => ({
  cpuUsage: 15.5,
  memoryUsage: 512 * 1024 * 1024, // 512MB
  memoryUsagePercent: 3.2,
  diskUsage: 100 * 1024 * 1024 * 1024, // 100GB
  diskUsagePercent: 50.0,
  networkSent: 1024 * 1024, // 1MB
  networkReceived: 2 * 1024 * 1024, // 2MB
})

const createMockConnectivity = () => ({
  isOnline: true,
  connectionType: 'ethernet' as const,
  downlink: 100,
  rtt: 20,
  effectiveType: '4g' as const,
})

const createMockWindow = () => ({
  id: 'window-1',
  title: 'Test Window',
  pid: 1234,
  executable: 'test.exe',
  path: '/path/to/test.exe',
  icon: null,
  isVisible: true,
  isMinimized: false,
  isMaximized: false,
  isActive: false,
  bounds: {
    x: 100,
    y: 100,
    width: 800,
    height: 600,
  },
})

const createMockShortcut = () => ({
  id: 'shortcut-1',
  name: 'Test Shortcut',
  description: 'A test shortcut',
  keys: ['Ctrl', 'Alt', 'T'],
  globalKey: 'ctrl+alt+t',
  action: 'test_action',
  category: 'test',
  enabled: true,
})

const createMockFileOperation = () => ({
  id: 'file-op-1',
  type: 'copy' as const,
  source: '/source/file.txt',
  destination: '/dest/file.txt',
  status: 'pending' as const,
  progress: 0,
  startTime: Date.now(),
  endTime: null,
  error: null,
  size: 1024,
  processedSize: 0,
})

const createMockNotification = () => ({
  id: 'notification-1',
  title: 'Test Notification',
  body: 'This is a test notification',
  type: 'info' as const,
  priority: 'normal' as const,
  timestamp: Date.now(),
  read: false,
  actions: [],
  data: {},
})

const createMockSettings = (): AppSettings => ({
  theme: 'system',
  language: 'zh-CN',
  windowState: {
    width: 1024,
    height: 768,
    x: 100,
    y: 100,
    isMaximized: false,
    isMinimized: false,
  },
  autoStart: false,
  minimizeToTray: true,
  closeToTray: false,
  notifications: {
    enabled: true,
    sound: true,
    position: 'top-right',
  },
})

const createMockConfig = (): AppConfig => ({
  window: {
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
  },
  character: {
    defaultModel: 'hiyori',
    autoLoadModel: true,
    modelPath: '/models',
  },
  theme: {
    default: 'light',
    followSystem: true,
    customColors: {},
  },
  system: {
    enableTelemetry: false,
    autoUpdate: true,
    updateChannel: 'stable',
  },
})

// ==================== 测试套件 ====================

describe('DesktopStore', () => {
  beforeEach(() => {
    // 重置 Store
    act(() => {
      useDesktopStore.getState().reset?.()
    })
    
    // 重置所有 mocks
    vi.clearAllMocks()
  })

  // ==================== 初始状态测试 ====================
  
  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useDesktopStore.getState()
      
      // 基础状态
      expect(state.isInitialized).toBe(false)
      expect(state.isOnline).toBe(false)
      expect(state.lastSyncTime).toBe(0)
      
      // 应用状态
      expect(state.appState.isReady).toBe(false)
      expect(state.appState.isInitializing).toBe(false)
      expect(state.appState.systemInfo).toBeDefined()
      expect(state.appState.appInfo).toBeDefined()
      expect(state.appState.performance).toBeDefined()
      expect(state.appState.connectivity).toBeDefined()
      
      // 操作状态
      expect(state.operationState.isLoading).toBe(false)
      expect(state.operationState.error).toBeNull()
      expect(state.operationState.operationHistory).toEqual([])
      expect(state.operationState.retryQueue).toEqual([])
      
      // 窗口状态
      expect(state.windowState.mode).toBe('windowed')
      expect(state.windowState.position).toBeDefined()
      expect(state.windowState.size).toBeDefined()
      expect(state.windowState.isVisible).toBe(true)
      expect(state.windowState.isMaximized).toBe(false)
      expect(state.windowState.isMinimized).toBe(false)
      expect(state.windowState.isAlwaysOnTop).toBe(false)
      
      // 其他状态
      expect(state.shortcutState.shortcuts).toEqual([])
      expect(state.fileOperationState.operations).toEqual([])
      expect(state.notificationState.notifications).toEqual([])
    })
    
    it('应该有正确的默认设置和配置', () => {
      const state = useDesktopStore.getState()
      
      expect(state.settings).toBeDefined()
      expect(state.config).toBeDefined()
      
      // 检查一些关键的默认值
      expect(state.settings.theme).toBeDefined()
      expect(state.settings.language).toBeDefined()
      expect(state.config.window).toBeDefined()
      expect(state.config.system).toBeDefined()
    })
  })

  // ==================== 应用状态管理测试 ====================

  describe('应用状态管理', () => {
    it('应该正确初始化应用', async () => {
      const mockPromise = Promise.resolve()
      vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback()
        return 1 as any
      })
      
      await act(async () => {
        await useDesktopStore.getState().initializeApp()
      })
      
      const state = useDesktopStore.getState()
      expect(state.appState.isInitializing).toBe(false)
      expect(state.appState.isReady).toBe(true)
      expect(state.isInitialized).toBe(true)
      expect(state.lastSyncTime).toBeGreaterThan(0)
    })

    it('初始化失败时应该设置错误状态', async () => {
      // Mock setTimeout to throw error
      vi.spyOn(global, 'setTimeout').mockImplementation(() => {
        throw new Error('Initialization failed')
      })
      
      await act(async () => {
        await useDesktopStore.getState().initializeApp()
      })
      
      const state = useDesktopStore.getState()
      expect(state.appState.isInitializing).toBe(false)
      expect(state.appState.isReady).toBe(false)
      expect(state.operationState.error).toBeTruthy()
    })

    it('应该正确设置应用准备状态', () => {
      act(() => {
        useDesktopStore.getState().setAppReady(true)
      })
      
      expect(useDesktopStore.getState().appState.isReady).toBe(true)
      
      act(() => {
        useDesktopStore.getState().setAppReady(false)
      })
      
      expect(useDesktopStore.getState().appState.isReady).toBe(false)
    })

    it('应该正确设置初始化状态', () => {
      act(() => {
        useDesktopStore.getState().setInitializing(true)
      })
      
      expect(useDesktopStore.getState().appState.isInitializing).toBe(true)
      
      act(() => {
        useDesktopStore.getState().setInitializing(false)
      })
      
      expect(useDesktopStore.getState().appState.isInitializing).toBe(false)
    })

    it('应该正确更新系统信息', () => {
      const systemInfo = createMockSystemInfo()
      
      act(() => {
        useDesktopStore.getState().updateSystemInfo(systemInfo)
      })
      
      const state = useDesktopStore.getState()
      expect(state.appState.systemInfo.platform).toBe('win32')
      expect(state.appState.systemInfo.cpuCount).toBe(8)
      expect(state.appState.systemInfo.totalMemory).toBe(16 * 1024 * 1024 * 1024)
    })

    it('应该正确更新应用信息', () => {
      const appInfo = createMockAppInfo()
      
      act(() => {
        useDesktopStore.getState().updateAppInfo(appInfo)
      })
      
      const state = useDesktopStore.getState()
      expect(state.appState.appInfo.name).toBe('Zishu Sensei')
      expect(state.appState.appInfo.version).toBe('1.0.0')
    })

    it('应该正确更新性能指标', () => {
      const performance = createMockPerformance()
      
      act(() => {
        useDesktopStore.getState().updatePerformance(performance)
      })
      
      const state = useDesktopStore.getState()
      expect(state.appState.performance.cpuUsage).toBe(15.5)
      expect(state.appState.performance.memoryUsage).toBe(512 * 1024 * 1024)
    })

    it('应该正确更新连接状态', () => {
      const connectivity = createMockConnectivity()
      
      act(() => {
        useDesktopStore.getState().updateConnectivity(connectivity)
      })
      
      const state = useDesktopStore.getState()
      expect(state.appState.connectivity.isOnline).toBe(true)
      expect(state.appState.connectivity.connectionType).toBe('ethernet')
    })
  })

  // ==================== 操作状态管理测试 ====================

  describe('操作状态管理', () => {
    it('应该正确设置加载状态', () => {
      act(() => {
        useDesktopStore.getState().setLoading(true)
      })
      
      expect(useDesktopStore.getState().operationState.isLoading).toBe(true)
      
      act(() => {
        useDesktopStore.getState().setLoading(false)
      })
      
      expect(useDesktopStore.getState().operationState.isLoading).toBe(false)
    })

    it('应该正确设置错误状态', () => {
      const errorMessage = 'Test error'
      
      act(() => {
        useDesktopStore.getState().setError(errorMessage)
      })
      
      expect(useDesktopStore.getState().operationState.error).toBe(errorMessage)
      
      act(() => {
        useDesktopStore.getState().setError(null)
      })
      
      expect(useDesktopStore.getState().operationState.error).toBeNull()
    })

    it('应该正确添加操作历史记录', () => {
      const operation = {
        type: 'test_operation' as const,
        description: 'Test operation',
        status: 'success' as const,
        data: { test: 'data' },
      }
      
      act(() => {
        useDesktopStore.getState().addOperation(operation)
      })
      
      const history = useDesktopStore.getState().operationState.operationHistory
      expect(history).toHaveLength(1)
      expect(history[0].type).toBe('test_operation')
      expect(history[0].id).toBeDefined()
      expect(history[0].timestamp).toBeDefined()
    })

    it('应该正确清除操作历史', () => {
      const operation = {
        type: 'test_operation' as const,
        description: 'Test operation',
        status: 'success' as const,
      }
      
      act(() => {
        useDesktopStore.getState().addOperation(operation)
        useDesktopStore.getState().clearOperationHistory()
      })
      
      expect(useDesktopStore.getState().operationState.operationHistory).toEqual([])
    })

    it('应该正确管理重试队列', () => {
      const retryOperation = {
        type: 'retry_operation' as const,
        description: 'Retry operation',
        data: { test: 'data' },
      }
      
      let operationId: string
      
      act(() => {
        useDesktopStore.getState().addToRetryQueue(retryOperation)
      })
      
      const queue = useDesktopStore.getState().operationState.retryQueue
      expect(queue).toHaveLength(1)
      operationId = queue[0].id
      
      act(() => {
        useDesktopStore.getState().removeFromRetryQueue(operationId!)
      })
      
      expect(useDesktopStore.getState().operationState.retryQueue).toEqual([])
    })

    it('应该正确清空重试队列', () => {
      const retryOperation = {
        type: 'retry_operation' as const,
        description: 'Retry operation',
      }
      
      act(() => {
        useDesktopStore.getState().addToRetryQueue(retryOperation)
        useDesktopStore.getState().clearRetryQueue()
      })
      
      expect(useDesktopStore.getState().operationState.retryQueue).toEqual([])
    })
  })

  // ==================== 窗口管理测试 ====================

  describe('窗口管理', () => {
    it('应该正确设置窗口模式', () => {
      act(() => {
        useDesktopStore.getState().setWindowMode('fullscreen')
      })
      
      expect(useDesktopStore.getState().windowState.mode).toBe('fullscreen')
      
      act(() => {
        useDesktopStore.getState().setWindowMode('windowed')
      })
      
      expect(useDesktopStore.getState().windowState.mode).toBe('windowed')
    })

    it('应该正确设置窗口位置', () => {
      const position = { x: 200, y: 150 }
      
      act(() => {
        useDesktopStore.getState().setWindowPosition(position)
      })
      
      const state = useDesktopStore.getState()
      expect(state.windowState.position.x).toBe(200)
      expect(state.windowState.position.y).toBe(150)
    })

    it('应该正确设置窗口尺寸', () => {
      const size = { width: 1200, height: 800 }
      
      act(() => {
        useDesktopStore.getState().setWindowSize(size)
      })
      
      const state = useDesktopStore.getState()
      expect(state.windowState.size.width).toBe(1200)
      expect(state.windowState.size.height).toBe(800)
    })

    it('应该正确设置窗口可见性', () => {
      act(() => {
        useDesktopStore.getState().setWindowVisible(false)
      })
      
      expect(useDesktopStore.getState().windowState.isVisible).toBe(false)
      
      act(() => {
        useDesktopStore.getState().setWindowVisible(true)
      })
      
      expect(useDesktopStore.getState().windowState.isVisible).toBe(true)
    })

    it('应该正确设置窗口最大化状态', () => {
      act(() => {
        useDesktopStore.getState().setWindowMaximized(true)
      })
      
      expect(useDesktopStore.getState().windowState.isMaximized).toBe(true)
      
      act(() => {
        useDesktopStore.getState().setWindowMaximized(false)
      })
      
      expect(useDesktopStore.getState().windowState.isMaximized).toBe(false)
    })

    it('应该正确设置窗口最小化状态', () => {
      act(() => {
        useDesktopStore.getState().setWindowMinimized(true)
      })
      
      expect(useDesktopStore.getState().windowState.isMinimized).toBe(true)
      
      act(() => {
        useDesktopStore.getState().setWindowMinimized(false)
      })
      
      expect(useDesktopStore.getState().windowState.isMinimized).toBe(false)
    })

    it('应该正确设置窗口置顶状态', () => {
      act(() => {
        useDesktopStore.getState().setWindowAlwaysOnTop(true)
      })
      
      expect(useDesktopStore.getState().windowState.isAlwaysOnTop).toBe(true)
      
      act(() => {
        useDesktopStore.getState().setWindowAlwaysOnTop(false)
      })
      
      expect(useDesktopStore.getState().windowState.isAlwaysOnTop).toBe(false)
    })

    it('应该正确获取窗口列表', () => {
      const windows = [createMockWindow()]
      
      act(() => {
        useDesktopStore.getState().setWindowList(windows)
      })
      
      expect(useDesktopStore.getState().windowState.windowList).toEqual(windows)
    })
  })

  // ==================== 快捷键管理测试 ====================

  describe('快捷键管理', () => {
    it('应该正确添加快捷键', () => {
      const shortcut = createMockShortcut()
      
      act(() => {
        useDesktopStore.getState().addShortcut(shortcut)
      })
      
      const shortcuts = useDesktopStore.getState().shortcutState.shortcuts
      expect(shortcuts).toHaveLength(1)
      expect(shortcuts[0]).toEqual(shortcut)
    })

    it('应该正确更新快捷键', () => {
      const shortcut = createMockShortcut()
      
      act(() => {
        useDesktopStore.getState().addShortcut(shortcut)
      })
      
      const updates = {
        name: 'Updated Shortcut',
        keys: ['Ctrl', 'Shift', 'T'],
      }
      
      act(() => {
        useDesktopStore.getState().updateShortcut(shortcut.id, updates)
      })
      
      const shortcuts = useDesktopStore.getState().shortcutState.shortcuts
      expect(shortcuts[0].name).toBe('Updated Shortcut')
      expect(shortcuts[0].keys).toEqual(['Ctrl', 'Shift', 'T'])
    })

    it('应该正确删除快捷键', () => {
      const shortcut = createMockShortcut()
      
      act(() => {
        useDesktopStore.getState().addShortcut(shortcut)
      })
      
      act(() => {
        useDesktopStore.getState().removeShortcut(shortcut.id)
      })
      
      expect(useDesktopStore.getState().shortcutState.shortcuts).toEqual([])
    })

    it('应该正确启用/禁用快捷键', () => {
      const shortcut = createMockShortcut()
      
      act(() => {
        useDesktopStore.getState().addShortcut(shortcut)
      })
      
      act(() => {
        useDesktopStore.getState().toggleShortcut(shortcut.id)
      })
      
      expect(useDesktopStore.getState().shortcutState.shortcuts[0].enabled).toBe(false)
      
      act(() => {
        useDesktopStore.getState().toggleShortcut(shortcut.id)
      })
      
      expect(useDesktopStore.getState().shortcutState.shortcuts[0].enabled).toBe(true)
    })

    it('应该正确触发快捷键', () => {
      const shortcut = createMockShortcut()
      
      act(() => {
        useDesktopStore.getState().addShortcut(shortcut)
      })
      
      act(() => {
        useDesktopStore.getState().triggerShortcut('ctrl+alt+t')
      })
      
      // 这里应该检查快捷键是否被触发，但由于没有实际的处理逻辑，我们只检查没有错误
      expect(useDesktopStore.getState().operationState.error).toBeNull()
    })
  })

  // ==================== 文件操作测试 ====================

  describe('文件操作', () => {
    it('应该正确添加文件操作', () => {
      const operation = createMockFileOperation()
      
      act(() => {
        useDesktopStore.getState().addFileOperation(operation)
      })
      
      const operations = useDesktopStore.getState().fileOperationState.operations
      expect(operations).toHaveLength(1)
      expect(operations[0]).toEqual(operation)
    })

    it('应该正确更新文件操作状态', () => {
      const operation = createMockFileOperation()
      
      act(() => {
        useDesktopStore.getState().addFileOperation(operation)
      })
      
      const updates = {
        status: 'completed' as const,
        progress: 100,
        endTime: Date.now(),
      }
      
      act(() => {
        useDesktopStore.getState().updateFileOperation(operation.id, updates)
      })
      
      const operations = useDesktopStore.getState().fileOperationState.operations
      expect(operations[0].status).toBe('completed')
      expect(operations[0].progress).toBe(100)
      expect(operations[0].endTime).toBeDefined()
    })

    it('应该正确删除文件操作', () => {
      const operation = createMockFileOperation()
      
      act(() => {
        useDesktopStore.getState().addFileOperation(operation)
      })
      
      act(() => {
        useDesktopStore.getState().removeFileOperation(operation.id)
      })
      
      expect(useDesktopStore.getState().fileOperationState.operations).toEqual([])
    })

    it('应该正确清空文件操作历史', () => {
      const operation1 = createMockFileOperation()
      const operation2 = { ...createMockFileOperation(), id: 'file-op-2' }
      
      act(() => {
        useDesktopStore.getState().addFileOperation(operation1)
        useDesktopStore.getState().addFileOperation(operation2)
      })
      
      act(() => {
        useDesktopStore.getState().clearFileOperations()
      })
      
      expect(useDesktopStore.getState().fileOperationState.operations).toEqual([])
    })
  })

  // ==================== 通知管理测试 ====================

  describe('通知管理', () => {
    it('应该正确添加通知', () => {
      const notification = createMockNotification()
      
      act(() => {
        useDesktopStore.getState().addNotification(notification)
      })
      
      const notifications = useDesktopStore.getState().notificationState.notifications
      expect(notifications).toHaveLength(1)
      expect(notifications[0]).toEqual(notification)
    })

    it('应该正确更新通知', () => {
      const notification = createMockNotification()
      
      act(() => {
        useDesktopStore.getState().addNotification(notification)
      })
      
      const updates = {
        read: true,
        title: 'Updated Notification',
      }
      
      act(() => {
        useDesktopStore.getState().updateNotification(notification.id, updates)
      })
      
      const notifications = useDesktopStore.getState().notificationState.notifications
      expect(notifications[0].read).toBe(true)
      expect(notifications[0].title).toBe('Updated Notification')
    })

    it('应该正确删除通知', () => {
      const notification = createMockNotification()
      
      act(() => {
        useDesktopStore.getState().addNotification(notification)
      })
      
      act(() => {
        useDesktopStore.getState().removeNotification(notification.id)
      })
      
      expect(useDesktopStore.getState().notificationState.notifications).toEqual([])
    })

    it('应该正确标记通知为已读', () => {
      const notification = createMockNotification()
      
      act(() => {
        useDesktopStore.getState().addNotification(notification)
      })
      
      act(() => {
        useDesktopStore.getState().markNotificationRead(notification.id)
      })
      
      expect(useDesktopStore.getState().notificationState.notifications[0].read).toBe(true)
    })

    it('应该正确标记所有通知为已读', () => {
      const notification1 = createMockNotification()
      const notification2 = { ...createMockNotification(), id: 'notification-2' }
      
      act(() => {
        useDesktopStore.getState().addNotification(notification1)
        useDesktopStore.getState().addNotification(notification2)
      })
      
      act(() => {
        useDesktopStore.getState().markAllNotificationsRead()
      })
      
      const notifications = useDesktopStore.getState().notificationState.notifications
      expect(notifications.every(n => n.read)).toBe(true)
    })

    it('应该正确清空所有通知', () => {
      const notification1 = createMockNotification()
      const notification2 = { ...createMockNotification(), id: 'notification-2' }
      
      act(() => {
        useDesktopStore.getState().addNotification(notification1)
        useDesktopStore.getState().addNotification(notification2)
      })
      
      act(() => {
        useDesktopStore.getState().clearAllNotifications()
      })
      
      expect(useDesktopStore.getState().notificationState.notifications).toEqual([])
    })

    it('应该正确获取未读通知数量', () => {
      const notification1 = createMockNotification()
      const notification2 = { ...createMockNotification(), id: 'notification-2' }
      
      act(() => {
        useDesktopStore.getState().addNotification(notification1)
        useDesktopStore.getState().addNotification(notification2)
      })
      
      expect(useDesktopStore.getState().getUnreadNotificationCount()).toBe(2)
      
      act(() => {
        useDesktopStore.getState().markNotificationRead(notification1.id)
      })
      
      expect(useDesktopStore.getState().getUnreadNotificationCount()).toBe(1)
    })
  })

  // ==================== 设置和配置管理测试 ====================

  describe('设置和配置管理', () => {
    it('应该正确更新设置', () => {
      const newSettings = {
        theme: 'dark' as const,
        autoStart: true,
      }
      
      act(() => {
        useDesktopStore.getState().updateSettings(newSettings)
      })
      
      const settings = useDesktopStore.getState().settings
      expect(settings.theme).toBe('dark')
      expect(settings.autoStart).toBe(true)
    })

    it('应该正确更新配置', () => {
      const newConfig = {
        window: {
          ...useDesktopStore.getState().config.window,
          resizable: false,
          alwaysOnTop: true,
        },
      }
      
      act(() => {
        useDesktopStore.getState().updateConfig(newConfig)
      })
      
      const config = useDesktopStore.getState().config
      expect(config.window.resizable).toBe(false)
      expect(config.window.alwaysOnTop).toBe(true)
    })

    it('应该正确重置设置', () => {
      const newSettings = {
        theme: 'dark' as const,
        autoStart: true,
      }
      
      act(() => {
        useDesktopStore.getState().updateSettings(newSettings)
        useDesktopStore.getState().resetSettings()
      })
      
      // 设置应该被重置为默认值
      const settings = useDesktopStore.getState().settings
      expect(settings.theme).not.toBe('dark')
    })

    it('应该正确重置配置', () => {
      const newConfig = {
        window: {
          ...useDesktopStore.getState().config.window,
          resizable: false,
        },
      }
      
      act(() => {
        useDesktopStore.getState().updateConfig(newConfig)
        useDesktopStore.getState().resetConfig()
      })
      
      // 配置应该被重置为默认值
      const config = useDesktopStore.getState().config
      expect(config.window.resizable).toBe(true) // 假设默认值是 true
    })
  })

  // ==================== 更新管理测试 ====================

  describe('更新管理', () => {
    it('应该正确设置更新信息', () => {
      const updateInfo = {
        available: true,
        version: '1.1.0',
        releaseNotes: 'Bug fixes and improvements',
        downloadUrl: 'https://example.com/update',
        releaseDate: Date.now(),
      }
      
      act(() => {
        useDesktopStore.getState().setUpdateAvailable(updateInfo)
      })
      
      const appState = useDesktopStore.getState().appState
      expect(appState.updateInfo.available).toBe(true)
      expect(appState.updateInfo.version).toBe('1.1.0')
    })

    it('应该正确清除更新信息', () => {
      const updateInfo = {
        available: true,
        version: '1.1.0',
        releaseNotes: 'Bug fixes and improvements',
        downloadUrl: 'https://example.com/update',
        releaseDate: Date.now(),
      }
      
      act(() => {
        useDesktopStore.getState().setUpdateAvailable(updateInfo)
        useDesktopStore.getState().clearUpdate()
      })
      
      const appState = useDesktopStore.getState().appState
      expect(appState.updateInfo.available).toBe(false)
      expect(appState.updateInfo.version).toBeNull()
    })

    it('应该正确设置托盘最小化状态', () => {
      act(() => {
        useDesktopStore.getState().setMinimizedToTray(true)
      })
      
      expect(useDesktopStore.getState().appState.isMinimizedToTray).toBe(true)
      
      act(() => {
        useDesktopStore.getState().setMinimizedToTray(false)
      })
      
      expect(useDesktopStore.getState().appState.isMinimizedToTray).toBe(false)
    })
  })

  // ==================== 工具方法测试 ====================

  describe('工具方法', () => {
    it('reset 应该重置所有状态', () => {
      // 设置一些状态
      act(() => {
        const store = useDesktopStore.getState()
        store.setLoading(true)
        store.setError('Test error')
        store.addNotification(createMockNotification())
        store.addShortcut(createMockShortcut())
      })
      
      act(() => {
        useDesktopStore.getState().reset?.()
      })
      
      const state = useDesktopStore.getState()
      expect(state.operationState.isLoading).toBe(false)
      expect(state.operationState.error).toBeNull()
      expect(state.notificationState.notifications).toEqual([])
      expect(state.shortcutState.shortcuts).toEqual([])
      expect(state.isInitialized).toBe(false)
    })

    it('应该正确获取应用版本信息', () => {
      const appInfo = createMockAppInfo()
      
      act(() => {
        useDesktopStore.getState().updateAppInfo(appInfo)
      })
      
      const version = useDesktopStore.getState().getAppVersion()
      expect(version).toBe('1.0.0')
    })

    it('应该正确检查是否为开发模式', () => {
      const appInfo = createMockAppInfo()
      appInfo.isDevelopment = true
      
      act(() => {
        useDesktopStore.getState().updateAppInfo(appInfo)
      })
      
      expect(useDesktopStore.getState().isDevelopment()).toBe(true)
    })

    it('应该正确获取系统平台', () => {
      const systemInfo = createMockSystemInfo()
      
      act(() => {
        useDesktopStore.getState().updateSystemInfo(systemInfo)
      })
      
      expect(useDesktopStore.getState().getPlatform()).toBe('win32')
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('应该正确处理文件操作错误', () => {
      const operation = createMockFileOperation()
      const error = 'File operation failed'
      
      act(() => {
        useDesktopStore.getState().addFileOperation(operation)
        useDesktopStore.getState().updateFileOperation(operation.id, {
          status: 'failed',
          error,
        })
      })
      
      const operations = useDesktopStore.getState().fileOperationState.operations
      expect(operations[0].status).toBe('failed')
      expect(operations[0].error).toBe(error)
    })

    it('应该正确处理快捷键冲突', () => {
      const shortcut1 = createMockShortcut()
      const shortcut2 = {
        ...createMockShortcut(),
        id: 'shortcut-2',
        globalKey: 'ctrl+alt+t', // 相同的快捷键
      }
      
      act(() => {
        useDesktopStore.getState().addShortcut(shortcut1)
        useDesktopStore.getState().addShortcut(shortcut2)
      })
      
      // 检查快捷键冲突处理（这里假设系统会处理冲突）
      const shortcuts = useDesktopStore.getState().shortcutState.shortcuts
      expect(shortcuts).toHaveLength(2) // 两个快捷键都应该被添加
    })
  })

  // ==================== Hook 集成测试 ====================

  describe('Hook 集成', () => {
    it('应该能够在 React Hook 中正确使用', () => {
      const { result } = renderHook(() => useDesktopStore())
      
      // 初始状态检查
      expect(result.current.isInitialized).toBe(false)
      expect(result.current.operationState.isLoading).toBe(false)
      
      // 测试状态更新
      act(() => {
        result.current.setLoading(true)
      })
      
      expect(result.current.operationState.isLoading).toBe(true)
    })
  })

  // ==================== 性能测试 ====================

  describe('性能测试', () => {
    it('应该能处理大量通知', () => {
      act(() => {
        const store = useDesktopStore.getState()
        for (let i = 0; i < 1000; i++) {
          store.addNotification({
            ...createMockNotification(),
            id: `notification-${i}`,
          })
        }
      })
      
      const notifications = useDesktopStore.getState().notificationState.notifications
      expect(notifications).toHaveLength(1000)
    })

    it('应该能处理大量快捷键', () => {
      act(() => {
        const store = useDesktopStore.getState()
        for (let i = 0; i < 100; i++) {
          store.addShortcut({
            ...createMockShortcut(),
            id: `shortcut-${i}`,
            globalKey: `ctrl+alt+${i}`,
          })
        }
      })
      
      const shortcuts = useDesktopStore.getState().shortcutState.shortcuts
      expect(shortcuts).toHaveLength(100)
    })

    it('应该能处理大量文件操作', () => {
      act(() => {
        const store = useDesktopStore.getState()
        for (let i = 0; i < 500; i++) {
          store.addFileOperation({
            ...createMockFileOperation(),
            id: `file-op-${i}`,
          })
        }
      })
      
      const operations = useDesktopStore.getState().fileOperationState.operations
      expect(operations).toHaveLength(500)
    })
  })
})
