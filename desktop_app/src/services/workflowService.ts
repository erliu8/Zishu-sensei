/**
 * 工作流服务
 * 封装所有工作流相关的Tauri命令调用
 */

import { invoke } from '@tauri-apps/api';
import type {
  Workflow,
  WorkflowExecution,
  WorkflowTemplate,
  WorkflowVersion,
  WorkflowExport,
  ImportResult,
  ScheduledWorkflowInfo,
  WorkflowStatus,
} from '../types/workflow';

/**
 * 工作流基础操作
 */
export const workflowService = {
  /**
   * 创建工作流
   */
  async createWorkflow(workflow: Workflow): Promise<string> {
    return await invoke('create_workflow', { workflow });
  },

  /**
   * 更新工作流
   */
  async updateWorkflow(workflow: Workflow): Promise<void> {
    return await invoke('update_workflow', { workflow });
  },

  /**
   * 删除工作流
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    return await invoke('delete_workflow', { workflowId });
  },

  /**
   * 获取工作流
   */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    return await invoke('get_workflow', { workflowId });
  },

  /**
   * 列出所有工作流
   */
  async listWorkflows(): Promise<Workflow[]> {
    return await invoke('list_workflows');
  },

  /**
   * 搜索工作流
   */
  async searchWorkflows(params: {
    keyword?: string;
    status?: WorkflowStatus;
    tags?: string[];
    category?: string;
  }): Promise<Workflow[]> {
    return await invoke('search_workflows', params);
  },

  /**
   * 发布工作流
   */
  async publishWorkflow(workflowId: string): Promise<void> {
    return await invoke('publish_workflow', { workflowId });
  },

  /**
   * 归档工作流
   */
  async archiveWorkflow(workflowId: string): Promise<void> {
    return await invoke('archive_workflow', { workflowId });
  },

  /**
   * 禁用工作流
   */
  async disableWorkflow(workflowId: string): Promise<void> {
    return await invoke('disable_workflow', { workflowId });
  },

  /**
   * 克隆工作流
   */
  async cloneWorkflow(workflowId: string, newName: string): Promise<string> {
    return await invoke('clone_workflow', { workflowId, newName });
  },
};

/**
 * 工作流执行操作
 */
export const workflowExecutionService = {
  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflowId: string,
    variables: Record<string, any>
  ): Promise<string> {
    return await invoke('execute_workflow', { workflowId, variables });
  },

  /**
   * 取消工作流执行
   */
  async cancelExecution(executionId: string): Promise<void> {
    return await invoke('cancel_workflow_execution', { executionId });
  },

  /**
   * 暂停工作流执行
   */
  async pauseExecution(executionId: string): Promise<void> {
    return await invoke('pause_workflow_execution', { executionId });
  },

  /**
   * 恢复工作流执行
   */
  async resumeExecution(executionId: string): Promise<void> {
    return await invoke('resume_workflow_execution', { executionId });
  },

  /**
   * 获取工作流执行状态
   */
  async getExecutionStatus(executionId: string): Promise<WorkflowExecution> {
    return await invoke('get_workflow_execution_status', { executionId });
  },

  /**
   * 列出所有工作流执行
   */
  async listExecutions(): Promise<WorkflowExecution[]> {
    return await invoke('list_workflow_executions');
  },
};

/**
 * 工作流调度操作
 */
export const workflowSchedulerService = {
  /**
   * 调度工作流
   */
  async scheduleWorkflow(workflowId: string): Promise<void> {
    return await invoke('schedule_workflow', { workflowId });
  },

  /**
   * 取消工作流调度
   */
  async unscheduleWorkflow(workflowId: string): Promise<void> {
    return await invoke('unschedule_workflow', { workflowId });
  },

  /**
   * 列出已调度的工作流
   */
  async listScheduledWorkflows(): Promise<ScheduledWorkflowInfo[]> {
    return await invoke('list_scheduled_workflows');
  },

  /**
   * 启动工作流调度器
   */
  async startScheduler(): Promise<void> {
    return await invoke('start_workflow_scheduler');
  },

  /**
   * 停止工作流调度器
   */
  async stopScheduler(): Promise<void> {
    return await invoke('stop_workflow_scheduler');
  },

  /**
   * 获取工作流调度器状态
   */
  async getSchedulerStatus(): Promise<boolean> {
    return await invoke('get_workflow_scheduler_status');
  },
};

/**
 * 工作流模板操作
 */
export const workflowTemplateService = {
  /**
   * 创建工作流模板
   */
  async createTemplate(template: WorkflowTemplate): Promise<string> {
    return await invoke('create_workflow_template', { template });
  },

  /**
   * 更新工作流模板
   */
  async updateTemplate(template: WorkflowTemplate): Promise<void> {
    return await invoke('update_workflow_template', { template });
  },

  /**
   * 删除工作流模板
   */
  async deleteTemplate(templateId: string): Promise<void> {
    return await invoke('delete_workflow_template', { templateId });
  },

  /**
   * 获取工作流模板
   */
  async getTemplate(templateId: string): Promise<WorkflowTemplate> {
    return await invoke('get_workflow_template', { templateId });
  },

  /**
   * 列出所有工作流模板
   */
  async listTemplates(): Promise<WorkflowTemplate[]> {
    return await invoke('list_workflow_templates');
  },

  /**
   * 从模板创建工作流
   */
  async createFromTemplate(
    templateId: string,
    name: string,
    parameters: Record<string, any>
  ): Promise<string> {
    return await invoke('create_workflow_from_template', {
      templateId,
      name,
      parameters,
    });
  },

  /**
   * 获取所有内置工作流模板
   */
  async getBuiltinTemplates(): Promise<WorkflowTemplate[]> {
    return await invoke('get_builtin_templates');
  },

  /**
   * 获取指定的内置工作流模板
   */
  async getBuiltinTemplate(templateId: string): Promise<WorkflowTemplate> {
    return await invoke('get_builtin_template', { templateId });
  },
};

