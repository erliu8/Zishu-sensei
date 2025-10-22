//! # 工作流数据库持久化模块 (PostgreSQL)
//! 
//! 提供工作流定义、执行历史、调度任务的数据库存储和管理功能

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::Utc;
use tracing::{info, error, warn, debug};
use std::collections::HashMap;
use serde_json::Value as JsonValue;
use crate::database::DbPool;
use tokio::runtime::Handle;

// ================================
// 数据结构定义
// ================================

/// 工作流状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    Draft,
    Published,
    Archived,
    Disabled,
}

impl std::fmt::Display for WorkflowStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WorkflowStatus::Draft => write!(f, "draft"),
            WorkflowStatus::Published => write!(f, "published"),
            WorkflowStatus::Archived => write!(f, "archived"),
            WorkflowStatus::Disabled => write!(f, "disabled"),
        }
    }
}

impl std::str::FromStr for WorkflowStatus {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "draft" => Ok(WorkflowStatus::Draft),
            "published" => Ok(WorkflowStatus::Published),
            "archived" => Ok(WorkflowStatus::Archived),
            "disabled" => Ok(WorkflowStatus::Disabled),
            _ => Err(format!("无效的工作流状态: {}", s)),
        }
    }
}

/// 工作流定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: String,
    pub status: WorkflowStatus,
    pub steps: Option<JsonValue>,
    pub config: Option<JsonValue>,
    pub tags: Option<JsonValue>,
    pub category: String,
    pub is_template: bool,
    pub template_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 工作流注册表
pub struct WorkflowRegistry {
    pool: DbPool,
}

