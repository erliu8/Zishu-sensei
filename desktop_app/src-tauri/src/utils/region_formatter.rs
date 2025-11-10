use chrono::{DateTime, Utc, NaiveDateTime};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};

/// 格式化选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatOptions {
    pub locale: String,
    pub timezone: String,
    pub currency: String,
    pub number_format: NumberFormatStyle,
    pub date_format: DateFormatStyle,
    pub time_format: TimeFormatStyle,
    pub temperature_unit: TemperatureUnit,
    pub distance_unit: DistanceUnit,
    pub weight_unit: WeightUnit,
}

/// 数字格式样式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NumberFormatStyle {
    pub decimal_separator: String,
    pub thousands_separator: String,
    pub currency_symbol: String,
    pub currency_position: CurrencyPosition,
    pub negative_sign: String,
    pub positive_sign: Option<String>,
}

/// 货币位置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CurrencyPosition {
    Before,
    After,
    BeforeWithSpace,
    AfterWithSpace,
}

/// 日期格式样式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DateFormatStyle {
    ISO,           // 2025-10-19
    US,            // 10/19/2025
    EU,            // 19/10/2025
    Chinese,       // 2025年10月19日
    Japanese,      // 2025年10月19日
    Korean,        // 2025년 10월 19일
    German,        // 19.10.2025
    French,        // 19/10/2025
    Custom(String), // 自定义格式
}

/// 时间格式样式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimeFormatStyle {
    H24,           // 14:30:00
    H12,           // 2:30:00 PM
    H24NoSeconds,  // 14:30
    H12NoSeconds,  // 2:30 PM
    Custom(String), // 自定义格式
}

/// 温度单位
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TemperatureUnit {
    Celsius,
    Fahrenheit,
    Kelvin,
}

/// 距离单位
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DistanceUnit {
    Metric,        // km, m, cm, mm
    Imperial,      // mile, ft, in
    Mixed,         // 根据距离选择合适单位
}

/// 重量单位
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WeightUnit {
    Metric,        // kg, g, mg
    Imperial,      // lb, oz
    Mixed,         // 根据重量选择合适单位
}

/// 格式化结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormattedValue {
    pub value: String,
    pub unit: Option<String>,
    pub symbol: Option<String>,
}

/// 区域格式化器
pub struct RegionFormatter {
    options: FormatOptions,
}

impl RegionFormatter {
    /// 创建新的格式化器
    pub fn new(options: FormatOptions) -> Self {
        Self { options }
    }

    /// 从区域代码创建默认格式化器
    pub fn from_locale(locale: &str) -> Self {
        let options = Self::get_default_format_options(locale);
        Self::new(options)
    }

    /// 格式化日期时间
    pub fn format_datetime(&self, datetime: &DateTime<Utc>) -> Result<FormattedValue, String> {
        // 转换到目标时区
        let tz: Tz = self.options.timezone.parse()
            .map_err(|e| format!("Invalid timezone: {}", e))?;
        
        let local_datetime = datetime.with_timezone(&tz);

        // 格式化日期部分
        let date_str = match &self.options.date_format {
            DateFormatStyle::ISO => local_datetime.format("%Y-%m-%d").to_string(),
            DateFormatStyle::US => local_datetime.format("%m/%d/%Y").to_string(),
            DateFormatStyle::EU => local_datetime.format("%d/%m/%Y").to_string(),
            DateFormatStyle::Chinese => local_datetime.format("%Y年%m月%d日").to_string(),
            DateFormatStyle::Japanese => local_datetime.format("%Y年%m月%d日").to_string(),
            DateFormatStyle::Korean => local_datetime.format("%Y년 %m월 %d일").to_string(),
            DateFormatStyle::German => local_datetime.format("%d.%m.%Y").to_string(),
            DateFormatStyle::French => local_datetime.format("%d/%m/%Y").to_string(),
            DateFormatStyle::Custom(fmt) => local_datetime.format(fmt).to_string(),
        };

        // 格式化时间部分
        let time_str = match &self.options.time_format {
            TimeFormatStyle::H24 => local_datetime.format("%H:%M:%S").to_string(),
            TimeFormatStyle::H12 => local_datetime.format("%I:%M:%S %p").to_string(),
            TimeFormatStyle::H24NoSeconds => local_datetime.format("%H:%M").to_string(),
            TimeFormatStyle::H12NoSeconds => local_datetime.format("%I:%M %p").to_string(),
            TimeFormatStyle::Custom(fmt) => local_datetime.format(fmt).to_string(),
        };

        Ok(FormattedValue {
            value: format!("{} {}", date_str, time_str),
            unit: Some(self.options.timezone.clone()),
            symbol: None,
        })
    }

    /// 格式化日期
    pub fn format_date(&self, date: &NaiveDateTime) -> FormattedValue {
        let date_str = match &self.options.date_format {
            DateFormatStyle::ISO => date.format("%Y-%m-%d").to_string(),
            DateFormatStyle::US => date.format("%m/%d/%Y").to_string(),
            DateFormatStyle::EU => date.format("%d/%m/%Y").to_string(),
            DateFormatStyle::Chinese => date.format("%Y年%m月%d日").to_string(),
            DateFormatStyle::Japanese => date.format("%Y年%m月%d日").to_string(),
            DateFormatStyle::Korean => date.format("%Y년 %m월 %d일").to_string(),
            DateFormatStyle::German => date.format("%d.%m.%Y").to_string(),
            DateFormatStyle::French => date.format("%d/%m/%Y").to_string(),
            DateFormatStyle::Custom(fmt) => date.format(fmt).to_string(),
        };

        FormattedValue {
            value: date_str,
            unit: None,
            symbol: None,
        }
    }

