//! # 工作流触发器测试
//!
//! 测试事件触发器和Webhook触发器功能

use zishu_sensei::workflow::triggers::*;
use serde_json::json;
use std::collections::HashMap;

// ================================
// EventType 测试
// ================================

#[test]
fn test_event_type_system() {
    // Arrange & Act
    let startup = EventType::System(SystemEvent::Startup);
    let shutdown = EventType::System(SystemEvent::Shutdown);
    let wakeup = EventType::System(SystemEvent::WakeUp);
    let sleep = EventType::System(SystemEvent::Sleep);
    
    // Assert
    assert!(matches!(startup, EventType::System(SystemEvent::Startup)));
    assert!(matches!(shutdown, EventType::System(SystemEvent::Shutdown)));
    assert!(matches!(wakeup, EventType::System(SystemEvent::WakeUp)));
    assert!(matches!(sleep, EventType::System(SystemEvent::Sleep)));
}

#[test]
fn test_event_type_filesystem() {
    // Arrange & Act
    let created = EventType::FileSystem(FileSystemEvent::FileCreated);
    let modified = EventType::FileSystem(FileSystemEvent::FileModified);
    let deleted = EventType::FileSystem(FileSystemEvent::FileDeleted);
    let dir_created = EventType::FileSystem(FileSystemEvent::DirectoryCreated);
    
    // Assert
    assert!(matches!(created, EventType::FileSystem(FileSystemEvent::FileCreated)));
    assert!(matches!(modified, EventType::FileSystem(FileSystemEvent::FileModified)));
    assert!(matches!(deleted, EventType::FileSystem(FileSystemEvent::FileDeleted)));
    assert!(matches!(dir_created, EventType::FileSystem(FileSystemEvent::DirectoryCreated)));
}

#[test]
fn test_event_type_application() {
    // Arrange & Act
    let app_event = EventType::Application("user_login".to_string());
    
    // Assert
    assert!(matches!(app_event, EventType::Application(_)));
}

#[test]
fn test_event_type_custom() {
    // Arrange & Act
    let custom_event = EventType::Custom("custom_trigger".to_string());
    
    // Assert
    assert!(matches!(custom_event, EventType::Custom(_)));
}

#[test]
fn test_event_type_serialization() {
    // Arrange
    let events = vec![
        EventType::System(SystemEvent::Startup),
        EventType::FileSystem(FileSystemEvent::FileCreated),
        EventType::Application("test_app".to_string()),
        EventType::Custom("test_custom".to_string()),
    ];
    
    // Act & Assert
    for event in events {
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: EventType = serde_json::from_str(&json).unwrap();
        assert_eq!(event, deserialized);
    }
}

// ================================
// SystemEvent 测试
// ================================

#[test]
fn test_system_event_values() {
    let events = vec![
        SystemEvent::Startup,
        SystemEvent::Shutdown,
        SystemEvent::WakeUp,
        SystemEvent::Sleep,
    ];
    
    for event in events {
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: SystemEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(event, deserialized);
    }
}

// ================================
// FileSystemEvent 测试
// ================================

#[test]
fn test_filesystem_event_values() {
    let events = vec![
        FileSystemEvent::FileCreated,
        FileSystemEvent::FileModified,
        FileSystemEvent::FileDeleted,
        FileSystemEvent::DirectoryCreated,
    ];
    
    for event in events {
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: FileSystemEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(event, deserialized);
    }
}

// ================================
// EventTrigger 测试
// ================================

#[test]
fn test_event_trigger_creation() {
    // Arrange & Act
    let trigger = EventTrigger {
        id: "trigger-1".to_string(),
        workflow_id: "workflow-1".to_string(),
        event_type: EventType::System(SystemEvent::Startup),
        enabled: true,
        filter: None,
    };
    
    // Assert
    assert_eq!(trigger.id, "trigger-1");
    assert_eq!(trigger.workflow_id, "workflow-1");
    assert_eq!(trigger.enabled, true);
    assert!(trigger.filter.is_none());
}

#[test]
fn test_event_trigger_with_filter() {
    // Arrange & Act
    let mut conditions = HashMap::new();
    conditions.insert("file_type".to_string(), json!("txt"));
    conditions.insert("file_size".to_string(), json!(1000));
    
    let trigger = EventTrigger {
        id: "trigger-2".to_string(),
        workflow_id: "workflow-2".to_string(),
        event_type: EventType::FileSystem(FileSystemEvent::FileCreated),
        enabled: true,
        filter: Some(EventFilter { conditions }),
    };
    
    // Assert
    assert!(trigger.filter.is_some());
    let filter = trigger.filter.unwrap();
    assert_eq!(filter.conditions.len(), 2);
    assert!(filter.conditions.contains_key("file_type"));
}

