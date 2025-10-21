//! Desktop interaction commands
//!
//! This module provides commands for desktop-related operations

use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, State};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use crate::{
    commands::*,
    state::AppState,
};

// ================================
// Data Types
// ================================

/// Display orientation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DisplayOrientation {
    Portrait,
    Landscape,
    Square,
}

/// Monitor information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    /// Monitor name (e.g., "\\\\.\DISPLAY1" on Windows)
    pub name: Option<String>,
    /// Physical size in pixels
    pub size: MonitorSize,
    /// Position of the monitor in the virtual screen
    pub position: MonitorPosition,
    /// DPI scale factor (1.0 = 100%, 1.5 = 150%, 2.0 = 200%, etc.)
    pub scale_factor: f64,
    /// Display orientation
    pub orientation: DisplayOrientation,
    /// Is this the primary monitor?
    pub is_primary: bool,
}

/// Monitor size information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorSize {
    /// Width in physical pixels
    pub width: u32,
    /// Height in physical pixels
    pub height: u32,
    /// Logical width (physical width / scale_factor)
    pub logical_width: f64,
    /// Logical height (physical height / scale_factor)
    pub logical_height: f64,
}

/// Monitor position information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorPosition {
    /// X coordinate in physical pixels
    pub x: i32,
    /// Y coordinate in physical pixels
    pub y: i32,
    /// Logical X coordinate
    pub logical_x: f64,
    /// Logical Y coordinate
    pub logical_y: f64,
}

/// Comprehensive desktop information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopInfo {
    /// Primary monitor information
    pub primary_monitor: MonitorInfo,
    /// All available monitors
    pub monitors: Vec<MonitorInfo>,
    /// Total virtual screen size (spanning all monitors)
    pub virtual_screen: VirtualScreen,
    /// Total number of monitors
    pub monitor_count: usize,
    
    // Legacy fields (for backward compatibility)
    /// Screen width (primary monitor)
    pub screen_width: u32,
    /// Screen height (primary monitor)
    pub screen_height: u32,
    /// Scale factor (primary monitor)
    pub scale_factor: f64,
}

/// Virtual screen information (multi-monitor setup)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualScreen {
    /// Total width spanning all monitors
    pub total_width: u32,
    /// Total height spanning all monitors
    pub total_height: u32,
    /// Leftmost X coordinate
    pub min_x: i32,
    /// Topmost Y coordinate
    pub min_y: i32,
    /// Rightmost X coordinate
    pub max_x: i32,
    /// Bottommost Y coordinate
    pub max_y: i32,
}

// ================================
// Helper Functions
// ================================

/// Determine display orientation based on dimensions
fn determine_orientation(width: u32, height: u32) -> DisplayOrientation {
    if width > height {
        DisplayOrientation::Landscape
    } else if height > width {
        DisplayOrientation::Portrait
    } else {
        DisplayOrientation::Square
    }
}

/// Convert Tauri Monitor to MonitorInfo
fn convert_monitor(monitor: &Monitor, is_primary: bool) -> Result<MonitorInfo, String> {
    let size = monitor.size();
    let position = monitor.position();
    let scale_factor = monitor.scale_factor();
    
    let width = size.width;
    let height = size.height;
    
    let orientation = determine_orientation(width, height);
    
    Ok(MonitorInfo {
        name: monitor.name().map(|s| s.to_string()),
        size: MonitorSize {
            width,
            height,
            logical_width: width as f64 / scale_factor,
            logical_height: height as f64 / scale_factor,
        },
        position: MonitorPosition {
            x: position.x,
            y: position.y,
            logical_x: position.x as f64 / scale_factor,
            logical_y: position.y as f64 / scale_factor,
        },
        scale_factor,
        orientation,
        is_primary,
    })
}

