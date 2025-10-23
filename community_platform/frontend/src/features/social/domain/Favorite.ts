/**
 * Favorite Domain Model
 * 收藏领域模型
 */

/**
 * 收藏目标类型
 */
export enum FavoriteTargetType {
  /** 帖子 */
  POST = 'post',
  /** 适配器 */
  ADAPTER = 'adapter',
  /** 角色 */
  CHARACTER = 'character',
}

/**
 * 收藏实体
 */
export interface Favorite {
  /** 收藏ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 目标类型 */
  targetType: FavoriteTargetType;
  /** 目标ID */
  targetId: string;
  /** 收藏夹ID（可选） */
  collectionId?: string;
  /** 备注（可选） */
  note?: string;
  /** 标签（可选） */
  tags?: string[];
  /** 收藏时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 用户信息（可选） */
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  /** 目标信息（可选） */
  target?: any;
  /** 帖子信息（当targetType为POST时） */
  targetPost?: {
    id: string;
    title: string;
    content?: string;
    tags?: string[];
    likeCount?: number;
    commentCount?: number;
    viewCount?: number;
    author?: {
      id: string;
      username: string;
      displayName: string;
      avatar?: string;
    };
  };
  /** 适配器信息（当targetType为ADAPTER时） */
  targetAdapter?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    latestVersion?: string;
    downloadCount?: number;
    rating?: number;
    author?: {
      id: string;
      username: string;
      displayName: string;
      avatar?: string;
    };
  };
  /** 角色信息（当targetType为CHARACTER时） */
  targetCharacter?: {
    id: string;
    name: string;
    title?: string;
    description?: string;
    avatar?: string;
    personality?: {
      traits?: string[];
      mbti?: string;
    };
    likeCount?: number;
    commentCount?: number;
    author?: {
      id: string;
      username: string;
      displayName: string;
      avatar?: string;
    };
  };
}

/**
 * 创建收藏输入
 */
export interface CreateFavoriteInput {
  /** 目标类型 */
  targetType: FavoriteTargetType;
  /** 目标ID */
  targetId: string;
  /** 收藏夹ID（可选） */
  collectionId?: string;
  /** 备注（可选） */
  note?: string;
  /** 标签（可选） */
  tags?: string[];
}

/**
 * 更新收藏输入
 */
export interface UpdateFavoriteInput {
  /** 收藏ID */
  id: string;
  /** 收藏夹ID（可选） */
  collectionId?: string;
  /** 备注（可选） */
  note?: string;
  /** 标签（可选） */
  tags?: string[];
}

/**
 * 收藏统计
 */
export interface FavoriteStats {
  /** 收藏数 */
  favoriteCount: number;
  /** 是否已收藏 */
  isFavorited: boolean;
}

/**
 * 收藏查询参数
 */
export interface FavoriteQueryParams {
  /** 用户ID */
  userId?: string;
  /** 目标类型 */
  targetType?: FavoriteTargetType;
  /** 目标ID */
  targetId?: string;
  /** 收藏夹ID */
  collectionId?: string;
  /** 标签筛选 */
  tags?: string[];
  /** 搜索关键词 */
  search?: string;
  /** 页码 */
  page?: number;
  /** 每页大小 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 收藏夹
 */
export interface FavoriteCollection {
  /** 收藏夹ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: string;
  /** 是否公开 */
  isPublic: boolean;
  /** 收藏数量 */
  itemCount: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 创建收藏夹输入
 */
export interface CreateCollectionInput {
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: string;
  /** 是否公开 */
  isPublic?: boolean;
}

/**
 * Favorite Domain 工具函数
 */
export class FavoriteDomain {
  /**
   * 验证目标类型
   */
  static isValidTargetType(type: string): type is FavoriteTargetType {
    return Object.values(FavoriteTargetType).includes(type as FavoriteTargetType);
  }

  /**
   * 格式化收藏数量
   */
  static formatFavoriteCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * 获取目标类型显示名称
   */
  static getTargetTypeName(type: FavoriteTargetType): string {
    const names: Record<FavoriteTargetType, string> = {
      [FavoriteTargetType.POST]: '帖子',
      [FavoriteTargetType.ADAPTER]: '适配器',
      [FavoriteTargetType.CHARACTER]: '角色',
    };
    return names[type] || type;
  }

  /**
   * 获取目标类型图标
   */
  static getTargetTypeIcon(type: FavoriteTargetType): string {
    const icons: Record<FavoriteTargetType, string> = {
      [FavoriteTargetType.POST]: 'file-text',
      [FavoriteTargetType.ADAPTER]: 'puzzle',
      [FavoriteTargetType.CHARACTER]: 'user',
    };
    return icons[type] || 'bookmark';
  }

  /**
   * 创建收藏键（用于缓存）
   */
  static createFavoriteKey(targetType: FavoriteTargetType, targetId: string, userId?: string): string {
    return userId ? `favorite:${targetType}:${targetId}:${userId}` : `favorite:${targetType}:${targetId}`;
  }

  /**
   * 验证创建输入
   */
  static validateCreateInput(input: CreateFavoriteInput): { valid: boolean; error?: string } {
    if (!input.targetType || !this.isValidTargetType(input.targetType)) {
      return { valid: false, error: '无效的目标类型' };
    }
    if (!input.targetId || input.targetId.trim().length === 0) {
      return { valid: false, error: '无效的目标ID' };
    }
    if (input.note && input.note.length > 500) {
      return { valid: false, error: '备注长度不能超过500个字符' };
    }
    if (input.tags && input.tags.length > 10) {
      return { valid: false, error: '标签数量不能超过10个' };
    }
    return { valid: true };
  }

  /**
   * 验证收藏夹名称
   */
  static validateCollectionName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: '收藏夹名称不能为空' };
    }
    if (name.length > 50) {
      return { valid: false, error: '收藏夹名称不能超过50个字符' };
    }
    return { valid: true };
  }

  /**
   * 格式化收藏时间
   */
  static formatFavoriteTime(createdAt: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(createdAt).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 365) {
      return `${Math.floor(days / 365)} 年前收藏`;
    }
    if (days > 30) {
      return `${Math.floor(days / 30)} 个月前收藏`;
    }
    if (days > 0) {
      return `${days} 天前收藏`;
    }
    if (hours > 0) {
      return `${hours} 小时前收藏`;
    }
    if (minutes > 0) {
      return `${minutes} 分钟前收藏`;
    }
    return '刚刚收藏';
  }
}

