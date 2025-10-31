/**
 * 认证状态检查 API 路由
 * @module app/api/auth/me
 */

import { NextRequest } from 'next/server';
import { proxyGetRequest } from '../../lib/auth.utils';

/**
 * GET /api/auth/me
 * 检查当前用户的认证状态
 */
export async function GET(request: NextRequest) {
  return proxyGetRequest(request, '/auth/me', true);
}


