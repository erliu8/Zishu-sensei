/**
 * 更新服务
 * 
 * 封装更新相关的 Tauri 命令调用，提供类型安全的更新功能
 */

import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { 
  UpdateInfo, 
  UpdateConfig, 
  VersionHistory, 
  UpdateCheckResult, 
  UpdateEvent,
  UpdateStats 
} from '../types/update';

/**
 * 更新服务类
 */
export class UpdateService {
  private static instance: UpdateService;
  private eventUnlisteners: UnlistenFn[] = [];
  private isInitialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * 初始化更新管理器
   */
  async initialize(): Promise<boolean> {
    try {
      const result = await invoke<boolean>('init_update_manager');
      this.isInitialized = result;
      
      if (result) {
        // 启动事件监听
        await this.startEventListener();
      }
      
      return result;
    } catch (error) {
      console.error('Failed to initialize update manager:', error);
      throw error;
    }
  }

  /**
   * 检查是否已初始化
   */
  getInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 检查更新
   */
  async checkForUpdates(force = false): Promise<UpdateCheckResult> {
    try {
      return await invoke<UpdateCheckResult>('check_for_updates', { force });
    } catch (error) {
      console.error('Failed to check for updates:', error);
      throw error;
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate(version: string): Promise<string> {
    try {
      return await invoke<string>('download_update', { version });
    } catch (error) {
      console.error('Failed to download update:', error);
      throw error;
    }
  }

  /**
   * 安装更新
   */
  async installUpdate(version: string): Promise<boolean> {
    try {
      return await invoke<boolean>('install_update', { version });
    } catch (error) {
      console.error('Failed to install update:', error);
      throw error;
    }
  }

  /**
   * 使用 Tauri 内置更新器安装更新
   */
  async installUpdateWithTauri(): Promise<boolean> {
    try {
      return await invoke<boolean>('install_update_with_tauri');
    } catch (error) {
      console.error('Failed to install update with Tauri:', error);
      throw error;
    }
  }

  /**
   * 取消下载
   */
  async cancelDownload(version: string): Promise<boolean> {
    try {
      return await invoke<boolean>('cancel_download', { version });
    } catch (error) {
      console.error('Failed to cancel download:', error);
      throw error;
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(version: string): Promise<boolean> {
    try {
      return await invoke<boolean>('rollback_to_version', { version });
    } catch (error) {
      console.error('Failed to rollback to version:', error);
      throw error;
    }
  }

  /**
   * 获取更新配置
   */
  async getUpdateConfig(): Promise<UpdateConfig> {
    try {
      return await invoke<UpdateConfig>('get_update_config');
    } catch (error) {
      console.error('Failed to get update config:', error);
      throw error;
    }
  }

  /**
   * 保存更新配置
   */
  async saveUpdateConfig(config: UpdateConfig): Promise<boolean> {
    try {
      return await invoke<boolean>('save_update_config', { config });
    } catch (error) {
      console.error('Failed to save update config:', error);
      throw error;
    }
  }

  /**
   * 获取版本历史
   */
  async getVersionHistory(): Promise<VersionHistory[]> {
    try {
      return await invoke<VersionHistory[]>('get_version_history');
    } catch (error) {
      console.error('Failed to get version history:', error);
      throw error;
    }
  }

  /**
   * 获取更新统计
   */
  async getUpdateStats(): Promise<Record<string, number>> {
    try {
      return await invoke<Record<string, number>>('get_update_stats');
    } catch (error) {
      console.error('Failed to get update stats:', error);
      throw error;
    }
  }

  /**
   * 清理旧文件
   */
  async cleanupOldFiles(): Promise<boolean> {
    try {
      return await invoke<boolean>('cleanup_old_files');
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
      throw error;
    }
  }

  /**
   * 重启应用
   */
  async restartApplication(): Promise<boolean> {
    try {
      return await invoke<boolean>('restart_application');
    } catch (error) {
      console.error('Failed to restart application:', error);
      throw error;
    }
  }

  /**
   * 检查 Tauri 更新器是否可用
   */
  async checkTauriUpdaterAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>('check_tauri_updater_available');
    } catch (error) {
      console.error('Failed to check Tauri updater availability:', error);
      throw error;
    }
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(): Promise<string> {
    try {
      return await invoke<string>('get_current_version');
    } catch (error) {
      console.error('Failed to get current version:', error);
      throw error;
    }
  }

  /**
   * 启动事件监听器
   */
  private async startEventListener(): Promise<void> {
    try {
      await invoke<boolean>('listen_update_events');
    } catch (error) {
      console.error('Failed to start update event listener:', error);
    }
  }

  /**
   * 监听更新事件
   */
  async onUpdateEvent(callback: (event: UpdateEvent) => void): Promise<UnlistenFn> {
    const unlisten = await listen<UpdateEvent>('update-event', (event) => {
      callback(event.payload);
    });
    
    this.eventUnlisteners.push(unlisten);
    return unlisten;
  }

  /**
   * 移除所有事件监听器
   */
  removeAllEventListeners(): void {
    this.eventUnlisteners.forEach(unlisten => unlisten());
    this.eventUnlisteners = [];
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.removeAllEventListeners();
    this.isInitialized = false;
  }
}

/**
 * 更新服务实例
 */
export const updateService = UpdateService.getInstance();

/**
 * 更新操作封装类
 */
export class UpdateOperations {
  constructor(private service: UpdateService) {}

  /**
   * 执行完整的更新流程
   */
  async performFullUpdate(version: string, onProgress?: (event: UpdateEvent) => void): Promise<boolean> {
    let progressCallback: ((event: UpdateEvent) => void) | undefined;
    
    if (onProgress) {
      progressCallback = onProgress;
      await this.service.onUpdateEvent(progressCallback);
    }

    try {
      // 1. 下载更新
      await this.service.downloadUpdate(version);
      
      // 2. 安装更新
      const needsRestart = await this.service.installUpdate(version);
      
      // 3. 如果需要重启，提示用户
      if (needsRestart) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Full update failed:', error);
      throw error;
    }
  }

  /**
   * 自动更新流程
   */
  async performAutoUpdate(): Promise<{ hasUpdate: boolean; needsRestart: boolean }> {
    try {
      // 1. 检查配置
      const config = await this.service.getUpdateConfig();
      if (!config.auto_check_enabled) {
        return { hasUpdate: false, needsRestart: false };
      }

      // 2. 检查更新
      const checkResult = await this.service.checkForUpdates();
      if (!checkResult.has_update || !checkResult.update_info) {
        return { hasUpdate: false, needsRestart: false };
      }

      const updateInfo = checkResult.update_info;

      // 3. 如果启用了自动下载，则下载
      if (config.auto_download_enabled) {
        await this.service.downloadUpdate(updateInfo.version);
      }

      // 4. 如果启用了自动安装，则安装
      if (config.auto_install_enabled) {
        const needsRestart = await this.service.installUpdate(updateInfo.version);
        return { hasUpdate: true, needsRestart };
      }

      return { hasUpdate: true, needsRestart: false };
    } catch (error) {
      console.error('Auto update failed:', error);
      throw error;
    }
  }

  /**
   * 批量清理操作
   */
  async performMaintenance(): Promise<void> {
    try {
      await this.service.cleanupOldFiles();
      console.log('Maintenance completed successfully');
    } catch (error) {
      console.error('Maintenance failed:', error);
      throw error;
    }
  }
}

/**
 * 更新操作实例
 */
export const updateOperations = new UpdateOperations(updateService);

/**
 * 更新工具函数集合
 */
export const updateUtils = {
  /**
   * 初始化更新系统
   */
  async initializeUpdateSystem(): Promise<boolean> {
    try {
      const result = await updateService.initialize();
      if (result) {
        console.log('Update system initialized successfully');
      }
      return result;
    } catch (error) {
      console.error('Failed to initialize update system:', error);
      return false;
    }
  },

  /**
   * 检查是否有更新可用
   */
  async hasUpdateAvailable(): Promise<boolean> {
    try {
      const result = await updateService.checkForUpdates();
      return result.has_update;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  },

  /**
   * 获取更新摘要信息
   */
  async getUpdateSummary(): Promise<{
    currentVersion: string;
    latestVersion?: string;
    hasUpdate: boolean;
    updateInfo?: UpdateInfo;
  }> {
    try {
      const [currentVersion, checkResult] = await Promise.all([
        updateService.getCurrentVersion(),
        updateService.checkForUpdates(),
      ]);

      return {
        currentVersion,
        latestVersion: checkResult.update_info?.version,
        hasUpdate: checkResult.has_update,
        updateInfo: checkResult.update_info,
      };
    } catch (error) {
      console.error('Failed to get update summary:', error);
      const currentVersion = await updateService.getCurrentVersion().catch(() => 'Unknown');
      return {
        currentVersion,
        hasUpdate: false,
      };
    }
  },

  /**
   * 验证更新配置
   */
  validateUpdateConfig(config: Partial<UpdateConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.check_interval_hours !== undefined) {
      if (config.check_interval_hours < 1) {
        errors.push('检查间隔不能小于 1 小时');
      }
      if (config.check_interval_hours > 8760) { // 1年
        errors.push('检查间隔不能超过 1 年');
      }
    }

    if (config.max_retry_count !== undefined) {
      if (config.max_retry_count < 0) {
        errors.push('重试次数不能为负数');
      }
      if (config.max_retry_count > 10) {
        errors.push('重试次数不能超过 10 次');
      }
    }

    if (config.download_timeout_seconds !== undefined) {
      if (config.download_timeout_seconds < 30) {
        errors.push('下载超时时间不能小于 30 秒');
      }
      if (config.download_timeout_seconds > 3600) {
        errors.push('下载超时时间不能超过 1 小时');
      }
    }

    if (config.max_backup_count !== undefined) {
      if (config.max_backup_count < 1) {
        errors.push('备份保留数量不能小于 1');
      }
      if (config.max_backup_count > 10) {
        errors.push('备份保留数量不能超过 10');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * 格式化更新统计信息
   */
  async getFormattedStats(): Promise<UpdateStats> {
    try {
      const rawStats = await updateService.getUpdateStats();
      return {
        total_updates: rawStats.total_updates || 0,
        installed_updates: rawStats.installed_updates || 0,
        failed_updates: rawStats.failed_updates || 0,
        version_count: rawStats.version_count || 0,
      };
    } catch (error) {
      console.error('Failed to get formatted stats:', error);
      return {
        total_updates: 0,
        installed_updates: 0,
        failed_updates: 0,
        version_count: 0,
      };
    }
  },
};

// 导出默认实例
export default updateService;
