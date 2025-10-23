/**
 * Social API Types
 * 社交 API 通用类型定义
 */

/**
 * 社交操作结果
 */
export interface SocialActionResult {
  /** 操作是否成功 */
  success: boolean;
  /** 消息 */
  message?: string;
  /** 数据 */
  data?: any;
}

/**
 * 批量操作结果
 */
export interface BulkActionResult {
  /** 成功数量 */
  successCount: number;
  /** 失败的ID列表 */
  failedIds: string[];
  /** 错误信息 */
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * 社交统计信息
 */
export interface SocialStats {
  /** 关注数 */
  followingCount?: number;
  /** 粉丝数 */
  followerCount?: number;
  /** 点赞数 */
  likeCount?: number;
  /** 收藏数 */
  favoriteCount?: number;
}

/**
 * 用户社交信息
 */
export interface UserSocialInfo {
  /** 用户ID */
  userId: string;
  /** 关注数 */
  followingCount: number;
  /** 粉丝数 */
  followerCount: number;
  /** 是否已关注 */
  isFollowing: boolean;
  /** 是否被关注 */
  isFollowedBy: boolean;
  /** 互相关注 */
  isMutualFollow: boolean;
}

