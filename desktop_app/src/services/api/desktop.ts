/**
 * 桌面操作 API 服务层
 * 
 * 提供桌面相关的操作功能，包括：
 * - 桌面信息获取
 * - 窗口管理
 * - 系统监控
 * - 工作流管理
 * - 任务监控
 * 
 * @module services/api/desktop
 */

import { invoke } from '@tauri-apps/api/tauri';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

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
 * 桌面信息
 */
export interface DesktopInfo {
  /** 屏幕宽度 */
  screen_width: number;
  /** 屏幕高度 */
  screen_height: number;
  /** 缩放因子 */
  scale_factor: number;
  /** 显示器数量 */
  display_count: number;
  /** 主显示器索引 */
  primary_display_index: number;
  /** 显示器列表 */
  displays: DisplayInfo[];
}

/**
 * 显示器信息
 */
export interface DisplayInfo {
  /** 显示器索引 */
  index: number;
  /** 显示器名称 */
  name: string;
  /** 是否为主显示器 */
  is_primary: boolean;
  /** 分辨率宽度 */
  width: number;
  /** 分辨率高度 */
  height: number;
  /** 刷新率 */
  refresh_rate: number;
  /** 缩放因子 */
  scale_factor: number;
  /** 位置X坐标 */
  x: number;
  /** 位置Y坐标 */
  y: number;
  /** 颜色深度 */
  color_depth: number;
  /** 显示器类型 */
  display_type: 'internal' | 'external' | 'virtual';
}

/**
 * 窗口信息
 */
export interface WindowInfo {
  /** 窗口ID */
  id: string;
  /** 窗口标题 */
  title: string;
  /** 窗口类名 */
  class_name?: string;
  /** 进程ID */
  process_id: number;
  /** 进程名称 */
  process_name: string;
  /** 窗口位置 */
  position: {
    x: number;
    y: number;
  };
  /** 窗口大小 */
  size: {
    width: number;
    height: number;
  };
  /** 是否可见 */
  visible: boolean;
  /** 是否最小化 */
  minimized: boolean;
  /** 是否最大化 */
  maximized: boolean;
  /** 是否全屏 */
  fullscreen: boolean;
  /** 是否置顶 */
  always_on_top: boolean;
  /** 窗口状态 */
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen' | 'hidden';
}

/**
 * 系统资源使用情况
 */
export interface SystemResources {
  /** CPU使用率（百分比） */
  cpu_usage: number;
  /** 内存使用情况 */
  memory: {
    /** 总内存（MB） */
    total_mb: number;
    /** 已使用内存（MB） */
    used_mb: number;
    /** 可用内存（MB） */
    available_mb: number;
    /** 使用率（百分比） */
    usage_percent: number;
  };
  /** 磁盘使用情况 */
  disk: {
    /** 总容量（MB） */
    total_mb: number;
    /** 已使用容量（MB） */
    used_mb: number;
    /** 可用容量（MB） */
    available_mb: number;
    /** 使用率（百分比） */
    usage_percent: number;
  };
  /** GPU使用情况（如果可用） */
  gpu?: {
    /** GPU名称 */
    name: string;
    /** GPU使用率（百分比） */
    usage_percent: number;
    /** GPU内存使用情况 */
    memory: {
      total_mb: number;
      used_mb: number;
      usage_percent: number;
    };
    /** GPU温度（摄氏度） */
    temperature?: number;
  };
  /** 网络使用情况 */
  network: {
    /** 下载速度（KB/s） */
    download_speed_kbps: number;
    /** 上传速度（KB/s） */
    upload_speed_kbps: number;
    /** 总下载量（MB） */
    total_downloaded_mb: number;
    /** 总上传量（MB） */
    total_uploaded_mb: number;
  };
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** 工作流ID */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流描述 */
  description?: string;
  /** 工作流版本 */
  version: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  /** 工作流步骤 */
  steps: WorkflowStep[];
  /** 工作流配置 */
  config: WorkflowConfig;
  /** 工作流状态 */
  status: WorkflowStatus;
  /** 工作流标签 */
  tags: string[];
  /** 工作流分类 */
  category: string;
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤类型 */
  type: 'action' | 'condition' | 'loop' | 'delay' | 'trigger';
  /** 步骤描述 */
  description?: string;
  /** 步骤配置 */
  config: Record<string, any>;
  /** 下一步骤ID列表 */
  next_steps: string[];
  /** 错误处理 */
  error_handling?: {
    retry_count: number;
    retry_delay_ms: number;
    on_error: 'stop' | 'continue' | 'skip';
  };
  /** 步骤状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 执行超时时间（毫秒） */
  timeout_ms: number;
  /** 最大重试次数 */
  max_retries: number;
  /** 并发执行数量 */
  concurrency: number;
  /** 失败时是否停止 */
  stop_on_error: boolean;
  /** 日志级别 */
  log_level: 'debug' | 'info' | 'warn' | 'error';
  /** 通知设置 */
  notifications: {
    on_start: boolean;
    on_complete: boolean;
    on_error: boolean;
    on_cancel: boolean;
  };
}

