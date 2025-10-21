// tests/unit/utils/memory_manager_test.rs
//! 内存管理器测试
//!
//! 测试内存监控、统计、清理和泄漏检测功能

use zishu_sensei::utils::memory_manager::*;
use std::collections::HashMap;

// ========================================
// 内存管理器创建测试
// ========================================

mod manager_creation {
    use super::*;

    #[test]
    fn test_create_memory_manager() {
        // ========== Act ==========
        let manager = MemoryManager::new();

        // ========== Assert ==========
        // 应该能够成功创建
        assert!(manager.get_memory_info().is_ok());
    }

    #[test]
    fn test_memory_manager_default() {
        // ========== Act ==========
        let manager = MemoryManager::default();

        // ========== Assert ==========
        assert!(manager.get_memory_info().is_ok());
    }
}

// ========================================
// 内存信息获取测试
// ========================================

mod memory_info {
    use super::*;

    #[test]
    fn test_get_memory_info_success() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let info = manager.get_memory_info().unwrap();

        // ========== Assert ==========
        assert!(info.total_memory > 0);
        assert!(info.available_memory > 0);
        assert!(info.used_memory > 0);
        assert!(info.usage_percentage >= 0.0);
        assert!(info.usage_percentage <= 100.0);
        assert_eq!(
            info.total_memory,
            info.used_memory + info.available_memory
        );
    }

    #[test]
    fn test_get_memory_info_app_memory() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let info = manager.get_memory_info().unwrap();

        // ========== Assert ==========
        assert!(info.app_memory > 0); // 当前进程应该使用了一些内存
        assert!(info.app_memory_percentage >= 0.0);
        assert!(info.app_memory_percentage <= 100.0);
        assert!(info.app_memory <= info.total_memory);
    }

    #[test]
    fn test_get_memory_info_consistency() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let info1 = manager.get_memory_info().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(100));
        let info2 = manager.get_memory_info().unwrap();

        // ========== Assert ==========
        // 总内存应该保持不变
        assert_eq!(info1.total_memory, info2.total_memory);
        
        // 其他值可能略有变化，但应该在合理范围内
        assert!(info2.app_memory > 0);
    }

    #[test]
    fn test_memory_info_percentage_calculation() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let info = manager.get_memory_info().unwrap();

        // ========== Assert ==========
        let calculated_percentage = (info.used_memory as f32 / info.total_memory as f32) * 100.0;
        assert!((info.usage_percentage - calculated_percentage).abs() < 1.0);
    }
}

// ========================================
// 内存池管理测试
// ========================================

mod memory_pool {
    use super::*;

    #[test]
    fn test_register_pool_success() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_name = "test_pool".to_string();
        let capacity = 100;

        // ========== Act ==========
        let result = manager.register_pool(pool_name.clone(), capacity);

        // ========== Assert ==========
        assert!(result.is_ok());
        
        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools.len(), 1);
        assert_eq!(pools[0].name, pool_name);
        assert_eq!(pools[0].capacity, capacity);
    }

    #[test]
    fn test_register_multiple_pools() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_names = vec!["pool1", "pool2", "pool3"];

        // ========== Act ==========
        for (i, name) in pool_names.iter().enumerate() {
            manager.register_pool(name.to_string(), (i + 1) * 50).unwrap();
        }

        // ========== Assert ==========
        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools.len(), 3);
    }

    #[test]
    fn test_update_pool_stats() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_name = "test_pool";
        manager.register_pool(pool_name.to_string(), 100).unwrap();

        // ========== Act ==========
        manager.update_pool_stats(pool_name, 50, 1024).unwrap();

        // ========== Assert ==========
        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools[0].allocated_count, 50);
        assert_eq!(pools[0].total_bytes, 1024);
        assert_eq!(pools[0].usage_percentage, 50.0);
    }

    #[test]
    fn test_pool_peak_tracking() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_name = "test_pool";
        manager.register_pool(pool_name.to_string(), 100).unwrap();

        // ========== Act ==========
        manager.update_pool_stats(pool_name, 60, 2048).unwrap();
        manager.update_pool_stats(pool_name, 40, 1024).unwrap();
        manager.update_pool_stats(pool_name, 80, 3072).unwrap();

        // ========== Assert ==========
        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools[0].peak_count, 80);
    }

    #[test]
    fn test_pool_usage_percentage_calculation() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_name = "test_pool";
        manager.register_pool(pool_name.to_string(), 200).unwrap();

        // ========== Act ==========
        manager.update_pool_stats(pool_name, 50, 1024).unwrap();

        // ========== Assert ==========
        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools[0].usage_percentage, 25.0); // 50/200 = 25%
    }

    #[test]
    fn test_update_nonexistent_pool_silently_succeeds() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let result = manager.update_pool_stats("nonexistent", 10, 100);

        // ========== Assert ==========
        // 应该成功，但不会有任何效果
        assert!(result.is_ok());
    }

    #[test]
    fn test_pool_last_accessed_timestamp() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_name = "test_pool";
        manager.register_pool(pool_name.to_string(), 100).unwrap();

        let before = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // ========== Act ==========
        manager.update_pool_stats(pool_name, 10, 100).unwrap();

        // ========== Assert ==========
        let pools = manager.get_pool_stats().unwrap();
        assert!(pools[0].last_accessed >= before);
    }
}

