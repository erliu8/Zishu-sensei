//! 适配器数据库模型
//!
//! 管理本地安装的适配器信息，包括：
//! - 适配器基础信息
//! - 版本管理
//! - 依赖关系
//! - 权限配置
//! - 安装状态

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use tracing::info;
use crate::database::DbPool;

// ================================
// 数据类型定义
// ================================

/// 适配器安装状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AdapterInstallStatus {
    /// 正在下载
    Downloading,
    /// 正在安装
    Installing,
    /// 已安装
    Installed,
    /// 安装失败
    InstallFailed,
    /// 正在更新
    Updating,
    /// 更新失败
    UpdateFailed,
    /// 正在卸载
    Uninstalling,
    /// 卸载失败
    UninstallFailed,
}

impl std::fmt::Display for AdapterInstallStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Downloading => write!(f, "downloading"),
            Self::Installing => write!(f, "installing"),
            Self::Installed => write!(f, "installed"),
            Self::InstallFailed => write!(f, "install_failed"),
            Self::Updating => write!(f, "updating"),
            Self::UpdateFailed => write!(f, "update_failed"),
            Self::Uninstalling => write!(f, "uninstalling"),
            Self::UninstallFailed => write!(f, "uninstall_failed"),
        }
    }
}

impl std::str::FromStr for AdapterInstallStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "downloading" => Ok(Self::Downloading),
            "installing" => Ok(Self::Installing),
            "installed" => Ok(Self::Installed),
            "install_failed" => Ok(Self::InstallFailed),
            "updating" => Ok(Self::Updating),
            "update_failed" => Ok(Self::UpdateFailed),
            "uninstalling" => Ok(Self::Uninstalling),
            "uninstall_failed" => Ok(Self::UninstallFailed),
            _ => Err(format!("未知的安装状态: {}", s)),
        }
    }
}

/// 已安装的适配器记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledAdapter {
    /// 适配器ID
    pub id: String,
    /// 适配器名称
    pub name: String,
    /// 显示名称
    pub display_name: String,
    /// 当前版本
    pub version: String,
    /// 安装路径
    pub install_path: String,
    /// 安装状态
    pub status: AdapterInstallStatus,
    /// 是否启用
    pub enabled: bool,
    /// 是否自动更新
    pub auto_update: bool,
    /// 来源 (market, url, file)
    pub source: String,
    /// 来源ID (用于从市场更新)
    pub source_id: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 作者
    pub author: Option<String>,
    /// 许可证
    pub license: Option<String>,
    /// 主页URL
    pub homepage_url: Option<String>,
    /// 安装时间
    pub installed_at: DateTime<Utc>,
    /// 最后更新时间
    pub updated_at: DateTime<Utc>,
    /// 最后使用时间
    pub last_used_at: Option<DateTime<Utc>>,
    /// 配置JSON
    pub config: HashMap<String, serde_json::Value>,
    /// 元数据JSON (capability, compatibility等)
    pub metadata: HashMap<String, serde_json::Value>,
}

/// 适配器版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterVersion {
    /// 版本ID
    pub id: i64,
    /// 适配器ID
    pub adapter_id: String,
    /// 版本号
    pub version: String,
    /// 发布时间
    pub released_at: DateTime<Utc>,
    /// 变更日志
    pub changelog: Option<String>,
    /// 下载URL
    pub download_url: Option<String>,
    /// 文件大小（字节）
    pub file_size: Option<i64>,
    /// 校验和
    pub checksum: Option<String>,
    /// 是否为当前版本
    pub is_current: bool,
}

/// 适配器依赖关系
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterDependency {
    /// 依赖ID
    pub id: i64,
    /// 适配器ID
    pub adapter_id: String,
    /// 依赖的适配器ID
    pub dependency_id: String,
    /// 依赖版本要求
    pub version_requirement: String,
    /// 是否必需
    pub required: bool,
}

/// 适配器权限配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterPermission {
    /// 权限ID
    pub id: i64,
    /// 适配器ID
    pub adapter_id: String,
    /// 权限类型 (file_read, file_write, network, system, etc.)
    pub permission_type: String,
    /// 是否授权
    pub granted: bool,
    /// 授权时间
    pub granted_at: Option<DateTime<Utc>>,
    /// 权限描述
    pub description: Option<String>,
}

