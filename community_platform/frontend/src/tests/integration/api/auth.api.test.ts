/**
 * 认证 API 集成测试
 * @module tests/integration/api
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';

const API_BASE = 'http://localhost:8000/api/v1';

describe('认证 API 集成测试', () => {
  describe('POST /auth/login', () => {
    it('应该使用有效凭据成功登录', async () => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockUsers[0].email,
          password: 'password123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('user');
      expect(data.data).toHaveProperty('accessToken');
      expect(data.data).toHaveProperty('refreshToken');
      expect(data.data).toHaveProperty('expiresIn');
      expect(data.data.user.email).toBe(mockUsers[0].email);
    });

    it('应该使用无效凭据拒绝登录', async () => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('应该处理网络错误', async () => {
      // 模拟网络错误
      server.use(
        http.post(`${API_BASE}/auth/login`, () => {
          return HttpResponse.error();
        })
      );

      await expect(
        fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mockUsers[0].email,
            password: 'password123',
          }),
        })
      ).rejects.toThrow();
    });

    it('应该处理服务器错误', async () => {
      server.use(
        http.post(`${API_BASE}/auth/login`, () => {
          return HttpResponse.json(
            { success: false, error: '服务器内部错误' },
            { status: 500 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mockUsers[0].email,
          password: 'password123',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('POST /auth/register', () => {
    it('应该使用有效数据成功注册新用户', async () => {
      const newUser = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toMatchObject({
        username: newUser.username,
        email: newUser.email,
      });
      expect(data.data).toHaveProperty('accessToken');
      expect(data.data).toHaveProperty('refreshToken');
    });

    it('应该拒绝重复的邮箱', async () => {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'newuser',
          email: mockUsers[0].email, // 使用已存在的邮箱
          password: 'password123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('已存在');
    });

    it('应该拒绝重复的用户名', async () => {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: mockUsers[0].username, // 使用已存在的用户名
          email: 'newemail@example.com',
          password: 'password123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('已存在');
    });
  });

  describe('POST /auth/logout', () => {
    it('应该成功登出', async () => {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /auth/refresh', () => {
    it('应该使用有效的刷新令牌刷新访问令牌', async () => {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: 'valid-refresh-token',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('accessToken');
      expect(data.data).toHaveProperty('refreshToken');
      expect(data.data).toHaveProperty('expiresIn');
    });

    it('应该拒绝无效的刷新令牌', async () => {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: 'invalid-token',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });
  });

  describe('GET /auth/me', () => {
    it('应该返回经过认证的用户信息', async () => {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer mock-access-token',
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('email');
      expect(data.data).toHaveProperty('username');
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('应该拒绝无效的令牌', async () => {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: 'InvalidToken',
        },
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('密码重置流程', () => {
    describe('POST /auth/password-reset/request', () => {
      it('应该发送密码重置邮件', async () => {
        const response = await fetch(`${API_BASE}/auth/password-reset/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mockUsers[0].email,
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBeTruthy();
      });

      it('应该即使邮箱不存在也返回成功（安全性）', async () => {
        const response = await fetch(`${API_BASE}/auth/password-reset/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nonexistent@example.com',
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });

    describe('POST /auth/password-reset/confirm', () => {
      it('应该使用有效令牌重置密码', async () => {
        const response = await fetch(`${API_BASE}/auth/password-reset/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'valid-reset-token',
            newPassword: 'newpassword123',
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('应该拒绝无效的重置令牌', async () => {
        const response = await fetch(`${API_BASE}/auth/password-reset/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'invalid-token',
            newPassword: 'newpassword123',
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });
    });
  });

  describe('POST /auth/password/change', () => {
    it('应该使用正确的当前密码修改密码', async () => {
      const response = await fetch(`${API_BASE}/auth/password/change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          currentPassword: 'password123',
          newPassword: 'newpassword456',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该拒绝不正确的当前密码', async () => {
      const response = await fetch(`${API_BASE}/auth/password/change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('邮箱验证流程', () => {
    describe('POST /auth/email/verify', () => {
      it('应该使用有效令牌验证邮箱', async () => {
        const response = await fetch(`${API_BASE}/auth/email/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'valid-verification-token',
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('应该拒绝无效的验证令牌', async () => {
        const response = await fetch(`${API_BASE}/auth/email/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: 'invalid-token',
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });
    });

    describe('POST /auth/email/resend', () => {
      it('应该重新发送验证邮件', async () => {
        const response = await fetch(`${API_BASE}/auth/email/resend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: mockUsers[0].email,
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('应该拒绝不存在的邮箱', async () => {
        const response = await fetch(`${API_BASE}/auth/email/resend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nonexistent@example.com',
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });
    });
  });
});