/**
 * 工作流状态
 */
export enum WorkflowStatus {
  /** 草稿状态 */
  Draft = 'draft',
  /** 已发布 */
  Published = 'published',
  /** 运行中 */
  Running = 'running',
  /** 已暂停 */
  Paused = 'paused',
  /** 已完成 */
  Completed = 'completed',
  /** 已失败 */
  Failed = 'failed',
  /** 已取消 */
  Cancelled = 'cancelled',
}

/**
 * 工作流执行实例
 */
export interface WorkflowExecution {
  /** 执行ID */
  id: string;
  /** 工作流ID */
  workflow_id: string;
  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** 开始时间 */
  started_at: string;
  /** 结束时间 */
  ended_at?: string;
  /** 执行结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 执行日志 */
  logs: ExecutionLog[];
  /** 执行统计 */
  statistics: {
    total_steps: number;
    completed_steps: number;
    failed_steps: number;
    skipped_steps: number;
    execution_time_ms: number;
  };
}

/**
 * 执行日志
 */
export interface ExecutionLog {
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 日志消息 */
  message: string;
  /** 时间戳 */
  timestamp: string;
  /** 步骤ID */
  step_id?: string;
  /** 额外数据 */
  data?: any;
}

/**
 * 任务信息
 */
export interface TaskInfo {
  /** 任务ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务类型 */
  type: 'workflow' | 'adapter' | 'system' | 'custom';
  /** 任务状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** 任务优先级 */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** 创建时间 */
  created_at: string;
  /** 开始时间 */
  started_at?: string;
  /** 结束时间 */
  ended_at?: string;
  /** 任务进度 */
  progress: {
    current: number;
    total: number;
    percentage: number;
    message?: string;
  };
  /** 任务结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 任务配置 */
  config: Record<string, any>;
}

/**
 * 任务监控统计
 */
export interface TaskMonitorStats {
  /** 总任务数 */
  total_tasks: number;
  /** 运行中任务数 */
  running_tasks: number;
  /** 已完成任务数 */
  completed_tasks: number;
  /** 失败任务数 */
  failed_tasks: number;
  /** 待处理任务数 */
  pending_tasks: number;
  /** 平均执行时间（毫秒） */
  average_execution_time_ms: number;
  /** 成功率（百分比） */
  success_rate_percent: number;
  /** 系统负载 */
  system_load: SystemResources;
}

// ================================
// 事件类型
// ================================

/**
 * 桌面事件类型
 */
export type DesktopEventType = 
  | 'window_created'
  | 'window_destroyed'
  | 'window_focused'
  | 'window_moved'
  | 'window_resized'
  | 'display_changed'
  | 'system_resources_changed'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed';

/**
 * 桌面事件
 */
