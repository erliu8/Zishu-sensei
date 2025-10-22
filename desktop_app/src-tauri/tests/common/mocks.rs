//! Mock 对象
//!
//! 提供各种 Mock 对象用于测试中隔离外部依赖

use mockall::*;
use async_trait::async_trait;
use std::collections::HashMap;
use serde_json::Value;

// ================================
// 数据库 Mock
// ================================

/// Mock 数据库服务接口
#[automock]
#[async_trait]
pub trait DatabaseService: Send + Sync {
    /// 获取值
    async fn get(&self, collection: &str, key: &str) -> Result<Option<Value>, String>;
    
    /// 设置值
    async fn set(&self, collection: &str, key: &str, value: &Value) -> Result<(), String>;
    
    /// 删除键
    async fn delete(&self, collection: &str, key: &str) -> Result<(), String>;
    
    /// 检查键是否存在
    async fn exists(&self, collection: &str, key: &str) -> Result<bool, String>;
    
    /// 列出所有键
    async fn list_keys(&self, collection: &str) -> Result<Vec<String>, String>;
    
    /// 清空集合
    async fn clear(&self, collection: &str) -> Result<(), String>;
    
    /// 批量获取
    async fn batch_get(&self, collection: &str, keys: Vec<String>) -> Result<HashMap<String, Value>, String>;
    
    /// 批量设置
    async fn batch_set(&self, collection: &str, items: HashMap<String, Value>) -> Result<(), String>;
}

/// 创建默认的 Mock 数据库服务
pub fn create_mock_database() -> MockDatabaseService {
    let mut mock = MockDatabaseService::new();
    
    // 设置默认行为 - get 返回测试值
    mock.expect_get()
        .returning(|_, key| Ok(Some(serde_json::json!({"value": format!("value-{}", key)}))));
    
    // 设置默认行为 - set 总是成功
    mock.expect_set()
        .returning(|_, _, _| Ok(()));
    
    // 设置默认行为 - delete 总是成功
    mock.expect_delete()
        .returning(|_, _| Ok(()));
    
    // 设置默认行为 - exists 返回 true
    mock.expect_exists()
        .returning(|_, _| Ok(true));
    
    mock
}

/// 创建空的 Mock 数据库（所有操作返回"不存在"）
pub fn create_empty_mock_database() -> MockDatabaseService {
    let mut mock = MockDatabaseService::new();
    
    mock.expect_get()
        .returning(|_, _| Ok(None));
    
    mock.expect_exists()
        .returning(|_, _| Ok(false));
    
    mock.expect_list_keys()
        .returning(|_| Ok(vec![]));
    
    mock
}

// ================================
// API 客户端 Mock
// ================================

/// Mock API 客户端接口
#[automock]
#[async_trait]
pub trait ApiClient: Send + Sync {
    /// 调用 API
    async fn call_api(&self, endpoint: &str, data: &str) -> Result<String, String>;
    
    /// GET 请求
    async fn get(&self, url: &str) -> Result<String, String>;
    
    /// POST 请求
    async fn post(&self, url: &str, body: &str) -> Result<String, String>;
    
    /// PUT 请求
    async fn put(&self, url: &str, body: &str) -> Result<String, String>;
    
    /// DELETE 请求
    async fn delete(&self, url: &str) -> Result<String, String>;
    
    /// 上传文件
    async fn upload(&self, url: &str, file_path: &str) -> Result<String, String>;
    
    /// 下载文件
    async fn download(&self, url: &str, save_path: &str) -> Result<(), String>;
}

