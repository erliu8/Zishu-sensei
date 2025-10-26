//! 数据库错误类型
//!
//! 统一的数据库错误处理

pub use super::backends::{DatabaseError, DatabaseResult};

#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error;

    #[test]
    fn test_database_error_reexport_available() {
        // 验证 DatabaseError 重新导出是否可用
        let error = DatabaseError::ConnectionError("测试连接错误".to_string());
        assert!(matches!(error, DatabaseError::ConnectionError(_)));
    }

    #[test]
    fn test_database_result_reexport_available() {
        // 验证 DatabaseResult 重新导出是否可用
        let success_result: DatabaseResult<i32> = Ok(42);
        let error_result: DatabaseResult<i32> = Err(DatabaseError::NotFound("未找到".to_string()));
        
        assert!(success_result.is_ok());
        assert_eq!(success_result.unwrap(), 42);
        assert!(error_result.is_err());
    }

    #[test]
    fn test_error_type_functionality() {
        // 测试错误类型的基本功能
        let error = DatabaseError::QueryError("SQL语法错误".to_string());
        
        // 测试 Display trait
        let error_string = error.to_string();
        assert!(error_string.contains("查询错误"));
        assert!(error_string.contains("SQL语法错误"));
        
        // 测试 Error trait
        assert!(error.source().is_none());
    }

    #[test]
    fn test_error_debug_format() {
        // 测试错误的调试格式输出
        let error = DatabaseError::InvalidData("无效的JSON格式".to_string());
        let debug_output = format!("{:?}", error);
        
        assert!(debug_output.contains("InvalidData"));
        assert!(debug_output.contains("无效的JSON格式"));
    }

    #[test]
    fn test_all_error_variants_reexported() {
        // 确保所有错误变体都能通过重新导出访问
        let errors = vec![
            DatabaseError::ConnectionError("连接失败".to_string()),
            DatabaseError::QueryError("查询失败".to_string()),
            DatabaseError::NotFound("数据未找到".to_string()),
            DatabaseError::Duplicate("数据重复".to_string()),
            DatabaseError::InvalidData("数据无效".to_string()),
            DatabaseError::SerializationError("序列化失败".to_string()),
            DatabaseError::Other("其他错误".to_string()),
        ];

        // 验证每个错误变体都能正确创建和匹配
        for error in errors {
            match &error {
                DatabaseError::ConnectionError(_) => assert!(true),
                DatabaseError::QueryError(_) => assert!(true),
                DatabaseError::NotFound(_) => assert!(true),
                DatabaseError::Duplicate(_) => assert!(true),
                DatabaseError::InvalidData(_) => assert!(true),
                DatabaseError::SerializationError(_) => assert!(true),
                DatabaseError::Other(_) => assert!(true),
            }
        }
    }

    #[test]
    fn test_result_chaining() {
        // 测试 Result 链式操作
        fn create_success() -> DatabaseResult<i32> {
            Ok(100)
        }

        fn create_error() -> DatabaseResult<i32> {
            Err(DatabaseError::ConnectionError("连接超时".to_string()))
        }

        // 测试成功链式操作
        let result = create_success()
            .map(|x| x * 2)
            .and_then(|x| Ok(x + 10));
        
        assert_eq!(result.unwrap(), 210);

        // 测试错误链式操作
        let error_result = create_error()
            .map(|x| x * 2)
            .map_err(|e| DatabaseError::Other(format!("包装错误: {}", e)));
        
        assert!(error_result.is_err());
        let error_msg = error_result.unwrap_err().to_string();
        assert!(error_msg.contains("包装错误"));
        assert!(error_msg.contains("连接超时"));
    }

    #[test]
    fn test_error_conversion_compatibility() {
        // 测试错误转换兼容性
        let json_error = serde_json::from_str::<serde_json::Value>("{invalid json");
        assert!(json_error.is_err());
        
        // 测试从 serde_json::Error 到 DatabaseError 的转换
        let database_error: DatabaseError = json_error.unwrap_err().into();
        match database_error {
            DatabaseError::SerializationError(msg) => {
                assert!(!msg.is_empty());
            },
            _ => panic!("期望 SerializationError 变体"),
        }
    }
}
