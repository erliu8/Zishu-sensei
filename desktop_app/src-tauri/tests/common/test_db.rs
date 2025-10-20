//! 测试数据库工具
//!
//! 提供测试数据库的创建、初始化和管理功能

use rusqlite::{Connection, Result as SqliteResult, params};
use tempfile::TempDir;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;

// ================================
// 测试数据库结构
// ================================

/// 测试数据库
/// 
/// 自动管理临时数据库文件的创建和清理
pub struct TestDatabase {
    /// 数据库连接
    pub connection: Connection,
    /// 临时目录（用于自动清理）
    _temp_dir: TempDir,
    /// 数据库文件路径
    pub path: PathBuf,
}

impl TestDatabase {
    /// 创建新的测试数据库（内存模式）
    /// 
    /// # 示例
    /// ```
    /// let db = TestDatabase::new_in_memory();
    /// ```
    pub fn new_in_memory() -> Self {
        let connection = Connection::open_in_memory()
            .expect("Failed to create in-memory database");
        
        let temp_dir = TempDir::new()
            .expect("Failed to create temp dir");
        
        Self {
            connection,
            _temp_dir: temp_dir,
            path: PathBuf::from(":memory:"),
        }
    }
    
    /// 创建新的测试数据库（文件模式）
    /// 
    /// # 示例
    /// ```
    /// let db = TestDatabase::new();
    /// ```
    pub fn new() -> Self {
        let temp_dir = TempDir::new()
            .expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");
        
        let connection = Connection::open(&db_path)
            .expect("Failed to open test database");
        
        Self {
            connection,
            _temp_dir: temp_dir,
            path: db_path,
        }
    }
    
    /// 创建带指定名称的测试数据库
    pub fn new_with_name(name: &str) -> Self {
        let temp_dir = TempDir::new()
            .expect("Failed to create temp dir");
        let db_path = temp_dir.path().join(format!("{}.db", name));
        
        let connection = Connection::open(&db_path)
            .expect("Failed to open test database");
        
        Self {
            connection,
            _temp_dir: temp_dir,
            path: db_path,
        }
    }
    
    /// 创建共享的测试数据库（Arc<RwLock<Connection>>）
    pub fn new_shared() -> Arc<RwLock<Connection>> {
        let db = Self::new_in_memory();
        Arc::new(RwLock::new(db.connection))
    }
    
    // ================================
    // Schema 初始化方法
    // ================================
    
    /// 初始化完整的数据库表结构
    pub fn init_full_schema(&self) -> SqliteResult<()> {
        self.init_adapter_tables()?;
        self.init_character_tables()?;
        self.init_chat_tables()?;
        self.init_settings_tables()?;
        self.init_workflow_tables()?;
        self.init_permission_tables()?;
        self.init_file_tables()?;
        self.init_log_tables()?;
        Ok(())
    }
    
