/**
 * API 集成测试辅助工具
 * @module tests/integration/utils
 */

import { server } from '@/tests/mocks/server';
import { http, HttpResponse, type PathParams } from 'msw';

const API_BASE = 'http://localhost:8000/api/v1';

/**
 * 设置 API mock 响应
 */
export function mockApiResponse<T = any>(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  path: string,
  response: T,
  options?: {
    status?: number;
    delay?: number;
    headers?: Record<string, string>;
  }
) {
  const { status = 200, delay = 0, headers = {} } = options || {};
  
  const fullPath = path.startsWith('http') ? path : `${API_BASE}${path}`;
  
  server.use(
    http[method](fullPath, async () => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      
      return HttpResponse.json(response, {
        status,
        headers,
      });
    })
  );
}

/**
 * 设置认证 API mock
 */
export const mockAuthApi = {
  login: (response: any, status = 200) => {
    mockApiResponse('post', '/auth/login', response, { status });
  },
  
  register: (response: any, status = 201) => {
    mockApiResponse('post', '/auth/register', response, { status });
  },
  
  logout: (response: any = { success: true }, status = 200) => {
    mockApiResponse('post', '/auth/logout', response, { status });
  },
  
  me: (response: any, status = 200) => {
    mockApiResponse('get', '/auth/me', response, { status });
  },
  
  refresh: (response: any, status = 200) => {
    mockApiResponse('post', '/auth/refresh', response, { status });
  },
  
  verifyEmail: (response: any, status = 200) => {
    mockApiResponse('post', '/auth/email/verify', response, { status });
  },
  
  resetPassword: (response: any, status = 200) => {
    mockApiResponse('post', '/auth/password-reset/request', response, { status });
  },
};

/**
 * 设置用户 API mock
 */
export const mockUserApi = {
  getUser: (userId: string, response: any, status = 200) => {
    mockApiResponse('get', `/users/${userId}`, response, { status });
  },
  
  updateUser: (userId: string, response: any, status = 200) => {
    mockApiResponse('put', `/users/${userId}`, response, { status });
  },
  
  getUserStats: (userId: string, response: any, status = 200) => {
    mockApiResponse('get', `/users/${userId}/stats`, response, { status });
  },
  
  getUserPosts: (userId: string, response: any, status = 200) => {
    mockApiResponse('get', `/users/${userId}/posts`, response, { status });
  },
  
  follow: (userId: string, response: any, status = 200) => {
    mockApiResponse('post', `/users/${userId}/follow`, response, { status });
  },
  
  unfollow: (userId: string, response: any, status = 200) => {
    mockApiResponse('delete', `/users/${userId}/follow`, response, { status });
  },
  
  getFollowers: (userId: string, response: any, status = 200) => {
    mockApiResponse('get', `/users/${userId}/followers`, response, { status });
  },
  
  getFollowing: (userId: string, response: any, status = 200) => {
    mockApiResponse('get', `/users/${userId}/following`, response, { status });
  },
};

/**
 * 设置帖子 API mock
 */
export const mockPostApi = {
  getPosts: (response: any, status = 200) => {
    mockApiResponse('get', '/posts', response, { status });
  },
  
  getPost: (postId: string, response: any, status = 200) => {
    mockApiResponse('get', `/posts/${postId}`, response, { status });
  },
  
  createPost: (response: any, status = 201) => {
    mockApiResponse('post', '/posts', response, { status });
  },
  
  updatePost: (postId: string, response: any, status = 200) => {
    mockApiResponse('put', `/posts/${postId}`, response, { status });
  },
  
  deletePost: (postId: string, response: any = { success: true }, status = 200) => {
    mockApiResponse('delete', `/posts/${postId}`, response, { status });
  },
  
  likePost: (postId: string, response: any, status = 200) => {
    mockApiResponse('post', `/posts/${postId}/like`, response, { status });
  },
  
  unlikePost: (postId: string, response: any, status = 200) => {
    mockApiResponse('delete', `/posts/${postId}/like`, response, { status });
  },
  
  sharePost: (postId: string, response: any, status = 200) => {
    mockApiResponse('post', `/posts/${postId}/share`, response, { status });
  },
};

/**
 * 设置评论 API mock
 */
export const mockCommentApi = {
  getComments: (postId: string, response: any, status = 200) => {
    mockApiResponse('get', `/posts/${postId}/comments`, response, { status });
  },
  
  createComment: (response: any, status = 201) => {
    mockApiResponse('post', '/comments', response, { status });
  },
  
  updateComment: (commentId: string, response: any, status = 200) => {
    mockApiResponse('put', `/comments/${commentId}`, response, { status });
  },
  
  deleteComment: (commentId: string, response: any = { success: true }, status = 200) => {
    mockApiResponse('delete', `/comments/${commentId}`, response, { status });
  },
  
  likeComment: (commentId: string, response: any, status = 200) => {
    mockApiResponse('post', `/comments/${commentId}/like`, response, { status });
  },
};

