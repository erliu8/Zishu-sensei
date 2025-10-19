/**
 * 性能监控集成 Hook
 * 
 * 提供统一的性能监控集成功能
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  performanceIntegration, 
  PerformanceIntegrationService, 
  IntegrationConfig, 
  DEFAULT_INTEGRATION_CONFIG 
} from '../services/performanceIntegration';

export interface PerformanceIntegrationHookReturn {
  // 状态
  isActive: boolean;
  config: IntegrationConfig;
  uptime: number;
  loading: boolean;
  error: string | null;
  
  // 方法
  start: (config?: Partial<IntegrationConfig>) => Promise<void>;
  stop: () => Promise<void>;
  syncNow: () => Promise<void>;
  updateConfig: (config: Partial<IntegrationConfig>) => Promise<void>;
  
  // 操作记录方法
  recordUserOperation: (
    type: string,
    target: string,
    duration: number,
    success?: boolean,
    error?: string,
    metadata?: any
  ) => Promise<void>;
  
  recordNetworkRequest: (
    url: string,
    method: string,
    statusCode?: number,
    timing?: any,
    requestSize?: number,
    responseSize?: number,
    errorType?: string,
    errorMessage?: string
  ) => Promise<void>;
  
  // 事件监听
  onAlert: ((alert: any) => void) | null;
  onDataSync: ((data: any) => void) | null;
  onError: ((error: any) => void) | null;
}

/**
 * 性能监控集成 Hook
 */
export function usePerformanceIntegration(
  autoStart: boolean = false,
  initialConfig?: Partial<IntegrationConfig>
): PerformanceIntegrationHookReturn {
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<IntegrationConfig>({
    ...DEFAULT_INTEGRATION_CONFIG,
    ...initialConfig,
  });
  const [uptime, setUptime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uptimeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const alertCallbackRef = useRef<((alert: any) => void) | null>(null);
  const dataSyncCallbackRef = useRef<((data: any) => void) | null>(null);
  const errorCallbackRef = useRef<((error: any) => void) | null>(null);

  // 更新运行时间
  const updateUptime = useCallback(() => {
    if (isActive) {
      const status = performanceIntegration.getIntegrationStatus();
      setUptime(status.uptime);
    }
  }, [isActive]);

  // 启动集成监控
  const start = useCallback(async (startConfig?: Partial<IntegrationConfig>) => {
    setLoading(true);
    setError(null);

    try {
      const finalConfig = startConfig ? { ...config, ...startConfig } : config;
      await performanceIntegration.startIntegration(finalConfig);
      
      const status = performanceIntegration.getIntegrationStatus();
      setIsActive(status.active);
      setConfig(status.config);
      
      // 开始更新运行时间
      if (uptimeTimerRef.current) {
        clearInterval(uptimeTimerRef.current);
      }
      uptimeTimerRef.current = setInterval(updateUptime, 1000);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : '启动集成监控失败';
      setError(message);
      console.error('启动集成监控失败:', err);
    } finally {
      setLoading(false);
    }
  }, [config, updateUptime]);

  // 停止集成监控
  const stop = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await performanceIntegration.stopIntegration();
      setIsActive(false);
      setUptime(0);
      
      // 停止运行时间更新
      if (uptimeTimerRef.current) {
        clearInterval(uptimeTimerRef.current);
        uptimeTimerRef.current = null;
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : '停止集成监控失败';
      setError(message);
      console.error('停止集成监控失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 立即同步数据
  const syncNow = useCallback(async () => {
    setError(null);
    try {
      await performanceIntegration.syncNow();
    } catch (err) {
      const message = err instanceof Error ? err.message : '数据同步失败';
      setError(message);
      console.error('数据同步失败:', err);
    }
  }, []);

  // 更新配置
  const updateConfig = useCallback(async (newConfig: Partial<IntegrationConfig>) => {
    setLoading(true);
    setError(null);

    try {
      await performanceIntegration.updateConfig(newConfig);
      
      const status = performanceIntegration.getIntegrationStatus();
      setConfig(status.config);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新配置失败';
      setError(message);
      console.error('更新配置失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 记录用户操作
  const recordUserOperation = useCallback(async (
    type: string,
    target: string,
    duration: number,
    success: boolean = true,
    errorMessage?: string,
    metadata?: any
  ) => {
    const endTime = Date.now();
    const startTime = endTime - duration;
    
    try {
      await performanceIntegration.recordUserOperation(
        type,
        target,
        startTime,
        endTime,
        success,
        errorMessage,
        metadata
      );
    } catch (err) {
      console.error('记录用户操作失败:', err);
    }
  }, []);

  // 记录网络请求
  const recordNetworkRequest = useCallback(async (
    url: string,
    method: string,
    statusCode?: number,
    timing?: any,
    requestSize?: number,
    responseSize?: number,
    errorType?: string,
    errorMessage?: string
  ) => {
    try {
      await performanceIntegration.recordNetworkRequest(
        url,
        method,
        statusCode,
        timing,
        requestSize,
        responseSize,
        errorType,
        errorMessage
      );
    } catch (err) {
      console.error('记录网络请求失败:', err);
    }
  }, []);

  // 初始化效果
  useEffect(() => {
    // 获取初始状态
    const status = performanceIntegration.getIntegrationStatus();
    setIsActive(status.active);
    setConfig(status.config);
    if (status.active) {
      setUptime(status.uptime);
      
      // 开始运行时间更新
      uptimeTimerRef.current = setInterval(updateUptime, 1000);
    }

    // 设置事件监听器
    const handleIntegrationStarted = () => {
      setIsActive(true);
      setError(null);
    };

    const handleIntegrationStopped = () => {
      setIsActive(false);
      setUptime(0);
    };

    const handleConfigUpdated = ({ newConfig }: { newConfig: IntegrationConfig }) => {
      setConfig(newConfig);
    };

    const handlePerformanceAlert = (alert: any) => {
      if (alertCallbackRef.current) {
        alertCallbackRef.current(alert);
      }
    };

    const handleDataSyncCompleted = (data: any) => {
      if (dataSyncCallbackRef.current) {
        dataSyncCallbackRef.current(data);
      }
    };

    const handleDataSyncError = (err: any) => {
      if (errorCallbackRef.current) {
        errorCallbackRef.current(err);
      }
    };

    // 监听事件
    performanceIntegration.on('integrationStarted', handleIntegrationStarted);
    performanceIntegration.on('integrationStopped', handleIntegrationStopped);
    performanceIntegration.on('configUpdated', handleConfigUpdated);
    performanceIntegration.on('performanceAlert', handlePerformanceAlert);
    performanceIntegration.on('dataSyncCompleted', handleDataSyncCompleted);
    performanceIntegration.on('dataSyncError', handleDataSyncError);

    // 自动启动
    if (autoStart && !status.active) {
      start();
    }

    // 清理函数
    return () => {
      // 移除事件监听器
      performanceIntegration.off('integrationStarted', handleIntegrationStarted);
      performanceIntegration.off('integrationStopped', handleIntegrationStopped);
      performanceIntegration.off('configUpdated', handleConfigUpdated);
      performanceIntegration.off('performanceAlert', handlePerformanceAlert);
      performanceIntegration.off('dataSyncCompleted', handleDataSyncCompleted);
      performanceIntegration.off('dataSyncError', handleDataSyncError);

      // 清理定时器
      if (uptimeTimerRef.current) {
        clearInterval(uptimeTimerRef.current);
      }
    };
  }, [autoStart, start, updateUptime]);

  return {
    isActive,
    config,
    uptime,
    loading,
    error,
    start,
    stop,
    syncNow,
    updateConfig,
    recordUserOperation,
    recordNetworkRequest,
    onAlert: alertCallbackRef.current,
    onDataSync: dataSyncCallbackRef.current,
    onError: errorCallbackRef.current,
  };
}

/**
 * 操作追踪 Hook
 * 
 * 自动追踪组件内的用户操作
 */
export function useOperationTracker(componentName?: string) {
  const { recordUserOperation } = usePerformanceIntegration();

  // 追踪操作的包装函数
  const trackOperation = useCallback(async (
    operationType: string,
    targetElement: string,
    operation: () => Promise<void> | void,
    metadata?: any
  ) => {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;

    try {
      await operation();
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error; // 重新抛出错误
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 记录操作
      recordUserOperation(
        operationType,
        componentName ? `${componentName}.${targetElement}` : targetElement,
        duration,
        success,
        errorMessage,
        metadata
      );
    }
  }, [recordUserOperation, componentName]);

  // 快捷方法
  const trackClick = useCallback((target: string, operation: () => Promise<void> | void, metadata?: any) => {
    return trackOperation('click', target, operation, metadata);
  }, [trackOperation]);

  const trackSubmit = useCallback((target: string, operation: () => Promise<void> | void, metadata?: any) => {
    return trackOperation('submit', target, operation, metadata);
  }, [trackOperation]);

  const trackNavigation = useCallback((target: string, operation: () => Promise<void> | void, metadata?: any) => {
    return trackOperation('navigation', target, operation, metadata);
  }, [trackOperation]);

  return {
    trackOperation,
    trackClick,
    trackSubmit,
    trackNavigation,
  };
}

/**
 * 网络请求追踪 Hook
 */
export function useNetworkTracker() {
  const { recordNetworkRequest } = usePerformanceIntegration();

  // 追踪 fetch 请求
  const trackFetch = useCallback(async (
    url: string,
    options?: RequestInit,
    metadata?: any
  ): Promise<Response> => {
    const startTime = Date.now();
    const method = options?.method || 'GET';

    try {
      const response = await fetch(url, options);
      const endTime = Date.now();
      
      // 记录网络请求
      await recordNetworkRequest(
        url,
        method,
        response.status,
        {
          total_time: endTime - startTime,
          dns_time: 0,
          connect_time: 0,
          ssl_time: 0,
          send_time: 0,
          wait_time: endTime - startTime,
          receive_time: 0,
        },
        options?.body ? new Blob([options.body]).size : 0,
        0 // 响应大小需要从响应头获取
      );

      return response;
    } catch (error) {
      const endTime = Date.now();
      
      // 记录网络错误
      await recordNetworkRequest(
        url,
        method,
        0,
        {
          total_time: endTime - startTime,
          dns_time: 0,
          connect_time: 0,
          ssl_time: 0,
          send_time: 0,
          wait_time: endTime - startTime,
          receive_time: 0,
        },
        options?.body ? new Blob([options.body]).size : 0,
        0,
        'fetch_error',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }, [recordNetworkRequest]);

  return {
    trackFetch,
  };
}

/**
 * 性能指标追踪 Hook
 * 
 * 手动记录自定义性能指标
 */
export function useMetricsTracker() {
  const integration = performanceIntegration;

  const trackMetric = useCallback(async (
    name: string,
    value: number,
    unit: string,
    category: string,
    component?: string,
    metadata?: any
  ) => {
    try {
      await integration.performanceService.recordMetric(
        name,
        value,
        unit,
        category as any,
        component,
        metadata ? JSON.stringify(metadata) : undefined
      );
    } catch (error) {
      console.error('记录性能指标失败:', error);
    }
  }, [integration]);

  const trackTiming = useCallback(async (
    name: string,
    startTime: number,
    endTime: number,
    category: string = 'timing',
    component?: string,
    metadata?: any
  ) => {
    const duration = endTime - startTime;
    await trackMetric(name, duration, 'ms', category, component, metadata);
  }, [trackMetric]);

  const trackCount = useCallback(async (
    name: string,
    count: number,
    category: string = 'counter',
    component?: string,
    metadata?: any
  ) => {
    await trackMetric(name, count, 'count', category, component, metadata);
  }, [trackMetric]);

  return {
    trackMetric,
    trackTiming,
    trackCount,
  };
}
