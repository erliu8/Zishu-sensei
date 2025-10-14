use std::sync::Arc;
use parking_lot::Mutex;
use tauri::AppHandle;

use crate::AppConfig;

pub mod chat_state;

pub use chat_state::{ChatState, ChatSession, ModelConfig};

/// Global application state stored in Tauri managed state
pub struct AppState {
    pub config: Arc<Mutex<AppConfig>>,
    pub chat: ChatState,
}

impl AppState {
    /// Create a new application state. Loads default config for now.
    pub async fn new(_app_handle: AppHandle) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let config = AppConfig::default();
        let chat = ChatState::new();
        
        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            chat,
        })
    }
}

