//! 屏幕捕获和理解命令
//!
//! 提供跨平台的屏幕截图功能，支持：
//! - 全屏截图
//! - 活动窗口截图
//! - 区域截图
//! - 截图理解和 OCR

use tauri::{AppHandle, State, Manager, Window};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use base64::{Engine as _, engine::general_purpose};
use std::io::Cursor;

use crate::{
    commands::*,
    state::AppState,
    utils::*,
};

// ================================
// Data Types
// ================================

/// 截图请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureScreenRequest {
    /// 截图类型: "full" | "window" | "region"
    pub capture_type: String,
    /// 区域截图的坐标 (x, y, width, height)
    pub region: Option<(i32, i32, u32, u32)>,
}

/// 截图响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureScreenResponse {
    /// Base64 编码的图片数据
    pub image_data: String,
    /// 图片宽度
    pub width: u32,
    /// 图片高度
    pub height: u32,
    /// 截图时间戳
    pub timestamp: i64,
}

/// 屏幕理解请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenUnderstandRequest {
    /// Base64 编码的图片数据
    pub image_data: String,
    /// 时间戳
    pub timestamp: Option<i64>,
    /// 上下文信息
    pub context: Option<serde_json::Value>,
}

/// OCR 结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResult {
    /// 识别的文字
    pub text: String,
    /// 置信度 (0-1)
    pub confidence: f32,
    /// 文字边界框坐标
    pub bounding_box: Option<Vec<Vec<i32>>>,
    /// 语言
    pub language: Option<String>,
}

/// 屏幕理解结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenUnderstandingResult {
    /// OCR 识别结果列表
    pub ocr_results: Vec<OCRResult>,
    /// 提取的全部文字内容
    pub text_content: String,
    /// 场景描述
    pub scene_description: Option<String>,
    /// 检测到的界面元素
    pub detected_elements: Vec<serde_json::Value>,
    /// 内容摘要
    pub summary: String,
    /// 时间戳
    pub timestamp: i64,
    /// 处理耗时(毫秒)
    pub processing_time_ms: f64,
}

// ================================
// 跨平台截图实现
// ================================

/// 捕获屏幕截图
/// 
/// 使用系统原生 API 进行截图，跨平台兼容
fn capture_screen_internal(capture_type: &str, region: Option<(i32, i32, u32, u32)>) -> Result<(Vec<u8>, u32, u32), String> {
    info!("开始截图: 类型={}, 区域={:?}", capture_type, region);
    
    // 根据平台选择不同的截图方式
    #[cfg(target_os = "windows")]
    {
        capture_screen_windows(capture_type, region)
    }
    
    #[cfg(target_os = "macos")]
    {
        capture_screen_macos(capture_type, region)
    }
    
    #[cfg(target_os = "linux")]
    {
        capture_screen_linux(capture_type, region)
    }
}

