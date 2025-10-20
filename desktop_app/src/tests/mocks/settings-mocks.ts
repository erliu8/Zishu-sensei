/**
 * Settings 组件专用 Mock 数据
 * 
 * 提供 Settings 组件群专用的 Mock 数据和模拟服务
 * @module Tests/Mocks/Settings
 */

import { vi } from 'vitest'
import { 
  createMockSettings,
  createMockApiResponse,
  createMockErrorResponse,
  randomString,
  randomNumber,
  randomBoolean
} from './factories'
import type { 
  AppSettings, 
  AppConfig, 
  ThemeMode,
  WindowState 
} from '@/types/app'
import type {
  WindowConfig,
  CharacterConfig,
  ThemeConfig,
  SystemConfig,
  ThemeName,
  CharacterId,
  ScaleValue,
  WindowPosition,
  ConfigValidationResult,
  ConfigChangeEvent,
  ConfigHistoryEntry,
  DEFAULT_CONFIG
} from '@/types/settings'

// ==================== Settings Mock Factories ====================

/**
 * 创建 Mock AppSettings
 */
export function createMockAppSettings(overrides?: Partial<AppSettings>): AppSettings {
  const defaults: AppSettings = {
    theme: 'system' as ThemeMode,
    language: 'zh-CN',
    autoStart: false,
    windowState: {
      mode: 'chat',
      position: { x: 100, y: 100 },
      size: { width: 800, height: 600 },
      isVisible: true,
      isAlwaysOnTop: false,
      isResizable: true,
      title: 'Zishu Sensei'
    },
    notifications: {
      enabled: true,
      sound: true,
      desktop: true
    },
    ai: {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000
    },
    character: {
      model: 'shizuku',
      voice: 'default',
      personality: 'friendly'
    }
  }
  
  return { ...defaults, ...overrides }
}

/**
 * 创建 Mock AppConfig
 */
export function createMockAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  const defaults: AppConfig = {
    window: {
      width: 400,
      height: 600,
      always_on_top: true,
      transparent: true,
      decorations: false,
      resizable: true,
      position: [100, 100] as WindowPosition
    },
    character: {
      current_character: 'shizuku' as CharacterId,
      scale: 1.0 as ScaleValue,
      auto_idle: true,
      interaction_enabled: true
    },
    theme: {
      current_theme: 'anime' as ThemeName,
      custom_css: null
    },
    system: {
      auto_start: false,
      minimize_to_tray: true,
      close_to_tray: true,
      show_notifications: true
    }
  }
  
  return { ...defaults, ...overrides }
}

/**
 * 创建 Mock WindowConfig
 */
export function createMockWindowConfig(overrides?: Partial<WindowConfig>): WindowConfig {
  return {
    width: randomNumber(400, 1200),
    height: randomNumber(300, 800),
    always_on_top: randomBoolean(),
    transparent: randomBoolean(),
    decorations: randomBoolean(),
    resizable: true,
    position: [randomNumber(0, 500), randomNumber(0, 300)] as WindowPosition,
    ...overrides
  }
}

/**
 * 创建 Mock CharacterConfig
 */
export function createMockCharacterConfig(overrides?: Partial<CharacterConfig>): CharacterConfig {
  const characters: CharacterId[] = ['shizuku', 'hiyori', 'miku', 'rin'] as CharacterId[]
  return {
    current_character: characters[randomNumber(0, characters.length - 1)],
    scale: (Math.round((Math.random() * 3 + 0.5) * 10) / 10) as ScaleValue, // 0.5-3.5
    auto_idle: randomBoolean(),
    interaction_enabled: randomBoolean(),
    ...overrides
  }
}

/**
 * 创建 Mock ThemeConfig
 */
export function createMockThemeConfig(overrides?: Partial<ThemeConfig>): ThemeConfig {
  const themes: ThemeName[] = ['anime', 'modern', 'classic', 'dark', 'light', 'custom']
  return {
    current_theme: themes[randomNumber(0, themes.length - 1)],
    custom_css: randomBoolean() ? `/* Custom CSS */\n.app { color: #${randomString(6, 'hex')}; }` : null,
    ...overrides
  }
}

/**
 * 创建 Mock SystemConfig
 */
export function createMockSystemConfig(overrides?: Partial<SystemConfig>): SystemConfig {
  return {
    auto_start: randomBoolean(),
    minimize_to_tray: randomBoolean(),
    close_to_tray: randomBoolean(),
    show_notifications: randomBoolean(),
    ...overrides
  }
}

