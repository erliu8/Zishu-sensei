use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use sysinfo::{System, SystemExt};
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

/// 启动阶段定义
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StartupPhase {
    /// 应用初始化
    AppInitialization,
    /// 数据库连接
    DatabaseConnection,
    /// 配置加载
    ConfigLoading,
    /// 主题加载
    ThemeLoading,
    /// 适配器加载
    AdapterLoading,
    /// Live2D 模型加载
    Live2DModelLoading,
    /// 窗口创建
    WindowCreation,
    /// 前端初始化
    FrontendInitialization,
    /// 系统服务启动
    SystemServices,
    /// 网络连接检查
    NetworkConnection,
    /// 完成
    Completed,
}

impl StartupPhase {
    /// 获取阶段名称
    pub fn name(&self) -> &'static str {
        match self {
            StartupPhase::AppInitialization => "应用初始化",
            StartupPhase::DatabaseConnection => "数据库连接",
            StartupPhase::ConfigLoading => "配置加载",
            StartupPhase::ThemeLoading => "主题加载",
            StartupPhase::AdapterLoading => "适配器加载",
            StartupPhase::Live2DModelLoading => "Live2D模型加载",
            StartupPhase::WindowCreation => "窗口创建",
            StartupPhase::FrontendInitialization => "前端初始化",
            StartupPhase::SystemServices => "系统服务启动",
            StartupPhase::NetworkConnection => "网络连接检查",
            StartupPhase::Completed => "启动完成",
        }
    }

    /// 获取阶段权重（用于进度计算）
    pub fn weight(&self) -> u8 {
        match self {
            StartupPhase::AppInitialization => 10,
            StartupPhase::DatabaseConnection => 15,
            StartupPhase::ConfigLoading => 8,
            StartupPhase::ThemeLoading => 5,
            StartupPhase::AdapterLoading => 12,
            StartupPhase::Live2DModelLoading => 20,
            StartupPhase::WindowCreation => 8,
            StartupPhase::FrontendInitialization => 15,
            StartupPhase::SystemServices => 5,
            StartupPhase::NetworkConnection => 2,
            StartupPhase::Completed => 0,
        }
    }

    /// 获取所有阶段的执行顺序
    pub fn all_phases() -> Vec<StartupPhase> {
        vec![
            StartupPhase::AppInitialization,
            StartupPhase::DatabaseConnection,
            StartupPhase::ConfigLoading,
            StartupPhase::ThemeLoading,
            StartupPhase::AdapterLoading,
            StartupPhase::Live2DModelLoading,
            StartupPhase::WindowCreation,
            StartupPhase::FrontendInitialization,
            StartupPhase::SystemServices,
            StartupPhase::NetworkConnection,
            StartupPhase::Completed,
        ]
    }
}

/// 阶段执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseResult {
    pub phase: StartupPhase,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub duration: Option<u64>,
    pub success: bool,
    pub error: Option<String>,
    pub memory_usage: Option<u64>,
    pub metrics: HashMap<String, f64>,
}

impl PhaseResult {
    pub fn new(phase: StartupPhase) -> Self {
        Self {
            phase,
            start_time: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            end_time: None,
            duration: None,
            success: false,
            error: None,
            memory_usage: None,
            metrics: HashMap::new(),
        }
    }

    pub fn finish_success(mut self, metrics: HashMap<String, f64>) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.end_time = Some(now);
        self.duration = Some(now - self.start_time);
        self.success = true;
        self.metrics = metrics;
        // 获取内存使用情况
        let mut sys = System::new_all();
        sys.refresh_memory();
        self.memory_usage = Some(sys.used_memory());
        self
    }

    pub fn finish_error(mut self, error: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.end_time = Some(now);
        self.duration = Some(now - self.start_time);
        self.success = false;
        self.error = Some(error);
        self
    }
}

