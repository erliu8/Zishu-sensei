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
mod http;
mod config;
mod live2d_protocol;

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

// 注意：app_setup 函数已经被移除，其功能已整合到 main 函数中的 setup 闭包里
// 这样可以确保在前端调用命令前，AppState 已经被正确注册

/// 启动后台任务
async fn start_background_tasks(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("启动后台任务");
    
    // 启动适配器管理器
    adapter::start_adapter_manager(app_handle.clone()).await?;
    
    // 启动系统监控
    system_monitor::start_system_monitor(app_handle.clone()).await?;
    
    // 启动自动保存任务
    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
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

fn main() {
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

            let app_state = AppState::new(app_handle.clone()).map_err(|e| e.to_string())?;
            app.manage(app_state);
            
            // 关键：使用同步通道等待异步初始化完成
            // 这样可以确保在前端调用命令前，AppState 已经被正确管理
            info!("开始初始化关键组件");
            
            // 创建一个通道用于同步等待初始化完成
            let (init_tx, init_rx) = std::sync::mpsc::channel::<Result<(), String>>();
            
            // 在异步任务中完成初始化
            let app_handle_init = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                // 初始化安全审计日志
                let app_data_dir = app_handle_init.path_resolver()
                    .app_data_dir()
                    .expect("无法获取应用数据目录");
                let audit_db_path = app_data_dir.join("security_audit.db");
                if let Err(e) = utils::security_audit::init_global_audit_logger(&audit_db_path) {
                    error!("初始化审计日志失败: {}", e);
                } else {
                    info!("安全审计日志系统已初始化");
                }
                
                // 初始化日志数据库（PostgreSQL）
                {
                    use deadpool_postgres::{Config, Runtime};
                    use tokio_postgres::NoTls;
                    
                    let mut cfg = Config::new();
                    cfg.dbname = Some("zishu_sensei".to_string());
                    cfg.host = Some("localhost".to_string());
                    cfg.user = Some("zishu".to_string());
                    cfg.password = Some("zishu123".to_string());
                    
                    match cfg.create_pool(Some(Runtime::Tokio1), NoTls) {
                        Ok(pool) => {
                            let log_db = database::logging::LogDatabase::new(pool);
                            
                            // 初始化日志表
                            if let Err(e) = log_db.init_tables().await {
                                tracing::warn!("初始化日志表失败: {}", e);
                            }
                            
                            app_handle_init.manage(log_db);
                            info!("日志数据库系统已初始化");
                        }
                        Err(e) => {
                            error!("创建数据库连接池失败: {}", e);
                        }
                    }
                }
                
                // 初始化主数据库
                if let Err(e) = database::init_database(app_handle_init.clone()).await {
                    error!("数据库初始化失败: {}", e);
                    let _ = init_tx.send(Err(format!("database init failed: {e}")));
                    return;
                }
                
/*                 // 初始化应用状态 - 这是最关键的，必须在这里完成
                 match AppState::new(app_handle_init.clone()) {
                    Ok(app_state) => {
                        app_handle_init.manage(app_state);
                        info!("✅ AppState 已成功注册到 Tauri 状态管理");
                    }
                    Err(e) => {
                        error!("❌ 初始化 AppState 失败: {}", e);
                        let _ = init_tx.send(Err(format!("AppState init failed: {e}")));
                        return;
                    }
                } */
                
                // 加载配置
                let config = load_config(&app_handle_init).await.unwrap_or_default();
                
                // 设置主窗口属性
                if let Some(main_window) = app_handle_init.get_window("main") {
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
                            tracing::warn!("设置窗口阴影失败: {}", e);
                        }
                    }
                    
                    #[cfg(target_os = "macos")]
                    {
                        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                        if let Err(e) = apply_vibrancy(&main_window, NSVisualEffectMaterial::HudWindow, None, None) {
                            tracing::warn!("设置窗口毛玻璃效果失败: {}", e);
                        }
                    }
                    
                    info!("主窗口配置完成");
                }
                
                // 发送初始化完成信号
                let _ = init_tx.send(Ok(()));
            });
            
