//! 数据清理管理器 (Simplified for PostgreSQL migration)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CleanupType {
    ChatHistory,
    TempFiles,
    Cache,
    Logs,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CleanupResult {
    pub items_deleted: usize,
    pub bytes_freed: u64,
}

pub struct DataCleanupManager {}

impl DataCleanupManager {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn cleanup(&self, _types: Vec<CleanupType>) -> Result<CleanupResult, String> {
        Ok(CleanupResult::default())
    }

    pub async fn schedule_cleanup(&self, _interval_hours: u64) -> Result<(), String> {
        Ok(())
    }
}

