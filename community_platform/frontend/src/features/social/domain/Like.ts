/**
 * Like Domain Model
 * 点赞领域模型
 */

/**
 * 点赞目标类型
 */
export enum LikeTargetType {
  /** 帖子 */
  POST = 'post',
  /** 评论 */
  COMMENT = 'comment',
  /** 适配器 */
  ADAPTER = 'adapter',
  /** 角色 */
  CHARACTER = 'character',
}

/**
 * 点赞实体
 */
export interface Like {
  /** 点赞ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 目标类型 */
  targetType: LikeTargetType;
  /** 目标ID */
  targetId: string;
  /** 点赞时间 */
  createdAt: Date;
  /** 用户信息（可选） */
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
}

/**
 * 创建点赞输入
 */
export interface CreateLikeInput {
  /** 目标类型 */
  targetType: LikeTargetType;
  /** 目标ID */
  targetId: string;
}

/**
 * 点赞统计
 */
export interface LikeStats {
  /** 点赞数 */
  likeCount: number;
  /** 是否已点赞 */
  isLiked: boolean;
  /** 最近点赞的用户列表（可选） */
  recentLikers?: Array<{
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  }>;
}

/**
 * 点赞查询参数
 */
export interface LikeQueryParams {
  /** 用户ID */
  userId?: string;
  /** 目标类型 */
  targetType?: LikeTargetType;
  /** 目标ID */
  targetId?: string;
  /** 页码 */
  page?: number;
  /** 每页大小 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: 'createdAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 批量点赞统计
 */
export interface BulkLikeStats {
  /** 目标ID映射到统计信息 */
  [targetId: string]: LikeStats;
}

/**
 * Like Domain 工具函数
 */
export class LikeDomain {
  /**
   * 验证目标类型
   */
  static isValidTargetType(type: string): type is LikeTargetType {
    return Object.values(LikeTargetType).includes(type as LikeTargetType);
  }

  /**
   * 格式化点赞数量
   */
  static formatLikeCount(count: number): string {
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
  static getTargetTypeName(type: LikeTargetType): string {
    const names: Record<LikeTargetType, string> = {
      [LikeTargetType.POST]: '帖子',
      [LikeTargetType.COMMENT]: '评论',
      [LikeTargetType.ADAPTER]: '技能包',
      [LikeTargetType.CHARACTER]: '角色',
    };
    return names[type] || type;
  }

  /**
   * 创建点赞键（用于缓存）
   */
  static createLikeKey(targetType: LikeTargetType, targetId: string, userId?: string): string {
    return userId ? `like:${targetType}:${targetId}:${userId}` : `like:${targetType}:${targetId}`;
  }

  /**
   * 解析点赞键
   */
  static parseLikeKey(key: string): { targetType: LikeTargetType; targetId: string; userId?: string } | null {
    const parts = key.split(':');
    if (parts.length < 3 || parts[0] !== 'like') {
      return null;
    }
    return {
      targetType: parts[1] as LikeTargetType,
      targetId: parts[2] || '',
      userId: parts[3],
    };
  }

  /**
   * 验证点赞输入
   */
  static validateCreateInput(input: CreateLikeInput): { valid: boolean; error?: string } {
    if (!input.targetType || !this.isValidTargetType(input.targetType)) {
      return { valid: false, error: '无效的目标类型' };
    }
    if (!input.targetId || input.targetId.trim().length === 0) {
      return { valid: false, error: '无效的目标ID' };
    }
    return { valid: true };
  }
}

