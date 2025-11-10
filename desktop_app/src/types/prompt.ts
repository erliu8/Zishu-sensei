/**
 * Prompt类型定义
 * 
 * 提供Prompt管理相关的TypeScript类型定义
 * 与后端Rust代码中的Prompt结构保持一致
 * 
 * @module types/prompt
 */

// ================================
// 核心数据结构
// ================================

/**
 * Prompt信息
 */
export interface Prompt {
  /** Prompt ID（唯一标识） */
  id: string;
  /** Prompt名称 */
  name: string;
  /** Prompt内容 */
  content: string;
  /** Prompt描述 */
  description?: string;
  /** 关联的模型ID（可选） */
  model_id?: string;
  /** 角色设定 */
  character_setting?: string;
  /** 是否启用 */
  is_enabled: boolean;
  /** 是否为默认Prompt */
  is_default: boolean;
  /** 创建时间 */
  created_at: number;
  /** 更新时间 */
  updated_at: number;
  /** 使用次数 */
  usage_count: number;
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 创建Prompt请求
 */
export interface CreatePromptRequest {
  /** Prompt名称 */
  name: string;
  /** Prompt内容 */
  content: string;
  /** Prompt描述（可选） */
  description?: string;
  /** 关联的模型ID（可选） */
  model_id?: string;
  /** 角色设定（可选） */
  character_setting?: string;
  /** 是否设为默认 */
  set_as_default: boolean;
}

/**
 * 更新Prompt请求
 */
export interface UpdatePromptRequest {
  /** Prompt ID */
  prompt_id: string;
  /** 更新的名称（可选） */
  name?: string;
  /** 更新的内容（可选） */
  content?: string;
  /** 更新的描述（可选） */
  description?: string;
  /** 更新的角色设定（可选） */
  character_setting?: string;
  /** 是否设为默认（可选） */
  set_as_default?: boolean;
}

/**
 * 删除Prompt请求
 */
export interface DeletePromptRequest {
  /** Prompt ID */
  prompt_id: string;
}

/**
 * 应用Prompt请求
 */
export interface ApplyPromptRequest {
  /** Prompt ID */
  prompt_id: string;
  /** 模型ID（可选，如果不提供则使用Prompt关联的模型） */
  model_id?: string;
}

// ================================
// 命令响应类型
// ================================

/**
 * 命令响应
 */
export interface CommandResponse<T = any> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误消息 */
  error?: string;
  /** 响应代码 */
  code?: string;
  /** 时间戳 */
  timestamp?: number;
  /** 消息 */
  message?: string;
}

// ================================
// 工具函数类型
// ================================

/**
 * 验证Prompt内容
 */
export function validatePromptContent(content: string): { valid: boolean; error?: string } {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Prompt内容不能为空' };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Prompt内容不能为空' };
  }

  if (trimmed.length > 100000) {
    return { valid: false, error: 'Prompt内容过长（最大 100000 字符）' };
  }

  return { valid: true };
}

/**
 * 格式化Prompt预览（截取前N个字符）
 */
export function formatPromptPreview(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + '...';
}

