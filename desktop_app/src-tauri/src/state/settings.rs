//! # 设置状态管理模块
//! 
//! 管理应用的各种设置和偏好，包括用户界面设置、系统设置、隐私设置等

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::{Mutex, RwLock};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 设置状态管理器
pub struct SettingsState {
    /// 用户界面设置
    ui_settings: Arc<Mutex<UiSettings>>,
    /// 系统设置
    system_settings: Arc<Mutex<SystemSettings>>,
    /// 隐私设置
    privacy_settings: Arc<Mutex<PrivacySettings>>,
    /// 通知设置
    notification_settings: Arc<Mutex<NotificationSettings>>,
    /// 高级设置
    advanced_settings: Arc<Mutex<AdvancedSettings>>,
    /// 设置更改监听器
    change_listeners: Arc<RwLock<HashMap<String, Box<dyn Fn(&SettingChangeEvent) + Send + Sync>>>>,
    /// 设置历史记录
    change_history: Arc<Mutex<Vec<SettingChangeRecord>>>,
    /// 自定义设置
    custom_settings: Arc<RwLock<HashMap<String, SettingValue>>>,
}

/// 用户界面设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UiSettings {
    /// 主题名称
    pub theme: String,
    /// 语言设置
    pub language: String,
    /// 字体大小
    pub font_size: u16,
    /// 字体系列
    pub font_family: String,
    /// 界面缩放比例
    pub ui_scale: f64,
    /// 是否启用动画
    pub animations_enabled: bool,
    /// 动画速度 (0.1-3.0)
    pub animation_speed: f64,
    /// 是否启用声音效果
    pub sound_effects: bool,
    /// 界面透明度 (0.0-1.0)
    pub transparency: f64,
    /// 是否显示高级选项
    pub show_advanced_options: bool,
    /// 自定义CSS
    pub custom_css: Option<String>,
    /// 窗口装饰
    pub window_decorations: bool,
    /// 总是置顶
    pub always_on_top: bool,
}

/// 系统设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SystemSettings {
    /// 开机自启动
    pub auto_start: bool,
    /// 最小化到托盘
    pub minimize_to_tray: bool,
    /// 关闭到托盘
    pub close_to_tray: bool,
    /// 启动时最小化
    pub start_minimized: bool,
    /// 检查更新频率（小时）
    pub update_check_interval: u32,
    /// 自动安装更新
    pub auto_install_updates: bool,
    /// 启用硬件加速
    pub hardware_acceleration: bool,
    /// 系统代理设置
    pub proxy_settings: ProxySettings,
    /// 日志级别
    pub log_level: LogLevel,
    /// 数据目录
    pub data_directory: String,
    /// 备份设置
    pub backup_settings: BackupSettings,
}

/// 隐私设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PrivacySettings {
    /// 是否收集使用数据
    pub collect_usage_data: bool,
    /// 是否收集崩溃报告
    pub collect_crash_reports: bool,
    /// 是否启用遥测
    pub enable_telemetry: bool,
    /// 数据保留天数
    pub data_retention_days: u32,
    /// 是否加密本地数据
    pub encrypt_local_data: bool,
    /// 隐私模式
    pub privacy_mode: PrivacyMode,
    /// 匿名化设置
    pub anonymization_settings: AnonymizationSettings,
    /// 访问控制
    pub access_control: AccessControl,
}

/// 通知设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotificationSettings {
    /// 是否启用通知
    pub enabled: bool,
    /// 是否显示桌面通知
    pub desktop_notifications: bool,
    /// 是否播放通知声音
    pub notification_sound: bool,
    /// 通知音量 (0.0-1.0)
    pub notification_volume: f64,
    /// 通知显示时间（秒）
    pub notification_duration: u32,
    /// 通知位置
    pub notification_position: NotificationPosition,
    /// 免打扰模式
    pub do_not_disturb: bool,
    /// 免打扰时间段
    pub do_not_disturb_schedule: Option<TimeRange>,
    /// 应用特定通知设置
    pub app_notifications: HashMap<String, AppNotificationSettings>,
}

/// 高级设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AdvancedSettings {
    /// 调试模式
    pub debug_mode: bool,
    /// 性能监控
    pub performance_monitoring: bool,
    /// 内存限制（MB）
    pub memory_limit: Option<u32>,
    /// CPU限制（百分比）
    pub cpu_limit: Option<u8>,
    /// 网络超时（秒）
    pub network_timeout: u32,
    /// 并发连接数
    pub max_concurrent_connections: u32,
    /// 缓存大小（MB）
    pub cache_size: u32,
    /// 实验性功能
    pub experimental_features: HashMap<String, bool>,
    /// 开发者选项
    pub developer_options: DeveloperOptions,
}

/// 代理设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProxySettings {
    /// 是否启用代理
    pub enabled: bool,
    /// 代理类型
    pub proxy_type: ProxyType,
    /// 代理服务器地址
    pub host: String,
    /// 代理端口
    pub port: u16,
    /// 用户名
    pub username: Option<String>,
    /// 密码
    pub password: Option<String>,
    /// 排除列表
    pub exclude_list: Vec<String>,
}

/// 备份设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BackupSettings {
    /// 是否启用自动备份
    pub enabled: bool,
    /// 备份间隔（小时）
    pub interval_hours: u32,
    /// 保留备份数量
    pub max_backups: u32,
    /// 备份目录
    pub backup_directory: String,
    /// 压缩备份文件
    pub compress_backups: bool,
    /// 备份到云端
    pub cloud_backup: bool,
    /// 云端备份设置
    pub cloud_settings: CloudBackupSettings,
}

