//! # 聊天命令模块
//! 
//! 处理所有聊天相关的 Tauri 命令，与 Python API 服务器通信

use crate::create_command;
use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{commands::*, AppState, ZishuResult};
use crate::utils::bridge::{
    PythonApiBridge, ChatRequest, ChatMessage, MessageRole,
    ChatCompletionResponse, HistoryResponse, ClearHistoryResponse,
};

// ================================
// 命令元数据
// ================================

pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();
    
    metadata.insert(
        "send_message".to_string(),
        CommandMetadata {
            name: "send_message".to_string(),
            description: "发送聊天消息".to_string(),
            input_type: Some("SendMessageInput".to_string()),
            output_type: Some("ChatResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "chat".to_string(),
        },
    );
    
    metadata.insert(
        "get_chat_history".to_string(),
        CommandMetadata {
            name: "get_chat_history".to_string(),
            description: "获取聊天历史记录".to_string(),
            input_type: Some("GetHistoryInput".to_string()),
            output_type: Some("HistoryResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "chat".to_string(),
        },
    );
    
    metadata.insert(
        "clear_chat_history".to_string(),
        CommandMetadata {
            name: "clear_chat_history".to_string(),
            description: "清空聊天历史记录".to_string(),
            input_type: Some("ClearHistoryInput".to_string()),
            output_type: Some("ClearResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "chat".to_string(),
        },
    );
    
    metadata.insert(
        "set_chat_model".to_string(),
        CommandMetadata {
            name: "set_chat_model".to_string(),
            description: "设置聊天模型".to_string(),
            input_type: Some("SetModelInput".to_string()),
            output_type: Some("SetModelResponse".to_string()),
            required_permission: PermissionLevel::User,
            is_async: true,
            category: "chat".to_string(),
        },
    );
    
    metadata
}

// ================================
// 请求/响应数据结构
// ================================

/// 发送消息输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageInput {
    /// 消息内容
    pub message: String,
    /// 会话 ID（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// 模型 ID（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// 适配器 ID（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter: Option<String>,
    /// 角色 ID（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_id: Option<String>,
    /// 最大 token 数（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    /// 温度参数（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Top-P 参数（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    /// 是否流式传输（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    /// 上下文消息列表（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_messages: Option<Vec<ContextMessage>>,
}

/// 上下文消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMessage {
    pub role: String,
    pub content: String,
}

/// 聊天响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// 回复消息
    pub message: String,
    /// 会话 ID
    pub session_id: String,
    /// 消息 ID
    pub message_id: String,
    /// 模型名称
    pub model: String,
    /// 处理时间（秒）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processing_time: Option<f64>,
    /// Token 使用情况
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<TokenUsage>,
    /// 完成原因
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

/// Token 使用统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}

/// 获取历史输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetHistoryInput {
    /// 会话 ID
    pub session_id: String,
    /// 消息数量限制（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

/// 历史消息项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotion: Option<String>,
}

/// 历史响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryResponse {
    pub session_id: String,
    pub messages: Vec<HistoryMessage>,
    pub total_count: i32,
}

/// 清空历史输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearHistoryInput {
    /// 会话 ID
    pub session_id: String,
}

/// 清空历史响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearResponse {
    pub message: String,
    pub session_id: String,
}

/// 设置模型输入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetModelInput {
    /// 模型 ID
    pub model_id: String,
    /// 适配器 ID（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter_id: Option<String>,
    /// 额外配置（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<HashMap<String, serde_json::Value>>,
}

/// 设置模型响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetModelResponse {
    pub success: bool,
    pub model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter_id: Option<String>,
}

// ================================
// 命令处理器实现
// ================================

