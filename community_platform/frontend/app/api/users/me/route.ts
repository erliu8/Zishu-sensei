/**
 * 当前用户 API 路由
 * @module app/api/users/me
 */

import { NextRequest } from 'next/server';
import { proxyGetRequest, proxyDeleteRequest } from '../../lib/auth.utils';

/**
 * GET /api/users/me
 * 获取当前登录用户资料
 */
export async function GET(request: NextRequest) {
  return proxyGetRequest(request, '/users/me', true);
}

/**
 * DELETE /api/users/me
 * 删除当前用户账号
 */
export async function DELETE(request: NextRequest) {
  return proxyDeleteRequest(request, '/users/me', true);
}

