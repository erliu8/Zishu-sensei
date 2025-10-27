/**
 * Adapter Management Service
 * 
 * This service provides TypeScript interfaces for managing adapters (plugins/extensions)
 * in the Zishu Sensei desktop application.
 */

import { invoke } from '@tauri-apps/api/tauri';
import { CommandResponse, PaginatedResponse } from './types';

// ================================
// Type Definitions
// ================================

export enum AdapterStatus {
  Loaded = 'loaded',
  Unloaded = 'unloaded',
  Loading = 'loading',
  Unloading = 'unloading',
  Error = 'error',
  Unknown = 'unknown',
  Maintenance = 'maintenance',
}

export enum AdapterType {
  Soft = 'soft',
  Hard = 'hard',
  Intelligent = 'intelligent',
}

export enum CapabilityLevel {
  Basic = 'basic',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
  Expert = 'expert',
}

export interface AdapterCapability {
  name: string;
  description: string;
  level: CapabilityLevel;
  required_params: string[];
  optional_params: string[];
}

export interface AdapterResourceRequirements {
  min_memory_mb?: number;
  min_cpu_cores?: number;
  gpu_required: boolean;
  min_gpu_memory_mb?: number;
  python_version?: string;
  dependencies: string[];
}

export interface AdapterCompatibility {
  base_models: string[];
  frameworks: Record<string, string>;
  operating_systems: string[];
  python_versions: string[];
}

export interface AdapterMetadata {
  id: string;
  name: string;
  version: string;
  adapter_type: AdapterType;
  description?: string;
  author?: string;
  license?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  capabilities: AdapterCapability[];
  compatibility: AdapterCompatibility;
  resource_requirements: AdapterResourceRequirements;
  config_schema: Record<string, any>;
  default_config: Record<string, any>;
  file_size_bytes?: number;
  parameter_count?: number;
}

export interface AdapterInfo {
  name: string;
  path?: string;
  size?: number;
  version?: string;
  description?: string;
  status: AdapterStatus;
  load_time?: string;
  memory_usage?: number;
  config: Record<string, any>;
}

export interface AdapterInstallRequest {
  adapter_id: string;
  source: string;
  force: boolean;
  options: Record<string, any>;
}

export interface AdapterExecutionRequest {
  adapter_id: string;
  action: string;
  params: Record<string, any>;
  timeout?: number;
}

export interface AdapterConfigUpdateRequest {
  adapter_id: string;
  config: Record<string, any>;
  merge: boolean;
}

export interface AdapterSearchRequest {
  query: string;
  adapter_type?: AdapterType;
  category?: string;
  tags?: string[];
  price_min?: number;
  price_max?: number;
  rating_min?: number;
  free_only?: boolean;
  featured_only?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}

// ================================
// Service Class
// ================================

export class AdapterService {
  /**
   * Get list of installed adapters
   */
  static async getAdapters(): Promise<AdapterInfo[]> {
    try {
      const response = await invoke<CommandResponse<AdapterInfo[]>>('get_adapters');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to get adapters');
    } catch (error) {
      console.error('Error getting adapters:', error);
      throw error;
    }
  }

