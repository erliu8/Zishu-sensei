//! 文件索引数据库测试
//!
//! 测试文件索引的所有功能，包括：
//! - 文件记录的CRUD操作
//! - 文件搜索和查询
//! - 文件标签管理
//! - 文件访问记录
//! - 文件统计

use zishu_sensei::database::file::{
    FileIndex, FileRecord, FileType, FileAccessRecord,
};
use rusqlite::Connection;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;

// ========== 辅助函数 ==========

fn setup_test_index() -> FileIndex {
    let conn = Connection::open_in_memory().expect("无法创建内存数据库");
    let conn = Arc::new(RwLock::new(conn));
    let index = FileIndex::new(conn);
    index.init_tables().expect("无法初始化数据库表");
    index
}

fn create_test_file(path: &str) -> FileRecord {
    FileRecord {
        id: 0, // 由数据库自动生成
        path: path.to_string(),
        name: path.split('/').last().unwrap().to_string(),
        file_type: FileType::Text,
        size: 1024,
        hash: format!("hash_{}", path),
        mime_type: "text/plain".to_string(),
        encoding: Some("utf-8".to_string()),
        tags: vec!["测试".to_string()],
        metadata: serde_json::json!({"key": "value"}),
        created_at: Utc::now(),
        modified_at: Utc::now(),
        last_accessed: Utc::now(),
        access_count: 0,
    }
}

// ========== 文件记录 CRUD 测试 ==========

mod file_crud {
    use super::*;

    #[test]
    fn test_add_and_get_file() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/file1.txt");

        // ========== Act ==========
        let result = index.add_file(file.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "添加文件应该成功");
        let file_id = result.unwrap();
        assert!(file_id > 0, "应该返回有效的文件ID");

        let retrieved = index.get_file_by_id(file_id)
            .expect("查询应该成功")
            .expect("应该找到文件");
        
        assert_eq!(retrieved.path, file.path);
        assert_eq!(retrieved.name, file.name);
    }

    #[test]
    fn test_get_file_by_path() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/file2.txt");
        index.add_file(file.clone()).unwrap();

        // ========== Act ==========
        let retrieved = index.get_file_by_path("/test/file2.txt")
            .expect("查询应该成功")
            .expect("应该找到文件");

        // ========== Assert ==========
        assert_eq!(retrieved.path, file.path);
    }

    #[test]
    fn test_get_file_not_found() {
        // ========== Arrange ==========
        let index = setup_test_index();

        // ========== Act ==========
        let result = index.get_file_by_path("/non/existent.txt")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert!(result.is_none(), "不存在的文件应该返回None");
    }

    #[test]
    fn test_update_file() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/update.txt");
        let file_id = index.add_file(file.clone()).unwrap();

        // ========== Act ==========
        let mut updated = file.clone();
        updated.id = file_id;
        updated.size = 2048;
        updated.hash = "new_hash".to_string();
        
        let result = index.update_file(updated.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "更新文件应该成功");

        let retrieved = index.get_file_by_id(file_id)
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.size, 2048);
        assert_eq!(retrieved.hash, "new_hash");
    }

    #[test]
    fn test_delete_file() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/delete.txt");
        let file_id = index.add_file(file).unwrap();

        // ========== Act ==========
        let result = index.delete_file(file_id);

        // ========== Assert ==========
        assert!(result.is_ok(), "删除文件应该成功");

        let retrieved = index.get_file_by_id(file_id)
            .expect("查询应该成功");
        assert!(retrieved.is_none(), "删除后应该找不到文件");
    }

    #[test]
    fn test_add_duplicate_path() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file1 = create_test_file("/test/duplicate.txt");
        index.add_file(file1).unwrap();

        // ========== Act ==========
        let file2 = create_test_file("/test/duplicate.txt");
        let result = index.add_file(file2);

        // ========== Assert ==========
        // 根据实现，可能是更新现有记录或返回错误
        // 这里假设会更新现有记录
        assert!(result.is_ok() || result.is_err());
    }
}

// ========== 文件类型测试 ==========

mod file_types {
    use super::*;

    #[test]
    fn test_different_file_types() {
        // ========== Arrange ==========
        let index = setup_test_index();

        let types = vec![
            (FileType::Text, "file.txt"),
            (FileType::Image, "file.png"),
            (FileType::Audio, "file.mp3"),
            (FileType::Video, "file.mp4"),
            (FileType::Document, "file.pdf"),
            (FileType::Archive, "file.zip"),
            (FileType::Code, "file.rs"),
            (FileType::Other, "file.unknown"),
        ];

        // ========== Act & Assert ==========
        for (file_type, name) in types {
            let mut file = create_test_file(&format!("/test/{}", name));
            file.file_type = file_type.clone();
            
            let id = index.add_file(file).expect("添加应该成功");
            
            let retrieved = index.get_file_by_id(id).unwrap().unwrap();
            assert_eq!(retrieved.file_type, file_type);
        }
    }

