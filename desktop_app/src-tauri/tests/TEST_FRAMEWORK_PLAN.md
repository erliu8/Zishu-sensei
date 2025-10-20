# 🧪 Rust 测试框架完善计划

## 📋 目录结构

本测试框架采用**集中式测试目录**设计，所有测试都在 `tests/` 目录下统一管理，而不是分散在源代码中。

```
src-tauri/tests/
├── README.md                          # 测试使用文档
├── TEST_FRAMEWORK_PLAN.md            # 本文档 - 测试框架计划
├── common/                           # 测试通用工具和辅助函数
│   ├── mod.rs
│   ├── fixtures.rs                   # 测试数据fixture
│   ├── mocks.rs                      # Mock对象
│   ├── helpers.rs                    # 测试辅助函数
│   └── test_db.rs                    # 测试数据库工具
│
├── unit/                             # 单元测试
│   ├── mod.rs
│   ├── commands/                     # Commands模块测试（27个）
│   │   ├── mod.rs
│   │   ├── adapter_test.rs
│   │   ├── character_test.rs
│   │   ├── chat_test.rs
│   │   ├── database_test.rs
│   │   ├── desktop_test.rs
│   │   ├── encryption_test.rs
│   │   ├── error_monitoring_test.rs
│   │   ├── file_test.rs
│   │   ├── language_test.rs
│   │   ├── logging_test.rs
│   │   ├── market_test.rs
│   │   ├── memory_test.rs
│   │   ├── model_config_test.rs
│   │   ├── performance_test.rs
│   │   ├── permission_test.rs
│   │   ├── privacy_test.rs
│   │   ├── region_test.rs
│   │   ├── rendering_test.rs
│   │   ├── settings_test.rs
│   │   ├── shortcuts_test.rs
│   │   ├── startup_test.rs
│   │   ├── system_test.rs
│   │   ├── theme_test.rs
│   │   ├── update_test.rs
│   │   ├── window_test.rs
│   │   └── workflow_test.rs
│   │
│   ├── database/                     # Database模块测试（15个）
│   │   ├── mod.rs
│   │   ├── adapter_test.rs
│   │   ├── character_registry_test.rs
│   │   ├── encrypted_storage_test.rs
│   │   ├── error_test.rs
│   │   ├── file_test.rs
│   │   ├── logging_test.rs
│   │   ├── model_config_test.rs
│   │   ├── performance_test.rs
│   │   ├── permission_test.rs
│   │   ├── privacy_test.rs
│   │   ├── region_test.rs
│   │   ├── theme_test.rs
│   │   ├── update_test.rs
│   │   └── workflow_test.rs
│   │
│   ├── utils/                        # Utils模块测试（18个）
│   │   ├── mod.rs
│   │   ├── anonymizer_test.rs
│   │   ├── bridge_test.rs
│   │   ├── config_test.rs
│   │   ├── data_cleanup_test.rs
│   │   ├── data_masking_test.rs
│   │   ├── encryption_test.rs
│   │   ├── file_preview_test.rs
│   │   ├── file_system_test.rs
│   │   ├── key_manager_test.rs
│   │   ├── logger_test.rs
│   │   ├── memory_manager_test.rs
│   │   ├── permission_checker_test.rs
│   │   ├── region_detector_test.rs
│   │   ├── region_formatter_test.rs
│   │   ├── security_audit_test.rs
│   │   ├── startup_manager_test.rs
│   │   └── update_manager_test.rs
│   │
│   ├── state/                        # State模块测试
│   │   ├── mod.rs
│   │   ├── app_state_test.rs
│   │   ├── character_state_test.rs
│   │   ├── chat_state_test.rs
│   │   ├── settings_test.rs
│   │   └── tray_state_test.rs
│   │
│   ├── workflow/                     # Workflow模块测试
│   │   ├── mod.rs
│   │   ├── adapter_test.rs
│   │   ├── builtin_templates_test.rs
│   │   ├── engine_test.rs
│   │   ├── expression_test.rs
│   │   ├── models_test.rs
│   │   ├── registry_test.rs
│   │   ├── scheduler_test.rs
│   │   └── triggers_test.rs
│   │
│   └── events/                       # Events模块测试
│       ├── mod.rs
│       ├── character_test.rs
│       ├── chat_test.rs
│       ├── desktop_test.rs
│       ├── tray_test.rs
│       └── window_test.rs
│
├── integration/                      # 集成测试
│   ├── mod.rs
│   ├── adapter_lifecycle_test.rs     # 适配器完整生命周期
│   ├── chat_flow_test.rs            # 聊天完整流程
│   ├── encryption_flow_test.rs       # 加密/解密流程
│   ├── permission_system_test.rs     # 权限系统集成
│   ├── database_operations_test.rs   # 数据库操作集成
│   ├── file_operations_test.rs       # 文件操作集成
│   ├── workflow_execution_test.rs    # 工作流执行测试
│   ├── character_system_test.rs      # 角色系统集成
│   ├── theme_system_test.rs         # 主题系统集成
│   └── update_system_test.rs        # 更新系统集成
│
├── performance/                      # 性能测试（基准测试）
│   ├── mod.rs
│   ├── database_bench.rs            # 数据库性能
│   ├── encryption_bench.rs          # 加密性能
│   ├── file_operations_bench.rs     # 文件操作性能
│   ├── memory_bench.rs              # 内存管理性能
│   └── workflow_bench.rs            # 工作流性能
│
└── fixtures/                         # 测试数据文件
    ├── adapters/                    # 适配器测试数据
    ├── characters/                  # 角色测试数据
    ├── workflows/                   # 工作流测试数据
    └── configs/                     # 配置文件测试数据
```

