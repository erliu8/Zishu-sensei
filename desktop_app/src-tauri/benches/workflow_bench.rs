// benches/workflow_bench.rs
//! 工作流性能基准测试
//! 
//! 测试表达式求值、工作流执行、并发工作流等性能

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::collections::HashMap;
use serde_json::{json, Value as JsonValue};
use regex::Regex;

/// 简单的表达式评估器（模拟）
struct SimpleExpressionEvaluator {
    variables: HashMap<String, JsonValue>,
}

impl SimpleExpressionEvaluator {
    fn new(variables: HashMap<String, JsonValue>) -> Self {
        Self { variables }
    }
    
    fn evaluate_boolean(&self, expression: &str) -> bool {
        let expr = expression.trim();
        
        // 处理简单的比较
        if expr.contains("==") {
            let parts: Vec<&str> = expr.split("==").collect();
            if parts.len() == 2 {
                let left = self.get_value(parts[0].trim());
                let right = self.get_value(parts[1].trim());
                return left == right;
            }
        }
        
        if expr.contains(">") {
            let parts: Vec<&str> = expr.split('>').collect();
            if parts.len() == 2 {
                let left = self.get_numeric_value(parts[0].trim());
                let right = self.get_numeric_value(parts[1].trim());
                return left > right;
            }
        }
        
        // 默认返回 true
        true
    }
    
    fn get_value(&self, key: &str) -> String {
        self.variables
            .get(key)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    }
    
    fn get_numeric_value(&self, key: &str) -> f64 {
        self.variables
            .get(key)
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
    }
    
    fn substitute_variables(&self, template: &str) -> String {
        let re = Regex::new(r"\{\{(\w+)\}\}").unwrap();
        let mut result = template.to_string();
        
        for cap in re.captures_iter(template) {
            if let Some(var_name) = cap.get(1) {
                if let Some(value) = self.variables.get(var_name.as_str()) {
                    let replacement = value.as_str().unwrap_or("");
                    result = result.replace(&cap[0], replacement);
                }
            }
        }
        
        result
    }
}

/// 工作流步骤模拟
#[derive(Debug, Clone)]
struct WorkflowStep {
    id: String,
    step_type: String,
    condition: Option<String>,
    input: HashMap<String, JsonValue>,
}

impl WorkflowStep {
    fn execute(&self, evaluator: &SimpleExpressionEvaluator) -> JsonValue {
        // 模拟步骤执行
        match self.step_type.as_str() {
            "api_call" => json!({"status": "success", "data": "result"}),
            "transform" => json!({"transformed": true}),
            "condition" => json!({"condition_met": true}),
            _ => json!({"executed": true}),
        }
    }
}

/// 工作流定义模拟
#[derive(Debug, Clone)]
struct Workflow {
    id: String,
    name: String,
    steps: Vec<WorkflowStep>,
}

/// 基准测试：简单表达式求值
fn bench_expression_evaluation(c: &mut Criterion) {
    let mut group = c.benchmark_group("workflow_expression_eval");
    
    // 简单比较表达式
    group.bench_function("simple_comparison", |b| {
        let mut vars = HashMap::new();
        vars.insert("count".to_string(), json!(10));
        vars.insert("threshold".to_string(), json!(5));
        let evaluator = SimpleExpressionEvaluator::new(vars);
        
        b.iter(|| {
            let result = evaluator.evaluate_boolean("count > threshold");
            black_box(result);
        });
    });
    
    // 字符串比较
    group.bench_function("string_comparison", |b| {
        let mut vars = HashMap::new();
        vars.insert("status".to_string(), json!("active"));
        vars.insert("expected".to_string(), json!("active"));
        let evaluator = SimpleExpressionEvaluator::new(vars);
        
        b.iter(|| {
            let result = evaluator.evaluate_boolean("status == expected");
            black_box(result);
        });
    });
    
    group.finish();
}

/// 基准测试：变量替换
fn bench_variable_substitution(c: &mut Criterion) {
    let mut group = c.benchmark_group("workflow_variable_substitution");
    
    // 单个变量替换
    group.bench_function("single_var", |b| {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), json!("John"));
        let evaluator = SimpleExpressionEvaluator::new(vars);
        
        b.iter(|| {
            let result = evaluator.substitute_variables("Hello, {{name}}!");
            black_box(result);
        });
    });
    
    // 多个变量替换
    group.bench_function("multiple_vars", |b| {
        let mut vars = HashMap::new();
        vars.insert("first_name".to_string(), json!("John"));
        vars.insert("last_name".to_string(), json!("Doe"));
        vars.insert("age".to_string(), json!("30"));
        let evaluator = SimpleExpressionEvaluator::new(vars);
        
        b.iter(|| {
            let result = evaluator.substitute_variables(
                "Name: {{first_name}} {{last_name}}, Age: {{age}}"
            );
            black_box(result);
        });
    });
    
    // 长文本替换
    group.bench_function("long_template", |b| {
        let mut vars = HashMap::new();
        vars.insert("user".to_string(), json!("John"));
        vars.insert("action".to_string(), json!("login"));
        vars.insert("timestamp".to_string(), json!("2024-01-01"));
        let evaluator = SimpleExpressionEvaluator::new(vars);
        
        let template = "User {{user}} performed {{action}} at {{timestamp}}. \
                       This is a longer template with more text. \
                       User: {{user}}, Action: {{action}}, Time: {{timestamp}}.";
        
        b.iter(|| {
            let result = evaluator.substitute_variables(template);
            black_box(result);
        });
    });
    
    group.finish();
}

