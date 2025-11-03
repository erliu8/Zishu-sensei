/**
 * 桌面应用下载相关类型定义
 */

/**
 * 平台类型
 */
export enum Platform {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
}

/**
 * 打包状态
 */
export enum PackagingStatus {
  PENDING = 'pending',
  PACKAGING = 'packaging',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 打包配置
 */
export interface PackagingConfig {
  /** 应用名称 */
  app_name: string;
  /** 版本号 */
  version: string;
  /** AI模型列表（默认为空） */
  models: string[];
  /** 适配器ID列表（默认为空） */
  adapters: string[];
  /** 角色配置（默认使用紫舒Live2D） */
  character?: {
    id: string;
    name: string;
    model_type: string;
  };
  /** 应用设置 */
  settings: Record<string, any>;
  /** 品牌定制 */
  branding?: Record<string, any>;
}

/**
 * 创建打包任务请求
 */
export interface CreatePackagingTaskRequest {
  config: PackagingConfig;
  platform: Platform;
}

/**
 * 打包任务
 */
export interface PackagingTask {
  id: string;
  user_id: number;
  config: PackagingConfig;
  platform: Platform;
  status: PackagingStatus;
  progress: number;
  download_url?: string;
  file_size?: number;
  file_hash?: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * 打包任务状态
 */
export interface PackagingTaskStatus {
  id: string;
  status: PackagingStatus;
  progress: number;
  download_url?: string;
  error_message?: string;
}

/**
 * 平台下载信息
 */
export interface PlatformDownloadInfo {
  id: Platform;
  name: string;
  icon: React.ReactNode;
  description: string;
  architectures: string[];
  requirements: {
    os: string;
    cpu: string;
    memory: string;
    storage: string;
  };
}

