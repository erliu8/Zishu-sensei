//! # 工作流模型定义
//! 
//! 完整的工作流、步骤、触发器、配置等数据模型

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

// ================================
// 工作流定义
// ================================

/// 工作流完整定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    /// 工作流ID
    pub id: String,
    /// 工作流名称
    pub name: String,
    /// 工作流描述
    pub description: Option<String>,
    /// 工作流版本
    pub version: String,
    /// 工作流状态
    pub status: WorkflowStatus,
    /// 工作流步骤列表
    pub steps: Vec<WorkflowStep>,
    /// 工作流配置
    pub config: WorkflowConfig,
    /// 工作流触发器
    pub trigger: Option<WorkflowTrigger>,
    /// 标签
    pub tags: Vec<String>,
    /// 分类
    pub category: String,
    /// 是否为模板
    pub is_template: bool,
    /// 父模板ID
    pub template_id: Option<String>,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 工作流状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    /// 草稿
    Draft,
    /// 已发布
    Published,
    /// 已归档
    Archived,
    /// 已禁用
    Disabled,
}

/// 工作流配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkflowConfig {
    /// 超时时间（秒）
    pub timeout: Option<i64>,
    /// 最大并发执行数
    pub max_concurrent: Option<i32>,
    /// 错误处理策略
    pub error_strategy: ErrorStrategy,
    /// 重试配置
    pub retry_config: Option<RetryConfig>,
    /// 通知配置
    pub notification: Option<NotificationConfig>,
    /// 变量定义
    pub variables: Option<HashMap<String, VariableDefinition>>,
    /// 环境配置
    pub environment: Option<HashMap<String, String>>,
    /// 自定义配置
    pub custom: Option<JsonValue>,
}

/// 错误处理策略
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorStrategy {
    /// 立即停止
    Stop,
    /// 继续执行
    Continue,
    /// 重试
    Retry,
    /// 回滚
    Rollback,
}

impl Default for ErrorStrategy {
    fn default() -> Self {
        ErrorStrategy::Stop
    }
}

/// 重试配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// 最大重试次数
    pub max_attempts: u32,
    /// 重试间隔（秒）
    pub interval: u64,
    /// 退避策略
    pub backoff: BackoffStrategy,
    /// 重试条件
    pub retry_on: Vec<String>,
}

/// 退避策略
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackoffStrategy {
    /// 固定间隔
    Fixed,
    /// 线性增长
    Linear,
    /// 指数增长
    Exponential,
}

/// 通知配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    /// 成功时通知
    pub on_success: bool,
    /// 失败时通知
    pub on_failure: bool,
    /// 通知渠道
    pub channels: Vec<String>,
    /// 自定义消息模板
    pub message_template: Option<String>,
}

/// 变量定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableDefinition {
    /// 变量类型
    pub var_type: String,
    /// 默认值
    pub default: Option<JsonValue>,
    /// 是否必需
    pub required: bool,
    /// 描述
    pub description: Option<String>,
}

// ================================
// 工作流步骤
// ================================

/// 工作流步骤定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// 步骤ID
    pub id: String,
    /// 步骤名称
    pub name: String,
    /// 步骤类型
    pub step_type: String,
    /// 步骤描述
    pub description: Option<String>,
    /// 步骤配置
    pub config: Option<JsonValue>,
    /// 输入映射
    pub inputs: Option<HashMap<String, JsonValue>>,
    /// 输出映射
    pub outputs: Option<HashMap<String, String>>,
    /// 执行条件
    pub condition: Option<String>,
    /// 错误处理
    pub error_handling: Option<String>,
    /// 重试次数
    pub retry_count: Option<u32>,
    /// 超时时间（秒）
    pub timeout: Option<i64>,
    /// 依赖步骤
    pub depends_on: Vec<String>,
    /// 是否允许失败
    pub allow_failure: bool,
}

// ================================
// 步骤类型实现
// ================================

/// 聊天步骤配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStepConfig {
    /// 提示词模板
    pub prompt: String,
    /// 模型名称
    pub model: Option<String>,
    /// 温度参数
    pub temperature: Option<f64>,
    /// 最大token数
    pub max_tokens: Option<u32>,
    /// 系统提示词
    pub system_prompt: Option<String>,
}

/// 转换步骤配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformStepConfig {
    /// 输入数据
    pub input: JsonValue,
    /// 转换类型
    pub transform_type: TransformType,
    /// 转换表达式
    pub expression: Option<String>,
    /// 转换脚本
    pub script: Option<String>,
}

/// 转换类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransformType {
    /// JSON转换
    Json,
    /// 文本转换
    Text,
    /// 表达式计算
    Expression,
    /// 脚本执行
    Script,
}

