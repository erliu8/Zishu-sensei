//! # 文件管理数据库模块 (PostgreSQL)
//! 
//! 提供文件元数据管理、历史追踪、去重、搜索和软删除功能

use serde::{Deserialize, Serialize};
use crate::database::DbPool;
use tracing::{info, error, warn, debug};
use chrono::Utc;
use std::collections::HashMap;

// ================================
// 数据结构定义
// ================================

/// 文件元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_path: String,
    pub file_size: i64,
    pub file_hash: String,
    pub created_at: i64,
}

/// 文件信息（用于命令）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub id: String,
    pub name: String,
    pub original_name: String,
    pub file_path: String,
    pub file_size: i64,
    pub file_type: String,
    pub mime_type: String,
    pub hash: String,
    pub thumbnail_path: Option<String>,
    pub conversation_id: Option<String>,
    pub message_id: Option<String>,
    pub tags: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub accessed_at: String,
    pub is_deleted: bool,
}

/// 文件历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHistory {
    pub id: i64,
    pub file_id: String,
    pub action: String,
    pub details: Option<String>,
    pub timestamp: String,
}

/// 文件统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStats {
    pub total_files: i64,
    pub total_size: i64,
    pub deleted_files: i64,
    pub file_types: HashMap<String, i64>,
}

// ================================
// 文件注册表
// ================================

pub struct FileRegistry {
    pool: DbPool,
}

impl FileRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建文件主表
        client.execute(
            "CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                original_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size BIGINT NOT NULL,
                file_type TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                hash TEXT NOT NULL,
                thumbnail_path TEXT,
                conversation_id TEXT,
                message_id TEXT,
                tags TEXT,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
                is_deleted BOOLEAN NOT NULL DEFAULT false
            )",
            &[],
        ).await?;

        // 创建文件历史表
        client.execute(
            "CREATE TABLE IF NOT EXISTS file_history (
                id BIGSERIAL PRIMARY KEY,
                file_id TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
            )",
            &[],
        ).await?;

        // 创建索引
        let indexes = vec![
            "CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash)",
            "CREATE INDEX IF NOT EXISTS idx_files_conversation ON files(conversation_id)",
            "CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type)",
            "CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted)",
            "CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_file_history_file_id ON file_history(file_id)",
            "CREATE INDEX IF NOT EXISTS idx_file_history_timestamp ON file_history(timestamp)",
        ];

        for index_sql in indexes {
            client.execute(index_sql, &[]).await?;
        }

        info!("✅ 文件管理表初始化完成");
        Ok(())
    }

    pub fn register_file(&self, metadata: FileMetadata) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let handle = tokio::runtime::Handle::current();
        handle.block_on(async {
            let client = self.pool.get().await?;
            
            let now = Utc::now();
            client.execute(
                "INSERT INTO files (id, name, original_name, file_path, file_size, file_type, mime_type, hash, created_at, updated_at, accessed_at, is_deleted)
                VALUES ($1, $2, $3, $4, $5, 'unknown', 'application/octet-stream', $6, $7, $7, $7, false)
                ON CONFLICT (id) DO UPDATE SET
                    file_path = EXCLUDED.file_path,
                    file_size = EXCLUDED.file_size,
                    hash = EXCLUDED.hash,
                    updated_at = EXCLUDED.updated_at",
                &[
                    &metadata.file_hash,
                    &metadata.file_path.split('/').last().unwrap_or("unknown"),
                    &metadata.file_path.split('/').last().unwrap_or("unknown"),
                    &metadata.file_path,
                    &metadata.file_size,
                    &metadata.file_hash,
                    &now,
                ],
            ).await?;
            
            Ok(())
        })
    }

    pub fn get_file(&self, file_path: &str) -> Result<Option<FileMetadata>, Box<dyn std::error::Error + Send + Sync>> {
        let handle = tokio::runtime::Handle::current();
        handle.block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT file_path, file_size, hash, EXTRACT(EPOCH FROM created_at)::BIGINT as created_at 
                FROM files WHERE file_path = $1 AND is_deleted = false",
                &[&file_path],
            ).await?;

            if rows.is_empty() {
                return Ok(None);
            }

            let row = &rows[0];
            Ok(Some(FileMetadata {
                file_path: row.get("file_path"),
                file_size: row.get("file_size"),
                file_hash: row.get("hash"),
                created_at: row.get("created_at"),
            }))
        })
    }
}

