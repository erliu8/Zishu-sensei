/**
 * 系统 API 服务层
 * 
 * 提供系统相关的操作功能，包括：
 * - 系统信息获取
 * - 应用版本管理
 * - 更新检查
 * - 系统操作
 * 
 * @module services/api/system
 */

import { invoke } from '@tauri-apps/api/tauri';

// ================================
// 类型定义
// ================================

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: number;
}

/**
 * 系统信息
 */
export interface SystemInfo {
  /** 操作系统名称 */
  os_name: string;
  /** 操作系统版本 */
  os_version: string;
  /** 系统架构 */
  arch: string;
  /** 主机名 */
  hostname: string;
  /** 用户名 */
  username: string;
  /** 系统启动时间 */
  boot_time: string;
  /** 系统运行时间（秒） */
  uptime_seconds: number;
  /** CPU信息 */
  cpu: {
    model: string;
    cores: number;
    threads: number;
    frequency_mhz: number;
  };
  /** 内存信息 */
  memory: {
    total_mb: number;
    available_mb: number;
    used_mb: number;
  };
  /** 磁盘信息 */
  disks: Array<{
    name: string;
    mount_point: string;
    total_mb: number;
    used_mb: number;
    available_mb: number;
    file_system: string;
  }>;
  /** 网络接口 */
  network_interfaces: Array<{
    name: string;
    mac_address: string;
    ip_addresses: string[];
    is_up: boolean;
  }>;
}

/**
 * 应用版本信息
 */
export interface AppVersionInfo {
  /** 应用名称 */
  app_name: string;
  /** 版本号 */
  version: string;
  /** 构建号 */
  build_number: string;
  /** 构建时间 */
  build_time: string;
  /** Git提交哈希 */
  git_commit: string;
  /** Git分支 */
  git_branch: string;
  /** 构建类型 */
  build_type: 'debug' | 'release';
  /** 目标平台 */
  target_platform: string;
}

/**
 * 更新信息
 */
export interface UpdateInfo {
  /** 是否有可用更新 */
  has_update: boolean;
  /** 最新版本 */
  latest_version?: string;
  /** 当前版本 */
  current_version: string;
  /** 更新描述 */
  release_notes?: string;
  /** 下载链接 */
  download_url?: string;
  /** 文件大小 */
  file_size_bytes?: number;
  /** 发布时间 */
  release_date?: string;
  /** 更新类型 */
  update_type: 'patch' | 'minor' | 'major';
  /** 是否强制更新 */
  mandatory: boolean;
}

/**
 * 应用数据路径信息
 */
export interface AppDataPaths {
  /** 应用数据目录 */
  data_dir: string;
  /** 配置目录 */
  config_dir: string;
  /** 缓存目录 */
  cache_dir: string;
  /** 日志目录 */
  log_dir: string;
  /** 临时目录 */
  temp_dir: string;
  /** 下载目录 */
  download_dir: string;
  /** 用户文档目录 */
  documents_dir: string;
  /** 桌面目录 */
  desktop_dir: string;
}

/**
 * 系统性能指标
 */
export interface SystemPerformanceMetrics {
  /** CPU使用率（百分比） */
  cpu_usage_percent: number;
  /** 内存使用率（百分比） */
  memory_usage_percent: number;
  /** 磁盘使用率（百分比） */
  disk_usage_percent: number;
  /** 网络使用情况 */
  network: {
    bytes_sent: number;
    bytes_received: number;
    packets_sent: number;
    packets_received: number;
  };
  /** 系统负载 */
  load_average: {
    one_minute: number;
    five_minutes: number;
    fifteen_minutes: number;
  };
  /** 进程数量 */
  process_count: number;
  /** 线程数量 */
  thread_count: number;
}

/**
 * 系统事件
 */
export interface SystemEvent {
  /** 事件类型 */
  type: 'startup' | 'shutdown' | 'error' | 'warning' | 'info';
  /** 事件消息 */
  message: string;
  /** 时间戳 */
  timestamp: string;
  /** 额外数据 */
  data?: any;
}

// ================================
// 核心 API 函数
// ================================

/**
 * 获取系统信息
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  try {
    const response = await invoke<ApiResponse<SystemInfo>>('get_system_info');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取系统信息失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取应用版本信息
 */
