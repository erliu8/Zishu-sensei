// src-tauri/src/utils/data_masking.rs
//! 敏感信息脱敏工具
//! 
//! 用于在日志、调试输出、API 响应等场景中隐藏敏感信息

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

/// 脱敏策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MaskingStrategy {
    /// 完全隐藏（替换为 ***）
    Full,
    /// 部分显示（显示前后N个字符）
    Partial { prefix: usize, suffix: usize },
    /// 仅显示前缀
    PrefixOnly { length: usize },
    /// 仅显示后缀
    SuffixOnly { length: usize },
    /// 中间隐藏
    MiddleHidden { show: usize },
    /// 哈希显示（显示哈希值）
    Hash,
}

/// 敏感数据类型
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SensitiveDataType {
    /// API 密钥
    ApiKey,
    /// 密码
    Password,
    /// Token
    Token,
    /// 电子邮件
    Email,
    /// 电话号码
    PhoneNumber,
    /// 身份证号
    IdCard,
    /// 信用卡号
    CreditCard,
    /// IP 地址
    IpAddress,
    /// 自定义
    Custom(String),
}

/// 数据脱敏器
pub struct DataMasker {
    /// 默认掩码字符
    mask_char: char,
    /// API 密钥正则表达式
    api_key_patterns: Vec<Regex>,
    /// Token 正则表达式
    token_patterns: Vec<Regex>,
    /// 电子邮件正则表达式
    email_pattern: Regex,
    /// 电话号码正则表达式
    phone_pattern: Regex,
}

impl Default for DataMasker {
    fn default() -> Self {
        Self::new()
    }
}

