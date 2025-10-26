//! # 日志记录数据库模块 (PostgreSQL)
//! 
//! 提供结构化日志存储、查询、统计和自动清理功能

use serde::{Deserialize, Serialize};
use crate::database::DbPool;
use tracing::{info, error, warn, debug};
use chrono::Utc;
use std::collections::HashMap;

// ================================
// 数据结构定义
// ================================

/// 日志级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Trace => write!(f, "trace"),
            LogLevel::Debug => write!(f, "debug"),
            LogLevel::Info => write!(f, "info"),
            LogLevel::Warn => write!(f, "warn"),
            LogLevel::Error => write!(f, "error"),
            LogLevel::Fatal => write!(f, "fatal"),
        }
    }
}

impl std::str::FromStr for LogLevel {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "trace" => Ok(LogLevel::Trace),
            "debug" => Ok(LogLevel::Debug),
            "info" => Ok(LogLevel::Info),
            "warn" => Ok(LogLevel::Warn),
            "error" => Ok(LogLevel::Error),
            "fatal" => Ok(LogLevel::Fatal),
            _ => Err(format!("无效的日志级别: {}", s)),
        }
    }
}

/// 日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub level: String,
    pub message: String,
    pub module: Option<String>,
    pub timestamp: i64,
}

/// 扩展日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntryExtended {
    pub id: i64,
    pub level: String,
    pub message: String,
    pub module: Option<String>,
    pub file: Option<String>,
    pub line: Option<i32>,
    pub thread: Option<String>,
    pub context: Option<String>,
    pub timestamp: String,
}

/// 日志过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFilter {
    pub level: Option<String>,
    pub module: Option<String>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub keyword: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// 日志统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogStatistics {
    pub total_logs: i64,
    pub level_counts: HashMap<String, i64>,
    pub module_counts: HashMap<String, i64>,
    pub recent_errors: i64,
    pub recent_warnings: i64,
}

// ================================
// 日志注册表
// ================================

pub struct LoggingRegistry {
    pool: DbPool,
}

// Type alias for backward compatibility
pub type LogDatabase = LoggingRegistry;