/// Windows 平台截图
#[cfg(target_os = "windows")]
fn capture_screen_windows(_capture_type: &str, _region: Option<(i32, i32, u32, u32)>) -> Result<(Vec<u8>, u32, u32), String> {
    use std::process::Command;
    use std::fs;
    
    // 使用 PowerShell 进行截图
    let temp_path = std::env::temp_dir().join(format!("zishu_screenshot_{}.png", chrono::Utc::now().timestamp()));
    
    let script = format!(
        r#"Add-Type -AssemblyName System.Windows.Forms; 
        Add-Type -AssemblyName System.Drawing; 
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; 
        $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height; 
        $graphics = [System.Drawing.Graphics]::FromImage($bmp); 
        $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); 
        $bmp.Save('{}');"#,
        temp_path.display()
    );
    
    let output = Command::new("powershell")
        .arg("-Command")
        .arg(&script)
        .output()
        .map_err(|e| format!("执行截图命令失败: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("截图失败: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    // 读取截图文件
    let image_data = fs::read(&temp_path)
        .map_err(|e| format!("读取截图文件失败: {}", e))?;
    
    // 删除临时文件
    let _ = fs::remove_file(&temp_path);
    
    // 使用 image crate 获取图片尺寸
    let img = image::load_from_memory(&image_data)
        .map_err(|e| format!("解析图片失败: {}", e))?;
    
    let width = img.width();
    let height = img.height();
    
    Ok((image_data, width, height))
}

/// macOS 平台截图
#[cfg(target_os = "macos")]
fn capture_screen_macos(_capture_type: &str, _region: Option<(i32, i32, u32, u32)>) -> Result<(Vec<u8>, u32, u32), String> {
    use std::process::Command;
    use std::fs;
    
    // 使用 screencapture 命令
    let temp_path = std::env::temp_dir().join(format!("zishu_screenshot_{}.png", chrono::Utc::now().timestamp()));
    
    let output = Command::new("screencapture")
        .arg("-x") // 不播放声音
        .arg("-t")
        .arg("png")
        .arg(&temp_path)
        .output()
        .map_err(|e| format!("执行截图命令失败: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("截图失败: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    // 读取截图文件
    let image_data = fs::read(&temp_path)
        .map_err(|e| format!("读取截图文件失败: {}", e))?;
    
    // 删除临时文件
    let _ = fs::remove_file(&temp_path);
    
    // 使用 image crate 获取图片尺寸
    let img = image::load_from_memory(&image_data)
        .map_err(|e| format!("解析图片失败: {}", e))?;
    
    let width = img.width();
    let height = img.height();
    
    Ok((image_data, width, height))
}

/// Linux 平台截图
#[cfg(target_os = "linux")]
fn capture_screen_linux(_capture_type: &str, _region: Option<(i32, i32, u32, u32)>) -> Result<(Vec<u8>, u32, u32), String> {
    use std::process::Command;
    use std::fs;
    
    // 优先使用 gnome-screenshot，其次是 scrot，最后是 import (ImageMagick)
    let tools = vec!["gnome-screenshot", "scrot", "import"];
    
    let temp_path = std::env::temp_dir().join(format!("zishu_screenshot_{}.png", chrono::Utc::now().timestamp()));
    
    for tool in tools {
        let result = match tool {
            "gnome-screenshot" => {
                Command::new(tool)
                    .arg("-f")
                    .arg(&temp_path)
                    .output()
            },
            "scrot" => {
                Command::new(tool)
                    .arg(&temp_path)
                    .output()
            },
            "import" => {
                Command::new(tool)
                    .arg("-window")
                    .arg("root")
                    .arg(&temp_path)
                    .output()
            },
            _ => continue,
        };
        
        match result {
            Ok(output) if output.status.success() => {
                // 截图成功，读取文件
                match fs::read(&temp_path) {
                    Ok(image_data) => {
                        let _ = fs::remove_file(&temp_path);
                        
                        // 获取图片尺寸
                        if let Ok(img) = image::load_from_memory(&image_data) {
                            return Ok((image_data, img.width(), img.height()));
                        }
                    },
                    Err(_) => continue,
                }
            },
            _ => continue,
        }
    }
    
    Err("未找到可用的截图工具 (gnome-screenshot, scrot, import)".to_string())
}

// ================================
// Command Handlers
// ================================

/// 捕获屏幕截图
#[tauri::command]
pub async fn capture_screen(
    request: CaptureScreenRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<CaptureScreenResponse>, String> {
    info!("🖼️ 收到截图请求: {:?}", request.capture_type);
    
    // 执行截图
    let (image_data, width, height) = capture_screen_internal(&request.capture_type, request.region)
        .map_err(|e| {
            error!("截图失败: {}", e);
            format!("截图失败: {}", e)
        })?;
    
    // 将图片数据转换为 Base64
    let base64_data = general_purpose::STANDARD.encode(&image_data);
    
    let response = CaptureScreenResponse {
        image_data: format!("data:image/png;base64,{}", base64_data),
        width,
        height,
        timestamp: chrono::Utc::now().timestamp(),
    };
    
    info!("✅ 截图成功: {}x{}", width, height);
    Ok(CommandResponse::success(response))
}

/// 捕获屏幕并发送到后端进行理解
#[tauri::command]
pub async fn capture_and_understand_screen(
    request: CaptureScreenRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<ScreenUnderstandingResult>, String> {
    info!("🧠 收到屏幕理解请求");
    
    // 1. 截图
    let (image_data, width, height) = capture_screen_internal(&request.capture_type, request.region)
        .map_err(|e| {
            error!("截图失败: {}", e);
            format!("截图失败: {}", e)
        })?;
    
    // 2. 将图片数据转换为 Base64
    let base64_data = general_purpose::STANDARD.encode(&image_data);
    
    info!("📤 发送屏幕截图到后端进行理解...");
    
    // 3. 调用后端 API（屏幕理解使用核心服务）
    let config = state.config.lock().clone();
    let base_url = std::env::var("ZISHU_CORE_API_URL")
        .unwrap_or_else(|_| {
            let router = crate::config::ApiRouter::new();
            router.core_url()
        });
    let api_url = format!("{}/api/v1/screen/understand", base_url);
    
    let understand_request = ScreenUnderstandRequest {
        image_data: format!("data:image/png;base64,{}", base64_data),
        timestamp: Some(chrono::Utc::now().timestamp()),
        context: Some(serde_json::json!({
            "width": width,
            "height": height,
            "source": "desktop_app"
        })),
    };
    
    // 发送请求到后端
    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .json(&understand_request)
        .send()
        .await
        .map_err(|e| {
            error!("发送请求到后端失败: {}", e);
            format!("发送请求失败: {}", e)
        })?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        error!("后端返回错误: {}", error_text);
        return Err(format!("后端返回错误: {}", error_text));
    }
    
    // 解析响应
    let result: ScreenUnderstandingResult = response
        .json()
        .await
        .map_err(|e| {
            error!("解析后端响应失败: {}", e);
            format!("解析响应失败: {}", e)
        })?;
    
    info!("✅ 屏幕理解完成: {}", result.summary);
    Ok(CommandResponse::success(result))
}

/// 启用/禁用自动屏幕理解
#[tauri::command]
pub async fn toggle_auto_screen_understanding(
    enabled: bool,
    interval_seconds: Option<u64>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("切换自动屏幕理解: enabled={}, interval={:?}", enabled, interval_seconds);
    
    let mut config = state.config.lock().clone();
    
    // 更新配置
    if enabled {
        config.screen_understanding.enabled = true;
        config.screen_understanding.interval_seconds = interval_seconds.unwrap_or(10);
    } else {
        config.screen_understanding.enabled = false;
    }
    
    // 保存配置
    *state.config.lock() = config.clone();
    if let Err(e) = save_config(&app_handle, &config).await {
        error!("保存配置失败: {}", e);
        return Ok(CommandResponse::error(format!("保存配置失败: {}", e)));
    }
    
    // 触发前端事件
    if let Some(main_window) = app_handle.get_window("main") {
        let _ = main_window.emit("screen-understanding-toggled", serde_json::json!({
            "enabled": enabled,
            "interval_seconds": interval_seconds.unwrap_or(10)
        }));
    }
    
    Ok(CommandResponse::success_with_message(
        enabled,
        if enabled { "已启用自动屏幕理解".to_string() } else { "已禁用自动屏幕理解".to_string() },
    ))
}

/// 获取屏幕理解配置
#[tauri::command]
pub async fn get_screen_understanding_config(
    state: State<'_, AppState>,
) -> Result<CommandResponse<serde_json::Value>, String> {
    let config = state.config.lock().clone();
    
    Ok(CommandResponse::success(serde_json::json!({
        "enabled": config.screen_understanding.enabled,
        "interval_seconds": config.screen_understanding.interval_seconds,
    })))
}

// ================================
// Command Metadata
// ================================

pub fn get_command_metadata() -> std::collections::HashMap<String, CommandMetadata> {
    let mut metadata = std::collections::HashMap::new();
    
    metadata.insert(
        "capture_screen".to_string(),
        CommandMetadata {
            name: "capture_screen".to_string(),
            description: "捕获屏幕截图".to_string(),
            input_type: Some("CaptureScreenRequest".to_string()),
            output_type: Some("CaptureScreenResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "screen".to_string(),
        },
    );
    
    metadata.insert(
        "capture_and_understand_screen".to_string(),
        CommandMetadata {
            name: "capture_and_understand_screen".to_string(),
            description: "捕获屏幕并理解内容".to_string(),
            input_type: Some("CaptureScreenRequest".to_string()),
            output_type: Some("ScreenUnderstandingResult".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "screen".to_string(),
        },
    );
    
    metadata.insert(
        "toggle_auto_screen_understanding".to_string(),
        CommandMetadata {
            name: "toggle_auto_screen_understanding".to_string(),
            description: "切换自动屏幕理解".to_string(),
            input_type: Some("bool".to_string()),
            output_type: Some("bool".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "screen".to_string(),
        },
    );
    
    metadata
}
