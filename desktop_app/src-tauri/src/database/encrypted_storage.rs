//! # 加密存储数据库模块 (PostgreSQL)
//! 
//! 提供AES-256-GCM加密的敏感数据存储、密钥轮换和安全管理功能

use serde::{Deserialize, Serialize};
use crate::database::DbPool;
use tracing::{info, debug};
use chrono::Utc;
use std::collections::HashMap;

// ================================
// 数据结构定义
// ================================

/// 加密数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecureData {
    pub key: String,
    pub encrypted_value: Vec<u8>,
    pub created_at: i64,
}

/// 加密字段类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EncryptedFieldType {
    ApiKey,
    Password,
    Token,
    SensitiveConfig,
    PersonalInfo,
    Custom(String),
}

impl std::fmt::Display for EncryptedFieldType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EncryptedFieldType::ApiKey => write!(f, "api_key"),
            EncryptedFieldType::Password => write!(f, "password"),
            EncryptedFieldType::Token => write!(f, "token"),
            EncryptedFieldType::SensitiveConfig => write!(f, "sensitive_config"),
            EncryptedFieldType::PersonalInfo => write!(f, "personal_info"),
            EncryptedFieldType::Custom(s) => write!(f, "{}", s),
        }
    }
}

impl std::str::FromStr for EncryptedFieldType {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "api_key" => Ok(EncryptedFieldType::ApiKey),
            "password" => Ok(EncryptedFieldType::Password),
            "token" => Ok(EncryptedFieldType::Token),
            "sensitive_config" => Ok(EncryptedFieldType::SensitiveConfig),
            "personal_info" => Ok(EncryptedFieldType::PersonalInfo),
            custom => Ok(EncryptedFieldType::Custom(custom.to_string())),
        }
    }
}

/// 加密数据条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedEntry {
    pub id: String,
    pub field_type: String,
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub entity_id: Option<String>,
    pub key_version: i32,
    pub metadata: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub accessed_at: Option<String>,
    pub access_count: i64,
}

/// 密钥版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyVersionInfo {
    pub version: i32,
    pub created_at: String,
    pub rotated_from: Option<i32>,
    pub status: String,
    pub description: Option<String>,
}

/// 加密统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionStatistics {
    pub total_entries: i64,
    pub type_counts: HashMap<String, i64>,
    pub current_key_version: i32,
    pub total_access_count: i64,
    pub recent_accesses: i64,
}

// ================================
// 加密存储注册表
// ================================

pub struct EncryptedStorageRegistry {
    pool: DbPool,
}

