# 数据库单元测试

桌面应用的数据库单元测试套件，支持PostgreSQL、Redis和Qdrant三种数据库后端。

## 数据库后端

### PostgreSQL
- **用途**: 主要关系型数据存储
- **支持功能**: 所有结构化数据（适配器、角色、工作流、配置、权限等）
- **特点**: 
  - 完整的ACID事务支持
  - 复杂查询和关系管理
  - 外键约束和级联删除
  - JSONB类型支持

### Redis
- **用途**: 缓存和快速访问
- **支持功能**: 
  - 适配器元数据缓存
  - 会话数据
  - 临时数据存储
- **特点**:
  - 高性能键值存储
  - TTL过期支持
  - 内存存储

### Qdrant
- **用途**: 向量数据库
- **支持功能**: 
  - 向量存储和相似度搜索
  - 语义搜索
- **特点**:
  - 专为向量操作优化
  - 高效的相似度搜索
  - 支持payload元数据

## 测试文件结构

### 已重构为多后端支持的文件

#### `adapter_test.rs`
- **PostgreSQL测试**: 完整的适配器CRUD、版本管理、依赖管理、权限管理
- **Redis测试**: 基本的适配器缓存操作
- **说明**: Qdrant不用于适配器结构化数据存储

#### `character_registry_test.rs`
- **PostgreSQL测试**: 角色CRUD、配置管理、激活管理、动作和表情管理
- **说明**: 角色数据主要存储在PostgreSQL

#### 后端特定测试文件

- `postgres_backend_test.rs`: PostgreSQL后端的基础测试（连接、集合操作、CRUD等）
- `redis_backend_test.rs`: Redis后端的基础测试（连接、缓存操作、过期时间等）
- `qdrant_backend_test.rs`: Qdrant后端的基础测试（连接、集合管理、向量操作等）

### 其他测试文件（使用PostgreSQL）

以下测试文件主要使用PostgreSQL后端：

- `workflow_test.rs`: 工作流管理测试
- `config_test.rs`: 配置管理测试
- `permission_test.rs`: 权限管理测试
- `file_test.rs`: 文件元数据测试
- `conversation_test.rs`: 对话管理测试
- `theme_test.rs`: 主题管理测试
- `region_test.rs`: 地区设置测试
- `privacy_test.rs`: 隐私设置测试
- `performance_test.rs`: 性能测试
- `logging_test.rs`: 日志测试
- `error_test.rs`: 错误处理测试
- `model_config_test.rs`: 模型配置测试
- `update_test.rs`: 更新管理测试
- `encrypted_storage_test.rs`: 加密存储测试

## 运行测试

### 准备环境

1. 启动数据库服务：
```bash
cd /opt/zishu-sensei
docker-compose up -d postgres redis qdrant
```

2. 设置环境变量（可选）：
```bash
export TEST_POSTGRES_URL="postgresql://postgres:password@localhost:5432/test_db"
export TEST_REDIS_URL="redis://127.0.0.1:6379"
export TEST_QDRANT_URL="http://localhost:6334"
```

### 运行测试

#### 运行所有测试（需要数据库服务）
```bash
cargo test --test unit -- database --ignored
```

#### 运行特定后端的测试

PostgreSQL测试：
```bash
cargo test --test unit -- database::postgres --ignored
```

Redis测试：
```bash
cargo test --test unit -- database::redis --ignored
```

Qdrant测试：
```bash
cargo test --test unit -- database::qdrant --ignored
```

#### 运行特定功能的测试

适配器测试：
```bash
cargo test --test unit -- database::adapter_test --ignored
```

角色测试：
```bash
cargo test --test unit -- database::character_registry_test --ignored
```

## 测试辅助工具

### `common/test_db.rs`

提供数据库测试的辅助函数和结构：

- `setup_test_postgres()`: 创建并初始化PostgreSQL测试数据库
- `setup_test_postgres_with_tables(tables: &[&str])`: 创建PostgreSQL数据库并初始化指定表
- `setup_test_redis()`: 创建并连接Redis测试数据库
- `setup_test_redis_with_prefix(prefix: &str)`: 创建带指定前缀的Redis测试数据库

### `common/multi_db_helpers.rs`

提供跨数据库的测试辅助工具：

- 测试数据生成器
- 数据库配置获取
- 清理助手
- 性能测试工具
- 断言工具

## 测试模式

### AAA模式（Arrange-Act-Assert）

所有测试遵循AAA模式：

```rust
#[tokio::test]
#[ignore]
async fn test_example() {
    // ========== Arrange ==========
    let registry = setup_test_registry().await;
    let data = create_test_data();

    // ========== Act ==========
    let result = registry.perform_operation(data).await;

    // ========== Assert ==========
    assert!(result.is_ok(), "操作应该成功");
}
```

### 测试分组

测试按功能分组为模块：

```rust
mod crud_operations {
    // CRUD相关测试
}

mod status_management {
    // 状态管理测试
}

mod edge_cases {
    // 边界情况测试
}
```

## 注意事项

1. **测试隔离**: 每个测试都应该独立运行，不依赖其他测试的状态
2. **数据清理**: 测试应该在完成后清理数据（通过级联删除或显式清理）
3. **异步测试**: 所有数据库操作都是异步的，使用 `#[tokio::test]`
4. **Ignore标记**: 需要真实数据库的测试标记为 `#[ignore]`，用 `--ignored` 运行
5. **错误处理**: 测试应该验证成功和失败的场景
6. **边界条件**: 包含边界情况和特殊情况的测试

## 迁移说明

### 从SQLite迁移

之前的测试使用SQLite内存数据库：
```rust
// 旧代码
let conn = Connection::open_in_memory().expect("无法创建内存数据库");
```

现在使用PostgreSQL：
```rust
// 新代码
let pg = setup_test_postgres().await;
let registry = Registry::new(pg.backend.pool.clone());
```

主要变化：
1. 同步代码改为异步 (`async`/`.await`)
2. SQLite连接改为PostgreSQL连接池
3. 内存数据库改为实际的PostgreSQL测试数据库
4. 测试函数标记为 `#[ignore]` 需要手动运行

## 最佳实践

1. **使用辅助函数**: 利用 `common/test_db.rs` 中的辅助函数
2. **清晰的测试名称**: 测试名称应该描述测试的场景和预期结果
3. **适当的断言消息**: 提供有意义的失败消息
4. **测试覆盖**: 确保覆盖正常流程、错误情况和边界条件
5. **性能考虑**: 避免在测试中进行不必要的数据库操作

## 故障排查

### 连接失败

如果测试失败并显示连接错误：
1. 确保数据库服务正在运行
2. 检查连接字符串是否正确
3. 验证网络连接和端口

### 测试超时

如果测试超时：
1. 检查数据库性能
2. 增加超时时间
3. 优化测试中的查询

### 数据冲突

如果测试因数据冲突失败：
1. 确保每个测试使用唯一的ID
2. 清理测试数据
3. 使用事务隔离

## 贡献指南

添加新测试时：
1. 遵循AAA模式
2. 使用适当的测试分组
3. 添加 `#[ignore]` 标记（如需要数据库）
4. 提供清晰的注释
5. 确保测试可以独立运行

