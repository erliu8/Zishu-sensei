//! 权限管理 Tauri 命令
//!
//! 提供前端调用的权限管理 API，包括：
//! - 权限定义查询
//! - 权限授权管理
//! - 权限检查验证
//! - 权限使用记录
//! - 权限统计分析

use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

use crate::{
    commands::*,
    state::AppState,
    database::{
        get_database,
        permission::{
            Permission, PermissionGrant, PermissionUsageLog, PermissionGroup,
            PermissionStats, PermissionType, PermissionLevel, PermissionStatus,
        },
    },
};

// ================================
// 请求/响应数据结构
// ================================

/// 权限请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRequest {
    /// 实体类型
    pub entity_type: String,
    /// 实体ID
    pub entity_id: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 权限级别
    pub level: PermissionLevel,
    /// 权限范围
    pub scope: Option<String>,
}

/// 权限授予请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGrantRequest {
    /// 实体类型
    pub entity_type: String,
    /// 实体ID
    pub entity_id: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 权限级别
    pub level: PermissionLevel,
    /// 权限范围
    pub scope: Option<String>,
    /// 授权者
    pub granted_by: Option<String>,
    /// 过期时间（ISO 8601格式）
    pub expires_at: Option<String>,
}

/// 权限撤销/拒绝请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRevokeRequest {
    /// 实体类型
    pub entity_type: String,
    /// 实体ID
    pub entity_id: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 权限范围
    pub scope: Option<String>,
    /// 原因
    pub reason: Option<String>,
}

/// 权限检查请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionCheckRequest {
    /// 实体类型
    pub entity_type: String,
    /// 实体ID
    pub entity_id: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 权限级别
    pub level: PermissionLevel,
    /// 权限范围
    pub scope: Option<String>,
}

/// 权限使用日志请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionUsageLogRequest {
    /// 实体类型
    pub entity_type: String,
    /// 实体ID
    pub entity_id: String,
    /// 权限类型
    pub permission_type: PermissionType,
    /// 权限级别
    pub level: PermissionLevel,
    /// 访问的资源
    pub resource: Option<String>,
    /// 操作描述
    pub action: String,
    /// 是否成功
    pub success: bool,
    /// 失败原因
    pub failure_reason: Option<String>,
    /// IP地址
    pub ip_address: Option<String>,
    /// 额外元数据
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// 权限组创建请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGroupRequest {
    /// 组名
    pub name: String,
    /// 显示名称
    pub display_name: String,
    /// 描述
    pub description: String,
    /// 权限列表
    pub permissions: Vec<PermissionType>,
}

/// 批量授予权限组请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrantPermissionGroupRequest {
    /// 实体类型
    pub entity_type: String,
    /// 实体ID
    pub entity_id: String,
    /// 组名
    pub group_name: String,
    /// 权限级别
    pub level: PermissionLevel,
    /// 授权者
    pub granted_by: Option<String>,
    /// 过期时间
    pub expires_at: Option<String>,
}

// ================================
// 权限定义查询命令
// ================================

/// 获取所有权限定义
#[tauri::command]
pub async fn get_all_permissions(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<Permission>>, String> {
    info!("获取所有权限定义");
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.get_all_permissions() {
        Ok(permissions) => {
            info!("成功获取 {} 个权限定义", permissions.len());
            Ok(CommandResponse::success(permissions))
        }
        Err(e) => {
            error!("获取权限定义失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限定义失败: {}", e)))
        }
    }
}

/// 获取指定类型的权限定义
#[tauri::command]
pub async fn get_permission_by_type(
    permission_type: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Option<Permission>>, String> {
    info!("获取权限定义: {}", permission_type);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    let ptype: PermissionType = permission_type.parse()
        .map_err(|e: String| format!("无效的权限类型: {}", e))?;
    
    match db.permission_registry.get_permission_by_type(&ptype) {
        Ok(permission) => {
            Ok(CommandResponse::success(permission))
        }
        Err(e) => {
            error!("获取权限定义失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限定义失败: {}", e)))
        }
    }
}

