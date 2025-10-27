/**
 * 性能监控 React Hooks
 * 
 * 提供便于React组件使用的性能监控hooks，包括：
 * - 性能指标监控
 * - 用户操作追踪
 * - 网络性能监控
 * - 实时数据订阅
 * - 配置管理
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { performanceService } from '../services/performanceService';
import {
  PerformanceMetric,
  UserOperation,
  NetworkMetric,
  PerformanceSnapshot,
  PerformanceAlert,
  MonitorConfig,
  PerformanceStats,
  UserOperationStats,
  NetworkStats,
  AlertStats,
  MonitoringStatus,
  PerformanceReport,
  TimePeriod,
  PerformanceCategory,
  UserOperationType,
  PerformanceUtils,
} from '../types/performance';

// ============================================================================
// 基础性能监控 Hook
// ============================================================================

/**
 * 性能监控状态管理 Hook
 */
export function usePerformanceMonitor() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取监控状态
  const checkStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [active, currentConfig, currentStatus] = await Promise.all([
        performanceService.isMonitoringActive(),
        performanceService.getMonitorConfig(),
        performanceService.getMonitoringStatus(),
      ]);
      
      setIsMonitoring(active);
      setConfig(currentConfig);
      setStatus(currentStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取监控状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 启动监控
  const startMonitoring = useCallback(async () => {
    try {
      await performanceService.startMonitoring();
      setIsMonitoring(true);
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动监控失败');
    }
  }, [checkStatus]);

  // 停止监控
  const stopMonitoring = useCallback(async () => {
    try {
      await performanceService.stopMonitoring();
      setIsMonitoring(false);
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止监控失败');
    }
  }, [checkStatus]);

  // 更新配置
  const updateConfig = useCallback(async (newConfig: MonitorConfig) => {
    try {
      await performanceService.updateMonitorConfig(newConfig);
      setConfig(newConfig);
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配置失败');
    }
  }, [checkStatus]);

  // 清理数据
  const cleanupData = useCallback(async (days: number) => {
    try {
      const deleted = await performanceService.cleanupOldData(days);
      await checkStatus();
      return deleted;
    } catch (err) {
      setError(err instanceof Error ? err.message : '清理数据失败');
      return 0;
    }
  }, [checkStatus]);

  useEffect(() => {
    checkStatus();

    // 监听事件
    const handleMonitoringStarted = () => {
      setIsMonitoring(true);
      checkStatus();
    };

    const handleMonitoringStopped = () => {
      setIsMonitoring(false);
      checkStatus();
    };

    const handleConfigUpdated = (newConfig: MonitorConfig) => {
      setConfig(newConfig);
    };

    performanceService.on('monitoring_started', handleMonitoringStarted);
    performanceService.on('monitoring_stopped', handleMonitoringStopped);
    performanceService.on('config_updated', handleConfigUpdated);

    return () => {
      performanceService.off('monitoring_started', handleMonitoringStarted);
      performanceService.off('monitoring_stopped', handleMonitoringStopped);
      performanceService.off('config_updated', handleConfigUpdated);
    };
  }, [checkStatus]);

  return {
    isMonitoring,
    config,
    status,
    loading,
    error,
    startMonitoring,
    stopMonitoring,
    updateConfig,
    cleanupData,
    refresh: checkStatus,
  };
}

// ============================================================================
// 性能指标 Hooks
// ============================================================================

/**
 * 性能指标数据 Hook
 */
export function usePerformanceMetrics(
  category?: PerformanceCategory,
  timePeriod: TimePeriod = '1h',
  autoRefresh = true,
  refreshInterval = 30000
) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const endTime = Date.now();
      const startTime = endTime - PerformanceUtils.timePeriodToMs(timePeriod);

      const [metricsData, statsData] = await Promise.all([
        performanceService.getMetrics(category, startTime, endTime, 100),
        category ? performanceService.getPerformanceSummary(category, timePeriod) : null,
      ]);

      setMetrics(metricsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取性能指标失败');
    } finally {
      setLoading(false);
    }
  }, [category, timePeriod]);

  // 记录新指标
  const recordMetric = useCallback(async (
    metricName: string,
    metricValue: number,
    unit: string,
    metricCategory: PerformanceCategory,
    component?: string,
    metadata?: Record<string, any>
  ) => {
    try {
      await performanceService.recordMetric(
        metricName,
        metricValue,
        unit,
        metricCategory,
        component,
        metadata
      );
      // 如果匹配当前过滤条件，刷新数据
      if (!category || category === metricCategory) {
        await fetchData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '记录性能指标失败');
    }
  }, [category, fetchData]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh, refreshInterval]);

  useEffect(() => {
    // 监听实时指标事件
    const handleMetricRecorded = (data: any) => {
      if (!category || data.category === category) {
        fetchData();
      }
    };

    performanceService.on('metric_recorded', handleMetricRecorded);
    return () => {
      performanceService.off('metric_recorded', handleMetricRecorded);
    };
  }, [category, fetchData]);

  return {
    metrics,
    stats,
    loading,
    error,
    recordMetric,
    refresh: fetchData,
  };
}

