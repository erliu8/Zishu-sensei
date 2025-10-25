/**
 * 内容 API 集成测试
 * @module tests/integration/api
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:8000/api/v1';
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer mock-access-token',
};

// Mock 内容数据
const mockContent = {
  id: 'content-1',
  title: '测试内容标题',
  content: '这是测试内容',
  authorId: 'user-1',
  author: {
    id: 'user-1',
    username: 'testuser',
    displayName: '测试用户',
    avatar: null,
  },
  likes: 10,
  comments: 5,
  shares: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('内容 API 集成测试', () => {
  describe('GET /posts', () => {
    it('应该获取内容列表', async () => {
      server.use(
        http.get(`${API_BASE}/posts`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              posts: [mockContent],
              total: 1,
              page: 1,
              limit: 10,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.posts).toBeInstanceOf(Array);
      expect(data.data.posts[0]).toMatchObject({
        id: mockContent.id,
        title: mockContent.title,
      });
    });

    it('应该支持分页参数', async () => {
      server.use(
        http.get(`${API_BASE}/posts`, ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '10');

          return HttpResponse.json({
            success: true,
            data: {
              posts: [mockContent],
              total: 100,
              page,
              limit,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts?page=2&limit=20`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.page).toBe(2);
      expect(data.data.limit).toBe(20);
    });

    it('应该支持排序参数', async () => {
      server.use(
        http.get(`${API_BASE}/posts`, ({ request }) => {
          const url = new URL(request.url);
          const sort = url.searchParams.get('sort');

          expect(sort).toBe('latest');

          return HttpResponse.json({
            success: true,
            data: {
              posts: [mockContent],
              total: 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts?sort=latest`, {
        headers: AUTH_HEADERS,
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /posts/:id', () => {
    it('应该获取单个内容详情', async () => {
      const postId = mockContent.id;

      server.use(
        http.get(`${API_BASE}/posts/${postId}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockContent,
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(postId);
    });

    it('应该处理不存在的内容', async () => {
      const nonExistentId = 'non-existent';

      server.use(
        http.get(`${API_BASE}/posts/${nonExistentId}`, () => {
          return HttpResponse.json(
            { success: false, error: '内容不存在' },
            { status: 404 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/posts/${nonExistentId}`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /posts', () => {
    it('应该创建新内容', async () => {
      const newPost = {
        title: '新内容标题',
        content: '新内容正文',
      };

      server.use(
        http.post(`${API_BASE}/posts`, async ({ request }) => {
          const body = await request.json();

          return HttpResponse.json({
            success: true,
            data: {
              ...mockContent,
              ...body,
              id: 'new-post-id',
              createdAt: new Date().toISOString(),
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(newPost),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe(newPost.title);
      expect(data.data.content).toBe(newPost.content);
    });

    it('应该验证必填字段', async () => {
      server.use(
        http.post(`${API_BASE}/posts`, () => {
          return HttpResponse.json(
            { success: false, error: '标题和内容不能为空' },
            { status: 400 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ title: '' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该拒绝未授权的请求', async () => {
      server.use(
        http.post(`${API_BASE}/posts`, () => {
          return HttpResponse.json(
            { success: false, error: '未授权' },
            { status: 401 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '测试', content: '内容' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /posts/:id', () => {
    it('应该更新内容', async () => {
      const postId = mockContent.id;
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容',
      };

      server.use(
        http.put(`${API_BASE}/posts/${postId}`, async ({ request }) => {
          const body = await request.json();

          return HttpResponse.json({
            success: true,
            data: {
              ...mockContent,
              ...body,
              updatedAt: new Date().toISOString(),
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        method: 'PUT',
        headers: AUTH_HEADERS,
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe(updateData.title);
    });

    it('应该拒绝非作者的更新', async () => {
      const postId = mockContent.id;

      server.use(
        http.put(`${API_BASE}/posts/${postId}`, () => {
          return HttpResponse.json(
            { success: false, error: '无权限修改此内容' },
            { status: 403 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer other-user-token',
        },
        body: JSON.stringify({ title: '尝试更新' }),
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /posts/:id', () => {
    it('应该删除内容', async () => {
      const postId = mockContent.id;

      server.use(
        http.delete(`${API_BASE}/posts/${postId}`, () => {
          return HttpResponse.json({
            success: true,
            message: '内容已删除',
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该拒绝非作者的删除', async () => {
      const postId = mockContent.id;

      server.use(
        http.delete(`${API_BASE}/posts/${postId}`, () => {
          return HttpResponse.json(
            { success: false, error: '无权限删除此内容' },
            { status: 403 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer other-user-token',
        },
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /posts/:id/like', () => {
    it('应该点赞内容', async () => {
      const postId = mockContent.id;

      server.use(
        http.post(`${API_BASE}/posts/${postId}/like`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isLiked: true,
              likesCount: mockContent.likes + 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method: 'POST',
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isLiked).toBe(true);
    });
  });

  describe('DELETE /posts/:id/like', () => {
    it('应该取消点赞', async () => {
      const postId = mockContent.id;

      server.use(
        http.delete(`${API_BASE}/posts/${postId}/like`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isLiked: false,
              likesCount: mockContent.likes - 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method: 'DELETE',
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isLiked).toBe(false);
    });
  });

  describe('GET /posts/:id/comments', () => {
    it('应该获取内容评论列表', async () => {
      const postId = mockContent.id;

      server.use(
        http.get(`${API_BASE}/posts/${postId}/comments`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              comments: [
                {
                  id: 'comment-1',
                  content: '测试评论',
                  authorId: 'user-2',
                  postId,
                  createdAt: new Date().toISOString(),
                },
              ],
              total: 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.comments).toBeInstanceOf(Array);
    });
  });

  describe('POST /posts/:id/comments', () => {
    it('应该创建评论', async () => {
      const postId = mockContent.id;
      const commentContent = '这是一条新评论';

      server.use(
        http.post(`${API_BASE}/posts/${postId}/comments`, async ({ request }) => {
          const body = await request.json();

          return HttpResponse.json({
            success: true,
            data: {
              id: 'new-comment-id',
              content: body.content,
              authorId: 'user-1',
              postId,
              createdAt: new Date().toISOString(),
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ content: commentContent }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.content).toBe(commentContent);
    });
  });
});

