#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
第三方API适配器注册脚本
用于快速注册第三方模型API适配器
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from zishu.adapters.core.manager import AdapterManager
from zishu.adapters.core.types import AdapterConfiguration, AdapterType
from zishu.adapters.soft.third_party_api_adapter import (
    ThirdPartyAPIAdapter,
    ThirdPartyProvider,
)
from zishu.utils.logger import setup_logger

logger = setup_logger("register_adapter")


async def register_openai_adapter(
    api_key: str,
    model: str = "gpt-3.5-turbo",
    adapter_id: str = None,
):
    """注册OpenAI适配器"""
    logger.info("开始注册OpenAI适配器...")
    
    # 创建适配器管理器
    adapter_manager = AdapterManager()
    
    try:
        # 初始化并启动管理器
        await adapter_manager.initialize()
        await adapter_manager.start()
        
        # 生成适配器ID
        if not adapter_id:
            adapter_id = f"openai_{model.replace('.', '_')}"
        
        # 创建适配器配置
        adapter_config = {
            "adapter_type": "soft",
            "name": adapter_id,
            "provider": "openai",
            "api_key": api_key,
            "model": model,
            "temperature": 0.7,
            "max_tokens": 2000,
            "timeout": 30,
        }
        
        # 创建注册配置
        registration_config = AdapterConfiguration(
            identity=adapter_id,
            name=adapter_id,
            version="1.0.0",
            adapter_type=AdapterType.SOFT,
            adapter_class=ThirdPartyAPIAdapter,
            config=adapter_config,
            description=f"OpenAI API适配器: {model}",
            author="Zishu System",
            tags=["third_party", "openai", "api"],
        )
        
        # 注册适配器
        success = await adapter_manager.register_adapter(registration_config)
        
        if not success:
            logger.error("适配器注册失败")
            return False
        
        logger.info(f"适配器注册成功: {adapter_id}")
        
        # 启动适配器
        start_success = await adapter_manager.start_adapter(adapter_id)
        
        if start_success:
            logger.info(f"适配器启动成功: {adapter_id}")
        else:
            logger.warning(f"适配器启动失败: {adapter_id}")
        
        # 测试适配器
        logger.info("测试适配器...")
        adapter = adapter_manager._adapters.get(adapter_id)
        
        if adapter:
            from zishu.adapters.base import ExecutionContext
            from zishu.adapters.soft import SoftAdapterRequest, SoftAdapterMode
            
            test_request = SoftAdapterRequest(
                query="你好",
                mode=SoftAdapterMode.CONVERSATION,
                context={"messages": [{"role": "user", "content": "你好"}]},
            )
            
            exec_context = ExecutionContext(
                request_id="test_001",
                user_id="test_user",
            )
            
            result = await adapter.process(test_request, exec_context)
            logger.info(f"测试结果: {result.content[:100]}...")
            logger.info("适配器测试成功！")
        
        return True
        
    except Exception as e:
        logger.error(f"注册适配器时发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # 停止管理器
        await adapter_manager.stop()


async def register_claude_adapter(
    api_key: str,
    model: str = "claude-3-sonnet-20240229",
    adapter_id: str = None,
):
    """注册Claude适配器"""
    logger.info("开始注册Claude适配器...")
    
    adapter_manager = AdapterManager()
    
    try:
        await adapter_manager.initialize()
        await adapter_manager.start()
        
        if not adapter_id:
            adapter_id = f"claude_{model.replace('.', '_').replace('-', '_')}"
        
        adapter_config = {
            "adapter_type": "soft",
            "name": adapter_id,
            "provider": "anthropic",
            "api_key": api_key,
            "model": model,
            "temperature": 0.7,
            "max_tokens": 2000,
            "timeout": 30,
        }
        
        registration_config = AdapterConfiguration(
            identity=adapter_id,
            name=adapter_id,
            version="1.0.0",
            adapter_type=AdapterType.SOFT,
            adapter_class=ThirdPartyAPIAdapter,
            config=adapter_config,
            description=f"Claude API适配器: {model}",
            author="Zishu System",
            tags=["third_party", "claude", "anthropic", "api"],
        )
        
        success = await adapter_manager.register_adapter(registration_config)
        
        if not success:
            logger.error("适配器注册失败")
            return False
        
        logger.info(f"适配器注册成功: {adapter_id}")
        
        start_success = await adapter_manager.start_adapter(adapter_id)
        if start_success:
            logger.info(f"适配器启动成功: {adapter_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"注册适配器时发生错误: {e}")
        return False
        
    finally:
        await adapter_manager.stop()


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="注册第三方API适配器")
    parser.add_argument(
        "--provider",
        required=True,
        choices=["openai", "claude", "qwen", "deepseek", "doubao", "gemini"],
        help="提供商名称",
    )
    parser.add_argument("--api-key", required=True, help="API密钥")
    parser.add_argument("--model", required=True, help="模型名称")
    parser.add_argument("--adapter-id", help="适配器ID（可选）")
    
    args = parser.parse_args()
    
    if args.provider == "openai":
        success = await register_openai_adapter(
            api_key=args.api_key,
            model=args.model,
            adapter_id=args.adapter_id,
        )
    elif args.provider == "claude":
        success = await register_claude_adapter(
            api_key=args.api_key,
            model=args.model,
            adapter_id=args.adapter_id,
        )
    else:
        logger.error(f"暂不支持提供商: {args.provider}")
        success = False
    
    if success:
        logger.info("适配器注册完成！")
        sys.exit(0)
    else:
        logger.error("适配器注册失败")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
