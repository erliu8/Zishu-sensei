/**
 * Live2D模型类型定义
 * @module features/adapter/domain
 */

import { DeploymentLocation, DeploymentConfig } from './adapter.types';

/**
 * Live2D模型分类
 */
export enum Live2DModelCategory {
  /** 角色模型 */
  CHARACTER = 'character',
  /** 表情模型 */
  EXPRESSION = 'expression',
  /** 动作模型 */
  MOTION = 'motion',
}

/**
 * Live2D模型状态
 */
export enum Live2DModelStatus {
  /** 草稿 */
  DRAFT = 'draft',
  /** 已发布 */
  PUBLISHED = 'published',
  /** 已下架 */
  ARCHIVED = 'archived',
}

/**
 * Live2D模型作者信息
 */
export interface Live2DModelAuthor {
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
 * Live2D模型统计信息
 */
export interface Live2DModelStats {
  /** 下载次数 */
  downloads: number;
  /** 点赞数 */
  likes: number;
  /** 收藏数 */
  favorites: number;
  /** 浏览次数 */
  views: number;
}

/**
 * Live2D模型配置
 */
export interface Live2DModelConfig {
  /** 模型版本（cubism 2.x, 3.x, 4.x等） */
  cubismVersion?: string;
  /** 默认表情 */
  defaultExpression?: string;
  /** 默认动作 */
  defaultMotion?: string;
  /** 可用表情列表 */
  expressions?: string[];
  /** 可用动作列表 */
  motions?: string[];
  /** 额外配置 */
  extra?: Record<string, any>;
}

/**
 * Live2D模型主模型
 */
export interface Live2DModel {
  /** 模型ID */
  id: string;
  /** 模型名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 分类 */
  category: Live2DModelCategory;
  /** 标签 */
  tags: string[];
  /** 作者 */
  author: Live2DModelAuthor;
  /** 封面图片 */
  coverImage?: string;
  /** 预览图片 */
  previewImages?: string[];
  /** 演示视频 */
  demoVideo?: string;
  /** 许可证 */
  license: string;
  /** 状态 */
  status: Live2DModelStatus;
  /** 版本 */
  version: string;
  /** 统计信息 */
  stats: Live2DModelStats;
  /** 模型配置 */
  modelConfig: Live2DModelConfig;
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
}

/**
 * 创建Live2D模型输入
 */
export interface CreateLive2DModelInput {
  /** 模型名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description: string;
  /** 分类 */
  category: Live2DModelCategory;
  /** 标签 */
  tags: string[];
  /** 封面图片 */
  coverImage?: File | string;
  /** 预览图片 */
  previewImages?: (File | string)[];
  /** 演示视频 */
  demoVideo?: string;
  /** 许可证 */
  license: string;
  /** 模型配置 */
  modelConfig: Live2DModelConfig;
  /** 部署位置 */
  deploymentLocation: DeploymentLocation;
  /** 本地路径（当deploymentLocation为LOCAL时必填） */
  localPath?: string;
  /** 模型文件（当deploymentLocation为CLOUD时上传） */
  modelFile?: File;
}

/**
 * Live2D模型查询参数
 */
export interface Live2DModelQueryParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 分类 */
  category?: Live2DModelCategory;
  /** 标签 */
  tags?: string[];
  /** 搜索关键词 */
  search?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'downloads' | 'likes' | 'name';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 状态 */
  status?: Live2DModelStatus;
  /** 作者ID */
  authorId?: string;
}

/**
 * Live2D模型列表响应
 */
export interface Live2DModelListResponse {
  /** 数据列表 */
  data: Live2DModel[];
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

