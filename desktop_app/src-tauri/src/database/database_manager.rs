//! 统一数据库管理器
//!
//! 整合 PostgreSQL、Redis 和 Qdrant，提供统一的访问接口

use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use deadpool_postgres::Pool as PostgresPool;
use redis::aio::ConnectionManager as RedisConnectionManager;
use qdrant_client::prelude::*;

use super::backends::{DatabaseConfig, DatabaseError, DatabaseResult};
use super::redis_backend::RedisBackend;
use super::qdrant_backend::QdrantBackend;

/// 统一数据库管理器
#[derive(Debug)]
pub struct DatabaseManager {
    /// PostgreSQL 连接池
    pub postgres_pool: Option<Arc<PostgresPool>>,
    
    /// Redis 后端
    pub redis_backend: Option<Arc<RwLock<RedisBackend>>>,
    
    /// Qdrant 后端
    pub qdrant_backend: Option<Arc<RwLock<QdrantBackend>>>,
    
    /// 配置
    config: DatabaseManagerConfig,
}

/// 数据库管理器配置
#[derive(Debug, Clone)]
pub struct DatabaseManagerConfig {
    /// PostgreSQL 配置
    pub postgres_config: Option<DatabaseConfig>,
    
    /// Redis 配置
    pub redis_config: Option<DatabaseConfig>,
    
    /// Qdrant 配置
    pub qdrant_config: Option<DatabaseConfig>,
    
    /// 是否启用 Redis 缓存
    pub enable_redis_cache: bool,
    
    /// 是否启用 Qdrant 向量搜索
    pub enable_vector_search: bool,
}

impl Default for DatabaseManagerConfig {
    fn default() -> Self {
        Self {
            postgres_config: Some(DatabaseConfig::postgresql(
                "postgresql://zishu:zishu@localhost/zishu_sensei"
            )),
            redis_config: Some(DatabaseConfig::redis("redis://localhost:6379")),
            qdrant_config: Some(DatabaseConfig::qdrant("http://localhost:6333")),
            enable_redis_cache: true,
            enable_vector_search: true,
        }
    }
}

impl DatabaseManagerConfig {
    /// 从环境变量加载配置
    pub fn from_env() -> Self {
        let postgres_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://zishu:zishu@localhost/zishu_sensei".to_string());
        
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());
        
        let qdrant_url = std::env::var("QDRANT_URL")
            .unwrap_or_else(|_| "http://localhost:6333".to_string());
        
        let enable_redis = std::env::var("ENABLE_REDIS_CACHE")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true);
        
        let enable_qdrant = std::env::var("ENABLE_VECTOR_SEARCH")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true);
        
        Self {
            postgres_config: Some(DatabaseConfig::postgresql(&postgres_url)),
            redis_config: Some(DatabaseConfig::redis(&redis_url)),
            qdrant_config: Some(DatabaseConfig::qdrant(&qdrant_url)),
            enable_redis_cache: enable_redis,
            enable_vector_search: enable_qdrant,
        }
    }
    
    /// 创建仅使用 PostgreSQL 的配置
    pub fn postgres_only(connection_string: &str) -> Self {
        Self {
            postgres_config: Some(DatabaseConfig::postgresql(connection_string)),
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        }
    }
}

