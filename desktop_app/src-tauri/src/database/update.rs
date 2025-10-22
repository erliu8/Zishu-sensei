//! # 应用更新数据库模块 (PostgreSQL)
//! 
//! 提供应用更新信息、版本历史和更新配置的数据库存储和管理功能

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use tracing::{info, error, warn, debug};
use crate::database::DbPool;
use tokio::runtime::Handle;

// ================================
// 数据结构定义
// ================================

/// 更新信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateInfo {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub update_type: Option<UpdateType>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub changelog: String,
    #[serde(default)]
    pub release_notes: String,
    #[serde(default)]
    pub release_date: Option<String>,
    #[serde(default)]
    pub download_url: Option<String>,
    #[serde(default)]
    pub file_size: Option<i64>,
    #[serde(default)]
    pub file_hash: Option<String>,
    #[serde(default)]
    pub is_mandatory: bool,
    #[serde(default)]
    pub is_prerelease: bool,
    #[serde(default)]
    pub min_version: Option<String>,
    #[serde(default)]
    pub target_platform: Option<String>,
    #[serde(default)]
    pub target_arch: Option<String>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub status: UpdateStatus,
    #[serde(default)]
    pub download_progress: f64,
    #[serde(default)]
    pub install_progress: f64,
    #[serde(default)]
    pub error_message: Option<String>,
    #[serde(default)]
    pub retry_count: i32,
}

/// 更新配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfig {
    pub auto_check: bool,
    pub auto_check_enabled: bool,
    pub check_interval: i64,
    pub check_interval_hours: i64,
    pub auto_download: bool,
    pub auto_install: bool,
    pub backup_before_update: bool,
    pub include_prerelease: bool,
    pub max_backup_count: i32,
    pub last_check_time: Option<DateTime<Utc>>,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            auto_check: true,
            auto_check_enabled: true,
            check_interval: 86400, // 24 hours
            check_interval_hours: 24,
            auto_download: false,
            auto_install: false,
            backup_before_update: true,
            include_prerelease: false,
            max_backup_count: 5,
            last_check_time: None,
        }
    }
}

/// 版本历史
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionHistory {
    pub id: Option<i64>,
    pub version: String,
    pub installed_at: i64,
    pub release_notes: String,
    pub notes: String,
    pub is_rollback: bool,
    pub install_source: String,
}

/// 更新状态
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    #[default]
    Pending,
    Available,
    Downloading,
    Downloaded,
    Installing,
    Installed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for UpdateStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UpdateStatus::Pending => write!(f, "pending"),
            UpdateStatus::Available => write!(f, "available"),
            UpdateStatus::Downloading => write!(f, "downloading"),
            UpdateStatus::Downloaded => write!(f, "downloaded"),
            UpdateStatus::Installing => write!(f, "installing"),
            UpdateStatus::Installed => write!(f, "installed"),
            UpdateStatus::Failed => write!(f, "failed"),
            UpdateStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for UpdateStatus {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(UpdateStatus::Pending),
            "available" => Ok(UpdateStatus::Available),
            "downloading" => Ok(UpdateStatus::Downloading),
            "downloaded" => Ok(UpdateStatus::Downloaded),
            "installing" => Ok(UpdateStatus::Installing),
            "installed" => Ok(UpdateStatus::Installed),
            "failed" => Ok(UpdateStatus::Failed),
            "cancelled" => Ok(UpdateStatus::Cancelled),
            _ => Err(format!("无效的更新状态: {}", s)),
        }
    }
}

/// 更新类型
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum UpdateType {
    #[default]
    Major,
    Minor,
    Patch,
    Hotfix,
}

impl std::fmt::Display for UpdateType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UpdateType::Major => write!(f, "major"),
            UpdateType::Minor => write!(f, "minor"),
            UpdateType::Patch => write!(f, "patch"),
            UpdateType::Hotfix => write!(f, "hotfix"),
        }
    }
}

impl std::str::FromStr for UpdateType {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "major" => Ok(UpdateType::Major),
            "minor" => Ok(UpdateType::Minor),
            "patch" => Ok(UpdateType::Patch),
            "hotfix" => Ok(UpdateType::Hotfix),
            _ => Err(format!("无效的更新类型: {}", s)),
        }
    }
}

// ================================
// 更新注册表
// ================================

pub struct UpdateRegistry {
    pool: DbPool,
}

