/**
 * 适配器领域模型类型定义
 * @module features/adapter/domain
 */

/**
 * 适配器类型枚举
 */
export enum AdapterType {
  /** 软适配器 - 基于提示词工程和RAG技术 */
  SOFT = 'soft',
  /** 硬适配器 - 基于原生代码实现 */
  HARD = 'hard',
  /** 智能硬适配器 - 基于专业微调模型 */
  INTELLIGENT = 'intelligent',
}

/**
 * 适配器能力等级
 */
export enum CapabilityLevel {
  /** 基础能力 */
  BASIC = 'basic',
  /** 中级能力 */
  INTERMEDIATE = 'intermediate',
  /** 高级能力 */
  ADVANCED = 'advanced',
  /** 专家级能力 */
  EXPERT = 'expert',
}

/**
 * 适配器状态
 */
export enum AdapterStatus {
  /** 草稿 */
  DRAFT = 'draft',
  /** 已发布 */
  PUBLISHED = 'published',
  /** 已下架 */
  ARCHIVED = 'archived',
  /** 审核中 */
  PENDING_REVIEW = 'pending_review',
  /** 已拒绝 */
  REJECTED = 'rejected',
}

/**
 * 兼容性级别
 */
export enum CompatibilityLevel {
  /** 完全兼容 */
  FULL = 'full',
  /** 部分兼容 */
  PARTIAL = 'partial',
  /** 不兼容 */
  INCOMPATIBLE = 'incompatible',
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
  /** 示例 */
  examples?: string[];
}

/**
 * 系统要求
 */
export interface SystemRequirements {
  /** 最小内存要求（MB） */
  minMemory?: number;
  /** 最小磁盘空间（MB） */
  minDiskSpace?: number;
  /** 支持的操作系统 */
  supportedOS?: string[];
  /** Python版本要求 */
  pythonVersion?: string;
  /** Node.js版本要求 */
  nodeVersion?: string;
  /** GPU要求 */
  gpuRequired?: boolean;
  /** 其他要求 */
  other?: Record<string, any>;
}

/**
 * 权限需求
 */
export interface PermissionRequirements {
  /** 文件系统访问 */
  fileSystemAccess?: 'none' | 'read' | 'write' | 'full';
  /** 网络访问 */
  networkAccess?: boolean;
  /** 系统API访问 */
  systemApiAccess?: boolean;
  /** 桌面操作权限 */
  desktopControl?: boolean;
  /** 代码执行权限 */
  codeExecution?: boolean;
  /** 其他权限 */
  customPermissions?: string[];
}

/**
 * 适配器作者信息
 */
export interface AdapterAuthor {
  /** 用户ID */
  id: string;
  /** 用户名 */
  username: string;
  /** 显示名称 */
  displayName: string;
  /** 头像 */
  avatar?: string;
  /** 邮箱 */
  email?: string;
  /** 个人简介 */
  bio?: string;
}

/**
 * 适配器统计信息
 */
export interface AdapterStats {
  /** 下载次数 */
  downloads: number;
  /** 点赞数 */
  likes: number;
  /** 收藏数 */
  favorites: number;
  /** 评分 */
  rating: number;
  /** 评分人数 */
  ratingCount: number;
  /** 浏览次数 */
  views: number;
  /** 评论数 */
  comments: number;
  /** 分享数 */
  shares: number;
}

/**
 * 适配器分类
 */
export interface AdapterCategory {
  /** 分类ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类标识 */
  slug: string;
  /** 描述 */
  description?: string;
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: string;
  /** 父分类ID */
  parentId?: string;
  /** 排序权重 */
  order: number;
  /** 适配器数量 */
  adapterCount?: number;
}

/**
 * 适配器依赖
 */
export interface AdapterDependency {
  /** 依赖ID */
  id: string;
  /** 被依赖的适配器ID */
  dependencyId: string;
  /** 被依赖的适配器名称 */
  dependencyName: string;
  /** 版本要求 */
  versionRequirement: string;
  /** 是否必需 */
  required: boolean;
  /** 依赖类型 */
  type: 'runtime' | 'development' | 'peer' | 'optional';
  /** 依赖描述 */
  description?: string;
}

/**
 * 适配器版本
 */
export interface AdapterVersion {
  /** 版本ID */
  id: string;
  /** 适配器ID */
  adapterId: string;
  /** 版本号 */
  version: string;
  /** 版本描述 */
  description: string;
  /** 更新日志 */
  changelog?: string;
  /** 下载URL */
  downloadUrl: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 文件哈希值 */
  fileHash: string;
  /** 依赖列表 */
  dependencies: AdapterDependency[];
  /** 系统要求 */
  systemRequirements: SystemRequirements;
  /** 权限需求 */
  permissions: PermissionRequirements;
  /** 发布时间 */
  publishedAt: string;
  /** 下载次数 */
  downloads: number;
  /** 是否稳定版本 */
  isStable: boolean;
  /** 是否最新版本 */
  isLatest: boolean;
  /** 兼容性信息 */
  compatibility?: {
    minPlatformVersion: string;
    maxPlatformVersion?: string;
    compatibilityLevel: CompatibilityLevel;
  };
}

/**
 * 适配器评分
 */
export interface AdapterRating {
  /** 评分ID */
  id: string;
  /** 适配器ID */
  adapterId: string;
  /** 用户ID */
  userId: string;
  /** 用户名 */
  username: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 评分（1-5星） */
  rating: number;
  /** 评论内容 */
  comment?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 点赞数 */
  likes: number;
  /** 是否已验证购买 */
  verified: boolean;
}

/**
 * 适配器主模型
 */
