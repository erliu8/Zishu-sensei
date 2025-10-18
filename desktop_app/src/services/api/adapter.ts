/**
 * 适配器 API 服务层
 * 
 * 提供适配器管理、执行、配置等相关的API调用功能
 * 与后端Rust代码中的适配器命令保持一致
 * 
 * @module services/api/adapter
 */

import { invoke } from '@tauri-apps/api/tauri';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// 导入适配器类型定义
import type {
  AdapterInfo,
  AdapterMetadata,
  AdapterInstallRequest,
  AdapterExecutionRequest,
  AdapterConfigUpdateRequest,
  AdapterSearchRequest,
  PaginatedResponse,
  CommandResponse,
} from '../../types/adapter';

// ================================
// 类型定义
// ================================

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: number;
}

/**
 * 适配器事件类型
 */
export type AdapterEventType = 
  | 'adapter_installed'
  | 'adapter_uninstalled'
  | 'adapter_loaded'
  | 'adapter_unloaded'
  | 'adapter_error'
  | 'adapter_status_changed'
  | 'adapter_execution_started'
  | 'adapter_execution_completed'
  | 'adapter_execution_failed';

/**
 * 适配器事件
 */
export interface AdapterEvent {
  /** 事件类型 */
  type: AdapterEventType;
  /** 适配器ID */
  adapter_id: string;
  /** 事件数据 */
  data: any;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 适配器事件监听器
 */
export type AdapterEventListener = (event: AdapterEvent) => void;

// ================================
// 核心 API 函数
// ================================

/**
 * 获取已安装的适配器列表
 */
export async function getAdapters(): Promise<AdapterInfo[]> {
  try {
    const response = await invoke<CommandResponse<AdapterInfo[]>>('get_adapters');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取适配器列表失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 安装适配器
 */
export async function installAdapter(request: AdapterInstallRequest): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('install_adapter', {
      input: request,
    });
    
    if (!response.success) {
      throw new Error(response.error || '安装适配器失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 卸载适配器
 */
export async function uninstallAdapter(adapterId: string): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('uninstall_adapter', {
      input: adapterId,
    });
    
    if (!response.success) {
      throw new Error(response.error || '卸载适配器失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 执行适配器操作
 */
export async function executeAdapter(request: AdapterExecutionRequest): Promise<any> {
  try {
    const response = await invoke<CommandResponse<any>>('execute_adapter', {
      input: request,
    });
    
    if (!response.success) {
      throw new Error(response.error || '执行适配器操作失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取适配器配置
 */
export async function getAdapterConfig(adapterId: string): Promise<Record<string, any>> {
  try {
    const response = await invoke<CommandResponse<Record<string, any>>>('get_adapter_config', {
      input: adapterId,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取适配器配置失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 更新适配器配置
 */
export async function updateAdapterConfig(request: AdapterConfigUpdateRequest): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('update_adapter_config', {
      input: request,
    });
    
    if (!response.success) {
      throw new Error(response.error || '更新适配器配置失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 搜索适配器
 */
export async function searchAdapters(request: AdapterSearchRequest): Promise<PaginatedResponse<any>> {
  try {
    const response = await invoke<CommandResponse<PaginatedResponse<any>>>('search_adapters', {
      input: request,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '搜索适配器失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取适配器详情
 */
export async function getAdapterDetails(adapterId: string): Promise<AdapterMetadata> {
  try {
    const response = await invoke<CommandResponse<AdapterMetadata>>('get_adapter_details', {
      input: adapterId,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取适配器详情失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 加载适配器
 */
export async function loadAdapter(adapterId: string): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('load_adapter', {
      input: adapterId,
    });
    
    if (!response.success) {
      throw new Error(response.error || '加载适配器失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 卸载适配器
 */
export async function unloadAdapter(adapterId: string): Promise<boolean> {
  try {
    const response = await invoke<CommandResponse<boolean>>('unload_adapter', {
      input: adapterId,
    });
    
    if (!response.success) {
      throw new Error(response.error || '卸载适配器失败');
    }
    
    return response.data || false;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取适配器状态
 */
export async function getAdapterStatus(adapterId?: string): Promise<any> {
  try {
    const response = await invoke<CommandResponse<any>>('get_adapter_status', {
      input: adapterId,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取适配器状态失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// ================================
// 高级功能
// ================================

/**
 * 批量安装适配器
 */
export async function batchInstallAdapters(
  requests: AdapterInstallRequest[],
  options: {
    concurrency?: number;
    continueOnError?: boolean;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{ successful: string[]; failed: Array<{ adapterId: string; error: string }> }> {
  const { concurrency = 3, continueOnError = true, onProgress } = options;
  
  const successful: string[] = [];
  const failed: Array<{ adapterId: string; error: string }> = [];
  
  let completed = 0;

  // 分批处理
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    
    const results = await Promise.allSettled(
      batch.map(request => installAdapter(request))
    );

    results.forEach((result, index) => {
      const request = batch[index];
      if (result.status === 'fulfilled' && result.value) {
        successful.push(request.adapter_id);
      } else {
        const error = result.status === 'rejected' 
          ? result.reason.message 
          : '安装失败';
        failed.push({ adapterId: request.adapter_id, error });
        
        if (!continueOnError) {
          throw new Error(`批量安装失败: ${error}`);
        }
      }

      completed++;
      onProgress?.(completed, requests.length);
    });
  }

  return { successful, failed };
}

/**
 * 批量卸载适配器
 */
export async function batchUninstallAdapters(
  adapterIds: string[],
  options: {
    concurrency?: number;
    continueOnError?: boolean;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{ successful: string[]; failed: Array<{ adapterId: string; error: string }> }> {
  const { concurrency = 3, continueOnError = true, onProgress } = options;
  
  const successful: string[] = [];
  const failed: Array<{ adapterId: string; error: string }> = [];
  
  let completed = 0;

  // 分批处理
  for (let i = 0; i < adapterIds.length; i += concurrency) {
    const batch = adapterIds.slice(i, i + concurrency);
    
    const results = await Promise.allSettled(
      batch.map(adapterId => uninstallAdapter(adapterId))
    );

    results.forEach((result, index) => {
      const adapterId = batch[index];
      if (result.status === 'fulfilled' && result.value) {
        successful.push(adapterId);
      } else {
        const error = result.status === 'rejected' 
          ? result.reason.message 
          : '卸载失败';
        failed.push({ adapterId, error });
        
        if (!continueOnError) {
          throw new Error(`批量卸载失败: ${error}`);
        }
      }

      completed++;
      onProgress?.(completed, adapterIds.length);
    });
  }

  return { successful, failed };
}

/**
 * 获取适配器健康状态
 */
export async function getAdapterHealthStatus(adapterId: string): Promise<{
  healthy: boolean;
  lastCheck: string;
  responseTimeMs: number;
  errorMessage?: string;
}> {
  try {
    const startTime = Date.now();
    const status = await getAdapterStatus(adapterId);
    const responseTime = Date.now() - startTime;
    
    return {
      healthy: status?.status === 'loaded',
      lastCheck: new Date().toISOString(),
      responseTimeMs: responseTime,
      errorMessage: status?.error,
    };
  } catch (error) {
    return {
      healthy: false,
      lastCheck: new Date().toISOString(),
      responseTimeMs: 0,
      errorMessage: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 获取适配器性能指标
 */
export async function getAdapterPerformanceMetrics(adapterId: string): Promise<{
  memoryUsageMb: number;
  cpuUsagePercent: number;
  responseTimeMs: number;
  throughputPerSecond: number;
}> {
  try {
    const status = await getAdapterStatus(adapterId);
    
    return {
      memoryUsageMb: status?.memory_usage || 0,
      cpuUsagePercent: status?.cpu_usage || 0,
      responseTimeMs: status?.response_time || 0,
      throughputPerSecond: status?.throughput || 0,
    };
  } catch (error) {
    throw new Error(`获取适配器性能指标失败: ${error}`);
  }
}

// ================================
// 事件监听
// ================================

/**
 * 适配器事件管理器
 */
export class AdapterEventManager {
  private listeners: Map<AdapterEventType, AdapterEventListener[]> = new Map();
  private unlistenFn: UnlistenFn | null = null;

  /**
   * 添加事件监听器
   */
  addEventListener(type: AdapterEventType, listener: AdapterEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: AdapterEventType, listener: AdapterEventListener): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 开始监听适配器事件
   */
  async startListening(): Promise<void> {
    try {
      this.unlistenFn = await listen<AdapterEvent>('adapter_event', (event) => {
        this.handleEvent(event.payload);
      });
    } catch (error) {
      throw new Error(`启动适配器事件监听失败: ${error}`);
    }
  }

  /**
   * 停止监听
   */
  async stopListening(): Promise<void> {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
  }

  /**
   * 处理事件
   */
  private handleEvent(event: AdapterEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`适配器事件监听器执行失败:`, error);
        }
      });
    }
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

/**
 * 验证适配器ID
 */
export function validateAdapterId(adapterId: string): { valid: boolean; error?: string } {
  if (!adapterId || typeof adapterId !== 'string') {
    return { valid: false, error: '适配器ID不能为空' };
  }
  
  if (adapterId.trim().length === 0) {
    return { valid: false, error: '适配器ID不能为空' };
  }
  
  // 检查适配器ID格式（字母、数字、下划线、连字符）
  const adapterIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!adapterIdPattern.test(adapterId)) {
    return { valid: false, error: '适配器ID只能包含字母、数字、下划线和连字符' };
  }
  
  return { valid: true };
}

/**
 * 验证适配器安装请求
 */
export function validateAdapterInstallRequest(request: AdapterInstallRequest): { valid: boolean; error?: string } {
  if (!request || typeof request !== 'object') {
    return { valid: false, error: '安装请求不能为空' };
  }
  
  if (!request.adapter_id || typeof request.adapter_id !== 'string') {
    return { valid: false, error: '适配器ID不能为空' };
  }
  
  if (!request.source || typeof request.source !== 'string') {
    return { valid: false, error: '安装源不能为空' };
  }
  
  const validSources = ['market', 'url', 'file'];
  if (!validSources.includes(request.source)) {
    return { valid: false, error: `无效的安装源: ${request.source}` };
  }
  
  return { valid: true };
}

/**
 * 验证适配器执行请求
 */
export function validateAdapterExecutionRequest(request: AdapterExecutionRequest): { valid: boolean; error?: string } {
  if (!request || typeof request !== 'object') {
    return { valid: false, error: '执行请求不能为空' };
  }
  
  if (!request.adapter_id || typeof request.adapter_id !== 'string') {
    return { valid: false, error: '适配器ID不能为空' };
  }
  
  if (!request.action || typeof request.action !== 'string') {
    return { valid: false, error: '执行操作不能为空' };
  }
  
  if (request.timeout && (typeof request.timeout !== 'number' || request.timeout <= 0)) {
    return { valid: false, error: '超时时间必须是正数' };
  }
  
  return { valid: true };
}

/**
 * 格式化适配器大小
 */
export function formatAdapterSize(bytes: number): string {
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
 * 格式化适配器版本
 */
export function formatAdapterVersion(version: string): string {
  // 移除版本号前缀（如 v1.0.0 -> 1.0.0）
  return version.replace(/^v/, '');
}

/**
 * 比较适配器版本
 */
export function compareAdapterVersions(version1: string, version2: string): number {
  const v1 = formatAdapterVersion(version1).split('.').map(Number);
  const v2 = formatAdapterVersion(version2).split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  
  return 0;
}

/**
 * 检查适配器是否兼容
 */
export function isAdapterCompatible(
  adapter: AdapterMetadata,
  systemInfo: {
    os: string;
    pythonVersion: string;
    baseModels: string[];
  }
): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // 检查操作系统兼容性
  if (!adapter.compatibility.operating_systems.includes(systemInfo.os)) {
    reasons.push(`不支持的操作系统: ${systemInfo.os}`);
  }
  
  // 检查Python版本兼容性
  const pythonCompatible = adapter.compatibility.python_versions.some(version => {
    if (version.includes('+')) {
      const minVersion = version.replace('+', '');
      return compareAdapterVersions(systemInfo.pythonVersion, minVersion) >= 0;
    }
    return version === systemInfo.pythonVersion;
  });
  
  if (!pythonCompatible) {
    reasons.push(`不兼容的Python版本: ${systemInfo.pythonVersion}`);
  }
  
  // 检查基础模型兼容性
  const modelCompatible = adapter.compatibility.base_models.length === 0 ||
    adapter.compatibility.base_models.some(model => 
      systemInfo.baseModels.includes(model)
    );
  
  if (!modelCompatible) {
    reasons.push('不兼容的基础模型');
  }
  
  return {
    compatible: reasons.length === 0,
    reasons,
  };
}

// ================================
// 导出
// ================================

export const AdapterAPI = {
  // 基础操作
  getAdapters,
  installAdapter,
  uninstallAdapter,
  executeAdapter,
  getAdapterConfig,
  updateAdapterConfig,
  searchAdapters,
  getAdapterDetails,
  loadAdapter,
  unloadAdapter,
  getAdapterStatus,
  
  // 高级功能
  batchInstallAdapters,
  batchUninstallAdapters,
  getAdapterHealthStatus,
  getAdapterPerformanceMetrics,
  
  // 事件管理
  AdapterEventManager,
  
  // 工具函数
  validateAdapterId,
  validateAdapterInstallRequest,
  validateAdapterExecutionRequest,
  formatAdapterSize,
  formatAdapterVersion,
  compareAdapterVersions,
  isAdapterCompatible,
  normalizeError,
};

export default AdapterAPI;