impl DatabaseManager {
    /// 创建新的数据库管理器
    pub async fn new(config: DatabaseManagerConfig) -> DatabaseResult<Self> {
        info!("初始化数据库管理器");
        
        let mut manager = Self {
            postgres_pool: None,
            redis_backend: None,
            qdrant_backend: None,
            config: config.clone(),
        };
        
        // 初始化 PostgreSQL
        if let Some(pg_config) = &config.postgres_config {
            match manager.init_postgres(pg_config).await {
                Ok(pool) => {
                    manager.postgres_pool = Some(Arc::new(pool));
                    info!("PostgreSQL 初始化成功");
                }
                Err(e) => {
                    error!("PostgreSQL 初始化失败: {}", e);
                    return Err(e);
                }
            }
        }
        
        // 初始化 Redis（可选）
        if config.enable_redis_cache {
            if let Some(redis_config) = &config.redis_config {
                match manager.init_redis(redis_config).await {
                    Ok(backend) => {
                        manager.redis_backend = Some(Arc::new(RwLock::new(backend)));
                        info!("Redis 缓存初始化成功");
                    }
                    Err(e) => {
                        warn!("Redis 初始化失败（将继续运行但不使用缓存）: {}", e);
                    }
                }
            }
        }
        
        // 初始化 Qdrant（可选）
        if config.enable_vector_search {
            if let Some(qdrant_config) = &config.qdrant_config {
                match manager.init_qdrant(qdrant_config).await {
                    Ok(backend) => {
                        manager.qdrant_backend = Some(Arc::new(RwLock::new(backend)));
                        info!("Qdrant 向量搜索初始化成功");
                    }
                    Err(e) => {
                        warn!("Qdrant 初始化失败（将继续运行但不使用向量搜索）: {}", e);
                    }
                }
            }
        }
        
        info!("数据库管理器初始化完成");
        Ok(manager)
    }
    
    /// 初始化 PostgreSQL
    async fn init_postgres(&self, config: &DatabaseConfig) -> DatabaseResult<PostgresPool> {
        use deadpool_postgres::{Config, Runtime};
        use tokio_postgres::NoTls;
        
        // 解析连接字符串
        let pg_config = config.connection_string.parse::<tokio_postgres::Config>()
            .map_err(|e| DatabaseError::ConnectionError(
                format!("解析PostgreSQL连接字符串失败: {}", e)
            ))?;
        
        let mut cfg = Config::new();
        cfg.host = pg_config.get_hosts().get(0).and_then(|h| {
            match h {
                tokio_postgres::config::Host::Tcp(s) => Some(s.clone()),
                _ => None,
            }
        });
        cfg.dbname = pg_config.get_dbname().map(|s| s.to_string());
        cfg.user = pg_config.get_user().map(|s| s.to_string());
        cfg.password = pg_config.get_password().map(|p| {
            String::from_utf8_lossy(p).to_string()
        });
        
        let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)
            .map_err(|e| DatabaseError::ConnectionError(
                format!("创建PostgreSQL连接池失败: {}", e)
            ))?;
        
        // 测试连接
        let client = pool.get().await
            .map_err(|e| DatabaseError::ConnectionError(
                format!("获取PostgreSQL连接失败: {}", e)
            ))?;
        
        client.execute("SELECT 1", &[]).await
            .map_err(|e| DatabaseError::ConnectionError(
                format!("PostgreSQL连接测试失败: {}", e)
            ))?;
        
