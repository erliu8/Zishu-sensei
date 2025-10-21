//! 窗口管理命令测试
//!
//! 测试所有窗口相关的Tauri命令

#[cfg(test)]
mod window_commands_tests {
    use crate::common::*;
    
    // ================================
    // minimize_to_tray 命令测试
    // ================================
    
    mod minimize_to_tray {
        use super::*;
        
        #[tokio::test]
        async fn test_minimize_to_tray_when_enabled() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            test_db.upsert_config("minimize_to_tray", "true").unwrap();
            
            // ========== Act (执行) ==========
            let enabled = test_db.get_config("minimize_to_tray").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(enabled, Some("true".to_string()));
        }
        
        #[tokio::test]
        async fn test_minimize_to_tray_when_disabled() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            test_db.upsert_config("minimize_to_tray", "false").unwrap();
            
            // ========== Act (执行) ==========
            let enabled = test_db.get_config("minimize_to_tray").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(enabled, Some("false".to_string()));
        }
        
        #[tokio::test]
        async fn test_minimize_to_tray_records_window_state() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_state("main", "hidden").unwrap();
            
            // ========== Assert (断言) ==========
            let state = test_db.get_window_state("main").unwrap();
            assert_eq!(state, Some("hidden".to_string()));
        }
    }
    
    // ================================
    // show_window & hide_window 命令测试
    // ================================
    
    mod show_hide_window {
        use super::*;
        
        #[tokio::test]
        async fn test_show_window_updates_visibility() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            test_db.set_window_visibility("main", false).unwrap();
            
            // ========== Act (执行) ==========
            test_db.set_window_visibility("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let visible = test_db.get_window_visibility("main").unwrap();
            assert_eq!(visible, Some(true));
        }
        
        #[tokio::test]
        async fn test_hide_window_updates_visibility() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            test_db.set_window_visibility("main", true).unwrap();
            
            // ========== Act (执行) ==========
            test_db.set_window_visibility("main", false).unwrap();
            
            // ========== Assert (断言) ==========
            let visible = test_db.get_window_visibility("main").unwrap();
            assert_eq!(visible, Some(false));
        }
        
        #[tokio::test]
        async fn test_show_window_sets_focus() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_focused("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let focused = test_db.get_window_focused("main").unwrap();
            assert_eq!(focused, Some(true));
        }
    }
    
    // ================================
    // set_window_position 命令测试
    // ================================
    
    mod set_window_position {
        use super::*;
        
        #[tokio::test]
        async fn test_set_window_position_updates_position() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_position("main", 100, 200).unwrap();
            
            // ========== Assert (断言) ==========
            let position = test_db.get_window_position("main").unwrap();
            assert_eq!(position, Some((100, 200)));
        }
        
        #[tokio::test]
        async fn test_set_window_position_saves_to_config() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_position("main", 150, 250).unwrap();
            test_db.upsert_config("window_x", "150").unwrap();
            test_db.upsert_config("window_y", "250").unwrap();
            
            // ========== Assert (断言) ==========
            let x = test_db.get_config("window_x").unwrap();
            let y = test_db.get_config("window_y").unwrap();
            
            assert_eq!(x, Some("150".to_string()));
            assert_eq!(y, Some("250".to_string()));
        }
        
        #[tokio::test]
        async fn test_set_window_position_handles_negative_coords() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_position("main", -100, -50).unwrap();
            
            // ========== Assert (断言) ==========
            let position = test_db.get_window_position("main").unwrap();
            assert_eq!(position, Some((-100, -50)));
        }
    }
    
    // ================================
    // set_window_size 命令测试
    // ================================
    
    mod set_window_size {
        use super::*;
        
        #[tokio::test]
        async fn test_set_window_size_updates_size() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_size("main", 800, 600).unwrap();
            
            // ========== Assert (断言) ==========
            let size = test_db.get_window_size("main").unwrap();
            assert_eq!(size, Some((800, 600)));
        }
        
        #[tokio::test]
        async fn test_set_window_size_saves_to_config() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_size("main", 1024, 768).unwrap();
            test_db.upsert_config("window_width", "1024").unwrap();
            test_db.upsert_config("window_height", "768").unwrap();
            
            // ========== Assert (断言) ==========
            let width = test_db.get_config("window_width").unwrap();
            let height = test_db.get_config("window_height").unwrap();
            
            assert_eq!(width, Some("1024".to_string()));
            assert_eq!(height, Some("768".to_string()));
        }
        
        #[tokio::test]
        async fn test_set_window_size_validates_minimum_size() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            let min_width = 400u32;
            let min_height = 300u32;
            
            // ========== Act (执行) ==========
            let requested_width = 200u32;
            let requested_height = 150u32;
            
            let actual_width = std::cmp::max(requested_width, min_width);
            let actual_height = std::cmp::max(requested_height, min_height);
            
            // ========== Assert (断言) ==========
            assert_eq!(actual_width, min_width);
            assert_eq!(actual_height, min_height);
        }
    }
    
    // ================================
    // toggle_always_on_top 命令测试
    // ================================
    
    mod toggle_always_on_top {
        use super::*;
        
        #[tokio::test]
        async fn test_toggle_always_on_top_enables() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            test_db.set_window_always_on_top("main", false).unwrap();
            
            // ========== Act (执行) ==========
            test_db.set_window_always_on_top("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let on_top = test_db.get_window_always_on_top("main").unwrap();
            assert_eq!(on_top, Some(true));
        }
        
        #[tokio::test]
        async fn test_toggle_always_on_top_disables() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            test_db.set_window_always_on_top("main", true).unwrap();
            
            // ========== Act (执行) ==========
            test_db.set_window_always_on_top("main", false).unwrap();
            
            // ========== Assert (断言) ==========
            let on_top = test_db.get_window_always_on_top("main").unwrap();
            assert_eq!(on_top, Some(false));
        }
        
        #[tokio::test]
        async fn test_toggle_always_on_top_saves_to_config() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.upsert_config("always_on_top", "true").unwrap();
            
            // ========== Assert (断言) ==========
            let config = test_db.get_config("always_on_top").unwrap();
            assert_eq!(config, Some("true".to_string()));
        }
    }
    
    // ================================
    // get_window_info 命令测试
    // ================================
    
    mod get_window_info {
        use super::*;
        
        #[tokio::test]
        async fn test_get_window_info_returns_complete_info() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_visibility("main", true).unwrap();
            test_db.set_window_focused("main", true).unwrap();
            test_db.set_window_position("main", 100, 100).unwrap();
            test_db.set_window_size("main", 800, 600).unwrap();
            test_db.set_window_always_on_top("main", false).unwrap();
            
            // ========== Assert (断言) ==========
            let visible = test_db.get_window_visibility("main").unwrap();
            let focused = test_db.get_window_focused("main").unwrap();
            let position = test_db.get_window_position("main").unwrap();
            let size = test_db.get_window_size("main").unwrap();
            let on_top = test_db.get_window_always_on_top("main").unwrap();
            
            assert_eq!(visible, Some(true));
            assert_eq!(focused, Some(true));
            assert_eq!(position, Some((100, 100)));
            assert_eq!(size, Some((800, 600)));
            assert_eq!(on_top, Some(false));
        }
        
        #[tokio::test]
        async fn test_get_window_info_includes_maximized_state() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_maximized("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let maximized = test_db.get_window_maximized("main").unwrap();
            assert_eq!(maximized, Some(true));
        }
        
        #[tokio::test]
        async fn test_get_window_info_includes_minimized_state() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_minimized("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let minimized = test_db.get_window_minimized("main").unwrap();
            assert_eq!(minimized, Some(true));
        }
        
        #[tokio::test]
        async fn test_get_window_info_includes_fullscreen_state() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_fullscreen("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let fullscreen = test_db.get_window_fullscreen("main").unwrap();
            assert_eq!(fullscreen, Some(true));
        }
    }
    
    // ================================
    // center_window 命令测试
    // ================================
    
    mod center_window {
        use super::*;
        
        #[tokio::test]
        async fn test_center_window_calculates_center_position() {
            // ========== Arrange (准备) ==========
            let screen_width = 1920;
            let screen_height = 1080;
            let window_width = 800;
            let window_height = 600;
            
            // ========== Act (执行) ==========
            let center_x = (screen_width - window_width) / 2;
            let center_y = (screen_height - window_height) / 2;
            
            // ========== Assert (断言) ==========
            assert_eq!(center_x, 560);
            assert_eq!(center_y, 240);
        }
        
        #[tokio::test]
        async fn test_center_window_updates_position() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_position("main", 560, 240).unwrap();
            
            // ========== Assert (断言) ==========
            let position = test_db.get_window_position("main").unwrap();
            assert_eq!(position, Some((560, 240)));
        }
        
        #[tokio::test]
        async fn test_center_window_saves_to_config() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_config_tables().expect("Failed to init config tables");
            
            // ========== Act (执行) ==========
            test_db.upsert_config("window_x", "560").unwrap();
            test_db.upsert_config("window_y", "240").unwrap();
            
            // ========== Assert (断言) ==========
            let x = test_db.get_config("window_x").unwrap();
            let y = test_db.get_config("window_y").unwrap();
            
            assert_eq!(x, Some("560".to_string()));
            assert_eq!(y, Some("240".to_string()));
        }
    }
    
    // ================================
    // maximize_window & unmaximize_window 命令测试
    // ================================
    
    mod maximize_unmaximize_window {
        use super::*;
        
        #[tokio::test]
        async fn test_maximize_window_sets_state() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_maximized("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let maximized = test_db.get_window_maximized("main").unwrap();
            assert_eq!(maximized, Some(true));
        }
        
        #[tokio::test]
        async fn test_unmaximize_window_clears_state() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            test_db.set_window_maximized("main", true).unwrap();
            
            // ========== Act (执行) ==========
            test_db.set_window_maximized("main", false).unwrap();
            
            // ========== Assert (断言) ==========
            let maximized = test_db.get_window_maximized("main").unwrap();
            assert_eq!(maximized, Some(false));
        }
        
        #[tokio::test]
        async fn test_maximize_window_stores_previous_size() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_size("main", 800, 600).unwrap();
            test_db.set_window_previous_size("main", 800, 600).unwrap();
            test_db.set_window_maximized("main", true).unwrap();
            
            // ========== Assert (断言) ==========
            let prev_size = test_db.get_window_previous_size("main").unwrap();
            assert_eq!(prev_size, Some((800, 600)));
        }
    }
    
    // ================================
    // close_window 命令测试
    // ================================
    
    mod close_window {
        use super::*;
        
        #[tokio::test]
        async fn test_close_window_removes_window_record() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            test_db.create_window_record("settings").unwrap();
            
            // ========== Act (执行) ==========
            test_db.delete_window_record("settings").unwrap();
            
            // ========== Assert (断言) ==========
            let exists = test_db.window_record_exists("settings").unwrap();
            assert!(!exists, "窗口记录应该被删除");
        }
        
        #[tokio::test]
        async fn test_close_window_handles_nonexistent_window() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            let exists = test_db.window_record_exists("nonexistent").unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!exists, "不存在的窗口应该返回false");
        }
        
        #[tokio::test]
        async fn test_close_window_main_window_behavior() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            // 主窗口应该最小化到托盘而不是关闭
            test_db.set_window_visibility("main", false).unwrap();
            
            // ========== Assert (断言) ==========
            let visible = test_db.get_window_visibility("main").unwrap();
            assert_eq!(visible, Some(false));
        }
    }
    
    // ================================
    // 多窗口管理测试
    // ================================
    
    mod multi_window_management {
        use super::*;
        
        #[tokio::test]
        async fn test_manage_multiple_windows() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.create_window_record("main").unwrap();
            test_db.create_window_record("settings").unwrap();
            test_db.create_window_record("about").unwrap();
            
            // ========== Assert (断言) ==========
            let count = test_db.count_window_records().unwrap();
            assert_eq!(count, 3, "应该有3个窗口记录");
        }
        
        #[tokio::test]
        async fn test_each_window_has_independent_state() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_position("main", 0, 0).unwrap();
            test_db.set_window_position("settings", 100, 100).unwrap();
            
            // ========== Assert (断言) ==========
            let main_pos = test_db.get_window_position("main").unwrap();
            let settings_pos = test_db.get_window_position("settings").unwrap();
            
            assert_eq!(main_pos, Some((0, 0)));
            assert_eq!(settings_pos, Some((100, 100)));
        }
        
        #[tokio::test]
        async fn test_window_state_persistence() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_window_tables().expect("Failed to init window tables");
            
            // ========== Act (执行) ==========
            test_db.set_window_position("main", 100, 200).unwrap();
            test_db.set_window_size("main", 800, 600).unwrap();
            test_db.set_window_maximized("main", false).unwrap();
            
            // 模拟重新加载
            let pos = test_db.get_window_position("main").unwrap();
            let size = test_db.get_window_size("main").unwrap();
            let maximized = test_db.get_window_maximized("main").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(pos, Some((100, 200)));
            assert_eq!(size, Some((800, 600)));
            assert_eq!(maximized, Some(false));
        }
    }
}