/**
 * 创建 Mock VoiceSettings
 */
export interface MockVoiceSettings {
  tts: {
    engine: string
    voice: string
    speed: number
    volume: number
    enabled: boolean
  }
  stt: {
    engine: string
    language: string
    sensitivity: number
    enabled: boolean
  }
}

export function createMockVoiceSettings(overrides?: Partial<MockVoiceSettings>): MockVoiceSettings {
  return {
    tts: {
      engine: 'system',
      voice: 'default',
      speed: randomNumber(0.5, 2.0),
      volume: randomNumber(0.0, 1.0),
      enabled: true
    },
    stt: {
      engine: 'whisper',
      language: 'zh-CN',
      sensitivity: randomNumber(0.1, 1.0),
      enabled: true
    },
    ...overrides
  }
}

/**
 * 创建 Mock AdapterSettings  
 */
export interface MockAdapterSettings {
  adapters: Array<{
    id: string
    name: string
    enabled: boolean
    config: Record<string, any>
    status: 'running' | 'stopped' | 'error'
  }>
}

export function createMockAdapterSettings(count = 3): MockAdapterSettings {
  return {
    adapters: Array.from({ length: count }, (_, i) => ({
      id: `adapter_${i + 1}`,
      name: `Test Adapter ${i + 1}`,
      enabled: randomBoolean(),
      config: {
        apiKey: randomString(20),
        endpoint: `https://api.adapter${i + 1}.com`,
        timeout: randomNumber(5000, 30000)
      },
      status: (['running', 'stopped', 'error'] as const)[randomNumber(0, 2)]
    }))
  }
}

/**
 * 创建 Mock ConfigValidationResult
 */
export function createMockValidationResult(
  isValid = true, 
  overrides?: Partial<ConfigValidationResult>
): ConfigValidationResult {
  const defaults: ConfigValidationResult = {
    valid: isValid,
    errors: isValid ? [] : [
      {
        path: 'window.width',
        message: 'Width must be between 200 and 4000',
        value: 150,
        code: 'INVALID_RANGE'
      }
    ],
    warnings: isValid ? [] : ['Custom CSS may affect performance']
  }
  
  return { ...defaults, ...overrides }
}

/**
 * 创建 Mock ConfigChangeEvent
 */
export function createMockConfigChangeEvent(overrides?: Partial<ConfigChangeEvent>): ConfigChangeEvent {
  return {
    type: 'window',
    before: { width: 400, height: 600 },
    after: { width: 800, height: 800 },
    timestamp: Date.now(),
    ...overrides
  }
}

/**
 * 创建 Mock ConfigHistoryEntry
 */
export function createMockHistoryEntry(overrides?: Partial<ConfigHistoryEntry>): ConfigHistoryEntry {
  return {
    id: randomString(10),
    snapshot: createMockAppConfig(),
    description: `Configuration updated at ${new Date().toLocaleTimeString()}`,
    timestamp: Date.now(),
    ...overrides
  }
}

// ==================== Mock Services ====================

/**
 * Mock useSettings Hook
 */
export function createMockUseSettings() {
  return {
    settings: createMockAppSettings(),
    config: createMockAppConfig(),
    isLoading: false,
    isInitialized: true,
    syncStatus: 'synced' as const,
    error: null,
    needsSync: false,
    
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
    updateTheme: vi.fn(),
    updateLanguage: vi.fn(),
    toggleAutoStart: vi.fn(),
    updateNotifications: vi.fn(),
    updateAISettings: vi.fn(),
    
    updateConfig: vi.fn(),
    updatePartialConfig: vi.fn(),
    resetConfig: vi.fn(),
    
    exportSettings: vi.fn(),
    exportSettingsToFile: vi.fn(),
    importSettings: vi.fn(),
    importSettingsFromFile: vi.fn(),
    
    syncToBackend: vi.fn(),
    syncFromBackend: vi.fn(),
    forceSync: vi.fn(),
    refreshConfig: vi.fn(),
    
    clearError: vi.fn(),
    resetAll: vi.fn(),
    addEventListener: vi.fn(() => vi.fn()) // 返回取消订阅函数
  }
}

/**
 * Mock useTauri Hook for Settings
 */
