/**
 * 适配器管理服务
 * 
 * 管理本地已安装的适配器，包括版本、依赖和权限
 */

import { invoke } from '@tauri-apps/api/core';
import { CommandResponse } from './types';

// ================================
// 类型定义
// ================================

export enum AdapterInstallStatus {
  Downloading = 'Downloading',
  Installing = 'Installing',
  Installed = 'Installed',
  InstallFailed = 'InstallFailed',
  Updating = 'Updating',
  UpdateFailed = 'UpdateFailed',
  Uninstalling = 'Uninstalling',
  UninstallFailed = 'UninstallFailed',
}

export interface InstalledAdapter {
  id: string;
  name: string;
  display_name: string;
  version: string;
  install_path: string;
  status: AdapterInstallStatus;
  enabled: boolean;
  auto_update: boolean;
  source: string;
  source_id?: string;
  description?: string;
  author?: string;
  license?: string;
  homepage_url?: string;
  installed_at: string;
  updated_at: string;
  last_used_at?: string;
  config: Record<string, any>;
  metadata: Record<string, any>;
}

export interface AdapterVersion {
  id: number;
  adapter_id: string;
  version: string;
  released_at: string;
  changelog?: string;
  download_url?: string;
  file_size?: number;
  checksum?: string;
  is_current: boolean;
}

export interface AdapterDependency {
  id: number;
  adapter_id: string;
  dependency_id: string;
  version_requirement: string;
  required: boolean;
}

export interface AdapterPermission {
  id: number;
  adapter_id: string;
  permission_type: string;
  granted: boolean;
  granted_at?: string;
  description?: string;
}

// ================================
// 适配器管理服务类
// ================================

export class AdapterManagementService {
  // ================================
  // 基础管理
  // ================================

  /**
   * 获取所有已安装的适配器
   */
  static async getInstalledAdapters(): Promise<InstalledAdapter[]> {
    try {
      const response = await invoke<CommandResponse<InstalledAdapter[]>>(
        'get_installed_adapters'
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取已安装适配器失败');
    } catch (error) {
      console.error('获取已安装适配器失败:', error);
      throw error;
    }
  }

  /**
   * 获取已启用的适配器
   */
  static async getEnabledAdapters(): Promise<InstalledAdapter[]> {
    try {
      const response = await invoke<CommandResponse<InstalledAdapter[]>>(
        'get_enabled_adapters'
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取已启用适配器失败');
    } catch (error) {
      console.error('获取已启用适配器失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个适配器详情
   */
  static async getInstalledAdapter(adapterId: string): Promise<InstalledAdapter> {
    try {
      const response = await invoke<CommandResponse<InstalledAdapter>>(
        'get_installed_adapter',
        { adapterId }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取适配器详情失败');
    } catch (error) {
      console.error('获取适配器详情失败:', error);
      throw error;
    }
  }

  /**
   * 启用/禁用适配器
   */
  static async toggleAdapter(adapterId: string, enabled: boolean): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'toggle_adapter',
        { adapterId, enabled }
      );
      
      if (response.success) {
        return true;
      }
      
      throw new Error(response.error || '操作失败');
    } catch (error) {
      console.error('切换适配器状态失败:', error);
      throw error;
    }
  }

  /**
   * 删除已安装的适配器
   */
  static async removeAdapter(adapterId: string): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'remove_installed_adapter',
        { adapterId }
      );
      
      if (response.success) {
        return true;
      }
      
      throw new Error(response.error || '删除适配器失败');
    } catch (error) {
      console.error('删除适配器失败:', error);
      throw error;
    }
  }

  // ================================
  // 版本管理
  // ================================

  /**
   * 获取适配器的版本历史
   */
  static async getAdapterVersions(adapterId: string): Promise<AdapterVersion[]> {
    try {
      const response = await invoke<CommandResponse<AdapterVersion[]>>(
        'get_adapter_versions',
        { adapterId }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取版本历史失败');
    } catch (error) {
      console.error('获取版本历史失败:', error);
      throw error;
    }
  }

  /**
   * 添加版本记录
   */
  static async addVersion(version: AdapterVersion): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'add_adapter_version',
        { version }
      );
      
      if (response.success) {
        return true;
      }
      
