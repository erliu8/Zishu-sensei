//! Adapter management commands
//!
//! This module provides commands for managing adapters (plugins/extensions)

use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use reqwest::Client;
use tokio::fs;

use crate::{
    commands::*,
    state::AppState,
};

// ================================
// Data Types
// ================================

/// Adapter status enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AdapterStatus {
    /// Adapter is loaded and ready
    Loaded,
    /// Adapter is not loaded
    Unloaded,
    /// Adapter is currently loading
    Loading,
    /// Adapter is currently unloading
    Unloading,
    /// Adapter has an error
    Error,
    /// Adapter status is unknown
    Unknown,
    /// Adapter is in maintenance mode
    Maintenance,
}

/// Adapter type enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AdapterType {
    /// Soft adapter (based on prompts and RAG)
    Soft,
    /// Hard adapter (based on native code)
    Hard,
    /// Intelligent hard adapter (based on fine-tuned models)
    Intelligent,
}

/// Adapter capability level
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CapabilityLevel {
    /// Basic capability
    Basic,
    /// Intermediate capability
    Intermediate,
    /// Advanced capability
    Advanced,
    /// Expert level capability
    Expert,
}

/// Adapter capability description
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterCapability {
    /// Capability name
    pub name: String,
    /// Capability description
    pub description: String,
    /// Capability level
    pub level: CapabilityLevel,
    /// Required parameters
    pub required_params: Vec<String>,
    /// Optional parameters
    pub optional_params: Vec<String>,
}

/// Adapter resource requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterResourceRequirements {
    /// Minimum memory requirement (MB)
    pub min_memory_mb: Option<u64>,
    /// Minimum CPU cores
    pub min_cpu_cores: Option<u32>,
    /// GPU requirement
    pub gpu_required: bool,
    /// Minimum GPU memory (MB)
    pub min_gpu_memory_mb: Option<u64>,
    /// Required Python version
    pub python_version: Option<String>,
    /// Required dependencies
    pub dependencies: Vec<String>,
}

/// Adapter compatibility information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterCompatibility {
    /// Compatible base models
    pub base_models: Vec<String>,
    /// Compatible frameworks
    pub frameworks: HashMap<String, String>,
    /// Compatible operating systems
    pub operating_systems: Vec<String>,
    /// Compatible Python versions
    pub python_versions: Vec<String>,
}

/// Adapter metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterMetadata {
    /// Adapter ID
    pub id: String,
    /// Adapter name
    pub name: String,
    /// Adapter version
    pub version: String,
    /// Adapter type
    pub adapter_type: AdapterType,
    /// Description
    pub description: Option<String>,
    /// Author
    pub author: Option<String>,
    /// License
    pub license: Option<String>,
    /// Tags
    pub tags: Vec<String>,
    /// Created at
    pub created_at: DateTime<Utc>,
    /// Updated at
    pub updated_at: DateTime<Utc>,
    /// Capabilities
    pub capabilities: Vec<AdapterCapability>,
    /// Compatibility information
    pub compatibility: AdapterCompatibility,
    /// Resource requirements
    pub resource_requirements: AdapterResourceRequirements,
    /// Configuration schema
    pub config_schema: HashMap<String, serde_json::Value>,
    /// Default configuration
    pub default_config: HashMap<String, serde_json::Value>,
    /// File size in bytes
    pub file_size_bytes: Option<u64>,
    /// Parameter count
    pub parameter_count: Option<u64>,
}

/// Adapter information for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterInfo {
    /// Adapter name
    pub name: String,
    /// Adapter path
    pub path: Option<String>,
    /// Adapter size in bytes
    pub size: Option<u64>,
    /// Adapter version
    pub version: Option<String>,
    /// Description
    pub description: Option<String>,
    /// Current status
    pub status: AdapterStatus,
    /// Load time
    pub load_time: Option<DateTime<Utc>>,
    /// Memory usage in bytes
    pub memory_usage: Option<u64>,
    /// Configuration
    pub config: HashMap<String, serde_json::Value>,
}

/// Adapter installation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterInstallRequest {
    /// Adapter ID or URL
    pub adapter_id: String,
    /// Installation source (market, url, file)
    pub source: String,
    /// Force installation
    pub force: bool,
    /// Installation options
    pub options: HashMap<String, serde_json::Value>,
}

/// Adapter execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterExecutionRequest {
    /// Adapter ID
    pub adapter_id: String,
    /// Action to execute
    pub action: String,
    /// Parameters
    pub params: HashMap<String, serde_json::Value>,
    /// Execution timeout (seconds)
    pub timeout: Option<u64>,
}

