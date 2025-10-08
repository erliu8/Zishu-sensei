// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::collections::HashMap;
use parking_lot::Mutex;
use tauri::{
    api::shell,
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, SystemTraySubmenu, Window, WindowBuilder, WindowUrl,
};
use tracing::{error, info, warn};
use serde::{Deserialize, Serialize};

// 导入模块
mod commands;
mod events;
mod state;
mod utils;

use commands::*;
use events::*;
use state::*;
use utils::*;

/// 应用配置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub window: WindowConfig,
    pub character: CharacterConfig,
    pub theme: ThemeConfig,
    pub system: SystemConfig,
}

/// 窗口配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    pub width: f64,
    pub height: f64,
    pub always_on_top: bool,
    pub transparent: bool,
    pub decorations: bool,
    pub resizable: bool,
    pub position: Option<(i32, i32)>,
}

/// 角色配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterConfig {
    pub current_character: String,
    pub scale: f64,
    pub auto_idle: bool,
    pub interaction_enabled: bool,
}

/// 主题配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    pub current_theme: String,
    pub custom_css: Option<String>,
}

/// 系统配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    pub auto_start: bool,
    pub minimize_to_tray: bool,
    pub close_to_tray: bool,
    pub show_notifications: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            window: WindowConfig {
                width: 400.0,
                height: 600.0,
                always_on_top: true,
                transparent: true,
                decorations: false,
                resizable: true,
                position: None,
            },
            character: CharacterConfig {
                current_character: "shizuku".to_string(),
                scale: 1.0,
                auto_idle: true,
                interaction_enabled: true,
            },
            theme: ThemeConfig {
                current_theme: "anime".to_string(),
                custom_css: None,
            },
            system: SystemConfig {
                auto_start: false,
                minimize_to_tray: true,
                close_to_tray: true,
                show_notifications: true,
            },
        }
    }
}

/// 创建系统托盘菜单
fn create_system_tray() -> SystemTray {
    let chat_menu = CustomMenuItem::new("chat".to_string(), "💬 开始对话");
    let separator1 = SystemTrayMenuItem::Separator;
    
    // 设置子菜单
    let character_settings = CustomMenuItem::new("character_settings".to_string(), "🎭 角色设置");
    let theme_settings = CustomMenuItem::new("theme_settings".to_string(), "🎨 主题设置");
    let adapter_settings = CustomMenuItem::new("adapter_settings".to_string(), "🔧 适配器管理");
    let sound_settings = CustomMenuItem::new("sound_settings".to_string(), "🔊 声音设置");
    let system_settings = CustomMenuItem::new("system_settings".to_string(), "📱 系统设置");
    
    let settings_submenu = SystemTraySubmenu::new(
        "⚙️ 设置",
        SystemTrayMenu::new()
            .add_item(character_settings)
            .add_item(theme_settings)
            .add_item(adapter_settings)
            .add_item(sound_settings)
            .add_item(system_settings),
    );
    
    let adapter_market = CustomMenuItem::new("adapter_market".to_string(), "🔄 适配器市场");
    let workflow_editor = CustomMenuItem::new("workflow_editor".to_string(), "📋 工作流编辑器");
    let separator2 = SystemTrayMenuItem::Separator;
    
    let show_window = CustomMenuItem::new("show_window".to_string(), "👁️ 显示窗口");
    let hide_window = CustomMenuItem::new("hide_window".to_string(), "🙈 隐藏窗口");
    let separator3 = SystemTrayMenuItem::Separator;
    
    let about = CustomMenuItem::new("about".to_string(), "ℹ️ 关于");
    let quit = CustomMenuItem::new("quit".to_string(), "❌ 退出");

    let tray_menu = SystemTrayMenu::new()
        .add_item(chat_menu)
        .add_native_item(separator1)
        .add_submenu(settings_submenu)
        .add_item(adapter_market)
        .add_item(workflow_editor)
        .add_native_item(separator2)
        .add_item(show_window)
        .add_item(hide_window)
        .add_native_item(separator3)
        .add_item(about)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

/// 处理系统托盘事件
fn handle_system_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick {
            position: _,
            size: _,
            ..
        } => {
            info!("系统托盘左键点击");
            // 切换主窗口显示/隐藏
            if let Some(window) = app.get_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        SystemTrayEvent::RightClick {
            position: _,
            size: _,
            ..
        } => {
            info!("系统托盘右键点击");
            // 右键点击会自动显示菜单
        }
        SystemTrayEvent::DoubleClick {
            position: _,
            size: _,
            ..
        } => {
            info!("系统托盘双击");
            // 双击打开聊天窗口
            open_chat_window(app);
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            info!("托盘菜单项点击: {}", id);
            match id.as_str() {
                "chat" => {
                    open_chat_window(app);
                }
                "character_settings" => {
                    open_settings_window(app, "character");
                }
                "theme_settings" => {
                    open_settings_window(app, "theme");
                }
                "adapter_settings" => {
                    open_settings_window(app, "adapter");
                }
                "sound_settings" => {
                    open_settings_window(app, "sound");
                }
                "system_settings" => {
                    open_settings_window(app, "system");
                }
                "adapter_market" => {
                    open_adapter_market(app);
                }
                "workflow_editor" => {
                    open_workflow_editor(app);
                }
                "show_window" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide_window" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.hide();
                    }
                }
                "about" => {
                    show_about_dialog(app);
                }
                "quit" => {
                    info!("用户请求退出应用");
                    app.exit(0);
                }
                _ => {
                    warn!("未处理的托盘菜单项: {}", id);
                }
            }
        }
    }
}

