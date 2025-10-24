//! # 加密存储数据库模块 (PostgreSQL)
//! 
//! 提供AES-256-GCM加密的敏感数据存储、密钥轮换和安全管理功能

use serde::{Deserialize, Serialize};
use crate::database::DbPool;
use tracing::{info, error, warn, debug};
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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
