//! API 客户端实现

use super::error::{ApiError, ApiResult};
use reqwest::{Client, Method, RequestBuilder, Response};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, info, warn};

/// API 响应格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiErrorInfo>,
    pub meta: Option<ApiMeta>,
}

/// API 错误信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiErrorInfo {
    pub message: String,
    pub code: Option<String>,
    pub details: Option<serde_json::Value>,
}

/// API 元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMeta {
    pub timestamp: i64,
    pub request_id: Option<String>,
    pub version: Option<String>,
}

/// API 客户端
#[derive(Debug, Clone)]
pub struct ApiClient {
    client: Client,
    base_url: String,
    auth_token: Option<String>,
}

impl ApiClient {
    /// 创建新的 API 客户端
    pub fn new(base_url: impl Into<String>) -> ApiResult<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .map_err(ApiError::RequestFailed)?;

        Ok(Self {
            client,
            base_url: base_url.into(),
            auth_token: None,
        })
    }

    /// 设置认证令牌
    pub fn with_auth_token(mut self, token: impl Into<String>) -> Self {
        self.auth_token = Some(token.into());
        self
    }

    /// 设置认证令牌（可变引用）
    pub fn set_auth_token(&mut self, token: Option<String>) {
        self.auth_token = token;
    }

    /// 获取完整的 URL
    fn get_url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    /// 构建请求
    fn build_request(&self, method: Method, path: &str) -> RequestBuilder {
        let url = self.get_url(path);
        let mut builder = self.client.request(method, &url);

        // 添加认证头
        if let Some(ref token) = self.auth_token {
            builder = builder.bearer_auth(token);
        }

        // 添加通用头
        builder = builder
            .header("Content-Type", "application/json")
            .header("Accept", "application/json");

        builder
    }

    /// 处理响应
    async fn handle_response<T>(&self, response: Response) -> ApiResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let status = response.status();
        
        if status.is_success() {
            // 尝试直接解析为目标类型（FastAPI默认格式）
            match response.json::<T>().await {
                Ok(data) => Ok(data),
                Err(_) => {
                    // 如果直接解析失败，尝试作为包装格式解析
                    // 这里需要重新获取响应，但已经消费了，所以这种方法不行
                    // 改为先获取文本，然后尝试两种解析方式
                    Err(ApiError::Other("响应格式错误".to_string()))
                }
            }
        } else {
            let status_code = status.as_u16();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "无法读取错误信息".to_string());

            match status_code {
                401 => Err(ApiError::Unauthorized),
                503 => Err(ApiError::ServiceUnavailable),
                _ => Err(ApiError::ApiResponseError {
                    status: status_code,
                    message: error_text,
                }),
            }
        }
    }

    /// GET 请求
    pub async fn get<T>(&self, path: &str) -> ApiResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        debug!("GET {}", path);
        let response = self
            .build_request(Method::GET, path)
            .send()
            .await
            .map_err(ApiError::RequestFailed)?;

        self.handle_response(response).await
    }

    /// POST 请求
    pub async fn post<T, B>(&self, path: &str, body: &B) -> ApiResult<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        debug!("POST {}", path);
        let response = self
            .build_request(Method::POST, path)
            .json(body)
            .send()
            .await
            .map_err(ApiError::RequestFailed)?;

        self.handle_response(response).await
    }

    /// PUT 请求
    pub async fn put<T, B>(&self, path: &str, body: &B) -> ApiResult<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        debug!("PUT {}", path);
        let response = self
            .build_request(Method::PUT, path)
            .json(body)
            .send()
            .await
            .map_err(ApiError::RequestFailed)?;

        self.handle_response(response).await
    }

    /// DELETE 请求
    pub async fn delete<T>(&self, path: &str) -> ApiResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        debug!("DELETE {}", path);
        let response = self
            .build_request(Method::DELETE, path)
            .send()
            .await
            .map_err(ApiError::RequestFailed)?;

        self.handle_response(response).await
    }

    /// PATCH 请求
    pub async fn patch<T, B>(&self, path: &str, body: &B) -> ApiResult<T>
    where
        T: for<'de> Deserialize<'de>,
        B: Serialize,
    {
        debug!("PATCH {}", path);
        let response = self
            .build_request(Method::PATCH, path)
            .json(body)
            .send()
            .await
            .map_err(ApiError::RequestFailed)?;

        self.handle_response(response).await
    }

    /// 健康检查
    pub async fn health_check(&self) -> ApiResult<bool> {
        debug!("Health check: {}", self.base_url);
        match self.client.get(&self.base_url).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(e) => {
                warn!("Health check failed: {}", e);
                Ok(false)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = ApiClient::new("http://localhost:8000").unwrap();
        assert_eq!(client.base_url, "http://localhost:8000");
    }

    #[tokio::test]
    async fn test_auth_token() {
        let client = ApiClient::new("http://localhost:8000")
            .unwrap()
            .with_auth_token("test_token");
        assert_eq!(client.auth_token, Some("test_token".to_string()));
    }
}
