//! 配置模块
//! 
//! 包含应用的各种配置

pub mod api_router;

// 重新导出常用类型
pub use api_router::{ApiBackend, ApiRouter};
