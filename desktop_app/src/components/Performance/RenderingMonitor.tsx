/**
 * 渲染性能监控面板
 * 
 * 实时显示渲染性能指标和优化建议
 */

import React, { useState, useEffect } from 'react';
import {
  usePerformanceMonitor,
  usePerformanceAnalyzer,
  useFPS,
} from '../../hooks/useRenderOptimization';
import './RenderingMonitor.css';

// ============================================================================
// 性能监控面板组件
// ============================================================================

export interface RenderingMonitorProps {
  // 是否显示详细信息
  detailed?: boolean;
  // 更新间隔（毫秒）
  updateInterval?: number;
  // 自定义类名
  className?: string;
  // 是否默认展开
  defaultExpanded?: boolean;
}

export function RenderingMonitor(props: RenderingMonitorProps) {
  const {
    detailed = false,
    updateInterval = 1000,
    className = '',
    defaultExpanded = false,
  } = props;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'overview' | 'components' | 'suggestions'>('overview');

  // 性能监控
  const {
    isMonitoring,
    performanceData,
    startMonitoring,
    stopMonitoring,
    clearRecords,
  } = usePerformanceMonitor({
    autoStart: false,
    sampleInterval: updateInterval,
  });

  // 性能分析
  const { analysis, isAnalyzing, analyze } = usePerformanceAnalyzer();

  // FPS 监控
  const fpsData = useFPS(updateInterval);

  // 渲染状态指示器
  const getPerformanceStatus = () => {
    if (fpsData.average >= 55) return { status: 'excellent', color: '#4caf50', label: '优秀' };
    if (fpsData.average >= 45) return { status: 'good', color: '#2196f3', label: '良好' };
    if (fpsData.average >= 30) return { status: 'fair', color: '#ff9800', label: '一般' };
    return { status: 'poor', color: '#f44336', label: '较差' };
  };

  const performanceStatus = getPerformanceStatus();

  // 切换监控
  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  // 分析性能
  const handleAnalyze = () => {
    analyze();
  };

  return (
    <div className={`rendering-monitor ${expanded ? 'expanded' : ''} ${className}`}>
      {/* 头部 */}
      <div className="monitor-header" onClick={() => setExpanded(!expanded)}>
        <div className="header-left">
          <div
            className="status-indicator"
            style={{ backgroundColor: performanceStatus.color }}
          />
          <span className="monitor-title">渲染性能监控</span>
          <span className="status-label">{performanceStatus.label}</span>
        </div>
        <div className="header-right">
          <span className="fps-display">{fpsData.average.toFixed(0)} FPS</span>
          <button
            className={`expand-button ${expanded ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path
                d="M4 6l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 内容 */}
      {expanded && (
        <div className="monitor-content">
          {/* 工具栏 */}
          <div className="monitor-toolbar">
            <button
              className={`toolbar-button ${isMonitoring ? 'active' : ''}`}
              onClick={handleToggleMonitoring}
            >
              {isMonitoring ? '停止监控' : '开始监控'}
            </button>
            <button
              className="toolbar-button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? '分析中...' : '性能分析'}
            </button>
            <button className="toolbar-button" onClick={clearRecords}>
              清空记录
            </button>
          </div>

          {/* 标签页 */}
          <div className="monitor-tabs">
            <button
              className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              概览
            </button>
            <button
              className={`tab-button ${activeTab === 'components' ? 'active' : ''}`}
              onClick={() => setActiveTab('components')}
            >
              组件统计
            </button>
            <button
              className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
              onClick={() => setActiveTab('suggestions')}
            >
              优化建议
            </button>
          </div>

          {/* 标签页内容 */}
          <div className="tab-content">
            {activeTab === 'overview' && (
              <OverviewTab
                performanceData={performanceData}
                fpsData={fpsData}
                detailed={detailed}
              />
            )}
            {activeTab === 'components' && (
              <ComponentsTab
                stats={analysis.stats}
                detailed={detailed}
              />
            )}
            {activeTab === 'suggestions' && (
              <SuggestionsTab
                suggestions={performanceData.suggestions}
                analysis={analysis}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 概览标签页
// ============================================================================

interface OverviewTabProps {
  performanceData: any;
  fpsData: any;
  detailed: boolean;
}

function OverviewTab({ performanceData, fpsData, detailed }: OverviewTabProps) {
  return (
    <div className="overview-tab">
      {/* FPS 指标 */}
      <div className="metric-group">
        <h4>帧率 (FPS)</h4>
        <div className="metrics-grid">
          <MetricCard label="当前" value={fpsData.current} unit="FPS" />
          <MetricCard label="平均" value={fpsData.average} unit="FPS" />
          <MetricCard label="最小" value={fpsData.min} unit="FPS" />
          <MetricCard label="最大" value={fpsData.max} unit="FPS" />
        </div>
      </div>

      {/* 渲染指标 */}
      <div className="metric-group">
        <h4>渲染性能</h4>
        <div className="metrics-grid">
          <MetricCard
            label="平均渲染时间"
            value={performanceData.avgRenderTime.toFixed(2)}
            unit="ms"
          />
          <MetricCard
            label="总渲染次数"
            value={performanceData.totalRenders}
            unit="次"
          />
          <MetricCard
            label="慢渲染次数"
            value={performanceData.slowRenders}
            unit="次"
          />
          <MetricCard
            label="慢渲染比例"
            value={
              performanceData.totalRenders > 0
                ? ((performanceData.slowRenders / performanceData.totalRenders) * 100).toFixed(1)
                : '0'
            }
            unit="%"
          />
        </div>
      </div>

      {/* 详细信息 */}
      {detailed && (
        <div className="metric-group">
          <h4>详细信息</h4>
          <div className="detail-list">
            <div className="detail-item">
              <span className="detail-label">监控状态:</span>
              <span className="detail-value">活动中</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">采样间隔:</span>
              <span className="detail-value">1000ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 组件统计标签页
// ============================================================================

interface ComponentsTabProps {
  stats: any;
  detailed: boolean;
}

function ComponentsTab({ stats, detailed }: ComponentsTabProps) {
  if (!stats || !stats.componentStats) {
    return (
      <div className="empty-state">
        <p>暂无组件统计数据</p>
        <p className="empty-hint">请先启动性能监控并分析</p>
      </div>
    );
  }

  const components = Object.entries(stats.componentStats)
    .map(([name, data]: [string, any]) => ({
      name,
      ...data,
    }))
    .sort((a, b) => b.averageTime - a.averageTime);

  return (
    <div className="components-tab">
      <div className="components-list">
        {components.map((component) => (
          <div key={component.name} className="component-item">
            <div className="component-header">
              <span className="component-name">{component.name}</span>
              <span className="component-time">{component.averageTime.toFixed(2)}ms</span>
            </div>
            <div className="component-stats">
              <span className="stat">渲染: {component.renderCount}次</span>
              <span className="stat">最大: {component.maxTime.toFixed(2)}ms</span>
              <span className="stat">最小: {component.minTime.toFixed(2)}ms</span>
            </div>
            <div className="component-bar">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.min((component.averageTime / 50) * 100, 100)}%`,
                  backgroundColor: component.averageTime > 16 ? '#f44336' : '#4caf50',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 优化建议标签页
// ============================================================================

interface SuggestionsTabProps {
  suggestions: any[];
  analysis: any;
}

function SuggestionsTab({ suggestions, analysis }: SuggestionsTabProps) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="empty-state">
        <p>暂无优化建议</p>
        <p className="empty-hint">性能表现良好！</p>
      </div>
    );
  }

  // 按严重程度分组
  const grouped = {
    critical: suggestions.filter((s) => s.severity === 'critical'),
    warning: suggestions.filter((s) => s.severity === 'warning'),
    info: suggestions.filter((s) => s.severity === 'info'),
  };

  return (
    <div className="suggestions-tab">
      {grouped.critical.length > 0 && (
        <div className="suggestion-group">
          <h4 className="group-title critical">严重问题 ({grouped.critical.length})</h4>
          {grouped.critical.map((suggestion, index) => (
            <SuggestionCard key={index} suggestion={suggestion} />
          ))}
        </div>
      )}

      {grouped.warning.length > 0 && (
        <div className="suggestion-group">
          <h4 className="group-title warning">警告 ({grouped.warning.length})</h4>
          {grouped.warning.map((suggestion, index) => (
            <SuggestionCard key={index} suggestion={suggestion} />
          ))}
        </div>
      )}

      {grouped.info.length > 0 && (
        <div className="suggestion-group">
          <h4 className="group-title info">信息 ({grouped.info.length})</h4>
          {grouped.info.map((suggestion, index) => (
            <SuggestionCard key={index} suggestion={suggestion} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 子组件
// ============================================================================

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
}

function MetricCard({ label, value, unit }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: any;
}

function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '⚪';
    }
  };

  return (
    <div className={`suggestion-card severity-${suggestion.severity}`}>
      <div className="suggestion-header">
        <span className="severity-icon">{getSeverityIcon(suggestion.severity)}</span>
        <span className="suggestion-category">{suggestion.category}</span>
        {suggestion.component && (
          <span className="suggestion-component">{suggestion.component}</span>
        )}
      </div>
      <div className="suggestion-message">{suggestion.message}</div>
      <div className="suggestion-action">{suggestion.suggestion}</div>
    </div>
  );
}

// 默认导出
export default RenderingMonitor;

