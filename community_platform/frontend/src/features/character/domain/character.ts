/**
 * 角色领域模型
 */

import type { 
  CharacterStatus, 
  CharacterVisibility, 
  AdapterReference 
} from '../types';
import type { Personality } from './personality';
import type { Expression } from './expression';
import type { Voice } from './voice';
import type { Model } from './model';

/**
 * 角色统计信息
 */
export interface CharacterStats {
  /** 下载次数 */
  downloads: number;
  /** 收藏次数 */
  favorites: number;
  /** 点赞次数 */
  likes: number;
  /** 评论次数 */
  comments: number;
  /** 评分 (0-5) */
  rating: number;
  /** 评分人数 */
  ratingCount: number;
  /** 浏览次数 */
  views: number;
}

/**
 * 角色模型接口
 */
export interface Character {
  /** 角色ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色显示名称（可能包含特殊字符） */
  displayName: string;
  /** 角色描述 */
  description: string;
  /** 角色头像URL */
  avatarUrl?: string;
  /** 角色封面图URL */
  coverUrl?: string;
  /** 角色标签 */
  tags: string[];
  /** 角色状态 */
  status: CharacterStatus;
  /** 可见性 */
  visibility: CharacterVisibility;
  /** 创建者ID */
  creatorId: string;
  /** 创建者名称 */
  creatorName?: string;
  
  /** 关联的适配器列表 */
  adapters: AdapterReference[];
  
  /** 人格配置（可选，可能需要单独加载） */
  personality?: Personality;
  /** 表情列表（可选，可能需要单独加载） */
  expressions?: Expression[];
  /** 语音列表（可选，可能需要单独加载） */
  voices?: Voice[];
  /** 模型列表（可选，可能需要单独加载） */
  models?: Model[];
  
  /** 统计信息 */
  stats: CharacterStats;
  
  /** 版本号 */
  version: string;
  /** 是否已发布 */
  published: boolean;
  /** 发布时间 */
  publishedAt?: string;
  
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 创建角色的输入数据
 */
export interface CreateCharacterInput {
  name: string;
  displayName?: string;
  description: string;
  avatarUrl?: string;
  coverUrl?: string;
  tags?: string[];
  visibility?: CharacterVisibility;
  adapters?: AdapterReference[];
  version?: string;
}

/**
 * 更新角色的输入数据
 */
export interface UpdateCharacterInput {
  name?: string;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  coverUrl?: string;
  tags?: string[];
  status?: CharacterStatus;
  visibility?: CharacterVisibility;
  adapters?: AdapterReference[];
  version?: string;
}

/**
 * 发布角色的输入数据
 */
export interface PublishCharacterInput {
  /** 发布说明 */
  releaseNotes?: string;
  /** 是否为主要版本更新 */
  isMajorRelease?: boolean;
}

/**
 * 角色查询筛选条件
 */
export interface CharacterFilters {
  /** 搜索关键词 */
  search?: string;
  /** 标签筛选 */
  tags?: string[];
  /** 状态筛选 */
  status?: CharacterStatus;
  /** 可见性筛选 */
  visibility?: CharacterVisibility;
  /** 创建者ID */
  creatorId?: string;
  /** 适配器类型筛选 */
  adapterTypes?: string[];
  /** 是否只显示已发布 */
  publishedOnly?: boolean;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'downloads' | 'rating' | 'likes';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 分页：页码 */
  page?: number;
  /** 分页：每页数量 */
  pageSize?: number;
}

/**
 * 角色领域模型类
 */
export class CharacterModel implements Character {
  id: string;
  name: string;
  displayName: string;
  description: string;
  avatarUrl?: string;
  coverUrl?: string;
  tags: string[];
  status: CharacterStatus;
  visibility: CharacterVisibility;
  creatorId: string;
  creatorName?: string;
  adapters: AdapterReference[];
  personality?: Personality;
  expressions?: Expression[];
  voices?: Voice[];
  models?: Model[];
  stats: CharacterStats;
  version: string;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;

