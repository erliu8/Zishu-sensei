//! # 工作流注册表
//! 
//! 负责工作流的注册、管理、版本控制和持久化

use super::models::*;
use super::adapter;
use crate::database::workflow::WorkflowRegistry as DbWorkflowRegistry;
use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use tracing::info;
use uuid::Uuid;

/// 工作流注册表（业务逻辑层）
pub struct WorkflowRegistry {
    /// 数据库注册表
    db_registry: Arc<DbWorkflowRegistry>,
    /// 内存缓存
    cache: Arc<RwLock<HashMap<String, Workflow>>>,
    /// 模板缓存
    template_cache: Arc<RwLock<HashMap<String, WorkflowTemplate>>>,
}

impl WorkflowRegistry {
    /// 创建新的工作流注册表
    pub fn new(db_registry: Arc<DbWorkflowRegistry>) -> Self {
        Self {
            db_registry,
            cache: Arc::new(RwLock::new(HashMap::new())),
            template_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ================================
    // 工作流基础操作
    // ================================

    /// 创建工作流
    pub async fn create_workflow(&self, mut workflow: Workflow) -> Result<String> {
        // 验证工作流
        workflow.validate().map_err(|e| anyhow!(e))?;

        // 生成ID（如果未提供）
        if workflow.id.is_empty() {
            workflow.id = Uuid::new_v4().to_string();
        }

        // 设置时间戳
        let now = chrono::Utc::now().timestamp();
        workflow.created_at = now;
        workflow.updated_at = now;

        // 转换为数据库模型并保存
        let db_workflow = adapter::workflow_to_db(&workflow)?;
        self.db_registry.create_workflow(db_workflow)
            .map_err(|e| anyhow!("数据库错误: {}", e))?;

        // 更新缓存
        let mut cache = self.cache.write().await;
        cache.insert(workflow.id.clone(), workflow.clone());

        info!("工作流已创建: {} ({})", workflow.name, workflow.id);
        Ok(workflow.id)
    }

    /// 更新工作流
    pub async fn update_workflow(&self, mut workflow: Workflow) -> Result<()> {
        // 验证工作流
        workflow.validate().map_err(|e| anyhow!(e))?;

        // 检查工作流是否存在
        let existing_db = self.db_registry.get_workflow(&workflow.id)
            .map_err(|e| anyhow!("数据库错误: {}", e))?
            .ok_or_else(|| anyhow!("工作流不存在: {}", workflow.id))?;
        let existing = adapter::db_to_workflow(&existing_db)?;

        // 保存旧版本
        self.save_version(&existing, "更新工作流").await?;

        // 更新版本号
        workflow.version = self.increment_version(&existing.version)?;
        workflow.updated_at = chrono::Utc::now().timestamp();

        // 保存到数据库
        let db_workflow = adapter::workflow_to_db(&workflow)?;
        self.db_registry.update_workflow(db_workflow)
            .map_err(|e| anyhow!("数据库错误: {}", e))?;

        // 更新缓存
        let mut cache = self.cache.write().await;
        cache.insert(workflow.id.clone(), workflow.clone());

        info!("工作流已更新: {} ({})", workflow.name, workflow.id);
        Ok(())
    }

    /// 删除工作流
    pub async fn delete_workflow(&self, workflow_id: &str) -> Result<()> {
        // 从数据库删除
        self.db_registry.delete_workflow(workflow_id)
            .map_err(|e| anyhow!("数据库错误: {}", e))?;

        // 从缓存删除
        let mut cache = self.cache.write().await;
        cache.remove(workflow_id);

        info!("工作流已删除: {}", workflow_id);
        Ok(())
    }

    /// 获取工作流
    pub async fn get_workflow(&self, workflow_id: &str) -> Result<Workflow> {
        // 先从缓存查找
        {
            let cache = self.cache.read().await;
            if let Some(workflow) = cache.get(workflow_id) {
                return Ok(workflow.clone());
            }
        }

        // 从数据库加载
        let db_workflow = self.db_registry.get_workflow(workflow_id)
            .map_err(|e| anyhow!("数据库错误: {}", e))?
            .ok_or_else(|| anyhow!("工作流不存在: {}", workflow_id))?;
        let workflow = adapter::db_to_workflow(&db_workflow)?;

        // 更新缓存
        {
            let mut cache = self.cache.write().await;
            cache.insert(workflow_id.to_string(), workflow.clone());
        }

        Ok(workflow)
    }

    /// 列出所有工作流
    pub async fn list_workflows(&self) -> Result<Vec<Workflow>> {
        let db_workflows = self.db_registry.get_all_workflows()
            .map_err(|e| anyhow!("数据库错误: {}", e))?;
        
        let mut workflows = Vec::new();
        for db_workflow in db_workflows {
            workflows.push(adapter::db_to_workflow(&db_workflow)?);
        }
        
        Ok(workflows)
    }

    /// 按条件搜索工作流
    pub async fn search_workflows(
        &self,
        keyword: Option<&str>,
        status: Option<WorkflowStatus>,
        tags: Option<Vec<String>>,
        category: Option<&str>,
    ) -> Result<Vec<Workflow>> {
        // 从数据库获取所有工作流
        let db_workflows = if let Some(keyword) = keyword {
            self.db_registry.search_workflows(keyword)
                .map_err(|e| anyhow!("数据库错误: {}", e))?
        } else if let Some(category) = category {
            self.db_registry.get_workflows_by_category(category)
                .map_err(|e| anyhow!("数据库错误: {}", e))?
        } else {
            self.db_registry.get_all_workflows()
                .map_err(|e| anyhow!("数据库错误: {}", e))?
        };

        // 转换为业务模型并过滤
        let mut workflows = Vec::new();
        for db_workflow in db_workflows {
            let workflow = adapter::db_to_workflow(&db_workflow)?;
            
            // 应用状态过滤
            if let Some(ref status_filter) = status {
                if workflow.status != *status_filter {
                    continue;
                }
            }
            
            // 应用标签过滤
            if let Some(ref tags_filter) = tags {
                let has_tag = tags_filter.iter().any(|tag| workflow.tags.contains(tag));
                if !has_tag {
                    continue;
                }
            }
            
            workflows.push(workflow);
        }
        
        Ok(workflows)
    }

    // ================================
    // 工作流版本控制
    // ================================

    /// 保存工作流版本
    async fn save_version(&self, workflow: &Workflow, changelog: &str) -> Result<()> {
        // 数据库版本记录在创建/更新工作流时自动创建
        info!("工作流版本已保存: {} v{}", workflow.id, workflow.version);
        Ok(())
    }

    /// 获取工作流版本历史
    pub async fn get_workflow_versions(&self, workflow_id: &str) -> Result<Vec<WorkflowVersion>> {
        let db_versions = self.db_registry.get_workflow_versions(workflow_id)
            .map_err(|e| anyhow!("数据库错误: {}", e))?;
        
        let mut versions = Vec::new();
        for db_version in db_versions {
            let steps: Vec<WorkflowStep> = db_version.steps
                .as_ref()
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            let config: WorkflowConfig = db_version.config
                .as_ref()
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            
            let workflow = Workflow {
                id: db_version.id.clone(),
                name: db_version.name.clone(),
                description: db_version.description.clone(),
                version: db_version.version.clone(),
                status: adapter::db_status_to_workflow(db_version.status),
                steps,
                config,
                trigger: None,
                tags: vec![],
                category: db_version.category.clone(),
                is_template: db_version.is_template,
                template_id: db_version.template_id.clone(),
                created_at: db_version.created_at,
                updated_at: db_version.updated_at,
            };
            
            versions.push(crate::workflow::models::WorkflowVersion {
                id: 0, // FIXME: need proper version ID
                workflow_id: db_version.id.clone(),
                version: db_version.version.clone(),
                workflow,
                changelog: None, // FIXME: need changelog field in WorkflowDefinition
                created_by: None,
                created_at: db_version.created_at,
            });
        }
        
        Ok(versions)
    }

    /// 获取指定版本的工作流
    pub async fn get_workflow_version(
        &self,
        workflow_id: &str,
        version: &str,
    ) -> Result<Workflow> {
        let db_version = self.db_registry.get_workflow_version(workflow_id, version)
            .map_err(|e| anyhow!("数据库错误: {}", e))?
            .ok_or_else(|| anyhow!("工作流版本不存在: {} v{}", workflow_id, version))?;

        let steps: Vec<WorkflowStep> = db_version.steps
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();
        
        let config: WorkflowConfig = db_version.config
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();
        
        let workflow = Workflow {
            id: db_version.id.clone(),
            name: format!("Version {}", db_version.version),
            description: None,
            version: db_version.version,
            status: WorkflowStatus::Draft,
            steps,
            config,
            trigger: None,
            tags: vec![],
            category: String::new(),
            is_template: false,
            template_id: None,
            created_at: db_version.created_at,
            updated_at: db_version.created_at,
        };

        Ok(workflow)
    }

    /// 回滚到指定版本
    pub async fn rollback_to_version(
        &self,
        workflow_id: &str,
        version: &str,
    ) -> Result<()> {
        let workflow = self.get_workflow_version(workflow_id, version).await?;
        
        // 保存当前版本
        let current = self.get_workflow(workflow_id).await?;
        self.save_version(&current, "回滚前备份").await?;

        // 更新工作流
        self.update_workflow(workflow).await?;

        info!("工作流已回滚: {} 到版本 {}", workflow_id, version);
        Ok(())
    }

    /// 递增版本号
    fn increment_version(&self, current_version: &str) -> Result<String> {
        let parts: Vec<&str> = current_version.split('.').collect();
        if parts.len() != 3 {
            return Err(anyhow!("无效的版本号格式: {}", current_version));
        }

        let major: u32 = parts[0].parse()?;
        let minor: u32 = parts[1].parse()?;
        let patch: u32 = parts[2].parse()?;

        Ok(format!("{}.{}.{}", major, minor, patch + 1))
    }

    // ================================
    // 工作流模板管理
    // ================================

    /// 创建工作流模板
    pub async fn create_template(&self, mut template: WorkflowTemplate) -> Result<String> {
        // 生成ID（如果未提供）
        if template.id.is_empty() {
            template.id = Uuid::new_v4().to_string();
        }

        // 设置时间戳
        let now = chrono::Utc::now().timestamp();
        template.created_at = now;
        template.updated_at = now;

        // 标记工作流为模板
        template.workflow.id = template.id.clone();
        template.workflow.is_template = true;

        // 保存到数据库
        let db_workflow = adapter::workflow_to_db(&template.workflow)?;
        self.db_registry.create_workflow(db_workflow)
            .map_err(|e| anyhow!("数据库错误: {}", e))?;

        // 更新模板缓存
        let mut cache = self.template_cache.write().await;
        cache.insert(template.id.clone(), template.clone());

        info!("工作流模板已创建: {} ({})", template.name, template.id);
        Ok(template.id)
    }

    /// 更新工作流模板
    pub async fn update_template(&self, mut template: WorkflowTemplate) -> Result<()> {
        // 更新时间戳
        template.updated_at = chrono::Utc::now().timestamp();
        template.workflow.updated_at = template.updated_at;

        // 保存到数据库
        let db_workflow = adapter::workflow_to_db(&template.workflow)?;
        self.db_registry.update_workflow(db_workflow)
            .map_err(|e| anyhow!("数据库错误: {}", e))?;

        // 更新模板缓存
        let mut cache = self.template_cache.write().await;
        cache.insert(template.id.clone(), template.clone());

        info!("工作流模板已更新: {} ({})", template.name, template.id);
        Ok(())
    }

    /// 删除工作流模板
    pub async fn delete_template(&self, template_id: &str) -> Result<()> {
        // 从数据库删除
        self.db_registry.delete_workflow(template_id)
            .map_err(|e| anyhow!("数据库错误: {}", e))?;

        // 从缓存删除
        let mut cache = self.template_cache.write().await;
        cache.remove(template_id);

        info!("工作流模板已删除: {}", template_id);
        Ok(())
    }

    /// 获取工作流模板
    pub async fn get_template(&self, template_id: &str) -> Result<WorkflowTemplate> {
        // 先从缓存查找
        {
            let cache = self.template_cache.read().await;
            if let Some(template) = cache.get(template_id) {
                return Ok(template.clone());
            }
        }

        // 从数据库加载
        let db_workflow = self.db_registry.get_workflow(template_id)
            .map_err(|e| anyhow!("数据库错误: {}", e))?
            .ok_or_else(|| anyhow!("工作流模板不存在: {}", template_id))?;
        
        if !db_workflow.is_template {
            return Err(anyhow!("工作流不是模板: {}", template_id));
        }
        
        let workflow = adapter::db_to_workflow(&db_workflow)?;
        
        let template = WorkflowTemplate {
            id: workflow.id.clone(),
            name: workflow.name.clone(),
            description: workflow.description.clone(),
            template_type: workflow.category.clone(),
            workflow,
            parameters: vec![],
            tags: vec![],
            created_at: db_workflow.created_at,
            updated_at: db_workflow.updated_at,
        };

        // 更新缓存
        {
            let mut cache = self.template_cache.write().await;
            cache.insert(template_id.to_string(), template.clone());
        }

        Ok(template)
    }

    /// 列出所有模板
    pub async fn list_templates(&self) -> Result<Vec<WorkflowTemplate>> {
        let db_workflows = self.db_registry.get_templates()
            .map_err(|e| anyhow!("数据库错误: {}", e))?;
        
        let mut templates = Vec::new();
        for db_workflow in db_workflows {
            let workflow = adapter::db_to_workflow(&db_workflow)?;
            let template = WorkflowTemplate {
                id: workflow.id.clone(),
                name: workflow.name.clone(),
                description: workflow.description.clone(),
                template_type: workflow.category.clone(),
                workflow,
                parameters: vec![],
                tags: vec![],
                created_at: db_workflow.created_at,
                updated_at: db_workflow.updated_at,
            };
            templates.push(template);
        }
        
        Ok(templates)
    }

    /// 从模板创建工作流
    pub async fn create_from_template(
        &self,
        template_id: &str,
        name: String,
        parameters: HashMap<String, serde_json::Value>,
    ) -> Result<String> {
        // 获取模板
        let template = self.get_template(template_id).await?;

        // 创建工作流
        let mut workflow = template.workflow.clone();
        workflow.id = Uuid::new_v4().to_string();
        workflow.name = name;
        workflow.is_template = false;
        workflow.template_id = Some(template_id.to_string());

        // 应用参数
        self.apply_template_parameters(&mut workflow, &template.parameters, parameters)?;

        // 创建工作流
        self.create_workflow(workflow).await
    }

    /// 应用模板参数
    fn apply_template_parameters(
        &self,
        workflow: &mut Workflow,
        param_defs: &[TemplateParameter],
        params: HashMap<String, serde_json::Value>,
    ) -> Result<()> {
        // 验证必需参数
        for param_def in param_defs {
            if param_def.required && !params.contains_key(&param_def.name) {
                if param_def.default.is_none() {
                    return Err(anyhow!("缺少必需参数: {}", param_def.name));
                }
            }
        }

        // 替换工作流中的参数占位符
        let workflow_json = serde_json::to_string(workflow)?;
        let mut replaced = workflow_json;

        for (key, value) in &params {
            let placeholder = format!("{{{{{}}}}}",  key);
            let value_str = match value {
                serde_json::Value::String(s) => s.clone(),
                v => v.to_string(),
            };
            replaced = replaced.replace(&placeholder, &value_str);
        }

        // 应用默认值
        for param_def in param_defs {
            if !params.contains_key(&param_def.name) {
                if let Some(default) = &param_def.default {
                    let placeholder = format!("{{{{{}}}}}", param_def.name);
                    let value_str = match default {
                        serde_json::Value::String(s) => s.clone(),
                        v => v.to_string(),
                    };
                    replaced = replaced.replace(&placeholder, &value_str);
                }
            }
        }

        *workflow = serde_json::from_str(&replaced)?;
        Ok(())
    }

    // ================================
    // 工作流导入/导出
    // ================================

    /// 导出工作流
    pub async fn export_workflows(
        &self,
        workflow_ids: Vec<String>,
        include_templates: bool,
    ) -> Result<WorkflowExport> {
        let mut workflows = Vec::new();
        for id in workflow_ids {
            if let Ok(workflow) = self.get_workflow(&id).await {
                workflows.push(workflow);
            }
        }

        let templates = if include_templates {
            self.list_templates().await?
        } else {
            Vec::new()
        };

        Ok(WorkflowExport::new(workflows, templates))
    }

    /// 导出所有工作流
    pub async fn export_all(&self, include_templates: bool) -> Result<WorkflowExport> {
        let workflows = self.list_workflows().await?;
        let templates = if include_templates {
            self.list_templates().await?
        } else {
            Vec::new()
        };

        Ok(WorkflowExport::new(workflows, templates))
    }

    /// 导入工作流
    pub async fn import_workflows(
        &self,
        export: WorkflowExport,
        overwrite: bool,
    ) -> Result<ImportResult> {
        let mut result = ImportResult::default();

        // 导入工作流
        for workflow in export.workflows {
            match self.import_workflow(workflow, overwrite).await {
                Ok(id) => {
                    result.imported_workflows.push(id);
                    result.success_count += 1;
                }
                Err(e) => {
                    result.errors.push(format!("导入工作流失败: {}", e));
                    result.error_count += 1;
                }
            }
        }

        // 导入模板
        for template in export.templates {
            match self.import_template(template, overwrite).await {
                Ok(id) => {
                    result.imported_templates.push(id);
                    result.success_count += 1;
                }
                Err(e) => {
                    result.errors.push(format!("导入模板失败: {}", e));
                    result.error_count += 1;
                }
            }
        }

        info!("导入完成: 成功 {}, 失败 {}", result.success_count, result.error_count);
        Ok(result)
    }

    /// 导入单个工作流
    async fn import_workflow(&self, workflow: Workflow, overwrite: bool) -> Result<String> {
        // 检查是否已存在
        if let Ok(_) = self.get_workflow(&workflow.id).await {
            if !overwrite {
                return Err(anyhow!("工作流已存在: {}", workflow.id));
            }
            // 覆盖现有工作流
            self.update_workflow(workflow.clone()).await?;
            Ok(workflow.id)
        } else {
            // 创建新工作流
            self.create_workflow(workflow).await
        }
    }

    /// 导入单个模板
    async fn import_template(&self, template: WorkflowTemplate, overwrite: bool) -> Result<String> {
        // 检查是否已存在
        if let Ok(_) = self.get_template(&template.id).await {
            if !overwrite {
                return Err(anyhow!("模板已存在: {}", template.id));
            }
            // 覆盖现有模板
            self.update_template(template.clone()).await?;
            Ok(template.id)
        } else {
            // 创建新模板
            self.create_template(template).await
        }
    }

    // ================================
    // 工作流状态管理
    // ================================

    /// 发布工作流
    pub async fn publish_workflow(&self, workflow_id: &str) -> Result<()> {
        let mut workflow = self.get_workflow(workflow_id).await?;
        workflow.status = WorkflowStatus::Published;
        self.update_workflow(workflow).await
    }

    /// 归档工作流
    pub async fn archive_workflow(&self, workflow_id: &str) -> Result<()> {
        let mut workflow = self.get_workflow(workflow_id).await?;
        workflow.status = WorkflowStatus::Archived;
        self.update_workflow(workflow).await
    }

    /// 禁用工作流
    pub async fn disable_workflow(&self, workflow_id: &str) -> Result<()> {
        let mut workflow = self.get_workflow(workflow_id).await?;
        workflow.status = WorkflowStatus::Disabled;
        self.update_workflow(workflow).await
    }

    // ================================
    // 工作流克隆和复制
    // ================================

    /// 克隆工作流
    pub async fn clone_workflow(&self, workflow_id: &str, new_name: String) -> Result<String> {
        let workflow = self.get_workflow(workflow_id).await?;
        
        let mut cloned = workflow.clone();
        cloned.id = Uuid::new_v4().to_string();
        cloned.name = new_name;
        cloned.status = WorkflowStatus::Draft;
        cloned.version = "1.0.0".to_string();

        self.create_workflow(cloned).await
    }

    // ================================
    // 缓存管理
    // ================================

    /// 清空缓存
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
        
        let mut template_cache = self.template_cache.write().await;
        template_cache.clear();

        info!("工作流缓存已清空");
    }

    /// 预加载常用工作流
    pub async fn preload_cache(&self) -> Result<()> {
        let workflows = self.list_workflows().await?;
        let templates = self.list_templates().await?;

        let mut cache = self.cache.write().await;
        for workflow in workflows {
            cache.insert(workflow.id.clone(), workflow);
        }

        let mut template_cache = self.template_cache.write().await;
        for template in templates {
            template_cache.insert(template.id.clone(), template);
        }

        info!("工作流缓存已预加载");
        Ok(())
    }
}

// ================================
// 辅助结构
// ================================

/// 导入结果
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct ImportResult {
    /// 成功导入的工作流ID列表
    pub imported_workflows: Vec<String>,
    /// 成功导入的模板ID列表
    pub imported_templates: Vec<String>,
    /// 成功数量
    pub success_count: usize,
    /// 失败数量
    pub error_count: usize,
    /// 错误信息列表
    pub errors: Vec<String>,
}

