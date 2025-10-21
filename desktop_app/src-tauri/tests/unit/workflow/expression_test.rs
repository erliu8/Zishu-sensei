//! # 表达式评估器测试
//!
//! 测试工作流表达式评估、变量替换等功能

use zishu_sensei::workflow::expression::ExpressionEvaluator;
use serde_json::json;
use std::collections::HashMap;

// ================================
// 布尔字面量测试
// ================================

#[test]
fn test_evaluate_boolean_true_literal() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    assert_eq!(evaluator.evaluate_boolean("true").unwrap(), true);
}

#[test]
fn test_evaluate_boolean_false_literal() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    assert_eq!(evaluator.evaluate_boolean("false").unwrap(), false);
}

#[test]
fn test_evaluate_boolean_empty_string_returns_true() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    assert_eq!(evaluator.evaluate_boolean("").unwrap(), true);
}

// ================================
// 比较运算符测试
// ================================

#[test]
fn test_evaluate_greater_than_with_numbers() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("5 > 3").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("3 > 5").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("5 > 5").unwrap(), false);
}

#[test]
fn test_evaluate_less_than_with_numbers() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("3 < 5").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("5 < 3").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("5 < 5").unwrap(), false);
}

#[test]
fn test_evaluate_greater_or_equals() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("5 >= 5").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("6 >= 5").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("4 >= 5").unwrap(), false);
}

#[test]
fn test_evaluate_less_or_equals() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("5 <= 5").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("4 <= 5").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("6 <= 5").unwrap(), false);
}

#[test]
fn test_evaluate_equals_with_numbers() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("5 == 5").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("5 == 3").unwrap(), false);
}

#[test]
fn test_evaluate_equals_with_strings() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("\"hello\" == \"hello\"").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("\"hello\" == \"world\"").unwrap(), false);
}

#[test]
fn test_evaluate_not_equals() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("5 != 3").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("5 != 5").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("\"a\" != \"b\"").unwrap(), true);
}

// ================================
// 逻辑运算符测试
// ================================

#[test]
fn test_evaluate_and_operator() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("true && true").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("true && false").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("false && true").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("false && false").unwrap(), false);
}

#[test]
fn test_evaluate_or_operator() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("true || true").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("true || false").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("false || true").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("false || false").unwrap(), false);
}

#[test]
fn test_evaluate_complex_and_or_expression() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    // (true || false) && true = true
    assert_eq!(evaluator.evaluate_boolean("true || false && true").unwrap(), true);
}

#[test]
fn test_evaluate_negation() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("!true").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("!false").unwrap(), true);
}

#[test]
fn test_evaluate_negation_with_expression() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("!(5 > 3)").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("!(3 > 5)").unwrap(), true);
}

// ================================
// 变量引用测试
// ================================

#[test]
fn test_evaluate_variable_number() {
    let mut vars = HashMap::new();
    vars.insert("count".to_string(), json!(10));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    assert_eq!(evaluator.evaluate_boolean("count > 5").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("count < 5").unwrap(), false);
    assert_eq!(evaluator.evaluate_boolean("count == 10").unwrap(), true);
}

#[test]
fn test_evaluate_variable_string() {
    let mut vars = HashMap::new();
    vars.insert("name".to_string(), json!("test"));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    assert_eq!(evaluator.evaluate_boolean("name == \"test\"").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("name == \"other\"").unwrap(), false);
}

#[test]
fn test_evaluate_variable_boolean() {
    let mut vars = HashMap::new();
    vars.insert("enabled".to_string(), json!(true));
    vars.insert("disabled".to_string(), json!(false));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    assert_eq!(evaluator.evaluate_boolean("enabled").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("disabled").unwrap(), false);
}

#[test]
fn test_evaluate_nested_object_property() {
    let mut vars = HashMap::new();
    vars.insert("user".to_string(), json!({
        "name": "Alice",
        "age": 30
    }));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    assert_eq!(evaluator.evaluate_boolean("user.age > 25").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("user.name == \"Alice\"").unwrap(), true);
}

// ================================
// 变量替换测试
// ================================

#[test]
fn test_replace_variables_with_simple_variable() {
    let mut vars = HashMap::new();
    vars.insert("name".to_string(), json!("World"));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    let result = evaluator.replace_variables("Hello {{name}}!");
    assert_eq!(result, "Hello World!");
}

#[test]
fn test_replace_variables_with_multiple_variables() {
    let mut vars = HashMap::new();
    vars.insert("name".to_string(), json!("World"));
    vars.insert("count".to_string(), json!(42));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    let result = evaluator.replace_variables("Hello {{name}}! Count: {{count}}");
    assert_eq!(result, "Hello World! Count: 42");
}

#[test]
fn test_replace_variables_with_number() {
    let mut vars = HashMap::new();
    vars.insert("age".to_string(), json!(25));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    let result = evaluator.replace_variables("Age is {{age}}");
    assert_eq!(result, "Age is 25");
}

#[test]
fn test_replace_variables_with_boolean() {
    let mut vars = HashMap::new();
    vars.insert("enabled".to_string(), json!(true));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    let result = evaluator.replace_variables("Enabled: {{enabled}}");
    assert_eq!(result, "Enabled: true");
}

