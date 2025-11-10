//! 权限检查和拦截器
//!
//! 提供运行时权限检查和操作拦截功能，确保：
//! - 所有敏感操作都经过权限验证
//! - 未授权的操作被拦截
//! - 权限使用被记录
//! - 提供便捷的权限检查宏

use std::collections::HashMap;

use crate::database::{
    get_database,
    permission::{PermissionType, PermissionLevel},
};

// ================================
// 权限检查器
// ================================

/// 权限检查器
pub struct PermissionChecker;

impl PermissionChecker {
    /// 检查并记录权限使用
    ///
    /// 如果权限未授予，返回 Err
    /// 如果权限已授予，记录使用并返回 Ok
    pub fn check_and_log(
        entity_type: &str,
        entity_id: &str,
        permission_type: PermissionType,
        level: PermissionLevel,
        resource: Option<String>,
        action: String,
    ) -> Result<(), String> {
        let db = get_database().ok_or("数据库未初始化")?;

        // 检查权限
        let granted = db
            .permission_registry
            .check_permission(entity_type, entity_id, &permission_type, &level, None)
            .map_err(|e| format!("权限检查失败: {}", e))?;

        if !granted {
            // 记录失败的权限使用
            let _ = db.permission_registry.log_permission_usage(
                entity_type.to_string(),
                entity_id.to_string(),
                permission_type.clone(),
                level.clone(),
                resource.clone(),
                action.clone(),
                false,
                Some("权限未授予".to_string()),
                None,
                None,
            );

            // 记录安全审计日志
            crate::utils::security_audit::log_audit_failure(
                crate::utils::security_audit::AuditEventType::PermissionGrant,
                &format!(
                    "尝试使用未授予的权限: {} - {} (资源: {})",
                    permission_type,
                    action,
                    resource.as_deref().unwrap_or("无")
                ),
                "权限未授予",
                Some(entity_id),
            );

            return Err(format!(
                "权限不足: 需要 {} 权限 (级别: {})",
                permission_type, level
            ));
        }

        // 记录成功的权限使用
        let _ = db.permission_registry.log_permission_usage(
            entity_type.to_string(),
            entity_id.to_string(),
            permission_type,
            level,
            resource,
            action,
            true,
            None,
            None,
            None,
        );

        Ok(())
    }

    /// 检查权限（不记录日志）
    pub fn check(
        entity_type: &str,
        entity_id: &str,
        permission_type: &PermissionType,
        level: &PermissionLevel,
    ) -> Result<bool, String> {
        let db = get_database().ok_or("数据库未初始化")?;

        db.permission_registry
            .check_permission(entity_type, entity_id, permission_type, level, None)
            .map_err(|e| format!("权限检查失败: {}", e))
    }

    /// 检查权限（带范围）
    pub fn check_with_scope(
        entity_type: &str,
        entity_id: &str,
        permission_type: &PermissionType,
        level: &PermissionLevel,
        scope: Option<&str>,
    ) -> Result<bool, String> {
        let db = get_database().ok_or("数据库未初始化")?;

        db.permission_registry
            .check_permission(entity_type, entity_id, permission_type, level, scope)
            .map_err(|e| format!("权限检查失败: {}", e))
    }

    /// 确保权限（如果未授予则返回错误）
    pub fn ensure(
        entity_type: &str,
        entity_id: &str,
        permission_type: &PermissionType,
        level: &PermissionLevel,
    ) -> Result<(), String> {
        let granted = Self::check(entity_type, entity_id, permission_type, level)?;

        if !granted {
            return Err(format!(
                "权限不足: 需要 {} 权限 (级别: {})",
                permission_type, level
            ));
        }

        Ok(())
    }

    /// 批量检查权限（所有权限都必须授予）
    pub fn check_all(
        entity_type: &str,
        entity_id: &str,
        permissions: &[(PermissionType, PermissionLevel)],
    ) -> Result<bool, String> {
        for (ptype, level) in permissions {
            let granted = Self::check(entity_type, entity_id, ptype, level)?;
            if !granted {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// 批量检查权限（任一权限授予即可）
    pub fn check_any(
        entity_type: &str,
        entity_id: &str,
        permissions: &[(PermissionType, PermissionLevel)],
    ) -> Result<bool, String> {
        for (ptype, level) in permissions {
            let granted = Self::check(entity_type, entity_id, ptype, level)?;
            if granted {
                return Ok(true);
            }
        }
        Ok(false)
    }
}

// ================================
// 文件系统权限检查
// ================================

/// 文件系统权限检查器
pub struct FileSystemChecker;

impl FileSystemChecker {
    /// 检查文件读取权限
    pub fn check_read(entity_type: &str, entity_id: &str, path: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            Some(path.to_string()),
            "read_file".to_string(),
        )
    }

    /// 检查文件写入权限
    pub fn check_write(entity_type: &str, entity_id: &str, path: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::FileWrite,
            PermissionLevel::ReadWrite,
            Some(path.to_string()),
            "write_file".to_string(),
        )
    }

    /// 检查文件删除权限
    pub fn check_delete(entity_type: &str, entity_id: &str, path: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::FileDelete,
            PermissionLevel::Admin,
            Some(path.to_string()),
            "delete_file".to_string(),
        )
    }

