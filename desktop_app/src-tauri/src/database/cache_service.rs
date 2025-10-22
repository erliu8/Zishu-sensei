//! Redis 缓存服务
//!
//! 提供高层缓存抽象，包括：
//! - 会话管理
//! - 查询结果缓存
//! - 实时数据缓存
//! - 分布式锁

use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};

use super::backends::{CacheDatabaseBackend, DatabaseResult, DatabaseError};
use super::redis_backend::RedisBackend;

/// 缓存服务
pub struct CacheService {
    backend: Arc<RwLock<RedisBackend>>,
    key_prefix: String,
}

impl CacheService {
    /// 创建新的缓存服务
    pub fn new(backend: Arc<RwLock<RedisBackend>>) -> Self {
        Self {
            backend,
            key_prefix: "zishu_cache:".to_string(),
        }
    }
    
    /// 设置键前缀
    pub fn with_prefix(mut self, prefix: &str) -> Self {
        self.key_prefix = prefix.to_string();
        self
    }
    
    /// 构建完整键名
    fn build_key(&self, category: &str, key: &str) -> String {
        format!("{}{}{}", self.key_prefix, category, key)
    }
    
    // ========================================
    // 通用缓存操作
    // ========================================
    
    /// 设置缓存（带过期时间）
    pub async fn set<T: Serialize>(
        &self,
        category: &str,
        key: &str,
        value: &T,
        ttl_seconds: u64,
    ) -> DatabaseResult<()> {
        let full_key = self.build_key(category, key);
        let json_value = serde_json::to_value(value)?;
        
        self.backend
            .read()
            .await
            .set_with_expiry(&full_key, &json_value, ttl_seconds)
            .await
    }
    
    /// 获取缓存
    pub async fn get<T: for<'de> Deserialize<'de>>(
        &self,
        category: &str,
        key: &str,
    ) -> DatabaseResult<Option<T>> {
        let full_key = self.build_key(category, key);
        
        let value = self.backend.read().await.get_cache(&full_key).await?;
        
        match value {
            Some(json_value) => {
                let data: T = serde_json::from_value(json_value)?;
                Ok(Some(data))
            }
            None => Ok(None),
        }
    }
    
    /// 删除缓存
    pub async fn delete(&self, category: &str, key: &str) -> DatabaseResult<()> {
        let full_key = self.build_key(category, key);
        self.backend.read().await.delete_cache(&full_key).await
    }
    
    /// 检查缓存是否存在
    pub async fn exists(&self, category: &str, key: &str) -> DatabaseResult<bool> {
        let full_key = self.build_key(category, key);
        self.backend.read().await.exists(&full_key).await
    }
    
    // ========================================
    // 会话管理
    // ========================================
    
    /// 创建会话
    pub async fn create_session<T: Serialize>(
        &self,
        session_id: &str,
        data: &T,
        ttl_seconds: u64,
    ) -> DatabaseResult<()> {
        info!("创建会话: {}", session_id);
        self.set("session:", session_id, data, ttl_seconds).await
    }
    
    /// 获取会话
    pub async fn get_session<T: for<'de> Deserialize<'de>>(
        &self,
        session_id: &str,
    ) -> DatabaseResult<Option<T>> {
        self.get("session:", session_id).await
    }
    
    /// 更新会话过期时间
    pub async fn refresh_session(&self, session_id: &str, ttl_seconds: u64) -> DatabaseResult<()> {
        let full_key = self.build_key("session:", session_id);
        self.backend.read().await.expire(&full_key, ttl_seconds).await
    }
    
    /// 删除会话
    pub async fn destroy_session(&self, session_id: &str) -> DatabaseResult<()> {
        info!("销毁会话: {}", session_id);
        self.delete("session:", session_id).await
    }
    
    /// 获取会话剩余时间
    pub async fn get_session_ttl(&self, session_id: &str) -> DatabaseResult<Option<i64>> {
        let full_key = self.build_key("session:", session_id);
        self.backend.read().await.ttl(&full_key).await
    }
    
    // ========================================
    // 查询结果缓存
    // ========================================
    
    /// 缓存查询结果
    pub async fn cache_query_result<T: Serialize>(
        &self,
        query_key: &str,
        result: &T,
        ttl_seconds: u64,
    ) -> DatabaseResult<()> {
        self.set("query:", query_key, result, ttl_seconds).await
    }
    
    /// 获取查询缓存
    pub async fn get_query_cache<T: for<'de> Deserialize<'de>>(
        &self,
        query_key: &str,
    ) -> DatabaseResult<Option<T>> {
        self.get("query:", query_key).await
    }
    
    /// 清除查询缓存
    pub async fn invalidate_query_cache(&self, query_key: &str) -> DatabaseResult<()> {
        self.delete("query:", query_key).await
    }
    
    // ========================================
    // 对象缓存
    // ========================================
    
    /// 缓存对象
    pub async fn cache_object<T: Serialize>(
        &self,
        object_type: &str,
        object_id: &str,
        data: &T,
        ttl_seconds: u64,
    ) -> DatabaseResult<()> {
        let category = format!("object:{}:", object_type);
        self.set(&category, object_id, data, ttl_seconds).await
    }
    
