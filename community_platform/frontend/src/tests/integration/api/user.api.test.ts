/**
 * 用户 API 集成测试
 * @module tests/integration/api
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';

const API_BASE = 'http://localhost:8000/api/v1';
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer mock-access-token',
};

describe('用户 API 集成测试', () => {
  describe('GET /users/:id', () => {
    it('应该获取用户信息', async () => {
      const userId = mockUsers[0].id;
      
      server.use(
        http.get(`${API_BASE}/users/${userId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUsers[0],
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        id: userId,
        username: mockUsers[0].username,
        email: mockUsers[0].email,
      });
    });

    it('应该处理不存在的用户', async () => {
      const nonExistentId = 'non-existent-id';

      server.use(
        http.get(`${API_BASE}/users/${nonExistentId}`, () => {
          return HttpResponse.json(
            { success: false, error: '用户不存在' },
            { status: 404 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/users/${nonExistentId}`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /users/:id', () => {
    it('应该更新用户信息', async () => {
      const userId = mockUsers[0].id;
      const updateData = {
        displayName: '新的显示名称',
        bio: '这是我的新简介',
      };

      server.use(
        http.put(`${API_BASE}/users/${userId}`, async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            success: true,
            data: {
              ...mockUsers[0],
              ...body,
              updatedAt: new Date().toISOString(),
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: AUTH_HEADERS,
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.displayName).toBe(updateData.displayName);
      expect(data.data.bio).toBe(updateData.bio);
    });

    it('应该拒绝未授权的更新', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.put(`${API_BASE}/users/${userId}`, () => {
          return HttpResponse.json(
            { success: false, error: '未授权' },
            { status: 403 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: '新名称' }),
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /users/:id/followers', () => {
    it('应该获取用户的关注者列表', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.get(`${API_BASE}/users/${userId}/followers`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              followers: [mockUsers[1], mockUsers[2]],
              total: 2,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/followers`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.followers).toHaveLength(2);
      expect(data.data.total).toBe(2);
    });

    it('应该支持分页', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.get(`${API_BASE}/users/${userId}/followers`, ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '10');

          return HttpResponse.json({
            success: true,
            data: {
              followers: mockUsers.slice((page - 1) * limit, page * limit),
              total: mockUsers.length,
              page,
              limit,
            },
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/users/${userId}/followers?page=1&limit=2`,
        { headers: AUTH_HEADERS }
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.page).toBe(1);
      expect(data.data.limit).toBe(2);
      expect(data.data.followers.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /users/:id/following', () => {
    it('应该获取用户关注的人列表', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.get(`${API_BASE}/users/${userId}/following`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              following: [mockUsers[1]],
              total: 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/following`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.following).toHaveLength(1);
    });
  });

  describe('POST /users/:id/follow', () => {
    it('应该成功关注用户', async () => {
      const userId = mockUsers[1].id;

      server.use(
        http.post(`${API_BASE}/users/${userId}/follow`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isFollowing: true,
              followerCount: 10,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/follow`, {
        method: 'POST',
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isFollowing).toBe(true);
    });

    it('应该拒绝关注自己', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.post(`${API_BASE}/users/${userId}/follow`, () => {
          return HttpResponse.json(
            { success: false, error: '不能关注自己' },
            { status: 400 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/follow`, {
        method: 'POST',
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /users/:id/follow', () => {
    it('应该成功取消关注用户', async () => {
      const userId = mockUsers[1].id;

      server.use(
        http.delete(`${API_BASE}/users/${userId}/follow`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isFollowing: false,
              followerCount: 9,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/follow`, {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isFollowing).toBe(false);
    });
  });

  describe('GET /users/search', () => {
    it('应该搜索用户', async () => {
      const searchQuery = 'test';

      server.use(
        http.get(`${API_BASE}/users/search`, ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('q');

          const filteredUsers = mockUsers.filter(
            (user) =>
              user.username.includes(query || '') ||
              user.displayName?.includes(query || '')
          );

          return HttpResponse.json({
            success: true,
            data: {
              users: filteredUsers,
              total: filteredUsers.length,
            },
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/users/search?q=${searchQuery}`,
        { headers: AUTH_HEADERS }
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.users).toBeInstanceOf(Array);
    });

    it('应该返回空结果当没有匹配时', async () => {
      server.use(
        http.get(`${API_BASE}/users/search`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              users: [],
              total: 0,
            },
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/users/search?q=nonexistent`,
        { headers: AUTH_HEADERS }
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.users).toHaveLength(0);
    });
  });

  describe('GET /users/:id/stats', () => {
    it('应该获取用户统计信息', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.get(`${API_BASE}/users/${userId}/stats`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              postsCount: 42,
              followersCount: 100,
              followingCount: 50,
              likesReceived: 250,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/stats`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('postsCount');
      expect(data.data).toHaveProperty('followersCount');
      expect(data.data).toHaveProperty('followingCount');
    });
  });

  describe('POST /users/:id/avatar', () => {
    it('应该上传用户头像', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.post(`${API_BASE}/users/${userId}/avatar`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              avatar: 'https://example.com/avatars/new-avatar.jpg',
            },
          });
        })
      );

      const formData = new FormData();
      formData.append('avatar', new Blob(['fake-image-data']), 'avatar.jpg');

      const response = await fetch(`${API_BASE}/users/${userId}/avatar`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-access-token',
        },
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.avatar).toBeTruthy();
    });

    it('应该验证文件类型', async () => {
      const userId = mockUsers[0].id;

      server.use(
        http.post(`${API_BASE}/users/${userId}/avatar`, () => {
          return HttpResponse.json(
            { success: false, error: '不支持的文件类型' },
            { status: 400 }
          );
        })
      );

      const formData = new FormData();
      formData.append('avatar', new Blob(['fake-data']), 'file.txt');

      const response = await fetch(`${API_BASE}/users/${userId}/avatar`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-access-token',
        },
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });
});

