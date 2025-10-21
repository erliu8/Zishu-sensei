use crate::commands::{CommandMetadata, PermissionLevel};
use crate::database::update::{UpdateInfo, UpdateConfig, VersionHistory};
use crate::utils::update_manager::{UpdateManager, UpdateEvent};
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use tokio::sync::broadcast;
use tracing::{info, error, warn};

/// 更新管理器状态
pub struct UpdateManagerState {
    pub manager: Arc<Mutex<Option<UpdateManager>>>,
    pub event_receiver: Arc<Mutex<Option<broadcast::Receiver<UpdateEvent>>>>,
}

impl UpdateManagerState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(Mutex::new(None)),
            event_receiver: Arc::new(Mutex::new(None)),
        }
    }
}

/// 更新检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub update_info: Option<UpdateInfo>,
    pub error: Option<String>,
}

/// 下载进度信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub version: String,
    pub downloaded: i64,
    pub total: Option<i64>,
    pub percentage: f64,
}

/// 安装进度信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub version: String,
    pub percentage: f64,
    pub message: String,
}

/// 初始化更新管理器
#[tauri::command]
pub async fn init_update_manager(
    app_handle: AppHandle,
    state: State<'_, UpdateManagerState>,
) -> Result<bool, String> {
    info!("Initializing update manager");

    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let db_path = app_data_dir.join("updates.db");
    let current_version = app_handle.package_info().version.to_string();
    let update_endpoint = "https://update.zishu.dev/{{target}}/{{arch}}/{{current_version}}".to_string();

    match UpdateManager::new(
        &db_path.to_string_lossy(),
        current_version,
        update_endpoint,
        app_data_dir,
    ) {
        Ok(manager) => {
            let event_receiver = manager.subscribe_events();
            
            {
                let mut state_manager = state.manager.lock().unwrap();
                *state_manager = Some(manager);
            }
            
            {
                let mut state_receiver = state.event_receiver.lock().unwrap();
                *state_receiver = Some(event_receiver);
            }

            info!("Update manager initialized successfully");
            Ok(true)
        }
        Err(e) => {
            error!("Failed to initialize update manager: {}", e);
            Err(format!("Failed to initialize update manager: {}", e))
        }
    }
}

