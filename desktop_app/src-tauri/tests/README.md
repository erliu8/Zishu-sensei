# 🧪 Rust 测试配置

## 🎉 最新更新：编译错误修复进度

**日期**: 2025-10-21  
**重大进展**: 所有线程安全错误已修复！

| 指标 | 数值 |
|------|------|
| 初始错误数 | 797 个 |
| 已修复错误 | 509 个 (E0277 线程安全) |
| 当前错误数 | ~275 个 |
| 完成度 | **63.9%** ✅ |

**修复详情**: 查看 [线程安全修复日志](./docs/THREAD_SAFETY_FIX_LOG.md) 和 [编译错误分析](./docs/COMPILATION_ERRORS_ANALYSIS.md)

---

## 📋 测试框架概览

### 🎯 测试工具链

#### 1. 单元测试 - 内置 `#[test]`
- ⚡ **快速执行**: 使用 Rust 内置测试框架
- 🔄 **异步支持**: 使用 `#[tokio::test]` 进行异步测试
- 📊 **断言工具**: 使用 `assert!` 和相关宏

#### 2. 集成测试 - `tests/` 目录
- 🔗 **模块间交互**: 测试多个模块的协作
- 📡 **API 测试**: 测试 Tauri 命令和事件
- ⏱️ **异步操作**: 测试异步业务流程

#### 3. 性能测试 - Criterion
- 📈 **基准测试**: 测量代码性能
- 🔍 **性能分析**: 识别性能瓶颈
- 📊 **性能报告**: 生成详细的性能报告

#### 4. Mock 测试 - Mockall
- 🎭 **依赖模拟**: 模拟外部依赖
- 🔧 **行为验证**: 验证函数调用
- 🧪 **隔离测试**: 独立测试单元

## 🚀 快速开始

### 运行测试

```bash
# 运行所有测试
cargo test

# 运行特定测试
cargo test test_adapter_manager

# 运行集成测试
cargo test --test integration_tests

# 运行性能测试
cargo bench

# 运行测试并显示输出
cargo test -- --nocapture

# 运行测试并生成报告
cargo test -- --format=pretty
```

### 测试覆盖率

```bash
# 安装 tarpaulin (覆盖率工具)
cargo install cargo-tarpaulin

# 生成覆盖率报告
cargo tarpaulin --out Html

# 生成覆盖率报告并上传到 Codecov
cargo tarpaulin --out Xml --out Html
```

## 📝 测试编写指南

### 单元测试示例

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_function_name() {
        // Arrange - 准备测试数据
        let input = "test input";
        
        // Act - 执行被测试的函数
        let result = function_under_test(input).await;
        
        // Assert - 验证结果
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), expected_value);
    }
}
```

### 集成测试示例

```rust
// tests/integration_test.rs
use zishu_sensei::*;

#[tokio::test]
async fn test_complete_workflow() {
    // 测试完整的业务流程
    let manager = AdapterManager::new();
    
    // 执行多个步骤
    let result = manager.load_adapter(adapter).await;
    assert!(result.is_ok());
    
    // 验证最终状态
    let adapters = manager.list_adapters().await;
    assert_eq!(adapters.len(), 1);
}
```

### Mock 测试示例

```rust
use mockall::*;

#[automock]
trait ExternalService {
    async fn call_api(&self, data: &str) -> Result<String, String>;
}

#[tokio::test]
async fn test_with_mock() {
    let mut mock_service = MockExternalService::new();
    
    // 设置 mock 行为
    mock_service
        .expect_call_api()
        .with(eq("test data"))
        .times(1)
        .returning(|_| Ok("mocked response".to_string()));
    
    // 使用 mock 进行测试
    let result = mock_service.call_api("test data").await;
    assert!(result.is_ok());
}
```

### 性能测试示例

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_function(c: &mut Criterion) {
    c.bench_function("function_name", |b| {
        b.iter(|| {
            // 被测试的函数
            function_under_test(black_box("test input"))
        })
    });
}

criterion_group!(benches, benchmark_function);
criterion_main!(benches);
```

## 🎨 测试最佳实践

### 1. 测试命名规范

```rust
// ✅ 好的命名
#[tokio::test]
async fn test_load_adapter_success() {}

#[tokio::test]
async fn test_load_adapter_with_invalid_data() {}

#[tokio::test]
async fn test_load_adapter_duplicate_id() {}

// ❌ 不好的命名
#[tokio::test]
async fn test1() {}

#[tokio::test]
async fn test_adapter() {}
```

### 2. 测试结构 (AAA 模式)

