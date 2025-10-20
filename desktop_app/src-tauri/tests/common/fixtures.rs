//! 测试数据 Fixtures
//!
//! 提供各种测试数据的创建函数，用于在测试中快速生成标准化的测试对象

use serde_json::json;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

// ================================
// 适配器相关 Fixtures
// ================================

/// 创建测试用的适配器基本信息
/// 
/// # 参数
/// - `id`: 适配器唯一标识
/// 
/// # 返回
/// 包含适配器基本信息的 JSON 对象
pub fn create_test_adapter(id: &str) -> serde_json::Value {
    json!({
        "id": id,
        "name": format!("test-adapter-{}", id),
        "display_name": format!("Test Adapter {}", id),
        "version": "1.0.0",
        "adapter_type": "Soft",
        "description": format!("A test adapter for {}", id),
        "author": "Zishu Test Team",
        "license": "MIT",
        "tags": ["test", "mock", "development"],
        "created_at": Utc::now().to_rfc3339(),
        "updated_at": Utc::now().to_rfc3339(),
        "capabilities": [],
        "compatibility": {
            "base_models": ["gpt-3.5-turbo", "gpt-4"],
            "frameworks": {},
            "operating_systems": ["windows", "macos", "linux"],
            "python_versions": []
        },
        "resource_requirements": {
            "min_memory_mb": 512,
            "min_cpu_cores": 1,
            "gpu_required": false,
            "min_gpu_memory_mb": null,
            "python_version": null,
            "dependencies": []
        },
        "config_schema": {},
        "default_config": {}
    })
}

/// 创建测试用的已安装适配器
/// 
/// # 参数
/// - `id`: 适配器ID
/// - `enabled`: 是否启用
/// 
/// # 返回
/// InstalledAdapter 的测试数据
pub fn create_installed_adapter(id: &str, enabled: bool) -> serde_json::Value {
    let now = Utc::now();
    json!({
        "id": id,
        "name": format!("adapter-{}", id),
        "display_name": format!("Adapter {}", id),
        "version": "1.0.0",
        "install_path": format!("/test/adapters/{}", id),
        "status": "installed",
        "enabled": enabled,
        "auto_update": true,
        "source": "market",
        "source_id": format!("market-{}", id),
        "description": format!("Test adapter {}", id),
        "author": "Test Author",
        "license": "MIT",
        "homepage_url": format!("https://example.com/{}", id),
        "installed_at": now.to_rfc3339(),
        "updated_at": now.to_rfc3339(),
        "last_used_at": now.to_rfc3339(),
        "config": {},
        "metadata": {}
    })
}

/// 创建多个测试适配器
pub fn create_test_adapters(count: usize) -> Vec<serde_json::Value> {
    (0..count)
        .map(|i| create_test_adapter(&format!("adapter-{}", i)))
        .collect()
}

/// 创建适配器配置更新请求
pub fn create_adapter_config_update(adapter_id: &str, config: HashMap<String, serde_json::Value>) -> serde_json::Value {
    json!({
        "adapter_id": adapter_id,
        "config": config
    })
}

/// 创建适配器执行请求
pub fn create_adapter_execution_request(
    adapter_id: &str,
    action: &str,
    params: HashMap<String, serde_json::Value>,
) -> serde_json::Value {
    json!({
        "adapter_id": adapter_id,
        "action": action,
        "params": params,
        "timeout": 30
    })
}

// ================================
// 角色相关 Fixtures
// ================================

/// 创建测试用的角色数据
/// 
/// # 参数
/// - `id`: 角色唯一标识
/// 
/// # 返回
/// 包含角色信息的 JSON 对象
pub fn create_test_character(id: &str) -> serde_json::Value {
    json!({
        "id": id,
        "name": format!("character-{}", id),
        "display_name": format!("Character {}", id),
        "path": format!("/test/characters/{}/model.json", id),
        "preview_image": format!("/test/characters/{}/preview.png", id),
        "description": format!("A lovely test character {}", id),
        "gender": "female",
        "size": "medium",
        "features": ["cute", "friendly", "smart"],
        "motions": ["idle", "tap_body", "shake"],
        "expressions": ["normal", "smile", "angry", "sad"],
        "is_active": false
    })
}

