use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::Path;
use chrono::{DateTime, Utc};

/// 文件信息模型
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
    pub created_at: String,
}

/// 文件统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStats {
    pub total_files: i64,
    pub total_size: i64,
    pub total_deleted: i64,
    pub by_type: Vec<FileTypeStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTypeStats {
    pub file_type: String,
    pub count: i64,
    pub total_size: i64,
}

/// 初始化文件数据库表
pub fn init_file_tables(conn: &Connection) -> SqliteResult<()> {
    // 文件信息表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_type TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            hash TEXT NOT NULL,
            thumbnail_path TEXT,
            conversation_id TEXT,
            message_id TEXT,
            tags TEXT,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            accessed_at TEXT NOT NULL,
            is_deleted INTEGER DEFAULT 0
        )",
        [],
    )?;

    // 文件历史记录表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS file_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (file_id) REFERENCES files(id)
        )",
        [],
    )?;

    // 创建索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_files_conversation ON files(conversation_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_files_message ON files(message_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_file_history_file_id ON file_history(file_id)",
        [],
    )?;

    Ok(())
}

/// 保存文件信息
pub fn save_file_info(conn: &Connection, file_info: &FileInfo) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO files (
            id, name, original_name, file_path, file_size, file_type, mime_type, hash,
            thumbnail_path, conversation_id, message_id, tags, description,
            created_at, updated_at, accessed_at, is_deleted
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            file_info.id,
            file_info.name,
            file_info.original_name,
            file_info.file_path,
            file_info.file_size,
            file_info.file_type,
            file_info.mime_type,
            file_info.hash,
            file_info.thumbnail_path,
            file_info.conversation_id,
            file_info.message_id,
            file_info.tags,
            file_info.description,
            file_info.created_at,
            file_info.updated_at,
            file_info.accessed_at,
            file_info.is_deleted as i32,
        ],
    )?;

    // 记录历史
    add_file_history(conn, &file_info.id, "created", None)?;

    Ok(())
}

/// 获取文件信息
pub fn get_file_info(conn: &Connection, file_id: &str) -> SqliteResult<Option<FileInfo>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
         FROM files WHERE id = ?1"
    )?;

    let file_info = stmt.query_row(params![file_id], |row| {
        Ok(FileInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            original_name: row.get(2)?,
            file_path: row.get(3)?,
            file_size: row.get(4)?,
            file_type: row.get(5)?,
            mime_type: row.get(6)?,
            hash: row.get(7)?,
            thumbnail_path: row.get(8)?,
            conversation_id: row.get(9)?,
            message_id: row.get(10)?,
            tags: row.get(11)?,
            description: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            accessed_at: row.get(15)?,
            is_deleted: row.get::<_, i32>(16)? != 0,
        })
    }).optional()?;

    // 更新访问时间
    if file_info.is_some() {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE files SET accessed_at = ?1 WHERE id = ?2",
            params![now, file_id],
        )?;
    }

    Ok(file_info)
}

/// 查找文件（通过哈希）
pub fn find_file_by_hash(conn: &Connection, hash: &str) -> SqliteResult<Option<FileInfo>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
         FROM files WHERE hash = ?1 AND is_deleted = 0 LIMIT 1"
    )?;

    stmt.query_row(params![hash], |row| {
        Ok(FileInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            original_name: row.get(2)?,
            file_path: row.get(3)?,
            file_size: row.get(4)?,
            file_type: row.get(5)?,
            mime_type: row.get(6)?,
            hash: row.get(7)?,
            thumbnail_path: row.get(8)?,
            conversation_id: row.get(9)?,
            message_id: row.get(10)?,
            tags: row.get(11)?,
            description: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            accessed_at: row.get(15)?,
            is_deleted: row.get::<_, i32>(16)? != 0,
        })
    }).optional()
}