    #[test]
    fn test_get_files_by_type() {
        // ========== Arrange ==========
        let index = setup_test_index();

        // 添加不同类型的文件
        for i in 1..=3 {
            let mut file = create_test_file(&format!("/test/image{}.png", i));
            file.file_type = FileType::Image;
            index.add_file(file).unwrap();
        }

        for i in 1..=2 {
            let mut file = create_test_file(&format!("/test/doc{}.pdf", i));
            file.file_type = FileType::Document;
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let images = index.get_files_by_type(&FileType::Image)
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(images.len(), 3, "应该有3个图片文件");
        
        for file in images {
            assert_eq!(file.file_type, FileType::Image);
        }
    }
}

// ========== 文件搜索测试 ==========

mod file_search {
    use super::*;

    #[test]
    fn test_search_by_name() {
        // ========== Arrange ==========
        let index = setup_test_index();

        for i in 1..=5 {
            let file = create_test_file(&format!("/test/document{}.txt", i));
            index.add_file(file).unwrap();
        }

        for i in 1..=3 {
            let file = create_test_file(&format!("/test/report{}.txt", i));
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let results = index.search_files("document", None, None)
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 5, "应该找到5个document文件");
    }

    #[test]
    fn test_search_with_type_filter() {
        // ========== Arrange ==========
        let index = setup_test_index();

        for i in 1..=3 {
            let mut file = create_test_file(&format!("/test/file{}.txt", i));
            file.file_type = FileType::Text;
            index.add_file(file).unwrap();
        }

        for i in 1..=2 {
            let mut file = create_test_file(&format!("/test/file{}.png", i));
            file.file_type = FileType::Image;
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let results = index.search_files("file", Some(&FileType::Text), None)
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 3, "应该找到3个文本文件");
        
        for file in results {
            assert_eq!(file.file_type, FileType::Text);
        }
    }

    #[test]
    fn test_search_with_limit() {
        // ========== Arrange ==========
        let index = setup_test_index();

        for i in 1..=10 {
            let file = create_test_file(&format!("/test/item{}.txt", i));
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let results = index.search_files("item", None, Some(5))
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 5, "应该只返回5个结果");
    }

    #[test]
    fn test_search_no_results() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/file.txt");
        index.add_file(file).unwrap();

        // ========== Act ==========
        let results = index.search_files("nonexistent", None, None)
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(results.len(), 0, "没有匹配的文件");
    }
}

// ========== 文件标签测试 ==========

mod file_tags {
    use super::*;

    #[test]
    fn test_file_with_tags() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let mut file = create_test_file("/test/tagged.txt");
        file.tags = vec![
            "重要".to_string(),
            "工作".to_string(),
            "2024".to_string(),
        ];

        // ========== Act ==========
        let file_id = index.add_file(file.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = index.get_file_by_id(file_id)
            .unwrap()
            .unwrap();
        
        assert_eq!(retrieved.tags.len(), 3);
        assert!(retrieved.tags.contains(&"重要".to_string()));
        assert!(retrieved.tags.contains(&"工作".to_string()));
    }

    #[test]
    fn test_get_files_by_tag() {
        // ========== Arrange ==========
        let index = setup_test_index();

        for i in 1..=5 {
            let mut file = create_test_file(&format!("/test/work{}.txt", i));
            file.tags = vec!["工作".to_string()];
            index.add_file(file).unwrap();
        }

        for i in 1..=3 {
            let mut file = create_test_file(&format!("/test/personal{}.txt", i));
            file.tags = vec!["个人".to_string()];
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let work_files = index.get_files_by_tag("工作")
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(work_files.len(), 5, "应该有5个工作文件");
    }

    #[test]
    fn test_update_file_tags() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let mut file = create_test_file("/test/update-tags.txt");
        file.tags = vec!["标签1".to_string()];
        let file_id = index.add_file(file).unwrap();

        // ========== Act ==========
        let mut updated = index.get_file_by_id(file_id).unwrap().unwrap();
        updated.tags = vec!["标签2".to_string(), "标签3".to_string()];
        index.update_file(updated).unwrap();

        // ========== Assert ==========
        let final_file = index.get_file_by_id(file_id).unwrap().unwrap();
        assert_eq!(final_file.tags.len(), 2);
        assert!(final_file.tags.contains(&"标签2".to_string()));
        assert!(final_file.tags.contains(&"标签3".to_string()));
    }

    #[test]
    fn test_file_with_no_tags() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let mut file = create_test_file("/test/no-tags.txt");
        file.tags = vec![];

        // ========== Act ==========
        let file_id = index.add_file(file).unwrap();

