/**
 * 适配器类型定义
 * 
 * 提供适配器管理、执行、配置等相关的TypeScript类型定义
 * 与后端Rust代码中的适配器结构保持一致
 * 
 * @module types/adapter
 */

// ================================
// 基础枚举类型
// ================================

/**
 * 适配器状态枚举
 */
export enum AdapterStatus {
  /** 适配器已加载并准备就绪 */
  Loaded = 'loaded',
  /** 适配器未加载 */
  Unloaded = 'unloaded',
  /** 适配器正在加载中 */
  Loading = 'loading',
  /** 适配器正在卸载中 */
  Unloading = 'unloading',
  /** 适配器出现错误 */
  Error = 'error',
  /** 适配器状态未知 */
  Unknown = 'unknown',
  /** 适配器处于维护模式 */
  Maintenance = 'maintenance',
}

/**
 * 适配器类型枚举
 */
export enum AdapterType {
  /** 软适配器（基于提示词和RAG） */
  Soft = 'soft',
  /** 硬适配器（基于原生代码） */
  Hard = 'hard',
  /** 智能硬适配器（基于微调模型） */
  Intelligent = 'intelligent',
}

/**
 * 适配器能力等级枚举
 */
export enum CapabilityLevel {
  /** 基础能力 */
  Basic = 'basic',
  /** 中级能力 */
  Intermediate = 'intermediate',
  /** 高级能力 */
  Advanced = 'advanced',
  /** 专家级能力 */
  Expert = 'expert',
}

/**
 * 权限级别枚举
 */
export enum PermissionLevel {
  /** 公开权限 */
  Public = 'public',
  /** 用户权限 */
  User = 'user',
  /** 管理员权限 */
  Admin = 'admin',
  /** 系统权限 */
  System = 'system',
}

// ================================
// 核心数据结构
// ================================

/**
 * 适配器能力描述
 */
export interface AdapterCapability {
  /** 能力名称 */
  name: string;
  /** 能力描述 */
  description: string;
  /** 能力等级 */
  level: CapabilityLevel;
  /** 必需参数列表 */
  required_params: string[];
  /** 可选参数列表 */
  optional_params: string[];
}

/**
 * 适配器资源需求
 */
export interface AdapterResourceRequirements {
  /** 最小内存需求（MB） */
  min_memory_mb?: number;
  /** 最小CPU核心数 */
  min_cpu_cores?: number;
  /** 是否需要GPU */
  gpu_required: boolean;
  /** 最小GPU内存（MB） */
  min_gpu_memory_mb?: number;
  /** 需要的Python版本 */
  python_version?: string;
  /** 依赖项列表 */
  dependencies: string[];
}

/**
 * 适配器兼容性信息
 */
export interface AdapterCompatibility {
  /** 兼容的基础模型 */
  base_models: string[];
  /** 兼容的框架 */
  frameworks: Record<string, string>;
  /** 兼容的操作系统 */
  operating_systems: string[];
  /** 兼容的Python版本 */
  python_versions: string[];
}

/**
 * 适配器元数据
 */
export interface AdapterMetadata {
  /** 适配器ID */
  id: string;
  /** 适配器名称 */
  name: string;
  /** 适配器版本 */
  version: string;
  /** 适配器类型 */
  adapter_type: AdapterType;
  /** 描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 许可证 */
  license?: string;
  /** 标签 */
  tags: string[];
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  /** 能力列表 */
  capabilities: AdapterCapability[];
  /** 兼容性信息 */
  compatibility: AdapterCompatibility;
  /** 资源需求 */
  resource_requirements: AdapterResourceRequirements;
  /** 配置模式 */
  config_schema: Record<string, any>;
  /** 默认配置 */
  default_config: Record<string, any>;
  /** 文件大小（字节） */
  file_size_bytes?: number;
  /** 参数数量 */
  parameter_count?: number;
}

/**
 * 适配器信息（用于API响应）
 */
export interface AdapterInfo {
  /** 适配器名称 */
  name: string;
  /** 适配器路径 */
  path?: string;
  /** 适配器大小（字节） */
  size?: number;
  /** 适配器版本 */
  version?: string;
  /** 描述 */
  description?: string;
  /** 当前状态 */
  status: AdapterStatus;
  /** 加载时间 */
  load_time?: string;
  /** 内存使用量（字节） */
  memory_usage?: number;
  /** 配置 */
  config: Record<string, any>;
}

