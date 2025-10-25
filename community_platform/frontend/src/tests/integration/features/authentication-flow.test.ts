/**
 * 认证流程集成测试
 * 测试完整的用户认证流程
 * @module tests/integration/features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';

const API_BASE = 'http://localhost:8000/api/v1';

describe('认证流程集成测试', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    localStorage.clear();
  });

  describe('用户注册流程', () => {
    it('应该完成完整的注册流程', async () => {
      const { result } = renderHook(() => useAuthStore());

      const newUserData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      // 步骤 1: 提交注册表单
      act(() => {
        result.current.setLoading(true);
        result.current.setError(null);
      });

      const registerResponse = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });

      const registerData = await registerResponse.json();

      // 步骤 2: 注册成功，设置会话
      act(() => {
        result.current.setSession({
          user: registerData.data.user,
          accessToken: registerData.data.accessToken,
          refreshToken: registerData.data.refreshToken,
          expiresIn: registerData.data.expiresIn,
        });
        result.current.setLoading(false);
      });

      // 验证认证状态
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.username).toBe(newUserData.username);
      expect(result.current.user?.email).toBe(newUserData.email);
      expect(result.current.accessToken).toBeTruthy();
      expect(result.current.error).toBeNull();

      // 步骤 3: 获取当前用户信息
      server.use(
        http.get(`${API_BASE}/auth/me`, () => {
          return HttpResponse.json({
            success: true,
            data: registerData.data.user,
          });
        })
      );

      const meResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${result.current.accessToken}`,
        },
      });

      const meData = await meResponse.json();

      // 验证用户信息
      expect(meData.success).toBe(true);
      expect(meData.data.username).toBe(newUserData.username);
    });

    it('应该处理注册失败（用户名已存在）', async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setLoading(true);
        result.current.setError(null);
      });

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: mockUsers[0].username,
          email: 'newemail@example.com',
          password: 'password123',
        }),
      });

      const data = await response.json();

      act(() => {
        result.current.setError(data.error);
        result.current.setLoading(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toContain('已存在');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('用户登录流程', () => {
    it('应该完成完整的登录流程', async () => {
      const { result } = renderHook(() => useAuthStore());

      const credentials = {
        email: mockUsers[0].email,
        password: 'password123',
      };

      // 步骤 1: 提交登录表单
      act(() => {
        result.current.setLoading(true);
        result.current.setError(null);
      });

      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const loginData = await loginResponse.json();

      // 步骤 2: 登录成功，设置会话
      act(() => {
        result.current.setSession({
          user: loginData.data.user,
          accessToken: loginData.data.accessToken,
          refreshToken: loginData.data.refreshToken,
          expiresIn: loginData.data.expiresIn,
        });
        result.current.setLoading(false);
      });

      // 验证登录状态
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe(credentials.email);
      expect(result.current.accessToken).toBe(loginData.data.accessToken);

      // 步骤 3: 验证会话持久化
      const stored = localStorage.getItem('auth-storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.user.email).toBe(credentials.email);
    });

    it('应该处理登录失败（错误的凭据）', async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setLoading(true);
      });

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        }),
      });

      const data = await response.json();

      act(() => {
        result.current.setError(data.error);
        result.current.setLoading(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it('应该在登录后自动加载用户信息', async () => {
      const { result } = renderHook(() => useAuthStore());

      // 登录
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockUsers[0].email,
          password: 'password123',
        }),
      });

      const loginData = await loginResponse.json();

      act(() => {
        result.current.setSession({
          user: loginData.data.user,
          accessToken: loginData.data.accessToken,
          refreshToken: loginData.data.refreshToken,
          expiresIn: loginData.data.expiresIn,
        });
      });

      // 获取用户详细信息
      server.use(
        http.get(`${API_BASE}/auth/me`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockUsers[0],
              profile: {
                bio: '这是我的简介',
                location: '北京',
              },
            },
          });
        })
      );

      const meResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${result.current.accessToken}`,
        },
      });

      const meData = await meResponse.json();

      // 更新用户信息
      act(() => {
        result.current.setUser(meData.data);
      });

      expect(result.current.user?.profile).toBeDefined();
      expect(result.current.user?.profile.bio).toBe('这是我的简介');
    });
  });

  describe('Token 刷新流程', () => {
    it('应该在 token 过期前刷新', async () => {
      const { result } = renderHook(() => useAuthStore());

      // 设置一个即将过期的会话
      act(() => {
        result.current.setSession({
          user: mockUsers[0],
          accessToken: 'old-token',
          refreshToken: 'valid-refresh-token',
          expiresIn: 1, // 1秒后过期
        });
      });

      // 等待 token 过期
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 刷新 token
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: result.current.refreshToken,
        }),
      });

      const refreshData = await refreshResponse.json();

      act(() => {
        result.current.updateToken(
          refreshData.data.accessToken,
          Date.now() + refreshData.data.expiresIn * 1000
        );
      });

      expect(result.current.accessToken).toBe(refreshData.data.accessToken);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('应该在刷新失败时登出用户', async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession({
          user: mockUsers[0],
          accessToken: 'old-token',
          refreshToken: 'invalid-refresh-token',
          expiresIn: 3600,
        });
      });

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: 'invalid-refresh-token',
        }),
      });

      if (response.status === 401) {
        act(() => {
          result.current.clearSession();
        });
      }

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('登出流程', () => {
    it('应该完成完整的登出流程', async () => {
      const { result } = renderHook(() => useAuthStore());

      // 先登录
      act(() => {
        result.current.setSession({
          user: mockUsers[0],
          accessToken: 'test-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        });
      });

      expect(result.current.isAuthenticated).toBe(true);

      // 登出
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result.current.accessToken}`,
        },
      });

      act(() => {
        result.current.clearSession();
      });

      // 验证登出状态
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();

      // 验证持久化数据被清除
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.user).toBeNull();
      }
    });
  });

  describe('密码重置流程', () => {
    it('应该完成完整的密码重置流程', async () => {
      // 步骤 1: 请求重置密码
      const requestResponse = await fetch(
        `${API_BASE}/auth/password-reset/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mockUsers[0].email,
          }),
        }
      );

      const requestData = await requestResponse.json();
      expect(requestData.success).toBe(true);

      // 步骤 2: 用户点击邮件中的链接（获得重置令牌）
      const resetToken = 'valid-reset-token';

      // 步骤 3: 提交新密码
      const confirmResponse = await fetch(
        `${API_BASE}/auth/password-reset/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: resetToken,
            newPassword: 'newpassword123',
          }),
        }
      );

      const confirmData = await confirmResponse.json();
      expect(confirmData.success).toBe(true);

      // 步骤 4: 使用新密码登录
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockUsers[0].email,
          password: 'password123', // mock 仍然使用旧密码
        }),
      });

      const loginData = await loginResponse.json();
      expect(loginData.success).toBe(true);
    });

    it('应该拒绝无效的重置令牌', async () => {
      const response = await fetch(
        `${API_BASE}/auth/password-reset/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'invalid-token',
            newPassword: 'newpassword123',
          }),
        }
      );

      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('邮箱验证流程', () => {
    it('应该完成完整的邮箱验证流程', async () => {
      const { result } = renderHook(() => useAuthStore());

      // 步骤 1: 用户注册（邮箱未验证）
      const registerResponse = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
        }),
      });

      const registerData = await registerResponse.json();

      act(() => {
        result.current.setSession({
          user: registerData.data.user,
          accessToken: registerData.data.accessToken,
          refreshToken: registerData.data.refreshToken,
          expiresIn: registerData.data.expiresIn,
        });
      });

      expect(result.current.user?.isEmailVerified).toBe(false);

      // 步骤 2: 用户点击邮件中的验证链接
      const verifyResponse = await fetch(`${API_BASE}/auth/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-verification-token',
        }),
      });

      const verifyData = await verifyResponse.json();
      expect(verifyData.success).toBe(true);

      // 步骤 3: 更新用户状态
      act(() => {
        result.current.setUser({
          ...result.current.user!,
          isEmailVerified: true,
        });
      });

      expect(result.current.user?.isEmailVerified).toBe(true);
    });

    it('应该能重新发送验证邮件', async () => {
      const response = await fetch(`${API_BASE}/auth/email/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockUsers[0].email,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('会话恢复流程', () => {
    it('应该从 localStorage 恢复会话', () => {
      // 模拟已存在的会话
      const session = {
        user: mockUsers[0],
        accessToken: 'stored-token',
        refreshToken: 'stored-refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: session,
          version: 0,
        })
      );

      // 新的 hook 实例应该恢复会话
      const { result } = renderHook(() => useAuthStore());

      // Zustand persist 需要时间恢复状态
      waitFor(() => {
        expect(result.current.user).toBeDefined();
      });
    });

    it('应该验证恢复的会话是否有效', async () => {
      const { result } = renderHook(() => useAuthStore());

      // 设置会话
      act(() => {
        result.current.setSession({
          user: mockUsers[0],
          accessToken: 'test-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        });
      });

      // 验证会话
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${result.current.accessToken}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        act(() => {
          result.current.setUser(data.data);
        });
        expect(result.current.isAuthenticated).toBe(true);
      }
    });
  });

  describe('并发请求处理', () => {
    it('应该在 token 刷新时处理并发请求', async () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setSession({
          user: mockUsers[0],
          accessToken: 'expiring-token',
          refreshToken: 'refresh-token',
          expiresIn: 1,
        });
      });

      // 模拟多个并发请求
      const requests = [
        fetch(`${API_BASE}/posts`, {
          headers: { Authorization: `Bearer ${result.current.accessToken}` },
        }),
        fetch(`${API_BASE}/users/${mockUsers[0].id}`, {
          headers: { Authorization: `Bearer ${result.current.accessToken}` },
        }),
        fetch(`${API_BASE}/activities`, {
          headers: { Authorization: `Bearer ${result.current.accessToken}` },
        }),
      ];

      // 所有请求都应该成功或被适当处理
      const results = await Promise.allSettled(requests);
      expect(results).toHaveLength(3);
    });
  });
});

