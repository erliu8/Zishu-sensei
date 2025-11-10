/**
 * 本地LLM模型类型定义
 * 
 * 提供本地LLM模型管理相关的TypeScript类型定义
 * 与后端Rust代码中的本地LLM结构保持一致
 * 
 * @module types/localLLM
 */

// ================================
// 核心数据结构
// ================================

/**
 * 本地LLM模型信息
 */
export interface LocalLLMModel {
  /** 模型ID（唯一标识） */
  id: string;
  /** 模型名称 */
  name: string;
  /** 模型文件路径 */
  model_path: string;
  /** 模型类型（如：gguf, safetensors, pytorch等） */
  model_type: string;
  /** 模型大小（字节） */
  size_bytes: number;
  /** 参数量（可选） */
  parameter_count?: number;
  /** 模型描述 */
  description?: string;
  /** 支持的格式 */
  supported_formats: string[];
  /** 是否已加载 */
  is_loaded: boolean;
  /** 创建时间 */
  created_at: number;
  /** 更新时间 */
  updated_at: number;
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 上传模型请求
 */
export interface UploadModelRequest {
  /** 模型文件路径（用户选择的文件） */
  file_path: string;
  /** 模型名称 */
  name: string;
  /** 模型描述（可选） */
  description?: string;
  /** 是否自动验证 */
  auto_verify: boolean;
}

/**
 * 注册模型路径请求（直接引用，不复制文件）
 */
export interface RegisterModelRequest {
  /** 模型文件路径（直接引用的路径） */
  file_path: string;
  /** 模型名称 */
  name: string;
  /** 模型描述（可选） */
  description?: string;
  /** 是否自动验证 */
  auto_verify: boolean;
}

/**
 * 下载模型请求
 */
export interface DownloadModelRequest {
  /** 模型URL或标识符 */
  source: string;
  /** 模型名称 */
  name: string;
  /** 下载选项 */
  options: Record<string, any>;
}

/**
 * 删除模型请求
 */
export interface DeleteModelRequest {
  /** 模型ID */
  model_id: string;
  /** 是否删除文件 */
  delete_files: boolean;
}

/**
 * 验证模型请求
 */
export interface VerifyModelRequest {
  /** 模型ID */
  model_id: string;
}

/**
 * 验证模型响应
 */
export interface VerifyModelResponse {
  /** 是否有效 */
  valid: boolean;
  /** 验证消息 */
  message: string;
  /** 详细信息 */
  details: Record<string, any>;
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
 * 格式化参数量
 */
export function formatParameterCount(count?: number): string {
  if (!count) return '未知';
  
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(2)}B`;
  } else if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  } else if (count >= 1_000) {
    return `${(count / 1_000).toFixed(2)}K`;
  }
  
  return count.toString();
}

