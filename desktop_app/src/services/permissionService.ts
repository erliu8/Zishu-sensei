/**
 * 权限管理服务
 * 
 * 提供完整的权限管理功能，包括：
 * - 权限定义查询
 * - 权限授权管理
 * - 权限检查验证
 * - 权限使用记录
 * - 权限统计分析
 * - 权限组管理
 */

import { invoke } from '@tauri-apps/api/tauri';
import {
  Permission,
  PermissionGrant,
  PermissionUsageLog,
  PermissionGroup,
  PermissionStats,
  PermissionType,
  PermissionLevel,
  PermissionStatus,
  PermissionRequest,
  PermissionGrantRequest,
  PermissionRevokeRequest,
  PermissionCheckRequest,
  PermissionUsageLogRequest,
  PermissionGroupRequest,
  GrantPermissionGroupRequest,
  PermissionCheckResult,
} from '../types/permission';

/**
 * 命令响应包装类型
 */
interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ================================
// 权限定义查询
// ================================

/**
 * 获取所有权限定义
 */
export async function getAllPermissions(): Promise<Permission[]> {
  const response = await invoke<CommandResponse<Permission[]>>('get_all_permissions');
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || '获取权限定义失败');
}

/**
 * 获取指定类型的权限定义
 */
export async function getPermissionByType(
  permissionType: PermissionType
): Promise<Permission | null> {
  const response = await invoke<CommandResponse<Permission | null>>('get_permission_by_type', {
    permissionType,
  });
  if (response.success) {
    return response.data || null;
  }
  throw new Error(response.error || '获取权限定义失败');
}

/**
 * 获取分类的权限列表
 */
export async function getPermissionsByCategory(category: string): Promise<Permission[]> {
  const response = await invoke<CommandResponse<Permission[]>>('get_permissions_by_category', {
    category,
  });
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || '获取分类权限失败');
}

// ================================
// 权限授权管理
// ================================

/**
 * 请求权限
 */
export async function requestPermission(request: PermissionRequest): Promise<number> {
  const response = await invoke<CommandResponse<number>>('request_permission', { request });
  if (response.success && response.data !== undefined) {
    return response.data;
  }
  throw new Error(response.error || '请求权限失败');
}

/**
 * 授予权限
 */
export async function grantPermission(request: PermissionGrantRequest): Promise<boolean> {
  const response = await invoke<CommandResponse<boolean>>('grant_permission', { request });
  if (response.success) {
    return true;
  }
  throw new Error(response.error || '授予权限失败');
}

/**
 * 拒绝权限
 */
export async function denyPermission(request: PermissionRevokeRequest): Promise<boolean> {
  const response = await invoke<CommandResponse<boolean>>('deny_permission', { request });
  if (response.success) {
    return true;
  }
  throw new Error(response.error || '拒绝权限失败');
}

/**
 * 撤销权限
 */
export async function revokePermission(request: PermissionRevokeRequest): Promise<boolean> {
  const response = await invoke<CommandResponse<boolean>>('revoke_permission', { request });
  if (response.success) {
    return true;
  }
  throw new Error(response.error || '撤销权限失败');
}

/**
 * 检查权限
 */
export async function checkPermission(request: PermissionCheckRequest): Promise<boolean> {
  const response = await invoke<CommandResponse<boolean>>('check_permission', { request });
  if (response.success && response.data !== undefined) {
    return response.data;
  }
  return false;
}

/**
 * 获取实体的所有权限授权
 */
export async function getEntityGrants(
  entityType: string,
  entityId: string
): Promise<PermissionGrant[]> {
  const response = await invoke<CommandResponse<PermissionGrant[]>>('get_entity_grants', {
    entityType,
    entityId,
  });
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || '获取权限授权失败');
}

/**
 * 获取待审核的权限请求
 */
export async function getPendingGrants(): Promise<PermissionGrant[]> {
  const response = await invoke<CommandResponse<PermissionGrant[]>>('get_pending_grants');
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || '获取待审核权限失败');
}

/**
 * 清理过期的权限授权
 */
export async function cleanupExpiredGrants(): Promise<number> {
  const response = await invoke<CommandResponse<number>>('cleanup_expired_grants');
  if (response.success && response.data !== undefined) {
    return response.data;
  }
  throw new Error(response.error || '清理过期权限失败');
}

// ================================
// 权限使用日志
// ================================

/**
 * 记录权限使用
 */