/// 发送消息处理器
pub async fn send_message_handler(
    input: SendMessageInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("send_message", Some(&serde_json::to_string(&input).unwrap_or_default()));
    
    // 验证输入
    if input.message.trim().is_empty() {
        return Err("消息内容不能为空".to_string());
    }
    
    if input.message.len() > 10000 {
        return Err("消息内容过长（最大 10000 字符）".to_string());
    }
    
    // 获取或创建 API 桥接客户端
    let bridge = PythonApiBridge::default().map_err(|e| {
        handle_command_error("send_message", &format!("创建 API 客户端失败: {}", e))
    })?;
    
    // 构建消息列表
    let mut messages = Vec::new();
    
    // 添加上下文消息
    if let Some(context_messages) = input.context_messages {
        for ctx_msg in context_messages {
            let role = match ctx_msg.role.to_lowercase().as_str() {
                "system" => MessageRole::System,
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "function" => MessageRole::Function,
                _ => MessageRole::User,
            };
            
            messages.push(ChatMessage {
                role,
                content: ctx_msg.content,
            });
        }
    }
    
    // 添加当前用户消息
    messages.push(ChatMessage {
        role: MessageRole::User,
        content: input.message.clone(),
    });
    
    // 构建请求
    let request = ChatRequest {
        messages,
        model: input.model.clone(),
        adapter: input.adapter.clone(),
        character_id: input.character_id.clone(),
        max_tokens: input.max_tokens,
        temperature: input.temperature,
        top_p: input.top_p,
        stream: input.stream,
        session_id: input.session_id.clone(),
    };
    
    // 发送请求到 Python API
    let response = bridge.send_chat_message(request).await.map_err(|e| {
        handle_command_error("send_message", &format!("发送消息失败: {}", e))
    })?;
    
    // 解析响应
    let choice = response.choices.first().ok_or_else(|| {
        "响应中没有选择项".to_string()
    })?;
    
    let chat_response = ChatResponse {
        message: choice.message.content.clone(),
        session_id: response.session_id.clone().unwrap_or_else(|| "default".to_string()),
        message_id: response.id.clone(),
        model: response.model.clone(),
        processing_time: choice.message.processing_time,
        usage: Some(TokenUsage {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
        }),
        finish_reason: choice.finish_reason.clone(),
    };
    
    // 返回 JSON 响应
    Ok(serde_json::to_value(chat_response).unwrap())
}

/// 获取聊天历史处理器
pub async fn get_chat_history_handler(
    input: GetHistoryInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("get_chat_history", Some(&input.session_id));
    
    // 验证输入
    if input.session_id.trim().is_empty() {
        return Err("会话 ID 不能为空".to_string());
    }
    
    // 获取 API 桥接客户端
    let bridge = PythonApiBridge::default().map_err(|e| {
        handle_command_error("get_chat_history", &format!("创建 API 客户端失败: {}", e))
    })?;
    
    // 获取历史记录
    let response = bridge.get_chat_history(&input.session_id, input.limit).await.map_err(|e| {
        handle_command_error("get_chat_history", &format!("获取历史记录失败: {}", e))
    })?;
    
    // 转换响应格式
    let messages: Vec<HistoryMessage> = response.messages.iter().map(|msg| {
        HistoryMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
            timestamp: None,
            emotion: msg.emotion.clone(),
        }
    }).collect();
    
    let history_response = ChatHistoryResponse {
        session_id: response.session_id.clone(),
        messages,
        total_count: response.total_count,
    };
    
    // 返回 JSON 响应
    Ok(serde_json::to_value(history_response).unwrap())
}

/// 清空聊天历史处理器
pub async fn clear_chat_history_handler(
    input: ClearHistoryInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("clear_chat_history", Some(&input.session_id));
    
    // 验证输入
    if input.session_id.trim().is_empty() {
        return Err("会话 ID 不能为空".to_string());
    }
    
    // 获取 API 桥接客户端
    let bridge = PythonApiBridge::default().map_err(|e| {
        handle_command_error("clear_chat_history", &format!("创建 API 客户端失败: {}", e))
    })?;
    
    // 清空历史记录
    let response = bridge.clear_chat_history(&input.session_id).await.map_err(|e| {
        handle_command_error("clear_chat_history", &format!("清空历史记录失败: {}", e))
    })?;
    
    let clear_response = ClearResponse {
        message: response.message,
        session_id: response.session_id,
    };
    
    // 返回 JSON 响应
    Ok(serde_json::to_value(clear_response).unwrap())
}

