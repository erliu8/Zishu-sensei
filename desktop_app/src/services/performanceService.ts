/**
 * 性能监控服务
 * 
 * 提供性能监控的完整服务层，包括：
 * - 性能指标记录和查询
 * - 用户操作追踪
 * - 网络性能监控
 * - 应用性能快照
 * - 性能警告管理
 * - 实时数据流
 */

import { invoke } from '@tauri-apps/api/tauri';
import { 
  PerformanceMetric, 
  UserOperation, 
  NetworkMetric, 
  NetworkTiming,
  PerformanceSnapshot, 
  PerformanceAlert, 
  PerformanceStats,
  MonitorConfig,
  UserOperationStats,
  NetworkStats,
  AlertStats,
  MonitoringStatus,
  PerformanceReport,
  TimePeriod,
  PerformanceCategory,
  AlertSeverity,
  UserOperationType,
  ApiResponse,
  BatchOperationResult,
} from '../types/performance';
import { EventEmitter } from 'events';

/**
 * 性能监控服务类
 */
export class PerformanceService extends EventEmitter {
  private static instance: PerformanceService | null = null;
  private isMonitoring = false;
  private metricsCache = new Map<string, number[]>();
  private autoCleanupInterval: NodeJS.Timeout | null = null;

  /**
   * 获取单例实例
   */
  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  private constructor() {
    super();
    this.setupAutoCleanup();
  }

  // ============================================================================
  // 性能指标管理
  // ============================================================================

  /**
   * 记录性能指标
   */
  async recordMetric(
    metricName: string,
    metricValue: number,
    unit: string,
    category: PerformanceCategory,
    component?: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    try {
      const result = await invoke<number>('record_performance_metric', {
        metricName,
        metricValue,
        unit,
        category,
        component,
        metadata: JSON.stringify(metadata || {}),
      });

      // 更新缓存
      const cacheKey = `${category}_${metricName}`;
      const cached = this.metricsCache.get(cacheKey) || [];
      cached.push(metricValue);
      if (cached.length > 100) cached.shift();
      this.metricsCache.set(cacheKey, cached);

      // 发送实时事件
      this.emit('metric_recorded', {
        metricName,
        metricValue,
        category,
        component,
      });

      return result;
    } catch (error) {
      console.error('记录性能指标失败:', error);
      throw error;
    }
  }

