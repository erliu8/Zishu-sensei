//! # 工作流数据库持久化模块
//! 
//! 提供工作流定义、执行历史、调度任务的数据库存储和管理功能
//! 
//! ## 功能特性
//! - 工作流的 CRUD 操作
//! - 工作流版本控制
//! - 执行历史记录追踪
//! - 调度任务管理
//! - 模板管理
//! - 执行状态监控

use rusqlite::{Connection, params, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::Utc;
use tracing::{info, error, warn, debug};
use std::collections::HashMap;
use serde_json::Value as JsonValue;
use crate::database::DbPool;

// ================================
// 数据结构定义
// ================================

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
}

impl WorkflowStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            WorkflowStatus::Draft => "draft",
            WorkflowStatus::Published => "published",
            WorkflowStatus::Archived => "archived",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "draft" => WorkflowStatus::Draft,
            "published" => WorkflowStatus::Published,
            "archived" => WorkflowStatus::Archived,
            _ => WorkflowStatus::Draft,
        }
    }
}

/// 工作流执行状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    /// 等待中
    Pending,
    /// 执行中
    Running,
    /// 已完成
    Completed,
    /// 失败
    Failed,
    /// 已取消
    Cancelled,
    /// 已暂停
    Paused,
}

impl ExecutionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ExecutionStatus::Pending => "pending",
            ExecutionStatus::Running => "running",
            ExecutionStatus::Completed => "completed",
            ExecutionStatus::Failed => "failed",
            ExecutionStatus::Cancelled => "cancelled",
            ExecutionStatus::Paused => "paused",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => ExecutionStatus::Pending,
            "running" => ExecutionStatus::Running,
            "completed" => ExecutionStatus::Completed,
            "failed" => ExecutionStatus::Failed,
            "cancelled" => ExecutionStatus::Cancelled,
            "paused" => ExecutionStatus::Paused,
            _ => ExecutionStatus::Pending,
        }
    }
}

/// 步骤执行状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
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

impl StepStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            StepStatus::Pending => "pending",
            StepStatus::Running => "running",
            StepStatus::Completed => "completed",
            StepStatus::Failed => "failed",
            StepStatus::Skipped => "skipped",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => StepStatus::Pending,
            "running" => StepStatus::Running,
            "completed" => StepStatus::Completed,
            "failed" => StepStatus::Failed,
            "skipped" => StepStatus::Skipped,
            _ => StepStatus::Pending,
        }
    }
}

/// 工作流定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    /// 工作流 ID
    pub id: String,
    /// 名称
    pub name: String,
    /// 描述
    pub description: Option<String>,
    /// 版本
    pub version: String,
    /// 步骤定义（JSON）
    pub steps: String,
    /// 配置（JSON）
    pub config: String,
    /// 状态
    pub status: WorkflowStatus,
    /// 标签（JSON数组）
    pub tags: String,
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

/// 工作流执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    /// 执行ID
    pub id: String,
    /// 工作流ID
    pub workflow_id: String,
    /// 工作流版本
    pub workflow_version: String,
    /// 执行状态
    pub status: ExecutionStatus,
    /// 输入参数（JSON）
    pub input_data: Option<String>,
    /// 输出结果（JSON）
    pub output_data: Option<String>,
    /// 错误信息
    pub error: Option<String>,
    /// 开始时间
    pub started_at: Option<i64>,
    /// 结束时间
    pub finished_at: Option<i64>,
    /// 创建时间
    pub created_at: i64,
}

/// 步骤执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepExecution {
    /// 执行ID
    pub id: String,
    /// 工作流执行ID
    pub execution_id: String,
    /// 步骤ID
    pub step_id: String,
    /// 步骤名称
    pub step_name: String,
    /// 步骤类型
    pub step_type: String,
    /// 执行状态
    pub status: StepStatus,
    /// 输入数据（JSON）
    pub input_data: Option<String>,
    /// 输出数据（JSON）
    pub output_data: Option<String>,
    /// 错误信息
    pub error: Option<String>,
    /// 重试次数
    pub retry_count: i32,
    /// 开始时间
    pub started_at: Option<i64>,
    /// 结束时间
    pub finished_at: Option<i64>,
    /// 创建时间
    pub created_at: i64,
}