// ================================
// 适配器注册表
// ================================

/// 适配器注册表
pub struct AdapterRegistry {
    pool: DbPool,
}

impl AdapterRegistry {
    /// 创建新的适配器注册表
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建已安装适配器表
        client.execute(
            "CREATE TABLE IF NOT EXISTS installed_adapters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                version TEXT NOT NULL,
                install_path TEXT NOT NULL,
                status TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT true,
                auto_update BOOLEAN NOT NULL DEFAULT true,
                source TEXT NOT NULL,
                source_id TEXT,
                description TEXT,
                author TEXT,
                license TEXT,
                homepage_url TEXT,
                installed_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                last_used_at BIGINT,
                config JSONB NOT NULL DEFAULT '{}',
                metadata JSONB NOT NULL DEFAULT '{}'
            )",
            &[],
        ).await?;

        // 创建版本历史表
        client.execute(
            "CREATE TABLE IF NOT EXISTS adapter_versions (
                id SERIAL PRIMARY KEY,
                adapter_id TEXT NOT NULL,
                version TEXT NOT NULL,
                released_at BIGINT NOT NULL,
                changelog TEXT,
                download_url TEXT,
                file_size BIGINT,
                checksum TEXT,
                is_current BOOLEAN NOT NULL DEFAULT false,
                FOREIGN KEY (adapter_id) REFERENCES installed_adapters(id) ON DELETE CASCADE,
                UNIQUE(adapter_id, version)
            )",
            &[],
        ).await?;

        // 创建依赖关系表
        client.execute(
            "CREATE TABLE IF NOT EXISTS adapter_dependencies (
                id SERIAL PRIMARY KEY,
                adapter_id TEXT NOT NULL,
                dependency_id TEXT NOT NULL,
                version_requirement TEXT NOT NULL,
                required BOOLEAN NOT NULL DEFAULT true,
                FOREIGN KEY (adapter_id) REFERENCES installed_adapters(id) ON DELETE CASCADE,
                UNIQUE(adapter_id, dependency_id)
            )",
            &[],
        ).await?;

        // 创建权限表
        client.execute(
            "CREATE TABLE IF NOT EXISTS adapter_permissions (
                id SERIAL PRIMARY KEY,
                adapter_id TEXT NOT NULL,
                permission_type TEXT NOT NULL,
                granted BOOLEAN NOT NULL DEFAULT false,
                granted_at BIGINT,
                description TEXT,
                FOREIGN KEY (adapter_id) REFERENCES installed_adapters(id) ON DELETE CASCADE,
                UNIQUE(adapter_id, permission_type)
            )",
            &[],
        ).await?;

        // 创建索引
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_installed_adapters_status ON installed_adapters(status)",
            &[],
        ).await?;
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_installed_adapters_enabled ON installed_adapters(enabled)",
            &[],
        ).await?;
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_adapter_versions_adapter ON adapter_versions(adapter_id)",
            &[],
        ).await?;
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_adapter_dependencies_adapter ON adapter_dependencies(adapter_id)",
            &[],
        ).await?;
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_adapter_permissions_adapter ON adapter_permissions(adapter_id)",
            &[],
        ).await?;

        info!("适配器数据库表初始化完成");
        Ok(())
    }

    // ================================
    // 适配器 CRUD 操作
    // ================================

    /// 添加已安装的适配器
    pub async fn add_adapter(&self, adapter: InstalledAdapter) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let config_json = serde_json::to_value(&adapter.config)?;
        let metadata_json = serde_json::to_value(&adapter.metadata)?;
        
        client.execute(
            "INSERT INTO installed_adapters (
                id, name, display_name, version, install_path, status, enabled,
                auto_update, source, source_id, description, author, license,
                homepage_url, installed_at, updated_at, last_used_at, config, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)",
            &[
                &adapter.id,
                &adapter.name,
                &adapter.display_name,
                &adapter.version,
                &adapter.install_path,
                &adapter.status.to_string(),
                &adapter.enabled,
                &adapter.auto_update,
                &adapter.source,
                &adapter.source_id,
                &adapter.description,
                &adapter.author,
                &adapter.license,
                &adapter.homepage_url,
                &adapter.installed_at.timestamp(),
                &adapter.updated_at.timestamp(),
                &adapter.last_used_at.map(|t| t.timestamp()),
                &config_json,
                &metadata_json,
            ],
        ).await?;

        info!("成功添加适配器: {} ({})", adapter.name, adapter.id);
        Ok(())
    }

    /// 获取适配器
    pub async fn get_adapter(&self, adapter_id: &str) -> Result<Option<InstalledAdapter>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row = client.query_opt(
            "SELECT id, name, display_name, version, install_path, status, enabled,
                    auto_update, source, source_id, description, author, license,
                    homepage_url, installed_at, updated_at, last_used_at, config, metadata
             FROM installed_adapters WHERE id = $1",
            &[&adapter_id],
        ).await?;

        Ok(row.map(|r| self.row_to_adapter(&r)))
    }

    /// 获取所有已安装的适配器
    pub async fn get_all_adapters(&self) -> Result<Vec<InstalledAdapter>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, display_name, version, install_path, status, enabled,
                    auto_update, source, source_id, description, author, license,
                    homepage_url, installed_at, updated_at, last_used_at, config, metadata
             FROM installed_adapters ORDER BY installed_at DESC",
            &[],
        ).await?;

        Ok(rows.iter().map(|r| self.row_to_adapter(r)).collect())
    }

    /// 获取已启用的适配器
    pub async fn get_enabled_adapters(&self) -> Result<Vec<InstalledAdapter>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, name, display_name, version, install_path, status, enabled,
                    auto_update, source, source_id, description, author, license,
                    homepage_url, installed_at, updated_at, last_used_at, config, metadata
             FROM installed_adapters WHERE enabled = true ORDER BY installed_at DESC",
            &[],
        ).await?;

        Ok(rows.iter().map(|r| self.row_to_adapter(r)).collect())
    }

    /// 更新适配器
    pub async fn update_adapter(&self, adapter: InstalledAdapter) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let config_json = serde_json::to_value(&adapter.config)?;
        let metadata_json = serde_json::to_value(&adapter.metadata)?;
        
        client.execute(
            "UPDATE installed_adapters SET
                name = $2, display_name = $3, version = $4, install_path = $5,
                status = $6, enabled = $7, auto_update = $8, source = $9,
                source_id = $10, description = $11, author = $12, license = $13,
                homepage_url = $14, updated_at = $15, last_used_at = $16,
                config = $17, metadata = $18
             WHERE id = $1",
            &[
                &adapter.id,
                &adapter.name,
                &adapter.display_name,
                &adapter.version,
                &adapter.install_path,
                &adapter.status.to_string(),
                &adapter.enabled,
                &adapter.auto_update,
                &adapter.source,
                &adapter.source_id,
                &adapter.description,
                &adapter.author,
                &adapter.license,
                &adapter.homepage_url,
                &adapter.updated_at.timestamp(),
                &adapter.last_used_at.map(|t| t.timestamp()),
                &config_json,
                &metadata_json,
            ],
        ).await?;

        info!("成功更新适配器: {}", adapter.id);
        Ok(())
    }

    /// 删除适配器
    pub async fn delete_adapter(&self, adapter_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "DELETE FROM installed_adapters WHERE id = $1",
            &[&adapter_id],
        ).await?;

        info!("成功删除适配器: {}", adapter_id);
        Ok(())
    }

    /// 启用/禁用适配器
    pub async fn set_adapter_enabled(&self, adapter_id: &str, enabled: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "UPDATE installed_adapters SET enabled = $2, updated_at = $3 WHERE id = $1",
            &[&adapter_id, &enabled, &Utc::now().timestamp()],
        ).await?;

        info!("适配器 {} 已{}", adapter_id, if enabled { "启用" } else { "禁用" });
        Ok(())
    }

    /// 更新适配器状态
    pub async fn update_adapter_status(&self, adapter_id: &str, status: AdapterInstallStatus) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "UPDATE installed_adapters SET status = $2, updated_at = $3 WHERE id = $1",
            &[&adapter_id, &status.to_string(), &Utc::now().timestamp()],
        ).await?;

        info!("适配器 {} 状态更新为: {}", adapter_id, status);
        Ok(())
    }

    /// 更新最后使用时间
    pub async fn update_last_used(&self, adapter_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "UPDATE installed_adapters SET last_used_at = $2 WHERE id = $1",
            &[&adapter_id, &Utc::now().timestamp()],
        ).await?;

        Ok(())
    }

    // ================================
    // 版本管理
    // ================================

    /// 添加版本记录
    pub async fn add_version(&self, version: AdapterVersion) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "INSERT INTO adapter_versions (
                adapter_id, version, released_at, changelog, download_url,
                file_size, checksum, is_current
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            &[
                &version.adapter_id,
                &version.version,
                &version.released_at.timestamp(),
                &version.changelog,
                &version.download_url,
                &version.file_size,
                &version.checksum,
                &version.is_current,
            ],
        ).await?;

        Ok(())
    }

    /// 获取适配器的所有版本
    pub async fn get_versions(&self, adapter_id: &str) -> Result<Vec<AdapterVersion>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, adapter_id, version, released_at, changelog, download_url,
                    file_size, checksum, is_current
             FROM adapter_versions WHERE adapter_id = $1 ORDER BY released_at DESC",
            &[&adapter_id],
        ).await?;

        Ok(rows.iter().map(|row| {
            AdapterVersion {
                id: row.get::<_, i32>(0) as i64,
                adapter_id: row.get(1),
                version: row.get(2),
                released_at: DateTime::from_timestamp(row.get::<_, i64>(3), 0)
                    .unwrap_or_else(|| Utc::now()),
                changelog: row.get(4),
                download_url: row.get(5),
                file_size: row.get(6),
                checksum: row.get(7),
                is_current: row.get(8),
            }
        }).collect())
    }

    /// 设置当前版本
    pub async fn set_current_version(&self, adapter_id: &str, version: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        // 清除所有当前版本标记
        client.execute(
            "UPDATE adapter_versions SET is_current = false WHERE adapter_id = $1",
            &[&adapter_id],
        ).await?;
        
        // 设置新的当前版本
        client.execute(
            "UPDATE adapter_versions SET is_current = true WHERE adapter_id = $1 AND version = $2",
            &[&adapter_id, &version],
        ).await?;

        Ok(())
    }

    // ================================
    // 依赖管理
    // ================================

    /// 添加依赖
    pub async fn add_dependency(&self, dependency: AdapterDependency) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "INSERT INTO adapter_dependencies (
                adapter_id, dependency_id, version_requirement, required
            ) VALUES ($1, $2, $3, $4)",
            &[
                &dependency.adapter_id,
                &dependency.dependency_id,
                &dependency.version_requirement,
                &dependency.required,
            ],
        ).await?;

        Ok(())
    }

    /// 获取适配器的所有依赖
    pub async fn get_dependencies(&self, adapter_id: &str) -> Result<Vec<AdapterDependency>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, adapter_id, dependency_id, version_requirement, required
             FROM adapter_dependencies WHERE adapter_id = $1",
            &[&adapter_id],
        ).await?;

        Ok(rows.iter().map(|row| {
            AdapterDependency {
                id: row.get::<_, i32>(0) as i64,
                adapter_id: row.get(1),
                dependency_id: row.get(2),
                version_requirement: row.get(3),
                required: row.get(4),
            }
        }).collect())
    }

    /// 删除依赖
    pub async fn delete_dependency(&self, adapter_id: &str, dependency_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "DELETE FROM adapter_dependencies WHERE adapter_id = $1 AND dependency_id = $2",
            &[&adapter_id, &dependency_id],
        ).await?;

        Ok(())
    }

    // ================================
    // 权限管理
    // ================================

    /// 添加权限
    pub async fn add_permission(&self, permission: AdapterPermission) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        client.execute(
            "INSERT INTO adapter_permissions (
                adapter_id, permission_type, granted, granted_at, description
            ) VALUES ($1, $2, $3, $4, $5)",
            &[
                &permission.adapter_id,
                &permission.permission_type,
                &permission.granted,
                &permission.granted_at.map(|t| t.timestamp()),
                &permission.description,
            ],
        ).await?;

        Ok(())
    }

    /// 获取适配器的所有权限
    pub async fn get_permissions(&self, adapter_id: &str) -> Result<Vec<AdapterPermission>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let rows = client.query(
            "SELECT id, adapter_id, permission_type, granted, granted_at, description
             FROM adapter_permissions WHERE adapter_id = $1",
            &[&adapter_id],
        ).await?;

        Ok(rows.iter().map(|row| {
            AdapterPermission {
                id: row.get::<_, i32>(0) as i64,
                adapter_id: row.get(1),
                permission_type: row.get(2),
                granted: row.get(3),
                granted_at: row.get::<_, Option<i64>>(4)
                    .and_then(|ts| DateTime::from_timestamp(ts, 0)),
                description: row.get(5),
            }
        }).collect())
    }

    /// 更新权限授权状态
    pub async fn grant_permission(&self, adapter_id: &str, permission_type: &str, granted: bool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let granted_at = if granted { Some(Utc::now().timestamp()) } else { None };
        
        client.execute(
            "UPDATE adapter_permissions SET granted = $3, granted_at = $4 
             WHERE adapter_id = $1 AND permission_type = $2",
            &[&adapter_id, &permission_type, &granted, &granted_at],
        ).await?;

        info!(
            "适配器 {} 的权限 {} 已{}",
            adapter_id,
            permission_type,
            if granted { "授予" } else { "撤销" }
        );
        Ok(())
    }

    /// 检查权限
    pub async fn check_permission(&self, adapter_id: &str, permission_type: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row = client.query_one(
            "SELECT granted FROM adapter_permissions 
             WHERE adapter_id = $1 AND permission_type = $2",
            &[&adapter_id, &permission_type],
        ).await?;

        Ok(row.get(0))
    }

    // ================================
    // 辅助方法
    // ================================

    /// 将数据库行转换为适配器对象
    fn row_to_adapter(&self, row: &tokio_postgres::Row) -> InstalledAdapter {
        let config_value: serde_json::Value = row.get(17);
        let metadata_value: serde_json::Value = row.get(18);
        
        let config: HashMap<String, serde_json::Value> = 
            serde_json::from_value(config_value).unwrap_or_default();
        let metadata: HashMap<String, serde_json::Value> = 
            serde_json::from_value(metadata_value).unwrap_or_default();
        
        let status_str: String = row.get(5);
        let status = status_str.parse().unwrap_or(AdapterInstallStatus::Installed);
        
        InstalledAdapter {
            id: row.get(0),
            name: row.get(1),
            display_name: row.get(2),
            version: row.get(3),
            install_path: row.get(4),
            status,
            enabled: row.get(6),
            auto_update: row.get(7),
            source: row.get(8),
            source_id: row.get(9),
            description: row.get(10),
            author: row.get(11),
            license: row.get(12),
            homepage_url: row.get(13),
            installed_at: DateTime::from_timestamp(row.get::<_, i64>(14), 0)
                .unwrap_or_else(|| Utc::now()),
            updated_at: DateTime::from_timestamp(row.get::<_, i64>(15), 0)
                .unwrap_or_else(|| Utc::now()),
            last_used_at: row.get::<_, Option<i64>>(16)
                .and_then(|ts| DateTime::from_timestamp(ts, 0)),
            config,
            metadata,
        }
    }

    /// 检查适配器是否存在
    pub async fn adapter_exists(&self, adapter_id: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row = client.query_one(
            "SELECT COUNT(*) FROM installed_adapters WHERE id = $1",
            &[&adapter_id],
        ).await?;

        let count: i64 = row.get(0);
        Ok(count > 0)
    }

    /// 获取适配器数量
    pub async fn count_adapters(&self) -> Result<i64, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        
        let row = client.query_one(
            "SELECT COUNT(*) FROM installed_adapters",
            &[],
        ).await?;

        Ok(row.get(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use chrono::{DateTime, Utc};
    use mockall::predicate::*;
    use tokio_test;

    // ================================
    // 枚举测试
    // ================================

    #[test]
    fn test_adapter_install_status_display() {
        assert_eq!(AdapterInstallStatus::Downloading.to_string(), "downloading");
        assert_eq!(AdapterInstallStatus::Installing.to_string(), "installing");
        assert_eq!(AdapterInstallStatus::Installed.to_string(), "installed");
        assert_eq!(AdapterInstallStatus::InstallFailed.to_string(), "install_failed");
        assert_eq!(AdapterInstallStatus::Updating.to_string(), "updating");
        assert_eq!(AdapterInstallStatus::UpdateFailed.to_string(), "update_failed");
        assert_eq!(AdapterInstallStatus::Uninstalling.to_string(), "uninstalling");
        assert_eq!(AdapterInstallStatus::UninstallFailed.to_string(), "uninstall_failed");
    }

    #[test]
    fn test_adapter_install_status_from_str() {
        assert_eq!("downloading".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::Downloading);
        assert_eq!("installing".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::Installing);
        assert_eq!("installed".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::Installed);
        assert_eq!("install_failed".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::InstallFailed);
        assert_eq!("updating".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::Updating);
        assert_eq!("update_failed".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::UpdateFailed);
        assert_eq!("uninstalling".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::Uninstalling);
        assert_eq!("uninstall_failed".parse::<AdapterInstallStatus>().unwrap(), AdapterInstallStatus::UninstallFailed);
    }

    #[test]
    fn test_adapter_install_status_from_str_invalid() {
        let result = "invalid_status".parse::<AdapterInstallStatus>();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "未知的安装状态: invalid_status");
    }

    #[test]
    fn test_adapter_install_status_partial_eq() {
        assert_eq!(AdapterInstallStatus::Downloading, AdapterInstallStatus::Downloading);
        assert_ne!(AdapterInstallStatus::Downloading, AdapterInstallStatus::Installing);
        assert_ne!(AdapterInstallStatus::Installed, AdapterInstallStatus::InstallFailed);
    }

    // ================================
    // 结构体序列化测试
    // ================================

    #[test]
    fn test_installed_adapter_serialization() {
        let adapter = create_test_adapter();
        
        // 测试序列化
        let serialized = serde_json::to_string(&adapter).unwrap();
        assert!(serialized.contains("test-adapter"));
        assert!(serialized.contains("Test Adapter"));
        
        // 测试反序列化
        let deserialized: InstalledAdapter = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.id, adapter.id);
        assert_eq!(deserialized.name, adapter.name);
        assert_eq!(deserialized.status, adapter.status);
    }

    #[test]
    fn test_adapter_version_serialization() {
        let version = AdapterVersion {
            id: 1,
            adapter_id: "test-adapter".to_string(),
            version: "1.0.0".to_string(),
            released_at: Utc::now(),
            changelog: Some("Initial release".to_string()),
            download_url: Some("https://example.com/adapter.zip".to_string()),
            file_size: Some(1024),
            checksum: Some("abc123".to_string()),
            is_current: true,
        };
        
        let serialized = serde_json::to_string(&version).unwrap();
        let deserialized: AdapterVersion = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.adapter_id, version.adapter_id);
        assert_eq!(deserialized.version, version.version);
        assert_eq!(deserialized.is_current, version.is_current);
    }

    #[test]
    fn test_adapter_dependency_serialization() {
        let dependency = AdapterDependency {
            id: 1,
            adapter_id: "test-adapter".to_string(),
            dependency_id: "required-lib".to_string(),
            version_requirement: ">=1.0.0".to_string(),
            required: true,
        };
        
        let serialized = serde_json::to_string(&dependency).unwrap();
        let deserialized: AdapterDependency = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.adapter_id, dependency.adapter_id);
        assert_eq!(deserialized.dependency_id, dependency.dependency_id);
        assert_eq!(deserialized.required, dependency.required);
    }

    #[test]
    fn test_adapter_permission_serialization() {
        let permission = AdapterPermission {
            id: 1,
            adapter_id: "test-adapter".to_string(),
            permission_type: "file_read".to_string(),
            granted: true,
            granted_at: Some(Utc::now()),
            description: Some("Read files from user directory".to_string()),
        };
        
        let serialized = serde_json::to_string(&permission).unwrap();
        let deserialized: AdapterPermission = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.adapter_id, permission.adapter_id);
        assert_eq!(deserialized.permission_type, permission.permission_type);
        assert_eq!(deserialized.granted, permission.granted);
    }

    // ================================
    // 数据验证测试
    // ================================

    #[test]  
    fn test_installed_adapter_config_handling() {
        let mut config = HashMap::new();
        config.insert("theme".to_string(), serde_json::Value::String("dark".to_string()));
        config.insert("debug".to_string(), serde_json::Value::Bool(true));
        config.insert("timeout".to_string(), serde_json::Value::Number(serde_json::Number::from(30)));
        
        let adapter = InstalledAdapter {
            id: "test-adapter".to_string(),
            name: "test_adapter".to_string(),
            display_name: "Test Adapter".to_string(),
            version: "1.0.0".to_string(),
            install_path: "/path/to/adapter".to_string(),
            status: AdapterInstallStatus::Installed,
            enabled: true,
            auto_update: true,
            source: "market".to_string(),
            source_id: Some("12345".to_string()),
            description: Some("A test adapter".to_string()),
            author: Some("Test Author".to_string()),
            license: Some("MIT".to_string()),
            homepage_url: Some("https://example.com".to_string()),
            installed_at: Utc::now(),
            updated_at: Utc::now(),
            last_used_at: None,
            config: config.clone(),
            metadata: HashMap::new(),
        };
        
        assert_eq!(adapter.config.get("theme").unwrap().as_str().unwrap(), "dark");
        assert_eq!(adapter.config.get("debug").unwrap().as_bool().unwrap(), true);
        assert_eq!(adapter.config.get("timeout").unwrap().as_i64().unwrap(), 30);
    }

    #[test]
    fn test_installed_adapter_metadata_handling() {
        let mut metadata = HashMap::new();
        metadata.insert("capabilities".to_string(), 
            serde_json::json!(["chat", "file_read", "network"]));
        metadata.insert("compatibility".to_string(), 
            serde_json::json!({"min_version": "0.1.0", "max_version": "1.0.0"}));
        
        let adapter = InstalledAdapter {
            id: "test-adapter".to_string(),
            name: "test_adapter".to_string(),
            display_name: "Test Adapter".to_string(),
            version: "1.0.0".to_string(),
            install_path: "/path/to/adapter".to_string(),
            status: AdapterInstallStatus::Installed,
            enabled: true,
            auto_update: true,
            source: "market".to_string(),
            source_id: Some("12345".to_string()),
            description: None,
            author: None,
            license: None,
            homepage_url: None,
            installed_at: Utc::now(),
            updated_at: Utc::now(),
            last_used_at: None,
            config: HashMap::new(),
            metadata: metadata.clone(),
        };
        
        let capabilities = adapter.metadata.get("capabilities").unwrap().as_array().unwrap();
        assert_eq!(capabilities.len(), 3);
        assert!(capabilities.contains(&serde_json::Value::String("chat".to_string())));
    }

    // ================================
    // 边界条件测试
    // ================================

    #[test]
    fn test_empty_config_and_metadata() {
        let adapter = InstalledAdapter {
            id: "minimal-adapter".to_string(),
            name: "minimal".to_string(),
            display_name: "Minimal Adapter".to_string(),
            version: "0.1.0".to_string(),
            install_path: "/minimal".to_string(),
            status: AdapterInstallStatus::Installed,
            enabled: false,
            auto_update: false,
            source: "file".to_string(),
            source_id: None,
            description: None,
            author: None,
            license: None,
            homepage_url: None,
            installed_at: Utc::now(),
            updated_at: Utc::now(),
            last_used_at: None,
            config: HashMap::new(),
            metadata: HashMap::new(),
        };
        
        assert!(adapter.config.is_empty());
        assert!(adapter.metadata.is_empty());
        assert!(adapter.source_id.is_none());
        assert!(adapter.description.is_none());
    }

    #[test]
    fn test_adapter_version_without_optional_fields() {
        let version = AdapterVersion {
            id: 1,
            adapter_id: "test-adapter".to_string(),
            version: "1.0.0".to_string(),
            released_at: Utc::now(),
            changelog: None,
            download_url: None,
            file_size: None,
            checksum: None,
            is_current: false,
        };
        
        assert!(version.changelog.is_none());
        assert!(version.download_url.is_none());
        assert!(version.file_size.is_none());
        assert!(version.checksum.is_none());
        assert!(!version.is_current);
    }

    #[test]
    fn test_adapter_permission_without_optional_fields() {
        let permission = AdapterPermission {
            id: 1,
            adapter_id: "test-adapter".to_string(),
            permission_type: "network".to_string(),
            granted: false,
            granted_at: None,
            description: None,
        };
        
        assert!(!permission.granted);
        assert!(permission.granted_at.is_none());
        assert!(permission.description.is_none());
    }

    // ================================
    // 日期时间处理测试
    // ================================

    #[test]
    fn test_datetime_handling() {
        let now = Utc::now();
        let adapter = InstalledAdapter {
            id: "datetime-test".to_string(),
            name: "datetime_test".to_string(),
            display_name: "DateTime Test".to_string(),
            version: "1.0.0".to_string(),
            install_path: "/path/to/adapter".to_string(),
            status: AdapterInstallStatus::Installed,
            enabled: true,
            auto_update: true,
            source: "market".to_string(),
            source_id: None,
            description: None,
            author: None,
            license: None,
            homepage_url: None,
            installed_at: now,
            updated_at: now,
            last_used_at: Some(now),
            config: HashMap::new(),
            metadata: HashMap::new(),
        };
        
        assert_eq!(adapter.installed_at, now);
        assert_eq!(adapter.updated_at, now);
        assert_eq!(adapter.last_used_at.unwrap(), now);
    }

    // ================================
    // 版本需求测试
    // ================================

    #[test]
    fn test_version_requirement_formats() {
        let test_cases = vec![
            ">=1.0.0",
            "^1.2.3",
            "~1.2.0",
            "1.0.0",
            ">=1.0.0,<2.0.0",
            "*",
        ];
        
        for version_req in test_cases {
            let dependency = AdapterDependency {
                id: 1,
                adapter_id: "test-adapter".to_string(),
                dependency_id: "some-lib".to_string(),
                version_requirement: version_req.to_string(),
                required: true,
            };
            
            assert_eq!(dependency.version_requirement, version_req);
        }
    }

    #[test]
    fn test_required_vs_optional_dependencies() {
        let required_dep = AdapterDependency {
            id: 1,
            adapter_id: "test-adapter".to_string(),
            dependency_id: "required-lib".to_string(),
            version_requirement: ">=1.0.0".to_string(),
            required: true,
        };
        
        let optional_dep = AdapterDependency {
            id: 2,
            adapter_id: "test-adapter".to_string(),
            dependency_id: "optional-lib".to_string(),
            version_requirement: ">=1.0.0".to_string(),
            required: false,
        };
        
        assert!(required_dep.required);
        assert!(!optional_dep.required);
    }

    // ================================
    // 权限类型测试
    // ================================

    #[test]
    fn test_permission_types() {
        let permission_types = vec![
            "file_read",
            "file_write", 
            "network",
            "system",
            "camera",
            "microphone",
            "location",
            "notifications",
        ];
        
        for perm_type in permission_types {
            let permission = AdapterPermission {
                id: 1,
                adapter_id: "test-adapter".to_string(),
                permission_type: perm_type.to_string(),
                granted: false,
                granted_at: None,
                description: Some(format!("Permission for {}", perm_type)),
            };
            
            assert_eq!(permission.permission_type, perm_type);
            assert!(permission.description.unwrap().contains(perm_type));
        }
    }

    // ================================
    // 辅助函数
    // ================================

    fn create_test_adapter() -> InstalledAdapter {
        let mut config = HashMap::new();
        config.insert("debug".to_string(), serde_json::Value::Bool(false));
        
        let mut metadata = HashMap::new();
        metadata.insert("version".to_string(), serde_json::Value::String("1.0.0".to_string()));
        
        InstalledAdapter {
            id: "test-adapter".to_string(),
            name: "test_adapter".to_string(),
            display_name: "Test Adapter".to_string(),
            version: "1.0.0".to_string(),
            install_path: "/path/to/adapter".to_string(),
            status: AdapterInstallStatus::Installed,
            enabled: true,
            auto_update: true,
            source: "market".to_string(),
            source_id: Some("12345".to_string()),
            description: Some("A test adapter for unit testing".to_string()),
            author: Some("Test Author".to_string()),
            license: Some("MIT".to_string()),
            homepage_url: Some("https://example.com/test-adapter".to_string()),
            installed_at: Utc::now(),
            updated_at: Utc::now(),
            last_used_at: Some(Utc::now()),
            config,
            metadata,
        }
    }

    // 注意: PostgreSQL 集成测试需要实际的数据库连接
    // 这些测试应该在集成测试中进行，而不是单元测试
    
    #[tokio::test]
    #[ignore] // 需要实际的 PostgreSQL 连接
    async fn test_adapter_registry_integration() {
        // 这个测试需要实际的 PostgreSQL 数据库
        // 在运行前设置 DATABASE_URL 环境变量
        // 
        // 集成测试内容:
        // - 数据库表初始化
        // - 适配器 CRUD 操作
        // - 版本管理
        // - 依赖管理  
        // - 权限管理
        // - 复杂查询和边界情况
    }
}
