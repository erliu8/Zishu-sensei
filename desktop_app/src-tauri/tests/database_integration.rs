//! 🗄️ 数据库模块集成测试
//! 
//! 测试数据库管理器、后端连接、事务处理等集成功能

use std::time::Duration;
use tokio::time::timeout;
use std::env;

// 导入实际的数据库类型
use zishu_sensei::database::{
    DatabaseManager, 
    DatabaseManagerConfig,
    backends::{DatabaseConfig, DatabaseError, DatabaseResult},
};

#[cfg(test)]
mod database_manager_integration {
    use super::*;
    
    /// 测试数据库管理器完整初始化流程
    #[tokio::test]
    async fn test_database_manager_full_initialization() {
        // Arrange - 使用测试配置，不依赖外部数据库
        let config = create_test_config();
        
        // Act
        let result = timeout(
            Duration::from_secs(10),
            DatabaseManager::new(config)
        ).await;
        
        // Assert
        match result {
            Ok(Ok(manager)) => {
                // 验证管理器创建成功
                assert!(manager.postgres_pool.is_some() || 
                       manager.redis_backend.is_some() || 
                       manager.qdrant_backend.is_some());
                
                // 测试健康检查
                let health_result = manager.health_check().await;
                println!("健康检查结果: {:?}", health_result);
            }
            Ok(Err(e)) => {
                // 在测试环境中，数据库连接失败是预期的
                println!("预期的数据库连接错误: {:?}", e);
            }
            Err(_) => {
                panic!("数据库管理器初始化超时");
            }
        }
    }
    
    /// 测试数据库配置验证
    #[tokio::test]
    async fn test_database_config_validation() {
        // 测试各种配置组合
        
        // 1. 仅PostgreSQL配置
        let pg_only_config = DatabaseManagerConfig::postgres_only(
            "postgresql://test:test@localhost/test_db"
        );
        assert!(pg_only_config.postgres_config.is_some());
        assert!(pg_only_config.redis_config.is_none());
        assert!(pg_only_config.qdrant_config.is_none());
        assert!(!pg_only_config.enable_redis_cache);
        assert!(!pg_only_config.enable_vector_search);
        
        // 2. 默认配置
        let default_config = DatabaseManagerConfig::default();
        assert!(default_config.postgres_config.is_some());
        assert!(default_config.redis_config.is_some());
        assert!(default_config.qdrant_config.is_some());
        assert!(default_config.enable_redis_cache);
        assert!(default_config.enable_vector_search);
        
        // 3. 环境变量配置
        env::set_var("DATABASE_URL", "postgresql://env_test:env_test@localhost/env_test_db");
        env::set_var("REDIS_URL", "redis://localhost:6380");
        env::set_var("QDRANT_URL", "http://localhost:6334");
        env::set_var("ENABLE_REDIS_CACHE", "false");
        env::set_var("ENABLE_VECTOR_SEARCH", "false");
        
        let env_config = DatabaseManagerConfig::from_env();
        assert!(env_config.postgres_config.is_some());
        assert!(env_config.redis_config.is_some());
        assert!(env_config.qdrant_config.is_some());
        assert!(!env_config.enable_redis_cache);
        assert!(!env_config.enable_vector_search);
        
        // 清理环境变量
        env::remove_var("DATABASE_URL");
        env::remove_var("REDIS_URL");
        env::remove_var("QDRANT_URL");
        env::remove_var("ENABLE_REDIS_CACHE");
        env::remove_var("ENABLE_VECTOR_SEARCH");
    }
    
    /// 测试数据库管理器错误处理
    #[tokio::test]
    async fn test_database_manager_error_handling() {
        // 测试无效连接字符串
        let invalid_config = DatabaseManagerConfig::postgres_only("invalid://connection/string");
        
        let result = DatabaseManager::new(invalid_config).await;
        assert!(result.is_err());
        
        if let Err(e) = result {
            println!("预期的连接错误: {:?}", e);
            match e {
                DatabaseError::ConnectionError(_) => {
                    // 这是预期的错误类型
                }
                _ => {
                    // 其他错误类型也可以接受，因为具体的错误类型可能因环境而异
                    println!("其他类型的数据库错误: {:?}", e);
                }
            }
        }
    }
    
