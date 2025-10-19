use super::models::*;
use super::expression::ExpressionEvaluator;
use crate::chat::ChatService;
use anyhow::{Result, anyhow};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use tracing::{info, warn, error, debug};
use uuid::Uuid;

/// Workflow execution engine
pub struct WorkflowEngine {
    /// Chat service for AI interactions
    chat_service: Arc<ChatService>,
    /// Active workflow executions
    executions: Arc<RwLock<HashMap<String, WorkflowExecution>>>,
}

/// Workflow execution state
#[derive(Debug, Clone)]
pub struct WorkflowExecution {
    pub workflow_id: String,
    pub execution_id: String,
    pub status: WorkflowExecutionStatus,
    pub current_step: Option<String>,
    pub variables: HashMap<String, JsonValue>,
    pub step_results: HashMap<String, StepResult>,
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum WorkflowExecutionStatus {
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Step execution result
#[derive(Debug, Clone)]
pub struct StepResult {
    pub step_id: String,
    pub status: StepStatus,
    pub output: Option<JsonValue>,
    pub error: Option<String>,
    pub start_time: i64,
    pub end_time: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

impl WorkflowEngine {
    /// Create a new workflow engine
    pub fn new(chat_service: Arc<ChatService>) -> Self {
        Self {
            chat_service,
            executions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Execute a workflow
    pub async fn execute_workflow(
        &self,
        workflow: Workflow,
        initial_variables: HashMap<String, JsonValue>,
    ) -> Result<String> {
        let execution_id = Uuid::new_v4().to_string();
        
        info!("开始执行工作流: {} (execution_id: {})", workflow.name, execution_id);

        // Create execution state
        let execution = WorkflowExecution {
            workflow_id: workflow.id.clone(),
            execution_id: execution_id.clone(),
            status: WorkflowExecutionStatus::Running,
            current_step: None,
            variables: initial_variables,
            step_results: HashMap::new(),
            start_time: chrono::Utc::now().timestamp(),
            end_time: None,
            error: None,
        };

        // Store execution
        {
            let mut executions = self.executions.write().await;
            executions.insert(execution_id.clone(), execution.clone());
        }

        // Execute in background
        let engine = self.clone();
        tokio::spawn(async move {
            if let Err(e) = engine.execute_workflow_internal(workflow, execution_id.clone()).await {
                error!("工作流执行失败: {}", e);
                engine.mark_execution_failed(execution_id, e.to_string()).await;
            }
        });

        Ok(execution_id)
    }

    /// Internal workflow execution
    async fn execute_workflow_internal(&self, workflow: Workflow, execution_id: String) -> Result<()> {
        let steps = workflow.steps.clone();
        
        for step in steps {
            // Check if execution was cancelled
            {
                let executions = self.executions.read().await;
                if let Some(exec) = executions.get(&execution_id) {
                    if exec.status == WorkflowExecutionStatus::Cancelled {
                        info!("工作流执行被取消: {}", execution_id);
                        return Ok(());
                    }
                }
            }

            // Update current step
            self.update_current_step(&execution_id, Some(step.id.clone())).await;

            // Check condition
            if let Some(condition) = &step.condition {
                if !self.evaluate_condition(&execution_id, condition).await? {
                    info!("步骤 {} 条件不满足，跳过", step.name);
                    self.mark_step_skipped(&execution_id, &step.id).await;
                    continue;
                }
            }

            // Execute step
            match self.execute_step(&execution_id, &step).await {
                Ok(result) => {
                    self.store_step_result(&execution_id, result).await;
                }
                Err(e) => {
                    error!("步骤执行失败: {} - {}", step.name, e);
                    
                    // Handle error based on error handling strategy
                    match step.error_handling.as_deref() {
                        Some("continue") => {
                            warn!("忽略错误，继续执行");
                            self.mark_step_failed(&execution_id, &step.id, e.to_string()).await;
                        }
                        Some("retry") => {
                            // Retry logic
                            let retry_count = step.retry_count.unwrap_or(3);
                            let mut success = false;
                            
                            for i in 1..=retry_count {
                                info!("重试步骤 {} (第 {}/{} 次)", step.name, i, retry_count);
                                tokio::time::sleep(tokio::time::Duration::from_secs(1 << i)).await;
                                
                                match self.execute_step(&execution_id, &step).await {
                                    Ok(result) => {
                                        self.store_step_result(&execution_id, result).await;
                                        success = true;
                                        break;
                                    }
                                    Err(retry_err) => {
                                        if i == retry_count {
                                            error!("重试失败: {}", retry_err);
                                        }
                                    }
                                }
                            }
                            
                            if !success {
                                return Err(anyhow!("步骤重试失败: {}", step.name));
                            }
                        }
                        _ => {
                            // Default: stop on error
                            return Err(e);
                        }
                    }
                }
            }
        }

        // Mark execution as completed
        self.mark_execution_completed(&execution_id).await;
        info!("工作流执行完成: {}", execution_id);

        Ok(())
    }

    /// Execute a single step
    async fn execute_step(&self, execution_id: &str, step: &WorkflowStep) -> Result<StepResult> {
        let start_time = chrono::Utc::now().timestamp();
        
        info!("执行步骤: {} (类型: {})", step.name, step.step_type);

        let output = match step.step_type.as_str() {
            "chat" => self.execute_chat_step(execution_id, step).await?,
            "transform" => self.execute_transform_step(execution_id, step).await?,
            "condition" => self.execute_condition_step(execution_id, step).await?,
            "loop" => self.execute_loop_step(execution_id, step).await?,
            "parallel" => self.execute_parallel_step(execution_id, step).await?,
            "delay" => self.execute_delay_step(execution_id, step).await?,
            _ => {
                return Err(anyhow!("未知的步骤类型: {}", step.step_type));
            }
        };

        Ok(StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Completed,
            output: Some(output),
            error: None,
            start_time,
            end_time: Some(chrono::Utc::now().timestamp()),
        })
    }

    /// Execute chat step
    async fn execute_chat_step(&self, execution_id: &str, step: &WorkflowStep) -> Result<JsonValue> {
        let config = step.config.as_ref()
            .ok_or_else(|| anyhow!("Chat步骤缺少配置"))?;

        // Get prompt from config
        let prompt_template = config.get("prompt")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Chat步骤缺少prompt配置"))?;

        // Replace variables in prompt
        let prompt = self.replace_variables(execution_id, prompt_template).await?;

        // Get model config
        let model = config.get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("default");

        let temperature = config.get("temperature")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.7);

        // TODO: Call chat service to get response
        // For now, return a placeholder
        info!("发送聊天请求: model={}, prompt={}", model, prompt);
        
        Ok(serde_json::json!({
            "response": "AI response placeholder",
            "model": model,
            "prompt": prompt
        }))
    }

    /// Execute transform step
    async fn execute_transform_step(&self, execution_id: &str, step: &WorkflowStep) -> Result<JsonValue> {
        let config = step.config.as_ref()
            .ok_or_else(|| anyhow!("Transform步骤缺少配置"))?;

        let input = config.get("input")
            .ok_or_else(|| anyhow!("Transform步骤缺少input配置"))?;

        let transform_type = config.get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("json");

        // Get variables
        let variables = self.get_execution_variables(execution_id).await?;

        // Apply transformation
        match transform_type {
            "json" => {
                // JSON transformation
                Ok(input.clone())
            }
            "text" => {
                // Text transformation
                let text = serde_json::to_string(input)?;
                Ok(JsonValue::String(text))
            }
            _ => {
                Err(anyhow!("未知的转换类型: {}", transform_type))
            }
        }
    }

    /// Execute condition step
    async fn execute_condition_step(&self, execution_id: &str, step: &WorkflowStep) -> Result<JsonValue> {
        let config = step.config.as_ref()
            .ok_or_else(|| anyhow!("Condition步骤缺少配置"))?;

        let condition = config.get("condition")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Condition步骤缺少condition配置"))?;

        let result = self.evaluate_condition(execution_id, condition).await?;

        Ok(JsonValue::Bool(result))
    }

    /// Execute loop step
    async fn execute_loop_step(&self, execution_id: &str, step: &WorkflowStep) -> Result<JsonValue> {
        let config = step.config.as_ref()
            .ok_or_else(|| anyhow!("Loop步骤缺少配置"))?;

        let loop_config: LoopStepConfig = serde_json::from_value(config.clone())
            .map_err(|e| anyhow!("无效的循环配置: {}", e))?;

        match loop_config.loop_type {
            LoopType::ForEach => self.execute_foreach_loop(execution_id, &loop_config).await,
            LoopType::While => self.execute_while_loop(execution_id, &loop_config).await,
            LoopType::Count => self.execute_count_loop(execution_id, &loop_config).await,
        }
    }

    /// Execute foreach loop
    async fn execute_foreach_loop(&self, execution_id: &str, config: &LoopStepConfig) -> Result<JsonValue> {
        let items = config.items.as_ref()
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow!("ForEach循环缺少items配置"))?;

        let mut results = Vec::new();
        let max_iterations = config.max_iterations.unwrap_or(u32::MAX);

        for (index, item) in items.iter().enumerate().take(max_iterations as usize) {
            debug!("执行ForEach循环迭代 {}/{}", index + 1, items.len().min(max_iterations as usize));
            
            // Set loop variables
            self.set_execution_variable(execution_id, &config.item_name, item.clone()).await;
            self.set_execution_variable(execution_id, "loop_index", JsonValue::from(index)).await;

            // Execute loop body steps
            let mut iteration_results = Vec::new();
            for body_step_id in &config.body_steps {
                // In real implementation, execute the body step
                iteration_results.push(item.clone());
            }

            results.push(JsonValue::Array(iteration_results));
        }

        Ok(JsonValue::Array(results))
    }

    /// Execute while loop
    async fn execute_while_loop(&self, execution_id: &str, config: &LoopStepConfig) -> Result<JsonValue> {
        let condition = config.condition.as_ref()
            .ok_or_else(|| anyhow!("While循环缺少condition配置"))?;

        let mut results = Vec::new();
        let max_iterations = config.max_iterations.unwrap_or(1000); // 防止无限循环
        let mut iteration = 0;

        while iteration < max_iterations {
            // Evaluate condition
            if !self.evaluate_condition(execution_id, condition).await? {
                break;
            }

            debug!("执行While循环迭代 {}", iteration + 1);

            // Set loop index
            self.set_execution_variable(execution_id, "loop_index", JsonValue::from(iteration)).await;

            // Execute loop body steps
            let mut iteration_results = Vec::new();
            for body_step_id in &config.body_steps {
                // In real implementation, execute the body step
                iteration_results.push(JsonValue::Null);
            }

            results.push(JsonValue::Array(iteration_results));
            iteration += 1;
        }

        if iteration >= max_iterations {
            warn!("While循环达到最大迭代次数限制: {}", max_iterations);
        }

        Ok(JsonValue::Array(results))
    }

    /// Execute count loop
    async fn execute_count_loop(&self, execution_id: &str, config: &LoopStepConfig) -> Result<JsonValue> {
        let count = if let Some(items) = &config.items {
            items.as_u64().ok_or_else(|| anyhow!("Count循环的items必须是数字"))?
        } else {
            return Err(anyhow!("Count循环缺少items配置"));
        };

        let max_iterations = config.max_iterations.unwrap_or(u32::MAX);
        let actual_count = count.min(max_iterations as u64);

        let mut results = Vec::new();

        for i in 0..actual_count {
            debug!("执行Count循环迭代 {}/{}", i + 1, actual_count);

            // Set loop variables
            self.set_execution_variable(execution_id, &config.item_name, JsonValue::from(i)).await;
            self.set_execution_variable(execution_id, "loop_index", JsonValue::from(i)).await;

            // Execute loop body steps
            let mut iteration_results = Vec::new();
            for body_step_id in &config.body_steps {
                // In real implementation, execute the body step
                iteration_results.push(JsonValue::from(i));
            }

            results.push(JsonValue::Array(iteration_results));
        }

        Ok(JsonValue::Array(results))
    }

    /// Execute parallel step
    async fn execute_parallel_step(&self, execution_id: &str, step: &WorkflowStep) -> Result<JsonValue> {
        let config = step.config.as_ref()
            .ok_or_else(|| anyhow!("Parallel步骤缺少配置"))?;

        let parallel_config: ParallelStepConfig = serde_json::from_value(config.clone())
            .map_err(|e| anyhow!("无效的并行配置: {}", e))?;

        let max_concurrent = parallel_config.max_concurrent.unwrap_or(10);
        info!("并行执行 {} 个任务，最大并发数: {}", parallel_config.tasks.len(), max_concurrent);

        // Create semaphore for concurrency control
        let semaphore = Arc::new(Semaphore::new(max_concurrent as usize));
        
        // Execute tasks in parallel
        let mut handles = Vec::new();

        for task in parallel_config.tasks.clone() {
            let sem = semaphore.clone();
            let exec_id = execution_id.to_string();
            let engine = self.clone();

            let handle = tokio::spawn(async move {
                let _permit = sem.acquire().await.unwrap();
                debug!("开始执行并行任务: {}", task.name);

                // Execute task steps
                let mut task_results = Vec::new();
                for step in &task.steps {
                    match engine.execute_step(&exec_id, step).await {
                        Ok(result) => task_results.push(result.output),
                        Err(e) => {
                            error!("并行任务失败 {}: {}", task.name, e);
                            return Err(e);
                        }
                    }
                }

                Ok(JsonValue::Array(task_results.into_iter().filter_map(|x| x).collect()))
            });

            handles.push((task.id.clone(), handle));
        }

        // Wait for all tasks to complete
        let mut results = Vec::new();
        let mut errors = Vec::new();

        for (task_id, handle) in handles {
            match handle.await {
                Ok(Ok(result)) => {
                    debug!("并行任务完成: {}", task_id);
                    results.push(result);
                }
                Ok(Err(e)) => {
                    error!("并行任务失败 {}: {}", task_id, e);
                    errors.push((task_id, e));
                }
                Err(e) => {
                    error!("并行任务panic {}: {}", task_id, e);
                    errors.push((task_id, anyhow!("任务panic: {}", e)));
                }
            }
        }

        // Handle failures based on strategy
        if !errors.is_empty() {
            match parallel_config.failure_strategy {
                ParallelFailureStrategy::FailFast => {
                    return Err(anyhow!("并行任务失败: {:?}", errors));
                }
                ParallelFailureStrategy::Continue => {
                    warn!("部分并行任务失败，继续执行: {} 个失败", errors.len());
                }
                ParallelFailureStrategy::WaitAll => {
                    // Already waited for all
                }
            }
        }

        Ok(JsonValue::Array(results))
    }

    /// Execute delay step
    async fn execute_delay_step(&self, _execution_id: &str, step: &WorkflowStep) -> Result<JsonValue> {
        let config = step.config.as_ref()
            .ok_or_else(|| anyhow!("Delay步骤缺少配置"))?;

        let duration = config.get("duration")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow!("Delay步骤缺少duration配置"))?;

        info!("延迟 {} 秒", duration);
        tokio::time::sleep(tokio::time::Duration::from_secs(duration as u64)).await;

        Ok(JsonValue::Null)
    }

    /// Evaluate a condition expression
    async fn evaluate_condition(&self, execution_id: &str, condition: &str) -> Result<bool> {
        let variables = self.get_execution_variables(execution_id).await?;
        let evaluator = ExpressionEvaluator::new(variables);
        evaluator.evaluate_boolean(condition)
    }

    /// Replace variables in a template string
    async fn replace_variables(&self, execution_id: &str, template: &str) -> Result<String> {
        let variables = self.get_execution_variables(execution_id).await?;
        let evaluator = ExpressionEvaluator::new(variables);
        Ok(evaluator.replace_variables(template))
    }

    /// Get execution variables
    async fn get_execution_variables(&self, execution_id: &str) -> Result<HashMap<String, JsonValue>> {
        let executions = self.executions.read().await;
        let execution = executions.get(execution_id)
            .ok_or_else(|| anyhow!("执行不存在: {}", execution_id))?;
        Ok(execution.variables.clone())
    }

    /// Set execution variable
    async fn set_execution_variable(&self, execution_id: &str, key: &str, value: JsonValue) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(execution_id) {
            execution.variables.insert(key.to_string(), value);
        }
    }

