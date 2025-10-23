/**
 * Social Service
 * 社交功能服务层 - 提供复合业务逻辑
 */

import { followApiClient } from '../api/FollowApiClient';
import { likeApiClient } from '../api/LikeApiClient';
import { favoriteApiClient } from '../api/FavoriteApiClient';
import type { Like, LikeStats, LikeTargetType } from '../domain/Like';
import type { FavoriteTargetType } from '../domain/Favorite';
import type { UserSocialInfo } from '../types';

/**
 * Social Service Class
 */
export class SocialService {
  /**
   * 获取用户的完整社交信息
   */
  async getUserSocialInfo(userId: string): Promise<UserSocialInfo> {
    try {
      const stats = await followApiClient.getFollowStats(userId);

      return {
        userId,
        followingCount: stats.data.followingCount,
        followerCount: stats.data.followerCount,
        isFollowing: stats.data.isFollowing,
        isFollowedBy: stats.data.isFollowedBy,
        isMutualFollow: stats.data.isFollowing && stats.data.isFollowedBy,
      };
    } catch (error) {
      console.error('Failed to get user social info:', error);
      return {
        userId,
        followingCount: 0,
        followerCount: 0,
        isFollowing: false,
        isFollowedBy: false,
        isMutualFollow: false,
      };
    }
  }

  /**
   * 批量获取多个目标的点赞状态
   */
  async getBulkLikeStatus(
    targetType: LikeTargetType,
    targetIds: string[]
  ): Promise<Map<string, LikeStats>> {
    try {
      const result = await likeApiClient.getBulkLikeStats(targetType, targetIds);
      return new Map(Object.entries(result.data));
    } catch (error) {
      console.error('Failed to get bulk like status:', error);
      return new Map();
    }
  }

  /**
   * 获取内容的完整社交统计（点赞+收藏）
   */
  async getContentSocialStats(
    targetType: 'post' | 'adapter' | 'character',
    targetId: string
  ): Promise<{
    likeCount: number;
    favoriteCount: number;
    isLiked: boolean;
    isFavorited: boolean;
  }> {
    try {
      const [likeStats, favoriteStats] = await Promise.all([
        likeApiClient.getLikeStats(targetType as LikeTargetType, targetId),
        favoriteApiClient.getFavoriteStats(targetType as FavoriteTargetType, targetId),
      ]);

      return {
        likeCount: likeStats.data.likeCount,
        favoriteCount: favoriteStats.data.favoriteCount,
        isLiked: likeStats.data.isLiked,
        isFavorited: favoriteStats.data.isFavorited,
      };
    } catch (error) {
      console.error('Failed to get content social stats:', error);
      return {
        likeCount: 0,
        favoriteCount: 0,
        isLiked: false,
        isFavorited: false,
      };
    }
  }

  /**
   * 同时点赞和收藏
   */
  async likeAndFavorite(
    targetType: 'post' | 'adapter' | 'character',
    targetId: string,
    collectionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await Promise.all([
        likeApiClient.like({
          targetType: targetType as LikeTargetType,
          targetId,
        }),
        favoriteApiClient.addFavorite({
          targetType: targetType as FavoriteTargetType,
          targetId,
          collectionId,
        }),
      ]);

      return { success: true };
    } catch (error: any) {
      console.error('Failed to like and favorite:', error);
      return {
        success: false,
        error: error?.message || 'Operation failed',
      };
    }
  }

  /**
   * 检查用户是否关注了指定用户列表中的任何人
   */
  async checkFollowingAny(userIds: string[]): Promise<Map<string, boolean>> {
    try {
      const checks = await Promise.all(
        userIds.map((userId) => followApiClient.checkFollowing(userId))
      );

      const resultMap = new Map<string, boolean>();
      userIds.forEach((userId, index) => {
        resultMap.set(userId, checks[index]?.data?.isFollowing || false);
      });

      return resultMap;
    } catch (error) {
      console.error('Failed to check following status:', error);
      return new Map();
    }
  }

  /**
   * 获取互相关注的用户数量
   */
  async getMutualFollowCount(userId: string): Promise<number> {
    try {
      const result = await followApiClient.getMutualFollows({
        userId,
        page: 1,
        pageSize: 1,
      });

      return (result.data as any).pagination?.total || 0;
    } catch (error) {
      console.error('Failed to get mutual follow count:', error);
      return 0;
    }
  }

  /**
   * 获取用户的热门内容（根据点赞数）
   */
  async getUserPopularContent(
    userId: string,
    targetType: LikeTargetType,
    limit: number = 10
  ): Promise<Like[]> {
    try {
      const result = await likeApiClient.getUserLikes(userId, targetType, 1, limit);
      return result.data.items || [];
    } catch (error) {
      console.error('Failed to get user popular content:', error);
      return [];
    }
  }
}

/**
 * 导出单例实例
 */
export const socialService = new SocialService();

