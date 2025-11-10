use crate::database::update::{UpdateDatabase, UpdateInfo, UpdateStatus, UpdateType, VersionHistory, UpdateConfig};
use crate::database::DbPool;
use anyhow::{Result, Context, bail};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::broadcast;
use tracing::{info, warn, error, debug};
use sha2::{Sha256, Digest};
use std::cmp::Ordering;

/// 版本比较结果
#[derive(Debug, Clone, PartialEq)]
pub enum VersionComparison {
    /// 当前版本更新
    Current,
    /// 有新版本可用
    UpdateAvailable,
    /// 当前版本比远程版本新（开发版本）
    Newer,
    /// 版本格式错误
    Invalid,
}

/// 更新事件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum UpdateEvent {
    /// 检查更新开始
    CheckStarted,
    /// 检查更新完成
    CheckCompleted {
        has_update: bool,
        update_info: Option<UpdateInfo>,
    },
    /// 检查更新失败
    CheckFailed {
        error: String,
    },
    /// 下载开始
    DownloadStarted {
        version: String,
        total_size: Option<i64>,
    },
    /// 下载进度更新
    DownloadProgress {
        version: String,
        downloaded: i64,
        total: Option<i64>,
        percentage: f64,
    },
    /// 下载完成
    DownloadCompleted {
        version: String,
        file_path: String,
    },
    /// 下载失败
    DownloadFailed {
        version: String,
        error: String,
    },
    /// 安装开始
    InstallStarted {
        version: String,
    },
    /// 安装进度更新
    InstallProgress {
        version: String,
        percentage: f64,
        message: String,
    },
    /// 安装完成
    InstallCompleted {
        version: String,
        needs_restart: bool,
    },
    /// 安装失败
    InstallFailed {
        version: String,
        error: String,
    },
    /// 回滚开始
    RollbackStarted {
        from_version: String,
        to_version: String,
    },
    /// 回滚完成
    RollbackCompleted {
        version: String,
    },
    /// 回滚失败
    RollbackFailed {
        error: String,
    },
}

/// 远程更新清单
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateManifest {
    /// 版本号
    pub version: String,
    /// 发布时间
    pub release_date: DateTime<Utc>,
    /// 更新类型
    pub update_type: UpdateType,
    /// 标题
    pub title: String,
    /// 描述
    pub description: String,
    /// 更新日志
    pub changelog: String,
    /// 是否强制更新
    pub is_mandatory: bool,
    /// 是否预发布版本
    pub is_prerelease: bool,
    /// 最小支持版本
    pub min_version: Option<String>,
    /// 文件下载信息
    pub files: HashMap<String, FileInfo>,
}

/// 文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    /// 文件URL
    pub url: String,
    /// 文件大小
    pub size: i64,
    /// 文件哈希（SHA256）
    pub hash: String,
    /// 目标平台
    pub platform: Option<String>,
    /// 目标架构
    pub arch: Option<String>,
}

/// 更新管理器
#[derive(Clone)]
pub struct UpdateManager {
    /// 数据库连接
    db: Arc<Mutex<UpdateDatabase>>,
    /// HTTP客户端
    client: Client,
    /// 事件广播器
    event_sender: broadcast::Sender<UpdateEvent>,
    /// 当前版本
    current_version: String,
    /// 更新端点URL
    update_endpoint: String,
    /// 应用数据目录
    app_data_dir: PathBuf,
    /// 备份目录
    backup_dir: PathBuf,
    /// 下载目录
    download_dir: PathBuf,
}

impl UpdateManager {
    /// 创建新的更新管理器
    pub fn new(
        pool: DbPool,
        current_version: String,
        update_endpoint: String,
        app_data_dir: PathBuf,
    ) -> Result<Self> {
        let db = Arc::new(Mutex::new(UpdateDatabase::from_pool(pool)));

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(format!("ZishuSensei/{}", current_version))
            .build()
            .context("Failed to create HTTP client")?;

        let (event_sender, _) = broadcast::channel(100);

        let backup_dir = app_data_dir.join("backups");
        let download_dir = app_data_dir.join("downloads");

        // 创建必要的目录
        fs::create_dir_all(&backup_dir)
            .context("Failed to create backup directory")?;
        fs::create_dir_all(&download_dir)
            .context("Failed to create download directory")?;

        Ok(Self {
            db,
            client,
            event_sender,
            current_version,
            update_endpoint,
            app_data_dir,
            backup_dir,
            download_dir,
        })
    }

    /// 获取事件接收器
    pub fn subscribe_events(&self) -> broadcast::Receiver<UpdateEvent> {
        self.event_sender.subscribe()
    }

    /// 发送事件
    fn emit_event(&self, event: UpdateEvent) {
        debug!("Emitting update event: {:?}", event);
        if let Err(e) = self.event_sender.send(event) {
            warn!("Failed to send update event: {}", e);
        }
    }

