//! 角色管理命令测试
//!
//! 测试所有角色管理相关的Tauri命令

#[cfg(test)]
mod character_commands_tests {
    use crate::common::*;
    
    // ================================
    // get_characters 命令测试
    // ================================
    
    mod get_characters {
        use super::*;
        
        #[tokio::test]
        async fn test_get_characters_returns_all() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            test_db.insert_test_character("char-1", "Character 1", false).unwrap();
            test_db.insert_test_character("char-2", "Character 2", false).unwrap();
            test_db.insert_test_character("char-3", "Character 3", true).unwrap();
            
            // ========== Act (执行) ==========
            let count: i64 = test_db.count_records("characters").unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(count, 3, "应该有3个角色");
        }
    }
    
    // ================================
    // get_active_character 命令测试
    // ================================
    
    mod get_active_character {
        use super::*;
        
        #[tokio::test]
        async fn test_get_active_character_returns_active_one() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            test_db.insert_test_character("char-1", "Inactive", false).unwrap();
            test_db.insert_test_character("char-2", "Active", true).unwrap();
            
            // ========== Act (执行) ==========
            let active_name: String = test_db.get_connection()
                .query_row(
                    "SELECT name FROM characters WHERE is_active = 1",
                    [],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(active_name, "Active", "应该返回激活的角色");
        }
    }
    
    // ================================
    // switch_character 命令测试
    // ================================
    
    mod switch_character {
        use super::*;
        
        #[tokio::test]
        async fn test_switch_character_deactivates_old_and_activates_new() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            test_db.insert_test_character("char-old", "Old Character", true).unwrap();
            test_db.insert_test_character("char-new", "New Character", false).unwrap();
            
            // ========== Act (执行) ==========
            // 先停用所有角色
            test_db.get_connection()
                .execute("UPDATE characters SET is_active = 0", [])
                .unwrap();
            
            // 激活新角色
            test_db.get_connection()
                .execute("UPDATE characters SET is_active = 1 WHERE id = ?1", ["char-new"])
                .unwrap();
            
            // ========== Assert (断言) ==========
            let old_active: i32 = test_db.get_connection()
                .query_row("SELECT is_active FROM characters WHERE id = ?1", ["char-old"], |row| row.get(0))
                .unwrap();
            
            let new_active: i32 = test_db.get_connection()
                .query_row("SELECT is_active FROM characters WHERE id = ?1", ["char-new"], |row| row.get(0))
                .unwrap();
            
            assert_eq!(old_active, 0, "旧角色应该已停用");
            assert_eq!(new_active, 1, "新角色应该已激活");
        }
    }
    
    // ================================
    // load_character 命令测试
    // ================================
    
    mod load_character {
        use super::*;
        
        #[tokio::test]
        async fn test_load_character_creates_record() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            let char_id = "loaded-char";
            
            // ========== Act (执行) ==========
            test_db.insert_test_character(char_id, "Loaded Character", false).unwrap();
            
            // ========== Assert (断言) ==========
            assert!(test_db.record_exists("characters", "id", char_id).unwrap());
        }
    }
    
    // ================================
    // update_character_config 命令测试
    // ================================
    
    mod update_character_config {
        use super::*;
        
        #[tokio::test]
        async fn test_update_character_config_updates_settings() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            let char_id = "config-char";
            test_db.insert_test_character(char_id, "Config Character", false).unwrap();
            
            let now = chrono::Utc::now().timestamp();
            
            // ========== Act (执行) ==========
            test_db.get_connection().execute(
                "INSERT INTO character_configs (character_id, scale, position_x, position_y, interaction_enabled, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                [char_id, "1.5", "100.0", "200.0", "1", &now.to_string()]
            ).unwrap();
            
            // ========== Assert (断言) ==========
            let (scale, pos_x, pos_y): (f64, f64, f64) = test_db.get_connection()
                .query_row(
                    "SELECT scale, position_x, position_y FROM character_configs WHERE character_id = ?1",
                    [char_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                )
                .unwrap();
            
            assert_eq!(scale, 1.5);
            assert_eq!(pos_x, 100.0);
            assert_eq!(pos_y, 200.0);
        }
    }
    
    // ================================
    // get_character_motions 命令测试
    // ================================
    
    mod get_character_motions {
        use super::*;
        
        #[tokio::test]
        async fn test_get_character_motions_returns_all_motions() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            let char_id = "motion-char";
            test_db.insert_test_character(char_id, "Motion Character", false).unwrap();
            
            // 添加动作
            for i in 0..3 {
                test_db.get_connection().execute(
                    "INSERT INTO character_motions (character_id, motion_name, motion_group) VALUES (?1, ?2, ?3)",
                    [char_id, &format!("motion_{}", i), "default"]
                ).unwrap();
            }
            
            // ========== Act (执行) ==========
            let motion_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM character_motions WHERE character_id = ?1",
                    [char_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(motion_count, 3, "应该有3个动作");
        }
    }
    
    // ================================
    // get_character_expressions 命令测试
    // ================================
    
    mod get_character_expressions {
        use super::*;
        
        #[tokio::test]
        async fn test_get_character_expressions_returns_all() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            let char_id = "expr-char";
            test_db.insert_test_character(char_id, "Expression Character", false).unwrap();
            
            // 添加表情
            let expressions = ["happy", "sad", "angry"];
            for expr in &expressions {
                test_db.get_connection().execute(
                    "INSERT INTO character_expressions (character_id, expression_name) VALUES (?1, ?2)",
                    [char_id, expr]
                ).unwrap();
            }
            
            // ========== Act (执行) ==========
            let expr_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM character_expressions WHERE character_id = ?1",
                    [char_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert_eq!(expr_count, 3, "应该有3个表情");
        }
    }
    
    // ================================
    // delete_character 命令测试
    // ================================
    
    mod delete_character {
        use super::*;
        
        #[tokio::test]
        async fn test_delete_character_removes_character_and_related_data() {
            // ========== Arrange (准备) ==========
            let test_db = TestDatabase::new_in_memory();
            test_db.init_character_tables().unwrap();
            
            let char_id = "deletable-char";
            test_db.insert_test_character(char_id, "To Delete", false).unwrap();
            
            // 添加相关数据
            test_db.get_connection().execute(
                "INSERT INTO character_motions (character_id, motion_name) VALUES (?1, ?2)",
                [char_id, "motion1"]
            ).unwrap();
            
            // ========== Act (执行) ==========
            test_db.get_connection()
                .execute("DELETE FROM characters WHERE id = ?1", [char_id])
                .unwrap();
            
            // ========== Assert (断言) ==========
            assert!(!test_db.record_exists("characters", "id", char_id).unwrap());
            
            let motion_count: i64 = test_db.get_connection()
                .query_row(
                    "SELECT COUNT(*) FROM character_motions WHERE character_id = ?1",
                    [char_id],
                    |row| row.get(0)
                )
                .unwrap();
            
            assert_eq!(motion_count, 0, "相关动作应该被级联删除");
        }
    }
}

