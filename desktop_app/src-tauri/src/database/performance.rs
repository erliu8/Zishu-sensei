//! 性能监控数据库模型
//! 
//! 负责性能数据的持久化存储，包括：
//! - 性能指标记录
//! - 用户操作追踪
//! - 网络性能监控
//! - 应用性能快照
//! - 性能趋势分析

use rusqlite::{params, Connection, Result, Row};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, error, info, warn};

/// 性能指标记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetric {
    pub id: Option<i64>,
    pub metric_name: String,
    pub metric_value: f64,
    pub unit: String,
    pub category: String,          // "cpu", "memory", "network", "render", "user"
    pub component: Option<String>, // 相关组件或功能
    pub timestamp: i64,
    pub metadata: String, // JSON格式的额外信息
}

/// 用户操作记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserOperation {
    pub id: Option<i64>,
    pub operation_type: String, // "click", "scroll", "input", "navigation"
    pub target_element: String, // 目标元素标识
    pub start_time: i64,
    pub end_time: i64,
    pub response_time: i64, // 响应时间（毫秒）
    pub success: bool,
    pub error_message: Option<String>,
    pub metadata: String, // JSON格式的操作详情
}

/// 网络请求性能记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetric {
    pub id: Option<i64>,
    pub url: String,
    pub method: String,
    pub status_code: Option<i32>,
    pub request_size: Option<i64>,
    pub response_size: Option<i64>,
    pub dns_time: Option<i64>,
    pub connect_time: Option<i64>,
    pub ssl_time: Option<i64>,
    pub send_time: Option<i64>,
    pub wait_time: Option<i64>,
    pub receive_time: Option<i64>,
    pub total_time: i64,
    pub timestamp: i64,
    pub error_type: Option<String>,
    pub error_message: Option<String>,
}

/// 应用性能快照
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSnapshot {
    pub id: Option<i64>,
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub memory_used_mb: f64,
    pub memory_total_mb: f64,
    pub fps: f32,
    pub render_time: f64,
    pub active_connections: i32,
    pub open_files: i32,
    pub thread_count: i32,
    pub heap_size: Option<f64>,
    pub gc_time: Option<f64>,
    pub timestamp: i64,
    pub app_state: String, // "active", "idle", "background"
    pub load_average: Option<String>, // JSON数组格式
}

/// 性能统计汇总
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub id: Option<i64>,
    pub metric_category: String,
    pub time_period: String, // "1h", "1d", "1w", "1m"
    pub avg_value: f64,
    pub min_value: f64,
    pub max_value: f64,
    pub count: i64,
    pub p95_value: f64,
    pub p99_value: f64,
    pub created_at: i64,
}

/// 性能警告记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    pub id: Option<i64>,
    pub alert_type: String,   // "high_cpu", "high_memory", "low_fps", "slow_response"
    pub severity: String,     // "low", "medium", "high", "critical"
    pub message: String,
    pub threshold: f64,
    pub actual_value: f64,
    pub component: Option<String>,
    pub duration: i64, // 持续时间（秒）
    pub resolved: bool,
    pub resolved_at: Option<i64>,
    pub timestamp: i64,
    pub metadata: String,
}

/// 性能数据库操作
pub struct PerformanceDatabase {
    db_path: String,
}

impl PerformanceDatabase {
    /// 创建新的数据库实例
    pub fn new(db_path: &str) -> Result<Self> {
        let db = Self {
            db_path: db_path.to_string(),
        };

        db.initialize()?;
        Ok(db)
    }

    /// 初始化数据库表
    pub fn initialize(&self) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;

