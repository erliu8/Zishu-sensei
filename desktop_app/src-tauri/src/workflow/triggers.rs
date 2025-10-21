use crate::workflow::{WorkflowEngine, WorkflowExecution};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// 事件触发器管理器
pub struct EventTriggerManager {
    app_handle: AppHandle,
    engine: Arc<WorkflowEngine>,
    triggers: Arc<RwLock<HashMap<String, EventTrigger>>>,
}

/// 事件触发器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventTrigger {
    /// 触发器ID
    pub id: String,
    /// 工作流ID
    pub workflow_id: String,
    /// 事件类型
    pub event_type: EventType,
    /// 是否启用
    pub enabled: bool,
    /// 过滤条件 (可选)
    pub filter: Option<EventFilter>,
}

/// 事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum EventType {
    /// 系统事件
    System(SystemEvent),
    /// 文件系统事件
    FileSystem(FileSystemEvent),
    /// 应用事件
    Application(String),
    /// 自定义事件
    Custom(String),
}

/// 系统事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SystemEvent {
    /// 启动
    Startup,
    /// 关闭
    Shutdown,
    /// 唤醒
    WakeUp,
    /// 睡眠
    Sleep,
}

/// 文件系统事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileSystemEvent {
    /// 文件创建
    FileCreated,
    /// 文件修改
    FileModified,
    /// 文件删除
    FileDeleted,
    /// 目录创建
    DirectoryCreated,
}

/// 事件过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventFilter {
    /// 条件表达式
    pub conditions: HashMap<String, serde_json::Value>,
}

impl EventTriggerManager {
    /// 创建新的事件触发器管理器
    pub fn new(app_handle: AppHandle, engine: Arc<WorkflowEngine>) -> Self {
        Self {
            app_handle,
            engine,
            triggers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册事件触发器
    pub async fn register_trigger(&self, trigger: EventTrigger) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("注册事件触发器: {} for workflow {}", trigger.id, trigger.workflow_id);
        let mut triggers = self.triggers.write().await;
        triggers.insert(trigger.id.clone(), trigger);
        Ok(())
    }

    /// 注销事件触发器
    pub async fn unregister_trigger(&self, trigger_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("注销事件触发器: {}", trigger_id);
        let mut triggers = self.triggers.write().await;
        triggers.remove(trigger_id);
        Ok(())
    }

    /// 触发事件
    pub async fn trigger_event(
        &self,
        event_type: EventType,
        event_data: serde_json::Value,
    ) -> Result<Vec<String>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("触发事件: {:?}", event_type);
        
        let triggers = self.triggers.read().await;
        let mut execution_ids = Vec::new();
        
        for trigger in triggers.values() {
            if !trigger.enabled {
                continue;
            }
            
            if trigger.event_type != event_type {
                continue;
            }
            
            // 检查过滤条件
            if let Some(filter) = &trigger.filter {
                if !self.check_filter(filter, &event_data) {
                    continue;
                }
            }
            
            // 执行工作流
            let mut vars = HashMap::new();
            vars.insert("event_type".to_string(), serde_json::json!(event_type));
            vars.insert("event_data".to_string(), event_data.clone());
            
            match self.engine.execute_workflow_by_id(
                &trigger.workflow_id,
                vars,
            ).await {
                Ok(execution_id) => {
                    info!("事件触发器 {} 成功启动工作流执行: {}", trigger.id, execution_id);
                    execution_ids.push(execution_id);
                }
                Err(e) => {
                    error!("事件触发器 {} 启动工作流失败: {}", trigger.id, e);
                }
            }
        }
        
        Ok(execution_ids)
    }

    /// 检查过滤条件
    fn check_filter(&self, filter: &EventFilter, event_data: &serde_json::Value) -> bool {
        // 简单的条件匹配实现
        for (key, expected_value) in &filter.conditions {
            if let Some(actual_value) = event_data.get(key) {
                if actual_value != expected_value {
                    return false;
                }
            } else {
                return false;
            }
        }
        true
    }

    /// 列出所有触发器
    pub async fn list_triggers(&self) -> Vec<EventTrigger> {
        let triggers = self.triggers.read().await;
        triggers.values().cloned().collect()
    }

    /// 获取触发器
    pub async fn get_trigger(&self, trigger_id: &str) -> Option<EventTrigger> {
        let triggers = self.triggers.read().await;
        triggers.get(trigger_id).cloned()
    }