/// 基准测试：单步骤执行
fn bench_single_step_execution(c: &mut Criterion) {
    let mut group = c.benchmark_group("workflow_single_step");
    
    let vars = HashMap::new();
    let evaluator = SimpleExpressionEvaluator::new(vars);
    
    // API调用步骤
    group.bench_function("api_call_step", |b| {
        let step = WorkflowStep {
            id: "step_1".to_string(),
            step_type: "api_call".to_string(),
            condition: None,
            input: HashMap::new(),
        };
        
        b.iter(|| {
            let result = step.execute(&evaluator);
            black_box(result);
        });
    });
    
    // 转换步骤
    group.bench_function("transform_step", |b| {
        let step = WorkflowStep {
            id: "step_2".to_string(),
            step_type: "transform".to_string(),
            condition: None,
            input: HashMap::new(),
        };
        
        b.iter(|| {
            let result = step.execute(&evaluator);
            black_box(result);
        });
    });
    
    // 条件步骤
    group.bench_function("condition_step", |b| {
        let step = WorkflowStep {
            id: "step_3".to_string(),
            step_type: "condition".to_string(),
            condition: Some("count > 5".to_string()),
            input: HashMap::new(),
        };
        
        b.iter(|| {
            let result = step.execute(&evaluator);
            black_box(result);
        });
    });
    
    group.finish();
}

