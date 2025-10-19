// src-tauri/src/database/encrypted_storage.rs
//! 数据库加密存储层
//! 
//! 提供透明的数据库字段加密功能

use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{error, info};

use crate::utils::encryption::{EncryptedData, EncryptionManager};

/// 加密存储错误
#[derive(Debug, thiserror::Error)]
pub enum EncryptedStorageError {
    #[error("数据库错误: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    
    #[error("加密错误: {0}")]
    EncryptionError(String),
    
    #[error("记录不存在")]
    RecordNotFound,
    
    #[error("序列化错误: {0}")]
    SerializationError(String),
}

/// 加密字段类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EncryptedFieldType {
    /// API 密钥
    ApiKey,
    /// 密码
    Password,
    /// Token
    Token,
    /// 敏感配置
    SensitiveConfig,
    /// 个人信息
    PersonalInfo,
    /// 自定义
    Custom(String),
}

/// 加密记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedRecord {
    /// 记录 ID
    pub id: String,
    /// 字段类型
    pub field_type: EncryptedFieldType,
    /// 加密数据
    pub encrypted_data: EncryptedData,
    /// 关联的实体（如 adapter_id, user_id 等）
    pub entity_id: Option<String>,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 加密存储管理器
pub struct EncryptedStorage {
    conn: Connection,
}

impl EncryptedStorage {
    /// 创建或打开加密存储
    pub fn new(db_path: &Path) -> Result<Self, EncryptedStorageError> {
        let conn = Connection::open(db_path)?;
        
        // 创建表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS encrypted_fields (
                id TEXT PRIMARY KEY,
                field_type TEXT NOT NULL,
                encrypted_data TEXT NOT NULL,
                entity_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_encrypted_fields_entity 
             ON encrypted_fields(entity_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_encrypted_fields_type 
             ON encrypted_fields(field_type)",
            [],
        )?;

        info!("加密存储初始化完成");
        Ok(Self { conn })
    }

    /// 存储加密字段
    pub fn store(
        &self,
        id: &str,
        field_type: EncryptedFieldType,
        plaintext: &str,
        entity_id: Option<&str>,
        manager: &EncryptionManager,
    ) -> Result<(), EncryptedStorageError> {
        // 加密数据
        let encrypted_data = manager
            .encrypt_string(plaintext)
            .map_err(|e| EncryptedStorageError::EncryptionError(e.to_string()))?;

        let now = chrono::Utc::now().timestamp();
        let field_type_str = serde_json::to_string(&field_type)
            .map_err(|e| EncryptedStorageError::SerializationError(e.to_string()))?;
        let encrypted_data_str = serde_json::to_string(&encrypted_data)
            .map_err(|e| EncryptedStorageError::SerializationError(e.to_string()))?;

        self.conn.execute(
            "INSERT OR REPLACE INTO encrypted_fields 
             (id, field_type, encrypted_data, entity_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, field_type_str, encrypted_data_str, entity_id, now, now],
        )?;

        info!("成功存储加密字段: {}", id);
        Ok(())
    }

    /// 检索并解密字段
    pub fn retrieve(
        &self,
        id: &str,
        manager: &EncryptionManager,
    ) -> Result<String, EncryptedStorageError> {
        let mut stmt = self.conn.prepare(
            "SELECT encrypted_data FROM encrypted_fields WHERE id = ?1"
        )?;

        let encrypted_data_str: String = stmt
            .query_row([id], |row| row.get(0))
            .map_err(|_| EncryptedStorageError::RecordNotFound)?;

        let encrypted_data: EncryptedData = serde_json::from_str(&encrypted_data_str)
            .map_err(|e| EncryptedStorageError::SerializationError(e.to_string()))?;

        let plaintext = manager
            .decrypt_string(&encrypted_data)
            .map_err(|e| EncryptedStorageError::EncryptionError(e.to_string()))?;

        Ok(plaintext)
    }