## 🎯 测试覆盖目标

### 整体目标
- **总体覆盖率**: ≥ 80%
- **关键模块覆盖率**: ≥ 90%
- **测试文件数量**: ~95个测试文件

### 模块覆盖目标

| 模块 | 文件数 | 测试文件数 | 覆盖率目标 | 优先级 |
|------|--------|-----------|-----------|--------|
| Commands | 27 | 27 | 90% | ⭐⭐⭐ |
| Database | 15 | 15 | 90% | ⭐⭐⭐ |
| Utils | 18 | 18 | 85% | ⭐⭐⭐ |
| State | 6 | 6 | 85% | ⭐⭐ |
| Workflow | 9 | 9 | 85% | ⭐⭐ |
| Events | 6 | 6 | 80% | ⭐⭐ |
| Integration | - | 10 | - | ⭐⭐⭐ |
| Performance | - | 5 | - | ⭐ |

## 📝 测试编写规范

### 1. 测试文件命名规范

```rust
// 单元测试文件命名: {module_name}_test.rs
tests/unit/commands/adapter_test.rs
tests/unit/database/encrypted_storage_test.rs
tests/unit/utils/encryption_test.rs

// 集成测试文件命名: {feature}_test.rs
tests/integration/adapter_lifecycle_test.rs
tests/integration/chat_flow_test.rs

// 性能测试文件命名: {module}_bench.rs
tests/performance/database_bench.rs
tests/performance/encryption_bench.rs
```

### 2. 测试函数命名规范

```rust
// 格式: test_{function_name}_{scenario}_{expected_result}
#[tokio::test]
async fn test_load_adapter_success() {}

#[tokio::test]
async fn test_load_adapter_with_invalid_data_returns_error() {}

#[tokio::test]
async fn test_unload_adapter_when_not_exists_returns_error() {}

#[test]
fn test_encrypt_data_with_valid_key_success() {}

#[test]
fn test_decrypt_data_with_wrong_key_fails() {}
```

### 3. 测试结构（AAA模式）

```rust
#[tokio::test]
async fn test_example() {
    // ========== Arrange (准备) ==========
    // 准备测试数据、Mock对象、测试环境
    let test_db = setup_test_database().await;
    let manager = AdapterManager::new(test_db.clone());
    let test_adapter = create_test_adapter("test-adapter");
    
    // ========== Act (执行) ==========
    // 执行被测试的功能
    let result = manager.load_adapter(test_adapter).await;
    
    // ========== Assert (断言) ==========
    // 验证结果是否符合预期
    assert!(result.is_ok());
    assert_eq!(manager.list_adapters().await.len(), 1);
    
    // ========== Cleanup (清理) ==========
    // 清理测试数据和资源
    cleanup_test_database(test_db).await;
}
```

### 4. 测试组织模式

