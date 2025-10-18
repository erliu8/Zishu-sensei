/**
 * 前端日志系统
 * 
 * 提供全面的日志记录功能：
 * - 多级别日志（DEBUG, INFO, WARN, ERROR, FATAL）
 * - 日志持久化到本地
 * - 日志上传到后端
 * - 日志格式化和美化
 * - 性能监控
 * - 错误追踪
 * - 日志过滤和搜索
 * 
 * @module utils/logger
 */

import { invoke } from '@tauri-apps/api/tauri';
import { BaseDirectory, createDir, writeTextFile, readTextFile, exists } from '@tauri-apps/api/fs';
import { appLogDir, join } from '@tauri-apps/api/path';

// ================================
// 类型定义
// ================================

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * 日志级别名称映射
 */
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

/**
 * 日志级别颜色映射（用于控制台输出）
 */
export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '#999999',
  [LogLevel.INFO]: '#2196F3',
  [LogLevel.WARN]: '#FF9800',
  [LogLevel.ERROR]: '#F44336',
  [LogLevel.FATAL]: '#9C27B0',
};

/**
 * 日志条目接口
 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: number;
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 模块名称 */
  module?: string;
  /** 额外数据 */
  data?: any;
  /** 错误堆栈 */
  stack?: string;
  /** 用户ID */
  userId?: string;
  /** 会话ID */
  sessionId?: string;
  /** 标签 */
  tags?: string[];
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  /** 最小日志级别 */
  minLevel: LogLevel;
  /** 是否启用控制台输出 */
  enableConsole: boolean;
  /** 是否启用文件持久化 */
  enableFile: boolean;
  /** 是否启用远程上传 */
  enableRemote: boolean;
  /** 最大日志文件大小（字节） */
  maxFileSize: number;
  /** 日志文件保留天数 */
  retentionDays: number;
  /** 远程上传批次大小 */
  uploadBatchSize: number;
  /** 远程上传间隔（毫秒） */
  uploadInterval: number;
  /** 是否美化JSON输出 */
  prettyPrint: boolean;
  /** 是否包含堆栈信息 */
  includeStack: boolean;
  /** 自定义模块名称 */
  moduleName?: string;
}

/**
 * 日志过滤器接口
 */
export interface LogFilter {
  /** 级别过滤 */
  levels?: LogLevel[];
  /** 模块过滤 */
  modules?: string[];
  /** 时间范围过滤 */
  timeRange?: {
    start: number;
    end: number;
  };
  /** 标签过滤 */
  tags?: string[];
  /** 关键词搜索 */
  keywords?: string[];
}

/**
 * 日志统计信息
 */
export interface LogStats {
  /** 总日志数量 */
  total: number;
  /** 各级别日志数量 */
  byLevel: Record<LogLevel, number>;
  /** 最早日志时间 */
  oldestTimestamp: number;
  /** 最新日志时间 */
  newestTimestamp: number;
  /** 总大小（字节） */
  totalSize: number;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 操作名称 */
  name: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 持续时间（毫秒） */
  duration: number;
  /** 额外数据 */
  metadata?: Record<string, any>;
}

// ================================
// 默认配置
// ================================

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  enableRemote: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  retentionDays: 7,
  uploadBatchSize: 50,
  uploadInterval: 60000, // 1分钟
  prettyPrint: false,
  includeStack: true,
};

// ================================
// Logger 类
// ================================

/**
 * 日志管理器类
 */
