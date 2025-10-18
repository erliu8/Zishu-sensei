/**
 * 模型配置类型定义
 * 
 * 这个文件包含了聊天模型配置相关的所有类型定义
 */

/**
 * 模型配置数据
 */
export interface ModelConfigData {
  /** 配置 ID（唯一标识） */
  id: string;
  /** 配置名称 */
  name: string;
  /** 模型 ID */
  model_id: string;
  /** 适配器 ID */
  adapter_id?: string | null;
  /** 温度参数 (0.0 - 2.0) */
  temperature: number;
  /** Top-P 参数 (0.0 - 1.0) */
  top_p: number;
  /** Top-K 参数 */
  top_k?: number | null;
  /** 最大 token 数 */
  max_tokens: number;
  /** 频率惩罚 (-2.0 - 2.0) */
  frequency_penalty: number;
  /** 存在惩罚 (-2.0 - 2.0) */
  presence_penalty: number;
  /** 停止序列 */
  stop_sequences: string[];
  /** 是否为默认配置 */
  is_default: boolean;
  /** 是否启用 */
  is_enabled: boolean;
  /** 配置描述 */
  description?: string | null;
  /** 额外配置（JSON格式） */
  extra_config?: string | null;
  /** 创建时间 */
  created_at: number;
  /** 更新时间 */
  updated_at: number;
}

/**
 * 模型配置历史记录
 */
export interface ModelConfigHistory {
  /** 历史记录 ID */
  id: number;
  /** 配置 ID */
  config_id: string;
  /** 操作类型（created, updated, deleted） */
  action: 'created' | 'updated' | 'deleted';
  /** 变更前数据（JSON格式） */
  old_data?: string | null;
  /** 变更后数据（JSON格式） */
  new_data?: string | null;
  /** 变更原因/备注 */
  reason?: string | null;
  /** 创建时间 */
  created_at: number;
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  is_valid: boolean;
  /** 错误信息列表 */
  errors: string[];
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * 获取配置输入
 */
export interface GetConfigInput {
  config_id: string;
}

/**
 * 删除配置输入
 */
export interface DeleteConfigInput {
  config_id: string;
}

/**
 * 删除配置响应
 */
export interface DeleteConfigResponse {
  success: boolean;
  message: string;
}

/**
 * 保存配置响应
 */
export interface SaveConfigResponse {
  success: boolean;
  config_id: string;
  message: string;
}

/**
 * 获取所有配置响应
 */
export interface GetAllConfigsResponse {
  configs: ModelConfigData[];
  total: number;
}

/**
 * 设置默认配置输入
 */
export interface SetDefaultConfigInput {
  config_id: string;
}

/**
 * 设置默认配置响应
 */
export interface SetDefaultConfigResponse {
  success: boolean;
  message: string;
}

/**
 * 获取历史记录输入
 */
export interface GetHistoryInput {
  config_id: string;
  limit?: number;
}

/**
 * 获取历史记录响应
 */
export interface GetHistoryResponse {
  history: ModelConfigHistory[];
  total: number;
}

/**
 * 导出配置输入
 */
export interface ExportConfigInput {
  /** 配置 ID，如果为 undefined 则导出所有配置 */
  config_id?: string;
}

/**
 * 导出配置响应
 */
export interface ExportConfigResponse {
  success: boolean;
  data: string;
}

/**
 * 导入配置输入
 */
export interface ImportConfigInput {
  data: string;
  /** 是否批量导入 */
  batch?: boolean;
}

/**
 * 导入配置响应
 */
export interface ImportConfigResponse {
  success: boolean;
  imported_ids: string[];
  message: string;
}

/**
 * 命令响应包装
 */
export interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(): Partial<ModelConfigData> {
  return {
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 2048,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    stop_sequences: [],
    is_default: false,
    is_enabled: true,
  };
}

/**
 * 创建高创造性配置
 */
export function createCreativeConfig(): Partial<ModelConfigData> {
  return {
    temperature: 1.2,
    top_p: 0.95,
    max_tokens: 4096,
    frequency_penalty: 0.5,
    presence_penalty: 0.5,
    stop_sequences: [],
    is_default: false,
    is_enabled: true,
  };
}

/**
 * 创建精确性配置
 */
export function createPreciseConfig(): Partial<ModelConfigData> {
  return {
    temperature: 0.3,
    top_p: 0.8,
    max_tokens: 2048,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    stop_sequences: [],
    is_default: false,
    is_enabled: true,
  };
}

/**
 * 验证温度参数
 */
export function validateTemperature(temperature: number): boolean {
  return temperature >= 0 && temperature <= 2.0;
}

/**
 * 验证 Top-P 参数
 */
export function validateTopP(topP: number): boolean {
  return topP >= 0 && topP <= 1.0;
}

/**
 * 验证最大 token 数
 */
export function validateMaxTokens(maxTokens: number): boolean {
  return maxTokens > 0 && maxTokens <= 100000;
}

/**
 * 验证频率惩罚
 */
export function validateFrequencyPenalty(penalty: number): boolean {
  return penalty >= -2.0 && penalty <= 2.0;
}

/**
 * 验证存在惩罚
 */
export function validatePresencePenalty(penalty: number): boolean {
  return penalty >= -2.0 && penalty <= 2.0;
}

/**
 * 验证模型配置
 */
export function validateModelConfig(config: Partial<ModelConfigData>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.name || config.name.trim() === '') {
    errors.push('配置名称不能为空');
  }

  if (!config.model_id || config.model_id.trim() === '') {
    errors.push('模型 ID 不能为空');
  }

  if (config.temperature !== undefined && !validateTemperature(config.temperature)) {
    errors.push('温度参数必须在 0.0 到 2.0 之间');
  }

  if (config.temperature !== undefined && config.temperature > 1.5) {
    warnings.push('温度参数较高，可能导致输出不稳定');
  }

  if (config.top_p !== undefined && !validateTopP(config.top_p)) {
    errors.push('Top-P 参数必须在 0.0 到 1.0 之间');
  }

  if (config.max_tokens !== undefined && !validateMaxTokens(config.max_tokens)) {
    errors.push('最大 token 数必须大于 0 且小于等于 100000');
  }

  if (config.max_tokens !== undefined && config.max_tokens > 50000) {
    warnings.push('最大 token 数较大，可能导致请求超时或成本增加');
  }

  if (config.frequency_penalty !== undefined && !validateFrequencyPenalty(config.frequency_penalty)) {
    errors.push('频率惩罚必须在 -2.0 到 2.0 之间');
  }

  if (config.presence_penalty !== undefined && !validatePresencePenalty(config.presence_penalty)) {
    errors.push('存在惩罚必须在 -2.0 到 2.0 之间');
  }

  if (config.stop_sequences && config.stop_sequences.length > 10) {
    warnings.push('停止序列数量较多，可能影响性能');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 比较两个配置
 */
export function compareConfigs(
  config1: ModelConfigData,
  config2: ModelConfigData
): { field: string; old: any; new: any }[] {
  const differences: { field: string; old: any; new: any }[] = [];

  const fieldsToCompare: (keyof ModelConfigData)[] = [
    'name',
    'model_id',
    'adapter_id',
    'temperature',
    'top_p',
    'top_k',
    'max_tokens',
    'frequency_penalty',
    'presence_penalty',
    'stop_sequences',
    'is_default',
    'is_enabled',
    'description',
  ];

  for (const field of fieldsToCompare) {
    const oldValue = config1[field];
    const newValue = config2[field];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      differences.push({
        field,
        old: oldValue,
        new: newValue,
      });
    }
  }

  return differences;
}

