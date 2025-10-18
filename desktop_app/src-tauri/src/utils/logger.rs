/**
 * Rust 后端日志系统
 * 
 * 提供全面的服务端日志功能：
 * - 多级别日志记录
 * - 日志文件轮转
 * - 异步写入
 * - 结构化日志
 * - 性能监控
 * - 错误追踪
 */

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Local, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{debug, error, info, trace, warn};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{
    fmt::{self, format::FmtSpan},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter, Layer,
};

// ================================
// 错误类型
// ================================

#[derive(Error, Debug)]
pub enum LoggerError {
    #[error("IO错误: {0}")]
    Io(#[from] io::Error),
    
    #[error("序列化错误: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("日志系统未初始化")]
    NotInitialized,
    
    #[error("日志文件过大: {0} bytes")]
    FileTooLarge(u64),
    
    #[error("无效的日志级别: {0}")]
    InvalidLevel(String),
}

pub type LoggerResult<T> = Result<T, LoggerError>;

// ================================
// 日志级别
// ================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
    Fatal = 5,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Trace => "TRACE",
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
            LogLevel::Fatal => "FATAL",
        }
    }

    pub fn from_str(s: &str) -> LoggerResult<Self> {
        match s.to_uppercase().as_str() {
            "TRACE" => Ok(LogLevel::Trace),
            "DEBUG" => Ok(LogLevel::Debug),
            "INFO" => Ok(LogLevel::Info),
            "WARN" => Ok(LogLevel::Warn),
            "ERROR" => Ok(LogLevel::Error),
            "FATAL" => Ok(LogLevel::Fatal),
            _ => Err(LoggerError::InvalidLevel(s.to_string())),
        }
    }
}

// ================================
// 日志条目
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// 时间戳（UTC）
    pub timestamp: DateTime<Utc>,
    /// 本地时间
    pub local_time: DateTime<Local>,
    /// 日志级别
    pub level: LogLevel,
    /// 日志消息
    pub message: String,
    /// 模块名称
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module: Option<String>,
    /// 文件名
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    /// 行号
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    /// 线程ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread: Option<String>,
    /// 额外数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    /// 错误堆栈
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    /// 标签
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tags: Vec<String>,
}

impl LogEntry {
    pub fn new(level: LogLevel, message: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            local_time: Local::now(),
            level,
            message: message.into(),
            module: None,
            file: None,
            line: None,
            thread: None,
            data: None,
            stack: None,
            tags: Vec::new(),
        }
    }

    pub fn with_module(mut self, module: impl Into<String>) -> Self {
        self.module = Some(module.into());
        self
    }

    pub fn with_file(mut self, file: impl Into<String>) -> Self {
        self.file = Some(file.into());
        self
    }

    pub fn with_line(mut self, line: u32) -> Self {
        self.line = Some(line);
        self
    }

    pub fn with_data(mut self, data: serde_json::Value) -> Self {
        self.data = Some(data);
        self
    }

    pub fn with_stack(mut self, stack: impl Into<String>) -> Self {
        self.stack = Some(stack.into());
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    /// 格式化为单行JSON字符串
    pub fn to_json_string(&self) -> LoggerResult<String> {
        Ok(serde_json::to_string(self)?)
    }

    /// 格式化为美化的JSON字符串
    pub fn to_pretty_json(&self) -> LoggerResult<String> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    /// 格式化为可读文本
    pub fn to_text(&self) -> String {
        let timestamp = self.local_time.format("%Y-%m-%d %H:%M:%S%.3f");
        let level = self.level.as_str();
        let module = self.module.as_deref().unwrap_or("app");
        
        let mut text = format!("[{}] {} [{}] {}", timestamp, level, module, self.message);
        
        if let Some(ref data) = self.data {
            text.push_str(&format!(" | data: {}", data));
        }
        
        if let Some(ref file) = self.file {
            if let Some(line) = self.line {
                text.push_str(&format!(" | {}:{}", file, line));
            }
        }
        
        text
    }
}

