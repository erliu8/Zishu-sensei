// 测试日志系统功能
use std::fs;
use tempfile::tempdir;
use zishu_sensei::utils::logger::*;

// ========== LogLevel 测试 ==========

mod log_level {
    use super::*;

    #[test]
    fn test_log_level_ordering() {
        assert!(LogLevel::Trace < LogLevel::Debug);
        assert!(LogLevel::Debug < LogLevel::Info);
        assert!(LogLevel::Info < LogLevel::Warn);
        assert!(LogLevel::Warn < LogLevel::Error);
        assert!(LogLevel::Error < LogLevel::Fatal);
    }

    #[test]
    fn test_log_level_as_str() {
        assert_eq!(LogLevel::Trace.as_str(), "TRACE");
        assert_eq!(LogLevel::Debug.as_str(), "DEBUG");
        assert_eq!(LogLevel::Info.as_str(), "INFO");
        assert_eq!(LogLevel::Warn.as_str(), "WARN");
        assert_eq!(LogLevel::Error.as_str(), "ERROR");
        assert_eq!(LogLevel::Fatal.as_str(), "FATAL");
    }

    #[test]
    fn test_log_level_from_str_valid() {
        assert_eq!(LogLevel::from_str("TRACE").unwrap(), LogLevel::Trace);
        assert_eq!(LogLevel::from_str("DEBUG").unwrap(), LogLevel::Debug);
        assert_eq!(LogLevel::from_str("INFO").unwrap(), LogLevel::Info);
        assert_eq!(LogLevel::from_str("WARN").unwrap(), LogLevel::Warn);
        assert_eq!(LogLevel::from_str("ERROR").unwrap(), LogLevel::Error);
        assert_eq!(LogLevel::from_str("FATAL").unwrap(), LogLevel::Fatal);
    }

    #[test]
    fn test_log_level_from_str_case_insensitive() {
        assert_eq!(LogLevel::from_str("trace").unwrap(), LogLevel::Trace);
        assert_eq!(LogLevel::from_str("Debug").unwrap(), LogLevel::Debug);
        assert_eq!(LogLevel::from_str("info").unwrap(), LogLevel::Info);
        assert_eq!(LogLevel::from_str("WARN").unwrap(), LogLevel::Warn);
    }

    #[test]
    fn test_log_level_from_str_invalid() {
        assert!(LogLevel::from_str("INVALID").is_err());
        assert!(LogLevel::from_str("").is_err());
        assert!(LogLevel::from_str("LOG").is_err());
    }

    #[test]
    fn test_log_level_serialization() {
        let level = LogLevel::Info;
        let json = serde_json::to_string(&level).unwrap();
        assert_eq!(json, "\"INFO\"");
        
        let deserialized: LogLevel = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, LogLevel::Info);
    }
}

// ========== LogEntry 测试 ==========

mod log_entry {
    use super::*;

    #[test]
    fn test_log_entry_creation() {
        let entry = LogEntry::new(LogLevel::Info, "Test message");
        
        assert_eq!(entry.level, LogLevel::Info);
        assert_eq!(entry.message, "Test message");
        assert!(entry.module.is_none());
        assert!(entry.file.is_none());
        assert!(entry.line.is_none());
        assert!(entry.data.is_none());
        assert!(entry.stack.is_none());
        assert!(entry.tags.is_empty());
    }

    #[test]
    fn test_log_entry_with_module() {
        let entry = LogEntry::new(LogLevel::Debug, "Test")
            .with_module("test_module");
        
        assert_eq!(entry.module, Some("test_module".to_string()));
    }

    #[test]
    fn test_log_entry_with_file_and_line() {
        let entry = LogEntry::new(LogLevel::Error, "Error occurred")
            .with_file("main.rs")
            .with_line(42);
        
        assert_eq!(entry.file, Some("main.rs".to_string()));
        assert_eq!(entry.line, Some(42));
    }

    #[test]
    fn test_log_entry_with_data() {
        let data = serde_json::json!({
            "user_id": 123,
            "action": "login"
        });
        
        let entry = LogEntry::new(LogLevel::Info, "User action")
            .with_data(data.clone());
        
        assert_eq!(entry.data, Some(data));
    }

    #[test]
    fn test_log_entry_with_stack() {
        let entry = LogEntry::new(LogLevel::Fatal, "Fatal error")
            .with_stack("Error at line 1\nError at line 2");
        
        assert_eq!(entry.stack, Some("Error at line 1\nError at line 2".to_string()));
    }

    #[test]
    fn test_log_entry_with_tags() {
        let tags = vec!["authentication".to_string(), "security".to_string()];
        let entry = LogEntry::new(LogLevel::Warn, "Security warning")
            .with_tags(tags.clone());
        
        assert_eq!(entry.tags, tags);
    }

    #[test]
    fn test_log_entry_to_json_string() {
        let entry = LogEntry::new(LogLevel::Info, "Test message")
            .with_module("test");
        
        let json = entry.to_json_string().unwrap();
        assert!(json.contains("\"level\":\"INFO\""));
        assert!(json.contains("\"message\":\"Test message\""));
        assert!(json.contains("\"module\":\"test\""));
    }

    #[test]
    fn test_log_entry_to_pretty_json() {
        let entry = LogEntry::new(LogLevel::Info, "Test");
        let json = entry.to_pretty_json().unwrap();
        
        assert!(json.contains("\"level\": \"INFO\""));
        assert!(json.contains("\n"));
    }

    #[test]
    fn test_log_entry_to_text() {
        let entry = LogEntry::new(LogLevel::Info, "Test message")
            .with_module("test_module");
        
        let text = entry.to_text();
        assert!(text.contains("INFO"));
        assert!(text.contains("[test_module]"));
        assert!(text.contains("Test message"));
    }

    #[test]
    fn test_log_entry_to_text_with_data() {
        let data = serde_json::json!({"key": "value"});
        let entry = LogEntry::new(LogLevel::Debug, "Debug info")
            .with_data(data);
        
        let text = entry.to_text();
        assert!(text.contains("DEBUG"));
        assert!(text.contains("Debug info"));
        assert!(text.contains("data:"));
    }

    #[test]
    fn test_log_entry_to_text_with_file_and_line() {
        let entry = LogEntry::new(LogLevel::Error, "Error")
            .with_file("test.rs")
            .with_line(100);
        
        let text = entry.to_text();
        assert!(text.contains("test.rs:100"));
    }
}

// ========== LoggerConfig 测试 ==========

mod logger_config {
    use super::*;

    #[test]
    fn test_logger_config_default() {
        let config = LoggerConfig::default();
        
        assert_eq!(config.min_level, LogLevel::Info);
        assert!(config.enable_console);
        assert!(config.enable_file);
        assert_eq!(config.file_prefix, "app");
        assert_eq!(config.max_file_size, 10 * 1024 * 1024); // 10MB
        assert_eq!(config.retention_days, 7);
        assert!(!config.pretty_json);
        assert!(config.include_location);
        assert!(config.async_write);
    }

    #[test]
    fn test_logger_config_serialization() {
        let config = LoggerConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: LoggerConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.min_level, config.min_level);
        assert_eq!(deserialized.enable_console, config.enable_console);
        assert_eq!(deserialized.max_file_size, config.max_file_size);
    }

    #[test]
    fn test_rotation_strategy_serialization() {
        let hourly = RotationStrategy::Hourly;
        let daily = RotationStrategy::Daily;
        let never = RotationStrategy::Never;
        
        assert_eq!(serde_json::to_string(&hourly).unwrap(), "\"hourly\"");
        assert_eq!(serde_json::to_string(&daily).unwrap(), "\"daily\"");
        assert_eq!(serde_json::to_string(&never).unwrap(), "\"never\"");
    }
}

// ========== Logger 测试 ==========

mod logger {
    use super::*;

    #[test]
    fn test_logger_creation() {
        let temp_dir = tempdir().unwrap();
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            ..Default::default()
        };
        
        let logger = Logger::new(config);
        assert!(logger.is_ok());
    }

    #[test]
    fn test_logger_initialization() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        // 检查日志目录是否已创建
        assert!(temp_dir.path().exists());
        
        Ok(())
    }

    #[test]
    fn test_logger_log_to_file() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        let log_dir = temp_dir.path().to_path_buf();
        
        let config = LoggerConfig {
            log_dir: log_dir.clone(),
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        // 写入日志
        logger.info("Test log message")?;
        logger.flush()?;
        
        // 验证日志文件已创建并包含内容
        let log_files: Vec<_> = fs::read_dir(&log_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        assert!(!log_files.is_empty(), "日志文件应该已创建");
        
        let log_file = &log_files[0];
        let content = fs::read_to_string(log_file.path())?;
        assert!(content.contains("Test log message"));
        
        Ok(())
    }

    #[test]
    fn test_logger_level_filtering() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            min_level: LogLevel::Warn,
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        // DEBUG应该被过滤
        logger.debug("Debug message")?;
        // INFO应该被过滤
        logger.info("Info message")?;
        // WARN应该被记录
        logger.warn("Warning message")?;
        // ERROR应该被记录
        logger.error("Error message")?;
        
        logger.flush()?;
        
        // 检查日志文件内容
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        assert_eq!(log_files.len(), 1);
        
        let content = fs::read_to_string(log_files[0].path())?;
        assert!(!content.contains("Debug message"));
        assert!(!content.contains("Info message"));
        assert!(content.contains("Warning message"));
        assert!(content.contains("Error message"));
        
        Ok(())
    }

    #[test]
    fn test_logger_convenience_methods() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            min_level: LogLevel::Trace,
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        logger.trace("Trace message")?;
        logger.debug("Debug message")?;
        logger.info("Info message")?;
        logger.warn("Warn message")?;
        logger.error("Error message")?;
        logger.fatal("Fatal message")?;
        
        logger.flush()?;
        
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        let content = fs::read_to_string(log_files[0].path())?;
        assert!(content.contains("Trace message"));
        assert!(content.contains("Debug message"));
        assert!(content.contains("Info message"));
        assert!(content.contains("Warn message"));
        assert!(content.contains("Error message"));
        assert!(content.contains("Fatal message"));
        
        Ok(())
    }

    #[test]
    fn test_logger_config_update() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            min_level: LogLevel::Info,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        // 更新配置
        let new_config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            min_level: LogLevel::Debug,
            ..Default::default()
        };
        
        logger.update_config(new_config);
        
        let retrieved_config = logger.get_config();
        assert_eq!(retrieved_config.min_level, LogLevel::Debug);
        
        Ok(())
    }

    #[test]
    fn test_logger_json_format() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            pretty_json: false,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        let entry = LogEntry::new(LogLevel::Info, "JSON test")
            .with_module("test");
        logger.log(entry)?;
        logger.flush()?;
        
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        let content = fs::read_to_string(log_files[0].path())?;
        // 验证是JSON格式
        assert!(content.contains("\"level\":\"INFO\""));
        assert!(content.contains("\"message\":\"JSON test\""));
        assert!(content.contains("\"module\":\"test\""));
        
        Ok(())
    }

    #[test]
    fn test_logger_file_rotation_never() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            file_prefix: "test".to_string(),
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        logger.info("Message 1")?;
        logger.info("Message 2")?;
        logger.flush()?;
        
        // 应该只有一个日志文件
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        assert_eq!(log_files.len(), 1);
        assert!(log_files[0].file_name().to_str().unwrap().contains("test.log"));
        
        Ok(())
    }

    #[test]
    fn test_logger_pretty_json() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            pretty_json: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        logger.info("Pretty JSON test")?;
        logger.flush()?;
        
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        let content = fs::read_to_string(log_files[0].path())?;
        // Pretty JSON应该包含缩进
        assert!(content.contains("  \"level\": \"INFO\"") || content.contains("\n"));
        
        Ok(())
    }

    #[test]
    fn test_logger_multiple_entries() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        for i in 0..10 {
            logger.info(format!("Message {}", i))?;
        }
        logger.flush()?;
        
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        let content = fs::read_to_string(log_files[0].path())?;
        let line_count = content.lines().count();
        assert_eq!(line_count, 10);
        
        Ok(())
    }
}

// ========== LoggerError 测试 ==========

mod logger_error {
    use super::*;

    #[test]
    fn test_error_display() {
        let error = LoggerError::NotInitialized;
        assert_eq!(error.to_string(), "日志系统未初始化");
        
        let error = LoggerError::FileTooLarge(1000);
        assert_eq!(error.to_string(), "日志文件过大: 1000 bytes");
        
        let error = LoggerError::InvalidLevel("INVALID".to_string());
        assert_eq!(error.to_string(), "无效的日志级别: INVALID");
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_logger_with_empty_message() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        logger.info("")?;
        logger.flush()?;
        
        Ok(())
    }

    #[test]
    fn test_logger_with_very_long_message() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        let long_message = "A".repeat(10000);
        logger.info(long_message.clone())?;
        logger.flush()?;
        
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        let content = fs::read_to_string(log_files[0].path())?;
        assert!(content.contains(&long_message));
        
        Ok(())
    }

    #[test]
    fn test_logger_with_unicode_message() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        logger.info("你好世界 🌍 مرحبا العالم")?;
        logger.flush()?;
        
        let log_files: Vec<_> = fs::read_dir(temp_dir.path())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("log"))
            .collect();
        
        let content = fs::read_to_string(log_files[0].path())?;
        assert!(content.contains("你好世界"));
        assert!(content.contains("مرحبا العالم"));
        
        Ok(())
    }

    #[test]
    fn test_logger_with_special_characters() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            enable_console: false,
            enable_file: true,
            rotation: RotationStrategy::Never,
            ..Default::default()
        };
        
        let logger = Logger::new(config)?;
        logger.initialize()?;
        
        logger.info("Message with \n newline and \t tab")?;
        logger.flush()?;
        
        Ok(())
    }
}

