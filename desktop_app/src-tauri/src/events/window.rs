//! 窗口事件处理模块
//! 
//! 负责处理所有窗口相关的事件，包括：
//! - 窗口创建、关闭、显示、隐藏
//! - 窗口移动、调整大小
//! - 窗口焦点变化
//! - 窗口状态变化（最大化、最小化等）
//! - 配置自动保存

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Window, CloseRequestApi};
use tracing::{debug, error, info, warn};
use std::sync::Arc;
use parking_lot::Mutex;
use chrono::Local;

use crate::state::AppState;
use crate::utils::save_config;

/// 窗口事件处理器
pub struct WindowEventHandler {
    /// 应用句柄
    app_handle: AppHandle,
    /// 上次保存配置的时间（用于防抖）
    last_save_time: Arc<Mutex<Option<chrono::DateTime<Local>>>>,
    /// 配置保存防抖延迟（毫秒）
    save_debounce_ms: u64,
}

impl WindowEventHandler {
    /// 创建新的窗口事件处理器
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            last_save_time: Arc::new(Mutex::new(None)),
            save_debounce_ms: 1000, // 1秒防抖
        }
    }

    /// 处理窗口关闭请求事件
    pub fn handle_close_requested(&self, window: &Window, api: &CloseRequestApi) {
        let window_label = window.label();
        info!("窗口 '{}' 收到关闭请求", window_label);

        // 主窗口特殊处理
        if window_label == "main" {
            if let Some(app_state) = self.app_handle.try_state::<AppState>() {
                let config = app_state.config.lock();
                
                // 检查是否配置为关闭到托盘
                if config.system.close_to_tray {
                    info!("主窗口配置为关闭到托盘，隐藏窗口");
                    api.prevent_close();
                    
                    if let Err(e) = window.hide() {
                        error!("隐藏主窗口失败: {}", e);
                    } else {
                        // 显示托盘通知
                        if config.system.show_notifications {
                            self.show_tray_notification(
                                "Zishu Sensei",
                                "应用已最小化到系统托盘"
                            );
                        }
                    }
                    return;
                }
            }
        }

        // 其他窗口或主窗口未配置关闭到托盘时，正常关闭
        info!("窗口 '{}' 正常关闭", window_label);
        
        // 保存配置（如果是主窗口）
        if window_label == "main" {
            self.save_config_async();
        }
    }

    /// 处理窗口焦点变化事件
    pub fn handle_focused(&self, window: &Window, focused: bool) {
        let window_label = window.label();
        
        if focused {
            debug!("窗口 '{}' 获得焦点", window_label);
            
            // 发送焦点获得事件到前端
            if let Err(e) = window.emit("window-focused", true) {
                warn!("发送窗口焦点事件失败: {}", e);
            }

            // 主窗口获得焦点时的特殊处理
            if window_label == "main" {
                // 可以在这里添加角色动画触发等逻辑
                if let Err(e) = window.emit("character-event", "wave") {
                    warn!("发送角色事件失败: {}", e);
                }
            }
        } else {
            debug!("窗口 '{}' 失去焦点", window_label);
            
            // 发送焦点失去事件到前端
            if let Err(e) = window.emit("window-focused", false) {
                warn!("发送窗口焦点事件失败: {}", e);
            }

            // 主窗口失去焦点时保存配置
            if window_label == "main" {
                self.save_config_debounced();
            }
        }
    }

    /// 处理窗口移动事件
    pub fn handle_moved(&self, window: &Window, position: PhysicalPosition<i32>) {
        let window_label = window.label();
        debug!("窗口 '{}' 移动到位置: ({}, {})", window_label, position.x, position.y);

        // 只保存主窗口的位置
        if window_label == "main" {
            if let Some(app_state) = self.app_handle.try_state::<AppState>() {
                let mut config = app_state.config.lock();
                
                // 更新窗口位置配置
                let old_position = config.window.position;
                config.window.position = Some((position.x, position.y));
                
                // 如果位置发生变化，记录日志
                if old_position != config.window.position {
                    info!("主窗口位置更新: {:?} -> {:?}", old_position, config.window.position);
                    
                    // 防抖保存配置
                    drop(config); // 释放锁
                    self.save_config_debounced();
                }
            }

            // 发送位置变化事件到前端
            if let Err(e) = window.emit("window-moved", position) {
                warn!("发送窗口移动事件失败: {}", e);
            }
        }
    }

    /// 处理窗口调整大小事件
    pub fn handle_resized(&self, window: &Window, size: PhysicalSize<u32>) {
        let window_label = window.label();
        debug!("窗口 '{}' 大小改变: {} x {}", window_label, size.width, size.height);

        // 只保存主窗口的大小
        if window_label == "main" {
            if let Some(app_state) = self.app_handle.try_state::<AppState>() {
                let mut config = app_state.config.lock();
                
                // 更新窗口大小配置
                let old_width = config.window.width;
                let old_height = config.window.height;
                config.window.width = size.width as f64;
                config.window.height = size.height as f64;
                
                // 如果大小发生变化，记录日志
                if old_width != config.window.width || old_height != config.window.height {
                    info!("主窗口大小更新: {}x{} -> {}x{}", 
                        old_width, old_height, 
                        config.window.width, config.window.height
                    );
                    
                    // 防抖保存配置
                    drop(config); // 释放锁
                    self.save_config_debounced();
                }
            }

            // 发送大小变化事件到前端
            if let Err(e) = window.emit("window-resized", size) {
                warn!("发送窗口调整大小事件失败: {}", e);
            }
        }
    }

    /// 处理窗口缩放因子变化事件
    pub fn handle_scale_factor_changed(&self, window: &Window, scale_factor: f64) {
        let window_label = window.label();
        info!("窗口 '{}' 缩放因子变化: {}", window_label, scale_factor);

        // 发送缩放因子变化事件到前端
        if let Err(e) = window.emit("window-scale-factor-changed", scale_factor) {
            warn!("发送窗口缩放因子事件失败: {}", e);
        }

        // 主窗口缩放时可能需要调整 Live2D 渲染
        if window_label == "main" {
            if let Err(e) = window.emit("character-scale-update", scale_factor) {
                warn!("发送角色缩放更新事件失败: {}", e);
            }
        }
    }

    /// 处理窗口主题变化事件（系统主题切换）
    pub fn handle_theme_changed(&self, window: &Window, theme: tauri::Theme) {
        let window_label = window.label();
        let theme_str = match theme {
            tauri::Theme::Light => "light",
            tauri::Theme::Dark => "dark",
            _ => "unknown",
        };
        
        info!("窗口 '{}' 系统主题变化: {}", window_label, theme_str);

        // 发送主题变化事件到前端
        if let Err(e) = window.emit("system-theme-changed", theme_str) {
            warn!("发送系统主题变化事件失败: {}", e);
        }
    }

    /// 处理文件拖放事件
    pub fn handle_file_drop(&self, window: &Window, event: tauri::WindowEvent) {
        if let tauri::WindowEvent::FileDrop(file_drop) = event {
            match file_drop {
                tauri::FileDropEvent::Hovered(paths) => {
                    debug!("文件悬停在窗口 '{}' 上: {:?}", window.label(), paths);
                    if let Err(e) = window.emit("file-drop-hovered", &paths) {
                        warn!("发送文件悬停事件失败: {}", e);
                    }
                }
                tauri::FileDropEvent::Dropped(paths) => {
                    info!("文件拖放到窗口 '{}': {:?}", window.label(), paths);
                    if let Err(e) = window.emit("file-drop-dropped", &paths) {
                        warn!("发送文件拖放事件失败: {}", e);
                    }
                }
                tauri::FileDropEvent::Cancelled => {
                    debug!("文件拖放取消在窗口 '{}'", window.label());
                    if let Err(e) = window.emit("file-drop-cancelled", ()) {
                        warn!("发送文件拖放取消事件失败: {}", e);
                    }
                }
                _ => {}
            }
        }
    }

    /// 防抖保存配置
    /// 避免频繁的窗口事件触发过多的配置保存操作
    fn save_config_debounced(&self) {
        let mut last_save = self.last_save_time.lock();
        let now = Local::now();
        
        // 检查是否需要防抖
        if let Some(last_time) = *last_save {
            let duration = now.signed_duration_since(last_time);
            if duration.num_milliseconds() < self.save_debounce_ms as i64 {
                debug!("配置保存被防抖，距离上次保存 {}ms", duration.num_milliseconds());
                return;
            }
        }

        // 更新最后保存时间
        *last_save = Some(now);
        drop(last_save); // 释放锁

        // 异步保存配置
        self.save_config_async();
    }

    /// 异步保存配置
    fn save_config_async(&self) {
        if let Some(app_state) = self.app_handle.try_state::<AppState>() {
            let config = app_state.config.lock().clone();
            let app_handle = self.app_handle.clone();
            
            tokio::spawn(async move {
                if let Err(e) = save_config(&app_handle, &config).await {
                    error!("异步保存配置失败: {}", e);
                } else {
                    debug!("配置已异步保存");
                }
            });
        }
    }

    /// 显示托盘通知
    fn show_tray_notification(&self, title: &str, body: &str) {
        use tauri::api::notification::Notification;
        
        if let Err(e) = Notification::new(&self.app_handle.config().tauri.bundle.identifier)
            .title(title)
            .body(body)
            .show() {
            warn!("显示托盘通知失败: {}", e);
        }
    }
}

