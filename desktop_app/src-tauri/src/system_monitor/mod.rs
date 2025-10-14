use tauri::AppHandle;

pub async fn start_system_monitor(_app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }
pub async fn stop_system_monitor() -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }


