/**
 * 日志管理 React Hook
 * 
 * 提供完整的日志管理功能：
 * - 日志记录和查询
 * - 配置管理
 * - 文件操作
 * - 实时更新
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  loggingService, 
  LogFilter, 
  LogSearchRequest, 
  LogSearchResponse, 
  LogStatistics, 
  LoggerConfig, 
  RemoteLogConfig, 
  LogSystemStatus, 
  LogFileInfo,
  LoggingError
} from '../services/loggingService';

// ================================
// 类型定义
// ================================

export interface UseLoggingOptions {
  /** 是否自动初始化 */
  autoInit?: boolean;
  /** 自动刷新间隔（秒） */
  refreshInterval?: number;
  /** 是否启用实时更新 */
  realtime?: boolean;
  /** 初始页面大小 */
  initialPageSize?: number;
}

export interface UseLoggingReturn {
  // 状态
  logs: LogSearchResponse | null;
  statistics: LogStatistics | null;
  systemStatus: LogSystemStatus | null;
  logFiles: LogFileInfo[];
  isLoading: boolean;
  error: string | null;
  
  // 配置
  config: LoggerConfig | null;
  remoteConfig: RemoteLogConfig | null;
  
  // 日志记录方法
  debug: (message: string, data?: any, module?: string) => Promise<void>;
  info: (message: string, data?: any, module?: string) => Promise<void>;
  warn: (message: string, data?: any, module?: string) => Promise<void>;
  writeError: (message: string, error?: Error | any, module?: string) => Promise<void>;
  fatal: (message: string, error?: Error | any, module?: string) => Promise<void>;
  
  // 查询和搜索
  searchLogs: (request: LogSearchRequest) => Promise<void>;
  refreshLogs: () => Promise<void>;
  refreshStatistics: (filter?: LogFilter) => Promise<void>;
  
  // 导出和管理
  exportLogs: (format: 'json' | 'csv' | 'txt', filter?: LogFilter, filePath?: string) => Promise<void>;
  clearLogs: (retentionDays?: number) => Promise<void>;
  uploadLogs: () => Promise<number>;
  
  // 配置管理
  updateConfig: (config: Partial<LoggerConfig>) => Promise<void>;
  updateRemoteConfig: (config: Partial<RemoteLogConfig>) => Promise<void>;
  
  // 文件管理
  getLogFiles: () => Promise<void>;
  deleteLogFile: (filePath: string) => Promise<void>;
  compressLogFiles: (filePaths: string[], outputPath: string) => Promise<string>;
  
  // 系统管理
  initializeSystem: (config?: LoggerConfig) => Promise<void>;
  refreshSystemStatus: () => Promise<void>;
  flushBuffer: () => Promise<void>;
}

// ================================
// Hook 实现
// ================================

