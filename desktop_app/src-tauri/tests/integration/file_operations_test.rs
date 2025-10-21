//! 文件操作集成测试
//!
//! 测试文件的创建、读取、写入、删除以及权限检查的完整流程

use crate::common::*;
use std::fs;
use serde_json::json;

// ========================================
// 文件操作测试
// ========================================

/// 测试完整的文件操作流程
/// 流程: 创建文件 → 写入内容 → 读取内容 → 更新内容 → 删除文件
#[tokio::test]
async fn test_complete_file_operations() {
    // ========== Arrange (准备) ==========
    let (_temp_dir, file_path) = create_temp_file_with_content("");
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 写入内容
    let content = "Hello, Zishu Sensei! This is a test file.";
    fs::write(&file_path, content).unwrap();
    
    // 验证文件存在
    assert!(file_path.exists());
    
    // 2. 读取内容
    let read_content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(read_content, content);
    
    // 3. 追加内容
    let additional_content = "\nThis is additional content.";
    let mut full_content = String::from(content);
    full_content.push_str(additional_content);
    fs::write(&file_path, &full_content).unwrap();
    
    // 验证追加成功
    let updated_content = fs::read_to_string(&file_path).unwrap();
    assert_eq!(updated_content, full_content);
    assert!(updated_content.contains("additional content"));
    
    // 4. 获取文件元数据
    let metadata = fs::metadata(&file_path).unwrap();
    assert!(metadata.is_file());
    assert_eq!(metadata.len(), full_content.len() as u64);
    
    // 5. 删除文件
    fs::remove_file(&file_path).unwrap();
    assert!(!file_path.exists());
    
    // ========== Cleanup (清理) ==========
    // TempDir 自动清理
}

/// 测试多个文件的批量操作
#[tokio::test]
async fn test_batch_file_operations() {
    // ========== Arrange (准备) ==========
    let temp_dir = create_temp_dir();
    let file_count = 10;
    
    // ========== Act (执行) ==========
    
    // 创建多个文件
    for i in 0..file_count {
        let file_path = temp_dir.path().join(format!("test_{}.txt", i));
        fs::write(&file_path, format!("Content of file {}", i)).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 验证所有文件都已创建
    for i in 0..file_count {
        let file_path = temp_dir.path().join(format!("test_{}.txt", i));
        assert!(file_path.exists());
        
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, format!("Content of file {}", i));
    }
    
    // 批量读取
    let mut contents = Vec::new();
    for i in 0..file_count {
        let file_path = temp_dir.path().join(format!("test_{}.txt", i));
        let content = fs::read_to_string(&file_path).unwrap();
        contents.push(content);
    }
    assert_eq!(contents.len(), file_count);
    
    // 批量删除
    for i in 0..file_count {
        let file_path = temp_dir.path().join(format!("test_{}.txt", i));
        fs::remove_file(&file_path).unwrap();
    }
    
    // 验证所有文件都已删除
    for i in 0..file_count {
        let file_path = temp_dir.path().join(format!("test_{}.txt", i));
        assert!(!file_path.exists());
    }
    
    // ========== Cleanup (清理) ==========
    // TempDir 自动清理
}