        Ok(pool)
    }
    
    /// 初始化 Redis
    async fn init_redis(&self, config: &DatabaseConfig) -> DatabaseResult<RedisBackend> {
        use super::backends::DatabaseBackend;
        
        let mut backend = RedisBackend::new();
        backend.connect(config).await?;
        
        Ok(backend)
    }
    
    /// 初始化 Qdrant
    async fn init_qdrant(&self, config: &DatabaseConfig) -> DatabaseResult<QdrantBackend> {
        use super::backends::DatabaseBackend;
        
        let mut backend = QdrantBackend::new();
        backend.connect(config).await?;
        
        Ok(backend)
    }
    
    /// 获取 PostgreSQL 连接池
    pub fn postgres(&self) -> DatabaseResult<Arc<PostgresPool>> {
        self.postgres_pool
            .clone()
            .ok_or_else(|| DatabaseError::ConnectionError("PostgreSQL未初始化".to_string()))
    }
    
    /// 获取 Redis 后端
    pub fn redis(&self) -> Option<Arc<RwLock<RedisBackend>>> {
        self.redis_backend.clone()
    }
    
    /// 获取 Qdrant 后端
    pub fn qdrant(&self) -> Option<Arc<RwLock<QdrantBackend>>> {
        self.qdrant_backend.clone()
    }
    
    /// 检查 Redis 是否可用
    pub fn is_redis_available(&self) -> bool {
        self.redis_backend.is_some()
    }
    
    /// 检查 Qdrant 是否可用
    pub fn is_qdrant_available(&self) -> bool {
        self.qdrant_backend.is_some()
    }
    
    /// 关闭所有连接
    pub async fn close(&mut self) -> DatabaseResult<()> {
        info!("关闭数据库管理器");
        
        // 关闭 Redis
        if let Some(redis) = &self.redis_backend {
            use super::backends::DatabaseBackend;
            if let Err(e) = redis.write().await.disconnect().await {
                warn!("关闭Redis连接失败: {}", e);
            }
        }
        
        // 关闭 Qdrant
        if let Some(qdrant) = &self.qdrant_backend {
            use super::backends::DatabaseBackend;
            if let Err(e) = qdrant.write().await.disconnect().await {
                warn!("关闭Qdrant连接失败: {}", e);
            }
        }
        
        // PostgreSQL 连接池会自动清理
        self.postgres_pool = None;
        self.redis_backend = None;
        self.qdrant_backend = None;
        
        info!("数据库管理器已关闭");
        Ok(())
    }
    
    /// 健康检查
    pub async fn health_check(&self) -> HealthCheckResult {
        let mut result = HealthCheckResult::default();
        
        // 检查 PostgreSQL
        if let Some(pool) = &self.postgres_pool {
            match pool.get().await {
                Ok(client) => {
                    match client.execute("SELECT 1", &[]).await {
                        Ok(_) => {
                            result.postgres_healthy = true;
                        }
                        Err(e) => {
                            result.postgres_error = Some(e.to_string());
                        }
                    }
                }
                Err(e) => {
                    result.postgres_error = Some(e.to_string());
                }
            }
        } else {
            result.postgres_error = Some("未初始化".to_string());
        }
        
        // 检查 Redis
        if let Some(redis) = &self.redis_backend {
            use super::backends::DatabaseBackend;
            result.redis_healthy = redis.read().await.is_connected();
            if !result.redis_healthy {
                result.redis_error = Some("连接断开".to_string());
            }
        } else {
            result.redis_error = Some("未启用".to_string());
        }
        
        // 检查 Qdrant
        if let Some(qdrant) = &self.qdrant_backend {
            use super::backends::DatabaseBackend;
            result.qdrant_healthy = qdrant.read().await.is_connected();
            if !result.qdrant_healthy {
                result.qdrant_error = Some("连接断开".to_string());
            }
        } else {
            result.qdrant_error = Some("未启用".to_string());
        }
        
        result
    }
}

/// 健康检查结果
#[derive(Debug, Clone, Default)]
pub struct HealthCheckResult {
    /// PostgreSQL 是否健康
    pub postgres_healthy: bool,
    /// PostgreSQL 错误信息
    pub postgres_error: Option<String>,
    
    /// Redis 是否健康
    pub redis_healthy: bool,
    /// Redis 错误信息
    pub redis_error: Option<String>,
    
    /// Qdrant 是否健康
    pub qdrant_healthy: bool,
    /// Qdrant 错误信息
    pub qdrant_error: Option<String>,
}

impl HealthCheckResult {
    /// 所有服务是否健康
    pub fn is_all_healthy(&self) -> bool {
        self.postgres_healthy && self.redis_healthy && self.qdrant_healthy
    }
    
