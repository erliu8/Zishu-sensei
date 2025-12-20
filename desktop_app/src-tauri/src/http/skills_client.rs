//! Skills API 客户端

use super::client::ApiClient;
use super::error::ApiResult;
use serde::{Deserialize, Serialize};

/// Skills API 客户端
pub struct SkillsApiClient {
    client: ApiClient,
}

/// Skill 执行响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExecutionResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time: Option<f64>,
}

impl SkillsApiClient {
    /// 创建新的 Skills API 客户端
    pub fn new(base_url: impl Into<String>) -> ApiResult<Self> {
        Ok(Self {
            client: ApiClient::new(base_url)?,
        })
    }

    /// 设置认证令牌
    pub fn set_auth_token(&mut self, token: Option<String>) {
        self.client.set_auth_token(token);
    }

    /// 执行 Skill
    pub async fn execute_skill(
        &self,
        package_id: &str,
        payload: serde_json::Value,
    ) -> ApiResult<serde_json::Value> {
        let path = format!("/api/v1/skills/{}/execute", package_id);
        self.client.post(&path, &payload).await
    }

    /// 健康检查
    pub async fn health_check(&self) -> ApiResult<bool> {
        self.client.health_check().await
    }
}