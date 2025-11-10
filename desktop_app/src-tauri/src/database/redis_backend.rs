//! Redis 数据库后端实现

use async_trait::async_trait;
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Client};
use serde_json;
use tracing::info;

use super::backends::*;

// ================================
// Redis 后端
// ================================

/// Redis 数据库后端
pub struct RedisBackend {
    client: Option<Client>,
    manager: Option<ConnectionManager>,
    connected: bool,
    key_prefix: String,
}

impl std::fmt::Debug for RedisBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RedisBackend")
            .field("connected", &self.connected)
            .field("key_prefix", &self.key_prefix)
            .field("client", &self.client.is_some())
            .field("manager", &self.manager.is_some())
            .finish()
    }
}

impl RedisBackend {
    /// 创建新的 Redis 后端
    pub fn new() -> Self {
        Self {
            client: None,
            manager: None,
            connected: false,
            key_prefix: "zishu:".to_string(),
        }
    }

    /// 设置键前缀
    pub fn with_prefix(mut self, prefix: &str) -> Self {
        self.key_prefix = prefix.to_string();
        self
    }

    /// 获取连接管理器
    fn get_manager(&self) -> DatabaseResult<&ConnectionManager> {
        self.manager
            .as_ref()
            .ok_or_else(|| DatabaseError::ConnectionError("未连接到Redis".to_string()))
    }

    /// 构建完整的键名
    fn build_key(&self, collection: &str, key: &str) -> String {
        format!("{}{}:{}", self.key_prefix, collection, key)
    }

    /// 构建集合模式
    fn build_pattern(&self, collection: &str) -> String {
        format!("{}{}:*", self.key_prefix, collection)
    }
}

impl Default for RedisBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DatabaseBackend for RedisBackend {
    fn backend_type(&self) -> DatabaseBackendType {
        DatabaseBackendType::Redis
    }

    async fn connect(&mut self, config: &DatabaseConfig) -> DatabaseResult<()> {
        info!("连接到 Redis: {}", config.connection_string);

        let client = Client::open(config.connection_string.as_str())
            .map_err(|e| DatabaseError::ConnectionError(format!("创建Redis客户端失败: {}", e)))?;

        // 测试连接
        let manager = ConnectionManager::new(client.clone())
            .await
            .map_err(|e| DatabaseError::ConnectionError(format!("创建连接管理器失败: {}", e)))?;

        // 验证连接
        let mut conn = manager.clone();
        let _: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .map_err(|e| DatabaseError::ConnectionError(format!("连接测试失败: {}", e)))?;

        self.client = Some(client);
        self.manager = Some(manager);
        self.connected = true;

        info!("Redis 连接成功");
        Ok(())
    }

    async fn disconnect(&mut self) -> DatabaseResult<()> {
        info!("断开 Redis 连接");
        self.client = None;
        self.manager = None;
        self.connected = false;
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected && self.manager.is_some()
    }

    async fn create_collection(&self, name: &str, _schema: Option<&str>) -> DatabaseResult<()> {
        // Redis 是无模式的，不需要创建集合
        info!("Redis集合 {} 已准备就绪（无需创建）", name);
        Ok(())
    }

    async fn drop_collection(&self, name: &str) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let pattern = self.build_pattern(name);
        
        // 使用SCAN命令获取所有匹配的键
        let mut cursor = 0u64;
        loop {
            let (new_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(100)
                .query_async(&mut conn)
                .await
                .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

            if !keys.is_empty() {
                conn.del::<_, ()>(&keys)
                    .await
                    .map_err(|e| DatabaseError::QueryError(e.to_string()))?;
            }

            cursor = new_cursor;
            if cursor == 0 {
                break;
            }
        }

        info!("成功删除集合: {}", name);
        Ok(())
    }

    async fn collection_exists(&self, name: &str) -> DatabaseResult<bool> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let pattern = self.build_pattern(name);
        
