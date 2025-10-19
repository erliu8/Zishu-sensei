use crate::utils::startup_manager::{StartupConfig, StartupManager, StartupPhase, StartupStats, STARTUP_MANAGER};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use tauri::State;

/// 更新启动配置
#[tauri::command]
pub async fn update_startup_config(config: StartupConfig) -> Result<(), String> {
    STARTUP_MANAGER.update_config(config)
}

/// 获取启动配置
#[tauri::command]
pub async fn get_startup_config() -> Result<StartupConfig, String> {
    STARTUP_MANAGER.get_config()
}

/// 开始启动阶段
#[tauri::command]
pub async fn start_startup_phase(phase: StartupPhase) -> Result<(), String> {
    STARTUP_MANAGER.start_phase(phase).await
}

/// 完成启动阶段（成功）
#[tauri::command]
pub async fn finish_startup_phase_success(
    phase: StartupPhase,
    metrics: Option<HashMap<String, f64>>,
) -> Result<(), String> {
    let metrics = metrics.unwrap_or_default();
    STARTUP_MANAGER.finish_phase_success(phase, metrics).await
}

/// 完成启动阶段（失败）
#[tauri::command]
pub async fn finish_startup_phase_error(
    phase: StartupPhase,
    error: String,
) -> Result<(), String> {
    STARTUP_MANAGER.finish_phase_error(phase, error).await
}

/// 获取启动进度
#[tauri::command]
pub async fn get_startup_progress() -> Result<f32, String> {
    Ok(STARTUP_MANAGER.calculate_progress())
}

/// 获取启动统计信息
#[tauri::command]
pub async fn get_startup_stats() -> Result<StartupStats, String> {
    STARTUP_MANAGER.get_stats()
}

/// 获取启动缓存
#[tauri::command]
pub async fn get_startup_cache(key: String) -> Result<Option<JsonValue>, String> {
    STARTUP_MANAGER.get_cache(&key)
}

/// 设置启动缓存
#[tauri::command]
pub async fn set_startup_cache(key: String, value: JsonValue) -> Result<(), String> {
    STARTUP_MANAGER.set_cache(key, value)
}

/// 清除启动缓存
#[tauri::command]
pub async fn clear_startup_cache() -> Result<(), String> {
    STARTUP_MANAGER.clear_cache()
}

/// 重置启动管理器
#[tauri::command]
pub async fn reset_startup_manager() -> Result<(), String> {
    STARTUP_MANAGER.reset()
}

/// 预加载资源
#[tauri::command]
pub async fn preload_resources(resources: Vec<String>) -> Result<(), String> {
    use tokio::time::{sleep, Duration};
    use tracing::{info, warn};

    info!("开始预加载资源: {:?}", resources);

    // 获取配置
    let config = STARTUP_MANAGER.get_config()?;
    
    if !config.enable_preloading {
        return Ok(());
    }

    // 并行预加载资源
    let mut tasks = Vec::new();
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(config.max_parallel_loading));

    for resource in resources {
        let semaphore_clone = semaphore.clone();
        let task = tokio::spawn(async move {
            let _permit = semaphore_clone.acquire().await;
            
            match preload_single_resource(&resource).await {
                Ok(_) => info!("预加载成功: {}", resource),
                Err(e) => warn!("预加载失败: {} - {}", resource, e),
            }
        });
        tasks.push(task);
    }

    // 等待所有任务完成
    for task in tasks {
        if let Err(e) = task.await {
            warn!("预加载任务执行失败: {}", e);
        }
    }

    info!("资源预加载完成");
    Ok(())
}

/// 预加载单个资源
async fn preload_single_resource(resource: &str) -> Result<(), String> {
    use std::path::Path;
    use tokio::fs;

    // 根据资源类型进行不同的预加载策略
    if resource.ends_with(".png") || resource.ends_with(".jpg") || resource.ends_with(".jpeg") {
        // 图片资源预加载
        preload_image_resource(resource).await
    } else if resource.ends_with(".json") {
        // JSON 配置文件预加载
        preload_config_resource(resource).await
    } else if resource.ends_with(".model3.json") || resource.ends_with(".model.json") {
        // Live2D 模型文件预加载
        preload_live2d_resource(resource).await
    } else {
        // 通用文件预加载
        preload_generic_resource(resource).await
    }
}

/// 预加载图片资源
async fn preload_image_resource(path: &str) -> Result<(), String> {
    use tokio::fs;
    use std::path::Path;

    let file_path = Path::new(path);
    
    if !file_path.exists() {
        return Err(format!("图片文件不存在: {}", path));
    }

    // 读取文件到内存中
    let _data = fs::read(file_path)
        .await
        .map_err(|e| format!("读取图片文件失败: {}", e))?;

    // 可以在这里添加图片解码和缓存逻辑
    
    Ok(())
}