export async function getAppVersion(): Promise<AppVersionInfo> {
  try {
    const response = await invoke<ApiResponse<AppVersionInfo>>('get_app_version');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取应用版本失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 检查应用更新
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const response = await invoke<ApiResponse<UpdateInfo>>('check_for_updates');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '检查更新失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 重启应用
 */
export async function restartApp(): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('restart_app');
    
    if (!response.success) {
      throw new Error(response.error || '重启应用失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 退出应用
 */
export async function quitApp(): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('quit_app');
    
    if (!response.success) {
      throw new Error(response.error || '退出应用失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 在文件夹中显示文件
 */
export async function showInFolder(path: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('show_in_folder', {
      input: { path },
    });
    
    if (!response.success) {
      throw new Error(response.error || '打开文件夹失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 打开URL
 */
export async function openUrl(url: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('open_url', {
      input: { url },
    });
    
    if (!response.success) {
      throw new Error(response.error || '打开URL失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取应用数据路径
 */
export async function getAppDataPath(): Promise<string> {
  try {
    const response = await invoke<ApiResponse<string>>('get_app_data_path');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取应用数据路径失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取应用日志路径
 */
export async function getAppLogPath(): Promise<string> {
  try {
    const response = await invoke<ApiResponse<string>>('get_app_log_path');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取应用日志路径失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 设置开机自启动
 */
export async function setAutoStart(enabled: boolean): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('set_auto_start', {
      input: { enabled },
    });
    
    if (!response.success) {
      throw new Error(response.error || '设置开机自启动失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('copy_to_clipboard', {
      input: { text },
    });
    
    if (!response.success) {
      throw new Error(response.error || '复制到剪贴板失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 从剪贴板读取文本
 */
export async function readFromClipboard(): Promise<string> {
  try {
    const response = await invoke<ApiResponse<string>>('read_from_clipboard');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '从剪贴板读取失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// ================================
// 高级功能
// ================================

/**
 * 获取所有应用数据路径
 */
export async function getAllAppDataPaths(): Promise<AppDataPaths> {
  try {
    const [dataDir, configDir, cacheDir, logDir, tempDir, downloadDir, documentsDir, desktopDir] = await Promise.all([
      getAppDataPath(),
      invoke<ApiResponse<string>>('get_config_path').then(r => r.data || ''),
      invoke<ApiResponse<string>>('get_cache_path').then(r => r.data || ''),
      getAppLogPath(),
      invoke<ApiResponse<string>>('get_temp_path').then(r => r.data || ''),
      invoke<ApiResponse<string>>('get_download_path').then(r => r.data || ''),
      invoke<ApiResponse<string>>('get_documents_path').then(r => r.data || ''),
      invoke<ApiResponse<string>>('get_desktop_path').then(r => r.data || ''),
    ]);
    
    return {
      data_dir: dataDir,
      config_dir: configDir,
      cache_dir: cacheDir,
      log_dir: logDir,
      temp_dir: tempDir,
      download_dir: downloadDir,
      documents_dir: documentsDir,
      desktop_dir: desktopDir,
    };
  } catch (error) {
    throw new Error(`获取应用数据路径失败: ${error}`);
  }
}

/**
 * 获取系统性能指标
 */
export async function getSystemPerformanceMetrics(): Promise<SystemPerformanceMetrics> {
  try {
    const response = await invoke<ApiResponse<SystemPerformanceMetrics>>('get_system_performance_metrics');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取系统性能指标失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取系统事件日志
 */
export async function getSystemEventLog(limit?: number): Promise<SystemEvent[]> {
  try {
    const response = await invoke<ApiResponse<SystemEvent[]>>('get_system_event_log', {
      input: { limit },
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取系统事件日志失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 清理系统缓存
 */
export async function clearSystemCache(): Promise<{ cleared_bytes: number }> {
  try {
    const response = await invoke<ApiResponse<{ cleared_bytes: number }>>('clear_system_cache');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '清理系统缓存失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取系统健康状态
 */
export async function getSystemHealthStatus(): Promise<{
  healthy: boolean;
  issues: string[];
  recommendations: string[];
}> {
  try {
    const [systemInfo, performanceMetrics] = await Promise.all([
      getSystemInfo(),
      getSystemPerformanceMetrics(),
    ]);
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 检查内存使用率
    if (performanceMetrics.memory_usage_percent > 90) {
      issues.push('内存使用率过高');
      recommendations.push('关闭不必要的应用程序以释放内存');
    }
    
    // 检查磁盘使用率
    if (performanceMetrics.disk_usage_percent > 90) {
      issues.push('磁盘空间不足');
      recommendations.push('清理磁盘空间或删除不必要的文件');
    }
    
    // 检查CPU使用率
    if (performanceMetrics.cpu_usage_percent > 95) {
      issues.push('CPU使用率过高');
      recommendations.push('检查是否有异常进程占用CPU资源');
    }
    
    // 检查系统负载
    if (performanceMetrics.load_average.one_minute > systemInfo.cpu.cores * 2) {
      issues.push('系统负载过高');
      recommendations.push('系统负载过高，建议重启或关闭部分应用');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  } catch (error) {
    throw new Error(`获取系统健康状态失败: ${error}`);
  }
}

// ================================
// 辅助函数
// ================================

/**
 * 规范化错误对象
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  
  const message = typeof error === 'string' ? error : '未知错误';
  return new Error(message);
}

/**
 * 验证URL格式
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL不能为空' };
  }
  
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: '无效的URL格式' };
  }
}

/**
 * 验证文件路径
 */
export function validateFilePath(path: string): { valid: boolean; error?: string } {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: '文件路径不能为空' };
  }
  
  if (path.trim().length === 0) {
    return { valid: false, error: '文件路径不能为空' };
  }
  
  // 检查路径是否包含非法字符
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(path)) {
    return { valid: false, error: '文件路径包含非法字符' };
  }
  
  return { valid: true };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 格式化时间
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟${secs}秒`;
  } else if (minutes > 0) {
    return `${minutes}分钟${secs}秒`;
  } else {
    return `${secs}秒`;
  }
}

/**
 * 格式化系统运行时间
 */
export function formatUptime(uptimeSeconds: number): string {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}天${hours}小时${minutes}分钟`;
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

/**
 * 比较版本号
 */
export function compareVersions(version1: string, version2: string): number {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  
  return 0;
}

/**
 * 检查是否为更新版本
 */
export function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
  return compareVersions(latestVersion, currentVersion) > 0;
}

/**
 * 获取操作系统类型
 */
export function getOperatingSystemType(osName: string): 'windows' | 'macos' | 'linux' | 'unknown' {
  const os = osName.toLowerCase();
  
  if (os.includes('windows')) return 'windows';
  if (os.includes('mac') || os.includes('darwin')) return 'macos';
  if (os.includes('linux')) return 'linux';
  
  return 'unknown';
}

/**
 * 检查系统要求
 */
export function checkSystemRequirements(
  systemInfo: SystemInfo,
  requirements: {
    minMemoryMB?: number;
    minCpuCores?: number;
    supportedOS?: string[];
  }
): { meets: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // 检查内存要求
  if (requirements.minMemoryMB && systemInfo.memory.total_mb < requirements.minMemoryMB) {
    issues.push(`内存不足: 需要 ${requirements.minMemoryMB}MB，当前 ${systemInfo.memory.total_mb}MB`);
  }
  
  // 检查CPU核心数要求
  if (requirements.minCpuCores && systemInfo.cpu.cores < requirements.minCpuCores) {
    issues.push(`CPU核心数不足: 需要 ${requirements.minCpuCores} 核，当前 ${systemInfo.cpu.cores} 核`);
  }
  
  // 检查操作系统支持
  if (requirements.supportedOS && !requirements.supportedOS.includes(systemInfo.os_name)) {
    issues.push(`不支持的操作系统: ${systemInfo.os_name}`);
  }
  
  return {
    meets: issues.length === 0,
    issues,
  };
}

// ================================
// 导出
// ================================

export const SystemAPI = {
  // 基础操作
  getSystemInfo,
  getAppVersion,
  checkForUpdates,
  restartApp,
  quitApp,
  showInFolder,
  openUrl,
  getAppDataPath,
  getAppLogPath,
  setAutoStart,
  copyToClipboard,
  readFromClipboard,
  
  // 高级功能
  getAllAppDataPaths,
  getSystemPerformanceMetrics,
  getSystemEventLog,
  clearSystemCache,
  getSystemHealthStatus,
  
  // 工具函数
  validateUrl,
  validateFilePath,
  formatFileSize,
  formatDuration,
  formatUptime,
  compareVersions,
  isNewerVersion,
  getOperatingSystemType,
  checkSystemRequirements,
  normalizeError,
};

export default SystemAPI;