/// 条件步骤配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionStepConfig {
    /// 条件表达式
    pub condition: String,
    /// 条件为真时执行的步骤
    pub then_steps: Vec<String>,
    /// 条件为假时执行的步骤
    pub else_steps: Vec<String>,
}

/// 循环步骤配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopStepConfig {
    /// 循环类型
    pub loop_type: LoopType,
    /// 循环集合
    pub items: Option<JsonValue>,
    /// 循环变量名
    pub item_name: String,
    /// 循环条件
    pub condition: Option<String>,
    /// 最大迭代次数
    pub max_iterations: Option<u32>,
    /// 循环体步骤
    pub body_steps: Vec<String>,
}

/// 循环类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoopType {
    /// 遍历集合
    ForEach,
    /// While循环
    While,
    /// 计数循环
    Count,
}

/// 并行步骤配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelStepConfig {
    /// 并行执行的任务
    pub tasks: Vec<ParallelTask>,
    /// 最大并发数
    pub max_concurrent: Option<u32>,
    /// 失败策略
    pub failure_strategy: ParallelFailureStrategy,
}

/// 并行任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelTask {
    /// 任务ID
    pub id: String,
    /// 任务名称
    pub name: String,
    /// 任务步骤
    pub steps: Vec<WorkflowStep>,
}

/// 并行失败策略
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ParallelFailureStrategy {
    /// 等待所有任务完成
    WaitAll,
    /// 任一失败立即停止
    FailFast,
    /// 继续执行其他任务
    Continue,
}

/// 延迟步骤配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelayStepConfig {
    /// 延迟时间（秒）
    pub duration: i64,
    /// 延迟类型
    pub delay_type: DelayType,
}

/// 延迟类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DelayType {
    /// 固定延迟
    Fixed,
    /// 随机延迟
    Random,
    /// 等待直到指定时间
    Until,
}

// ================================
// 工作流触发器
// ================================

/// 工作流触发器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTrigger {
    /// 触发器类型
    pub trigger_type: String,
    /// 触发器配置
    pub config: Option<JsonValue>,
}

/// 定时触发器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleTriggerConfig {
    /// Cron表达式
    pub schedule: String,
    /// 时区
    pub timezone: Option<String>,
}

/// 事件触发器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTriggerConfig {
    /// 事件类型
    pub event_type: String,
    /// 事件过滤器
    pub filter: Option<JsonValue>,
}

/// Webhook触发器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookTriggerConfig {
    /// Webhook路径
    pub path: String,
    /// HTTP方法
    pub method: String,
    /// 验证配置
    pub authentication: Option<WebhookAuth>,
}

/// Webhook认证配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookAuth {
    /// 认证类型
    pub auth_type: String,
    /// 密钥
    pub secret: Option<String>,
    /// Token
    pub token: Option<String>,
}

// ================================
// 工作流模板
// ================================

/// 工作流模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplate {
    /// 模板ID
    pub id: String,
    /// 模板名称
    pub name: String,
    /// 模板描述
    pub description: Option<String>,
    /// 模板类型
    pub template_type: String,
    /// 模板内容
    pub workflow: Workflow,
    /// 模板参数
    pub parameters: Vec<TemplateParameter>,
    /// 模板标签
    pub tags: Vec<String>,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 模板参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateParameter {
    /// 参数名称
    pub name: String,
    /// 参数类型
    pub param_type: String,
    /// 默认值
    pub default: Option<JsonValue>,
    /// 是否必需
    pub required: bool,
    /// 参数描述
    pub description: Option<String>,
    /// 验证规则
    pub validation: Option<JsonValue>,
}

// ================================
// 工作流执行
// ================================

/// 工作流执行上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecutionContext {
    /// 执行ID
    pub execution_id: String,
    /// 工作流ID
    pub workflow_id: String,
    /// 工作流版本
    pub workflow_version: String,
    /// 执行状态
    pub status: ExecutionStatus,
    /// 输入变量
    pub input_variables: HashMap<String, JsonValue>,
    /// 运行时变量
    pub runtime_variables: HashMap<String, JsonValue>,
    /// 步骤结果
    pub step_results: HashMap<String, StepExecutionResult>,
    /// 开始时间
    pub start_time: i64,
    /// 结束时间
    pub end_time: Option<i64>,
    /// 错误信息
    pub error: Option<String>,
}

/// 执行状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    /// 等待中
    Pending,
    /// 执行中
    Running,
    /// 已暂停
    Paused,
    /// 已完成
    Completed,
    /// 失败
    Failed,
    /// 已取消
    Cancelled,
}