// ================================
// 日志配置
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggerConfig {
    /// 最小日志级别
    pub min_level: LogLevel,
    /// 是否启用控制台输出
    pub enable_console: bool,
    /// 是否启用文件输出
    pub enable_file: bool,
    /// 日志目录
    pub log_dir: PathBuf,
    /// 日志文件名前缀
    pub file_prefix: String,
    /// 最大文件大小（字节）
    pub max_file_size: u64,
    /// 保留天数
    pub retention_days: u32,
    /// 轮转策略
    pub rotation: RotationStrategy,
    /// 是否美化JSON输出
    pub pretty_json: bool,
    /// 是否包含文件和行号
    pub include_location: bool,
    /// 是否异步写入
    pub async_write: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RotationStrategy {
    /// 每小时轮转
    Hourly,
    /// 每天轮转
    Daily,
    /// 从不轮转
    Never,
}

impl Default for LoggerConfig {
    fn default() -> Self {
        Self {
            min_level: LogLevel::Info,
            enable_console: true,
            enable_file: true,
            log_dir: PathBuf::from("logs"),
            file_prefix: String::from("app"),
            max_file_size: 10 * 1024 * 1024, // 10MB
            retention_days: 7,
            rotation: RotationStrategy::Daily,
            pretty_json: false,
            include_location: true,
            async_write: true,
        }
    }
}

// ================================
// 日志管理器
// ================================

pub struct Logger {
    config: Arc<Mutex<LoggerConfig>>,
    file_handle: Arc<Mutex<Option<File>>>,
    current_file_path: Arc<Mutex<Option<PathBuf>>>,
    current_file_size: Arc<Mutex<u64>>,
}

impl Logger {
    /// 创建新的Logger实例
    pub fn new(config: LoggerConfig) -> LoggerResult<Self> {
        let logger = Self {
            config: Arc::new(Mutex::new(config)),
            file_handle: Arc::new(Mutex::new(None)),
            current_file_path: Arc::new(Mutex::new(None)),
            current_file_size: Arc::new(Mutex::new(0)),
        };

        Ok(logger)
    }

    /// 初始化日志系统
    pub fn initialize(&self) -> LoggerResult<()> {
        let config = self.config.lock().unwrap();

        // 创建日志目录
        if config.enable_file {
            fs::create_dir_all(&config.log_dir)?;
        }

        // 初始化日志文件
        drop(config);
        self.init_log_file()?;

        Ok(())
    }

    /// 初始化日志文件
    fn init_log_file(&self) -> LoggerResult<()> {
        let config = self.config.lock().unwrap();
        
        if !config.enable_file {
            return Ok(());
        }

        let file_path = self.generate_log_file_path(&config);
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)?;

        let metadata = file.metadata()?;
        let file_size = metadata.len();

        *self.file_handle.lock().unwrap() = Some(file);
        *self.current_file_path.lock().unwrap() = Some(file_path);
        *self.current_file_size.lock().unwrap() = file_size;

        Ok(())
    }

    /// 生成日志文件路径
    fn generate_log_file_path(&self, config: &LoggerConfig) -> PathBuf {
        let now = Local::now();
        let filename = match config.rotation {
            RotationStrategy::Hourly => {
                format!("{}-{}.log", 
                    config.file_prefix,
                    now.format("%Y-%m-%d-%H"))
            }
            RotationStrategy::Daily => {
                format!("{}-{}.log", 
                    config.file_prefix,
                    now.format("%Y-%m-%d"))
            }
            RotationStrategy::Never => {
                format!("{}.log", config.file_prefix)
            }
        };

        config.log_dir.join(filename)
    }

    /// 写入日志
    pub fn log(&self, entry: LogEntry) -> LoggerResult<()> {
        let config = self.config.lock().unwrap();

        // 级别过滤
        if entry.level < config.min_level {
            return Ok(());
        }

        // 控制台输出
        if config.enable_console {
            self.log_to_console(&entry);
        }

        // 文件输出
        if config.enable_file {
            drop(config);
            self.log_to_file(&entry)?;
        }

        Ok(())
    }

    /// 控制台输出
    fn log_to_console(&self, entry: &LogEntry) {
        let text = entry.to_text();
        
        match entry.level {
            LogLevel::Trace => trace!("{}", text),
            LogLevel::Debug => debug!("{}", text),
            LogLevel::Info => info!("{}", text),
            LogLevel::Warn => warn!("{}", text),
            LogLevel::Error | LogLevel::Fatal => error!("{}", text),
        }
    }

    /// 文件输出
    fn log_to_file(&self, entry: &LogEntry) -> LoggerResult<()> {
        // 检查是否需要轮转
        self.check_rotation()?;

        let mut file_handle = self.file_handle.lock().unwrap();
        
        if let Some(ref mut file) = *file_handle {
            let config = self.config.lock().unwrap();
            let log_line = if config.pretty_json {
                entry.to_pretty_json()?
            } else {
                entry.to_json_string()?
            };

            writeln!(file, "{}", log_line)?;
            file.flush()?;

            // 更新文件大小
            let line_size = log_line.len() as u64 + 1; // +1 for newline
            *self.current_file_size.lock().unwrap() += line_size;
        }

        Ok(())
    }

    /// 检查并执行日志轮转
    fn check_rotation(&self) -> LoggerResult<()> {
        let config = self.config.lock().unwrap();
        let current_size = *self.current_file_size.lock().unwrap();
        let current_path = self.current_file_path.lock().unwrap().clone();

        // 检查文件大小
        if current_size >= config.max_file_size {
            drop(config);
            drop(current_path);
            self.rotate_by_size()?;
            return Ok(());
        }

        // 检查时间轮转
        if let Some(ref path) = current_path {
            let expected_path = self.generate_log_file_path(&config);
            if path != &expected_path {
                drop(config);
                drop(current_path);
                self.rotate_by_time()?;
                return Ok(());
            }
        }

        Ok(())
    }

    /// 按大小轮转
    fn rotate_by_size(&self) -> LoggerResult<()> {
        let config = self.config.lock().unwrap();
        
        // 关闭当前文件
        *self.file_handle.lock().unwrap() = None;

        // 重命名当前文件
        if let Some(ref current_path) = *self.current_file_path.lock().unwrap() {
            let timestamp = Local::now().format("%Y%m%d-%H%M%S");
            let new_name = format!(
                "{}-{}.log",
                current_path.file_stem().unwrap().to_str().unwrap(),
                timestamp
            );
            let new_path = current_path.with_file_name(new_name);
            fs::rename(current_path, new_path)?;
        }

        // 创建新文件
        drop(config);
        self.init_log_file()?;

        // 清理旧文件
        self.cleanup_old_logs()?;

        Ok(())
    }

    /// 按时间轮转
    fn rotate_by_time(&self) -> LoggerResult<()> {
        // 关闭当前文件
        *self.file_handle.lock().unwrap() = None;

        // 创建新文件
        self.init_log_file()?;

        // 清理旧文件
        self.cleanup_old_logs()?;

        Ok(())
    }

    /// 清理过期日志文件
    fn cleanup_old_logs(&self) -> LoggerResult<()> {
        let config = self.config.lock().unwrap();
        let log_dir = &config.log_dir;
        let retention_days = config.retention_days;

        if retention_days == 0 {
            return Ok(());
        }

        let cutoff_time = Local::now() - chrono::Duration::days(retention_days as i64);

        for entry in fs::read_dir(log_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("log") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        let modified_time: DateTime<Local> = modified.into();
                        if modified_time < cutoff_time {
                            fs::remove_file(path)?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// 便捷方法：TRACE日志
    pub fn trace(&self, message: impl Into<String>) -> LoggerResult<()> {
        self.log(LogEntry::new(LogLevel::Trace, message))
    }

    /// 便捷方法：DEBUG日志
    pub fn debug(&self, message: impl Into<String>) -> LoggerResult<()> {
        self.log(LogEntry::new(LogLevel::Debug, message))
    }

    /// 便捷方法：INFO日志
    pub fn info(&self, message: impl Into<String>) -> LoggerResult<()> {
        self.log(LogEntry::new(LogLevel::Info, message))
    }

    /// 便捷方法：WARN日志
    pub fn warn(&self, message: impl Into<String>) -> LoggerResult<()> {
        self.log(LogEntry::new(LogLevel::Warn, message))
    }

    /// 便捷方法：ERROR日志
    pub fn error(&self, message: impl Into<String>) -> LoggerResult<()> {
        self.log(LogEntry::new(LogLevel::Error, message))
    }

    /// 便捷方法：FATAL日志
    pub fn fatal(&self, message: impl Into<String>) -> LoggerResult<()> {
        self.log(LogEntry::new(LogLevel::Fatal, message))
    }

    /// 更新配置
    pub fn update_config(&self, config: LoggerConfig) {
        *self.config.lock().unwrap() = config;
    }

    /// 获取配置
    pub fn get_config(&self) -> LoggerConfig {
        self.config.lock().unwrap().clone()
    }

    /// 手动刷新日志
    pub fn flush(&self) -> LoggerResult<()> {
        if let Some(ref mut file) = *self.file_handle.lock().unwrap() {
            file.flush()?;
        }
        Ok(())
    }
}

// ================================
// 全局Logger实例
// ================================

use std::sync::OnceLock;

static GLOBAL_LOGGER: OnceLock<Arc<Logger>> = OnceLock::new();

/// 初始化全局Logger
pub fn init_global_logger(config: LoggerConfig) -> LoggerResult<()> {
    let logger = Logger::new(config)?;
    logger.initialize()?;
    
    GLOBAL_LOGGER.set(Arc::new(logger))
        .map_err(|_| LoggerError::NotInitialized)?;
    
    Ok(())
}

/// 获取全局Logger
pub fn global_logger() -> LoggerResult<Arc<Logger>> {
    GLOBAL_LOGGER.get()
        .cloned()
        .ok_or(LoggerError::NotInitialized)
}

/// 便捷宏：TRACE日志
#[macro_export]
macro_rules! log_trace {
    ($msg:expr) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.trace($msg);
        }
    };
    ($msg:expr, $($arg:tt)*) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.trace(format!($msg, $($arg)*));
        }
    };
}

