//! 数据库错误类型
//!
//! 统一的数据库错误处理


use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rusqlite::{Connection, params};

// ================================
// 错误监控类型定义
// ================================

/// 错误类型枚举
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorType {
    Runtime,
    Syntax,
    Network,
    Memory,
    Database,
    FileSystem,
    Validation,
    Authentication,
    Authorization,
    UserInput,
    System,
    Unknown,
}

impl ErrorType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "runtime" => Self::Runtime,
            "syntax" => Self::Syntax,
            "network" => Self::Network,
            "memory" => Self::Memory,
            "database" => Self::Database,
            "filesystem" | "file_system" => Self::FileSystem,
            "validation" => Self::Validation,
            "authentication" => Self::Authentication,
            "authorization" => Self::Authorization,
            "userinput" | "user_input" => Self::UserInput,
            "system" => Self::System,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Runtime => "runtime",
            Self::Syntax => "syntax",
            Self::Network => "network",
            Self::Memory => "memory",
            Self::Database => "database",
            Self::FileSystem => "filesystem",
            Self::Validation => "validation",
            Self::Authentication => "authentication",
            Self::Authorization => "authorization",
            Self::UserInput => "user_input",
            Self::System => "system",
            Self::Unknown => "unknown",
        }
    }
}

/// 错误来源枚举
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorSource {
    Frontend,
    Backend,
    Database,
    Network,
    System,
    ThirdParty,
    Unknown,
}

impl ErrorSource {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "frontend" => Self::Frontend,
            "backend" => Self::Backend,
            "database" => Self::Database,
            "network" => Self::Network,
            "system" => Self::System,
            "thirdparty" | "third_party" => Self::ThirdParty,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Frontend => "frontend",
            Self::Backend => "backend",
            Self::Database => "database",
            Self::Network => "network",
            Self::System => "system",
            Self::ThirdParty => "third_party",
            Self::Unknown => "unknown",
        }
    }
}

/// 错误严重程度枚举
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl ErrorSeverity {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "critical" => Self::Critical,
            "high" => Self::High,
            "medium" => Self::Medium,
            "low" => Self::Low,
            "info" => Self::Info,
            _ => Self::Medium,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Critical => "critical",
            Self::High => "high",
            Self::Medium => "medium",
            Self::Low => "low",
            Self::Info => "info",
        }
    }
}

/// 错误状态枚举
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorStatus {
    New,
    Acknowledged,
    InProgress,
    Resolved,
    Ignored,
}

impl ErrorStatus {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "new" => Self::New,
            "acknowledged" => Self::Acknowledged,
            "inprogress" | "in_progress" => Self::InProgress,
            "resolved" => Self::Resolved,
            "ignored" => Self::Ignored,
            _ => Self::New,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Acknowledged => "acknowledged",
            Self::InProgress => "in_progress",
            Self::Resolved => "resolved",
            Self::Ignored => "ignored",
        }
    }
}

/// 错误上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// 错误记录
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
    pub context: String,
    pub occurrence_count: i64,
    pub first_occurred: i64,
    pub last_occurred: i64,
    pub resolved: bool,
    pub resolved_at: Option<i64>,
    pub resolution: Option<String>,
}

/// 错误统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorStatistics {
    pub total_errors: i64,
    pub new_errors: i64,
    pub resolved_errors: i64,
    pub by_severity: HashMap<String, i64>,
    pub by_type: HashMap<String, i64>,
    pub by_source: HashMap<String, i64>,
    pub hourly_trend: Vec<HourlyTrend>,
}

/// 小时趋势
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyTrend {
    pub hour: String,
    pub count: i64,
}

/// 错误数据库
pub struct ErrorDatabase {
    conn: Connection,
}

impl ErrorDatabase {
    /// 创建新的错误数据库
    pub fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// 初始化数据库架构
    fn init_schema(&self) -> Result<(), Box<dyn std::error::Error>> {
        // 创建错误记录表
        self.conn.execute(
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
                resolved INTEGER NOT NULL DEFAULT 0,
                resolved_at INTEGER,
                resolution TEXT
            )",
            [],
        )?;

