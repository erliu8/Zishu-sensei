/**
 * 用户 Store 集成测试
 * @module tests/integration/state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';

const API_BASE = 'http://localhost:8000/api/v1';

// 简单的用户 Store mock（基于项目实际实现调整）
import { create } from 'zustand';

interface UserState {
  users: Map<string, any>;
  currentProfile: any | null;
  isLoading: boolean;
  error: string | null;
  
  setUser: (user: any) => void;
  setCurrentProfile: (profile: any | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearUsers: () => void;
}

const useUserStore = create<UserState>((set) => ({
  users: new Map(),
  currentProfile: null,
  isLoading: false,
  error: null,
  
  setUser: (user) =>
    set((state) => {
      const users = new Map(state.users);
      users.set(user.id, user);
      return { users };
    }),
  
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearUsers: () => set({ users: new Map(), currentProfile: null }),
}));

describe('用户 Store 集成测试', () => {
  beforeEach(() => {
    // 清理 store
    const { clearUsers } = useUserStore.getState();
    clearUsers();
  });

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const { result } = renderHook(() => useUserStore());

      expect(result.current.users.size).toBe(0);
      expect(result.current.currentProfile).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('setUser', () => {
    it('应该添加用户到 store', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setUser(mockUsers[0]);
      });

      expect(result.current.users.size).toBe(1);
      expect(result.current.users.get(mockUsers[0].id)).toEqual(mockUsers[0]);
    });

    it('应该更新已存在的用户', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setUser(mockUsers[0]);
      });

      const updatedUser = {
        ...mockUsers[0],
        displayName: '更新后的名称',
      };

      act(() => {
        result.current.setUser(updatedUser);
      });

      expect(result.current.users.size).toBe(1);
      expect(result.current.users.get(mockUsers[0].id)?.displayName).toBe(
        '更新后的名称'
      );
    });

    it('应该能够存储多个用户', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        mockUsers.forEach((user) => {
          result.current.setUser(user);
        });
      });

      expect(result.current.users.size).toBe(mockUsers.length);
    });
  });

  describe('setCurrentProfile', () => {
    it('应该设置当前查看的用户资料', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setCurrentProfile(mockUsers[0]);
      });

      expect(result.current.currentProfile).toEqual(mockUsers[0]);
    });

    it('应该可以清除当前资料', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setCurrentProfile(mockUsers[0]);
        result.current.setCurrentProfile(null);
      });

      expect(result.current.currentProfile).toBeNull();
    });
  });

  describe('setLoading 和 setError', () => {
    it('应该管理加载和错误状态', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setLoading(true);
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setError('发生错误');
      });
      expect(result.current.error).toBe('发生错误');

      act(() => {
        result.current.setLoading(false);
        result.current.setError(null);
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('clearUsers', () => {
    it('应该清除所有用户数据', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setUser(mockUsers[0]);
        result.current.setCurrentProfile(mockUsers[0]);
      });

      expect(result.current.users.size).toBe(1);
      expect(result.current.currentProfile).not.toBeNull();

      act(() => {
        result.current.clearUsers();
      });

      expect(result.current.users.size).toBe(0);
      expect(result.current.currentProfile).toBeNull();
    });
  });

  describe('用户数据获取流程', () => {
    it('应该模拟完整的用户加载流程', async () => {
      const { result } = renderHook(() => useUserStore());

      // 开始加载
      act(() => {
        result.current.setLoading(true);
        result.current.setError(null);
      });

      expect(result.current.isLoading).toBe(true);

      // 模拟 API 调用
      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUsers[0],
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${mockUsers[0].id}`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      const data = await response.json();

      // 加载成功
      act(() => {
        result.current.setUser(data.data);
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.users.get(mockUsers[0].id)).toEqual(mockUsers[0]);
      expect(result.current.error).toBeNull();
    });

    it('应该处理加载错误', async () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setLoading(true);
      });

      server.use(
        http.get(`${API_BASE}/users/non-existent`, () => {
          return HttpResponse.json(
            { success: false, error: '用户不存在' },
            { status: 404 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/users/non-existent`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      const data = await response.json();

      act(() => {
        result.current.setError(data.error);
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('用户不存在');
    });
  });

  describe('用户更新流程', () => {
    it('应该模拟用户信息更新流程', async () => {
      const { result } = renderHook(() => useUserStore());

      // 先添加用户
      act(() => {
        result.current.setUser(mockUsers[0]);
      });

      const updates = {
        displayName: '新名称',
        bio: '新简介',
      };

      server.use(
        http.put(`${API_BASE}/users/${mockUsers[0].id}`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockUsers[0],
              ...updates,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${mockUsers[0].id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      act(() => {
        result.current.setUser(data.data);
      });

      const updatedUser = result.current.users.get(mockUsers[0].id);
      expect(updatedUser?.displayName).toBe('新名称');
      expect(updatedUser?.bio).toBe('新简介');
    });
  });

  describe('多用户管理', () => {
    it('应该可以同时管理多个用户状态', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        mockUsers.forEach((user) => {
          result.current.setUser(user);
        });
      });

      // 验证所有用户都被存储
      mockUsers.forEach((user) => {
        expect(result.current.users.get(user.id)).toEqual(user);
      });
    });

    it('应该可以独立更新每个用户', () => {
      const { result } = renderHook(() => useUserStore());

      act(() => {
        result.current.setUser(mockUsers[0]);
        result.current.setUser(mockUsers[1]);
      });

      // 更新第一个用户
      act(() => {
        result.current.setUser({
          ...mockUsers[0],
          displayName: '更新的名称1',
        });
      });

      expect(result.current.users.get(mockUsers[0].id)?.displayName).toBe(
        '更新的名称1'
      );
      expect(result.current.users.get(mockUsers[1].id)?.displayName).toBe(
        mockUsers[1].displayName
      );
    });
  });

  describe('缓存机制', () => {
    it('应该可以作为用户数据的缓存', () => {
      const { result } = renderHook(() => useUserStore());

      // 第一次访问 - 存入缓存
      act(() => {
        result.current.setUser(mockUsers[0]);
      });

      // 第二次访问 - 从缓存读取
      const cachedUser = result.current.users.get(mockUsers[0].id);
      expect(cachedUser).toEqual(mockUsers[0]);
    });
  });
});