    /// Update current step
    async fn update_current_step(&self, execution_id: &str, step_id: Option<String>) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(execution_id) {
            execution.current_step = step_id;
        }
    }

    /// Store step result
    async fn store_step_result(&self, execution_id: &str, result: StepResult) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(execution_id) {
            execution.step_results.insert(result.step_id.clone(), result);
        }
    }

    /// Mark step as skipped
    async fn mark_step_skipped(&self, execution_id: &str, step_id: &str) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(execution_id) {
            execution.step_results.insert(step_id.to_string(), StepResult {
                step_id: step_id.to_string(),
                status: StepStatus::Skipped,
                output: None,
                error: None,
                start_time: chrono::Utc::now().timestamp(),
                end_time: Some(chrono::Utc::now().timestamp()),
            });
        }
    }

    /// Mark step as failed
    async fn mark_step_failed(&self, execution_id: &str, step_id: &str, error: String) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(execution_id) {
            execution.step_results.insert(step_id.to_string(), StepResult {
                step_id: step_id.to_string(),
                status: StepStatus::Failed,
                output: None,
                error: Some(error),
                start_time: chrono::Utc::now().timestamp(),
                end_time: Some(chrono::Utc::now().timestamp()),
            });
        }
    }

    /// Mark execution as completed
    async fn mark_execution_completed(&self, execution_id: &str) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(execution_id) {
            execution.status = WorkflowExecutionStatus::Completed;
            execution.end_time = Some(chrono::Utc::now().timestamp());
        }
    }

    /// Mark execution as failed
    async fn mark_execution_failed(&self, execution_id: String, error: String) {
        let mut executions = self.executions.write().await;
        if let Some(execution) = executions.get_mut(&execution_id) {
            execution.status = WorkflowExecutionStatus::Failed;
            execution.error = Some(error);
            execution.end_time = Some(chrono::Utc::now().timestamp());
        }
    }

    /// Cancel a workflow execution
    pub async fn cancel_execution(&self, execution_id: &str) -> Result<()> {
        let mut executions = self.executions.write().await;
        let execution = executions.get_mut(execution_id)
            .ok_or_else(|| anyhow!("执行不存在: {}", execution_id))?;

        execution.status = WorkflowExecutionStatus::Cancelled;
        execution.end_time = Some(chrono::Utc::now().timestamp());

        info!("工作流执行已取消: {}", execution_id);
        Ok(())
    }

    /// Pause a workflow execution
    pub async fn pause_execution(&self, execution_id: &str) -> Result<()> {
        let mut executions = self.executions.write().await;
        let execution = executions.get_mut(execution_id)
            .ok_or_else(|| anyhow!("执行不存在: {}", execution_id))?;

        if execution.status == WorkflowExecutionStatus::Running {
            execution.status = WorkflowExecutionStatus::Paused;
            info!("工作流执行已暂停: {}", execution_id);
        }

        Ok(())
    }

    /// Resume a workflow execution
    pub async fn resume_execution(&self, execution_id: &str) -> Result<()> {
        let mut executions = self.executions.write().await;
        let execution = executions.get_mut(execution_id)
            .ok_or_else(|| anyhow!("执行不存在: {}", execution_id))?;

        if execution.status == WorkflowExecutionStatus::Paused {
            execution.status = WorkflowExecutionStatus::Running;
            info!("工作流执行已恢复: {}", execution_id);
        }

        Ok(())
    }

    /// Get execution status
    pub async fn get_execution_status(&self, execution_id: &str) -> Result<WorkflowExecution> {
        let executions = self.executions.read().await;
        executions.get(execution_id)
            .cloned()
            .ok_or_else(|| anyhow!("执行不存在: {}", execution_id))
    }

    /// List all executions
    pub async fn list_executions(&self) -> Vec<WorkflowExecution> {
        let executions = self.executions.read().await;
        executions.values().cloned().collect()
    }
}

impl Clone for WorkflowEngine {
    fn clone(&self) -> Self {
        Self {
            chat_service: self.chat_service.clone(),
            executions: self.executions.clone(),
        }
    }
}

