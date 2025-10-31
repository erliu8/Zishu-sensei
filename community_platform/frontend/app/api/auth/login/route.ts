/**
 * 用户登录 API 路由
 * @module app/api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 后端 API 基础 URL
 */
const BACKEND_API_URL = process.env['BACKEND_API_URL'] || 'http://localhost:8001/api/v1';

/**
 * POST /api/auth/login
 * 用户登录
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 转发请求到后端 API
    const backendResponse = await fetch(`${BACKEND_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: body.email || body.username, // 支持邮箱或用户名登录
        password: body.password,
      }),
    });

    const loginData = await backendResponse.json();

    // 如果后端返回错误
    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          message: loginData.detail || loginData.message || '登录失败',
          error: loginData,
        },
        { status: backendResponse.status }
      );
    }

    // 获取用户信息
    const userResponse = await fetch(`${BACKEND_API_URL}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.access_token}`,
      },
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      const expiresAt = Date.now() + (loginData.expires_in * 1000);

      // 返回完整的 AuthSession
      const response = NextResponse.json(
        {
          user: {
            id: String(userData.id),
            email: userData.email,
            username: userData.username,
            name: userData.full_name,
            avatar: userData.avatar_url,
            role: 'user',
            status: 'active',
            emailVerified: userData.is_verified ? new Date() : null,
            createdAt: new Date(userData.created_at),
            updatedAt: new Date(userData.updated_at || userData.created_at),
          },
          accessToken: loginData.access_token,
          refreshToken: loginData.refresh_token,
          expiresAt,
        },
        { status: 200 }
      );

      // 将 token 保存到 cookie 以便中间件使用
      response.cookies.set('access_token', loginData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: loginData.expires_in,
        path: '/',
      });

      // 保存用户信息到 cookie
      response.cookies.set('user_data', JSON.stringify({
        id: String(userData.id),
        email: userData.email,
        username: userData.username,
        role: 'user',
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: loginData.expires_in,
        path: '/',
      });

      return response;
    }

    // 如果获取用户信息失败，仍然返回令牌（前端可以稍后获取用户信息）
    const expiresAt = Date.now() + (loginData.expires_in * 1000);
    const fallbackResponse = NextResponse.json(
      {
        accessToken: loginData.access_token,
        refreshToken: loginData.refresh_token,
        expiresAt,
      },
      { status: 200 }
    );

    // 将 token 保存到 cookie
    fallbackResponse.cookies.set('access_token', loginData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: loginData.expires_in,
      path: '/',
    });

    return fallbackResponse;
  } catch (error: any) {
    console.error('[登录错误]', error);
    
    return NextResponse.json(
      {
        message: '登录服务暂时不可用，请稍后重试',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

