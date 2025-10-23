/**
 * 自定义日志系统
 * 提供日志级别管理、日志持久化、远程日志上传功能
 */

/**
 * 日志级别
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
 * 日志条目
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  stack?: string;
  tags?: string[];
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enablePersistence: boolean;
  maxLogSize: number; // 最大存储日志数量
  persistenceKey: string;
  enableRemote: boolean;
  remoteEndpoint?: string;
  batchSize: number; // 批量上传日志数量
  batchInterval: number; // 批量上传间隔（毫秒）
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enablePersistence: true,
  maxLogSize: 1000,
  persistenceKey: 'zishu_logs',
  enableRemote: false,
  batchSize: 50,
  batchInterval: 30000, // 30秒
};

/**
 * 日志管理器类
 */
class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadPersistedLogs();
    this.startBatchUpload();
  }

  /**
   * 更新配置
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 重启批量上传
    if (this.config.enableRemote) {
      this.stopBatchUpload();
      this.startBatchUpload();
    }
  }

  /**
   * 设置日志级别
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 调试日志
   */
  public debug(message: string, context?: Record<string, any>, tags?: string[]): void {
    this.log(LogLevel.DEBUG, message, context, tags);
  }

  /**
   * 信息日志
   */
  public info(message: string, context?: Record<string, any>, tags?: string[]): void {
    this.log(LogLevel.INFO, message, context, tags);
  }

  /**
   * 警告日志
   */
  public warn(message: string, context?: Record<string, any>, tags?: string[]): void {
    this.log(LogLevel.WARN, message, context, tags);
  }

  /**
   * 错误日志
   */
  public error(message: string, error?: Error, context?: Record<string, any>, tags?: string[]): void {
    this.log(
      LogLevel.ERROR,
      message,
      { ...context, error: error?.message },
      tags,
      error?.stack
    );
  }

  /**
   * 致命错误日志
   */
  public fatal(message: string, error?: Error, context?: Record<string, any>, tags?: string[]): void {
    this.log(
      LogLevel.FATAL,
      message,
      { ...context, error: error?.message },
      tags,
      error?.stack
    );
  }

  /**
   * 记录日志
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    tags?: string[],
    stack?: string
  ): void {
    // 检查日志级别
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      tags,
      stack,
    };

    // 添加到内存
    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.config.maxLogSize) {
      this.logs.shift();
    }

    // 输出到控制台
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // 持久化
    if (this.config.enablePersistence) {
      this.persistLogs();
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const levelName = LOG_LEVEL_NAMES[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${levelName}]`;

    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.context);
        break;
      case LogLevel.INFO:
        console.info(message, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.context);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, entry.context, entry.stack);
        break;
    }
  }

  /**
   * 持久化日志到 localStorage
   */
  private persistLogs(): void {
    try {
      const serialized = JSON.stringify(this.logs);
      localStorage.setItem(this.config.persistenceKey, serialized);
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }

  /**
   * 从 localStorage 加载日志
   */
  private loadPersistedLogs(): void {
    try {
      const serialized = localStorage.getItem(this.config.persistenceKey);
      if (serialized) {
        this.logs = JSON.parse(serialized);
      }
    } catch (error) {
      console.error('Failed to load persisted logs:', error);
      this.logs = [];
    }
  }

  /**
   * 获取所有日志
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 按级别获取日志
   */
  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * 按标签获取日志
   */
  public getLogsByTag(tag: string): LogEntry[] {
    return this.logs.filter((log) => log.tags?.includes(tag));
  }

  /**
   * 按时间范围获取日志
   */
  public getLogsByTimeRange(startTime: number, endTime: number): LogEntry[] {
    return this.logs.filter(
      (log) => log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  /**
   * 清空日志
   */
  public clear(): void {
    this.logs = [];
    try {
      localStorage.removeItem(this.config.persistenceKey);
    } catch (error) {
      console.error('Failed to clear persisted logs:', error);
    }
  }

  /**
   * 导出日志为 JSON
   */
  public exportAsJson(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 导出日志为文本
   */
  public exportAsText(): string {
    return this.logs
      .map((entry) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const level = LOG_LEVEL_NAMES[entry.level];
        const context = entry.context ? JSON.stringify(entry.context) : '';
        const tags = entry.tags ? `[${entry.tags.join(', ')}]` : '';
        
        let line = `[${timestamp}] [${level}] ${entry.message}`;
        if (tags) line += ` ${tags}`;
        if (context) line += `\n  Context: ${context}`;
        if (entry.stack) line += `\n  Stack: ${entry.stack}`;
        
        return line;
      })
      .join('\n\n');
  }

  /**
   * 下载日志文件
   */
  public download(format: 'json' | 'txt' = 'json'): void {
    const content = format === 'json' ? this.exportAsJson() : this.exportAsText();
    const blob = new Blob([content], { 
      type: format === 'json' ? 'application/json' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zishu-logs-${Date.now()}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 开始批量上传
   */
  private startBatchUpload(): void {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) {
      return;
    }

    this.batchTimer = setInterval(() => {
      this.uploadLogs();
    }, this.config.batchInterval);
  }

  /**
   * 停止批量上传
   */
  private stopBatchUpload(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * 上传日志到远程服务器
   */
  private async uploadLogs(): Promise<void> {
    if (!this.config.remoteEndpoint || this.logs.length === 0) {
      return;
    }

    const logsToUpload = this.logs.slice(0, this.config.batchSize);

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToUpload }),
      });

      if (response.ok) {
        // 上传成功，移除已上传的日志
        this.logs = this.logs.slice(this.config.batchSize);
        this.persistLogs();
      }
    } catch (error) {
      console.error('Failed to upload logs:', error);
    }
  }

  /**
   * 立即上传所有日志
   */
  public async flush(): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) {
      return;
    }

    while (this.logs.length > 0) {
      await this.uploadLogs();
    }
  }
}

/**
 * 全局日志实例
 */
let loggerInstance: Logger | null = null;

/**
 * 初始化日志系统
 */
export function initLogger(config?: Partial<LoggerConfig>): Logger {
  loggerInstance = new Logger(config);
  return loggerInstance;
}

/**
 * 获取日志实例
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

/**
 * 便捷日志方法
 */
export const logger = {
  debug: (message: string, context?: Record<string, any>, tags?: string[]) => {
    getLogger().debug(message, context, tags);
  },
  info: (message: string, context?: Record<string, any>, tags?: string[]) => {
    getLogger().info(message, context, tags);
  },
  warn: (message: string, context?: Record<string, any>, tags?: string[]) => {
    getLogger().warn(message, context, tags);
  },
  error: (message: string, error?: Error, context?: Record<string, any>, tags?: string[]) => {
    getLogger().error(message, error, context, tags);
  },
  fatal: (message: string, error?: Error, context?: Record<string, any>, tags?: string[]) => {
    getLogger().fatal(message, error, context, tags);
  },
};

/**
 * 导出 Logger 类供高级使用
 */
export { Logger };

