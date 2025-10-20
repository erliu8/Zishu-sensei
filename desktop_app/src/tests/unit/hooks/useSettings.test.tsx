/**
 * useSettings Hooks 测试套件
 * 
 * 测试设置管理相关的所有 Hooks，包括基础设置、高级设置、导入导出等
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useSettings,
  useAdvancedSettings,
  useSettingsImportExport,
  useSettingsValidation,
  useSettingsSync,
  useHotkeysSettings,
  useUISettings,
  useSystemSettings,
  usePrivacySettings,
  useBackupSettings
} from '@/hooks/useSettings'
import { waitForNextTick, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock SettingsService
const mockSettingsService = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
  getAdvancedSettings: vi.fn(),
  updateAdvancedSettings: vi.fn(),
  validateSettings: vi.fn(),
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
  syncSettings: vi.fn(),
  getSettingsBackups: vi.fn(),
  createSettingsBackup: vi.fn(),
  restoreSettingsBackup: vi.fn(),
}

// Mock Tauri API
const mockTauri = {
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
}

vi.mock('@/services/settingsService', () => ({
  default: mockSettingsService,
}))

vi.mock('@tauri-apps/api', () => mockTauri)

// ==================== 测试数据 ====================

const mockBaseSettings = {
  language: 'zh-CN' as const,
  theme: 'auto' as const,
  auto_start: false,
  minimize_to_tray: true,
  enable_notifications: true,
  check_updates: true,
  analytics_enabled: false,
  crash_reporting: false,
  font_family: 'system',
  font_size: 14,
  ui_scale: 1.0,
  character: {
    model_path: '/models/default.vrm',
    voice_enabled: true,
    animation_speed: 1.0,
    expression_intensity: 0.8,
  },
  desktop: {
    always_on_top: false,
    click_through: false,
    position: { x: 100, y: 100 },
    size: { width: 300, height: 400 },
  },
}

const mockAdvancedSettings = {
  performance: {
    hardware_acceleration: true,
    memory_limit_mb: 1024,
    cache_size_mb: 256,
    max_concurrent_requests: 10,
    request_timeout_ms: 30000,
  },
  debug: {
    enable_debug_mode: false,
    log_level: 'info' as const,
    save_debug_logs: false,
    max_log_files: 10,
    verbose_logging: false,
  },
  security: {
    encryption_enabled: true,
    auto_lock_minutes: 30,
    require_password: false,
    secure_memory: true,
    clear_clipboard: true,
  },
  network: {
    proxy_enabled: false,
    proxy_type: 'http' as const,
    proxy_host: '',
    proxy_port: 8080,
    timeout_seconds: 30,
    retry_attempts: 3,
  },
}

const mockHotkeysSettings = {
  global: {
    toggle_visibility: 'Ctrl+Shift+Z',
    quick_chat: 'Ctrl+Shift+C',
    screenshot: 'F12',
  },
  local: {
    send_message: 'Enter',
    new_chat: 'Ctrl+N',
    clear_chat: 'Ctrl+L',
    settings: 'Ctrl+,',
  },
}

const mockPrivacySettings = {
  data_collection: {
    usage_analytics: false,
    error_reporting: false,
    performance_metrics: false,
  },
  storage: {
    local_storage_only: true,
    auto_clear_history: false,
    history_retention_days: 30,
  },
  sharing: {
    allow_screenshots: false,
    allow_model_sharing: false,
    telemetry_enabled: false,
  },
}

const mockSettingsBackup = {
  id: 'backup-123',
  name: 'Auto Backup',
  created_at: '2025-01-01T12:00:00Z',
  size_bytes: 2048,
  settings_version: '1.0.0',
  checksum: 'abc123def456',
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
    
    mockSettingsService.getSettings.mockResolvedValue(mockBaseSettings)
    mockSettingsService.updateSettings.mockResolvedValue(undefined)
    mockSettingsService.resetSettings.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础设置管理', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useSettings())

      expect(result.current.settings).toBe(null)
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBe(null)
      expect(typeof result.current.updateSettings).toBe('function')
      expect(typeof result.current.resetSettings).toBe('function')
    })

    it('应该获取初始设置', async () => {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toEqual(mockBaseSettings)
        expect(result.current.loading).toBe(false)
      })

      expect(mockSettingsService.getSettings).toHaveBeenCalled()
    })

    it('应该更新设置', async () => {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toEqual(mockBaseSettings)
      })

      const updates = { language: 'en-US' as const, theme: 'dark' as const }

      await act(async () => {
        await result.current.updateSettings(updates)
      })

      expect(mockSettingsService.updateSettings).toHaveBeenCalledWith(updates)
      expect(result.current.settings).toEqual({
        ...mockBaseSettings,
        ...updates,
      })
    })

    it('应该处理部分设置更新', async () => {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      const characterUpdates = {
        character: {
          ...mockBaseSettings.character,
          voice_enabled: false,
        },
      }

      await act(async () => {
        await result.current.updateSettings(characterUpdates)
      })

      expect(result.current.settings?.character.voice_enabled).toBe(false)
    })

    it('应该重置设置', async () => {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      // 先更新一些设置
      await act(async () => {
        await result.current.updateSettings({ language: 'en-US' })
      })

      // 然后重置
      await act(async () => {
        await result.current.resetSettings()
      })

      expect(mockSettingsService.resetSettings).toHaveBeenCalled()
      expect(mockSettingsService.getSettings).toHaveBeenCalledTimes(2) // 初始 + 重置后重新获取
    })

    it('应该处理更新错误', async () => {
      const testError = new Error('Update failed')
      mockSettingsService.updateSettings.mockRejectedValue(testError)

      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      await expect(
        act(async () => {
          await result.current.updateSettings({ theme: 'dark' })
        })
      ).rejects.toThrow('Update failed')

      expect(result.current.error).toBe('更新设置失败')
    })

    it('应该处理获取设置错误', async () => {
      const testError = new Error('Load failed')
      mockSettingsService.getSettings.mockRejectedValue(testError)

      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.error).toBe('加载设置失败')
        expect(result.current.loading).toBe(false)
      })
    })
  })
})

describe('useAdvancedSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsService.getAdvancedSettings.mockResolvedValue(mockAdvancedSettings)
    mockSettingsService.updateAdvancedSettings.mockResolvedValue(undefined)
  })

  describe('高级设置', () => {
    it('应该获取高级设置', async () => {
      const { result } = renderHook(() => useAdvancedSettings())

      await waitFor(() => {
        expect(result.current.settings).toEqual(mockAdvancedSettings)
        expect(result.current.loading).toBe(false)
      })

      expect(mockSettingsService.getAdvancedSettings).toHaveBeenCalled()
    })

    it('应该更新高级设置', async () => {
      const { result } = renderHook(() => useAdvancedSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      const updates = {
        performance: {
          ...mockAdvancedSettings.performance,
          hardware_acceleration: false,
          memory_limit_mb: 2048,
        },
      }

      await act(async () => {
        await result.current.updateAdvancedSettings(updates)
      })

      expect(mockSettingsService.updateAdvancedSettings).toHaveBeenCalledWith(updates)
    })

    it('应该支持单个分类更新', async () => {
      const { result } = renderHook(() => useAdvancedSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      const debugUpdates = {
        enable_debug_mode: true,
        log_level: 'debug' as const,
      }

      await act(async () => {
        await result.current.updateCategory('debug', debugUpdates)
      })

      expect(mockSettingsService.updateAdvancedSettings).toHaveBeenCalledWith({
        debug: {
          ...mockAdvancedSettings.debug,
          ...debugUpdates,
        },
      })
    })

    it('应该验证高级设置', async () => {
      mockSettingsService.validateSettings.mockResolvedValue({
        valid: false,
        errors: [
          { field: 'performance.memory_limit_mb', message: '内存限制必须大于 256MB' },
        ],
      })

      const { result } = renderHook(() => useAdvancedSettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      let validationResult: any
      await act(async () => {
        validationResult = await result.current.validateSettings({
          performance: { memory_limit_mb: 128 },
        })
      })

      expect(validationResult.valid).toBe(false)
      expect(validationResult.errors).toHaveLength(1)
    })
  })
})

describe('useSettingsImportExport Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsService.exportSettings.mockResolvedValue('{"version":"1.0","settings":{}}')
    mockSettingsService.importSettings.mockResolvedValue(undefined)
  })

  describe('设置导入导出', () => {
    it('应该导出设置', async () => {
      const { result } = renderHook(() => useSettingsImportExport())

      let exportData: string
      await act(async () => {
        exportData = await result.current.exportSettings()
      })

      expect(mockSettingsService.exportSettings).toHaveBeenCalled()
      expect(exportData!).toBe('{"version":"1.0","settings":{}}')
    })

    it('应该导入设置', async () => {
      const { result } = renderHook(() => useSettingsImportExport())

      const importData = '{"version":"1.0","settings":{"language":"en-US"}}'

      await act(async () => {
        await result.current.importSettings(importData)
      })

      expect(mockSettingsService.importSettings).toHaveBeenCalledWith(importData)
    })

    it('应该处理导入错误', async () => {
      const testError = new Error('Invalid format')
      mockSettingsService.importSettings.mockRejectedValue(testError)

      const { result } = renderHook(() => useSettingsImportExport())

      await expect(
        act(async () => {
          await result.current.importSettings('invalid json')
        })
      ).rejects.toThrow('Invalid format')

      expect(result.current.error).toBe('导入设置失败')
    })

    it('应该管理导入导出状态', async () => {
      let resolveExport: (value: any) => void
      const exportPromise = new Promise(resolve => {
        resolveExport = resolve
      })

      mockSettingsService.exportSettings.mockReturnValue(exportPromise)

      const { result } = renderHook(() => useSettingsImportExport())

      act(() => {
        result.current.exportSettings()
      })

      expect(result.current.exporting).toBe(true)

      await act(async () => {
        resolveExport!('exported data')
      })

      expect(result.current.exporting).toBe(false)
    })
  })
})

describe('useHotkeysSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTauri.invoke.mockResolvedValue(mockHotkeysSettings)
  })

  describe('快捷键设置', () => {
    it('应该获取快捷键设置', async () => {
      const { result } = renderHook(() => useHotkeysSettings())

      await waitFor(() => {
        expect(result.current.hotkeys).toEqual(mockHotkeysSettings)
        expect(result.current.loading).toBe(false)
      })

      expect(mockTauri.invoke).toHaveBeenCalledWith('get_hotkeys_settings')
    })

    it('应该更新快捷键', async () => {
      const { result } = renderHook(() => useHotkeysSettings())

      await waitFor(() => {
        expect(result.current.hotkeys).toBeTruthy()
      })

      await act(async () => {
        await result.current.updateHotkey('global', 'toggle_visibility', 'Ctrl+Alt+Z')
      })

      expect(mockTauri.invoke).toHaveBeenCalledWith('update_hotkey', {
        category: 'global',
        key: 'toggle_visibility',
        shortcut: 'Ctrl+Alt+Z',
      })
    })

    it('应该重置快捷键', async () => {
      const { result } = renderHook(() => useHotkeysSettings())

      await act(async () => {
        await result.current.resetHotkeys()
      })

      expect(mockTauri.invoke).toHaveBeenCalledWith('reset_hotkeys')
    })

    it('应该检测快捷键冲突', async () => {
      mockTauri.invoke.mockResolvedValue({
        conflict: true,
        existing_key: 'quick_chat',
        existing_shortcut: 'Ctrl+Shift+Z',
      })

      const { result } = renderHook(() => useHotkeysSettings())

      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict('Ctrl+Shift+Z')
      })

      expect(conflictResult.conflict).toBe(true)
      expect(mockTauri.invoke).toHaveBeenCalledWith('check_hotkey_conflict', {
        shortcut: 'Ctrl+Shift+Z',
      })
    })
  })
})

describe('usePrivacySettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTauri.invoke.mockResolvedValue(mockPrivacySettings)
  })

  describe('隐私设置', () => {
    it('应该获取隐私设置', async () => {
      const { result } = renderHook(() => usePrivacySettings())

      await waitFor(() => {
        expect(result.current.settings).toEqual(mockPrivacySettings)
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该更新隐私设置', async () => {
      const { result } = renderHook(() => usePrivacySettings())

      await waitFor(() => {
        expect(result.current.settings).toBeTruthy()
      })

      const updates = {
        data_collection: {
          ...mockPrivacySettings.data_collection,
          usage_analytics: true,
        },
      }

      await act(async () => {
        await result.current.updatePrivacySettings(updates)
      })

      expect(mockTauri.invoke).toHaveBeenCalledWith('update_privacy_settings', updates)
    })
  })
})

describe('useBackupSettings Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsService.getSettingsBackups.mockResolvedValue([mockSettingsBackup])
    mockSettingsService.createSettingsBackup.mockResolvedValue(mockSettingsBackup)
    mockSettingsService.restoreSettingsBackup.mockResolvedValue(undefined)
  })

  describe('设置备份', () => {
    it('应该获取备份列表', async () => {
      const { result } = renderHook(() => useBackupSettings())

      await waitFor(() => {
        expect(result.current.backups).toEqual([mockSettingsBackup])
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该创建备份', async () => {
      const { result } = renderHook(() => useBackupSettings())

      let backup: any
      await act(async () => {
        backup = await result.current.createBackup('Manual Backup')
      })

      expect(mockSettingsService.createSettingsBackup).toHaveBeenCalledWith('Manual Backup')
      expect(backup).toEqual(mockSettingsBackup)
    })

    it('应该恢复备份', async () => {
      const { result } = renderHook(() => useBackupSettings())

      await act(async () => {
        await result.current.restoreBackup('backup-123')
      })

      expect(mockSettingsService.restoreSettingsBackup).toHaveBeenCalledWith('backup-123')
    })
  })
})

// ==================== 集成测试 ====================

describe('Settings Hooks 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSettingsService.getSettings.mockResolvedValue(mockBaseSettings)
    mockSettingsService.updateSettings.mockResolvedValue(undefined)
    mockSettingsService.exportSettings.mockResolvedValue('exported_data')
    mockSettingsService.createSettingsBackup.mockResolvedValue(mockSettingsBackup)
  })

  it('应该完成设置管理完整流程', async () => {
    const settingsHook = renderHook(() => useSettings())
    const exportHook = renderHook(() => useSettingsImportExport())
    const backupHook = renderHook(() => useBackupSettings())

    // 1. 加载设置
    await waitFor(() => {
      expect(settingsHook.result.current.settings).toEqual(mockBaseSettings)
    })

    // 2. 更新设置
    await act(async () => {
      await settingsHook.result.current.updateSettings({ language: 'en-US' })
    })

    // 3. 导出设置
    let exportData: string
    await act(async () => {
      exportData = await exportHook.result.current.exportSettings()
    })

    expect(exportData!).toBe('exported_data')

    // 4. 创建备份
    let backup: any
    await act(async () => {
      backup = await backupHook.result.current.createBackup('Integration Test')
    })

    expect(backup).toEqual(mockSettingsBackup)
  })

  it('应该处理设置同步', async () => {
    const { result } = renderHook(() => useSettingsSync())

    mockSettingsService.syncSettings.mockResolvedValue({
      success: true,
      conflicts: [],
      merged_settings: mockBaseSettings,
    })

    let syncResult: any
    await act(async () => {
      syncResult = await result.current.syncWithCloud()
    })

    expect(syncResult.success).toBe(true)
    expect(mockSettingsService.syncSettings).toHaveBeenCalled()
  })
})

