use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// 更新状态枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UpdateStatus {
    /// 无更新可用
    None,
    /// 有更新可用
    Available,
    /// 正在下载
    Downloading,
    /// 已下载，待安装
    Downloaded,
    /// 正在安装
    Installing,
    /// 安装完成
    Installed,
    /// 更新失败
    Failed,
    /// 已暂停
    Paused,
    /// 已取消
    Cancelled,
}

impl std::fmt::Display for UpdateStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            UpdateStatus::None => "无更新",
            UpdateStatus::Available => "有更新可用",
            UpdateStatus::Downloading => "下载中",
            UpdateStatus::Downloaded => "已下载",
            UpdateStatus::Installing => "安装中",
            UpdateStatus::Installed => "已安装",
            UpdateStatus::Failed => "更新失败",
            UpdateStatus::Paused => "已暂停",
            UpdateStatus::Cancelled => "已取消",
        };
        write!(f, "{}", s)
    }
}

/// 更新类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UpdateType {
    /// 主要版本更新（破坏性变更）
    Major,
    /// 次要版本更新（新功能）
    Minor,
    /// 补丁更新（Bug修复）
    Patch,
    /// 热修复更新
    Hotfix,
    /// 安全更新
    Security,
}

impl std::fmt::Display for UpdateType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            UpdateType::Major => "主要版本",
            UpdateType::Minor => "功能更新",
            UpdateType::Patch => "Bug修复",
            UpdateType::Hotfix => "热修复",
            UpdateType::Security => "安全更新",
        };
        write!(f, "{}", s)
    }
}

/// 更新信息结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    /// 更新记录ID
    pub id: Option<i64>,
    /// 版本号
    pub version: String,
    /// 更新类型
    pub update_type: UpdateType,
    /// 更新状态
    pub status: UpdateStatus,
    /// 更新标题
    pub title: String,
    /// 更新描述
    pub description: String,
    /// 更新日志（Markdown格式）
    pub changelog: String,
    /// 发布时间
    pub release_date: DateTime<Utc>,
    /// 文件大小（字节）
    pub file_size: Option<i64>,
    /// 下载URL
    pub download_url: Option<String>,
    /// 文件哈希（SHA256）
    pub file_hash: Option<String>,
    /// 是否是强制更新
    pub is_mandatory: bool,
    /// 是否是预发布版本
    pub is_prerelease: bool,
    /// 最小支持版本
    pub min_version: Option<String>,
    /// 目标平台
    pub target_platform: Option<String>,
    /// 目标架构
    pub target_arch: Option<String>,
    /// 下载进度（0-100）
    pub download_progress: f64,
    /// 安装进度（0-100）
    pub install_progress: f64,
    /// 错误信息
    pub error_message: Option<String>,
    /// 重试次数
    pub retry_count: i32,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

impl Default for UpdateInfo {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            id: None,
            version: String::new(),
            update_type: UpdateType::Patch,
            status: UpdateStatus::None,
            title: String::new(),
            description: String::new(),
            changelog: String::new(),
            release_date: now,
            file_size: None,
            download_url: None,
            file_hash: None,
            is_mandatory: false,
            is_prerelease: false,
            min_version: None,
            target_platform: None,
            target_arch: None,
            download_progress: 0.0,
            install_progress: 0.0,
            error_message: None,
            retry_count: 0,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 版本历史记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionHistory {
    /// 记录ID
    pub id: Option<i64>,
    /// 版本号
    pub version: String,
    /// 安装时间
    pub installed_at: DateTime<Utc>,
    /// 是否是回滚操作安装的
    pub is_rollback: bool,
    /// 安装来源（auto/manual/rollback）
    pub install_source: String,
    /// 备注信息
    pub notes: Option<String>,
}

/// 更新配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfig {
    /// 配置ID
    pub id: Option<i64>,
    /// 是否启用自动检查更新
    pub auto_check_enabled: bool,
    /// 检查更新间隔（小时）
    pub check_interval_hours: i32,
    /// 是否自动下载更新
    pub auto_download_enabled: bool,
    /// 是否自动安装更新
    pub auto_install_enabled: bool,
    /// 是否包含预发布版本
    pub include_prerelease: bool,
    /// 更新通道（stable/beta/alpha）
    pub update_channel: String,
    /// 允许的网络类型（wifi/cellular/all）
    pub allowed_network_types: String,
    /// 最大下载重试次数
    pub max_retry_count: i32,
    /// 下载超时时间（秒）
    pub download_timeout_seconds: i32,
    /// 是否在更新前备份
    pub backup_before_update: bool,
    /// 最大备份保留数量
    pub max_backup_count: i32,
    /// 上次检查时间
    pub last_check_time: Option<DateTime<Utc>>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            id: None,
            auto_check_enabled: true,
            check_interval_hours: 24,
            auto_download_enabled: false,
            auto_install_enabled: false,
            include_prerelease: false,
            update_channel: "stable".to_string(),
            allowed_network_types: "all".to_string(),
            max_retry_count: 3,
            download_timeout_seconds: 300,
            backup_before_update: true,
            max_backup_count: 3,
            last_check_time: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 更新数据库管理器
pub struct UpdateDatabase {
    conn: Connection,
}

impl UpdateDatabase {
    /// 创建新的数据库管理器实例
    pub fn new(db_path: &str) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.create_tables()?;
        Ok(db)
    }

