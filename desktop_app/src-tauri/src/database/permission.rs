//! 权限管理数据库模型 (PostgreSQL)
//!
//! 提供细粒度的权限控制系统

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use chrono::{DateTime, Utc};
use tracing::{info, error, warn};
use crate::database::DbPool;
use tokio::runtime::Handle;

// ================================
// 权限类型定义
// ================================

/// 权限类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PermissionType {
    FileRead,
    FileWrite,
    FileDelete,
    FileExecute,
    FileWatch,
    NetworkHttp,
    NetworkWebSocket,
    NetworkSocket,
    NetworkDns,
    SystemCommand,
    SystemEnv,
    SystemInfo,
    SystemClipboard,
    SystemNotification,
    AppDatabase,
    AppConfig,
    AppChatHistory,
    AppUserData,
    AppAdapter,
    HardwareCamera,
    HardwareMicrophone,
    HardwareScreenCapture,
    HardwareLocation,
    AdvancedAutoStart,
    AdvancedBackground,
    AdvancedAdmin,
    Custom(String),
}

impl std::str::FromStr for PermissionType {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "file_read" => Ok(PermissionType::FileRead),
            "file_write" => Ok(PermissionType::FileWrite),
            "file_delete" => Ok(PermissionType::FileDelete),
            "file_execute" => Ok(PermissionType::FileExecute),
            "file_watch" => Ok(PermissionType::FileWatch),
            "network_http" => Ok(PermissionType::NetworkHttp),
            "network_web_socket" => Ok(PermissionType::NetworkWebSocket),
            "network_socket" => Ok(PermissionType::NetworkSocket),
            "network_dns" => Ok(PermissionType::NetworkDns),
            "system_command" => Ok(PermissionType::SystemCommand),
            "system_env" => Ok(PermissionType::SystemEnv),
            "system_info" => Ok(PermissionType::SystemInfo),
            "system_clipboard" => Ok(PermissionType::SystemClipboard),
            "system_notification" => Ok(PermissionType::SystemNotification),
            "app_database" => Ok(PermissionType::AppDatabase),
            "app_config" => Ok(PermissionType::AppConfig),
            "app_chat_history" => Ok(PermissionType::AppChatHistory),
            "app_user_data" => Ok(PermissionType::AppUserData),
            "app_adapter" => Ok(PermissionType::AppAdapter),
            "hardware_camera" => Ok(PermissionType::HardwareCamera),
            "hardware_microphone" => Ok(PermissionType::HardwareMicrophone),
            "hardware_screen_capture" => Ok(PermissionType::HardwareScreenCapture),
            "hardware_location" => Ok(PermissionType::HardwareLocation),
            "advanced_auto_start" => Ok(PermissionType::AdvancedAutoStart),
            "advanced_background" => Ok(PermissionType::AdvancedBackground),
            "advanced_admin" => Ok(PermissionType::AdvancedAdmin),
            other => Ok(PermissionType::Custom(other.to_string())),
        }
    }
}

impl std::fmt::Display for PermissionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PermissionType::FileRead => write!(f, "file_read"),
            PermissionType::FileWrite => write!(f, "file_write"),
            PermissionType::FileDelete => write!(f, "file_delete"),
            PermissionType::FileExecute => write!(f, "file_execute"),
            PermissionType::FileWatch => write!(f, "file_watch"),
            PermissionType::NetworkHttp => write!(f, "network_http"),
            PermissionType::NetworkWebSocket => write!(f, "network_web_socket"),
            PermissionType::NetworkSocket => write!(f, "network_socket"),
            PermissionType::NetworkDns => write!(f, "network_dns"),
            PermissionType::SystemCommand => write!(f, "system_command"),
            PermissionType::SystemEnv => write!(f, "system_env"),
            PermissionType::SystemInfo => write!(f, "system_info"),
            PermissionType::SystemClipboard => write!(f, "system_clipboard"),
            PermissionType::SystemNotification => write!(f, "system_notification"),
            PermissionType::AppDatabase => write!(f, "app_database"),
            PermissionType::AppConfig => write!(f, "app_config"),
            PermissionType::AppChatHistory => write!(f, "app_chat_history"),
            PermissionType::AppUserData => write!(f, "app_user_data"),
            PermissionType::AppAdapter => write!(f, "app_adapter"),
            PermissionType::HardwareCamera => write!(f, "hardware_camera"),
            PermissionType::HardwareMicrophone => write!(f, "hardware_microphone"),
            PermissionType::HardwareScreenCapture => write!(f, "hardware_screen_capture"),
            PermissionType::HardwareLocation => write!(f, "hardware_location"),
            PermissionType::AdvancedAutoStart => write!(f, "advanced_auto_start"),
            PermissionType::AdvancedBackground => write!(f, "advanced_background"),
            PermissionType::AdvancedAdmin => write!(f, "advanced_admin"),
            PermissionType::Custom(s) => write!(f, "{}", s),
        }
    }
}

/// 权限级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionLevel {
    None,
    Read,
    ReadOnly,
    Write,
    ReadWrite,
    Admin,
}

impl std::fmt::Display for PermissionLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PermissionLevel::None => write!(f, "none"),
            PermissionLevel::Read => write!(f, "read"),
            PermissionLevel::ReadOnly => write!(f, "read_only"),
            PermissionLevel::Write => write!(f, "write"),
            PermissionLevel::ReadWrite => write!(f, "read_write"),
            PermissionLevel::Admin => write!(f, "admin"),
        }
    }
}

impl std::str::FromStr for PermissionLevel {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "none" => Ok(PermissionLevel::None),
            "read" => Ok(PermissionLevel::Read),
            "read_only" => Ok(PermissionLevel::ReadOnly),
            "write" => Ok(PermissionLevel::Write),
            "read_write" => Ok(PermissionLevel::ReadWrite),
            "admin" => Ok(PermissionLevel::Admin),
            _ => Err(format!("无效的权限级别: {}", s)),
        }
    }
}

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionStatus {
    Pending,
    Granted,
    Denied,
    Revoked,
}

impl std::fmt::Display for PermissionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PermissionStatus::Pending => write!(f, "pending"),
            PermissionStatus::Granted => write!(f, "granted"),
            PermissionStatus::Denied => write!(f, "denied"),
            PermissionStatus::Revoked => write!(f, "revoked"),
        }
    }
}

impl std::str::FromStr for PermissionStatus {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(PermissionStatus::Pending),
            "granted" => Ok(PermissionStatus::Granted),
            "denied" => Ok(PermissionStatus::Denied),
            "revoked" => Ok(PermissionStatus::Revoked),
            _ => Err(format!("无效的权限状态: {}", s)),
        }
    }
}

/// 权限定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub id: i64,
    pub permission_type: PermissionType,
    pub name: String,
    pub description: String,
    pub category: String,
}

/// 权限授权
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGrant {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub permission_type: PermissionType,
    pub level: PermissionLevel,
    pub status: PermissionStatus,
    pub scope: Option<String>,
    pub granted_by: Option<String>,
    pub granted_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// 权限使用日志
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionUsageLog {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub permission_type: PermissionType,
    pub level: PermissionLevel,
    pub resource: Option<String>,
    pub action: String,
    pub success: bool,
    pub failure_reason: Option<String>,
    pub timestamp: DateTime<Utc>,
}

/// 权限组
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGroup {
    pub id: i64,
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub permissions: Vec<PermissionType>,
}

/// 权限统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStats {
    pub total_grants: i64,
    pub active_grants: i64,
    pub pending_requests: i64,
    pub denied_requests: i64,
}

/// 权限记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRecord {
    pub id: i64,
    pub resource_id: String,
    pub permission_type: String,
    pub granted: bool,
    pub granted_at: Option<DateTime<Utc>>,
}

/// 权限注册表
pub struct PermissionRegistry {
    pool: DbPool,
}