/// 创建默认的 Mock API 客户端
pub fn create_mock_api_client() -> MockApiClient {
    let mut mock = MockApiClient::new();
    
    // 默认 API 调用返回成功
    mock.expect_call_api()
        .returning(|endpoint, _| {
            Ok(format!(r#"{{"success": true, "endpoint": "{}"}}"#, endpoint))
        });
    
    // GET 请求默认返回空对象
    mock.expect_get()
        .returning(|_| Ok(r#"{"data": []}"#.to_string()));
    
    // POST 请求默认返回成功
    mock.expect_post()
        .returning(|_, _| Ok(r#"{"success": true}"#.to_string()));
    
    mock
}

/// 创建失败的 Mock API 客户端
pub fn create_failing_mock_api_client() -> MockApiClient {
    let mut mock = MockApiClient::new();
    
    mock.expect_call_api()
        .returning(|_, _| Err("API call failed".to_string()));
    
    mock.expect_get()
        .returning(|_| Err("GET request failed".to_string()));
    
    mock.expect_post()
        .returning(|_, _| Err("POST request failed".to_string()));
    
    mock
}

// ================================
// 文件系统 Mock
// ================================

/// Mock 文件系统服务接口
#[automock]
#[async_trait]
pub trait FileSystemService: Send + Sync {
    /// 读取文件
    async fn read_file(&self, path: &str) -> Result<String, String>;
    
    /// 写入文件
    async fn write_file(&self, path: &str, content: &str) -> Result<(), String>;
    
    /// 删除文件
    async fn delete_file(&self, path: &str) -> Result<(), String>;
    
    /// 检查文件是否存在
    async fn exists(&self, path: &str) -> Result<bool, String>;
    
    /// 创建目录
    async fn create_dir(&self, path: &str) -> Result<(), String>;
    
    /// 列出目录内容
    async fn list_dir(&self, path: &str) -> Result<Vec<String>, String>;
    
    /// 获取文件大小
    async fn file_size(&self, path: &str) -> Result<u64, String>;
    
    /// 复制文件
    async fn copy_file(&self, from: &str, to: &str) -> Result<(), String>;
    
    /// 移动文件
    async fn move_file(&self, from: &str, to: &str) -> Result<(), String>;
}

/// 创建默认的 Mock 文件系统
pub fn create_mock_filesystem() -> MockFileSystemService {
    let mut mock = MockFileSystemService::new();
    
    mock.expect_read_file()
        .returning(|path| Ok(format!("content of {}", path)));
    
    mock.expect_write_file()
        .returning(|_, _| Ok(()));
    
    mock.expect_delete_file()
        .returning(|_| Ok(()));
    
    mock.expect_exists()
        .returning(|_| Ok(true));
    
    mock.expect_file_size()
        .returning(|_| Ok(1024));
    
    mock
}

// ================================
// 加密服务 Mock
// ================================

/// Mock 加密服务接口
#[automock]
#[async_trait]
pub trait EncryptionService: Send + Sync {
    /// 加密数据
    async fn encrypt(&self, plaintext: &str, key_id: &str) -> Result<Vec<u8>, String>;
    
    /// 解密数据
    async fn decrypt(&self, ciphertext: &[u8], key_id: &str) -> Result<String, String>;
    
    /// 生成密钥
    async fn generate_key(&self, key_id: &str) -> Result<(), String>;
    
    /// 删除密钥
    async fn delete_key(&self, key_id: &str) -> Result<(), String>;
    
    /// 检查密钥是否存在
    async fn key_exists(&self, key_id: &str) -> Result<bool, String>;
    
    /// 计算哈希
    async fn hash(&self, data: &str) -> Result<String, String>;
    
    /// 生成签名
    async fn sign(&self, data: &str, key_id: &str) -> Result<String, String>;
    
    /// 验证签名
    async fn verify(&self, data: &str, signature: &str, key_id: &str) -> Result<bool, String>;
}

/// 创建默认的 Mock 加密服务
pub fn create_mock_encryption() -> MockEncryptionService {
    let mut mock = MockEncryptionService::new();
    
    mock.expect_encrypt()
        .returning(|plaintext, key_id| {
            Ok(format!("encrypted_{}_{}", key_id, plaintext).into_bytes())
        });
    
    mock.expect_decrypt()
        .returning(|ciphertext, _| {
            String::from_utf8(ciphertext.to_vec())
                .map_err(|e| e.to_string())
        });
    
    mock.expect_generate_key()
        .returning(|_| Ok(()));
    
    mock.expect_key_exists()
        .returning(|_| Ok(true));
    
    mock.expect_hash()
        .returning(|data| Ok(format!("hash_{}", data)));
    
    mock
}

// ================================
// 权限检查器 Mock
// ================================

/// Mock 权限检查器接口
#[automock]
#[async_trait]
pub trait PermissionChecker: Send + Sync {
    /// 检查权限
    async fn check_permission(&self, resource: &str, action: &str) -> Result<bool, String>;
    
    /// 授予权限
    async fn grant_permission(&self, resource: &str, action: &str) -> Result<(), String>;
    
    /// 撤销权限
    async fn revoke_permission(&self, resource: &str, action: &str) -> Result<(), String>;
    
    /// 列出所有权限
    async fn list_permissions(&self, resource: &str) -> Result<Vec<String>, String>;
    
    /// 检查多个权限
    async fn check_permissions(&self, checks: Vec<(String, String)>) -> Result<HashMap<String, bool>, String>;
}

/// 创建允许所有权限的 Mock 权限检查器
pub fn create_permissive_permission_checker() -> MockPermissionChecker {
    let mut mock = MockPermissionChecker::new();
    
    mock.expect_check_permission()
        .returning(|_, _| Ok(true));
    
    mock.expect_grant_permission()
        .returning(|_, _| Ok(()));
    
    mock.expect_revoke_permission()
        .returning(|_, _| Ok(()));
    
    mock.expect_list_permissions()
        .returning(|_| Ok(vec!["read".to_string(), "write".to_string()]));
    
    mock
}

/// 创建拒绝所有权限的 Mock 权限检查器
pub fn create_restrictive_permission_checker() -> MockPermissionChecker {
    let mut mock = MockPermissionChecker::new();
    
    mock.expect_check_permission()
        .returning(|_, _| Ok(false));
    
    mock.expect_list_permissions()
        .returning(|_| Ok(vec![]));
    
    mock
}

// ================================
// 适配器管理器 Mock
// ================================

/// Mock 适配器管理器接口
#[automock]
#[async_trait]
pub trait AdapterManager: Send + Sync {
    /// 加载适配器
    async fn load_adapter(&self, adapter_id: &str) -> Result<(), String>;
    
    /// 卸载适配器
    async fn unload_adapter(&self, adapter_id: &str) -> Result<(), String>;
    
    /// 列出已加载的适配器
    async fn list_loaded_adapters(&self) -> Result<Vec<String>, String>;
    
    /// 执行适配器操作
    async fn execute_adapter(&self, adapter_id: &str, action: &str, params: HashMap<String, String>) -> Result<String, String>;
    
    /// 获取适配器状态
    async fn get_adapter_status(&self, adapter_id: &str) -> Result<String, String>;
    
    /// 更新适配器配置
    async fn update_adapter_config(&self, adapter_id: &str, config: HashMap<String, String>) -> Result<(), String>;
}

/// 创建默认的 Mock 适配器管理器
pub fn create_mock_adapter_manager() -> MockAdapterManager {
    let mut mock = MockAdapterManager::new();
    
    mock.expect_load_adapter()
        .returning(|_| Ok(()));
    
    mock.expect_unload_adapter()
        .returning(|_| Ok(()));
    
    mock.expect_list_loaded_adapters()
        .returning(|| Ok(vec!["adapter-1".to_string(), "adapter-2".to_string()]));
    
    mock.expect_get_adapter_status()
        .returning(|_| Ok("Loaded".to_string()));
    
    mock
}

// ================================
// 工作流引擎 Mock
// ================================

/// Mock 工作流引擎接口
#[automock]
#[async_trait]
pub trait WorkflowEngine: Send + Sync {
    /// 执行工作流
    async fn execute_workflow(&self, workflow_id: &str, input: HashMap<String, String>) -> Result<HashMap<String, String>, String>;
    
    /// 取消工作流
    async fn cancel_workflow(&self, execution_id: &str) -> Result<(), String>;
    
    /// 获取工作流状态
    async fn get_workflow_status(&self, execution_id: &str) -> Result<String, String>;
    
    /// 列出运行中的工作流
    async fn list_running_workflows(&self) -> Result<Vec<String>, String>;
    
    /// 注册工作流
    async fn register_workflow(&self, workflow_id: &str, definition: &str) -> Result<(), String>;
    
    /// 注销工作流
    async fn unregister_workflow(&self, workflow_id: &str) -> Result<(), String>;
}

/// 创建默认的 Mock 工作流引擎
pub fn create_mock_workflow_engine() -> MockWorkflowEngine {
    let mut mock = MockWorkflowEngine::new();
    
    mock.expect_execute_workflow()
        .returning(|_, input| Ok(input.clone()));
    
    mock.expect_cancel_workflow()
        .returning(|_| Ok(()));
    
    mock.expect_get_workflow_status()
        .returning(|_| Ok("completed".to_string()));
    
    mock.expect_list_running_workflows()
        .returning(|| Ok(vec![]));
    
    mock.expect_register_workflow()
        .returning(|_, _| Ok(()));
    
    mock
}

// ================================
// 日志服务 Mock
// ================================

/// Mock 日志服务接口
#[automock]
pub trait LogService: Send + Sync {
    /// 记录日志
    fn log(&self, level: &str, message: &str);
    
    /// 记录调试日志
    fn debug(&self, message: &str);
    
    /// 记录信息日志
    fn info(&self, message: &str);
    
    /// 记录警告日志
    fn warn(&self, message: &str);
    
    /// 记录错误日志
    fn error(&self, message: &str);
    
    /// 获取日志条目
    fn get_logs(&self, level: Option<&str>, limit: usize) -> Vec<String>;
    
    /// 清空日志
    fn clear_logs(&self);
}

/// 创建默认的 Mock 日志服务
pub fn create_mock_log_service() -> MockLogService {
    let mut mock = MockLogService::new();
    
    mock.expect_log()
        .returning(|_, _| ());
    
    mock.expect_debug()
        .returning(|_| ());
    
    mock.expect_info()
        .returning(|_| ());
    
    mock.expect_warn()
        .returning(|_| ());
    
    mock.expect_error()
        .returning(|_| ());
    
    mock.expect_get_logs()
        .returning(|_, _| vec![]);
    
    mock.expect_clear_logs()
        .returning(|| ());
    
    mock
}

// ================================
// 事件发射器 Mock
// ================================

/// Mock 事件发射器接口
#[automock]
#[async_trait]
pub trait EventEmitter: Send + Sync {
    /// 发射事件
    async fn emit(&self, event_name: &str, payload: &str) -> Result<(), String>;
    
    /// 发射全局事件
    async fn emit_global(&self, event_name: &str, payload: &str) -> Result<(), String>;
    
    /// 发射到特定窗口
    async fn emit_to_window(&self, window_id: &str, event_name: &str, payload: &str) -> Result<(), String>;
}

/// 创建默认的 Mock 事件发射器
pub fn create_mock_event_emitter() -> MockEventEmitter {
    let mut mock = MockEventEmitter::new();
    
    mock.expect_emit()
        .returning(|_, _| Ok(()));
    
    mock.expect_emit_global()
        .returning(|_, _| Ok(()));
    
    mock.expect_emit_to_window()
        .returning(|_, _, _| Ok(()));
    
    mock
}

// ================================
// HTTP 服务器 Mock (使用 mockito)
// ================================

/// 创建 Mock HTTP 服务器用于 API 测试
pub fn create_mock_http_server() -> mockito::ServerGuard {
    mockito::Server::new()
}

/// 在 Mock 服务器上设置成功的响应
pub fn setup_successful_response(server: &mut mockito::ServerGuard, path: &str, response_body: &str) -> mockito::Mock {
    server.mock("GET", path)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(response_body)
        .create()
}

/// 在 Mock 服务器上设置失败的响应
pub fn setup_error_response(server: &mut mockito::ServerGuard, path: &str, status_code: usize) -> mockito::Mock {
    server.mock("GET", path)
        .with_status(status_code)
        .with_header("content-type", "application/json")
        .with_body(r#"{"error": "Internal server error"}"#)
        .create()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_database_service() {
        let mock = create_mock_database();
        let result = mock.get("collection", "test-key").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_empty_mock_database() {
        let mock = create_empty_mock_database();
        let result = mock.get("collection", "test-key").await;
        assert!(result.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_mock_api_client() {
        let mock = create_mock_api_client();
        let result = mock.get("/test").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_permissive_permission_checker() {
        let mock = create_permissive_permission_checker();
        let result = mock.check_permission("test-resource", "read").await;
        assert_eq!(result.unwrap(), true);
    }

    #[tokio::test]
    async fn test_restrictive_permission_checker() {
        let mock = create_restrictive_permission_checker();
        let result = mock.check_permission("test-resource", "write").await;
        assert_eq!(result.unwrap(), false);
    }
}