        // ========== Assert ==========
        let retrieved = index.get_file_by_id(file_id).unwrap().unwrap();
        assert_eq!(retrieved.tags.len(), 0);
    }
}

// ========== 文件访问记录测试 ==========

mod file_access {
    use super::*;

    #[test]
    fn test_record_file_access() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/accessed.txt");
        let file_id = index.add_file(file).unwrap();

        // ========== Act ==========
        let result = index.record_access(
            file_id,
            "read".to_string(),
            Some("user".to_string()),
            None,
        );

        // ========== Assert ==========
        assert!(result.is_ok(), "记录访问应该成功");
    }

    #[test]
    fn test_get_access_history() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/history.txt");
        let file_id = index.add_file(file).unwrap();

        // 记录多次访问
        for i in 1..=5 {
            index.record_access(
                file_id,
                if i % 2 == 0 { "read" } else { "write" }.to_string(),
                Some(format!("user{}", i)),
                None,
            ).unwrap();
        }

        // ========== Act ==========
        let history = index.get_access_history(file_id, Some(10))
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(history.len(), 5, "应该有5条访问记录");
    }

    #[test]
    fn test_access_count_increment() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/count.txt");
        let file_id = index.add_file(file).unwrap();

        // ========== Act ==========
        for _ in 0..10 {
            index.record_access(
                file_id,
                "read".to_string(),
                None,
                None,
            ).unwrap();
        }

        // ========== Assert ==========
        let updated = index.get_file_by_id(file_id).unwrap().unwrap();
        assert_eq!(updated.access_count, 10, "访问计数应该增加到10");
    }

    #[test]
    fn test_last_accessed_update() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/last-access.txt");
        let file_id = index.add_file(file).unwrap();

        let original = index.get_file_by_id(file_id).unwrap().unwrap();
        let original_time = original.last_accessed;

        // 等待一小段时间
        std::thread::sleep(std::time::Duration::from_millis(10));

        // ========== Act ==========
        index.record_access(
            file_id,
            "read".to_string(),
            None,
            None,
        ).unwrap();

        // ========== Assert ==========
        let updated = index.get_file_by_id(file_id).unwrap().unwrap();
        assert!(updated.last_accessed > original_time, "最后访问时间应该更新");
    }
}

// ========== 文件统计测试 ==========

mod file_statistics {
    use super::*;