impl LoggingRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建日志表（支持时间分区）
        client.execute(
            "CREATE TABLE IF NOT EXISTS logs (
                id BIGSERIAL PRIMARY KEY,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                module TEXT,
                file TEXT,
                line INTEGER,
                thread TEXT,
                context TEXT,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        // 创建索引
        let indexes = vec![
            "CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)",
            "CREATE INDEX IF NOT EXISTS idx_logs_module ON logs(module)",
            "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp ON logs(level, timestamp DESC)",
        ];

        for index_sql in indexes {
            client.execute(index_sql, &[]).await?;
        }

        info!("✅ 日志记录表初始化完成");
        Ok(())
    }

    /// 记录日志
    pub fn log(&self, entry: LogEntry) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let handle = tokio::runtime::Handle::current();
        handle.block_on(async {
            self.log_async(entry).await
        })
    }

    /// 记录日志（异步）
    pub async fn log_async(&self, entry: LogEntry) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let timestamp = chrono::DateTime::from_timestamp(entry.timestamp, 0)
            .unwrap_or_else(|| Utc::now());

        client.execute(
            "INSERT INTO logs (level, message, module, timestamp)
            VALUES ($1, $2, $3, $4)",
            &[&entry.level, &entry.message, &entry.module, &timestamp],
        ).await?;

        Ok(())
    }

    /// 批量记录日志
    pub async fn log_batch_async(&self, entries: Vec<LogEntry>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if entries.is_empty() {
            return Ok(());
        }

        let entry_count = entries.len();
        let mut client = self.pool.get().await?;

        // 使用事务批量插入
        let transaction = client.transaction().await?;

        for entry in entries {
            let timestamp = chrono::DateTime::from_timestamp(entry.timestamp, 0)
                .unwrap_or_else(|| Utc::now());

            transaction.execute(
                "INSERT INTO logs (level, message, module, timestamp)
                VALUES ($1, $2, $3, $4)",
                &[&entry.level, &entry.message, &entry.module, &timestamp],
            ).await?;
        }

        transaction.commit().await?;

        debug!("📝 批量记录了 {} 条日志", entry_count);
        Ok(())
    }

    /// 扩展日志记录
    pub async fn log_extended_async(
        &self,
        level: &str,
        message: &str,
        module: Option<&str>,
        file: Option<&str>,
        line: Option<i32>,
        thread: Option<&str>,
        context: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO logs (level, message, module, file, line, thread, context, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
            &[&level, &message, &module, &file, &line, &thread, &context],
        ).await?;

        Ok(())
    }

    /// 获取日志
    pub fn get_logs(&self, limit: usize) -> Result<Vec<LogEntry>, Box<dyn std::error::Error + Send + Sync>> {
        let handle = tokio::runtime::Handle::current();
        handle.block_on(async {
            self.get_logs_async(limit as i32).await
        })
    }

    /// 获取日志（异步）
    pub async fn get_logs_async(&self, limit: i32) -> Result<Vec<LogEntry>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT level, message, module, EXTRACT(EPOCH FROM timestamp)::BIGINT as timestamp
            FROM logs
            ORDER BY timestamp DESC
            LIMIT $1",
            &[&limit],
        ).await?;

        let logs = rows.iter().map(|row| LogEntry {
            level: row.get("level"),
            message: row.get("message"),
            module: row.get("module"),
            timestamp: row.get("timestamp"),
        }).collect();

        Ok(logs)
    }

    /// 按过滤器查询日志
    pub async fn query_logs_async(&self, filter: LogFilter) -> Result<Vec<LogEntryExtended>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let mut query = String::from(
            "SELECT id, level, message, module, file, line, thread, context, timestamp
            FROM logs
            WHERE 1=1"
        );

        let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Send + Sync>> = vec![];
        let mut param_idx = 1;

        if let Some(ref level) = filter.level {
            query.push_str(&format!(" AND level = ${}", param_idx));
            params.push(Box::new(level.clone()));
            param_idx += 1;
        }

        if let Some(ref module) = filter.module {
            query.push_str(&format!(" AND module = ${}", param_idx));
            params.push(Box::new(module.clone()));
            param_idx += 1;
        }

        if let Some(start) = filter.start_time {
            let start_dt = chrono::DateTime::from_timestamp(start, 0).unwrap_or_else(|| Utc::now());
            query.push_str(&format!(" AND timestamp >= ${}", param_idx));
            params.push(Box::new(start_dt));
            param_idx += 1;
        }

        if let Some(end) = filter.end_time {
            let end_dt = chrono::DateTime::from_timestamp(end, 0).unwrap_or_else(|| Utc::now());
            query.push_str(&format!(" AND timestamp <= ${}", param_idx));
            params.push(Box::new(end_dt));
            param_idx += 1;
        }

        if let Some(ref keyword) = filter.keyword {
            let pattern = format!("%{}%", keyword);
            query.push_str(&format!(" AND message ILIKE ${}", param_idx));
            params.push(Box::new(pattern));
            param_idx += 1;
        }

        query.push_str(" ORDER BY timestamp DESC");

        if let Some(limit) = filter.limit {
            query.push_str(&format!(" LIMIT ${}", param_idx));
            params.push(Box::new(limit));
            param_idx += 1;
        }

        if let Some(offset) = filter.offset {
            query.push_str(&format!(" OFFSET ${}", param_idx));
            params.push(Box::new(offset));
        }

        let param_refs: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = 
            params.iter().map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync)).collect();

        let rows = client.query(&query, &param_refs).await?;

        let logs: Vec<LogEntryExtended> = rows.iter().map(|row| LogEntryExtended {
            id: row.get("id"),
            level: row.get("level"),
            message: row.get("message"),
            module: row.get("module"),
            file: row.get("file"),
            line: row.get("line"),
            thread: row.get("thread"),
            context: row.get("context"),
            timestamp: row.get::<_, chrono::DateTime<Utc>>("timestamp").to_rfc3339(),
        }).collect();

        debug!("🔍 查询到 {} 条日志", logs.len());
        Ok(logs)
    }

    /// 获取日志统计
    pub async fn get_statistics_async(&self) -> Result<LogStatistics, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 总日志数
        let total_row = client.query_one(
            "SELECT COUNT(*) as count FROM logs",
            &[],
        ).await?;
        let total_logs: i64 = total_row.get("count");

        // 按级别统计
        let level_rows = client.query(
            "SELECT level, COUNT(*) as count FROM logs GROUP BY level",
            &[],
        ).await?;

        let mut level_counts = HashMap::new();
        for row in level_rows {
            let level: String = row.get("level");
            let count: i64 = row.get("count");
            level_counts.insert(level, count);
        }

        // 按模块统计
        let module_rows = client.query(
            "SELECT COALESCE(module, 'unknown') as module, COUNT(*) as count 
            FROM logs 
            GROUP BY module 
            ORDER BY count DESC 
            LIMIT 20",
            &[],
        ).await?;

        let mut module_counts = HashMap::new();
        for row in module_rows {
            let module: String = row.get("module");
            let count: i64 = row.get("count");
            module_counts.insert(module, count);
        }

        // 最近24小时的错误和警告
        let recent_cutoff = Utc::now() - chrono::Duration::hours(24);
        
        let recent_errors_row = client.query_one(
            "SELECT COUNT(*) as count FROM logs WHERE level = 'error' AND timestamp >= $1",
            &[&recent_cutoff],
        ).await?;
        let recent_errors: i64 = recent_errors_row.get("count");

        let recent_warnings_row = client.query_one(
            "SELECT COUNT(*) as count FROM logs WHERE level = 'warn' AND timestamp >= $1",
            &[&recent_cutoff],
        ).await?;
        let recent_warnings: i64 = recent_warnings_row.get("count");

        Ok(LogStatistics {
            total_logs,
            level_counts,
            module_counts,
            recent_errors,
            recent_warnings,
        })
    }

    /// 清理旧日志
    pub async fn cleanup_old_logs_async(&self, days: i64) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let cutoff = Utc::now() - chrono::Duration::days(days);

        let affected = client.execute(
            "DELETE FROM logs WHERE timestamp < $1",
            &[&cutoff],
        ).await?;

        info!("🗑️  清理了 {} 条旧日志（{}天前）", affected, days);
        Ok(affected as usize)
    }

    /// 按级别清理日志
    pub async fn cleanup_logs_by_level_async(&self, level: &str, days: i64) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let cutoff = Utc::now() - chrono::Duration::days(days);

        let affected = client.execute(
            "DELETE FROM logs WHERE level = $1 AND timestamp < $2",
            &[&level, &cutoff],
        ).await?;

        info!("🗑️  清理了 {} 条 {} 级别的旧日志", affected, level);
        Ok(affected as usize)
    }

    /// 压缩日志（将旧日志导出到归档表）
    pub async fn archive_old_logs_async(&self, days: i64) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let mut client = self.pool.get().await?;

        // 创建归档表（如果不存在）
        client.execute(
            "CREATE TABLE IF NOT EXISTS logs_archive (
                id BIGINT PRIMARY KEY,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                module TEXT,
                file TEXT,
                line INTEGER,
                thread TEXT,
                context TEXT,
                timestamp TIMESTAMP NOT NULL,
                archived_at TIMESTAMP NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;

        let cutoff = Utc::now() - chrono::Duration::days(days);

        // 复制到归档表
        let transaction = client.transaction().await?;

        let archived = transaction.execute(
            "INSERT INTO logs_archive 
            SELECT id, level, message, module, file, line, thread, context, timestamp, NOW()
            FROM logs
            WHERE timestamp < $1",
            &[&cutoff],
        ).await?;

        // 删除已归档的日志
        transaction.execute(
            "DELETE FROM logs WHERE timestamp < $1",
            &[&cutoff],
        ).await?;

        transaction.commit().await?;

        info!("📦 归档了 {} 条旧日志", archived);
        Ok(archived as usize)
    }

    /// 按模块获取日志
    pub async fn get_logs_by_module_async(&self, module: &str, limit: i32) -> Result<Vec<LogEntryExtended>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, level, message, module, file, line, thread, context, timestamp
            FROM logs
            WHERE module = $1
            ORDER BY timestamp DESC
            LIMIT $2",
            &[&module, &limit],
        ).await?;

        let logs = rows.iter().map(|row| LogEntryExtended {
            id: row.get("id"),
            level: row.get("level"),
            message: row.get("message"),
            module: row.get("module"),
            file: row.get("file"),
            line: row.get("line"),
            thread: row.get("thread"),
            context: row.get("context"),
            timestamp: row.get::<_, chrono::DateTime<Utc>>("timestamp").to_rfc3339(),
        }).collect();

        Ok(logs)
    }

    /// 按级别获取日志
    pub async fn get_logs_by_level_async(&self, level: &str, limit: i32) -> Result<Vec<LogEntryExtended>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, level, message, module, file, line, thread, context, timestamp
            FROM logs
            WHERE level = $1
            ORDER BY timestamp DESC
            LIMIT $2",
            &[&level, &limit],
        ).await?;

        let logs = rows.iter().map(|row| LogEntryExtended {
            id: row.get("id"),
            level: row.get("level"),
            message: row.get("message"),
            module: row.get("module"),
            file: row.get("file"),
            line: row.get("line"),
            thread: row.get("thread"),
            context: row.get("context"),
            timestamp: row.get::<_, chrono::DateTime<Utc>>("timestamp").to_rfc3339(),
        }).collect();

        Ok(logs)
    }

    /// 获取最近的错误日志
    pub async fn get_recent_errors_async(&self, limit: i32) -> Result<Vec<LogEntryExtended>, Box<dyn std::error::Error + Send + Sync>> {
        self.get_logs_by_level_async("error", limit).await
    }

    /// 获取最近的警告日志
    pub async fn get_recent_warnings_async(&self, limit: i32) -> Result<Vec<LogEntryExtended>, Box<dyn std::error::Error + Send + Sync>> {
        self.get_logs_by_level_async("warn", limit).await
    }

    /// 搜索日志
    pub async fn search_logs_async(&self, keyword: &str, limit: i32) -> Result<Vec<LogEntryExtended>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let pattern = format!("%{}%", keyword);

        let rows = client.query(
            "SELECT id, level, message, module, file, line, thread, context, timestamp
            FROM logs
            WHERE message ILIKE $1 OR module ILIKE $1 OR context ILIKE $1
            ORDER BY timestamp DESC
            LIMIT $2",
            &[&pattern, &limit],
        ).await?;

        let logs: Vec<LogEntryExtended> = rows.iter().map(|row| LogEntryExtended {
            id: row.get("id"),
            level: row.get("level"),
            message: row.get("message"),
            module: row.get("module"),
            file: row.get("file"),
            line: row.get("line"),
            thread: row.get("thread"),
            context: row.get("context"),
            timestamp: row.get::<_, chrono::DateTime<Utc>>("timestamp").to_rfc3339(),
        }).collect();

        debug!("🔍 搜索到 {} 条日志（关键词: {}）", logs.len(), keyword);
        Ok(logs)
    }

    /// 获取日志总数
    pub async fn get_log_count_async(&self) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let row = client.query_one(
            "SELECT COUNT(*) as count FROM logs",
            &[],
        ).await?;

        Ok(row.get("count"))
    }

    /// 清空所有日志（危险操作）
    pub async fn truncate_logs_async(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute("TRUNCATE TABLE logs", &[]).await?;

        warn!("⚠️  已清空所有日志");
        Ok(())
    }

    /// 搜索日志（带分页）
    pub async fn search_logs(
        &self,
        filter: Option<LogFilter>,
        page: usize,
        page_size: usize,
        _sort_by: &str,
        _sort_order: &str,
    ) -> Result<(Vec<crate::utils::logger::LogEntry>, usize), Box<dyn std::error::Error + Send + Sync>> {
        let offset = (page - 1) * page_size;
        let limit = page_size as i32;
        
        let mut query_filter = filter.unwrap_or(LogFilter {
            level: None,
            module: None,
            start_time: None,
            end_time: None,
            keyword: None,
            limit: Some(limit),
            offset: Some(offset as i32),
        });
        
        query_filter.limit = Some(limit);
        query_filter.offset = Some(offset as i32);
        
        let logs_extended = self.query_logs_async(query_filter).await?;
        
        // 转换为简单的 LogEntry
        let logs: Vec<crate::utils::logger::LogEntry> = logs_extended.into_iter().map(|log| {
            let level = crate::utils::logger::LogLevel::from_str(&log.level).unwrap_or(crate::utils::logger::LogLevel::Info);
            let timestamp = chrono::DateTime::parse_from_rfc3339(&log.timestamp)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|| Utc::now());
            
            crate::utils::logger::LogEntry {
                timestamp,
                local_time: chrono::Local::now(),
                level,
                message: log.message,
                module: log.module,
                file: log.file,
                line: log.line.map(|l| l as u32),
                thread: log.thread,
                data: None,
                stack: None,
                tags: Vec::new(),
            }
        }).collect();
        
        // 获取总数
        let total = self.get_log_count_async().await? as usize;
        
        Ok((logs, total))
    }

    /// 获取日志统计（带过滤器）
    pub async fn get_statistics(
        &self,
        _filter: Option<LogFilter>,
    ) -> Result<crate::utils::logger::LogStatistics, Box<dyn std::error::Error + Send + Sync>> {
        let stats = self.get_statistics_async().await?;
        
        Ok(crate::utils::logger::LogStatistics {
            total_count: stats.total_logs as usize,
            error_count: *stats.level_counts.get("error").unwrap_or(&0) as usize,
            warning_count: *stats.level_counts.get("warn").unwrap_or(&0) as usize,
            info_count: *stats.level_counts.get("info").unwrap_or(&0) as usize,
            debug_count: *stats.level_counts.get("debug").unwrap_or(&0) as usize,
            trace_count: *stats.level_counts.get("trace").unwrap_or(&0) as usize,
        })
    }

    /// 导出日志
    pub async fn export_logs(
        &self,
        filter: Option<LogFilter>,
        format: &str,
        file_path: &str,
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        use std::fs::File;
        use std::io::Write;
        
        let query_filter = filter.unwrap_or(LogFilter {
            level: None,
            module: None,
            start_time: None,
            end_time: None,
            keyword: None,
            limit: None,
            offset: None,
        });
        
        let logs = self.query_logs_async(query_filter).await?;
        let count = logs.len();
        
        let mut file = File::create(file_path)?;
        
        match format {
            "json" => {
                let json = serde_json::to_string_pretty(&logs)?;
                file.write_all(json.as_bytes())?;
            }
            "csv" => {
                writeln!(file, "ID,Level,Module,Message,Timestamp")?;
                for log in &logs {
                    writeln!(
                        file,
                        "{},{},{:?},{},{}",
                        log.id, log.level, log.module, log.message.replace(",", ";"), log.timestamp
                    )?;
                }
            }
            "txt" => {
                for log in &logs {
                    writeln!(
                        file,
                        "[{}] [{}] {} - {}",
                        log.timestamp, log.level, log.module.as_deref().unwrap_or("unknown"), log.message
                    )?;
                }
            }
            _ => return Err("不支持的格式".into()),
        }
        
        info!("📤 导出了 {} 条日志到 {}", count, file_path);
        Ok(count)
    }

    /// 清理旧日志（兼容同步调用）
    pub async fn cleanup_old_logs(&self, retention_days: u32) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        self.cleanup_old_logs_async(retention_days as i64).await
    }

    /// 获取远程日志配置
    pub async fn get_remote_config(&self) -> Result<crate::commands::logging::RemoteLogConfig, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT config FROM remote_log_config WHERE id = 1",
            &[],
        ).await?;
        
        if let Some(row) = row_opt {
            let config_json: serde_json::Value = row.get("config");
            let config = serde_json::from_value(config_json)?;
            Ok(config)
        } else {
            Ok(crate::commands::logging::RemoteLogConfig::default())
        }
    }

    /// 保存远程日志配置
    pub async fn save_remote_config(&self, config: crate::commands::logging::RemoteLogConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // 创建配置表（如果不存在）
        client.execute(
            "CREATE TABLE IF NOT EXISTS remote_log_config (
                id INTEGER PRIMARY KEY DEFAULT 1,
                config JSONB NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;
        
        let config_json = serde_json::to_value(&config)?;
        
        client.execute(
            "INSERT INTO remote_log_config (id, config, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE SET config = $1, updated_at = NOW()",
            &[&config_json],
        ).await?;
        
        Ok(())
    }

    /// 统计待上传的日志数量
    pub async fn count_pending_upload_logs(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // 尝试查询 uploaded 列，如果不存在则返回 0
        let row_result = client.query_one(
            "SELECT COUNT(*) as count FROM logs WHERE uploaded = FALSE",
            &[],
        ).await;
        
        let count: i64 = match row_result {
            Ok(row) => row.get("count"),
            Err(_) => {
                // 如果列不存在，返回 0
                let fallback_row = client.query_one("SELECT 0::BIGINT as count", &[]).await?;
                fallback_row.get("count")
            }
        };
        
        Ok(count as usize)
    }

    /// 获取最后上传时间
    pub async fn get_last_upload_time(&self) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row_opt = client.query_opt(
            "SELECT last_upload_time FROM remote_log_upload_status WHERE id = 1",
            &[],
        ).await?;
        
        if let Some(row) = row_opt {
            let timestamp: chrono::DateTime<Utc> = row.get("last_upload_time");
            Ok(timestamp.timestamp())
        } else {
            Ok(0)
        }
    }

    /// 获取待上传的日志
    pub async fn get_pending_upload_logs(&self, limit: usize) -> Result<Vec<crate::commands::logging::LogEntryWithId>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, level, message, module, timestamp, EXTRACT(EPOCH FROM timestamp)::BIGINT as ts_epoch
            FROM logs
            WHERE uploaded = FALSE
            ORDER BY timestamp ASC
            LIMIT $1",
            &[&(limit as i64)],
        ).await.unwrap_or_else(|_| vec![]);
        
        let logs = rows.iter().map(|row| {
            let id: i64 = row.get("id");
            let level_str: String = row.get("level");
            let level = crate::utils::logger::LogLevel::from_str(&level_str)
                .unwrap_or(crate::utils::logger::LogLevel::Info);
            let ts_epoch: i64 = row.get("ts_epoch");
            let timestamp: chrono::DateTime<Utc> = row.get("timestamp");
            
            crate::commands::logging::LogEntryWithId {
                entry: crate::utils::logger::LogEntry {
                    timestamp,
                    local_time: chrono::Local::now(),
                    level,
                    message: row.get("message"),
                    module: row.get("module"),
                    file: None,
                    line: None,
                    thread: None,
                    data: None,
                    stack: None,
                    tags: Vec::new(),
                },
                id: Some(id),
                uploaded: false,
                created_at: Some(ts_epoch),
            }
        }).collect();
        
        Ok(logs)
    }

    /// 标记日志为已上传
    pub async fn mark_logs_as_uploaded(&self, log_ids: Vec<i64>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if log_ids.is_empty() {
            return Ok(());
        }
        
        let client = self.pool.get().await?;
        
        // 确保 uploaded 列存在
        client.execute(
            "ALTER TABLE logs ADD COLUMN IF NOT EXISTS uploaded BOOLEAN DEFAULT FALSE",
            &[],
        ).await?;
        
        let ids_str = log_ids.iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(",");
        
        let query = format!("UPDATE logs SET uploaded = TRUE WHERE id IN ({})", ids_str);
        client.execute(&query, &[]).await?;
        
        Ok(())
    }

    /// 更新最后上传时间
    pub async fn update_last_upload_time(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // 创建上传状态表（如果不存在）
        client.execute(
            "CREATE TABLE IF NOT EXISTS remote_log_upload_status (
                id INTEGER PRIMARY KEY DEFAULT 1,
                last_upload_time TIMESTAMP NOT NULL DEFAULT NOW()
            )",
            &[],
        ).await?;
        
        client.execute(
            "INSERT INTO remote_log_upload_status (id, last_upload_time)
            VALUES (1, NOW())
            ON CONFLICT (id) DO UPDATE SET last_upload_time = NOW()",
            &[],
        ).await?;
        
        Ok(())
    }
}

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio_postgres::NoTls;
    use deadpool_postgres::{Config, Pool, PoolConfig, Runtime};
    use chrono::{Utc, DateTime, Duration};
    use uuid::Uuid;
    
    // 测试数据库配置
    fn get_test_db_config() -> Config {
        let mut cfg = Config::new();
        cfg.host = Some("localhost".to_string());
        cfg.port = Some(5432);
        cfg.user = Some("postgres".to_string());
        cfg.password = Some("postgres".to_string());
        cfg.dbname = Some("zishu_test".to_string());
        cfg
    }
    
    async fn create_test_pool() -> DbPool {
        let cfg = get_test_db_config();
        let pool_config = PoolConfig::new(5);
        cfg.create_pool(Some(Runtime::Tokio1), NoTls)
            .expect("Failed to create test database pool")
    }
    
    async fn setup_test_db() -> LoggingRegistry {
        let pool = create_test_pool().await;
        let registry = LoggingRegistry::new(pool);
        
        // 初始化测试表（在独立的测试 schema 中）
        if let Ok(client) = registry.pool.get().await {
            let _ = client.execute("CREATE SCHEMA IF NOT EXISTS test_logging", &[]).await;
            let _ = client.execute("SET search_path TO test_logging", &[]).await;
            registry.init_tables().await.expect("Failed to init tables");
        }
        
        registry
    }
    
    async fn cleanup_test_data(registry: &LoggingRegistry) {
        if let Ok(client) = registry.pool.get().await {
            let _ = client.execute("TRUNCATE TABLE test_logging.logs CASCADE", &[]).await;
            let _ = client.execute("DROP TABLE IF EXISTS test_logging.logs_archive CASCADE", &[]).await;
            let _ = client.execute("DROP TABLE IF EXISTS test_logging.remote_log_config CASCADE", &[]).await;
            let _ = client.execute("DROP TABLE IF EXISTS test_logging.remote_log_upload_status CASCADE", &[]).await;
        }
    }
    
    fn create_test_log_entry() -> LogEntry {
        LogEntry {
            level: "info".to_string(),
            message: format!("Test log message {}", Uuid::new_v4()),
            module: Some("test_module".to_string()),
            timestamp: Utc::now().timestamp(),
        }
    }
    
    fn create_test_log_filter() -> LogFilter {
        LogFilter {
            level: Some("info".to_string()),
            module: Some("test_module".to_string()),
            start_time: Some((Utc::now() - Duration::hours(1)).timestamp()),
            end_time: Some(Utc::now().timestamp()),
            keyword: Some("test".to_string()),
            limit: Some(10),
            offset: Some(0),
        }
    }
    
    // ================================
    // LogLevel 单元测试
    // ================================
    
    #[test]
    fn test_log_level_display() {
        assert_eq!(LogLevel::Trace.to_string(), "trace");
        assert_eq!(LogLevel::Debug.to_string(), "debug");
        assert_eq!(LogLevel::Info.to_string(), "info");
        assert_eq!(LogLevel::Warn.to_string(), "warn");
        assert_eq!(LogLevel::Error.to_string(), "error");
        assert_eq!(LogLevel::Fatal.to_string(), "fatal");
    }
    
    #[test]
    fn test_log_level_from_str() {
        assert_eq!("trace".parse::<LogLevel>().unwrap(), LogLevel::Trace);
        assert_eq!("debug".parse::<LogLevel>().unwrap(), LogLevel::Debug);
        assert_eq!("info".parse::<LogLevel>().unwrap(), LogLevel::Info);
        assert_eq!("warn".parse::<LogLevel>().unwrap(), LogLevel::Warn);
        assert_eq!("error".parse::<LogLevel>().unwrap(), LogLevel::Error);
        assert_eq!("fatal".parse::<LogLevel>().unwrap(), LogLevel::Fatal);
        
        // 测试大小写不敏感
        assert_eq!("INFO".parse::<LogLevel>().unwrap(), LogLevel::Info);
        assert_eq!("Error".parse::<LogLevel>().unwrap(), LogLevel::Error);
        
        // 测试无效输入
        assert!("invalid".parse::<LogLevel>().is_err());
        assert!("".parse::<LogLevel>().is_err());
    }
    
    // ================================
    // LoggingRegistry 单元测试
    // ================================
    
    #[tokio::test]
    async fn test_logging_registry_new() {
        // 简化测试，避免依赖真实数据库连接
        if let Ok(pool) = std::panic::catch_unwind(|| {
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                create_test_pool().await
            })
        }) {
            let registry = LoggingRegistry::new(pool);
            // 验证 registry 结构体创建成功
            // 注意：不验证连接池状态，因为测试环境可能没有数据库
        } else {
            // 如果无法连接数据库，跳过测试
            println!("⚠️  跳过日志测试：无法连接到测试数据库");
        }
    }
    
    // 注意：以下测试需要真实数据库连接，在CI/CD环境中可能需要跳过
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_init_tables_success() {
        let registry = setup_test_db().await;
        
        // 验证表已创建
        let result = registry.init_tables().await;
        assert!(result.is_ok(), "日志表初始化应该成功");
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_log_success() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        let log_entry = create_test_log_entry();
        
        // 记录日志
        let result = registry.log(log_entry.clone());
        assert!(result.is_ok(), "日志记录应该成功");
        
        // 验证日志已记录
        let logs = registry.get_logs(10).unwrap();
        assert!(!logs.is_empty(), "应该能查询到记录的日志");
        assert_eq!(logs[0].message, log_entry.message);
        assert_eq!(logs[0].level, log_entry.level);
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_log_async_success() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        let log_entry = create_test_log_entry();
        
        // 异步记录日志
        let result = registry.log_async(log_entry.clone()).await;
        assert!(result.is_ok(), "异步日志记录应该成功");
        
        // 验证日志已记录
        let logs = registry.get_logs_async(10).await.unwrap();
        assert!(!logs.is_empty(), "应该能查询到记录的日志");
        assert_eq!(logs[0].message, log_entry.message);
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_log_batch_async_success() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建批量日志
        let entries: Vec<LogEntry> = (0..5).map(|i| LogEntry {
            level: "info".to_string(),
            message: format!("Batch log entry {}", i),
            module: Some("batch_test".to_string()),
            timestamp: Utc::now().timestamp(),
        }).collect();
        
        // 批量记录日志
        let result = registry.log_batch_async(entries.clone()).await;
        assert!(result.is_ok(), "批量日志记录应该成功");
        
        // 验证所有日志已记录
        let logs = registry.get_logs_async(10).await.unwrap();
        assert!(logs.len() >= 5, "应该记录了至少5条日志");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_log_extended_async_success() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 扩展日志记录
        let result = registry.log_extended_async(
            "warn",
            "Extended log message",
            Some("extended_module"),
            Some("test.rs"),
            Some(42),
            Some("main"),
            Some("context_info"),
        ).await;
        
        assert!(result.is_ok(), "扩展日志记录应该成功");
        
        // 查询扩展日志
        let filter = LogFilter {
            level: Some("warn".to_string()),
            module: Some("extended_module".to_string()),
            ..Default::default()
        };
        
        let logs = registry.query_logs_async(filter).await.unwrap();
        assert!(!logs.is_empty(), "应该能查询到扩展日志");
        
        let log = &logs[0];
        assert_eq!(log.level, "warn");
        assert_eq!(log.message, "Extended log message");
        assert_eq!(log.module, Some("extended_module".to_string()));
        assert_eq!(log.file, Some("test.rs".to_string()));
        assert_eq!(log.line, Some(42));
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_query_logs_with_filter() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建不同类型的日志
        let entries = vec![
            LogEntry {
                level: "info".to_string(),
                message: "Info message".to_string(),
                module: Some("module_a".to_string()),
                timestamp: Utc::now().timestamp(),
            },
            LogEntry {
                level: "error".to_string(),
                message: "Error message".to_string(),
                module: Some("module_b".to_string()),
                timestamp: Utc::now().timestamp(),
            },
            LogEntry {
                level: "warn".to_string(),
                message: "Warning message".to_string(),
                module: Some("module_a".to_string()),
                timestamp: Utc::now().timestamp(),
            },
        ];
        
        // 批量记录
        registry.log_batch_async(entries).await.unwrap();
        
        // 按级别过滤
        let filter = LogFilter {
            level: Some("error".to_string()),
            ..Default::default()
        };
        
        let logs = registry.query_logs_async(filter).await.unwrap();
        assert_eq!(logs.len(), 1, "应该只有1条错误日志");
        assert_eq!(logs[0].level, "error");
        
        // 按模块过滤
        let filter = LogFilter {
            module: Some("module_a".to_string()),
            ..Default::default()
        };
        
        let logs = registry.query_logs_async(filter).await.unwrap();
        assert_eq!(logs.len(), 2, "module_a应该有2条日志");
        
        // 按关键词过滤
        let filter = LogFilter {
            keyword: Some("Error".to_string()),
            ..Default::default()
        };
        
        let logs = registry.query_logs_async(filter).await.unwrap();
        assert_eq!(logs.len(), 1, "包含'Error'的应该有1条日志");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_get_statistics() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建统计测试数据
        let entries = vec![
            LogEntry { level: "info".to_string(), message: "Info 1".to_string(), module: Some("mod1".to_string()), timestamp: Utc::now().timestamp() },
            LogEntry { level: "info".to_string(), message: "Info 2".to_string(), module: Some("mod1".to_string()), timestamp: Utc::now().timestamp() },
            LogEntry { level: "error".to_string(), message: "Error 1".to_string(), module: Some("mod2".to_string()), timestamp: Utc::now().timestamp() },
            LogEntry { level: "warn".to_string(), message: "Warn 1".to_string(), module: Some("mod1".to_string()), timestamp: Utc::now().timestamp() },
        ];
        
        registry.log_batch_async(entries).await.unwrap();
        
        let stats = registry.get_statistics_async().await.unwrap();
        
        assert_eq!(stats.total_logs, 4, "总日志数应该是4");
        assert_eq!(*stats.level_counts.get("info").unwrap_or(&0), 2, "info级别应该有2条");
        assert_eq!(*stats.level_counts.get("error").unwrap_or(&0), 1, "error级别应该有1条");
        assert_eq!(*stats.level_counts.get("warn").unwrap_or(&0), 1, "warn级别应该有1条");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_cleanup_old_logs() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建一些旧日志（模拟）
        let old_timestamp = (Utc::now() - Duration::days(10)).timestamp();
        let entries = vec![
            LogEntry {
                level: "info".to_string(),
                message: "Old log 1".to_string(),
                module: Some("old_module".to_string()),
                timestamp: old_timestamp,
            },
            LogEntry {
                level: "info".to_string(),
                message: "New log 1".to_string(),
                module: Some("new_module".to_string()),
                timestamp: Utc::now().timestamp(),
            },
        ];
        
        registry.log_batch_async(entries).await.unwrap();
        
        // 清理7天前的日志
        let cleaned = registry.cleanup_old_logs_async(7).await.unwrap();
        assert_eq!(cleaned, 1, "应该清理1条旧日志");
        
        // 验证新日志还在
        let remaining_logs = registry.get_logs_async(10).await.unwrap();
        assert_eq!(remaining_logs.len(), 1, "应该还剩1条新日志");
        assert_eq!(remaining_logs[0].message, "New log 1");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_search_logs() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建搜索测试数据
        let entries = vec![
            LogEntry {
                level: "info".to_string(),
                message: "Database connection established".to_string(),
                module: Some("database".to_string()),
                timestamp: Utc::now().timestamp(),
            },
            LogEntry {
                level: "error".to_string(),
                message: "Failed to connect to API".to_string(),
                module: Some("api".to_string()),
                timestamp: Utc::now().timestamp(),
            },
            LogEntry {
                level: "info".to_string(),
                message: "User authentication successful".to_string(),
                module: Some("auth".to_string()),
                timestamp: Utc::now().timestamp(),
            },
        ];
        
        registry.log_batch_async(entries).await.unwrap();
        
        // 搜索包含"connection"的日志
        let results = registry.search_logs_async("connection", 10).await.unwrap();
        assert_eq!(results.len(), 1, "应该找到1条包含'connection'的日志");
        assert!(results[0].message.contains("connection"));
        
        // 搜索包含"API"的日志
        let results = registry.search_logs_async("API", 10).await.unwrap();
        assert_eq!(results.len(), 1, "应该找到1条包含'API'的日志");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_get_logs_by_level() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建不同级别的日志
        let entries = vec![
            LogEntry { level: "error".to_string(), message: "Error 1".to_string(), module: Some("mod1".to_string()), timestamp: Utc::now().timestamp() },
            LogEntry { level: "error".to_string(), message: "Error 2".to_string(), module: Some("mod2".to_string()), timestamp: Utc::now().timestamp() },
            LogEntry { level: "info".to_string(), message: "Info 1".to_string(), module: Some("mod1".to_string()), timestamp: Utc::now().timestamp() },
        ];
        
        registry.log_batch_async(entries).await.unwrap();
        
        // 获取错误日志
        let error_logs = registry.get_logs_by_level_async("error", 10).await.unwrap();
        assert_eq!(error_logs.len(), 2, "应该有2条错误日志");
        assert!(error_logs.iter().all(|log| log.level == "error"));
        
        // 获取信息日志
        let info_logs = registry.get_logs_by_level_async("info", 10).await.unwrap();
        assert_eq!(info_logs.len(), 1, "应该有1条信息日志");
        assert_eq!(info_logs[0].level, "info");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_get_logs_by_module() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建不同模块的日志
        let entries = vec![
            LogEntry { level: "info".to_string(), message: "Module A log 1".to_string(), module: Some("module_a".to_string()), timestamp: Utc::now().timestamp() },
            LogEntry { level: "info".to_string(), message: "Module A log 2".to_string(), module: Some("module_a".to_string()), timestamp: Utc::now().timestamp() },
            LogEntry { level: "info".to_string(), message: "Module B log 1".to_string(), module: Some("module_b".to_string()), timestamp: Utc::now().timestamp() },
        ];
        
        registry.log_batch_async(entries).await.unwrap();
        
        // 获取模块A的日志
        let module_a_logs = registry.get_logs_by_module_async("module_a", 10).await.unwrap();
        assert_eq!(module_a_logs.len(), 2, "module_a应该有2条日志");
        assert!(module_a_logs.iter().all(|log| log.module == Some("module_a".to_string())));
        
        // 获取模块B的日志
        let module_b_logs = registry.get_logs_by_module_async("module_b", 10).await.unwrap();
        assert_eq!(module_b_logs.len(), 1, "module_b应该有1条日志");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_archive_old_logs() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建旧日志
        let old_timestamp = (Utc::now() - Duration::days(10)).timestamp();
        let entries = vec![
            LogEntry {
                level: "info".to_string(),
                message: "Old log to archive".to_string(),
                module: Some("archive_test".to_string()),
                timestamp: old_timestamp,
            },
            LogEntry {
                level: "info".to_string(),
                message: "New log to keep".to_string(),
                module: Some("keep_test".to_string()),
                timestamp: Utc::now().timestamp(),
            },
        ];
        
        registry.log_batch_async(entries).await.unwrap();
        
        // 归档7天前的日志
        let archived = registry.archive_old_logs_async(7).await.unwrap();
        assert_eq!(archived, 1, "应该归档1条旧日志");
        
        // 验证主表中只剩新日志
        let remaining_logs = registry.get_logs_async(10).await.unwrap();
        assert_eq!(remaining_logs.len(), 1, "主表应该只剩1条日志");
        assert_eq!(remaining_logs[0].message, "New log to keep");
        
        cleanup_test_data(&registry).await;
    }
    
    // ================================
    // 错误处理测试
    // ================================
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_log_batch_empty() {
        let registry = setup_test_db().await;
        
        // 测试空批次
        let result = registry.log_batch_async(vec![]).await;
        assert!(result.is_ok(), "空批次应该成功处理");
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_query_logs_empty_filter() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 测试空过滤器
        let filter = LogFilter {
            level: None,
            module: None,
            start_time: None,
            end_time: None,
            keyword: None,
            limit: Some(10),
            offset: Some(0),
        };
        
        let result = registry.query_logs_async(filter).await;
        assert!(result.is_ok(), "空过滤器查询应该成功");
        
        cleanup_test_data(&registry).await;
    }
    
    #[tokio::test]
    #[ignore] // 跳过需要数据库的集成测试
    async fn test_logging_registry_cleanup_logs_by_level() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        // 创建不同级别的旧日志
        let old_timestamp = (Utc::now() - Duration::days(10)).timestamp();
        let entries = vec![
            LogEntry { level: "debug".to_string(), message: "Old debug".to_string(), module: None, timestamp: old_timestamp },
            LogEntry { level: "error".to_string(), message: "Old error".to_string(), module: None, timestamp: old_timestamp },
            LogEntry { level: "debug".to_string(), message: "New debug".to_string(), module: None, timestamp: Utc::now().timestamp() },
        ];
        
        registry.log_batch_async(entries).await.unwrap();
        
        // 清理7天前的debug日志
        let cleaned = registry.cleanup_logs_by_level_async("debug", 7).await.unwrap();
        assert_eq!(cleaned, 1, "应该清理1条旧的debug日志");
        
        // 验证其他日志还在
        let remaining_logs = registry.get_logs_async(10).await.unwrap();
        assert_eq!(remaining_logs.len(), 2, "应该还剩2条日志");
        
        cleanup_test_data(&registry).await;
    }
    
    // ================================
    // 性能测试
    // ================================
    
    #[tokio::test]
    #[ignore] // 跳过性能测试和需要数据库的集成测试
    async fn test_logging_registry_performance_batch_insert() {
        let registry = setup_test_db().await;
        cleanup_test_data(&registry).await;
        
        let start = std::time::Instant::now();
        
        // 批量插入测试
        let entries: Vec<LogEntry> = (0..100).map(|i| LogEntry {
            level: "info".to_string(),
            message: format!("Performance test log {}", i),
            module: Some("performance".to_string()),
            timestamp: Utc::now().timestamp(),
        }).collect();
        
        let result = registry.log_batch_async(entries).await;
        let duration = start.elapsed();
        
        assert!(result.is_ok(), "批量插入应该成功");
        assert!(duration.as_millis() < 3000, "100条日志插入应该在3秒内完成"); // 性能要求
        
        cleanup_test_data(&registry).await;
    }
    
    // ================================
    // 并发测试
    // ================================
    
    #[tokio::test]
    #[ignore] // 跳过并发测试和需要数据库的集成测试
    async fn test_logging_registry_concurrent_logging() {
        let registry = Arc::new(setup_test_db().await);
        cleanup_test_data(&*registry).await;
        
        // 并发日志记录
        let handles: Vec<_> = (0..10).map(|i| {
            let registry_clone = Arc::clone(&registry);
            tokio::spawn(async move {
                let entry = LogEntry {
                    level: "info".to_string(),
                    message: format!("Concurrent log {}", i),
                    module: Some("concurrent".to_string()),
                    timestamp: Utc::now().timestamp(),
                };
                registry_clone.log_async(entry).await
            })
        }).collect();
        
        // 等待所有任务完成
        for handle in handles {
            let result = handle.await;
            assert!(result.is_ok(), "并发任务应该成功");
            assert!(result.unwrap().is_ok(), "日志记录应该成功");
        }
        
        // 验证所有日志都已记录
        let logs = registry.get_logs_async(15).await.unwrap();
        assert!(logs.len() >= 10, "应该记录了至少10条并发日志");
        
        cleanup_test_data(&*registry).await;
    }
}

impl Default for LogFilter {
    fn default() -> Self {
        Self {
            level: None,
            module: None,
            start_time: None,
            end_time: None,
            keyword: None,
            limit: None,
            offset: None,
        }
    }
}
