//! # 认证命令模块
//! 
//! 提供用户认证相关的 Tauri 命令，包括：
//! - 登录/注册
//! - Token 管理（存储、获取、刷新）
//! - 用户信息获取
//! - 设备管理

use serde::{Deserialize, Serialize};
use tauri::State;
use std::collections::HashMap;
use crate::commands::{CommandMetadata, PermissionLevel, ZishuResult};

// ================================
// 类型定义
// ================================

/// 登录参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginParams {
    pub username: Option<String>,
    pub email: Option<String>,
    pub password: String,
    pub remember_me: Option<bool>,
}

/// 注册参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterParams {
    pub username: String,
    pub email: String,
    pub password: String,
    pub confirm_password: String,
    pub agree_to_terms: bool,
}

/// 认证响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
    pub user: UserInfo,
}

/// 用户信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub email: String,
    pub verified: bool,
    pub role: Option<String>,
    pub avatar: Option<String>,
}

// ================================
// Token 管理命令
// ================================

/// 保存访问令牌
#[tauri::command]
pub async fn save_auth_token(token: String) -> ZishuResult<()> {
    tracing::info!("🔐 保存访问令牌");
    
    // 使用 keyring 库安全存储 token
    match keyring::Entry::new("zishu-sensei", "auth_token") {
        Ok(entry) => {
            entry.set_password(&token)
                .map_err(|e| format!("保存令牌失败: {}", e))?;
            tracing::info!("✅ 访问令牌已保存");
            Ok(())
        }
        Err(e) => {
            tracing::error!("❌ 创建keyring条目失败: {}", e);
            Err(format!("创建存储条目失败: {}", e))
        }
    }
}

/// 获取访问令牌
#[tauri::command]
pub async fn get_auth_token() -> ZishuResult<String> {
    tracing::debug!("🔍 获取访问令牌");
    
    match keyring::Entry::new("zishu-sensei", "auth_token") {
        Ok(entry) => {
            match entry.get_password() {
                Ok(token) => {
                    tracing::debug!("✅ 访问令牌已获取");
                    Ok(token)
                }
                Err(keyring::Error::NoEntry) => {
                    tracing::debug!("ℹ️  未找到访问令牌");
                    Err("未找到访问令牌".to_string())
                }
                Err(e) => {
                    tracing::error!("❌ 获取令牌失败: {}", e);
                    Err(format!("获取令牌失败: {}", e))
                }
            }
        }
        Err(e) => {
            tracing::error!("❌ 创建keyring条目失败: {}", e);
            Err(format!("创建存储条目失败: {}", e))
        }
    }
}

/// 清除访问令牌
#[tauri::command]
pub async fn clear_auth_token() -> ZishuResult<()> {
    tracing::info!("🗑️  清除访问令牌");
    
    match keyring::Entry::new("zishu-sensei", "auth_token") {
        Ok(entry) => {
            match entry.delete_password() {
                Ok(_) | Err(keyring::Error::NoEntry) => {
                    tracing::info!("✅ 访问令牌已清除");
                    Ok(())
                }
                Err(e) => {
                    tracing::error!("❌ 清除令牌失败: {}", e);
                    Err(format!("清除令牌失败: {}", e))
                }
            }
        }
        Err(e) => {
            tracing::error!("❌ 创建keyring条目失败: {}", e);
            Err(format!("创建存储条目失败: {}", e))
        }
    }
}

/// 保存刷新令牌
#[tauri::command]
pub async fn save_refresh_token(token: String) -> ZishuResult<()> {
    tracing::info!("🔐 保存刷新令牌");
    
    match keyring::Entry::new("zishu-sensei", "refresh_token") {
        Ok(entry) => {
            entry.set_password(&token)
                .map_err(|e| format!("保存刷新令牌失败: {}", e))?;
            tracing::info!("✅ 刷新令牌已保存");
            Ok(())
        }
        Err(e) => {
            tracing::error!("❌ 创建keyring条目失败: {}", e);
            Err(format!("创建存储条目失败: {}", e))
        }
    }
}

/// 获取刷新令牌
#[tauri::command]
pub async fn get_refresh_token() -> ZishuResult<String> {
    tracing::debug!("🔍 获取刷新令牌");
    
    match keyring::Entry::new("zishu-sensei", "refresh_token") {
        Ok(entry) => {
            match entry.get_password() {
                Ok(token) => {
                    tracing::debug!("✅ 刷新令牌已获取");
                    Ok(token)
                }
                Err(keyring::Error::NoEntry) => {
                    tracing::debug!("ℹ️  未找到刷新令牌");
                    Err("未找到刷新令牌".to_string())
                }
                Err(e) => {
                    tracing::error!("❌ 获取刷新令牌失败: {}", e);
                    Err(format!("获取刷新令牌失败: {}", e))
                }
            }
        }
        Err(e) => {
            tracing::error!("❌ 创建keyring条目失败: {}", e);
            Err(format!("创建存储条目失败: {}", e))
        }
    }
}