```rust
#[tokio::test]
async fn test_example() {
    // Arrange - 准备
    let manager = AdapterManager::new();
    let adapter = create_test_adapter();
    
    // Act - 执行
    let result = manager.load_adapter(adapter).await;
    
    // Assert - 断言
    assert!(result.is_ok());
    assert_eq!(manager.list_adapters().await.len(), 1);
}
```

### 3. 错误测试

```rust
#[tokio::test]
async fn test_error_handling() {
    let manager = AdapterManager::new();
    
    // 测试错误情况
    let result = manager.unload_adapter("non-existent").await;
    assert!(result.is_err());
    
    // 验证错误消息
    let error = result.unwrap_err();
    assert!(error.contains("不存在"));
}
```

### 4. 并发测试

```rust
#[tokio::test]
async fn test_concurrent_operations() {
    let manager = AdapterManager::new();
    
    // 并发执行多个操作
    let handles: Vec<_> = (0..10).map(|i| {
        let manager = manager.clone();
        tokio::spawn(async move {
            let adapter = create_test_adapter_with_id(i);
            manager.load_adapter(adapter).await
        })
    }).collect();
    
    // 等待所有操作完成
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }
}
```

## 🔧 测试工具和技巧

### 1. 测试数据生成

```rust
use fake::{Fake, Faker};

fn create_test_adapter() -> TestAdapter {
    TestAdapter {
        id: Faker.fake::<String>(),
        name: Faker.fake::<String>(),
        version: "1.0.0".to_string(),
        status: AdapterStatus::Loaded,
    }
}
```

### 2. 临时文件测试

```rust
use tempfile::TempDir;

#[tokio::test]
async fn test_with_temp_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("test.txt");
    
    // 使用临时文件进行测试
    std::fs::write(&file_path, "test content").unwrap();
    
    // 测试完成后临时文件会自动删除
}
```

### 3. 测试断言

```rust
use assert_matches::*;

#[tokio::test]
async fn test_with_assert_matches() {
    let result = function_under_test().await;
    
    // 使用 assert_matches 进行模式匹配
    assert_matches!(result, Ok(AdapterStatus::Loaded));
}
```

## 📊 测试覆盖率

### 覆盖率目标

- **函数覆盖率**: 90%
- **行覆盖率**: 85%
- **分支覆盖率**: 80%

### 查看覆盖率报告

```bash
cargo tarpaulin --out Html
```

报告将生成在 `tarpaulin-report.html` 文件中。

## 🐛 调试测试

### 1. 使用 println! 调试

```rust
#[tokio::test]
async fn test_with_debug() {
    let result = function_under_test().await;
    println!("Debug: {:?}", result);
    
    assert!(result.is_ok());
}
```

### 2. 使用 dbg! 宏

```rust
#[tokio::test]
async fn test_with_dbg() {
    let input = "test input";
    let result = function_under_test(dbg!(input)).await;
    
    assert!(result.is_ok());
}
```

### 3. 使用日志调试

```rust
use log::*;

#[tokio::test]
async fn test_with_logging() {
    env_logger::init();
    
    let result = function_under_test().await;
    info!("Test result: {:?}", result);
    
    assert!(result.is_ok());
}
```

## 📚 测试资源

### 官方文档

- [Rust 测试文档](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Tokio 测试文档](https://docs.rs/tokio-test/)
- [Mockall 文档](https://docs.rs/mockall/)
- [Criterion 文档](https://docs.rs/criterion/)

### 推荐阅读

- [Rust 测试最佳实践](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [异步测试指南](https://tokio.rs/tokio/tutorial/testing)
- [Mock 测试策略](https://docs.rs/mockall/latest/mockall/)

## 🤝 贡献指南

### 添加新测试

1. 确定测试类型（单元/集成/性能）
2. 选择合适的测试文件位置
3. 编写测试用例
4. 确保测试通过
5. 更新覆盖率

### 测试审查清单

- [ ] 测试覆盖了主要功能
- [ ] 测试名称清晰描述测试内容
- [ ] 使用了合适的断言
- [ ] 处理了异步操作
- [ ] 清理了测试副作用
- [ ] 测试独立且可重复

## 🚨 常见问题

### Q: 测试运行缓慢怎么办？

A: 
- 使用 `cargo test --release` 运行优化版本
- 并行运行测试 `cargo test --jobs 4`
- 只运行特定测试 `cargo test test_name`

### Q: 如何处理 Tauri API 测试？

A: 
- 使用 `tauri-test` 进行集成测试
- Mock Tauri 命令和事件
- 使用测试专用的 Tauri 配置

### Q: 异步测试不稳定怎么办？

A: 
- 使用 `tokio_test::block_on` 进行同步测试
- 增加适当的等待时间
- 使用 `tokio::time::timeout` 设置超时

---

**记住**: 好的测试是代码质量的保证，也是重构的信心来源！ 🎯
