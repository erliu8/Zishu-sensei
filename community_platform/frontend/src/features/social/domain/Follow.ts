/**
 * Follow Domain Model
 * 关注领域模型
 */

/**
 * 关注实体
 */
export interface Follow {
  /** 关注ID */
  id: string;
  /** 关注者ID */
  followerId: string;
  /** 被关注者ID */
  followeeId: string;
  /** 关注时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 关注者信息（可选） */
  follower?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  /** 被关注者信息（可选） */
  followee?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    bio?: string;
  };
}

/**
 * 创建关注输入
 */
export interface CreateFollowInput {
  /** 被关注者ID */
  followeeId: string;
}

/**
 * 关注统计
 */
export interface FollowStats {
  /** 关注数 */
  followingCount: number;
  /** 粉丝数 */
  followerCount: number;
  /** 是否已关注 */
  isFollowing: boolean;
  /** 是否被关注 */
  isFollowedBy: boolean;
}

/**
 * 关注查询参数
 */
export interface FollowQueryParams {
  /** 用户ID */
  userId?: string;
  /** 查询类型 */
  type?: 'followers' | 'following';
  /** 页码 */
  page?: number;
  /** 每页大小 */
  pageSize?: number;
  /** 搜索关键词 */
  search?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'username';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 批量关注输入
 */
export interface BulkFollowInput {
  /** 用户ID列表 */
  userIds: string[];
}

/**
 * Follow Domain 工具函数
 */
export class FollowDomain {
  /**
   * 验证关注ID
   */
  static isValidFollowId(id: string): boolean {
    return typeof id === 'string' && id.length > 0;
  }

  /**
   * 格式化关注时间
   */
  static formatFollowTime(createdAt: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(createdAt).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 365) {
      return `${Math.floor(days / 365)} 年前关注`;
    }
    if (days > 30) {
      return `${Math.floor(days / 30)} 个月前关注`;
    }
    if (days > 0) {
      return `${days} 天前关注`;
    }
    if (hours > 0) {
      return `${hours} 小时前关注`;
    }
    if (minutes > 0) {
      return `${minutes} 分钟前关注`;
    }
    return '刚刚关注';
  }

  /**
   * 检查是否可以关注
   */
  static canFollow(followerId: string, followeeId: string): boolean {
    // 不能关注自己
    return followerId !== followeeId;
  }

  /**
   * 格式化关注数量
   */
  static formatFollowCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }
}

