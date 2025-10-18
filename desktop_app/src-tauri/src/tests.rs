//! 🧪 Rust 后端测试示例
//! 
//! 这个文件展示了如何为 Tauri 后端编写测试

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};

/// 测试用的适配器结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestAdapter {
    pub id: String,
    pub name: String,
    pub version: String,
    pub status: AdapterStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AdapterStatus {
    Loaded,
    Unloaded,
    Error(String),
}

/// 适配器管理器
pub struct AdapterManager {
    adapters: Arc<Mutex<HashMap<String, TestAdapter>>>,
}

impl AdapterManager {
    pub fn new() -> Self {
        Self {
            adapters: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 加载适配器
    pub async fn load_adapter(&self, adapter: TestAdapter) -> Result<(), String> {
        let mut adapters = self.adapters.lock().await;
        
        if adapters.contains_key(&adapter.id) {
            return Err(format!("适配器 {} 已存在", adapter.id));
        }
        
        adapters.insert(adapter.id.clone(), adapter);
        Ok(())
    }

    /// 卸载适配器
    pub async fn unload_adapter(&self, id: &str) -> Result<(), String> {
        let mut adapters = self.adapters.lock().await;
        
        if !adapters.contains_key(id) {
            return Err(format!("适配器 {} 不存在", id));
        }
        
        adapters.remove(id);
        Ok(())
    }

    /// 获取适配器列表
    pub async fn list_adapters(&self) -> Vec<TestAdapter> {
        let adapters = self.adapters.lock().await;
        adapters.values().cloned().collect()
    }

    /// 获取适配器状态
    pub async fn get_adapter_status(&self, id: &str) -> Option<AdapterStatus> {
        let adapters = self.adapters.lock().await;
        adapters.get(id).map(|adapter| adapter.status.clone())
    }
}

/// 聊天服务
pub struct ChatService {
    message_history: Arc<Mutex<Vec<ChatMessage>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub sender: MessageSender,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageSender {
    User,
    Assistant,
    System,
}

impl ChatService {
    pub fn new() -> Self {
        Self {
            message_history: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 发送消息
    pub async fn send_message(&self, content: String) -> Result<ChatMessage, String> {
        if content.trim().is_empty() {
            return Err("消息内容不能为空".to_string());
        }

        let message = ChatMessage {
            id: uuid::Uuid::new_v4().to_string(),
            content,
            timestamp: chrono::Utc::now(),
            sender: MessageSender::User,
        };

        let mut history = self.message_history.lock().await;
        history.push(message.clone());
        Ok(message)
    }

    /// 获取消息历史
    pub async fn get_message_history(&self) -> Vec<ChatMessage> {
        let history = self.message_history.lock().await;
        history.clone()
    }

    /// 清空消息历史
    pub async fn clear_history(&self) {
        let mut history = self.message_history.lock().await;
        history.clear();
    }
}

/// 设置服务
pub struct SettingsService {
    settings: Arc<Mutex<HashMap<String, serde_json::Value>>>,
}

impl SettingsService {
    pub fn new() -> Self {
        Self {
            settings: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 设置配置项
    pub async fn set_setting(&self, key: String, value: serde_json::Value) {
        let mut settings = self.settings.lock().await;
        settings.insert(key, value);
    }

    /// 获取配置项
    pub async fn get_setting(&self, key: &str) -> Option<serde_json::Value> {
        let settings = self.settings.lock().await;
        settings.get(key).cloned()
    }

    /// 获取所有配置
    pub async fn get_all_settings(&self) -> HashMap<String, serde_json::Value> {
        let settings = self.settings.lock().await;
        settings.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    /// 测试适配器管理器的基本功能
    #[tokio::test]
    async fn test_adapter_manager_basic_operations() {
        let manager = AdapterManager::new();

        // 测试加载适配器
        let adapter = TestAdapter {
            id: "test-adapter-1".to_string(),
            name: "测试适配器".to_string(),
            version: "1.0.0".to_string(),
            status: AdapterStatus::Loaded,
        };

        // 加载适配器
        let result = manager.load_adapter(adapter.clone()).await;
        assert!(result.is_ok());

        // 检查适配器是否已加载
        let adapters = manager.list_adapters().await;
        assert_eq!(adapters.len(), 1);
        assert_eq!(adapters[0].id, "test-adapter-1");

        // 测试重复加载
        let result = manager.load_adapter(adapter).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("已存在"));

        // 测试卸载适配器
        let result = manager.unload_adapter("test-adapter-1").await;
        assert!(result.is_ok());

        // 检查适配器是否已卸载
        let adapters = manager.list_adapters().await;
        assert_eq!(adapters.len(), 0);

        // 测试卸载不存在的适配器
        let result = manager.unload_adapter("non-existent").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不存在"));
    }

    /// 测试适配器状态管理
    #[tokio::test]
    async fn test_adapter_status_management() {
        let manager = AdapterManager::new();

        let adapter = TestAdapter {
            id: "status-test".to_string(),
            name: "状态测试适配器".to_string(),
            version: "1.0.0".to_string(),
            status: AdapterStatus::Loaded,
        };

        manager.load_adapter(adapter).await.unwrap();

        // 测试获取状态
        let status = manager.get_adapter_status("status-test").await;
        assert!(status.is_some());
        match status.unwrap() {
            AdapterStatus::Loaded => {},
            _ => panic!("期望状态为 Loaded"),
        }

        // 测试获取不存在的适配器状态
        let status = manager.get_adapter_status("non-existent").await;
        assert!(status.is_none());
    }

    /// 测试聊天服务的基本功能
    #[tokio::test]
    async fn test_chat_service_basic_operations() {
        let chat_service = ChatService::new();

        // 测试发送消息
        let message = chat_service.send_message("Hello, World!".to_string()).await;
        assert!(message.is_ok());

        let message = message.unwrap();
        assert_eq!(message.content, "Hello, World!");
        assert!(matches!(message.sender, MessageSender::User));

        // 测试获取消息历史
        let history = chat_service.get_message_history().await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].content, "Hello, World!");

        // 测试发送空消息
        let result = chat_service.send_message("".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不能为空"));

        // 测试发送空白消息
        let result = chat_service.send_message("   ".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不能为空"));

        // 测试清空历史
        chat_service.clear_history().await;
        let history = chat_service.get_message_history().await;
        assert_eq!(history.len(), 0);
    }

    /// 测试设置服务的基本功能
    #[tokio::test]
    async fn test_settings_service_basic_operations() {
        let settings_service = SettingsService::new();

        // 测试设置配置项
        settings_service.set_setting(
            "theme".to_string(),
            serde_json::Value::String("dark".to_string())
        ).await;

        settings_service.set_setting(
            "language".to_string(),
            serde_json::Value::String("zh-CN".to_string())
        ).await;

        // 测试获取配置项
        let theme = settings_service.get_setting("theme").await;
        assert!(theme.is_some());
        assert_eq!(theme.unwrap(), serde_json::Value::String("dark".to_string()));

        // 测试获取不存在的配置项
        let non_existent = settings_service.get_setting("non-existent").await;
        assert!(non_existent.is_none());

        // 测试获取所有配置
        let all_settings = settings_service.get_all_settings().await;
        assert_eq!(all_settings.len(), 2);
        assert!(all_settings.contains_key("theme"));
        assert!(all_settings.contains_key("language"));
    }

    /// 测试并发操作
    #[tokio::test]
    async fn test_concurrent_operations() {
        let manager = AdapterManager::new();
        let chat_service = ChatService::new();

        // 并发加载多个适配器
        let handles: Vec<_> = (0..10).map(|i| {
            let manager = manager.clone();
            tokio::spawn(async move {
                let adapter = TestAdapter {
                    id: format!("concurrent-adapter-{}", i),
                    name: format!("并发适配器 {}", i),
                    version: "1.0.0".to_string(),
                    status: AdapterStatus::Loaded,
                };
                manager.load_adapter(adapter).await
            })
        }).collect();

        // 等待所有任务完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // 检查所有适配器都已加载
        let adapters = manager.list_adapters().await;
        assert_eq!(adapters.len(), 10);

        // 并发发送消息
        let handles: Vec<_> = (0..5).map(|i| {
            let chat_service = chat_service.clone();
            tokio::spawn(async move {
                chat_service.send_message(format!("并发消息 {}", i)).await
            })
        }).collect();

        // 等待所有消息发送完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // 检查所有消息都已发送
        let history = chat_service.get_message_history().await;
        assert_eq!(history.len(), 5);
    }

    /// 测试错误处理
    #[tokio::test]
    async fn test_error_handling() {
        let manager = AdapterManager::new();

        // 测试卸载不存在的适配器
        let result = manager.unload_adapter("non-existent").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不存在"));

        // 测试重复加载适配器
        let adapter = TestAdapter {
            id: "duplicate-test".to_string(),
            name: "重复测试适配器".to_string(),
            version: "1.0.0".to_string(),
            status: AdapterStatus::Loaded,
        };

        manager.load_adapter(adapter.clone()).await.unwrap();
        let result = manager.load_adapter(adapter).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("已存在"));
    }

    /// 测试性能
    #[tokio::test]
    async fn test_performance() {
        let manager = AdapterManager::new();
        let start = std::time::Instant::now();

        // 加载大量适配器
        for i in 0..1000 {
            let adapter = TestAdapter {
                id: format!("perf-adapter-{}", i),
                name: format!("性能测试适配器 {}", i),
                version: "1.0.0".to_string(),
                status: AdapterStatus::Loaded,
            };
            manager.load_adapter(adapter).await.unwrap();
        }

        let load_time = start.elapsed();
        println!("加载 1000 个适配器耗时: {:?}", load_time);

        // 检查加载时间是否合理（小于 1 秒）
        assert!(load_time.as_millis() < 1000);

        // 测试获取列表的性能
        let start = std::time::Instant::now();
        let adapters = manager.list_adapters().await;
        let list_time = start.elapsed();
        println!("获取 1000 个适配器列表耗时: {:?}", list_time);

        assert_eq!(adapters.len(), 1000);
        assert!(list_time.as_millis() < 100);
    }
}

/// 集成测试模块
#[cfg(test)]
mod integration_tests {
    use super::*;

    /// 测试完整的适配器管理流程
    #[tokio::test]
    async fn test_complete_adapter_workflow() {
        let manager = AdapterManager::new();

        // 1. 加载多个适配器
        let adapters = vec![
            TestAdapter {
                id: "workflow-adapter-1".to_string(),
                name: "工作流适配器 1".to_string(),
                version: "1.0.0".to_string(),
                status: AdapterStatus::Loaded,
            },
            TestAdapter {
                id: "workflow-adapter-2".to_string(),
                name: "工作流适配器 2".to_string(),
                version: "2.0.0".to_string(),
                status: AdapterStatus::Unloaded,
            },
        ];

        for adapter in adapters {
            manager.load_adapter(adapter).await.unwrap();
        }

        // 2. 检查所有适配器都已加载
        let loaded_adapters = manager.list_adapters().await;
        assert_eq!(loaded_adapters.len(), 2);

        // 3. 检查特定适配器的状态
        let status1 = manager.get_adapter_status("workflow-adapter-1").await;
        assert!(status1.is_some());
        assert!(matches!(status1.unwrap(), AdapterStatus::Loaded));

        let status2 = manager.get_adapter_status("workflow-adapter-2").await;
        assert!(status2.is_some());
        assert!(matches!(status2.unwrap(), AdapterStatus::Unloaded));

        // 4. 卸载一个适配器
        manager.unload_adapter("workflow-adapter-1").await.unwrap();

        // 5. 检查剩余适配器
        let remaining_adapters = manager.list_adapters().await;
        assert_eq!(remaining_adapters.len(), 1);
        assert_eq!(remaining_adapters[0].id, "workflow-adapter-2");

        // 6. 卸载最后一个适配器
        manager.unload_adapter("workflow-adapter-2").await.unwrap();

        // 7. 检查所有适配器都已卸载
        let empty_adapters = manager.list_adapters().await;
        assert_eq!(empty_adapters.len(), 0);
    }

    /// 测试完整的聊天工作流
    #[tokio::test]
    async fn test_complete_chat_workflow() {
        let chat_service = ChatService::new();

        // 1. 发送多条消息
        let messages = vec![
            "Hello, World!",
            "How are you?",
            "What's the weather like?",
            "Thank you!",
        ];

        for message in messages {
            chat_service.send_message(message.to_string()).await.unwrap();
        }

        // 2. 检查消息历史
        let history = chat_service.get_message_history().await;
        assert_eq!(history.len(), 4);

        // 3. 验证消息内容
        assert_eq!(history[0].content, "Hello, World!");
        assert_eq!(history[1].content, "How are you?");
        assert_eq!(history[2].content, "What's the weather like?");
        assert_eq!(history[3].content, "Thank you!");

        // 4. 验证消息发送者
        for message in &history {
            assert!(matches!(message.sender, MessageSender::User));
        }

        // 5. 验证时间戳
        for i in 1..history.len() {
            assert!(history[i].timestamp >= history[i-1].timestamp);
        }

        // 6. 清空历史
        chat_service.clear_history().await;

        // 7. 检查历史已清空
        let empty_history = chat_service.get_message_history().await;
        assert_eq!(empty_history.len(), 0);
    }
}
