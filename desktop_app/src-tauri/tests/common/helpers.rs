//! 测试辅助函数
//!
//! 提供各种测试辅助工具和实用函数

use tempfile::{TempDir, NamedTempFile};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use serde_json::Value as JsonValue;

// ================================
// 临时文件和目录工具
// ================================

/// 创建临时测试目录
/// 
/// # 返回
/// 临时目录对象，会在 drop 时自动清理
/// 
/// # 示例
/// ```
/// let temp_dir = create_temp_dir();
/// let path = temp_dir.path();
/// // 使用 path 进行测试
/// // temp_dir drop 时自动清理
/// ```
pub fn create_temp_dir() -> TempDir {
    TempDir::new().expect("Failed to create temp directory")
}

/// 创建带指定前缀的临时目录
pub fn create_temp_dir_with_prefix(prefix: &str) -> TempDir {
    tempfile::Builder::new()
        .prefix(prefix)
        .tempdir()
        .expect("Failed to create temp directory with prefix")
}

/// 创建临时文件并写入内容
/// 
/// # 参数
/// - `content`: 文件内容
/// 
/// # 返回
/// (临时目录, 文件路径) 元组
/// 
/// # 示例
/// ```
/// let (dir, path) = create_temp_file_with_content("test content");
/// assert!(path.exists());
/// ```
pub fn create_temp_file_with_content(content: &str) -> (TempDir, PathBuf) {
    let dir = create_temp_dir();
    let file_path = dir.path().join("test_file.txt");
    fs::write(&file_path, content).expect("Failed to write temp file");
    (dir, file_path)
}

/// 创建多个临时文件
pub fn create_temp_files(count: usize, content_prefix: &str) -> (TempDir, Vec<PathBuf>) {
    let dir = create_temp_dir();
    let mut paths = Vec::new();
    
    for i in 0..count {
        let file_path = dir.path().join(format!("test_file_{}.txt", i));
        let content = format!("{}{}", content_prefix, i);
        fs::write(&file_path, content).expect("Failed to write temp file");
        paths.push(file_path);
    }
    
    (dir, paths)
}

/// 创建临时 JSON 文件
pub fn create_temp_json_file(json_data: &JsonValue) -> (TempDir, PathBuf) {
    let dir = create_temp_dir();
    let file_path = dir.path().join("test_data.json");
    let content = serde_json::to_string_pretty(json_data)
        .expect("Failed to serialize JSON");
    fs::write(&file_path, content).expect("Failed to write JSON file");
    (dir, file_path)
}

/// 创建临时目录结构
/// 
/// # 参数
/// - `structure`: 目录结构定义，格式为 "dir1/dir2/file.txt"
/// 
/// # 示例
/// ```
/// let (dir, _) = create_temp_dir_structure(&[
///     "subdir1/file1.txt",
///     "subdir1/file2.txt",
///     "subdir2/nested/file3.txt"
/// ]);
/// ```
pub fn create_temp_dir_structure(structure: &[&str]) -> (TempDir, Vec<PathBuf>) {
    let dir = create_temp_dir();
    let mut created_paths = Vec::new();
    
    for path_str in structure {
        let full_path = dir.path().join(path_str);
        
        // 创建父目录
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).expect("Failed to create parent directories");
        }
        
        // 创建文件
        fs::write(&full_path, format!("Content of {}", path_str))
            .expect("Failed to create file in structure");
        
        created_paths.push(full_path);
    }
    
    (dir, created_paths)
}

/// 读取临时文件内容
pub fn read_temp_file(path: &Path) -> String {
    fs::read_to_string(path).expect("Failed to read temp file")
}

/// 创建命名临时文件（不自动删除）
pub fn create_named_temp_file(suffix: &str) -> NamedTempFile {
    tempfile::Builder::new()
        .suffix(suffix)
        .tempfile()
        .expect("Failed to create named temp file")
}

// ================================
// 异步等待工具
// ================================

