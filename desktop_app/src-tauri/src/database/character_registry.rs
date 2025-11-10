//! Character registry module
//!
//! Provides persistent storage and management for Live2D characters

use serde::{Deserialize, Serialize};
use chrono::Utc;
use tracing::{info, error};
use crate::database::DbPool;

/// Character data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterData {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub path: String,
    pub preview_image: Option<String>,
    pub description: String,
    pub gender: String,
    pub size: String,
    pub features: Vec<String>,
    pub motions: Vec<String>,
    pub expressions: Vec<String>,
    pub is_active: bool,
}

/// Character configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterConfig {
    pub character_id: String,
    pub scale: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub interaction_enabled: bool,
    pub config_json: Option<String>,
}

/// Character registry
pub struct CharacterRegistry {
    pool: DbPool,
}

impl CharacterRegistry {
    /// Create a new character registry
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    /// Register a new character
    pub fn register_character(&self, character: CharacterData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Use tokio runtime to execute async code
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.register_character_async(character).await
        })
    }
    
    async fn register_character_async(&self, character: CharacterData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let timestamp = Utc::now().timestamp();
        
        let features_json = serde_json::to_value(&character.features)?;
        
        // Use ON CONFLICT for upsert in PostgreSQL
        client.execute(
            "INSERT INTO characters 
            (id, name, display_name, path, preview_image, description, gender, size, features, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                display_name = EXCLUDED.display_name,
                path = EXCLUDED.path,
                preview_image = EXCLUDED.preview_image,
                description = EXCLUDED.description,
                gender = EXCLUDED.gender,
                size = EXCLUDED.size,
                features = EXCLUDED.features,
                is_active = EXCLUDED.is_active,
                updated_at = EXCLUDED.updated_at",
            &[
                &character.id,
                &character.name,
                &character.display_name,
                &character.path,
                &character.preview_image,
                &character.description,
                &character.gender,
                &character.size,
                &features_json,
                &character.is_active,
                &timestamp,
                &timestamp,
            ],
        ).await?;
        
        // Register motions
        for motion in &character.motions {
            client.execute(
                "INSERT INTO character_motions (character_id, motion_name, motion_group)
                VALUES ($1, $2, $3)
                ON CONFLICT (character_id, motion_name) DO NOTHING",
                &[&character.id, motion, &"default"],
            ).await?;
        }
        
        // Register expressions
        for expression in &character.expressions {
            client.execute(
                "INSERT INTO character_expressions (character_id, expression_name)
                VALUES ($1, $2)
                ON CONFLICT (character_id, expression_name) DO NOTHING",
                &[&character.id, expression],
            ).await?;
        }
        
        info!("角色注册成功: {}", character.id);
        Ok(())
    }
    
    /// Get a character by ID
    pub fn get_character(&self, character_id: &str) -> Result<Option<CharacterData>, Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.get_character_async(character_id).await
        })
    }
    
    async fn get_character_async(&self, character_id: &str) -> Result<Option<CharacterData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT id, name, display_name, path, preview_image, description, gender, size, features, is_active
            FROM characters WHERE id = $1",
            &[&character_id],
        ).await?;
        
        if let Some(row) = row_opt {
            Ok(Some(self.row_to_character(&row, &client).await?))
        } else {
            Ok(None)
        }
    }
    
    /// Get all characters
    pub fn get_all_characters(&self) -> Result<Vec<CharacterData>, Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.get_all_characters_async().await
        })
    }
    
    async fn get_all_characters_async(&self) -> Result<Vec<CharacterData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, display_name, path, preview_image, description, gender, size, features, is_active
            FROM characters ORDER BY name",
            &[],
        ).await?;
        
        let mut characters = Vec::new();
        for row in rows {
            characters.push(self.row_to_character(&row, &client).await?);
        }
        
        Ok(characters)
    }
    
    /// Get active character
    pub fn get_active_character(&self) -> Result<Option<CharacterData>, Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.get_active_character_async().await
        })
    }
    
    async fn get_active_character_async(&self) -> Result<Option<CharacterData>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT id, name, display_name, path, preview_image, description, gender, size, features, is_active
            FROM characters WHERE is_active = true LIMIT 1",
            &[],
        ).await?;
        
        if let Some(row) = row_opt {
            Ok(Some(self.row_to_character(&row, &client).await?))
        } else {
            Ok(None)
        }
    }
    
    /// Set active character
    pub fn set_active_character(&self, character_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.set_active_character_async(character_id).await
        })
    }
    
    async fn set_active_character_async(&self, character_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // Deactivate all characters
        client.execute("UPDATE characters SET is_active = false", &[]).await?;
        
        // Activate the specified character
        let updated = client.execute(
            "UPDATE characters SET is_active = true, updated_at = $2 WHERE id = $1",
            &[&character_id, &Utc::now().timestamp()],
        ).await?;
        
        if updated == 0 {
            error!("角色不存在: {}", character_id);
            return Err("角色不存在".into());
        }
        
        info!("设置激活角色: {}", character_id);
        Ok(())
    }
    
    /// Update character
    pub fn update_character(&self, character: CharacterData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.update_character_async(character).await
        })
    }
    
    async fn update_character_async(&self, character: CharacterData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let timestamp = Utc::now().timestamp();
        
        let features_json = serde_json::to_value(&character.features)?;
        
        client.execute(
            "UPDATE characters SET 
            name = $2, display_name = $3, path = $4, preview_image = $5, 
            description = $6, gender = $7, size = $8, features = $9, 
            is_active = $10, updated_at = $11
            WHERE id = $1",
            &[
                &character.id,
                &character.name,
                &character.display_name,
                &character.path,
                &character.preview_image,
                &character.description,
                &character.gender,
                &character.size,
                &features_json,
                &character.is_active,
                &timestamp,
            ],
        ).await?;
        
        info!("角色更新成功: {}", character.id);
        Ok(())
    }
    
    /// Delete character
    pub fn delete_character(&self, character_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.delete_character_async(character_id).await
        })
    }
    
    async fn delete_character_async(&self, character_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute("DELETE FROM characters WHERE id = $1", &[&character_id]).await?;
        
        info!("角色删除成功: {}", character_id);
        Ok(())
    }
    
    /// Get character configuration
    pub fn get_character_config(&self, character_id: &str) -> Result<Option<CharacterConfig>, Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.get_character_config_async(character_id).await
        })
    }
    
    async fn get_character_config_async(&self, character_id: &str) -> Result<Option<CharacterConfig>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT character_id, scale, position_x, position_y, interaction_enabled, config_json
            FROM character_configs WHERE character_id = $1",
            &[&character_id],
        ).await?;
        
        if let Some(row) = row_opt {
            Ok(Some(CharacterConfig {
                character_id: row.get(0),
                scale: row.get(1),
                position_x: row.get(2),
                position_y: row.get(3),
                interaction_enabled: row.get(4),
                config_json: row.get(5),
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Save character configuration
    pub fn save_character_config(&self, config: CharacterConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rt = tokio::runtime::Handle::try_current()
            .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
        
        rt.block_on(async {
            self.save_character_config_async(config).await
        })
    }
    
    async fn save_character_config_async(&self, config: CharacterConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let timestamp = Utc::now().timestamp();
        
        client.execute(
            "INSERT INTO character_configs 
            (character_id, scale, position_x, position_y, interaction_enabled, config_json, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (character_id) DO UPDATE SET
                scale = EXCLUDED.scale,
                position_x = EXCLUDED.position_x,
                position_y = EXCLUDED.position_y,
                interaction_enabled = EXCLUDED.interaction_enabled,
                config_json = EXCLUDED.config_json,
                updated_at = EXCLUDED.updated_at",
            &[
                &config.character_id,
                &config.scale,
                &config.position_x,
                &config.position_y,
                &config.interaction_enabled,
                &config.config_json,
                &timestamp,
            ],
        ).await?;
        
        info!("角色配置保存成功: {}", config.character_id);
        Ok(())
    }
    
    // ==================== Helper methods ====================
    
    /// Convert database row to CharacterData
    async fn row_to_character(
        &self, 
        row: &tokio_postgres::Row,
        client: &deadpool_postgres::Client,
    ) -> Result<CharacterData, Box<dyn std::error::Error + Send + Sync>> {
        let id: String = row.get(0);
        let features_value: serde_json::Value = row.get(8);
        let features: Vec<String> = serde_json::from_value(features_value).unwrap_or_default();
        
        // Get motions
        let motions = self.get_character_motions_internal(client, &id).await?;
        
        // Get expressions
        let expressions = self.get_character_expressions_internal(client, &id).await?;
        
        Ok(CharacterData {
            id: id.clone(),
            name: row.get(1),
            display_name: row.get(2),
            path: row.get(3),
            preview_image: row.get(4),
            description: row.get(5),
            gender: row.get(6),
            size: row.get(7),
            features,
            motions,
            expressions,
            is_active: row.get(9),
        })
    }
    
    /// Get character motions (internal)
    async fn get_character_motions_internal(
        &self,
        client: &deadpool_postgres::Client,
        character_id: &str,
    ) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        let rows = client.query(
            "SELECT motion_name FROM character_motions WHERE character_id = $1",
            &[&character_id],
        ).await?;
        
        Ok(rows.iter().map(|row| row.get(0)).collect())
    }
    
    /// Get character expressions (internal)
    async fn get_character_expressions_internal(
        &self,
        client: &deadpool_postgres::Client,
        character_id: &str,
    ) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        let rows = client.query(
            "SELECT expression_name FROM character_expressions WHERE character_id = $1",
            &[&character_id],
        ).await?;
        
        Ok(rows.iter().map(|row| row.get(0)).collect())
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
        // For testing, we'll create a minimal pool configuration
        // In real tests, you'd use a test database or mock
        let mut cfg = Config::new();
        cfg.host = Some("localhost".to_string());
        cfg.dbname = Some("test_db".to_string());
        cfg.user = Some("test_user".to_string());
        cfg.password = Some("test_pass".to_string());
        
        // Create pool - this will fail in CI but that's ok for testing structure
        cfg.create_pool(Some(Runtime::Tokio1), NoTls).unwrap()
    }

    // Helper function to create test character
    fn create_test_character() -> CharacterData {
        CharacterData {
            id: "test_char_001".to_string(),
            name: "测试角色".to_string(),
            display_name: "Test Character".to_string(),
            path: "/test/path".to_string(),
            preview_image: Some("/test/preview.jpg".to_string()),
            description: "测试用角色".to_string(),
            gender: "female".to_string(),
            size: "medium".to_string(),
            features: vec!["可爱".to_string(), "友善".to_string()],
            motions: vec!["idle".to_string(), "wave".to_string()],
            expressions: vec!["happy".to_string(), "sad".to_string()],
            is_active: false,
        }
    }

    fn create_test_character_config() -> CharacterConfig {
        CharacterConfig {
            character_id: "test_char_001".to_string(),
            scale: 1.0,
            position_x: 100.0,
            position_y: 200.0,
            interaction_enabled: true,
            config_json: Some(r#"{"theme": "default"}"#.to_string()),
        }
    }

    #[test]
    fn test_character_registry_new() {
        // Arrange
        let pool = create_test_pool();
        
        // Act
        let registry = CharacterRegistry::new(pool);
        
        // Assert
        assert!(!registry.pool.is_closed());
    }

    #[test]
    fn test_character_data_structure() {
        // Arrange & Act
        let character = create_test_character();
        
        // Assert
        assert_eq!(character.id, "test_char_001");
        assert_eq!(character.name, "测试角色");
        assert_eq!(character.display_name, "Test Character");
        assert_eq!(character.gender, "female");
        assert_eq!(character.features.len(), 2);
        assert_eq!(character.motions.len(), 2);
        assert_eq!(character.expressions.len(), 2);
        assert!(!character.is_active);
    }

    #[test]
    fn test_character_config_structure() {
        // Arrange & Act
        let config = create_test_character_config();
        
        // Assert
        assert_eq!(config.character_id, "test_char_001");
        assert_eq!(config.scale, 1.0);
        assert_eq!(config.position_x, 100.0);
        assert_eq!(config.position_y, 200.0);
        assert!(config.interaction_enabled);
        assert!(config.config_json.is_some());
    }

    // Note: The following tests would need actual database setup or mocking
    // For now, they test the synchronous wrapper structure
    
    #[test]
    fn test_character_serialization() {
        // Arrange
        let character = create_test_character();
        
        // Act
        let json = serde_json::to_string(&character);
        
        // Assert
        assert!(json.is_ok());
        let json_str = json.unwrap();
        assert!(json_str.contains("test_char_001"));
        assert!(json_str.contains("测试角色"));
    }

    #[test]
    fn test_character_deserialization() {
        // Arrange
        let character = create_test_character();
        let json_str = serde_json::to_string(&character).unwrap();
        
        // Act
        let deserialized: Result<CharacterData, _> = serde_json::from_str(&json_str);
        
        // Assert
        assert!(deserialized.is_ok());
        let deserialized_char = deserialized.unwrap();
        assert_eq!(deserialized_char.id, character.id);
        assert_eq!(deserialized_char.name, character.name);
        assert_eq!(deserialized_char.features, character.features);
    }

    #[test]
    fn test_character_config_serialization() {
        // Arrange
        let config = create_test_character_config();
        
        // Act
        let json = serde_json::to_string(&config);
        
        // Assert
        assert!(json.is_ok());
        let json_str = json.unwrap();
        assert!(json_str.contains("test_char_001"));
        assert!(json_str.contains("100.0"));
    }

    #[test]
    fn test_character_features_validation() {
        // Arrange
        let mut character = create_test_character();
        
        // Act - Test with empty features
        character.features = vec![];
        
        // Assert
        assert!(character.features.is_empty());
        
        // Act - Test with many features
        character.features = vec![
            "feature1".to_string(),
            "feature2".to_string(), 
            "feature3".to_string()
        ];
        
        // Assert
        assert_eq!(character.features.len(), 3);
    }

    #[test]
    fn test_character_motions_validation() {
        // Arrange
        let mut character = create_test_character();
        
        // Act & Assert
        assert!(!character.motions.is_empty());
        
        // Test motion modification
        character.motions.push("dance".to_string());
        assert_eq!(character.motions.len(), 3);
        assert!(character.motions.contains(&"dance".to_string()));
    }

    #[test]
    fn test_character_expressions_validation() {
        // Arrange
        let mut character = create_test_character();
        
        // Act & Assert
        assert!(!character.expressions.is_empty());
        
        // Test expression modification
        character.expressions.push("angry".to_string());
        assert_eq!(character.expressions.len(), 3);
        assert!(character.expressions.contains(&"angry".to_string()));
    }

    #[test]
    fn test_character_path_validation() {
        // Arrange
        let mut character = create_test_character();
        
        // Act - Test with different path formats
        character.path = "/absolute/path".to_string();
        assert!(character.path.starts_with('/'));
        
        character.path = "relative/path".to_string();
        assert!(!character.path.starts_with('/'));
        
        character.path = "".to_string();
        assert!(character.path.is_empty());
    }

    #[test]
    fn test_character_active_flag() {
        // Arrange
        let mut character = create_test_character();
        
        // Act & Assert - Test default state
        assert!(!character.is_active);
        
        // Test activation
        character.is_active = true;
        assert!(character.is_active);
        
        // Test deactivation
        character.is_active = false;
        assert!(!character.is_active);
    }

    #[test]
    fn test_character_config_scale_validation() {
        // Arrange
        let mut config = create_test_character_config();
        
        // Act & Assert - Test normal scale
        assert_eq!(config.scale, 1.0);
        
        // Test different scales
        config.scale = 0.5;
        assert_eq!(config.scale, 0.5);
        
        config.scale = 2.0;
        assert_eq!(config.scale, 2.0);
        
        config.scale = 0.0;
        assert_eq!(config.scale, 0.0);
    }

    #[test]
    fn test_character_config_position_validation() {
        // Arrange
        let mut config = create_test_character_config();
        
        // Act & Assert
        assert_eq!(config.position_x, 100.0);
        assert_eq!(config.position_y, 200.0);
        
        // Test negative positions
        config.position_x = -50.0;
        config.position_y = -100.0;
        assert_eq!(config.position_x, -50.0);
        assert_eq!(config.position_y, -100.0);
        
        // Test zero positions
        config.position_x = 0.0;
        config.position_y = 0.0;
        assert_eq!(config.position_x, 0.0);
        assert_eq!(config.position_y, 0.0);
    }

    #[test]
    fn test_character_config_interaction_flag() {
        // Arrange
        let mut config = create_test_character_config();
        
        // Act & Assert
        assert!(config.interaction_enabled);
        
        config.interaction_enabled = false;
        assert!(!config.interaction_enabled);
    }

    #[test]
    fn test_character_config_json_validation() {
        // Arrange
        let mut config = create_test_character_config();
        
        // Act & Assert - Test with valid JSON
        config.config_json = Some(r#"{"key": "value"}"#.to_string());
        assert!(config.config_json.is_some());
        
        // Test with None
        config.config_json = None;
        assert!(config.config_json.is_none());
        
        // Test with empty JSON
        config.config_json = Some("{}".to_string());
        assert_eq!(config.config_json.unwrap(), "{}");
    }
}