```rust
// tests/unit/commands/adapter_test.rs
use zishu_sensei::commands::adapter::*;
use crate::common::{fixtures::*, mocks::*, helpers::*};

mod load_adapter {
    use super::*;

    #[tokio::test]
    async fn success_with_valid_adapter() {
        // 测试正常加载场景
    }

    #[tokio::test]
    async fn fails_with_invalid_adapter() {
        // 测试无效适配器场景
    }

    #[tokio::test]
    async fn fails_with_duplicate_id() {
        // 测试重复ID场景
    }
}

mod unload_adapter {
    use super::*;

    #[tokio::test]
    async fn success_when_adapter_exists() {
        // 测试正常卸载场景
    }

    #[tokio::test]
    async fn fails_when_adapter_not_found() {
        // 测试适配器不存在场景
    }
}

mod list_adapters {
    use super::*;

    #[tokio::test]
    async fn returns_empty_when_no_adapters() {
        // 测试无适配器场景
    }

    #[tokio::test]
    async fn returns_all_loaded_adapters() {
        // 测试有适配器场景
    }
}
```

## 🛠️ 通用测试工具

### 1. Fixtures（测试数据）

```rust
// tests/common/fixtures.rs

use serde_json::json;

/// 创建测试用的适配器数据
pub fn create_test_adapter(id: &str) -> serde_json::Value {
    json!({
        "id": id,
        "name": format!("Test Adapter {}", id),
        "version": "1.0.0",
        "type": "openai",
        "config": {
            "api_key": "test-key",
            "model": "gpt-3.5-turbo"
        }
    })
}

/// 创建测试用的角色数据
pub fn create_test_character(id: &str) -> serde_json::Value {
    json!({
        "id": id,
        "name": format!("Test Character {}", id),
        "description": "A test character",
        "avatar": "test-avatar.png"
    })
}

/// 创建测试用的聊天消息
pub fn create_test_message(role: &str, content: &str) -> serde_json::Value {
    json!({
        "role": role,
        "content": content,
        "timestamp": chrono::Utc::now().timestamp()
    })
}
```

### 2. Mocks（模拟对象）

```rust
// tests/common/mocks.rs

use mockall::*;
use async_trait::async_trait;

#[automock]
#[async_trait]
pub trait DatabaseService {
    async fn get(&self, key: &str) -> Result<String, String>;
    async fn set(&self, key: &str, value: &str) -> Result<(), String>;
    async fn delete(&self, key: &str) -> Result<(), String>;
}

#[automock]
#[async_trait]
pub trait ApiClient {
    async fn call_api(&self, endpoint: &str, data: &str) -> Result<String, String>;
}

pub fn create_mock_database() -> MockDatabaseService {
    let mut mock = MockDatabaseService::new();
    
    // 设置默认行为
    mock.expect_get()
        .returning(|_| Ok("test-value".to_string()));
    
    mock.expect_set()
        .returning(|_, _| Ok(()));
    
    mock
}
```

### 3. Helpers（测试辅助函数）

```rust
// tests/common/helpers.rs

use tempfile::TempDir;
use std::path::PathBuf;

/// 创建临时测试目录
pub fn create_temp_dir() -> TempDir {
    TempDir::new().expect("Failed to create temp dir")
}

/// 创建测试用的临时文件
pub fn create_temp_file(content: &str) -> (TempDir, PathBuf) {
    let dir = create_temp_dir();
    let file_path = dir.path().join("test.txt");
    std::fs::write(&file_path, content).expect("Failed to write test file");
    (dir, file_path)
}

/// 等待异步条件满足
pub async fn wait_for_condition<F>(mut condition: F, timeout_ms: u64) -> bool
where
    F: FnMut() -> bool,
{
    let start = std::time::Instant::now();
    while !condition() {
        if start.elapsed().as_millis() > timeout_ms as u128 {
            return false;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }
    true
}
```

### 4. 测试数据库工具

```rust
// tests/common/test_db.rs

use rusqlite::Connection;
use tempfile::TempDir;
use std::path::PathBuf;

pub struct TestDatabase {
    pub connection: Connection,
    _temp_dir: TempDir,
    pub path: PathBuf,
}

impl TestDatabase {
    /// 创建测试数据库
    pub fn new() -> Self {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");
        let connection = Connection::open(&db_path)
            .expect("Failed to open test database");
        
        Self {
            connection,
            _temp_dir: temp_dir,
            path: db_path,
        }
    }
    
    /// 初始化数据库表结构
    pub fn setup_schema(&self) -> Result<(), rusqlite::Error> {
        self.connection.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS adapters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT NOT NULL
            );
            "
        )?;
        Ok(())
    }
    
    /// 清空所有数据
    pub fn clear_data(&self) -> Result<(), rusqlite::Error> {
        self.connection.execute_batch(
            "
            DELETE FROM adapters;
            DELETE FROM characters;
            "
        )?;
        Ok(())
    }
}
```