/// 等待异步条件满足
/// 
/// # 参数
/// - `condition`: 检查条件的闭包
/// - `timeout_ms`: 超时时间（毫秒）
/// 
/// # 返回
/// true 表示条件满足，false 表示超时
/// 
/// # 示例
/// ```
/// let success = wait_for_condition(|| {
///     // 检查某个状态
///     some_state.is_ready()
/// }, 5000).await;
/// assert!(success);
/// ```
pub async fn wait_for_condition<F>(mut condition: F, timeout_ms: u64) -> bool
where
    F: FnMut() -> bool,
{
    let start = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);
    
    while !condition() {
        if start.elapsed() > timeout {
            return false;
        }
        sleep(Duration::from_millis(10)).await;
    }
    
    true
}

/// 等待异步条件满足（异步闭包版本）
pub async fn wait_for_async_condition<F, Fut>(mut condition: F, timeout_ms: u64) -> bool
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = bool>,
{
    let start = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);
    
    while !condition().await {
        if start.elapsed() > timeout {
            return false;
        }
        sleep(Duration::from_millis(10)).await;
    }
    
    true
}

/// 等待指定时间
pub async fn wait_ms(ms: u64) {
    sleep(Duration::from_millis(ms)).await;
}

/// 等待一小段时间（10ms）
pub async fn wait_briefly() {
    sleep(Duration::from_millis(10)).await;
}

/// 使用重试机制执行异步操作
/// 
/// # 参数
/// - `operation`: 要执行的异步操作
/// - `max_retries`: 最大重试次数
/// - `retry_delay_ms`: 重试间隔（毫秒）
/// 
/// # 返回
/// 操作结果
pub async fn retry_async_operation<F, Fut, T, E>(
    mut operation: F,
    max_retries: usize,
    retry_delay_ms: u64,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Debug,
{
    let mut attempts = 0;
    
    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempts += 1;
                if attempts >= max_retries {
                    return Err(e);
                }
                sleep(Duration::from_millis(retry_delay_ms)).await;
            }
        }
    }
}

// ================================
// 数据比较和断言工具
// ================================

/// 比较两个 JSON 值是否相等（忽略顺序）
pub fn json_equals(a: &JsonValue, b: &JsonValue) -> bool {
    match (a, b) {
        (JsonValue::Object(map_a), JsonValue::Object(map_b)) => {
            if map_a.len() != map_b.len() {
                return false;
            }
            map_a.iter().all(|(k, v)| {
                map_b.get(k).map_or(false, |v2| json_equals(v, v2))
            })
        }
        (JsonValue::Array(arr_a), JsonValue::Array(arr_b)) => {
            arr_a.len() == arr_b.len() 
                && arr_a.iter().zip(arr_b.iter()).all(|(a, b)| json_equals(a, b))
        }
        _ => a == b,
    }
}

/// 检查 JSON 是否包含指定的键值对
pub fn json_contains(json: &JsonValue, key: &str, expected_value: &JsonValue) -> bool {
    match json {
        JsonValue::Object(map) => {
            map.get(key).map_or(false, |v| json_equals(v, expected_value))
        }
        _ => false,
    }
}

/// 从 JSON 中安全获取字符串值
pub fn json_get_str<'a>(json: &'a JsonValue, key: &str) -> Option<&'a str> {
    json.get(key)?.as_str()
}

/// 从 JSON 中安全获取数字值
pub fn json_get_i64(json: &JsonValue, key: &str) -> Option<i64> {
    json.get(key)?.as_i64()
}

/// 从 JSON 中安全获取布尔值
pub fn json_get_bool(json: &JsonValue, key: &str) -> Option<bool> {
    json.get(key)?.as_bool()
}

/// 从 JSON 中安全获取数组
pub fn json_get_array<'a>(json: &'a JsonValue, key: &str) -> Option<&'a Vec<JsonValue>> {
    json.get(key)?.as_array()
}

// ================================
// 字符串工具
// ================================

/// 标准化路径分隔符（统一转换为 Unix 风格）
pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

