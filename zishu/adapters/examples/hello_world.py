"""
Hello World 示例适配器 - 紫舒老师适配器框架完整示例
"""

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, Callable
import logging
import re

# 导入适配器框架基础类
from ..base.adapter import BaseAdapter, ExecutionContext, HealthCheckResult
from ..base.metadata import (
    AdapterMetadata, AdapterCapability, AdapterType, SecurityLevel, 
    CapabilityCategory, DependencyType
)
from ..base.exceptions import (
    AdapterExecutionError, AdapterConfigurationError, AdapterValidationError,
    ErrorCode, ExceptionSeverity
)


class HelloWorldAdapter(BaseAdapter):
    """
    Hello World 示例适配器
    
    这个适配器提供了多种问候功能：
    1. 基础问候：简单的Hello World
    2. 个性化问候：根据用户名定制问候语
    3. 多语言问候：支持多种语言的问候
    4. 时间问候：根据时间显示相应问候
    5. 格式化输出：支持多种输出格式（文本、JSON、XML等）
    
    配置选项：
    - greeting_style: 问候风格 (formal, casual, friendly)
    - language: 语言代码 (zh, en, ja, ko, fr, es, de)
    - output_format: 输出格式 (text, json, xml, yaml)
    - include_timestamp: 是否包含时间戳
    - personalization: 是否启用个性化功能
    - emoji_support: 是否支持表情符号
    """
    
    # 支持的语言映射
    LANGUAGE_GREETINGS = {
        'zh': {
            'formal': '您好',
            'casual': '你好',
            'friendly': '嗨',
            'world': '世界'
        },
        'en': {
            'formal': 'Good day',
            'casual': 'Hello',
            'friendly': 'Hi',
            'world': 'World'
        },
        'ja': {
            'formal': 'こんにちは',
            'casual': 'おはよう',
            'friendly': 'やあ',
            'world': '世界'
        },
        'ko': {
            'formal': '안녕하세요',
            'casual': '안녕',
            'friendly': '하이',
            'world': '세계'
        },
        'fr': {
            'formal': 'Bonjour',
            'casual': 'Salut',
            'friendly': 'Coucou',
            'world': 'Monde'
        },
        'es': {
            'formal': 'Buenos días',
            'casual': 'Hola',
            'friendly': 'Ey',
            'world': 'Mundo'
        },
        'de': {
            'formal': 'Guten Tag',
            'casual': 'Hallo',
            'friendly': 'Hi',
            'world': 'Welt'
        }
    }
    
    # 表情符号映射
    EMOJI_MAP = {
        'formal': '',
        'casual': '',
        'friendly': '',
        'world': '',
        'time': ''
    }
    
    def _load_metadata(self) -> AdapterMetadata:
        """加载适配器元数据"""
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name="Hello World Adapter",
            version=self.version,
            description="全功能Hello World示例适配器，展示紫舒老师适配器框架的完整特性",
            adapter_type=AdapterType.SOFT,
            security_level=SecurityLevel.PUBLIC,
            author="紫舒老师团队",
            email="adapters@zishu.team",
            homepage="https://github.com/zishu-sensei/adapters",
            repository="https://github.com/zishu-sensei/adapters.git",
            documentation="https://docs.zishu.team/adapters/hello-world",
            license="MIT",
            created_at=datetime.now(timezone.utc),
            tags=["example", "hello-world", "greeting", "multilingual", "demo"],
            keywords=["demonstration", "tutorial", "beginner-friendly"],
            dependencies=[],
            configuration_schema={
                "type": "object",
                "properties": {
                    "greeting_style": {
                        "type": "string",
                        "enum": ["formal", "casual", "friendly"],
                        "default": "friendly",
                        "description": "问候风格"
                    },
                    "language": {
                        "type": "string", 
                        "enum": ["zh", "en", "ja", "ko", "fr", "es", "de"],
                        "default": "zh",
                        "description": "语言代码"
                    },
                    "output_format": {
                        "type": "string",
                        "enum": ["text", "json", "xml", "yaml"],
                        "default": "text",
                        "description": "输出格式"
                    },
                    "include_timestamp": {
                        "type": "boolean",
                        "default": True,
                        "description": "是否包含时间戳"
                    },
                    "personalization": {
                        "type": "boolean",
                        "default": True,
                        "description": "是否启用个性化功能"
                    },
                    "emoji_support": {
                        "type": "boolean",
                        "default": True,
                        "description": "是否支持表情符号"
                    },
                    "max_name_length": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 100,
                        "default": 50,
                        "description": "最大名称长度"
                    }
                },
                "required": [],
                "additionalProperties": False
            },
            performance_requirements={
                "max_execution_time": 1.0,
                "max_memory_usage": 10,
                "concurrent_executions": 100
            },
            resource_requirements={
                "cpu_cores": 0.1,
                "memory_mb": 5,
                "disk_space_mb": 1
            }
        )
    
    async def _initialize_impl(self) -> bool:
        """初始化适配器"""
        try:
            # 验证和设置配置
            self.greeting_style = self.config.get('greeting_style', 'friendly')
            self.language = self.config.get('language', 'zh')
            self.output_format = self.config.get('output_format', 'text')
            self.include_timestamp = self.config.get('include_timestamp', True)
            self.personalization = self.config.get('personalization', True)
            self.emoji_support = self.config.get('emoji_support', True)
            self.max_name_length = self.config.get('max_name_length', 50)
            
            # 验证配置有效性
            if self.greeting_style not in ['formal', 'casual', 'friendly']:
                raise AdapterConfigurationError(
                    f"无效的问候风格: {self.greeting_style}",
                    adapter_id=self.adapter_id,
                    context={"valid_styles": ["formal", "casual", "friendly"]}
                )
            
            if self.language not in self.LANGUAGE_GREETINGS:
                raise AdapterConfigurationError(
                    f"不支持的语言: {self.language}",
                    adapter_id=self.adapter_id,
                    context={"supported_languages": list(self.LANGUAGE_GREETINGS.keys())}
                )
            
            if self.output_format not in ['text', 'json', 'xml', 'yaml']:
                raise AdapterConfigurationError(
                    f"不支持的输出格式: {self.output_format}",
                    adapter_id=self.adapter_id,
                    context={"supported_formats": ["text", "json", "xml", "yaml"]}
                )
            
            # 初始化统计计数器
            self.greeting_count = 0
            self.error_count = 0
            self.language_stats = {lang: 0 for lang in self.LANGUAGE_GREETINGS.keys()}
            
            # 模拟初始化延迟
            await asyncio.sleep(0.1)
            
            self.logger.info(f"Hello World适配器初始化成功 - 风格: {self.greeting_style}, "
                           f"语言: {self.language}, 格式: {self.output_format}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"初始化Hello World适配器失败: {e}")
            if isinstance(e, (AdapterConfigurationError, AdapterValidationError)):
                raise
            else:
                raise AdapterConfigurationError(
                    f"初始化过程中发生意外错误: {str(e)}",
                    adapter_id=self.adapter_id,
                    cause=e
                )
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理问候请求"""
        try:
            # 解析输入数据
            name = None
            request_config = {}
            
            if isinstance(input_data, str):
                # 字符串输入：可能是名字或空字符串
                name = input_data.strip() if input_data.strip() else None
            elif isinstance(input_data, dict):
                # 字典输入：可能包含名字和配置选项
                name = input_data.get('name', '').strip() or None
                request_config = {k: v for k, v in input_data.items() if k != 'name'}
            elif input_data is None:
                # 空输入：使用默认处理
                name = None
            else:
                raise AdapterExecutionError(
                    f"不支持的输入类型: {type(input_data).__name__}，期望 str、dict 或 None",
                    adapter_id=self.adapter_id,
                    error_code=ErrorCode.INVALID_INPUT,
                    context={"input_type": type(input_data).__name__}
                )
            
            # 验证名字长度
            if name and len(name) > self.max_name_length:
                raise AdapterValidationError(
                    f"名字长度超过限制: {len(name)} > {self.max_name_length}",
                    adapter_id=self.adapter_id,
                    context={"name_length": len(name), "max_length": self.max_name_length}
                )
            
            # 验证名字内容（只允许字母、数字、空格和常见标点）
            if name and not re.match(r'^[\w\s\-\.]+$', name, re.UNICODE):
                raise AdapterValidationError(
                    f"名字包含无效字符: {name}",
                    adapter_id=self.adapter_id,
                    context={"invalid_name": name}
                )
            
            # 合并配置（请求配置优先）
            effective_config = self._merge_config(request_config)
            
            # 生成问候内容
            greeting_data = await self._generate_greeting(name, effective_config, context)
            
            # 格式化输出
            formatted_output = self._format_output(greeting_data, effective_config['output_format'])
            
            # 更新统计信息
            self.greeting_count += 1
            self.language_stats[effective_config['language']] += 1
            
            if context.debug_mode:
                self.logger.debug(f"生成问候语: {greeting_data}")
            
            return formatted_output
            
        except Exception as e:
            self.error_count += 1
            self.logger.error(f"处理问候请求失败: {e}")
            
            if isinstance(e, (AdapterExecutionError, AdapterValidationError)):
                raise
            else:
                raise AdapterExecutionError(
                    f"处理过程中发生意外错误: {str(e)}",
                    adapter_id=self.adapter_id,
                    error_code=ErrorCode.PROCESSING_ERROR,
                    cause=e
                )
    
    def _merge_config(self, request_config: Dict[str, Any]) -> Dict[str, Any]:
        """合并请求配置和默认配置"""
        config = {
            'greeting_style': self.greeting_style,
            'language': self.language,
            'output_format': self.output_format,
            'include_timestamp': self.include_timestamp,
            'personalization': self.personalization,
            'emoji_support': self.emoji_support
        }
        
        # 验证并应用请求配置
        for key, value in request_config.items():
            if key in config:
                if key == 'greeting_style' and value in ['formal', 'casual', 'friendly']:
                    config[key] = value
                elif key == 'language' and value in self.LANGUAGE_GREETINGS:
                    config[key] = value
                elif key == 'output_format' and value in ['text', 'json', 'xml', 'yaml']:
                    config[key] = value
                elif key in ['include_timestamp', 'personalization', 'emoji_support'] and isinstance(value, bool):
                    config[key] = value
        
        return config
    
    async def _generate_greeting(self, name: Optional[str], config: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """生成问候内容"""
        # 获取语言设置
        lang_greetings = self.LANGUAGE_GREETINGS[config['language']]
        
        # 生成基础问候语
        if name and config['personalization']:
            greeting_text = f"{lang_greetings[config['greeting_style']]}, {name}!"
        else:
            greeting_text = f"{lang_greetings[config['greeting_style']]}, {lang_greetings['world']}!"
        
        # 添加表情符号
        if config['emoji_support']:
            emoji = self.EMOJI_MAP.get(config['greeting_style'], '')
            if emoji:
                greeting_text = f"{emoji} {greeting_text}"
        
        # 生成时间相关问候
        time_greeting = self._get_time_greeting(config['language'])
        
        # 构建结果数据
        greeting_data = {
            'greeting': greeting_text,
            'language': config['language'],
            'style': config['greeting_style'],
            'personalized': bool(name and config['personalization']),
            'execution_id': context.execution_id,
            'adapter_id': self.adapter_id,
            'adapter_version': self.version
        }
        
        if config['include_timestamp']:
            greeting_data['timestamp'] = datetime.now(timezone.utc).isoformat()
            greeting_data['time_greeting'] = time_greeting
        
        if name:
            greeting_data['recipient'] = name
        
        # 添加调试信息
        if context.debug_mode:
            greeting_data['debug_info'] = {
                'config_used': config,
                'processing_time': time.time(),
                'execution_count': self.greeting_count + 1
            }
        
        # 模拟处理延迟
        await asyncio.sleep(0.01)
        
        return greeting_data
    
    def _get_time_greeting(self, language: str) -> str:
        """根据当前时间生成时间问候语"""
        current_hour = datetime.now().hour
        
        time_greetings = {
            'zh': {
                'morning': '早上好',
                'afternoon': '下午好', 
                'evening': '晚上好',
                'night': '晚安'
            },
            'en': {
                'morning': 'Good morning',
                'afternoon': 'Good afternoon',
                'evening': 'Good evening',
                'night': 'Good night'
            }
        }
        
        # 默认使用英语
        greetings = time_greetings.get(language, time_greetings['en'])
        
        if 5 <= current_hour < 12:
            return greetings['morning']
        elif 12 <= current_hour < 18:
            return greetings['afternoon']
        elif 18 <= current_hour < 22:
            return greetings['evening']
        else:
            return greetings['night']
    
    def _format_output(self, data: Dict[str, Any], output_format: str) -> Union[str, Dict[str, Any]]:
        """格式化输出数据"""
        if output_format == 'text':
            # 纯文本格式
            result = data['greeting']
            if 'time_greeting' in data:
                result = f"{data['time_greeting']}！{result}"
            if 'timestamp' in data:
                result += f"\n[{data['timestamp']}]"
            return result
            
        elif output_format == 'json':
            # JSON格式
            return data
            
        elif output_format == 'xml':
            # XML格式
            xml_lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<greeting>']
            for key, value in data.items():
                if isinstance(value, dict):
                    xml_lines.append(f'  <{key}>')
                    for sub_key, sub_value in value.items():
                        xml_lines.append(f'    <{sub_key}>{sub_value}</{sub_key}>')
                    xml_lines.append(f'  </{key}>')
                else:
                    xml_lines.append(f'  <{key}>{value}</{key}>')
            xml_lines.append('</greeting>')
            return '\n'.join(xml_lines)
            
        elif output_format == 'yaml':
            # YAML格式
            yaml_lines = []
            for key, value in data.items():
                if isinstance(value, dict):
                    yaml_lines.append(f'{key}:')
                    for sub_key, sub_value in value.items():
                        yaml_lines.append(f'  {sub_key}: {sub_value}')
                else:
                    yaml_lines.append(f'{key}: {value}')
            return '\n'.join(yaml_lines)
        
        return str(data)  # 备用格式
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取适配器能力列表"""
        return [
            AdapterCapability(
                name="basic_greeting",
                category=CapabilityCategory.TEXT_PROCESSING,
                description="生成基础问候语",
                input_schema={
                    "type": "string",
                    "description": "可选的接收者名称"
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "greeting": {"type": "string"},
                        "language": {"type": "string"},
                        "style": {"type": "string"}
                    }
                },
                examples=[
                    {
                        "input": "张三",
                        "output": {"greeting": "你好, 张三!", "language": "zh", "style": "friendly"}
                    }
                ],
                tags={"greeting", "basic"}
            ),
            AdapterCapability(
                name="multilingual_greeting",
                category=CapabilityCategory.TEXT_PROCESSING,
                description="多语言问候支持",
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "language": {"type": "string", "enum": list(self.LANGUAGE_GREETINGS.keys())}
                    }
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "greeting": {"type": "string"},
                        "language": {"type": "string"}
                    }
                },
                examples=[
                    {
                        "input": {"name": "John", "language": "en"},
                        "output": {"greeting": "Hi, John!", "language": "en"}
                    }
                ],
                tags={"greeting", "multilingual", "i18n"}
            ),
            AdapterCapability(
                name="formatted_output",
                category=CapabilityCategory.TEXT_PROCESSING,
                description="多格式输出支持",
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "output_format": {"type": "string", "enum": ["text", "json", "xml", "yaml"]}
                    }
                },
                output_schema={
                    "oneOf": [
                        {"type": "string"},
                        {"type": "object"}
                    ]
                },
                examples=[
                    {
                        "input": {"name": "测试", "output_format": "json"},
                        "output": {"greeting": "你好, 测试!", "language": "zh", "style": "friendly"}
                    }
                ],
                tags={"greeting", "formatting", "output"}
            ),
            AdapterCapability(
                name="time_aware_greeting",
                category=CapabilityCategory.TEXT_PROCESSING,
                description="时间感知问候",
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "include_timestamp": {"type": "boolean"}
                    }
                },
                output_schema={
                    "type": "object",
                    "properties": {
                        "greeting": {"type": "string"},
                        "time_greeting": {"type": "string"},
                        "timestamp": {"type": "string"}
                    }
                },
                examples=[
                    {
                        "input": {"name": "用户", "include_timestamp": True},
                        "output": {
                            "greeting": "你好, 用户!",
                            "time_greeting": "下午好",
                            "timestamp": "2024-01-01T14:30:00.000Z"
                        }
                    }
                ],
                tags={"greeting", "time", "timestamp"}
            )
        ]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """执行健康检查"""
        checks = {}
        issues = []
        recommendations = []
        metrics = {}
        
        # 检查配置有效性
        try:
            checks["config_valid"] = True
            checks["language_supported"] = self.language in self.LANGUAGE_GREETINGS
            checks["style_valid"] = self.greeting_style in ['formal', 'casual', 'friendly']
            checks["format_valid"] = self.output_format in ['text', 'json', 'xml', 'yaml']
            
            if not checks["language_supported"]:
                issues.append(f"不支持的语言设置: {self.language}")
                recommendations.append("请使用支持的语言代码: " + ", ".join(self.LANGUAGE_GREETINGS.keys()))
            
            if not checks["style_valid"]:
                issues.append(f"无效的问候风格: {self.greeting_style}")
                recommendations.append("请使用有效的问候风格: formal, casual, friendly")
            
            if not checks["format_valid"]:
                issues.append(f"不支持的输出格式: {self.output_format}")
                recommendations.append("请使用支持的格式: text, json, xml, yaml")
                
        except Exception as e:
            checks["config_valid"] = False
            issues.append(f"配置检查失败: {str(e)}")
        
        # 检查基本功能
        try:
            test_context = ExecutionContext(debug_mode=True)
            test_result = await self._process_impl("健康检查", test_context)
            checks["basic_functionality"] = True
            
            # 测试多语言功能
            for lang in ['zh', 'en']:
                try:
                    lang_context = ExecutionContext()
                    lang_config = {'language': lang}
                    await self._generate_greeting("测试", {**self._merge_config({}), **lang_config}, lang_context)
                    checks[f"language_{lang}_working"] = True
                except Exception:
                    checks[f"language_{lang}_working"] = False
                    issues.append(f"语言 {lang} 功能异常")
                    
        except Exception as e:
            checks["basic_functionality"] = False
            issues.append(f"基本功能测试失败: {str(e)}")
        
        # 性能指标
        metrics.update({
            "total_greetings": self.greeting_count,
            "total_errors": self.error_count,
            "error_rate": self.error_count / max(self.greeting_count, 1),
            "language_distribution": dict(self.language_stats),
            "current_language": self.language,
            "current_style": self.greeting_style,
            "current_format": self.output_format
        })
        
        # 检查性能
        checks["performance_acceptable"] = metrics["error_rate"] < 0.1
        if metrics["error_rate"] >= 0.1:
            issues.append(f"错误率过高: {metrics['error_rate']:.2%}")
            recommendations.append("检查输入数据质量和配置设置")
        
        # 内存使用检查
        try:
            import psutil  
            import os
            process = psutil.Process(os.getpid())
            memory_usage = process.memory_info().rss / 1024 / 1024  # MB
            checks["memory_usage_normal"] = memory_usage < 100  # 小于100MB
            metrics["memory_usage_mb"] = memory_usage
            
            if memory_usage >= 100:
                issues.append(f"内存使用过高: {memory_usage:.1f}MB")
                recommendations.append("考虑重启适配器以释放内存")
        except ImportError:
            checks["memory_usage_normal"] = True  # 无法检查时假设正常
            metrics["memory_usage_mb"] = "unavailable"
            
        # 确定整体健康状态
        critical_checks = ["config_valid", "basic_functionality", "language_supported"]
        critical_healthy = all(checks.get(check, False) for check in critical_checks)
        all_healthy = all(checks.values())
        
        if critical_healthy and all_healthy:
            status = "healthy"
        elif critical_healthy:
            status = "degraded"
        else:
            status = "unhealthy"
        
        # 添加一般性建议
        if not issues:
            recommendations.append("适配器运行良好，继续保持！")
        
        return HealthCheckResult(
            is_healthy=critical_healthy,
            status=status,
            checks=checks,
            metrics=metrics,
            issues=issues,
            recommendations=recommendations
        )
    
    async def _cleanup_impl(self) -> None:
        """清理适配器资源"""
        try:
            # 记录最终统计信息
            self.logger.info(f"Hello World适配器清理中 - 总问候次数: {self.greeting_count}, "
                           f"错误次数: {self.error_count}")
            
            # 清理统计数据
            self.greeting_count = 0
            self.error_count = 0
            self.language_stats.clear()
            
            # 模拟清理延迟
            await asyncio.sleep(0.05)
            
            self.logger.info("Hello World适配器清理完成")
            
        except Exception as e:
            self.logger.error(f"清理Hello World适配器时发生错误: {e}")
            # 清理失败不应该阻止适配器停止，所以只记录错误不抛出异常


