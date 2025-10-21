//! 托盘状态模块的全面测试

use crate::common::fixtures;
use chrono::{Duration, Utc};
use std::sync::Arc;
use std::thread;

// 导入被测试的模块
use zishu_sensei_desktop::state::tray_state::{
    NotificationType, RecentConversation, SystemResources, TrayIconState, TrayNotification,
    TrayState,
};

/// 测试组：托盘图标状态管理
mod icon_state_tests {
    use super::*;

    #[test]
    fn test_initial_icon_state_is_idle() {
        let state = TrayState::new();
        assert_eq!(
            state.get_icon_state(),
            TrayIconState::Idle,
            "新创建的托盘状态应该是空闲状态"
        );
    }

    #[test]
    fn test_set_and_get_icon_state() {
        let state = TrayState::new();
        
        // 测试所有状态
        let states = vec![
            TrayIconState::Active,
            TrayIconState::Busy,
            TrayIconState::Notification,
            TrayIconState::Error,
            TrayIconState::Idle,
        ];

        for expected_state in states {
            state.set_icon_state(expected_state.clone());
            assert_eq!(
                state.get_icon_state(),
                expected_state,
                "设置的图标状态应该能正确获取"
            );
        }
    }

    #[test]
    fn test_icon_state_transitions() {
        let state = TrayState::new();

        // 测试状态转换序列
        state.set_icon_state(TrayIconState::Idle);
        assert_eq!(state.get_icon_state(), TrayIconState::Idle);

        state.set_icon_state(TrayIconState::Active);
        assert_eq!(state.get_icon_state(), TrayIconState::Active);

        state.set_icon_state(TrayIconState::Busy);
        assert_eq!(state.get_icon_state(), TrayIconState::Busy);

        state.set_icon_state(TrayIconState::Notification);
        assert_eq!(state.get_icon_state(), TrayIconState::Notification);

        state.set_icon_state(TrayIconState::Error);
        assert_eq!(state.get_icon_state(), TrayIconState::Error);

        // 回到空闲
        state.set_icon_state(TrayIconState::Idle);
        assert_eq!(state.get_icon_state(), TrayIconState::Idle);
    }

    #[test]
    fn test_icon_state_thread_safety() {
        let state = Arc::new(TrayState::new());
        let mut handles = vec![];

        // 创建多个线程同时修改状态
        for i in 0..10 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let icon_state = match i % 5 {
                    0 => TrayIconState::Idle,
                    1 => TrayIconState::Active,
                    2 => TrayIconState::Busy,
                    3 => TrayIconState::Notification,
                    _ => TrayIconState::Error,
                };
                state_clone.set_icon_state(icon_state);
            });
            handles.push(handle);
        }

        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }

        // 验证状态是有效的（不会panic）
        let final_state = state.get_icon_state();
        assert!(
            matches!(
                final_state,
                TrayIconState::Idle
                    | TrayIconState::Active
                    | TrayIconState::Busy
                    | TrayIconState::Notification
                    | TrayIconState::Error
            ),
            "最终状态应该是有效的枚举值"
        );
    }
}

/// 测试组：最近对话管理
mod conversation_tests {
    use super::*;

    fn create_test_conversation(id: &str, unread: u32) -> RecentConversation {
        RecentConversation {
            id: id.to_string(),
            title: format!("对话 {}", id),
            last_message: format!("最后一条消息 {}", id),
            updated_at: Utc::now(),
            unread_count: unread,
        }
    }

    #[test]
    fn test_add_conversation() {
        let state = TrayState::new();
        let conv = create_test_conversation("conv1", 3);

        state.add_or_update_conversation(conv.clone());

        let conversations = state.get_recent_conversations();
        assert_eq!(conversations.len(), 1, "应该有一条对话");
        assert_eq!(conversations[0].id, "conv1");
        assert_eq!(conversations[0].unread_count, 3);
    }

    #[test]
    fn test_update_existing_conversation() {
        let state = TrayState::new();
        
        // 添加初始对话
        let mut conv = create_test_conversation("conv1", 3);
        state.add_or_update_conversation(conv.clone());

        // 更新对话
        conv.last_message = "更新的消息".to_string();
        conv.unread_count = 5;
        state.add_or_update_conversation(conv);

        let conversations = state.get_recent_conversations();
        assert_eq!(conversations.len(), 1, "仍然只有一条对话");
        assert_eq!(conversations[0].last_message, "更新的消息");
        assert_eq!(conversations[0].unread_count, 5);
    }

