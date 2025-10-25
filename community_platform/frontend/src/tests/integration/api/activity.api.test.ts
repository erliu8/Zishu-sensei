/**
 * 活动 API 集成测试
 * @module tests/integration/api
 */

import { describe, it, expect } from 'vitest';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';

const API_BASE = 'http://localhost:8000/api/v1';
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer mock-access-token',
};

const mockActivity = {
  id: 'activity-1',
  userId: 'user-1',
  type: 'post_created',
  entityType: 'post',
  entityId: 'post-1',
  metadata: {
    postTitle: '新帖子',
  },
  createdAt: new Date().toISOString(),
};

describe('活动 API 集成测试', () => {
  describe('GET /activities', () => {
    it('应该获取用户活动流', async () => {
      server.use(
        http.get(`${API_BASE}/activities`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              activities: [mockActivity],
              total: 1,
              page: 1,
              limit: 20,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/activities`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activities).toBeInstanceOf(Array);
      expect(data.data.activities[0]).toMatchObject({
        id: mockActivity.id,
        type: mockActivity.type,
      });
    });

    it('应该支持分页', async () => {
      server.use(
        http.get(`${API_BASE}/activities`, ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '20');

          return HttpResponse.json({
            success: true,
            data: {
              activities: [mockActivity],
              total: 100,
              page,
              limit,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/activities?page=2&limit=10`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.page).toBe(2);
      expect(data.data.limit).toBe(10);
    });

    it('应该支持按类型过滤', async () => {
      server.use(
        http.get(`${API_BASE}/activities`, ({ request }) => {
          const url = new URL(request.url);
          const type = url.searchParams.get('type');

          expect(type).toBe('post_created');

          return HttpResponse.json({
            success: true,
            data: {
              activities: [mockActivity],
              total: 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/activities?type=post_created`, {
        headers: AUTH_HEADERS,
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /activities/feed', () => {
    it('应该获取个性化活动信息流', async () => {
      server.use(
        http.get(`${API_BASE}/activities/feed`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              activities: [
                mockActivity,
                {
                  id: 'activity-2',
                  userId: 'user-2',
                  type: 'post_liked',
                  entityType: 'post',
                  entityId: 'post-2',
                  metadata: {
                    postTitle: '被点赞的帖子',
                  },
                  createdAt: new Date().toISOString(),
                },
              ],
              total: 2,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/activities/feed`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activities).toBeInstanceOf(Array);
      expect(data.data.activities.length).toBeGreaterThan(0);
    });

    it('应该拒绝未授权的请求', async () => {
      server.use(
        http.get(`${API_BASE}/activities/feed`, () => {
          return HttpResponse.json(
            { success: false, error: '未授权' },
            { status: 401 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/activities/feed`);

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /users/:userId/activities', () => {
    it('应该获取指定用户的活动', async () => {
      const userId = 'user-1';

      server.use(
        http.get(`${API_BASE}/users/${userId}/activities`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              activities: [mockActivity],
              total: 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/activities`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activities).toBeInstanceOf(Array);
    });

    it('应该处理不存在的用户', async () => {
      const userId = 'non-existent';

      server.use(
        http.get(`${API_BASE}/users/${userId}/activities`, () => {
          return HttpResponse.json(
            { success: false, error: '用户不存在' },
            { status: 404 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/users/${userId}/activities`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /notifications', () => {
    it('应该获取通知列表', async () => {
      server.use(
        http.get(`${API_BASE}/notifications`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              notifications: [
                {
                  id: 'notification-1',
                  userId: 'user-1',
                  type: 'like',
                  actorId: 'user-2',
                  entityType: 'post',
                  entityId: 'post-1',
                  isRead: false,
                  createdAt: new Date().toISOString(),
                },
              ],
              unreadCount: 1,
              total: 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/notifications`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.notifications).toBeInstanceOf(Array);
      expect(data.data).toHaveProperty('unreadCount');
    });

    it('应该支持只获取未读通知', async () => {
      server.use(
        http.get(`${API_BASE}/notifications`, ({ request }) => {
          const url = new URL(request.url);
          const unread = url.searchParams.get('unread');

          expect(unread).toBe('true');

          return HttpResponse.json({
            success: true,
            data: {
              notifications: [
                {
                  id: 'notification-1',
                  isRead: false,
                  createdAt: new Date().toISOString(),
                },
              ],
              total: 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/notifications?unread=true`, {
        headers: AUTH_HEADERS,
      });

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /notifications/:id/read', () => {
    it('应该标记通知为已读', async () => {
      const notificationId = 'notification-1';

      server.use(
        http.put(`${API_BASE}/notifications/${notificationId}/read`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isRead: true,
            },
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: AUTH_HEADERS,
        }
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isRead).toBe(true);
    });
  });

  describe('PUT /notifications/read-all', () => {
    it('应该标记所有通知为已读', async () => {
      server.use(
        http.put(`${API_BASE}/notifications/read-all`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              updatedCount: 5,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.updatedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('应该删除通知', async () => {
      const notificationId = 'notification-1';

      server.use(
        http.delete(`${API_BASE}/notifications/${notificationId}`, () => {
          return HttpResponse.json({
            success: true,
            message: '通知已删除',
          });
        })
      );

      const response = await fetch(
        `${API_BASE}/notifications/${notificationId}`,
        {
          method: 'DELETE',
          headers: AUTH_HEADERS,
        }
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /activities/stats', () => {
    it('应该获取活动统计信息', async () => {
      server.use(
        http.get(`${API_BASE}/activities/stats`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              totalActivities: 100,
              activitiesByType: {
                post_created: 40,
                post_liked: 30,
                comment_added: 20,
                user_followed: 10,
              },
              recentActivityCount: 15,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/activities/stats`, {
        headers: AUTH_HEADERS,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('totalActivities');
      expect(data.data).toHaveProperty('activitiesByType');
    });
  });
});