# ================================
# 使用示例和测试代码
# ================================

async def main():
    """完整的使用示例"""
    print("Hello World 适配器完整示例")
    print("=" * 50)
    
    # 创建多种配置的适配器实例
    configs = [
        {
            "adapter_id": "hello_world_zh_friendly",
            "adapter_type": "soft",
            "name": "Hello World (中文友好)",
            "version": "1.0.0",
            "greeting_style": "friendly",
            "language": "zh",
            "output_format": "text",
            "emoji_support": True
        },
        {
            "adapter_id": "hello_world_en_formal",
            "adapter_type": "soft", 
            "name": "Hello World (English Formal)",
            "version": "1.0.0",
            "greeting_style": "formal",
            "language": "en",
            "output_format": "json",
            "emoji_support": False
        },
        {
            "adapter_id": "hello_world_multi",
            "adapter_type": "soft",
            "name": "Hello World (Multi-format)",
            "version": "1.0.0",
            "greeting_style": "casual",
            "language": "ja",
            "output_format": "xml",
            "include_timestamp": True
        }
    ]
    
    for i, config in enumerate(configs, 1):
        print(f"\n示例 {i}: {config['name']}")
        print("-" * 30)
        
        try:
            # 使用上下文管理器自动管理生命周期
            async with HelloWorldAdapter(config) as adapter:
                # 显示适配器信息
                print(f"适配器信息: {adapter.get_basic_info()}")
                print(f"能力列表: {[cap.name for cap in adapter.get_capabilities()]}")
                
                # 测试不同类型的输入
                test_cases = [
                    "紫舒老师",
                    {"name": "Alice", "greeting_style": "friendly"},
                    None,
                    {"name": "Bob", "output_format": "yaml", "language": "en"},
                    ""
                ]
                
                for j, test_input in enumerate(test_cases, 1):
                    print(f"\n测试用例 {j}: {test_input}")
                    try:
                        result = await adapter.process(test_input)
                        print(f"结果: {result.output}")
                        print(f"状态: {result.status}, 耗时: {result.execution_time:.3f}s")
                    except Exception as e:
                        print(f"错误: {e}")
                
                # 执行健康检查
                print(f"\n健康检查:")
                health = await adapter.health_check()
                print(f"状态: {health.status} ({'正常' if health.is_healthy else '异常'})")
                print(f"检查项: {health.checks}")
                if health.issues:
                    print(f"问题: {health.issues}")
                if health.recommendations:
                    print(f"建议: {health.recommendations}")
                
                # 显示性能指标
                metrics = adapter.get_performance_metrics()
                print(f"性能指标: {metrics}")
                
        except Exception as e:
            print(f"适配器示例 {i} 失败: {e}")
    
    print(f"\nHello World 适配器示例演示完成!")
    
    # 错误处理示例
    print(f"\n错误处理示例:")
    print("-" * 20)
    
    try:
        # 创建配置错误的适配器
        bad_config = {
            "adapter_id": "hello_world_bad",
            "adapter_type": "soft",
            "language": "invalid_lang",  # 无效语言
            "greeting_style": "invalid_style"  # 无效风格
        }
        
        adapter = HelloWorldAdapter(bad_config)
        await adapter.initialize()
        
    except Exception as e:
        print(f"成功捕获配置错误: {e}")
    
    # 性能测试示例
    print(f"\n性能测试示例:")
    print("-" * 18)
    
    perf_config = {
        "adapter_id": "hello_world_perf",
        "adapter_type": "soft",
        "greeting_style": "casual",
        "language": "zh"
    }
    
    async with HelloWorldAdapter(perf_config) as adapter:
        start_time = time.time()
        tasks = []
        
        # 并发执行100个问候请求
        for i in range(100):
            task = asyncio.create_task(adapter.process(f"用户{i}"))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
        
        successful = sum(1 for r in results if not isinstance(r, Exception))
        failed = len(results) - successful
        
        print(f"并发测试完成:")
        print(f"   总请求: 100")
        print(f"   成功: {successful}")
        print(f"   失败: {failed}")
        print(f"   总耗时: {end_time - start_time:.3f}s")
        print(f"   平均延迟: {(end_time - start_time) / len(results) * 1000:.1f}ms")
        
        # 最终性能指标
        final_metrics = adapter.get_performance_metrics()
        print(f"最终性能指标: {final_metrics}")


