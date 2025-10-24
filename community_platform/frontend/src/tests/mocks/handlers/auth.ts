/**
 * 认证 API Mock 处理器
 * @module tests/mocks/handlers/auth
 */

import { http, HttpResponse } from 'msw';
import { mockUsers } from '../data/users';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * 认证相关的MSW handlers
 */
export const authHandlers = [
  // 登录
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    
    const user = mockUsers.find(
      (u) => u.email === body.email && body.password === 'password123'
    );

    if (!user) {
      return HttpResponse.json(
        {
          success: false,
          error: '邮箱或密码错误',
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        user,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
      },
    });
  }),

  // 注册
  http.post(`${API_BASE}/auth/register`, async ({ request }) => {
    const body = await request.json() as {
      username: string;
      email: string;
      password: string;
    };

    const existingUser = mockUsers.find(
      (u) => u.email === body.email || u.username === body.username
    );

    if (existingUser) {
      return HttpResponse.json(
        {
          success: false,
          error: '用户名或邮箱已存在',
        },
        { status: 409 }
      );
    }

    const newUser = {
      id: `user-${Date.now()}`,
      username: body.username,
      email: body.email,
      displayName: body.username,
      avatar: null,
      bio: '',
      isEmailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      data: {
        user: newUser,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
      },
    });
  }),

  // 登出
  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({
      success: true,
      message: '登出成功',
    });
  }),

  // 刷新令牌
  http.post(`${API_BASE}/auth/refresh`, async ({ request }) => {
    const body = await request.json() as { refreshToken: string };

    if (!body.refreshToken || body.refreshToken === 'invalid-token') {
      return HttpResponse.json(
        {
          success: false,
          error: '无效的刷新令牌',
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        accessToken: 'new-mock-access-token',
        refreshToken: 'new-mock-refresh-token',
        expiresIn: 3600,
      },
    });
  }),

  // 获取当前用户
  http.get(`${API_BASE}/auth/me`, ({ request }) => {
    const token = request.headers.get('Authorization');

    if (!token || !token.includes('Bearer')) {
      return HttpResponse.json(
        {
          success: false,
          error: '未授权',
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockUsers[0],
    });
  }),

  // 请求密码重置
  http.post(`${API_BASE}/auth/password-reset/request`, async ({ request }) => {
    const body = await request.json() as { email: string };

    const user = mockUsers.find((u) => u.email === body.email);

    if (!user) {
      // 为了安全，即使用户不存在也返回成功
      return HttpResponse.json({
        success: true,
        message: '如果该邮箱存在，重置链接已发送',
      });
    }

    return HttpResponse.json({
      success: true,
      message: '密码重置链接已发送到您的邮箱',
    });
  }),

  // 确认密码重置
  http.post(`${API_BASE}/auth/password-reset/confirm`, async ({ request }) => {
    const body = await request.json() as {
      token: string;
      newPassword: string;
    };

    if (!body.token || body.token === 'invalid-token') {
      return HttpResponse.json(
        {
          success: false,
          error: '无效或过期的重置令牌',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '密码已成功重置',
    });
  }),

  // 修改密码
  http.post(`${API_BASE}/auth/password/change`, async ({ request }) => {
    const body = await request.json() as {
      currentPassword: string;
      newPassword: string;
    };

    if (body.currentPassword !== 'password123') {
      return HttpResponse.json(
        {
          success: false,
          error: '当前密码不正确',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '密码已成功修改',
    });
  }),

  // 验证邮箱
  http.post(`${API_BASE}/auth/email/verify`, async ({ request }) => {
    const body = await request.json() as { token: string };

    if (!body.token || body.token === 'invalid-token') {
      return HttpResponse.json(
        {
          success: false,
          error: '无效或过期的验证令牌',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '邮箱验证成功',
    });
  }),

  // 重新发送验证邮件
  http.post(`${API_BASE}/auth/email/resend`, async ({ request }) => {
    const body = await request.json() as { email: string };

    const user = mockUsers.find((u) => u.email === body.email);

    if (!user) {
      return HttpResponse.json(
        {
          success: false,
          error: '用户不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '验证邮件已重新发送',
    });
  }),
];

