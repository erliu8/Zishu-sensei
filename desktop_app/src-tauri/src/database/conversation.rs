//! 对话历史管理模块
//!
//! 提供对话会话和消息的持久化存储功能

use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};

/// 消息角色
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// 消息数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: MessageRole,
    pub content: String,
    pub created_at: i64,
}

/// 对话会话数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 对话历史管理器
pub struct ConversationHistory {
    pool: Pool,
}

impl ConversationHistory {
    /// 创建新的对话历史管理器
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    /// 初始化数据库表
    pub async fn init_tables(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;

        // 创建对话表
        client
            .execute(
                "CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at BIGINT NOT NULL,
                    updated_at BIGINT NOT NULL
                )",
                &[],
            )
            .await?;

        // 创建消息表
        client
            .execute(
                "CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at BIGINT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                )",
                &[],
            )
            .await?;

        Ok(())
    }

    /// 创建新对话
    pub async fn create_conversation(
        &self,
        conversation: Conversation,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        client
            .execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES ($1, $2, $3, $4)",
                &[&conversation.id, &conversation.title, &conversation.created_at, &conversation.updated_at],
            )
            .await?;
        Ok(())
    }

    /// 获取对话
    pub async fn get_conversation(
        &self,
        id: &str,
    ) -> Result<Option<Conversation>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt("SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1", &[&id])
            .await?;

        Ok(row.map(|r| Conversation {
            id: r.get(0),
            title: r.get(1),
            created_at: r.get(2),
            updated_at: r.get(3),
        }))
    }

    /// 添加消息
    pub async fn add_message(
        &self,
        message: Message,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let role_str = match message.role {
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
        };
        client
            .execute(
                "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)",
                &[&message.id, &message.conversation_id, &role_str, &message.content, &message.created_at],
            )
            .await?;
        Ok(())
    }

    /// 获取对话的所有消息
    pub async fn get_messages(
        &self,
        conversation_id: &str,
    ) -> Result<Vec<Message>, Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        let rows = client
            .query(
                "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at",
                &[&conversation_id],
            )
            .await?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let role_str: String = r.get(2);
                let role = match role_str.as_str() {
                    "user" => MessageRole::User,
                    "assistant" => MessageRole::Assistant,
                    _ => MessageRole::System,
                };
                Message {
                    id: r.get(0),
                    conversation_id: r.get(1),
                    role,
                    content: r.get(3),
                    created_at: r.get(4),
                }
            })
            .collect())
    }

    /// 删除对话
    pub async fn delete_conversation(
        &self,
        id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get().await?;
        client
            .execute("DELETE FROM conversations WHERE id = $1", &[&id])
            .await?;
        Ok(())
    }
}

