//! 系统托盘事件处理模块
//! 
//! 负责处理所有系统托盘相关的事件和功能，包括：
//! - 托盘图标管理
//! - 托盘菜单创建和更新
//! - 托盘事件处理（点击、双击、右键等）
//! - 托盘通知
//! - 动态菜单状态更新

use tauri::{
    api::shell, AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, 
    SystemTrayMenu, SystemTrayMenuItem, SystemTraySubmenu, Window, WindowBuilder, WindowUrl,
};
use tracing::{debug, error, info, warn};

use crate::state::AppState;

/// 系统托盘事件处理器
pub struct TrayEventHandler {
    app_handle: AppHandle,
}

impl TrayEventHandler {
    /// 创建新的托盘事件处理器
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// 处理托盘左键单击事件
    pub fn handle_left_click(&self) {
        info!("系统托盘左键点击");
        
        // 切换主窗口的显示/隐藏状态
        if let Some(window) = self.app_handle.get_window("main") {
            match window.is_visible() {
                Ok(true) => {
                    if let Err(e) = window.hide() {
                        error!("隐藏主窗口失败: {}", e);
                    } else {
                        info!("主窗口已隐藏");
                    }
                }
                Ok(false) => {
                    if let Err(e) = window.show() {
                        error!("显示主窗口失败: {}", e);
                    } else if let Err(e) = window.set_focus() {
                        warn!("设置窗口焦点失败: {}", e);
                    } else {
                        info!("主窗口已显示并获得焦点");
                    }
                }
                Err(e) => {
                    error!("获取窗口可见性失败: {}", e);
                }
            }
        } else {
            warn!("未找到主窗口");
        }
    }

    /// 处理托盘右键单击事件
    pub fn handle_right_click(&self) {
        debug!("系统托盘右键点击");
        // 右键点击会自动显示上下文菜单，无需额外处理
        // 但可以在这里更新菜单状态
        self.update_tray_menu();
    }

    /// 处理托盘双击事件
    pub fn handle_double_click(&self) {
        info!("系统托盘双击");
        
        // 双击打开聊天窗口
        self.open_chat_window();
    }

    /// 处理托盘菜单项点击事件
    pub fn handle_menu_item_click(&self, menu_id: &str) {
        info!("托盘菜单项点击: {}", menu_id);

        match menu_id {
            // 聊天相关
            "chat" => self.open_chat_window(),
            
            // 设置子菜单
            "character_settings" => self.open_settings_window("character"),
            "theme_settings" => self.open_settings_window("theme"),
            "adapter_settings" => self.open_settings_window("adapter"),
            "sound_settings" => self.open_settings_window("sound"),
            "system_settings" => self.open_settings_window("system"),
            
            // 工具和市场
            "adapter_market" => self.open_adapter_market(),
            "workflow_editor" => self.open_workflow_editor(),
            "screenshot" => self.take_screenshot(),
            
            // 窗口控制
            "show_window" => self.show_main_window(),
            "hide_window" => self.hide_main_window(),
            "toggle_always_on_top" => self.toggle_always_on_top(),
            
            // 角色控制
            "character_idle" => self.trigger_character_action("idle"),
            "character_wave" => self.trigger_character_action("wave"),
            "character_dance" => self.trigger_character_action("dance"),
            
            // 应用控制
            "about" => self.show_about_dialog(),
            "check_updates" => self.check_for_updates(),
            "restart" => self.restart_app(),
            "quit" => self.quit_app(),
            
            _ => {
                warn!("未处理的托盘菜单项: {}", menu_id);
            }
        }
    }

