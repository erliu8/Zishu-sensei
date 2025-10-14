use tauri::AppHandle;

pub async fn init_database(_app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }
pub async fn close_database() -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }


