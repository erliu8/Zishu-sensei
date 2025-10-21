//! 权限管理数据库模型
//!
//! 提供细粒度的权限控制系统，包括：
//! - 权限定义和类型管理
//! - 权限授权和撤销
//! - 权限使用记录和审计
//! - 权限组和角色管理
//! - 权限依赖和继承

use rusqlite::{Connection, OptionalExtension, params, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use chrono::{DateTime, Utc};
use tracing::{info, error, warn};
use crate::database::DbPool;

// ================================
// 权限类型定义
// ================================

/// 权限类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PermissionType {
    // 文件系统权限
    /// 读取文件
    FileRead,
    /// 写入文件
    FileWrite,
    /// 删除文件
    FileDelete,
    /// 执行文件
    FileExecute,
    /// 监听文件变化
    FileWatch,
    
    // 网络权限
    /// HTTP/HTTPS 请求
    NetworkHttp,
    /// WebSocket 连接
    NetworkWebSocket,
    /// 原始 Socket 访问
    NetworkSocket,
    /// DNS 查询
    NetworkDns,
    
    // 系统权限
    /// 执行系统命令
    SystemCommand,
    /// 访问环境变量
    SystemEnv,
    /// 访问系统信息
    SystemInfo,
    /// 剪贴板访问
    SystemClipboard,
    /// 通知权限
    SystemNotification,
    
    // 应用权限
    /// 访问数据库
    AppDatabase,
    /// 修改配置
    AppConfig,
    /// 访问聊天历史
    AppChatHistory,
    /// 访问用户数据
    AppUserData,
    /// 调用其他适配器
    AppAdapter,
    
    // 硬件权限
    /// 摄像头访问
    HardwareCamera,
    /// 麦克风访问
    HardwareMicrophone,
    /// 屏幕录制
    HardwareScreenCapture,
    /// GPS 定位
    HardwareLocation,
    
    // 高级权限
    /// 自启动
    AdvancedAutoStart,
    /// 后台运行
    AdvancedBackground,
    /// 管理员权限
    AdvancedAdmin,
    
    // 自定义权限
    Custom(String),
}

impl std::fmt::Display for PermissionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::FileRead => write!(f, "file_read"),
            Self::FileWrite => write!(f, "file_write"),
            Self::FileDelete => write!(f, "file_delete"),
            Self::FileExecute => write!(f, "file_execute"),
            Self::FileWatch => write!(f, "file_watch"),
            Self::NetworkHttp => write!(f, "network_http"),
            Self::NetworkWebSocket => write!(f, "network_websocket"),
            Self::NetworkSocket => write!(f, "network_socket"),
            Self::NetworkDns => write!(f, "network_dns"),
            Self::SystemCommand => write!(f, "system_command"),
            Self::SystemEnv => write!(f, "system_env"),
            Self::SystemInfo => write!(f, "system_info"),
            Self::SystemClipboard => write!(f, "system_clipboard"),
            Self::SystemNotification => write!(f, "system_notification"),
            Self::AppDatabase => write!(f, "app_database"),
            Self::AppConfig => write!(f, "app_config"),
            Self::AppChatHistory => write!(f, "app_chat_history"),
            Self::AppUserData => write!(f, "app_user_data"),
            Self::AppAdapter => write!(f, "app_adapter"),
            Self::HardwareCamera => write!(f, "hardware_camera"),
            Self::HardwareMicrophone => write!(f, "hardware_microphone"),
            Self::HardwareScreenCapture => write!(f, "hardware_screen_capture"),
            Self::HardwareLocation => write!(f, "hardware_location"),
            Self::AdvancedAutoStart => write!(f, "advanced_auto_start"),
            Self::AdvancedBackground => write!(f, "advanced_background"),
            Self::AdvancedAdmin => write!(f, "advanced_admin"),
            Self::Custom(s) => write!(f, "custom_{}", s),
        }
    }
}

impl std::str::FromStr for PermissionType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "file_read" => Ok(Self::FileRead),
            "file_write" => Ok(Self::FileWrite),
            "file_delete" => Ok(Self::FileDelete),
            "file_execute" => Ok(Self::FileExecute),
            "file_watch" => Ok(Self::FileWatch),
            "network_http" => Ok(Self::NetworkHttp),
            "network_websocket" => Ok(Self::NetworkWebSocket),
            "network_socket" => Ok(Self::NetworkSocket),
            "network_dns" => Ok(Self::NetworkDns),
            "system_command" => Ok(Self::SystemCommand),
            "system_env" => Ok(Self::SystemEnv),
            "system_info" => Ok(Self::SystemInfo),
            "system_clipboard" => Ok(Self::SystemClipboard),
            "system_notification" => Ok(Self::SystemNotification),
            "app_database" => Ok(Self::AppDatabase),
            "app_config" => Ok(Self::AppConfig),
            "app_chat_history" => Ok(Self::AppChatHistory),
            "app_user_data" => Ok(Self::AppUserData),
            "app_adapter" => Ok(Self::AppAdapter),
            "hardware_camera" => Ok(Self::HardwareCamera),
            "hardware_microphone" => Ok(Self::HardwareMicrophone),
            "hardware_screen_capture" => Ok(Self::HardwareScreenCapture),
            "hardware_location" => Ok(Self::HardwareLocation),
            "advanced_auto_start" => Ok(Self::AdvancedAutoStart),
            "advanced_background" => Ok(Self::AdvancedBackground),
            "advanced_admin" => Ok(Self::AdvancedAdmin),
            s if s.starts_with("custom_") => Ok(Self::Custom(s.trim_start_matches("custom_").to_string())),
            _ => Err(format!("未知的权限类型: {}", s)),
        }
    }
}

/// 权限级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum PermissionLevel {
    /// 无权限
    None = 0,
    /// 只读权限
    ReadOnly = 1,
    /// 读写权限
    ReadWrite = 2,
    /// 完全控制
    Full = 3,
}

impl std::fmt::Display for PermissionLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "none"),
            Self::ReadOnly => write!(f, "readonly"),
            Self::ReadWrite => write!(f, "readwrite"),
            Self::Full => write!(f, "full"),
        }
    }
}

impl std::str::FromStr for PermissionLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "none" => Ok(Self::None),
            "readonly" => Ok(Self::ReadOnly),
            "readwrite" => Ok(Self::ReadWrite),
            "full" => Ok(Self::Full),
            _ => Err(format!("未知的权限级别: {}", s)),
        }
    }
}

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PermissionStatus {
    /// 待审核
    Pending,
    /// 已授予
    Granted,
    /// 已拒绝
    Denied,
    /// 已撤销
    Revoked,
    /// 已过期
    Expired,
}

impl std::fmt::Display for PermissionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Granted => write!(f, "granted"),
            Self::Denied => write!(f, "denied"),
            Self::Revoked => write!(f, "revoked"),
            Self::Expired => write!(f, "expired"),
        }
    }
}

impl std::str::FromStr for PermissionStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "granted" => Ok(Self::Granted),
            "denied" => Ok(Self::Denied),
            "revoked" => Ok(Self::Revoked),
            "expired" => Ok(Self::Expired),
            _ => Err(format!("未知的权限状态: {}", s)),
        }
    }
}

// ================================
// 数据结构定义
// ================================

/// 权限定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    /// 权限ID
    pub id: i64,
    /// 权限名称
    pub name: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 权限级别
    pub level: PermissionLevel,
    /// 显示名称
    pub display_name: String,
    /// 描述
    pub description: String,
    /// 分类（filesystem, network, system等）
    pub category: String,
    /// 是否危险权限（需要用户明确授权）
    pub is_dangerous: bool,
    /// 是否可撤销
    pub is_revocable: bool,
    /// 依赖的其他权限
    pub dependencies: Vec<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
}

/// 权限授权记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGrant {
    /// 授权ID
    pub id: i64,
    /// 实体类型（adapter, user, system等）
    pub entity_type: String,
    /// 实体ID（适配器ID或用户ID）
    pub entity_id: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 权限级别
    pub level: PermissionLevel,
    /// 授权状态
    pub status: PermissionStatus,
    /// 授权范围（例如文件路径、URL模式等）
    pub scope: Option<String>,
    /// 授权时间
    pub granted_at: Option<DateTime<Utc>>,
    /// 授权过期时间
    pub expires_at: Option<DateTime<Utc>>,
    /// 授权者（user或system）
    pub granted_by: Option<String>,
    /// 拒绝/撤销原因
    pub reason: Option<String>,
    /// 最后修改时间
    pub updated_at: DateTime<Utc>,
    /// 创建时间（首次请求时间）
    pub created_at: DateTime<Utc>,
}

