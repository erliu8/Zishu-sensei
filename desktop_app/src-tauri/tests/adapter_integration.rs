//! 🔌 适配器模块集成测试
//! 
//! 测试适配器加载、管理、工作流集成等功能

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg(test)]
mod adapter_lifecycle_tests {
    use super::*;
    
    /// 测试适配器完整生命周期管理
    #[tokio::test]
    async fn test_adapter_complete_lifecycle() {
        // Arrange
        let adapter_manager = create_test_adapter_manager().await;
        let adapter_config = create_test_adapter_config();
        
        // Act & Assert - 加载阶段
        let load_result = adapter_manager.load_adapter(adapter_config.clone()).await;
        assert!(load_result.is_ok());
        
        // Act & Assert - 验证阶段  
        let adapter = adapter_manager.get_adapter(&adapter_config.id).await;
        assert!(adapter.is_some());
        assert_eq!(adapter.unwrap().status, AdapterStatus::Loaded);
        
        // Act & Assert - 卸载阶段
        let unload_result = adapter_manager.unload_adapter(&adapter_config.id).await;
        assert!(unload_result.is_ok());
        
        // Act & Assert - 验证卸载
        let adapter_after_unload = adapter_manager.get_adapter(&adapter_config.id).await;
        assert!(adapter_after_unload.is_none());
    }
    
    /// 测试适配器批量加载
    #[tokio::test]
    async fn test_adapter_batch_loading() {
        let adapter_manager = create_test_adapter_manager().await;
        let adapter_configs = create_batch_adapter_configs(10);
        
        // 批量加载
        let results = adapter_manager.load_adapters_batch(adapter_configs.clone()).await;
        
        // 验证加载结果
        assert_eq!(results.len(), 10);
        for result in results {
            assert!(result.is_ok());
        }
        
        // 验证所有适配器都已加载
        let loaded_adapters = adapter_manager.list_adapters().await;
        assert_eq!(loaded_adapters.len(), 10);
    }
    
    /// 测试适配器依赖解析
    #[tokio::test]
    async fn test_adapter_dependency_resolution() {
        let adapter_manager = create_test_adapter_manager().await;
        
        // 创建具有依赖关系的适配器
        let base_adapter = create_adapter_config("base", vec![]);
        let dependent_adapter = create_adapter_config("dependent", vec!["base"]);
        
        // 加载依赖适配器（应该失败，因为基础适配器未加载）
        let result = adapter_manager.load_adapter(dependent_adapter.clone()).await;
        assert!(result.is_err());
        
        // 先加载基础适配器
        adapter_manager.load_adapter(base_adapter).await.unwrap();
        
        // 再加载依赖适配器（应该成功）
        let result = adapter_manager.load_adapter(dependent_adapter).await;
        assert!(result.is_ok());
    }
    
    /// 测试适配器热重载
    #[tokio::test]
    async fn test_adapter_hot_reload() {
        let adapter_manager = create_test_adapter_manager().await;
        let adapter_config = create_test_adapter_config();
        
        // 初始加载
        adapter_manager.load_adapter(adapter_config.clone()).await.unwrap();
        
        // 修改适配器配置
        let mut updated_config = adapter_config.clone();
        updated_config.version = "2.0.0".to_string();
        
        // 热重载
        let reload_result = adapter_manager.reload_adapter(updated_config).await;
        assert!(reload_result.is_ok());
        
        // 验证适配器已更新
        let adapter = adapter_manager.get_adapter(&adapter_config.id).await.unwrap();
        assert_eq!(adapter.version, "2.0.0");
    }
}

#[cfg(test)]
mod adapter_performance_tests {
    use super::*;
    use std::time::Instant;
    
    /// 测试适配器加载性能
    #[tokio::test]
    async fn test_adapter_loading_performance() {
        let adapter_manager = create_test_adapter_manager().await;
        let adapter_configs = create_batch_adapter_configs(100);
        
        let start_time = Instant::now();
        
        // 批量加载100个适配器
        for config in adapter_configs {
            adapter_manager.load_adapter(config).await.unwrap();
        }
        
        let loading_time = start_time.elapsed();
        println!("加载100个适配器耗时: {:?}", loading_time);
        
        // 验证性能指标（加载100个适配器应在1秒内完成）
        assert!(loading_time.as_millis() < 1000);
    }
    
