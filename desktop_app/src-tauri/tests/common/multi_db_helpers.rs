//! 多数据库测试助手
//!
//! 提供支持PostgreSQL、Redis、Qdrant等多种数据库的测试工具

use zishu_sensei_desktop::database::backends::*;
use serde_json::json;
use std::collections::HashMap;

// ================================
// 数据库连接配置
// ================================

/// 获取PostgreSQL测试配置
pub fn get_postgres_test_config() -> DatabaseConfig {
    let connection_string = std::env::var("TEST_POSTGRES_URL")
        .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/test_db".to_string());
    
    DatabaseConfig::postgresql(&connection_string)
}

/// 获取Redis测试配置
pub fn get_redis_test_config() -> DatabaseConfig {
    let connection_string = std::env::var("TEST_REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    
    DatabaseConfig::redis(&connection_string)
}

/// 获取Qdrant测试配置
pub fn get_qdrant_test_config() -> DatabaseConfig {
    let connection_string = std::env::var("TEST_QDRANT_URL")
        .unwrap_or_else(|_| "http://localhost:6334".to_string());
    
    DatabaseConfig::qdrant(&connection_string)
}

// ================================
// 测试数据生成
// ================================

/// 生成测试用户数据
pub fn generate_test_user(id: usize) -> serde_json::Value {
    json!({
        "id": id,
        "name": format!("User{}", id),
        "email": format!("user{}@example.com", id),
        "age": 20 + (id % 50),
        "active": id % 2 == 0,
        "created_at": chrono::Utc::now().to_rfc3339(),
    })
}

/// 生成测试产品数据
pub fn generate_test_product(id: usize) -> serde_json::Value {
    json!({
        "id": id,
        "name": format!("Product{}", id),
        "price": (id as f64 * 10.0),
        "category": if id % 3 == 0 { "electronics" } else if id % 3 == 1 { "books" } else { "clothing" },
        "in_stock": id % 2 == 0,
        "tags": vec![format!("tag{}", id), "test".to_string()],
    })
}

/// 生成测试向量（用于Qdrant）
pub fn generate_test_vector(size: usize, seed: usize) -> Vec<f32> {
    (0..size).map(|i| ((i + seed) as f32) / (size as f32)).collect()
}

/// 生成随机向量
pub fn generate_random_vector(size: usize) -> Vec<f32> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..size).map(|_| rng.gen::<f32>()).collect()
}

// ================================
// 测试集合名称
// ================================

/// 生成唯一的测试集合名称
pub fn unique_collection_name(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("{}_{}", prefix, timestamp)
}

// ================================
// 数据库清理助手
// ================================

/// 清理测试数据
pub async fn cleanup_test_collection<T: DatabaseBackend>(
    backend: &T,
    collection: &str,
) -> DatabaseResult<()> {
    // 尝试删除集合，忽略错误
    let _ = backend.drop_collection(collection).await;
    Ok(())
}

/// 清理多个测试集合
pub async fn cleanup_test_collections<T: DatabaseBackend>(
    backend: &T,
    collections: &[&str],
) -> DatabaseResult<()> {
    for collection in collections {
        let _ = backend.drop_collection(collection).await;
    }
    Ok(())
}

// ================================
// 断言助手
// ================================

/// 断言数据相等（忽略某些字段）
pub fn assert_data_equal(
    actual: &serde_json::Value,
    expected: &serde_json::Value,
    ignore_fields: &[&str],
) {
    let actual_obj = actual.as_object().expect("actual应该是对象");
    let expected_obj = expected.as_object().expect("expected应该是对象");
    
    for (key, expected_value) in expected_obj {
        if ignore_fields.contains(&key.as_str()) {
            continue;
        }
        
        let actual_value = actual_obj.get(key).expect(&format!("缺少字段: {}", key));
        assert_eq!(
            actual_value, expected_value,
            "字段 {} 不匹配: 期望 {:?}, 实际 {:?}",
            key, expected_value, actual_value
        );
    }
}

/// 断言包含所有键
pub fn assert_contains_keys(data: &serde_json::Value, keys: &[&str]) {
    let obj = data.as_object().expect("data应该是对象");
    
    for key in keys {
        assert!(
            obj.contains_key(*key),
            "缺少期望的字段: {}",
            key
        );
    }
}

// ================================
// 性能测试助手
// ================================

/// 测量操作执行时间
pub async fn measure_async<F, Fut, T>(f: F) -> (T, std::time::Duration)
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = T>,
{
    let start = std::time::Instant::now();
    let result = f().await;
    let duration = start.elapsed();
    (result, duration)
}

/// 执行性能基准测试
pub async fn benchmark_operation<F, Fut>(
    name: &str,
    iterations: usize,
    f: F,
) -> BenchmarkResult
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    let mut durations = Vec::new();
    
    for _ in 0..iterations {
        let (_, duration) = measure_async(|| f()).await;
        durations.push(duration);
    }
    
    let total: std::time::Duration = durations.iter().sum();
    let avg = total / iterations as u32;
    let min = durations.iter().min().unwrap();
    let max = durations.iter().max().unwrap();
    
    BenchmarkResult {
        name: name.to_string(),
        iterations,
        total,
        average: avg,
        min: *min,
        max: *max,
    }
}

