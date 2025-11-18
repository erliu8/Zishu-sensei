//! Local LLM registry module
//!
//! Provides persistent storage and management for local LLM models

use serde::{Deserialize, Serialize};
use chrono::Utc;
use tracing::{info, error};
use crate::database::DbPool;
use std::collections::HashMap;

/// Local LLM model data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLLMModelData {
    pub id: String,
    pub name: String,
    pub model_path: String,
    pub model_type: String,
    pub size_bytes: i64,
    pub parameter_count: Option<i64>,
    pub description: Option<String>,
    pub supported_formats: Vec<String>,
    pub is_loaded: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Local LLM registry
pub struct LocalLLMRegistry {
    pool: DbPool,
}

impl LocalLLMRegistry {
    /// Create a new local LLM registry
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    /// Initialize database tables
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // Create local_llm_models table
        client.execute(
            "CREATE TABLE IF NOT EXISTS local_llm_models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model_path TEXT NOT NULL,
                model_type TEXT NOT NULL,
                size_bytes BIGINT NOT NULL,
                parameter_count BIGINT,
                description TEXT,
                supported_formats JSONB NOT NULL DEFAULT '[]',
                is_loaded BOOLEAN NOT NULL DEFAULT false,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{}'
            )",
            &[],
        ).await?;
        
        // Create indexes
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_llm_models_name ON local_llm_models(name)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_llm_models_type ON local_llm_models(model_type)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_local_llm_models_loaded ON local_llm_models(is_loaded)",
            &[],
        ).await?;
        
        info!("Local LLM表初始化完成");
        Ok(())
    }
    
    /// Register a new local LLM model
    pub async fn register_model(&self, model: LocalLLMModelData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let supported_formats_json = serde_json::to_value(&model.supported_formats)?;
        let metadata_json = serde_json::to_value(&model.metadata)?;
        
        client.execute(
            "INSERT INTO local_llm_models 
            (id, name, model_path, model_type, size_bytes, parameter_count, description, supported_formats, is_loaded, created_at, updated_at, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                model_path = EXCLUDED.model_path,
                model_type = EXCLUDED.model_type,
                size_bytes = EXCLUDED.size_bytes,
                parameter_count = EXCLUDED.parameter_count,
                description = EXCLUDED.description,
                supported_formats = EXCLUDED.supported_formats,
                is_loaded = EXCLUDED.is_loaded,
                updated_at = EXCLUDED.updated_at,
                metadata = EXCLUDED.metadata",
            &[
                &model.id,
                &model.name,
                &model.model_path,
                &model.model_type,
                &model.size_bytes,
                &model.parameter_count,
                &model.description,
                &supported_formats_json,
                &model.is_loaded,
                &model.created_at,
                &model.updated_at,
                &metadata_json,
            ],
        ).await?;
        
        info!("本地LLM模型注册成功: {}", model.id);
        Ok(())
    }
    
    /// Get a model by ID
    pub async fn get_model(&self, model_id: &str) -> Result<Option<LocalLLMModelData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT id, name, model_path, model_type, size_bytes, parameter_count, description, supported_formats, is_loaded, created_at, updated_at, metadata
            FROM local_llm_models WHERE id = $1",
            &[&model_id],
        ).await?;
        
        if let Some(row) = row_opt {
            let supported_formats_json: serde_json::Value = row.get("supported_formats");
            let supported_formats: Vec<String> = serde_json::from_value(supported_formats_json)?;
            
            let metadata_json: serde_json::Value = row.get("metadata");
            let metadata: HashMap<String, serde_json::Value> = serde_json::from_value(metadata_json)?;
            
            Ok(Some(LocalLLMModelData {
                id: row.get("id"),
                name: row.get("name"),
                model_path: row.get("model_path"),
                model_type: row.get("model_type"),
                size_bytes: row.get("size_bytes"),
                parameter_count: row.get("parameter_count"),
                description: row.get("description"),
                supported_formats,
                is_loaded: row.get("is_loaded"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                metadata,
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Get all models
    pub async fn get_all_models(&self) -> Result<Vec<LocalLLMModelData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, model_path, model_type, size_bytes, parameter_count, description, supported_formats, is_loaded, created_at, updated_at, metadata
            FROM local_llm_models ORDER BY created_at DESC",
            &[],
        ).await?;
        
        let mut models = Vec::new();
        for row in rows {
            let supported_formats_json: serde_json::Value = row.get("supported_formats");
            let supported_formats: Vec<String> = serde_json::from_value(supported_formats_json)?;
            
            let metadata_json: serde_json::Value = row.get("metadata");
            let metadata: HashMap<String, serde_json::Value> = serde_json::from_value(metadata_json)?;
            
            models.push(LocalLLMModelData {
                id: row.get("id"),
                name: row.get("name"),
                model_path: row.get("model_path"),
                model_type: row.get("model_type"),
                size_bytes: row.get("size_bytes"),
                parameter_count: row.get("parameter_count"),
                description: row.get("description"),
                supported_formats,
                is_loaded: row.get("is_loaded"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                metadata,
            });
        }
        
        Ok(models)
    }
    
    /// Update a model
    pub async fn update_model(&self, model_id: &str, model: LocalLLMModelData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let supported_formats_json = serde_json::to_value(&model.supported_formats)?;
        let metadata_json = serde_json::to_value(&model.metadata)?;
        
        client.execute(
            "UPDATE local_llm_models SET
            name = $2, model_path = $3, model_type = $4, size_bytes = $5, parameter_count = $6,
            description = $7, supported_formats = $8, is_loaded = $9, updated_at = $10, metadata = $11
            WHERE id = $1",
            &[
                &model_id,
                &model.name,
                &model.model_path,
                &model.model_type,
                &model.size_bytes,
                &model.parameter_count,
                &model.description,
                &supported_formats_json,
                &model.is_loaded,
                &model.updated_at,
                &metadata_json,
            ],
        ).await?;
        
        info!("本地LLM模型更新成功: {}", model_id);
        Ok(())
    }
    
    /// Delete a model
    pub async fn delete_model(&self, model_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "DELETE FROM local_llm_models WHERE id = $1",
            &[&model_id],
        ).await?;
        
        info!("本地LLM模型删除成功: {}", model_id);
        Ok(())
    }
    
    /// Set model loaded status
    pub async fn set_loaded_status(&self, model_id: &str, is_loaded: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "UPDATE local_llm_models SET is_loaded = $2, updated_at = $3 WHERE id = $1",
            &[&model_id, &is_loaded, &Utc::now().timestamp()],
        ).await?;
        
        info!("本地LLM模型加载状态更新: {} -> {}", model_id, is_loaded);
        Ok(())
    }
    
    /// Get loaded models
    pub async fn get_loaded_models(&self) -> Result<Vec<LocalLLMModelData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, model_path, model_type, size_bytes, parameter_count, description, supported_formats, is_loaded, created_at, updated_at, metadata
            FROM local_llm_models WHERE is_loaded = true ORDER BY created_at DESC",
            &[],
        ).await?;
        
        let mut models = Vec::new();
        for row in rows {
            let supported_formats_json: serde_json::Value = row.get("supported_formats");
            let supported_formats: Vec<String> = serde_json::from_value(supported_formats_json)?;
            
            let metadata_json: serde_json::Value = row.get("metadata");
            let metadata: HashMap<String, serde_json::Value> = serde_json::from_value(metadata_json)?;
            
            models.push(LocalLLMModelData {
                id: row.get("id"),
                name: row.get("name"),
                model_path: row.get("model_path"),
                model_type: row.get("model_type"),
                size_bytes: row.get("size_bytes"),
                parameter_count: row.get("parameter_count"),
                description: row.get("description"),
                supported_formats,
                is_loaded: row.get("is_loaded"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                metadata,
            });
        }
        
        Ok(models)
    }
}
