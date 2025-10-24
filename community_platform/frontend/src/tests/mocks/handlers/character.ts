/**
 * 角色 API Mock 处理器
 * @module tests/mocks/handlers/character
 */

import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const mockCharacters = [
  {
    id: 'character-1',
    name: 'Test Character',
    description: 'A test character',
    authorId: 'user-1',
    personality: 'friendly',
    voice: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 角色相关的MSW handlers
 */
export const characterHandlers = [
  // 获取角色列表
  http.get(`${API_BASE}/characters`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedCharacters = mockCharacters.slice(start, end);

    return HttpResponse.json({
      success: true,
      data: {
        characters: paginatedCharacters,
        total: mockCharacters.length,
        page,
        pageSize,
        totalPages: Math.ceil(mockCharacters.length / pageSize),
      },
    });
  }),

  // 获取单个角色
  http.get(`${API_BASE}/characters/:characterId`, ({ params }) => {
    const { characterId } = params;
    const character = mockCharacters.find((c) => c.id === characterId);

    if (!character) {
      return HttpResponse.json(
        {
          success: false,
          error: '角色不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: character,
    });
  }),

  // 创建角色
  http.post(`${API_BASE}/characters`, async ({ request }) => {
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

    const newCharacter = {
      id: `character-${Date.now()}`,
      ...body,
      authorId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      success: true,
      data: newCharacter,
    });
  }),

  // 更新角色
  http.patch(`${API_BASE}/characters/:characterId`, async ({ request, params }) => {
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

    const { characterId } = params;
    const character = mockCharacters.find((c) => c.id === characterId);

    if (!character) {
      return HttpResponse.json(
        {
          success: false,
          error: '角色不存在',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updatedCharacter = { ...character, ...body, updatedAt: new Date().toISOString() };

    return HttpResponse.json({
      success: true,
      data: updatedCharacter,
    });
  }),

  // 删除角色
  http.delete(`${API_BASE}/characters/:characterId`, ({ request, params }) => {
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
      message: '角色已删除',
    });
  }),
];

