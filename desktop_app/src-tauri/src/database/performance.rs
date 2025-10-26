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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json;

    /// 创建测试用的性能指标
    fn create_test_metric() -> PerformanceMetric {
        PerformanceMetric {
            id: Some(1),
            metric_name: "cpu_usage".to_string(),
            value: 75.5,
            metric_value: 75.5,
            unit: "percent".to_string(),
            category: "system".to_string(),
            component: "cpu".to_string(),
            metadata: Some(r#"{"core": 1}"#.to_string()),
            timestamp: Utc::now().timestamp(),
        }
    }

    /// 创建测试用的性能快照
    fn create_test_snapshot() -> PerformanceSnapshot {
        PerformanceSnapshot {
            id: Some(1),
            timestamp: Utc::now().timestamp(),
            cpu_usage: 75.5,
            memory_usage: 60.2,
            memory_used_mb: 4096.0,
            memory_total_mb: 8192.0,
            disk_usage: 45.8,
            network_in: 1024.0,
            network_out: 512.0,
            load_average: 1.5,
            thread_count: 150,
            open_files: 500,
            render_time: 16.7,
            fps: 60.0,
            heap_size: 256.0,
            gc_time: 5.2,
            app_state: "active".to_string(),
            active_connections: 25,
        }
    }

    /// 创建测试用的性能警告
    fn create_test_alert() -> PerformanceAlert {
        PerformanceAlert {
            id: 1,
            alert_type: "threshold".to_string(),
            component: "cpu".to_string(),
            metric_name: "cpu_usage".to_string(),
            threshold: 80.0,
            actual_value: 85.2,
            current_value: 85.2,
            severity: "warning".to_string(),
            message: "CPU使用率过高".to_string(),
            duration: 300,
            metadata: Some(r#"{"alert_id": "cpu_high"}"#.to_string()),
            resolved: false,
            resolved_at: None,
            timestamp: Utc::now().timestamp(),
        }
    }

    /// 创建测试用的网络指标
    fn create_test_network_metric() -> NetworkMetric {
        NetworkMetric {
            id: Some(1),
            timestamp: Utc::now().timestamp(),
            bytes_sent: 1024,
            bytes_received: 2048,
            packets_sent: 10,
            packets_received: 15,
            method: "GET".to_string(),
            url: "https://api.example.com/test".to_string(),
            status_code: 200,
            request_size: 256,
            response_size: 1024,
            total_time: 123.45,
            dns_time: 5.2,
            connect_time: 15.8,
            ssl_time: 25.6,
            send_time: 2.1,
            wait_time: 70.5,
            receive_time: 4.25,
            error_message: None,
            error_type: None,
        }
    }

    /// 创建测试用的用户操作
    fn create_test_user_operation() -> UserOperation {
        UserOperation {
            id: 1,
            user_id: "test_user".to_string(),
            operation: "click_button".to_string(),
            operation_type: "ui_interaction".to_string(),
            target_element: "submit_button".to_string(),
            start_time: Utc::now().timestamp(),
            end_time: Utc::now().timestamp() + 1,
            duration_ms: 1000,
            response_time: 1000.0,
            success: true,
            error_message: None,
            metadata: Some(r#"{"page": "home"}"#.to_string()),
            timestamp: Utc::now().timestamp(),
        }
    }

    // ================================
    // 数据结构测试
    // ================================

    #[test]
    fn test_performance_metric_serialization() {
        let metric = create_test_metric();
        
        // 测试序列化
        let json = serde_json::to_string(&metric).expect("序列化失败");
        assert!(json.contains("cpu_usage"));
        assert!(json.contains("75.5"));
        
        // 测试反序列化
        let deserialized: PerformanceMetric = serde_json::from_str(&json).expect("反序列化失败");
        assert_eq!(deserialized.metric_name, "cpu_usage");
        assert_eq!(deserialized.value, 75.5);
    }

    #[test]
    fn test_performance_alert_serialization() {
        let alert = create_test_alert();
        
        let json = serde_json::to_string(&alert).expect("序列化失败");
        assert!(json.contains("threshold"));
        assert!(json.contains("85.2"));
        assert!(json.contains("CPU使用率过高"));
        
        let deserialized: PerformanceAlert = serde_json::from_str(&json).expect("反序列化失败");
        assert_eq!(deserialized.alert_type, "threshold");
        assert_eq!(deserialized.actual_value, 85.2);
    }

    #[test]
    fn test_performance_snapshot_serialization() {
        let snapshot = create_test_snapshot();
        
        let json = serde_json::to_string(&snapshot).expect("序列化失败");
        assert!(json.contains("cpu_usage"));
        assert!(json.contains("memory_usage"));
        
        let deserialized: PerformanceSnapshot = serde_json::from_str(&json).expect("反序列化失败");
        assert_eq!(deserialized.cpu_usage, 75.5);
        assert_eq!(deserialized.memory_usage, 60.2);
    }

    #[test]
    fn test_network_metric_serialization() {
        let metric = create_test_network_metric();
        
        let json = serde_json::to_string(&metric).expect("序列化失败");
        assert!(json.contains("GET"));
        assert!(json.contains("api.example.com"));
        
        let deserialized: NetworkMetric = serde_json::from_str(&json).expect("反序列化失败");
        assert_eq!(deserialized.method, "GET");
        assert_eq!(deserialized.status_code, 200);
    }

    #[test]
    fn test_user_operation_serialization() {
        let operation = create_test_user_operation();
        
        let json = serde_json::to_string(&operation).expect("序列化失败");
        assert!(json.contains("click_button"));
        assert!(json.contains("test_user"));
        
        let deserialized: UserOperation = serde_json::from_str(&json).expect("反序列化失败");
        assert_eq!(deserialized.operation, "click_button");
        assert_eq!(deserialized.user_id, "test_user");
    }

    // ================================
    // PerformanceDatabase测试（无数据库依赖）
    // ================================

    #[test]
    fn test_performance_database_new() {
        let temp_path = std::path::Path::new("/tmp/test_performance.db");
        let result = PerformanceDatabase::new(temp_path);
        assert!(result.is_ok());
        
        let db = result.unwrap();
        // 检查实例是否正确创建（没有连接池时）
        assert!(db.pool.is_none());
    }

    #[test]
    fn test_calculate_stats_empty() {
        let temp_path = std::path::Path::new("/tmp/test_performance.db");
        let db = PerformanceDatabase::new(temp_path).unwrap();
        
        let empty_metrics = vec![];
        let stats = db.calculate_stats(&empty_metrics).unwrap();
        
        assert_eq!(stats.avg_response_time, 0.0);
        assert_eq!(stats.max_response_time, 0.0);
        assert_eq!(stats.min_response_time, 0.0);
        assert_eq!(stats.total_requests, 0);
        assert_eq!(stats.error_count, 0);
    }

    #[test]
    fn test_calculate_stats_with_data() {
        let temp_path = std::path::Path::new("/tmp/test_performance.db");
        let db = PerformanceDatabase::new(temp_path).unwrap();
        
        let metrics = vec![
            PerformanceMetric { value: 10.0, ..create_test_metric() },
            PerformanceMetric { value: 20.0, ..create_test_metric() },
            PerformanceMetric { value: 30.0, ..create_test_metric() },
        ];
        
        let stats = db.calculate_stats(&metrics).unwrap();
        
        assert_eq!(stats.avg_response_time, 20.0);
        assert_eq!(stats.max_response_time, 30.0);
        assert_eq!(stats.min_response_time, 10.0);
        assert_eq!(stats.total_requests, 3);
        assert_eq!(stats.error_count, 0);
    }

    #[test]
    fn test_calculate_stats_single_value() {
        let temp_path = std::path::Path::new("/tmp/test_performance.db");
        let db = PerformanceDatabase::new(temp_path).unwrap();
        
        let metrics = vec![
            PerformanceMetric { value: 42.5, ..create_test_metric() },
        ];
        
        let stats = db.calculate_stats(&metrics).unwrap();
        
        assert_eq!(stats.avg_response_time, 42.5);
        assert_eq!(stats.max_response_time, 42.5);
        assert_eq!(stats.min_response_time, 42.5);
        assert_eq!(stats.total_requests, 1);
    }

    // ================================
    // 边界条件和错误处理测试
    // ================================

    #[test]
    fn test_performance_metric_default_values() {
        let mut metric = create_test_metric();
        metric.metadata = None;
        
        let json = serde_json::to_string(&metric).expect("序列化失败");
        let deserialized: PerformanceMetric = serde_json::from_str(&json).expect("反序列化失败");
        
        assert!(deserialized.metadata.is_none());
    }

    #[test]
    fn test_performance_alert_resolved_state() {
        let mut alert = create_test_alert();
        alert.resolved = true;
        alert.resolved_at = Some(Utc::now().timestamp());
        
        let json = serde_json::to_string(&alert).expect("序列化失败");
        let deserialized: PerformanceAlert = serde_json::from_str(&json).expect("反序列化失败");
        
        assert!(deserialized.resolved);
        assert!(deserialized.resolved_at.is_some());
    }

    #[test]
    fn test_network_metric_with_error() {
        let mut metric = create_test_network_metric();
        metric.status_code = 500;
        metric.error_message = Some("Internal Server Error".to_string());
        metric.error_type = Some("http_error".to_string());
        
        let json = serde_json::to_string(&metric).expect("序列化失败");
        let deserialized: NetworkMetric = serde_json::from_str(&json).expect("反序列化失败");
        
        assert_eq!(deserialized.status_code, 500);
        assert_eq!(deserialized.error_message, Some("Internal Server Error".to_string()));
        assert_eq!(deserialized.error_type, Some("http_error".to_string()));
    }

    #[test]
    fn test_user_operation_failure() {
        let mut operation = create_test_user_operation();
        operation.success = false;
        operation.error_message = Some("操作超时".to_string());
        
        let json = serde_json::to_string(&operation).expect("序列化失败");
        let deserialized: UserOperation = serde_json::from_str(&json).expect("反序列化失败");
        
        assert!(!deserialized.success);
        assert_eq!(deserialized.error_message, Some("操作超时".to_string()));
    }

    // ================================
    // 性能基准测试（无数据库依赖）
    // ================================

    #[test]
    fn test_metric_creation_performance() {
        let start = std::time::Instant::now();
        
        // 创建1000个性能指标
        for i in 0..1000 {
            let mut metric = create_test_metric();
            metric.value = i as f64;
            metric.timestamp = Utc::now().timestamp() + i;
        }
        
        let duration = start.elapsed();
        assert!(duration.as_millis() < 100, "创建1000个指标耗时过长: {:?}", duration);
    }

    #[test]
    fn test_serialization_performance() {
        let metrics: Vec<PerformanceMetric> = (0..100)
            .map(|i| {
                let mut metric = create_test_metric();
                metric.value = i as f64;
                metric
            })
            .collect();
        
        let start = std::time::Instant::now();
        
        for metric in &metrics {
            let _json = serde_json::to_string(metric).expect("序列化失败");
        }
        
        let duration = start.elapsed();
        assert!(duration.as_millis() < 50, "序列化100个指标耗时过长: {:?}", duration);
    }

    // ================================
    // 业务逻辑测试
    // ================================

    #[test]
    fn test_performance_stats_calculation_edge_cases() {
        let temp_path = std::path::Path::new("/tmp/test_performance.db");
        let db = PerformanceDatabase::new(temp_path).unwrap();
        
        // 测试包含负值的情况
        let metrics = vec![
            PerformanceMetric { value: -10.0, ..create_test_metric() },
            PerformanceMetric { value: 0.0, ..create_test_metric() },
            PerformanceMetric { value: 10.0, ..create_test_metric() },
        ];
        
        let stats = db.calculate_stats(&metrics).unwrap();
        
        assert_eq!(stats.avg_response_time, 0.0);
        assert_eq!(stats.max_response_time, 10.0);
        assert_eq!(stats.min_response_time, -10.0);
    }

    #[test]
    fn test_performance_stats_calculation_large_numbers() {
        let temp_path = std::path::Path::new("/tmp/test_performance.db");
        let db = PerformanceDatabase::new(temp_path).unwrap();
        
        let metrics = vec![
            PerformanceMetric { value: 1e6, ..create_test_metric() },
            PerformanceMetric { value: 2e6, ..create_test_metric() },
            PerformanceMetric { value: 3e6, ..create_test_metric() },
        ];
        
        let stats = db.calculate_stats(&metrics).unwrap();
        
        assert_eq!(stats.avg_response_time, 2e6);
        assert_eq!(stats.max_response_time, 3e6);
        assert_eq!(stats.min_response_time, 1e6);
    }

    // ================================
    // 数据验证测试
    // ================================

    #[test]
    fn test_metric_timestamp_validation() {
        let metric = create_test_metric();
        
        // 时间戳应该是合理的（不能是未来时间）
        let now = Utc::now().timestamp();
        assert!(metric.timestamp <= now + 1); // 允许1秒的时间差
        assert!(metric.timestamp > now - 3600); // 不应该太久之前
    }

    #[test]
    fn test_performance_snapshot_values_range() {
        let snapshot = create_test_snapshot();
        
        // CPU使用率应该在合理范围内
        assert!(snapshot.cpu_usage >= 0.0 && snapshot.cpu_usage <= 100.0);
        
        // 内存使用率应该在合理范围内
        assert!(snapshot.memory_usage >= 0.0 && snapshot.memory_usage <= 100.0);
        
        // 已使用内存不应该超过总内存
        assert!(snapshot.memory_used_mb <= snapshot.memory_total_mb);
        
        // FPS应该是正数
        assert!(snapshot.fps > 0.0);
        
        // 线程数和打开文件数应该是正数
        assert!(snapshot.thread_count > 0);
        assert!(snapshot.open_files > 0);
    }

    #[test]
    fn test_network_metric_timing_validation() {
        let metric = create_test_network_metric();
        
        // 总时间应该大于等于各个阶段时间的和
        let sum_times = metric.dns_time + metric.connect_time + metric.ssl_time + 
                       metric.send_time + metric.wait_time + metric.receive_time;
        
        // 允许一定的误差
        assert!(metric.total_time >= sum_times - 1.0, 
               "总时间 {} 应该大于等于各阶段时间和 {}", metric.total_time, sum_times);
        
        // 所有时间都应该是非负数
        assert!(metric.dns_time >= 0.0);
        assert!(metric.connect_time >= 0.0);
        assert!(metric.ssl_time >= 0.0);
        assert!(metric.send_time >= 0.0);
        assert!(metric.wait_time >= 0.0);
        assert!(metric.receive_time >= 0.0);
    }

    #[test]
    fn test_user_operation_duration_consistency() {
        let operation = create_test_user_operation();
        
        // 结束时间应该大于等于开始时间
        assert!(operation.end_time >= operation.start_time);
        
        // 持续时间应该与时间戳一致
        let expected_duration = (operation.end_time - operation.start_time) * 1000;
        assert_eq!(operation.duration_ms, expected_duration);
        
        // 响应时间应该与持续时间一致
        assert_eq!(operation.response_time, operation.duration_ms as f64);
    }

    // ================================
    // JSON数据处理测试
    // ================================

    #[test]
    fn test_metadata_json_parsing() {
        let mut metric = create_test_metric();
        metric.metadata = Some(r#"{"cpu_core": 2, "frequency": 2400, "temperature": 65.5}"#.to_string());
        
        // 测试复杂JSON的序列化
        let json = serde_json::to_string(&metric).expect("序列化失败");
        let deserialized: PerformanceMetric = serde_json::from_str(&json).expect("反序列化失败");
        
        assert!(deserialized.metadata.is_some());
        let metadata = deserialized.metadata.unwrap();
        assert!(metadata.contains("cpu_core"));
        assert!(metadata.contains("2400"));
        assert!(metadata.contains("65.5"));
    }

    #[test]
    fn test_invalid_json_metadata() {
        let mut metric = create_test_metric();
        metric.metadata = Some("invalid json".to_string());
        
        // 即使metadata不是有效的JSON，也应该能序列化
        let json = serde_json::to_string(&metric).expect("序列化失败");
        let deserialized: PerformanceMetric = serde_json::from_str(&json).expect("反序列化失败");
        
        assert_eq!(deserialized.metadata, Some("invalid json".to_string()));
    }
}
