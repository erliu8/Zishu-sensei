//! # Python API 桥接模块
//! 
//! 提供与 Python API 服务器通信的 HTTP 客户端功能

use anyhow::{Context, Result};
use parking_lot::RwLock;
use reqwest::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error, info, warn};

/// API 客户端配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// API 基础 URL
    pub base_url: String,
    /// 请求超时时间（秒）
    pub timeout: u64,
    /// 最大重试次数
    pub max_retries: u32,
    /// 重试延迟（毫秒）
    pub retry_delay: u64,
    /// 是否启用缓存
    pub enable_cache: bool,
    /// 连接池大小
    pub pool_size: usize,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            base_url: "http://127.0.0.1:8000".to_string(),
            timeout: 30,
            max_retries: 3,
            retry_delay: 1000,
            enable_cache: true,
            pool_size: 10,
        }
    }
}

/// Python API 桥接客户端
pub struct PythonApiBridge {
    /// HTTP 客户端
    client: Client,
    /// 配置
    config: Arc<RwLock<ApiConfig>>,
    /// 请求计数器
    request_count: Arc<RwLock<u64>>,
}

impl PythonApiBridge {
    /// 创建新的 API 桥接实例
    pub fn new(config: ApiConfig) -> Result<Self> {
        let client = ClientBuilder::new()
            .timeout(Duration::from_secs(config.timeout))
            .pool_max_idle_per_host(config.pool_size)
            .user_agent("Zishu-Sensei-Desktop/1.0")
            .build()
            .context("创建 HTTP 客户端失败")?;

        Ok(Self {
            client,
            config: Arc::new(RwLock::new(config)),
            request_count: Arc::new(RwLock::new(0)),
        })
    }

    /// 创建默认实例
    pub fn default() -> Result<Self> {
        Self::new(ApiConfig::default())
    }

    /// 获取配置
    pub fn get_config(&self) -> ApiConfig {
        self.config.read().clone()
    }

    /// 更新配置
    pub fn update_config(&self, config: ApiConfig) {
        *self.config.write() = config;
    }

    /// 获取请求计数
    pub fn get_request_count(&self) -> u64 {
        *self.request_count.read()
    }

    /// 增加请求计数
    fn increment_request_count(&self) {
        *self.request_count.write() += 1;
    }

    /// 构建完整 URL
    fn build_url(&self, path: &str) -> String {
        let base_url = self.config.read().base_url.clone();
        format!("{}{}", base_url.trim_end_matches('/'), path)
    }

    /// 发送 GET 请求
    pub async fn get<T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
    ) -> Result<T> {
        self.increment_request_count();
        let url = self.build_url(path);
        
        debug!("发送 GET 请求: {}", url);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .context(format!("GET 请求失败: {}", url))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("GET 请求返回错误状态 {}: {}", status, error_text);
            anyhow::bail!("请求失败: {} - {}", status, error_text);
        }

        let data = response
            .json::<T>()
            .await
            .context("解析响应 JSON 失败")?;

        debug!("GET 请求成功: {}", url);
        Ok(data)
    }

    /// 发送 POST 请求
    pub async fn post<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<R> {
        self.increment_request_count();
        let url = self.build_url(path);
        
        debug!("发送 POST 请求: {}", url);
        
        let response = self.client
            .post(&url)
            .json(body)
            .send()
            .await
            .context(format!("POST 请求失败: {}", url))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("POST 请求返回错误状态 {}: {}", status, error_text);
            anyhow::bail!("请求失败: {} - {}", status, error_text);
        }

        let data = response
            .json::<R>()
            .await
            .context("解析响应 JSON 失败")?;

        debug!("POST 请求成功: {}", url);
        Ok(data)
    }

    /// 发送 DELETE 请求
    pub async fn delete<T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
    ) -> Result<T> {
        self.increment_request_count();
        let url = self.build_url(path);
        
        debug!("发送 DELETE 请求: {}", url);
        
        let response = self.client
            .delete(&url)
            .send()
            .await
            .context(format!("DELETE 请求失败: {}", url))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("DELETE 请求返回错误状态 {}: {}", status, error_text);
            anyhow::bail!("请求失败: {} - {}", status, error_text);
        }

        let data = response
            .json::<T>()
            .await
            .context("解析响应 JSON 失败")?;

        debug!("DELETE 请求成功: {}", url);
        Ok(data)
    }

    /// 带重试的请求
    pub async fn post_with_retry<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<R> {
        let max_retries = self.config.read().max_retries;
        let retry_delay = self.config.read().retry_delay;
        
        let mut last_error = None;
        
        for attempt in 0..=max_retries {
            if attempt > 0 {
                warn!("重试请求 ({}/{}): {}", attempt, max_retries, path);
                tokio::time::sleep(Duration::from_millis(retry_delay * attempt as u64)).await;
            }
            
            match self.post::<T, R>(path, body).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    last_error = Some(e);
                    if attempt < max_retries {
                        debug!("请求失败，准备重试: {}", path);
                    }
                }
            }
        }
        
        Err(last_error.unwrap())
    }

    /// 健康检查
    pub async fn health_check(&self) -> Result<bool> {
        let url = self.build_url("/health");
        
        match self.client.get(&url).send().await {
            Ok(response) => {
                let is_healthy = response.status().is_success();
                if is_healthy {
                    info!("Python API 服务器健康检查通过");
                } else {
                    warn!("Python API 服务器健康检查失败: {}", response.status());
                }
                Ok(is_healthy)
            }
            Err(e) => {
                error!("Python API 服务器健康检查失败: {}", e);
                Ok(false)
            }
        }
    }

    /// 获取系统信息
    pub async fn get_system_info(&self) -> Result<serde_json::Value> {
        self.get("/system/info").await
    }
}

