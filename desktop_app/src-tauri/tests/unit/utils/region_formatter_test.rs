// 测试区域格式化功能
use chrono::{Utc, NaiveDate, TimeZone};
use zishu_sensei::utils::region_formatter::*;

// ========== FormatOptions 测试 ==========

mod format_options {
    use super::*;

    #[test]
    fn test_serialization() {
        let options = FormatOptions {
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
        };

        let json = serde_json::to_string(&options).unwrap();
        let deserialized: FormatOptions = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.locale, options.locale);
        assert_eq!(deserialized.currency, options.currency);
    }
}

// ========== RegionFormatter 基础测试 ==========

mod region_formatter_basic {
    use super::*;

    #[test]
    fn test_from_locale_zh_cn() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let config = formatter.get_config();

        assert_eq!(config.locale, "zh-CN");
        assert_eq!(config.timezone, "Asia/Shanghai");
        assert_eq!(config.currency, "CNY");
    }

    #[test]
    fn test_from_locale_en_us() {
        let formatter = RegionFormatter::from_locale("en-US");
        let config = formatter.get_config();

        assert_eq!(config.locale, "en-US");
        assert_eq!(config.timezone, "America/New_York");
        assert_eq!(config.currency, "USD");
    }

    #[test]
    fn test_from_locale_ja_jp() {
        let formatter = RegionFormatter::from_locale("ja-JP");
        let config = formatter.get_config();

        assert_eq!(config.locale, "ja-JP");
        assert_eq!(config.timezone, "Asia/Tokyo");
        assert_eq!(config.currency, "JPY");
    }

    #[test]
    fn test_from_locale_unknown() {
        let formatter = RegionFormatter::from_locale("unknown");
        let config = formatter.get_config();

        // 未知locale应该使用默认的中文配置
        assert_eq!(config.locale, "zh-CN");
    }
}

// ========== 数字格式化测试 ==========

mod number_formatting {
    use super::*;

    #[test]
    fn test_format_number_simple() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_number(1234.56, Some(2));

        assert!(result.value.contains("1,234"));
        assert!(result.value.contains(".56"));
    }

    #[test]
    fn test_format_number_large() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_number(1234567.89, Some(2));

        assert!(result.value.contains("1,234,567"));
        assert!(result.value.contains(".89"));
    }

    #[test]
    fn test_format_number_zero_decimal() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_number(1234.0, Some(0));

        assert_eq!(result.value, "1,234");
    }

    #[test]
    fn test_format_number_negative() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_number(-1234.56, Some(2));

        assert!(result.value.starts_with('-'));
        assert!(result.value.contains("1,234"));
    }

    #[test]
    fn test_format_number_small() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_number(0.123, Some(3));

        assert!(result.value.contains("0.123"));
    }

    #[test]
    fn test_format_number_german_style() {
        let formatter = RegionFormatter::from_locale("de-DE");
        let result = formatter.format_number(1234.56, Some(2));

        // 德语使用点作为千位分隔符，逗号作为小数分隔符
        assert!(result.value.contains("1.234") || result.value.contains("1234"));
        assert!(result.value.contains(",56"));
    }

    #[test]
    fn test_format_number_french_style() {
        let formatter = RegionFormatter::from_locale("fr-FR");
        let result = formatter.format_number(1234.56, Some(2));

        // 法语使用空格作为千位分隔符，逗号作为小数分隔符
        assert!(result.value.contains(",56"));
    }
}

// ========== 货币格式化测试 ==========

mod currency_formatting {
    use super::*;

    #[test]
    fn test_format_currency_cny() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_currency(1234.56);

