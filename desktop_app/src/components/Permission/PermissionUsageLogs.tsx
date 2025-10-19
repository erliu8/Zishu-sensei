/**
 * 权限使用日志组件
 * 
 * 显示权限使用记录，支持：
 * - 查看使用日志
 * - 按实体、权限类型筛选
 * - 分页加载
 * - 时间轴展示
 */

import React, { useState, useMemo } from 'react';
import {
  PermissionUsageLog,
  PERMISSION_METADATA,
  PERMISSION_LEVEL_NAMES,
} from '../../types/permission';
import { usePermissionUsageLogs } from '../../hooks/usePermission';
import './PermissionUsageLogs.css';

interface PermissionUsageLogsProps {
  entityType?: string;
  entityId?: string;
  permissionType?: string;
  limit?: number;
}

export const PermissionUsageLogs: React.FC<PermissionUsageLogsProps> = ({
  entityType,
  entityId,
  permissionType,
  limit = 50,
}) => {
  const { logs, loading, hasMore, loadMore, reload } = usePermissionUsageLogs(
    entityType,
    entityId,
    permissionType,
    limit
  );

  const [selectedLog, setSelectedLog] = useState<PermissionUsageLog | null>(null);
  const [filterSuccess, setFilterSuccess] = useState<string>('all');

  // 按日期分组日志
  const logsByDate = useMemo(() => {
    const filtered = logs.filter((log) => {
      if (filterSuccess === 'success') return log.success;
      if (filterSuccess === 'failed') return !log.success;
      return true;
    });

    const groups = new Map<string, PermissionUsageLog[]>();
    filtered.forEach((log) => {
      const date = new Date(log.used_at).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(log);
    });
    return Array.from(groups.entries());
  }, [logs, filterSuccess]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading && logs.length === 0) {
    return <div className="usage-logs-loading">加载中...</div>;
  }

  return (
    <div className="permission-usage-logs">
      <div className="usage-logs-header">
        <h2>权限使用日志</h2>
        <div className="usage-logs-actions">
          <select
            value={filterSuccess}
            onChange={(e) => setFilterSuccess(e.target.value)}
            className="usage-filter-select"
          >
            <option value="all">全部</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
          <button className="usage-reload-button" onClick={reload}>
            刷新
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="usage-logs-empty">
          <p>暂无权限使用记录</p>
        </div>
      ) : (
        <>
          <div className="usage-logs-timeline">
            {logsByDate.map(([date, dateLogs]) => (
              <div key={date} className="usage-logs-date-group">
                <div className="usage-logs-date-header">{date}</div>
                <div className="usage-logs-list">
                  {dateLogs.map((log) => {
                    const metadata = PERMISSION_METADATA[log.permission_type];
                    return (
                      <div
                        key={log.id}
                        className={`usage-log-item ${log.success ? 'success' : 'failed'}`}
                        onClick={() => setSelectedLog(log)}
                      >
                        <div className="usage-log-time">{formatTime(log.used_at)}</div>
                        <div className="usage-log-icon" style={{ color: metadata.color }}>
                          {metadata.icon}
                        </div>
                        <div className="usage-log-content">
                          <div className="usage-log-header">
                            <span className="usage-log-entity">
                              {log.entity_type}: {log.entity_id}
                            </span>
                            <span
                              className={`usage-log-status ${log.success ? 'success' : 'failed'}`}
                            >
                              {log.success ? '✓' : '✗'}
                            </span>
                          </div>
                          <div className="usage-log-permission">
                            {metadata.display_name} ({PERMISSION_LEVEL_NAMES[log.level]})
                          </div>
                          {log.scope && <div className="usage-log-scope">范围: {log.scope}</div>}
                          {!log.success && log.error_message && (
                            <div className="usage-log-error">{log.error_message}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="usage-logs-load-more">
              <button
                className="usage-load-more-button"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </>
      )}

      {/* 日志详情对话框 */}
      {selectedLog && (
        <div className="usage-log-dialog-overlay" onClick={() => setSelectedLog(null)}>
          <div className="usage-log-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="usage-log-dialog-header">
              <h3>日志详情</h3>
              <button
                className="usage-log-dialog-close"
                onClick={() => setSelectedLog(null)}
              >
                ✕
              </button>
            </div>
            <div className="usage-log-dialog-content">
              <div className="usage-log-detail-row">
                <span className="usage-log-detail-label">实体类型:</span>
                <span className="usage-log-detail-value">{selectedLog.entity_type}</span>
              </div>
              <div className="usage-log-detail-row">
                <span className="usage-log-detail-label">实体ID:</span>
                <span className="usage-log-detail-value">{selectedLog.entity_id}</span>
              </div>
              <div className="usage-log-detail-row">
                <span className="usage-log-detail-label">权限类型:</span>
                <span className="usage-log-detail-value">
                  {PERMISSION_METADATA[selectedLog.permission_type].display_name}
                </span>
              </div>
              <div className="usage-log-detail-row">
                <span className="usage-log-detail-label">权限级别:</span>
                <span className="usage-log-detail-value">
                  {PERMISSION_LEVEL_NAMES[selectedLog.level]}
                </span>
              </div>
              {selectedLog.scope && (
                <div className="usage-log-detail-row">
                  <span className="usage-log-detail-label">访问范围:</span>
                  <span className="usage-log-detail-value usage-log-scope-value">
                    {selectedLog.scope}
                  </span>
                </div>
              )}
              <div className="usage-log-detail-row">
                <span className="usage-log-detail-label">使用时间:</span>
                <span className="usage-log-detail-value">
                  {new Date(selectedLog.used_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="usage-log-detail-row">
                <span className="usage-log-detail-label">状态:</span>
                <span
                  className={`usage-log-detail-value usage-log-status-badge ${
                    selectedLog.success ? 'success' : 'failed'
                  }`}
                >
                  {selectedLog.success ? '成功' : '失败'}
                </span>
              </div>
              {!selectedLog.success && selectedLog.error_message && (
                <div className="usage-log-detail-row error">
                  <span className="usage-log-detail-label">错误信息:</span>
                  <span className="usage-log-detail-value usage-log-error-message">
                    {selectedLog.error_message}
                  </span>
                </div>
              )}
              {selectedLog.metadata && (
                <div className="usage-log-detail-row">
                  <span className="usage-log-detail-label">元数据:</span>
                  <pre className="usage-log-metadata">
                    {JSON.stringify(JSON.parse(selectedLog.metadata), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionUsageLogs;

