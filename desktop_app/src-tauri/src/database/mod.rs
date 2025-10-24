//! Database module for character and configuration management
//!
//! This module provides persistent storage for:
//! - Character registry and metadata
//! - Character configurations
//! - User preferences
//! - Application state
//! - Integrated support for PostgreSQL, Redis, and Qdrant

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;
use tracing::{info, error, warn};
use deadpool_postgres::Pool;

/// Database connection pool type (PostgreSQL)
pub type DbPool = Pool;

// ===================================
// 数据库后端和服务
// ===================================

// 后端实现
pub mod backends;
pub mod postgres_backend;
pub mod redis_backend;
pub mod qdrant_backend;

// 统一数据库管理器
pub mod database_manager;

// 高层服务
pub mod cache_service;
pub mod vector_search_service;

// ===================================
// 核心数据模块
// ===================================

pub mod character_registry;
pub mod model_config;
pub mod adapter;
pub mod theme;
pub mod workflow;
pub mod file;
pub mod encrypted_storage;
pub mod permission;
pub mod privacy;
pub mod region;
pub mod performance;
pub mod update;
pub mod logging;

// 导出错误类型
pub mod error;

// ===================================
// 导出类型
// ===================================

use character_registry::CharacterRegistry;
use model_config::ModelConfigRegistry;
use adapter::AdapterRegistry;
use workflow::WorkflowRegistry;
use permission::PermissionRegistry;
use update::UpdateRegistry;
use theme::ThemeRegistry;
use logging::LoggingRegistry;
use encrypted_storage::EncryptedStorageRegistry;

pub use database_manager::{DatabaseManager, DatabaseManagerConfig, HealthCheckResult};
pub use cache_service::{CacheService, CacheDecorator};
pub use vector_search_service::{
    VectorSearchService, VectorEmbedding,
    ConversationMessage, Document, Knowledge,
};

/// Database manager (Legacy - 兼容旧代码)
/// 
/// 注意: 推荐使用 `DatabaseManager` 来管理所有数据库连接
/// 这个结构保留用于向后兼容
pub struct Database {
    /// Database connection pool
    pool: DbPool,
    /// Character registry
    pub character_registry: CharacterRegistry,
    /// Model configuration registry
    pub model_config_registry: ModelConfigRegistry,
    /// Adapter registry
    pub adapter_registry: AdapterRegistry,
    /// Workflow registry
    pub workflow_registry: WorkflowRegistry,
    /// Permission registry
    pub permission_registry: PermissionRegistry,
    /// Update registry
    pub update_registry: UpdateRegistry,
    /// Theme registry
    pub theme_registry: ThemeRegistry,
    /// Logging registry
    pub logging_registry: LoggingRegistry,
    /// Encrypted storage registry
    pub encrypted_storage_registry: EncryptedStorageRegistry,
}

impl Database {
    /// Create a new database connection with PostgreSQL
    pub async fn new(database_url: String) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        info!("初始化 PostgreSQL 数据库: {}", database_url);
        
        // Create PostgreSQL connection pool
        use deadpool_postgres::{Config, Runtime};
        use tokio_postgres::NoTls;
        