        assert!(result.value.contains("¥"));
        assert!(result.value.contains("1,234.56"));
        assert_eq!(result.unit, Some("CNY".to_string()));
        assert_eq!(result.symbol, Some("¥".to_string()));
    }

    #[test]
    fn test_format_currency_usd() {
        let formatter = RegionFormatter::from_locale("en-US");
        let result = formatter.format_currency(1234.56);

        assert!(result.value.contains("$"));
        assert!(result.value.contains("1,234.56"));
        assert_eq!(result.unit, Some("USD".to_string()));
    }

    #[test]
    fn test_format_currency_jpy() {
        let formatter = RegionFormatter::from_locale("ja-JP");
        let result = formatter.format_currency(1234.56);

        assert!(result.value.contains("¥"));
        assert_eq!(result.unit, Some("JPY".to_string()));
    }

    #[test]
    fn test_format_currency_eur_after() {
        let formatter = RegionFormatter::from_locale("de-DE");
        let result = formatter.format_currency(1234.56);

        assert!(result.value.contains("€"));
        assert_eq!(result.unit, Some("EUR".to_string()));
        // 德语中欧元符号在后面
        assert!(result.value.ends_with(" €") || result.value.ends_with("€"));
    }

    #[test]
    fn test_format_currency_negative() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_currency(-1234.56);

        assert!(result.value.contains("-"));
        assert!(result.value.contains("¥"));
    }

    #[test]
    fn test_format_currency_zero() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_currency(0.0);

        assert!(result.value.contains("¥"));
        assert!(result.value.contains("0.00"));
    }
}

// ========== 日期时间格式化测试 ==========

mod datetime_formatting {
    use super::*;

    #[test]
    fn test_format_datetime_zh_cn() -> Result<(), String> {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let dt = Utc.with_ymd_and_hms(2025, 10, 21, 14, 30, 0).unwrap();

        let result = formatter.format_datetime(&dt)?;

        assert!(result.value.contains("2025"));
        assert!(result.value.contains("10"));
        assert!(result.value.contains("21"));
        assert!(result.unit.is_some());

        Ok(())
    }

    #[test]
    fn test_format_datetime_en_us() -> Result<(), String> {
        let formatter = RegionFormatter::from_locale("en-US");
        let dt = Utc.with_ymd_and_hms(2025, 10, 21, 14, 30, 0).unwrap();

        let result = formatter.format_datetime(&dt)?;

        // 美国日期格式：MM/DD/YYYY
        assert!(result.value.contains("10/21/2025") ||
                result.value.contains("2025"));

        Ok(())
    }

    #[test]
    fn test_format_datetime_ja_jp() -> Result<(), String> {
        let formatter = RegionFormatter::from_locale("ja-JP");
        let dt = Utc.with_ymd_and_hms(2025, 10, 21, 14, 30, 0).unwrap();

        let result = formatter.format_datetime(&dt)?;

        assert!(result.value.contains("2025年"));
        assert!(result.value.contains("10月"));
        assert!(result.value.contains("21日"));

        Ok(())
    }

    #[test]
    fn test_format_date_chinese() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let date = NaiveDate::from_ymd_opt(2025, 10, 21).unwrap()
            .and_hms_opt(0, 0, 0).unwrap();

        let result = formatter.format_date(&date);

        assert!(result.value.contains("2025年"));
        assert!(result.value.contains("10月"));
        assert!(result.value.contains("21日"));
    }

    #[test]
    fn test_format_time_24h() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let time = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap()
            .and_hms_opt(14, 30, 45).unwrap();

        let result = formatter.format_time(&time);

        assert!(result.value.contains("14"));
        assert!(result.value.contains("30"));
        assert!(result.value.contains("45"));
    }

    #[test]
    fn test_format_time_12h() {
        let formatter = RegionFormatter::from_locale("en-US");
        let time = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap()
            .and_hms_opt(14, 30, 45).unwrap();

        let result = formatter.format_time(&time);

        // 12小时制应该包含PM
        assert!(result.value.contains("PM") || result.value.contains("02"));
    }
}

// ========== 温度格式化测试 ==========

mod temperature_formatting {
    use super::*;

    #[test]
    fn test_format_temperature_celsius() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_temperature(25.0);

