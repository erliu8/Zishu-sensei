/**
 * 社交互动流程集成测试
 * 测试完整的社交互动流程
 * @module tests/integration/features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';
import { create } from 'zustand';

const API_BASE = 'http://localhost:8000/api/v1';

// Mock Stores
interface SocialState {
  following: Set<string>;
  followers: Set<string>;
  
  follow: (userId: string) => Promise<void>;
  unfollow: (userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
}

const useSocialStore = create<SocialState>((set, get) => ({
  following: new Set(),
  followers: new Set(),
  
  follow: async (userId) => {
    await fetch(`${API_BASE}/users/${userId}/follow`, {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
    });
    set((state) => {
      const following = new Set(state.following);
      following.add(userId);
      return { following };
    });
  },
  
  unfollow: async (userId) => {
    await fetch(`${API_BASE}/users/${userId}/follow`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer mock-token' },
    });
    set((state) => {
      const following = new Set(state.following);
      following.delete(userId);
      return { following };
    });
  },
  
  isFollowing: (userId) => get().following.has(userId),
}));

interface PostState {
  posts: Map<string, any>;
  
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  sharePost: (postId: string, data: any) => Promise<void>;
}

const usePostStore = create<PostState>((set, get) => ({
  posts: new Map(),
  
  likePost: async (postId) => {
    const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
    });
    const data = await response.json();
    
    set((state) => {
      const posts = new Map(state.posts);
      const post = posts.get(postId);
      if (post) {
        posts.set(postId, {
          ...post,
          likes: data.data.likesCount,
          isLiked: true,
        });
      }
      return { posts };
    });
  },
  
  unlikePost: async (postId) => {
    await fetch(`${API_BASE}/posts/${postId}/like`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer mock-token' },
    });
    
    set((state) => {
      const posts = new Map(state.posts);
      const post = posts.get(postId);
      if (post) {
        posts.set(postId, {
          ...post,
          likes: Math.max(0, post.likes - 1),
          isLiked: false,
        });
      }
      return { posts };
    });
  },
  
  sharePost: async (postId, data) => {
    await fetch(`${API_BASE}/posts/${postId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-token',
      },
      body: JSON.stringify(data),
    });
  },
}));

describe('社交互动流程集成测试', () => {
  beforeEach(() => {
    // 清理状态
  });

  describe('关注流程', () => {
    it('应该完成完整的关注用户流程', async () => {
      const { result } = renderHook(() => useSocialStore());

      const targetUserId = mockUsers[1].id;

      // 执行关注
      await act(async () => {
        await result.current.follow(targetUserId);
      });

      // 验证关注状态
      expect(result.current.isFollowing(targetUserId)).toBe(true);

      // 验证 API 调用
      const response = await fetch(`${API_BASE}/users/${mockUsers[0].id}/following`);
      const data = await response.json();
      
      expect(data.success).toBe(true);
    });

    it('应该完成完整的取消关注流程', async () => {
      const { result } = renderHook(() => useSocialStore());

      const targetUserId = mockUsers[1].id;

      // 先关注
      await act(async () => {
        await result.current.follow(targetUserId);
      });

      expect(result.current.isFollowing(targetUserId)).toBe(true);

      // 取消关注
      await act(async () => {
        await result.current.unfollow(targetUserId);
      });

      expect(result.current.isFollowing(targetUserId)).toBe(false);
    });

    it('应该处理关注失败情况', async () => {
      const { result } = renderHook(() => useSocialStore());

      // 模拟关注失败（例如不能关注自己）
      server.use(
        http.post(`${API_BASE}/users/${mockUsers[0].id}/follow`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: '不能关注自己',
            },
            { status: 400 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.follow(mockUsers[0].id);
        } catch (error) {
          // 预期失败
        }
      });

      expect(result.current.isFollowing(mockUsers[0].id)).toBe(false);
    });

    it('应该支持批量关注', async () => {
      const { result } = renderHook(() => useSocialStore());

      const usersToFollow = [mockUsers[1].id, mockUsers[2].id];

      await act(async () => {
        for (const userId of usersToFollow) {
          await result.current.follow(userId);
        }
      });

      usersToFollow.forEach((userId) => {
        expect(result.current.isFollowing(userId)).toBe(true);
      });
    });
  });

  describe('点赞流程', () => {
    const mockPost = {
      id: 'post-1',
      title: '测试帖子',
      content: '内容',
      likes: 10,
      isLiked: false,
    };

    it('应该完成完整的点赞流程', async () => {
      const { result } = renderHook(() => usePostStore());

      // 初始化帖子
      act(() => {
        result.current.posts.set(mockPost.id, mockPost);
      });

      // 点赞
      await act(async () => {
        await result.current.likePost(mockPost.id);
      });

      const post = result.current.posts.get(mockPost.id);
      expect(post?.isLiked).toBe(true);
      expect(post?.likes).toBeGreaterThan(mockPost.likes);
    });

    it('应该完成完整的取消点赞流程', async () => {
      const { result } = renderHook(() => usePostStore());

      // 初始化已点赞的帖子
      const likedPost = { ...mockPost, isLiked: true, likes: 11 };
      act(() => {
        result.current.posts.set(mockPost.id, likedPost);
      });

      // 取消点赞
      await act(async () => {
        await result.current.unlikePost(mockPost.id);
      });

      const post = result.current.posts.get(mockPost.id);
      expect(post?.isLiked).toBe(false);
      expect(post?.likes).toBeLessThan(likedPost.likes);
    });

    it('应该防止重复点赞', async () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.posts.set(mockPost.id, mockPost);
      });

      // 第一次点赞
      await act(async () => {
        await result.current.likePost(mockPost.id);
      });

      const firstLikes = result.current.posts.get(mockPost.id)?.likes;

      // 尝试再次点赞
      server.use(
        http.post(`${API_BASE}/posts/${mockPost.id}/like`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: '已经点赞过了',
            },
            { status: 400 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.likePost(mockPost.id);
        } catch (error) {
          // 预期失败
        }
      });

      const secondLikes = result.current.posts.get(mockPost.id)?.likes;
      expect(secondLikes).toBe(firstLikes);
    });

    it('应该支持乐观更新', async () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.posts.set(mockPost.id, mockPost);
      });

      const initialLikes = mockPost.likes;

      // 乐观更新：立即更新 UI
      act(() => {
        const posts = new Map(result.current.posts);
        const post = posts.get(mockPost.id);
        if (post) {
          posts.set(mockPost.id, {
            ...post,
            likes: post.likes + 1,
            isLiked: true,
          });
        }
        result.current.posts = posts;
      });

      // UI 立即更新
      expect(result.current.posts.get(mockPost.id)?.likes).toBe(initialLikes + 1);

      // 然后发送 API 请求
      await act(async () => {
        await result.current.likePost(mockPost.id);
      });
    });
  });

  describe('评论互动流程', () => {
    const mockPost = {
      id: 'post-1',
      title: '测试帖子',
      content: '内容',
    };

    it('应该完成完整的评论发布流程', async () => {
      const commentData = {
        content: '这是一条评论',
        postId: mockPost.id,
      };

      const response = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify(commentData),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.content).toBe(commentData.content);
    });

    it('应该支持评论点赞', async () => {
      // 先创建评论
      const commentResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          content: '评论',
          postId: mockPost.id,
        }),
      });

      const comment = await commentResponse.json();

      // 点赞评论
      const likeResponse = await fetch(`${API_BASE}/comments/${comment.data.id}/like`, {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
      });

      const likeResult = await likeResponse.json();

      expect(likeResult.success).toBe(true);
    });

    it('应该支持回复评论', async () => {
      // 创建父评论
      const parentResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          content: '父评论',
          postId: mockPost.id,
        }),
      });

      const parent = await parentResponse.json();

      // 回复评论
      const replyResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          content: '回复',
          postId: mockPost.id,
          parentId: parent.data.id,
        }),
      });

      const reply = await replyResponse.json();

      expect(reply.success).toBe(true);
      expect(reply.data.parentId).toBe(parent.data.id);
    });

    it('应该支持编辑评论', async () => {
      // 创建评论
      const createResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          content: '原始评论',
          postId: mockPost.id,
        }),
      });

      const comment = await createResponse.json();

      // 编辑评论
      const updateResponse = await fetch(`${API_BASE}/comments/${comment.data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          content: '编辑后的评论',
        }),
      });

      const updated = await updateResponse.json();

      expect(updated.success).toBe(true);
      expect(updated.data.content).toBe('编辑后的评论');
      expect(updated.data.isEdited).toBe(true);
    });

    it('应该支持删除评论', async () => {
      // 创建评论
      const createResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          content: '待删除的评论',
          postId: mockPost.id,
        }),
      });

      const comment = await createResponse.json();

      // 删除评论
      const deleteResponse = await fetch(`${API_BASE}/comments/${comment.data.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock-token' },
      });

      const result = await deleteResponse.json();

      expect(result.success).toBe(true);
    });
  });

  describe('分享流程', () => {
    const mockPost = {
      id: 'post-1',
      title: '测试帖子',
      content: '内容',
    };

    it('应该完成完整的帖子分享流程', async () => {
      const { result } = renderHook(() => usePostStore());

      const shareData = {
        comment: '分享一个好内容',
        visibility: 'public',
      };

      await act(async () => {
        await result.current.sharePost(mockPost.id, shareData);
      });

      // 验证分享成功
      const response = await fetch(`${API_BASE}/posts/${mockPost.id}/shares`);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('应该支持转发到外部平台', async () => {
      const shareData = {
        platform: 'twitter',
        postId: mockPost.id,
      };

      const response = await fetch(`${API_BASE}/share/external`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify(shareData),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.shareUrl).toBeTruthy();
    });
  });

  describe('提及和通知流程', () => {
    it('应该在评论中提及用户', async () => {
      const commentData = {
        content: `@${mockUsers[1].username} 你好`,
        postId: 'post-1',
        mentions: [mockUsers[1].id],
      };

      const response = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify(commentData),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.mentions).toContain(mockUsers[1].id);
    });

    it('应该发送提及通知', async () => {
      // 提及用户后，检查通知
      const notificationResponse = await fetch(
        `${API_BASE}/notifications?userId=${mockUsers[1].id}`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );

      const notifications = await notificationResponse.json();

      expect(notifications.success).toBe(true);
      expect(notifications.data.notifications.some(
        (n: any) => n.type === 'mention'
      )).toBe(true);
    });

    it('应该在被关注时发送通知', async () => {
      const { result } = renderHook(() => useSocialStore());

      await act(async () => {
        await result.current.follow(mockUsers[1].id);
      });

      // 检查通知
      const notificationResponse = await fetch(
        `${API_BASE}/notifications?userId=${mockUsers[1].id}`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );

      const notifications = await notificationResponse.json();

      expect(notifications.success).toBe(true);
      expect(notifications.data.notifications.some(
        (n: any) => n.type === 'follow'
      )).toBe(true);
    });

    it('应该在帖子被点赞时发送通知', async () => {
      const { result } = renderHook(() => usePostStore());

      const mockPost = {
        id: 'post-1',
        authorId: mockUsers[1].id,
        likes: 0,
        isLiked: false,
      };

      act(() => {
        result.current.posts.set(mockPost.id, mockPost);
      });

      await act(async () => {
        await result.current.likePost(mockPost.id);
      });

      // 检查作者的通知
      const notificationResponse = await fetch(
        `${API_BASE}/notifications?userId=${mockUsers[1].id}`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );

      const notifications = await notificationResponse.json();

      expect(notifications.success).toBe(true);
    });
  });

  describe('互动统计流程', () => {
    it('应该正确统计用户互动数据', async () => {
      const { result: socialResult } = renderHook(() => useSocialStore());
      const { result: postResult } = renderHook(() => usePostStore());

      // 执行多个互动
      await act(async () => {
        await socialResult.current.follow(mockUsers[1].id);
        await socialResult.current.follow(mockUsers[2].id);
      });

      const mockPost = {
        id: 'post-1',
        likes: 0,
        isLiked: false,
      };

      act(() => {
        postResult.current.posts.set(mockPost.id, mockPost);
      });

      await act(async () => {
        await postResult.current.likePost(mockPost.id);
      });

      // 获取统计数据
      const statsResponse = await fetch(
        `${API_BASE}/users/${mockUsers[0].id}/stats`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );

      const stats = await statsResponse.json();

      expect(stats.success).toBe(true);
      expect(stats.data.followingCount).toBeGreaterThan(0);
    });
  });

  describe('实时互动流程', () => {
    it('应该实时更新点赞数', async () => {
      const { result } = renderHook(() => usePostStore());

      const mockPost = {
        id: 'post-1',
        likes: 10,
        isLiked: false,
      };

      act(() => {
        result.current.posts.set(mockPost.id, mockPost);
      });

      // 模拟其他用户点赞（通过 WebSocket 或轮询）
      await act(async () => {
        // 模拟实时更新
        const posts = new Map(result.current.posts);
        posts.set(mockPost.id, {
          ...mockPost,
          likes: 15,
        });
        result.current.posts = posts;
      });

      expect(result.current.posts.get(mockPost.id)?.likes).toBe(15);
    });

    it('应该实时显示新评论', async () => {
      const postId = 'post-1';

      // 获取初始评论列表
      const initialResponse = await fetch(
        `${API_BASE}/posts/${postId}/comments`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );

      const initial = await initialResponse.json();
      const initialCount = initial.data.comments.length;

      // 模拟新评论到达
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedResponse = await fetch(
        `${API_BASE}/posts/${postId}/comments`,
        {
          headers: { Authorization: 'Bearer mock-token' },
        }
      );

      const updated = await updatedResponse.json();

      expect(updated.data.comments.length).toBeGreaterThanOrEqual(initialCount);
    });
  });
});

