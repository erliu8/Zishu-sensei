/**
 * 日志系统数据库存储层
 * 
 * 提供日志的持久化存储和查询功能：
 * - 日志条目的CRUD操作
 * - 高性能的日志搜索和过滤
 * - 日志统计和分析
 * - 日志导出功能
 * - 远程上传状态管理
 */

use crate::utils::logger::{LogEntry, LogLevel, LoggerError, LoggerResult};
use chrono::{DateTime, Local, Utc};
use rusqlite::{params, Connection, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;

// ================================
// 数据库结构和类型
// ================================

/// 日志数据库管理器
pub struct LogDatabase {
    connection: Arc<RwLock<Connection>>,
}

/// 日志过滤条件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFilter {
    /// 日志级别过滤
    pub levels: Option<Vec<LogLevel>>,
    /// 模块名称过滤
    pub modules: Option<Vec<String>>,
    /// 时间范围过滤（Unix时间戳）
    pub time_range: Option<TimeRange>,
    /// 关键词搜索
    pub keywords: Option<Vec<String>>,
    /// 标签过滤
    pub tags: Option<Vec<String>>,
    /// 是否包含已上传的日志
    pub include_uploaded: Option<bool>,
    /// 文件名过滤
    pub files: Option<Vec<String>>,
}

/// 时间范围
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: i64, // Unix时间戳
    pub end: i64,   // Unix时间戳
}

/// 日志统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LogStatistics {
    /// 总日志数量
    pub total_count: usize,
    /// 各级别日志数量
    pub count_by_level: HashMap<String, usize>,
    /// 各模块日志数量
    pub count_by_module: HashMap<String, usize>,
    /// 按小时统计
    pub count_by_hour: HashMap<String, usize>,
    /// 按日期统计
    pub count_by_date: HashMap<String, usize>,
    /// 错误率
    pub error_rate: f64,
    /// 平均日志大小
    pub average_size: f64,
    /// 最早日志时间
    pub earliest_log: Option<i64>,
    /// 最新日志时间
    pub latest_log: Option<i64>,
    /// 上传状态统计
    pub upload_stats: UploadStatistics,
}

impl Default for LogStatistics {
    fn default() -> Self {
        Self {
            total_count: 0,
            count_by_level: HashMap::new(),
            count_by_module: HashMap::new(),
            count_by_hour: HashMap::new(),
            count_by_date: HashMap::new(),
            error_rate: 0.0,
            average_size: 0.0,
            earliest_log: None,
            latest_log: None,
            upload_stats: UploadStatistics::default(),
        }
    }
}

/// 上传统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UploadStatistics {
    pub total_uploaded: usize,
    pub pending_upload: usize,
    pub upload_success_rate: f64,
    pub last_upload_time: Option<i64>,
    pub last_upload_batch_size: usize,
}

impl Default for UploadStatistics {
    fn default() -> Self {
        Self {
            total_uploaded: 0,
            pending_upload: 0,
            upload_success_rate: 0.0,
            last_upload_time: None,
            last_upload_batch_size: 0,
        }
    }
}

/// 扩展的日志条目（包含数据库ID）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredLogEntry {
    pub id: i64,
    pub timestamp: DateTime<Utc>,
    pub local_time: DateTime<Local>,
    pub level: LogLevel,
    pub message: String,
    pub module: Option<String>,
    pub file: Option<String>,
    pub line: Option<u32>,
    pub thread: Option<String>,
    pub data: Option<String>, // JSON字符串
    pub stack: Option<String>,
    pub tags: Vec<String>,
    pub uploaded: bool,
    pub upload_attempts: i32,
    pub created_at: DateTime<Local>,
    pub size_bytes: i32,
}

impl From<StoredLogEntry> for LogEntry {
    fn from(stored: StoredLogEntry) -> Self {
        LogEntry {
            timestamp: stored.timestamp,
            local_time: stored.local_time,
            level: stored.level,
            message: stored.message,
            module: stored.module,
            file: stored.file,
            line: stored.line,
            thread: stored.thread,
            data: stored.data.and_then(|s| serde_json::from_str(&s).ok()),
            stack: stored.stack,
            tags: stored.tags,
        }
    }
}

// ================================
// 数据库实现
// ================================

