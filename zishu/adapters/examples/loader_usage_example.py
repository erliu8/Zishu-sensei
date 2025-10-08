#!/usr/bin/env python3
"""
紫舒老师适配器系统 - 动态加载器使用示例
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional

# 设置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# 导入动态加载器
from zishu.adapters.base.loader import (
    AdapterLoader,
    LoaderConfig,
    LoadRequest,
    LoadSource,
    SecurityLevel,
    CachePolicy,
    create_loader,
    create_development_loader,
    create_production_loader,
    load_adapter_from_file,
    load_adapter_from_url,
    load_adapter_from_git,
    get_default_loader,
)

logger = logging.getLogger(__name__)

# ================================
# 基础使用示例
# ================================


async def basic_usage_example():
    """基础使用示例"""
    logger.info("=== 基础使用示例 ===")

    # 创建加载器
    loader = create_loader()

    # 从文件系统加载适配器
    sample_adapter_path = Path(__file__).parent / "sample_adapter.py"

    if sample_adapter_path.exists():
        request = LoadRequest(
            source=str(sample_adapter_path),
            source_type=LoadSource.FILE_SYSTEM,
            adapter_id="sample_adapter",
        )

        result = await loader.load_adapter(request)

        if result.success:
            logger.info(f"成功加载适配器: {result.adapter_metadata.adapter_id}")
            logger.info(f"适配器类型: {result.adapter_metadata.adapter_type}")
            logger.info(f"版本: {result.adapter_metadata.version.version}")
            logger.info(f"加载时间: {result.load_time:.3f}秒")
        else:
            logger.error(f"加载失败: {result.error}")
    else:
        logger.warning("示例适配器文件不存在")


async def convenience_functions_example():
    """便利函数使用示例"""
    logger.info("=== 便利函数使用示例 ===")

    sample_adapter_path = Path(__file__).parent / "sample_adapter.py"

    if sample_adapter_path.exists():
        # 使用便利函数从文件加载
        result = await load_adapter_from_file(str(sample_adapter_path))

        if result.success:
            logger.info(f"便利函数加载成功: {result.adapter_metadata.adapter_id}")
        else:
            logger.error(f"便利函数加载失败: {result.error}")


# ================================
# 配置示例
# ================================


async def configuration_examples():
    """配置示例"""
    logger.info("=== 配置示例 ===")

    # 开发环境配置
    dev_loader = create_development_loader()
    logger.info(f"开发环境加载器配置: {dev_loader.get_status()}")

    # 生产环境配置
    prod_loader = create_production_loader()
    logger.info(f"生产环境加载器配置: {prod_loader.get_status()}")

    # 自定义配置
    custom_config = LoaderConfig(
        security_level=SecurityLevel.MODERATE,
        cache_policy=CachePolicy.VERSION_BASED,
        cache_ttl_hours=48,
        enable_hot_reload=True,
        auto_install_dependencies=False,
        max_file_size_mb=50,
    )

    custom_loader = AdapterLoader(custom_config)
    logger.info(f"自定义加载器配置: {custom_loader.get_status()}")


# ================================
# 缓存功能示例
# ================================


async def caching_example():
    """缓存功能示例"""
    logger.info("=== 缓存功能示例 ===")

    loader = create_loader()
    sample_adapter_path = Path(__file__).parent / "sample_adapter.py"

    if sample_adapter_path.exists():
        # 第一次加载（从源加载）
        start_time = asyncio.get_event_loop().time()
        result1 = await load_adapter_from_file(str(sample_adapter_path))
        first_load_time = asyncio.get_event_loop().time() - start_time

        # 第二次加载（从缓存加载）
        start_time = asyncio.get_event_loop().time()
        result2 = await load_adapter_from_file(str(sample_adapter_path))
        second_load_time = asyncio.get_event_loop().time() - start_time

        logger.info(f"第一次加载时间: {first_load_time:.3f}秒")
        logger.info(f"第二次加载时间: {second_load_time:.3f}秒")

        if result2.cache_info and result2.cache_info.get("hit"):
            logger.info("第二次加载成功使用了缓存")

        # 查看缓存统计
        cache_stats = loader.get_cache_stats()
        logger.info(f"缓存统计: {cache_stats}")


# ================================
# 热加载示例
# ================================


async def hot_reload_example():
    """热加载示例"""
    logger.info("=== 热加载示例 ===")

    loader = create_development_loader()
    sample_adapter_path = Path(__file__).parent / "sample_adapter.py"

    if sample_adapter_path.exists():
        # 启用热加载回调
        def reload_callback(result):
            if result.success:
                logger.info(f"热加载成功: {result.adapter_metadata.adapter_id}")
            else:
                logger.error(f"热加载失败: {result.error}")

        await loader.enable_hot_reload(str(sample_adapter_path), reload_callback)
        logger.info("热加载已启用，修改文件将自动重新加载")

        # 注意：在实际使用中，你需要保持程序运行以监听文件变化
        # await asyncio.sleep(10)  # 等待文件变化

        await loader.disable_hot_reload(str(sample_adapter_path))


# ================================
# 错误处理示例
# ================================


async def error_handling_example():
    """错误处理示例"""
    logger.info("=== 错误处理示例 ===")

    loader = create_loader()

    # 加载不存在的文件
    result = await load_adapter_from_file("non_existent_file.py")
    if not result.success:
        logger.warning(f"预期错误 - 文件不存在: {result.error}")

    # 尝试从无效URL加载
    try:
        result = await load_adapter_from_url(
            "http://invalid-url-that-does-not-exist.com/adapter.py"
        )
        if not result.success:
            logger.warning(f"预期错误 - 无效URL: {result.error}")
    except Exception as e:
        logger.warning(f"预期异常 - 网络错误: {e}")


# ================================
# 批量加载示例
# ================================


async def batch_loading_example():
    """批量加载示例"""
    logger.info("=== 批量加载示例 ===")

    loader = create_loader()

    # 准备加载请求列表
    requests = []

    # 添加文件系统源
    sample_adapter_path = Path(__file__).parent / "sample_adapter.py"
    if sample_adapter_path.exists():
        requests.append(
            LoadRequest(
                source=str(sample_adapter_path), source_type=LoadSource.FILE_SYSTEM
            )
        )

    # 并发加载多个适配器
    tasks = [loader.load_adapter(request) for request in requests]

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"请求 {i} 加载异常: {result}")
            elif result.success:
                logger.info(f"请求 {i} 加载成功: {result.adapter_metadata.adapter_id}")
            else:
                logger.error(f"请求 {i} 加载失败: {result.error}")


# ================================
# 适配器验证示例
# ================================


async def validation_example():
    """适配器验证示例"""
    logger.info("=== 适配器验证示例 ===")

    loader = create_loader()
    sample_adapter_path = Path(__file__).parent / "sample_adapter.py"

    if sample_adapter_path.exists():
        # 只验证不加载
        request = LoadRequest(
            source=str(sample_adapter_path),
            source_type=LoadSource.FILE_SYSTEM,
            validate_only=True,
        )

        result = await loader.load_adapter(request)

        if result.success:
            logger.info("适配器验证通过")
            if result.validation_info:
                logger.info(f"验证详情: {result.validation_info}")
        else:
            logger.error(f"适配器验证失败: {result.error}")


# ================================
# 性能监控示例
# ================================


async def performance_monitoring_example():
    """性能监控示例"""
    logger.info("=== 性能监控示例 ===")

    loader = create_loader()

    # 查看加载器状态
    status = loader.get_status()
    logger.info(f"加载器状态: {status}")

    # 查看加载历史
    history = loader.get_load_history(5)
    logger.info(f"最近加载历史 ({len(history)} 条):")
    for entry in history:
        logger.info(f"  - {entry['request']['source']} -> {entry['result']['success']}")


# ================================
# 依赖管理示例
# ================================


async def dependency_management_example():
    """依赖管理示例"""
    logger.info("=== 依赖管理示例 ===")

    # 创建支持自动安装依赖的加载器
    config = LoaderConfig(auto_install_dependencies=True)
    loader = AdapterLoader(config)

    sample_adapter_path = Path(__file__).parent / "sample_adapter.py"

    if sample_adapter_path.exists():
        result = await load_adapter_from_file(str(sample_adapter_path), loader=loader)

        if result.success:
            logger.info("依赖管理加载成功")
            if hasattr(result.adapter_metadata, "dependencies"):
                logger.info(f"适配器依赖: {result.adapter_metadata.dependencies}")
        else:
            logger.error(f"依赖管理加载失败: {result.error}")


# ================================
# 清理示例
# ================================


async def cleanup_example():
    """清理示例"""
    logger.info("=== 清理示例 ===")

    loader = create_loader()

    # 清理所有缓存
    await loader.clear_cache()
    logger.info("已清理所有缓存")

    # 清理特定适配器的缓存
    # await loader.clear_cache("sample_adapter")

    # 清理加载器资源
    await loader.cleanup()
    logger.info("已清理加载器资源")


# ================================
# 高级功能示例
# ================================


async def advanced_features_example():
    """高级功能示例"""
    logger.info("=== 高级功能示例 ===")

    # 创建具有严格安全设置的加载器
    strict_config = LoaderConfig(
        security_level=SecurityLevel.STRICT,
        forbidden_imports={"os.system", "subprocess", "eval", "exec"},
        max_complexity_score=5,
    )

    strict_loader = AdapterLoader(strict_config)
    logger.info("创建了严格安全设置的加载器")

    # 创建包含白名单的加载器
    whitelist_config = LoaderConfig(
        allowed_sources={str(Path(__file__).parent)},
        security_level=SecurityLevel.MODERATE,
    )

    whitelist_loader = AdapterLoader(whitelist_config)
    logger.info("创建了白名单加载器")


# ================================
# 主函数
# ================================


async def main():
    """主函数 - 运行所有示例"""
    logger.info("开始运行适配器动态加载器示例")

    try:
        await basic_usage_example()
        await convenience_functions_example()
        await configuration_examples()
        await caching_example()
        await hot_reload_example()
        await error_handling_example()
        await batch_loading_example()
        await validation_example()
        await performance_monitoring_example()
        await dependency_management_example()
        await advanced_features_example()
        await cleanup_example()

    except Exception as e:
        logger.error(f"示例运行出错: {e}", exc_info=True)

    logger.info("适配器动态加载器示例运行完成")


if __name__ == "__main__":
    # 运行示例
    asyncio.run(main())
