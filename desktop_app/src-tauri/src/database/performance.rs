//! 性能监控数据库模块 (PostgreSQL)
//! 管理性能指标和监控数据

use serde::{Deserialize, Serialize};
use crate::database::DbPool;
use tokio::runtime::Handle;
use tracing::{info, debug, warn};
use chrono::Utc;

// ================================
// 数据结构定义
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetric {
    pub id: Option<i64>,
    pub metric_name: String,
    pub value: f64,
    pub metric_value: f64,
    pub unit: String,
    pub category: String,
    pub component: String,
    pub metadata: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    pub id: i64,
    pub alert_type: String,
    pub component: String,
    pub metric_name: String,
    pub threshold: f64,
    pub actual_value: f64,
    pub current_value: f64,
    pub severity: String,
    pub message: String,
    pub duration: i64,
    pub metadata: Option<String>,
    pub resolved: bool,
    pub resolved_at: Option<i64>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSnapshot {
    pub id: Option<i64>,
    pub timestamp: i64,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub memory_used_mb: f64,
    pub memory_total_mb: f64,
    pub disk_usage: f64,
    pub network_in: f64,
    pub network_out: f64,
    pub load_average: f64,
    pub thread_count: i64,
    pub open_files: i64,
    pub render_time: f64,
    pub fps: f64,
    pub heap_size: f64,
    pub gc_time: f64,
    pub app_state: String,
    pub active_connections: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub avg_response_time: f64,
    pub max_response_time: f64,
    pub min_response_time: f64,
    pub total_requests: i64,
    pub error_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetric {
    pub id: Option<i64>,
    pub timestamp: i64,
    pub bytes_sent: i64,
    pub bytes_received: i64,
    pub packets_sent: i64,
    pub packets_received: i64,
    pub method: String,
    pub url: String,
    pub status_code: i32,
    pub request_size: i64,
    pub response_size: i64,
    pub total_time: f64,
    pub dns_time: f64,
    pub connect_time: f64,
    pub ssl_time: f64,
    pub send_time: f64,
    pub wait_time: f64,
    pub receive_time: f64,
    pub error_message: Option<String>,
    pub error_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserOperation {
    pub id: i64,
    pub user_id: String,
    pub operation: String,
    pub operation_type: String,
    pub target_element: String,
    pub start_time: i64,
    pub end_time: i64,
    pub duration_ms: i64,
    pub response_time: f64,
    pub success: bool,
    pub error_message: Option<String>,
    pub metadata: Option<String>,
    pub timestamp: i64,
}

// ================================
// PerformanceRegistry (新接口)
// ================================

pub struct PerformanceRegistry {
    pool: DbPool,
}

impl PerformanceRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 性能指标表
        client.execute(
            "CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                metric_name TEXT NOT NULL,
                value DOUBLE PRECISION NOT NULL,
                unit TEXT NOT NULL,
                category TEXT NOT NULL,
                component TEXT NOT NULL,
                metadata JSONB,
                timestamp BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 性能快照表
        client.execute(
            "CREATE TABLE IF NOT EXISTS performance_snapshots (
                id SERIAL PRIMARY KEY,
                timestamp BIGINT NOT NULL,
                cpu_usage DOUBLE PRECISION NOT NULL,
                memory_usage DOUBLE PRECISION NOT NULL,
                memory_used_mb DOUBLE PRECISION NOT NULL,
                memory_total_mb DOUBLE PRECISION NOT NULL,
                disk_usage DOUBLE PRECISION NOT NULL,
                network_in DOUBLE PRECISION NOT NULL,
                network_out DOUBLE PRECISION NOT NULL,
                load_average DOUBLE PRECISION NOT NULL,
                thread_count BIGINT NOT NULL,
                open_files BIGINT NOT NULL,
                render_time DOUBLE PRECISION NOT NULL,
                fps DOUBLE PRECISION NOT NULL,
                heap_size DOUBLE PRECISION NOT NULL,
                gc_time DOUBLE PRECISION NOT NULL,
                app_state TEXT NOT NULL,
                active_connections BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 性能警告表
        client.execute(
            "CREATE TABLE IF NOT EXISTS performance_alerts (
                id SERIAL PRIMARY KEY,
                alert_type TEXT NOT NULL,
                component TEXT NOT NULL,
                metric_name TEXT NOT NULL,
                threshold DOUBLE PRECISION NOT NULL,
                actual_value DOUBLE PRECISION NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                duration BIGINT NOT NULL,
                metadata JSONB,
                resolved BOOLEAN NOT NULL DEFAULT false,
                resolved_at BIGINT,
                timestamp BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 网络指标表
        client.execute(
            "CREATE TABLE IF NOT EXISTS network_metrics (
                id SERIAL PRIMARY KEY,
                timestamp BIGINT NOT NULL,
                method TEXT NOT NULL,
                url TEXT NOT NULL,
                status_code INTEGER NOT NULL,
                request_size BIGINT NOT NULL,
                response_size BIGINT NOT NULL,
                total_time DOUBLE PRECISION NOT NULL,
                dns_time DOUBLE PRECISION NOT NULL,
                connect_time DOUBLE PRECISION NOT NULL,
                ssl_time DOUBLE PRECISION NOT NULL,
                send_time DOUBLE PRECISION NOT NULL,
                wait_time DOUBLE PRECISION NOT NULL,
                receive_time DOUBLE PRECISION NOT NULL,
                error_message TEXT,
                error_type TEXT
            )",
            &[],
        ).await?;

        // 用户操作表
        client.execute(
            "CREATE TABLE IF NOT EXISTS user_operations (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                target_element TEXT NOT NULL,
                start_time BIGINT NOT NULL,
                end_time BIGINT NOT NULL,
                duration_ms BIGINT NOT NULL,
                success BOOLEAN NOT NULL,
                error_message TEXT,
                metadata JSONB,
                timestamp BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 创建索引
        client.batch_execute(
            "CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
             CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
             CREATE INDEX IF NOT EXISTS idx_performance_snapshots_timestamp ON performance_snapshots(timestamp);
             CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved);
             CREATE INDEX IF NOT EXISTS idx_performance_alerts_timestamp ON performance_alerts(timestamp);
             CREATE INDEX IF NOT EXISTS idx_network_metrics_timestamp ON network_metrics(timestamp);
             CREATE INDEX IF NOT EXISTS idx_user_operations_user_id ON user_operations(user_id);
             CREATE INDEX IF NOT EXISTS idx_user_operations_timestamp ON user_operations(timestamp);"
        ).await?;

        info!("性能监控数据库表初始化完成");
        Ok(())
    }

    /// 记录性能指标
    pub fn record_metric(&self, metric: PerformanceMetric) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let metadata_json = metric.metadata.as_ref()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());
            
            client.execute(
                "INSERT INTO performance_metrics (
                    metric_name, value, unit, category, component, metadata, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                &[
                    &metric.metric_name,
                    &metric.value,
                    &metric.unit,
                    &metric.category,
                    &metric.component,
                    &metadata_json,
                    &metric.timestamp,
                ],
            ).await?;
            
            Ok(())
        })
    }

    /// 获取性能指标
    pub fn get_metrics(&self, metric_name: &str, limit: usize) -> Result<Vec<PerformanceMetric>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, metric_name, value, unit, category, component, metadata, timestamp
                 FROM performance_metrics
                 WHERE metric_name = $1
                 ORDER BY timestamp DESC
                 LIMIT $2",
                &[&metric_name, &(limit as i64)],
            ).await?;
            
            let mut metrics = Vec::new();
            for row in rows {
                let id: i32 = row.get("id");
                let metadata_json: Option<serde_json::Value> = row.get("metadata");
                let metadata = metadata_json.map(|v| v.to_string());
                
                metrics.push(PerformanceMetric {
                    id: Some(id as i64),
                    metric_name: row.get("metric_name"),
                    value: row.get("value"),
                    metric_value: row.get("value"),
                    unit: row.get("unit"),
                    category: row.get("category"),
                    component: row.get("component"),
                    metadata,
                    timestamp: row.get("timestamp"),
                });
            }
            
            Ok(metrics)
        })
    }
}

