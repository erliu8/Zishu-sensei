/**
 * 更新系统类型定义
 * 
 * 定义了应用更新相关的所有类型和接口
 */

/**
 * 更新状态枚举
 */
export enum UpdateStatus {
  /** 无更新可用 */
  None = "None",
  /** 有更新可用 */
  Available = "Available",
  /** 正在下载 */
  Downloading = "Downloading",
  /** 已下载，待安装 */
  Downloaded = "Downloaded",
  /** 正在安装 */
  Installing = "Installing",
  /** 安装完成 */
  Installed = "Installed",
  /** 更新失败 */
  Failed = "Failed",
  /** 已暂停 */
  Paused = "Paused",
  /** 已取消 */
  Cancelled = "Cancelled",
}

/**
 * 更新类型枚举
 */
export enum UpdateType {
  /** 主要版本更新（破坏性变更） */
  Major = "Major",
  /** 次要版本更新（新功能） */
  Minor = "Minor",
  /** 补丁更新（Bug修复） */
  Patch = "Patch",
  /** 热修复更新 */
  Hotfix = "Hotfix",
  /** 安全更新 */
  Security = "Security",
}

/**
 * 更新信息接口
 */
export interface UpdateInfo {
  /** 更新记录ID */
  id?: number;
  /** 版本号 */
  version: string;
  /** 更新类型 */
  update_type: UpdateType;
  /** 更新状态 */
  status: UpdateStatus;
  /** 更新标题 */
  title: string;
  /** 更新描述 */
  description: string;
  /** 更新日志（Markdown格式） */
  changelog: string;
  /** 发布时间 */
  release_date: string;
  /** 文件大小（字节） */
  file_size?: number;
  /** 下载URL */
  download_url?: string;
  /** 文件哈希（SHA256） */
  file_hash?: string;
  /** 是否是强制更新 */
  is_mandatory: boolean;
  /** 是否是预发布版本 */
  is_prerelease: boolean;
  /** 最小支持版本 */
  min_version?: string;
  /** 目标平台 */
  target_platform?: string;
  /** 目标架构 */
  target_arch?: string;
  /** 下载进度（0-100） */
  download_progress: number;
  /** 安装进度（0-100） */
  install_progress: number;
  /** 错误信息 */
  error_message?: string;
  /** 重试次数 */
  retry_count: number;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 版本历史记录接口
 */
export interface VersionHistory {
  /** 记录ID */
  id?: number;
  /** 版本号 */
  version: string;
  /** 安装时间 */
  installed_at: string;
  /** 是否是回滚操作安装的 */
  is_rollback: boolean;
  /** 安装来源（auto/manual/rollback） */
  install_source: string;
  /** 备注信息 */
  notes?: string;
}

/**
 * 更新配置接口
 */
export interface UpdateConfig {
  /** 配置ID */
  id?: number;
  /** 是否启用自动检查更新 */
  auto_check_enabled: boolean;
  /** 检查更新间隔（小时） */
  check_interval_hours: number;
  /** 是否自动下载更新 */
  auto_download_enabled: boolean;
  /** 是否自动安装更新 */
  auto_install_enabled: boolean;
  /** 是否包含预发布版本 */
  include_prerelease: boolean;
  /** 更新通道（stable/beta/alpha） */
  update_channel: string;
  /** 允许的网络类型（wifi/cellular/all） */
  allowed_network_types: string;
  /** 最大下载重试次数 */
  max_retry_count: number;
  /** 下载超时时间（秒） */
  download_timeout_seconds: number;
  /** 是否在更新前备份 */
  backup_before_update: boolean;
  /** 最大备份保留数量 */
  max_backup_count: number;
  /** 上次检查时间 */
  last_check_time?: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 更新检查结果接口
 */
export interface UpdateCheckResult {
  /** 是否有更新 */
  has_update: boolean;
  /** 更新信息 */
  update_info?: UpdateInfo;
  /** 错误信息 */
  error?: string;
}

/**
 * 下载进度信息接口
 */
export interface DownloadProgress {
  /** 版本号 */
  version: string;
  /** 已下载字节数 */
  downloaded: number;
  /** 总字节数 */
  total?: number;
  /** 下载百分比 */
  percentage: number;
}

/**
 * 安装进度信息接口
 */
export interface InstallProgress {
  /** 版本号 */
  version: string;
  /** 安装百分比 */
  percentage: number;
  /** 进度消息 */
  message: string;
}

/**
 * 更新事件类型
 */
export type UpdateEvent = 
  | { type: "CheckStarted" }
  | { type: "CheckCompleted"; data: { has_update: boolean; update_info?: UpdateInfo } }
  | { type: "CheckFailed"; data: { error: string } }
  | { type: "DownloadStarted"; data: { version: string; total_size?: number } }
  | { type: "DownloadProgress"; data: { version: string; downloaded: number; total?: number; percentage: number } }
  | { type: "DownloadCompleted"; data: { version: string; file_path: string } }
  | { type: "DownloadFailed"; data: { version: string; error: string } }
  | { type: "InstallStarted"; data: { version: string } }
  | { type: "InstallProgress"; data: { version: string; percentage: number; message: string } }
  | { type: "InstallCompleted"; data: { version: string; needs_restart: boolean } }
  | { type: "InstallFailed"; data: { version: string; error: string } }
  | { type: "RollbackStarted"; data: { from_version: string; to_version: string } }
  | { type: "RollbackCompleted"; data: { version: string } }
  | { type: "RollbackFailed"; data: { error: string } };

/**
 * 更新统计信息接口
 */
export interface UpdateStats {
  /** 总更新数 */
  total_updates: number;
  /** 成功安装数 */
  installed_updates: number;
  /** 失败数 */
  failed_updates: number;
  /** 版本历史数 */
  version_count: number;
}

/**
 * 更新状态显示文本映射
 */
export const UpdateStatusText: Record<UpdateStatus, string> = {
  [UpdateStatus.None]: "无更新",
  [UpdateStatus.Available]: "有更新可用",
  [UpdateStatus.Downloading]: "下载中",
  [UpdateStatus.Downloaded]: "已下载",
  [UpdateStatus.Installing]: "安装中",
  [UpdateStatus.Installed]: "已安装",
  [UpdateStatus.Failed]: "更新失败",
  [UpdateStatus.Paused]: "已暂停",
  [UpdateStatus.Cancelled]: "已取消",
};

/**
 * 更新类型显示文本映射
 */
export const UpdateTypeText: Record<UpdateType, string> = {
  [UpdateType.Major]: "主要版本",
  [UpdateType.Minor]: "功能更新",
  [UpdateType.Patch]: "Bug修复",
  [UpdateType.Hotfix]: "热修复",
  [UpdateType.Security]: "安全更新",
};

/**
 * 更新类型颜色映射
 */
export const UpdateTypeColor: Record<UpdateType, string> = {
  [UpdateType.Major]: "destructive",
  [UpdateType.Minor]: "default",
  [UpdateType.Patch]: "secondary",
  [UpdateType.Hotfix]: "outline",
  [UpdateType.Security]: "destructive",
};

/**
 * 更新状态颜色映射
 */
export const UpdateStatusColor: Record<UpdateStatus, string> = {
  [UpdateStatus.None]: "secondary",
  [UpdateStatus.Available]: "default",
  [UpdateStatus.Downloading]: "default",
  [UpdateStatus.Downloaded]: "secondary",
  [UpdateStatus.Installing]: "default",
  [UpdateStatus.Installed]: "default",
  [UpdateStatus.Failed]: "destructive",
  [UpdateStatus.Paused]: "outline",
  [UpdateStatus.Cancelled]: "outline",
};

/**
 * 默认更新配置
 */
export const defaultUpdateConfig: Partial<UpdateConfig> = {
  auto_check_enabled: true,
  check_interval_hours: 24,
  auto_download_enabled: false,
  auto_install_enabled: false,
  include_prerelease: false,
  update_channel: "stable",
  allowed_network_types: "all",
  max_retry_count: 3,
  download_timeout_seconds: 300,
  backup_before_update: true,
  max_backup_count: 3,
};

/**
 * 更新通道选项
 */
export const updateChannelOptions = [
  { value: "stable", label: "稳定版" },
  { value: "beta", label: "测试版" },
  { value: "alpha", label: "内测版" },
];

/**
 * 网络类型选项
 */
export const networkTypeOptions = [
  { value: "all", label: "所有网络" },
  { value: "wifi", label: "仅WiFi" },
  { value: "cellular", label: "仅移动网络" },
];

/**
 * 检查间隔选项（小时）
 */
export const checkIntervalOptions = [
  { value: 1, label: "每小时" },
  { value: 6, label: "每6小时" },
  { value: 12, label: "每12小时" },
  { value: 24, label: "每天" },
  { value: 168, label: "每周" },
  { value: 720, label: "每月" },
];

/**
 * 工具函数：格式化文件大小
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "未知";
  
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * 工具函数：格式化下载速度
 */
export const formatDownloadSpeed = (bytesPerSecond: number): string => {
  return `${formatFileSize(bytesPerSecond)}/s`;
};

/**
 * 工具函数：计算剩余时间
 */
export const calculateRemainingTime = (downloaded: number, total: number, speed: number): string => {
  if (speed <= 0 || !total) return "未知";
  
  const remaining = total - downloaded;
  const seconds = remaining / speed;
  
  if (seconds < 60) {
    return `${Math.round(seconds)}秒`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}分钟`;
  } else {
    return `${Math.round(seconds / 3600)}小时`;
  }
};

/**
 * 工具函数：比较版本号
 */
export const compareVersions = (version1: string, version2: string): number => {
  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
};

/**
 * 工具函数：检查是否是新版本
 */
export const isNewerVersion = (current: string, target: string): boolean => {
  return compareVersions(target, current) > 0;
};

/**
 * 工具函数：解析版本号
 */
export const parseVersion = (version: string): { major: number; minor: number; patch: number } => {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
};

/**
 * 工具函数：获取更新类型
 */
export const getUpdateType = (current: string, target: string): UpdateType => {
  const currentParts = parseVersion(current);
  const targetParts = parseVersion(target);
  
  if (targetParts.major > currentParts.major) {
    return UpdateType.Major;
  } else if (targetParts.minor > currentParts.minor) {
    return UpdateType.Minor;
  } else {
    return UpdateType.Patch;
  }
};

/**
 * 工具函数：格式化时间
 */
export const formatDateTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

/**
 * 工具函数：格式化相对时间
 */
export const formatRelativeTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) {
      return "刚刚";
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return formatDateTime(dateStr);
    }
  } catch {
    return dateStr;
  }
};

/**
 * 工具函数：检查更新是否可用
 */
export const isUpdateAvailable = (updateInfo?: UpdateInfo): boolean => {
  return updateInfo?.status === UpdateStatus.Available;
};

/**
 * 工具函数：检查更新是否正在进行
 */
export const isUpdateInProgress = (updateInfo?: UpdateInfo): boolean => {
  return updateInfo?.status === UpdateStatus.Downloading || 
         updateInfo?.status === UpdateStatus.Installing;
};

/**
 * 工具函数：检查更新是否已完成
 */
export const isUpdateCompleted = (updateInfo?: UpdateInfo): boolean => {
  return updateInfo?.status === UpdateStatus.Installed;
};

/**
 * 工具函数：检查更新是否失败
 */
export const isUpdateFailed = (updateInfo?: UpdateInfo): boolean => {
  return updateInfo?.status === UpdateStatus.Failed;
};