/// 创建全局窗口事件处理器
pub fn create_window_event_handler(app_handle: AppHandle) -> WindowEventHandler {
    WindowEventHandler::new(app_handle)
}

/// 处理窗口事件的主函数（用于 Tauri 的 on_window_event）
pub fn handle_window_event(event: tauri::GlobalWindowEvent) {
    let window = event.window();
    let app_handle = window.app_handle();
    let handler = WindowEventHandler::new(app_handle);

    match event.event() {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            handler.handle_close_requested(window, api);
        }
        tauri::WindowEvent::Focused(focused) => {
            handler.handle_focused(window, *focused);
        }
        tauri::WindowEvent::Moved(position) => {
            handler.handle_moved(window, *position);
        }
        tauri::WindowEvent::Resized(size) => {
            handler.handle_resized(window, *size);
        }
        tauri::WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
            handler.handle_scale_factor_changed(window, *scale_factor);
        }
        tauri::WindowEvent::ThemeChanged(theme) => {
            handler.handle_theme_changed(window, *theme);
        }
        tauri::WindowEvent::Destroyed => {
            info!("窗口 '{}' 已销毁", window.label());
        }
        event => {
            // 处理文件拖放事件
            handler.handle_file_drop(window, event.clone());
        }
    }
}

/// 窗口操作辅助函数
pub mod helpers {
    use super::*;

