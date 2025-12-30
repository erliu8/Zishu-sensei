/**
 * 适配器 API Mock 处理器
 * @module tests/mocks/handlers/adapter
 */

import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const mockAdapters = [
  {
    id: 'adapter-1',
    name: 'Test Adapter',
    description: 'A test adapter',
    authorId: 'user-1',
    version: '1.0.0',
    downloads: 1234,
    rating: 4.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 适配器相关的MSW handlers
 */
export const adapterHandlers = [
  // 获取适配器列表
  http.get(`${API_BASE}/adapters`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedAdapters = mockAdapters.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        adapters: paginatedAdapters,
        total: mockAdapters.length,
        page,
        pageSize,
        totalPages: Math.ceil(mockAdapters.length / pageSize),
      },
    });
  }),

  // 获取单个适配器
  http.get(`${API_BASE}/adapters/:adapterId`, ({ params }) => {
    const { adapterId } = params;
    const adapter = mockAdapters.find((a) => a.id === adapterId);

    if (!adapter) {
      return HttpResponse.json(
        {
          success: false,
          error: '技能包不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: adapter,
    });
  }),

  // 创建适配器
  http.post(`${API_BASE}/adapters`, async ({ request }) => {
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

    const body = await request.json();

    const newAdapter = {
      id: `adapter-${Date.now()}`,
      ...body,
      authorId: 'user-1',
      downloads: 0,
      rating: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      data: newAdapter,
    });
  }),

  // 更新适配器
  http.patch(`${API_BASE}/adapters/:adapterId`, async ({ request, params }) => {
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

    const { adapterId } = params;
    const adapter = mockAdapters.find((a) => a.id === adapterId);

    if (!adapter) {
      return HttpResponse.json(
        {
          success: false,
          error: '技能包不存在',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updatedAdapter = { ...adapter, ...body, updatedAt: new Date().toISOString() };

    return HttpResponse.json({
      success: true,
      data: updatedAdapter,
    });
  }),

  // 删除适配器
  http.delete(`${API_BASE}/adapters/:adapterId`, ({ request, params }) => {
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
      message: '技能包已删除',
    });
  }),
];