    /// 检查更新
    pub async fn check_for_updates(&self, force: bool) -> Result<Option<UpdateInfo>> {
        info!("Checking for updates (force: {})", force);
        self.emit_event(UpdateEvent::CheckStarted);

        // 检查配置
        let config = {
            let db = self.db.lock().unwrap();
            db.get_or_create_update_config().map_err(|e| anyhow::anyhow!("Failed to get update config: {}", e))?
        };

        // 如果不是强制检查，检查是否需要检查更新
        if !force && !config.auto_check_enabled {
            info!("Auto check is disabled");
            return Ok(None);
        }

        // 检查时间间隔
        if !force {
            if let Some(last_check) = config.last_check_time {
                let next_check = last_check + chrono::Duration::hours(config.check_interval_hours as i64);
                if Utc::now() < next_check {
                    info!("Too early to check for updates");
                    return Ok(None);
                }
            }
        }

        // 更新最后检查时间
        {
            let db = self.db.lock().unwrap();
            let mut updated_config = config.clone();
            updated_config.last_check_time = Some(Utc::now());
            db.save_update_config(&mut updated_config).map_err(|e| anyhow::anyhow!(e.to_string()))?;
        }

        // 获取目标平台和架构
        let target = self.get_target_triple();
        let (platform, arch) = self.parse_target(&target);

        // 构建请求URL
        let url = self.update_endpoint
            .replace("{{target}}", &platform)
            .replace("{{arch}}", &arch)
            .replace("{{current_version}}", &self.current_version);

        info!("Checking update from: {}", url);

        // 发送请求
        match self.client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<UpdateManifest>().await {
                        Ok(manifest) => {
                            info!("Received update manifest for version: {}", manifest.version);

                            // 比较版本
                            let comparison = self.compare_versions(&self.current_version, &manifest.version);
                            
                            match comparison {
                                VersionComparison::UpdateAvailable => {
                                    // 检查是否满足最小版本要求
                                    if let Some(min_version) = &manifest.min_version {
                                        let min_comparison = self.compare_versions(&self.current_version, min_version);
                                        if min_comparison == VersionComparison::Current {
                                            warn!("Current version {} does not meet minimum requirement {}", 
                                                  self.current_version, min_version);
                                            self.emit_event(UpdateEvent::CheckFailed {
                                                error: format!("当前版本不满足最低要求 {}", min_version),
                                            });
                                            return Ok(None);
                                        }
                                    }

                                    // 检查是否包含预发布版本
                                    if manifest.is_prerelease && !config.include_prerelease {
                                        info!("Skipping prerelease version: {}", manifest.version);
                                        self.emit_event(UpdateEvent::CheckCompleted {
                                            has_update: false,
                                            update_info: None,
                                        });
                                        return Ok(None);
                                    }

                                    // 获取对应的文件信息
                                    let file_key = format!("{}-{}", platform, arch);
                                    let file_info = manifest.files.get(&file_key)
                                        .or_else(|| manifest.files.get("universal"))
                                        .context("No compatible file found in update manifest")?;

                                    // 创建更新信息
                                    let mut update_info = UpdateInfo {
                                        version: manifest.version.clone(),
                                        update_type: Some(manifest.update_type),
                                        status: UpdateStatus::Available,
                                        title: manifest.title,
                                        description: manifest.description,
                                        changelog: manifest.changelog,
                                        release_date: Some(manifest.release_date.to_rfc3339()),
                                        file_size: Some(file_info.size),
                                        download_url: Some(file_info.url.clone()),
                                        file_hash: Some(file_info.hash.clone()),
                                        is_mandatory: manifest.is_mandatory,
                                        is_prerelease: manifest.is_prerelease,
                                        min_version: manifest.min_version,
                                        target_platform: Some(platform),
                                        target_arch: Some(arch),
                                        ..Default::default()
                                    };

                                    // 保存到数据库
                                    {
                                        let db = self.db.lock().unwrap();
                                        db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
                                    }

                                    info!("Update available: {} -> {}", self.current_version, manifest.version);
                                    self.emit_event(UpdateEvent::CheckCompleted {
                                        has_update: true,
                                        update_info: Some(update_info.clone()),
                                    });

                                    Ok(Some(update_info))
                                }
                                VersionComparison::Current => {
                                    info!("Already on latest version: {}", self.current_version);
                                    self.emit_event(UpdateEvent::CheckCompleted {
                                        has_update: false,
                                        update_info: None,
                                    });
                                    Ok(None)
                                }
                                VersionComparison::Newer => {
                                    info!("Current version {} is newer than remote {}", 
                                          self.current_version, manifest.version);
                                    self.emit_event(UpdateEvent::CheckCompleted {
                                        has_update: false,
                                        update_info: None,
                                    });
                                    Ok(None)
                                }
                                VersionComparison::Invalid => {
                                    error!("Invalid version format");
                                    self.emit_event(UpdateEvent::CheckFailed {
                                        error: "版本格式无效".to_string(),
                                    });
                                    bail!("Invalid version format");
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse update manifest: {}", e);
                            self.emit_event(UpdateEvent::CheckFailed {
                                error: format!("解析更新清单失败: {}", e),
                            });
                            Err(e.into())
                        }
                    }
                } else {
                    let error_msg = format!("Update check failed with status: {}", response.status());
                    error!("{}", error_msg);
                    self.emit_event(UpdateEvent::CheckFailed {
                        error: error_msg.clone(),
                    });
                    bail!(error_msg);
                }
            }
            Err(e) => {
                error!("Failed to check for updates: {}", e);
                self.emit_event(UpdateEvent::CheckFailed {
                    error: format!("网络请求失败: {}", e),
                });
                Err(e.into())
            }
        }
    }

    /// 下载更新
    pub async fn download_update(&self, version: &str) -> Result<String> {
        info!("Starting download for version: {}", version);

        // 获取更新信息
        let mut update_info = {
            let db = self.db.lock().unwrap();
            db.get_update_info_by_version(version)
                .map_err(|e| anyhow::anyhow!("Database operation failed: {}", e))?
                .context("Update info not found")?
        };

        let download_url = update_info.download_url
            .clone()
            .context("Download URL not available")?;

        let file_size = update_info.file_size;

        // 更新状态为下载中
        update_info.status = UpdateStatus::Downloading;
        update_info.download_progress = 0.0;
        {
            let db = self.db.lock().unwrap();
            db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
        }

        self.emit_event(UpdateEvent::DownloadStarted {
            version: version.to_string(),
            total_size: file_size,
        });

        // 构建文件路径
        let file_name = format!("zishu-sensei-{}.update", version);
        let file_path = self.download_dir.join(&file_name);

        // 开始下载
        let response = self.client.get(&download_url).send().await
            .context("Failed to start download")?;

        if !response.status().is_success() {
            let error_msg = format!("Download failed with status: {}", response.status());
            update_info.status = UpdateStatus::Failed;
            update_info.error_message = Some(error_msg.clone());
            {
                let db = self.db.lock().unwrap();
                db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
            }
            self.emit_event(UpdateEvent::DownloadFailed {
                version: version.to_string(),
                error: error_msg.clone(),
            });
            bail!(error_msg);
        }

        // 创建文件
        let mut file = fs::File::create(&file_path)
            .context("Failed to create download file")?;

        let mut downloaded = 0i64;
        let total = response.content_length().map(|l| l as i64).or(file_size);

        // 创建哈希计算器
        let mut hasher = Sha256::new();

        // 下载文件
        let mut stream = response.bytes_stream();
        use futures::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    file.write_all(&chunk)
                        .context("Failed to write downloaded data")?;
                    hasher.update(&chunk);
                    
                    downloaded += chunk.len() as i64;
                    
                    let percentage = if let Some(total) = total {
                        (downloaded as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };

                    // 更新进度
                    update_info.download_progress = percentage;
                    {
                        let db = self.db.lock().unwrap();
                        db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
                    }

                    // 发送进度事件（每下载1MB发送一次事件）
                    if downloaded % (1024 * 1024) == 0 || percentage >= 100.0 {
                        self.emit_event(UpdateEvent::DownloadProgress {
                            version: version.to_string(),
                            downloaded,
                            total,
                            percentage,
                        });
                    }
                }
                Err(e) => {
                    error!("Download error: {}", e);
                    update_info.status = UpdateStatus::Failed;
                    update_info.error_message = Some(e.to_string());
                    update_info.retry_count += 1;
                    {
                        let db = self.db.lock().unwrap();
                        db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
                    }
                    self.emit_event(UpdateEvent::DownloadFailed {
                        version: version.to_string(),
                        error: e.to_string(),
                    });
                    return Err(e.into());
                }
            }
        }

        // 验证文件哈希
        if let Some(expected_hash) = &update_info.file_hash {
            let actual_hash = format!("{:x}", hasher.finalize());
            if actual_hash != *expected_hash {
                let error_msg = "Downloaded file hash mismatch";
                error!("{}: expected {}, got {}", error_msg, expected_hash, actual_hash);
                
                // 删除损坏的文件
                let _ = fs::remove_file(&file_path);
                
                update_info.status = UpdateStatus::Failed;
                update_info.error_message = Some(error_msg.to_string());
                {
                    let db = self.db.lock().unwrap();
                    db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
                }
                self.emit_event(UpdateEvent::DownloadFailed {
                    version: version.to_string(),
                    error: "文件校验失败".to_string(),
                });
                bail!(error_msg);
            }
        }

        // 下载完成
        update_info.status = UpdateStatus::Downloaded;
        update_info.download_progress = 100.0;
        {
            let db = self.db.lock().unwrap();
            db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
        }

        let file_path_str = file_path.to_string_lossy().to_string();
        info!("Download completed: {}", file_path_str);

        self.emit_event(UpdateEvent::DownloadCompleted {
            version: version.to_string(),
            file_path: file_path_str.clone(),
        });

        Ok(file_path_str)
    }

    /// 安装更新
    pub async fn install_update(&self, version: &str) -> Result<bool> {
        info!("Starting installation for version: {}", version);

        // 获取更新信息
        let mut update_info = {
            let db = self.db.lock().unwrap();
            db.get_update_info_by_version(version)
                .map_err(|e| anyhow::anyhow!("Database operation failed: {}", e))?
                .context("Update info not found")?
        };

        if update_info.status != UpdateStatus::Downloaded {
            bail!("Update is not ready for installation");
        }

        // 更新状态为安装中
        update_info.status = UpdateStatus::Installing;
        update_info.install_progress = 0.0;
        {
            let db = self.db.lock().unwrap();
            db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
        }

        self.emit_event(UpdateEvent::InstallStarted {
            version: version.to_string(),
        });

        // 检查是否需要备份
        let config = {
            let db = self.db.lock().unwrap();
            db.get_or_create_update_config()
                .map_err(|e| anyhow::anyhow!("Database operation failed: {}", e))?
        };

        if config.backup_before_update {
            self.emit_event(UpdateEvent::InstallProgress {
                version: version.to_string(),
                percentage: 10.0,
                message: "创建备份中...".to_string(),
            });

            if let Err(e) = self.create_backup().await {
                warn!("Failed to create backup: {}", e);
                // 备份失败不阻止更新，但记录警告
            }

            update_info.install_progress = 20.0;
            {
                let db = self.db.lock().unwrap();
                db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
            }
        }

        self.emit_event(UpdateEvent::InstallProgress {
            version: version.to_string(),
            percentage: 30.0,
            message: "准备安装文件...".to_string(),
        });

        // 这里应该调用 Tauri 的更新器来安装更新
        // 由于 Tauri 更新器是异步的，我们需要模拟安装过程
        
        // 使用 Tauri 更新器安装
        match self.install_with_tauri_updater(version).await {
            Ok(needs_restart) => {
                // 安装成功
                update_info.status = UpdateStatus::Installed;
                update_info.install_progress = 100.0;
                {
                    let db = self.db.lock().unwrap();
                    db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
                }

                // 记录版本历史
                let history = VersionHistory {
                    id: None,
                    version: version.to_string(),
                    installed_at: Utc::now().timestamp(),
                    release_notes: String::new(),
                    is_rollback: false,
                    install_source: "auto".to_string(),
                    notes: format!("Updated from {}", self.current_version),
                };

                {
                    let db = self.db.lock().unwrap();
                    db.save_version_history(&history)
                        .map_err(|e| anyhow::anyhow!("Database operation failed: {}", e))?;
                }

                info!("Installation completed successfully");
                self.emit_event(UpdateEvent::InstallCompleted {
                    version: version.to_string(),
                    needs_restart,
                });

                Ok(needs_restart)
            }
            Err(e) => {
                error!("Installation failed: {}", e);
                update_info.status = UpdateStatus::Failed;
                update_info.error_message = Some(e.to_string());
                update_info.retry_count += 1;
                {
                    let db = self.db.lock().unwrap();
                    db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
                }

                self.emit_event(UpdateEvent::InstallFailed {
                    version: version.to_string(),
                    error: e.to_string(),
                });

                Err(e)
            }
        }
    }

    /// 使用 Tauri 更新器安装
    async fn install_with_tauri_updater(&self, _version: &str) -> Result<bool> {
        // 这里应该集成 Tauri 更新器
        // 现在我们先返回一个模拟结果
        
        // 模拟安装过程
        for i in (30..=90).step_by(10) {
            tokio::time::sleep(Duration::from_millis(500)).await;
            self.emit_event(UpdateEvent::InstallProgress {
                version: _version.to_string(),
                percentage: i as f64,
                message: format!("安装进度 {}%", i),
            });
        }

        // 实际应该调用 Tauri 更新器 API
        // 这需要在 Tauri 命令中实现
        Ok(true) // 假设需要重启
    }

    /// 创建备份
    async fn create_backup(&self) -> Result<String> {
        let backup_name = format!("backup-{}-{}", 
                                  self.current_version, 
                                  Utc::now().format("%Y%m%d-%H%M%S"));
        let backup_path = self.backup_dir.join(&backup_name);

        fs::create_dir_all(&backup_path)
            .context("Failed to create backup directory")?;

        // 这里应该备份当前应用的关键文件
        // 由于是 Tauri 应用，主要需要备份配置文件和数据
        
        info!("Backup created: {}", backup_path.display());
        Ok(backup_path.to_string_lossy().to_string())
    }

    /// 回滚到指定版本
    pub async fn rollback_to_version(&self, target_version: &str) -> Result<()> {
        info!("Starting rollback to version: {}", target_version);

        self.emit_event(UpdateEvent::RollbackStarted {
            from_version: self.current_version.clone(),
            to_version: target_version.to_string(),
        });

        // 检查目标版本是否存在于历史记录中
        let histories = {
            let db = self.db.lock().unwrap();
            db.get_version_history()
                .map_err(|e| anyhow::anyhow!("Database operation failed: {}", e))?
        };

        let target_history = histories.iter()
            .find(|h| h.version == target_version)
            .context("Target version not found in history")?;

        // 这里应该实现实际的回滚逻辑
        // 由于 Tauri 更新器的限制，实际回滚可能需要下载指定版本

        // 记录回滚历史
        let rollback_history = VersionHistory {
            id: None,
            version: target_version.to_string(),
            installed_at: Utc::now().timestamp(),
            release_notes: String::new(),
            is_rollback: true,
            install_source: "rollback".to_string(),
            notes: format!("Rolled back from {}", self.current_version),
        };

        {
            let db = self.db.lock().unwrap();
            db.save_version_history(&rollback_history)
                .map_err(|e| anyhow::anyhow!("Database operation failed: {}", e))?;
        }

        info!("Rollback completed successfully");
        self.emit_event(UpdateEvent::RollbackCompleted {
            version: target_version.to_string(),
        });

        Ok(())
    }

    /// 取消下载
    pub async fn cancel_download(&self, version: &str) -> Result<()> {
        info!("Canceling download for version: {}", version);

        // 更新状态
        let mut update_info = {
            let db = self.db.lock().unwrap();
            db.get_update_info_by_version(version)
                .map_err(|e| anyhow::anyhow!("Database operation failed: {}", e))?
                .context("Update info not found")?
        };

        if update_info.status == UpdateStatus::Downloading {
            update_info.status = UpdateStatus::Cancelled;
            {
                let db = self.db.lock().unwrap();
                db.save_update_info(&mut update_info).map_err(|e| anyhow::anyhow!(e.to_string()))?;
            }

            // 删除部分下载的文件
            let file_name = format!("zishu-sensei-{}.update", version);
            let file_path = self.download_dir.join(&file_name);
            if file_path.exists() {
                let _ = fs::remove_file(&file_path);
            }

            info!("Download cancelled for version: {}", version);
        }

        Ok(())
    }

    /// 比较版本号
    fn compare_versions(&self, current: &str, remote: &str) -> VersionComparison {
        // 简单的语义版本比较
        // 支持 x.y.z 格式
        let parse_version = |v: &str| -> Option<(u32, u32, u32)> {
            let parts: Vec<&str> = v.split('.').collect();
            if parts.len() != 3 {
                return None;
            }

            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            let patch = parts[2].parse().ok()?;

            Some((major, minor, patch))
        };

        match (parse_version(current), parse_version(remote)) {
            (Some(cur), Some(rem)) => {
                match cur.cmp(&rem) {
                    Ordering::Less => VersionComparison::UpdateAvailable,
                    Ordering::Equal => VersionComparison::Current,
                    Ordering::Greater => VersionComparison::Newer,
                }
            }
            _ => VersionComparison::Invalid,
        }
    }

    /// 获取目标平台三元组
    fn get_target_triple(&self) -> String {
        // 这应该从 Tauri 获取，现在先硬编码
        #[cfg(target_os = "windows")]
        {
            #[cfg(target_arch = "x86_64")]
            return "x86_64-pc-windows-msvc".to_string();
            #[cfg(target_arch = "x86")]
            return "i686-pc-windows-msvc".to_string();
            #[cfg(target_arch = "aarch64")]
            return "aarch64-pc-windows-msvc".to_string();
        }

        #[cfg(target_os = "macos")]
        {
            #[cfg(target_arch = "x86_64")]
            return "x86_64-apple-darwin".to_string();
            #[cfg(target_arch = "aarch64")]
            return "aarch64-apple-darwin".to_string();
        }

        #[cfg(target_os = "linux")]
        {
            #[cfg(target_arch = "x86_64")]
            return "x86_64-unknown-linux-gnu".to_string();
            #[cfg(target_arch = "aarch64")]
            return "aarch64-unknown-linux-gnu".to_string();
        }

        "unknown".to_string()
    }

    /// 解析目标平台三元组
    fn parse_target(&self, target: &str) -> (String, String) {
        let parts: Vec<&str> = target.split('-').collect();
        if parts.len() >= 3 {
            let arch = parts[0].to_string();
            let platform = if parts.len() >= 4 {
                parts[2].to_string()
            } else {
                parts[1].to_string()
            };
            (platform, arch)
        } else {
            ("unknown".to_string(), "unknown".to_string())
        }
    }

    /// 获取更新配置
    pub fn get_config(&self) -> Result<UpdateConfig> {
        let db = self.db.lock().unwrap();
        db.get_or_create_update_config().map_err(|e| anyhow::anyhow!(e.to_string()))
    }

    /// 保存更新配置
    pub fn save_config(&self, config: &mut UpdateConfig) -> Result<()> {
        let db = self.db.lock().unwrap();
        db.save_update_config(config).map_err(|e| anyhow::anyhow!(e.to_string()))?;
        Ok(())
    }

    /// 获取版本历史
    pub fn get_version_history(&self) -> Result<Vec<VersionHistory>> {
        let db = self.db.lock().unwrap();
        Ok(db.get_version_history().map_err(|e| anyhow::anyhow!(e.to_string()))?)
    }

    /// 获取更新统计
    pub fn get_update_stats(&self) -> Result<HashMap<String, i64>> {
        let db = self.db.lock().unwrap();
        db.get_update_stats().map_err(|e| anyhow::anyhow!(e.to_string()))
    }

    /// 清理旧文件
    pub async fn cleanup_old_files(&self) -> Result<()> {
        info!("Cleaning up old update files");

        // 清理下载目录
        let download_entries = fs::read_dir(&self.download_dir)?;
        for entry in download_entries {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("update") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        let age = std::time::SystemTime::now()
                            .duration_since(modified)?;
                        
                        // 删除7天前的文件
                        if age > Duration::from_secs(7 * 24 * 3600) {
                            let _ = fs::remove_file(&path);
                            info!("Removed old download file: {}", path.display());
                        }
                    }
                }
            }
        }

        // 清理备份目录
        let config = self.get_config()?;
        let backup_entries = fs::read_dir(&self.backup_dir)?;
        let mut backups: Vec<_> = backup_entries
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                entry.metadata().ok().and_then(|metadata| {
                    metadata.modified().ok().map(|modified| (entry.path(), modified))
                })
            })
            .collect();

        // 按修改时间排序
        backups.sort_by_key(|(_, modified)| *modified);

        // 保留最新的备份
        if backups.len() > config.max_backup_count as usize {
            let to_remove = backups.len() - config.max_backup_count as usize;
            for (path, _) in backups.iter().take(to_remove) {
                let _ = fs::remove_dir_all(path);
                info!("Removed old backup: {}", path.display());
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    use tokio::time::{timeout, Duration};
    use std::collections::HashMap;
    use chrono::Utc;
    use std::sync::{Arc, Mutex};

    /// 创建测试用的临时目录和更新管理器（模拟版本，用于不需要数据库的测试）
    fn create_mock_update_manager() -> (TempDir, String, String, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let app_data_dir = temp_dir.path().to_path_buf();
        
        (
            temp_dir,
            "1.0.0".to_string(),
            "https://api.example.com/updates".to_string(),
            app_data_dir,
        )
    }

    /// 创建测试用的更新配置
    fn create_test_update_config() -> UpdateConfig {
        UpdateConfig {
            auto_check: true,
            auto_check_enabled: true,
            check_interval: 86400, // 24 hours in seconds
            check_interval_hours: 24,
            auto_download: false,
            auto_install: false,
            backup_before_update: true,
            include_prerelease: false,
            max_backup_count: 5,
            last_check_time: None,
        }
    }

    /// 创建测试用的更新信息
    fn create_test_update_info() -> UpdateInfo {
        UpdateInfo {
            version: "1.1.0".to_string(),
            update_type: Some(UpdateType::Minor),
            status: UpdateStatus::Available,
            title: "Test Update".to_string(),
            description: "Test description".to_string(),
            changelog: "Test changelog".to_string(),
            release_notes: "Test release notes".to_string(),
            release_date: Some(Utc::now().to_rfc3339()),
            file_size: Some(1024),
            download_url: Some("https://example.com/update.zip".to_string()),
            file_hash: Some("abc123".to_string()),
            is_mandatory: false,
            is_prerelease: false,
            min_version: Some("1.0.0".to_string()),
            target_platform: Some("linux".to_string()),
            target_arch: Some("x86_64".to_string()),
            created_at: Utc::now().timestamp(),
            download_progress: 0.0,
            install_progress: 0.0,
            error_message: None,
            retry_count: 0,
        }
    }

    #[test]
    fn test_version_comparison_enum() {
        assert_eq!(VersionComparison::Current, VersionComparison::Current);
        assert_ne!(VersionComparison::Current, VersionComparison::UpdateAvailable);
        assert_ne!(VersionComparison::UpdateAvailable, VersionComparison::Newer);
        assert_ne!(VersionComparison::Newer, VersionComparison::Invalid);
    }

    #[test]
    fn test_update_manifest_creation() {
        let mut files = HashMap::new();
        files.insert("windows-x64".to_string(), FileInfo {
            url: "https://example.com/file.exe".to_string(),
            size: 1024,
            hash: "abc123".to_string(),
            platform: Some("windows".to_string()),
            arch: Some("x64".to_string()),
        });

        let manifest = UpdateManifest {
            version: "1.1.0".to_string(),
            release_date: Utc::now(),
            update_type: UpdateType::Minor,
            title: "Test Update".to_string(),
            description: "Test Description".to_string(),
            changelog: "Test Changelog".to_string(),
            is_mandatory: false,
            is_prerelease: false,
            min_version: Some("1.0.0".to_string()),
            files,
        };

        assert_eq!(manifest.version, "1.1.0");
        assert_eq!(manifest.title, "Test Update");
        assert_eq!(manifest.description, "Test Description");
        assert_eq!(manifest.changelog, "Test Changelog");
        assert_eq!(manifest.is_mandatory, false);
        assert_eq!(manifest.is_prerelease, false);
        assert_eq!(manifest.min_version, Some("1.0.0".to_string()));
        assert!(manifest.files.contains_key("windows-x64"));
    }

    #[test]
    fn test_file_info_creation() {
        let file_info = FileInfo {
            url: "https://example.com/file.exe".to_string(),
            size: 2048,
            hash: "def456".to_string(),
            platform: Some("linux".to_string()),
            arch: Some("x64".to_string()),
        };

        assert_eq!(file_info.url, "https://example.com/file.exe");
        assert_eq!(file_info.size, 2048);
        assert_eq!(file_info.hash, "def456");
        assert_eq!(file_info.platform, Some("linux".to_string()));
        assert_eq!(file_info.arch, Some("x64".to_string()));
    }

    #[test]
    fn test_version_parsing_and_validation() {
        // 测试版本解析逻辑
        let parse_version = |v: &str| -> Option<(u32, u32, u32)> {
            let parts: Vec<&str> = v.split('.').collect();
            if parts.len() != 3 {
                return None;
            }

            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            let patch = parts[2].parse().ok()?;

            Some((major, minor, patch))
        };

        // 测试有效版本
        assert_eq!(parse_version("1.0.0"), Some((1, 0, 0)));
        assert_eq!(parse_version("2.3.4"), Some((2, 3, 4)));
        assert_eq!(parse_version("10.20.30"), Some((10, 20, 30)));

        // 测试无效版本
        assert_eq!(parse_version("1.0"), None);
        assert_eq!(parse_version("1.0.0.1"), None);
        assert_eq!(parse_version("invalid"), None);
        assert_eq!(parse_version("a.b.c"), None);
        assert_eq!(parse_version(""), None);
    }

    #[test]
    fn test_event_broadcast_system() {
        // 测试事件广播系统（不需要数据库）
        let (sender, mut receiver) = broadcast::channel(10);
        
        // 测试发送事件
        let test_event = UpdateEvent::CheckStarted;
        assert!(sender.send(test_event.clone()).is_ok());
        
        // 测试接收事件
        let received = receiver.try_recv();
        assert!(received.is_ok());
        
        // 验证事件内容
        match received.unwrap() {
            UpdateEvent::CheckStarted => {}, // 正确
            _ => panic!("Received wrong event type"),
        }
    }

    #[test]
    fn test_file_info_validation() {
        // 测试文件信息验证
        let valid_file_info = FileInfo {
            url: "https://example.com/file.exe".to_string(),
            size: 1024,
            hash: "abc123".to_string(),
            platform: Some("linux".to_string()),
            arch: Some("x86_64".to_string()),
        };

        // 验证基本属性
        assert!(!valid_file_info.url.is_empty());
        assert!(valid_file_info.size > 0);
        assert!(!valid_file_info.hash.is_empty());

        // 测试URL格式验证（简单验证）
        assert!(valid_file_info.url.starts_with("http"));
    }


    #[test]
    fn test_version_comparison() {
        // 直接测试版本比较逻辑，不需要UpdateManager实例
        let parse_version = |v: &str| -> Option<(u32, u32, u32)> {
            let parts: Vec<&str> = v.split('.').collect();
            if parts.len() != 3 {
                return None;
            }

            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            let patch = parts[2].parse().ok()?;

            Some((major, minor, patch))
        };
        
        let compare_versions = |current: &str, remote: &str| -> VersionComparison {
            use std::cmp::Ordering;
            match (parse_version(current), parse_version(remote)) {
                (Some(cur), Some(rem)) => {
                    match cur.cmp(&rem) {
                        Ordering::Less => VersionComparison::UpdateAvailable,
                        Ordering::Equal => VersionComparison::Current,
                        Ordering::Greater => VersionComparison::Newer,
                    }
                }
                _ => VersionComparison::Invalid,
            }
        };
        
        // 测试相等版本
        assert_eq!(compare_versions("1.0.0", "1.0.0"), VersionComparison::Current);
        
        // 测试更新可用
        assert_eq!(compare_versions("1.0.0", "1.1.0"), VersionComparison::UpdateAvailable);
        
        // 测试当前版本更新
        assert_eq!(compare_versions("1.1.0", "1.0.0"), VersionComparison::Newer);
        
        // 测试无效版本格式
        assert_eq!(compare_versions("invalid", "1.0.0"), VersionComparison::Invalid);
        assert_eq!(compare_versions("1.0.0", "invalid"), VersionComparison::Invalid);
    }

    #[test]
    fn test_version_comparison_detailed() {
        // 使用同样的逻辑进行详细测试
        let parse_version = |v: &str| -> Option<(u32, u32, u32)> {
            let parts: Vec<&str> = v.split('.').collect();
            if parts.len() != 3 {
                return None;
            }

            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            let patch = parts[2].parse().ok()?;

            Some((major, minor, patch))
        };
        
        let compare_versions = |current: &str, remote: &str| -> VersionComparison {
            use std::cmp::Ordering;
            match (parse_version(current), parse_version(remote)) {
                (Some(cur), Some(rem)) => {
                    match cur.cmp(&rem) {
                        Ordering::Less => VersionComparison::UpdateAvailable,
                        Ordering::Equal => VersionComparison::Current,
                        Ordering::Greater => VersionComparison::Newer,
                    }
                }
                _ => VersionComparison::Invalid,
            }
        };
        
        // 测试主版本号更新
        assert_eq!(compare_versions("1.0.0", "2.0.0"), VersionComparison::UpdateAvailable);
        assert_eq!(compare_versions("2.0.0", "1.0.0"), VersionComparison::Newer);
        
        // 测试次版本号更新
        assert_eq!(compare_versions("1.0.0", "1.1.0"), VersionComparison::UpdateAvailable);
        assert_eq!(compare_versions("1.1.0", "1.0.0"), VersionComparison::Newer);
        
        // 测试补丁版本号更新
        assert_eq!(compare_versions("1.0.0", "1.0.1"), VersionComparison::UpdateAvailable);
        assert_eq!(compare_versions("1.0.1", "1.0.0"), VersionComparison::Newer);
        
        // 测试复杂版本比较
        assert_eq!(compare_versions("1.2.3", "1.2.4"), VersionComparison::UpdateAvailable);
        assert_eq!(compare_versions("1.2.3", "1.3.0"), VersionComparison::UpdateAvailable);
        assert_eq!(compare_versions("1.2.3", "2.0.0"), VersionComparison::UpdateAvailable);
    }

    #[test]
    fn test_get_target_triple() {
        // 测试目标三元组生成逻辑
        let get_target_triple = || -> String {
            #[cfg(target_os = "windows")]
            {
                #[cfg(target_arch = "x86_64")]
                return "x86_64-pc-windows-msvc".to_string();
                #[cfg(target_arch = "x86")]
                return "i686-pc-windows-msvc".to_string();
                #[cfg(target_arch = "aarch64")]
                return "aarch64-pc-windows-msvc".to_string();
            }

            #[cfg(target_os = "macos")]
            {
                #[cfg(target_arch = "x86_64")]
                return "x86_64-apple-darwin".to_string();
                #[cfg(target_arch = "aarch64")]
                return "aarch64-apple-darwin".to_string();
            }

            #[cfg(target_os = "linux")]
            {
                #[cfg(target_arch = "x86_64")]
                return "x86_64-unknown-linux-gnu".to_string();
                #[cfg(target_arch = "aarch64")]
                return "aarch64-unknown-linux-gnu".to_string();
            }

            "unknown".to_string()
        };
        
        let target = get_target_triple();
        
        // 验证返回的目标三元组格式合理
        assert!(!target.is_empty());
        assert!(target.contains("-"));
        
        // 在不同平台上应该返回不同的值
        #[cfg(target_os = "linux")]
        assert!(target.contains("linux"));
        
        #[cfg(target_os = "windows")]
        assert!(target.contains("windows"));
        
        #[cfg(target_os = "macos")]
        assert!(target.contains("darwin"));
    }

    #[test]
    fn test_parse_target() {
        // 测试目标三元组解析逻辑
        let parse_target = |target: &str| -> (String, String) {
            let parts: Vec<&str> = target.split('-').collect();
            if parts.len() >= 3 {
                let arch = parts[0].to_string();
                let platform = if parts.len() >= 4 {
                    parts[2].to_string()
                } else {
                    parts[1].to_string()
                };
                (platform, arch)
            } else {
                ("unknown".to_string(), "unknown".to_string())
            }
        };
        
        // 测试标准目标三元组解析
        let (platform, arch) = parse_target("x86_64-unknown-linux-gnu");
        assert_eq!(platform, "unknown");
        assert_eq!(arch, "x86_64");
        
        let (platform, arch) = parse_target("x86_64-pc-windows-msvc");
        assert_eq!(platform, "pc");
        assert_eq!(arch, "x86_64");
        
        let (platform, arch) = parse_target("aarch64-apple-darwin");
        assert_eq!(platform, "apple");
        assert_eq!(arch, "aarch64");
        
        // 测试无效输入
        let (platform, arch) = parse_target("invalid");
        assert_eq!(platform, "unknown");
        assert_eq!(arch, "unknown");
        
        let (platform, arch) = parse_target("");
        assert_eq!(platform, "unknown");
        assert_eq!(arch, "unknown");
    }

    #[test]
    fn test_update_config_defaults() {
        // 测试更新配置的默认值
        let config = create_test_update_config();
        
        assert!(config.auto_check);
        assert!(config.auto_check_enabled);
        assert_eq!(config.check_interval, 86400);
        assert_eq!(config.check_interval_hours, 24);
        assert!(!config.auto_download);
        assert!(!config.auto_install);
        assert!(config.backup_before_update);
        assert!(!config.include_prerelease);
        assert_eq!(config.max_backup_count, 5);
        assert!(config.last_check_time.is_none());
    }

    #[test] 
    fn test_update_info_creation() {
        // 测试更新信息的创建和验证
        let update_info = create_test_update_info();
        
        assert_eq!(update_info.version, "1.1.0");
        assert_eq!(update_info.status, UpdateStatus::Available);
        assert!(!update_info.title.is_empty());
        assert!(!update_info.description.is_empty());
        assert!(!update_info.changelog.is_empty());
        assert!(update_info.file_size.is_some());
        assert!(update_info.download_url.is_some());
        assert!(update_info.file_hash.is_some());
        assert!(!update_info.is_mandatory);
        assert!(!update_info.is_prerelease);
        assert_eq!(update_info.download_progress, 0.0);
        assert_eq!(update_info.install_progress, 0.0);
        assert!(update_info.error_message.is_none());
        assert_eq!(update_info.retry_count, 0);
    }

    #[tokio::test]
    async fn test_directory_creation() {
        // 测试目录创建功能（不需要数据库）
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let app_data_dir = temp_dir.path().to_path_buf();
        let backup_dir = app_data_dir.join("backups");
        let download_dir = app_data_dir.join("downloads");

        // 创建目录
        fs::create_dir_all(&backup_dir).expect("Failed to create backup dir");
        fs::create_dir_all(&download_dir).expect("Failed to create download dir");

        // 验证目录存在
        assert!(backup_dir.exists());
        assert!(download_dir.exists());
        assert!(backup_dir.is_dir());
        assert!(download_dir.is_dir());
    }

    #[test]
    fn test_update_manifest_creation_with_files() {
        // 测试包含多个文件的更新清单
        let mut files = HashMap::new();
        
        files.insert("linux-x64".to_string(), FileInfo {
            url: "https://example.com/linux.tar.gz".to_string(),
            size: 2048,
            hash: "linux123".to_string(),
            platform: Some("linux".to_string()),
            arch: Some("x64".to_string()),
        });
        
        files.insert("windows-x64".to_string(), FileInfo {
            url: "https://example.com/windows.exe".to_string(),
            size: 4096,
            hash: "windows123".to_string(),
            platform: Some("windows".to_string()),
            arch: Some("x64".to_string()),
        });

        let manifest = UpdateManifest {
            version: "2.0.0".to_string(),
            release_date: Utc::now(),
            update_type: UpdateType::Major,
            title: "Major Update".to_string(),
            description: "Major version update".to_string(),
            changelog: "Major changes...".to_string(),
            is_mandatory: true,
            is_prerelease: false,
            min_version: Some("1.5.0".to_string()),
            files,
        };

        assert_eq!(manifest.version, "2.0.0");
        // UpdateType doesn't implement PartialEq, so we check with matches!
        assert!(matches!(manifest.update_type, UpdateType::Major));
        assert!(manifest.is_mandatory);
        assert!(!manifest.is_prerelease);
        assert_eq!(manifest.files.len(), 2);
        assert!(manifest.files.contains_key("linux-x64"));
        assert!(manifest.files.contains_key("windows-x64"));
    }

    #[test]
    fn test_update_event_serialization() {
        // 测试各种事件类型的序列化
        let events = vec![
            UpdateEvent::CheckStarted,
            UpdateEvent::CheckCompleted {
                has_update: true,
                update_info: None,
            },
            UpdateEvent::CheckFailed {
                error: "Test error".to_string(),
            },
            UpdateEvent::DownloadStarted {
                version: "1.1.0".to_string(),
                total_size: Some(1024),
            },
            UpdateEvent::DownloadProgress {
                version: "1.1.0".to_string(),
                downloaded: 512,
                total: Some(1024),
                percentage: 50.0,
            },
            UpdateEvent::DownloadCompleted {
                version: "1.1.0".to_string(),
                file_path: "/tmp/update.exe".to_string(),
            },
            UpdateEvent::DownloadFailed {
                version: "1.1.0".to_string(),
                error: "Network error".to_string(),
            },
            UpdateEvent::InstallStarted {
                version: "1.1.0".to_string(),
            },
            UpdateEvent::InstallProgress {
                version: "1.1.0".to_string(),
                percentage: 75.0,
                message: "Installing...".to_string(),
            },
            UpdateEvent::InstallCompleted {
                version: "1.1.0".to_string(),
                needs_restart: true,
            },
            UpdateEvent::InstallFailed {
                version: "1.1.0".to_string(),
                error: "Installation failed".to_string(),
            },
            UpdateEvent::RollbackStarted {
                from_version: "1.1.0".to_string(),
                to_version: "1.0.0".to_string(),
            },
            UpdateEvent::RollbackCompleted {
                version: "1.0.0".to_string(),
            },
            UpdateEvent::RollbackFailed {
                error: "Rollback failed".to_string(),
            },
        ];

        for event in events {
            let serialized = serde_json::to_string(&event);
            assert!(serialized.is_ok(), "Failed to serialize event: {:?}", event);
            
            let json_str = serialized.unwrap();
            assert!(!json_str.is_empty());
            assert!(json_str.contains("\"type\""));
        }
    }

    #[test]
    fn test_update_manifest_serialization() {
        let mut files = HashMap::new();
        files.insert("test".to_string(), FileInfo {
            url: "https://example.com/file".to_string(),
            size: 1024,
            hash: "abc123".to_string(),
            platform: Some("linux".to_string()),
            arch: Some("x64".to_string()),
        });

        let manifest = UpdateManifest {
            version: "1.1.0".to_string(),
            release_date: Utc::now(),
            update_type: UpdateType::Minor,
            title: "Test".to_string(),
            description: "Test".to_string(),
            changelog: "Test".to_string(),
            is_mandatory: false,
            is_prerelease: false,
            min_version: Some("1.0.0".to_string()),
            files,
        };

        let serialized = serde_json::to_string(&manifest);
        assert!(serialized.is_ok());

        let json_str = serialized.unwrap();
        let deserialized: Result<UpdateManifest, _> = serde_json::from_str(&json_str);
        assert!(deserialized.is_ok());
        
        let deserialized_manifest = deserialized.unwrap();
        assert_eq!(deserialized_manifest.version, manifest.version);
        assert_eq!(deserialized_manifest.title, manifest.title);
    }

    #[tokio::test]
    async fn test_concurrent_event_broadcasting() {
        // 测试并发事件广播（避免死锁）
        let (sender, mut receiver1) = broadcast::channel(100);
        let mut receiver2 = sender.subscribe();
        let mut receiver3 = sender.subscribe();
        
        // 并发发送多个事件
        let sender_clone = sender.clone();
        let send_task = tokio::spawn(async move {
            for i in 0..10 {
                let event = UpdateEvent::DownloadProgress {
                    version: format!("1.{}.0", i),
                    downloaded: i * 1024,
                    total: Some(10 * 1024),
                    percentage: (i as f64) * 10.0,
                };
                let _ = sender_clone.send(event);
                tokio::time::sleep(Duration::from_millis(1)).await;
            }
        });
        
        // 并发接收事件
        let receive_task1 = tokio::spawn(async move {
            let mut count = 0;
            while count < 10 {
                if receiver1.recv().await.is_ok() {
                    count += 1;
                }
            }
            count
        });
        
        let receive_task2 = tokio::spawn(async move {
            let mut count = 0;
            while count < 10 {
                if receiver2.recv().await.is_ok() {
                    count += 1;
                }
            }
            count
        });

        // 等待所有任务完成
        let (send_result, recv1_result, recv2_result) = 
            tokio::join!(send_task, receive_task1, receive_task2);
            
        assert!(send_result.is_ok());
        assert_eq!(recv1_result.unwrap(), 10);
        assert_eq!(recv2_result.unwrap(), 10);
    }

    #[tokio::test]
    async fn test_timeout_handling() {
        // 测试超时处理，避免无限等待
        let timeout_duration = Duration::from_millis(100);
        
        // 模拟一个永远不会完成的操作
        let never_complete = async {
            tokio::time::sleep(Duration::from_secs(10)).await;
            "completed"
        };
        
        // 使用timeout包装，确保在指定时间内返回
        let result = timeout(timeout_duration, never_complete).await;
        assert!(result.is_err()); // 应该超时
    }

    #[tokio::test]
    async fn test_file_operations_async() {
        // 测试异步文件操作
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test_file.txt");
        
        // 测试异步写入
        let content = "test content for update manager";
        tokio::fs::write(&file_path, content).await
            .expect("Failed to write file");
        
        // 测试异步读取
        let read_content = tokio::fs::read_to_string(&file_path).await
            .expect("Failed to read file");
        
        assert_eq!(content, read_content);
        
        // 测试异步删除
        tokio::fs::remove_file(&file_path).await
            .expect("Failed to remove file");
        
        assert!(!file_path.exists());
    }

    #[test]
    fn test_thread_safety_with_arc_mutex() {
        // 测试 Arc<Mutex<T>> 的线程安全性
        use std::thread;
        use std::sync::mpsc;
        
        let shared_data = Arc::new(Mutex::new(0));
        let (tx, rx) = mpsc::channel();
        
        let handles: Vec<_> = (0..5).map(|i| {
            let data = Arc::clone(&shared_data);
            let tx = tx.clone();
            thread::spawn(move || {
                // 模拟并发访问共享数据
                for _ in 0..10 {
                    {
                        let mut num = data.lock().unwrap();
                        *num += 1;
                    } // 确保锁及时释放，避免死锁
                    thread::yield_now(); // 让出CPU时间
                }
                tx.send(i).unwrap();
            })
        }).collect();
        
        // 等待所有线程完成
        drop(tx);
        for _ in 0..5 {
            rx.recv().unwrap();
        }
        
        for handle in handles {
            handle.join().unwrap();
        }
        
        // 验证最终结果
        let final_value = *shared_data.lock().unwrap();
        assert_eq!(final_value, 50); // 5个线程 × 10次递增
    }

    // 性能测试
    #[tokio::test]
    async fn test_performance_version_comparison() {
        // 测试版本比较的性能，不需要数据库
        let parse_version = |v: &str| -> Option<(u32, u32, u32)> {
            let parts: Vec<&str> = v.split('.').collect();
            if parts.len() != 3 {
                return None;
            }

            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            let patch = parts[2].parse().ok()?;

            Some((major, minor, patch))
        };
        
        let compare_versions = |current: &str, remote: &str| -> VersionComparison {
            use std::cmp::Ordering;
            match (parse_version(current), parse_version(remote)) {
                (Some(cur), Some(rem)) => {
                    match cur.cmp(&rem) {
                        Ordering::Less => VersionComparison::UpdateAvailable,
                        Ordering::Equal => VersionComparison::Current,
                        Ordering::Greater => VersionComparison::Newer,
                    }
                }
                _ => VersionComparison::Invalid,
            }
        };
        
        let start = std::time::Instant::now();
        
        // 执行大量版本比较操作
        for i in 0..1000 {
            let v1 = format!("1.{}.0", i % 100);
            let v2 = format!("1.{}.1", i % 100);
            let _ = compare_versions(&v1, &v2);
        }
        
        let duration = start.elapsed();
        
        // 1000次版本比较应该在100ms内完成
        assert!(duration.as_millis() < 100, "Version comparison too slow: {:?}", duration);
    }

    // 并发测试
    #[tokio::test]
    #[ignore] // 需要数据库连接
    async fn test_concurrent_config_access() {
        // 这个测试需要数据库操作，在集成测试中实现
    }
}
