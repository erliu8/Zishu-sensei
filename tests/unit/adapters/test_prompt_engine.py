# -*- coding: utf-8 -*-
"""
提示模板引擎测试

测试动态提示模板引擎功能
"""

import pytest
import asyncio
import json
import tempfile
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

from zishu.adapters.soft.prompt_engine import (
    PromptEngine, PromptTemplate, PromptVariable, PromptContext,
    TemplateLoader, PromptValidator, PromptCache, PromptOptimizer,
    PromptEngineError, PromptTemplateError, PromptValidationError
)

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestPromptEngine:
    """提示模板引擎测试类"""

    @pytest.fixture
    def prompt_engine_config(self):
        """创建提示引擎配置"""
        return {
            "template_dir": "templates",
            "cache_enabled": True,
            "cache_ttl": 3600,
            "validation_enabled": True,
            "optimization_enabled": True,
            "max_template_size": 10000,
            "supported_formats": ["jinja2", "f-string", "template"]
        }

    @pytest.fixture
    def temp_template_dir(self):
        """创建临时模板目录"""
        temp_dir = tempfile.mkdtemp(prefix="prompt_templates_")
        yield Path(temp_dir)
        # Cleanup handled by tempfile

    @pytest.fixture
    def prompt_engine(self, prompt_engine_config):
        """创建提示引擎实例"""
        return PromptEngine(prompt_engine_config)

    @pytest.fixture
    def sample_templates(self, temp_template_dir):
        """创建示例模板"""
        templates = {
            "greeting.txt": "Hello, {{name}}! Welcome to {{platform}}.",
            "analysis.txt": """
System Role: {{role}}
Task: {{task}}
Context: {{context}}
Input: {{input}}

Please provide a detailed analysis considering:
{% for criterion in criteria %}
- {{criterion}}
{% endfor %}

Format your response as {{format}}.
""",
            "chain_of_thought.txt": """
Problem: {{problem}}

Let me think step by step:
1. First, I need to understand {{step1}}
2. Then, I should consider {{step2}}
3. Finally, I will {{step3}}

Therefore, the answer is: {{conclusion}}
"""
        }
        
        for name, content in templates.items():
            template_file = temp_template_dir / name
            template_file.write_text(content, encoding='utf-8')
        
        return templates

    @pytest.mark.asyncio
    async def test_engine_initialization(self, prompt_engine):
        """测试引擎初始化"""
        # Act
        await prompt_engine.initialize()
        
        # Assert
        assert prompt_engine.is_initialized
        assert prompt_engine.template_loader is not None
        assert prompt_engine.validator is not None
        assert prompt_engine.cache is not None

    @pytest.mark.asyncio
    async def test_simple_template_rendering(self, prompt_engine):
        """测试简单模板渲染"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = "Hello, {{name}}! You have {{count}} messages."
        variables = {"name": "Alice", "count": 5}
        
        # Act
        result = await prompt_engine.render_template(template_content, variables)
        
        # Assert
        assert result == "Hello, Alice! You have 5 messages."

    @pytest.mark.asyncio
    async def test_complex_template_rendering(self, prompt_engine, sample_templates):
        """测试复杂模板渲染"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = sample_templates["analysis.txt"]
        variables = {
            "role": "Data Analyst",
            "task": "Market Research",
            "context": "Q3 2023 Sales Data",
            "input": "Revenue trends and customer segments",
            "criteria": ["Growth rate", "Market share", "Customer retention"],
            "format": "structured report"
        }
        
        # Act
        result = await prompt_engine.render_template(template_content, variables)
        
        # Assert
        assert "Data Analyst" in result
        assert "Market Research" in result
        assert "Growth rate" in result
        assert "structured report" in result

    @pytest.mark.asyncio
    async def test_template_loading_from_file(self, prompt_engine, temp_template_dir, sample_templates):
        """测试从文件加载模板"""
        # Update config to use temp directory
        prompt_engine.config["template_dir"] = str(temp_template_dir)
        await prompt_engine.initialize()
        
        # Act
        template = await prompt_engine.load_template("greeting.txt")
        
        # Assert
        assert template is not None
        assert "{{name}}" in template.content
        assert "{{platform}}" in template.content

    @pytest.mark.asyncio
    async def test_template_validation(self, prompt_engine):
        """测试模板验证"""
        await prompt_engine.initialize()
        
        # Valid template
        valid_template = "Hello {{name}}, today is {{date}}."
        validation_result = await prompt_engine.validate_template(valid_template)
        assert validation_result.is_valid is True
        
        # Invalid template - syntax error
        invalid_template = "Hello {{name}, today is {{date}}."  # Missing closing brace
        validation_result = await prompt_engine.validate_template(invalid_template)
        assert validation_result.is_valid is False
        assert len(validation_result.errors) > 0

    @pytest.mark.asyncio
    async def test_template_caching(self, prompt_engine):
        """测试模板缓存"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = "Cached template: {{value}}"
        template_id = "test_cache"
        
        # Act - First call should cache the template
        result1 = await prompt_engine.render_template(
            template_content, 
            {"value": "first"}, 
            template_id=template_id
        )
        
        # Act - Second call should use cache
        result2 = await prompt_engine.render_template(
            template_content, 
            {"value": "second"}, 
            template_id=template_id
        )
        
        # Assert
        assert result1 == "Cached template: first"
        assert result2 == "Cached template: second"
        assert prompt_engine.cache.has(template_id)

    @pytest.mark.asyncio
    async def test_variable_validation(self, prompt_engine):
        """测试变量验证"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = "Hello {{name}}, you are {{age}} years old."
        
        # Valid variables
        valid_variables = {"name": "Bob", "age": 25}
        result = await prompt_engine.render_template(template_content, valid_variables)
        assert "Hello Bob" in result
        
        # Missing required variable
        invalid_variables = {"name": "Bob"}  # Missing 'age'
        with pytest.raises(PromptValidationError):
            await prompt_engine.render_template(template_content, invalid_variables, strict=True)

    @pytest.mark.asyncio
    async def test_template_optimization(self, prompt_engine):
        """测试模板优化"""
        await prompt_engine.initialize()
        
        # Arrange - Unoptimized template
        template_content = """
        
        Hello {{name}}.
        
        
        Your score is {{score}}.
        
        
        """
        
        # Act
        optimized = await prompt_engine.optimize_template(template_content)
        
        # Assert
        assert optimized.content != template_content
        assert optimized.content.strip() == "Hello {{name}}.\n\nYour score is {{score}}."
        assert optimized.stats["whitespace_reduced"] > 0

    @pytest.mark.asyncio
    async def test_conditional_rendering(self, prompt_engine):
        """测试条件渲染"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = """
Hello {{name}}!
{% if is_premium %}
Welcome to our premium service.
{% else %}
Consider upgrading to premium.
{% endif %}
"""
        
        # Act - Premium user
        premium_result = await prompt_engine.render_template(
            template_content, 
            {"name": "Alice", "is_premium": True}
        )
        
        # Act - Regular user
        regular_result = await prompt_engine.render_template(
            template_content, 
            {"name": "Bob", "is_premium": False}
        )
        
        # Assert
        assert "premium service" in premium_result
        assert "Consider upgrading" in regular_result

    @pytest.mark.asyncio
    async def test_loop_rendering(self, prompt_engine):
        """测试循环渲染"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = """
Shopping List:
{% for item in items %}
- {{item.name}} ({{item.quantity}})
{% endfor %}
"""
        variables = {
            "items": [
                {"name": "Apples", "quantity": 5},
                {"name": "Bread", "quantity": 1},
                {"name": "Milk", "quantity": 2}
            ]
        }
        
        # Act
        result = await prompt_engine.render_template(template_content, variables)
        
        # Assert
        assert "Apples (5)" in result
        assert "Bread (1)" in result
        assert "Milk (2)" in result

    @pytest.mark.asyncio
    async def test_nested_variables(self, prompt_engine):
        """测试嵌套变量"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = "User: {{user.profile.name}} ({{user.profile.email}})"
        variables = {
            "user": {
                "profile": {
                    "name": "John Doe",
                    "email": "john@example.com"
                }
            }
        }
        
        # Act
        result = await prompt_engine.render_template(template_content, variables)
        
        # Assert
        assert "John Doe" in result
        assert "john@example.com" in result

    @pytest.mark.asyncio
    async def test_concurrent_rendering(self, prompt_engine):
        """测试并发渲染"""
        await prompt_engine.initialize()
        
        # Arrange
        template_content = "Process {{id}}: {{status}}"
        tasks = []
        
        for i in range(10):
            variables = {"id": i, "status": f"running-{i}"}
            task = prompt_engine.render_template(template_content, variables)
            tasks.append(task)
        
        # Act
        results = await asyncio.gather(*tasks)
        
        # Assert
        assert len(results) == 10
        assert all(f"Process {i}" in results[i] for i in range(10))