/// 清除刷新令牌
#[tauri::command]
pub async fn clear_refresh_token() -> ZishuResult<()> {
    tracing::info!("🗑️  清除刷新令牌");
    
    match keyring::Entry::new("zishu-sensei", "refresh_token") {
        Ok(entry) => {
            match entry.delete_password() {
                Ok(_) | Err(keyring::Error::NoEntry) => {
                    tracing::info!("✅ 刷新令牌已清除");
                    Ok(())
                }
                Err(e) => {
                    tracing::error!("❌ 清除刷新令牌失败: {}", e);
                    Err(format!("清除刷新令牌失败: {}", e))
                }
            }
        }
        Err(e) => {
            tracing::error!("❌ 创建keyring条目失败: {}", e);
            Err(format!("创建存储条目失败: {}", e))
        }
    }
}

// ================================
// 设备信息命令
// ================================

/// 获取设备名称
#[tauri::command]
pub async fn get_device_name() -> ZishuResult<String> {
    let device_name = whoami::devicename();
    tracing::debug!("📱 设备名称: {}", device_name);
    Ok(device_name)
}

/// 获取设备ID
#[tauri::command]
pub async fn get_device_id() -> ZishuResult<String> {
    // 尝试从系统获取唯一ID，或生成一个持久化的ID
    match keyring::Entry::new("zishu-sensei", "device_id") {
        Ok(entry) => {
            match entry.get_password() {
                Ok(device_id) => {
                    tracing::debug!("📱 设备ID: {}", device_id);
                    Ok(device_id)
                }
                Err(keyring::Error::NoEntry) => {
                    // 生成新的设备ID
                    let device_id = uuid::Uuid::new_v4().to_string();
                    let _ = entry.set_password(&device_id);
                    tracing::info!("🆕 生成新的设备ID: {}", device_id);
                    Ok(device_id)
                }
                Err(e) => {
                    tracing::warn!("⚠️  获取设备ID失败，使用临时ID: {}", e);
                    Ok(uuid::Uuid::new_v4().to_string())
                }
            }
        }
        Err(e) => {
            tracing::warn!("⚠️  创建keyring条目失败，使用临时设备ID: {}", e);
            Ok(uuid::Uuid::new_v4().to_string())
        }
    }
}

/// 获取用户代理字符串
#[tauri::command]
pub async fn get_user_agent() -> ZishuResult<String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let version = env!("CARGO_PKG_VERSION");
    
    let user_agent = format!(
        "Zishu-Sensei-Desktop/{} ({}/{}) Tauri/1.5",
        version, os, arch
    );
    
    tracing::debug!("🌐 User Agent: {}", user_agent);
    Ok(user_agent)
}

// ================================
// 命令元数据
// ================================

pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();
    
    metadata.insert(
        "save_auth_token".to_string(),
        CommandMetadata {
            name: "save_auth_token".to_string(),
            description: "保存访问令牌到安全存储".to_string(),
            input_type: Some("String".to_string()),
            output_type: Some("()".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "auth".to_string(),
        },
    );
    
    metadata.insert(
        "get_auth_token".to_string(),
        CommandMetadata {
            name: "get_auth_token".to_string(),
            description: "从安全存储获取访问令牌".to_string(),
            input_type: None,
            output_type: Some("String".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "auth".to_string(),
        },
    );
    
    metadata.insert(
        "clear_auth_token".to_string(),
        CommandMetadata {
            name: "clear_auth_token".to_string(),
            description: "清除访问令牌".to_string(),
            input_type: None,
            output_type: Some("()".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "auth".to_string(),
        },
    );
    
    metadata.insert(
        "get_device_name".to_string(),
        CommandMetadata {
            name: "get_device_name".to_string(),
            description: "获取设备名称".to_string(),
            input_type: None,
            output_type: Some("String".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "auth".to_string(),
        },
    );
    
    metadata.insert(
        "get_device_id".to_string(),
        CommandMetadata {
            name: "get_device_id".to_string(),
            description: "获取设备唯一ID".to_string(),
            input_type: None,
            output_type: Some("String".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "auth".to_string(),
        },
    );
    
    metadata
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_login_params_serialization() {
        let params = LoginParams {
            username: Some("testuser".to_string()),
            email: Some("test@example.com".to_string()),
            password: "password123".to_string(),
            remember_me: Some(true),
        };
        
        let json = serde_json::to_string(&params).unwrap();
        assert!(json.contains("testuser"));
        assert!(json.contains("test@example.com"));
    }

    #[test]
    fn test_register_params_validation() {
        let params = RegisterParams {
            username: "newuser".to_string(),
            email: "new@example.com".to_string(),
            password: "securepass123".to_string(),
            confirm_password: "securepass123".to_string(),
            agree_to_terms: true,
        };
        
        assert_eq!(params.password, params.confirm_password);
        assert!(params.agree_to_terms);
    }
}
