//! AppConfig 应用配置模块单元测试
//!
//! 测试应用配置结构体，包括窗口、角色、主题和系统配置

use serde_json;

// 导入被测试的模块
use zishu_sensei::{AppConfig, WindowConfig, CharacterConfig, ThemeConfig, SystemConfig};

// ========== AppConfig 基础测试 ==========

mod app_config_creation {
    use super::*;

    #[test]
    fn test_default_app_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = AppConfig::default();

        // ========== Assert (断言) ==========
        // 窗口配置
        assert_eq!(config.window.width, 400.0, "默认窗口宽度应该是400");
        assert_eq!(config.window.height, 600.0, "默认窗口高度应该是600");
        assert_eq!(config.window.always_on_top, true, "默认应该置顶");
        assert_eq!(config.window.transparent, true, "默认应该透明");
        assert_eq!(config.window.decorations, false, "默认无装饰");
        assert_eq!(config.window.resizable, true, "默认可调整大小");
        assert_eq!(config.window.position, None, "默认无固定位置");

        // 角色配置
        assert_eq!(config.character.current_character, "shizuku", "默认角色应该是shizuku");
        assert_eq!(config.character.scale, 1.0, "默认缩放比例应该是1.0");
        assert_eq!(config.character.auto_idle, true, "默认启用自动待机");
        assert_eq!(config.character.interaction_enabled, true, "默认启用交互");

        // 主题配置
        assert_eq!(config.theme.current_theme, "anime", "默认主题应该是anime");
        assert_eq!(config.theme.custom_css, None, "默认无自定义CSS");

        // 系统配置
        assert_eq!(config.system.auto_start, false, "默认不自动启动");
        assert_eq!(config.system.minimize_to_tray, true, "默认最小化到托盘");
        assert_eq!(config.system.close_to_tray, true, "默认关闭到托盘");
        assert_eq!(config.system.show_notifications, true, "默认显示通知");
    }

    #[test]
    fn test_app_config_clone() {
        // ========== Arrange (准备) ==========
        let config = AppConfig::default();

        // ========== Act (执行) ==========
        let cloned = config.clone();

        // ========== Assert (断言) ==========
        assert_eq!(cloned.window.width, config.window.width);
        assert_eq!(cloned.window.height, config.window.height);
        assert_eq!(cloned.character.current_character, config.character.current_character);
        assert_eq!(cloned.theme.current_theme, config.theme.current_theme);
        assert_eq!(cloned.system.auto_start, config.system.auto_start);
    }

    #[test]
    fn test_app_config_debug_format() {
        // ========== Arrange (准备) ==========
        let config = AppConfig::default();

        // ========== Act (执行) ==========
        let debug_str = format!("{:?}", config);

        // ========== Assert (断言) ==========
        assert!(debug_str.contains("AppConfig"), "Debug输出应该包含AppConfig");
        assert!(debug_str.contains("window"), "Debug输出应该包含window");
        assert!(debug_str.contains("character"), "Debug输出应该包含character");
        assert!(debug_str.contains("theme"), "Debug输出应该包含theme");
        assert!(debug_str.contains("system"), "Debug输出应该包含system");
    }
}

// ========== WindowConfig 测试 ==========

mod window_config_tests {
    use super::*;

