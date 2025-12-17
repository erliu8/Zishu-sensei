/**
 * API 路由配置
 * 
 * 根据不同的功能模块路由到不同的后端服务：
 * - 用户认证、社区功能 → 社区平台 (8001)
 * - 角色模板、适配器、核心AI → 核心服务 (8000)
 */

export interface ApiBackend {
  name: string
  baseURL: string
  description: string
}

export const API_BACKENDS = {
  /** 核心服务 - 角色、适配器、AI功能 */
  CORE: {
    name: 'core',
    baseURL: import.meta.env.VITE_CORE_API_URL || 'http://127.0.0.1:8000',
    description: '核心服务（角色模板、适配器、工作流）',
  },
  
  /** 社区平台 - 用户认证、社区功能 */
  COMMUNITY: {
    name: 'community',
    baseURL: import.meta.env.VITE_COMMUNITY_API_URL || 'http://localhost:8001',
    description: '社区平台（用户认证、社区互动）',
  },
} as const

/**
 * API 路由规则
 * 
 * 根据路径前缀决定使用哪个后端
 */
export const API_ROUTES: Record<string, ApiBackend> = {
  // ===========================
  // 社区平台路由 (8001)
  // ===========================
  '/auth': API_BACKENDS.COMMUNITY,
  '/user': API_BACKENDS.COMMUNITY,
  '/users': API_BACKENDS.COMMUNITY,
  '/community': API_BACKENDS.COMMUNITY,
  '/social': API_BACKENDS.COMMUNITY,
  '/posts': API_BACKENDS.COMMUNITY,
  '/comments': API_BACKENDS.COMMUNITY,
  '/notifications': API_BACKENDS.COMMUNITY,
  '/market': API_BACKENDS.COMMUNITY,  // 市场/应用商店
  
  // ===========================
  // 核心服务路由 (8000)
  // ===========================
  '/chat': API_BACKENDS.CORE,
  '/characters': API_BACKENDS.CORE,
  '/adapters': API_BACKENDS.CORE,
  '/workflows': API_BACKENDS.CORE,
  '/tasks': API_BACKENDS.CORE,
  '/system': API_BACKENDS.CORE,
  '/settings': API_BACKENDS.CORE,
  '/models': API_BACKENDS.CORE,
  '/screen': API_BACKENDS.CORE,
}

/**
 * 获取API路径对应的后端
 */
export function getBackendForPath(path: string): ApiBackend {
  // 标准化路径
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  
  // 查找匹配的路由
  for (const [prefix, backend] of Object.entries(API_ROUTES)) {
    if (normalizedPath.startsWith(prefix)) {
      return backend
    }
  }
  
  // 默认使用核心服务
  return API_BACKENDS.CORE
}

/**
 * 构建完整的API URL
 */
export function buildApiUrl(path: string, backend?: ApiBackend): string {
  const targetBackend = backend || getBackendForPath(path)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  
  return `${targetBackend.baseURL}${normalizedPath}`
}

/**
 * 获取后端配置信息
 */
export function getBackendInfo(): {
  core: ApiBackend
  community: ApiBackend
  routes: Record<string, string>
} {
  return {
    core: API_BACKENDS.CORE,
    community: API_BACKENDS.COMMUNITY,
    routes: Object.fromEntries(
      Object.entries(API_ROUTES).map(([path, backend]) => [path, backend.name])
    ),
  }
}

/**
 * 验证后端连接
 */
export async function checkBackendHealth(backend: ApiBackend): Promise<boolean> {
  try {
    const response = await fetch(`${backend.baseURL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * 检查所有后端状态
 */
export async function checkAllBackends(): Promise<Record<string, boolean>> {
  const results = await Promise.all([
    checkBackendHealth(API_BACKENDS.CORE),
    checkBackendHealth(API_BACKENDS.COMMUNITY),
  ])
  
  return {
    core: results[0],
    community: results[1],
  }
}

// 导出类型
export type BackendName = keyof typeof API_BACKENDS