/// 匿名化设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnonymizationSettings {
    /// 匿名化用户ID
    pub anonymize_user_id: bool,
    /// 匿名化IP地址
    pub anonymize_ip_addresses: bool,
    /// 匿名化设备信息
    pub anonymize_device_info: bool,
    /// 数据脱敏级别
    pub data_masking_level: DataMaskingLevel,
}

/// 访问控制设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AccessControl {
    /// 是否启用访问控制
    pub enabled: bool,
    /// 需要密码验证的操作
    pub password_protected_operations: Vec<String>,
    /// 会话超时时间（分钟）
    pub session_timeout: u32,
    /// 最大登录尝试次数
    pub max_login_attempts: u8,
    /// 锁定时间（分钟）
    pub lockout_duration: u32,
}

/// 应用通知设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppNotificationSettings {
    /// 是否启用此应用的通知
    pub enabled: bool,
    /// 通知类型过滤器
    pub notification_types: Vec<String>,
    /// 自定义音效
    pub custom_sound: Option<String>,
    /// 优先级
    pub priority: NotificationPriority,
}

/// 开发者选项
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeveloperOptions {
    /// 启用开发者工具
    pub enable_devtools: bool,
    /// 显示性能指标
    pub show_performance_metrics: bool,
    /// 启用API调试
    pub api_debugging: bool,
    /// 模拟网络延迟
    pub simulate_network_delay: Option<u32>,
    /// 强制启用实验性功能
    pub force_experimental_features: bool,
}

/// 云端备份设置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudBackupSettings {
    /// 云服务提供商
    pub provider: String,
    /// API密钥
    pub api_key: Option<String>,
    /// 存储桶/容器名称
    pub bucket_name: String,
    /// 加密备份
    pub encrypt_backups: bool,
    /// 加密密钥
    pub encryption_key: Option<String>,
}

/// 时间范围
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimeRange {
    /// 开始时间 (HH:MM)
    pub start: String,
    /// 结束时间 (HH:MM)
    pub end: String,
    /// 适用的星期（0=周日, 1=周一, ...）
    pub weekdays: Vec<u8>,
}

/// 设置值类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SettingValue {
    String(String),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    Array(Vec<SettingValue>),
    Object(HashMap<String, SettingValue>),
}

/// 设置更改事件
#[derive(Debug, Clone)]
pub struct SettingChangeEvent {
    /// 设置键名
    pub key: String,
    /// 旧值
    pub old_value: Option<SettingValue>,
    /// 新值
    pub new_value: SettingValue,
    /// 更改时间
    pub timestamp: DateTime<Utc>,
    /// 更改来源
    pub source: String,
}

/// 设置更改记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingChangeRecord {
    /// 更改ID
    pub id: String,
    /// 设置键名
    pub key: String,
    /// 旧值的字符串表示
    pub old_value: Option<String>,
    /// 新值的字符串表示
    pub new_value: String,
    /// 更改时间
    pub timestamp: DateTime<Utc>,
    /// 更改来源
    pub source: String,
    /// 用户ID（如果有）
    pub user_id: Option<String>,
}

// 枚举定义
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProxyType {
    Http,
    Https,
    Socks4,
    Socks5,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PrivacyMode {
    Standard,
    Enhanced,
    Maximum,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DataMaskingLevel {
    None,
    Partial,
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Center,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// 设置状态错误类型
#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("无效的设置键: {0}")]
    InvalidKey(String),
    #[error("无效的设置值: {0}")]
    InvalidValue(String),
    #[error("设置未找到: {0}")]
    SettingNotFound(String),
    #[error("权限不足: {0}")]
    InsufficientPermissions(String),
    #[error("配置错误: {0}")]
    ConfigError(String),
    #[error("序列化错误: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("验证错误: {0}")]
    ValidationError(String),
    #[error("操作失败: {0}")]
    OperationFailed(String),
}

impl std::fmt::Debug for SettingsState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SettingsState")
            .field("ui_settings", &self.ui_settings)
            .field("system_settings", &self.system_settings)
            .field("privacy_settings", &self.privacy_settings)
            .field("notification_settings", &self.notification_settings)
            .field("advanced_settings", &self.advanced_settings)
            .field("change_listeners", &format!("{} listeners", self.change_listeners.read().len()))
            .field("change_history", &self.change_history)
            .field("custom_settings", &self.custom_settings)
            .finish()
    }
}