/*             // 同步等待初始化完成（使用超时避免死锁）
            match init_rx.recv_timeout(std::time::Duration::from_secs(30)) {
                Ok(Ok(())) => {
                    info!("✅ 关键组件初始化完成，应用状态已就绪");
                }
                Ok(Err(e)) => {
                    error!("❌ 初始化失败: {}", e);
                    std::process::exit(1);
                }
                Err(_) => {
                    error!("❌ 初始化超时");
                    std::process::exit(1);
                }
            } */
            
            // 非关键的初始化任务可以异步执行
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                // 初始化语言设置
                if let Err(e) = commands::language::initialize_language_settings(&app_handle_clone).await {
                    tracing::warn!("语言设置初始化失败: {}", e);
                }
                
                // 启动后台任务
                if let Err(e) = start_background_tasks(app_handle_clone.clone()).await {
                    error!("启动后台任务失败: {}", e);
                }
                
                info!("✅ 后台任务初始化完成");
            });
            
            // 处理 deep link
            let app_handle_deeplink = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                // 检查启动参数中是否有 deep link
                let args: Vec<String> = std::env::args().collect();
                for arg in args {
                    if arg.starts_with("zishu://") {
                        info!("检测到 deep link: {}", arg);
                        if let Err(e) = commands::deeplink::handle_deep_link(arg, app_handle_deeplink.clone()).await {
                            error!("处理 deep link 失败: {}", e);
                        }
                        break;
                    }
                }
            });
            
            Ok(())
        })
        .register_uri_scheme_protocol("zishu", |app, request| {
            live2d_protocol::handle_zishu_protocol(app, request)
        })
        .invoke_handler(tauri::generate_handler![
            // 聊天命令
            commands::chat::send_message,
            commands::chat::get_chat_history,
            commands::chat::clear_chat_history,
            commands::chat::set_chat_model,
            
            // 模型配置命令
            commands::model_config::save_model_config,
            commands::model_config::get_model_config,
            commands::model_config::delete_model_config,
            commands::model_config::get_all_model_configs,
            commands::model_config::get_default_model_config,
            commands::model_config::set_default_model_config,
            commands::model_config::validate_model_config,
            commands::model_config::get_config_history,
            commands::model_config::export_model_config,
            commands::model_config::import_model_config,
            
            // 设置命令
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::update_partial_settings,
            commands::settings::reset_settings,
            commands::settings::export_settings,
            commands::settings::import_settings,
            commands::settings::get_window_config,
            commands::settings::update_window_config,
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
            commands::character::save_character_config,
            commands::character::get_character_config,

            // Live2D 资源缓存
            commands::live2d_assets::prepare_live2d_assets,
            
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
            commands::system::restart_app,
            commands::system::quit_app,
            commands::system::show_in_folder,
            commands::system::open_url,
            commands::system::get_app_data_path,
            commands::system::get_app_log_path,
            commands::system::set_auto_start,
            commands::system::is_auto_start_enabled,
            commands::system::copy_to_clipboard,
            commands::system::read_from_clipboard,
            commands::system::upload_logs,
            commands::system::check_log_rotation,
            commands::system::get_log_stats,
            commands::system::clean_old_logs,
            
            // 更新管理命令
            commands::update::init_update_manager,
            commands::update::check_for_updates,
            commands::update::download_update,
            commands::update::install_update,
            commands::update::install_update_with_tauri,
            commands::update::cancel_download,
            commands::update::rollback_to_version,
            commands::update::get_update_config,
            commands::update::save_update_config,
            commands::update::get_version_history,
            commands::update::get_update_stats,
            commands::update::cleanup_old_files,
            commands::update::restart_application,
            commands::update::listen_update_events,
            commands::update::check_tauri_updater_available,
            commands::update::get_current_version,
            
            // 适配器命令 - 后端集成
            commands::adapter::get_adapters,
            commands::adapter::install_adapter,
            commands::adapter::uninstall_adapter,
            commands::adapter::execute_adapter,
            commands::adapter::get_adapter_config,
            commands::adapter::update_adapter_config,
            commands::adapter::search_adapters,
            commands::adapter::get_adapter_details,
            commands::adapter::load_adapter,
            commands::adapter::unload_adapter,
            commands::adapter::get_adapter_status,
            
            // 适配器命令 - 本地管理
            commands::adapter::get_installed_adapters,
            commands::adapter::get_enabled_adapters,
            commands::adapter::get_installed_adapter,
            commands::adapter::toggle_adapter,
            commands::adapter::remove_installed_adapter,
            
            // 适配器命令 - 版本管理
            commands::adapter::get_adapter_versions,
            commands::adapter::add_adapter_version,
            
            // 适配器命令 - 依赖管理
            commands::adapter::get_adapter_dependencies,
            commands::adapter::add_adapter_dependency,
            commands::adapter::remove_adapter_dependency,
            
            // 适配器命令 - 权限管理
            commands::adapter::get_adapter_permissions,
            commands::adapter::grant_adapter_permission,
            commands::adapter::check_adapter_permission,
            commands::adapter::add_adapter_permission,
            
            // 市场命令
            commands::market::search_market_products,
            commands::market::get_market_product,
            commands::market::get_featured_products,
            commands::market::get_product_reviews,
            commands::market::download_market_product,
            commands::market::check_product_updates,
            commands::market::get_market_categories,
            
            // 桌面命令
            commands::desktop::get_desktop_info,
            commands::desktop::get_monitor_at_position,
            commands::desktop::get_primary_monitor,
            commands::desktop::get_all_monitors,
            
            // 快捷键命令
            commands::shortcuts::register_shortcut,
            commands::shortcuts::unregister_shortcut,
            commands::shortcuts::unregister_all_shortcuts,
            commands::shortcuts::get_registered_shortcuts,
            commands::shortcuts::get_shortcut_info,
            commands::shortcuts::update_shortcut,
            commands::shortcuts::toggle_shortcut,
            commands::shortcuts::record_shortcut_trigger,
            commands::shortcuts::get_shortcut_statistics,
            commands::shortcuts::check_shortcut_conflict,
            commands::shortcuts::validate_shortcut_config,
            
            // 工作流 API 命令（与 Python 服务通信）
            commands::workflow_api::api_create_workflow,
            commands::workflow_api::api_list_workflows,
            commands::workflow_api::api_get_workflow,
            commands::workflow_api::api_update_workflow,
            commands::workflow_api::api_delete_workflow,
            commands::workflow_api::api_execute_workflow,
            commands::workflow_api::api_list_executions,
            commands::workflow_api::api_get_execution,
            commands::workflow_api::api_cancel_execution,
            commands::workflow_api::api_publish_workflow,
            commands::workflow_api::api_archive_workflow,
            commands::workflow_api::api_clone_workflow,
            commands::workflow_api::api_search_workflows,
            commands::workflow_api::api_list_templates,
            commands::workflow_api::api_create_from_template,
            commands::workflow_api::api_health_check,

            // Skills API 命令（与 Python 服务通信）
            commands::skills_api::api_execute_skill,
            commands::skills_api::api_skills_health_check,

            // 文件管理命令
            commands::file::upload_file,
            commands::file::get_file,
            commands::file::read_file_content,
            commands::file::list_files_by_filter,
            commands::file::update_file,
            commands::file::delete_file,
            commands::file::delete_file_permanent,
            commands::file::batch_delete,
            commands::file::get_file_history_records,
            commands::file::get_file_statistics,
            commands::file::search_files_by_keyword,
            commands::file::cleanup_old_file_records,
            commands::file::export_file,
            commands::file::copy_file,
            commands::file::get_file_url,
            
            // 加密命令
            commands::encryption::encrypt_text,
            commands::encryption::decrypt_text,
            commands::encryption::generate_master_key,
            commands::encryption::load_key,
            commands::encryption::rotate_key,
            commands::encryption::delete_key,
            commands::encryption::key_exists,
            commands::encryption::get_key_info,
            commands::encryption::unload_key,
            commands::encryption::store_encrypted_field,
            commands::encryption::retrieve_encrypted_field,
            commands::encryption::delete_encrypted_field,
            commands::encryption::mask_sensitive_data,
            commands::encryption::mask_all_sensitive,
            commands::encryption::query_audit_logs,
            commands::encryption::cleanup_audit_logs,
            commands::encryption::get_audit_statistics,
            
            // 权限命令
            commands::permission::get_all_permissions,
            commands::permission::get_permission_by_type,
            commands::permission::get_permissions_by_category,
            commands::permission::request_permission,
            commands::permission::grant_permission,
            commands::permission::deny_permission,
            commands::permission::revoke_permission,
            commands::permission::check_permission,
            commands::permission::get_entity_grants,
            commands::permission::get_pending_grants,
            commands::permission::cleanup_expired_grants,
            commands::permission::log_permission_usage,
            commands::permission::get_permission_usage_logs,
            commands::permission::get_permission_stats,
            commands::permission::create_permission_group,
            commands::permission::get_permission_group,
            commands::permission::get_all_permission_groups,
            commands::permission::grant_permission_group,
            
            // 内存管理命令
            commands::memory::get_memory_info,
            commands::memory::register_memory_pool,
            commands::memory::update_memory_pool_stats,
            commands::memory::get_memory_pool_stats,
            commands::memory::create_memory_snapshot,
            commands::memory::get_memory_snapshots,
            commands::memory::detect_memory_leaks,
            commands::memory::get_memory_leak_reports,
            commands::memory::cleanup_memory,
            commands::memory::set_memory_thresholds,
            commands::memory::get_memory_thresholds,
            commands::memory::should_auto_cleanup_memory,
            commands::memory::get_memory_status,
            commands::memory::get_memory_summary,
            
            // 渲染性能命令
            commands::rendering::record_render_performance,
            commands::rendering::record_frame_performance,
            commands::rendering::update_webgl_stats,
            commands::rendering::get_render_stats,
            commands::rendering::get_optimization_suggestions,
            commands::rendering::get_render_records,
            commands::rendering::get_frame_records,
            commands::rendering::get_webgl_stats,
            commands::rendering::clear_render_records,
            commands::rendering::set_slow_render_threshold,
            commands::rendering::set_max_records,
            
            // 语言设置命令
            commands::language::save_language_setting,
            commands::language::load_language_settings,
            commands::language::detect_system_language,
            commands::language::update_language_settings,
            commands::language::reset_language_settings,
            commands::language::get_supported_languages,
            
            // 区域适配命令
            commands::region::detect_system_region,
            commands::region::get_recommended_regions,
            commands::region::get_user_region_preferences,
            commands::region::save_user_region_preferences,
            commands::region::delete_user_region_preferences,
            commands::region::get_all_region_configs,
            commands::region::get_region_config,
            commands::region::cache_region_config,
            commands::region::initialize_region_system,
            commands::region::format_datetime,
            commands::region::format_date,
            commands::region::format_time,
            commands::region::format_number,
            commands::region::format_currency,
            commands::region::format_temperature,
            commands::region::format_distance,
            commands::region::format_weight,
            commands::region::format_file_size,
            commands::region::format_percentage,
            commands::region::convert_temperature,
            commands::region::convert_distance,
            commands::region::convert_weight,
            commands::region::cleanup_expired_region_cache,
            commands::region::get_region_format_stats,
            
            // 性能监控命令
            commands::performance::record_performance_metric,
            commands::performance::record_performance_metrics_batch,
            commands::performance::get_performance_metrics,
            commands::performance::get_performance_summary,
            commands::performance::record_user_operation,
            commands::performance::get_user_operations,
            commands::performance::get_user_operation_stats,
            commands::performance::record_network_metric,
            commands::performance::get_network_metrics,
            commands::performance::get_network_stats,
            commands::performance::record_performance_snapshot,
            commands::performance::get_performance_snapshots,
            commands::performance::get_performance_alerts,
            commands::performance::resolve_performance_alert,
            commands::performance::get_alert_stats,
            commands::performance::get_monitor_config,
            commands::performance::update_monitor_config,
            commands::performance::start_performance_monitoring,
            commands::performance::stop_performance_monitoring,
            commands::performance::is_monitoring_active,
            commands::performance::cleanup_performance_data,
            commands::performance::get_monitoring_status,
            commands::performance::generate_performance_report,
            
            // 日志系统命令
            commands::logging::init_logging_system,
            commands::logging::write_log_entry,
            commands::logging::search_logs,
            commands::logging::get_log_statistics,
            commands::logging::export_logs,
            commands::logging::cleanup_old_logs,
            commands::logging::get_log_config,
            commands::logging::update_log_config,
            commands::logging::get_remote_log_config,
            commands::logging::update_remote_log_config,
            commands::logging::upload_logs_to_remote,
            commands::logging::get_log_system_status,
            commands::logging::flush_log_buffer,
            commands::logging::get_log_files,
            commands::logging::delete_log_file,
            commands::logging::compress_log_files,
            
            // Deep Link 命令
            commands::deeplink::handle_deep_link,
            commands::deeplink::is_launched_from_community,
            
            // 本地LLM模型管理命令
            commands::local_llm::get_local_llm_models,
            commands::local_llm::upload_local_llm_model,
            commands::local_llm::register_local_llm_model,
            commands::local_llm::download_local_llm_model,
            commands::local_llm::delete_local_llm_model,
            commands::local_llm::verify_local_llm_model,
            commands::local_llm::get_local_llm_model,
            
            // Prompt管理命令
            commands::prompt::get_prompts,
            commands::prompt::create_prompt,
            commands::prompt::update_prompt,
            commands::prompt::delete_prompt,
            commands::prompt::apply_prompt,
            commands::prompt::get_prompt,
            commands::prompt::get_current_prompt,
            
            // 角色模板管理命令
            commands::character_template::register_character_adapter,
            commands::character_template::get_character_templates,
            commands::character_template::save_character_template,
            commands::character_template::update_character_template,
            commands::character_template::delete_character_template,
            
            // 音频录制和播放命令
            commands::audio::list_audio_devices,
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::audio::get_recording_data,
            commands::audio::is_recording,
            commands::audio::save_audio_to_file,
            commands::audio::cancel_recording,
            
            // 认证命令
            commands::auth::save_auth_token,
            commands::auth::get_auth_token,
            commands::auth::clear_auth_token,
            commands::auth::save_refresh_token,
            commands::auth::get_refresh_token,
            commands::auth::clear_refresh_token,
            commands::auth::get_device_name,
            commands::auth::get_device_id,
            commands::auth::get_user_agent,
        ])
        .manage(commands::shortcuts::ShortcutRegistry::new())
        .manage(commands::memory::MemoryManagerState::new())
        .manage(commands::audio::AudioState::default())
        .manage(std::sync::Arc::new(std::sync::Mutex::new(commands::rendering::RenderingState::default())))
        .manage(commands::region::RegionState::default())
        .manage(commands::update::UpdateManagerState::new())
        .manage({
            let app_data_dir = std::env::var("APPDATA").unwrap_or_else(|_| {
                dirs::config_dir()
                    .map(|d| d.to_string_lossy().to_string())
                    .unwrap_or_else(|| "./data".to_string())
            });
            let db_path = format!("{}/zishu-sensei/performance.db", app_data_dir);
            commands::performance::PerformanceMonitorState::new(&db_path).expect("初始化性能监控状态失败")
        })
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