/// 工作流调度任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowSchedule {
    /// 调度ID
    pub id: String,
    /// 工作流ID
    pub workflow_id: String,
    /// 调度名称
    pub name: String,
    /// 调度类型（cron, interval, once, event）
    pub schedule_type: String,
    /// 调度表达式（cron表达式或间隔秒数）
    pub schedule_expr: String,
    /// 是否启用
    pub enabled: bool,
    /// 输入参数（JSON）
    pub input_data: Option<String>,
    /// 下次执行时间
    pub next_run_at: Option<i64>,
    /// 最后执行时间
    pub last_run_at: Option<i64>,
    /// 执行次数
    pub run_count: i64,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 工作流版本记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowVersion {
    /// 版本ID
    pub id: i64,
    /// 工作流ID
    pub workflow_id: String,
    /// 版本号
    pub version: String,
    /// 步骤定义（JSON）
    pub steps: String,
    /// 配置（JSON）
    pub config: String,
    /// 变更说明
    pub changelog: Option<String>,
    /// 创建时间
    pub created_at: i64,
}

/// 工作流统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStatistics {
    /// 工作流ID
    pub workflow_id: String,
    /// 总执行次数
    pub total_executions: i64,
    /// 成功次数
    pub successful_executions: i64,
    /// 失败次数
    pub failed_executions: i64,
    /// 平均执行时间（毫秒）
    pub avg_execution_time_ms: f64,
    /// 最后执行时间
    pub last_execution_at: Option<i64>,
}

// ================================
// 工作流数据库管理器
// ================================

/// 工作流数据库管理器
#[derive(Clone)]
pub struct WorkflowRegistry {
    pool: DbPool,
}

impl WorkflowRegistry {
    /// 创建新的工作流管理器
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let conn = self.pool.get()?;

