#! /usr/bin/env python
# -*- coding: utf-8 -*-

import torch
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def check_sdpa_support() -> Dict[str, Any]:
    """检查系统是否支持SDPA高效注意力机制及其可用后端

    Returns:
        Dict[str,Any]: 包含支持情况和可用后端信息
    """
    result = {
        "sdpa_available": False,
        "mem_efficient_available": False,
        "flash_available": False,
        "math_available": False,
        "best_backend": None,
    }

    if not torch.cuda.is_available():
        logger.warning("未检测到CUDA设备，无法使用高效注意力机制")
        return result

    try:
        # 检查pyTorch版本和CUDA版本
        cuda_version = torch.version.cuda if hasattr(torch.version, "cuda") else "未知"
        logger.info(f"PyTorch版本: {torch.__version__}, CUDA版本: {cuda_version}")

        # 检查是否支持SDPA
        has_sdpa = hasattr(torch.nn.functional, "scaled_dot_product_attention")
        result["sdpa_available"] = has_sdpa

        if has_sdpa:
            logger.info("系统支持PyTorch原生SDPA")

            # 检查设备能力
            device_props = torch.cuda.get_device_properties(0)
            logger.info(
                f"设备: {device_props.name}, 计算能力: {device_props.major}.{device_props.minor}"
            )

            # 启用所有可用的SDPA后端
            torch.backends.cuda.enable_mem_efficient_sdp(True)
            torch.backends.cuda.enable_flash_sdp(True)
            torch.backends.cuda.enable_math_sdp(True)

            # 检查哪些后端可用
            result[
                "mem_efficient_available"
            ] = torch.backends.cuda.mem_efficient_sdp_enabled()
            result["flash_available"] = torch.backends.cuda.flash_sdp_enabled()
            result["math_available"] = torch.backends.cuda.math_sdp_enabled()

            if result["mem_efficient_available"]:
                logger.info("内存高效SDPA可用")
                result["best_backend"] = "mem_efficient"
            elif result["flash_available"]:
                logger.info("Flash SDPA可用")
                result["best_backend"] = "flash"
            elif result["math_available"]:
                logger.info("数学SDPA可用")
                result["best_backend"] = "math"

            return result
        else:
            logger.warning("系统不支持SDPA，将使用默认的注意力机制")
            return result
    except Exception as e:
        logger.error(f"检查SDPA支持时发生错误: {str(e)}")
        return result


def configure_sdpa_for_model(
    model: torch.nn.Module, config: Dict[str, Any]
) -> torch.nn.Module:
    """配置模型使用SDPA高效注意力机制

    Args:
        model: 需要配置的模型
        config: 配置字典，包含模型配置信息

    Returns:
        torch.nn.Module: 配置后的模型
    """
    if not torch.cuda.is_available() or not hasattr(
        torch.nn.functional, "scaled_dot_product_attention"
    ):
        logger.warning("未检测到CUDA设备或系统不支持SDPA,使用默认注意力机制")
        return model

    try:
        # 启用所有可用的SDPA后端
        torch.backends.cuda.enable_mem_efficient_sdp(True)
        torch.backends.cuda.enable_flash_sdp(True)
        torch.backends.cuda.enable_math_sdp(True)

        # 获取模型类型
        model_type = model.__class__.__name__.lower()
        logger.info(f"配置模型: {model_type} 使用SDPA")

        # 检查模型是否支持attn_implementation参数
        model_supports_attn_impl = False

        # 遍历模型模块，检查是否有支持注意力实现选择的属性
        for module_name, module in model.named_modules():
            if hasattr(module, "_attn_implementation") or hasattr(
                module, "attn_implementation"
            ):
                model_supports_attn_impl = True
                # 如果模块有直接设置方法
                if hasattr(module, "_set_attn_implementation"):
                    module._set_attn_implementation("sdpa")
                    logger.info(f"模块 {module_name} 已设置为SDPA")

        if model_supports_attn_impl:
            logger.info("模型支持SDPA,启用SDPA注意力机制")
        else:
            logger.info("模型不支持SDPA,SDPA将通过PyTorch原生实现")

        # 未所有Transformer层设置use_sdpa=True
        for module_name, module in model.named_modules():
            if "attention" in module_name.lower() and hasattr(module, "forward"):
                # 尝试找到相关属性并设置
                for attr_name in ["use_sdpa", "_use_sdpa", "use_scaled_dot_product"]:
                    if hasattr(module, attr_name):
                        setattr(module, attr_name, True)
                        logger.info(f"模块 {module_name} 已设置为{attr_name}=True")
        return model
    except Exception as e:
        logger.error(f"配置SDPA时发生错误: {str(e)}")
        return model


def display_sdpa_performance_info() -> None:
    """显示SDPA性能信息

    Returns:
        None
    """
    if not torch.cuda.is_available():
        logger.info("未检测到CUDA设备，无法显示SDPA性能信息")
        return

    logger.info("----------SDPA性能信息----------")

    # 显示CUDA信息
    logger.info(f"CUDA可用: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"CUDA设备数: {torch.cuda.device_count()}")
        logger.info(f"当前CUDA设备: {torch.cuda.current_device()}")
        logger.info(f"CUDA设备名称: {torch.cuda.get_device_name(0)}")

    # 显示SDPA后端状态
    logger.info(f"内存高效SDPA启用: {torch.backends.cuda.mem_efficient_sdp_enabled()}")
    logger.info(f"Flash SDPA启用: {torch.backends.cuda.flash_sdp_enabled()}")
    logger.info(f"数学SDPA启用: {torch.backends.cuda.math_sdp_enabled()}")

    # 显示哪个后端会被选择
    if torch.backends.cuda.mem_efficient_sdp_enabled():
        logger.info("当前最佳SDPA后端: mem_efficient")
    elif torch.backends.cuda.flash_sdp_enabled():
        logger.info("当前最佳SDPA后端: flash")
    elif torch.backends.cuda.math_sdp_enabled():
        logger.info("当前最佳SDPA后端: math")
    else:
        logger.info("未启用任何SDPA后端")

    logger.info("--------------------------------")