  /**
   * Install a new adapter
   */
  static async installAdapter(request: AdapterInstallRequest): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>('install_adapter', { request });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to install adapter');
    } catch (error) {
      console.error('Error installing adapter:', error);
      throw error;
    }
  }

  /**
   * Uninstall an adapter
   */
  static async uninstallAdapter(adapterId: string): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>('uninstall_adapter', { adapterId });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to uninstall adapter');
    } catch (error) {
      console.error('Error uninstalling adapter:', error);
      throw error;
    }
  }

  /**
   * Execute adapter action
   */
  static async executeAdapter(request: AdapterExecutionRequest): Promise<any> {
    try {
      const response = await invoke<CommandResponse<any>>('execute_adapter', { request });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to execute adapter action');
    } catch (error) {
      console.error('Error executing adapter:', error);
      throw error;
    }
  }

  /**
   * Get adapter configuration
   */
  static async getAdapterConfig(adapterId: string): Promise<Record<string, any>> {
    try {
      const response = await invoke<CommandResponse<Record<string, any>>>('get_adapter_config', { adapterId });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to get adapter config');
    } catch (error) {
      console.error('Error getting adapter config:', error);
      throw error;
    }
  }

  /**
   * Update adapter configuration
   */
  static async updateAdapterConfig(request: AdapterConfigUpdateRequest): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>('update_adapter_config', { request });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update adapter config');
    } catch (error) {
      console.error('Error updating adapter config:', error);
      throw error;
    }
  }

  /**
   * Search adapters in marketplace
   */
  static async searchAdapters(request: AdapterSearchRequest): Promise<PaginatedResponse<any>> {
    try {
      const response = await invoke<CommandResponse<PaginatedResponse<any>>>('search_adapters', { request });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to search adapters');
    } catch (error) {
      console.error('Error searching adapters:', error);
      throw error;
    }
  }

  /**
   * Get adapter details
   */
  static async getAdapterDetails(adapterId: string): Promise<AdapterMetadata> {
    try {
      const response = await invoke<CommandResponse<AdapterMetadata>>('get_adapter_details', { adapterId });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to get adapter details');
    } catch (error) {
      console.error('Error getting adapter details:', error);
      throw error;
    }
  }

  /**
   * Load adapter
   */
  static async loadAdapter(adapterId: string): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>('load_adapter', { adapterId });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to load adapter');
    } catch (error) {
      console.error('Error loading adapter:', error);
      throw error;
    }
  }

  /**
   * Unload adapter
   */
  static async unloadAdapter(adapterId: string): Promise<boolean> {
    try {
      const response = await invoke<CommandResponse<boolean>>('unload_adapter', { adapterId });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to unload adapter');
    } catch (error) {
      console.error('Error unloading adapter:', error);
      throw error;
    }
  }

  /**
   * Get adapter status
   */
  static async getAdapterStatus(adapterId?: string): Promise<any> {
    try {
      const response = await invoke<CommandResponse<any>>('get_adapter_status', { adapterId });
      if (response.success && response.data !== undefined) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to get adapter status');
    } catch (error) {
      console.error('Error getting adapter status:', error);
      throw error;
    }
  }

  // ================================
  // Utility Methods
  // ================================

  /**
   * Check if adapter is compatible with current system
   */
  static isCompatible(metadata: AdapterMetadata): boolean {
    const currentOS = navigator.platform.toLowerCase();
    const compatibleOS = metadata.compatibility.operating_systems.some(os => 
      currentOS.includes(os.toLowerCase())
    );
    
    // Add more compatibility checks as needed
    return compatibleOS;
  }

  /**
   * Format adapter size for display
   */
  static formatSize(bytes?: number): string {
    if (!bytes) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format adapter status for display
   */
  static formatStatus(status: AdapterStatus): string {
    const statusMap: Record<AdapterStatus, string> = {
      [AdapterStatus.Loaded]: '已加载',
      [AdapterStatus.Unloaded]: '未加载',
      [AdapterStatus.Loading]: '加载中',
      [AdapterStatus.Unloading]: '卸载中',
      [AdapterStatus.Error]: '错误',
      [AdapterStatus.Unknown]: '未知',
      [AdapterStatus.Maintenance]: '维护中',
    };
    
    return statusMap[status] || '未知';
  }

  /**
   * Get status color for UI
   */
  static getStatusColor(status: AdapterStatus): string {
    const colorMap: Record<AdapterStatus, string> = {
      [AdapterStatus.Loaded]: 'green',
      [AdapterStatus.Unloaded]: 'gray',
      [AdapterStatus.Loading]: 'blue',
      [AdapterStatus.Unloading]: 'orange',
      [AdapterStatus.Error]: 'red',
      [AdapterStatus.Unknown]: 'gray',
      [AdapterStatus.Maintenance]: 'yellow',
    };
    
    return colorMap[status] || 'gray';
  }

  /**
   * Validate adapter installation request
   */
  static validateInstallRequest(request: AdapterInstallRequest): string[] {
    const errors: string[] = [];
    
    if (!request.adapter_id.trim()) {
      errors.push('适配器ID不能为空');
    }
    
    if (!request.source.trim()) {
      errors.push('安装源不能为空');
    }
    
    if (!['market', 'url', 'file'].includes(request.source)) {
      errors.push('无效的安装源');
    }
    
    return errors;
  }

  /**
   * Create default search request
   */
  static createDefaultSearchRequest(query: string): AdapterSearchRequest {
    return {
      query,
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    };
  }
}

// ================================
// Export Types and Service
// ================================

export default AdapterService;
export * from './types';