export async function logPermissionUsage(logRequest: PermissionUsageLogRequest): Promise<number> {
  const response = await invoke<CommandResponse<number>>('log_permission_usage', { logRequest });
  if (response.success && response.data !== undefined) {
    return response.data;
  }
  throw new Error(response.error || '记录权限使用失败');
}

/**
 * 获取权限使用日志
 */
export async function getPermissionUsageLogs(params: {
  entityType?: string;
  entityId?: string;
  permissionType?: string;
  limit?: number;
  offset?: number;
}): Promise<PermissionUsageLog[]> {
  const response = await invoke<CommandResponse<PermissionUsageLog[]>>(
    'get_permission_usage_logs',
    params
  );
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || '获取权限使用日志失败');
}

/**
 * 获取权限统计信息
 */
export async function getPermissionStats(
  entityType: string,
  entityId: string
): Promise<PermissionStats> {
  const response = await invoke<CommandResponse<PermissionStats>>('get_permission_stats', {
    entityType,
    entityId,
  });
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || '获取权限统计失败');
}

// ================================
// 权限组管理
// ================================

/**
 * 创建权限组
 */
export async function createPermissionGroup(request: PermissionGroupRequest): Promise<number> {
  const response = await invoke<CommandResponse<number>>('create_permission_group', { request });
  if (response.success && response.data !== undefined) {
    return response.data;
  }
  throw new Error(response.error || '创建权限组失败');
}

/**
 * 获取权限组
 */
export async function getPermissionGroup(name: string): Promise<PermissionGroup | null> {
  const response = await invoke<CommandResponse<PermissionGroup | null>>('get_permission_group', {
    name,
  });
  if (response.success) {
    return response.data || null;
  }
  throw new Error(response.error || '获取权限组失败');
}

/**
 * 获取所有权限组
 */
export async function getAllPermissionGroups(): Promise<PermissionGroup[]> {
  const response = await invoke<CommandResponse<PermissionGroup[]>>('get_all_permission_groups');
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.error || '获取权限组列表失败');
}

/**
 * 授予权限组
 */
export async function grantPermissionGroup(request: GrantPermissionGroupRequest): Promise<boolean> {
  const response = await invoke<CommandResponse<boolean>>('grant_permission_group', { request });
  if (response.success) {
    return true;
  }
  throw new Error(response.error || '授予权限组失败');
}

// ================================
// 便捷方法
// ================================

/**
 * 批量检查权限
 */
export async function checkPermissions(
  entityType: string,
  entityId: string,
  permissions: Array<{ type: PermissionType; level: PermissionLevel }>
): Promise<PermissionCheckResult[]> {
  const results: PermissionCheckResult[] = [];
  
  for (const perm of permissions) {
    try {
      const granted = await checkPermission({
        entity_type: entityType,
        entity_id: entityId,
        permission_type: perm.type,
        level: perm.level,
      });
      results.push({
        granted,
        reason: granted ? undefined : '权限未授予',
      });
    } catch (error) {
      results.push({
        granted: false,
        reason: error instanceof Error ? error.message : '检查失败',
      });
    }
  }
  
  return results;
}

/**
 * 获取实体的危险权限列表
 */
export async function getDangerousPermissions(
  entityType: string,
  entityId: string
): Promise<PermissionGrant[]> {
  const allGrants = await getEntityGrants(entityType, entityId);
  const allPermissions = await getAllPermissions();
  
  const dangerousPermissionTypes = new Set(
    allPermissions.filter((p) => p.is_dangerous).map((p) => p.permission_type)
  );
  
  return allGrants.filter((grant) =>
    dangerousPermissionTypes.has(grant.permission_type)
  );
}

/**
 * 获取实体的活跃权限列表
 */
export async function getActivePermissions(
  entityType: string,
  entityId: string
): Promise<PermissionGrant[]> {
  const allGrants = await getEntityGrants(entityType, entityId);
  return allGrants.filter((grant) => grant.status === PermissionStatus.GRANTED);
}

/**
 * 批量授予权限
 */
export async function batchGrantPermissions(
  entityType: string,
  entityId: string,
  permissions: Array<{ type: PermissionType; level: PermissionLevel; scope?: string }>,
  grantedBy?: string,
  expiresAt?: string
): Promise<boolean> {
  for (const perm of permissions) {
    await grantPermission({
      entity_type: entityType,
      entity_id: entityId,
      permission_type: perm.type,
      level: perm.level,
      scope: perm.scope,
      granted_by: grantedBy,
      expires_at: expiresAt,
    });
  }
  return true;
}

