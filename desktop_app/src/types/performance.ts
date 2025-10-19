/**
 * 性能监控类型定义
 * 
 * 定义性能监控系统的所有类型，包括：
 * - 性能指标记录
 * - 用户操作追踪
 * - 网络性能监控
 * - 应用性能快照
 * - 性能警告管理
 * - 性能统计分析
 */

// ============================================================================
// 基础性能数据类型
// ============================================================================

/**
 * 性能指标记录
 */
export interface PerformanceMetric {
  id?: number;
  metricName: string;
  metricValue: number;
  unit: string;
  category: PerformanceCategory;
  component?: string;
  timestamp: number;
  metadata: string;
}

/**
 * 性能类别
 */
export type PerformanceCategory = 
  | 'cpu' 
  | 'memory' 
  | 'network' 
  | 'render' 
  | 'user' 
  | 'io' 
  | 'gpu' 
  | 'system';

/**
 * 用户操作记录
 */
export interface UserOperation {
  id?: number;
  operationType: UserOperationType;
  targetElement: string;
  startTime: number;
  endTime: number;
  responseTime: number;
  success: boolean;
  errorMessage?: string;
  metadata: string;
}

/**
 * 用户操作类型
 */
export type UserOperationType = 
  | 'click' 
  | 'scroll' 
  | 'input' 
  | 'navigation' 
  | 'drag' 
  | 'hover' 
  | 'keyboard' 
  | 'touch' 
  | 'resize' 
  | 'focus';

/**
 * 网络请求时间细分
 */
export interface NetworkTiming {
  dnsTime?: number;
  connectTime?: number;
  sslTime?: number;
  sendTime?: number;
  waitTime?: number;
  receiveTime?: number;
}

/**
 * 网络请求性能记录
 */
export interface NetworkMetric {
  id?: number;
  url: string;
  method: string;
  statusCode?: number;
  requestSize?: number;
  responseSize?: number;
  dnsTime?: number;
  connectTime?: number;
  sslTime?: number;
  sendTime?: number;
  waitTime?: number;
  receiveTime?: number;
  totalTime: number;
  timestamp: number;
  errorType?: string;
  errorMessage?: string;
}

/**
 * 应用性能快照
 */
export interface PerformanceSnapshot {
  id?: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  fps: number;
  renderTime: number;
  activeConnections: number;
  openFiles: number;
  threadCount: number;
  heapSize?: number;
  gcTime?: number;
  timestamp: number;
  appState: AppState;
  loadAverage?: string;
}

/**
 * 应用状态
 */
export type AppState = 'active' | 'idle' | 'background' | 'minimized' | 'focused' | 'blur';

/**
 * 性能统计汇总
 */
export interface PerformanceStats {
  id?: number;
  metricCategory: string;
  timePeriod: TimePeriod;
  avgValue: number;
  minValue: number;
  maxValue: number;
  count: number;
  p95Value: number;
  p99Value: number;
  createdAt: number;
}

/**
 * 时间周期
 */
export type TimePeriod = '1h' | '1d' | '1w' | '1m' | '3m' | '6m' | '1y';

/**
 * 性能警告记录
 */
export interface PerformanceAlert {
  id?: number;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  threshold: number;
  actualValue: number;
  component?: string;
  duration: number;
  resolved: boolean;
  resolvedAt?: number;
  timestamp: number;
  metadata: string;
}

/**
 * 警告类型
 */
export type AlertType = 
  | 'high_cpu' 
  | 'high_memory' 
  | 'low_fps' 
  | 'slow_response' 
  | 'slow_network' 
  | 'memory_leak' 
  | 'high_render_time' 
  | 'high_gc_time' 
  | 'too_many_connections' 
  | 'disk_full';

/**
 * 警告严重程度
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// 监控配置类型
// ============================================================================

/**
 * 监控配置
 */
export interface MonitorConfig {
  enabled: boolean;
  metricsInterval: number;
  snapshotInterval: number;
  retentionDays: number;
  thresholds: PerformanceThresholds;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  cpuUsageWarning: number;
  cpuUsageCritical: number;
  memoryUsageWarning: number;
  memoryUsageCritical: number;
  fpsWarning: number;
  fpsCritical: number;
  renderTimeWarning: number;
  renderTimeCritical: number;
  responseTimeWarning: number;
  responseTimeCritical: number;
  networkTimeoutWarning: number;
  networkTimeoutCritical: number;
}

// ============================================================================
// 统计和分析类型
// ============================================================================

/**
 * 用户操作统计
 */
export interface UserOperationStats {
  totalOperations: number;
  successRate: number;
  avgResponseTime: number;
  operationTypes: Record<string, number>;
  slowOperations: number;
  errorCount: number;
}

/**
 * 网络性能统计
 */
export interface NetworkStats {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  httpMethods: Record<string, number>;
  statusCodes: Record<number, number>;
  slowRequests: number;
  errorCount: number;
}