impl WorkflowRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建主工作流表
        client.execute(
            "CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                version TEXT NOT NULL DEFAULT '1.0.0',
                status TEXT NOT NULL,
                steps JSONB,
                config JSONB,
                tags JSONB,
                category TEXT NOT NULL DEFAULT '',
                is_template BOOLEAN NOT NULL DEFAULT false,
                template_id TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 创建索引
        client.batch_execute(
            "CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
             CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
             CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);
             CREATE INDEX IF NOT EXISTS idx_workflows_template_id ON workflows(template_id);
             CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);"
        ).await?;

        info!("工作流数据库表初始化完成");
        Ok(())
    }

    // ================================
    // CRUD 操作
    // ================================

    /// 创建工作流
    pub fn create_workflow(&self, workflow: WorkflowDefinition) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            client.execute(
                "INSERT INTO workflows (
                    id, name, description, version, status, steps, config, tags, 
                    category, is_template, template_id, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    version = EXCLUDED.version,
                    status = EXCLUDED.status,
                    steps = EXCLUDED.steps,
                    config = EXCLUDED.config,
                    tags = EXCLUDED.tags,
                    category = EXCLUDED.category,
                    is_template = EXCLUDED.is_template,
                    template_id = EXCLUDED.template_id,
                    updated_at = EXCLUDED.updated_at",
                &[
                    &workflow.id,
                    &workflow.name,
                    &workflow.description,
                    &workflow.version,
                    &workflow.status.to_string(),
                    &workflow.steps,
                    &workflow.config,
                    &workflow.tags,
                    &workflow.category,
                    &workflow.is_template,
                    &workflow.template_id,
                    &workflow.created_at,
                    &workflow.updated_at,
                ],
            ).await?;
            
            debug!("工作流已创建: {} ({})", workflow.name, workflow.id);
            Ok(())
        })
    }

    /// 获取单个工作流
    pub fn get_workflow(&self, id: &str) -> Result<Option<WorkflowDefinition>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, name, description, version, status, steps, config, tags,
                        category, is_template, template_id, created_at, updated_at
                 FROM workflows WHERE id = $1",
                &[&id],
            ).await?;
            
            if rows.is_empty() {
                return Ok(None);
            }
            
            let row = &rows[0];
            let status_str: String = row.get("status");
            
            Ok(Some(WorkflowDefinition {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                version: row.get("version"),
                status: status_str.parse().unwrap_or(WorkflowStatus::Draft),
                steps: row.get("steps"),
                config: row.get("config"),
                tags: row.get("tags"),
                category: row.get("category"),
                is_template: row.get("is_template"),
                template_id: row.get("template_id"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }))
        })
    }

    /// 获取所有工作流
    pub fn get_all_workflows(&self) -> Result<Vec<WorkflowDefinition>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, name, description, version, status, steps, config, tags,
                        category, is_template, template_id, created_at, updated_at
                 FROM workflows
                 ORDER BY created_at DESC",
                &[],
            ).await?;
            
            let mut workflows = Vec::new();
            for row in rows {
                let status_str: String = row.get("status");
                
                workflows.push(WorkflowDefinition {
                    id: row.get("id"),
                    name: row.get("name"),
                    description: row.get("description"),
                    version: row.get("version"),
                    status: status_str.parse().unwrap_or(WorkflowStatus::Draft),
                    steps: row.get("steps"),
                    config: row.get("config"),
                    tags: row.get("tags"),
                    category: row.get("category"),
                    is_template: row.get("is_template"),
                    template_id: row.get("template_id"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                });
            }
            
            Ok(workflows)
        })
    }

    /// 更新工作流
    pub fn update_workflow(&self, workflow: WorkflowDefinition) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows_affected = client.execute(
                "UPDATE workflows SET
                    name = $2,
                    description = $3,
                    version = $4,
                    status = $5,
                    steps = $6,
                    config = $7,
                    tags = $8,
                    category = $9,
                    is_template = $10,
                    template_id = $11,
                    updated_at = $12
                 WHERE id = $1",
                &[
                    &workflow.id,
                    &workflow.name,
                    &workflow.description,
                    &workflow.version,
                    &workflow.status.to_string(),
                    &workflow.steps,
                    &workflow.config,
                    &workflow.tags,
                    &workflow.category,
                    &workflow.is_template,
                    &workflow.template_id,
                    &workflow.updated_at,
                ],
            ).await?;
            
            if rows_affected == 0 {
                return Err(format!("工作流不存在: {}", workflow.id).into());
            }
            
            debug!("工作流已更新: {} ({})", workflow.name, workflow.id);
            Ok(())
        })
    }

    /// 删除工作流
    pub fn delete_workflow(&self, id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows_affected = client.execute(
                "DELETE FROM workflows WHERE id = $1",
                &[&id],
            ).await?;
            
            if rows_affected == 0 {
                return Err(format!("工作流不存在: {}", id).into());
            }
            
            debug!("工作流已删除: {}", id);
            Ok(())
        })
    }

    // ================================
    // 搜索和查询
    // ================================

    /// 搜索工作流（按名称或描述）
    pub fn search_workflows(&self, query: &str) -> Result<Vec<WorkflowDefinition>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let search_pattern = format!("%{}%", query);
            let rows = client.query(
                "SELECT id, name, description, version, status, steps, config, tags,
                        category, is_template, template_id, created_at, updated_at
                 FROM workflows
                 WHERE name ILIKE $1 OR description ILIKE $1
                 ORDER BY created_at DESC",
                &[&search_pattern],
            ).await?;
            
            let mut workflows = Vec::new();
            for row in rows {
                let status_str: String = row.get("status");
                
                workflows.push(WorkflowDefinition {
                    id: row.get("id"),
                    name: row.get("name"),
                    description: row.get("description"),
                    version: row.get("version"),
                    status: status_str.parse().unwrap_or(WorkflowStatus::Draft),
                    steps: row.get("steps"),
                    config: row.get("config"),
                    tags: row.get("tags"),
                    category: row.get("category"),
                    is_template: row.get("is_template"),
                    template_id: row.get("template_id"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                });
            }
            
            Ok(workflows)
        })
    }

    /// 获取所有模板
    pub fn get_templates(&self) -> Result<Vec<WorkflowDefinition>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, name, description, version, status, steps, config, tags,
                        category, is_template, template_id, created_at, updated_at
                 FROM workflows
                 WHERE is_template = true
                 ORDER BY created_at DESC",
                &[],
            ).await?;
            
            let mut workflows = Vec::new();
            for row in rows {
                let status_str: String = row.get("status");
                
                workflows.push(WorkflowDefinition {
                    id: row.get("id"),
                    name: row.get("name"),
                    description: row.get("description"),
                    version: row.get("version"),
                    status: status_str.parse().unwrap_or(WorkflowStatus::Draft),
                    steps: row.get("steps"),
                    config: row.get("config"),
                    tags: row.get("tags"),
                    category: row.get("category"),
                    is_template: row.get("is_template"),
                    template_id: row.get("template_id"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                });
            }
            
            Ok(workflows)
        })
    }

    /// 按分类获取工作流
    pub fn get_workflows_by_category(&self, category: &str) -> Result<Vec<WorkflowDefinition>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, name, description, version, status, steps, config, tags,
                        category, is_template, template_id, created_at, updated_at
                 FROM workflows
                 WHERE category = $1
                 ORDER BY created_at DESC",
                &[&category],
            ).await?;
            
            let mut workflows = Vec::new();
            for row in rows {
                let status_str: String = row.get("status");
                
                workflows.push(WorkflowDefinition {
                    id: row.get("id"),
                    name: row.get("name"),
                    description: row.get("description"),
                    version: row.get("version"),
                    status: status_str.parse().unwrap_or(WorkflowStatus::Draft),
                    steps: row.get("steps"),
                    config: row.get("config"),
                    tags: row.get("tags"),
                    category: row.get("category"),
                    is_template: row.get("is_template"),
                    template_id: row.get("template_id"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                });
            }
            
            Ok(workflows)
        })
    }

    // ================================
    // 版本控制
    // ================================

    /// 获取指定版本的工作流
    pub fn get_workflow_version(&self, id: &str, version: &str) -> Result<Option<WorkflowDefinition>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, name, description, version, status, steps, config, tags,
                        category, is_template, template_id, created_at, updated_at
                 FROM workflows
                 WHERE id = $1 AND version = $2",
                &[&id, &version],
            ).await?;
            
            if rows.is_empty() {
                return Ok(None);
            }
            
            let row = &rows[0];
            let status_str: String = row.get("status");
            
            Ok(Some(WorkflowDefinition {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                version: row.get("version"),
                status: status_str.parse().unwrap_or(WorkflowStatus::Draft),
                steps: row.get("steps"),
                config: row.get("config"),
                tags: row.get("tags"),
                category: row.get("category"),
                is_template: row.get("is_template"),
                template_id: row.get("template_id"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }))
        })
    }

    /// 获取工作流的所有版本
    pub fn get_workflow_versions(&self, id: &str) -> Result<Vec<WorkflowDefinition>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            // 注意：这个简化版本只返回当前版本
            // 完整版本需要一个单独的版本历史表
            let rows = client.query(
                "SELECT id, name, description, version, status, steps, config, tags,
                        category, is_template, template_id, created_at, updated_at
                 FROM workflows
                 WHERE id = $1
                 ORDER BY version DESC",
                &[&id],
            ).await?;
            
            let mut workflows = Vec::new();
            for row in rows {
                let status_str: String = row.get("status");
                
                workflows.push(WorkflowDefinition {
                    id: row.get("id"),
                    name: row.get("name"),
                    description: row.get("description"),
                    version: row.get("version"),
                    status: status_str.parse().unwrap_or(WorkflowStatus::Draft),
                    steps: row.get("steps"),
                    config: row.get("config"),
                    tags: row.get("tags"),
                    category: row.get("category"),
                    is_template: row.get("is_template"),
                    template_id: row.get("template_id"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                });
            }
            
            Ok(workflows)
        })
    }

    // ================================
    // 统计和维护
    // ================================

    /// 获取工作流统计信息
    pub fn get_workflow_stats(&self) -> Result<WorkflowStats, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let row = client.query_one(
                "SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
                    COUNT(*) FILTER (WHERE status = 'published') as published_count,
                    COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
                    COUNT(*) FILTER (WHERE is_template = true) as template_count
                 FROM workflows",
                &[],
            ).await?;
            
            Ok(WorkflowStats {
                total: row.get::<_, i64>("total") as usize,
                draft_count: row.get::<_, i64>("draft_count") as usize,
                published_count: row.get::<_, i64>("published_count") as usize,
                archived_count: row.get::<_, i64>("archived_count") as usize,
                template_count: row.get::<_, i64>("template_count") as usize,
            })
        })
    }
}

impl Clone for WorkflowRegistry {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
        }
    }
}

// ================================
// 辅助数据结构
// ================================

/// 工作流统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStats {
    pub total: usize,
    pub draft_count: usize,
    pub published_count: usize,
    pub archived_count: usize,
    pub template_count: usize,
}
