// Database模块测试套件
//
// 测试database模块的各个组件

// 数据库后端测试
pub mod postgres_backend_test;
pub mod redis_backend_test;
pub mod qdrant_backend_test;

// 原有测试
pub mod encrypted_storage_test;
pub mod adapter_test;
pub mod permission_test;
pub mod character_registry_test;
pub mod workflow_test;
pub mod file_test;
pub mod conversation_test;
pub mod config_test;
pub mod error_test;
pub mod logging_test;
pub mod model_config_test;
pub mod performance_test;
pub mod privacy_test;
pub mod region_test;
pub mod theme_test;
pub mod update_test;

