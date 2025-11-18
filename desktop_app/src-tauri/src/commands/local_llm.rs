//! # 本地LLM模型管理命令模块
//! 
//! 提供本地LLM模型的上传、下载、删除、列表等管理功能
//! 本地LLM模型 + prompt 是智能硬适配器的一种，但对用户隐藏这个技术细节
//! 模型注册通过 zishu 后端核心服务进行管理

use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use tracing::{info, error, warn};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use reqwest::Client;

use crate::commands::*;

// ================================
// 数据类型定义
// ================================

/// 本地LLM模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLLMModel {
    /// 模型ID（唯一标识）
    pub id: String,
    /// 模型名称
    pub name: String,
    /// 模型文件路径
    pub model_path: String,
    /// 模型类型（如：gguf, safetensors, pytorch等）
    pub model_type: String,
    /// 模型大小（字节）
    pub size_bytes: u64,
    /// 参数量（可选）
    pub parameter_count: Option<u64>,
    /// 模型描述
    pub description: Option<String>,
    /// 支持的格式
    pub supported_formats: Vec<String>,
    /// 是否已加载
    pub is_loaded: bool,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
    /// 元数据
    pub metadata: HashMap<String, serde_json::Value>,
}

/// 上传模型请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadModelRequest {
    /// 模型文件路径（用户选择的文件）
    pub file_path: String,
    /// 模型名称
    pub name: String,
    /// 模型描述（可选）
    pub description: Option<String>,
    /// 是否自动验证
    pub auto_verify: bool,
}

/// 注册模型路径请求（直接引用，不复制文件）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterModelRequest {
    /// 模型文件路径（直接引用的路径）
    pub file_path: String,
    /// 模型名称
    pub name: String,
    /// 模型描述（可选）
    pub description: Option<String>,
    /// 是否自动验证
    pub auto_verify: bool,
}

/// 下载模型请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadModelRequest {
    /// 模型URL或标识符
    pub source: String,
    /// 模型名称
    pub name: String,
    /// 下载选项
    pub options: HashMap<String, serde_json::Value>,
}

/// 删除模型请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteModelRequest {
    /// 模型ID
    pub model_id: String,
    /// 是否删除文件
    pub delete_files: bool,
}

/// 验证模型请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyModelRequest {
    /// 模型ID
    pub model_id: String,
}

/// 验证模型响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyModelResponse {
    /// 是否有效
    pub valid: bool,
    /// 验证消息
    pub message: String,
    /// 详细信息
    pub details: HashMap<String, serde_json::Value>,
}

// ================================
// 命令处理器
// ================================

/// 获取所有本地LLM模型列表
#[tauri::command]
pub async fn get_local_llm_models(
    app_handle: AppHandle,
) -> Result<CommandResponse<Vec<LocalLLMModel>>, String> {
    info!("获取本地LLM模型列表");
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.local_llm_registry.get_all_models().await {
        Ok(db_models) => {
            let models: Vec<LocalLLMModel> = db_models.into_iter().map(|m| LocalLLMModel {
                id: m.id,
                name: m.name,
                model_path: m.model_path,
                model_type: m.model_type,
                size_bytes: m.size_bytes as u64,
                parameter_count: m.parameter_count.map(|p| p as u64),
                description: m.description,
                supported_formats: m.supported_formats,
                is_loaded: m.is_loaded,
                created_at: m.created_at,
                updated_at: m.updated_at,
                metadata: m.metadata,
            }).collect();
            
            info!("成功获取 {} 个本地LLM模型", models.len());
            Ok(CommandResponse::success(models))
        }
        Err(e) => {
            error!("获取本地LLM模型列表失败: {}", e);
            Ok(CommandResponse::error(format!("获取模型列表失败: {}", e)))
        }
    }
}

/// 上传本地LLM模型
#[tauri::command]
pub async fn upload_local_llm_model(
    request: UploadModelRequest,
    app_handle: AppHandle,
) -> Result<CommandResponse<LocalLLMModel>, String> {
    info!("上传本地LLM模型: {}", request.name);
    
    match upload_model_file(&request, &app_handle).await {
        Ok(model) => {
            info!("模型上传成功: {}", model.id);
            Ok(CommandResponse::success_with_message(
                model,
                format!("模型 {} 上传成功", request.name),
            ))
        }
        Err(e) => {
            error!("上传模型失败: {}", e);
            Ok(CommandResponse::error(format!("上传模型失败: {}", e)))
        }
    }
}

/// 注册本地LLM模型路径（直接引用，不复制文件）
#[tauri::command]
pub async fn register_local_llm_model(
    request: RegisterModelRequest,
    app_handle: AppHandle,
) -> Result<CommandResponse<LocalLLMModel>, String> {
    info!("注册本地LLM模型路径: {}", request.name);
    
    match register_model_path(&request, &app_handle).await {
        Ok(model) => {
            info!("模型注册成功: {}", model.id);
            Ok(CommandResponse::success_with_message(
                model,
                format!("模型 {} 注册成功", request.name),
            ))
        }
        Err(e) => {
            error!("注册模型失败: {}", e);
            Ok(CommandResponse::error(format!("注册模型失败: {}", e)))
        }
    }
}

/// 下载本地LLM模型
#[tauri::command]
pub async fn download_local_llm_model(
    request: DownloadModelRequest,
    app_handle: AppHandle,
) -> Result<CommandResponse<LocalLLMModel>, String> {
    info!("下载本地LLM模型: {}", request.name);
    
    match download_model_from_source(&request, &app_handle).await {
        Ok(model) => {
            info!("模型下载成功: {}", model.id);
            Ok(CommandResponse::success_with_message(
                model,
                format!("模型 {} 下载成功", request.name),
            ))
        }
        Err(e) => {
            error!("下载模型失败: {}", e);
            Ok(CommandResponse::error(format!("下载模型失败: {}", e)))
        }
    }
}

/// 删除本地LLM模型
#[tauri::command]
pub async fn delete_local_llm_model(
    request: DeleteModelRequest,
    app_handle: AppHandle,
) -> Result<CommandResponse<bool>, String> {
    info!("删除本地LLM模型: {}", request.model_id);
    
    match delete_model_files(&request, &app_handle).await {
        Ok(_) => {
            info!("模型删除成功: {}", request.model_id);
            Ok(CommandResponse::success_with_message(
                true,
                "模型删除成功".to_string(),
            ))
        }
        Err(e) => {
            error!("删除模型失败: {}", e);
            Ok(CommandResponse::error(format!("删除模型失败: {}", e)))
        }
    }
}

/// 验证本地LLM模型
#[tauri::command]
pub async fn verify_local_llm_model(
    request: VerifyModelRequest,
    app_handle: AppHandle,
) -> Result<CommandResponse<VerifyModelResponse>, String> {
    info!("验证本地LLM模型: {}", request.model_id);
    
    match verify_model_file(&request, &app_handle).await {
        Ok(response) => {
            info!("模型验证完成: {} - {}", request.model_id, response.message);
            Ok(CommandResponse::success(response))
        }
        Err(e) => {
            error!("验证模型失败: {}", e);
            Ok(CommandResponse::error(format!("验证模型失败: {}", e)))
        }
    }
}

