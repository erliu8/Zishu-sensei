//! 系统监控模块
//! 
//! 负责监控系统资源使用情况，包括：
//! - CPU 使用率
//! - 内存使用情况
//! - 磁盘使用情况
//! - 网络使用情况
//! - 进程信息

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::{CpuExt, Disk, DiskExt, NetworkExt, ProcessExt, System, SystemExt};
use tauri::{AppHandle, Manager};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

/// 系统监控器状态
pub struct SystemMonitor {
    /// Tauri 应用句柄
    app_handle: AppHandle,
    /// 系统信息
    system: Arc<Mutex<System>>,
    /// 监控是否运行
    is_running: Arc<Mutex<bool>>,
    /// 监控统计信息
    stats: Arc<Mutex<MonitorStats>>,
    /// 上次更新时间
    last_update: Arc<Mutex<Instant>>,
}

/// 监控统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorStats {
    /// CPU 使用率历史 (最近 60 个数据点)
    pub cpu_history: Vec<f32>,
    /// 内存使用率历史 (最近 60 个数据点)
    pub memory_history: Vec<f32>,
    /// 当前 CPU 使用率
    pub cpu_usage: f32,
    /// 当前内存使用率
    pub memory_usage: f32,
    /// 总内存（字节）
    pub total_memory: u64,
    /// 已使用内存（字节）
    pub used_memory: u64,
    /// 可用内存（字节）
    pub available_memory: u64,
    /// 磁盘信息
    pub disks: Vec<DiskInfo>,
    /// 网络使用情况
    pub network: NetworkInfo,
    /// 应用进程信息
    pub app_process: Option<ProcessInfo>,
    /// 最后更新时间戳
    pub last_update: i64,
}

/// 磁盘信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    /// 磁盘名称
    pub name: String,
    /// 挂载点
    pub mount_point: String,
    /// 总容量（字节）
    pub total_space: u64,
    /// 可用空间（字节）
    pub available_space: u64,
    /// 使用率（百分比）
    pub usage_percent: f32,
    /// 文件系统类型
    pub file_system: String,
    /// 是否可移动
    pub is_removable: bool,
}

/// 网络信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    /// 总接收字节数
    pub total_received: u64,
    /// 总发送字节数
    pub total_transmitted: u64,
    /// 接收速率（字节/秒）
    pub receive_rate: u64,
    /// 发送速率（字节/秒）
    pub transmit_rate: u64,
}

/// 进程信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    /// 进程 ID
    pub pid: u32,
    /// 进程名称
    pub name: String,
    /// CPU 使用率
    pub cpu_usage: f32,
    /// 内存使用量（字节）
    pub memory: u64,
    /// 虚拟内存使用量（字节）
    pub virtual_memory: u64,
    /// 运行时间（秒）
    pub run_time: u64,
}

