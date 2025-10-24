//! # Test Fixtures Module
//!
//! Provides utilities for loading and managing test fixture data.
//! 
//! This module contains helper functions to load JSON fixtures for:
//! - Adapters (AI model configurations)
//! - Characters (Live2D character data)
//! - Workflows (workflow definitions and templates)
//! - Configs (application configurations)

use serde_json::Value;
use std::fs;
use std::path::PathBuf;

// ================================
// Fixture Path Helpers
// ================================

/// Get the base path for all fixtures
fn fixtures_base_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

/// Get the path to an adapter fixture
fn adapter_fixture_path(filename: &str) -> PathBuf {
    fixtures_base_path()
        .join("adapters")
        .join(format!("{}.json", filename))
}

/// Get the path to a character fixture
fn character_fixture_path(filename: &str) -> PathBuf {
    fixtures_base_path()
        .join("characters")
        .join(format!("{}.json", filename))
}

/// Get the path to a workflow fixture
fn workflow_fixture_path(filename: &str) -> PathBuf {
    fixtures_base_path()
        .join("workflows")
        .join(format!("{}.json", filename))
}

/// Get the path to a config fixture
fn config_fixture_path(filename: &str) -> PathBuf {
    fixtures_base_path()
        .join("configs")
        .join(format!("{}.json", filename))
}

// ================================
// Generic Fixture Loader
// ================================

/// Load a fixture file and parse as JSON
/// 
/// # Arguments
/// * `path` - Path to the fixture file
/// 
/// # Returns
/// Parsed JSON value
/// 
/// # Panics
/// Panics if the file cannot be read or parsed
fn load_fixture(path: &PathBuf) -> Value {
    let content = fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("Failed to read fixture {:?}: {}", path, e));
    
    serde_json::from_str(&content)
        .unwrap_or_else(|e| panic!("Failed to parse fixture {:?}: {}", path, e))
}

/// Load a fixture file and parse as a specific type
/// 
/// # Arguments
/// * `path` - Path to the fixture file
/// 
/// # Returns
/// Parsed value of type T
/// 
/// # Panics
/// Panics if the file cannot be read, parsed, or deserialized
fn load_fixture_as<T: serde::de::DeserializeOwned>(path: &PathBuf) -> T {
    let content = fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("Failed to read fixture {:?}: {}", path, e));
    
    serde_json::from_str(&content)
        .unwrap_or_else(|e| panic!("Failed to parse fixture {:?}: {}", path, e))
}

// ================================
// Adapter Fixtures
// ================================

/// Load an adapter fixture by name (without .json extension)
/// 
/// # Examples
/// ```
/// let adapter = load_adapter_fixture("valid_openai_adapter");
/// ```
pub fn load_adapter_fixture(name: &str) -> Value {
    load_fixture(&adapter_fixture_path(name))
}

/// Load an adapter fixture as a specific type
pub fn load_adapter_fixture_as<T: serde::de::DeserializeOwned>(name: &str) -> T {
    load_fixture_as(&adapter_fixture_path(name))
}

/// Load the valid OpenAI adapter fixture
pub fn valid_openai_adapter() -> Value {
    load_adapter_fixture("valid_openai_adapter")
}

/// Load the valid Claude adapter fixture
pub fn valid_claude_adapter() -> Value {
    load_adapter_fixture("valid_claude_adapter")
}

/// Load the hard adapter example fixture
pub fn hard_adapter_example() -> Value {
    load_adapter_fixture("hard_adapter_example")
}

/// Load the intelligent adapter example fixture
pub fn intelligent_adapter_example() -> Value {
    load_adapter_fixture("intelligent_adapter_example")
}

/// Load the minimal adapter fixture
pub fn minimal_adapter() -> Value {
    load_adapter_fixture("minimal_adapter")
}

/// Load an invalid adapter fixture (missing required fields)
pub fn invalid_adapter_missing_required() -> Value {
    load_adapter_fixture("invalid_adapter_missing_required")
}

/// Load an invalid adapter fixture (wrong field types)
pub fn invalid_adapter_wrong_type() -> Value {
    load_adapter_fixture("invalid_adapter_wrong_type")
}

// ================================
// Character Fixtures
// ================================