/// 检查更新
#[tauri::command]
pub async fn check_for_updates(
    state: State<'_, UpdateManagerState>,
    force: Option<bool>,
) -> Result<UpdateCheckResult, String> {
    info!("Checking for updates (force: {:?})", force);

    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.check_for_updates(force.unwrap_or(false)).await {
        Ok(update_info) => {
            Ok(UpdateCheckResult {
                has_update: update_info.is_some(),
                update_info,
                error: None,
            })
        }
        Err(e) => {
            error!("Check for updates failed: {}", e);
            Ok(UpdateCheckResult {
                has_update: false,
                update_info: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// 下载更新
#[tauri::command]
pub async fn download_update(
    state: State<'_, UpdateManagerState>,
    version: String,
) -> Result<String, String> {
    info!("Starting download for version: {}", version);

    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.download_update(&version).await {
        Ok(file_path) => {
            info!("Download completed: {}", file_path);
            Ok(file_path)
        }
        Err(e) => {
            error!("Download failed: {}", e);
            Err(e.to_string())
        }
    }
}

/// 安装更新
#[tauri::command]
pub async fn install_update(
    state: State<'_, UpdateManagerState>,
    version: String,
) -> Result<bool, String> {
    info!("Starting installation for version: {}", version);

    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.install_update(&version).await {
        Ok(needs_restart) => {
            info!("Installation completed (needs restart: {})", needs_restart);
            Ok(needs_restart)
        }
        Err(e) => {
            error!("Installation failed: {}", e);
            Err(e.to_string())
        }
    }
}

/// 使用 Tauri 内置更新器安装更新
#[tauri::command]
pub async fn install_update_with_tauri(
    app_handle: AppHandle,
) -> Result<bool, String> {
    info!("Installing update using Tauri updater");

    // 使用 Tauri 内置更新器
    match tauri::updater::builder(app_handle.clone()).check().await {
        Ok(update) => {
            if update.is_update_available() {
                info!("Update available, starting download and install");
                
                // 下载并安装更新
                match update.download_and_install().await {
                    Ok(_) => {
                        info!("Update installed successfully");
                        Ok(true) // 需要重启
                    }
                    Err(e) => {
                        error!("Failed to download and install update: {}", e);
                        Err(format!("Failed to install update: {}", e))
                    }
                }
            } else {
                info!("No update available");
                Ok(false) // 不需要重启
            }
        }
        Err(e) => {
            error!("Failed to check for updates: {}", e);
            Err(format!("Failed to check for updates: {}", e))
        }
    }
}

/// 取消下载
#[tauri::command]
pub async fn cancel_download(
    state: State<'_, UpdateManagerState>,
    version: String,
) -> Result<bool, String> {
    info!("Canceling download for version: {}", version);

    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.cancel_download(&version).await {
        Ok(_) => {
            info!("Download cancelled successfully");
            Ok(true)
        }
        Err(e) => {
            error!("Failed to cancel download: {}", e);
            Err(e.to_string())
        }
    }
}

/// 回滚到指定版本
#[tauri::command]
pub async fn rollback_to_version(
    state: State<'_, UpdateManagerState>,
    version: String,
) -> Result<bool, String> {
    info!("Rolling back to version: {}", version);

    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.rollback_to_version(&version).await {
        Ok(_) => {
            info!("Rollback completed successfully");
            Ok(true)
        }
        Err(e) => {
            error!("Rollback failed: {}", e);
            Err(e.to_string())
        }
    }
}

/// 获取更新配置
#[tauri::command]
pub async fn get_update_config(
    state: State<'_, UpdateManagerState>,
) -> Result<UpdateConfig, String> {
    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.get_config() {
        Ok(config) => Ok(config),
        Err(e) => {
            error!("Failed to get update config: {}", e);
            Err(e.to_string())
        }
    }
}

/// 保存更新配置
#[tauri::command]
pub async fn save_update_config(
    state: State<'_, UpdateManagerState>,
    mut config: UpdateConfig,
) -> Result<bool, String> {
    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.save_config(&mut config) {
        Ok(_) => {
            info!("Update config saved successfully");
            Ok(true)
        }
        Err(e) => {
            error!("Failed to save update config: {}", e);
            Err(e.to_string())
        }
    }
}

/// 获取版本历史
#[tauri::command]
pub async fn get_version_history(
    state: State<'_, UpdateManagerState>,
) -> Result<Vec<VersionHistory>, String> {
    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.get_version_history() {
        Ok(history) => Ok(history),
        Err(e) => {
            error!("Failed to get version history: {}", e);
            Err(e.to_string())
        }
    }
}

/// 获取更新统计
#[tauri::command]
pub async fn get_update_stats(
    state: State<'_, UpdateManagerState>,
) -> Result<HashMap<String, i64>, String> {
    let manager = {
        state.manager.lock().unwrap()
            .as_ref()
            .ok_or("Update manager not initialized")?
            .clone()
    };

    match manager.get_update_stats() {
        Ok(stats) => Ok(stats),
        Err(e) => {
            error!("Failed to get update stats: {}", e);
            Err(e.to_string())
        }
    }
}

/// 重启应用
#[tauri::command]
pub async fn restart_application(
    app_handle: AppHandle,
) -> Result<bool, String> {
    info!("Restarting application");

    // 使用 Tauri 的重启功能
    app_handle.restart();
    info!("Application restart initiated");
    Ok(true)
}

/// 监听更新事件
#[tauri::command]
pub async fn listen_update_events(
    app_handle: AppHandle,
    state: State<'_, UpdateManagerState>,
) -> Result<bool, String> {
    info!("Starting update event listener");

    let mut receiver = {
        let mut state_receiver = state.event_receiver.lock().unwrap();
        state_receiver.take()
            .ok_or("Update manager not initialized or events already being listened")?
    };

    // 在后台任务中监听事件
    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        while let Ok(event) = receiver.recv().await {
            // 将事件发送到前端
            if let Err(e) = app_handle_clone.emit_all("update-event", &event) {
                error!("Failed to emit update event: {}", e);
            }
        }
    });

    Ok(true)
}

/// 检查 Tauri 更新器是否可用
#[tauri::command]
pub async fn check_tauri_updater_available(
    app_handle: AppHandle,
) -> Result<bool, String> {
    match tauri::updater::builder(app_handle).check().await {
        Ok(_) => Ok(true),
        Err(e) => {
            warn!("Tauri updater not available: {}", e);
            Ok(false)
        }
    }
}

/// 获取当前应用版本
#[tauri::command]
pub async fn get_current_version(
    app_handle: AppHandle,
) -> Result<String, String> {
    Ok(app_handle.package_info().version.to_string())
}

/// 获取命令元数据
pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut commands = std::collections::HashMap::new();
    
    commands.insert("init_update_manager".to_string(), CommandMetadata {
        name: "init_update_manager".to_string(),
        description: "初始化更新管理器".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("check_for_updates".to_string(), CommandMetadata {
        name: "check_for_updates".to_string(),
        description: "检查应用更新".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("download_update".to_string(), CommandMetadata {
        name: "download_update".to_string(),
        description: "下载指定版本的更新".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("install_update".to_string(), CommandMetadata {
        name: "install_update".to_string(),
        description: "安装已下载的更新".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("install_update_with_tauri".to_string(), CommandMetadata {
        name: "install_update_with_tauri".to_string(),
        description: "使用 Tauri 内置更新器安装更新".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("cancel_download".to_string(), CommandMetadata {
        name: "cancel_download".to_string(),
        description: "取消正在下载的更新".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("rollback_to_version".to_string(), CommandMetadata {
        name: "rollback_to_version".to_string(),
        description: "回滚到指定版本".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("get_update_config".to_string(), CommandMetadata {
        name: "get_update_config".to_string(),
        description: "获取更新配置".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("save_update_config".to_string(), CommandMetadata {
        name: "save_update_config".to_string(),
        description: "保存更新配置".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("get_version_history".to_string(), CommandMetadata {
        name: "get_version_history".to_string(),
        description: "获取版本历史记录".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("get_update_stats".to_string(), CommandMetadata {
        name: "get_update_stats".to_string(),
        description: "获取更新统计信息".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("cleanup_old_files".to_string(), CommandMetadata {
        name: "cleanup_old_files".to_string(),
        description: "清理旧的更新文件".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("restart_application".to_string(), CommandMetadata {
        name: "restart_application".to_string(),
        description: "重启应用程序".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("listen_update_events".to_string(), CommandMetadata {
        name: "listen_update_events".to_string(),
        description: "监听更新事件".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("check_tauri_updater_available".to_string(), CommandMetadata {
        name: "check_tauri_updater_available".to_string(),
        description: "检查 Tauri 更新器是否可用".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands.insert("get_current_version".to_string(), CommandMetadata {
        name: "get_current_version".to_string(),
        description: "获取当前应用版本".to_string(),
        input_type: None,
        output_type: None,
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "update".to_string(),
    });

    commands
}


