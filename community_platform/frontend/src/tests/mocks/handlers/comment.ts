/**
 * 评论 API Mock 处理器
 * @module tests/mocks/handlers/comment
 */

import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const mockComments = [
  {
    id: 'comment-1',
    postId: 'post-1',
    authorId: 'user-2',
    author: {
      id: 'user-2',
      username: 'commenter',
      displayName: 'Commenter User',
      avatar: null,
    },
    content: '这是一条评论',
    parentId: null,
    likesCount: 5,
    repliesCount: 2,
    isLiked: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

/**
 * 评论相关的MSW handlers
 */
export const commentHandlers = [
  // 获取评论列表
  http.get(`${API_BASE}/posts/:postId/comments`, ({ request, params }) => {
    const { postId } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

    const postComments = mockComments.filter((c) => c.postId === postId);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedComments = postComments.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        comments: paginatedComments,
        total: postComments.length,
        page,
        pageSize,
        totalPages: Math.ceil(postComments.length / pageSize),
      },
    });
  }),

  // 创建评论
  http.post(`${API_BASE}/posts/:postId/comments`, async ({ request, params }) => {
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
    const body = await request.json() as {
      content: string;
      parentId?: string;
    };

    const newComment = {
      id: `comment-${Date.now()}`,
      postId,
      authorId: 'user-1',
      author: {
        id: 'user-1',
        username: 'testuser',
        displayName: 'Test User',
        avatar: null,
      },
      content: body.content,
      parentId: body.parentId || null,
      likesCount: 0,
      repliesCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      data: newComment,
    });
  }),

  // 更新评论
  http.patch(`${API_BASE}/comments/:commentId`, async ({ request, params }) => {
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

    const { commentId } = params;
    const comment = mockComments.find((c) => c.id === commentId);

    if (!comment) {
      return HttpResponse.json(
        {
          success: false,
          error: '评论不存在',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updatedComment = { ...comment, ...body, updatedAt: new Date().toISOString() };

    return HttpResponse.json({
      success: true,
      data: updatedComment,
    });
  }),

  // 删除评论
  http.delete(`${API_BASE}/comments/:commentId`, ({ request, params }) => {
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

    const { commentId } = params;
    const comment = mockComments.find((c) => c.id === commentId);

    if (!comment) {
      return HttpResponse.json(
        {
          success: false,
          error: '评论不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: '评论已删除',
    });
  }),

  // 点赞评论
  http.post(`${API_BASE}/comments/:commentId/like`, ({ request, params }) => {
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

    const { commentId } = params;
    const comment = mockComments.find((c) => c.id === commentId);

    if (!comment) {
      return HttpResponse.json(
        {
          success: false,
          error: '评论不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        ...comment,
        likesCount: comment.likesCount + 1,
        isLiked: true,
      },
    });
  }),

  // 取消点赞评论
  http.delete(`${API_BASE}/comments/:commentId/like`, ({ request, params }) => {
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

    const { commentId } = params;
    const comment = mockComments.find((c) => c.id === commentId);

    if (!comment) {
      return HttpResponse.json(
        {
          success: false,
          error: '评论不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        ...comment,
        likesCount: Math.max(0, comment.likesCount - 1),
        isLiked: false,
      },
    });
  }),
];