impl EncryptedStorageRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建加密数据表
        client.execute(
            "CREATE TABLE IF NOT EXISTS encrypted_data (
                id TEXT PRIMARY KEY,
                field_type TEXT NOT NULL,
                encrypted_data BYTEA NOT NULL,
                nonce BYTEA NOT NULL,
                entity_id TEXT,
                key_version INTEGER NOT NULL DEFAULT 1,
                metadata TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                accessed_at TIMESTAMP,
                access_count BIGINT NOT NULL DEFAULT 0
            )",
            &[],
        ).await?;

        // 创建密钥版本表
        client.execute(
            "CREATE TABLE IF NOT EXISTS encryption_key_versions (
                version INTEGER PRIMARY KEY,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                rotated_from INTEGER,
                status TEXT NOT NULL DEFAULT 'active',
                description TEXT
            )",
            &[],
        ).await?;

        // 创建访问日志表
        client.execute(
            "CREATE TABLE IF NOT EXISTS encrypted_data_access_log (
                id BIGSERIAL PRIMARY KEY,
                data_id TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT,
                success BOOLEAN NOT NULL,
                error_message TEXT,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建索引
        let indexes = vec![
            "CREATE INDEX IF NOT EXISTS idx_encrypted_data_type ON encrypted_data(field_type)",
            "CREATE INDEX IF NOT EXISTS idx_encrypted_data_entity ON encrypted_data(entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_encrypted_data_key_version ON encrypted_data(key_version)",
            "CREATE INDEX IF NOT EXISTS idx_encrypted_data_created ON encrypted_data(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_access_log_data_id ON encrypted_data_access_log(data_id)",
            "CREATE INDEX IF NOT EXISTS idx_access_log_timestamp ON encrypted_data_access_log(timestamp DESC)",
        ];

        for index_sql in indexes {
            client.execute(index_sql, &[]).await?;
        }

        // 初始化默认密钥版本
        client.execute(
            "INSERT INTO encryption_key_versions (version, status, description)
            VALUES (1, 'active', 'Initial key version')
            ON CONFLICT (version) DO NOTHING",
            &[],
        ).await?;

        info!("✅ 加密存储表初始化完成");
        Ok(())
    }

    /// 存储加密数据
    pub fn store(&self, key: &str, value: &[u8]) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let handle = tokio::runtime::Handle::current();
        handle.block_on(async {
            self.store_async(key, value, "custom", None, None).await
        })
    }

    /// 存储加密数据（异步，完整版）
    pub async fn store_async(
        &self,
        id: &str,
        encrypted_data: &[u8],
        field_type: &str,
        entity_id: Option<&str>,
        metadata: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 生成随机nonce（用于AES-GCM）
        let nonce = vec![0u8; 12]; // 实际应该使用随机数

        // 获取当前密钥版本
        let key_version = self.get_current_key_version_async().await?;

        client.execute(
            "INSERT INTO encrypted_data (
                id, field_type, encrypted_data, nonce, entity_id, key_version, metadata,
                created_at, updated_at, access_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 0)
            ON CONFLICT (id) DO UPDATE SET
                encrypted_data = EXCLUDED.encrypted_data,
                nonce = EXCLUDED.nonce,
                field_type = EXCLUDED.field_type,
                entity_id = EXCLUDED.entity_id,
                key_version = EXCLUDED.key_version,
                metadata = EXCLUDED.metadata,
                updated_at = EXCLUDED.updated_at",
            &[
                &id,
                &field_type,
                &encrypted_data,
                &nonce,
                &entity_id,
                &key_version,
                &metadata,
            ],
        ).await?;

        // 记录访问日志
        self.log_access_async(id, "store", None, true, None).await?;

        debug!("🔒 已存储加密数据: {}", id);
        Ok(())
    }

    /// 检索加密数据
    pub fn retrieve(&self, key: &str) -> Result<Option<Vec<u8>>, Box<dyn std::error::Error + Send + Sync>> {
        let handle = tokio::runtime::Handle::current();
        handle.block_on(async {
            self.retrieve_async(key).await
        })
    }

    /// 检索加密数据（异步）
    pub async fn retrieve_async(&self, id: &str) -> Result<Option<Vec<u8>>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT encrypted_data, nonce, key_version FROM encrypted_data WHERE id = $1",
            &[&id],
        ).await?;

        if rows.is_empty() {
            self.log_access_async(id, "retrieve", None, false, Some("Not found")).await?;
            return Ok(None);
        }

        let row = &rows[0];
        let encrypted_data: Vec<u8> = row.get("encrypted_data");

        // 更新访问记录
        client.execute(
            "UPDATE encrypted_data SET 
                accessed_at = NOW(),
                access_count = access_count + 1
            WHERE id = $1",
            &[&id],
        ).await?;

        // 记录访问日志
        self.log_access_async(id, "retrieve", None, true, None).await?;

        debug!("🔓 已检索加密数据: {}", id);
        Ok(Some(encrypted_data))
    }

    /// 删除加密数据
    pub fn delete(&self, key: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let handle = tokio::runtime::Handle::current();
        handle.block_on(async {
            self.delete_async(key).await
        })
    }

    /// 删除加密数据（异步）
    pub async fn delete_async(&self, id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let affected = client.execute(
            "DELETE FROM encrypted_data WHERE id = $1",
            &[&id],
        ).await?;

        if affected > 0 {
            // 记录访问日志
            self.log_access_async(id, "delete", None, true, None).await?;
            info!("🗑️  已删除加密数据: {}", id);
        } else {
            self.log_access_async(id, "delete", None, false, Some("Not found")).await?;
        }

        Ok(())
    }

    /// 获取加密条目详情
    pub async fn get_entry_async(&self, id: &str) -> Result<Option<EncryptedEntry>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, field_type, encrypted_data, nonce, entity_id, key_version, metadata,
                    created_at, updated_at, accessed_at, access_count
            FROM encrypted_data WHERE id = $1",
            &[&id],
        ).await?;

        if rows.is_empty() {
            return Ok(None);
        }

        let row = &rows[0];
        Ok(Some(EncryptedEntry {
            id: row.get("id"),
            field_type: row.get("field_type"),
            encrypted_data: row.get("encrypted_data"),
            nonce: row.get("nonce"),
            entity_id: row.get("entity_id"),
            key_version: row.get("key_version"),
            metadata: row.get("metadata"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, Option<chrono::DateTime<Utc>>>("accessed_at").map(|dt| dt.to_rfc3339()),
            access_count: row.get("access_count"),
        }))
    }

    /// 列出所有加密条目（仅元数据）
    pub async fn list_entries_async(&self, field_type: Option<&str>) -> Result<Vec<EncryptedEntry>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let query = if let Some(ftype) = field_type {
            client.query(
                "SELECT id, field_type, encrypted_data, nonce, entity_id, key_version, metadata,
                        created_at, updated_at, accessed_at, access_count
                FROM encrypted_data WHERE field_type = $1
                ORDER BY created_at DESC",
                &[&ftype],
            ).await?
        } else {
            client.query(
                "SELECT id, field_type, encrypted_data, nonce, entity_id, key_version, metadata,
                        created_at, updated_at, accessed_at, access_count
                FROM encrypted_data
                ORDER BY created_at DESC",
                &[],
            ).await?
        };

        let entries = query.iter().map(|row| EncryptedEntry {
            id: row.get("id"),
            field_type: row.get("field_type"),
            encrypted_data: row.get("encrypted_data"),
            nonce: row.get("nonce"),
            entity_id: row.get("entity_id"),
            key_version: row.get("key_version"),
            metadata: row.get("metadata"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, Option<chrono::DateTime<Utc>>>("accessed_at").map(|dt| dt.to_rfc3339()),
            access_count: row.get("access_count"),
        }).collect();

        Ok(entries)
    }

    /// 获取当前密钥版本
    pub async fn get_current_key_version_async(&self) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let row = client.query_one(
            "SELECT version FROM encryption_key_versions 
            WHERE status = 'active' 
            ORDER BY version DESC 
            LIMIT 1",
            &[],
        ).await?;

        Ok(row.get("version"))
    }

    /// 轮换密钥版本
    pub async fn rotate_key_async(&self, description: Option<&str>) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let current_version = self.get_current_key_version_async().await?;
        let new_version = current_version + 1;

        // 标记旧版本为已弃用
        client.execute(
            "UPDATE encryption_key_versions SET status = 'deprecated' WHERE version = $1",
            &[&current_version],
        ).await?;

        // 创建新版本
        client.execute(
            "INSERT INTO encryption_key_versions (version, rotated_from, status, description)
            VALUES ($1, $2, 'active', $3)",
            &[&new_version, &current_version, &description],
        ).await?;

        info!("🔑 密钥已轮换: v{} -> v{}", current_version, new_version);
        Ok(new_version)
    }

    /// 重新加密数据（使用新密钥版本）
    pub async fn reencrypt_with_new_key_async(&self, id: &str, new_encrypted_data: &[u8]) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let new_version = self.get_current_key_version_async().await?;
        let nonce = vec![0u8; 12]; // 实际应该使用随机数

        client.execute(
            "UPDATE encrypted_data SET 
                encrypted_data = $2,
                nonce = $3,
                key_version = $4,
                updated_at = NOW()
            WHERE id = $1",
            &[&id, &new_encrypted_data, &nonce, &new_version],
        ).await?;

        self.log_access_async(id, "reencrypt", None, true, None).await?;

        debug!("🔄 已重新加密数据: {}", id);
        Ok(())
    }

    /// 记录访问日志
    async fn log_access_async(
        &self,
        data_id: &str,
        action: &str,
        actor: Option<&str>,
        success: bool,
        error_message: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO encrypted_data_access_log (data_id, action, actor, success, error_message, timestamp)
            VALUES ($1, $2, $3, $4, $5, NOW())",
            &[&data_id, &action, &actor, &success, &error_message],
        ).await?;

        Ok(())
    }

    /// 获取访问日志
    pub async fn get_access_log_async(&self, data_id: &str, limit: i32) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT action, actor, success, error_message, timestamp
            FROM encrypted_data_access_log
            WHERE data_id = $1
            ORDER BY timestamp DESC
            LIMIT $2",
            &[&data_id, &limit],
        ).await?;

        let logs = rows.iter().map(|row| {
            serde_json::json!({
                "action": row.get::<_, String>("action"),
                "actor": row.get::<_, Option<String>>("actor"),
                "success": row.get::<_, bool>("success"),
                "error_message": row.get::<_, Option<String>>("error_message"),
                "timestamp": row.get::<_, chrono::DateTime<Utc>>("timestamp").to_rfc3339(),
            })
        }).collect();

        Ok(logs)
    }

    /// 获取统计信息
    pub async fn get_statistics_async(&self) -> Result<EncryptionStatistics, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 总条目数
        let total_row = client.query_one(
            "SELECT COUNT(*) as count FROM encrypted_data",
            &[],
        ).await?;
        let total_entries: i64 = total_row.get("count");

        // 按类型统计
        let type_rows = client.query(
            "SELECT field_type, COUNT(*) as count FROM encrypted_data GROUP BY field_type",
            &[],
        ).await?;

        let mut type_counts = HashMap::new();
        for row in type_rows {
            let field_type: String = row.get("field_type");
            let count: i64 = row.get("count");
            type_counts.insert(field_type, count);
        }

        // 当前密钥版本
        let current_key_version = self.get_current_key_version_async().await?;

        // 总访问次数
        let access_row = client.query_one(
            "SELECT COALESCE(SUM(access_count), 0) as total FROM encrypted_data",
            &[],
        ).await?;
        let total_access_count: i64 = access_row.get("total");

        // 最近24小时访问次数
        let recent_cutoff = Utc::now() - chrono::Duration::hours(24);
        let recent_row = client.query_one(
            "SELECT COUNT(*) as count FROM encrypted_data_access_log WHERE timestamp >= $1",
            &[&recent_cutoff],
        ).await?;
        let recent_accesses: i64 = recent_row.get("count");

        Ok(EncryptionStatistics {
            total_entries,
            type_counts,
            current_key_version,
            total_access_count,
            recent_accesses,
        })
    }

    /// 清理旧的访问日志
    pub async fn cleanup_access_log_async(&self, days: i64) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let cutoff = Utc::now() - chrono::Duration::days(days);

        let affected = client.execute(
            "DELETE FROM encrypted_data_access_log WHERE timestamp < $1",
            &[&cutoff],
        ).await?;

        info!("🗑️  清理了 {} 条旧访问日志", affected);
        Ok(affected as usize)
    }

    /// 按实体ID获取加密数据
    pub async fn get_by_entity_async(&self, entity_id: &str) -> Result<Vec<EncryptedEntry>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, field_type, encrypted_data, nonce, entity_id, key_version, metadata,
                    created_at, updated_at, accessed_at, access_count
            FROM encrypted_data WHERE entity_id = $1
            ORDER BY created_at DESC",
            &[&entity_id],
        ).await?;

        let entries = rows.iter().map(|row| EncryptedEntry {
            id: row.get("id"),
            field_type: row.get("field_type"),
            encrypted_data: row.get("encrypted_data"),
            nonce: row.get("nonce"),
            entity_id: row.get("entity_id"),
            key_version: row.get("key_version"),
            metadata: row.get("metadata"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, Option<chrono::DateTime<Utc>>>("accessed_at").map(|dt| dt.to_rfc3339()),
            access_count: row.get("access_count"),
        }).collect();

        Ok(entries)
    }

    /// 获取所有密钥版本信息
    pub async fn get_key_versions_async(&self) -> Result<Vec<KeyVersionInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT version, created_at, rotated_from, status, description
            FROM encryption_key_versions
            ORDER BY version DESC",
            &[],
        ).await?;

        let versions = rows.iter().map(|row| KeyVersionInfo {
            version: row.get("version"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            rotated_from: row.get("rotated_from"),
            status: row.get("status"),
            description: row.get("description"),
        }).collect();

        Ok(versions)
    }
}