/// 启动性能配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupConfig {
    /// 启用预加载
    pub enable_preloading: bool,
    /// 最大并行加载数
    pub max_parallel_loading: usize,
    /// 超时时间（毫秒）
    pub timeout_ms: u64,
    /// 启用性能监控
    pub enable_performance_monitoring: bool,
    /// 启用启动缓存
    pub enable_startup_cache: bool,
    /// 跳过的可选阶段
    pub skip_optional_phases: Vec<StartupPhase>,
    /// 延迟加载的阶段
    pub deferred_phases: Vec<StartupPhase>,
}

impl Default for StartupConfig {
    fn default() -> Self {
        Self {
            enable_preloading: true,
            max_parallel_loading: 4,
            timeout_ms: 30000, // 30秒
            enable_performance_monitoring: true,
            enable_startup_cache: true,
            skip_optional_phases: vec![],
            deferred_phases: vec![StartupPhase::Live2DModelLoading, StartupPhase::NetworkConnection],
        }
    }
}

/// 启动统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupStats {
    pub total_duration: u64,
    pub phase_count: usize,
    pub success_count: usize,
    pub error_count: usize,
    pub slowest_phase: Option<StartupPhase>,
    pub fastest_phase: Option<StartupPhase>,
    pub memory_peak: u64,
    pub cpu_usage_avg: f64,
    pub improvement_suggestions: Vec<String>,
}

/// 启动事件
#[derive(Debug, Clone, Serialize)]
pub struct StartupEvent {
    pub event_type: String,
    pub phase: Option<StartupPhase>,
    pub progress: f32,
    pub message: String,
    pub timestamp: u64,
    pub data: HashMap<String, serde_json::Value>,
}

/// 启动管理器
pub struct StartupManager {
    config: RwLock<StartupConfig>,
    current_phase: Mutex<Option<StartupPhase>>,
    phase_results: RwLock<HashMap<StartupPhase, PhaseResult>>,
    start_time: Instant,
    event_sender: broadcast::Sender<StartupEvent>,
    cache: Arc<Mutex<HashMap<String, serde_json::Value>>>,
}

