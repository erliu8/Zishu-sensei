use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkflowResponse {
    pub id: String,
    pub name: String,
    pub user_id: String,
    
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkflowDetailResponse {
    #[serde(flatten)]
    pub base: WorkflowResponse,

    pub description: HashMap<String, Value>,
    pub trgger_config: Option<HashMap<String, Value>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkflowListResponse {
    pub total: i64,
    pub items: Vec<WorkflowResponse>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkflowExecutionResponse {
    pub id: String,
    pub workflow_id: String,
    pub user_id: String,
    pub execution_status: ExecutionStatus,
    pub execution_mode: ExecutionMode,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub duration_ms: Option<i64>,
    pub error_message: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExecuteWorkflowResponse {
    pub input_data: Option<HashMap<String, Value>>,
    pub execution_mode: Execution_mode,
}


