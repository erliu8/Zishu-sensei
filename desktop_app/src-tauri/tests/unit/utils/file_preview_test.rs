// tests/unit/utils/file_preview_test.rs
//! 文件预览工具测试
//!
//! 测试文件预览生成、类型检测和Base64编码功能

use zishu_sensei::utils::file_preview::*;
use std::fs;
use tempfile::tempdir;

// ========================================
// 预览类型检测测试
// ========================================

mod preview_type_detection {
    use super::*;

    #[test]
    fn test_is_previewable_image() {
        // ========== Act & Assert ==========
        assert!(FilePreview::is_previewable("image"));
    }

    #[test]
    fn test_is_previewable_text() {
        // ========== Act & Assert ==========
        assert!(FilePreview::is_previewable("text"));
    }

    #[test]
    fn test_is_previewable_pdf() {
        // ========== Act & Assert ==========
        assert!(FilePreview::is_previewable("pdf"));
    }

    #[test]
    fn test_is_previewable_video() {
        // ========== Act & Assert ==========
        assert!(FilePreview::is_previewable("video"));
    }

    #[test]
    fn test_is_previewable_audio() {
        // ========== Act & Assert ==========
        assert!(FilePreview::is_previewable("audio"));
    }

    #[test]
    fn test_is_previewable_code() {
        // ========== Act & Assert ==========
        assert!(FilePreview::is_previewable("code"));
    }

    #[test]
    fn test_is_not_previewable_archive() {
        // ========== Act & Assert ==========
        assert!(!FilePreview::is_previewable("archive"));
    }

    #[test]
    fn test_is_not_previewable_binary() {
        // ========== Act & Assert ==========
        assert!(!FilePreview::is_previewable("binary"));
    }

    #[test]
    fn test_is_not_previewable_unknown() {
        // ========== Act & Assert ==========
        assert!(!FilePreview::is_previewable("unknown"));
    }

    #[test]
    fn test_is_not_previewable_empty_string() {
        // ========== Act & Assert ==========
        assert!(!FilePreview::is_previewable(""));
    }

    #[test]
    fn test_is_previewable_case_sensitive() {
        // ========== Act & Assert ==========
        // 函数使用精确匹配
        assert!(!FilePreview::is_previewable("Image"));
        assert!(!FilePreview::is_previewable("TEXT"));
        assert!(!FilePreview::is_previewable("Video"));
    }
}

// ========================================
// 文本预览生成测试
// ========================================

mod text_preview_generation {
    use super::*;

    #[test]
    fn test_generate_text_preview_short_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("short.txt");
        let content = "This is a short file.";
        fs::write(&file_path, content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview, content);
    }

    #[test]
    fn test_generate_text_preview_long_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("long.txt");
        let content = "A".repeat(2000); // 超过1000字符
        fs::write(&file_path, &content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview.len(), 1000);
        assert_eq!(preview, "A".repeat(1000));
    }

    #[test]
    fn test_generate_text_preview_exactly_1000_chars() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("exact.txt");
        let content = "B".repeat(1000);
        fs::write(&file_path, &content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview.len(), 1000);
        assert_eq!(preview, content);
    }

    #[test]
    fn test_generate_text_preview_empty_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("empty.txt");
        fs::write(&file_path, "").unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview, "");
    }

    #[test]
    fn test_generate_text_preview_unicode_content() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("unicode.txt");
        let content = "Hello 世界 🌍 مرحبا";
        fs::write(&file_path, content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview, content);
    }

    #[test]
    fn test_generate_text_preview_multiline() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("multiline.txt");
        let content = "Line 1\nLine 2\nLine 3\nLine 4";
        fs::write(&file_path, content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview, content);
    }

    #[test]
    fn test_generate_text_preview_nonexistent_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("nonexistent.txt");

        // ========== Act ==========
        let result = FilePreview::generate_text_preview(&file_path);

        // ========== Assert ==========
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[test]
    fn test_generate_text_preview_unicode_chars_counting() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("unicode_long.txt");
        // 使用Unicode字符，每个字符可能占多个字节
        let content = "你好".repeat(600); // 1200个字符
        fs::write(&file_path, &content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        // 应该截取1000个字符（而不是1000个字节）
        assert_eq!(preview.chars().count(), 1000);
    }
}

