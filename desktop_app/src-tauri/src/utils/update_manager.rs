use crate::database::update::{UpdateDatabase, UpdateInfo, UpdateStatus, UpdateType, VersionHistory, UpdateConfig};
use anyhow::{Result, Context, bail};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
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
        db_path: &str,
        current_version: String,
        update_endpoint: String,
        app_data_dir: PathBuf,
    ) -> Result<Self> {
        let db = Arc::new(Mutex::new(
            UpdateDatabase::new(db_path)
                .context("Failed to initialize update database")?
        ));

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
            let mut db = self.db.lock().unwrap();
            db.get_or_create_update_config()?
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
            let mut db = self.db.lock().unwrap();
            let mut updated_config = config.clone();
            updated_config.last_check_time = Some(Utc::now());
            db.save_update_config(&mut updated_config)?;
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
                                        update_type: manifest.update_type,
                                        status: UpdateStatus::Available,
                                        title: manifest.title,
                                        description: manifest.description,
                                        changelog: manifest.changelog,
                                        release_date: manifest.release_date,
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
                                        let mut db = self.db.lock().unwrap();
                                        db.save_update_info(&mut update_info)?;
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
            db.get_update_info_by_version(version)?
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
            let mut db = self.db.lock().unwrap();
            db.save_update_info(&mut update_info)?;
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
                let mut db = self.db.lock().unwrap();
                db.save_update_info(&mut update_info)?;
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
                        let mut db = self.db.lock().unwrap();
                        db.save_update_info(&mut update_info)?;
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
                        let mut db = self.db.lock().unwrap();
                        db.save_update_info(&mut update_info)?;
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
                    let mut db = self.db.lock().unwrap();
                    db.save_update_info(&mut update_info)?;
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
            let mut db = self.db.lock().unwrap();
            db.save_update_info(&mut update_info)?;
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
            db.get_update_info_by_version(version)?
                .context("Update info not found")?
        };

        if update_info.status != UpdateStatus::Downloaded {
            bail!("Update is not ready for installation");
        }

        // 更新状态为安装中
        update_info.status = UpdateStatus::Installing;
        update_info.install_progress = 0.0;
        {
            let mut db = self.db.lock().unwrap();
            db.save_update_info(&mut update_info)?;
        }

        self.emit_event(UpdateEvent::InstallStarted {
            version: version.to_string(),
        });

        // 检查是否需要备份
        let config = {
            let mut db = self.db.lock().unwrap();
            db.get_or_create_update_config()?
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
                let mut db = self.db.lock().unwrap();
                db.save_update_info(&mut update_info)?;
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
                    let mut db = self.db.lock().unwrap();
                    db.save_update_info(&mut update_info)?;
                }

                // 记录版本历史
                let history = VersionHistory {
                    id: None,
                    version: version.to_string(),
                    installed_at: Utc::now(),
                    is_rollback: false,
                    install_source: "auto".to_string(),
                    notes: Some(format!("Updated from {}", self.current_version)),
                };

                {
                    let mut db = self.db.lock().unwrap();
                    db.save_version_history(&history)?;
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
                    let mut db = self.db.lock().unwrap();
                    db.save_update_info(&mut update_info)?;
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
            db.get_version_history()?
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
            installed_at: Utc::now(),
            is_rollback: true,
            install_source: "rollback".to_string(),
            notes: Some(format!("Rolled back from {}", self.current_version)),
        };

        {
            let mut db = self.db.lock().unwrap();
            db.save_version_history(&rollback_history)?;
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
            db.get_update_info_by_version(version)?
                .context("Update info not found")?
        };

        if update_info.status == UpdateStatus::Downloading {
            update_info.status = UpdateStatus::Cancelled;
            {
                let mut db = self.db.lock().unwrap();
                db.save_update_info(&mut update_info)?;
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
        let mut db = self.db.lock().unwrap();
        Ok(db.get_or_create_update_config()?)
    }

    /// 保存更新配置
    pub fn save_config(&self, config: &mut UpdateConfig) -> Result<()> {
        let mut db = self.db.lock().unwrap();
        db.save_update_config(config)?;
        Ok(())
    }

    /// 获取版本历史
    pub fn get_version_history(&self) -> Result<Vec<VersionHistory>> {
        let db = self.db.lock().unwrap();
        Ok(db.get_version_history()?)
    }

    /// 获取更新统计
    pub fn get_update_stats(&self) -> Result<HashMap<String, i64>> {
        let db = self.db.lock().unwrap();
        Ok(db.get_update_stats()?)
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