/// 步骤执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepExecutionResult {
    /// 步骤ID
    pub step_id: String,
    /// 步骤名称
    pub step_name: String,
    /// 执行状态
    pub status: StepExecutionStatus,
    /// 输入数据
    pub input: Option<JsonValue>,
    /// 输出数据
    pub output: Option<JsonValue>,
    /// 错误信息
    pub error: Option<String>,
    /// 重试次数
    pub retry_count: u32,
    /// 开始时间
    pub start_time: i64,
    /// 结束时间
    pub end_time: Option<i64>,
}

/// 步骤执行状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepExecutionStatus {
    /// 等待中
    Pending,
    /// 执行中
    Running,
    /// 已完成
    Completed,
    /// 失败
    Failed,
    /// 已跳过
    Skipped,
}

// ================================
// 工作流版本
// ================================

/// 工作流版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowVersion {
    /// 版本ID
    pub id: i64,
    /// 工作流ID
    pub workflow_id: String,
    /// 版本号
    pub version: String,
    /// 工作流定义
    pub workflow: Workflow,
    /// 变更说明
    pub changelog: Option<String>,
    /// 创建者
    pub created_by: Option<String>,
    /// 创建时间
    pub created_at: i64,
}

// ================================
// 导入/导出
// ================================

/// 工作流导出格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExport {
    /// 格式版本
    pub format_version: String,
    /// 导出时间
    pub exported_at: i64,
    /// 工作流列表
    pub workflows: Vec<Workflow>,
    /// 模板列表
    pub templates: Vec<WorkflowTemplate>,
    /// 元数据
    pub metadata: Option<JsonValue>,
}

impl WorkflowExport {
    /// 当前格式版本
    pub const CURRENT_VERSION: &'static str = "1.0.0";

    /// 创建新的导出对象
    pub fn new(workflows: Vec<Workflow>, templates: Vec<WorkflowTemplate>) -> Self {
        Self {
            format_version: Self::CURRENT_VERSION.to_string(),
            exported_at: chrono::Utc::now().timestamp(),
            workflows,
            templates,
            metadata: None,
        }
    }
}

// ================================
// 辅助函数
// ================================

impl Workflow {
    /// 验证工作流定义
    pub fn validate(&self) -> Result<(), String> {
        if self.name.is_empty() {
            return Err("工作流名称不能为空".to_string());
        }

        if self.steps.is_empty() {
            return Err("工作流至少需要一个步骤".to_string());
        }

        // 验证步骤依赖
        let step_ids: Vec<&String> = self.steps.iter().map(|s| &s.id).collect();
        for step in &self.steps {
            for dep in &step.depends_on {
                if !step_ids.contains(&dep) {
                    return Err(format!("步骤 {} 依赖的步骤 {} 不存在", step.name, dep));
                }
            }
        }

        // 检测循环依赖
        if self.has_circular_dependency() {
            return Err("工作流存在循环依赖".to_string());
        }

        Ok(())
    }

    /// 检测循环依赖
    fn has_circular_dependency(&self) -> bool {
        let mut visited = std::collections::HashSet::new();
        let mut stack = std::collections::HashSet::new();

        for step in &self.steps {
            if self.dfs_cycle_detect(&step.id, &mut visited, &mut stack) {
                return true;
            }
        }

        false
    }

    fn dfs_cycle_detect(
        &self,
        step_id: &str,
        visited: &mut std::collections::HashSet<String>,
        stack: &mut std::collections::HashSet<String>,
    ) -> bool {
        if stack.contains(step_id) {
            return true;
        }

        if visited.contains(step_id) {
            return false;
        }

        visited.insert(step_id.to_string());
        stack.insert(step_id.to_string());

        if let Some(step) = self.steps.iter().find(|s| s.id == step_id) {
            for dep in &step.depends_on {
                if self.dfs_cycle_detect(dep, visited, stack) {
                    return true;
                }
            }
        }

        stack.remove(step_id);
        false
    }

    /// 获取执行顺序
    pub fn get_execution_order(&self) -> Result<Vec<String>, String> {
        let mut order = Vec::new();
        let mut visited = std::collections::HashSet::new();

        for step in &self.steps {
            self.topological_sort(&step.id, &mut visited, &mut order)?;
        }

        order.reverse();
        Ok(order)
    }

    fn topological_sort(
        &self,
        step_id: &str,
        visited: &mut std::collections::HashSet<String>,
        order: &mut Vec<String>,
    ) -> Result<(), String> {
        if visited.contains(step_id) {
            return Ok(());
        }

        visited.insert(step_id.to_string());

        if let Some(step) = self.steps.iter().find(|s| s.id == step_id) {
            for dep in &step.depends_on {
                self.topological_sort(dep, visited, order)?;
            }
        }

        order.push(step_id.to_string());
        Ok(())
    }
}