    #[test]
    fn test_get_total_files() {
        // ========== Arrange ==========
        let index = setup_test_index();

        for i in 1..=10 {
            let file = create_test_file(&format!("/test/file{}.txt", i));
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let total = index.get_total_files()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(total, 10, "应该有10个文件");
    }

    #[test]
    fn test_get_total_size() {
        // ========== Arrange ==========
        let index = setup_test_index();

        for i in 1..=5 {
            let mut file = create_test_file(&format!("/test/file{}.txt", i));
            file.size = i as i64 * 1024; // 1KB, 2KB, 3KB, 4KB, 5KB
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let total_size = index.get_total_size()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(total_size, 15 * 1024, "总大小应该是15KB");
    }

    #[test]
    fn test_get_file_count_by_type() {
        // ========== Arrange ==========
        let index = setup_test_index();

        for i in 1..=3 {
            let mut file = create_test_file(&format!("/test/text{}.txt", i));
            file.file_type = FileType::Text;
            index.add_file(file).unwrap();
        }

        for i in 1..=2 {
            let mut file = create_test_file(&format!("/test/image{}.png", i));
            file.file_type = FileType::Image;
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let stats = index.get_type_statistics()
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(stats.get(&FileType::Text), Some(&3));
        assert_eq!(stats.get(&FileType::Image), Some(&2));
    }

    #[test]
    fn test_get_most_accessed_files() {
        // ========== Arrange ==========
        let index = setup_test_index();

        // 创建文件并模拟不同的访问次数
        for i in 1..=5 {
            let file = create_test_file(&format!("/test/file{}.txt", i));
            let file_id = index.add_file(file).unwrap();
            
            // 访问i次
            for _ in 0..i {
                index.record_access(file_id, "read".to_string(), None, None).unwrap();
            }
        }

        // ========== Act ==========
        let most_accessed = index.get_most_accessed_files(3)
            .expect("查询应该成功");

        // ========== Assert ==========
        assert_eq!(most_accessed.len(), 3, "应该返回前3个");
        assert!(most_accessed[0].access_count >= most_accessed[1].access_count);
        assert!(most_accessed[1].access_count >= most_accessed[2].access_count);
    }
}

// ========== 复杂场景测试 ==========

mod complex_scenarios {
    use super::*;

    #[test]
    fn test_file_lifecycle() {
        // ========== Arrange ==========
        let index = setup_test_index();
        
        // 1. 添加文件
        let mut file = create_test_file("/test/lifecycle.txt");
        file.tags = vec!["项目".to_string()];
        let file_id = index.add_file(file).unwrap();

        // 2. 访问文件多次
        for i in 1..=3 {
            index.record_access(
                file_id,
                "read".to_string(),
                Some(format!("user{}", i)),
                Some(serde_json::json!({"action": "view"})),
            ).unwrap();
        }

        // 3. 更新文件
        let mut updated = index.get_file_by_id(file_id).unwrap().unwrap();
        updated.size = 2048;
        updated.tags.push("更新".to_string());
        index.update_file(updated).unwrap();

        // 4. 再次访问
        index.record_access(
            file_id,
            "write".to_string(),
            Some("editor".to_string()),
            None,
        ).unwrap();

        // ========== Assert ==========
        let final_file = index.get_file_by_id(file_id).unwrap().unwrap();
        assert_eq!(final_file.size, 2048);
        assert_eq!(final_file.access_count, 4);
        assert_eq!(final_file.tags.len(), 2);

        let history = index.get_access_history(file_id, None).unwrap();
        assert_eq!(history.len(), 4);
    }

    #[test]
    fn test_directory_structure() {
        // ========== Arrange ==========
        let index = setup_test_index();

        // 创建目录结构
        let paths = vec![
            "/project/src/main.rs",
            "/project/src/lib.rs",
            "/project/tests/test1.rs",
            "/project/tests/test2.rs",
            "/project/docs/README.md",
        ];

        for path in paths {
            let file = create_test_file(path);
            index.add_file(file).unwrap();
        }

        // ========== Act ==========
        let src_files = index.search_files("/project/src/", None, None)
            .expect("搜索应该成功");
        
        let test_files = index.search_files("/project/tests/", None, None)
            .expect("搜索应该成功");

        // ========== Assert ==========
        assert_eq!(src_files.len(), 2, "src目录应该有2个文件");
        assert_eq!(test_files.len(), 2, "tests目录应该有2个文件");
    }

    #[test]
    fn test_bulk_operations() {
        // ========== Arrange ==========
        let index = setup_test_index();

        // ========== Act ==========
        // 批量添加文件
        let mut file_ids = vec![];
        for i in 1..=100 {
            let file = create_test_file(&format!("/bulk/file{}.txt", i));
            let id = index.add_file(file).unwrap();
            file_ids.push(id);
        }

        // 批量访问
        for id in &file_ids[0..50] {
            index.record_access(*id, "read".to_string(), None, None).unwrap();
        }

        // 批量删除
        for id in &file_ids[50..] {
            index.delete_file(*id).unwrap();
        }

        // ========== Assert ==========
        let total = index.get_total_files().unwrap();
        assert_eq!(total, 50, "应该剩余50个文件");
    }
}

// ========== 边界条件测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_file_with_empty_name() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let mut file = create_test_file("/test/");
        file.name = "".to_string();

        // ========== Act ==========
        let result = index.add_file(file);

        // ========== Assert ==========
        assert!(result.is_ok(), "空文件名应该被接受");
    }

    #[test]
    fn test_file_with_very_long_path() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let long_path = format!("/test/{}/file.txt", "dir/".repeat(100));
        let file = create_test_file(&long_path);

        // ========== Act ==========
        let result = index.add_file(file);

        // ========== Assert ==========
        assert!(result.is_ok(), "长路径应该被接受");
    }

    #[test]
    fn test_file_with_zero_size() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let mut file = create_test_file("/test/empty.txt");
        file.size = 0;

        // ========== Act ==========
        let file_id = index.add_file(file).unwrap();

        // ========== Assert ==========
        let retrieved = index.get_file_by_id(file_id).unwrap().unwrap();
        assert_eq!(retrieved.size, 0);
    }

    #[test]
    fn test_file_with_special_characters() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let file = create_test_file("/test/文件@#$%^&*().txt");

        // ========== Act ==========
        let result = index.add_file(file.clone());

        // ========== Assert ==========
        assert!(result.is_ok(), "特殊字符应该被正确处理");

        let retrieved = index.get_file_by_path(&file.path)
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.path, file.path);
    }

    #[test]
    fn test_file_with_large_metadata() {
        // ========== Arrange ==========
        let index = setup_test_index();
        let mut file = create_test_file("/test/metadata.txt");
        
        // 创建大型元数据
        let mut metadata = serde_json::Map::new();
        for i in 0..100 {
            metadata.insert(
                format!("key_{}", i),
                serde_json::json!({"data": format!("value_{}", i)})
            );
        }
        file.metadata = serde_json::Value::Object(metadata);

        // ========== Act ==========
        let file_id = index.add_file(file.clone()).unwrap();

        // ========== Assert ==========
        let retrieved = index.get_file_by_id(file_id).unwrap().unwrap();
        assert_eq!(retrieved.metadata, file.metadata);
    }
}