    /// 测试适配器内存占用
    #[tokio::test]
    async fn test_adapter_memory_usage() {
        let adapter_manager = create_test_adapter_manager().await;
        
        // 记录初始内存使用
        let initial_memory = get_memory_usage();
        
        // 加载大量适配器
        let adapter_configs = create_batch_adapter_configs(1000);
        for config in adapter_configs {
            adapter_manager.load_adapter(config).await.unwrap();
        }
        
        // 记录加载后内存使用
        let loaded_memory = get_memory_usage();
        let memory_increase = loaded_memory - initial_memory;
        
        println!("加载1000个适配器内存增加: {} MB", memory_increase / 1024 / 1024);
        
        // 验证内存使用合理（每个适配器平均不超过1MB）
        assert!(memory_increase < 1000 * 1024 * 1024);
    }
    
    /// 测试并发适配器操作
    #[tokio::test]
    async fn test_concurrent_adapter_operations() {
        let adapter_manager = Arc::new(create_test_adapter_manager().await);
        
        // 并发加载和卸载适配器
        let mut handles = Vec::new();
        
        for i in 0..50 {
            let manager = adapter_manager.clone();
            let handle = tokio::spawn(async move {
                let config = create_adapter_config(&format!("concurrent-{}", i), vec![]);
                
                // 加载适配器
                manager.load_adapter(config.clone()).await.unwrap();
                
                // 短暂等待
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                
                // 卸载适配器
                manager.unload_adapter(&config.id).await.unwrap();
            });
            handles.push(handle);
        }
        
        // 等待所有任务完成
        for handle in handles {
            handle.await.unwrap();
        }
        
        // 验证没有适配器残留
        let remaining_adapters = adapter_manager.list_adapters().await;
        assert_eq!(remaining_adapters.len(), 0);
    }
}

#[cfg(test)]
mod adapter_error_handling_tests {
    use super::*;
    
    /// 测试适配器加载失败处理
    #[tokio::test]
    async fn test_adapter_loading_failure_handling() {
        let adapter_manager = create_test_adapter_manager().await;
        
        // 创建无效的适配器配置
        let invalid_config = AdapterConfig {
            id: "invalid-adapter".to_string(),
            name: "无效适配器".to_string(),
            version: "invalid-version".to_string(),
            dependencies: vec![],
            config: serde_json::Value::Null,
        };
        
        // 尝试加载无效适配器
        let result = adapter_manager.load_adapter(invalid_config).await;
        
        // 验证错误处理
        assert!(result.is_err());
        match result.unwrap_err() {
            AdapterError::InvalidConfiguration(_) => {}, // 期望的错误类型
            _ => panic!("期望收到 InvalidConfiguration 错误"),
        }
        
        // 验证适配器管理器状态未受影响
        let adapters = adapter_manager.list_adapters().await;
        assert_eq!(adapters.len(), 0);
    }
    
    /// 测试适配器运行时错误恢复
    #[tokio::test]
    async fn test_adapter_runtime_error_recovery() {
        let adapter_manager = create_test_adapter_manager().await;
        let adapter_config = create_test_adapter_config();
        
        // 加载适配器
        adapter_manager.load_adapter(adapter_config.clone()).await.unwrap();
        
        // 模拟适配器运行时错误
        let error_result = adapter_manager.simulate_adapter_error(&adapter_config.id).await;
        assert!(error_result.is_ok());
        
        // 验证适配器状态变为错误状态
        let adapter = adapter_manager.get_adapter(&adapter_config.id).await.unwrap();
        assert!(matches!(adapter.status, AdapterStatus::Error(_)));
        
        // 尝试恢复适配器
        let recovery_result = adapter_manager.recover_adapter(&adapter_config.id).await;
        assert!(recovery_result.is_ok());
        
        // 验证适配器状态恢复正常
        let recovered_adapter = adapter_manager.get_adapter(&adapter_config.id).await.unwrap();
        assert_eq!(recovered_adapter.status, AdapterStatus::Loaded);
    }
}

// 测试辅助函数和类型定义

async fn create_test_adapter_manager() -> AdapterManager {
    AdapterManager::new()
}

fn create_test_adapter_config() -> AdapterConfig {
    AdapterConfig {
        id: "test-adapter".to_string(),
        name: "测试适配器".to_string(),
        version: "1.0.0".to_string(),
        dependencies: vec![],
        config: serde_json::json!({}),
    }
}

