/**
 * Prompt API 服务层
 * 
 * 提供Prompt管理相关的API调用功能
 * 与后端Rust代码中的Prompt命令保持一致
 * 
 * @module services/api/prompt
 */

import { invoke } from '@tauri-apps/api/tauri';

// 导入类型定义
import type {
  Prompt,
  CreatePromptRequest,
  UpdatePromptRequest,
  DeletePromptRequest,
  ApplyPromptRequest,
  CommandResponse,
} from '../../types/prompt';

// ================================
// 核心 API 函数
// ================================

/**
 * 获取所有Prompt列表
 */
export async function getPrompts(): Promise<Prompt[]> {
  try {
    const response = await invoke<CommandResponse<Prompt[]>>('get_prompts');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取Prompt列表失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 创建Prompt
 */
export async function createPrompt(request: CreatePromptRequest): Promise<Prompt> {
  try {
    const response = await invoke<CommandResponse<Prompt>>('create_prompt', {
      request: request,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '创建Prompt失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 更新Prompt
 */
export async function updatePrompt(request: UpdatePromptRequest): Promise<Prompt> {
  try {
    const response = await invoke<CommandResponse<Prompt>>('update_prompt', {
      request: request,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '更新Prompt失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 删除Prompt
 */
export async function deletePrompt(request: DeletePromptRequest): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('delete_prompt', {
      request: request,
    });
    
    if (!response.success) {
      throw new Error(response.error || '删除Prompt失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 应用Prompt（设置为当前使用的Prompt）
 */
export async function applyPrompt(request: ApplyPromptRequest): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('apply_prompt', {
      request: request,
    });
    
    if (!response.success) {
      throw new Error(response.error || '应用Prompt失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取Prompt详情
 */
export async function getPrompt(promptId: string): Promise<Prompt> {
  try {
    const response = await invoke<CommandResponse<Prompt>>('get_prompt', {
      promptId: promptId,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取Prompt详情失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取当前使用的Prompt
 */
export async function getCurrentPrompt(): Promise<Prompt | null> {
  try {
    const response = await invoke<CommandResponse<Prompt | null>>('get_current_prompt');
    
    if (!response.success) {
      throw new Error(response.error || '获取当前Prompt失败');
    }
    
    return response.data || null;
  } catch (error) {
    throw normalizeError(error);
  }
}

// ================================
// 辅助函数
// ================================

/**
 * 规范化错误对象
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  
  const message = typeof error === 'string' ? error : '未知错误';
  return new Error(message);
}

// ================================
// 导出
// ================================

export const PromptAPI = {
  // 基础操作
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  applyPrompt,
  getPrompt,
  getCurrentPrompt,
  
  // 工具函数
  normalizeError,
};

export default PromptAPI;