/// 列出文件
pub fn list_files(
    conn: &Connection,
    conversation_id: Option<&str>,
    file_type: Option<&str>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> SqliteResult<Vec<FileInfo>> {
    let mut query = String::from(
        "SELECT id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
         FROM files WHERE is_deleted = 0"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(conv_id) = conversation_id {
        query.push_str(" AND conversation_id = ?");
        params_vec.push(Box::new(conv_id.to_string()));
    }

    if let Some(ftype) = file_type {
        query.push_str(" AND file_type = ?");
        params_vec.push(Box::new(ftype.to_string()));
    }

    query.push_str(" ORDER BY created_at DESC");

    if let Some(lim) = limit {
        query.push_str(" LIMIT ?");
        params_vec.push(Box::new(lim));
    }

    if let Some(off) = offset {
        query.push_str(" OFFSET ?");
        params_vec.push(Box::new(off));
    }

    let mut stmt = conn.prepare(&query)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    
    let files = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(FileInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            original_name: row.get(2)?,
            file_path: row.get(3)?,
            file_size: row.get(4)?,
            file_type: row.get(5)?,
            mime_type: row.get(6)?,
            hash: row.get(7)?,
            thumbnail_path: row.get(8)?,
            conversation_id: row.get(9)?,
            message_id: row.get(10)?,
            tags: row.get(11)?,
            description: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            accessed_at: row.get(15)?,
            is_deleted: row.get::<_, i32>(16)? != 0,
        })
    })?;

    files.collect()
}

/// 更新文件信息
pub fn update_file_info(conn: &Connection, file_info: &FileInfo) -> SqliteResult<()> {
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE files SET 
            name = ?1, tags = ?2, description = ?3, updated_at = ?4
         WHERE id = ?5",
        params![
            file_info.name,
            file_info.tags,
            file_info.description,
            now,
            file_info.id,
        ],
    )?;

    add_file_history(conn, &file_info.id, "updated", None)?;

    Ok(())
}

/// 标记文件为已删除（软删除）
pub fn mark_file_deleted(conn: &Connection, file_id: &str) -> SqliteResult<()> {
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "UPDATE files SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
        params![now, file_id],
    )?;

    add_file_history(conn, file_id, "deleted", None)?;

    Ok(())
}

/// 永久删除文件记录
pub fn delete_file_permanently(conn: &Connection, file_id: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM file_history WHERE file_id = ?1", params![file_id])?;
    conn.execute("DELETE FROM files WHERE id = ?1", params![file_id])?;
    Ok(())
}

/// 批量删除文件
pub fn batch_delete_files(conn: &Connection, file_ids: &[String]) -> SqliteResult<usize> {
    let now = Utc::now().to_rfc3339();
    let mut count = 0;

    for file_id in file_ids {
        conn.execute(
            "UPDATE files SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
            params![now, file_id],
        )?;
        add_file_history(conn, file_id, "deleted", None)?;
        count += 1;
    }

    Ok(count)
}

/// 添加文件历史记录
pub fn add_file_history(
    conn: &Connection,
    file_id: &str,
    action: &str,
    details: Option<&str>,
) -> SqliteResult<()> {
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO file_history (file_id, action, details, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![file_id, action, details, now],
    )?;

    Ok(())
}

/// 获取文件历史记录
pub fn get_file_history(conn: &Connection, file_id: &str) -> SqliteResult<Vec<FileHistory>> {
    let mut stmt = conn.prepare(
        "SELECT id, file_id, action, details, created_at 
         FROM file_history 
         WHERE file_id = ?1 
         ORDER BY created_at DESC"
    )?;

    let history = stmt.query_map(params![file_id], |row| {
        Ok(FileHistory {
            id: row.get(0)?,
            file_id: row.get(1)?,
            action: row.get(2)?,
            details: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    history.collect()
}

/// 获取文件统计信息
pub fn get_file_stats(conn: &Connection) -> SqliteResult<FileStats> {
    let total_files: i64 = conn.query_row(
        "SELECT COUNT(*) FROM files WHERE is_deleted = 0",
        [],
        |row| row.get(0),
    )?;

    let total_size: i64 = conn.query_row(
        "SELECT COALESCE(SUM(file_size), 0) FROM files WHERE is_deleted = 0",
        [],
        |row| row.get(0),
    )?;

    let total_deleted: i64 = conn.query_row(
        "SELECT COUNT(*) FROM files WHERE is_deleted = 1",
        [],
        |row| row.get(0),
    )?;

    let mut stmt = conn.prepare(
        "SELECT file_type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
         FROM files 
         WHERE is_deleted = 0
         GROUP BY file_type"
    )?;

    let by_type = stmt.query_map([], |row| {
        Ok(FileTypeStats {
            file_type: row.get(0)?,
            count: row.get(1)?,
            total_size: row.get(2)?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    Ok(FileStats {
        total_files,
        total_size,
        total_deleted,
        by_type,
    })
}

/// 搜索文件
pub fn search_files(
    conn: &Connection,
    keyword: &str,
    file_type: Option<&str>,
) -> SqliteResult<Vec<FileInfo>> {
    let mut query = String::from(
        "SELECT id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
         FROM files 
         WHERE is_deleted = 0 AND (name LIKE ?1 OR original_name LIKE ?1 OR tags LIKE ?1 OR description LIKE ?1)"
    );

    let search_pattern = format!("%{}%", keyword);
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(search_pattern)];

    if let Some(ftype) = file_type {
        query.push_str(" AND file_type = ?");
        params_vec.push(Box::new(ftype.to_string()));
    }

    query.push_str(" ORDER BY created_at DESC LIMIT 100");

    let mut stmt = conn.prepare(&query)?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    
    let files = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(FileInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            original_name: row.get(2)?,
            file_path: row.get(3)?,
            file_size: row.get(4)?,
            file_type: row.get(5)?,
            mime_type: row.get(6)?,
            hash: row.get(7)?,
            thumbnail_path: row.get(8)?,
            conversation_id: row.get(9)?,
            message_id: row.get(10)?,
            tags: row.get(11)?,
            description: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            accessed_at: row.get(15)?,
            is_deleted: row.get::<_, i32>(16)? != 0,
        })
    })?;

    files.collect()
}

/// 清理已删除的文件（永久删除超过指定天数的软删除文件）
pub fn cleanup_deleted_files(conn: &Connection, days: i64) -> SqliteResult<Vec<FileInfo>> {
    let cutoff_date = (Utc::now() - chrono::Duration::days(days)).to_rfc3339();
    
    let mut stmt = conn.prepare(
        "SELECT id, name, original_name, file_path, file_size, file_type, mime_type, hash,
                thumbnail_path, conversation_id, message_id, tags, description,
                created_at, updated_at, accessed_at, is_deleted
         FROM files 
         WHERE is_deleted = 1 AND updated_at < ?1"
    )?;

    let files: Vec<FileInfo> = stmt.query_map(params![cutoff_date], |row| {
        Ok(FileInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            original_name: row.get(2)?,
            file_path: row.get(3)?,
            file_size: row.get(4)?,
            file_type: row.get(5)?,
            mime_type: row.get(6)?,
            hash: row.get(7)?,
            thumbnail_path: row.get(8)?,
            conversation_id: row.get(9)?,
            message_id: row.get(10)?,
            tags: row.get(11)?,
            description: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            accessed_at: row.get(15)?,
            is_deleted: row.get::<_, i32>(16)? != 0,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    // 删除历史记录和文件记录
    conn.execute(
        "DELETE FROM file_history WHERE file_id IN (
            SELECT id FROM files WHERE is_deleted = 1 AND updated_at < ?1
        )",
        params![cutoff_date],
    )?;

    conn.execute(
        "DELETE FROM files WHERE is_deleted = 1 AND updated_at < ?1",
        params![cutoff_date],
    )?;

    Ok(files)
}

