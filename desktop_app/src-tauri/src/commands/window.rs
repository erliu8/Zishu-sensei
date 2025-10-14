//! Window management commands
//!
//! This module provides commands for managing application windows including:
//! - Show/hide windows
//! - Minimize to tray
//! - Window positioning and sizing
//! - Always-on-top toggle

use tauri::{AppHandle, Manager, State, Window, Position, Size, PhysicalPosition, PhysicalSize};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};

use crate::{
    commands::*,
    state::AppState,
    utils::*,
};

// ================================
// Request Types
// ================================

/// Window position request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetWindowPositionRequest {
    pub x: i32,
    pub y: i32,
}

/// Window size request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetWindowSizeRequest {
    pub width: u32,
    pub height: u32,
}

/// Window info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub label: String,
    pub is_visible: bool,
    pub is_focused: bool,
    pub is_maximized: bool,
    pub is_minimized: bool,
    pub is_fullscreen: bool,
    pub position: Option<(i32, i32)>,
    pub size: Option<(u32, u32)>,
    pub always_on_top: bool,
}

// ================================
// Command Handlers
// ================================

/// Minimize window to system tray
#[tauri::command]
pub async fn minimize_to_tray(
    window: Window,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("最小化窗口到系统托盘: {}", window.label());
    
    // Check if minimize to tray is enabled
    let minimize_to_tray_enabled = state.config.lock().system.minimize_to_tray;
    
    if minimize_to_tray_enabled {
        if let Err(e) = window.hide() {
            error!("隐藏窗口失败: {}", e);
            return Ok(CommandResponse::error(format!("隐藏窗口失败: {}", e)));
        }
        
        info!("窗口已最小化到托盘");
        Ok(CommandResponse::success_with_message(
            true,
            "窗口已最小化到托盘".to_string(),
        ))
    } else {
        warn!("托盘最小化功能未启用");
        Ok(CommandResponse::error("托盘最小化功能未启用".to_string()))
    }
}

/// Show window
#[tauri::command]
pub async fn show_window(
    window: Window,
) -> Result<CommandResponse<bool>, String> {
    info!("显示窗口: {}", window.label());
    
    if let Err(e) = window.show() {
        error!("显示窗口失败: {}", e);
        return Ok(CommandResponse::error(format!("显示窗口失败: {}", e)));
    }
    
    if let Err(e) = window.set_focus() {
        warn!("设置窗口焦点失败: {}", e);
    }
    
    info!("窗口已显示");
    Ok(CommandResponse::success_with_message(
        true,
        "窗口已显示".to_string(),
    ))
}

/// Hide window
#[tauri::command]
pub async fn hide_window(
    window: Window,
) -> Result<CommandResponse<bool>, String> {
    info!("隐藏窗口: {}", window.label());
    
    if let Err(e) = window.hide() {
        error!("隐藏窗口失败: {}", e);
        return Ok(CommandResponse::error(format!("隐藏窗口失败: {}", e)));
    }
    
    info!("窗口已隐藏");
    Ok(CommandResponse::success_with_message(
        true,
        "窗口已隐藏".to_string(),
    ))
}

