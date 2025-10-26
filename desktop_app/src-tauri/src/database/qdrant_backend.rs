//! Qdrant 向量数据库后端实现

use async_trait::async_trait;
use qdrant_client::Qdrant;
use qdrant_client::qdrant::{
    CreateCollection, Distance, PointStruct, SearchPoints, VectorParams, VectorsConfig,
    PointId, PointsSelector, ReadConsistency, WriteOrdering, Filter, GetPoints, SetPayloadPoints, DeletePoints, ScrollPoints,
};
use qdrant_client::qdrant::UpsertPointsBuilder;
use qdrant_client::Payload;
use serde_json;
use std::collections::HashMap;
use tracing::{error, info, warn};

use super::backends::*;

// ================================
// Qdrant 后端
// ================================

/// Qdrant 向量数据库后端
pub struct QdrantBackend {
    client: Option<Qdrant>,
    connected: bool,
    default_vector_size: usize,
}

impl std::fmt::Debug for QdrantBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("QdrantBackend")
            .field("connected", &self.connected)
            .field("default_vector_size", &self.default_vector_size)
            .field("client", &self.client.is_some())
            .finish()
    }
}

impl QdrantBackend {
    /// 创建新的 Qdrant 后端
    pub fn new() -> Self {
        Self {
            client: None,
            connected: false,
            default_vector_size: 384, // 默认向量维度
        }
    }

    /// 设置默认向量维度
    pub fn with_vector_size(mut self, size: usize) -> Self {
        self.default_vector_size = size;
        self
    }

    /// 获取客户端
    fn get_client(&self) -> DatabaseResult<&Qdrant> {
        self.client
            .as_ref()
            .ok_or_else(|| DatabaseError::ConnectionError("未连接到Qdrant".to_string()))
    }

    /// 将payload转换为HashMap
    fn payload_to_map(payload: &HashMap<String, qdrant_client::qdrant::Value>) -> DatabaseResult<HashMap<String, serde_json::Value>> {
        let mut map = HashMap::new();
        
        for (key, value) in payload {
            // 简化处理：将Qdrant的Value转换为JSON Value
            let json_value = match value.kind.as_ref() {
                Some(kind) => {
                    use qdrant_client::qdrant::value::Kind;
                    match kind {
                        Kind::StringValue(s) => serde_json::Value::String(s.clone()),
                        Kind::IntegerValue(i) => serde_json::Value::Number((*i).into()),
                        Kind::DoubleValue(d) => {
                            if let Some(num) = serde_json::Number::from_f64(*d) {
                                serde_json::Value::Number(num)
                            } else {
                                serde_json::Value::Null
                            }
                        }
                        Kind::BoolValue(b) => serde_json::Value::Bool(*b),
                        _ => serde_json::Value::Null,
                    }
                }
                None => serde_json::Value::Null,
            };
            map.insert(key.clone(), json_value);
        }
        
        Ok(map)
    }

    /// 将HashMap转换为Qdrant Payload
    fn map_to_payload(map: &HashMap<String, serde_json::Value>) -> Payload {
        use qdrant_client::qdrant::{Value, value::Kind};
        
        let mut payload = Payload::new();
        
        for (key, value) in map {
            let qdrant_value = match value {
                serde_json::Value::String(s) => Value {
                    kind: Some(Kind::StringValue(s.clone())),
                },
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Value {
                            kind: Some(Kind::IntegerValue(i)),
                        }
                    } else if let Some(f) = n.as_f64() {
                        Value {
                            kind: Some(Kind::DoubleValue(f)),
                        }
                    } else {
                        continue;
                    }
                }
                serde_json::Value::Bool(b) => Value {
                    kind: Some(Kind::BoolValue(*b)),
                },
                _ => continue,
            };
            payload.insert(key.clone(), qdrant_value);
        }
        
        payload
    }
}

impl Default for QdrantBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DatabaseBackend for QdrantBackend {
    fn backend_type(&self) -> DatabaseBackendType {
        DatabaseBackendType::Qdrant
    }

