/// 内存管理工具模块
/// 提供内存监控、清理、统计和优化功能

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use sysinfo::{System, SystemExt, ProcessExt, Pid};

/// 内存使用信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    /// 总内存（字节）
    pub total_memory: u64,
    /// 已用内存（字节）
    pub used_memory: u64,
    /// 可用内存（字节）
    pub available_memory: u64,
    /// 内存使用率（百分比）
    pub usage_percentage: f32,
    /// 应用内存使用（字节）
    pub app_memory: u64,
    /// 应用内存使用率（百分比）
    pub app_memory_percentage: f32,
}

/// 内存池统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryPoolStats {
    /// 池名称
    pub name: String,
    /// 已分配对象数量
    pub allocated_count: usize,
    /// 总容量
    pub capacity: usize,
    /// 使用率（百分比）
    pub usage_percentage: f32,
    /// 总内存占用（字节）
    pub total_bytes: u64,
    /// 峰值使用量
    pub peak_count: usize,
    /// 最后访问时间
    pub last_accessed: u64,
}

/// 内存泄漏检测项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryLeakInfo {
    /// 泄漏类型
    pub leak_type: String,
    /// 泄漏大小（字节）
    pub size: u64,
    /// 检测时间
    pub detected_at: u64,
    /// 严重程度（1-5）
    pub severity: u8,
    /// 位置信息
    pub location: String,
    /// 建议
    pub suggestion: String,
}

/// 内存清理结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryCleanupResult {
    /// 清理的内存大小（字节）
    pub cleaned_bytes: u64,
    /// 清理的对象数量
    pub cleaned_objects: usize,
    /// 清理耗时（毫秒）
    pub duration_ms: u64,
    /// 清理详情
    pub details: HashMap<String, u64>,
}

/// 内存快照
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySnapshot {
    /// 快照时间
    pub timestamp: u64,
    /// 内存信息
    pub memory_info: MemoryInfo,
    /// 内存池统计
    pub pool_stats: Vec<MemoryPoolStats>,
    /// 活跃对象计数
    pub active_objects: HashMap<String, usize>,
}

/// 内存阈值配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryThresholds {
    /// 警告阈值（百分比）
    pub warning_threshold: f32,
    /// 严重阈值（百分比）
    pub critical_threshold: f32,
    /// 自动清理阈值（百分比）
    pub auto_cleanup_threshold: f32,
}

impl Default for MemoryThresholds {
    fn default() -> Self {
        Self {
            warning_threshold: 70.0,
            critical_threshold: 85.0,
            auto_cleanup_threshold: 90.0,
        }
    }
}

/// 内存管理器
pub struct MemoryManager {
    system: Arc<Mutex<System>>,
    thresholds: Arc<Mutex<MemoryThresholds>>,
    snapshots: Arc<Mutex<Vec<MemorySnapshot>>>,
    memory_pools: Arc<Mutex<HashMap<String, MemoryPoolStats>>>,
    leak_reports: Arc<Mutex<Vec<MemoryLeakInfo>>>,
}

