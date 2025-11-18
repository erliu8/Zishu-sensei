//! Prompt registry module
//!
//! Provides persistent storage and management for AI prompts

use serde::{Deserialize, Serialize};
use chrono::Utc;
use tracing::{info, error};
use crate::database::DbPool;
use std::collections::HashMap;

/// Prompt data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptData {
    pub id: String,
    pub name: String,
    pub content: String,
    pub description: Option<String>,
    pub model_id: Option<String>,
    pub character_setting: Option<String>,
    pub is_enabled: bool,
    pub is_default: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub usage_count: i64,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Prompt registry
pub struct PromptRegistry {
    pool: DbPool,
}

impl PromptRegistry {
    /// Create a new prompt registry
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    /// Initialize database tables
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // Create prompts table
        client.execute(
            "CREATE TABLE IF NOT EXISTS prompts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                description TEXT,
                model_id TEXT,
                character_setting TEXT,
                is_enabled BOOLEAN NOT NULL DEFAULT true,
                is_default BOOLEAN NOT NULL DEFAULT false,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                usage_count BIGINT NOT NULL DEFAULT 0,
                metadata JSONB NOT NULL DEFAULT '{}'
            )",
            &[],
        ).await?;
        
        // Create indexes
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_prompts_is_default ON prompts(is_default)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_prompts_model_id ON prompts(model_id)",
            &[],
        ).await?;
        
        info!("Prompt表初始化完成");
        Ok(())
    }
    
    /// Create a new prompt
    pub async fn create_prompt(&self, prompt: PromptData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let metadata_json = serde_json::to_value(&prompt.metadata)?;
        
        client.execute(
            "INSERT INTO prompts 
            (id, name, content, description, model_id, character_setting, is_enabled, is_default, created_at, updated_at, usage_count, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
            &[
                &prompt.id,
                &prompt.name,
                &prompt.content,
                &prompt.description,
                &prompt.model_id,
                &prompt.character_setting,
                &prompt.is_enabled,
                &prompt.is_default,
                &prompt.created_at,
                &prompt.updated_at,
                &prompt.usage_count,
                &metadata_json,
            ],
        ).await?;
        
        info!("Prompt创建成功: {}", prompt.id);
        Ok(())
    }
    
    /// Get a prompt by ID
    pub async fn get_prompt(&self, prompt_id: &str) -> Result<Option<PromptData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT id, name, content, description, model_id, character_setting, is_enabled, is_default, created_at, updated_at, usage_count, metadata
            FROM prompts WHERE id = $1",
            &[&prompt_id],
        ).await?;
        
        if let Some(row) = row_opt {
            let metadata_json: serde_json::Value = row.get("metadata");
            let metadata: HashMap<String, serde_json::Value> = serde_json::from_value(metadata_json)?;
            
            Ok(Some(PromptData {
                id: row.get("id"),
                name: row.get("name"),
                content: row.get("content"),
                description: row.get("description"),
                model_id: row.get("model_id"),
                character_setting: row.get("character_setting"),
                is_enabled: row.get("is_enabled"),
                is_default: row.get("is_default"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                usage_count: row.get("usage_count"),
                metadata,
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Get all prompts
    pub async fn get_all_prompts(&self) -> Result<Vec<PromptData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, content, description, model_id, character_setting, is_enabled, is_default, created_at, updated_at, usage_count, metadata
            FROM prompts ORDER BY created_at DESC",
            &[],
        ).await?;
        
        let mut prompts = Vec::new();
        for row in rows {
            let metadata_json: serde_json::Value = row.get("metadata");
            let metadata: HashMap<String, serde_json::Value> = serde_json::from_value(metadata_json)?;
            
            prompts.push(PromptData {
                id: row.get("id"),
                name: row.get("name"),
                content: row.get("content"),
                description: row.get("description"),
                model_id: row.get("model_id"),
                character_setting: row.get("character_setting"),
                is_enabled: row.get("is_enabled"),
                is_default: row.get("is_default"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                usage_count: row.get("usage_count"),
                metadata,
            });
        }
        
        Ok(prompts)
    }
    
    /// Update a prompt
    pub async fn update_prompt(&self, prompt_id: &str, prompt: PromptData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let metadata_json = serde_json::to_value(&prompt.metadata)?;
        
        client.execute(
            "UPDATE prompts SET
            name = $2, content = $3, description = $4, model_id = $5, character_setting = $6,
            is_enabled = $7, is_default = $8, updated_at = $9, usage_count = $10, metadata = $11
            WHERE id = $1",
            &[
                &prompt_id,
                &prompt.name,
                &prompt.content,
                &prompt.description,
                &prompt.model_id,
                &prompt.character_setting,
                &prompt.is_enabled,
                &prompt.is_default,
                &prompt.updated_at,
                &prompt.usage_count,
                &metadata_json,
            ],
        ).await?;
        
        info!("Prompt更新成功: {}", prompt_id);
        Ok(())
    }
    
    /// Delete a prompt
    pub async fn delete_prompt(&self, prompt_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "DELETE FROM prompts WHERE id = $1",
            &[&prompt_id],
        ).await?;
        
        info!("Prompt删除成功: {}", prompt_id);
        Ok(())
    }
    
    /// Get the default prompt
    pub async fn get_default_prompt(&self) -> Result<Option<PromptData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT id, name, content, description, model_id, character_setting, is_enabled, is_default, created_at, updated_at, usage_count, metadata
            FROM prompts WHERE is_default = true LIMIT 1",
            &[],
        ).await?;
        
        if let Some(row) = row_opt {
            let metadata_json: serde_json::Value = row.get("metadata");
            let metadata: HashMap<String, serde_json::Value> = serde_json::from_value(metadata_json)?;
            
            Ok(Some(PromptData {
                id: row.get("id"),
                name: row.get("name"),
                content: row.get("content"),
                description: row.get("description"),
                model_id: row.get("model_id"),
                character_setting: row.get("character_setting"),
                is_enabled: row.get("is_enabled"),
                is_default: row.get("is_default"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                usage_count: row.get("usage_count"),
                metadata,
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Set a prompt as default (unset others)
    pub async fn set_default_prompt(&self, prompt_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut client = self.pool.get().await?;
        
        // Start transaction
        let mut transaction = client.transaction().await?;
        
        // Unset all defaults
        transaction.execute(
            "UPDATE prompts SET is_default = false",
            &[],
        ).await?;
        
        // Set the new default
        transaction.execute(
            "UPDATE prompts SET is_default = true WHERE id = $1",
            &[&prompt_id],
        ).await?;
        
        transaction.commit().await?;
        
        info!("设置默认Prompt: {}", prompt_id);
        Ok(())
    }
    
    /// Increment usage count
    pub async fn increment_usage(&self, prompt_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "UPDATE prompts SET usage_count = usage_count + 1, updated_at = $2 WHERE id = $1",
            &[&prompt_id, &Utc::now().timestamp()],
        ).await?;
        
        Ok(())
    }
}