impl StartupManager {
    /// 创建新的启动管理器
    pub fn new() -> Self {
        let (event_sender, _) = broadcast::channel(100);
        
        Self {
            config: RwLock::new(StartupConfig::default()),
            current_phase: Mutex::new(None),
            phase_results: RwLock::new(HashMap::new()),
            start_time: Instant::now(),
            event_sender,
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 获取事件接收器
    pub fn subscribe(&self) -> broadcast::Receiver<StartupEvent> {
        self.event_sender.subscribe()
    }

    /// 更新配置
    pub fn update_config(&self, config: StartupConfig) -> Result<(), String> {
        match self.config.write() {
            Ok(mut c) => {
                *c = config;
                info!("启动配置已更新");
                Ok(())
            }
            Err(e) => {
                error!("更新启动配置失败: {}", e);
                Err(format!("更新配置失败: {}", e))
            }
        }
    }

    /// 获取配置
    pub fn get_config(&self) -> Result<StartupConfig, String> {
        self.config
            .read()
            .map(|c| c.clone())
            .map_err(|e| format!("读取配置失败: {}", e))
    }

    /// 开始执行阶段
    pub async fn start_phase(&self, phase: StartupPhase) -> Result<(), String> {
        // 检查是否跳过该阶段
        if let Ok(config) = self.config.read() {
            if config.skip_optional_phases.contains(&phase) {
                self.emit_event(
                    "phase_skipped".to_string(),
                    Some(phase),
                    format!("跳过阶段: {}", phase.name()),
                )?;
                return Ok(());
            }
        }

        // 更新当前阶段
        *self.current_phase.lock().map_err(|e| e.to_string())? = Some(phase);

        // 创建阶段结果
        let phase_result = PhaseResult::new(phase);
        self.phase_results
            .write()
            .map_err(|e| e.to_string())?
            .insert(phase, phase_result);

        // 发送阶段开始事件
        self.emit_event(
            "phase_started".to_string(),
            Some(phase),
            format!("开始执行阶段: {}", phase.name()),
        )?;

        info!("启动阶段开始: {}", phase.name());
        Ok(())
    }

    /// 完成阶段（成功）
    pub async fn finish_phase_success(
        &self,
        phase: StartupPhase,
        metrics: HashMap<String, f64>,
    ) -> Result<(), String> {
        let mut results = self.phase_results.write().map_err(|e| e.to_string())?;
        
        if let Some(result) = results.remove(&phase) {
            let finished_result = result.finish_success(metrics);
            results.insert(phase, finished_result.clone());

            info!(
                "启动阶段完成: {} (耗时: {}ms)",
                phase.name(),
                finished_result.duration.unwrap_or(0)
            );

            // 发送阶段完成事件
            let progress = self.calculate_progress();
            self.emit_event_with_progress(
                "phase_completed".to_string(),
                Some(phase),
                format!("阶段完成: {}", phase.name()),
                progress,
            )?;

            // 检查是否所有阶段都完成
            if progress >= 1.0 {
                self.on_startup_completed().await?;
            }
        }

        Ok(())
    }

    /// 完成阶段（失败）
    pub async fn finish_phase_error(&self, phase: StartupPhase, error: String) -> Result<(), String> {
        let mut results = self.phase_results.write().map_err(|e| e.to_string())?;
        
        if let Some(result) = results.remove(&phase) {
            let finished_result = result.finish_error(error.clone());
            results.insert(phase, finished_result);

            error!("启动阶段失败: {} - {}", phase.name(), error);

            // 发送阶段错误事件
            self.emit_event(
                "phase_error".to_string(),
                Some(phase),
                format!("阶段失败: {} - {}", phase.name(), error),
            )?;
        }

        Ok(())
    }

    /// 计算启动进度
    pub fn calculate_progress(&self) -> f32 {
        let results = match self.phase_results.read() {
            Ok(r) => r,
            Err(_) => return 0.0,
        };

        let all_phases = StartupPhase::all_phases();
        let total_weight: u32 = all_phases.iter().map(|p| p.weight() as u32).sum();
        
        let completed_weight: u32 = results
            .iter()
            .filter(|(_, result)| result.success && result.end_time.is_some())
            .map(|(phase, _)| phase.weight() as u32)
            .sum();

        if total_weight == 0 {
            0.0
        } else {
            completed_weight as f32 / total_weight as f32
        }
    }

    /// 获取启动统计信息
    pub fn get_stats(&self) -> Result<StartupStats, String> {
        let results = self.phase_results.read().map_err(|e| e.to_string())?;
        
        let total_duration = self.start_time.elapsed().as_millis() as u64;
        let phase_count = results.len();
        let success_count = results.values().filter(|r| r.success).count();
        let error_count = results.values().filter(|r| !r.success).count();

        // 找出最慢和最快的阶段
        let mut slowest_phase = None;
        let mut fastest_phase = None;
        let mut max_duration = 0u64;
        let mut min_duration = u64::MAX;

        for (phase, result) in results.iter() {
            if let Some(duration) = result.duration {
                if duration > max_duration {
                    max_duration = duration;
                    slowest_phase = Some(*phase);
                }
                if duration < min_duration {
                    min_duration = duration;
                    fastest_phase = Some(*phase);
                }
            }
        }

        // 获取内存峰值
        let memory_peak = results
            .values()
            .filter_map(|r| r.memory_usage)
            .max()
            .unwrap_or(0);

        // 生成优化建议
        let improvement_suggestions = self.generate_suggestions(&results);

        Ok(StartupStats {
            total_duration,
            phase_count,
            success_count,
            error_count,
            slowest_phase,
            fastest_phase,
            memory_peak,
            cpu_usage_avg: 0.0, // TODO: 实现 CPU 监控
            improvement_suggestions,
        })
    }

    /// 获取缓存值
    pub fn get_cache(&self, key: &str) -> Result<Option<serde_json::Value>, String> {
        self.cache
            .lock()
            .map_err(|e| e.to_string())
            .map(|cache| cache.get(key).cloned())
    }

    /// 设置缓存值
    pub fn set_cache(&self, key: String, value: serde_json::Value) -> Result<(), String> {
        self.cache
            .lock()
            .map_err(|e| e.to_string())
            .map(|mut cache| {
                cache.insert(key, value);
            })
    }

    /// 清除缓存
    pub fn clear_cache(&self) -> Result<(), String> {
        self.cache
            .lock()
            .map_err(|e| e.to_string())
            .map(|mut cache| cache.clear())
    }

    /// 发送事件
    fn emit_event(
        &self,
        event_type: String,
        phase: Option<StartupPhase>,
        message: String,
    ) -> Result<(), String> {
        let progress = self.calculate_progress();
        self.emit_event_with_progress(event_type, phase, message, progress)
    }

    /// 发送事件（带进度）
    fn emit_event_with_progress(
        &self,
        event_type: String,
        phase: Option<StartupPhase>,
        message: String,
        progress: f32,
    ) -> Result<(), String> {
        let event = StartupEvent {
            event_type,
            phase,
            progress,
            message,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            data: HashMap::new(),
        };

        if let Err(e) = self.event_sender.send(event) {
            warn!("发送启动事件失败: {}", e);
        }

        Ok(())
    }

    /// 启动完成回调
    async fn on_startup_completed(&self) -> Result<(), String> {
        info!("应用启动完成");

        // 发送启动完成事件
        self.emit_event(
            "startup_completed".to_string(),
            Some(StartupPhase::Completed),
            "应用启动完成".to_string(),
        )?;

        // 记录启动统计信息
        if let Ok(stats) = self.get_stats() {
            info!(
                "启动统计: 总耗时{}ms, 成功{}个阶段, 失败{}个阶段",
                stats.total_duration, stats.success_count, stats.error_count
            );
        }

        Ok(())
    }

    /// 生成优化建议
    fn generate_suggestions(&self, results: &HashMap<StartupPhase, PhaseResult>) -> Vec<String> {
        let mut suggestions = Vec::new();

        // 分析慢启动阶段
        for (phase, result) in results.iter() {
            if let Some(duration) = result.duration {
                match phase {
                    StartupPhase::Live2DModelLoading if duration > 3000 => {
                        suggestions.push("Live2D模型加载较慢，建议启用模型预缓存或选择较小的模型".to_string());
                    }
                    StartupPhase::DatabaseConnection if duration > 1000 => {
                        suggestions.push("数据库连接较慢，建议优化数据库配置或使用连接池".to_string());
                    }
                    StartupPhase::AdapterLoading if duration > 2000 => {
                        suggestions.push("适配器加载较慢，建议启用延迟加载或减少启动时加载的适配器".to_string());
                    }
                    StartupPhase::FrontendInitialization if duration > 2000 => {
                        suggestions.push("前端初始化较慢，建议启用代码分割和组件懒加载".to_string());
                    }
                    _ => {}
                }
            }
        }

        // 内存使用建议
        let max_memory = results
            .values()
            .filter_map(|r| r.memory_usage)
            .max()
            .unwrap_or(0);
        
        if max_memory > 1024 * 1024 * 1024 { // 1GB
            suggestions.push("启动时内存使用较高，建议启用内存优化和资源懒加载".to_string());
        }

        // 失败阶段建议
        let failed_phases: Vec<_> = results
            .iter()
            .filter(|(_, result)| !result.success)
            .map(|(phase, _)| phase)
            .collect();
        
        if !failed_phases.is_empty() {
            suggestions.push("存在启动失败的阶段，建议检查相关配置和依赖".to_string());
        }

        // 默认建议
        if suggestions.is_empty() {
            suggestions.push("启动性能良好，可以考虑进一步启用预加载功能来提升用户体验".to_string());
        }

        suggestions
    }

    /// 重置启动管理器
    pub fn reset(&self) -> Result<(), String> {
        self.phase_results
            .write()
            .map_err(|e| e.to_string())?
            .clear();
        
        *self.current_phase.lock().map_err(|e| e.to_string())? = None;
        
        self.clear_cache()?;
        
        info!("启动管理器已重置");
        Ok(())
    }
}

/// 全局启动管理器实例
lazy_static::lazy_static! {
    pub static ref STARTUP_MANAGER: StartupManager = StartupManager::new();
}
