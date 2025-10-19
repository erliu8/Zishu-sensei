// 数据清除工具
use rusqlite::{Connection, Result as SqliteResult};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

/// 清除类型
#[derive(Debug, Clone)]
pub enum CleanupType {
    Conversations,     // 对话历史
    Cache,             // 缓存文件
    Logs,              // 日志文件
    SearchHistory,     // 搜索历史
    ClipboardHistory,  // 剪贴板历史
    TempFiles,         // 临时文件
    All,               // 全部
}

impl CleanupType {
    pub fn as_str(&self) -> &str {
        match self {
            CleanupType::Conversations => "conversations",
            CleanupType::Cache => "cache",
            CleanupType::Logs => "logs",
            CleanupType::SearchHistory => "search_history",
            CleanupType::ClipboardHistory => "clipboard_history",
            CleanupType::TempFiles => "temp_files",
            CleanupType::All => "all",
        }
    }
}

/// 清除结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct CleanupResult {
    pub cleanup_type: String,
    pub items_deleted: i64,
    pub space_freed_bytes: i64,
    pub errors: Vec<String>,
}

impl CleanupResult {
    fn new(cleanup_type: String) -> Self {
        Self {
            cleanup_type,
            items_deleted: 0,
            space_freed_bytes: 0,
            errors: Vec::new(),
        }
    }
}

/// 数据清除管理器
pub struct DataCleanupManager {
    app_handle: AppHandle,
    db_conn: Arc<Mutex<Connection>>,
}

impl DataCleanupManager {
    pub fn new(app_handle: AppHandle, db_conn: Arc<Mutex<Connection>>) -> Self {
        Self { app_handle, db_conn }
    }

    /// 执行数据清除
    pub fn cleanup(&self, cleanup_type: CleanupType) -> Result<CleanupResult, String> {
        match cleanup_type {
            CleanupType::Conversations => self.cleanup_conversations(),
            CleanupType::Cache => self.cleanup_cache(),
            CleanupType::Logs => self.cleanup_logs(),
            CleanupType::SearchHistory => self.cleanup_search_history(),
            CleanupType::ClipboardHistory => self.cleanup_clipboard_history(),
            CleanupType::TempFiles => self.cleanup_temp_files(),
            CleanupType::All => self.cleanup_all(),
        }
    }

    /// 清除对话历史
    fn cleanup_conversations(&self) -> Result<CleanupResult, String> {
        let mut result = CleanupResult::new("conversations".to_string());
        let conn = self.db_conn.lock().unwrap();

        // 计算要删除的对话数量
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM conversations", [], |row| row.get(0))
            .unwrap_or(0);

        // 计算关联消息的空间占用（估算）
        let space: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(LENGTH(content)), 0) FROM messages",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // 删除所有消息
        if let Err(e) = conn.execute("DELETE FROM messages", []) {
            result.errors.push(format!("删除消息失败: {}", e));
        }

        // 删除所有对话
        if let Err(e) = conn.execute("DELETE FROM conversations", []) {
            result.errors.push(format!("删除对话失败: {}", e));
        }

        result.items_deleted = count;
        result.space_freed_bytes = space;

        Ok(result)
    }

    /// 清除缓存文件
    fn cleanup_cache(&self) -> Result<CleanupResult, String> {
        let mut result = CleanupResult::new("cache".to_string());

        if let Some(cache_dir) = self.get_cache_dir() {
            match self.remove_directory_contents(&cache_dir) {
                Ok((items, space)) => {
                    result.items_deleted = items;
                    result.space_freed_bytes = space;
                }
                Err(e) => result.errors.push(e),
            }
        } else {
            result.errors.push("无法获取缓存目录".to_string());
        }

        Ok(result)
    }

    /// 清除日志文件
    fn cleanup_logs(&self) -> Result<CleanupResult, String> {
        let mut result = CleanupResult::new("logs".to_string());

        if let Some(log_dir) = self.get_log_dir() {
            match self.remove_directory_contents(&log_dir) {
                Ok((items, space)) => {
                    result.items_deleted = items;
                    result.space_freed_bytes = space;
                }
                Err(e) => result.errors.push(e),
            }
        } else {
            result.errors.push("无法获取日志目录".to_string());
        }

        Ok(result)
    }

    /// 清除搜索历史
    fn cleanup_search_history(&self) -> Result<CleanupResult, String> {
        let mut result = CleanupResult::new("search_history".to_string());
        let conn = self.db_conn.lock().unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM search_history", [], |row| row.get(0))
            .unwrap_or(0);

        if let Err(e) = conn.execute("DELETE FROM search_history", []) {
            result.errors.push(format!("删除搜索历史失败: {}", e));
        } else {
            result.items_deleted = count;
        }

        Ok(result)
    }

    /// 清除剪贴板历史
    fn cleanup_clipboard_history(&self) -> Result<CleanupResult, String> {
        let mut result = CleanupResult::new("clipboard_history".to_string());
        let conn = self.db_conn.lock().unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM clipboard_history", [], |row| row.get(0))
            .unwrap_or(0);

        if let Err(e) = conn.execute("DELETE FROM clipboard_history", []) {
            result.errors.push(format!("删除剪贴板历史失败: {}", e));
        } else {
            result.items_deleted = count;
        }

        Ok(result)
    }

    /// 清除临时文件
    fn cleanup_temp_files(&self) -> Result<CleanupResult, String> {
        let mut result = CleanupResult::new("temp_files".to_string());

        if let Some(temp_dir) = self.get_temp_dir() {
            match self.remove_directory_contents(&temp_dir) {
                Ok((items, space)) => {
                    result.items_deleted = items;
                    result.space_freed_bytes = space;
                }
                Err(e) => result.errors.push(e),
            }
        } else {
            result.errors.push("无法获取临时文件目录".to_string());
        }

        Ok(result)
    }

    /// 清除所有数据
    fn cleanup_all(&self) -> Result<CleanupResult, String> {
        let mut total_result = CleanupResult::new("all".to_string());

        let cleanup_types = vec![
            CleanupType::Conversations,
            CleanupType::Cache,
            CleanupType::Logs,
            CleanupType::SearchHistory,
            CleanupType::ClipboardHistory,
            CleanupType::TempFiles,
        ];

        for cleanup_type in cleanup_types {
            if let Ok(result) = self.cleanup(cleanup_type) {
                total_result.items_deleted += result.items_deleted;
                total_result.space_freed_bytes += result.space_freed_bytes;
                total_result.errors.extend(result.errors);
            }
        }

        Ok(total_result)
    }

    /// 清除旧数据（基于天数）
    pub fn cleanup_old_data(&self, days: i64) -> Result<CleanupResult, String> {
        let mut result = CleanupResult::new("old_data".to_string());
        let conn = self.db_conn.lock().unwrap();

        let cutoff_time = chrono::Utc::now().timestamp() - (days * 24 * 60 * 60);

        // 清除旧对话
        let deleted_conversations: i64 = conn
            .execute(
                "DELETE FROM conversations WHERE updated_at < ?1",
                [cutoff_time],
            )
            .map_err(|e| format!("删除旧对话失败: {}", e))?
            as i64;

        // 清除旧消息
        let deleted_messages: i64 = conn
            .execute(
                "DELETE FROM messages WHERE created_at < ?1",
                [cutoff_time],
            )
            .map_err(|e| format!("删除旧消息失败: {}", e))?
            as i64;

        result.items_deleted = deleted_conversations + deleted_messages;

        Ok(result)
    }

    /// 获取缓存目录
    fn get_cache_dir(&self) -> Option<PathBuf> {
        self.app_handle
            .path_resolver()
            .app_cache_dir()
    }

    /// 获取日志目录
    fn get_log_dir(&self) -> Option<PathBuf> {
        self.app_handle
            .path_resolver()
            .app_log_dir()
    }

    /// 获取临时文件目录
    fn get_temp_dir(&self) -> Option<PathBuf> {
        self.app_handle
            .path_resolver()
            .app_data_dir()
            .map(|d| d.join("temp"))
    }

    /// 删除目录内容并返回删除的文件数和释放的空间
    fn remove_directory_contents(&self, dir: &Path) -> Result<(i64, i64), String> {
        if !dir.exists() {
            return Ok((0, 0));
        }

        let mut items_deleted = 0i64;
        let mut space_freed = 0i64;

        let entries = fs::read_dir(dir)
            .map_err(|e| format!("读取目录失败: {}", e))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();

                // 获取文件大小
                if let Ok(metadata) = fs::metadata(&path) {
                    space_freed += metadata.len() as i64;
                }

                // 删除文件或目录
                if path.is_dir() {
                    if let Err(e) = fs::remove_dir_all(&path) {
                        eprintln!("删除目录失败 {:?}: {}", path, e);
                    } else {
                        items_deleted += 1;
                    }
                } else {
                    if let Err(e) = fs::remove_file(&path) {
                        eprintln!("删除文件失败 {:?}: {}", path, e);
                    } else {
                        items_deleted += 1;
                    }
                }
            }
        }

        Ok((items_deleted, space_freed))
    }

    /// 获取数据使用统计
    pub fn get_data_usage_stats(&self) -> Result<serde_json::Value, String> {
        let conn = self.db_conn.lock().unwrap();

        let conversation_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM conversations", [], |row| row.get(0))
            .unwrap_or(0);

        let message_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM messages", [], |row| row.get(0))
            .unwrap_or(0);

        let search_history_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM search_history", [], |row| row.get(0))
            .unwrap_or(0);

        // 计算缓存大小
        let cache_size = self.get_cache_dir()
            .and_then(|dir| self.calculate_directory_size(&dir).ok())
            .unwrap_or(0);

        // 计算日志大小
        let log_size = self.get_log_dir()
            .and_then(|dir| self.calculate_directory_size(&dir).ok())
            .unwrap_or(0);

        // 计算临时文件大小
        let temp_size = self.get_temp_dir()
            .and_then(|dir| self.calculate_directory_size(&dir).ok())
            .unwrap_or(0);

        Ok(serde_json::json!({
            "conversations": conversation_count,
            "messages": message_count,
            "search_history": search_history_count,
            "cache_size_bytes": cache_size,
            "log_size_bytes": log_size,
            "temp_size_bytes": temp_size,
            "total_size_bytes": cache_size + log_size + temp_size,
            "cache_size_mb": cache_size as f64 / 1024.0 / 1024.0,
            "log_size_mb": log_size as f64 / 1024.0 / 1024.0,
            "temp_size_mb": temp_size as f64 / 1024.0 / 1024.0,
            "total_size_mb": (cache_size + log_size + temp_size) as f64 / 1024.0 / 1024.0,
        }))
    }

    /// 计算目录大小
    fn calculate_directory_size(&self, dir: &Path) -> Result<i64, String> {
        if !dir.exists() {
            return Ok(0);
        }

        let mut total_size = 0i64;

        let entries = fs::read_dir(dir)
            .map_err(|e| format!("读取目录失败: {}", e))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    if let Ok(metadata) = fs::metadata(&path) {
                        total_size += metadata.len() as i64;
                    }
                } else if path.is_dir() {
                    if let Ok(size) = self.calculate_directory_size(&path) {
                        total_size += size;
                    }
                }
            }
        }

        Ok(total_size)
    }
}