/// 便捷宏：DEBUG日志
#[macro_export]
macro_rules! log_debug {
    ($msg:expr) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.debug($msg);
        }
    };
    ($msg:expr, $($arg:tt)*) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.debug(format!($msg, $($arg)*));
        }
    };
}

/// 便捷宏：INFO日志
#[macro_export]
macro_rules! log_info {
    ($msg:expr) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.info($msg);
        }
    };
    ($msg:expr, $($arg:tt)*) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.info(format!($msg, $($arg)*));
        }
    };
}

/// 便捷宏：WARN日志
#[macro_export]
macro_rules! log_warn {
    ($msg:expr) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.warn($msg);
        }
    };
    ($msg:expr, $($arg:tt)*) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.warn(format!($msg, $($arg)*));
        }
    };
}

/// 便捷宏：ERROR日志
#[macro_export]
macro_rules! log_error {
    ($msg:expr) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.error($msg);
        }
    };
    ($msg:expr, $($arg:tt)*) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.error(format!($msg, $($arg)*));
        }
    };
}

/// 便捷宏：FATAL日志
#[macro_export]
macro_rules! log_fatal {
    ($msg:expr) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.fatal($msg);
        }
    };
    ($msg:expr, $($arg:tt)*) => {
        if let Ok(logger) = $crate::utils::logger::global_logger() {
            let _ = logger.fatal(format!($msg, $($arg)*));
        }
    };
}