    /// 核心服务（PostgreSQL）是否健康
    pub fn is_core_healthy(&self) -> bool {
        self.postgres_healthy
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Once;
    use tokio::runtime::Runtime;

    static INIT: Once = Once::new();

    fn init_test_env() {
        INIT.call_once(|| {
            // 初始化测试环境
            let _ = tracing_subscriber::fmt()
                .with_test_writer()
                .try_init();
        });
    }

    // ===== DatabaseManagerConfig 测试 =====

    #[test]
    fn test_database_manager_config_default() {
        init_test_env();

        // Arrange & Act
        let config = DatabaseManagerConfig::default();

        // Assert
        assert!(config.postgres_config.is_some());
        assert!(config.redis_config.is_some());
        assert!(config.qdrant_config.is_some());
        assert!(config.enable_redis_cache);
        assert!(config.enable_vector_search);

        // 验证默认连接字符串
        if let Some(pg_config) = &config.postgres_config {
            assert!(pg_config.connection_string.contains("zishu:zishu@localhost/zishu_sensei"));
        }
        if let Some(redis_config) = &config.redis_config {
            assert_eq!(redis_config.connection_string, "redis://localhost:6379");
        }
        if let Some(qdrant_config) = &config.qdrant_config {
            assert_eq!(qdrant_config.connection_string, "http://localhost:6333");
        }
    }

    #[test]
    fn test_database_manager_config_from_env_with_all_vars() {
        init_test_env();

        // Arrange
        std::env::set_var("DATABASE_URL", "postgresql://test:test@localhost/test_db");
        std::env::set_var("REDIS_URL", "redis://localhost:6380");
        std::env::set_var("QDRANT_URL", "http://localhost:6334");
        std::env::set_var("ENABLE_REDIS_CACHE", "true");
        std::env::set_var("ENABLE_VECTOR_SEARCH", "false");

        // Act
        let config = DatabaseManagerConfig::from_env();

        // Assert
        assert!(config.postgres_config.is_some());
        assert!(config.redis_config.is_some());
        assert!(config.qdrant_config.is_some());
        assert!(config.enable_redis_cache);
        assert!(!config.enable_vector_search);

        if let Some(pg_config) = &config.postgres_config {
            assert_eq!(pg_config.connection_string, "postgresql://test:test@localhost/test_db");
        }
        if let Some(redis_config) = &config.redis_config {
            assert_eq!(redis_config.connection_string, "redis://localhost:6380");
        }
        if let Some(qdrant_config) = &config.qdrant_config {
            assert_eq!(qdrant_config.connection_string, "http://localhost:6334");
        }

        // Cleanup
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("REDIS_URL");
        std::env::remove_var("QDRANT_URL");
        std::env::remove_var("ENABLE_REDIS_CACHE");
        std::env::remove_var("ENABLE_VECTOR_SEARCH");
    }

    #[test]
    fn test_database_manager_config_from_env_with_defaults() {
        init_test_env();

        // Arrange - 清除环境变量以使用默认值
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("REDIS_URL");
        std::env::remove_var("QDRANT_URL");
        std::env::remove_var("ENABLE_REDIS_CACHE");
        std::env::remove_var("ENABLE_VECTOR_SEARCH");

        // Act
        let config = DatabaseManagerConfig::from_env();

        // Assert - 应该使用默认值
        assert!(config.postgres_config.is_some());
        assert!(config.redis_config.is_some());
        assert!(config.qdrant_config.is_some());
        assert!(config.enable_redis_cache);
        assert!(config.enable_vector_search);
    }

    #[test]
    fn test_database_manager_config_from_env_invalid_boolean() {
        init_test_env();

        // Arrange
        std::env::set_var("ENABLE_REDIS_CACHE", "invalid_value");
        std::env::set_var("ENABLE_VECTOR_SEARCH", "not_a_boolean");

        // Act
        let config = DatabaseManagerConfig::from_env();

        // Assert - 无效值应该使用默认值true
        assert!(config.enable_redis_cache);
        assert!(config.enable_vector_search);

        // Cleanup
        std::env::remove_var("ENABLE_REDIS_CACHE");
        std::env::remove_var("ENABLE_VECTOR_SEARCH");
    }

    #[test]
    fn test_database_manager_config_postgres_only() {
        init_test_env();

        // Arrange
        let connection_string = "postgresql://test@localhost/test_db";

        // Act
        let config = DatabaseManagerConfig::postgres_only(connection_string);

        // Assert
        assert!(config.postgres_config.is_some());
        assert!(config.redis_config.is_none());
        assert!(config.qdrant_config.is_none());
        assert!(!config.enable_redis_cache);
        assert!(!config.enable_vector_search);

        if let Some(pg_config) = &config.postgres_config {
            assert_eq!(pg_config.connection_string, connection_string);
        }
    }

    // ===== HealthCheckResult 测试 =====

    #[test]
    fn test_health_check_result_all_healthy() {
        init_test_env();

        // Arrange
        let result = HealthCheckResult {
            postgres_healthy: true,
            postgres_error: None,
            redis_healthy: true,
            redis_error: None,
            qdrant_healthy: true,
            qdrant_error: None,
        };

        // Act & Assert
        assert!(result.is_all_healthy());
        assert!(result.is_core_healthy());
    }

    #[test]
    fn test_health_check_result_postgres_unhealthy() {
        init_test_env();

        // Arrange
        let result = HealthCheckResult {
            postgres_healthy: false,
            postgres_error: Some("连接失败".to_string()),
            redis_healthy: true,
            redis_error: None,
            qdrant_healthy: true,
            qdrant_error: None,
        };

        // Act & Assert
        assert!(!result.is_all_healthy());
        assert!(!result.is_core_healthy());
    }

    #[test]
    fn test_health_check_result_redis_unhealthy() {
        init_test_env();

        // Arrange
        let result = HealthCheckResult {
            postgres_healthy: true,
            postgres_error: None,
            redis_healthy: false,
            redis_error: Some("Redis连接断开".to_string()),
            qdrant_healthy: true,
            qdrant_error: None,
        };

        // Act & Assert
        assert!(!result.is_all_healthy());
        assert!(result.is_core_healthy()); // 只有PostgreSQL是核心服务
    }

    #[test]
    fn test_health_check_result_qdrant_unhealthy() {
        init_test_env();

        // Arrange
        let result = HealthCheckResult {
            postgres_healthy: true,
            postgres_error: None,
            redis_healthy: true,
            redis_error: None,
            qdrant_healthy: false,
            qdrant_error: Some("Qdrant服务不可用".to_string()),
        };

        // Act & Assert
        assert!(!result.is_all_healthy());
        assert!(result.is_core_healthy()); // 只有PostgreSQL是核心服务
    }

    #[test]
    fn test_health_check_result_all_unhealthy() {
        init_test_env();

        // Arrange
        let result = HealthCheckResult {
            postgres_healthy: false,
            postgres_error: Some("PostgreSQL失败".to_string()),
            redis_healthy: false,
            redis_error: Some("Redis失败".to_string()),
            qdrant_healthy: false,
            qdrant_error: Some("Qdrant失败".to_string()),
        };

        // Act & Assert
        assert!(!result.is_all_healthy());
        assert!(!result.is_core_healthy());
    }

    #[test]
    fn test_health_check_result_default() {
        init_test_env();

        // Arrange & Act
        let result = HealthCheckResult::default();

        // Assert - 默认状态应该是不健康的
        assert!(!result.is_all_healthy());
        assert!(!result.is_core_healthy());
        assert!(!result.postgres_healthy);
        assert!(!result.redis_healthy);
        assert!(!result.qdrant_healthy);
        assert!(result.postgres_error.is_none());
        assert!(result.redis_error.is_none());
        assert!(result.qdrant_error.is_none());
    }

    // ===== DatabaseManager 集成测试（需要模拟数据库）=====

    #[tokio::test]
    async fn test_database_manager_new_postgres_only_success() {
        init_test_env();

        // Arrange
        let config = DatabaseManagerConfig {
            postgres_config: None, // 使用None来避免实际连接
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        };

        // Act
        let result = DatabaseManager::new(config).await;

        // Assert
        assert!(result.is_ok());
        let manager = result.unwrap();
        assert!(manager.postgres_pool.is_none()); // 因为配置是None
        assert!(manager.redis_backend.is_none());
        assert!(manager.qdrant_backend.is_none());
        assert!(!manager.is_redis_available());
        assert!(!manager.is_qdrant_available());
    }

    #[tokio::test]
    async fn test_database_manager_postgres_getter_when_none() {
        init_test_env();

        // Arrange
        let config = DatabaseManagerConfig {
            postgres_config: None,
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        };
        let manager = DatabaseManager::new(config).await.unwrap();

        // Act
        let result = manager.postgres();

        // Assert
        assert!(result.is_err());
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert!(msg.contains("PostgreSQL未初始化"));
        } else {
            panic!("期望连接错误");
        }
    }