/// 获取模型详情
#[tauri::command]
pub async fn get_local_llm_model(
    model_id: String,
    app_handle: AppHandle,
) -> Result<CommandResponse<LocalLLMModel>, String> {
    info!("获取本地LLM模型详情: {}", model_id);
    
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    match db.local_llm_registry.get_model(&model_id).await {
        Ok(Some(db_model)) => {
            let model = LocalLLMModel {
                id: db_model.id,
                name: db_model.name,
                model_path: db_model.model_path,
                model_type: db_model.model_type,
                size_bytes: db_model.size_bytes as u64,
                parameter_count: db_model.parameter_count.map(|p| p as u64),
                description: db_model.description,
                supported_formats: db_model.supported_formats,
                is_loaded: db_model.is_loaded,
                created_at: db_model.created_at,
                updated_at: db_model.updated_at,
                metadata: db_model.metadata,
            };
            
            info!("成功获取模型详情: {}", model.name);
            Ok(CommandResponse::success(model))
        }
        Ok(None) => {
            warn!("模型不存在: {}", model_id);
            Ok(CommandResponse::error(format!("模型不存在: {}", model_id)))
        }
        Err(e) => {
            error!("获取模型详情失败: {}", e);
            Ok(CommandResponse::error(format!("获取模型详情失败: {}", e)))
        }
    }
}

// ================================
// 内部实现函数
// ================================

/// 从存储中获取所有模型
async fn get_models_from_storage(app_handle: &AppHandle) -> Result<Vec<LocalLLMModel>, String> {
    let models_dir = get_models_directory(app_handle)?;
    
    if !models_dir.exists() {
        std::fs::create_dir_all(&models_dir).map_err(|e| {
            format!("创建模型目录失败: {}", e)
        })?;
        return Ok(vec![]);
    }
    
    let mut models = Vec::new();
    
    // 读取模型索引文件
    let index_file = models_dir.join("models_index.json");
    if index_file.exists() {
        let content = std::fs::read_to_string(&index_file).map_err(|e| {
            format!("读取模型索引失败: {}", e)
        })?;
        
        let model_list: Vec<LocalLLMModel> = serde_json::from_str(&content).map_err(|e| {
            format!("解析模型索引失败: {}", e)
        })?;
        
        // 验证每个模型文件是否存在
        for model in model_list {
            let model_path = Path::new(&model.model_path);
            if model_path.exists() {
                models.push(model);
            }
        }
    }
    
    Ok(models)
}

/// 获取后端 URL
fn get_backend_url() -> String {
    let url = std::env::var("ZISHU_BACKEND_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8000".to_string());
    
    // 如果使用localhost，替换为127.0.0.1以避免IPv6解析问题
    let normalized_url = url.replace("localhost", "127.0.0.1");
    
    info!("后端 URL 配置: 原始={}, 规范化={}", url, normalized_url);
    normalized_url
}