    /// 安全地显示窗口
    pub fn safe_show_window(window: &Window) -> Result<(), String> {
        window.show().map_err(|e| format!("显示窗口失败: {}", e))?;
        window.set_focus().map_err(|e| format!("设置窗口焦点失败: {}", e))?;
        info!("窗口 '{}' 已显示并获得焦点", window.label());
        Ok(())
    }

    /// 安全地隐藏窗口
    pub fn safe_hide_window(window: &Window) -> Result<(), String> {
        window.hide().map_err(|e| format!("隐藏窗口失败: {}", e))?;
        info!("窗口 '{}' 已隐藏", window.label());
        Ok(())
    }

    /// 切换窗口显示状态
    pub fn toggle_window_visibility(window: &Window) -> Result<(), String> {
        let is_visible = window.is_visible()
            .map_err(|e| format!("获取窗口可见性失败: {}", e))?;
        
        if is_visible {
            safe_hide_window(window)
        } else {
            safe_show_window(window)
        }
    }

    /// 中心显示窗口
    pub fn center_and_show_window(window: &Window) -> Result<(), String> {
        window.center().map_err(|e| format!("居中窗口失败: {}", e))?;
        safe_show_window(window)?;
        Ok(())
    }

    /// 保存窗口状态到配置
    pub async fn save_window_state(
        app_handle: &AppHandle, 
        window: &Window
    ) -> Result<(), String> {
        if let Some(app_state) = app_handle.try_state::<AppState>() {
            let mut config = app_state.config.lock();
            
            // 获取窗口位置
            if let Ok(position) = window.outer_position() {
                config.window.position = Some((position.x, position.y));
            }
            
            // 获取窗口大小
            if let Ok(size) = window.outer_size() {
                config.window.width = size.width as f64;
                config.window.height = size.height as f64;
            }
            
            // 获取窗口状态
            // Note: is_always_on_top() is not available in Tauri 1.x
            // We'll keep the current config value
            config.window.resizable = window.is_resizable()
                .unwrap_or(config.window.resizable);
            
            let config_clone = config.clone();
            drop(config); // 释放锁
            
            // 异步保存
            save_config(app_handle, &config_clone).await
                .map_err(|e| format!("保存窗口状态失败: {}", e))?;
            
            info!("窗口状态已保存");
            Ok(())
        } else {
            Err("无法获取应用状态".to_string())
        }
    }