impl LogDatabase {
    /// 创建新的日志数据库实例
    pub async fn new<P: AsRef<Path>>(db_path: P) -> LoggerResult<Self> {
        let connection = Connection::open(db_path.as_ref())
            .map_err(|e| LoggerError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("打开数据库失败: {}", e)
            )))?;
        
        let db = Self {
            connection: Arc::new(RwLock::new(connection)),
        };
        
        db.initialize_schema().await?;
        Ok(db)
    }
    
    /// 初始化数据库模式
    async fn initialize_schema(&self) -> LoggerResult<()> {
        let conn = self.connection.write().await;
        
        // 创建日志表
        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                local_timestamp INTEGER NOT NULL,
                level INTEGER NOT NULL,
                message TEXT NOT NULL,
                module TEXT,
                file TEXT,
                line INTEGER,
                thread TEXT,
                data TEXT, -- JSON字符串
                stack TEXT,
                tags TEXT, -- JSON数组字符串
                uploaded BOOLEAN NOT NULL DEFAULT FALSE,
                upload_attempts INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                size_bytes INTEGER NOT NULL DEFAULT 0
            )
            "#,
            [],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("创建日志表失败: {}", e)
        )))?;
        
        // 创建索引
        let indexes = vec![
            "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)",
            "CREATE INDEX IF NOT EXISTS idx_logs_module ON logs(module)",
            "CREATE INDEX IF NOT EXISTS idx_logs_uploaded ON logs(uploaded)",
            "CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp ON logs(level, timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_logs_module_timestamp ON logs(module, timestamp)",
        ];
        
        for index_sql in indexes {
            conn.execute(index_sql, []).map_err(|e| LoggerError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("创建索引失败: {}", e)
            )))?;
        }
        
        // 创建配置表
        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS log_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            "#,
            [],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("创建配置表失败: {}", e)
        )))?;
        
        // 创建上传记录表
        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS upload_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                upload_time INTEGER NOT NULL,
                batch_size INTEGER NOT NULL,
                success BOOLEAN NOT NULL,
                error_message TEXT,
                log_ids TEXT -- JSON数组
            )
            "#,
            [],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("创建上传历史表失败: {}", e)
        )))?;
        
        Ok(())
    }
    
    /// 插入日志条目
    pub async fn insert_log(&self, entry: &LogEntry) -> LoggerResult<i64> {
        let conn = self.connection.write().await;
        
        let timestamp = entry.timestamp.timestamp();
        let local_timestamp = entry.local_time.timestamp();
        let level = entry.level as i32;
        let data_json = entry.data.as_ref()
            .map(|d| serde_json::to_string(d).unwrap_or_default());
        let tags_json = serde_json::to_string(&entry.tags).unwrap_or_default();
        let size_bytes = serde_json::to_string(&entry).unwrap_or_default().len() as i32;
        let created_at = Local::now().timestamp();
        
        let id = conn.execute(
            r#"
            INSERT INTO logs (
                timestamp, local_timestamp, level, message, module, file, line,
                thread, data, stack, tags, created_at, size_bytes
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
            params![
                timestamp,
                local_timestamp,
                level,
                entry.message,
                entry.module,
                entry.file,
                entry.line,
                entry.thread,
                data_json,
                entry.stack,
                tags_json,
                created_at,
                size_bytes
            ],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("插入日志失败: {}", e)
        )))?;
        
        Ok(conn.last_insert_rowid())
    }
    
    /// 搜索日志条目
    pub async fn search_logs(
        &self,
        filter: Option<LogFilter>,
        page: usize,
        page_size: usize,
        sort_by: &str,
        sort_order: &str,
    ) -> LoggerResult<(Vec<LogEntry>, usize)> {
        let conn = self.connection.read().await;
        
        // 构建WHERE子句
        let (where_clause, params) = self.build_where_clause(&filter);
        
        // 构建排序子句
        let order_by = match sort_by {
            "level" => "level",
            "module" => "module",
            "message" => "message",
            "created_at" => "created_at",
            _ => "timestamp",
        };
        
        let order_direction = if sort_order.to_lowercase() == "asc" { "ASC" } else { "DESC" };
        
        // 计算总数
        let count_sql = format!("SELECT COUNT(*) FROM logs {}", where_clause);
        let total: usize = conn.query_row(&count_sql, &params[..], |row| {
            Ok(row.get::<_, i64>(0)? as usize)
        }).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("查询日志总数失败: {}", e)
        )))?;
        
        // 查询日志条目
        let offset = (page.saturating_sub(1)) * page_size;
        let query_sql = format!(
            r#"
            SELECT id, timestamp, local_timestamp, level, message, module, file, line,
                   thread, data, stack, tags, uploaded, upload_attempts, created_at, size_bytes
            FROM logs {}
            ORDER BY {} {}
            LIMIT {} OFFSET {}
            "#,
            where_clause, order_by, order_direction, page_size, offset
        );
        
        let mut stmt = conn.prepare(&query_sql).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("准备查询语句失败: {}", e)
        )))?;
        
        let logs: Result<Vec<LogEntry>, _> = stmt.query_map(&params[..], |row| {
            self.row_to_stored_log_entry(row)
        }).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("执行查询失败: {}", e)
        )))?.collect::<Result<Vec<_>, _>>().map(|stored_logs| {
            stored_logs.into_iter().map(|stored| stored.into()).collect()
        });
        
        let logs = logs.map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("解析查询结果失败: {}", e)
        )))?;
        
        Ok((logs, total))
    }
    
    /// 获取日志统计信息
    pub async fn get_statistics(&self, filter: Option<LogFilter>) -> LoggerResult<LogStatistics> {
        let conn = self.connection.read().await;
        
        let (where_clause, params) = self.build_where_clause(&filter);
        
        // 基本统计
        let total_count_sql = format!("SELECT COUNT(*) FROM logs {}", where_clause);
        let total_count: usize = conn.query_row(&total_count_sql, &params[..], |row| {
            Ok(row.get::<_, i64>(0)? as usize)
        }).unwrap_or(0);
        
        // 按级别统计
        let level_stats_sql = format!(
            "SELECT level, COUNT(*) FROM logs {} GROUP BY level",
            where_clause
        );
        let mut stmt = conn.prepare(&level_stats_sql).unwrap();
        let level_rows = stmt.query_map(&params[..], |row| {
            Ok((row.get::<_, i32>(0)?, row.get::<_, i64>(1)? as usize))
        }).unwrap();
        
        let mut count_by_level = HashMap::new();
        for row_result in level_rows {
            if let Ok((level_num, count)) = row_result {
                let level = match level_num {
                    0 => "TRACE",
                    1 => "DEBUG", 
                    2 => "INFO",
                    3 => "WARN",
                    4 => "ERROR",
                    5 => "FATAL",
                    _ => "UNKNOWN",
                };
                count_by_level.insert(level.to_string(), count);
            }
        }
        
        // 按模块统计
        let module_stats_sql = format!(
            "SELECT COALESCE(module, 'unknown'), COUNT(*) FROM logs {} GROUP BY module",
            where_clause
        );
        let mut stmt = conn.prepare(&module_stats_sql).unwrap();
        let module_rows = stmt.query_map(&params[..], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as usize))
        }).unwrap();
        
        let mut count_by_module = HashMap::new();
        for row_result in module_rows {
            if let Ok((module, count)) = row_result {
                count_by_module.insert(module, count);
            }
        }
        
        // 按小时统计
        let hour_stats_sql = format!(
            r#"
            SELECT strftime('%Y-%m-%d %H', datetime(timestamp, 'unixepoch', 'localtime')) as hour,
                   COUNT(*) 
            FROM logs {} 
            GROUP BY hour 
            ORDER BY hour DESC 
            LIMIT 24
            "#,
            where_clause
        );
        let mut stmt = conn.prepare(&hour_stats_sql).unwrap();
        let hour_rows = stmt.query_map(&params[..], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as usize))
        }).unwrap();
        
        let mut count_by_hour = HashMap::new();
        for row_result in hour_rows {
            if let Ok((hour, count)) = row_result {
                count_by_hour.insert(hour, count);
            }
        }
        
        // 按日期统计
        let date_stats_sql = format!(
            r#"
            SELECT strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch', 'localtime')) as date,
                   COUNT(*) 
            FROM logs {} 
            GROUP BY date 
            ORDER BY date DESC 
            LIMIT 30
            "#,
            where_clause
        );
        let mut stmt = conn.prepare(&date_stats_sql).unwrap();
        let date_rows = stmt.query_map(&params[..], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as usize))
        }).unwrap();
        
        let mut count_by_date = HashMap::new();
        for row_result in date_rows {
            if let Ok((date, count)) = row_result {
                count_by_date.insert(date, count);
            }
        }
        
        // 错误率计算
        let error_count: usize = count_by_level.get("ERROR").unwrap_or(&0) + 
                                 count_by_level.get("FATAL").unwrap_or(&0);
        let error_rate = if total_count > 0 {
            error_count as f64 / total_count as f64 * 100.0
        } else {
            0.0
        };
        
        // 平均大小
        let avg_size_sql = format!("SELECT AVG(size_bytes) FROM logs {}", where_clause);
        let average_size: f64 = conn.query_row(&avg_size_sql, &params[..], |row| {
            Ok(row.get::<_, f64>(0).unwrap_or(0.0))
        }).unwrap_or(0.0);
        
        // 时间范围
        let time_range_sql = format!(
            "SELECT MIN(timestamp), MAX(timestamp) FROM logs {}",
            where_clause
        );
        let (earliest_log, latest_log): (Option<i64>, Option<i64>) = 
            conn.query_row(&time_range_sql, &params[..], |row| {
                Ok((
                    row.get::<_, Option<i64>>(0)?,
                    row.get::<_, Option<i64>>(1)?
                ))
            }).unwrap_or((None, None));
        
        // 上传统计
        let upload_stats = self.get_upload_statistics_sync(&conn)?;
        
        Ok(LogStatistics {
            total_count,
            count_by_level,
            count_by_module,
            count_by_hour,
            count_by_date,
            error_rate,
            average_size,
            earliest_log,
            latest_log,
            upload_stats,
        })
    }
    
    /// 导出日志
    pub async fn export_logs(
        &self,
        filter: Option<LogFilter>,
        format: &str,
        file_path: &str,
    ) -> LoggerResult<usize> {
        use std::fs::File;
        use std::io::Write;
        
        let (logs, total) = self.search_logs(filter, 1, usize::MAX, "timestamp", "asc").await?;
        
        let mut file = File::create(file_path).map_err(|e| LoggerError::Io(e))?;
        
        match format.to_lowercase().as_str() {
            "json" => {
                let json = serde_json::to_string_pretty(&logs)
                    .map_err(|e| LoggerError::Serialization(e))?;
                file.write_all(json.as_bytes()).map_err(|e| LoggerError::Io(e))?;
            }
            "csv" => {
                // CSV 头部
                writeln!(file, "timestamp,level,module,message,file,line,tags")
                    .map_err(|e| LoggerError::Io(e))?;
                
                for log in &logs {
                    let tags = log.tags.join(";");
                    writeln!(
                        file,
                        "{},{},{},{},{},{},{}",
                        log.timestamp.timestamp(),
                        log.level.as_str(),
                        log.module.as_deref().unwrap_or(""),
                        log.message.replace(",", "\\,").replace("\n", "\\n"),
                        log.file.as_deref().unwrap_or(""),
                        log.line.unwrap_or(0),
                        tags
                    ).map_err(|e| LoggerError::Io(e))?;
                }
            }
            "txt" => {
                for log in &logs {
                    writeln!(file, "{}", log.to_text()).map_err(|e| LoggerError::Io(e))?;
                }
            }
            _ => {
                return Err(LoggerError::InvalidLevel(format!("不支持的导出格式: {}", format)));
            }
        }
        
        Ok(total)
    }
    
    /// 清理旧日志
    pub async fn cleanup_old_logs(&self, retention_days: u32) -> LoggerResult<usize> {
        let conn = self.connection.write().await;
        
        let cutoff_time = Local::now().timestamp() - (retention_days as i64 * 24 * 60 * 60);
        
        let deleted = conn.execute(
            "DELETE FROM logs WHERE created_at < ?1",
            params![cutoff_time],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("清理旧日志失败: {}", e)
        )))?;
        
        // 清理上传历史
        conn.execute(
            "DELETE FROM upload_history WHERE upload_time < ?1",
            params![cutoff_time],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("清理上传历史失败: {}", e)
        )))?;
        
        // 优化数据库
        conn.execute("VACUUM", []).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("优化数据库失败: {}", e)
        )))?;
        
        Ok(deleted)
    }
    
    /// 获取待上传的日志
    pub async fn get_pending_upload_logs(&self, limit: usize) -> LoggerResult<Vec<crate::commands::logging::LogEntryWithId>> {
        let conn = self.connection.read().await;
        
        let mut stmt = conn.prepare(
            r#"
            SELECT id, timestamp, local_timestamp, level, message, module, file, line,
                   thread, data, stack, tags, uploaded, upload_attempts, created_at, size_bytes
            FROM logs 
            WHERE uploaded = FALSE 
            ORDER BY created_at ASC 
            LIMIT ?1
            "#,
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("准备查询语句失败: {}", e)
        )))?;
        
        let logs: Result<Vec<_>, _> = stmt.query_map([limit], |row| {
            let stored = self.row_to_stored_log_entry(row)?;
            Ok(crate::commands::logging::LogEntryWithId {
                entry: stored.clone().into(),
                id: Some(stored.id),
                uploaded: stored.uploaded,
                created_at: Some(stored.created_at.timestamp()),
            })
        }).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("执行查询失败: {}", e)
        )))?.collect();
        
        logs.map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("解析查询结果失败: {}", e)
        )))
    }
    
    /// 标记日志为已上传
    pub async fn mark_logs_as_uploaded(&self, log_ids: Vec<i64>) -> LoggerResult<()> {
        let conn = self.connection.write().await;
        
        for id in log_ids {
            conn.execute(
                "UPDATE logs SET uploaded = TRUE, upload_attempts = upload_attempts + 1 WHERE id = ?1",
                params![id],
            ).map_err(|e| LoggerError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("标记日志已上传失败: {}", e)
            )))?;
        }
        
        Ok(())
    }
    
    /// 计算待上传日志数量
    pub async fn count_pending_upload_logs(&self) -> LoggerResult<usize> {
        let conn = self.connection.read().await;
        
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM logs WHERE uploaded = FALSE",
            [],
            |row| row.get(0)
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("统计待上传日志失败: {}", e)
        )))?;
        
        Ok(count as usize)
    }
    
    /// 获取/保存远程配置
    pub async fn get_remote_config(&self) -> LoggerResult<crate::commands::logging::RemoteLogConfig> {
        let conn = self.connection.read().await;
        
        match conn.query_row(
            "SELECT value FROM log_config WHERE key = 'remote_config'",
            [],
            |row| row.get::<_, String>(0)
        ) {
            Ok(config_json) => {
                serde_json::from_str(&config_json)
                    .map_err(|e| LoggerError::Serialization(e))
            }
            Err(_) => Ok(crate::commands::logging::RemoteLogConfig::default()),
        }
    }
    
    pub async fn save_remote_config(&self, config: crate::commands::logging::RemoteLogConfig) -> LoggerResult<()> {
        let conn = self.connection.write().await;
        
        let config_json = serde_json::to_string(&config)
            .map_err(|e| LoggerError::Serialization(e))?;
        
        conn.execute(
            r#"
            INSERT OR REPLACE INTO log_config (key, value, updated_at) 
            VALUES ('remote_config', ?1, ?2)
            "#,
            params![config_json, Local::now().timestamp()],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("保存远程配置失败: {}", e)
        )))?;
        
        Ok(())
    }
    
    /// 更新最后上传时间
    pub async fn update_last_upload_time(&self) -> LoggerResult<()> {
        let conn = self.connection.write().await;
        
        conn.execute(
            r#"
            INSERT OR REPLACE INTO log_config (key, value, updated_at) 
            VALUES ('last_upload_time', ?1, ?1)
            "#,
            params![Local::now().timestamp()],
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("更新上传时间失败: {}", e)
        )))?;
        
        Ok(())
    }
    
    /// 获取最后上传时间
    pub async fn get_last_upload_time(&self) -> LoggerResult<i64> {
        let conn = self.connection.read().await;
        
        conn.query_row(
            "SELECT value FROM log_config WHERE key = 'last_upload_time'",
            [],
            |row| row.get::<_, String>(0).and_then(|s| s.parse().map_err(|_| rusqlite::Error::InvalidColumnType(0, "last_upload_time".to_string(), rusqlite::types::Type::Text)))
        ).map_err(|e| LoggerError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("获取上传时间失败: {}", e)
        )))
    }
    
    // ================================
    // 私有辅助方法
    // ================================
    
    /// 构建WHERE子句
    fn build_where_clause(&self, filter: &Option<LogFilter>) -> (String, Vec<rusqlite::types::Value>) {
        let mut conditions = Vec::new();
        let mut params = Vec::new();
        
        if let Some(filter) = filter {
            // 级别过滤
            if let Some(ref levels) = filter.levels {
                if !levels.is_empty() {
                    let level_nums: Vec<i32> = levels.iter().map(|l| *l as i32).collect();
                    let placeholders: Vec<String> = level_nums.iter().map(|_| "?".to_string()).collect();
                    conditions.push(format!("level IN ({})", placeholders.join(",")));
                    for level_num in level_nums {
                        params.push(rusqlite::types::Value::Integer(level_num as i64));
                    }
                }
            }
            
            // 模块过滤
            if let Some(ref modules) = filter.modules {
                if !modules.is_empty() {
                    let placeholders: Vec<String> = modules.iter().map(|_| "?".to_string()).collect();
                    conditions.push(format!("module IN ({})", placeholders.join(",")));
                    for module in modules {
                        params.push(rusqlite::types::Value::Text(module.clone()));
                    }
                }
            }
            
            // 时间范围过滤
            if let Some(ref time_range) = filter.time_range {
                conditions.push("timestamp >= ? AND timestamp <= ?".to_string());
                params.push(rusqlite::types::Value::Integer(time_range.start));
                params.push(rusqlite::types::Value::Integer(time_range.end));
            }
            
            // 关键词搜索
            if let Some(ref keywords) = filter.keywords {
                for keyword in keywords {
                    conditions.push("(message LIKE ? OR module LIKE ? OR data LIKE ?)".to_string());
                    let pattern = format!("%{}%", keyword);
                    params.push(rusqlite::types::Value::Text(pattern.clone()));
                    params.push(rusqlite::types::Value::Text(pattern.clone()));
                    params.push(rusqlite::types::Value::Text(pattern));
                }
            }
            
            // 上传状态过滤
            if let Some(include_uploaded) = filter.include_uploaded {
                if !include_uploaded {
                    conditions.push("uploaded = FALSE".to_string());
                }
            }
            
            // 文件过滤
            if let Some(ref files) = filter.files {
                if !files.is_empty() {
                    let placeholders: Vec<String> = files.iter().map(|_| "?".to_string()).collect();
                    conditions.push(format!("file IN ({})", placeholders.join(",")));
                    for file in files {
                        params.push(rusqlite::types::Value::Text(file.clone()));
                    }
                }
            }
        }
        
        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };
        
        (where_clause, params)
    }
    
    /// 将数据库行转换为StoredLogEntry
    fn row_to_stored_log_entry(&self, row: &Row) -> SqliteResult<StoredLogEntry> {
        let tags_json: String = row.get("tags")?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        
        let timestamp_secs: i64 = row.get("timestamp")?;
        let local_timestamp_secs: i64 = row.get("local_timestamp")?;
        let created_at_secs: i64 = row.get("created_at")?;
        
        Ok(StoredLogEntry {
            id: row.get("id")?,
            timestamp: DateTime::from_timestamp(timestamp_secs, 0).unwrap_or_else(|| Utc::now()),
            local_time: DateTime::from_timestamp(local_timestamp_secs, 0)
                .map(|utc| utc.with_timezone(&Local::now().timezone()))
                .unwrap_or_else(|| Local::now()),
            level: match row.get::<_, i32>("level")? {
                0 => LogLevel::Trace,
                1 => LogLevel::Debug,
                2 => LogLevel::Info,
                3 => LogLevel::Warn,
                4 => LogLevel::Error,
                5 => LogLevel::Fatal,
                _ => LogLevel::Info,
            },
            message: row.get("message")?,
            module: row.get("module")?,
            file: row.get("file")?,
            line: row.get("line")?,
            thread: row.get("thread")?,
            data: row.get("data")?,
            stack: row.get("stack")?,
            tags,
            uploaded: row.get("uploaded")?,
            upload_attempts: row.get("upload_attempts")?,
            created_at: DateTime::from_timestamp(created_at_secs, 0)
                .map(|utc| utc.with_timezone(&Local::now().timezone()))
                .unwrap_or_else(|| Local::now()),
            size_bytes: row.get("size_bytes")?,
        })
    }
    
    /// 获取上传统计信息（同步版本）
    fn get_upload_statistics_sync(&self, conn: &Connection) -> LoggerResult<UploadStatistics> {
        let total_uploaded: i64 = conn.query_row(
            "SELECT COUNT(*) FROM logs WHERE uploaded = TRUE",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        let pending_upload: i64 = conn.query_row(
            "SELECT COUNT(*) FROM logs WHERE uploaded = FALSE", 
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        let total_logs = total_uploaded + pending_upload;
        let upload_success_rate = if total_logs > 0 {
            total_uploaded as f64 / total_logs as f64 * 100.0
        } else {
            0.0
        };
        
        let last_upload_time: Option<i64> = conn.query_row(
            "SELECT value FROM log_config WHERE key = 'last_upload_time'",
            [],
            |row| row.get::<_, String>(0).and_then(|s| s.parse().map_err(|_| rusqlite::Error::InvalidColumnType(0, "last_upload_time".to_string(), rusqlite::types::Type::Text)))
        ).ok();
        
        let last_upload_batch_size: i64 = conn.query_row(
            "SELECT batch_size FROM upload_history ORDER BY upload_time DESC LIMIT 1",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
        
        Ok(UploadStatistics {
            total_uploaded: total_uploaded as usize,
            pending_upload: pending_upload as usize,
            upload_success_rate,
            last_upload_time,
            last_upload_batch_size: last_upload_batch_size as usize,
        })
    }
}

// ================================
// 测试
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    
    #[tokio::test]
    async fn test_log_database_creation() {
        let temp_file = NamedTempFile::new().unwrap();
        let db = LogDatabase::new(temp_file.path()).await;
        assert!(db.is_ok());
    }
    
    #[tokio::test]
    async fn test_insert_and_search_logs() {
        let temp_file = NamedTempFile::new().unwrap();
        let db = LogDatabase::new(temp_file.path()).await.unwrap();
        
        let entry = LogEntry::new(LogLevel::Info, "Test message")
            .with_module("test_module");
        
        let id = db.insert_log(&entry).await.unwrap();
        assert!(id > 0);
        
        let (logs, total) = db.search_logs(None, 1, 10, "timestamp", "desc").await.unwrap();
        assert_eq!(total, 1);
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].message, "Test message");
    }
    
    #[tokio::test]
    async fn test_log_filtering() {
        let temp_file = NamedTempFile::new().unwrap();
        let db = LogDatabase::new(temp_file.path()).await.unwrap();
        
        // 插入不同级别的日志
        let _ = db.insert_log(&LogEntry::new(LogLevel::Info, "Info message")).await;
        let _ = db.insert_log(&LogEntry::new(LogLevel::Error, "Error message")).await;
        let _ = db.insert_log(&LogEntry::new(LogLevel::Debug, "Debug message")).await;
        
        // 测试级别过滤
        let filter = LogFilter {
            levels: Some(vec![LogLevel::Error]),
            modules: None,
            time_range: None,
            keywords: None,
            tags: None,
            include_uploaded: None,
            files: None,
        };
        
        let (logs, total) = db.search_logs(Some(filter), 1, 10, "timestamp", "desc").await.unwrap();
        assert_eq!(total, 1);
        assert_eq!(logs[0].level, LogLevel::Error);
    }
    
    #[tokio::test]
    async fn test_statistics() {
        let temp_file = NamedTempFile::new().unwrap();
        let db = LogDatabase::new(temp_file.path()).await.unwrap();
        
        // 插入测试数据
        let _ = db.insert_log(&LogEntry::new(LogLevel::Info, "Info 1")).await;
        let _ = db.insert_log(&LogEntry::new(LogLevel::Info, "Info 2")).await;
        let _ = db.insert_log(&LogEntry::new(LogLevel::Error, "Error 1")).await;
        
        let stats = db.get_statistics(None).await.unwrap();
        assert_eq!(stats.total_count, 3);
        assert_eq!(*stats.count_by_level.get("INFO").unwrap_or(&0), 2);
        assert_eq!(*stats.count_by_level.get("ERROR").unwrap_or(&0), 1);
    }
}