/// 注册模型路径（直接引用，不复制文件）
/// 通过 zishu 后端核心服务注册为智能硬适配器
async fn register_model_path(
    request: &RegisterModelRequest,
    app_handle: &AppHandle,
) -> Result<LocalLLMModel, String> {
    let source_path = Path::new(&request.file_path);
    if !source_path.exists() {
        return Err("模型文件或文件夹不存在".to_string());
    }
    
    // 识别模型类型和大小
    let (model_path, model_type, size_bytes) = if source_path.is_dir() {
        // 处理文件夹：查找主要的模型文件
        let main_model_file = find_main_model_file(source_path)?;
        let model_type = detect_model_type(&main_model_file)?;
        let metadata = std::fs::metadata(&main_model_file).map_err(|e| {
            format!("获取文件信息失败: {}", e)
        })?;
        let size_bytes = metadata.len();
        
        (main_model_file, model_type, size_bytes)
    } else {
        // 处理单个文件
        let model_type = detect_model_type(source_path)?;
        let metadata = std::fs::metadata(source_path).map_err(|e| {
            format!("获取文件信息失败: {}", e)
        })?;
        let size_bytes = metadata.len();
        
        (source_path.to_path_buf(), model_type, size_bytes)
    };
    
    // 通过后端 API 注册模型（作为智能硬适配器）
    let backend_url = get_backend_url();
    let api_url = format!("{}/api/v1/models/register-llm", backend_url);
    let health_url = format!("{}/api/v1/models/health", backend_url);
    
    info!("Registering LLM model via backend API: {}", api_url);
    
    // 在正式请求前做一次后端健康检查（5秒超时，给一些buffer）
    info!("开始健康检查: {}", health_url);
    let health_start = std::time::Instant::now();
    let health_client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .connect_timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    
    match health_client.get(&health_url).send().await {
        Ok(resp) => {
            let elapsed = health_start.elapsed();
            let status = resp.status();
            info!("健康检查响应: status={}, 耗时: {:?}", status, elapsed);
            
            if !status.is_success() {
                warn!("健康检查返回非成功状态: {}", status);
                // 不阻止继续执行，只是警告
            }
        }
        Err(e) => {
            let elapsed = health_start.elapsed();
            error!("健康检查失败: {}, 耗时: {:?}", e, elapsed);
            
            // 提供更详细的错误信息
            let error_detail = if e.is_timeout() {
                format!("健康检查超时（5秒）")
            } else if e.is_connect() {
                format!("无法连接到后端服务: {}", e)
            } else {
                format!("健康检查请求失败: {}", e)
            };
            
            return Err(format!(
                "后端服务不可用: {}\n\n请检查:\n1. 后端服务是否运行: docker ps | grep zishu-api\n2. 后端URL是否正确: {}\n3. 网络连接是否正常",
                error_detail, backend_url
            ));
        }
    }
    
    // 创建带超时的 HTTP 客户端（120秒整体超时）
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    
    let request_body = serde_json::json!({
        "name": request.name,
        "model_path": model_path.to_string_lossy().to_string(),
        "description": request.description,
        "model_type": model_type,
        "size_bytes": size_bytes,
        "auto_verify": request.auto_verify,
    });
    
    // 发送注册请求（30秒超时，给首次初始化和大模型留足时间）
    info!("开始发送注册请求到: {}", api_url);
    info!("请求体内容: {}", serde_json::to_string_pretty(&request_body).unwrap_or_else(|_| "无法序列化".to_string()));
    let request_start = std::time::Instant::now();
    
    info!("正在等待后端处理...");
    let response = tokio::time::timeout(std::time::Duration::from_secs(30), async {
        client
            .post(&api_url)
            .json(&request_body)
            .send()
            .await
    })
    .await
    .map_err(|_| {
        let elapsed = request_start.elapsed();
        error!("请求后端 API 超时（30秒），实际耗时: {:?}", elapsed);
        format!(
            "请求后端 API 超时（30秒），实际耗时: {:?}\n\n可能原因:\n1. 后端首次初始化适配器管理器较慢\n2. 模型体积较大\n3. 后端服务繁忙\n\n建议: 等待片刻后重试",
            elapsed
        )
    })?
    .map_err(|e| {
        let elapsed = request_start.elapsed();
        error!("请求后端 API 失败: {}, 耗时: {:?}", e, elapsed);
        
        let error_detail = if e.is_timeout() {
            format!("请求超时")
        } else if e.is_connect() {
            format!("连接失败: {}", e)
        } else if e.is_request() {
            format!("请求错误: {}", e)
        } else {
            format!("{}", e)
        };
        
        format!("请求后端 API 失败: {}（耗时: {:?}）", error_detail, elapsed)
    })?;
    
    let request_elapsed = request_start.elapsed();
    let status = response.status();
    info!("收到响应: status={}, 耗时: {:?}", status, request_elapsed);
    
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        error!("后端 API 返回错误 (status: {}): {}", status, error_text);
        return Err(format!("后端 API 返回错误 (status: {}): {}", status, error_text));
    }
    
    let api_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析后端响应失败: {}", e))?;
    
    // 从后端响应中提取适配器 ID
    let adapter_id = api_response
        .get("adapter_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "后端响应中缺少 adapter_id".to_string())?
        .to_string();
    
    info!("LLM model registered as adapter: {}", adapter_id);
    
    // 创建本地模型信息（用于前端显示）
    let model = LocalLLMModel {
        id: adapter_id.clone(),
        name: request.name.clone(),
        model_path: model_path.to_string_lossy().to_string(),
        model_type: model_type.clone(),
        size_bytes,
        parameter_count: None,
        description: request.description.clone(),
        supported_formats: vec![model_type],
        is_loaded: false,
        created_at: chrono::Utc::now().timestamp(),
        updated_at: chrono::Utc::now().timestamp(),
        metadata: {
            let mut meta = HashMap::new();
            meta.insert("is_reference".to_string(), serde_json::json!(true));
            meta.insert("original_path".to_string(), serde_json::json!(request.file_path));
            meta.insert("adapter_id".to_string(), serde_json::json!(adapter_id));
            meta.insert("registered_via_backend".to_string(), serde_json::json!(true));
            meta
        },
    };
    
    // 保存模型信息到本地索引（用于前端显示，实际管理在后端）
    save_model_to_index(&model, app_handle)?;
    
    Ok(model)
}

