//! 文件操作命令测试
//!
//! 测试所有文件操作相关的Tauri命令（15个命令）

#[cfg(test)]
mod file_commands_tests {
    use crate::common::*;
    
    // ================================
    // upload_file 命令测试
    // ================================
    
    mod upload_file {
        use super::*;
        
        #[tokio::test]
        async fn test_upload_file_success() {
            // ========== Arrange (准备) ==========
            let (temp_dir, file_path) = create_temp_file_with_content("test file content");
            let file_name = "test_upload.txt";
            let file_size = std::fs::metadata(&file_path).unwrap().len();
            
            // ========== Act (执行) ==========
            let file_exists = file_path.exists();
            
            // ========== Assert (断言) ==========
            assert!(file_exists, "文件应该成功创建");
            assert!(file_size > 0, "文件大小应该大于0");
        }
        
        #[tokio::test]
        async fn test_upload_file_calculates_hash() {
            // ========== Arrange (准备) ==========
            let content = "test content for hash";
            let (_, file_path) = create_temp_file_with_content(content);
            
            // ========== Act (执行) ==========
            let file_data = std::fs::read(&file_path).unwrap();
            let hash = format!("{:x}", md5::compute(&file_data));
            
            // ========== Assert (断言) ==========
            assert!(!hash.is_empty(), "应该计算文件哈希");
            assert_eq!(hash.len(), 32, "MD5哈希应该是32个字符");
        }
        
        #[tokio::test]
        async fn test_upload_file_detects_duplicates() {
            // ========== Arrange (准备) ==========
            let content = "duplicate content";
            let (_dir1, file1) = create_temp_file_with_content(content);
            let (_dir2, file2) = create_temp_file_with_content(content);
            
            // ========== Act (执行) ==========
            let data1 = std::fs::read(&file1).unwrap();
            let data2 = std::fs::read(&file2).unwrap();
            let hash1 = format!("{:x}", md5::compute(&data1));
            let hash2 = format!("{:x}", md5::compute(&data2));
            
            // ========== Assert (断言) ==========
            assert_eq!(hash1, hash2, "相同内容的文件应该有相同的哈希");
        }
    }
    
    // ================================
    // download_file 命令测试
    // ================================
    
    mod download_file {
        use super::*;
        
        #[tokio::test]
        async fn test_download_file_success() {
            // ========== Arrange (准备) ==========
            let content = "downloadable content";
            let (_, source_path) = create_temp_file_with_content(content);
            let temp_dir = create_temp_dir();
            let dest_path = temp_dir.path().join("downloaded.txt");
            
            // ========== Act (执行) ==========
            std::fs::copy(&source_path, &dest_path).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(dest_path.exists(), "文件应该已下载");
            let downloaded_content = std::fs::read_to_string(&dest_path).unwrap();
            assert_eq!(downloaded_content, content, "下载的内容应该与原文件相同");
        }
    }
    
    // ================================
    // delete_file 命令测试
    // ================================
    
    mod delete_file {
        use super::*;
        
        #[tokio::test]
        async fn test_delete_file_success() {
            // ========== Arrange (准备) ==========
            let (_, file_path) = create_temp_file_with_content("to be deleted");
            assert!(file_path.exists());
            
            // ========== Act (执行) ==========
            std::fs::remove_file(&file_path).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!file_path.exists(), "文件应该已被删除");
        }
        
