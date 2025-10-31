/**
 * Publish Character API Route
 * 代理角色发布请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyPostRequest } from '../../../lib/auth.utils';

/**
 * POST /api/characters/[id]/publish
 * 发布角色
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyPostRequest(request, `/characters/${id}/publish`, true);
}