/// 创建激活的角色
pub fn create_active_character(id: &str) -> serde_json::Value {
    let mut character = create_test_character(id);
    character["is_active"] = json!(true);
    character
}

/// 创建多个测试角色
pub fn create_test_characters(count: usize) -> Vec<serde_json::Value> {
    (0..count)
        .map(|i| create_test_character(&format!("char-{}", i)))
        .collect()
}

/// 创建角色配置
pub fn create_character_config(character_id: &str) -> serde_json::Value {
    json!({
        "character_id": character_id,
        "scale": 1.0,
        "position_x": 100.0,
        "position_y": 100.0,
        "interaction_enabled": true,
        "config_json": null
    })
}

/// 创建角色切换请求
pub fn create_character_switch_request(character_id: &str) -> serde_json::Value {
    json!({
        "character_id": character_id
    })
}

// ================================
// 聊天相关 Fixtures
// ================================

/// 创建测试用的聊天消息
/// 
/// # 参数
/// - `role`: 消息角色 (user, assistant, system)
/// - `content`: 消息内容
/// 
/// # 返回
/// 聊天消息对象
pub fn create_test_message(role: &str, content: &str) -> serde_json::Value {
    json!({
        "role": role,
        "content": content,
        "timestamp": Utc::now().timestamp(),
        "id": uuid::Uuid::new_v4().to_string()
    })
}

/// 创建用户消息
pub fn create_user_message(content: &str) -> serde_json::Value {
    create_test_message("user", content)
}

/// 创建助手消息
pub fn create_assistant_message(content: &str) -> serde_json::Value {
    create_test_message("assistant", content)
}

/// 创建系统消息
pub fn create_system_message(content: &str) -> serde_json::Value {
    create_test_message("system", content)
}

/// 创建聊天会话
pub fn create_chat_session(session_id: &str) -> serde_json::Value {
    json!({
        "id": session_id,
        "title": format!("Test Session {}", session_id),
        "created_at": Utc::now().to_rfc3339(),
        "updated_at": Utc::now().to_rfc3339(),
        "messages": [],
        "metadata": {}
    })
}

/// 创建完整的聊天对话
pub fn create_chat_conversation(message_count: usize) -> Vec<serde_json::Value> {
    (0..message_count)
        .map(|i| {
            if i % 2 == 0 {
                create_user_message(&format!("User message {}", i))
            } else {
                create_assistant_message(&format!("Assistant response {}", i))
            }
        })
        .collect()
}

// ================================
// 工作流相关 Fixtures
// ================================

/// 创建测试工作流
pub fn create_test_workflow(id: &str) -> serde_json::Value {
    json!({
        "id": id,
        "name": format!("workflow-{}", id),
        "description": format!("Test workflow {}", id),
        "version": "1.0.0",
        "enabled": true,
        "trigger": {
            "type": "manual",
            "config": {}
        },
        "steps": [],
        "created_at": Utc::now().to_rfc3339(),
        "updated_at": Utc::now().to_rfc3339()
    })
}

/// 创建工作流步骤
pub fn create_workflow_step(step_id: &str, action: &str) -> serde_json::Value {
    json!({
        "id": step_id,
        "action": action,
        "params": {},
        "next": null
    })
}

/// 创建工作流执行请求
pub fn create_workflow_execution_request(workflow_id: &str, input: HashMap<String, serde_json::Value>) -> serde_json::Value {
    json!({
        "workflow_id": workflow_id,
        "input": input,
        "timeout": 60
    })
}

// ================================
// 文件相关 Fixtures
// ================================

/// 创建文件信息
pub fn create_file_info(path: &str, size: u64) -> serde_json::Value {
    json!({
        "path": path,
        "name": std::path::Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown"),
        "size": size,
        "mime_type": "text/plain",
        "created_at": Utc::now().to_rfc3339(),
        "modified_at": Utc::now().to_rfc3339()
    })
}

