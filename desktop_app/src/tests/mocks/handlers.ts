/**
 * MSW (Mock Service Worker) 处理器
 * 
 * 用于在测试中模拟 API 请求
 */

import { http, HttpResponse } from 'msw'
import type { AdapterInfo, AdapterMetadata, SystemInfo } from '../../types'

// 模拟数据
const mockAdapters: AdapterInfo[] = [
  {
    name: 'test-adapter-1',
    path: '/path/to/adapter1',
    size: 1024000,
    version: '1.0.0',
    description: '测试适配器 1',
    status: 'loaded' as const,
    load_time: new Date().toISOString(),
    memory_usage: 512000,
    config: {
      enabled: true,
      timeout: 30000,
    },
  },
  {
    name: 'test-adapter-2',
    path: '/path/to/adapter2',
    size: 2048000,
    version: '2.0.0',
    description: '测试适配器 2',
    status: 'unloaded' as const,
    load_time: new Date().toISOString(),
    memory_usage: 0,
    config: {
      enabled: false,
      timeout: 60000,
    },
  },
]

const mockAdapterMetadata: AdapterMetadata[] = [
  {
    id: 'test-adapter-1',
    name: '测试适配器 1',
    version: '1.0.0',
    adapter_type: 'soft' as const,
    description: '这是一个测试适配器',
    author: '测试作者',
    license: 'MIT',
    tags: ['test', 'demo'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    capabilities: [
      {
        name: '文本处理',
        description: '处理文本内容',
        level: 'basic' as const,
        required_params: ['text'],
        optional_params: ['format'],
      },
    ],
    compatibility: {
      base_models: ['gpt-3.5-turbo'],
      frameworks: { 'transformers': '4.0+' },
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
        description: '超时时间',
      },
    },
    default_config: {
      timeout: 30000,
      enabled: true,
    },
    file_size_bytes: 1024000,
    parameter_count: 1000000,
  },
]

const mockSystemInfo: SystemInfo = {
  os_name: 'Linux',
  os_version: '6.8.0-85-generic',
  arch: 'x86_64',
  hostname: 'zishu-desktop',
  username: 'user',
  boot_time: new Date().toISOString(),
  uptime_seconds: 86400,
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

// API 处理器（MSW v2 语法）
export const handlers = [
  // 适配器相关 API
  http.get('/api/adapters', () => {
    return HttpResponse.json({
      success: true,
      data: mockAdapters,
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  http.get('/api/adapters/:id', ({ params }) => {
    const { id } = params
    const adapter = mockAdapters.find(a => a.name === id)
    
    if (!adapter) {
      return HttpResponse.json({
        success: false,
        error: '适配器未找到',
        timestamp: Date.now(),
      }, { status: 404 })
    }

    return HttpResponse.json({
      success: true,
      data: adapter,
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  http.get('/api/adapters/:id/metadata', ({ params }) => {
    const { id } = params
    const metadata = mockAdapterMetadata.find(m => m.id === id)
    
    if (!metadata) {
      return HttpResponse.json({
        success: false,
        error: '适配器元数据未找到',
        timestamp: Date.now(),
      }, { status: 404 })
    }

    return HttpResponse.json({
      success: true,
      data: metadata,
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  http.post('/api/adapters/:id/load', ({ params }) => {
    const { id } = params
    const adapter = mockAdapters.find(a => a.name === id)
    
    if (!adapter) {
      return HttpResponse.json({
        success: false,
        error: '适配器未找到',
        timestamp: Date.now(),
      }, { status: 404 })
    }

    // 模拟加载成功
    adapter.status = 'loaded'
    adapter.load_time = new Date().toISOString()

    return HttpResponse.json({
      success: true,
      data: adapter,
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  http.post('/api/adapters/:id/unload', ({ params }) => {
    const { id } = params
    const adapter = mockAdapters.find(a => a.name === id)
    
    if (!adapter) {
      return HttpResponse.json({
        success: false,
        error: '适配器未找到',
        timestamp: Date.now(),
      }, { status: 404 })
    }

    // 模拟卸载成功
    adapter.status = 'unloaded'
    adapter.memory_usage = 0

    return HttpResponse.json({
      success: true,
      data: adapter,
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  // 系统信息 API
  http.get('/api/system/info', () => {
    return HttpResponse.json({
      success: true,
      data: mockSystemInfo,
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  // 聊天 API
  http.post('/api/chat/send', async ({ request }) => {
    const body = await request.json() as { message: string }
    
    return HttpResponse.json({
      success: true,
      data: {
        message: `回复: ${body.message}`,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  // 桌面操作 API
  http.get('/api/desktop/info', () => {
    return HttpResponse.json({
      success: true,
      data: {
        screen_width: 1920,
        screen_height: 1080,
        scale_factor: 1.0,
        display_count: 1,
        primary_display_index: 0,
        displays: [
          {
            index: 0,
            name: '主显示器',
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
      },
      timestamp: Date.now(),
    }, { status: 200 })
  }),

  // 错误处理
  http.get('/api/error', () => {
    return HttpResponse.json({
      success: false,
      error: '模拟服务器错误',
      timestamp: Date.now(),
    }, { status: 500 })
  }),
]
