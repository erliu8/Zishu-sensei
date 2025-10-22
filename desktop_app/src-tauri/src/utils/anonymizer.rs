// 数据匿名化工具
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

/// 匿名化选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnonymizationOptions {
    pub anonymize_user_id: bool,
    pub anonymize_ip: bool,
    pub anonymize_location: bool,
    pub anonymize_device_id: bool,
    pub hash_sensitive_data: bool,
}

impl Default for AnonymizationOptions {
    fn default() -> Self {
        Self {
            anonymize_user_id: true,
            anonymize_ip: true,
            anonymize_location: true,
            anonymize_device_id: true,
            hash_sensitive_data: true,
        }
    }
}

/// 使用统计数据（匿名化前）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsageStatistics {
    pub user_id: Option<String>,
    pub session_id: String,
    pub event_type: String,
    pub event_data: HashMap<String, serde_json::Value>,
    pub timestamp: i64,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub device_id: Option<String>,
    pub location: Option<Location>,
    pub app_version: String,
    pub os_type: String,
    pub os_version: String,
}

/// 位置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

/// 匿名化后的使用统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AnonymousStatistics {
    pub anonymous_id: String,
    pub session_hash: String,
    pub event_type: String,
    pub event_data: HashMap<String, serde_json::Value>,
    pub timestamp: i64,
    pub country: Option<String>,
    pub app_version: String,
    pub os_type: String,
    pub os_version: String,
}

/// 数据匿名化器
pub struct Anonymizer {
    salt: String,
}

impl Anonymizer {
    pub fn new() -> Self {
        Self {
            salt: Uuid::new_v4().to_string(),
        }
    }

    pub fn new_with_salt(salt: String) -> Self {
        Self { salt }
    }

    /// 匿名化使用统计
    pub fn anonymize_statistics(
        &self,
        stats: UsageStatistics,
        options: &AnonymizationOptions,
    ) -> AnonymousStatistics {
        let anonymous_id = if options.anonymize_user_id {
            self.hash_with_salt(&stats.user_id.unwrap_or_default())
        } else {
            stats.user_id.unwrap_or_default()
        };

        let session_hash = self.hash_with_salt(&stats.session_id);

        let country = if options.anonymize_location {
            stats.location.as_ref().and_then(|l| l.country.clone())
        } else {
            None
        };

        AnonymousStatistics {
            anonymous_id,
            session_hash,
            event_type: stats.event_type,
            event_data: self.anonymize_event_data(stats.event_data, options),
            timestamp: stats.timestamp,
            country,
            app_version: stats.app_version,
            os_type: stats.os_type,
            os_version: stats.os_version,
        }
    }

    /// 匿名化事件数据
    fn anonymize_event_data(
        &self,
        mut data: HashMap<String, serde_json::Value>,
        options: &AnonymizationOptions,
    ) -> HashMap<String, serde_json::Value> {
        if !options.hash_sensitive_data {
            return data;
        }

        // 移除敏感字段
        let sensitive_keys = vec![
            "user_id", "email", "phone", "ip_address", "device_id",
            "api_key", "token", "password", "credit_card", "ssn",
        ];

        for key in sensitive_keys {
            data.remove(key);
        }

        // 哈希可能包含敏感信息的字符串值
        for (key, value) in data.iter_mut() {
            if key.to_lowercase().contains("name") || key.to_lowercase().contains("id") {
                if let Some(s) = value.as_str() {
                    *value = serde_json::Value::String(self.hash_with_salt(s));
                }
            }
        }

        data
    }