/// 创建文件操作请求
pub fn create_file_operation_request(operation: &str, path: &str) -> serde_json::Value {
    json!({
        "operation": operation,
        "path": path,
        "options": {}
    })
}

// ================================
// 权限相关 Fixtures
// ================================

/// 创建权限数据
pub fn create_permission(resource: &str, action: &str, granted: bool) -> serde_json::Value {
    json!({
        "resource": resource,
        "action": action,
        "granted": granted,
        "granted_at": if granted { Some(Utc::now().to_rfc3339()) } else { None }
    })
}

/// 创建权限检查请求
pub fn create_permission_check_request(resource: &str, action: &str) -> serde_json::Value {
    json!({
        "resource": resource,
        "action": action
    })
}

/// 创建适配器权限
pub fn create_adapter_permission(adapter_id: &str, permission_type: &str, granted: bool) -> serde_json::Value {
    json!({
        "adapter_id": adapter_id,
        "permission_type": permission_type,
        "granted": granted,
        "granted_at": if granted { Some(Utc::now().to_rfc3339()) } else { None },
        "description": format!("Permission {} for adapter {}", permission_type, adapter_id)
    })
}

// ================================
// 加密相关 Fixtures
// ================================

/// 创建加密数据
pub fn create_encrypted_data(plaintext: &str) -> serde_json::Value {
    json!({
        "plaintext": plaintext,
        "algorithm": "AES-GCM-256",
        "key_id": "test-key-001",
        "iv": base64::encode("test_iv_12345678"),
        "encrypted": base64::encode(format!("encrypted_{}", plaintext)),
        "tag": base64::encode("test_tag_16bytes")
    })
}

/// 创建密钥信息
pub fn create_key_info(key_id: &str) -> serde_json::Value {
    json!({
        "id": key_id,
        "algorithm": "AES-256-GCM",
        "created_at": Utc::now().to_rfc3339(),
        "expires_at": null,
        "usage": ["encrypt", "decrypt"],
        "status": "active"
    })
}

// ================================
// 设置相关 Fixtures
// ================================

/// 创建应用设置
pub fn create_app_settings() -> serde_json::Value {
    json!({
        "language": "zh-CN",
        "theme": "light",
        "auto_start": false,
        "show_in_taskbar": true,
        "enable_notifications": true,
        "window": {
            "width": 800,
            "height": 600,
            "x": 100,
            "y": 100,
            "always_on_top": false
        },
        "character": {
            "scale": 1.0,
            "position_x": 100.0,
            "position_y": 100.0,
            "interaction_enabled": true
        },
        "performance": {
            "enable_hardware_acceleration": true,
            "max_memory_mb": 2048,
            "enable_logging": true
        }
    })
}

/// 创建主题配置
pub fn create_theme_config(theme_id: &str) -> serde_json::Value {
    json!({
        "id": theme_id,
        "name": format!("Theme {}", theme_id),
        "colors": {
            "primary": "#1890ff",
            "secondary": "#52c41a",
            "background": "#ffffff",
            "text": "#000000"
        },
        "fonts": {
            "primary": "Arial, sans-serif",
            "code": "Monaco, monospace"
        }
    })
}

// ================================
// 日志相关 Fixtures
// ================================

/// 创建日志条目
pub fn create_log_entry(level: &str, message: &str) -> serde_json::Value {
    json!({
        "level": level,
        "message": message,
        "timestamp": Utc::now().to_rfc3339(),
        "module": "test_module",
        "file": "test.rs",
        "line": 42
    })
}

/// 创建多个日志条目
pub fn create_log_entries(count: usize) -> Vec<serde_json::Value> {
    (0..count)
        .enumerate()
        .map(|(i, _)| {
            let level = match i % 4 {
                0 => "debug",
                1 => "info",
                2 => "warn",
                _ => "error",
            };
            create_log_entry(level, &format!("Test log message {}", i))
        })
        .collect()
}