        // 工作流定义表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS workflow_definitions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                version TEXT NOT NULL DEFAULT '1.0.0',
                steps TEXT NOT NULL,
                config TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                tags TEXT NOT NULL DEFAULT '[]',
                category TEXT NOT NULL DEFAULT 'general',
                is_template INTEGER NOT NULL DEFAULT 0,
                template_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (template_id) REFERENCES workflow_definitions(id)
            )",
            [],
        )?;

        // 工作流执行记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS workflow_executions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                workflow_version TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                input_data TEXT,
                output_data TEXT,
                error TEXT,
                started_at INTEGER,
                finished_at INTEGER,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id)
            )",
            [],
        )?;

        // 步骤执行记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS step_executions (
                id TEXT PRIMARY KEY,
                execution_id TEXT NOT NULL,
                step_id TEXT NOT NULL,
                step_name TEXT NOT NULL,
                step_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                input_data TEXT,
                output_data TEXT,
                error TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                started_at INTEGER,
                finished_at INTEGER,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 工作流调度任务表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS workflow_schedules (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                name TEXT NOT NULL,
                schedule_type TEXT NOT NULL,
                schedule_expr TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                input_data TEXT,
                next_run_at INTEGER,
                last_run_at INTEGER,
                run_count INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id)
            )",
            [],
        )?;

        // 工作流版本记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS workflow_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                version TEXT NOT NULL,
                steps TEXT NOT NULL,
                config TEXT NOT NULL,
                changelog TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id),
                UNIQUE(workflow_id, version)
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflow_definitions(status)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflow_definitions(category)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflow_definitions(is_template)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_step_executions_execution ON step_executions(execution_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_schedules_workflow ON workflow_schedules(workflow_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON workflow_schedules(next_run_at)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_versions_workflow ON workflow_versions(workflow_id)",
            [],
        )?;

        info!("工作流数据库表初始化完成");
        Ok(())
    }

    // ==================== 工作流定义 CRUD ====================

    /// 创建工作流
    pub fn create_workflow(&self, workflow: WorkflowDefinition) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "INSERT INTO workflow_definitions 
            (id, name, description, version, steps, config, status, tags, category, 
             is_template, template_id, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                workflow.id,
                workflow.name,
                workflow.description,
                workflow.version,
                workflow.steps,
                workflow.config,
                workflow.status.as_str(),
                workflow.tags,
                workflow.category,
                workflow.is_template as i32,
                workflow.template_id,
                workflow.created_at,
                workflow.updated_at,
            ],
        )?;

        // 创建版本记录
        self.create_version_internal(&conn, &workflow)?;

        info!("创建工作流: {} ({})", workflow.id, workflow.name);
        Ok(())
    }

    /// 更新工作流
    pub fn update_workflow(&self, workflow: WorkflowDefinition) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "UPDATE workflow_definitions SET
            name = ?1, description = ?2, version = ?3, steps = ?4, config = ?5,
            status = ?6, tags = ?7, category = ?8, is_template = ?9,
            template_id = ?10, updated_at = ?11
            WHERE id = ?12",
            params![
                workflow.name,
                workflow.description,
                workflow.version,
                workflow.steps,
                workflow.config,
                workflow.status.as_str(),
                workflow.tags,
                workflow.category,
                workflow.is_template as i32,
                workflow.template_id,
                workflow.updated_at,
                workflow.id,
            ],
        )?;

        // 创建新版本记录
        self.create_version_internal(&conn, &workflow)?;

        info!("更新工作流: {} ({})", workflow.id, workflow.name);
        Ok(())
    }

    /// 获取工作流
    pub fn get_workflow(&self, id: &str) -> SqliteResult<Option<WorkflowDefinition>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, steps, config, status, tags, category,
             is_template, template_id, created_at, updated_at
             FROM workflow_definitions WHERE id = ?1"
        )?;

        let result = stmt.query_row(params![id], |row| {
            Ok(WorkflowDefinition {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                steps: row.get(4)?,
                config: row.get(5)?,
                status: WorkflowStatus::from_str(&row.get::<_, String>(6)?),
                tags: row.get(7)?,
                category: row.get(8)?,
                is_template: row.get::<_, i32>(9)? != 0,
                template_id: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        });

        match result {
            Ok(workflow) => Ok(Some(workflow)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 删除工作流
    pub fn delete_workflow(&self, id: &str) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute("DELETE FROM workflow_definitions WHERE id = ?1", params![id])?;
        
        info!("删除工作流: {}", id);
        Ok(())
    }

    /// 获取所有工作流
    pub fn get_all_workflows(&self) -> SqliteResult<Vec<WorkflowDefinition>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, steps, config, status, tags, category,
             is_template, template_id, created_at, updated_at
             FROM workflow_definitions
             ORDER BY updated_at DESC"
        )?;

        let workflows = stmt.query_map([], |row| {
            Ok(WorkflowDefinition {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                steps: row.get(4)?,
                config: row.get(5)?,
                status: WorkflowStatus::from_str(&row.get::<_, String>(6)?),
                tags: row.get(7)?,
                category: row.get(8)?,
                is_template: row.get::<_, i32>(9)? != 0,
                template_id: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        workflows.collect()
    }

    /// 按分类获取工作流
    pub fn get_workflows_by_category(&self, category: &str) -> SqliteResult<Vec<WorkflowDefinition>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, steps, config, status, tags, category,
             is_template, template_id, created_at, updated_at
             FROM workflow_definitions
             WHERE category = ?1
             ORDER BY updated_at DESC"
        )?;

        let workflows = stmt.query_map(params![category], |row| {
            Ok(WorkflowDefinition {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                steps: row.get(4)?,
                config: row.get(5)?,
                status: WorkflowStatus::from_str(&row.get::<_, String>(6)?),
                tags: row.get(7)?,
                category: row.get(8)?,
                is_template: row.get::<_, i32>(9)? != 0,
                template_id: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        workflows.collect()
    }

    /// 获取所有模板
    pub fn get_templates(&self) -> SqliteResult<Vec<WorkflowDefinition>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, steps, config, status, tags, category,
             is_template, template_id, created_at, updated_at
             FROM workflow_definitions
             WHERE is_template = 1
             ORDER BY created_at DESC"
        )?;

        let templates = stmt.query_map([], |row| {
            Ok(WorkflowDefinition {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                steps: row.get(4)?,
                config: row.get(5)?,
                status: WorkflowStatus::from_str(&row.get::<_, String>(6)?),
                tags: row.get(7)?,
                category: row.get(8)?,
                is_template: row.get::<_, i32>(9)? != 0,
                template_id: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        templates.collect()
    }

    // ==================== 执行记录管理 ====================

    /// 创建执行记录
    pub fn create_execution(&self, execution: WorkflowExecution) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "INSERT INTO workflow_executions
            (id, workflow_id, workflow_version, status, input_data, output_data,
             error, started_at, finished_at, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                execution.id,
                execution.workflow_id,
                execution.workflow_version,
                execution.status.as_str(),
                execution.input_data,
                execution.output_data,
                execution.error,
                execution.started_at,
                execution.finished_at,
                execution.created_at,
            ],
        )?;

        debug!("创建执行记录: {}", execution.id);
        Ok(())
    }

    /// 更新执行记录
    pub fn update_execution(&self, execution: WorkflowExecution) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "UPDATE workflow_executions SET
            status = ?1, output_data = ?2, error = ?3, started_at = ?4, finished_at = ?5
            WHERE id = ?6",
            params![
                execution.status.as_str(),
                execution.output_data,
                execution.error,
                execution.started_at,
                execution.finished_at,
                execution.id,
            ],
        )?;

        debug!("更新执行记录: {}", execution.id);
        Ok(())
    }

    /// 获取执行记录
    pub fn get_execution(&self, id: &str) -> SqliteResult<Option<WorkflowExecution>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, workflow_version, status, input_data, output_data,
             error, started_at, finished_at, created_at
             FROM workflow_executions WHERE id = ?1"
        )?;

        let result = stmt.query_row(params![id], |row| {
            Ok(WorkflowExecution {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                workflow_version: row.get(2)?,
                status: ExecutionStatus::from_str(&row.get::<_, String>(3)?),
                input_data: row.get(4)?,
                output_data: row.get(5)?,
                error: row.get(6)?,
                started_at: row.get(7)?,
                finished_at: row.get(8)?,
                created_at: row.get(9)?,
            })
        });

        match result {
            Ok(execution) => Ok(Some(execution)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 获取工作流的执行历史
    pub fn get_workflow_executions(
        &self,
        workflow_id: &str,
        limit: Option<i64>,
    ) -> SqliteResult<Vec<WorkflowExecution>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let query = if let Some(limit) = limit {
            format!(
                "SELECT id, workflow_id, workflow_version, status, input_data, output_data,
                 error, started_at, finished_at, created_at
                 FROM workflow_executions
                 WHERE workflow_id = ?1
                 ORDER BY created_at DESC
                 LIMIT {}",
                limit
            )
        } else {
            "SELECT id, workflow_id, workflow_version, status, input_data, output_data,
             error, started_at, finished_at, created_at
             FROM workflow_executions
             WHERE workflow_id = ?1
             ORDER BY created_at DESC".to_string()
        };

        let mut stmt = conn.prepare(&query)?;

        let executions = stmt.query_map(params![workflow_id], |row| {
            Ok(WorkflowExecution {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                workflow_version: row.get(2)?,
                status: ExecutionStatus::from_str(&row.get::<_, String>(3)?),
                input_data: row.get(4)?,
                output_data: row.get(5)?,
                error: row.get(6)?,
                started_at: row.get(7)?,
                finished_at: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;

        executions.collect()
    }

    // ==================== 步骤执行记录管理 ====================

    /// 创建步骤执行记录
    pub fn create_step_execution(&self, step_exec: StepExecution) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "INSERT INTO step_executions
            (id, execution_id, step_id, step_name, step_type, status, input_data,
             output_data, error, retry_count, started_at, finished_at, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                step_exec.id,
                step_exec.execution_id,
                step_exec.step_id,
                step_exec.step_name,
                step_exec.step_type,
                step_exec.status.as_str(),
                step_exec.input_data,
                step_exec.output_data,
                step_exec.error,
                step_exec.retry_count,
                step_exec.started_at,
                step_exec.finished_at,
                step_exec.created_at,
            ],
        )?;

        debug!("创建步骤执行记录: {}", step_exec.id);
        Ok(())
    }

    /// 更新步骤执行记录
    pub fn update_step_execution(&self, step_exec: StepExecution) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "UPDATE step_executions SET
            status = ?1, output_data = ?2, error = ?3, retry_count = ?4,
            started_at = ?5, finished_at = ?6
            WHERE id = ?7",
            params![
                step_exec.status.as_str(),
                step_exec.output_data,
                step_exec.error,
                step_exec.retry_count,
                step_exec.started_at,
                step_exec.finished_at,
                step_exec.id,
            ],
        )?;

        debug!("更新步骤执行记录: {}", step_exec.id);
        Ok(())
    }

    /// 获取执行的步骤记录
    pub fn get_execution_steps(&self, execution_id: &str) -> SqliteResult<Vec<StepExecution>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, execution_id, step_id, step_name, step_type, status, input_data,
             output_data, error, retry_count, started_at, finished_at, created_at
             FROM step_executions
             WHERE execution_id = ?1
             ORDER BY created_at ASC"
        )?;

        let steps = stmt.query_map(params![execution_id], |row| {
            Ok(StepExecution {
                id: row.get(0)?,
                execution_id: row.get(1)?,
                step_id: row.get(2)?,
                step_name: row.get(3)?,
                step_type: row.get(4)?,
                status: StepStatus::from_str(&row.get::<_, String>(5)?),
                input_data: row.get(6)?,
                output_data: row.get(7)?,
                error: row.get(8)?,
                retry_count: row.get(9)?,
                started_at: row.get(10)?,
                finished_at: row.get(11)?,
                created_at: row.get(12)?,
            })
        })?;

        steps.collect()
    }

    // ==================== 调度任务管理 ====================

    /// 创建调度任务
    pub fn create_schedule(&self, schedule: WorkflowSchedule) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "INSERT INTO workflow_schedules
            (id, workflow_id, name, schedule_type, schedule_expr, enabled, input_data,
             next_run_at, last_run_at, run_count, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                schedule.id,
                schedule.workflow_id,
                schedule.name,
                schedule.schedule_type,
                schedule.schedule_expr,
                schedule.enabled as i32,
                schedule.input_data,
                schedule.next_run_at,
                schedule.last_run_at,
                schedule.run_count,
                schedule.created_at,
                schedule.updated_at,
            ],
        )?;

        info!("创建调度任务: {} ({})", schedule.id, schedule.name);
        Ok(())
    }

    /// 更新调度任务
    pub fn update_schedule(&self, schedule: WorkflowSchedule) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute(
            "UPDATE workflow_schedules SET
            name = ?1, schedule_type = ?2, schedule_expr = ?3, enabled = ?4,
            input_data = ?5, next_run_at = ?6, last_run_at = ?7, run_count = ?8,
            updated_at = ?9
            WHERE id = ?10",
            params![
                schedule.name,
                schedule.schedule_type,
                schedule.schedule_expr,
                schedule.enabled as i32,
                schedule.input_data,
                schedule.next_run_at,
                schedule.last_run_at,
                schedule.run_count,
                schedule.updated_at,
                schedule.id,
            ],
        )?;

        debug!("更新调度任务: {}", schedule.id);
        Ok(())
    }

    /// 获取调度任务
    pub fn get_schedule(&self, id: &str) -> SqliteResult<Option<WorkflowSchedule>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, name, schedule_type, schedule_expr, enabled,
             input_data, next_run_at, last_run_at, run_count, created_at, updated_at
             FROM workflow_schedules WHERE id = ?1"
        )?;

        let result = stmt.query_row(params![id], |row| {
            Ok(WorkflowSchedule {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                name: row.get(2)?,
                schedule_type: row.get(3)?,
                schedule_expr: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                input_data: row.get(6)?,
                next_run_at: row.get(7)?,
                last_run_at: row.get(8)?,
                run_count: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        });

        match result {
            Ok(schedule) => Ok(Some(schedule)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 删除调度任务
    pub fn delete_schedule(&self, id: &str) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute("DELETE FROM workflow_schedules WHERE id = ?1", params![id])?;
        
        info!("删除调度任务: {}", id);
        Ok(())
    }

    /// 获取工作流的调度任务
    pub fn get_workflow_schedules(&self, workflow_id: &str) -> SqliteResult<Vec<WorkflowSchedule>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, name, schedule_type, schedule_expr, enabled,
             input_data, next_run_at, last_run_at, run_count, created_at, updated_at
             FROM workflow_schedules
             WHERE workflow_id = ?1
             ORDER BY created_at DESC"
        )?;

        let schedules = stmt.query_map(params![workflow_id], |row| {
            Ok(WorkflowSchedule {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                name: row.get(2)?,
                schedule_type: row.get(3)?,
                schedule_expr: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                input_data: row.get(6)?,
                next_run_at: row.get(7)?,
                last_run_at: row.get(8)?,
                run_count: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        schedules.collect()
    }

    /// 获取待执行的调度任务
    pub fn get_pending_schedules(&self, current_time: i64) -> SqliteResult<Vec<WorkflowSchedule>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, name, schedule_type, schedule_expr, enabled,
             input_data, next_run_at, last_run_at, run_count, created_at, updated_at
             FROM workflow_schedules
             WHERE enabled = 1 AND next_run_at <= ?1
             ORDER BY next_run_at ASC"
        )?;

        let schedules = stmt.query_map(params![current_time], |row| {
            Ok(WorkflowSchedule {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                name: row.get(2)?,
                schedule_type: row.get(3)?,
                schedule_expr: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                input_data: row.get(6)?,
                next_run_at: row.get(7)?,
                last_run_at: row.get(8)?,
                run_count: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        schedules.collect()
    }

    // ==================== 版本管理 ====================

    /// 创建版本记录（内部使用）
    fn create_version_internal(
        &self,
        conn: &Connection,
        workflow: &WorkflowDefinition,
    ) -> SqliteResult<()> {
        conn.execute(
            "INSERT OR REPLACE INTO workflow_versions
            (workflow_id, version, steps, config, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                workflow.id,
                workflow.version,
                workflow.steps,
                workflow.config,
                Utc::now().timestamp(),
            ],
        )?;

        Ok(())
    }

    /// 获取工作流的所有版本
    pub fn get_workflow_versions(&self, workflow_id: &str) -> SqliteResult<Vec<WorkflowVersion>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, version, steps, config, changelog, created_at
             FROM workflow_versions
             WHERE workflow_id = ?1
             ORDER BY created_at DESC"
        )?;

        let versions = stmt.query_map(params![workflow_id], |row| {
            Ok(WorkflowVersion {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                version: row.get(2)?,
                steps: row.get(3)?,
                config: row.get(4)?,
                changelog: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        versions.collect()
    }

    /// 获取特定版本
    pub fn get_workflow_version(
        &self,
        workflow_id: &str,
        version: &str,
    ) -> SqliteResult<Option<WorkflowVersion>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, version, steps, config, changelog, created_at
             FROM workflow_versions
             WHERE workflow_id = ?1 AND version = ?2"
        )?;

        let result = stmt.query_row(params![workflow_id, version], |row| {
            Ok(WorkflowVersion {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                version: row.get(2)?,
                steps: row.get(3)?,
                config: row.get(4)?,
                changelog: row.get(5)?,
                created_at: row.get(6)?,
            })
        });

        match result {
            Ok(version) => Ok(Some(version)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    // ==================== 统计信息 ====================

    /// 获取工作流统计信息
    pub fn get_workflow_statistics(&self, workflow_id: &str) -> SqliteResult<WorkflowStatistics> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        // 总执行次数
        let total_executions: i64 = conn.query_row(
            "SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = ?1",
            params![workflow_id],
            |row| row.get(0),
        )?;

        // 成功次数
        let successful_executions: i64 = conn.query_row(
            "SELECT COUNT(*) FROM workflow_executions 
             WHERE workflow_id = ?1 AND status = 'completed'",
            params![workflow_id],
            |row| row.get(0),
        )?;

        // 失败次数
        let failed_executions: i64 = conn.query_row(
            "SELECT COUNT(*) FROM workflow_executions 
             WHERE workflow_id = ?1 AND status = 'failed'",
            params![workflow_id],
            |row| row.get(0),
        )?;

        // 平均执行时间
        let avg_execution_time_ms: f64 = conn.query_row(
            "SELECT AVG(finished_at - started_at) FROM workflow_executions 
             WHERE workflow_id = ?1 AND finished_at IS NOT NULL AND started_at IS NOT NULL",
            params![workflow_id],
            |row| row.get(0),
        ).unwrap_or(0.0);

        // 最后执行时间
        let last_execution_at: Option<i64> = conn.query_row(
            "SELECT MAX(created_at) FROM workflow_executions WHERE workflow_id = ?1",
            params![workflow_id],
            |row| row.get(0),
        ).ok();

        Ok(WorkflowStatistics {
            workflow_id: workflow_id.to_string(),
            total_executions,
            successful_executions,
            failed_executions,
            avg_execution_time_ms,
            last_execution_at,
        })
    }

    // ==================== 搜索和过滤 ====================

    /// 搜索工作流
    pub fn search_workflows(&self, keyword: &str) -> SqliteResult<Vec<WorkflowDefinition>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let pattern = format!("%{}%", keyword);
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, steps, config, status, tags, category,
             is_template, template_id, created_at, updated_at
             FROM workflow_definitions
             WHERE name LIKE ?1 OR description LIKE ?1 OR tags LIKE ?1
             ORDER BY updated_at DESC"
        )?;

        let workflows = stmt.query_map(params![pattern], |row| {
            Ok(WorkflowDefinition {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                steps: row.get(4)?,
                config: row.get(5)?,
                status: WorkflowStatus::from_str(&row.get::<_, String>(6)?),
                tags: row.get(7)?,
                category: row.get(8)?,
                is_template: row.get::<_, i32>(9)? != 0,
                template_id: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        workflows.collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use r2d2_sqlite::SqliteConnectionManager;
    use r2d2::Pool;

    fn create_test_registry() -> WorkflowRegistry {
        let manager = SqliteConnectionManager::memory();
        let pool = Pool::builder()
            .max_size(5)
            .build(manager)
            .unwrap();
        let registry = WorkflowRegistry::new(pool);
        registry.init_tables().unwrap();
        registry
    }

    #[test]
    fn test_create_and_get_workflow() {
        let registry = create_test_registry();
        
        let workflow = WorkflowDefinition {
            id: "test-workflow".to_string(),
            name: "Test Workflow".to_string(),
            description: Some("A test workflow".to_string()),
            version: "1.0.0".to_string(),
            steps: "[]".to_string(),
            config: "{}".to_string(),
            status: WorkflowStatus::Draft,
            tags: "[]".to_string(),
            category: "test".to_string(),
            is_template: false,
            template_id: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        };

        registry.create_workflow(workflow.clone()).unwrap();
        
        let retrieved = registry.get_workflow("test-workflow").unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test Workflow");
    }

    #[test]
    fn test_workflow_execution() {
        let registry = create_test_registry();
        
        let execution = WorkflowExecution {
            id: "exec-1".to_string(),
            workflow_id: "workflow-1".to_string(),
            workflow_version: "1.0.0".to_string(),
            status: ExecutionStatus::Running,
            input_data: Some("{}".to_string()),
            output_data: None,
            error: None,
            started_at: Some(Utc::now().timestamp()),
            finished_at: None,
            created_at: Utc::now().timestamp(),
        };

        registry.create_execution(execution).unwrap();
        
        let retrieved = registry.get_execution("exec-1").unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().status, ExecutionStatus::Running);
    }
}