/// 权限使用记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionUsageLog {
    /// 日志ID
    pub id: i64,
    /// 实体类型
    pub entity_type: String,
    /// 实体ID
    pub entity_id: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 使用的级别
    pub level: PermissionLevel,
    /// 访问的资源（文件路径、URL等）
    pub resource: Option<String>,
    /// 操作描述
    pub action: String,
    /// 是否成功
    pub success: bool,
    /// 失败原因
    pub failure_reason: Option<String>,
    /// IP地址（如果适用）
    pub ip_address: Option<String>,
    /// 使用时间
    pub used_at: DateTime<Utc>,
    /// 额外元数据
    pub metadata: Option<String>,
}

/// 权限组
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGroup {
    /// 组ID
    pub id: i64,
    /// 组名
    pub name: String,
    /// 显示名称
    pub display_name: String,
    /// 描述
    pub description: String,
    /// 包含的权限列表
    pub permissions: Vec<PermissionType>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
}

/// 权限统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStats {
    /// 实体ID
    pub entity_id: String,
    /// 总授权数
    pub total_grants: i64,
    /// 活跃授权数
    pub active_grants: i64,
    /// 待审核数
    pub pending_grants: i64,
    /// 被拒绝数
    pub denied_grants: i64,
    /// 总使用次数
    pub total_usage: i64,
    /// 最后使用时间
    pub last_used_at: Option<DateTime<Utc>>,
    /// 按类型统计
    pub by_type: HashMap<String, i64>,
}

// ================================
// 权限注册表
// ================================

/// 权限注册表
pub struct PermissionRegistry {
    pool: DbPool,
}

