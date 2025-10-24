/**
 * 打包 API Mock 处理器
 * @module tests/mocks/handlers/packaging
 */

import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * 打包相关的MSW handlers
 */
export const packagingHandlers = [
  // 创建打包任务
  http.post(`${API_BASE}/packaging/tasks`, async ({ request }) => {
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

    const newTask = {
      id: `task-${Date.now()}`,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      ...body,
    };

    return HttpResponse.json({
      success: true,
      data: newTask,
    });
  }),

  // 获取打包任务状态
  http.get(`${API_BASE}/packaging/tasks/:taskId`, ({ request, params }) => {
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

    const { taskId } = params;

    return HttpResponse.json({
      success: true,
      data: {
        id: taskId,
        status: 'completed',
        progress: 100,
        downloadUrl: 'https://example.com/packages/test.zip',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date().toISOString(),
      },
    });
  }),

  // 下载打包文件
  http.get(`${API_BASE}/packaging/download/:taskId`, ({ request, params }) => {
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

    // 返回模拟的二进制数据
    return new HttpResponse(new Blob(['mock file content'], { type: 'application/zip' }), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="package.zip"',
      },
    });
  }),
];

