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

