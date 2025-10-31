/**
 * Trending Characters API Route
 * 代理热门角色请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyGetRequest } from '../../lib/auth.utils';

/**
 * GET /api/characters/trending
 * 获取热门角色列表
 */
export async function GET(request: NextRequest) {
  return proxyGetRequest(request, '/characters/trending', false);
}

