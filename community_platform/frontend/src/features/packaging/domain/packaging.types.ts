/**
 * Packaging Domain Types
 * 打包服务领域类型定义
 */

/**
 * 打包任务状态
 */
export enum PackagingStatus {
  /** 等待中 */
  PENDING = 'pending',
  /** 队列中 */
  QUEUED = 'queued',
  /** 打包中 */
  PACKAGING = 'packaging',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 失败 */
  FAILED = 'failed',
  /** 已取消 */
  CANCELLED = 'cancelled',
}

/**
 * 打包平台类型
 */
export enum PackagingPlatform {
  /** Windows */
  WINDOWS = 'windows',
  /** macOS */
  MACOS = 'macos',
  /** Linux */
  LINUX = 'linux',
  /** Android */
  ANDROID = 'android',
  /** iOS */
  IOS = 'ios',
  /** Web */
  WEB = 'web',
}

/**
 * 打包架构
 */
export enum PackagingArchitecture {
  /** x64 */
  X64 = 'x64',
  /** x86 */
  X86 = 'x86',
  /** ARM64 */
  ARM64 = 'arm64',
  /** ARM */
  ARM = 'arm',
  /** Universal (macOS) */
  UNIVERSAL = 'universal',
}

/**
 * 打包格式
 */
export enum PackagingFormat {
  /** ZIP */
  ZIP = 'zip',
  /** EXE */
  EXE = 'exe',
  /** DMG */
  DMG = 'dmg',
  /** APP */
  APP = 'app',
  /** DEB */
  DEB = 'deb',
  /** RPM */
  RPM = 'rpm',
  /** APK */
  APK = 'apk',
  /** IPA */
  IPA = 'ipa',
  /** TAR_GZ */
  TAR_GZ = 'tar.gz',
}

/**
 * 打包配置
 */
export interface PackageConfig {
  /** 配置ID */
  id?: string;
  /** 应用名称 */
  appName: string;
  /** 应用版本 */
  version: string;
  /** 应用描述 */
  description?: string;
  /** 应用图标 */
  icon?: string;
  /** 角色ID */
  characterId: string;
  /** 适配器ID列表 */
  adapterIds: string[];
  /** 打包平台 */
  platform: PackagingPlatform;
  /** 打包架构 */
  architecture: PackagingArchitecture;
  /** 打包格式 */
  format: PackagingFormat;
  /** 是否包含资源 */
  includeAssets: boolean;
  /** 是否压缩 */
  compress: boolean;
  /** 压缩级别 (0-9) */
  compressionLevel?: number;
  /** 是否代码混淆 */
  obfuscate: boolean;
  /** 自定义配置 */
  customConfig?: Record<string, any>;
  /** 环境变量 */
  environmentVariables?: Record<string, string>;
  /** 启动参数 */
  launchArgs?: string[];
  /** 创建时间 */
  createdAt?: Date;
  /** 更新时间 */
  updatedAt?: Date;
}

/**
 * 打包任务
 */
export interface PackagingTask {
  /** 任务ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 打包配置 */
  config: PackageConfig;
  /** 任务状态 */
  status: PackagingStatus;
  /** 进度 (0-100) */
  progress: number;
  /** 当前步骤 */
  currentStep?: string;
  /** 总步骤数 */
  totalSteps?: number;
  /** 错误信息 */
  error?: string;
  /** 警告信息 */
  warnings?: string[];
  /** 下载URL */
  downloadUrl?: string;
  /** 文件大小（字节） */
  fileSize?: number;
  /** 文件哈希 */
  fileHash?: string;
  /** 开始时间 */
  startedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 过期时间 */
  expiresAt?: Date;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 打包进度更新
 */
export interface PackagingProgressUpdate {
  /** 任务ID */
  taskId: string;
  /** 状态 */
  status: PackagingStatus;
  /** 进度 */
  progress: number;
  /** 当前步骤 */
  currentStep?: string;
  /** 步骤索引 */
  stepIndex?: number;
  /** 总步骤数 */
  totalSteps?: number;
  /** 消息 */
  message?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 创建打包任务输入
 */
export interface CreatePackageInput {
  /** 打包配置 */
  config: Omit<PackageConfig, 'id' | 'createdAt' | 'updatedAt'>;
  /** 是否立即执行 */
  immediate?: boolean;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high';
}

/**
 * 打包任务查询参数
 */
export interface PackagingTaskQueryParams {
  /** 用户ID */
  userId?: string;
  /** 状态筛选 */
  status?: PackagingStatus | PackagingStatus[];
  /** 平台筛选 */
  platform?: PackagingPlatform;
  /** 页码 */
  page?: number;
  /** 每页大小 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'completedAt' | 'progress';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 搜索关键词 */
  search?: string;
  /** 开始日期 */
  startDate?: Date;
  /** 结束日期 */
  endDate?: Date;
}

/**
 * 打包任务统计
 */
export interface PackagingTaskStats {
  /** 总任务数 */
  totalTasks: number;
  /** 已完成任务数 */
  completedTasks: number;
  /** 失败任务数 */
  failedTasks: number;
  /** 进行中任务数 */
  inProgressTasks: number;
  /** 等待中任务数 */
  pendingTasks: number;
  /** 成功率 */
  successRate: number;
  /** 平均完成时间（秒） */
  avgCompletionTime: number;
  /** 总文件大小（字节） */
  totalFileSize: number;
}

/**
 * 打包模板
 */
export interface PackagingTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description?: string;
  /** 模板配置 */
  config: Partial<PackageConfig>;
  /** 是否为默认模板 */
  isDefault: boolean;
  /** 是否为公共模板 */
  isPublic: boolean;
  /** 创建者ID */
  creatorId: string;
  /** 使用次数 */
  usageCount: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 打包预设
 */
export interface PackagingPreset {
  /** 预设名称 */
  name: string;
  /** 平台 */
  platform: PackagingPlatform;
  /** 架构 */
  architecture: PackagingArchitecture;
  /** 格式 */
  format: PackagingFormat;
  /** 推荐配置 */
  recommendedConfig: Partial<PackageConfig>;
}

/**
 * 打包日志
 */
export interface PackagingLog {
  /** 日志ID */
  id: string;
  /** 任务ID */
  taskId: string;
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 日志消息 */
  message: string;
  /** 日志详情 */
  details?: any;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 下载选项
 */
export interface DownloadOptions {
  /** 任务ID */
  taskId: string;
  /** 是否自动下载 */
  autoDownload?: boolean;
  /** 文件名 */
  filename?: string;
}