/// 上传模型文件或文件夹
async fn upload_model_file(
    request: &UploadModelRequest,
    app_handle: &AppHandle,
) -> Result<LocalLLMModel, String> {
    let source_path = Path::new(&request.file_path);
    if !source_path.exists() {
        return Err("源文件或文件夹不存在".to_string());
    }
    
    // 创建目标目录
    let models_dir = get_models_directory(app_handle)?;
    std::fs::create_dir_all(&models_dir).map_err(|e| {
        format!("创建模型目录失败: {}", e)
    })?;
    
    // 生成模型ID
    let model_id = format!("model_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..16].to_string());
    
    // 创建模型子目录
    let model_dir = models_dir.join(&model_id);
    std::fs::create_dir_all(&model_dir).map_err(|e| {
        format!("创建模型目录失败: {}", e)
    })?;
    
    let (model_path, model_type, size_bytes) = if source_path.is_dir() {
        // 处理文件夹：复制整个文件夹内容
        copy_directory_recursive(source_path, &model_dir)?;
        
        // 识别主要的模型文件
        let main_model_file = find_main_model_file(&model_dir)?;
        let model_type = detect_model_type(&main_model_file)?;
        let size_bytes = calculate_directory_size(&model_dir)?;
        
        (main_model_file, model_type, size_bytes)
    } else {
        // 处理单个文件：复制文件
        let file_name = source_path.file_name().ok_or("无效的文件名")?;
        let target_path = model_dir.join(file_name);
        std::fs::copy(source_path, &target_path).map_err(|e| {
            format!("复制文件失败: {}", e)
        })?;
        
        let model_type = detect_model_type(&target_path)?;
        let metadata = std::fs::metadata(&target_path).map_err(|e| {
            format!("获取文件信息失败: {}", e)
        })?;
        let size_bytes = metadata.len();
        
        (target_path, model_type, size_bytes)
    };
    
    // 创建模型信息
    let model = LocalLLMModel {
        id: model_id.clone(),
        name: request.name.clone(),
        model_path: model_path.to_string_lossy().to_string(),
        model_type: model_type.clone(),
        size_bytes,
        parameter_count: None,
        description: request.description.clone(),
        supported_formats: vec![model_type],
        is_loaded: false,
        created_at: chrono::Utc::now().timestamp(),
        updated_at: chrono::Utc::now().timestamp(),
        metadata: HashMap::new(),
    };
    
    // 保存模型信息到索引
    save_model_to_index(&model, app_handle)?;
    
    // 如果启用自动验证，验证模型
    if request.auto_verify {
        if let Err(e) = verify_model_internal(&model).await {
            warn!("模型验证失败: {}", e);
        }
    }
    
    Ok(model)
}

/// 递归复制目录
fn copy_directory_recursive(source: &Path, target: &Path) -> Result<(), String> {
    if !source.is_dir() {
        return Err("源路径不是目录".to_string());
    }
    
    // 创建目标目录
    std::fs::create_dir_all(target).map_err(|e| {
        format!("创建目标目录失败: {}", e)
    })?;
    
    // 遍历源目录
    let entries = std::fs::read_dir(source).map_err(|e| {
        format!("读取源目录失败: {}", e)
    })?;
    
    for entry in entries {
        let entry = entry.map_err(|e| {
            format!("读取目录项失败: {}", e)
        })?;
        
        let source_path = entry.path();
        let file_name = source_path.file_name().ok_or("无效的文件名")?;
        let target_path = target.join(file_name);
        
        if source_path.is_dir() {
            // 递归复制子目录
            copy_directory_recursive(&source_path, &target_path)?;
        } else {
            // 复制文件
            std::fs::copy(&source_path, &target_path).map_err(|e| {
                format!("复制文件 {} 失败: {}", source_path.display(), e)
            })?;
        }
    }
    
    Ok(())
}

/// 查找主要的模型文件
fn find_main_model_file(model_dir: &Path) -> Result<PathBuf, String> {
    // 按优先级查找模型文件
    let candidates = vec![
        "pytorch_model.bin",
        "model.bin",
        "model.gguf",
        "model.safetensors",
        "model.pt",
        "model.pth",
        "model.onnx",
    ];
    
    // 首先尝试查找已知的模型文件名
    for candidate in &candidates {
        let path = model_dir.join(candidate);
        if path.exists() && path.is_file() {
            return Ok(path);
        }
    }
    
    // 如果没有找到，查找最大的.bin文件（通常是模型权重文件）
    let mut largest_bin: Option<(PathBuf, u64)> = None;
    
    if let Ok(entries) = std::fs::read_dir(model_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "bin" || ext == "gguf" || ext == "safetensors" {
                        if let Ok(metadata) = std::fs::metadata(&path) {
                            let size = metadata.len();
                            if largest_bin.is_none() || size > largest_bin.as_ref().unwrap().1 {
                                largest_bin = Some((path, size));
                            }
                        }
                    }
                }
            }
        }
    }
    
    if let Some((path, _)) = largest_bin {
        return Ok(path);
    }
    
    // 如果还是没找到，返回目录本身（表示这是一个文件夹模型）
    Ok(model_dir.to_path_buf())
}