      throw new Error(response.error || '添加版本记录失败');
    } catch (error) {
      console.error('添加版本记录失败:', error);
      throw error;
    }
  }

  // ================================
  // 依赖管理
  // ================================

  /**
   * 获取适配器的依赖列表
   */
  static async getDependencies(adapterId: string): Promise<AdapterDependency[]> {
    try {
      const response = await invoke<CommandResponse<AdapterDependency[]>>(
        'get_adapter_dependencies',
        { adapterId }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取依赖列表失败');
    } catch (error) {
      console.error('获取依赖列表失败:', error);
      throw error;
    }
  }

  /**
   * 添加依赖
   */
  static async addDependency(dependency: AdapterDependency): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'add_adapter_dependency',
        { dependency }
      );
      
      if (response.success) {
        return true;
      }
      
      throw new Error(response.error || '添加依赖失败');
    } catch (error) {
      console.error('添加依赖失败:', error);
      throw error;
    }
  }

  /**
   * 删除依赖
   */
  static async removeDependency(adapterId: string, dependencyId: string): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'remove_adapter_dependency',
        { adapterId, dependencyId }
      );
      
      if (response.success) {
        return true;
      }
      
      throw new Error(response.error || '删除依赖失败');
    } catch (error) {
      console.error('删除依赖失败:', error);
      throw error;
    }
  }

  /**
   * 检查依赖是否满足
   */
  static async checkDependencies(adapterId: string): Promise<{
    satisfied: boolean;
    missing: string[];
    conflicts: string[];
  }> {
    try {
      const dependencies = await this.getDependencies(adapterId);
      const installed = await this.getInstalledAdapters();
      
      const installedMap = new Map(installed.map(a => [a.id, a]));
      const missing: string[] = [];
      const conflicts: string[] = [];
      
      for (const dep of dependencies) {
        if (!dep.required) continue;
        
        const installedDep = installedMap.get(dep.dependency_id);
        if (!installedDep) {
          missing.push(dep.dependency_id);
        } else {
          // 这里应该使用 semver 进行版本比较
          // 简单实现：只检查是否安装
        }
      }
      
      return {
        satisfied: missing.length === 0 && conflicts.length === 0,
        missing,
        conflicts,
      };
    } catch (error) {
      console.error('检查依赖失败:', error);
      throw error;
    }
  }

  // ================================
  // 权限管理
  // ================================

  /**
   * 获取适配器的权限列表
   */
  static async getPermissions(adapterId: string): Promise<AdapterPermission[]> {
    try {
      const response = await invoke<CommandResponse<AdapterPermission[]>>(
        'get_adapter_permissions',
        { adapterId }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取权限列表失败');
    } catch (error) {
      console.error('获取权限列表失败:', error);
      throw error;
    }
  }

  /**
   * 授予/撤销权限
   */
  static async grantPermission(
    adapterId: string,
    permissionType: string,
    granted: boolean
  ): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'grant_adapter_permission',
        { adapterId, permissionType, granted }
      );
      
      if (response.success) {
        return true;
      }
      
      throw new Error(response.error || '权限操作失败');
    } catch (error) {
      console.error('权限操作失败:', error);
      throw error;
    }
  }

  /**
   * 检查权限
   */
  static async checkPermission(
    adapterId: string,
    permissionType: string
  ): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'check_adapter_permission',
        { adapterId, permissionType }
      );
      
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      
      throw new Error(response.error || '检查权限失败');
    } catch (error) {
      console.error('检查权限失败:', error);
      throw error;
    }
  }

  /**
   * 添加权限
   */
  static async addPermission(permission: AdapterPermission): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>(
        'add_adapter_permission',
        { permission }
      );
      
      if (response.success) {
        return true;
      }
      
      throw new Error(response.error || '添加权限失败');
    } catch (error) {
      console.error('添加权限失败:', error);
      throw error;
    }
  }

  // ================================
  // 工具方法
  // ================================

  /**
   * 格式化状态
   */
  static formatStatus(status: AdapterInstallStatus): string {
    const statusMap: Record<AdapterInstallStatus, string> = {
      [AdapterInstallStatus.Downloading]: '下载中',
      [AdapterInstallStatus.Installing]: '安装中',
      [AdapterInstallStatus.Installed]: '已安装',
      [AdapterInstallStatus.InstallFailed]: '安装失败',
      [AdapterInstallStatus.Updating]: '更新中',
      [AdapterInstallStatus.UpdateFailed]: '更新失败',
      [AdapterInstallStatus.Uninstalling]: '卸载中',
      [AdapterInstallStatus.UninstallFailed]: '卸载失败',
    };
    
    return statusMap[status] || '未知';
  }

  /**
   * 获取状态颜色
   */
  static getStatusColor(status: AdapterInstallStatus): string {
    const colorMap: Record<AdapterInstallStatus, string> = {
      [AdapterInstallStatus.Downloading]: 'text-blue-600',
      [AdapterInstallStatus.Installing]: 'text-blue-600',
      [AdapterInstallStatus.Installed]: 'text-green-600',
      [AdapterInstallStatus.InstallFailed]: 'text-red-600',
      [AdapterInstallStatus.Updating]: 'text-yellow-600',
      [AdapterInstallStatus.UpdateFailed]: 'text-red-600',
      [AdapterInstallStatus.Uninstalling]: 'text-orange-600',
      [AdapterInstallStatus.UninstallFailed]: 'text-red-600',
    };
    
    return colorMap[status] || 'text-gray-600';
  }

  /**
   * 格式化权限类型
   */
  static formatPermissionType(permissionType: string): string {
    const permissionMap: Record<string, string> = {
      file_read: '读取文件',
      file_write: '写入文件',
      network: '网络访问',
      system: '系统访问',
      clipboard: '剪贴板访问',
      camera: '摄像头',
      microphone: '麦克风',
      location: '位置信息',
    };
    
    return permissionMap[permissionType] || permissionType;
  }

  /**
   * 获取权限风险级别
   */
  static getPermissionRiskLevel(permissionType: string): 'low' | 'medium' | 'high' {
    const highRisk = ['file_write', 'system', 'clipboard'];
    const mediumRisk = ['file_read', 'network'];
    
    if (highRisk.includes(permissionType)) return 'high';
    if (mediumRisk.includes(permissionType)) return 'medium';
    return 'low';
  }

  /**
   * 获取权限风险颜色
   */
  static getPermissionRiskColor(permissionType: string): string {
    const level = this.getPermissionRiskLevel(permissionType);
    
    const colorMap = {
      low: 'text-green-600',
      medium: 'text-yellow-600',
      high: 'text-red-600',
    };
    
    return colorMap[level];
  }
}

export default AdapterManagementService;