// ========================================
// 内存快照测试
// ========================================

mod memory_snapshot {
    use super::*;

    #[test]
    fn test_create_snapshot_success() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let snapshot = manager.create_snapshot().unwrap();

        // ========== Assert ==========
        assert!(snapshot.timestamp > 0);
        assert!(snapshot.memory_info.total_memory > 0);
    }

    #[test]
    fn test_snapshot_includes_pool_stats() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        manager.register_pool("pool1".to_string(), 50).unwrap();
        manager.register_pool("pool2".to_string(), 100).unwrap();

        // ========== Act ==========
        let snapshot = manager.create_snapshot().unwrap();

        // ========== Assert ==========
        assert_eq!(snapshot.pool_stats.len(), 2);
    }

    #[test]
    fn test_get_snapshots_with_limit() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        
        // 创建多个快照
        for _ in 0..5 {
            manager.create_snapshot().unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // ========== Act ==========
        let snapshots = manager.get_snapshots(3).unwrap();

        // ========== Assert ==========
        assert_eq!(snapshots.len(), 3);
        
        // 应该返回最新的3个
        for i in 1..snapshots.len() {
            assert!(snapshots[i-1].timestamp <= snapshots[i].timestamp);
        }
    }

    #[test]
    fn test_snapshots_are_limited_to_100() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        // 创建超过100个快照
        for _ in 0..150 {
            manager.create_snapshot().unwrap();
        }

        // ========== Assert ==========
        let snapshots = manager.get_snapshots(200).unwrap();
        assert!(snapshots.len() <= 100);
    }

    #[test]
    fn test_snapshot_timestamps_are_ascending() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        for _ in 0..5 {
            manager.create_snapshot().unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // ========== Assert ==========
        let snapshots = manager.get_snapshots(10).unwrap();
        for i in 1..snapshots.len() {
            assert!(snapshots[i].timestamp >= snapshots[i-1].timestamp);
        }
    }
}

// ========================================
// 内存泄漏检测测试
// ========================================

mod leak_detection {
    use super::*;

    #[test]
    fn test_detect_leaks_with_insufficient_snapshots() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        
        // 只创建几个快照
        for _ in 0..5 {
            manager.create_snapshot().unwrap();
        }

        // ========== Act ==========
        let leaks = manager.detect_leaks().unwrap();

        // ========== Assert ==========
        // 快照不足时，应该返回空列表
        assert_eq!(leaks.len(), 0);
    }

    #[test]
    fn test_detect_leaks_basic_check() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        
        // 创建足够的快照
        for _ in 0..10 {
            manager.create_snapshot().unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // ========== Act ==========
        let result = manager.detect_leaks();

        // ========== Assert ==========
        assert!(result.is_ok());
        // 泄漏检测可能检测到也可能检测不到，但不应该失败
    }

    #[test]
    fn test_detect_pool_leaks() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        manager.register_pool("test_pool".to_string(), 100).unwrap();
        
        // 创建快照
        for _ in 0..10 {
            manager.create_snapshot().unwrap();
        }

        // 更新池使用率到很高
        manager.update_pool_stats("test_pool", 95, 10000).unwrap();
        
        // ========== Act ==========
        let leaks = manager.detect_leaks().unwrap();

        // ========== Assert ==========
        // 应该检测到池使用率过高
        let pool_leaks: Vec<_> = leaks.iter()
            .filter(|l| l.leak_type == "内存池接近满载")
            .collect();
        assert!(pool_leaks.len() > 0);
    }

    #[test]
    fn test_leak_reports_are_limited_to_50() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        
        // 创建足够的快照并多次检测泄漏
        for i in 0..60 {
            for _ in 0..10 {
                manager.create_snapshot().unwrap();
            }
            manager.detect_leaks().unwrap();
        }

        // ========== Act ==========
        let reports = manager.get_leak_reports(100).unwrap();

        // ========== Assert ==========
        assert!(reports.len() <= 50);
    }

    #[test]
    fn test_get_leak_reports_with_limit() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        manager.register_pool("pool1".to_string(), 100).unwrap();
        manager.update_pool_stats("pool1", 95, 10000).unwrap();
        
        for _ in 0..10 {
            manager.create_snapshot().unwrap();
        }
        
        // 触发几次泄漏检测
        for _ in 0..5 {
            manager.detect_leaks().unwrap();
        }

        // ========== Act ==========
        let reports = manager.get_leak_reports(3).unwrap();

        // ========== Assert ==========
        assert!(reports.len() <= 3);
    }
}

