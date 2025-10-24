//! # 模型配置持久化模块
//! 
//! 提供聊天模型配置的数据库持久化存储和管理功能 (PostgreSQL)

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::Utc;
use tracing::{info, error, warn};
use std::collections::HashMap;
use crate::database::DbPool;

// ================================
// 数据结构定义
// ================================

/// 模型配置数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfigData {
    pub id: String,
    pub name: String,
    pub model_id: String,
    pub adapter_id: Option<String>,
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: Option<i32>,
    pub max_tokens: u32,
    pub frequency_penalty: f32,
    pub presence_penalty: f32,
    pub stop_sequences: Vec<String>,
    pub is_default: bool,
    pub is_enabled: bool,
    pub description: Option<String>,
    pub extra_config: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl ModelConfigData {
    /// Create default configuration
    pub fn default_config() -> Self {
        Self {
            id: "default".to_string(),
            name: "默认配置".to_string(),
            model_id: "default".to_string(),
            adapter_id: None,
            temperature: 0.7,
            top_p: 0.9,
            top_k: None,
            max_tokens: 2048,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            stop_sequences: vec![],
            is_default: true,
            is_enabled: true,
            description: Some("默认模型配置".to_string()),
            extra_config: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }

    pub fn creative_config() -> Self {
        Self {
            id: "creative".to_string(),
            name: "创意配置".to_string(),
            model_id: "creative".to_string(),
            adapter_id: None,
            temperature: 0.9,
            top_p: 0.95,
            top_k: None,
            max_tokens: 2048,
            frequency_penalty: 0.5,
            presence_penalty: 0.5,
            stop_sequences: vec![],
            is_default: false,
            is_enabled: true,
            description: Some("高创意性配置".to_string()),
            extra_config: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }

    pub fn precise_config() -> Self {
        Self {
            id: "precise".to_string(),
            name: "精确配置".to_string(),
            model_id: "precise".to_string(),
            adapter_id: None,
            temperature: 0.3,
            top_p: 0.85,
            top_k: None,
            max_tokens: 2048,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            stop_sequences: vec![],
            is_default: false,
            is_enabled: true,
            description: Some("高精确性配置".to_string()),
            extra_config: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }
}

/// 模型配置历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfigHistory {
    pub id: i64,
    pub config_id: String,
    pub action: String,
    pub old_data: Option<String>,
    pub new_data: Option<String>,
    pub reason: Option<String>,
    pub created_at: i64,
}

/// 配置验证结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

// ================================
// 模型配置管理器
// ================================

pub struct ModelConfigRegistry {
    pool: DbPool,
}

impl ModelConfigRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 保存模型配置 (同步包装)
    pub fn save_config(&self, config: ModelConfigData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        rt.block_on(async { self.save_config_async(config).await })
    }

    async fn save_config_async(&self, config: ModelConfigData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let timestamp = Utc::now().timestamp();

        let stop_sequences_json = serde_json::to_value(&config.stop_sequences)?;

        // If set as default, clear other defaults
        if config.is_default {
            client.execute(
                "UPDATE model_configs SET is_default = false WHERE is_default = true",
                &[],
            ).await?;
        }

        client.execute(
            "INSERT INTO model_configs 
            (id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                model_id = EXCLUDED.model_id,
                adapter_id = EXCLUDED.adapter_id,
                temperature = EXCLUDED.temperature,
                top_p = EXCLUDED.top_p,
                top_k = EXCLUDED.top_k,
                max_tokens = EXCLUDED.max_tokens,
                frequency_penalty = EXCLUDED.frequency_penalty,
                presence_penalty = EXCLUDED.presence_penalty,
                stop_sequences = EXCLUDED.stop_sequences,
                is_default = EXCLUDED.is_default,
                is_enabled = EXCLUDED.is_enabled,
                description = EXCLUDED.description,
                extra_config = EXCLUDED.extra_config,
                updated_at = EXCLUDED.updated_at",
            &[
                &config.id,
                &config.name,
                &config.model_id,
                &config.adapter_id,
                &config.temperature,
                &config.top_p,
                &config.top_k,
                &(config.max_tokens as i32),
                &config.frequency_penalty,
                &config.presence_penalty,
                &stop_sequences_json,
                &config.is_default,
                &config.is_enabled,
                &config.description,
                &config.extra_config,
                &timestamp,
                &timestamp,
            ],
        ).await?;

        info!("模型配置已保存: {}", config.id);
        Ok(())
    }

    /// 获取配置
    pub fn get_config(&self, config_id: &str) -> Result<Option<ModelConfigData>, Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        rt.block_on(async { self.get_config_async(config_id).await })
    }

    async fn get_config_async(&self, config_id: &str) -> Result<Option<ModelConfigData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs WHERE id = $1",
            &[&config_id],
        ).await?;

        Ok(row_opt.map(|row| self.row_to_config(&row)))
    }

    /// 获取所有配置
    pub fn get_all_configs(&self) -> Result<Vec<ModelConfigData>, Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        rt.block_on(async { self.get_all_configs_async().await })
    }

    async fn get_all_configs_async(&self) -> Result<Vec<ModelConfigData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, model_id, adapter_id, temperature, top_p, top_k, 
            max_tokens, frequency_penalty, presence_penalty, stop_sequences, 
            is_default, is_enabled, description, extra_config, created_at, updated_at
            FROM model_configs ORDER BY created_at DESC",
            &[],
        ).await?;

        Ok(rows.iter().map(|row| self.row_to_config(row)).collect())
    }

    /// 删除配置
    pub fn delete_config(&self, config_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        rt.block_on(async { self.delete_config_async(config_id).await })
    }

    async fn delete_config_async(&self, config_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "DELETE FROM model_configs WHERE id = $1",
            &[&config_id],
        ).await?;

        info!("模型配置已删除: {}", config_id);
        Ok(())
    }

    fn row_to_config(&self, row: &tokio_postgres::Row) -> ModelConfigData {
        let stop_sequences_value: serde_json::Value = row.get(10);
        let stop_sequences: Vec<String> = serde_json::from_value(stop_sequences_value).unwrap_or_default();

        ModelConfigData {
            id: row.get(0),
            name: row.get(1),
            model_id: row.get(2),
            adapter_id: row.get(3),
            temperature: row.get(4),
            top_p: row.get(5),
            top_k: row.get(6),
            max_tokens: row.get::<_, i32>(7) as u32,
            frequency_penalty: row.get(8),
            presence_penalty: row.get(9),
            stop_sequences,
            is_default: row.get(11),
            is_enabled: row.get(12),
            description: row.get(13),
            extra_config: row.get(14),
            created_at: row.get(15),
            updated_at: row.get(16),
        }
    }

    pub fn validate_config(&self, _config: &ModelConfigData) -> ValidationResult {
        ValidationResult {
            is_valid: true,
            errors: vec![],
            warnings: vec![],
        }
    }

    pub fn get_default_config(&self) -> Result<Option<ModelConfigData>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(None)
    }

    pub fn set_default_config(&self, _config_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }

    pub fn get_config_history(&self, _config_id: &str, _limit: Option<u32>) -> Result<Vec<ModelConfigHistory>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(vec![])
    }

    pub fn export_config(&self, _config_id: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        Ok("{}".to_string())
    }

    pub fn export_all_configs(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        Ok("[]".to_string())
    }

    pub fn import_configs(&self, _json: &str) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(vec![])
    }

    pub fn import_config(&self, _json: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        Ok(String::new())
    }
}