/**
 * 批量撤销权限
 */
export async function batchRevokePermissions(
  entityType: string,
  entityId: string,
  permissionTypes: PermissionType[],
  reason?: string
): Promise<boolean> {
  for (const type of permissionTypes) {
    await revokePermission({
      entity_type: entityType,
      entity_id: entityId,
      permission_type: type,
      reason,
    });
  }
  return true;
}

/**
 * 导出权限配置
 */
export function exportPermissionConfig(grants: PermissionGrant[]): string {
  const config = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    grants: grants.map((grant) => ({
      permission_type: grant.permission_type,
      level: grant.level,
      scope: grant.scope,
      status: grant.status,
    })),
  };
  return JSON.stringify(config, null, 2);
}

/**
 * 导入权限配置
 */
export async function importPermissionConfig(
  entityType: string,
  entityId: string,
  configJson: string,
  grantedBy?: string
): Promise<boolean> {
  try {
    const config = JSON.parse(configJson);
    if (!config.grants || !Array.isArray(config.grants)) {
      throw new Error('无效的配置格式');
    }
    
    for (const grant of config.grants) {
      if (grant.status === PermissionStatus.GRANTED) {
        await grantPermission({
          entity_type: entityType,
          entity_id: entityId,
          permission_type: grant.permission_type,
          level: grant.level,
          scope: grant.scope,
          granted_by: grantedBy,
        });
      }
    }
    
    return true;
  } catch (error) {
    throw new Error('导入权限配置失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

// ================================
// 权限预设模板
// ================================

/**
 * 权限预设模板
 */
export const PERMISSION_PRESETS = {
  /**
   * 基础适配器权限（最低限度）
   */
  BASIC_ADAPTER: [
    { type: PermissionType.NETWORK_HTTP, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.SYSTEM_INFO, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.SYSTEM_NOTIFICATION, level: PermissionLevel.READ_WRITE },
  ],
  
  /**
   * 文件处理适配器
   */
  FILE_PROCESSOR: [
    { type: PermissionType.FILE_READ, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.FILE_WRITE, level: PermissionLevel.READ_WRITE },
    { type: PermissionType.NETWORK_HTTP, level: PermissionLevel.READ_ONLY },
  ],
  
  /**
   * 网络服务适配器
   */
  NETWORK_SERVICE: [
    { type: PermissionType.NETWORK_HTTP, level: PermissionLevel.FULL },
    { type: PermissionType.NETWORK_WEBSOCKET, level: PermissionLevel.READ_WRITE },
    { type: PermissionType.NETWORK_DNS, level: PermissionLevel.READ_ONLY },
  ],
  
  /**
   * 数据分析适配器
   */
  DATA_ANALYZER: [
    { type: PermissionType.FILE_READ, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.APP_DATABASE, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.APP_CHAT_HISTORY, level: PermissionLevel.READ_ONLY },
  ],
  
  /**
   * 系统工具适配器
   */
  SYSTEM_TOOL: [
    { type: PermissionType.SYSTEM_INFO, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.SYSTEM_CLIPBOARD, level: PermissionLevel.READ_WRITE },
    { type: PermissionType.SYSTEM_NOTIFICATION, level: PermissionLevel.READ_WRITE },
  ],
  
  /**
   * 受信任适配器（高级权限）
   */
  TRUSTED: [
    { type: PermissionType.FILE_READ, level: PermissionLevel.FULL },
    { type: PermissionType.FILE_WRITE, level: PermissionLevel.FULL },
    { type: PermissionType.NETWORK_HTTP, level: PermissionLevel.FULL },
    { type: PermissionType.SYSTEM_INFO, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.APP_DATABASE, level: PermissionLevel.READ_WRITE },
    { type: PermissionType.APP_CONFIG, level: PermissionLevel.READ_WRITE },
  ],
};

/**
 * 应用权限预设
 */
export async function applyPermissionPreset(
  entityType: string,
  entityId: string,
  presetName: keyof typeof PERMISSION_PRESETS,
  grantedBy?: string
): Promise<boolean> {
  const preset = PERMISSION_PRESETS[presetName];
  if (!preset) {
    throw new Error('未知的权限预设: ' + presetName);
  }
  
  return batchGrantPermissions(entityType, entityId, preset, grantedBy);
}

