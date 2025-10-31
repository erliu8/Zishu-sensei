/**
 * Characters API Route  
 * 代理characters请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyGetRequest, proxyPostRequest } from '../lib/auth.utils';

/**
 * GET /api/characters
 * 获取角色列表
 */
export async function GET(request: NextRequest) {
  return proxyGetRequest(request, '/characters', false);
}

/**
 * POST /api/characters
 * 创建角色
 */
export async function POST(request: NextRequest) {
  return proxyPostRequest(request, '/characters', true);
}

