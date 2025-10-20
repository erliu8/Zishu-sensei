/**
 * Mock 数据工厂
 * 
 * 提供创建测试数据的工厂函数
 */

import { randomString, randomNumber, randomBoolean, randomDate } from '../utils/test-utils'

// ==================== 适配器数据工厂 ====================

export interface MockAdapterInfo {
  name: string
  path: string
  size: number
  version: string
  description: string
  status: 'loaded' | 'unloaded' | 'error'
  load_time: string
  memory_usage: number
  config: Record<string, any>
}

export function createMockAdapter(overrides?: Partial<MockAdapterInfo>): MockAdapterInfo {
  const defaults: MockAdapterInfo = {
    name: `adapter-${randomString()}`,
    path: `/path/to/adapter/${randomString()}`,
    size: randomNumber(100000, 10000000),
    version: `${randomNumber(1, 3)}.${randomNumber(0, 9)}.${randomNumber(0, 9)}`,
    description: `Test adapter ${randomString(5)}`,
    status: randomBoolean() ? 'loaded' : 'unloaded',
    load_time: new Date().toISOString(),
    memory_usage: randomNumber(0, 1000000),
    config: {
      enabled: randomBoolean(),
      timeout: randomNumber(10000, 60000),
    },
  }
  
  return { ...defaults, ...overrides }
}

export function createMockAdapterList(count = 5): MockAdapterInfo[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAdapter({ name: `test-adapter-${i + 1}` })
  )
}

export interface MockAdapterMetadata {
  id: string
  name: string
  version: string
  adapter_type: 'soft' | 'hard' | 'intelligent'
  description: string
  author: string
  license: string
  tags: string[]
  created_at: string
  updated_at: string
  capabilities: Array<{
    name: string
    description: string
    level: 'basic' | 'intermediate' | 'advanced'
    required_params: string[]
    optional_params: string[]
  }>
  compatibility: {
    base_models: string[]
    frameworks: Record<string, string>
    operating_systems: string[]
    python_versions: string[]
  }
  resource_requirements: {
    min_memory_mb: number
    min_cpu_cores: number
    gpu_required: boolean
    dependencies: string[]
  }
  config_schema: Record<string, any>
  default_config: Record<string, any>
  file_size_bytes: number
  parameter_count: number
}

export function createMockAdapterMetadata(
  overrides?: Partial<MockAdapterMetadata>
): MockAdapterMetadata {
  const id = randomString()
  const defaults: MockAdapterMetadata = {
    id,
    name: `Test Adapter ${id}`,
    version: '1.0.0',
    adapter_type: 'soft',
    description: 'Test adapter description',
    author: 'Test Author',
    license: 'MIT',
    tags: ['test', 'demo'],
    created_at: randomDate().toISOString(),
    updated_at: randomDate().toISOString(),
    capabilities: [
      {
        name: 'text_processing',
        description: 'Process text content',
        level: 'basic',
        required_params: ['text'],
        optional_params: ['format'],
      },
    ],
    compatibility: {
      base_models: ['gpt-3.5-turbo', 'gpt-4'],
      frameworks: { transformers: '4.0+' },
      operating_systems: ['linux', 'windows', 'macos'],
      python_versions: ['3.8+'],
    },
    resource_requirements: {
      min_memory_mb: 512,
      min_cpu_cores: 2,
      gpu_required: false,
      dependencies: ['torch', 'transformers'],
    },
    config_schema: {
      timeout: {
        type: 'number',
        default: 30000,
        description: 'Timeout in milliseconds',
      },
    },
    default_config: {
      timeout: 30000,
      enabled: true,
    },
    file_size_bytes: randomNumber(100000, 10000000),
    parameter_count: randomNumber(100000, 10000000),
  }
  
  return { ...defaults, ...overrides }
}

// ==================== 聊天数据工厂 ====================

export interface MockMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: Record<string, any>
}

export function createMockMessage(overrides?: Partial<MockMessage>): MockMessage {
  const defaults: MockMessage = {
    id: randomString(),
    role: randomBoolean() ? 'user' : 'assistant',
    content: `Test message ${randomString(10)}`,
    timestamp: Date.now(),
    metadata: {},
  }
  
  return { ...defaults, ...overrides }
}

export function createMockConversation(messageCount = 10): MockMessage[] {
  return Array.from({ length: messageCount }, (_, i) =>
    createMockMessage({
      role: i % 2 === 0 ? 'user' : 'assistant',
      timestamp: Date.now() - (messageCount - i) * 60000,
    })
  )
}

// ==================== 角色数据工厂 ====================

export interface MockCharacter {
  id: string
  name: string
  model_path: string
  texture_path?: string
  description: string
  personality: string
  voice?: string
  animations: string[]
  expressions: string[]
  default_expression: string
  scale: number
  position: { x: number; y: number }
}

export function createMockCharacter(overrides?: Partial<MockCharacter>): MockCharacter {
  const defaults: MockCharacter = {
    id: randomString(),
    name: `Character ${randomString(5)}`,
    model_path: `/models/${randomString()}.model3.json`,
    texture_path: `/models/${randomString()}.png`,
    description: 'Test character description',
    personality: 'friendly',
    voice: 'default',
    animations: ['idle', 'talk', 'happy', 'sad'],
    expressions: ['neutral', 'happy', 'sad', 'angry', 'surprised'],
    default_expression: 'neutral',
    scale: 1.0,
    position: { x: 0, y: 0 },
  }
  
  return { ...defaults, ...overrides }
}

// ==================== 设置数据工厂 ====================