/**
 * 工作流版本控制操作
 */
export const workflowVersionService = {
  /**
   * 获取工作流版本历史
   */
  async getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
    return await invoke('get_workflow_versions', { workflowId });
  },

  /**
   * 获取指定版本的工作流
   */
  async getWorkflowVersion(
    workflowId: string,
    version: string
  ): Promise<Workflow> {
    return await invoke('get_workflow_version', { workflowId, version });
  },

  /**
   * 回滚工作流到指定版本
   */
  async rollbackToVersion(workflowId: string, version: string): Promise<void> {
    return await invoke('rollback_workflow_to_version', {
      workflowId,
      version,
    });
  },
};

/**
 * 工作流导入/导出操作
 */
export const workflowExportService = {
  /**
   * 导出工作流
   */
  async exportWorkflows(
    workflowIds: string[],
    includeTemplates: boolean
  ): Promise<WorkflowExport> {
    return await invoke('export_workflows', { workflowIds, includeTemplates });
  },

  /**
   * 导出所有工作流
   */
  async exportAllWorkflows(includeTemplates: boolean): Promise<WorkflowExport> {
    return await invoke('export_all_workflows', { includeTemplates });
  },

  /**
   * 导入工作流
   */
  async importWorkflows(
    exportData: WorkflowExport,
    overwrite: boolean
  ): Promise<ImportResult> {
    return await invoke('import_workflows', { exportData, overwrite });
  },

  /**
   * 下载导出文件
   */
  async downloadExport(exportData: WorkflowExport, filename: string): Promise<void> {
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `workflow-export-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  },

  /**
   * 从文件加载导出数据
   */
  async loadExportFromFile(file: File): Promise<WorkflowExport> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          resolve(data);
        } catch (error) {
          reject(new Error('无效的导出文件格式'));
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },
};

/**
 * 统一导出
 */
const baseWorkflowService = {
  workflow: workflowService,
  execution: workflowExecutionService,
  scheduler: workflowSchedulerService,
  template: workflowTemplateService,
  version: workflowVersionService,
  export: workflowExportService,
};

// ============================================================================
// Trigger Services
// ============================================================================

export interface EventTrigger {
  id: string;
  workflow_id: string;
  event_type: EventType;
  condition?: string;
  enabled: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type EventType = 
  | 'FileCreated'
  | 'FileModified'
  | 'FileDeleted'
  | 'SystemStartup'
  | 'SystemShutdown'
  | 'TimeSchedule'
  | 'UserLogin'
  | 'UserLogout'
  | 'Custom';

export interface WebhookConfig {
  secret?: string;
  allowed_ips?: string[];
  require_auth: boolean;
  timeout_seconds: number;
}

export interface WebhookRequest {
  method: string;
  headers: Record<string, string>;
  body: string;
  query_params: Record<string, string>;
}

export interface WebhookResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Event Trigger Service
 */
export const eventTriggerService = {
  /**
   * Create an event trigger
   */
  createTrigger: async (trigger: Omit<EventTrigger, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    return invoke<string>('create_event_trigger', { trigger });
  },

  /**
   * List event triggers
   */
  listTriggers: async (workflowId?: string): Promise<EventTrigger[]> => {
    return invoke<EventTrigger[]>('list_event_triggers', { workflowId });
  },

  /**
   * Remove an event trigger
   */
  removeTrigger: async (triggerId: string): Promise<void> => {
    return invoke<void>('remove_event_trigger', { triggerId });
  },

  /**
   * Trigger an event manually
   */
  triggerEvent: async (eventType: EventType, eventData: any): Promise<string[]> => {
    return invoke<string[]>('trigger_event', { eventType, eventData });
  },
};

/**
 * Webhook Trigger Service
 */
export const webhookTriggerService = {
  /**
   * Create a webhook trigger
   */
  createWebhook: async (workflowId: string, config: WebhookConfig): Promise<string> => {
    return invoke<string>('create_webhook_trigger', { workflowId, config });
  },

  /**
   * List webhook triggers
   */
  listWebhooks: async (workflowId?: string): Promise<Array<[string, string, WebhookConfig]>> => {
    return invoke<Array<[string, string, WebhookConfig]>>('list_webhook_triggers', { workflowId });
  },

  /**
   * Remove a webhook trigger
   */
  removeWebhook: async (webhookId: string): Promise<void> => {
    return invoke<void>('remove_webhook_trigger', { webhookId });
  },

  /**
   * Trigger a webhook
   */
  triggerWebhook: async (webhookId: string, request: WebhookRequest): Promise<WebhookResponse> => {
    return invoke<WebhookResponse>('trigger_webhook', { webhookId, request });
  },
};

// Extended workflow service with triggers
export default {
  ...baseWorkflowService,
  eventTrigger: eventTriggerService,
  webhookTrigger: webhookTriggerService,
};