/// 获取分类的权限列表
#[tauri::command]
pub async fn get_permissions_by_category(
    category: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<Permission>>, String> {
    info!("获取分类权限: {}", category);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.get_permissions_by_category(&category) {
        Ok(permissions) => {
            info!("成功获取 {} 个 {} 分类的权限", permissions.len(), category);
            Ok(CommandResponse::success(permissions))
        }
        Err(e) => {
            error!("获取分类权限失败: {}", e);
            Ok(CommandResponse::error(format!("获取分类权限失败: {}", e)))
        }
    }
}

// ================================
// 权限授权管理命令
// ================================

/// 请求权限
#[tauri::command]
pub async fn request_permission(
    request: PermissionRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<i64>, String> {
    info!(
        "请求权限: {} - {} - {}",
        request.entity_id, request.permission_type, request.level
    );
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.request_permission(
        request.entity_type,
        request.entity_id.clone(),
        request.permission_type.clone(),
        request.level,
        request.scope,
    ) {
        Ok(id) => {
            info!("权限请求成功，ID: {}", id);
            
            // 触发权限请求事件，通知前端显示授权对话框
            let _ = app_handle.emit_all("permission-request", serde_json::json!({
                "id": id,
                "entity_id": request.entity_id,
                "permission_type": request.permission_type,
                "level": request.level,
            }));
            
            Ok(CommandResponse::success_with_message(
                id,
                "权限请求已提交".to_string(),
            ))
        }
        Err(e) => {
            error!("权限请求失败: {}", e);
            Ok(CommandResponse::error(format!("权限请求失败: {}", e)))
        }
    }
}

/// 授予权限
#[tauri::command]
pub async fn grant_permission(
    request: PermissionGrantRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!(
        "授予权限: {} - {} - {}",
        request.entity_id, request.permission_type, request.level
    );
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    // 解析过期时间
    let expires_at = request.expires_at
        .as_ref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));
    
    match db.permission_registry.grant_permission(
        request.entity_type.clone(),
        request.entity_id.clone(),
        request.permission_type.clone(),
        request.level,
        request.scope.clone(),
        request.granted_by,
        expires_at,
    ) {
        Ok(_) => {
            info!("权限授予成功");
            
            // 记录审计日志
            if let Err(e) = crate::utils::security_audit::log_security_event(
                "permission_granted",
                Some(&request.entity_id),
                Some(format!(
                    "授予权限: {} (级别: {})",
                    request.permission_type, request.level
                )),
                "high",
                None,
            ) {
                warn!("记录审计日志失败: {}", e);
            }
            
            // 触发权限授予事件
            let _ = app_handle.emit_all("permission-granted", serde_json::json!({
                "entity_type": request.entity_type,
                "entity_id": request.entity_id,
                "permission_type": request.permission_type,
                "level": request.level,
                "scope": request.scope,
            }));
            
            Ok(CommandResponse::success_with_message(
                true,
                "权限已授予".to_string(),
            ))
        }
        Err(e) => {
            error!("授予权限失败: {}", e);
            Ok(CommandResponse::error(format!("授予权限失败: {}", e)))
        }
    }
}

/// 拒绝权限
#[tauri::command]
pub async fn deny_permission(
    request: PermissionRevokeRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("拒绝权限: {} - {}", request.entity_id, request.permission_type);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.deny_permission(
        request.entity_type.clone(),
        request.entity_id.clone(),
        request.permission_type.clone(),
        request.scope.clone(),
        request.reason.clone(),
    ) {
        Ok(_) => {
            info!("权限已拒绝");
            
            // 记录审计日志
            if let Err(e) = crate::utils::security_audit::log_security_event(
                "permission_denied",
                Some(&request.entity_id),
                Some(format!(
                    "拒绝权限: {} (原因: {})",
                    request.permission_type,
                    request.reason.as_deref().unwrap_or("未提供原因")
                )),
                "medium",
                None,
            ) {
                warn!("记录审计日志失败: {}", e);
            }
            
            // 触发权限拒绝事件
            let _ = app_handle.emit_all("permission-denied", serde_json::json!({
                "entity_type": request.entity_type,
                "entity_id": request.entity_id,
                "permission_type": request.permission_type,
                "reason": request.reason,
            }));
            
            Ok(CommandResponse::success_with_message(
                true,
                "权限已拒绝".to_string(),
            ))
        }
        Err(e) => {
            error!("拒绝权限失败: {}", e);
            Ok(CommandResponse::error(format!("拒绝权限失败: {}", e)))
        }
    }
}

