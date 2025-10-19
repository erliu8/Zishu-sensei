/**
 * 性能监控主面板组件
 * 
 * 提供完整的性能监控界面，包括：
 * - 实时性能仪表盘
 * - 性能指标图表
 * - 用户操作统计
 * - 网络性能监控
 * - 性能警告管理
 * - 配置管理
 */

import React, { useState } from 'react';
import {
  usePerformanceMonitor,
  usePerformanceMetrics,
  usePerformanceAlerts,
  useRealTimePerformance,
  usePerformanceReport,
} from '../../hooks/usePerformanceMonitor';
import { 
  usePerformanceIntegration, 
  useOperationTracker, 
  useMetricsTracker 
} from '../../hooks/usePerformanceIntegration';
import { useMemoryInfo } from '../../hooks/useMemory';
import { usePerformanceMonitor as useRenderMonitor } from '../../hooks/useRenderOptimization';
import {
  PerformanceCategory,
  TimePeriod,
  AlertSeverity,
  PERFORMANCE_CATEGORY_LABELS,
  ALERT_SEVERITY_LABELS,
  TIME_PERIOD_LABELS,
  PerformanceUtils,
} from '../../types/performance';
import './PerformanceMonitorPanel.css';

// 图标组件（简化实现）
const PlayIcon = () => <span>▶</span>;
const PauseIcon = () => <span>⏸</span>;
const RefreshIcon = () => <span>🔄</span>;
const DownloadIcon = () => <span>⬇️</span>;
const AlertIcon = () => <span>⚠️</span>;
const CheckIcon = () => <span>✓</span>;
const XIcon = () => <span>✗</span>;

export interface PerformanceMonitorPanelProps {
  className?: string;
  defaultTab?: string;
  showHeader?: boolean;
  autoRefresh?: boolean;
}