// ================================
// 请求和响应类型
// ================================

/**
 * 适配器安装请求
 */
export interface AdapterInstallRequest {
  /** 适配器ID或URL */
  adapter_id: string;
  /** 安装源（market, url, file） */
  source: string;
  /** 强制安装 */
  force: boolean;
  /** 安装选项 */
  options: Record<string, any>;
}

/**
 * 适配器执行请求
 */
export interface AdapterExecutionRequest {
  /** 适配器ID */
  adapter_id: string;
  /** 要执行的操作 */
  action: string;
  /** 参数 */
  params: Record<string, any>;
  /** 执行超时时间（秒） */
  timeout?: number;
}

/**
 * 适配器配置更新请求
 */
export interface AdapterConfigUpdateRequest {
  /** 适配器ID */
  adapter_id: string;
  /** 要更新的配置 */
  config: Record<string, any>;
  /** 是否与现有配置合并 */
  merge: boolean;
}

/**
 * 适配器搜索请求
 */
export interface AdapterSearchRequest {
  /** 搜索查询 */
  query: string;
  /** 适配器类型过滤器 */
  adapter_type?: AdapterType;
  /** 分类过滤器 */
  category?: string;
  /** 标签过滤器 */
  tags?: string[];
  /** 最低价格过滤器 */
  price_min?: number;
  /** 最高价格过滤器 */
  price_max?: number;
  /** 最低评分过滤器 */
  rating_min?: number;
  /** 仅免费过滤器 */
  free_only?: boolean;
  /** 仅精选过滤器 */
  featured_only?: boolean;
  /** 页码 */
  page?: number;
  /** 每页大小 */
  page_size?: number;
  /** 排序字段 */
  sort_by?: string;
  /** 排序顺序 */
  sort_order?: 'asc' | 'desc';
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[];
  /** 总数量 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页大小 */
  page_size: number;
  /** 总页数 */
  total_pages: number;
  /** 是否有下一页 */
  has_next: boolean;
  /** 是否有上一页 */
  has_prev: boolean;
}

/**
 * 命令元数据
 */
export interface CommandMetadata {
  /** 命令名称 */
  name: string;
  /** 命令描述 */
  description: string;
  /** 输入类型 */
  input_type?: string;
  /** 输出类型 */
  output_type?: string;
  /** 所需权限级别 */
  required_permission: PermissionLevel;
  /** 是否为异步命令 */
  is_async: boolean;
  /** 命令分类 */
  category: string;
}

/**
 * 命令响应
 */
export interface CommandResponse<T = any> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误消息 */
  error?: string;
  /** 响应代码 */
  code?: string;
  /** 时间戳 */
  timestamp?: number;
  /** 消息 */
  message?: string;
}

// ================================
// 适配器执行相关类型
// ================================

/**
 * 适配器执行结果
 */
export interface AdapterExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  execution_time?: number;
  /** 使用的资源 */
  resource_usage?: {
    memory_mb: number;
    cpu_percent: number;
    gpu_percent?: number;
  };
  /** 日志信息 */
  logs?: string[];
}

/**
 * 适配器执行上下文
 */
export interface AdapterExecutionContext {
  /** 会话ID */
  session_id: string;
  /** 用户ID */
  user_id?: string;
  /** 环境变量 */
  environment: Record<string, string>;
  /** 工作目录 */
  working_directory: string;
  /** 超时设置 */
  timeout: number;
  /** 资源限制 */
  resource_limits: {
    max_memory_mb: number;
    max_cpu_percent: number;
    max_execution_time_ms: number;
  };
}

/**
 * 适配器事件
 */
export interface AdapterEvent {
  /** 事件类型 */
  type: 'installed' | 'uninstalled' | 'loaded' | 'unloaded' | 'error' | 'status_changed';
  /** 适配器ID */
  adapter_id: string;
  /** 事件数据 */
  data?: any;
  /** 时间戳 */
  timestamp: number;
}

// ================================
// 适配器市场相关类型
// ================================

/**
 * 适配器市场产品
 */
