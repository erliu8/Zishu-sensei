//! 🔗 Rust 集成测试示例
//! 
//! 这个文件展示了如何为 Tauri 应用编写集成测试

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// 集成测试用的适配器结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationAdapter {
    pub id: String,
    pub name: String,
    pub version: String,
    pub config: HashMap<String, serde_json::Value>,
}

/// 集成测试用的聊天消息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationMessage {
    pub id: String,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// 集成测试用的设置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationSettings {
    pub theme: String,
    pub language: String,
    pub notifications: bool,
    pub auto_start: bool,
}

/// 集成测试管理器
pub struct IntegrationTestManager {
    adapters: Vec<IntegrationAdapter>,
    messages: Vec<IntegrationMessage>,
    settings: IntegrationSettings,
}

impl IntegrationTestManager {
    pub fn new() -> Self {
        Self {
            adapters: Vec::new(),
            messages: Vec::new(),
            settings: IntegrationSettings {
                theme: "light".to_string(),
                language: "en".to_string(),
                notifications: true,
                auto_start: false,
            },
        }
    }

    /// 加载适配器
    pub async fn load_adapter(&mut self, adapter: IntegrationAdapter) -> Result<(), String> {
        if self.adapters.iter().any(|a| a.id == adapter.id) {
            return Err(format!("适配器 {} 已存在", adapter.id));
        }

        self.adapters.push(adapter);
        Ok(())
    }

    /// 卸载适配器
    pub async fn unload_adapter(&mut self, id: &str) -> Result<(), String> {
        let initial_len = self.adapters.len();
        self.adapters.retain(|a| a.id != id);
        
        if self.adapters.len() == initial_len {
            return Err(format!("适配器 {} 不存在", id));
        }
        
        Ok(())
    }

    /// 发送消息
    pub async fn send_message(&mut self, content: String) -> Result<IntegrationMessage, String> {
        if content.trim().is_empty() {
            return Err("消息内容不能为空".to_string());
        }

        let message = IntegrationMessage {
            id: uuid::Uuid::new_v4().to_string(),
            content,
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
        };

        self.messages.push(message.clone());
        Ok(message)
    }

    /// 更新设置
    pub async fn update_settings(&mut self, settings: IntegrationSettings) {
        self.settings = settings;
    }

    /// 获取适配器列表
    pub async fn list_adapters(&self) -> Vec<IntegrationAdapter> {
        self.adapters.clone()
    }

    /// 获取消息历史
    pub async fn get_message_history(&self) -> Vec<IntegrationMessage> {
        self.messages.clone()
    }

    /// 获取当前设置
    pub async fn get_settings(&self) -> IntegrationSettings {
        self.settings.clone()
    }
}

/// 模拟 Tauri 命令
pub mod tauri_commands {
    use super::*;

    /// 模拟加载适配器命令
    pub async fn load_adapter_command(
        manager: &mut IntegrationTestManager,
        adapter_data: serde_json::Value,
    ) -> Result<String, String> {
        let adapter: IntegrationAdapter = serde_json::from_value(adapter_data)
            .map_err(|e| format!("解析适配器数据失败: {}", e))?;

        manager.load_adapter(adapter).await?;
        Ok("适配器加载成功".to_string())
    }

    /// 模拟卸载适配器命令
    pub async fn unload_adapter_command(
        manager: &mut IntegrationTestManager,
        adapter_id: String,
    ) -> Result<String, String> {
        manager.unload_adapter(&adapter_id).await?;
        Ok("适配器卸载成功".to_string())
    }

    /// 模拟发送消息命令
    pub async fn send_message_command(
        manager: &mut IntegrationTestManager,
        content: String,
    ) -> Result<String, String> {
        let message = manager.send_message(content).await?;
        Ok(format!("消息发送成功: {}", message.id))
    }

    /// 模拟获取适配器列表命令
    pub async fn list_adapters_command(
        manager: &IntegrationTestManager,
    ) -> Result<Vec<IntegrationAdapter>, String> {
        Ok(manager.list_adapters().await)
    }

    /// 模拟获取消息历史命令
    pub async fn get_message_history_command(
        manager: &IntegrationTestManager,
    ) -> Result<Vec<IntegrationMessage>, String> {
        Ok(manager.get_message_history().await)
    }

    /// 模拟更新设置命令
    pub async fn update_settings_command(
        manager: &mut IntegrationTestManager,
        settings_data: serde_json::Value,
    ) -> Result<String, String> {
        let settings: IntegrationSettings = serde_json::from_value(settings_data)
            .map_err(|e| format!("解析设置数据失败: {}", e))?;

        manager.update_settings(settings).await;
        Ok("设置更新成功".to_string())
    }
}

/// 模拟事件系统
pub mod event_system {
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Event {
        pub id: String,
        pub event_type: String,
        pub data: serde_json::Value,
        pub timestamp: chrono::DateTime<chrono::Utc>,
    }

    pub struct EventManager {
        events: Arc<Mutex<Vec<Event>>>,
        listeners: Arc<Mutex<Vec<Box<dyn Fn(Event) + Send + Sync>>>>,
    }

    impl EventManager {
        pub fn new() -> Self {
            Self {
                events: Arc::new(Mutex::new(Vec::new())),
                listeners: Arc::new(Mutex::new(Vec::new())),
            }
        }

        pub async fn emit_event(&self, event_type: String, data: serde_json::Value) {
            let event = Event {
                id: uuid::Uuid::new_v4().to_string(),
                event_type,
                data,
                timestamp: chrono::Utc::now(),
            };

            // 存储事件
            {
                let mut events = self.events.lock().await;
                events.push(event.clone());
            }

            // 通知监听器
            {
                let listeners = self.listeners.lock().await;
                for listener in listeners.iter() {
                    listener(event.clone());
                }
            }
        }

        pub async fn get_events(&self) -> Vec<Event> {
            let events = self.events.lock().await;
            events.clone()
        }

        pub async fn clear_events(&self) {
            let mut events = self.events.lock().await;
            events.clear();
        }
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use tokio_test;

    /// 测试完整的适配器管理流程
    #[tokio::test]
    async fn test_complete_adapter_management_workflow() {
        let mut manager = IntegrationTestManager::new();

        // 1. 加载多个适配器
        let adapters = vec![
            IntegrationAdapter {
                id: "integration-adapter-1".to_string(),
                name: "集成测试适配器 1".to_string(),
                version: "1.0.0".to_string(),
                config: HashMap::new(),
            },
            IntegrationAdapter {
                id: "integration-adapter-2".to_string(),
                name: "集成测试适配器 2".to_string(),
                version: "2.0.0".to_string(),
                config: HashMap::new(),
            },
        ];

        for adapter in adapters {
            manager.load_adapter(adapter).await.unwrap();
        }

        // 2. 验证适配器已加载
        let loaded_adapters = manager.list_adapters().await;
        assert_eq!(loaded_adapters.len(), 2);

        // 3. 卸载一个适配器
        manager.unload_adapter("integration-adapter-1").await.unwrap();

        // 4. 验证适配器已卸载
        let remaining_adapters = manager.list_adapters().await;
        assert_eq!(remaining_adapters.len(), 1);
        assert_eq!(remaining_adapters[0].id, "integration-adapter-2");

        // 5. 卸载最后一个适配器
        manager.unload_adapter("integration-adapter-2").await.unwrap();

        // 6. 验证所有适配器都已卸载
        let empty_adapters = manager.list_adapters().await;
        assert_eq!(empty_adapters.len(), 0);
    }

    /// 测试完整的聊天工作流
    #[tokio::test]
    async fn test_complete_chat_workflow() {
        let mut manager = IntegrationTestManager::new();

        // 1. 发送多条消息
        let messages = vec![
            "Hello, World!",
            "How are you?",
            "What's the weather like?",
            "Thank you!",
        ];

        for message in messages {
            manager.send_message(message.to_string()).await.unwrap();
        }

        // 2. 验证消息历史
        let history = manager.get_message_history().await;
        assert_eq!(history.len(), 4);

        // 3. 验证消息内容
        assert_eq!(history[0].content, "Hello, World!");
        assert_eq!(history[1].content, "How are you?");
        assert_eq!(history[2].content, "What's the weather like?");
        assert_eq!(history[3].content, "Thank you!");

        // 4. 验证时间戳顺序
        for i in 1..history.len() {
            assert!(history[i].timestamp >= history[i-1].timestamp);
        }
    }

    /// 测试设置管理流程
    #[tokio::test]
    async fn test_settings_management_workflow() {
        let mut manager = IntegrationTestManager::new();

        // 1. 获取默认设置
        let default_settings = manager.get_settings().await;
        assert_eq!(default_settings.theme, "light");
        assert_eq!(default_settings.language, "en");
        assert!(default_settings.notifications);
        assert!(!default_settings.auto_start);

        // 2. 更新设置
        let new_settings = IntegrationSettings {
            theme: "dark".to_string(),
            language: "zh-CN".to_string(),
            notifications: false,
            auto_start: true,
        };

        manager.update_settings(new_settings).await;

        // 3. 验证设置已更新
        let updated_settings = manager.get_settings().await;
        assert_eq!(updated_settings.theme, "dark");
        assert_eq!(updated_settings.language, "zh-CN");
        assert!(!updated_settings.notifications);
        assert!(updated_settings.auto_start);
    }

    /// 测试 Tauri 命令集成
    #[tokio::test]
    async fn test_tauri_commands_integration() {
        let mut manager = IntegrationTestManager::new();

        // 1. 测试加载适配器命令
        let adapter_data = serde_json::json!({
            "id": "command-adapter-1",
            "name": "命令测试适配器",
            "version": "1.0.0",
            "config": {}
        });

        let result = tauri_commands::load_adapter_command(&mut manager, adapter_data).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "适配器加载成功");

        // 2. 测试获取适配器列表命令
        let adapters = tauri_commands::list_adapters_command(&manager).await.unwrap();
        assert_eq!(adapters.len(), 1);
        assert_eq!(adapters[0].id, "command-adapter-1");

