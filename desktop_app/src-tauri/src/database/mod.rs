//! Database module for character and configuration management
//!
//! This module provides persistent storage for:
//! - Character registry and metadata
//! - Character configurations
//! - User preferences
//! - Application state

use rusqlite::{Connection, params, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;
use tauri::AppHandle;
use tracing::{info, error, warn};

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

use character_registry::CharacterRegistry;
use model_config::ModelConfigRegistry;
use adapter::AdapterRegistry;
use workflow::WorkflowRegistry;
use permission::PermissionRegistry;

/// Database manager
pub struct Database {
    /// Connection to SQLite database
    conn: Arc<RwLock<Connection>>,
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
}

impl Database {
    /// Create a new database connection
    pub fn new(db_path: PathBuf) -> SqliteResult<Self> {
        info!("初始化数据库: {:?}", db_path);
        
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        
        let conn = Connection::open(&db_path)?;
        let conn = Arc::new(RwLock::new(conn));
        
        // Initialize schema
        Self::init_schema(&conn)?;
        
        let character_registry = CharacterRegistry::new(conn.clone());
        let model_config_registry = ModelConfigRegistry::new(conn.clone());
        let adapter_registry = AdapterRegistry::new(conn.clone());
        let workflow_registry = WorkflowRegistry::new(conn.clone());
        let permission_registry = PermissionRegistry::new(conn.clone());
        
        // Initialize adapter tables
        adapter_registry.init_tables()?;
        
        // Initialize workflow tables
        workflow_registry.init_tables()?;
        
        // Initialize permission tables
        permission_registry.init_tables()?;
        
        Ok(Self {
            conn,
            character_registry,
            model_config_registry,
            adapter_registry,
            workflow_registry,
            permission_registry,
        })
    }
    
    /// Initialize database schema
    fn init_schema(conn: &Arc<RwLock<Connection>>) -> SqliteResult<()> {
        let conn = conn.write();
        
        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        // Create characters table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                path TEXT NOT NULL,
                preview_image TEXT,
                description TEXT,
                gender TEXT NOT NULL,
                size TEXT NOT NULL,
                features TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;
        
        // Create character_motions table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS character_motions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT NOT NULL,
                motion_name TEXT NOT NULL,
                motion_group TEXT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, motion_name)
            )",
            [],
        )?;
        
        // Create character_expressions table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS character_expressions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT NOT NULL,
                expression_name TEXT NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                UNIQUE(character_id, expression_name)
            )",
            [],
        )?;
        
        // Create character_configs table (for persistent storage)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS character_configs (
                character_id TEXT PRIMARY KEY,
                scale REAL NOT NULL DEFAULT 1.0,
                position_x REAL NOT NULL DEFAULT 0.0,
                position_y REAL NOT NULL DEFAULT 0.0,
                interaction_enabled INTEGER NOT NULL DEFAULT 1,
                config_json TEXT,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            )",
            [],
        )?;
        
        // Create indexes for performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_characters_active ON characters(is_active)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_motions_character ON character_motions(character_id)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_character_expressions_character ON character_expressions(character_id)",
            [],
        )?;
        
        // Create model_configs table
        conn.execute(
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
                stop_sequences TEXT NOT NULL DEFAULT '[]',
                is_default INTEGER NOT NULL DEFAULT 0,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                description TEXT,
                extra_config TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;
        
        // Create model_config_history table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS model_config_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id TEXT NOT NULL,
                action TEXT NOT NULL,
                old_data TEXT,
                new_data TEXT,
                reason TEXT,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;
        
        // Create indexes for model configs
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_configs_model_id ON model_configs(model_id)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_configs_adapter_id ON model_configs(adapter_id)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_configs_default ON model_configs(is_default)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_model_config_history_config ON model_config_history(config_id)",
            [],
        )?;
        
        info!("数据库架构初始化完成");
        Ok(())
    }
    
    /// Get database connection
    pub fn get_connection(&self) -> Arc<RwLock<Connection>> {
        self.conn.clone()
    }
}

/// Global database instance
static mut DATABASE: Option<Arc<Database>> = None;

/// Initialize database
pub async fn init_database(app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("初始化数据库系统");
    
    // Get database path from app data directory
    let app_data_dir = app.path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let db_path = app_data_dir.join("zishu-sensei.db");
    
    // Create database
    let db = Database::new(db_path)?;
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