/// 设置聊天模型处理器
pub async fn set_chat_model_handler(
    input: SetModelInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> ZishuResult<serde_json::Value> {
    log_command_execution("set_chat_model", Some(&input.model_id));
    
    // 验证输入
    if input.model_id.trim().is_empty() {
        return Err("模型 ID 不能为空".to_string());
    }
    
    // 获取数据库实例
    let db = crate::database::get_database().ok_or_else(|| {
        handle_command_error("set_chat_model", "数据库未初始化")
    })?;
    
    // 查找或创建配置
    let config_id = format!("chat_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..16].to_string());
    
    // 从请求中提取配置参数
    let temperature = input.config.as_ref()
        .and_then(|c| c.get("temperature"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.7) as f32;
    
    let top_p = input.config.as_ref()
        .and_then(|c| c.get("top_p"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.9) as f32;
    
    let max_tokens = input.config.as_ref()
        .and_then(|c| c.get("max_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(2048) as u32;
    
    let frequency_penalty = input.config.as_ref()
        .and_then(|c| c.get("frequency_penalty"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0) as f32;
    
    let presence_penalty = input.config.as_ref()
        .and_then(|c| c.get("presence_penalty"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0) as f32;
    
    // 创建模型配置
    let model_config = crate::database::model_config::ModelConfigData {
        id: config_id.clone(),
        name: format!("聊天配置 - {}", input.model_id),
        model_id: input.model_id.clone(),
        adapter_id: input.adapter_id.clone(),
        temperature,
        top_p,
        top_k: None,
        max_tokens,
        frequency_penalty,
        presence_penalty,
        stop_sequences: vec![],
        is_default: false,
        is_enabled: true,
        description: Some("通过 set_chat_model 命令创建的配置".to_string()),
        extra_config: input.config.as_ref().map(|c| serde_json::to_string(c).unwrap()),
        created_at: chrono::Utc::now().timestamp(),
        updated_at: chrono::Utc::now().timestamp(),
    };
    
    // 保存配置到数据库
    db.model_config_registry.save_config(model_config.clone()).map_err(|e| {
        handle_command_error("set_chat_model", &format!("保存模型配置失败: {}", e))
    })?;
    
    // 更新应用状态中的模型配置
    let state_config = crate::state::ModelConfig {
        model_id: input.model_id.clone(),
        adapter_id: input.adapter_id.clone(),
        temperature,
        top_p,
        max_tokens,
    };
    state.chat.set_model_config(state_config);
    
    let response = SetModelResponse {
        success: true,
        model_id: input.model_id.clone(),
        adapter_id: input.adapter_id.clone(),
    };
    
    tracing::info!("聊天模型已设置并保存: {} (配置ID: {})", input.model_id, config_id);
    
    // 返回 JSON 响应
    Ok(serde_json::to_value(response).unwrap())
}

// ================================
// 命令注册宏调用
// ================================

// 发送消息命令
create_command!(send_message, SendMessageInput, send_message_handler);

// 获取聊天历史命令
create_command!(get_chat_history, GetHistoryInput, get_chat_history_handler);

// 清空聊天历史命令
create_command!(clear_chat_history, ClearHistoryInput, clear_chat_history_handler);

// 设置聊天模型命令
create_command!(set_chat_model, SetModelInput, set_chat_model_handler);

// ================================
// 辅助函数
// ================================

/// 生成会话 ID
pub fn generate_session_id() -> String {
    use uuid::Uuid;
    format!("session_{}", Uuid::new_v4().to_string().replace("-", "")[..16].to_string())
}

/// 验证会话 ID 格式
pub fn validate_session_id(session_id: &str) -> bool {
    !session_id.trim().is_empty() && session_id.len() <= 64
}

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_session_id() {
        let session_id = generate_session_id();
        assert!(session_id.starts_with("session_"));
        assert!(session_id.len() > 10);
    }

    #[test]
    fn test_validate_session_id() {
        assert!(validate_session_id("session_abc123"));
        assert!(!validate_session_id(""));
        assert!(!validate_session_id("   "));
    }

    #[test]
    fn test_send_message_input_serialization() {
        let input = SendMessageInput {
            message: "Hello".to_string(),
            session_id: Some("test_session".to_string()),
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            context_messages: None,
        };
        
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("Hello"));
        assert!(json.contains("test_session"));
    }
}
