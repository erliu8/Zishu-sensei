use std::sync::Arc;
use parking_lot::Mutex;
use tauri::AppHandle;

use crate::AppConfig;
use crate::workflow::{WorkflowRegistry, WorkflowEngine, WorkflowScheduler, EventTriggerManager, WebhookTriggerManager};

pub mod chat_state;
pub mod tray_state;

pub use chat_state::{ChatState, ChatSession, ModelConfig};
pub use tray_state::{
    TrayState, TrayIconState, RecentConversation, SystemResources,
    TrayNotification, NotificationType,
};

/// Global application state stored in Tauri managed state
pub struct AppState {
    pub config: Arc<Mutex<AppConfig>>,
    pub chat: ChatState,
    pub tray: Arc<TrayState>,
    pub workflow_registry: Arc<WorkflowRegistry>,
    pub workflow_engine: Arc<WorkflowEngine>,
    pub workflow_scheduler: Arc<WorkflowScheduler>,
    pub event_trigger_manager: Arc<EventTriggerManager>,
    pub webhook_trigger_manager: Arc<WebhookTriggerManager>,
}

impl AppState {
    /// Create a new application state. Loads default config for now.
    pub async fn new(app_handle: AppHandle) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let config = AppConfig::default();
        let chat = ChatState::new();
        let tray = Arc::new(TrayState::new());
        
        // Get database instance
        let db = crate::database::get_database()
            .ok_or("数据库未初始化")?;
        
        // Initialize workflow components
        let db_workflow_registry = Arc::new(db.workflow_registry.clone());
        let workflow_registry = Arc::new(WorkflowRegistry::new(db_workflow_registry));
        let workflow_engine = Arc::new(WorkflowEngine::new(app_handle.clone())?);
        let workflow_scheduler = Arc::new(WorkflowScheduler::new(
            workflow_engine.clone(),
        ));
        let event_trigger_manager = Arc::new(EventTriggerManager::new(
            app_handle.clone(),
            workflow_engine.clone(),
        ));
        let webhook_trigger_manager = Arc::new(WebhookTriggerManager::new(
            app_handle.clone(),
            workflow_engine.clone(),
        ));
        
        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            chat,
            tray,
            workflow_registry,
            workflow_engine,
            workflow_scheduler,
            event_trigger_manager,
            webhook_trigger_manager,
        })
    }
}

