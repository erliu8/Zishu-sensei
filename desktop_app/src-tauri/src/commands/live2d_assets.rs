//! Live2D assets preparation and caching
//!
//! Goal: download model manifest + required files into a user cache directory,
//! then serve them to the WebView via a custom scheme (zishu://live2d/...).

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tracing::{info, warn};

use crate::commands::CommandResponse;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrepareLive2DResult {
    pub base_url: String,
    pub cache_dir: String,
    pub used_remote: bool,
}

pub(crate) async fn ensure_live2d_model_cached_best_effort(model_id: &str) -> Result<(), String> {
    let cache_root = get_live2d_cache_dir()?;
    tokio::fs::create_dir_all(&cache_root)
        .await
        .map_err(|e| format!("Failed to create live2d cache dir: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    match determine_remote_base_url() {
        Some(v) => {
            let remote_base = normalize_remote_base_url(v);
            // Ensure manifest exists (download if missing)
            let manifest_path = safe_join_cache(&cache_root, "live2d_models/models.json")?;
            if !manifest_path.exists() {
                ensure_manifest(&client, &remote_base, &cache_root).await?;
            }
            ensure_default_model_cached(&client, &remote_base, &cache_root, model_id).await?;
            Ok(())
        }
        None => {
            // Offline mode: require manifest + model files already cached
            let library = read_manifest(&cache_root).await?;
            let model = library
                .models
                .iter()
                .find(|m| m.id == model_id)
                .ok_or_else(|| format!("Model '{}' not found in cached models.json", model_id))?;

            let model_path_rel = model.path.trim_start_matches('/');
            let model_cache_path = safe_join_cache(&cache_root, model_path_rel)?;
            if !model_cache_path.exists() {
                return Err(format!("Model '{}' not cached: {}", model_id, model.path));
            }

            let content = tokio::fs::read_to_string(&model_cache_path)
                .await
                .map_err(|e| format!("Failed to read cached model3.json: {}", e))?;
            let model3: Model3Json =
                serde_json::from_str(&content).map_err(|e| format!("Failed to parse model3.json: {}", e))?;
            let required = list_model_required_files(&model3);

            let model_dir_rel = std::path::Path::new(model_path_rel)
                .parent()
                .ok_or("Invalid model path".to_string())?
                .to_string_lossy()
                .replace('\\', "/");

            for rel_file in required {
                let rel_file = rel_file.trim_start_matches('/').replace('\\', "/");
                let cache_rel = format!("{}/{}", model_dir_rel, rel_file);
                let cache_path = safe_join_cache(&cache_root, &cache_rel)?;
                if !cache_path.exists() {
                    return Err(format!("Missing cached file for '{}': {}", model_id, cache_rel));
                }
            }

            Ok(())
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModelLibrary {
    models: Vec<ModelInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModelInfo {
    id: String,
    path: String,
    #[serde(rename = "previewImage")]
    preview_image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Model3Json {
    #[serde(rename = "FileReferences")]
    file_references: Option<FileReferences>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileReferences {
    #[serde(rename = "Moc", alias = "Moc3")]
    moc: Option<String>,
    #[serde(rename = "Textures")]
    textures: Option<Vec<String>>,
    #[serde(rename = "Motions")]
    motions: Option<serde_json::Value>,
    #[serde(rename = "Expressions")]
    expressions: Option<Vec<NamedFile>>,
    #[serde(rename = "Physics")]
    physics: Option<String>,
    #[serde(rename = "Pose")]
    pose: Option<String>,
    #[serde(rename = "UserData")]
    user_data: Option<String>,
    #[serde(rename = "DisplayInfo")]
    display_info: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NamedFile {
    #[serde(rename = "File")]
    file: String,
}

fn get_live2d_cache_dir() -> Result<std::path::PathBuf, String> {
    let base = dirs::cache_dir().ok_or("Failed to get cache directory".to_string())?;
    Ok(base.join("zishu-sensei").join("cache").join("live2d"))
}

fn normalize_remote_base_url(mut base: String) -> String {
    while base.ends_with('/') {
        base.pop();
    }
    base
}

fn determine_remote_base_url() -> Option<String> {
    if let Ok(v) = std::env::var("ZISHU_LIVE2D_BASE_URL") {
        let v = v.trim().to_string();
        if !v.is_empty() {
            return Some(v);
        }
    }

    if let Ok(core) = std::env::var("ZISHU_CORE_API_URL") {
        let core = core.trim().to_string();
        if !core.is_empty() {
            return Some(format!("{}/live2d_models", normalize_remote_base_url(core)));
        }
    }

    None
}

fn join_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    let path = path.trim_start_matches('/');
    format!("{}/{}", base, path)
}

fn safe_join_cache(cache_root: &std::path::Path, rel: &str) -> Result<std::path::PathBuf, String> {
    let rel = rel.trim_start_matches('/').replace('\\', "/");
    let joined = cache_root.join(rel);

    // Prevent path traversal by checking normalized components.
    let mut normalized = std::path::PathBuf::new();
    for comp in joined.components() {
        use std::path::Component;
        match comp {
            Component::Normal(c) => normalized.push(c),
            Component::RootDir | Component::Prefix(_) => normalized.push(comp.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => return Err("Invalid path (.. not allowed)".to_string()),
        }
    }
    Ok(normalized)
}

async fn download_to_cache(client: &reqwest::Client, url: &str, cache_path: &std::path::Path) -> Result<(), String> {
    if let Some(parent) = cache_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create cache dir: {}", e))?;
    }

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {} for {}", resp.status(), url));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("Failed to read body: {}", e))?;
    tokio::fs::write(cache_path, &bytes)
        .await
        .map_err(|e| format!("Failed to write cache file: {}", e))?;
    Ok(())
}

async fn ensure_manifest(client: &reqwest::Client, remote_base: &str, cache_root: &std::path::Path) -> Result<bool, String> {
    let manifest_rel = "live2d_models/models.json";
    let manifest_path = safe_join_cache(cache_root, manifest_rel)?;
    if manifest_path.exists() {
        return Ok(false);
    }

    let url = join_url(remote_base, "models.json");
    info!("Downloading Live2D manifest: {}", url);
    download_to_cache(client, &url, &manifest_path).await?;
    Ok(true)
}

async fn read_manifest(cache_root: &std::path::Path) -> Result<ModelLibrary, String> {
    let manifest_path = safe_join_cache(cache_root, "live2d_models/models.json")?;
    let content = tokio::fs::read_to_string(&manifest_path)
        .await
        .map_err(|e| format!("Failed to read cached models.json: {}", e))?;
    serde_json::from_str::<ModelLibrary>(&content).map_err(|e| format!("Failed to parse models.json: {}", e))
}

fn list_model_required_files(model3: &Model3Json) -> Vec<String> {
    let mut files: Vec<String> = Vec::new();
    let Some(refs) = model3.file_references.as_ref() else {
        return files;
    };

    if let Some(moc) = refs.moc.as_ref() {
        files.push(moc.clone());
    }

    if let Some(textures) = refs.textures.as_ref() {
        files.extend(textures.iter().cloned());
    }

    if let Some(expressions) = refs.expressions.as_ref() {
        files.extend(expressions.iter().map(|e| e.file.clone()));
    }

    for opt in [
        refs.physics.as_ref(),
        refs.pose.as_ref(),
        refs.user_data.as_ref(),
        refs.display_info.as_ref(),
    ] {
        if let Some(v) = opt {
            files.push(v.clone());
        }
    }

    if let Some(motions) = refs.motions.as_ref() {
        // Motions is a nested object of arrays: { Group: [ { File, ... }, ... ] }
        if let Some(obj) = motions.as_object() {
            for (_k, v) in obj.iter() {
                if let Some(arr) = v.as_array() {
                    for item in arr {
                        if let Some(file) = item.get("File").and_then(|x| x.as_str()) {
                            files.push(file.to_string());
                        }
                    }
                }
            }
        }
    }

    files.sort();
    files.dedup();
    files
}

async fn ensure_default_model_cached(
    client: &reqwest::Client,
    remote_base: &str,
    cache_root: &std::path::Path,
    default_model_id: &str,
) -> Result<bool, String> {
    let library = read_manifest(cache_root).await?;
    let model = library
        .models
        .iter()
        .find(|m| m.id == default_model_id)
        .ok_or_else(|| format!("Default model '{}' not found in models.json", default_model_id))?;

    let model_path_rel = model.path.trim_start_matches('/');
    if !model_path_rel.starts_with("live2d_models/") {
        return Err(format!("Unexpected model path in models.json: {}", model.path));
    }

    let model_cache_path = safe_join_cache(cache_root, model_path_rel)?;
    let mut downloaded_any = false;

    if !model_cache_path.exists() {
        // Download model3.json first
        let model_url = join_url(remote_base, model_path_rel.strip_prefix("live2d_models/").unwrap_or(model_path_rel));
        info!("Downloading default model JSON: {}", model_url);
        download_to_cache(client, &model_url, &model_cache_path).await?;
        downloaded_any = true;
    }

    // Parse model3.json to discover referenced files (always validate dependencies)
    let content = tokio::fs::read_to_string(&model_cache_path)
        .await
        .map_err(|e| format!("Failed to read cached model3.json: {}", e))?;
    let model3: Model3Json = serde_json::from_str(&content).map_err(|e| format!("Failed to parse model3.json: {}", e))?;
    let required = list_model_required_files(&model3);

    // Base directory for relative files
    let model_dir_rel = std::path::Path::new(model_path_rel)
        .parent()
        .ok_or("Invalid model path".to_string())?
        .to_string_lossy()
        .replace('\\', "/");

    for rel_file in required {
        let rel_file = rel_file.trim_start_matches('/').replace('\\', "/");
        let cache_rel = format!("{}/{}", model_dir_rel, rel_file);
        let cache_path = safe_join_cache(cache_root, &cache_rel)?;
        if cache_path.exists() {
            continue;
        }

        let remote_rel = format!("{}/{}", model_dir_rel.strip_prefix("live2d_models/").unwrap_or(&model_dir_rel), rel_file);
        let url = join_url(remote_base, &remote_rel);
        download_to_cache(client, &url, &cache_path).await?;
        downloaded_any = true;
    }

    // Download preview image if present
    if let Some(preview) = model.preview_image.as_ref() {
        let preview_rel = preview.trim_start_matches('/').replace('\\', "/");
        if preview_rel.starts_with("live2d_models/") {
            let preview_cache_path = safe_join_cache(cache_root, &preview_rel)?;
            if !preview_cache_path.exists() {
                let remote_rel = preview_rel.strip_prefix("live2d_models/").unwrap_or(&preview_rel);
                let url = join_url(remote_base, remote_rel);
                download_to_cache(client, &url, &preview_cache_path).await?;
                downloaded_any = true;
            }
        }
    }

    Ok(downloaded_any)
}

#[tauri::command]
pub async fn prepare_live2d_assets(_app: AppHandle) -> Result<CommandResponse<PrepareLive2DResult>, String> {
    let cache_root = get_live2d_cache_dir()?;
    tokio::fs::create_dir_all(&cache_root)
        .await
        .map_err(|e| format!("Failed to create live2d cache dir: {}", e))?;

    let cache_dir_str = cache_root.to_string_lossy().to_string();

    // If we already have a manifest cached, we can operate offline.
    let mut used_remote = false;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let remote_base = match determine_remote_base_url() {
        Some(v) => normalize_remote_base_url(v),
        None => {
            // Offline-only mode: require existing cache
            let manifest_path = safe_join_cache(&cache_root, "live2d_models/models.json")?;
            if !manifest_path.exists() {
                return Err("No remote base URL configured and no cached models.json found".to_string());
            }

            return Ok(CommandResponse::success(PrepareLive2DResult {
                base_url: "zishu://live2d".to_string(),
                cache_dir: cache_dir_str,
                used_remote: false,
            }));
        }
    };

    // 1) Ensure manifest
    match ensure_manifest(&client, &remote_base, &cache_root).await {
        Ok(downloaded) => used_remote |= downloaded,
        Err(e) => {
            // If manifest exists locally, ignore remote errors (offline fallback).
            let manifest_path = safe_join_cache(&cache_root, "live2d_models/models.json")?;
            if manifest_path.exists() {
                warn!("Failed to refresh remote manifest, using cached copy: {}", e);
            } else {
                return Err(e);
            }
        }
    }

    // 2) Ensure default model (hiyori) for first paint
    match ensure_default_model_cached(&client, &remote_base, &cache_root, "hiyori").await {
        Ok(downloaded) => used_remote |= downloaded,
        Err(e) => {
            // If model already exists, ignore. Otherwise fail (can't show anything).
            let maybe = safe_join_cache(&cache_root, "live2d_models/hiyori/hiyori.model3.json")?;
            if maybe.exists() {
                warn!("Failed to refresh default model, using cached copy: {}", e);
            } else {
                return Err(e);
            }
        }
    }

    Ok(CommandResponse::success_with_message(
        PrepareLive2DResult {
            base_url: "zishu://live2d".to_string(),
            cache_dir: cache_dir_str,
            used_remote,
        },
        "Live2D assets prepared".to_string(),
    ))
}