        assert!(result.value.contains("25"));
        assert!(result.value.contains("°C"));
        assert_eq!(result.unit, Some("摄氏度".to_string()));
    }

    #[test]
    fn test_format_temperature_fahrenheit() {
        let formatter = RegionFormatter::from_locale("en-US");
        let result = formatter.format_temperature(25.0);

        assert!(result.value.contains("°F"));
        assert_eq!(result.unit, Some("华氏度".to_string()));
        // 25°C = 77°F
        assert!(result.value.contains("77"));
    }

    #[test]
    fn test_format_temperature_negative() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_temperature(-10.0);

        assert!(result.value.contains("-10"));
        assert!(result.value.contains("°C"));
    }

    #[test]
    fn test_format_temperature_zero() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_temperature(0.0);

        assert!(result.value.contains("0"));
        assert!(result.value.contains("°C"));
    }

    #[test]
    fn test_convert_temperature_c_to_f() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.convert_temperature(
            0.0,
            &TemperatureUnit::Celsius,
            &TemperatureUnit::Fahrenheit
        );

        assert_eq!(result, 32.0);
    }

    #[test]
    fn test_convert_temperature_f_to_c() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.convert_temperature(
            32.0,
            &TemperatureUnit::Fahrenheit,
            &TemperatureUnit::Celsius
        );

        assert_eq!(result, 0.0);
    }

    #[test]
    fn test_convert_temperature_c_to_k() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.convert_temperature(
            0.0,
            &TemperatureUnit::Celsius,
            &TemperatureUnit::Kelvin
        );

        assert_eq!(result, 273.15);
    }
}

// ========== 距离格式化测试 ==========

mod distance_formatting {
    use super::*;

    #[test]
    fn test_format_distance_meters() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_distance(500.0);

        assert!(result.value.contains("500"));
        assert!(result.value.contains(" m"));
        assert_eq!(result.symbol, Some("m".to_string()));
    }

    #[test]
    fn test_format_distance_kilometers() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_distance(5000.0);

        assert!(result.value.contains("5"));
        assert!(result.value.contains(" km"));
        assert_eq!(result.symbol, Some("km".to_string()));
    }

    #[test]
    fn test_format_distance_centimeters() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_distance(0.5);

        assert!(result.value.contains("50"));
        assert!(result.value.contains(" cm"));
        assert_eq!(result.symbol, Some("cm".to_string()));
    }

    #[test]
    fn test_format_distance_imperial_miles() {
        let formatter = RegionFormatter::from_locale("en-US");
        let result = formatter.format_distance(2000.0);

        assert!(result.value.contains(" mi"));
        assert_eq!(result.symbol, Some("mi".to_string()));
    }

    #[test]
    fn test_format_distance_imperial_feet() {
        let formatter = RegionFormatter::from_locale("en-US");
        let result = formatter.format_distance(100.0);

        assert!(result.value.contains(" ft"));
        assert_eq!(result.symbol, Some("ft".to_string()));
    }

    #[test]
    fn test_convert_distance_metric() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let (value, unit) = formatter.convert_distance(1000.0, &DistanceUnit::Metric);

        assert_eq!(value, 1.0);
        assert_eq!(unit, "km");
    }
}

// ========== 重量格式化测试 ==========

mod weight_formatting {
    use super::*;

    #[test]
    fn test_format_weight_grams() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_weight(500.0);

        assert!(result.value.contains("500"));
        assert!(result.value.contains(" g"));
        assert_eq!(result.symbol, Some("g".to_string()));
    }

    #[test]
    fn test_format_weight_kilograms() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_weight(5000.0);

        assert!(result.value.contains("5"));
        assert!(result.value.contains(" kg"));
        assert_eq!(result.symbol, Some("kg".to_string()));
    }

    #[test]
    fn test_format_weight_imperial_pounds() {
        let formatter = RegionFormatter::from_locale("en-US");
        let result = formatter.format_weight(1000.0);

        assert!(result.value.contains(" lb"));
        assert_eq!(result.symbol, Some("lb".to_string()));
    }

    #[test]
    fn test_format_weight_imperial_ounces() {
        let formatter = RegionFormatter::from_locale("en-US");
        let result = formatter.format_weight(100.0);

        assert!(result.value.contains(" oz"));
        assert_eq!(result.symbol, Some("oz".to_string()));
    }

    #[test]
    fn test_convert_weight_metric() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let (value, unit) = formatter.convert_weight(1000.0, &WeightUnit::Metric);

        assert_eq!(value, 1.0);
        assert_eq!(unit, "kg");
    }
}

// ========== 文件大小格式化测试 ==========

mod file_size_formatting {
    use super::*;

    #[test]
    fn test_format_file_size_bytes() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_file_size(500);

