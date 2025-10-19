/**
 * 错误监控数据库模型和存储
 * 提供错误信息的持久化存储、查询和统计功能
 */

use rusqlite::{params, Connection, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ================================
// 错误枚举类型
// ================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl ErrorSeverity {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "low" => Self::Low,
            "medium" => Self::Medium,
            "high" => Self::High,
            "critical" => Self::Critical,
            _ => Self::Medium,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Critical => "critical",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorType {
    Javascript,
    React,
    Rust,
    System,
    Network,
    Api,
    Timeout,
    Validation,
    Permission,
    NotFound,
    Memory,
    File,
    Database,
    UserInput,
    Configuration,
    Unknown,
}

impl ErrorType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "javascript" => Self::Javascript,
            "react" => Self::React,
            "rust" => Self::Rust,
            "system" => Self::System,
            "network" => Self::Network,
            "api" => Self::Api,
            "timeout" => Self::Timeout,
            "validation" => Self::Validation,
            "permission" => Self::Permission,
            "not_found" => Self::NotFound,
            "memory" => Self::Memory,
            "file" => Self::File,
            "database" => Self::Database,
            "user_input" => Self::UserInput,
            "configuration" => Self::Configuration,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Javascript => "javascript",
            Self::React => "react",
            Self::Rust => "rust",
            Self::System => "system",
            Self::Network => "network",
            Self::Api => "api",
            Self::Timeout => "timeout",
            Self::Validation => "validation",
            Self::Permission => "permission",
            Self::NotFound => "not_found",
            Self::Memory => "memory",
            Self::File => "file",
            Self::Database => "database",
            Self::UserInput => "user_input",
            Self::Configuration => "configuration",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorSource {
    Frontend,
    Backend,
    System,
    External,
}

impl ErrorSource {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "frontend" => Self::Frontend,
            "backend" => Self::Backend,
            "system" => Self::System,
            "external" => Self::External,
            _ => Self::System,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Frontend => "frontend",
            Self::Backend => "backend",
            Self::System => "system",
            Self::External => "external",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorStatus {
    New,
    Reported,
    Acknowledged,
    Recovering,
    Resolved,
    Ignored,
}

impl ErrorStatus {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "new" => Self::New,
            "reported" => Self::Reported,
            "acknowledged" => Self::Acknowledged,
            "recovering" => Self::Recovering,
            "resolved" => Self::Resolved,
            "ignored" => Self::Ignored,
            _ => Self::New,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Reported => "reported",
            Self::Acknowledged => "acknowledged",
            Self::Recovering => "recovering",
            Self::Resolved => "resolved",
            Self::Ignored => "ignored",
        }
    }
}