/// 打开聊天窗口
fn open_chat_window(app: &AppHandle) {
    if let Some(window) = app.get_window("chat") {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        let chat_window = WindowBuilder::new(
            app,
            "chat",
            WindowUrl::App("index.html#/chat".into())
        )
        .title("Zishu Sensei - 聊天")
        .inner_size(800.0, 600.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(false)
        .center()
        .build();

        match chat_window {
            Ok(window) => {
                info!("聊天窗口创建成功");
                let _ = window.show();
            }
            Err(e) => {
                error!("创建聊天窗口失败: {}", e);
            }
        }
    }
}

/// 打开设置窗口
fn open_settings_window(app: &AppHandle, tab: &str) {
    let window_label = "settings";
    
    if let Some(window) = app.get_window(window_label) {
        let _ = window.show();
        let _ = window.set_focus();
        // 发送事件切换到指定标签页
        let _ = window.emit("switch-settings-tab", tab);
    } else {
        let settings_window = WindowBuilder::new(
            app,
            window_label,
            WindowUrl::App(format!("index.html#/settings?tab={}", tab).into())
        )
        .title("Zishu Sensei - 设置")
        .inner_size(900.0, 700.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(false)
        .center()
        .build();

        match settings_window {
            Ok(window) => {
                info!("设置窗口创建成功");
                let _ = window.show();
            }
            Err(e) => {
                error!("创建设置窗口失败: {}", e);
            }
        }
    }
}

/// 打开适配器市场
fn open_adapter_market(app: &AppHandle) {
    let url = "https://market.zishu.dev";
    if let Err(e) = shell::open(&app.shell_scope(), url, None) {
        error!("打开适配器市场失败: {}", e);
    }
}

/// 打开工作流编辑器
fn open_workflow_editor(app: &AppHandle) {
    let window_label = "workflow";
    
    if let Some(window) = app.get_window(window_label) {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        let workflow_window = WindowBuilder::new(
            app,
            window_label,
            WindowUrl::App("index.html#/workflow".into())
        )
        .title("Zishu Sensei - 工作流编辑器")
        .inner_size(1200.0, 800.0)
        .min_inner_size(1000.0, 600.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(false)
        .center()
        .build();

        match workflow_window {
            Ok(window) => {
                info!("工作流编辑器窗口创建成功");
                let _ = window.show();
            }
            Err(e) => {
                error!("创建工作流编辑器窗口失败: {}", e);
            }
        }
    }
}

/// 显示关于对话框
fn show_about_dialog(app: &AppHandle) {
    use tauri::api::dialog;
    
    let version = app.package_info().version.to_string();
    let message = format!(
        "🐾 Zishu Sensei Desktop Pet\n\n版本: {}\n\n基于 Tauri + React + Live2D 开发的智能桌面宠物应用\n\n© 2024 Zishu Team",
        version
    );
    
    dialog::message(Some(&app.get_window("main").unwrap()), "关于 Zishu Sensei", message);
}

/// 处理窗口事件
fn handle_window_event(event: tauri::GlobalWindowEvent) {
    match event.event() {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            let window = event.window();
            let app_handle = window.app_handle();
            
            // 获取应用状态
            if let Ok(app_state) = app_handle.try_state::<AppState>() {
                let config = app_state.config.lock();
                
                // 如果配置为关闭到托盘，则隐藏窗口而不是关闭
                if config.system.close_to_tray && window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    info!("主窗口隐藏到托盘");
                    return;
                }
            }
            
            // 其他窗口正常关闭
            info!("窗口 {} 关闭", window.label());
        }
        tauri::WindowEvent::Focused(focused) => {
            if *focused {
                info!("窗口 {} 获得焦点", event.window().label());
            } else {
                info!("窗口 {} 失去焦点", event.window().label());
            }
        }
        tauri::WindowEvent::Moved(position) => {
            info!("窗口 {} 移动到位置: {:?}", event.window().label(), position);
            
            // 保存主窗口位置
            if event.window().label() == "main" {
                let app_handle = event.window().app_handle();
                if let Ok(app_state) = app_handle.try_state::<AppState>() {
                    let mut config = app_state.config.lock();
                    config.window.position = Some((position.x, position.y));
                    
                    // 异步保存配置
                    let config_clone = config.clone();
                    let app_handle_clone = app_handle.clone();
                    tokio::spawn(async move {
                        if let Err(e) = save_config(&app_handle_clone, &config_clone).await {
                            error!("保存配置失败: {}", e);
                        }
                    });
                }
            }
        }
        tauri::WindowEvent::Resized(size) => {
            info!("窗口 {} 大小改变: {}x{}", event.window().label(), size.width, size.height);
            
            // 保存主窗口大小
            if event.window().label() == "main" {
                let app_handle = event.window().app_handle();
                if let Ok(app_state) = app_handle.try_state::<AppState>() {
                    let mut config = app_state.config.lock();
                    config.window.width = size.width as f64;
                    config.window.height = size.height as f64;
                    
                    // 异步保存配置
                    let config_clone = config.clone();
                    let app_handle_clone = app_handle.clone();
                    tokio::spawn(async move {
                        if let Err(e) = save_config(&app_handle_clone, &config_clone).await {
                            error!("保存配置失败: {}", e);
                        }
                    });
                }
            }
        }
        _ => {}
    }
}

/// 初始化日志系统
fn init_logging() -> Result<(), Box<dyn std::error::Error>> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
    
    let log_dir = utils::get_app_log_dir()?;
    std::fs::create_dir_all(&log_dir)?;
    
    let file_appender = tracing_appender::rolling::daily(log_dir, "zishu-sensei.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "zishu_sensei=info".into()),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(std::io::stdout)
                .with_ansi(true)
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(non_blocking)
                .with_ansi(false)
        )
        .init();
    
    info!("日志系统初始化完成");
    Ok(())
}

