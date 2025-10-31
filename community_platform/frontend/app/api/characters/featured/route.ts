/**
 * Featured Characters API Route
 * 代理推荐角色请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyGetRequest } from '../../lib/auth.utils';

/**
 * GET /api/characters/featured
 * 获取推荐角色列表
 */
export async function GET(request: NextRequest) {
  return proxyGetRequest(request, '/characters/featured', false);
}