  constructor(data: Character) {
    this.id = data.id;
    this.name = data.name;
    this.displayName = data.displayName;
    this.description = data.description;
    this.avatarUrl = data.avatarUrl;
    this.coverUrl = data.coverUrl;
    this.tags = data.tags;
    this.status = data.status;
    this.visibility = data.visibility;
    this.creatorId = data.creatorId;
    this.creatorName = data.creatorName;
    this.adapters = data.adapters;
    this.personality = data.personality;
    this.expressions = data.expressions;
    this.voices = data.voices;
    this.models = data.models;
    this.stats = data.stats;
    this.version = data.version;
    this.published = data.published;
    this.publishedAt = data.publishedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * 检查是否为草稿状态
   */
  isDraft(): boolean {
    return this.status === CharacterStatus.DRAFT;
  }

  /**
   * 检查是否已发布
   */
  isPublished(): boolean {
    return this.status === CharacterStatus.PUBLISHED && this.published;
  }

  /**
   * 检查是否已归档
   */
  isArchived(): boolean {
    return this.status === CharacterStatus.ARCHIVED;
  }

  /**
   * 检查是否为公开角色
   */
  isPublic(): boolean {
    return this.visibility === CharacterVisibility.PUBLIC;
  }

  /**
   * 检查是否为私有角色
   */
  isPrivate(): boolean {
    return this.visibility === CharacterVisibility.PRIVATE;
  }

  /**
   * 获取启用的适配器列表
   */
  getEnabledAdapters(): AdapterReference[] {
    return this.adapters.filter((adapter) => adapter.enabled);
  }

  /**
   * 根据类型获取适配器
   */
  getAdaptersByType(type: string): AdapterReference[] {
    return this.adapters.filter((adapter) => adapter.type === type);
  }

  /**
   * 获取软适配器
   */
  getSoftAdapters(): AdapterReference[] {
    return this.getAdaptersByType('soft');
  }

  /**
   * 获取硬适配器
   */
  getHardAdapters(): AdapterReference[] {
    return this.getAdaptersByType('hard');
  }

  /**
   * 获取智能硬适配器
   */
  getIntelligentAdapters(): AdapterReference[] {
    return this.getAdaptersByType('intelligent');
  }

  /**
   * 获取默认语音
   */
  getDefaultVoice(): Voice | undefined {
    return this.voices?.find((voice) => voice.isDefault);
  }

  /**
   * 获取默认模型
   */
  getDefaultModel(): Model | undefined {
    return this.models?.find((model) => model.isDefault);
  }

  /**
   * 获取启用的表情列表
   */
  getEnabledExpressions(): Expression[] {
    return this.expressions?.filter((expr) => expr.enabled) || [];
  }

  /**
   * 根据触发条件获取表情
   */
  getExpressionByTrigger(trigger: string): Expression | undefined {
    return this.expressions?.find(
      (expr) => expr.trigger === trigger && expr.enabled
    );
  }

  /**
   * 检查是否配置完整（可以发布）
   */
  isReadyToPublish(): { ready: boolean; missingItems: string[] } {
    const missingItems: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      missingItems.push('name');
    }

    if (!this.description || this.description.trim().length === 0) {
      missingItems.push('description');
    }

    if (!this.personality) {
      missingItems.push('personality');
    }

    if (!this.voices || this.voices.length === 0) {
      missingItems.push('voice');
    }

    if (!this.models || this.models.length === 0) {
      missingItems.push('model');
    }

    if (this.adapters.length === 0) {
      missingItems.push('adapters');
    }

    return {
      ready: missingItems.length === 0,
      missingItems,
    };
  }

  /**
   * 获取完整度百分比
   */
  getCompletionPercentage(): number {
    const checkItems = [
      this.name && this.name.trim().length > 0,
      this.description && this.description.trim().length > 0,
      this.avatarUrl,
      this.personality,
      this.voices && this.voices.length > 0,
      this.models && this.models.length > 0,
      this.expressions && this.expressions.length > 0,
      this.adapters.length > 0,
      this.tags.length > 0,
    ];

    const completedCount = checkItems.filter(Boolean).length;
    return Math.round((completedCount / checkItems.length) * 100);
  }

  /**
   * 验证角色数据
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Character name is required');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Character name must be less than 100 characters');
    }

    if (!this.description || this.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (this.description && this.description.length > 2000) {
      errors.push('Description must be less than 2000 characters');
    }

    if (this.tags.length > 20) {
      errors.push('Maximum 20 tags allowed');
    }

    if (this.adapters.length > 50) {
      errors.push('Maximum 50 adapters allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 转换为普通对象
   */
  toJSON(): Character {
    return {
      id: this.id,
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      avatarUrl: this.avatarUrl,
      coverUrl: this.coverUrl,
      tags: this.tags,
      status: this.status,
      visibility: this.visibility,
      creatorId: this.creatorId,
      creatorName: this.creatorName,
      adapters: this.adapters,
      personality: this.personality,
      expressions: this.expressions,
      voices: this.voices,
      models: this.models,
      stats: this.stats,
      version: this.version,
      published: this.published,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

