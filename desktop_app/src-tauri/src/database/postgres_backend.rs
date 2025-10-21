//! PostgreSQL 数据库后端实现

use async_trait::async_trait;
use deadpool_postgres::{Config, Pool, Runtime};
use serde_json;
use std::collections::HashMap;
use tokio_postgres::{NoTls, Row};
use tracing::{error, info, warn};

use super::backends::*;

// ================================
// PostgreSQL 后端
// ================================

/// PostgreSQL 数据库后端
pub struct PostgresBackend {
    pool: Option<Pool>,
    connected: bool,
}

impl PostgresBackend {
    /// 创建新的 PostgreSQL 后端
    pub fn new() -> Self {
        Self {
            pool: None,
            connected: false,
        }
    }

    /// 获取连接池
    fn get_pool(&self) -> DatabaseResult<&Pool> {
        self.pool
            .as_ref()
            .ok_or_else(|| DatabaseError::ConnectionError("未连接到数据库".to_string()))
    }

    /// 将行转换为JSON值
    fn row_to_json(&self, row: &Row) -> DatabaseResult<serde_json::Value> {
        let data: serde_json::Value = row
            .try_get("data")
            .map_err(|e| DatabaseError::QueryError(format!("获取data字段失败: {}", e)))?;
        Ok(data)
    }
}

impl Default for PostgresBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DatabaseBackend for PostgresBackend {
    fn backend_type(&self) -> DatabaseBackendType {
        DatabaseBackendType::PostgreSQL
    }

    async fn connect(&mut self, config: &DatabaseConfig) -> DatabaseResult<()> {
        info!(
            "连接到 PostgreSQL 数据库: {}",
            config.connection_string
        );

        // 解析连接字符串
        if !config.connection_string.starts_with("postgres://") && !config.connection_string.starts_with("postgresql://") {
            return Err(DatabaseError::ConnectionError(
                "无效的PostgreSQL连接字符串".to_string()
            ));
        }

        // 使用 tokio_postgres::Config 解析连接字符串
        let tokio_pg_config: tokio_postgres::Config = config.connection_string.parse()
            .map_err(|e| DatabaseError::ConnectionError(format!("解析连接字符串失败: {}", e)))?;

        // 创建 deadpool 配置
        let mut pg_config = Config::new();
        pg_config.host = tokio_pg_config.get_hosts().first().and_then(|h| {
            match h {
                tokio_postgres::config::Host::Tcp(s) => Some(s.clone()),
                _ => None,
            }
        });
        pg_config.port = tokio_pg_config.get_ports().first().copied();
        pg_config.dbname = tokio_pg_config.get_dbname().map(|s| s.to_string());
        pg_config.user = tokio_pg_config.get_user().map(|s| s.to_string());
        pg_config.password = tokio_pg_config.get_password().map(|p| String::from_utf8_lossy(p).to_string());

        // 设置连接池大小
        if let Some(max_size) = config.max_connections {
            pg_config.pool = Some(deadpool_postgres::PoolConfig::new(max_size));
        }

        pg_config.manager = Some(deadpool_postgres::ManagerConfig {
            recycling_method: deadpool_postgres::RecyclingMethod::Fast,
        });

        // 创建连接池
        let pool = pg_config
            .create_pool(Some(Runtime::Tokio1), NoTls)
            .map_err(|e| DatabaseError::ConnectionError(format!("创建连接池失败: {}", e)))?;

        // 测试连接
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(format!("获取连接失败: {}", e)))?;

        // 验证连接
        client
            .execute("SELECT 1", &[])
            .await
            .map_err(|e| DatabaseError::ConnectionError(format!("测试连接失败: {}", e)))?;

        self.pool = Some(pool);
        self.connected = true;

