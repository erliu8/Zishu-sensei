use tauri::http::{header, Request, Response, ResponseBuilder};
use tauri::http::status::StatusCode;
use tracing::warn;

fn get_live2d_cache_dir() -> Result<std::path::PathBuf, String> {
    let base = dirs::cache_dir().ok_or("Failed to get cache directory".to_string())?;
    Ok(base.join("zishu-sensei").join("cache").join("live2d"))
}

fn safe_join_cache(cache_root: &std::path::Path, rel: &str) -> Result<std::path::PathBuf, String> {
    let rel = rel.trim_start_matches('/').replace('\\', "/");
    let joined = cache_root.join(rel);

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

fn response_with_status(status: StatusCode, body: Vec<u8>, content_type: &str) -> Response {
    ResponseBuilder::new()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .unwrap_or_else(|_| {
            ResponseBuilder::new()
                .status(status)
                .body(Vec::new())
                .unwrap()
        })
}

pub fn handle_zishu_protocol(
    _app: &tauri::AppHandle,
    request: &Request,
) -> Result<Response, Box<dyn std::error::Error>> {
    // We serve cached Live2D assets under:
    //   zishu://live2d/live2d_models/...
    // uri.path() will be "/live2d_models/..." (host is "live2d")
    let uri = request.uri();
    let path = url::Url::parse(uri)
        .map(|u| u.path().to_string())
        .unwrap_or_else(|_| uri.split('?').next().unwrap_or(uri).to_string());
    if path == "/ping" {
        return Ok(response_with_status(StatusCode::OK, b"ok".to_vec(), "text/plain"));
    }

    // Allow both "/live2d_models/..." and "/cache/live2d_models/..." if ever needed
    let rel = path.trim_start_matches('/');
    let cache_root = get_live2d_cache_dir().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    let file_path = safe_join_cache(&cache_root, rel).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

    if !file_path.exists() {
        warn!("zishu protocol asset not found: {} -> {:?}", path, file_path);
        return Ok(response_with_status(StatusCode::NOT_FOUND, Vec::new(), "application/octet-stream"));
    }

    let bytes = std::fs::read(&file_path)?;
    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
    Ok(response_with_status(
        StatusCode::OK,
        bytes,
        mime.essence_str(),
    ))
}