/// Load a character fixture by name (without .json extension)
/// 
/// # Examples
/// ```
/// let character = load_character_fixture("valid_shizuku_character");
/// ```
pub fn load_character_fixture(name: &str) -> Value {
    load_fixture(&character_fixture_path(name))
}

/// Load a character fixture as a specific type
pub fn load_character_fixture_as<T: serde::de::DeserializeOwned>(name: &str) -> T {
    load_fixture_as(&character_fixture_path(name))
}

/// Load the valid Shizuku character fixture
pub fn valid_shizuku_character() -> Value {
    load_character_fixture("valid_shizuku_character")
}

/// Load the character with advanced features fixture
pub fn character_with_advanced_features() -> Value {
    load_character_fixture("character_with_advanced_features")
}

/// Load the minimal character fixture
pub fn valid_minimal_character() -> Value {
    load_character_fixture("valid_minimal_character")
}

/// Load an invalid character fixture (missing ID)
pub fn invalid_character_missing_id() -> Value {
    load_character_fixture("invalid_character_missing_id")
}

// ================================
// Workflow Fixtures
// ================================

/// Load a workflow fixture by name (without .json extension)
/// 
/// # Examples
/// ```
/// let workflow = load_workflow_fixture("simple_greeting_workflow");
/// ```
pub fn load_workflow_fixture(name: &str) -> Value {
    load_fixture(&workflow_fixture_path(name))
}

/// Load a workflow fixture as a specific type
pub fn load_workflow_fixture_as<T: serde::de::DeserializeOwned>(name: &str) -> T {
    load_fixture_as(&workflow_fixture_path(name))
}

/// Load the simple greeting workflow fixture
pub fn simple_greeting_workflow() -> Value {
    load_workflow_fixture("simple_greeting_workflow")
}

/// Load the complex chat workflow fixture
pub fn complex_chat_workflow() -> Value {
    load_workflow_fixture("complex_chat_workflow")
}

/// Load the parallel execution workflow fixture
pub fn parallel_execution_workflow() -> Value {
    load_workflow_fixture("parallel_execution_workflow")
}

/// Load the workflow template for data processing
pub fn workflow_template_data_processing() -> Value {
    load_workflow_fixture("workflow_template_data_processing")
}

/// Load an invalid workflow fixture (missing steps)
pub fn invalid_workflow_missing_steps() -> Value {
    load_workflow_fixture("invalid_workflow_missing_steps")
}

// ================================
// Config Fixtures
// ================================

/// Load a config fixture by name (without .json extension)
/// 
/// # Examples
/// ```
/// let config = load_config_fixture("default_app_config");
/// ```
pub fn load_config_fixture(name: &str) -> Value {
    load_fixture(&config_fixture_path(name))
}

/// Load a config fixture as a specific type
pub fn load_config_fixture_as<T: serde::de::DeserializeOwned>(name: &str) -> T {
    load_fixture_as(&config_fixture_path(name))
}

/// Load the default app config fixture
pub fn default_app_config() -> Value {
    load_config_fixture("default_app_config")
}

/// Load the custom user config fixture
pub fn custom_user_config() -> Value {
    load_config_fixture("custom_user_config")
}

/// Load the minimal config fixture
pub fn minimal_config() -> Value {
    load_config_fixture("minimal_config")
}

/// Load an invalid config fixture (wrong types)
pub fn invalid_config_wrong_types() -> Value {
    load_config_fixture("invalid_config_wrong_types")
}

// ================================
// Fixture Builders (for dynamic test data)
// ================================

/// Create a test adapter with customizable fields
/// 
/// # Arguments
/// * `id` - Adapter ID
/// * `name` - Adapter name
/// * `adapter_type` - Adapter type (soft, hard, intelligent)
/// 
/// # Returns
/// JSON value representing an adapter
pub fn create_test_adapter(id: &str, name: &str, adapter_type: &str) -> Value {
    serde_json::json!({
        "id": id,
        "name": name,
        "version": "1.0.0",
        "adapter_type": adapter_type,
        "description": format!("Test adapter: {}", name),
        "author": "Test Suite",
        "tags": ["test"],
        "capabilities": [],
        "compatibility": {
            "min_version": "1.0.0",
            "platforms": ["windows", "macos", "linux"],
            "python_versions": []
        },
        "resource_requirements": {
            "min_memory_mb": 128,
            "recommended_memory_mb": 256,
            "disk_space_mb": 50,
            "cpu_cores": 1,
            "gpu_required": false
        },
        "config_schema": {},
        "default_config": {},
        "enabled": true,
        "priority": "normal",
        "auto_load": false
    })
}

/// Create a test character with customizable fields
/// 
/// # Arguments
/// * `id` - Character ID
/// * `name` - Character name
/// * `character_type` - Character type (live2d, sprite, avatar)
/// 
/// # Returns
/// JSON value representing a character
pub fn create_test_character(id: &str, name: &str, character_type: &str) -> Value {
    let now = chrono::Utc::now().timestamp();
    
    serde_json::json!({
        "id": id,
        "name": name,
        "display_name": name,
        "description": format!("Test character: {}", name),
        "avatar": "test_avatar.png",
        "type": character_type,
        "personality": "friendly",
        "tags": ["test"],
        "model_path": format!("/test/{}/model.json", id),
        "gender": "unknown",
        "size": "medium",
        "features": [],
        "motions": [],
        "expressions": [],
        "config": {
            "scale": 1.0,
            "position_x": 0.0,
            "position_y": 0.0,
            "interaction_enabled": true
        },
        "is_active": false,
        "enabled": true,
        "created_at": now,
        "updated_at": now
    })
}

/// Create a test workflow with customizable fields
/// 
/// # Arguments
/// * `id` - Workflow ID
/// * `name` - Workflow name
/// * `steps` - Number of steps to create
/// 
/// # Returns
/// JSON value representing a workflow
pub fn create_test_workflow(id: &str, name: &str, num_steps: usize) -> Value {
    let now = chrono::Utc::now().timestamp();
    
    let steps: Vec<Value> = (0..num_steps)
        .map(|i| {
            serde_json::json!({
                "id": format!("step-{}", i),
                "name": format!("Test Step {}", i),
                "step_type": "transform",
                "order": i,
                "config": {},
                "dependencies": if i > 0 { vec![format!("step-{}", i - 1)] } else { vec![] },
                "retry_config": {
                    "max_retries": 1,
                    "retry_delay_ms": 500,
                    "backoff_multiplier": 1.0
                },
                "timeout_seconds": 10,
                "enabled": true
            })
        })
        .collect();
    
    serde_json::json!({
        "id": id,
        "name": name,
        "description": format!("Test workflow: {}", name),
        "version": "1.0.0",
        "status": "draft",
        "steps": steps,
        "config": {
            "timeout_seconds": 60,
            "max_retries": 3,
            "retry_delay_ms": 1000,
            "parallel_execution": false,
            "error_handling": "stop_on_error",
            "logging_enabled": true,
            "telemetry_enabled": false
        },
        "trigger": null,
        "tags": ["test"],
        "category": "test",
        "is_template": false,
        "template_id": null,
        "created_at": now,
        "updated_at": now
    })
}

/// Create a test app config with customizable fields
/// 
/// # Arguments
/// * `character_id` - ID of the current character
/// * `theme` - Theme name
/// 
/// # Returns
/// JSON value representing an app config
pub fn create_test_config(character_id: &str, theme: &str) -> Value {
    serde_json::json!({
        "window": {
            "width": 400,
            "height": 600,
            "always_on_top": true,
            "transparent": true,
            "decorations": false,
            "resizable": true,
            "position": null
        },
        "character": {
            "current_character": character_id,
            "scale": 1.0,
            "auto_idle": true,
            "interaction_enabled": true
        },
        "theme": {
            "current_theme": theme,
            "custom_css": null
        },
        "system": {
            "auto_start": false,
            "minimize_to_tray": true,
            "close_to_tray": true,
            "show_notifications": true,
            "language": "en",
            "log_level": "info"
        }
    })
}

// ================================
// Fixture Validation Helpers
// ================================

/// Check if a fixture has a specific field
pub fn has_field(fixture: &Value, field: &str) -> bool {
    fixture.get(field).is_some()
}

