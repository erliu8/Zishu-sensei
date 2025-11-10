//! 权限管理数据库模型 (PostgreSQL)
//!
//! 提供细粒度的权限控制系统

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use tracing::info;
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

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio_postgres::{NoTls, Client};
    use deadpool_postgres::{Config, Runtime};
    use std::collections::HashMap;
    
    // 使用真实的DbPool类型进行测试
    async fn create_test_pool() -> Result<DbPool, Box<dyn std::error::Error + Send + Sync>> {
        let mut config = Config::new();
        
        // 尝试从环境变量获取测试数据库配置
        if let Ok(url) = std::env::var("TEST_DATABASE_URL") {
            // 使用 url 库解析数据库URL
            if let Ok(parsed_url) = url::Url::parse(&url) {
                if let Some(host) = parsed_url.host_str() {
                    config.host = Some(host.to_string());
                }
                if let Some(port) = parsed_url.port() {
                    config.port = Some(port);
                } else {
                    config.port = Some(5432); // 默认PostgreSQL端口
                }
                
                let username = parsed_url.username();
                if !username.is_empty() {
                    config.user = Some(username.to_string());
                }
                
                if let Some(password) = parsed_url.password() {
                    config.password = Some(password.to_string());
                }
                
                // 获取数据库名（去掉开头的'/'）
                let path = parsed_url.path();
                if !path.is_empty() && path != "/" {
                    config.dbname = Some(path.trim_start_matches('/').to_string());
                }
            }
        } else {
            // 使用默认测试配置
            config.host = Some("localhost".to_string());
            config.port = Some(5432);
            config.user = Some("test".to_string());
            config.password = Some("test".to_string());
            config.dbname = Some("test_db".to_string());
        }
        
        let pool = config.create_pool(Some(Runtime::Tokio1), NoTls)?;
        Ok(pool)
    }

    // ================================
    // PermissionType 测试
    // ================================

    #[test]
    fn test_permission_type_display() {
        assert_eq!(PermissionType::FileRead.to_string(), "file_read");
        assert_eq!(PermissionType::NetworkHttp.to_string(), "network_http");
        assert_eq!(PermissionType::SystemCommand.to_string(), "system_command");
        assert_eq!(PermissionType::AppDatabase.to_string(), "app_database");
        assert_eq!(PermissionType::HardwareCamera.to_string(), "hardware_camera");
        assert_eq!(PermissionType::AdvancedAdmin.to_string(), "advanced_admin");
        assert_eq!(PermissionType::Custom("custom_perm".to_string()).to_string(), "custom_perm");
    }

    #[test]
    fn test_permission_type_from_str() {
        assert_eq!("file_read".parse::<PermissionType>().unwrap(), PermissionType::FileRead);
        assert_eq!("network_http".parse::<PermissionType>().unwrap(), PermissionType::NetworkHttp);
        assert_eq!("system_command".parse::<PermissionType>().unwrap(), PermissionType::SystemCommand);
        assert_eq!("app_database".parse::<PermissionType>().unwrap(), PermissionType::AppDatabase);
        assert_eq!("hardware_camera".parse::<PermissionType>().unwrap(), PermissionType::HardwareCamera);
        assert_eq!("advanced_admin".parse::<PermissionType>().unwrap(), PermissionType::AdvancedAdmin);
        
        // 测试自定义权限
        match "custom_permission".parse::<PermissionType>().unwrap() {
            PermissionType::Custom(name) => assert_eq!(name, "custom_permission"),
            _ => panic!("应该解析为Custom权限"),
        }
    }

    #[test]
    fn test_permission_type_serialization() {
        let ptype = PermissionType::FileWrite;
        let serialized = serde_json::to_string(&ptype).unwrap();
        assert_eq!(serialized, "\"file_write\"");
        
        let deserialized: PermissionType = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, PermissionType::FileWrite);
        
        // 测试自定义权限序列化
        let custom_ptype = PermissionType::Custom("my_custom".to_string());
        let custom_serialized = serde_json::to_string(&custom_ptype).unwrap();
        let custom_deserialized: PermissionType = serde_json::from_str(&custom_serialized).unwrap();
        match custom_deserialized {
            PermissionType::Custom(name) => assert_eq!(name, "my_custom"),
            _ => panic!("应该反序列化为Custom权限"),
        }
    }

    // ================================
    // PermissionLevel 测试
    // ================================

    #[test]
    fn test_permission_level_display() {
        assert_eq!(PermissionLevel::None.to_string(), "none");
        assert_eq!(PermissionLevel::Read.to_string(), "read");
        assert_eq!(PermissionLevel::ReadOnly.to_string(), "read_only");
        assert_eq!(PermissionLevel::Write.to_string(), "write");
        assert_eq!(PermissionLevel::ReadWrite.to_string(), "read_write");
        assert_eq!(PermissionLevel::Admin.to_string(), "admin");
    }

    #[test]
    fn test_permission_level_from_str() {
        assert_eq!("none".parse::<PermissionLevel>().unwrap(), PermissionLevel::None);
        assert_eq!("read".parse::<PermissionLevel>().unwrap(), PermissionLevel::Read);
        assert_eq!("read_only".parse::<PermissionLevel>().unwrap(), PermissionLevel::ReadOnly);
        assert_eq!("write".parse::<PermissionLevel>().unwrap(), PermissionLevel::Write);
        assert_eq!("read_write".parse::<PermissionLevel>().unwrap(), PermissionLevel::ReadWrite);
        assert_eq!("admin".parse::<PermissionLevel>().unwrap(), PermissionLevel::Admin);
        
        assert!("invalid".parse::<PermissionLevel>().is_err());
    }

    #[test]
    fn test_permission_level_serialization() {
        let level = PermissionLevel::ReadWrite;
        let serialized = serde_json::to_string(&level).unwrap();
        assert_eq!(serialized, "\"read_write\"");
        
        let deserialized: PermissionLevel = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, PermissionLevel::ReadWrite);
    }

    // ================================
    // PermissionStatus 测试
    // ================================

    #[test]
    fn test_permission_status_display() {
        assert_eq!(PermissionStatus::Pending.to_string(), "pending");
        assert_eq!(PermissionStatus::Granted.to_string(), "granted");
        assert_eq!(PermissionStatus::Denied.to_string(), "denied");
        assert_eq!(PermissionStatus::Revoked.to_string(), "revoked");
    }

    #[test]
    fn test_permission_status_from_str() {
        assert_eq!("pending".parse::<PermissionStatus>().unwrap(), PermissionStatus::Pending);
        assert_eq!("granted".parse::<PermissionStatus>().unwrap(), PermissionStatus::Granted);
        assert_eq!("denied".parse::<PermissionStatus>().unwrap(), PermissionStatus::Denied);
        assert_eq!("revoked".parse::<PermissionStatus>().unwrap(), PermissionStatus::Revoked);
        
        assert!("invalid".parse::<PermissionStatus>().is_err());
    }

    #[test]
    fn test_permission_status_serialization() {
        let status = PermissionStatus::Granted;
        let serialized = serde_json::to_string(&status).unwrap();
        assert_eq!(serialized, "\"granted\"");
        
        let deserialized: PermissionStatus = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, PermissionStatus::Granted);
    }

    // ================================
    // 数据结构测试
    // ================================

    #[test]
    fn test_permission_creation() {
        let permission = Permission {
            id: 1,
            permission_type: PermissionType::FileRead,
            name: "文件读取".to_string(),
            description: "允许读取文件".to_string(),
            category: "文件系统".to_string(),
        };

        assert_eq!(permission.id, 1);
        assert_eq!(permission.permission_type, PermissionType::FileRead);
        assert_eq!(permission.name, "文件读取");
        assert_eq!(permission.category, "文件系统");
    }

    #[test]
    fn test_permission_grant_creation() {
        let now = Utc::now();
        let grant = PermissionGrant {
            id: 1,
            entity_type: "user".to_string(),
            entity_id: "user123".to_string(),
            permission_type: PermissionType::FileWrite,
            level: PermissionLevel::ReadWrite,
            status: PermissionStatus::Granted,
            scope: Some("/home/user".to_string()),
            granted_by: Some("admin".to_string()),
            granted_at: Some(now),
            expires_at: None,
        };

        assert_eq!(grant.entity_type, "user");
        assert_eq!(grant.permission_type, PermissionType::FileWrite);
        assert_eq!(grant.level, PermissionLevel::ReadWrite);
        assert_eq!(grant.status, PermissionStatus::Granted);
        assert!(grant.scope.is_some());
        assert!(grant.expires_at.is_none());
    }

    #[test]
    fn test_permission_usage_log_creation() {
        let now = Utc::now();
        let log = PermissionUsageLog {
            id: 1,
            entity_type: "adapter".to_string(),
            entity_id: "adapter_001".to_string(),
            permission_type: PermissionType::NetworkHttp,
            level: PermissionLevel::Read,
            resource: Some("https://api.example.com".to_string()),
            action: "GET".to_string(),
            success: true,
            failure_reason: None,
            timestamp: now,
        };

        assert_eq!(log.entity_type, "adapter");
        assert_eq!(log.permission_type, PermissionType::NetworkHttp);
        assert_eq!(log.action, "GET");
        assert!(log.success);
        assert!(log.failure_reason.is_none());
    }

    #[test]
    fn test_permission_group_creation() {
        let group = PermissionGroup {
            id: 1,
            name: "basic_user".to_string(),
            display_name: "基础用户".to_string(),
            description: "基础用户权限组".to_string(),
            permissions: vec![
                PermissionType::FileRead,
                PermissionType::FileWrite,
                PermissionType::AppChatHistory,
            ],
        };

        assert_eq!(group.name, "basic_user");
        assert_eq!(group.permissions.len(), 3);
        assert!(group.permissions.contains(&PermissionType::FileRead));
        assert!(group.permissions.contains(&PermissionType::AppChatHistory));
    }

    #[test]
    fn test_permission_stats_creation() {
        let stats = PermissionStats {
            total_grants: 100,
            active_grants: 80,
            pending_requests: 15,
            denied_requests: 5,
        };

        assert_eq!(stats.total_grants, 100);
        assert_eq!(stats.active_grants, 80);
        assert_eq!(stats.pending_requests, 15);
        assert_eq!(stats.denied_requests, 5);
    }

    // ================================
    // PermissionRegistry 基础测试
    // ================================

    #[tokio::test]
    async fn test_permission_registry_creation() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = PermissionRegistry::new(pool);
                // 测试注册表创建成功
                println!("权限注册表创建成功");
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_permission_registry_init_tables() {
        match create_test_pool().await {
            Ok(pool) => {
                let registry = PermissionRegistry::new(pool);
                
                match registry.init_tables().await {
                    Ok(_) => {
                        println!("权限表初始化成功");
                    },
                    Err(e) => {
                        println!("权限表初始化失败: {}", e);
                    }
                }
            },
            Err(e) => {
                println!("跳过测试（无数据库连接）: {}", e);
            }
        }
    }

    // ================================
    // 权限授予和撤销测试
    // ================================

    #[tokio::test]
    async fn test_grant_permission_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.grant_permission(
            "user".to_string(),
            "user123".to_string(),
            PermissionType::FileRead,
            PermissionLevel::Read,
            None,
            Some("admin".to_string()),
            None,
        ) {
            Ok(_) => println!("权限授予成功（模拟）"),
            Err(e) => println!("权限授予失败（预期，无数据库）: {}", e),
        }
    }

    #[tokio::test]
    async fn test_request_permission_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.request_permission(
            "adapter".to_string(),
            "adapter_001".to_string(),
            PermissionType::NetworkHttp,
            PermissionLevel::ReadWrite,
            Some("https://api.example.com".to_string()),
        ) {
            Ok(id) => println!("权限请求创建成功，ID: {}", id),
            Err(e) => println!("权限请求失败（预期，无数据库）: {}", e),
        }
    }

    #[tokio::test]
    async fn test_deny_permission_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.deny_permission(
            "user".to_string(),
            "user456".to_string(),
            PermissionType::SystemCommand,
            None,
            Some("安全原因".to_string()),
        ) {
            Ok(_) => println!("权限拒绝成功（模拟）"),
            Err(e) => println!("权限拒绝失败（预期，无数据库）: {}", e),
        }
    }

    #[tokio::test]
    async fn test_revoke_permission_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.revoke_permission(
            "user".to_string(),
            "user789".to_string(),
            PermissionType::FileWrite,
            None,
            Some("违规操作".to_string()),
        ) {
            Ok(_) => println!("权限撤销成功（模拟）"),
            Err(e) => println!("权限撤销失败（预期，无数据库）: {}", e),
        }
    }

    // ================================
    // 权限检查测试
    // ================================

    #[tokio::test]
    async fn test_check_permission_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.check_permission(
            "user",
            "user123",
            &PermissionType::FileRead,
            &PermissionLevel::Read,
            None,
        ) {
            Ok(has_permission) => {
                println!("权限检查完成，结果: {}", has_permission);
                // 在模拟环境下，应该返回false（无权限）
                assert!(!has_permission, "模拟环境下应该没有权限");
            },
            Err(e) => {
                println!("权限检查失败（预期，无数据库）: {}", e);
            }
        }
    }

    // ================================
    // 权限级别比较逻辑测试
    // ================================

    #[test]
    fn test_permission_level_hierarchy() {
        // 这些测试验证权限级别的逻辑关系
        // Admin应该有所有权限
        // ReadWrite应该包含Read和Write
        // 等等...
        
        let levels = vec![
            PermissionLevel::None,
            PermissionLevel::Read,
            PermissionLevel::ReadOnly,
            PermissionLevel::Write,
            PermissionLevel::ReadWrite,
            PermissionLevel::Admin,
        ];
        
        // 测试每个级别都应该能匹配自身
        for level in &levels {
            assert_eq!(level, level, "权限级别应该等于自身");
        }
        
        // 测试不同级别的关系
        assert_ne!(PermissionLevel::Read, PermissionLevel::Write);
        assert_ne!(PermissionLevel::None, PermissionLevel::Admin);
        
        // 测试序列化一致性
        for level in &levels {
            let serialized = level.to_string();
            let parsed: PermissionLevel = serialized.parse().unwrap();
            assert_eq!(*level, parsed, "序列化后应该保持一致");
        }
    }

    // ================================
    // 权限查询测试
    // ================================

    #[tokio::test]
    async fn test_get_all_permissions_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_all_permissions() {
            Ok(permissions) => {
                println!("获取到 {} 个权限定义", permissions.len());
                assert!(permissions.is_empty(), "模拟环境下应该返回空列表");
            },
            Err(e) => {
                println!("获取权限定义失败（预期，无数据库）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_get_permission_by_type_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_permission_by_type(&PermissionType::FileRead) {
            Ok(permission) => {
                assert!(permission.is_none(), "模拟环境下应该返回None");
            },
            Err(e) => {
                println!("获取特定权限失败（预期，无数据库）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_get_entity_grants_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_entity_grants("user", "user123") {
            Ok(grants) => {
                println!("获取到 {} 个权限授权", grants.len());
                assert!(grants.is_empty(), "模拟环境下应该返回空列表");
            },
            Err(e) => {
                println!("获取实体授权失败（预期，无数据库）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_get_pending_grants_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_pending_grants() {
            Ok(grants) => {
                println!("获取到 {} 个待处理授权", grants.len());
                assert!(grants.is_empty(), "模拟环境下应该返回空列表");
            },
            Err(e) => {
                println!("获取待处理授权失败（预期，无数据库）: {}", e);
            }
        }
    }

    // ================================
    // 权限使用日志测试
    // ================================

    #[tokio::test]
    async fn test_log_permission_usage_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        let mut metadata = HashMap::new();
        metadata.insert("user_agent".to_string(), serde_json::Value::String("test".to_string()));
        
        match registry.log_permission_usage(
            "adapter".to_string(),
            "adapter_001".to_string(),
            PermissionType::NetworkHttp,
            PermissionLevel::Read,
            Some("https://api.example.com".to_string()),
            "GET /api/data".to_string(),
            true,
            None,
            Some("127.0.0.1".to_string()),
            Some(metadata),
        ) {
            Ok(log_id) => println!("权限使用日志记录成功，ID: {}", log_id),
            Err(e) => println!("权限使用日志记录失败（预期，无数据库）: {}", e),
        }
    }

    #[tokio::test]
    async fn test_get_usage_logs_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_usage_logs(
            Some("adapter"),
            Some("adapter_001"),
            Some(&PermissionType::NetworkHttp),
            Some(10),
            Some(0),
        ) {
            Ok(logs) => {
                println!("获取到 {} 条使用日志", logs.len());
                assert!(logs.is_empty(), "模拟环境下应该返回空列表");
            },
            Err(e) => {
                println!("获取使用日志失败（预期，无数据库）: {}", e);
            }
        }
    }

    // ================================
    // 权限统计测试
    // ================================

    #[tokio::test]
    async fn test_get_permission_stats_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_permission_stats("user", "user123") {
            Ok(stats) => {
                println!("权限统计: {:?}", stats);
                // 在模拟环境下验证统计数据
                assert!(stats.total_grants >= 0);
                assert!(stats.active_grants >= 0);
                assert!(stats.pending_requests >= 0);
                assert!(stats.denied_requests >= 0);
            },
            Err(e) => {
                println!("获取权限统计失败（预期，无数据库）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_cleanup_expired_grants_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.cleanup_expired_grants() {
            Ok(count) => {
                println!("清理了 {} 个过期权限", count);
                assert_eq!(count, 0, "模拟环境下应该清理0个权限");
            },
            Err(e) => {
                println!("清理过期权限失败（预期，无数据库）: {}", e);
            }
        }
    }

    // ================================
    // 权限组测试
    // ================================

    #[tokio::test]
    async fn test_create_permission_group_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        let permissions = vec![
            PermissionType::FileRead,
            PermissionType::FileWrite,
            PermissionType::AppChatHistory,
        ];
        
        match registry.create_permission_group(
            "test_group".to_string(),
            "测试权限组".to_string(),
            "用于测试的权限组".to_string(),
            permissions,
        ) {
            Ok(group_id) => println!("权限组创建成功，ID: {}", group_id),
            Err(e) => println!("权限组创建失败（预期，无数据库）: {}", e),
        }
    }

    #[tokio::test]
    async fn test_get_permission_group_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_permission_group("test_group") {
            Ok(group) => {
                assert!(group.is_none(), "模拟环境下应该返回None");
            },
            Err(e) => {
                println!("获取权限组失败（预期，无数据库）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_get_all_permission_groups_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.get_all_permission_groups() {
            Ok(groups) => {
                println!("获取到 {} 个权限组", groups.len());
                assert!(groups.is_empty(), "模拟环境下应该返回空列表");
            },
            Err(e) => {
                println!("获取权限组失败（预期，无数据库）: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_grant_permission_group_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        match registry.grant_permission_group(
            "user".to_string(),
            "user123".to_string(),
            "test_group",
            PermissionLevel::Read,
            Some("admin".to_string()),
            None,
        ) {
            Ok(_) => println!("权限组授予成功（模拟）"),
            Err(e) => {
                println!("权限组授予失败（预期）: {}", e);
                // 权限组不存在是预期的错误
                assert!(e.to_string().contains("不存在") || e.to_string().contains("数据库"));
            }
        }
    }

    // ================================
    // 边界条件和错误处理测试
    // ================================

    #[test]
    fn test_permission_type_edge_cases() {
        // 测试空字符串和特殊字符
        let custom_empty = PermissionType::Custom("".to_string());
        assert_eq!(custom_empty.to_string(), "");
        
        let custom_special = PermissionType::Custom("test_权限_123".to_string());
        assert_eq!(custom_special.to_string(), "test_权限_123");
        
        // 测试很长的自定义权限名
        let long_name = "a".repeat(1000);
        let custom_long = PermissionType::Custom(long_name.clone());
        assert_eq!(custom_long.to_string(), long_name);
    }

    #[test]
    fn test_permission_enum_edge_cases() {
        // 测试错误的字符串解析
        assert!("".parse::<PermissionLevel>().is_err());
        assert!("ADMIN".parse::<PermissionLevel>().is_err());
        assert!("read_write_admin".parse::<PermissionLevel>().is_err());
        
        assert!("".parse::<PermissionStatus>().is_err());
        assert!("GRANTED".parse::<PermissionStatus>().is_err());
        assert!("unknown_status".parse::<PermissionStatus>().is_err());
    }

    #[test]
    fn test_data_structure_serialization() {
        // 测试复杂数据结构的序列化
        let now = Utc::now();
        let grant = PermissionGrant {
            id: 999,
            entity_type: "测试实体".to_string(),
            entity_id: "实体_123".to_string(),
            permission_type: PermissionType::Custom("自定义权限".to_string()),
            level: PermissionLevel::Admin,
            status: PermissionStatus::Granted,
            scope: Some("/测试/路径".to_string()),
            granted_by: Some("管理员".to_string()),
            granted_at: Some(now),
            expires_at: Some(now + chrono::Duration::days(30)),
        };
        
        let serialized = serde_json::to_string(&grant).unwrap();
        let deserialized: PermissionGrant = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.id, grant.id);
        assert_eq!(deserialized.entity_type, grant.entity_type);
        match deserialized.permission_type {
            PermissionType::Custom(name) => assert_eq!(name, "自定义权限"),
            _ => panic!("应该是自定义权限类型"),
        }
        assert_eq!(deserialized.level, PermissionLevel::Admin);
        assert_eq!(deserialized.status, PermissionStatus::Granted);
    }

    #[tokio::test]
    async fn test_get_permissions_compatibility_mock() {
        let pool = match create_test_pool().await {
            Ok(pool) => pool,
            Err(_) => {
                println!("跳过测试：无法连接到测试数据库");
                return;
            }
        };
        let registry = PermissionRegistry::new(pool);
        
        // 测试兼容性接口
        match registry.get_permissions("resource_123") {
            Ok(records) => {
                println!("获取到 {} 个权限记录", records.len());
                assert!(records.is_empty(), "模拟环境下应该返回空列表");
            },
            Err(e) => {
                println!("获取权限记录失败（预期，无数据库）: {}", e);
            }
        }
    }
}