// ================================
// 聊天相关的数据类型定义
// ================================

/// 消息角色
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Function,
}

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: MessageRole,
    pub content: String,
}

/// 聊天请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// 聊天选择
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChoice {
    pub index: i32,
    pub message: ChatMessageResponse,
    pub finish_reason: Option<String>,
}

/// 聊天消息响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageResponse {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotion: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processing_time: Option<f64>,
}

/// Token 使用统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatUsage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}

/// 聊天完成响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<ChatChoice>,
    pub usage: ChatUsage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// 历史记录响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryResponse {
    pub session_id: String,
    pub messages: Vec<ChatMessageResponse>,
    pub total_count: i32,
}

/// 清空历史响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearHistoryResponse {
    pub message: String,
    pub session_id: String,
}

// ================================
// 聊天相关的 API 方法
// ================================

impl PythonApiBridge {
    /// 发送聊天消息
    pub async fn send_chat_message(
        &self,
        request: ChatRequest,
    ) -> Result<ChatCompletionResponse> {
        self.post_with_retry("/chat/completions", &request).await
    }

    /// 获取聊天历史
    pub async fn get_chat_history(
        &self,
        session_id: &str,
        limit: Option<u32>,
    ) -> Result<HistoryResponse> {
        let path = if let Some(limit) = limit {
            format!("/chat/history/{}?limit={}", session_id, limit)
        } else {
            format!("/chat/history/{}", session_id)
        };
        
        self.get(&path).await
    }

    /// 清空聊天历史
    pub async fn clear_chat_history(
        &self,
        session_id: &str,
    ) -> Result<ClearHistoryResponse> {
        let path = format!("/chat/history/{}", session_id);
        self.delete(&path).await
    }
}

// ================================
// 测试模块
// ================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_config_default() {
        let config = ApiConfig::default();
        assert_eq!(config.base_url, "http://127.0.0.1:8000");
        assert_eq!(config.timeout, 30);
        assert_eq!(config.max_retries, 3);
    }

    #[test]
    fn test_bridge_creation() {
        let bridge = PythonApiBridge::default();
        assert!(bridge.is_ok());
        
        if let Ok(bridge) = bridge {
            assert_eq!(bridge.get_request_count(), 0);
        }
    }

    #[test]
    fn test_url_building() {
        let bridge = PythonApiBridge::default().unwrap();
        let url = bridge.build_url("/test");
        assert_eq!(url, "http://127.0.0.1:8000/test");
    }

    #[tokio::test]
    async fn test_health_check() {
        let bridge = PythonApiBridge::default().unwrap();
        // 这个测试需要 Python API 服务器运行
        // 在实际测试中可能需要 mock
        let result = bridge.health_check().await;
        assert!(result.is_ok());
    }
}