#[test]
fn test_event_trigger_disabled() {
    // Arrange & Act
    let trigger = EventTrigger {
        id: "disabled-trigger".to_string(),
        workflow_id: "workflow-1".to_string(),
        event_type: EventType::Custom("test".to_string()),
        enabled: false,
        filter: None,
    };
    
    // Assert
    assert_eq!(trigger.enabled, false);
}

#[test]
fn test_event_trigger_serialization() {
    // Arrange
    let trigger = EventTrigger {
        id: "test-trigger".to_string(),
        workflow_id: "test-workflow".to_string(),
        event_type: EventType::System(SystemEvent::Startup),
        enabled: true,
        filter: None,
    };
    
    // Act
    let json = serde_json::to_string(&trigger).unwrap();
    let deserialized: EventTrigger = serde_json::from_str(&json).unwrap();
    
    // Assert
    assert_eq!(deserialized.id, trigger.id);
    assert_eq!(deserialized.workflow_id, trigger.workflow_id);
    assert_eq!(deserialized.enabled, trigger.enabled);
}

// ================================
// EventFilter 测试
// ================================

#[test]
fn test_event_filter_creation() {
    // Arrange & Act
    let mut conditions = HashMap::new();
    conditions.insert("key1".to_string(), json!("value1"));
    conditions.insert("key2".to_string(), json!(123));
    
    let filter = EventFilter { conditions };
    
    // Assert
    assert_eq!(filter.conditions.len(), 2);
}

#[test]
fn test_event_filter_serialization() {
    // Arrange
    let mut conditions = HashMap::new();
    conditions.insert("test_key".to_string(), json!("test_value"));
    
    let filter = EventFilter { conditions };
    
    // Act
    let json = serde_json::to_string(&filter).unwrap();
    let deserialized: EventFilter = serde_json::from_str(&json).unwrap();
    
    // Assert
    assert_eq!(deserialized.conditions.len(), filter.conditions.len());
}

// ================================
// WebhookConfig 测试
// ================================

#[test]
fn test_webhook_config_creation() {
    // Arrange & Act
    let config = WebhookConfig {
        id: "webhook-1".to_string(),
        workflow_id: "workflow-1".to_string(),
        path: "/api/webhook/test".to_string(),
        methods: vec![HttpMethod::POST, HttpMethod::PUT],
        enabled: true,
        auth: None,
        validation: None,
    };
    
    // Assert
    assert_eq!(config.id, "webhook-1");
    assert_eq!(config.path, "/api/webhook/test");
    assert_eq!(config.methods.len(), 2);
    assert_eq!(config.enabled, true);
}

#[test]
fn test_webhook_config_with_bearer_auth() {
    // Arrange & Act
    let config = WebhookConfig {
        id: "webhook-2".to_string(),
        workflow_id: "workflow-2".to_string(),
        path: "/api/webhook/secure".to_string(),
        methods: vec![HttpMethod::POST],
        enabled: true,
        auth: Some(WebhookAuth::Bearer {
            token: "secret-token".to_string(),
        }),
        validation: None,
    };
    
    // Assert
    assert!(config.auth.is_some());
    assert!(matches!(config.auth.unwrap(), WebhookAuth::Bearer { .. }));
}

#[test]
fn test_webhook_config_with_basic_auth() {
    // Arrange & Act
    let config = WebhookConfig {
        id: "webhook-3".to_string(),
        workflow_id: "workflow-3".to_string(),
        path: "/api/webhook/basic".to_string(),
        methods: vec![HttpMethod::POST],
        enabled: true,
        auth: Some(WebhookAuth::Basic {
            username: "user".to_string(),
            password: "pass".to_string(),
        }),
        validation: None,
    };
    
    // Assert
    assert!(config.auth.is_some());
    assert!(matches!(config.auth.unwrap(), WebhookAuth::Basic { .. }));
}

#[test]
fn test_webhook_config_with_api_key_auth() {
    // Arrange & Act
    let config = WebhookConfig {
        id: "webhook-4".to_string(),
        workflow_id: "workflow-4".to_string(),
        path: "/api/webhook/apikey".to_string(),
        methods: vec![HttpMethod::GET, HttpMethod::POST],
        enabled: true,
        auth: Some(WebhookAuth::ApiKey {
            header: "X-API-Key".to_string(),
            key: "api-key-12345".to_string(),
        }),
        validation: None,
    };
    
    // Assert
    assert!(config.auth.is_some());
    assert!(matches!(config.auth.unwrap(), WebhookAuth::ApiKey { .. }));
}

#[test]
fn test_webhook_config_with_hmac_auth() {
    // Arrange & Act
    let config = WebhookConfig {
        id: "webhook-5".to_string(),
        workflow_id: "workflow-5".to_string(),
        path: "/api/webhook/hmac".to_string(),
        methods: vec![HttpMethod::POST],
        enabled: true,
        auth: Some(WebhookAuth::Hmac {
            secret: "hmac-secret".to_string(),
            header: "X-Hub-Signature".to_string(),
        }),
        validation: None,
    };
    
    // Assert
    assert!(config.auth.is_some());
    assert!(matches!(config.auth.unwrap(), WebhookAuth::Hmac { .. }));
}