/// 计算目录总大小
fn calculate_directory_size(dir: &Path) -> Result<u64, String> {
    let mut total_size = 0u64;
    
    if dir.is_file() {
        let metadata = std::fs::metadata(dir).map_err(|e| {
            format!("获取文件信息失败: {}", e)
        })?;
        return Ok(metadata.len());
    }
    
    let entries = std::fs::read_dir(dir).map_err(|e| {
        format!("读取目录失败: {}", e)
    })?;
    
    for entry in entries {
        let entry = entry.map_err(|e| {
            format!("读取目录项失败: {}", e)
        })?;
        
        let path = entry.path();
        if path.is_dir() {
            total_size += calculate_directory_size(&path)?;
        } else {
            let metadata = std::fs::metadata(&path).map_err(|e| {
                format!("获取文件信息失败: {}", e)
            })?;
            total_size += metadata.len();
        }
    }
    
    Ok(total_size)
}

/// 从源下载模型
async fn download_model_from_source(
    request: &DownloadModelRequest,
    app_handle: &AppHandle,
) -> Result<LocalLLMModel, String> {
    // 这里应该实现实际的下载逻辑
    // 目前返回错误，提示用户手动上传
    Err("模型下载功能需要实现。请先手动下载模型文件，然后使用上传功能。".to_string())
}

