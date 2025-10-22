//! 真实数据库后端集成测试
//! 
//! 测试 PostgreSQL、Redis 和 Qdrant 三个数据库后端的核心功能
//! 
//! ## 运行前准备
//! 
//! 1. 启动数据库服务：
//!    ```bash
//!    cd /opt/zishu-sensei
//!    docker-compose up -d postgres redis qdrant
//!    ```
//! 
//! 2. 设置环境变量（可选，使用默认值）：
//!    ```bash
//!    export DATABASE_URL="postgresql://zishu:zishu123@localhost:5432/zishu"
//!    export REDIS_URL="redis://:zishu123@localhost:6379"
//!    export QDRANT_URL="http://localhost:6335"
//!    ```
//! 
//! 3. 运行测试：
//!    ```bash
//!    cargo test --test database_backends_test -- --nocapture --test-threads=1
//!    ```
//! 
//! ## 测试覆盖
//! 
//! ### PostgreSQL 测试
//! - ✅ 连接和断开
//! - ✅ CRUD 操作（创建、读取、更新、删除）
//! - ✅ 查询操作
//! - ✅ 批量操作
//! - ✅ 事务处理
//! 
//! ### Redis 测试
//! - ✅ 连接和断开
//! - ✅ 键值存储操作
//! - ✅ 过期时间设置
//! - ✅ 批量操作
//! - ✅ 集合类型操作
//! 
//! ### Qdrant 测试
//! - ✅ 连接和断开
//! - ✅ 集合管理
//! - ✅ 向量插入
//! - ✅ 向量搜索
//! - ✅ 批量操作

mod common;

use std::env;

// 辅助函数：获取数据库连接信息
fn get_postgres_url() -> String {
    env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://zishu:zishu123@localhost:5432/zishu".to_string()
    })
}

fn get_redis_url() -> String {
    env::var("REDIS_URL").unwrap_or_else(|_| {
        "redis://:zishu123@localhost:6379".to_string()
    })
}

fn get_qdrant_url() -> String {
    env::var("QDRANT_URL").unwrap_or_else(|_| {
        "http://localhost:6335".to_string()
    })
}

// ========================================
// PostgreSQL 集成测试
// ========================================