export function useLogging(options: UseLoggingOptions = {}): UseLoggingReturn {
  const {
    autoInit = true,
    refreshInterval = 0,
    realtime = false,
    initialPageSize = 50
  } = options;
  
  // ================================
  // 状态管理
  // ================================
  
  const [logs, setLogs] = useState<LogSearchResponse | null>(null);
  const [statistics, setStatistics] = useState<LogStatistics | null>(null);
  const [systemStatus, setSystemStatus] = useState<LogSystemStatus | null>(null);
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [config, setConfig] = useState<LoggerConfig | null>(null);
  const [remoteConfig, setRemoteConfig] = useState<RemoteLogConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 引用
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSearchRequest = useRef<LogSearchRequest | null>(null);
  
  // ================================
  // 错误处理辅助函数
  // ================================
  
  const handleError = useCallback((error: any, defaultMessage: string) => {
    console.error(defaultMessage, error);
    const errorMessage = error instanceof LoggingError 
      ? error.message 
      : error instanceof Error 
        ? error.message 
        : defaultMessage;
    setError(errorMessage);
  }, []);
  
  const withErrorHandling = useCallback(<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    errorMessage: string
  ): T => {
    return (async (...args: any[]) => {
      try {
        setError(null);
        return await fn(...args);
      } catch (error) {
        handleError(error, errorMessage);
        throw error;
      }
    }) as T;
  }, [handleError]);
  
  // ================================
  // 日志记录方法
  // ================================
  
  const debug = useCallback(async (message: string, data?: any, module?: string) => {
    await loggingService.debug(message, data, module);
  }, []);
  
  const info = useCallback(async (message: string, data?: any, module?: string) => {
    await loggingService.info(message, data, module);
  }, []);
  
  const warn = useCallback(async (message: string, data?: any, module?: string) => {
    await loggingService.warn(message, data, module);
  }, []);
  
  const writeError = useCallback(async (message: string, error?: Error | any, module?: string) => {
    await loggingService.error(message, error, module);
  }, []);
  
  const fatal = useCallback(async (message: string, error?: Error | any, module?: string) => {
    await loggingService.fatal(message, error, module);
  }, []);
  
  // ================================
  // 查询和搜索
  // ================================
  
  const searchLogs = useCallback(withErrorHandling(async (request: LogSearchRequest) => {
    setIsLoading(true);
    try {
      const response = await loggingService.searchLogs(request);
      setLogs(response);
      lastSearchRequest.current = request;
    } finally {
      setIsLoading(false);
    }
  }, '搜索日志失败'), [withErrorHandling]);
  
  const refreshLogs = useCallback(async () => {
    if (lastSearchRequest.current) {
      await searchLogs(lastSearchRequest.current);
    } else {
      // 默认搜索请求
      await searchLogs({
        page: 1,
        pageSize: initialPageSize,
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });
    }
  }, [searchLogs, initialPageSize]);
  
  const refreshStatistics = useCallback(withErrorHandling(async (filter?: LogFilter) => {
    const stats = await loggingService.getLogStatistics(filter);
    setStatistics(stats);
  }, '获取统计信息失败'), [withErrorHandling]);
  
  // ================================
  // 导出和管理
  // ================================
  
  const exportLogs = useCallback(withErrorHandling(async (
    format: 'json' | 'csv' | 'txt',
    filter?: LogFilter,
    filePath?: string
  ) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = `logs-${timestamp}.${format}`;
    
    await loggingService.exportLogs({
      format,
      filter,
      filePath: filePath || defaultPath
    });
  }, '导出日志失败'), [withErrorHandling]);
  
  const clearLogs = useCallback(withErrorHandling(async (retentionDays: number = 0) => {
    await loggingService.cleanupOldLogs(retentionDays);
    await refreshLogs();
    await refreshStatistics();
  }, '清理日志失败'), [withErrorHandling, refreshLogs, refreshStatistics]);
  
  const uploadLogs = useCallback(withErrorHandling(async (): Promise<number> => {
    return await loggingService.uploadLogsToRemote();
  }, '上传日志失败'), [withErrorHandling]);
  
  // ================================
  // 配置管理
  // ================================
  
  const loadConfig = useCallback(withErrorHandling(async () => {
    const [logConfig, remoteLogConfig] = await Promise.all([
      loggingService.getLogConfig(),
      loggingService.getRemoteLogConfig()
    ]);
    setConfig(logConfig);
    setRemoteConfig(remoteLogConfig);
  }, '加载配置失败'), [withErrorHandling]);
  
  const updateConfig = useCallback(withErrorHandling(async (newConfig: Partial<LoggerConfig>) => {
    if (!config) return;
    
    const updatedConfig = { ...config, ...newConfig };
    await loggingService.updateLogConfig(updatedConfig);
    setConfig(updatedConfig);
  }, '更新配置失败'), [withErrorHandling, config]);
  
  const updateRemoteConfig = useCallback(withErrorHandling(async (newConfig: Partial<RemoteLogConfig>) => {
    if (!remoteConfig) return;
    
    const updatedConfig = { ...remoteConfig, ...newConfig };
    await loggingService.updateRemoteLogConfig(updatedConfig);
    setRemoteConfig(updatedConfig);
  }, '更新远程配置失败'), [withErrorHandling, remoteConfig]);
  
  // ================================
  // 文件管理
  // ================================
  
  const getLogFiles = useCallback(withErrorHandling(async () => {
    const files = await loggingService.getLogFiles();
    setLogFiles(files);
  }, '获取日志文件失败'), [withErrorHandling]);
  
  const deleteLogFile = useCallback(withErrorHandling(async (filePath: string) => {
    await loggingService.deleteLogFile(filePath);
    await getLogFiles(); // 刷新文件列表
  }, '删除日志文件失败'), [withErrorHandling, getLogFiles]);
  
  const compressLogFiles = useCallback(withErrorHandling(async (
    filePaths: string[], 
    outputPath: string
  ): Promise<string> => {
    return await loggingService.compressLogFiles(filePaths, outputPath);
  }, '压缩日志文件失败'), [withErrorHandling]);
  
  // ================================
  // 系统管理
  // ================================
  
  const initializeSystem = useCallback(withErrorHandling(async (initConfig?: LoggerConfig) => {
    if (initConfig) {
      await loggingService.initializeLoggingSystem(initConfig);
    }
    await refreshSystemStatus();
    await loadConfig();
  }, '初始化系统失败'), [withErrorHandling, loadConfig]);
  
  const refreshSystemStatus = useCallback(withErrorHandling(async () => {
    const status = await loggingService.getLogSystemStatus();
    setSystemStatus(status);
  }, '获取系统状态失败'), [withErrorHandling]);
  
  const flushBuffer = useCallback(withErrorHandling(async () => {
    await loggingService.flushLogBuffer();
  }, '刷新缓冲区失败'), [withErrorHandling]);
  
  // ================================
  // 自动刷新逻辑
  // ================================
  
  useEffect(() => {
    if (refreshInterval > 0 && realtime) {
      refreshTimer.current = setInterval(() => {
        refreshLogs().catch(console.error);
        refreshStatistics().catch(console.error);
        refreshSystemStatus().catch(console.error);
      }, refreshInterval * 1000);
      
      return () => {
        if (refreshTimer.current) {
          clearInterval(refreshTimer.current);
        }
      };
    }
  }, [refreshInterval, realtime, refreshLogs, refreshStatistics, refreshSystemStatus]);
  
  // ================================
  // 初始化效果
  // ================================
  
  useEffect(() => {
    if (autoInit) {
      const initialize = async () => {
        try {
          await refreshSystemStatus();
          await loadConfig();
          await refreshLogs();
          await refreshStatistics();
          await getLogFiles();
        } catch (error) {
          handleError(error, '初始化日志系统失败');
        }
      };
      
      initialize();
    }
  }, [autoInit, refreshSystemStatus, loadConfig, refreshLogs, refreshStatistics, getLogFiles, handleError]);
  
  // ================================
  // 清理效果
  // ================================
  
  useEffect(() => {
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, []);
  
  // ================================
  // 返回接口
  // ================================
  
  return {
    // 状态
    logs,
    statistics,
    systemStatus,
    logFiles,
    isLoading,
    error,
    
    // 配置
    config,
    remoteConfig,
    
    // 日志记录方法
    debug,
    info,
    warn,
    writeError,
    fatal,
    
    // 查询和搜索
    searchLogs,
    refreshLogs,
    refreshStatistics,
    
    // 导出和管理
    exportLogs,
    clearLogs,
    uploadLogs,
    
    // 配置管理
    updateConfig,
    updateRemoteConfig,
    
    // 文件管理
    getLogFiles,
    deleteLogFile,
    compressLogFiles,
    
    // 系统管理
    initializeSystem,
    refreshSystemStatus,
    flushBuffer,
  };
}