    #[tokio::test]
    async fn test_database_manager_redis_getter_when_none() {
        init_test_env();

        // Arrange
        let config = DatabaseManagerConfig {
            postgres_config: None,
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        };
        let manager = DatabaseManager::new(config).await.unwrap();

        // Act
        let result = manager.redis();

        // Assert
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_database_manager_qdrant_getter_when_none() {
        init_test_env();

        // Arrange
        let config = DatabaseManagerConfig {
            postgres_config: None,
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        };
        let manager = DatabaseManager::new(config).await.unwrap();

        // Act
        let result = manager.qdrant();

        // Assert
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_database_manager_close() {
        init_test_env();

        // Arrange
        let config = DatabaseManagerConfig {
            postgres_config: None,
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        };
        let mut manager = DatabaseManager::new(config).await.unwrap();

        // Act
        let result = manager.close().await;

        // Assert
        assert!(result.is_ok());
        assert!(manager.postgres_pool.is_none());
        assert!(manager.redis_backend.is_none());
        assert!(manager.qdrant_backend.is_none());
    }

    #[tokio::test]
    async fn test_database_manager_health_check_no_connections() {
        init_test_env();

        // Arrange
        let config = DatabaseManagerConfig {
            postgres_config: None,
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        };
        let manager = DatabaseManager::new(config).await.unwrap();

        // Act
        let result = manager.health_check().await;

        // Assert
        assert!(!result.postgres_healthy);
        assert!(!result.redis_healthy);
        assert!(!result.qdrant_healthy);
        assert!(result.postgres_error.is_some());
        assert!(result.redis_error.is_some());
        assert!(result.qdrant_error.is_some());

        // 验证错误消息
        if let Some(pg_error) = &result.postgres_error {
            assert!(pg_error.contains("未初始化"));
        }
        if let Some(redis_error) = &result.redis_error {
            assert!(redis_error.contains("未启用"));
        }
        if let Some(qdrant_error) = &result.qdrant_error {
            assert!(qdrant_error.contains("未启用"));
        }
    }

    // ===== 错误场景测试 =====

    #[tokio::test]
    async fn test_database_manager_new_invalid_postgres_config() {
        init_test_env();

        // Arrange
        let invalid_config = DatabaseConfig::postgresql("invalid://connection/string");
        let config = DatabaseManagerConfig {
            postgres_config: Some(invalid_config),
            redis_config: None,
            qdrant_config: None,
            enable_redis_cache: false,
            enable_vector_search: false,
        };

        // Act
        let result = DatabaseManager::new(config).await;

        // Assert
        assert!(result.is_err());
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert!(msg.contains("解析PostgreSQL连接字符串失败"));
        } else {
            panic!("期望连接错误，得到: {:?}", result);
        }
    }

    // ===== 边界条件测试 =====

    #[test]
    fn test_database_manager_config_from_env_empty_strings() {
        init_test_env();

        // Arrange
        std::env::set_var("DATABASE_URL", "");
        std::env::set_var("REDIS_URL", "");
        std::env::set_var("QDRANT_URL", "");

        // Act
        let config = DatabaseManagerConfig::from_env();

        // Assert - 空字符串也会被使用
        assert!(config.postgres_config.is_some());
        assert!(config.redis_config.is_some());
        assert!(config.qdrant_config.is_some());

        // Cleanup
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("REDIS_URL");
        std::env::remove_var("QDRANT_URL");
    }

    #[test]
    fn test_database_manager_config_postgres_only_empty_string() {
        init_test_env();

        // Arrange & Act
        let config = DatabaseManagerConfig::postgres_only("");

        // Assert
        assert!(config.postgres_config.is_some());
        if let Some(pg_config) = &config.postgres_config {
            assert_eq!(pg_config.connection_string, "");
        }
    }

}