export class Logger {
  private static instance: Logger | null = null;
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private sessionId: string;
  private uploadTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private logFilePath: string | null = null;

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
  }

  /**
   * 获取Logger单例
   */
  public static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    } else if (config) {
      Logger.instance.updateConfig(config);
    }
    return Logger.instance;
  }

  /**
   * 初始化日志系统
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 创建日志目录
      if (this.config.enableFile) {
        await this.initLogFile();
      }

      // 启动远程上传定时器
      if (this.config.enableRemote) {
        this.startUploadTimer();
      }

      this.isInitialized = true;
      this.info('日志系统初始化成功', { config: this.config });
    } catch (error) {
      console.error('日志系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化日志文件
   */
  private async initLogFile(): Promise<void> {
    try {
      const logDir = await appLogDir();
      const date = new Date();
      const filename = `app-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`;
      this.logFilePath = await join(logDir, filename);

      // 确保目录存在
      const dirExists = await exists(logDir);
      if (!dirExists) {
        await createDir(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('初始化日志文件失败:', error);
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    const oldRemote = this.config.enableRemote;
    this.config = { ...this.config, ...config };

    // 如果远程上传状态改变，更新定时器
    if (oldRemote !== this.config.enableRemote) {
      if (this.config.enableRemote) {
        this.startUploadTimer();
      } else {
        this.stopUploadTimer();
      }
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // ================================
  // 核心日志方法
  // ================================

  /**
   * DEBUG 级别日志
   */
  public debug(message: string, data?: any, module?: string): void {
    this.log(LogLevel.DEBUG, message, data, module);
  }

  /**
   * INFO 级别日志
   */
  public info(message: string, data?: any, module?: string): void {
    this.log(LogLevel.INFO, message, data, module);
  }

  /**
   * WARN 级别日志
   */
  public warn(message: string, data?: any, module?: string): void {
    this.log(LogLevel.WARN, message, data, module);
  }

  /**
   * ERROR 级别日志
   */
  public error(message: string, error?: Error | any, module?: string): void {
    const data = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;

    this.log(LogLevel.ERROR, message, data, module, error?.stack);
  }

  /**
   * FATAL 级别日志
   */
  public fatal(message: string, error?: Error | any, module?: string): void {
    const data = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;

    this.log(LogLevel.FATAL, message, data, module, error?.stack);
  }

  /**
   * 通用日志方法
   */
  private log(
    level: LogLevel,
    message: string,
    data?: any,
    module?: string,
    stack?: string
  ): void {
    // 级别过滤
    if (level < this.config.minLevel) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      module: module || this.config.moduleName,
      data,
      stack: this.config.includeStack ? stack : undefined,
      sessionId: this.sessionId,
      tags: [],
      metadata: {},
    };

    // 添加到缓冲区
    this.buffer.push(entry);

    // 控制台输出
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // 文件持久化
    if (this.config.enableFile) {
      this.logToFile(entry).catch(err => {
        console.error('写入日志文件失败:', err);
      });
    }
  }

  /**
   * 控制台输出
   */
  private logToConsole(entry: LogEntry): void {
    const levelName = LOG_LEVEL_NAMES[entry.level];
    const color = LOG_LEVEL_COLORS[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    const module = entry.module ? `[${entry.module}]` : '';

    const prefix = `%c${timestamp} ${levelName}${module}`;
    const style = `color: ${color}; font-weight: bold;`;

    const consoleMethod = this.getConsoleMethod(entry.level);
    
    if (entry.data !== undefined) {
      consoleMethod(prefix, style, entry.message, entry.data);
    } else {
      consoleMethod(prefix, style, entry.message);
    }

    if (entry.stack && entry.level >= LogLevel.ERROR) {
      console.error(entry.stack);
    }
  }

  /**
   * 获取控制台方法
   */
  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  /**
   * 写入日志文件
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.logFilePath) return;

    try {
      const line = this.formatLogEntry(entry);
      
      // 追加写入文件
      const fileExists = await exists(this.logFilePath);
      let content = line + '\n';
      
      if (fileExists) {
        const existingContent = await readTextFile(this.logFilePath);
        content = existingContent + content;
      }

      await writeTextFile(this.logFilePath, content);

      // 检查文件大小，如果超过限制则轮转
      await this.checkFileRotation();
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.config.prettyPrint) {
      return JSON.stringify(entry, null, 2);
    }
    return JSON.stringify(entry);
  }

  /**
   * 检查文件轮转
   */
  private async checkFileRotation(): Promise<void> {
    // 由于Tauri API限制，这里只是简单检查
    // 实际的文件大小检查和轮转可以通过Rust后端实现
    try {
      // 调用后端进行文件轮转检查
      await invoke('check_log_rotation', {
        maxSize: this.config.maxFileSize,
        retentionDays: this.config.retentionDays,
      });
    } catch (error) {
      // 忽略错误，不影响主流程
    }
  }

  // ================================
  // 远程上传
  // ================================

  /**
   * 启动上传定时器
   */
  private startUploadTimer(): void {
    if (this.uploadTimer) return;

    this.uploadTimer = setInterval(() => {
      this.uploadLogs().catch(err => {
        console.error('上传日志失败:', err);
      });
    }, this.config.uploadInterval);
  }

  /**
   * 停止上传定时器
   */
  private stopUploadTimer(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = null;
    }
  }

  /**
   * 上传日志到后端
   */
  private async uploadLogs(): Promise<void> {
    if (this.buffer.length === 0) return;

    try {
      const logsToUpload = this.buffer.splice(0, this.config.uploadBatchSize);
      
      await invoke('upload_logs', {
        logs: logsToUpload,
      });

      this.debug(`成功上传 ${logsToUpload.length} 条日志`);
    } catch (error) {
      this.error('上传日志失败', error);
      // 上传失败的日志放回缓冲区
      // 注意：这里简化处理，实际应该有更完善的重试机制
    }
  }

  /**
   * 手动触发日志上传
   */
  public async flush(): Promise<void> {
    await this.uploadLogs();
  }

  // ================================
  // 性能监控
  // ================================

  /**
   * 开始性能监控
   */
  public startPerformance(name: string): () => void {
    const startTime = performance.now();

    return (metadata?: Record<string, any>) => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const metrics: PerformanceMetrics = {
        name,
        startTime,
        endTime,
        duration,
        metadata,
      };

      this.debug('性能指标', metrics, 'Performance');

      // 如果耗时过长，记录警告
      if (duration > 1000) {
        this.warn(`性能警告: ${name} 耗时 ${duration.toFixed(2)}ms`, metrics, 'Performance');
      }
    };
  }

  /**
   * 监控异步操作性能
   */
  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const end = this.startPerformance(name);
    try {
      const result = await fn();
      end({ ...metadata, success: true });
      return result;
    } catch (error) {
      end({ ...metadata, success: false, error });
      throw error;
    }
  }

  /**
   * 监控同步操作性能
   */
  public measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const end = this.startPerformance(name);
    try {
      const result = fn();
      end({ ...metadata, success: true });
      return result;
    } catch (error) {
      end({ ...metadata, success: false, error });
      throw error;
    }
  }

  // ================================
  // 日志查询和管理
  // ================================

  /**
   * 获取缓冲区中的日志
   */
  public getBufferedLogs(filter?: LogFilter): LogEntry[] {
    return this.filterLogs(this.buffer, filter);
  }

  /**
   * 过滤日志
   */
  private filterLogs(logs: LogEntry[], filter?: LogFilter): LogEntry[] {
    if (!filter) return logs;

    return logs.filter(entry => {
      // 级别过滤
      if (filter.levels && !filter.levels.includes(entry.level)) {
        return false;
      }

      // 模块过滤
      if (filter.modules && entry.module && !filter.modules.includes(entry.module)) {
        return false;
      }

      // 时间范围过滤
      if (filter.timeRange) {
        if (entry.timestamp < filter.timeRange.start || entry.timestamp > filter.timeRange.end) {
          return false;
        }
      }

      // 标签过滤
      if (filter.tags && entry.tags) {
        const hasMatchingTag = filter.tags.some(tag => entry.tags?.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // 关键词搜索
      if (filter.keywords) {
        const text = JSON.stringify(entry).toLowerCase();
        const hasMatchingKeyword = filter.keywords.some(keyword =>
          text.includes(keyword.toLowerCase())
        );
        if (!hasMatchingKeyword) return false;
      }

      return true;
    });
  }

  /**
   * 获取日志统计信息
   */
  public getStats(): LogStats {
    const byLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0,
    };

    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;
    let totalSize = 0;

    this.buffer.forEach(entry => {
      byLevel[entry.level]++;
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
      totalSize += JSON.stringify(entry).length;
    });

    return {
      total: this.buffer.length,
      byLevel,
      oldestTimestamp: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
      newestTimestamp,
      totalSize,
    };
  }

  /**
   * 清空缓冲区
   */
  public clearBuffer(): void {
    this.buffer = [];
    this.debug('日志缓冲区已清空');
  }

  /**
   * 导出日志
   */
  public async exportLogs(filePath: string, filter?: LogFilter): Promise<void> {
    const logsToExport = this.filterLogs(this.buffer, filter);
    const content = logsToExport.map(entry => this.formatLogEntry(entry)).join('\n');

    try {
      await writeTextFile(filePath, content);
      this.info(`成功导出 ${logsToExport.length} 条日志到 ${filePath}`);
    } catch (error) {
      this.error('导出日志失败', error);
      throw error;
    }
  }

  // ================================
  // 工具方法
  // ================================

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 获取会话ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 销毁Logger实例
   */
  public async destroy(): Promise<void> {
    // 上传剩余日志
    if (this.config.enableRemote && this.buffer.length > 0) {
      await this.uploadLogs();
    }

    // 停止定时器
    this.stopUploadTimer();

    // 清理资源
    this.buffer = [];
    this.isInitialized = false;
    Logger.instance = null;

    this.info('日志系统已销毁');
  }
}

// ================================
// 全局实例和便捷函数
// ================================

/**
 * 全局Logger实例
 */
export const logger = Logger.getInstance();

/**
 * 便捷函数：DEBUG 日志
 */
export const debug = (message: string, data?: any, module?: string): void => {
  logger.debug(message, data, module);
};

/**
 * 便捷函数：INFO 日志
 */
export const info = (message: string, data?: any, module?: string): void => {
  logger.info(message, data, module);
};

/**
 * 便捷函数：WARN 日志
 */
export const warn = (message: string, data?: any, module?: string): void => {
  logger.warn(message, data, module);
};

/**
 * 便捷函数：ERROR 日志
 */
export const error = (message: string, error?: Error | any, module?: string): void => {
  logger.error(message, error, module);
};

/**
 * 便捷函数：FATAL 日志
 */
export const fatal = (message: string, error?: Error | any, module?: string): void => {
  logger.fatal(message, error, module);
};

/**
 * 便捷函数：性能监控
 */
export const measurePerformance = <T>(
  name: string,
  fn: () => T | Promise<T>,
  metadata?: Record<string, any>
): T | Promise<T> => {
  if (fn.constructor.name === 'AsyncFunction' || fn instanceof Promise) {
    return logger.measureAsync(name, fn as () => Promise<T>, metadata);
  }
  return logger.measureSync(name, fn as () => T, metadata);
};

/**
 * 导出默认实例
 */
export default logger;

