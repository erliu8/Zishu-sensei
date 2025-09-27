#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zishu-sensei 配置管理系统使用示例

这个示例展示了如何在项目中使用强大的配置管理系统。
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from zishu.adapters.utils.config import (
    ConfigManager,
    ConfigManagerOptions,
    Environment,
    load_config,
    get_config_value,
    with_config
)

def basic_usage_example():
    """基础使用示例"""
    print("=" * 60)
    print("📖 基础配置加载示例")
    print("=" * 60)
    
    try:
        # 方式1：使用便捷函数
        config = load_config("default")
        print(f"✅ 配置加载成功，共 {len(config)} 个配置项")
        
        # 获取特定配置值
        server_port = get_config_value("server.port", 8080)
        print(f"📡 服务器端口: {server_port}")
        
        app_name = get_config_value("app_name", "Unknown App")
        print(f"🚀 应用名称: {app_name}")
        
    except Exception as e:
        print(f"❌ 配置加载失败: {e}")


def advanced_usage_example():
    """高级使用示例"""
    print("\n" + "=" * 60)
    print("🔧 高级配置管理示例")
    print("=" * 60)
    
    # 创建自定义配置管理器
    options = ConfigManagerOptions(
        config_dir=Path("config"),
        environment=Environment.DEVELOPMENT,
        auto_reload=True,
        cache_enabled=True,
        validation_enabled=True,
        encryption_enabled=False  # 在生产环境中启用
    )
    
    with ConfigManager(options) as manager:
        try:
            # 加载不同环境的配置
            dev_config = manager.load_config("default", Environment.DEVELOPMENT)
            print(f"🔄 开发环境配置: {len(dev_config)} 项")
            
            # 获取环境信息
            env_info = manager.get_environment_info()
            print(f"🌍 当前环境: {env_info['current_environment']}")
            print(f"📁 配置目录: {env_info['config_directory']}")
            print(f"💾 缓存状态: {'启用' if env_info['cache_enabled'] else '禁用'}")
            print(f"🔄 热重载: {'启用' if env_info['auto_reload'] else '禁用'}")
            
            # 配置值验证示例
            print("\n📋 配置验证示例:")
            
            # 添加自定义验证器
            manager.validator.add_validator(
                "server.workers",
                lambda x: isinstance(x, int) and x > 0 and x <= 10
            )
            
            manager.validator.add_required_field("app_name")
            
            # 重新验证配置
            if manager.options.validation_enabled:
                errors = manager.validator.validate(dev_config)
                if errors:
                    print(f"⚠️  配置验证警告: {'; '.join(errors)}")
                else:
                    print("✅ 配置验证通过")
            
        except Exception as e:
            print(f"❌ 高级配置管理失败: {e}")


def decorator_usage_example():
    """装饰器使用示例"""
    print("\n" + "=" * 60)
    print("🎯 配置装饰器使用示例")
    print("=" * 60)
    
    @with_config("default", Environment.DEVELOPMENT)
    def start_server(config):
        """使用配置启动服务器的示例函数"""
        host = config.get("server", {}).get("host", "localhost")
        port = config.get("server", {}).get("port", 8080)
        debug = config.get("server", {}).get("debug", False)
        
        print(f"🚀 启动服务器配置:")
        print(f"   主机: {host}")
        print(f"   端口: {port}")
        print(f"   调试模式: {'开启' if debug else '关闭'}")
        
        return f"服务器已配置为运行在 {host}:{port}"
    
    try:
        result = start_server()
        print(f"✅ {result}")
    except Exception as e:
        print(f"❌ 装饰器示例失败: {e}")