/// Get a string field from a fixture
pub fn get_string_field(fixture: &Value, field: &str) -> Option<String> {
    fixture.get(field)?.as_str().map(|s| s.to_string())
}

/// Get an integer field from a fixture
pub fn get_i64_field(fixture: &Value, field: &str) -> Option<i64> {
    fixture.get(field)?.as_i64()
}

/// Get a boolean field from a fixture
pub fn get_bool_field(fixture: &Value, field: &str) -> Option<bool> {
    fixture.get(field)?.as_bool()
}

/// Get an array field from a fixture
pub fn get_array_field<'a>(fixture: &'a Value, field: &str) -> Option<&'a Vec<Value>> {
    fixture.get(field)?.as_array()
}

/// Get an object field from a fixture
pub fn get_object_field<'a>(fixture: &'a Value, field: &str) -> Option<&'a serde_json::Map<String, Value>> {
    fixture.get(field)?.as_object()
}

// ================================
// Tests
// ================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_adapter_fixtures() {
        // Test loading valid adapters
        let openai = valid_openai_adapter();
        assert_eq!(get_string_field(&openai, "id"), Some("openai-gpt4".to_string()));
        
        let claude = valid_claude_adapter();
        assert_eq!(get_string_field(&claude, "id"), Some("claude-3-opus".to_string()));
        
        // Test loading minimal adapter
        let minimal = minimal_adapter();
        assert!(has_field(&minimal, "id"));
    }

    #[test]
    fn test_load_character_fixtures() {
        // Test loading valid character
        let shizuku = valid_shizuku_character();
        assert_eq!(get_string_field(&shizuku, "id"), Some("shizuku".to_string()));
        
        // Test loading minimal character
        let minimal = valid_minimal_character();
        assert!(has_field(&minimal, "id"));
    }

    #[test]
    fn test_load_workflow_fixtures() {
        // Test loading workflows
        let greeting = simple_greeting_workflow();
        assert!(has_field(&greeting, "steps"));
        
        let complex = complex_chat_workflow();
        assert!(get_array_field(&complex, "steps").unwrap().len() > 3);
    }

    #[test]
    fn test_load_config_fixtures() {
        // Test loading configs
        let default_config = default_app_config();
        assert!(has_field(&default_config, "window"));
        assert!(has_field(&default_config, "character"));
        assert!(has_field(&default_config, "theme"));
        assert!(has_field(&default_config, "system"));
    }

    #[test]
    fn test_create_test_adapter() {
        let adapter = create_test_adapter("test-id", "Test Adapter", "soft");
        assert_eq!(get_string_field(&adapter, "id"), Some("test-id".to_string()));
        assert_eq!(get_string_field(&adapter, "name"), Some("Test Adapter".to_string()));
        assert_eq!(get_string_field(&adapter, "adapter_type"), Some("soft".to_string()));
    }

    #[test]
    fn test_create_test_character() {
        let character = create_test_character("test-char", "Test Character", "live2d");
        assert_eq!(get_string_field(&character, "id"), Some("test-char".to_string()));
        assert_eq!(get_string_field(&character, "type"), Some("live2d".to_string()));
    }

    #[test]
    fn test_create_test_workflow() {
        let workflow = create_test_workflow("test-wf", "Test Workflow", 3);
        assert_eq!(get_string_field(&workflow, "id"), Some("test-wf".to_string()));
        let steps = get_array_field(&workflow, "steps").unwrap();
        assert_eq!(steps.len(), 3);
    }

    #[test]
    fn test_fixture_validation_helpers() {
        let adapter = valid_openai_adapter();
        
        // Test has_field
        assert!(has_field(&adapter, "id"));
        assert!(has_field(&adapter, "name"));
        assert!(!has_field(&adapter, "nonexistent_field"));
        
        // Test get_string_field
        assert_eq!(get_string_field(&adapter, "id"), Some("openai-gpt4".to_string()));
        assert_eq!(get_string_field(&adapter, "nonexistent"), None);
        
        // Test get_bool_field
        assert_eq!(get_bool_field(&adapter, "enabled"), Some(true));
        
        // Test get_array_field
        assert!(get_array_field(&adapter, "tags").is_some());
        
        // Test get_object_field
        assert!(get_object_field(&adapter, "compatibility").is_some());
    }
}