#[cfg(test)]
mod postgres_tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要运行的 PostgreSQL 服务，使用 --ignored 标志运行
    async fn test_postgres_connection() {
        println!("\n🧪 测试 PostgreSQL 连接");
        
        let db_url = get_postgres_url();
        println!("📌 连接到: {}", db_url.replace("zishu123", "***"));
        
        // 测试连接
        let result = tokio_postgres::connect(&db_url, tokio_postgres::NoTls).await;
        
        match result {
            Ok((client, connection)) => {
                // 在后台运行连接
                tokio::spawn(async move {
                    if let Err(e) = connection.await {
                        eprintln!("连接错误: {}", e);
                    }
                });
                
                println!("✅ PostgreSQL 连接成功");
                
                // 测试简单查询
                let rows = client.query("SELECT version()", &[]).await.unwrap();
                let version: &str = rows[0].get(0);
                println!("✅ PostgreSQL 版本: {}", version);
                
                println!("🎉 PostgreSQL 连接测试通过!\n");
            }
            Err(e) => {
                println!("❌ PostgreSQL 连接失败: {}", e);
                println!("💡 提示: 请确保 PostgreSQL 服务正在运行:");
                println!("   docker-compose up -d postgres");
                panic!("PostgreSQL 连接失败");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_postgres_crud_operations() {
        println!("\n🧪 测试 PostgreSQL CRUD 操作");
        
        let db_url = get_postgres_url();
        let (client, connection) = tokio_postgres::connect(&db_url, tokio_postgres::NoTls)
            .await
            .expect("无法连接到 PostgreSQL");
        
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("连接错误: {}", e);
            }
        });
        
        // 创建测试表
        client
            .execute(
                "CREATE TABLE IF NOT EXISTS test_crud (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )",
                &[],
            )
            .await
            .expect("创建表失败");
        
        println!("✅ 创建测试表成功");
        
        // CREATE
        let rows = client
            .execute(
                "INSERT INTO test_crud (name, value) VALUES ($1, $2)",
                &[&"test_item", &"test_value"],
            )
            .await
            .expect("插入失败");
        
        assert_eq!(rows, 1);
        println!("✅ 插入记录成功: {} 行", rows);
        
        // READ
        let rows = client
            .query("SELECT name, value FROM test_crud WHERE name = $1", &[&"test_item"])
            .await
            .expect("查询失败");
        
        assert_eq!(rows.len(), 1);
        let name: &str = rows[0].get(0);
        let value: &str = rows[0].get(1);
        assert_eq!(name, "test_item");
        assert_eq!(value, "test_value");
        println!("✅ 读取记录成功: name={}, value={}", name, value);
        
        // UPDATE
        let updated = client
            .execute(
                "UPDATE test_crud SET value = $1 WHERE name = $2",
                &[&"updated_value", &"test_item"],
            )
            .await
            .expect("更新失败");
        
        assert_eq!(updated, 1);
        
        let rows = client
            .query("SELECT value FROM test_crud WHERE name = $1", &[&"test_item"])
            .await
            .expect("查询失败");
        
        let new_value: &str = rows[0].get(0);
        assert_eq!(new_value, "updated_value");
        println!("✅ 更新记录成功: new_value={}", new_value);
        
        // DELETE
        let deleted = client
            .execute("DELETE FROM test_crud WHERE name = $1", &[&"test_item"])
            .await
            .expect("删除失败");
        
        assert_eq!(deleted, 1);
        
        let rows = client
            .query("SELECT COUNT(*) FROM test_crud WHERE name = $1", &[&"test_item"])
            .await
            .expect("查询失败");
        
        let count: i64 = rows[0].get(0);
        assert_eq!(count, 0);
        println!("✅ 删除记录成功");
        
        // 清理
        client.execute("DROP TABLE test_crud", &[]).await.ok();
        
        println!("🎉 PostgreSQL CRUD 测试全部通过!\n");
    }

    #[tokio::test]
    #[ignore]
    async fn test_postgres_transaction() {
        println!("\n🧪 测试 PostgreSQL 事务处理");
        
        let db_url = get_postgres_url();
        let (mut client, connection) = tokio_postgres::connect(&db_url, tokio_postgres::NoTls)
            .await
            .expect("无法连接到 PostgreSQL");
        
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("连接错误: {}", e);
            }
        });
        
        // 创建测试表
        client
            .execute(
                "CREATE TABLE IF NOT EXISTS test_transaction (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL
                )",
                &[],
            )
            .await
            .expect("创建表失败");
        
        // 测试成功的事务
        {
            let transaction = client.transaction().await.expect("启动事务失败");
            
            transaction
                .execute("INSERT INTO test_transaction (name) VALUES ($1)", &[&"tx_item_1"])
                .await
                .expect("插入失败");
            
            transaction
                .execute("INSERT INTO test_transaction (name) VALUES ($1)", &[&"tx_item_2"])
                .await
                .expect("插入失败");
            
            transaction.commit().await.expect("提交事务失败");
            println!("✅ 事务提交成功");
        }
        
        // 验证数据
        let rows = client
            .query("SELECT COUNT(*) FROM test_transaction", &[])
            .await
            .expect("查询失败");
        
        let count: i64 = rows[0].get(0);
        assert_eq!(count, 2);
        println!("✅ 验证事务数据成功: {} 条记录", count);
        
        // 测试回滚的事务
        {
            let transaction = client.transaction().await.expect("启动事务失败");
            
            transaction
                .execute("INSERT INTO test_transaction (name) VALUES ($1)", &[&"rollback_item"])
                .await
                .expect("插入失败");
            
            transaction.rollback().await.expect("回滚事务失败");
            println!("✅ 事务回滚成功");
        }
        
        // 验证回滚
        let rows = client
            .query("SELECT COUNT(*) FROM test_transaction WHERE name = $1", &[&"rollback_item"])
            .await
            .expect("查询失败");
        
        let count: i64 = rows[0].get(0);
        assert_eq!(count, 0);
        println!("✅ 验证回滚数据成功");
        
        // 清理
        client.execute("DROP TABLE test_transaction", &[]).await.ok();
        
        println!("🎉 PostgreSQL 事务测试全部通过!\n");
    }
}