    /// 启用触发器
    pub async fn enable_trigger(&self, trigger_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut triggers = self.triggers.write().await;
        if let Some(trigger) = triggers.get_mut(trigger_id) {
            trigger.enabled = true;
            info!("启用事件触发器: {}", trigger_id);
            Ok(())
        } else {
            Err(format!("触发器不存在: {}", trigger_id).into())
        }
    }

    /// 禁用触发器
    pub async fn disable_trigger(&self, trigger_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut triggers = self.triggers.write().await;
        if let Some(trigger) = triggers.get_mut(trigger_id) {
            trigger.enabled = false;
            info!("禁用事件触发器: {}", trigger_id);
            Ok(())
        } else {
            Err(format!("触发器不存在: {}", trigger_id).into())
        }
    }
}

/// Webhook触发器管理器
pub struct WebhookTriggerManager {
    app_handle: AppHandle,
    engine: Arc<WorkflowEngine>,
    webhooks: Arc<RwLock<HashMap<String, WebhookConfig>>>,
}

/// Webhook配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    /// Webhook ID
    pub id: String,
    /// 工作流ID
    pub workflow_id: String,
    /// Webhook路径
    pub path: String,
    /// 允许的HTTP方法
    pub methods: Vec<HttpMethod>,
    /// 是否启用
    pub enabled: bool,
    /// 认证配置
    pub auth: Option<WebhookAuth>,
    /// 请求验证
    pub validation: Option<WebhookValidation>,
}

/// HTTP方法
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
}

impl std::fmt::Display for HttpMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HttpMethod::GET => write!(f, "GET"),
            HttpMethod::POST => write!(f, "POST"),
            HttpMethod::PUT => write!(f, "PUT"),
            HttpMethod::DELETE => write!(f, "DELETE"),
            HttpMethod::PATCH => write!(f, "PATCH"),
        }
    }
}

/// Webhook认证
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebhookAuth {
    /// Bearer Token
    Bearer { token: String },
    /// Basic Auth
    Basic { username: String, password: String },
    /// API Key
    ApiKey { header: String, key: String },
    /// HMAC签名
    Hmac { secret: String, header: String },
}

/// Webhook验证
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookValidation {
    /// 必需的请求头
    pub required_headers: Option<Vec<String>>,
    /// 必需的查询参数
    pub required_params: Option<Vec<String>>,
    /// JSON Schema验证
    pub json_schema: Option<serde_json::Value>,
}

/// Webhook请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookRequest {
    /// HTTP方法
    pub method: HttpMethod,
    /// 请求路径
    pub path: String,
    /// 请求头
    pub headers: HashMap<String, String>,
    /// 查询参数
    pub query: HashMap<String, String>,
    /// 请求体
    pub body: Option<serde_json::Value>,
}

/// Webhook响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookResponse {
    /// HTTP状态码
    pub status: u16,
    /// 响应头
    pub headers: HashMap<String, String>,
    /// 响应体
    pub body: Option<serde_json::Value>,
}