// ================================
// 专用 Hooks
// ================================

/**
 * 日志记录专用 Hook
 */
export function useLogger(module?: string) {
  const { debug, info, warn, writeError, fatal } = useLogging({ autoInit: false });
  
  return {
    debug: (message: string, data?: any) => debug(message, data, module),
    info: (message: string, data?: any) => info(message, data, module),
    warn: (message: string, data?: any) => warn(message, data, module),
    error: (message: string, error?: Error | any) => writeError(message, error, module),
    fatal: (message: string, error?: Error | any) => fatal(message, error, module),
  };
}

/**
 * 日志统计专用 Hook
 */
export function useLogStatistics(filter?: LogFilter, autoRefresh?: boolean) {
  const { statistics, refreshStatistics, isLoading, error } = useLogging({ 
    autoInit: true,
    refreshInterval: autoRefresh ? 30 : 0,
    realtime: autoRefresh 
  });
  
  useEffect(() => {
    refreshStatistics(filter);
  }, [filter, refreshStatistics]);
  
  return {
    statistics,
    refresh: () => refreshStatistics(filter),
    isLoading,
    error
  };
}

/**
 * 日志配置专用 Hook
 */
export function useLogConfig() {
  const { 
    config, 
    remoteConfig, 
    updateConfig, 
    updateRemoteConfig, 
    isLoading, 
    error 
  } = useLogging({ autoInit: true });
  
  return {
    config,
    remoteConfig,
    updateConfig,
    updateRemoteConfig,
    isLoading,
    error
  };
}

/**
 * 性能监控 Hook
 */
export function usePerformanceLogging(enabled: boolean = true) {
  const { debug, warn } = useLogger('Performance');
  
  const measureSync = useCallback(<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T => {
    if (!enabled) return fn();
    
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      
      debug(
        `${name} 执行完成`,
        { duration: `${duration.toFixed(2)}ms`, ...metadata }
      );
      
      if (duration > 100) {
        warn(
          `${name} 执行时间较长`,
          { duration: `${duration.toFixed(2)}ms`, ...metadata }
        );
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      debug(
        `${name} 执行失败`,
        { duration: `${duration.toFixed(2)}ms`, error, ...metadata }
      );
      throw error;
    }
  }, [enabled, debug, warn]);
  
  const measureAsync = useCallback(async <T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    if (!enabled) return await fn();
    
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      debug(
        `${name} 执行完成`,
        { duration: `${duration.toFixed(2)}ms`, ...metadata }
      );
      
      if (duration > 1000) {
        warn(
          `${name} 执行时间过长`,
          { duration: `${duration.toFixed(2)}ms`, ...metadata }
        );
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      debug(
        `${name} 执行失败`,
        { duration: `${duration.toFixed(2)}ms`, error, ...metadata }
      );
      throw error;
    }
  }, [enabled, debug, warn]);
  
  return {
    measureSync,
    measureAsync
  };
}

export default useLogging;
