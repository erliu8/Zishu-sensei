/**
 * 日志服务层
 * 
 * 提供统一的日志管理接口：
 * - 日志记录和查询
 * - 远程配置管理
 * - 文件操作
 * - 统计分析
 */

import { invoke } from '@tauri-apps/api/tauri';

// ================================
// 类型定义
// ================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

export interface LogEntry {
  timestamp: string; // ISO string
  level: LogLevel;
  message: string;
  module?: string;
  file?: string;
  line?: number;
  thread?: string;
  data?: any;
  stack?: string;
  tags: string[];
}

export interface LogFilter {
  levels?: LogLevel[];
  modules?: string[];
  timeRange?: {
    start: number; // Unix timestamp
    end: number;
  };
  keywords?: string[];
  tags?: string[];
  includeUploaded?: boolean;
  files?: string[];
}

export interface LogSearchRequest {
  filter?: LogFilter;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface LogSearchResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LogExportRequest {
  format: 'json' | 'csv' | 'txt';
  filter?: LogFilter;
  filePath: string;
}

export interface LogStatistics {
  totalCount: number;
  countByLevel: Record<string, number>;
  countByModule: Record<string, number>;
  countByHour: Record<string, number>;
  countByDate: Record<string, number>;
  errorRate: number;
  averageSize: number;
  earliestLog?: number;
  latestLog?: number;
  uploadStats: UploadStatistics;
}

export interface UploadStatistics {
  totalUploaded: number;
  pendingUpload: number;
  uploadSuccessRate: number;
  lastUploadTime?: number;
  lastUploadBatchSize: number;
}

export interface RemoteLogConfig {
  enabled: boolean;
  endpointUrl: string;
  apiKey?: string;
  batchSize: number;
  uploadIntervalSeconds: number;
  retryAttempts: number;
  timeoutSeconds: number;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDir: string;
  filePrefix: string;
  maxFileSize: number;
  retentionDays: number;
  rotation: 'hourly' | 'daily' | 'never';
  prettyJson: boolean;
  includeLocation: boolean;
  asyncWrite: boolean;
}

export interface LogSystemStatus {
  initialized: boolean;
  config: LoggerConfig;
  remoteConfig: RemoteLogConfig;
  currentLogFile?: string;
  logFileSize: number;
  totalLogsCount: number;
  pendingUploadCount: number;
  lastUploadTime?: number;
  lastError?: string;
}

export interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  created?: number;
  modified?: number;
}

// ================================
// 错误类型
// ================================

export class LoggingError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'LoggingError';
  }
}

// ================================
// 服务类
// ================================

export class LoggingService {
  private static instance: LoggingService | null = null;
  
