/**
 * 权限管理面板组件
 * 
 * 用于管理实体的权限授权，支持：
 * - 查看所有权限授权
 * - 授予/撤销权限
 * - 按分类筛选
 * - 权限统计
 */

import React, { useState, useMemo } from 'react';
import {
  PermissionGrant,
  Permission,
  PermissionCategory,
  PermissionStatus,
  PermissionLevel,
  PERMISSION_METADATA,
  PERMISSION_CATEGORY_NAMES,
  PERMISSION_LEVEL_NAMES,
  PERMISSION_STATUS_NAMES,
  PERMISSION_STATUS_COLORS,
} from '../../types/permission';
import { useEntityGrants, usePermissions, usePermissionStats, usePermissionPresets } from '../../hooks/usePermission';
import './PermissionManagementPanel.css';

interface PermissionManagementPanelProps {
  entityType: string;
  entityId: string;
  entityName?: string;
}

export const PermissionManagementPanel: React.FC<PermissionManagementPanelProps> = ({
  entityType,
  entityId,
  entityName,
}) => {
  const { grants, loading: grantsLoading, reload: reloadGrants, grant, revoke } = useEntityGrants(entityType, entityId);
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { stats } = usePermissionStats(entityType, entityId);
  const { presets, applyPreset } = usePermissionPresets();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<PermissionLevel>(PermissionLevel.READ_ONLY);

  // 按分类组织权限
  const permissionsByCategory = useMemo(() => {
    const map = new Map<string, Permission[]>();
    permissions.forEach((perm) => {
      const category = perm.category;
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(perm);
    });
    return map;
  }, [permissions]);

  // 创建权限授权映射
  const grantMap = useMemo(() => {
    const map = new Map<string, PermissionGrant>();
    grants.forEach((grant) => {
      map.set(grant.permission_type.toString(), grant);
    });
    return map;
  }, [grants]);

  // 过滤后的权限
  const filteredPermissions = useMemo(() => {
    return permissions.filter((perm) => {
      // 分类过滤
      if (selectedCategory !== 'all' && perm.category !== selectedCategory) {
        return false;
      }

      // 状态过滤
      if (selectedStatus !== 'all') {
        const grant = grantMap.get(perm.permission_type.toString());
        const status = grant?.status || 'none';
        if (status !== selectedStatus) {
          return false;
        }
      }

      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          perm.name.toLowerCase().includes(query) ||
          perm.display_name.toLowerCase().includes(query) ||
          perm.description.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [permissions, selectedCategory, selectedStatus, searchQuery, grantMap]);

  const handleGrantPermission = async () => {
    if (!selectedPermission) return;

    const success = await grant(
      selectedPermission.permission_type,
      selectedLevel
    );

    if (success) {
      setShowAddDialog(false);
      setSelectedPermission(null);
    }
  };

  const handleRevokePermission = async (permission: Permission) => {
    if (!window.confirm(`确定要撤销 ${permission.display_name} 权限吗？`)) {
      return;
    }

    await revoke(permission.permission_type, '用户手动撤销');
  };

  const handleApplyPreset = async (presetName: string) => {
    if (!window.confirm(`确定要应用 ${presetName} 权限预设吗？这将授予多个权限。`)) {
      return;
    }

    try {
      await applyPreset(entityType, entityId, presetName as any);
      await reloadGrants();
    } catch (err) {
      console.error('应用权限预设失败:', err);
      alert('应用权限预设失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  if (permissionsLoading || grantsLoading) {
    return <div className="permission-panel-loading">加载中...</div>;
  }

  return (
    <div className="permission-management-panel">
      <div className="permission-panel-header">
        <div className="permission-panel-title">
          <h2>权限管理</h2>
          <p className="permission-panel-entity">{entityName || entityId}</p>
        </div>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="permission-stats-grid">
          <div className="permission-stat-card">
            <div className="stat-value">{stats.total_grants}</div>
            <div className="stat-label">总授权数</div>
          </div>
          <div className="permission-stat-card active">
            <div className="stat-value">{stats.active_grants}</div>
            <div className="stat-label">活跃授权</div>
          </div>
          <div className="permission-stat-card pending">
            <div className="stat-value">{stats.pending_grants}</div>
            <div className="stat-label">待审核</div>
          </div>
          <div className="permission-stat-card denied">
            <div className="stat-value">{stats.denied_grants}</div>
            <div className="stat-label">已拒绝</div>
          </div>
        </div>
      )}

      {/* 权限预设 */}
      <div className="permission-presets">
        <h3>快速授权预设</h3>
        <div className="preset-buttons">
          {Object.keys(presets).map((presetName) => (
            <button
              key={presetName}
              className="preset-button"
              onClick={() => handleApplyPreset(presetName)}
            >
              {presetName}
            </button>
          ))}
        </div>
      </div>

      {/* 筛选工具栏 */}
      <div className="permission-filters">
        <div className="filter-group">
          <label>分类:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">全部</option>
            {Array.from(permissionsByCategory.keys()).map((category) => (
              <option key={category} value={category}>
                {PERMISSION_CATEGORY_NAMES[category as PermissionCategory] || category}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>状态:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">全部</option>
            <option value="granted">已授予</option>
            <option value="pending">待审核</option>
            <option value="denied">已拒绝</option>
            <option value="revoked">已撤销</option>
            <option value="none">未授予</option>
          </select>
        </div>

        <div className="filter-group search-group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索权限..."
            className="filter-search"
          />
        </div>
      </div>

      {/* 权限列表 */}
      <div className="permission-list">
        {filteredPermissions.length === 0 ? (
          <div className="permission-list-empty">
            <p>没有找到匹配的权限</p>
          </div>
        ) : (
          filteredPermissions.map((permission) => {
            const grant = grantMap.get(permission.permission_type.toString());
            const metadata = PERMISSION_METADATA[permission.permission_type];
            const status = grant?.status || 'none';

            return (
              <div key={permission.id} className="permission-item">
                <div className="permission-item-icon" style={{ color: metadata.color }}>
                  {metadata.icon}
                </div>

                <div className="permission-item-content">
                  <div className="permission-item-header">
                    <h4 className="permission-item-name">{permission.display_name}</h4>
                    {permission.is_dangerous && (
                      <span className="permission-item-badge danger">危险</span>
                    )}
                    {metadata.risk_level === 'critical' && (
                      <span className="permission-item-badge critical">高风险</span>
                    )}
                  </div>

                  <p className="permission-item-description">{permission.description}</p>

                  <div className="permission-item-meta">
                    <span className="permission-item-category">
                      {PERMISSION_CATEGORY_NAMES[permission.category as PermissionCategory]}
                    </span>
                    {grant && (
                      <>
                        <span
                          className="permission-item-status"
                          style={{ color: PERMISSION_STATUS_COLORS[grant.status] }}
                        >
                          {PERMISSION_STATUS_NAMES[grant.status]}
                        </span>
                        <span className="permission-item-level">
                          {PERMISSION_LEVEL_NAMES[grant.level]}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="permission-item-actions">
                  {grant && grant.status === PermissionStatus.GRANTED ? (
                    <button
                      className="permission-action-button revoke"
                      onClick={() => handleRevokePermission(permission)}
                    >
                      撤销
                    </button>
                  ) : (
                    <button
                      className="permission-action-button grant"
                      onClick={() => {
                        setSelectedPermission(permission);
                        setShowAddDialog(true);
                      }}
                    >
                      授予
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 授予权限对话框 */}
      {showAddDialog && selectedPermission && (
        <div className="permission-dialog-overlay" onClick={() => setShowAddDialog(false)}>
          <div className="permission-dialog-simple" onClick={(e) => e.stopPropagation()}>
            <h3>授予权限</h3>
            <p>{selectedPermission.display_name}</p>

            <div className="permission-level-selector">
              <label>权限级别:</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as PermissionLevel)}
                className="filter-select"
              >
                <option value={PermissionLevel.READ_ONLY}>只读</option>
                <option value={PermissionLevel.READ_WRITE}>读写</option>
                <option value={PermissionLevel.FULL}>完全控制</option>
              </select>
            </div>

            <div className="dialog-actions">
              <button
                className="dialog-button secondary"
                onClick={() => setShowAddDialog(false)}
              >
                取消
              </button>
              <button
                className="dialog-button primary"
                onClick={handleGrantPermission}
              >
                确认授予
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionManagementPanel;

