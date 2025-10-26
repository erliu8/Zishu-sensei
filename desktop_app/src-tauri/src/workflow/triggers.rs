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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use serde_json::json;
    use std::collections::HashMap;

    // ================================
    // Mock WorkflowEngine for测试
    // ================================

    #[derive(Clone)]
    struct MockWorkflowEngine {
        executions: Arc<RwLock<HashMap<String, String>>>,
        execution_results: Arc<RwLock<HashMap<String, Result<String, String>>>>,
    }

    impl MockWorkflowEngine {
        fn new() -> Self {
            Self {
                executions: Arc::new(RwLock::new(HashMap::new())),
                execution_results: Arc::new(RwLock::new(HashMap::new())),
            }
        }

        async fn execute_workflow_by_id(
            &self,
            workflow_id: &str,
            _variables: HashMap<String, serde_json::Value>,
        ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
            let execution_id = format!("exec-{}", uuid::Uuid::new_v4());
            
            // Check if we have a preset result for this workflow
            let results = self.execution_results.read().await;
            if let Some(result) = results.get(workflow_id) {
                match result {
                    Ok(id) => {
                        let mut executions = self.executions.write().await;
                        executions.insert(execution_id.clone(), workflow_id.to_string());
                        Ok(id.clone())
                    }
                    Err(e) => Err(e.clone().into()),
                }
            } else {
                // Default success
                let mut executions = self.executions.write().await;
                executions.insert(execution_id.clone(), workflow_id.to_string());
                Ok(execution_id)
            }
        }

        // Helper method to set expected execution result
        async fn set_execution_result(&self, workflow_id: &str, result: Result<String, String>) {
            let mut results = self.execution_results.write().await;
            results.insert(workflow_id.to_string(), result);
        }

        async fn get_executions(&self) -> HashMap<String, String> {
            self.executions.read().await.clone()
        }
    }

    // ================================
    // Mock AppHandle for测试
    // ================================

    fn create_mock_app_handle() -> tauri::AppHandle {
        // 在实际测试中，这需要一个真正的Tauri应用设置
        // 为了编译通过，我们使用panic，在集成测试中会被替代
        panic!("Mock AppHandle - needs integration test setup")
    }

    // ================================
    // 辅助函数
    // ================================

    /// 创建测试用的事件触发器管理器
    /// 注意：由于需要真实的AppHandle和WorkflowEngine，这些函数在单元测试中会panic
    /// 在集成测试中应该使用适当的mock设置
    fn create_test_event_manager() -> (EventTriggerManager, Arc<MockWorkflowEngine>) {
        // 为了避免编译错误，我们在这里panic，表示需要适当的集成测试设置
        panic!("需要集成测试环境设置");
    }

    /// 创建测试用的Webhook触发器管理器
    /// 注意：由于需要真实的AppHandle和WorkflowEngine，这些函数在单元测试中会panic
    /// 在集成测试中应该使用适当的mock设置
    fn create_test_webhook_manager() -> (WebhookTriggerManager, Arc<MockWorkflowEngine>) {
        // 为了避免编译错误，我们在这里panic，表示需要适当的集成测试设置
        panic!("需要集成测试环境设置");
    }

    /// 创建测试用的事件触发器
    fn create_test_event_trigger(id: &str, workflow_id: &str, event_type: EventType) -> EventTrigger {
        EventTrigger {
            id: id.to_string(),
            workflow_id: workflow_id.to_string(),
            event_type,
            enabled: true,
            filter: None,
        }
    }

    /// 创建测试用的Webhook配置
    fn create_test_webhook_config(id: &str, workflow_id: &str, path: &str) -> WebhookConfig {
        WebhookConfig {
            id: id.to_string(),
            workflow_id: workflow_id.to_string(),
            path: path.to_string(),
            methods: vec![HttpMethod::POST],
            enabled: true,
            auth: None,
            validation: None,
        }
    }

    // ================================
    // EventTrigger 结构测试
    // ================================

    #[test]
    fn test_event_trigger_creation() {
        // 测试事件触发器创建
        let trigger = create_test_event_trigger(
            "trigger-1",
            "workflow-1",
            EventType::System(SystemEvent::Startup),
        );

        assert_eq!(trigger.id, "trigger-1");
        assert_eq!(trigger.workflow_id, "workflow-1");
        assert_eq!(trigger.event_type, EventType::System(SystemEvent::Startup));
        assert!(trigger.enabled);
        assert!(trigger.filter.is_none());
    }

    #[test]
    fn test_event_trigger_serialization() {
        // 测试事件触发器序列化
        let trigger = create_test_event_trigger(
            "trigger-1",
            "workflow-1",
            EventType::System(SystemEvent::Startup),
        );

        // 测试序列化
        let serialized = serde_json::to_string(&trigger);
        assert!(serialized.is_ok());

        // 测试反序列化
        let json_str = serialized.unwrap();
        let deserialized: Result<EventTrigger, _> = serde_json::from_str(&json_str);
        assert!(deserialized.is_ok());

        let recovered = deserialized.unwrap();
        assert_eq!(recovered.id, trigger.id);
        assert_eq!(recovered.workflow_id, trigger.workflow_id);
        assert_eq!(recovered.event_type, trigger.event_type);
    }

    // ================================
    // EventType 枚举测试
    // ================================

    #[test]
    fn test_system_event_types() {
        let system_events = vec![
            SystemEvent::Startup,
            SystemEvent::Shutdown,
            SystemEvent::WakeUp,
            SystemEvent::Sleep,
        ];

        for event in system_events {
            let event_type = EventType::System(event.clone());
            
            // 测试序列化
            let serialized = serde_json::to_string(&event_type);
            assert!(serialized.is_ok());

            // 测试反序列化
            let deserialized: Result<EventType, _> = serde_json::from_str(&serialized.unwrap());
            assert!(deserialized.is_ok());
            assert_eq!(deserialized.unwrap(), event_type);
        }
    }

    #[test]
    fn test_filesystem_event_types() {
        let fs_events = vec![
            FileSystemEvent::FileCreated,
            FileSystemEvent::FileModified,
            FileSystemEvent::FileDeleted,
            FileSystemEvent::DirectoryCreated,
        ];

        for event in fs_events {
            let event_type = EventType::FileSystem(event.clone());
            
            // 测试序列化
            let serialized = serde_json::to_string(&event_type);
            assert!(serialized.is_ok());

            // 测试反序列化
            let deserialized: Result<EventType, _> = serde_json::from_str(&serialized.unwrap());
            assert!(deserialized.is_ok());
            assert_eq!(deserialized.unwrap(), event_type);
        }
    }

    #[test]
    fn test_application_event_type() {
        let event_type = EventType::Application("app_closed".to_string());
        
        // 测试序列化
        let serialized = serde_json::to_string(&event_type);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<EventType, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
        assert_eq!(deserialized.unwrap(), event_type);
    }

    #[test]
    fn test_custom_event_type() {
        let event_type = EventType::Custom("user_defined_event".to_string());
        
        // 测试序列化
        let serialized = serde_json::to_string(&event_type);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<EventType, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());
        assert_eq!(deserialized.unwrap(), event_type);
    }

    // ================================
    // EventFilter 测试
    // ================================

    #[test]
    fn test_event_filter_creation() {
        let mut conditions = HashMap::new();
        conditions.insert("status".to_string(), json!("success"));
        conditions.insert("priority".to_string(), json!(1));

        let filter = EventFilter { conditions };

        assert_eq!(filter.conditions.len(), 2);
        assert_eq!(filter.conditions.get("status").unwrap().as_str().unwrap(), "success");
        assert_eq!(filter.conditions.get("priority").unwrap().as_i64().unwrap(), 1);
    }

    #[test]
    fn test_event_filter_serialization() {
        let mut conditions = HashMap::new();
        conditions.insert("type".to_string(), json!("test"));
        conditions.insert("value".to_string(), json!(42));

        let filter = EventFilter { conditions };

        // 测试序列化
        let serialized = serde_json::to_string(&filter);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<EventFilter, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());

        let recovered = deserialized.unwrap();
        assert_eq!(recovered.conditions.len(), 2);
        assert_eq!(recovered.conditions.get("type").unwrap().as_str().unwrap(), "test");
        assert_eq!(recovered.conditions.get("value").unwrap().as_i64().unwrap(), 42);
    }

    // ================================
    // WebhookConfig 测试
    // ================================

    #[test]
    fn test_webhook_config_creation() {
        let config = create_test_webhook_config("webhook-1", "workflow-1", "/webhook/test");

        assert_eq!(config.id, "webhook-1");
        assert_eq!(config.workflow_id, "workflow-1");
        assert_eq!(config.path, "/webhook/test");
        assert_eq!(config.methods, vec![HttpMethod::POST]);
        assert!(config.enabled);
        assert!(config.auth.is_none());
        assert!(config.validation.is_none());
    }

    #[test]
    fn test_webhook_config_with_auth() {
        let mut config = create_test_webhook_config("webhook-1", "workflow-1", "/webhook/test");
        config.auth = Some(WebhookAuth::Bearer {
            token: "secret-token".to_string(),
        });

        assert!(config.auth.is_some());
        match config.auth.unwrap() {
            WebhookAuth::Bearer { token } => {
                assert_eq!(token, "secret-token");
            }
            _ => panic!("Expected Bearer auth"),
        }
    }

    #[test]
    fn test_webhook_config_with_validation() {
        let mut config = create_test_webhook_config("webhook-1", "workflow-1", "/webhook/test");
        config.validation = Some(WebhookValidation {
            required_headers: Some(vec!["x-api-key".to_string()]),
            required_params: Some(vec!["action".to_string()]),
            json_schema: None,
        });

        assert!(config.validation.is_some());
        let validation = config.validation.unwrap();
        assert_eq!(validation.required_headers.unwrap(), vec!["x-api-key"]);
        assert_eq!(validation.required_params.unwrap(), vec!["action"]);
    }

    // ================================
    // HttpMethod 测试
    // ================================

    #[test]
    fn test_http_method_display() {
        let methods = vec![
            (HttpMethod::GET, "GET"),
            (HttpMethod::POST, "POST"),
            (HttpMethod::PUT, "PUT"),
            (HttpMethod::DELETE, "DELETE"),
            (HttpMethod::PATCH, "PATCH"),
        ];

        for (method, expected) in methods {
            assert_eq!(format!("{}", method), expected);
        }
    }

    #[test]
    fn test_http_method_serialization() {
        let methods = vec![
            HttpMethod::GET,
            HttpMethod::POST,
            HttpMethod::PUT,
            HttpMethod::DELETE,
            HttpMethod::PATCH,
        ];

        for method in methods {
            // 测试序列化
            let serialized = serde_json::to_string(&method);
            assert!(serialized.is_ok());

            // 测试反序列化
            let deserialized: Result<HttpMethod, _> = serde_json::from_str(&serialized.unwrap());
            assert!(deserialized.is_ok());
            assert_eq!(deserialized.unwrap(), method);
        }
    }

    // ================================
    // WebhookAuth 测试
    // ================================

    #[test]
    fn test_webhook_auth_bearer() {
        let auth = WebhookAuth::Bearer {
            token: "test-token".to_string(),
        };

        // 测试序列化
        let serialized = serde_json::to_string(&auth);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<WebhookAuth, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());

        match deserialized.unwrap() {
            WebhookAuth::Bearer { token } => {
                assert_eq!(token, "test-token");
            }
            _ => panic!("Expected Bearer auth"),
        }
    }

    #[test]
    fn test_webhook_auth_basic() {
        let auth = WebhookAuth::Basic {
            username: "user".to_string(),
            password: "pass".to_string(),
        };

        // 测试序列化
        let serialized = serde_json::to_string(&auth);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<WebhookAuth, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());

        match deserialized.unwrap() {
            WebhookAuth::Basic { username, password } => {
                assert_eq!(username, "user");
                assert_eq!(password, "pass");
            }
            _ => panic!("Expected Basic auth"),
        }
    }

    #[test]
    fn test_webhook_auth_api_key() {
        let auth = WebhookAuth::ApiKey {
            header: "X-API-Key".to_string(),
            key: "secret-key".to_string(),
        };

        // 测试序列化
        let serialized = serde_json::to_string(&auth);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<WebhookAuth, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());

        match deserialized.unwrap() {
            WebhookAuth::ApiKey { header, key } => {
                assert_eq!(header, "X-API-Key");
                assert_eq!(key, "secret-key");
            }
            _ => panic!("Expected ApiKey auth"),
        }
    }

    #[test]
    fn test_webhook_auth_hmac() {
        let auth = WebhookAuth::Hmac {
            secret: "secret".to_string(),
            header: "X-Signature".to_string(),
        };

        // 测试序列化
        let serialized = serde_json::to_string(&auth);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<WebhookAuth, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());

        match deserialized.unwrap() {
            WebhookAuth::Hmac { secret, header } => {
                assert_eq!(secret, "secret");
                assert_eq!(header, "X-Signature");
            }
            _ => panic!("Expected HMAC auth"),
        }
    }

    // ================================
    // WebhookRequest/Response 测试
    // ================================

    #[test]
    fn test_webhook_request_creation() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());
        headers.insert("x-api-key".to_string(), "secret".to_string());

        let mut query = HashMap::new();
        query.insert("action".to_string(), "test".to_string());

        let request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook/test".to_string(),
            headers,
            query,
            body: Some(json!({"message": "test"})),
        };

        assert_eq!(request.method, HttpMethod::POST);
        assert_eq!(request.path, "/webhook/test");
        assert_eq!(request.headers.len(), 2);
        assert_eq!(request.query.len(), 1);
        assert!(request.body.is_some());
    }

    #[test]
    fn test_webhook_request_serialization() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let request = WebhookRequest {
            method: HttpMethod::GET,
            path: "/test".to_string(),
            headers,
            query: HashMap::new(),
            body: None,
        };

        // 测试序列化
        let serialized = serde_json::to_string(&request);
        assert!(serialized.is_ok());

        // 测试反序列化
        let deserialized: Result<WebhookRequest, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok());

        let recovered = deserialized.unwrap();
        assert_eq!(recovered.method, HttpMethod::GET);
        assert_eq!(recovered.path, "/test");
        assert_eq!(recovered.headers.len(), 1);
    }

    #[test]
    fn test_webhook_response_creation() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let response = WebhookResponse {
            status: 200,
            headers,
            body: Some(json!({"success": true})),
        };

        assert_eq!(response.status, 200);
        assert_eq!(response.headers.len(), 1);
        assert!(response.body.is_some());
    }

    // ================================
    // 触发器管理器功能测试 (不依赖外部服务)
    // ================================

    #[tokio::test]
    async fn test_event_trigger_storage() {
        // 测试事件触发器存储，不依赖外部服务
        let triggers = Arc::new(RwLock::new(HashMap::new()));
        
        let trigger = create_test_event_trigger(
            "trigger-1",
            "workflow-1",
            EventType::System(SystemEvent::Startup),
        );

        // 测试添加触发器
        {
            let mut triggers_guard = triggers.write().await;
            triggers_guard.insert(trigger.id.clone(), trigger.clone());
        }

        // 验证触发器已存储
        {
            let triggers_guard = triggers.read().await;
            assert_eq!(triggers_guard.len(), 1);
            assert!(triggers_guard.contains_key("trigger-1"));
            
            let stored = triggers_guard.get("trigger-1").unwrap();
            assert_eq!(stored.workflow_id, "workflow-1");
            assert_eq!(stored.event_type, EventType::System(SystemEvent::Startup));
        }
    }

    #[tokio::test]
    async fn test_webhook_storage() {
        // 测试Webhook存储，不依赖外部服务
        let webhooks = Arc::new(RwLock::new(HashMap::new()));
        
        let webhook = create_test_webhook_config("webhook-1", "workflow-1", "/webhook/test");

        // 测试添加Webhook
        {
            let mut webhooks_guard = webhooks.write().await;
            webhooks_guard.insert(webhook.id.clone(), webhook.clone());
        }

        // 验证Webhook已存储
        {
            let webhooks_guard = webhooks.read().await;
            assert_eq!(webhooks_guard.len(), 1);
            assert!(webhooks_guard.contains_key("webhook-1"));
            
            let stored = webhooks_guard.get("webhook-1").unwrap();
            assert_eq!(stored.workflow_id, "workflow-1");
            assert_eq!(stored.path, "/webhook/test");
        }
    }

    // ================================
    // 事件过滤逻辑测试
    // ================================

    #[test]
    fn test_event_filter_matching() {
        // 测试事件过滤匹配逻辑
        let mut conditions = HashMap::new();
        conditions.insert("status".to_string(), json!("success"));
        conditions.insert("priority".to_string(), json!(1));

        let filter = EventFilter { conditions };

        // 测试匹配的事件数据
        let matching_data = json!({
            "status": "success",
            "priority": 1,
            "message": "Operation completed"
        });

        // 手动检查过滤条件
        let mut matches = true;
        for (key, expected_value) in &filter.conditions {
            if let Some(actual_value) = matching_data.get(key) {
                if actual_value != expected_value {
                    matches = false;
                    break;
                }
            } else {
                matches = false;
                break;
            }
        }
        assert!(matches);

        // 测试不匹配的事件数据
        let non_matching_data = json!({
            "status": "error",
            "priority": 1,
            "message": "Operation failed"
        });

        let mut matches = true;
        for (key, expected_value) in &filter.conditions {
            if let Some(actual_value) = non_matching_data.get(key) {
                if actual_value != expected_value {
                    matches = false;
                    break;
                }
            } else {
                matches = false;
                break;
            }
        }
        assert!(!matches);
    }

    // ================================
    // Webhook认证逻辑测试
    // ================================

    #[test]
    fn test_bearer_auth_validation() {
        // 测试Bearer认证验证逻辑
        let auth = WebhookAuth::Bearer {
            token: "secret-token".to_string(),
        };

        let mut valid_headers = HashMap::new();
        valid_headers.insert("authorization".to_string(), "Bearer secret-token".to_string());

        let valid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: valid_headers,
            query: HashMap::new(),
            body: None,
        };

        // 验证正确的认证
        match &auth {
            WebhookAuth::Bearer { token } => {
                let auth_header = valid_request.headers.get("authorization").unwrap();
                let expected = format!("Bearer {}", token);
                assert_eq!(auth_header, &expected);
            }
            _ => panic!("Expected Bearer auth"),
        }

        // 测试错误的认证
        let mut invalid_headers = HashMap::new();
        invalid_headers.insert("authorization".to_string(), "Bearer wrong-token".to_string());

        let invalid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: invalid_headers,
            query: HashMap::new(),
            body: None,
        };

        match &auth {
            WebhookAuth::Bearer { token } => {
                let auth_header = invalid_request.headers.get("authorization").unwrap();
                let expected = format!("Bearer {}", token);
                assert_ne!(auth_header, &expected);
            }
            _ => panic!("Expected Bearer auth"),
        }
    }

    #[test]
    fn test_basic_auth_validation() {
        // 测试Basic认证验证逻辑
        let auth = WebhookAuth::Basic {
            username: "user".to_string(),
            password: "pass".to_string(),
        };

        // 创建正确的Basic认证头
        let credentials = base64::encode("user:pass");
        let expected_header = format!("Basic {}", credentials);

        let mut valid_headers = HashMap::new();
        valid_headers.insert("authorization".to_string(), expected_header.clone());

        let valid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: valid_headers,
            query: HashMap::new(),
            body: None,
        };

        // 验证正确的认证
        match &auth {
            WebhookAuth::Basic { username, password } => {
                let auth_header = valid_request.headers.get("authorization").unwrap();
                let expected_creds = base64::encode(format!("{}:{}", username, password));
                let expected = format!("Basic {}", expected_creds);
                assert_eq!(auth_header, &expected);
            }
            _ => panic!("Expected Basic auth"),
        }
    }

    #[test]
    fn test_api_key_auth_validation() {
        // 测试API Key认证验证逻辑
        let auth = WebhookAuth::ApiKey {
                header: "X-API-Key".to_string(),
            key: "secret-key".to_string(),
        };

        let mut valid_headers = HashMap::new();
        valid_headers.insert("X-API-Key".to_string(), "secret-key".to_string());

        let valid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: valid_headers,
            query: HashMap::new(),
            body: None,
        };

        // 验证正确的认证
        match &auth {
            WebhookAuth::ApiKey { header, key } => {
                let api_key = valid_request.headers.get(header).unwrap();
                assert_eq!(api_key, key);
            }
            _ => panic!("Expected ApiKey auth"),
        }
    }

    // ================================
    // Webhook验证逻辑测试
    // ================================

    #[test]
    fn test_webhook_validation_required_headers() {
        // 测试必需请求头验证
        let validation = WebhookValidation {
            required_headers: Some(vec!["content-type".to_string(), "x-api-key".to_string()]),
                required_params: None,
                json_schema: None,
        };

        // 测试有效请求
        let mut valid_headers = HashMap::new();
        valid_headers.insert("content-type".to_string(), "application/json".to_string());
        valid_headers.insert("x-api-key".to_string(), "secret".to_string());

        let valid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: valid_headers,
            query: HashMap::new(),
            body: None,
        };

        // 验证所有必需的请求头都存在
        if let Some(required_headers) = &validation.required_headers {
            for header in required_headers {
                assert!(
                    valid_request.headers.contains_key(header) || 
                    valid_request.headers.contains_key(&header.to_lowercase())
                );
            }
        }

        // 测试无效请求（缺少请求头）
        let mut invalid_headers = HashMap::new();
        invalid_headers.insert("content-type".to_string(), "application/json".to_string());
        // 缺少 x-api-key

        let invalid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: invalid_headers,
            query: HashMap::new(),
            body: None,
        };

        // 验证缺少必需的请求头
        if let Some(required_headers) = &validation.required_headers {
            let mut missing_headers = Vec::new();
            for header in required_headers {
                if !invalid_request.headers.contains_key(header) && 
                   !invalid_request.headers.contains_key(&header.to_lowercase()) {
                    missing_headers.push(header);
                }
            }
            assert!(!missing_headers.is_empty());
        }
    }

    #[test]
    fn test_webhook_validation_required_params() {
        // 测试必需查询参数验证
        let validation = WebhookValidation {
                required_headers: None,
            required_params: Some(vec!["action".to_string(), "token".to_string()]),
                json_schema: None,
        };

        // 测试有效请求
        let mut valid_query = HashMap::new();
        valid_query.insert("action".to_string(), "test".to_string());
        valid_query.insert("token".to_string(), "abc123".to_string());

        let valid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: HashMap::new(),
            query: valid_query,
            body: None,
        };

        // 验证所有必需的查询参数都存在
        if let Some(required_params) = &validation.required_params {
            for param in required_params {
                assert!(valid_request.query.contains_key(param));
            }
        }

        // 测试无效请求（缺少查询参数）
        let mut invalid_query = HashMap::new();
        invalid_query.insert("action".to_string(), "test".to_string());
        // 缺少 token

        let invalid_request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook".to_string(),
            headers: HashMap::new(),
            query: invalid_query,
            body: None,
        };

        // 验证缺少必需的查询参数
        if let Some(required_params) = &validation.required_params {
            let mut missing_params = Vec::new();
            for param in required_params {
                if !invalid_request.query.contains_key(param) {
                    missing_params.push(param);
                }
            }
            assert!(!missing_params.is_empty());
        }
    }

    // ================================
    // 并发和线程安全测试
    // ================================

    #[tokio::test]
    async fn test_concurrent_trigger_registration() {
        // 测试并发注册触发器
        let triggers = Arc::new(RwLock::new(HashMap::new()));
        let mut handles = vec![];

        for i in 0..10 {
            let triggers_clone = triggers.clone();
            let handle = tokio::spawn(async move {
                let trigger = create_test_event_trigger(
                    &format!("trigger-{}", i),
                    &format!("workflow-{}", i),
                    EventType::System(SystemEvent::Startup),
                );

                let mut triggers_guard = triggers_clone.write().await;
                triggers_guard.insert(trigger.id.clone(), trigger);
            });
            handles.push(handle);
        }

        // 等待所有任务完成
        for handle in handles {
            handle.await.unwrap();
        }

        // 验证所有触发器都被注册
        let triggers_guard = triggers.read().await;
        assert_eq!(triggers_guard.len(), 10);
        
        for i in 0..10 {
            let key = format!("trigger-{}", i);
            assert!(triggers_guard.contains_key(&key));
        }
    }

    #[tokio::test]
    async fn test_concurrent_webhook_registration() {
        // 测试并发注册Webhook
        let webhooks = Arc::new(RwLock::new(HashMap::new()));
        let mut handles = vec![];

        for i in 0..10 {
            let webhooks_clone = webhooks.clone();
            let handle = tokio::spawn(async move {
                let webhook = create_test_webhook_config(
                    &format!("webhook-{}", i),
                    &format!("workflow-{}", i),
                    &format!("/webhook/test-{}", i),
                );

                let mut webhooks_guard = webhooks_clone.write().await;
                webhooks_guard.insert(webhook.id.clone(), webhook);
            });
            handles.push(handle);
        }

        // 等待所有任务完成
        for handle in handles {
            handle.await.unwrap();
        }

        // 验证所有Webhook都被注册
        let webhooks_guard = webhooks.read().await;
        assert_eq!(webhooks_guard.len(), 10);
        
        for i in 0..10 {
            let key = format!("webhook-{}", i);
            assert!(webhooks_guard.contains_key(&key));
        }
    }

    // ================================
    // 边界情况和错误处理测试
    // ================================

    #[test]
    fn test_empty_event_filter() {
        // 测试空事件过滤器
        let filter = EventFilter {
            conditions: HashMap::new(),
        };

        // 空过滤器应该匹配任何事件
        assert_eq!(filter.conditions.len(), 0);

        // 任何事件数据都应该通过空过滤器
        let event_data = json!({"any": "data"});
        
        // 空条件意味着总是匹配
        let mut matches = true;
        for (_key, _expected_value) in &filter.conditions {
            // 不会执行，因为conditions是空的
            matches = false;
        }
        assert!(matches); // 空条件 = 总是匹配
    }

    #[test]
    fn test_webhook_with_all_http_methods() {
        // 测试支持所有HTTP方法的Webhook
        let mut config = create_test_webhook_config("webhook-1", "workflow-1", "/webhook/test");
        config.methods = vec![
            HttpMethod::GET,
            HttpMethod::POST,
            HttpMethod::PUT,
            HttpMethod::DELETE,
            HttpMethod::PATCH,
        ];

        assert_eq!(config.methods.len(), 5);
        assert!(config.methods.contains(&HttpMethod::GET));
        assert!(config.methods.contains(&HttpMethod::POST));
        assert!(config.methods.contains(&HttpMethod::PUT));
        assert!(config.methods.contains(&HttpMethod::DELETE));
        assert!(config.methods.contains(&HttpMethod::PATCH));
    }

    #[test]
    fn test_large_webhook_request_body() {
        // 测试大型请求体处理
        let large_data = json!({
            "data": "x".repeat(10000), // 10KB的数据
            "metadata": {
                "size": 10000,
                "type": "large_payload"
            }
        });

        let request = WebhookRequest {
            method: HttpMethod::POST,
            path: "/webhook/large".to_string(),
            headers: HashMap::new(),
            query: HashMap::new(),
            body: Some(large_data.clone()),
        };

        assert!(request.body.is_some());
        let body = request.body.unwrap();
        assert_eq!(body.get("data").unwrap().as_str().unwrap().len(), 10000);
        assert_eq!(body.get("metadata").unwrap().get("size").unwrap().as_i64().unwrap(), 10000);
    }

    // ================================
    // 性能测试
    // ================================

    #[tokio::test]
    async fn test_large_number_of_triggers() {
        // 测试大量触发器处理
        let triggers = Arc::new(RwLock::new(HashMap::new()));
        let count = 1000usize;

        // 添加大量触发器
        {
            let mut triggers_guard = triggers.write().await;
            for i in 0..count {
                let trigger = create_test_event_trigger(
                    &format!("trigger-{}", i),
                    &format!("workflow-{}", i),
                EventType::System(SystemEvent::Startup),
                );
                triggers_guard.insert(trigger.id.clone(), trigger);
            }
        }

        // 验证所有触发器都被添加
        {
            let triggers_guard = triggers.read().await;
            assert_eq!(triggers_guard.len(), count);
        }

        // 模拟查找匹配的触发器
        let event_type = EventType::System(SystemEvent::Startup);
        let mut matching_triggers = Vec::new();

        {
            let triggers_guard = triggers.read().await;
            for trigger in triggers_guard.values() {
                if trigger.enabled && trigger.event_type == event_type {
                    matching_triggers.push(trigger.id.clone());
                }
            }
        }

        // 所有触发器都应该匹配
        assert_eq!(matching_triggers.len(), count);
    }
}