## 📊 测试配置

### 1. Cargo.toml 配置

```toml
# 已在主 Cargo.toml 中配置的测试依赖
[dev-dependencies]
tokio-test = "0.4"
tempfile = "3.8"
mockall = "0.12"
mockito = "1.2"
wiremock = "0.5"
assert_matches = "1.5"
proptest = "1.4"
fake = "2.9"
quickcheck = "1.0"
criterion = "0.5"

# 性能测试配置
[[bench]]
name = "database_bench"
harness = false

[[bench]]
name = "encryption_bench"
harness = false

# 集成测试配置
[[test]]
name = "integration_tests"
path = "tests/integration/mod.rs"
```

### 2. .cargo/config.toml（测试配置）

```toml
[target.'cfg(test)']
rustflags = ["-C", "instrument-coverage"]

[env]
RUST_TEST_THREADS = "1"  # 串行运行测试（如果需要）
RUST_BACKTRACE = "1"     # 显示完整错误堆栈
```

## 🚀 测试命令和脚本

### 运行测试

```bash
# 运行所有测试
cargo test

# 运行单元测试
cargo test --lib

# 运行集成测试
cargo test --test integration_tests

# 运行特定模块测试
cargo test unit::commands::adapter

# 运行特定测试
cargo test test_load_adapter_success

# 显示测试输出
cargo test -- --nocapture

# 并行运行测试
cargo test -- --test-threads=4

# 运行性能测试
cargo bench

# 运行特定性能测试
cargo bench database_bench
```

### 测试覆盖率

```bash
# 安装覆盖率工具
cargo install cargo-tarpaulin

# 生成HTML覆盖率报告
cargo tarpaulin --out Html --output-dir coverage

# 生成多种格式的报告
cargo tarpaulin --out Html --out Xml --output-dir coverage

# 只测试特定包
cargo tarpaulin --out Html --lib --tests

# 排除某些文件
cargo tarpaulin --out Html --exclude-files 'src/main.rs'
```

### 持续集成脚本

```bash
#!/bin/bash
# scripts/run_tests.sh

echo "🧪 Running Rust tests..."

# 运行单元测试
echo "📝 Running unit tests..."
cargo test --lib -- --test-threads=1

# 运行集成测试
echo "🔗 Running integration tests..."
cargo test --test integration_tests

# 生成覆盖率报告
echo "📊 Generating coverage report..."
cargo tarpaulin --out Html --out Xml --output-dir coverage

# 检查覆盖率是否达标
echo "✅ Checking coverage threshold..."
# 解析覆盖率并检查是否 >= 80%

echo "✨ All tests passed!"
```

## 📅 实施计划

### Phase 1: 基础设施搭建（Week 1）

**目标**: 建立测试框架基础设施

- [ ] 创建测试目录结构
- [ ] 实现通用测试工具（fixtures, mocks, helpers）
- [ ] 配置测试环境和依赖
- [ ] 编写测试模板和示例
- [ ] 设置 CI/CD 集成

**交付物**:
- ✅ 完整的测试目录结构
- ✅ 通用测试工具库
- ✅ 测试配置文件
- ✅ 测试编写指南

### Phase 2: 核心模块测试（Week 2-3）

**目标**: 完成关键模块的测试覆盖

#### Week 2: Commands & Database

**Commands 测试** (27个文件) - 优先级 ⭐⭐⭐
- [ ] adapter_test.rs - 适配器管理命令
- [ ] encryption_test.rs - 加密相关命令（17个命令）
- [ ] permission_test.rs - 权限管理命令（18个命令）
- [ ] file_test.rs - 文件操作命令（15个命令）
- [ ] chat_test.rs - 聊天相关命令
- [ ] character_test.rs - 角色管理命令
- [ ] database_test.rs - 数据库命令
- [ ] desktop_test.rs - 桌面集成命令
- [ ] error_monitoring_test.rs - 错误监控命令
- [ ] language_test.rs - 语言命令
- [ ] logging_test.rs - 日志命令
- [ ] market_test.rs - 市场命令
- [ ] memory_test.rs - 内存命令
- [ ] model_config_test.rs - 模型配置命令
- [ ] performance_test.rs - 性能命令
- [ ] privacy_test.rs - 隐私命令
- [ ] region_test.rs - 区域命令
- [ ] rendering_test.rs - 渲染命令
- [ ] settings_test.rs - 设置命令
- [ ] shortcuts_test.rs - 快捷键命令
- [ ] startup_test.rs - 启动命令
- [ ] system_test.rs - 系统命令
- [ ] theme_test.rs - 主题命令
- [ ] update_test.rs - 更新命令
- [ ] window_test.rs - 窗口命令
- [ ] workflow_test.rs - 工作流命令