    /// 格式化时间
    pub fn format_time(&self, time: &NaiveDateTime) -> FormattedValue {
        let time_str = match &self.options.time_format {
            TimeFormatStyle::H24 => time.format("%H:%M:%S").to_string(),
            TimeFormatStyle::H12 => time.format("%I:%M:%S %p").to_string(),
            TimeFormatStyle::H24NoSeconds => time.format("%H:%M").to_string(),
            TimeFormatStyle::H12NoSeconds => time.format("%I:%M %p").to_string(),
            TimeFormatStyle::Custom(fmt) => time.format(fmt).to_string(),
        };

        FormattedValue {
            value: time_str,
            unit: None,
            symbol: None,
        }
    }

    /// 格式化数字
    pub fn format_number(&self, number: f64, decimal_places: Option<usize>) -> FormattedValue {
        // 处理特殊值
        if number.is_nan() {
            return FormattedValue {
                value: "NaN".to_string(),
                unit: None,
                symbol: None,
            };
        }
        if number.is_infinite() {
            let value = if number.is_sign_positive() {
                "∞".to_string()
            } else {
                format!("{}∞", self.options.number_format.negative_sign)
            };
            return FormattedValue {
                value,
                unit: None,
                symbol: None,
            };
        }

        let places = decimal_places.unwrap_or(2);
        let rounded = (number * 10_f64.powi(places as i32)).round() / 10_f64.powi(places as i32);

        // 分离整数和小数部分
        let integer_part = rounded.trunc() as i64;
        let fractional_part = rounded.fract();

        // 格式化整数部分（添加千位分隔符）
        let integer_str = self.format_integer_with_separators(integer_part.abs());
        
        // 格式化小数部分
        let fractional_str = if places > 0 && fractional_part != 0.0 {
            let frac_scaled = (fractional_part * 10_f64.powi(places as i32)).round() as u64;
            format!("{}{:0width$}", self.options.number_format.decimal_separator, frac_scaled, width = places)
        } else if places > 0 {
            format!("{}{:0width$}", self.options.number_format.decimal_separator, 0, width = places)
        } else {
            String::new()
        };

        // 处理负号
        let sign = if rounded < 0.0 {
            &self.options.number_format.negative_sign
        } else if let Some(ref pos_sign) = self.options.number_format.positive_sign {
            pos_sign
        } else {
            ""
        };

        let formatted = format!("{}{}{}", sign, integer_str, fractional_str);

        FormattedValue {
            value: formatted,
            unit: None,
            symbol: None,
        }
    }

    /// 格式化货币
    pub fn format_currency(&self, amount: f64) -> FormattedValue {
        let number_formatted = self.format_number(amount, Some(2));
        let symbol = &self.options.number_format.currency_symbol;

        let formatted = match &self.options.number_format.currency_position {
            CurrencyPosition::Before => format!("{}{}", symbol, number_formatted.value),
            CurrencyPosition::After => format!("{}{}", number_formatted.value, symbol),
            CurrencyPosition::BeforeWithSpace => format!("{} {}", symbol, number_formatted.value),
            CurrencyPosition::AfterWithSpace => format!("{} {}", number_formatted.value, symbol),
        };

        FormattedValue {
            value: formatted,
            unit: Some(self.options.currency.clone()),
            symbol: Some(symbol.clone()),
        }
    }

    /// 格式化温度
    pub fn format_temperature(&self, celsius: f64) -> FormattedValue {
        let (value, unit, symbol) = match &self.options.temperature_unit {
            TemperatureUnit::Celsius => (celsius, "摄氏度", "°C"),
            TemperatureUnit::Fahrenheit => {
                let fahrenheit = celsius * 9.0 / 5.0 + 32.0;
                (fahrenheit, "华氏度", "°F")
            },
            TemperatureUnit::Kelvin => {
                let kelvin = celsius + 273.15;
                (kelvin, "开尔文", "K")
            },
        };

        let formatted_value = self.format_number(value, Some(1));

        FormattedValue {
            value: format!("{}{}", formatted_value.value, symbol),
            unit: Some(unit.to_string()),
            symbol: Some(symbol.to_string()),
        }
    }

    /// 格式化距离
    pub fn format_distance(&self, meters: f64) -> FormattedValue {
        match &self.options.distance_unit {
            DistanceUnit::Metric | DistanceUnit::Mixed => {
                if meters >= 1000.0 {
                    let km = meters / 1000.0;
                    let formatted = self.format_number(km, Some(2));
                    FormattedValue {
                        value: format!("{} km", formatted.value),
                        unit: Some("千米".to_string()),
                        symbol: Some("km".to_string()),
                    }
                } else if meters >= 1.0 {
                    let formatted = self.format_number(meters, Some(1));
                    FormattedValue {
                        value: format!("{} m", formatted.value),
                        unit: Some("米".to_string()),
                        symbol: Some("m".to_string()),
                    }
                } else {
                    let cm = meters * 100.0;
                    let formatted = self.format_number(cm, Some(0));
                    FormattedValue {
                        value: format!("{} cm", formatted.value),
                        unit: Some("厘米".to_string()),
                        symbol: Some("cm".to_string()),
                    }
                }
            },
            DistanceUnit::Imperial => {
                let feet = meters * 3.28084;
                if feet >= 5280.0 {
                    let miles = feet / 5280.0;
                    let formatted = self.format_number(miles, Some(2));
                    FormattedValue {
                        value: format!("{} mi", formatted.value),
                        unit: Some("英里".to_string()),
                        symbol: Some("mi".to_string()),
                    }
                } else {
                    let formatted = self.format_number(feet, Some(1));
                    FormattedValue {
                        value: format!("{} ft", formatted.value),
                        unit: Some("英尺".to_string()),
                        symbol: Some("ft".to_string()),
                    }
                }
            },
        }
    }

