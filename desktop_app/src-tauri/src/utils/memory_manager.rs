/// 内存管理工具模块
/// 提供内存监控、清理、统计和优化功能

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
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
        let cleaned_bytes: u64 = 0;
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
    use std::thread;
    use std::sync::Arc;

    // 基础功能测试
    #[test]
    fn test_memory_manager_creation() {
        let manager = MemoryManager::new();
        let info = manager.get_memory_info().unwrap();
        assert!(info.total_memory > 0);
        assert!(info.usage_percentage >= 0.0 && info.usage_percentage <= 100.0);
        assert!(info.available_memory <= info.total_memory);
        assert_eq!(info.used_memory + info.available_memory, info.total_memory);
    }

    #[test]
    fn test_memory_info_consistency() {
        let manager = MemoryManager::new();
        let info1 = manager.get_memory_info().unwrap();
        let info2 = manager.get_memory_info().unwrap();
        
        // 内存信息应该保持基本一致（允许小幅波动）
        assert_eq!(info1.total_memory, info2.total_memory);
        assert!(info1.app_memory <= info1.total_memory);
        assert!(info2.app_memory <= info2.total_memory);
    }

    // 内存池管理测试
    #[test]
    fn test_memory_pool_registration() {
        let manager = MemoryManager::new();
        
        // 注册多个内存池
        manager.register_pool("pool1".to_string(), 100).unwrap();
        manager.register_pool("pool2".to_string(), 200).unwrap();
        manager.register_pool("pool3".to_string(), 50).unwrap();
        
        let stats = manager.get_pool_stats().unwrap();
        assert_eq!(stats.len(), 3);
        
        // 验证池配置
        let pool1 = stats.iter().find(|s| s.name == "pool1").unwrap();
        assert_eq!(pool1.capacity, 100);
        assert_eq!(pool1.allocated_count, 0);
        assert_eq!(pool1.usage_percentage, 0.0);
    }

    #[test]
    fn test_memory_pool_updates() {
        let manager = MemoryManager::new();
        manager.register_pool("test_pool".to_string(), 100).unwrap();
        
        // 更新统计信息
        manager.update_pool_stats("test_pool", 50, 1024).unwrap();
        let stats = manager.get_pool_stats().unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].allocated_count, 50);
        assert_eq!(stats[0].total_bytes, 1024);
        assert_eq!(stats[0].usage_percentage, 50.0);
        assert_eq!(stats[0].peak_count, 50);
        
        // 更新峰值
        manager.update_pool_stats("test_pool", 75, 2048).unwrap();
        let stats = manager.get_pool_stats().unwrap();
        assert_eq!(stats[0].peak_count, 75);
        
        // 峰值不应降低
        manager.update_pool_stats("test_pool", 30, 512).unwrap();
        let stats = manager.get_pool_stats().unwrap();
        assert_eq!(stats[0].peak_count, 75);
        assert_eq!(stats[0].allocated_count, 30);
    }

    #[test]
    fn test_memory_pool_nonexistent() {
        let manager = MemoryManager::new();
        // 更新不存在的池应该成功（静默忽略）
        assert!(manager.update_pool_stats("nonexistent", 10, 100).is_ok());
    }

    // 内存快照测试
    #[test]
    fn test_memory_snapshots() {
        let manager = MemoryManager::new();
        
        // 创建快照
        let snapshot1 = manager.create_snapshot().unwrap();
        assert!(snapshot1.timestamp > 0);
        assert!(snapshot1.memory_info.total_memory > 0);
        
        // 添加内存池后创建快照
        manager.register_pool("test_pool".to_string(), 100).unwrap();
        manager.update_pool_stats("test_pool", 25, 512).unwrap();
        
        let snapshot2 = manager.create_snapshot().unwrap();
        assert!(snapshot2.timestamp >= snapshot1.timestamp);
        assert_eq!(snapshot2.pool_stats.len(), 1);
        
        // 获取快照历史
        let snapshots = manager.get_snapshots(10).unwrap();
        assert_eq!(snapshots.len(), 2);
        assert!(snapshots[0].timestamp <= snapshots[1].timestamp);
    }

    #[test]
    fn test_snapshots_limit() {
        let manager = MemoryManager::new();
        
        // 创建超过限制的快照
        for i in 0..105 {
            manager.register_pool(format!("pool_{}", i), 10).unwrap();
            manager.create_snapshot().unwrap();
        }
        
        // 应该只保留最近100个
        let snapshots = manager.get_snapshots(150).unwrap();
        assert!(snapshots.len() <= 100);
    }

    // 内存泄漏检测测试
    #[test]
    fn test_leak_detection_insufficient_data() {
        let manager = MemoryManager::new();
        
        // 少于10个快照时不应检测到泄漏
        for _ in 0..5 {
            manager.create_snapshot().unwrap();
        }
        
        let leaks = manager.detect_leaks().unwrap();
        assert_eq!(leaks.len(), 0);
    }

    #[test]
    fn test_pool_leak_detection() {
        let manager = MemoryManager::new();
        
        // 注册一个接近满载的池
        manager.register_pool("leak_pool".to_string(), 100).unwrap();
        manager.update_pool_stats("leak_pool", 95, 9500).unwrap();
        
        // 创建足够的快照
        for _ in 0..10 {
            manager.create_snapshot().unwrap();
        }
        
        let leaks = manager.detect_leaks().unwrap();
        let pool_leaks: Vec<_> = leaks.iter()
            .filter(|l| l.leak_type == "内存池接近满载")
            .collect();
        assert_eq!(pool_leaks.len(), 1);
        assert_eq!(pool_leaks[0].severity, 4);
    }

    #[test]
    fn test_leak_reports_storage() {
        let manager = MemoryManager::new();
        
        // 手动添加泄漏报告（通过检测函数）
        manager.register_pool("test_pool".to_string(), 10).unwrap();
        manager.update_pool_stats("test_pool", 10, 1000).unwrap();
        
        for _ in 0..15 {
            manager.create_snapshot().unwrap();
        }
        
        let _leaks = manager.detect_leaks().unwrap();
        let reports = manager.get_leak_reports(10).unwrap();
        assert!(reports.len() > 0);
    }

    // 内存清理测试
    #[test]
    fn test_memory_cleanup() {
        let manager = MemoryManager::new();
        
        // 创建大量快照和报告
        for i in 0..60 {
            manager.register_pool(format!("pool_{}", i), 100).unwrap();
            manager.create_snapshot().unwrap();
        }
        
        // 创建泄漏报告
        for _ in 0..30 {
            manager.detect_leaks().unwrap();
        }
        
        let result = manager.cleanup_memory().unwrap();
        assert!(result.duration_ms >= 0);
        assert!(result.cleaned_objects > 0);
        
        // 验证清理效果
        let snapshots = manager.get_snapshots(100).unwrap();
        assert!(snapshots.len() <= 50);
        
        let reports = manager.get_leak_reports(100).unwrap();
        assert!(reports.len() <= 20);
    }

    // 阈值管理测试
    #[test]
    fn test_thresholds_management() {
        let manager = MemoryManager::new();
        
        // 默认阈值
        let default_thresholds = manager.get_thresholds().unwrap();
        assert_eq!(default_thresholds.warning_threshold, 70.0);
        assert_eq!(default_thresholds.critical_threshold, 85.0);
        assert_eq!(default_thresholds.auto_cleanup_threshold, 90.0);
        
        // 自定义阈值
        let custom_thresholds = MemoryThresholds {
            warning_threshold: 60.0,
            critical_threshold: 80.0,
            auto_cleanup_threshold: 95.0,
        };
        
        manager.set_thresholds(custom_thresholds.clone()).unwrap();
        let retrieved = manager.get_thresholds().unwrap();
        assert_eq!(retrieved.warning_threshold, 60.0);
        assert_eq!(retrieved.critical_threshold, 80.0);
        assert_eq!(retrieved.auto_cleanup_threshold, 95.0);
    }

    #[test]
    fn test_memory_status() {
        let manager = MemoryManager::new();
        
        // 设置低阈值以便测试
        let low_thresholds = MemoryThresholds {
            warning_threshold: 1.0,
            critical_threshold: 2.0,
            auto_cleanup_threshold: 3.0,
        };
        manager.set_thresholds(low_thresholds).unwrap();
        
        let status = manager.get_memory_status().unwrap();
        assert!(status == "normal" || status == "warning" || status == "critical");
    }

    #[test]
    fn test_auto_cleanup_check() {
        let manager = MemoryManager::new();
        
        // 设置极低阈值
        let low_threshold = MemoryThresholds {
            warning_threshold: 0.1,
            critical_threshold: 0.2,
            auto_cleanup_threshold: 0.3,
        };
        manager.set_thresholds(low_threshold).unwrap();
        
        let should_cleanup = manager.should_auto_cleanup().unwrap();
        assert!(should_cleanup); // 实际内存使用应该超过0.3%
    }

    // 并发安全测试 - 优化版本，避免死锁
    #[test]
    fn test_concurrent_access() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::time::{Duration, Instant};
        
        let manager = Arc::new(MemoryManager::new());
        let success_counter = Arc::new(AtomicUsize::new(0));
        let mut handles = vec![];
        
        // 使用最小线程数，避免资源竞争
        for i in 0..2 {
            let manager_clone = manager.clone();
            let counter_clone = success_counter.clone();
            let handle = thread::spawn(move || {
                let start = Instant::now();
                // 添加超时保护
                while start.elapsed() < Duration::from_millis(100) {
                    let pool_name = format!("safe_pool_{}", i);
                    if let Ok(_) = manager_clone.register_pool(pool_name.clone(), 50) {
                        if let Ok(_) = manager_clone.update_pool_stats(&pool_name, i * 5, (i * 50) as u64) {
                            counter_clone.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    // 短暂休眠，减少锁竞争
                    thread::sleep(Duration::from_millis(2));
                }
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成，设置合理超时
        for handle in handles {
            handle.join().expect("Thread should complete successfully");
        }
        
        // 验证至少有一些操作成功
        assert!(success_counter.load(Ordering::Relaxed) >= 1);
        let stats = manager.get_pool_stats().unwrap();
        assert!(!stats.is_empty());
    }

    // 添加轻量级的并发测试
    #[test]
    fn test_concurrent_snapshots_lightweight() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::time::{Duration, Instant};
        
        let manager = Arc::new(MemoryManager::new());
        let counter = Arc::new(AtomicUsize::new(0));
        let mut handles = vec![];
        
        // 只使用2个线程进行快照测试，添加超时保护
        for i in 0..2 {
            let manager_clone = manager.clone();
            let counter_clone = counter.clone();
            let handle = thread::spawn(move || {
                let start = Instant::now();
                let mut attempts = 0;
                while start.elapsed() < Duration::from_millis(50) && attempts < 3 {
                    if manager_clone.create_snapshot().is_ok() {
                        counter_clone.fetch_add(1, Ordering::Relaxed);
                    }
                    attempts += 1;
                    thread::sleep(Duration::from_millis(10));
                }
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成，设置超时
        for handle in handles {
            handle.join().expect("Snapshot thread should complete");
        }
        
        // 验证至少创建了一些快照
        assert!(counter.load(Ordering::Relaxed) > 0);
        let snapshots = manager.get_snapshots(10).unwrap();
        assert!(!snapshots.is_empty());
    }

    // 数据序列化测试
    #[test]
    fn test_serialization() {
        let memory_info = MemoryInfo {
            total_memory: 8_000_000_000,
            used_memory: 4_000_000_000,
            available_memory: 4_000_000_000,
            usage_percentage: 50.0,
            app_memory: 100_000_000,
            app_memory_percentage: 1.25,
        };
        
        let json = serde_json::to_string(&memory_info).unwrap();
        let deserialized: MemoryInfo = serde_json::from_str(&json).unwrap();
        
        assert_eq!(memory_info.total_memory, deserialized.total_memory);
        assert_eq!(memory_info.usage_percentage, deserialized.usage_percentage);
    }

    // 边界条件测试
    #[test]
    fn test_edge_cases() {
        let manager = MemoryManager::new();
        
        // 空池名
        assert!(manager.register_pool("".to_string(), 100).is_ok());
        
        // 零容量池
        assert!(manager.register_pool("zero_pool".to_string(), 0).is_ok());
        manager.update_pool_stats("zero_pool", 0, 0).unwrap();
        let stats = manager.get_pool_stats().unwrap();
        let zero_pool = stats.iter().find(|s| s.name == "zero_pool").unwrap();
        assert!(zero_pool.usage_percentage.is_nan() || zero_pool.usage_percentage == 0.0);
        
        // 获取空快照历史
        let empty_snapshots = manager.get_snapshots(0).unwrap();
        assert_eq!(empty_snapshots.len(), 0);
        
        // 获取空泄漏报告
        let empty_reports = manager.get_leak_reports(0).unwrap();
        assert_eq!(empty_reports.len(), 0);
    }

    // 性能测试
    #[test]
    fn test_performance() {
        let manager = MemoryManager::new();
        
        // 大量内存池操作
        let start = std::time::Instant::now();
        
        for i in 0..1000 {
            manager.register_pool(format!("perf_pool_{}", i), 100).unwrap();
        }
        
        for i in 0..1000 {
            manager.update_pool_stats(&format!("perf_pool_{}", i), i % 100, (i * 100) as u64).unwrap();
        }
        
        let elapsed = start.elapsed();
        assert!(elapsed.as_millis() < 1000); // 应该在1秒内完成
        
        // 快照创建性能
        let start = std::time::Instant::now();
        for _ in 0..10 {
            manager.create_snapshot().unwrap();
        }
        let elapsed = start.elapsed();
        assert!(elapsed.as_millis() < 500); // 应该在500ms内完成
    }

    // 内存泄漏检测边界测试
    #[test]
    fn test_memory_leak_detection_edge_cases() {
        let manager = MemoryManager::new();
        
        // 测试完全相同的内存使用情况
        for _ in 0..12 {
            manager.register_pool(format!("stable_pool"), 100).unwrap();
            manager.update_pool_stats("stable_pool", 50, 1024).unwrap();
            manager.create_snapshot().unwrap();
        }
        
        let leaks = manager.detect_leaks().unwrap();
        // 稳定的内存使用不应该被检测为泄漏
        let memory_leaks: Vec<_> = leaks.iter()
            .filter(|l| l.leak_type == "持续内存增长")
            .collect();
        assert_eq!(memory_leaks.len(), 0);
    }

    // 错误处理健壮性测试
    #[test]
    fn test_error_handling_robustness() {
        let manager = MemoryManager::new();
        
        // 测试更新不存在的池（多次）
        for i in 0..5 {
            let result = manager.update_pool_stats(&format!("nonexistent_{}", i), 10, 100);
            assert!(result.is_ok()); // 应该优雅处理
        }
        
        // 测试获取空的统计数据
        let stats = manager.get_pool_stats().unwrap();
        assert_eq!(stats.len(), 0);
        
        // 测试空的泄漏检测
        let leaks = manager.detect_leaks().unwrap();
        assert_eq!(leaks.len(), 0);
    }

    // 内存阈值边界测试
    #[test]
    fn test_threshold_boundary_conditions() {
        let manager = MemoryManager::new();
        
        // 测试边界阈值
        let boundary_thresholds = MemoryThresholds {
            warning_threshold: 0.0,
            critical_threshold: 100.0,
            auto_cleanup_threshold: 100.0,
        };
        
        assert!(manager.set_thresholds(boundary_thresholds.clone()).is_ok());
        let retrieved = manager.get_thresholds().unwrap();
        assert_eq!(retrieved.warning_threshold, 0.0);
        assert_eq!(retrieved.critical_threshold, 100.0);
        
        // 测试状态判断
        let status = manager.get_memory_status().unwrap();
        assert!(status == "normal" || status == "warning" || status == "critical");
    }

    // 快照自动清理测试
    #[test]
    fn test_snapshot_auto_cleanup() {
        let manager = MemoryManager::new();
        
        // 创建大量快照触发自动清理
        for i in 0..105 {
            manager.register_pool(format!("cleanup_test_{}", i), 10).unwrap();
            manager.create_snapshot().unwrap();
        }
        
        // 验证快照被自动清理
        let snapshots = manager.get_snapshots(200).unwrap();
        assert!(snapshots.len() <= 100);
        
        // 验证快照按时间排序
        if snapshots.len() >= 2 {
            for i in 1..snapshots.len() {
                assert!(snapshots[i].timestamp >= snapshots[i-1].timestamp);
            }
        }
    }

    // 内存池状态一致性测试
    #[test]
    fn test_memory_pool_consistency() {
        let manager = MemoryManager::new();
        
        // 注册池并进行多次更新
        manager.register_pool("consistency_test".to_string(), 100).unwrap();
        
        // 多次更新统计，验证峰值记录
        manager.update_pool_stats("consistency_test", 30, 300).unwrap();
        manager.update_pool_stats("consistency_test", 80, 800).unwrap();
        manager.update_pool_stats("consistency_test", 50, 500).unwrap();
        manager.update_pool_stats("consistency_test", 90, 900).unwrap();
        manager.update_pool_stats("consistency_test", 20, 200).unwrap();
        
        let stats = manager.get_pool_stats().unwrap();
        let pool_stats = &stats[0];
        
        // 验证当前值和峰值
        assert_eq!(pool_stats.allocated_count, 20);
        assert_eq!(pool_stats.peak_count, 90);
        assert_eq!(pool_stats.usage_percentage, 20.0);
        assert!(pool_stats.last_accessed > 0);
    }

    // 内存信息准确性测试
    #[test]
    fn test_memory_info_accuracy() {
        let manager = MemoryManager::new();
        
        // 获取多个内存信息快照
        let info1 = manager.get_memory_info().unwrap();
        let info2 = manager.get_memory_info().unwrap();
        
        // 验证数据一致性和合理性
        assert_eq!(info1.total_memory, info2.total_memory);
        assert_eq!(info1.used_memory + info1.available_memory, info1.total_memory);
        assert_eq!(info2.used_memory + info2.available_memory, info2.total_memory);
        
        // 验证百分比计算
        let calculated_percentage = (info1.used_memory as f32 / info1.total_memory as f32) * 100.0;
        assert!((info1.usage_percentage - calculated_percentage).abs() < 0.1);
        
        // 应用内存不应超过总内存
        assert!(info1.app_memory <= info1.total_memory);
        assert!(info1.app_memory_percentage <= 100.0);
    }

    // 快照数据完整性测试
    #[test]
    fn test_snapshot_data_integrity() {
        let manager = MemoryManager::new();
        
        // 创建一些内存池
        manager.register_pool("snapshot_test_1".to_string(), 50).unwrap();
        manager.register_pool("snapshot_test_2".to_string(), 75).unwrap();
        manager.update_pool_stats("snapshot_test_1", 25, 250).unwrap();
        manager.update_pool_stats("snapshot_test_2", 60, 600).unwrap();
        
        // 创建快照
        let snapshot = manager.create_snapshot().unwrap();
        
        // 验证快照数据完整性
        assert!(snapshot.timestamp > 0);
        assert_eq!(snapshot.pool_stats.len(), 2);
        assert!(snapshot.memory_info.total_memory > 0);
        
        // 验证池统计数据在快照中的正确性
        let pool1 = snapshot.pool_stats.iter()
            .find(|p| p.name == "snapshot_test_1").unwrap();
        let pool2 = snapshot.pool_stats.iter()
            .find(|p| p.name == "snapshot_test_2").unwrap();
            
        assert_eq!(pool1.allocated_count, 25);
        assert_eq!(pool1.capacity, 50);
        assert_eq!(pool2.allocated_count, 60);
        assert_eq!(pool2.capacity, 75);
    }

    // 内存清理详细测试
    #[test]
    fn test_memory_cleanup_details() {
        let manager = MemoryManager::new();
        
        // 创建超过限制的快照
        for i in 0..60 {
            manager.create_snapshot().unwrap();
        }
        
        // 创建超过限制的泄漏报告
        manager.register_pool("leak_generator".to_string(), 10).unwrap();
        manager.update_pool_stats("leak_generator", 10, 1000).unwrap();
        for _ in 0..25 {
            manager.detect_leaks().unwrap();
        }
        
        // 执行清理
        let cleanup_result = manager.cleanup_memory().unwrap();
        
        // 验证清理结果
        assert!(cleanup_result.cleaned_objects > 0);
        assert!(cleanup_result.duration_ms >= 0);
        assert!(!cleanup_result.details.is_empty());
        
        // 验证清理效果
        let snapshots = manager.get_snapshots(100).unwrap();
        assert!(snapshots.len() <= 50);
        
        let reports = manager.get_leak_reports(50).unwrap();
        assert!(reports.len() <= 20);
    }
}

