// 测试Python API桥接功能
use zishu_sensei::utils::bridge::*;
use mockito::{Mock, Server, ServerGuard};

// ========== ApiConfig 测试 ==========

mod api_config {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = ApiConfig::default();
        
        assert_eq!(config.base_url, "http://127.0.0.1:8000");
        assert_eq!(config.timeout, 30);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.retry_delay, 1000);
        assert_eq!(config.enable_cache, true);
        assert_eq!(config.pool_size, 10);
    }

    #[test]
    fn test_custom_config() {
        let config = ApiConfig {
            base_url: "http://localhost:9000".to_string(),
            timeout: 60,
            max_retries: 5,
            retry_delay: 2000,
            enable_cache: false,
            pool_size: 20,
        };
        
        assert_eq!(config.base_url, "http://localhost:9000");
        assert_eq!(config.timeout, 60);
        assert_eq!(config.max_retries, 5);
    }

    #[test]
    fn test_config_serialization() {
        let config = ApiConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ApiConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.base_url, config.base_url);
        assert_eq!(deserialized.timeout, config.timeout);
    }
}

// ========== PythonApiBridge 基础测试 ==========

mod python_api_bridge {
    use super::*;

    #[test]
    fn test_bridge_creation_default() {
        let result = PythonApiBridge::default();
        assert!(result.is_ok());
        
        if let Ok(bridge) = result {
            assert_eq!(bridge.get_request_count(), 0);
            
            let config = bridge.get_config();
            assert_eq!(config.base_url, "http://127.0.0.1:8000");
        }
    }

    #[test]
    fn test_bridge_creation_with_custom_config() {
        let custom_config = ApiConfig {
            base_url: "http://custom.api:8080".to_string(),
            timeout: 45,
            max_retries: 2,
            retry_delay: 500,
            enable_cache: false,
            pool_size: 5,
        };
        
        let result = PythonApiBridge::new(custom_config.clone());
        assert!(result.is_ok());
        
        if let Ok(bridge) = result {
            let config = bridge.get_config();
            assert_eq!(config.base_url, custom_config.base_url);
            assert_eq!(config.timeout, custom_config.timeout);
        }
    }

    #[test]
    fn test_update_config() {
        let bridge = PythonApiBridge::default().unwrap();
        
        let new_config = ApiConfig {
            base_url: "http://new.api:9000".to_string(),
            timeout: 120,
            max_retries: 1,
            retry_delay: 3000,
            enable_cache: true,
            pool_size: 15,
        };
        
        bridge.update_config(new_config.clone());
        
        let updated_config = bridge.get_config();
        assert_eq!(updated_config.base_url, new_config.base_url);
        assert_eq!(updated_config.timeout, new_config.timeout);
    }

    #[test]
    fn test_request_count_initialization() {
        let bridge = PythonApiBridge::default().unwrap();
        assert_eq!(bridge.get_request_count(), 0);
    }