class TestPromptTemplate:
    """提示模板测试类"""
    
    def test_template_creation(self):
        """测试模板创建"""
        template = PromptTemplate(
            id="test-template",
            name="Test Template",
            content="Hello {{name}}!",
            variables=["name"],
            description="A simple greeting template"
        )
        
        assert template.id == "test-template"
        assert template.name == "Test Template"
        assert "name" in template.variables
    
    def test_template_metadata(self):
        """测试模板元数据"""
        template = PromptTemplate(
            id="meta-template",
            name="Metadata Test",
            content="Content with {{var1}} and {{var2}}",
            metadata={
                "category": "greeting",
                "complexity": "simple",
                "tags": ["test", "demo"]
            }
        )
        
        assert template.metadata["category"] == "greeting"
        assert "test" in template.metadata["tags"]
    
    def test_template_validation_rules(self):
        """测试模板验证规则"""
        template = PromptTemplate(
            id="validation-template",
            name="Validation Test",
            content="Age: {{age}}",
            validation_rules={
                "age": {
                    "type": "integer",
                    "min": 0,
                    "max": 150
                }
            }
        )
        
        # Valid age
        assert template.validate_variable("age", 25) is True
        
        # Invalid age
        assert template.validate_variable("age", -5) is False
        assert template.validate_variable("age", 200) is False


class TestPromptValidator:
    """提示验证器测试类"""
    
    @pytest.fixture
    def validator(self):
        """创建验证器"""
        return PromptValidator()
    
    def test_syntax_validation(self, validator):
        """测试语法验证"""
        # Valid syntax
        valid_template = "Hello {{name}}, welcome to {{place}}!"
        result = validator.validate_syntax(valid_template)
        assert result.is_valid is True
        
        # Invalid syntax
        invalid_template = "Hello {{name}, welcome to {{place}}!"  # Mismatched braces
        result = validator.validate_syntax(invalid_template)
        assert result.is_valid is False
    
    def test_variable_extraction(self, validator):
        """测试变量提取"""
        template_content = "Hello {{name}}, you have {{count}} messages and {{new_count}} new ones."
        variables = validator.extract_variables(template_content)
        
        assert "name" in variables
        assert "count" in variables
        assert "new_count" in variables
        assert len(variables) == 3
    
    def test_security_validation(self, validator):
        """测试安全验证"""
        # Safe template
        safe_template = "Hello {{name}}, your balance is {{balance}}."
        result = validator.validate_security(safe_template)
        assert result.is_safe is True
        
        # Potentially unsafe template (code injection)
        unsafe_template = "{{__import__('os').system('rm -rf /')}}"
        result = validator.validate_security(unsafe_template)
        assert result.is_safe is False


class TestPromptCache:
    """提示缓存测试类"""
    
    @pytest.fixture
    def cache(self):
        """创建缓存"""
        return PromptCache(max_size=100, ttl=3600)
    
    @pytest.mark.asyncio
    async def test_cache_operations(self, cache):
        """测试缓存操作"""
        template_id = "test-cache"
        template_content = "Cached: {{value}}"
        
        # Set cache
        await cache.set(template_id, template_content)
        
        # Get from cache
        cached_content = await cache.get(template_id)
        assert cached_content == template_content
        
        # Check existence
        assert cache.has(template_id) is True
        
        # Remove from cache
        await cache.remove(template_id)
        assert cache.has(template_id) is False
    
    @pytest.mark.asyncio
    async def test_cache_expiration(self, cache):
        """测试缓存过期"""
        # Set short TTL for testing
        cache.ttl = 0.1  # 100ms
        
        template_id = "expire-test"
        template_content = "Will expire"
        
        # Set cache
        await cache.set(template_id, template_content)
        assert cache.has(template_id) is True
        
        # Wait for expiration
        await asyncio.sleep(0.2)
        
        # Should be expired
        assert cache.has(template_id) is False
    
    @pytest.mark.asyncio
    async def test_cache_size_limit(self, cache):
        """测试缓存大小限制"""
        cache.max_size = 3  # Small cache for testing
        
        # Fill cache beyond limit
        for i in range(5):
            await cache.set(f"template-{i}", f"content-{i}")
        
        # Only the last 3 should remain
        assert cache.size <= 3
        assert cache.has("template-4") is True
        assert cache.has("template-3") is True
        assert cache.has("template-2") is True


