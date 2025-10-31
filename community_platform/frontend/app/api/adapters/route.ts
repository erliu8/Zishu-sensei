/**
 * Adapters API Route
 * 代理adapters请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyGetRequest, proxyPostRequest } from '../lib/auth.utils';

/**
 * GET /api/adapters
 * 获取适配器列表
 */
export async function GET(request: NextRequest) {
  return proxyGetRequest(request, '/adapters', false);
}

/**
 * POST /api/adapters
 * 创建适配器
 */
export async function POST(request: NextRequest) {
  return proxyPostRequest(request, '/adapters', true);
}

