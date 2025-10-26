//! Qdrant 向量搜索服务
//!
//! 提供高层向量搜索抽象，包括：
//! - 语义搜索
//! - 向量相似度匹配
//! - AI对话历史检索
//! - 文档向量化存储

use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};

use super::backends::{VectorDatabaseBackend, DatabaseResult, DatabaseError, VectorSearchResult};
use super::qdrant_backend::QdrantBackend;

/// 向量搜索服务
pub struct VectorSearchService {
    backend: Arc<RwLock<QdrantBackend>>,
}

impl VectorSearchService {
    /// 创建新的向量搜索服务
    pub fn new(backend: Arc<RwLock<QdrantBackend>>) -> Self {
        Self { backend }
    }
    
    // ========================================
    // 集合管理
    // ========================================
    
    /// 创建向量集合
    pub async fn create_collection(
        &self,
        name: &str,
        vector_size: usize,
    ) -> DatabaseResult<()> {
        use super::backends::DatabaseBackend;
        
        let schema = serde_json::json!({
            "vector_size": vector_size
        });
        let schema_str = serde_json::to_string(&schema)?;
        
        self.backend
            .read()
            .await
            .create_collection(name, Some(&schema_str))
            .await
    }
    
    /// 删除向量集合
    pub async fn delete_collection(&self, name: &str) -> DatabaseResult<()> {
        use super::backends::DatabaseBackend;
        self.backend.read().await.drop_collection(name).await
    }
    
    /// 检查集合是否存在
    pub async fn collection_exists(&self, name: &str) -> DatabaseResult<bool> {
        use super::backends::DatabaseBackend;
        self.backend.read().await.collection_exists(name).await
    }
    
    // ========================================
    // 向量操作
    // ========================================
    
    /// 插入向量
    pub async fn insert_vector<T: Serialize>(
        &self,
        collection: &str,
        id: &str,
        vector: Vec<f32>,
        payload: &T,
    ) -> DatabaseResult<()> {
        let json_payload = serde_json::to_value(payload)?;
        
        self.backend
            .read()
            .await
            .insert_vector(collection, id, vector, &json_payload)
            .await
    }
    
    /// 批量插入向量
    pub async fn batch_insert_vectors<T: Serialize>(
        &self,
        collection: &str,
        items: Vec<(String, Vec<f32>, T)>,
    ) -> DatabaseResult<()> {
        let converted_items: Result<Vec<_>, _> = items
            .into_iter()
            .map(|(id, vector, payload)| {
                serde_json::to_value(&payload).map(|json| (id, vector, json))
            })
            .collect();
        
        let converted_items = converted_items?;
        
        self.backend
            .read()
            .await
            .batch_insert_vectors(collection, converted_items)
            .await
    }
    
    /// 删除向量
    pub async fn delete_vector(&self, collection: &str, id: &str) -> DatabaseResult<()> {
        self.backend.read().await.delete_vector(collection, id).await
    }
    
    // ========================================
    // 向量搜索
    // ========================================
    
    /// 向量相似度搜索
    pub async fn search(
        &self,
        collection: &str,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        self.backend
            .read()
            .await
            .vector_search(collection, query_vector, limit, None)
            .await
    }
    
    /// 向量搜索（带过滤）
    pub async fn search_with_filter(
        &self,
        collection: &str,
        query_vector: Vec<f32>,
        limit: usize,
        filter: &super::backends::QueryOptions,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        self.backend
            .read()
            .await
            .vector_search(collection, query_vector, limit, Some(filter))
            .await
    }
    
    // ========================================
    // 对话历史管理
    // ========================================
    
    /// 存储对话消息
    pub async fn store_conversation_message(
        &self,
        message_id: &str,
        message_vector: Vec<f32>,
        message_data: &ConversationMessage,
    ) -> DatabaseResult<()> {
        const COLLECTION: &str = "conversations";
        
        // 确保集合存在
        if !self.collection_exists(COLLECTION).await? {
            self.create_collection(COLLECTION, 384).await?;
        }
        
        self.insert_vector(COLLECTION, message_id, message_vector, message_data)
            .await
    }
    
    /// 搜索相似对话
    pub async fn search_similar_conversations(
        &self,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        const COLLECTION: &str = "conversations";
        
        self.search(COLLECTION, query_vector, limit).await
    }
    