export interface MockSettings {
  general: {
    language: string
    theme: string
    startup_on_boot: boolean
    minimize_to_tray: boolean
  }
  character: {
    model: string
    scale: number
    position: { x: number; y: number }
    always_on_top: boolean
    transparent_background: boolean
  }
  chat: {
    adapter: string
    max_history: number
    auto_save: boolean
    send_on_enter: boolean
  }
  hotkeys: {
    show_hide: string
    send_message: string
    clear_chat: string
  }
}

export function createMockSettings(overrides?: Partial<MockSettings>): MockSettings {
  const defaults: MockSettings = {
    general: {
      language: 'zh-CN',
      theme: 'auto',
      startup_on_boot: false,
      minimize_to_tray: true,
    },
    character: {
      model: 'default',
      scale: 1.0,
      position: { x: 100, y: 100 },
      always_on_top: false,
      transparent_background: true,
    },
    chat: {
      adapter: 'default',
      max_history: 100,
      auto_save: true,
      send_on_enter: true,
    },
    hotkeys: {
      show_hide: 'Ctrl+Shift+Z',
      send_message: 'Enter',
      clear_chat: 'Ctrl+L',
    },
  }
  
  // Deep merge
  return {
    general: { ...defaults.general, ...overrides?.general },
    character: { ...defaults.character, ...overrides?.character },
    chat: { ...defaults.chat, ...overrides?.chat },
    hotkeys: { ...defaults.hotkeys, ...overrides?.hotkeys },
  }
}

// ==================== 系统信息数据工厂 ====================

export interface MockSystemInfo {
  os_name: string
  os_version: string
  arch: string
  hostname: string
  username: string
  boot_time: string
  uptime_seconds: number
  cpu: {
    model: string
    cores: number
    threads: number
    frequency_mhz: number
  }
  memory: {
    total_mb: number
    available_mb: number
    used_mb: number
  }
  disks: Array<{
    name: string
    mount_point: string
    total_mb: number
    used_mb: number
    available_mb: number
    file_system: string
  }>
  network_interfaces: Array<{
    name: string
    mac_address: string
    ip_addresses: string[]
    is_up: boolean
  }>
}

export function createMockSystemInfo(overrides?: Partial<MockSystemInfo>): MockSystemInfo {
  const defaults: MockSystemInfo = {
    os_name: 'Linux',
    os_version: '6.8.0-85-generic',
    arch: 'x86_64',
    hostname: 'test-host',
    username: 'testuser',
    boot_time: randomDate().toISOString(),
    uptime_seconds: randomNumber(0, 86400 * 7),
    cpu: {
      model: 'Intel Core i7-10700K',
      cores: 8,
      threads: 16,
      frequency_mhz: 3800,
    },
    memory: {
      total_mb: 16384,
      available_mb: 8192,
      used_mb: 8192,
    },
    disks: [
      {
        name: 'sda1',
        mount_point: '/',
        total_mb: 500000,
        used_mb: 250000,
        available_mb: 250000,
        file_system: 'ext4',
      },
    ],
    network_interfaces: [
      {
        name: 'eth0',
        mac_address: '00:11:22:33:44:55',
        ip_addresses: ['192.168.1.100'],
        is_up: true,
      },
    ],
  }
  
  return { ...defaults, ...overrides }
}

// ==================== 桌面信息数据工厂 ====================

export interface MockDesktopInfo {
  screen_width: number
  screen_height: number
  scale_factor: number
  display_count: number
  primary_display_index: number
  displays: Array<{
    index: number
    name: string
    is_primary: boolean
    width: number
    height: number
    refresh_rate: number
    scale_factor: number
    x: number
    y: number
    color_depth: number
    display_type: 'internal' | 'external'
  }>
}

export function createMockDesktopInfo(overrides?: Partial<MockDesktopInfo>): MockDesktopInfo {
  const defaults: MockDesktopInfo = {
    screen_width: 1920,
    screen_height: 1080,
    scale_factor: 1.0,
    display_count: 1,
    primary_display_index: 0,
    displays: [
      {
        index: 0,
        name: 'Primary Display',
        is_primary: true,
        width: 1920,
        height: 1080,
        refresh_rate: 60,
        scale_factor: 1.0,
        x: 0,
        y: 0,
        color_depth: 24,
        display_type: 'internal',
      },
    ],
  }
  
  return { ...defaults, ...overrides }
}

// ==================== API 响应数据工厂 ====================

export interface MockApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

export function createMockApiResponse<T>(
  data?: T,
  overrides?: Partial<MockApiResponse<T>>
): MockApiResponse<T> {
  const defaults: MockApiResponse<T> = {
    success: true,
    data,
    timestamp: Date.now(),
  }
  
  return { ...defaults, ...overrides }
}

export function createMockErrorResponse(
  error: string,
  overrides?: Partial<MockApiResponse>
): MockApiResponse {
  return {
    success: false,
    error,
    timestamp: Date.now(),
    ...overrides,
  }
}

// ==================== 错误数据工厂 ====================

export interface MockError {
  name: string
  message: string
  stack?: string
  code?: string | number
}

export function createMockError(overrides?: Partial<MockError>): MockError {
  const defaults: MockError = {
    name: 'TestError',
    message: 'Test error message',
    stack: 'Error: Test error\n    at test.ts:1:1',
    code: 'TEST_ERROR',
  }
  
  return { ...defaults, ...overrides }
}

// ==================== 导出所有工厂函数 ====================

export default {
  // 适配器
  createMockAdapter,
  createMockAdapterList,
  createMockAdapterMetadata,
  
  // 聊天
  createMockMessage,
  createMockConversation,
  
  // 角色
  createMockCharacter,
  
  // 设置
  createMockSettings,
  
  // 系统信息
  createMockSystemInfo,
  createMockDesktopInfo,
  
  // API 响应
  createMockApiResponse,
  createMockErrorResponse,
  
  // 错误
  createMockError,
}

