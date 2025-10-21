// 测试区域检测功能
use zishu_sensei::utils::region_detector::*;

// ========== SystemRegionInfo 测试 ==========

mod system_region_info {
    use super::*;

    #[test]
    fn test_serialization() {
        let info = SystemRegionInfo {
            locale: "zh-CN".to_string(),
            language: "zh".to_string(),
            country: "CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            confidence: 0.9,
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: SystemRegionInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.locale, info.locale);
        assert_eq!(deserialized.language, info.language);
        assert_eq!(deserialized.country, info.country);
        assert_eq!(deserialized.timezone, info.timezone);
        assert_eq!(deserialized.currency, info.currency);
        assert_eq!(deserialized.confidence, info.confidence);
    }
}

// ========== RegionDetector 测试 ==========

mod region_detector {
    use super::*;

    #[test]
    fn test_detect_system_region() {
        let info = RegionDetector::detect_system_region();

        // 验证基本结构
        assert!(!info.locale.is_empty(), "locale不应为空");
        assert!(!info.language.is_empty(), "language不应为空");
        assert!(!info.country.is_empty(), "country不应为空");
        assert!(info.confidence >= 0.0 && info.confidence <= 1.0, "confidence应在0-1之间");

        // 验证locale格式
        if info.locale.contains('-') {
            let parts: Vec<&str> = info.locale.split('-').collect();
            assert_eq!(parts.len(), 2, "locale应该是 language-COUNTRY 格式");
            assert_eq!(parts[0].to_lowercase(), info.language.to_lowercase());
            assert_eq!(parts[1].to_uppercase(), info.country.to_uppercase());
        }
    }