/**
 * 警告统计
 */
export interface AlertStats {
  totalAlerts: number;
  unresolvedAlerts: number;
  severityDistribution: Record<AlertSeverity, number>;
  typeDistribution: Record<AlertType, number>;
  avgResolutionTime: number;
}

/**
 * 监控状态信息
 */
export interface MonitoringStatus {
  isMonitoring: boolean;
  config: MonitorConfig;
  cachedMetricsCount: number;
  recentMetrics: Record<string, RecentMetricInfo>;
  uptime: number;
  lastSnapshot?: PerformanceSnapshot;
}

/**
 * 最近指标信息
 */
export interface RecentMetricInfo {
  count: number;
  average: number;
  min: number;
  max: number;
  latest: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  reportTime: number;
  timePeriod: TimePeriod;
  startTime: number;
  metricsSummary: Record<string, PerformanceStats>;
  alertSummary: AlertStats;
  snapshots?: PerformanceSnapshot[];
  userOperations?: UserOperation[];
  networkMetrics?: NetworkMetric[];
  recommendations: PerformanceRecommendation[];
}

/**
 * 性能建议
 */
export interface PerformanceRecommendation {
  category: PerformanceCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'medium' | 'hard';
}

// ============================================================================
// 实时监控类型
// ============================================================================

/**
 * 实时性能数据
 */
export interface RealTimePerformanceData {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  fps: number;
  renderTime: number;
  networkActivity: number;
  activeOperations: number;
  alerts: PerformanceAlert[];
}

/**
 * 性能趋势数据
 */
export interface PerformanceTrend {
  category: PerformanceCategory;
  timePeriod: TimePeriod;
  dataPoints: PerformanceTrendPoint[];
  trend: 'improving' | 'declining' | 'stable';
  changePercent: number;
}

/**
 * 性能趋势数据点
 */
export interface PerformanceTrendPoint {
  timestamp: number;
  value: number;
  label?: string;
}

/**
 * 性能对比数据
 */
export interface PerformanceComparison {
  baseline: PerformanceStats;
  current: PerformanceStats;
  improvement: number;
  degradation: number;
  significantChanges: PerformanceChange[];
}

/**
 * 性能变化
 */
export interface PerformanceChange {
  metric: string;
  category: PerformanceCategory;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  significance: 'minor' | 'moderate' | 'major';
}

// ============================================================================
// UI相关类型
// ============================================================================

/**
 * 性能图表配置
 */
export interface PerformanceChartConfig {
  type: 'line' | 'area' | 'bar' | 'scatter' | 'heatmap';
  title: string;
  categories: PerformanceCategory[];
  timePeriod: TimePeriod;
  refreshInterval: number;
  showThresholds: boolean;
  showAlerts: boolean;
}

/**
 * 性能面板配置
 */
export interface PerformancePanelConfig {
  layout: 'grid' | 'tabs' | 'accordion';
  sections: PerformancePanelSection[];
  autoRefresh: boolean;
  refreshInterval: number;
}

/**
 * 性能面板区块
 */
export interface PerformancePanelSection {
  id: string;
  title: string;
  type: 'metrics' | 'chart' | 'alerts' | 'stats' | 'operations';
  config: Record<string, any>;
  visible: boolean;
  order: number;
}

/**
 * 性能过滤器
 */
export interface PerformanceFilter {
  categories?: PerformanceCategory[];
  timePeriod?: TimePeriod;
  startTime?: number;
  endTime?: number;
  severity?: AlertSeverity[];
  components?: string[];
  operationTypes?: UserOperationType[];
  success?: boolean;
}

/**
 * 性能搜索选项
 */
export interface PerformanceSearchOptions {
  query?: string;
  filter: PerformanceFilter;
  sortBy: 'timestamp' | 'value' | 'category' | 'severity';
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

// ============================================================================
// 工具函数类型
// ============================================================================

/**
 * 性能计算选项
 */
export interface PerformanceCalculationOptions {
  includeOutliers: boolean;
  smoothingFactor: number;
  aggregationMethod: 'avg' | 'median' | 'p95' | 'p99';
}

/**
 * 性能导出选项
 */
export interface PerformanceExportOptions {
  format: 'json' | 'csv' | 'excel' | 'pdf';
  categories: PerformanceCategory[];
  timePeriod: TimePeriod;
  includeCharts: boolean;
  includeDetails: boolean;
}

/**
 * 性能导入选项
 */
export interface PerformanceImportOptions {
  source: 'file' | 'url' | 'database';
  format: 'json' | 'csv' | 'excel';
  mergeStrategy: 'replace' | 'merge' | 'append';
  validation: boolean;
}

// ============================================================================
// API响应类型
// ============================================================================

/**
 * API响应包装器
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 性能工具函数
 */
export class PerformanceUtils {
  /**
   * 格式化性能值
   */
  static formatValue(value: number, unit: string): string {
    switch (unit) {
      case 'ms':
        return `${value.toFixed(1)}ms`;
      case '%':
        return `${value.toFixed(1)}%`;
      case 'MB':
        return `${(value / 1024 / 1024).toFixed(1)}MB`;
      case 'KB':
        return `${(value / 1024).toFixed(1)}KB`;
      case 'fps':
        return `${Math.round(value)} FPS`;
      default:
        return value.toFixed(2);
    }
  }