    /// 打开聊天窗口
    fn open_chat_window(&self) {
        info!("打开聊天窗口");
        
        if let Some(window) = self.app_handle.get_window("chat") {
            // 窗口已存在，显示并聚焦
            if let Err(e) = window.show() {
                error!("显示聊天窗口失败: {}", e);
            } else if let Err(e) = window.set_focus() {
                warn!("设置聊天窗口焦点失败: {}", e);
            }
        } else {
            // 创建新的聊天窗口
            let chat_window = WindowBuilder::new(
                &self.app_handle,
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
            .visible(true)
            .build();

            match chat_window {
                Ok(_window) => {
                    info!("聊天窗口创建成功");
                }
                Err(e) => {
                    error!("创建聊天窗口失败: {}", e);
                    self.show_error_notification("无法打开聊天窗口", &e.to_string());
                }
            }
        }
    }

    /// 打开设置窗口
    fn open_settings_window(&self, tab: &str) {
        info!("打开设置窗口，标签页: {}", tab);
        
        let window_label = "settings";
        
        if let Some(window) = self.app_handle.get_window(window_label) {
            // 窗口已存在，显示并切换标签页
            if let Err(e) = window.show() {
                error!("显示设置窗口失败: {}", e);
            } else if let Err(e) = window.set_focus() {
                warn!("设置窗口焦点失败: {}", e);
            }
            
            // 发送事件切换到指定标签页
            if let Err(e) = window.emit("switch-settings-tab", tab) {
                warn!("发送切换设置标签页事件失败: {}", e);
            }
        } else {
            // 创建新的设置窗口
            let settings_window = WindowBuilder::new(
                &self.app_handle,
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
            .visible(true)
            .build();

            match settings_window {
                Ok(_window) => {
                    info!("设置窗口创建成功");
                }
                Err(e) => {
                    error!("创建设置窗口失败: {}", e);
                    self.show_error_notification("无法打开设置窗口", &e.to_string());
                }
            }
        }
    }

    /// 打开适配器市场
    fn open_adapter_market(&self) {
        info!("打开适配器市场");
        
        let url = "https://market.zishu.dev";
        if let Err(e) = shell::open(&self.app_handle.shell_scope(), url, None) {
            error!("打开适配器市场失败: {}", e);
            self.show_error_notification("无法打开适配器市场", &e.to_string());
        }
    }

    /// 打开工作流编辑器
    fn open_workflow_editor(&self) {
        info!("打开工作流编辑器");
        
        let window_label = "workflow";
        
        if let Some(window) = self.app_handle.get_window(window_label) {
            if let Err(e) = window.show() {
                error!("显示工作流编辑器失败: {}", e);
            } else if let Err(e) = window.set_focus() {
                warn!("设置工作流编辑器焦点失败: {}", e);
            }
        } else {
            let workflow_window = WindowBuilder::new(
                &self.app_handle,
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
            .visible(true)
            .build();

            match workflow_window {
                Ok(_window) => {
                    info!("工作流编辑器窗口创建成功");
                }
                Err(e) => {
                    error!("创建工作流编辑器窗口失败: {}", e);
                    self.show_error_notification("无法打开工作流编辑器", &e.to_string());
                }
            }
        }
    }

    /// 截图功能
    fn take_screenshot(&self) {
        info!("触发截图功能");
        
        if let Some(main_window) = self.app_handle.get_window("main") {
            if let Err(e) = main_window.emit("take-screenshot", ()) {
                error!("发送截图事件失败: {}", e);
                self.show_error_notification("截图失败", &e.to_string());
            }
        }
    }

    /// 显示主窗口
    fn show_main_window(&self) {
        info!("显示主窗口");
        
        if let Some(window) = self.app_handle.get_window("main") {
            if let Err(e) = window.show() {
                error!("显示主窗口失败: {}", e);
            } else if let Err(e) = window.set_focus() {
                warn!("设置主窗口焦点失败: {}", e);
            } else {
                // 更新托盘菜单状态
                self.update_tray_menu();
            }
        }
    }

    /// 隐藏主窗口
    fn hide_main_window(&self) {
        info!("隐藏主窗口");
        
        if let Some(window) = self.app_handle.get_window("main") {
            if let Err(e) = window.hide() {
                error!("隐藏主窗口失败: {}", e);
            } else {
                // 更新托盘菜单状态
                self.update_tray_menu();
                
                // 显示通知
                if let Some(app_state) = self.app_handle.try_state::<AppState>() {
                    let config = app_state.config.lock();
                    if config.system.show_notifications {
                        self.show_info_notification(
                            "Zishu Sensei",
                            "应用已最小化到系统托盘"
                        );
                    }
                }
            }
        }
    }

    /// 切换窗口置顶状态
    fn toggle_always_on_top(&self) {
        info!("切换窗口置顶状态");
        
        if let Some(window) = self.app_handle.get_window("main") {
            match window.is_always_on_top() {
                Ok(current_state) => {
                    let new_state = !current_state;
                    if let Err(e) = window.set_always_on_top(new_state) {
                        error!("设置窗口置顶状态失败: {}", e);
                    } else {
                        info!("窗口置顶状态已切换为: {}", new_state);
                        
                        // 更新配置
                        if let Some(app_state) = self.app_handle.try_state::<AppState>() {
                            let mut config = app_state.config.lock();
                            config.window.always_on_top = new_state;
                        }
                        
                        // 更新托盘菜单
                        self.update_tray_menu();
                        
                        // 显示通知
                        let msg = if new_state { "窗口已设置为置顶" } else { "窗口已取消置顶" };
                        self.show_info_notification("Zishu Sensei", msg);
                    }
                }
                Err(e) => {
                    error!("获取窗口置顶状态失败: {}", e);
                }
            }
        }
    }

    /// 触发角色动作
    fn trigger_character_action(&self, action: &str) {
        info!("触发角色动作: {}", action);
        
        if let Some(window) = self.app_handle.get_window("main") {
            if let Err(e) = window.emit("character-action", action) {
                error!("发送角色动作事件失败: {}", e);
            }
        }
    }

    /// 显示关于对话框
    fn show_about_dialog(&self) {
        info!("显示关于对话框");
        
        use tauri::api::dialog;
        
        let version = self.app_handle.package_info().version.to_string();
        let message = format!(
            "🐾 Zishu Sensei Desktop Pet\n\n\
            版本: {}\n\n\
            基于 Tauri + React + Live2D 开发的智能桌面宠物应用\n\n\
            © 2025 Zishu Team\n\n\
            https://zishu.dev",
            version
        );
        
        if let Some(main_window) = self.app_handle.get_window("main") {
            dialog::message(Some(&main_window), "关于 Zishu Sensei", message);
        } else {
            // 如果主窗口不可用，使用 None
            dialog::message(None::<&Window>, "关于 Zishu Sensei", message);
        }
    }

    /// 检查更新
    fn check_for_updates(&self) {
        info!("检查更新");
        
        // 发送检查更新事件到前端
        if let Some(window) = self.app_handle.get_window("main") {
            if let Err(e) = window.emit("check-for-updates", ()) {
                error!("发送检查更新事件失败: {}", e);
            }
        }
        
        self.show_info_notification("Zishu Sensei", "正在检查更新...");
    }

    /// 重启应用
    fn restart_app(&self) {
        info!("重启应用");
        
        use tauri::api::dialog;
        
        let message = "确定要重启应用吗？";
        let title = "重启应用";
        
        let app_handle = self.app_handle.clone();
        
        if let Some(main_window) = self.app_handle.get_window("main") {
            dialog::ask(
                Some(&main_window),
                title,
                message,
                move |answer| {
                    if answer {
                        info!("用户确认重启应用");
                        app_handle.restart();
                    } else {
                        info!("用户取消重启应用");
                    }
                }
            );
        }
    }

    /// 退出应用
    fn quit_app(&self) {
        info!("退出应用");
        
        use tauri::api::dialog;
        
        let message = "确定要退出应用吗？";
        let title = "退出应用";
        
        let app_handle = self.app_handle.clone();
        
        if let Some(main_window) = self.app_handle.get_window("main") {
            dialog::ask(
                Some(&main_window),
                title,
                message,
                move |answer| {
                    if answer {
                        info!("用户确认退出应用");
                        app_handle.exit(0);
                    } else {
                        info!("用户取消退出应用");
                    }
                }
            );
        } else {
            // 如果主窗口不可用，直接退出
            self.app_handle.exit(0);
        }
    }

    /// 更新托盘菜单状态
    fn update_tray_menu(&self) {
        debug!("更新托盘菜单状态");
        
        // 这里可以根据当前应用状态动态更新菜单项
        // 例如：更新"显示/隐藏"菜单项的文本，更新置顶状态的勾选等
        // Tauri 1.x 的限制：不支持动态更新菜单文本，只能在创建时设置
        // 如果需要动态菜单，可以考虑重新创建整个托盘
    }

    /// 显示信息通知
    fn show_info_notification(&self, title: &str, body: &str) {
        use tauri::api::notification::Notification;
        
        if let Err(e) = Notification::new(&self.app_handle.config().tauri.bundle.identifier)
            .title(title)
            .body(body)
            .show() {
            warn!("显示通知失败: {}", e);
        }
    }

    /// 显示错误通知
    fn show_error_notification(&self, title: &str, error: &str) {
        use tauri::api::notification::Notification;
        
        let body = format!("错误: {}", error);
        
        if let Err(e) = Notification::new(&self.app_handle.config().tauri.bundle.identifier)
            .title(title)
            .body(&body)
            .show() {
            warn!("显示错误通知失败: {}", e);
        }
    }
}

/// 创建系统托盘菜单
pub fn create_system_tray() -> SystemTray {
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
    
    // 角色动作子菜单
    let character_idle = CustomMenuItem::new("character_idle".to_string(), "😊 待机");
    let character_wave = CustomMenuItem::new("character_wave".to_string(), "👋 挥手");
    let character_dance = CustomMenuItem::new("character_dance".to_string(), "💃 跳舞");
    
    let character_submenu = SystemTraySubmenu::new(
        "🎭 角色动作",
        SystemTrayMenu::new()
            .add_item(character_idle)
            .add_item(character_wave)
            .add_item(character_dance),
    );
    
    // 工具菜单
    let adapter_market = CustomMenuItem::new("adapter_market".to_string(), "🔄 适配器市场");
    let workflow_editor = CustomMenuItem::new("workflow_editor".to_string(), "📋 工作流编辑器");
    let screenshot = CustomMenuItem::new("screenshot".to_string(), "📸 截图");
    let separator2 = SystemTrayMenuItem::Separator;
    
    // 窗口控制
    let show_window = CustomMenuItem::new("show_window".to_string(), "👁️ 显示窗口");
    let hide_window = CustomMenuItem::new("hide_window".to_string(), "🙈 隐藏窗口");
    let toggle_always_on_top = CustomMenuItem::new("toggle_always_on_top".to_string(), "📌 切换置顶");
    let separator3 = SystemTrayMenuItem::Separator;
    
    // 应用控制
    let about = CustomMenuItem::new("about".to_string(), "ℹ️ 关于");
    let check_updates = CustomMenuItem::new("check_updates".to_string(), "🔄 检查更新");
    let restart = CustomMenuItem::new("restart".to_string(), "🔄 重启应用");
    let quit = CustomMenuItem::new("quit".to_string(), "❌ 退出");

    let tray_menu = SystemTrayMenu::new()
        .add_item(chat_menu)
        .add_native_item(separator1)
        .add_submenu(settings_submenu)
        .add_submenu(character_submenu)
        .add_item(adapter_market)
        .add_item(workflow_editor)
        .add_item(screenshot)
        .add_native_item(separator2)
        .add_item(show_window)
        .add_item(hide_window)
        .add_item(toggle_always_on_top)
        .add_native_item(separator3)
        .add_item(about)
        .add_item(check_updates)
        .add_item(restart)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

/// 处理系统托盘事件的主函数（用于 Tauri 的 on_system_tray_event）
pub fn handle_system_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    let handler = TrayEventHandler::new(app.clone());

    match event {
        SystemTrayEvent::LeftClick { position: _, size: _, .. } => {
            handler.handle_left_click();
        }
        SystemTrayEvent::RightClick { position: _, size: _, .. } => {
            handler.handle_right_click();
        }
        SystemTrayEvent::DoubleClick { position: _, size: _, .. } => {
            handler.handle_double_click();
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            handler.handle_menu_item_click(&id);
        }
        _ => {
            debug!("未处理的托盘事件: {:?}", event);
        }
    }
}

/// 托盘操作辅助函数
pub mod helpers {
    use super::*;
    use tauri::Icon;

    /// 更新托盘图标
    pub fn update_tray_icon(app_handle: &AppHandle, icon_path: &str) -> Result<(), String> {
        let icon = tauri::Icon::File(std::path::PathBuf::from(icon_path));
        
        app_handle.tray_handle()
            .set_icon(icon)
            .map_err(|e| format!("更新托盘图标失败: {}", e))?;
        
        info!("托盘图标已更新: {}", icon_path);
        Ok(())
    }

    /// 更新托盘工具提示
    pub fn update_tray_tooltip(app_handle: &AppHandle, tooltip: &str) -> Result<(), String> {
        app_handle.tray_handle()
            .set_tooltip(tooltip)
            .map_err(|e| format!("更新托盘提示失败: {}", e))?;
        
        debug!("托盘提示已更新: {}", tooltip);
        Ok(())
    }

    /// 显示托盘通知（带图标）
    pub fn show_tray_notification_with_icon(
        app_handle: &AppHandle,
        title: &str,
        body: &str,
        icon: Option<Icon>,
    ) -> Result<(), String> {
        use tauri::api::notification::Notification;
        
        let mut notification = Notification::new(&app_handle.config().tauri.bundle.identifier)
            .title(title)
            .body(body);
        
        if let Some(icon_data) = icon {
            notification = notification.icon(icon_data.to_string());
        }
        
        notification.show()
            .map_err(|e| format!("显示托盘通知失败: {}", e))?;
        
        Ok(())
    }

    /// 重建托盘菜单（用于动态更新菜单状态）
    pub fn rebuild_tray_menu(app_handle: &AppHandle) -> Result<(), String> {
        let new_tray = create_system_tray();
        
        app_handle.tray_handle()
            .set_menu(new_tray.menu().unwrap().clone())
            .map_err(|e| format!("重建托盘菜单失败: {}", e))?;
        
        info!("托盘菜单已重建");
        Ok(())
    }

    /// 销毁托盘
    pub fn destroy_tray(app_handle: &AppHandle) -> Result<(), String> {
        app_handle.tray_handle()
            .destroy()
            .map_err(|e| format!("销毁托盘失败: {}", e))?;
        
        info!("托盘已销毁");
        Ok(())
    }

    /// 获取托盘菜单项状态（示例）
    pub fn get_menu_item_state(app_handle: &AppHandle, item_id: &str) -> Option<bool> {
        // Tauri 1.x 不直接支持获取菜单项状态
        // 可以通过应用状态来间接获取
        if item_id == "toggle_always_on_top" {
            if let Some(window) = app_handle.get_window("main") {
                return window.is_always_on_top().ok();
            }
        }
        None
    }
}