  /**
   * 批量记录性能指标
   */
  async recordMetricsBatch(metrics: PerformanceMetric[]): Promise<number[]> {
    try {
      return await invoke<number[]>('record_performance_metrics_batch', {
        metrics,
      });
    } catch (error) {
      console.error('批量记录性能指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取性能指标
   */
  async getMetrics(
    category?: PerformanceCategory,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<PerformanceMetric[]> {
    try {
      return await invoke<PerformanceMetric[]>('get_performance_metrics', {
        category,
        startTime,
        endTime,
        limit,
      });
    } catch (error) {
      console.error('获取性能指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取性能指标摘要
   */
  async getPerformanceSummary(
    category: PerformanceCategory,
    timePeriod: TimePeriod
  ): Promise<PerformanceStats> {
    try {
      return await invoke<PerformanceStats>('get_performance_summary', {
        category,
        timePeriod,
      });
    } catch (error) {
      console.error('获取性能摘要失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // 用户操作追踪
  // ============================================================================

  /**
   * 记录用户操作
   */
  async recordUserOperation(
    operationType: UserOperationType,
    targetElement: string,
    startTime: number,
    endTime: number,
    success: boolean,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    try {
      const result = await invoke<number>('record_user_operation', {
        operationType,
        targetElement,
        startTime,
        endTime,
        success,
        errorMessage,
        metadata: JSON.stringify(metadata || {}),
      });

      // 发送实时事件
      this.emit('operation_recorded', {
        operationType,
        targetElement,
        responseTime: endTime - startTime,
        success,
      });

      return result;
    } catch (error) {
      console.error('记录用户操作失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户操作记录
   */
  async getUserOperations(
    operationType?: UserOperationType,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<UserOperation[]> {
    try {
      return await invoke<UserOperation[]>('get_user_operations', {
        operationType,
        startTime,
        endTime,
        limit,
      });
    } catch (error) {
      console.error('获取用户操作记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户操作统计
   */
  async getUserOperationStats(timePeriod: TimePeriod): Promise<UserOperationStats> {
    try {
      const result = await invoke<Record<string, any>>('get_user_operation_stats', {
        timePeriod,
      });

      return {
        totalOperations: result.total_operations || 0,
        successRate: result.success_rate || 0,
        avgResponseTime: result.avg_response_time || 0,
        operationTypes: result.operation_types || {},
        slowOperations: result.slow_operations || 0,
        errorCount: result.error_count || 0,
      };
    } catch (error) {
      console.error('获取用户操作统计失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // 网络性能监控
  // ============================================================================

  /**
   * 记录网络请求性能
   */
  async recordNetworkMetric(
    url: string,
    method: string,
    statusCode?: number,
    requestSize?: number,
    responseSize?: number,
    timing?: NetworkTiming,
    errorType?: string,
    errorMessage?: string
  ): Promise<number> {
    try {
      const result = await invoke<number>('record_network_metric', {
        url,
        method,
        statusCode,
        requestSize,
        responseSize,
        timing: timing || {},
        errorType,
        errorMessage,
      });

      // 发送实时事件
      const totalTime = Object.values(timing || {}).reduce((sum, time) => sum + (time || 0), 0);
      this.emit('network_recorded', {
        url,
        method,
        totalTime,
        success: !errorType && (statusCode ? statusCode < 400 : false),
      });

      return result;
    } catch (error) {
      console.error('记录网络性能失败:', error);
      throw error;
    }
  }

  /**
   * 获取网络性能指标
   */
  async getNetworkMetrics(
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<NetworkMetric[]> {
    try {
      return await invoke<NetworkMetric[]>('get_network_metrics', {
        startTime,
        endTime,
        limit,
      });
    } catch (error) {
      console.error('获取网络性能指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取网络性能统计
   */
  async getNetworkStats(timePeriod: TimePeriod): Promise<NetworkStats> {
    try {
      const result = await invoke<Record<string, any>>('get_network_stats', {
        timePeriod,
      });

      return {
        totalRequests: result.total_requests || 0,
        successRate: result.success_rate || 0,
        avgResponseTime: result.avg_response_time || 0,
        httpMethods: result.http_methods || {},
        statusCodes: result.status_codes || {},
        slowRequests: result.slow_requests || 0,
        errorCount: result.error_count || 0,
      };
    } catch (error) {
      console.error('获取网络性能统计失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // 应用性能快照
  // ============================================================================

  /**
   * 记录性能快照
   */
  async recordSnapshot(
    cpuUsage: number,
    memoryUsage: number,
    memoryUsedMb: number,
    memoryTotalMb: number,
    fps: number,
    renderTime: number,
    activeConnections: number,
    openFiles: number,
    threadCount: number,
    heapSize?: number,
    gcTime?: number,
    appState: string = 'active',
    loadAverage?: string
  ): Promise<number> {
    try {
      const result = await invoke<number>('record_performance_snapshot', {
        cpuUsage,
        memoryUsage,
        memoryUsedMb,
        memoryTotalMb,
        fps,
        renderTime,
        activeConnections,
        openFiles,
        threadCount,
        heapSize,
        gcTime,
        appState,
        loadAverage,
      });

      // 发送实时事件
      this.emit('snapshot_recorded', {
        cpuUsage,
        memoryUsage,
        fps,
        renderTime,
      });

      return result;
    } catch (error) {
      console.error('记录性能快照失败:', error);
      throw error;
    }
  }

  /**
   * 获取性能快照
   */
  async getPerformanceSnapshots(
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<PerformanceSnapshot[]> {
    try {
      return await invoke<PerformanceSnapshot[]>('get_performance_snapshots', {
        startTime,
        endTime,
        limit,
      });
    } catch (error) {
      console.error('获取性能快照失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // 性能警告管理
  // ============================================================================

  /**
   * 获取性能警告
   */
  async getPerformanceAlerts(
    resolved?: boolean,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): Promise<PerformanceAlert[]> {
    try {
      return await invoke<PerformanceAlert[]>('get_performance_alerts', {
        resolved,
        startTime,
        endTime,
        limit,
      });
    } catch (error) {
      console.error('获取性能警告失败:', error);
      throw error;
    }
  }

  /**
   * 标记警告为已解决
   */
  async resolveAlert(alertId: number): Promise<void> {
    try {
      await invoke<void>('resolve_performance_alert', {
        alertId,
      });

      this.emit('alert_resolved', { alertId });
    } catch (error) {
      console.error('解决警告失败:', error);
      throw error;
    }
  }

  /**
   * 获取警告统计
   */
  async getAlertStats(timePeriod: TimePeriod): Promise<AlertStats> {
    try {
      const result = await invoke<Record<string, any>>('get_alert_stats', {
        timePeriod,
      });

      return {
        totalAlerts: result.total_alerts || 0,
        unresolvedAlerts: result.unresolved_alerts || 0,
        severityDistribution: result.severity_distribution || {},
        typeDistribution: result.type_distribution || {},
        avgResolutionTime: result.avg_resolution_time || 0,
      };
    } catch (error) {
      console.error('获取警告统计失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // 监控配置管理
  // ============================================================================

  /**
   * 获取监控配置
   */
  async getMonitorConfig(): Promise<MonitorConfig> {
    try {
      return await invoke<MonitorConfig>('get_monitor_config');
    } catch (error) {
      console.error('获取监控配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新监控配置
   */
  async updateMonitorConfig(config: MonitorConfig): Promise<void> {
    try {
      await invoke<void>('update_monitor_config', { config });
      this.emit('config_updated', config);
    } catch (error) {
      console.error('更新监控配置失败:', error);
      throw error;
    }
  }

  /**
   * 启动性能监控
   */
  async startMonitoring(): Promise<void> {
    try {
      await invoke<void>('start_performance_monitoring');
      this.isMonitoring = true;
      this.emit('monitoring_started');
    } catch (error) {
      console.error('启动性能监控失败:', error);
      throw error;
    }
  }

  /**
   * 停止性能监控
   */
  async stopMonitoring(): Promise<void> {
    try {
      await invoke<void>('stop_performance_monitoring');
      this.isMonitoring = false;
      this.emit('monitoring_stopped');
    } catch (error) {
      console.error('停止性能监控失败:', error);
      throw error;
    }
  }

  /**
   * 检查监控状态
   */
  async isMonitoringActive(): Promise<boolean> {
    try {
      return await invoke<boolean>('is_monitoring_active');
    } catch (error) {
      console.error('检查监控状态失败:', error);
      return false;
    }
  }

  /**
   * 获取监控状态信息
   */
  async getMonitoringStatus(): Promise<MonitoringStatus> {
    try {
      const result = await invoke<Record<string, any>>('get_monitoring_status');

      return {
        isMonitoring: result.is_monitoring || false,
        config: result.config || {},
        cachedMetricsCount: result.cached_metrics_count || 0,
        recentMetrics: result.recent_metrics || {},
        uptime: result.uptime || 0,
        lastSnapshot: result.last_snapshot,
      };
    } catch (error) {
      console.error('获取监控状态失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // 数据管理
  // ============================================================================

  /**
   * 清理旧的性能数据
   */
  async cleanupOldData(days: number): Promise<number> {
    try {
      return await invoke<number>('cleanup_performance_data', { days });
    } catch (error) {
      console.error('清理性能数据失败:', error);
      throw error;
    }
  }

  /**
   * 生成性能报告
   */
  async generateReport(
    timePeriod: TimePeriod,
    includeDetails: boolean = false
  ): Promise<PerformanceReport> {
    try {
      const result = await invoke<Record<string, any>>('generate_performance_report', {
        timePeriod,
        includeDetails,
      });

      return {
        reportTime: result.report_time || Date.now(),
        timePeriod,
        startTime: result.start_time || 0,
        metricsSummary: result.metrics_summary || {},
        alertSummary: result.alert_summary || {},
        snapshots: result.snapshots,
        userOperations: result.user_operations,
        networkMetrics: result.network_metrics,
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      console.error('生成性能报告失败:', error);
      throw error;
    }
  }

  // ============================================================================
  // 实时监控
  // ============================================================================

  /**
   * 开始实时监控
   */
  startRealTimeMonitoring(interval: number = 5000): void {
    if (this.autoCleanupInterval) {
      clearInterval(this.autoCleanupInterval);
    }

    this.autoCleanupInterval = setInterval(async () => {
      try {
        // 获取实时性能数据
        const status = await this.getMonitoringStatus();
        this.emit('real_time_data', status);

        // 检查新的警告
        const alerts = await this.getPerformanceAlerts(false, Date.now() - interval, undefined, 10);
        if (alerts.length > 0) {
          this.emit('new_alerts', alerts);
        }
      } catch (error) {
        console.error('实时监控错误:', error);
      }
    }, interval);
  }

  /**
   * 停止实时监控
   */
  stopRealTimeMonitoring(): void {
    if (this.autoCleanupInterval) {
      clearInterval(this.autoCleanupInterval);
      this.autoCleanupInterval = null;
    }
  }

  // ============================================================================
  // 便利方法
  // ============================================================================

  /**
   * 记录页面性能指标
   */
  async recordPageMetrics(
    pageName: string,
    loadTime: number,
    renderTime: number,
    interactiveTime: number
  ): Promise<void> {
    const timestamp = Date.now();
    
    await Promise.all([
      this.recordMetric(`${pageName}_load_time`, loadTime, 'ms', 'user', pageName),
      this.recordMetric(`${pageName}_render_time`, renderTime, 'ms', 'render', pageName),
      this.recordMetric(`${pageName}_interactive_time`, interactiveTime, 'ms', 'user', pageName),
    ]);
  }

  /**
   * 记录API调用性能
   */
  async recordApiCall(
    url: string,
    method: string,
    startTime: number,
    endTime: number,
    statusCode?: number,
    errorMessage?: string
  ): Promise<void> {
    const totalTime = endTime - startTime;
    
    await this.recordNetworkMetric(
      url,
      method,
      statusCode,
      undefined,
      undefined,
      { wait_time: totalTime },
      errorMessage ? 'api_error' : undefined,
      errorMessage
    );
  }

  /**
   * 记录用户点击事件
   */
  async recordUserClick(
    elementId: string,
    startTime: number,
    endTime: number,
    success: boolean = true
  ): Promise<void> {
    await this.recordUserOperation(
      'click',
      elementId,
      startTime,
      endTime,
      success
    );
  }

  /**
   * 获取缓存的指标
   */
  getCachedMetrics(category: PerformanceCategory, metricName: string): number[] {
    return this.metricsCache.get(`${category}_${metricName}`) || [];
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 设置自动清理
   */
  private setupAutoCleanup(): void {
    // 每天清理一次过期数据
    setInterval(async () => {
      try {
        const deleted = await this.cleanupOldData(30);
        if (deleted > 0) {
          console.log(`自动清理了 ${deleted} 条过期性能数据`);
        }
      } catch (error) {
        console.error('自动清理性能数据失败:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stopRealTimeMonitoring();
    this.removeAllListeners();
    PerformanceService.instance = null;
  }
}

// 导出单例实例
export const performanceService = PerformanceService.getInstance();
export default performanceService;
