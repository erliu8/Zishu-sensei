//! HTTP 客户端错误类型

use thiserror::Error;

/// API 错误类型
#[derive(Debug, Error)]
pub enum ApiError {
    /// HTTP 请求错误
    #[error("HTTP 请求失败: {0}")]
    RequestFailed(#[from] reqwest::Error),

    /// 序列化/反序列化错误
    #[error("数据序列化失败: {0}")]
    SerializationError(#[from] serde_json::Error),

    /// API 响应错误
    #[error("API 错误: {status} - {message}")]
    ApiResponseError {
        status: u16,
        message: String,
    },

    /// 网络超时
    #[error("网络请求超时")]
    Timeout,

    /// 未授权
    #[error("未授权访问")]
    Unauthorized,

    /// 服务不可用
    #[error("服务不可用")]
    ServiceUnavailable,

    /// 其他错误
    #[error("未知错误: {0}")]
    Other(String),
}

/// API 结果类型
pub type ApiResult<T> = Result<T, ApiError>;

impl From<String> for ApiError {
    fn from(s: String) -> Self {
        ApiError::Other(s)
    }
}

impl From<&str> for ApiError {
    fn from(s: &str) -> Self {
        ApiError::Other(s.to_string())
    }
}
