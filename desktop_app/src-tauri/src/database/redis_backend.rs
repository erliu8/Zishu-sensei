//! Redis 数据库后端实现

use async_trait::async_trait;
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Client};
use serde_json;
use tracing::{error, info, warn};

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

        conn.set(&full_key, json_str)
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

        pipe.query_async(&mut conn)
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

        conn.set(&full_key, json_str)
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

        conn.set_ex(key, json_str, ttl_seconds)
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

        conn.del(key)
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

        conn.expire(key, ttl_seconds as i64)
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

    #[tokio::test]
    async fn test_redis_backend_type() {
        let backend = RedisBackend::new();
        assert_eq!(backend.backend_type(), DatabaseBackendType::Redis);
        assert!(!backend.is_connected());
    }

    #[test]
    fn test_redis_key_building() {
        let backend = RedisBackend::new();
        let key = backend.build_key("users", "user123");
        assert_eq!(key, "zishu:users:user123");

        let pattern = backend.build_pattern("users");
        assert_eq!(pattern, "zishu:users:*");
    }
}