/// 测试文件权限和访问控制
#[tokio::test]
async fn test_file_permissions_and_access_control() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_file_tables().unwrap();
    test_db.init_permission_tables().unwrap();
    
    let file_id = unique_test_id("file");
    let file_path = "/test/sensitive_data.txt";
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 创建文件元数据
    conn.execute(
        "INSERT INTO file_metadata (id, path, name, size, mime_type, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            &file_id,
            file_path,
            "sensitive_data.txt",
            1024,
            "text/plain",
            now,
            now
        ]
    ).unwrap();
    
    // 2. 设置文件权限
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, granted_at, description)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            format!("file:{}", file_id),
            "read",
            1,
            now,
            "Read permission for sensitive file"
        ]
    ).unwrap();
    
    conn.execute(
        "INSERT INTO permissions (resource, action, granted, description)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            format!("file:{}", file_id),
            "write",
            0,
            "Write permission (not granted)"
        ]
    ).unwrap();
    
    // 3. 检查读权限
    let can_read: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = 'read'",
        &[format!("file:{}", file_id)],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(can_read, 1);
    
    // 4. 检查写权限
    let can_write: i32 = conn.query_row(
        "SELECT granted FROM permissions WHERE resource = ?1 AND action = 'write'",
        &[format!("file:{}", file_id)],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(can_write, 0);
    
    // 5. 记录文件访问
    if can_read == 1 {
        conn.execute(
            "INSERT INTO file_access_log (file_id, operation, accessed_at)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![&file_id, "read", now + 1]
        ).unwrap();
    }
    
    // 6. 验证访问日志
    let access_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM file_access_log WHERE file_id = ?1",
        &[&file_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(access_count, 1);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试目录操作
#[tokio::test]
async fn test_directory_operations() {
    // ========== Arrange (准备) ==========
    let temp_dir = create_temp_dir();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 创建子目录
    let sub_dir = temp_dir.path().join("subdir");
    fs::create_dir(&sub_dir).unwrap();
    assert!(sub_dir.exists());
    assert!(sub_dir.is_dir());
    
    // 2. 创建嵌套目录
    let nested_dir = temp_dir.path().join("level1/level2/level3");
    fs::create_dir_all(&nested_dir).unwrap();
    assert!(nested_dir.exists());
    
    // 3. 在目录中创建文件
    let file_in_dir = sub_dir.join("test.txt");
    fs::write(&file_in_dir, "File in subdirectory").unwrap();
    assert!(file_in_dir.exists());
    
    // 4. 列出目录内容
    let entries: Vec<_> = fs::read_dir(&sub_dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    assert_eq!(entries.len(), 1);
    
    // 5. 删除文件
    fs::remove_file(&file_in_dir).unwrap();
    assert!(!file_in_dir.exists());
    
    // 6. 删除空目录
    fs::remove_dir(&sub_dir).unwrap();
    assert!(!sub_dir.exists());
    
    // 7. 递归删除非空目录
    let file_in_nested = nested_dir.join("file.txt");
    fs::write(&file_in_nested, "content").unwrap();
    
    fs::remove_dir_all(temp_dir.path().join("level1")).unwrap();
    assert!(!nested_dir.exists());
    
    // ========== Cleanup (清理) ==========
    // TempDir 自动清理
}

/// 测试大文件操作
#[tokio::test]
async fn test_large_file_operations() {
    // ========== Arrange (准备) ==========
    let temp_dir = create_temp_dir();
    let file_path = temp_dir.path().join("large_file.txt");
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 生成 1MB 的数据
    let large_content = generate_large_text(1024); // 1MB
    
    // 测量写入时间
    let (_, write_duration) = measure_time(|| {
        fs::write(&file_path, &large_content).unwrap();
    });
    
    println!("Write 1MB took: {:?}", write_duration);
    assert!(file_path.exists());
    
    // 验证文件大小
    let metadata = fs::metadata(&file_path).unwrap();
    assert!(metadata.len() >= 1024 * 1024); // 至少 1MB
    
    // 测量读取时间
    let (read_content, read_duration) = measure_time(|| {
        fs::read_to_string(&file_path).unwrap()
    });
    
    println!("Read 1MB took: {:?}", read_duration);
    assert_eq!(read_content.len(), large_content.len());
    
    // 删除大文件
    fs::remove_file(&file_path).unwrap();
    
    // ========== Cleanup (清理) ==========
    // TempDir 自动清理
}

/// 测试文件元数据管理
#[tokio::test]
async fn test_file_metadata_management() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_file_tables().unwrap();
    
    let (_temp_dir, file_path) = create_temp_file_with_content("Test file content");
    let file_id = unique_test_id("file");
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 获取实际文件信息
    let metadata = fs::metadata(&file_path).unwrap();
    let file_size = metadata.len();
    
    // 1. 存储文件元数据
    conn.execute(
        "INSERT INTO file_metadata (id, path, name, size, mime_type, checksum, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            &file_id,
            file_path.to_str().unwrap(),
            file_path.file_name().unwrap().to_str().unwrap(),
            file_size as i64,
            "text/plain",
            "sha256:abc123def456", // 模拟的校验和
            now,
            now
        ]
    ).unwrap();
    
    // 2. 查询文件元数据
    let (stored_path, stored_size, mime_type, checksum): (String, i64, String, String) = conn.query_row(
        "SELECT path, size, mime_type, checksum FROM file_metadata WHERE id = ?1",
        &[&file_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    ).unwrap();
    
    assert_eq!(stored_path, file_path.to_str().unwrap());
    assert_eq!(stored_size, file_size as i64);
    assert_eq!(mime_type, "text/plain");
    assert_eq!(checksum, "sha256:abc123def456");
    
    // 3. 更新文件元数据（模拟文件修改）
    let new_content = "Updated file content with more text";
    fs::write(&file_path, new_content).unwrap();
    
    let new_metadata = fs::metadata(&file_path).unwrap();
    let new_size = new_metadata.len();
    
    conn.execute(
        "UPDATE file_metadata SET size = ?1, checksum = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![
            new_size as i64,
            "sha256:new_checksum_789",
            now + 1,
            &file_id
        ]
    ).unwrap();
    
    // 验证更新
    let updated_size: i64 = conn.query_row(
        "SELECT size FROM file_metadata WHERE id = ?1",
        &[&file_id],
        |row| row.get(0)
    ).unwrap();
    
    assert_eq!(updated_size, new_size as i64);
    
    // 4. 删除文件和元数据
    fs::remove_file(&file_path).unwrap();
    
    conn.execute(
        "DELETE FROM file_metadata WHERE id = ?1",
        &[&file_id]
    ).unwrap();
    
    // 验证删除
    assert!(!file_path.exists());
    assert!(!test_db.record_exists("file_metadata", "id", &file_id).unwrap());
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试文件访问日志
#[tokio::test]
async fn test_file_access_logging() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_file_tables().unwrap();
    
    let file_id = unique_test_id("file");
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 创建文件元数据
    conn.execute(
        "INSERT INTO file_metadata (id, path, name, size, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &file_id,
            "/test/logged_file.txt",
            "logged_file.txt",
            100,
            now,
            now
        ]
    ).unwrap();
    
    // ========== Act (执行) ==========
    
    // 记录多次访问
    let operations = vec![
        ("read", now + 1),
        ("read", now + 2),
        ("write", now + 3),
        ("read", now + 4),
        ("delete", now + 5),
    ];
    
    for (operation, timestamp) in &operations {
        conn.execute(
            "INSERT INTO file_access_log (file_id, operation, accessed_at)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![&file_id, operation, timestamp]
        ).unwrap();
    }
    
    // ========== Assert (断言) ==========
    
    // 统计总访问次数
    let total_access: i64 = conn.query_row(
        "SELECT COUNT(*) FROM file_access_log WHERE file_id = ?1",
        &[&file_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(total_access, 5);
    
    // 统计读操作次数
    let read_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM file_access_log WHERE file_id = ?1 AND operation = 'read'",
        &[&file_id],
        |row| row.get(0)
    ).unwrap();
    assert_eq!(read_count, 3);
    
    // 查询最后一次访问
    let (last_op, last_time): (String, i64) = conn.query_row(
        "SELECT operation, accessed_at FROM file_access_log 
         WHERE file_id = ?1 
         ORDER BY accessed_at DESC 
         LIMIT 1",
        &[&file_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap();
    
    assert_eq!(last_op, "delete");
    assert_eq!(last_time, now + 5);
    
    // 查询访问历史
    let mut stmt = conn.prepare(
        "SELECT operation, accessed_at FROM file_access_log 
         WHERE file_id = ?1 
         ORDER BY accessed_at ASC"
    ).unwrap();
    
    let history: Vec<(String, i64)> = stmt.query_map(&[&file_id], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert_eq!(history.len(), 5);
    assert_eq!(history[0].0, "read");
    assert_eq!(history[4].0, "delete");
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试文件搜索和过滤
#[tokio::test]
async fn test_file_search_and_filtering() {
    // ========== Arrange (准备) ==========
    let test_db = TestDatabase::new_in_memory();
    test_db.init_file_tables().unwrap();
    
    let conn = test_db.get_connection();
    let now = chrono::Utc::now().timestamp();
    
    // 创建多个文件元数据
    let files = vec![
        ("file-1", "/documents/report.pdf", "report.pdf", 1024000, "application/pdf"),
        ("file-2", "/documents/image.png", "image.png", 512000, "image/png"),
        ("file-3", "/documents/data.txt", "data.txt", 2048, "text/plain"),
        ("file-4", "/videos/movie.mp4", "movie.mp4", 104857600, "video/mp4"),
        ("file-5", "/documents/notes.txt", "notes.txt", 4096, "text/plain"),
    ];
    
    for (id, path, name, size, mime_type) in &files {
        conn.execute(
            "INSERT INTO file_metadata (id, path, name, size, mime_type, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, path, name, size, mime_type, now, now]
        ).unwrap();
    }
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 1. 按MIME类型搜索文本文件
    let mut stmt = conn.prepare(
        "SELECT name FROM file_metadata WHERE mime_type = 'text/plain' ORDER BY name"
    ).unwrap();
    
    let text_files: Vec<String> = stmt.query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    
    assert_eq!(text_files.len(), 2);
    assert_eq!(text_files[0], "data.txt");
    assert_eq!(text_files[1], "notes.txt");
    
    // 2. 按路径前缀搜索
    let mut stmt = conn.prepare(
        "SELECT name FROM file_metadata WHERE path LIKE '/documents/%' ORDER BY name"
    ).unwrap();
    
    let doc_files: Vec<String> = stmt.query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    
    assert_eq!(doc_files.len(), 4);
    
    // 3. 按大小范围搜索（小于 10KB）
    let mut stmt = conn.prepare(
        "SELECT name FROM file_metadata WHERE size < 10240 ORDER BY size"
    ).unwrap();
    
    let small_files: Vec<String> = stmt.query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    
    assert_eq!(small_files.len(), 2);
    
    // 4. 组合条件搜索
    let mut stmt = conn.prepare(
        "SELECT name FROM file_metadata 
         WHERE path LIKE '/documents/%' AND mime_type LIKE 'text/%'
         ORDER BY name"
    ).unwrap();
    
    let filtered_files: Vec<String> = stmt.query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    
    assert_eq!(filtered_files.len(), 2);
    
    // 5. 统计不同类型文件的数量
    let mut stmt = conn.prepare(
        "SELECT mime_type, COUNT(*) as count FROM file_metadata 
         GROUP BY mime_type 
         ORDER BY count DESC"
    ).unwrap();
    
    let type_counts: Vec<(String, i64)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
    
    assert!(type_counts.len() >= 1);
    
    // ========== Cleanup (清理) ==========
    test_db.clear_all_data().unwrap();
}

/// 测试二进制文件操作
#[tokio::test]
async fn test_binary_file_operations() {
    // ========== Arrange (准备) ==========
    let temp_dir = create_temp_dir();
    let file_path = temp_dir.path().join("binary_data.bin");
    
    // ========== Act & Assert (执行和验证) ==========
    
    // 生成随机二进制数据
    let binary_data = generate_binary_data(1024); // 1KB
    
    // 写入二进制数据
    fs::write(&file_path, &binary_data).unwrap();
    assert!(file_path.exists());
    
    // 读取二进制数据
    let read_data = fs::read(&file_path).unwrap();
    assert_eq!(read_data.len(), binary_data.len());
    assert_eq!(read_data, binary_data);
    
    // 验证文件大小
    let metadata = fs::metadata(&file_path).unwrap();
    assert_eq!(metadata.len(), 1024);
    
    // 追加二进制数据
    let additional_data = generate_binary_data(512);
    let mut combined_data = binary_data.clone();
    combined_data.extend_from_slice(&additional_data);
    
    fs::write(&file_path, &combined_data).unwrap();
    
    // 验证追加后的数据
    let final_data = fs::read(&file_path).unwrap();
    assert_eq!(final_data.len(), 1024 + 512);
    assert_eq!(final_data, combined_data);
    
    // 删除文件
    fs::remove_file(&file_path).unwrap();
    assert!(!file_path.exists());
    
    // ========== Cleanup (清理) ==========
    // TempDir 自动清理
}