impl SystemMonitor {
    /// 创建新的系统监控器
    pub fn new(app_handle: AppHandle) -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        
        Self {
            app_handle,
            system: Arc::new(Mutex::new(system)),
            is_running: Arc::new(Mutex::new(false)),
            stats: Arc::new(Mutex::new(MonitorStats {
                cpu_history: Vec::new(),
                memory_history: Vec::new(),
                cpu_usage: 0.0,
                memory_usage: 0.0,
                total_memory: 0,
                used_memory: 0,
                available_memory: 0,
                disks: Vec::new(),
                network: NetworkInfo {
                    total_received: 0,
                    total_transmitted: 0,
                    receive_rate: 0,
                    transmit_rate: 0,
                },
                app_process: None,
                last_update: chrono::Utc::now().timestamp(),
            })),
            last_update: Arc::new(Mutex::new(Instant::now())),
        }
    }
    
    /// 启动监控
    pub async fn start(&self) {
        let mut is_running = self.is_running.lock();
        
        if *is_running {
            warn!("系统监控已经在运行");
            return;
        }
        
        *is_running = true;
        drop(is_running);
        
        info!("启动系统监控");
        
        // 克隆需要的引用
        let system = self.system.clone();
        let stats = self.stats.clone();
        let is_running_clone = self.is_running.clone();
        let last_update = self.last_update.clone();
        let app_handle = self.app_handle.clone();
        
        // 启动监控任务
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(2));
            let mut prev_network_rx = 0u64;
            let mut prev_network_tx = 0u64;
            
            loop {
                interval.tick().await;
                
                // 检查是否应该继续运行
                if !*is_running_clone.lock() {
                    info!("系统监控已停止");
                    break;
                }
                
                // 更新系统信息
                let mut sys = system.lock();
                sys.refresh_cpu();
                sys.refresh_memory();
                sys.refresh_disks_list();
                sys.refresh_disks();
                sys.refresh_networks();
                sys.refresh_processes();
                
                // 获取 CPU 使用率
                let cpu_usage = sys.global_cpu_info().cpu_usage();
                
                // 获取内存信息
                let total_memory = sys.total_memory();
                let used_memory = sys.used_memory();
                let available_memory = sys.available_memory();
                let memory_usage = if total_memory > 0 {
                    (used_memory as f32 / total_memory as f32) * 100.0
                } else {
                    0.0
                };
                
                // 获取磁盘信息
                let disks: Vec<DiskInfo> = sys.disks().iter().map(|disk| {
                    let total_space = disk.total_space();
                    let available_space = disk.available_space();
                    let used_space = total_space.saturating_sub(available_space);
                    let usage_percent = if total_space > 0 {
                        (used_space as f64 / total_space as f64 * 100.0) as f32
                    } else {
                        0.0
                    };
                    
                    DiskInfo {
                        name: disk.name().to_string_lossy().to_string(),
                        mount_point: disk.mount_point().to_string_lossy().to_string(),
                        total_space,
                        available_space,
                        usage_percent,
                        file_system: String::from_utf8_lossy(disk.file_system()).to_string(),
                        is_removable: disk.is_removable(),
                    }
                }).collect();
                
                // 获取网络信息
                let networks = sys.networks();
                let mut total_rx = 0u64;
                let mut total_tx = 0u64;
                
                for (_interface_name, data) in networks.iter() {
                    total_rx += data.total_received();
                    total_tx += data.total_transmitted();
                }
                
                // 计算速率（字节/秒）
                let now = Instant::now();
                let elapsed = now.duration_since(*last_update.lock()).as_secs_f64();
                let receive_rate = if elapsed > 0.0 {
                    ((total_rx.saturating_sub(prev_network_rx)) as f64 / elapsed) as u64
                } else {
                    0
                };
                let transmit_rate = if elapsed > 0.0 {
                    ((total_tx.saturating_sub(prev_network_tx)) as f64 / elapsed) as u64
                } else {
                    0
                };
                
                prev_network_rx = total_rx;
                prev_network_tx = total_tx;
                *last_update.lock() = now;
                
                let network = NetworkInfo {
                    total_received: total_rx,
                    total_transmitted: total_tx,
                    receive_rate,
                    transmit_rate,
                };
                
                // 获取当前应用进程信息
                let current_pid = std::process::id();
                let app_process = sys.process(sysinfo::Pid::from_u32(current_pid)).map(|process| {
                    ProcessInfo {
                        pid: current_pid,
                        name: process.name().to_string(),
                        cpu_usage: process.cpu_usage(),
                        memory: process.memory(),
                        virtual_memory: process.virtual_memory(),
                        run_time: process.run_time(),
                    }
                });
                
                drop(sys);
                
                // 更新统计信息
                let mut stats = stats.lock();
                
                // 保持历史数据不超过 60 个点（2 分钟的数据，每 2 秒一个点）
                stats.cpu_history.push(cpu_usage);
                if stats.cpu_history.len() > 60 {
                    stats.cpu_history.remove(0);
                }
                
                stats.memory_history.push(memory_usage);
                if stats.memory_history.len() > 60 {
                    stats.memory_history.remove(0);
                }
                
                stats.cpu_usage = cpu_usage;
                stats.memory_usage = memory_usage;
                stats.total_memory = total_memory;
                stats.used_memory = used_memory;
                stats.available_memory = available_memory;
                stats.disks = disks;
                stats.network = network;
                stats.app_process = app_process;
                stats.last_update = chrono::Utc::now().timestamp();
                
                let stats_clone = stats.clone();
                drop(stats);
                
                // 发送更新事件到前端
                if let Err(e) = app_handle.emit_all("system-monitor-update", &stats_clone) {
                    error!("发送系统监控更新事件失败: {}", e);
                }
                
                debug!(
                    "系统监控更新 - CPU: {:.2}%, 内存: {:.2}%, 网络: ↓{} ↑{}/s",
                    cpu_usage,
                    memory_usage,
                    format_bytes(stats_clone.network.receive_rate),
                    format_bytes(stats_clone.network.transmit_rate)
                );
            }
        });
    }
    
    /// 停止监控
    pub async fn stop(&self) {
        let mut is_running = self.is_running.lock();
        
        if !*is_running {
            warn!("系统监控未在运行");
            return;
        }
        
        *is_running = false;
        info!("停止系统监控");
    }
    
    /// 获取当前监控统计信息
    pub fn get_stats(&self) -> MonitorStats {
        self.stats.lock().clone()
    }
    
    /// 检查监控是否运行
    pub fn is_running(&self) -> bool {
        *self.is_running.lock()
    }
}

/// 格式化字节数
fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    if unit_index == 0 {
        format!("{} {}", size as u64, UNITS[unit_index])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

/// 启动系统监控
pub async fn start_system_monitor(
    app: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("初始化系统监控");
    
    // 创建系统监控器
    let monitor = SystemMonitor::new(app.clone());
    
    // 启动监控
    monitor.start().await;
    
    // 将监控器存储到应用状态中
    app.manage(monitor);
    
    Ok(())
}

/// 停止系统监控
pub async fn stop_system_monitor(
    app: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("停止系统监控");
    
    // 从应用状态获取监控器
    if let Some(monitor) = app.try_state::<SystemMonitor>() {
        monitor.stop().await;
    } else {
        warn!("系统监控未初始化");
    }
    
    Ok(())
}

/// 获取系统监控统计信息
pub fn get_system_monitor_stats(app: &AppHandle) -> Option<MonitorStats> {
    app.try_state::<SystemMonitor>().map(|monitor| monitor.get_stats())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(1023), "1023 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1048576), "1.00 MB");
        assert_eq!(format_bytes(1073741824), "1.00 GB");
    }
}
