use crate::database::file::{
    add_file_history, batch_delete_files, cleanup_deleted_files, delete_file_permanently,
    find_file_by_hash, get_file_history, get_file_info, get_file_stats, init_file_tables,
    list_files, mark_file_deleted, save_file_info, search_files, update_file_info, FileHistory,
    FileInfo, FileStats,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100MB
const UPLOAD_DIR: &str = "uploads";
const THUMBNAIL_DIR: &str = "thumbnails";

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadFileRequest {
    pub file_name: String,
    pub file_data: Vec<u8>,
    pub conversation_id: Option<String>,
    pub message_id: Option<String>,
    pub tags: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadFileResponse {
    pub file_info: FileInfo,
    pub is_duplicate: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchDeleteRequest {
    pub file_ids: Vec<String>,
}

/// 计算文件哈希
fn calculate_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// 确定文件类型
fn determine_file_type(file_name: &str) -> String {
    let ext = Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" => "image".to_string(),
        "mp4" | "avi" | "mov" | "wmv" | "flv" | "mkv" | "webm" => "video".to_string(),
        "mp3" | "wav" | "ogg" | "flac" | "aac" | "m4a" => "audio".to_string(),
        "pdf" => "pdf".to_string(),
        "doc" | "docx" | "odt" => "document".to_string(),
        "xls" | "xlsx" | "ods" | "csv" => "spreadsheet".to_string(),
        "ppt" | "pptx" | "odp" => "presentation".to_string(),
        "txt" | "md" | "log" => "text".to_string(),
        "zip" | "rar" | "7z" | "tar" | "gz" => "archive".to_string(),
        "json" | "xml" | "yaml" | "yml" | "toml" => "data".to_string(),
        "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "go" | "java" | "c" | "cpp" | "h" | "hpp" => {
            "code".to_string()
        }
        _ => "other".to_string(),
    }
}

/// 确定 MIME 类型
fn determine_mime_type(file_name: &str) -> String {
    let ext = Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "pdf" => "application/pdf",
        "json" => "application/json",
        "xml" => "application/xml",
        "zip" => "application/zip",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "html" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",
        _ => "application/octet-stream",
    }
    .to_string()
}

/// 生成缩略图（仅支持图片）
fn generate_thumbnail(
    app_handle: &AppHandle,
    file_path: &Path,
    file_type: &str,
) -> Result<Option<String>, String> {
    if file_type != "image" {
        return Ok(None);
    }

    // 这里可以使用 image crate 生成缩略图
    // 为了简化，我们暂时返回 None
    // TODO: 集成 image crate 生成缩略图
    Ok(None)
}

use crate::database::file::DummyConnection;

/// 获取数据库连接（stub实现）
fn get_db_connection(_app_handle: &AppHandle) -> Result<DummyConnection, String> {
    // 这是一个stub实现，实际上不使用SQLite
    Ok(DummyConnection {})
}

/// 上传文件
#[tauri::command]
pub async fn upload_file(
    app_handle: AppHandle,
    request: UploadFileRequest,
) -> Result<UploadFileResponse, String> {
    // 验证文件大小
    if request.file_data.len() as u64 > MAX_FILE_SIZE {
        return Err(format!(
            "文件大小超过限制 (最大 {}MB)",
            MAX_FILE_SIZE / 1024 / 1024
        ));
    }

    // 计算文件哈希
    let hash = calculate_hash(&request.file_data);

    // 检查是否已存在相同文件
    let conn = get_db_connection(&app_handle)?;
    if let Some(existing_file) = find_file_by_hash(&conn, &hash)
        .map_err(|e| format!("Failed to check duplicate: {}", e))?
    {
        return Ok(UploadFileResponse {
            file_info: existing_file,
            is_duplicate: true,
        });
    }

    // 准备存储目录
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data dir")?;

    let upload_dir = app_dir.join(UPLOAD_DIR);
    fs::create_dir_all(&upload_dir).map_err(|e| format!("Failed to create upload dir: {}", e))?;

    // 生成唯一文件名
    let file_id = Uuid::new_v4().to_string();
    let ext = Path::new(&request.file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let file_name = if ext.is_empty() {
        file_id.clone()
    } else {
        format!("{}.{}", file_id, ext)
    };

    let file_path = upload_dir.join(&file_name);

    // 保存文件
    let mut file = fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&request.file_data)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // 确定文件类型和 MIME
    let file_type = determine_file_type(&request.file_name);
    let mime_type = determine_mime_type(&request.file_name);

    // 生成缩略图（如果是图片）
    let thumbnail_path = generate_thumbnail(&app_handle, &file_path, &file_type)?;

    // 创建文件信息
    let now = Utc::now().to_rfc3339();
    let file_info = FileInfo {
        id: file_id,
        name: file_name.clone(),
        original_name: request.file_name.clone(),
        file_path: file_path.to_string_lossy().to_string(),
        file_size: request.file_data.len() as i64,
        file_type,
        mime_type,
        hash,
        thumbnail_path,
        conversation_id: request.conversation_id,
        message_id: request.message_id,
        tags: request.tags,
        description: request.description,
        created_at: now.clone(),
        updated_at: now.clone(),
        accessed_at: now,
        is_deleted: false,
    };

    // 保存到数据库
    save_file_info(&conn, &file_info).map_err(|e| format!("Failed to save file info: {}", e))?;

    Ok(UploadFileResponse {
        file_info,
        is_duplicate: false,
    })
}