impl UpdateRegistry {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建更新信息表
        client.execute(
            "CREATE TABLE IF NOT EXISTS update_info (
                version TEXT PRIMARY KEY,
                update_type TEXT,
                title TEXT NOT NULL,
                description TEXT,
                changelog TEXT,
                release_notes TEXT,
                release_date TEXT,
                download_url TEXT,
                file_size BIGINT,
                file_hash TEXT,
                is_mandatory BOOLEAN NOT NULL DEFAULT false,
                is_prerelease BOOLEAN NOT NULL DEFAULT false,
                min_version TEXT,
                target_platform TEXT,
                target_arch TEXT,
                status TEXT NOT NULL,
                download_progress DOUBLE PRECISION DEFAULT 0.0,
                install_progress DOUBLE PRECISION DEFAULT 0.0,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 创建更新配置表
        client.execute(
            "CREATE TABLE IF NOT EXISTS update_config (
                id INTEGER PRIMARY KEY DEFAULT 1,
                auto_check BOOLEAN NOT NULL DEFAULT true,
                auto_check_enabled BOOLEAN NOT NULL DEFAULT true,
                check_interval BIGINT NOT NULL DEFAULT 86400,
                check_interval_hours BIGINT NOT NULL DEFAULT 24,
                auto_download BOOLEAN NOT NULL DEFAULT false,
                auto_install BOOLEAN NOT NULL DEFAULT false,
                backup_before_update BOOLEAN NOT NULL DEFAULT true,
                include_prerelease BOOLEAN NOT NULL DEFAULT false,
                max_backup_count INTEGER NOT NULL DEFAULT 5,
                last_check_time TIMESTAMPTZ,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;

        // 创建版本历史表
        client.execute(
            "CREATE TABLE IF NOT EXISTS version_history (
                id BIGSERIAL PRIMARY KEY,
                version TEXT NOT NULL,
                installed_at BIGINT NOT NULL,
                release_notes TEXT,
                notes TEXT,
                is_rollback BOOLEAN NOT NULL DEFAULT false,
                install_source TEXT NOT NULL
            )",
            &[],
        ).await?;

        // 创建索引
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_update_info_status ON update_info(status)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_update_info_created_at ON update_info(created_at)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_version_history_version ON version_history(version)",
            &[],
        ).await?;

        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_version_history_installed_at ON version_history(installed_at)",
            &[],
        ).await?;

        info!("更新数据库表初始化完成");
        Ok(())
    }

    // ================================
    // 更新信息管理
    // ================================

    /// 保存更新信息
    pub async fn save_update_info_async(&self, info: &UpdateInfo) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let now = Utc::now().timestamp();

        let update_type_str = info.update_type.as_ref().map(|t| t.to_string());
        let status_str = info.status.to_string();

        client.execute(
            "INSERT INTO update_info (
                version, update_type, title, description, changelog, release_notes,
                release_date, download_url, file_size, file_hash, is_mandatory,
                is_prerelease, min_version, target_platform, target_arch, status,
                download_progress, install_progress, error_message, retry_count,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            ON CONFLICT (version) DO UPDATE SET
                update_type = EXCLUDED.update_type,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                changelog = EXCLUDED.changelog,
                release_notes = EXCLUDED.release_notes,
                release_date = EXCLUDED.release_date,
                download_url = EXCLUDED.download_url,
                file_size = EXCLUDED.file_size,
                file_hash = EXCLUDED.file_hash,
                is_mandatory = EXCLUDED.is_mandatory,
                is_prerelease = EXCLUDED.is_prerelease,
                min_version = EXCLUDED.min_version,
                target_platform = EXCLUDED.target_platform,
                target_arch = EXCLUDED.target_arch,
                status = EXCLUDED.status,
                download_progress = EXCLUDED.download_progress,
                install_progress = EXCLUDED.install_progress,
                error_message = EXCLUDED.error_message,
                retry_count = EXCLUDED.retry_count,
                updated_at = EXCLUDED.updated_at",
            &[
                &info.version, &update_type_str, &info.title, &info.description,
                &info.changelog, &info.release_notes, &info.release_date,
                &info.download_url, &info.file_size, &info.file_hash,
                &info.is_mandatory, &info.is_prerelease, &info.min_version,
                &info.target_platform, &info.target_arch, &status_str,
                &info.download_progress, &info.install_progress,
                &info.error_message, &info.retry_count, &info.created_at, &now,
            ],
        ).await?;

        debug!("保存更新信息: {}", info.version);
        Ok(())
    }

    pub fn save_update_info(&self, info: &UpdateInfo) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.save_update_info_async(info))
    }

    /// 获取更新信息
    pub async fn get_update_info_async(&self, version: &str) -> Result<Option<UpdateInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let row = client.query_opt(
            "SELECT version, update_type, title, description, changelog, release_notes,
                    release_date, download_url, file_size, file_hash, is_mandatory,
                    is_prerelease, min_version, target_platform, target_arch, status,
                    download_progress, install_progress, error_message, retry_count,
                    created_at
             FROM update_info
             WHERE version = $1",
            &[&version],
        ).await?;

        if let Some(row) = row {
            let update_type_str: Option<String> = row.get(1);
            let update_type = update_type_str.and_then(|s| s.parse().ok());
            let status_str: String = row.get(15);
            let status = status_str.parse().unwrap_or_default();

            Ok(Some(UpdateInfo {
                version: row.get(0),
                update_type,
                title: row.get(2),
                description: row.get(3),
                changelog: row.get(4),
                release_notes: row.get(5),
                release_date: row.get(6),
                download_url: row.get(7),
                file_size: row.get(8),
                file_hash: row.get(9),
                is_mandatory: row.get(10),
                is_prerelease: row.get(11),
                min_version: row.get(12),
                target_platform: row.get(13),
                target_arch: row.get(14),
                status,
                download_progress: row.get(16),
                install_progress: row.get(17),
                error_message: row.get(18),
                retry_count: row.get(19),
                created_at: row.get(20),
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_update_info(&self, version: &str) -> Result<Option<UpdateInfo>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_update_info_async(version))
    }

    /// 获取所有可用更新
    pub async fn get_available_updates_async(&self) -> Result<Vec<UpdateInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT version, update_type, title, description, changelog, release_notes,
                    release_date, download_url, file_size, file_hash, is_mandatory,
                    is_prerelease, min_version, target_platform, target_arch, status,
                    download_progress, install_progress, error_message, retry_count,
                    created_at
             FROM update_info
             WHERE status IN ('available', 'pending')
             ORDER BY created_at DESC",
            &[],
        ).await?;

        let updates = rows.iter().map(|row| {
            let update_type_str: Option<String> = row.get(1);
            let update_type = update_type_str.and_then(|s| s.parse().ok());
            let status_str: String = row.get(15);
            let status = status_str.parse().unwrap_or_default();

            UpdateInfo {
                version: row.get(0),
                update_type,
                title: row.get(2),
                description: row.get(3),
                changelog: row.get(4),
                release_notes: row.get(5),
                release_date: row.get(6),
                download_url: row.get(7),
                file_size: row.get(8),
                file_hash: row.get(9),
                is_mandatory: row.get(10),
                is_prerelease: row.get(11),
                min_version: row.get(12),
                target_platform: row.get(13),
                target_arch: row.get(14),
                status,
                download_progress: row.get(16),
                install_progress: row.get(17),
                error_message: row.get(18),
                retry_count: row.get(19),
                created_at: row.get(20),
            }
        }).collect();

        Ok(updates)
    }

    pub fn get_available_updates(&self) -> Result<Vec<UpdateInfo>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_available_updates_async())
    }

    /// 更新更新状态
    pub async fn update_status_async(&self, version: &str, status: UpdateStatus) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let now = Utc::now().timestamp();
        let status_str = status.to_string();

        client.execute(
            "UPDATE update_info SET status = $1, updated_at = $2 WHERE version = $3",
            &[&status_str, &now, &version],
        ).await?;

        debug!("更新状态: {} -> {}", version, status_str);
        Ok(())
    }

    pub fn update_status(&self, version: &str, status: UpdateStatus) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.update_status_async(version, status))
    }

    /// 更新下载进度
    pub async fn update_download_progress_async(&self, version: &str, progress: f64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let now = Utc::now().timestamp();

        client.execute(
            "UPDATE update_info SET download_progress = $1, updated_at = $2 WHERE version = $3",
            &[&progress, &now, &version],
        ).await?;

        Ok(())
    }

    pub fn update_download_progress(&self, version: &str, progress: f64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.update_download_progress_async(version, progress))
    }

    /// 更新安装进度
    pub async fn update_install_progress_async(&self, version: &str, progress: f64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let now = Utc::now().timestamp();

        client.execute(
            "UPDATE update_info SET install_progress = $1, updated_at = $2 WHERE version = $3",
            &[&progress, &now, &version],
        ).await?;

        Ok(())
    }

    pub fn update_install_progress(&self, version: &str, progress: f64) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.update_install_progress_async(version, progress))
    }

    /// 标记更新已安装
    pub async fn mark_update_installed_async(&self, version: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let now = Utc::now().timestamp();

        client.execute(
            "UPDATE update_info SET status = 'installed', install_progress = 100.0, updated_at = $1 WHERE version = $2",
            &[&now, &version],
        ).await?;

        info!("标记更新已安装: {}", version);
        Ok(())
    }

    pub fn mark_update_installed(&self, version: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.mark_update_installed_async(version))
    }

    /// 检查更新（stub，实际检查逻辑在UpdateManager中）
    pub fn check_for_updates(&self) -> Result<Option<UpdateInfo>, Box<dyn std::error::Error + Send + Sync>> {
        // 返回最新的可用更新
        let updates = self.get_available_updates()?;
        Ok(updates.into_iter().next())
    }

    // ================================
    // 更新配置管理
    // ================================

    /// 获取更新配置
    pub async fn get_update_config_async(&self) -> Result<UpdateConfig, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let row = client.query_opt(
            "SELECT auto_check, auto_check_enabled, check_interval, check_interval_hours,
                    auto_download, auto_install, backup_before_update, include_prerelease,
                    max_backup_count, last_check_time
             FROM update_config
             WHERE id = 1",
            &[],
        ).await?;

        if let Some(row) = row {
            Ok(UpdateConfig {
                auto_check: row.get(0),
                auto_check_enabled: row.get(1),
                check_interval: row.get(2),
                check_interval_hours: row.get(3),
                auto_download: row.get(4),
                auto_install: row.get(5),
                backup_before_update: row.get(6),
                include_prerelease: row.get(7),
                max_backup_count: row.get(8),
                last_check_time: row.get(9),
            })
        } else {
            // 创建默认配置
            let config = UpdateConfig::default();
            self.save_update_config_async(&config).await?;
            Ok(config)
        }
    }

    pub fn get_update_config(&self) -> Result<UpdateConfig, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_update_config_async())
    }

    /// 保存更新配置
    pub async fn save_update_config_async(&self, config: &UpdateConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let now = Utc::now().timestamp();

        client.execute(
            "INSERT INTO update_config (
                id, auto_check, auto_check_enabled, check_interval, check_interval_hours,
                auto_download, auto_install, backup_before_update, include_prerelease,
                max_backup_count, last_check_time, updated_at
            ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
                auto_check = EXCLUDED.auto_check,
                auto_check_enabled = EXCLUDED.auto_check_enabled,
                check_interval = EXCLUDED.check_interval,
                check_interval_hours = EXCLUDED.check_interval_hours,
                auto_download = EXCLUDED.auto_download,
                auto_install = EXCLUDED.auto_install,
                backup_before_update = EXCLUDED.backup_before_update,
                include_prerelease = EXCLUDED.include_prerelease,
                max_backup_count = EXCLUDED.max_backup_count,
                last_check_time = EXCLUDED.last_check_time,
                updated_at = EXCLUDED.updated_at",
            &[
                &config.auto_check,
                &config.auto_check_enabled,
                &config.check_interval,
                &config.check_interval_hours,
                &config.auto_download,
                &config.auto_install,
                &config.backup_before_update,
                &config.include_prerelease,
                &config.max_backup_count,
                &config.last_check_time,
                &now,
            ],
        ).await?;

        debug!("保存更新配置");
        Ok(())
    }

    pub fn save_update_config(&self, config: &UpdateConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.save_update_config_async(config))
    }

    // ================================
    // 版本历史管理
    // ================================

    /// 保存版本历史
    pub async fn save_version_history_async(&self, history: &VersionHistory) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        client.execute(
            "INSERT INTO version_history (version, installed_at, release_notes, notes, is_rollback, install_source)
             VALUES ($1, $2, $3, $4, $5, $6)",
            &[
                &history.version,
                &history.installed_at,
                &history.release_notes,
                &history.notes,
                &history.is_rollback,
                &history.install_source,
            ],
        ).await?;

        info!("保存版本历史: {}", history.version);
        Ok(())
    }

    pub fn save_version_history(&self, history: &VersionHistory) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.save_version_history_async(history))
    }

    /// 获取版本历史
    pub async fn get_version_history_async(&self) -> Result<Vec<VersionHistory>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        let rows = client.query(
            "SELECT id, version, installed_at, release_notes, notes, is_rollback, install_source
             FROM version_history
             ORDER BY installed_at DESC",
            &[],
        ).await?;

        let history = rows.iter().map(|row| {
            VersionHistory {
                id: Some(row.get(0)),
                version: row.get(1),
                installed_at: row.get(2),
                release_notes: row.get(3),
                notes: row.get(4),
                is_rollback: row.get(5),
                install_source: row.get(6),
            }
        }).collect();

        Ok(history)
    }

    pub fn get_version_history(&self) -> Result<Vec<VersionHistory>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_version_history_async())
    }

    // ================================
    // 统计信息
    // ================================

    /// 获取更新统计
    pub async fn get_update_stats_async(&self) -> Result<HashMap<String, i64>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let mut stats = HashMap::new();

        // 总更新数
        let row = client.query_one("SELECT COUNT(*) FROM update_info", &[]).await?;
        stats.insert("total_updates".to_string(), row.get::<_, i64>(0));

        // 可用更新数
        let row = client.query_one("SELECT COUNT(*) FROM update_info WHERE status IN ('available', 'pending')", &[]).await?;
        stats.insert("available_updates".to_string(), row.get::<_, i64>(0));

        // 已安装更新数
        let row = client.query_one("SELECT COUNT(*) FROM update_info WHERE status = 'installed'", &[]).await?;
        stats.insert("installed_updates".to_string(), row.get::<_, i64>(0));

        // 失败更新数
        let row = client.query_one("SELECT COUNT(*) FROM update_info WHERE status = 'failed'", &[]).await?;
        stats.insert("failed_updates".to_string(), row.get::<_, i64>(0));

        // 版本历史总数
        let row = client.query_one("SELECT COUNT(*) FROM version_history", &[]).await?;
        stats.insert("total_versions".to_string(), row.get::<_, i64>(0));

        Ok(stats)
    }

    pub fn get_update_stats(&self) -> Result<HashMap<String, i64>, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.get_update_stats_async())
    }

    /// 清理旧的更新记录
    pub async fn cleanup_old_updates_async(&self, days: i64) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let cutoff_time = Utc::now().timestamp() - (days * 86400);

        let result = client.execute(
            "DELETE FROM update_info WHERE created_at < $1 AND status IN ('installed', 'failed', 'cancelled')",
            &[&cutoff_time],
        ).await?;

        info!("清理了 {} 条旧更新记录", result);
        Ok(result as usize)
    }

    pub fn cleanup_old_updates(&self, days: i64) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        Handle::current().block_on(self.cleanup_old_updates_async(days))
    }
}