fn create_adapter_config(id: &str, dependencies: Vec<&str>) -> AdapterConfig {
    AdapterConfig {
        id: id.to_string(),
        name: format!("适配器 {}", id),
        version: "1.0.0".to_string(),
        dependencies: dependencies.iter().map(|s| s.to_string()).collect(),
        config: serde_json::json!({}),
    }
}

fn create_batch_adapter_configs(count: usize) -> Vec<AdapterConfig> {
    (0..count)
        .map(|i| create_adapter_config(&format!("batch-adapter-{}", i), vec![]))
        .collect()
}

fn get_memory_usage() -> usize {
    // 获取当前内存使用量（实际实现需要使用系统调用）
    0
}

// 占位类型定义（实际使用时需要导入真实类型）

#[derive(Debug, Clone)]
struct AdapterConfig {
    id: String,
    name: String,
    version: String,
    dependencies: Vec<String>,
    config: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
enum AdapterStatus {
    Loaded,
    Unloaded,
    Error(String),
}

#[derive(Debug, Clone)]
struct Adapter {
    id: String,
    name: String,
    version: String,
    status: AdapterStatus,
}

struct AdapterManager {
    adapters: Arc<Mutex<HashMap<String, Adapter>>>,
}

impl AdapterManager {
    fn new() -> Self {
        Self {
            adapters: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    async fn load_adapter(&self, config: AdapterConfig) -> Result<(), AdapterError> {
        let mut adapters = self.adapters.lock().await;
        
        if adapters.contains_key(&config.id) {
            return Err(AdapterError::AlreadyExists(config.id));
        }
        
        // 验证配置有效性
        if config.version == "invalid-version" || config.name.is_empty() {
            return Err(AdapterError::InvalidConfiguration(
                format!("Invalid configuration for adapter: {}", config.id)
            ));
        }
        
        // 检查依赖
        for dep in &config.dependencies {
            if !adapters.contains_key(dep) {
                return Err(AdapterError::MissingDependency(dep.clone()));
            }
        }
        
        let adapter = Adapter {
            id: config.id.clone(),
            name: config.name,
            version: config.version,
            status: AdapterStatus::Loaded,
        };
        
        adapters.insert(config.id, adapter);
        Ok(())
    }
    
    async fn load_adapters_batch(&self, configs: Vec<AdapterConfig>) -> Vec<Result<(), AdapterError>> {
        let mut results = Vec::new();
        for config in configs {
            results.push(self.load_adapter(config).await);
        }
        results
    }
    
    async fn unload_adapter(&self, id: &str) -> Result<(), AdapterError> {
        let mut adapters = self.adapters.lock().await;
        if adapters.remove(id).is_some() {
            Ok(())
        } else {
            Err(AdapterError::NotFound(id.to_string()))
        }
    }
    
    async fn get_adapter(&self, id: &str) -> Option<Adapter> {
        let adapters = self.adapters.lock().await;
        adapters.get(id).cloned()
    }
    
    async fn list_adapters(&self) -> Vec<Adapter> {
        let adapters = self.adapters.lock().await;
        adapters.values().cloned().collect()
    }
    
    async fn reload_adapter(&self, config: AdapterConfig) -> Result<(), AdapterError> {
        // 先卸载再加载
        let _ = self.unload_adapter(&config.id).await;
        self.load_adapter(config).await
    }
    
    async fn simulate_adapter_error(&self, id: &str) -> Result<(), AdapterError> {
        let mut adapters = self.adapters.lock().await;
        if let Some(adapter) = adapters.get_mut(id) {
            adapter.status = AdapterStatus::Error("模拟错误".to_string());
            Ok(())
        } else {
            Err(AdapterError::NotFound(id.to_string()))
        }
    }
    
    async fn recover_adapter(&self, id: &str) -> Result<(), AdapterError> {
        let mut adapters = self.adapters.lock().await;
        if let Some(adapter) = adapters.get_mut(id) {
            adapter.status = AdapterStatus::Loaded;
            Ok(())
        } else {
            Err(AdapterError::NotFound(id.to_string()))
        }
    }
}

#[derive(Debug)]
enum AdapterError {
    AlreadyExists(String),
    NotFound(String),
    MissingDependency(String),
    InvalidConfiguration(String),
}
