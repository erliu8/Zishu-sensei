//! Character registry module
//!
//! Provides persistent storage and management for Live2D characters

use rusqlite::{Connection, params, Result as SqliteResult, Row};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::Utc;
use tracing::{info, error};
use crate::database::DbPool;

/// Character data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterData {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub path: String,
    pub preview_image: Option<String>,
    pub description: String,
    pub gender: String,
    pub size: String,
    pub features: Vec<String>,
    pub motions: Vec<String>,
    pub expressions: Vec<String>,
    pub is_active: bool,
}

/// Character configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterConfig {
    pub character_id: String,
    pub scale: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub interaction_enabled: bool,
    pub config_json: Option<String>,
}

/// Character registry
pub struct CharacterRegistry {
    pool: DbPool,
}

impl CharacterRegistry {
    /// Create a new character registry
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
    
    /// Register a new character
    pub fn register_character(&self, character: CharacterData) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let timestamp = Utc::now().timestamp();
        
        let features_json = serde_json::to_string(&character.features).unwrap_or_default();
        
        conn.execute(
            "INSERT OR REPLACE INTO characters 
            (id, name, display_name, path, preview_image, description, gender, size, features, is_active, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                character.id,
                character.name,
                character.display_name,
                character.path,
                character.preview_image,
                character.description,
                character.gender,
                character.size,
                features_json,
                if character.is_active { 1 } else { 0 },
                timestamp,
                timestamp,
            ],
        )?;
        
        // Register motions
        for motion in &character.motions {
            conn.execute(
                "INSERT OR IGNORE INTO character_motions (character_id, motion_name, motion_group)
                VALUES (?1, ?2, ?3)",
                params![character.id, motion, "default"],
            )?;
        }
        
        // Register expressions
        for expression in &character.expressions {
            conn.execute(
                "INSERT OR IGNORE INTO character_expressions (character_id, expression_name)
                VALUES (?1, ?2)",
                params![character.id, expression],
            )?;
        }
        