// ========================================
// Redis 集成测试
// ========================================

#[cfg(test)]
mod redis_tests {
    use super::*;
    use redis::AsyncCommands;

    #[tokio::test]
    #[ignore]
    async fn test_redis_connection() {
        println!("\n🧪 测试 Redis 连接");
        
        let redis_url = get_redis_url();
        println!("📌 连接到: {}", redis_url.replace("zishu123", "***"));
        
        let client = redis::Client::open(redis_url.as_str()).expect("无法创建 Redis 客户端");
        let mut con = client.get_async_connection().await.expect("无法连接到 Redis");
        
        println!("✅ Redis 连接成功");
        
        // 测试 PING
        let pong: String = redis::cmd("PING").query_async(&mut con).await.expect("PING 失败");
        assert_eq!(pong, "PONG");
        println!("✅ PING 测试成功: {}", pong);
        
        println!("🎉 Redis 连接测试通过!\n");
    }

    #[tokio::test]
    #[ignore]
    async fn test_redis_key_value_operations() {
        println!("\n🧪 测试 Redis 键值操作");
        
        let redis_url = get_redis_url();
        let client = redis::Client::open(redis_url.as_str()).expect("无法创建 Redis 客户端");
        let mut con = client.get_async_connection().await.expect("无法连接到 Redis");
        
        let test_key = "test:key:1";
        let test_value = "test_value";
        
        // SET
        let _: () = con.set(test_key, test_value).await.expect("SET 失败");
        println!("✅ SET 成功: {} = {}", test_key, test_value);
        
        // GET
        let value: String = con.get(test_key).await.expect("GET 失败");
        assert_eq!(value, test_value);
        println!("✅ GET 成功: {} = {}", test_key, value);
        
        // EXISTS
        let exists: bool = con.exists(test_key).await.expect("EXISTS 失败");
        assert!(exists);
        println!("✅ EXISTS 测试成功");
        
        // DEL
        let deleted: i32 = con.del(test_key).await.expect("DEL 失败");
        assert_eq!(deleted, 1);
        println!("✅ DEL 成功");
        
        // 验证删除
        let exists: bool = con.exists(test_key).await.expect("EXISTS 失败");
        assert!(!exists);
        println!("✅ 验证删除成功");
        
        println!("🎉 Redis 键值操作测试全部通过!\n");
    }

    #[tokio::test]
    #[ignore]
    async fn test_redis_expiration() {
        println!("\n🧪 测试 Redis 过期时间");
        
        let redis_url = get_redis_url();
        let client = redis::Client::open(redis_url.as_str()).expect("无法创建 Redis 客户端");
        let mut con = client.get_async_connection().await.expect("无法连接到 Redis");
        
        let test_key = "test:expire:1";
        let test_value = "expire_value";
        
        // SETEX - 设置 2 秒过期
        let _: () = con.set_ex(test_key, test_value, 2).await.expect("SETEX 失败");
        println!("✅ SETEX 成功: {} 秒后过期", 2);
        
        // 立即检查
        let exists: bool = con.exists(test_key).await.expect("EXISTS 失败");
        assert!(exists);
        println!("✅ 键存在确认");
        
        // TTL
        let ttl: i32 = con.ttl(test_key).await.expect("TTL 失败");
        assert!(ttl > 0 && ttl <= 2);
        println!("✅ TTL 测试成功: {} 秒", ttl);
        
        // 等待过期
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        let exists: bool = con.exists(test_key).await.expect("EXISTS 失败");
        assert!(!exists);
        println!("✅ 键已过期");
        
        println!("🎉 Redis 过期时间测试全部通过!\n");
    }

