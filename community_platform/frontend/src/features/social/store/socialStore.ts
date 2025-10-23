/**
 * Social Store
 * 社交功能状态管理 (Zustand)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * 社交缓存项
 */
interface SocialCacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Social Store State
 */
interface SocialState {
  // Follow 相关
  followingCache: Map<string, SocialCacheItem<boolean>>;
  followerCountCache: Map<string, SocialCacheItem<number>>;
  
  // Like 相关
  likedCache: Map<string, SocialCacheItem<boolean>>;
  likeCountCache: Map<string, SocialCacheItem<number>>;
  
  // Favorite 相关
  favoritedCache: Map<string, SocialCacheItem<boolean>>;
  favoriteCountCache: Map<string, SocialCacheItem<number>>;

  // Actions
  setFollowing: (userId: string, isFollowing: boolean, ttl?: number) => void;
  getFollowing: (userId: string) => boolean | null;
  setFollowerCount: (userId: string, count: number, ttl?: number) => void;
  getFollowerCount: (userId: string) => number | null;
  
  setLiked: (key: string, isLiked: boolean, ttl?: number) => void;
  getLiked: (key: string) => boolean | null;
  setLikeCount: (key: string, count: number, ttl?: number) => void;
  getLikeCount: (key: string) => number | null;
  
  setFavorited: (key: string, isFavorited: boolean, ttl?: number) => void;
  getFavorited: (key: string) => boolean | null;
  setFavoriteCount: (key: string, count: number, ttl?: number) => void;
  getFavoriteCount: (key: string) => number | null;
  
  clearCache: () => void;
  clearExpiredCache: () => void;
}

/**
 * 默认缓存过期时间 (5分钟)
 */
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * 创建缓存项
 */
function createCacheItem<T>(data: T, ttl: number = DEFAULT_TTL): SocialCacheItem<T> {
  const now = Date.now();
  return {
    data,
    timestamp: now,
    expiresAt: now + ttl,
  };
}

/**
 * 检查缓存项是否过期
 */
function isCacheItemExpired<T>(item: SocialCacheItem<T> | undefined): boolean {
  if (!item) return true;
  return Date.now() > item.expiresAt;
}

/**
 * 获取缓存数据
 */
function getCacheData<T>(
  cache: Map<string, SocialCacheItem<T>>,
  key: string
): T | null {
  const item = cache.get(key);
  if (!item || isCacheItemExpired(item)) {
    return null;
  }
  return item.data;
}

/**
 * Social Store
 */
export const useSocialStore = create<SocialState>()(
  devtools(
    (set, get) => ({
      // Initial state
      followingCache: new Map(),
      followerCountCache: new Map(),
      likedCache: new Map(),
      likeCountCache: new Map(),
      favoritedCache: new Map(),
      favoriteCountCache: new Map(),

      // Follow actions
      setFollowing: (userId, isFollowing, ttl = DEFAULT_TTL) => {
        set((state) => {
          const newCache = new Map(state.followingCache);
          newCache.set(userId, createCacheItem(isFollowing, ttl));
          return { followingCache: newCache };
        });
      },

      getFollowing: (userId) => {
        return getCacheData(get().followingCache, userId);
      },

      setFollowerCount: (userId, count, ttl = DEFAULT_TTL) => {
        set((state) => {
          const newCache = new Map(state.followerCountCache);
          newCache.set(userId, createCacheItem(count, ttl));
          return { followerCountCache: newCache };
        });
      },

      getFollowerCount: (userId) => {
        return getCacheData(get().followerCountCache, userId);
      },

      // Like actions
      setLiked: (key, isLiked, ttl = DEFAULT_TTL) => {
        set((state) => {
          const newCache = new Map(state.likedCache);
          newCache.set(key, createCacheItem(isLiked, ttl));
          return { likedCache: newCache };
        });
      },

      getLiked: (key) => {
        return getCacheData(get().likedCache, key);
      },

      setLikeCount: (key, count, ttl = DEFAULT_TTL) => {
        set((state) => {
          const newCache = new Map(state.likeCountCache);
          newCache.set(key, createCacheItem(count, ttl));
          return { likeCountCache: newCache };
        });
      },

      getLikeCount: (key) => {
        return getCacheData(get().likeCountCache, key);
      },

      // Favorite actions
      setFavorited: (key, isFavorited, ttl = DEFAULT_TTL) => {
        set((state) => {
          const newCache = new Map(state.favoritedCache);
          newCache.set(key, createCacheItem(isFavorited, ttl));
          return { favoritedCache: newCache };
        });
      },

      getFavorited: (key) => {
        return getCacheData(get().favoritedCache, key);
      },

      setFavoriteCount: (key, count, ttl = DEFAULT_TTL) => {
        set((state) => {
          const newCache = new Map(state.favoriteCountCache);
          newCache.set(key, createCacheItem(count, ttl));
          return { favoriteCountCache: newCache };
        });
      },

      getFavoriteCount: (key) => {
        return getCacheData(get().favoriteCountCache, key);
      },

      // Utility actions
      clearCache: () => {
        set({
          followingCache: new Map(),
          followerCountCache: new Map(),
          likedCache: new Map(),
          likeCountCache: new Map(),
          favoritedCache: new Map(),
          favoriteCountCache: new Map(),
        });
      },

      clearExpiredCache: () => {
        const now = Date.now();
        set((state) => {
          const clearExpired = <T,>(cache: Map<string, SocialCacheItem<T>>) => {
            const newCache = new Map(cache);
            for (const [key, item] of newCache.entries()) {
              if (now > item.expiresAt) {
                newCache.delete(key);
              }
            }
            return newCache;
          };

          return {
            followingCache: clearExpired(state.followingCache),
            followerCountCache: clearExpired(state.followerCountCache),
            likedCache: clearExpired(state.likedCache),
            likeCountCache: clearExpired(state.likeCountCache),
            favoritedCache: clearExpired(state.favoritedCache),
            favoriteCountCache: clearExpired(state.favoriteCountCache),
          };
        });
      },
    }),
    { name: 'SocialStore' }
  )
);

// 定期清理过期缓存（每5分钟）
if (typeof window !== 'undefined') {
  setInterval(() => {
    useSocialStore.getState().clearExpiredCache();
  }, 5 * 60 * 1000);
}