        info!("角色注册成功: {}", character.id);
        Ok(())
    }
    
    /// Get a character by ID
    pub fn get_character(&self, character_id: &str) -> SqliteResult<Option<CharacterData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, display_name, path, preview_image, description, gender, size, features, is_active
            FROM characters WHERE id = ?1"
        )?;
        
        let mut rows = stmt.query(params![character_id])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(Self::row_to_character(row, &conn)?))
        } else {
            Ok(None)
        }
    }
    
    /// Get all characters
    pub fn get_all_characters(&self) -> SqliteResult<Vec<CharacterData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, display_name, path, preview_image, description, gender, size, features, is_active
            FROM characters ORDER BY name"
        )?;
        
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, i32>(9)?,
            ))
        })?;
        
        let mut characters = Vec::new();
        for row in rows {
            let (id, name, display_name, path, preview_image, description, gender, size, features_json, is_active) = row?;
            
            // Parse features
            let features: Vec<String> = serde_json::from_str(&features_json).unwrap_or_default();
            
            // Get motions
            let motions = self.get_character_motions_internal(&conn, &id)?;
            
            // Get expressions
            let expressions = self.get_character_expressions_internal(&conn, &id)?;
            
            characters.push(CharacterData {
                id,
                name,
                display_name,
                path,
                preview_image,
                description,
                gender,
                size,
                features,
                motions,
                expressions,
                is_active: is_active != 0,
            });
        }
        
        Ok(characters)
    }
    
    /// Get active character
    pub fn get_active_character(&self) -> SqliteResult<Option<CharacterData>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, display_name, path, preview_image, description, gender, size, features, is_active
            FROM characters WHERE is_active = 1 LIMIT 1"
        )?;
        
        let mut rows = stmt.query([])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(Self::row_to_character(row, &conn)?))
        } else {
            Ok(None)
        }
    }
    
    /// Set active character
    pub fn set_active_character(&self, character_id: &str) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        // Deactivate all characters
        conn.execute("UPDATE characters SET is_active = 0", [])?;
        
        // Activate the specified character
        let updated = conn.execute(
            "UPDATE characters SET is_active = 1, updated_at = ?2 WHERE id = ?1",
            params![character_id, Utc::now().timestamp()],
        )?;
        
        if updated == 0 {
            error!("角色不存在: {}", character_id);
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        
        info!("设置激活角色: {}", character_id);
        Ok(())
    }
    
    /// Update character
    pub fn update_character(&self, character: CharacterData) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let timestamp = Utc::now().timestamp();
        
        let features_json = serde_json::to_string(&character.features).unwrap_or_default();
        
        conn.execute(
            "UPDATE characters SET 
            name = ?2, display_name = ?3, path = ?4, preview_image = ?5, 
            description = ?6, gender = ?7, size = ?8, features = ?9, 
            is_active = ?10, updated_at = ?11
            WHERE id = ?1",
            params![
                character.id,
                character.name,
                character.display_name,
                character.path,
                character.preview_image,
                character.description,
                character.gender,
                character.size,
                features_json,
                if character.is_active { 1 } else { 0 },
                timestamp,
            ],
        )?;
        
        info!("角色更新成功: {}", character.id);
        Ok(())
    }
    
    /// Delete character
    pub fn delete_character(&self, character_id: &str) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        conn.execute("DELETE FROM characters WHERE id = ?1", params![character_id])?;
        
        info!("角色删除成功: {}", character_id);
        Ok(())
    }
    
    /// Get character configuration
    pub fn get_character_config(&self, character_id: &str) -> SqliteResult<Option<CharacterConfig>> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let mut stmt = conn.prepare(
            "SELECT character_id, scale, position_x, position_y, interaction_enabled, config_json
            FROM character_configs WHERE character_id = ?1"
        )?;
        
        let mut rows = stmt.query(params![character_id])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(CharacterConfig {
                character_id: row.get(0)?,
                scale: row.get(1)?,
                position_x: row.get(2)?,
                position_y: row.get(3)?,
                interaction_enabled: row.get::<_, i32>(4)? != 0,
                config_json: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }
    
    /// Save character configuration
    pub fn save_character_config(&self, config: CharacterConfig) -> SqliteResult<()> {
        let conn = self.pool.get().map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let timestamp = Utc::now().timestamp();
        
        conn.execute(
            "INSERT OR REPLACE INTO character_configs 
            (character_id, scale, position_x, position_y, interaction_enabled, config_json, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                config.character_id,
                config.scale,
                config.position_x,
                config.position_y,
                if config.interaction_enabled { 1 } else { 0 },
                config.config_json,
                timestamp,
            ],
        )?;
        
        info!("角色配置保存成功: {}", config.character_id);
        Ok(())
    }
    
    // ==================== Helper methods ====================
    
    /// Convert database row to CharacterData
    fn row_to_character(row: &Row, conn: &Connection) -> SqliteResult<CharacterData> {
        let id: String = row.get(0)?;
        let features_json: String = row.get(8)?;
        let features: Vec<String> = serde_json::from_str(&features_json).unwrap_or_default();
        
        // Get motions
        let motions = Self::get_character_motions_internal_static(conn, &id)?;
        
        // Get expressions
        let expressions = Self::get_character_expressions_internal_static(conn, &id)?;
        
        Ok(CharacterData {
            id: id.clone(),
            name: row.get(1)?,
            display_name: row.get(2)?,
            path: row.get(3)?,
            preview_image: row.get(4)?,
            description: row.get(5)?,
            gender: row.get(6)?,
            size: row.get(7)?,
            features,
            motions,
            expressions,
            is_active: row.get::<_, i32>(9)? != 0,
        })
    }
    
    /// Get character motions (internal, with read lock)
    fn get_character_motions_internal(&self, conn: &Connection, character_id: &str) -> SqliteResult<Vec<String>> {
        let mut stmt = conn.prepare(
            "SELECT motion_name FROM character_motions WHERE character_id = ?1"
        )?;
        
        let rows = stmt.query_map(params![character_id], |row| {
            row.get::<_, String>(0)
        })?;
        
        let mut motions = Vec::new();
        for motion in rows {
            motions.push(motion?);
        }
        
        Ok(motions)
    }
    
    /// Get character expressions (internal, with read lock)
    fn get_character_expressions_internal(&self, conn: &Connection, character_id: &str) -> SqliteResult<Vec<String>> {
        let mut stmt = conn.prepare(
            "SELECT expression_name FROM character_expressions WHERE character_id = ?1"
        )?;
        
        let rows = stmt.query_map(params![character_id], |row| {
            row.get::<_, String>(0)
        })?;
        
        let mut expressions = Vec::new();
        for expression in rows {
            expressions.push(expression?);
        }
        
        Ok(expressions)
    }
    
    /// Get character motions (static, for row_to_character)
    fn get_character_motions_internal_static(conn: &Connection, character_id: &str) -> SqliteResult<Vec<String>> {
        let mut stmt = conn.prepare(
            "SELECT motion_name FROM character_motions WHERE character_id = ?1"
        )?;
        
        let rows = stmt.query_map(params![character_id], |row| {
            row.get::<_, String>(0)
        })?;
        
        let mut motions = Vec::new();
        for motion in rows {
            motions.push(motion?);
        }
        
        Ok(motions)
    }
    
    /// Get character expressions (static, for row_to_character)
    fn get_character_expressions_internal_static(conn: &Connection, character_id: &str) -> SqliteResult<Vec<String>> {
        let mut stmt = conn.prepare(
            "SELECT expression_name FROM character_expressions WHERE character_id = ?1"
        )?;
        
        let rows = stmt.query_map(params![character_id], |row| {
            row.get::<_, String>(0)
        })?;
        
        let mut expressions = Vec::new();
        for expression in rows {
            expressions.push(expression?);
        }
        
        Ok(expressions)
    }
}

