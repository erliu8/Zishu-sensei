/**
 * Packaging Task Domain Model
 * 打包任务领域模型
 */

import type { PackagingTask, PackagingStatus } from './packaging.types';

/**
 * PackagingTask Domain 类
 */
export class PackagingTaskDomain {
  /**
   * 检查任务是否完成
   */
  static isCompleted(task: PackagingTask): boolean {
    return task.status === 'completed';
  }

  /**
   * 检查任务是否失败
   */
  static isFailed(task: PackagingTask): boolean {
    return task.status === 'failed';
  }

  /**
   * 检查任务是否进行中
   */
  static isInProgress(task: PackagingTask): boolean {
    return task.status === 'packaging' || task.status === 'queued';
  }

  /**
   * 检查任务是否可取消
   */
  static isCancellable(task: PackagingTask): boolean {
    return task.status === 'pending' || task.status === 'queued' || task.status === 'packaging';
  }

  /**
   * 检查任务是否可下载
   */
  static isDownloadable(task: PackagingTask): boolean {
    return (
      task.status === 'completed' &&
      !!task.downloadUrl &&
      (!task.expiresAt || new Date(task.expiresAt) > new Date())
    );
  }

  /**
   * 检查任务是否已过期
   */
  static isExpired(task: PackagingTask): boolean {
    return task.expiresAt ? new Date(task.expiresAt) < new Date() : false;
  }

  /**
   * 获取任务持续时间（秒）
   */
  static getDuration(task: PackagingTask): number | null {
    if (!task.startedAt) return null;
    
    const endTime = task.completedAt ? new Date(task.completedAt) : new Date();
    const startTime = new Date(task.startedAt);
    
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  }

  /**
   * 格式化持续时间
   */
  static formatDuration(task: PackagingTask): string {
    const duration = this.getDuration(task);
    if (duration === null) return '未开始';

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`;
    }
    return `${seconds}秒`;
  }

  /**
   * 获取剩余时间（秒）
   */
  static getRemainingTime(task: PackagingTask): number | null {
    if (!task.expiresAt) return null;
    
    const now = new Date();
    const expiresAt = new Date(task.expiresAt);
    const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    
    return remaining > 0 ? remaining : 0;
  }

  /**
   * 格式化剩余时间
   */
  static formatRemainingTime(task: PackagingTask): string {
    const remaining = this.getRemainingTime(task);
    if (remaining === null) return '永久有效';
    if (remaining === 0) return '已过期';

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (days > 0) {
      return `${days}天${hours}小时`;
    }
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes?: number): string {
    if (!bytes) return '未知';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 获取状态显示文本
   */
  static getStatusText(status: PackagingStatus): string {
    const statusTexts: Record<PackagingStatus, string> = {
      pending: '等待中',
      queued: '队列中',
      packaging: '打包中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    };

    return statusTexts[status] || status;
  }

  /**
   * 获取状态颜色
   */
  static getStatusColor(status: PackagingStatus): string {
    const statusColors: Record<PackagingStatus, string> = {
      pending: 'gray',
      queued: 'blue',
      packaging: 'yellow',
      completed: 'green',
      failed: 'red',
      cancelled: 'gray',
    };

    return statusColors[status] || 'gray';
  }

  /**
   * 获取进度百分比文本
   */
  static getProgressText(task: PackagingTask): string {
    if (task.totalSteps && task.currentStep) {
      return `${task.currentStep} (${task.progress}%)`;
    }
    return `${task.progress}%`;
  }

  /**
   * 估算剩余时间（基于当前进度）
   */
  static estimateRemainingDuration(task: PackagingTask): number | null {
    if (!task.startedAt || task.progress === 0) return null;

    const duration = this.getDuration(task);
    if (duration === null) return null;

    const estimatedTotal = (duration / task.progress) * 100;
    const remaining = estimatedTotal - duration;

    return Math.max(0, Math.floor(remaining));
  }

  /**
   * 格式化估算剩余时间
   */
  static formatEstimatedRemaining(task: PackagingTask): string {
    const remaining = this.estimateRemainingDuration(task);
    if (remaining === null) return '计算中...';
    if (remaining === 0) return '即将完成';

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    if (minutes > 0) {
      return `约 ${minutes} 分钟`;
    }
    return `约 ${seconds} 秒`;
  }

  /**
   * 验证任务是否可以重试
   */
  static canRetry(task: PackagingTask): boolean {
    return task.status === 'failed' || task.status === 'cancelled';
  }

  /**
   * 获取任务摘要
   */
  static getSummary(task: PackagingTask): string {
    const { config } = task;
    return `${config.appName} v${config.version} - ${config.platform}/${config.architecture}`;
  }
}