**Database 测试** (15个文件) - 优先级 ⭐⭐⭐
- [ ] encrypted_storage_test.rs - 加密存储
- [ ] adapter_test.rs - 适配器数据库
- [ ] permission_test.rs - 权限数据库
- [ ] character_registry_test.rs - 角色注册表
- [ ] workflow_test.rs - 工作流数据库
- [ ] file_test.rs - 文件数据库
- [ ] logging_test.rs - 日志数据库
- [ ] model_config_test.rs - 模型配置数据库
- [ ] performance_test.rs - 性能数据库
- [ ] privacy_test.rs - 隐私数据库
- [ ] region_test.rs - 区域数据库
- [ ] theme_test.rs - 主题数据库
- [ ] update_test.rs - 更新数据库
- [ ] error_test.rs - 错误处理

#### Week 3: Utils & State

**Utils 测试** (18个文件) - 优先级 ⭐⭐⭐
- [ ] encryption_test.rs - 加密工具
- [ ] key_manager_test.rs - 密钥管理
- [ ] security_audit_test.rs - 安全审计
- [ ] permission_checker_test.rs - 权限检查
- [ ] data_masking_test.rs - 数据脱敏
- [ ] anonymizer_test.rs - 匿名化
- [ ] file_system_test.rs - 文件系统
- [ ] file_preview_test.rs - 文件预览
- [ ] memory_manager_test.rs - 内存管理
- [ ] logger_test.rs - 日志工具
- [ ] region_detector_test.rs - 区域检测
- [ ] region_formatter_test.rs - 区域格式化
- [ ] config_test.rs - 配置
- [ ] bridge_test.rs - 桥接
- [ ] data_cleanup_test.rs - 数据清理
- [ ] startup_manager_test.rs - 启动管理
- [ ] update_manager_test.rs - 更新管理

**State 测试** (6个文件) - 优先级 ⭐⭐
- [ ] app_state_test.rs - 应用状态
- [ ] character_state_test.rs - 角色状态
- [ ] chat_state_test.rs - 聊天状态
- [ ] settings_test.rs - 设置状态
- [ ] tray_state_test.rs - 托盘状态

### Phase 3: 其他模块测试（Week 4）

**Workflow 测试** (9个文件) - 优先级 ⭐⭐
- [ ] engine_test.rs - 工作流引擎
- [ ] expression_test.rs - 表达式解析
- [ ] adapter_test.rs - 适配器集成
- [ ] scheduler_test.rs - 调度器
- [ ] registry_test.rs - 注册表
- [ ] triggers_test.rs - 触发器
- [ ] models_test.rs - 模型
- [ ] builtin_templates_test.rs - 内置模板

**Events 测试** (6个文件) - 优先级 ⭐⭐
- [ ] character_test.rs - 角色事件
- [ ] chat_test.rs - 聊天事件
- [ ] desktop_test.rs - 桌面事件
- [ ] tray_test.rs - 托盘事件
- [ ] window_test.rs - 窗口事件

### Phase 4: 集成测试（Week 5）

**Integration 测试** (10个文件) - 优先级 ⭐⭐⭐

- [ ] adapter_lifecycle_test.rs - 适配器完整生命周期
  - 加载 → 配置 → 使用 → 卸载
  
- [ ] chat_flow_test.rs - 聊天完整流程
  - 发送消息 → 处理 → 存储 → 响应
  
- [ ] encryption_flow_test.rs - 加密/解密流程
  - 生成密钥 → 加密数据 → 存储 → 解密 → 验证
  
- [ ] permission_system_test.rs - 权限系统集成
  - 权限检查 → 授权 → 验证 → 撤销
  
- [ ] database_operations_test.rs - 数据库操作集成
  - 创建 → 读取 → 更新 → 删除 → 事务
  
- [ ] file_operations_test.rs - 文件操作集成
  - 创建 → 读取 → 写入 → 删除 → 权限检查
  
- [ ] workflow_execution_test.rs - 工作流执行
  - 定义工作流 → 触发 → 执行 → 完成
  
- [ ] character_system_test.rs - 角色系统集成
  - 加载角色 → 配置 → 交互 → 状态管理
  