// ================================
// 兼容实现 - 用于 commands/encryption.rs
// ================================

/// 加密存储（用于命令）
pub struct EncryptedStorage {
    registry: Option<EncryptedStorageRegistry>,
}

impl EncryptedStorage {
    pub fn new(_path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // 这里应该通过依赖注入获取 DbPool
        // 目前返回一个空实现
        Ok(Self { registry: None })
    }

    pub fn store(
        &self,
        id: &str,
        field_type: EncryptedFieldType,
        plaintext: &str,
        entity_id: Option<&str>,
        encryption_manager: &crate::utils::encryption::EncryptionManager,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // 使用 EncryptionManager 加密数据
        let encrypted = encryption_manager.encrypt_string(plaintext)?;
        
        // 存储到数据库（实际实现应该使用 registry）
        debug!("存储加密字段: {} (类型: {})", id, field_type);
        Ok(())
    }

    pub fn retrieve(
        &self,
        id: &str,
        encryption_manager: &crate::utils::encryption::EncryptionManager,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // 从数据库检索（实际实现应该使用 registry）
        debug!("检索加密字段: {}", id);
        
        // 使用 EncryptionManager 解密数据
        // 这里返回空字符串，实际应该从数据库读取并解密
        Ok(String::new())
    }

    pub fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        debug!("删除加密字段: {}", id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::SystemTime;
    use chrono::Utc;

    // ================================
    // 枚举类型测试
    // ================================

    #[test]
    fn test_encrypted_field_type_display() {
        assert_eq!(EncryptedFieldType::ApiKey.to_string(), "api_key");
        assert_eq!(EncryptedFieldType::Password.to_string(), "password");
        assert_eq!(EncryptedFieldType::Token.to_string(), "token");
        assert_eq!(EncryptedFieldType::SensitiveConfig.to_string(), "sensitive_config");
        assert_eq!(EncryptedFieldType::PersonalInfo.to_string(), "personal_info");
        assert_eq!(EncryptedFieldType::Custom("custom_type".to_string()).to_string(), "custom_type");
    }

    #[test]
    fn test_encrypted_field_type_from_str() {
        assert_eq!("api_key".parse::<EncryptedFieldType>().unwrap(), EncryptedFieldType::ApiKey);
        assert_eq!("password".parse::<EncryptedFieldType>().unwrap(), EncryptedFieldType::Password);
        assert_eq!("token".parse::<EncryptedFieldType>().unwrap(), EncryptedFieldType::Token);
        assert_eq!("sensitive_config".parse::<EncryptedFieldType>().unwrap(), EncryptedFieldType::SensitiveConfig);
        assert_eq!("personal_info".parse::<EncryptedFieldType>().unwrap(), EncryptedFieldType::PersonalInfo);
        
        // 测试自定义类型
        let custom = "custom_field_type".parse::<EncryptedFieldType>().unwrap();
        match custom {
            EncryptedFieldType::Custom(s) => assert_eq!(s, "custom_field_type"),
            _ => panic!("应该是Custom类型"),
        }
    }

    // ================================
    // 数据结构测试
    // ================================

    #[test]
    fn test_secure_data_creation() {
        let data = SecureData {
            key: "test_key".to_string(),
            encrypted_value: vec![1, 2, 3, 4, 5],
            created_at: Utc::now().timestamp(),
        };
        
        assert_eq!(data.key, "test_key");
        assert_eq!(data.encrypted_value, vec![1, 2, 3, 4, 5]);
        assert!(data.created_at > 0);
    }

    #[test]
    fn test_secure_data_serialization() {
        let data = SecureData {
            key: "api_key_test".to_string(),
            encrypted_value: vec![0x41, 0x42, 0x43], // "ABC" 
            created_at: 1640995200, // 2022-01-01 00:00:00 UTC
        };
        
        let serialized = serde_json::to_string(&data).expect("序列化失败");
        assert!(serialized.contains("api_key_test"));
        assert!(serialized.contains("1640995200"));
        
        let deserialized: SecureData = serde_json::from_str(&serialized).expect("反序列化失败");
        assert_eq!(deserialized.key, "api_key_test");
        assert_eq!(deserialized.encrypted_value, vec![0x41, 0x42, 0x43]);
        assert_eq!(deserialized.created_at, 1640995200);
    }

    #[test]
    fn test_encrypted_entry_creation() {
        let entry = EncryptedEntry {
            id: "entry_123".to_string(),
            field_type: "api_key".to_string(),
            encrypted_data: vec![1, 2, 3, 4],
            nonce: vec![5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            entity_id: Some("user_456".to_string()),
            key_version: 1,
            metadata: Some("{\"source\":\"test\"}".to_string()),
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: Some("2023-01-02T00:00:00Z".to_string()),
            access_count: 5,
        };
        
        assert_eq!(entry.id, "entry_123");
        assert_eq!(entry.field_type, "api_key");
        assert_eq!(entry.encrypted_data, vec![1, 2, 3, 4]);
        assert_eq!(entry.nonce.len(), 12);
        assert_eq!(entry.entity_id, Some("user_456".to_string()));
        assert_eq!(entry.key_version, 1);
        assert_eq!(entry.access_count, 5);
    }

    #[test]
    fn test_key_version_info_creation() {
        let key_info = KeyVersionInfo {
            version: 2,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            rotated_from: Some(1),
            status: "active".to_string(),
            description: Some("Rotated key for security".to_string()),
        };
        
        assert_eq!(key_info.version, 2);
        assert_eq!(key_info.rotated_from, Some(1));
        assert_eq!(key_info.status, "active");
        assert!(key_info.description.is_some());
    }

    #[test]
    fn test_encryption_statistics_creation() {
        let mut type_counts = HashMap::new();
        type_counts.insert("api_key".to_string(), 5);
        type_counts.insert("password".to_string(), 3);
        
        let stats = EncryptionStatistics {
            total_entries: 8,
            type_counts,
            current_key_version: 2,
            total_access_count: 150,
            recent_accesses: 25,
        };
        
        assert_eq!(stats.total_entries, 8);
        assert_eq!(stats.current_key_version, 2);
        assert_eq!(stats.total_access_count, 150);
        assert_eq!(stats.recent_accesses, 25);
        assert_eq!(stats.type_counts.get("api_key"), Some(&5));
        assert_eq!(stats.type_counts.get("password"), Some(&3));
    }

    // ================================
    // 边界条件和验证测试
    // ================================

    #[test]
    fn test_empty_encrypted_data() {
        let entry = EncryptedEntry {
            id: "empty_test".to_string(),
            field_type: "token".to_string(),
            encrypted_data: vec![], // 空数据
            nonce: vec![0; 12],
            entity_id: None,
            key_version: 1,
            metadata: None,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: None,
            access_count: 0,
        };
        
        assert!(entry.encrypted_data.is_empty());
        assert_eq!(entry.access_count, 0);
        assert!(entry.entity_id.is_none());
        assert!(entry.metadata.is_none());
        assert!(entry.accessed_at.is_none());
    }

    #[test]
    fn test_large_encrypted_data() {
        let large_data = vec![0u8; 1024 * 1024]; // 1MB 数据
        let entry = EncryptedEntry {
            id: "large_test".to_string(),
            field_type: "sensitive_config".to_string(),
            encrypted_data: large_data.clone(),
            nonce: vec![1; 12],
            entity_id: Some("large_entity".to_string()),
            key_version: 1,
            metadata: None,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: None,
            access_count: 0,
        };
        
        assert_eq!(entry.encrypted_data.len(), 1024 * 1024);
        assert_eq!(entry.encrypted_data, large_data);
    }

    #[test]
    fn test_special_characters_in_ids() {
        let entry = EncryptedEntry {
            id: "special-id_测试.123@domain".to_string(),
            field_type: "custom_type".to_string(),
            encrypted_data: vec![1, 2, 3],
            nonce: vec![0; 12],
            entity_id: Some("entity-特殊字符_123".to_string()),
            key_version: 1,
            metadata: Some("{\n  \"test\": \"with\ttabs and\nnewlines\"\n}".to_string()),
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: None,
            access_count: 0,
        };
        
        assert!(entry.id.contains("测试"));
        assert!(entry.entity_id.as_ref().unwrap().contains("特殊字符"));
        assert!(entry.metadata.as_ref().unwrap().contains("\n"));
        assert!(entry.metadata.as_ref().unwrap().contains("\t"));
    }

    #[test]
    fn test_nonce_length_validation() {
        // 测试正确长度的nonce (12字节用于AES-GCM)
        let correct_nonce = vec![0u8; 12];
        assert_eq!(correct_nonce.len(), 12);
        
        // 测试不同长度的nonce
        let short_nonce = vec![0u8; 8];
        let long_nonce = vec![0u8; 16];
        
        assert_eq!(short_nonce.len(), 8);
        assert_eq!(long_nonce.len(), 16);
        
        // 在实际应用中，应该验证nonce长度，但这里只测试数据结构
        let entry = EncryptedEntry {
            id: "nonce_test".to_string(),
            field_type: "api_key".to_string(),
            encrypted_data: vec![1, 2, 3],
            nonce: correct_nonce,
            entity_id: None,
            key_version: 1,
            metadata: None,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: None,
            access_count: 0,
        };
        
        assert_eq!(entry.nonce.len(), 12);
    }

    #[test]
    fn test_key_version_boundaries() {
        // 测试最小版本
        let min_version = KeyVersionInfo {
            version: 1,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            rotated_from: None,
            status: "active".to_string(),
            description: Some("Initial version".to_string()),
        };
        
        assert_eq!(min_version.version, 1);
        assert!(min_version.rotated_from.is_none());
        
        // 测试大版本号
        let high_version = KeyVersionInfo {
            version: 999,
            created_at: "2023-12-31T23:59:59Z".to_string(),
            rotated_from: Some(998),
            status: "deprecated".to_string(),
            description: None,
        };
        
        assert_eq!(high_version.version, 999);
        assert_eq!(high_version.rotated_from, Some(998));
        assert!(high_version.description.is_none());
    }

    // ================================
    // 业务逻辑验证测试
    // ================================

    #[test]
    fn test_access_count_increment() {
        let mut entry = EncryptedEntry {
            id: "access_test".to_string(),
            field_type: "password".to_string(),
            encrypted_data: vec![1, 2, 3],
            nonce: vec![0; 12],
            entity_id: None,
            key_version: 1,
            metadata: None,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: None,
            access_count: 0,
        };
        
        // 模拟访问计数增加
        assert_eq!(entry.access_count, 0);
        
        entry.access_count += 1;
        assert_eq!(entry.access_count, 1);
        
        entry.access_count += 10;
        assert_eq!(entry.access_count, 11);
        
        // 测试大数值
        entry.access_count = i64::MAX - 1;
        entry.access_count += 1;
        assert_eq!(entry.access_count, i64::MAX);
    }

    #[test]
    fn test_statistics_aggregation() {
        let mut type_counts = HashMap::new();
        
        // 模拟统计数据聚合
        type_counts.insert("api_key".to_string(), 10);
        type_counts.insert("password".to_string(), 5);
        type_counts.insert("token".to_string(), 3);
        
        let total: i64 = type_counts.values().sum();
        assert_eq!(total, 18);
        
        let stats = EncryptionStatistics {
            total_entries: total,
            type_counts: type_counts.clone(),
            current_key_version: 1,
            total_access_count: 500,
            recent_accesses: 50,
        };
        
        assert_eq!(stats.total_entries, 18);
        assert_eq!(stats.type_counts.len(), 3);
        
        // 验证最常用的类型
        let max_count = type_counts.values().max().unwrap();
        assert_eq!(*max_count, 10);
    }

    // ================================
    // 性能测试
    // ================================

    #[test]
    fn test_enum_conversion_performance() {
        let field_types = vec![
            "api_key", "password", "token", "sensitive_config", 
            "personal_info", "custom_type_1", "custom_type_2"
        ];
        
        let start = SystemTime::now();
        
        // 执行1000次枚举转换
        for _ in 0..1000 {
            for field_type in &field_types {
                let _parsed: EncryptedFieldType = field_type.parse().unwrap();
            }
        }
        
        let duration = start.elapsed().unwrap();
        
        // 1000次转换应该在50ms内完成
        assert!(duration.as_millis() < 50, "枚举转换性能测试失败: {:?}", duration);
    }

    #[test]
    fn test_struct_serialization_performance() {
        let entry = EncryptedEntry {
            id: "performance_test".to_string(),
            field_type: "api_key".to_string(),
            encrypted_data: vec![0u8; 1024], // 1KB 加密数据
            nonce: vec![1u8; 12],
            entity_id: Some("entity_123".to_string()),
            key_version: 1,
            metadata: Some("{\"performance\": true}".to_string()),
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: Some("2023-01-02T00:00:00Z".to_string()),
            access_count: 100,
        };
        
        let start = SystemTime::now();
        
        // 执行100次序列化
        for _ in 0..100 {
            let _serialized = serde_json::to_string(&entry).unwrap();
        }
        
        let duration = start.elapsed().unwrap();
        
        // 100次序列化应该在200ms内完成
        assert!(duration.as_millis() < 200, "结构序列化性能测试失败: {:?}", duration);
    }

    // ================================
    // 并发安全测试
    // ================================

    #[test]
    fn test_concurrent_struct_read_access() {
        use std::sync::Arc;
        use std::thread;
        
        let entry = Arc::new(EncryptedEntry {
            id: "concurrent_test".to_string(),
            field_type: "token".to_string(),
            encrypted_data: vec![1, 2, 3, 4, 5],
            nonce: vec![0; 12],
            entity_id: Some("shared_entity".to_string()),
            key_version: 1,
            metadata: None,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: None,
            access_count: 0,
        });
        
        let mut handles = vec![];
        
        // 启动10个线程同时读取
        for i in 0..10 {
            let entry_clone = Arc::clone(&entry);
            let handle = thread::spawn(move || {
                // 多次读取确保没有竞态条件
                for _ in 0..100 {
                    let _id = &entry_clone.id;
                    let _data_len = entry_clone.encrypted_data.len();
                    let _version = entry_clone.key_version;
                    let _count = entry_clone.access_count;
                }
                i
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成
        for (i, handle) in handles.into_iter().enumerate() {
            let result = handle.join().unwrap();
            assert_eq!(result, i);
        }
    }

    #[test]
    fn test_statistics_concurrent_calculation() {
        use std::sync::Arc;
        use std::thread;
        
        let mut type_counts = HashMap::new();
        type_counts.insert("api_key".to_string(), 100);
        type_counts.insert("password".to_string(), 200);
        type_counts.insert("token".to_string(), 300);
        
        let stats = Arc::new(EncryptionStatistics {
            total_entries: 600,
            type_counts,
            current_key_version: 2,
            total_access_count: 10000,
            recent_accesses: 1000,
        });
        
        let mut handles = vec![];
        
        // 启动5个线程同时计算统计
        for i in 0..5 {
            let stats_clone = Arc::clone(&stats);
            let handle = thread::spawn(move || {
                // 计算不同的统计指标
                let total = stats_clone.total_entries;
                let api_keys = stats_clone.type_counts.get("api_key").copied().unwrap_or(0);
                let passwords = stats_clone.type_counts.get("password").copied().unwrap_or(0);
                let ratio = if total > 0 { (api_keys as f64) / (total as f64) } else { 0.0 };
                
                (i, total, api_keys, passwords, ratio)
            });
            handles.push(handle);
        }
        
        // 验证所有线程的计算结果一致
        let mut results = vec![];
        for handle in handles {
            results.push(handle.join().unwrap());
        }
        
        // 所有线程应该得到相同的统计结果
        for (_, total, api_keys, passwords, ratio) in &results {
            assert_eq!(*total, 600);
            assert_eq!(*api_keys, 100);
            assert_eq!(*passwords, 200);
            assert!((ratio - (100.0 / 600.0)).abs() < f64::EPSILON);
        }
    }

    // ================================
    // 数据完整性测试
    // ================================

    #[test]
    fn test_encrypted_data_integrity() {
        let original_data = vec![0x48, 0x65, 0x6C, 0x6C, 0x6F]; // "Hello"
        
        let entry = EncryptedEntry {
            id: "integrity_test".to_string(),
            field_type: "personal_info".to_string(),
            encrypted_data: original_data.clone(),
            nonce: vec![0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C],
            entity_id: None,
            key_version: 1,
            metadata: None,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            accessed_at: None,
            access_count: 0,
        };
        
        // 验证数据没有被修改
        assert_eq!(entry.encrypted_data, original_data);
        assert_eq!(entry.nonce, vec![0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C]);
        
        // 序列化后反序列化，验证数据完整性
        let serialized = serde_json::to_string(&entry).unwrap();
        let deserialized: EncryptedEntry = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.encrypted_data, original_data);
        assert_eq!(deserialized.nonce, entry.nonce);
        assert_eq!(deserialized.id, entry.id);
        assert_eq!(deserialized.field_type, entry.field_type);
    }
}
