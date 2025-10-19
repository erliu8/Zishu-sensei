//! # 工作流表达式引擎
//! 
//! 提供条件表达式评估、变量替换、数据转换等功能

use anyhow::{Result, anyhow};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use regex::Regex;

/// 表达式评估器
pub struct ExpressionEvaluator {
    /// 变量上下文
    variables: HashMap<String, JsonValue>,
}

impl ExpressionEvaluator {
    /// 创建新的表达式评估器
    pub fn new(variables: HashMap<String, JsonValue>) -> Self {
        Self { variables }
    }

    /// 评估布尔表达式
    pub fn evaluate_boolean(&self, expression: &str) -> Result<bool> {
        let expr = expression.trim();

        // 处理空表达式
        if expr.is_empty() {
            return Ok(true);
        }

        // 处理逻辑运算符
        if expr.contains("||") {
            return self.evaluate_or(expr);
        }

        if expr.contains("&&") {
            return self.evaluate_and(expr);
        }

        // 处理取反
        if expr.starts_with('!') {
            let inner = &expr[1..].trim();
            return Ok(!self.evaluate_boolean(inner)?);
        }

        // 处理比较运算符
        if expr.contains("==") {
            return self.evaluate_equals(expr);
        }

        if expr.contains("!=") {
            return self.evaluate_not_equals(expr);
        }

        if expr.contains(">=") {
            return self.evaluate_greater_or_equals(expr);
        }

        if expr.contains("<=") {
            return self.evaluate_less_or_equals(expr);
        }

        if expr.contains('>') {
            return self.evaluate_greater(expr);
        }

        if expr.contains('<') {
            return self.evaluate_less(expr);
        }

        // 处理变量引用
        if let Some(value) = self.get_variable_value(expr) {
            return self.value_to_bool(&value);
        }

        // 处理字面量
        match expr.to_lowercase().as_str() {
            "true" => Ok(true),
            "false" => Ok(false),
            _ => Err(anyhow!("无法评估表达式: {}", expr)),
        }
    }

