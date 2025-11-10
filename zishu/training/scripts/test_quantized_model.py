#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
直接测试量化模型的独立脚本
支持GPTQ、AWQ、BNB、动态量化等多种量化方法
不需要原始模型路径，直接加载量化后的模型进行测试
"""

import os
import sys
import json
import torch
import logging
import argparse
from pathlib import Path
from typing import Optional, Dict, Any

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, project_root)

from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from zishu.utils.logger import setup_logger

logger = setup_logger(__name__, logging.INFO)


def detect_quantization_method(model_path: str) -> str:
    """自动检测量化方法
    
    Args:
        model_path: 量化模型路径
        
    Returns:
        str: 量化方法名称 (gptq, awq, bnb, dynamic, none)
    """
    model_path = Path(model_path)
    
    # 检查GPTQ量化标记文件
    if (model_path / "quantize_config.json").exists():
        try:
            with open(model_path / "quantize_config.json", "r", encoding="utf-8") as f:
                config = json.load(f)
                if config.get("bits") is not None:
                    logger.info("检测到GPTQ量化模型")
                    return "gptq"
        except:
            pass
    
    # 检查AWQ量化标记
    if (model_path / "awq_config.json").exists() or any(f.name.endswith(".awq") for f in model_path.iterdir() if f.is_file()):
        logger.info("检测到AWQ量化模型")
        return "awq"
    
    # 检查BNB量化配置（在config.json中）
    config_path = model_path / "config.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                if "quantization_config" in config:
                    logger.info("检测到BNB量化模型")
                    return "bnb"
        except:
            pass
    
    # 检查动态量化配置
    quant_config_path = model_path / "quantization_config.json"
    if quant_config_path.exists():
        try:
            with open(quant_config_path, "r", encoding="utf-8") as f:
                quant_config = json.load(f)
                if quant_config.get("method") == "dynamic" or "dynamic" in str(quant_config):
                    logger.info("检测到动态量化模型")
                    return "dynamic"
        except:
            pass
    
    # 检查是否有量化后的模型文件
    if (model_path / "pytorch_model.bin").exists() or (model_path / "model.safetensors").exists():
        # 可能是动态量化保存的模型
        logger.info("检测到可能的动态量化模型文件")
        return "dynamic"
    
    logger.warning("无法自动检测量化方法，将尝试作为普通模型加载")
    return "none"


def load_quantized_model(model_path: str, method: Optional[str] = None, device: str = "auto") -> tuple:
    """直接加载量化模型
    
    Args:
        model_path: 量化模型路径
        method: 量化方法，如果为None则自动检测
        device: 设备类型
        
    Returns:
        tuple: (model, tokenizer)
    """
    model_path = Path(model_path)
    
    if not model_path.exists():
        raise FileNotFoundError(f"模型路径不存在: {model_path}")
    
    # 自动检测量化方法
    if method is None:
        method = detect_quantization_method(str(model_path))
    
    logger.info(f"使用量化方法: {method}")
    logger.info(f"加载模型路径: {model_path}")
    
    # 加载分词器
    logger.info("加载分词器...")
    tokenizer = AutoTokenizer.from_pretrained(
        str(model_path),
        trust_remote_code=True,
        use_fast=False
    )
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # 根据量化方法加载模型
    if method == "gptq":
        model = _load_gptq_model(str(model_path), device)
    elif method == "awq":
        model = _load_awq_model(str(model_path), device)
    elif method == "bnb":
        model = _load_bnb_model(str(model_path), device)
    elif method == "dynamic":
        model = _load_dynamic_quantized_model(str(model_path), device)
    else:
        # 普通模型加载
        logger.info("作为普通模型加载...")
        model = AutoModelForCausalLM.from_pretrained(
            str(model_path),
            trust_remote_code=True,
            device_map=device if device != "auto" else "auto",
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True
        )
    
    logger.info("模型加载完成")
    return model, tokenizer


def _load_gptq_model(model_path: str, device: str) -> Any:
    """加载GPTQ量化模型"""
    try:
        from auto_gptq import AutoGPTQForCausalLM
        
        logger.info("加载GPTQ量化模型...")
        model = AutoGPTQForCausalLM.from_quantized(
            model_path,
            use_safetensors=True,
            trust_remote_code=True,
            device_map=device if device != "auto" else "auto",
            use_triton=False  # 默认不使用triton
        )
        return model
    except ImportError:
        raise ImportError("未安装auto_gptq库，请运行: pip install auto-gptq")
    except Exception as e:
        raise RuntimeError(f"加载GPTQ模型失败: {str(e)}")


def _load_awq_model(model_path: str, device: str) -> Any:
    """加载AWQ量化模型"""
    try:
        from awq import AutoAWQForCausalLM
        
        logger.info("加载AWQ量化模型...")
        model = AutoAWQForCausalLM.from_quantized(
            model_path,
            device_map=device if device != "auto" else "auto",
            trust_remote_code=True
        )
        return model
    except ImportError:
        raise ImportError("未安装awq库，请运行: pip install awq")
    except Exception as e:
        raise RuntimeError(f"加载AWQ模型失败: {str(e)}")


def _load_bnb_model(model_path: str, device: str) -> Any:
    """加载BNB量化模型"""
    logger.info("加载BNB量化模型...")
    
    # 读取配置以获取量化参数
    config_path = Path(model_path) / "config.json"
    quant_config = None
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
            quant_config = config.get("quantization_config", {})
    
    # 创建量化配置
    if quant_config:
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=quant_config.get("load_in_4bit", False),
            load_in_8bit=quant_config.get("load_in_8bit", False),
            bnb_4bit_compute_dtype=getattr(torch, quant_config.get("bnb_4bit_compute_dtype", "float16")),
            bnb_4bit_use_double_quant=quant_config.get("bnb_4bit_use_double_quant", True),
            bnb_4bit_quant_type=quant_config.get("bnb_4bit_quant_type", "nf4"),
        )
    else:
        # 默认4bit配置
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
        )
    
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        quantization_config=quantization_config,
        device_map=device if device != "auto" else "auto",
        trust_remote_code=True,
        low_cpu_mem_usage=True
    )
    return model


def _load_dynamic_quantized_model(model_path: str, device: str) -> Any:
    """直接加载已保存的动态量化模型"""
    logger.info("加载动态量化模型...")
    
    # 检查是否有保存的完整量化模型文件（优先使用）
    model_bin_path = Path(model_path) / "pytorch_model.bin"
    model_safetensors_path = Path(model_path) / "model.safetensors"
    
    # 优先：如果量化模型目录中已经有保存的模型文件，直接加载它
    if model_bin_path.exists() or model_safetensors_path.exists():
        logger.info("检测到已保存的量化模型文件，直接加载...")
        try:
            # 直接加载保存的量化模型
            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                trust_remote_code=True,
                device_map="cpu",
                low_cpu_mem_usage=True,
                torch_dtype=torch.float32
            )
            
            logger.info("✅ 成功加载已保存的量化模型")
        except Exception as e:
            logger.warning(f"直接加载量化模型失败: {e}，尝试备用方法...")
            # 如果直接加载失败，继续尝试其他方法
            model = None
    else:
        model = None
    
    # 备用方法：如果没有保存的模型文件，才从原始模型加载并应用量化
    if model is None:
        logger.info("未找到已保存的量化模型文件，尝试从原始模型加载...")
        
        # 读取量化配置
        quant_config_path = Path(model_path) / "quantization_config.json"
        dynamic_config = {}
        original_model_path = None
        
        if quant_config_path.exists():
            try:
                with open(quant_config_path, "r", encoding="utf-8") as f:
                    quant_config = json.load(f)
                    dynamic_config = quant_config.get("config", {})
                    # 尝试获取原始模型路径（如果存在）
                    original_model_path = quant_config.get("original_model") or quant_config.get("orginal_model")
            except Exception as e:
                logger.warning(f"读取量化配置失败: {e}，使用默认配置")
        
        if original_model_path and Path(original_model_path).exists():
            logger.info(f"从原始模型加载并应用量化: {original_model_path}")
            import torch.quantization as quantization
            
            # 从原始模型加载
            model = AutoModelForCausalLM.from_pretrained(
                original_model_path,
                trust_remote_code=True,
                device_map="cpu",
                low_cpu_mem_usage=True,
                torch_dtype=torch.float32
            )
            
            # 应用量化配置
            dtype_str = dynamic_config.get("dtype", "qint8")
            if dtype_str == "qint8":
                dtype = torch.qint8
            elif dtype_str == "quint8":
                dtype = torch.quint8
            else:
                dtype = torch.qint8
            
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
            
            # 应用动态量化
            model = quantization.quantize_dynamic(
                model,
                module_types,
                dtype=dtype
            )
            
            logger.info("✅ 从原始模型应用量化完成")
        else:
            # 最后尝试：直接加载模型目录（假设是完整模型）
            logger.info("尝试直接加载模型目录...")
            try:
                model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    trust_remote_code=True,
                    device_map="cpu",
                    low_cpu_mem_usage=True,
                    torch_dtype=torch.float32
                )
            except Exception as e:
                if original_model_path:
                    raise RuntimeError(
                        f"加载动态量化模型失败: {str(e)}\n"
                        f"提示: 动态量化模型需要原始模型路径。\n"
                        f"请确保量化配置中的原始模型路径存在: {original_model_path}"
                    )
                else:
                    raise RuntimeError(
                        f"加载动态量化模型失败: {str(e)}\n"
                        f"提示: 动态量化模型需要原始模型路径才能正确加载。\n"
                        f"请在量化配置文件中指定original_model路径。"
                    )
    
    # 移动到目标设备
    if device != "cpu" and torch.cuda.is_available():
        model = model.to(device)
    elif device == "auto" and torch.cuda.is_available():
        model = model.to("cuda")
    
    return model


def test_model(model, tokenizer, test_prompts: list = None):
    """测试模型推理
    
    Args:
        model: 模型对象
        tokenizer: 分词器对象
        test_prompts: 测试提示词列表，如果为None则使用默认提示词
    """
    if test_prompts is None:
        test_prompts = [
            "叫主人~",
            "你好，请介绍一下你自己。",
            "今天天气怎么样？"
        ]
    
    logger.info("=" * 60)
    logger.info("开始测试模型推理...")
    logger.info("=" * 60)
    
    for i, prompt in enumerate(test_prompts, 1):
        logger.info(f"\n测试 {i}/{len(test_prompts)}: {prompt}")
        logger.info("-" * 60)
        
        try:
            # 编码输入
            inputs = tokenizer(prompt, return_tensors="pt")
            
            # 移动到模型设备
            device = next(model.parameters()).device
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            # 生成回复
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=100,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
                    eos_token_id=tokenizer.eos_token_id
                )
            
            # 解码输出
            response = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # 只显示新生成的部分
            input_length = inputs["input_ids"].shape[1]
            generated_text = response[len(prompt):].strip()
            
            logger.info(f"输入: {prompt}")
            logger.info(f"输出: {generated_text}")
            logger.info(f"完整回复: {response}")
            
        except Exception as e:
            logger.error(f"测试失败: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
    
    logger.info("=" * 60)
    logger.info("测试完成！")
    logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="直接测试量化模型的独立脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 自动检测量化方法并测试
  python test_quantized_model.py --model_path /path/to/quantized/model
  
  # 指定量化方法
  python test_quantized_model.py --model_path /path/to/quantized/model --method gptq
  
  # 指定测试提示词
  python test_quantized_model.py --model_path /path/to/quantized/model --prompts "你好" "介绍一下自己"
        """
    )
    
    parser.add_argument(
        "--model_path",
        type=str,
        required=True,
        help="量化模型路径"
    )
    
    parser.add_argument(
        "--method",
        type=str,
        default=None,
        choices=["gptq", "awq", "bnb", "dynamic", "none"],
        help="量化方法，如果不指定则自动检测"
    )
    
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        choices=["auto", "cpu", "cuda"],
        help="设备类型，默认auto自动选择"
    )
    
    parser.add_argument(
        "--prompts",
        type=str,
        nargs="+",
        default=None,
        help="测试提示词列表，可以指定多个"
    )
    
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="交互式测试模式"
    )
    
    args = parser.parse_args()
    
    try:
        # 加载模型
        logger.info("=" * 60)
        logger.info("开始加载量化模型...")
        logger.info("=" * 60)
        
        model, tokenizer = load_quantized_model(
            args.model_path,
            method=args.method,
            device=args.device
        )
        
        # 测试模型
        if args.interactive:
            logger.info("\n进入交互式模式（输入 'quit' 或 'exit' 退出）...")
            while True:
                try:
                    user_input = input("\n您: ").strip()
                    if user_input.lower() in ["quit", "exit", "退出"]:
                        break
                    
                    if not user_input:
                        continue
                    
                    inputs = tokenizer(user_input, return_tensors="pt")
                    device = next(model.parameters()).device
                    inputs = {k: v.to(device) for k, v in inputs.items()}
                    
                    with torch.no_grad():
                        outputs = model.generate(
                            **inputs,
                            max_new_tokens=150,
                            temperature=0.7,
                            do_sample=True,
                            pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
                            eos_token_id=tokenizer.eos_token_id
                        )
                    
                    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
                    generated_text = response[len(user_input):].strip()
                    print(f"模型: {generated_text}")
                    
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    logger.error(f"交互式测试失败: {e}")
        else:
            test_model(model, tokenizer, args.prompts)
        
        logger.info("\n✅ 测试完成！")
        
    except Exception as e:
        logger.error(f"❌ 测试失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()

