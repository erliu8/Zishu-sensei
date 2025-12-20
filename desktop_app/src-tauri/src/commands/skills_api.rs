//! Skills API 命令
//! 通过 HTTP 调用 Python 后端服务

use crate::commands::{CommandMetadata, PermissionLevel};
use crate::http::skills_client::SkillsApiClient;
use crate::state::AppState;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use tauri::State;
use tracing::{debug, error, info};

/// 获取 Skills API 客户端
fn get_skills_client(state: &AppState) -> Result<SkillsApiClient, String> {
    // 从配置或环境变量读取 API 地址，Skills 使用核心服务
    let api_url = std::env::var("ZISHU_API_URL")
        .unwrap_or_else(|_| {
            let router = crate::config::ApiRouter::new();
            router.core_url()
        });

    let mut client = SkillsApiClient::new(api_url)
        .map_err(|e| format!("创建 API 客户端失败: {}", e))?;

    // TODO: 从状态中获取认证令牌
    // client.set_auth_token(state.auth_token.clone());

    Ok(client)
}

// ================================
// Skills 执行操作
// ================================

/// 执行 Skill
#[tauri::command]
pub async fn api_execute_skill(
    state: State<'_, AppState>,
    package_id: String,
    payload: JsonValue,
) -> Result<JsonValue, String> {
    info!("API: 执行 Skill - {}", package_id);

    let client = get_skills_client(&state)?;

    client
        .execute_skill(&package_id, payload)
        .await
        .map_err(|e| format!("执行 Skill 失败: {}", e))
}

// ================================
// 健康检查
// ================================

/// 检查 Python API 服务健康状态
#[tauri::command]
pub async fn api_skills_health_check(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    debug!("API: Skills 健康检查");

    let client = get_skills_client(&state)?;

    client
        .health_check()
        .await
        .map_err(|e| format!("健康检查失败: {}", e))
}

// ================================
// 命令元数据
// ================================

/// 获取 Skills API 命令元数据
pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();

    // 执行 Skill 命令
    metadata.insert(
        "api_execute_skill".to_string(),
        CommandMetadata {
            name: "api_execute_skill".to_string(),
            description: "执行指定的 Skill".to_string(),
            input_type: Some("ExecuteSkillRequest".to_string()),
            output_type: Some("JsonValue".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "skills".to_string(),
        },
    );

    // Skills 健康检查命令
    metadata.insert(
        "api_skills_health_check".to_string(),
        CommandMetadata {
            name: "api_skills_health_check".to_string(),
            description: "检查 Skills API 服务健康状态".to_string(),
            input_type: None,
            output_type: Some("bool".to_string()),
            required_permission: PermissionLevel::Public,
            is_async: true,
            category: "skills".to_string(),
        },
    );

    metadata
}