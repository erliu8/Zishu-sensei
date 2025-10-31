/**
 * 用户登出 API 路由
 * @module app/api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 后端 API 基础 URL
 */
const BACKEND_API_URL = process.env['BACKEND_API_URL'] || 'http://localhost:8001/api/v1';

/**
 * POST /api/auth/logout
 * 用户登出
 */
export async function POST(request: NextRequest) {
  try {
    // 获取请求头中的 Authorization token
    const authorization = request.headers.get('authorization');

    // 转发请求到后端 API
    const response = await fetch(`${BACKEND_API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });

    // 如果后端返回错误且不是 401（登出时 401 也算成功）
    if (!response.ok && response.status !== 401) {
      const data = await response.json();
      return NextResponse.json(
        {
          message: data.detail || data.message || '登出失败',
          error: data,
        },
        { status: response.status }
      );
    }

    // 登出成功，清除 cookies
    const logoutResponse = NextResponse.json({ message: '登出成功' }, { status: 200 });
    
    // 清除认证相关的 cookies
    logoutResponse.cookies.delete('access_token');
    logoutResponse.cookies.delete('user_data');
    
    return logoutResponse;
  } catch (error: any) {
    console.error('[登出错误]', error);
    
    // 即使出错，也返回成功（因为客户端会清除本地状态）
    const errorResponse = NextResponse.json({ message: '登出成功' }, { status: 200 });
    
    // 清除认证相关的 cookies
    errorResponse.cookies.delete('access_token');
    errorResponse.cookies.delete('user_data');
    
    return errorResponse;
  }
}

