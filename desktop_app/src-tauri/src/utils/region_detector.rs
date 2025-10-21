use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// 系统区域信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemRegionInfo {
    pub locale: String,
    pub language: String,
    pub country: String,
    pub timezone: String,
    pub currency: String,
    pub confidence: f32, // 检测置信度 (0.0 - 1.0)
}

/// 区域检测器
pub struct RegionDetector;

impl RegionDetector {
    /// 检测系统区域设置
    pub fn detect_system_region() -> SystemRegionInfo {
        let mut info = SystemRegionInfo {
            locale: String::new(),
            language: String::new(),
            country: String::new(),
            timezone: String::new(),
            currency: String::new(),
            confidence: 0.0,
        };

        // 检测语言和地区
        if let Some((lang, country)) = Self::detect_language_and_country() {
            info.language = lang.clone();
            info.country = country.clone();
            info.locale = format!("{}-{}", lang, country);
            info.confidence += 0.3;
        }

        // 检测时区
        if let Some(tz) = Self::detect_timezone() {
            info.timezone = tz;
            info.confidence += 0.3;
        }

        // 检测货币
        if let Some(currency) = Self::detect_currency(&info.country) {
            info.currency = currency;
            info.confidence += 0.2;
        }

        // 验证和修正检测结果
        Self::validate_and_correct(&mut info);

        // 如果检测失败，使用默认值
        if info.confidence < 0.5 {
            info = Self::get_default_region();
        }

        info
    }

    /// 检测语言和国家代码
    fn detect_language_and_country() -> Option<(String, String)> {
        // 优先检查环境变量
        if let Ok(locale) = std::env::var("LC_ALL")
            .or_else(|_| std::env::var("LC_MESSAGES"))
            .or_else(|_| std::env::var("LANG"))
        {
            if let Some((lang, country)) = Self::parse_locale(&locale) {
                return Some((lang, country));
            }
        }

        // 根据平台特定方法检测
        #[cfg(target_os = "windows")]
        {
            Self::detect_windows_locale()
        }

        #[cfg(target_os = "macos")]
        {
            Self::detect_macos_locale()
        }

        #[cfg(target_os = "linux")]
        {
            Self::detect_linux_locale()
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            // 默认返回英文美国
            Some(("en".to_string(), "US".to_string()))
        }
    }

    /// 解析 locale 字符串
    fn parse_locale(locale: &str) -> Option<(String, String)> {
        // 处理格式如：zh_CN.UTF-8, en_US, ja_JP.eucJP 等
        let parts: Vec<&str> = locale.split('.').collect();
        let locale_part = parts.first()?;
        
        if locale_part.contains('_') {
            let lang_country: Vec<&str> = locale_part.split('_').collect();
            if lang_country.len() >= 2 {
                let lang = lang_country[0].to_lowercase();
                let country = lang_country[1].to_uppercase();
                return Some((lang, country));
            }
        } else if locale_part.contains('-') {
            let lang_country: Vec<&str> = locale_part.split('-').collect();
            if lang_country.len() >= 2 {
                let lang = lang_country[0].to_lowercase();
                let country = lang_country[1].to_uppercase();
                return Some((lang, country));
            }
        }

        // 如果只有语言代码，尝试猜测国家
        Self::guess_country_from_language(locale_part)
    }

    /// 根据语言猜测国家
    fn guess_country_from_language(lang: &str) -> Option<(String, String)> {
        let lang = lang.to_lowercase();
        let country = match lang.as_str() {
            "zh" => "CN",
            "en" => "US",
            "ja" => "JP",
            "ko" => "KR",
            "de" => "DE",
            "fr" => "FR",
            "es" => "ES",
            "it" => "IT",
            "pt" => "BR",
            "ru" => "RU",
            "ar" => "SA",
            "hi" => "IN",
            "th" => "TH",
            "vi" => "VN",
            "ms" => "MY",
            "id" => "ID",
            _ => return None,
        };
        Some((lang, country.to_string()))
    }

    #[cfg(target_os = "windows")]
    fn detect_windows_locale() -> Option<(String, String)> {
        use std::process::Command;
        
        // 使用 PowerShell 获取系统区域设置
        if let Ok(output) = Command::new("powershell")
            .args(["-Command", "Get-Culture | Select-Object -ExpandProperty Name"])
            .output()
        {
            let locale = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Self::parse_locale(&locale)
        } else {
            // 降级方案：使用 systeminfo
            if let Ok(output) = Command::new("systeminfo")
                .args(["/fo", "csv"])
                .output()
            {
                let output_str = String::from_utf8_lossy(&output.stdout);
                // 解析 systeminfo 输出中的区域信息
                Self::parse_systeminfo_output(&output_str)
            } else {
                None
            }
        }
    }

