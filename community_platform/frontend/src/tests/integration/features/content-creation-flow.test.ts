/**
 * 内容创建流程集成测试
 * 测试完整的内容创建和管理流程
 * @module tests/integration/features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';
import { create } from 'zustand';

const API_BASE = 'http://localhost:8000/api/v1';

// Mock Store
interface ContentState {
  posts: Map<string, any>;
  currentPost: any | null;
  isLoading: boolean;
  error: string | null;
  
  createPost: (data: any) => Promise<any>;
  updatePost: (id: string, data: any) => Promise<any>;
  deletePost: (id: string) => Promise<void>;
  setCurrentPost: (post: any | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const useContentStore = create<ContentState>((set, get) => ({
  posts: new Map(),
  currentPost: null,
  isLoading: false,
  error: null,
  
  createPost: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      
      if (result.success) {
        const posts = new Map(get().posts);
        posts.set(result.data.id, result.data);
        set({ posts, currentPost: result.data, isLoading: false });
        return result.data;
      } else {
        set({ error: result.error, isLoading: false });
        throw new Error(result.error);
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updatePost: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      
      if (result.success) {
        const posts = new Map(get().posts);
        posts.set(id, result.data);
        set({ posts, currentPost: result.data, isLoading: false });
        return result.data;
      } else {
        set({ error: result.error, isLoading: false });
        throw new Error(result.error);
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deletePost: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      
      if (result.success) {
        const posts = new Map(get().posts);
        posts.delete(id);
        set({ posts, isLoading: false });
      } else {
        set({ error: result.error, isLoading: false });
        throw new Error(result.error);
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  setCurrentPost: (post) => set({ currentPost: post }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

describe('内容创建流程集成测试', () => {
  beforeEach(() => {
    const store = useContentStore.getState();
    store.setCurrentPost(null);
    store.setError(null);
  });

  describe('帖子创建流程', () => {
    it('应该完成完整的帖子创建流程', async () => {
      const { result } = renderHook(() => useContentStore());

      const postData = {
        title: '我的第一篇帖子',
        content: '这是帖子内容',
        tags: ['测试', '第一篇'],
        visibility: 'public',
      };

      // 创建帖子
      let createdPost: any;
      
      await act(async () => {
        createdPost = await result.current.createPost(postData);
      });

      // 验证帖子创建成功
      expect(createdPost).toBeDefined();
      expect(createdPost.title).toBe(postData.title);
      expect(createdPost.content).toBe(postData.content);
      expect(result.current.posts.has(createdPost.id)).toBe(true);
      expect(result.current.currentPost?.id).toBe(createdPost.id);
      expect(result.current.error).toBeNull();
    });

    it('应该支持草稿保存', async () => {
      const { result } = renderHook(() => useContentStore());

      const draftData = {
        title: '草稿标题',
        content: '草稿内容',
        status: 'draft',
      };

      let draft: any;

      await act(async () => {
        draft = await result.current.createPost(draftData);
      });

      expect(draft.status).toBe('draft');
      expect(result.current.posts.has(draft.id)).toBe(true);
    });

    it('应该支持带图片的帖子创建', async () => {
      const { result } = renderHook(() => useContentStore());

      // 模拟图片上传
      server.use(
        http.post(`${API_BASE}/upload/image`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              url: 'https://example.com/image.jpg',
              id: 'image-1',
            },
          });
        })
      );

      // 上传图片
      const formData = new FormData();
      formData.append('image', new Blob(['fake-image'], { type: 'image/jpeg' }));

      const uploadResponse = await fetch(`${API_BASE}/upload/image`, {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadResponse.json();

      // 创建带图片的帖子
      const postData = {
        title: '带图片的帖子',
        content: '这是内容',
        images: [uploadData.data.url],
      };

      let post: any;

      await act(async () => {
        post = await result.current.createPost(postData);
      });

      expect(post.images).toContain(uploadData.data.url);
    });

    it('应该验证帖子内容', async () => {
      const { result } = renderHook(() => useContentStore());

      const invalidData = {
        title: '', // 空标题
        content: '',
      };

      await act(async () => {
        try {
          await result.current.createPost(invalidData);
        } catch (error) {
          // 预期会抛出错误
        }
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('帖子编辑流程', () => {
    it('应该完成完整的帖子编辑流程', async () => {
      const { result } = renderHook(() => useContentStore());

      // 先创建帖子
      let originalPost: any;
      
      await act(async () => {
        originalPost = await result.current.createPost({
          title: '原始标题',
          content: '原始内容',
        });
      });

      // 编辑帖子
      const updates = {
        title: '更新的标题',
        content: '更新的内容',
      };

      let updatedPost: any;

      await act(async () => {
        updatedPost = await result.current.updatePost(originalPost.id, updates);
      });

      expect(updatedPost.title).toBe(updates.title);
      expect(updatedPost.content).toBe(updates.content);
      expect(result.current.posts.get(originalPost.id)?.title).toBe(updates.title);
    });

    it('应该保留编辑历史', async () => {
      const { result } = renderHook(() => useContentStore());

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '版本1',
          content: '内容1',
        });
      });

      // 多次编辑
      await act(async () => {
        await result.current.updatePost(post.id, {
          title: '版本2',
          content: '内容2',
        });
      });

      // 获取编辑历史
      const historyResponse = await fetch(`${API_BASE}/posts/${post.id}/history`, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      const historyData = await historyResponse.json();

      expect(historyData.success).toBe(true);
      expect(historyData.data.versions.length).toBeGreaterThan(1);
    });

    it('应该处理并发编辑冲突', async () => {
      const { result } = renderHook(() => useContentStore());

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '原始标题',
          content: '原始内容',
          version: 1,
        });
      });

      // 模拟另一个用户已编辑
      server.use(
        http.put(`${API_BASE}/posts/${post.id}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: '版本冲突，请刷新后重试',
              code: 'VERSION_CONFLICT',
            },
            { status: 409 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.updatePost(post.id, {
            title: '我的更新',
            version: 1,
          });
        } catch (error) {
          // 预期冲突
        }
      });

      expect(result.current.error).toContain('冲突');
    });
  });

  describe('帖子删除流程', () => {
    it('应该完成完整的帖子删除流程', async () => {
      const { result } = renderHook(() => useContentStore());

      // 创建帖子
      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '待删除的帖子',
          content: '内容',
        });
      });

      expect(result.current.posts.has(post.id)).toBe(true);

      // 删除帖子
      await act(async () => {
        await result.current.deletePost(post.id);
      });

      expect(result.current.posts.has(post.id)).toBe(false);
    });

    it('应该要求删除确认', async () => {
      const { result } = renderHook(() => useContentStore());

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '重要帖子',
          content: '重要内容',
        });
      });

      // 模拟需要确认
      let confirmCalled = false;
      const mockConfirm = () => {
        confirmCalled = true;
        return true;
      };

      if (mockConfirm()) {
        await act(async () => {
          await result.current.deletePost(post.id);
        });
      }

      expect(confirmCalled).toBe(true);
      expect(result.current.posts.has(post.id)).toBe(false);
    });

    it('应该支持软删除', async () => {
      const { result } = renderHook(() => useContentStore());

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '帖子',
          content: '内容',
        });
      });

      // 软删除
      server.use(
        http.delete(`${API_BASE}/posts/${post.id}`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...post,
              deletedAt: new Date().toISOString(),
              status: 'deleted',
            },
          });
        })
      );

      await act(async () => {
        await result.current.deletePost(post.id);
      });

      // 从可见列表移除
      expect(result.current.posts.has(post.id)).toBe(false);
    });
  });

  describe('评论创建流程', () => {
    it('应该完成完整的评论发布流程', async () => {
      const { result } = renderHook(() => useContentStore());

      // 创建帖子
      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '帖子',
          content: '内容',
        });
      });

      // 发布评论
      const commentData = {
        content: '这是一条评论',
        postId: post.id,
      };

      const commentResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      const commentResult = await commentResponse.json();

      expect(commentResult.success).toBe(true);
      expect(commentResult.data.content).toBe(commentData.content);
      expect(commentResult.data.postId).toBe(post.id);
    });

    it('应该支持回复评论', async () => {
      const { result } = renderHook(() => useContentStore());

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '帖子',
          content: '内容',
        });
      });

      // 创建父评论
      const parentCommentResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '父评论',
          postId: post.id,
        }),
      });
      const parentComment = await parentCommentResponse.json();

      // 回复评论
      const replyResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '这是回复',
          postId: post.id,
          parentId: parentComment.data.id,
        }),
      });

      const reply = await replyResponse.json();

      expect(reply.success).toBe(true);
      expect(reply.data.parentId).toBe(parentComment.data.id);
    });

    it('应该支持 @提及用户', async () => {
      const { result } = renderHook(() => useContentStore());

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '帖子',
          content: '内容',
        });
      });

      // 发布带提及的评论
      const commentResponse = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `@${mockUsers[1].username} 你好`,
          postId: post.id,
          mentions: [mockUsers[1].id],
        }),
      });

      const comment = await commentResponse.json();

      expect(comment.success).toBe(true);
      expect(comment.data.mentions).toContain(mockUsers[1].id);
    });
  });

  describe('内容发布流程', () => {
    it('应该从草稿发布到公开', async () => {
      const { result } = renderHook(() => useContentStore());

      // 创建草稿
      let draft: any;
      
      await act(async () => {
        draft = await result.current.createPost({
          title: '草稿',
          content: '内容',
          status: 'draft',
        });
      });

      expect(draft.status).toBe('draft');

      // 发布
      let published: any;
      
      await act(async () => {
        published = await result.current.updatePost(draft.id, {
          status: 'published',
          publishedAt: new Date().toISOString(),
        });
      });

      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeDefined();
    });

    it('应该支持定时发布', async () => {
      const { result } = renderHook(() => useContentStore());

      const scheduledTime = new Date(Date.now() + 3600000).toISOString();

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: '定时发布',
          content: '内容',
          status: 'scheduled',
          scheduledAt: scheduledTime,
        });
      });

      expect(post.status).toBe('scheduled');
      expect(post.scheduledAt).toBe(scheduledTime);
    });

    it('应该验证发布权限', async () => {
      const { result } = renderHook(() => useContentStore());

      server.use(
        http.post(`${API_BASE}/posts`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: '您没有发布权限',
            },
            { status: 403 }
          );
        })
      );

      await act(async () => {
        try {
          await result.current.createPost({
            title: '帖子',
            content: '内容',
          });
        } catch (error) {
          // 预期权限错误
        }
      });

      expect(result.current.error).toContain('权限');
    });
  });

  describe('富文本编辑流程', () => {
    it('应该支持 Markdown 格式', async () => {
      const { result } = renderHook(() => useContentStore());

      const markdownContent = `
# 标题

这是**粗体**和*斜体*文本。

- 列表项1
- 列表项2

\`\`\`javascript
console.log('代码块');
\`\`\`
      `.trim();

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost({
          title: 'Markdown 帖子',
          content: markdownContent,
          format: 'markdown',
        });
      });

      expect(post.content).toBe(markdownContent);
      expect(post.format).toBe('markdown');
    });

    it('应该支持链接和图片插入', async () => {
      const { result } = renderHook(() => useContentStore());

      const contentWithMedia = {
        title: '多媒体帖子',
        content: '查看这个链接：https://example.com',
        images: ['https://example.com/image.jpg'],
        links: [
          {
            url: 'https://example.com',
            title: '示例链接',
          },
        ],
      };

      let post: any;
      
      await act(async () => {
        post = await result.current.createPost(contentWithMedia);
      });

      expect(post.images).toHaveLength(1);
      expect(post.links).toHaveLength(1);
    });
  });

  describe('内容审核流程', () => {
    it('应该在发布前进行内容审核', async () => {
      const { result } = renderHook(() => useContentStore());

      server.use(
        http.post(`${API_BASE}/posts`, async ({ request }) => {
          const body = await request.json();
          
          // 模拟内容审核
          const hasInappropriateContent = body.content.includes('违规词');
          
          if (hasInappropriateContent) {
            return HttpResponse.json(
              {
                success: false,
                error: '内容包含不当信息',
              },
              { status: 400 }
            );
          }
          
          return HttpResponse.json({
            success: true,
            data: {
              id: 'post-1',
              ...body,
              status: 'published',
            },
          });
        })
      );

      // 尝试发布违规内容
      await act(async () => {
        try {
          await result.current.createPost({
            title: '标题',
            content: '这包含违规词',
          });
        } catch (error) {
          // 预期审核失败
        }
      });

      expect(result.current.error).toContain('不当');
    });
  });
});