impl WebhookTriggerManager {
    /// 创建新的Webhook触发器管理器
    pub fn new(app_handle: AppHandle, engine: Arc<WorkflowEngine>) -> Self {
        Self {
            app_handle,
            engine,
            webhooks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册Webhook
    pub async fn register_webhook(&self, webhook: WebhookConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("注册Webhook: {} for workflow {} at path {}", webhook.id, webhook.workflow_id, webhook.path);
        let mut webhooks = self.webhooks.write().await;
        webhooks.insert(webhook.id.clone(), webhook);
        Ok(())
    }

    /// 注销Webhook
    pub async fn unregister_webhook(&self, webhook_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("注销Webhook: {}", webhook_id);
        let mut webhooks = self.webhooks.write().await;
        webhooks.remove(webhook_id);
        Ok(())
    }

    /// 处理Webhook请求
    pub async fn handle_webhook(
        &self,
        request: WebhookRequest,
    ) -> Result<WebhookResponse, Box<dyn std::error::Error + Send + Sync>> {
        debug!("处理Webhook请求: {} {}", request.method, request.path);
        
        let webhooks = self.webhooks.read().await;
        
        // 查找匹配的Webhook
        let webhook = webhooks.values()
            .find(|w| w.enabled && w.path == request.path && w.methods.contains(&request.method))
            .ok_or("未找到匹配的Webhook")?
            .clone();
        
        drop(webhooks);
        
        // 验证认证
        if let Some(auth) = &webhook.auth {
            self.validate_auth(auth, &request)?;
        }
        
        // 验证请求
        if let Some(validation) = &webhook.validation {
            self.validate_request(validation, &request)?;
        }
        
        // 执行工作流
        let mut vars = HashMap::new();
        vars.insert("webhook_id".to_string(), serde_json::json!(webhook.id));
        vars.insert("method".to_string(), serde_json::json!(request.method));
        vars.insert("path".to_string(), serde_json::json!(request.path));
        vars.insert("headers".to_string(), serde_json::json!(request.headers));
        vars.insert("query".to_string(), serde_json::json!(request.query));
        vars.insert("body".to_string(), serde_json::json!(request.body));
        
        let execution_id = self.engine.execute_workflow_by_id(
            &webhook.workflow_id,
            vars,
        ).await?;
        
        info!("Webhook {} 成功启动工作流执行: {}", webhook.id, execution_id);
        
        Ok(WebhookResponse {
            status: 202,
            headers: HashMap::new(),
            body: Some(serde_json::json!({
                "success": true,
                "execution_id": execution_id,
                "message": "工作流已启动",
            })),
        })
    }

    /// 验证认证
    fn validate_auth(
        &self,
        auth: &WebhookAuth,
        request: &WebhookRequest,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        match auth {
            WebhookAuth::Bearer { token } => {
                let auth_header = request.headers.get("authorization")
                    .or_else(|| request.headers.get("Authorization"))
                    .ok_or("缺少Authorization头")?;
                
                let expected = format!("Bearer {}", token);
                if auth_header != &expected {
                    return Err("认证失败".into());
                }
            }
            WebhookAuth::Basic { username, password } => {
                let auth_header = request.headers.get("authorization")
                    .or_else(|| request.headers.get("Authorization"))
                    .ok_or("缺少Authorization头")?;
                
                let credentials = base64::encode(format!("{}:{}", username, password));
                let expected = format!("Basic {}", credentials);
                if auth_header != &expected {
                    return Err("认证失败".into());
                }
            }
            WebhookAuth::ApiKey { header, key } => {
                let api_key = request.headers.get(header)
                    .ok_or(format!("缺少{}头", header))?;
                
                if api_key != key {
                    return Err("认证失败".into());
                }
            }
            WebhookAuth::Hmac { secret, header } => {
                let signature = request.headers.get(header)
                    .ok_or(format!("缺少{}头", header))?;
                
                // TODO: 实现HMAC验证
                warn!("HMAC验证尚未实现");
            }
        }
        
        Ok(())
    }

    /// 验证请求
    fn validate_request(
        &self,
        validation: &WebhookValidation,
        request: &WebhookRequest,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // 检查必需的请求头
        if let Some(required_headers) = &validation.required_headers {
            for header in required_headers {
                if !request.headers.contains_key(header) && 
                   !request.headers.contains_key(&header.to_lowercase()) {
                    return Err(format!("缺少必需的请求头: {}", header).into());
                }
            }
        }
        
        // 检查必需的查询参数
        if let Some(required_params) = &validation.required_params {
            for param in required_params {
                if !request.query.contains_key(param) {
                    return Err(format!("缺少必需的查询参数: {}", param).into());
                }
            }
        }
        
        // TODO: 实现JSON Schema验证
        if validation.json_schema.is_some() {
            warn!("JSON Schema验证尚未实现");
        }
        
        Ok(())
    }

    /// 列出所有Webhook
    pub async fn list_webhooks(&self) -> Vec<WebhookConfig> {
        let webhooks = self.webhooks.read().await;
        webhooks.values().cloned().collect()
    }

    /// 获取Webhook
    pub async fn get_webhook(&self, webhook_id: &str) -> Option<WebhookConfig> {
        let webhooks = self.webhooks.read().await;
        webhooks.get(webhook_id).cloned()
    }

    /// 启用Webhook
    pub async fn enable_webhook(&self, webhook_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut webhooks = self.webhooks.write().await;
        if let Some(webhook) = webhooks.get_mut(webhook_id) {
            webhook.enabled = true;
            info!("启用Webhook: {}", webhook_id);
            Ok(())
        } else {
            Err(format!("Webhook不存在: {}", webhook_id).into())
        }
    }

    /// 禁用Webhook
    pub async fn disable_webhook(&self, webhook_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut webhooks = self.webhooks.write().await;
        if let Some(webhook) = webhooks.get_mut(webhook_id) {
            webhook.enabled = false;
            info!("禁用Webhook: {}", webhook_id);
            Ok(())
        } else {
            Err(format!("Webhook不存在: {}", webhook_id).into())
        }
    }
}