    #[cfg(target_os = "macos")]
    fn detect_macos_locale() -> Option<(String, String)> {
        use std::process::Command;
        
        // 使用 defaults 命令获取系统偏好
        if let Ok(output) = Command::new("defaults")
            .args(["read", "-g", "AppleLocale"])
            .output()
        {
            let locale = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Self::parse_locale(&locale)
        } else {
            // 降级方案：使用 locale 命令
            if let Ok(output) = Command::new("locale").output() {
                let output_str = String::from_utf8_lossy(&output.stdout);
                Self::parse_locale_output(&output_str)
            } else {
                None
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn detect_linux_locale() -> Option<(String, String)> {
        use std::process::Command;
        
        // 使用 locale 命令
        if let Ok(output) = Command::new("locale").output() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            Self::parse_locale_output(&output_str)
        } else {
            // 降级方案：读取 /etc/locale.conf 或 /etc/default/locale
            Self::read_locale_config()
        }
    }

    fn parse_systeminfo_output(output: &str) -> Option<(String, String)> {
        // 解析 Windows systeminfo CSV 输出
        for line in output.lines() {
            if line.to_lowercase().contains("locale") {
                // 提取 locale 信息
                let parts: Vec<&str> = line.split(',').collect();
                for part in parts {
                    let clean_part = part.trim().trim_matches('"');
                    if let Some((lang, country)) = Self::parse_locale(clean_part) {
                        return Some((lang, country));
                    }
                }
            }
        }
        None
    }

    fn parse_locale_output(output: &str) -> Option<(String, String)> {
        // 解析 locale 命令输出
        for line in output.lines() {
            if line.starts_with("LANG=") {
                let locale = line.strip_prefix("LANG=")?.trim_matches('"');
                if let Some((lang, country)) = Self::parse_locale(locale) {
                    return Some((lang, country));
                }
            }
        }
        None
    }

    #[cfg(target_os = "linux")]
    fn read_locale_config() -> Option<(String, String)> {
        use std::fs;
        
        // 尝试读取系统 locale 配置文件
        let config_paths = [
            "/etc/locale.conf",
            "/etc/default/locale",
            "/etc/sysconfig/i18n",
        ];

        for path in &config_paths {
            if let Ok(content) = fs::read_to_string(path) {
                for line in content.lines() {
                    if line.starts_with("LANG=") {
                        let locale = line.strip_prefix("LANG=")?.trim_matches('"');
                        if let Some((lang, country)) = Self::parse_locale(locale) {
                            return Some((lang, country));
                        }
                    }
                }
            }
        }
        None
    }

    /// 检测系统时区
    fn detect_timezone() -> Option<String> {
        // 使用 chrono-tz 检测系统时区
        if let Some(tz) = Self::get_system_timezone() {
            return Some(tz);
        }

        // 降级方案：根据环境变量检测
        if let Ok(tz) = std::env::var("TZ") {
            return Some(tz);
        }

        None
    }

    fn get_system_timezone() -> Option<String> {
        #[cfg(target_os = "windows")]
        {
            Self::get_windows_timezone()
        }

        #[cfg(target_os = "macos")]
        {
            Self::get_macos_timezone()
        }

        #[cfg(target_os = "linux")]
        {
            Self::get_linux_timezone()
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            None
        }
    }

    #[cfg(target_os = "windows")]
    fn get_windows_timezone() -> Option<String> {
        use std::process::Command;
        
        if let Ok(output) = Command::new("powershell")
            .args(["-Command", "Get-TimeZone | Select-Object -ExpandProperty Id"])
            .output()
        {
            let tz_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // 转换 Windows 时区 ID 到 IANA 时区 ID
            Self::convert_windows_timezone_to_iana(&tz_id)
        } else {
            None
        }
    }

    #[cfg(target_os = "macos")]
    fn get_macos_timezone() -> Option<String> {
        use std::process::Command;
        
        if let Ok(output) = Command::new("readlink")
            .args(["/etc/localtime"])
            .output()
        {
            let link_target = String::from_utf8_lossy(&output.stdout).trim();
            // 提取时区名称，如 /usr/share/zoneinfo/Asia/Shanghai -> Asia/Shanghai
            if let Some(tz) = link_target.strip_prefix("/usr/share/zoneinfo/") {
                return Some(tz.to_string());
            }
        }

        // 降级方案
        if let Ok(output) = Command::new("systemsetup")
            .args(["-gettimezone"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            if let Some(tz) = output_str.strip_prefix("Time Zone: ") {
                return Some(tz.trim().to_string());
            }
        }

        None
    }

    #[cfg(target_os = "linux")]
    fn get_linux_timezone() -> Option<String> {
        use std::fs;
        
        // 方法1: 读取 /etc/timezone
        if let Ok(tz) = fs::read_to_string("/etc/timezone") {
            return Some(tz.trim().to_string());
        }

        // 方法2: 检查 /etc/localtime 链接
        if let Ok(link_target) = fs::read_link("/etc/localtime") {
            let target_str = link_target.to_string_lossy();
            if let Some(tz) = target_str.strip_prefix("/usr/share/zoneinfo/") {
                return Some(tz.to_string());
            }
        }

        // 方法3: 使用 timedatectl 命令
        use std::process::Command;
        if let Ok(output) = Command::new("timedatectl")
            .args(["show", "--property=Timezone", "--value"])
            .output()
        {
            let tz_string = String::from_utf8_lossy(&output.stdout);
            let tz = tz_string.trim();
            if !tz.is_empty() {
                return Some(tz.to_string());
            }
        }

        None
    }

    /// 转换 Windows 时区 ID 到 IANA 时区 ID
    fn convert_windows_timezone_to_iana(windows_tz: &str) -> Option<String> {
        let mapping = Self::get_windows_timezone_mapping();
        mapping.get(windows_tz).cloned()
    }

    /// 获取 Windows 时区 ID 到 IANA 时区 ID 的映射表
    fn get_windows_timezone_mapping() -> HashMap<&'static str, String> {
        let mut mapping = HashMap::new();
        
        mapping.insert("China Standard Time", "Asia/Shanghai".to_string());
        mapping.insert("Tokyo Standard Time", "Asia/Tokyo".to_string());
        mapping.insert("Korea Standard Time", "Asia/Seoul".to_string());
        mapping.insert("Eastern Standard Time", "America/New_York".to_string());
        mapping.insert("Central Standard Time", "America/Chicago".to_string());
        mapping.insert("Mountain Standard Time", "America/Denver".to_string());
        mapping.insert("Pacific Standard Time", "America/Los_Angeles".to_string());
        mapping.insert("GMT Standard Time", "Europe/London".to_string());
        mapping.insert("Central Europe Standard Time", "Europe/Berlin".to_string());
        mapping.insert("Romance Standard Time", "Europe/Paris".to_string());
        mapping.insert("India Standard Time", "Asia/Kolkata".to_string());
        mapping.insert("Singapore Standard Time", "Asia/Singapore".to_string());
        mapping.insert("AUS Eastern Standard Time", "Australia/Sydney".to_string());
        mapping.insert("Russian Standard Time", "Europe/Moscow".to_string());
        
        mapping
    }

    /// 根据国家代码检测货币
    fn detect_currency(country: &str) -> Option<String> {
        let currency_map = Self::get_country_currency_mapping();
        currency_map.get(country).cloned()
    }

    /// 获取国家到货币的映射表
    fn get_country_currency_mapping() -> HashMap<&'static str, String> {
        let mut mapping = HashMap::new();
        
        mapping.insert("CN", "CNY".to_string());
        mapping.insert("TW", "TWD".to_string());
        mapping.insert("HK", "HKD".to_string());
        mapping.insert("US", "USD".to_string());
        mapping.insert("GB", "GBP".to_string());
        mapping.insert("JP", "JPY".to_string());
        mapping.insert("KR", "KRW".to_string());
        mapping.insert("DE", "EUR".to_string());
        mapping.insert("FR", "EUR".to_string());
        mapping.insert("IT", "EUR".to_string());
        mapping.insert("ES", "EUR".to_string());
        mapping.insert("PT", "EUR".to_string());
        mapping.insert("NL", "EUR".to_string());
        mapping.insert("BE", "EUR".to_string());
        mapping.insert("AT", "EUR".to_string());
        mapping.insert("IE", "EUR".to_string());
        mapping.insert("FI", "EUR".to_string());
        mapping.insert("GR", "EUR".to_string());
        mapping.insert("LU", "EUR".to_string());
        mapping.insert("MT", "EUR".to_string());
        mapping.insert("CY", "EUR".to_string());
        mapping.insert("SK", "EUR".to_string());
        mapping.insert("SI", "EUR".to_string());
        mapping.insert("EE", "EUR".to_string());
        mapping.insert("LV", "EUR".to_string());
        mapping.insert("LT", "EUR".to_string());
        mapping.insert("CA", "CAD".to_string());
        mapping.insert("AU", "AUD".to_string());
        mapping.insert("NZ", "NZD".to_string());
        mapping.insert("CH", "CHF".to_string());
        mapping.insert("SE", "SEK".to_string());
        mapping.insert("NO", "NOK".to_string());
        mapping.insert("DK", "DKK".to_string());
        mapping.insert("PL", "PLN".to_string());
        mapping.insert("CZ", "CZK".to_string());
        mapping.insert("HU", "HUF".to_string());
        mapping.insert("RO", "RON".to_string());
        mapping.insert("BG", "BGN".to_string());
        mapping.insert("HR", "HRK".to_string());
        mapping.insert("RU", "RUB".to_string());
        mapping.insert("BR", "BRL".to_string());
        mapping.insert("MX", "MXN".to_string());
        mapping.insert("AR", "ARS".to_string());
        mapping.insert("IN", "INR".to_string());
        mapping.insert("SG", "SGD".to_string());
        mapping.insert("MY", "MYR".to_string());
        mapping.insert("TH", "THB".to_string());
        mapping.insert("ID", "IDR".to_string());
        mapping.insert("PH", "PHP".to_string());
        mapping.insert("VN", "VND".to_string());
        mapping.insert("SA", "SAR".to_string());
        mapping.insert("AE", "AED".to_string());
        mapping.insert("EG", "EGP".to_string());
        mapping.insert("IL", "ILS".to_string());
        mapping.insert("TR", "TRY".to_string());
        mapping.insert("ZA", "ZAR".to_string());
        
        mapping
    }

    /// 验证和修正检测结果
    fn validate_and_correct(info: &mut SystemRegionInfo) {
        // 验证 locale 格式
        if !info.locale.contains('-') && !info.language.is_empty() && !info.country.is_empty() {
            info.locale = format!("{}-{}", info.language, info.country);
        }

        // 验证时区格式
        if !info.timezone.is_empty() && !info.timezone.contains('/') {
            // 可能是简化的时区名称，尝试转换
            if let Some(iana_tz) = Self::convert_simple_timezone(&info.timezone) {
                info.timezone = iana_tz;
            }
        }

        // 验证货币代码格式
        if info.currency.len() != 3 {
            if let Some(currency) = Self::detect_currency(&info.country) {
                info.currency = currency;
            }
        }

        // 确保一致性
        if info.locale.is_empty() && !info.language.is_empty() && !info.country.is_empty() {
            info.locale = format!("{}-{}", info.language, info.country);
            info.confidence += 0.1;
        }
    }

    /// 转换简化时区名称到 IANA 时区 ID
    fn convert_simple_timezone(tz: &str) -> Option<String> {
        match tz.to_uppercase().as_str() {
            "CST" => Some("Asia/Shanghai".to_string()),
            "JST" => Some("Asia/Tokyo".to_string()),
            "KST" => Some("Asia/Seoul".to_string()),
            "EST" | "EDT" => Some("America/New_York".to_string()),
            "CST" | "CDT" => Some("America/Chicago".to_string()),
            "MST" | "MDT" => Some("America/Denver".to_string()),
            "PST" | "PDT" => Some("America/Los_Angeles".to_string()),
            "GMT" | "UTC" => Some("Europe/London".to_string()),
            "CET" | "CEST" => Some("Europe/Berlin".to_string()),
            _ => None,
        }
    }

    /// 获取默认区域设置
    fn get_default_region() -> SystemRegionInfo {
        SystemRegionInfo {
            locale: "zh-CN".to_string(),
            language: "zh".to_string(),
            country: "CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            confidence: 1.0,
        }
    }

    /// 获取推荐的区域设置（基于当前检测结果）
    pub fn get_recommended_regions(current: &SystemRegionInfo) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // 基于语言推荐
        match current.language.as_str() {
            "zh" => {
                recommendations.extend_from_slice(&["zh-CN", "zh-TW", "zh-HK"]);
            },
            "en" => {
                recommendations.extend_from_slice(&["en-US", "en-GB", "en-AU", "en-CA"]);
            },
            "ja" => {
                recommendations.push("ja-JP");
            },
            "ko" => {
                recommendations.push("ko-KR");
            },
            "de" => {
                recommendations.extend_from_slice(&["de-DE", "de-AT", "de-CH"]);
            },
            "fr" => {
                recommendations.extend_from_slice(&["fr-FR", "fr-CA", "fr-BE", "fr-CH"]);
            },
            _ => {
                // 默认推荐常用区域
                recommendations.extend_from_slice(&["en-US", "zh-CN", "ja-JP", "ko-KR"]);
            }
        }

        // 确保当前区域在推荐列表中
        if !recommendations.contains(&current.locale.as_str()) {
            recommendations.insert(0, &current.locale);
        }

        recommendations.into_iter().map(|s| s.to_string()).collect()
    }
}
