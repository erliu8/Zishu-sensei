/**
 * Character Detail API Route  
 * 代理单个角色请求到后端
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGetRequest, proxyPatchRequest, proxyDeleteRequest } from '../../lib/auth.utils';

/**
 * GET /api/characters/[id]
 * 获取单个角色详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyGetRequest(request, `/characters/${id}`, false);
}

/**
 * PATCH /api/characters/[id]
 * 更新角色
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyPatchRequest(request, `/characters/${id}`, true);
}

/**
 * DELETE /api/characters/[id]
 * 删除角色
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyDeleteRequest(request, `/characters/${id}`, true);
}