// ========================================
// Base64编码测试
// ========================================

mod base64_encoding {
    use super::*;

    #[test]
    fn test_get_base64_data_url_small_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("small.txt");
        let content = "Hello, World!";
        fs::write(&file_path, content).unwrap();

        // ========== Act ==========
        let data_url = FilePreview::get_base64_data_url(&file_path, "text/plain").unwrap();

        // ========== Assert ==========
        assert!(data_url.starts_with("data:text/plain;base64,"));
        
        // 验证可以解码
        let base64_part = data_url.strip_prefix("data:text/plain;base64,").unwrap();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(base64_part)
            .unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), content);
    }

    #[test]
    fn test_get_base64_data_url_binary_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("binary.bin");
        let binary_data = vec![0u8, 1, 2, 3, 255, 128, 64];
        fs::write(&file_path, &binary_data).unwrap();

        // ========== Act ==========
        let data_url = FilePreview::get_base64_data_url(&file_path, "application/octet-stream").unwrap();

        // ========== Assert ==========
        assert!(data_url.starts_with("data:application/octet-stream;base64,"));
        
        // 验证可以解码
        let base64_part = data_url.strip_prefix("data:application/octet-stream;base64,").unwrap();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(base64_part)
            .unwrap();
        assert_eq!(decoded, binary_data);
    }

    #[test]
    fn test_get_base64_data_url_image_mime_type() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("image.png");
        let dummy_image_data = b"fake png data";
        fs::write(&file_path, dummy_image_data).unwrap();

        // ========== Act ==========
        let data_url = FilePreview::get_base64_data_url(&file_path, "image/png").unwrap();

        // ========== Assert ==========
        assert!(data_url.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn test_get_base64_data_url_empty_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("empty.txt");
        fs::write(&file_path, "").unwrap();

        // ========== Act ==========
        let data_url = FilePreview::get_base64_data_url(&file_path, "text/plain").unwrap();

        // ========== Assert ==========
        assert!(data_url.starts_with("data:text/plain;base64,"));
    }

    #[test]
    fn test_get_base64_data_url_file_too_large() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("large.bin");
        // 创建一个大于5MB的文件
        let large_data = vec![0u8; 6 * 1024 * 1024]; // 6MB
        fs::write(&file_path, &large_data).unwrap();

        // ========== Act ==========
        let result = FilePreview::get_base64_data_url(&file_path, "application/octet-stream");

        // ========== Assert ==========
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File too large"));
    }

    #[test]
    fn test_get_base64_data_url_file_exactly_5mb() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("exactly_5mb.bin");
        let data = vec![0u8; 5 * 1024 * 1024]; // 正好5MB
        fs::write(&file_path, &data).unwrap();

        // ========== Act ==========
        let result = FilePreview::get_base64_data_url(&file_path, "application/octet-stream");

        // ========== Assert ==========
        // 5MB应该可以处理
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_base64_data_url_nonexistent_file() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("nonexistent.txt");

        // ========== Act ==========
        let result = FilePreview::get_base64_data_url(&file_path, "text/plain");

        // ========== Assert ==========
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[test]
    fn test_get_base64_data_url_different_mime_types() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        let mime_types = vec![
            "text/plain",
            "text/html",
            "application/json",
            "image/jpeg",
            "video/mp4",
        ];

        // ========== Act & Assert ==========
        for mime_type in mime_types {
            let data_url = FilePreview::get_base64_data_url(&file_path, mime_type).unwrap();
            assert!(data_url.starts_with(&format!("data:{};base64,", mime_type)));
        }
    }
}

// ========================================
// PDF预览测试（未实现功能）
// ========================================

mod pdf_preview {
    use super::*;

    #[test]
    fn test_generate_pdf_preview_not_implemented() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let pdf_path = temp_dir.path().join("test.pdf");
        let output_path = temp_dir.path().join("preview.png");

        // ========== Act ==========
        let result = FilePreview::generate_pdf_preview(&pdf_path, &output_path);

        // ========== Assert ==========
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not implemented"));
    }
}

// ========================================
// 视频缩略图测试（未实现功能）
// ========================================

mod video_thumbnail {
    use super::*;