class TestPromptOptimizer:
    """提示优化器测试类"""
    
    @pytest.fixture
    def optimizer(self):
        """创建优化器"""
        return PromptOptimizer()
    
    def test_whitespace_optimization(self, optimizer):
        """测试空白字符优化"""
        template_with_excess_whitespace = """
        
        Hello    {{name}}.
        
        
        How   are you?
        
        
        """
        
        optimized = optimizer.optimize_whitespace(template_with_excess_whitespace)
        
        # Should remove excess whitespace
        assert optimized.count('\n') < template_with_excess_whitespace.count('\n')
        assert "Hello {{name}}." in optimized
        assert "How are you?" in optimized
    
    def test_variable_optimization(self, optimizer):
        """测试变量优化"""
        template_with_unused_vars = "Hello {{name}}! {{unused_var}} {{another_unused}}"
        used_variables = ["name"]
        
        optimized = optimizer.optimize_variables(template_with_unused_vars, used_variables)
        
        # Should suggest removing unused variables
        optimization_report = optimizer.get_optimization_report()
        assert "unused_variables" in optimization_report
        assert len(optimization_report["unused_variables"]) == 2
    
    def test_performance_optimization(self, optimizer):
        """测试性能优化"""
        complex_template = """
        {% for item in items %}
            {% for subitem in item.subitems %}
                {{subitem.name}}: {{subitem.value}}
            {% endfor %}
        {% endfor %}
        """
        
        optimization_suggestions = optimizer.analyze_performance(complex_template)
        
        # Should suggest performance improvements
        assert len(optimization_suggestions) > 0
        assert any("nested loops" in suggestion.lower() for suggestion in optimization_suggestions)


@pytest.mark.performance
class TestPromptEnginePerformance:
    """提示引擎性能测试"""
    
    @pytest.fixture
    def prompt_engine_config(self):
        """创建提示引擎配置"""
        return {
            "template_dir": "templates",
            "cache_enabled": True,
            "cache_ttl": 3600,
            "validation_enabled": True,
            "optimization_enabled": True,
            "max_template_size": 10000,
            "supported_formats": ["jinja2", "f-string", "template"]
        }

    @pytest.fixture
    def prompt_engine(self, prompt_engine_config):
        """创建提示引擎实例"""
        return PromptEngine(prompt_engine_config)
    
    @pytest.mark.asyncio
    async def test_rendering_performance(self, prompt_engine):
        """测试渲染性能"""
        await prompt_engine.initialize()
        
        template_content = "Processing {{id}}: {{name}} - {{status}} ({{timestamp}})"
        
        # Measure rendering time
        start_time = asyncio.get_event_loop().time()
        
        for i in range(1000):
            variables = {
                "id": i,
                "name": f"Task-{i}",
                "status": "completed",
                "timestamp": datetime.now().isoformat()
            }
            await prompt_engine.render_template(template_content, variables)
        
        end_time = asyncio.get_event_loop().time()
        total_time = end_time - start_time
        
        # Should render 1000 templates in reasonable time
        assert total_time < 5.0  # Less than 5 seconds
        throughput = 1000 / total_time
        assert throughput > 200  # At least 200 renders per second
    
    @pytest.mark.asyncio
    async def test_concurrent_rendering_performance(self, prompt_engine):
        """测试并发渲染性能"""
        await prompt_engine.initialize()
        
        template_content = "Concurrent task {{id}}: {{result}}"
        
        # Create concurrent tasks
        tasks = []
        for i in range(100):
            variables = {"id": i, "result": f"processed-{i}"}
            task = prompt_engine.render_template(template_content, variables)
            tasks.append(task)
        
        # Measure concurrent execution time
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks)
        end_time = asyncio.get_event_loop().time()
        
        total_time = end_time - start_time
        
        # Concurrent execution should be faster than sequential
        assert len(results) == 100
        assert total_time < 2.0  # Should complete in less than 2 seconds
    
    @pytest.mark.asyncio
    async def test_memory_usage(self, prompt_engine):
        """测试内存使用"""
        import psutil
        import os
        
        await prompt_engine.initialize()
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Generate many large templates
        large_template = "Large template: " + "{{var}}" * 1000
        
        for i in range(100):
            variables = {"var": f"value-{i}" * 100}  # Large variable content
            await prompt_engine.render_template(large_template, variables)
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable
        assert memory_increase < 50  # Less than 50MB increase