/// 基准测试：完整工作流执行
fn bench_workflow_execution(c: &mut Criterion) {
    let mut group = c.benchmark_group("workflow_full_execution");
    
    // 不同步骤数量的工作流
    for step_count in [5, 10, 20, 50].iter() {
        group.throughput(Throughput::Elements(*step_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(step_count),
            step_count,
            |b, &step_count| {
                let workflow = Workflow {
                    id: "workflow_1".to_string(),
                    name: "Test Workflow".to_string(),
                    steps: (0..step_count)
                        .map(|i| WorkflowStep {
                            id: format!("step_{}", i),
                            step_type: if i % 3 == 0 {
                                "api_call".to_string()
                            } else if i % 3 == 1 {
                                "transform".to_string()
                            } else {
                                "condition".to_string()
                            },
                            condition: if i % 2 == 0 {
                                Some("count > 5".to_string())
                            } else {
                                None
                            },
                            input: HashMap::new(),
                        })
                        .collect(),
                };
                
                let mut vars = HashMap::new();
                vars.insert("count".to_string(), json!(10));
                let evaluator = SimpleExpressionEvaluator::new(vars);
                
                b.iter(|| {
                    let mut results = Vec::new();
                    for step in &workflow.steps {
                        // 检查条件
                        if let Some(condition) = &step.condition {
                            if !evaluator.evaluate_boolean(condition) {
                                continue;
                            }
                        }
                        
                        // 执行步骤
                        let result = step.execute(&evaluator);
                        results.push(result);
                    }
                    black_box(results);
                });
            },
        );
    }
    
    group.finish();
}

/// 基准测试：并发工作流模拟
fn bench_concurrent_workflows(c: &mut Criterion) {
    use std::sync::Arc;
    use std::thread;
    
    let mut group = c.benchmark_group("workflow_concurrent");
    
    for workflow_count in [2, 5, 10].iter() {
        group.throughput(Throughput::Elements(*workflow_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(workflow_count),
            workflow_count,
            |b, &workflow_count| {
                b.iter(|| {
                    let handles: Vec<_> = (0..workflow_count)
                        .map(|i| {
                            thread::spawn(move || {
                                let workflow = Workflow {
                                    id: format!("workflow_{}", i),
                                    name: format!("Workflow {}", i),
                                    steps: (0..10)
                                        .map(|j| WorkflowStep {
                                            id: format!("step_{}_{}", i, j),
                                            step_type: "api_call".to_string(),
                                            condition: None,
                                            input: HashMap::new(),
                                        })
                                        .collect(),
                                };
                                
                                let vars = HashMap::new();
                                let evaluator = SimpleExpressionEvaluator::new(vars);
                                
                                let results: Vec<_> = workflow
                                    .steps
                                    .iter()
                                    .map(|step| step.execute(&evaluator))
                                    .collect();
                                
                                results
                            })
                        })
                        .collect();
                    
                    let results: Vec<_> = handles
                        .into_iter()
                        .map(|h| h.join().unwrap())
                        .collect();
                    
                    black_box(results);
                });
            },
        );
    }
    
    group.finish();
}

/// 基准测试：JSON数据处理
fn bench_json_processing(c: &mut Criterion) {
    let mut group = c.benchmark_group("workflow_json_processing");
    
    // JSON序列化
    group.bench_function("json_serialize", |b| {
        let data = json!({
            "workflow_id": "wf_123",
            "status": "running",
            "steps": [
                {"id": "step_1", "status": "completed"},
                {"id": "step_2", "status": "running"},
                {"id": "step_3", "status": "pending"},
            ],
            "metadata": {
                "created_at": "2024-01-01",
                "updated_at": "2024-01-02",
            }
        });
        
        b.iter(|| {
            let serialized = serde_json::to_string(&data).unwrap();
            black_box(serialized);
        });
    });
    
    // JSON反序列化
    group.bench_function("json_deserialize", |b| {
        let json_str = r#"{
            "workflow_id": "wf_123",
            "status": "running",
            "steps": [
                {"id": "step_1", "status": "completed"},
                {"id": "step_2", "status": "running"},
                {"id": "step_3", "status": "pending"}
            ],
            "metadata": {
                "created_at": "2024-01-01",
                "updated_at": "2024-01-02"
            }
        }"#;
        
        b.iter(|| {
            let data: JsonValue = serde_json::from_str(json_str).unwrap();
            black_box(data);
        });
    });
    
    // JSON路径访问
    group.bench_function("json_path_access", |b| {
        let data = json!({
            "workflow": {
                "steps": [
                    {"id": "step_1", "result": {"value": 42}},
                    {"id": "step_2", "result": {"value": 100}},
                ]
            }
        });
        
        b.iter(|| {
            let value = data["workflow"]["steps"][0]["result"]["value"].as_i64();
            black_box(value);
        });
    });
    
    group.finish();
}

/// 基准测试：正则表达式匹配
fn bench_regex_matching(c: &mut Criterion) {
    let mut group = c.benchmark_group("workflow_regex");
    
    // 编译一次，多次使用
    group.bench_function("regex_match_compiled", |b| {
        let re = Regex::new(r"\{\{(\w+)\}\}").unwrap();
        let text = "Hello {{name}}, your age is {{age}}";
        
        b.iter(|| {
            let matches: Vec<_> = re.captures_iter(text).collect();
            black_box(matches);
        });
    });
    
    // 每次都编译
    group.bench_function("regex_match_compile_each_time", |b| {
        let text = "Hello {{name}}, your age is {{age}}";
        
        b.iter(|| {
            let re = Regex::new(r"\{\{(\w+)\}\}").unwrap();
            let matches: Vec<_> = re.captures_iter(text).collect();
            black_box(matches);
        });
    });
    
    // 复杂正则表达式
    group.bench_function("complex_regex", |b| {
        let re = Regex::new(
            r"^(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})T(?P<hour>\d{2}):(?P<minute>\d{2}):(?P<second>\d{2})"
        ).unwrap();
        let text = "2024-01-15T14:30:45";
        
        b.iter(|| {
            let captures = re.captures(text);
            black_box(captures);
        });
    });
    
    group.finish();
}

/// 基准测试：工作流调度
fn bench_workflow_scheduling(c: &mut Criterion) {
    let mut group = c.benchmark_group("workflow_scheduling");
    
    // 简单优先级队列
    use std::collections::BinaryHeap;
    use std::cmp::Reverse;
    
    #[derive(Eq, PartialEq, Ord, PartialOrd)]
    struct ScheduledWorkflow {
        priority: i32,
        id: String,
    }
    
    group.bench_function("priority_queue_scheduling", |b| {
        b.iter(|| {
            let mut queue = BinaryHeap::new();
            
            // 添加工作流
            for i in 0..100 {
                queue.push(Reverse(ScheduledWorkflow {
                    priority: i % 10,
                    id: format!("workflow_{}", i),
                }));
            }
            
            // 执行工作流
            let mut executed = Vec::new();
            while let Some(Reverse(workflow)) = queue.pop() {
                executed.push(workflow.id);
            }
            
            black_box(executed);
        });
    });
    
    group.finish();
}

criterion_group!(
    benches,
    bench_expression_evaluation,
    bench_variable_substitution,
    bench_single_step_execution,
    bench_workflow_execution,
    bench_concurrent_workflows,
    bench_json_processing,
    bench_regex_matching,
    bench_workflow_scheduling,
);

criterion_main!(benches);

