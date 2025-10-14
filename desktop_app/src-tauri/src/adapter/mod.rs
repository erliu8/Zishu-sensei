use tauri::AppHandle;

pub async fn init_adapter_system(_app: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }
pub async fn start_adapter_manager(_app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }
pub async fn cleanup_adapter_system() -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }


