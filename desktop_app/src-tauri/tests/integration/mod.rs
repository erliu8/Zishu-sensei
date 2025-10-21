//! 集成测试模块
//!
//! 包含所有集成测试子模块，测试完整的业务流程和模块间交互

// 多数据库集成测试
pub mod multi_database_test;

// 适配器完整生命周期测试
pub mod adapter_lifecycle_test;

// 聊天完整流程测试
pub mod chat_flow_test;

// 加密/解密流程测试
pub mod encryption_flow_test;

// 权限系统集成测试
pub mod permission_system_test;

// 数据库操作集成测试
pub mod database_operations_test;

// 文件操作集成测试
pub mod file_operations_test;

// 工作流执行测试
pub mod workflow_execution_test;

// 角色系统集成测试
pub mod character_system_test;

// 主题系统集成测试
pub mod theme_system_test;

// 更新系统集成测试
pub mod update_system_test;