/// 获取文件信息
#[tauri::command]
pub async fn get_file(app_handle: AppHandle, file_id: String) -> Result<FileInfo, String> {
    let conn = get_db_connection(&app_handle)?;
    get_file_info(&conn, &file_id)
        .map_err(|e| format!("Failed to get file: {}", e))?
        .ok_or_else(|| "File not found".to_string())
}

/// 读取文件内容
#[tauri::command]
pub async fn read_file_content(
    app_handle: AppHandle,
    file_id: String,
) -> Result<Vec<u8>, String> {
    let conn = get_db_connection(&app_handle)?;
    let file_info = get_file_info(&conn, &file_id)
        .map_err(|e| format!("Failed to get file: {}", e))?
        .ok_or_else(|| "File not found".to_string())?;

    let mut file = fs::File::open(&file_info.file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(buffer)
}

/// 列出文件
#[tauri::command]
pub async fn list_files_by_filter(
    app_handle: AppHandle,
    conversation_id: Option<String>,
    file_type: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<FileInfo>, String> {
    let conn = get_db_connection(&app_handle)?;
    list_files(
        &conn,
        conversation_id.as_deref(),
        file_type.as_deref(),
        limit,
        offset,
    )
    .map_err(|e| format!("Failed to list files: {}", e))
}

/// 更新文件信息
#[tauri::command]
pub async fn update_file(app_handle: AppHandle, file_info: FileInfo) -> Result<(), String> {
    let conn = get_db_connection(&app_handle)?;
    update_file_info(&conn, &file_info).map_err(|e| format!("Failed to update file: {}", e))
}

/// 删除文件（软删除）
#[tauri::command]
pub async fn delete_file(app_handle: AppHandle, file_id: String) -> Result<(), String> {
    let conn = get_db_connection(&app_handle)?;
    mark_file_deleted(&conn, &file_id).map_err(|e| format!("Failed to delete file: {}", e))
}

/// 永久删除文件
#[tauri::command]
pub async fn delete_file_permanent(
    app_handle: AppHandle,
    file_id: String,
) -> Result<(), String> {
    let conn = get_db_connection(&app_handle)?;

    // 获取文件信息
    let file_info = get_file_info(&conn, &file_id)
        .map_err(|e| format!("Failed to get file: {}", e))?
        .ok_or_else(|| "File not found".to_string())?;

    // 删除物理文件
    if Path::new(&file_info.file_path).exists() {
        fs::remove_file(&file_info.file_path)
            .map_err(|e| format!("Failed to delete physical file: {}", e))?;
    }

    // 删除缩略图
    if let Some(thumb_path) = file_info.thumbnail_path {
        if Path::new(&thumb_path).exists() {
            let _ = fs::remove_file(&thumb_path);
        }
    }

    // 从数据库删除
    delete_file_permanently(&conn, &file_id)
        .map_err(|e| format!("Failed to delete from database: {}", e))
}

/// 批量删除文件
#[tauri::command]
pub async fn batch_delete(
    app_handle: AppHandle,
    request: BatchDeleteRequest,
) -> Result<usize, String> {
    let conn = get_db_connection(&app_handle)?;
    batch_delete_files(&conn, &request.file_ids)
        .map_err(|e| format!("Failed to batch delete: {}", e))
}

/// 获取文件历史
#[tauri::command]
pub async fn get_file_history_records(
    app_handle: AppHandle,
    file_id: String,
) -> Result<Vec<FileHistory>, String> {
    let conn = get_db_connection(&app_handle)?;
    get_file_history(&conn, &file_id).map_err(|e| format!("Failed to get history: {}", e))
}

/// 获取文件统计
#[tauri::command]
pub async fn get_file_statistics(app_handle: AppHandle) -> Result<FileStats, String> {
    let conn = get_db_connection(&app_handle)?;
    get_file_stats(&conn).map_err(|e| format!("Failed to get stats: {}", e))
}

/// 搜索文件
#[tauri::command]
pub async fn search_files_by_keyword(
    app_handle: AppHandle,
    keyword: String,
    file_type: Option<String>,
) -> Result<Vec<FileInfo>, String> {
    let conn = get_db_connection(&app_handle)?;
    search_files(&conn, &keyword, file_type.as_deref())
        .map_err(|e| format!("Failed to search files: {}", e))
}

/// 清理旧文件
#[tauri::command]
pub async fn cleanup_old_files(app_handle: AppHandle, days: i64) -> Result<usize, String> {
    let conn = get_db_connection(&app_handle)?;

    // 获取需要清理的文件
    let files_to_delete = cleanup_deleted_files(&conn, days)
        .map_err(|e| format!("Failed to cleanup files: {}", e))?;

    let count = files_to_delete.len();

    // 删除物理文件
    for file_info in files_to_delete {
        if Path::new(&file_info.file_path).exists() {
            let _ = fs::remove_file(&file_info.file_path);
        }
        if let Some(thumb_path) = file_info.thumbnail_path {
            if Path::new(&thumb_path).exists() {
                let _ = fs::remove_file(&thumb_path);
            }
        }
    }

    Ok(count)
}

/// 导出文件到指定位置
#[tauri::command]
pub async fn export_file(
    app_handle: AppHandle,
    file_id: String,
    destination: String,
) -> Result<String, String> {
    let conn = get_db_connection(&app_handle)?;
    let file_info = get_file_info(&conn, &file_id)
        .map_err(|e| format!("Failed to get file: {}", e))?
        .ok_or_else(|| "File not found".to_string())?;

    let dest_path = PathBuf::from(destination);
    let target_path = if dest_path.is_dir() {
        dest_path.join(&file_info.original_name)
    } else {
        dest_path
    };

    fs::copy(&file_info.file_path, &target_path)
        .map_err(|e| format!("Failed to export file: {}", e))?;

    add_file_history(&conn, &file_id, "exported", Some(&target_path.to_string_lossy()))
        .map_err(|e| format!("Failed to add history: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

/// 复制文件
#[tauri::command]
pub async fn copy_file(
    app_handle: AppHandle,
    file_id: String,
    new_conversation_id: Option<String>,
) -> Result<FileInfo, String> {
    let conn = get_db_connection(&app_handle)?;
    let original_file = get_file_info(&conn, &file_id)
        .map_err(|e| format!("Failed to get file: {}", e))?
        .ok_or_else(|| "File not found".to_string())?;

    // 读取原文件内容
    let mut file = fs::File::open(&original_file.file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // 创建新文件
    let request = UploadFileRequest {
        file_name: original_file.original_name.clone(),
        file_data: buffer,
        conversation_id: new_conversation_id,
        message_id: None,
        tags: original_file.tags.clone(),
        description: original_file.description.clone(),
    };

    let response = upload_file(app_handle, request).await?;
    Ok(response.file_info)
}

/// 获取文件的公共 URL（如果支持云存储）
#[tauri::command]
pub async fn get_file_url(app_handle: AppHandle, file_id: String) -> Result<String, String> {
    let conn = get_db_connection(&app_handle)?;
    let file_info = get_file_info(&conn, &file_id)
        .map_err(|e| format!("Failed to get file: {}", e))?
        .ok_or_else(|| "File not found".to_string())?;

    // 返回本地文件路径
    // TODO: 如果集成云存储，这里应该返回云存储的 URL
    Ok(format!("file://{}", file_info.file_path))
}

