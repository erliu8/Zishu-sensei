//! 测试数据库工具
//!
//! 提供测试数据库的创建、初始化和管理功能

use zishu_sensei_desktop::database::{
    backends::*,
    postgres_backend::PostgresBackend,
    redis_backend::RedisBackend,
};
use tempfile::TempDir;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;
use serde_json::json;

// ================================
// 测试数据库结构
// ================================

/// PostgreSQL测试数据库
/// 
/// 自动管理测试数据库的创建和清理
pub struct TestPostgresDatabase {
    /// 数据库后端
    pub backend: PostgresBackend,
    /// 数据库名称
    pub database_name: String,
    /// 是否已连接
    connected: bool,
}

impl TestPostgresDatabase {
    /// 创建新的测试数据库
    /// 
    /// # 示例
    /// ```
    /// let db = TestPostgresDatabase::new("test_db");
    /// ```
    pub fn new(db_name: &str) -> Self {
        Self {
            backend: PostgresBackend::new(),
            database_name: db_name.to_string(),
            connected: false,
        }
    }
    
    /// 连接到测试数据库
    pub async fn connect(&mut self) -> Result<(), String> {
        let config = DatabaseConfig::postgresql(&format!(
            "postgresql://postgres:password@localhost:5432/{}",
            self.database_name
        ));
        
        self.backend.connect(&config).await?;
        self.connected = true;
        Ok(())
    }
    
    /// 断开连接
    pub async fn disconnect(&mut self) -> Result<(), String> {
        if self.connected {
            self.backend.disconnect().await?;
            self.connected = false;
        }
        Ok(())
    }
    
    // ================================
    // Schema 初始化方法
    // ================================
    
    /// 初始化完整的数据库表结构
    pub async fn init_full_schema(&mut self) -> Result<(), String> {
        self.init_adapter_tables().await?;
        self.init_character_tables().await?;
        self.init_chat_tables().await?;
        self.init_settings_tables().await?;
        self.init_workflow_tables().await?;
        self.init_permission_tables().await?;
        self.init_file_tables().await?;
        self.init_log_tables().await?;
        Ok(())
    }
    
