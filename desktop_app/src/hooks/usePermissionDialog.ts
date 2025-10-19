/**
 * 权限对话框 Hook
 * 
 * 管理权限请求对话框的显示和交互
 */

import { useState, useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  PermissionGrant,
  Permission,
  PermissionEventData,
  PermissionEventType,
} from '../types/permission';
import * as permissionService from '../services/permissionService';

interface PermissionDialogState {
  visible: boolean;
  grant?: PermissionGrant;
  permission?: Permission;
}

/**
 * 使用权限对话框
 */
export function usePermissionDialog() {
  const [state, setState] = useState<PermissionDialogState>({
    visible: false,
  });
  const [loading, setLoading] = useState(false);

  // 显示对话框
  const show = useCallback(async (grant: PermissionGrant) => {
    try {
      // 获取权限定义
      const permission = await permissionService.getPermissionByType(grant.permission_type);
      setState({
        visible: true,
        grant,
        permission: permission || undefined,
      });
    } catch (err) {
      console.error('Failed to load permission definition:', err);
      setState({
        visible: true,
        grant,
      });
    }
  }, []);

  // 隐藏对话框
  const hide = useCallback(() => {
    setState({
      visible: false,
    });
  }, []);

  // 授予权限
  const grant = useCallback(
    async (expiresAt?: string) => {
      if (!state.grant) return false;

      try {
        setLoading(true);
        await permissionService.grantPermission({
          entity_type: state.grant.entity_type,
          entity_id: state.grant.entity_id,
          permission_type: state.grant.permission_type,
          level: state.grant.level,
          scope: state.grant.scope || undefined,
          expires_at: expiresAt,
          granted_by: 'user',
        });
        hide();
        return true;
      } catch (err) {
        console.error('Failed to grant permission:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [state.grant, hide]
  );

  // 拒绝权限
  const deny = useCallback(
    async (reason?: string) => {
      if (!state.grant) return false;

      try {
        setLoading(true);
        await permissionService.denyPermission({
          entity_type: state.grant.entity_type,
          entity_id: state.grant.entity_id,
          permission_type: state.grant.permission_type,
          scope: state.grant.scope || undefined,
          reason,
        });
        hide();
        return true;
      } catch (err) {
        console.error('Failed to deny permission:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [state.grant, hide]
  );

  // 监听权限请求事件
  useEffect(() => {
    const unlisten = listen<PermissionEventData>('permission-request', (event) => {
      const data = event.payload;
      if (data.type === PermissionEventType.REQUEST) {
        // 从后端获取完整的 grant 信息
        permissionService
          .getEntityGrants(data.entity_type, data.entity_id)
          .then((grants) => {
            const grant = grants.find(
              (g) => g.permission_type === data.permission_type && g.level === data.level
            );
            if (grant) {
              show(grant);
            }
          })
          .catch((err) => {
            console.error('Failed to load grant:', err);
          });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [show]);

  return {
    visible: state.visible,
    grant: state.grant,
    permission: state.permission,
    loading,
    show,
    hide,
    approve: grant,
    reject: deny,
  };
}

/**
 * 使用权限请求队列
 */
export function usePermissionQueue() {
  const [queue, setQueue] = useState<PermissionGrant[]>([]);
  const [current, setCurrent] = useState<PermissionGrant | null>(null);

  // 添加到队列
  const enqueue = useCallback((grant: PermissionGrant) => {
    setQueue((prev) => [...prev, grant]);
  }, []);

  // 处理下一个
  const next = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrent(null);
        return prev;
      }
      const [first, ...rest] = prev;
      setCurrent(first);
      return rest;
    });
  }, []);

  // 清空队列
  const clear = useCallback(() => {
    setQueue([]);
    setCurrent(null);
  }, []);

  // 监听权限请求事件
  useEffect(() => {
    const unlisten = listen<PermissionEventData>('permission-request', (event) => {
      const data = event.payload;
      if (data.type === PermissionEventType.REQUEST) {
        permissionService
          .getEntityGrants(data.entity_type, data.entity_id)
          .then((grants) => {
            const grant = grants.find(
              (g) => g.permission_type === data.permission_type && g.level === data.level
            );
            if (grant) {
              enqueue(grant);
            }
          })
          .catch((err) => {
            console.error('Failed to load grant:', err);
          });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [enqueue]);

  // 自动处理队列
  useEffect(() => {
    if (!current && queue.length > 0) {
      next();
    }
  }, [current, queue, next]);

  return {
    queue,
    current,
    hasItems: queue.length > 0 || current !== null,
    enqueue,
    next,
    clear,
  };
}