// ============================================================================
// 用户操作追踪 Hooks
// ============================================================================

/**
 * 用户操作追踪 Hook
 */
export function useUserOperationTracker(
  operationType?: UserOperationType,
  timePeriod: TimePeriod = '1d',
  autoRefresh = true
) {
  const [operations, setOperations] = useState<UserOperation[]>([]);
  const [stats, setStats] = useState<UserOperationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const endTime = Date.now();
      const startTime = endTime - PerformanceUtils.timePeriodToMs(timePeriod);

      const [operationsData, statsData] = await Promise.all([
        performanceService.getUserOperations(operationType, startTime, endTime, 50),
        performanceService.getUserOperationStats(timePeriod),
      ]);

      setOperations(operationsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取用户操作数据失败');
    } finally {
      setLoading(false);
    }
  }, [operationType, timePeriod]);

  // 记录用户操作
  const recordOperation = useCallback(async (
    type: UserOperationType,
    targetElement: string,
    startTime: number,
    endTime: number,
    success = true,
    errorMessage?: string,
    metadata?: Record<string, any>
  ) => {
    try {
      await performanceService.recordUserOperation(
        type,
        targetElement,
        startTime,
        endTime,
        success,
        errorMessage,
        metadata
      );
      
      if (!operationType || operationType === type) {
        await fetchData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '记录用户操作失败');
    }
  }, [operationType, fetchData]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  useEffect(() => {
    const handleOperationRecorded = (data: any) => {
      if (!operationType || data.operationType === operationType) {
        fetchData();
      }
    };

    performanceService.on('operation_recorded', handleOperationRecorded);
    return () => {
      performanceService.off('operation_recorded', handleOperationRecorded);
    };
  }, [operationType, fetchData]);

  return {
    operations,
    stats,
    loading,
    error,
    recordOperation,
    refresh: fetchData,
  };
}

// ============================================================================
// 网络性能监控 Hooks
// ============================================================================

/**
 * 网络性能监控 Hook
 */
export function useNetworkPerformance(
  timePeriod: TimePeriod = '1h',
  autoRefresh = true
) {
  const [metrics, setMetrics] = useState<NetworkMetric[]>([]);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const endTime = Date.now();
      const startTime = endTime - PerformanceUtils.timePeriodToMs(timePeriod);

      const [metricsData, statsData] = await Promise.all([
        performanceService.getNetworkMetrics(startTime, endTime, 50),
        performanceService.getNetworkStats(timePeriod),
      ]);

      setMetrics(metricsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取网络性能数据失败');
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  useEffect(() => {
    const handleNetworkRecorded = () => {
      fetchData();
    };

    performanceService.on('network_recorded', handleNetworkRecorded);
    return () => {
      performanceService.off('network_recorded', handleNetworkRecorded);
    };
  }, [fetchData]);

  return {
    metrics,
    stats,
    loading,
    error,
    refresh: fetchData,
  };
}

// ============================================================================
// 性能快照 Hook
// ============================================================================

/**
 * 性能快照 Hook
 */
export function usePerformanceSnapshots(
  timePeriod: TimePeriod = '1h',
  autoRefresh = true
) {
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const endTime = Date.now();
      const startTime = endTime - PerformanceUtils.timePeriodToMs(timePeriod);

      const snapshotsData = await performanceService.getPerformanceSnapshots(
        startTime,
        endTime,
        100
      );

      setSnapshots(snapshotsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取性能快照失败');
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  const recordSnapshot = useCallback(async (
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
    appState = 'active',
    loadAverage?: string
  ) => {
    try {
      await performanceService.recordSnapshot(
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
        loadAverage
      );
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '记录性能快照失败');
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  useEffect(() => {
    const handleSnapshotRecorded = () => {
      fetchData();
    };

    performanceService.on('snapshot_recorded', handleSnapshotRecorded);
    return () => {
      performanceService.off('snapshot_recorded', handleSnapshotRecorded);
    };
  }, [fetchData]);

  return {
    snapshots,
    loading,
    error,
    recordSnapshot,
    refresh: fetchData,
  };
}

// ============================================================================
// 性能警告 Hook
// ============================================================================

/**
 * 性能警告管理 Hook
 */
export function usePerformanceAlerts(
  showResolved = false,
  timePeriod: TimePeriod = '1d',
  autoRefresh = true
) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const endTime = Date.now();
      const startTime = endTime - PerformanceUtils.timePeriodToMs(timePeriod);

      const [alertsData, statsData] = await Promise.all([
        performanceService.getPerformanceAlerts(showResolved ? undefined : false, startTime, endTime, 50),
        performanceService.getAlertStats(timePeriod),
      ]);

      setAlerts(alertsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取性能警告失败');
    } finally {
      setLoading(false);
    }
  }, [showResolved, timePeriod]);

  const resolveAlert = useCallback(async (alertId: number) => {
    try {
      await performanceService.resolveAlert(alertId);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '解决警告失败');
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  useEffect(() => {
    const handleNewAlerts = () => {
      fetchData();
    };

    const handleAlertResolved = () => {
      fetchData();
    };

    performanceService.on('new_alerts', handleNewAlerts);
    performanceService.on('alert_resolved', handleAlertResolved);

    return () => {
      performanceService.off('new_alerts', handleNewAlerts);
      performanceService.off('alert_resolved', handleAlertResolved);
    };
  }, [fetchData]);

  return {
    alerts,
    stats,
    loading,
    error,
    resolveAlert,
    refresh: fetchData,
  };
}

// ============================================================================
// 实时数据 Hook
// ============================================================================

/**
 * 实时性能数据 Hook
 */
export function useRealTimePerformance(refreshInterval = 5000) {
  const [data, setData] = useState<MonitoringStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRealTimeData = (status: MonitoringStatus) => {
      setData(status);
      setConnected(true);
      setError(null);
    };

    const handleConnectionError = (err: any) => {
      setConnected(false);
      setError(err instanceof Error ? err.message : '连接错误');
    };

    // 开始实时监控
    performanceService.startRealTimeMonitoring(refreshInterval);
    performanceService.on('real_time_data', handleRealTimeData);
    performanceService.on('error', handleConnectionError);

    return () => {
      performanceService.stopRealTimeMonitoring();
      performanceService.off('real_time_data', handleRealTimeData);
      performanceService.off('error', handleConnectionError);
    };
  }, [refreshInterval]);

  return {
    data,
    connected,
    error,
  };
}

// ============================================================================
// 性能报告 Hook
// ============================================================================

/**
 * 性能报告生成 Hook
 */
export function usePerformanceReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async (
    timePeriod: TimePeriod,
    includeDetails = false
  ): Promise<PerformanceReport | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const report = await performanceService.generateReport(timePeriod, includeDetails);
      return report;
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成性能报告失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generateReport,
    loading,
    error,
  };
}