    /// 初始化适配器相关表
    pub async fn init_adapter_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS installed_adapters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                version TEXT NOT NULL,
                install_path TEXT NOT NULL,
                status TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT true,
                auto_update BOOLEAN NOT NULL DEFAULT true,
                source TEXT NOT NULL,
                source_id TEXT,
                description TEXT,
                author TEXT,
                license TEXT,
                homepage_url TEXT,
                installed_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                last_used_at BIGINT,
                config JSONB NOT NULL DEFAULT '{}',
                metadata JSONB NOT NULL DEFAULT '{}'
            );
            
            CREATE TABLE IF NOT EXISTS adapter_versions (
                id SERIAL PRIMARY KEY,
                adapter_id TEXT NOT NULL REFERENCES installed_adapters(id) ON DELETE CASCADE,
                version TEXT NOT NULL,
                released_at BIGINT NOT NULL,
                changelog TEXT,
                download_url TEXT,
                file_size BIGINT,
                checksum TEXT,
                is_current BOOLEAN NOT NULL DEFAULT false,
                UNIQUE(adapter_id, version)
            );
            
            CREATE TABLE IF NOT EXISTS adapter_dependencies (
                id SERIAL PRIMARY KEY,
                adapter_id TEXT NOT NULL REFERENCES installed_adapters(id) ON DELETE CASCADE,
                dependency_id TEXT NOT NULL,
                version_requirement TEXT NOT NULL,
                required BOOLEAN NOT NULL DEFAULT true,
                UNIQUE(adapter_id, dependency_id)
            );
            
            CREATE TABLE IF NOT EXISTS adapter_permissions (
                id SERIAL PRIMARY KEY,
                adapter_id TEXT NOT NULL REFERENCES installed_adapters(id) ON DELETE CASCADE,
                permission_type TEXT NOT NULL,
                granted BOOLEAN NOT NULL DEFAULT false,
                granted_at BIGINT,
                description TEXT,
                UNIQUE(adapter_id, permission_type)
            );
            
            CREATE INDEX IF NOT EXISTS idx_installed_adapters_status ON installed_adapters(status);
            CREATE INDEX IF NOT EXISTS idx_installed_adapters_enabled ON installed_adapters(enabled);
            CREATE INDEX IF NOT EXISTS idx_adapter_versions_adapter ON adapter_versions(adapter_id);
            CREATE INDEX IF NOT EXISTS idx_adapter_dependencies_adapter ON adapter_dependencies(adapter_id);
            CREATE INDEX IF NOT EXISTS idx_adapter_permissions_adapter ON adapter_permissions(adapter_id);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    /// 初始化角色相关表
    pub async fn init_character_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                path TEXT NOT NULL,
                preview_image TEXT,
                description TEXT NOT NULL,
                gender TEXT NOT NULL,
                size TEXT NOT NULL,
                features JSONB NOT NULL DEFAULT '[]',
                is_active BOOLEAN NOT NULL DEFAULT false,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS character_motions (
                id SERIAL PRIMARY KEY,
                character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                motion_name TEXT NOT NULL,
                motion_group TEXT NOT NULL DEFAULT 'default',
                UNIQUE(character_id, motion_name)
            );
            
            CREATE TABLE IF NOT EXISTS character_expressions (
                id SERIAL PRIMARY KEY,
                character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                expression_name TEXT NOT NULL,
                UNIQUE(character_id, expression_name)
            );
            
            CREATE TABLE IF NOT EXISTS character_configs (
                character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
                scale REAL NOT NULL DEFAULT 1.0,
                position_x REAL NOT NULL DEFAULT 0.0,
                position_y REAL NOT NULL DEFAULT 0.0,
                interaction_enabled BOOLEAN NOT NULL DEFAULT true,
                config_json JSONB,
                updated_at BIGINT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_characters_active ON characters(is_active);
            CREATE INDEX IF NOT EXISTS idx_character_motions_character ON character_motions(character_id);
            CREATE INDEX IF NOT EXISTS idx_character_expressions_character ON character_expressions(character_id);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    /// 初始化聊天相关表
    pub async fn init_chat_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                character_id TEXT,
                adapter_id TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{}'
            );
            
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp BIGINT NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{}'
            );
            
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    /// 初始化设置相关表
    pub async fn init_settings_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                type TEXT NOT NULL,
                updated_at BIGINT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS theme_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config JSONB NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT false,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_theme_configs_active ON theme_configs(is_active);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    /// 初始化工作流相关表
    pub async fn init_workflow_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                version TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT true,
                definition JSONB NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                input JSONB,
                output JSONB,
                error TEXT,
                started_at BIGINT NOT NULL,
                completed_at BIGINT
            );
            
            CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
            CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    /// 初始化权限相关表
    pub async fn init_permission_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                resource TEXT NOT NULL,
                action TEXT NOT NULL,
                granted BOOLEAN NOT NULL DEFAULT false,
                granted_at BIGINT,
                description TEXT,
                UNIQUE(resource, action)
            );
            
            CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
            CREATE INDEX IF NOT EXISTS idx_permissions_granted ON permissions(granted);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    /// 初始化文件相关表
    pub async fn init_file_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS file_metadata (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                size BIGINT NOT NULL,
                mime_type TEXT,
                checksum TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS file_access_log (
                id SERIAL PRIMARY KEY,
                file_id TEXT NOT NULL REFERENCES file_metadata(id) ON DELETE CASCADE,
                operation TEXT NOT NULL,
                accessed_at BIGINT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_file_metadata_path ON file_metadata(path);
            CREATE INDEX IF NOT EXISTS idx_file_access_log_file ON file_access_log(file_id);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    /// 初始化日志相关表
    pub async fn init_log_tables(&mut self) -> Result<(), String> {
        let schema = r#"
            CREATE TABLE IF NOT EXISTS app_logs (
                id SERIAL PRIMARY KEY,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                module TEXT,
                file TEXT,
                line INTEGER,
                timestamp BIGINT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS error_logs (
                id SERIAL PRIMARY KEY,
                error_type TEXT NOT NULL,
                error_code TEXT,
                message TEXT NOT NULL,
                stack_trace TEXT,
                context JSONB,
                timestamp BIGINT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
            CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
            CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
        "#;
        
        self.backend.execute(&schema).await
    }
    
    // ================================
    // 数据清理方法
    // ================================
    
    /// 清空所有数据（保留表结构）
    pub async fn clear_all_data(&mut self) -> Result<(), String> {
        let sql = r#"
            TRUNCATE TABLE adapter_permissions, adapter_dependencies, adapter_versions, installed_adapters CASCADE;
            TRUNCATE TABLE character_configs, character_expressions, character_motions, characters CASCADE;
            TRUNCATE TABLE chat_messages, chat_sessions CASCADE;
            TRUNCATE TABLE app_settings, theme_configs CASCADE;
            TRUNCATE TABLE workflow_executions, workflows CASCADE;
            TRUNCATE TABLE permissions CASCADE;
            TRUNCATE TABLE file_access_log, file_metadata CASCADE;
            TRUNCATE TABLE app_logs, error_logs CASCADE;
        "#;
        
        self.backend.execute(&sql).await
    }
    
    /// 清空适配器数据
    pub async fn clear_adapter_data(&mut self) -> Result<(), String> {
        let sql = "TRUNCATE TABLE adapter_permissions, adapter_dependencies, adapter_versions, installed_adapters CASCADE;";
        self.backend.execute(&sql).await
    }
    
    /// 清空角色数据
    pub async fn clear_character_data(&mut self) -> Result<(), String> {
        let sql = "TRUNCATE TABLE character_configs, character_expressions, character_motions, characters CASCADE;";
        self.backend.execute(&sql).await
    }
    
    /// 清空聊天数据
    pub async fn clear_chat_data(&mut self) -> Result<(), String> {
        let sql = "TRUNCATE TABLE chat_messages, chat_sessions CASCADE;";
        self.backend.execute(&sql).await
    }
    
    // ================================
    // 测试数据插入方法
    // ================================
    
    /// 插入测试适配器
    pub async fn insert_test_adapter(&mut self, id: &str, name: &str, enabled: bool) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        let data = json!({
            "id": id,
            "name": name,
            "display_name": format!("Display {}", name),
            "version": "1.0.0",
            "install_path": format!("/test/adapters/{}", id),
            "status": "installed",
            "enabled": enabled,
            "auto_update": true,
            "source": "test",
            "installed_at": now,
            "updated_at": now,
            "config": {},
            "metadata": {}
        });
        
        self.backend.insert("installed_adapters", id, &data).await
    }
    
    /// 插入测试角色
    pub async fn insert_test_character(&mut self, id: &str, name: &str, is_active: bool) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        let data = json!({
            "id": id,
            "name": name,
            "display_name": format!("Display {}", name),
            "path": format!("/test/characters/{}", id),
            "description": format!("Test character {}", name),
            "gender": "female",
            "size": "medium",
            "features": [],
            "is_active": is_active,
            "created_at": now,
            "updated_at": now
        });
        
        self.backend.insert("characters", id, &data).await
    }
    
    /// 插入测试聊天会话
    pub async fn insert_test_chat_session(&mut self, id: &str, title: &str) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        let data = json!({
            "id": id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "metadata": {}
        });
        
        self.backend.insert("chat_sessions", id, &data).await
    }
    
    /// 插入测试聊天消息
    pub async fn insert_test_chat_message(
        &mut self,
        id: &str,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        let data = json!({
            "id": id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "timestamp": now,
            "metadata": {}
        });
        
        self.backend.insert("chat_messages", id, &data).await
    }
    
    /// 插入测试工作流
    pub async fn insert_test_workflow(&mut self, id: &str, name: &str, enabled: bool) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        let data = json!({
            "id": id,
            "name": name,
            "version": "1.0.0",
            "enabled": enabled,
            "definition": {},
            "created_at": now,
            "updated_at": now
        });
        
        self.backend.insert("workflows", id, &data).await
    }
    
    // ================================
    // 查询辅助方法
    // ================================
    
    /// 计算集合中的记录数
    pub async fn count_records(&mut self, collection: &str) -> Result<i64, String> {
        let keys = self.backend.list_keys(collection).await?;
        Ok(keys.len() as i64)
    }
    
    /// 检查记录是否存在
    pub async fn record_exists(&mut self, collection: &str, id: &str) -> Result<bool, String> {
        let result = self.backend.get(collection, id).await?;
        Ok(result.is_some())
    }
    
    /// 获取后端引用
    pub fn get_backend(&mut self) -> &mut PostgresBackend {
        &mut self.backend
    }
}