    /// 初始化适配器相关表
    pub fn init_adapter_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 已安装适配器表
            CREATE TABLE IF NOT EXISTS installed_adapters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                version TEXT NOT NULL,
                install_path TEXT NOT NULL,
                status TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                auto_update INTEGER NOT NULL DEFAULT 1,
                source TEXT NOT NULL,
                source_id TEXT,
                description TEXT,
                author TEXT,
                license TEXT,
                homepage_url TEXT,
                installed_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_used_at INTEGER,
                config TEXT NOT NULL DEFAULT '{}',
                metadata TEXT NOT NULL DEFAULT '{}',
                UNIQUE(id)
            );
            
            -- 适配器版本表
            CREATE TABLE IF NOT EXISTS adapter_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                adapter_id TEXT NOT NULL,
                version TEXT NOT NULL,
                released_at INTEGER NOT NULL,
                changelog TEXT,
                download_url TEXT,
                file_size INTEGER,
                checksum TEXT,
                is_current INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (adapter_id) REFERENCES installed_adapters(id) ON DELETE CASCADE,
                UNIQUE(adapter_id, version)
            );
            
            -- 适配器依赖表
            CREATE TABLE IF NOT EXISTS adapter_dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                adapter_id TEXT NOT NULL,
                dependency_id TEXT NOT NULL,
                version_requirement TEXT NOT NULL,
                required INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (adapter_id) REFERENCES installed_adapters(id) ON DELETE CASCADE,
                UNIQUE(adapter_id, dependency_id)
            );
            
            -- 适配器权限表
            CREATE TABLE IF NOT EXISTS adapter_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                adapter_id TEXT NOT NULL,
                permission_type TEXT NOT NULL,
                granted INTEGER NOT NULL DEFAULT 0,
                granted_at INTEGER,
                description TEXT,
                FOREIGN KEY (adapter_id) REFERENCES installed_adapters(id) ON DELETE CASCADE,
                UNIQUE(adapter_id, permission_type)
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_installed_adapters_status ON installed_adapters(status);
            CREATE INDEX IF NOT EXISTS idx_installed_adapters_enabled ON installed_adapters(enabled);
            CREATE INDEX IF NOT EXISTS idx_adapter_versions_adapter ON adapter_versions(adapter_id);
            CREATE INDEX IF NOT EXISTS idx_adapter_dependencies_adapter ON adapter_dependencies(adapter_id);
            CREATE INDEX IF NOT EXISTS idx_adapter_permissions_adapter ON adapter_permissions(adapter_id);
            "
        )?;
        Ok(())
    }
    
    /// 初始化角色相关表
    pub fn init_character_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 角色表
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                path TEXT NOT NULL,
                preview_image TEXT,
                description TEXT NOT NULL,
                gender TEXT NOT NULL,
                size TEXT NOT NULL,
                features TEXT NOT NULL DEFAULT '[]',
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            
            -- 角色动作表
            CREATE TABLE IF NOT EXISTS character_motions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT NOT NULL,
                motion_name TEXT NOT NULL,
                motion_group TEXT NOT NULL DEFAULT 'default',
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, motion_name)
            );
            
            -- 角色表情表
            CREATE TABLE IF NOT EXISTS character_expressions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT NOT NULL,
                expression_name TEXT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, expression_name)
            );
            
            -- 角色配置表
            CREATE TABLE IF NOT EXISTS character_configs (
                character_id TEXT PRIMARY KEY,
                scale REAL NOT NULL DEFAULT 1.0,
                position_x REAL NOT NULL DEFAULT 0.0,
                position_y REAL NOT NULL DEFAULT 0.0,
                interaction_enabled INTEGER NOT NULL DEFAULT 1,
                config_json TEXT,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_characters_active ON characters(is_active);
            CREATE INDEX IF NOT EXISTS idx_character_motions_character ON character_motions(character_id);
            CREATE INDEX IF NOT EXISTS idx_character_expressions_character ON character_expressions(character_id);
            "
        )?;
        Ok(())
    }
    
    /// 初始化聊天相关表
    pub fn init_chat_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 聊天会话表
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                character_id TEXT,
                adapter_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                metadata TEXT NOT NULL DEFAULT '{}'
            );
            
            -- 聊天消息表
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                metadata TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
            "
        )?;
        Ok(())
    }
    
    /// 初始化设置相关表
    pub fn init_settings_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 应用设置表
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                type TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            
            -- 主题配置表
            CREATE TABLE IF NOT EXISTS theme_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_theme_configs_active ON theme_configs(is_active);
            "
        )?;
        Ok(())
    }
    
    /// 初始化工作流相关表
    pub fn init_workflow_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 工作流定义表
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                version TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                definition TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            
            -- 工作流执行历史表
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                status TEXT NOT NULL,
                input TEXT,
                output TEXT,
                error TEXT,
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
            CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
            "
        )?;
        Ok(())
    }
    
    /// 初始化权限相关表
    pub fn init_permission_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 权限表
            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resource TEXT NOT NULL,
                action TEXT NOT NULL,
                granted INTEGER NOT NULL DEFAULT 0,
                granted_at INTEGER,
                description TEXT,
                UNIQUE(resource, action)
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
            CREATE INDEX IF NOT EXISTS idx_permissions_granted ON permissions(granted);
            "
        )?;
        Ok(())
    }
    
    /// 初始化文件相关表
    pub fn init_file_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 文件元数据表
            CREATE TABLE IF NOT EXISTS file_metadata (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                size INTEGER NOT NULL,
                mime_type TEXT,
                checksum TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            
            -- 文件访问日志表
            CREATE TABLE IF NOT EXISTS file_access_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                accessed_at INTEGER NOT NULL,
                FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE CASCADE
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_file_metadata_path ON file_metadata(path);
            CREATE INDEX IF NOT EXISTS idx_file_access_log_file ON file_access_log(file_id);
            "
        )?;
        Ok(())
    }
    
    /// 初始化日志相关表
    pub fn init_log_tables(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            -- 应用日志表
            CREATE TABLE IF NOT EXISTS app_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                module TEXT,
                file TEXT,
                line INTEGER,
                timestamp INTEGER NOT NULL
            );
            
            -- 错误日志表
            CREATE TABLE IF NOT EXISTS error_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                error_type TEXT NOT NULL,
                error_code TEXT,
                message TEXT NOT NULL,
                stack_trace TEXT,
                context TEXT,
                timestamp INTEGER NOT NULL
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
            CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
            CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
            "
        )?;
        Ok(())
    }
    
    // ================================
    // 数据清理方法
    // ================================
    
    /// 清空所有数据（保留表结构）
    pub fn clear_all_data(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            DELETE FROM adapter_permissions;
            DELETE FROM adapter_dependencies;
            DELETE FROM adapter_versions;
            DELETE FROM installed_adapters;
            
            DELETE FROM character_configs;
            DELETE FROM character_expressions;
            DELETE FROM character_motions;
            DELETE FROM characters;
            
            DELETE FROM chat_messages;
            DELETE FROM chat_sessions;
            
            DELETE FROM app_settings;
            DELETE FROM theme_configs;
            
            DELETE FROM workflow_executions;
            DELETE FROM workflows;
            
            DELETE FROM permissions;
            
            DELETE FROM file_access_log;
            DELETE FROM file_metadata;
            
            DELETE FROM app_logs;
            DELETE FROM error_logs;
            "
        )?;
        Ok(())
    }
    
    /// 清空适配器数据
    pub fn clear_adapter_data(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            DELETE FROM adapter_permissions;
            DELETE FROM adapter_dependencies;
            DELETE FROM adapter_versions;
            DELETE FROM installed_adapters;
            "
        )?;
        Ok(())
    }
    
    /// 清空角色数据
    pub fn clear_character_data(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            DELETE FROM character_configs;
            DELETE FROM character_expressions;
            DELETE FROM character_motions;
            DELETE FROM characters;
            "
        )?;
        Ok(())
    }
    
    /// 清空聊天数据
    pub fn clear_chat_data(&self) -> SqliteResult<()> {
        self.connection.execute_batch(
            "
            DELETE FROM chat_messages;
            DELETE FROM chat_sessions;
            "
        )?;
        Ok(())
    }
    
    // ================================
    // 测试数据插入方法
    // ================================
    
    /// 插入测试适配器
    pub fn insert_test_adapter(&self, id: &str, name: &str, enabled: bool) -> SqliteResult<()> {
        let now = Utc::now().timestamp();
        self.connection.execute(
            "INSERT INTO installed_adapters (
                id, name, display_name, version, install_path, status, enabled,
                auto_update, source, installed_at, updated_at, config, metadata
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                id,
                name,
                format!("Display {}", name),
                "1.0.0",
                format!("/test/adapters/{}", id),
                "installed",
                enabled as i32,
                1,
                "test",
                now,
                now,
                "{}",
                "{}"
            ],
        )?;
        Ok(())
    }
    
    /// 插入测试角色
    pub fn insert_test_character(&self, id: &str, name: &str, is_active: bool) -> SqliteResult<()> {
        let now = Utc::now().timestamp();
        self.connection.execute(
            "INSERT INTO characters (
                id, name, display_name, path, description, gender, size, features,
                is_active, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                name,
                format!("Display {}", name),
                format!("/test/characters/{}", id),
                format!("Test character {}", name),
                "female",
                "medium",
                "[]",
                is_active as i32,
                now,
                now
            ],
        )?;
        Ok(())
    }
    
    /// 插入测试聊天会话
    pub fn insert_test_chat_session(&self, id: &str, title: &str) -> SqliteResult<()> {
        let now = Utc::now().timestamp();
        self.connection.execute(
            "INSERT INTO chat_sessions (id, title, created_at, updated_at, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, title, now, now, "{}"],
        )?;
        Ok(())
    }
    
    /// 插入测试聊天消息
    pub fn insert_test_chat_message(
        &self,
        id: &str,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> SqliteResult<()> {
        let now = Utc::now().timestamp();
        self.connection.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, timestamp, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, session_id, role, content, now, "{}"],
        )?;
        Ok(())
    }
    
    /// 插入测试工作流
    pub fn insert_test_workflow(&self, id: &str, name: &str, enabled: bool) -> SqliteResult<()> {
        let now = Utc::now().timestamp();
        self.connection.execute(
            "INSERT INTO workflows (id, name, version, enabled, definition, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                name,
                "1.0.0",
                enabled as i32,
                "{}",
                now,
                now
            ],
        )?;
        Ok(())
    }
    
    // ================================
    // 查询辅助方法
    // ================================
    
    /// 计算表中的记录数
    pub fn count_records(&self, table_name: &str) -> SqliteResult<i64> {
        let query = format!("SELECT COUNT(*) FROM {}", table_name);
        let count: i64 = self.connection.query_row(&query, [], |row| row.get(0))?;
        Ok(count)
    }
    
    /// 检查记录是否存在
    pub fn record_exists(&self, table_name: &str, id_column: &str, id: &str) -> SqliteResult<bool> {
        let query = format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ?1",
            table_name, id_column
        );
        let count: i64 = self.connection.query_row(&query, params![id], |row| row.get(0))?;
        Ok(count > 0)
    }
    
    /// 获取数据库连接（用于手动操作）
    pub fn get_connection(&self) -> &Connection {
        &self.connection
    }
}

