use super::engine::WorkflowEngine;
use super::models::{Workflow, WorkflowTrigger};
use anyhow::{Result, anyhow};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use cron::Schedule;
use std::str::FromStr;

/// Workflow scheduler for automatic execution
pub struct WorkflowScheduler {
    /// Workflow engine
    engine: Arc<WorkflowEngine>,
    /// Scheduled workflows
    scheduled: Arc<RwLock<HashMap<String, ScheduledWorkflow>>>,
    /// Running flag
    running: Arc<RwLock<bool>>,
}

/// Scheduled workflow
#[derive(Debug, Clone)]
struct ScheduledWorkflow {
    workflow: Workflow,
    trigger: WorkflowTrigger,
    last_execution: Option<i64>,
    next_execution: Option<i64>,
}

impl WorkflowScheduler {
    /// Create a new workflow scheduler
    pub fn new(engine: Arc<WorkflowEngine>) -> Self {
        Self {
            engine,
            scheduled: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Start the scheduler
    pub async fn start(&self) -> Result<()> {
        let mut running = self.running.write().await;
        if *running {
            return Err(anyhow!("调度器已经在运行"));
        }
        *running = true;
        drop(running);

        info!("工作流调度器已启动");

        // Start scheduler loop
        let scheduler = self.clone();
        tokio::spawn(async move {
            scheduler.run_scheduler_loop().await;
        });

        Ok(())
    }

    /// Stop the scheduler
    pub async fn stop(&self) -> Result<()> {
        let mut running = self.running.write().await;
        if !*running {
            return Err(anyhow!("调度器未运行"));
        }
        *running = false;

        info!("工作流调度器已停止");
        Ok(())
    }

    /// Schedule a workflow
    pub async fn schedule_workflow(&self, workflow: Workflow) -> Result<()> {
        if let Some(trigger) = &workflow.trigger {
            let next_execution = self.calculate_next_execution(trigger)?;

            let scheduled = ScheduledWorkflow {
                workflow: workflow.clone(),
                trigger: trigger.clone(),
                last_execution: None,
                next_execution,
            };

            let mut scheduled_map = self.scheduled.write().await;
            scheduled_map.insert(workflow.id.clone(), scheduled);

            info!("工作流已调度: {} (下次执行: {:?})", workflow.name, next_execution);
        }

        Ok(())
    }

    /// Unschedule a workflow
    pub async fn unschedule_workflow(&self, workflow_id: &str) -> Result<()> {
        let mut scheduled = self.scheduled.write().await;
        scheduled.remove(workflow_id)
            .ok_or_else(|| anyhow!("工作流未调度: {}", workflow_id))?;

        info!("工作流调度已取消: {}", workflow_id);
        Ok(())
    }

    /// Trigger a workflow manually
    pub async fn trigger_workflow(
        &self,
        workflow: Workflow,
        variables: HashMap<String, JsonValue>,
    ) -> Result<String> {
        info!("手动触发工作流: {}", workflow.name);
        self.engine.execute_workflow(workflow, variables).await
    }

    /// Run scheduler loop
    async fn run_scheduler_loop(&self) {
        loop {
            // Check if scheduler should stop
            {
                let running = self.running.read().await;
                if !*running {
                    break;
                }
            }

            // Check scheduled workflows
            if let Err(e) = self.check_scheduled_workflows().await {
                error!("检查调度工作流失败: {}", e);
            }

            // Sleep for 10 seconds
            tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
        }
    }

    /// Check and execute scheduled workflows
    async fn check_scheduled_workflows(&self) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let mut to_execute = Vec::new();

        // Find workflows to execute
        {
            let scheduled = self.scheduled.read().await;
            for (workflow_id, scheduled_workflow) in scheduled.iter() {
                if let Some(next_execution) = scheduled_workflow.next_execution {
                    if next_execution <= now {
                        to_execute.push((workflow_id.clone(), scheduled_workflow.workflow.clone()));
                    }
                }
            }
        }

        // Execute workflows
        for (workflow_id, workflow) in to_execute {
            info!("执行调度的工作流: {}", workflow.name);

            match self.engine.execute_workflow(workflow.clone(), HashMap::new()).await {
                Ok(execution_id) => {
                    info!("工作流已启动: {} (execution_id: {})", workflow.name, execution_id);

                    // Update last execution and calculate next execution
                    let mut scheduled = self.scheduled.write().await;
                    if let Some(scheduled_workflow) = scheduled.get_mut(&workflow_id) {
                        scheduled_workflow.last_execution = Some(now);
                        
                        if let Ok(next) = self.calculate_next_execution(&scheduled_workflow.trigger) {
                            scheduled_workflow.next_execution = next;
                            info!("下次执行时间: {:?}", next);
                        }
                    }
                }
                Err(e) => {
                    error!("工作流执行失败: {} - {}", workflow.name, e);
                }
            }
        }

        Ok(())
    }

    /// Calculate next execution time based on trigger
    fn calculate_next_execution(&self, trigger: &WorkflowTrigger) -> Result<Option<i64>> {
        match trigger.trigger_type.as_str() {
            "manual" => Ok(None),
            "schedule" => {
                let schedule_str = trigger.config.as_ref()
                    .and_then(|c| c.get("schedule"))
                    .and_then(|s| s.as_str())
                    .ok_or_else(|| anyhow!("Schedule触发器缺少schedule配置"))?;

                // Parse cron expression
                let schedule = Schedule::from_str(schedule_str)
                    .map_err(|e| anyhow!("无效的cron表达式: {} - {}", schedule_str, e))?;

                // Get next execution time
                let now = chrono::Utc::now();
                if let Some(next) = schedule.upcoming(chrono::Utc).next() {
                    Ok(Some(next.timestamp()))
                } else {
                    Ok(None)
                }
            }
            "event" => {
                // Event-based triggers don't have a fixed schedule
                Ok(None)
            }
            "webhook" => {
                // Webhook triggers don't have a fixed schedule
                Ok(None)
            }
            _ => {
                Err(anyhow!("未知的触发器类型: {}", trigger.trigger_type))
            }
        }
    }

    /// List scheduled workflows
    pub async fn list_scheduled(&self) -> Vec<ScheduledWorkflowInfo> {
        let scheduled = self.scheduled.read().await;
        scheduled.iter().map(|(id, sw)| {
            ScheduledWorkflowInfo {
                workflow_id: id.clone(),
                workflow_name: sw.workflow.name.clone(),
                trigger_type: sw.trigger.trigger_type.clone(),
                last_execution: sw.last_execution,
                next_execution: sw.next_execution,
            }
        }).collect()
    }

    /// Get scheduler status
    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }
}

impl Clone for WorkflowScheduler {
    fn clone(&self) -> Self {
        Self {
            engine: self.engine.clone(),
            scheduled: self.scheduled.clone(),
            running: self.running.clone(),
        }
    }
}

/// Scheduled workflow info for display
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScheduledWorkflowInfo {
    pub workflow_id: String,
    pub workflow_name: String,
    pub trigger_type: String,
    pub last_execution: Option<i64>,
    pub next_execution: Option<i64>,
}