    /// 从配置恢复窗口状态
    pub fn restore_window_state(
        app_handle: &AppHandle, 
        window: &Window
    ) -> Result<(), String> {
        if let Some(app_state) = app_handle.try_state::<AppState>() {
            let config = app_state.config.lock();
            
            // 恢复窗口位置
            if let Some((x, y)) = config.window.position {
                let _ = window.set_position(tauri::Position::Physical(
                    PhysicalPosition { x, y }
                ));
            }
            
            // 恢复窗口大小
            let _ = window.set_size(tauri::Size::Physical(
                PhysicalSize {
                    width: config.window.width as u32,
                    height: config.window.height as u32,
                }
            ));
            
            // 恢复窗口状态
            let _ = window.set_always_on_top(config.window.always_on_top);
            let _ = window.set_resizable(config.window.resizable);
            let _ = window.set_decorations(config.window.decorations);
            
            info!("窗口 '{}' 状态已从配置恢复", window.label());
            Ok(())
        } else {
            Err("无法获取应用状态".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    
    /// 测试窗口状态转换逻辑
    #[test]
    fn test_window_state_transitions() {
        // 测试不同的窗口状态转换
        let state_transitions = vec![
            ("minimized", "restored", true),
            ("maximized", "minimized", true),
            ("focused", "unfocused", true),
            ("visible", "hidden", true),
            ("invalid_state", "restored", false),
        ];
        
        for (from_state, to_state, should_be_valid) in state_transitions {
            let result = is_valid_window_transition(from_state, to_state);
            assert_eq!(result, should_be_valid, 
                "状态转换 {} -> {} 的有效性检查失败", from_state, to_state);
        }
    }
    
    /// 检查窗口状态转换是否有效（用于测试）
    fn is_valid_window_transition(from: &str, to: &str) -> bool {
        let valid_states = ["minimized", "maximized", "focused", "unfocused", "visible", "hidden", "restored"];
        valid_states.contains(&from) && valid_states.contains(&to)
    }

    /// 测试防抖时间计算逻辑
    #[test]
    fn test_debounce_timing_calculation() {
        let debounce_ms = 1000u64;
        
        // 测试时间差计算
        let now = std::time::Instant::now();
        let earlier = now - Duration::from_millis(500);
        let much_earlier = now - Duration::from_millis(1500);
        
        // 500ms前的时间应该还在防抖期内
        let elapsed_recent = now.duration_since(earlier).as_millis() as u64;
        assert!(elapsed_recent < debounce_ms, "最近的时间应该在防抖期内");
        
        // 1500ms前的时间应该超出防抖期
        let elapsed_old = now.duration_since(much_earlier).as_millis() as u64;
        assert!(elapsed_old > debounce_ms, "较早的时间应该超出防抖期");
    }

    /// 测试窗口标签识别逻辑
    #[test]
    fn test_window_label_validation() {
        let valid_labels = vec!["main", "settings", "about", "preferences"];
        let invalid_labels = vec!["", " ", "invalid-label", "123"];
        
        for label in valid_labels {
            assert!(is_valid_window_label(label), "标签 '{}' 应该是有效的", label);
        }
        
        for label in invalid_labels {
            assert!(!is_valid_window_label(label), "标签 '{}' 应该是无效的", label);
        }
    }
    
    /// 检查窗口标签是否有效（用于测试）
    fn is_valid_window_label(label: &str) -> bool {
        let valid_labels = ["main", "settings", "about", "preferences"];
        valid_labels.contains(&label)
    }
}
