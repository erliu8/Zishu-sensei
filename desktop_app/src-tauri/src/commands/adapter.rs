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
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use serde_json::json;
    
    // Mock database for testing
    pub struct MockDatabase {
        pub adapter_registry: MockAdapterRegistry,
    }
    
    impl MockDatabase {
        pub fn new() -> Self {
            Self {
                adapter_registry: MockAdapterRegistry::new(),
            }
        }
    }
    
    // Mock adapter registry
    pub struct MockAdapterRegistry;
    
    impl MockAdapterRegistry {
        pub fn new() -> Self {
            Self
        }
        
        pub async fn get_all_adapters(&self) -> Result<Vec<crate::database::adapter::InstalledAdapter>, String> {
            Ok(vec![
                crate::database::adapter::InstalledAdapter {
                    id: "test_adapter".to_string(),
                    name: "Test Adapter".to_string(),
                    display_name: "Test Adapter".to_string(),
                    version: "1.0.0".to_string(),
                    install_path: "/test/path".to_string(),
                    status: crate::database::adapter::AdapterInstallStatus::Installed,
                    enabled: true,
                    auto_update: false,
                    source: "test".to_string(),
                    source_id: Some("test_adapter".to_string()),
                    description: Some("Test adapter description".to_string()),
                    author: Some("Test Author".to_string()),
                    license: Some("MIT".to_string()),
                    homepage_url: Some("https://example.com".to_string()),
                    installed_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    last_used_at: Some(chrono::Utc::now()),
                    config: HashMap::new(),
                    metadata: HashMap::new(),
                }
            ])
        }
        
        pub async fn get_enabled_adapters(&self) -> Result<Vec<crate::database::adapter::InstalledAdapter>, String> {
            let all_adapters = self.get_all_adapters().await?;
            Ok(all_adapters.into_iter().filter(|a| a.enabled).collect())
        }
        
        pub async fn get_adapter(&self, id: &str) -> Result<Option<crate::database::adapter::InstalledAdapter>, String> {
            if id == "test_adapter" {
                let adapters = self.get_all_adapters().await?;
                Ok(adapters.into_iter().next())
            } else {
                Ok(None)
            }
        }
        
        pub async fn set_adapter_enabled(&self, _id: &str, _enabled: bool) -> Result<(), String> {
            Ok(())
        }
        
        pub async fn delete_adapter(&self, _id: &str) -> Result<(), String> {
            Ok(())
        }
        
        pub async fn get_versions(&self, _id: &str) -> Result<Vec<crate::database::adapter::AdapterVersion>, String> {
            Ok(vec![])
        }
        
        pub async fn add_version(&self, _version: crate::database::adapter::AdapterVersion) -> Result<(), String> {
            Ok(())
        }
        
        pub async fn get_dependencies(&self, _id: &str) -> Result<Vec<crate::database::adapter::AdapterDependency>, String> {
            Ok(vec![])
        }
        
        pub async fn add_dependency(&self, _dependency: crate::database::adapter::AdapterDependency) -> Result<(), String> {
            Ok(())
        }
        
        pub async fn delete_dependency(&self, _adapter_id: &str, _dependency_id: &str) -> Result<(), String> {
            Ok(())
        }
        
        pub async fn get_permissions(&self, _id: &str) -> Result<Vec<crate::database::adapter::AdapterPermission>, String> {
            Ok(vec![])
        }
        
        pub async fn grant_permission(&self, _id: &str, _permission_type: &str, _granted: bool) -> Result<(), String> {
            Ok(())
        }
        
        pub async fn check_permission(&self, _id: &str, _permission_type: &str) -> Result<bool, String> {
            Ok(true)
        }
        
        pub async fn add_permission(&self, _permission: crate::database::adapter::AdapterPermission) -> Result<(), String> {
            Ok(())
        }
    }
    
    // Helper function to create mock adapter config
    fn create_mock_adapter_config() -> HashMap<String, serde_json::Value> {
        let mut config = HashMap::new();
        config.insert("temperature".to_string(), json!(0.7));
        config.insert("max_tokens".to_string(), json!(2048));
        config.insert("top_p".to_string(), json!(0.9));
        config
    }

    // ================================
    // 数据类型测试
    // ================================

    #[test]
    fn test_adapter_status_serialization() {
        let statuses = vec![
            AdapterStatus::Loaded,
            AdapterStatus::Unloaded,
            AdapterStatus::Loading,
            AdapterStatus::Unloading,
            AdapterStatus::Error,
            AdapterStatus::Unknown,
            AdapterStatus::Maintenance,
        ];

        for status in statuses {
            let serialized = serde_json::to_string(&status).expect("序列化失败");
            let deserialized: AdapterStatus = serde_json::from_str(&serialized).expect("反序列化失败");
            assert_eq!(status, deserialized);
        }
    }

    #[test]
    fn test_adapter_type_serialization() {
        let types = vec![
            AdapterType::Soft,
            AdapterType::Hard,
            AdapterType::Intelligent,
        ];

        for adapter_type in types {
            let serialized = serde_json::to_string(&adapter_type).expect("序列化失败");
            let deserialized: AdapterType = serde_json::from_str(&serialized).expect("反序列化失败");
            assert_eq!(adapter_type, deserialized);
        }
    }

    #[test]
    fn test_capability_level_serialization() {
        let levels = vec![
            CapabilityLevel::Basic,
            CapabilityLevel::Intermediate,
            CapabilityLevel::Advanced,
            CapabilityLevel::Expert,
        ];

        for level in levels {
            let serialized = serde_json::to_string(&level).expect("序列化失败");
            let deserialized: CapabilityLevel = serde_json::from_str(&serialized).expect("反序列化失败");
            assert_eq!(level, deserialized);
        }
    }

    #[test]
    fn test_adapter_capability_serialization() {
        let capability = AdapterCapability {
            name: "test_capability".to_string(),
            description: "Test capability description".to_string(),
            level: CapabilityLevel::Advanced,
            required_params: vec!["param1".to_string(), "param2".to_string()],
            optional_params: vec!["optional1".to_string()],
        };

        let serialized = serde_json::to_string(&capability).expect("序列化失败");
        let deserialized: AdapterCapability = serde_json::from_str(&serialized).expect("反序列化失败");

        assert_eq!(capability.name, deserialized.name);
        assert_eq!(capability.description, deserialized.description);
        assert_eq!(capability.level, deserialized.level);
        assert_eq!(capability.required_params, deserialized.required_params);
        assert_eq!(capability.optional_params, deserialized.optional_params);
    }

    #[test]
    fn test_adapter_resource_requirements_serialization() {
        let requirements = AdapterResourceRequirements {
            min_memory_mb: Some(1024),
            min_cpu_cores: Some(2),
            gpu_required: true,
            min_gpu_memory_mb: Some(512),
            python_version: Some("3.8+".to_string()),
            dependencies: vec!["numpy".to_string(), "torch".to_string()],
        };

        let serialized = serde_json::to_string(&requirements).expect("序列化失败");
        let deserialized: AdapterResourceRequirements = serde_json::from_str(&serialized).expect("反序列化失败");

        assert_eq!(requirements.min_memory_mb, deserialized.min_memory_mb);
        assert_eq!(requirements.min_cpu_cores, deserialized.min_cpu_cores);
        assert_eq!(requirements.gpu_required, deserialized.gpu_required);
        assert_eq!(requirements.min_gpu_memory_mb, deserialized.min_gpu_memory_mb);
        assert_eq!(requirements.python_version, deserialized.python_version);
        assert_eq!(requirements.dependencies, deserialized.dependencies);
    }

    #[test]
    fn test_adapter_metadata_creation() {
        let mut config_schema = HashMap::new();
        config_schema.insert("temperature".to_string(), json!(0.7));
        
        let mut default_config = HashMap::new();
        default_config.insert("max_tokens".to_string(), json!(2048));

        let metadata = AdapterMetadata {
            id: "test_adapter".to_string(),
            name: "Test Adapter".to_string(),
            version: "1.0.0".to_string(),
            adapter_type: AdapterType::Soft,
            description: Some("Test description".to_string()),
            author: Some("Test Author".to_string()),
            license: Some("MIT".to_string()),
            tags: vec!["test".to_string(), "demo".to_string()],
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            capabilities: vec![],
            compatibility: AdapterCompatibility {
                base_models: vec!["gpt-3.5".to_string()],
                frameworks: HashMap::new(),
                operating_systems: vec!["linux".to_string()],
                python_versions: vec!["3.8+".to_string()],
            },
            resource_requirements: AdapterResourceRequirements {
                min_memory_mb: Some(512),
                min_cpu_cores: Some(1),
                gpu_required: false,
                min_gpu_memory_mb: None,
                python_version: Some("3.8+".to_string()),
                dependencies: vec![],
            },
            config_schema,
            default_config,
            file_size_bytes: Some(1024000),
            parameter_count: Some(100000),
        };

        assert_eq!(metadata.id, "test_adapter");
        assert_eq!(metadata.name, "Test Adapter");
        assert_eq!(metadata.version, "1.0.0");
        assert_eq!(metadata.adapter_type, AdapterType::Soft);
        assert!(metadata.description.is_some());
        assert!(metadata.author.is_some());
        assert_eq!(metadata.tags.len(), 2);
    }

    #[test]
    fn test_adapter_install_request_validation() {
        let mut options = HashMap::new();
        options.insert("auto_start".to_string(), json!(true));

        let request = AdapterInstallRequest {
            adapter_id: "test_adapter".to_string(),
            source: "market".to_string(),
            force: false,
            options,
        };

        assert_eq!(request.adapter_id, "test_adapter");
        assert_eq!(request.source, "market");
        assert!(!request.force);
        assert!(!request.options.is_empty());
    }

    #[test]
    fn test_adapter_execution_request_validation() {
        let mut params = HashMap::new();
        params.insert("input_text".to_string(), json!("Hello world"));

        let request = AdapterExecutionRequest {
            adapter_id: "test_adapter".to_string(),
            action: "generate".to_string(),
            params,
            timeout: Some(30),
        };

        assert_eq!(request.adapter_id, "test_adapter");
        assert_eq!(request.action, "generate");
        assert_eq!(request.timeout, Some(30));
        assert!(!request.params.is_empty());
    }

    #[test]
    fn test_adapter_search_request_creation() {
        let request = AdapterSearchRequest {
            query: "AI assistant".to_string(),
            adapter_type: Some(AdapterType::Soft),
            category: Some("productivity".to_string()),
            tags: Some(vec!["ai".to_string(), "assistant".to_string()]),
            price_min: Some(0.0),
            price_max: Some(100.0),
            rating_min: Some(4.0),
            free_only: Some(true),
            featured_only: Some(false),
            page: Some(1),
            page_size: Some(20),
            sort_by: Some("rating".to_string()),
            sort_order: Some("desc".to_string()),
        };

        assert_eq!(request.query, "AI assistant");
        assert_eq!(request.adapter_type, Some(AdapterType::Soft));
        assert!(request.category.is_some());
        assert!(request.tags.is_some());
        assert_eq!(request.page, Some(1));
        assert_eq!(request.page_size, Some(20));
    }

    // ================================
    // 命令处理函数测试
    // ================================

    #[tokio::test]
    async fn test_get_backend_url() {
        // Test default URL
        std::env::remove_var("ZISHU_BACKEND_URL");
        assert_eq!(get_backend_url(), "http://localhost:8000");

        // Test custom URL
        std::env::set_var("ZISHU_BACKEND_URL", "https://api.example.com");
        assert_eq!(get_backend_url(), "https://api.example.com");
        
        // Clean up
        std::env::remove_var("ZISHU_BACKEND_URL");
    }

    #[tokio::test]
    async fn test_command_response_success() {
        let data = vec!["adapter1".to_string(), "adapter2".to_string()];
        let response = CommandResponse::success(data.clone());

        assert!(response.success);
        assert_eq!(response.data, Some(data));
        assert!(response.error.is_none());
        assert!(response.message.is_none());
        assert!(response.timestamp > 0);
    }

    #[tokio::test]
    async fn test_command_response_error() {
        let error_msg = "Test error message".to_string();
        let response: CommandResponse<String> = CommandResponse::error(error_msg.clone());

        assert!(!response.success);
        assert!(response.data.is_none());
        assert_eq!(response.error, Some(error_msg));
        assert!(response.message.is_none());
        assert!(response.timestamp > 0);
    }

    #[tokio::test]
    async fn test_command_response_success_with_message() {
        let data = true;
        let message = "Operation completed successfully".to_string();
        let response = CommandResponse::success_with_message(data, message.clone());

        assert!(response.success);
        assert_eq!(response.data, Some(data));
        assert!(response.error.is_none());
        assert_eq!(response.message, Some(message));
        assert!(response.timestamp > 0);
    }

    // ================================
    // Mock HTTP 客户端测试
    // ================================

    #[tokio::test]
    async fn test_adapter_info_creation() {
        let mut config = HashMap::new();
        config.insert("temperature".to_string(), json!(0.7));

        let info = AdapterInfo {
            name: "Test Adapter".to_string(),
            path: Some("/test/path".to_string()),
            size: Some(1024),
            version: Some("1.0.0".to_string()),
            description: Some("Test adapter".to_string()),
            status: AdapterStatus::Loaded,
            load_time: Some(chrono::Utc::now()),
            memory_usage: Some(512),
            config,
        };

        assert_eq!(info.name, "Test Adapter");
        assert!(info.path.is_some());
        assert_eq!(info.status, AdapterStatus::Loaded);
        assert!(info.load_time.is_some());
        assert!(!info.config.is_empty());
    }

    // ================================
    // 数据库集成测试
    // ================================

    #[tokio::test]
    async fn test_database_mock_operations() {
        let mock_db = MockDatabase::new();
        
        // Test get_all_adapters
        let adapters = mock_db.adapter_registry.get_all_adapters().await.unwrap();
        assert_eq!(adapters.len(), 1);
        assert_eq!(adapters[0].id, "test_adapter");
        
        // Test get_adapter
        let adapter = mock_db.adapter_registry.get_adapter("test_adapter").await.unwrap();
        assert!(adapter.is_some());
        let adapter = adapter.unwrap();
        assert_eq!(adapter.name, "Test Adapter");
        assert!(adapter.enabled);
        
        // Test non-existent adapter
        let non_existent = mock_db.adapter_registry.get_adapter("non_existent").await.unwrap();
        assert!(non_existent.is_none());
    }

    #[tokio::test]
    async fn test_database_adapter_toggle() {
        let mock_db = MockDatabase::new();
        
        // Test enable adapter
        let result = mock_db.adapter_registry.set_adapter_enabled("test_adapter", true).await;
        assert!(result.is_ok());
        
        // Test disable adapter
        let result = mock_db.adapter_registry.set_adapter_enabled("test_adapter", false).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_database_adapter_delete() {
        let mock_db = MockDatabase::new();
        
        // Test delete adapter
        let result = mock_db.adapter_registry.delete_adapter("test_adapter").await;
        assert!(result.is_ok());
    }

    // ================================
    // 命令处理函数测试
    // ================================

    /// 创建模拟应用状态
    fn create_mock_app_state() -> MockAppState {
        use crate::{AppConfig as Config, CharacterConfig};
        use std::sync::Arc;
        use parking_lot::Mutex;
        
        let config = Config::default();
        MockAppState {
            config: Arc::new(Mutex::new(config)),
        }
    }
    
    /// 简化的AppState用于测试
    pub struct MockAppState {
        pub config: std::sync::Arc<parking_lot::Mutex<crate::AppConfig>>,
    }

    /// 创建模拟Tauri应用句柄 (测试用)
    fn create_mock_app_handle() -> Option<tauri::AppHandle> {
        // 在实际测试中，我们无法创建真实的AppHandle
        // 所以我们需要模拟或跳过需要AppHandle的测试
        None
    }

    #[tokio::test]
    async fn test_get_backend_url_with_env() {
        // Test with environment variable
        std::env::set_var("ZISHU_BACKEND_URL", "https://test.example.com");
        let url = get_backend_url();
        assert_eq!(url, "https://test.example.com");
        
        // Clean up
        std::env::remove_var("ZISHU_BACKEND_URL");
        
        // Test default URL
        let url = get_backend_url();
        assert_eq!(url, "http://localhost:8000");
    }

    #[tokio::test]
    async fn test_adapter_install_request_validation_extended() {
        let mut options = HashMap::new();
        options.insert("force".to_string(), json!(true));
        options.insert("timeout".to_string(), json!(30));

        let request = AdapterInstallRequest {
            adapter_id: "gpt-adapter".to_string(),
            source: "marketplace".to_string(),
            force: true,
            options,
        };

        // Validate structure
        assert_eq!(request.adapter_id, "gpt-adapter");
        assert_eq!(request.source, "marketplace");
        assert!(request.force);
        assert_eq!(request.options.len(), 2);
        assert_eq!(request.options["force"], json!(true));
        assert_eq!(request.options["timeout"], json!(30));
    }

    #[tokio::test]
    async fn test_adapter_execution_request_edge_cases() {
        // Test with empty params
        let request = AdapterExecutionRequest {
            adapter_id: "test_adapter".to_string(),
            action: "ping".to_string(),
            params: HashMap::new(),
            timeout: Some(1), // Very short timeout
        };
        
        assert_eq!(request.params.len(), 0);
        assert_eq!(request.timeout, Some(1));

        // Test with large params
        let mut large_params = HashMap::new();
        for i in 0..1000 {
            large_params.insert(format!("param_{}", i), json!(format!("value_{}", i)));
        }
        
        let large_request = AdapterExecutionRequest {
            adapter_id: "test_adapter".to_string(),
            action: "process".to_string(),
            params: large_params,
            timeout: None,
        };
        
        assert_eq!(large_request.params.len(), 1000);
        assert!(large_request.timeout.is_none());
    }

    #[tokio::test]
    async fn test_adapter_search_request_comprehensive() {
        // Test full search request
        let search_request = AdapterSearchRequest {
            query: "AI language model".to_string(),
            adapter_type: Some(AdapterType::Intelligent),
            category: Some("nlp".to_string()),
            tags: Some(vec!["gpt".to_string(), "transformer".to_string()]),
            price_min: Some(0.0),
            price_max: Some(50.0),
            rating_min: Some(4.5),
            free_only: Some(false),
            featured_only: Some(true),
            page: Some(2),
            page_size: Some(25),
            sort_by: Some("popularity".to_string()),
            sort_order: Some("asc".to_string()),
        };

        assert_eq!(search_request.query, "AI language model");
        assert_eq!(search_request.adapter_type, Some(AdapterType::Intelligent));
        assert_eq!(search_request.category, Some("nlp".to_string()));
        assert!(search_request.tags.as_ref().unwrap().contains(&"gpt".to_string()));
        assert_eq!(search_request.price_min, Some(0.0));
        assert_eq!(search_request.price_max, Some(50.0));
        assert_eq!(search_request.rating_min, Some(4.5));
        assert_eq!(search_request.free_only, Some(false));
        assert_eq!(search_request.featured_only, Some(true));
        assert_eq!(search_request.page, Some(2));
        assert_eq!(search_request.page_size, Some(25));

        // Test minimal search request
        let minimal_request = AdapterSearchRequest {
            query: "test".to_string(),
            adapter_type: None,
            category: None,
            tags: None,
            price_min: None,
            price_max: None,
            rating_min: None,
            free_only: None,
            featured_only: None,
            page: None,
            page_size: None,
            sort_by: None,
            sort_order: None,
        };

        assert_eq!(minimal_request.query, "test");
        assert!(minimal_request.adapter_type.is_none());
        assert!(minimal_request.category.is_none());
    }

    // ================================
    // 版本管理测试
    // ================================

    #[tokio::test]
    async fn test_adapter_version_management() {
        let mock_db = MockDatabase::new();
        
        // Test get versions
        let versions = mock_db.adapter_registry.get_versions("test_adapter").await.unwrap();
        assert_eq!(versions.len(), 0);
        
        // Test add version  
        let version = crate::database::adapter::AdapterVersion {
            id: 1,
            adapter_id: "test_adapter".to_string(),
            version: "1.0.1".to_string(),
            changelog: Some("Bug fixes and improvements".to_string()),
            released_at: chrono::Utc::now(),
            download_url: Some("https://example.com/v1.0.1".to_string()),
            checksum: Some("sha256:abc123".to_string()),
            file_size: Some(1024000),
            is_current: true,
        };
        
        let result = mock_db.adapter_registry.add_version(version).await;
        assert!(result.is_ok());
    }

    // ================================
    // 依赖管理测试
    // ================================

    #[tokio::test]
    async fn test_adapter_dependency_management() {
        let mock_db = MockDatabase::new();
        
        // Test get dependencies
        let dependencies = mock_db.adapter_registry.get_dependencies("test_adapter").await.unwrap();
        assert_eq!(dependencies.len(), 0);
        
        // Test add dependency
        let dependency = crate::database::adapter::AdapterDependency {
            id: 1,
            adapter_id: "test_adapter".to_string(),
            dependency_id: "base_model".to_string(),
            version_requirement: ">=1.0.0".to_string(),
            required: true,
        };
        
        let result = mock_db.adapter_registry.add_dependency(dependency).await;
        assert!(result.is_ok());
        
        // Test delete dependency
        let result = mock_db.adapter_registry.delete_dependency("test_adapter", "base_model").await;
        assert!(result.is_ok());
    }

    // ================================
    // 权限管理测试
    // ================================

    #[tokio::test]
    async fn test_adapter_permission_management() {
        let mock_db = MockDatabase::new();
        
        // Test get permissions
        let permissions = mock_db.adapter_registry.get_permissions("test_adapter").await.unwrap();
        assert_eq!(permissions.len(), 0);
        
        // Test check permission (should return true in mock)
        let has_permission = mock_db.adapter_registry.check_permission("test_adapter", "read").await.unwrap();
        assert!(has_permission);
        
        // Test grant permission
        let result = mock_db.adapter_registry.grant_permission("test_adapter", "write", true).await;
        assert!(result.is_ok());
        
        // Test revoke permission
        let result = mock_db.adapter_registry.grant_permission("test_adapter", "write", false).await;
        assert!(result.is_ok());
        
        // Test add permission
        let permission = crate::database::adapter::AdapterPermission {
            id: 1,
            adapter_id: "test_adapter".to_string(),
            permission_type: "execute".to_string(),
            granted: true,
            granted_at: Some(chrono::Utc::now()),
            description: Some("Execute permission for test adapter".to_string()),
        };
        
        let result = mock_db.adapter_registry.add_permission(permission).await;
        assert!(result.is_ok());
    }

    // ================================
    // 边界条件和错误处理测试
    // ================================

    #[test]
    fn test_empty_adapter_search_request() {
        let request = AdapterSearchRequest {
            query: "".to_string(),
            adapter_type: None,
            category: None,
            tags: None,
            price_min: None,
            price_max: None,
            rating_min: None,
            free_only: None,
            featured_only: None,
            page: None,
            page_size: None,
            sort_by: None,
            sort_order: None,
        };

        assert_eq!(request.query, "");
        assert!(request.adapter_type.is_none());
        assert!(request.category.is_none());
        assert!(request.tags.is_none());
    }

    #[test]
    fn test_adapter_config_update_request() {
        let mut config = HashMap::new();
        config.insert("new_param".to_string(), json!("new_value"));

        let request = AdapterConfigUpdateRequest {
            adapter_id: "test_adapter".to_string(),
            config,
            merge: true,
        };

        assert_eq!(request.adapter_id, "test_adapter");
        assert!(request.merge);
        assert!(!request.config.is_empty());
    }

    #[test]
    fn test_large_adapter_metadata() {
        let mut large_config = HashMap::new();
        for i in 0..1000 {
            large_config.insert(format!("param_{}", i), json!(format!("value_{}", i)));
        }

        let metadata = AdapterMetadata {
            id: "large_adapter".to_string(),
            name: "Large Adapter".to_string(),
            version: "1.0.0".to_string(),
            adapter_type: AdapterType::Intelligent,
            description: Some("A".repeat(10000)), // 10KB description
            author: Some("Test Author".to_string()),
            license: Some("MIT".to_string()),
            tags: (0..100).map(|i| format!("tag_{}", i)).collect(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            capabilities: vec![],
            compatibility: AdapterCompatibility {
                base_models: (0..50).map(|i| format!("model_{}", i)).collect(),
                frameworks: HashMap::new(),
                operating_systems: vec!["linux".to_string(), "windows".to_string(), "macos".to_string()],
                python_versions: vec!["3.8+".to_string(), "3.9+".to_string(), "3.10+".to_string()],
            },
            resource_requirements: AdapterResourceRequirements {
                min_memory_mb: Some(8192),
                min_cpu_cores: Some(8),
                gpu_required: true,
                min_gpu_memory_mb: Some(4096),
                python_version: Some("3.10+".to_string()),
                dependencies: (0..100).map(|i| format!("dep_{}", i)).collect(),
            },
            config_schema: large_config.clone(),
            default_config: large_config,
            file_size_bytes: Some(1024 * 1024 * 100), // 100MB
            parameter_count: Some(1000000),
        };

        // Test that large metadata can be created and serialized
        let serialized = serde_json::to_string(&metadata);
        assert!(serialized.is_ok());
        assert!(serialized.unwrap().len() > 10000); // Should be quite large
    }

    #[test]
    fn test_unicode_adapter_names() {
        let metadata = AdapterMetadata {
            id: "unicode_adapter".to_string(),
            name: "测试适配器 🚀".to_string(),
            version: "1.0.0".to_string(),
            adapter_type: AdapterType::Soft,
            description: Some("这是一个支持中文的适配器 🎯".to_string()),
            author: Some("开发者 👨‍💻".to_string()),
            license: Some("MIT".to_string()),
            tags: vec!["中文".to_string(), "测试".to_string(), "🏷️".to_string()],
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            capabilities: vec![],
            compatibility: AdapterCompatibility {
                base_models: vec!["模型A".to_string(), "模型B".to_string()],
                frameworks: HashMap::new(),
                operating_systems: vec!["linux".to_string()],
                python_versions: vec!["3.8+".to_string()],
            },
            resource_requirements: AdapterResourceRequirements {
                min_memory_mb: Some(512),
                min_cpu_cores: Some(1),
                gpu_required: false,
                min_gpu_memory_mb: None,
                python_version: Some("3.8+".to_string()),
                dependencies: vec![],
            },
            config_schema: HashMap::new(),
            default_config: HashMap::new(),
            file_size_bytes: Some(1024),
            parameter_count: Some(1000),
        };

        let serialized = serde_json::to_string(&metadata).expect("Unicode serialization failed");
        let deserialized: AdapterMetadata = serde_json::from_str(&serialized).expect("Unicode deserialization failed");

        assert_eq!(metadata.name, deserialized.name);
        assert_eq!(metadata.description, deserialized.description);
        assert_eq!(metadata.author, deserialized.author);
        assert_eq!(metadata.tags, deserialized.tags);
    }

    #[tokio::test]
    async fn test_extreme_timeout_values() {
        // Test very small timeout
        let request_small = AdapterExecutionRequest {
            adapter_id: "test".to_string(),
            action: "test".to_string(),
            params: HashMap::new(),
            timeout: Some(0), // 0 seconds
        };
        assert_eq!(request_small.timeout, Some(0));

        // Test very large timeout
        let request_large = AdapterExecutionRequest {
            adapter_id: "test".to_string(),
            action: "test".to_string(),
            params: HashMap::new(),
            timeout: Some(u64::MAX), // Maximum possible timeout
        };
        assert_eq!(request_large.timeout, Some(u64::MAX));

        // Test no timeout
        let request_none = AdapterExecutionRequest {
            adapter_id: "test".to_string(),
            action: "test".to_string(),
            params: HashMap::new(),
            timeout: None,
        };
        assert_eq!(request_none.timeout, None);
    }

    // ================================
    // 性能测试
    // ================================

    #[tokio::test]
    async fn test_large_response_handling() {
        // Create a large paginated response
        let large_items: Vec<serde_json::Value> = (0..10000)
            .map(|i| json!({
                "id": format!("item_{}", i),
                "name": format!("Item {}", i),
                "data": "x".repeat(100) // 100 chars per item
            }))
            .collect();

        let response = PaginatedResponse::new(large_items, 10000, 1, 10000);

        assert_eq!(response.items.len(), 10000);
        assert_eq!(response.total, 10000);
        assert_eq!(response.page, 1);
        assert_eq!(response.total_pages, 1);
        assert!(!response.has_next);
        assert!(!response.has_prev);

        // Test serialization performance
        let _serialized = serde_json::to_string(&response).expect("Large response serialization failed");
    }

    #[test]
    fn test_adapter_capability_with_many_params() {
        let capability = AdapterCapability {
            name: "complex_capability".to_string(),
            description: "A capability with many parameters".to_string(),
            level: CapabilityLevel::Expert,
            required_params: (0..100).map(|i| format!("required_param_{}", i)).collect(),
            optional_params: (0..200).map(|i| format!("optional_param_{}", i)).collect(),
        };

        assert_eq!(capability.required_params.len(), 100);
        assert_eq!(capability.optional_params.len(), 200);

        let serialized = serde_json::to_string(&capability).expect("Complex capability serialization failed");
        let deserialized: AdapterCapability = serde_json::from_str(&serialized).expect("Complex capability deserialization failed");

        assert_eq!(capability.required_params.len(), deserialized.required_params.len());
        assert_eq!(capability.optional_params.len(), deserialized.optional_params.len());
    }

    // ================================
    // 命令元数据测试
    // ================================

    #[test]
    fn test_get_command_metadata() {
        let metadata = get_command_metadata();
        
        // Test that metadata contains expected commands
        assert!(metadata.contains_key("get_adapters"));
        assert!(metadata.contains_key("install_adapter"));
        assert!(metadata.contains_key("uninstall_adapter"));
        assert!(metadata.contains_key("execute_adapter"));
        assert!(metadata.contains_key("get_adapter_config"));
        assert!(metadata.contains_key("update_adapter_config"));
        assert!(metadata.contains_key("search_adapters"));
        assert!(metadata.contains_key("get_adapter_details"));

        // Test metadata structure
        if let Some(get_adapters_meta) = metadata.get("get_adapters") {
            assert_eq!(get_adapters_meta.name, "get_adapters");
            assert_eq!(get_adapters_meta.category, "adapter");
            assert!(get_adapters_meta.is_async);
            assert_eq!(get_adapters_meta.required_permission, PermissionLevel::Public);
        }

        if let Some(install_adapter_meta) = metadata.get("install_adapter") {
            assert_eq!(install_adapter_meta.name, "install_adapter");
            assert_eq!(install_adapter_meta.category, "adapter");
            assert!(install_adapter_meta.is_async);
            assert_eq!(install_adapter_meta.required_permission, PermissionLevel::User);
        }
    }

    #[test]
    fn test_all_command_metadata_completeness() {
        let metadata = get_command_metadata();
        
        for (command_name, meta) in metadata.iter() {
            // Verify all metadata fields are properly set
            assert!(!meta.name.is_empty(), "Command {} has empty name", command_name);
            assert!(!meta.description.is_empty(), "Command {} has empty description", command_name);
            assert!(!meta.category.is_empty(), "Command {} has empty category", command_name);
            assert_eq!(meta.name, *command_name, "Command name mismatch for {}", command_name);
            
            // Verify permission levels are valid
            match meta.required_permission {
                PermissionLevel::Public | PermissionLevel::User | PermissionLevel::Admin | PermissionLevel::System => {},
            }
        }
    }

    // ================================
    // 集成测试示例
    // ================================

    #[tokio::test]
    async fn test_adapter_workflow_simulation() {
        // Simulate a complete adapter management workflow
        
        // 1. Search for adapters
        let search_request = AdapterSearchRequest {
            query: "AI".to_string(),
            adapter_type: Some(AdapterType::Soft),
            category: None,
            tags: None,
            price_min: None,
            price_max: None,
            rating_min: Some(4.0),
            free_only: Some(true),
            featured_only: None,
            page: Some(1),
            page_size: Some(10),
            sort_by: Some("rating".to_string()),
            sort_order: Some("desc".to_string()),
        };
        
        // 2. Install adapter
        let mut install_options = HashMap::new();
        install_options.insert("auto_start".to_string(), json!(true));
        
        let install_request = AdapterInstallRequest {
            adapter_id: "ai_assistant".to_string(),
            source: "market".to_string(),
            force: false,
            options: install_options,
        };
        
        // 3. Configure adapter
        let mut config_update = HashMap::new();
        config_update.insert("temperature".to_string(), json!(0.8));
        config_update.insert("max_tokens".to_string(), json!(2048));
        
        let config_request = AdapterConfigUpdateRequest {
            adapter_id: "ai_assistant".to_string(),
            config: config_update,
            merge: true,
        };
        
        // 4. Execute adapter
        let mut execution_params = HashMap::new();
        execution_params.insert("input".to_string(), json!("Hello world"));
        
        let execution_request = AdapterExecutionRequest {
            adapter_id: "ai_assistant".to_string(),
            action: "generate".to_string(),
            params: execution_params,
            timeout: Some(30),
        };
        
        // Verify all requests are properly structured
        assert_eq!(search_request.query, "AI");
        assert_eq!(install_request.adapter_id, "ai_assistant");
        assert_eq!(config_request.adapter_id, "ai_assistant");
        assert_eq!(execution_request.adapter_id, "ai_assistant");
        assert_eq!(execution_request.action, "generate");
    }
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