// ========================================
// 内存清理测试
// ========================================

mod memory_cleanup {
    use super::*;

    #[test]
    fn test_cleanup_memory_success() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let result = manager.cleanup_memory();

        // ========== Assert ==========
        assert!(result.is_ok());
        let cleanup_result = result.unwrap();
        assert!(cleanup_result.duration_ms >= 0);
    }

    #[test]
    fn test_cleanup_removes_old_snapshots() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        
        // 创建大量快照
        for _ in 0..100 {
            manager.create_snapshot().unwrap();
        }

        // ========== Act ==========
        let cleanup_result = manager.cleanup_memory().unwrap();

        // ========== Assert ==========
        // 应该清理了一些快照
        let snapshots = manager.get_snapshots(200).unwrap();
        assert!(snapshots.len() <= 50);
        
        // 清理结果应该反映这一点
        if let Some(count) = cleanup_result.details.get("snapshots_cleaned") {
            assert!(*count > 0);
        }
    }

    #[test]
    fn test_cleanup_removes_old_leak_reports() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        manager.register_pool("pool".to_string(), 100).unwrap();
        manager.update_pool_stats("pool", 95, 10000).unwrap();
        
        // 创建大量泄漏报告
        for i in 0..30 {
            for _ in 0..10 {
                manager.create_snapshot().unwrap();
            }
            manager.detect_leaks().unwrap();
        }

        // ========== Act ==========
        manager.cleanup_memory().unwrap();

        // ========== Assert ==========
        let reports = manager.get_leak_reports(100).unwrap();
        assert!(reports.len() <= 20);
    }

    #[test]
    fn test_cleanup_performance() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        
        for _ in 0..100 {
            manager.create_snapshot().unwrap();
        }

        // ========== Act ==========
        let result = manager.cleanup_memory().unwrap();

        // ========== Assert ==========
        // 清理操作应该很快
        assert!(result.duration_ms < 1000);
    }
}

// ========================================
// 内存阈值测试
// ========================================

mod memory_thresholds {
    use super::*;

    #[test]
    fn test_default_thresholds() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let thresholds = manager.get_thresholds().unwrap();

        // ========== Assert ==========
        assert_eq!(thresholds.warning_threshold, 70.0);
        assert_eq!(thresholds.critical_threshold, 85.0);
        assert_eq!(thresholds.auto_cleanup_threshold, 90.0);
    }

    #[test]
    fn test_set_custom_thresholds() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let custom_thresholds = MemoryThresholds {
            warning_threshold: 60.0,
            critical_threshold: 80.0,
            auto_cleanup_threshold: 85.0,
        };

        // ========== Act ==========
        manager.set_thresholds(custom_thresholds.clone()).unwrap();
        let thresholds = manager.get_thresholds().unwrap();

        // ========== Assert ==========
        assert_eq!(thresholds.warning_threshold, 60.0);
        assert_eq!(thresholds.critical_threshold, 80.0);
        assert_eq!(thresholds.auto_cleanup_threshold, 85.0);
    }

    #[test]
    fn test_should_auto_cleanup() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let should_cleanup = manager.should_auto_cleanup().unwrap();

        // ========== Assert ==========
        // 结果取决于当前内存使用情况
        // 只验证不会出错
        assert!(should_cleanup == true || should_cleanup == false);
    }

    #[test]
    fn test_get_memory_status() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let status = manager.get_memory_status().unwrap();

        // ========== Assert ==========
        // 应该返回三个状态之一
        assert!(
            status == "normal" || 
            status == "warning" || 
            status == "critical"
        );
    }

    #[test]
    fn test_memory_status_reflects_usage() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let info = manager.get_memory_info().unwrap();
        let thresholds = manager.get_thresholds().unwrap();

        // ========== Act ==========
        let status = manager.get_memory_status().unwrap();

        // ========== Assert ==========
        if info.usage_percentage >= thresholds.critical_threshold {
            assert_eq!(status, "critical");
        } else if info.usage_percentage >= thresholds.warning_threshold {
            assert_eq!(status, "warning");
        } else {
            assert_eq!(status, "normal");
        }
    }
}