/// 性能基准测试结果
#[derive(Debug, Clone)]
pub struct BenchmarkResult {
    pub name: String,
    pub iterations: usize,
    pub total: std::time::Duration,
    pub average: std::time::Duration,
    pub min: std::time::Duration,
    pub max: std::time::Duration,
}

impl BenchmarkResult {
    pub fn print(&self) {
        println!("\n📊 性能基准测试: {}", self.name);
        println!("   迭代次数: {}", self.iterations);
        println!("   总时间: {:?}", self.total);
        println!("   平均时间: {:?}", self.average);
        println!("   最小时间: {:?}", self.min);
        println!("   最大时间: {:?}", self.max);
        println!("   吞吐量: {:.2} ops/sec", 
            self.iterations as f64 / self.total.as_secs_f64());
    }
}

// ================================
// 批量测试助手
// ================================

/// 批量插入测试数据
pub async fn batch_insert_test_users<T: DatabaseBackend>(
    backend: &T,
    collection: &str,
    count: usize,
) -> DatabaseResult<()> {
    let items: Vec<(String, serde_json::Value)> = (0..count)
        .map(|i| (format!("user{}", i), generate_test_user(i)))
        .collect();
    
    backend.batch_insert(collection, items).await
}

/// 批量插入测试产品
pub async fn batch_insert_test_products<T: DatabaseBackend>(
    backend: &T,
    collection: &str,
    count: usize,
) -> DatabaseResult<()> {
    let items: Vec<(String, serde_json::Value)> = (0..count)
        .map(|i| (format!("product{}", i), generate_test_product(i)))
        .collect();
    
    backend.batch_insert(collection, items).await
}

// ================================
// 连接池助手
// ================================

/// 测试连接池助手
pub struct TestConnectionPool<T> {
    backend: T,
    connected: bool,
}

impl<T: DatabaseBackend> TestConnectionPool<T> {
    pub fn new(backend: T) -> Self {
        Self {
            backend,
            connected: false,
        }
    }
    
    pub async fn connect(&mut self, config: &DatabaseConfig) -> DatabaseResult<()> {
        self.backend.connect(config).await?;
        self.connected = true;
        Ok(())
    }
    
    pub async fn disconnect(&mut self) -> DatabaseResult<()> {
        if self.connected {
            self.backend.disconnect().await?;
            self.connected = false;
        }
        Ok(())
    }
    
    pub fn backend(&self) -> &T {
        &self.backend
    }
    
    pub fn backend_mut(&mut self) -> &mut T {
        &mut self.backend
    }
}

impl<T> Drop for TestConnectionPool<T> {
    fn drop(&mut self) {
        // 确保断开连接
        // 注意: 这是同步的drop，不能调用异步方法
        // 在实际使用中，应该在测试结束时显式调用disconnect
    }
}

// ================================
// 测试场景助手
// ================================

/// 执行基本CRUD测试场景
pub async fn run_basic_crud_test<T: DatabaseBackend>(
    backend: &T,
    collection: &str,
) -> DatabaseResult<()> {
    // 1. Create
    let data = generate_test_user(1);
    backend.insert(collection, "user1", &data).await?;
    
    // 2. Read
    let retrieved = backend.get(collection, "user1").await?;
    assert!(retrieved.is_some());
    
    // 3. Update
    let updated_data = json!({
        "id": 1,
        "name": "Updated User",
        "email": "updated@example.com",
        "age": 25,
        "active": true,
    });
    backend.update(collection, "user1", &updated_data).await?;
    
    // 4. Delete
    backend.delete(collection, "user1").await?;
    
    let deleted = backend.get(collection, "user1").await?;
    assert!(deleted.is_none());
    
    Ok(())
}

/// 执行查询测试场景
pub async fn run_query_test<T: DatabaseBackend>(
    backend: &T,
    collection: &str,
    test_count: usize,
) -> DatabaseResult<()> {
    // 插入测试数据
    batch_insert_test_users(backend, collection, test_count).await?;
    
    // 查询所有
    let all_results = backend.query(collection, &QueryOptions::default()).await?;
    assert_eq!(all_results.len(), test_count);
    
    // 带限制的查询
    let limited_results = backend.query(
        collection,
        &QueryOptions {
            limit: Some(5),
            ..Default::default()
        },
    ).await?;
    assert_eq!(limited_results.len(), 5.min(test_count));
    
    // 统计
    let count = backend.count(collection, None).await?;
    assert_eq!(count, test_count);
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_test_user() {
        let user = generate_test_user(1);
        assert_eq!(user["id"], 1);
        assert_eq!(user["name"], "User1");
        assert_eq!(user["email"], "user1@example.com");
    }

    #[test]
    fn test_generate_test_vector() {
        let vector = generate_test_vector(128, 0);
        assert_eq!(vector.len(), 128);
        assert_eq!(vector[0], 0.0);
    }

    #[test]
    fn test_unique_collection_name() {
        let name1 = unique_collection_name("test");
        std::thread::sleep(std::time::Duration::from_millis(10));
        let name2 = unique_collection_name("test");
        assert_ne!(name1, name2);
    }
}