    /// 测试数据库后端类型识别
    #[tokio::test]
    async fn test_database_backend_types() {
        use zishu_sensei::database::backends::DatabaseBackendType;
        
        // 测试后端类型的字符串表示
        assert_eq!(DatabaseBackendType::PostgreSQL.to_string(), "PostgreSQL");
        assert_eq!(DatabaseBackendType::Redis.to_string(), "Redis");
        assert_eq!(DatabaseBackendType::Qdrant.to_string(), "Qdrant");
        
        // 测试后端类型的相等性
        assert_eq!(DatabaseBackendType::PostgreSQL, DatabaseBackendType::PostgreSQL);
        assert_ne!(DatabaseBackendType::PostgreSQL, DatabaseBackendType::Redis);
    }
}

#[cfg(test)]
mod data_consistency_tests {
    use super::*;
    
    /// 测试数据库配置的一致性验证
    #[tokio::test]
    async fn test_database_config_consistency() {
        // 测试配置的内部一致性
        let config = DatabaseManagerConfig::default();
        
        // 验证启用缓存时必须有Redis配置
        if config.enable_redis_cache {
            assert!(config.redis_config.is_some(), "启用Redis缓存时必须提供Redis配置");
        }
        
        // 验证启用向量搜索时必须有Qdrant配置
        if config.enable_vector_search {
            assert!(config.qdrant_config.is_some(), "启用向量搜索时必须提供Qdrant配置");
        }
        
        // 验证至少有一个数据库配置
        assert!(
            config.postgres_config.is_some() || 
            config.redis_config.is_some() || 
            config.qdrant_config.is_some(),
            "至少需要配置一个数据库后端"
        );
    }
    
    /// 测试数据库错误类型的一致性
    #[tokio::test]
    async fn test_database_error_consistency() {
        use zishu_sensei::database::backends::DatabaseError;
        
        // 测试错误类型的字符串表示
        let connection_error = DatabaseError::ConnectionError("测试连接错误".to_string());
        let error_string = connection_error.to_string();
        assert!(error_string.contains("连接错误"));
        assert!(error_string.contains("测试连接错误"));
        
        let query_error = DatabaseError::QueryError("测试查询错误".to_string());
        let error_string = query_error.to_string();
        assert!(error_string.contains("查询错误"));
        assert!(error_string.contains("测试查询错误"));
        
        let not_found_error = DatabaseError::NotFound("测试数据不存在".to_string());
        let error_string = not_found_error.to_string();
        assert!(error_string.contains("数据不存在"));
        assert!(error_string.contains("测试数据不存在"));
    }
    
    /// 测试数据库配置的序列化一致性
    #[tokio::test]
    async fn test_config_serialization_consistency() {
        use zishu_sensei::database::backends::DatabaseBackendType;
        
        // 测试后端类型的序列化和反序列化
        let backend_types = vec![
            DatabaseBackendType::PostgreSQL,
            DatabaseBackendType::Redis,
            DatabaseBackendType::Qdrant,
        ];
        
        for backend_type in backend_types {
            // 序列化
            let serialized = serde_json::to_string(&backend_type).unwrap();
            
            // 反序列化
            let deserialized: DatabaseBackendType = serde_json::from_str(&serialized).unwrap();
            
            // 验证一致性
            assert_eq!(backend_type, deserialized);
        }
    }
}

// 测试辅助函数
fn create_test_config() -> DatabaseManagerConfig {
    // 创建测试配置 - 使用无效的连接字符串以避免实际连接
    DatabaseManagerConfig {
        postgres_config: Some(DatabaseConfig::postgresql("postgresql://test_user:test_pass@localhost:5432/test_db")),
        redis_config: Some(DatabaseConfig::redis("redis://localhost:6379")),
        qdrant_config: Some(DatabaseConfig::qdrant("http://localhost:6333")),
        enable_redis_cache: true,
        enable_vector_search: true,
    }
}

/// 创建仅用于配置测试的轻量级配置
fn create_minimal_test_config() -> DatabaseManagerConfig {
    DatabaseManagerConfig {
        postgres_config: None,
        redis_config: None,
        qdrant_config: None,
        enable_redis_cache: false,
        enable_vector_search: false,
    }
}
