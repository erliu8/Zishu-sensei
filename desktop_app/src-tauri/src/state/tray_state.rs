//! 系统托盘状态管理模块
//! 
//! 负责管理系统托盘的状态，包括：
//! - 托盘图标状态
//! - 最近对话记录
//! - 系统资源监控数据
//! - 托盘通知队列

use std::sync::Arc;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 托盘图标状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TrayIconState {
    /// 空闲状态
    Idle,
    /// 活跃状态（正在对话）
    Active,
    /// 忙碌状态（正在处理）
    Busy,
    /// 通知状态（有新消息）
    Notification,
    /// 错误状态
    Error,
}

/// 最近对话记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentConversation {
    /// 对话 ID
    pub id: String,
    /// 对话标题
    pub title: String,
    /// 最后一条消息内容（摘要）
    pub last_message: String,
    /// 最后更新时间
    pub updated_at: DateTime<Utc>,
    /// 未读消息数
    pub unread_count: u32,
}

/// 系统资源监控数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemResources {
    /// CPU 使用率（百分比）
    pub cpu_usage: f32,
    /// 内存使用率（百分比）
    pub memory_usage: f32,
    /// 总内存（字节）
    pub total_memory: u64,
    /// 已用内存（字节）
    pub used_memory: u64,
    /// 应用程序运行时间（秒）
    pub uptime: u64,
    /// 最后更新时间
    pub updated_at: DateTime<Utc>,
}

impl Default for SystemResources {
    fn default() -> Self {
        Self {
            cpu_usage: 0.0,
            memory_usage: 0.0,
            total_memory: 0,
            used_memory: 0,
            uptime: 0,
            updated_at: Utc::now(),
        }
    }
}

/// 托盘通知
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayNotification {
    /// 通知 ID
    pub id: String,
    /// 通知标题
    pub title: String,
    /// 通知内容
    pub body: String,
    /// 通知类型
    pub notification_type: NotificationType,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 是否已读
    pub is_read: bool,
}

/// 通知类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NotificationType {
    /// 信息
    Info,
    /// 警告
    Warning,
    /// 错误
    Error,
    /// 成功
    Success,
    /// 对话消息
    Message,
}

/// 托盘状态
pub struct TrayState {
    /// 当前图标状态
    icon_state: Arc<RwLock<TrayIconState>>,
    /// 最近对话列表（最多保存 10 条）
    recent_conversations: Arc<RwLock<Vec<RecentConversation>>>,
    /// 系统资源监控数据
    system_resources: Arc<RwLock<SystemResources>>,
    /// 通知队列（最多保存 50 条）
    notifications: Arc<RwLock<Vec<TrayNotification>>>,
    /// 未读通知计数
    unread_notification_count: Arc<RwLock<u32>>,
}

impl TrayState {
    /// 创建新的托盘状态
    pub fn new() -> Self {
        Self {
            icon_state: Arc::new(RwLock::new(TrayIconState::Idle)),
            recent_conversations: Arc::new(RwLock::new(Vec::new())),
            system_resources: Arc::new(RwLock::new(SystemResources::default())),
            notifications: Arc::new(RwLock::new(Vec::new())),
            unread_notification_count: Arc::new(RwLock::new(0)),
        }
    }

    // ==================== 图标状态管理 ====================

    /// 获取当前图标状态
    pub fn get_icon_state(&self) -> TrayIconState {
        self.icon_state.read().clone()
    }

    /// 设置图标状态
    pub fn set_icon_state(&self, state: TrayIconState) {
        *self.icon_state.write() = state;
    }

    // ==================== 最近对话管理 ====================

    /// 获取最近对话列表
    pub fn get_recent_conversations(&self) -> Vec<RecentConversation> {
        self.recent_conversations.read().clone()
    }

    /// 添加或更新最近对话
    pub fn add_or_update_conversation(&self, conversation: RecentConversation) {
        let mut conversations = self.recent_conversations.write();
        
        // 查找是否已存在
        if let Some(pos) = conversations.iter().position(|c| c.id == conversation.id) {
            // 更新现有对话
            conversations[pos] = conversation;
        } else {
            // 添加新对话
            conversations.insert(0, conversation);
        }
        
        // 只保留最近 10 条
        if conversations.len() > 10 {
            conversations.truncate(10);
        }
        
        // 按更新时间排序
        conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    }

    /// 移除对话
    pub fn remove_conversation(&self, conversation_id: &str) {
        let mut conversations = self.recent_conversations.write();
        conversations.retain(|c| c.id != conversation_id);
    }