    /// 使用盐值进行哈希
    fn hash_with_salt(&self, input: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}", input, self.salt));
        format!("{:x}", hasher.finalize())
    }

    /// 匿名化 IP 地址（保留前缀）
    pub fn anonymize_ip(&self, ip: &str) -> String {
        if ip.contains(':') {
            // IPv6: 保留前 4 段
            let parts: Vec<&str> = ip.split(':').collect();
            if parts.len() >= 4 {
                format!("{}:{}:{}:{}:****:****:****:****", 
                    parts[0], parts[1], parts[2], parts[3])
            } else {
                "****:****:****:****:****:****:****:****".to_string()
            }
        } else {
            // IPv4: 保留前 2 段
            let parts: Vec<&str> = ip.split('.').collect();
            if parts.len() >= 2 {
                format!("{}.{}.***.***", parts[0], parts[1])
            } else {
                "***.***.***.***".to_string()
            }
        }
    }

    /// 生成匿名设备指纹
    pub fn generate_anonymous_device_id(&self, device_info: &str) -> String {
        self.hash_with_salt(device_info)
    }

    /// 检查数据是否包含敏感信息
    pub fn contains_sensitive_data(&self, text: &str) -> bool {
        let sensitive_patterns = vec![
            // Email
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            // 电话号码
            r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
            r"\b\d{11}\b",
            // IP 地址
            r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
            // API 密钥模式
            r#"(?i)(api[_-]?key|token|secret)['"]?\s*[:=]\s*['"]?[\w\-]+"#,
        ];

        for pattern in sensitive_patterns {
            if regex::Regex::new(pattern)
                .map(|re| re.is_match(text))
                .unwrap_or(false)
            {
                return true;
            }
        }

        false
    }

    /// 脱敏文本中的敏感信息
    pub fn redact_sensitive_text(&self, text: &str) -> String {
        let mut result = text.to_string();

        // Email 脱敏
        if let Ok(re) = regex::Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b") {
            result = re.replace_all(&result, "[EMAIL_REDACTED]").to_string();
        }

        // 电话号码脱敏
        if let Ok(re) = regex::Regex::new(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b") {
            result = re.replace_all(&result, "[PHONE_REDACTED]").to_string();
        }

        // IP 地址脱敏
        if let Ok(re) = regex::Regex::new(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b") {
            result = re.replace_all(&result, "[IP_REDACTED]").to_string();
        }

        // API 密钥脱敏
        if let Ok(re) = regex::Regex::new(r#"(?i)(api[_-]?key|token|secret)['"]?\s*[:=]\s*['"]?([\w\-]+)"#) {
            result = re.replace_all(&result, "$1=[REDACTED]").to_string();
        }

        result
    }
}

impl Default for Anonymizer {
    fn default() -> Self {
        Self::new()
    }
}

/// 隐私保护的日志记录器
pub struct PrivacyLogger {
    anonymizer: Anonymizer,
    enabled: bool,
}

impl PrivacyLogger {
    pub fn new(enabled: bool) -> Self {
        Self {
            anonymizer: Anonymizer::new(),
            enabled,
        }
    }

    /// 安全地记录日志（自动脱敏）
    pub fn log(&self, level: &str, message: &str) {
        if !self.enabled {
            return;
        }

        let safe_message = if self.anonymizer.contains_sensitive_data(message) {
            self.anonymizer.redact_sensitive_text(message)
        } else {
            message.to_string()
        };

        match level {
            "error" => log::error!("{}", safe_message),
            "warn" => log::warn!("{}", safe_message),
            "info" => log::info!("{}", safe_message),
            "debug" => log::debug!("{}", safe_message),
            _ => log::trace!("{}", safe_message),
        }
    }

    /// 检查并脱敏消息
    pub fn sanitize_message(&self, message: &str) -> String {
        if self.anonymizer.contains_sensitive_data(message) {
            self.anonymizer.redact_sensitive_text(message)
        } else {
            message.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anonymize_ip() {
        let anonymizer = Anonymizer::new();
        
        assert_eq!(anonymizer.anonymize_ip("192.168.1.100"), "192.168.***.***");
        assert!(anonymizer.anonymize_ip("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
            .starts_with("2001:0db8:85a3:0000"));
    }

    #[test]
    fn test_contains_sensitive_data() {
        let anonymizer = Anonymizer::new();
        
        assert!(anonymizer.contains_sensitive_data("My email is test@example.com"));
        assert!(anonymizer.contains_sensitive_data("Call me at 123-456-7890"));
        assert!(anonymizer.contains_sensitive_data("Server IP: 192.168.1.1"));
        assert!(!anonymizer.contains_sensitive_data("Hello world"));
    }

    #[test]
    fn test_redact_sensitive_text() {
        let anonymizer = Anonymizer::new();
        
        let text = "Contact me at john@example.com or call 123-456-7890";
        let redacted = anonymizer.redact_sensitive_text(text);
        
        assert!(redacted.contains("[EMAIL_REDACTED]"));
        assert!(redacted.contains("[PHONE_REDACTED]"));
        assert!(!redacted.contains("john@example.com"));
    }
}