impl SettingsState {
    /// 创建新的设置状态管理器
    pub fn new() -> Self {
        Self {
            ui_settings: Arc::new(Mutex::new(UiSettings::default())),
            system_settings: Arc::new(Mutex::new(SystemSettings::default())),
            privacy_settings: Arc::new(Mutex::new(PrivacySettings::default())),
            notification_settings: Arc::new(Mutex::new(NotificationSettings::default())),
            advanced_settings: Arc::new(Mutex::new(AdvancedSettings::default())),
            change_listeners: Arc::new(RwLock::new(HashMap::new())),
            change_history: Arc::new(Mutex::new(Vec::new())),
            custom_settings: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 获取UI设置
    pub fn get_ui_settings(&self) -> UiSettings {
        self.ui_settings.lock().clone()
    }

    /// 设置UI设置
    pub fn set_ui_settings(&self, settings: UiSettings) -> Result<(), SettingsError> {
        self.validate_ui_settings(&settings)?;
        
        let old_settings = self.ui_settings.lock().clone();
        *self.ui_settings.lock() = settings.clone();

        // 记录更改
        self.record_change("ui_settings", Some(old_settings), settings, "user".to_string())?;

        Ok(())
    }

    /// 获取系统设置
    pub fn get_system_settings(&self) -> SystemSettings {
        self.system_settings.lock().clone()
    }

    /// 设置系统设置
    pub fn set_system_settings(&self, settings: SystemSettings) -> Result<(), SettingsError> {
        self.validate_system_settings(&settings)?;
        
        let old_settings = self.system_settings.lock().clone();
        *self.system_settings.lock() = settings.clone();

        // 记录更改
        self.record_change("system_settings", Some(old_settings), settings, "user".to_string())?;

        Ok(())
    }

    /// 获取隐私设置
    pub fn get_privacy_settings(&self) -> PrivacySettings {
        self.privacy_settings.lock().clone()
    }

    /// 设置隐私设置
    pub fn set_privacy_settings(&self, settings: PrivacySettings) -> Result<(), SettingsError> {
        self.validate_privacy_settings(&settings)?;
        
        let old_settings = self.privacy_settings.lock().clone();
        *self.privacy_settings.lock() = settings.clone();

        // 记录更改
        self.record_change("privacy_settings", Some(old_settings), settings, "user".to_string())?;

        Ok(())
    }

    /// 获取通知设置
    pub fn get_notification_settings(&self) -> NotificationSettings {
        self.notification_settings.lock().clone()
    }

    /// 设置通知设置
    pub fn set_notification_settings(&self, settings: NotificationSettings) -> Result<(), SettingsError> {
        self.validate_notification_settings(&settings)?;
        
        let old_settings = self.notification_settings.lock().clone();
        *self.notification_settings.lock() = settings.clone();

        // 记录更改
        self.record_change("notification_settings", Some(old_settings), settings, "user".to_string())?;

        Ok(())
    }

    /// 获取高级设置
    pub fn get_advanced_settings(&self) -> AdvancedSettings {
        self.advanced_settings.lock().clone()
    }

    /// 设置高级设置
    pub fn set_advanced_settings(&self, settings: AdvancedSettings) -> Result<(), SettingsError> {
        self.validate_advanced_settings(&settings)?;
        
        let old_settings = self.advanced_settings.lock().clone();
        *self.advanced_settings.lock() = settings.clone();

        // 记录更改
        self.record_change("advanced_settings", Some(old_settings), settings, "user".to_string())?;

        Ok(())
    }

    /// 获取自定义设置
    pub fn get_custom_setting(&self, key: &str) -> Option<SettingValue> {
        self.custom_settings.read().get(key).cloned()
    }

    /// 设置自定义设置
    pub fn set_custom_setting(&self, key: String, value: SettingValue) -> Result<(), SettingsError> {
        if key.is_empty() {
            return Err(SettingsError::InvalidKey("键不能为空".to_string()));
        }

        let old_value = self.custom_settings.read().get(&key).cloned();
        self.custom_settings.write().insert(key.clone(), value.clone());

        // 触发更改事件
        let event = SettingChangeEvent {
            key: key.clone(),
            old_value,
            new_value: value,
            timestamp: Utc::now(),
            source: "custom".to_string(),
        };

        self.notify_listeners(&event);

        Ok(())
    }

    /// 删除自定义设置
    pub fn remove_custom_setting(&self, key: &str) -> Result<Option<SettingValue>, SettingsError> {
        if key.is_empty() {
            return Err(SettingsError::InvalidKey("键不能为空".to_string()));
        }

        let removed = self.custom_settings.write().remove(key);

        if let Some(old_value) = &removed {
            let event = SettingChangeEvent {
                key: key.to_string(),
                old_value: Some(old_value.clone()),
                new_value: SettingValue::String("DELETED".to_string()),
                timestamp: Utc::now(),
                source: "custom".to_string(),
            };

            self.notify_listeners(&event);
        }

        Ok(removed)
    }

    /// 获取所有自定义设置
    pub fn get_all_custom_settings(&self) -> HashMap<String, SettingValue> {
        self.custom_settings.read().clone()
    }

    /// 添加更改监听器
    pub fn add_change_listener<F>(&self, id: String, listener: F) 
    where 
        F: Fn(&SettingChangeEvent) + Send + Sync + 'static,
    {
        self.change_listeners.write().insert(id, Box::new(listener));
    }

    /// 移除更改监听器
    pub fn remove_change_listener(&self, id: &str) {
        self.change_listeners.write().remove(id);
    }

    /// 获取更改历史
    pub fn get_change_history(&self) -> Vec<SettingChangeRecord> {
        self.change_history.lock().clone()
    }

    /// 清除更改历史
    pub fn clear_change_history(&self) -> Result<(), SettingsError> {
        self.change_history.lock().clear();
        Ok(())
    }

    /// 重置到默认设置
    pub fn reset_to_defaults(&self) -> Result<(), SettingsError> {
        // 重置所有设置类型
        *self.ui_settings.lock() = UiSettings::default();
        *self.system_settings.lock() = SystemSettings::default();
        *self.privacy_settings.lock() = PrivacySettings::default();
        *self.notification_settings.lock() = NotificationSettings::default();
        *self.advanced_settings.lock() = AdvancedSettings::default();

        // 清除自定义设置
        self.custom_settings.write().clear();

        // 清除更改历史
        self.change_history.lock().clear();

        Ok(())
    }

    /// 导出设置
    pub fn export_settings(&self) -> Result<String, SettingsError> {
        let export_data = SettingsExport {
            ui_settings: self.get_ui_settings(),
            system_settings: self.get_system_settings(),
            privacy_settings: self.get_privacy_settings(),
            notification_settings: self.get_notification_settings(),
            advanced_settings: self.get_advanced_settings(),
            custom_settings: self.get_all_custom_settings(),
            export_timestamp: Utc::now(),
        };

        serde_json::to_string_pretty(&export_data)
            .map_err(SettingsError::SerializationError)
    }

    /// 导入设置
    pub fn import_settings(&self, settings_json: &str) -> Result<(), SettingsError> {
        let import_data: SettingsExport = serde_json::from_str(settings_json)
            .map_err(SettingsError::SerializationError)?;

        // 验证并应用设置
        self.set_ui_settings(import_data.ui_settings)?;
        self.set_system_settings(import_data.system_settings)?;
        self.set_privacy_settings(import_data.privacy_settings)?;
        self.set_notification_settings(import_data.notification_settings)?;
        self.set_advanced_settings(import_data.advanced_settings)?;

        // 导入自定义设置
        for (key, value) in import_data.custom_settings {
            self.set_custom_setting(key, value)?;
        }

        Ok(())
    }

    /// 验证设置一致性
    pub fn validate_settings(&self) -> Result<(), SettingsError> {
        self.validate_ui_settings(&self.get_ui_settings())?;
        self.validate_system_settings(&self.get_system_settings())?;
        self.validate_privacy_settings(&self.get_privacy_settings())?;
        self.validate_notification_settings(&self.get_notification_settings())?;
        self.validate_advanced_settings(&self.get_advanced_settings())?;

        Ok(())
    }

    // 私有方法实现

    /// 验证UI设置
    fn validate_ui_settings(&self, settings: &UiSettings) -> Result<(), SettingsError> {
        if settings.font_size < 8 || settings.font_size > 72 {
            return Err(SettingsError::ValidationError("字体大小必须在8-72之间".to_string()));
        }

        if !(0.5..=3.0).contains(&settings.ui_scale) {
            return Err(SettingsError::ValidationError("UI缩放比例必须在0.5-3.0之间".to_string()));
        }

        if !(0.1..=3.0).contains(&settings.animation_speed) {
            return Err(SettingsError::ValidationError("动画速度必须在0.1-3.0之间".to_string()));
        }

        if !(0.0..=1.0).contains(&settings.transparency) {
            return Err(SettingsError::ValidationError("透明度必须在0.0-1.0之间".to_string()));
        }

        Ok(())
    }

    /// 验证系统设置
    fn validate_system_settings(&self, settings: &SystemSettings) -> Result<(), SettingsError> {
        if settings.update_check_interval > 24 * 30 { // 最大30天
            return Err(SettingsError::ValidationError("更新检查间隔不能超过30天".to_string()));
        }

        Ok(())
    }

    /// 验证隐私设置
    fn validate_privacy_settings(&self, settings: &PrivacySettings) -> Result<(), SettingsError> {
        if settings.data_retention_days > 365 * 10 { // 最大10年
            return Err(SettingsError::ValidationError("数据保留时间不能超过10年".to_string()));
        }

        Ok(())
    }

    /// 验证通知设置
    fn validate_notification_settings(&self, settings: &NotificationSettings) -> Result<(), SettingsError> {
        if !(0.0..=1.0).contains(&settings.notification_volume) {
            return Err(SettingsError::ValidationError("通知音量必须在0.0-1.0之间".to_string()));
        }

        if settings.notification_duration > 300 { // 最大5分钟
            return Err(SettingsError::ValidationError("通知显示时间不能超过5分钟".to_string()));
        }

        Ok(())
    }

    /// 验证高级设置
    fn validate_advanced_settings(&self, settings: &AdvancedSettings) -> Result<(), SettingsError> {
        if let Some(memory_limit) = settings.memory_limit {
            if memory_limit < 128 {
                return Err(SettingsError::ValidationError("内存限制不能少于128MB".to_string()));
            }
        }

        if let Some(cpu_limit) = settings.cpu_limit {
            if cpu_limit > 100 {
                return Err(SettingsError::ValidationError("CPU限制不能超过100%".to_string()));
            }
        }

        if settings.network_timeout == 0 || settings.network_timeout > 300 {
            return Err(SettingsError::ValidationError("网络超时必须在1-300秒之间".to_string()));
        }

        Ok(())
    }

    /// 记录设置更改
    fn record_change<T: Serialize>(
        &self,
        key: &str,
        old_value: Option<T>,
        new_value: T,
        source: String,
    ) -> Result<(), SettingsError> {
        let record = SettingChangeRecord {
            id: uuid::Uuid::new_v4().to_string(),
            key: key.to_string(),
            old_value: old_value.as_ref().and_then(|v| serde_json::to_string(v).ok()),
            new_value: serde_json::to_string(&new_value)
                .map_err(SettingsError::SerializationError)?,
            timestamp: Utc::now(),
            source,
            user_id: None,
        };

        let mut history = self.change_history.lock();
        history.push(record);

        // 限制历史记录数量
        if history.len() > 1000 {
            history.remove(0);
        }

        Ok(())
    }

    /// 通知监听器
    fn notify_listeners(&self, event: &SettingChangeEvent) {
        let listeners = self.change_listeners.read();
        for listener in listeners.values() {
            listener(event);
        }
    }
}

/// 设置导出结构
#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsExport {
    pub ui_settings: UiSettings,
    pub system_settings: SystemSettings,
    pub privacy_settings: PrivacySettings,
    pub notification_settings: NotificationSettings,
    pub advanced_settings: AdvancedSettings,
    pub custom_settings: HashMap<String, SettingValue>,
    pub export_timestamp: DateTime<Utc>,
}

// 默认实现
impl Default for UiSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "zh-CN".to_string(),
            font_size: 14,
            font_family: "System".to_string(),
            ui_scale: 1.0,
            animations_enabled: true,
            animation_speed: 1.0,
            sound_effects: true,
            transparency: 0.95,
            show_advanced_options: false,
            custom_css: None,
            window_decorations: false,
            always_on_top: true,
        }
    }
}

impl Default for SystemSettings {
    fn default() -> Self {
        Self {
            auto_start: false,
            minimize_to_tray: true,
            close_to_tray: true,
            start_minimized: false,
            update_check_interval: 24,
            auto_install_updates: false,
            hardware_acceleration: true,
            proxy_settings: ProxySettings::default(),
            log_level: LogLevel::Info,
            data_directory: "".to_string(),
            backup_settings: BackupSettings::default(),
        }
    }
}

impl Default for PrivacySettings {
    fn default() -> Self {
        Self {
            collect_usage_data: false,
            collect_crash_reports: true,
            enable_telemetry: false,
            data_retention_days: 30,
            encrypt_local_data: true,
            privacy_mode: PrivacyMode::Enhanced,
            anonymization_settings: AnonymizationSettings::default(),
            access_control: AccessControl::default(),
        }
    }
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            desktop_notifications: true,
            notification_sound: true,
            notification_volume: 0.5,
            notification_duration: 5,
            notification_position: NotificationPosition::TopRight,
            do_not_disturb: false,
            do_not_disturb_schedule: None,
            app_notifications: HashMap::new(),
        }
    }
}

impl Default for AdvancedSettings {
    fn default() -> Self {
        Self {
            debug_mode: false,
            performance_monitoring: false,
            memory_limit: None,
            cpu_limit: None,
            network_timeout: 30,
            max_concurrent_connections: 10,
            cache_size: 100,
            experimental_features: HashMap::new(),
            developer_options: DeveloperOptions::default(),
        }
    }
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            proxy_type: ProxyType::Http,
            host: String::new(),
            port: 8080,
            username: None,
            password: None,
            exclude_list: Vec::new(),
        }
    }
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_hours: 24,
            max_backups: 7,
            backup_directory: "backups".to_string(),
            compress_backups: true,
            cloud_backup: false,
            cloud_settings: CloudBackupSettings::default(),
        }
    }
}

