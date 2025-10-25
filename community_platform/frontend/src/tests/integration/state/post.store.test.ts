/**
 * 帖子 Store 集成测试
 * @module tests/integration/state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { create } from 'zustand';

const API_BASE = 'http://localhost:8000/api/v1';

// Mock 帖子数据
const mockPost = {
  id: 'post-1',
  title: '测试帖子',
  content: '测试内容',
  authorId: 'user-1',
  likes: 10,
  comments: 5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 帖子 Store 接口
interface PostState {
  posts: Map<string, any>;
  feed: any[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  
  setPost: (post: any) => void;
  setPosts: (posts: any[]) => void;
  setFeed: (posts: any[]) => void;
  appendToFeed: (posts: any[]) => void;
  removePost: (postId: string) => void;
  updatePost: (postId: string, updates: Partial<any>) => void;
  likePost: (postId: string) => void;
  unlikePost: (postId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  clearPosts: () => void;
}

const usePostStore = create<PostState>((set) => ({
  posts: new Map(),
  feed: [],
  isLoading: false,
  error: null,
  currentPage: 1,
  hasMore: true,
  
  setPost: (post) =>
    set((state) => {
      const posts = new Map(state.posts);
      posts.set(post.id, post);
      return { posts };
    }),
  
  setPosts: (posts) =>
    set(() => {
      const postsMap = new Map();
      posts.forEach((post) => postsMap.set(post.id, post));
      return { posts: postsMap };
    }),
  
  setFeed: (posts) => set({ feed: posts }),
  
  appendToFeed: (posts) =>
    set((state) => ({
      feed: [...state.feed, ...posts],
    })),
  
  removePost: (postId) =>
    set((state) => {
      const posts = new Map(state.posts);
      posts.delete(postId);
      const feed = state.feed.filter((post) => post.id !== postId);
      return { posts, feed };
    }),
  
  updatePost: (postId, updates) =>
    set((state) => {
      const posts = new Map(state.posts);
      const existingPost = posts.get(postId);
      if (existingPost) {
        posts.set(postId, { ...existingPost, ...updates });
      }
      
      const feed = state.feed.map((post) =>
        post.id === postId ? { ...post, ...updates } : post
      );
      
      return { posts, feed };
    }),
  
  likePost: (postId) =>
    set((state) => {
      const posts = new Map(state.posts);
      const post = posts.get(postId);
      if (post) {
        posts.set(postId, {
          ...post,
          likes: post.likes + 1,
          isLiked: true,
        });
      }
      
      const feed = state.feed.map((p) =>
        p.id === postId ? { ...p, likes: p.likes + 1, isLiked: true } : p
      );
      
      return { posts, feed };
    }),
  
  unlikePost: (postId) =>
    set((state) => {
      const posts = new Map(state.posts);
      const post = posts.get(postId);
      if (post) {
        posts.set(postId, {
          ...post,
          likes: post.likes - 1,
          isLiked: false,
        });
      }
      
      const feed = state.feed.map((p) =>
        p.id === postId ? { ...p, likes: p.likes - 1, isLiked: false } : p
      );
      
      return { posts, feed };
    }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setHasMore: (hasMore) => set({ hasMore }),
  clearPosts: () =>
    set({
      posts: new Map(),
      feed: [],
      currentPage: 1,
      hasMore: true,
      error: null,
    }),
}));

describe('帖子 Store 集成测试', () => {
  beforeEach(() => {
    const { clearPosts } = usePostStore.getState();
    clearPosts();
  });

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const { result } = renderHook(() => usePostStore());

      expect(result.current.posts.size).toBe(0);
      expect(result.current.feed).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasMore).toBe(true);
    });
  });

  describe('setPost', () => {
    it('应该添加帖子到 store', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
      });

      expect(result.current.posts.size).toBe(1);
      expect(result.current.posts.get(mockPost.id)).toEqual(mockPost);
    });

    it('应该更新已存在的帖子', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
      });

      const updatedPost = { ...mockPost, title: '更新的标题' };

      act(() => {
        result.current.setPost(updatedPost);
      });

      expect(result.current.posts.size).toBe(1);
      expect(result.current.posts.get(mockPost.id)?.title).toBe('更新的标题');
    });
  });

  describe('setPosts', () => {
    it('应该批量设置帖子', () => {
      const { result } = renderHook(() => usePostStore());

      const posts = [
        mockPost,
        { ...mockPost, id: 'post-2', title: '帖子2' },
        { ...mockPost, id: 'post-3', title: '帖子3' },
      ];

      act(() => {
        result.current.setPosts(posts);
      });

      expect(result.current.posts.size).toBe(3);
    });

    it('应该替换现有的帖子', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
        result.current.setPosts([
          { ...mockPost, id: 'post-2', title: '新帖子' },
        ]);
      });

      expect(result.current.posts.size).toBe(1);
      expect(result.current.posts.has('post-1')).toBe(false);
      expect(result.current.posts.has('post-2')).toBe(true);
    });
  });

  describe('setFeed 和 appendToFeed', () => {
    it('应该设置信息流', () => {
      const { result } = renderHook(() => usePostStore());

      const posts = [mockPost];

      act(() => {
        result.current.setFeed(posts);
      });

      expect(result.current.feed).toEqual(posts);
    });

    it('应该追加到信息流', () => {
      const { result } = renderHook(() => usePostStore());

      const firstBatch = [mockPost];
      const secondBatch = [
        { ...mockPost, id: 'post-2', title: '帖子2' },
      ];

      act(() => {
        result.current.setFeed(firstBatch);
        result.current.appendToFeed(secondBatch);
      });

      expect(result.current.feed).toHaveLength(2);
      expect(result.current.feed[0].id).toBe('post-1');
      expect(result.current.feed[1].id).toBe('post-2');
    });
  });

  describe('removePost', () => {
    it('应该从 store 删除帖子', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
        result.current.setFeed([mockPost]);
      });

      expect(result.current.posts.size).toBe(1);
      expect(result.current.feed).toHaveLength(1);

      act(() => {
        result.current.removePost(mockPost.id);
      });

      expect(result.current.posts.size).toBe(0);
      expect(result.current.feed).toHaveLength(0);
    });
  });

  describe('updatePost', () => {
    it('应该更新帖子内容', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
        result.current.setFeed([mockPost]);
      });

      const updates = { title: '更新的标题', content: '更新的内容' };

      act(() => {
        result.current.updatePost(mockPost.id, updates);
      });

      const updatedPost = result.current.posts.get(mockPost.id);
      expect(updatedPost?.title).toBe('更新的标题');
      expect(updatedPost?.content).toBe('更新的内容');

      expect(result.current.feed[0].title).toBe('更新的标题');
    });
  });

  describe('likePost 和 unlikePost', () => {
    it('应该点赞帖子', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
        result.current.setFeed([mockPost]);
      });

      const initialLikes = mockPost.likes;

      act(() => {
        result.current.likePost(mockPost.id);
      });

      expect(result.current.posts.get(mockPost.id)?.likes).toBe(
        initialLikes + 1
      );
      expect(result.current.posts.get(mockPost.id)?.isLiked).toBe(true);
      expect(result.current.feed[0].isLiked).toBe(true);
    });

    it('应该取消点赞帖子', () => {
      const { result } = renderHook(() => usePostStore());

      const likedPost = { ...mockPost, isLiked: true };

      act(() => {
        result.current.setPost(likedPost);
        result.current.setFeed([likedPost]);
      });

      const initialLikes = likedPost.likes;

      act(() => {
        result.current.unlikePost(mockPost.id);
      });

      expect(result.current.posts.get(mockPost.id)?.likes).toBe(
        initialLikes - 1
      );
      expect(result.current.posts.get(mockPost.id)?.isLiked).toBe(false);
    });
  });

  describe('分页管理', () => {
    it('应该管理分页状态', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setCurrentPage(2);
      });

      expect(result.current.currentPage).toBe(2);

      act(() => {
        result.current.setHasMore(false);
      });

      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('完整的加载流程', () => {
    it('应该模拟完整的帖子加载流程', async () => {
      const { result } = renderHook(() => usePostStore());

      // 开始加载
      act(() => {
        result.current.setLoading(true);
        result.current.setError(null);
      });

      server.use(
        http.get(`${API_BASE}/posts`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              posts: [mockPost],
              total: 1,
              page: 1,
              limit: 10,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      const data = await response.json();

      act(() => {
        result.current.setFeed(data.data.posts);
        data.data.posts.forEach((post: any) => {
          result.current.setPost(post);
        });
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.feed).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('应该处理加载错误', async () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setLoading(true);
      });

      server.use(
        http.get(`${API_BASE}/posts`, () => {
          return HttpResponse.json(
            { success: false, error: '加载失败' },
            { status: 500 }
          );
        })
      );

      const response = await fetch(`${API_BASE}/posts`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      const data = await response.json();

      act(() => {
        result.current.setError(data.error);
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('加载失败');
    });
  });

  describe('无限滚动场景', () => {
    it('应该支持无限滚动加载', async () => {
      const { result } = renderHook(() => usePostStore());

      // 第一页
      const firstPage = [mockPost];
      act(() => {
        result.current.setFeed(firstPage);
        result.current.setCurrentPage(1);
      });

      expect(result.current.feed).toHaveLength(1);

      // 第二页
      const secondPage = [
        { ...mockPost, id: 'post-2', title: '帖子2' },
        { ...mockPost, id: 'post-3', title: '帖子3' },
      ];

      act(() => {
        result.current.appendToFeed(secondPage);
        result.current.setCurrentPage(2);
      });

      expect(result.current.feed).toHaveLength(3);
      expect(result.current.currentPage).toBe(2);
    });

    it('应该在没有更多数据时停止加载', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setFeed([mockPost]);
        result.current.setHasMore(false);
      });

      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('帖子操作集成', () => {
    it('应该模拟完整的点赞流程', async () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
      });

      server.use(
        http.post(`${API_BASE}/posts/${mockPost.id}/like`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isLiked: true,
              likesCount: mockPost.likes + 1,
            },
          });
        })
      );

      const response = await fetch(`${API_BASE}/posts/${mockPost.id}/like`, {
        method: 'POST',
        headers: { Authorization: 'Bearer mock-token' },
      });
      const data = await response.json();

      act(() => {
        result.current.likePost(mockPost.id);
      });

      expect(result.current.posts.get(mockPost.id)?.isLiked).toBe(true);
    });

    it('应该模拟完整的删除流程', async () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
        result.current.setFeed([mockPost]);
      });

      server.use(
        http.delete(`${API_BASE}/posts/${mockPost.id}`, () => {
          return HttpResponse.json({
            success: true,
            message: '删除成功',
          });
        })
      );

      await fetch(`${API_BASE}/posts/${mockPost.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mock-token' },
      });

      act(() => {
        result.current.removePost(mockPost.id);
      });

      expect(result.current.posts.has(mockPost.id)).toBe(false);
      expect(result.current.feed).toHaveLength(0);
    });
  });

  describe('clearPosts', () => {
    it('应该清除所有帖子数据', () => {
      const { result } = renderHook(() => usePostStore());

      act(() => {
        result.current.setPost(mockPost);
        result.current.setFeed([mockPost]);
        result.current.setCurrentPage(3);
        result.current.setHasMore(false);
        result.current.setError('错误');
      });

      act(() => {
        result.current.clearPosts();
      });

      expect(result.current.posts.size).toBe(0);
      expect(result.current.feed).toHaveLength(0);
      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });
});

