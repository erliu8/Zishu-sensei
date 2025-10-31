/**
 * 用户注册 API 路由
 * @module app/api/auth/register
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 后端 API 基础 URL
 */
const BACKEND_API_URL = process.env['BACKEND_API_URL'] || 'http://localhost:8001/api/v1';

/**
 * POST /api/auth/register
 * 用户注册
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 详细日志
    console.log('[注册API路由] 请求详情:', {
      backendUrl: BACKEND_API_URL,
      fullUrl: `${BACKEND_API_URL}/auth/register`,
      requestBody: body,
    });

    // 转发注册请求到后端 API
    const registerResponse = await fetch(`${BACKEND_API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log('[注册API路由] 后端响应:', {
      status: registerResponse.status,
      statusText: registerResponse.statusText,
      ok: registerResponse.ok,
    });

    const registerData = await registerResponse.json();
    
    console.log('[注册API路由] 后端返回数据:', registerData);

    // 如果后端返回错误
    if (!registerResponse.ok) {
      // 提取错误消息
      const errorMessage = registerData.error?.message 
        || registerData.message 
        || registerData.detail 
        || '注册失败';
      
      console.error('[注册API路由] 注册失败:', {
        status: registerResponse.status,
        errorMessage,
        fullError: registerData,
      });
      
      return NextResponse.json(
        {
          message: errorMessage,
          error: registerData,
        },
        { status: registerResponse.status }
      );
    }

    // 注册成功后，自动登录获取令牌
    try {
      const loginResponse = await fetch(`${BACKEND_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: body.email || body.username,
          password: body.password,
        }),
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        // 计算过期时间戳
        const expiresAt = Date.now() + (loginData.expires_in * 1000);
        
        // 返回用户信息和令牌
        return NextResponse.json(
          {
            user: {
              id: String(registerData.id),
              email: registerData.email,
              username: registerData.username,
              name: registerData.full_name,
              avatar: registerData.avatar_url,
              role: 'user',
              status: 'active',
              emailVerified: registerData.is_verified ? new Date() : null,
              createdAt: new Date(registerData.created_at),
              updatedAt: new Date(registerData.created_at),
            },
            accessToken: loginData.access_token,
            refreshToken: loginData.refresh_token,
            expiresAt,
          },
          { status: 201 }
        );
      }
    } catch (loginError) {
      console.error('[自动登录错误]', loginError);
    }

    // 如果自动登录失败，仍然返回注册成功的用户信息
    return NextResponse.json(
      {
        user: registerData,
        message: '注册成功，请登录',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[注册错误]', error);
    
    return NextResponse.json(
      {
        message: '注册服务暂时不可用，请稍后重试',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