/// 生成随机字符串
pub fn random_string(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    
    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// 生成随机 ID
pub fn random_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 生成唯一的测试 ID
pub fn unique_test_id(prefix: &str) -> String {
    format!("{}_{}", prefix, uuid::Uuid::new_v4().simple())
}

/// 截断字符串
pub fn truncate_string(s: &str, max_length: usize) -> String {
    if s.len() <= max_length {
        s.to_string()
    } else {
        format!("{}...", &s[..max_length.saturating_sub(3)])
    }
}

// ================================
// 环境变量工具
// ================================

/// 临时设置环境变量（在作用域结束时恢复）
pub struct TempEnvVar {
    key: String,
    old_value: Option<String>,
}

impl TempEnvVar {
    /// 创建临时环境变量
    pub fn new(key: &str, value: &str) -> Self {
        let old_value = std::env::var(key).ok();
        std::env::set_var(key, value);
        Self {
            key: key.to_string(),
            old_value,
        }
    }
}

impl Drop for TempEnvVar {
    fn drop(&mut self) {
        match &self.old_value {
            Some(value) => std::env::set_var(&self.key, value),
            None => std::env::remove_var(&self.key),
        }
    }
}

/// 临时移除环境变量
pub struct TempEnvRemove {
    key: String,
    old_value: Option<String>,
}

impl TempEnvRemove {
    pub fn new(key: &str) -> Self {
        let old_value = std::env::var(key).ok();
        std::env::remove_var(key);
        Self {
            key: key.to_string(),
            old_value,
        }
    }
}

impl Drop for TempEnvRemove {
    fn drop(&mut self) {
        if let Some(value) = &self.old_value {
            std::env::set_var(&self.key, value);
        }
    }
}

// ================================
// 性能测试工具
// ================================

/// 测量代码执行时间
pub fn measure_time<F, R>(f: F) -> (R, Duration)
where
    F: FnOnce() -> R,
{
    let start = Instant::now();
    let result = f();
    let duration = start.elapsed();
    (result, duration)
}

/// 测量异步代码执行时间
pub async fn measure_async_time<F, Fut, R>(f: F) -> (R, Duration)
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = R>,
{
    let start = Instant::now();
    let result = f().await;
    let duration = start.elapsed();
    (result, duration)
}

/// 断言执行时间在指定范围内
pub fn assert_execution_time<F>(f: F, max_duration_ms: u64)
where
    F: FnOnce(),
{
    let (_, duration) = measure_time(f);
    assert!(
        duration.as_millis() <= max_duration_ms as u128,
        "Execution took {}ms, expected <= {}ms",
        duration.as_millis(),
        max_duration_ms
    );
}

/// 断言异步执行时间在指定范围内
pub async fn assert_async_execution_time<F, Fut>(f: F, max_duration_ms: u64)
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    let (_, duration) = measure_async_time(f).await;
    assert!(
        duration.as_millis() <= max_duration_ms as u128,
        "Async execution took {}ms, expected <= {}ms",
        duration.as_millis(),
        max_duration_ms
    );
}

// ================================
// 数据生成工具
// ================================

/// 生成测试用的大文本
pub fn generate_large_text(size_kb: usize) -> String {
    let pattern = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ";
    let pattern_size = pattern.len();
    let total_size = size_kb * 1024;
    let repeat_count = (total_size + pattern_size - 1) / pattern_size;
    
    pattern.repeat(repeat_count)[..total_size].to_string()
}

/// 生成测试用的二进制数据
pub fn generate_binary_data(size_bytes: usize) -> Vec<u8> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..size_bytes).map(|_| rng.gen()).collect()
}

/// 生成范围内的随机数
pub fn random_number(min: i64, max: i64) -> i64 {
    use rand::Rng;
    rand::thread_rng().gen_range(min..=max)
}

/// 生成随机布尔值
pub fn random_bool() -> bool {
    use rand::Rng;
    rand::thread_rng().gen()
}

// ================================
// 集合工具
// ================================