        // 3. 测试发送消息命令
        let result = tauri_commands::send_message_command(
            &mut manager,
            "测试消息".to_string()
        ).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("消息发送成功"));

        // 4. 测试获取消息历史命令
        let messages = tauri_commands::get_message_history_command(&manager).await.unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "测试消息");

        // 5. 测试更新设置命令
        let settings_data = serde_json::json!({
            "theme": "dark",
            "language": "zh-CN",
            "notifications": false,
            "auto_start": true
        });

        let result = tauri_commands::update_settings_command(&mut manager, settings_data).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "设置更新成功");

        // 6. 测试卸载适配器命令
        let result = tauri_commands::unload_adapter_command(
            &mut manager,
            "command-adapter-1".to_string()
        ).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "适配器卸载成功");

        // 7. 验证适配器已卸载
        let adapters = tauri_commands::list_adapters_command(&manager).await.unwrap();
        assert_eq!(adapters.len(), 0);
    }

    /// 测试事件系统集成
    #[tokio::test]
    async fn test_event_system_integration() {
        let event_manager = event_system::EventManager::new();

        // 1. 发送多个事件
        event_manager.emit_event(
            "adapter_loaded".to_string(),
            serde_json::json!({"adapter_id": "test-adapter"})
        ).await;

        event_manager.emit_event(
            "message_sent".to_string(),
            serde_json::json!({"message_id": "test-message"})
        ).await;

        event_manager.emit_event(
            "settings_updated".to_string(),
            serde_json::json!({"theme": "dark"})
        ).await;

        // 2. 验证事件已发送
        let events = event_manager.get_events().await;
        assert_eq!(events.len(), 3);

        // 3. 验证事件类型
        assert_eq!(events[0].event_type, "adapter_loaded");
        assert_eq!(events[1].event_type, "message_sent");
        assert_eq!(events[2].event_type, "settings_updated");

        // 4. 验证事件数据
        assert_eq!(events[0].data["adapter_id"], "test-adapter");
        assert_eq!(events[1].data["message_id"], "test-message");
        assert_eq!(events[2].data["theme"], "dark");

        // 5. 验证时间戳顺序
        for i in 1..events.len() {
            assert!(events[i].timestamp >= events[i-1].timestamp);
        }

        // 6. 清空事件
        event_manager.clear_events().await;

        // 7. 验证事件已清空
        let empty_events = event_manager.get_events().await;
        assert_eq!(empty_events.len(), 0);
    }

    /// 测试错误处理集成
    #[tokio::test]
    async fn test_error_handling_integration() {
        let mut manager = IntegrationTestManager::new();

        // 1. 测试加载重复适配器
        let adapter = IntegrationAdapter {
            id: "duplicate-adapter".to_string(),
            name: "重复适配器".to_string(),
            version: "1.0.0".to_string(),
            config: HashMap::new(),
        };

        manager.load_adapter(adapter.clone()).await.unwrap();
        let result = manager.load_adapter(adapter).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("已存在"));

        // 2. 测试卸载不存在的适配器
        let result = manager.unload_adapter("non-existent").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不存在"));

        // 3. 测试发送空消息
        let result = manager.send_message("".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不能为空"));

        // 4. 测试发送空白消息
        let result = manager.send_message("   ".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("不能为空"));
    }

    /// 测试并发操作集成
    #[tokio::test]
    async fn test_concurrent_operations_integration() {
        let manager = Arc::new(tokio::sync::Mutex::new(IntegrationTestManager::new()));

        // 并发加载多个适配器
        let handles: Vec<_> = (0..10).map(|i| {
            let manager = manager.clone();
            tokio::spawn(async move {
                let mut manager = manager.lock().await;
                let adapter = IntegrationAdapter {
                    id: format!("concurrent-adapter-{}", i),
                    name: format!("并发适配器 {}", i),
                    version: "1.0.0".to_string(),
                    config: HashMap::new(),
                };
                manager.load_adapter(adapter).await
            })
        }).collect();

        // 等待所有任务完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // 验证所有适配器都已加载
        let manager = manager.lock().await;
        let adapters = manager.list_adapters().await;
        assert_eq!(adapters.len(), 10);

        // 并发发送消息
        let handles: Vec<_> = (0..5).map(|i| {
            let manager = manager.clone();
            tokio::spawn(async move {
                let mut manager = manager.lock().await;
                manager.send_message(format!("并发消息 {}", i)).await
            })
        }).collect();

        // 等待所有消息发送完成
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // 验证所有消息都已发送
        let manager = manager.lock().await;
        let messages = manager.get_message_history().await;
        assert_eq!(messages.len(), 5);
    }

    /// 测试性能集成
    #[tokio::test]
    async fn test_performance_integration() {
        let mut manager = IntegrationTestManager::new();
        let start = std::time::Instant::now();

        // 加载大量适配器
        for i in 0..1000 {
            let adapter = IntegrationAdapter {
                id: format!("perf-adapter-{}", i),
                name: format!("性能测试适配器 {}", i),
                version: "1.0.0".to_string(),
                config: HashMap::new(),
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