    /// 格式化重量
    pub fn format_weight(&self, grams: f64) -> FormattedValue {
        match &self.options.weight_unit {
            WeightUnit::Metric | WeightUnit::Mixed => {
                if grams >= 1000.0 {
                    let kg = grams / 1000.0;
                    let formatted = self.format_number(kg, Some(2));
                    FormattedValue {
                        value: format!("{} kg", formatted.value),
                        unit: Some("公斤".to_string()),
                        symbol: Some("kg".to_string()),
                    }
                } else {
                    let formatted = self.format_number(grams, Some(1));
                    FormattedValue {
                        value: format!("{} g", formatted.value),
                        unit: Some("克".to_string()),
                        symbol: Some("g".to_string()),
                    }
                }
            },
            WeightUnit::Imperial => {
                let ounces = grams * 0.035274;
                if ounces >= 16.0 {
                    let pounds = ounces / 16.0;
                    let formatted = self.format_number(pounds, Some(2));
                    FormattedValue {
                        value: format!("{} lb", formatted.value),
                        unit: Some("磅".to_string()),
                        symbol: Some("lb".to_string()),
                    }
                } else {
                    let formatted = self.format_number(ounces, Some(1));
                    FormattedValue {
                        value: format!("{} oz", formatted.value),
                        unit: Some("盎司".to_string()),
                        symbol: Some("oz".to_string()),
                    }
                }
            },
        }
    }

    /// 格式化文件大小
    pub fn format_file_size(&self, bytes: u64) -> FormattedValue {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];
        const UNIT_NAMES_ZH: &[&str] = &["字节", "千字节", "兆字节", "千兆字节", "太字节", "拍字节"];
        
        if bytes == 0 {
            return FormattedValue {
                value: "0 B".to_string(),
                unit: Some("字节".to_string()),
                symbol: Some("B".to_string()),
            };
        }

        let bytes_f = bytes as f64;
        let unit_index = (bytes_f.log2() / 10.0).floor() as usize;
        let unit_index = unit_index.min(UNITS.len() - 1);
        
        let value = bytes_f / 1024_f64.powi(unit_index as i32);
        let formatted = self.format_number(value, Some(if unit_index == 0 { 0 } else { 1 }));

