// src-tauri/src/utils/security_audit.rs
//! 安全审计日志系统
//! 
//! 记录所有安全相关操作，用于审计和追踪

use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{info, warn};
use r2d2;
use r2d2_sqlite::SqliteConnectionManager;

/// 审计事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    /// 加密操作
    Encryption,
    /// 解密操作
    Decryption,
    /// 密钥生成
    KeyGeneration,
    /// 密钥加载
    KeyLoading,
    /// 密钥轮换
    KeyRotation,
    /// 密钥删除
    KeyDeletion,
    /// 敏感数据访问
    SensitiveDataAccess,
    /// 认证尝试
    AuthenticationAttempt,
    /// 授权检查
    AuthorizationCheck,
    /// 配置更改
    ConfigurationChange,
    /// 数据导出
    DataExport,
    /// 数据导入
    DataImport,
    /// 权限变更
    PermissionChange,
    /// 安全错误
    SecurityError,
}

/// 审计事件级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum AuditLevel {
    /// 调试信息
    Debug,
    /// 一般信息
    Info,
    /// 警告
    Warning,
    /// 错误
    Error,
    /// 严重错误
    Critical,
}

/// 审计事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// 事件 ID
    pub id: String,
    /// 事件类型
    pub event_type: AuditEventType,
    /// 事件级别
    pub level: AuditLevel,
    /// 事件描述
    pub description: String,
    /// 相关的资源 ID（如 key_id, user_id 等）
    pub resource_id: Option<String>,
    /// 操作执行者
    pub actor: Option<String>,
    /// 客户端 IP（如果适用）
    pub client_ip: Option<String>,
    /// 额外的元数据（JSON）
    pub metadata: Option<String>,
    /// 操作是否成功
    pub success: bool,
    /// 错误信息（如果失败）
    pub error_message: Option<String>,
    /// 时间戳
    pub timestamp: i64,
}

/// 审计日志管理器
pub struct SecurityAuditLogger {
    pool: r2d2::Pool<SqliteConnectionManager>,
}

impl SecurityAuditLogger {
    /// 创建或打开审计日志数据库
    pub fn new(db_path: &Path) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let manager = SqliteConnectionManager::file(db_path);
        let pool = r2d2::Pool::builder()
            .max_size(5)
            .build(manager)?;
        
        // 获取连接并创建表
        let conn = pool.get()?;
        
        // 创建审计事件表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS audit_events (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                level TEXT NOT NULL,
                description TEXT NOT NULL,
                resource_id TEXT,
                actor TEXT,
                client_ip TEXT,
                metadata TEXT,
                success INTEGER NOT NULL,
                error_message TEXT,
                timestamp INTEGER NOT NULL
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp 
             ON audit_events(timestamp DESC)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_events_type 
             ON audit_events(event_type)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_events_level 
             ON audit_events(level)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_events_resource 
             ON audit_events(resource_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_audit_events_actor 
             ON audit_events(actor)",
            [],
        )?;
        
        drop(conn); // 释放连接回池