    /// 获取对象缓存
    pub async fn get_object<T: for<'de> Deserialize<'de>>(
        &self,
        object_type: &str,
        object_id: &str,
    ) -> DatabaseResult<Option<T>> {
        let category = format!("object:{}:", object_type);
        self.get(&category, object_id).await
    }
    
    /// 删除对象缓存
    pub async fn invalidate_object(&self, object_type: &str, object_id: &str) -> DatabaseResult<()> {
        let category = format!("object:{}:", object_type);
        self.delete(&category, object_id).await
    }
    
    // ========================================
    // 计数器
    // ========================================
    
    /// 增加计数器
    pub async fn increment_counter(&self, counter_name: &str, delta: i64) -> DatabaseResult<i64> {
        let full_key = self.build_key("counter:", counter_name);
        self.backend.read().await.increment(&full_key, delta).await
    }
    
    /// 减少计数器
    pub async fn decrement_counter(&self, counter_name: &str, delta: i64) -> DatabaseResult<i64> {
        let full_key = self.build_key("counter:", counter_name);
        self.backend.read().await.decrement(&full_key, delta).await
    }
    
    /// 获取计数器值
    pub async fn get_counter(&self, counter_name: &str) -> DatabaseResult<Option<i64>> {
        match self.get::<i64>("counter:", counter_name).await {
            Ok(value) => Ok(value),
            Err(_) => Ok(None),
        }
    }
    
    /// 重置计数器
    pub async fn reset_counter(&self, counter_name: &str) -> DatabaseResult<()> {
        self.delete("counter:", counter_name).await
    }
    
    // ========================================
    // 分布式锁
    // ========================================
    
    /// 获取分布式锁
    pub async fn acquire_lock(
        &self,
        lock_name: &str,
        ttl_seconds: u64,
    ) -> DatabaseResult<bool> {
        let full_key = self.build_key("lock:", lock_name);
        let lock_value = serde_json::Value::String(uuid::Uuid::new_v4().to_string());
        
        // 尝试设置锁（如果不存在）
        match self.backend.read().await.exists(&full_key).await {
            Ok(exists) => {
                if exists {
                    Ok(false) // 锁已被占用
                } else {
                    self.backend
                        .read()
                        .await
                        .set_with_expiry(&full_key, &lock_value, ttl_seconds)
                        .await?;
                    Ok(true)
                }
            }
            Err(e) => Err(e),
        }
    }
    
    /// 释放分布式锁
    pub async fn release_lock(&self, lock_name: &str) -> DatabaseResult<()> {
        self.delete("lock:", lock_name).await
    }
    
    /// 检查锁是否被占用
    pub async fn is_locked(&self, lock_name: &str) -> DatabaseResult<bool> {
        self.exists("lock:", lock_name).await
    }
    
    // ========================================
    // 统计信息
    // ========================================
    
    /// 记录访问统计
    pub async fn record_access(&self, resource: &str) -> DatabaseResult<i64> {
        let counter_name = format!("access_{}", resource);
        self.increment_counter(&counter_name, 1).await
    }
    
    /// 获取访问统计
    pub async fn get_access_count(&self, resource: &str) -> DatabaseResult<i64> {
        let counter_name = format!("access_{}", resource);
        self.get_counter(&counter_name).await.map(|v| v.unwrap_or(0))
    }
}

/// 缓存装饰器 - 用于自动缓存函数结果
pub struct CacheDecorator {
    cache_service: Arc<CacheService>,
    default_ttl: u64,
}

impl CacheDecorator {
    /// 创建新的缓存装饰器
    pub fn new(cache_service: Arc<CacheService>, default_ttl: u64) -> Self {
        Self {
            cache_service,
            default_ttl,
        }
    }
    
    /// 执行带缓存的函数
    pub async fn execute<T, F, Fut>(
        &self,
        cache_key: &str,
        func: F,
    ) -> DatabaseResult<T>
    where
        T: Serialize + for<'de> Deserialize<'de>,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = DatabaseResult<T>>,
    {
        // 尝试从缓存获取
        if let Some(cached) = self.cache_service.get_query_cache(cache_key).await? {
            info!("从缓存获取: {}", cache_key);
            return Ok(cached);
        }
        
        // 执行函数
        let result = func().await?;
        
        // 缓存结果
        if let Err(e) = self.cache_service
            .cache_query_result(cache_key, &result, self.default_ttl)
            .await
        {
            warn!("缓存结果失败: {}", e);
        }
        
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_build_key() {
        let backend = Arc::new(RwLock::new(RedisBackend::new()));
        let service = CacheService::new(backend);
        
        let key = service.build_key("session:", "user123");
        assert_eq!(key, "zishu_cache:session:user123");
    }
    
    #[test]
    fn test_custom_prefix() {
        let backend = Arc::new(RwLock::new(RedisBackend::new()));
        let service = CacheService::new(backend).with_prefix("myapp:");
        
        let key = service.build_key("session:", "user123");
        assert_eq!(key, "myapp:session:user123");
    }
}