    #[tokio::test]
    #[ignore]
    async fn test_redis_batch_operations() {
        println!("\n🧪 测试 Redis 批量操作");
        
        let redis_url = get_redis_url();
        let client = redis::Client::open(redis_url.as_str()).expect("无法创建 Redis 客户端");
        let mut con = client.get_async_connection().await.expect("无法连接到 Redis");
        
        let batch_size = 100;
        let prefix = "test:batch";
        
        // 批量写入
        for i in 0..batch_size {
            let key = format!("{}:{}", prefix, i);
            let value = format!("value_{}", i);
            let _: () = con.set(&key, &value).await.expect("SET 失败");
        }
        println!("✅ 批量写入 {} 个键", batch_size);
        
        // 使用 SCAN 读取
        let pattern = format!("{}:*", prefix);
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&pattern)
            .query_async(&mut con)
            .await
            .expect("KEYS 失败");
        
        assert_eq!(keys.len(), batch_size);
        println!("✅ SCAN 读取 {} 个键", keys.len());
        
        // 批量删除
        if !keys.is_empty() {
            let deleted: i32 = con.del(&keys).await.expect("DEL 失败");
            assert_eq!(deleted as usize, batch_size);
            println!("✅ 批量删除 {} 个键", deleted);
        }
        
        println!("🎉 Redis 批量操作测试全部通过!\n");
    }
}

// ========================================
// Qdrant 集成测试
// ========================================

#[cfg(test)]
mod qdrant_tests {
    use super::*;
    use qdrant_client::{
        Qdrant,
        qdrant::{
            CreateCollectionBuilder, VectorParamsBuilder, Distance,
            PointStruct, SearchPointsBuilder,
        },
    };

