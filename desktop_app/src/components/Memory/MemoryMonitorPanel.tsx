/**
 * 内存监控面板组件
 * 提供实时内存监控、统计和管理功能
 */

import React, { useState, useEffect } from 'react';
import {
  useMemoryInfo,
  useMemoryPoolStats,
  useMemorySnapshots,
  useMemoryLeakDetection,
  useMemoryCleanup,
  useMemoryStatus,
  useMemoryThresholds,
  useMemoryOptimization,
} from '../../hooks/useMemory';
import {
  formatBytes,
  formatMemoryUsage,
  getMemoryStatusColor,
  getMemoryStatusText,
  getLeakSeverityText,
  getLeakSeverityColor,
  calculateMemoryTrend,
} from '../../types/memory';
import { live2dMemoryManager } from '../../utils/live2dMemoryManager';
import { messageMemoryManager } from '../../utils/messageMemoryManager';
import './MemoryMonitorPanel.css';

export const MemoryMonitorPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'pools' | 'leaks' | 'snapshots' | 'settings'>('overview');

  // 使用内存管理 Hooks
  const { memoryInfo, refresh: refreshMemoryInfo } = useMemoryInfo(5000);
  const { poolStats } = useMemoryPoolStats(10000);
  const { snapshots, createSnapshot } = useMemorySnapshots(50);
  const { leaks, detectLeaks, detecting } = useMemoryLeakDetection(true, 600000);
  const { cleanup, cleaning, lastResult } = useMemoryCleanup();
  const { status } = useMemoryStatus(5000);
  const { thresholds, updateThresholds } = useMemoryThresholds();
  const { optimizationEnabled, startOptimization, stopOptimization } = useMemoryOptimization();

  // 本地状态
  const [live2dStats, setLive2dStats] = useState(live2dMemoryManager.getMemoryStats());
  const [messageStats, setMessageStats] = useState(messageMemoryManager.getMemoryStats());

  // 定期更新本地统计
  useEffect(() => {
    const timer = setInterval(() => {
      setLive2dStats(live2dMemoryManager.getMemoryStats());
      setMessageStats(messageMemoryManager.getMemoryStats());
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // 处理清理操作
  const handleCleanup = async () => {
    try {
      await cleanup();
      await refreshMemoryInfo();
    } catch (error) {
      console.error('内存清理失败:', error);
    }
  };

  // 处理泄漏检测
  const handleDetectLeaks = async () => {
    try {
      await detectLeaks();
    } catch (error) {
      console.error('泄漏检测失败:', error);
    }
  };

  // 处理创建快照
  const handleCreateSnapshot = async () => {
    try {
      await createSnapshot();
    } catch (error) {
      console.error('创建快照失败:', error);
    }
  };

  // 计算内存趋势
  const memoryTrend = snapshots.length > 0 ? calculateMemoryTrend(snapshots) : 'stable';

  return (
    <div className="memory-monitor-panel">
      {/* 标题栏 */}
      <div className="memory-panel-header">
        <h2>内存监控</h2>
        <div className="memory-panel-actions">
          <button
            className="btn btn-secondary"
            onClick={optimizationEnabled ? stopOptimization : startOptimization}
          >
            {optimizationEnabled ? '停止优化' : '启动优化'}
          </button>
          <button className="btn btn-primary" onClick={handleCleanup} disabled={cleaning}>
            {cleaning ? '清理中...' : '清理内存'}
          </button>
        </div>
      </div>

      {/* 状态概览 */}
      <div className="memory-status-bar" style={{ borderLeftColor: getMemoryStatusColor(status) }}>
        <div className="memory-status-item">
          <span className="label">状态:</span>
          <span className="value" style={{ color: getMemoryStatusColor(status) }}>
            {getMemoryStatusText(status)}
          </span>
        </div>
        {memoryInfo && (
          <>
            <div className="memory-status-item">
              <span className="label">应用内存:</span>
              <span className="value">{formatBytes(memoryInfo.app_memory)}</span>
            </div>
            <div className="memory-status-item">
              <span className="label">系统内存使用率:</span>
              <span className="value">{formatMemoryUsage(memoryInfo.usage_percentage)}</span>
            </div>
            <div className="memory-status-item">
              <span className="label">趋势:</span>
              <span className={`value trend-${memoryTrend}`}>
                {memoryTrend === 'increasing' ? '↑ 上升' : memoryTrend === 'decreasing' ? '↓ 下降' : '→ 稳定'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 标签页 */}
      <div className="memory-panel-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          概览
        </button>
        <button
          className={`tab ${activeTab === 'pools' ? 'active' : ''}`}
          onClick={() => setActiveTab('pools')}
        >
          内存池
        </button>
        <button
          className={`tab ${activeTab === 'leaks' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaks')}
        >
          泄漏检测 {leaks.length > 0 && <span className="badge">{leaks.length}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'snapshots' ? 'active' : ''}`}
          onClick={() => setActiveTab('snapshots')}
        >
          快照历史
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          设置
        </button>
      </div>

      {/* 标签页内容 */}
      <div className="memory-panel-content">
        {/* 概览标签 */}
        {activeTab === 'overview' && memoryInfo && (
          <div className="overview-tab">
            {/* 系统内存 */}
            <div className="memory-card">
              <h3>系统内存</h3>
              <div className="memory-info-grid">
                <div className="info-item">
                  <span className="info-label">总内存:</span>
                  <span className="info-value">{formatBytes(memoryInfo.total_memory)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">已用内存:</span>
                  <span className="info-value">{formatBytes(memoryInfo.used_memory)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">可用内存:</span>
                  <span className="info-value">{formatBytes(memoryInfo.available_memory)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">使用率:</span>
                  <span className="info-value">{formatMemoryUsage(memoryInfo.usage_percentage)}</span>
                </div>
              </div>
              <div className="memory-progress-bar">
                <div
                  className="memory-progress-fill"
                  style={{
                    width: `${memoryInfo.usage_percentage}%`,
                    backgroundColor: getMemoryStatusColor(status),
                  }}
                />
              </div>
            </div>

            {/* 应用内存 */}
            <div className="memory-card">
              <h3>应用内存</h3>
              <div className="memory-info-grid">
                <div className="info-item">
                  <span className="info-label">应用占用:</span>
                  <span className="info-value">{formatBytes(memoryInfo.app_memory)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">占用率:</span>
                  <span className="info-value">{formatMemoryUsage(memoryInfo.app_memory_percentage)}</span>
                </div>
              </div>
            </div>

            {/* Live2D 内存 */}
            <div className="memory-card">
              <h3>Live2D 模型</h3>
              <div className="memory-info-grid">
                <div className="info-item">
                  <span className="info-label">已加载模型:</span>
                  <span className="info-value">{live2dStats.loadedModels}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">模型内存:</span>
                  <span className="info-value">{formatBytes(live2dStats.totalModelMemory)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">缓存纹理:</span>
                  <span className="info-value">{live2dStats.cachedTextures}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">纹理内存:</span>
                  <span className="info-value">{formatBytes(live2dStats.totalTextureMemory)}</span>
                </div>
              </div>
            </div>

            {/* 消息缓存 */}
            <div className="memory-card">
              <h3>消息缓存</h3>
              <div className="memory-info-grid">
                <div className="info-item">
                  <span className="info-label">缓存页数:</span>
                  <span className="info-value">{messageStats.cachedPages}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">缓存内存:</span>
                  <span className="info-value">{formatBytes(messageStats.totalMemoryUsage)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">平均页大小:</span>
                  <span className="info-value">{formatBytes(messageStats.averagePageSize)}</span>
                </div>
              </div>
            </div>

            {/* 最近清理结果 */}
            {lastResult && (
              <div className="memory-card">
                <h3>最近清理结果</h3>
                <div className="memory-info-grid">
                  <div className="info-item">
                    <span className="info-label">清理对象:</span>
                    <span className="info-value">{lastResult.cleaned_objects}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">耗时:</span>
                    <span className="info-value">{lastResult.duration_ms} ms</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 内存池标签 */}
        {activeTab === 'pools' && (
          <div className="pools-tab">
            <div className="pools-list">
              {poolStats.map(pool => (
                <div key={pool.name} className="pool-card">
                  <div className="pool-header">
                    <h4>{pool.name}</h4>
                    <span className="pool-usage">{formatMemoryUsage(pool.usage_percentage)}</span>
                  </div>
                  <div className="pool-stats">
                    <div className="pool-stat">
                      <span className="label">已分配:</span>
                      <span className="value">{pool.allocated_count} / {pool.capacity}</span>
                    </div>
                    <div className="pool-stat">
                      <span className="label">内存占用:</span>
                      <span className="value">{formatBytes(pool.total_bytes)}</span>
                    </div>
                    <div className="pool-stat">
                      <span className="label">峰值:</span>
                      <span className="value">{pool.peak_count}</span>
                    </div>
                  </div>
                  <div className="pool-progress">
                    <div
                      className="pool-progress-fill"
                      style={{
                        width: `${pool.usage_percentage}%`,
                        backgroundColor: pool.usage_percentage > 80 ? '#f5222d' : pool.usage_percentage > 60 ? '#faad14' : '#52c41a',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 泄漏检测标签 */}
        {activeTab === 'leaks' && (
          <div className="leaks-tab">
            <div className="leaks-header">
              <h3>内存泄漏检测</h3>
              <button className="btn btn-secondary" onClick={handleDetectLeaks} disabled={detecting}>
                {detecting ? '检测中...' : '立即检测'}
              </button>
            </div>

            {leaks.length === 0 ? (
              <div className="empty-state">
                <p>未检测到内存泄漏</p>
              </div>
            ) : (
              <div className="leaks-list">
                {leaks.map((leak, index) => (
                  <div key={index} className="leak-card" style={{ borderLeftColor: getLeakSeverityColor(leak.severity) }}>
                    <div className="leak-header">
                      <h4>{leak.leak_type}</h4>
                      <span className="leak-severity" style={{ color: getLeakSeverityColor(leak.severity) }}>
                        {getLeakSeverityText(leak.severity)}
                      </span>
                    </div>
                    <div className="leak-info">
                      <div className="leak-detail">
                        <span className="label">泄漏大小:</span>
                        <span className="value">{formatBytes(leak.size)}</span>
                      </div>
                      <div className="leak-detail">
                        <span className="label">位置:</span>
                        <span className="value">{leak.location}</span>
                      </div>
                      <div className="leak-detail">
                        <span className="label">检测时间:</span>
                        <span className="value">{new Date(leak.detected_at * 1000).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="leak-suggestion">
                      <strong>建议:</strong> {leak.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 快照历史标签 */}
        {activeTab === 'snapshots' && (
          <div className="snapshots-tab">
            <div className="snapshots-header">
              <h3>内存快照历史</h3>
              <button className="btn btn-secondary" onClick={handleCreateSnapshot}>
                创建快照
              </button>
            </div>

            {snapshots.length === 0 ? (
              <div className="empty-state">
                <p>暂无快照记录</p>
              </div>
            ) : (
              <div className="snapshots-list">
                {snapshots.slice().reverse().map((snapshot, index) => (
                  <div key={index} className="snapshot-card">
                    <div className="snapshot-header">
                      <span className="snapshot-time">
                        {new Date(snapshot.timestamp * 1000).toLocaleString()}
                      </span>
                      <span className="snapshot-memory">
                        {formatBytes(snapshot.memory_info.app_memory)}
                      </span>
                    </div>
                    <div className="snapshot-stats">
                      <div className="snapshot-stat">
                        <span className="label">系统使用率:</span>
                        <span className="value">{formatMemoryUsage(snapshot.memory_info.usage_percentage)}</span>
                      </div>
                      <div className="snapshot-stat">
                        <span className="label">内存池:</span>
                        <span className="value">{snapshot.pool_stats.length}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 设置标签 */}
        {activeTab === 'settings' && thresholds && (
          <div className="settings-tab">
            <div className="memory-card">
              <h3>内存阈值设置</h3>
              <div className="settings-form">
                <div className="form-group">
                  <label>警告阈值 (%):</label>
                  <input
                    type="number"
                    value={thresholds.warning_threshold}
                    onChange={e =>
                      updateThresholds({ ...thresholds, warning_threshold: parseFloat(e.target.value) })
                    }
                    min="0"
                    max="100"
                  />
                </div>
                <div className="form-group">
                  <label>严重阈值 (%):</label>
                  <input
                    type="number"
                    value={thresholds.critical_threshold}
                    onChange={e =>
                      updateThresholds({ ...thresholds, critical_threshold: parseFloat(e.target.value) })
                    }
                    min="0"
                    max="100"
                  />
                </div>
                <div className="form-group">
                  <label>自动清理阈值 (%):</label>
                  <input
                    type="number"
                    value={thresholds.auto_cleanup_threshold}
                    onChange={e =>
                      updateThresholds({ ...thresholds, auto_cleanup_threshold: parseFloat(e.target.value) })
                    }
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>

            <div className="memory-card">
              <h3>优化选项</h3>
              <div className="optimization-status">
                <p>
                  自动优化状态: <strong>{optimizationEnabled ? '已启用' : '已禁用'}</strong>
                </p>
                <p className="description">
                  启用后将自动执行内存清理、泄漏检测和快照采集
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryMonitorPanel;