/// 撤销权限
#[tauri::command]
pub async fn revoke_permission(
    request: PermissionRevokeRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!("撤销权限: {} - {}", request.entity_id, request.permission_type);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.revoke_permission(
        request.entity_type.clone(),
        request.entity_id.clone(),
        request.permission_type.clone(),
        request.scope.clone(),
        request.reason.clone(),
    ) {
        Ok(_) => {
            info!("权限已撤销");
            
            // 记录审计日志
            if let Err(e) = crate::utils::security_audit::log_security_event(
                "permission_revoked",
                Some(&request.entity_id),
                Some(format!(
                    "撤销权限: {} (原因: {})",
                    request.permission_type,
                    request.reason.as_deref().unwrap_or("未提供原因")
                )),
                "high",
                None,
            ) {
                warn!("记录审计日志失败: {}", e);
            }
            
            // 触发权限撤销事件
            let _ = app_handle.emit_all("permission-revoked", serde_json::json!({
                "entity_type": request.entity_type,
                "entity_id": request.entity_id,
                "permission_type": request.permission_type,
                "reason": request.reason,
            }));
            
            Ok(CommandResponse::success_with_message(
                true,
                "权限已撤销".to_string(),
            ))
        }
        Err(e) => {
            error!("撤销权限失败: {}", e);
            Ok(CommandResponse::error(format!("撤销权限失败: {}", e)))
        }
    }
}

/// 检查权限
#[tauri::command]
pub async fn check_permission(
    request: PermissionCheckRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.check_permission(
        &request.entity_type,
        &request.entity_id,
        &request.permission_type,
        &request.level,
        request.scope.as_deref(),
    ) {
        Ok(granted) => {
            Ok(CommandResponse::success(granted))
        }
        Err(e) => {
            error!("检查权限失败: {}", e);
            Ok(CommandResponse::error(format!("检查权限失败: {}", e)))
        }
    }
}

/// 获取实体的所有权限授权
#[tauri::command]
pub async fn get_entity_grants(
    entity_type: String,
    entity_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<PermissionGrant>>, String> {
    info!("获取实体权限授权: {} - {}", entity_type, entity_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.get_entity_grants(&entity_type, &entity_id) {
        Ok(grants) => {
            info!("成功获取 {} 个权限授权", grants.len());
            Ok(CommandResponse::success(grants))
        }
        Err(e) => {
            error!("获取权限授权失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限授权失败: {}", e)))
        }
    }
}