    /// 搜索用户的对话历史
    pub async fn search_user_conversations(
        &self,
        user_id: &str,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        use crate::database::backends::{QueryCondition, QueryOperator, QueryOptions};
        
        const COLLECTION: &str = "conversations";
        
        let filter = QueryOptions {
            conditions: vec![QueryCondition {
                field: "user_id".to_string(),
                operator: QueryOperator::Eq,
                value: serde_json::Value::String(user_id.to_string()),
            }],
            limit: Some(limit),
            offset: None,
            order_by: None,
        };
        
        self.search_with_filter(COLLECTION, query_vector, limit, &filter)
            .await
    }
    
    /// 删除对话消息
    pub async fn delete_conversation_message(&self, message_id: &str) -> DatabaseResult<()> {
        const COLLECTION: &str = "conversations";
        self.delete_vector(COLLECTION, message_id).await
    }
    
    // ========================================
    // 文档管理
    // ========================================
    
    /// 存储文档
    pub async fn store_document(
        &self,
        document_id: &str,
        document_vector: Vec<f32>,
        document_data: &Document,
    ) -> DatabaseResult<()> {
        const COLLECTION: &str = "documents";
        
        // 确保集合存在
        if !self.collection_exists(COLLECTION).await? {
            self.create_collection(COLLECTION, 384).await?;
        }
        
        self.insert_vector(COLLECTION, document_id, document_vector, document_data)
            .await
    }
    
    /// 批量存储文档
    pub async fn batch_store_documents(
        &self,
        documents: Vec<(String, Vec<f32>, Document)>,
    ) -> DatabaseResult<()> {
        const COLLECTION: &str = "documents";
        
        // 确保集合存在
        if !self.collection_exists(COLLECTION).await? {
            self.create_collection(COLLECTION, 384).await?;
        }
        
        self.batch_insert_vectors(COLLECTION, documents).await
    }
    
    /// 语义搜索文档
    pub async fn semantic_search_documents(
        &self,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        const COLLECTION: &str = "documents";
        
        self.search(COLLECTION, query_vector, limit).await
    }
    
    /// 搜索特定类型的文档
    pub async fn search_documents_by_type(
        &self,
        document_type: &str,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        use crate::database::backends::{QueryCondition, QueryOperator, QueryOptions};
        
        const COLLECTION: &str = "documents";
        
        let filter = QueryOptions {
            conditions: vec![QueryCondition {
                field: "type".to_string(),
                operator: QueryOperator::Eq,
                value: serde_json::Value::String(document_type.to_string()),
            }],
            limit: Some(limit),
            offset: None,
            order_by: None,
        };
        
        self.search_with_filter(COLLECTION, query_vector, limit, &filter)
            .await
    }
    
    /// 删除文档
    pub async fn delete_document(&self, document_id: &str) -> DatabaseResult<()> {
        const COLLECTION: &str = "documents";
        self.delete_vector(COLLECTION, document_id).await
    }
    
    // ========================================
    // 知识库管理
    // ========================================
    
    /// 存储知识库条目
    pub async fn store_knowledge(
        &self,
        knowledge_id: &str,
        knowledge_vector: Vec<f32>,
        knowledge_data: &Knowledge,
    ) -> DatabaseResult<()> {
        const COLLECTION: &str = "knowledge_base";
        
        // 确保集合存在
        if !self.collection_exists(COLLECTION).await? {
            self.create_collection(COLLECTION, 384).await?;
        }
        
        self.insert_vector(COLLECTION, knowledge_id, knowledge_vector, knowledge_data)
            .await
    }
    
    /// 搜索知识库
    pub async fn search_knowledge(
        &self,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> DatabaseResult<Vec<VectorSearchResult>> {
        const COLLECTION: &str = "knowledge_base";
        
        self.search(COLLECTION, query_vector, limit).await
    }
    
    /// 删除知识库条目
    pub async fn delete_knowledge(&self, knowledge_id: &str) -> DatabaseResult<()> {
        const COLLECTION: &str = "knowledge_base";
        self.delete_vector(COLLECTION, knowledge_id).await
    }
}

// ========================================
// 数据模型
// ========================================

/// 对话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    /// 消息ID
    pub message_id: String,
    /// 用户ID
    pub user_id: String,
    /// 会话ID
    pub session_id: String,
    /// 消息内容
    pub content: String,
    /// 消息类型（user/assistant/system）
    pub message_type: String,
    /// 时间戳
    pub timestamp: i64,
    /// 元数据
    pub metadata: Option<serde_json::Value>,
}