- [ ] theme_system_test.rs - 主题系统集成
  - 加载主题 → 应用 → 切换 → 持久化
  
- [ ] update_system_test.rs - 更新系统集成
  - 检查更新 → 下载 → 安装 → 重启

### Phase 5: 性能测试（Week 6）

**Performance 测试** (5个文件) - 优先级 ⭐

- [ ] database_bench.rs - 数据库性能
  - 插入性能
  - 查询性能
  - 更新性能
  - 并发性能
  
- [ ] encryption_bench.rs - 加密性能
  - AES-GCM 加密/解密
  - 密钥派生
  - 签名验证
  
- [ ] file_operations_bench.rs - 文件操作性能
  - 读取大文件
  - 写入大文件
  - 批量操作
  
- [ ] memory_bench.rs - 内存管理性能
  - 内存分配
  - 缓存性能
  - 垃圾回收
  
- [ ] workflow_bench.rs - 工作流性能
  - 表达式求值
  - 工作流执行
  - 并发工作流

## 📈 测试质量保证

### 1. 代码审查清单

每个测试文件提交前需要检查：

- [ ] 测试覆盖了所有公开函数
- [ ] 测试覆盖了正常和异常场景
- [ ] 测试函数命名清晰描述测试内容
- [ ] 使用了 AAA 模式组织测试
- [ ] 正确处理了异步操作
- [ ] 清理了测试产生的副作用
- [ ] 测试独立且可重复运行
- [ ] 包含了必要的文档注释

### 2. 覆盖率检查

```bash
# 每周检查覆盖率进度
cargo tarpaulin --out Html

# 检查是否达到目标覆盖率
# Commands: >= 90%
# Database: >= 90%
# Utils: >= 85%
# State: >= 85%
# Workflow: >= 85%
# Events: >= 80%
```

### 3. 性能基准

```bash
# 定期运行性能测试
cargo bench

# 对比性能变化
# 确保性能没有退化
```

## 🔧 常见测试模式

### 1. 异步测试

```rust
#[tokio::test]
async fn test_async_function() {
    let result = async_function().await;
    assert!(result.is_ok());
}
```

### 2. 错误处理测试

```rust
#[test]
fn test_error_handling() {
    let result = function_that_returns_error();
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Expected error message");
}
```

### 3. Mock测试

```rust
#[tokio::test]
async fn test_with_mock() {
    let mut mock_db = MockDatabaseService::new();
    mock_db
        .expect_get()
        .with(eq("key"))
        .times(1)
        .returning(|_| Ok("value".to_string()));
    
    let result = mock_db.get("key").await;
    assert_eq!(result.unwrap(), "value");
}
```

### 4. 临时文件测试

```rust
#[tokio::test]
async fn test_file_operations() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("test.txt");
    
    // 使用临时文件进行测试
    std::fs::write(&file_path, "test content").unwrap();
    
    // 测试完成后临时文件会自动删除
}
```

### 5. 并发测试

```rust
#[tokio::test]
async fn test_concurrent_operations() {
    let handles: Vec<_> = (0..10)
        .map(|i| {
            tokio::spawn(async move {
                perform_operation(i).await
            })
        })
        .collect();
    
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }
}
```

## 📚 参考资源

### 官方文档
- [Rust Testing](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Tokio Testing](https://tokio.rs/tokio/tutorial/testing)
- [Mockall](https://docs.rs/mockall/)
- [Criterion](https://docs.rs/criterion/)

### 最佳实践
- [Rust Test Best Practices](https://doc.rust-lang.org/book/ch11-03-test-organization.html)
- [Testing Async Rust](https://tokio.rs/tokio/topics/testing)
- [Property-based Testing](https://github.com/BurntSushi/quickcheck)

## 🎯 成功标准

### 完成标准

- ✅ 所有模块都有对应的测试文件
- ✅ 总体测试覆盖率 >= 80%
- ✅ 关键模块覆盖率 >= 90%
- ✅ 所有测试都能通过
- ✅ 集成测试覆盖主要业务流程
- ✅ 性能测试建立基准
- ✅ CI/CD 集成完成
- ✅ 测试文档完善

### 质量指标

- **测试通过率**: 100%
- **测试稳定性**: 无flaky tests
- **测试执行时间**: < 5分钟
- **代码覆盖率**: >= 80%
- **性能基准**: 建立并监控

---

**最后更新**: 2024-10-20
**负责人**: Zishu Team
**状态**: 待实施

