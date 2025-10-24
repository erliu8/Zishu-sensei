/**
 * 社交功能 API Mock 处理器
 * @module tests/mocks/handlers/social
 */

import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * 社交相关的MSW handlers (关注、点赞、收藏等)
 */
export const socialHandlers = [
  // 关注用户
  http.post(`${API_BASE}/users/:userId/follow`, ({ request, params }) => {
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
      message: '关注成功',
    });
  }),

  // 取消关注用户
  http.delete(`${API_BASE}/users/:userId/follow`, ({ request, params }) => {
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
      message: '取消关注成功',
    });
  }),

  // 获取关注列表
  http.get(`${API_BASE}/users/:userId/following`, ({ request, params }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const mockFollowing = Array.from({ length: 50 }, (_, i) => ({
      id: `user-${i}`,
      username: `user${i}`,
      displayName: `User ${i}`,
      avatar: null,
      followedAt: new Date(Date.now() - i * 86400000).toISOString(),
    }));

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedFollowing = mockFollowing.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        users: paginatedFollowing,
        total: mockFollowing.length,
        page,
        pageSize,
        totalPages: Math.ceil(mockFollowing.length / pageSize),
      },
    });
  }),

  // 获取粉丝列表
  http.get(`${API_BASE}/users/:userId/followers`, ({ request, params }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const mockFollowers = Array.from({ length: 80 }, (_, i) => ({
      id: `follower-${i}`,
      username: `follower${i}`,
      displayName: `Follower ${i}`,
      avatar: null,
      followedAt: new Date(Date.now() - i * 86400000).toISOString(),
    }));

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedFollowers = mockFollowers.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        users: paginatedFollowers,
        total: mockFollowers.length,
        page,
        pageSize,
        totalPages: Math.ceil(mockFollowers.length / pageSize),
      },
    });
  }),

  // 检查是否关注
  http.get(`${API_BASE}/users/:userId/is-following`, ({ request, params }) => {
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
        isFollowing: false,
      },
    });
  }),
];

