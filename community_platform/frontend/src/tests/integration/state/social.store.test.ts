/**
 * 社交 Store 集成测试
 * @module tests/integration/state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';
import { create } from 'zustand';

const API_BASE = 'http://localhost:8000/api/v1';

// 社交 Store 接口
interface SocialState {
  following: Set<string>;
  followers: Set<string>;
  followCounts: Map<string, { followers: number; following: number }>;
  isLoading: boolean;
  error: string | null;
  
  follow: (userId: string) => void;
  unfollow: (userId: string) => void;
  setFollowing: (userIds: string[]) => void;
  setFollowers: (userIds: string[]) => void;
  setFollowCounts: (userId: string, counts: { followers: number; following: number }) => void;
  isFollowing: (userId: string) => boolean;
  isFollower: (userId: string) => boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSocial: () => void;
}

const useSocialStore = create<SocialState>((set, get) => ({
  following: new Set(),
  followers: new Set(),
  followCounts: new Map(),
  isLoading: false,
  error: null,
  
  follow: (userId) =>
    set((state) => {
      const following = new Set(state.following);
      following.add(userId);
      
      // 更新关注数
      const counts = state.followCounts.get(userId);
      const followCounts = new Map(state.followCounts);
      if (counts) {
        followCounts.set(userId, {
          ...counts,
          followers: counts.followers + 1,
        });
      }
      
      return { following, followCounts };
    }),
  
  unfollow: (userId) =>
    set((state) => {
      const following = new Set(state.following);
      following.delete(userId);
      
      // 更新关注数
      const counts = state.followCounts.get(userId);
      const followCounts = new Map(state.followCounts);
      if (counts) {
        followCounts.set(userId, {
          ...counts,
          followers: Math.max(0, counts.followers - 1),
        });
      }
      
      return { following, followCounts };
    }),
  
  setFollowing: (userIds) =>
    set({ following: new Set(userIds) }),
  
  setFollowers: (userIds) =>
    set({ followers: new Set(userIds) }),
  
  setFollowCounts: (userId, counts) =>
    set((state) => {
      const followCounts = new Map(state.followCounts);
      followCounts.set(userId, counts);
      return { followCounts };
    }),
  
  isFollowing: (userId) => get().following.has(userId),
  
  isFollower: (userId) => get().followers.has(userId),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  clearSocial: () =>
    set({
      following: new Set(),
      followers: new Set(),
      followCounts: new Map(),
      error: null,
    }),
}));

describe('社交 Store 集成测试', () => {
  beforeEach(() => {
    const { clearSocial } = useSocialStore.getState();
    clearSocial();
  });

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const { result } = renderHook(() => useSocialStore());

      expect(result.current.following.size).toBe(0);
      expect(result.current.followers.size).toBe(0);
      expect(result.current.followCounts.size).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('follow', () => {
    it('应该添加关注关系', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.follow(mockUsers[1].id);
      });

      expect(result.current.following.has(mockUsers[1].id)).toBe(true);
      expect(result.current.isFollowing(mockUsers[1].id)).toBe(true);
    });

    it('应该更新关注数', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.setFollowCounts(mockUsers[1].id, {
          followers: 100,
          following: 50,
        });
        result.current.follow(mockUsers[1].id);
      });

      const counts = result.current.followCounts.get(mockUsers[1].id);
      expect(counts?.followers).toBe(101);
    });

    it('应该支持关注多个用户', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.follow(mockUsers[1].id);
        result.current.follow(mockUsers[2].id);
      });

      expect(result.current.following.size).toBe(2);
      expect(result.current.isFollowing(mockUsers[1].id)).toBe(true);
      expect(result.current.isFollowing(mockUsers[2].id)).toBe(true);
    });
  });

  describe('unfollow', () => {
    it('应该移除关注关系', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.follow(mockUsers[1].id);
        result.current.unfollow(mockUsers[1].id);
      });

      expect(result.current.following.has(mockUsers[1].id)).toBe(false);
      expect(result.current.isFollowing(mockUsers[1].id)).toBe(false);
    });

    it('应该更新关注数', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.setFollowCounts(mockUsers[1].id, {
          followers: 100,
          following: 50,
        });
        result.current.follow(mockUsers[1].id);
        result.current.unfollow(mockUsers[1].id);
      });

      const counts = result.current.followCounts.get(mockUsers[1].id);
      expect(counts?.followers).toBe(100);
    });

    it('应该防止关注数变为负数', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.setFollowCounts(mockUsers[1].id, {
          followers: 0,
          following: 0,
        });
        result.current.unfollow(mockUsers[1].id);
      });

      const counts = result.current.followCounts.get(mockUsers[1].id);
      expect(counts?.followers).toBe(0);
    });
  });

  describe('setFollowing 和 setFollowers', () => {
    it('应该批量设置关注列表', () => {
      const { result } = renderHook(() => useSocialStore());

      const followingIds = [mockUsers[1].id, mockUsers[2].id];

      act(() => {
        result.current.setFollowing(followingIds);
      });

      expect(result.current.following.size).toBe(2);
      followingIds.forEach((id) => {
        expect(result.current.isFollowing(id)).toBe(true);
      });
    });

    it('应该批量设置粉丝列表', () => {
      const { result } = renderHook(() => useSocialStore());

      const followerIds = [mockUsers[1].id, mockUsers[2].id];

      act(() => {
        result.current.setFollowers(followerIds);
      });

      expect(result.current.followers.size).toBe(2);
      followerIds.forEach((id) => {
        expect(result.current.isFollower(id)).toBe(true);
      });
    });
  });

  describe('setFollowCounts', () => {
    it('应该设置用户的关注统计', () => {
      const { result } = renderHook(() => useSocialStore());

      const counts = {
        followers: 150,
        following: 75,
      };

      act(() => {
        result.current.setFollowCounts(mockUsers[1].id, counts);
      });

      const storedCounts = result.current.followCounts.get(mockUsers[1].id);
      expect(storedCounts).toEqual(counts);
    });

    it('应该可以更新已存在的统计', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.setFollowCounts(mockUsers[1].id, {
          followers: 100,
          following: 50,
        });
        result.current.setFollowCounts(mockUsers[1].id, {
          followers: 200,
          following: 100,
        });
      });

      const counts = result.current.followCounts.get(mockUsers[1].id);
      expect(counts?.followers).toBe(200);
      expect(counts?.following).toBe(100);
    });
  });

  describe('isFollowing 和 isFollower', () => {
    it('应该正确检查关注状态', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.follow(mockUsers[1].id);
      });

      expect(result.current.isFollowing(mockUsers[1].id)).toBe(true);
      expect(result.current.isFollowing(mockUsers[2].id)).toBe(false);
    });

    it('应该正确检查粉丝状态', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.setFollowers([mockUsers[1].id]);
      });

      expect(result.current.isFollower(mockUsers[1].id)).toBe(true);
      expect(result.current.isFollower(mockUsers[2].id)).toBe(false);
    });
  });

  describe('完整的关注流程', () => {
    it('应该模拟完整的关注用户流程', async () => {
      const { result } = renderHook(() => useSocialStore());

      const targetUserId = mockUsers[1].id;

      // 开始关注
      act(() => {
        result.current.setLoading(true);
        result.current.setError(null);
      });

      server.use(
        http.post(`${API_BASE}/users/${targetUserId}/follow`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isFollowing: true,
              followerCount: 101,
            },
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/users/${targetUserId}/follow`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer mock-token' },
        }
      );
      const data = await response.json();

      act(() => {
        result.current.follow(targetUserId);
        result.current.setFollowCounts(targetUserId, {
          followers: data.data.followerCount,
          following: 50,
        });
        result.current.setLoading(false);
      });

      expect(result.current.isFollowing(targetUserId)).toBe(true);
      expect(result.current.followCounts.get(targetUserId)?.followers).toBe(
        101
      );
      expect(result.current.isLoading).toBe(false);
    });

    it('应该模拟完整的取消关注流程', async () => {
      const { result } = renderHook(() => useSocialStore());

      const targetUserId = mockUsers[1].id;

      // 先设置为已关注
      act(() => {
        result.current.follow(targetUserId);
        result.current.setFollowCounts(targetUserId, {
          followers: 100,
          following: 50,
        });
      });

      server.use(
        http.delete(`${API_BASE}/users/${targetUserId}/follow`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isFollowing: false,
              followerCount: 99,
            },
          });
        })
      );

      await fetch(`${API_BASE}/users/${targetUserId}/follow`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock-token' },
      });

      act(() => {
        result.current.unfollow(targetUserId);
      });

      expect(result.current.isFollowing(targetUserId)).toBe(false);
    });

    it('应该处理关注失败', async () => {
      const { result } = renderHook(() => useSocialStore());

      const targetUserId = mockUsers[1].id;

      server.use(
        http.post(`${API_BASE}/users/${targetUserId}/follow`, () => {
          return HttpResponse.json(
            { success: false, error: '不能关注自己' },
            { status: 400 }
          );
        })
      );

      act(() => {
        result.current.setLoading(true);
      });

      const response = await fetch(
        `${API_BASE}/users/${targetUserId}/follow`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer mock-token' },
        }
      );
      const data = await response.json();

      act(() => {
        result.current.setError(data.error);
        result.current.setLoading(false);
      });

      expect(result.current.error).toBe('不能关注自己');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('批量加载社交关系', () => {
    it('应该加载用户的关注列表', async () => {
      const { result } = renderHook(() => useSocialStore());

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/following`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              following: mockUsers.slice(1, 3),
              total: 2,
            },
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/users/${mockUsers[0].id}/following`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );
      const data = await response.json();

      act(() => {
        result.current.setFollowing(
          data.data.following.map((u: any) => u.id)
        );
      });

      expect(result.current.following.size).toBe(2);
    });

    it('应该加载用户的粉丝列表', async () => {
      const { result } = renderHook(() => useSocialStore());

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/followers`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              followers: mockUsers.slice(1, 4),
              total: 3,
            },
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/users/${mockUsers[0].id}/followers`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );
      const data = await response.json();

      act(() => {
        result.current.setFollowers(
          data.data.followers.map((u: any) => u.id)
        );
      });

      expect(result.current.followers.size).toBe(3);
    });
  });

  describe('互相关注检测', () => {
    it('应该能检测互相关注关系', () => {
      const { result } = renderHook(() => useSocialStore());

      const userId = mockUsers[1].id;

      act(() => {
        result.current.follow(userId);
        result.current.setFollowers([userId]);
      });

      // 互相关注
      expect(result.current.isFollowing(userId)).toBe(true);
      expect(result.current.isFollower(userId)).toBe(true);
    });
  });

  describe('clearSocial', () => {
    it('应该清除所有社交数据', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.follow(mockUsers[1].id);
        result.current.setFollowers([mockUsers[2].id]);
        result.current.setFollowCounts(mockUsers[1].id, {
          followers: 100,
          following: 50,
        });
        result.current.setError('错误');
      });

      act(() => {
        result.current.clearSocial();
      });

      expect(result.current.following.size).toBe(0);
      expect(result.current.followers.size).toBe(0);
      expect(result.current.followCounts.size).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('状态管理', () => {
    it('应该正确管理加载和错误状态', () => {
      const { result } = renderHook(() => useSocialStore());

      act(() => {
        result.current.setLoading(true);
        result.current.setError(null);
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setLoading(false);
        result.current.setError('操作失败');
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('操作失败');
    });
  });
});

