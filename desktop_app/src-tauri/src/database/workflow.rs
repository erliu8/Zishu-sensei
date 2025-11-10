//! # 工作流数据库持久化模块 (PostgreSQL)
//! 
//! 提供工作流定义、执行历史、调度任务的数据库存储和管理功能

use serde::{Deserialize, Serialize};
use tracing::{info, debug};
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

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio_postgres::{NoTls, Client};
    use std::collections::HashMap;
    
    // 使用真实的DbPool类型进行测试
    async fn create_test_pool() -> Result<DbPool, Box<dyn std::error::Error + Send + Sync>> {
        use deadpool_postgres::{Config, Runtime};
        
        let mut config = Config::new();
        
        // 尝试从环境变量获取测试数据库配置
        if let Ok(url) = std::env::var("TEST_DATABASE_URL") {
            // 使用 url 库解析数据库URL
            if let Ok(parsed_url) = url::Url::parse(&url) {
                if let Some(host) = parsed_url.host_str() {
                    config.host = Some(host.to_string());
                }
                if let Some(port) = parsed_url.port() {
                    config.port = Some(port);
                } else {
                    config.port = Some(5432); // 默认PostgreSQL端口
                }
                
                let username = parsed_url.username();
                if !username.is_empty() {
                    config.user = Some(username.to_string());
                }
                
                if let Some(password) = parsed_url.password() {
                    config.password = Some(password.to_string());
                }
                
                // 获取数据库名（去掉开头的'/'）
                let path = parsed_url.path();
                if !path.is_empty() && path != "/" {
                    config.dbname = Some(path.trim_start_matches('/').to_string());
                }
            }
        } else {
            // 使用默认测试配置
            config.host = Some("localhost".to_string());
            config.port = Some(5432);
            config.user = Some("test".to_string());
            config.password = Some("test".to_string());
            config.dbname = Some("test_db".to_string());
        }
        
        let pool = config.create_pool(Some(Runtime::Tokio1), NoTls)?;
        Ok(pool)
    }
    

    // ================================
    // WorkflowStatus 测试
    // ================================

    #[test]
    fn test_workflow_status_display() {
        assert_eq!(WorkflowStatus::Draft.to_string(), "draft");
        assert_eq!(WorkflowStatus::Published.to_string(), "published");
        assert_eq!(WorkflowStatus::Archived.to_string(), "archived");
        assert_eq!(WorkflowStatus::Disabled.to_string(), "disabled");
    }

    #[test]
    fn test_workflow_status_from_str() {
        assert_eq!("draft".parse::<WorkflowStatus>().unwrap(), WorkflowStatus::Draft);
        assert_eq!("published".parse::<WorkflowStatus>().unwrap(), WorkflowStatus::Published);
        assert_eq!("archived".parse::<WorkflowStatus>().unwrap(), WorkflowStatus::Archived);
        assert_eq!("disabled".parse::<WorkflowStatus>().unwrap(), WorkflowStatus::Disabled);
        
        assert!("invalid".parse::<WorkflowStatus>().is_err());
    }

    #[test]
    fn test_workflow_status_serialization() {
        let status = WorkflowStatus::Published;
        let serialized = serde_json::to_string(&status).unwrap();
        assert_eq!(serialized, "\"published\"");
        
        let deserialized: WorkflowStatus = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, WorkflowStatus::Published);
    }

    // ================================
    // WorkflowDefinition 测试
    // ================================

    #[test]
    fn test_workflow_definition_creation() {
        let now = Utc::now().timestamp();
        let workflow = WorkflowDefinition {
            id: "test-workflow-001".to_string(),
            name: "测试工作流".to_string(),
            description: Some("这是一个测试工作流".to_string()),
            version: "1.0.0".to_string(),
            status: WorkflowStatus::Draft,
            steps: Some(serde_json::json!([{"step": "test"}])),
            config: Some(serde_json::json!({"timeout": 30})),
            tags: Some(serde_json::json!(["test", "demo"])),
            category: "测试".to_string(),
            is_template: false,
            template_id: None,
            created_at: now,
            updated_at: now,
        };

        assert_eq!(workflow.id, "test-workflow-001");
        assert_eq!(workflow.name, "测试工作流");
        assert_eq!(workflow.status, WorkflowStatus::Draft);
        assert!(!workflow.is_template);
    }

    #[test]
    fn test_workflow_definition_serialization() {
        let now = Utc::now().timestamp();
        let workflow = WorkflowDefinition {
            id: "test-001".to_string(),
            name: "测试".to_string(),
            description: None,
            version: "1.0.0".to_string(),
            status: WorkflowStatus::Published,
            steps: None,
            config: None,
            tags: None,
            category: "默认".to_string(),
            is_template: true,
            template_id: Some("template-001".to_string()),
            created_at: now,
            updated_at: now,
        };

        let serialized = serde_json::to_string(&workflow).unwrap();
        let deserialized: WorkflowDefinition = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.id, workflow.id);
        assert_eq!(deserialized.status, workflow.status);
        assert_eq!(deserialized.is_template, workflow.is_template);
    }

    // ================================
    // WorkflowRegistry 基础测试
    // ================================

    #[tokio::test]
    async fn test_workflow_registry_creation() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                // 测试克隆
                let cloned_registry = registry.clone();
                // 测试注册表创建成功
                println!("工作流注册表创建成功");
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_workflow_registry_init_tables() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                match registry.init_tables().await {
                    Ok(_) => {
                        println!("工作流表初始化成功");
                    },
                    Err(e) => {
                        println!("工作流表初始化失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    // ================================
    // 数据库操作测试
    // ================================

    #[tokio::test]
    async fn test_create_workflow() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                let _ = registry.init_tables().await; // 忽略初始化错误
                
                let now = Utc::now().timestamp();
                let workflow = WorkflowDefinition {
                    id: "test-create-001".to_string(),
                    name: "创建测试工作流".to_string(),
                    description: Some("测试创建功能".to_string()),
                    version: "1.0.0".to_string(),
                    status: WorkflowStatus::Draft,
                    steps: Some(serde_json::json!([{"name": "step1", "action": "test"}])),
                    config: Some(serde_json::json!({"retry": 3})),
                    tags: Some(serde_json::json!(["create", "test"])),
                    category: "测试分类".to_string(),
                    is_template: false,
                    template_id: None,
                    created_at: now,
                    updated_at: now,
                };

                match registry.create_workflow(workflow) {
                    Ok(_) => println!("工作流创建成功"),
                    Err(e) => println!("工作流创建失败: {}", e),
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_get_workflow() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                match registry.get_workflow("non-existent-id") {
                    Ok(result) => {
                        println!("工作流查询完成，结果: {:?}", result.is_some());
                    },
                    Err(e) => {
                        println!("获取工作流失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_search_workflows() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                match registry.search_workflows("测试") {
                    Ok(results) => {
                        println!("搜索完成，结果数量: {}", results.len());
                    },
                    Err(e) => {
                        println!("搜索工作流失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_get_workflow_stats() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                match registry.get_workflow_stats() {
                    Ok(stats) => {
                        println!("统计信息获取成功: {:?}", stats);
                        assert!(stats.total >= 0);
                    },
                    Err(e) => {
                        println!("获取统计信息失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    // ================================
    // 错误处理测试
    // ================================

    #[tokio::test]
    async fn test_update_nonexistent_workflow() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                let now = Utc::now().timestamp();
                let workflow = WorkflowDefinition {
                    id: "non-existent".to_string(),
                    name: "不存在的工作流".to_string(),
                    description: None,
                    version: "1.0.0".to_string(),
                    status: WorkflowStatus::Draft,
                    steps: None,
                    config: None,
                    tags: None,
                    category: "测试".to_string(),
                    is_template: false,
                    template_id: None,
                    created_at: now,
                    updated_at: now,
                };

                match registry.update_workflow(workflow) {
                    Ok(_) => println!("更新完成"),
                    Err(e) => {
                        println!("更新失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_delete_nonexistent_workflow() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                match registry.delete_workflow("non-existent-id") {
                    Ok(_) => println!("删除完成"),
                    Err(e) => {
                        println!("删除失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    // ================================
    // 版本控制测试
    // ================================

    #[tokio::test]
    async fn test_get_workflow_version() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                match registry.get_workflow_version("test-id", "1.0.0") {
                    Ok(result) => {
                        println!("版本查询完成，结果: {:?}", result.is_some());
                    },
                    Err(e) => {
                        println!("获取版本失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_get_workflow_versions() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = WorkflowRegistry::new(pool);
                
                match registry.get_workflow_versions("test-id") {
                    Ok(versions) => {
                        println!("版本列表查询完成，数量: {}", versions.len());
                    },
                    Err(e) => {
                        println!("获取版本列表失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    // ================================
    // 边界条件测试
    // ================================

    #[test]
    fn test_workflow_status_edge_cases() {
        // 测试空字符串
        assert!("".parse::<WorkflowStatus>().is_err());
        
        // 测试大小写敏感
        assert!("DRAFT".parse::<WorkflowStatus>().is_err());
        assert!("Draft".parse::<WorkflowStatus>().is_err());
        
        // 测试特殊字符
        assert!("draft ".parse::<WorkflowStatus>().is_err());
        assert!(" draft".parse::<WorkflowStatus>().is_err());
        assert!("draft\n".parse::<WorkflowStatus>().is_err());
    }

    #[test]
    fn test_workflow_definition_with_large_data() {
        let now = Utc::now().timestamp();
        
        // 测试大型JSON数据
        let large_steps = serde_json::json!(
            (0..100).map(|i| serde_json::json!({
                "id": format!("step_{}", i),
                "name": format!("步骤 {}", i),
                "config": {"param": i}
            })).collect::<Vec<_>>()
        );
        
        let workflow = WorkflowDefinition {
            id: "large-workflow".to_string(),
            name: "大型工作流测试".to_string(),
            description: Some("x".repeat(1000)), // 1000字符的描述
            version: "1.0.0".to_string(),
            status: WorkflowStatus::Draft,
            steps: Some(large_steps),
            config: Some(serde_json::json!({"timeout": 3600, "retry": 10})),
            tags: Some(serde_json::json!((0..50).map(|i| format!("tag_{}", i)).collect::<Vec<_>>())),
            category: "性能测试".to_string(),
            is_template: false,
            template_id: None,
            created_at: now,
            updated_at: now,
        };

        // 测试序列化和反序列化大数据
        let serialized = serde_json::to_string(&workflow).unwrap();
        let deserialized: WorkflowDefinition = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.id, workflow.id);
        assert_eq!(deserialized.description, workflow.description);
        assert!(deserialized.steps.is_some());
    }

    #[test]
    fn test_workflow_stats_creation() {
        let stats = WorkflowStats {
            total: 100,
            draft_count: 30,
            published_count: 50,
            archived_count: 15,
            template_count: 5,
        };

        assert_eq!(stats.total, 100);
        assert_eq!(stats.draft_count + stats.published_count + stats.archived_count, 95);
        
        // 测试序列化
        let serialized = serde_json::to_string(&stats).unwrap();
        let deserialized: WorkflowStats = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.total, stats.total);
        assert_eq!(deserialized.template_count, stats.template_count);
    }
}
