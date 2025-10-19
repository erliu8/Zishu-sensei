/**
 * 工作流类型定义
 */

// ================================
// 工作流定义
// ================================

/**
 * 工作流状态
 */
export enum WorkflowStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
  Disabled = 'disabled',
}

/**
 * 执行状态
 */
export enum ExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * 步骤执行状态
 */
export enum StepExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
}

/**
 * 错误处理策略
 */
export enum ErrorStrategy {
  Stop = 'stop',
  Continue = 'continue',
  Retry = 'retry',
  Rollback = 'rollback',
}

/**
 * 退避策略
 */
export enum BackoffStrategy {
  Fixed = 'fixed',
  Linear = 'linear',
  Exponential = 'exponential',
}

/**
 * 循环类型
 */
export enum LoopType {
  ForEach = 'for_each',
  While = 'while',
  Count = 'count',
}

/**
 * 并行失败策略
 */
export enum ParallelFailureStrategy {
  WaitAll = 'wait_all',
  FailFast = 'fail_fast',
  Continue = 'continue',
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  timeout?: number;
  max_concurrent?: number;
  error_strategy: ErrorStrategy;
  retry_config?: RetryConfig;
  notification?: NotificationConfig;
  variables?: Record<string, VariableDefinition>;
  environment?: Record<string, string>;
  custom?: any;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  max_attempts: number;
  interval: number;
  backoff: BackoffStrategy;
  retry_on: string[];
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  on_success: boolean;
  on_failure: boolean;
  channels: string[];
  message_template?: string;
}

/**
 * 变量定义
 */
export interface VariableDefinition {
  var_type: string;
  default?: any;
  required: boolean;
  description?: string;
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  id: string;
  name: string;
  step_type: string;
  description?: string;
  config?: any;
  inputs?: Record<string, any>;
  outputs?: Record<string, string>;
  condition?: string;
  error_handling?: string;
  retry_count?: number;
  timeout?: number;
  depends_on: string[];
  allow_failure: boolean;
}

/**
 * 工作流触发器
 */
export interface WorkflowTrigger {
  trigger_type: string;
  config?: any;
}

/**
 * 工作流完整定义
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  config: WorkflowConfig;
  trigger?: WorkflowTrigger;
  tags: string[];
  category: string;
  is_template: boolean;
  template_id?: string;
  created_at: number;
  updated_at: number;
}

// ================================
// 工作流执行
// ================================

/**
 * 工作流执行状态
 */
export interface WorkflowExecution {
  workflow_id: string;
  execution_id: string;
  status: ExecutionStatus;
  current_step?: string;
  variables: Record<string, any>;
  step_results: Record<string, StepResult>;
  start_time: number;
  end_time?: number;
  error?: string;
}

/**
 * 步骤执行结果
 */
export interface StepResult {
  step_id: string;
  status: StepExecutionStatus;
  output?: any;
  error?: string;
  start_time: number;
  end_time?: number;
}

// ================================
// 工作流模板
// ================================

/**
 * 工作流模板
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  workflow: Workflow;
  parameters: TemplateParameter[];
  tags: string[];
  created_at: number;
  updated_at: number;
}

/**
 * 模板参数
 */
export interface TemplateParameter {
  name: string;
  param_type: string;
  default?: any;
  required: boolean;
  description?: string;
  validation?: any;
}

// ================================
// 工作流版本
// ================================

/**
 * 工作流版本
 */
export interface WorkflowVersion {
  id: number;
  workflow_id: string;
  version: string;
  workflow: Workflow;
  changelog?: string;
  created_by?: string;
  created_at: number;
}

// ================================
// 工作流调度
// ================================

/**
 * 调度工作流信息
 */
export interface ScheduledWorkflowInfo {
  workflow_id: string;
  workflow_name: string;
  trigger_type: string;
  last_execution?: number;
  next_execution?: number;
}

// ================================
// 导入/导出
// ================================

/**
 * 工作流导出格式
 */
export interface WorkflowExport {
  format_version: string;
  exported_at: number;
  workflows: Workflow[];
  templates: WorkflowTemplate[];
  metadata?: any;
}

/**
 * 导入结果
 */
export interface ImportResult {
  imported_workflows: string[];
  imported_templates: string[];
  success_count: number;
  error_count: number;
  errors: string[];
}

// ================================
// 步骤类型配置
// ================================

/**
 * 聊天步骤配置
 */
export interface ChatStepConfig {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
}

/**
 * 循环步骤配置
 */
export interface LoopStepConfig {
  loop_type: LoopType;
  items?: any;
  item_name: string;
  condition?: string;
  max_iterations?: number;
  body_steps: string[];
}

/**
 * 并行步骤配置
 */
export interface ParallelStepConfig {
  tasks: ParallelTask[];
  max_concurrent?: number;
  failure_strategy: ParallelFailureStrategy;
}

/**
 * 并行任务
 */
export interface ParallelTask {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