// ================================
// HttpMethod 测试
// ================================

#[test]
fn test_http_method_values() {
    let methods = vec![
        HttpMethod::GET,
        HttpMethod::POST,
        HttpMethod::PUT,
        HttpMethod::DELETE,
        HttpMethod::PATCH,
    ];
    
    for method in methods {
        let json = serde_json::to_string(&method).unwrap();
        let deserialized: HttpMethod = serde_json::from_str(&json).unwrap();
        assert_eq!(method, deserialized);
    }
}

// ================================
// WebhookValidation 测试
// ================================

#[test]
fn test_webhook_validation_with_required_headers() {
    // Arrange & Act
    let validation = WebhookValidation {
        required_headers: Some(vec![
            "Content-Type".to_string(),
            "X-Request-ID".to_string(),
        ]),
        required_params: None,
        json_schema: None,
    };
    
    // Assert
    assert!(validation.required_headers.is_some());
    assert_eq!(validation.required_headers.unwrap().len(), 2);
}

#[test]
fn test_webhook_validation_with_required_params() {
    // Arrange & Act
    let validation = WebhookValidation {
        required_headers: None,
        required_params: Some(vec![
            "api_key".to_string(),
            "timestamp".to_string(),
        ]),
        json_schema: None,
    };
    
    // Assert
    assert!(validation.required_params.is_some());
    assert_eq!(validation.required_params.unwrap().len(), 2);
}

#[test]
fn test_webhook_validation_with_json_schema() {
    // Arrange & Act
    let schema = json!({
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "number"}
        },
        "required": ["name"]
    });
    
    let validation = WebhookValidation {
        required_headers: None,
        required_params: None,
        json_schema: Some(schema),
    };
    
    // Assert
    assert!(validation.json_schema.is_some());
}

// ================================
// WebhookRequest 测试
// ================================

#[test]
fn test_webhook_request_creation() {
    // Arrange & Act
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    
    let mut query = HashMap::new();
    query.insert("key".to_string(), "value".to_string());
    
    let request = WebhookRequest {
        method: HttpMethod::POST,
        path: "/api/webhook/test".to_string(),
        headers,
        query,
        body: Some(json!({"data": "test"})),
    };
    
    // Assert
    assert_eq!(request.method, HttpMethod::POST);
    assert_eq!(request.path, "/api/webhook/test");
    assert_eq!(request.headers.len(), 1);
    assert_eq!(request.query.len(), 1);
    assert!(request.body.is_some());
}

#[test]
fn test_webhook_request_serialization() {
    // Arrange
    let request = WebhookRequest {
        method: HttpMethod::GET,
        path: "/test".to_string(),
        headers: HashMap::new(),
        query: HashMap::new(),
        body: None,
    };
    
    // Act
    let json = serde_json::to_string(&request).unwrap();
    let deserialized: WebhookRequest = serde_json::from_str(&json).unwrap();
    
    // Assert
    assert_eq!(deserialized.method, request.method);
    assert_eq!(deserialized.path, request.path);
}

// ================================
// WebhookResponse 测试
// ================================

#[test]
fn test_webhook_response_success() {
    // Arrange & Act
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    
    let response = WebhookResponse {
        status: 200,
        headers,
        body: Some(json!({"success": true})),
    };
    
    // Assert
    assert_eq!(response.status, 200);
    assert!(response.body.is_some());
}

#[test]
fn test_webhook_response_error() {
    // Arrange & Act
    let response = WebhookResponse {
        status: 400,
        headers: HashMap::new(),
        body: Some(json!({
            "error": "Bad Request",
            "message": "Invalid payload"
        })),
    };
    
    // Assert
    assert_eq!(response.status, 400);
    assert!(response.body.is_some());
}

#[test]
fn test_webhook_response_accepted() {
    // Arrange & Act
    let response = WebhookResponse {
        status: 202,
        headers: HashMap::new(),
        body: Some(json!({
            "message": "Request accepted",
            "execution_id": "exec-123"
        })),
    };
    
    // Assert
    assert_eq!(response.status, 202);
}

#[test]
fn test_webhook_response_serialization() {
    // Arrange
    let response = WebhookResponse {
        status: 200,
        headers: HashMap::new(),
        body: Some(json!({"test": "data"})),
    };
    
    // Act
    let json = serde_json::to_string(&response).unwrap();
    let deserialized: WebhookResponse = serde_json::from_str(&json).unwrap();
    
    // Assert
    assert_eq!(deserialized.status, response.status);
}