    /// 评估OR运算
    fn evaluate_or(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split("||").collect();
        for part in parts {
            if self.evaluate_boolean(part.trim())? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// 评估AND运算
    fn evaluate_and(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split("&&").collect();
        for part in parts {
            if !self.evaluate_boolean(part.trim())? {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// 评估等于运算
    fn evaluate_equals(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split("==").collect();
        if parts.len() != 2 {
            return Err(anyhow!("无效的比较表达式: {}", expr));
        }

        let left = self.evaluate_value(parts[0].trim())?;
        let right = self.evaluate_value(parts[1].trim())?;

        Ok(self.values_equal(&left, &right))
    }

    /// 评估不等于运算
    fn evaluate_not_equals(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split("!=").collect();
        if parts.len() != 2 {
            return Err(anyhow!("无效的比较表达式: {}", expr));
        }

        let left = self.evaluate_value(parts[0].trim())?;
        let right = self.evaluate_value(parts[1].trim())?;

        Ok(!self.values_equal(&left, &right))
    }

    /// 评估大于运算
    fn evaluate_greater(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split('>').collect();
        if parts.len() != 2 {
            return Err(anyhow!("无效的比较表达式: {}", expr));
        }

        let left = self.evaluate_number(parts[0].trim())?;
        let right = self.evaluate_number(parts[1].trim())?;

        Ok(left > right)
    }

    /// 评估小于运算
    fn evaluate_less(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split('<').collect();
        if parts.len() != 2 {
            return Err(anyhow!("无效的比较表达式: {}", expr));
        }

        let left = self.evaluate_number(parts[0].trim())?;
        let right = self.evaluate_number(parts[1].trim())?;

        Ok(left < right)
    }

    /// 评估大于等于运算
    fn evaluate_greater_or_equals(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split(">=").collect();
        if parts.len() != 2 {
            return Err(anyhow!("无效的比较表达式: {}", expr));
        }

        let left = self.evaluate_number(parts[0].trim())?;
        let right = self.evaluate_number(parts[1].trim())?;

        Ok(left >= right)
    }

    /// 评估小于等于运算
    fn evaluate_less_or_equals(&self, expr: &str) -> Result<bool> {
        let parts: Vec<&str> = expr.split("<=").collect();
        if parts.len() != 2 {
            return Err(anyhow!("无效的比较表达式: {}", expr));
        }

        let left = self.evaluate_number(parts[0].trim())?;
        let right = self.evaluate_number(parts[1].trim())?;

        Ok(left <= right)
    }

    /// 评估值
    fn evaluate_value(&self, expr: &str) -> Result<JsonValue> {
        let expr = expr.trim();

        // 字符串字面量
        if (expr.starts_with('"') && expr.ends_with('"')) 
            || (expr.starts_with('\'') && expr.ends_with('\'')) {
            let s = &expr[1..expr.len()-1];
            return Ok(JsonValue::String(s.to_string()));
        }

        // 数字字面量
        if let Ok(n) = expr.parse::<i64>() {
            return Ok(JsonValue::Number(n.into()));
        }

        if let Ok(n) = expr.parse::<f64>() {
            if let Some(num) = serde_json::Number::from_f64(n) {
                return Ok(JsonValue::Number(num));
            }
        }

        // 布尔字面量
        match expr.to_lowercase().as_str() {
            "true" => return Ok(JsonValue::Bool(true)),
            "false" => return Ok(JsonValue::Bool(false)),
            "null" => return Ok(JsonValue::Null),
            _ => {}
        }

        // 变量引用
        if let Some(value) = self.get_variable_value(expr) {
            return Ok(value);
        }

        Err(anyhow!("无法评估值: {}", expr))
    }

    /// 评估数字
    fn evaluate_number(&self, expr: &str) -> Result<f64> {
        let value = self.evaluate_value(expr)?;
        match value {
            JsonValue::Number(n) => {
                if let Some(f) = n.as_f64() {
                    Ok(f)
                } else if let Some(i) = n.as_i64() {
                    Ok(i as f64)
                } else {
                    Err(anyhow!("无效的数字: {:?}", n))
                }
            }
            _ => Err(anyhow!("不是数字类型: {:?}", value)),
        }
    }

    /// 获取变量值
    fn get_variable_value(&self, name: &str) -> Option<JsonValue> {
        // 支持点号路径访问，如 user.name
        let parts: Vec<&str> = name.split('.').collect();
        let mut current = self.variables.get(parts[0])?;

        for part in &parts[1..] {
            current = current.get(part)?;
        }

        Some(current.clone())
    }

    /// 比较两个值是否相等
    fn values_equal(&self, left: &JsonValue, right: &JsonValue) -> bool {
        match (left, right) {
            (JsonValue::String(a), JsonValue::String(b)) => a == b,
            (JsonValue::Number(a), JsonValue::Number(b)) => {
                a.as_f64() == b.as_f64()
            }
            (JsonValue::Bool(a), JsonValue::Bool(b)) => a == b,
            (JsonValue::Null, JsonValue::Null) => true,
            _ => false,
        }
    }

    /// 将值转换为布尔值
    fn value_to_bool(&self, value: &JsonValue) -> Result<bool> {
        match value {
            JsonValue::Bool(b) => Ok(*b),
            JsonValue::Null => Ok(false),
            JsonValue::Number(n) => {
                if let Some(i) = n.as_i64() {
                    Ok(i != 0)
                } else if let Some(f) = n.as_f64() {
                    Ok(f != 0.0)
                } else {
                    Ok(false)
                }
            }
            JsonValue::String(s) => {
                Ok(!s.is_empty() && s.to_lowercase() != "false")
            }
            JsonValue::Array(a) => Ok(!a.is_empty()),
            JsonValue::Object(o) => Ok(!o.is_empty()),
        }
    }

    /// 替换字符串中的变量
    pub fn replace_variables(&self, template: &str) -> String {
        let re = Regex::new(r"\{\{([^}]+)\}\}").unwrap();
        
        re.replace_all(template, |caps: &regex::Captures| {
            let var_name = caps[1].trim();
            
            if let Some(value) = self.get_variable_value(var_name) {
                match value {
                    JsonValue::String(s) => s,
                    JsonValue::Number(n) => n.to_string(),
                    JsonValue::Bool(b) => b.to_string(),
                    JsonValue::Null => "null".to_string(),
                    _ => value.to_string(),
                }
            } else {
                format!("{{{{{}}}}}", var_name) // 保留原样
            }
        }).to_string()
    }

    /// 设置变量
    pub fn set_variable(&mut self, name: String, value: JsonValue) {
        self.variables.insert(name, value);
    }

    /// 获取所有变量
    pub fn get_variables(&self) -> &HashMap<String, JsonValue> {
        &self.variables
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_boolean_literals() {
        let evaluator = ExpressionEvaluator::new(HashMap::new());
        assert_eq!(evaluator.evaluate_boolean("true").unwrap(), true);
        assert_eq!(evaluator.evaluate_boolean("false").unwrap(), false);
    }

    #[test]
    fn test_comparison_operators() {
        let evaluator = ExpressionEvaluator::new(HashMap::new());
        assert_eq!(evaluator.evaluate_boolean("5 > 3").unwrap(), true);
        assert_eq!(evaluator.evaluate_boolean("5 < 3").unwrap(), false);
        assert_eq!(evaluator.evaluate_boolean("5 >= 5").unwrap(), true);
        assert_eq!(evaluator.evaluate_boolean("5 <= 4").unwrap(), false);
        assert_eq!(evaluator.evaluate_boolean("5 == 5").unwrap(), true);
        assert_eq!(evaluator.evaluate_boolean("5 != 3").unwrap(), true);
    }

    #[test]
    fn test_logical_operators() {
        let evaluator = ExpressionEvaluator::new(HashMap::new());
        assert_eq!(evaluator.evaluate_boolean("true && true").unwrap(), true);
        assert_eq!(evaluator.evaluate_boolean("true && false").unwrap(), false);
        assert_eq!(evaluator.evaluate_boolean("true || false").unwrap(), true);
        assert_eq!(evaluator.evaluate_boolean("false || false").unwrap(), false);
    }

    #[test]
    fn test_negation() {
        let evaluator = ExpressionEvaluator::new(HashMap::new());
        assert_eq!(evaluator.evaluate_boolean("!true").unwrap(), false);
        assert_eq!(evaluator.evaluate_boolean("!false").unwrap(), true);
    }

    #[test]
    fn test_variable_access() {
        let mut vars = HashMap::new();
        vars.insert("count".to_string(), JsonValue::Number(10.into()));
        vars.insert("name".to_string(), JsonValue::String("test".to_string()));
        
        let evaluator = ExpressionEvaluator::new(vars);
        assert_eq!(evaluator.evaluate_boolean("count > 5").unwrap(), true);
        assert_eq!(evaluator.evaluate_boolean("name == \"test\"").unwrap(), true);
    }

    #[test]
    fn test_replace_variables() {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), JsonValue::String("World".to_string()));
        vars.insert("count".to_string(), JsonValue::Number(42.into()));
        
        let evaluator = ExpressionEvaluator::new(vars);
        let result = evaluator.replace_variables("Hello {{name}}! Count: {{count}}");
        assert_eq!(result, "Hello World! Count: 42");
    }
}