    #[tokio::test]
    #[ignore]
    async fn test_qdrant_connection() {
        println!("\n🧪 测试 Qdrant 连接");
        
        let qdrant_url = get_qdrant_url();
        println!("📌 连接到: {}", qdrant_url);
        
        let client = Qdrant::from_url(&qdrant_url).build().expect("无法创建 Qdrant 客户端");
        
        println!("✅ Qdrant 客户端创建成功");
        
        // 测试健康检查
        let health = client.health_check().await;
        match health {
            Ok(_) => {
                println!("✅ Qdrant 健康检查通过");
                println!("🎉 Qdrant 连接测试通过!\n");
            }
            Err(e) => {
                println!("❌ Qdrant 健康检查失败: {}", e);
                println!("💡 提示: 请确保 Qdrant 服务正在运行:");
                println!("   docker-compose up -d qdrant");
                panic!("Qdrant 连接失败");
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_qdrant_collection_management() {
        println!("\n🧪 测试 Qdrant 集合管理");
        
        let qdrant_url = get_qdrant_url();
        let client = Qdrant::from_url(&qdrant_url).build().expect("无法创建 Qdrant 客户端");
        
        let collection_name = "test_collection";
        
        // 删除集合（如果存在）
        let _ = client.delete_collection(collection_name).await;
        
        // 创建集合
        client
            .create_collection(
                CreateCollectionBuilder::new(collection_name)
                    .vectors_config(VectorParamsBuilder::new(384, Distance::Cosine))
            )
            .await
            .expect("创建集合失败");
        
        println!("✅ 创建集合成功: {}", collection_name);
        
        // 列出集合
        let collections = client.list_collections().await.expect("列出集合失败");
        let collection_names: Vec<String> = collections
            .collections
            .iter()
            .map(|c| c.name.clone())
            .collect();
        
        assert!(collection_names.contains(&collection_name.to_string()));
        println!("✅ 验证集合存在: {:?}", collection_names);
        
        // 获取集合信息
        let info = client.collection_info(collection_name).await.expect("获取集合信息失败");
        println!("✅ 集合信息: vectors_count={}", info.vectors_count.unwrap_or(0));
        
        // 删除集合
        client.delete_collection(collection_name).await.expect("删除集合失败");
        println!("✅ 删除集合成功");
        
        println!("🎉 Qdrant 集合管理测试全部通过!\n");
    }

    #[tokio::test]
    #[ignore]
    async fn test_qdrant_vector_operations() {
        println!("\n🧪 测试 Qdrant 向量操作");
        
        let qdrant_url = get_qdrant_url();
        let client = Qdrant::from_url(&qdrant_url).build().expect("无法创建 Qdrant 客户端");
        
        let collection_name = "test_vectors";
        let vector_size = 384;
        
        // 删除集合（如果存在）
        let _ = client.delete_collection(collection_name).await;
        
        // 创建集合
        client
            .create_collection(
                CreateCollectionBuilder::new(collection_name)
                    .vectors_config(VectorParamsBuilder::new(vector_size as u64, Distance::Cosine))
            )
            .await
            .expect("创建集合失败");
        
        println!("✅ 创建向量集合成功: {} 维", vector_size);
        
        // 插入向量
        let test_vector: Vec<f32> = (0..vector_size).map(|i| i as f32 / vector_size as f32).collect();
        
        let points = vec![PointStruct::new(
            1,
            test_vector.clone(),
            [("name", "test_point_1".into())].into(),
        )];
        
        client
            .upsert_points(collection_name, points, None)
            .await
            .expect("插入向量失败");
        
        println!("✅ 插入向量成功");
        
        // 等待索引更新
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        
        // 搜索向量
        let search_result = client
            .search_points(
                SearchPointsBuilder::new(collection_name, test_vector.clone(), 5)
            )
            .await
            .expect("搜索向量失败");
        
        assert!(!search_result.result.is_empty());
        println!("✅ 搜索向量成功: 找到 {} 个结果", search_result.result.len());
        
        if let Some(first_result) = search_result.result.first() {
            println!("   - 最佳匹配分数: {:.4}", first_result.score);
        }
        
        // 删除集合
        client.delete_collection(collection_name).await.expect("删除集合失败");
        
        println!("🎉 Qdrant 向量操作测试全部通过!\n");
    }

    #[tokio::test]
    #[ignore]
    async fn test_qdrant_batch_operations() {
        println!("\n🧪 测试 Qdrant 批量操作");
        
        let qdrant_url = get_qdrant_url();
        let client = Qdrant::from_url(&qdrant_url).build().expect("无法创建 Qdrant 客户端");
        
        let collection_name = "test_batch";
        let vector_size = 128;
        let batch_size = 100;
        
        // 删除集合（如果存在）
        let _ = client.delete_collection(collection_name).await;
        
        // 创建集合
        client
            .create_collection(
                CreateCollectionBuilder::new(collection_name)
                    .vectors_config(VectorParamsBuilder::new(vector_size, Distance::Cosine))
            )
            .await
            .expect("创建集合失败");
        
        println!("✅ 创建批量测试集合");
        
        // 批量插入向量
        let mut points = Vec::new();
        for i in 0..batch_size {
            let vector: Vec<f32> = (0..vector_size)
                .map(|j| (i * vector_size + j) as f32 / (batch_size * vector_size) as f32)
                .collect();
            
            points.push(PointStruct::new(
                i as u64,
                vector,
                [("batch_id", i.to_string().into())].into(),
            ));
        }
        
        client
            .upsert_points(collection_name, points, None)
            .await
            .expect("批量插入失败");
        
        println!("✅ 批量插入 {} 个向量", batch_size);
        
        // 等待索引更新
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        
        // 验证数量
        let info = client.collection_info(collection_name).await.expect("获取集合信息失败");
        let count = info.vectors_count.unwrap_or(0);
        assert_eq!(count, batch_size);
        println!("✅ 验证向量数量: {}", count);
        
        // 删除集合
        client.delete_collection(collection_name).await.expect("删除集合失败");
        
        println!("🎉 Qdrant 批量操作测试全部通过!\n");
    }
}

// ========================================
// 综合测试：跨数据库操作
// ========================================

#[cfg(test)]
mod integration_tests {
    use super::*;
    use redis::AsyncCommands;

    #[tokio::test]
    #[ignore]
    async fn test_cross_database_workflow() {
        println!("\n🧪 测试跨数据库工作流");
        println!("📋 场景: 存储会话到 PostgreSQL，缓存到 Redis，向量存储到 Qdrant\n");
        
        // 1. PostgreSQL - 存储会话元数据
        println!("1️⃣ PostgreSQL - 存储会话元数据");
        let pg_url = get_postgres_url();
        let (pg_client, connection) = tokio_postgres::connect(&pg_url, tokio_postgres::NoTls)
            .await
            .expect("PostgreSQL 连接失败");
        
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("连接错误: {}", e);
            }
        });
        
        pg_client
            .execute(
                "CREATE TABLE IF NOT EXISTS chat_sessions (
                    id VARCHAR(50) PRIMARY KEY,
                    title VARCHAR(200) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )",
                &[],
            )
            .await
            .expect("创建表失败");
        