/// 应用启动时的初始化
async fn app_setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("开始应用初始化");
    
    // 初始化应用状态
    let app_state = AppState::new(app.handle()).await?;
    app.manage(app_state);
    
    // 初始化数据库
    database::init_database(app.handle()).await?;
    
    // 加载配置
    let config = load_config(app.handle()).await.unwrap_or_default();
    
    // 设置主窗口属性
    if let Some(main_window) = app.get_window("main") {
        // 应用窗口配置
        let _ = main_window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: config.window.width as u32,
            height: config.window.height as u32,
        }));
        
        if let Some((x, y)) = config.window.position {
            let _ = main_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
        
        let _ = main_window.set_always_on_top(config.window.always_on_top);
        let _ = main_window.set_resizable(config.window.resizable);
        
        // 设置窗口效果
        #[cfg(target_os = "windows")]
        {
            use window_shadows::set_shadow;
            if let Err(e) = set_shadow(&main_window, true) {
                warn!("设置窗口阴影失败: {}", e);
            }
        }
        
        #[cfg(target_os = "macos")]
        {
            use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
            if let Err(e) = apply_vibrancy(&main_window, NSVisualEffectMaterial::HudWindow, None, None) {
                warn!("设置窗口毛玻璃效果失败: {}", e);
            }
        }
        
        info!("主窗口配置完成");
    }
    
    // 启动后台任务
    start_background_tasks(app.handle()).await?;
    
    info!("应用初始化完成");
    Ok(())
}