        // 创建索引
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_error_id ON error_records(error_id)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_severity ON error_records(severity)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_status ON error_records(status)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_last_occurred ON error_records(last_occurred)",
            [],
        )?;

        // 创建错误上报表
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS error_reports (
                id TEXT PRIMARY KEY,
                error_ids TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                response_code INTEGER,
                response_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        Ok(())
    }

    /// 插入错误记录
    pub fn insert_error(&self, record: &ErrorRecord) -> Result<(), Box<dyn std::error::Error>> {
        // 检查是否已存在相同的error_id
        let existing: Option<String> = self.conn.query_row(
            "SELECT id FROM error_records WHERE error_id = ?1",
            params![record.error_id],
            |row| row.get(0),
        ).ok();

        if let Some(_) = existing {
            // 更新现有记录
            self.conn.execute(
                "UPDATE error_records SET 
                    occurrence_count = occurrence_count + 1,
                    last_occurred = ?1
                WHERE error_id = ?2",
                params![record.last_occurred, record.error_id],
            )?;
        } else {
            // 插入新记录
            self.conn.execute(
                "INSERT INTO error_records (
                    id, error_id, error_type, source, severity, status,
                    name, message, stack, cause, context, occurrence_count,
                    first_occurred, last_occurred, resolved, resolved_at, resolution
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                params![
                    record.id,
                    record.error_id,
                    record.error_type.as_str(),
                    record.source.as_str(),
                    record.severity.as_str(),
                    record.status.as_str(),
                    record.name,
                    record.message,
                    record.stack,
                    record.cause,
                    record.context,
                    record.occurrence_count,
                    record.first_occurred,
                    record.last_occurred,
                    record.resolved as i64,
                    record.resolved_at,
                    record.resolution,
                ],
            )?;
        }

        Ok(())
    }

    /// 获取错误记录
    pub fn get_error(&self, error_id: &str) -> Result<Option<ErrorRecord>, Box<dyn std::error::Error>> {
        let result = self.conn.query_row(
            "SELECT id, error_id, error_type, source, severity, status, name, message, 
                    stack, cause, context, occurrence_count, first_occurred, last_occurred,
                    resolved, resolved_at, resolution
             FROM error_records WHERE error_id = ?1",
            params![error_id],
            |row| {
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
                    resolved: row.get::<_, i64>(14)? != 0,
                    resolved_at: row.get(15)?,
                    resolution: row.get(16)?,
                })
            },
        );

        match result {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Box::new(e)),
        }
    }

    /// 列出错误记录
    pub fn list_errors(
        &self,
        limit: i64,
        offset: i64,
        severity_filter: Option<&str>,
        type_filter: Option<&str>,
        status_filter: Option<&str>,
    ) -> Result<Vec<ErrorRecord>, Box<dyn std::error::Error>> {
        let mut query = "SELECT id, error_id, error_type, source, severity, status, name, message,
                               stack, cause, context, occurrence_count, first_occurred, last_occurred,
                               resolved, resolved_at, resolution
                        FROM error_records WHERE 1=1".to_string();

        if let Some(severity) = severity_filter {
            query.push_str(&format!(" AND severity = '{}'", severity));
        }
        if let Some(error_type) = type_filter {
            query.push_str(&format!(" AND error_type = '{}'", error_type));
        }
        if let Some(status) = status_filter {
            query.push_str(&format!(" AND status = '{}'", status));
        }

        query.push_str(" ORDER BY last_occurred DESC LIMIT ?1 OFFSET ?2");

        let mut stmt = self.conn.prepare(&query)?;
        let rows = stmt.query_map(params![limit, offset], |row| {
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
                resolved: row.get::<_, i64>(14)? != 0,
                resolved_at: row.get(15)?,
                resolution: row.get(16)?,
            })
        })?;

        let mut records = Vec::new();
        for row in rows {
            records.push(row?);
        }

        Ok(records)
    }

    /// 更新错误状态
    pub fn update_error_status(
        &self,
        error_id: &str,
        status: ErrorStatus,
        resolution: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        let resolved = status == ErrorStatus::Resolved;
        let resolved_at = if resolved { Some(now) } else { None };

        self.conn.execute(
            "UPDATE error_records SET status = ?1, resolved = ?2, resolved_at = ?3, resolution = ?4
             WHERE error_id = ?5",
            params![status.as_str(), resolved as i64, resolved_at, resolution, error_id],
        )?;

        Ok(())
    }

    /// 获取统计信息
    pub fn get_statistics(&self) -> Result<ErrorStatistics, Box<dyn std::error::Error>> {
        // 总错误数
        let total_errors: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM error_records",
            [],
            |row| row.get(0),
        )?;

        // 新错误数（24小时内）
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let day_ago = now - 86400;
        let new_errors: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM error_records WHERE first_occurred > ?1",
            params![day_ago],
            |row| row.get(0),
        )?;

        // 已解决错误数
        let resolved_errors: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM error_records WHERE resolved = 1",
            [],
            |row| row.get(0),
        )?;

        // 按严重程度统计
        let mut by_severity = HashMap::new();
        let mut stmt = self.conn.prepare("SELECT severity, COUNT(*) FROM error_records GROUP BY severity")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?;
        for row in rows {
            let (severity, count) = row?;
            by_severity.insert(severity, count);
        }

        // 按类型统计
        let mut by_type = HashMap::new();
        let mut stmt = self.conn.prepare("SELECT error_type, COUNT(*) FROM error_records GROUP BY error_type")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?;
        for row in rows {
            let (error_type, count) = row?;
            by_type.insert(error_type, count);
        }

        // 按来源统计
        let mut by_source = HashMap::new();
        let mut stmt = self.conn.prepare("SELECT source, COUNT(*) FROM error_records GROUP BY source")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?;
        for row in rows {
            let (source, count) = row?;
            by_source.insert(source, count);
        }

        // 按小时趋势
        let mut hourly_trend = Vec::new();
        let mut stmt = self.conn.prepare(
            "SELECT strftime('%Y-%m-%d %H:00', datetime(last_occurred, 'unixepoch')) as hour, COUNT(*) as count
             FROM error_records
             WHERE last_occurred > ?1
             GROUP BY hour
             ORDER BY hour DESC
             LIMIT 24"
        )?;
        let rows = stmt.query_map(params![day_ago], |row| {
            Ok(HourlyTrend {
                hour: row.get(0)?,
                count: row.get(1)?,
            })
        })?;
        for row in rows {
            hourly_trend.push(row?);
        }
        hourly_trend.reverse(); // 按时间正序排列

        Ok(ErrorStatistics {
            total_errors,
            new_errors,
            resolved_errors,
            by_severity,
            by_type,
            by_source,
            hourly_trend,
        })
    }

    /// 清理旧错误
    pub fn cleanup_old_errors(&self, retention_days: i64) -> Result<i64, Box<dyn std::error::Error>> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let cutoff = now - (retention_days * 86400);

        let count = self.conn.execute(
            "DELETE FROM error_records WHERE last_occurred < ?1",
            params![cutoff],
        )?;

        Ok(count as i64)
    }

    /// 记录错误上报
    pub fn record_error_report(
        &self,
        report_id: &str,
        error_ids: &[String],
        endpoint: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        let error_ids_json = serde_json::to_string(error_ids)?;

        self.conn.execute(
            "INSERT INTO error_reports (id, error_ids, endpoint, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'pending', ?4, ?5)",
            params![report_id, error_ids_json, endpoint, now, now],
        )?;

        Ok(())
    }

    /// 更新上报状态
    pub fn update_report_status(
        &self,
        report_id: &str,
        status: &str,
        response_code: Option<i32>,
        response_message: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        self.conn.execute(
            "UPDATE error_reports SET status = ?1, response_code = ?2, response_message = ?3, updated_at = ?4
             WHERE id = ?5",
            params![status, response_code, response_message, now, report_id],
        )?;

        Ok(())
    }

    /// 获取待上报的错误
    pub fn get_pending_reports(&self, limit: i64) -> Result<Vec<(String, Vec<String>)>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, error_ids FROM error_reports WHERE status = 'pending' LIMIT ?1"
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            let report_id: String = row.get(0)?;
            let error_ids_json: String = row.get(1)?;
            Ok((report_id, error_ids_json))
        })?;

        let mut reports = Vec::new();
        for row in rows {
            let (report_id, error_ids_json) = row?;
            let error_ids: Vec<String> = serde_json::from_str(&error_ids_json)?;
            reports.push((report_id, error_ids));
        }

        Ok(reports)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error;

    #[test]
    fn test_database_error_reexport_available() {
        // 验证 DatabaseError 重新导出是否可用
        let error = DatabaseError::ConnectionError("测试连接错误".to_string());
        assert!(matches!(error, DatabaseError::ConnectionError(_)));
    }

    #[test]
    fn test_database_result_reexport_available() {
        // 验证 DatabaseResult 重新导出是否可用
        let success_result: DatabaseResult<i32> = Ok(42);
        let error_result: DatabaseResult<i32> = Err(DatabaseError::NotFound("未找到".to_string()));
        
        assert!(success_result.is_ok());
        assert_eq!(success_result.unwrap(), 42);
        assert!(error_result.is_err());
    }

    #[test]
    fn test_error_type_functionality() {
        // 测试错误类型的基本功能
        let error = DatabaseError::QueryError("SQL语法错误".to_string());
        
        // 测试 Display trait
        let error_string = error.to_string();
        assert!(error_string.contains("查询错误"));
        assert!(error_string.contains("SQL语法错误"));
        
        // 测试 Error trait
        assert!(error.source().is_none());
    }

    #[test]
    fn test_error_debug_format() {
        // 测试错误的调试格式输出
        let error = DatabaseError::InvalidData("无效的JSON格式".to_string());
        let debug_output = format!("{:?}", error);
        
        assert!(debug_output.contains("InvalidData"));
        assert!(debug_output.contains("无效的JSON格式"));
    }

    #[test]
    fn test_all_error_variants_reexported() {
        // 确保所有错误变体都能通过重新导出访问
        let errors = vec![
            DatabaseError::ConnectionError("连接失败".to_string()),
            DatabaseError::QueryError("查询失败".to_string()),
            DatabaseError::NotFound("数据未找到".to_string()),
            DatabaseError::Duplicate("数据重复".to_string()),
            DatabaseError::InvalidData("数据无效".to_string()),
            DatabaseError::SerializationError("序列化失败".to_string()),
            DatabaseError::Other("其他错误".to_string()),
        ];

        // 验证每个错误变体都能正确创建和匹配
        for error in errors {
            match &error {
                DatabaseError::ConnectionError(_) => assert!(true),
                DatabaseError::QueryError(_) => assert!(true),
                DatabaseError::NotFound(_) => assert!(true),
                DatabaseError::Duplicate(_) => assert!(true),
                DatabaseError::InvalidData(_) => assert!(true),
                DatabaseError::SerializationError(_) => assert!(true),
                DatabaseError::Other(_) => assert!(true),
            }
        }
    }

    #[test]
    fn test_result_chaining() {
        // 测试 Result 链式操作
        fn create_success() -> DatabaseResult<i32> {
            Ok(100)
        }

        fn create_error() -> DatabaseResult<i32> {
            Err(DatabaseError::ConnectionError("连接超时".to_string()))
        }

        // 测试成功链式操作
        let result = create_success()
            .map(|x| x * 2)
            .and_then(|x| Ok(x + 10));
        
        assert_eq!(result.unwrap(), 210);

        // 测试错误链式操作
        let error_result = create_error()
            .map(|x| x * 2)
            .map_err(|e| DatabaseError::Other(format!("包装错误: {}", e)));
        
        assert!(error_result.is_err());
        let error_msg = error_result.unwrap_err().to_string();
        assert!(error_msg.contains("包装错误"));
        assert!(error_msg.contains("连接超时"));
    }

    #[test]
    fn test_error_conversion_compatibility() {
        // 测试错误转换兼容性
        let json_error = serde_json::from_str::<serde_json::Value>("{invalid json");
        assert!(json_error.is_err());
        
        // 测试从 serde_json::Error 到 DatabaseError 的转换
        let database_error: DatabaseError = json_error.unwrap_err().into();
        match database_error {
            DatabaseError::SerializationError(msg) => {
                assert!(!msg.is_empty());
            },
            _ => panic!("期望 SerializationError 变体"),
        }
    }
}
