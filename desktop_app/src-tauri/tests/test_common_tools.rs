//! 测试通用工具集成测试

mod common;

use common::{
    TestDatabase, MockAdapterService, MockCharacterService,
    create_test_adapter, create_test_character, create_test_chat_message,
    create_timestamp, assert_json_eq,
};

#[cfg(test)]
mod test_database_tests {
    use super::*;

    #[test]
    fn test_create_and_init_database() {
        let db = TestDatabase::new_in_memory();
        assert!(db.init_full_schema().is_ok());
    }

    #[test]
    fn test_insert_adapter_data() {
        let db = TestDatabase::new_in_memory();
        db.init_adapter_tables().unwrap();
        
        db.insert_test_adapter("test-001", "Test Adapter", true).unwrap();
        
        let count = db.count_records("installed_adapters").unwrap();
        assert_eq!(count, 1);
        
        let exists = db.record_exists("installed_adapters", "id", "test-001").unwrap();
        assert!(exists);
    }

    #[test]
    fn test_insert_character_data() {
        let db = TestDatabase::new_in_memory();
        db.init_character_tables().unwrap();
        
        db.insert_test_character("char-001", "Test Character", true).unwrap();
        
        let count = db.count_records("characters").unwrap();
        assert_eq!(count, 1);
        
        let exists = db.record_exists("characters", "id", "char-001").unwrap();
        assert!(exists);
    }

    #[test]
    fn test_insert_chat_data() {
        let db = TestDatabase::new_in_memory();
        db.init_chat_tables().unwrap();
        
        db.insert_test_chat_session("session-001", "Test Session").unwrap();
        db.insert_test_chat_message(
            "msg-001",
            "session-001",
            "user",
            "Hello, world!"
        ).unwrap();
        
        let session_count = db.count_records("chat_sessions").unwrap();
        assert_eq!(session_count, 1);
        
        let message_count = db.count_records("chat_messages").unwrap();
        assert_eq!(message_count, 1);
    }

    #[test]
    fn test_clear_data() {
        let db = TestDatabase::new_in_memory();
        db.init_full_schema().unwrap();
        
        // 插入数据
        db.insert_test_adapter("test-001", "Test Adapter", true).unwrap();
        db.insert_test_character("char-001", "Test Character", true).unwrap();
        
        // 验证数据已插入
        assert_eq!(db.count_records("installed_adapters").unwrap(), 1);
        assert_eq!(db.count_records("characters").unwrap(), 1);
        
        // 清空所有数据
        db.clear_all_data().unwrap();
        
        // 验证数据已清空
        assert_eq!(db.count_records("installed_adapters").unwrap(), 0);
        assert_eq!(db.count_records("characters").unwrap(), 0);
    }

    #[test]
    fn test_partial_clear() {
        let db = TestDatabase::new_in_memory();
        db.init_full_schema().unwrap();
        
        db.insert_test_adapter("test-001", "Test Adapter", true).unwrap();
        db.insert_test_character("char-001", "Test Character", true).unwrap();
        
        // 只清空适配器数据
        db.clear_adapter_data().unwrap();
        
        assert_eq!(db.count_records("installed_adapters").unwrap(), 0);
        assert_eq!(db.count_records("characters").unwrap(), 1);
    }
}

#[cfg(test)]
mod fixtures_tests {
    use super::*;

    #[test]
    fn test_create_test_adapter() {
        let adapter = create_test_adapter("test-001", "Test Adapter");
        
        assert_eq!(adapter.id, "test-001");
        assert_eq!(adapter.name, "Test Adapter");
        assert_eq!(adapter.version, "1.0.0");
        assert_eq!(adapter.status, "installed");
    }

    #[test]
    fn test_create_test_character() {
        let character = create_test_character("char-001", "Test Character");
        
        assert_eq!(character.id, "char-001");
        assert_eq!(character.name, "Test Character");
        assert_eq!(character.gender, "female");
    }

    #[test]
    fn test_create_test_chat_message() {
        let message = create_test_chat_message("user", "Hello!");
        
        assert_eq!(message.role, "user");
        assert_eq!(message.content, "Hello!");
    }

    #[test]
    fn test_timestamp_creation() {
        let ts1 = create_timestamp();
        std::thread::sleep(std::time::Duration::from_millis(10));
        let ts2 = create_timestamp();
        
        assert!(ts2 > ts1);
    }
}

#[cfg(test)]
mod helpers_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_assert_json_eq_success() {
        let actual = json!({
            "name": "test",
            "value": 123
        });
        
        let expected = json!({
            "name": "test",
            "value": 123
        });
        
        // 应该成功，不会 panic
        assert_json_eq(&actual, &expected);
    }

    #[test]
    #[should_panic(expected = "JSON values are not equal")]
    fn test_assert_json_eq_failure() {
        let actual = json!({
            "name": "test",
            "value": 123
        });
        
        let expected = json!({
            "name": "different",
            "value": 456
        });
        
        // 应该失败并 panic
        assert_json_eq(&actual, &expected);
    }
}

#[cfg(test)]
mod mocks_tests {
    use super::*;

    #[test]
    fn test_mock_adapter_service() {
        let mut service = MockAdapterService::new();
        
        service.expect_get_adapter()
            .with(mockall::predicate::eq("test-001"))
            .returning(|id| {
                Ok(Some(create_test_adapter(id, "Test Adapter")))
            });
        
        let result = service.get_adapter("test-001").unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().id, "test-001");
    }

    #[test]
    fn test_mock_character_service() {
        let mut service = MockCharacterService::new();
        
        service.expect_get_character()
            .with(mockall::predicate::eq("char-001"))
            .returning(|id| {
                Ok(Some(create_test_character(id, "Test Character")))
            });
        
        let result = service.get_character("char-001").unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().id, "char-001");
    }

    #[test]
    fn test_mock_service_call_count() {
        let mut service = MockAdapterService::new();
        
        service.expect_list_adapters()
            .times(2)
            .returning(|| Ok(vec![
                create_test_adapter("test-001", "Adapter 1"),
                create_test_adapter("test-002", "Adapter 2"),
            ]));
        
        // 第一次调用
        let result1 = service.list_adapters().unwrap();
        assert_eq!(result1.len(), 2);
        
        // 第二次调用
        let result2 = service.list_adapters().unwrap();
        assert_eq!(result2.len(), 2);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[test]
    fn test_database_with_fixtures() {
        let db = TestDatabase::new_in_memory();
        db.init_full_schema().unwrap();
        
        // 使用 fixtures 创建数据
        let adapter = create_test_adapter("test-001", "Test Adapter");
        
        // 插入到数据库
        db.insert_test_adapter(&adapter.id, &adapter.name, true).unwrap();
        
        // 验证
        assert!(db.record_exists("installed_adapters", "id", "test-001").unwrap());
    }

    #[test]
    fn test_full_workflow() {
        // 1. 创建数据库
        let db = TestDatabase::new_in_memory();
        db.init_full_schema().unwrap();
        
        // 2. 插入适配器
        db.insert_test_adapter("adapter-001", "ChatGPT", true).unwrap();
        
        // 3. 插入角色
        db.insert_test_character("char-001", "Miku", true).unwrap();
        
        // 4. 创建聊天会话
        db.insert_test_chat_session("session-001", "Test Conversation").unwrap();
        
        // 5. 添加消息
        db.insert_test_chat_message(
            "msg-001",
            "session-001",
            "user",
            "Hello!"
        ).unwrap();
        
        db.insert_test_chat_message(
            "msg-002",
            "session-001",
            "assistant",
            "Hi there!"
        ).unwrap();
        
        // 6. 验证所有数据
        assert_eq!(db.count_records("installed_adapters").unwrap(), 1);
        assert_eq!(db.count_records("characters").unwrap(), 1);
        assert_eq!(db.count_records("chat_sessions").unwrap(), 1);
        assert_eq!(db.count_records("chat_messages").unwrap(), 2);
        
        // 7. 清空聊天数据
        db.clear_chat_data().unwrap();
        
        // 8. 验证清空结果
        assert_eq!(db.count_records("chat_sessions").unwrap(), 0);
        assert_eq!(db.count_records("chat_messages").unwrap(), 0);
        assert_eq!(db.count_records("installed_adapters").unwrap(), 1);
        assert_eq!(db.count_records("characters").unwrap(), 1);
    }
}