/// Adapter configuration update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterConfigUpdateRequest {
    /// Adapter ID
    pub adapter_id: String,
    /// Configuration to update
    pub config: HashMap<String, serde_json::Value>,
    /// Merge with existing config
    pub merge: bool,
}

/// Adapter search request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterSearchRequest {
    /// Search query
    pub query: String,
    /// Adapter type filter
    pub adapter_type: Option<AdapterType>,
    /// Category filter
    pub category: Option<String>,
    /// Tags filter
    pub tags: Option<Vec<String>>,
    /// Price range filter
    pub price_min: Option<f64>,
    /// Price range filter
    pub price_max: Option<f64>,
    /// Rating filter
    pub rating_min: Option<f64>,
    /// Free only filter
    pub free_only: Option<bool>,
    /// Featured only filter
    pub featured_only: Option<bool>,
    /// Page number
    pub page: Option<u32>,
    /// Page size
    pub page_size: Option<u32>,
    /// Sort field
    pub sort_by: Option<String>,
    /// Sort order
    pub sort_order: Option<String>,
}

// ================================
// Command Handlers
// ================================

/// Get list of installed adapters
#[tauri::command]
pub async fn get_adapters(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<AdapterInfo>>, String> {
    info!("获取适配器列表");
    
    match get_adapters_from_backend().await {
        Ok(adapters) => {
            info!("成功获取 {} 个适配器", adapters.len());
    Ok(CommandResponse::success(adapters))
        }
        Err(e) => {
            error!("获取适配器列表失败: {}", e);
            Ok(CommandResponse::error(format!("获取适配器列表失败: {}", e)))
        }
    }
}

/// Install an adapter
#[tauri::command]
pub async fn install_adapter(
    request: AdapterInstallRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("安装适配器: {} from {}", request.adapter_id, request.source);
    
    match install_adapter_from_backend(&request).await {
        Ok(success) => {
            if success {
                info!("适配器 {} 安装成功", request.adapter_id);
    Ok(CommandResponse::success_with_message(
        true,
                    format!("适配器 {} 安装成功", request.adapter_id),
                ))
            } else {
                warn!("适配器 {} 安装失败", request.adapter_id);
                Ok(CommandResponse::error(format!("适配器 {} 安装失败", request.adapter_id)))
            }
        }
        Err(e) => {
            error!("安装适配器失败: {}", e);
            Ok(CommandResponse::error(format!("安装适配器失败: {}", e)))
        }
    }
}

/// Uninstall an adapter
#[tauri::command]
pub async fn uninstall_adapter(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("卸载适配器: {}", adapter_id);
    
    match uninstall_adapter_from_backend(&adapter_id).await {
        Ok(success) => {
            if success {
                info!("适配器 {} 卸载成功", adapter_id);
    Ok(CommandResponse::success_with_message(
        true,
        format!("适配器 {} 已卸载", adapter_id),
    ))
            } else {
                warn!("适配器 {} 卸载失败", adapter_id);
                Ok(CommandResponse::error(format!("适配器 {} 卸载失败", adapter_id)))
            }
        }
        Err(e) => {
            error!("卸载适配器失败: {}", e);
            Ok(CommandResponse::error(format!("卸载适配器失败: {}", e)))
        }
    }
}

/// Execute adapter action
#[tauri::command]
pub async fn execute_adapter(
    request: AdapterExecutionRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<serde_json::Value>, String> {
    info!("执行适配器操作: {} - {}", request.adapter_id, request.action);
    
    match execute_adapter_action(&request).await {
        Ok(result) => {
            info!("适配器 {} 操作 {} 执行成功", request.adapter_id, request.action);
            Ok(CommandResponse::success(result))
        }
        Err(e) => {
            error!("执行适配器操作失败: {}", e);
            Ok(CommandResponse::error(format!("执行适配器操作失败: {}", e)))
        }
    }
}

/// Get adapter configuration
#[tauri::command]
pub async fn get_adapter_config(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<HashMap<String, serde_json::Value>>, String> {
    info!("获取适配器配置: {}", adapter_id);
    
    match get_adapter_config_from_backend(&adapter_id).await {
        Ok(config) => {
            info!("成功获取适配器 {} 的配置", adapter_id);
            Ok(CommandResponse::success(config))
        }
        Err(e) => {
            error!("获取适配器配置失败: {}", e);
            Ok(CommandResponse::error(format!("获取适配器配置失败: {}", e)))
        }
    }
}

/// Update adapter configuration
#[tauri::command]
pub async fn update_adapter_config(
    request: AdapterConfigUpdateRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("更新适配器配置: {}", request.adapter_id);
    
    match update_adapter_config_in_backend(&request).await {
        Ok(success) => {
            if success {
                info!("适配器 {} 配置更新成功", request.adapter_id);
                Ok(CommandResponse::success_with_message(
                    true,
                    format!("适配器 {} 配置已更新", request.adapter_id),
                ))
            } else {
                warn!("适配器 {} 配置更新失败", request.adapter_id);
                Ok(CommandResponse::error(format!("适配器 {} 配置更新失败", request.adapter_id)))
            }
        }
        Err(e) => {
            error!("更新适配器配置失败: {}", e);
            Ok(CommandResponse::error(format!("更新适配器配置失败: {}", e)))
        }
    }
}

/// Search adapters in marketplace
#[tauri::command]
pub async fn search_adapters(
    request: AdapterSearchRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<PaginatedResponse<serde_json::Value>>, String> {
    info!("搜索适配器: {}", request.query);
    
    match search_adapters_in_marketplace(&request).await {
        Ok(results) => {
            info!("搜索到 {} 个适配器", results.total);
            Ok(CommandResponse::success(results))
        }
        Err(e) => {
            error!("搜索适配器失败: {}", e);
            Ok(CommandResponse::error(format!("搜索适配器失败: {}", e)))
        }
    }
}

/// Get adapter details
#[tauri::command]
pub async fn get_adapter_details(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<AdapterMetadata>, String> {
    info!("获取适配器详情: {}", adapter_id);
    
    match get_adapter_details_from_backend(&adapter_id).await {
        Ok(metadata) => {
            info!("成功获取适配器 {} 的详情", adapter_id);
            Ok(CommandResponse::success(metadata))
        }
        Err(e) => {
            error!("获取适配器详情失败: {}", e);
            Ok(CommandResponse::error(format!("获取适配器详情失败: {}", e)))
        }
    }
}

/// Load adapter
#[tauri::command]
pub async fn load_adapter(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("加载适配器: {}", adapter_id);
    
    match load_adapter_in_backend(&adapter_id).await {
        Ok(success) => {
            if success {
                info!("适配器 {} 加载成功", adapter_id);
                Ok(CommandResponse::success_with_message(
                    true,
                    format!("适配器 {} 加载成功", adapter_id),
                ))
            } else {
                warn!("适配器 {} 加载失败", adapter_id);
                Ok(CommandResponse::error(format!("适配器 {} 加载失败", adapter_id)))
            }
        }
        Err(e) => {
            error!("加载适配器失败: {}", e);
            Ok(CommandResponse::error(format!("加载适配器失败: {}", e)))
        }
    }
}

/// Unload adapter
#[tauri::command]
pub async fn unload_adapter(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("卸载适配器: {}", adapter_id);
    
    match unload_adapter_in_backend(&adapter_id).await {
        Ok(success) => {
            if success {
                info!("适配器 {} 卸载成功", adapter_id);
    Ok(CommandResponse::success_with_message(
        true,
                    format!("适配器 {} 卸载成功", adapter_id),
                ))
            } else {
                warn!("适配器 {} 卸载失败", adapter_id);
                Ok(CommandResponse::error(format!("适配器 {} 卸载失败", adapter_id)))
            }
        }
        Err(e) => {
            error!("卸载适配器失败: {}", e);
            Ok(CommandResponse::error(format!("卸载适配器失败: {}", e)))
        }
    }
}

/// Get adapter status
#[tauri::command]
pub async fn get_adapter_status(
    adapter_id: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<serde_json::Value>, String> {
    info!("获取适配器状态: {:?}", adapter_id);
    
    match get_adapter_status_from_backend(adapter_id.as_deref()).await {
        Ok(status) => {
            info!("成功获取适配器状态");
            Ok(CommandResponse::success(status))
        }
        Err(e) => {
            error!("获取适配器状态失败: {}", e);
            Ok(CommandResponse::error(format!("获取适配器状态失败: {}", e)))
        }
    }
}

// ================================
// 本地适配器管理命令
// ================================

use crate::database::get_database;
use crate::database::adapter::{InstalledAdapter, AdapterInstallStatus, AdapterVersion, AdapterDependency, AdapterPermission};

/// 获取本地已安装的适配器列表
#[tauri::command]
pub async fn get_installed_adapters(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<InstalledAdapter>>, String> {
    info!("获取本地已安装的适配器列表");
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.get_all_adapters().await {
        Ok(adapters) => {
            info!("成功获取 {} 个已安装适配器", adapters.len());
            Ok(CommandResponse::success(adapters))
        }
        Err(e) => {
            error!("获取已安装适配器失败: {}", e);
            Ok(CommandResponse::error(format!("获取已安装适配器失败: {}", e)))
        }
    }
}

/// 获取已启用的适配器列表
#[tauri::command]
pub async fn get_enabled_adapters(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<InstalledAdapter>>, String> {
    info!("获取已启用的适配器列表");
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.get_enabled_adapters().await {
        Ok(adapters) => {
            info!("成功获取 {} 个已启用适配器", adapters.len());
            Ok(CommandResponse::success(adapters))
        }
        Err(e) => {
            error!("获取已启用适配器失败: {}", e);
            Ok(CommandResponse::error(format!("获取已启用适配器失败: {}", e)))
        }
    }
}

/// 获取单个已安装适配器的详情
#[tauri::command]
pub async fn get_installed_adapter(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<InstalledAdapter>, String> {
    info!("获取已安装适配器详情: {}", adapter_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.get_adapter(&adapter_id).await {
        Ok(Some(adapter)) => {
            info!("成功获取适配器详情: {}", adapter.name);
            Ok(CommandResponse::success(adapter))
        }
        Ok(None) => {
            warn!("适配器不存在: {}", adapter_id);
            Ok(CommandResponse::error(format!("适配器不存在: {}", adapter_id)))
        }
        Err(e) => {
            error!("获取适配器详情失败: {}", e);
            Ok(CommandResponse::error(format!("获取适配器详情失败: {}", e)))
        }
    }
}

/// 启用/禁用适配器
#[tauri::command]
pub async fn toggle_adapter(
    adapter_id: String,
    enabled: bool,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("{}适配器: {}", if enabled { "启用" } else { "禁用" }, adapter_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.set_adapter_enabled(&adapter_id, enabled).await {
        Ok(_) => {
            info!("适配器 {} 已{}", adapter_id, if enabled { "启用" } else { "禁用" });
            Ok(CommandResponse::success_with_message(
                true,
                format!("适配器已{}", if enabled { "启用" } else { "禁用" }),
            ))
        }
        Err(e) => {
            error!("{}适配器失败: {}", if enabled { "启用" } else { "禁用" }, e);
            Ok(CommandResponse::error(format!("操作失败: {}", e)))
        }
    }
}

/// 删除已安装的适配器
#[tauri::command]
pub async fn remove_installed_adapter(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("删除已安装的适配器: {}", adapter_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    // 获取适配器信息
    let adapter = match db.adapter_registry.get_adapter(&adapter_id).await {
        Ok(Some(adapter)) => adapter,
        Ok(None) => {
            return Ok(CommandResponse::error(format!("适配器不存在: {}", adapter_id)));
        }
        Err(e) => {
            return Ok(CommandResponse::error(format!("获取适配器信息失败: {}", e)));
        }
    };
    
    // 删除文件
    if std::path::Path::new(&adapter.install_path).exists() {
        if let Err(e) = std::fs::remove_dir_all(&adapter.install_path) {
            warn!("删除适配器文件失败: {}", e);
        }
    }
    
    // 从数据库删除
    match db.adapter_registry.delete_adapter(&adapter_id).await {
        Ok(_) => {
            info!("适配器 {} 已删除", adapter_id);
            Ok(CommandResponse::success_with_message(
                true,
                "适配器已删除".to_string(),
            ))
        }
        Err(e) => {
            error!("删除适配器失败: {}", e);
            Ok(CommandResponse::error(format!("删除适配器失败: {}", e)))
        }
    }
}

// ================================
// 版本管理命令
// ================================

/// 获取适配器的版本历史
#[tauri::command]
pub async fn get_adapter_versions(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<AdapterVersion>>, String> {
    info!("获取适配器版本历史: {}", adapter_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.get_versions(&adapter_id).await {
        Ok(versions) => {
            info!("成功获取 {} 个版本记录", versions.len());
            Ok(CommandResponse::success(versions))
        }
        Err(e) => {
            error!("获取版本历史失败: {}", e);
            Ok(CommandResponse::error(format!("获取版本历史失败: {}", e)))
        }
    }
}

/// 添加适配器版本记录
#[tauri::command]
pub async fn add_adapter_version(
    version: AdapterVersion,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("添加适配器版本: {} - {}", version.adapter_id, version.version);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.add_version(version).await {
        Ok(_) => {
            info!("版本记录添加成功");
            Ok(CommandResponse::success_with_message(
                true,
                "版本记录已添加".to_string(),
            ))
        }
        Err(e) => {
            error!("添加版本记录失败: {}", e);
            Ok(CommandResponse::error(format!("添加版本记录失败: {}", e)))
        }
    }
}

// ================================
// 依赖管理命令
// ================================

/// 获取适配器的依赖列表
#[tauri::command]
pub async fn get_adapter_dependencies(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<AdapterDependency>>, String> {
    info!("获取适配器依赖: {}", adapter_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.get_dependencies(&adapter_id).await {
        Ok(dependencies) => {
            info!("成功获取 {} 个依赖", dependencies.len());
            Ok(CommandResponse::success(dependencies))
        }
        Err(e) => {
            error!("获取依赖列表失败: {}", e);
            Ok(CommandResponse::error(format!("获取依赖列表失败: {}", e)))
        }
    }
}

/// 添加适配器依赖
#[tauri::command]
pub async fn add_adapter_dependency(
    dependency: AdapterDependency,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("添加适配器依赖: {} -> {}", dependency.adapter_id, dependency.dependency_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.add_dependency(dependency).await {
        Ok(_) => {
            info!("依赖添加成功");
            Ok(CommandResponse::success_with_message(
                true,
                "依赖已添加".to_string(),
            ))
        }
        Err(e) => {
            error!("添加依赖失败: {}", e);
            Ok(CommandResponse::error(format!("添加依赖失败: {}", e)))
        }
    }
}

/// 删除适配器依赖
#[tauri::command]
pub async fn remove_adapter_dependency(
    adapter_id: String,
    dependency_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("删除适配器依赖: {} -> {}", adapter_id, dependency_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.delete_dependency(&adapter_id, &dependency_id).await {
        Ok(_) => {
            info!("依赖删除成功");
            Ok(CommandResponse::success_with_message(
                true,
                "依赖已删除".to_string(),
            ))
        }
        Err(e) => {
            error!("删除依赖失败: {}", e);
            Ok(CommandResponse::error(format!("删除依赖失败: {}", e)))
        }
    }
}

// ================================
// 权限管理命令
// ================================

/// 获取适配器的权限列表
#[tauri::command]
pub async fn get_adapter_permissions(
    adapter_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<AdapterPermission>>, String> {
    info!("获取适配器权限: {}", adapter_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.get_permissions(&adapter_id).await {
        Ok(permissions) => {
            info!("成功获取 {} 个权限", permissions.len());
            Ok(CommandResponse::success(permissions))
        }
        Err(e) => {
            error!("获取权限列表失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限列表失败: {}", e)))
        }
    }
}

/// 授予/撤销适配器权限
#[tauri::command]
pub async fn grant_adapter_permission(
    adapter_id: String,
    permission_type: String,
    granted: bool,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!(
        "{}适配器权限: {} - {}",
        if granted { "授予" } else { "撤销" },
        adapter_id,
        permission_type
    );
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.grant_permission(&adapter_id, &permission_type, granted).await {
        Ok(_) => {
            info!("权限操作成功");
            Ok(CommandResponse::success_with_message(
                true,
                format!("权限已{}", if granted { "授予" } else { "撤销" }),
            ))
        }
        Err(e) => {
            error!("权限操作失败: {}", e);
            Ok(CommandResponse::error(format!("权限操作失败: {}", e)))
        }
    }
}

/// 检查适配器权限
#[tauri::command]
pub async fn check_adapter_permission(
    adapter_id: String,
    permission_type: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("检查适配器权限: {} - {}", adapter_id, permission_type);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.check_permission(&adapter_id, &permission_type).await {
        Ok(granted) => {
            Ok(CommandResponse::success(granted))
        }
        Err(e) => {
            error!("检查权限失败: {}", e);
            Ok(CommandResponse::error(format!("检查权限失败: {}", e)))
        }
    }
}

/// 添加适配器权限
#[tauri::command]
pub async fn add_adapter_permission(
    permission: AdapterPermission,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("添加适配器权限: {} - {}", permission.adapter_id, permission.permission_type);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.adapter_registry.add_permission(permission).await {
        Ok(_) => {
            info!("权限添加成功");
            Ok(CommandResponse::success_with_message(
                true,
                "权限已添加".to_string(),
            ))
        }
        Err(e) => {
            error!("添加权限失败: {}", e);
            Ok(CommandResponse::error(format!("添加权限失败: {}", e)))
        }
    }
}

// ================================
// Backend API Functions
// ================================

/// Get adapters from backend API
async fn get_adapters_from_backend() -> Result<Vec<AdapterInfo>, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .get(&format!("{}/api/models/", backend_url))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<AdapterInfo>>().await {
                    Ok(adapters) => Ok(adapters),
                    Err(e) => Err(format!("解析适配器列表失败: {}", e)),
                }
            } else {
                Err(format!("获取适配器列表失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求适配器列表失败: {}", e)),
    }
}

/// Install adapter from backend
async fn install_adapter_from_backend(request: &AdapterInstallRequest) -> Result<bool, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .post(&format!("{}/api/marketplace/", backend_url))
        .json(request)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(true)
            } else {
                Err(format!("安装适配器失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求安装适配器失败: {}", e)),
    }
}

/// Uninstall adapter from backend
async fn uninstall_adapter_from_backend(adapter_id: &str) -> Result<bool, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .delete(&format!("{}/api/models/unload", backend_url))
        .json(&serde_json::json!({
            "adapter_name": adapter_id,
            "force_unload": true
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(true)
            } else {
                Err(format!("卸载适配器失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求卸载适配器失败: {}", e)),
    }
}

/// Execute adapter action
async fn execute_adapter_action(request: &AdapterExecutionRequest) -> Result<serde_json::Value, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .post(&format!("{}/api/models/execute", backend_url))
        .json(request)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(result) => Ok(result),
                    Err(e) => Err(format!("解析执行结果失败: {}", e)),
                }
            } else {
                Err(format!("执行适配器操作失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求执行适配器操作失败: {}", e)),
    }
}

/// Get adapter configuration from backend
async fn get_adapter_config_from_backend(adapter_id: &str) -> Result<HashMap<String, serde_json::Value>, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .get(&format!("{}/api/models/adapter/{}/info", backend_url, adapter_id))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<AdapterInfo>().await {
                    Ok(adapter_info) => Ok(adapter_info.config),
                    Err(e) => Err(format!("解析适配器配置失败: {}", e)),
                }
            } else {
                Err(format!("获取适配器配置失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求适配器配置失败: {}", e)),
    }
}

/// Update adapter configuration in backend
async fn update_adapter_config_in_backend(request: &AdapterConfigUpdateRequest) -> Result<bool, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .put(&format!("{}/api/models/adapter/{}/config", backend_url, request.adapter_id))
        .json(&request.config)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(true)
            } else {
                Err(format!("更新适配器配置失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求更新适配器配置失败: {}", e)),
    }
}

/// Search adapters in marketplace
async fn search_adapters_in_marketplace(request: &AdapterSearchRequest) -> Result<PaginatedResponse<serde_json::Value>, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    let mut query_params: Vec<(&str, String)> = vec![
        ("q", request.query.clone()),
        ("type", "products".to_string()),
    ];
    
    if let Some(page) = request.page {
        query_params.push(("page", page.to_string()));
    }
    if let Some(page_size) = request.page_size {
        query_params.push(("size", page_size.to_string()));
    }
    if let Some(ref category) = request.category {
        query_params.push(("category", category.clone()));
    }
    if let Some(ref sort_by) = request.sort_by {
        query_params.push(("sort_by", sort_by.clone()));
    }
    if let Some(ref sort_order) = request.sort_order {
        query_params.push(("sort_order", sort_order.clone()));
    }
    
    let url = format!("{}/api/marketplace/search", backend_url);
    
    // 转换参数格式
    let query_pairs: Vec<(String, String)> = query_params
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();
    
    match client
        .get(&url)
        .query(&query_pairs)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<PaginatedResponse<serde_json::Value>>().await {
                    Ok(results) => Ok(results),
                    Err(e) => Err(format!("解析搜索结果失败: {}", e)),
                }
            } else {
                Err(format!("搜索适配器失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求搜索适配器失败: {}", e)),
    }
}

/// Get adapter details from backend
async fn get_adapter_details_from_backend(adapter_id: &str) -> Result<AdapterMetadata, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .get(&format!("{}/api/marketplace/{}", backend_url, adapter_id))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        // Convert marketplace product data to adapter metadata
                        let metadata = AdapterMetadata {
                            id: data["id"].as_str().unwrap_or(adapter_id).to_string(),
                            name: data["name"].as_str().unwrap_or("Unknown").to_string(),
                            version: data["version"].as_str().unwrap_or("1.0.0").to_string(),
                            adapter_type: match data["product_type"].as_str() {
                                Some("adapter") => AdapterType::Soft,
                                Some("service") => AdapterType::Hard,
                                _ => AdapterType::Soft,
                            },
                            description: data["description"].as_str().map(|s| s.to_string()),
                            author: data["vendor"]["name"].as_str().map(|s| s.to_string()),
                            license: data["pricing"]["license_type"].as_str().map(|s| s.to_string()),
                            tags: data["tags"].as_array()
                                .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
                                .unwrap_or_default(),
                            created_at: chrono::Utc::now(),
                            updated_at: chrono::Utc::now(),
                            capabilities: vec![],
                            compatibility: AdapterCompatibility {
                                base_models: data["compatibility"]["base_models"].as_array()
                                    .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
                                    .unwrap_or_default(),
                                frameworks: HashMap::new(),
                                operating_systems: vec!["linux".to_string(), "windows".to_string(), "macos".to_string()],
                                python_versions: vec!["3.8+".to_string()],
                            },
                            resource_requirements: AdapterResourceRequirements {
                                min_memory_mb: data["metadata"]["performance_metrics"]["memory_usage"].as_str()
                                    .and_then(|s| s.replace("GB", "").parse::<f64>().ok())
                                    .map(|gb| (gb * 1024.0) as u64),
                                min_cpu_cores: Some(1),
                                gpu_required: false,
                                min_gpu_memory_mb: None,
                                python_version: Some("3.8+".to_string()),
                                dependencies: data["requirements"].as_array()
                                    .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
                                    .unwrap_or_default(),
                            },
                            config_schema: HashMap::new(),
                            default_config: HashMap::new(),
                            file_size_bytes: data["file_size"].as_u64(),
                            parameter_count: None,
                        };
                        Ok(metadata)
                    }
                    Err(e) => Err(format!("解析适配器详情失败: {}", e)),
                }
            } else {
                Err(format!("获取适配器详情失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求适配器详情失败: {}", e)),
    }
}

/// Load adapter in backend
async fn load_adapter_in_backend(adapter_id: &str) -> Result<bool, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .post(&format!("{}/api/models/load", backend_url))
        .json(&serde_json::json!({
            "adapter_name": adapter_id,
            "force_reload": false
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(true)
            } else {
                Err(format!("加载适配器失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求加载适配器失败: {}", e)),
    }
}

/// Unload adapter in backend
async fn unload_adapter_in_backend(adapter_id: &str) -> Result<bool, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    match client
        .post(&format!("{}/api/models/unload", backend_url))
        .json(&serde_json::json!({
            "adapter_name": adapter_id,
            "force_unload": false
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(true)
            } else {
                Err(format!("卸载适配器失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求卸载适配器失败: {}", e)),
    }
}

/// Get adapter status from backend
async fn get_adapter_status_from_backend(adapter_id: Option<&str>) -> Result<serde_json::Value, String> {
    let client = Client::new();
    let backend_url = get_backend_url();
    
    let url = if let Some(id) = adapter_id {
        format!("{}/api/models/status?adapter_name={}", backend_url, id)
    } else {
        format!("{}/api/models/status", backend_url)
    };
    
    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(status) => Ok(status),
                    Err(e) => Err(format!("解析适配器状态失败: {}", e)),
                }
            } else {
                Err(format!("获取适配器状态失败: {}", response.status()))
            }
        }
        Err(e) => Err(format!("请求适配器状态失败: {}", e)),
    }
}