// ================================
// 兼容函数 - 用于 commands/file.rs
// ================================

// 虚拟连接类型，用于保持API兼容性
pub struct DummyConnection;

pub fn init_file_tables(_conn: &DummyConnection) -> anyhow::Result<()> {
    // PostgreSQL 表会在应用启动时通过 FileRegistry::init_tables 创建
    Ok(())
}

pub fn save_file_info(_conn: &DummyConnection, file_info: &FileInfo) -> anyhow::Result<()> {
    // 获取全局数据库连接池
    // 注意：这需要应用在初始化时设置全局池
    // 目前使用stub实现，实际应该通过依赖注入
    debug!("保存文件信息: {}", file_info.id);
    Ok(())
}

pub fn get_file_info(_conn: &DummyConnection, file_id: &str) -> anyhow::Result<Option<FileInfo>> {
    debug!("获取文件信息: {}", file_id);
    Ok(None)
}

pub fn update_file_info(_conn: &DummyConnection, file_info: &FileInfo) -> anyhow::Result<()> {
    debug!("更新文件信息: {}", file_info.id);
    Ok(())
}

pub fn mark_file_deleted(_conn: &DummyConnection, file_id: &str) -> anyhow::Result<()> {
    debug!("标记文件已删除: {}", file_id);
    Ok(())
}

pub fn delete_file_permanently(_conn: &DummyConnection, file_id: &str) -> anyhow::Result<()> {
    debug!("永久删除文件: {}", file_id);
    Ok(())
}

pub fn list_files(
    _conn: &DummyConnection,
    _conversation_id: Option<&str>,
    _file_type: Option<&str>,
    _limit: Option<i32>,
    _offset: Option<i32>,
) -> anyhow::Result<Vec<FileInfo>> {
    debug!("列出文件");
    Ok(vec![])
}

pub fn search_files(
    _conn: &DummyConnection,
    keyword: &str,
    _file_type: Option<&str>,
) -> anyhow::Result<Vec<FileInfo>> {
    debug!("搜索文件: {}", keyword);
    Ok(vec![])
}

pub fn find_file_by_hash(_conn: &DummyConnection, hash: &str) -> anyhow::Result<Option<FileInfo>> {
    debug!("按哈希查找文件: {}", hash);
    Ok(None)
}

pub fn batch_delete_files(_conn: &DummyConnection, file_ids: &[String]) -> anyhow::Result<usize> {
    debug!("批量删除 {} 个文件", file_ids.len());
    Ok(0)
}

pub fn cleanup_deleted_files(_conn: &DummyConnection, days: i64) -> anyhow::Result<Vec<FileInfo>> {
    debug!("清理 {} 天前删除的文件", days);
    Ok(vec![])
}

pub fn get_file_history(_conn: &DummyConnection, file_id: &str) -> anyhow::Result<Vec<FileHistory>> {
    debug!("获取文件历史: {}", file_id);
    Ok(vec![])
}

pub fn add_file_history(
    _conn: &DummyConnection,
    file_id: &str,
    action: &str,
    details: Option<&str>,
) -> anyhow::Result<()> {
    debug!("添加文件历史: {} - {}", file_id, action);
    Ok(())
}

pub fn get_file_stats(_conn: &DummyConnection) -> anyhow::Result<FileStats> {
    debug!("获取文件统计");
    Ok(FileStats {
        total_files: 0,
        total_size: 0,
        deleted_files: 0,
        file_types: HashMap::new(),
    })
}

// ================================
// PostgreSQL 实现 - 用于未来迁移
// ================================

/// 文件注册表（完整实现）
pub struct FileRegistryImpl {
    pool: DbPool,
}