/// 获取待审核的权限请求
#[tauri::command]
pub async fn get_pending_grants(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<PermissionGrant>>, String> {
    info!("获取待审核的权限请求");
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.get_pending_grants() {
        Ok(grants) => {
            info!("成功获取 {} 个待审核权限", grants.len());
            Ok(CommandResponse::success(grants))
        }
        Err(e) => {
            error!("获取待审核权限失败: {}", e);
            Ok(CommandResponse::error(format!("获取待审核权限失败: {}", e)))
        }
    }
}

/// 清理过期的权限授权
#[tauri::command]
pub async fn cleanup_expired_grants(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<usize>, String> {
    info!("清理过期的权限授权");
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.cleanup_expired_grants() {
        Ok(count) => {
            info!("清理了 {} 个过期的权限授权", count);
            Ok(CommandResponse::success_with_message(
                count,
                format!("清理了 {} 个过期的权限", count),
            ))
        }
        Err(e) => {
            error!("清理过期权限失败: {}", e);
            Ok(CommandResponse::error(format!("清理过期权限失败: {}", e)))
        }
    }
}

// ================================
// 权限使用日志命令
// ================================

/// 记录权限使用
#[tauri::command]
pub async fn log_permission_usage(
    log_request: PermissionUsageLogRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<i64>, String> {
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.log_permission_usage(
        log_request.entity_type,
        log_request.entity_id,
        log_request.permission_type,
        log_request.level,
        log_request.resource,
        log_request.action,
        log_request.success,
        log_request.failure_reason,
        log_request.ip_address,
        log_request.metadata,
    ) {
        Ok(id) => {
            Ok(CommandResponse::success(id))
        }
        Err(e) => {
            error!("记录权限使用失败: {}", e);
            Ok(CommandResponse::error(format!("记录权限使用失败: {}", e)))
        }
    }
}

/// 获取权限使用日志
#[tauri::command]
pub async fn get_permission_usage_logs(
    entity_type: Option<String>,
    entity_id: Option<String>,
    permission_type: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<PermissionUsageLog>>, String> {
    info!("获取权限使用日志");
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    let ptype = permission_type
        .as_ref()
        .map(|s| s.parse::<PermissionType>())
        .transpose()
        .map_err(|e: String| format!("无效的权限类型: {}", e))?;
    
    match db.permission_registry.get_usage_logs(
        entity_type.as_deref(),
        entity_id.as_deref(),
        ptype.as_ref(),
        limit,
        offset,
    ) {
        Ok(logs) => {
            info!("成功获取 {} 条权限使用日志", logs.len());
            Ok(CommandResponse::success(logs))
        }
        Err(e) => {
            error!("获取权限使用日志失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限使用日志失败: {}", e)))
        }
    }
}

/// 获取权限统计信息
#[tauri::command]
pub async fn get_permission_stats(
    entity_type: String,
    entity_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<PermissionStats>, String> {
    info!("获取权限统计: {} - {}", entity_type, entity_id);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.get_permission_stats(&entity_type, &entity_id) {
        Ok(stats) => {
            Ok(CommandResponse::success(stats))
        }
        Err(e) => {
            error!("获取权限统计失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限统计失败: {}", e)))
        }
    }
}

// ================================
// 权限组管理命令
// ================================

/// 创建权限组
#[tauri::command]
pub async fn create_permission_group(
    request: PermissionGroupRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<i64>, String> {
    info!("创建权限组: {}", request.name);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.create_permission_group(
        request.name,
        request.display_name,
        request.description,
        request.permissions,
    ) {
        Ok(id) => {
            info!("权限组创建成功，ID: {}", id);
            Ok(CommandResponse::success_with_message(
                id,
                "权限组已创建".to_string(),
            ))
        }
        Err(e) => {
            error!("创建权限组失败: {}", e);
            Ok(CommandResponse::error(format!("创建权限组失败: {}", e)))
        }
    }
}

/// 获取权限组
#[tauri::command]
pub async fn get_permission_group(
    name: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Option<PermissionGroup>>, String> {
    info!("获取权限组: {}", name);
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.get_permission_group(&name) {
        Ok(group) => {
            Ok(CommandResponse::success(group))
        }
        Err(e) => {
            error!("获取权限组失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限组失败: {}", e)))
        }
    }
}

/// 获取所有权限组
#[tauri::command]
pub async fn get_all_permission_groups(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<Vec<PermissionGroup>>, String> {
    info!("获取所有权限组");
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    match db.permission_registry.get_all_permission_groups() {
        Ok(groups) => {
            info!("成功获取 {} 个权限组", groups.len());
            Ok(CommandResponse::success(groups))
        }
        Err(e) => {
            error!("获取权限组列表失败: {}", e);
            Ok(CommandResponse::error(format!("获取权限组列表失败: {}", e)))
        }
    }
}

/// 授予权限组
#[tauri::command]
pub async fn grant_permission_group(
    request: GrantPermissionGroupRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommandResponse<bool>, String> {
    info!(
        "授予权限组: {} - {}",
        request.entity_id, request.group_name
    );
    
    let db = get_database().ok_or("数据库未初始化")?;
    
    // 解析过期时间
    let expires_at = request.expires_at
        .as_ref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));
    
    match db.permission_registry.grant_permission_group(
        request.entity_type,
        request.entity_id.clone(),
        &request.group_name,
        request.level,
        request.granted_by,
        expires_at,
    ) {
        Ok(_) => {
            info!("权限组授予成功");
            
            // 记录审计日志
            if let Err(e) = crate::utils::security_audit::log_security_event(
                "permission_group_granted",
                Some(&request.entity_id),
                Some(format!("授予权限组: {}", request.group_name)),
                "high",
                None,
            ) {
                warn!("记录审计日志失败: {}", e);
            }
            
            Ok(CommandResponse::success_with_message(
                true,
                "权限组已授予".to_string(),
            ))
        }
        Err(e) => {
            error!("授予权限组失败: {}", e);
            Ok(CommandResponse::error(format!("授予权限组失败: {}", e)))
        }
    }
}