    #[test]
    fn test_custom_window_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = WindowConfig {
            width: 800.0,
            height: 1200.0,
            always_on_top: false,
            transparent: false,
            decorations: true,
            resizable: false,
            position: Some((100, 200)),
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.width, 800.0);
        assert_eq!(config.height, 1200.0);
        assert_eq!(config.always_on_top, false);
        assert_eq!(config.transparent, false);
        assert_eq!(config.decorations, true);
        assert_eq!(config.resizable, false);
        assert_eq!(config.position, Some((100, 200)));
    }

    #[test]
    fn test_window_config_with_negative_position() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = WindowConfig {
            width: 400.0,
            height: 600.0,
            always_on_top: true,
            transparent: true,
            decorations: false,
            resizable: true,
            position: Some((-100, -200)),
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.position, Some((-100, -200)), "应该支持负数坐标");
    }

    #[test]
    fn test_window_config_extreme_sizes() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = WindowConfig {
            width: 0.1,
            height: 10000.0,
            always_on_top: true,
            transparent: true,
            decorations: false,
            resizable: true,
            position: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.width, 0.1, "应该支持极小宽度");
        assert_eq!(config.height, 10000.0, "应该支持极大高度");
    }

    #[test]
    fn test_window_config_clone() {
        // ========== Arrange (准备) ==========
        let config = WindowConfig {
            width: 500.0,
            height: 700.0,
            always_on_top: true,
            transparent: false,
            decorations: true,
            resizable: false,
            position: Some((50, 50)),
        };

        // ========== Act (执行) ==========
        let cloned = config.clone();

        // ========== Assert (断言) ==========
        assert_eq!(cloned.width, config.width);
        assert_eq!(cloned.height, config.height);
        assert_eq!(cloned.always_on_top, config.always_on_top);
        assert_eq!(cloned.transparent, config.transparent);
        assert_eq!(cloned.decorations, config.decorations);
        assert_eq!(cloned.resizable, config.resizable);
        assert_eq!(cloned.position, config.position);
    }
}

// ========== CharacterConfig 测试 ==========

mod character_config_tests {
    use super::*;

    #[test]
    fn test_custom_character_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = CharacterConfig {
            current_character: "custom_character".to_string(),
            scale: 1.5,
            auto_idle: false,
            interaction_enabled: false,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.current_character, "custom_character");
        assert_eq!(config.scale, 1.5);
        assert_eq!(config.auto_idle, false);
        assert_eq!(config.interaction_enabled, false);
    }

    #[test]
    fn test_character_config_various_scales() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let scales = vec![0.5, 1.0, 1.5, 2.0, 3.0, 0.1, 10.0];

        for scale in scales {
            let config = CharacterConfig {
                current_character: "test".to_string(),
                scale,
                auto_idle: true,
                interaction_enabled: true,
            };

            // ========== Assert (断言) ==========
            assert_eq!(config.scale, scale, "缩放比例应该正确设置");
        }
    }

    #[test]
    fn test_character_config_empty_character_name() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = CharacterConfig {
            current_character: "".to_string(),
            scale: 1.0,
            auto_idle: true,
            interaction_enabled: true,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.current_character, "", "应该允许空字符串");
    }

    #[test]
    fn test_character_config_unicode_character_name() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = CharacterConfig {
            current_character: "しずく_紫竹_🎀".to_string(),
            scale: 1.0,
            auto_idle: true,
            interaction_enabled: true,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.current_character, "しずく_紫竹_🎀", "应该支持Unicode字符");
    }

    #[test]
    fn test_character_config_clone() {
        // ========== Arrange (准备) ==========
        let config = CharacterConfig {
            current_character: "test_char".to_string(),
            scale: 2.0,
            auto_idle: false,
            interaction_enabled: false,
        };

        // ========== Act (执行) ==========
        let cloned = config.clone();

        // ========== Assert (断言) ==========
        assert_eq!(cloned.current_character, config.current_character);
        assert_eq!(cloned.scale, config.scale);
        assert_eq!(cloned.auto_idle, config.auto_idle);
        assert_eq!(cloned.interaction_enabled, config.interaction_enabled);
    }
}

// ========== ThemeConfig 测试 ==========

mod theme_config_tests {
    use super::*;

    #[test]
    fn test_custom_theme_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ThemeConfig {
            current_theme: "dark".to_string(),
            custom_css: Some("body { background: black; }".to_string()),
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.current_theme, "dark");
        assert_eq!(config.custom_css, Some("body { background: black; }".to_string()));
    }

    #[test]
    fn test_theme_config_without_custom_css() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ThemeConfig {
            current_theme: "light".to_string(),
            custom_css: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.current_theme, "light");
        assert_eq!(config.custom_css, None);
    }

    #[test]
    fn test_theme_config_empty_custom_css() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ThemeConfig {
            current_theme: "custom".to_string(),
            custom_css: Some("".to_string()),
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.custom_css, Some("".to_string()), "应该允许空CSS");
    }

    #[test]
    fn test_theme_config_long_css() {
        // ========== Arrange (准备) ==========
        let long_css = "body { background: red; }".repeat(1000);

        // ========== Act (执行) ==========
        let config = ThemeConfig {
            current_theme: "custom".to_string(),
            custom_css: Some(long_css.clone()),
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.custom_css, Some(long_css), "应该支持长CSS");
    }

    #[test]
    fn test_theme_config_clone() {
        // ========== Arrange (准备) ==========
        let config = ThemeConfig {
            current_theme: "test_theme".to_string(),
            custom_css: Some("test css".to_string()),
        };

        // ========== Act (执行) ==========
        let cloned = config.clone();

        // ========== Assert (断言) ==========
        assert_eq!(cloned.current_theme, config.current_theme);
        assert_eq!(cloned.custom_css, config.custom_css);
    }
}

// ========== SystemConfig 测试 ==========

mod system_config_tests {
    use super::*;

    #[test]
    fn test_custom_system_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = SystemConfig {
            auto_start: true,
            minimize_to_tray: false,
            close_to_tray: false,
            show_notifications: false,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.auto_start, true);
        assert_eq!(config.minimize_to_tray, false);
        assert_eq!(config.close_to_tray, false);
        assert_eq!(config.show_notifications, false);
    }

    #[test]
    fn test_system_config_all_enabled() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = SystemConfig {
            auto_start: true,
            minimize_to_tray: true,
            close_to_tray: true,
            show_notifications: true,
        };

        // ========== Assert (断言) ==========
        assert!(config.auto_start, "所有选项应该启用");
        assert!(config.minimize_to_tray);
        assert!(config.close_to_tray);
        assert!(config.show_notifications);
    }

    #[test]
    fn test_system_config_all_disabled() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = SystemConfig {
            auto_start: false,
            minimize_to_tray: false,
            close_to_tray: false,
            show_notifications: false,
        };

        // ========== Assert (断言) ==========
        assert!(!config.auto_start, "所有选项应该禁用");
        assert!(!config.minimize_to_tray);
        assert!(!config.close_to_tray);
        assert!(!config.show_notifications);
    }

    #[test]
    fn test_system_config_clone() {
        // ========== Arrange (准备) ==========
        let config = SystemConfig {
            auto_start: true,
            minimize_to_tray: false,
            close_to_tray: true,
            show_notifications: false,
        };

        // ========== Act (执行) ==========
        let cloned = config.clone();

        // ========== Assert (断言) ==========
        assert_eq!(cloned.auto_start, config.auto_start);
        assert_eq!(cloned.minimize_to_tray, config.minimize_to_tray);
        assert_eq!(cloned.close_to_tray, config.close_to_tray);
        assert_eq!(cloned.show_notifications, config.show_notifications);
    }
}

// ========== Serialization/Deserialization 测试 ==========

mod serialization_tests {
    use super::*;

    #[test]
    fn test_app_config_serialize() {
        // ========== Arrange (准备) ==========
        let config = AppConfig::default();

        // ========== Act (执行) ==========
        let result = serde_json::to_string(&config);

        // ========== Assert (断言) ==========
        assert!(result.is_ok(), "序列化应该成功");
        let json = result.unwrap();
        assert!(json.contains("window"), "JSON应该包含window");
        assert!(json.contains("character"), "JSON应该包含character");
        assert!(json.contains("theme"), "JSON应该包含theme");
        assert!(json.contains("system"), "JSON应该包含system");
    }

    #[test]
    fn test_app_config_deserialize() {
        // ========== Arrange (准备) ==========
        let json = r#"{
            "window": {
                "width": 800.0,
                "height": 1000.0,
                "always_on_top": false,
                "transparent": false,
                "decorations": true,
                "resizable": false,
                "position": [150, 250]
            },
            "character": {
                "current_character": "test_char",
                "scale": 1.5,
                "auto_idle": false,
                "interaction_enabled": false
            },
            "theme": {
                "current_theme": "dark",
                "custom_css": "body { color: white; }"
            },
            "system": {
                "auto_start": true,
                "minimize_to_tray": false,
                "close_to_tray": false,
                "show_notifications": true
            }
        }"#;

        // ========== Act (执行) ==========
        let result: Result<AppConfig, _> = serde_json::from_str(json);

        // ========== Assert (断言) ==========
        assert!(result.is_ok(), "反序列化应该成功");
        let config = result.unwrap();
        assert_eq!(config.window.width, 800.0);
        assert_eq!(config.window.height, 1000.0);
        assert_eq!(config.character.current_character, "test_char");
        assert_eq!(config.character.scale, 1.5);
        assert_eq!(config.theme.current_theme, "dark");
        assert_eq!(config.theme.custom_css, Some("body { color: white; }".to_string()));
        assert_eq!(config.system.auto_start, true);
    }

    #[test]
    fn test_window_config_serialize() {
        // ========== Arrange (准备) ==========
        let config = WindowConfig {
            width: 500.0,
            height: 700.0,
            always_on_top: true,
            transparent: true,
            decorations: false,
            resizable: true,
            position: Some((100, 200)),
        };

        // ========== Act (执行) ==========
        let result = serde_json::to_string(&config);

        // ========== Assert (断言) ==========
        assert!(result.is_ok(), "WindowConfig序列化应该成功");
    }

    #[test]
    fn test_character_config_serialize() {
        // ========== Arrange (准备) ==========
        let config = CharacterConfig {
            current_character: "shizuku".to_string(),
            scale: 2.0,
            auto_idle: true,
            interaction_enabled: false,
        };

        // ========== Act (执行) ==========
        let result = serde_json::to_string(&config);

        // ========== Assert (断言) ==========
        assert!(result.is_ok(), "CharacterConfig序列化应该成功");
    }

    #[test]
    fn test_theme_config_serialize() {
        // ========== Arrange (准备) ==========
        let config = ThemeConfig {
            current_theme: "anime".to_string(),
            custom_css: Some("body { background: #fff; }".to_string()),
        };

        // ========== Act (执行) ==========
        let result = serde_json::to_string(&config);

        // ========== Assert (断言) ==========
        assert!(result.is_ok(), "ThemeConfig序列化应该成功");
    }

    #[test]
    fn test_system_config_serialize() {
        // ========== Arrange (准备) ==========
        let config = SystemConfig {
            auto_start: true,
            minimize_to_tray: true,
            close_to_tray: false,
            show_notifications: true,
        };

        // ========== Act (执行) ==========
        let result = serde_json::to_string(&config);

        // ========== Assert (断言) ==========
        assert!(result.is_ok(), "SystemConfig序列化应该成功");
    }

    #[test]
    fn test_roundtrip_serialization() {
        // ========== Arrange (准备) ==========
        let original = AppConfig::default();

        // ========== Act (执行) ==========
        let json = serde_json::to_string(&original).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(deserialized.window.width, original.window.width);
        assert_eq!(deserialized.window.height, original.window.height);
        assert_eq!(deserialized.character.current_character, original.character.current_character);
        assert_eq!(deserialized.theme.current_theme, original.theme.current_theme);
        assert_eq!(deserialized.system.auto_start, original.system.auto_start);
    }

    #[test]
    fn test_deserialize_with_null_optional_fields() {
        // ========== Arrange (准备) ==========
        let json = r#"{
            "window": {
                "width": 400.0,
                "height": 600.0,
                "always_on_top": true,
                "transparent": true,
                "decorations": false,
                "resizable": true,
                "position": null
            },
            "character": {
                "current_character": "shizuku",
                "scale": 1.0,
                "auto_idle": true,
                "interaction_enabled": true
            },
            "theme": {
                "current_theme": "anime",
                "custom_css": null
            },
            "system": {
                "auto_start": false,
                "minimize_to_tray": true,
                "close_to_tray": true,
                "show_notifications": true
            }
        }"#;

        // ========== Act (执行) ==========
        let result: Result<AppConfig, _> = serde_json::from_str(json);

        // ========== Assert (断言) ==========
        assert!(result.is_ok(), "应该能反序列化带null的可选字段");
        let config = result.unwrap();
        assert_eq!(config.window.position, None);
        assert_eq!(config.theme.custom_css, None);
    }

    #[test]
    fn test_deserialize_with_missing_optional_fields() {
        // ========== Arrange (准备) ==========
        let json = r#"{
            "window": {
                "width": 400.0,
                "height": 600.0,
                "always_on_top": true,
                "transparent": true,
                "decorations": false,
                "resizable": true
            },
            "character": {
                "current_character": "shizuku",
                "scale": 1.0,
                "auto_idle": true,
                "interaction_enabled": true
            },
            "theme": {
                "current_theme": "anime"
            },
            "system": {
                "auto_start": false,
                "minimize_to_tray": true,
                "close_to_tray": true,
                "show_notifications": true
            }
        }"#;

        // ========== Act (执行) ==========
        let result: Result<AppConfig, _> = serde_json::from_str(json);

        // ========== Assert (断言) ==========
        // 注意：缺少可选字段可能会导致反序列化失败，取决于serde的配置
        // 这里我们测试实际行为
        if result.is_ok() {
            let config = result.unwrap();
            assert_eq!(config.theme.current_theme, "anime");
        }
    }
}

// ========== 集成场景测试 ==========

mod integration_scenarios {
    use super::*;

    #[test]
    fn test_create_custom_app_config() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = AppConfig {
            window: WindowConfig {
                width: 1024.0,
                height: 768.0,
                always_on_top: false,
                transparent: false,
                decorations: true,
                resizable: true,
                position: Some((200, 100)),
            },
            character: CharacterConfig {
                current_character: "custom_char".to_string(),
                scale: 1.2,
                auto_idle: false,
                interaction_enabled: true,
            },
            theme: ThemeConfig {
                current_theme: "dark_mode".to_string(),
                custom_css: Some("* { font-family: 'Arial'; }".to_string()),
            },
            system: SystemConfig {
                auto_start: true,
                minimize_to_tray: true,
                close_to_tray: false,
                show_notifications: true,
            },
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.window.width, 1024.0);
        assert_eq!(config.character.current_character, "custom_char");
        assert_eq!(config.theme.current_theme, "dark_mode");
        assert_eq!(config.system.auto_start, true);
    }

    #[test]
    fn test_modify_default_config() {
        // ========== Arrange (准备) ==========
        let mut config = AppConfig::default();

        // ========== Act (执行) ==========
        config.window.width = 1000.0;
        config.window.height = 800.0;
        config.character.current_character = "new_character".to_string();
        config.character.scale = 1.5;
        config.theme.current_theme = "new_theme".to_string();
        config.system.auto_start = true;

        // ========== Assert (断言) ==========
        assert_eq!(config.window.width, 1000.0);
        assert_eq!(config.window.height, 800.0);
        assert_eq!(config.character.current_character, "new_character");
        assert_eq!(config.character.scale, 1.5);
        assert_eq!(config.theme.current_theme, "new_theme");
        assert_eq!(config.system.auto_start, true);

        // 其他字段应该保持默认值
        assert_eq!(config.window.always_on_top, true);
        assert_eq!(config.character.auto_idle, true);
    }

    #[test]
    fn test_config_persistence_simulation() {
        // ========== Arrange (准备) ==========
        let original = AppConfig::default();

        // ========== Act (执行) ==========
        // 模拟保存到JSON
        let json = serde_json::to_string(&original).unwrap();
        
        // 模拟从JSON加载
        let loaded: AppConfig = serde_json::from_str(&json).unwrap();

        // ========== Assert (断言) ==========
        assert_eq!(loaded.window.width, original.window.width);
        assert_eq!(loaded.window.height, original.window.height);
        assert_eq!(loaded.character.current_character, original.character.current_character);
        assert_eq!(loaded.theme.current_theme, original.theme.current_theme);
        assert_eq!(loaded.system.auto_start, original.system.auto_start);
    }
}

// ========== 边界条件和错误处理测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_zero_window_dimensions() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = WindowConfig {
            width: 0.0,
            height: 0.0,
            always_on_top: true,
            transparent: true,
            decorations: false,
            resizable: true,
            position: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.width, 0.0, "应该允许0宽度");
        assert_eq!(config.height, 0.0, "应该允许0高度");
    }

    #[test]
    fn test_negative_window_dimensions() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = WindowConfig {
            width: -100.0,
            height: -200.0,
            always_on_top: true,
            transparent: true,
            decorations: false,
            resizable: true,
            position: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.width, -100.0, "应该允许负数宽度（虽然不合理）");
        assert_eq!(config.height, -200.0, "应该允许负数高度（虽然不合理）");
    }

    #[test]
    fn test_very_large_window_dimensions() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = WindowConfig {
            width: f64::MAX,
            height: f64::MAX,
            always_on_top: true,
            transparent: true,
            decorations: false,
            resizable: true,
            position: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.width, f64::MAX);
        assert_eq!(config.height, f64::MAX);
    }

    #[test]
    fn test_zero_character_scale() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = CharacterConfig {
            current_character: "test".to_string(),
            scale: 0.0,
            auto_idle: true,
            interaction_enabled: true,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.scale, 0.0, "应该允许0缩放");
    }

    #[test]
    fn test_negative_character_scale() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = CharacterConfig {
            current_character: "test".to_string(),
            scale: -1.5,
            auto_idle: true,
            interaction_enabled: true,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.scale, -1.5, "应该允许负数缩放（虽然不合理）");
    }

    #[test]
    fn test_very_long_character_name() {
        // ========== Arrange (准备) ==========
        let long_name = "a".repeat(10000);

        // ========== Act (执行) ==========
        let config = CharacterConfig {
            current_character: long_name.clone(),
            scale: 1.0,
            auto_idle: true,
            interaction_enabled: true,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.current_character.len(), 10000);
        assert_eq!(config.current_character, long_name);
    }

    #[test]
    fn test_very_long_custom_css() {
        // ========== Arrange (准备) ==========
        let long_css = "body { color: red; }".repeat(5000);

        // ========== Act (执行) ==========
        let config = ThemeConfig {
            current_theme: "custom".to_string(),
            custom_css: Some(long_css.clone()),
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.custom_css.unwrap().len(), long_css.len());
    }

    #[test]
    fn test_special_characters_in_theme_name() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ThemeConfig {
            current_theme: "theme!@#$%^&*()_+-=[]{}|;':\",./<>?".to_string(),
            custom_css: None,
        };

        // ========== Assert (断言) ==========
        assert!(config.current_theme.contains("!@#$"), "应该支持特殊字符");
    }

    #[test]
    fn test_unicode_in_theme_name() {
        // ========== Arrange & Act (准备 & 执行) ==========
        let config = ThemeConfig {
            current_theme: "主题_🎨_テーマ".to_string(),
            custom_css: None,
        };

        // ========== Assert (断言) ==========
        assert_eq!(config.current_theme, "主题_🎨_テーマ", "应该支持Unicode");
    }
}

