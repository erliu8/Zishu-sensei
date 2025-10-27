/**
 * 数据清理组件
 * 允许用户清理或删除个人数据
 */

import React, { useState } from 'react';
import PrivacyService from '../../services/privacyService';
import type { CleanupOptions, CleanupResult } from '../../types/privacy';
import './DataCleanup.css';

export const DataCleanup: React.FC = () => {
  const [dataTypes, setDataTypes] = useState<string[]>([
    'learning_history',
    'practice_records',
  ]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [cleaning, setCleaning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const availableDataTypes = [
    {
      value: 'learning_history',
      label: '学习历史',
      description: '包括课程学习记录',
    },
    {
      value: 'practice_records',
      label: '练习记录',
      description: '包括练习题完成情况',
    },
    {
      value: 'test_results',
      label: '测试结果',
      description: '包括各类测试成绩',
    },
    {
      value: 'progress_data',
      label: '进度数据',
      description: '包括学习进度统计',
    },
    {
      value: 'cache_data',
      label: '缓存数据',
      description: '包括临时文件和缓存',
    },
  ];

  const handleCleanup = () => {
    if (dataTypes.length === 0) {
      alert('请至少选择一种要清理的数据类型');
      return;
    }
    setShowConfirmModal(true);
  };

  const performCleanup = async () => {
    setCleaning(true);
    setShowConfirmModal(false);
    try {
      const options: CleanupOptions = {
        dataTypes,
        cleanAll: false,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const result: CleanupResult = await PrivacyService.cleanupData(options);

      if (result.success) {
        alert(
          `数据清理成功！\n已清理 ${result.recordsDeleted} 条记录\n释放空间: ${(result.spaceFreed / 1024 / 1024).toFixed(2)} MB`
        );
      } else {
        alert('数据清理失败: ' + result.error);
      }
    } catch (error) {
      alert('数据清理失败: ' + error);
    } finally {
      setCleaning(false);
    }
  };

  const handleDeleteAll = async () => {
    setCleaning(true);
    setShowDeleteAllModal(false);
    try {
      const result: CleanupResult = await PrivacyService.deleteAllUserData();

      if (result.success) {
        alert('所有数据已删除，应用将重新启动');
        window.location.reload();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      alert('删除失败: ' + error);
    } finally {
      setCleaning(false);
    }
  };

  const handleCheckboxChange = (value: string, checked: boolean) => {
    if (checked) {
      setDataTypes([...dataTypes, value]);
    } else {
      setDataTypes(dataTypes.filter((t) => t !== value));
    }
  };

  return (
    <div className="data-cleanup-container">
      <div className="data-cleanup-content">
        {/* 标题 */}
        <div className="cleanup-header">
          <h2>🗑️ 数据清理</h2>
          <p className="cleanup-description">清理不需要的数据，释放存储空间</p>
        </div>

        {/* 警告提示 */}
        <div className="cleanup-alert cleanup-alert-warning">
          <strong>⚠️ 注意</strong>
          <p>清理的数据将永久删除且无法恢复。建议在清理前先导出重要数据。</p>
        </div>

        {/* 数据类型选择 */}
        <div className="cleanup-card">
          <h3>选择要清理的数据类型</h3>
          <div className="cleanup-checkboxes">
            {availableDataTypes.map((type) => (
              <label key={type.value} className="cleanup-checkbox-label">
                <input
                  type="checkbox"
                  checked={dataTypes.includes(type.value)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleCheckboxChange(type.value, e.target.checked)
                  }
                />
                <div className="cleanup-checkbox-content">
                  <strong>{type.label}</strong>
                  <span className="cleanup-checkbox-desc">{type.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 日期范围 */}
        <div className="cleanup-card">
          <h3>日期范围（可选）</h3>
          <p className="cleanup-hint">仅清理指定日期范围内的数据，留空则清理所有</p>
          <div className="cleanup-date-range">
            <div className="cleanup-date-input">
              <label>开始日期:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="cleanup-date-input">
              <label>结束日期:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 清理按钮 */}
        <div className="cleanup-actions">
          <button
            className="cleanup-button cleanup-button-primary"
            disabled={cleaning}
            onClick={handleCleanup}
          >
            {cleaning ? '清理中...' : '🗑️ 清理选定数据'}
          </button>
        </div>

        {/* 危险区域 */}
        <div className="cleanup-card cleanup-card-danger">
          <h3>⚠️ 危险区域</h3>
          <div className="cleanup-danger-content">
            <h4>删除所有用户数据</h4>
            <p>
              这将永久删除您在应用中的所有数据，包括学习历史、设置、进度等。此操作不可撤销。
            </p>
            <button
              className="cleanup-button cleanup-button-danger"
              disabled={cleaning}
              onClick={() => setShowDeleteAllModal(true)}
            >
              删除所有数据
            </button>
          </div>
        </div>

        {/* 说明 */}
        <div className="cleanup-info">
          <h4>关于数据清理</h4>
          <ul>
            <li>清理数据可以释放存储空间</li>
            <li>清理操作在本地执行，不涉及网络传输</li>
            <li>部分数据清理后可能影响应用功能</li>
            <li>建议定期清理不需要的缓存数据</li>
          </ul>
        </div>
      </div>

      {/* 确认清理模态框 */}
      {showConfirmModal && (
        <div className="cleanup-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="cleanup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cleanup-modal-header">
              <h3>确认清理数据</h3>
              <button
                className="cleanup-modal-close"
                onClick={() => setShowConfirmModal(false)}
              >
                ×
              </button>
            </div>
            <div className="cleanup-modal-body">
              <p>即将清理以下数据：</p>
              <ul>
                {dataTypes.map((type) => {
                  const dataType = availableDataTypes.find((t) => t.value === type);
                  return <li key={type}>{dataType?.label}</li>;
                })}
              </ul>
              {dateFrom && dateTo && (
                <p>
                  日期范围: {dateFrom} 至 {dateTo}
                </p>
              )}
              <div className="cleanup-alert cleanup-alert-warning">
                <strong>此操作不可撤销</strong>
                <p>清理的数据将永久删除，无法恢复</p>
              </div>
            </div>
            <div className="cleanup-modal-footer">
              <button
                className="cleanup-button cleanup-button-secondary"
                onClick={() => setShowConfirmModal(false)}
              >
                取消
              </button>
              <button className="cleanup-button cleanup-button-danger" onClick={performCleanup}>
                确认清理
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除所有数据模态框 */}
      {showDeleteAllModal && (
        <div className="cleanup-modal-overlay" onClick={() => setShowDeleteAllModal(false)}>
          <div className="cleanup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cleanup-modal-header">
              <h3>删除所有用户数据</h3>
              <button
                className="cleanup-modal-close"
                onClick={() => setShowDeleteAllModal(false)}
              >
                ×
              </button>
            </div>
            <div className="cleanup-modal-body">
              <div className="cleanup-alert cleanup-alert-error">
                <strong>⚠️ 警告：此操作不可撤销</strong>
                <p>
                  这将删除您在应用中的所有数据，包括学习历史、设置、进度等所有信息。删除后，应用将恢复到初始状态。
                </p>
              </div>
              <p>
                <strong>请确保您已经导出了需要保留的数据。</strong>
              </p>
            </div>
            <div className="cleanup-modal-footer">
              <button
                className="cleanup-button cleanup-button-secondary"
                onClick={() => setShowDeleteAllModal(false)}
              >
                取消
              </button>
              <button className="cleanup-button cleanup-button-danger" onClick={handleDeleteAll}>
                确认删除所有数据
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCleanup;