        // 性能指标表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                unit TEXT NOT NULL,
                category TEXT NOT NULL,
                component TEXT,
                timestamp INTEGER NOT NULL,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 用户操作表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS user_operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_type TEXT NOT NULL,
                target_element TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                response_time INTEGER NOT NULL,
                success BOOLEAN NOT NULL DEFAULT 1,
                error_message TEXT,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 网络性能表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS network_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                method TEXT NOT NULL,
                status_code INTEGER,
                request_size INTEGER,
                response_size INTEGER,
                dns_time INTEGER,
                connect_time INTEGER,
                ssl_time INTEGER,
                send_time INTEGER,
                wait_time INTEGER,
                receive_time INTEGER,
                total_time INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                error_type TEXT,
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 性能快照表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS performance_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cpu_usage REAL NOT NULL,
                memory_usage REAL NOT NULL,
                memory_used_mb REAL NOT NULL,
                memory_total_mb REAL NOT NULL,
                fps REAL NOT NULL,
                render_time REAL NOT NULL,
                active_connections INTEGER NOT NULL,
                open_files INTEGER NOT NULL,
                thread_count INTEGER NOT NULL,
                heap_size REAL,
                gc_time REAL,
                timestamp INTEGER NOT NULL,
                app_state TEXT NOT NULL DEFAULT 'active',
                load_average TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 性能统计汇总表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS performance_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_category TEXT NOT NULL,
                time_period TEXT NOT NULL,
                avg_value REAL NOT NULL,
                min_value REAL NOT NULL,
                max_value REAL NOT NULL,
                count INTEGER NOT NULL,
                p95_value REAL NOT NULL,
                p99_value REAL NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 性能警告表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS performance_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                threshold REAL NOT NULL,
                actual_value REAL NOT NULL,
                component TEXT,
                duration INTEGER NOT NULL DEFAULT 0,
                resolved BOOLEAN NOT NULL DEFAULT 0,
                resolved_at INTEGER,
                timestamp INTEGER NOT NULL,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // 创建索引以优化查询性能
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_performance_metrics_category ON performance_metrics(category)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_operations_timestamp ON user_operations(timestamp)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_network_metrics_timestamp ON network_metrics(timestamp)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_performance_snapshots_timestamp ON performance_snapshots(timestamp)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_performance_alerts_timestamp ON performance_alerts(timestamp)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved)",
            [],
        )?;

        info!("性能监控数据库初始化完成");
        Ok(())
    }

    /// 记录性能指标
    pub fn record_metric(&self, metric: &PerformanceMetric) -> Result<i64> {
        let conn = Connection::open(&self.db_path)?;
        
        let timestamp = if metric.timestamp == 0 {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64
        } else {
            metric.timestamp
        };

        conn.execute(
            "INSERT INTO performance_metrics 
             (metric_name, metric_value, unit, category, component, timestamp, metadata) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                metric.metric_name,
                metric.metric_value,
                metric.unit,
                metric.category,
                metric.component,
                timestamp,
                metric.metadata
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 记录用户操作
    pub fn record_user_operation(&self, operation: &UserOperation) -> Result<i64> {
        let conn = Connection::open(&self.db_path)?;

        conn.execute(
            "INSERT INTO user_operations 
             (operation_type, target_element, start_time, end_time, response_time, 
              success, error_message, metadata) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                operation.operation_type,
                operation.target_element,
                operation.start_time,
                operation.end_time,
                operation.response_time,
                operation.success,
                operation.error_message,
                operation.metadata
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 记录网络性能
    pub fn record_network_metric(&self, metric: &NetworkMetric) -> Result<i64> {
        let conn = Connection::open(&self.db_path)?;

        conn.execute(
            "INSERT INTO network_metrics 
             (url, method, status_code, request_size, response_size, dns_time, 
              connect_time, ssl_time, send_time, wait_time, receive_time, 
              total_time, timestamp, error_type, error_message) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                metric.url,
                metric.method,
                metric.status_code,
                metric.request_size,
                metric.response_size,
                metric.dns_time,
                metric.connect_time,
                metric.ssl_time,
                metric.send_time,
                metric.wait_time,
                metric.receive_time,
                metric.total_time,
                metric.timestamp,
                metric.error_type,
                metric.error_message
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 记录性能快照
    pub fn record_snapshot(&self, snapshot: &PerformanceSnapshot) -> Result<i64> {
        let conn = Connection::open(&self.db_path)?;

        let timestamp = if snapshot.timestamp == 0 {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64
        } else {
            snapshot.timestamp
        };

        conn.execute(
            "INSERT INTO performance_snapshots 
             (cpu_usage, memory_usage, memory_used_mb, memory_total_mb, fps, render_time,
              active_connections, open_files, thread_count, heap_size, gc_time, 
              timestamp, app_state, load_average) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                snapshot.cpu_usage,
                snapshot.memory_usage,
                snapshot.memory_used_mb,
                snapshot.memory_total_mb,
                snapshot.fps,
                snapshot.render_time,
                snapshot.active_connections,
                snapshot.open_files,
                snapshot.thread_count,
                snapshot.heap_size,
                snapshot.gc_time,
                timestamp,
                snapshot.app_state,
                snapshot.load_average
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 记录性能警告
    pub fn record_alert(&self, alert: &PerformanceAlert) -> Result<i64> {
        let conn = Connection::open(&self.db_path)?;

        let timestamp = if alert.timestamp == 0 {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64
        } else {
            alert.timestamp
        };

        conn.execute(
            "INSERT INTO performance_alerts 
             (alert_type, severity, message, threshold, actual_value, component, 
              duration, resolved, resolved_at, timestamp, metadata) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                alert.alert_type,
                alert.severity,
                alert.message,
                alert.threshold,
                alert.actual_value,
                alert.component,
                alert.duration,
                alert.resolved,
                alert.resolved_at,
                timestamp,
                alert.metadata
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 获取性能指标
    pub fn get_metrics(
        &self,
        category: Option<&str>,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<usize>,
    ) -> Result<Vec<PerformanceMetric>> {
        let conn = Connection::open(&self.db_path)?;
        
        let mut query = "SELECT id, metric_name, metric_value, unit, category, component, timestamp, metadata 
                         FROM performance_metrics WHERE 1=1".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(cat) = category {
            query.push_str(" AND category = ?");
            params.push(Box::new(cat.to_string()));
        }

        if let Some(start) = start_time {
            query.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.to_string()));
        }

        if let Some(end) = end_time {
            query.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.to_string()));
        }

        query.push_str(" ORDER BY timestamp DESC");

        if let Some(lim) = limit {
            query.push_str(&format!(" LIMIT {}", lim));
        }

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref() as &dyn rusqlite::ToSql).collect();
        let metric_iter = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(PerformanceMetric {
                id: Some(row.get(0)?),
                metric_name: row.get(1)?,
                metric_value: row.get(2)?,
                unit: row.get(3)?,
                category: row.get(4)?,
                component: row.get(5)?,
                timestamp: row.get(6)?,
                metadata: row.get(7)?,
            })
        })?;

        let mut metrics = Vec::new();
        for metric in metric_iter {
            metrics.push(metric?);
        }

        Ok(metrics)
    }

    /// 获取用户操作记录
    pub fn get_user_operations(
        &self,
        operation_type: Option<&str>,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<usize>,
    ) -> Result<Vec<UserOperation>> {
        let conn = Connection::open(&self.db_path)?;
        
        let mut query = "SELECT id, operation_type, target_element, start_time, end_time, 
                               response_time, success, error_message, metadata 
                         FROM user_operations WHERE 1=1".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(op_type) = operation_type {
            query.push_str(" AND operation_type = ?");
            params.push(Box::new(op_type.to_string()));
        }

        if let Some(start) = start_time {
            query.push_str(" AND start_time >= ?");
            params.push(Box::new(start.to_string()));
        }

        if let Some(end) = end_time {
            query.push_str(" AND end_time <= ?");
            params.push(Box::new(end.to_string()));
        }

        query.push_str(" ORDER BY start_time DESC");

        if let Some(lim) = limit {
            query.push_str(&format!(" LIMIT {}", lim));
        }

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref() as &dyn rusqlite::ToSql).collect();
        let operation_iter = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(UserOperation {
                id: Some(row.get(0)?),
                operation_type: row.get(1)?,
                target_element: row.get(2)?,
                start_time: row.get(3)?,
                end_time: row.get(4)?,
                response_time: row.get(5)?,
                success: row.get(6)?,
                error_message: row.get(7)?,
                metadata: row.get(8)?,
            })
        })?;

        let mut operations = Vec::new();
        for operation in operation_iter {
            operations.push(operation?);
        }

        Ok(operations)
    }

    /// 获取网络性能记录
    pub fn get_network_metrics(
        &self,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<usize>,
    ) -> Result<Vec<NetworkMetric>> {
        let conn = Connection::open(&self.db_path)?;
        
        let mut query = "SELECT id, url, method, status_code, request_size, response_size, 
                               dns_time, connect_time, ssl_time, send_time, wait_time, 
                               receive_time, total_time, timestamp, error_type, error_message 
                         FROM network_metrics WHERE 1=1".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(start) = start_time {
            query.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.to_string()));
        }

        if let Some(end) = end_time {
            query.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.to_string()));
        }

        query.push_str(" ORDER BY timestamp DESC");

        if let Some(lim) = limit {
            query.push_str(&format!(" LIMIT {}", lim));
        }

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref() as &dyn rusqlite::ToSql).collect();
        let metric_iter = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(NetworkMetric {
                id: Some(row.get(0)?),
                url: row.get(1)?,
                method: row.get(2)?,
                status_code: row.get(3)?,
                request_size: row.get(4)?,
                response_size: row.get(5)?,
                dns_time: row.get(6)?,
                connect_time: row.get(7)?,
                ssl_time: row.get(8)?,
                send_time: row.get(9)?,
                wait_time: row.get(10)?,
                receive_time: row.get(11)?,
                total_time: row.get(12)?,
                timestamp: row.get(13)?,
                error_type: row.get(14)?,
                error_message: row.get(15)?,
            })
        })?;

        let mut metrics = Vec::new();
        for metric in metric_iter {
            metrics.push(metric?);
        }

        Ok(metrics)
    }

    /// 获取性能快照
    pub fn get_snapshots(
        &self,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<usize>,
    ) -> Result<Vec<PerformanceSnapshot>> {
        let conn = Connection::open(&self.db_path)?;
        
        let mut query = "SELECT id, cpu_usage, memory_usage, memory_used_mb, memory_total_mb, 
                               fps, render_time, active_connections, open_files, thread_count, 
                               heap_size, gc_time, timestamp, app_state, load_average 
                         FROM performance_snapshots WHERE 1=1".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(start) = start_time {
            query.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.to_string()));
        }

        if let Some(end) = end_time {
            query.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.to_string()));
        }

        query.push_str(" ORDER BY timestamp DESC");

        if let Some(lim) = limit {
            query.push_str(&format!(" LIMIT {}", lim));
        }

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref() as &dyn rusqlite::ToSql).collect();
        let snapshot_iter = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(PerformanceSnapshot {
                id: Some(row.get(0)?),
                cpu_usage: row.get(1)?,
                memory_usage: row.get(2)?,
                memory_used_mb: row.get(3)?,
                memory_total_mb: row.get(4)?,
                fps: row.get(5)?,
                render_time: row.get(6)?,
                active_connections: row.get(7)?,
                open_files: row.get(8)?,
                thread_count: row.get(9)?,
                heap_size: row.get(10)?,
                gc_time: row.get(11)?,
                timestamp: row.get(12)?,
                app_state: row.get(13)?,
                load_average: row.get(14)?,
            })
        })?;

        let mut snapshots = Vec::new();
        for snapshot in snapshot_iter {
            snapshots.push(snapshot?);
        }

        Ok(snapshots)
    }

    /// 获取性能警告
    pub fn get_alerts(
        &self,
        resolved: Option<bool>,
        start_time: Option<i64>,
        end_time: Option<i64>,
        limit: Option<usize>,
    ) -> Result<Vec<PerformanceAlert>> {
        let conn = Connection::open(&self.db_path)?;
        
        let mut query = "SELECT id, alert_type, severity, message, threshold, actual_value, 
                               component, duration, resolved, resolved_at, timestamp, metadata 
                         FROM performance_alerts WHERE 1=1".to_string();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(res) = resolved {
            query.push_str(" AND resolved = ?");
            params.push(Box::new(res.to_string()));
        }

        if let Some(start) = start_time {
            query.push_str(" AND timestamp >= ?");
            params.push(Box::new(start.to_string()));
        }

        if let Some(end) = end_time {
            query.push_str(" AND timestamp <= ?");
            params.push(Box::new(end.to_string()));
        }

        query.push_str(" ORDER BY timestamp DESC");

        if let Some(lim) = limit {
            query.push_str(&format!(" LIMIT {}", lim));
        }

        let mut stmt = conn.prepare(&query)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref() as &dyn rusqlite::ToSql).collect();
        let alert_iter = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(PerformanceAlert {
                id: Some(row.get(0)?),
                alert_type: row.get(1)?,
                severity: row.get(2)?,
                message: row.get(3)?,
                threshold: row.get(4)?,
                actual_value: row.get(5)?,
                component: row.get(6)?,
                duration: row.get(7)?,
                resolved: row.get(8)?,
                resolved_at: row.get(9)?,
                timestamp: row.get(10)?,
                metadata: row.get(11)?,
            })
        })?;

        let mut alerts = Vec::new();
        for alert in alert_iter {
            alerts.push(alert?);
        }

        Ok(alerts)
    }

    /// 计算性能统计
    pub fn calculate_stats(&self, category: &str, time_period: &str) -> Result<PerformanceStats> {
        let conn = Connection::open(&self.db_path)?;
        
        let period_seconds = match time_period {
            "1h" => 3600,
            "1d" => 86400,
            "1w" => 604800,
            "1m" => 2592000,
            _ => 3600,
        };

        let start_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64 * 1000 - period_seconds * 1000;

        let mut stmt = conn.prepare(
            "SELECT metric_value FROM performance_metrics 
             WHERE category = ?1 AND timestamp >= ?2 
             ORDER BY metric_value ASC"
        )?;

        let values: Result<Vec<f64>> = stmt.query_map([category, &start_time.to_string()], |row| {
            Ok(row.get::<_, f64>(0)?)
        })?.collect();

        let values = values?;

        if values.is_empty() {
            return Ok(PerformanceStats {
                id: None,
                metric_category: category.to_string(),
                time_period: time_period.to_string(),
                avg_value: 0.0,
                min_value: 0.0,
                max_value: 0.0,
                count: 0,
                p95_value: 0.0,
                p99_value: 0.0,
                created_at: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as i64,
            });
        }

        let count = values.len();
        let sum: f64 = values.iter().sum();
        let avg = sum / count as f64;
        let min = values[0];
        let max = values[count - 1];

        let p95_index = ((count as f64) * 0.95).ceil() as usize - 1;
        let p99_index = ((count as f64) * 0.99).ceil() as usize - 1;
        let p95 = values[p95_index.min(count - 1)];
        let p99 = values[p99_index.min(count - 1)];

        Ok(PerformanceStats {
            id: None,
            metric_category: category.to_string(),
            time_period: time_period.to_string(),
            avg_value: avg,
            min_value: min,
            max_value: max,
            count: count as i64,
            p95_value: p95,
            p99_value: p99,
            created_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
        })
    }

    /// 清理旧数据
    pub fn cleanup_old_data(&self, days: i32) -> Result<usize> {
        let conn = Connection::open(&self.db_path)?;
        
        let cutoff_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64 * 1000 - (days as i64 * 24 * 3600 * 1000);

        let mut deleted = 0;

        // 清理性能指标
        deleted += conn.execute(
            "DELETE FROM performance_metrics WHERE timestamp < ?1",
            params![cutoff_time],
        )?;

        // 清理用户操作
        deleted += conn.execute(
            "DELETE FROM user_operations WHERE start_time < ?1",
            params![cutoff_time],
        )?;

        // 清理网络指标
        deleted += conn.execute(
            "DELETE FROM network_metrics WHERE timestamp < ?1",
            params![cutoff_time],
        )?;

        // 清理性能快照
        deleted += conn.execute(
            "DELETE FROM performance_snapshots WHERE timestamp < ?1",
            params![cutoff_time],
        )?;

        // 清理已解决的警告
        deleted += conn.execute(
            "DELETE FROM performance_alerts WHERE resolved = 1 AND timestamp < ?1",
            params![cutoff_time],
        )?;

        info!("清理了 {} 条旧性能数据", deleted);
        Ok(deleted)
    }

    /// 标记警告为已解决
    pub fn resolve_alert(&self, alert_id: i64) -> Result<()> {
        let conn = Connection::open(&self.db_path)?;
        
        let resolved_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        conn.execute(
            "UPDATE performance_alerts SET resolved = 1, resolved_at = ?1 WHERE id = ?2",
            params![resolved_at, alert_id],
        )?;

        Ok(())
    }
}