/// Set window position
#[tauri::command]
pub async fn set_window_position(
    request: SetWindowPositionRequest,
    window: Window,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<(i32, i32)>, String> {
    info!("设置窗口位置: ({}, {})", request.x, request.y);
    
    let position = PhysicalPosition::new(request.x, request.y);
    
    if let Err(e) = window.set_position(Position::Physical(position)) {
        error!("设置窗口位置失败: {}", e);
        return Ok(CommandResponse::error(format!("设置窗口位置失败: {}", e)));
    }
    
    // Update config for main window
    if window.label() == "main" {
        let mut config = state.config.lock().clone();
        config.window.position = Some((request.x, request.y));
        *state.config.lock() = config.clone();
        
        // Save config
        if let Err(e) = save_config(&app_handle, &config).await {
            warn!("保存窗口位置失败: {}", e);
        }
    }
    
    info!("窗口位置已更新");
    Ok(CommandResponse::success_with_message(
        (request.x, request.y),
        "窗口位置已更新".to_string(),
    ))
}

/// Set window size
#[tauri::command]
pub async fn set_window_size(
    request: SetWindowSizeRequest,
    window: Window,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<(u32, u32)>, String> {
    info!("设置窗口大小: {}x{}", request.width, request.height);
    
    let size = PhysicalSize::new(request.width, request.height);
    
    if let Err(e) = window.set_size(Size::Physical(size)) {
        error!("设置窗口大小失败: {}", e);
        return Ok(CommandResponse::error(format!("设置窗口大小失败: {}", e)));
    }
    
    // Update config for main window
    if window.label() == "main" {
        let mut config = state.config.lock().clone();
        config.window.width = request.width as f64;
        config.window.height = request.height as f64;
        *state.config.lock() = config.clone();
        
        // Save config
        if let Err(e) = save_config(&app_handle, &config).await {
            warn!("保存窗口大小失败: {}", e);
        }
    }
    
    info!("窗口大小已更新");
    Ok(CommandResponse::success_with_message(
        (request.width, request.height),
        "窗口大小已更新".to_string(),
    ))
}

/// Toggle always on top
#[tauri::command]
pub async fn toggle_always_on_top(
    window: Window,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("切换窗口置顶状态");
    
    // Get current state
    let current_state = state.config.lock().window.always_on_top;
    let new_state = !current_state;
    
    if let Err(e) = window.set_always_on_top(new_state) {
        error!("设置窗口置顶失败: {}", e);
        return Ok(CommandResponse::error(format!("设置窗口置顶失败: {}", e)));
    }
    
    // Update config for main window
    if window.label() == "main" {
        let mut config = state.config.lock().clone();
        config.window.always_on_top = new_state;
        *state.config.lock() = config.clone();
        
        // Save config
        if let Err(e) = save_config(&app_handle, &config).await {
            warn!("保存窗口置顶设置失败: {}", e);
        }
    }
    
    info!("窗口置顶状态已切换: {}", new_state);
    Ok(CommandResponse::success_with_message(
        new_state,
        format!("窗口置顶已{}", if new_state { "启用" } else { "禁用" }),
    ))
}

/// Get window info
#[tauri::command]
pub async fn get_window_info(
    window: Window,
) -> Result<CommandResponse<WindowInfo>, String> {
    info!("获取窗口信息: {}", window.label());
    
    let is_visible = window.is_visible().unwrap_or(false);
    let is_focused = window.is_focused().unwrap_or(false);
    let is_maximized = window.is_maximized().unwrap_or(false);
    let is_minimized = window.is_minimized().unwrap_or(false);
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    
    let position = window.outer_position().ok().map(|pos| (pos.x, pos.y));
    let size = window.outer_size().ok().map(|size| (size.width, size.height));
    
    let info = WindowInfo {
        label: window.label().to_string(),
        is_visible,
        is_focused,
        is_maximized,
        is_minimized,
        is_fullscreen,
        position,
        size,
        always_on_top: false, // Note: Tauri doesn't provide a getter for this
    };
    
    Ok(CommandResponse::success(info))
}

/// Center window on screen
#[tauri::command]
pub async fn center_window(
    window: Window,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("居中窗口: {}", window.label());
    
    if let Err(e) = window.center() {
        error!("居中窗口失败: {}", e);
        return Ok(CommandResponse::error(format!("居中窗口失败: {}", e)));
    }
    
    // Update config position for main window
    if window.label() == "main" {
        if let Ok(position) = window.outer_position() {
            let mut config = state.config.lock().clone();
            config.window.position = Some((position.x, position.y));
            *state.config.lock() = config.clone();
            
            // Save config
            if let Err(e) = save_config(&app_handle, &config).await {
                warn!("保存窗口位置失败: {}", e);
            }
        }
    }
    
    info!("窗口已居中");
    Ok(CommandResponse::success_with_message(
        true,
        "窗口已居中".to_string(),
    ))
}

/// Maximize window
#[tauri::command]
pub async fn maximize_window(
    window: Window,
) -> Result<CommandResponse<bool>, String> {
    info!("最大化窗口: {}", window.label());
    
    if let Err(e) = window.maximize() {
        error!("最大化窗口失败: {}", e);
        return Ok(CommandResponse::error(format!("最大化窗口失败: {}", e)));
    }
    
    info!("窗口已最大化");
    Ok(CommandResponse::success_with_message(
        true,
        "窗口已最大化".to_string(),
    ))
}

/// Unmaximize window
#[tauri::command]
pub async fn unmaximize_window(
    window: Window,
) -> Result<CommandResponse<bool>, String> {
    info!("取消最大化窗口: {}", window.label());
    
    if let Err(e) = window.unmaximize() {
        error!("取消最大化窗口失败: {}", e);
        return Ok(CommandResponse::error(format!("取消最大化窗口失败: {}", e)));
    }
    
    info!("窗口已取消最大化");
    Ok(CommandResponse::success_with_message(
        true,
        "窗口已取消最大化".to_string(),
    ))
}

/// Close window
#[tauri::command]
pub async fn close_window(
    label: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("关闭窗口: {}", label);
    
    if let Some(window) = app_handle.get_window(&label) {
        if let Err(e) = window.close() {
            error!("关闭窗口失败: {}", e);
            return Ok(CommandResponse::error(format!("关闭窗口失败: {}", e)));
        }
        
        info!("窗口已关闭");
        Ok(CommandResponse::success_with_message(
            true,
            format!("窗口 {} 已关闭", label),
        ))
    } else {
        warn!("窗口不存在: {}", label);
        Ok(CommandResponse::error(format!("窗口不存在: {}", label)))
    }
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert(
        "minimize_to_tray".to_string(),
        CommandMetadata {
            name: "minimize_to_tray".to_string(),
            description: "最小化窗口到系统托盘".to_string(),
            input_type: None,
            output_type: Some("bool".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "window".to_string(),
        },
    );
    
    metadata.insert(
        "show_window".to_string(),
        CommandMetadata {
            name: "show_window".to_string(),
            description: "显示窗口".to_string(),
            input_type: None,
            output_type: Some("bool".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "window".to_string(),
        },
    );
    
    metadata.insert(
        "toggle_always_on_top".to_string(),
        CommandMetadata {
            name: "toggle_always_on_top".to_string(),
            description: "切换窗口置顶状态".to_string(),
            input_type: None,
            output_type: Some("bool".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "window".to_string(),
        },
    );
    
    metadata
}