    /// 检查文件执行权限
    pub fn check_execute(entity_type: &str, entity_id: &str, path: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::FileExecute,
            PermissionLevel::Admin,
            Some(path.to_string()),
            "execute_file".to_string(),
        )
    }

    /// 检查文件监听权限
    pub fn check_watch(entity_type: &str, entity_id: &str, path: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::FileWatch,
            PermissionLevel::ReadOnly,
            Some(path.to_string()),
            "watch_file".to_string(),
        )
    }
}

// ================================
// 网络权限检查
// ================================

/// 网络权限检查器
pub struct NetworkChecker;

impl NetworkChecker {
    /// 检查HTTP请求权限
    pub fn check_http(entity_type: &str, entity_id: &str, url: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::NetworkHttp,
            PermissionLevel::ReadOnly,
            Some(url.to_string()),
            "http_request".to_string(),
        )
    }

    /// 检查WebSocket权限
    pub fn check_websocket(entity_type: &str, entity_id: &str, url: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::NetworkWebSocket,
            PermissionLevel::ReadWrite,
            Some(url.to_string()),
            "websocket_connect".to_string(),
        )
    }

    /// 检查原始Socket权限
    pub fn check_socket(
        entity_type: &str,
        entity_id: &str,
        address: &str,
    ) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::NetworkSocket,
            PermissionLevel::Admin,
            Some(address.to_string()),
            "socket_connect".to_string(),
        )
    }

    /// 检查DNS查询权限
    pub fn check_dns(entity_type: &str, entity_id: &str, domain: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::NetworkDns,
            PermissionLevel::ReadOnly,
            Some(domain.to_string()),
            "dns_query".to_string(),
        )
    }
}

// ================================
// 系统权限检查
// ================================

/// 系统权限检查器
pub struct SystemChecker;

impl SystemChecker {
    /// 检查系统命令执行权限
    pub fn check_command(
        entity_type: &str,
        entity_id: &str,
        command: &str,
    ) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::SystemCommand,
            PermissionLevel::Admin,
            Some(command.to_string()),
            "execute_command".to_string(),
        )
    }

    /// 检查环境变量访问权限
    pub fn check_env(entity_type: &str, entity_id: &str, var_name: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::SystemEnv,
            PermissionLevel::ReadOnly,
            Some(var_name.to_string()),
            "read_env".to_string(),
        )
    }

    /// 检查系统信息访问权限
    pub fn check_system_info(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::SystemInfo,
            PermissionLevel::ReadOnly,
            None,
            "get_system_info".to_string(),
        )
    }

    /// 检查剪贴板访问权限
    pub fn check_clipboard(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::SystemClipboard,
            PermissionLevel::ReadWrite,
            None,
            "access_clipboard".to_string(),
        )
    }

    /// 检查通知权限
    pub fn check_notification(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::SystemNotification,
            PermissionLevel::ReadWrite,
            None,
            "show_notification".to_string(),
        )
    }
}

// ================================
// 应用权限检查
// ================================

/// 应用权限检查器
pub struct AppChecker;

impl AppChecker {
    /// 检查数据库访问权限
    pub fn check_database(
        entity_type: &str,
        entity_id: &str,
        table: Option<&str>,
    ) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::AppDatabase,
            PermissionLevel::ReadWrite,
            table.map(|t| t.to_string()),
            "access_database".to_string(),
        )
    }

    /// 检查配置修改权限
    pub fn check_config(entity_type: &str, entity_id: &str, key: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::AppConfig,
            PermissionLevel::ReadWrite,
            Some(key.to_string()),
            "modify_config".to_string(),
        )
    }

    /// 检查聊天历史访问权限
    pub fn check_chat_history(
        entity_type: &str,
        entity_id: &str,
        session_id: Option<&str>,
    ) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::AppChatHistory,
            PermissionLevel::ReadOnly,
            session_id.map(|s| s.to_string()),
            "access_chat_history".to_string(),
        )
    }

    /// 检查用户数据访问权限
    pub fn check_user_data(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::AppUserData,
            PermissionLevel::ReadOnly,
            None,
            "access_user_data".to_string(),
        )
    }

    /// 检查适配器调用权限
    pub fn check_adapter(
        entity_type: &str,
        entity_id: &str,
        target_adapter: &str,
    ) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::AppAdapter,
            PermissionLevel::ReadWrite,
            Some(target_adapter.to_string()),
            "call_adapter".to_string(),
        )
    }
}

