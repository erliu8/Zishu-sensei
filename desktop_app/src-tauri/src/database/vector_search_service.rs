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
        use super::backends::{QueryCondition, QueryOperator, QueryOptions};
        
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
        use super::backends::{QueryCondition, QueryOperator, QueryOptions};
        
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
}