    #[test]
    fn test_conversations_sorted_by_updated_time() {
        let state = TrayState::new();

        // 添加三条对话，时间不同
        let now = Utc::now();
        
        let mut conv1 = create_test_conversation("conv1", 0);
        conv1.updated_at = now - Duration::hours(2);
        
        let mut conv2 = create_test_conversation("conv2", 0);
        conv2.updated_at = now - Duration::hours(1);
        
        let mut conv3 = create_test_conversation("conv3", 0);
        conv3.updated_at = now;

        state.add_or_update_conversation(conv1);
        state.add_or_update_conversation(conv2);
        state.add_or_update_conversation(conv3);

        let conversations = state.get_recent_conversations();
        assert_eq!(conversations.len(), 3);
        // 应该按时间倒序排列
        assert_eq!(conversations[0].id, "conv3");
        assert_eq!(conversations[1].id, "conv2");
        assert_eq!(conversations[2].id, "conv1");
    }

    #[test]
    fn test_max_10_conversations() {
        let state = TrayState::new();

        // 添加 15 条对话
        for i in 0..15 {
            let conv = create_test_conversation(&format!("conv{}", i), 0);
            state.add_or_update_conversation(conv);
        }

        let conversations = state.get_recent_conversations();
        assert_eq!(
            conversations.len(),
            10,
            "应该只保留最近的 10 条对话"
        );
    }

    #[test]
    fn test_remove_conversation() {
        let state = TrayState::new();
        
        state.add_or_update_conversation(create_test_conversation("conv1", 0));
        state.add_or_update_conversation(create_test_conversation("conv2", 0));
        state.add_or_update_conversation(create_test_conversation("conv3", 0));

        assert_eq!(state.get_recent_conversations().len(), 3);

        state.remove_conversation("conv2");

        let conversations = state.get_recent_conversations();
        assert_eq!(conversations.len(), 2);
        assert!(conversations.iter().any(|c| c.id == "conv1"));
        assert!(conversations.iter().any(|c| c.id == "conv3"));
        assert!(!conversations.iter().any(|c| c.id == "conv2"));
    }

    #[test]
    fn test_remove_nonexistent_conversation() {
        let state = TrayState::new();
        state.add_or_update_conversation(create_test_conversation("conv1", 0));

        // 移除不存在的对话不应该报错
        state.remove_conversation("nonexistent");

        assert_eq!(state.get_recent_conversations().len(), 1);
    }

    #[test]
    fn test_clear_conversations() {
        let state = TrayState::new();
        
        for i in 0..5 {
            state.add_or_update_conversation(create_test_conversation(&format!("conv{}", i), 0));
        }

        assert_eq!(state.get_recent_conversations().len(), 5);

        state.clear_conversations();

        assert_eq!(
            state.get_recent_conversations().len(),
            0,
            "清空后应该没有对话"
        );
    }

    #[test]
    fn test_mark_conversation_read() {
        let state = TrayState::new();
        
        state.add_or_update_conversation(create_test_conversation("conv1", 5));
        state.add_or_update_conversation(create_test_conversation("conv2", 3));

        assert_eq!(state.get_total_unread_count(), 8);

        state.mark_conversation_read("conv1");

        assert_eq!(
            state.get_total_unread_count(),
            3,
            "标记读后未读数应该减少"
        );

        let conversations = state.get_recent_conversations();
        let conv1 = conversations.iter().find(|c| c.id == "conv1").unwrap();
        assert_eq!(conv1.unread_count, 0);
    }

    #[test]
    fn test_mark_nonexistent_conversation_read() {
        let state = TrayState::new();
        state.add_or_update_conversation(create_test_conversation("conv1", 5));

        // 标记不存在的对话为已读不应该报错
        state.mark_conversation_read("nonexistent");

        assert_eq!(state.get_total_unread_count(), 5);
    }

    #[test]
    fn test_get_total_unread_count() {
        let state = TrayState::new();
        
        state.add_or_update_conversation(create_test_conversation("conv1", 5));
        state.add_or_update_conversation(create_test_conversation("conv2", 3));
        state.add_or_update_conversation(create_test_conversation("conv3", 2));

        assert_eq!(
            state.get_total_unread_count(),
            10,
            "总未读数应该是所有对话未读数之和"
        );
    }

    #[test]
    fn test_conversation_thread_safety() {
        let state = Arc::new(TrayState::new());
        let mut handles = vec![];

        // 多个线程同时添加对话
        for i in 0..20 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let conv = create_test_conversation(&format!("conv{}", i), i % 10);
                state_clone.add_or_update_conversation(conv);
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        // 应该只保留 10 条对话
        assert_eq!(state.get_recent_conversations().len(), 10);
    }
}

/// 测试组：系统资源管理
mod system_resources_tests {
    use super::*;

    fn create_test_resources() -> SystemResources {
        SystemResources {
            cpu_usage: 45.5,
            memory_usage: 60.2,
            total_memory: 16_000_000_000,
            used_memory: 9_632_000_000,
            uptime: 3600,
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_initial_system_resources() {
        let state = TrayState::new();
        let resources = state.get_system_resources();

        assert_eq!(resources.cpu_usage, 0.0);
        assert_eq!(resources.memory_usage, 0.0);
        assert_eq!(resources.total_memory, 0);
        assert_eq!(resources.used_memory, 0);
        assert_eq!(resources.uptime, 0);
    }

    #[test]
    fn test_update_system_resources() {
        let state = TrayState::new();
        let resources = create_test_resources();

        state.update_system_resources(resources.clone());

        let retrieved = state.get_system_resources();
        assert_eq!(retrieved.cpu_usage, 45.5);
        assert_eq!(retrieved.memory_usage, 60.2);
        assert_eq!(retrieved.total_memory, 16_000_000_000);
        assert_eq!(retrieved.used_memory, 9_632_000_000);
        assert_eq!(retrieved.uptime, 3600);
    }

    #[test]
    fn test_update_system_resources_multiple_times() {
        let state = TrayState::new();

        // 第一次更新
        let mut resources = create_test_resources();
        resources.cpu_usage = 30.0;
        state.update_system_resources(resources.clone());

        assert_eq!(state.get_system_resources().cpu_usage, 30.0);

        // 第二次更新
        resources.cpu_usage = 75.0;
        state.update_system_resources(resources);

        assert_eq!(state.get_system_resources().cpu_usage, 75.0);
    }

    #[test]
    fn test_system_resources_thread_safety() {
        let state = Arc::new(TrayState::new());
        let mut handles = vec![];

        // 多个线程同时更新资源
        for i in 0..10 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let mut resources = create_test_resources();
                resources.cpu_usage = (i * 10) as f32;
                state_clone.update_system_resources(resources);
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        // 验证最终状态有效
        let resources = state.get_system_resources();
        assert!(resources.cpu_usage >= 0.0 && resources.cpu_usage <= 100.0);
    }
}

/// 测试组：通知管理
mod notification_tests {
    use super::*;

    fn create_test_notification(id: &str, is_read: bool) -> TrayNotification {
        TrayNotification {
            id: id.to_string(),
            title: format!("通知 {}", id),
            body: format!("通知内容 {}", id),
            notification_type: NotificationType::Info,
            created_at: Utc::now(),
            is_read,
        }
    }

    #[test]
    fn test_add_notification() {
        let state = TrayState::new();
        let notif = create_test_notification("notif1", false);

        state.add_notification(notif);

        let notifications = state.get_notifications();
        assert_eq!(notifications.len(), 1);
        assert_eq!(notifications[0].id, "notif1");
        assert_eq!(state.get_unread_notification_count(), 1);
    }

    #[test]
    fn test_add_multiple_notifications() {
        let state = TrayState::new();

        for i in 0..5 {
            state.add_notification(create_test_notification(&format!("notif{}", i), false));
        }

        assert_eq!(state.get_notifications().len(), 5);
        assert_eq!(state.get_unread_notification_count(), 5);
    }

    #[test]
    fn test_max_50_notifications() {
        let state = TrayState::new();

        // 添加 60 条通知
        for i in 0..60 {
            state.add_notification(create_test_notification(&format!("notif{}", i), false));
        }

        assert_eq!(
            state.get_notifications().len(),
            50,
            "应该只保留最近的 50 条通知"
        );
        assert_eq!(state.get_unread_notification_count(), 50);
    }

    #[test]
    fn test_notifications_order() {
        let state = TrayState::new();

        state.add_notification(create_test_notification("notif1", false));
        thread::sleep(std::time::Duration::from_millis(10));
        state.add_notification(create_test_notification("notif2", false));
        thread::sleep(std::time::Duration::from_millis(10));
        state.add_notification(create_test_notification("notif3", false));

        let notifications = state.get_notifications();
        // 新通知应该在前面
        assert_eq!(notifications[0].id, "notif3");
        assert_eq!(notifications[1].id, "notif2");
        assert_eq!(notifications[2].id, "notif1");
    }

    #[test]
    fn test_get_unread_notifications() {
        let state = TrayState::new();

        state.add_notification(create_test_notification("notif1", false));
        state.add_notification(create_test_notification("notif2", true));
        state.add_notification(create_test_notification("notif3", false));
        state.add_notification(create_test_notification("notif4", true));

        let unread = state.get_unread_notifications();
        assert_eq!(unread.len(), 2);
        assert!(unread.iter().any(|n| n.id == "notif1"));
        assert!(unread.iter().any(|n| n.id == "notif3"));
    }

    #[test]
    fn test_mark_notification_read() {
        let state = TrayState::new();

        state.add_notification(create_test_notification("notif1", false));
        state.add_notification(create_test_notification("notif2", false));

        assert_eq!(state.get_unread_notification_count(), 2);

        state.mark_notification_read("notif1");

        assert_eq!(state.get_unread_notification_count(), 1);

        let unread = state.get_unread_notifications();
        assert_eq!(unread.len(), 1);
        assert_eq!(unread[0].id, "notif2");
    }

    #[test]
    fn test_mark_nonexistent_notification_read() {
        let state = TrayState::new();
        state.add_notification(create_test_notification("notif1", false));

        // 标记不存在的通知为已读不应该报错
        state.mark_notification_read("nonexistent");

        assert_eq!(state.get_unread_notification_count(), 1);
    }

    #[test]
    fn test_mark_all_notifications_read() {
        let state = TrayState::new();

        for i in 0..5 {
            state.add_notification(create_test_notification(&format!("notif{}", i), false));
        }

        assert_eq!(state.get_unread_notification_count(), 5);

        state.mark_all_notifications_read();

        assert_eq!(state.get_unread_notification_count(), 0);
        assert_eq!(state.get_unread_notifications().len(), 0);

        // 所有通知仍然存在，只是都标记为已读
        assert_eq!(state.get_notifications().len(), 5);
    }

    #[test]
    fn test_clear_notifications() {
        let state = TrayState::new();

        for i in 0..5 {
            state.add_notification(create_test_notification(&format!("notif{}", i), false));
        }

        assert_eq!(state.get_notifications().len(), 5);
        assert_eq!(state.get_unread_notification_count(), 5);

        state.clear_notifications();

        assert_eq!(state.get_notifications().len(), 0);
        assert_eq!(state.get_unread_notification_count(), 0);
    }

    #[test]
    fn test_notification_types() {
        let state = TrayState::new();

        let types = vec![
            NotificationType::Info,
            NotificationType::Warning,
            NotificationType::Error,
            NotificationType::Success,
            NotificationType::Message,
        ];

        for (i, notif_type) in types.iter().enumerate() {
            let mut notif = create_test_notification(&format!("notif{}", i), false);
            notif.notification_type = notif_type.clone();
            state.add_notification(notif);
        }

        let notifications = state.get_notifications();
        assert_eq!(notifications.len(), 5);

        // 验证每种类型都存在
        for notif_type in types {
            assert!(notifications
                .iter()
                .any(|n| n.notification_type == notif_type));
        }
    }

    #[test]
    fn test_unread_count_accuracy() {
        let state = TrayState::new();

        // 添加混合的已读和未读通知
        state.add_notification(create_test_notification("notif1", false)); // 未读
        state.add_notification(create_test_notification("notif2", true));  // 已读
        state.add_notification(create_test_notification("notif3", false)); // 未读
        state.add_notification(create_test_notification("notif4", false)); // 未读

        assert_eq!(state.get_unread_notification_count(), 3);

        // 标记一个为已读
        state.mark_notification_read("notif1");
        assert_eq!(state.get_unread_notification_count(), 2);

        // 标记另一个为已读
        state.mark_notification_read("notif3");
        assert_eq!(state.get_unread_notification_count(), 1);

        // 标记全部为已读
        state.mark_all_notifications_read();
        assert_eq!(state.get_unread_notification_count(), 0);
    }

    #[test]
    fn test_notification_thread_safety() {
        let state = Arc::new(TrayState::new());
        let mut handles = vec![];

        // 多个线程同时添加通知
        for i in 0..100 {
            let state_clone = Arc::clone(&state);
            let handle = thread::spawn(move || {
                let notif = create_test_notification(&format!("notif{}", i), i % 2 == 0);
                state_clone.add_notification(notif);
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        // 应该只保留 50 条通知
        assert_eq!(state.get_notifications().len(), 50);
        
        // 未读计数应该是合理的
        let unread_count = state.get_unread_notification_count();
        assert!(unread_count <= 50);
    }
}

/// 测试组：综合场景测试
mod integration_tests {
    use super::*;

    #[test]
    fn test_complete_workflow() {
        let state = TrayState::new();

        // 1. 设置初始状态
        state.set_icon_state(TrayIconState::Idle);

        // 2. 添加对话
        let conv = RecentConversation {
            id: "conv1".to_string(),
            title: "测试对话".to_string(),
            last_message: "你好".to_string(),
            updated_at: Utc::now(),
            unread_count: 3,
        };
        state.add_or_update_conversation(conv);

        // 3. 更新系统资源
        let resources = SystemResources {
            cpu_usage: 25.0,
            memory_usage: 50.0,
            total_memory: 8_000_000_000,
            used_memory: 4_000_000_000,
            uptime: 1800,
            updated_at: Utc::now(),
        };
        state.update_system_resources(resources);

        // 4. 添加通知
        let notif = TrayNotification {
            id: "notif1".to_string(),
            title: "新消息".to_string(),
            body: "你有新的消息".to_string(),
            notification_type: NotificationType::Message,
            created_at: Utc::now(),
            is_read: false,
        };
        state.add_notification(notif);

        // 5. 验证状态
        assert_eq!(state.get_icon_state(), TrayIconState::Idle);
        assert_eq!(state.get_recent_conversations().len(), 1);
        assert_eq!(state.get_total_unread_count(), 3);
        assert_eq!(state.get_system_resources().cpu_usage, 25.0);
        assert_eq!(state.get_notifications().len(), 1);
        assert_eq!(state.get_unread_notification_count(), 1);

        // 6. 标记对话和通知为已读
        state.mark_conversation_read("conv1");
        state.mark_notification_read("notif1");

        assert_eq!(state.get_total_unread_count(), 0);
        assert_eq!(state.get_unread_notification_count(), 0);
    }

    #[test]
    fn test_default_trait() {
        let state1 = TrayState::default();
        let state2 = TrayState::new();

        assert_eq!(state1.get_icon_state(), state2.get_icon_state());
        assert_eq!(
            state1.get_recent_conversations().len(),
            state2.get_recent_conversations().len()
        );
        assert_eq!(
            state1.get_notifications().len(),
            state2.get_notifications().len()
        );
    }

    #[test]
    fn test_system_resources_default() {
        let resources = SystemResources::default();
        assert_eq!(resources.cpu_usage, 0.0);
        assert_eq!(resources.memory_usage, 0.0);
        assert_eq!(resources.total_memory, 0);
        assert_eq!(resources.used_memory, 0);
        assert_eq!(resources.uptime, 0);
    }

    #[test]
    fn test_concurrent_operations() {
        let state = Arc::new(TrayState::new());
        let mut handles = vec![];

        // 线程1: 修改图标状态
        {
            let state = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                for i in 0..10 {
                    let icon_state = match i % 5 {
                        0 => TrayIconState::Idle,
                        1 => TrayIconState::Active,
                        2 => TrayIconState::Busy,
                        3 => TrayIconState::Notification,
                        _ => TrayIconState::Error,
                    };
                    state.set_icon_state(icon_state);
                }
            }));
        }

        // 线程2: 添加对话
        {
            let state = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                for i in 0..10 {
                    let conv = RecentConversation {
                        id: format!("conv{}", i),
                        title: format!("对话 {}", i),
                        last_message: "消息".to_string(),
                        updated_at: Utc::now(),
                        unread_count: i,
                    };
                    state.add_or_update_conversation(conv);
                }
            }));
        }

        // 线程3: 添加通知
        {
            let state = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                for i in 0..10 {
                    let notif = TrayNotification {
                        id: format!("notif{}", i),
                        title: "通知".to_string(),
                        body: "内容".to_string(),
                        notification_type: NotificationType::Info,
                        created_at: Utc::now(),
                        is_read: false,
                    };
                    state.add_notification(notif);
                }
            }));
        }

        // 线程4: 更新系统资源
        {
            let state = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                for i in 0..10 {
                    let resources = SystemResources {
                        cpu_usage: (i * 10) as f32,
                        memory_usage: 50.0,
                        total_memory: 8_000_000_000,
                        used_memory: 4_000_000_000,
                        uptime: i as u64 * 100,
                        updated_at: Utc::now(),
                    };
                    state.update_system_resources(resources);
                }
            }));
        }

        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }

        // 验证最终状态的一致性
        assert!(state.get_recent_conversations().len() <= 10);
        assert!(state.get_notifications().len() <= 50);
        assert!(matches!(
            state.get_icon_state(),
            TrayIconState::Idle
                | TrayIconState::Active
                | TrayIconState::Busy
                | TrayIconState::Notification
                | TrayIconState::Error
        ));
    }
}