export function PerformanceMonitorPanel({
  className = '',
  defaultTab = 'dashboard',
  showHeader = true,
  autoRefresh = true,
}: PerformanceMonitorPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1h');
  const [selectedCategory, setSelectedCategory] = useState<PerformanceCategory>('cpu');

  const {
    isMonitoring,
    config,
    loading: monitorLoading,
    error: monitorError,
    startMonitoring,
    stopMonitoring,
    updateConfig,
    refresh: refreshMonitor,
  } = usePerformanceMonitor();

  const {
    metrics,
    stats,
    loading: metricsLoading,
    refresh: refreshMetrics,
  } = usePerformanceMetrics(selectedCategory, timePeriod, autoRefresh);

  const {
    alerts,
    stats: alertStats,
    loading: alertsLoading,
    resolveAlert,
    refresh: refreshAlerts,
  } = usePerformanceAlerts(false, timePeriod, autoRefresh);

  const { data: realTimeData, connected: realTimeConnected } = useRealTimePerformance();
  const { generateReport, loading: reportLoading } = usePerformanceReport();
  
  // 集成服务
  const {
    isActive: integrationActive,
    config: integrationConfig,
    uptime: integrationUptime,
    loading: integrationLoading,
    error: integrationError,
    start: startIntegration,
    stop: stopIntegration,
    syncNow: syncIntegrationData,
    updateConfig: updateIntegrationConfig,
  } = usePerformanceIntegration(autoRefresh);
  
  // 操作追踪
  const { trackClick } = useOperationTracker('PerformanceMonitorPanel');
  
  // 指标追踪
  const { trackTiming } = useMetricsTracker();
  
  // 现有监控系统数据
  const { memoryInfo } = useMemoryInfo(5000);
  const { performanceData: renderData } = useRenderMonitor({ autoStart: true });

  // 标签页配置
  const tabs = [
    { id: 'dashboard', label: '仪表盘', icon: '📊' },
    { id: 'metrics', label: '性能指标', icon: '📈' },
    { id: 'alerts', label: '性能警告', icon: '⚠️' },
    { id: 'reports', label: '性能报告', icon: '📋' },
    { id: 'integration', label: '系统集成', icon: '🔗' },
    { id: 'settings', label: '监控配置', icon: '⚙️' },
  ];

  // 处理监控开关
  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      await stopMonitoring();
    } else {
      await startMonitoring();
    }
  };

  // 处理生成报告
  const handleGenerateReport = async () => {
    await trackClick('generate-report', async () => {
      const startTime = Date.now();
      const report = await generateReport(timePeriod, true);
      const endTime = Date.now();
      
      // 记录报告生成时间
      await trackTiming('report_generation', startTime, endTime, 'user', 'PerformanceMonitorPanel');
      
      if (report) {
        // 下载报告（简化实现）
        const blob = new Blob([JSON.stringify(report, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${timePeriod}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  // 处理集成服务开关
  const handleToggleIntegration = async () => {
    await trackClick('toggle-integration', async () => {
      if (integrationActive) {
        await stopIntegration();
      } else {
        await startIntegration();
      }
    });
  };

  // 处理数据同步
  const handleSyncData = async () => {
    await trackClick('sync-data', async () => {
      await syncIntegrationData();
    });
  };

  // 处理集成配置更新
  const handleUpdateIntegrationConfig = async (newConfig: Partial<any>) => {
    await trackClick('update-integration-config', async () => {
      await updateIntegrationConfig(newConfig);
    });
  };

  // 渲染头部
  const renderHeader = () => {
    if (!showHeader) return null;

    return (
      <div className="performance-monitor-header">
        <div className="header-title">
          <h2>性能监控</h2>
          <div className="status-indicators">
            <div className="status-indicator">
              <span className={`status-dot ${isMonitoring ? 'active' : 'inactive'}`} />
              <span className="status-text">
                {isMonitoring ? '监控中' : '已停止'}
              </span>
            </div>
            <div className="status-indicator integration">
              <span className={`status-dot ${integrationActive ? 'active' : 'inactive'}`} />
              <span className="status-text">
                集成: {integrationActive ? '已启用' : '已禁用'}
              </span>
              {integrationActive && (
                <span className="uptime-text">
                  运行: {Math.floor(integrationUptime / 60000)}分
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="header-controls">
          <button
            className={`control-btn ${isMonitoring ? 'stop' : 'start'}`}
            onClick={handleToggleMonitoring}
            disabled={monitorLoading}
          >
            {isMonitoring ? <PauseIcon /> : <PlayIcon />}
            {isMonitoring ? '停止监控' : '启动监控'}
          </button>

          <button
            className="control-btn refresh"
            onClick={refreshMonitor}
            disabled={monitorLoading}
          >
            <RefreshIcon />
            刷新
          </button>

          <button
            className="control-btn report"
            onClick={handleGenerateReport}
            disabled={reportLoading}
          >
            <DownloadIcon />
            生成报告
          </button>

          <div className="control-divider" />

          <button
            className={`control-btn ${integrationActive ? 'stop' : 'start'}`}
            onClick={handleToggleIntegration}
            disabled={integrationLoading}
          >
            {integrationActive ? '🔌' : '🔗'}
            {integrationActive ? '停止集成' : '启动集成'}
          </button>

          <button
            className="control-btn sync"
            onClick={handleSyncData}
            disabled={!integrationActive || integrationLoading}
          >
            🔄
            同步数据
          </button>
        </div>
      </div>
    );
  };

  // 渲染标签页导航
  const renderTabs = () => (
    <div className="performance-monitor-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );

  // 渲染仪表盘
  const renderDashboard = () => (
    <div className="dashboard-content">
      <div className="dashboard-grid">
        {/* 实时性能卡片 */}
        <div className="performance-card realtime-card">
          <h3>实时性能</h3>
          {realTimeData && (
            <div className="realtime-metrics">
              <div className="metric-item">
                <span className="metric-label">CPU使用率</span>
                <span className={`metric-value ${realTimeData.recentMetrics.cpu_usage?.latest > 80 ? 'high' : 'normal'}`}>
                  {realTimeData.recentMetrics.cpu_usage?.latest?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">内存使用率</span>
                <span className={`metric-value ${realTimeData.recentMetrics.memory_usage?.latest > 80 ? 'high' : 'normal'}`}>
                  {realTimeData.recentMetrics.memory_usage?.latest?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">帧率</span>
                <span className={`metric-value ${realTimeData.recentMetrics.fps?.latest < 30 ? 'low' : 'normal'}`}>
                  {Math.round(realTimeData.recentMetrics.fps?.latest || 0)} FPS
                </span>
              </div>
            </div>
          )}
          {!realTimeConnected && (
            <div className="no-data">
              <span>实时数据连接断开</span>
            </div>
          )}
        </div>

        {/* 警告汇总卡片 */}
        <div className="performance-card alerts-card">
          <h3>性能警告</h3>
          {alertStats && (
            <div className="alerts-summary">
              <div className="alert-count">
                <span className="count-number">{alertStats.unresolvedAlerts}</span>
                <span className="count-label">未解决</span>
              </div>
              <div className="severity-breakdown">
                {Object.entries(alertStats.severityDistribution).map(([severity, count]) => (
                  <div key={severity} className={`severity-item severity-${severity}`}>
                    <span className="severity-count">{count}</span>
                    <span className="severity-label">{ALERT_SEVERITY_LABELS[severity as AlertSeverity]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 性能统计卡片 */}
        <div className="performance-card stats-card">
          <h3>性能统计</h3>
          {stats && (
            <div className="stats-summary">
              <div className="stat-item">
                <span className="stat-label">平均值</span>
                <span className="stat-value">
                  {PerformanceUtils.formatValue(stats.avgValue, 'ms')}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">P95</span>
                <span className="stat-value">
                  {PerformanceUtils.formatValue(stats.p95Value, 'ms')}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">数据点数</span>
                <span className="stat-value">{stats.count}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 最近警告列表 */}
      <div className="recent-alerts">
        <h3>最近警告</h3>
        <div className="alerts-list">
          {alerts.slice(0, 5).map(alert => (
            <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
              <div className="alert-info">
                <span className="alert-message">{alert.message}</span>
                <span className="alert-time">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
              <button
                className="resolve-btn"
                onClick={() => alert.id && resolveAlert(alert.id)}
              >
                <CheckIcon />
              </button>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="no-alerts">
              <span>暂无性能警告</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 渲染性能指标
  const renderMetrics = () => (
    <div className="metrics-content">
      <div className="metrics-controls">
        <div className="category-selector">
          <label>性能类别:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as PerformanceCategory)}
          >
            {Object.entries(PERFORMANCE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="time-period-selector">
          <label>时间范围:</label>
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
          >
            {Object.entries(TIME_PERIOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <button
          className="refresh-btn"
          onClick={refreshMetrics}
          disabled={metricsLoading}
        >
          <RefreshIcon />
          刷新数据
        </button>
      </div>

      <div className="metrics-display">
        {stats && (
          <div className="metrics-stats">
            <div className="stat-card">
              <h4>统计摘要</h4>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="label">平均值:</span>
                  <span className="value">{PerformanceUtils.formatValue(stats.avgValue, 'ms')}</span>
                </div>
                <div className="stat-item">
                  <span className="label">最小值:</span>
                  <span className="value">{PerformanceUtils.formatValue(stats.minValue, 'ms')}</span>
                </div>
                <div className="stat-item">
                  <span className="label">最大值:</span>
                  <span className="value">{PerformanceUtils.formatValue(stats.maxValue, 'ms')}</span>
                </div>
                <div className="stat-item">
                  <span className="label">P95:</span>
                  <span className="value">{PerformanceUtils.formatValue(stats.p95Value, 'ms')}</span>
                </div>
                <div className="stat-item">
                  <span className="label">P99:</span>
                  <span className="value">{PerformanceUtils.formatValue(stats.p99Value, 'ms')}</span>
                </div>
                <div className="stat-item">
                  <span className="label">数据点数:</span>
                  <span className="value">{stats.count}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="metrics-chart">
          {metricsLoading ? (
            <div className="loading">加载中...</div>
          ) : metrics.length > 0 ? (
            <div className="chart-placeholder">
              <p>性能指标图表</p>
              <p>共 {metrics.length} 个数据点</p>
              {/* 这里可以集成实际的图表库如 Chart.js 或 D3.js */}
            </div>
          ) : (
            <div className="no-data">
              <span>暂无性能数据</span>
            </div>
          )}
        </div>

        <div className="metrics-table">
          <h4>详细数据</h4>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>指标名称</th>
                  <th>值</th>
                  <th>组件</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 20).map(metric => (
                  <tr key={metric.id}>
                    <td>{new Date(metric.timestamp).toLocaleString()}</td>
                    <td>{metric.metricName}</td>
                    <td>{PerformanceUtils.formatValue(metric.metricValue, metric.unit)}</td>
                    <td>{metric.component || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染性能警告
  const renderAlerts = () => (
    <div className="alerts-content">
      <div className="alerts-header">
        <h3>性能警告管理</h3>
        <button
          className="refresh-btn"
          onClick={refreshAlerts}
          disabled={alertsLoading}
        >
          <RefreshIcon />
          刷新
        </button>
      </div>

      <div className="alerts-list-full">
        {alerts.map(alert => (
          <div key={alert.id} className={`alert-card severity-${alert.severity}`}>
            <div className="alert-header">
              <div className="alert-type">
                <AlertIcon />
                <span>{alert.alertType.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div className={`alert-severity severity-${alert.severity}`}>
                {ALERT_SEVERITY_LABELS[alert.severity]}
              </div>
            </div>

            <div className="alert-body">
              <p className="alert-message">{alert.message}</p>
              <div className="alert-details">
                <div className="detail-item">
                  <span className="label">阈值:</span>
                  <span className="value">{alert.threshold}</span>
                </div>
                <div className="detail-item">
                  <span className="label">实际值:</span>
                  <span className="value">{alert.actualValue}</span>
                </div>
                <div className="detail-item">
                  <span className="label">组件:</span>
                  <span className="value">{alert.component || '系统'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">持续时间:</span>
                  <span className="value">{alert.duration}秒</span>
                </div>
              </div>
            </div>

            <div className="alert-footer">
              <span className="alert-time">
                {new Date(alert.timestamp).toLocaleString()}
              </span>
              {!alert.resolved && (
                <button
                  className="resolve-btn"
                  onClick={() => alert.id && resolveAlert(alert.id)}
                >
                  <CheckIcon />
                  标记已解决
                </button>
              )}
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="no-alerts-full">
            <AlertIcon />
            <p>暂无性能警告</p>
            <small>性能监控正常运行中</small>
          </div>
        )}
      </div>
    </div>
  );

  // 渲染性能报告
  const renderReports = () => (
    <div className="reports-content">
      <div className="reports-header">
        <h3>性能报告</h3>
        <div className="report-controls">
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
          >
            {Object.entries(TIME_PERIOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            className="generate-btn"
            onClick={handleGenerateReport}
            disabled={reportLoading}
          >
            <DownloadIcon />
            生成报告
          </button>
        </div>
      </div>

      <div className="report-preview">
        <div className="preview-card">
          <h4>报告预览 - {TIME_PERIOD_LABELS[timePeriod]}</h4>
          <div className="preview-content">
            <div className="preview-section">
              <h5>性能概览</h5>
              <ul>
                <li>CPU 平均使用率: {realTimeData?.recentMetrics.cpu_usage?.average?.toFixed(1) || 0}%</li>
                <li>内存平均使用率: {realTimeData?.recentMetrics.memory_usage?.average?.toFixed(1) || 0}%</li>
                <li>平均帧率: {Math.round(realTimeData?.recentMetrics.fps?.average || 0)} FPS</li>
                <li>未解决警告数: {alertStats?.unresolvedAlerts || 0}</li>
              </ul>
            </div>
            <div className="preview-section">
              <h5>报告内容</h5>
              <ul>
                <li>✓ 性能指标统计</li>
                <li>✓ 警告分析和趋势</li>
                <li>✓ 用户操作统计</li>
                <li>✓ 网络性能分析</li>
                <li>✓ 性能优化建议</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染系统集成
  const renderIntegration = () => (
    <div className="integration-content">
      <div className="integration-header">
        <h3>系统集成</h3>
        <div className="integration-status">
          <span className={`status-indicator ${integrationActive ? 'active' : 'inactive'}`}>
            {integrationActive ? '🟢' : '🔴'}
            {integrationActive ? '集成已启用' : '集成已禁用'}
          </span>
          {integrationActive && (
            <span className="uptime">
              运行时间: {Math.floor(integrationUptime / 3600000)}小时 
              {Math.floor((integrationUptime % 3600000) / 60000)}分钟
            </span>
          )}
        </div>
      </div>

      <div className="integration-sections">
        {/* 系统状态 */}
        <div className="integration-section">
          <h4>集成状态</h4>
          <div className="status-grid">
            <div className="status-item">
              <span className="label">内存监控:</span>
              <span className={`status ${integrationConfig?.memorySync ? 'enabled' : 'disabled'}`}>
                {integrationConfig?.memorySync ? '✅ 已同步' : '❌ 已禁用'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">渲染监控:</span>
              <span className={`status ${integrationConfig?.renderingSync ? 'enabled' : 'disabled'}`}>
                {integrationConfig?.renderingSync ? '✅ 已同步' : '❌ 已禁用'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">系统监控:</span>
              <span className={`status ${integrationConfig?.systemSync ? 'enabled' : 'disabled'}`}>
                {integrationConfig?.systemSync ? '✅ 已同步' : '❌ 已禁用'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">用户追踪:</span>
              <span className={`status ${integrationConfig?.userTrackingEnabled ? 'enabled' : 'disabled'}`}>
                {integrationConfig?.userTrackingEnabled ? '✅ 已启用' : '❌ 已禁用'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">网络监控:</span>
              <span className={`status ${integrationConfig?.networkMonitoring ? 'enabled' : 'disabled'}`}>
                {integrationConfig?.networkMonitoring ? '✅ 已启用' : '❌ 已禁用'}
              </span>
            </div>
          </div>
        </div>

        {/* 实时数据概览 */}
        <div className="integration-section">
          <h4>实时数据概览</h4>
          <div className="data-overview">
            {memoryInfo && (
              <div className="data-card">
                <h5>内存信息</h5>
                <div className="data-stats">
                  <div className="stat">
                    <span className="label">系统内存使用率:</span>
                    <span className="value">{memoryInfo.usage_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="stat">
                    <span className="label">应用内存占用:</span>
                    <span className="value">{(memoryInfo.app_memory / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            )}

            {renderData && (
              <div className="data-card">
                <h5>渲染性能</h5>
                <div className="data-stats">
                  <div className="stat">
                    <span className="label">平均FPS:</span>
                    <span className="value">{renderData.fps.toFixed(1)}</span>
                  </div>
                  <div className="stat">
                    <span className="label">平均渲染时间:</span>
                    <span className="value">{renderData.avgRenderTime.toFixed(2)} ms</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 集成配置 */}
        <div className="integration-section">
          <h4>集成配置</h4>
          {integrationConfig && (
            <div className="config-form">
              <div className="form-group">
                <label>同步间隔 (毫秒):</label>
                <input
                  type="number"
                  value={integrationConfig.syncInterval}
                  onChange={(e) => handleUpdateIntegrationConfig({
                    syncInterval: parseInt(e.target.value)
                  })}
                  min="1000"
                  max="60000"
                  step="1000"
                />
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={integrationConfig.memorySync}
                    onChange={(e) => handleUpdateIntegrationConfig({
                      memorySync: e.target.checked
                    })}
                  />
                  启用内存数据同步
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={integrationConfig.renderingSync}
                    onChange={(e) => handleUpdateIntegrationConfig({
                      renderingSync: e.target.checked
                    })}
                  />
                  启用渲染数据同步
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={integrationConfig.userTrackingEnabled}
                    onChange={(e) => handleUpdateIntegrationConfig({
                      userTrackingEnabled: e.target.checked
                    })}
                  />
                  启用用户操作追踪
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={integrationConfig.networkMonitoring}
                    onChange={(e) => handleUpdateIntegrationConfig({
                      networkMonitoring: e.target.checked
                    })}
                  />
                  启用网络性能监控
                </label>
              </div>
            </div>
          )}
        </div>

        {/* 错误显示 */}
        {integrationError && (
          <div className="integration-section error">
            <h4>集成错误</h4>
            <div className="error-message">
              <XIcon />
              <span>{integrationError}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 渲染监控配置
  const renderSettings = () => (
    <div className="settings-content">
      <div className="settings-header">
        <h3>监控配置</h3>
      </div>

      {config && (
        <div className="config-form">
          <div className="config-section">
            <h4>基本设置</h4>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => updateConfig({
                    ...config,
                    enabled: e.target.checked,
                  })}
                />
                启用性能监控
              </label>
            </div>
            <div className="form-group">
              <label>指标采集间隔 (毫秒):</label>
              <input
                type="number"
                value={config.metricsInterval}
                onChange={(e) => updateConfig({
                  ...config,
                  metricsInterval: parseInt(e.target.value),
                })}
                min="1000"
                max="60000"
                step="1000"
              />
            </div>
            <div className="form-group">
              <label>快照采集间隔 (毫秒):</label>
              <input
                type="number"
                value={config.snapshotInterval}
                onChange={(e) => updateConfig({
                  ...config,
                  snapshotInterval: parseInt(e.target.value),
                })}
                min="5000"
                max="300000"
                step="5000"
              />
            </div>
            <div className="form-group">
              <label>数据保留天数:</label>
              <input
                type="number"
                value={config.retentionDays}
                onChange={(e) => updateConfig({
                  ...config,
                  retentionDays: parseInt(e.target.value),
                })}
                min="7"
                max="365"
              />
            </div>
          </div>

          <div className="config-section">
            <h4>性能阈值</h4>
            <div className="thresholds-grid">
              <div className="threshold-group">
                <h5>CPU 使用率 (%)</h5>
                <div className="threshold-inputs">
                  <div className="input-group">
                    <label>警告:</label>
                    <input
                      type="number"
                      value={config.thresholds.cpuUsageWarning}
                      onChange={(e) => updateConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          cpuUsageWarning: parseFloat(e.target.value),
                        },
                      })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="input-group">
                    <label>严重:</label>
                    <input
                      type="number"
                      value={config.thresholds.cpuUsageCritical}
                      onChange={(e) => updateConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          cpuUsageCritical: parseFloat(e.target.value),
                        },
                      })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="threshold-group">
                <h5>内存使用率 (%)</h5>
                <div className="threshold-inputs">
                  <div className="input-group">
                    <label>警告:</label>
                    <input
                      type="number"
                      value={config.thresholds.memoryUsageWarning}
                      onChange={(e) => updateConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          memoryUsageWarning: parseFloat(e.target.value),
                        },
                      })}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="input-group">
                    <label>严重:</label>
                    <input
                      type="number"
                      value={config.thresholds.memoryUsageCritical}
                      onChange={(e) => updateConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          memoryUsageCritical: parseFloat(e.target.value),
                        },
                      })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="threshold-group">
                <h5>帧率 (FPS)</h5>
                <div className="threshold-inputs">
                  <div className="input-group">
                    <label>警告:</label>
                    <input
                      type="number"
                      value={config.thresholds.fpsWarning}
                      onChange={(e) => updateConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          fpsWarning: parseFloat(e.target.value),
                        },
                      })}
                      min="1"
                      max="120"
                    />
                  </div>
                  <div className="input-group">
                    <label>严重:</label>
                    <input
                      type="number"
                      value={config.thresholds.fpsCritical}
                      onChange={(e) => updateConfig({
                        ...config,
                        thresholds: {
                          ...config.thresholds,
                          fpsCritical: parseFloat(e.target.value),
                        },
                      })}
                      min="1"
                      max="60"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染内容
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'metrics':
        return renderMetrics();
      case 'alerts':
        return renderAlerts();
      case 'reports':
        return renderReports();
      case 'integration':
        return renderIntegration();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  if (monitorError) {
    return (
      <div className={`performance-monitor-panel error ${className}`}>
        <div className="error-message">
          <XIcon />
          <span>性能监控加载失败: {monitorError}</span>
          <button onClick={refreshMonitor}>重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`performance-monitor-panel ${className}`}>
      {renderHeader()}
      {renderTabs()}
      <div className="performance-monitor-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default PerformanceMonitorPanel;
