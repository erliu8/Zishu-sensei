/**
 * 模型配置服务
 * 
 * 提供模型配置管理的前端 API
 */

import { invoke } from '@tauri-apps/api/tauri';
import type {
  ModelConfigData,
  ModelConfigHistory,
  ValidationResult,
  GetConfigInput,
  DeleteConfigInput,
  DeleteConfigResponse,
  SaveConfigResponse,
  GetAllConfigsResponse,
  SetDefaultConfigInput,
  SetDefaultConfigResponse,
  GetHistoryInput,
  GetHistoryResponse,
  ExportConfigInput,
  ExportConfigResponse,
  ImportConfigInput,
  ImportConfigResponse,
  CommandResponse,
} from '../types/modelConfig';

/**
 * 模型配置服务类
 */
export class ModelConfigService {
  /**
   * 保存模型配置
   * @param config 模型配置数据
   * @returns 保存响应
   */
  static async saveConfig(config: ModelConfigData): Promise<SaveConfigResponse> {
    try {
      const response = await invoke<CommandResponse<SaveConfigResponse>>(
        'save_model_config',
        { input: config }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '保存配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('保存模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取模型配置
   * @param configId 配置 ID
   * @returns 模型配置数据
   */
  static async getConfig(configId: string): Promise<ModelConfigData> {
    try {
      const response = await invoke<CommandResponse<ModelConfigData>>(
        'get_model_config',
        { input: { config_id: configId } as GetConfigInput }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('获取模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除模型配置
   * @param configId 配置 ID
   * @returns 删除响应
   */
  static async deleteConfig(configId: string): Promise<DeleteConfigResponse> {
    try {
      const response = await invoke<CommandResponse<DeleteConfigResponse>>(
        'delete_model_config',
        { input: { config_id: configId } as DeleteConfigInput }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '删除配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('删除模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有模型配置
   * @returns 所有配置列表
   */
  static async getAllConfigs(): Promise<GetAllConfigsResponse> {
    try {
      const response = await invoke<CommandResponse<GetAllConfigsResponse>>(
        'get_all_model_configs'
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取配置列表失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('获取所有模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认模型配置
   * @returns 默认配置
   */
  static async getDefaultConfig(): Promise<ModelConfigData> {
    try {
      const response = await invoke<CommandResponse<ModelConfigData>>(
        'get_default_model_config'
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取默认配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('获取默认模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 设置默认模型配置
   * @param configId 配置 ID
   * @returns 设置响应
   */
  static async setDefaultConfig(configId: string): Promise<SetDefaultConfigResponse> {
    try {
      const response = await invoke<CommandResponse<SetDefaultConfigResponse>>(
        'set_default_model_config',
        { input: { config_id: configId } as SetDefaultConfigInput }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '设置默认配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('设置默认模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 验证模型配置
   * @param config 模型配置数据
   * @returns 验证结果
   */
  static async validateConfig(config: ModelConfigData): Promise<ValidationResult> {
    try {
      const response = await invoke<CommandResponse<ValidationResult>>(
        'validate_model_config',
        { input: config }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '验证配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('验证模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置历史记录
   * @param configId 配置 ID
   * @param limit 限制数量
   * @returns 历史记录列表
   */
  static async getConfigHistory(
    configId: string,
    limit?: number
  ): Promise<GetHistoryResponse> {
    try {
      const response = await invoke<CommandResponse<GetHistoryResponse>>(
        'get_config_history',
        { input: { config_id: configId, limit } as GetHistoryInput }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '获取历史记录失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('获取配置历史记录失败:', error);
      throw error;
    }
  }

  /**
   * 导出模型配置
   * @param configId 配置 ID，如果为 undefined 则导出所有配置
   * @returns 导出的 JSON 数据
   */
  static async exportConfig(configId?: string): Promise<ExportConfigResponse> {
    try {
      const response = await invoke<CommandResponse<ExportConfigResponse>>(
        'export_model_config',
        { input: { config_id: configId } as ExportConfigInput }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '导出配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('导出模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 导入模型配置
   * @param data JSON 数据
   * @param batch 是否批量导入
   * @returns 导入响应
   */
  static async importConfig(
    data: string,
    batch: boolean = false
  ): Promise<ImportConfigResponse> {
    try {
      const response = await invoke<CommandResponse<ImportConfigResponse>>(
        'import_model_config',
        { input: { data, batch } as ImportConfigInput }
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || '导入配置失败');
      }
      
      return response.data;
    } catch (error) {
      console.error('导入模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 从文件导入配置
   * @param file 文件对象
   * @param batch 是否批量导入
   * @returns 导入响应
   */
  static async importConfigFromFile(
    file: File,
    batch: boolean = false
  ): Promise<ImportConfigResponse> {
    try {
      const text = await file.text();
      return await this.importConfig(text, batch);
    } catch (error) {
      console.error('从文件导入模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 导出配置到文件
   * @param configId 配置 ID，如果为 undefined 则导出所有配置
   * @param filename 文件名
   */
  static async exportConfigToFile(configId?: string, filename?: string): Promise<void> {
    try {
      const result = await this.exportConfig(configId);
      
      // 创建 Blob
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `model-config-${Date.now()}.json`;
      
      // 触发下载
      document.body.appendChild(a);
      a.click();
      
      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出模型配置到文件失败:', error);
      throw error;
    }
  }

  /**
   * 复制配置
   * @param sourceId 源配置 ID
   * @param newName 新配置名称
   * @returns 新配置数据
   */
  static async copyConfig(sourceId: string, newName: string): Promise<SaveConfigResponse> {
    try {
      // 获取源配置
      const sourceConfig = await this.getConfig(sourceId);
      
      // 创建新配置
      const newConfig: ModelConfigData = {
        ...sourceConfig,
        id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newName,
        is_default: false,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      };
      
      // 保存新配置
      return await this.saveConfig(newConfig);
    } catch (error) {
      console.error('复制模型配置失败:', error);
      throw error;
    }
  }

  /**
   * 按模型 ID 搜索配置
   * @param modelId 模型 ID
   * @returns 匹配的配置列表
   */
  static async searchByModelId(modelId: string): Promise<ModelConfigData[]> {
    try {
      const result = await this.getAllConfigs();
      return result.configs.filter(config => 
        config.model_id.toLowerCase().includes(modelId.toLowerCase())
      );
    } catch (error) {
      console.error('按模型 ID 搜索配置失败:', error);
      throw error;
    }
  }

  /**
   * 按适配器 ID 搜索配置
   * @param adapterId 适配器 ID
   * @returns 匹配的配置列表
   */
  static async searchByAdapterId(adapterId: string): Promise<ModelConfigData[]> {
    try {
      const result = await this.getAllConfigs();
      return result.configs.filter(config => 
        config.adapter_id?.toLowerCase().includes(adapterId.toLowerCase())
      );
    } catch (error) {
      console.error('按适配器 ID 搜索配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取启用的配置
   * @returns 启用的配置列表
   */
  static async getEnabledConfigs(): Promise<ModelConfigData[]> {
    try {
      const result = await this.getAllConfigs();
      return result.configs.filter(config => config.is_enabled);
    } catch (error) {
      console.error('获取启用的配置失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export default ModelConfigService;