/// Redis测试数据库
pub struct TestRedisDatabase {
    /// Redis后端
    pub backend: RedisBackend,
    /// 键前缀
    pub prefix: String,
    /// 是否已连接
    connected: bool,
}

impl TestRedisDatabase {
    /// 创建新的测试Redis数据库
    pub fn new(prefix: &str) -> Self {
        Self {
            backend: RedisBackend::new().with_prefix(prefix),
            prefix: prefix.to_string(),
            connected: false,
        }
    }
    
    /// 连接到Redis
    pub async fn connect(&mut self) -> Result<(), String> {
        let config = DatabaseConfig::redis("redis://127.0.0.1:6379");
        self.backend.connect(&config).await?;
        self.connected = true;
        Ok(())
    }
    
    /// 断开连接
    pub async fn disconnect(&mut self) -> Result<(), String> {
        if self.connected {
            self.backend.disconnect().await?;
            self.connected = false;
        }
        Ok(())
    }
    
    /// 清空所有测试数据
    pub async fn clear_all_data(&mut self) -> Result<(), String> {
        // Redis使用前缀，可以删除所有带前缀的键
        let collections = vec![
            "adapters", "characters", "sessions", "messages",
            "workflows", "permissions", "files", "logs"
        ];
        
        for collection in collections {
            self.backend.drop_collection(collection).await?;
        }
        
        Ok(())
    }
    