    #[test]
    fn test_build_url() {
        let config = ApiConfig {
            base_url: "http://api.example.com".to_string(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let url = bridge.build_url("/test/endpoint");
        
        assert_eq!(url, "http://api.example.com/test/endpoint");
    }

    #[test]
    fn test_build_url_trailing_slash() {
        let config = ApiConfig {
            base_url: "http://api.example.com/".to_string(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let url = bridge.build_url("/test/endpoint");
        
        assert_eq!(url, "http://api.example.com/test/endpoint");
    }
}

// ========== HTTP GET 请求测试 ==========

mod http_get_requests {
    use super::*;

    #[tokio::test]
    async fn test_get_success() {
        let mut server = Server::new_async().await;
        
        let mock = server.mock("GET", "/api/test")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"result": "success"}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result: Result<serde_json::Value, _> = bridge.get("/api/test").await;
        
        assert!(result.is_ok());
        
        let data = result.unwrap();
        assert_eq!(data["result"], "success");
        
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_get_404_error() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/api/notfound")
            .with_status(404)
            .with_body("Not Found")
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result: Result<serde_json::Value, _> = bridge.get("/api/notfound").await;
        
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_500_error() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/api/error")
            .with_status(500)
            .with_body("Internal Server Error")
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result: Result<serde_json::Value, _> = bridge.get("/api/error").await;
        
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_increments_request_count() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/api/test")
            .with_status(200)
            .with_body(r#"{"result": "ok"}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        
        assert_eq!(bridge.get_request_count(), 0);
        
        let _: Result<serde_json::Value, _> = bridge.get("/api/test").await;
        
        assert_eq!(bridge.get_request_count(), 1);
    }
}

// ========== HTTP POST 请求测试 ==========

mod http_post_requests {
    use super::*;

    #[tokio::test]
    async fn test_post_success() {
        let mut server = Server::new_async().await;
        
        let mock = server.mock("POST", "/api/create")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"id": 123, "status": "created"}"#)
            .match_header("content-type", "application/json")
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        
        let body = serde_json::json!({
            "name": "Test",
            "value": 42
        });
        
        let result: Result<serde_json::Value, _> = bridge.post("/api/create", &body).await;
        
        assert!(result.is_ok());
        
        let data = result.unwrap();
        assert_eq!(data["id"], 123);
        assert_eq!(data["status"], "created");
        
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_post_with_empty_body() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("POST", "/api/empty")
            .with_status(200)
            .with_body(r#"{"result": "ok"}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let empty_body = serde_json::json!({});
        
        let result: Result<serde_json::Value, _> = bridge.post("/api/empty", &empty_body).await;
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_post_increments_request_count() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("POST", "/api/test")
            .with_status(200)
            .with_body(r#"{"result": "ok"}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let body = serde_json::json!({"test": true});
        
        assert_eq!(bridge.get_request_count(), 0);
        
        let _: Result<serde_json::Value, _> = bridge.post("/api/test", &body).await;
        
        assert_eq!(bridge.get_request_count(), 1);
    }
}

// ========== HTTP DELETE 请求测试 ==========

mod http_delete_requests {
    use super::*;

    #[tokio::test]
    async fn test_delete_success() {
        let mut server = Server::new_async().await;
        
        let mock = server.mock("DELETE", "/api/item/123")
            .with_status(200)
            .with_body(r#"{"deleted": true}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result: Result<serde_json::Value, _> = bridge.delete("/api/item/123").await;
        
        assert!(result.is_ok());
        
        let data = result.unwrap();
        assert_eq!(data["deleted"], true);
        
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_delete_increments_request_count() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("DELETE", "/api/test")
            .with_status(200)
            .with_body(r#"{"result": "ok"}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        
        assert_eq!(bridge.get_request_count(), 0);
        
        let _: Result<serde_json::Value, _> = bridge.delete("/api/test").await;
        
        assert_eq!(bridge.get_request_count(), 1);
    }
}

// ========== 重试机制测试 ==========

mod retry_mechanism {
    use super::*;

    #[tokio::test]
    async fn test_post_with_retry_success_first_try() {
        let mut server = Server::new_async().await;
        
        let mock = server.mock("POST", "/api/retry")
            .with_status(200)
            .with_body(r#"{"result": "success"}"#)
            .expect(1)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            max_retries: 3,
            retry_delay: 100,
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let body = serde_json::json!({"test": true});
        
        let result: Result<serde_json::Value, _> = bridge.post_with_retry("/api/retry", &body).await;
        
        assert!(result.is_ok());
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn test_post_with_retry_all_fail() {
        let mut server = Server::new_async().await;
        
        let mock = server.mock("POST", "/api/retry")
            .with_status(500)
            .with_body("Server Error")
            .expect(4) // 初始请求 + 3次重试
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            max_retries: 3,
            retry_delay: 50,
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let body = serde_json::json!({"test": true});
        
        let result: Result<serde_json::Value, _> = bridge.post_with_retry("/api/retry", &body).await;
        
        assert!(result.is_err());
        mock.assert_async().await;
    }
}

// ========== 健康检查测试 ==========

mod health_check {
    use super::*;

    #[tokio::test]
    async fn test_health_check_success() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/health")
            .with_status(200)
            .with_body(r#"{"status": "healthy"}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result = bridge.health_check().await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), true);
    }

    #[tokio::test]
    async fn test_health_check_failure() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/health")
            .with_status(500)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result = bridge.health_check().await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), false);
    }

    #[tokio::test]
    async fn test_health_check_connection_error() {
        let config = ApiConfig {
            base_url: "http://nonexistent.invalid:9999".to_string(),
            timeout: 1,
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result = bridge.health_check().await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), false);
    }
}

// ========== 系统信息测试 ==========

mod system_info {
    use super::*;

    #[tokio::test]
    async fn test_get_system_info() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/system/info")
            .with_status(200)
            .with_body(r#"{"version": "1.0.0", "platform": "linux"}"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result = bridge.get_system_info().await;
        
        assert!(result.is_ok());
        
        let info = result.unwrap();
        assert_eq!(info["version"], "1.0.0");
        assert_eq!(info["platform"], "linux");
    }
}

// ========== 聊天相关数据类型测试 ==========

mod chat_types {
    use super::*;

    #[test]
    fn test_message_role_serialization() {
        let roles = vec![
            MessageRole::System,
            MessageRole::User,
            MessageRole::Assistant,
            MessageRole::Function,
        ];
        
        for role in roles {
            let json = serde_json::to_string(&role).unwrap();
            let deserialized: MessageRole = serde_json::from_str(&json).unwrap();
            
            match role {
                MessageRole::System => assert!(matches!(deserialized, MessageRole::System)),
                MessageRole::User => assert!(matches!(deserialized, MessageRole::User)),
                MessageRole::Assistant => assert!(matches!(deserialized, MessageRole::Assistant)),
                MessageRole::Function => assert!(matches!(deserialized, MessageRole::Function)),
            }
        }
    }

    #[test]
    fn test_chat_message_creation() {
        let message = ChatMessage {
            role: MessageRole::User,
            content: "Hello".to_string(),
        };
        
        assert!(matches!(message.role, MessageRole::User));
        assert_eq!(message.content, "Hello");
    }

    #[test]
    fn test_chat_request_optional_fields() {
        let request = ChatRequest {
            messages: vec![],
            model: None,
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            session_id: None,
        };
        
        let json = serde_json::to_string(&request).unwrap();
        
        // 可选字段不应该出现在JSON中
        assert!(!json.contains("\"model\""));
        assert!(!json.contains("\"adapter\""));
    }

    #[test]
    fn test_chat_request_with_all_fields() {
        let request = ChatRequest {
            messages: vec![],
            model: Some("gpt-3.5-turbo".to_string()),
            adapter: Some("openai".to_string()),
            character_id: Some("char-001".to_string()),
            max_tokens: Some(1000),
            temperature: Some(0.7),
            top_p: Some(0.9),
            stream: Some(false),
            session_id: Some("session-123".to_string()),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        
        assert!(json.contains("\"model\""));
        assert!(json.contains("\"adapter\""));
        assert!(json.contains("\"character_id\""));
    }
}

// ========== 聊天API测试 ==========

mod chat_api {
    use super::*;

    #[tokio::test]
    async fn test_send_chat_message() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("POST", "/chat/completions")
            .with_status(200)
            .with_body(r#"{
                "id": "chat-001",
                "object": "chat.completion",
                "created": 1234567890,
                "model": "gpt-3.5-turbo",
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "Hello!"
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15
                }
            }"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        
        let request = ChatRequest {
            messages: vec![
                ChatMessage {
                    role: MessageRole::User,
                    content: "Hello".to_string(),
                }
            ],
            model: Some("gpt-3.5-turbo".to_string()),
            adapter: None,
            character_id: None,
            max_tokens: None,
            temperature: None,
            top_p: None,
            stream: None,
            session_id: None,
        };
        
        let result = bridge.send_chat_message(request).await;
        
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response.id, "chat-001");
        assert_eq!(response.model, "gpt-3.5-turbo");
        assert_eq!(response.choices.len(), 1);
        assert_eq!(response.usage.total_tokens, 15);
    }

    #[tokio::test]
    async fn test_get_chat_history() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/chat/history/session-123")
            .with_status(200)
            .with_body(r#"{
                "session_id": "session-123",
                "messages": [],
                "total_count": 0
            }"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result = bridge.get_chat_history("session-123", None).await;
        
        assert!(result.is_ok());
        
        let history = result.unwrap();
        assert_eq!(history.session_id, "session-123");
        assert_eq!(history.total_count, 0);
    }

    #[tokio::test]
    async fn test_get_chat_history_with_limit() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/chat/history/session-123?limit=10")
            .with_status(200)
            .with_body(r#"{
                "session_id": "session-123",
                "messages": [],
                "total_count": 0
            }"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result = bridge.get_chat_history("session-123", Some(10)).await;
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_clear_chat_history() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("DELETE", "/chat/history/session-123")
            .with_status(200)
            .with_body(r#"{
                "message": "History cleared",
                "session_id": "session-123"
            }"#)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let result = bridge.clear_chat_history("session-123").await;
        
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response.session_id, "session-123");
    }
}

