/// 内存管理命令模块
/// 提供内存监控、清理、统计和优化的 Tauri 命令接口

use crate::utils::memory_manager::{
    MemoryCleanupResult, MemoryInfo, MemoryLeakInfo, MemoryManager, MemoryPoolStats,
    MemorySnapshot, MemoryThresholds,
};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

/// 内存管理器状态
pub struct MemoryManagerState {
    manager: Mutex<MemoryManager>,
}

impl MemoryManagerState {
    pub fn new() -> Self {
        Self {
            manager: Mutex::new(MemoryManager::new()),
        }
    }
}

/// 获取当前内存信息
#[tauri::command]
pub async fn get_memory_info(state: State<'_, MemoryManagerState>) -> Result<MemoryInfo, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_memory_info()
}

/// 注册内存池
#[tauri::command]
pub async fn register_memory_pool(
    name: String,
    capacity: usize,
    state: State<'_, MemoryManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.register_pool(name, capacity)
}

/// 更新内存池统计
#[tauri::command]
pub async fn update_memory_pool_stats(
    name: String,
    allocated_count: usize,
    total_bytes: u64,
    state: State<'_, MemoryManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.update_pool_stats(&name, allocated_count, total_bytes)
}

/// 获取所有内存池统计
#[tauri::command]
pub async fn get_memory_pool_stats(
    state: State<'_, MemoryManagerState>,
) -> Result<Vec<MemoryPoolStats>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_pool_stats()
}

/// 创建内存快照
#[tauri::command]
pub async fn create_memory_snapshot(
    state: State<'_, MemoryManagerState>,
) -> Result<MemorySnapshot, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.create_snapshot()
}

/// 获取内存快照历史
#[tauri::command]
pub async fn get_memory_snapshots(
    limit: usize,
    state: State<'_, MemoryManagerState>,
) -> Result<Vec<MemorySnapshot>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_snapshots(limit)
}

/// 检测内存泄漏
#[tauri::command]
pub async fn detect_memory_leaks(
    state: State<'_, MemoryManagerState>,
) -> Result<Vec<MemoryLeakInfo>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.detect_leaks()
}

/// 获取内存泄漏报告
#[tauri::command]
pub async fn get_memory_leak_reports(
    limit: usize,
    state: State<'_, MemoryManagerState>,
) -> Result<Vec<MemoryLeakInfo>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_leak_reports(limit)
}

/// 执行内存清理
#[tauri::command]
pub async fn cleanup_memory(
    state: State<'_, MemoryManagerState>,
) -> Result<MemoryCleanupResult, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.cleanup_memory()
}

/// 设置内存阈值
#[tauri::command]
pub async fn set_memory_thresholds(
    thresholds: MemoryThresholds,
    state: State<'_, MemoryManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.set_thresholds(thresholds)
}

/// 获取内存阈值
#[tauri::command]
pub async fn get_memory_thresholds(
    state: State<'_, MemoryManagerState>,
) -> Result<MemoryThresholds, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_thresholds()
}

/// 检查是否需要自动清理
#[tauri::command]
pub async fn should_auto_cleanup_memory(
    state: State<'_, MemoryManagerState>,
) -> Result<bool, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.should_auto_cleanup()
}

/// 获取内存状态
#[tauri::command]
pub async fn get_memory_status(
    state: State<'_, MemoryManagerState>,
) -> Result<String, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_memory_status()
}

/// 获取内存统计摘要
#[tauri::command]
pub async fn get_memory_summary(
    state: State<'_, MemoryManagerState>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let info = manager.get_memory_info()?;
    let pools = manager.get_pool_stats()?;
    let status = manager.get_memory_status()?;
    let thresholds = manager.get_thresholds()?;

    let mut summary = HashMap::new();
    summary.insert(
        "memory_info".to_string(),
        serde_json::to_value(info).unwrap(),
    );
    summary.insert(
        "pool_count".to_string(),
        serde_json::to_value(pools.len()).unwrap(),
    );
    summary.insert("status".to_string(), serde_json::to_value(status).unwrap());
    summary.insert(
        "thresholds".to_string(),
        serde_json::to_value(thresholds).unwrap(),
    );

    Ok(summary)
}