// ================================
// Tracing 集成
// ================================

/// 初始化 tracing 日志系统
pub fn init_tracing(log_dir: impl AsRef<Path>) -> LoggerResult<()> {
    let log_dir = log_dir.as_ref();
    fs::create_dir_all(log_dir)?;

    // 文件输出层
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        log_dir,
        "app.log"
    );
    
    let file_layer = fmt::layer()
        .with_writer(file_appender)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true)
        .with_span_events(FmtSpan::CLOSE);

    // 控制台输出层
    let console_layer = fmt::layer()
        .with_target(true)
        .with_line_number(true)
        .with_span_events(FmtSpan::CLOSE);

    // 环境过滤器
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    // 组合订阅者
    tracing_subscriber::registry()
        .with(env_filter)
        .with(console_layer)
        .with(file_layer)
        .init();

    Ok(())
}

// ================================
// 测试
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_logger_creation() {
        let config = LoggerConfig::default();
        let logger = Logger::new(config);
        assert!(logger.is_ok());
    }

    #[test]
    fn test_log_entry() {
        let entry = LogEntry::new(LogLevel::Info, "Test message")
            .with_module("test_module")
            .with_file("test.rs")
            .with_line(42);

        assert_eq!(entry.level, LogLevel::Info);
        assert_eq!(entry.message, "Test message");
        assert_eq!(entry.module, Some("test_module".to_string()));
        assert_eq!(entry.line, Some(42));
    }

    #[test]
    fn test_log_to_file() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        let log_dir = temp_dir.path().to_path_buf();

        let config = LoggerConfig {
            log_dir: log_dir.clone(),
            enable_console: false,
            enable_file: true,
            ..Default::default()
        };

        let logger = Logger::new(config)?;
        logger.initialize()?;

        logger.info("Test log message")?;
        logger.flush()?;

        // 验证日志文件已创建
        let log_files: Vec<_> = fs::read_dir(&log_dir)?
            .filter_map(|e| e.ok())
            .collect();

        assert!(!log_files.is_empty());

        Ok(())
    }

    #[test]
    fn test_log_level_filtering() -> LoggerResult<()> {
        let temp_dir = tempdir().unwrap();
        
        let config = LoggerConfig {
            log_dir: temp_dir.path().to_path_buf(),
            min_level: LogLevel::Warn,
            enable_console: false,
            enable_file: true,
            ..Default::default()
        };

        let logger = Logger::new(config)?;
        logger.initialize()?;

        // DEBUG应该被过滤
        logger.debug("Debug message")?;
        // WARN应该被记录
        logger.warn("Warning message")?;

        Ok(())
    }
}

