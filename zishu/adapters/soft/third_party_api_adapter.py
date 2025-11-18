# -*- coding: utf-8 -*-
"""
第三方API软适配器
支持调用GPT、Claude、Qwen、Deepseek、豆包、Gemini等第三方模型API
"""

import asyncio
import json
import logging
import aiohttp
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from enum import Enum

from .soft_adapter import (
    SoftAdapter,
    SoftAdapterRequest,
    SoftAdapterResponse,
    SoftAdapterMode,
)
from ..base import (
    ExecutionContext,
    AdapterExecutionError,
    SoftAdapterError,
)

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class ThirdPartyProvider(str, Enum):
    """第三方模型提供商"""
    OPENAI = "openai"  # GPT系列
    ANTHROPIC = "anthropic"  # Claude系列
    QWEN = "qwen"  # 通义千问
    DEEPSEEK = "deepseek"  # DeepSeek
    DOUBAO = "doubao"  # 豆包（字节跳动）
    GEMINI = "gemini"  # Gemini (Google)
    CUSTOM = "custom"  # 自定义API


class ThirdPartyAPIAdapter(SoftAdapter):
    """
    第三方API软适配器
    
    支持通过API调用各种第三方大模型，包括：
    - OpenAI (GPT-3.5, GPT-4, GPT-4-turbo等)
    - Anthropic (Claude, Claude-2, Claude-3等)
    - Qwen (通义千问)
    - DeepSeek
    - Doubao (豆包)
    - Gemini (Google)
    
    配置示例：
    ```python
    config = {
        "adapter_type": "soft",
        "name": "third_party_api",
        "provider": "openai",  # 提供商
        "api_key": "sk-xxx",  # API密钥
        "api_base": "https://api.openai.com/v1",  # API基础URL
        "model": "gpt-3.5-turbo",  # 模型名称
        "temperature": 0.7,
        "max_tokens": 2000,
        "timeout": 30,
    }
    ```
    """
    
    # API端点配置
    API_ENDPOINTS = {
        ThirdPartyProvider.OPENAI: {
            "base_url": "https://api.openai.com/v1",
            "chat_endpoint": "/chat/completions",
            "headers": lambda api_key: {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        },
        ThirdPartyProvider.ANTHROPIC: {
            "base_url": "https://api.anthropic.com",
            "chat_endpoint": "/v1/messages",
            "headers": lambda api_key: {
                "x-api-key": api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }
        },
        ThirdPartyProvider.QWEN: {
            "base_url": "https://dashscope.aliyuncs.com/api/v1",
            "chat_endpoint": "/services/aigc/text-generation/generation",
            "headers": lambda api_key: {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        },
        ThirdPartyProvider.DEEPSEEK: {
            "base_url": "https://api.deepseek.com/v1",
            "chat_endpoint": "/chat/completions",
            "headers": lambda api_key: {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        },
        ThirdPartyProvider.DOUBAO: {
            "base_url": "https://ark.cn-beijing.volces.com/api/v3",
            "chat_endpoint": "/chat/completions",
            "headers": lambda api_key: {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        },
        ThirdPartyProvider.GEMINI: {
            "base_url": "https://generativelanguage.googleapis.com/v1beta",
            "chat_endpoint": "/models/{model}:generateContent",
            "headers": lambda api_key: {
                "Content-Type": "application/json",
                "x-goog-api-key": api_key
            }
        },
    }
    
    def __init__(self, config: Dict[str, Any]):
        """初始化第三方API适配器"""
        super().__init__(config)
        
        # 提供商配置
        provider_str = config.get("provider", "openai")
        try:
            self.provider = ThirdPartyProvider(provider_str)
        except ValueError:
            logger.warning(f"未知的提供商 {provider_str}，使用自定义模式")
            self.provider = ThirdPartyProvider.CUSTOM
        
        # API配置
        self.api_key = config.get("api_key", "")
        self.api_base = config.get("api_base", "")
        self.model = config.get("model", "gpt-3.5-turbo")
        
        # 生成参数
        self.temperature = config.get("temperature", 0.7)
        self.max_tokens = config.get("max_tokens", 2000)
        self.top_p = config.get("top_p", 1.0)
        self.timeout = config.get("timeout", 30)
        
        # HTTP会话
        self._session: Optional[aiohttp.ClientSession] = None
        
        logger.info(f"第三方API适配器初始化: provider={self.provider.value}, model={self.model}")
    
    async def _initialize_impl(self) -> bool:
        """初始化实现"""
        try:
            # 验证API配置
            if not self.api_key and self.provider != ThirdPartyProvider.CUSTOM:
                raise ValueError(f"API密钥未配置: provider={self.provider.value}")
            
            # 设置API端点
            if not self.api_base:
                if self.provider in self.API_ENDPOINTS:
                    self.api_base = self.API_ENDPOINTS[self.provider]["base_url"]
                else:
                    raise ValueError(f"未知的提供商且未配置api_base: {self.provider}")
            
            # 创建HTTP会话
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            )
            
            logger.info(f"第三方API适配器初始化成功: {self.adapter_id}")
            return True
            
        except Exception as e:
            logger.error(f"第三方API适配器初始化失败: {e}")
            return False
    
    async def _cleanup_impl(self) -> None:
        """清理实现"""
        if self._session:
            await self._session.close()
            self._session = None
        logger.info(f"第三方API适配器清理完成: {self.adapter_id}")
    
    async def start(self) -> None:
        """启动适配器（软适配器在初始化时已准备好）"""
        logger.info(f"第三方API适配器启动: {self.adapter_id}")
        # 软适配器不需要额外的启动步骤
        pass
    
    async def stop(self) -> None:
        """停止适配器"""
        logger.info(f"第三方API适配器停止: {self.adapter_id}")
        await self._cleanup_impl()
    
    async def _process_conversation(
        self, request: SoftAdapterRequest
    ) -> SoftAdapterResponse:
        """处理对话请求"""
        try:
            # 构建消息历史
            messages = request.context.get("messages", [])
            if not messages:
                messages = [{"role": "user", "content": request.query}]
            elif request.query:
                messages.append({"role": "user", "content": request.query})
            
            # 根据提供商构建请求
            if self.provider == ThirdPartyProvider.ANTHROPIC:
                response_text, tokens_used = await self._call_anthropic_api(messages, request)
            elif self.provider == ThirdPartyProvider.QWEN:
                response_text, tokens_used = await self._call_qwen_api(messages, request)
            elif self.provider == ThirdPartyProvider.GEMINI:
                response_text, tokens_used = await self._call_gemini_api(messages, request)
            else:
                # OpenAI兼容格式 (OpenAI, DeepSeek, Doubao等)
                response_text, tokens_used = await self._call_openai_compatible_api(messages, request)
            
            return SoftAdapterResponse(
                content=response_text,
                confidence=0.95,
                sources=[],
                tokens_used=tokens_used,
                metadata={
                    "provider": self.provider.value,
                    "model": self.model,
                }
            )
            
        except Exception as e:
            logger.error(f"对话处理失败: {e}")
            raise SoftAdapterError(
                f"第三方API调用失败: {str(e)}", 
                adapter_id=self.adapter_id, 
                cause=e
            )
    
    async def _call_openai_compatible_api(
        self, messages: List[Dict[str, str]], request: SoftAdapterRequest
    ) -> tuple[str, int]:
        """调用OpenAI兼容的API"""
        if not self._session:
            raise RuntimeError("HTTP会话未初始化")
        
        endpoint_config = self.API_ENDPOINTS.get(self.provider, self.API_ENDPOINTS[ThirdPartyProvider.OPENAI])
        url = f"{self.api_base}{endpoint_config['chat_endpoint']}"
        headers = endpoint_config["headers"](self.api_key)
        
        # 调试：打印发送的消息
        logger.info(f"发送到API的消息数量: {len(messages)}")
        for i, msg in enumerate(messages):
            logger.info(f"消息 {i}: role={msg.get('role')}, content={msg.get('content', '')[:50]}...")
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens or self.max_tokens,
            "top_p": self.top_p,
        }
        
        async with self._session.post(url, json=payload, headers=headers) as response:
            if response.status != 200:
                error_text = await response.text()
                raise RuntimeError(f"API调用失败 ({response.status}): {error_text}")
            
            data = await response.json()
            
            # 解析响应
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                tokens = data.get("usage", {}).get("total_tokens", 0)
                return content, tokens
            else:
                raise RuntimeError(f"API响应格式异常: {data}")
    
    async def _call_anthropic_api(
        self, messages: List[Dict[str, str]], request: SoftAdapterRequest
    ) -> tuple[str, int]:
        """调用Anthropic Claude API"""
        if not self._session:
            raise RuntimeError("HTTP会话未初始化")
        
        endpoint_config = self.API_ENDPOINTS[ThirdPartyProvider.ANTHROPIC]
        url = f"{self.api_base}{endpoint_config['chat_endpoint']}"
        headers = endpoint_config["headers"](self.api_key)
        
        # Claude API使用不同的格式
        system_message = ""
        claude_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                claude_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        payload = {
            "model": self.model,
            "messages": claude_messages,
            "max_tokens": request.max_tokens or self.max_tokens,
            "temperature": request.temperature,
        }
        
        if system_message:
            payload["system"] = system_message
        
        async with self._session.post(url, json=payload, headers=headers) as response:
            if response.status != 200:
                error_text = await response.text()
                raise RuntimeError(f"Claude API调用失败 ({response.status}): {error_text}")
            
            data = await response.json()
            
            if "content" in data and len(data["content"]) > 0:
                content = data["content"][0]["text"]
                tokens = data.get("usage", {}).get("total_tokens", 0)
                return content, tokens
            else:
                raise RuntimeError(f"Claude API响应格式异常: {data}")
    
    async def _call_qwen_api(
        self, messages: List[Dict[str, str]], request: SoftAdapterRequest
    ) -> tuple[str, int]:
        """调用通义千问API"""
        if not self._session:
            raise RuntimeError("HTTP会话未初始化")
        
        endpoint_config = self.API_ENDPOINTS[ThirdPartyProvider.QWEN]
        url = f"{self.api_base}{endpoint_config['chat_endpoint']}"
        headers = endpoint_config["headers"](self.api_key)
        
        payload = {
            "model": self.model,
            "input": {
                "messages": messages
            },
            "parameters": {
                "temperature": request.temperature,
                "max_tokens": request.max_tokens or self.max_tokens,
                "top_p": self.top_p,
            }
        }
        
        async with self._session.post(url, json=payload, headers=headers) as response:
            if response.status != 200:
                error_text = await response.text()
                raise RuntimeError(f"Qwen API调用失败 ({response.status}): {error_text}")
            
            data = await response.json()
            
            if "output" in data and "text" in data["output"]:
                content = data["output"]["text"]
                tokens = data.get("usage", {}).get("total_tokens", 0)
                return content, tokens
            else:
                raise RuntimeError(f"Qwen API响应格式异常: {data}")
    
    async def _call_gemini_api(
        self, messages: List[Dict[str, str]], request: SoftAdapterRequest
    ) -> tuple[str, int]:
        """调用Google Gemini API"""
        if not self._session:
            raise RuntimeError("HTTP会话未初始化")
        
        endpoint_config = self.API_ENDPOINTS[ThirdPartyProvider.GEMINI]
        endpoint = endpoint_config["chat_endpoint"].format(model=self.model)
        url = f"{self.api_base}{endpoint}?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        
        # Gemini使用不同的消息格式
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature,
                "maxOutputTokens": request.max_tokens or self.max_tokens,
                "topP": self.top_p,
            }
        }
        
        async with self._session.post(url, json=payload, headers=headers) as response:
            if response.status != 200:
                error_text = await response.text()
                raise RuntimeError(f"Gemini API调用失败 ({response.status}): {error_text}")
            
            data = await response.json()
            
            if "candidates" in data and len(data["candidates"]) > 0:
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                # Gemini API可能不返回token使用量
                tokens = 0
                return content, tokens
            else:
                raise RuntimeError(f"Gemini API响应格式异常: {data}")


def create_third_party_api_adapter(
    provider: str,
    api_key: str,
    model: str,
    api_base: Optional[str] = None,
    **kwargs
) -> ThirdPartyAPIAdapter:
    """创建第三方API适配器的便捷函数"""
    config = {
        "adapter_type": "soft",
        "name": f"third_party_{provider}",
        "provider": provider,
        "api_key": api_key,
        "model": model,
        **kwargs
    }
    
    if api_base:
        config["api_base"] = api_base
    
    return ThirdPartyAPIAdapter(config)


# 导出
__all__ = [
    "ThirdPartyAPIAdapter",
    "ThirdPartyProvider",
    "create_third_party_api_adapter",
]