    /// 清空最近对话
    pub fn clear_conversations(&self) {
        self.recent_conversations.write().clear();
    }

    /// 标记对话已读
    pub fn mark_conversation_read(&self, conversation_id: &str) {
        let mut conversations = self.recent_conversations.write();
        if let Some(conversation) = conversations.iter_mut().find(|c| c.id == conversation_id) {
            conversation.unread_count = 0;
        }
    }

    /// 获取总未读消息数
    pub fn get_total_unread_count(&self) -> u32 {
        self.recent_conversations
            .read()
            .iter()
            .map(|c| c.unread_count)
            .sum()
    }

    // ==================== 系统资源管理 ====================

    /// 获取系统资源数据
    pub fn get_system_resources(&self) -> SystemResources {
        self.system_resources.read().clone()
    }

    /// 更新系统资源数据
    pub fn update_system_resources(&self, resources: SystemResources) {
        *self.system_resources.write() = resources;
    }

    // ==================== 通知管理 ====================

    /// 获取所有通知
    pub fn get_notifications(&self) -> Vec<TrayNotification> {
        self.notifications.read().clone()
    }

    /// 获取未读通知
    pub fn get_unread_notifications(&self) -> Vec<TrayNotification> {
        self.notifications
            .read()
            .iter()
            .filter(|n| !n.is_read)
            .cloned()
            .collect()
    }

    /// 添加通知
    pub fn add_notification(&self, notification: TrayNotification) {
        let mut notifications = self.notifications.write();
        
        // 添加到队列开头
        notifications.insert(0, notification);
        
        // 只保留最近 50 条
        if notifications.len() > 50 {
            notifications.truncate(50);
        }
        
        // 更新未读计数
        let unread_count = notifications.iter().filter(|n| !n.is_read).count() as u32;
        *self.unread_notification_count.write() = unread_count;
    }

    /// 标记通知已读
    pub fn mark_notification_read(&self, notification_id: &str) {
        let mut notifications = self.notifications.write();
        if let Some(notification) = notifications.iter_mut().find(|n| n.id == notification_id) {
            notification.is_read = true;
        }
        
        // 更新未读计数
        let unread_count = notifications.iter().filter(|n| !n.is_read).count() as u32;
        *self.unread_notification_count.write() = unread_count;
    }

    /// 标记所有通知已读
    pub fn mark_all_notifications_read(&self) {
        let mut notifications = self.notifications.write();
        for notification in notifications.iter_mut() {
            notification.is_read = true;
        }
        *self.unread_notification_count.write() = 0;
    }

    /// 清空通知
    pub fn clear_notifications(&self) {
        self.notifications.write().clear();
        *self.unread_notification_count.write() = 0;
    }

    /// 获取未读通知数
    pub fn get_unread_notification_count(&self) -> u32 {
        *self.unread_notification_count.read()
    }
}

impl Default for TrayState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_state_creation() {
        let state = TrayState::new();
        assert_eq!(state.get_icon_state(), TrayIconState::Idle);
        assert_eq!(state.get_recent_conversations().len(), 0);
        assert_eq!(state.get_notifications().len(), 0);
    }

    #[test]
    fn test_icon_state_management() {
        let state = TrayState::new();
        state.set_icon_state(TrayIconState::Active);
        assert_eq!(state.get_icon_state(), TrayIconState::Active);
    }

    #[test]
    fn test_conversation_management() {
        let state = TrayState::new();
        
        let conversation = RecentConversation {
            id: "conv1".to_string(),
            title: "Test Conversation".to_string(),
            last_message: "Hello".to_string(),
            updated_at: Utc::now(),
            unread_count: 5,
        };
        
        state.add_or_update_conversation(conversation);
        assert_eq!(state.get_recent_conversations().len(), 1);
        assert_eq!(state.get_total_unread_count(), 5);
        
        state.mark_conversation_read("conv1");
        assert_eq!(state.get_total_unread_count(), 0);
    }

    #[test]
    fn test_notification_management() {
        let state = TrayState::new();
        
        let notification = TrayNotification {
            id: "notif1".to_string(),
            title: "Test".to_string(),
            body: "Test body".to_string(),
            notification_type: NotificationType::Info,
            created_at: Utc::now(),
            is_read: false,
        };
        
        state.add_notification(notification);
        assert_eq!(state.get_notifications().len(), 1);
        assert_eq!(state.get_unread_notification_count(), 1);
        
        state.mark_notification_read("notif1");
        assert_eq!(state.get_unread_notification_count(), 0);
    }
}