    /// 获取后端引用
    pub fn get_backend(&mut self) -> &mut RedisBackend {
        &mut self.backend
    }
}

// ================================
// 便捷设置函数
// ================================

/// 设置PostgreSQL测试数据库
/// 
/// 返回一个已连接并初始化了完整schema的测试数据库
pub async fn setup_test_postgres() -> TestPostgresDatabase {
    let mut db = TestPostgresDatabase::new("test_db");
    db.connect().await.expect("无法连接到PostgreSQL测试数据库");
    db.init_full_schema().await.expect("无法初始化数据库schema");
    db
}

/// 设置PostgreSQL测试数据库（仅指定表）
pub async fn setup_test_postgres_with_tables(tables: &[&str]) -> TestPostgresDatabase {
    let mut db = TestPostgresDatabase::new("test_db");
    db.connect().await.expect("无法连接到PostgreSQL测试数据库");
    
    for table in tables {
        match *table {
            "adapters" => db.init_adapter_tables().await.expect("无法初始化adapter表"),
            "characters" => db.init_character_tables().await.expect("无法初始化character表"),
            "chats" => db.init_chat_tables().await.expect("无法初始化chat表"),
            "settings" => db.init_settings_tables().await.expect("无法初始化settings表"),
            "workflows" => db.init_workflow_tables().await.expect("无法初始化workflow表"),
            "permissions" => db.init_permission_tables().await.expect("无法初始化permission表"),
            "files" => db.init_file_tables().await.expect("无法初始化file表"),
            "logs" => db.init_log_tables().await.expect("无法初始化log表"),
            _ => panic!("未知的表类型: {}", table),
        }
    }
    
    db
}

/// 设置Redis测试数据库
/// 
/// 返回一个已连接的测试Redis数据库
pub async fn setup_test_redis() -> TestRedisDatabase {
    let mut db = TestRedisDatabase::new("test:");
    db.connect().await.expect("无法连接到Redis测试数据库");
    db.clear_all_data().await.ok(); // 清理之前的测试数据
    db
}

/// 设置Redis测试数据库（指定前缀）
pub async fn setup_test_redis_with_prefix(prefix: &str) -> TestRedisDatabase {
    let mut db = TestRedisDatabase::new(prefix);
    db.connect().await.expect("无法连接到Redis测试数据库");
    db.clear_all_data().await.ok(); // 清理之前的测试数据
    db
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要PostgreSQL服务器
    async fn test_postgres_test_database() {
        let mut db = TestPostgresDatabase::new("test_db");
        assert!(db.connect().await.is_ok());
        assert!(db.init_full_schema().await.is_ok());
        assert!(db.disconnect().await.is_ok());
    }

    #[tokio::test]
    #[ignore] // 需要Redis服务器
    async fn test_redis_test_database() {
        let mut db = TestRedisDatabase::new("test:");
        assert!(db.connect().await.is_ok());
        assert!(db.disconnect().await.is_ok());
    }
    
    #[tokio::test]
    #[ignore] // 需要PostgreSQL服务器
    async fn test_setup_test_postgres() {
        let db = setup_test_postgres().await;
        assert!(db.connected);
    }
    
    #[tokio::test]
    #[ignore] // 需要Redis服务器
    async fn test_setup_test_redis() {
        let db = setup_test_redis().await;
        assert!(db.connected);
    }
}