export interface AdapterMarketProduct {
  /** 产品ID */
  id: string;
  /** 产品名称 */
  name: string;
  /** 产品类型 */
  product_type: 'adapter' | 'service' | 'plugin';
  /** 版本 */
  version: string;
  /** 描述 */
  description: string;
  /** 供应商信息 */
  vendor: {
    name: string;
    email: string;
    website?: string;
    verified: boolean;
  };
  /** 定价信息 */
  pricing: {
    price: number;
    currency: string;
    license_type: string;
    free_trial?: boolean;
    subscription?: boolean;
  };
  /** 评分和评论 */
  rating: {
    average: number;
    count: number;
    distribution: Record<string, number>;
  };
  /** 下载统计 */
  downloads: {
    total: number;
    monthly: number;
    weekly: number;
  };
  /** 标签 */
  tags: string[];
  /** 分类 */
  category: string;
  /** 兼容性 */
  compatibility: AdapterCompatibility;
  /** 文件大小 */
  file_size: number;
  /** 依赖项 */
  requirements: string[];
  /** 截图 */
  screenshots: string[];
  /** 文档链接 */
  documentation_url?: string;
  /** 支持链接 */
  support_url?: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 适配器市场搜索过滤器
 */
export interface AdapterMarketFilter {
  /** 关键词 */
  query?: string;
  /** 分类 */
  category?: string;
  /** 标签 */
  tags?: string[];
  /** 价格范围 */
  price_range?: {
    min: number;
    max: number;
  };
  /** 评分范围 */
  rating_range?: {
    min: number;
    max: number;
  };
  /** 仅免费 */
  free_only?: boolean;
  /** 仅精选 */
  featured_only?: boolean;
  /** 仅已验证供应商 */
  verified_vendor_only?: boolean;
  /** 操作系统 */
  operating_system?: string;
  /** Python版本 */
  python_version?: string;
}

// ================================
// 适配器配置相关类型
// ================================

/**
 * 适配器配置项
 */
export interface AdapterConfigItem {
  /** 配置键 */
  key: string;
  /** 配置值 */
  value: any;
  /** 配置类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** 是否必需 */
  required: boolean;
  /** 默认值 */
  default_value?: any;
  /** 描述 */
  description?: string;
  /** 验证规则 */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

/**
 * 适配器配置模式
 */
export interface AdapterConfigSchema {
  /** 配置项列表 */
  properties: Record<string, AdapterConfigItem>;
  /** 必需字段 */
  required: string[];
  /** 配置版本 */
  version: string;
  /** 配置描述 */
  description?: string;
}

/**
 * 适配器配置验证结果
 */
export interface AdapterConfigValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** 警告列表 */
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

// ================================
// 适配器状态管理类型
// ================================

/**
 * 适配器状态信息
 */
export interface AdapterStatusInfo {
  /** 适配器ID */
  adapter_id: string;
  /** 当前状态 */
  status: AdapterStatus;
  /** 状态消息 */
  message?: string;
  /** 最后更新时间 */
  last_updated: string;
  /** 健康检查结果 */
  health_check?: {
    healthy: boolean;
    last_check: string;
    response_time_ms: number;
    error_message?: string;
  };
  /** 性能指标 */
  performance_metrics?: {
    memory_usage_mb: number;
    cpu_usage_percent: number;
    gpu_usage_percent?: number;
    response_time_ms: number;
    throughput_per_second: number;
  };
  /** 错误信息 */
  error_info?: {
    code: string;
    message: string;
    stack_trace?: string;
    timestamp: string;
  };
}

/**
 * 适配器管理器状态
 */
export interface AdapterManagerStatus {
  /** 总适配器数量 */
  total_adapters: number;
  /** 已加载适配器数量 */
  loaded_adapters: number;
  /** 错误适配器数量 */
  error_adapters: number;
  /** 系统资源使用情况 */
  system_resources: {
    memory_usage_mb: number;
    cpu_usage_percent: number;
    gpu_usage_percent?: number;
  };
  /** 最后更新时间 */
  last_updated: string;
}

// ================================
// 工具类型和辅助类型
// ================================

/**
 * 适配器操作类型
 */
export type AdapterOperation = 
  | 'install'
  | 'uninstall'
  | 'load'
  | 'unload'
  | 'execute'
  | 'configure'
  | 'update'
  | 'backup'
  | 'restore'
  | 'validate';

/**
 * 适配器操作结果
 */
export interface AdapterOperationResult<T = any> {
  /** 操作类型 */
  operation: AdapterOperation;
  /** 适配器ID */
  adapter_id: string;
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 操作时间（毫秒） */
  duration_ms: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 适配器批量操作请求
 */
export interface AdapterBatchOperationRequest {
  /** 操作类型 */
  operation: AdapterOperation;
  /** 适配器ID列表 */
  adapter_ids: string[];
  /** 操作参数 */
  params?: Record<string, any>;
  /** 并发数量 */
  concurrency?: number;
  /** 失败时是否继续 */
  continue_on_error?: boolean;
}

/**
 * 适配器批量操作结果
 */
export interface AdapterBatchOperationResult {
  /** 成功的操作 */
  successful: AdapterOperationResult[];
  /** 失败的操作 */
  failed: AdapterOperationResult[];
  /** 总操作数 */
  total: number;
  /** 成功数 */
  success_count: number;
  /** 失败数 */
  failure_count: number;
  /** 总耗时（毫秒） */
  total_duration_ms: number;
}

// ================================
// 导出所有类型
// ================================

// 所有接口和类型已经在上面通过 export interface 和 export type 导出
// 这里不需要重复导出

// ================================
// 类型守卫函数
// ================================

/**
 * 检查是否为有效的适配器状态
 */
export function isValidAdapterStatus(status: any): status is AdapterStatus {
  return Object.values(AdapterStatus).includes(status);
}

/**
 * 检查是否为有效的适配器类型
 */
export function isValidAdapterType(type: any): type is AdapterType {
  return Object.values(AdapterType).includes(type);
}

/**
 * 检查是否为有效的能力等级
 */
export function isValidCapabilityLevel(level: any): level is CapabilityLevel {
  return Object.values(CapabilityLevel).includes(level);
}

/**
 * 检查适配器信息是否完整
 */
export function isCompleteAdapterInfo(info: any): info is AdapterInfo {
  return (
    typeof info === 'object' &&
    info !== null &&
    typeof info.name === 'string' &&
    isValidAdapterStatus(info.status)
  );
}

/**
 * 检查适配器元数据是否完整
 */
export function isCompleteAdapterMetadata(metadata: any): metadata is AdapterMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    typeof metadata.id === 'string' &&
    typeof metadata.name === 'string' &&
    typeof metadata.version === 'string' &&
    isValidAdapterType(metadata.adapter_type) &&
    Array.isArray(metadata.tags) &&
    Array.isArray(metadata.capabilities) &&
    typeof metadata.compatibility === 'object' &&
    typeof metadata.resource_requirements === 'object'
  );
}

// ================================
// 默认值和常量
// ================================

/**
 * 默认适配器配置
 */
export const DEFAULT_ADAPTER_CONFIG: Record<string, any> = {
  enabled: true,
  auto_load: false,
  timeout: 30000,
  max_retries: 3,
  log_level: 'info',
};

/**
 * 默认资源需求
 */
export const DEFAULT_RESOURCE_REQUIREMENTS: AdapterResourceRequirements = {
  min_memory_mb: 128,
  min_cpu_cores: 1,
  gpu_required: false,
  dependencies: [],
};

/**
 * 默认兼容性信息
 */
export const DEFAULT_COMPATIBILITY: AdapterCompatibility = {
  base_models: [],
  frameworks: {},
  operating_systems: ['linux', 'windows', 'macos'],
  python_versions: ['3.8+'],
};

/**
 * 支持的适配器操作
 */
export const SUPPORTED_ADAPTER_OPERATIONS: AdapterOperation[] = [
  'install',
  'uninstall',
  'load',
  'unload',
  'execute',
  'configure',
  'update',
  'backup',
  'restore',
  'validate',
];

/**
 * 适配器状态优先级（用于排序）
 */
export const ADAPTER_STATUS_PRIORITY: Record<AdapterStatus, number> = {
  [AdapterStatus.Loaded]: 1,
  [AdapterStatus.Loading]: 2,
  [AdapterStatus.Unloaded]: 3,
  [AdapterStatus.Unloading]: 4,
  [AdapterStatus.Maintenance]: 5,
  [AdapterStatus.Error]: 6,
  [AdapterStatus.Unknown]: 7,
};

/**
 * 能力等级优先级（用于排序）
 */
export const CAPABILITY_LEVEL_PRIORITY: Record<CapabilityLevel, number> = {
  [CapabilityLevel.Basic]: 1,
  [CapabilityLevel.Intermediate]: 2,
  [CapabilityLevel.Advanced]: 3,
  [CapabilityLevel.Expert]: 4,
};