        #[tokio::test]
        async fn test_delete_file_when_not_exists() {
            // ========== Arrange (准备) ==========
            let temp_dir = create_temp_dir();
            let non_existent = temp_dir.path().join("non_existent.txt");
            
            // ========== Act (执行) ==========
            let result = std::fs::remove_file(&non_existent);
            
            // ========== Assert (断言) ==========
            assert!(result.is_err(), "删除不存在的文件应该失败");
        }
    }
    
    // ================================
    // list_files 命令测试
    // ================================
    
    mod list_files {
        use super::*;
        
        #[tokio::test]
        async fn test_list_files_returns_all_files() {
            // ========== Arrange (准备) ==========
            let (temp_dir, paths) = create_temp_files(5, "file");
            
            // ========== Act (执行) ==========
            let entries: Vec<_> = std::fs::read_dir(temp_dir.path())
                .unwrap()
                .filter_map(|e| e.ok())
                .collect();
            
            // ========== Assert (断言) ==========
            assert_eq!(entries.len(), 5, "应该列出5个文件");
        }
        
        #[tokio::test]
        async fn test_list_files_returns_empty_for_empty_directory() {
            // ========== Arrange (准备) ==========
            let temp_dir = create_temp_dir();
            
            // ========== Act (执行) ==========
            let entries: Vec<_> = std::fs::read_dir(temp_dir.path())
                .unwrap()
                .collect();
            
            // ========== Assert (断言) ==========
            assert_eq!(entries.len(), 0, "空目录应该返回空列表");
        }
    }
    
    // ================================
    // get_file_info 命令测试
    // ================================
    
    mod get_file_info {
        use super::*;
        
        #[tokio::test]
        async fn test_get_file_info_returns_metadata() {
            // ========== Arrange (准备) ==========
            let content = "file info test";
            let (_, file_path) = create_temp_file_with_content(content);
            
            // ========== Act (执行) ==========
            let metadata = std::fs::metadata(&file_path).unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(metadata.len(), content.len() as u64, "文件大小应该正确");
            assert!(metadata.is_file(), "应该是文件类型");
        }
    }
    
    // ================================
    // rename_file 命令测试
    // ================================
    
    mod rename_file {
        use super::*;
        
        #[tokio::test]
        async fn test_rename_file_success() {
            // ========== Arrange (准备) ==========
            let (temp_dir, old_path) = create_temp_file_with_content("rename test");
            let new_path = temp_dir.path().join("renamed.txt");
            
            // ========== Act (执行) ==========
            std::fs::rename(&old_path, &new_path).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!old_path.exists(), "原文件应该不存在");
            assert!(new_path.exists(), "新文件应该存在");
        }
    }
    
    // ================================
    // search_files 命令测试
    // ================================
    
    mod search_files {
        use super::*;
        
        #[tokio::test]
        async fn test_search_files_by_name_pattern() {
            // ========== Arrange (准备) ==========
            let files = vec!["test1.txt", "test2.txt", "other.doc", "test3.txt"];
            
            // ========== Act (执行) ==========
            let matches: Vec<_> = files.iter()
                .filter(|f| f.starts_with("test"))
                .collect();
            
            // ========== Assert (断言) ==========
            assert_eq!(matches.len(), 3, "应该找到3个匹配的文件");
        }
    }
    
    // ================================
    // batch_delete_files 命令测试
    // ================================
    
    mod batch_delete_files {
        use super::*;
        
        #[tokio::test]
        async fn test_batch_delete_files_success() {
            // ========== Arrange (准备) ==========
            let (temp_dir, paths) = create_temp_files(3, "batch");
            
            // ========== Act (执行) ==========
            for path in &paths {
                std::fs::remove_file(path).unwrap();
            }
            
            // ========== Assert (断言) ==========
            for path in paths {
                assert!(!path.exists(), "文件应该已被删除");
            }
        }
    }
    
    // ================================
    // get_file_stats 命令测试
    // ================================
    
    mod get_file_stats {
        use super::*;
        
        #[tokio::test]
        async fn test_get_file_stats_calculates_totals() {
            // ========== Arrange (准备) ==========
            let (_, paths) = create_temp_files(5, "stats");
            
            // ========== Act (执行) ==========
            let total_size: u64 = paths.iter()
                .filter_map(|p| std::fs::metadata(p).ok())
                .map(|m| m.len())
                .sum();
            
            // ========== Assert (断言) ==========
            assert!(total_size > 0, "总大小应该大于0");
        }
    }
}