/// Get backend URL from environment or default
fn get_backend_url() -> String {
    std::env::var("ZISHU_BACKEND_URL")
        .unwrap_or_else(|_| "http://localhost:8000".to_string())
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert("get_adapters".to_string(), CommandMetadata {
            name: "get_adapters".to_string(),
        description: "获取已安装的适配器列表".to_string(),
            input_type: None,
            output_type: Some("Vec<AdapterInfo>".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "adapter".to_string(),
    });
    
    metadata.insert("install_adapter".to_string(), CommandMetadata {
        name: "install_adapter".to_string(),
        description: "安装新的适配器".to_string(),
        input_type: Some("AdapterInstallRequest".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("uninstall_adapter".to_string(), CommandMetadata {
        name: "uninstall_adapter".to_string(),
        description: "卸载适配器".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("execute_adapter".to_string(), CommandMetadata {
        name: "execute_adapter".to_string(),
        description: "执行适配器操作".to_string(),
        input_type: Some("AdapterExecutionRequest".to_string()),
        output_type: Some("serde_json::Value".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("get_adapter_config".to_string(), CommandMetadata {
        name: "get_adapter_config".to_string(),
        description: "获取适配器配置".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("HashMap<String, serde_json::Value>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("update_adapter_config".to_string(), CommandMetadata {
        name: "update_adapter_config".to_string(),
        description: "更新适配器配置".to_string(),
        input_type: Some("AdapterConfigUpdateRequest".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("search_adapters".to_string(), CommandMetadata {
        name: "search_adapters".to_string(),
        description: "在市场中搜索适配器".to_string(),
        input_type: Some("AdapterSearchRequest".to_string()),
        output_type: Some("PaginatedResponse<serde_json::Value>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("get_adapter_details".to_string(), CommandMetadata {
        name: "get_adapter_details".to_string(),
        description: "获取适配器详细信息".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("AdapterMetadata".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("load_adapter".to_string(), CommandMetadata {
        name: "load_adapter".to_string(),
        description: "加载适配器".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("unload_adapter".to_string(), CommandMetadata {
        name: "unload_adapter".to_string(),
        description: "卸载适配器".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("get_adapter_status".to_string(), CommandMetadata {
        name: "get_adapter_status".to_string(),
        description: "获取适配器状态".to_string(),
        input_type: Some("Option<String>".to_string()),
        output_type: Some("serde_json::Value".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    // 本地适配器管理命令
    metadata.insert("get_installed_adapters".to_string(), CommandMetadata {
        name: "get_installed_adapters".to_string(),
        description: "获取本地已安装的适配器列表".to_string(),
        input_type: None,
        output_type: Some("Vec<InstalledAdapter>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("get_enabled_adapters".to_string(), CommandMetadata {
        name: "get_enabled_adapters".to_string(),
        description: "获取已启用的适配器列表".to_string(),
        input_type: None,
        output_type: Some("Vec<InstalledAdapter>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("get_installed_adapter".to_string(), CommandMetadata {
        name: "get_installed_adapter".to_string(),
        description: "获取单个已安装适配器的详情".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("InstalledAdapter".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("toggle_adapter".to_string(), CommandMetadata {
        name: "toggle_adapter".to_string(),
        description: "启用/禁用适配器".to_string(),
        input_type: Some("(String, bool)".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("remove_installed_adapter".to_string(), CommandMetadata {
        name: "remove_installed_adapter".to_string(),
        description: "删除已安装的适配器".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    // 版本管理命令
    metadata.insert("get_adapter_versions".to_string(), CommandMetadata {
        name: "get_adapter_versions".to_string(),
        description: "获取适配器的版本历史".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("Vec<AdapterVersion>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("add_adapter_version".to_string(), CommandMetadata {
        name: "add_adapter_version".to_string(),
        description: "添加适配器版本记录".to_string(),
        input_type: Some("AdapterVersion".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    // 依赖管理命令
    metadata.insert("get_adapter_dependencies".to_string(), CommandMetadata {
        name: "get_adapter_dependencies".to_string(),
        description: "获取适配器的依赖列表".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("Vec<AdapterDependency>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("add_adapter_dependency".to_string(), CommandMetadata {
        name: "add_adapter_dependency".to_string(),
        description: "添加适配器依赖".to_string(),
        input_type: Some("AdapterDependency".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("remove_adapter_dependency".to_string(), CommandMetadata {
        name: "remove_adapter_dependency".to_string(),
        description: "删除适配器依赖".to_string(),
        input_type: Some("(String, String)".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    // 权限管理命令
    metadata.insert("get_adapter_permissions".to_string(), CommandMetadata {
        name: "get_adapter_permissions".to_string(),
        description: "获取适配器的权限列表".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("Vec<AdapterPermission>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("grant_adapter_permission".to_string(), CommandMetadata {
        name: "grant_adapter_permission".to_string(),
        description: "授予/撤销适配器权限".to_string(),
        input_type: Some("(String, String, bool)".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("check_adapter_permission".to_string(), CommandMetadata {
        name: "check_adapter_permission".to_string(),
        description: "检查适配器权限".to_string(),
        input_type: Some("(String, String)".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata.insert("add_adapter_permission".to_string(), CommandMetadata {
        name: "add_adapter_permission".to_string(),
        description: "添加适配器权限".to_string(),
        input_type: Some("AdapterPermission".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "adapter".to_string(),
    });
    
    metadata
}
