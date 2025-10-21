//! Commands模块单元测试
//!
//! 对所有Tauri命令处理器进行全面测试

// 测试模块声明 - 第一批 (前10个)
mod adapter_test;
mod encryption_test;
mod permission_test;
mod file_test;
mod chat_test;
mod character_test;
mod database_test;
mod desktop_test;
mod error_monitoring_test;
mod language_test;

// 测试模块声明 - 第二批 (后10个)
mod logging_test;
mod market_test;
mod memory_test;
mod model_config_test;
mod performance_test;
mod privacy_test;
mod region_test;
mod rendering_test;
mod settings_test;
mod shortcuts_test;

// 测试模块声明 - 第三批 (新增的6个)
mod startup_test;
mod system_test;
mod theme_test;
mod update_test;
mod window_test;
mod workflow_test;

// 重新导出以便外部使用 - 第一批
pub use adapter_test::*;
pub use encryption_test::*;
pub use permission_test::*;
pub use file_test::*;
pub use chat_test::*;
pub use character_test::*;
pub use database_test::*;
pub use desktop_test::*;
pub use error_monitoring_test::*;
pub use language_test::*;

// 重新导出以便外部使用 - 第二批
pub use logging_test::*;
pub use market_test::*;
pub use memory_test::*;
pub use model_config_test::*;
pub use performance_test::*;
pub use privacy_test::*;
pub use region_test::*;
pub use rendering_test::*;
pub use settings_test::*;
pub use shortcuts_test::*;

// 重新导出以便外部使用 - 第三批
pub use startup_test::*;
pub use system_test::*;
pub use theme_test::*;
pub use update_test::*;
pub use window_test::*;
pub use workflow_test::*;

