/**
 * 内存管理类型定义
 * 提供内存监控、清理、统计和优化的类型系统
 */

/**
 * 内存使用信息
 */
export interface MemoryInfo {
  /** 总内存（字节） */
  total_memory: number;
  /** 已用内存（字节） */
  used_memory: number;
  /** 可用内存（字节） */
  available_memory: number;
  /** 内存使用率（百分比） */
  usage_percentage: number;
  /** 应用内存使用（字节） */
  app_memory: number;
  /** 应用内存使用率（百分比） */
  app_memory_percentage: number;
}

/**
 * 内存池统计信息
 */
export interface MemoryPoolStats {
  /** 池名称 */
  name: string;
  /** 已分配对象数量 */
  allocated_count: number;
  /** 总容量 */
  capacity: number;
  /** 使用率（百分比） */
  usage_percentage: number;
  /** 总内存占用（字节） */
  total_bytes: number;
  /** 峰值使用量 */
  peak_count: number;
  /** 最后访问时间 */
  last_accessed: number;
}

/**
 * 内存泄漏检测项
 */
export interface MemoryLeakInfo {
  /** 泄漏类型 */
  leak_type: string;
  /** 泄漏大小（字节） */
  size: number;
  /** 检测时间 */
  detected_at: number;
  /** 严重程度（1-5） */
  severity: number;
  /** 位置信息 */
  location: string;
  /** 建议 */
  suggestion: string;
}

/**
 * 内存清理结果
 */
export interface MemoryCleanupResult {
  /** 清理的内存大小（字节） */
  cleaned_bytes: number;
  /** 清理的对象数量 */
  cleaned_objects: number;
  /** 清理耗时（毫秒） */
  duration_ms: number;
  /** 清理详情 */
  details: Record<string, number>;
}

/**
 * 内存快照
 */
export interface MemorySnapshot {
  /** 快照时间 */
  timestamp: number;
  /** 内存信息 */
  memory_info: MemoryInfo;
  /** 内存池统计 */
  pool_stats: MemoryPoolStats[];
  /** 活跃对象计数 */
  active_objects: Record<string, number>;
}

/**
 * 内存阈值配置
 */
export interface MemoryThresholds {
  /** 警告阈值（百分比） */
  warning_threshold: number;
  /** 严重阈值（百分比） */
  critical_threshold: number;
  /** 自动清理阈值（百分比） */
  auto_cleanup_threshold: number;
}

/**
 * 内存状态
 */
export type MemoryStatus = 'normal' | 'warning' | 'critical';

/**
 * 内存统计摘要
 */
export interface MemorySummary {
  memory_info: MemoryInfo;
  pool_count: number;
  status: MemoryStatus;
  thresholds: MemoryThresholds;
}

/**
 * 内存池配置
 */
export interface MemoryPoolConfig {
  /** 池名称 */
  name: string;
  /** 容量 */
  capacity: number;
  /** 是否启用 */
  enabled: boolean;
  /** 清理策略 */
  cleanup_strategy?: 'lru' | 'fifo' | 'size';
  /** 最大空闲时间（秒） */
  max_idle_time?: number;
}

/**
 * 内存优化选项
 */
export interface MemoryOptimizationOptions {
  /** 是否启用自动清理 */
  auto_cleanup: boolean;
  /** 清理间隔（秒） */
  cleanup_interval: number;
  /** 是否启用内存泄漏检测 */
  leak_detection: boolean;
  /** 泄漏检测间隔（秒） */
  leak_detection_interval: number;
  /** 是否启用快照 */
  snapshot_enabled: boolean;
  /** 快照间隔（秒） */
  snapshot_interval: number;
  /** 快照保留数量 */
  snapshot_retention: number;
}

/**
 * 格式化字节大小为人类可读格式
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化内存使用率
 */
export function formatMemoryUsage(usage: number): string {
  return `${usage.toFixed(2)}%`;
}

/**
 * 获取内存状态颜色
 */
export function getMemoryStatusColor(status: MemoryStatus): string {
  switch (status) {
    case 'normal':
      return '#52c41a'; // 绿色
    case 'warning':
      return '#faad14'; // 橙色
    case 'critical':
      return '#f5222d'; // 红色
    default:
      return '#d9d9d9'; // 灰色
  }
}

/**
 * 获取内存状态文本
 */
export function getMemoryStatusText(status: MemoryStatus): string {
  switch (status) {
    case 'normal':
      return '正常';
    case 'warning':
      return '警告';
    case 'critical':
      return '严重';
    default:
      return '未知';
  }
}

/**
 * 计算内存使用趋势
 */
export function calculateMemoryTrend(snapshots: MemorySnapshot[]): 'increasing' | 'decreasing' | 'stable' {
  if (snapshots.length < 2) return 'stable';

  const recent = snapshots.slice(-10); // 取最近10个快照
  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i].memory_info.app_memory - recent[i - 1].memory_info.app_memory;
    if (diff > 0) increasing++;
    else if (diff < 0) decreasing++;
  }

  if (increasing > decreasing * 1.5) return 'increasing';
  if (decreasing > increasing * 1.5) return 'decreasing';
  return 'stable';
}

/**
 * 判断是否需要清理内存
 */
export function shouldCleanupMemory(info: MemoryInfo, thresholds: MemoryThresholds): boolean {
  return info.usage_percentage >= thresholds.auto_cleanup_threshold;
}

/**
 * 获取泄漏严重程度文本
 */
export function getLeakSeverityText(severity: number): string {
  switch (severity) {
    case 1:
      return '低';
    case 2:
      return '较低';
    case 3:
      return '中等';
    case 4:
      return '较高';
    case 5:
      return '高';
    default:
      return '未知';
  }
}

/**
 * 获取泄漏严重程度颜色
 */
export function getLeakSeverityColor(severity: number): string {
  if (severity <= 2) return '#52c41a'; // 绿色
  if (severity === 3) return '#faad14'; // 橙色
  return '#f5222d'; // 红色
}

/**
 * 默认内存阈值
 */
export const DEFAULT_MEMORY_THRESHOLDS: MemoryThresholds = {
  warning_threshold: 70.0,
  critical_threshold: 85.0,
  auto_cleanup_threshold: 90.0,
};

/**
 * 默认优化选项
 */
export const DEFAULT_OPTIMIZATION_OPTIONS: MemoryOptimizationOptions = {
  auto_cleanup: true,
  cleanup_interval: 300, // 5分钟
  leak_detection: true,
  leak_detection_interval: 600, // 10分钟
  snapshot_enabled: true,
  snapshot_interval: 60, // 1分钟
  snapshot_retention: 100,
};