// ================================
// 数据结构
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorRecord {
    pub id: String,
    pub error_id: String,
    pub error_type: ErrorType,
    pub source: ErrorSource,
    pub severity: ErrorSeverity,
    pub status: ErrorStatus,
    pub name: String,
    pub message: String,
    pub stack: Option<String>,
    pub cause: Option<String>,
    pub context: String, // JSON字符串
    pub occurrence_count: i64,
    pub first_occurred: i64, // Unix timestamp
    pub last_occurred: i64,  // Unix timestamp
    pub resolved: bool,
    pub resolved_at: Option<i64>,
    pub resolution: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorContext {
    pub timestamp: String,
    pub session_id: String,
    pub user_id: Option<String>,
    pub user_agent: Option<String>,
    pub platform: String,
    pub app_version: String,
    pub build_version: String,
    pub url: Option<String>,
    pub route: Option<String>,
    pub component: Option<String>,
    pub function: Option<String>,
    pub line: Option<u32>,
    pub column: Option<u32>,
    pub operation: Option<String>,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub state: Option<HashMap<String, serde_json::Value>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorStatistics {
    pub total_errors: i64,
    pub new_errors: i64,
    pub resolved_errors: i64,
    pub by_severity: HashMap<String, i64>,
    pub by_type: HashMap<String, i64>,
    pub by_source: HashMap<String, i64>,
    pub hourly_trend: Vec<HourlyErrorCount>,
    pub top_errors: Vec<TopErrorInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HourlyErrorCount {
    pub hour: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopErrorInfo {
    pub error_id: String,
    pub message: String,
    pub count: i64,
    pub severity: String,
}

// ================================
// 数据库管理器
// ================================

pub struct ErrorDatabase {
    connection: Arc<Mutex<Connection>>,
}

impl ErrorDatabase {
    /// 创建新的错误数据库实例
    pub fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;
        let db = Self {
            connection: Arc::new(Mutex::new(conn)),
        };
        
        db.initialize_tables()?;
        Ok(db)
    }

    /// 初始化数据库表
    fn initialize_tables(&self) -> SqliteResult<()> {
        let conn = self.connection.lock().unwrap();

        // 创建错误记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS error_records (
                id TEXT PRIMARY KEY,
                error_id TEXT NOT NULL,
                error_type TEXT NOT NULL,
                source TEXT NOT NULL,
                severity TEXT NOT NULL,
                status TEXT NOT NULL,
                name TEXT NOT NULL,
                message TEXT NOT NULL,
                stack TEXT,
                cause TEXT,
                context TEXT NOT NULL,
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                first_occurred INTEGER NOT NULL,
                last_occurred INTEGER NOT NULL,
                resolved BOOLEAN NOT NULL DEFAULT 0,
                resolved_at INTEGER,
                resolution TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        // 创建索引以提高查询性能
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_records_error_id ON error_records(error_id)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_records_type ON error_records(error_type)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_records_severity ON error_records(severity)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_records_status ON error_records(status)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_records_first_occurred ON error_records(first_occurred)",
            [],
        )?;

        // 创建错误会话表（记录错误发生的会话信息）
        conn.execute(
            "CREATE TABLE IF NOT EXISTS error_sessions (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                error_count INTEGER NOT NULL DEFAULT 0,
                platform TEXT NOT NULL,
                app_version TEXT NOT NULL,
                user_agent TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_sessions_session_id ON error_sessions(session_id)",
            [],
        )?;

        // 创建错误上报记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS error_reports (
                id TEXT PRIMARY KEY,
                report_id TEXT NOT NULL UNIQUE,
                error_ids TEXT NOT NULL, -- JSON数组
                endpoint TEXT NOT NULL,
                status TEXT NOT NULL, -- pending, sent, failed
                attempts INTEGER NOT NULL DEFAULT 0,
                last_attempt INTEGER,
                response_code INTEGER,
                response_message TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_reports_status ON error_reports(status)",
            [],
        )?;

        Ok(())
    }

    /// 插入新的错误记录
    pub fn insert_error(&self, error: &ErrorRecord) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        // 检查是否已存在相同的错误
        let existing_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM error_records WHERE error_id = ?",
            params![error.error_id],
            |row| row.get(0),
        )?;

        if existing_count > 0 {
            // 更新现有错误记录
            conn.execute(
                "UPDATE error_records 
                 SET occurrence_count = occurrence_count + 1,
                     last_occurred = ?,
                     status = ?,
                     updated_at = strftime('%s', 'now')
                 WHERE error_id = ?",
                params![error.last_occurred, error.status.as_str(), error.error_id],
            )?;
        } else {
            // 插入新错误记录
            conn.execute(
                "INSERT INTO error_records (
                    id, error_id, error_type, source, severity, status,
                    name, message, stack, cause, context,
                    occurrence_count, first_occurred, last_occurred,
                    resolved, resolved_at, resolution
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    error.id,
                    error.error_id,
                    error.error_type.as_str(),
                    error.source.as_str(),
                    error.severity.as_str(),
                    error.status.as_str(),
                    error.name,
                    error.message,
                    error.stack,
                    error.cause,
                    error.context,
                    error.occurrence_count,
                    error.first_occurred,
                    error.last_occurred,
                    error.resolved,
                    error.resolved_at,
                    error.resolution,
                ],
            )?;
        }

        Ok(())
    }

    /// 根据ID获取错误记录
    pub fn get_error(&self, id: &str) -> Result<Option<ErrorRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, error_id, error_type, source, severity, status,
                    name, message, stack, cause, context,
                    occurrence_count, first_occurred, last_occurred,
                    resolved, resolved_at, resolution
             FROM error_records WHERE id = ?"
        )?;

        let error_iter = stmt.query_map(params![id], |row| {
            Ok(self.row_to_error_record(row)?)
        })?;

        for error in error_iter {
            return Ok(Some(error?));
        }

        Ok(None)
    }

    /// 获取错误列表（支持分页和筛选）
    pub fn list_errors(
        &self,
        limit: i64,
        offset: i64,
        severity_filter: Option<&str>,
        type_filter: Option<&str>,
        status_filter: Option<&str>,
    ) -> Result<Vec<ErrorRecord>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let mut sql = "SELECT id, error_id, error_type, source, severity, status,
                              name, message, stack, cause, context,
                              occurrence_count, first_occurred, last_occurred,
                              resolved, resolved_at, resolution
                       FROM error_records WHERE 1=1".to_string();

        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(severity) = severity_filter {
            sql.push_str(" AND severity = ?");
            params.push(Box::new(severity.to_string()));
        }

        if let Some(error_type) = type_filter {
            sql.push_str(" AND error_type = ?");
            params.push(Box::new(error_type.to_string()));
        }

        if let Some(status) = status_filter {
            sql.push_str(" AND status = ?");
            params.push(Box::new(status.to_string()));
        }

        sql.push_str(" ORDER BY last_occurred DESC LIMIT ? OFFSET ?");
        params.push(Box::new(limit));
        params.push(Box::new(offset));

        let mut stmt = conn.prepare(&sql)?;
        let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let error_iter = stmt.query_map(params_ref.as_slice(), |row| {
            Ok(self.row_to_error_record(row)?)
        })?;

        let mut errors = Vec::new();
        for error in error_iter {
            errors.push(error?);
        }

        Ok(errors)
    }

    /// 更新错误状态
    pub fn update_error_status(
        &self,
        error_id: &str,
        status: ErrorStatus,
        resolution: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let resolved = matches!(status, ErrorStatus::Resolved);
        let resolved_at = if resolved {
            Some(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64)
        } else {
            None
        };

        conn.execute(
            "UPDATE error_records 
             SET status = ?, resolved = ?, resolved_at = ?, resolution = ?,
                 updated_at = strftime('%s', 'now')
             WHERE error_id = ?",
            params![
                status.as_str(),
                resolved,
                resolved_at,
                resolution,
                error_id
            ],
        )?;

        Ok(())
    }

    /// 删除过期的错误记录
    pub fn cleanup_old_errors(&self, retention_days: i64) -> Result<i64, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let cutoff_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs() as i64 - (retention_days * 24 * 60 * 60);

        let deleted_count = conn.execute(
            "DELETE FROM error_records WHERE first_occurred < ?",
            params![cutoff_time],
        )?;

        Ok(deleted_count as i64)
    }

    /// 获取错误统计信息
    pub fn get_statistics(&self) -> Result<ErrorStatistics, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        // 总错误数
        let total_errors: i64 = conn.query_row(
            "SELECT COUNT(*) FROM error_records",
            [],
            |row| row.get(0),
        )?;

        // 新错误数（状态为 new）
        let new_errors: i64 = conn.query_row(
            "SELECT COUNT(*) FROM error_records WHERE status = 'new'",
            [],
            |row| row.get(0),
        )?;

        // 已解决错误数
        let resolved_errors: i64 = conn.query_row(
            "SELECT COUNT(*) FROM error_records WHERE resolved = 1",
            [],
            |row| row.get(0),
        )?;

        // 按严重程度统计
        let mut by_severity = HashMap::new();
        let mut stmt = conn.prepare(
            "SELECT severity, COUNT(*) FROM error_records GROUP BY severity"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (severity, count) = row?;
            by_severity.insert(severity, count);
        }

        // 按类型统计
        let mut by_type = HashMap::new();
        let mut stmt = conn.prepare(
            "SELECT error_type, COUNT(*) FROM error_records GROUP BY error_type"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (error_type, count) = row?;
            by_type.insert(error_type, count);
        }

        // 按来源统计
        let mut by_source = HashMap::new();
        let mut stmt = conn.prepare(
            "SELECT source, COUNT(*) FROM error_records GROUP BY source"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (source, count) = row?;
            by_source.insert(source, count);
        }

        // 最近24小时趋势
        let mut hourly_trend = Vec::new();
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;
        for i in (0..24).rev() {
            let hour_start = now - (i * 3600);
            let hour_end = hour_start + 3600;
            let hour = chrono::DateTime::from_timestamp(hour_start, 0)
                .unwrap_or_default()
                .format("%H:00")
                .to_string();

            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM error_records 
                 WHERE first_occurred >= ? AND first_occurred < ?",
                params![hour_start, hour_end],
                |row| row.get(0),
            )?;

            hourly_trend.push(HourlyErrorCount { hour, count });
        }

        // 最常见错误（前10个）
        let mut top_errors = Vec::new();
        let mut stmt = conn.prepare(
            "SELECT error_id, message, occurrence_count, severity 
             FROM error_records 
             ORDER BY occurrence_count DESC 
             LIMIT 10"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(TopErrorInfo {
                error_id: row.get(0)?,
                message: row.get(1)?,
                count: row.get(2)?,
                severity: row.get(3)?,
            })
        })?;
        for row in rows {
            top_errors.push(row?);
        }

        Ok(ErrorStatistics {
            total_errors,
            new_errors,
            resolved_errors,
            by_severity,
            by_type,
            by_source,
            hourly_trend,
            top_errors,
        })
    }

    /// 记录错误上报
    pub fn record_error_report(
        &self,
        report_id: &str,
        error_ids: &[String],
        endpoint: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let error_ids_json = serde_json::to_string(error_ids)?;

        conn.execute(
            "INSERT INTO error_reports (
                id, report_id, error_ids, endpoint, status, attempts
            ) VALUES (?, ?, ?, ?, 'pending', 0)",
            params![
                uuid::Uuid::new_v4().to_string(),
                report_id,
                error_ids_json,
                endpoint,
            ],
        )?;

        Ok(())
    }

    /// 更新错误上报状态
    pub fn update_report_status(
        &self,
        report_id: &str,
        status: &str,
        response_code: Option<i32>,
        response_message: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        conn.execute(
            "UPDATE error_reports 
             SET status = ?, attempts = attempts + 1, 
                 last_attempt = strftime('%s', 'now'),
                 response_code = ?, response_message = ?,
                 updated_at = strftime('%s', 'now')
             WHERE report_id = ?",
            params![
                status,
                response_code,
                response_message,
                report_id
            ],
        )?;

        Ok(())
    }

    /// 获取待上报的错误
    pub fn get_pending_reports(&self, limit: i64) -> Result<Vec<(String, Vec<String>)>, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT report_id, error_ids FROM error_reports 
             WHERE status = 'pending' AND attempts < 3
             ORDER BY created_at ASC LIMIT ?"
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            let report_id: String = row.get(0)?;
            let error_ids_json: String = row.get(1)?;
            let error_ids: Vec<String> = serde_json::from_str(&error_ids_json)
                .map_err(|e| rusqlite::Error::InvalidColumnType(0, e.to_string(), rusqlite::types::Type::Text))?;
            Ok((report_id, error_ids))
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }

        Ok(results)
    }

    /// 将数据库行转换为ErrorRecord
    fn row_to_error_record(&self, row: &Row) -> SqliteResult<ErrorRecord> {
        Ok(ErrorRecord {
            id: row.get(0)?,
            error_id: row.get(1)?,
            error_type: ErrorType::from_str(&row.get::<_, String>(2)?),
            source: ErrorSource::from_str(&row.get::<_, String>(3)?),
            severity: ErrorSeverity::from_str(&row.get::<_, String>(4)?),
            status: ErrorStatus::from_str(&row.get::<_, String>(5)?),
            name: row.get(6)?,
            message: row.get(7)?,
            stack: row.get(8)?,
            cause: row.get(9)?,
            context: row.get(10)?,
            occurrence_count: row.get(11)?,
            first_occurred: row.get(12)?,
            last_occurred: row.get(13)?,
            resolved: row.get(14)?,
            resolved_at: row.get(15)?,
            resolution: row.get(16)?,
        })
    }
}

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn test_error_database_creation() {
        let db = ErrorDatabase::new(":memory:").expect("Failed to create database");
        
        // 测试插入错误记录
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        let context = ErrorContext {
            timestamp: chrono::Utc::now().to_rfc3339(),
            session_id: "test_session".to_string(),
            user_id: None,
            user_agent: Some("test_agent".to_string()),
            platform: "test".to_string(),
            app_version: "1.0.0".to_string(),
            build_version: "100".to_string(),
            url: None,
            route: None,
            component: None,
            function: None,
            line: None,
            column: None,
            operation: None,
            parameters: None,
            state: None,
            metadata: None,
        };

        let error = ErrorRecord {
            id: "test_id".to_string(),
            error_id: "test_error_id".to_string(),
            error_type: ErrorType::Javascript,
            source: ErrorSource::Frontend,
            severity: ErrorSeverity::Medium,
            status: ErrorStatus::New,
            name: "Test Error".to_string(),
            message: "This is a test error".to_string(),
            stack: Some("test stack".to_string()),
            cause: None,
            context: serde_json::to_string(&context).unwrap(),
            occurrence_count: 1,
            first_occurred: now,
            last_occurred: now,
            resolved: false,
            resolved_at: None,
            resolution: None,
        };

        db.insert_error(&error).expect("Failed to insert error");

        // 测试获取错误记录
        let retrieved = db.get_error("test_id").expect("Failed to get error");
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.error_id, "test_error_id");
        assert_eq!(retrieved.name, "Test Error");
    }

    #[test]
    fn test_error_statistics() {
        let db = ErrorDatabase::new(":memory:").expect("Failed to create database");
        
        let stats = db.get_statistics().expect("Failed to get statistics");
        assert_eq!(stats.total_errors, 0);
        assert_eq!(stats.new_errors, 0);
        assert_eq!(stats.resolved_errors, 0);
    }
}
