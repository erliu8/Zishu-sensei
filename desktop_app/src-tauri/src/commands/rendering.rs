/**
 * 渲染性能监控命令
 * 
 * 提供渲染性能统计、分析和优化建议
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

// ============================================================================
// 类型定义
// ============================================================================

/// 渲染性能记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderRecord {
    pub component_name: String,
    pub render_time: f64,
    pub commit_time: f64,
    pub timestamp: u64,
    pub is_initial_render: bool,
    pub reason: Option<String>,
}

/// 渲染性能统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderStats {
    pub total_renders: usize,
    pub average_render_time: f64,
    pub max_render_time: f64,
    pub min_render_time: f64,
    pub slow_render_count: usize,
    pub component_stats: HashMap<String, ComponentStats>,
}

/// 组件渲染统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentStats {
    pub render_count: usize,
    pub total_time: f64,
    pub average_time: f64,
    pub max_time: f64,
    pub min_time: f64,
}

/// WebGL 性能统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebGLPerformanceStats {
    pub draw_calls: usize,
    pub triangles: usize,
    pub texture_count: usize,
    pub texture_memory: usize,
    pub frame_time: f64,
    pub fps: f64,
}

/// 帧性能记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameRecord {
    pub timestamp: u64,
    pub frame_time: f64,
    pub fps: f64,
    pub draw_calls: usize,
}

/// 性能优化建议
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestion {
    pub severity: String, // "info", "warning", "critical"
    pub category: String, // "render", "memory", "animation", "webgl"
    pub message: String,
    pub component: Option<String>,
    pub suggestion: String,
}

// ============================================================================
// 状态管理
// ============================================================================

/// 渲染性能监控状态
pub struct RenderingState {
    /// 渲染记录
    render_records: Vec<RenderRecord>,
    /// 帧记录
    frame_records: Vec<FrameRecord>,
    /// WebGL 统计
    webgl_stats: Option<WebGLPerformanceStats>,
    /// 最大记录数
    max_records: usize,
    /// 慢渲染阈值（毫秒）
    slow_render_threshold: f64,
}

impl Default for RenderingState {
    fn default() -> Self {
        Self {
            render_records: Vec::new(),
            frame_records: Vec::new(),
            webgl_stats: None,
            max_records: 1000,
            slow_render_threshold: 16.0, // 60fps
        }
    }
}

impl RenderingState {
    /// 添加渲染记录
    fn add_render_record(&mut self, record: RenderRecord) {
        self.render_records.push(record);
        // 限制记录数量
        if self.render_records.len() > self.max_records {
            self.render_records.drain(0..100); // 删除前100条
        }
    }

    /// 添加帧记录
    fn add_frame_record(&mut self, record: FrameRecord) {
        self.frame_records.push(record);
        // 限制记录数量
        if self.frame_records.len() > self.max_records {
            self.frame_records.drain(0..100);
        }
    }

    /// 计算渲染统计
    fn calculate_stats(&self) -> RenderStats {
        if self.render_records.is_empty() {
            return RenderStats {
                total_renders: 0,
                average_render_time: 0.0,
                max_render_time: 0.0,
                min_render_time: 0.0,
                slow_render_count: 0,
                component_stats: HashMap::new(),
            };
        }

        let mut total_time = 0.0;
        let mut max_time = f64::MIN;
        let mut min_time = f64::MAX;
        let mut slow_count = 0;
        let mut component_map: HashMap<String, Vec<f64>> = HashMap::new();

        for record in &self.render_records {
            let render_time = record.render_time;
            total_time += render_time;
            max_time = max_time.max(render_time);
            min_time = min_time.min(render_time);

            if render_time > self.slow_render_threshold {
                slow_count += 1;
            }

            component_map
                .entry(record.component_name.clone())
                .or_insert_with(Vec::new)
                .push(render_time);
        }

        let component_stats = component_map
            .into_iter()
            .map(|(name, times)| {
                let count = times.len();
                let total: f64 = times.iter().sum();
                let avg = total / count as f64;
                let max = times.iter().cloned().fold(f64::MIN, f64::max);
                let min = times.iter().cloned().fold(f64::MAX, f64::min);

                (
                    name,
                    ComponentStats {
                        render_count: count,
                        total_time: total,
                        average_time: avg,
                        max_time: max,
                        min_time: min,
                    },
                )
            })
            .collect();

        RenderStats {
            total_renders: self.render_records.len(),
            average_render_time: total_time / self.render_records.len() as f64,
            max_render_time: max_time,
            min_render_time: min_time,
            slow_render_count: slow_count,
            component_stats,
        }
    }

    /// 生成优化建议
    fn generate_suggestions(&self) -> Vec<OptimizationSuggestion> {
        let mut suggestions = Vec::new();
        let stats = self.calculate_stats();

        // 检查整体性能
        if stats.average_render_time > self.slow_render_threshold {
            suggestions.push(OptimizationSuggestion {
                severity: "critical".to_string(),
                category: "render".to_string(),
                message: format!(
                    "平均渲染时间 {:.2}ms 超过 60fps 阈值（16ms）",
                    stats.average_render_time
                ),
                component: None,
                suggestion: "考虑使用 React.memo、useMemo 或 useCallback 优化组件".to_string(),
            });
        }

        // 检查慢渲染比例
        let slow_ratio = stats.slow_render_count as f64 / stats.total_renders as f64;
        if slow_ratio > 0.1 {
            suggestions.push(OptimizationSuggestion {
                severity: "warning".to_string(),
                category: "render".to_string(),
                message: format!("{:.1}% 的渲染超过 16ms", slow_ratio * 100.0),
                component: None,
                suggestion: "分析慢渲染组件，考虑使用虚拟化或懒加载".to_string(),
            });
        }

        // 检查组件性能
        for (component, comp_stats) in &stats.component_stats {
            // 检查渲染次数
            if comp_stats.render_count > 50 {
                suggestions.push(OptimizationSuggestion {
                    severity: "warning".to_string(),
                    category: "render".to_string(),
                    message: format!("组件 {} 渲染次数过多（{}次）", component, comp_stats.render_count),
                    component: Some(component.clone()),
                    suggestion: "检查是否有不必要的重渲染，使用 React DevTools Profiler 分析".to_string(),
                });
            }

            // 检查平均渲染时间
            if comp_stats.average_time > self.slow_render_threshold {
                suggestions.push(OptimizationSuggestion {
                    severity: "critical".to_string(),
                    category: "render".to_string(),
                    message: format!(
                        "组件 {} 平均渲染时间过长（{:.2}ms）",
                        component, comp_stats.average_time
                    ),
                    component: Some(component.clone()),
                    suggestion: "优化组件逻辑，减少计算量，考虑使用 Web Workers".to_string(),
                });
            }
        }

        // 检查 WebGL 性能
        if let Some(webgl) = &self.webgl_stats {
            if webgl.draw_calls > 1000 {
                suggestions.push(OptimizationSuggestion {
                    severity: "warning".to_string(),
                    category: "webgl".to_string(),
                    message: format!("WebGL 绘制调用次数过多（{}次）", webgl.draw_calls),
                    component: None,
                    suggestion: "考虑批量渲染，减少绘制调用次数".to_string(),
                });
            }

            if webgl.texture_memory > 100_000_000 {
                // 100MB
                suggestions.push(OptimizationSuggestion {
                    severity: "critical".to_string(),
                    category: "webgl".to_string(),
                    message: format!(
                        "纹理内存使用过高（{:.2}MB）",
                        webgl.texture_memory as f64 / 1_000_000.0
                    ),
                    component: None,
                    suggestion: "启用纹理压缩，清理未使用的纹理".to_string(),
                });
            }

            if webgl.fps < 30.0 {
                suggestions.push(OptimizationSuggestion {
                    severity: "critical".to_string(),
                    category: "webgl".to_string(),
                    message: format!("帧率过低（{:.1} FPS）", webgl.fps),
                    component: None,
                    suggestion: "降低渲染复杂度，使用 LOD，优化着色器".to_string(),
                });
            }
        }

        // 检查帧时间稳定性
        if self.frame_records.len() > 10 {
            let recent_frames: Vec<f64> = self.frame_records
                .iter()
                .rev()
                .take(60)
                .map(|f| f.frame_time)
                .collect();

            let avg_frame_time: f64 = recent_frames.iter().sum::<f64>() / recent_frames.len() as f64;
            let variance: f64 = recent_frames
                .iter()
                .map(|&x| {
                    let diff = x - avg_frame_time;
                    diff * diff
                })
                .sum::<f64>()
                / recent_frames.len() as f64;
            let std_dev = variance.sqrt();

            if std_dev > 5.0 {
                suggestions.push(OptimizationSuggestion {
                    severity: "warning".to_string(),
                    category: "animation".to_string(),
                    message: format!("帧时间波动较大（标准差 {:.2}ms）", std_dev),
                    component: None,
                    suggestion: "检查是否有阻塞主线程的操作，考虑使用节流".to_string(),
                });
            }
        }

        suggestions
    }

    /// 清空记录
    fn clear(&mut self) {
        self.render_records.clear();
        self.frame_records.clear();
        self.webgl_stats = None;
    }
}

// ============================================================================
// Tauri 命令
// ============================================================================

/// 记录组件渲染性能
#[tauri::command]
pub fn record_render_performance(
    component_name: String,
    render_time: f64,
    commit_time: f64,
    is_initial_render: bool,
    reason: Option<String>,
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    let record = RenderRecord {
        component_name,
        render_time,
        commit_time,
        timestamp,
        is_initial_render,
        reason,
    };

    state
        .lock()
        .map_err(|e| e.to_string())?
        .add_render_record(record);

    Ok(())
}

/// 记录帧性能
#[tauri::command]
pub fn record_frame_performance(
    frame_time: f64,
    fps: f64,
    draw_calls: usize,
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    let record = FrameRecord {
        timestamp,
        frame_time,
        fps,
        draw_calls,
    };

    state
        .lock()
        .map_err(|e| e.to_string())?
        .add_frame_record(record);

    Ok(())
}

/// 更新 WebGL 性能统计
#[tauri::command]
pub fn update_webgl_stats(
    draw_calls: usize,
    triangles: usize,
    texture_count: usize,
    texture_memory: usize,
    frame_time: f64,
    fps: f64,
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<(), String> {
    let stats = WebGLPerformanceStats {
        draw_calls,
        triangles,
        texture_count,
        texture_memory,
        frame_time,
        fps,
    };

    state.lock().map_err(|e| e.to_string())?.webgl_stats = Some(stats);

    Ok(())
}

/// 获取渲染性能统计
#[tauri::command]
pub fn get_render_stats(state: State<'_, Arc<Mutex<RenderingState>>>) -> Result<RenderStats, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.calculate_stats())
}

/// 获取优化建议
#[tauri::command]
pub fn get_optimization_suggestions(
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<Vec<OptimizationSuggestion>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.generate_suggestions())
}

/// 获取渲染记录
#[tauri::command]
pub fn get_render_records(
    limit: Option<usize>,
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<Vec<RenderRecord>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);

    Ok(state
        .render_records
        .iter()
        .rev()
        .take(limit)
        .cloned()
        .collect())
}

/// 获取帧记录
#[tauri::command]
pub fn get_frame_records(
    limit: Option<usize>,
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<Vec<FrameRecord>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);

    Ok(state
        .frame_records
        .iter()
        .rev()
        .take(limit)
        .cloned()
        .collect())
}

/// 获取 WebGL 统计
#[tauri::command]
pub fn get_webgl_stats(
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<Option<WebGLPerformanceStats>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.webgl_stats.clone())
}

/// 清空性能记录
#[tauri::command]
pub fn clear_render_records(state: State<'_, Arc<Mutex<RenderingState>>>) -> Result<(), String> {
    state.lock().map_err(|e| e.to_string())?.clear();
    Ok(())
}

/// 设置慢渲染阈值
#[tauri::command]
pub fn set_slow_render_threshold(
    threshold: f64,
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<(), String> {
    state
        .lock()
        .map_err(|e| e.to_string())?
        .slow_render_threshold = threshold;
    Ok(())
}

/// 设置最大记录数
#[tauri::command]
pub fn set_max_records(
    max_records: usize,
    state: State<'_, Arc<Mutex<RenderingState>>>,
) -> Result<(), String> {
    state.lock().map_err(|e| e.to_string())?.max_records = max_records;
    Ok(())
}

