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
    use std::collections::HashMap;
    use serde_json::json;

    // ================================
    // 工具函数测试
    // ================================

    #[test]
    fn test_generate_session_id() {
        // Arrange - 准备测试数据
        
        // Act - 执行被测试的操作
        let session_id = generate_session_id();
        
        // Assert - 验证结果
        assert!(session_id.starts_with("session_"));
        assert!(session_id.len() > 10);
    }

    #[test]
    fn test_generate_session_id_uniqueness() {
        // Arrange & Act
        let id1 = generate_session_id();
        let id2 = generate_session_id();
        
        // Assert
        assert_ne!(id1, id2, "生成的会话ID应该是唯一的");
    }

    #[test]
    fn test_validate_session_id_valid_cases() {
        // Arrange & Act & Assert
        assert!(validate_session_id("session_abc123"));
        assert!(validate_session_id("valid_session_id"));
        assert!(validate_session_id("123"));
        assert!(validate_session_id("a"));
    }

    #[test]
    fn test_validate_session_id_invalid_cases() {
        // Arrange & Act & Assert
        assert!(!validate_session_id(""));
        assert!(!validate_session_id("   "));
        assert!(!validate_session_id("\t\n"));
        
        // 测试超长ID
        let long_id = "a".repeat(65);
        assert!(!validate_session_id(&long_id));
    }

    // ================================
    // 数据结构序列化测试
    // ================================

    #[test]
    fn test_send_message_input_serialization() {
        // Arrange
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
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        
        // Assert
        assert!(json.contains("Hello"));
        assert!(json.contains("test_session"));
    }

    #[test]
    fn test_send_message_input_full_serialization() {
        // Arrange
        let context_messages = vec![
            ContextMessage {
                role: "system".to_string(),
                content: "You are a helpful assistant".to_string(),
            },
        ];
        
        let input = SendMessageInput {
            message: "Test message".to_string(),
            session_id: Some("session_123".to_string()),
            model: Some("gpt-4".to_string()),
            adapter: Some("openai".to_string()),
            character_id: Some("char_1".to_string()),
            max_tokens: Some(1000),
            temperature: Some(0.7),
            top_p: Some(0.9),
            stream: Some(false),
            context_messages: Some(context_messages),
        };
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: SendMessageInput = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.message, "Test message");
        assert_eq!(deserialized.session_id, Some("session_123".to_string()));
        assert_eq!(deserialized.model, Some("gpt-4".to_string()));
        assert_eq!(deserialized.max_tokens, Some(1000));
        assert_eq!(deserialized.temperature, Some(0.7));
        assert!(deserialized.context_messages.is_some());
    }

    #[test]
    fn test_chat_response_serialization() {
        // Arrange
        let usage = TokenUsage {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
        };
        
        let response = ChatResponse {
            message: "Hello back!".to_string(),
            session_id: "session_123".to_string(),
            message_id: "msg_456".to_string(),
            model: "gpt-4".to_string(),
            processing_time: Some(1.5),
            usage: Some(usage),
            finish_reason: Some("stop".to_string()),
        };
        
        // Act
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: ChatResponse = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.message, "Hello back!");
        assert_eq!(deserialized.session_id, "session_123");
        assert_eq!(deserialized.usage.unwrap().total_tokens, 30);
    }

    #[test]
    fn test_history_message_serialization() {
        // Arrange
        let message = HistoryMessage {
            role: "user".to_string(),
            content: "Test content".to_string(),
            timestamp: Some(1234567890),
            emotion: Some("happy".to_string()),
        };
        
        // Act
        let json = serde_json::to_string(&message).unwrap();
        let deserialized: HistoryMessage = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.role, "user");
        assert_eq!(deserialized.content, "Test content");
        assert_eq!(deserialized.timestamp, Some(1234567890));
    }

    #[test]
    fn test_set_model_input_with_config() {
        // Arrange
        let mut config = HashMap::new();
        config.insert("temperature".to_string(), json!(0.8));
        config.insert("max_tokens".to_string(), json!(2000));
        
        let input = SetModelInput {
            model_id: "gpt-4".to_string(),
            adapter_id: Some("openai".to_string()),
            config: Some(config),
        };
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: SetModelInput = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.model_id, "gpt-4");
        assert!(deserialized.config.is_some());
        
        let config = deserialized.config.unwrap();
        assert_eq!(config.get("temperature").unwrap().as_f64().unwrap(), 0.8);
    }

    // ================================
    // 命令元数据测试
    // ================================

    #[test]
    fn test_get_command_metadata() {
        // Act
        let metadata = get_command_metadata();
        
        // Assert
        assert!(!metadata.is_empty());
        assert!(metadata.contains_key("send_message"));
        assert!(metadata.contains_key("get_chat_history"));
        assert!(metadata.contains_key("clear_chat_history"));
        assert!(metadata.contains_key("set_chat_model"));
        
        // 验证send_message元数据
        let send_msg_meta = &metadata["send_message"];
        assert_eq!(send_msg_meta.name, "send_message");
        assert_eq!(send_msg_meta.category, "chat");
        assert_eq!(send_msg_meta.required_permission, PermissionLevel::User);
        assert!(send_msg_meta.is_async);
    }

    // ================================
    // 输入验证测试
    // ================================

    #[test]
    fn test_message_validation_empty() {
        // Arrange
        let input = SendMessageInput {
            message: "".to_string(),
            session_id: None,
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            context_messages: None,
        };
        
        // Act & Assert - 空消息应该在handler中被拒绝
        // 这里只测试结构体本身的序列化是否正常
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("\"message\":\"\""));
    }

    #[test]
    fn test_message_validation_whitespace() {
        // Arrange
        let input = SendMessageInput {
            message: "   \t\n   ".to_string(),
            session_id: None,
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            context_messages: None,
        };
        
        // Act & Assert
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("message"));
    }

    #[test]
    fn test_very_long_message_handling() {
        // Arrange - 创建超长消息
        let long_message = "a".repeat(15000);
        let input = SendMessageInput {
            message: long_message.clone(),
            session_id: None,
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            context_messages: None,
        };
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: SendMessageInput = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.message.len(), 15000);
        assert_eq!(deserialized.message, long_message);
    }

    // ================================
    // 上下文消息测试
    // ================================

    #[test]
    fn test_context_messages_handling() {
        // Arrange
        let context_messages = vec![
            ContextMessage {
                role: "system".to_string(),
                content: "System prompt".to_string(),
            },
            ContextMessage {
                role: "user".to_string(),
                content: "Previous user message".to_string(),
            },
            ContextMessage {
                role: "assistant".to_string(),
                content: "Previous assistant response".to_string(),
            },
        ];
        
        let input = SendMessageInput {
            message: "Current message".to_string(),
            session_id: Some("test_session".to_string()),
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            context_messages: Some(context_messages.clone()),
        };
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: SendMessageInput = serde_json::from_str(&json).unwrap();
        
        // Assert
        let ctx_msgs = deserialized.context_messages.unwrap();
        assert_eq!(ctx_msgs.len(), 3);
        assert_eq!(ctx_msgs[0].role, "system");
        assert_eq!(ctx_msgs[1].role, "user");
        assert_eq!(ctx_msgs[2].role, "assistant");
    }

    // ================================
    // 边界条件测试
    // ================================

    #[test]
    fn test_parameter_boundary_values() {
        // Arrange - 测试参数边界值
        let input = SendMessageInput {
            message: "Test".to_string(),
            session_id: Some("test".to_string()),
            model: Some("".to_string()), // 空模型名
            adapter: Some("".to_string()), // 空适配器名
            character_id: Some("".to_string()), // 空角色ID
            max_tokens: Some(0), // 最小token数
            temperature: Some(0.0), // 最小温度
            top_p: Some(0.0), // 最小top_p
            stream: Some(false),
            context_messages: Some(vec![]), // 空上下文列表
        };
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: SendMessageInput = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.max_tokens, Some(0));
        assert_eq!(deserialized.temperature, Some(0.0));
        assert_eq!(deserialized.top_p, Some(0.0));
        assert_eq!(deserialized.context_messages.unwrap().len(), 0);
    }

    #[test]
    fn test_parameter_maximum_values() {
        // Arrange - 测试参数最大值
        let input = SendMessageInput {
            message: "Test".to_string(),
            session_id: Some("test".to_string()),
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: Some(u32::MAX), // 最大token数
            temperature: Some(2.0), // 高温度值
            top_p: Some(1.0), // 最大top_p
            stream: Some(true),
            context_messages: None,
        };
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: SendMessageInput = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.max_tokens, Some(u32::MAX));
        assert_eq!(deserialized.temperature, Some(2.0));
        assert_eq!(deserialized.top_p, Some(1.0));
    }

    // ================================
    // 错误场景测试
    // ================================

    #[test]
    fn test_invalid_json_deserialization() {
        // Arrange
        let invalid_json = r#"{"message": 123, "invalid_field": true}"#;
        
        // Act & Assert
        let result: Result<SendMessageInput, _> = serde_json::from_str(invalid_json);
        assert!(result.is_err(), "应该拒绝无效的JSON格式");
    }

    #[test]
    fn test_missing_required_fields() {
        // Arrange - 缺少必需字段的JSON
        let incomplete_json = r#"{"session_id": "test"}"#;
        
        // Act & Assert
        let result: Result<SendMessageInput, _> = serde_json::from_str(incomplete_json);
        assert!(result.is_err(), "应该拒绝缺少必需字段的JSON");
    }

    #[test]
    fn test_unicode_message_handling() {
        // Arrange - 测试Unicode字符
        let unicode_message = "你好世界🌍🚀测试消息";
        let input = SendMessageInput {
            message: unicode_message.to_string(),
            session_id: Some("unicode_test".to_string()),
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            context_messages: None,
        };
        
        // Act
        let json = serde_json::to_string(&input).unwrap();
        let deserialized: SendMessageInput = serde_json::from_str(&json).unwrap();
        
        // Assert
        assert_eq!(deserialized.message, unicode_message);
    }

    // ================================
    // 性能相关测试
    // ================================

    #[test]
    fn test_large_context_messages_serialization() {
        // Arrange - 大量上下文消息
        let mut context_messages = Vec::new();
        for i in 0..100 {
            context_messages.push(ContextMessage {
                role: if i % 2 == 0 { "user" } else { "assistant" }.to_string(),
                content: format!("Message content {}", i),
            });
        }
        
        let input = SendMessageInput {
            message: "Final message".to_string(),
            session_id: Some("large_context_test".to_string()),
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            context_messages: Some(context_messages),
        };
        
        // Act
        let start = std::time::Instant::now();
        let json = serde_json::to_string(&input).unwrap();
        let serialization_time = start.elapsed();
        
        let start = std::time::Instant::now();
        let deserialized: SendMessageInput = serde_json::from_str(&json).unwrap();
        let deserialization_time = start.elapsed();
        
        // Assert
        assert_eq!(deserialized.context_messages.unwrap().len(), 100);
        
        // 性能断言 - 序列化和反序列化应该在合理时间内完成
        assert!(serialization_time.as_millis() < 100, "序列化时间过长");
        assert!(deserialization_time.as_millis() < 100, "反序列化时间过长");
    }
}