#[test]
fn test_replace_variables_with_undefined_variable() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    let result = evaluator.replace_variables("Hello {{undefined}}!");
    // 未定义的变量应保留原样
    assert_eq!(result, "Hello {{undefined}}!");
}

#[test]
fn test_replace_variables_with_nested_property() {
    let mut vars = HashMap::new();
    vars.insert("user".to_string(), json!({
        "name": "Alice",
        "age": 30
    }));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    let result = evaluator.replace_variables("User: {{user.name}}, Age: {{user.age}}");
    assert_eq!(result, "User: Alice, Age: 30");
}

#[test]
fn test_replace_variables_with_no_variables() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    let result = evaluator.replace_variables("No variables here");
    assert_eq!(result, "No variables here");
}

// ================================
// 复杂表达式测试
// ================================

#[test]
fn test_evaluate_complex_expression_with_variables() {
    let mut vars = HashMap::new();
    vars.insert("a".to_string(), json!(10));
    vars.insert("b".to_string(), json!(20));
    vars.insert("c".to_string(), json!(true));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    // a < b && c
    assert_eq!(evaluator.evaluate_boolean("a < b && c").unwrap(), true);
    
    // a > b || c
    assert_eq!(evaluator.evaluate_boolean("a > b || c").unwrap(), true);
    
    // !(a > b) && c
    assert_eq!(evaluator.evaluate_boolean("!(a > b) && c").unwrap(), true);
}

#[test]
fn test_evaluate_expression_with_mixed_types() {
    let mut vars = HashMap::new();
    vars.insert("count".to_string(), json!(0));
    vars.insert("name".to_string(), json!(""));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    // 零应该被评估为false
    assert_eq!(evaluator.evaluate_boolean("count == 0").unwrap(), true);
    
    // 空字符串与false比较
    assert_eq!(evaluator.evaluate_boolean("name == \"\"").unwrap(), true);
}

// ================================
// 边界情况测试
// ================================

#[test]
fn test_evaluate_with_whitespace() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    // 带有额外空格的表达式
    assert_eq!(evaluator.evaluate_boolean("  true  ").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean(" 5  >  3 ").unwrap(), true);
}

#[test]
fn test_evaluate_floating_point_numbers() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("5.5 > 5.0").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("3.14 < 3.15").unwrap(), true);
}

#[test]
fn test_evaluate_single_quotes_in_string() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("'hello' == 'hello'").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("'hello' == 'world'").unwrap(), false);
}

#[test]
fn test_evaluate_null_comparison() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    assert_eq!(evaluator.evaluate_boolean("null == null").unwrap(), true);
}

#[test]
fn test_evaluate_null_variable() {
    let mut vars = HashMap::new();
    vars.insert("value".to_string(), json!(null));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    assert_eq!(evaluator.evaluate_boolean("value == null").unwrap(), true);
}

// ================================
// 错误处理测试
// ================================

#[test]
fn test_evaluate_invalid_expression_returns_error() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    let result = evaluator.evaluate_boolean("invalid expression @@");
    assert!(result.is_err());
}

#[test]
fn test_evaluate_undefined_variable_in_comparison_returns_error() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    let result = evaluator.evaluate_boolean("undefined_var > 5");
    assert!(result.is_err());
}

#[test]
fn test_evaluate_invalid_comparison_returns_error() {
    let evaluator = ExpressionEvaluator::new(HashMap::new());
    
    // 比较字符串和数字
    let result = evaluator.evaluate_boolean("\"text\" > 5");
    assert!(result.is_err());
}

// ================================
// Set Variable 测试
// ================================

#[test]
fn test_set_variable() {
    let mut evaluator = ExpressionEvaluator::new(HashMap::new());
    
    evaluator.set_variable("test".to_string(), json!(42));
    
    assert_eq!(evaluator.evaluate_boolean("test == 42").unwrap(), true);
}

#[test]
fn test_get_variables() {
    let mut vars = HashMap::new();
    vars.insert("a".to_string(), json!(1));
    vars.insert("b".to_string(), json!(2));
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    let variables = evaluator.get_variables();
    assert_eq!(variables.len(), 2);
    assert_eq!(variables.get("a").unwrap(), &json!(1));
    assert_eq!(variables.get("b").unwrap(), &json!(2));
}

// ================================
// 性能测试
// ================================

#[test]
fn test_evaluate_many_variables() {
    let mut vars = HashMap::new();
    for i in 0..100 {
        vars.insert(format!("var{}", i), json!(i));
    }
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    assert_eq!(evaluator.evaluate_boolean("var50 > 25").unwrap(), true);
    assert_eq!(evaluator.evaluate_boolean("var99 == 99").unwrap(), true);
}

#[test]
fn test_replace_many_variables() {
    let mut vars = HashMap::new();
    for i in 0..10 {
        vars.insert(format!("var{}", i), json!(i));
    }
    
    let evaluator = ExpressionEvaluator::new(vars);
    
    let template = "{{var0}} {{var1}} {{var2}} {{var3}} {{var4}}";
    let result = evaluator.replace_variables(template);
    assert_eq!(result, "0 1 2 3 4");
}