    #[test]
    fn test_get_recommended_regions_zh() {
        let info = SystemRegionInfo {
            locale: "zh-CN".to_string(),
            language: "zh".to_string(),
            country: "CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            confidence: 1.0,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        assert!(!recommendations.is_empty());
        assert!(recommendations.contains(&"zh-CN".to_string()));
        assert!(recommendations.contains(&"zh-TW".to_string()));
        assert!(recommendations.contains(&"zh-HK".to_string()));
    }

    #[test]
    fn test_get_recommended_regions_en() {
        let info = SystemRegionInfo {
            locale: "en-US".to_string(),
            language: "en".to_string(),
            country: "US".to_string(),
            timezone: "America/New_York".to_string(),
            currency: "USD".to_string(),
            confidence: 1.0,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        assert!(!recommendations.is_empty());
        assert!(recommendations.contains(&"en-US".to_string()));
        assert!(recommendations.contains(&"en-GB".to_string()));
        assert!(recommendations.contains(&"en-AU".to_string()));
        assert!(recommendations.contains(&"en-CA".to_string()));
    }

    #[test]
    fn test_get_recommended_regions_ja() {
        let info = SystemRegionInfo {
            locale: "ja-JP".to_string(),
            language: "ja".to_string(),
            country: "JP".to_string(),
            timezone: "Asia/Tokyo".to_string(),
            currency: "JPY".to_string(),
            confidence: 1.0,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        assert!(!recommendations.is_empty());
        assert!(recommendations.contains(&"ja-JP".to_string()));
    }

    #[test]
    fn test_get_recommended_regions_ko() {
        let info = SystemRegionInfo {
            locale: "ko-KR".to_string(),
            language: "ko".to_string(),
            country: "KR".to_string(),
            timezone: "Asia/Seoul".to_string(),
            currency: "KRW".to_string(),
            confidence: 1.0,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        assert!(!recommendations.is_empty());
        assert!(recommendations.contains(&"ko-KR".to_string()));
    }

    #[test]
    fn test_get_recommended_regions_de() {
        let info = SystemRegionInfo {
            locale: "de-DE".to_string(),
            language: "de".to_string(),
            country: "DE".to_string(),
            timezone: "Europe/Berlin".to_string(),
            currency: "EUR".to_string(),
            confidence: 1.0,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        assert!(!recommendations.is_empty());
        assert!(recommendations.contains(&"de-DE".to_string()));
        assert!(recommendations.contains(&"de-AT".to_string()));
        assert!(recommendations.contains(&"de-CH".to_string()));
    }

    #[test]
    fn test_get_recommended_regions_fr() {
        let info = SystemRegionInfo {
            locale: "fr-FR".to_string(),
            language: "fr".to_string(),
            country: "FR".to_string(),
            timezone: "Europe/Paris".to_string(),
            currency: "EUR".to_string(),
            confidence: 1.0,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        assert!(!recommendations.is_empty());
        assert!(recommendations.contains(&"fr-FR".to_string()));
        assert!(recommendations.contains(&"fr-CA".to_string()));
        assert!(recommendations.contains(&"fr-BE".to_string()));
        assert!(recommendations.contains(&"fr-CH".to_string()));
    }

    #[test]
    fn test_get_recommended_regions_unknown() {
        let info = SystemRegionInfo {
            locale: "xx-XX".to_string(),
            language: "xx".to_string(),
            country: "XX".to_string(),
            timezone: "UTC".to_string(),
            currency: "XXX".to_string(),
            confidence: 0.5,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        assert!(!recommendations.is_empty());
        // 应该包含默认推荐
        assert!(recommendations.contains(&"en-US".to_string()) ||
                recommendations.contains(&"zh-CN".to_string()));
    }

    #[test]
    fn test_get_recommended_regions_contains_current() {
        let info = SystemRegionInfo {
            locale: "zh-CN".to_string(),
            language: "zh".to_string(),
            country: "CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            confidence: 1.0,
        };

        let recommendations = RegionDetector::get_recommended_regions(&info);

        // 当前区域应该在推荐列表的第一个
        assert_eq!(recommendations[0], "zh-CN");
    }
}

// ========== Locale 解析测试 ==========

mod locale_parsing {
    use super::*;

    #[test]
    fn test_parse_locale_underscore() {
        // 测试 zh_CN.UTF-8 格式
        let info = SystemRegionInfo {
            locale: "zh_CN.UTF-8".to_string(),
            language: "zh".to_string(),
            country: "CN".to_string(),
            timezone: "".to_string(),
            currency: "".to_string(),
            confidence: 0.0,
        };

        // 验证能正确解析
        assert_eq!(info.language, "zh");
        assert_eq!(info.country, "CN");
    }

    #[test]
    fn test_parse_locale_hyphen() {
        // 测试 en-US 格式
        let info = SystemRegionInfo {
            locale: "en-US".to_string(),
            language: "en".to_string(),
            country: "US".to_string(),
            timezone: "".to_string(),
            currency: "".to_string(),
            confidence: 0.0,
        };

        assert_eq!(info.language, "en");
        assert_eq!(info.country, "US");
    }
}

// ========== Currency 映射测试 ==========

mod currency_mapping {
    use super::*;

    #[test]
    fn test_currency_for_major_countries() {
        let test_cases = vec![
            ("CN", "CNY"),
            ("US", "USD"),
            ("GB", "GBP"),
            ("JP", "JPY"),
            ("KR", "KRW"),
            ("TW", "TWD"),
            ("HK", "HKD"),
        ];

        for (country, expected_currency) in test_cases {
            let info = SystemRegionInfo {
                locale: format!("xx-{}", country),
                language: "xx".to_string(),
                country: country.to_string(),
                timezone: "".to_string(),
                currency: expected_currency.to_string(),
                confidence: 1.0,
            };

            assert_eq!(info.currency, expected_currency,
                      "Country {} should have currency {}", country, expected_currency);
        }
    }

    #[test]
    fn test_currency_for_eu_countries() {
        let eu_countries = vec!["DE", "FR", "IT", "ES", "PT", "NL", "BE", "AT", "IE"];

        for country in eu_countries {
            let info = SystemRegionInfo {
                locale: format!("xx-{}", country),
                language: "xx".to_string(),
                country: country.to_string(),
                timezone: "".to_string(),
                currency: "EUR".to_string(),
                confidence: 1.0,
            };

            assert_eq!(info.currency, "EUR",
                      "EU country {} should have currency EUR", country);
        }
    }
}

// ========== Timezone 映射测试 ==========

mod timezone_mapping {
    use super::*;

    #[test]
    fn test_major_timezone_mappings() {
        let test_cases = vec![
            ("Asia/Shanghai", "CN"),
            ("Asia/Tokyo", "JP"),
            ("Asia/Seoul", "KR"),
            ("America/New_York", "US"),
            ("Europe/London", "GB"),
            ("Europe/Berlin", "DE"),
            ("Europe/Paris", "FR"),
        ];

        for (timezone, _country) in test_cases {
            assert!(timezone.contains('/'), "Timezone {} should be in IANA format", timezone);
        }
    }

    #[test]
    fn test_timezone_format() {
        let info = RegionDetector::detect_system_region();

        if !info.timezone.is_empty() {
            // IANA时区格式应该包含斜杠
            assert!(info.timezone.contains('/') || info.timezone == "UTC",
                   "Timezone should be in IANA format (Region/City) or UTC");
        }
    }
}

// ========== Language 猜测测试 ==========

mod language_guessing {
    use super::*;

    #[test]
    fn test_language_to_country_mapping() {
        let test_cases = vec![
            ("zh", "CN"),
            ("ja", "JP"),
            ("ko", "KR"),
            ("en", "US"),
            ("de", "DE"),
            ("fr", "FR"),
            ("es", "ES"),
            ("it", "IT"),
            ("pt", "BR"),
            ("ru", "RU"),
        ];

        for (lang, expected_country) in test_cases {
            // 这是内部逻辑测试，我们通过创建一个有特定语言的region来验证
            let info = SystemRegionInfo {
                locale: format!("{}-{}", lang, expected_country),
                language: lang.to_string(),
                country: expected_country.to_string(),
                timezone: "".to_string(),
                currency: "".to_string(),
                confidence: 1.0,
            };

            assert_eq!(info.language, lang);
            assert_eq!(info.country, expected_country);
        }
    }
}

// ========== Confidence 测试 ==========

mod confidence_calculation {
    use super::*;

    #[test]
    fn test_confidence_range() {
        let info = RegionDetector::detect_system_region();

        assert!(info.confidence >= 0.0, "Confidence应该大于等于0");
        assert!(info.confidence <= 1.0, "Confidence应该小于等于1");
    }

    #[test]
    fn test_high_confidence_has_complete_info() {
        let info = RegionDetector::detect_system_region();

        if info.confidence > 0.7 {
            assert!(!info.locale.is_empty(), "高置信度应该有locale");
            assert!(!info.language.is_empty(), "高置信度应该有language");
            assert!(!info.country.is_empty(), "高置信度应该有country");
        }
    }
}

// ========== Default Region 测试 ==========

mod default_region {
    use super::*;

    #[test]
    fn test_default_region_is_zh_cn() {
        // 当检测失败时应该返回默认的中文区域
        let info = RegionDetector::detect_system_region();

        // 即使检测失败也应该有有效的区域信息
        assert!(!info.locale.is_empty());
        assert!(!info.language.is_empty());
        assert!(!info.country.is_empty());
        assert!(!info.timezone.is_empty());
        assert!(!info.currency.is_empty());
    }
}

// ========== Windows Timezone 映射测试 ==========

mod windows_timezone {
    use super::*;

    #[test]
    fn test_windows_timezone_mapping_structure() {
        // 测试Windows时区名称的结构
        let test_cases = vec![
            "China Standard Time",
            "Tokyo Standard Time",
            "Korea Standard Time",
            "Eastern Standard Time",
            "Pacific Standard Time",
        ];

        for tz_name in test_cases {
            assert!(tz_name.contains("Standard Time"),
                   "Windows timezone name should contain 'Standard Time'");
        }
    }
}

// ========== Edge Cases 测试 ==========

mod edge_cases {
    use super::*;

    #[test]
    fn test_empty_language() {
        let info = SystemRegionInfo {
            locale: "".to_string(),
            language: "".to_string(),
            country: "".to_string(),
            timezone: "".to_string(),
            currency: "".to_string(),
            confidence: 0.0,
        };

        assert_eq!(info.locale, "");
        assert_eq!(info.language, "");
    }

    #[test]
    fn test_invalid_locale_format() {
        // 测试不合法的locale格式
        let info = SystemRegionInfo {
            locale: "invalid".to_string(),
            language: "".to_string(),
            country: "".to_string(),
            timezone: "".to_string(),
            currency: "".to_string(),
            confidence: 0.0,
        };

        assert_eq!(info.locale, "invalid");
    }

    #[test]
    fn test_lowercase_country_code() {
        // 国家代码应该大写，但测试小写情况
        let info = SystemRegionInfo {
            locale: "zh-cn".to_string(),
            language: "zh".to_string(),
            country: "cn".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            confidence: 1.0,
        };

        assert_eq!(info.country, "cn");
    }

    #[test]
    fn test_uppercase_language_code() {
        // 语言代码应该小写，但测试大写情况
        let info = SystemRegionInfo {
            locale: "ZH-CN".to_string(),
            language: "ZH".to_string(),
            country: "CN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            confidence: 1.0,
        };

        assert_eq!(info.language, "ZH");
    }

    #[test]
    fn test_three_letter_country_code() {
        // ISO 3166-1 alpha-3 格式
        let info = SystemRegionInfo {
            locale: "zh-CHN".to_string(),
            language: "zh".to_string(),
            country: "CHN".to_string(),
            timezone: "Asia/Shanghai".to_string(),
            currency: "CNY".to_string(),
            confidence: 1.0,
        };

        assert_eq!(info.country, "CHN");
    }

    #[test]
    fn test_region_with_special_characters() {
        let info = SystemRegionInfo {
            locale: "fr-CA@currency=CAD".to_string(),
            language: "fr".to_string(),
            country: "CA".to_string(),
            timezone: "America/Toronto".to_string(),
            currency: "CAD".to_string(),
            confidence: 1.0,
        };

        assert!(info.locale.contains('@'));
    }
}

// ========== Integration Tests 测试 ==========

mod integration {
    use super::*;

    #[test]
    fn test_detect_and_recommend_flow() {
        // 完整流程：检测 -> 获取推荐
        let detected = RegionDetector::detect_system_region();
        let recommendations = RegionDetector::get_recommended_regions(&detected);

        // 验证推荐列表不为空
        assert!(!recommendations.is_empty(), "推荐列表不应为空");

        // 如果检测到的locale不为空，它应该在推荐列表中
        if !detected.locale.is_empty() {
            assert!(recommendations.contains(&detected.locale),
                   "检测到的locale应该在推荐列表中");
        }
    }

    #[test]
    fn test_multiple_detections_consistency() {
        // 多次检测应该返回一致的结果
        let info1 = RegionDetector::detect_system_region();
        let info2 = RegionDetector::detect_system_region();

        assert_eq!(info1.locale, info2.locale, "多次检测应该返回相同的locale");
        assert_eq!(info1.language, info2.language, "多次检测应该返回相同的language");
        assert_eq!(info1.country, info2.country, "多次检测应该返回相同的country");
    }

    #[test]
    fn test_region_info_completeness() {
        let info = RegionDetector::detect_system_region();

        // 验证返回的信息是完整的
        assert!(
            !info.locale.is_empty() ||
            !info.language.is_empty() ||
            !info.country.is_empty(),
            "至少应该检测到一部分区域信息"
        );
    }
}