/// 启动后台任务
async fn start_background_tasks(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("启动后台任务");
    
    // 启动适配器管理器
    adapter::start_adapter_manager(app_handle.clone()).await?;
    
    // 启动系统监控
    system_monitor::start_system_monitor(app_handle.clone()).await?;
    
    // 启动自动保存任务
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5分钟
        loop {
            interval.tick().await;
            if let Ok(app_state) = app_handle_clone.try_state::<AppState>() {
                let config = app_state.config.lock().clone();
                if let Err(e) = save_config(&app_handle_clone, &config).await {
                    error!("自动保存配置失败: {}", e);
                }
            }
        }
    });
    
    info!("后台任务启动完成");
    Ok(())
}

#[tokio::main]
async fn main() {
    // 初始化日志系统
    if let Err(e) = init_logging() {
        eprintln!("初始化日志系统失败: {}", e);
        std::process::exit(1);
    }
    
    info!("🐾 Zishu Sensei 桌面宠物应用启动");
    
    // 创建系统托盘
    let system_tray = create_system_tray();
    
    // 构建 Tauri 应用
    let app_result = tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(handle_system_tray_event)
        .on_window_event(handle_window_event)
        .setup(|app| {
            // 异步初始化
            let app_handle = app.handle();
            tokio::spawn(async move {
                if let Err(e) = app_setup(&mut *app_handle.clone()).await {
                    error!("应用初始化失败: {}", e);
                    std::process::exit(1);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 聊天相关命令
            chat::send_message,
            chat::get_chat_history,
            chat::clear_chat_history,
            chat::set_chat_model,
            
            // 角色相关命令
            character::get_characters,
            character::switch_character,
            character::get_character_info,
            character::play_motion,
            character::set_expression,
            
            // 设置相关命令
            settings::get_settings,
            settings::update_settings,
            settings::reset_settings,
            settings::export_settings,
            settings::import_settings,
            
            // 适配器相关命令
            adapter::get_adapters,
            adapter::install_adapter,
            adapter::uninstall_adapter,
            adapter::execute_adapter,
            adapter::get_adapter_config,
            adapter::update_adapter_config,
            
            // 桌面操作命令
            desktop::get_desktop_info,
            desktop::execute_workflow,
            desktop::get_workflows,
            desktop::save_workflow,
            desktop::delete_workflow,
            
            // 系统相关命令
            system::get_system_info,
            system::get_app_version,
            system::check_for_updates,
            system::restart_app,
            system::show_in_folder,
            
            // 窗口管理命令
            window::minimize_to_tray,
            window::show_window,
            window::hide_window,
            window::set_window_position,
            window::set_window_size,
            window::toggle_always_on_top,
        ])
        .build(tauri::generate_context!());
    
    match app_result {
        Ok(app) => {
            info!("Tauri 应用构建成功，开始运行");
            app.run(|_app_handle, event| match event {
                tauri::RunEvent::ExitRequested { api, .. } => {
                    info!("应用退出请求");
                    api.prevent_exit();
                }
                tauri::RunEvent::Exit => {
                    info!("应用正常退出");
                }
                _ => {}
            });
        }
        Err(e) => {
            error!("构建 Tauri 应用失败: {}", e);
            std::process::exit(1);
        }
    }
}
