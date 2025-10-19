/**
 * 隐私管理相关类型定义
 */

/**
 * 数据保留策略
 */
export interface RetentionPolicy {
  /** 是否启用自动清理 */
  enabled: boolean;
  /** 保留天数 */
  retentionDays: number;
  /** 数据类型 */
  dataTypes: string[];
}

/**
 * 匿名化配置
 */
export interface AnonymizationConfig {
  /** 是否启用匿名化 */
  enabled: boolean;
  /** 要匿名化的字段 */
  fields: string[];
  /** 匿名化方法 */
  method: 'hash' | 'mask' | 'remove';
}

/**
 * 隐私设置
 */
export interface PrivacySettings {
  /** 是否启用数据收集 */
  dataCollectionEnabled: boolean;
  /** 是否启用分析 */
  analyticsEnabled: boolean;
  /** 是否启用崩溃报告 */
  crashReportsEnabled: boolean;
  /** 数据保留策略 */
  retentionPolicy: RetentionPolicy;
  /** 匿名化配置 */
  anonymizationConfig: AnonymizationConfig;
  /** 最后更新时间 */
  lastUpdated?: string;
}

/**
 * 导出格式类型
 */
export type ExportFormat = 'json' | 'csv' | 'pdf';

/**
 * 数据导出选项
 */
export interface ExportOptions {
  /** 导出格式 */
  format: ExportFormat;
  /** 是否匿名化 */
  anonymize: boolean;
  /** 是否包含学习进度 */
  includeProgress: boolean;
  /** 是否包含偏好设置 */
  includePreferences: boolean;
  /** 是否包含学习历史 */
  includeHistory: boolean;
  /** 日期范围起始 */
  dateFrom?: string;
  /** 日期范围结束 */
  dateTo?: string;
}

/**
 * 导出数据结果
 */
export interface ExportedData {
  /** 导出时间戳 */
  exportedAt: string;
  /** 文件名 */
  filename: string;
  /** 导出的数据（字符串格式） */
  data: string;
  /** 用户数据 */
  userData?: Record<string, any>;
  /** 学习历史 */
  learningHistory?: Record<string, any>[];
  /** 设置数据 */
  settings?: Record<string, any>;
}

/**
 * 数据清理选项
 */
export interface CleanupOptions {
  /** 要清理的数据类型 */
  dataTypes: string[];
  /** 是否清理所有数据 */
  cleanAll: boolean;
  /** 日期范围起始 */
  dateFrom?: string;
  /** 日期范围结束 */
  dateTo?: string;
}

/**
 * 清理结果
 */
export interface CleanupResult {
  /** 是否成功 */
  success: boolean;
  /** 清理的记录数 */
  recordsDeleted: number;
  /** 清理的会话数 */
  sessionsDeleted: number;
  /** 释放的空间（字节） */
  spaceFreed: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 隐私审计日志条目
 */
export interface PrivacyAuditLog {
  /** 日志 ID */
  id: string;
  /** 操作类型 */
  action: 'export' | 'delete' | 'anonymize' | 'settings_update';
  /** 操作时间戳 */
  timestamp: string;
  /** 操作详情 */
  details: string;
  /** 是否成功 */
  success: boolean;
}

/**
 * 用户同意记录
 */
export interface ConsentRecord {
  /** 记录ID */
  id: string;
  /** 同意时间 */
  timestamp: string;
  /** 数据收集 */
  dataCollection: boolean;
  /** 分析统计 */
  analytics: boolean;
  /** 崩溃报告 */
  crashReports: boolean;
  /** 隐私政策版本 */
  version: string;
  /** IP地址（可选） */
  ipAddress: string | null;
  /** 用户代理 */
  userAgent: string;
}

