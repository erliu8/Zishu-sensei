/**
 * 用户 API Mock 处理器
 * @module tests/mocks/handlers/user
 */

import { http, HttpResponse } from 'msw';
import { mockUsers } from '../data/users';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * 用户相关的MSW handlers
 */
export const userHandlers = [
  // 获取当前用户资料
  http.get(`${API_BASE}/users/me`, ({ request }) => {
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
      data: {
        data: mockUsers[0],
      },
    });
  }),

  // 获取指定用户资料
  http.get(`${API_BASE}/users/:userId`, ({ params }) => {
    const { userId } = params;
    const user = mockUsers.find((u) => u.id === userId);

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
      data: {
        data: user,
      },
    });
  }),

  // 获取用户列表
  http.get(`${API_BASE}/users`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedUsers = mockUsers.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          users: paginatedUsers,
          total: mockUsers.length,
          page,
          pageSize,
          totalPages: Math.ceil(mockUsers.length / pageSize),
        },
      },
    });
  }),

  // 搜索用户
  http.get(`${API_BASE}/users/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);

    const filteredUsers = mockUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(query.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
    );

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedUsers = filteredUsers.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          users: paginatedUsers,
          total: filteredUsers.length,
          page,
          pageSize,
          totalPages: Math.ceil(filteredUsers.length / pageSize),
        },
      },
    });
  }),

  // 更新个人资料
  http.put(`${API_BASE}/users/me/profile`, async ({ request }) => {
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

    const body = await request.json() as Partial<typeof mockUsers[0]>;
    const updatedUser = { ...mockUsers[0], ...body };

    return HttpResponse.json({
      success: true,
      data: {
        data: updatedUser,
      },
    });
  }),

  // 上传头像
  http.post(`${API_BASE}/users/me/avatar`, async ({ request }) => {
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
      data: {
        data: {
          avatarUrl: 'https://example.com/avatars/new-avatar.jpg',
        },
      },
    });
  }),

  // 删除头像
  http.delete(`${API_BASE}/users/me/avatar`, ({ request }) => {
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
      message: '头像已删除',
    });
  }),

  // 更新密码
  http.put(`${API_BASE}/users/me/password`, async ({ request }) => {
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
      message: '密码已更新',
    });
  }),

  // 更新邮箱
  http.put(`${API_BASE}/users/me/email`, async ({ request }) => {
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

    const body = await request.json() as {
      newEmail: string;
      password: string;
    };

    if (body.password !== 'password123') {
      return HttpResponse.json(
        {
          success: false,
          error: '密码不正确',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '邮箱已更新',
    });
  }),

  // 获取用户偏好设置
  http.get(`${API_BASE}/users/me/preferences`, ({ request }) => {
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
      data: {
        data: {
          theme: 'light',
          language: 'zh-CN',
          emailNotifications: true,
          pushNotifications: false,
        },
      },
    });
  }),

  // 更新偏好设置
  http.put(`${API_BASE}/users/me/preferences`, async ({ request }) => {
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

    const body = await request.json();

    return HttpResponse.json({
      success: true,
      data: {
        data: body,
      },
    });
  }),

  // 获取用户统计信息
  http.get(`${API_BASE}/users/:userId/stats`, ({ params }) => {
    const { userId } = params;

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          userId,
          postsCount: 42,
          followersCount: 128,
          followingCount: 95,
          likesReceived: 567,
          commentsCount: 234,
        },
      },
    });
  }),

  // 获取用户活动记录
  http.get(`${API_BASE}/users/:userId/activities`, ({ request, params }) => {
    const { userId } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const mockActivities = Array.from({ length: 50 }, (_, i) => ({
      id: `activity-${i}`,
      userId,
      type: ['post', 'comment', 'like', 'follow'][i % 4],
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      metadata: {},
    }));

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedActivities = mockActivities.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          activities: paginatedActivities,
          total: mockActivities.length,
          hasMore: end < mockActivities.length,
        },
      },
    });
  }),

  // 删除账号
  http.delete(`${API_BASE}/users/me`, async ({ request }) => {
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

    const body = await request.json() as { password: string };

    if (body.password !== 'password123') {
      return HttpResponse.json(
        {
          success: false,
          error: '密码不正确',
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '账号已删除',
    });
  }),

  // 获取用户会话列表
  http.get(`${API_BASE}/users/me/sessions`, ({ request }) => {
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

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);

    const mockSessions = [
      {
        id: 'session-1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ipAddress: '192.168.1.1',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        isCurrent: true,
      },
      {
        id: 'session-2',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        ipAddress: '192.168.1.2',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
        isCurrent: false,
      },
    ];

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          sessions: mockSessions,
          total: mockSessions.length,
          page,
          pageSize,
          totalPages: 1,
        },
      },
    });
  }),

  // 删除指定会话
  http.delete(`${API_BASE}/users/me/sessions/:sessionId`, ({ request, params }) => {
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
      message: '会话已删除',
    });
  }),

  // 删除所有其他会话
  http.delete(`${API_BASE}/users/me/sessions/others`, ({ request }) => {
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
      message: '所有其他会话已删除',
    });
  }),

  // 获取登录历史
  http.get(`${API_BASE}/users/me/login-history`, ({ request }) => {
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

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const mockHistory = Array.from({ length: 30 }, (_, i) => ({
      id: `history-${i}`,
      userAgent: 'Mozilla/5.0',
      ipAddress: `192.168.1.${i}`,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      success: true,
    }));

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedHistory = mockHistory.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          history: paginatedHistory,
          total: mockHistory.length,
          page,
          pageSize,
          totalPages: Math.ceil(mockHistory.length / pageSize),
        },
      },
    });
  }),
];