  private constructor() {}
  
  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }
  
  // ================================
  // 日志系统管理
  // ================================
  
  /**
   * 初始化日志系统
   */
  async initializeLoggingSystem(config: LoggerConfig): Promise<void> {
    try {
      await invoke('init_logging_system', { config });
    } catch (error) {
      throw new LoggingError('初始化日志系统失败', 'INIT_FAILED', error);
    }
  }
  
  /**
   * 获取日志系统状态
   */
  async getLogSystemStatus(): Promise<LogSystemStatus> {
    try {
      return await invoke('get_log_system_status');
    } catch (error) {
      throw new LoggingError('获取日志系统状态失败', 'STATUS_FAILED', error);
    }
  }
  
  // ================================
  // 日志记录
  // ================================
  
  /**
   * 写入日志条目
   */
  async writeLogEntry(
    level: LogLevel | string,
    message: string,
    module?: string,
    data?: any,
    tags?: string[]
  ): Promise<void> {
    try {
      const levelStr = typeof level === 'string' ? level : LOG_LEVEL_NAMES[level];
      await invoke('write_log_entry', {
        level: levelStr,
        message,
        module,
        data,
        tags
      });
    } catch (error) {
      throw new LoggingError('写入日志失败', 'WRITE_FAILED', error);
    }
  }
  
  /**
   * 便捷的日志记录方法
   */
  async debug(message: string, data?: any, module?: string): Promise<void> {
    return this.writeLogEntry(LogLevel.DEBUG, message, module, data);
  }
  
  async info(message: string, data?: any, module?: string): Promise<void> {
    return this.writeLogEntry(LogLevel.INFO, message, module, data);
  }
  
  async warn(message: string, data?: any, module?: string): Promise<void> {
    return this.writeLogEntry(LogLevel.WARN, message, module, data);
  }
  
  async error(message: string, error?: Error | any, module?: string): Promise<void> {
    const data = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    return this.writeLogEntry(LogLevel.ERROR, message, module, data);
  }
  
  async fatal(message: string, error?: Error | any, module?: string): Promise<void> {
    const data = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    return this.writeLogEntry(LogLevel.FATAL, message, module, data);
  }
  
  // ================================
  // 日志查询
  // ================================
  
  /**
   * 搜索日志条目
   */
  async searchLogs(request: LogSearchRequest): Promise<LogSearchResponse> {
    try {
      return await invoke('search_logs', { request });
    } catch (error) {
      throw new LoggingError('搜索日志失败', 'SEARCH_FAILED', error);
    }
  }
  
  /**
   * 获取日志统计信息
   */
  async getLogStatistics(filter?: LogFilter): Promise<LogStatistics> {
    try {
      return await invoke('get_log_statistics', { filter });
    } catch (error) {
      throw new LoggingError('获取日志统计失败', 'STATS_FAILED', error);
    }
  }
  
  // ================================
  // 日志导出
  // ================================
  
  /**
   * 导出日志
   */
  async exportLogs(request: LogExportRequest): Promise<number> {
    try {
      return await invoke('export_logs', { request });
    } catch (error) {
      throw new LoggingError('导出日志失败', 'EXPORT_FAILED', error);
    }
  }
  
  // ================================
  // 日志清理
  // ================================
  
  /**
   * 清理旧日志
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    try {
      return await invoke('cleanup_old_logs', { retentionDays });
    } catch (error) {
      throw new LoggingError('清理日志失败', 'CLEANUP_FAILED', error);
    }
  }
  
  // ================================
  // 配置管理
  // ================================
  
  /**
   * 获取日志配置
   */
  async getLogConfig(): Promise<LoggerConfig> {
    try {
      return await invoke('get_log_config');
    } catch (error) {
      throw new LoggingError('获取日志配置失败', 'CONFIG_GET_FAILED', error);
    }
  }
  
  /**
   * 更新日志配置
   */
  async updateLogConfig(config: LoggerConfig): Promise<void> {
    try {
      await invoke('update_log_config', { config });
    } catch (error) {
      throw new LoggingError('更新日志配置失败', 'CONFIG_UPDATE_FAILED', error);
    }
  }
  
  /**
   * 获取远程日志配置
   */
  async getRemoteLogConfig(): Promise<RemoteLogConfig> {
    try {
      return await invoke('get_remote_log_config');
    } catch (error) {
      throw new LoggingError('获取远程配置失败', 'REMOTE_CONFIG_GET_FAILED', error);
    }
  }
  
  /**
   * 更新远程日志配置
   */
  async updateRemoteLogConfig(config: RemoteLogConfig): Promise<void> {
    try {
      await invoke('update_remote_log_config', { config });
    } catch (error) {
      throw new LoggingError('更新远程配置失败', 'REMOTE_CONFIG_UPDATE_FAILED', error);
    }
  }
  
  // ================================
  // 远程上传
  // ================================
  
  /**
   * 手动上传日志到远程服务器
   */
  async uploadLogsToRemote(): Promise<number> {
    try {
      return await invoke('upload_logs_to_remote');
    } catch (error) {
      throw new LoggingError('上传日志失败', 'UPLOAD_FAILED', error);
    }
  }
  
  // ================================
  // 文件管理
  // ================================
  
  /**
   * 刷新日志缓冲区
   */
  async flushLogBuffer(): Promise<void> {
    try {
      await invoke('flush_log_buffer');
    } catch (error) {
      throw new LoggingError('刷新缓冲区失败', 'FLUSH_FAILED', error);
    }
  }
  
  /**
   * 获取日志文件列表
   */
  async getLogFiles(): Promise<LogFileInfo[]> {
    try {
      return await invoke('get_log_files');
    } catch (error) {
      throw new LoggingError('获取日志文件失败', 'FILES_GET_FAILED', error);
    }
  }
  
  /**
   * 删除日志文件
   */
  async deleteLogFile(filePath: string): Promise<void> {
    try {
      await invoke('delete_log_file', { filePath });
    } catch (error) {
      throw new LoggingError('删除日志文件失败', 'FILE_DELETE_FAILED', error);
    }
  }
  
  /**
   * 压缩日志文件
   */
  async compressLogFiles(filePaths: string[], outputPath: string): Promise<string> {
    try {
      return await invoke('compress_log_files', { filePaths, outputPath });
    } catch (error) {
      throw new LoggingError('压缩日志文件失败', 'FILE_COMPRESS_FAILED', error);
    }
  }
}

// ================================
// 单例实例
// ================================

export const loggingService = LoggingService.getInstance();

// ================================
// 便捷函数
// ================================

/**
 * 便捷的日志记录函数
 */
export const log = {
  debug: (message: string, data?: any, module?: string) => 
    loggingService.debug(message, data, module),
  
  info: (message: string, data?: any, module?: string) =>
    loggingService.info(message, data, module),
  
  warn: (message: string, data?: any, module?: string) =>
    loggingService.warn(message, data, module),
  
  error: (message: string, error?: Error | any, module?: string) =>
    loggingService.error(message, error, module),
  
  fatal: (message: string, error?: Error | any, module?: string) =>
    loggingService.fatal(message, error, module),
};

/**
 * 性能监控装饰器
 */
export function logPerformance<T extends (...args: any[]) => any>(
  target: T,
  name: string,
  module?: string
): T {
  return (async (...args: any[]) => {
    const startTime = performance.now();
    try {
      const result = await target(...args);
      const duration = performance.now() - startTime;
      
      await log.debug(
        `性能监控: ${name} 执行完成`,
        { duration: `${duration.toFixed(2)}ms`, args: args.length },
        module || 'Performance'
      );
      
      if (duration > 1000) {
        await log.warn(
          `性能警告: ${name} 执行时间过长`,
          { duration: `${duration.toFixed(2)}ms` },
          module || 'Performance'
        );
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      await log.error(
        `性能监控: ${name} 执行失败`,
        { duration: `${duration.toFixed(2)}ms`, error },
        module || 'Performance'
      );
      throw error;
    }
  }) as T;
}

/**
 * 自动错误日志记录装饰器
 */
export function logErrors<T extends (...args: any[]) => any>(
  target: T,
  module?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await target(...args);
    } catch (error) {
      await log.error(
        `函数执行失败: ${target.name || 'anonymous'}`,
        error,
        module || 'ErrorHandler'
      );
      throw error;
    }
  }) as T;
}

export default loggingService;
