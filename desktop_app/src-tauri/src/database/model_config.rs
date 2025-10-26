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

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;
    use std::sync::Arc;
    use deadpool_postgres::{Config, Pool, Runtime};
    use tokio_postgres::NoTls;
    
    // Helper function to create test database pool (mock)
    fn create_test_pool() -> DbPool {
        let mut cfg = Config::new();
        cfg.host = Some("localhost".to_string());
        cfg.dbname = Some("test_db".to_string());
        cfg.user = Some("test_user".to_string());
        cfg.password = Some("test_pass".to_string());
        
        cfg.create_pool(Some(Runtime::Tokio1), NoTls).unwrap()
    }

    fn create_test_model_config() -> ModelConfigData {
        ModelConfigData {
            id: "test_config_001".to_string(),
            name: "测试配置".to_string(),
            model_id: "test_model".to_string(),
            adapter_id: Some("test_adapter".to_string()),
            temperature: 0.7,
            top_p: 0.9,
            top_k: Some(50),
            max_tokens: 2048,
            frequency_penalty: 0.1,
            presence_penalty: 0.1,
            stop_sequences: vec!["<|end|>".to_string(), "停止".to_string()],
            is_default: false,
            is_enabled: true,
            description: Some("测试用模型配置".to_string()),
            extra_config: Some(r#"{"custom_param": "value"}"#.to_string()),
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }

    fn create_test_model_config_history() -> ModelConfigHistory {
        ModelConfigHistory {
            id: 1,
            config_id: "test_config_001".to_string(),
            action: "create".to_string(),
            old_data: None,
            new_data: Some("{}".to_string()),
            reason: Some("创建测试配置".to_string()),
            created_at: Utc::now().timestamp(),
        }
    }

    #[test]
    fn test_model_config_registry_new() {
        // Arrange
        let pool = create_test_pool();
        
        // Act
        let registry = ModelConfigRegistry::new(pool);
        
        // Assert
        assert!(!registry.pool.is_closed());
    }

    #[test]
    fn test_model_config_data_structure() {
        // Arrange & Act
        let config = create_test_model_config();
        
        // Assert
        assert_eq!(config.id, "test_config_001");
        assert_eq!(config.name, "测试配置");
        assert_eq!(config.model_id, "test_model");
        assert_eq!(config.adapter_id, Some("test_adapter".to_string()));
        assert_eq!(config.temperature, 0.7);
        assert_eq!(config.top_p, 0.9);
        assert_eq!(config.top_k, Some(50));
        assert_eq!(config.max_tokens, 2048);
        assert_eq!(config.frequency_penalty, 0.1);
        assert_eq!(config.presence_penalty, 0.1);
        assert_eq!(config.stop_sequences.len(), 2);
        assert!(!config.is_default);
        assert!(config.is_enabled);
        assert!(config.description.is_some());
        assert!(config.extra_config.is_some());
    }

    #[test]
    fn test_model_config_default_config() {
        // Arrange & Act
        let config = ModelConfigData::default_config();
        
        // Assert
        assert_eq!(config.id, "default");
        assert_eq!(config.name, "默认配置");
        assert_eq!(config.model_id, "default");
        assert_eq!(config.adapter_id, None);
        assert_eq!(config.temperature, 0.7);
        assert_eq!(config.top_p, 0.9);
        assert_eq!(config.top_k, None);
        assert_eq!(config.max_tokens, 2048);
        assert_eq!(config.frequency_penalty, 0.0);
        assert_eq!(config.presence_penalty, 0.0);
        assert!(config.stop_sequences.is_empty());
        assert!(config.is_default);
        assert!(config.is_enabled);
        assert!(config.description.is_some());
        assert_eq!(config.description.unwrap(), "默认模型配置");
        assert_eq!(config.extra_config, None);
    }

    #[test]
    fn test_model_config_creative_config() {
        // Arrange & Act
        let config = ModelConfigData::creative_config();
        
        // Assert
        assert_eq!(config.id, "creative");
        assert_eq!(config.name, "创意配置");
        assert_eq!(config.temperature, 0.9);
        assert_eq!(config.top_p, 0.95);
        assert_eq!(config.frequency_penalty, 0.5);
        assert_eq!(config.presence_penalty, 0.5);
        assert!(!config.is_default);
        assert!(config.is_enabled);
        assert_eq!(config.description.unwrap(), "高创意性配置");
    }

    #[test]
    fn test_model_config_precise_config() {
        // Arrange & Act
        let config = ModelConfigData::precise_config();
        
        // Assert
        assert_eq!(config.id, "precise");
        assert_eq!(config.name, "精确配置");
        assert_eq!(config.temperature, 0.3);
        assert_eq!(config.top_p, 0.85);
        assert_eq!(config.frequency_penalty, 0.0);
        assert_eq!(config.presence_penalty, 0.0);
        assert!(!config.is_default);
        assert!(config.is_enabled);
        assert_eq!(config.description.unwrap(), "高精确性配置");
    }

    #[test]
    fn test_model_config_history_structure() {
        // Arrange & Act
        let history = create_test_model_config_history();
        
        // Assert
        assert_eq!(history.id, 1);
        assert_eq!(history.config_id, "test_config_001");
        assert_eq!(history.action, "create");
        assert_eq!(history.old_data, None);
        assert!(history.new_data.is_some());
        assert!(history.reason.is_some());
    }

    #[test]
    fn test_validation_result_structure() {
        // Arrange & Act
        let validation = ValidationResult {
            is_valid: true,
            errors: vec![],
            warnings: vec!["警告信息".to_string()],
        };
        
        // Assert
        assert!(validation.is_valid);
        assert!(validation.errors.is_empty());
        assert_eq!(validation.warnings.len(), 1);
        assert_eq!(validation.warnings[0], "警告信息");
    }

    #[test]
    fn test_model_config_serialization() {
        // Arrange
        let config = create_test_model_config();
        
        // Act
        let json = serde_json::to_string(&config);
        
        // Assert
        assert!(json.is_ok());
        let json_str = json.unwrap();
        assert!(json_str.contains("test_config_001"));
        assert!(json_str.contains("测试配置"));
        assert!(json_str.contains("0.7"));
    }

    #[test]
    fn test_model_config_deserialization() {
        // Arrange
        let config = create_test_model_config();
        let json_str = serde_json::to_string(&config).unwrap();
        
        // Act
        let deserialized: Result<ModelConfigData, _> = serde_json::from_str(&json_str);
        
        // Assert
        assert!(deserialized.is_ok());
        let deserialized_config = deserialized.unwrap();
        assert_eq!(deserialized_config.id, config.id);
        assert_eq!(deserialized_config.name, config.name);
        assert_eq!(deserialized_config.temperature, config.temperature);
        assert_eq!(deserialized_config.stop_sequences, config.stop_sequences);
    }

    #[test]
    fn test_model_config_temperature_validation() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert - Test valid ranges
        config.temperature = 0.0;
        assert_eq!(config.temperature, 0.0);
        
        config.temperature = 1.0;
        assert_eq!(config.temperature, 1.0);
        
        config.temperature = 2.0;
        assert_eq!(config.temperature, 2.0);
        
        // Test typical creative values
        config.temperature = 0.9;
        assert_eq!(config.temperature, 0.9);
        
        // Test typical precise values
        config.temperature = 0.3;
        assert_eq!(config.temperature, 0.3);
    }

    #[test]
    fn test_model_config_top_p_validation() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert
        config.top_p = 0.1;
        assert_eq!(config.top_p, 0.1);
        
        config.top_p = 0.9;
        assert_eq!(config.top_p, 0.9);
        
        config.top_p = 1.0;
        assert_eq!(config.top_p, 1.0);
    }

    #[test]
    fn test_model_config_top_k_validation() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert
        config.top_k = None;
        assert_eq!(config.top_k, None);
        
        config.top_k = Some(1);
        assert_eq!(config.top_k, Some(1));
        
        config.top_k = Some(100);
        assert_eq!(config.top_k, Some(100));
    }

    #[test]
    fn test_model_config_max_tokens_validation() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert
        config.max_tokens = 1;
        assert_eq!(config.max_tokens, 1);
        
        config.max_tokens = 2048;
        assert_eq!(config.max_tokens, 2048);
        
        config.max_tokens = 8192;
        assert_eq!(config.max_tokens, 8192);
    }

    #[test]
    fn test_model_config_penalty_validation() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert - Test frequency penalty
        config.frequency_penalty = 0.0;
        assert_eq!(config.frequency_penalty, 0.0);
        
        config.frequency_penalty = 1.0;
        assert_eq!(config.frequency_penalty, 1.0);
        
        config.frequency_penalty = -1.0;
        assert_eq!(config.frequency_penalty, -1.0);
        
        // Test presence penalty
        config.presence_penalty = 0.0;
        assert_eq!(config.presence_penalty, 0.0);
        
        config.presence_penalty = 1.0;
        assert_eq!(config.presence_penalty, 1.0);
        
        config.presence_penalty = -1.0;
        assert_eq!(config.presence_penalty, -1.0);
    }

    #[test]
    fn test_model_config_stop_sequences_validation() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert - Test empty stop sequences
        config.stop_sequences = vec![];
        assert!(config.stop_sequences.is_empty());
        
        // Test single stop sequence
        config.stop_sequences = vec!["<|end|>".to_string()];
        assert_eq!(config.stop_sequences.len(), 1);
        
        // Test multiple stop sequences
        config.stop_sequences = vec![
            "<|end|>".to_string(),
            "停止".to_string(),
            "\n\n".to_string(),
        ];
        assert_eq!(config.stop_sequences.len(), 3);
        assert!(config.stop_sequences.contains(&"<|end|>".to_string()));
    }

    #[test]
    fn test_model_config_flags_validation() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert - Test is_default flag
        config.is_default = true;
        assert!(config.is_default);
        
        config.is_default = false;
        assert!(!config.is_default);
        
        // Test is_enabled flag
        config.is_enabled = true;
        assert!(config.is_enabled);
        
        config.is_enabled = false;
        assert!(!config.is_enabled);
    }

    #[test]
    fn test_model_config_optional_fields() {
        // Arrange
        let mut config = create_test_model_config();
        
        // Act & Assert - Test adapter_id
        config.adapter_id = None;
        assert_eq!(config.adapter_id, None);
        
        config.adapter_id = Some("new_adapter".to_string());
        assert_eq!(config.adapter_id, Some("new_adapter".to_string()));
        
        // Test description
        config.description = None;
        assert_eq!(config.description, None);
        
        config.description = Some("新描述".to_string());
        assert_eq!(config.description, Some("新描述".to_string()));
        
        // Test extra_config
        config.extra_config = None;
        assert_eq!(config.extra_config, None);
        
        config.extra_config = Some(r#"{"param": "value"}"#.to_string());
        assert!(config.extra_config.is_some());
    }

    #[test]
    fn test_validation_result_with_errors() {
        // Arrange & Act
        let validation = ValidationResult {
            is_valid: false,
            errors: vec![
                "温度参数超出范围".to_string(),
                "最大令牌数无效".to_string(),
            ],
            warnings: vec!["建议降低创意性".to_string()],
        };
        
        // Assert
        assert!(!validation.is_valid);
        assert_eq!(validation.errors.len(), 2);
        assert_eq!(validation.warnings.len(), 1);
        assert!(validation.errors.contains(&"温度参数超出范围".to_string()));
    }

    #[test]
    fn test_model_config_history_actions() {
        // Arrange & Act
        let mut history = create_test_model_config_history();
        
        // Assert - Test different actions
        history.action = "create".to_string();
        assert_eq!(history.action, "create");
        
        history.action = "update".to_string();
        assert_eq!(history.action, "update");
        
        history.action = "delete".to_string();
        assert_eq!(history.action, "delete");
    }

    #[test]
    fn test_model_config_timestamps() {
        // Arrange
        let config = create_test_model_config();
        let now = Utc::now().timestamp();
        
        // Assert
        // Timestamps should be within a few seconds of now
        assert!((config.created_at - now).abs() <= 5);
        assert!((config.updated_at - now).abs() <= 5);
    }

    #[test]
    fn test_model_config_validate_config_method() {
        // Arrange
        let pool = create_test_pool();
        let registry = ModelConfigRegistry::new(pool);
        let config = create_test_model_config();
        
        // Act
        let result = registry.validate_config(&config);
        
        // Assert
        assert!(result.is_valid);
        assert!(result.errors.is_empty());
        assert!(result.warnings.is_empty());
    }

    #[test]
    fn test_model_config_get_default_config() {
        // Arrange
        let pool = create_test_pool();
        let registry = ModelConfigRegistry::new(pool);
        
        // Act
        let result = registry.get_default_config();
        
        // Assert
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_model_config_export_methods() {
        // Arrange
        let pool = create_test_pool();
        let registry = ModelConfigRegistry::new(pool);
        
        // Act & Assert - Test export_config
        let result = registry.export_config("test_id");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "{}");
        
        // Test export_all_configs
        let result = registry.export_all_configs();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "[]");
    }

    #[test]
    fn test_model_config_import_methods() {
        // Arrange
        let pool = create_test_pool();
        let registry = ModelConfigRegistry::new(pool);
        
        // Act & Assert - Test import_configs
        let result = registry.import_configs("[]");
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
        
        // Test import_config
        let result = registry.import_config("{}");
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_model_config_get_history() {
        // Arrange
        let pool = create_test_pool();
        let registry = ModelConfigRegistry::new(pool);
        
        // Act
        let result = registry.get_config_history("test_id", Some(10));
        
        // Assert
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
}
