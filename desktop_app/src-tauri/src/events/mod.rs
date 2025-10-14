//! 事件处理模块
//! 
//! 提供窗口事件、托盘事件等各种事件的处理功能

pub mod window;
pub mod tray;
pub mod chat;
pub mod character;
pub mod desktop;

// 重新导出常用的事件处理函数
pub use window::{handle_window_event, create_window_event_handler, WindowEventHandler};
pub use tray::{handle_system_tray_event, create_system_tray, TrayEventHandler};

// 导出辅助函数
pub use window::helpers as window_helpers;
pub use tray::helpers as tray_helpers;