export function createMockUseTauri() {
  return {
    isAvailable: true,
    invoke: vi.fn(),
    listen: vi.fn(),
    emit: vi.fn(),
    commands: {
      // 窗口相关命令
      get_window_config: vi.fn(() => Promise.resolve(createMockWindowConfig())),
      update_window_config: vi.fn(() => Promise.resolve()),
      reset_window_config: vi.fn(() => Promise.resolve()),
      
      // 角色相关命令
      get_character_config: vi.fn(() => Promise.resolve(createMockCharacterConfig())),
      update_character_config: vi.fn(() => Promise.resolve()),
      
      // 主题相关命令
      get_theme_config: vi.fn(() => Promise.resolve(createMockThemeConfig())),
      update_theme_config: vi.fn(() => Promise.resolve()),
      
      // 系统相关命令
      get_system_config: vi.fn(() => Promise.resolve(createMockSystemConfig())),
      update_system_config: vi.fn(() => Promise.resolve()),
      
      // 配置管理命令
      get_full_config: vi.fn(() => Promise.resolve(createMockAppConfig())),
      save_config: vi.fn(() => Promise.resolve()),
      reset_config: vi.fn(() => Promise.resolve()),
      export_config: vi.fn(() => Promise.resolve('/path/to/config.json')),
      import_config: vi.fn(() => Promise.resolve()),
      validate_config: vi.fn(() => Promise.resolve(createMockValidationResult())),
      
      // 语音相关命令（模拟）
      get_voice_settings: vi.fn(() => Promise.resolve(createMockVoiceSettings())),
      update_voice_settings: vi.fn(() => Promise.resolve()),
      test_tts: vi.fn(() => Promise.resolve()),
      test_stt: vi.fn(() => Promise.resolve('Test speech recognition result')),
      
      // 适配器相关命令（模拟）
      get_adapter_settings: vi.fn(() => Promise.resolve(createMockAdapterSettings())),
      update_adapter_settings: vi.fn(() => Promise.resolve()),
      install_adapter: vi.fn(() => Promise.resolve()),
      uninstall_adapter: vi.fn(() => Promise.resolve()),
      enable_adapter: vi.fn(() => Promise.resolve()),
      disable_adapter: vi.fn(() => Promise.resolve()),
    }
  }
}

/**
 * Mock React Hot Toast
 */
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
  promise: vi.fn()
}

/**
 * Mock Framer Motion
 */
export const mockMotion = {
  div: vi.fn(({ children, ...props }) => children),
  span: vi.fn(({ children, ...props }) => children),
  button: vi.fn(({ children, ...props }) => children),
  AnimatePresence: vi.fn(({ children }) => children)
}

// ==================== Test Data Presets ====================

/**
 * 完整的设置测试数据预设
 */
export const SETTINGS_TEST_PRESETS = {
  default: {
    settings: createMockAppSettings(),
    config: createMockAppConfig(),
    voiceSettings: createMockVoiceSettings(),
    adapterSettings: createMockAdapterSettings()
  },
  
  minimalist: {
    settings: createMockAppSettings({
      theme: 'light',
      notifications: { enabled: false, sound: false, desktop: false }
    }),
    config: createMockAppConfig({
      window: { width: 300, height: 400, decorations: true },
      character: { scale: 0.8 as ScaleValue, auto_idle: false }
    })
  },
  
  powerUser: {
    settings: createMockAppSettings({
      theme: 'dark',
      autoStart: true,
      ai: { model: 'gpt-4', temperature: 0.9, maxTokens: 4000 }
    }),
    config: createMockAppConfig({
      window: { width: 1200, height: 800, always_on_top: false },
      character: { scale: 2.0 as ScaleValue, interaction_enabled: true },
      theme: { current_theme: 'custom', custom_css: '/* Advanced CSS */' }
    })
  }
} as const

/**
 * 错误状态测试数据
 */
export const SETTINGS_ERROR_PRESETS = {
  validation: createMockValidationResult(false, {
    errors: [
      { path: 'window.width', message: 'Width too small', value: 100 },
      { path: 'character.scale', message: 'Scale out of range', value: 10 }
    ]
  }),
  
  networkError: createMockErrorResponse('Failed to save settings', 'NETWORK_ERROR'),
  
  permissionError: createMockErrorResponse('Permission denied', 'PERMISSION_DENIED'),
  
  configCorrupted: createMockErrorResponse('Config file corrupted', 'INVALID_CONFIG')
} as const