impl DataMasker {
    /// 创建新的数据脱敏器
    pub fn new() -> Self {
        Self {
            mask_char: '*',
            api_key_patterns: vec![
                // OpenAI API Key
                Regex::new(r"sk-[a-zA-Z0-9]{48}").unwrap(),
                // Anthropic API Key
                Regex::new(r"sk-ant-api[a-zA-Z0-9\-_]{95}").unwrap(),
                // 通用 API Key 格式
                Regex::new(r"[Aa][Pp][Ii]_?[Kk][Ee][Yy][:=\s]+['\"]?([a-zA-Z0-9_\-]{20,})").unwrap(),
            ],
            token_patterns: vec![
                // JWT Token
                Regex::new(r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+").unwrap(),
                // Bearer Token
                Regex::new(r"Bearer\s+([a-zA-Z0-9_\-\.]{20,})").unwrap(),
            ],
            email_pattern: Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap(),
            phone_pattern: Regex::new(r"(\+?86)?1[3-9]\d{9}").unwrap(),
        }
    }

    /// 对字符串进行脱敏
    pub fn mask(&self, text: &str, strategy: &MaskingStrategy) -> String {
        match strategy {
            MaskingStrategy::Full => self.mask_full(text),
            MaskingStrategy::Partial { prefix, suffix } => self.mask_partial(text, *prefix, *suffix),
            MaskingStrategy::PrefixOnly { length } => self.mask_prefix_only(text, *length),
            MaskingStrategy::SuffixOnly { length } => self.mask_suffix_only(text, *length),
            MaskingStrategy::MiddleHidden { show } => self.mask_middle(text, *show),
            MaskingStrategy::Hash => self.mask_with_hash(text),
        }
    }

    /// 完全隐藏
    fn mask_full(&self, text: &str) -> String {
        self.mask_char.to_string().repeat(8)
    }

    /// 部分显示
    fn mask_partial(&self, text: &str, prefix: usize, suffix: usize) -> String {
        let len = text.len();
        if len <= prefix + suffix {
            return self.mask_full(text);
        }

        let prefix_str = &text[..prefix];
        let suffix_str = &text[len - suffix..];
        let mask_len = len - prefix - suffix;

        format!(
            "{}{}{}",
            prefix_str,
            self.mask_char.to_string().repeat(mask_len.min(8)),
            suffix_str
        )
    }

    /// 仅显示前缀
    fn mask_prefix_only(&self, text: &str, length: usize) -> String {
        let len = text.len();
        if len <= length {
            return text.to_string();
        }

        let prefix_str = &text[..length];
        format!("{}{}", prefix_str, self.mask_char.to_string().repeat(8))
    }

    /// 仅显示后缀
    fn mask_suffix_only(&self, text: &str, length: usize) -> String {
        let len = text.len();
        if len <= length {
            return text.to_string();
        }

        let suffix_str = &text[len - length..];
        format!("{}{}", self.mask_char.to_string().repeat(8), suffix_str)
    }

    /// 中间隐藏
    fn mask_middle(&self, text: &str, show: usize) -> String {
        let len = text.len();
        if len <= show * 2 {
            return text.to_string();
        }

        let prefix_str = &text[..show];
        let suffix_str = &text[len - show..];

        format!(
            "{}{}{}",
            prefix_str,
            self.mask_char.to_string().repeat(8),
            suffix_str
        )
    }

    /// 使用哈希显示
    fn mask_with_hash(&self, text: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        let result = hasher.finalize();
        format!("sha256:{:x}", result)
    }

    /// 自动检测并脱敏 API 密钥
    pub fn mask_api_keys(&self, text: &str) -> Cow<str> {
        let mut result = Cow::Borrowed(text);

        for pattern in &self.api_key_patterns {
            if pattern.is_match(&result) {
                result = Cow::Owned(pattern.replace_all(&result, |caps: &regex::Captures| {
                    let matched = caps.get(0).unwrap().as_str();
                    self.mask_partial(matched, 7, 4)
                }).into_owned());
            }
        }

        result
    }

    /// 自动检测并脱敏 Token
    pub fn mask_tokens(&self, text: &str) -> Cow<str> {
        let mut result = Cow::Borrowed(text);

        for pattern in &self.token_patterns {
            if pattern.is_match(&result) {
                result = Cow::Owned(pattern.replace_all(&result, |caps: &regex::Captures| {
                    let matched = caps.get(0).unwrap().as_str();
                    self.mask_partial(matched, 10, 4)
                }).into_owned());
            }
        }

        result
    }

    /// 脱敏电子邮件
    pub fn mask_email(&self, text: &str) -> Cow<str> {
        self.email_pattern.replace_all(text, |caps: &regex::Captures| {
            let email = caps.get(0).unwrap().as_str();
            if let Some(at_pos) = email.find('@') {
                let (local, domain) = email.split_at(at_pos);
                let masked_local = if local.len() <= 3 {
                    local.to_string()
                } else {
                    format!("{}***", &local[..2])
                };
                format!("{}{}", masked_local, domain)
            } else {
                email.to_string()
            }
        })
    }

    /// 脱敏电话号码
    pub fn mask_phone(&self, text: &str) -> Cow<str> {
        self.phone_pattern.replace_all(text, |caps: &regex::Captures| {
            let phone = caps.get(0).unwrap().as_str();
            self.mask_middle(phone, 3)
        })
    }

    /// 自动检测并脱敏所有敏感信息
    pub fn mask_all_sensitive(&self, text: &str) -> String {
        let mut result = text.to_string();

        // API Keys
        result = self.mask_api_keys(&result).into_owned();

        // Tokens
        result = self.mask_tokens(&result).into_owned();

        // Emails
        result = self.mask_email(&result).into_owned();

        // Phone numbers
        result = self.mask_phone(&result).into_owned();

        result
    }

    /// 脱敏 JSON 中的敏感字段
    pub fn mask_json_fields(
        &self,
        json: &str,
        sensitive_fields: &[&str],
        strategy: &MaskingStrategy,
    ) -> Result<String, serde_json::Error> {
        let mut value: serde_json::Value = serde_json::from_str(json)?;

        self.mask_json_value(&mut value, sensitive_fields, strategy);

        Ok(serde_json::to_string(&value)?)
    }

    /// 递归脱敏 JSON 值
    fn mask_json_value(
        &self,
        value: &mut serde_json::Value,
        sensitive_fields: &[&str],
        strategy: &MaskingStrategy,
    ) {
        match value {
            serde_json::Value::Object(map) => {
                for (key, val) in map.iter_mut() {
                    if sensitive_fields.contains(&key.as_str()) {
                        if let Some(s) = val.as_str() {
                            *val = serde_json::Value::String(self.mask(s, strategy));
                        }
                    } else {
                        self.mask_json_value(val, sensitive_fields, strategy);
                    }
                }
            }
            serde_json::Value::Array(arr) => {
                for item in arr.iter_mut() {
                    self.mask_json_value(item, sensitive_fields, strategy);
                }
            }
            _ => {}
        }
    }
}

/// 快速脱敏函数
pub fn quick_mask(text: &str, data_type: SensitiveDataType) -> String {
    let masker = DataMasker::new();

    match data_type {
        SensitiveDataType::ApiKey => {
            masker.mask(text, &MaskingStrategy::Partial { prefix: 7, suffix: 4 })
        }
        SensitiveDataType::Password => {
            masker.mask(text, &MaskingStrategy::Full)
        }
        SensitiveDataType::Token => {
            masker.mask(text, &MaskingStrategy::Partial { prefix: 10, suffix: 4 })
        }
        SensitiveDataType::Email => {
            masker.mask_email(text).into_owned()
        }
        SensitiveDataType::PhoneNumber => {
            masker.mask_phone(text).into_owned()
        }
        SensitiveDataType::IdCard => {
            masker.mask(text, &MaskingStrategy::MiddleHidden { show: 4 })
        }
        SensitiveDataType::CreditCard => {
            masker.mask(text, &MaskingStrategy::SuffixOnly { length: 4 })
        }
        SensitiveDataType::IpAddress => {
            masker.mask(text, &MaskingStrategy::Partial { prefix: 7, suffix: 0 })
        }
        SensitiveDataType::Custom(_) => {
            masker.mask(text, &MaskingStrategy::MiddleHidden { show: 3 })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_strategies() {
        let masker = DataMasker::new();
        let text = "my_secret_password";

        assert_eq!(masker.mask(text, &MaskingStrategy::Full), "********");
        assert_eq!(
            masker.mask(text, &MaskingStrategy::Partial { prefix: 3, suffix: 3 }),
            "my_********ord"
        );
        assert_eq!(
            masker.mask(text, &MaskingStrategy::PrefixOnly { length: 5 }),
            "my_se********"
        );
    }

    #[test]
    fn test_mask_api_keys() {
        let masker = DataMasker::new();
        let text = "My API key is sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890";

        let masked = masker.mask_api_keys(text);
        assert!(masked.contains("sk-1234********7890"));
    }

    #[test]
    fn test_mask_email() {
        let masker = DataMasker::new();
        let text = "Contact me at user@example.com for details";

        let masked = masker.mask_email(text);
        assert!(masked.contains("us***@example.com"));
    }

    #[test]
    fn test_mask_phone() {
        let masker = DataMasker::new();
        let text = "Call me at 13812345678";

        let masked = masker.mask_phone(text);
        assert!(masked.contains("138********678"));
    }

    #[test]
    fn test_mask_all_sensitive() {
        let masker = DataMasker::new();
        let text = "API Key: sk-1234567890abcdefghijklmnopqrstuvwxyz1234567890, Email: test@example.com, Phone: 13912345678";

        let masked = masker.mask_all_sensitive(text);
        assert!(!masked.contains("test@example.com"));
        assert!(!masked.contains("13912345678"));
    }

    #[test]
    fn test_mask_json_fields() {
        let masker = DataMasker::new();
        let json = r#"{"username":"alice","password":"secret123","email":"alice@example.com"}"#;

        let masked = masker.mask_json_fields(
            json,
            &["password"],
            &MaskingStrategy::Full,
        ).unwrap();

        let value: serde_json::Value = serde_json::from_str(&masked).unwrap();
        assert_eq!(value["password"], "********");
        assert_eq!(value["username"], "alice");
    }
}

