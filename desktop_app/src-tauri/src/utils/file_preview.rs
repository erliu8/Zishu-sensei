use std::fs;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

/// 文件预览工具
pub struct FilePreview;

impl FilePreview {
    /// 生成文本文件预览（前 1000 个字符）
    pub fn generate_text_preview(file_path: &Path) -> Result<String, String> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let preview: String = content.chars().take(1000).collect();
        Ok(preview)
    }

    /// 检查文件是否可以预览
    pub fn is_previewable(file_type: &str) -> bool {
        matches!(
            file_type,
            "image" | "text" | "pdf" | "video" | "audio" | "code"
        )
    }

    /// 获取文件的 Base64 编码（用于小文件的内联预览）
    pub fn get_base64_data_url(file_path: &Path, mime_type: &str) -> Result<String, String> {
        let data = fs::read(file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        if data.len() > 5 * 1024 * 1024 {
            // 文件大于 5MB
            return Err("File too large for inline preview".to_string());
        }

        let base64_data = general_purpose::STANDARD.encode(&data);
        Ok(format!("data:{};base64,{}", mime_type, base64_data))
    }

    /// 从 PDF 生成预览（需要外部工具或库）
    pub fn generate_pdf_preview(_file_path: &Path, _output_path: &Path) -> Result<(), String> {
        // TODO: 集成 pdf 库或使用 poppler-utils
        // 可以使用 pdf-rs 或调用 pdftoppm 命令
        Err("PDF preview generation not implemented yet".to_string())
    }

    /// 从视频生成缩略图（需要 ffmpeg）
    pub fn generate_video_thumbnail(_file_path: &Path, _output_path: &Path) -> Result<(), String> {
        // TODO: 集成 ffmpeg 或使用 rust 视频处理库
        // 可以调用 ffmpeg 命令: ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 output.jpg
        Err("Video thumbnail generation not implemented yet".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_is_previewable() {
        assert!(FilePreview::is_previewable("image"));
        assert!(FilePreview::is_previewable("text"));
        assert!(FilePreview::is_previewable("pdf"));
        assert!(!FilePreview::is_previewable("archive"));
    }

    #[test]
    fn test_text_preview() {
        let mut temp_file = NamedTempFile::new().unwrap();
        let content = "Hello, World! ".repeat(100);
        temp_file.write_all(content.as_bytes()).unwrap();

        let preview = FilePreview::generate_text_preview(temp_file.path()).unwrap();
        assert!(preview.len() <= 1000);
        assert!(preview.starts_with("Hello, World!"));
    }
}