/// 删除模型文件
async fn delete_model_files(
    request: &DeleteModelRequest,
    app_handle: &AppHandle,
) -> Result<(), String> {
    // 获取模型信息
    let models = get_models_from_storage(app_handle).await?;
    let model = models.iter().find(|m| m.id == request.model_id)
        .ok_or("模型不存在")?;
    
    // 检查是否是路径引用模式
    let is_reference = model.metadata
        .get("is_reference")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    // 删除文件（仅当不是路径引用模式，或者用户明确要求删除文件时）
    if request.delete_files && !is_reference {
        let model_path = Path::new(&model.model_path);
        if model_path.exists() {
            // 检查路径是否在应用数据目录内（安全措施：只删除应用管理的文件）
            let models_dir = get_models_directory(app_handle)?;
            if model_path.starts_with(&models_dir) {
                if model_path.is_file() {
                    std::fs::remove_file(model_path).map_err(|e| {
                        format!("删除模型文件失败: {}", e)
                    })?;
                } else {
                    std::fs::remove_dir_all(model_path).map_err(|e| {
                        format!("删除模型目录失败: {}", e)
                    })?;
                }
            } else {
                warn!("模型路径不在应用数据目录内，跳过文件删除: {}", model_path.display());
            }
        }
    } else if request.delete_files && is_reference {
        info!("模型是路径引用模式，不会删除原始文件");
    }
    
    // 从索引中删除
    remove_model_from_index(&request.model_id, app_handle)?;
    
    Ok(())
}

/// 验证模型文件
async fn verify_model_file(
    request: &VerifyModelRequest,
    app_handle: &AppHandle,
) -> Result<VerifyModelResponse, String> {
    let model = get_model_by_id(&request.model_id, app_handle).await?
        .ok_or("模型不存在")?;
    
    verify_model_internal(&model).await
}

/// 内部验证模型
async fn verify_model_internal(model: &LocalLLMModel) -> Result<VerifyModelResponse, String> {
    let model_path = Path::new(&model.model_path);
    
    if !model_path.exists() {
        return Ok(VerifyModelResponse {
            valid: false,
            message: "模型文件不存在".to_string(),
            details: HashMap::new(),
        });
    }
    
    let metadata = std::fs::metadata(model_path).map_err(|e| {
        format!("获取文件信息失败: {}", e)
    })?;
    
    let mut details = HashMap::new();
    details.insert("file_size".to_string(), serde_json::json!(metadata.len()));
    details.insert("is_file".to_string(), serde_json::json!(metadata.is_file()));
    
    // 基本验证：文件存在且大小大于0
    let valid = metadata.is_file() && metadata.len() > 0;
    
    Ok(VerifyModelResponse {
        valid,
        message: if valid {
            "模型文件验证通过".to_string()
        } else {
            "模型文件验证失败".to_string()
        },
        details,
    })
}

/// 根据ID获取模型
async fn get_model_by_id(
    model_id: &str,
    app_handle: &AppHandle,
) -> Result<Option<LocalLLMModel>, String> {
    let models = get_models_from_storage(app_handle).await?;
    Ok(models.into_iter().find(|m| m.id == model_id))
}

/// 获取模型存储目录
fn get_models_directory(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    Ok(app_data_dir.join("local_llm_models"))
}

/// 检测模型类型
fn detect_model_type(file_path: &Path) -> Result<String, String> {
    let extension = file_path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    match extension.as_str() {
        "gguf" => Ok("gguf".to_string()),
        "safetensors" => Ok("safetensors".to_string()),
        "pt" | "pth" => Ok("pytorch".to_string()),
        "onnx" => Ok("onnx".to_string()),
        "bin" => Ok("bin".to_string()),
        _ => Ok("unknown".to_string()),
    }
}