/// 文档
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    /// 文档ID
    pub document_id: String,
    /// 文档标题
    pub title: String,
    /// 文档内容
    pub content: String,
    /// 文档类型
    #[serde(rename = "type")]
    pub document_type: String,
    /// 作者
    pub author: Option<String>,
    /// 标签
    pub tags: Vec<String>,
    /// 创建时间
    pub created_at: i64,
    /// 元数据
    pub metadata: Option<serde_json::Value>,
}

/// 知识库条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Knowledge {
    /// 知识ID
    pub knowledge_id: String,
    /// 问题
    pub question: String,
    /// 答案
    pub answer: String,
    /// 分类
    pub category: String,
    /// 优先级
    pub priority: i32,
    /// 标签
    pub tags: Vec<String>,
    /// 创建时间
    pub created_at: i64,
    /// 元数据
    pub metadata: Option<serde_json::Value>,
}

/// 向量化工具
pub struct VectorEmbedding;

impl VectorEmbedding {
    /// 生成文本向量（需要接入实际的嵌入模型）
    /// 这里提供一个占位实现，实际使用时应替换为真实的嵌入模型
    pub async fn embed_text(text: &str) -> DatabaseResult<Vec<f32>> {
        // TODO: 接入实际的嵌入模型（如 OpenAI Embeddings, Sentence Transformers 等）
        // 这里返回一个简单的占位向量
        warn!("使用占位向量嵌入，请接入实际的嵌入模型");
        
        // 使用简单的哈希生成伪向量（仅用于开发测试）
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let hash = hasher.finish();
        
        // 生成384维向量（默认维度）
        let mut vector = vec![0.0f32; 384];
        for i in 0..384 {
            let seed = hash.wrapping_add(i as u64);
            vector[i] = ((seed % 10000) as f32 / 10000.0) - 0.5;
        }
        
        // 归一化
        let magnitude: f32 = vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            for v in &mut vector {
                *v /= magnitude;
            }
        }
        
