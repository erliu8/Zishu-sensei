/**
 * Posts API Route
 * 代理posts请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyGetRequest, proxyPostRequest } from '../lib/auth.utils';

/**
 * GET /api/posts
 * 获取帖子列表
 */
export async function GET(request: NextRequest) {
  return proxyGetRequest(request, '/posts', false);
}

/**
 * POST /api/posts
 * 创建帖子
 */
export async function POST(request: NextRequest) {
  return proxyPostRequest(request, '/posts', true);
}