impl Default for TestDatabase {
    fn default() -> Self {
        Self::new_in_memory()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_in_memory_database() {
        let db = TestDatabase::new_in_memory();
        assert_eq!(db.path, PathBuf::from(":memory:"));
    }

    #[test]
    fn test_create_file_database() {
        let db = TestDatabase::new();
        assert!(db.path.exists());
    }

    #[test]
    fn test_init_adapter_tables() {
        let db = TestDatabase::new_in_memory();
        assert!(db.init_adapter_tables().is_ok());
        
        // 验证表是否创建成功
        let count = db.count_records("installed_adapters");
        assert_eq!(count.unwrap(), 0);
    }

    #[test]
    fn test_insert_and_count() {
        let db = TestDatabase::new_in_memory();
        db.init_adapter_tables().unwrap();
        
        db.insert_test_adapter("test-001", "Test Adapter", true).unwrap();
        
        let count = db.count_records("installed_adapters").unwrap();
        assert_eq!(count, 1);
        
        let exists = db.record_exists("installed_adapters", "id", "test-001").unwrap();
        assert!(exists);
    }

    #[test]
    fn test_clear_data() {
        let db = TestDatabase::new_in_memory();
        db.init_adapter_tables().unwrap();
        
        db.insert_test_adapter("test-001", "Test Adapter", true).unwrap();
        assert_eq!(db.count_records("installed_adapters").unwrap(), 1);
        
        db.clear_adapter_data().unwrap();
        assert_eq!(db.count_records("installed_adapters").unwrap(), 0);
    }

    #[test]
    fn test_init_full_schema() {
        let db = TestDatabase::new_in_memory();
        assert!(db.init_full_schema().is_ok());
        
        // 验证所有表都创建成功
        assert!(db.count_records("installed_adapters").is_ok());
        assert!(db.count_records("characters").is_ok());
        assert!(db.count_records("chat_sessions").is_ok());
        assert!(db.count_records("workflows").is_ok());
    }
}