        let mut cfg = Config::new();
        cfg.dbname = Some("zishu_sensei".to_string());
        cfg.host = Some("localhost".to_string());
        cfg.user = Some("zishu".to_string());
        cfg.password = Some("zishu".to_string());
        let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)?;
        
        // Initialize schema
        Self::init_schema(&pool).await?;
        
        let character_registry = CharacterRegistry::new(pool.clone());
        let model_config_registry = ModelConfigRegistry::new(pool.clone());
        let adapter_registry = AdapterRegistry::new(pool.clone());
        let workflow_registry = WorkflowRegistry::new(pool.clone());
        let permission_registry = PermissionRegistry::new(pool.clone());
        let update_registry = UpdateRegistry::new(pool.clone());
        let theme_registry = ThemeRegistry::new(pool.clone());
        let logging_registry = LoggingRegistry::new(pool.clone());
        let encrypted_storage_registry = EncryptedStorageRegistry::new(pool.clone());
        
        // Initialize tables for all registries
        adapter_registry.init_tables().await?;
        workflow_registry.init_tables().await?;
        permission_registry.init_tables().await?;
        update_registry.init_tables().await?;
        theme_registry.init_tables().await?;
        logging_registry.init_tables().await?;
        encrypted_storage_registry.init_tables().await?;
        
        Ok(Self {
            pool,
            character_registry,
            model_config_registry,
            adapter_registry,
            workflow_registry,
            permission_registry,
            update_registry,
            theme_registry,
            logging_registry,
            encrypted_storage_registry,
        })
    }
    
    /// Initialize database schema (PostgreSQL)
    async fn init_schema(pool: &DbPool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = pool.get().await?;
        
        // Create characters table
        client.execute(
            "CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                path TEXT NOT NULL,
                preview_image TEXT,
                description TEXT,
                gender TEXT NOT NULL,
                size TEXT NOT NULL,
                features JSONB NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT false,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;
        
        // Create character_motions table
        client.execute(
            "CREATE TABLE IF NOT EXISTS character_motions (
                id SERIAL PRIMARY KEY,
                character_id TEXT NOT NULL,
                motion_name TEXT NOT NULL,
                motion_group TEXT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, motion_name)
            )",
            &[],
        ).await?;
        
        // Create character_expressions table
        client.execute(
            "CREATE TABLE IF NOT EXISTS character_expressions (
                id SERIAL PRIMARY KEY,
                character_id TEXT NOT NULL,
                expression_name TEXT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, expression_name)
            )",
            &[],
        ).await?;
        
        // Create character_configs table (for persistent storage)
        client.execute(
            "CREATE TABLE IF NOT EXISTS character_configs (
                character_id TEXT PRIMARY KEY,
                scale REAL NOT NULL DEFAULT 1.0,
                position_x REAL NOT NULL DEFAULT 0.0,
                position_y REAL NOT NULL DEFAULT 0.0,
                interaction_enabled BOOLEAN NOT NULL DEFAULT true,
                config_json TEXT,
                updated_at BIGINT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            )",
            &[],
        ).await?;
        
        // Create indexes for performance
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_characters_active ON characters(is_active)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_motions_character ON character_motions(character_id)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_expressions_character ON character_expressions(character_id)",
            &[],
        ).await?;
        
        // Create model_configs table
        client.execute(
            "CREATE TABLE IF NOT EXISTS model_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                model_id TEXT NOT NULL,
                adapter_id TEXT,
                temperature REAL NOT NULL DEFAULT 0.7,
                top_p REAL NOT NULL DEFAULT 0.9,
                top_k INTEGER,
                max_tokens INTEGER NOT NULL DEFAULT 2048,
                frequency_penalty REAL NOT NULL DEFAULT 0.0,
                presence_penalty REAL NOT NULL DEFAULT 0.0,
                stop_sequences JSONB NOT NULL DEFAULT '[]',
                is_default BOOLEAN NOT NULL DEFAULT false,
                is_enabled BOOLEAN NOT NULL DEFAULT true,
                description TEXT,
                extra_config TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            &[],
        ).await?;
        
        // Create model_config_history table
        client.execute(
            "CREATE TABLE IF NOT EXISTS model_config_history (
                id SERIAL PRIMARY KEY,
                config_id TEXT NOT NULL,
                action TEXT NOT NULL,
                old_data TEXT,
                new_data TEXT,
                reason TEXT,
                created_at BIGINT NOT NULL
            )",
            &[],
        ).await?;
        
        // Create indexes for model configs
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_configs_model_id ON model_configs(model_id)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_configs_adapter_id ON model_configs(adapter_id)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_configs_default ON model_configs(is_default)",
            &[],
        ).await?;
        
        client.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_config_history_config ON model_config_history(config_id)",
            &[],
        ).await?;
        
        info!("数据库架构初始化完成");
        Ok(())
    }
    
    /// Get database connection pool
    pub fn get_pool(&self) -> DbPool {
        self.pool.clone()
    }
}

/// Global database instance (Legacy)
static mut DATABASE: Option<Arc<Database>> = None;

/// Global integrated database manager
static mut DATABASE_MANAGER: Option<Arc<DatabaseManager>> = None;

/// Initialize database (Legacy - 向后兼容)
pub async fn init_database(app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("初始化数据库系统");
    
    // Get PostgreSQL connection URL from environment or use default
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| {
            warn!("DATABASE_URL 未设置，使用默认配置");
            "postgresql://zishu:zishu@localhost/zishu_sensei".to_string()
        });
    
    // Create database connection
    let db = Database::new(database_url).await?;
    let db = Arc::new(db);
    
    // Load characters from models.json
    if let Err(e) = load_characters_from_models(&db).await {
        warn!("加载角色模型失败: {}", e);
    }
    
    // Initialize default model configs
    if let Err(e) = init_default_model_configs(&db).await {
        warn!("初始化默认模型配置失败: {}", e);
    }
    
    // Store global instance
    unsafe {
        DATABASE = Some(db);
    }
    
    info!("数据库系统初始化完成");
    Ok(())
}