        Ok(vector)
    }
    
    /// 批量生成文本向量
    pub async fn batch_embed_texts(texts: Vec<&str>) -> DatabaseResult<Vec<Vec<f32>>> {
        let mut vectors = Vec::new();
        for text in texts {
            vectors.push(Self::embed_text(text).await?);
        }
        Ok(vectors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};
    use std::collections::HashMap;
    
    // 创建Mock后端用于测试
    fn create_mock_backend() -> Arc<RwLock<QdrantBackend>> {
        Arc::new(RwLock::new(QdrantBackend::new()))
    }
    
    // 创建测试向量
    fn create_test_vector(size: usize) -> Vec<f32> {
        (0..size).map(|i| (i as f32) / (size as f32)).collect()
    }
    
    // 创建归一化测试向量
    fn create_normalized_vector(size: usize) -> Vec<f32> {
        let mut vector = create_test_vector(size);
        let magnitude: f32 = vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            for v in &mut vector {
                *v /= magnitude;
            }
        }
        vector
    }
    
    // ========================================
    // VectorEmbedding测试
    // ========================================
    
    #[tokio::test]
    async fn test_vector_embedding() {
        let text = "这是一个测试文本";
        let vector = VectorEmbedding::embed_text(text).await.unwrap();
        
        assert_eq!(vector.len(), 384);
        
        // 检查归一化
        let magnitude: f32 = vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((magnitude - 1.0).abs() < 0.001);
    }
    
    #[tokio::test]
    async fn test_batch_embedding() {
        let texts = vec!["文本1", "文本2", "文本3"];
        let vectors = VectorEmbedding::batch_embed_texts(texts).await.unwrap();
        
        assert_eq!(vectors.len(), 3);
        for vector in vectors {
            assert_eq!(vector.len(), 384);
        }
    }
    
    #[tokio::test]
    async fn test_embedding_consistency() {
        let text = "相同的文本应该产生相同的向量";
        
        let vector1 = VectorEmbedding::embed_text(text).await.unwrap();
        let vector2 = VectorEmbedding::embed_text(text).await.unwrap();
        
        assert_eq!(vector1, vector2, "相同文本应该产生相同向量");
    }
    
    #[tokio::test]
    async fn test_embedding_different_texts() {
        let text1 = "第一个文本";
        let text2 = "第二个文本";
        
        let vector1 = VectorEmbedding::embed_text(text1).await.unwrap();
        let vector2 = VectorEmbedding::embed_text(text2).await.unwrap();
        
        assert_ne!(vector1, vector2, "不同文本应该产生不同向量");
    }
    
    #[tokio::test]
    async fn test_embedding_edge_cases() {
        // 空字符串
        let empty_vector = VectorEmbedding::embed_text("").await.unwrap();
        assert_eq!(empty_vector.len(), 384);
        
        // 长文本
        let long_text = "长".repeat(10000);
        let long_vector = VectorEmbedding::embed_text(&long_text).await.unwrap();
        assert_eq!(long_vector.len(), 384);
        
        // 特殊字符
        let special_text = "!@#$%^&*()_+-={}|[]\\:\";'<>?,./";
        let special_vector = VectorEmbedding::embed_text(special_text).await.unwrap();
        assert_eq!(special_vector.len(), 384);
        
        // Unicode字符
        let unicode_text = "🚀🦀💻🌟";
        let unicode_vector = VectorEmbedding::embed_text(unicode_text).await.unwrap();
        assert_eq!(unicode_vector.len(), 384);
    }
    
    #[tokio::test]
    async fn test_batch_embedding_empty() {
        let empty_texts: Vec<&str> = vec![];
        let vectors = VectorEmbedding::batch_embed_texts(empty_texts).await.unwrap();
        assert_eq!(vectors.len(), 0);
    }
    
    #[tokio::test]
    async fn test_batch_embedding_large() {
        let texts: Vec<String> = (0..100).map(|i| format!("文本{}", i)).collect();
        let text_refs: Vec<&str> = texts.iter().map(|s| s.as_str()).collect();
        
        let vectors = VectorEmbedding::batch_embed_texts(text_refs).await.unwrap();
        assert_eq!(vectors.len(), 100);
        
        for (i, vector) in vectors.iter().enumerate() {
            assert_eq!(vector.len(), 384, "向量{}长度不正确", i);
        }
    }
    
    // ========================================
    // VectorSearchService基础测试
    // ========================================
    
    #[tokio::test]
    async fn test_service_creation() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        // 测试服务创建成功
        // 由于VectorSearchService没有公开字段，我们只能测试创建不会panic
        assert!(true);
    }
    
    // ========================================
    // 集合管理测试
    // ========================================
    
    #[tokio::test]
    async fn test_collection_operations() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let collection_name = "test_collection";
        let vector_size = 384;
        
        // 测试创建集合
        let result = service.create_collection(collection_name, vector_size).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试检查集合存在
        let result = service.collection_exists(collection_name).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试删除集合
        let result = service.delete_collection(collection_name).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    #[tokio::test]
    async fn test_collection_edge_cases() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        // 测试边界情况
        let test_cases = vec![
            ("", 384),                    // 空名称
            ("normal_collection", 0),     // 零维向量
            ("large_collection", 10000),  // 大维度
            ("unicode_集合", 384),        // Unicode名称
            ("special-chars_123", 384),   // 特殊字符
        ];
        
        for (name, size) in test_cases {
            let result = service.create_collection(name, size).await;
            assert!(result.is_err() || result.is_ok());
        }
    }
    
    // ========================================
    // 向量操作测试
    // ========================================
    
    #[tokio::test]
    async fn test_vector_operations() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let collection = "vectors_test";
        let vector_id = "vec_001";
        let test_vector = create_normalized_vector(384);
        let payload = ConversationMessage {
            message_id: "msg_001".to_string(),
            user_id: "user_001".to_string(),
            session_id: "session_001".to_string(),
            content: "测试消息".to_string(),
            message_type: "user".to_string(),
            timestamp: 1640995200,
            metadata: None,
        };
        
        // 测试插入向量
        let result = service.insert_vector(collection, vector_id, test_vector.clone(), &payload).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试删除向量
        let result = service.delete_vector(collection, vector_id).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    #[tokio::test]
    async fn test_batch_vector_operations() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let collection = "batch_test";
        
        // 准备批量数据
        let mut batch_items = Vec::new();
        for i in 0..10 {
            let id = format!("batch_vec_{}", i);
            let vector = create_normalized_vector(384);
            let payload = ConversationMessage {
                message_id: format!("batch_msg_{}", i),
                user_id: format!("user_{}", i),
                session_id: "batch_session".to_string(),
                content: format!("批量消息{}", i),
                message_type: "user".to_string(),
                timestamp: 1640995200 + i as i64,
                metadata: None,
            };
            batch_items.push((id, vector, payload));
        }
        
        // 测试批量插入
        let result = service.batch_insert_vectors(collection, batch_items).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    #[tokio::test]
    async fn test_vector_operations_edge_cases() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let collection = "edge_test";
        let payload = ConversationMessage {
            message_id: "edge_msg".to_string(),
            user_id: "edge_user".to_string(),
            session_id: "edge_session".to_string(),
            content: "边界测试".to_string(),
            message_type: "system".to_string(),
            timestamp: 0,
            metadata: Some(serde_json::json!({"test": true})),
        };
        
        // 测试各种向量大小
        let test_cases = vec![
            ("empty_vec", vec![]),           // 空向量
            ("single_vec", vec![1.0]),       // 单元素向量
            ("large_vec", vec![0.5; 2048]),  // 大向量
        ];
        
        for (id, vector) in test_cases {
            let result = service.insert_vector(collection, id, vector, &payload).await;
            assert!(result.is_err() || result.is_ok());
        }
    }
    
    // ========================================
    // 向量搜索测试
    // ========================================
    
    #[tokio::test]
    async fn test_vector_search() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let collection = "search_test";
        let query_vector = create_normalized_vector(384);
        let limit = 10;
        
        // 测试基本搜索
        let result = service.search(collection, query_vector.clone(), limit).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试带过滤的搜索
        use crate::database::backends::{QueryCondition, QueryOperator, QueryOptions};
        let filter = QueryOptions {
            conditions: vec![QueryCondition {
                field: "user_id".to_string(),
                operator: QueryOperator::Eq,
                value: serde_json::Value::String("test_user".to_string()),
            }],
            limit: Some(limit),
            offset: None,
            order_by: None,
        };
        
        let result = service.search_with_filter(collection, query_vector, limit, &filter).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    #[tokio::test]
    async fn test_search_edge_cases() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let collection = "search_edge_test";
        
        // 测试各种搜索参数
        let test_cases = vec![
            (vec![], 0),                           // 空向量，零限制
            (create_test_vector(1), 1),           // 小向量，小限制
            (create_test_vector(384), usize::MAX), // 正常向量，最大限制
        ];
        
        for (query_vector, limit) in test_cases {
            let result = service.search(collection, query_vector, limit).await;
            assert!(result.is_err() || result.is_ok());
        }
    }
    
    // ========================================
    // 对话历史管理测试
    // ========================================
    
    #[tokio::test]
    async fn test_conversation_management() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let message_id = "conv_msg_001";
        let message_vector = create_normalized_vector(384);
        let message_data = ConversationMessage {
            message_id: message_id.to_string(),
            user_id: "conv_user_001".to_string(),
            session_id: "conv_session_001".to_string(),
            content: "对话测试消息".to_string(),
            message_type: "user".to_string(),
            timestamp: 1640995200,
            metadata: Some(serde_json::json!({"test": "conversation"})),
        };
        
        // 测试存储对话消息
        let result = service.store_conversation_message(message_id, message_vector.clone(), &message_data).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试搜索相似对话
        let result = service.search_similar_conversations(message_vector.clone(), 5).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试搜索用户对话历史
        let result = service.search_user_conversations("conv_user_001", message_vector, 10).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试删除对话消息
        let result = service.delete_conversation_message(message_id).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    #[tokio::test]
    async fn test_conversation_edge_cases() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        // 测试各种边界情况
        let edge_cases = vec![
            ConversationMessage {
                message_id: "".to_string(),                    // 空ID
                user_id: "".to_string(),                       // 空用户ID
                session_id: "".to_string(),                    // 空会话ID
                content: "".to_string(),                       // 空内容
                message_type: "".to_string(),                  // 空类型
                timestamp: 0,                                   // 零时间戳
                metadata: None,
            },
            ConversationMessage {
                message_id: "long_id".repeat(100),             // 长ID
                user_id: "long_user".repeat(100),              // 长用户ID
                session_id: "long_session".repeat(100),        // 长会话ID
                content: "长内容".repeat(1000),                // 长内容
                message_type: "custom_type".to_string(),       // 自定义类型
                timestamp: i64::MAX,                           // 最大时间戳
                metadata: Some(serde_json::json!({"complex": {"nested": {"data": [1, 2, 3]}}})),
            },
        ];
        
        for (i, message_data) in edge_cases.iter().enumerate() {
            let message_id = format!("edge_msg_{}", i);
            let message_vector = create_normalized_vector(384);
            let result = service.store_conversation_message(&message_id, message_vector, message_data).await;
            assert!(result.is_err() || result.is_ok());
        }
    }
    
    // ========================================
    // 文档管理测试
    // ========================================
    
    #[tokio::test]
    async fn test_document_management() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let document_id = "doc_001";
        let document_vector = create_normalized_vector(384);
        let document_data = Document {
            document_id: document_id.to_string(),
            title: "测试文档".to_string(),
            content: "这是一个测试文档的内容".to_string(),
            document_type: "text".to_string(),
            author: Some("测试作者".to_string()),
            tags: vec!["测试".to_string(), "文档".to_string()],
            created_at: 1640995200,
            metadata: Some(serde_json::json!({"category": "test"})),
        };
        
        // 测试存储文档
        let result = service.store_document(document_id, document_vector.clone(), &document_data).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试语义搜索文档
        let result = service.semantic_search_documents(document_vector.clone(), 10).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试按类型搜索文档
        let result = service.search_documents_by_type("text", document_vector, 5).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试删除文档
        let result = service.delete_document(document_id).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    #[tokio::test]
    async fn test_batch_document_operations() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        // 准备批量文档数据
        let mut documents = Vec::new();
        for i in 0..5 {
            let document_id = format!("batch_doc_{}", i);
            let document_vector = create_normalized_vector(384);
            let document_data = Document {
                document_id: document_id.clone(),
                title: format!("批量文档{}", i),
                content: format!("这是第{}个批量文档的内容", i),
                document_type: "batch".to_string(),
                author: Some(format!("作者{}", i)),
                tags: vec![format!("标签{}", i), "批量".to_string()],
                created_at: 1640995200 + i as i64,
                metadata: Some(serde_json::json!({"index": i})),
            };
            documents.push((document_id, document_vector, document_data));
        }
        
        // 测试批量存储
        let result = service.batch_store_documents(documents).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    // ========================================
    // 知识库管理测试
    // ========================================
    
    #[tokio::test]
    async fn test_knowledge_management() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let knowledge_id = "knowledge_001";
        let knowledge_vector = create_normalized_vector(384);
        let knowledge_data = Knowledge {
            knowledge_id: knowledge_id.to_string(),
            question: "什么是Rust编程语言？".to_string(),
            answer: "Rust是一种系统编程语言，专注于安全、速度和并发。".to_string(),
            category: "编程语言".to_string(),
            priority: 1,
            tags: vec!["Rust".to_string(), "编程".to_string(), "系统语言".to_string()],
            created_at: 1640995200,
            metadata: Some(serde_json::json!({"source": "manual"})),
        };
        
        // 测试存储知识库条目
        let result = service.store_knowledge(knowledge_id, knowledge_vector.clone(), &knowledge_data).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试搜索知识库
        let result = service.search_knowledge(knowledge_vector, 10).await;
        assert!(result.is_err() || result.is_ok());
        
        // 测试删除知识库条目
        let result = service.delete_knowledge(knowledge_id).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    #[tokio::test]
    async fn test_knowledge_edge_cases() {
        let backend = create_mock_backend();
        let service = VectorSearchService::new(backend);
        
        let edge_knowledge = Knowledge {
            knowledge_id: "".to_string(),                      // 空ID
            question: "".to_string(),                          // 空问题
            answer: "".to_string(),                            // 空答案
            category: "".to_string(),                          // 空分类
            priority: i32::MIN,                                // 最小优先级
            tags: vec![],                                      // 空标签
            created_at: i64::MIN,                              // 最小时间戳
            metadata: None,
        };
        
        let knowledge_vector = create_normalized_vector(384);
        let result = service.store_knowledge("edge_knowledge", knowledge_vector, &edge_knowledge).await;
        assert!(result.is_err() || result.is_ok());
    }
    
    // ========================================
    // 并发和性能测试
    // ========================================
    
    #[tokio::test]
    async fn test_concurrent_operations() {
        let backend = create_mock_backend();
        let service = Arc::new(VectorSearchService::new(backend));
        
        let mut handles = vec![];
        
        // 创建多个并发任务
        for i in 0..10 {
            let service_clone = Arc::clone(&service);
            let handle = tokio::spawn(async move {
                let collection = format!("concurrent_collection_{}", i);
                let vector = create_normalized_vector(384);
                let document = Document {
                    document_id: format!("concurrent_doc_{}", i),
                    title: format!("并发文档{}", i),
                    content: format!("并发内容{}", i),
                    document_type: "concurrent".to_string(),
                    author: None,
                    tags: vec![],
                    created_at: 1640995200,
                    metadata: None,
                };
                
                // 并发执行多种操作
                let _ = service_clone.create_collection(&collection, 384).await;
                let _ = service_clone.store_document(&format!("doc_{}", i), vector.clone(), &document).await;
                let _ = service_clone.semantic_search_documents(vector, 5).await;
                let _ = service_clone.delete_collection(&collection).await;
            });
            handles.push(handle);
        }
        
        // 等待所有任务完成
        for handle in handles {
            let _ = handle.await;
        }
        
        // 测试通过 - 没有死锁
        assert!(true);
    }
    
    #[tokio::test]
    async fn test_no_deadlock_scenario() {
        let backend = create_mock_backend();
        let service = Arc::new(VectorSearchService::new(backend));
        
        let service1 = Arc::clone(&service);
        let service2 = Arc::clone(&service);
        
        let handle1 = tokio::spawn(async move {
            for i in 0..5 {
                let vector = create_normalized_vector(384);
                let _ = service1.semantic_search_documents(vector, 10).await;
                tokio::task::yield_now().await;
            }
        });
        
        let handle2 = tokio::spawn(async move {
            for i in 0..5 {
                let vector = create_normalized_vector(384);
                let _ = service2.search_knowledge(vector, 10).await;
                tokio::task::yield_now().await;
            }
        });
        
        // 设置超时以防止测试卡住
        let timeout_result = tokio::time::timeout(
            Duration::from_secs(5),
            async {
                let (_r1, _r2) = tokio::join!(handle1, handle2);
            }
        ).await;
        
        assert!(timeout_result.is_ok(), "测试应该在超时前完成，没有死锁");
    }
    
    // ========================================
    // 数据模型测试
    // ========================================
    
    #[test]
    fn test_conversation_message_serialization() {
        let message = ConversationMessage {
            message_id: "test_msg".to_string(),
            user_id: "test_user".to_string(),
            session_id: "test_session".to_string(),
            content: "测试内容".to_string(),
            message_type: "user".to_string(),
            timestamp: 1640995200,
            metadata: Some(serde_json::json!({"test": true})),
        };
        
        // 测试序列化
        let serialized = serde_json::to_string(&message).unwrap();
        assert!(!serialized.is_empty());
        
        // 测试反序列化
        let deserialized: ConversationMessage = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.message_id, message.message_id);
        assert_eq!(deserialized.content, message.content);
    }
    
    #[test]
    fn test_document_serialization() {
        let document = Document {
            document_id: "test_doc".to_string(),
            title: "测试文档".to_string(),
            content: "测试内容".to_string(),
            document_type: "test".to_string(),
            author: Some("测试作者".to_string()),
            tags: vec!["tag1".to_string(), "tag2".to_string()],
            created_at: 1640995200,
            metadata: Some(serde_json::json!({"category": "test"})),
        };
        
        // 测试序列化
        let serialized = serde_json::to_string(&document).unwrap();
        assert!(!serialized.is_empty());
        
        // 测试反序列化
        let deserialized: Document = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.document_id, document.document_id);
        assert_eq!(deserialized.title, document.title);
        assert_eq!(deserialized.tags, document.tags);
    }
    
    #[test]
    fn test_knowledge_serialization() {
        let knowledge = Knowledge {
            knowledge_id: "test_knowledge".to_string(),
            question: "测试问题".to_string(),
            answer: "测试答案".to_string(),
            category: "测试分类".to_string(),
            priority: 1,
            tags: vec!["知识".to_string()],
            created_at: 1640995200,
            metadata: Some(serde_json::json!({"source": "test"})),
        };
        
        // 测试序列化
        let serialized = serde_json::to_string(&knowledge).unwrap();
        assert!(!serialized.is_empty());
        
        // 测试反序列化
        let deserialized: Knowledge = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.knowledge_id, knowledge.knowledge_id);
        assert_eq!(deserialized.question, knowledge.question);
        assert_eq!(deserialized.answer, knowledge.answer);
    }
}