/// 检查两个向量是否包含相同的元素（忽略顺序）
pub fn vec_eq_unordered<T: Eq + std::hash::Hash>(a: &[T], b: &[T]) -> bool {
    use std::collections::HashSet;
    
    if a.len() != b.len() {
        return false;
    }
    
    let set_a: HashSet<_> = a.iter().collect();
    let set_b: HashSet<_> = b.iter().collect();
    
    set_a == set_b
}

/// 创建包含重复元素的向量
pub fn repeat_vec<T: Clone>(item: T, count: usize) -> Vec<T> {
    vec![item; count]
}

// ================================
// 日志和调试工具
// ================================

/// 在测试中打印调试信息
#[allow(dead_code)]
pub fn test_log(message: &str) {
    eprintln!("[TEST] {}", message);
}

/// 在测试中打印分隔线
#[allow(dead_code)]
pub fn test_separator() {
    eprintln!("================================");
}

/// 打印 JSON 值（格式化）
#[allow(dead_code)]
pub fn print_json(json: &JsonValue) {
    eprintln!("{}", serde_json::to_string_pretty(json).unwrap_or_default());
}

// ================================
// 错误处理工具
// ================================

/// 将 Result 转换为 Option，忽略错误
pub fn result_to_option<T, E>(result: Result<T, E>) -> Option<T> {
    result.ok()
}

/// 断言 Result 是 Ok 并返回值
pub fn unwrap_ok<T, E: std::fmt::Debug>(result: Result<T, E>) -> T {
    result.expect("Expected Ok but got Err")
}

/// 断言 Result 是 Err
pub fn assert_is_err<T: std::fmt::Debug, E>(result: Result<T, E>) {
    assert!(result.is_err(), "Expected Err but got Ok: {:?}", result.unwrap());
}

/// 断言 Result 是 Err 并包含指定消息
pub fn assert_err_contains<T: std::fmt::Debug, E: std::fmt::Display>(
    result: Result<T, E>,
    expected_msg: &str,
) {
    match result {
        Ok(value) => panic!("Expected Err but got Ok: {:?}", value),
        Err(e) => {
            let error_msg = e.to_string();
            assert!(
                error_msg.contains(expected_msg),
                "Error message '{}' does not contain '{}'",
                error_msg,
                expected_msg
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_temp_dir() {
        let temp_dir = create_temp_dir();
        assert!(temp_dir.path().exists());
    }

    #[test]
    fn test_create_temp_file_with_content() {
        let content = "Hello, World!";
        let (_dir, path) = create_temp_file_with_content(content);
        assert!(path.exists());
        assert_eq!(read_temp_file(&path), content);
    }

    #[tokio::test]
    async fn test_wait_for_condition() {
        let mut counter = 0;
        let success = wait_for_condition(|| {
            counter += 1;
            counter >= 5
        }, 1000).await;
        assert!(success);
        assert_eq!(counter, 5);
    }

    #[test]
    fn test_json_equals() {
        let json1 = serde_json::json!({"a": 1, "b": 2});
        let json2 = serde_json::json!({"b": 2, "a": 1});
        assert!(json_equals(&json1, &json2));
    }

    #[test]
    fn test_random_string() {
        let s = random_string(10);
        assert_eq!(s.len(), 10);
    }

    #[test]
    fn test_measure_time() {
        let (result, duration) = measure_time(|| {
            std::thread::sleep(Duration::from_millis(10));
            42
        });
        assert_eq!(result, 42);
        assert!(duration.as_millis() >= 10);
    }

    #[test]
    fn test_vec_eq_unordered() {
        let a = vec![1, 2, 3, 4];
        let b = vec![4, 3, 2, 1];
        assert!(vec_eq_unordered(&a, &b));
    }

    #[test]
    fn test_temp_env_var() {
        let key = "TEST_ENV_VAR_12345";
        std::env::remove_var(key);
        
        {
            let _temp = TempEnvVar::new(key, "test_value");
            assert_eq!(std::env::var(key).unwrap(), "test_value");
        }
        
        assert!(std::env::var(key).is_err());
    }
}

