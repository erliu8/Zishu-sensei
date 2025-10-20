/**
 * 适配器测试辅助工具
 * 
 * 提供适配器相关的测试工具函数、Mock 数据和工厂函数
 */

import { vi } from 'vitest'
import {
  AdapterInfo,
  AdapterMetadata,
  AdapterStatus,
  AdapterType,
  CapabilityLevel,
  AdapterCapability,
  AdapterResourceRequirements,
  AdapterCompatibility,
  AdapterMarketProduct,
  CommandResponse,
  PaginatedResponse,
  AdapterSearchRequest,
  AdapterConfigUpdateRequest,
  AdapterExecutionResult,
} from '../../types/adapter'

// ==================== Mock 数据工厂 ====================

/**
 * 创建模拟适配器信息
 */
export function createMockAdapterInfo(overrides?: Partial<AdapterInfo>): AdapterInfo {
  return {
    name: 'test-adapter',
    path: '/path/to/adapter',
    size: 1024000,
    version: '1.0.0',
    description: 'Test adapter description',
    status: AdapterStatus.Loaded,
    load_time: new Date().toISOString(),
    memory_usage: 50 * 1024 * 1024, // 50MB
    config: {
      enabled: true,
      timeout: 30000,
    },
    ...overrides,
  }
}

/**
 * 创建模拟适配器能力
 */
export function createMockAdapterCapability(overrides?: Partial<AdapterCapability>): AdapterCapability {
  return {
    name: 'text_processing',
    description: 'Process text using AI models',
    level: CapabilityLevel.Intermediate,
    required_params: ['input', 'model'],
    optional_params: ['temperature', 'max_tokens'],
    ...overrides,
  }
}

/**
 * 创建模拟资源需求
 */
export function createMockResourceRequirements(overrides?: Partial<AdapterResourceRequirements>): AdapterResourceRequirements {
  return {
    min_memory_mb: 512,
    min_cpu_cores: 2,
    gpu_required: false,
    min_gpu_memory_mb: undefined,
    python_version: '3.8+',
    dependencies: ['torch>=1.9.0', 'transformers>=4.0.0'],
    ...overrides,
  }
}

/**
 * 创建模拟兼容性信息
 */
export function createMockCompatibility(overrides?: Partial<AdapterCompatibility>): AdapterCompatibility {
  return {
    base_models: ['gpt-3.5', 'gpt-4'],
    frameworks: {
      'pytorch': '>=1.9.0',
      'tensorflow': '>=2.4.0',
    },
    operating_systems: ['linux', 'windows', 'macos'],
    python_versions: ['3.8', '3.9', '3.10', '3.11'],
    ...overrides,
  }
}

/**
 * 创建模拟适配器元数据
 */
export function createMockAdapterMetadata(overrides?: Partial<AdapterMetadata>): AdapterMetadata {
  const baseCapability = createMockAdapterCapability()
  const baseRequirements = createMockResourceRequirements()
  const baseCompatibility = createMockCompatibility()
  
  return {
    id: 'test-adapter-001',
    name: 'Test Adapter',
    version: '1.0.0',
    adapter_type: AdapterType.Soft,
    description: 'A test adapter for demonstration purposes',
    author: 'Test Author',
    license: 'MIT',
    tags: ['test', 'demo', 'ai'],
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date().toISOString(),
    capabilities: [baseCapability],
    compatibility: baseCompatibility,
    resource_requirements: baseRequirements,
    config_schema: {
      model_name: {
        type: 'string',
        title: 'Model Name',
        description: 'The name of the AI model to use',
        default: 'gpt-3.5-turbo',
        enum: ['gpt-3.5-turbo', 'gpt-4', 'claude-3'],
      },
      temperature: {
        type: 'number',
        title: 'Temperature',
        description: 'Controls randomness in generation',
        default: 0.7,
        minimum: 0,
        maximum: 2,
      },
      max_tokens: {
        type: 'integer',
        title: 'Max Tokens',
        description: 'Maximum number of tokens to generate',
        default: 2048,
        minimum: 1,
        maximum: 4096,
      },
      enabled: {
        type: 'boolean',
        title: 'Enabled',
        description: 'Whether the adapter is enabled',
        default: true,
      },
    },
    default_config: {
      model_name: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: 2048,
      enabled: true,
    },
    file_size_bytes: 1024000,
    parameter_count: 175000000000,
    ...overrides,
  }
}