  /**
   * 计算性能等级
   */
  static calculatePerformanceGrade(
    value: number, 
    thresholds: { good: number; warning: number; critical: number }
  ): 'excellent' | 'good' | 'warning' | 'critical' {
    if (value <= thresholds.good) return 'excellent';
    if (value <= thresholds.warning) return 'good';
    if (value <= thresholds.critical) return 'warning';
    return 'critical';
  }

  /**
   * 计算趋势
   */
  static calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-Math.min(10, values.length));
    const first = recent.slice(0, Math.ceil(recent.length / 2));
    const second = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;
    
    const threshold = Math.abs(firstAvg) * 0.05; // 5% threshold
    
    if (secondAvg - firstAvg > threshold) return 'increasing';
    if (firstAvg - secondAvg > threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * 转换时间周期为毫秒
   */
  static timePeriodToMs(period: TimePeriod): number {
    const periods = {
      '1h': 3600 * 1000,
      '1d': 24 * 3600 * 1000,
      '1w': 7 * 24 * 3600 * 1000,
      '1m': 30 * 24 * 3600 * 1000,
      '3m': 90 * 24 * 3600 * 1000,
      '6m': 180 * 24 * 3600 * 1000,
      '1y': 365 * 24 * 3600 * 1000,
    };
    return periods[period];
  }

  /**
   * 生成性能ID
   */
  static generatePerformanceId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 验证性能阈值
   */
  static validateThresholds(thresholds: PerformanceThresholds): boolean {
    return (
      thresholds.cpuUsageWarning < thresholds.cpuUsageCritical &&
      thresholds.memoryUsageWarning < thresholds.memoryUsageCritical &&
      thresholds.fpsWarning > thresholds.fpsCritical &&
      thresholds.renderTimeWarning < thresholds.renderTimeCritical &&
      thresholds.responseTimeWarning < thresholds.responseTimeCritical &&
      thresholds.networkTimeoutWarning < thresholds.networkTimeoutCritical
    );
  }

  /**
   * 创建默认配置
   */
  static createDefaultConfig(): MonitorConfig {
    return {
      enabled: true,
      metricsInterval: 5000,
      snapshotInterval: 30000,
      retentionDays: 30,
      thresholds: {
        cpuUsageWarning: 70,
        cpuUsageCritical: 90,
        memoryUsageWarning: 80,
        memoryUsageCritical: 95,
        fpsWarning: 30,
        fpsCritical: 15,
        renderTimeWarning: 16,
        renderTimeCritical: 33,
        responseTimeWarning: 500,
        responseTimeCritical: 2000,
        networkTimeoutWarning: 5000,
        networkTimeoutCritical: 15000,
      },
    };
  }
}

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 性能监控常量
 */
export const PERFORMANCE_CONSTANTS = {
  // 默认刷新间隔
  DEFAULT_REFRESH_INTERVAL: 5000,
  
  // 默认数据保留时间
  DEFAULT_RETENTION_DAYS: 30,
  
  // 性能等级颜色
  PERFORMANCE_COLORS: {
    excellent: '#4CAF50',
    good: '#8BC34A',
    warning: '#FF9800',
    critical: '#F44336',
  },
  
  // 图表默认配置
  CHART_DEFAULTS: {
    height: 300,
    refreshInterval: 5000,
    maxDataPoints: 100,
  },
  
  // 警告保留时间
  ALERT_RETENTION: {
    resolved: 7 * 24 * 3600 * 1000, // 7天
    unresolved: 30 * 24 * 3600 * 1000, // 30天
  },
} as const;

/**
 * 性能类别标签
 */
export const PERFORMANCE_CATEGORY_LABELS: Record<PerformanceCategory, string> = {
  cpu: 'CPU使用率',
  memory: '内存使用',
  network: '网络性能',
  render: '渲染性能',
  user: '用户交互',
  io: '磁盘I/O',
  gpu: 'GPU使用',
  system: '系统资源',
};

/**
 * 警告严重程度标签
 */
export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

/**
 * 时间周期标签
 */
export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  '1h': '1小时',
  '1d': '1天',
  '1w': '1周',
  '1m': '1个月',
  '3m': '3个月',
  '6m': '6个月',
  '1y': '1年',
};

export default {
  PerformanceUtils,
  PERFORMANCE_CONSTANTS,
  PERFORMANCE_CATEGORY_LABELS,
  ALERT_SEVERITY_LABELS,
  TIME_PERIOD_LABELS,
};
