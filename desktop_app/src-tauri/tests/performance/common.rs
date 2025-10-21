// tests/performance/common.rs
//! 性能测试通用工具
//! 
//! 提供性能测试所需的共享辅助函数和数据生成器

use rand::{Rng, thread_rng};
use rand::distributions::Alphanumeric;
use std::path::PathBuf;
use tempfile::TempDir;

/// 生成随机字符串
pub fn random_string(len: usize) -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

/// 生成随机字节数组
pub fn random_bytes(len: usize) -> Vec<u8> {
    let mut rng = thread_rng();
    (0..len).map(|_| rng.gen()).collect()
}

/// 创建临时测试目录
pub fn create_temp_test_dir() -> TempDir {
    TempDir::new().expect("Failed to create temp dir")
}

/// 创建临时数据库路径
pub fn create_temp_db_path() -> (TempDir, PathBuf) {
    let dir = create_temp_test_dir();
    let db_path = dir.path().join("benchmark.db");
    (dir, db_path)
}

/// 生成测试数据集
pub fn generate_test_dataset(count: usize, item_size: usize) -> Vec<Vec<u8>> {
    (0..count)
        .map(|_| random_bytes(item_size))
        .collect()
}

/// 生成键值对测试数据
pub fn generate_kv_dataset(count: usize) -> Vec<(String, String)> {
    (0..count)
        .map(|i| (format!("key_{}", i), random_string(100)))
        .collect()
}

/// 性能测试配置
pub struct BenchConfig {
    pub small_dataset_size: usize,
    pub medium_dataset_size: usize,
    pub large_dataset_size: usize,
    pub data_sizes: Vec<usize>,
}

impl Default for BenchConfig {
    fn default() -> Self {
        Self {
            small_dataset_size: 100,
            medium_dataset_size: 1_000,
            large_dataset_size: 10_000,
            data_sizes: vec![1024, 10240, 102400, 1024000], // 1KB, 10KB, 100KB, 1MB
        }
    }
}

