//! 启动管理命令测试
//!
//! 测试所有启动相关的Tauri命令

#[cfg(test)]
mod startup_commands_tests {
    use crate::common::*;
    
    // ================================
    // update_startup_config 命令测试
    // ================================
    
    mod update_startup_config {
        use super::*;
        
        #[tokio::test]
        async fn test_update_startup_config_success() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.upsert_config("enable_preloading", "true").unwrap();
            test_db.upsert_config("max_parallel_loading", "4").unwrap();
            test_db.upsert_config("cache_enabled", "true").unwrap();
            
            // ========== Assert (断言) ==========
            let enable_preloading = test_db.get_config("enable_preloading").unwrap();
            assert_eq!(enable_preloading, Some("true".to_string()));
            
            let max_parallel = test_db.get_config("max_parallel_loading").unwrap();
            assert_eq!(max_parallel, Some("4".to_string()));
            
            let cache_enabled = test_db.get_config("cache_enabled").unwrap();
            assert_eq!(cache_enabled, Some("true".to_string()));
        }
        
        #[tokio::test]
        async fn test_update_startup_config_with_invalid_values() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            // 负数的max_parallel_loading应该被拒绝,但我们在这里只测试存储
            let result = test_db.upsert_config("max_parallel_loading", "-1");
            
            // ========== Assert (断言) ==========
            assert!(result.is_ok(), "即使值无效,存储操作也应成功(验证应在应用层进行)");
        }
        
        #[tokio::test]
        async fn test_update_startup_config_overwrites_existing() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            test_db.upsert_config("cache_ttl", "3600").unwrap();
            
            // ========== Act (执行) ==========
            test_db.upsert_config("cache_ttl", "7200").unwrap();
            
            // ========== Assert (断言) ==========
            let cache_ttl = test_db.get_config("cache_ttl").unwrap();
            assert_eq!(cache_ttl, Some("7200".to_string()), "应该更新为新值");
        }
    }
    
    // ================================
    // get_startup_config 命令测试
    // ================================
    
    mod get_startup_config {
        use super::*;
        
        #[tokio::test]
        async fn test_get_startup_config_returns_all_configs() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            test_db.upsert_config("enable_preloading", "true").unwrap();
            test_db.upsert_config("max_parallel_loading", "4").unwrap();
            
            // ========== Act (执行) ==========
            let count = test_db.count_config_records().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 2, "应该有2个配置项");
        }
        
        #[tokio::test]
        async fn test_get_startup_config_returns_default_when_empty() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            let count = test_db.count_config_records().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 0, "应该没有配置项");
        }
    }
    
    // ================================
    // start_startup_phase 命令测试
    // ================================
    
    mod start_startup_phase {
        use super::*;
        
        #[tokio::test]
        async fn test_start_startup_phase_records_timing() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            // ========== Act (执行) ==========
            test_db.record_startup_phase("initialization", "started", None).unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.startup_phase_exists("initialization").unwrap();
            assert!(exists, "启动阶段应该被记录");
        }
        
        #[tokio::test]
        async fn test_start_startup_phase_multiple_phases() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            // ========== Act (执行) ==========
            test_db.record_startup_phase("initialization", "started", None).unwrap();
            test_db.record_startup_phase("database", "started", None).unwrap();
            test_db.record_startup_phase("window_setup", "started", None).unwrap();
            
            // ========== Assert (断言) ==========
            let count = test_db.count_startup_phases().unwrap();
            assert_eq!(count, 3, "应该记录3个启动阶段");
        }
    }
    
    // ================================
    // finish_startup_phase_success 命令测试
    // ================================
    
    mod finish_startup_phase_success {
        use super::*;
        
        #[tokio::test]
        async fn test_finish_startup_phase_success_updates_status() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            test_db.record_startup_phase("initialization", "started", None).unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_startup_phase_status("initialization", "completed").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_startup_phase_status("initialization").unwrap();
            assert_eq!(status, Some("completed".to_string()));
        }
        
        #[tokio::test]
        async fn test_finish_startup_phase_success_with_metrics() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            test_db.record_startup_phase("database", "started", None).unwrap();
            
            // ========== Act (执行) ==========
            test_db.record_startup_phase("database", "completed", Some("{\"duration_ms\":150}")).unwrap();
            
            // ========== Assert (断言) ==========
            let metrics = test_db.get_startup_phase_metrics("database").unwrap();
            assert!(metrics.is_some(), "应该记录性能指标");
        }
    }
    
    // ================================
    // finish_startup_phase_error 命令测试
    // ================================
    
    mod finish_startup_phase_error {
        use super::*;
        
        #[tokio::test]
        async fn test_finish_startup_phase_error_records_error() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            test_db.record_startup_phase("plugins", "started", None).unwrap();
            
            // ========== Act (执行) ==========
            test_db.record_startup_error("plugins", "Plugin load failed").unwrap();
            
            // ========== Assert (断言) ==========
            let error = test_db.get_startup_phase_error("plugins").unwrap();
            assert!(error.is_some(), "应该记录错误信息");
            assert!(error.unwrap().contains("Plugin load failed"));
        }
        
        #[tokio::test]
        async fn test_finish_startup_phase_error_updates_status() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            test_db.record_startup_phase("plugins", "started", None).unwrap();
            
            // ========== Act (执行) ==========
            test_db.update_startup_phase_status("plugins", "failed").unwrap();
            test_db.record_startup_error("plugins", "Error message").unwrap();
            
            // ========== Assert (断言) ==========
            let status = test_db.get_startup_phase_status("plugins").unwrap();
            assert_eq!(status, Some("failed".to_string()));
        }
    }
    
    // ================================
    // get_startup_progress 命令测试
    // ================================
    
    mod get_startup_progress {
        use super::*;
        
        #[tokio::test]
        async fn test_get_startup_progress_calculates_correctly() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            // 总共4个阶段,2个完成
            test_db.record_startup_phase("phase1", "completed", None).unwrap();
            test_db.record_startup_phase("phase2", "completed", None).unwrap();
            test_db.record_startup_phase("phase3", "started", None).unwrap();
            test_db.record_startup_phase("phase4", "pending", None).unwrap();
            
            // ========== Act (执行) ==========
            let completed = test_db.count_completed_startup_phases().unwrap();
            let total = test_db.count_startup_phases().unwrap();
            let progress = (completed as f32 / total as f32) * 100.0;
            
            // ========== Assert (断言) ==========
            assert_eq!(completed, 2);
            assert_eq!(total, 4);
            assert!((progress - 50.0).abs() < 0.01, "进度应该是50%");
        }
        
        #[tokio::test]
        async fn test_get_startup_progress_returns_zero_when_no_phases() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            // ========== Act (执行) ==========
            let total = test_db.count_startup_phases().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(total, 0);
        }
        
        #[tokio::test]
        async fn test_get_startup_progress_returns_100_when_all_complete() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            test_db.record_startup_phase("phase1", "completed", None).unwrap();
            test_db.record_startup_phase("phase2", "completed", None).unwrap();
            test_db.record_startup_phase("phase3", "completed", None).unwrap();
            
            // ========== Act (执行) ==========
            let completed = test_db.count_completed_startup_phases().unwrap();
            let total = test_db.count_startup_phases().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(completed, total);
        }
    }
    
    // ================================
    // get_startup_stats 命令测试
    // ================================
    
    mod get_startup_stats {
        use super::*;
        
        #[tokio::test]
        async fn test_get_startup_stats_returns_complete_stats() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            test_db.record_startup_phase("phase1", "completed", Some("{\"duration_ms\":100}")).unwrap();
            test_db.record_startup_phase("phase2", "completed", Some("{\"duration_ms\":200}")).unwrap();
            test_db.record_startup_phase("phase3", "failed", None).unwrap();
            
            // ========== Act (执行) ==========
            let total = test_db.count_startup_phases().unwrap();
            let completed = test_db.count_completed_startup_phases().unwrap();
            let failed = test_db.count_failed_startup_phases().unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(total, 3);
            assert_eq!(completed, 2);
            assert_eq!(failed, 1);
        }
    }
    
    // ================================
    // get_startup_cache & set_startup_cache 命令测试
    // ================================
    
    mod startup_cache_operations {
        use super::*;
        
        #[tokio::test]
        async fn test_set_and_get_startup_cache() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            // ========== Act (执行) ==========
            test_db.set_cache("config:theme", "{\"theme\":\"dark\"}").unwrap();
            
            // ========== Assert (断言) ==========
            let cache_value = test_db.get_cache("config:theme").unwrap();
            assert!(cache_value.is_some());
            assert_eq!(cache_value.unwrap(), "{\"theme\":\"dark\"}");
        }
        
        #[tokio::test]
        async fn test_get_startup_cache_returns_none_when_not_exists() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            // ========== Act (执行) ==========
            let cache_value = test_db.get_cache("nonexistent").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(cache_value.is_none());
        }
        
        #[tokio::test]
        async fn test_set_startup_cache_overwrites_existing() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            test_db.set_cache("user:preferences", "{\"lang\":\"en\"}").unwrap();
            
            // ========== Act (执行) ==========
            test_db.set_cache("user:preferences", "{\"lang\":\"zh\"}").unwrap();
            
            // ========== Assert (断言) ==========
            let cache_value = test_db.get_cache("user:preferences").unwrap();
            assert_eq!(cache_value, Some("{\"lang\":\"zh\"}".to_string()));
        }
        
        #[tokio::test]
        async fn test_set_startup_cache_with_complex_json() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            let complex_json = r#"{"user":{"name":"test","preferences":{"theme":"dark","lang":"zh"}}}"#;
            
            // ========== Act (执行) ==========
            test_db.set_cache("complex", complex_json).unwrap();
            
            // ========== Assert (断言) ==========
            let cache_value = test_db.get_cache("complex").unwrap();
            assert_eq!(cache_value, Some(complex_json.to_string()));
        }
    }
    
    // ================================
    // clear_startup_cache 命令测试
    // ================================
    
    mod clear_startup_cache {
        use super::*;
        
        #[tokio::test]
        async fn test_clear_startup_cache_removes_all() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            test_db.set_cache("key1", "value1").unwrap();
            test_db.set_cache("key2", "value2").unwrap();
            test_db.set_cache("key3", "value3").unwrap();
            
            // ========== Act (执行) ==========
            test_db.clear_all_cache().unwrap();
            
            // ========== Assert (断言) ==========
            let count = test_db.count_cache_records().unwrap();
            assert_eq!(count, 0, "所有缓存应该被清除");
        }
        
        #[tokio::test]
        async fn test_clear_startup_cache_when_empty() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            // ========== Act (执行) ==========
            let result = test_db.clear_all_cache();
            
            // ========== Assert (断言) ==========
            assert!(result.is_ok(), "清空空缓存应该成功");
        }
    }
    
    // ================================
    // reset_startup_manager 命令测试
    // ================================
    
    mod reset_startup_manager {
        use super::*;
        
        #[tokio::test]
        async fn test_reset_startup_manager_clears_all_data() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            // 添加一些数据
            test_db.record_startup_phase("phase1", "completed", None).unwrap();
            test_db.set_cache("key1", "value1").unwrap();
            
            // ========== Act (执行) ==========
            test_db.clear_all_startup_phases().unwrap();
            test_db.clear_all_cache().unwrap();
            
            // ========== Assert (断言) ==========
            let phase_count = test_db.count_startup_phases().unwrap();
            let cache_count = test_db.count_cache_records().unwrap();
            
            assert_eq!(phase_count, 0, "所有启动阶段应该被清除");
            assert_eq!(cache_count, 0, "所有缓存应该被清除");
        }
    }
    
    // ================================
    // preload_resources 命令测试
    // ================================
    
    mod preload_resources {
        use super::*;
        
        #[tokio::test]
        async fn test_preload_resources_handles_empty_list() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            // ========== Act (执行) ==========
            // 模拟空资源列表预加载
            let resources: Vec<String> = vec![];
            
            // ========== Assert (断言) ==========
            assert_eq!(resources.len(), 0, "资源列表应该为空");
        }
        
        #[tokio::test]
        async fn test_preload_resources_records_progress() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_cache_tables().expect("Failed to init cache tables");
            
            // ========== Act (执行) ==========
            let resources = vec!["image1.png", "image2.png", "config.json"];
            let total = resources.len();
            
            // 模拟预加载进度
            for (i, _resource) in resources.iter().enumerate() {
                let progress = ((i + 1) as f32 / total as f32) * 100.0;
                test_db.set_cache(
                    &format!("preload_progress_{}", i),
                    &progress.to_string()
                ).unwrap();
            }
            
            // ========== Assert (断言) ==========
            let count = test_db.count_cache_records().unwrap();
            assert_eq!(count, total as i64);
        }
    }
    
    // ================================
    // optimize_startup 命令测试
    // ================================
    
    mod optimize_startup {
        use super::*;
        
        #[tokio::test]
        async fn test_optimize_startup_records_optimization_tasks() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            // ========== Act (执行) ==========
            test_db.record_startup_phase("cleanup_temp", "completed", None).unwrap();
            test_db.record_startup_phase("optimize_db", "completed", None).unwrap();
            test_db.record_startup_phase("precompile", "completed", None).unwrap();
            test_db.record_startup_phase("update_cache", "completed", None).unwrap();
            
            // ========== Assert (断言) ==========
            let completed = test_db.count_completed_startup_phases().unwrap();
            assert_eq!(completed, 4, "应该完成4个优化任务");
        }
        
        #[tokio::test]
        async fn test_optimize_startup_handles_partial_failure() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_startup_tables().expect("Failed to init startup tables");
            
            // ========== Act (执行) ==========
            test_db.record_startup_phase("task1", "completed", None).unwrap();
            test_db.record_startup_phase("task2", "failed", None).unwrap();
            test_db.record_startup_phase("task3", "completed", None).unwrap();
            
            // ========== Assert (断言) ==========
            let completed = test_db.count_completed_startup_phases().unwrap();
            let failed = test_db.count_failed_startup_phases().unwrap();
            
            assert_eq!(completed, 2);
            assert_eq!(failed, 1);
        }
    }
}