    /// 获取记录（不解密）
    pub fn get_record(&self, id: &str) -> Result<EncryptedRecord, EncryptedStorageError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, field_type, encrypted_data, entity_id, created_at, updated_at 
             FROM encrypted_fields WHERE id = ?1"
        )?;

        let record = stmt.query_row([id], |row| {
            let field_type_str: String = row.get(1)?;
            let encrypted_data_str: String = row.get(2)?;

            Ok(EncryptedRecord {
                id: row.get(0)?,
                field_type: serde_json::from_str(&field_type_str).unwrap(),
                encrypted_data: serde_json::from_str(&encrypted_data_str).unwrap(),
                entity_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        Ok(record)
    }

    /// 列出实体的所有加密字段
    pub fn list_by_entity(&self, entity_id: &str) -> Result<Vec<EncryptedRecord>, EncryptedStorageError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, field_type, encrypted_data, entity_id, created_at, updated_at 
             FROM encrypted_fields WHERE entity_id = ?1"
        )?;

        let records = stmt
            .query_map([entity_id], |row| {
                let field_type_str: String = row.get(1)?;
                let encrypted_data_str: String = row.get(2)?;

                Ok(EncryptedRecord {
                    id: row.get(0)?,
                    field_type: serde_json::from_str(&field_type_str).unwrap(),
                    encrypted_data: serde_json::from_str(&encrypted_data_str).unwrap(),
                    entity_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(records)
    }

    /// 删除加密字段
    pub fn delete(&self, id: &str) -> Result<(), EncryptedStorageError> {
        self.conn.execute(
            "DELETE FROM encrypted_fields WHERE id = ?1",
            [id],
        )?;

        info!("成功删除加密字段: {}", id);
        Ok(())
    }

    /// 删除实体的所有加密字段
    pub fn delete_by_entity(&self, entity_id: &str) -> Result<usize, EncryptedStorageError> {
        let count = self.conn.execute(
            "DELETE FROM encrypted_fields WHERE entity_id = ?1",
            [entity_id],
        )?;

        info!("删除了 {} 个加密字段（实体: {}）", count, entity_id);
        Ok(count)
    }

    /// 重新加密所有字段（用于密钥轮换）
    pub fn reencrypt_all(
        &self,
        old_manager: &EncryptionManager,
        new_manager: &EncryptionManager,
    ) -> Result<usize, EncryptedStorageError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, encrypted_data FROM encrypted_fields"
        )?;

        let records: Vec<(String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        let mut count = 0;
        for (id, encrypted_data_str) in records {
            let encrypted_data: EncryptedData = serde_json::from_str(&encrypted_data_str)
                .map_err(|e| EncryptedStorageError::SerializationError(e.to_string()))?;

            // 重新加密
            let new_encrypted_data = old_manager
                .reencrypt(&encrypted_data, new_manager)
                .map_err(|e| EncryptedStorageError::EncryptionError(e.to_string()))?;

            let new_encrypted_data_str = serde_json::to_string(&new_encrypted_data)
                .map_err(|e| EncryptedStorageError::SerializationError(e.to_string()))?;

            // 更新记录
            self.conn.execute(
                "UPDATE encrypted_fields SET encrypted_data = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_encrypted_data_str, chrono::Utc::now().timestamp(), id],
            )?;

            count += 1;
        }

        info!("成功重新加密 {} 个字段", count);
        Ok(count)
    }

    /// 获取统计信息
    pub fn get_statistics(&self) -> Result<EncryptedStorageStatistics, EncryptedStorageError> {
        let total_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM encrypted_fields",
            [],
            |row| row.get(0),
        )?;

        let oldest_timestamp: Option<i64> = self.conn.query_row(
            "SELECT MIN(created_at) FROM encrypted_fields",
            [],
            |row| row.get(0),
        )?;

        let newest_timestamp: Option<i64> = self.conn.query_row(
            "SELECT MAX(updated_at) FROM encrypted_fields",
            [],
            |row| row.get(0),
        )?;

        Ok(EncryptedStorageStatistics {
            total_count: total_count as usize,
            oldest_timestamp,
            newest_timestamp,
        })
    }
}

/// 加密存储统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedStorageStatistics {
    pub total_count: usize,
    pub oldest_timestamp: Option<i64>,
    pub newest_timestamp: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::encryption::generate_random_key;
    use tempfile::tempdir;

    #[test]
    fn test_store_and_retrieve() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let storage = EncryptedStorage::new(&db_path).unwrap();
        
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let id = "test-api-key";
        let plaintext = "sk-1234567890abcdef";
        
        storage.store(
            id,
            EncryptedFieldType::ApiKey,
            plaintext,
            Some("adapter-001"),
            &manager,
        ).unwrap();
        
        let retrieved = storage.retrieve(id, &manager).unwrap();
        assert_eq!(plaintext, retrieved);
    }

    #[test]
    fn test_reencryption() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let storage = EncryptedStorage::new(&db_path).unwrap();
        
        let old_key = generate_random_key().unwrap();
        let old_manager = EncryptionManager::new(old_key);
        
        let id = "test-token";
        let plaintext = "token_value";
        
        storage.store(
            id,
            EncryptedFieldType::Token,
            plaintext,
            None,
            &old_manager,
        ).unwrap();
        
        // 重新加密
        let new_key = generate_random_key().unwrap();
        let new_manager = EncryptionManager::new(new_key);
        
        let count = storage.reencrypt_all(&old_manager, &new_manager).unwrap();
        assert_eq!(count, 1);
        
        // 验证可以用新密钥解密
        let retrieved = storage.retrieve(id, &new_manager).unwrap();
        assert_eq!(plaintext, retrieved);
        
        // 验证旧密钥不能解密
        let old_result = storage.retrieve(id, &old_manager);
        assert!(old_result.is_err());
    }
}