// ================================
// 硬件权限检查
// ================================

/// 硬件权限检查器
pub struct HardwareChecker;

impl HardwareChecker {
    /// 检查摄像头访问权限
    pub fn check_camera(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::HardwareCamera,
            PermissionLevel::ReadWrite,
            None,
            "access_camera".to_string(),
        )
    }

    /// 检查麦克风访问权限
    pub fn check_microphone(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::HardwareMicrophone,
            PermissionLevel::ReadWrite,
            None,
            "access_microphone".to_string(),
        )
    }

    /// 检查屏幕录制权限
    pub fn check_screen_capture(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::HardwareScreenCapture,
            PermissionLevel::ReadWrite,
            None,
            "screen_capture".to_string(),
        )
    }

    /// 检查地理位置权限
    pub fn check_location(entity_type: &str, entity_id: &str) -> Result<(), String> {
        PermissionChecker::check_and_log(
            entity_type,
            entity_id,
            PermissionType::HardwareLocation,
            PermissionLevel::ReadOnly,
            None,
            "get_location".to_string(),
        )
    }
}

// ================================
// 便捷宏
// ================================

/// 检查权限宏
///
/// 使用示例:
/// ```
/// check_permission!("adapter", "my-adapter-id", PermissionType::FileRead, PermissionLevel::ReadOnly)?;
/// ```
#[macro_export]
macro_rules! check_permission {
    ($entity_type:expr, $entity_id:expr, $permission_type:expr, $level:expr) => {
        $crate::utils::permission_checker::PermissionChecker::ensure(
            $entity_type,
            $entity_id,
            &$permission_type,
            &$level,
        )
    };
}

/// 检查并记录权限使用宏
///
/// 使用示例:
/// ```
/// check_and_log_permission!(
///     "adapter", "my-adapter-id",
///     PermissionType::FileRead, PermissionLevel::ReadOnly,
///     Some("/path/to/file".to_string()),
///     "read_config".to_string()
/// )?;
/// ```
#[macro_export]
macro_rules! check_and_log_permission {
    ($entity_type:expr, $entity_id:expr, $permission_type:expr, $level:expr, $resource:expr, $action:expr) => {
        $crate::utils::permission_checker::PermissionChecker::check_and_log(
            $entity_type,
            $entity_id,
            $permission_type,
            $level,
            $resource,
            $action,
        )
    };
}

// ================================
// 权限装饰器辅助
// ================================

/// 权限守卫结果
pub type PermissionGuardResult<T> = Result<T, String>;

/// 带权限检查的函数执行器
pub fn with_permission<F, T>(
    entity_type: &str,
    entity_id: &str,
    permission_type: PermissionType,
    level: PermissionLevel,
    action: String,
    func: F,
) -> PermissionGuardResult<T>
where
    F: FnOnce() -> Result<T, String>,
{
    // 检查权限
    PermissionChecker::ensure(entity_type, entity_id, &permission_type, &level)?;

    // 记录权限使用（开始）
    let start_time = std::time::Instant::now();

    // 执行函数
    let result = func();

    // 记录权限使用（完成）
    let elapsed = start_time.elapsed();
    let success = result.is_ok();
    let failure_reason = if let Err(ref e) = result {
        Some(e.clone())
    } else {
        None
    };

    let db = get_database();
    if let Some(db) = db {
        let mut metadata = HashMap::new();
        metadata.insert(
            "duration_ms".to_string(),
            serde_json::json!(elapsed.as_millis()),
        );

        let _ = db.permission_registry.log_permission_usage(
            entity_type.to_string(),
            entity_id.to_string(),
            permission_type,
            level,
            None,
            action,
            success,
            failure_reason,
            None,
            Some(metadata),
        );
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_checker() {
        // 这里只是测试编译，实际测试需要数据库
        let result = PermissionChecker::check(
            "adapter",
            "test-adapter",
            &PermissionType::FileRead,
            &PermissionLevel::ReadOnly,
        );
        // 由于没有数据库，这里会失败
        assert!(result.is_err());
    }
}

