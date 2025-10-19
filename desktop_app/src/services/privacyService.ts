/**
 * 隐私管理服务
 * 提供与后端隐私管理功能的接口
 */

import { invoke } from '@tauri-apps/api/tauri';
import type {
  PrivacySettings,
  ExportOptions,
  ExportedData,
  CleanupOptions,
  CleanupResult,
  PrivacyAuditLog,
  ConsentRecord,
} from '../types/privacy';

/**
 * 隐私管理服务类
 */
export class PrivacyService {
  /**
   * 获取当前隐私设置
   */
  static async getPrivacySettings(): Promise<PrivacySettings> {
    return await invoke<PrivacySettings>('get_privacy_settings');
  }

  /**
   * 更新隐私设置
   */
  static async updatePrivacySettings(
    settings: PrivacySettings
  ): Promise<void> {
    await invoke('update_privacy_settings', { settings });
  }

  /**
   * 导出用户数据
   */
  static async exportData(
    options: ExportOptions
  ): Promise<ExportedData> {
    return await invoke<ExportedData>('export_user_data', { options });
  }

  /**
   * 导出数据到文件
   */
  static async exportUserDataToFile(
    options: ExportOptions,
    filePath: string
  ): Promise<void> {
    await invoke('export_user_data_to_file', { options, filePath });
  }

  /**
   * 清理用户数据
   */
  static async cleanupData(
    options?: CleanupOptions
  ): Promise<CleanupResult> {
    if (options) {
      return await invoke<CleanupResult>('cleanup_user_data', { options });
    }
    return await invoke<CleanupResult>('delete_all_user_data');
  }

  /**
   * 删除所有用户数据
   */
  static async deleteAllUserData(): Promise<CleanupResult> {
    return await invoke<CleanupResult>('delete_all_user_data');
  }

  /**
   * 匿名化用户数据
   */
  static async anonymizeUserData(fields: string[]): Promise<void> {
    await invoke('anonymize_user_data', { fields });
  }

  /**
   * 获取隐私审计日志
   */
  static async getPrivacyAuditLogs(
    limit?: number
  ): Promise<PrivacyAuditLog[]> {
    return await invoke<PrivacyAuditLog[]>('get_privacy_audit_logs', {
      limit: limit || 100,
    });
  }

  /**
   * 执行自动数据清理
   */
  static async runAutoCleanup(): Promise<CleanupResult> {
    return await invoke<CleanupResult>('run_auto_cleanup');
  }

  /**
   * 检查用户是否已同意隐私政策
   */
  static async hasUserConsented(): Promise<boolean> {
    try {
      const settings = await this.getPrivacySettings();
      // 如果已经有设置，认为用户已经同意过
      return settings.dataCollectionEnabled !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * 记录用户同意
   */
  static async recordConsent(
    consentData: Omit<ConsentRecord, 'id' | 'timestamp'>
  ): Promise<void> {
    // 更新隐私设置以反映用户的选择
    const settings = await this.getPrivacySettings();
    settings.dataCollectionEnabled = consentData.dataCollection;
    settings.analyticsEnabled = consentData.analytics;
    settings.crashReportsEnabled = consentData.crashReports;
    settings.lastUpdated = new Date().toISOString();
    await this.updatePrivacySettings(settings);
  }
}

export default PrivacyService;

