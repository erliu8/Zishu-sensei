/**
 * 帖子数据层 - Query Keys
 * @module features/post/hooks
 */

import type { PostQueryParams } from '../domain';

/**
 * 帖子查询 Keys 工厂
 */
export const POST_QUERY_KEYS = {
  /**
   * 所有帖子相关的查询
   */
  all: ['posts'] as const,

  /**
   * 帖子列表相关的查询
   */
  lists: () => [...POST_QUERY_KEYS.all, 'list'] as const,

  /**
   * 特定参数的帖子列表
   */
  list: (params?: PostQueryParams) => [...POST_QUERY_KEYS.lists(), params] as const,

  /**
   * 帖子详情相关的查询
   */
  details: () => [...POST_QUERY_KEYS.all, 'detail'] as const,

  /**
   * 特定 ID 的帖子详情
   */
  detail: (id: string) => [...POST_QUERY_KEYS.details(), id] as const,

  /**
   * 用户帖子列表
   */
  userPosts: (userId: string, params?: PostQueryParams) =>
    [...POST_QUERY_KEYS.all, 'user', userId, params] as const,

  /**
   * 推荐帖子列表
   */
  featured: (limit: number) => [...POST_QUERY_KEYS.all, 'featured', limit] as const,

  /**
   * 热门帖子列表
   */
  trending: (limit: number) => [...POST_QUERY_KEYS.all, 'trending', limit] as const,
};

