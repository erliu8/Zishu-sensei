/**
 * 权限对话框组件
 * 
 * 用于显示权限请求对话框，允许用户批准或拒绝权限
 */

import React, { useState } from 'react';
import {
  Permission,
  PermissionGrant,
  PERMISSION_METADATA,
  PERMISSION_LEVEL_NAMES,
} from '../../types/permission';
import './PermissionDialog.css';

interface PermissionDialogProps {
  visible: boolean;
  grant?: PermissionGrant;
  permission?: Permission;
  loading?: boolean;
  onApprove: (expiresAt?: string) => Promise<boolean>;
  onReject: (reason?: string) => Promise<boolean>;
  onClose: () => void;
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  visible,
  grant,
  permission,
  loading = false,
  onApprove,
  onReject,
  onClose,
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never');

  if (!visible || !grant) {
    return null;
  }

  const metadata = PERMISSION_METADATA[grant.permission_type];
  const levelName = PERMISSION_LEVEL_NAMES[grant.level];

  const handleApprove = async () => {
    let expiresAt: string | undefined;
    
    if (expiresIn !== 'never') {
      const now = new Date();
      switch (expiresIn) {
        case '1hour':
          now.setHours(now.getHours() + 1);
          break;
        case '1day':
          now.setDate(now.getDate() + 1);
          break;
        case '7days':
          now.setDate(now.getDate() + 7);
          break;
        case '30days':
          now.setDate(now.getDate() + 30);
          break;
      }
      expiresAt = now.toISOString();
    }

    const success = await onApprove(expiresAt);
    if (success) {
      // 重置状态
      setShowRejectInput(false);
      setRejectReason('');
      setExpiresIn('never');
    }
  };

  const handleReject = async () => {
    const success = await onReject(rejectReason || undefined);
    if (success) {
      // 重置状态
      setShowRejectInput(false);
      setRejectReason('');
      setExpiresIn('never');
    }
  };

  return (
    <div className="permission-dialog-overlay">
      <div className="permission-dialog">
        <div className="permission-dialog-header">
          <div className="permission-dialog-icon" style={{ color: metadata.color }}>
            {metadata.icon}
          </div>
          <h2 className="permission-dialog-title">权限请求</h2>
        </div>

        <div className="permission-dialog-content">
          <div className="permission-request-info">
            <div className="permission-entity">
              <span className="permission-label">请求者:</span>
              <span className="permission-value">
                {grant.entity_type === 'adapter' ? '适配器' : '应用'}: {grant.entity_id}
              </span>
            </div>

            <div className="permission-name">
              <span className="permission-label">权限名称:</span>
              <span className="permission-value">
                {permission?.display_name || grant.permission_type}
              </span>
            </div>

            <div className="permission-level">
              <span className="permission-label">权限级别:</span>
              <span className="permission-value permission-level-badge" data-level={grant.level}>
                {levelName}
              </span>
            </div>

            {grant.scope && (
              <div className="permission-scope">
                <span className="permission-label">访问范围:</span>
                <span className="permission-value permission-scope-value">{grant.scope}</span>
              </div>
            )}

            <div className="permission-description">
              <p className="permission-desc-text">{metadata.user_friendly_description}</p>
              {permission?.description && (
                <p className="permission-detail-text">{permission.description}</p>
              )}
            </div>

            {permission?.is_dangerous && (
              <div className="permission-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-text">
                  <strong>危险权限</strong>
                  <p>此权限可能访问敏感数据或执行危险操作，请谨慎授权。</p>
                </div>
              </div>
            )}

            {metadata.risk_level === 'critical' && (
              <div className="permission-warning critical">
                <div className="warning-icon">🚨</div>
                <div className="warning-text">
                  <strong>严重风险</strong>
                  <p>此权限具有严重风险，建议仅授予完全信任的应用。</p>
                </div>
              </div>
            )}
          </div>

          {!showRejectInput ? (
            <>
              <div className="permission-expires-selector">
                <label className="permission-label">授权有效期:</label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="permission-select"
                  disabled={loading}
                >
                  <option value="never">永久有效</option>
                  <option value="1hour">1 小时</option>
                  <option value="1day">1 天</option>
                  <option value="7days">7 天</option>
                  <option value="30days">30 天</option>
                </select>
              </div>

              <div className="permission-dialog-actions">
                <button
                  className="permission-button permission-button-reject"
                  onClick={() => setShowRejectInput(true)}
                  disabled={loading}
                >
                  拒绝
                </button>
                <button
                  className="permission-button permission-button-approve"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  {loading ? '处理中...' : '授权'}
                </button>
              </div>
            </>
          ) : (
            <div className="permission-reject-form">
              <label className="permission-label">拒绝原因 (可选):</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请输入拒绝原因..."
                className="permission-textarea"
                rows={3}
                disabled={loading}
              />
              <div className="permission-dialog-actions">
                <button
                  className="permission-button permission-button-secondary"
                  onClick={() => setShowRejectInput(false)}
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  className="permission-button permission-button-reject"
                  onClick={handleReject}
                  disabled={loading}
                >
                  {loading ? '处理中...' : '确认拒绝'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          className="permission-dialog-close"
          onClick={onClose}
          disabled={loading}
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default PermissionDialog;