export interface Adapter {
  /** 适配器ID */
  id: string;
  /** 适配器名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 适配器类型 */
  type: AdapterType;
  /** 版本 */
  version: string;
  /** 描述 */
  description: string;
  /** 详细说明 */
  readme?: string;
  /** 作者 */
  author: AdapterAuthor;
  /** 分类 */
  category: AdapterCategory;
  /** 标签 */
  tags: string[];
  /** 能力列表 */
  capabilities: AdapterCapability[];
  /** 图标 */
  icon?: string;
  /** 封面图片 */
  coverImage?: string;
  /** 截图 */
  screenshots?: string[];
  /** 演示视频 */
  demoVideo?: string;
  /** 仓库URL */
  repositoryUrl?: string;
  /** 文档URL */
  documentationUrl?: string;
  /** 主页URL */
  homepageUrl?: string;
  /** 许可证 */
  license: string;
  /** 状态 */
  status: AdapterStatus;
  /** 统计信息 */
  stats: AdapterStats;
  /** 系统要求 */
  systemRequirements: SystemRequirements;
  /** 权限需求 */
  permissions: PermissionRequirements;
  /** 最新版本 */
  latestVersion?: AdapterVersion;
  /** 所有版本 */
  versions?: AdapterVersion[];
  /** 依赖列表 */
  dependencies: AdapterDependency[];
  /** 兼容性信息 */
  compatibility?: {
    minPlatformVersion: string;
    maxPlatformVersion?: string;
    compatibilityLevel: CompatibilityLevel;
  };
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 发布时间 */
  publishedAt?: string;
  /** 是否已安装 */
  isInstalled?: boolean;
  /** 是否已收藏 */
  isFavorited?: boolean;
  /** 是否已点赞 */
  isLiked?: boolean;
  /** 用户评分 */
  userRating?: number;
}

/**
 * 创建适配器输入
 */
export interface CreateAdapterInput {
  /** 适配器名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 适配器类型 */
  type: AdapterType;
  /** 描述 */
  description: string;
  /** 详细说明 */
  readme?: string;
  /** 分类ID */
  categoryId: string;
  /** 标签 */
  tags: string[];
  /** 能力列表 */
  capabilities: AdapterCapability[];
  /** 图标 */
  icon?: string;
  /** 封面图片 */
  coverImage?: string;
  /** 截图 */
  screenshots?: string[];
  /** 演示视频 */
  demoVideo?: string;
  /** 仓库URL */
  repositoryUrl?: string;
  /** 文档URL */
  documentationUrl?: string;
  /** 主页URL */
  homepageUrl?: string;
  /** 许可证 */
  license: string;
  /** 系统要求 */
  systemRequirements: SystemRequirements;
  /** 权限需求 */
  permissions: PermissionRequirements;
  /** 初始版本信息 */
  initialVersion?: {
    version: string;
    description: string;
    changelog?: string;
    file: File;
  };
}

/**
 * 更新适配器输入
 */
export interface UpdateAdapterInput extends Partial<Omit<CreateAdapterInput, 'name' | 'type'>> {
  /** 适配器ID */
  id: string;
}

/**
 * 适配器查询参数
 */
export interface AdapterQueryParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 分类ID */
  categoryId?: string;
  /** 适配器类型 */
  type?: AdapterType;
  /** 标签 */
  tags?: string[];
  /** 搜索关键词 */
  search?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'downloads' | 'rating' | 'likes' | 'name';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 状态 */
  status?: AdapterStatus;
  /** 作者ID */
  authorId?: string;
  /** 能力等级 */
  capabilityLevel?: CapabilityLevel;
  /** 是否只显示兼容的 */
  compatibleOnly?: boolean;
}

/**
 * 适配器列表响应
 */
export interface AdapterListResponse {
  /** 数据列表 */
  data: Adapter[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrevious: boolean;
}

/**
 * 创建版本输入
 */
export interface CreateVersionInput {
  /** 适配器ID */
  adapterId: string;
  /** 版本号 */
  version: string;
  /** 版本描述 */
  description: string;
  /** 更新日志 */
  changelog?: string;
  /** 文件 */
  file: File;
  /** 依赖列表 */
  dependencies?: AdapterDependency[];
  /** 系统要求 */
  systemRequirements?: SystemRequirements;
  /** 权限需求 */
  permissions?: PermissionRequirements;
  /** 是否稳定版本 */
  isStable?: boolean;
}

/**
 * 创建评分输入
 */
export interface CreateRatingInput {
  /** 适配器ID */
  adapterId: string;
  /** 评分（1-5星） */
  rating: number;
  /** 评论内容 */
  comment?: string;
}

/**
 * 更新评分输入
 */
export interface UpdateRatingInput {
  /** 评分ID */
  id: string;
  /** 评分（1-5星） */
  rating?: number;
  /** 评论内容 */
  comment?: string;
}

/**
 * API响应包装
 */
export interface ApiResponse<T> {
  /** 成功标识 */
  success: boolean;
  /** 响应数据 */
  data: T;
  /** 消息 */
  message?: string;
  /** 错误代码 */
  code?: number;
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 排序参数
 */
export interface SortParams {
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 适配器安装状态
 */
export interface AdapterInstallStatus {
  /** 适配器ID */
  adapterId: string;
  /** 是否已安装 */
  isInstalled: boolean;
  /** 已安装版本 */
  installedVersion?: string;
  /** 最新版本 */
  latestVersion: string;
  /** 是否有更新 */
  hasUpdate: boolean;
  /** 安装时间 */
  installedAt?: string;
}

/**
 * 适配器搜索建议
 */
export interface AdapterSearchSuggestion {
  /** 建议文本 */
  text: string;
  /** 建议类型 */
  type: 'name' | 'tag' | 'category' | 'author';
  /** 匹配数量 */
  count?: number;
}