impl Default for AnonymizationSettings {
    fn default() -> Self {
        Self {
            anonymize_user_id: true,
            anonymize_ip_addresses: true,
            anonymize_device_info: false,
            data_masking_level: DataMaskingLevel::Partial,
        }
    }
}

impl Default for AccessControl {
    fn default() -> Self {
        Self {
            enabled: false,
            password_protected_operations: Vec::new(),
            session_timeout: 30,
            max_login_attempts: 3,
            lockout_duration: 15,
        }
    }
}

impl Default for AppNotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            notification_types: Vec::new(),
            custom_sound: None,
            priority: NotificationPriority::Normal,
        }
    }
}

impl Default for DeveloperOptions {
    fn default() -> Self {
        Self {
            enable_devtools: false,
            show_performance_metrics: false,
            api_debugging: false,
            simulate_network_delay: None,
            force_experimental_features: false,
        }
    }
}

impl Default for CloudBackupSettings {
    fn default() -> Self {
        Self {
            provider: "local".to_string(),
            api_key: None,
            bucket_name: String::new(),
            encrypt_backups: true,
            encryption_key: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_settings_state_new() {
        let settings = SettingsState::new();
        
        // 测试默认值
        let ui_settings = settings.get_ui_settings();
        assert_eq!(ui_settings.theme, "dark");
        assert_eq!(ui_settings.language, "zh-CN");
        assert_eq!(ui_settings.font_size, 14);
        
        let system_settings = settings.get_system_settings();
        assert!(!system_settings.auto_start);
        assert!(system_settings.minimize_to_tray);
        assert!(system_settings.close_to_tray);
    }

    #[test]
    fn test_ui_settings_validation() {
        let settings = SettingsState::new();
        
        // 测试有效设置
        let mut ui_settings = UiSettings::default();
        ui_settings.font_size = 16;
        ui_settings.ui_scale = 1.5;
        
        let result = settings.set_ui_settings(ui_settings);
        assert!(result.is_ok());
        
        // 测试无效字体大小
        let mut invalid_settings = UiSettings::default();
        invalid_settings.font_size = 100; // 超出范围
        
        let result = settings.set_ui_settings(invalid_settings);
        assert!(result.is_err());
        
        if let Err(SettingsError::ValidationError(msg)) = result {
            assert!(msg.contains("字体大小"));
        } else {
            panic!("期望ValidationError错误");
        }
        
        // 测试无效UI缩放
        let mut invalid_settings = UiSettings::default();
        invalid_settings.ui_scale = 5.0; // 超出范围
        
        let result = settings.set_ui_settings(invalid_settings);
        assert!(result.is_err());
    }

    #[test]
    fn test_system_settings() {
        let settings = SettingsState::new();
        
        let mut system_settings = SystemSettings::default();
        system_settings.auto_start = true;
        system_settings.update_check_interval = 12;
        system_settings.hardware_acceleration = false;
        
        let result = settings.set_system_settings(system_settings.clone());
        assert!(result.is_ok());
        
        let retrieved = settings.get_system_settings();
        assert_eq!(retrieved.auto_start, true);
        assert_eq!(retrieved.update_check_interval, 12);
        assert_eq!(retrieved.hardware_acceleration, false);
    }

    #[test]
    fn test_privacy_settings() {
        let settings = SettingsState::new();
        
        let mut privacy_settings = PrivacySettings::default();
        privacy_settings.collect_usage_data = true;
        privacy_settings.privacy_mode = PrivacyMode::Maximum;
        privacy_settings.data_retention_days = 90;
        
        let result = settings.set_privacy_settings(privacy_settings.clone());
        assert!(result.is_ok());
        
        let retrieved = settings.get_privacy_settings();
        assert_eq!(retrieved.collect_usage_data, true);
        assert_eq!(retrieved.privacy_mode, PrivacyMode::Maximum);
        assert_eq!(retrieved.data_retention_days, 90);
    }

    #[test]
    fn test_notification_settings() {
        let settings = SettingsState::new();
        
        let mut notification_settings = NotificationSettings::default();
        notification_settings.notification_volume = 0.8;
        notification_settings.notification_duration = 10;
        notification_settings.notification_position = NotificationPosition::BottomLeft;
        
        let result = settings.set_notification_settings(notification_settings.clone());
        assert!(result.is_ok());
        
        let retrieved = settings.get_notification_settings();
        assert_eq!(retrieved.notification_volume, 0.8);
        assert_eq!(retrieved.notification_duration, 10);
        assert_eq!(retrieved.notification_position, NotificationPosition::BottomLeft);
    }

    #[test]
    fn test_advanced_settings() {
        let settings = SettingsState::new();
        
        let mut advanced_settings = AdvancedSettings::default();
        advanced_settings.debug_mode = true;
        advanced_settings.memory_limit = Some(512);
        advanced_settings.cpu_limit = Some(80);
        advanced_settings.network_timeout = 60;
        
        let result = settings.set_advanced_settings(advanced_settings.clone());
        assert!(result.is_ok());
        
        let retrieved = settings.get_advanced_settings();
        assert_eq!(retrieved.debug_mode, true);
        assert_eq!(retrieved.memory_limit, Some(512));
        assert_eq!(retrieved.cpu_limit, Some(80));
        assert_eq!(retrieved.network_timeout, 60);
    }

    #[test]
    fn test_custom_settings() {
        let settings = SettingsState::new();
        
        // 测试字符串值
        let result = settings.set_custom_setting(
            "test_string".to_string(),
            SettingValue::String("测试值".to_string())
        );
        assert!(result.is_ok());
        
        let value = settings.get_custom_setting("test_string");
        assert_eq!(value, Some(SettingValue::String("测试值".to_string())));
        
        // 测试数字值
        let result = settings.set_custom_setting(
            "test_number".to_string(),
            SettingValue::Integer(42)
        );
        assert!(result.is_ok());
        
        let value = settings.get_custom_setting("test_number");
        assert_eq!(value, Some(SettingValue::Integer(42)));
        
        // 测试布尔值
        let result = settings.set_custom_setting(
            "test_bool".to_string(),
            SettingValue::Boolean(true)
        );
        assert!(result.is_ok());
        
        let value = settings.get_custom_setting("test_bool");
        assert_eq!(value, Some(SettingValue::Boolean(true)));
    }

    #[test]
    fn test_custom_settings_validation() {
        let settings = SettingsState::new();
        
        // 测试空键名
        let result = settings.set_custom_setting(
            String::new(),
            SettingValue::String("value".to_string())
        );
        assert!(result.is_err());
        
        if let Err(SettingsError::InvalidKey(msg)) = result {
            assert!(msg.contains("键不能为空"));
        } else {
            panic!("期望InvalidKey错误");
        }
    }

    #[test]
    fn test_remove_custom_setting() {
        let settings = SettingsState::new();
        
        // 先添加一个设置
        settings.set_custom_setting(
            "to_remove".to_string(),
            SettingValue::String("will be removed".to_string())
        ).unwrap();
        
        // 确认设置存在
        assert!(settings.get_custom_setting("to_remove").is_some());
        
        // 删除设置
        let removed = settings.remove_custom_setting("to_remove").unwrap();
        assert_eq!(removed, Some(SettingValue::String("will be removed".to_string())));
        
        // 确认设置已删除
        assert!(settings.get_custom_setting("to_remove").is_none());
        
        // 删除不存在的设置
        let removed = settings.remove_custom_setting("non_existent").unwrap();
        assert_eq!(removed, None);
    }

    #[test]
    fn test_get_all_custom_settings() {
        let settings = SettingsState::new();
        
        // 添加多个自定义设置
        settings.set_custom_setting(
            "key1".to_string(),
            SettingValue::String("value1".to_string())
        ).unwrap();
        
        settings.set_custom_setting(
            "key2".to_string(),
            SettingValue::Integer(123)
        ).unwrap();
        
        settings.set_custom_setting(
            "key3".to_string(),
            SettingValue::Boolean(false)
        ).unwrap();
        
        let all_settings = settings.get_all_custom_settings();
        assert_eq!(all_settings.len(), 3);
        assert_eq!(all_settings.get("key1"), Some(&SettingValue::String("value1".to_string())));
        assert_eq!(all_settings.get("key2"), Some(&SettingValue::Integer(123)));
        assert_eq!(all_settings.get("key3"), Some(&SettingValue::Boolean(false)));
    }

    #[test]
    fn test_change_listeners() {
        use std::sync::Arc;
        use std::sync::atomic::{AtomicUsize, Ordering};
        
        let settings = SettingsState::new();
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        
        // 添加监听器
        settings.add_change_listener("test_listener".to_string(), move |_event| {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });
        
        // 触发设置更改
        settings.set_custom_setting(
            "test_key".to_string(),
            SettingValue::String("test_value".to_string())
        ).unwrap();
        
        // 稍等片刻让监听器执行
        thread::sleep(Duration::from_millis(10));
        
        // 验证监听器被调用
        assert_eq!(counter.load(Ordering::SeqCst), 1);
        
        // 移除监听器
        settings.remove_change_listener("test_listener");
        
        // 再次触发更改
        settings.set_custom_setting(
            "test_key2".to_string(),
            SettingValue::String("test_value2".to_string())
        ).unwrap();
        
        thread::sleep(Duration::from_millis(10));
        
        // 监听器不应该再被调用
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn test_change_history() {
        let settings = SettingsState::new();
        
        // 初始历史应为空
        assert_eq!(settings.get_change_history().len(), 0);
        
        // 修改设置以产生历史记录
        let mut ui_settings = settings.get_ui_settings();
        ui_settings.font_size = 16;
        settings.set_ui_settings(ui_settings).unwrap();
        
        let history = settings.get_change_history();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].key, "ui_settings");
        assert_eq!(history[0].source, "user");
        
        // 再次修改
        let mut ui_settings = settings.get_ui_settings();
        ui_settings.font_size = 18;
        settings.set_ui_settings(ui_settings).unwrap();
        
        let history = settings.get_change_history();
        assert_eq!(history.len(), 2);
        
        // 清除历史
        settings.clear_change_history().unwrap();
        assert_eq!(settings.get_change_history().len(), 0);
    }

    #[test]
    fn test_reset_to_defaults() {
        let settings = SettingsState::new();
        
        // 修改各种设置
        let mut ui_settings = UiSettings::default();
        ui_settings.theme = "light".to_string();
        ui_settings.font_size = 20;
        settings.set_ui_settings(ui_settings).unwrap();
        
        let mut system_settings = SystemSettings::default();
        system_settings.auto_start = true;
        settings.set_system_settings(system_settings).unwrap();
        
        settings.set_custom_setting(
            "custom_test".to_string(),
            SettingValue::String("custom_value".to_string())
        ).unwrap();
        
        // 验证设置已修改
        assert_eq!(settings.get_ui_settings().theme, "light");
        assert_eq!(settings.get_system_settings().auto_start, true);
        assert!(settings.get_custom_setting("custom_test").is_some());
        assert!(!settings.get_change_history().is_empty());
        
        // 重置到默认值
        let result = settings.reset_to_defaults();
        assert!(result.is_ok());
        
        // 验证设置已重置
        assert_eq!(settings.get_ui_settings().theme, "dark");
        assert_eq!(settings.get_ui_settings().font_size, 14);
        assert_eq!(settings.get_system_settings().auto_start, false);
        assert!(settings.get_custom_setting("custom_test").is_none());
        assert_eq!(settings.get_all_custom_settings().len(), 0);
        assert_eq!(settings.get_change_history().len(), 0);
    }

    #[test]
    fn test_export_import_settings() {
        let settings = SettingsState::new();
        
        // 修改一些设置
        let mut ui_settings = UiSettings::default();
        ui_settings.theme = "light".to_string();
        ui_settings.font_size = 18;
        settings.set_ui_settings(ui_settings).unwrap();
        
        settings.set_custom_setting(
            "export_test".to_string(),
            SettingValue::Boolean(true)
        ).unwrap();
        
        // 导出设置
        let exported = settings.export_settings();
        assert!(exported.is_ok());
        
        let exported_json = exported.unwrap();
        assert!(exported_json.contains("light"));
        assert!(exported_json.contains("export_test"));
        
        // 重置设置
        settings.reset_to_defaults().unwrap();
        assert_eq!(settings.get_ui_settings().theme, "dark");
        assert!(settings.get_custom_setting("export_test").is_none());
        
        // 导入设置
        let result = settings.import_settings(&exported_json);
        assert!(result.is_ok());
        
        // 验证设置已恢复
        assert_eq!(settings.get_ui_settings().theme, "light");
        assert_eq!(settings.get_ui_settings().font_size, 18);
        assert_eq!(settings.get_custom_setting("export_test"), Some(SettingValue::Boolean(true)));
    }

    #[test]
    fn test_validate_settings() {
        let settings = SettingsState::new();
        
        // 正常设置应通过验证
        let result = settings.validate_settings();
        assert!(result.is_ok());
        
        // 制造无效设置
        {
            let mut ui_settings = settings.ui_settings.lock();
            ui_settings.font_size = 200; // 无效值
        }
        
        let result = settings.validate_settings();
        assert!(result.is_err());
    }

    #[test]
    fn test_setting_value_variants() {
        let settings = SettingsState::new();
        
        // 测试所有SettingValue变体
        let test_cases = vec![
            ("string_val", SettingValue::String("test".to_string())),
            ("int_val", SettingValue::Integer(42)),
            ("float_val", SettingValue::Float(3.14)),
            ("bool_val", SettingValue::Boolean(true)),
            ("array_val", SettingValue::Array(vec![
                SettingValue::String("item1".to_string()),
                SettingValue::Integer(123),
            ])),
            ("object_val", SettingValue::Object({
                let mut map = HashMap::new();
                map.insert("key1".to_string(), SettingValue::String("value1".to_string()));
                map.insert("key2".to_string(), SettingValue::Integer(456));
                map
            })),
        ];
        
        for (key, value) in test_cases {
            let result = settings.set_custom_setting(key.to_string(), value.clone());
            assert!(result.is_ok());
            
            let retrieved = settings.get_custom_setting(key);
            assert_eq!(retrieved, Some(value));
        }
    }

    #[test]
    fn test_notification_settings_validation() {
        let settings = SettingsState::new();
        
        // 测试无效通知音量
        let mut notification_settings = NotificationSettings::default();
        notification_settings.notification_volume = 1.5; // 超出范围
        
        let result = settings.set_notification_settings(notification_settings);
        assert!(result.is_err());
        
        // 测试无效通知持续时间
        let mut notification_settings = NotificationSettings::default();
        notification_settings.notification_duration = 400; // 超出范围
        
        let result = settings.set_notification_settings(notification_settings);
        assert!(result.is_err());
    }

    #[test]
    fn test_advanced_settings_validation() {
        let settings = SettingsState::new();
        
        // 测试无效内存限制
        let mut advanced_settings = AdvancedSettings::default();
        advanced_settings.memory_limit = Some(50); // 小于最小值
        
        let result = settings.set_advanced_settings(advanced_settings);
        assert!(result.is_err());
        
        // 测试无效CPU限制
        let mut advanced_settings = AdvancedSettings::default();
        advanced_settings.cpu_limit = Some(150); // 超过100%
        
        let result = settings.set_advanced_settings(advanced_settings);
        assert!(result.is_err());
        
        // 测试无效网络超时
        let mut advanced_settings = AdvancedSettings::default();
        advanced_settings.network_timeout = 0; // 无效值
        
        let result = settings.set_advanced_settings(advanced_settings);
        assert!(result.is_err());
    }

    #[test]
    fn test_enum_serialization() {
        // 测试各种枚举的序列化和反序列化
        let proxy_types = vec![
            ProxyType::Http,
            ProxyType::Https,
            ProxyType::Socks4,
            ProxyType::Socks5,
        ];
        
        for proxy_type in proxy_types {
            let serialized = serde_json::to_string(&proxy_type).unwrap();
            let deserialized: ProxyType = serde_json::from_str(&serialized).unwrap();
            assert_eq!(proxy_type, deserialized);
        }
        
        let log_levels = vec![
            LogLevel::Error,
            LogLevel::Warn,
            LogLevel::Info,
            LogLevel::Debug,
            LogLevel::Trace,
        ];
        
        for log_level in log_levels {
            let serialized = serde_json::to_string(&log_level).unwrap();
            let deserialized: LogLevel = serde_json::from_str(&serialized).unwrap();
            assert_eq!(log_level, deserialized);
        }
    }

    #[test]
    fn test_thread_safety() {
        let settings = Arc::new(SettingsState::new());
        let mut handles = vec![];
        
        // 启动多个线程同时操作设置
        for i in 0..10 {
            let settings_clone = Arc::clone(&settings);
            let handle = thread::spawn(move || {
                // 修改自定义设置
                let _ = settings_clone.set_custom_setting(
                    format!("thread_{}", i),
                    SettingValue::Integer(i as i64)
                );
                
                // 修改UI设置
                let mut ui_settings = settings_clone.get_ui_settings();
                ui_settings.font_size = 14 + (i % 10) as u16;
                let _ = settings_clone.set_ui_settings(ui_settings);
            });
            handles.push(handle);
        }
        
        // 等待所有线程完成
        for handle in handles {
            handle.join().unwrap();
        }
        
        // 验证状态仍然一致
        let result = settings.validate_settings();
        assert!(result.is_ok());
        
        let custom_settings = settings.get_all_custom_settings();
        assert_eq!(custom_settings.len(), 10);
    }

    #[test]
    fn test_history_size_limit() {
        let settings = SettingsState::new();
        
        // 创建大量历史记录
        for i in 0..1100 {
            let mut ui_settings = settings.get_ui_settings();
            ui_settings.font_size = 14 + (i % 50) as u16;
            settings.set_ui_settings(ui_settings).unwrap();
        }
        
        let history = settings.get_change_history();
        // 历史记录应该被限制在1000条
        assert_eq!(history.len(), 1000);
    }

    #[test]
    fn test_complex_settings_structure() {
        let settings = SettingsState::new();
        
        // 测试复杂的设置结构
        let mut notification_settings = NotificationSettings::default();
        
        // 添加应用特定通知设置
        let app_settings = AppNotificationSettings {
            enabled: true,
            notification_types: vec!["message".to_string(), "alert".to_string()],
            custom_sound: Some("custom.wav".to_string()),
            priority: NotificationPriority::High,
        };
        
        notification_settings.app_notifications.insert("test_app".to_string(), app_settings.clone());
        
        // 设置免打扰时间段
        notification_settings.do_not_disturb_schedule = Some(TimeRange {
            start: "22:00".to_string(),
            end: "08:00".to_string(),
            weekdays: vec![1, 2, 3, 4, 5], // 工作日
        });
        
        let result = settings.set_notification_settings(notification_settings);
        assert!(result.is_ok());
        
        let retrieved = settings.get_notification_settings();
        assert_eq!(retrieved.app_notifications.len(), 1);
        assert_eq!(retrieved.app_notifications.get("test_app"), Some(&app_settings));
        assert!(retrieved.do_not_disturb_schedule.is_some());
    }

    #[test]
    fn test_settings_error_display() {
        let errors = vec![
            SettingsError::InvalidKey("invalid_key".to_string()),
            SettingsError::InvalidValue("invalid_value".to_string()),
            SettingsError::SettingNotFound("not_found".to_string()),
            SettingsError::InsufficientPermissions("no_permission".to_string()),
            SettingsError::ConfigError("config_error".to_string()),
            SettingsError::ValidationError("validation_error".to_string()),
            SettingsError::OperationFailed("operation_failed".to_string()),
        ];
        
        for error in errors {
            let error_string = error.to_string();
            assert!(!error_string.is_empty());
        }
    }
}
