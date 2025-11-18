//! Character template registry module
//!
//! Provides persistent storage and management for character templates

use serde::{Deserialize, Serialize};
use chrono::Utc;
use tracing::{info, error};
use crate::database::DbPool;

/// Character template data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterTemplateData {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub live2d_model_id: String,
    pub prompt_id: String,
    pub prompt_name: String,
    pub prompt_content: String,
    pub llm_config_type: String, // "local" or "api"
    pub llm_config_data: String, // JSON string
    pub adapter_id: Option<String>,
    pub adapter_type: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Character template registry
pub struct CharacterTemplateRegistry {
    pool: DbPool,
}

impl CharacterTemplateRegistry {
    /// Create a new character template registry
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    /// Initialize database tables
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // Create character_templates table
        client.execute(
            "CREATE TABLE IF NOT EXISTS character_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                live2d_model_id TEXT NOT NULL,
                prompt_id TEXT NOT NULL,
                prompt_name TEXT NOT NULL,
                prompt_content TEXT NOT NULL,
                llm_config_type TEXT NOT NULL,
                llm_config_data TEXT NOT NULL,
                adapter_id TEXT,
                adapter_type TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;
        
        // Create indexes
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_templates_name ON character_templates(name)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_templates_model ON character_templates(live2d_model_id)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_templates_adapter ON character_templates(adapter_id)",
            &[],
        ).await?;
        
        info!("Character Template表初始化完成");
        Ok(())
    }
    
    /// Create a new character template
    pub async fn create_template(&self, template: CharacterTemplateData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "INSERT INTO character_templates 
            (id, name, description, live2d_model_id, prompt_id, prompt_name, prompt_content, llm_config_type, llm_config_data, adapter_id, adapter_type, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
            &[
                &template.id,
                &template.name,
                &template.description,
                &template.live2d_model_id,
                &template.prompt_id,
                &template.prompt_name,
                &template.prompt_content,
                &template.llm_config_type,
                &template.llm_config_data,
                &template.adapter_id,
                &template.adapter_type,
                &template.created_at,
                &template.updated_at,
            ],
        ).await?;
        
        info!("角色模板创建成功: {}", template.id);
        Ok(())
    }
    
    /// Get a template by ID
    pub async fn get_template(&self, template_id: &str) -> Result<Option<CharacterTemplateData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT id, name, description, live2d_model_id, prompt_id, prompt_name, prompt_content, llm_config_type, llm_config_data, adapter_id, adapter_type, created_at, updated_at
            FROM character_templates WHERE id = $1",
            &[&template_id],
        ).await?;
        
        if let Some(row) = row_opt {
            Ok(Some(CharacterTemplateData {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                live2d_model_id: row.get("live2d_model_id"),
                prompt_id: row.get("prompt_id"),
                prompt_name: row.get("prompt_name"),
                prompt_content: row.get("prompt_content"),
                llm_config_type: row.get("llm_config_type"),
                llm_config_data: row.get("llm_config_data"),
                adapter_id: row.get("adapter_id"),
                adapter_type: row.get("adapter_type"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Get all templates
    pub async fn get_all_templates(&self) -> Result<Vec<CharacterTemplateData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, description, live2d_model_id, prompt_id, prompt_name, prompt_content, llm_config_type, llm_config_data, adapter_id, adapter_type, created_at, updated_at
            FROM character_templates ORDER BY created_at DESC",
            &[],
        ).await?;
        
        let mut templates = Vec::new();
        for row in rows {
            templates.push(CharacterTemplateData {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                live2d_model_id: row.get("live2d_model_id"),
                prompt_id: row.get("prompt_id"),
                prompt_name: row.get("prompt_name"),
                prompt_content: row.get("prompt_content"),
                llm_config_type: row.get("llm_config_type"),
                llm_config_data: row.get("llm_config_data"),
                adapter_id: row.get("adapter_id"),
                adapter_type: row.get("adapter_type"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        
        Ok(templates)
    }
    
    /// Update a template
    pub async fn update_template(&self, template_id: &str, template: CharacterTemplateData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "UPDATE character_templates SET
            name = $2, description = $3, live2d_model_id = $4, prompt_id = $5, prompt_name = $6,
            prompt_content = $7, llm_config_type = $8, llm_config_data = $9, adapter_id = $10,
            adapter_type = $11, updated_at = $12
            WHERE id = $1",
            &[
                &template_id,
                &template.name,
                &template.description,
                &template.live2d_model_id,
                &template.prompt_id,
                &template.prompt_name,
                &template.prompt_content,
                &template.llm_config_type,
                &template.llm_config_data,
                &template.adapter_id,
                &template.adapter_type,
                &template.updated_at,
            ],
        ).await?;
        
        info!("角色模板更新成功: {}", template_id);
        Ok(())
    }
    
    /// Delete a template
    pub async fn delete_template(&self, template_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "DELETE FROM character_templates WHERE id = $1",
            &[&template_id],
        ).await?;
        
        info!("角色模板删除成功: {}", template_id);
        Ok(())
    }
    
    /// Get templates by Live2D model ID
    pub async fn get_templates_by_model(&self, model_id: &str) -> Result<Vec<CharacterTemplateData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, description, live2d_model_id, prompt_id, prompt_name, prompt_content, llm_config_type, llm_config_data, adapter_id, adapter_type, created_at, updated_at
            FROM character_templates WHERE live2d_model_id = $1 ORDER BY created_at DESC",
            &[&model_id],
        ).await?;
        
        let mut templates = Vec::new();
        for row in rows {
            templates.push(CharacterTemplateData {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                live2d_model_id: row.get("live2d_model_id"),
                prompt_id: row.get("prompt_id"),
                prompt_name: row.get("prompt_name"),
                prompt_content: row.get("prompt_content"),
                llm_config_type: row.get("llm_config_type"),
                llm_config_data: row.get("llm_config_data"),
                adapter_id: row.get("adapter_id"),
                adapter_type: row.get("adapter_type"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }
        
        Ok(templates)
    }
    
    /// Update adapter information
    pub async fn update_adapter_info(&self, template_id: &str, adapter_id: &str, adapter_type: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "UPDATE character_templates SET adapter_id = $2, adapter_type = $3, updated_at = $4 WHERE id = $1",
            &[&template_id, &adapter_id, &adapter_type, &Utc::now().timestamp()],
        ).await?;
        
        info!("角色模板适配器信息更新: {} -> {} ({})", template_id, adapter_id, adapter_type);
        Ok(())
    }
}