// ============================================================================
// 操作追踪装饰器 Hook
// ============================================================================

/**
 * 用户操作自动追踪 Hook
 */
export function useOperationTracker() {
  const startTimeRef = useRef<number>(0);

  const startTracking = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  const endTracking = useCallback(async (
    operationType: UserOperationType,
    targetElement: string,
    success = true,
    errorMessage?: string
  ) => {
    const endTime = Date.now();
    const startTime = startTimeRef.current || endTime;

    await performanceService.recordUserOperation(
      operationType,
      targetElement,
      startTime,
      endTime,
      success,
      errorMessage
    );
  }, []);

  const trackOperation = useCallback(async <T>(
    operationType: UserOperationType,
    targetElement: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const endTime = Date.now();
      
      await performanceService.recordUserOperation(
        operationType,
        targetElement,
        startTime,
        endTime,
        true
      );
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      
      await performanceService.recordUserOperation(
        operationType,
        targetElement,
        startTime,
        endTime,
        false,
        error instanceof Error ? error.message : '操作失败'
      );
      
      throw error;
    }
  }, []);

  return {
    startTracking,
    endTracking,
    trackOperation,
  };
}

// ============================================================================
// 便利方法 Hook
// ============================================================================

/**
 * 性能监控便利方法 Hook
 */
export function usePerformanceUtils() {
  const recordPageLoad = useCallback(async (
    pageName: string,
    loadTime: number,
    renderTime: number,
    interactiveTime: number
  ) => {
    await performanceService.recordPageMetrics(
      pageName,
      loadTime,
      renderTime,
      interactiveTime
    );
  }, []);

  const recordApiCall = useCallback(async (
    url: string,
    method: string,
    startTime: number,
    endTime: number,
    statusCode?: number,
    errorMessage?: string
  ) => {
    await performanceService.recordApiCall(
      url,
      method,
      startTime,
      endTime,
      statusCode,
      errorMessage
    );
  }, []);

  const recordUserClick = useCallback(async (
    elementId: string,
    startTime: number,
    endTime: number,
    success = true
  ) => {
    await performanceService.recordUserClick(
      elementId,
      startTime,
      endTime,
      success
    );
  }, []);

  return {
    recordPageLoad,
    recordApiCall,
    recordUserClick,
  };
}

export default {
  usePerformanceMonitor,
  usePerformanceMetrics,
  useUserOperationTracker,
  useNetworkPerformance,
  usePerformanceSnapshots,
  usePerformanceAlerts,
  useRealTimePerformance,
  usePerformanceReport,
  useOperationTracker,
  usePerformanceUtils,
};
