/**
 * Clone Character API Route
 * 代理角色克隆请求到后端
 */

import { NextRequest } from 'next/server';
import { proxyPostRequest } from '../../../lib/auth.utils';

/**
 * POST /api/characters/[id]/clone
 * 克隆角色
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyPostRequest(request, `/characters/${id}/clone`, true);
}

