// benches/database_bench.rs
//! 数据库性能基准测试
//! 
//! 测试数据库的插入、查询、更新、删除操作性能以及并发性能

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use rusqlite::{Connection, params};
use tempfile::TempDir;
use std::path::PathBuf;
use rand::{Rng, thread_rng, distributions::Alphanumeric};

/// 创建临时数据库
fn create_temp_db() -> (TempDir, Connection) {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let db_path = temp_dir.path().join("bench.db");
    let conn = Connection::open(&db_path).expect("Failed to create database");
    
    // 创建测试表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_data (
            id INTEGER PRIMARY KEY,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            data BLOB,
            created_at INTEGER NOT NULL
        )",
        [],
    ).expect("Failed to create table");
    
    // 创建索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_key ON test_data(key)",
        [],
    ).expect("Failed to create index");
    
    (temp_dir, conn)
}

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

/// 基准测试：单条插入
fn bench_single_insert(c: &mut Criterion) {
    let mut group = c.benchmark_group("database_single_insert");
    
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.iter_batched(
                || {
                    let (_dir, conn) = create_temp_db();
                    (conn, random_string(50), random_string(100), random_blob(size))
                },
                |(conn, key, value, data)| {
                    conn.execute(
                        "INSERT INTO test_data (key, value, data, created_at) VALUES (?1, ?2, ?3, ?4)",
                        params![key, value, data, chrono::Utc::now().timestamp()],
                    ).expect("Insert failed");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：批量插入
fn bench_batch_insert(c: &mut Criterion) {
    let mut group = c.benchmark_group("database_batch_insert");
    
    for count in [100, 500, 1000, 5000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.iter_batched(
                || {
                    let (_dir, conn) = create_temp_db();
                    let records: Vec<_> = (0..count)
                        .map(|_| (random_string(50), random_string(100), random_blob(1000)))
                        .collect();
                    (conn, records)
                },
                |(conn, records)| {
                    let tx = conn.unchecked_transaction().expect("Failed to begin transaction");
                    for (key, value, data) in records {
                        tx.execute(
                            "INSERT INTO test_data (key, value, data, created_at) VALUES (?1, ?2, ?3, ?4)",
                            params![key, value, data, chrono::Utc::now().timestamp()],
                        ).expect("Insert failed");
                    }
                    tx.commit().expect("Failed to commit");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：查询性能
fn bench_query(c: &mut Criterion) {
    let mut group = c.benchmark_group("database_query");
    
    // 准备数据库
    let (_dir, conn) = create_temp_db();
    let tx = conn.unchecked_transaction().expect("Failed to begin transaction");
    for i in 0..10000 {
        tx.execute(
            "INSERT INTO test_data (key, value, data, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                format!("key_{}", i),
                random_string(100),
                random_blob(1000),
                chrono::Utc::now().timestamp()
            ],
        ).expect("Insert failed");
    }
    tx.commit().expect("Failed to commit");
    
    // 按主键查询
    group.bench_function("query_by_primary_key", |b| {
        b.iter(|| {
            let mut stmt = conn.prepare("SELECT * FROM test_data WHERE id = ?1")
                .expect("Failed to prepare");
            let _result: Vec<i64> = stmt.query_map([5000], |row| row.get(0))
                .expect("Query failed")
                .collect::<Result<Vec<_>, _>>()
                .expect("Failed to collect");
        });
    });
    
    // 按索引查询
    group.bench_function("query_by_indexed_column", |b| {
        b.iter(|| {
            let mut stmt = conn.prepare("SELECT * FROM test_data WHERE key = ?1")
                .expect("Failed to prepare");
            let _result: Vec<i64> = stmt.query_map(["key_5000"], |row| row.get(0))
                .expect("Query failed")
                .collect::<Result<Vec<_>, _>>()
                .expect("Failed to collect");
        });
    });
    
    // 范围查询
    group.bench_function("query_range", |b| {
        b.iter(|| {
            let mut stmt = conn.prepare("SELECT * FROM test_data WHERE id BETWEEN ?1 AND ?2")
                .expect("Failed to prepare");
            let _result: Vec<i64> = stmt.query_map([4000, 6000], |row| row.get(0))
                .expect("Query failed")
                .collect::<Result<Vec<_>, _>>()
                .expect("Failed to collect");
        });
    });
    
    // 计数查询
    group.bench_function("query_count", |b| {
        b.iter(|| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM test_data",
                [],
                |row| row.get(0)
            ).expect("Query failed");
            black_box(count);
        });
    });
    
    group.finish();
}

/// 基准测试：更新性能
fn bench_update(c: &mut Criterion) {
    let mut group = c.benchmark_group("database_update");
    
    for count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.iter_batched(
                || {
                    let (_dir, conn) = create_temp_db();
                    // 插入初始数据
                    let tx = conn.unchecked_transaction().expect("Failed to begin transaction");
                    for i in 0..count {
                        tx.execute(
                            "INSERT INTO test_data (key, value, data, created_at) VALUES (?1, ?2, ?3, ?4)",
                            params![
                                format!("key_{}", i),
                                random_string(100),
                                random_blob(1000),
                                chrono::Utc::now().timestamp()
                            ],
                        ).expect("Insert failed");
                    }
                    tx.commit().expect("Failed to commit");
                    conn
                },
                |conn| {
                    let tx = conn.unchecked_transaction().expect("Failed to begin transaction");
                    for i in 0..count {
                        tx.execute(
                            "UPDATE test_data SET value = ?1 WHERE key = ?2",
                            params![random_string(100), format!("key_{}", i)],
                        ).expect("Update failed");
                    }
                    tx.commit().expect("Failed to commit");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：删除性能
fn bench_delete(c: &mut Criterion) {
    let mut group = c.benchmark_group("database_delete");
    
    for count in [10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.iter_batched(
                || {
                    let (_dir, conn) = create_temp_db();
                    // 插入初始数据
                    let tx = conn.unchecked_transaction().expect("Failed to begin transaction");
                    for i in 0..count {
                        tx.execute(
                            "INSERT INTO test_data (key, value, data, created_at) VALUES (?1, ?2, ?3, ?4)",
                            params![
                                format!("key_{}", i),
                                random_string(100),
                                random_blob(1000),
                                chrono::Utc::now().timestamp()
                            ],
                        ).expect("Insert failed");
                    }
                    tx.commit().expect("Failed to commit");
                    conn
                },
                |conn| {
                    let tx = conn.unchecked_transaction().expect("Failed to begin transaction");
                    for i in 0..count {
                        tx.execute(
                            "DELETE FROM test_data WHERE key = ?1",
                            params![format!("key_{}", i)],
                        ).expect("Delete failed");
                    }
                    tx.commit().expect("Failed to commit");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：事务性能
fn bench_transaction(c: &mut Criterion) {
    let mut group = c.benchmark_group("database_transaction");
    
    // 无事务的批量操作
    group.bench_function("without_transaction", |b| {
        b.iter_batched(
            || {
                let (_dir, conn) = create_temp_db();
                conn
            },
            |conn| {
                for i in 0..100 {
                    conn.execute(
                        "INSERT INTO test_data (key, value, data, created_at) VALUES (?1, ?2, ?3, ?4)",
                        params![
                            format!("key_{}", i),
                            random_string(100),
                            random_blob(1000),
                            chrono::Utc::now().timestamp()
                        ],
                    ).expect("Insert failed");
                }
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    // 有事务的批量操作
    group.bench_function("with_transaction", |b| {
        b.iter_batched(
            || {
                let (_dir, conn) = create_temp_db();
                conn
            },
            |conn| {
                let tx = conn.unchecked_transaction().expect("Failed to begin transaction");
                for i in 0..100 {
                    tx.execute(
                        "INSERT INTO test_data (key, value, data, created_at) VALUES (?1, ?2, ?3, ?4)",
                        params![
                            format!("key_{}", i),
                            random_string(100),
                            random_blob(1000),
                            chrono::Utc::now().timestamp()
                        ],
                    ).expect("Insert failed");
                }
                tx.commit().expect("Failed to commit");
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    group.finish();
}

criterion_group!(
    benches,
    bench_single_insert,
    bench_batch_insert,
    bench_query,
    bench_update,
    bench_delete,
    bench_transaction,
);

criterion_main!(benches);

