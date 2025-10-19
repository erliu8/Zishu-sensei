/**
 * 启动性能监控组件
 * 用于显示和分析应用启动性能指标
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useStartupOptimization } from '../../hooks/useStartupOptimization';
import { StartupMetrics, PerformanceMetric } from '../../types/startup';
import './StartupMonitor.css';

interface StartupMonitorProps {
  showRealTime?: boolean;
  showCharts?: boolean;
  showRecommendations?: boolean;
  onMetricsUpdate?: (metrics: StartupMetrics) => void;
}

interface PerformanceScore {
  overall: number;
  initialization: number;
  loading: number;
  rendering: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'moderate' | 'complex';
  category: string;
}

/**
 * 启动性能监控组件
 */
export const StartupMonitor: React.FC<StartupMonitorProps> = ({
  showRealTime = true,
  showCharts = true,
  showRecommendations = true,
  onMetricsUpdate,
}) => {
  const { 
    startupState, 
    getMetrics, 
    getDetailedMetrics,
    isStartupComplete,
  } = useStartupOptimization();

  const [metrics, setMetrics] = useState<StartupMetrics | null>(null);
  const [performanceScore, setPerformanceScore] = useState<PerformanceScore | null>(null);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'details' | 'recommendations'>('overview');

  // 更新性能指标
  const updateMetrics = useCallback(async () => {
    try {
      const currentMetrics = await getMetrics();
      if (currentMetrics) {
        setMetrics(currentMetrics);
        onMetricsUpdate?.(currentMetrics);
        
        // 计算性能评分
        const score = calculatePerformanceScore(currentMetrics);
        setPerformanceScore(score);
        
        // 生成优化建议
        const recs = generateRecommendations(currentMetrics, score);
        setRecommendations(recs);
      }
    } catch (error) {
      console.error('Failed to update startup metrics:', error);
    }
  }, [getMetrics, onMetricsUpdate]);

  // 计算性能评分
  const calculatePerformanceScore = useCallback((metrics: StartupMetrics): PerformanceScore => {
    const { totalDuration, phases } = metrics;
    
    // 基准时间（毫秒）
    const benchmarks = {
      excellent: 1000,  // A级
      good: 2000,       // B级
      fair: 3000,       // C级
      poor: 5000,       // D级
    };
    
    // 总体评分（基于总启动时间）
    let overall = 100;
    if (totalDuration > benchmarks.excellent) {
      overall = Math.max(0, 100 - ((totalDuration - benchmarks.excellent) / 100));
    }
    
    // 各阶段评分
    const initialization = phases.initializing 
      ? Math.max(0, 100 - (phases.initializing / 10))
      : 100;
    
    const loading = phases.loading 
      ? Math.max(0, 100 - (phases.loading / 20))
      : 100;
    
    const rendering = phases.configuring 
      ? Math.max(0, 100 - (phases.configuring / 15))
      : 100;
    
    // 确定等级
    let grade: PerformanceScore['grade'] = 'F';
    if (overall >= 90) grade = 'A';
    else if (overall >= 80) grade = 'B';
    else if (overall >= 70) grade = 'C';
    else if (overall >= 60) grade = 'D';
    
    return {
      overall: Math.round(overall),
      initialization: Math.round(initialization),
      loading: Math.round(loading),
      rendering: Math.round(rendering),
      grade,
    };
  }, []);

  // 生成优化建议
  const generateRecommendations = useCallback((
    metrics: StartupMetrics,
    score: PerformanceScore
  ): OptimizationRecommendation[] => {
    const recs: OptimizationRecommendation[] = [];
    
    // 基于总体性能生成建议
    if (score.overall < 70) {
      recs.push({
        id: 'overall-performance',
        title: '启动性能需要优化',
        description: '应用启动时间超过推荐值，建议检查关键路径上的性能瓶颈',
        impact: 'high',
        effort: 'moderate',
        category: 'performance',
      });
    }
    
    // 基于初始化时间生成建议
    if (metrics.phases.initializing && metrics.phases.initializing > 500) {
      recs.push({
        id: 'initialization-optimization',
        title: '优化初始化过程',
        description: '初始化阶段耗时较长，考虑延迟非关键服务的初始化',
        impact: 'high',
        effort: 'easy',
        category: 'initialization',
      });
    }
    
    // 基于加载时间生成建议
    if (metrics.phases.loading && metrics.phases.loading > 1000) {
      recs.push({
        id: 'resource-loading',
        title: '优化资源加载',
        description: '资源加载时间较长，可以预加载关键资源或使用CDN',
        impact: 'medium',
        effort: 'moderate',
        category: 'loading',
      });
    }
    
    // 基于配置时间生成建议
    if (metrics.phases.configuring && metrics.phases.configuring > 800) {
      recs.push({
        id: 'configuration-optimization',
        title: '优化配置过程',
        description: '配置阶段可以并行化或缓存配置结果',
        impact: 'medium',
        effort: 'easy',
        category: 'configuration',
      });
    }
    
    // 内存使用建议
    if (metrics.memoryUsage && metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
      recs.push({
        id: 'memory-optimization',
        title: '优化内存使用',
        description: '启动过程中内存使用较高，检查是否有内存泄漏或不必要的资源加载',
        impact: 'medium',
        effort: 'complex',
        category: 'memory',
      });
    }
    
    // CPU使用建议
    if (metrics.cpuUsage && metrics.cpuUsage > 80) {
      recs.push({
        id: 'cpu-optimization',
        title: '优化CPU使用',
        description: 'CPU使用率较高，考虑使用Web Workers分担计算任务',
        impact: 'medium',
        effort: 'complex',
        category: 'cpu',
      });
    }
    
    return recs;
  }, []);

  // 格式化时间
  const formatTime = useCallback((ms: number): string => {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }, []);

  // 格式化内存大小
  const formatMemory = useCallback((bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }, []);

  // 获取评分颜色
  const getScoreColor = useCallback((score: number): string => {
    if (score >= 90) return 'var(--success-color, #48bb78)';
    if (score >= 80) return 'var(--success-color, #68d391)';
    if (score >= 70) return 'var(--warning-color, #ed8936)';
    if (score >= 60) return 'var(--warning-color, #f6ad55)';
    return 'var(--error-color, #f56565)';
  }, []);

  // 更新指标
  useEffect(() => {
    if (isStartupComplete()) {
      updateMetrics();
    }
  }, [isStartupComplete, updateMetrics]);

  // 实时更新
  useEffect(() => {
    if (!showRealTime) return;
    
    const interval = setInterval(() => {
      if (!isStartupComplete()) {
        updateMetrics();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [showRealTime, isStartupComplete, updateMetrics]);

  // 如果没有指标数据，不渲染
  if (!metrics) {
    return null;
  }

  return (
    <div className={`startup-monitor ${isExpanded ? 'expanded' : ''}`}>
      <div className="monitor-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="monitor-title">
          <span className="monitor-icon">📊</span>
          <span>启动性能监控</span>
          {performanceScore && (
            <span 
              className="performance-badge"
              style={{ backgroundColor: getScoreColor(performanceScore.overall) }}
            >
              {performanceScore.grade}
            </span>
          )}
        </div>
        <div className="monitor-toggle">
          <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="monitor-content">
          <div className="monitor-tabs">
            <button
              className={`tab-button ${selectedTab === 'overview' ? 'active' : ''}`}
              onClick={() => setSelectedTab('overview')}
            >
              概览
            </button>
            <button
              className={`tab-button ${selectedTab === 'details' ? 'active' : ''}`}
              onClick={() => setSelectedTab('details')}
            >
              详细信息
            </button>
            {showRecommendations && (
              <button
                className={`tab-button ${selectedTab === 'recommendations' ? 'active' : ''}`}
                onClick={() => setSelectedTab('recommendations')}
              >
                优化建议
                {recommendations.length > 0 && (
                  <span className="recommendation-count">{recommendations.length}</span>
                )}
              </button>
            )}
          </div>

          <div className="monitor-body">
            {selectedTab === 'overview' && (
              <div className="overview-tab">
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">总启动时间</div>
                    <div className="metric-value primary">
                      {formatTime(metrics.totalDuration)}
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-label">初始化时间</div>
                    <div className="metric-value">
                      {formatTime(metrics.phases.initializing || 0)}
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-label">加载时间</div>
                    <div className="metric-value">
                      {formatTime(metrics.phases.loading || 0)}
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-label">配置时间</div>
                    <div className="metric-value">
                      {formatTime(metrics.phases.configuring || 0)}
                    </div>
                  </div>
                </div>

                {performanceScore && (
                  <div className="performance-scores">
                    <h4>性能评分</h4>
                    <div className="scores-grid">
                      <div className="score-item">
                        <div className="score-label">总体评分</div>
                        <div 
                          className="score-value"
                          style={{ color: getScoreColor(performanceScore.overall) }}
                        >
                          {performanceScore.overall}
                        </div>
                      </div>
                      <div className="score-item">
                        <div className="score-label">初始化</div>
                        <div 
                          className="score-value"
                          style={{ color: getScoreColor(performanceScore.initialization) }}
                        >
                          {performanceScore.initialization}
                        </div>
                      </div>
                      <div className="score-item">
                        <div className="score-label">加载</div>
                        <div 
                          className="score-value"
                          style={{ color: getScoreColor(performanceScore.loading) }}
                        >
                          {performanceScore.loading}
                        </div>
                      </div>
                      <div className="score-item">
                        <div className="score-label">渲染</div>
                        <div 
                          className="score-value"
                          style={{ color: getScoreColor(performanceScore.rendering) }}
                        >
                          {performanceScore.rendering}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedTab === 'details' && (
              <div className="details-tab">
                <div className="details-section">
                  <h4>系统资源使用</h4>
                  <div className="resource-metrics">
                    {metrics.memoryUsage && (
                      <div className="resource-item">
                        <span className="resource-label">内存使用</span>
                        <span className="resource-value">
                          {formatMemory(metrics.memoryUsage)}
                        </span>
                      </div>
                    )}
                    {metrics.cpuUsage && (
                      <div className="resource-item">
                        <span className="resource-label">CPU使用率</span>
                        <span className="resource-value">
                          {metrics.cpuUsage.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="details-section">
                  <h4>阶段详情</h4>
                  <div className="phase-details">
                    {Object.entries(metrics.phases).map(([phase, duration]) => (
                      <div key={phase} className="phase-item">
                        <div className="phase-info">
                          <span className="phase-name">{phase}</span>
                          <span className="phase-duration">{formatTime(duration)}</span>
                        </div>
                        <div className="phase-bar">
                          <div 
                            className="phase-fill"
                            style={{ 
                              width: `${(duration / metrics.totalDuration) * 100}%`,
                              backgroundColor: getScoreColor(
                                Math.max(0, 100 - (duration / (metrics.totalDuration * 0.1)))
                              )
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'recommendations' && showRecommendations && (
              <div className="recommendations-tab">
                {recommendations.length === 0 ? (
                  <div className="no-recommendations">
                    <div className="no-recommendations-icon">✨</div>
                    <p>启动性能良好，暂无优化建议！</p>
                  </div>
                ) : (
                  <div className="recommendations-list">
                    {recommendations.map((rec) => (
                      <div key={rec.id} className={`recommendation-item ${rec.impact}`}>
                        <div className="recommendation-header">
                          <h5 className="recommendation-title">{rec.title}</h5>
                          <div className="recommendation-meta">
                            <span className={`impact-badge ${rec.impact}`}>
                              {rec.impact === 'high' ? '高影响' : 
                               rec.impact === 'medium' ? '中影响' : '低影响'}
                            </span>
                            <span className={`effort-badge ${rec.effort}`}>
                              {rec.effort === 'easy' ? '容易' : 
                               rec.effort === 'moderate' ? '中等' : '复杂'}
                            </span>
                          </div>
                        </div>
                        <p className="recommendation-description">
                          {rec.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 简化版监控组件
 */
export const SimpleStartupMonitor: React.FC = () => {
  return (
    <StartupMonitor
      showRealTime={false}
      showCharts={false}
      showRecommendations={false}
    />
  );
};

export default StartupMonitor;