// ================================
// 性能相关 Fixtures
// ================================

/// 创建性能指标
pub fn create_performance_metrics() -> serde_json::Value {
    json!({
        "cpu_usage": 15.5,
        "memory_usage_mb": 256.0,
        "memory_usage_percent": 12.3,
        "disk_read_mb": 10.5,
        "disk_write_mb": 5.2,
        "network_receive_kb": 100.0,
        "network_send_kb": 50.0,
        "timestamp": Utc::now().to_rfc3339()
    })
}

/// 创建系统信息
pub fn create_system_info() -> serde_json::Value {
    json!({
        "os": "Linux",
        "os_version": "6.8.0-85-generic",
        "arch": "x86_64",
        "cpu_cores": 8,
        "total_memory_mb": 16384,
        "available_memory_mb": 8192,
        "hostname": "test-machine",
        "uptime_seconds": 86400
    })
}

// ================================
// 更新相关 Fixtures
// ================================

/// 创建更新信息
pub fn create_update_info(version: &str, available: bool) -> serde_json::Value {
    json!({
        "current_version": "1.0.0",
        "latest_version": version,
        "update_available": available,
        "release_notes": format!("Release notes for version {}", version),
        "download_url": format!("https://example.com/downloads/{}", version),
        "published_at": Utc::now().to_rfc3339(),
        "required": false
    })
}

// ================================
// 错误相关 Fixtures
// ================================

/// 创建错误信息
pub fn create_error_info(code: &str, message: &str) -> serde_json::Value {
    json!({
        "code": code,
        "message": message,
        "timestamp": Utc::now().to_rfc3339(),
        "stack_trace": "test stack trace",
        "context": {}
    })
}

/// 创建错误监控事件
pub fn create_error_event(error_type: &str, severity: &str) -> serde_json::Value {
    json!({
        "type": error_type,
        "severity": severity,
        "message": format!("Test {} error", error_type),
        "timestamp": Utc::now().to_rfc3339(),
        "metadata": {}
    })
}

// ================================
// 市场相关 Fixtures
// ================================

/// 创建市场项目
pub fn create_market_item(item_id: &str, item_type: &str) -> serde_json::Value {
    json!({
        "id": item_id,
        "type": item_type,
        "name": format!("Market Item {}", item_id),
        "description": format!("A test market item of type {}", item_type),
        "version": "1.0.0",
        "author": "Test Author",
        "downloads": 1000,
        "rating": 4.5,
        "price": 0.0,
        "tags": ["test", item_type],
        "created_at": Utc::now().to_rfc3339(),
        "updated_at": Utc::now().to_rfc3339()
    })
}

// ================================
// 区域相关 Fixtures
// ================================

/// 创建区域信息
pub fn create_region_info(region_code: &str) -> serde_json::Value {
    json!({
        "code": region_code,
        "name": format!("Region {}", region_code),
        "language": "zh-CN",
        "timezone": "Asia/Shanghai",
        "currency": "CNY",
        "date_format": "YYYY-MM-DD",
        "time_format": "HH:mm:ss"
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_test_adapter() {
        let adapter = create_test_adapter("test-001");
        assert_eq!(adapter["id"], "test-001");
        assert_eq!(adapter["name"], "test-adapter-test-001");
    }

    #[test]
    fn test_create_test_character() {
        let character = create_test_character("char-001");
        assert_eq!(character["id"], "char-001");
        assert!(character["features"].is_array());
    }

    #[test]
    fn test_create_test_message() {
        let message = create_user_message("Hello");
        assert_eq!(message["role"], "user");
        assert_eq!(message["content"], "Hello");
    }

    #[test]
    fn test_create_chat_conversation() {
        let conv = create_chat_conversation(10);
        assert_eq!(conv.len(), 10);
        assert_eq!(conv[0]["role"], "user");
        assert_eq!(conv[1]["role"], "assistant");
    }
}