impl PermissionRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 权限定义表
        client.execute(
            "CREATE TABLE IF NOT EXISTS permission_definitions (
                id SERIAL PRIMARY KEY,
                permission_type TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                created_at BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 权限授予表
        client.execute(
            "CREATE TABLE IF NOT EXISTS permission_grants (
                id SERIAL PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                permission_type TEXT NOT NULL,
                level TEXT NOT NULL,
                status TEXT NOT NULL,
                scope TEXT,
                granted_by TEXT,
                granted_at BIGINT,
                expires_at BIGINT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 权限使用日志表
        client.execute(
            "CREATE TABLE IF NOT EXISTS permission_usage_logs (
                id SERIAL PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                permission_type TEXT NOT NULL,
                level TEXT NOT NULL,
                resource TEXT,
                action TEXT NOT NULL,
                success BOOLEAN NOT NULL,
                failure_reason TEXT,
                ip_address TEXT,
                metadata JSONB,
                timestamp BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 权限组表
        client.execute(
            "CREATE TABLE IF NOT EXISTS permission_groups (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                description TEXT NOT NULL,
                permissions JSONB NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 创建索引
        client.batch_execute(
            "CREATE INDEX IF NOT EXISTS idx_permission_grants_entity ON permission_grants(entity_type, entity_id);
             CREATE INDEX IF NOT EXISTS idx_permission_grants_status ON permission_grants(status);
             CREATE INDEX IF NOT EXISTS idx_permission_grants_expires ON permission_grants(expires_at);
             CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_grants_unique ON permission_grants(entity_type, entity_id, permission_type, COALESCE(scope, ''));
             CREATE INDEX IF NOT EXISTS idx_permission_usage_logs_entity ON permission_usage_logs(entity_type, entity_id);
             CREATE INDEX IF NOT EXISTS idx_permission_usage_logs_timestamp ON permission_usage_logs(timestamp);"
        ).await?;

        info!("权限数据库表初始化完成");
        Ok(())
    }

    // ================================
    // 权限授予和撤销
    // ================================

    /// 授予权限
    pub fn grant_permission(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        level: PermissionLevel,
        scope: Option<String>,
        granted_by: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            let expires_ts = expires_at.map(|dt| dt.timestamp());
            
            client.execute(
                "INSERT INTO permission_grants (
                    entity_type, entity_id, permission_type, level, status,
                    scope, granted_by, granted_at, expires_at, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (entity_type, entity_id, permission_type, COALESCE(scope, ''))
                DO UPDATE SET
                    level = EXCLUDED.level,
                    status = EXCLUDED.status,
                    granted_by = EXCLUDED.granted_by,
                    granted_at = EXCLUDED.granted_at,
                    expires_at = EXCLUDED.expires_at,
                    updated_at = EXCLUDED.updated_at",
                &[
                    &entity_type,
                    &entity_id,
                    &permission_type.to_string(),
                    &level.to_string(),
                    &PermissionStatus::Granted.to_string(),
                    &scope,
                    &granted_by,
                    &now,
                    &expires_ts,
                    &now,
                    &now,
                ],
            ).await?;
            
            info!("权限已授予: {}::{} -> {:?} ({})", entity_type, entity_id, permission_type, level);
            Ok(())
        })
    }

    /// 请求权限
    pub fn request_permission(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        level: PermissionLevel,
        scope: Option<String>,
    ) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            
            let row = client.query_one(
                "INSERT INTO permission_grants (
                    entity_type, entity_id, permission_type, level, status,
                    scope, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id",
                &[
                    &entity_type,
                    &entity_id,
                    &permission_type.to_string(),
                    &level.to_string(),
                    &PermissionStatus::Pending.to_string(),
                    &scope,
                    &now,
                    &now,
                ],
            ).await?;
            
            let id: i32 = row.get("id");
            info!("权限请求已创建: {}::{} -> {:?} ({})", entity_type, entity_id, permission_type, level);
            Ok(id as i64)
        })
    }

    /// 拒绝权限
    pub fn deny_permission(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        scope: Option<String>,
        _reason: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            
            let scope_filter = scope.as_deref().unwrap_or("");
            client.execute(
                "UPDATE permission_grants
                 SET status = $1, updated_at = $2
                 WHERE entity_type = $3 AND entity_id = $4 
                   AND permission_type = $5 AND COALESCE(scope, '') = $6
                   AND status = 'pending'",
                &[
                    &PermissionStatus::Denied.to_string(),
                    &now,
                    &entity_type,
                    &entity_id,
                    &permission_type.to_string(),
                    &scope_filter,
                ],
            ).await?;
            
            info!("权限已拒绝: {}::{} -> {:?}", entity_type, entity_id, permission_type);
            Ok(())
        })
    }

    /// 撤销权限
    pub fn revoke_permission(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        scope: Option<String>,
        _reason: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            
            let scope_filter = scope.as_deref().unwrap_or("");
            client.execute(
                "UPDATE permission_grants
                 SET status = $1, updated_at = $2
                 WHERE entity_type = $3 AND entity_id = $4 
                   AND permission_type = $5 AND COALESCE(scope, '') = $6
                   AND status = 'granted'",
                &[
                    &PermissionStatus::Revoked.to_string(),
                    &now,
                    &entity_type,
                    &entity_id,
                    &permission_type.to_string(),
                    &scope_filter,
                ],
            ).await?;
            
            info!("权限已撤销: {}::{} -> {:?}", entity_type, entity_id, permission_type);
            Ok(())
        })
    }

    // ================================
    // 权限检查和查询
    // ================================

    /// 检查权限
    pub fn check_permission(
        &self,
        entity_type: &str,
        entity_id: &str,
        permission_type: &PermissionType,
        level: &PermissionLevel,
        scope: Option<&str>,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            
            let scope_filter = scope.unwrap_or("");
            let rows = client.query(
                "SELECT level, expires_at FROM permission_grants
                 WHERE entity_type = $1 AND entity_id = $2
                   AND permission_type = $3 AND COALESCE(scope, '') = $4
                   AND status = 'granted'
                   AND (expires_at IS NULL OR expires_at > $5)",
                &[
                    &entity_type,
                    &entity_id,
                    &permission_type.to_string(),
                    &scope_filter,
                    &now,
                ],
            ).await?;
            
            if rows.is_empty() {
                return Ok(false);
            }
            
            let granted_level_str: String = rows[0].get("level");
            let granted_level: PermissionLevel = granted_level_str.parse().unwrap_or(PermissionLevel::None);
            
            // 简单的级别检查逻辑
            let has_permission = match (&granted_level, level) {
                (PermissionLevel::Admin, _) => true,
                (PermissionLevel::ReadWrite, PermissionLevel::Read) => true,
                (PermissionLevel::ReadWrite, PermissionLevel::Write) => true,
                (PermissionLevel::ReadWrite, PermissionLevel::ReadWrite) => true,
                (PermissionLevel::Read, PermissionLevel::Read) => true,
                (PermissionLevel::Write, PermissionLevel::Write) => true,
                (l1, l2) => l1 == l2,
            };
            
            Ok(has_permission)
        })
    }

    /// 获取所有权限定义
    pub fn get_all_permissions(&self) -> Result<Vec<Permission>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, permission_type, name, description, category
                 FROM permission_definitions
                 ORDER BY category, name",
                &[],
            ).await?;
            
            let mut permissions = Vec::new();
            for row in rows {
                let ptype_str: String = row.get("permission_type");
                let id: i32 = row.get("id");
                
                permissions.push(Permission {
                    id: id as i64,
                    permission_type: ptype_str.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                    name: row.get("name"),
                    description: row.get("description"),
                    category: row.get("category"),
                });
            }
            
            Ok(permissions)
        })
    }

    /// 获取特定类型的权限
    pub fn get_permission_by_type(&self, ptype: &PermissionType) -> Result<Option<Permission>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, permission_type, name, description, category
                 FROM permission_definitions
                 WHERE permission_type = $1",
                &[&ptype.to_string()],
            ).await?;
            
            if rows.is_empty() {
                return Ok(None);
            }
            
            let row = &rows[0];
            let ptype_str: String = row.get("permission_type");
            let id: i32 = row.get("id");
            
            Ok(Some(Permission {
                id: id as i64,
                permission_type: ptype_str.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                name: row.get("name"),
                description: row.get("description"),
                category: row.get("category"),
            }))
        })
    }

    /// 按分类获取权限
    pub fn get_permissions_by_category(&self, category: &str) -> Result<Vec<Permission>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, permission_type, name, description, category
                 FROM permission_definitions
                 WHERE category = $1
                 ORDER BY name",
                &[&category],
            ).await?;
            
            let mut permissions = Vec::new();
            for row in rows {
                let ptype_str: String = row.get("permission_type");
                let id: i32 = row.get("id");
                
                permissions.push(Permission {
                    id: id as i64,
                    permission_type: ptype_str.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                    name: row.get("name"),
                    description: row.get("description"),
                    category: row.get("category"),
                });
            }
            
            Ok(permissions)
        })
    }

    /// 获取实体的所有授权
    pub fn get_entity_grants(&self, entity_type: &str, entity_id: &str) -> Result<Vec<PermissionGrant>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, entity_type, entity_id, permission_type, level, status,
                        scope, granted_by, granted_at, expires_at
                 FROM permission_grants
                 WHERE entity_type = $1 AND entity_id = $2
                 ORDER BY created_at DESC",
                &[&entity_type, &entity_id],
            ).await?;
            
            let mut grants = Vec::new();
            for row in rows {
                let id: i32 = row.get("id");
                let ptype_str: String = row.get("permission_type");
                let level_str: String = row.get("level");
                let status_str: String = row.get("status");
                let granted_at: Option<i64> = row.get("granted_at");
                let expires_at: Option<i64> = row.get("expires_at");
                
                grants.push(PermissionGrant {
                    id: id as i64,
                    entity_type: row.get("entity_type"),
                    entity_id: row.get("entity_id"),
                    permission_type: ptype_str.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                    level: level_str.parse().unwrap_or(PermissionLevel::None),
                    status: status_str.parse().unwrap_or(PermissionStatus::Pending),
                    scope: row.get("scope"),
                    granted_by: row.get("granted_by"),
                    granted_at: granted_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_default()),
                    expires_at: expires_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_default()),
                });
            }
            
            Ok(grants)
        })
    }

    /// 获取待处理的授权请求
    pub fn get_pending_grants(&self) -> Result<Vec<PermissionGrant>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, entity_type, entity_id, permission_type, level, status,
                        scope, granted_by, granted_at, expires_at
                 FROM permission_grants
                 WHERE status = 'pending'
                 ORDER BY created_at ASC",
                &[],
            ).await?;
            
            let mut grants = Vec::new();
            for row in rows {
                let id: i32 = row.get("id");
                let ptype_str: String = row.get("permission_type");
                let level_str: String = row.get("level");
                let status_str: String = row.get("status");
                let granted_at: Option<i64> = row.get("granted_at");
                let expires_at: Option<i64> = row.get("expires_at");
                
                grants.push(PermissionGrant {
                    id: id as i64,
                    entity_type: row.get("entity_type"),
                    entity_id: row.get("entity_id"),
                    permission_type: ptype_str.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                    level: level_str.parse().unwrap_or(PermissionLevel::None),
                    status: status_str.parse().unwrap_or(PermissionStatus::Pending),
                    scope: row.get("scope"),
                    granted_by: row.get("granted_by"),
                    granted_at: granted_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_default()),
                    expires_at: expires_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_default()),
                });
            }
            
            Ok(grants)
        })
    }

    /// 清理过期授权
    pub fn cleanup_expired_grants(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            
            let rows_affected = client.execute(
                "UPDATE permission_grants
                 SET status = 'revoked', updated_at = $1
                 WHERE status = 'granted' AND expires_at IS NOT NULL AND expires_at <= $1",
                &[&now],
            ).await?;
            
            info!("清理了 {} 个过期权限授权", rows_affected);
            Ok(rows_affected as usize)
        })
    }

    // ================================
    // 权限使用日志
    // ================================

    /// 记录权限使用
    pub fn log_permission_usage(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        level: PermissionLevel,
        resource: Option<String>,
        action: String,
        success: bool,
        failure_reason: Option<String>,
        ip_address: Option<String>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            let metadata_json = metadata.map(|m| serde_json::to_value(m).ok()).flatten();
            
            let row = client.query_one(
                "INSERT INTO permission_usage_logs (
                    entity_type, entity_id, permission_type, level, resource,
                    action, success, failure_reason, ip_address, metadata, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id",
                &[
                    &entity_type,
                    &entity_id,
                    &permission_type.to_string(),
                    &level.to_string(),
                    &resource,
                    &action,
                    &success,
                    &failure_reason,
                    &ip_address,
                    &metadata_json,
                    &now,
                ],
            ).await?;
            
            let id: i32 = row.get("id");
            Ok(id as i64)
        })
    }

    /// 获取使用日志
    pub fn get_usage_logs(
        &self,
        entity_type: Option<&str>,
        entity_id: Option<&str>,
        permission_type: Option<&PermissionType>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<PermissionUsageLog>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let mut query = String::from(
                "SELECT id, entity_type, entity_id, permission_type, level, resource,
                        action, success, failure_reason, timestamp
                 FROM permission_usage_logs
                 WHERE 1=1"
            );
            let mut param_idx = 1;
            let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Send + Sync>> = Vec::new();
            
            if let Some(et) = entity_type {
                query.push_str(&format!(" AND entity_type = ${}", param_idx));
                params.push(Box::new(et.to_string()));
                param_idx += 1;
            }
            
            if let Some(ei) = entity_id {
                query.push_str(&format!(" AND entity_id = ${}", param_idx));
                params.push(Box::new(ei.to_string()));
                param_idx += 1;
            }
            
            if let Some(pt) = permission_type {
                query.push_str(&format!(" AND permission_type = ${}", param_idx));
                params.push(Box::new(pt.to_string()));
                param_idx += 1;
            }
            
            query.push_str(" ORDER BY timestamp DESC");
            
            if let Some(lim) = limit {
                query.push_str(&format!(" LIMIT ${}", param_idx));
                params.push(Box::new(lim));
                param_idx += 1;
            }
            
            if let Some(off) = offset {
                query.push_str(&format!(" OFFSET ${}", param_idx));
                params.push(Box::new(off));
            }
            
            let param_refs: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params.iter().map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync)).collect();
            let rows = client.query(&query, &param_refs[..]).await?;
            
            let mut logs = Vec::new();
            for row in rows {
                let id: i32 = row.get("id");
                let ptype_str: String = row.get("permission_type");
                let level_str: String = row.get("level");
                let timestamp: i64 = row.get("timestamp");
                
                logs.push(PermissionUsageLog {
                    id: id as i64,
                    entity_type: row.get("entity_type"),
                    entity_id: row.get("entity_id"),
                    permission_type: ptype_str.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                    level: level_str.parse().unwrap_or(PermissionLevel::None),
                    resource: row.get("resource"),
                    action: row.get("action"),
                    success: row.get("success"),
                    failure_reason: row.get("failure_reason"),
                    timestamp: DateTime::from_timestamp(timestamp, 0).unwrap_or_default(),
                });
            }
            
            Ok(logs)
        })
    }

    // ================================
    // 权限统计
    // ================================

    /// 获取权限统计
    pub fn get_permission_stats(&self, entity_type: &str, entity_id: &str) -> Result<PermissionStats, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let row = client.query_one(
                "SELECT 
                    COUNT(*) as total_grants,
                    COUNT(*) FILTER (WHERE status = 'granted') as active_grants,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
                    COUNT(*) FILTER (WHERE status = 'denied') as denied_requests
                 FROM permission_grants
                 WHERE entity_type = $1 AND entity_id = $2",
                &[&entity_type, &entity_id],
            ).await?;
            
            Ok(PermissionStats {
                total_grants: row.get::<_, i64>("total_grants"),
                active_grants: row.get::<_, i64>("active_grants"),
                pending_requests: row.get::<_, i64>("pending_requests"),
                denied_requests: row.get::<_, i64>("denied_requests"),
            })
        })
    }

    // ================================
    // 权限组管理
    // ================================

    /// 创建权限组
    pub fn create_permission_group(
        &self,
        name: String,
        display_name: String,
        description: String,
        permissions: Vec<PermissionType>,
    ) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            let now = Utc::now().timestamp();
            
            let permissions_str: Vec<String> = permissions.iter().map(|p| p.to_string()).collect();
            let permissions_json = serde_json::to_value(permissions_str)?;
            
            let row = client.query_one(
                "INSERT INTO permission_groups (
                    name, display_name, description, permissions, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (name) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    permissions = EXCLUDED.permissions,
                    updated_at = EXCLUDED.updated_at
                RETURNING id",
                &[
                    &name,
                    &display_name,
                    &description,
                    &permissions_json,
                    &now,
                    &now,
                ],
            ).await?;
            
            let id: i32 = row.get("id");
            info!("权限组已创建: {} ({})", name, id);
            Ok(id as i64)
        })
    }

    /// 获取权限组
    pub fn get_permission_group(&self, name: &str) -> Result<Option<PermissionGroup>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, name, display_name, description, permissions
                 FROM permission_groups
                 WHERE name = $1",
                &[&name],
            ).await?;
            
            if rows.is_empty() {
                return Ok(None);
            }
            
            let row = &rows[0];
            let id: i32 = row.get("id");
            let permissions_json: serde_json::Value = row.get("permissions");
            let permissions_str: Vec<String> = serde_json::from_value(permissions_json)?;
            let permissions: Vec<PermissionType> = permissions_str.iter()
                .filter_map(|s| s.parse().ok())
                .collect();
            
            Ok(Some(PermissionGroup {
                id: id as i64,
                name: row.get("name"),
                display_name: row.get("display_name"),
                description: row.get("description"),
                permissions,
            }))
        })
    }

    /// 获取所有权限组
    pub fn get_all_permission_groups(&self) -> Result<Vec<PermissionGroup>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, name, display_name, description, permissions
                 FROM permission_groups
                 ORDER BY name",
                &[],
            ).await?;
            
            let mut groups = Vec::new();
            for row in rows {
                let id: i32 = row.get("id");
                let permissions_json: serde_json::Value = row.get("permissions");
                let permissions_str: Vec<String> = serde_json::from_value(permissions_json)?;
                let permissions: Vec<PermissionType> = permissions_str.iter()
                    .filter_map(|s| s.parse().ok())
                    .collect();
                
                groups.push(PermissionGroup {
                    id: id as i64,
                    name: row.get("name"),
                    display_name: row.get("display_name"),
                    description: row.get("description"),
                    permissions,
                });
            }
            
            Ok(groups)
        })
    }

    /// 授予权限组
    pub fn grant_permission_group(
        &self,
        entity_type: String,
        entity_id: String,
        group_name: &str,
        level: PermissionLevel,
        granted_by: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let group = self.get_permission_group(group_name)?
            .ok_or_else(|| format!("权限组不存在: {}", group_name))?;
        
        for permission_type in group.permissions {
            self.grant_permission(
                entity_type.clone(),
                entity_id.clone(),
                permission_type,
                level.clone(),
                None,
                granted_by.clone(),
                expires_at.clone(),
            )?;
        }
        
        info!("权限组已授予: {}::{} -> {}", entity_type, entity_id, group_name);
        Ok(())
    }

    /// 获取资源权限（兼容旧接口）
    pub fn get_permissions(&self, resource_id: &str) -> Result<Vec<PermissionRecord>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(async {
            let client = self.pool.get().await?;
            
            let rows = client.query(
                "SELECT id, entity_id as resource_id, permission_type, 
                        (status = 'granted') as granted, granted_at
                 FROM permission_grants
                 WHERE entity_id = $1",
                &[&resource_id],
            ).await?;
            
            let mut records = Vec::new();
            for row in rows {
                let id: i32 = row.get("id");
                let granted: bool = row.get("granted");
                let granted_at: Option<i64> = row.get("granted_at");
                
                records.push(PermissionRecord {
                    id: id as i64,
                    resource_id: row.get("resource_id"),
                    permission_type: row.get("permission_type"),
                    granted,
                    granted_at: granted_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_default()),
                });
            }
            
            Ok(records)
        })
    }
}