        // 检查是否存在匹配的键
        let (_, keys): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(0)
            .arg("MATCH")
            .arg(&pattern)
            .arg("COUNT")
            .arg(1)
            .query_async(&mut conn)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(!keys.is_empty())
    }

    async fn insert(
        &self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let full_key = self.build_key(collection, key);
        let json_str = serde_json::to_string(data)?;

        // 检查键是否已存在
        let exists: bool = conn
            .exists(&full_key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        if exists {
            return Err(DatabaseError::Duplicate(format!("键 {} 已存在", key)));
        }

        conn.set::<_, _, ()>(&full_key, json_str)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(())
    }

    async fn batch_insert(
        &self,
        collection: &str,
        items: Vec<(String, serde_json::Value)>,
    ) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let mut pipe = redis::pipe();
        
        for (key, data) in items {
            let full_key = self.build_key(collection, &key);
            let json_str = serde_json::to_string(&data)?;
            pipe.set(&full_key, json_str);
        }

        pipe.query_async::<()>(&mut conn)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(())
    }

    async fn get(
        &self,
        collection: &str,
        key: &str,
    ) -> DatabaseResult<Option<serde_json::Value>> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let full_key = self.build_key(collection, key);

        let result: Option<String> = conn
            .get(&full_key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        match result {
            Some(json_str) => {
                let data: serde_json::Value = serde_json::from_str(&json_str)?;
                Ok(Some(data))
            }
            None => Ok(None),
        }
    }

    async fn update(
        &self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let full_key = self.build_key(collection, key);

        // 检查键是否存在
        let exists: bool = conn
            .exists(&full_key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        if !exists {
            return Err(DatabaseError::NotFound(format!("键 {} 不存在", key)));
        }

        let json_str = serde_json::to_string(data)?;

        conn.set::<_, _, ()>(&full_key, json_str)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(())
    }

    async fn delete(&self, collection: &str, key: &str) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let full_key = self.build_key(collection, key);

        let deleted: u32 = conn
            .del(&full_key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        if deleted == 0 {
            return Err(DatabaseError::NotFound(format!("键 {} 不存在", key)));
        }

        Ok(())
    }

    async fn query(
        &self,
        collection: &str,
        options: &QueryOptions,
    ) -> DatabaseResult<Vec<(String, serde_json::Value)>> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let pattern = self.build_pattern(collection);
        let mut results = Vec::new();
        let mut cursor = 0u64;

        // 使用SCAN命令获取所有匹配的键
        loop {
            let (new_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(100)
                .query_async(&mut conn)
                .await
                .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

            for full_key in keys {
                let json_str: Option<String> = conn
                    .get(&full_key)
                    .await
                    .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

                if let Some(json_str) = json_str {
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&json_str) {
                        // 提取键名（去掉前缀和集合名）
                        let key = full_key
                            .strip_prefix(&format!("{}{}:", self.key_prefix, collection))
                            .unwrap_or(&full_key)
                            .to_string();

                        // 应用过滤条件
                        let mut matches = true;
                        for condition in &options.conditions {
                            if let Some(field_value) = data.get(&condition.field) {
                                matches = match condition.operator {
                                    QueryOperator::Eq => field_value == &condition.value,
                                    QueryOperator::Ne => field_value != &condition.value,
                                    QueryOperator::Exists => true,
                                    _ => true, // 其他操作符暂不支持
                                };
                                if !matches {
                                    break;
                                }
                            } else if matches!(&condition.operator, QueryOperator::Exists) {
                                matches = false;
                                break;
                            }
                        }

                        if matches {
                            results.push((key, data));
                        }
                    }
                }
            }

            cursor = new_cursor;
            if cursor == 0 {
                break;
            }
        }

        // 应用排序
        if let Some(order_by) = &options.order_by {
            for (field, ascending) in order_by.iter().rev() {
                results.sort_by(|(_, a), (_, b)| {
                    let a_val = a.get(field);
                    let b_val = b.get(field);
                    
                    let cmp = match (a_val, b_val) {
                        (Some(a), Some(b)) => {
                            // 简单字符串比较
                            a.to_string().cmp(&b.to_string())
                        }
                        (Some(_), None) => std::cmp::Ordering::Greater,
                        (None, Some(_)) => std::cmp::Ordering::Less,
                        (None, None) => std::cmp::Ordering::Equal,
                    };

                    if *ascending {
                        cmp
                    } else {
                        cmp.reverse()
                    }
                });
            }
        }

        // 应用分页
        let start = options.offset.unwrap_or(0);
        let end = options.limit.map(|l| start + l).unwrap_or(results.len());
        
        Ok(results.into_iter().skip(start).take(end - start).collect())
    }

    async fn count(&self, collection: &str, options: Option<&QueryOptions>) -> DatabaseResult<usize> {
        if options.is_some() {
            // 如果有查询条件，需要先获取所有数据然后过滤
            let results = self.query(collection, options.unwrap()).await?;
            Ok(results.len())
        } else {
            // 没有查询条件，直接统计键数量
            let manager = self.get_manager()?;
            let mut conn = manager.clone();

            let pattern = self.build_pattern(collection);
            let mut count = 0usize;
            let mut cursor = 0u64;

            loop {
                let (new_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
                    .arg(cursor)
                    .arg("MATCH")
                    .arg(&pattern)
                    .arg("COUNT")
                    .arg(100)
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

                count += keys.len();
                cursor = new_cursor;
                
                if cursor == 0 {
                    break;
                }
            }

            Ok(count)
        }
    }

    async fn clear_collection(&self, collection: &str) -> DatabaseResult<()> {
        self.drop_collection(collection).await
    }

    async fn execute_raw(&self, query: &str) -> DatabaseResult<serde_json::Value> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        // 解析命令
        let parts: Vec<&str> = query.split_whitespace().collect();
        if parts.is_empty() {
            return Err(DatabaseError::QueryError("空查询".to_string()));
        }

        // 执行命令
        let result: redis::RedisResult<String> = redis::cmd(parts[0])
            .arg(&parts[1..])
            .query_async(&mut conn)
            .await;

        match result {
            Ok(value) => Ok(serde_json::Value::String(value)),
            Err(e) => Err(DatabaseError::QueryError(e.to_string())),
        }
    }

    async fn begin_transaction(&self) -> DatabaseResult<Box<dyn DatabaseTransaction>> {
        Err(DatabaseError::Other("Redis事务暂不支持".to_string()))
    }
}