/**
 * 创建模拟市场产品
 */
export function createMockMarketProduct(overrides?: Partial<AdapterMarketProduct>): AdapterMarketProduct {
  return {
    id: 'market-adapter-001',
    name: 'Market Test Adapter',
    product_type: 'adapter',
    version: '1.2.0',
    description: 'A popular adapter from the marketplace',
    vendor: {
      name: 'Test Vendor',
      email: 'vendor@example.com',
      website: 'https://example.com',
      verified: true,
    },
    pricing: {
      price: 0,
      currency: 'USD',
      license_type: 'MIT',
      free_trial: true,
      subscription: false,
    },
    rating: {
      average: 4.5,
      count: 150,
      distribution: {
        '5': 80,
        '4': 45,
        '3': 15,
        '2': 8,
        '1': 2,
      },
    },
    downloads: {
      total: 5000,
      monthly: 500,
      weekly: 125,
    },
    tags: ['popular', 'ai', 'nlp'],
    category: 'Language Models',
    compatibility: createMockCompatibility(),
    file_size: 2048000,
    requirements: ['python>=3.8', 'torch>=1.9.0'],
    screenshots: [
      'https://example.com/screenshot1.png',
      'https://example.com/screenshot2.png',
    ],
    documentation_url: 'https://example.com/docs',
    support_url: 'https://example.com/support',
    created_at: new Date('2024-01-15').toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * 创建分页响应
 */
export function createMockPaginatedResponse<T>(
  items: T[],
  overrides?: Partial<PaginatedResponse<T>>
): PaginatedResponse<T> {
  const page = overrides?.page || 1
  const pageSize = overrides?.page_size || 20
  const total = overrides?.total || items.length
  
  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
    has_next: page * pageSize < total,
    has_prev: page > 1,
    ...overrides,
  }
}

// ==================== Mock 服务 ====================

/**
 * 模拟适配器服务
 */
export function mockAdapterService() {
  const mockAdapters = [
    createMockAdapterInfo({
      name: 'gpt-adapter',
      status: AdapterStatus.Loaded,
      description: 'GPT-based text generation adapter',
    }),
    createMockAdapterInfo({
      name: 'claude-adapter',
      status: AdapterStatus.Unloaded,
      description: 'Claude-based conversation adapter',
    }),
    createMockAdapterInfo({
      name: 'dalle-adapter',
      status: AdapterStatus.Error,
      description: 'DALL-E image generation adapter',
    }),
  ]

  const mockMarketProducts = [
    createMockMarketProduct({
      name: 'Advanced GPT Adapter',
      category: 'Text Generation',
    }),
    createMockMarketProduct({
      name: 'Image Processing Adapter',
      category: 'Image Generation',
    }),
  ]

  return {
    getAdapters: vi.fn().mockResolvedValue(mockAdapters),
    getAdapterDetails: vi.fn().mockImplementation((adapterId: string) => {
      return Promise.resolve(createMockAdapterMetadata({
        id: adapterId,
        name: adapterId,
      }))
    }),
    getAdapterConfig: vi.fn().mockImplementation((adapterId: string) => {
      return Promise.resolve({
        model_name: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 2048,
        enabled: true,
      })
    }),
    installAdapter: vi.fn().mockResolvedValue({ success: true }),
    uninstallAdapter: vi.fn().mockResolvedValue({ success: true }),
    loadAdapter: vi.fn().mockResolvedValue({ success: true }),
    unloadAdapter: vi.fn().mockResolvedValue({ success: true }),
    updateAdapterConfig: vi.fn().mockResolvedValue({ success: true }),
    searchAdapters: vi.fn().mockImplementation((request: AdapterSearchRequest) => {
      const filteredProducts = mockMarketProducts.filter(product => 
        !request.query || product.name.toLowerCase().includes(request.query.toLowerCase())
      )
      return Promise.resolve(createMockPaginatedResponse(filteredProducts))
    }),
    getStatusColor: vi.fn().mockImplementation((status: AdapterStatus) => {
      const colors = {
        [AdapterStatus.Loaded]: 'green',
        [AdapterStatus.Unloaded]: 'gray',
        [AdapterStatus.Loading]: 'yellow',
        [AdapterStatus.Unloading]: 'yellow',
        [AdapterStatus.Error]: 'red',
        [AdapterStatus.Unknown]: 'gray',
        [AdapterStatus.Maintenance]: 'blue',
      }
      return colors[status] || 'gray'
    }),
    formatStatus: vi.fn().mockImplementation((status: AdapterStatus) => {
      const labels = {
        [AdapterStatus.Loaded]: 'Loaded',
        [AdapterStatus.Unloaded]: 'Unloaded',
        [AdapterStatus.Loading]: 'Loading...',
        [AdapterStatus.Unloading]: 'Unloading...',
        [AdapterStatus.Error]: 'Error',
        [AdapterStatus.Unknown]: 'Unknown',
        [AdapterStatus.Maintenance]: 'Maintenance',
      }
      return labels[status] || 'Unknown'
    }),
    formatSize: vi.fn().mockImplementation((size?: number) => {
      if (!size) return 'Unknown'
      if (size < 1024) return `${size} B`
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
      if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }),
  }
}

// ==================== Mock Tauri 命令 ====================

/**
 * 模拟 Tauri invoke 函数
 */
export function mockTauriInvoke() {
  const mockResponses: Record<string, any> = {
    'get_installed_adapters': {
      success: true,
      data: [
        createMockAdapterInfo({ name: 'adapter1' }),
        createMockAdapterInfo({ name: 'adapter2' }),
      ],
    },
    'install_adapter': { success: true },
    'uninstall_adapter': { success: true },
    'load_adapter': { success: true },
    'unload_adapter': { success: true },
    'get_adapter_config': {
      success: true,
      data: { enabled: true, timeout: 30000 },
    },
    'update_adapter_config': { success: true },
    'search_adapters': {
      success: true,
      data: createMockPaginatedResponse([
        createMockMarketProduct(),
      ]),
    },
  }

  return vi.fn().mockImplementation((command: string, args?: any) => {
    console.log(`Mock Tauri invoke: ${command}`, args)
    
    if (mockResponses[command]) {
      return Promise.resolve(mockResponses[command])
    }
    
    // 默认成功响应
    return Promise.resolve({ success: true, data: null })
  })
}

// ==================== 测试场景辅助函数 ====================

/**
 * 设置适配器列表测试场景
 */
export function setupAdapterListScenario() {
  const adapters = [
    createMockAdapterInfo({
      name: 'active-adapter',
      status: AdapterStatus.Loaded,
      description: 'Currently active adapter',
    }),
    createMockAdapterInfo({
      name: 'inactive-adapter',
      status: AdapterStatus.Unloaded,
      description: 'Currently inactive adapter',
    }),
    createMockAdapterInfo({
      name: 'error-adapter',
      status: AdapterStatus.Error,
      description: 'Adapter with error',
    }),
  ]

  return {
    adapters,
    mockService: mockAdapterService(),
  }
}

/**
 * 设置适配器搜索测试场景
 */
export function setupAdapterSearchScenario() {
  const searchResults = [
    createMockMarketProduct({
      name: 'Popular Adapter',
      rating: { average: 4.8, count: 200, distribution: {} },
      downloads: { total: 10000, monthly: 1000, weekly: 250 },
    }),
    createMockMarketProduct({
      name: 'New Adapter',
      rating: { average: 4.2, count: 50, distribution: {} },
      downloads: { total: 500, monthly: 100, weekly: 25 },
    }),
  ]

  return {
    searchResults,
    mockService: mockAdapterService(),
  }
}

/**
 * 设置适配器配置测试场景
 */
export function setupAdapterConfigScenario() {
  const metadata = createMockAdapterMetadata({
    name: 'Test Adapter',
    config_schema: {
      api_key: {
        type: 'string',
        title: 'API Key',
        description: 'Your API key for the service',
        default: '',
      },
      model: {
        type: 'select',
        title: 'Model',
        description: 'Select the model to use',
        default: 'gpt-3.5-turbo',
        enum: ['gpt-3.5-turbo', 'gpt-4', 'claude-3'],
      },
      temperature: {
        type: 'number',
        title: 'Temperature',
        description: 'Controls randomness',
        default: 0.7,
        minimum: 0,
        maximum: 2,
      },
      max_tokens: {
        type: 'integer',
        title: 'Max Tokens',
        description: 'Maximum tokens to generate',
        default: 2048,
      },
      enabled: {
        type: 'boolean',
        title: 'Enabled',
        description: 'Enable this adapter',
        default: true,
      },
      tags: {
        type: 'array',
        title: 'Tags',
        description: 'Tags for categorization',
        default: [],
      },
    },
  })

  const currentConfig = {
    api_key: 'test-api-key',
    model: 'gpt-3.5-turbo',
    temperature: 0.8,
    max_tokens: 1024,
    enabled: true,
    tags: ['ai', 'nlp'],
  }

  return {
    metadata,
    currentConfig,
    mockService: mockAdapterService(),
  }
}

// ==================== 错误场景 ====================

/**
 * 创建网络错误
 */
export function createNetworkError(message = 'Network error') {
  return new Error(message)
}

/**
 * 创建权限错误
 */
export function createPermissionError(message = 'Permission denied') {
  return new Error(message)
}

/**
 * 创建配置错误
 */
export function createConfigError(message = 'Invalid configuration') {
  return new Error(message)
}

/**
 * 模拟服务错误响应
 */
export function mockServiceWithErrors() {
  return {
    getAdapters: vi.fn().mockRejectedValue(createNetworkError('Failed to load adapters')),
    installAdapter: vi.fn().mockRejectedValue(createPermissionError('Installation failed')),
    updateAdapterConfig: vi.fn().mockRejectedValue(createConfigError('Invalid config')),
    searchAdapters: vi.fn().mockRejectedValue(createNetworkError('Search service unavailable')),
  }
}

// ==================== 性能测试辅助 ====================

/**
 * 模拟慢速操作
 */
export function mockSlowOperation(delay = 2000) {
  return vi.fn().mockImplementation(() => 
    new Promise(resolve => setTimeout(resolve, delay))
  )
}

/**
 * 模拟加载状态
 */
export function mockLoadingStates() {
  let isLoading = false
  
  return {
    startLoading: () => { isLoading = true },
    stopLoading: () => { isLoading = false },
    isLoading: () => isLoading,
  }
}

// ==================== 导出所有工具 ====================

export default {
  // 工厂函数
  createMockAdapterInfo,
  createMockAdapterCapability,
  createMockResourceRequirements,
  createMockCompatibility,
  createMockAdapterMetadata,
  createMockMarketProduct,
  createMockPaginatedResponse,
  
  // Mock 服务
  mockAdapterService,
  mockTauriInvoke,
  
  // 测试场景
  setupAdapterListScenario,
  setupAdapterSearchScenario,
  setupAdapterConfigScenario,
  
  // 错误场景
  createNetworkError,
  createPermissionError,
  createConfigError,
  mockServiceWithErrors,
  
  // 性能测试
  mockSlowOperation,
  mockLoadingStates,
}