def environment_variable_example():
    """环境变量替换示例"""
    print("\n" + "=" * 60)
    print("🔧 环境变量替换示例")
    print("=" * 60)
    
    # 设置一些示例环境变量
    os.environ["ZISHU_TEST_VAR"] = "test_value_from_env"
    os.environ["ZISHU_PORT"] = "9000"
    
    try:
        config = load_config("default")
        
        # 如果配置文件中有 ${ZISHU_TEST_VAR} 这样的变量，会被自动替换
        print("🔄 环境变量替换功能已集成")
        print("   支持格式: ${VAR_NAME} 或 ${VAR_NAME:default_value}")
        print(f"   示例变量: ZISHU_TEST_VAR = {os.environ.get('ZISHU_TEST_VAR')}")
        
        # 演示配置中可能包含的环境变量
        if "providers" in config:
            print("🔑 API配置中通常使用环境变量保护敏感信息")
            providers = config["providers"]
            for provider_name, provider_config in providers.items():
                if isinstance(provider_config, dict) and "api_key" in provider_config:
                    api_key = provider_config["api_key"]
                    if api_key.startswith("${") or api_key.startswith("your-"):
                        print(f"   {provider_name}: 需要配置环境变量")
                    else:
                        print(f"   {provider_name}: 已配置")
        
    except Exception as e:
        print(f"❌ 环境变量示例失败: {e}")


def configuration_best_practices():
    """配置管理最佳实践"""
    print("\n" + "=" * 60)
    print("💡 配置管理最佳实践")
    print("=" * 60)
    
    practices = [
        "1. 🔐 敏感信息使用环境变量: API keys, passwords, secrets",
        "2. 🌍 不同环境使用不同配置文件: dev.yml, prod.yml, test.yml", 
        "3. 📝 为配置添加注释和文档",
        "4. ✅ 使用配置验证确保数据正确性",
        "5. 🔄 利用热重载功能快速开发调试",
        "6. 💾 合理使用缓存提高性能",
        "7. 📋 使用类型约束和必填字段验证",
        "8. 🗂️ 组织配置结构，使用嵌套配置",
        "9. 🔙 启用配置备份避免数据丢失",
        "10. 📊 监控配置变更和错误日志"
    ]
    
    for practice in practices:
        print(f"   {practice}")
    
    print("\n🎯 项目中的配置文件结构:")
    print("   config/")
    print("   ├── default.yml           # 基础配置")
    print("   ├── environments/")
    print("   │   ├── development.yml   # 开发环境")
    print("   │   ├── testing.yml       # 测试环境")
    print("   │   ├── staging.yml       # 预发布环境")
    print("   │   └── production.yml    # 生产环境")
    print("   ├── services/             # 服务配置")
    print("   ├── integrations/         # 集成配置")
    print("   └── security/             # 安全配置")


def error_handling_example():
    """错误处理示例"""
    print("\n" + "=" * 60)
    print("🛡️ 错误处理示例")
    print("=" * 60)
    
    from zishu.adapters.utils.config import (
        ConfigException, 
        ConfigLoadError, 
        ConfigValidationError,
        ConfigEncryptionError
    )
    
    try:
        # 尝试加载不存在的配置
        config = load_config("nonexistent_config")
    except ConfigLoadError as e:
        print(f"📂 配置文件加载错误: {e}")
    except ConfigValidationError as e:
        print(f"✅ 配置验证错误: {e}")
    except ConfigException as e:
        print(f"⚠️  通用配置错误: {e}")
    except Exception as e:
        print(f"❌ 未知错误: {e}")
    
    print("✅ 错误处理完成")


def main():
    """主函数 - 运行所有示例"""
    print("🚀 Zishu-sensei 配置管理系统使用示例")
    print("欢迎使用最强大的配置管理解决方案！")
    
    # 运行所有示例
    basic_usage_example()
    advanced_usage_example()
    decorator_usage_example()
    environment_variable_example()
    configuration_best_practices()
    error_handling_example()
    
    print("\n" + "=" * 60)
    print("🎉 所有示例运行完成！")
    print("📚 请查看 config.py 了解更多功能详情")
    print("=" * 60)


if __name__ == "__main__":
    main()