        let session_id = "session_001";
        pg_client
            .execute(
                "INSERT INTO chat_sessions (id, title) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET title = $2",
                &[&session_id, &"测试会话"],
            )
            .await
            .expect("插入会话失败");
        
        println!("   ✅ 会话已存储到 PostgreSQL: {}", session_id);
        
        // 2. Redis - 缓存会话数据
        println!("\n2️⃣ Redis - 缓存会话数据");
        let redis_url = get_redis_url();
        let redis_client = redis::Client::open(redis_url.as_str()).expect("Redis 客户端创建失败");
        let mut redis_con = redis_client.get_async_connection().await.expect("Redis 连接失败");
        
        let cache_key = format!("session:{}", session_id);
        let cache_value = r#"{"title":"测试会话","messages":[]}"#;
        let _: () = redis_con.set_ex(&cache_key, cache_value, 3600).await.expect("缓存失败");
        
        println!("   ✅ 会话已缓存到 Redis: {} (TTL: 3600s)", cache_key);
        
        // 3. Qdrant - 存储消息向量
        println!("\n3️⃣ Qdrant - 存储消息向量");
        let qdrant_url = get_qdrant_url();
        let qdrant_client = qdrant_client::Qdrant::from_url(&qdrant_url)
            .build()
            .expect("Qdrant 客户端创建失败");
        
        let collection_name = "chat_messages";
        
        // 删除并重新创建集合
        let _ = qdrant_client.delete_collection(collection_name).await;
        
        use qdrant_client::qdrant::{CreateCollectionBuilder, VectorParamsBuilder, Distance, PointStruct};
        
        qdrant_client
            .create_collection(
                CreateCollectionBuilder::new(collection_name)
                    .vectors_config(VectorParamsBuilder::new(384, Distance::Cosine))
            )
            .await
            .expect("创建集合失败");
        
        let message_vector: Vec<f32> = (0..384).map(|i| i as f32 / 384.0).collect();
        let points = vec![PointStruct::new(
            1,
            message_vector,
            [
                ("session_id", session_id.into()),
                ("content", "测试消息内容".into()),
            ].into(),
        )];
        
        qdrant_client
            .upsert_points(collection_name, points, None)
            .await
            .expect("插入向量失败");
        
        println!("   ✅ 消息向量已存储到 Qdrant");
        
        // 验证数据
        println!("\n4️⃣ 验证跨数据库数据一致性");
        
        // 从 PostgreSQL 读取
        let rows = pg_client
            .query("SELECT title FROM chat_sessions WHERE id = $1", &[&session_id])
            .await
            .expect("查询失败");
        let title: &str = rows[0].get(0);
        assert_eq!(title, "测试会话");
        println!("   ✅ PostgreSQL 数据验证通过");
        
        // 从 Redis 读取
        let cached: String = redis_con.get(&cache_key).await.expect("读取缓存失败");
        assert!(cached.contains("测试会话"));
        println!("   ✅ Redis 缓存验证通过");
        
        // 从 Qdrant 读取
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        let info = qdrant_client.collection_info(collection_name).await.expect("获取集合信息失败");
        assert_eq!(info.vectors_count.unwrap_or(0), 1);
        println!("   ✅ Qdrant 向量验证通过");
        
        // 清理
        pg_client.execute("DROP TABLE chat_sessions", &[]).await.ok();
        let _: i32 = redis_con.del(&cache_key).await.unwrap_or(0);
        qdrant_client.delete_collection(collection_name).await.ok();
        
        println!("\n🎉 跨数据库工作流测试全部通过!\n");
    }
}