/// 保存模型到数据库
fn save_model_to_index(model: &LocalLLMModel, app_handle: &AppHandle) -> Result<(), String> {
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    let db_model = crate::database::local_llm_registry::LocalLLMModelData {
        id: model.id.clone(),
        name: model.name.clone(),
        model_path: model.model_path.clone(),
        model_type: model.model_type.clone(),
        size_bytes: model.size_bytes as i64,
        parameter_count: model.parameter_count.map(|p| p as i64),
        description: model.description.clone(),
        supported_formats: model.supported_formats.clone(),
        is_loaded: model.is_loaded,
        created_at: model.created_at,
        updated_at: model.updated_at,
        metadata: model.metadata.clone(),
    };
    
    // 使用 tokio runtime 执行 async 代码
    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
    
    rt.block_on(async {
        db.local_llm_registry.register_model(db_model).await
            .map_err(|e| format!("保存模型到数据库失败: {}", e))
    })
}

/// 从数据库中删除模型
fn remove_model_from_index(model_id: &str, app_handle: &AppHandle) -> Result<(), String> {
    let db = crate::database::get_database()
        .ok_or_else(|| "数据库未初始化".to_string())?;
    
    // 使用 tokio runtime 执行 async 代码
    let rt = tokio::runtime::Handle::try_current()
        .unwrap_or_else(|_| tokio::runtime::Runtime::new().unwrap().handle().clone());
    
    rt.block_on(async {
        db.local_llm_registry.delete_model(model_id).await
            .map_err(|e| format!("从数据库删除模型失败: {}", e))
    })
}

// ================================
// 命令元数据
// ================================

pub fn get_command_metadata() -> HashMap<String, CommandMetadata> {
    let mut metadata = HashMap::new();
    
    metadata.insert("get_local_llm_models".to_string(), CommandMetadata {
        name: "get_local_llm_models".to_string(),
        description: "获取所有本地LLM模型列表".to_string(),
        input_type: None,
        output_type: Some("Vec<LocalLLMModel>".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "local_llm".to_string(),
    });
    
    metadata.insert("upload_local_llm_model".to_string(), CommandMetadata {
        name: "upload_local_llm_model".to_string(),
        description: "上传本地LLM模型".to_string(),
        input_type: Some("UploadModelRequest".to_string()),
        output_type: Some("LocalLLMModel".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "local_llm".to_string(),
    });
    
    metadata.insert("register_local_llm_model".to_string(), CommandMetadata {
        name: "register_local_llm_model".to_string(),
        description: "注册本地LLM模型路径（直接引用，不复制文件）".to_string(),
        input_type: Some("RegisterModelRequest".to_string()),
        output_type: Some("LocalLLMModel".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "local_llm".to_string(),
    });
    
    metadata.insert("download_local_llm_model".to_string(), CommandMetadata {
        name: "download_local_llm_model".to_string(),
        description: "下载本地LLM模型".to_string(),
        input_type: Some("DownloadModelRequest".to_string()),
        output_type: Some("LocalLLMModel".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "local_llm".to_string(),
    });
    
    metadata.insert("delete_local_llm_model".to_string(), CommandMetadata {
        name: "delete_local_llm_model".to_string(),
        description: "删除本地LLM模型".to_string(),
        input_type: Some("DeleteModelRequest".to_string()),
        output_type: Some("bool".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "local_llm".to_string(),
    });
    
    metadata.insert("verify_local_llm_model".to_string(), CommandMetadata {
        name: "verify_local_llm_model".to_string(),
        description: "验证本地LLM模型".to_string(),
        input_type: Some("VerifyModelRequest".to_string()),
        output_type: Some("VerifyModelResponse".to_string()),
        required_permission: PermissionLevel::User,
        is_async: true,
        category: "local_llm".to_string(),
    });
    
    metadata.insert("get_local_llm_model".to_string(), CommandMetadata {
        name: "get_local_llm_model".to_string(),
        description: "获取本地LLM模型详情".to_string(),
        input_type: Some("String".to_string()),
        output_type: Some("LocalLLMModel".to_string()),
        required_permission: PermissionLevel::Public,
        is_async: true,
        category: "local_llm".to_string(),
    });
    
    metadata
}

