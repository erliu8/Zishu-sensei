// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{api::shell, AppHandle, Manager, WindowBuilder, WindowUrl};
use tracing::{error, info};
use serde::{Deserialize, Serialize};

// 导入模块
mod commands;
mod events;
mod state;
mod utils;
mod adapter;
mod system_monitor;
mod database;

use commands::*;
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

// 系统托盘创建函数已移至 events::tray 模块

// 系统托盘事件处理已移至 events::tray 模块

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

// 窗口事件处理已移至 events::window 模块

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
async fn app_setup(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("开始应用初始化");
    
    // 初始化应用状态
    let app_state = AppState::new(app.clone()).await?;
    app.manage(app_state);
    
    // 初始化数据库
    database::init_database(app.clone()).await?;
    
    // 加载配置
    let config = load_config(app).await.unwrap_or_default();
    
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
    start_background_tasks(app.clone()).await?;
    
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
            if let Some(app_state) = app_handle_clone.try_state::<AppState>() {
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
    let system_tray = events::tray::create_system_tray();
    
    // 构建 Tauri 应用
    let app_result = tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(events::tray::handle_system_tray_event)
        .on_window_event(events::window::handle_window_event)
        .setup(|app| {
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = app_setup(&app_handle).await {
                    error!("应用初始化失败: {}", e);
                    std::process::exit(1);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 聊天命令
            commands::chat::send_message,
            commands::chat::get_chat_history,
            commands::chat::clear_chat_history,
            commands::chat::set_chat_model,
            
            // 设置命令
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::update_partial_settings,
            commands::settings::reset_settings,
            commands::settings::export_settings,
            commands::settings::import_settings,
            commands::settings::get_window_config,
            commands::settings::update_window_config,
            commands::settings::get_character_config,
            commands::settings::update_character_config,
            commands::settings::get_theme_config,
            commands::settings::update_theme_config,
            commands::settings::get_system_config,
            commands::settings::update_system_config,
            commands::settings::get_config_paths,
            commands::settings::get_config_info,
            commands::settings::get_backup_files,
            commands::settings::clean_old_backups,
            commands::settings::create_config_snapshot,
            commands::settings::restore_from_snapshot,
            commands::settings::compare_configs,
            
            // 角色命令
            commands::character::get_characters,
            commands::character::get_character_info,
            commands::character::switch_character,
            commands::character::play_motion,
            commands::character::set_expression,
            commands::character::get_current_character,
            commands::character::toggle_character_interaction,
            commands::character::set_character_scale,
            
            // 窗口命令
            commands::window::minimize_to_tray,
            commands::window::show_window,
            commands::window::hide_window,
            commands::window::set_window_position,
            commands::window::set_window_size,
            commands::window::toggle_always_on_top,
            commands::window::get_window_info,
            commands::window::center_window,
            commands::window::maximize_window,
            commands::window::unmaximize_window,
            commands::window::close_window,
            
            // 系统命令
            commands::system::get_system_info,
            commands::system::get_app_version,
            commands::system::check_for_updates,
            commands::system::restart_app,
            commands::system::quit_app,
            commands::system::show_in_folder,
            commands::system::open_url,
            commands::system::get_app_data_path,
            commands::system::get_app_log_path,
            commands::system::set_auto_start,
            commands::system::copy_to_clipboard,
            commands::system::read_from_clipboard,
            
            // 适配器命令
            commands::adapter::get_adapters,
            commands::adapter::install_adapter,
            commands::adapter::uninstall_adapter,
            commands::adapter::execute_adapter,
            commands::adapter::get_adapter_config,
            commands::adapter::update_adapter_config,
            
            // 桌面命令
            commands::desktop::get_desktop_info,
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