// ================================
// PerformanceDatabase (兼容旧接口)
// ================================

pub struct PerformanceDatabase {
    pool: Option<DbPool>,
}

impl PerformanceDatabase {
    /// 创建新实例（兼容路径参数）
    pub fn new(_path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Self { pool: None })
    }

    /// 从连接池创建（新方法）
    pub fn from_pool(pool: DbPool) -> Self {
        Self { pool: Some(pool) }
    }

    /// 记录性能指标
    pub fn record_metric(&self, metric: &PerformanceMetric) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let metadata_json = metric.metadata.as_ref()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());
                
                client.execute(
                    "INSERT INTO performance_metrics (
                        metric_name, value, unit, category, component, metadata, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                    &[
                        &metric.metric_name,
                        &metric.value,
                        &metric.unit,
                        &metric.category,
                        &metric.component,
                        &metadata_json,
                        &metric.timestamp,
                    ],
                ).await?;
                
                Ok(())
            })
        } else {
            Ok(())
        }
    }

    /// 获取性能指标
    pub fn get_metrics(&self, metric_name: &str, limit: usize) -> Result<Vec<PerformanceMetric>, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let rows = client.query(
                    "SELECT id, metric_name, value, unit, category, component, metadata, timestamp
                     FROM performance_metrics
                     WHERE metric_name = $1
                     ORDER BY timestamp DESC
                     LIMIT $2",
                    &[&metric_name, &(limit as i64)],
                ).await?;
                
                let mut metrics = Vec::new();
                for row in rows {
                    let id: i32 = row.get("id");
                    let metadata_json: Option<serde_json::Value> = row.get("metadata");
                    let metadata = metadata_json.map(|v| v.to_string());
                    
                    metrics.push(PerformanceMetric {
                        id: Some(id as i64),
                        metric_name: row.get("metric_name"),
                        value: row.get("value"),
                        metric_value: row.get("value"),
                        unit: row.get("unit"),
                        category: row.get("category"),
                        component: row.get("component"),
                        metadata,
                        timestamp: row.get("timestamp"),
                    });
                }
                
                Ok(metrics)
            })
        } else {
            Ok(vec![])
        }
    }

    /// 记录性能快照
    pub fn record_snapshot(&self, snapshot: &PerformanceSnapshot) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                client.execute(
                    "INSERT INTO performance_snapshots (
                        timestamp, cpu_usage, memory_usage, memory_used_mb, memory_total_mb,
                        disk_usage, network_in, network_out, load_average, thread_count,
                        open_files, render_time, fps, heap_size, gc_time, app_state,
                        active_connections
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)",
                    &[
                        &snapshot.timestamp,
                        &snapshot.cpu_usage,
                        &snapshot.memory_usage,
                        &snapshot.memory_used_mb,
                        &snapshot.memory_total_mb,
                        &snapshot.disk_usage,
                        &snapshot.network_in,
                        &snapshot.network_out,
                        &snapshot.load_average,
                        &snapshot.thread_count,
                        &snapshot.open_files,
                        &snapshot.render_time,
                        &snapshot.fps,
                        &snapshot.heap_size,
                        &snapshot.gc_time,
                        &snapshot.app_state,
                        &snapshot.active_connections,
                    ],
                ).await?;
                
                Ok(())
            })
        } else {
            Ok(())
        }
    }

    /// 获取性能快照
    pub fn get_snapshots(&self, start_time: i64, end_time: i64) -> Result<Vec<PerformanceSnapshot>, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let rows = client.query(
                    "SELECT id, timestamp, cpu_usage, memory_usage, memory_used_mb, memory_total_mb,
                            disk_usage, network_in, network_out, load_average, thread_count,
                            open_files, render_time, fps, heap_size, gc_time, app_state,
                            active_connections
                     FROM performance_snapshots
                     WHERE timestamp >= $1 AND timestamp <= $2
                     ORDER BY timestamp ASC",
                    &[&start_time, &end_time],
                ).await?;
                
                let mut snapshots = Vec::new();
                for row in rows {
                    let id: i32 = row.get("id");
                    
                    snapshots.push(PerformanceSnapshot {
                        id: Some(id as i64),
                        timestamp: row.get("timestamp"),
                        cpu_usage: row.get("cpu_usage"),
                        memory_usage: row.get("memory_usage"),
                        memory_used_mb: row.get("memory_used_mb"),
                        memory_total_mb: row.get("memory_total_mb"),
                        disk_usage: row.get("disk_usage"),
                        network_in: row.get("network_in"),
                        network_out: row.get("network_out"),
                        load_average: row.get("load_average"),
                        thread_count: row.get("thread_count"),
                        open_files: row.get("open_files"),
                        render_time: row.get("render_time"),
                        fps: row.get("fps"),
                        heap_size: row.get("heap_size"),
                        gc_time: row.get("gc_time"),
                        app_state: row.get("app_state"),
                        active_connections: row.get("active_connections"),
                    });
                }
                
                Ok(snapshots)
            })
        } else {
            Ok(vec![])
        }
    }

    /// 获取统计信息
    pub fn get_stats(&self) -> Result<PerformanceStats, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                // 基于用户操作表计算统计
                let result = client.query_one(
                    "SELECT 
                        COALESCE(AVG(duration_ms), 0) as avg_response_time,
                        COALESCE(MAX(duration_ms), 0) as max_response_time,
                        COALESCE(MIN(duration_ms), 0) as min_response_time,
                        COUNT(*) as total_requests,
                        COUNT(*) FILTER (WHERE NOT success) as error_count
                     FROM user_operations
                     WHERE timestamp > $1",
                    &[&(Utc::now().timestamp() - 3600)], // 最近1小时
                ).await?;
                
                Ok(PerformanceStats {
                    avg_response_time: result.get::<_, f64>("avg_response_time"),
                    max_response_time: result.get::<_, f64>("max_response_time") as f64,
                    min_response_time: result.get::<_, f64>("min_response_time") as f64,
                    total_requests: result.get::<_, i64>("total_requests"),
                    error_count: result.get::<_, i64>("error_count"),
                })
            })
        } else {
            Ok(PerformanceStats {
                avg_response_time: 0.0,
                max_response_time: 0.0,
                min_response_time: 0.0,
                total_requests: 0,
                error_count: 0,
            })
        }
    }

    /// 计算统计（从指标列表）
    pub fn calculate_stats(&self, metrics: &[PerformanceMetric]) -> Result<PerformanceStats, Box<dyn std::error::Error + Send + Sync>> {
        if metrics.is_empty() {
            return Ok(PerformanceStats {
                avg_response_time: 0.0,
                max_response_time: 0.0,
                min_response_time: 0.0,
                total_requests: 0,
                error_count: 0,
            });
        }
        
        let values: Vec<f64> = metrics.iter().map(|m| m.value).collect();
        let avg = values.iter().sum::<f64>() / values.len() as f64;
        let max = values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
        let min = values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        
        Ok(PerformanceStats {
            avg_response_time: avg,
            max_response_time: max,
            min_response_time: min,
            total_requests: metrics.len() as i64,
            error_count: 0,
        })
    }

    /// 记录警告
    pub fn record_alert(&self, alert: &PerformanceAlert) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let metadata_json = alert.metadata.as_ref()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());
                
                client.execute(
                    "INSERT INTO performance_alerts (
                        alert_type, component, metric_name, threshold, actual_value,
                        severity, message, duration, metadata, resolved, resolved_at, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
                    &[
                        &alert.alert_type,
                        &alert.component,
                        &alert.metric_name,
                        &alert.threshold,
                        &alert.actual_value,
                        &alert.severity,
                        &alert.message,
                        &alert.duration,
                        &metadata_json,
                        &alert.resolved,
                        &alert.resolved_at,
                        &alert.timestamp,
                    ],
                ).await?;
                
                Ok(())
            })
        } else {
            Ok(())
        }
    }

    /// 获取警告列表
    pub fn get_alerts(&self) -> Result<Vec<PerformanceAlert>, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let rows = client.query(
                    "SELECT id, alert_type, component, metric_name, threshold, actual_value,
                            severity, message, duration, metadata, resolved, resolved_at, timestamp
                     FROM performance_alerts
                     WHERE NOT resolved
                     ORDER BY timestamp DESC
                     LIMIT 100",
                    &[],
                ).await?;
                
                let mut alerts = Vec::new();
                for row in rows {
                    let id: i32 = row.get("id");
                    let metadata_json: Option<serde_json::Value> = row.get("metadata");
                    let metadata = metadata_json.map(|v| v.to_string());
                    
                    alerts.push(PerformanceAlert {
                        id: id as i64,
                        alert_type: row.get("alert_type"),
                        component: row.get("component"),
                        metric_name: row.get("metric_name"),
                        threshold: row.get("threshold"),
                        actual_value: row.get("actual_value"),
                        current_value: row.get("actual_value"),
                        severity: row.get("severity"),
                        message: row.get("message"),
                        duration: row.get("duration"),
                        metadata,
                        resolved: row.get("resolved"),
                        resolved_at: row.get("resolved_at"),
                        timestamp: row.get("timestamp"),
                    });
                }
                
                Ok(alerts)
            })
        } else {
            Ok(vec![])
        }
    }

    /// 解决警告
    pub fn resolve_alert(&self, id: i64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                let now = Utc::now().timestamp();
                
                client.execute(
                    "UPDATE performance_alerts
                     SET resolved = true, resolved_at = $1
                     WHERE id = $2",
                    &[&now, &(id as i32)],
                ).await?;
                
                Ok(())
            })
        } else {
            Ok(())
        }
    }

    /// 记录网络指标
    pub fn record_network_metric(&self, metric: &NetworkMetric) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                client.execute(
                    "INSERT INTO network_metrics (
                        timestamp, method, url, status_code, request_size, response_size,
                        total_time, dns_time, connect_time, ssl_time, send_time,
                        wait_time, receive_time, error_message, error_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
                    &[
                        &metric.timestamp,
                        &metric.method,
                        &metric.url,
                        &metric.status_code,
                        &metric.request_size,
                        &metric.response_size,
                        &metric.total_time,
                        &metric.dns_time,
                        &metric.connect_time,
                        &metric.ssl_time,
                        &metric.send_time,
                        &metric.wait_time,
                        &metric.receive_time,
                        &metric.error_message,
                        &metric.error_type,
                    ],
                ).await?;
                
                Ok(())
            })
        } else {
            Ok(())
        }
    }

    /// 获取网络指标
    pub fn get_network_metrics(&self, start_time: Option<i64>, end_time: Option<i64>, limit: Option<usize>) -> Result<Vec<NetworkMetric>, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let start = start_time.unwrap_or(0);
                let end = end_time.unwrap_or(i64::MAX);
                let lim = limit.unwrap_or(100) as i64;
                
                let rows = client.query(
                    "SELECT id, timestamp, method, url, status_code, request_size, response_size,
                            total_time, dns_time, connect_time, ssl_time, send_time,
                            wait_time, receive_time, error_message, error_type
                     FROM network_metrics
                     WHERE timestamp >= $1 AND timestamp <= $2
                     ORDER BY timestamp DESC
                     LIMIT $3",
                    &[&start, &end, &lim],
                ).await?;
                
                let mut metrics = Vec::new();
                for row in rows {
                    let id: i32 = row.get("id");
                    
                    metrics.push(NetworkMetric {
                        id: Some(id as i64),
                        timestamp: row.get("timestamp"),
                        bytes_sent: row.get("request_size"),
                        bytes_received: row.get("response_size"),
                        packets_sent: 0,
                        packets_received: 0,
                        method: row.get("method"),
                        url: row.get("url"),
                        status_code: row.get("status_code"),
                        request_size: row.get("request_size"),
                        response_size: row.get("response_size"),
                        total_time: row.get("total_time"),
                        dns_time: row.get("dns_time"),
                        connect_time: row.get("connect_time"),
                        ssl_time: row.get("ssl_time"),
                        send_time: row.get("send_time"),
                        wait_time: row.get("wait_time"),
                        receive_time: row.get("receive_time"),
                        error_message: row.get("error_message"),
                        error_type: row.get("error_type"),
                    });
                }
                
                Ok(metrics)
            })
        } else {
            Ok(vec![])
        }
    }

    /// 记录用户操作
    pub fn record_user_operation(&self, operation: &UserOperation) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let metadata_json = operation.metadata.as_ref()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());
                
                let row = client.query_one(
                    "INSERT INTO user_operations (
                        user_id, operation, operation_type, target_element,
                        start_time, end_time, duration_ms, success,
                        error_message, metadata, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id",
                    &[
                        &operation.user_id,
                        &operation.operation,
                        &operation.operation_type,
                        &operation.target_element,
                        &operation.start_time,
                        &operation.end_time,
                        &operation.duration_ms,
                        &operation.success,
                        &operation.error_message,
                        &metadata_json,
                        &operation.timestamp,
                    ],
                ).await?;
                
                let id: i32 = row.get("id");
                Ok(id as i64)
            })
        } else {
            Ok(0)
        }
    }

    /// 获取用户操作
    pub fn get_user_operations(&self, user_id: Option<&str>, start_time: Option<i64>, end_time: Option<i64>, limit: Option<usize>) -> Result<Vec<UserOperation>, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                
                let mut query = String::from(
                    "SELECT id, user_id, operation, operation_type, target_element,
                            start_time, end_time, duration_ms, success,
                            error_message, metadata, timestamp
                     FROM user_operations
                     WHERE 1=1"
                );
                let mut param_idx = 1;
                let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Send + Sync>> = Vec::new();
                
                if let Some(uid) = user_id {
                    query.push_str(&format!(" AND user_id = ${}", param_idx));
                    params.push(Box::new(uid.to_string()));
                    param_idx += 1;
                }
                
                if let Some(st) = start_time {
                    query.push_str(&format!(" AND timestamp >= ${}", param_idx));
                    params.push(Box::new(st));
                    param_idx += 1;
                }
                
                if let Some(et) = end_time {
                    query.push_str(&format!(" AND timestamp <= ${}", param_idx));
                    params.push(Box::new(et));
                    param_idx += 1;
                }
                
                query.push_str(" ORDER BY timestamp DESC");
                
                if let Some(lim) = limit {
                    query.push_str(&format!(" LIMIT ${}", param_idx));
                    params.push(Box::new(lim as i64));
                }
                
                let param_refs: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params.iter().map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync)).collect();
                let rows = client.query(&query, &param_refs[..]).await?;
                
                let mut operations = Vec::new();
                for row in rows {
                    let id: i32 = row.get("id");
                    let metadata_json: Option<serde_json::Value> = row.get("metadata");
                    let metadata = metadata_json.map(|v| v.to_string());
                    
                    operations.push(UserOperation {
                        id: id as i64,
                        user_id: row.get("user_id"),
                        operation: row.get("operation"),
                        operation_type: row.get("operation_type"),
                        target_element: row.get("target_element"),
                        start_time: row.get("start_time"),
                        end_time: row.get("end_time"),
                        duration_ms: row.get("duration_ms"),
                        response_time: row.get::<_, i64>("duration_ms") as f64,
                        success: row.get("success"),
                        error_message: row.get("error_message"),
                        metadata,
                        timestamp: row.get("timestamp"),
                    });
                }
                
                Ok(operations)
            })
        } else {
            Ok(vec![])
        }
    }

    /// 清理旧数据
    pub fn cleanup_old_data(&self, days: i64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ref pool) = self.pool {
            Handle::current().block_on(async {
                let client = pool.get().await?;
                let cutoff = Utc::now().timestamp() - (days * 24 * 3600);
                
                let metrics_deleted = client.execute(
                    "DELETE FROM performance_metrics WHERE timestamp < $1",
                    &[&cutoff],
                ).await?;
                
                let snapshots_deleted = client.execute(
                    "DELETE FROM performance_snapshots WHERE timestamp < $1",
                    &[&cutoff],
                ).await?;
                
                let alerts_deleted = client.execute(
                    "DELETE FROM performance_alerts WHERE timestamp < $1 AND resolved = true",
                    &[&cutoff],
                ).await?;
                
                let network_deleted = client.execute(
                    "DELETE FROM network_metrics WHERE timestamp < $1",
                    &[&cutoff],
                ).await?;
                
                let operations_deleted = client.execute(
                    "DELETE FROM user_operations WHERE timestamp < $1",
                    &[&cutoff],
                ).await?;
                
                info!(
                    "清理了旧数据: {} 指标, {} 快照, {} 警告, {} 网络指标, {} 用户操作",
                    metrics_deleted, snapshots_deleted, alerts_deleted, network_deleted, operations_deleted
                );
                
                Ok(())
            })
        } else {
            Ok(())
        }
    }
}
