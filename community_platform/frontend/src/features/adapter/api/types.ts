/**
 * 适配器 API 类型定义
 */

/**
 * 适配器类型枚举
 */
export enum AdapterType {
  /** 软适配器：基于提示词工程和RAG技术 */
  SOFT = 'soft',
  /** 硬适配器：基于原生代码实现 */
  HARD = 'hard',
  /** 智能硬适配器：基于专业微调模型 */
  INTELLIGENT = 'intelligent',
}

/**
 * 能力等级枚举
 */
export enum CapabilityLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

/**
 * 适配器分类
 */
export enum AdapterCategory {
  DATA_ANALYSIS = 'data_analysis',
  OFFICE_AUTOMATION = 'office_automation',
  DESKTOP_CONTROL = 'desktop_control',
  FILE_PROCESSING = 'file_processing',
  KNOWLEDGE_QA = 'knowledge_qa',
  CONTENT_GENERATION = 'content_generation',
  SYSTEM_INTEGRATION = 'system_integration',
  CREATIVE_DESIGN = 'creative_design',
  CODE_GENERATION = 'code_generation',
  OTHER = 'other',
}

/**
 * 适配器兼容性平台
 */
export enum CompatibilityPlatform {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
}

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
  /** 输入类型 */
  inputs: string[];
  /** 输出类型 */
  outputs: string[];
}

/**
 * 适配器依赖
 */
export interface AdapterDependency {
  /** 依赖的适配器ID */
  adapterId: string;
  /** 依赖的适配器名称 */
  name: string;
  /** 版本要求 */
  versionRequirement: string;
  /** 是否为可选依赖 */
  optional: boolean;
}

/**
 * 系统要求
 */
export interface SystemRequirements {
  /** 最低内存（MB） */
  minMemory?: number;
  /** 最低磁盘空间（MB） */
  minDiskSpace?: number;
  /** Python版本要求 */
  pythonVersion?: string;
  /** Node.js版本要求 */
  nodeVersion?: string;
  /** 其他软件依赖 */
  otherDependencies?: string[];
}

/**
 * 权限需求
 */
export interface PermissionRequirements {
  /** 文件系统访问 */
  fileSystemAccess: 'none' | 'read_only' | 'read_write';
  /** 网络访问 */
  networkAccess: boolean;
  /** 桌面控制 */
  desktopControl: boolean;
  /** 系统API访问 */
  systemApiAccess: boolean;
  /** 执行代码权限 */
  codeExecution: boolean;
}

/**
 * 适配器元数据
 */
export interface AdapterMetadata {
  /** 适配器名称 */
  name: string;
  /** 适配器描述 */
  description: string;
  /** 详细说明 */
  longDescription?: string;
  /** 适配器类型 */
  adapterType: AdapterType;
  /** 分类 */
  category: AdapterCategory;
  /** 标签 */
  tags: string[];
  /** 能力列表 */
  capabilities: AdapterCapability[];
  /** 兼容平台 */
  compatibility: CompatibilityPlatform[];
  /** 系统要求 */
  systemRequirements: SystemRequirements;
  /** 权限需求 */
  permissions: PermissionRequirements;
  /** 依赖列表 */
  dependencies: AdapterDependency[];
  /** 示例代码 */
  examples?: string[];
  /** 文档链接 */
  documentationUrl?: string;
  /** 源代码仓库 */
  repositoryUrl?: string;
}

/**
 * 适配器版本信息
 */
export interface AdapterVersion {
  /** 版本号 */
  version: string;
  /** 版本描述 */
  description: string;
  /** 更新日志 */
  changelog: string;
  /** 发布时间 */
  publishedAt?: string;
  /** 下载次数 */
  downloads?: number;
  /** 是否为最新版本 */
  isLatest?: boolean;
}

/**
 * 适配器上传表单数据
 */
export interface AdapterUploadFormData {
  /** 元数据 */
  metadata: AdapterMetadata;
  /** 版本信息 */
  version: AdapterVersion;
  /** 适配器文件 */
  files: File[];
  /** 图标文件 */
  icon?: File;
  /** 截图文件 */
  screenshots?: File[];
}

/**
 * 适配器上传响应
 */
export interface AdapterUploadResponse {
  /** 适配器ID */
  id: string;
  /** 版本ID */
  versionId: string;
  /** 上传状态 */
  status: 'pending' | 'processing' | 'published' | 'failed';
  /** 消息 */
  message?: string;
}

/**
 * 文件上传进度
 */
export interface UploadProgress {
  /** 已上传字节数 */
  loaded: number;
  /** 总字节数 */
  total: number;
  /** 上传百分比 */
  percentage: number;
}

/**
 * 适配器实体
 */
export interface Adapter {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  adapterType: AdapterType;
  category: AdapterCategory;
  tags: string[];
  authorId: string;
  authorName: string;
  iconUrl?: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  latestVersion: string;
  createdAt: string;
  updatedAt: string;
  compatibility: CompatibilityPlatform[];
  capabilities: AdapterCapability[];
  systemRequirements: SystemRequirements;
  permissions: PermissionRequirements;
  dependencies: AdapterDependency[];
  isFeatured: boolean;
  isVerified: boolean;
}