/// Initialize integrated database manager (推荐)
/// 
/// 这个方法初始化完整的多数据库系统，包括 PostgreSQL、Redis 和 Qdrant
pub async fn init_database_manager() -> Result<Arc<DatabaseManager>, Box<dyn std::error::Error + Send + Sync>> {
    info!("初始化集成数据库管理器");
    
    // 从环境变量加载配置
    let config = DatabaseManagerConfig::from_env();
    
    // 创建数据库管理器
    let manager = DatabaseManager::new(config).await?;
    let manager = Arc::new(manager);
    
    // 存储全局实例
    unsafe {
        DATABASE_MANAGER = Some(manager.clone());
    }
    
    info!("集成数据库管理器初始化完成");
    Ok(manager)
}

/// Get integrated database manager
pub fn get_database_manager() -> Option<Arc<DatabaseManager>> {
    unsafe { DATABASE_MANAGER.clone() }
}

/// Initialize all database systems (推荐用于新代码)
/// 
/// 这个方法同时初始化传统Database和新的DatabaseManager
pub async fn init_all_databases(app: AppHandle) -> Result<Arc<DatabaseManager>, Box<dyn std::error::Error + Send + Sync>> {
    // 先初始化传统数据库（用于兼容）
    init_database(app).await?;
    
    // 再初始化集成数据库管理器
    let manager = init_database_manager().await?;
    
    Ok(manager)
}

/// Close database
pub async fn close_database() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("关闭数据库连接");
    
    unsafe {
        DATABASE = None;
    }
    
    Ok(())
}

/// Get global database instance
pub fn get_database() -> Option<Arc<Database>> {
    unsafe { DATABASE.clone() }
}

/// Load characters from models.json into database
async fn load_characters_from_models(db: &Database) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use std::fs;
    
    info!("从 models.json 加载角色数据");
    
    // Read models.json
    let models_path = "public/live2d_models/models.json";
    let content = fs::read_to_string(models_path)
        .map_err(|e| format!("无法读取 models.json: {}", e))?;
    
    let models_data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 models.json 失败: {}", e))?;
    
    let models = models_data["models"]
        .as_array()
        .ok_or("models.json 格式错误")?;
    
    // Import each model
    for model in models {
        let id = model["id"].as_str().unwrap_or("");
        let name = model["name"].as_str().unwrap_or("");
        let display_name = model["displayName"].as_str().unwrap_or(name);
        let path = model["path"].as_str().unwrap_or("");
        let preview_image = model["previewImage"].as_str();
        let description = model["description"].as_str().unwrap_or("");
        let gender = model["gender"].as_str().unwrap_or("neutral");
        let size = model["size"].as_str().unwrap_or("0");
        
        // Parse features
        let features: Vec<String> = model["features"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        
        // Check if character exists
        if let Ok(Some(_)) = db.character_registry.get_character(id) {
            info!("角色已存在，跳过: {}", id);
            continue;
        }
        
        // Create character
        let character = character_registry::CharacterData {
            id: id.to_string(),
            name: name.to_string(),
            display_name: display_name.to_string(),
            path: path.to_string(),
            preview_image: preview_image.map(|s| s.to_string()),
            description: description.to_string(),
            gender: gender.to_string(),
            size: size.to_string(),
            features,
            motions: vec![],
            expressions: vec![],
            is_active: false,
        };
        
        db.character_registry.register_character(character)?;
        info!("成功注册角色: {} ({})", id, name);
    }
    
    // Set default active character (hiyori) if no active character
    let active_character = db.character_registry.get_active_character()?;
    if active_character.is_none() {
        if let Ok(Some(_)) = db.character_registry.get_character("hiyori") {
            db.character_registry.set_active_character("hiyori")?;
            info!("设置默认激活角色: hiyori");
        }
    }
    
    info!("角色数据加载完成");
    Ok(())
}

/// Initialize default model configurations
async fn init_default_model_configs(db: &Database) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use model_config::ModelConfigData;
    
    info!("初始化默认模型配置");
    
    // Check if any config exists
    let existing_configs = db.model_config_registry.get_all_configs()?;
    if !existing_configs.is_empty() {
        info!("模型配置已存在，跳过初始化");
        return Ok(());
    }
    
    // Create default configurations
    let default_configs = vec![
        ModelConfigData::default_config(),
        ModelConfigData::creative_config(),
        ModelConfigData::precise_config(),
    ];
    
    for config in default_configs {
        match db.model_config_registry.save_config(config.clone()) {
            Ok(_) => info!("默认配置已创建: {}", config.name),
            Err(e) => warn!("创建默认配置失败 {}: {}", config.name, e),
        }
    }
    
    info!("默认模型配置初始化完成");
    Ok(())
}
