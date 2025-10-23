/**
 * Social Types 导出
 */

// Re-export domain types
export type { Follow, CreateFollowInput, FollowStats, FollowQueryParams, BulkFollowInput } from '../domain/Follow';
export type { Like, CreateLikeInput, LikeStats, LikeQueryParams, BulkLikeStats } from '../domain/Like';
export { LikeTargetType } from '../domain/Like';
export type {
  Favorite,
  CreateFavoriteInput,
  UpdateFavoriteInput,
  FavoriteStats,
  FavoriteQueryParams,
  FavoriteCollection,
  CreateCollectionInput,
} from '../domain/Favorite';
export { FavoriteTargetType } from '../domain/Favorite';

// Re-export API types
export type {
  SocialActionResult,
  BulkActionResult,
  SocialStats,
  UserSocialInfo,
} from '../api/types';

