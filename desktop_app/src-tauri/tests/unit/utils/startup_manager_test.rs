// 测试启动管理功能
use zishu_sensei::utils::startup_manager::*;
use std::collections::HashMap;

// ========== StartupPhase 测试 ==========

mod startup_phase {
    use super::*;

    #[test]
    fn test_phase_names() {
        assert_eq!(StartupPhase::AppInitialization.name(), "应用初始化");
        assert_eq!(StartupPhase::DatabaseConnection.name(), "数据库连接");
        assert_eq!(StartupPhase::ConfigLoading.name(), "配置加载");
        assert_eq!(StartupPhase::ThemeLoading.name(), "主题加载");
        assert_eq!(StartupPhase::AdapterLoading.name(), "适配器加载");
        assert_eq!(StartupPhase::Live2DModelLoading.name(), "Live2D模型加载");
        assert_eq!(StartupPhase::WindowCreation.name(), "窗口创建");
        assert_eq!(StartupPhase::FrontendInitialization.name(), "前端初始化");
        assert_eq!(StartupPhase::SystemServices.name(), "系统服务启动");
        assert_eq!(StartupPhase::NetworkConnection.name(), "网络连接检查");
        assert_eq!(StartupPhase::Completed.name(), "启动完成");
    }

    #[test]
    fn test_phase_weights() {
        assert_eq!(StartupPhase::AppInitialization.weight(), 10);
        assert_eq!(StartupPhase::DatabaseConnection.weight(), 15);
        assert_eq!(StartupPhase::ConfigLoading.weight(), 8);
        assert_eq!(StartupPhase::ThemeLoading.weight(), 5);
        assert_eq!(StartupPhase::AdapterLoading.weight(), 12);
        assert_eq!(StartupPhase::Live2DModelLoading.weight(), 20);
        assert_eq!(StartupPhase::WindowCreation.weight(), 8);
        assert_eq!(StartupPhase::FrontendInitialization.weight(), 15);
        assert_eq!(StartupPhase::SystemServices.weight(), 5);
        assert_eq!(StartupPhase::NetworkConnection.weight(), 2);
        assert_eq!(StartupPhase::Completed.weight(), 0);
    }

    #[test]
    fn test_all_phases() {
        let phases = StartupPhase::all_phases();
        
        assert_eq!(phases.len(), 11);
        assert_eq!(phases[0], StartupPhase::AppInitialization);
        assert_eq!(phases[10], StartupPhase::Completed);
    }

    #[test]
    fn test_phase_ordering() {
        let phases = StartupPhase::all_phases();
        
        // 验证阶段顺序是合理的
        assert_eq!(phases[0], StartupPhase::AppInitialization);
        assert_eq!(phases[1], StartupPhase::DatabaseConnection);
        assert_eq!(phases[2], StartupPhase::ConfigLoading);
        assert_eq!(phases[phases.len() - 1], StartupPhase::Completed);
    }

    #[test]
    fn test_total_weight() {
        let phases = StartupPhase::all_phases();
        let total_weight: u32 = phases.iter().map(|p| p.weight() as u32).sum();
        
        assert!(total_weight > 0);
        assert_eq!(total_weight, 100); // 总权重应该是100
    }
}

// ========== PhaseResult 测试 ==========

mod phase_result {
    use super::*;

    #[test]
    fn test_phase_result_new() {
        let result = PhaseResult::new(StartupPhase::AppInitialization);
        
        assert_eq!(result.phase, StartupPhase::AppInitialization);
        assert!(result.start_time > 0);
        assert!(result.end_time.is_none());
        assert!(result.duration.is_none());
        assert_eq!(result.success, false);
        assert!(result.error.is_none());
        assert!(result.metrics.is_empty());
    }

    #[test]
    fn test_phase_result_finish_success() {
        let result = PhaseResult::new(StartupPhase::ConfigLoading);
        let mut metrics = HashMap::new();
        metrics.insert("items_loaded".to_string(), 10.0);
        
        let finished = result.finish_success(metrics.clone());
        
        assert_eq!(finished.success, true);
        assert!(finished.end_time.is_some());
        assert!(finished.duration.is_some());
        assert_eq!(finished.metrics.get("items_loaded"), Some(&10.0));
    }

    #[test]
    fn test_phase_result_finish_error() {
        let result = PhaseResult::new(StartupPhase::DatabaseConnection);
        let error_msg = "Connection failed".to_string();
        
        let finished = result.finish_error(error_msg.clone());
        
        assert_eq!(finished.success, false);
        assert!(finished.end_time.is_some());
        assert!(finished.duration.is_some());
        assert_eq!(finished.error, Some(error_msg));
    }

    #[test]
    fn test_phase_result_duration_calculation() {
        let result = PhaseResult::new(StartupPhase::ThemeLoading);
        
        // 模拟一些延迟
        std::thread::sleep(std::time::Duration::from_millis(10));
        
        let finished = result.finish_success(HashMap::new());
        
        assert!(finished.duration.is_some());
        assert!(finished.duration.unwrap() >= 10);
    }

    #[test]
    fn test_phase_result_serialization() {
        let mut result = PhaseResult::new(StartupPhase::AdapterLoading);
        result.success = true;
        
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: PhaseResult = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.phase, StartupPhase::AdapterLoading);
        assert_eq!(deserialized.success, true);
    }
}

// ========== StartupConfig 测试 ==========

mod startup_config {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = StartupConfig::default();
        
        assert_eq!(config.enable_preloading, true);
        assert_eq!(config.max_parallel_loading, 4);
        assert_eq!(config.timeout_ms, 30000);
        assert_eq!(config.enable_performance_monitoring, true);
        assert_eq!(config.enable_startup_cache, true);
        assert!(config.skip_optional_phases.is_empty());
        assert_eq!(config.deferred_phases.len(), 2);
    }

    #[test]
    fn test_custom_config() {
        let config = StartupConfig {
            enable_preloading: false,
            max_parallel_loading: 8,
            timeout_ms: 60000,
            enable_performance_monitoring: false,
            enable_startup_cache: false,
            skip_optional_phases: vec![StartupPhase::NetworkConnection],
            deferred_phases: vec![],
        };
        
        assert_eq!(config.enable_preloading, false);
        assert_eq!(config.max_parallel_loading, 8);
        assert_eq!(config.skip_optional_phases.len(), 1);
        assert!(config.deferred_phases.is_empty());
    }

    #[test]
    fn test_config_serialization() {
        let config = StartupConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: StartupConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.enable_preloading, config.enable_preloading);
        assert_eq!(deserialized.max_parallel_loading, config.max_parallel_loading);
    }
}

// ========== StartupStats 测试 ==========

mod startup_stats {
    use super::*;

    #[test]
    fn test_startup_stats_structure() {
        let stats = StartupStats {
            total_duration: 5000,
            phase_count: 11,
            success_count: 10,
            error_count: 1,
            slowest_phase: Some(StartupPhase::Live2DModelLoading),
            fastest_phase: Some(StartupPhase::NetworkConnection),
            memory_peak: 1024 * 1024 * 100,
            cpu_usage_avg: 25.5,
            improvement_suggestions: vec!["Suggestion 1".to_string()],
        };
        
        assert_eq!(stats.total_duration, 5000);
        assert_eq!(stats.phase_count, 11);
        assert_eq!(stats.success_count, 10);
        assert_eq!(stats.error_count, 1);
    }

    #[test]
    fn test_startup_stats_serialization() {
        let stats = StartupStats {
            total_duration: 3000,
            phase_count: 11,
            success_count: 11,
            error_count: 0,
            slowest_phase: None,
            fastest_phase: None,
            memory_peak: 0,
            cpu_usage_avg: 0.0,
            improvement_suggestions: vec![],
        };
        
        let json = serde_json::to_string(&stats).unwrap();
        let deserialized: StartupStats = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.total_duration, stats.total_duration);
        assert_eq!(deserialized.phase_count, stats.phase_count);
    }
}

// ========== StartupEvent 测试 ==========

mod startup_event {
    use super::*;

    #[test]
    fn test_startup_event_structure() {
        let event = StartupEvent {
            event_type: "phase_started".to_string(),
            phase: Some(StartupPhase::AppInitialization),
            progress: 0.1,
            message: "Starting initialization".to_string(),
            timestamp: 1234567890,
            data: HashMap::new(),
        };
        
        assert_eq!(event.event_type, "phase_started");
        assert_eq!(event.progress, 0.1);
        assert_eq!(event.message, "Starting initialization");
    }

    #[test]
    fn test_startup_event_serialization() {
        let event = StartupEvent {
            event_type: "phase_completed".to_string(),
            phase: Some(StartupPhase::ConfigLoading),
            progress: 0.5,
            message: "Config loaded".to_string(),
            timestamp: 1234567890,
            data: HashMap::new(),
        };
        
        let json = serde_json::to_string(&event).unwrap();
        
        assert!(json.contains("phase_completed"));
        assert!(json.contains("Config loaded"));
    }

    #[test]
    fn test_startup_event_with_data() {
        let mut data = HashMap::new();
        data.insert("items_loaded".to_string(), serde_json::json!(42));
        
        let event = StartupEvent {
            event_type: "phase_progress".to_string(),
            phase: Some(StartupPhase::AdapterLoading),
            progress: 0.75,
            message: "Loading adapters".to_string(),
            timestamp: 1234567890,
            data,
        };
        
        assert_eq!(event.data.len(), 1);
        assert_eq!(event.data.get("items_loaded").unwrap(), &serde_json::json!(42));
    }
}

// ========== StartupManager 测试 ==========

mod startup_manager {
    use super::*;

    #[test]
    fn test_startup_manager_creation() {
        let manager = StartupManager::new();
        
        // 验证基本状态
        assert_eq!(manager.calculate_progress(), 0.0);
    }

    #[test]
    fn test_update_config() {
        let manager = StartupManager::new();
        
        let new_config = StartupConfig {
            enable_preloading: false,
            max_parallel_loading: 2,
            timeout_ms: 15000,
            enable_performance_monitoring: false,
            enable_startup_cache: false,
            skip_optional_phases: vec![],
            deferred_phases: vec![],
        };
        
        let result = manager.update_config(new_config.clone());
        assert!(result.is_ok());
        
        let retrieved_config = manager.get_config().unwrap();
        assert_eq!(retrieved_config.max_parallel_loading, 2);
    }

    #[test]
    fn test_get_config() {
        let manager = StartupManager::new();
        let result = manager.get_config();
        
        assert!(result.is_ok());
        
        let config = result.unwrap();
        assert_eq!(config.enable_preloading, true);
    }

    #[tokio::test]
    async fn test_start_phase() {
        let manager = StartupManager::new();
        let result = manager.start_phase(StartupPhase::AppInitialization).await;
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_finish_phase_success() {
        let manager = StartupManager::new();
        
        // 先开始一个阶段
        manager.start_phase(StartupPhase::ConfigLoading).await.unwrap();
        
        // 然后完成它
        let mut metrics = HashMap::new();
        metrics.insert("test_metric".to_string(), 100.0);
        
        let result = manager.finish_phase_success(StartupPhase::ConfigLoading, metrics).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_finish_phase_error() {
        let manager = StartupManager::new();
        
        // 先开始一个阶段
        manager.start_phase(StartupPhase::DatabaseConnection).await.unwrap();
        
        // 然后标记为失败
        let result = manager.finish_phase_error(
            StartupPhase::DatabaseConnection,
            "Connection timeout".to_string()
        ).await;
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_calculate_progress_no_phases() {
        let manager = StartupManager::new();
        let progress = manager.calculate_progress();
        
        assert_eq!(progress, 0.0);
    }

    #[tokio::test]
    async fn test_calculate_progress_one_phase() {
        let manager = StartupManager::new();
        
        // 完成一个阶段
        manager.start_phase(StartupPhase::AppInitialization).await.unwrap();
        manager.finish_phase_success(
            StartupPhase::AppInitialization,
            HashMap::new()
        ).await.unwrap();
        
        let progress = manager.calculate_progress();
        
        // 进度应该大于0但小于1
        assert!(progress > 0.0);
        assert!(progress < 1.0);
    }

    #[tokio::test]
    async fn test_get_stats() {
        let manager = StartupManager::new();
        
        // 完成一些阶段
        manager.start_phase(StartupPhase::AppInitialization).await.unwrap();
        manager.finish_phase_success(
            StartupPhase::AppInitialization,
            HashMap::new()
        ).await.unwrap();
        
        let result = manager.get_stats();
        assert!(result.is_ok());
        
        let stats = result.unwrap();
        assert_eq!(stats.success_count, 1);
        assert_eq!(stats.error_count, 0);
    }

    #[test]
    fn test_cache_operations() {
        let manager = StartupManager::new();
        
        // 设置缓存
        let value = serde_json::json!({"test": "value"});
        let result = manager.set_cache("test_key".to_string(), value.clone());
        assert!(result.is_ok());
        
        // 获取缓存
        let retrieved = manager.get_cache("test_key").unwrap();
        assert_eq!(retrieved, Some(value));
        
        // 清除缓存
        let clear_result = manager.clear_cache();
        assert!(clear_result.is_ok());
        
        // 验证缓存已清除
        let after_clear = manager.get_cache("test_key").unwrap();
        assert_eq!(after_clear, None);
    }

    #[test]
    fn test_reset() {
        let manager = StartupManager::new();
        
        // 设置一些缓存
        let _ = manager.set_cache("key1".to_string(), serde_json::json!("value1"));
        
        // 重置
        let result = manager.reset();
        assert!(result.is_ok());
        
        // 验证已重置
        let progress = manager.calculate_progress();
        assert_eq!(progress, 0.0);
        
        let cache = manager.get_cache("key1").unwrap();
        assert_eq!(cache, None);
    }

    #[test]
    fn test_subscribe_events() {
        let manager = StartupManager::new();
        let mut receiver = manager.subscribe();
        
        // 验证可以创建订阅者
        assert!(receiver.try_recv().is_err()); // 应该没有事件
    }
}

// ========== Edge Cases 测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_phase_weight_sum() {
        let phases = StartupPhase::all_phases();
        let total: u32 = phases.iter().map(|p| p.weight() as u32).sum();
        
        assert_eq!(total, 100);
    }

    #[test]
    fn test_zero_weight_phase() {
        assert_eq!(StartupPhase::Completed.weight(), 0);
    }

    #[tokio::test]
    async fn test_skip_optional_phase() {
        let manager = StartupManager::new();
        
        let mut config = manager.get_config().unwrap();
        config.skip_optional_phases.push(StartupPhase::NetworkConnection);
        
        manager.update_config(config).unwrap();
        
        // 尝试开始一个跳过的阶段
        let result = manager.start_phase(StartupPhase::NetworkConnection).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_multiple_phases_completion() {
        let manager = StartupManager::new();
        
        let phases_to_complete = vec![
            StartupPhase::AppInitialization,
            StartupPhase::ConfigLoading,
            StartupPhase::ThemeLoading,
        ];
        
        for phase in phases_to_complete {
            manager.start_phase(phase).await.unwrap();
            manager.finish_phase_success(phase, HashMap::new()).await.unwrap();
        }
        
        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.success_count, 3);
    }

    #[tokio::test]
    async fn test_mixed_success_and_failure() {
        let manager = StartupManager::new();
        
        // 成功完成一个阶段
        manager.start_phase(StartupPhase::AppInitialization).await.unwrap();
        manager.finish_phase_success(StartupPhase::AppInitialization, HashMap::new()).await.unwrap();
        
        // 失败完成一个阶段
        manager.start_phase(StartupPhase::DatabaseConnection).await.unwrap();
        manager.finish_phase_error(StartupPhase::DatabaseConnection, "Error".to_string()).await.unwrap();
        
        let stats = manager.get_stats().unwrap();
        assert_eq!(stats.success_count, 1);
        assert_eq!(stats.error_count, 1);
    }

    #[test]
    fn test_empty_suggestions() {
        let stats = StartupStats {
            total_duration: 1000,
            phase_count: 0,
            success_count: 0,
            error_count: 0,
            slowest_phase: None,
            fastest_phase: None,
            memory_peak: 0,
            cpu_usage_avg: 0.0,
            improvement_suggestions: vec![],
        };
        
        assert!(stats.improvement_suggestions.is_empty());
    }

    #[test]
    fn test_very_long_phase_name() {
        // 虽然枚举名称固定，但测试name()方法返回值
        let name = StartupPhase::FrontendInitialization.name();
        assert!(!name.is_empty());
        assert!(name.len() < 100); // 合理的长度
    }
}

// ========== 性能测试 ==========

mod performance {
    use super::*;

    #[tokio::test]
    async fn test_rapid_phase_completion() {
        let manager = StartupManager::new();
        
        let start = std::time::Instant::now();
        
        for phase in StartupPhase::all_phases() {
            if phase != StartupPhase::Completed {
                manager.start_phase(phase).await.unwrap();
                manager.finish_phase_success(phase, HashMap::new()).await.unwrap();
            }
        }
        
        let duration = start.elapsed();
        
        // 应该在合理时间内完成
        assert!(duration.as_secs() < 5);
    }

    #[test]
    fn test_many_cache_operations() {
        let manager = StartupManager::new();
        
        for i in 0..100 {
            let key = format!("key{}", i);
            let value = serde_json::json!(i);
            manager.set_cache(key, value).unwrap();
        }
        
        for i in 0..100 {
            let key = format!("key{}", i);
            let retrieved = manager.get_cache(&key).unwrap();
            assert_eq!(retrieved, Some(serde_json::json!(i)));
        }
    }
}