    /// 创建数据库表
    pub fn create_tables(&self) -> SqlResult<()> {
        // 更新信息表
        self.conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS update_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL,
                update_type TEXT NOT NULL,
                status TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                changelog TEXT,
                release_date TEXT NOT NULL,
                file_size INTEGER,
                download_url TEXT,
                file_hash TEXT,
                is_mandatory BOOLEAN NOT NULL DEFAULT 0,
                is_prerelease BOOLEAN NOT NULL DEFAULT 0,
                min_version TEXT,
                target_platform TEXT,
                target_arch TEXT,
                download_progress REAL NOT NULL DEFAULT 0.0,
                install_progress REAL NOT NULL DEFAULT 0.0,
                error_message TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#,
            [],
        )?;

        // 版本历史表
        self.conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS version_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL,
                installed_at TEXT NOT NULL,
                is_rollback BOOLEAN NOT NULL DEFAULT 0,
                install_source TEXT NOT NULL DEFAULT 'manual',
                notes TEXT
            )
            "#,
            [],
        )?;

        // 更新配置表
        self.conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS update_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                auto_check_enabled BOOLEAN NOT NULL DEFAULT 1,
                check_interval_hours INTEGER NOT NULL DEFAULT 24,
                auto_download_enabled BOOLEAN NOT NULL DEFAULT 0,
                auto_install_enabled BOOLEAN NOT NULL DEFAULT 0,
                include_prerelease BOOLEAN NOT NULL DEFAULT 0,
                update_channel TEXT NOT NULL DEFAULT 'stable',
                allowed_network_types TEXT NOT NULL DEFAULT 'all',
                max_retry_count INTEGER NOT NULL DEFAULT 3,
                download_timeout_seconds INTEGER NOT NULL DEFAULT 300,
                backup_before_update BOOLEAN NOT NULL DEFAULT 1,
                max_backup_count INTEGER NOT NULL DEFAULT 3,
                last_check_time TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#,
            [],
        )?;

        // 创建索引
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_update_info_version ON update_info(version)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_update_info_status ON update_info(status)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_version_history_version ON version_history(version)",
            [],
        )?;

        Ok(())
    }

    /// 保存更新信息
    pub fn save_update_info(&mut self, update: &mut UpdateInfo) -> SqlResult<()> {
        let now = Utc::now().to_rfc3339();
        update.updated_at = Utc::now();

        if update.id.is_none() {
            // 插入新记录
            update.created_at = Utc::now();
            let id = self.conn.execute(
                r#"
                INSERT INTO update_info (
                    version, update_type, status, title, description, changelog,
                    release_date, file_size, download_url, file_hash, is_mandatory,
                    is_prerelease, min_version, target_platform, target_arch,
                    download_progress, install_progress, error_message, retry_count,
                    created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
                "#,
                params![
                    update.version,
                    serde_json::to_string(&update.update_type).unwrap(),
                    serde_json::to_string(&update.status).unwrap(),
                    update.title,
                    update.description,
                    update.changelog,
                    update.release_date.to_rfc3339(),
                    update.file_size,
                    update.download_url,
                    update.file_hash,
                    update.is_mandatory,
                    update.is_prerelease,
                    update.min_version,
                    update.target_platform,
                    update.target_arch,
                    update.download_progress,
                    update.install_progress,
                    update.error_message,
                    update.retry_count,
                    update.created_at.to_rfc3339(),
                    now
                ],
            )?;
            update.id = Some(self.conn.last_insert_rowid());
        } else {
            // 更新现有记录
            self.conn.execute(
                r#"
                UPDATE update_info SET
                    version = ?2, update_type = ?3, status = ?4, title = ?5,
                    description = ?6, changelog = ?7, release_date = ?8, file_size = ?9,
                    download_url = ?10, file_hash = ?11, is_mandatory = ?12,
                    is_prerelease = ?13, min_version = ?14, target_platform = ?15,
                    target_arch = ?16, download_progress = ?17, install_progress = ?18,
                    error_message = ?19, retry_count = ?20, updated_at = ?21
                WHERE id = ?1
                "#,
                params![
                    update.id,
                    update.version,
                    serde_json::to_string(&update.update_type).unwrap(),
                    serde_json::to_string(&update.status).unwrap(),
                    update.title,
                    update.description,
                    update.changelog,
                    update.release_date.to_rfc3339(),
                    update.file_size,
                    update.download_url,
                    update.file_hash,
                    update.is_mandatory,
                    update.is_prerelease,
                    update.min_version,
                    update.target_platform,
                    update.target_arch,
                    update.download_progress,
                    update.install_progress,
                    update.error_message,
                    update.retry_count,
                    now
                ],
            )?;
        }

        Ok(())
    }

    /// 根据版本号获取更新信息
    pub fn get_update_info_by_version(&self, version: &str) -> SqlResult<Option<UpdateInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM update_info WHERE version = ?1 ORDER BY created_at DESC LIMIT 1"
        )?;

        let update_iter = stmt.query_map([version], |row| {
            Ok(UpdateInfo {
                id: Some(row.get(0)?),
                version: row.get(1)?,
                update_type: serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or(UpdateType::Patch),
                status: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or(UpdateStatus::None),
                title: row.get(4)?,
                description: row.get(5)?,
                changelog: row.get(6)?,
                release_date: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?).unwrap().with_timezone(&Utc),
                file_size: row.get(8)?,
                download_url: row.get(9)?,
                file_hash: row.get(10)?,
                is_mandatory: row.get(11)?,
                is_prerelease: row.get(12)?,
                min_version: row.get(13)?,
                target_platform: row.get(14)?,
                target_arch: row.get(15)?,
                download_progress: row.get(16)?,
                install_progress: row.get(17)?,
                error_message: row.get(18)?,
                retry_count: row.get(19)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(20)?).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(21)?).unwrap().with_timezone(&Utc),
            })
        })?;

        for update in update_iter {
            return Ok(Some(update?));
        }

        Ok(None)
    }

    /// 获取最新的更新信息
    pub fn get_latest_update_info(&self) -> SqlResult<Option<UpdateInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM update_info ORDER BY release_date DESC, created_at DESC LIMIT 1"
        )?;

        let update_iter = stmt.query_map([], |row| {
            Ok(UpdateInfo {
                id: Some(row.get(0)?),
                version: row.get(1)?,
                update_type: serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or(UpdateType::Patch),
                status: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or(UpdateStatus::None),
                title: row.get(4)?,
                description: row.get(5)?,
                changelog: row.get(6)?,
                release_date: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?).unwrap().with_timezone(&Utc),
                file_size: row.get(8)?,
                download_url: row.get(9)?,
                file_hash: row.get(10)?,
                is_mandatory: row.get(11)?,
                is_prerelease: row.get(12)?,
                min_version: row.get(13)?,
                target_platform: row.get(14)?,
                target_arch: row.get(15)?,
                download_progress: row.get(16)?,
                install_progress: row.get(17)?,
                error_message: row.get(18)?,
                retry_count: row.get(19)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(20)?).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(21)?).unwrap().with_timezone(&Utc),
            })
        })?;

        for update in update_iter {
            return Ok(Some(update?));
        }

        Ok(None)
    }

    /// 获取所有更新信息
    pub fn get_all_update_info(&self) -> SqlResult<Vec<UpdateInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM update_info ORDER BY release_date DESC, created_at DESC"
        )?;

        let update_iter = stmt.query_map([], |row| {
            Ok(UpdateInfo {
                id: Some(row.get(0)?),
                version: row.get(1)?,
                update_type: serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or(UpdateType::Patch),
                status: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or(UpdateStatus::None),
                title: row.get(4)?,
                description: row.get(5)?,
                changelog: row.get(6)?,
                release_date: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?).unwrap().with_timezone(&Utc),
                file_size: row.get(8)?,
                download_url: row.get(9)?,
                file_hash: row.get(10)?,
                is_mandatory: row.get(11)?,
                is_prerelease: row.get(12)?,
                min_version: row.get(13)?,
                target_platform: row.get(14)?,
                target_arch: row.get(15)?,
                download_progress: row.get(16)?,
                install_progress: row.get(17)?,
                error_message: row.get(18)?,
                retry_count: row.get(19)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(20)?).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(21)?).unwrap().with_timezone(&Utc),
            })
        })?;

        let mut updates = Vec::new();
        for update in update_iter {
            updates.push(update?);
        }

        Ok(updates)
    }

    /// 删除更新信息
    pub fn delete_update_info(&mut self, id: i64) -> SqlResult<()> {
        self.conn.execute("DELETE FROM update_info WHERE id = ?1", [id])?;
        Ok(())
    }

    /// 保存版本历史
    pub fn save_version_history(&mut self, history: &VersionHistory) -> SqlResult<()> {
        self.conn.execute(
            r#"
            INSERT INTO version_history (
                version, installed_at, is_rollback, install_source, notes
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                history.version,
                history.installed_at.to_rfc3339(),
                history.is_rollback,
                history.install_source,
                history.notes
            ],
        )?;
        Ok(())
    }

    /// 获取版本历史
    pub fn get_version_history(&self) -> SqlResult<Vec<VersionHistory>> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM version_history ORDER BY installed_at DESC"
        )?;

        let history_iter = stmt.query_map([], |row| {
            Ok(VersionHistory {
                id: Some(row.get(0)?),
                version: row.get(1)?,
                installed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?).unwrap().with_timezone(&Utc),
                is_rollback: row.get(3)?,
                install_source: row.get(4)?,
                notes: row.get(5)?,
            })
        })?;

        let mut histories = Vec::new();
        for history in history_iter {
            histories.push(history?);
        }

        Ok(histories)
    }

    /// 获取或创建更新配置
    pub fn get_or_create_update_config(&mut self) -> SqlResult<UpdateConfig> {
        // 先尝试获取现有配置
        let mut stmt = self.conn.prepare("SELECT * FROM update_config LIMIT 1")?;
        let config_iter = stmt.query_map([], |row| {
            Ok(UpdateConfig {
                id: Some(row.get(0)?),
                auto_check_enabled: row.get(1)?,
                check_interval_hours: row.get(2)?,
                auto_download_enabled: row.get(3)?,
                auto_install_enabled: row.get(4)?,
                include_prerelease: row.get(5)?,
                update_channel: row.get(6)?,
                allowed_network_types: row.get(7)?,
                max_retry_count: row.get(8)?,
                download_timeout_seconds: row.get(9)?,
                backup_before_update: row.get(10)?,
                max_backup_count: row.get(11)?,
                last_check_time: row.get::<_, Option<String>>(12)?
                    .map(|s| DateTime::parse_from_rfc3339(&s).unwrap().with_timezone(&Utc)),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(13)?).unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(14)?).unwrap().with_timezone(&Utc),
            })
        })?;

        for config in config_iter {
            return Ok(config?);
        }

        // 如果没有配置，创建默认配置
        let mut config = UpdateConfig::default();
        self.save_update_config(&mut config)?;
        Ok(config)
    }

    /// 保存更新配置
    pub fn save_update_config(&mut self, config: &mut UpdateConfig) -> SqlResult<()> {
        let now = Utc::now().to_rfc3339();
        config.updated_at = Utc::now();

        if config.id.is_none() {
            // 插入新配置
            config.created_at = Utc::now();
            let id = self.conn.execute(
                r#"
                INSERT INTO update_config (
                    auto_check_enabled, check_interval_hours, auto_download_enabled,
                    auto_install_enabled, include_prerelease, update_channel,
                    allowed_network_types, max_retry_count, download_timeout_seconds,
                    backup_before_update, max_backup_count, last_check_time,
                    created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
                "#,
                params![
                    config.auto_check_enabled,
                    config.check_interval_hours,
                    config.auto_download_enabled,
                    config.auto_install_enabled,
                    config.include_prerelease,
                    config.update_channel,
                    config.allowed_network_types,
                    config.max_retry_count,
                    config.download_timeout_seconds,
                    config.backup_before_update,
                    config.max_backup_count,
                    config.last_check_time.map(|t| t.to_rfc3339()),
                    config.created_at.to_rfc3339(),
                    now
                ],
            )?;
            config.id = Some(self.conn.last_insert_rowid());
        } else {
            // 更新现有配置
            self.conn.execute(
                r#"
                UPDATE update_config SET
                    auto_check_enabled = ?2, check_interval_hours = ?3,
                    auto_download_enabled = ?4, auto_install_enabled = ?5,
                    include_prerelease = ?6, update_channel = ?7,
                    allowed_network_types = ?8, max_retry_count = ?9,
                    download_timeout_seconds = ?10, backup_before_update = ?11,
                    max_backup_count = ?12, last_check_time = ?13, updated_at = ?14
                WHERE id = ?1
                "#,
                params![
                    config.id,
                    config.auto_check_enabled,
                    config.check_interval_hours,
                    config.auto_download_enabled,
                    config.auto_install_enabled,
                    config.include_prerelease,
                    config.update_channel,
                    config.allowed_network_types,
                    config.max_retry_count,
                    config.download_timeout_seconds,
                    config.backup_before_update,
                    config.max_backup_count,
                    config.last_check_time.map(|t| t.to_rfc3339()),
                    now
                ],
            )?;
        }

        Ok(())
    }

    /// 清理旧的更新记录
    pub fn cleanup_old_updates(&mut self, keep_count: usize) -> SqlResult<i32> {
        // 保留最新的 keep_count 条记录，删除其余的
        let deleted = self.conn.execute(
            r#"
            DELETE FROM update_info 
            WHERE id NOT IN (
                SELECT id FROM update_info 
                ORDER BY created_at DESC 
                LIMIT ?1
            )
            "#,
            [keep_count],
        )?;

        Ok(deleted)
    }

    /// 获取更新统计信息
    pub fn get_update_stats(&self) -> SqlResult<HashMap<String, i64>> {
        let mut stats = HashMap::new();

        // 总更新数
        let mut stmt = self.conn.prepare("SELECT COUNT(*) FROM update_info")?;
        let total: i64 = stmt.query_row([], |row| row.get(0))?;
        stats.insert("total_updates".to_string(), total);

        // 成功安装数
        let mut stmt = self.conn.prepare(
            "SELECT COUNT(*) FROM update_info WHERE status = ?1"
        )?;
        let installed: i64 = stmt.query_row([serde_json::to_string(&UpdateStatus::Installed).unwrap()], |row| row.get(0))?;
        stats.insert("installed_updates".to_string(), installed);

        // 失败数
        let failed: i64 = stmt.query_row([serde_json::to_string(&UpdateStatus::Failed).unwrap()], |row| row.get(0))?;
        stats.insert("failed_updates".to_string(), failed);

        // 版本历史数
        let mut stmt = self.conn.prepare("SELECT COUNT(*) FROM version_history")?;
        let versions: i64 = stmt.query_row([], |row| row.get(0))?;
        stats.insert("version_count".to_string(), versions);

        Ok(stats)
    }
}