impl MemoryManager {
    /// 创建新的内存管理器
    pub fn new() -> Self {
        Self {
            system: Arc::new(Mutex::new(System::new_all())),
            thresholds: Arc::new(Mutex::new(MemoryThresholds::default())),
            snapshots: Arc::new(Mutex::new(Vec::new())),
            memory_pools: Arc::new(Mutex::new(HashMap::new())),
            leak_reports: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 获取当前内存信息
    pub fn get_memory_info(&self) -> Result<MemoryInfo, String> {
        let mut sys = self.system.lock().map_err(|e| e.to_string())?;
        sys.refresh_memory();
        sys.refresh_processes();

        let total = sys.total_memory();
        let available = sys.available_memory();
        let used = total - available;
        let usage_percentage = (used as f32 / total as f32) * 100.0;

        // 获取当前应用进程的内存使用
        let pid = Pid::from(std::process::id() as usize);
        let app_memory = if let Some(process) = sys.process(pid) {
            process.memory() * 1024 // 转换为字节
        } else {
            0
        };
        let app_memory_percentage = (app_memory as f32 / total as f32) * 100.0;

        Ok(MemoryInfo {
            total_memory: total,
            used_memory: used,
            available_memory: available,
            usage_percentage,
            app_memory,
            app_memory_percentage,
        })
    }

    /// 注册内存池
    pub fn register_pool(&self, name: String, capacity: usize) -> Result<(), String> {
        let mut pools = self.memory_pools.lock().map_err(|e| e.to_string())?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        pools.insert(
            name.clone(),
            MemoryPoolStats {
                name,
                allocated_count: 0,
                capacity,
                usage_percentage: 0.0,
                total_bytes: 0,
                peak_count: 0,
                last_accessed: now,
            },
        );

        Ok(())
    }

    /// 更新内存池统计
    pub fn update_pool_stats(
        &self,
        name: &str,
        allocated_count: usize,
        total_bytes: u64,
    ) -> Result<(), String> {
        let mut pools = self.memory_pools.lock().map_err(|e| e.to_string())?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(stats) = pools.get_mut(name) {
            stats.allocated_count = allocated_count;
            stats.total_bytes = total_bytes;
            stats.usage_percentage = (allocated_count as f32 / stats.capacity as f32) * 100.0;
            stats.peak_count = stats.peak_count.max(allocated_count);
            stats.last_accessed = now;
        }

        Ok(())
    }

    /// 获取所有内存池统计
    pub fn get_pool_stats(&self) -> Result<Vec<MemoryPoolStats>, String> {
        let pools = self.memory_pools.lock().map_err(|e| e.to_string())?;
        Ok(pools.values().cloned().collect())
    }

    /// 创建内存快照
    pub fn create_snapshot(&self) -> Result<MemorySnapshot, String> {
        let memory_info = self.get_memory_info()?;
        let pool_stats = self.get_pool_stats()?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let snapshot = MemorySnapshot {
            timestamp: now,
            memory_info,
            pool_stats,
            active_objects: HashMap::new(), // 可以由调用者填充
        };

        let mut snapshots = self.snapshots.lock().map_err(|e| e.to_string())?;
        snapshots.push(snapshot.clone());

        // 保留最近 100 个快照
        if snapshots.len() > 100 {
            snapshots.remove(0);
        }

        Ok(snapshot)
    }

    /// 获取内存快照历史
    pub fn get_snapshots(&self, limit: usize) -> Result<Vec<MemorySnapshot>, String> {
        let snapshots = self.snapshots.lock().map_err(|e| e.to_string())?;
        let start = if snapshots.len() > limit {
            snapshots.len() - limit
        } else {
            0
        };
        Ok(snapshots[start..].to_vec())
    }

    /// 检测内存泄漏
    pub fn detect_leaks(&self) -> Result<Vec<MemoryLeakInfo>, String> {
        let mut leaks = Vec::new();
        let snapshots = self.snapshots.lock().map_err(|e| e.to_string())?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // 如果快照少于 10 个，无法进行泄漏检测
        if snapshots.len() < 10 {
            return Ok(leaks);
        }

        // 获取最近 10 个快照
        let recent_snapshots = &snapshots[snapshots.len() - 10..];

        // 检查内存持续增长
        let mut memory_trend = Vec::new();
        for snapshot in recent_snapshots {
            memory_trend.push(snapshot.memory_info.app_memory);
        }

        // 计算增长率
        let mut continuous_growth = true;
        for i in 1..memory_trend.len() {
            if memory_trend[i] <= memory_trend[i - 1] {
                continuous_growth = false;
                break;
            }
        }

        if continuous_growth {
            let growth = memory_trend.last().unwrap() - memory_trend.first().unwrap();
            if growth > 10 * 1024 * 1024 {
                // 增长超过 10MB
                leaks.push(MemoryLeakInfo {
                    leak_type: "持续内存增长".to_string(),
                    size: growth,
                    detected_at: now,
                    severity: 3,
                    location: "全局".to_string(),
                    suggestion: "应用内存持续增长，可能存在未释放的资源".to_string(),
                });
            }
        }

        // 检查内存池泄漏
        let pools = self.memory_pools.lock().map_err(|e| e.to_string())?;
        for (name, stats) in pools.iter() {
            if stats.usage_percentage > 90.0 {
                leaks.push(MemoryLeakInfo {
                    leak_type: "内存池接近满载".to_string(),
                    size: stats.total_bytes,
                    detected_at: now,
                    severity: 4,
                    location: format!("内存池: {}", name),
                    suggestion: "内存池使用率超过 90%，建议增加容量或清理未使用对象".to_string(),
                });
            }
        }

        // 保存泄漏报告
        let mut reports = self.leak_reports.lock().map_err(|e| e.to_string())?;
        reports.extend(leaks.clone());

        // 保留最近 50 个报告
        let reports_len = reports.len();
        if reports_len > 50 {
            reports.drain(0..reports_len - 50);
        }

        Ok(leaks)
    }

    /// 获取泄漏报告
    pub fn get_leak_reports(&self, limit: usize) -> Result<Vec<MemoryLeakInfo>, String> {
        let reports = self.leak_reports.lock().map_err(|e| e.to_string())?;
        let start = if reports.len() > limit {
            reports.len() - limit
        } else {
            0
        };
        Ok(reports[start..].to_vec())
    }

    /// 执行内存清理
    pub fn cleanup_memory(&self) -> Result<MemoryCleanupResult, String> {
        let start = SystemTime::now();
        let mut cleaned_bytes: u64 = 0;
        let mut cleaned_objects: usize = 0;
        let mut details = HashMap::new();

        // 强制垃圾回收（在实际应用中，这里会调用各个模块的清理函数）
        // 这里提供一个框架，具体实现需要各模块配合

        // 1. 清理过期的快照
        {
            let mut snapshots = self.snapshots.lock().map_err(|e| e.to_string())?;
            let old_count = snapshots.len();
            let snapshots_len = snapshots.len();
            if snapshots_len > 50 {
                snapshots.drain(0..snapshots_len - 50);
                let new_count = snapshots.len();
                cleaned_objects += old_count - new_count;
                details.insert("snapshots_cleaned".to_string(), (old_count - new_count) as u64);
            }
        }

        // 2. 清理旧的泄漏报告
        {
            let mut reports = self.leak_reports.lock().map_err(|e| e.to_string())?;
            let old_count = reports.len();
            let reports_len = reports.len();
            if reports_len > 20 {
                reports.drain(0..reports_len - 20);
                let new_count = reports.len();
                cleaned_objects += old_count - new_count;
                details.insert("leak_reports_cleaned".to_string(), (old_count - new_count) as u64);
            }
        }

        let duration = SystemTime::now()
            .duration_since(start)
            .unwrap()
            .as_millis() as u64;

        Ok(MemoryCleanupResult {
            cleaned_bytes,
            cleaned_objects,
            duration_ms: duration,
            details,
        })
    }

    /// 设置内存阈值
    pub fn set_thresholds(&self, thresholds: MemoryThresholds) -> Result<(), String> {
        let mut th = self.thresholds.lock().map_err(|e| e.to_string())?;
        *th = thresholds;
        Ok(())
    }

    /// 获取内存阈值
    pub fn get_thresholds(&self) -> Result<MemoryThresholds, String> {
        let th = self.thresholds.lock().map_err(|e| e.to_string())?;
        Ok(th.clone())
    }

    /// 检查是否需要自动清理
    pub fn should_auto_cleanup(&self) -> Result<bool, String> {
        let info = self.get_memory_info()?;
        let thresholds = self.get_thresholds()?;
        Ok(info.usage_percentage >= thresholds.auto_cleanup_threshold)
    }

    /// 获取内存状态
    pub fn get_memory_status(&self) -> Result<String, String> {
        let info = self.get_memory_info()?;
        let thresholds = self.get_thresholds()?;

        if info.usage_percentage >= thresholds.critical_threshold {
            Ok("critical".to_string())
        } else if info.usage_percentage >= thresholds.warning_threshold {
            Ok("warning".to_string())
        } else {
            Ok("normal".to_string())
        }
    }
}

impl Default for MemoryManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_manager() {
        let manager = MemoryManager::new();
        let info = manager.get_memory_info().unwrap();
        assert!(info.total_memory > 0);
        assert!(info.usage_percentage >= 0.0 && info.usage_percentage <= 100.0);
    }

    #[test]
    fn test_memory_pool() {
        let manager = MemoryManager::new();
        manager.register_pool("test_pool".to_string(), 100).unwrap();
        manager.update_pool_stats("test_pool", 50, 1024).unwrap();
        let stats = manager.get_pool_stats().unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].allocated_count, 50);
    }
}

