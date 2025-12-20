//! 工作流 API 客户端

use super::client::ApiClient;
use super::error::ApiResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 工作流 API 客户端
pub struct WorkflowApiClient {
    client: ApiClient,
}

/// 创建工作流请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWorkflowRequest {
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub definition: serde_json::Value,
    pub trigger_type: String,
    pub trigger_config: Option<serde_json::Value>,
}

/// 更新工作流请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWorkflowRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub definition: Option<serde_json::Value>,
    pub trigger_type: Option<String>,
    pub trigger_config: Option<serde_json::Value>,
}

/// 执行工作流请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteWorkflowRequest {
    pub input_data: Option<HashMap<String, serde_json::Value>>,
    pub execution_mode: String,
}

/// 工作流响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowResponse {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub workflow_status: String,
    pub trigger_type: String,
    pub trigger_config: Option<serde_json::Value>,
    pub definition: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

/// 工作流执行响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecutionResponse {
    pub id: String,
    pub workflow_id: String,
    pub user_id: String,
    pub execution_mode: String,
    pub execution_status: String,
    pub input_data: Option<HashMap<String, serde_json::Value>>,
    pub output_data: Option<HashMap<String, serde_json::Value>>,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

impl WorkflowApiClient {
    /// 创建新的工作流 API 客户端
    pub fn new(base_url: impl Into<String>) -> ApiResult<Self> {
        Ok(Self {
            client: ApiClient::new(base_url)?,
        })
    }

    /// 设置认证令牌
    pub fn set_auth_token(&mut self, token: Option<String>) {
        self.client.set_auth_token(token);
    }

    // ================================
    // 工作流 CRUD 操作
    // ================================

    /// 创建工作流
    pub async fn create_workflow(
        &self,
        request: CreateWorkflowRequest,
    ) -> ApiResult<WorkflowResponse> {
        self.client.post("/api/workflows", &request).await
    }

    /// 获取工作流列表
    pub async fn list_workflows(
        &self,
        skip: u32,
        limit: u32,
    ) -> ApiResult<Vec<WorkflowResponse>> {
        let path = format!("/api/workflows?skip={}&limit={}", skip, limit);
        self.client.get(&path).await
    }

    /// 获取工作流详情
    pub async fn get_workflow(&self, workflow_id: &str) -> ApiResult<WorkflowResponse> {
        let path = format!("/api/workflows/{}", workflow_id);
        self.client.get(&path).await
    }

    /// 更新工作流
    pub async fn update_workflow(
        &self,
        workflow_id: &str,
        request: UpdateWorkflowRequest,
    ) -> ApiResult<WorkflowResponse> {
        let path = format!("/api/workflows/{}", workflow_id);
        self.client.put(&path, &request).await
    }

    /// 删除工作流
    pub async fn delete_workflow(&self, workflow_id: &str) -> ApiResult<()> {
        let path = format!("/api/workflows/{}", workflow_id);
        self.client.delete(&path).await
    }

    // ================================
    // 工作流执行
    // ================================

    /// 执行工作流
    pub async fn execute_workflow(
        &self,
        workflow_id: &str,
        request: ExecuteWorkflowRequest,
    ) -> ApiResult<WorkflowExecutionResponse> {
        let path = format!("/api/workflows/{}/execute", workflow_id);
        self.client.post(&path, &request).await
    }

    /// 获取工作流执行历史
    pub async fn list_executions(
        &self,
        workflow_id: &str,
        skip: u32,
        limit: u32,
    ) -> ApiResult<Vec<WorkflowExecutionResponse>> {
        let path = format!(
            "/api/workflows/{}/executions?skip={}&limit={}",
            workflow_id, skip, limit
        );
        self.client.get(&path).await
    }

    /// 获取执行详情
    pub async fn get_execution(
        &self,
        execution_id: &str,
    ) -> ApiResult<WorkflowExecutionResponse> {
        let path = format!("/api/workflows/executions/{}", execution_id);
        self.client.get(&path).await
    }

    /// 取消执行
    pub async fn cancel_execution(
        &self,
        execution_id: &str,
    ) -> ApiResult<WorkflowExecutionResponse> {
        let path = format!("/api/workflows/executions/{}/cancel", execution_id);
        self.client.post(&path, &serde_json::json!({})).await
    }

    // ================================
    // 工作流状态管理
    // ================================

    /// 发布工作流
    pub async fn publish_workflow(&self, workflow_id: &str) -> ApiResult<WorkflowResponse> {
        let path = format!("/api/workflows/{}/publish", workflow_id);
        self.client.post(&path, &serde_json::json!({})).await
    }

    /// 归档工作流
    pub async fn archive_workflow(&self, workflow_id: &str) -> ApiResult<WorkflowResponse> {
        let path = format!("/api/workflows/{}/archive", workflow_id);
        self.client.post(&path, &serde_json::json!({})).await
    }

    /// 克隆工作流
    pub async fn clone_workflow(
        &self,
        workflow_id: &str,
        new_name: &str,
    ) -> ApiResult<WorkflowResponse> {
        let path = format!("/api/workflows/{}/clone", workflow_id);
        let body = serde_json::json!({ "new_name": new_name });
        self.client.post(&path, &body).await
    }

    // ================================
    // 工作流搜索
    // ================================

    /// 搜索工作流
    pub async fn search_workflows(
        &self,
        keyword: Option<&str>,
        status: Option<&str>,
        category: Option<&str>,
        tags: Option<Vec<String>>,
    ) -> ApiResult<Vec<WorkflowResponse>> {
        let mut path = "/api/workflows/search/query?".to_string();
        
        if let Some(kw) = keyword {
            path.push_str(&format!("keyword={}&", kw));
        }
        if let Some(st) = status {
            path.push_str(&format!("status={}&", st));
        }
        if let Some(cat) = category {
            path.push_str(&format!("category={}&", cat));
        }
        if let Some(t) = tags {
            path.push_str(&format!("tags={}&", t.join(",")));
        }

        self.client.get(&path).await
    }

    // ================================
    // 工作流模板
    // ================================

    /// 获取模板列表
    pub async fn list_templates(&self, limit: u32) -> ApiResult<Vec<WorkflowResponse>> {
        let path = format!("/api/workflows/templates/list?limit={}", limit);
        self.client.get(&path).await
    }

    /// 从模板创建工作流
    pub async fn create_from_template(
        &self,
        template_id: &str,
        name: &str,
        parameters: Option<HashMap<String, serde_json::Value>>,
    ) -> ApiResult<WorkflowResponse> {
        let path = format!("/api/workflows/templates/{}/create", template_id);
        let body = serde_json::json!({
            "name": name,
            "parameters": parameters,
        });
        self.client.post(&path, &body).await
    }

    /// 健康检查
    pub async fn health_check(&self) -> ApiResult<bool> {
        self.client.health_check().await
    }
}