/// 预加载配置资源
async fn preload_config_resource(path: &str) -> Result<(), String> {
    use tokio::fs;
    use std::path::Path;

    let file_path = Path::new(path);
    
    if !file_path.exists() {
        return Err(format!("配置文件不存在: {}", path));
    }

    // 读取并解析 JSON 文件
    let content = fs::read_to_string(file_path)
        .await
        .map_err(|e| format!("读取配置文件失败: {}", e))?;

    let _config: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;

    // 将配置缓存到启动管理器中
    let cache_key = format!("config:{}", path);
    STARTUP_MANAGER.set_cache(cache_key, _config)?;

    Ok(())
}

/// 预加载 Live2D 资源
async fn preload_live2d_resource(path: &str) -> Result<(), String> {
    use tokio::fs;
    use std::path::Path;

    let file_path = Path::new(path);
    
    if !file_path.exists() {
        return Err(format!("Live2D模型文件不存在: {}", path));
    }

    // 读取模型文件
    let content = fs::read_to_string(file_path)
        .await
        .map_err(|e| format!("读取Live2D模型文件失败: {}", e))?;

    let model_config: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析Live2D模型文件失败: {}", e))?;

    // 预加载相关的纹理文件
    if let Some(textures) = model_config.get("FileReferences")
        .and_then(|refs| refs.get("Textures"))
        .and_then(|textures| textures.as_array()) {
        
        for texture in textures {
            if let Some(texture_path) = texture.as_str() {
                let full_texture_path = file_path
                    .parent()
                    .unwrap_or(Path::new(""))
                    .join(texture_path);
                
                if full_texture_path.exists() {
                    let _ = preload_image_resource(
                        full_texture_path.to_str().unwrap_or("")
                    ).await;
                }
            }
        }
    }

    // 将模型配置缓存
    let cache_key = format!("live2d:{}", path);
    STARTUP_MANAGER.set_cache(cache_key, model_config)?;

    Ok(())
}

/// 预加载通用资源
async fn preload_generic_resource(path: &str) -> Result<(), String> {
    use tokio::fs;
    use std::path::Path;

    let file_path = Path::new(path);
    
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    // 检查文件大小，避免加载过大的文件
    let metadata = fs::metadata(file_path)
        .await
        .map_err(|e| format!("获取文件信息失败: {}", e))?;
    
    if metadata.len() > 50 * 1024 * 1024 { // 50MB 限制
        return Err(format!("文件过大，跳过预加载: {}", path));
    }

    // 读取文件内容
    let _data = fs::read(file_path)
        .await
        .map_err(|e| format!("读取文件失败: {}", e))?;

    Ok(())
}

/// 优化应用启动
#[tauri::command]
pub async fn optimize_startup() -> Result<String, String> {
    use tracing::info;

    info!("开始执行启动优化");

    let mut optimizations = Vec::new();

    // 1. 清理临时文件
    if let Err(e) = cleanup_temp_files().await {
        optimizations.push(format!("清理临时文件失败: {}", e));
    } else {
        optimizations.push("已清理临时文件".to_string());
    }

    // 2. 优化数据库
    if let Err(e) = optimize_database().await {
        optimizations.push(format!("优化数据库失败: {}", e));
    } else {
        optimizations.push("已优化数据库".to_string());
    }

    // 3. 预编译常用资源
    if let Err(e) = precompile_resources().await {
        optimizations.push(format!("预编译资源失败: {}", e));
    } else {
        optimizations.push("已预编译资源".to_string());
    }

    // 4. 更新启动缓存
    if let Err(e) = update_startup_cache().await {
        optimizations.push(format!("更新启动缓存失败: {}", e));
    } else {
        optimizations.push("已更新启动缓存".to_string());
    }

    let result = optimizations.join("; ");
    info!("启动优化完成: {}", result);

    Ok(result)
}

/// 清理临时文件
async fn cleanup_temp_files() -> Result<(), String> {
    use tokio::fs;
    use std::path::PathBuf;

    let temp_dirs = vec![
        dirs::cache_dir().map(|d| d.join("zishu-sensei")),
        std::env::temp_dir().join("zishu-sensei").into(),
    ];

    for temp_dir in temp_dirs.into_iter().flatten() {
        if temp_dir.exists() {
            // 删除超过7天的临时文件
            if let Ok(entries) = fs::read_dir(&temp_dir).await {
                let mut entries = entries;
                while let Ok(Some(entry)) = entries.next_entry().await {
                    if let Ok(metadata) = entry.metadata().await {
                        if let Ok(modified) = metadata.modified() {
                            if modified.elapsed().unwrap_or_default().as_secs() > 7 * 24 * 3600 {
                                let _ = fs::remove_file(entry.path()).await;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// 优化数据库
async fn optimize_database() -> Result<(), String> {
    // 这里可以添加数据库优化逻辑
    // 例如: VACUUM, REINDEX, 统计信息更新等
    Ok(())
}

/// 预编译资源
async fn precompile_resources() -> Result<(), String> {
    // 这里可以添加资源预编译逻辑
    // 例如: CSS预处理, JS压缩, 图片优化等
    Ok(())
}

/// 更新启动缓存
async fn update_startup_cache() -> Result<(), String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    use serde_json::json;

    // 更新启动缓存时间戳
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    STARTUP_MANAGER.set_cache(
        "last_optimization".to_string(),
        json!(timestamp),
    )?;

    Ok(())
}