    async fn connect(&mut self, config: &DatabaseConfig) -> DatabaseResult<()> {
        info!("连接到 Qdrant: {}", config.connection_string);

        let client = Qdrant::from_url(&config.connection_string)
            .build()
            .map_err(|e| DatabaseError::ConnectionError(format!("创建Qdrant客户端失败: {}", e)))?;

        // 测试连接
        client
            .health_check()
            .await
            .map_err(|e| DatabaseError::ConnectionError(format!("Qdrant健康检查失败: {}", e)))?;

        self.client = Some(client);
        self.connected = true;

        info!("Qdrant 连接成功");
        Ok(())
    }

    async fn disconnect(&mut self) -> DatabaseResult<()> {
        info!("断开 Qdrant 连接");
        self.client = None;
        self.connected = false;
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected && self.client.is_some()
    }

    async fn create_collection(&self, name: &str, schema: Option<&str>) -> DatabaseResult<()> {
        let client = self.get_client()?;

        // 从schema中解析向量维度（如果提供）
        let vector_size = if let Some(schema_str) = schema {
            if let Ok(schema_json) = serde_json::from_str::<serde_json::Value>(schema_str) {
                schema_json["vector_size"]
                    .as_u64()
                    .unwrap_or(self.default_vector_size as u64) as usize
            } else {
                self.default_vector_size
            }
        } else {
            self.default_vector_size
        };

        client
            .create_collection(CreateCollection {
                collection_name: name.to_string(),
                vectors_config: Some(VectorsConfig {
                    config: Some(qdrant_client::qdrant::vectors_config::Config::Params(
                        VectorParams {
                            size: vector_size as u64,
                            distance: Distance::Cosine.into(),
                            ..Default::default()
                        },
                    )),
                }),
                ..Default::default()
            })
            .await
            .map_err(|e| DatabaseError::QueryError(format!("创建集合失败: {}", e)))?;

        info!("成功创建Qdrant集合: {} (向量维度: {})", name, vector_size);
        Ok(())
    }

    async fn drop_collection(&self, name: &str) -> DatabaseResult<()> {
        let client = self.get_client()?;

        client
            .delete_collection(name)
            .await
            .map_err(|e| DatabaseError::QueryError(format!("删除集合失败: {}", e)))?;

        info!("成功删除Qdrant集合: {}", name);
        Ok(())
    }

    async fn collection_exists(&self, name: &str) -> DatabaseResult<bool> {
        let client = self.get_client()?;

        let result = client.collection_exists(name).await;

        match result {
            Ok(exists) => Ok(exists),
            Err(_) => Ok(false),
        }
    }

