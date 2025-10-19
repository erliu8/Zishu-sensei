use chrono::{DateTime, Utc, TimeZone, NaiveDateTime};
use chrono_tz::{Tz, Asia, America, Europe};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

