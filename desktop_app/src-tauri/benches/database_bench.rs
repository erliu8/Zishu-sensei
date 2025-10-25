// benches/database_bench.rs
//! 数据库性能基准测试
//! 
//! 测试PostgreSQL和Redis后端的插入、查询、更新、删除操作性能以及并发性能
//! 已移除SQLite依赖

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
#[allow(unused_imports)]
use tokio::runtime::Runtime;
use rand::{Rng, thread_rng, distributions::Alphanumeric};
use serde_json::json;
use zishu_sensei_desktop::database::{
    backends::*,
    postgres_backend::PostgresBackend,
    redis_backend::RedisBackend,
};

/// 生成随机字符串
fn random_string(len: usize) -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

/// 生成随机数据
fn random_blob(size: usize) -> Vec<u8> {
    let mut rng = thread_rng();
    (0..size).map(|_| rng.gen()).collect()
}

/// 创建PostgreSQL测试后端
async fn create_postgres_backend() -> PostgresBackend {
    let mut backend = PostgresBackend::new();
    let config = DatabaseConfig::postgresql("postgresql://postgres:password@localhost/zishu_bench");
    backend.connect(&config).await.expect("Failed to connect to PostgreSQL");
    
    // 创建测试表
    let schema = r#"
        CREATE TABLE IF NOT EXISTS bench_data (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL,
            data BYTEA,
            created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bench_key ON bench_data(key);
    "#;
    backend.execute_raw(schema).await.expect("Failed to create table");
    
    backend
}

/// 创建Redis测试后端
async fn create_redis_backend() -> RedisBackend {
    let mut backend = RedisBackend::new().with_prefix("bench:");
    let config = DatabaseConfig::redis("redis://localhost");
    backend.connect(&config).await.expect("Failed to connect to Redis");
    backend
}

/// 基准测试：PostgreSQL单条插入
fn bench_postgres_single_insert(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("postgres_single_insert");
    
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.to_async(&rt).iter_batched(
                || {
                    let key = random_string(50);
                    let value = random_string(100);
                    let data = random_blob(size);
                    let timestamp = chrono::Utc::now().timestamp();
                    (key, value, data, timestamp)
                },
                |(key, value, data, timestamp)| async move {
                    let mut backend = create_postgres_backend().await;
                    let json_data = json!({
                        "key": key,
                        "value": value,
                        "data": base64::encode(&data),
                        "created_at": timestamp
                    });
                    backend.insert("bench_data", &key, &json_data).await.expect("Insert failed");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：Redis单条插入
fn bench_redis_single_insert(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("redis_single_insert");
    
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.to_async(&rt).iter_batched(
                || {
                    let key = random_string(50);
                    let value = random_string(100);
                    let data = random_blob(size);
                    let timestamp = chrono::Utc::now().timestamp();
                    (key, value, data, timestamp)
                },
                |(key, value, data, timestamp)| async move {
                    let mut backend = create_redis_backend().await;
                    let json_data = json!({
                        "key": key,
                        "value": value,
                        "data": base64::encode(&data),
                        "created_at": timestamp
                    });
                    backend.insert("bench_data", &key, &json_data).await.expect("Insert failed");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：PostgreSQL批量插入
fn bench_postgres_batch_insert(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("postgres_batch_insert");
    
    for count in [100, 500, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.to_async(&rt).iter_batched(
                || {
                    let records: Vec<_> = (0..count)
                        .map(|i| {
                            let key = format!("batch_key_{}", i);
                            let value = random_string(100);
                            let data = random_blob(1000);
                            let timestamp = chrono::Utc::now().timestamp();
                            (key, json!({
                                "value": value,
                                "data": base64::encode(&data),
                                "created_at": timestamp
                            }))
                        })
                        .collect();
                    records
                },
                |records| async move {
                    let mut backend = create_postgres_backend().await;
                    backend.batch_insert("bench_data", records).await.expect("Batch insert failed");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：PostgreSQL查询性能
fn bench_postgres_query(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("postgres_query");
    
    // 准备数据
    let mut backend = rt.block_on(create_postgres_backend());
    let prepare_data = async {
        let records: Vec<_> = (0..10000)
            .map(|i| {
                let key = format!("query_key_{}", i);
                let value = json!({
                    "value": random_string(100),
                    "data": base64::encode(&random_blob(1000)),
                    "created_at": chrono::Utc::now().timestamp()
                });
                (key, value)
            })
            .collect();
        backend.batch_insert("bench_data", records).await.expect("Failed to prepare data");
    };
    rt.block_on(prepare_data);
    
    // 按键查询
    group.bench_function("query_by_key", |b| {
        b.to_async(&rt).iter(|| async {
            let mut backend = create_postgres_backend().await;
            let result = backend.get("bench_data", "query_key_5000").await;
            black_box(result);
        });
    });
    
    // 范围查询
    group.bench_function("query_range", |b| {
        b.to_async(&rt).iter(|| async {
            let mut backend = create_postgres_backend().await;
            let options = QueryOptions {
                conditions: vec![],
                limit: Some(1000),
                offset: Some(4000),
                order_by: None,
            };
            let results = backend.query("bench_data", &options).await.expect("Query failed");
            black_box(results);
        });
    });
    
    // 计数查询
    group.bench_function("query_count", |b| {
        b.to_async(&rt).iter(|| async {
            let mut backend = create_postgres_backend().await;
            let count = backend.count("bench_data", None).await.expect("Count failed");
            black_box(count);
        });
    });
    
    group.finish();
}

/// 基准测试：Redis查询性能
fn bench_redis_query(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("redis_query");
    
    // 准备数据
    let mut backend = rt.block_on(create_redis_backend());
    let prepare_data = async {
        for i in 0..10000 {
            let key = format!("query_key_{}", i);
            let value = json!({
                "value": random_string(100),
                "data": base64::encode(&random_blob(1000)),
                "created_at": chrono::Utc::now().timestamp()
            });
            backend.insert("bench_data", &key, &value).await.expect("Failed to insert data");
        }
    };
    rt.block_on(prepare_data);
    
    // 按键查询
    group.bench_function("query_by_key", |b| {
        b.to_async(&rt).iter(|| async {
            let mut backend = create_redis_backend().await;
            let result = backend.get("bench_data", "query_key_5000").await;
            black_box(result);
        });
    });
    
    group.finish();
}

/// 基准测试：PostgreSQL更新性能
fn bench_postgres_update(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("postgres_update");
    
    for count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.to_async(&rt).iter_batched(
                || {
                    let backend = rt.block_on(async {
                        let mut backend = create_postgres_backend().await;
                        // 插入初始数据
                        let records: Vec<_> = (0..count)
                            .map(|i| {
                                let key = format!("update_key_{}", i);
                                let value = json!({
                                    "value": random_string(100),
                                    "data": base64::encode(&random_blob(1000)),
                                    "created_at": chrono::Utc::now().timestamp()
                                });
                                (key, value)
                            })
                            .collect();
                        backend.batch_insert("bench_data", records).await.expect("Failed to prepare data");
                        backend
                    });
                    backend
                },
                |mut backend| async move {
                    for i in 0..count {
                        let key = format!("update_key_{}", i);
                        let new_value = json!({
                            "value": random_string(100),
                            "data": base64::encode(&random_blob(1000)),
                            "created_at": chrono::Utc::now().timestamp()
                        });
                        backend.update("bench_data", &key, &new_value).await.expect("Update failed");
                    }
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：PostgreSQL删除性能
fn bench_postgres_delete(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("postgres_delete");
    
    for count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.to_async(&rt).iter_batched(
                || {
                    let backend = rt.block_on(async {
                        let mut backend = create_postgres_backend().await;
                        // 插入初始数据
                        let records: Vec<_> = (0..count)
                            .map(|i| {
                                let key = format!("delete_key_{}", i);
                                let value = json!({
                                    "value": random_string(100),
                                    "data": base64::encode(&random_blob(1000)),
                                    "created_at": chrono::Utc::now().timestamp()
                                });
                                (key, value)
                            })
                            .collect();
                        backend.batch_insert("bench_data", records).await.expect("Failed to prepare data");
                        backend
                    });
                    backend
                },
                |mut backend| async move {
                    for i in 0..count {
                        let key = format!("delete_key_{}", i);
                        backend.delete("bench_data", &key).await.expect("Delete failed");
                    }
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：连接池性能
fn bench_connection_pool(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("connection_pool");
    
    // PostgreSQL连接池
    group.bench_function("postgres_connection_pool", |b| {
        b.to_async(&rt).iter(|| async {
            let mut backend = create_postgres_backend().await;
            let key = random_string(50);
            let data = json!({
                "value": random_string(100),
                "created_at": chrono::Utc::now().timestamp()
            });
            backend.insert("bench_data", &key, &data).await.expect("Insert failed");
            let result = backend.get("bench_data", &key).await.expect("Get failed");
            backend.delete("bench_data", &key).await.expect("Delete failed");
            black_box(result);
        });
    });
    
    // Redis连接池
    group.bench_function("redis_connection_pool", |b| {
        b.to_async(&rt).iter(|| async {
            let mut backend = create_redis_backend().await;
            let key = random_string(50);
            let data = json!({
                "value": random_string(100),
                "created_at": chrono::Utc::now().timestamp()
            });
            backend.insert("bench_data", &key, &data).await.expect("Insert failed");
            let result = backend.get("bench_data", &key).await.expect("Get failed");
            backend.delete("bench_data", &key).await.expect("Delete failed");
            black_box(result);
        });
    });
    
    group.finish();
}

criterion_group!(
    benches,
    bench_postgres_single_insert,
    bench_redis_single_insert,
    bench_postgres_batch_insert,
    bench_postgres_query,
    bench_redis_query,
    bench_postgres_update,
    bench_postgres_delete,
    bench_connection_pool,
);

criterion_main!(benches);