async def simple_usage_example():
    """简单使用示例"""
    print("\n简单使用示例")
    print("=" * 20)
    
    # 最简单的使用方式
    config = {
        "adapter_id": "simple_hello",
        "adapter_type": "soft"
    }
    
    async with HelloWorldAdapter(config) as adapter:
        # 基本问候
        result = await adapter.process("World")
        print(f"基本问候: {result.output}")
        
        # 个性化问候
        result = await adapter.process("紫舒老师")
        print(f"个性化问候: {result.output}")
        
        # 配置化问候
        result = await adapter.process({
            "name": "Alice", 
            "language": "en",
            "output_format": "json"
        })
        print(f"配置化问候: {result.output}")


async def advanced_usage_example():
    """高级使用示例"""
    print("\n高级使用示例")
    print("=" * 20)
    
    config = {
        "adapter_id": "advanced_hello",
        "adapter_type": "soft",
        "greeting_style": "formal",
        "language": "zh",
        "output_format": "json",
        "include_timestamp": True,
        "personalization": True,
        "emoji_support": False
    }
    
    adapter = HelloWorldAdapter(config)
    
    try:
        # 手动管理生命周期
        await adapter.initialize()
        
        # 获取元数据
        metadata = adapter.get_metadata()
        print(f"适配器元数据: {metadata.name} v{metadata.version}")
        
        # 获取能力
        capabilities = adapter.get_capabilities()
        print(f"支持的能力: {[cap.name for cap in capabilities]}")
        
        # 处理请求
        result = await adapter.process("高级用户")
        print(f"处理结果: {result.output}")
        print(f"执行时间: {result.execution_time:.3f}s")
        
        # 健康检查
        health = await adapter.health_check()
        print(f"健康状态: {health.status}")
        
    finally:
        # 清理资源
        await adapter.cleanup()