export interface DesktopEvent {
  /** 事件类型 */
  type: DesktopEventType;
  /** 事件数据 */
  data: any;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 事件监听器
 */
export type DesktopEventListener = (event: DesktopEvent) => void;

// ================================
// 核心 API 函数
// ================================

/**
 * 获取桌面信息
 */
export async function getDesktopInfo(): Promise<DesktopInfo> {
  try {
    const response = await invoke<ApiResponse<DesktopInfo>>('get_desktop_info');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取桌面信息失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取窗口列表
 */
export async function getWindowList(): Promise<WindowInfo[]> {
  try {
    const response = await invoke<ApiResponse<WindowInfo[]>>('get_window_list');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取窗口列表失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取指定窗口信息
 */
export async function getWindowInfo(windowId: string): Promise<WindowInfo> {
  try {
    const response = await invoke<ApiResponse<WindowInfo>>('get_window_info', {
      input: { window_id: windowId },
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取窗口信息失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 设置窗口位置
 */
export async function setWindowPosition(
  windowId: string,
  x: number,
  y: number
): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('set_window_position', {
      input: { window_id: windowId, x, y },
    });
    
    if (!response.success) {
      throw new Error(response.error || '设置窗口位置失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 设置窗口大小
 */
export async function setWindowSize(
  windowId: string,
  width: number,
  height: number
): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('set_window_size', {
      input: { window_id: windowId, width, height },
    });
    
    if (!response.success) {
      throw new Error(response.error || '设置窗口大小失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 最小化窗口
 */
export async function minimizeWindow(windowId: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('minimize_window', {
      input: { window_id: windowId },
    });
    
    if (!response.success) {
      throw new Error(response.error || '最小化窗口失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 最大化窗口
 */
export async function maximizeWindow(windowId: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('maximize_window', {
      input: { window_id: windowId },
    });
    
    if (!response.success) {
      throw new Error(response.error || '最大化窗口失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 关闭窗口
 */
export async function closeWindow(windowId: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('close_window', {
      input: { window_id: windowId },
    });
    
    if (!response.success) {
      throw new Error(response.error || '关闭窗口失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取系统资源使用情况
 */
export async function getSystemResources(): Promise<SystemResources> {
  try {
    const response = await invoke<ApiResponse<SystemResources>>('get_system_resources');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取系统资源信息失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 创建工作流
 */
export async function createWorkflow(workflow: Omit<WorkflowDefinition, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowDefinition> {
  try {
    const response = await invoke<ApiResponse<WorkflowDefinition>>('create_workflow', {
      input: workflow,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '创建工作流失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取工作流列表
 */
export async function getWorkflowList(): Promise<WorkflowDefinition[]> {
  try {
    const response = await invoke<ApiResponse<WorkflowDefinition[]>>('get_workflow_list');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取工作流列表失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取工作流详情
 */
export async function getWorkflowInfo(workflowId: string): Promise<WorkflowDefinition> {
  try {
    const response = await invoke<ApiResponse<WorkflowDefinition>>('get_workflow_info', {
      input: { workflow_id: workflowId },
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取工作流信息失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 更新工作流
 */
export async function updateWorkflow(
  workflowId: string,
  updates: Partial<WorkflowDefinition>
): Promise<WorkflowDefinition> {
  try {
    const response = await invoke<ApiResponse<WorkflowDefinition>>('update_workflow', {
      input: { workflow_id: workflowId, updates },
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '更新工作流失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 删除工作流
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('delete_workflow', {
      input: { workflow_id: workflowId },
    });
    
    if (!response.success) {
      throw new Error(response.error || '删除工作流失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 执行工作流
 */
export async function executeWorkflow(
  workflowId: string,
  params?: Record<string, any>
): Promise<WorkflowExecution> {
  try {
    const response = await invoke<ApiResponse<WorkflowExecution>>('execute_workflow', {
      input: { workflow_id: workflowId, params },
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '执行工作流失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 停止工作流执行
 */
export async function stopWorkflowExecution(executionId: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('stop_workflow_execution', {
      input: { execution_id: executionId },
    });
    
    if (!response.success) {
      throw new Error(response.error || '停止工作流执行失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取工作流执行历史
 */
export async function getWorkflowExecutionHistory(
  workflowId?: string,
  limit?: number
): Promise<WorkflowExecution[]> {
  try {
    const response = await invoke<ApiResponse<WorkflowExecution[]>>('get_workflow_execution_history', {
      input: { workflow_id: workflowId, limit },
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取工作流执行历史失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取任务列表
 */
export async function getTaskList(): Promise<TaskInfo[]> {
  try {
    const response = await invoke<ApiResponse<TaskInfo[]>>('get_task_list');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取任务列表失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取任务监控统计
 */
export async function getTaskMonitorStats(): Promise<TaskMonitorStats> {
  try {
    const response = await invoke<ApiResponse<TaskMonitorStats>>('get_task_monitor_stats');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取任务监控统计失败');
    }
    
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 取消任务
 */
export async function cancelTask(taskId: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('cancel_task', {
      input: { task_id: taskId },
    });
    
    if (!response.success) {
      throw new Error(response.error || '取消任务失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

// ================================
// 事件监听
// ================================

/**
 * 事件监听器管理器
 */
export class DesktopEventManager {
  private listeners: Map<DesktopEventType, DesktopEventListener[]> = new Map();
  private unlistenFns: Map<string, UnlistenFn> = new Map();

  /**
   * 添加事件监听器
   */
  addEventListener(type: DesktopEventType, listener: DesktopEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: DesktopEventType, listener: DesktopEventListener): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 开始监听桌面事件
   */
  async startListening(): Promise<void> {
    try {
      // 监听窗口事件
      const windowUnlisten = await listen<DesktopEvent>('desktop_window_event', (event) => {
        this.handleEvent(event.payload);
      });
      this.unlistenFns.set('window', windowUnlisten);

      // 监听系统事件
      const systemUnlisten = await listen<DesktopEvent>('desktop_system_event', (event) => {
        this.handleEvent(event.payload);
      });
      this.unlistenFns.set('system', systemUnlisten);

      // 监听工作流事件
      const workflowUnlisten = await listen<DesktopEvent>('desktop_workflow_event', (event) => {
        this.handleEvent(event.payload);
      });
      this.unlistenFns.set('workflow', workflowUnlisten);

      // 监听任务事件
      const taskUnlisten = await listen<DesktopEvent>('desktop_task_event', (event) => {
        this.handleEvent(event.payload);
      });
      this.unlistenFns.set('task', taskUnlisten);
    } catch (error) {
      throw new Error(`启动事件监听失败: ${error}`);
    }
  }

  /**
   * 停止监听
   */
  async stopListening(): Promise<void> {
    for (const [, unlistenFn] of this.unlistenFns) {
      unlistenFn();
    }
    this.unlistenFns.clear();
  }

  /**
   * 处理事件
   */
  private handleEvent(event: DesktopEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`事件监听器执行失败:`, error);
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
 * 验证窗口ID
 */
export function validateWindowId(windowId: string): { valid: boolean; error?: string } {
  if (!windowId || typeof windowId !== 'string') {
    return { valid: false, error: '窗口ID不能为空' };
  }
  
  if (windowId.trim().length === 0) {
    return { valid: false, error: '窗口ID不能为空' };
  }
  
  return { valid: true };
}

/**
 * 验证坐标
 */
export function validateCoordinates(x: number, y: number): { valid: boolean; error?: string } {
  if (typeof x !== 'number' || typeof y !== 'number') {
    return { valid: false, error: '坐标必须是数字' };
  }
  
  if (x < 0 || y < 0) {
    return { valid: false, error: '坐标不能为负数' };
  }
  
  return { valid: true };
}

/**
 * 验证尺寸
 */
export function validateSize(width: number, height: number): { valid: boolean; error?: string } {
  if (typeof width !== 'number' || typeof height !== 'number') {
    return { valid: false, error: '尺寸必须是数字' };
  }
  
  if (width <= 0 || height <= 0) {
    return { valid: false, error: '尺寸必须大于0' };
  }
  
  return { valid: true };
}

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
 * 格式化时间
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 计算进度百分比
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

// ================================
// 导出
// ================================

export const DesktopAPI = {
  // 桌面信息
  getDesktopInfo,
  
  // 窗口管理
  getWindowList,
  getWindowInfo,
  setWindowPosition,
  setWindowSize,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  
  // 系统资源
  getSystemResources,
  
  // 工作流管理
  createWorkflow,
  getWorkflowList,
  getWorkflowInfo,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  stopWorkflowExecution,
  getWorkflowExecutionHistory,
  
  // 任务管理
  getTaskList,
  getTaskMonitorStats,
  cancelTask,
  
  // 事件管理
  DesktopEventManager,
  
  // 工具函数
  validateWindowId,
  validateCoordinates,
  validateSize,
  formatFileSize,
  formatDuration,
  calculateProgress,
  normalizeError,
};

export default DesktopAPI;