impl FileRegistryImpl {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 保存文件信息
    pub async fn save_file_info_async(&self, file_info: &FileInfo) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO files (
                id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                file_path = EXCLUDED.file_path,
                file_size = EXCLUDED.file_size,
                thumbnail_path = EXCLUDED.thumbnail_path,
                tags = EXCLUDED.tags,
                description = EXCLUDED.description,
                updated_at = EXCLUDED.updated_at",
            &[
                &file_info.id,
                &file_info.name,
                &file_info.original_name,
                &file_info.file_path,
                &file_info.file_size,
                &file_info.file_type,
                &file_info.mime_type,
                &file_info.hash,
                &file_info.thumbnail_path,
                &file_info.conversation_id,
                &file_info.message_id,
                &file_info.tags,
                &file_info.description,
                &file_info.created_at.parse::<chrono::DateTime<Utc>>().ok(),
                &file_info.updated_at.parse::<chrono::DateTime<Utc>>().ok(),
                &file_info.accessed_at.parse::<chrono::DateTime<Utc>>().ok(),
                &file_info.is_deleted,
            ],
        ).await?;

        // 添加历史记录
        self.add_file_history_async(&file_info.id, "created", None).await?;

        info!("✅ 文件信息已保存: {}", file_info.id);
        Ok(())
    }

    /// 获取文件信息
    pub async fn get_file_info_async(&self, file_id: &str) -> Result<Option<FileInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT 
                id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
            FROM files WHERE id = $1",
            &[&file_id],
        ).await?;

        if rows.is_empty() {
            return Ok(None);
        }

        let row = &rows[0];
        Ok(Some(FileInfo {
            id: row.get("id"),
            name: row.get("name"),
            original_name: row.get("original_name"),
            file_path: row.get("file_path"),
            file_size: row.get("file_size"),
            file_type: row.get("file_type"),
            mime_type: row.get("mime_type"),
            hash: row.get("hash"),
            thumbnail_path: row.get("thumbnail_path"),
            conversation_id: row.get("conversation_id"),
            message_id: row.get("message_id"),
            tags: row.get("tags"),
            description: row.get("description"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, chrono::DateTime<Utc>>("accessed_at").to_rfc3339(),
            is_deleted: row.get("is_deleted"),
        }))
    }

    /// 更新文件信息
    pub async fn update_file_info_async(&self, file_info: &FileInfo) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "UPDATE files SET
                name = $2,
                tags = $3,
                description = $4,
                updated_at = NOW()
            WHERE id = $1",
            &[
                &file_info.id,
                &file_info.name,
                &file_info.tags,
                &file_info.description,
            ],
        ).await?;

        self.add_file_history_async(&file_info.id, "updated", None).await?;

        info!("✅ 文件信息已更新: {}", file_info.id);
        Ok(())
    }

    /// 标记文件已删除（软删除）
    pub async fn mark_file_deleted_async(&self, file_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "UPDATE files SET is_deleted = true, updated_at = NOW() WHERE id = $1",
            &[&file_id],
        ).await?;

        self.add_file_history_async(file_id, "deleted", None).await?;

        info!("✅ 文件已标记为删除: {}", file_id);
        Ok(())
    }

    /// 永久删除文件
    pub async fn delete_file_permanently_async(&self, file_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "DELETE FROM files WHERE id = $1",
            &[&file_id],
        ).await?;

        info!("✅ 文件已永久删除: {}", file_id);
        Ok(())
    }

    /// 列出文件
    pub async fn list_files_async(
        &self,
        conversation_id: Option<&str>,
        file_type: Option<&str>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<FileInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let mut query = String::from(
            "SELECT 
                id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
            FROM files WHERE is_deleted = false"
        );

        let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![];
        let mut param_idx = 1;

        if let Some(conv_id) = conversation_id {
            query.push_str(&format!(" AND conversation_id = ${}", param_idx));
            params.push(&conv_id);
            param_idx += 1;
        }

        if let Some(ftype) = file_type {
            query.push_str(&format!(" AND file_type = ${}", param_idx));
            params.push(&ftype);
            param_idx += 1;
        }

        query.push_str(" ORDER BY created_at DESC");

        if let Some(lim) = limit {
            query.push_str(&format!(" LIMIT ${}", param_idx));
            params.push(&lim);
            param_idx += 1;
        }

        if let Some(off) = offset {
            query.push_str(&format!(" OFFSET ${}", param_idx));
            params.push(&off);
        }

        let rows = client.query(&query, &params).await?;

        let files = rows.iter().map(|row| FileInfo {
            id: row.get("id"),
            name: row.get("name"),
            original_name: row.get("original_name"),
            file_path: row.get("file_path"),
            file_size: row.get("file_size"),
            file_type: row.get("file_type"),
            mime_type: row.get("mime_type"),
            hash: row.get("hash"),
            thumbnail_path: row.get("thumbnail_path"),
            conversation_id: row.get("conversation_id"),
            message_id: row.get("message_id"),
            tags: row.get("tags"),
            description: row.get("description"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, chrono::DateTime<Utc>>("accessed_at").to_rfc3339(),
            is_deleted: row.get("is_deleted"),
        }).collect();

        debug!("📋 找到 {} 个文件", files.len());
        Ok(files)
    }

    /// 搜索文件
    pub async fn search_files_async(
        &self,
        keyword: &str,
        file_type: Option<&str>,
    ) -> Result<Vec<FileInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let search_pattern = format!("%{}%", keyword);
        
        let mut query = String::from(
            "SELECT 
                id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
            FROM files 
            WHERE is_deleted = false 
            AND (name ILIKE $1 OR original_name ILIKE $1 OR description ILIKE $1 OR tags ILIKE $1)"
        );

        let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![&search_pattern];

        if let Some(ftype) = file_type {
            query.push_str(" AND file_type = $2");
            params.push(&ftype);
        }

        query.push_str(" ORDER BY created_at DESC LIMIT 100");

        let rows = client.query(&query, &params).await?;

        let files = rows.iter().map(|row| FileInfo {
            id: row.get("id"),
            name: row.get("name"),
            original_name: row.get("original_name"),
            file_path: row.get("file_path"),
            file_size: row.get("file_size"),
            file_type: row.get("file_type"),
            mime_type: row.get("mime_type"),
            hash: row.get("hash"),
            thumbnail_path: row.get("thumbnail_path"),
            conversation_id: row.get("conversation_id"),
            message_id: row.get("message_id"),
            tags: row.get("tags"),
            description: row.get("description"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, chrono::DateTime<Utc>>("accessed_at").to_rfc3339(),
            is_deleted: row.get("is_deleted"),
        }).collect();

        debug!("🔍 搜索到 {} 个文件", files.len());
        Ok(files)
    }

    /// 按哈希查找文件（去重）
    pub async fn find_file_by_hash_async(&self, hash: &str) -> Result<Option<FileInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT 
                id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
            FROM files WHERE hash = $1 AND is_deleted = false LIMIT 1",
            &[&hash],
        ).await?;

        if rows.is_empty() {
            return Ok(None);
        }

        let row = &rows[0];
        Ok(Some(FileInfo {
            id: row.get("id"),
            name: row.get("name"),
            original_name: row.get("original_name"),
            file_path: row.get("file_path"),
            file_size: row.get("file_size"),
            file_type: row.get("file_type"),
            mime_type: row.get("mime_type"),
            hash: row.get("hash"),
            thumbnail_path: row.get("thumbnail_path"),
            conversation_id: row.get("conversation_id"),
            message_id: row.get("message_id"),
            tags: row.get("tags"),
            description: row.get("description"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, chrono::DateTime<Utc>>("accessed_at").to_rfc3339(),
            is_deleted: row.get("is_deleted"),
        }))
    }

    /// 批量删除文件
    pub async fn batch_delete_files_async(&self, file_ids: &[String]) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 构建参数占位符
        let placeholders: Vec<String> = (1..=file_ids.len()).map(|i| format!("${}", i)).collect();
        let query = format!(
            "UPDATE files SET is_deleted = true, updated_at = NOW() WHERE id IN ({})",
            placeholders.join(", ")
        );

        let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = 
            file_ids.iter().map(|id| id as &(dyn tokio_postgres::types::ToSql + Sync)).collect();

        let affected = client.execute(&query, &params).await?;

        info!("✅ 批量删除了 {} 个文件", affected);
        Ok(affected as usize)
    }

    /// 清理删除的文件
    pub async fn cleanup_deleted_files_async(&self, days: i64) -> Result<Vec<FileInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let cutoff = Utc::now() - chrono::Duration::days(days);

        let rows = client.query(
            "SELECT 
                id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
            FROM files 
            WHERE is_deleted = true AND updated_at < $1",
            &[&cutoff],
        ).await?;

        let files: Vec<FileInfo> = rows.iter().map(|row| FileInfo {
            id: row.get("id"),
            name: row.get("name"),
            original_name: row.get("original_name"),
            file_path: row.get("file_path"),
            file_size: row.get("file_size"),
            file_type: row.get("file_type"),
            mime_type: row.get("mime_type"),
            hash: row.get("hash"),
            thumbnail_path: row.get("thumbnail_path"),
            conversation_id: row.get("conversation_id"),
            message_id: row.get("message_id"),
            tags: row.get("tags"),
            description: row.get("description"),
            created_at: row.get::<_, chrono::DateTime<Utc>>("created_at").to_rfc3339(),
            updated_at: row.get::<_, chrono::DateTime<Utc>>("updated_at").to_rfc3339(),
            accessed_at: row.get::<_, chrono::DateTime<Utc>>("accessed_at").to_rfc3339(),
            is_deleted: row.get("is_deleted"),
        }).collect();

        // 永久删除
        if !files.is_empty() {
            let file_ids: Vec<&str> = files.iter().map(|f| f.id.as_str()).collect();
            let placeholders: Vec<String> = (1..=file_ids.len()).map(|i| format!("${}", i)).collect();
            let query = format!("DELETE FROM files WHERE id IN ({})", placeholders.join(", "));
            
            let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = 
                file_ids.iter().map(|id| id as &(dyn tokio_postgres::types::ToSql + Sync)).collect();

            client.execute(&query, &params).await?;
        }

        info!("🗑️  清理了 {} 个旧文件", files.len());
        Ok(files)
    }

    /// 获取文件历史
    pub async fn get_file_history_async(&self, file_id: &str) -> Result<Vec<FileHistory>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, file_id, action, details, timestamp
            FROM file_history
            WHERE file_id = $1
            ORDER BY timestamp DESC",
            &[&file_id],
        ).await?;

        let history = rows.iter().map(|row| FileHistory {
            id: row.get("id"),
            file_id: row.get("file_id"),
            action: row.get("action"),
            details: row.get("details"),
            timestamp: row.get::<_, chrono::DateTime<Utc>>("timestamp").to_rfc3339(),
        }).collect();

        Ok(history)
    }

    /// 添加文件历史
    pub async fn add_file_history_async(
        &self,
        file_id: &str,
        action: &str,
        details: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO file_history (file_id, action, details, timestamp)
            VALUES ($1, $2, $3, NOW())",
            &[&file_id, &action, &details],
        ).await?;

        debug!("📝 添加文件历史: {} - {}", file_id, action);
        Ok(())
    }

    /// 获取文件统计
    pub async fn get_file_stats_async(&self) -> Result<FileStats, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 总文件数
        let total_row = client.query_one(
            "SELECT COUNT(*) as count FROM files WHERE is_deleted = false",
            &[],
        ).await?;
        let total_files: i64 = total_row.get("count");

        // 总大小
        let size_row = client.query_one(
            "SELECT COALESCE(SUM(file_size), 0) as total FROM files WHERE is_deleted = false",
            &[],
        ).await?;
        let total_size: i64 = size_row.get("total");

        // 已删除文件数
        let deleted_row = client.query_one(
            "SELECT COUNT(*) as count FROM files WHERE is_deleted = true",
            &[],
        ).await?;
        let deleted_files: i64 = deleted_row.get("count");

        // 按类型统计
        let type_rows = client.query(
            "SELECT file_type, COUNT(*) as count 
            FROM files 
            WHERE is_deleted = false 
            GROUP BY file_type",
            &[],
        ).await?;

        let mut file_types = HashMap::new();
        for row in type_rows {
            let file_type: String = row.get("file_type");
            let count: i64 = row.get("count");
            file_types.insert(file_type, count);
        }

        Ok(FileStats {
            total_files,
            total_size,
            deleted_files,
            file_types,
        })
    }
}
