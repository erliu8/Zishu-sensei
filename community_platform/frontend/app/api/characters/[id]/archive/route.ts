/**
 * Archive Character API Route
 * 代理角色归档请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyPostRequest } from '../../../lib/auth.utils';

/**
 * POST /api/characters/[id]/archive
 * 归档角色
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyPostRequest(request, `/characters/${id}/archive`, true);
}

