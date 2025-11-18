/**
 * 本地LLM模型 API 服务层
 * 
 * 提供本地LLM模型管理相关的API调用功能
 * 与后端Rust代码中的本地LLM命令保持一致
 * 
 * @module services/api/localLLM
 */

import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';

// 导入类型定义
import type {
  LocalLLMModel,
  UploadModelRequest,
  RegisterModelRequest,
  DownloadModelRequest,
  DeleteModelRequest,
  VerifyModelRequest,
  VerifyModelResponse,
  CommandResponse,
} from '../../types/localLLM';

// ================================
// 核心 API 函数
// ================================

/**
 * 获取所有本地LLM模型列表
 */
export async function getLocalLLMModels(): Promise<LocalLLMModel[]> {
  try {
    // 添加超时处理（10秒）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('请求超时：获取模型列表时间过长')), 10000);
    });
    
    const invokePromise = invoke<CommandResponse<LocalLLMModel[]>>('get_local_llm_models');
    
    const response = await Promise.race([invokePromise, timeoutPromise]);
    
    if (!response.success) {
      throw new Error(response.error || '获取模型列表失败');
    }
    
    // 空数组是有效响应，只有当data为null或undefined时才报错
    if (response.data === null || response.data === undefined) {
      throw new Error(response.error || '获取模型列表失败：数据为空');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 上传本地LLM模型
 */
export async function uploadLocalLLMModel(request: UploadModelRequest): Promise<LocalLLMModel> {
  try {
    const response = await invoke<CommandResponse<LocalLLMModel>>('upload_local_llm_model', {
      request: request,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '上传模型失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 选择并上传模型文件或文件夹
 */
export async function selectAndUploadModel(
  name: string,
  description?: string,
  allowDirectory: boolean = true
): Promise<LocalLLMModel> {
  try {
    let selected: string | string[] | null = null;
    
    // 如果允许选择文件夹，先尝试选择文件夹（支持完整模型目录）
    if (allowDirectory) {
      try {
        selected = await open({
          multiple: false,
          directory: true,
          title: '选择模型文件夹（推荐：包含所有模型文件的完整目录）',
        });
      } catch (error) {
        // 如果用户取消文件夹选择，继续尝试选择文件
        console.log('用户取消文件夹选择，尝试选择文件');
      }
    }
    
    // 如果未选择文件夹，则选择文件
    if (!selected) {
      selected = await open({
        multiple: false,
        filters: [
          {
            name: '模型文件',
            extensions: ['gguf', 'safetensors', 'pt', 'pth', 'onnx', 'bin'],
          },
          {
            name: '所有文件',
            extensions: ['*'],
          },
        ],
        title: '选择模型文件',
      });
    }
    
    if (!selected || typeof selected !== 'string') {
      throw new Error('未选择文件或文件夹');
    }
    
    // 上传模型
    return await uploadLocalLLMModel({
      file_path: selected,
      name,
      description,
      auto_verify: true,
    });
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 注册本地LLM模型路径（直接引用，不复制文件）
 */
export async function registerLocalLLMModel(request: RegisterModelRequest): Promise<LocalLLMModel> {
  try {
    // 添加超时处理（30秒，给后端足够时间处理首次初始化）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              '注册模型超时（30秒）。可能原因：\n1) 后端服务未启动或不可达\n2) 首次初始化或适配器启动较慢\n3) 模型体积较大或后端繁忙\n请确认后端运行并稍后重试'
            )
          ),
        30000
      );
    });
    
    const invokePromise = invoke<CommandResponse<LocalLLMModel>>('register_local_llm_model', {
      request: request,
    });
    
    const response = await Promise.race([invokePromise, timeoutPromise]);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '注册模型失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 选择并注册模型路径（直接引用，不复制文件）
 */
export async function selectAndRegisterModel(
  name: string,
  description?: string,
  allowDirectory: boolean = true
): Promise<LocalLLMModel> {
  try {
    let selected: string | string[] | null = null;
    
    // 如果允许选择文件夹，先尝试选择文件夹（支持完整模型目录）
    if (allowDirectory) {
      try {
        selected = await open({
          multiple: false,
          directory: true,
          title: '选择模型文件夹（直接引用，不复制文件）',
        });
      } catch (error) {
        // 如果用户取消文件夹选择，继续尝试选择文件
        console.log('用户取消文件夹选择，尝试选择文件');
      }
    }
    
    // 如果未选择文件夹，则选择文件
    if (!selected) {
      selected = await open({
        multiple: false,
        filters: [
          {
            name: '模型文件',
            extensions: ['gguf', 'safetensors', 'pt', 'pth', 'onnx', 'bin'],
          },
          {
            name: '所有文件',
            extensions: ['*'],
          },
        ],
        title: '选择模型文件（直接引用，不复制文件）',
      });
    }
    
    if (!selected || typeof selected !== 'string') {
      throw new Error('未选择文件或文件夹');
    }
    
    // 注册模型路径
    return await registerLocalLLMModel({
      file_path: selected,
      name,
      description,
      auto_verify: true,
    });
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 下载本地LLM模型
 */
export async function downloadLocalLLMModel(request: DownloadModelRequest): Promise<LocalLLMModel> {
  try {
    const response = await invoke<CommandResponse<LocalLLMModel>>('download_local_llm_model', {
      request: request,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '下载模型失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 删除本地LLM模型
 */
export async function deleteLocalLLMModel(request: DeleteModelRequest): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('delete_local_llm_model', {
      request: request,
    });
    
    if (!response.success) {
      throw new Error(response.error || '删除模型失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 验证本地LLM模型
 */
export async function verifyLocalLLMModel(request: VerifyModelRequest): Promise<VerifyModelResponse> {
  try {
    const response = await invoke<CommandResponse<VerifyModelResponse>>('verify_local_llm_model', {
      request: request,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '验证模型失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取模型详情
 */
export async function getLocalLLMModel(modelId: string): Promise<LocalLLMModel> {
  try {
    const response = await invoke<CommandResponse<LocalLLMModel>>('get_local_llm_model', {
      model_id: modelId,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取模型详情失败');
    }
    
    return response.data;
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

export const LocalLLMAPI = {
  // 基础操作
  getModels: getLocalLLMModels,
  uploadModel: uploadLocalLLMModel,
  selectAndUpload: selectAndUploadModel,
  registerModel: registerLocalLLMModel,
  selectAndRegister: selectAndRegisterModel,
  downloadModel: downloadLocalLLMModel,
  deleteModel: deleteLocalLLMModel,
  verifyModel: verifyLocalLLMModel,
  getModel: getLocalLLMModel,
  
  // 工具函数
  normalizeError,
};

export default LocalLLMAPI;