/// Calculate virtual screen bounds
fn calculate_virtual_screen(monitors: &[MonitorInfo]) -> VirtualScreen {
    if monitors.is_empty() {
        return VirtualScreen {
            total_width: 0,
            total_height: 0,
            min_x: 0,
            min_y: 0,
            max_x: 0,
            max_y: 0,
        };
    }
    
    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;
    
    for monitor in monitors {
        let x = monitor.position.x;
        let y = monitor.position.y;
        let right = x + monitor.size.width as i32;
        let bottom = y + monitor.size.height as i32;
        
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(right);
        max_y = max_y.max(bottom);
    }
    
    VirtualScreen {
        total_width: (max_x - min_x) as u32,
        total_height: (max_y - min_y) as u32,
        min_x,
        min_y,
        max_x,
        max_y,
    }
}

// ================================
// Command Handlers
// ================================

/// Get desktop information
///
/// This command retrieves comprehensive information about all connected displays,
/// including their dimensions, positions, scale factors, and orientations.
#[tauri::command]
pub async fn get_desktop_info(app_handle: AppHandle) -> Result<CommandResponse<DesktopInfo>, String> {
    info!("获取桌面信息");
    
    // Get primary monitor - use any window to access monitor info
    let window = app_handle.get_window("main")
        .ok_or_else(|| {
            error!("未找到主窗口");
            "未找到主窗口".to_string()
        })?;
    
    let primary_monitor = window
        .primary_monitor()
        .map_err(|e| {
            error!("获取主显示器失败: {}", e);
            format!("获取主显示器失败: {}", e)
        })?
        .ok_or_else(|| {
            error!("未找到主显示器");
            "未找到主显示器".to_string()
        })?;
    
    // Get all available monitors
    let all_monitors = window
        .available_monitors()
        .map_err(|e| {
            error!("获取显示器列表失败: {}", e);
            format!("获取显示器列表失败: {}", e)
        })?;
    
    if all_monitors.is_empty() {
        error!("未检测到任何显示器");
        return Err("未检测到任何显示器".to_string());
    }
    
    info!("检测到 {} 个显示器", all_monitors.len());
    
    // Convert primary monitor
    let primary_info = convert_monitor(&primary_monitor, true)?;
    
    // Convert all monitors
    let mut monitors_info: Vec<MonitorInfo> = Vec::with_capacity(all_monitors.len());
    
    for monitor in all_monitors.iter() {
        // Check if this is the primary monitor by comparing properties
        let is_primary = monitor.name() == primary_monitor.name() 
            && monitor.position() == primary_monitor.position()
            && monitor.size() == primary_monitor.size();
        
        match convert_monitor(monitor, is_primary) {
            Ok(info) => {
                info!(
                    "显示器: {} - {}x{} @ {}x, 缩放: {}x, 方向: {:?}, 主显示器: {}",
                    info.name.as_deref().unwrap_or("未知"),
                    info.size.width,
                    info.size.height,
                    info.position.x,
                    info.scale_factor,
                    info.orientation,
                    info.is_primary
                );
                monitors_info.push(info);
            }
            Err(e) => {
                warn!("转换显示器信息失败: {}", e);
            }
        }
    }
    
    // Calculate virtual screen
    let virtual_screen = calculate_virtual_screen(&monitors_info);
    
    info!(
        "虚拟屏幕尺寸: {}x{} (从 {},{} 到 {},{})",
        virtual_screen.total_width,
        virtual_screen.total_height,
        virtual_screen.min_x,
        virtual_screen.min_y,
        virtual_screen.max_x,
        virtual_screen.max_y
    );
    
    let desktop_info = DesktopInfo {
        // Legacy fields for backward compatibility
        screen_width: primary_info.size.width,
        screen_height: primary_info.size.height,
        scale_factor: primary_info.scale_factor,
        
        // New comprehensive fields
        primary_monitor: primary_info,
        monitors: monitors_info,
        virtual_screen,
        monitor_count: all_monitors.len(),
    };
    
    Ok(CommandResponse::success(desktop_info))
}