        info!("安全审计日志系统初始化完成");
        Ok(Self { pool })
    }

    /// 记录审计事件
    pub fn log_event(&self, event: AuditEvent) -> Result<(), rusqlite::Error> {
        let event_type_str = serde_json::to_string(&event.event_type).unwrap();
        let level_str = serde_json::to_string(&event.level).unwrap();

        self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?.execute(
            "INSERT INTO audit_events 
             (id, event_type, level, description, resource_id, actor, client_ip, 
              metadata, success, error_message, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                event.id,
                event_type_str,
                level_str,
                event.description,
                event.resource_id,
                event.actor,
                event.client_ip,
                event.metadata,
                event.success as i32,
                event.error_message,
                event.timestamp,
            ],
        )?;

        // 根据级别记录到系统日志
        match event.level {
            AuditLevel::Critical | AuditLevel::Error => {
                warn!("审计事件: {:?} - {}", event.event_type, event.description);
            }
            _ => {
                info!("审计事件: {:?} - {}", event.event_type, event.description);
            }
        }

        Ok(())
    }

    /// 快速记录成功事件
    pub fn log_success(
        &self,
        event_type: AuditEventType,
        description: &str,
        resource_id: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let event = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type,
            level: AuditLevel::Info,
            description: description.to_string(),
            resource_id: resource_id.map(|s| s.to_string()),
            actor: None,
            client_ip: None,
            metadata: None,
            success: true,
            error_message: None,
            timestamp: chrono::Utc::now().timestamp(),
        };

        self.log_event(event)
    }

    /// 快速记录失败事件
    pub fn log_failure(
        &self,
        event_type: AuditEventType,
        description: &str,
        error_message: &str,
        resource_id: Option<&str>,
    ) -> Result<(), rusqlite::Error> {
        let event = AuditEvent {
            id: uuid::Uuid::new_v4().to_string(),
            event_type,
            level: AuditLevel::Error,
            description: description.to_string(),
            resource_id: resource_id.map(|s| s.to_string()),
            actor: None,
            client_ip: None,
            metadata: None,
            success: false,
            error_message: Some(error_message.to_string()),
            timestamp: chrono::Utc::now().timestamp(),
        };

        self.log_event(event)
    }

    /// 查询审计事件
    pub fn query_events(
        &self,
        filter: &AuditEventFilter,
    ) -> Result<Vec<AuditEvent>, rusqlite::Error> {
        let mut query = String::from(
            "SELECT id, event_type, level, description, resource_id, actor, 
                    client_ip, metadata, success, error_message, timestamp 
             FROM audit_events WHERE 1=1"
        );

        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref event_type) = filter.event_type {
            query.push_str(" AND event_type = ?");
            params.push(Box::new(serde_json::to_string(event_type).unwrap()));
        }

        if let Some(ref level) = filter.level {
            query.push_str(" AND level = ?");
            params.push(Box::new(serde_json::to_string(level).unwrap()));
        }

        if let Some(ref resource_id) = filter.resource_id {
            query.push_str(" AND resource_id = ?");
            params.push(Box::new(resource_id.clone()));
        }

        if let Some(ref actor) = filter.actor {
            query.push_str(" AND actor = ?");
            params.push(Box::new(actor.clone()));
        }

        if let Some(success) = filter.success {
            query.push_str(" AND success = ?");
            params.push(Box::new(success as i32));
        }

        if let Some(start_time) = filter.start_time {
            query.push_str(" AND timestamp >= ?");
            params.push(Box::new(start_time));
        }

        if let Some(end_time) = filter.end_time {
            query.push_str(" AND timestamp <= ?");
            params.push(Box::new(end_time));
        }

        query.push_str(" ORDER BY timestamp DESC");

        if let Some(limit) = filter.limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let mut stmt = conn.prepare(&query)?;
        let events = stmt
            .query_map(param_refs.as_slice(), |row| {
                let event_type_str: String = row.get(1)?;
                let level_str: String = row.get(2)?;

                Ok(AuditEvent {
                    id: row.get(0)?,
                    event_type: serde_json::from_str(&event_type_str).unwrap(),
                    level: serde_json::from_str(&level_str).unwrap(),
                    description: row.get(3)?,
                    resource_id: row.get(4)?,
                    actor: row.get(5)?,
                    client_ip: row.get(6)?,
                    metadata: row.get(7)?,
                    success: row.get::<_, i32>(8)? != 0,
                    error_message: row.get(9)?,
                    timestamp: row.get(10)?,
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(events)
    }

    /// 清理旧的审计日志
    pub fn cleanup_old_logs(&self, days: i64) -> Result<usize, rusqlite::Error> {
        let cutoff_timestamp = chrono::Utc::now().timestamp() - (days * 86400);
        
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let count = conn.execute(
            "DELETE FROM audit_events WHERE timestamp < ?1",
            [cutoff_timestamp],
        )?;

        info!("清理了 {} 条旧的审计日志（超过 {} 天）", count, days);
        Ok(count)
    }

    /// 获取统计信息
    pub fn get_statistics(&self) -> Result<AuditStatistics, rusqlite::Error> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let total_events: i64 = conn.query_row(
            "SELECT COUNT(*) FROM audit_events",
            [],
            |row| row.get(0),
        )?;

        let failed_events: i64 = conn.query_row(
            "SELECT COUNT(*) FROM audit_events WHERE success = 0",
            [],
            |row| row.get(0),
        )?;

        let critical_events: i64 = conn.query_row(
            "SELECT COUNT(*) FROM audit_events WHERE level = ?1",
            [serde_json::to_string(&AuditLevel::Critical).unwrap()],
            |row| row.get(0),
        )?;

        Ok(AuditStatistics {
            total_events: total_events as usize,
            failed_events: failed_events as usize,
            critical_events: critical_events as usize,
        })
    }
}

/// 审计事件筛选器
#[derive(Debug, Default, Clone)]
pub struct AuditEventFilter {
    pub event_type: Option<AuditEventType>,
    pub level: Option<AuditLevel>,
    pub resource_id: Option<String>,
    pub actor: Option<String>,
    pub success: Option<bool>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub limit: Option<usize>,
}

/// 审计统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditStatistics {
    pub total_events: usize,
    pub failed_events: usize,
    pub critical_events: usize,
}