/**
 * 设置通知 API mock
 */
export const mockNotificationApi = {
  getNotifications: (response: any, status = 200) => {
    mockApiResponse('get', '/notifications', response, { status });
  },
  
  markAsRead: (notificationId: string, response: any = { success: true }, status = 200) => {
    mockApiResponse('put', `/notifications/${notificationId}/read`, response, { status });
  },
  
  markAllAsRead: (response: any = { success: true }, status = 200) => {
    mockApiResponse('post', '/notifications/read-all', response, { status });
  },
  
  deleteNotification: (notificationId: string, response: any = { success: true }, status = 200) => {
    mockApiResponse('delete', `/notifications/${notificationId}`, response, { status });
  },
};

/**
 * 设置搜索 API mock
 */
export const mockSearchApi = {
  search: (response: any, status = 200) => {
    mockApiResponse('get', '/search', response, { status });
  },
  
  suggestions: (response: any, status = 200) => {
    mockApiResponse('get', '/search/suggestions', response, { status });
  },
};

/**
 * 设置上传 API mock
 */
export const mockUploadApi = {
  uploadImage: (response: any, status = 200) => {
    mockApiResponse('post', '/upload/image', response, { status });
  },
  
  uploadAvatar: (response: any, status = 200) => {
    mockApiResponse('post', '/upload/avatar', response, { status });
  },
  
  uploadFile: (response: any, status = 200) => {
    mockApiResponse('post', '/upload/file', response, { status });
  },
};

/**
 * 模拟 API 错误
 */
export function mockApiError(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  path: string,
  error: {
    message: string;
    code?: string;
    status?: number;
  }
) {
  const { status = 500, message, code } = error;
  
  mockApiResponse(
    method,
    path,
    {
      success: false,
      error: message,
      code,
    },
    { status }
  );
}

/**
 * 模拟网络延迟
 */
export function mockApiDelay(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  path: string,
  response: any,
  delay: number
) {
  mockApiResponse(method, path, response, { delay });
}

/**
 * 模拟分页响应
 */
export function mockPaginatedResponse<T = any>(
  items: T[],
  page: number = 1,
  limit: number = 10
) {
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedItems = items.slice(start, end);
  
  return {
    success: true,
    data: {
      items: paginatedItems,
      total: items.length,
      page,
      limit,
      totalPages: Math.ceil(items.length / limit),
      hasMore: end < items.length,
    },
  };
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T = any>(data: T) {
  return {
    success: true,
    data,
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  message: string,
  code?: string
) {
  return {
    success: false,
    error: message,
    code,
  };
}

/**
 * 模拟认证失败
 */
export function mockAuthenticationError() {
  mockApiError('get', '/auth/me', {
    message: '未登录或 token 已过期',
    code: 'UNAUTHORIZED',
    status: 401,
  });
}

/**
 * 模拟权限不足
 */
export function mockAuthorizationError() {
  mockApiError('post', '/posts', {
    message: '权限不足',
    code: 'FORBIDDEN',
    status: 403,
  });
}

/**
 * 模拟资源不存在
 */
export function mockNotFoundError(path: string) {
  mockApiError('get', path, {
    message: '资源不存在',
    code: 'NOT_FOUND',
    status: 404,
  });
}

/**
 * 模拟验证错误
 */
export function mockValidationError(path: string, errors: Record<string, string>) {
  mockApiResponse('post', path, {
    success: false,
    error: '验证失败',
    code: 'VALIDATION_ERROR',
    errors,
  }, { status: 400 });
}

/**
 * 模拟服务器错误
 */
export function mockServerError(path?: string) {
  const errorPath = path || '/*';
  
  server.use(
    http.get(errorPath, () => {
      return new HttpResponse(null, { status: 500 });
    }),
    http.post(errorPath, () => {
      return new HttpResponse(null, { status: 500 });
    })
  );
}

/**
 * 重置所有 API mocks
 */
export function resetApiMocks() {
  server.resetHandlers();
}

/**
 * 验证 API 调用
 */
export function createApiSpy(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  path: string
) {
  const calls: any[] = [];
  
  const fullPath = path.startsWith('http') ? path : `${API_BASE}${path}`;
  
  server.use(
    http[method](fullPath, async ({ request }) => {
      const body = request.method !== 'GET' 
        ? await request.json() 
        : null;
      
      calls.push({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
      });
      
      return HttpResponse.json({ success: true });
    })
  );
  
  return {
    calls,
    callCount: () => calls.length,
    wasCalled: () => calls.length > 0,
    lastCall: () => calls[calls.length - 1],
  };
}

export { server };