        info!("PostgreSQL 数据库连接成功");
        Ok(())
    }

    async fn disconnect(&mut self) -> DatabaseResult<()> {
        info!("断开 PostgreSQL 数据库连接");
        self.pool = None;
        self.connected = false;
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected && self.pool.is_some()
    }

    async fn create_collection(&self, name: &str, schema: Option<&str>) -> DatabaseResult<()> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        // 如果提供了自定义schema，使用它；否则使用默认schema
        let create_sql = if let Some(custom_schema) = schema {
            custom_schema.to_string()
        } else {
            format!(
                "CREATE TABLE IF NOT EXISTS {} (
                    key VARCHAR(255) PRIMARY KEY,
                    data JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )",
                name
            )
        };

        client
            .execute(&create_sql, &[])
            .await
            .map_err(|e| DatabaseError::QueryError(format!("创建表失败: {}", e)))?;

        // 创建索引
        let index_sql = format!(
            "CREATE INDEX IF NOT EXISTS idx_{}_{} ON {} USING GIN(data)",
            name, "data", name
        );
        
        client
            .execute(&index_sql, &[])
            .await
            .map_err(|e| DatabaseError::QueryError(format!("创建索引失败: {}", e)))?;

        info!("成功创建集合: {}", name);
        Ok(())
    }

    async fn drop_collection(&self, name: &str) -> DatabaseResult<()> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let sql = format!("DROP TABLE IF EXISTS {} CASCADE", name);
        client
            .execute(&sql, &[])
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        info!("成功删除集合: {}", name);
        Ok(())
    }

    async fn collection_exists(&self, name: &str) -> DatabaseResult<bool> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let row = client
            .query_one(
                "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )",
                &[&name],
            )
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        let exists: bool = row.get(0);
        Ok(exists)
    }

    async fn insert(
        &self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let sql = format!(
            "INSERT INTO {} (key, data, created_at, updated_at) 
             VALUES ($1, $2, NOW(), NOW())",
            collection
        );

        client
            .execute(&sql, &[&key, &data])
            .await
            .map_err(|e| {
                if e.to_string().contains("duplicate key") {
                    DatabaseError::Duplicate(format!("键 {} 已存在", key))
                } else {
                    DatabaseError::QueryError(e.to_string())
                }
            })?;

        Ok(())
    }

    async fn batch_insert(
        &self,
        collection: &str,
        items: Vec<(String, serde_json::Value)>,
    ) -> DatabaseResult<()> {
        let pool = self.get_pool()?;
        let mut client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let transaction = client
            .transaction()
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        let sql = format!(
            "INSERT INTO {} (key, data, created_at, updated_at) 
             VALUES ($1, $2, NOW(), NOW())",
            collection
        );

        for (key, data) in items {
            transaction
                .execute(&sql, &[&key, &data])
                .await
                .map_err(|e| DatabaseError::QueryError(e.to_string()))?;
        }

        transaction
            .commit()
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        Ok(())
    }

    async fn get(
        &self,
        collection: &str,
        key: &str,
    ) -> DatabaseResult<Option<serde_json::Value>> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let sql = format!("SELECT data FROM {} WHERE key = $1", collection);

        let result = client.query_opt(&sql, &[&key]).await.map_err(|e| {
            DatabaseError::QueryError(format!("查询失败: {}", e))
        })?;

        match result {
            Some(row) => {
                let data = self.row_to_json(&row)?;
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
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let sql = format!(
            "UPDATE {} SET data = $2, updated_at = NOW() WHERE key = $1",
            collection
        );

        let rows_affected = client
            .execute(&sql, &[&key, &data])
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        if rows_affected == 0 {
            return Err(DatabaseError::NotFound(format!("键 {} 不存在", key)));
        }

        Ok(())
    }

    async fn delete(&self, collection: &str, key: &str) -> DatabaseResult<()> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let sql = format!("DELETE FROM {} WHERE key = $1", collection);

        let rows_affected = client
            .execute(&sql, &[&key])
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        if rows_affected == 0 {
            return Err(DatabaseError::NotFound(format!("键 {} 不存在", key)));
        }

        Ok(())
    }

    async fn query(
        &self,
        collection: &str,
        options: &QueryOptions,
    ) -> DatabaseResult<Vec<(String, serde_json::Value)>> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let mut sql = format!("SELECT key, data FROM {}", collection);
        let mut where_clauses = Vec::new();

        // 构建WHERE子句
        for condition in &options.conditions {
            let clause = match condition.operator {
                QueryOperator::Eq => format!("data->>'{}' = '{}'", condition.field, condition.value),
                QueryOperator::Ne => format!("data->>'{}' != '{}'", condition.field, condition.value),
                QueryOperator::Gt => format!("(data->>'{}')::numeric > {}", condition.field, condition.value),
                QueryOperator::Gte => format!("(data->>'{}')::numeric >= {}", condition.field, condition.value),
                QueryOperator::Lt => format!("(data->>'{}')::numeric < {}", condition.field, condition.value),
                QueryOperator::Lte => format!("(data->>'{}')::numeric <= {}", condition.field, condition.value),
                QueryOperator::Exists => format!("data ? '{}'", condition.field),
                _ => continue,
            };
            where_clauses.push(clause);
        }

        if !where_clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&where_clauses.join(" AND "));
        }

        // ORDER BY
        if let Some(order_by) = &options.order_by {
            let order_clauses: Vec<String> = order_by
                .iter()
                .map(|(field, asc)| {
                    format!(
                        "data->>'{}' {}",
                        field,
                        if *asc { "ASC" } else { "DESC" }
                    )
                })
                .collect();
            sql.push_str(" ORDER BY ");
            sql.push_str(&order_clauses.join(", "));
        }

        // LIMIT and OFFSET
        if let Some(limit) = options.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }
        if let Some(offset) = options.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        let rows = client
            .query(&sql, &[])
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            let key: String = row.get(0);
            let data = self.row_to_json(&row)?;
            results.push((key, data));
        }

        Ok(results)
    }

    async fn count(&self, collection: &str, options: Option<&QueryOptions>) -> DatabaseResult<usize> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let mut sql = format!("SELECT COUNT(*) FROM {}", collection);

        if let Some(opts) = options {
            let mut where_clauses = Vec::new();
            for condition in &opts.conditions {
                let clause = match condition.operator {
                    QueryOperator::Eq => format!("data->>'{}' = '{}'", condition.field, condition.value),
                    QueryOperator::Ne => format!("data->>'{}' != '{}'", condition.field, condition.value),
                    _ => continue,
                };
                where_clauses.push(clause);
            }

            if !where_clauses.is_empty() {
                sql.push_str(" WHERE ");
                sql.push_str(&where_clauses.join(" AND "));
            }
        }

        let row = client
            .query_one(&sql, &[])
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        let count: i64 = row.get(0);
        Ok(count as usize)
    }

    async fn clear_collection(&self, collection: &str) -> DatabaseResult<()> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let sql = format!("DELETE FROM {}", collection);
        client
            .execute(&sql, &[])
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        info!("成功清空集合: {}", collection);
        Ok(())
    }

    async fn execute_raw(&self, query: &str) -> DatabaseResult<serde_json::Value> {
        let pool = self.get_pool()?;
        let client = pool
            .get()
            .await
            .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

        let rows = client
            .query(query, &[])
            .await
            .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

        let mut results = Vec::new();
        for row in rows {
            let mut obj = serde_json::Map::new();
            for (i, column) in row.columns().iter().enumerate() {
                let name = column.name();
                // 尝试获取不同类型的值
                let value: serde_json::Value = if let Ok(v) = row.try_get::<_, String>(i) {
                    serde_json::Value::String(v)
                } else if let Ok(v) = row.try_get::<_, i32>(i) {
                    serde_json::Value::Number(v.into())
                } else if let Ok(v) = row.try_get::<_, i64>(i) {
                    serde_json::Value::Number(v.into())
                } else if let Ok(v) = row.try_get::<_, bool>(i) {
                    serde_json::Value::Bool(v)
                } else {
                    serde_json::Value::Null
                };
                obj.insert(name.to_string(), value);
            }
            results.push(serde_json::Value::Object(obj));
        }

        Ok(serde_json::Value::Array(results))
    }

    async fn begin_transaction(&self) -> DatabaseResult<Box<dyn DatabaseTransaction>> {
        Err(DatabaseError::Other(
            "PostgreSQL事务暂不支持".to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_postgres_backend_type() {
        let backend = PostgresBackend::new();
        assert_eq!(backend.backend_type(), DatabaseBackendType::PostgreSQL);
        assert!(!backend.is_connected());
    }
}