// ========== Edge Cases 测试 ==========

mod edge_cases {
    use super::*;

    #[tokio::test]
    async fn test_request_count_multiple_requests() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/api/test")
            .with_status(200)
            .with_body(r#"{"result": "ok"}"#)
            .expect(5)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        
        for _ in 0..5 {
            let _: Result<serde_json::Value, _> = bridge.get("/api/test").await;
        }
        
        assert_eq!(bridge.get_request_count(), 5);
    }

    #[test]
    fn test_build_url_with_query_params() {
        let config = ApiConfig {
            base_url: "http://api.example.com".to_string(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let url = bridge.build_url("/api/test?param=value");
        
        assert_eq!(url, "http://api.example.com/api/test?param=value");
    }

    #[test]
    fn test_build_url_without_leading_slash() {
        let config = ApiConfig {
            base_url: "http://api.example.com".to_string(),
            ..Default::default()
        };
        
        let bridge = PythonApiBridge::new(config).unwrap();
        let url = bridge.build_url("api/test");
        
        assert_eq!(url, "http://api.example.com/api/test");
    }

    #[tokio::test]
    async fn test_concurrent_requests() {
        let mut server = Server::new_async().await;
        
        let _mock = server.mock("GET", "/api/concurrent")
            .with_status(200)
            .with_body(r#"{"result": "ok"}"#)
            .expect_at_least(3)
            .create_async()
            .await;
        
        let config = ApiConfig {
            base_url: server.url(),
            ..Default::default()
        };
        
        let bridge = std::sync::Arc::new(PythonApiBridge::new(config).unwrap());
        
        let mut handles = vec![];
        
        for _ in 0..3 {
            let bridge_clone = bridge.clone();
            let handle = tokio::spawn(async move {
                let _: Result<serde_json::Value, _> = bridge_clone.get("/api/concurrent").await;
            });
            handles.push(handle);
        }
        
        for handle in handles {
            handle.await.unwrap();
        }
        
        assert!(bridge.get_request_count() >= 3);
    }
}

