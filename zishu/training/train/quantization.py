# ！/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2025/5/10 10:00
# @Author  : erliu
# @File    : quantization.py
# @Software: PyCharm

import os
import logging
from typing import Optional, Dict, Any, Union, List

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from pathlib import Path

from .base import ModelManager
from ..utils.logger import setup_logger


class AdvanceQuantizationManager(ModelManager):
    """高级量化技术管理类，支持GPTQ、AWQ、BitAndBytes等多种量化方法"""

    def __init__(
        self,
        config_path: Union[str, Path],
        device: Optional[str] = "auto",
        log_level: int = logging.INFO,
    ):
        """
        初始化量化管理器

        Args:
            config_path (Union[str,Path]): 配置文件路径
            device (Optional[str], optional): 设备类型. Defaults to "auto".
            log_level (int, optional): 日志级别. Defaults to logging.INFO.
        """
        super().__init__(config_path, device)

        # 设置日志记录器
        self.logger = logging.getLogger(__name__)
        if not self.logger.handlers:
            self.logger = setup_logger(__name__, log_level)

        # 获取量化配置
        self.quant_config = self.config.get("quantization", {})
        self.methods_config = self.quant_config.get("methods", {})
        self.calibration_config = self.quant_config.get("calibration", {})

        # 检查量化方法是否可用
        if self.device == "cpu":
            # CPU上不支持某些量化方法
            if self.get_quantization_method() in ["bnb", "gptq", "awq"]:
                self.logger.warning(
                    f"CPU上不支持{self.get_quantization_method()}量化方法,将使用动态量化或原始模型"
                )

        # 存储加载的模型和分词器
        self._model = None
        self._tokenizer = None

    def get_quantization_method(self) -> str:
        """获取当前量化方法，支持降级策略

        Returns:
            str: 量化方法名称,可能的值为"gptq","awq","bnb","dynamic","none"
        """
        # 检查用户配置的目标方法
        target_method = self.quant_config.get("active_method", "auto")

        # 获取可用的后端
        available_backends = self.get_available_backends()

        # 如果指定了特定方法且该方法可用，则使用该方法
        if target_method != "auto":
            if (
                target_method in available_backends
                and available_backends[target_method]
                and self.methods_config.get(target_method, {}).get("enabled", False)
            ):
                self.logger.info(f"使用指定的量化方法: {target_method}")
                return target_method
            else:
                self.logger.warning(f"指定的量化方法 {target_method} 不可用，将尝试降级")

        # 按优先级尝试可用的量化方法
        method_priority = ["gptq", "awq", "bnb", "dynamic"]

        for method in method_priority:
            # 检查方法是否在配置中启用且实际可用
            if self.methods_config.get(method, {}).get(
                "enabled", False
            ) and available_backends.get(method, False):
                self.logger.info(f"降级至可用的量化方法: {method}")
                return method

        # 所有方法都不可用，返回none
        self.logger.warning("没有可用的量化方法，将使用原始模型")
        return "none"

    def _get_compute_dtype(self, dtype_str: str = None) -> torch.dtype:
        """获取计算数据类型"""
        if not dtype_str:
            dtype_str = "float16"

        if (
            dtype_str == "bfloat16"
            and torch.cuda.is_available()
            and torch.cuda.is_bf16_supported()
        ):
            return torch.bfloat16
        elif dtype_str == "float32":
            return torch.float32
        else:
            return torch.float16  # 默认返回float16

    def load_model(self) -> Any:
        """加载量化模型

        Returns:
            Any: 量化后的模型
        """
        if self._model is not None:
            return self._model

        model_path = self.get_model_path()
        self.logger.info(f"加载模型: {model_path}")

        quant_method = self.get_quantization_method()
        self.logger.info(f"使用量化方法: {quant_method}")

        try:
            if quant_method == "gptq":
                self._model = self._load_gptq_model(model_path)
            elif quant_method == "awq":
                self._model = self._load_awq_model(model_path)
            elif quant_method == "bnb":
                self._model = self._load_bnb_model(model_path)
            elif quant_method == "dynamic":
                self._model = self._load_dynamic_model(model_path)
            else:
                self.logger.warning("未选择量化方法,将加载原始模型")
                self._model = super().load_model()

            # 加载分词器
            if self._tokenizer is None:
                self._tokenizer = self._load_tokenizer(model_path)

            return self._model

        except Exception as e:
            self.logger.error(f"加载量化模型失败: {str(e)}")
            self.logger.error(f"尝试加载原始模型: {str(e)}")
            return super().load_model()

    def _load_tokenizer(self, model_path: str) -> Any:
        """加载分词器

        Args:
            model_path (str): 模型路径

        Returns:
            Any: 分词器
        """
        try:
            tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                trust_remote_code=True,
                use_fast=self.config.get("tokenizer", {}).get("use_fast", False),
            )

            # 确保有padding token
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token

            return tokenizer

        except Exception as e:
            self.logger.error(f"加载分词器失败: {str(e)}")
            raise

    def _load_gptq_model(self, model_path: str) -> Any:
        """加载gptq量化模型

        Args:
            model_path (str): 模型路径

        Returns:
            Any: GPTQ量化后的模型
        """
        try:
            from auto_gptq import AutoGPTQForCausalLM

            gptq_config = self.methods_config.get("gptq", {})
            bits = gptq_config.get("bits", 4)
            group_size = gptq_config.get("group_size", 128)
            use_triton = (
                gptq_config.get("use_triton", True) and torch.cuda.is_available()
            )

            self.logger.info(
                f"使用GPTQ量化,位数: {bits},分组大小: {group_size},使用triton加速: {use_triton}"
            )

            # 确定是否加载以量化的模型
            is_quantized = self.config.get("quantization", {}).get("enabled", False)

            if is_quantized:
                model = AutoGPTQForCausalLM.from_quantized(
                    model_path,
                    use_safetensors=True,
                    trust_remote_code=True,
                    device_map=self.device,
                    use_triton=use_triton,
                )
                self.logger.info("加载预量化GPTQ模型")
            else:
                self.logger.warning(f"路径{model_path}不包含预量化GPTQ模型,请先运行量化脚本")
                raise ValueError(f"未找到GPTQ量化模型:{model_path}")

            return model

        except ImportError:
            self.logger.error("未安装GPTQ量化库,请先安装auto_gptq")
            raise ValueError(f"未找到GPTQ量化模型:{model_path}")

        except Exception as e:
            self.logger.error(f"加载GPTQ量化模型失败: {str(e)}")
            raise

    def _load_awq_model(self, model_path: str) -> Any:
        """加载awq量化模型

        Args:
            model_path (str): 模型路径

        Returns:
            Any: AWQ量化后的模型
        """
        try:
            from awq import AutoAWQForCausalLM

            awq_config = self.methods_config.get("awq", {})

            self.logger.info(
                f"使用AWQ量化,位数: {awq_config.get('bits',4)},分组大小: {awq_config.get('group_size',128)},使用zero_point: {awq_config.get('zero_point',True)}"
            )

            # 确定是否加载以量化的模型
            is_quantized = self.config.get("quantization", {}).get("enabled", False)

            if is_quantized:
                model = AutoAWQForCausalLM.from_quantized(
                    model_path, device_map=self.device, trust_remote_code=True
                )
                self.logger.info("加载预量化AWQ模型")
            else:
                self.logger.warning(f"路径{model_path}不包含预量化AWQ模型,请先运行量化脚本")
                raise ValueError(f"未找到AWQ量化模型:{model_path}")

            return model

        except ImportError:
            self.logger.error("未安装AWQ量化库,请先安装awq")
            raise ValueError(f"未找到AWQ量化模型:{model_path}")

        except Exception as e:
            self.logger.error(f"加载AWQ量化模型失败: {str(e)}")
            raise

    def _load_bnb_model(self, model_path: str) -> Any:
        """加载bnb量化模型

        Args:
            model_path (str): 模型路径

        Returns:
            Any: BNB量化后的模型
        """
        try:
            bnb_config = self.methods_config.get("bnb", {})
            bits = bnb_config.get("bits", 4)
            compute_dtype_str = bnb_config.get("compute_dtype", "float16")
            use_double_quant = bnb_config.get("use_double_quant", True)
            quant_type = bnb_config.get("quant_type", "nf4")

            # 转换计算类型
            compute_dtype = self._get_compute_dtype(compute_dtype_str)

            self.logger.info(
                f"使用BNB量化,位数: {bits},计算类型: {compute_dtype_str},使用double_quant: {use_double_quant},量化类型: {quant_type}"
            )

            # 创建量化配置
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=bits == 4,
                load_in_8bit=bits == 8,
                bnb_4bit_compute_dtype=compute_dtype,
                bnb_4bit_use_double_quant=use_double_quant,
                bnb_4bit_quant_type=quant_type,
                llm_int8_threshold=6.0,
                llm_int8_has_fp16_weight=True,
            )

            # 加载模型
            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                quantization_config=quantization_config,
                device_map=self.device,
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            )

            self.logger.info("加载预量化BNB模型")

            return model

        except Exception as e:
            self.logger.error(f"加载BNB量化模型失败: {str(e)}")
            raise

    def _load_dynamic_model(self, model_path: str) -> Any:
        """加载动态量化模型(PyTorch原生)

        Args:
            model_path (str): 模型路径

        Returns:
            Any: 动态量化后的模型
        """
        try:
            dynamic_config = self.methods_config.get("dynamic", {})
            dtype_str = dynamic_config.get("dtype", "qint8")

            self.logger.info(f"使用动态量化,数据类型: {dtype_str}")

            # 首先加载FP32模型到CPU
            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                device_map="cpu",
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            )

            # 动态量化
            import torch.quantization as quantization

            # 设置量化配置
            if dtype_str == "qint8":
                dtype = torch.qint8
            elif dtype_str == "quint8":
                dtype = torch.quint8
            else:
                dtype = torch.qint8

            # 获取目标模块类型
            target_modules = dynamic_config.get("target_modules", ["Linear"])
            module_types = []

            if "Linear" in target_modules:
                module_types.append(torch.nn.Linear)
            if "Conv1d" in target_modules:
                module_types.append(torch.nn.Conv1d)
            if "Conv2d" in target_modules:
                module_types.append(torch.nn.Conv2d)

            if not module_types:
                module_types = [torch.nn.Linear]

            # 进行动态量化
            quantization_model = quantization.quantize_dynamic(
                model,
                module_types,
                dtype=dtype,
            )

            # 如果GPU可用,将模型移动到GPU
            if self.device != "cpu" and torch.cuda.is_available():
                quantization_model = quantization_model.to("cuda")

            self.logger.info("加载预量化动态量化模型")

            return quantization_model

        except Exception as e:
            self.logger.error(f"加载动态量化模型失败: {str(e)}")
            raise

    def unload(self) -> None:
        """卸载模型"""
        if self._model is not None:
            del self._model
            self._model = None

        if self._tokenizer is not None:
            del self._tokenizer
            self._tokenizer = None

        # 清理CUDA缓存
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        self.logger.info("模型已卸载")

    def get_available_backends(self) -> Dict[str, bool]:
        """获取可用的量化后端

        Returns:
            Dict[str,bool]: 量化后端字典,键为后端名称,值为是否可用
        """
        backends = {"gptq": False, "awq": False, "bnb": False, "dynamic": True}

        # 检查GPTQ是否可用
        try:
            import auto_gptq

            backends["gptq"] = True

        except ImportError:
            pass

        # 检查AWQ是否可用
        try:
            import awq

            backends["awq"] = True

        except ImportError:
            pass

        # 检查BNB是否可用
        try:
            from transformers import BitsAndBytesConfig

            backends["bnb"] = True

        except ImportError:
            pass

        return backends

    def get_model_size(self, model: Any) -> float:
        """获取模型大小(MB)

        Args:
            model (Any): 量化后的模型

        Returns:
            float: 模型大小(GB)
        """
        if self._model is None:
            return 0.0

        total_size = 0
        for param in self._model.parameters():
            total_size += param.numel() * param.element_size()

        return total_size / (1024 * 1024 * 1024)

    def get_memory_usage(self, model: Any) -> float:
        """获取模型内存使用量(GB)

        Args:
            model (Any): 量化后的模型

        Returns:
            float: 模型内存使用量(MB)
        """
        memory_info = {
            "ram_allocated": 0.0,
            "ram_reserved": 0.0,
            "cuda_allocated": 0.0,
            "cuda_reserved": 0.0,
        }

        import psutil

        process = psutil.Process(os.getpid())
        memory_info["ram_allocated"] = process.memory_info().rss / (1024 * 1024 * 1024)

        if torch.cuda.is_available():
            memory_info["cuda_allocated"] = torch.cuda.memory_allocated() / (
                1024 * 1024 * 1024
            )
            memory_info["cuda_reserved"] = torch.cuda.memory_reserved() / (
                1024 * 1024 * 1024
            )

        return memory_info
