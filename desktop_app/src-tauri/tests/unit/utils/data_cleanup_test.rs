// 测试数据清理功能
// 注意：由于DataCleanupManager需要AppHandle和数据库连接，某些测试可能需要模拟这些依赖
use zishu_sensei::utils::data_cleanup::*;

// ========== CleanupType 测试 ==========

mod cleanup_type {
    use super::*;

    #[test]
    fn test_cleanup_type_as_str() {
        assert_eq!(CleanupType::Conversations.as_str(), "conversations");
        assert_eq!(CleanupType::Cache.as_str(), "cache");
        assert_eq!(CleanupType::Logs.as_str(), "logs");
        assert_eq!(CleanupType::SearchHistory.as_str(), "search_history");
        assert_eq!(CleanupType::ClipboardHistory.as_str(), "clipboard_history");
        assert_eq!(CleanupType::TempFiles.as_str(), "temp_files");
        assert_eq!(CleanupType::All.as_str(), "all");
    }

    #[test]
    fn test_cleanup_type_clone() {
        let ct1 = CleanupType::Conversations;
        let ct2 = ct1.clone();
        
        assert_eq!(ct1.as_str(), ct2.as_str());
    }
}

// ========== CleanupResult 测试 ==========

mod cleanup_result {
    use super::*;

    #[test]
    fn test_cleanup_result_new() {
        let result = CleanupResult::new("test".to_string());
        
        assert_eq!(result.cleanup_type, "test");
        assert_eq!(result.items_deleted, 0);
        assert_eq!(result.space_freed_bytes, 0);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_cleanup_result_serialization() {
        let mut result = CleanupResult::new("conversations".to_string());
        result.items_deleted = 100;
        result.space_freed_bytes = 1024 * 1024;
        result.errors.push("Error 1".to_string());
        
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: CleanupResult = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.cleanup_type, "conversations");
        assert_eq!(deserialized.items_deleted, 100);
        assert_eq!(deserialized.space_freed_bytes, 1024 * 1024);
        assert_eq!(deserialized.errors.len(), 1);
    }

    #[test]
    fn test_cleanup_result_with_multiple_errors() {
        let mut result = CleanupResult::new("cache".to_string());
        result.errors.push("Error 1".to_string());
        result.errors.push("Error 2".to_string());
        result.errors.push("Error 3".to_string());
        
        assert_eq!(result.errors.len(), 3);
    }

    #[test]
    fn test_cleanup_result_serialization_no_errors() {
        let result = CleanupResult::new("logs".to_string());
        
        let json = serde_json::to_string(&result).unwrap();
        let deserialized: CleanupResult = serde_json::from_str(&json).unwrap();
        
        assert!(deserialized.errors.is_empty());
    }
}

// ========== 清理操作逻辑测试 ==========

mod cleanup_operations {
    use super::*;

    #[test]
    fn test_cleanup_result_accumulation() {
        let mut total_result = CleanupResult::new("all".to_string());
        
        // 模拟累加多个清理结果
        total_result.items_deleted += 50;
        total_result.space_freed_bytes += 1024 * 512;
        
        total_result.items_deleted += 30;
        total_result.space_freed_bytes += 1024 * 256;
        
        assert_eq!(total_result.items_deleted, 80);
        assert_eq!(total_result.space_freed_bytes, 1024 * 768);
    }

    #[test]
    fn test_cleanup_result_error_collection() {
        let mut result = CleanupResult::new("all".to_string());
        
        // 模拟从多个操作收集错误
        let errors1 = vec!["Error 1".to_string(), "Error 2".to_string()];
        let errors2 = vec!["Error 3".to_string()];
        
        result.errors.extend(errors1);
        result.errors.extend(errors2);
        
        assert_eq!(result.errors.len(), 3);
        assert_eq!(result.errors[0], "Error 1");
        assert_eq!(result.errors[2], "Error 3");
    }
}

// ========== 空间计算测试 ==========

mod space_calculation {
    use super::*;

    #[test]
    fn test_space_calculation_bytes() {
        let result = CleanupResult {
            cleanup_type: "test".to_string(),
            items_deleted: 1,
            space_freed_bytes: 1024,
            errors: vec![],
        };
        
        assert_eq!(result.space_freed_bytes, 1024);
    }

    #[test]
    fn test_space_calculation_kb() {
        let result = CleanupResult {
            cleanup_type: "test".to_string(),
            items_deleted: 1,
            space_freed_bytes: 1024 * 10,
            errors: vec![],
        };
        
        let kb = result.space_freed_bytes / 1024;
        assert_eq!(kb, 10);
    }

    #[test]
    fn test_space_calculation_mb() {
        let result = CleanupResult {
            cleanup_type: "test".to_string(),
            items_deleted: 1,
            space_freed_bytes: 1024 * 1024 * 5,
            errors: vec![],
        };
        
        let mb = result.space_freed_bytes / (1024 * 1024);
        assert_eq!(mb, 5);
    }

    #[test]
    fn test_space_calculation_large() {
        let result = CleanupResult {
            cleanup_type: "test".to_string(),
            items_deleted: 1000,
            space_freed_bytes: 1024 * 1024 * 1024, // 1GB
            errors: vec![],
        };
        
        let gb = result.space_freed_bytes / (1024 * 1024 * 1024);
        assert_eq!(gb, 1);
    }
}

// ========== 统计信息测试 ==========

mod statistics {
    use super::*;

    #[test]
    fn test_cleanup_statistics_empty() {
        let result = CleanupResult::new("test".to_string());
        
        assert_eq!(result.items_deleted, 0);
        assert_eq!(result.space_freed_bytes, 0);
    }

    #[test]
    fn test_cleanup_statistics_small() {
        let result = CleanupResult {
            cleanup_type: "cache".to_string(),
            items_deleted: 5,
            space_freed_bytes: 1024 * 50,
            errors: vec![],
        };
        
        assert_eq!(result.items_deleted, 5);
        assert_eq!(result.space_freed_bytes, 1024 * 50);
    }

    #[test]
    fn test_cleanup_statistics_large() {
        let result = CleanupResult {
            cleanup_type: "conversations".to_string(),
            items_deleted: 10000,
            space_freed_bytes: 1024 * 1024 * 500,
            errors: vec![],
        };
        
        assert_eq!(result.items_deleted, 10000);
        assert!(result.space_freed_bytes > 0);
    }
}

// ========== 数据使用统计结构测试 ==========

mod data_usage_stats {
    use super::*;

    #[test]
    fn test_data_usage_stats_structure() {
        let stats = serde_json::json!({
            "conversations": 100,
            "messages": 500,
            "search_history": 50,
            "cache_size_bytes": 1024 * 1024,
            "log_size_bytes": 1024 * 512,
            "temp_size_bytes": 1024 * 256,
            "total_size_bytes": 1024 * 1792,
            "cache_size_mb": 1.0,
            "log_size_mb": 0.5,
            "temp_size_mb": 0.25,
            "total_size_mb": 1.75,
        });
        
        assert_eq!(stats["conversations"], 100);
        assert_eq!(stats["messages"], 500);
        assert_eq!(stats["search_history"], 50);
    }

    #[test]
    fn test_data_usage_stats_mb_conversion() {
        let bytes = 1024 * 1024; // 1 MB
        let mb = bytes as f64 / 1024.0 / 1024.0;
        
        assert_eq!(mb, 1.0);
    }

    #[test]
    fn test_data_usage_stats_total_calculation() {
        let cache_size = 1024 * 1024; // 1 MB
        let log_size = 1024 * 512; // 0.5 MB
        let temp_size = 1024 * 256; // 0.25 MB
        let total = cache_size + log_size + temp_size;
        
        assert_eq!(total, 1024 * 1792);
    }
}

// ========== Edge Cases 测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_cleanup_result_zero_items() {
        let result = CleanupResult {
            cleanup_type: "empty".to_string(),
            items_deleted: 0,
            space_freed_bytes: 0,
            errors: vec![],
        };
        
        assert_eq!(result.items_deleted, 0);
        assert_eq!(result.space_freed_bytes, 0);
    }

    #[test]
    fn test_cleanup_result_negative_not_possible() {
        // Rust的类型系统不允许负数(使用i64)
        // 但我们可以测试最小值
        let result = CleanupResult {
            cleanup_type: "test".to_string(),
            items_deleted: i64::MIN,
            space_freed_bytes: i64::MIN,
            errors: vec![],
        };
        
        assert!(result.items_deleted < 0); // 虽然逻辑上不应该发生
    }

    #[test]
    fn test_cleanup_result_max_values() {
        let result = CleanupResult {
            cleanup_type: "test".to_string(),
            items_deleted: i64::MAX,
            space_freed_bytes: i64::MAX,
            errors: vec![],
        };
        
        assert_eq!(result.items_deleted, i64::MAX);
        assert_eq!(result.space_freed_bytes, i64::MAX);
    }

    #[test]
    fn test_cleanup_result_very_long_error_message() {
        let mut result = CleanupResult::new("test".to_string());
        let long_error = "Error: ".to_string() + &"x".repeat(10000);
        result.errors.push(long_error.clone());
        
        assert_eq!(result.errors[0].len(), long_error.len());
    }

    #[test]
    fn test_cleanup_result_many_errors() {
        let mut result = CleanupResult::new("test".to_string());
        
        for i in 0..1000 {
            result.errors.push(format!("Error {}", i));
        }
        
        assert_eq!(result.errors.len(), 1000);
    }

    #[test]
    fn test_cleanup_type_all_variants() {
        let types = vec![
            CleanupType::Conversations,
            CleanupType::Cache,
            CleanupType::Logs,
            CleanupType::SearchHistory,
            CleanupType::ClipboardHistory,
            CleanupType::TempFiles,
            CleanupType::All,
        ];
        
        assert_eq!(types.len(), 7);
        
        for cleanup_type in types {
            assert!(!cleanup_type.as_str().is_empty());
        }
    }
}

// ========== 序列化测试 ==========

mod serialization {
    use super::*;

    #[test]
    fn test_cleanup_result_json_round_trip() {
        let original = CleanupResult {
            cleanup_type: "conversations".to_string(),
            items_deleted: 42,
            space_freed_bytes: 12345,
            errors: vec!["Error 1".to_string(), "Error 2".to_string()],
        };
        
        let json = serde_json::to_string(&original).unwrap();
        let restored: CleanupResult = serde_json::from_str(&json).unwrap();
        
        assert_eq!(restored.cleanup_type, original.cleanup_type);
        assert_eq!(restored.items_deleted, original.items_deleted);
        assert_eq!(restored.space_freed_bytes, original.space_freed_bytes);
        assert_eq!(restored.errors, original.errors);
    }

    #[test]
    fn test_cleanup_result_json_pretty() {
        let result = CleanupResult {
            cleanup_type: "cache".to_string(),
            items_deleted: 10,
            space_freed_bytes: 1024,
            errors: vec![],
        };
        
        let json = serde_json::to_string_pretty(&result).unwrap();
        
        assert!(json.contains("\"cleanup_type\""));
        assert!(json.contains("\"items_deleted\""));
        assert!(json.contains("\"space_freed_bytes\""));
        assert!(json.contains("\"errors\""));
    }

    #[test]
    fn test_cleanup_result_json_empty_errors() {
        let result = CleanupResult::new("test".to_string());
        let json = serde_json::to_string(&result).unwrap();
        
        assert!(json.contains("\"errors\":[]"));
    }
}

// ========== 实用功能测试 ==========

mod utility_functions {
    use super::*;

    #[test]
    fn test_calculate_space_freed_multiple_operations() {
        let results = vec![
            CleanupResult {
                cleanup_type: "cache".to_string(),
                items_deleted: 10,
                space_freed_bytes: 1024 * 100,
                errors: vec![],
            },
            CleanupResult {
                cleanup_type: "logs".to_string(),
                items_deleted: 5,
                space_freed_bytes: 1024 * 50,
                errors: vec![],
            },
            CleanupResult {
                cleanup_type: "temp".to_string(),
                items_deleted: 20,
                space_freed_bytes: 1024 * 200,
                errors: vec![],
            },
        ];
        
        let total_items: i64 = results.iter().map(|r| r.items_deleted).sum();
        let total_space: i64 = results.iter().map(|r| r.space_freed_bytes).sum();
        
        assert_eq!(total_items, 35);
        assert_eq!(total_space, 1024 * 350);
    }

    #[test]
    fn test_format_bytes_to_human_readable() {
        let test_cases = vec![
            (1024, "1 KB"),
            (1024 * 1024, "1 MB"),
            (1024 * 1024 * 1024, "1 GB"),
        ];
        
        for (bytes, expected) in test_cases {
            let result = match bytes {
                b if b >= 1024 * 1024 * 1024 => format!("{} GB", b / (1024 * 1024 * 1024)),
                b if b >= 1024 * 1024 => format!("{} MB", b / (1024 * 1024)),
                b if b >= 1024 => format!("{} KB", b / 1024),
                b => format!("{} B", b),
            };
            
            assert_eq!(result, expected);
        }
    }
}