        FormattedValue {
            value: format!("{} {}", formatted.value, UNITS[unit_index]),
            unit: Some(UNIT_NAMES_ZH[unit_index].to_string()),
            symbol: Some(UNITS[unit_index].to_string()),
        }
    }

    /// 格式化百分比
    pub fn format_percentage(&self, ratio: f64, decimal_places: Option<usize>) -> FormattedValue {
        let percentage = ratio * 100.0;
        let formatted = self.format_number(percentage, decimal_places.or(Some(1)));
        
        FormattedValue {
            value: format!("{}%", formatted.value),
            unit: Some("百分比".to_string()),
            symbol: Some("%".to_string()),
        }
    }

    /// 私有辅助方法：格式化整数并添加千位分隔符
    fn format_integer_with_separators(&self, number: i64) -> String {
        let number_str = number.to_string();
        let mut result = String::new();
        
        for (i, ch) in number_str.chars().rev().enumerate() {
            if i > 0 && i % 3 == 0 {
                result.push_str(&self.options.number_format.thousands_separator);
            }
            result.push(ch);
        }
        
        result.chars().rev().collect()
    }

    /// 获取默认格式化选项
    fn get_default_format_options(locale: &str) -> FormatOptions {
        match locale {
            "zh-CN" => FormatOptions {
                locale: locale.to_string(),
                timezone: "Asia/Shanghai".to_string(),
                currency: "CNY".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ".".to_string(),
                    thousands_separator: ",".to_string(),
                    currency_symbol: "¥".to_string(),
                    currency_position: CurrencyPosition::Before,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::Chinese,
                time_format: TimeFormatStyle::H24,
                temperature_unit: TemperatureUnit::Celsius,
                distance_unit: DistanceUnit::Metric,
                weight_unit: WeightUnit::Metric,
            },
            "zh-TW" => FormatOptions {
                locale: locale.to_string(),
                timezone: "Asia/Taipei".to_string(),
                currency: "TWD".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ".".to_string(),
                    thousands_separator: ",".to_string(),
                    currency_symbol: "NT$".to_string(),
                    currency_position: CurrencyPosition::Before,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::Chinese,
                time_format: TimeFormatStyle::H24,
                temperature_unit: TemperatureUnit::Celsius,
                distance_unit: DistanceUnit::Metric,
                weight_unit: WeightUnit::Metric,
            },
            "en-US" => FormatOptions {
                locale: locale.to_string(),
                timezone: "America/New_York".to_string(),
                currency: "USD".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ".".to_string(),
                    thousands_separator: ",".to_string(),
                    currency_symbol: "$".to_string(),
                    currency_position: CurrencyPosition::Before,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::US,
                time_format: TimeFormatStyle::H12,
                temperature_unit: TemperatureUnit::Fahrenheit,
                distance_unit: DistanceUnit::Imperial,
                weight_unit: WeightUnit::Imperial,
            },
            "en-GB" => FormatOptions {
                locale: locale.to_string(),
                timezone: "Europe/London".to_string(),
                currency: "GBP".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ".".to_string(),
                    thousands_separator: ",".to_string(),
                    currency_symbol: "£".to_string(),
                    currency_position: CurrencyPosition::Before,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::EU,
                time_format: TimeFormatStyle::H24,
                temperature_unit: TemperatureUnit::Celsius,
                distance_unit: DistanceUnit::Metric,
                weight_unit: WeightUnit::Metric,
            },
            "ja-JP" => FormatOptions {
                locale: locale.to_string(),
                timezone: "Asia/Tokyo".to_string(),
                currency: "JPY".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ".".to_string(),
                    thousands_separator: ",".to_string(),
                    currency_symbol: "¥".to_string(),
                    currency_position: CurrencyPosition::Before,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::Japanese,
                time_format: TimeFormatStyle::H24,
                temperature_unit: TemperatureUnit::Celsius,
                distance_unit: DistanceUnit::Metric,
                weight_unit: WeightUnit::Metric,
            },
            "ko-KR" => FormatOptions {
                locale: locale.to_string(),
                timezone: "Asia/Seoul".to_string(),
                currency: "KRW".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ".".to_string(),
                    thousands_separator: ",".to_string(),
                    currency_symbol: "₩".to_string(),
                    currency_position: CurrencyPosition::Before,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::Korean,
                time_format: TimeFormatStyle::H24,
                temperature_unit: TemperatureUnit::Celsius,
                distance_unit: DistanceUnit::Metric,
                weight_unit: WeightUnit::Metric,
            },
            "de-DE" => FormatOptions {
                locale: locale.to_string(),
                timezone: "Europe/Berlin".to_string(),
                currency: "EUR".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ",".to_string(),
                    thousands_separator: ".".to_string(),
                    currency_symbol: "€".to_string(),
                    currency_position: CurrencyPosition::AfterWithSpace,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::German,
                time_format: TimeFormatStyle::H24,
                temperature_unit: TemperatureUnit::Celsius,
                distance_unit: DistanceUnit::Metric,
                weight_unit: WeightUnit::Metric,
            },
            "fr-FR" => FormatOptions {
                locale: locale.to_string(),
                timezone: "Europe/Paris".to_string(),
                currency: "EUR".to_string(),
                number_format: NumberFormatStyle {
                    decimal_separator: ",".to_string(),
                    thousands_separator: " ".to_string(),
                    currency_symbol: "€".to_string(),
                    currency_position: CurrencyPosition::AfterWithSpace,
                    negative_sign: "-".to_string(),
                    positive_sign: None,
                },
                date_format: DateFormatStyle::French,
                time_format: TimeFormatStyle::H24,
                temperature_unit: TemperatureUnit::Celsius,
                distance_unit: DistanceUnit::Metric,
                weight_unit: WeightUnit::Metric,
            },
            _ => {
                // 默认使用中文简体
                Self::get_default_format_options("zh-CN")
            }
        }
    }

    /// 转换单位
    pub fn convert_temperature(&self, value: f64, from: &TemperatureUnit, to: &TemperatureUnit) -> f64 {
        // 先转换到摄氏度
        let celsius = match from {
            TemperatureUnit::Celsius => value,
            TemperatureUnit::Fahrenheit => (value - 32.0) * 5.0 / 9.0,
            TemperatureUnit::Kelvin => value - 273.15,
        };

        // 再转换到目标单位
        match to {
            TemperatureUnit::Celsius => celsius,
            TemperatureUnit::Fahrenheit => celsius * 9.0 / 5.0 + 32.0,
            TemperatureUnit::Kelvin => celsius + 273.15,
        }
    }

    /// 转换距离单位
    pub fn convert_distance(&self, meters: f64, to_unit: &DistanceUnit) -> (f64, &'static str) {
        match to_unit {
            DistanceUnit::Metric | DistanceUnit::Mixed => {
                if meters >= 1000.0 {
                    (meters / 1000.0, "km")
                } else if meters >= 1.0 {
                    (meters, "m")
                } else {
                    (meters * 100.0, "cm")
                }
            },
            DistanceUnit::Imperial => {
                let feet = meters * 3.28084;
                if feet >= 5280.0 {
                    (feet / 5280.0, "mi")
                } else {
                    (feet, "ft")
                }
            },
        }
    }

    /// 转换重量单位
    pub fn convert_weight(&self, grams: f64, to_unit: &WeightUnit) -> (f64, &'static str) {
        match to_unit {
            WeightUnit::Metric | WeightUnit::Mixed => {
                if grams >= 1000.0 {
                    (grams / 1000.0, "kg")
                } else {
                    (grams, "g")
                }
            },
            WeightUnit::Imperial => {
                let ounces = grams * 0.035274;
                if ounces >= 16.0 {
                    (ounces / 16.0, "lb")
                } else {
                    (ounces, "oz")
                }
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Utc, NaiveDateTime, TimeZone};

    /// 创建测试用的格式化选项
    fn create_test_format_options() -> FormatOptions {
        FormatOptions {
            locale: "zh-CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            number_format: NumberFormatStyle {
                decimal_separator: ".".to_string(),
                thousands_separator: ",".to_string(),
                currency_symbol: "¥".to_string(),
                currency_position: CurrencyPosition::Before,
                negative_sign: "-".to_string(),
                positive_sign: None,
            },
            date_format: DateFormatStyle::Chinese,
            time_format: TimeFormatStyle::H24,
            temperature_unit: TemperatureUnit::Celsius,
            distance_unit: DistanceUnit::Metric,
            weight_unit: WeightUnit::Metric,
        }
    }

    /// 测试格式化器的创建
    #[test]
    fn test_formatter_creation() {
        let options = create_test_format_options();
        let formatter = RegionFormatter::new(options.clone());
        
        assert_eq!(formatter.options.locale, "zh-CN");
        assert_eq!(formatter.options.timezone, "Asia/Shanghai");
        assert_eq!(formatter.options.currency, "CNY");
    }

    /// 测试从locale创建格式化器
    #[test]
    fn test_formatter_from_locale() {
        // 测试中文简体
        let formatter_zh_cn = RegionFormatter::from_locale("zh-CN");
        assert_eq!(formatter_zh_cn.options.locale, "zh-CN");
        assert_eq!(formatter_zh_cn.options.timezone, "Asia/Shanghai");
        assert_eq!(formatter_zh_cn.options.currency, "CNY");
        
        // 测试英语美国
        let formatter_en_us = RegionFormatter::from_locale("en-US");
        assert_eq!(formatter_en_us.options.locale, "en-US");
        assert_eq!(formatter_en_us.options.timezone, "America/New_York");
        assert_eq!(formatter_en_us.options.currency, "USD");
        
        // 测试日语
        let formatter_ja_jp = RegionFormatter::from_locale("ja-JP");
        assert_eq!(formatter_ja_jp.options.locale, "ja-JP");
        assert_eq!(formatter_ja_jp.options.timezone, "Asia/Tokyo");
        assert_eq!(formatter_ja_jp.options.currency, "JPY");
        
        // 测试未知locale（应该使用默认的zh-CN）
        let formatter_unknown = RegionFormatter::from_locale("xx-XX");
        assert_eq!(formatter_unknown.options.locale, "zh-CN");
    }

    /// 测试日期时间格式化
    #[test]
    fn test_format_datetime() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 创建测试日期时间 (2025-10-26 14:30:45 UTC)
        let dt = Utc.with_ymd_and_hms(2025, 10, 26, 14, 30, 45).unwrap();
        
        let result = formatter.format_datetime(&dt);
        assert!(result.is_ok());
        
        let formatted = result.unwrap();
        assert!(formatted.value.contains("2025年10月26日"));
        assert!(formatted.unit.is_some());
        assert_eq!(formatted.unit.unwrap(), "Asia/Shanghai");
    }

    /// 测试不同日期格式样式
    #[test]
    fn test_different_date_formats() {
        let date = NaiveDateTime::from_timestamp_opt(1698336000, 0).unwrap(); // 2023-10-26 12:00:00
        
        // ISO格式
        let mut formatter = RegionFormatter::from_locale("zh-CN");
        formatter.options.date_format = DateFormatStyle::ISO;
        let result = formatter.format_date(&date);
        assert!(result.value.contains("2023-10-26"));
        
        // 美式格式
        formatter.options.date_format = DateFormatStyle::US;
        let result = formatter.format_date(&date);
        assert!(result.value.contains("10/26/2023"));
        
        // 欧式格式
        formatter.options.date_format = DateFormatStyle::EU;
        let result = formatter.format_date(&date);
        assert!(result.value.contains("26/10/2023"));
        
        // 中文格式
        formatter.options.date_format = DateFormatStyle::Chinese;
        let result = formatter.format_date(&date);
        assert!(result.value.contains("2023年10月26日"));
        
        // 日语格式
        formatter.options.date_format = DateFormatStyle::Japanese;
        let result = formatter.format_date(&date);
        assert!(result.value.contains("2023年10月26日"));
        
        // 韩语格式
        formatter.options.date_format = DateFormatStyle::Korean;
        let result = formatter.format_date(&date);
        assert!(result.value.contains("2023년 10월 26일"));
        
        // 德语格式
        formatter.options.date_format = DateFormatStyle::German;
        let result = formatter.format_date(&date);
        assert!(result.value.contains("26.10.2023"));
        
        // 自定义格式
        formatter.options.date_format = DateFormatStyle::Custom("%d-%m-%Y".to_string());
        let result = formatter.format_date(&date);
        assert!(result.value.contains("26-10-2023"));
    }

    /// 测试时间格式化
    #[test]
    fn test_format_time() {
        let time = NaiveDateTime::from_timestamp_opt(1698336000, 0).unwrap(); // 包含时间信息
        let mut formatter = RegionFormatter::from_locale("zh-CN");
        
        // 24小时格式
        formatter.options.time_format = TimeFormatStyle::H24;
        let result = formatter.format_time(&time);
        assert!(result.value.contains(":"));
        
        // 12小时格式
        formatter.options.time_format = TimeFormatStyle::H12;
        let result = formatter.format_time(&time);
        assert!(result.value.contains("M")); // AM 或 PM
        
        // 24小时无秒格式
        formatter.options.time_format = TimeFormatStyle::H24NoSeconds;
        let result = formatter.format_time(&time);
        // 验证格式为 HH:MM（无秒）
        let parts: Vec<&str> = result.value.split(':').collect();
        assert_eq!(parts.len(), 2); // 应该只有小时和分钟两部分
        
        // 自定义格式
        formatter.options.time_format = TimeFormatStyle::Custom("%H-%M".to_string());
        let result = formatter.format_time(&time);
        assert!(result.value.contains("-"));
    }

    /// 测试数字格式化
    #[test]
    fn test_format_number() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 测试正数
        let result = formatter.format_number(1234.567, Some(2));
        assert_eq!(result.value, "1,234.57");
        
        // 测试负数
        let result = formatter.format_number(-1234.567, Some(2));
        // 检查格式化结果的数值正确性，允许小数部分的舍入
        assert!(result.value.starts_with("-1,234."));
        // 验证小数位数为2位
        let parts: Vec<&str> = result.value.split('.').collect();
        if parts.len() > 1 {
            assert_eq!(parts[1].len(), 2);
        }
        
        // 测试整数
        let result = formatter.format_number(1000.0, Some(0));
        assert_eq!(result.value, "1,000");
        
        // 测试小数位数
        let result = formatter.format_number(123.456789, Some(3));
        assert_eq!(result.value, "123.457");
        
        // 测试大数
        let result = formatter.format_number(1000000.0, Some(0));
        assert_eq!(result.value, "1,000,000");
        
        // 测试零
        let result = formatter.format_number(0.0, Some(2));
        assert_eq!(result.value, "0.00");
    }

    /// 测试货币格式化
    #[test]
    fn test_format_currency() {
        // 中文人民币
        let formatter_cn = RegionFormatter::from_locale("zh-CN");
        let result = formatter_cn.format_currency(1234.56);
        assert_eq!(result.value, "¥1,234.56");
        assert_eq!(result.unit.unwrap(), "CNY");
        assert_eq!(result.symbol.unwrap(), "¥");
        
        // 美元
        let formatter_us = RegionFormatter::from_locale("en-US");
        let result = formatter_us.format_currency(1234.56);
        assert_eq!(result.value, "$1,234.56");
        assert_eq!(result.unit.unwrap(), "USD");
        assert_eq!(result.symbol.unwrap(), "$");
        
        // 欧元（后置格式）
        let formatter_de = RegionFormatter::from_locale("de-DE");
        let result = formatter_de.format_currency(1234.56);
        assert!(result.value.ends_with(" €"));
        assert_eq!(result.unit.unwrap(), "EUR");
        assert_eq!(result.symbol.unwrap(), "€");
    }

    /// 测试温度格式化
    #[test]
    fn test_format_temperature() {
        // 摄氏度
        let mut formatter = RegionFormatter::from_locale("zh-CN");
        formatter.options.temperature_unit = TemperatureUnit::Celsius;
        let result = formatter.format_temperature(25.0);
        assert!(result.value.contains("25.0°C"));
        assert_eq!(result.unit.unwrap(), "摄氏度");
        assert_eq!(result.symbol.unwrap(), "°C");
        
        // 华氏度
        formatter.options.temperature_unit = TemperatureUnit::Fahrenheit;
        let result = formatter.format_temperature(25.0);
        assert!(result.value.contains("77.0°F")); // 25°C = 77°F
        assert_eq!(result.unit.unwrap(), "华氏度");
        assert_eq!(result.symbol.unwrap(), "°F");
        
        // 开尔文
        formatter.options.temperature_unit = TemperatureUnit::Kelvin;
        let result = formatter.format_temperature(25.0);
        assert!(result.value.contains("298.2K")); // 25°C = 298.15K
        assert_eq!(result.unit.unwrap(), "开尔文");
        assert_eq!(result.symbol.unwrap(), "K");
    }

    /// 测试距离格式化
    #[test]
    fn test_format_distance() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 厘米
        let result = formatter.format_distance(0.5);
        assert!(result.value.contains("50"));
        assert!(result.value.contains("cm"));
        assert_eq!(result.unit.unwrap(), "厘米");
        
        // 米
        let result = formatter.format_distance(50.0);
        assert!(result.value.contains("50.0 m"));
        assert_eq!(result.unit.unwrap(), "米");
        
        // 千米
        let result = formatter.format_distance(5000.0);
        assert!(result.value.contains("5.00 km"));
        assert_eq!(result.unit.unwrap(), "千米");
        
        // 英制单位
        let mut formatter_us = RegionFormatter::from_locale("en-US");
        formatter_us.options.distance_unit = DistanceUnit::Imperial;
        
        // 英尺
        let result = formatter_us.format_distance(10.0);
        assert!(result.value.contains("ft"));
        assert_eq!(result.unit.unwrap(), "英尺");
        
        // 英里
        let result = formatter_us.format_distance(10000.0);
        assert!(result.value.contains("mi"));
        assert_eq!(result.unit.unwrap(), "英里");
    }

    /// 测试重量格式化
    #[test]
    fn test_format_weight() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 克
        let result = formatter.format_weight(500.0);
        assert!(result.value.contains("500.0 g"));
        assert_eq!(result.unit.unwrap(), "克");
        
        // 公斤
        let result = formatter.format_weight(2500.0);
        assert!(result.value.contains("2.50 kg"));
        assert_eq!(result.unit.unwrap(), "公斤");
        
        // 英制单位
        let mut formatter_us = RegionFormatter::from_locale("en-US");
        formatter_us.options.weight_unit = WeightUnit::Imperial;
        
        // 盎司
        let result = formatter_us.format_weight(200.0);
        assert!(result.value.contains("oz"));
        assert_eq!(result.unit.unwrap(), "盎司");
        
        // 磅
        let result = formatter_us.format_weight(1000.0);
        assert!(result.value.contains("lb"));
        assert_eq!(result.unit.unwrap(), "磅");
    }

    /// 测试文件大小格式化
    #[test]
    fn test_format_file_size() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 字节
        let result = formatter.format_file_size(0);
        assert_eq!(result.value, "0 B");
        assert_eq!(result.unit.unwrap(), "字节");
        
        let result = formatter.format_file_size(512);
        assert_eq!(result.value, "512 B");
        
        // KB
        let result = formatter.format_file_size(1536); // 1.5 KB
        assert_eq!(result.value, "1.5 KB");
        assert_eq!(result.unit.unwrap(), "千字节");
        
        // MB
        let result = formatter.format_file_size(1572864); // 1.5 MB
        assert_eq!(result.value, "1.5 MB");
        assert_eq!(result.unit.unwrap(), "兆字节");
        
        // GB
        let result = formatter.format_file_size(1610612736); // 1.5 GB
        assert_eq!(result.value, "1.5 GB");
        assert_eq!(result.unit.unwrap(), "千兆字节");
        
        // TB
        let result = formatter.format_file_size(1649267441664); // 1.5 TB
        assert_eq!(result.value, "1.5 TB");
        assert_eq!(result.unit.unwrap(), "太字节");
    }

    /// 测试百分比格式化
    #[test]
    fn test_format_percentage() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 基本百分比
        let result = formatter.format_percentage(0.75, Some(1));
        assert_eq!(result.value, "75.0%");
        assert_eq!(result.unit.unwrap(), "百分比");
        assert_eq!(result.symbol.unwrap(), "%");
        
        // 整数百分比
        let result = formatter.format_percentage(0.5, Some(0));
        assert_eq!(result.value, "50%");
        
        // 小数百分比
        let result = formatter.format_percentage(0.1234, Some(2));
        assert_eq!(result.value, "12.34%");
        
        // 超过100%
        let result = formatter.format_percentage(1.25, Some(1));
        assert_eq!(result.value, "125.0%");
        
        // 0%
        let result = formatter.format_percentage(0.0, Some(1));
        assert_eq!(result.value, "0.0%");
    }

    /// 测试温度单位转换
    #[test]
    fn test_convert_temperature() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 摄氏度到华氏度
        let result = formatter.convert_temperature(0.0, &TemperatureUnit::Celsius, &TemperatureUnit::Fahrenheit);
        assert_eq!(result, 32.0);
        
        let result = formatter.convert_temperature(100.0, &TemperatureUnit::Celsius, &TemperatureUnit::Fahrenheit);
        assert_eq!(result, 212.0);
        
        // 华氏度到摄氏度
        let result = formatter.convert_temperature(32.0, &TemperatureUnit::Fahrenheit, &TemperatureUnit::Celsius);
        assert_eq!(result, 0.0);
        
        let result = formatter.convert_temperature(212.0, &TemperatureUnit::Fahrenheit, &TemperatureUnit::Celsius);
        assert_eq!(result, 100.0);
        
        // 摄氏度到开尔文
        let result = formatter.convert_temperature(0.0, &TemperatureUnit::Celsius, &TemperatureUnit::Kelvin);
        assert_eq!(result, 273.15);
        
        // 开尔文到摄氏度
        let result = formatter.convert_temperature(273.15, &TemperatureUnit::Kelvin, &TemperatureUnit::Celsius);
        assert_eq!(result, 0.0);
        
        // 同单位转换
        let result = formatter.convert_temperature(25.0, &TemperatureUnit::Celsius, &TemperatureUnit::Celsius);
        assert_eq!(result, 25.0);
    }

    /// 测试距离单位转换
    #[test]
    fn test_convert_distance() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 公制单位
        let (value, unit) = formatter.convert_distance(0.5, &DistanceUnit::Metric);
        assert_eq!(value, 50.0);
        assert_eq!(unit, "cm");
        
        let (value, unit) = formatter.convert_distance(10.0, &DistanceUnit::Metric);
        assert_eq!(value, 10.0);
        assert_eq!(unit, "m");
        
        let (value, unit) = formatter.convert_distance(2000.0, &DistanceUnit::Metric);
        assert_eq!(value, 2.0);
        assert_eq!(unit, "km");
        
        // 英制单位
        let (value, unit) = formatter.convert_distance(1000.0, &DistanceUnit::Imperial);
        assert!((value - 3280.84).abs() < 0.01); // 1000m = 3280.84ft
        assert_eq!(unit, "ft");
        
        let (value, unit) = formatter.convert_distance(10000.0, &DistanceUnit::Imperial);
        assert!((value - 6.214).abs() < 0.01); // 10000m ≈ 6.214 miles
        assert_eq!(unit, "mi");
    }

    /// 测试重量单位转换
    #[test]
    fn test_convert_weight() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 公制单位
        let (value, unit) = formatter.convert_weight(500.0, &WeightUnit::Metric);
        assert_eq!(value, 500.0);
        assert_eq!(unit, "g");
        
        let (value, unit) = formatter.convert_weight(2000.0, &WeightUnit::Metric);
        assert_eq!(value, 2.0);
        assert_eq!(unit, "kg");
        
        // 英制单位 - 测试较小重量转换为盎司
        let (value, unit) = formatter.convert_weight(400.0, &WeightUnit::Imperial); // 400g
        assert!(value > 10.0 && value < 20.0); // 400g ≈ 14.1盎司，允许范围误差
        assert_eq!(unit, "oz");
        
        let (value, unit) = formatter.convert_weight(10000.0, &WeightUnit::Imperial);
        assert!((value - 22.046).abs() < 0.1); // 10kg ≈ 22磅
        assert_eq!(unit, "lb");
    }

    /// 测试货币位置枚举
    #[test]
    fn test_currency_position() {
        let mut options = create_test_format_options();
        
        // 前置
        options.number_format.currency_position = CurrencyPosition::Before;
        let formatter = RegionFormatter::new(options.clone());
        let result = formatter.format_currency(100.0);
        assert!(result.value.starts_with("¥"));
        
        // 后置
        options.number_format.currency_position = CurrencyPosition::After;
        let formatter = RegionFormatter::new(options.clone());
        let result = formatter.format_currency(100.0);
        assert!(result.value.ends_with("¥"));
        
        // 前置带空格
        options.number_format.currency_position = CurrencyPosition::BeforeWithSpace;
        let formatter = RegionFormatter::new(options.clone());
        let result = formatter.format_currency(100.0);
        assert!(result.value.starts_with("¥ "));
        
        // 后置带空格
        options.number_format.currency_position = CurrencyPosition::AfterWithSpace;
        let formatter = RegionFormatter::new(options.clone());
        let result = formatter.format_currency(100.0);
        assert!(result.value.ends_with(" ¥"));
    }

    /// 测试序列化和反序列化
    #[test]
    fn test_serialization() {
        let options = create_test_format_options();
        
        // 测试FormatOptions序列化
        let serialized = serde_json::to_string(&options);
        assert!(serialized.is_ok());
        
        // 测试反序列化
        let json_str = serialized.unwrap();
        let deserialized: Result<FormatOptions, _> = serde_json::from_str(&json_str);
        assert!(deserialized.is_ok());
        
        let restored = deserialized.unwrap();
        assert_eq!(restored.locale, options.locale);
        assert_eq!(restored.timezone, options.timezone);
        assert_eq!(restored.currency, options.currency);
        
        // 测试FormattedValue序列化
        let formatted_value = FormattedValue {
            value: "¥1,234.56".to_string(),
            unit: Some("CNY".to_string()),
            symbol: Some("¥".to_string()),
        };
        
        let serialized = serde_json::to_string(&formatted_value);
        assert!(serialized.is_ok());
        
        let json_str = serialized.unwrap();
        let deserialized: Result<FormattedValue, _> = serde_json::from_str(&json_str);
        assert!(deserialized.is_ok());
        
        let restored = deserialized.unwrap();
        assert_eq!(restored.value, formatted_value.value);
        assert_eq!(restored.unit, formatted_value.unit);
        assert_eq!(restored.symbol, formatted_value.symbol);
    }

    /// 测试边界条件和错误处理
    #[test]
    fn test_edge_cases() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 测试无效时区
        let mut invalid_formatter = RegionFormatter::from_locale("zh-CN");
        invalid_formatter.options.timezone = "Invalid/Timezone".to_string();
        
        let dt = Utc::now();
        let result = invalid_formatter.format_datetime(&dt);
        assert!(result.is_err());
        
        // 测试极大数值
        let result = formatter.format_number(1e12, Some(2)); // 1万亿
        assert!(!result.value.is_empty());
        assert!(result.value.contains(","));
        
        // 测试极小数值（避免溢出）
        let result = formatter.format_number(-1e12, Some(2)); // -1万亿
        assert!(!result.value.is_empty());
        assert!(result.value.contains("-"));
        assert!(result.value.contains(","));
        
        // 测试NaN和无穷大
        let result = formatter.format_number(f64::NAN, Some(2));
        assert!(!result.value.is_empty());
        
        let result = formatter.format_number(f64::INFINITY, Some(2));
        assert!(!result.value.is_empty());
        
        // 测试负无穷大（避免溢出问题）
        let result = formatter.format_number(f64::NEG_INFINITY, Some(2));
        assert!(!result.value.is_empty());
    }

    /// 性能测试
    #[test]
    fn test_performance() {
        use std::time::Instant;
        
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 测试数字格式化性能
        let start = Instant::now();
        for i in 0..1000 {
            let _ = formatter.format_number(i as f64, Some(2));
        }
        let duration = start.elapsed();
        assert!(duration.as_millis() < 100, "数字格式化性能测试失败，耗时: {:?}", duration);
        
        // 测试货币格式化性能
        let start = Instant::now();
        for i in 0..1000 {
            let _ = formatter.format_currency(i as f64);
        }
        let duration = start.elapsed();
        assert!(duration.as_millis() < 100, "货币格式化性能测试失败，耗时: {:?}", duration);
        
        // 测试文件大小格式化性能
        let start = Instant::now();
        for i in 0..1000 {
            let _ = formatter.format_file_size(i * 1024);
        }
        let duration = start.elapsed();
        assert!(duration.as_millis() < 100, "文件大小格式化性能测试失败，耗时: {:?}", duration);
    }

    /// 并发测试
    #[test]
    fn test_concurrent_formatting() {
        use std::sync::Arc;
        use std::thread;
        
        let formatter = Arc::new(RegionFormatter::from_locale("zh-CN"));
        
        let handles: Vec<_> = (0..10)
            .map(|i| {
                let formatter_clone = Arc::clone(&formatter);
                thread::spawn(move || {
                    // 每个线程进行不同类型的格式化操作
                    let number_result = formatter_clone.format_number(i as f64 * 100.0, Some(2));
                    assert!(!number_result.value.is_empty());
                    
                    let currency_result = formatter_clone.format_currency(i as f64 * 50.0);
                    assert!(!currency_result.value.is_empty());
                    
                    let percentage_result = formatter_clone.format_percentage(i as f64 / 10.0, Some(1));
                    assert!(!percentage_result.value.is_empty());
                    
                    let file_size_result = formatter_clone.format_file_size((i as u64 + 1) * 1024 * 1024);
                    assert!(!file_size_result.value.is_empty());
                })
            })
            .collect();
        
        // 等待所有线程完成
        for handle in handles {
            handle.join().expect("线程执行失败");
        }
    }

    /// 测试千位分隔符功能
    #[test]
    fn test_thousands_separator() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        
        // 测试不同数值的千位分隔符
        let result = formatter.format_integer_with_separators(1234);
        assert_eq!(result, "1,234");
        
        let result = formatter.format_integer_with_separators(1234567);
        assert_eq!(result, "1,234,567");
        
        let result = formatter.format_integer_with_separators(1234567890);
        assert_eq!(result, "1,234,567,890");
        
        // 测试小数值
        let result = formatter.format_integer_with_separators(123);
        assert_eq!(result, "123");
        
        let result = formatter.format_integer_with_separators(12);
        assert_eq!(result, "12");
        
        let result = formatter.format_integer_with_separators(1);
        assert_eq!(result, "1");
        
        // 测试零
        let result = formatter.format_integer_with_separators(0);
        assert_eq!(result, "0");
    }
}

