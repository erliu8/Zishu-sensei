# 集成测试文档

本目录包含 Zishu Sensei 项目的所有集成测试，用于测试系统各模块间的交互和完整业务流程。

## 📁 测试文件结构

```
integration/
├── mod.rs                          # 集成测试模块入口
├── adapter_lifecycle_test.rs       # 适配器完整生命周期测试
├── chat_flow_test.rs              # 聊天完整流程测试
├── encryption_flow_test.rs        # 加密/解密流程测试
├── permission_system_test.rs      # 权限系统集成测试
├── database_operations_test.rs    # 数据库操作集成测试
├── file_operations_test.rs        # 文件操作集成测试
├── workflow_execution_test.rs     # 工作流执行测试
├── character_system_test.rs       # 角色系统集成测试
├── theme_system_test.rs           # 主题系统集成测试
└── update_system_test.rs          # 更新系统集成测试
```

## 🎯 测试覆盖范围

### 1. 适配器生命周期测试 (`adapter_lifecycle_test.rs`)

测试适配器从安装到卸载的完整流程：

- ✅ 完整生命周期：注册 → 安装 → 配置 → 启用 → 使用 → 禁用 → 卸载
- ✅ 多适配器并发管理
- ✅ 版本更新和回滚
- ✅ 依赖关系管理
- ✅ 配置持久化和恢复
- ✅ 权限管理流程
- ✅ 异常情况处理

**测试数量**: 7 个测试

### 2. 聊天流程测试 (`chat_flow_test.rs`)

测试聊天从创建到存储的完整流程：

- ✅ 完整对话流程：创建会话 → 发送消息 → 接收响应 → 存储历史
- ✅ 多轮对话处理
- ✅ 并发会话管理
- ✅ 历史分页查询
- ✅ 会话级联删除
- ✅ 元数据存储
- ✅ 消息搜索功能

**测试数量**: 7 个测试

### 3. 加密流程测试 (`encryption_flow_test.rs`)

测试数据加密、存储、解密的完整流程：

- ✅ 完整加密流程：生成密钥 → 加密数据 → 存储 → 解密 → 验证
- ✅ 多数据项批量加密
- ✅ 密钥轮换流程
- ✅ 访问控制集成
- ✅ 批量加密迁移
- ✅ 加密数据备份恢复

**测试数量**: 6 个测试

### 4. 权限系统测试 (`permission_system_test.rs`)

测试权限申请、授予、检查、撤销的完整流程：

- ✅ 完整权限流程：申请 → 检查 → 授予 → 验证 → 撤销
- ✅ 权限层级和继承
- ✅ 多适配器权限隔离
- ✅ 权限审计日志
- ✅ 临时权限（时间限制）
- ✅ 权限组和批量操作
- ✅ 权限依赖关系

**测试数量**: 7 个测试

### 5. 数据库操作测试 (`database_operations_test.rs`)

测试数据库的 CRUD 操作和高级功能：

- ✅ 完整 CRUD 流程
- ✅ 批量操作（插入、更新、删除）
- ✅ 事务处理（提交和回滚）
- ✅ 并发访问
- ✅ 复杂查询和 JOIN 操作
- ✅ 索引性能测试
- ✅ 数据完整性约束
- ✅ 数据库备份和恢复

**测试数量**: 8 个测试

### 6. 文件操作测试 (`file_operations_test.rs`)

测试文件的创建、读写、权限管理：

- ✅ 完整文件操作流程
- ✅ 批量文件操作
- ✅ 文件权限和访问控制
- ✅ 目录操作
- ✅ 大文件处理
- ✅ 文件元数据管理
- ✅ 访问日志记录
- ✅ 文件搜索和过滤
- ✅ 二进制文件操作

**测试数量**: 9 个测试

### 7. 工作流执行测试 (`workflow_execution_test.rs`)

测试工作流的定义、触发、执行、监控：

- ✅ 完整工作流执行流程
- ✅ 失败处理和错误记录
- ✅ 并发工作流执行
- ✅ 版本管理
- ✅ 启用/禁用控制
- ✅ 执行历史查询
- ✅ 输入输出数据传递
- ✅ 历史清理和归档

**测试数量**: 8 个测试

### 8. 角色系统测试 (`character_system_test.rs`)

测试角色的加载、配置、切换：

- ✅ 完整角色管理流程
- ✅ 角色切换
- ✅ 动作和表情管理

