/**
 * Deep Link 命令
 * 处理来自社区平台的 zishu:// 协议请求
 */

use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};
use reqwest;
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadCharacterRequest {
    pub task_id: String,
    pub character_name: String,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub task_id: String,
    pub progress: f64,
    pub status: String,
    pub message: String,
}

/**
 * 处理深度链接
 * 格式: zishu://action?params
 * 例如: zishu://download-character?task_id=xxx&url=xxx&name=xxx
 */
#[tauri::command]
pub async fn handle_deep_link(
    url: String,
    app: AppHandle,
) -> Result<String, String> {
    info!("收到深度链接: {}", url);
    
    // 解析 URL
    let parsed_url = url::Url::parse(&url)
        .map_err(|e| format!("解析 URL 失败: {}", e))?;
    
    // 获取 action (host 部分)
    let action = parsed_url.host_str()
        .ok_or("无效的深度链接格式")?;
    
    match action {
        "download-character" => {
            handle_download_character(parsed_url, app).await
        }
        "import-character" => {
            handle_import_character(parsed_url, app).await
        }
        _ => {
            warn!("未知的深度链接操作: {}", action);
            Err(format!("未知的操作: {}", action))
        }
    }
}

/**
 * 处理角色下载请求
 * zishu://download-character?task_id=xxx&url=xxx&name=xxx
 */
async fn handle_download_character(
    url: url::Url,
    app: AppHandle,
) -> Result<String, String> {
    // 解析查询参数
    let query_params: std::collections::HashMap<_, _> = url.query_pairs().collect();
    
    let task_id = query_params.get("task_id")
        .ok_or("缺少 task_id 参数")?
        .to_string();
    
    let download_url = query_params.get("url")
        .ok_or("缺少 url 参数")?
        .to_string();
    
    let character_name = query_params.get("name")
        .ok_or("缺少 name 参数")?
        .to_string();
    
    info!("开始下载角色: {} (任务ID: {})", character_name, task_id);
    
    // 发送开始下载事件
    let _ = app.emit_all("character-download-started", DownloadProgress {
        task_id: task_id.clone(),
        progress: 0.0,
        status: "downloading".to_string(),
        message: format!("开始下载角色: {}", character_name),
    });
    
    // 获取应用数据目录
    let app_data_dir = app.path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    
    let characters_dir = app_data_dir.join("characters");
    fs::create_dir_all(&characters_dir)
        .await
        .map_err(|e| format!("创建角色目录失败: {}", e))?;
    
    // 生成文件路径
    let file_name = format!("{}.zip", character_name);
    let file_path = characters_dir.join(&file_name);
    
    // 下载文件
    match download_file(&download_url, &file_path, |progress| {
        let _ = app.emit_all("character-download-progress", DownloadProgress {
            task_id: task_id.clone(),
            progress,
            status: "downloading".to_string(),
            message: format!("下载中: {}%", (progress * 100.0) as i32),
        });
    }).await {
        Ok(_) => {
            info!("角色下载完成: {}", file_path.display());
            
            // 发送完成事件
            let _ = app.emit_all("character-download-completed", DownloadProgress {
                task_id: task_id.clone(),
                progress: 100.0,
                status: "completed".to_string(),
                message: format!("下载完成: {}", character_name),
            });
            
            // 自动解压并安装
            match install_character(&file_path, &characters_dir).await {
                Ok(install_path) => {
                    info!("角色安装完成: {}", install_path);
                    Ok(format!("角色 {} 下载并安装成功", character_name))
                }
                Err(e) => {
                    warn!("角色安装失败: {}", e);
                    Ok(format!("角色下载成功，但安装失败: {}", e))
                }
            }
        }
        Err(e) => {
            error!("角色下载失败: {}", e);
            
            // 发送失败事件
            let _ = app.emit_all("character-download-failed", DownloadProgress {
                task_id: task_id.clone(),
                progress: 0.0,
                status: "failed".to_string(),
                message: format!("下载失败: {}", e),
            });
            
            Err(format!("下载失败: {}", e))
        }
    }
}

/**
 * 处理角色导入请求
 * zishu://import-character?data=base64_encoded_json
 */
async fn handle_import_character(
    url: url::Url,
    app: AppHandle,
) -> Result<String, String> {
    let query_params: std::collections::HashMap<_, _> = url.query_pairs().collect();
    
    let data = query_params.get("data")
        .ok_or("缺少 data 参数")?;
    
    // 解码 base64 数据
    let decoded = base64::decode(data.as_ref())
        .map_err(|e| format!("解码数据失败: {}", e))?;
    
    let character_data = String::from_utf8(decoded)
        .map_err(|e| format!("解析字符数据失败: {}", e))?;
    
    info!("开始导入角色配置");
    
    // 这里可以添加角色导入逻辑
    // ...
    
    Ok("角色导入成功".to_string())
}

/**
 * 下载文件
 */
async fn download_file<F>(
    url: &str,
    dest_path: &PathBuf,
    progress_callback: F,
) -> Result<(), String>
where
    F: Fn(f64),
{
    let client = reqwest::Client::new();
    let response = client.get(url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("下载失败，HTTP状态码: {}", response.status()));
    }
    
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
    // 创建文件
    let mut file = fs::File::create(dest_path)
        .await
        .map_err(|e| format!("创建文件失败: {}", e))?;
    
    // 下载并写入
    use futures::StreamExt;
    use tokio::io::AsyncWriteExt;
    
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取数据失败: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入文件失败: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
            let progress = downloaded as f64 / total_size as f64;
            progress_callback(progress);
        }
    }
    
    file.flush().await.map_err(|e| format!("刷新文件失败: {}", e))?;
    
    Ok(())
}

/**
 * 安装角色（解压并配置）
 */
async fn install_character(
    zip_path: &PathBuf,
    characters_dir: &PathBuf,
) -> Result<String, String> {
    // 提取文件名（不含扩展名）
    let character_name = zip_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("无法获取文件名")?;
    
    let install_dir = characters_dir.join(character_name);
    
    // 创建安装目录
    fs::create_dir_all(&install_dir)
        .await
        .map_err(|e| format!("创建安装目录失败: {}", e))?;
    
    // 解压文件
    let file = std::fs::File::open(zip_path)
        .map_err(|e| format!("打开zip文件失败: {}", e))?;
    
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("读取zip文件失败: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("读取zip条目失败: {}", e))?;
        
        let outpath = match file.enclosed_name() {
            Some(path) => install_dir.join(path),
            None => continue,
        };
        
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("创建目录失败: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(&p)
                        .map_err(|e| format!("创建父目录失败: {}", e))?;
                }
            }
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("创建文件失败: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("解压文件失败: {}", e))?;
        }
    }
    
    // 删除zip文件
    let _ = fs::remove_file(zip_path).await;
    
    Ok(install_dir.to_string_lossy().to_string())
}

/**
 * 检查是否从社区平台启动
 */
#[tauri::command]
pub fn is_launched_from_community() -> bool {
    // 检查命令行参数或环境变量
    std::env::args().any(|arg| arg.starts_with("zishu://"))
}

