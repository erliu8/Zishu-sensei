/**
 * 帖子 API Mock 处理器
 * @module tests/mocks/handlers/post
 */

import { http, HttpResponse } from 'msw';
import { mockPosts } from '../data/posts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * 帖子相关的MSW handlers
 */
export const postHandlers = [
  // 获取帖子列表
  http.get(`${API_BASE}/posts`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
    const sort = url.searchParams.get('sort') || 'createdAt';
    const order = url.searchParams.get('order') || 'desc';

    let sortedPosts = [...mockPosts];
    
    // 简单排序逻辑
    if (sort === 'createdAt') {
      sortedPosts.sort((a, b) => {
        const compare = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return order === 'desc' ? compare : -compare;
      });
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedPosts = sortedPosts.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          posts: paginatedPosts,
          total: mockPosts.length,
          page,
          pageSize,
          totalPages: Math.ceil(mockPosts.length / pageSize),
        },
      },
    });
  }),

  // 获取单个帖子
  http.get(`${API_BASE}/posts/:postId`, ({ params }) => {
    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        data: post,
      },
    });
  }),

  // 创建帖子
  http.post(`${API_BASE}/posts`, async ({ request }) => {
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
      title: string;
      content: string;
      tags?: string[];
    };

    const newPost = {
      id: `post-${Date.now()}`,
      title: body.title,
      content: body.content,
      authorId: 'user-1',
      author: {
        id: 'user-1',
        username: 'testuser',
        displayName: 'Test User',
        avatar: null,
      },
      tags: body.tags || [],
      images: [],
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      isLiked: false,
      isFavorited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      data: {
        data: newPost,
      },
    });
  }),

  // 更新帖子
  http.patch(`${API_BASE}/posts/:postId`, async ({ request, params }) => {
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

    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updatedPost = { ...post, ...body, updatedAt: new Date().toISOString() };

    return HttpResponse.json({
      success: true,
      data: {
        data: updatedPost,
      },
    });
  }),

  // 删除帖子
  http.delete(`${API_BASE}/posts/:postId`, ({ request, params }) => {
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

    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '帖子已删除',
    });
  }),

  // 点赞帖子
  http.post(`${API_BASE}/posts/:postId/like`, ({ request, params }) => {
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

    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    const updatedPost = {
      ...post,
      likesCount: post.likesCount + 1,
      isLiked: true,
    };

    return HttpResponse.json({
      success: true,
      data: {
        data: updatedPost,
      },
    });
  }),

  // 取消点赞帖子
  http.delete(`${API_BASE}/posts/:postId/like`, ({ request, params }) => {
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

    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    const updatedPost = {
      ...post,
      likesCount: Math.max(0, post.likesCount - 1),
      isLiked: false,
    };

    return HttpResponse.json({
      success: true,
      data: {
        data: updatedPost,
      },
    });
  }),

  // 收藏帖子
  http.post(`${API_BASE}/posts/:postId/favorite`, ({ request, params }) => {
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

    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    const updatedPost = {
      ...post,
      isFavorited: true,
    };

    return HttpResponse.json({
      success: true,
      data: {
        data: updatedPost,
      },
    });
  }),

  // 取消收藏帖子
  http.delete(`${API_BASE}/posts/:postId/favorite`, ({ request, params }) => {
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

    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    const updatedPost = {
      ...post,
      isFavorited: false,
    };

    return HttpResponse.json({
      success: true,
      data: {
        data: updatedPost,
      },
    });
  }),

  // 增加浏览量
  http.post(`${API_BASE}/posts/:postId/view`, ({ params }) => {
    const { postId } = params;
    const post = mockPosts.find((p) => p.id === postId);

    if (!post) {
      return HttpResponse.json(
        {
          success: false,
          error: '帖子不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '浏览量已增加',
    });
  }),

  // 获取用户的帖子
  http.get(`${API_BASE}/users/:userId/posts`, ({ request, params }) => {
    const { userId } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);

    const userPosts = mockPosts.filter((p) => p.authorId === userId);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedPosts = userPosts.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        data: {
          posts: paginatedPosts,
          total: userPosts.length,
          page,
          pageSize,
          totalPages: Math.ceil(userPosts.length / pageSize),
        },
      },
    });
  }),

  // 获取推荐帖子
  http.get(`${API_BASE}/posts/featured`, ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const featuredPosts = mockPosts.slice(0, limit);

    return HttpResponse.json({
      success: true,
      data: {
        data: featuredPosts,
      },
    });
  }),

  // 获取热门帖子
  http.get(`${API_BASE}/posts/trending`, ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const trendingPosts = [...mockPosts]
      .sort((a, b) => b.likesCount - a.likesCount)
      .slice(0, limit);

    return HttpResponse.json({
      success: true,
      data: {
        data: trendingPosts,
      },
    });
  }),
];

