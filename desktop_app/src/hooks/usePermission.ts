/**
 * 权限管理 React Hook
 * 
 * 提供便捷的权限管理功能，包括：
 * - 权限查询和缓存
 * - 权限状态管理
 * - 权限检查
 * - 权限授权流程
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Permission,
  PermissionGrant,
  PermissionUsageLog,
  PermissionStats,
  PermissionType,
  PermissionLevel,
  PermissionStatus,
} from '../types/permission';
import * as permissionService from '../services/permissionService';

/**
 * 使用权限列表
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await permissionService.getAllPermissions();
      setPermissions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载权限失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return {
    permissions,
    loading,
    error,
    reload: loadPermissions,
  };
}

/**
 * 使用实体权限授权
 */
export function useEntityGrants(entityType: string, entityId: string) {
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadGrants = useCallback(async () => {
    if (!entityType || !entityId) {
      setGrants([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await permissionService.getEntityGrants(entityType, entityId);
      setGrants(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载权限授权失败'));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  // 授予权限
  const grant = useCallback(
    async (
      permissionType: PermissionType,
      level: PermissionLevel,
      scope?: string,
      expiresAt?: string
    ) => {
      try {
        await permissionService.grantPermission({
          entity_type: entityType,
          entity_id: entityId,
          permission_type: permissionType,
          level,
          scope,
          expires_at: expiresAt,
          granted_by: 'user',
        });
        await loadGrants();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('授予权限失败'));
        return false;
      }
    },
    [entityType, entityId, loadGrants]
  );

  // 撤销权限
  const revoke = useCallback(
    async (permissionType: PermissionType, reason?: string, scope?: string) => {
      try {
        await permissionService.revokePermission({
          entity_type: entityType,
          entity_id: entityId,
          permission_type: permissionType,
          reason,
          scope,
        });
        await loadGrants();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('撤销权限失败'));
        return false;
      }
    },
    [entityType, entityId, loadGrants]
  );

  // 拒绝权限
  const deny = useCallback(
    async (permissionType: PermissionType, reason?: string, scope?: string) => {
      try {
        await permissionService.denyPermission({
          entity_type: entityType,
          entity_id: entityId,
          permission_type: permissionType,
          reason,
          scope,
        });
        await loadGrants();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('拒绝权限失败'));
        return false;
      }
    },
    [entityType, entityId, loadGrants]
  );

  // 统计信息
  const stats = useMemo(() => {
    const total = grants.length;
    const active = grants.filter((g) => g.status === PermissionStatus.GRANTED).length;
    const pending = grants.filter((g) => g.status === PermissionStatus.PENDING).length;
    const denied = grants.filter((g) => g.status === PermissionStatus.DENIED).length;
    const revoked = grants.filter((g) => g.status === PermissionStatus.REVOKED).length;

    return { total, active, pending, denied, revoked };
  }, [grants]);

  return {
    grants,
    loading,
    error,
    reload: loadGrants,
    grant,
    revoke,
    deny,
    stats,
  };
}

/**
 * 使用待审核权限
 */
export function usePendingGrants() {
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadPendingGrants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await permissionService.getPendingGrants();
      setGrants(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载待审核权限失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingGrants();
  }, [loadPendingGrants]);

  // 授予权限
  const approve = useCallback(
    async (grant: PermissionGrant) => {
      try {
        await permissionService.grantPermission({
          entity_type: grant.entity_type,
          entity_id: grant.entity_id,
          permission_type: grant.permission_type,
          level: grant.level,
          scope: grant.scope || undefined,
          granted_by: 'user',
        });
        await loadPendingGrants();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('批准权限失败'));
        return false;
      }
    },
    [loadPendingGrants]
  );

  // 拒绝权限
  const reject = useCallback(
    async (grant: PermissionGrant, reason?: string) => {
      try {
        await permissionService.denyPermission({
          entity_type: grant.entity_type,
          entity_id: grant.entity_id,
          permission_type: grant.permission_type,
          scope: grant.scope || undefined,
          reason,
        });
        await loadPendingGrants();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('拒绝权限失败'));
        return false;
      }
    },
    [loadPendingGrants]
  );

  return {
    grants,
    loading,
    error,
    reload: loadPendingGrants,
    approve,
    reject,
  };
}

/**
 * 使用权限检查
 */
export function usePermissionCheck(
  entityType: string,
  entityId: string,
  permissionType: PermissionType,
  level: PermissionLevel
) {
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async () => {
    if (!entityType || !entityId) {
      setGranted(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await permissionService.checkPermission({
        entity_type: entityType,
        entity_id: entityId,
        permission_type: permissionType,
        level,
      });
      setGranted(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('检查权限失败'));
      setGranted(false);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, permissionType, level]);

  useEffect(() => {
    check();
  }, [check]);

  return {
    granted,
    loading,
    error,
    recheck: check,
  };
}

/**
 * 使用权限统计
 */
export function usePermissionStats(entityType: string, entityId: string) {
  const [stats, setStats] = useState<PermissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadStats = useCallback(async () => {
    if (!entityType || !entityId) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await permissionService.getPermissionStats(entityType, entityId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载权限统计失败'));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    reload: loadStats,
  };
}

/**
 * 使用权限使用日志
 */
export function usePermissionUsageLogs(
  entityType?: string,
  entityId?: string,
  permissionType?: string,
  limit: number = 100
) {
  const [logs, setLogs] = useState<PermissionUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadLogs = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);
        const currentOffset = reset ? 0 : offset;
        const data = await permissionService.getPermissionUsageLogs({
          entityType,
          entityId,
          permissionType,
          limit,
          offset: currentOffset,
        });
        
        if (reset) {
          setLogs(data);
          setOffset(data.length);
        } else {
          setLogs((prev) => [...prev, ...data]);
          setOffset((prev) => prev + data.length);
        }
        
        setHasMore(data.length === limit);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('加载权限使用日志失败'));
      } finally {
        setLoading(false);
      }
    },
    [entityType, entityId, permissionType, limit, offset]
  );

  useEffect(() => {
    loadLogs(true);
  }, [entityType, entityId, permissionType, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadLogs(false);
    }
  }, [loading, hasMore, loadLogs]);

  const reload = useCallback(() => {
    setOffset(0);
    loadLogs(true);
  }, [loadLogs]);

  return {
    logs,
    loading,
    error,
    hasMore,
    loadMore,
    reload,
  };
}

/**
 * 使用权限预设
 */
export function usePermissionPresets() {
  const applyPreset = useCallback(
    async (
      entityType: string,
      entityId: string,
      presetName: keyof typeof permissionService.PERMISSION_PRESETS
    ) => {
      try {
        await permissionService.applyPermissionPreset(entityType, entityId, presetName, 'user');
        return true;
      } catch (err) {
        throw err instanceof Error ? err : new Error('应用权限预设失败');
      }
    },
    []
  );

  return {
    presets: permissionService.PERMISSION_PRESETS,
    applyPreset,
  };
}