impl PermissionRegistry {
    /// 创建新的权限注册表
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub fn init_tables(&self) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        // 权限定义表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                permission_type TEXT NOT NULL,
                level TEXT NOT NULL DEFAULT 'readonly',
                display_name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                is_dangerous INTEGER NOT NULL DEFAULT 0,
                is_revocable INTEGER NOT NULL DEFAULT 1,
                dependencies TEXT,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 权限授权表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS permission_grants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                permission_type TEXT NOT NULL,
                level TEXT NOT NULL DEFAULT 'readonly',
                status TEXT NOT NULL DEFAULT 'pending',
                scope TEXT,
                granted_at INTEGER,
                expires_at INTEGER,
                granted_by TEXT,
                reason TEXT,
                updated_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(entity_type, entity_id, permission_type, scope)
            )",
            [],
        )?;

        // 权限使用日志表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS permission_usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                permission_type TEXT NOT NULL,
                level TEXT NOT NULL,
                resource TEXT,
                action TEXT NOT NULL,
                success INTEGER NOT NULL,
                failure_reason TEXT,
                ip_address TEXT,
                used_at INTEGER NOT NULL,
                metadata TEXT
            )",
            [],
        )?;

        // 权限组表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS permission_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                description TEXT NOT NULL,
                permissions TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_permissions_type ON permissions(permission_type)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_grants_entity ON permission_grants(entity_type, entity_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_grants_status ON permission_grants(status)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_grants_expires ON permission_grants(expires_at)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_entity ON permission_usage_logs(entity_type, entity_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_used_at ON permission_usage_logs(used_at)",
            [],
        )?;

        info!("权限管理数据库表初始化完成");
        
        // 初始化默认权限定义
        self.init_default_permissions()?;
        
        Ok(())
    }

    /// 初始化默认权限定义
    fn init_default_permissions(&self) -> SqliteResult<()> {
        let default_permissions = vec![
            ("file_read", PermissionType::FileRead, "文件读取", "读取本地文件", "filesystem", false),
            ("file_write", PermissionType::FileWrite, "文件写入", "创建或修改文件", "filesystem", true),
            ("file_delete", PermissionType::FileDelete, "文件删除", "删除本地文件", "filesystem", true),
            ("file_execute", PermissionType::FileExecute, "文件执行", "执行可执行文件", "filesystem", true),
            ("file_watch", PermissionType::FileWatch, "文件监听", "监听文件系统变化", "filesystem", false),
            ("network_http", PermissionType::NetworkHttp, "HTTP请求", "发起HTTP/HTTPS请求", "network", false),
            ("network_websocket", PermissionType::NetworkWebSocket, "WebSocket", "建立WebSocket连接", "network", false),
            ("network_socket", PermissionType::NetworkSocket, "原始Socket", "访问原始网络Socket", "network", true),
            ("network_dns", PermissionType::NetworkDns, "DNS查询", "执行DNS查询", "network", false),
            ("system_command", PermissionType::SystemCommand, "系统命令", "执行系统命令", "system", true),
            ("system_env", PermissionType::SystemEnv, "环境变量", "读取环境变量", "system", false),
            ("system_info", PermissionType::SystemInfo, "系统信息", "获取系统信息", "system", false),
            ("system_clipboard", PermissionType::SystemClipboard, "剪贴板", "访问系统剪贴板", "system", false),
            ("system_notification", PermissionType::SystemNotification, "通知", "显示系统通知", "system", false),
            ("app_database", PermissionType::AppDatabase, "数据库访问", "访问应用数据库", "application", true),
            ("app_config", PermissionType::AppConfig, "配置修改", "修改应用配置", "application", true),
            ("app_chat_history", PermissionType::AppChatHistory, "聊天历史", "访问聊天历史记录", "application", true),
            ("app_user_data", PermissionType::AppUserData, "用户数据", "访问用户个人数据", "application", true),
            ("app_adapter", PermissionType::AppAdapter, "适配器调用", "调用其他适配器", "application", false),
            ("hardware_camera", PermissionType::HardwareCamera, "摄像头", "访问摄像头", "hardware", true),
            ("hardware_microphone", PermissionType::HardwareMicrophone, "麦克风", "访问麦克风", "hardware", true),
            ("hardware_screen_capture", PermissionType::HardwareScreenCapture, "屏幕录制", "录制屏幕内容", "hardware", true),
            ("hardware_location", PermissionType::HardwareLocation, "地理位置", "获取地理位置", "hardware", true),
            ("advanced_auto_start", PermissionType::AdvancedAutoStart, "开机自启", "开机自动启动", "advanced", true),
            ("advanced_background", PermissionType::AdvancedBackground, "后台运行", "在后台持续运行", "advanced", false),
            ("advanced_admin", PermissionType::AdvancedAdmin, "管理员权限", "需要管理员权限", "advanced", true),
        ];

        for (name, ptype, display, desc, category, dangerous) in default_permissions {
            // 检查是否已存在
            let conn = self.pool.get()
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            let exists: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM permissions WHERE name = ?1",
                params![name],
                |row| row.get(0),
            ).unwrap_or(false);

            if !exists {
                self.add_permission(
                    name.to_string(),
                    ptype,
                    PermissionLevel::ReadOnly,
                    display.to_string(),
                    desc.to_string(),
                    category.to_string(),
                    dangerous,
                    true,
                    vec![],
                )?;
            }
        }

        info!("默认权限定义初始化完成");
        Ok(())
    }

    // ================================
    // 权限定义管理
    // ================================

    /// 添加权限定义
    pub fn add_permission(
        &self,
        name: String,
        permission_type: PermissionType,
        level: PermissionLevel,
        display_name: String,
        description: String,
        category: String,
        is_dangerous: bool,
        is_revocable: bool,
        dependencies: Vec<String>,
    ) -> SqliteResult<i64> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();
        let deps_json = serde_json::to_string(&dependencies).unwrap_or_default();

        conn.execute(
            "INSERT INTO permissions (name, permission_type, level, display_name, description, category, 
                                     is_dangerous, is_revocable, dependencies, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                name,
                permission_type.to_string(),
                level.to_string(),
                display_name,
                description,
                category,
                is_dangerous as i32,
                is_revocable as i32,
                deps_json,
                now,
            ],
        )?;

        let id = conn.last_insert_rowid();
        info!("添加权限定义: {} (ID: {})", name, id);
        Ok(id)
    }

    /// 获取所有权限定义
    pub fn get_all_permissions(&self) -> SqliteResult<Vec<Permission>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, permission_type, level, display_name, description, category,
                    is_dangerous, is_revocable, dependencies, created_at
             FROM permissions
             ORDER BY category, name"
        )?;

        let permissions = stmt.query_map([], |row| {
            let deps_json: String = row.get(9)?;
            let dependencies: Vec<String> = serde_json::from_str(&deps_json).unwrap_or_default();

            Ok(Permission {
                id: row.get(0)?,
                name: row.get(1)?,
                permission_type: row.get::<_, String>(2)?.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                level: row.get::<_, String>(3)?.parse().unwrap_or(PermissionLevel::None),
                display_name: row.get(4)?,
                description: row.get(5)?,
                category: row.get(6)?,
                is_dangerous: row.get::<_, i32>(7)? != 0,
                is_revocable: row.get::<_, i32>(8)? != 0,
                dependencies,
                created_at: DateTime::from_timestamp(row.get(10)?, 0).unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(permissions)
    }

    /// 获取权限定义（按类型）
    pub fn get_permission_by_type(&self, permission_type: &PermissionType) -> SqliteResult<Option<Permission>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let result = conn.query_row(
            "SELECT id, name, permission_type, level, display_name, description, category,
                    is_dangerous, is_revocable, dependencies, created_at
             FROM permissions
             WHERE permission_type = ?1",
            params![permission_type.to_string()],
            |row| {
                let deps_json: String = row.get(9)?;
                let dependencies: Vec<String> = serde_json::from_str(&deps_json).unwrap_or_default();

                Ok(Permission {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    permission_type: row.get::<_, String>(2)?.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                    level: row.get::<_, String>(3)?.parse().unwrap_or(PermissionLevel::None),
                    display_name: row.get(4)?,
                    description: row.get(5)?,
                    category: row.get(6)?,
                    is_dangerous: row.get::<_, i32>(7)? != 0,
                    is_revocable: row.get::<_, i32>(8)? != 0,
                    dependencies,
                    created_at: DateTime::from_timestamp(row.get(10)?, 0).unwrap_or_default(),
                })
            },
        );

        match result {
            Ok(perm) => Ok(Some(perm)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 获取分类的权限列表
    pub fn get_permissions_by_category(&self, category: &str) -> SqliteResult<Vec<Permission>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, permission_type, level, display_name, description, category,
                    is_dangerous, is_revocable, dependencies, created_at
             FROM permissions
             WHERE category = ?1
             ORDER BY name"
        )?;

        let permissions = stmt.query_map(params![category], |row| {
            let deps_json: String = row.get(9)?;
            let dependencies: Vec<String> = serde_json::from_str(&deps_json).unwrap_or_default();

            Ok(Permission {
                id: row.get(0)?,
                name: row.get(1)?,
                permission_type: row.get::<_, String>(2)?.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                level: row.get::<_, String>(3)?.parse().unwrap_or(PermissionLevel::None),
                display_name: row.get(4)?,
                description: row.get(5)?,
                category: row.get(6)?,
                is_dangerous: row.get::<_, i32>(7)? != 0,
                is_revocable: row.get::<_, i32>(8)? != 0,
                dependencies,
                created_at: DateTime::from_timestamp(row.get(10)?, 0).unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(permissions)
    }

    // ================================
    // 权限授权管理
    // ================================

    /// 请求权限
    pub fn request_permission(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        level: PermissionLevel,
        scope: Option<String>,
    ) -> SqliteResult<i64> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();

        // 检查是否已存在
        let existing: Option<i64> = conn.query_row(
            "SELECT id FROM permission_grants 
             WHERE entity_type = ?1 AND entity_id = ?2 AND permission_type = ?3 
             AND (scope IS ?4 OR (?4 IS NULL AND scope IS NULL))",
            params![&entity_type, &entity_id, permission_type.to_string(), &scope],
            |row| row.get(0),
        ).optional()?;

        if let Some(id) = existing {
            // 更新状态为待审核
            conn.execute(
                "UPDATE permission_grants 
                 SET status = 'pending', level = ?1, updated_at = ?2
                 WHERE id = ?3",
                params![level.to_string(), now, id],
            )?;
            info!("更新权限请求: {} - {} (ID: {})", entity_id, permission_type, id);
            Ok(id)
        } else {
            // 创建新的权限请求
            conn.execute(
                "INSERT INTO permission_grants (entity_type, entity_id, permission_type, level, status, 
                                                scope, updated_at, created_at)
                 VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7)",
                params![
                    entity_type,
                    entity_id,
                    permission_type.to_string(),
                    level.to_string(),
                    scope,
                    now,
                    now,
                ],
            )?;

            let id = conn.last_insert_rowid();
            info!("创建权限请求: {} - {} (ID: {})", entity_id, permission_type, id);
            Ok(id)
        }
    }

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
    ) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();
        let expires_ts = expires_at.map(|dt| dt.timestamp());

        conn.execute(
            "INSERT OR REPLACE INTO permission_grants 
             (entity_type, entity_id, permission_type, level, status, scope, 
              granted_at, expires_at, granted_by, updated_at, created_at)
             VALUES (?1, ?2, ?3, ?4, 'granted', ?5, ?6, ?7, ?8, ?9, 
                     COALESCE((SELECT created_at FROM permission_grants 
                              WHERE entity_type = ?1 AND entity_id = ?2 AND permission_type = ?3 
                              AND (scope IS ?5 OR (?5 IS NULL AND scope IS NULL))), ?9))",
            params![
                entity_type,
                entity_id,
                permission_type.to_string(),
                level.to_string(),
                scope,
                now,
                expires_ts,
                granted_by,
                now,
            ],
        )?;

        info!("授予权限: {} - {}", entity_id, permission_type);
        Ok(())
    }

    /// 拒绝权限
    pub fn deny_permission(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        scope: Option<String>,
        reason: Option<String>,
    ) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();

        conn.execute(
            "UPDATE permission_grants 
             SET status = 'denied', reason = ?1, updated_at = ?2
             WHERE entity_type = ?3 AND entity_id = ?4 AND permission_type = ?5 
             AND (scope IS ?6 OR (?6 IS NULL AND scope IS NULL))",
            params![reason, now, entity_type, entity_id, permission_type.to_string(), scope],
        )?;

        info!("拒绝权限: {} - {}", entity_id, permission_type);
        Ok(())
    }

    /// 撤销权限
    pub fn revoke_permission(
        &self,
        entity_type: String,
        entity_id: String,
        permission_type: PermissionType,
        scope: Option<String>,
        reason: Option<String>,
    ) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();

        conn.execute(
            "UPDATE permission_grants 
             SET status = 'revoked', reason = ?1, updated_at = ?2
             WHERE entity_type = ?3 AND entity_id = ?4 AND permission_type = ?5 
             AND (scope IS ?6 OR (?6 IS NULL AND scope IS NULL))",
            params![reason, now, entity_type, entity_id, permission_type.to_string(), scope],
        )?;

        info!("撤销权限: {} - {}", entity_id, permission_type);
        Ok(())
    }

    /// 检查权限
    pub fn check_permission(
        &self,
        entity_type: &str,
        entity_id: &str,
        permission_type: &PermissionType,
        level: &PermissionLevel,
        scope: Option<&str>,
    ) -> SqliteResult<bool> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();

        // 查找匹配的授权记录
        let result: Option<(String, String)> = conn.query_row(
            "SELECT status, level FROM permission_grants 
             WHERE entity_type = ?1 AND entity_id = ?2 AND permission_type = ?3 
             AND status = 'granted'
             AND (expires_at IS NULL OR expires_at > ?4)
             AND (scope IS NULL OR scope = ?5 OR ?5 IS NULL)",
            params![entity_type, entity_id, permission_type.to_string(), now, scope],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).optional()?;

        if let Some((status, granted_level)) = result {
            if status == "granted" {
                let granted_level: PermissionLevel = granted_level.parse().unwrap_or(PermissionLevel::None);
                // 检查级别是否足够
                return Ok(granted_level >= *level);
            }
        }

        Ok(false)
    }

    /// 获取实体的所有权限授权
    pub fn get_entity_grants(
        &self,
        entity_type: &str,
        entity_id: &str,
    ) -> SqliteResult<Vec<PermissionGrant>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, entity_type, entity_id, permission_type, level, status, scope,
                    granted_at, expires_at, granted_by, reason, updated_at, created_at
             FROM permission_grants
             WHERE entity_type = ?1 AND entity_id = ?2
             ORDER BY created_at DESC"
        )?;

        let grants = stmt.query_map(params![entity_type, entity_id], |row| {
            Ok(PermissionGrant {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                permission_type: row.get::<_, String>(3)?.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                level: row.get::<_, String>(4)?.parse().unwrap_or(PermissionLevel::None),
                status: row.get::<_, String>(5)?.parse().unwrap_or(PermissionStatus::Pending),
                scope: row.get(6)?,
                granted_at: row.get::<_, Option<i64>>(7)?
                    .and_then(|ts| DateTime::from_timestamp(ts, 0)),
                expires_at: row.get::<_, Option<i64>>(8)?
                    .and_then(|ts| DateTime::from_timestamp(ts, 0)),
                granted_by: row.get(9)?,
                reason: row.get(10)?,
                updated_at: DateTime::from_timestamp(row.get(11)?, 0).unwrap_or_default(),
                created_at: DateTime::from_timestamp(row.get(12)?, 0).unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(grants)
    }

    /// 获取待审核的权限请求
    pub fn get_pending_grants(&self) -> SqliteResult<Vec<PermissionGrant>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, entity_type, entity_id, permission_type, level, status, scope,
                    granted_at, expires_at, granted_by, reason, updated_at, created_at
             FROM permission_grants
             WHERE status = 'pending'
             ORDER BY created_at ASC"
        )?;

        let grants = stmt.query_map([], |row| {
            Ok(PermissionGrant {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                permission_type: row.get::<_, String>(3)?.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                level: row.get::<_, String>(4)?.parse().unwrap_or(PermissionLevel::None),
                status: row.get::<_, String>(5)?.parse().unwrap_or(PermissionStatus::Pending),
                scope: row.get(6)?,
                granted_at: row.get::<_, Option<i64>>(7)?
                    .and_then(|ts| DateTime::from_timestamp(ts, 0)),
                expires_at: row.get::<_, Option<i64>>(8)?
                    .and_then(|ts| DateTime::from_timestamp(ts, 0)),
                granted_by: row.get(9)?,
                reason: row.get(10)?,
                updated_at: DateTime::from_timestamp(row.get(11)?, 0).unwrap_or_default(),
                created_at: DateTime::from_timestamp(row.get(12)?, 0).unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(grants)
    }

    /// 清理过期的权限授权
    pub fn cleanup_expired_grants(&self) -> SqliteResult<usize> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();

        let count = conn.execute(
            "UPDATE permission_grants 
             SET status = 'expired'
             WHERE status = 'granted' AND expires_at IS NOT NULL AND expires_at <= ?1",
            params![now],
        )?;

        if count > 0 {
            info!("清理了 {} 个过期的权限授权", count);
        }

        Ok(count)
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
    ) -> SqliteResult<i64> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();
        let metadata_json = metadata.map(|m| serde_json::to_string(&m).ok()).flatten();

        conn.execute(
            "INSERT INTO permission_usage_logs 
             (entity_type, entity_id, permission_type, level, resource, action, 
              success, failure_reason, ip_address, used_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                entity_type,
                entity_id,
                permission_type.to_string(),
                level.to_string(),
                resource,
                action,
                success as i32,
                failure_reason,
                ip_address,
                now,
                metadata_json,
            ],
        )?;

        let id = conn.last_insert_rowid();
        Ok(id)
    }

    /// 获取权限使用日志
    pub fn get_usage_logs(
        &self,
        entity_type: Option<&str>,
        entity_id: Option<&str>,
        permission_type: Option<&PermissionType>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> SqliteResult<Vec<PermissionUsageLog>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut query = String::from(
            "SELECT id, entity_type, entity_id, permission_type, level, resource, action,
                    success, failure_reason, ip_address, used_at, metadata
             FROM permission_usage_logs
             WHERE 1=1"
        );

        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        if let Some(et) = entity_type {
            query.push_str(" AND entity_type = ?");
            params_vec.push(Box::new(et.to_string()));
        }

        if let Some(ei) = entity_id {
            query.push_str(" AND entity_id = ?");
            params_vec.push(Box::new(ei.to_string()));
        }

        if let Some(pt) = permission_type {
            query.push_str(" AND permission_type = ?");
            params_vec.push(Box::new(pt.to_string()));
        }

        query.push_str(" ORDER BY used_at DESC");

        if let Some(l) = limit {
            query.push_str(" LIMIT ?");
            params_vec.push(Box::new(l));
        }

        if let Some(o) = offset {
            query.push_str(" OFFSET ?");
            params_vec.push(Box::new(o));
        }

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| &**b as &dyn rusqlite::ToSql).collect();

        let mut stmt = conn.prepare(&query)?;

        let logs = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(PermissionUsageLog {
                id: row.get(0)?,
                entity_type: row.get(1)?,
                entity_id: row.get(2)?,
                permission_type: row.get::<_, String>(3)?.parse().unwrap_or(PermissionType::Custom("unknown".to_string())),
                level: row.get::<_, String>(4)?.parse().unwrap_or(PermissionLevel::None),
                resource: row.get(5)?,
                action: row.get(6)?,
                success: row.get::<_, i32>(7)? != 0,
                failure_reason: row.get(8)?,
                ip_address: row.get(9)?,
                used_at: DateTime::from_timestamp(row.get(10)?, 0).unwrap_or_default(),
                metadata: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(logs)
    }

    /// 获取权限统计信息
    pub fn get_permission_stats(&self, entity_type: &str, entity_id: &str) -> SqliteResult<PermissionStats> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        let total_grants: i64 = conn.query_row(
            "SELECT COUNT(*) FROM permission_grants WHERE entity_type = ?1 AND entity_id = ?2",
            params![entity_type, entity_id],
            |row| row.get(0),
        )?;

        let active_grants: i64 = conn.query_row(
            "SELECT COUNT(*) FROM permission_grants 
             WHERE entity_type = ?1 AND entity_id = ?2 AND status = 'granted'",
            params![entity_type, entity_id],
            |row| row.get(0),
        )?;

        let pending_grants: i64 = conn.query_row(
            "SELECT COUNT(*) FROM permission_grants 
             WHERE entity_type = ?1 AND entity_id = ?2 AND status = 'pending'",
            params![entity_type, entity_id],
            |row| row.get(0),
        )?;

        let denied_grants: i64 = conn.query_row(
            "SELECT COUNT(*) FROM permission_grants 
             WHERE entity_type = ?1 AND entity_id = ?2 AND status = 'denied'",
            params![entity_type, entity_id],
            |row| row.get(0),
        )?;

        let total_usage: i64 = conn.query_row(
            "SELECT COUNT(*) FROM permission_usage_logs WHERE entity_type = ?1 AND entity_id = ?2",
            params![entity_type, entity_id],
            |row| row.get(0),
        )?;

        let last_used_at: Option<DateTime<Utc>> = conn.query_row(
            "SELECT MAX(used_at) FROM permission_usage_logs WHERE entity_type = ?1 AND entity_id = ?2",
            params![entity_type, entity_id],
            |row| row.get::<_, Option<i64>>(0).map(|ts| ts.and_then(|t| DateTime::from_timestamp(t, 0))),
        )?;

        // 按类型统计
        let mut stmt = conn.prepare(
            "SELECT permission_type, COUNT(*) FROM permission_usage_logs 
             WHERE entity_type = ?1 AND entity_id = ?2 
             GROUP BY permission_type"
        )?;

        let by_type: HashMap<String, i64> = stmt.query_map(params![entity_type, entity_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?
        .filter_map(Result::ok)
        .collect();

        Ok(PermissionStats {
            entity_id: entity_id.to_string(),
            total_grants,
            active_grants,
            pending_grants,
            denied_grants,
            total_usage,
            last_used_at,
            by_type,
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
    ) -> SqliteResult<i64> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let now = Utc::now().timestamp();
        let perms_json = serde_json::to_string(&permissions).unwrap_or_default();

        conn.execute(
            "INSERT INTO permission_groups (name, display_name, description, permissions, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, display_name, description, perms_json, now],
        )?;

        let id = conn.last_insert_rowid();
        info!("创建权限组: {} (ID: {})", name, id);
        Ok(id)
    }

    /// 获取权限组
    pub fn get_permission_group(&self, name: &str) -> SqliteResult<Option<PermissionGroup>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let result = conn.query_row(
            "SELECT id, name, display_name, description, permissions, created_at
             FROM permission_groups
             WHERE name = ?1",
            params![name],
            |row| {
                let perms_json: String = row.get(4)?;
                let permissions: Vec<PermissionType> = serde_json::from_str(&perms_json).unwrap_or_default();

                Ok(PermissionGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    display_name: row.get(2)?,
                    description: row.get(3)?,
                    permissions,
                    created_at: DateTime::from_timestamp(row.get(5)?, 0).unwrap_or_default(),
                })
            },
        );

        match result {
            Ok(group) => Ok(Some(group)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 获取所有权限组
    pub fn get_all_permission_groups(&self) -> SqliteResult<Vec<PermissionGroup>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, display_name, description, permissions, created_at
             FROM permission_groups
             ORDER BY name"
        )?;

        let groups = stmt.query_map([], |row| {
            let perms_json: String = row.get(4)?;
            let permissions: Vec<PermissionType> = serde_json::from_str(&perms_json).unwrap_or_default();

            Ok(PermissionGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                display_name: row.get(2)?,
                description: row.get(3)?,
                permissions,
                created_at: DateTime::from_timestamp(row.get(5)?, 0).unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(groups)
    }

    /// 批量授予权限组
    pub fn grant_permission_group(
        &self,
        entity_type: String,
        entity_id: String,
        group_name: &str,
        level: PermissionLevel,
        granted_by: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> SqliteResult<()> {
        let group = self.get_permission_group(group_name)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

        for permission_type in group.permissions {
            self.grant_permission(
                entity_type.clone(),
                entity_id.clone(),
                permission_type,
                level.clone(),
                None,
                granted_by.clone(),
                expires_at,
            )?;
        }

        info!("授予权限组 {} 给 {}", group_name, entity_id);
        Ok(())
    }
}

