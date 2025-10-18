/**
 * 键盘快捷键命令模块
 * 
 * 提供全局快捷键注册、管理和触发功能
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime, State};

/// 修饰键配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModifierKeys {
    #[serde(default)]
    pub ctrl: bool,
    #[serde(default)]
    pub alt: bool,
    #[serde(default)]
    pub shift: bool,
    #[serde(default)]
    pub meta: bool,
}

/// 快捷键配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub key: String,
    pub modifiers: ModifierKeys,
    pub scope: String,
    pub category: String,
    pub enabled: bool,
    #[serde(default)]
    pub prevent_default: bool,
    #[serde(default = "default_true")]
    pub customizable: bool,
}

fn default_true() -> bool {
    true
}

/// 快捷键绑定信息
#[derive(Debug, Clone, Serialize)]
pub struct ShortcutBinding {
    pub config: ShortcutConfig,
    pub registered_at: i64,
    pub last_triggered: Option<i64>,
    pub trigger_count: u64,
}

/// 快捷键注册表状态
pub struct ShortcutRegistry {
    pub shortcuts: Mutex<HashMap<String, ShortcutBinding>>,
}

impl ShortcutRegistry {
    pub fn new() -> Self {
        Self {
            shortcuts: Mutex::new(HashMap::new()),
        }
    }
}

/// 将快捷键配置转换为快捷键字符串
fn shortcut_to_string(config: &ShortcutConfig) -> String {
    let mut parts = Vec::new();

    if config.modifiers.ctrl {
        parts.push("Ctrl");
    }
    if config.modifiers.alt {
        parts.push("Alt");
    }
    if config.modifiers.shift {
        parts.push("Shift");
    }
    if config.modifiers.meta {
        #[cfg(target_os = "macos")]
        parts.push("Cmd");
        #[cfg(not(target_os = "macos"))]
        parts.push("Meta");
    }

    parts.push(&config.key);
    parts.join("+")
}

/// 注册快捷键
#[tauri::command]
pub async fn register_shortcut<R: Runtime>(
    app: AppHandle<R>,
    registry: State<'_, ShortcutRegistry>,
    config: ShortcutConfig,
) -> Result<String, String> {
    let id = config.id.clone();
    let shortcut_string = shortcut_to_string(&config);

    // 验证快捷键是否已注册
    {
        let shortcuts = registry.shortcuts.lock().unwrap();
        if shortcuts.contains_key(&id) {
            return Err(format!("快捷键 {} 已经注册", id));
        }
    }

    // 如果是全局快捷键，注册到 Tauri
    if config.scope == "global" {
        use tauri::GlobalShortcutManager;
        
        let shortcut_clone = shortcut_string.clone();
        let id_clone = id.clone();
        let app_clone = app.clone();
        
        match app.global_shortcut_manager().register(&shortcut_string, move || {
            // 触发快捷键事件
            let _ = app_clone.emit_all("global-shortcut-triggered", json!({
                "id": id_clone.clone(),
                "shortcut": shortcut_clone.clone(),
                "timestamp": chrono::Utc::now().timestamp_millis(),
            }));
        }) {
            Ok(_) => {
                println!("全局快捷键已注册: {} ({})", id, shortcut_string);
            }
            Err(e) => {
                return Err(format!("注册全局快捷键失败: {}", e));
            }
        }
    }

    // 添加到注册表
    let binding = ShortcutBinding {
        config: config.clone(),
        registered_at: chrono::Utc::now().timestamp_millis(),
        last_triggered: None,
        trigger_count: 0,
    };

    let mut shortcuts = registry.shortcuts.lock().unwrap();
    shortcuts.insert(id.clone(), binding);

    // 触发注册事件
    let _ = app.emit_all("shortcut-registered", json!({
        "id": id,
        "config": config,
        "timestamp": chrono::Utc::now().timestamp_millis(),
    }));

    Ok(shortcut_string)
}

/// 取消注册快捷键
#[tauri::command]
pub async fn unregister_shortcut<R: Runtime>(
    app: AppHandle<R>,
    registry: State<'_, ShortcutRegistry>,
    id: String,
) -> Result<(), String> {
    let mut shortcuts = registry.shortcuts.lock().unwrap();
    
    if let Some(binding) = shortcuts.remove(&id) {
        // 如果是全局快捷键，从 Tauri 取消注册
        if binding.config.scope == "global" {
            use tauri::GlobalShortcutManager;
            let shortcut_string = shortcut_to_string(&binding.config);
            
            match app.global_shortcut_manager().unregister(&shortcut_string) {
                Ok(_) => {
                    println!("全局快捷键已取消注册: {} ({})", id, shortcut_string);
                }
                Err(e) => {
                    return Err(format!("取消注册全局快捷键失败: {}", e));
                }
            }
        }

        // 触发取消注册事件
        let _ = app.emit_all("shortcut-unregistered", json!({
            "id": id,
            "timestamp": chrono::Utc::now().timestamp_millis(),
        }));

        Ok(())
    } else {
        Err(format!("快捷键 {} 未注册", id))
    }
}

/// 取消注册所有快捷键
#[tauri::command]
pub async fn unregister_all_shortcuts<R: Runtime>(
    app: AppHandle<R>,
    registry: State<'_, ShortcutRegistry>,
) -> Result<u32, String> {
    let mut shortcuts = registry.shortcuts.lock().unwrap();
    let count = shortcuts.len() as u32;

    use tauri::GlobalShortcutManager;
    
    // 取消所有全局快捷键
    for (id, binding) in shortcuts.iter() {
        if binding.config.scope == "global" {
            let shortcut_string = shortcut_to_string(&binding.config);
            let _ = app.global_shortcut_manager().unregister(&shortcut_string);
            println!("全局快捷键已取消注册: {} ({})", id, shortcut_string);
        }
    }

    shortcuts.clear();

    // 触发事件
    let _ = app.emit_all("all-shortcuts-unregistered", json!({
        "count": count,
        "timestamp": chrono::Utc::now().timestamp_millis(),
    }));

    Ok(count)
}

/// 获取所有已注册的快捷键
#[tauri::command]
pub async fn get_registered_shortcuts(
    registry: State<'_, ShortcutRegistry>,
) -> Result<Vec<ShortcutBinding>, String> {
    let shortcuts = registry.shortcuts.lock().unwrap();
    Ok(shortcuts.values().cloned().collect())
}

/// 获取指定快捷键信息
#[tauri::command]
pub async fn get_shortcut_info(
    registry: State<'_, ShortcutRegistry>,
    id: String,
) -> Result<ShortcutBinding, String> {
    let shortcuts = registry.shortcuts.lock().unwrap();
    shortcuts
        .get(&id)
        .cloned()
        .ok_or_else(|| format!("快捷键 {} 未注册", id))
}

/// 更新快捷键配置
#[tauri::command]
pub async fn update_shortcut<R: Runtime>(
    app: AppHandle<R>,
    registry: State<'_, ShortcutRegistry>,
    id: String,
    config: ShortcutConfig,
) -> Result<(), String> {
    // 先取消注册旧的快捷键
    unregister_shortcut(app.clone(), registry.clone(), id.clone()).await?;
    
    // 注册新的快捷键
    register_shortcut(app, registry, config).await?;
    
    Ok(())
}

/// 启用或禁用快捷键
#[tauri::command]
pub async fn toggle_shortcut<R: Runtime>(
    app: AppHandle<R>,
    registry: State<'_, ShortcutRegistry>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut shortcuts = registry.shortcuts.lock().unwrap();
    
    if let Some(binding) = shortcuts.get_mut(&id) {
        let old_enabled = binding.config.enabled;
        binding.config.enabled = enabled;

        // 如果状态改变且是全局快捷键，需要重新注册或取消注册
        if old_enabled != enabled && binding.config.scope == "global" {
            use tauri::GlobalShortcutManager;
            let shortcut_string = shortcut_to_string(&binding.config);

            if enabled {
                // 重新注册
                let id_clone = id.clone();
                let app_clone = app.clone();
                let shortcut_clone = shortcut_string.clone();
                
                match app.global_shortcut_manager().register(&shortcut_string, move || {
                    let _ = app_clone.emit_all("global-shortcut-triggered", json!({
                        "id": id_clone.clone(),
                        "shortcut": shortcut_clone.clone(),
                        "timestamp": chrono::Utc::now().timestamp_millis(),
                    }));
                }) {
                    Ok(_) => println!("快捷键已重新启用: {}", id),
                    Err(e) => return Err(format!("启用快捷键失败: {}", e)),
                }
            } else {
                // 取消注册
                match app.global_shortcut_manager().unregister(&shortcut_string) {
                    Ok(_) => println!("快捷键已禁用: {}", id),
                    Err(e) => return Err(format!("禁用快捷键失败: {}", e)),
                }
            }
        }

        // 触发事件
        let _ = app.emit_all("shortcut-toggled", json!({
            "id": id,
            "enabled": enabled,
            "timestamp": chrono::Utc::now().timestamp_millis(),
        }));

        Ok(())
    } else {
        Err(format!("快捷键 {} 未注册", id))
    }
}

/// 记录快捷键触发
#[tauri::command]
pub async fn record_shortcut_trigger(
    registry: State<'_, ShortcutRegistry>,
    id: String,
) -> Result<(), String> {
    let mut shortcuts = registry.shortcuts.lock().unwrap();
    
    if let Some(binding) = shortcuts.get_mut(&id) {
        binding.last_triggered = Some(chrono::Utc::now().timestamp_millis());
        binding.trigger_count += 1;
        Ok(())
    } else {
        Err(format!("快捷键 {} 未注册", id))
    }
}

/// 获取快捷键统计信息
#[tauri::command]
pub async fn get_shortcut_statistics(
    registry: State<'_, ShortcutRegistry>,
) -> Result<ShortcutStatistics, String> {
    let shortcuts = registry.shortcuts.lock().unwrap();
    
    let total = shortcuts.len();
    let enabled = shortcuts.values().filter(|b| b.config.enabled).count();
    let global = shortcuts.values().filter(|b| b.config.scope == "global").count();
    let local = shortcuts.values().filter(|b| b.config.scope == "local").count();
    let custom = shortcuts.values().filter(|b| b.config.category == "custom").count();

    // 按分类统计
    let mut by_category = HashMap::new();
    for binding in shortcuts.values() {
        *by_category.entry(binding.config.category.clone()).or_insert(0) += 1;
    }

    // 最常用的快捷键
    let mut most_used: Vec<_> = shortcuts
        .iter()
        .map(|(id, binding)| (id.clone(), binding.trigger_count))
        .collect();
    most_used.sort_by(|a, b| b.1.cmp(&a.1));
    most_used.truncate(10);

    Ok(ShortcutStatistics {
        total,
        enabled,
        global,
        local,
        custom,
        by_category,
        most_used,
    })
}

#[derive(Debug, Serialize)]
pub struct ShortcutStatistics {
    pub total: usize,
    pub enabled: usize,
    pub global: usize,
    pub local: usize,
    pub custom: usize,
    pub by_category: HashMap<String, u32>,
    pub most_used: Vec<(String, u64)>,
}

/// 检查快捷键是否冲突
#[tauri::command]
pub async fn check_shortcut_conflict(
    registry: State<'_, ShortcutRegistry>,
    config: ShortcutConfig,
) -> Result<Vec<String>, String> {
    let shortcuts = registry.shortcuts.lock().unwrap();
    let shortcut_string = shortcut_to_string(&config);
    
    let conflicts: Vec<String> = shortcuts
        .iter()
        .filter(|(id, binding)| {
            *id != &config.id
                && binding.config.enabled
                && binding.config.scope == config.scope
                && shortcut_to_string(&binding.config) == shortcut_string
        })
        .map(|(id, _)| id.clone())
        .collect();

    Ok(conflicts)
}

/// 验证快捷键配置
#[tauri::command]
pub fn validate_shortcut_config(config: ShortcutConfig) -> Result<bool, String> {
    // 检查ID是否有效
    if config.id.is_empty() {
        return Err("快捷键ID不能为空".to_string());
    }

    // 检查key是否有效
    if config.key.is_empty() {
        return Err("快捷键按键不能为空".to_string());
    }

    // 检查scope是否有效
    if !["global", "local", "window"].contains(&config.scope.as_str()) {
        return Err("无效的快捷键作用域".to_string());
    }

    // 检查是否至少有一个修饰键（对于某些按键）
    let requires_modifier = config.key.len() == 1;
    if requires_modifier
        && !config.modifiers.ctrl
        && !config.modifiers.alt
        && !config.modifiers.shift
        && !config.modifiers.meta
    {
        return Err("单个字母或数字键必须配合修饰键使用".to_string());
    }

    Ok(true)
}

// 导入 serde_json 用于创建 JSON 数据
use serde_json::json;