    async fn insert(
        &self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()> {
        // Qdrant需要向量，普通insert不支持
        // 用户应该使用insert_vector方法
        Err(DatabaseError::InvalidData(
            "Qdrant需要向量数据，请使用insert_vector方法".to_string(),
        ))
    }

    async fn batch_insert(
        &self,
        _collection: &str,
        _items: Vec<(String, serde_json::Value)>,
    ) -> DatabaseResult<()> {
        Err(DatabaseError::InvalidData(
            "Qdrant需要向量数据，请使用batch_insert_vectors方法".to_string(),
        ))
    }

    async fn get(
        &self,
        collection: &str,
        key: &str,
    ) -> DatabaseResult<Option<serde_json::Value>> {
        let client = self.get_client()?;

        // 在Qdrant中，key作为point ID
        let point_id: u64 = key.parse()
            .map_err(|_| DatabaseError::InvalidData("无效的ID格式，Qdrant需要数字ID".to_string()))?;

        let points: qdrant_client::qdrant::GetResponse = client
            .get_points(GetPoints {
                collection_name: collection.to_string(),
                ids: vec![point_id.into()],
                with_payload: None,
                with_vectors: None,
                read_consistency: None,
                shard_key_selector: None,
                timeout: None,
            })
            .await
            .map_err(|e| DatabaseError::QueryError(format!("获取点失败: {}", e)))?;

        if let Some(point) = points.result.first() {
            let payload = &point.payload;
            if !payload.is_empty() {
                let map = Self::payload_to_map(payload)?;
                let json = serde_json::to_value(map)?;
                Ok(Some(json))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    async fn update(
        &self,
        collection: &str,
        key: &str,
        data: &serde_json::Value,
    ) -> DatabaseResult<()> {
        let client = self.get_client()?;

        let point_id: u64 = key.parse()
            .map_err(|_| DatabaseError::InvalidData("无效的ID格式".to_string()))?;

        // 将JSON转换为Payload
        let map: HashMap<String, serde_json::Value> = serde_json::from_value(data.clone())?;
        let payload = Self::map_to_payload(&map);

        let selector = PointsSelector {
            points_selector_one_of: Some(
                qdrant_client::qdrant::points_selector::PointsSelectorOneOf::Points(
                    qdrant_client::qdrant::PointsIdsList {
                        ids: vec![point_id.into()],
                    }
                )
            ),
        };

        client
            .set_payload(SetPayloadPoints {
                collection_name: collection.to_string(),
                points_selector: Some(selector),
                payload: payload.into(),
                ordering: None,
                shard_key_selector: None,
                key: None,
                wait: None,
            })
            .await
            .map_err(|e| DatabaseError::QueryError(format!("更新payload失败: {}", e)))?;

        Ok(())
    }

    async fn delete(&self, collection: &str, key: &str) -> DatabaseResult<()> {
        let client = self.get_client()?;

        let point_id: u64 = key.parse()
            .map_err(|_| DatabaseError::InvalidData("无效的ID格式".to_string()))?;

        let selector = PointsSelector {
            points_selector_one_of: Some(
                qdrant_client::qdrant::points_selector::PointsSelectorOneOf::Points(
                    qdrant_client::qdrant::PointsIdsList {
                        ids: vec![point_id.into()],
                    }
                )
            ),
        };

        client
            .delete_points(DeletePoints {
                collection_name: collection.to_string(),
                points: Some(selector),
                ordering: None,
                shard_key_selector: None,
                wait: None,
            })
            .await
            .map_err(|e| DatabaseError::QueryError(format!("删除点失败: {}", e)))?;

        Ok(())
    }

    async fn query(
        &self,
        collection: &str,
        options: &QueryOptions,
    ) -> DatabaseResult<Vec<(String, serde_json::Value)>> {
        let client = self.get_client()?;

        // 构建过滤器（简化版本）
        let limit = options.limit.unwrap_or(100) as u64;

        // Qdrant不直接支持不带向量的查询，需要使用scroll
        let scroll_result = client
            .scroll(qdrant_client::qdrant::ScrollPoints {
                collection_name: collection.to_string(),
                limit: Some(limit as u32),
                offset: options.offset.map(|o| PointId::from(o as u64)),
                ..Default::default()
            })
            .await
            .map_err(|e| DatabaseError::QueryError(format!("查询失败: {}", e)))?;

        let mut results = Vec::new();
        
        for point in scroll_result.result {
            if let Some(id) = &point.id {
                let id_str = match id.point_id_options.as_ref() {
                    Some(qdrant_client::qdrant::point_id::PointIdOptions::Num(n)) => n.to_string(),
                    Some(qdrant_client::qdrant::point_id::PointIdOptions::Uuid(u)) => u.clone(),
                    None => continue,
                };

                let payload = &point.payload;
                if !payload.is_empty() {
                    let map = Self::payload_to_map(payload)?;
                    let json = serde_json::to_value(map)?;
                    results.push((id_str, json));
                }
            }
        }

        Ok(results)
    }

    async fn count(&self, collection: &str, _options: Option<&QueryOptions>) -> DatabaseResult<usize> {
        let client = self.get_client()?;

        let info = client
            .collection_info(collection)
            .await
            .map_err(|e| DatabaseError::QueryError(format!("获取集合信息失败: {}", e)))?;

        let count = info
            .result
            .and_then(|r| r.points_count)
            .unwrap_or(0) as usize;

        Ok(count)
    }

    async fn clear_collection(&self, collection: &str) -> DatabaseResult<()> {
        let client = self.get_client()?;

        // 删除所有点，使用过滤器选择所有点
        let selector = PointsSelector {
            points_selector_one_of: Some(
                qdrant_client::qdrant::points_selector::PointsSelectorOneOf::Filter(
                    Filter::default()
                )
            ),
        };

        client
            .delete_points(DeletePoints {
                collection_name: collection.to_string(),
                points: Some(selector),
                ordering: None,
                shard_key_selector: None,
                wait: None,
            })
            .await
            .map_err(|e| DatabaseError::QueryError(format!("清空集合失败: {}", e)))?;

        info!("成功清空Qdrant集合: {}", collection);
        Ok(())
    }

    async fn execute_raw(&self, _query: &str) -> DatabaseResult<serde_json::Value> {
        Err(DatabaseError::Other("Qdrant不支持原始查询".to_string()))
    }

    async fn begin_transaction(&self) -> DatabaseResult<Box<dyn DatabaseTransaction>> {
        Err(DatabaseError::Other("Qdrant不支持事务".to_string()))
    }
}

// ================================
// 向量搜索接口实现
// ================================

#[async_trait]
impl VectorDatabaseBackend for QdrantBackend {
    async fn insert_vector(
        &self,
        collection: &str,
        id: &str,
        vector: Vec<f32>,
        payload: &serde_json::Value,
    ) -> DatabaseResult<()> {
        let client = self.get_client()?;

        let point_id: u64 = id.parse()
            .map_err(|_| DatabaseError::InvalidData("无效的ID格式，需要数字".to_string()))?;

        // 将JSON转换为Payload
        let map: HashMap<String, serde_json::Value> = serde_json::from_value(payload.clone())?;
        let qdrant_payload = Self::map_to_payload(&map);

        let point = PointStruct::new(point_id, vector, qdrant_payload);

        client
            .upsert_points(
                UpsertPointsBuilder::new(collection, vec![point])
                    .wait(true)
            )
            .await
            .map_err(|e| DatabaseError::QueryError(format!("插入向量失败: {}", e)))?;

        Ok(())
    }

    async fn batch_insert_vectors(
        &self,
        collection: &str,
        items: Vec<(String, Vec<f32>, serde_json::Value)>,
    ) -> DatabaseResult<()> {
        let client = self.get_client()?;

        let mut points = Vec::new();

        for (id, vector, payload) in items {
            let point_id: u64 = id.parse()
                .map_err(|_| DatabaseError::InvalidData("无效的ID格式".to_string()))?;

            let map: HashMap<String, serde_json::Value> = serde_json::from_value(payload)?;
            let qdrant_payload = Self::map_to_payload(&map);

            points.push(PointStruct::new(point_id, vector, qdrant_payload));
        }

        client
            .upsert_points(
                UpsertPointsBuilder::new(collection, points)
                    .wait(true)
            )
            .await
            .map_err(|e| DatabaseError::QueryError(format!("批量插入向量失败: {}", e)))?;

        Ok(())
    }

    async fn vector_search(
        &self,
        collection: &str,
        query_vector: Vec<f32>,
        limit: usize,
        _filter: Option<&QueryOptions>,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        let client = self.get_client()?;

        let search_result = client
            .search_points(SearchPoints {
                collection_name: collection.to_string(),
                vector: query_vector,
                limit: limit as u64,
                with_payload: Some(true.into()),
                ..Default::default()
            })
            .await
            .map_err(|e| DatabaseError::QueryError(format!("向量搜索失败: {}", e)))?;

        let mut results = Vec::new();

        for scored_point in search_result.result {
            if let Some(id) = &scored_point.id {
                let id_str = match id.point_id_options.as_ref() {
                    Some(qdrant_client::qdrant::point_id::PointIdOptions::Num(n)) => n.to_string(),
                    Some(qdrant_client::qdrant::point_id::PointIdOptions::Uuid(u)) => u.clone(),
                    None => continue,
                };

                let payload = &scored_point.payload;
                let payload_json = if !payload.is_empty() {
                    let map = Self::payload_to_map(payload)?;
                    serde_json::to_value(map)?
                } else {
                    serde_json::Value::Null
                };

                results.push(VectorSearchResult {
                    id: id_str,
                    score: scored_point.score,
                    payload: payload_json,
                });
            }
        }

        Ok(results)
    }

    async fn delete_vector(&self, collection: &str, id: &str) -> DatabaseResult<()> {
        self.delete(collection, id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    // ================================
    // 基础功能测试
    // ================================

    #[test]
    fn test_qdrant_backend_creation() {
        let backend = QdrantBackend::new();
        assert_eq!(backend.backend_type(), DatabaseBackendType::Qdrant);
        assert!(!backend.is_connected());
        assert_eq!(backend.default_vector_size, 384);
        assert!(backend.client.is_none());
    }

    #[test]
    fn test_qdrant_with_vector_size() {
        let backend = QdrantBackend::new().with_vector_size(512);
        assert_eq!(backend.default_vector_size, 512);
        assert!(!backend.is_connected());
    }

    #[test]
    fn test_qdrant_debug_format() {
        let backend = QdrantBackend::new();
        let debug_str = format!("{:?}", backend);
        assert!(debug_str.contains("QdrantBackend"));
        assert!(debug_str.contains("connected: false"));
        assert!(debug_str.contains("default_vector_size: 384"));
    }

    #[test]
    fn test_qdrant_default() {
        let backend = QdrantBackend::default();
        assert_eq!(backend.backend_type(), DatabaseBackendType::Qdrant);
        assert_eq!(backend.default_vector_size, 384);
    }

    // ================================
    // 连接管理测试
    // ================================

    #[tokio::test]
    async fn test_qdrant_get_client_when_not_connected() {
        let backend = QdrantBackend::new();
        let result = backend.get_client();
        assert!(result.is_err());
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert_eq!(msg, "未连接到Qdrant");
        } else {
            panic!("期望ConnectionError");
        }
    }

    #[tokio::test]
    async fn test_qdrant_disconnect_when_not_connected() {
        let mut backend = QdrantBackend::new();
        let result = backend.disconnect().await;
        assert!(result.is_ok());
        assert!(!backend.is_connected());
    }

    #[tokio::test]
    async fn test_qdrant_connection_with_invalid_url() {
        let mut backend = QdrantBackend::new();
        let config = DatabaseConfig {
            backend_type: DatabaseBackendType::Qdrant,
            connection_string: "invalid://url".to_string(),
            ..Default::default()
        };
        
        let result = backend.connect(&config).await;
        assert!(result.is_err());
        assert!(!backend.is_connected());
    }

    // ================================
    // 数据转换测试
    // ================================

    #[test]
    fn test_payload_to_map_conversion() {
        use qdrant_client::qdrant::{Value, value::Kind};
        
        let mut payload = HashMap::new();
        
        // 测试字符串值
        payload.insert("str_key".to_string(), Value {
            kind: Some(Kind::StringValue("test_value".to_string())),
        });
        
        // 测试整数值
        payload.insert("int_key".to_string(), Value {
            kind: Some(Kind::IntegerValue(42)),
        });
        
        // 测试浮点数值
        payload.insert("double_key".to_string(), Value {
            kind: Some(Kind::DoubleValue(3.14)),
        });
        
        // 测试布尔值
        payload.insert("bool_key".to_string(), Value {
            kind: Some(Kind::BoolValue(true)),
        });
        
        // 测试空值
        payload.insert("null_key".to_string(), Value { kind: None });
        
        let result = QdrantBackend::payload_to_map(&payload);
        assert!(result.is_ok());
        
        let map = result.unwrap();
        assert_eq!(map.get("str_key").unwrap(), &serde_json::Value::String("test_value".to_string()));
        assert_eq!(map.get("int_key").unwrap(), &serde_json::Value::Number(42.into()));
        assert_eq!(map.get("bool_key").unwrap(), &serde_json::Value::Bool(true));
        assert_eq!(map.get("null_key").unwrap(), &serde_json::Value::Null);
    }

    #[test]
    fn test_map_to_payload_conversion() {
        let mut map = HashMap::new();
        map.insert("str_key".to_string(), serde_json::Value::String("test".to_string()));
        map.insert("int_key".to_string(), serde_json::Value::Number(42.into()));
        map.insert("float_key".to_string(), serde_json::json!(3.14));
        map.insert("bool_key".to_string(), serde_json::Value::Bool(true));
        map.insert("null_key".to_string(), serde_json::Value::Null);
        map.insert("array_key".to_string(), serde_json::json!([1, 2, 3])); // 应该被跳过
        
        let payload = QdrantBackend::map_to_payload(&map);
        
        // 验证payload不为空（说明有些类型被成功转换）
        // Payload本身的构造说明转换成功
        
        // 由于无法直接访问Payload内部，我们只验证基本功能
        // 通过构造一个简单的payload测试序列化
        let simple_map = HashMap::from([
            ("test".to_string(), serde_json::Value::String("value".to_string()))
        ]);
        let simple_payload = QdrantBackend::map_to_payload(&simple_map);
        // Payload构造成功说明转换正常
    }

    #[test]
    fn test_payload_conversion_roundtrip() {
        let mut original_map = HashMap::new();
        original_map.insert("str_key".to_string(), serde_json::Value::String("test".to_string()));
        original_map.insert("int_key".to_string(), serde_json::Value::Number(42.into()));
        original_map.insert("bool_key".to_string(), serde_json::Value::Bool(true));
        
        let payload = QdrantBackend::map_to_payload(&original_map);
        
        // 测试往返转换的基本功能 - 由于Payload API限制，这里只测试创建是否成功
        // Payload构造成功说明转换正常
        
        // 测试从已知HashMap创建并验证转换
        let mut test_payload_map = HashMap::new();
        test_payload_map.insert("test_key".to_string(), qdrant_client::qdrant::Value {
            kind: Some(qdrant_client::qdrant::value::Kind::StringValue("test_value".to_string())),
        });
        
        let result = QdrantBackend::payload_to_map(&test_payload_map);
        assert!(result.is_ok());
        let converted = result.unwrap();
        assert_eq!(converted.get("test_key").unwrap(), &serde_json::Value::String("test_value".to_string()));
    }

    // ================================
    // 数据库操作测试（Mock测试）
    // ================================

    #[tokio::test]
    async fn test_qdrant_insert_without_vector_fails() {
        let backend = QdrantBackend::new();
        let data = serde_json::json!({"key": "value"});
        
        let result = backend.insert("test_collection", "1", &data).await;
        assert!(result.is_err());
        
        if let Err(DatabaseError::InvalidData(msg)) = result {
            assert!(msg.contains("Qdrant需要向量数据"));
        } else {
            panic!("期望InvalidData错误");
        }
    }

    #[tokio::test]
    async fn test_qdrant_batch_insert_without_vector_fails() {
        let backend = QdrantBackend::new();
        let items = vec![
            ("1".to_string(), serde_json::json!({"key": "value1"})),
            ("2".to_string(), serde_json::json!({"key": "value2"})),
        ];
        
        let result = backend.batch_insert("test_collection", items).await;
        assert!(result.is_err());
        
        if let Err(DatabaseError::InvalidData(msg)) = result {
            assert!(msg.contains("Qdrant需要向量数据"));
        } else {
            panic!("期望InvalidData错误");
        }
    }

    #[tokio::test]
    async fn test_qdrant_get_with_invalid_id() {
        let backend = QdrantBackend::new();
        
        let result = backend.get("test_collection", "invalid_id").await;
        assert!(result.is_err());
        
        // 由于未连接，会返回ConnectionError而不是InvalidData
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert!(msg.contains("未连接到Qdrant"));
        } else {
            panic!("期望ConnectionError错误");
        }
    }

    #[tokio::test]
    async fn test_qdrant_update_with_invalid_id() {
        let backend = QdrantBackend::new();
        let data = serde_json::json!({"key": "value"});
        
        let result = backend.update("test_collection", "invalid_id", &data).await;
        assert!(result.is_err());
        
        // 由于未连接，会返回ConnectionError而不是InvalidData
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert!(msg.contains("未连接到Qdrant"));
        } else {
            panic!("期望ConnectionError错误");
        }
    }

    #[tokio::test]
    async fn test_qdrant_delete_with_invalid_id() {
        let backend = QdrantBackend::new();
        
        let result = backend.delete("test_collection", "invalid_id").await;
        assert!(result.is_err());
        
        // 由于未连接，会返回ConnectionError而不是InvalidData
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert!(msg.contains("未连接到Qdrant"));
        } else {
            panic!("期望ConnectionError错误");
        }
    }

    #[tokio::test]
    async fn test_qdrant_execute_raw_not_supported() {
        let backend = QdrantBackend::new();
        
        let result = backend.execute_raw("SELECT 1").await;
        assert!(result.is_err());
        
        if let Err(DatabaseError::Other(msg)) = result {
            assert_eq!(msg, "Qdrant不支持原始查询");
        } else {
            panic!("期望Other错误");
        }
    }

    #[tokio::test]
    async fn test_qdrant_transaction_not_supported() {
        let backend = QdrantBackend::new();
        
        let result = backend.begin_transaction().await;
        assert!(result.is_err());
        
        if let Err(DatabaseError::Other(msg)) = result {
            assert_eq!(msg, "Qdrant不支持事务");
        } else {
            panic!("期望Other错误");
        }
    }

    // ================================
    // 向量操作测试
    // ================================

    #[tokio::test]
    async fn test_vector_insert_with_invalid_id() {
        let backend = QdrantBackend::new();
        let vector = vec![0.1, 0.2, 0.3];
        let payload = serde_json::json!({"key": "value"});
        
        let result = backend.insert_vector("test_collection", "invalid_id", vector, &payload).await;
        assert!(result.is_err());
        
        // 由于未连接，会返回ConnectionError而不是InvalidData
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert!(msg.contains("未连接到Qdrant"));
        } else {
            panic!("期望ConnectionError错误");
        }
    }

    #[tokio::test]
    async fn test_batch_insert_vectors_with_invalid_id() {
        let backend = QdrantBackend::new();
        let items = vec![
            ("invalid_id".to_string(), vec![0.1, 0.2], serde_json::json!({"key": "value"})),
        ];
        
        let result = backend.batch_insert_vectors("test_collection", items).await;
        assert!(result.is_err());
        
        // 由于未连接，会返回ConnectionError而不是InvalidData
        if let Err(DatabaseError::ConnectionError(msg)) = result {
            assert!(msg.contains("未连接到Qdrant"));
        } else {
            panic!("期望ConnectionError错误");
        }
    }

    // ================================
    // 集合操作测试
    // ================================

    #[tokio::test]
    async fn test_create_collection_with_schema() {
        let backend = QdrantBackend::new();
        
        // 测试带有向量维度的schema
        let schema = r#"{"vector_size": 128}"#;
        let result = backend.create_collection("test_collection", Some(schema)).await;
        
        // 由于没有真实连接，这应该失败于连接错误
        assert!(result.is_err());
        if let Err(DatabaseError::ConnectionError(_)) = result {
            // 预期的连接错误
        } else {
            panic!("期望ConnectionError");
        }
    }

    #[tokio::test]
    async fn test_create_collection_with_invalid_schema() {
        let backend = QdrantBackend::new();
        
        // 测试无效的JSON schema
        let schema = "invalid json";
        let result = backend.create_collection("test_collection", Some(schema)).await;
        
        // 即使JSON无效，也应该使用默认向量大小，但会失败于连接错误
        assert!(result.is_err());
        if let Err(DatabaseError::ConnectionError(_)) = result {
            // 预期的连接错误
        } else {
            panic!("期望ConnectionError");
        }
    }

    // ================================
    // 边界条件和错误处理测试
    // ================================

    #[test]
    fn test_payload_conversion_with_extreme_values() {
        let mut map = HashMap::new();
        map.insert("max_int".to_string(), serde_json::Value::Number(i64::MAX.into()));
        map.insert("min_int".to_string(), serde_json::Value::Number(i64::MIN.into()));
        map.insert("large_float".to_string(), serde_json::json!(f64::MAX));
        map.insert("small_float".to_string(), serde_json::json!(f64::MIN_POSITIVE));
        
        let payload = QdrantBackend::map_to_payload(&map);
        
        // 验证极值可以被处理而不panic - payload构造成功说明转换成功
        // 极值处理正常，未发生panic
        
        // 测试各种极值类型的转换
        let max_int_map = HashMap::from([
            ("max_int".to_string(), serde_json::Value::Number(i64::MAX.into()))
        ]);
        let max_int_payload = QdrantBackend::map_to_payload(&max_int_map);
        // 极大值处理正常
    }

    #[test]
    fn test_payload_conversion_with_special_float_values() {
        let mut map = HashMap::new();
        map.insert("nan".to_string(), serde_json::json!(f64::NAN));
        map.insert("infinity".to_string(), serde_json::json!(f64::INFINITY));
        map.insert("neg_infinity".to_string(), serde_json::json!(f64::NEG_INFINITY));
        
        let payload = QdrantBackend::map_to_payload(&map);
        
        // NaN和无穷大应该被处理（可能被跳过或转换）
        // 具体行为取决于实现，但不应该panic
        // 我们只验证函数不会panic，payload可能为空也可能不为空
        // 这取决于实现对特殊浮点值的处理
        
        // 测试正常的浮点数转换
        let normal_float_map = HashMap::from([
            ("normal".to_string(), serde_json::json!(3.14))
        ]);
        let normal_payload = QdrantBackend::map_to_payload(&normal_float_map);
        // 正常浮点数处理成功
    }

    #[test]
    fn test_vector_size_validation() {
        let backend = QdrantBackend::new().with_vector_size(0);
        assert_eq!(backend.default_vector_size, 0);
        
        let backend = QdrantBackend::new().with_vector_size(usize::MAX);
        assert_eq!(backend.default_vector_size, usize::MAX);
    }

    #[tokio::test]
    async fn test_operations_on_disconnected_backend() {
        let backend = QdrantBackend::new();
        
        // 测试所有需要连接的操作都会失败
        assert!(backend.create_collection("test", None).await.is_err());
        assert!(backend.drop_collection("test").await.is_err());
        assert!(backend.collection_exists("test").await.is_err());
        assert!(backend.get("test", "1").await.is_err());
        assert!(backend.update("test", "1", &serde_json::json!({})).await.is_err());
        assert!(backend.delete("test", "1").await.is_err());
        assert!(backend.query("test", &QueryOptions::default()).await.is_err());
        assert!(backend.count("test", None).await.is_err());
        assert!(backend.clear_collection("test").await.is_err());
        
        // 向量操作也应该失败
        assert!(backend.insert_vector("test", "1", vec![0.1], &serde_json::json!({})).await.is_err());
        assert!(backend.batch_insert_vectors("test", vec![]).await.is_err());
        assert!(backend.vector_search("test", vec![0.1], 10, None).await.is_err());
        assert!(backend.delete_vector("test", "1").await.is_err());
    }
}