// ================================
// 缓存接口实现
// ================================

#[async_trait]
impl CacheDatabaseBackend for RedisBackend {
    async fn set_with_expiry(
        &self,
        key: &str,
        value: &serde_json::Value,
        ttl_seconds: u64,
    ) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let json_str = serde_json::to_string(value)?;

        conn.set_ex::<_, _, ()>(key, json_str, ttl_seconds)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(())
    }

    async fn get_cache(&self, key: &str) -> DatabaseResult<Option<serde_json::Value>> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let result: Option<String> = conn
            .get(key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        match result {
            Some(json_str) => {
                let data: serde_json::Value = serde_json::from_str(&json_str)?;
                Ok(Some(data))
            }
            None => Ok(None),
        }
    }

    async fn delete_cache(&self, key: &str) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        conn.del::<_, ()>(key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(())
    }

    async fn exists(&self, key: &str) -> DatabaseResult<bool> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let exists: bool = conn
            .exists(key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(exists)
    }

    async fn expire(&self, key: &str, ttl_seconds: u64) -> DatabaseResult<()> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        conn.expire::<_, ()>(key, ttl_seconds as i64)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(())
    }

    async fn ttl(&self, key: &str) -> DatabaseResult<Option<i64>> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let ttl: i64 = conn
            .ttl(key)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        if ttl < 0 {
            Ok(None)
        } else {
            Ok(Some(ttl))
        }
    }

    async fn increment(&self, key: &str, delta: i64) -> DatabaseResult<i64> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let result: i64 = conn
            .incr(key, delta)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(result)
    }

    async fn decrement(&self, key: &str, delta: i64) -> DatabaseResult<i64> {
        let manager = self.get_manager()?;
        let mut conn = manager.clone();

        let result: i64 = conn
            .decr(key, delta)
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::HashMap;

    // ================================
    // 基础功能测试
    // ================================

    #[tokio::test]
    async fn test_redis_backend_new() {
        // Arrange & Act
        let backend = RedisBackend::new();
        
        // Assert
        assert!(!backend.is_connected());
        assert!(backend.client.is_none());
        assert!(backend.manager.is_none());
        assert!(!backend.connected);
        assert_eq!(backend.key_prefix, "zishu:");
    }

    #[tokio::test]
    async fn test_redis_backend_default() {
        // Arrange & Act
        let backend = RedisBackend::default();
        
        // Assert
        assert!(!backend.is_connected());
        assert!(backend.client.is_none());
        assert!(backend.manager.is_none());
        assert!(!backend.connected);
        assert_eq!(backend.key_prefix, "zishu:");
    }

    #[tokio::test]
    async fn test_redis_backend_with_prefix() {
        // Arrange
        let custom_prefix = "test_app:";
        
        // Act
        let backend = RedisBackend::new().with_prefix(custom_prefix);
        
        // Assert
        assert_eq!(backend.key_prefix, custom_prefix);
        assert!(!backend.is_connected());
    }

    #[tokio::test]
    async fn test_redis_backend_type() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act & Assert
        assert_eq!(backend.backend_type(), DatabaseBackendType::Redis);
        assert!(!backend.is_connected());
    }

    #[test]
    fn test_redis_backend_debug() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let debug_string = format!("{:?}", backend);
        
        // Assert
        assert!(debug_string.contains("RedisBackend"));
        assert!(debug_string.contains("connected: false"));
        assert!(debug_string.contains("key_prefix: \"zishu:\""));
        assert!(debug_string.contains("client: false"));
        assert!(debug_string.contains("manager: false"));
    }

    // ================================
    // 键构建和模式测试
    // ================================

    #[test]
    fn test_redis_key_building() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act & Assert
        let key = backend.build_key("users", "user123");
        assert_eq!(key, "zishu:users:user123");

        let pattern = backend.build_pattern("users");
        assert_eq!(pattern, "zishu:users:*");
    }

    #[test]
    fn test_redis_key_building_with_custom_prefix() {
        // Arrange
        let backend = RedisBackend::new().with_prefix("custom:");
        
        // Act & Assert
        let key = backend.build_key("sessions", "session456");
        assert_eq!(key, "custom:sessions:session456");

        let pattern = backend.build_pattern("sessions");
        assert_eq!(pattern, "custom:sessions:*");
    }

    #[test]
    fn test_redis_key_building_empty_values() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act & Assert
        let key = backend.build_key("", "");
        assert_eq!(key, "zishu::");

        let pattern = backend.build_pattern("");
        assert_eq!(pattern, "zishu::*");
    }

    #[test]
    fn test_redis_key_building_special_characters() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act & Assert
        let key = backend.build_key("user:profile", "user@email.com");
        assert_eq!(key, "zishu:user:profile:user@email.com");

        let pattern = backend.build_pattern("user:profile");
        assert_eq!(pattern, "zishu:user:profile:*");
    }

    // ================================
    // 连接管理测试
    // ================================

    #[tokio::test]
    async fn test_connect_invalid_connection_string() {
        // Arrange
        let mut backend = RedisBackend::new();
        let config = DatabaseConfig {
            backend_type: DatabaseBackendType::Redis,
            connection_string: "invalid_redis_url".to_string(),
            max_connections: Some(10),
            timeout: Some(30),
            extra: HashMap::new(),
        };
        
        // Act
        let result = backend.connect(&config).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
        assert!(!backend.is_connected());
    }

    #[tokio::test]
    async fn test_disconnect_without_connection() {
        // Arrange
        let mut backend = RedisBackend::new();
        
        // Act
        let result = backend.disconnect().await;
        
        // Assert
        assert!(result.is_ok());
        assert!(!backend.is_connected());
        assert!(backend.client.is_none());
        assert!(backend.manager.is_none());
    }

    #[tokio::test]
    async fn test_get_manager_when_disconnected() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.get_manager();
        
        // Assert
        assert!(result.is_err());
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert_eq!(msg, "未连接到Redis");
        } else {
            panic!("Expected ConnectionError");
        }
    }

    // ================================
    // 集合管理测试（需要连接）
    // ================================

    #[tokio::test]
    async fn test_create_collection_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.create_collection("test_collection", None).await;
        
        // Assert
        // Redis是无模式的，不需要连接就能"创建"集合
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_drop_collection_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.drop_collection("test_collection").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_collection_exists_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.collection_exists("test_collection").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    // ================================
    // CRUD操作测试（需要连接）
    // ================================

    #[tokio::test]
    async fn test_insert_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        let data = json!({"name": "test", "value": 123});
        
        // Act
        let result = backend.insert("test_collection", "test_key", &data).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_batch_insert_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        let items = vec![
            ("key1".to_string(), json!({"name": "test1"})),
            ("key2".to_string(), json!({"name": "test2"})),
        ];
        
        // Act
        let result = backend.batch_insert("test_collection", items).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_get_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.get("test_collection", "test_key").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_update_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        let data = json!({"name": "updated", "value": 456});
        
        // Act
        let result = backend.update("test_collection", "test_key", &data).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_delete_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.delete("test_collection", "test_key").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    // ================================
    // 查询操作测试
    // ================================

    #[tokio::test]
    async fn test_query_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        let options = QueryOptions {
            conditions: vec![],
            order_by: None,
            limit: None,
            offset: None,
        };
        
        // Act
        let result = backend.query("test_collection", &options).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_count_without_connection_no_options() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.count("test_collection", None).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_count_with_options_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        let options = QueryOptions {
            conditions: vec![
                QueryCondition {
                    field: "status".to_string(),
                    operator: QueryOperator::Eq,
                    value: json!("active"),
                },
            ],
            order_by: None,
            limit: None,
            offset: None,
        };
        
        // Act
        let result = backend.count("test_collection", Some(&options)).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_clear_collection_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.clear_collection("test_collection").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_execute_raw_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.execute_raw("PING").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_execute_raw_empty_query() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.execute_raw("").await;
        
        // Assert
        assert!(result.is_err());
        // 当没有连接时，应该返回ConnectionError而不是QueryError
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    // ================================
    // 缓存功能测试
    // ================================

    #[tokio::test]
    async fn test_set_with_expiry_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        let value = json!({"data": "cached_value"});
        
        // Act
        let result = backend.set_with_expiry("cache_key", &value, 3600).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_get_cache_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.get_cache("cache_key").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_delete_cache_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.delete_cache("cache_key").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_exists_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.exists("cache_key").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_expire_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.expire("cache_key", 3600).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_ttl_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.ttl("cache_key").await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_increment_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.increment("counter_key", 1).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    #[tokio::test]
    async fn test_decrement_without_connection() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.decrement("counter_key", 1).await;
        
        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DatabaseError::ConnectionError(_)));
    }

    // ================================
    // 事务管理测试
    // ================================

    #[tokio::test]
    async fn test_begin_transaction_not_supported() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act
        let result = backend.begin_transaction().await;
        
        // Assert
        assert!(result.is_err());
        if let Err(DatabaseError::Other(msg)) = result {
            assert_eq!(msg, "Redis事务暂不支持");
        } else {
            panic!("Expected Other error");
        }
    }

    // ================================
    // 查询选项构建测试
    // ================================

    #[test]
    fn test_query_options_with_various_operators() {
        // Arrange & Act
        let options = QueryOptions {
            conditions: vec![
                QueryCondition {
                    field: "name".to_string(),
                    operator: QueryOperator::Eq,
                    value: json!("test"),
                },
                QueryCondition {
                    field: "status".to_string(),
                    operator: QueryOperator::Ne,
                    value: json!("inactive"),
                },
                QueryCondition {
                    field: "email".to_string(),
                    operator: QueryOperator::Exists,
                    value: json!(null),
                },
            ],
            order_by: Some(vec![
                ("created_at".to_string(), false),
                ("name".to_string(), true),
            ]),
            limit: Some(50),
            offset: Some(10),
        };
        
        // Assert
        assert_eq!(options.conditions.len(), 3);
        assert_eq!(options.conditions[0].operator, QueryOperator::Eq);
        assert_eq!(options.conditions[1].operator, QueryOperator::Ne);
        assert_eq!(options.conditions[2].operator, QueryOperator::Exists);
        assert!(options.order_by.is_some());
        assert_eq!(options.order_by.as_ref().unwrap().len(), 2);
        assert_eq!(options.limit, Some(50));
        assert_eq!(options.offset, Some(10));
    }

    // ================================
    // JSON序列化/反序列化测试
    // ================================

    #[test]
    fn test_json_serialization_deserialization() {
        // Arrange
        let original_data = json!({
            "name": "测试用户",
            "age": 25,
            "active": true,
            "tags": ["rust", "redis"],
            "profile": {
                "email": "test@example.com",
                "city": "北京"
            }
        });
        
        // Act - 序列化
        let json_str = serde_json::to_string(&original_data);
        assert!(json_str.is_ok());
        
        // Act - 反序列化
        let deserialized_data: Result<serde_json::Value, _> = 
            serde_json::from_str(&json_str.unwrap());
        
        // Assert
        assert!(deserialized_data.is_ok());
        assert_eq!(deserialized_data.unwrap(), original_data);
    }

    // ================================
    // 边界条件测试
    // ================================

    #[test]
    fn test_edge_cases_empty_strings() {
        // Arrange
        let backend = RedisBackend::new();
        
        // Act & Assert
        let key = backend.build_key("", "");
        assert_eq!(key, "zishu::");
        
        let pattern = backend.build_pattern("");
        assert_eq!(pattern, "zishu::*");
    }

    #[test]
    fn test_edge_cases_large_strings() {
        // Arrange
        let backend = RedisBackend::new();
        let large_collection = "a".repeat(1000);
        let large_key = "b".repeat(1000);
        
        // Act
        let full_key = backend.build_key(&large_collection, &large_key);
        let pattern = backend.build_pattern(&large_collection);
        
        // Assert
        assert!(full_key.starts_with("zishu:"));
        assert!(full_key.contains(&large_collection));
        assert!(full_key.contains(&large_key));
        assert!(pattern.starts_with("zishu:"));
        assert!(pattern.contains(&large_collection));
        assert!(pattern.ends_with(":*"));
    }

    #[test]
    fn test_edge_cases_unicode_strings() {
        // Arrange
        let backend = RedisBackend::new();
        let unicode_collection = "用户集合";
        let unicode_key = "用户键名";
        
        // Act
        let full_key = backend.build_key(unicode_collection, unicode_key);
        let pattern = backend.build_pattern(unicode_collection);
        
        // Assert
        assert_eq!(full_key, "zishu:用户集合:用户键名");
        assert_eq!(pattern, "zishu:用户集合:*");
    }
}

