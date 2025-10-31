/**
 * 确认密码重置 API 路由
 * @module app/api/auth/password-reset/confirm
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 后端 API 基础 URL
 */
const BACKEND_API_URL = process.env['BACKEND_API_URL'] || 'http://localhost:8001/api/v1';

/**
 * POST /api/auth/password-reset/confirm
 * 确认密码重置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 转发请求到后端 API
    const response = await fetch(`${BACKEND_API_URL}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // 如果后端返回错误
    if (!response.ok) {
      const data = await response.json();
      return NextResponse.json(
        {
          message: data.detail || data.message || '密码重置失败',
          error: data,
        },
        { status: response.status }
      );
    }

    // 成功
    return NextResponse.json(
      { message: '密码重置成功，请使用新密码登录' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[密码重置确认错误]', error);
    
    return NextResponse.json(
      {
        message: '服务暂时不可用，请稍后重试',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