// ================================
// UpdateDatabase - 兼容性包装器
// ================================

/// 兼容旧版本UpdateManager的数据库包装器
pub struct UpdateDatabase {
    registry: UpdateRegistry,
}

impl UpdateDatabase {
    pub fn new(_path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // 注意：这里假设全局DbPool已经初始化
        // 实际使用时，应该从应用状态中获取pool
        Err("请使用UpdateRegistry，并传入DbPool".into())
    }

    pub fn from_pool(pool: DbPool) -> Self {
        Self {
            registry: UpdateRegistry::new(pool),
        }
    }

    pub fn get_update_info(&self, version: &str) -> Result<Option<UpdateInfo>, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_update_info(version)
    }

    pub fn save_update_info(&self, info: &UpdateInfo) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.registry.save_update_info(info)
    }

    pub fn get_version_history(&self) -> Result<Vec<VersionHistory>, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_version_history()
    }

    pub fn get_update_info_by_version(&self, version: &str) -> Result<Option<UpdateInfo>, Box<dyn std::error::Error + Send + Sync>> {
        self.get_update_info(version)
    }

    pub fn get_or_create_update_config(&self) -> Result<UpdateConfig, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_update_config()
    }

    pub fn save_update_config(&self, config: &UpdateConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.registry.save_update_config(config)
    }

    pub fn save_version_history(&self, history: &VersionHistory) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.registry.save_version_history(history)
    }

    pub fn get_update_stats(&self) -> Result<HashMap<String, i64>, Box<dyn std::error::Error + Send + Sync>> {
        self.registry.get_update_stats()
    }
}