def quick_test():
    """快速测试函数（同步版本）"""
    print("\n快速测试")
    print("=" * 15)
    
    async def test():
        config = {
            "adapter_id": "quick_test",
            "adapter_type": "soft",
            "language": "zh"
        }
        
        async with HelloWorldAdapter(config) as adapter:
            result = await adapter.process("快速测试")
            print(f"测试结果: {result.output}")
            return result.status == "success"
    
    # 运行测试
    success = asyncio.run(test())
    print(f"测试{'通过' if success else '失败'}: {'通过' if success else '失败'}")
    return success


if __name__ == "__main__":
    """运行所有示例"""
    # 设置日志级别以便查看详细信息
    logging.basicConfig(
        level=logging.INFO, 
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # 运行示例
    print("Hello World 适配器 - 完整演示")
    print("=" * 50)
    
    # 1. 完整示例
    asyncio.run(main())
    
    # 2. 简单示例  
    asyncio.run(simple_usage_example())
    
    # 3. 高级示例
    asyncio.run(advanced_usage_example())
    
    # 4. 快速测试
    quick_test()
    
    print("\n所有演示完成!")
    print("\n使用提示:")
    print("- 使用 async with 语法自动管理适配器生命周期")
    print("- 支持多种输入格式：字符串、字典或None")
    print("- 支持多种输出格式：text、json、xml、yaml")
    print("- 支持7种语言：zh、en、ja、ko、fr、es、de")
    print("- 支持3种问候风格：formal、casual、friendly")
    print("- 包含完整的错误处理和健康检查机制")
    print("- 详细文档请参考: https://docs.zishu.team/adapters/hello-world")