// ========================================
// 边界条件测试
// ========================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_register_pool_with_zero_capacity() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let result = manager.register_pool("zero_pool".to_string(), 0);

        // ========== Assert ==========
        // 应该能够注册，但使用率计算可能有问题
        assert!(result.is_ok());
    }

    #[test]
    fn test_update_pool_stats_with_zero_count() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        manager.register_pool("test_pool".to_string(), 100).unwrap();

        // ========== Act ==========
        manager.update_pool_stats("test_pool", 0, 0).unwrap();

        // ========== Assert ==========
        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools[0].allocated_count, 0);
        assert_eq!(pools[0].usage_percentage, 0.0);
    }

    #[test]
    fn test_get_snapshots_with_zero_limit() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        manager.create_snapshot().unwrap();

        // ========== Act ==========
        let snapshots = manager.get_snapshots(0).unwrap();

        // ========== Assert ==========
        assert_eq!(snapshots.len(), 0);
    }

    #[test]
    fn test_get_leak_reports_with_zero_limit() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let reports = manager.get_leak_reports(0).unwrap();

        // ========== Assert ==========
        assert_eq!(reports.len(), 0);
    }

    #[test]
    fn test_pool_name_with_special_characters() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_name = "pool-123_test@2024".to_string();

        // ========== Act ==========
        let result = manager.register_pool(pool_name.clone(), 100);

        // ========== Assert ==========
        assert!(result.is_ok());
        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools[0].name, pool_name);
    }

    #[test]
    fn test_pool_name_with_unicode() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();
        let pool_name = "内存池测试🔧".to_string();

        // ========== Act ==========
        let result = manager.register_pool(pool_name.clone(), 100);

        // ========== Assert ==========
        assert!(result.is_ok());
    }

    #[test]
    fn test_very_large_capacity() {
        // ========== Arrange ==========
        let manager = MemoryManager::new();

        // ========== Act ==========
        let result = manager.register_pool("large_pool".to_string(), usize::MAX);

        // ========== Assert ==========
        assert!(result.is_ok());
    }
}

// ========================================
// 并发测试
// ========================================

mod concurrency {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn test_concurrent_pool_operations() {
        // ========== Arrange ==========
        let manager = Arc::new(MemoryManager::new());
        let num_threads = 10;
        let mut handles = vec![];

        // ========== Act ==========
        for i in 0..num_threads {
            let manager_clone = Arc::clone(&manager);
            let handle = thread::spawn(move || {
                let pool_name = format!("pool_{}", i);
                manager_clone.register_pool(pool_name.clone(), 100).unwrap();
                manager_clone.update_pool_stats(&pool_name, 50, 1024).unwrap();
            });
            handles.push(handle);
        }

        // ========== Assert ==========
        for handle in handles {
            handle.join().unwrap();
        }

        let pools = manager.get_pool_stats().unwrap();
        assert_eq!(pools.len(), num_threads);
    }

    #[test]
    fn test_concurrent_snapshot_creation() {
        // ========== Arrange ==========
        let manager = Arc::new(MemoryManager::new());
        let num_threads = 5;
        let mut handles = vec![];

        // ========== Act ==========
        for _ in 0..num_threads {
            let manager_clone = Arc::clone(&manager);
            let handle = thread::spawn(move || {
                for _ in 0..5 {
                    manager_clone.create_snapshot().unwrap();
                }
            });
            handles.push(handle);
        }

        // ========== Assert ==========
        for handle in handles {
            handle.join().unwrap();
        }

        let snapshots = manager.get_snapshots(100).unwrap();
        assert!(snapshots.len() > 0);
    }
}