        assert!(result.value.contains("500"));
        assert!(result.value.contains(" B"));
    }

    #[test]
    fn test_format_file_size_kb() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_file_size(5 * 1024);

        assert!(result.value.contains("5"));
        assert!(result.value.contains(" KB"));
    }

    #[test]
    fn test_format_file_size_mb() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_file_size(5 * 1024 * 1024);

        assert!(result.value.contains("5"));
        assert!(result.value.contains(" MB"));
    }

    #[test]
    fn test_format_file_size_gb() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_file_size(5 * 1024 * 1024 * 1024);

        assert!(result.value.contains("5"));
        assert!(result.value.contains(" GB"));
    }

    #[test]
    fn test_format_file_size_zero() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_file_size(0);

        assert_eq!(result.value, "0 B");
    }

    #[test]
    fn test_format_file_size_tb() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_file_size(5 * 1024u64.pow(4));

        assert!(result.value.contains("5"));
        assert!(result.value.contains(" TB"));
    }
}

// ========== 百分比格式化测试 ==========

mod percentage_formatting {
    use super::*;

    #[test]
    fn test_format_percentage() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_percentage(0.75, None);

        assert!(result.value.contains("75"));
        assert!(result.value.contains("%"));
    }

    #[test]
    fn test_format_percentage_with_decimals() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_percentage(0.7534, Some(2));

        assert!(result.value.contains("75.3"));
        assert!(result.value.contains("%"));
    }

    #[test]
    fn test_format_percentage_zero() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_percentage(0.0, None);

        assert!(result.value.contains("0"));
        assert!(result.value.contains("%"));
    }

    #[test]
    fn test_format_percentage_over_100() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_percentage(1.5, None);

        assert!(result.value.contains("150"));
        assert!(result.value.contains("%"));
    }
}

// ========== Edge Cases 测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_format_number_very_large() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_number(999_999_999.99, Some(2));

        assert!(result.value.contains("999,999,999"));
    }

    #[test]
    fn test_format_number_very_small() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_number(0.00001, Some(5));

        assert!(result.value.contains("0.00001"));
    }

    #[test]
    fn test_format_currency_fractional_cents() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_currency(0.01);

        assert!(result.value.contains("0.01"));
    }

    #[test]
    fn test_format_temperature_extreme_cold() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_temperature(-273.15);

        assert!(result.value.contains("-273"));
    }

    #[test]
    fn test_format_temperature_extreme_hot() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_temperature(1000.0);

        assert!(result.value.contains("1000"));
    }

    #[test]
    fn test_format_file_size_max() {
        let formatter = RegionFormatter::from_locale("zh-CN");
        let result = formatter.format_file_size(u64::MAX);

        assert!(result.value.contains("EB") || result.value.contains("PB"));
    }
}

// ========== Integration Tests 测试 ==========

mod integration {
    use super::*;

    #[test]
    fn test_full_localization_workflow_chinese() -> Result<(), String> {
        let formatter = RegionFormatter::from_locale("zh-CN");

        // 数字
        let num = formatter.format_number(1234.56, Some(2));
        assert!(num.value.contains("1,234.56"));

        // 货币
        let currency = formatter.format_currency(999.99);
        assert!(currency.value.contains("¥"));

        // 温度
        let temp = formatter.format_temperature(25.0);
        assert!(temp.value.contains("°C"));

        // 距离
        let dist = formatter.format_distance(1500.0);
        assert!(dist.value.contains("km") || dist.value.contains("m"));

        // 文件大小
        let size = formatter.format_file_size(1024 * 1024);
        assert!(size.value.contains("MB"));

        // 百分比
        let pct = formatter.format_percentage(0.85, Some(1));
        assert!(pct.value.contains("%"));

        Ok(())
    }

    #[test]
    fn test_full_localization_workflow_english() -> Result<(), String> {
        let formatter = RegionFormatter::from_locale("en-US");

        let num = formatter.format_number(1234.56, Some(2));
        assert!(num.value.contains("1,234.56"));

        let currency = formatter.format_currency(999.99);
        assert!(currency.value.contains("$"));

        let temp = formatter.format_temperature(25.0);
        assert!(temp.value.contains("°F"));

        Ok(())
    }
}

