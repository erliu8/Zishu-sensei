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

        let client = self.pool.get().await?;

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

        debug!("📝 批量记录了 {} 条日志", entries.len());
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
        let client = self.pool.get().await?;

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
}