/// 全局审计日志实例
lazy_static::lazy_static! {
    static ref GLOBAL_AUDIT_LOGGER: std::sync::RwLock<Option<SecurityAuditLogger>> = 
        std::sync::RwLock::new(None);
}

/// 初始化全局审计日志
pub fn init_global_audit_logger(db_path: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let logger = SecurityAuditLogger::new(db_path)?;
    *GLOBAL_AUDIT_LOGGER.write().unwrap() = Some(logger);
    Ok(())
}

/// 记录审计事件（使用全局实例）
pub fn log_audit_event(event: AuditEvent) {
    if let Some(logger) = GLOBAL_AUDIT_LOGGER.read().unwrap().as_ref() {
        if let Err(e) = logger.log_event(event) {
            warn!("记录审计事件失败: {}", e);
        }
    }
}

/// 快速记录成功事件（使用全局实例）
pub fn log_audit_success(
    event_type: AuditEventType,
    description: &str,
    resource_id: Option<&str>,
) {
    if let Some(logger) = GLOBAL_AUDIT_LOGGER.read().unwrap().as_ref() {
        if let Err(e) = logger.log_success(event_type, description, resource_id) {
            warn!("记录审计事件失败: {}", e);
        }
    }
}

/// 快速记录失败事件（使用全局实例）
pub fn log_audit_failure(
    event_type: AuditEventType,
    description: &str,
    error_message: &str,
    resource_id: Option<&str>,
) {
    if let Some(logger) = GLOBAL_AUDIT_LOGGER.read().unwrap().as_ref() {
        if let Err(e) = logger.log_failure(event_type, description, error_message, resource_id) {
            warn!("记录审计事件失败: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_audit_logging() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("audit.db");
        let logger = SecurityAuditLogger::new(&db_path).unwrap();

        logger.log_success(
            AuditEventType::KeyGeneration,
            "生成新的主密钥",
            Some("key-001"),
        ).unwrap();

        logger.log_failure(
            AuditEventType::Decryption,
            "解密失败",
            "密钥不匹配",
            Some("key-001"),
        ).unwrap();

        let filter = AuditEventFilter {
            resource_id: Some("key-001".to_string()),
            ..Default::default()
        };

        let events = logger.query_events(&filter).unwrap();
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_audit_statistics() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("audit.db");
        let logger = SecurityAuditLogger::new(&db_path).unwrap();

        logger.log_success(
            AuditEventType::KeyLoading,
            "加载密钥",
            None,
        ).unwrap();

        logger.log_failure(
            AuditEventType::AuthenticationAttempt,
            "认证失败",
            "密码错误",
            None,
        ).unwrap();

        let stats = logger.get_statistics().unwrap();
        assert_eq!(stats.total_events, 2);
        assert_eq!(stats.failed_events, 1);
    }
}