/// Get monitor at specific position
///
/// Returns the monitor that contains the given position, or None if not found.
#[tauri::command]
pub async fn get_monitor_at_position(
    app_handle: AppHandle,
    x: i32,
    y: i32,
) -> Result<CommandResponse<Option<MonitorInfo>>, String> {
    info!("获取位置 ({}, {}) 处的显示器信息", x, y);
    
    let window = app_handle.get_window("main")
        .ok_or_else(|| "未找到主窗口".to_string())?;
    
    let all_monitors = window
        .available_monitors()
        .map_err(|e| format!("获取显示器列表失败: {}", e))?;
    
    let primary_monitor = window
        .primary_monitor()
        .map_err(|e| format!("获取主显示器失败: {}", e))?;
    
    for monitor in all_monitors.iter() {
        let pos = monitor.position();
        let size = monitor.size();
        
        // Check if point is within monitor bounds
        if x >= pos.x
            && x < pos.x + size.width as i32
            && y >= pos.y
            && y < pos.y + size.height as i32
        {
            let is_primary = if let Some(ref primary) = primary_monitor {
                monitor.name() == primary.name() 
                    && monitor.position() == primary.position()
            } else {
                false
            };
            
            let info = convert_monitor(monitor, is_primary)?;
            info!("找到显示器: {:?}", info.name);
            return Ok(CommandResponse::success(Some(info)));
        }
    }
    
    info!("位置 ({}, {}) 不在任何显示器范围内", x, y);
    Ok(CommandResponse::success(None))
}

/// Get primary monitor information
#[tauri::command]
pub async fn get_primary_monitor(app_handle: AppHandle) -> Result<CommandResponse<MonitorInfo>, String> {
    info!("获取主显示器信息");
    
    let window = app_handle.get_window("main")
        .ok_or_else(|| "未找到主窗口".to_string())?;
    
    let primary_monitor = window
        .primary_monitor()
        .map_err(|e| format!("获取主显示器失败: {}", e))?
        .ok_or_else(|| "未找到主显示器".to_string())?;
    
    let info = convert_monitor(&primary_monitor, true)?;
    
    Ok(CommandResponse::success(info))
}

/// Get all monitors information
#[tauri::command]
pub async fn get_all_monitors(app_handle: AppHandle) -> Result<CommandResponse<Vec<MonitorInfo>>, String> {
    info!("获取所有显示器信息");
    
    let window = app_handle.get_window("main")
        .ok_or_else(|| "未找到主窗口".to_string())?;
    
    let all_monitors = window
        .available_monitors()
        .map_err(|e| format!("获取显示器列表失败: {}", e))?;
    
    let primary_monitor = window
        .primary_monitor()
        .map_err(|e| format!("获取主显示器失败: {}", e))?;
    
    let mut monitors_info: Vec<MonitorInfo> = Vec::with_capacity(all_monitors.len());
    
    for monitor in all_monitors.iter() {
        let is_primary = if let Some(ref primary) = primary_monitor {
            monitor.name() == primary.name() 
                && monitor.position() == primary.position()
                && monitor.size() == primary.size()
        } else {
            false
        };
        
        let info = convert_monitor(monitor, is_primary)?;
        monitors_info.push(info);
    }
    
    Ok(CommandResponse::success(monitors_info))
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert(
        "get_desktop_info".to_string(),
        CommandMetadata {
            name: "get_desktop_info".to_string(),
            description: "获取完整的桌面和显示器信息（包括多显示器支持）".to_string(),
            input_type: None,
            output_type: Some("DesktopInfo".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "desktop".to_string(),
        },
    );
    
    metadata.insert(
        "get_monitor_at_position".to_string(),
        CommandMetadata {
            name: "get_monitor_at_position".to_string(),
            description: "获取指定位置所在的显示器信息".to_string(),
            input_type: Some("{ x: i32, y: i32 }".to_string()),
            output_type: Some("Option<MonitorInfo>".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "desktop".to_string(),
        },
    );
    
    metadata.insert(
        "get_primary_monitor".to_string(),
        CommandMetadata {
            name: "get_primary_monitor".to_string(),
            description: "获取主显示器信息".to_string(),
            input_type: None,
            output_type: Some("MonitorInfo".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "desktop".to_string(),
        },
    );
    
    metadata.insert(
        "get_all_monitors".to_string(),
        CommandMetadata {
            name: "get_all_monitors".to_string(),
            description: "获取所有显示器信息".to_string(),
            input_type: None,
            output_type: Some("Vec<MonitorInfo>".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "desktop".to_string(),
        },
    );
    
    metadata
}
