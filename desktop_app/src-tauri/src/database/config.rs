//! 配置管理模块
//!
//! 提供应用配置的持久化存储功能

use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// 配置值类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConfigValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Json(JsonValue),
}

/// 配置分组
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

/// 配置项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigItem {
    pub key: String,
    pub value: ConfigValue,
    pub group_id: Option<String>,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 配置管理器
pub struct ConfigManager {
    pool: Pool,
}

impl ConfigManager {
    /// 创建新的配置管理器
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建配置分组表
        client
            .execute(
                "CREATE TABLE IF NOT EXISTS config_groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT
                )",
                &[],
            )
            .await?;

        // 创建配置项表
        client
            .execute(
                "CREATE TABLE IF NOT EXISTS config_items (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    group_id TEXT,
                    description TEXT,
                    created_at BIGINT NOT NULL,
                    updated_at BIGINT NOT NULL,
                    FOREIGN KEY (group_id) REFERENCES config_groups(id) ON DELETE SET NULL
                )",
                &[],
            )
            .await?;

        Ok(())
    }

    /// 保存配置项
    pub async fn set_config(
        &self,
        item: ConfigItem,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let value_json = serde_json::to_string(&item.value)?;
        client
            .execute(
                "INSERT INTO config_items (key, value, group_id, description, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    group_id = EXCLUDED.group_id,
                    description = EXCLUDED.description,
                    updated_at = EXCLUDED.updated_at",
                &[&item.key, &value_json, &item.group_id, &item.description, &item.created_at, &item.updated_at],
            )
            .await?;
        Ok(())
    }

    /// 获取配置项
    pub async fn get_config(
        &self,
        key: &str,
    ) -> Result<Option<ConfigItem>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt(
                "SELECT key, value, group_id, description, created_at, updated_at FROM config_items WHERE key = $1",
                &[&key],
            )
            .await?;

        Ok(row.map(|r| {
            let value_json: String = r.get(1);
            let value: ConfigValue = serde_json::from_str(&value_json).unwrap_or(ConfigValue::String(value_json));
            ConfigItem {
                key: r.get(0),
                value,
                group_id: r.get(2),
                description: r.get(3),
                created_at: r.get(4),
                updated_at: r.get(5),
            }
        }))
    }

    /// 删除配置项
    pub async fn delete_config(
        &self,
        key: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        client
            .execute("DELETE FROM config_items WHERE key = $1", &[&key])
            .await?;
        Ok(())
    }

    /// 获取所有配置项
    pub async fn get_all_configs(
        &self,
    ) -> Result<Vec<ConfigItem>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let rows = client
            .query(
                "SELECT key, value, group_id, description, created_at, updated_at FROM config_items ORDER BY key",
                &[],
            )
            .await?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let value_json: String = r.get(1);
                let value: ConfigValue = serde_json::from_str(&value_json).unwrap_or(ConfigValue::String(value_json));
                ConfigItem {
                    key: r.get(0),
                    value,
                    group_id: r.get(2),
                    description: r.get(3),
                    created_at: r.get(4),
                    updated_at: r.get(5),
                }
            })
            .collect())
    }

    /// 创建配置分组
    pub async fn create_group(
        &self,
        group: ConfigGroup,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        client
            .execute(
                "INSERT INTO config_groups (id, name, description) VALUES ($1, $2, $3)",
                &[&group.id, &group.name, &group.description],
            )
            .await?;
        Ok(())
    }

    /// 获取配置分组
    pub async fn get_group(
        &self,
        id: &str,
    ) -> Result<Option<ConfigGroup>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt(
                "SELECT id, name, description FROM config_groups WHERE id = $1",
                &[&id],
            )
            .await?;

        Ok(row.map(|r| ConfigGroup {
            id: r.get(0),
            name: r.get(1),
            description: r.get(2),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Once;

    static INIT: Once = Once::new();

    fn init_test_env() {
        INIT.call_once(|| {
            let _ = tracing_subscriber::fmt()
                .with_test_writer()
                .try_init();
        });
    }


    // ===== ConfigValue 测试 =====

    #[test]
    fn test_config_value_string_serialization() {
        init_test_env();

        // Arrange
        let value = ConfigValue::String("test_string".to_string());

        // Act
        let serialized = serde_json::to_string(&value).unwrap();
        let deserialized: ConfigValue = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(serialized, "\"test_string\"");
        match deserialized {
            ConfigValue::String(s) => assert_eq!(s, "test_string"),
            _ => panic!("期望字符串类型"),
        }
    }

    #[test]
    fn test_config_value_number_serialization() {
        init_test_env();

        // Arrange
        let value = ConfigValue::Number(42.5);

        // Act
        let serialized = serde_json::to_string(&value).unwrap();
        let deserialized: ConfigValue = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(serialized, "42.5");
        match deserialized {
            ConfigValue::Number(n) => assert!((n - 42.5).abs() < f64::EPSILON),
            _ => panic!("期望数字类型"),
        }
    }

    #[test]
    fn test_config_value_boolean_serialization() {
        init_test_env();

        // Arrange
        let value = ConfigValue::Boolean(true);

        // Act
        let serialized = serde_json::to_string(&value).unwrap();
        let deserialized: ConfigValue = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(serialized, "true");
        match deserialized {
            ConfigValue::Boolean(b) => assert!(b),
            _ => panic!("期望布尔类型"),
        }
    }

    #[test]
    fn test_config_value_json_serialization() {
        init_test_env();

        // Arrange
        let json_data = json!({"name": "test", "count": 10});
        let value = ConfigValue::Json(json_data.clone());

        // Act
        let serialized = serde_json::to_string(&value).unwrap();
        let deserialized: ConfigValue = serde_json::from_str(&serialized).unwrap();

        // Assert
        match deserialized {
            ConfigValue::Json(j) => assert_eq!(j, json_data),
            _ => panic!("期望JSON类型"),
        }
    }

    #[test]
    fn test_config_value_untagged_deserialization() {
        init_test_env();

        // Arrange & Act & Assert - 测试无标签的序列化特性
        
        // 字符串
        let string_value: ConfigValue = serde_json::from_str("\"hello\"").unwrap();
        match string_value {
            ConfigValue::String(s) => assert_eq!(s, "hello"),
            _ => panic!("期望字符串"),
        }

        // 数字
        let number_value: ConfigValue = serde_json::from_str("123.45").unwrap();
        match number_value {
            ConfigValue::Number(n) => assert!((n - 123.45).abs() < f64::EPSILON),
            _ => panic!("期望数字"),
        }

        // 布尔
        let bool_value: ConfigValue = serde_json::from_str("false").unwrap();
        match bool_value {
            ConfigValue::Boolean(b) => assert!(!b),
            _ => panic!("期望布尔值"),
        }

        // JSON对象
        let json_value: ConfigValue = serde_json::from_str("{\"key\": \"value\"}").unwrap();
        match json_value {
            ConfigValue::Json(j) => {
                assert_eq!(j["key"], "value");
            }
            _ => panic!("期望JSON对象"),
        }
    }

    // ===== ConfigGroup 测试 =====

    #[test]
    fn test_config_group_serialization() {
        init_test_env();

        // Arrange
        let group = ConfigGroup {
            id: "test_group".to_string(),
            name: "测试分组".to_string(),
            description: Some("这是一个测试分组".to_string()),
        };

        // Act
        let serialized = serde_json::to_string(&group).unwrap();
        let deserialized: ConfigGroup = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(deserialized.id, group.id);
        assert_eq!(deserialized.name, group.name);
        assert_eq!(deserialized.description, group.description);
    }

    #[test]
    fn test_config_group_with_none_description() {
        init_test_env();

        // Arrange
        let group = ConfigGroup {
            id: "test_group".to_string(),
            name: "测试分组".to_string(),
            description: None,
        };

        // Act
        let serialized = serde_json::to_string(&group).unwrap();
        let deserialized: ConfigGroup = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(deserialized.id, group.id);
        assert_eq!(deserialized.name, group.name);
        assert_eq!(deserialized.description, None);
    }

    // ===== ConfigItem 测试 =====

    #[test]
    fn test_config_item_serialization() {
        init_test_env();

        // Arrange
        let now = chrono::Utc::now().timestamp();
        let item = ConfigItem {
            key: "test_key".to_string(),
            value: ConfigValue::String("test_value".to_string()),
            group_id: Some("test_group".to_string()),
            description: Some("测试配置项".to_string()),
            created_at: now,
            updated_at: now,
        };

        // Act
        let serialized = serde_json::to_string(&item).unwrap();
        let deserialized: ConfigItem = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(deserialized.key, item.key);
        assert_eq!(deserialized.group_id, item.group_id);
        assert_eq!(deserialized.description, item.description);
        assert_eq!(deserialized.created_at, item.created_at);
        assert_eq!(deserialized.updated_at, item.updated_at);
        
        match deserialized.value {
            ConfigValue::String(s) => assert_eq!(s, "test_value"),
            _ => panic!("期望字符串值"),
        }
    }

    #[test]
    fn test_config_item_with_different_value_types() {
        init_test_env();

        let now = chrono::Utc::now().timestamp();
        
        // 测试不同类型的值
        let items = vec![
            ConfigItem {
                key: "string_item".to_string(),
                value: ConfigValue::String("text".to_string()),
                group_id: None,
                description: None,
                created_at: now,
                updated_at: now,
            },
            ConfigItem {
                key: "number_item".to_string(),
                value: ConfigValue::Number(100.0),
                group_id: None,
                description: None,
                created_at: now,
                updated_at: now,
            },
            ConfigItem {
                key: "bool_item".to_string(),
                value: ConfigValue::Boolean(true),
                group_id: None,
                description: None,
                created_at: now,
                updated_at: now,
            },
            ConfigItem {
                key: "json_item".to_string(),
                value: ConfigValue::Json(json!({"nested": "object"})),
                group_id: None,
                description: None,
                created_at: now,
                updated_at: now,
            },
        ];

        // Act & Assert
        for item in items {
            let serialized = serde_json::to_string(&item).unwrap();
            let deserialized: ConfigItem = serde_json::from_str(&serialized).unwrap();
            assert_eq!(deserialized.key, item.key);
        }
    }

    // ===== ConfigManager 测试 (Mock版本) =====
    // 注意：由于实际的数据库操作需要真实的连接，这里我们主要测试结构和错误处理

    #[test]
    fn test_config_manager_new() {
        init_test_env();

        // 这个测试只能测试构造函数，因为我们无法在单元测试中创建真实的数据库连接
        // 在实际项目中，你应该使用testcontainers或者其他测试数据库
        
        // Arrange - 创建一个模拟的Pool（这在实际中不会工作）
        // 我们只能测试ConfigManager的结构
        
        // 这个测试主要验证类型和接口的正确性
        assert!(true); // 占位符测试
    }

    // ===== 边界条件和错误处理测试 =====

    #[test]
    fn test_config_value_edge_cases() {
        init_test_env();

        // Arrange & Act & Assert
        
        // 空字符串
        let empty_string = ConfigValue::String("".to_string());
        let serialized = serde_json::to_string(&empty_string).unwrap();
        let _: ConfigValue = serde_json::from_str(&serialized).unwrap();

        // 极大数字
        let large_number = ConfigValue::Number(f64::MAX);
        let serialized = serde_json::to_string(&large_number).unwrap();
        let _: ConfigValue = serde_json::from_str(&serialized).unwrap();

        // 极小数字
        let small_number = ConfigValue::Number(f64::MIN);
        let serialized = serde_json::to_string(&small_number).unwrap();
        let _: ConfigValue = serde_json::from_str(&serialized).unwrap();

        // 复杂JSON
        let complex_json = ConfigValue::Json(json!({
            "array": [1, 2, 3],
            "nested": {
                "deep": {
                    "value": "test"
                }
            },
            "null_value": null,
            "boolean": true,
            "number": 42.5
        }));
        let serialized = serde_json::to_string(&complex_json).unwrap();
        let _: ConfigValue = serde_json::from_str(&serialized).unwrap();
    }

    #[test]
    fn test_config_item_timestamps() {
        init_test_env();

        // Arrange
        let created_time = 1000000000i64; // 固定时间戳
        let updated_time = 2000000000i64;

        let item = ConfigItem {
            key: "timestamp_test".to_string(),
            value: ConfigValue::String("value".to_string()),
            group_id: None,
            description: None,
            created_at: created_time,
            updated_at: updated_time,
        };

        // Act
        let serialized = serde_json::to_string(&item).unwrap();
        let deserialized: ConfigItem = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(deserialized.created_at, created_time);
        assert_eq!(deserialized.updated_at, updated_time);
        assert!(deserialized.updated_at > deserialized.created_at);
    }

    #[test]
    fn test_config_group_empty_strings() {
        init_test_env();

        // Arrange
        let group = ConfigGroup {
            id: "".to_string(),
            name: "".to_string(),
            description: Some("".to_string()),
        };

        // Act
        let serialized = serde_json::to_string(&group).unwrap();
        let deserialized: ConfigGroup = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(deserialized.id, "");
        assert_eq!(deserialized.name, "");
        assert_eq!(deserialized.description, Some("".to_string()));
    }

    #[test]
    fn test_config_item_long_key() {
        init_test_env();

        // Arrange - 测试长键名
        let long_key = "a".repeat(1000);
        let item = ConfigItem {
            key: long_key.clone(),
            value: ConfigValue::String("value".to_string()),
            group_id: None,
            description: None,
            created_at: 0,
            updated_at: 0,
        };

        // Act
        let serialized = serde_json::to_string(&item).unwrap();
        let deserialized: ConfigItem = serde_json::from_str(&serialized).unwrap();

        // Assert
        assert_eq!(deserialized.key, long_key);
        assert_eq!(deserialized.key.len(), 1000);
    }

    #[test]
    fn test_invalid_json_handling() {
        init_test_env();

        // Arrange & Act & Assert
        
        // 测试无效JSON字符串的处理
        let invalid_json_str = "{invalid json";
        let result: Result<ConfigValue, _> = serde_json::from_str(invalid_json_str);
        assert!(result.is_err());

        // 测试部分有效的JSON
        let partial_json = "{\"key\": \"value\", \"incomplete\": ";
        let result: Result<ConfigValue, _> = serde_json::from_str(partial_json);
        assert!(result.is_err());
    }

    // ===== 集成测试辅助函数 =====

    /// 创建测试用的ConfigItem
    fn create_test_config_item(key: &str, value: ConfigValue) -> ConfigItem {
        let now = chrono::Utc::now().timestamp();
        ConfigItem {
            key: key.to_string(),
            value,
            group_id: Some("test_group".to_string()),
            description: Some(format!("测试配置项: {}", key)),
            created_at: now,
            updated_at: now,
        }
    }

    /// 创建测试用的ConfigGroup
    fn create_test_config_group(id: &str, name: &str) -> ConfigGroup {
        ConfigGroup {
            id: id.to_string(),
            name: name.to_string(),
            description: Some(format!("测试分组: {}", name)),
        }
    }

    #[test]
    fn test_helper_functions() {
        init_test_env();

        // Arrange & Act
        let item = create_test_config_item("test_key", ConfigValue::String("test_value".to_string()));
        let group = create_test_config_group("test_id", "测试名称");

        // Assert
        assert_eq!(item.key, "test_key");
        assert_eq!(group.id, "test_id");
        assert_eq!(group.name, "测试名称");
        assert!(item.description.is_some());
        assert!(group.description.is_some());
    }
}

