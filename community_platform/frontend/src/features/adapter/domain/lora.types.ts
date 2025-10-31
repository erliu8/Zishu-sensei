/**
 * Lora适配器类型定义
 * @module features/adapter/domain
 */

import { DeploymentLocation, DeploymentConfig } from './adapter.types';

/**
 * Lora适配器状态
 */
export enum LoraAdapterStatus {
  /** 草稿 */
  DRAFT = 'draft',
  /** 已发布 */
  PUBLISHED = 'published',
  /** 已下架 */
  ARCHIVED = 'archived',
}

/**
 * 基础模型类型
 */
export interface BaseModel {
  /** 模型ID */
  id: string;
  /** 模型名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 模型提供商 */
  provider: string;
  /** 版本 */
  version?: string;
  /** 描述 */
  description?: string;
}

/**
 * Lora适配器作者信息
 */
export interface LoraAdapterAuthor {
  /** 用户ID */
  id: string;
  /** 用户名 */
  username: string;
  /** 显示名称 */
  displayName: string;
  /** 头像 */
  avatar?: string;
}

/**
 * Lora适配器统计信息
 */
export interface LoraAdapterStats {
  /** 下载次数 */
  downloads: number;
  /** 点赞数 */
  likes: number;
  /** 收藏数 */
  favorites: number;
  /** 浏览次数 */
  views: number;
  /** 评分 */
  rating: number;
  /** 评分人数 */
  ratingCount: number;
}

/**
 * Lora适配器配置
 */
export interface LoraAdapterConfig {
  /** 训练参数 */
  trainingParams?: {
    /** Rank */
    rank?: number;
    /** Alpha */
    alpha?: number;
    /** 其他参数 */
    [key: string]: any;
  };
  /** 微调数据集信息 */
  datasetInfo?: {
    /** 数据集名称 */
    name?: string;
    /** 数据集大小 */
    size?: number;
    /** 数据集描述 */
    description?: string;
  };
  /** 额外配置 */
  extra?: Record<string, any>;
}

/**
 * Lora适配器主模型
 */
export interface LoraAdapter {
  /** Lora适配器ID */
  id: string;
  /** Lora适配器名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 详细说明 */
  readme?: string;
  /** 基础模型 */
  baseModel: BaseModel;
  /** 标签 */
  tags: string[];
  /** 作者 */
  author: LoraAdapterAuthor;
  /** 封面图片 */
  coverImage?: string;
  /** 截图 */
  screenshots?: string[];
  /** 演示视频 */
  demoVideo?: string;
  /** 许可证 */
  license: string;
  /** 状态 */
  status: LoraAdapterStatus;
  /** 版本 */
  version: string;
  /** 统计信息 */
  stats: LoraAdapterStats;
  /** Lora配置 */
  loraConfig: LoraAdapterConfig;
  /** 部署配置 */
  deployment: DeploymentConfig;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 发布时间 */
  publishedAt?: string;
  /** 是否已收藏 */
  isFavorited?: boolean;
  /** 是否已点赞 */
  isLiked?: boolean;
  /** 用户评分 */
  userRating?: number;
}

/**
 * 创建Lora适配器输入
 */
export interface CreateLoraAdapterInput {
  /** Lora适配器名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 详细说明 */
  readme?: string;
  /** 基础模型ID */
  baseModelId: string;
  /** 标签 */
  tags: string[];
  /** 封面图片 */
  coverImage?: File | string;
  /** 截图 */
  screenshots?: (File | string)[];
  /** 演示视频 */
  demoVideo?: string;
  /** 许可证 */
  license: string;
  /** Lora配置 */
  loraConfig: LoraAdapterConfig;
  /** 部署位置 */
  deploymentLocation: DeploymentLocation;
  /** 本地路径（当deploymentLocation为LOCAL时必填） */
  localPath?: string;
  /** Lora文件（当deploymentLocation为CLOUD时上传） */
  loraFile?: File;
}

/**
 * Lora适配器查询参数
 */
export interface LoraAdapterQueryParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 基础模型ID */
  baseModelId?: string;
  /** 标签 */
  tags?: string[];
  /** 搜索关键词 */
  search?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'downloads' | 'rating' | 'likes' | 'name';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 状态 */
  status?: LoraAdapterStatus;
  /** 作者ID */
  authorId?: string;
}

/**
 * Lora适配器列表响应
 */
export interface LoraAdapterListResponse {
  /** 数据列表 */
  data: LoraAdapter[];
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