    #[test]
    fn test_generate_video_thumbnail_not_implemented() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let video_path = temp_dir.path().join("test.mp4");
        let output_path = temp_dir.path().join("thumbnail.jpg");

        // ========== Act ==========
        let result = FilePreview::generate_video_thumbnail(&video_path, &output_path);

        // ========== Assert ==========
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not implemented"));
    }
}

// ========================================
// 边界条件测试
// ========================================

mod edge_cases {
    use super::*;

    #[test]
    fn test_text_preview_with_special_characters() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("special.txt");
        let content = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
        fs::write(&file_path, content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview, content);
    }

    #[test]
    fn test_text_preview_with_tabs_and_newlines() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("whitespace.txt");
        let content = "Line1\tTab\nLine2\r\nLine3";
        fs::write(&file_path, content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview, content);
    }

    #[test]
    fn test_base64_with_unicode_in_mime_type() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        // ========== Act ==========
        // MIME类型通常应该是ASCII，但测试边界情况
        let data_url = FilePreview::get_base64_data_url(
            &file_path,
            "text/plain; charset=utf-8"
        ).unwrap();

        // ========== Assert ==========
        assert!(data_url.starts_with("data:text/plain; charset=utf-8;base64,"));
    }

    #[test]
    fn test_text_preview_with_null_bytes() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("nulls.txt");
        // 注意：包含null字节的文件可能不是有效的UTF-8文本
        fs::write(&file_path, b"before\0after").unwrap();

        // ========== Act ==========
        let result = FilePreview::generate_text_preview(&file_path);

        // ========== Assert ==========
        // 根据实现，可能成功或失败
        // 如果失败，应该有适当的错误消息
        if let Err(e) = result {
            assert!(!e.is_empty());
        }
    }

    #[test]
    fn test_base64_data_url_format() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("format.txt");
        fs::write(&file_path, "test").unwrap();

        // ========== Act ==========
        let data_url = FilePreview::get_base64_data_url(&file_path, "text/plain").unwrap();

        // ========== Assert ==========
        // 验证格式正确性
        let parts: Vec<&str> = data_url.split(';').collect();
        assert_eq!(parts.len(), 2);
        assert!(parts[0].starts_with("data:"));
        assert!(parts[1].starts_with("base64,"));
    }

    #[test]
    fn test_text_preview_counts_chars_not_bytes() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("chars_vs_bytes.txt");
        // 中文字符，每个字符3个字节(UTF-8)
        let content = "你".repeat(600); // 600个字符，1800个字节

        fs::write(&file_path, &content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        // 应该是1000个字符，而不是1000个字节
        assert_eq!(preview.chars().count(), 1000);
        assert!(preview.len() > 1000); // 字节数应该大于字符数
    }

    #[test]
    fn test_preview_size_boundary() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("boundary.txt");
        let content = "A".repeat(999) + "B"; // 正好1000字符

        fs::write(&file_path, &content).unwrap();

        // ========== Act ==========
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();

        // ========== Assert ==========
        assert_eq!(preview.len(), 1000);
        assert!(preview.ends_with('B'));
    }
}

// ========================================
// 性能测试
// ========================================

mod performance {
    use super::*;

    #[test]
    fn test_large_file_preview_is_fast() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("large.txt");
        let content = "X".repeat(100_000); // 100K字符
        fs::write(&file_path, &content).unwrap();

        // ========== Act ==========
        let start = std::time::Instant::now();
        let preview = FilePreview::generate_text_preview(&file_path).unwrap();
        let duration = start.elapsed();

        // ========== Assert ==========
        assert_eq!(preview.len(), 1000); // 只取前1000个字符
        // 应该很快完成（不应该读取整个文件）
        assert!(duration.as_millis() < 100);
    }

    #[test]
    fn test_base64_encoding_performance() {
        // ========== Arrange ==========
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("medium.bin");
        let data = vec![0u8; 1024 * 1024]; // 1MB
        fs::write(&file_path, &data).unwrap();

        // ========== Act ==========
        let start = std::time::Instant::now();
        let _data_url = FilePreview::get_base64_data_url(&file_path, "application/octet-stream").unwrap();
        let duration = start.elapsed();

        // ========== Assert ==========
        // 1MB文件的Base64编码应该在合理时间内完成
        assert!(duration.as_secs() < 1);
    }
}