**测试数量**: 3 个测试

### 9. 主题系统测试 (`theme_system_test.rs`)

测试主题的加载、应用、切换：

- ✅ 完整主题管理流程
- ✅ 主题配置更新

**测试数量**: 2 个测试

### 10. 更新系统测试 (`update_system_test.rs`)

测试版本检查和更新流程：

- ✅ 完整更新流程
- ✅ 版本历史记录

**测试数量**: 2 个测试

## 🚀 运行测试

### 运行所有集成测试

```bash
cd desktop_app/src-tauri
cargo test --test integration_tests integration::
```

### 运行特定模块的测试

```bash
# 适配器生命周期测试
cargo test --test integration_tests integration::adapter_lifecycle_test

# 聊天流程测试
cargo test --test integration_tests integration::chat_flow_test

# 加密流程测试
cargo test --test integration_tests integration::encryption_flow_test

# 权限系统测试
cargo test --test integration_tests integration::permission_system_test

# 数据库操作测试
cargo test --test integration_tests integration::database_operations_test

# 文件操作测试
cargo test --test integration_tests integration::file_operations_test

# 工作流执行测试
cargo test --test integration_tests integration::workflow_execution_test

# 角色系统测试
cargo test --test integration_tests integration::character_system_test

# 主题系统测试
cargo test --test integration_tests integration::theme_system_test

# 更新系统测试
cargo test --test integration_tests integration::update_system_test
```

### 运行特定测试

```bash
# 运行某个具体的测试函数
cargo test --test integration_tests test_complete_adapter_full_lifecycle

# 显示测试输出
cargo test --test integration_tests -- --nocapture

# 运行测试并显示详细信息
cargo test --test integration_tests -- --nocapture --test-threads=1
```

## 📊 测试统计

- **总测试文件数**: 10 个
- **总测试用例数**: 59+ 个
- **覆盖的业务流程**: 10+ 个核心业务流程
- **测试代码行数**: 3500+ 行

## ✅ 测试特点

### 1. 全面性
- 覆盖了从单个操作到完整业务流程的各个层面
- 包含正常场景和异常场景的测试
- 测试了边界条件和极端情况

### 2. 真实性
- 使用真实的数据库操作（SQLite）
- 模拟真实的文件系统操作
- 测试实际的业务逻辑流程

### 3. 独立性
- 每个测试都是独立的，可以单独运行
- 使用临时数据库和文件，测试间互不干扰
- 自动清理测试产生的数据

### 4. 健壮性
- 完善的错误处理测试
- 事务和回滚测试
- 并发场景测试
- 数据完整性验证

## 🔧 测试工具和辅助函数

集成测试使用了 `tests/common/` 目录下的通用工具：

- **fixtures.rs**: 测试数据生成器
- **helpers.rs**: 测试辅助函数
- **test_db.rs**: 测试数据库工具
- **mocks.rs**: Mock 对象

## 📈 持续改进

集成测试会随着项目的发展不断完善：

1. **新功能**: 每个新功能都应该有对应的集成测试
2. **Bug 修复**: 发现的 Bug 应该先写测试重现，再修复
3. **性能优化**: 添加性能基准测试
4. **覆盖率**: 保持高测试覆盖率（目标 ≥ 80%）

## 🎓 最佳实践

### 编写集成测试时应该：

1. **遵循 AAA 模式**: Arrange（准备）→ Act（执行）→ Assert（断言）
2. **清晰的测试名称**: 使用描述性的测试函数名
3. **独立且可重复**: 测试不依赖执行顺序，可以重复运行
4. **适当的粒度**: 既不过于细碎，也不过于庞大
5. **充分的断言**: 验证所有重要的结果和副作用
6. **清理资源**: 确保测试后清理所有资源

### 避免：

1. ❌ 测试间共享状态
2. ❌ 依赖外部服务或网络
3. ❌ 硬编码的时间或随机值（除非必要）
4. ❌ 过度复杂的测试逻辑
5. ❌ 忽略边界条件和异常情况

## 📞 支持

如有问题或建议，请：

1. 查看 `TEST_FRAMEWORK_PLAN.md` 了解整体测试策略
2. 参考现有测试代码作为示例
3. 提交 Issue 或 Pull Request

---

**最后更新**: 2025-10-21  
**维护者**: Zishu Sensei Team

