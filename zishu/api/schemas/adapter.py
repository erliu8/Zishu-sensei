#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
适配器模型定义
包含适配器的基础数据模型、配置、元数据等
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from pathlib import Path

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic.types import PositiveFloat, PositiveInt


class AdapterType(str, Enum):
    """适配器类型枚举"""
    SOFT = "soft"           # 软适配器：Prompt Engineering + RAG
    HARD = "hard"           # 硬适配器：原生代码实现
    INTELLIGENT = "intelligent"  # 智能适配器：自适应组合
    LORA = "lora"           # LoRA适配器
    QLORA = "qlora"         # QLoRA适配器
    ADALORA = "adalora"     # AdaLoRA适配器
    LOHA = "loha"           # LoHa适配器
    LOKR = "lokr"           # LoKr适配器
    PREFIX_TUNING = "prefix_tuning"     # Prefix Tuning
    PROMPT_TUNING = "prompt_tuning"     # Prompt Tuning
    P_TUNING_V2 = "p_tuning_v2"        # P-Tuning v2


class AdapterStatus(str, Enum):
    """适配器状态枚举"""
    UNLOADED = "unloaded"
    LOADING = "loading"
    LOADED = "loaded"
    UNLOADING = "unloading"
    ERROR = "error"
    CORRUPTED = "corrupted"
    DEPRECATED = "deprecated"


class AdapterPriority(str, Enum):
    """适配器优先级"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class AdapterCapability(BaseModel):
    """适配器能力定义"""
    name: str = Field(..., description="能力名称")
    version: str = Field(..., description="能力版本")
    description: Optional[str] = Field(None, description="能力描述")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="能力参数")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "text_generation",
                "version": "1.0.0",
                "description": "文本生成能力",
                "parameters": {
                    "max_length": 2048,
                    "temperature": 0.7
                }
            }
        }
    }


class AdapterResourceRequirements(BaseModel):
    """适配器资源需求"""
    min_memory_mb: Optional[PositiveInt] = Field(None, description="最小内存需求(MB)")
    recommended_memory_mb: Optional[PositiveInt] = Field(None, description="推荐内存需求(MB)")
    min_vram_mb: Optional[PositiveInt] = Field(None, description="最小显存需求(MB)")
    recommended_vram_mb: Optional[PositiveInt] = Field(None, description="推荐显存需求(MB)")
    min_disk_mb: Optional[PositiveInt] = Field(None, description="最小磁盘空间需求(MB)")
    cpu_cores: Optional[PositiveInt] = Field(None, description="CPU核心数需求")
    gpu_required: bool = Field(False, description="是否需要GPU")
    
    @field_validator('recommended_memory_mb')
    @classmethod
    def validate_recommended_memory(cls, v, info):
        if v is not None and info.data.get('min_memory_mb') is not None:
            if v < info.data['min_memory_mb']:
                raise ValueError('推荐内存不能小于最小内存需求')
        return v
    
    @field_validator('recommended_vram_mb')
    @classmethod
    def validate_recommended_vram(cls, v, info):
        if v is not None and info.data.get('min_vram_mb') is not None:
            if v < info.data['min_vram_mb']:
                raise ValueError('推荐显存不能小于最小显存需求')
        return v


class AdapterCompatibility(BaseModel):
    """适配器兼容性信息"""
    base_models: List[str] = Field(default_factory=list, description="兼容的基础模型")
    model_architectures: List[str] = Field(default_factory=list, description="兼容的模型架构")
    framework_versions: Dict[str, str] = Field(default_factory=dict, description="框架版本要求")
    python_version: Optional[str] = Field(None, description="Python版本要求")
    cuda_version: Optional[str] = Field(None, description="CUDA版本要求")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "base_models": ["llama2-7b", "llama2-13b"],
                "model_architectures": ["LlamaForCausalLM"],
                "framework_versions": {
                    "transformers": ">=4.30.0",
                    "peft": ">=0.4.0",
                    "torch": ">=2.0.0"
                },
                "python_version": ">=3.8",
                "cuda_version": ">=11.8"
            }
        }
    }


class AdapterMetadata(BaseModel):
    """适配器元数据"""
    id: str = Field(..., description="适配器唯一标识符")
    name: str = Field(..., description="适配器名称")
    version: str = Field(..., description="适配器版本")
    adapter_type: AdapterType = Field(..., description="适配器类型")
    
    # 基本信息
    description: Optional[str] = Field(None, description="适配器描述")
    author: Optional[str] = Field(None, description="作者")
    license: Optional[str] = Field(None, description="许可证")
    tags: List[str] = Field(default_factory=list, description="标签")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    
    # 能力和兼容性
    capabilities: List[AdapterCapability] = Field(default_factory=list, description="适配器能力")
    compatibility: AdapterCompatibility = Field(default_factory=AdapterCompatibility, description="兼容性信息")
    resource_requirements: AdapterResourceRequirements = Field(
        default_factory=AdapterResourceRequirements, 
        description="资源需求"
    )
    
    # 配置信息
    config_schema: Dict[str, Any] = Field(default_factory=dict, description="配置模式")
    default_config: Dict[str, Any] = Field(default_factory=dict, description="默认配置")
    
    # 统计信息
    file_size_bytes: Optional[PositiveInt] = Field(None, description="文件大小(字节)")
    parameter_count: Optional[PositiveInt] = Field(None, description="参数数量")
    
    @field_validator('updated_at')
    @classmethod
    def validate_updated_at(cls, v, info):
        if 'created_at' in info.data and v < info.data['created_at']:
            raise ValueError('更新时间不能早于创建时间')
        return v
    
    model_config = {
        "use_enum_values": True,
        "json_encoders": {
            datetime: lambda v: v.isoformat()
        }
    }


# 特定适配器类型的配置模型
class SoftAdapterConfig(BaseModel):
    """软适配器配置（基于Prompt和RAG）"""
    prompt_template: str = Field("", description="提示词模板")
    rag_enabled: bool = Field(True, description="是否启用RAG")
    knowledge_base: str = Field("", description="知识库路径")
    max_context_length: PositiveInt = Field(4096, description="最大上下文长度")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="生成温度")
    top_p: float = Field(0.9, ge=0.0, le=1.0, description="Top-p采样")
    
    model_config = {
        "use_enum_values": True
    }


class HardAdapterConfig(BaseModel):
    """硬适配器配置（原生代码实现）"""
    code_path: str = Field("", description="代码路径")
    entry_point: str = Field("main", description="入口函数")
    dependencies: List[str] = Field(default_factory=list, description="依赖包列表")
    compilation_flags: List[str] = Field(default_factory=list, description="编译标志")
    runtime_args: Dict[str, Any] = Field(default_factory=dict, description="运行时参数")
    
    model_config = {
        "use_enum_values": True
    }


class IntelligentAdapterConfig(BaseModel):
    """智能适配器配置（自适应组合）"""
    strategy: str = Field("auto", description="适配策略")
    fallback_order: List[str] = Field(default_factory=lambda: ["soft", "hard"], description="回退顺序")
    performance_threshold: float = Field(0.8, ge=0.0, le=1.0, description="性能阈值")
    adaptation_rules: List[Dict[str, Any]] = Field(default_factory=list, description="适配规则")
    learning_enabled: bool = Field(True, description="是否启用学习")
    
    model_config = {
        "use_enum_values": True
    }


class AdapterConfig(BaseModel):
    """适配器配置"""
    # 基础配置
    enabled: bool = Field(True, description="是否启用")
    priority: AdapterPriority = Field(AdapterPriority.NORMAL, description="优先级")
    auto_load: bool = Field(False, description="是否自动加载")
    adapter_type: AdapterType = Field(..., description="适配器类型")
    
    # 性能配置
    max_memory_usage_mb: Optional[PositiveInt] = Field(None, description="最大内存使用(MB)")
    cache_size: Optional[PositiveInt] = Field(None, description="缓存大小")
    batch_size: Optional[PositiveInt] = Field(None, description="批处理大小")
    
    # 运行时配置
    device: Optional[str] = Field(None, description="运行设备")
    precision: Optional[str] = Field("float16", description="精度设置")
    
    # 软适配器特定配置
    soft_adapter_config: Optional[SoftAdapterConfig] = Field(None, description="软适配器配置(Prompt + RAG)")
    
    # 硬适配器特定配置
    hard_adapter_config: Optional[HardAdapterConfig] = Field(None, description="硬适配器配置(原生代码)")
    
    # 智能适配器特定配置
    intelligent_adapter_config: Optional[IntelligentAdapterConfig] = Field(None, description="智能适配器配置(自适应组合)")
    
    # 通用特定适配器配置
    adapter_specific_config: Dict[str, Any] = Field(default_factory=dict, description="适配器特定配置")
    
    # 监控配置
    enable_monitoring: bool = Field(True, description="是否启用监控")
    log_level: str = Field("INFO", description="日志级别")
    
    @field_validator('precision')
    @classmethod
    def validate_precision(cls, v):
        valid_precisions = ['float32', 'float16', 'bfloat16', 'int8', 'int4']
        if v not in valid_precisions:
            raise ValueError(f'精度必须是以下之一: {valid_precisions}')
        return v
    
    @field_validator('device')
    @classmethod
    def validate_device(cls, v):
        if v is not None:
            valid_devices = ['cpu', 'cuda', 'auto']
            if not (v in valid_devices or v.startswith('cuda:')):
                raise ValueError(f'设备必须是以下之一: {valid_devices} 或 cuda:N 格式')
        return v
    
    @model_validator(mode='before')
    @classmethod
    def validate_adapter_config(cls, values):
        """验证适配器配置的一致性"""
        if isinstance(values, dict):
            adapter_type = values.get('adapter_type')
            
            if adapter_type == AdapterType.SOFT:
                # 软适配器应该有软适配器配置
                if not values.get('soft_adapter_config'):
                    values['soft_adapter_config'] = {
                        'prompt_template': '',
                        'rag_enabled': True,
                        'knowledge_base': '',
                        'max_context_length': 4096
                    }
            elif adapter_type == AdapterType.HARD:
                # 硬适配器应该有硬适配器配置
                if not values.get('hard_adapter_config'):
                    values['hard_adapter_config'] = {
                        'code_path': '',
                        'entry_point': 'main',
                        'dependencies': [],
                        'compilation_flags': []
                    }
            elif adapter_type == AdapterType.INTELLIGENT:
                # 智能适配器应该有智能适配器配置
                if not values.get('intelligent_adapter_config'):
                    values['intelligent_adapter_config'] = {
                        'strategy': 'auto',
                        'fallback_order': ['soft', 'hard'],
                        'performance_threshold': 0.8,
                        'adaptation_rules': []
                    }
        
        return values
    
    model_config = {
        "use_enum_values": True
    }


class AdapterInfo(BaseModel):
    """适配器信息（用于API响应）"""
    # 基本信息
    name: str = Field(..., description="适配器名称")
    path: Optional[str] = Field(None, description="适配器路径")
    size: Optional[int] = Field(None, description="适配器大小(字节)")
    version: Optional[str] = Field(None, description="适配器版本")
    description: Optional[str] = Field(None, description="适配器描述")
    
    # 运行时状态
    status: str = Field("unloaded", description="当前状态")
    load_time: Optional[datetime] = Field(None, description="加载时间")
    memory_usage: Optional[int] = Field(None, description="内存使用(字节)")
    
    # 配置信息
    config: Dict[str, Any] = Field(default_factory=dict, description="适配器配置")
    
    model_config = {
        "use_enum_values": True,
        "json_encoders": {
            datetime: lambda v: v.isoformat(),
            Path: lambda v: str(v)
        }
    }


class AdapterValidationResult(BaseModel):
    """适配器验证结果"""
    is_valid: bool = Field(..., description="是否有效")
    errors: List[str] = Field(default_factory=list, description="错误列表")
    warnings: List[str] = Field(default_factory=list, description="警告列表")
    validation_time: PositiveFloat = Field(..., description="验证耗时(秒)")
    
    # 详细验证信息
    file_integrity: bool = Field(True, description="文件完整性")
    metadata_valid: bool = Field(True, description="元数据有效性")
    config_valid: bool = Field(True, description="配置有效性")
    compatibility_check: bool = Field(True, description="兼容性检查")
    
    @model_validator(mode='before')
    @classmethod
    def validate_overall_status(cls, values):
        """验证整体状态"""
        if isinstance(values, dict):
            checks = [
                values.get('file_integrity', True),
                values.get('metadata_valid', True),
                values.get('config_valid', True),
                values.get('compatibility_check', True)
            ]
            
            # 如果有任何检查失败，整体状态应该为无效
            if not all(checks) and values.get('is_valid', False):
                values['is_valid'] = False
                if not values.get('errors'):
                    values['errors'] = ['验证检查失败']
        
        return values


class AdapterOperation(BaseModel):
    """适配器操作"""
    operation_id: str = Field(..., description="操作ID")
    adapter_id: str = Field(..., description="适配器ID")
    operation_type: str = Field(..., description="操作类型")
    status: str = Field(..., description="操作状态")
    
    started_at: datetime = Field(default_factory=datetime.now, description="开始时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    
    progress: float = Field(0.0, description="进度百分比", ge=0.0, le=100.0)
    message: Optional[str] = Field(None, description="操作消息")
    error: Optional[str] = Field(None, description="错误信息")
    
    # 操作结果
    result: Optional[Dict[str, Any]] = Field(None, description="操作结果")
    
    model_config = {
        "json_encoders": {
            datetime: lambda v: v.isoformat()
        }
    }


# LoRA特定配置
class LoRAConfig(BaseModel):
    """LoRA适配器特定配置"""
    r: PositiveInt = Field(16, description="LoRA秩", le=512)
    alpha: PositiveInt = Field(32, description="LoRA缩放因子")
    dropout: float = Field(0.05, description="Dropout率", ge=0.0, le=1.0)
    target_modules: List[str] = Field(
        default_factory=lambda: ["q_proj", "v_proj", "k_proj", "o_proj"],
        description="目标模块"
    )
    bias: str = Field("none", description="偏置设置")
    task_type: str = Field("CAUSAL_LM", description="任务类型")
    
    @field_validator('bias')
    @classmethod
    def validate_bias(cls, v):
        valid_bias = ['none', 'all', 'lora_only']
        if v not in valid_bias:
            raise ValueError(f'偏置设置必须是以下之一: {valid_bias}')
        return v
    
    @field_validator('alpha')
    @classmethod
    def validate_alpha(cls, v, info):
        if 'r' in info.data and v < info.data['r']:
            raise ValueError('alpha应该大于等于r')
        return v


class QLoRAConfig(LoRAConfig):
    """QLoRA适配器特定配置"""
    bnb_4bit_compute_dtype: str = Field("float16", description="4bit计算数据类型")
    bnb_4bit_quant_type: str = Field("nf4", description="4bit量化类型")
    bnb_4bit_use_double_quant: bool = Field(True, description="是否使用双重量化")
    
    @field_validator('bnb_4bit_compute_dtype')
    @classmethod
    def validate_compute_dtype(cls, v):
        valid_dtypes = ['float16', 'bfloat16', 'float32']
        if v not in valid_dtypes:
            raise ValueError(f'计算数据类型必须是以下之一: {valid_dtypes}')
        return v
    
    @field_validator('bnb_4bit_quant_type')
    @classmethod
    def validate_quant_type(cls, v):
        valid_types = ['fp4', 'nf4']
        if v not in valid_types:
            raise ValueError(f'量化类型必须是以下之一: {valid_types}')
        return v


class AdaLoRAConfig(LoRAConfig):
    """AdaLoRA适配器特定配置"""
    target_r: PositiveInt = Field(8, description="目标秩")
    init_r: PositiveInt = Field(12, description="初始秩")
    tinit: PositiveInt = Field(0, description="热身步数")
    tfinal: PositiveInt = Field(1000, description="最终步数")
    deltaT: PositiveInt = Field(10, description="更新间隔")
    beta1: float = Field(0.85, description="EMA参数1", ge=0.0, le=1.0)
    beta2: float = Field(0.85, description="EMA参数2", ge=0.0, le=1.0)
    orth_reg_weight: float = Field(0.5, description="正交正则化权重", ge=0.0)
    
    @field_validator('target_r')
    @classmethod
    def validate_target_r(cls, v, info):
        if 'init_r' in info.data and v > info.data['init_r']:
            raise ValueError('目标秩不能大于初始秩')
        return v


class LoHaConfig(BaseModel):
    """LoHa适配器特定配置"""
    r: PositiveInt = Field(16, description="LoHa秩")
    alpha: PositiveInt = Field(32, description="LoHa缩放因子")
    dropout: float = Field(0.05, description="Dropout率", ge=0.0, le=1.0)
    target_modules: List[str] = Field(
        default_factory=lambda: ["q_proj", "v_proj", "k_proj", "o_proj"],
        description="目标模块"
    )
    use_effective_conv2d: bool = Field(False, description="是否使用有效卷积2D")
    decompose_both: bool = Field(False, description="是否分解两个权重")


class LoKrConfig(BaseModel):
    """LoKr适配器特定配置"""
    r: PositiveInt = Field(16, description="LoKr秩")
    alpha: PositiveInt = Field(32, description="LoKr缩放因子")
    dropout: float = Field(0.05, description="Dropout率", ge=0.0, le=1.0)
    target_modules: List[str] = Field(
        default_factory=lambda: ["q_proj", "v_proj", "k_proj", "o_proj"],
        description="目标模块"
    )
    decompose_both: bool = Field(False, description="是否分解两个权重")
    decompose_factor: int = Field(-1, description="分解因子")


class PrefixTuningConfig(BaseModel):
    """Prefix Tuning适配器特定配置"""
    num_virtual_tokens: PositiveInt = Field(20, description="虚拟token数量")
    encoder_hidden_size: Optional[PositiveInt] = Field(None, description="编码器隐藏层大小")
    prefix_projection: bool = Field(False, description="是否使用前缀投影")
    
    
class PromptTuningConfig(BaseModel):
    """Prompt Tuning适配器特定配置"""
    num_virtual_tokens: PositiveInt = Field(8, description="虚拟token数量")
    prompt_tuning_init: str = Field("random", description="初始化方式")
    prompt_tuning_init_text: Optional[str] = Field(None, description="初始化文本")
    tokenizer_name_or_path: Optional[str] = Field(None, description="分词器路径")
    
    @field_validator('prompt_tuning_init')
    @classmethod
    def validate_init_method(cls, v):
        valid_methods = ['random', 'text']
        if v not in valid_methods:
            raise ValueError(f'初始化方式必须是以下之一: {valid_methods}')
        return v


class PTuningV2Config(BaseModel):
    """P-Tuning v2适配器特定配置"""
    num_virtual_tokens: PositiveInt = Field(20, description="虚拟token数量")
    token_dim: Optional[PositiveInt] = Field(None, description="Token维度")
    num_transformer_submodules: Optional[PositiveInt] = Field(None, description="Transformer子模块数量")
    num_attention_heads: Optional[PositiveInt] = Field(None, description="注意力头数量")
    num_layers: Optional[PositiveInt] = Field(None, description="层数")
    encoder_reparameterization_type: str = Field("MLP", description="编码器重参数化类型")
    encoder_hidden_size: Optional[PositiveInt] = Field(None, description="编码器隐藏层大小")
    encoder_num_layers: PositiveInt = Field(2, description="编码器层数")
    encoder_dropout: float = Field(0.0, description="编码器Dropout", ge=0.0, le=1.0)


# 适配器类型到配置类的映射
ADAPTER_CONFIG_MAPPING = {
    AdapterType.LORA: LoRAConfig,
    AdapterType.QLORA: QLoRAConfig,
    AdapterType.ADALORA: AdaLoRAConfig,
    AdapterType.LOHA: LoHaConfig,
    AdapterType.LOKR: LoKrConfig,
    AdapterType.PREFIX_TUNING: PrefixTuningConfig,
    AdapterType.PROMPT_TUNING: PromptTuningConfig,
    AdapterType.P_TUNING_V2: PTuningV2Config,
}


def get_adapter_config_class(adapter_type: AdapterType):
    """根据适配器类型获取对应的配置类"""
    return ADAPTER_CONFIG_MAPPING.get(adapter_type, dict)


# 适配器管理相关的请求和响应模型
class AdapterLoadRequest(BaseModel):
    """适配器加载请求"""
    adapter_path: str = Field(..., description="适配器路径")
    adapter_name: str = Field(..., description="适配器名称")
    adapter_id: Optional[str] = Field(None, description="适配器ID")
    config_override: Optional[Dict[str, Any]] = Field(None, description="配置覆盖")
    force_reload: bool = Field(False, description="是否强制重新加载")
    async_load: bool = Field(False, description="是否异步加载")
    timeout: Optional[PositiveInt] = Field(30, description="超时时间(秒)")
    
    @field_validator('adapter_path')
    @classmethod
    def validate_adapter_path(cls, v):
        if not v or not v.strip():
            raise ValueError('适配器路径不能为空')
        return v
    
    @field_validator('adapter_name')
    @classmethod
    def validate_adapter_name(cls, v):
        if not v or not v.strip():
            raise ValueError('适配器名称不能为空')
        return v
    
    
class AdapterUnloadRequest(BaseModel):
    """适配器卸载请求"""
    adapter_name: str = Field(..., description="适配器名称")
    adapter_id: Optional[str] = Field(None, description="适配器ID")
    force: bool = Field(False, description="是否强制卸载")
    cleanup_memory: bool = Field(True, description="是否清理内存")
    save_state: bool = Field(True, description="是否保存状态")
    

class AdapterSwitchRequest(BaseModel):
    """适配器切换请求"""
    from_adapter_id: Optional[str] = Field(None, description="源适配器ID")
    to_adapter_id: str = Field(..., description="目标适配器ID")
    unload_previous: bool = Field(True, description="是否卸载之前的适配器")
    config: Optional[Dict[str, Any]] = Field(None, description="配置")
    config_override: Optional[Dict[str, Any]] = Field(None, description="配置覆盖")
    timeout: Optional[PositiveInt] = Field(30, description="超时时间(秒)")
    
    @model_validator(mode='after')
    def validate_different_adapters(self):
        """验证源适配器和目标适配器不能相同"""
        if self.from_adapter_id and self.from_adapter_id == self.to_adapter_id:
            raise ValueError("源适配器和目标适配器不能相同")
        return self


class AdapterListRequest(BaseModel):
    """适配器列表请求"""
    status_filter: Optional[List[AdapterStatus]] = Field(None, description="状态过滤")
    type_filter: Optional[List[AdapterType]] = Field(None, description="类型过滤")
    tag_filter: Optional[List[str]] = Field(None, description="标签过滤")
    search_query: Optional[str] = Field(None, description="搜索查询")
    limit: Optional[PositiveInt] = Field(None, description="结果限制")
    offset: Optional[int] = Field(0, description="偏移量", ge=0)
    sort_by: Optional[str] = Field("name", description="排序字段")
    sort_order: Optional[str] = Field("asc", description="排序顺序")
    
    @field_validator('sort_order')
    @classmethod
    def validate_sort_order(cls, v):
        if v not in ['asc', 'desc']:
            raise ValueError('排序顺序必须是asc或desc')
        return v


class AdapterRegistrationRequest(BaseModel):
    """适配器注册请求"""
    adapter_path: str = Field(..., description="适配器路径")
    metadata_override: Optional[Dict[str, Any]] = Field(None, description="元数据覆盖")
    validate: bool = Field(True, description="是否验证")
    auto_load: bool = Field(False, description="是否自动加载")


class AdapterUpdateRequest(BaseModel):
    """适配器更新请求"""
    adapter_id: str = Field(..., description="适配器ID")
    metadata_update: Optional[Dict[str, Any]] = Field(None, description="元数据更新")
    config_update: Optional[Dict[str, Any]] = Field(None, description="配置更新")
    validate: bool = Field(True, description="是否验证")


# 响应模型
class AdapterOperationResponse(BaseModel):
    """适配器操作响应"""
    success: bool = Field(..., description="操作是否成功")
    operation_id: str = Field(..., description="操作ID")
    adapter_id: str = Field(..., description="适配器ID")
    operation_type: str = Field(..., description="操作类型")
    
    message: str = Field(..., description="操作消息")
    execution_time: PositiveFloat = Field(..., description="执行时间(秒)")
    
    # 详细信息
    details: Optional[Dict[str, Any]] = Field(None, description="详细信息")
    warnings: List[str] = Field(default_factory=list, description="警告信息")
    
    # 资源使用情况
    memory_usage_mb: Optional[PositiveFloat] = Field(None, description="内存使用(MB)")
    gpu_memory_usage_mb: Optional[PositiveFloat] = Field(None, description="GPU内存使用(MB)")


class AdapterListResponse(BaseModel):
    """适配器列表响应"""
    adapters: List[AdapterInfo] = Field(..., description="适配器列表")
    total_count: int = Field(..., description="总数量", ge=0)
    filtered_count: int = Field(..., description="过滤后数量", ge=0)
    
    # 分页信息
    limit: Optional[int] = Field(None, description="限制数量")
    offset: int = Field(0, description="偏移量", ge=0)
    has_more: bool = Field(False, description="是否有更多")
    
    # 统计信息
    status_counts: Dict[str, int] = Field(default_factory=dict, description="状态统计")
    type_counts: Dict[str, int] = Field(default_factory=dict, description="类型统计")


class AdapterValidationResponse(BaseModel):
    """适配器验证响应"""
    adapter_id: str = Field(..., description="适配器ID")
    validation_result: AdapterValidationResult = Field(..., description="验证结果")
    recommendations: List[str] = Field(default_factory=list, description="建议")


class AdapterMonitoringData(BaseModel):
    """适配器监控数据"""
    adapter_id: str = Field(..., description="适配器ID")
    timestamp: datetime = Field(default_factory=datetime.now, description="时间戳")
    
    # 性能指标
    memory_usage_mb: PositiveFloat = Field(..., description="内存使用(MB)")
    gpu_memory_usage_mb: Optional[PositiveFloat] = Field(None, description="GPU内存使用(MB)")
    cpu_usage_percent: float = Field(..., description="CPU使用率", ge=0.0, le=100.0)
    gpu_usage_percent: Optional[float] = Field(None, description="GPU使用率", ge=0.0, le=100.0)
    
    # 业务指标
    inference_count: int = Field(0, description="推理次数", ge=0)
    error_count: int = Field(0, description="错误次数", ge=0)
    average_latency_ms: Optional[PositiveFloat] = Field(None, description="平均延迟(毫秒)")
    throughput_per_second: Optional[PositiveFloat] = Field(None, description="吞吐量(每秒)")
    
    # 健康状态
    health_score: float = Field(100.0, description="健康评分", ge=0.0, le=100.0)
    alerts: List[str] = Field(default_factory=list, description="告警信息")
    
    model_config = {
        "json_encoders": {
            datetime: lambda v: v.isoformat()
        }
    }


class AdapterBatchOperationRequest(BaseModel):
    """适配器批量操作请求"""
    operation_type: str = Field(..., description="操作类型")
    adapter_ids: List[str] = Field(..., description="适配器ID列表", min_length=1)
    config_override: Optional[Dict[str, Any]] = Field(None, description="配置覆盖")
    parallel: bool = Field(True, description="是否并行执行")
    timeout: Optional[PositiveInt] = Field(60, description="超时时间(秒)")
    
    @field_validator('operation_type')
    @classmethod
    def validate_operation_type(cls, v):
        valid_operations = ['load', 'unload', 'validate', 'update']
        if v not in valid_operations:
            raise ValueError(f'操作类型必须是以下之一: {valid_operations}')
        return v


class AdapterBatchOperationResponse(BaseModel):
    """适配器批量操作响应"""
    operation_id: str = Field(..., description="批量操作ID")
    operation_type: str = Field(..., description="操作类型")
    total_count: int = Field(..., description="总数量", ge=0)
    success_count: int = Field(..., description="成功数量", ge=0)
    failed_count: int = Field(..., description="失败数量", ge=0)
    
    # 详细结果
    results: List[AdapterOperationResponse] = Field(..., description="操作结果列表")
    
    # 执行信息
    started_at: datetime = Field(..., description="开始时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    execution_time: Optional[PositiveFloat] = Field(None, description="执行时间(秒)")
    
    model_config = {
        "json_encoders": {
            datetime: lambda v: v.isoformat()
        }
    }


# 配置和元数据管理工具函数
def create_adapter_metadata(
    adapter_id: str,
    name: str,
    version: str,
    adapter_type: AdapterType,
    **kwargs
) -> AdapterMetadata:
    """创建适配器元数据"""
    return AdapterMetadata(
        id=adapter_id,
        name=name,
        version=version,
        adapter_type=adapter_type,
        **kwargs
    )


def create_default_adapter_config(
    adapter_type: AdapterType,
    **overrides
) -> AdapterConfig:
    """创建默认适配器配置"""
    config = AdapterConfig()
    
    # 根据适配器类型设置特定配置
    if adapter_type in [AdapterType.LORA, AdapterType.QLORA]:
        config.adapter_specific_config = {
            "r": 16,
            "alpha": 32,
            "dropout": 0.05,
            "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"]
        }
    elif adapter_type == AdapterType.PREFIX_TUNING:
        config.adapter_specific_config = {
            "num_virtual_tokens": 20,
            "prefix_projection": False
        }
    elif adapter_type == AdapterType.PROMPT_TUNING:
        config.adapter_specific_config = {
            "num_virtual_tokens": 8,
            "prompt_tuning_init": "random"
        }
    
    # 应用覆盖配置
    for key, value in overrides.items():
        if hasattr(config, key):
            setattr(config, key, value)
        else:
            config.adapter_specific_config[key] = value
    
    return config


def validate_adapter_compatibility(
    adapter_metadata: AdapterMetadata,
    base_model: str,
    framework_versions: Optional[Dict[str, str]] = None
) -> AdapterValidationResult:
    """验证适配器兼容性"""
    errors = []
    warnings = []
    
    # 检查基础模型兼容性
    if adapter_metadata.compatibility.base_models:
        if base_model not in adapter_metadata.compatibility.base_models:
            errors.append(f"适配器不兼容基础模型 {base_model}")
    
    # 检查框架版本兼容性
    if framework_versions and adapter_metadata.compatibility.framework_versions:
        for framework, required_version in adapter_metadata.compatibility.framework_versions.items():
            if framework in framework_versions:
                current_version = framework_versions[framework]
                # 简单版本比较（实际应用中应使用更复杂的版本比较逻辑）
                if not _compare_versions(current_version, required_version):
                    warnings.append(f"框架 {framework} 版本可能不兼容: 当前 {current_version}, 需要 {required_version}")
    
    is_valid = len(errors) == 0
    
    return AdapterValidationResult(
        is_valid=is_valid,
        errors=errors,
        warnings=warnings,
        validation_time=0.1,  # 占位符
        file_integrity=True,
        metadata_valid=True,
        config_valid=True,
        compatibility_check=is_valid
    )


def _compare_versions(current: str, required: str) -> bool:
    """简单版本比较（占位符实现）"""
    # 实际应用中应使用packaging.version或类似库
    try:
        current_parts = [int(x) for x in current.replace('>=', '').replace('>', '').split('.')]
        required_parts = [int(x) for x in required.replace('>=', '').replace('>', '').split('.')]
        
        # 简单比较主版本号
        return current_parts[0] >= required_parts[0]
    except:
        return True  # 如果解析失败，假设兼容


def merge_adapter_configs(
    base_config: AdapterConfig,
    override_config: Dict[str, Any]
) -> AdapterConfig:
    """合并适配器配置"""
    # 创建基础配置的副本
    merged_config = base_config.model_copy(deep=True)
    
    # 合并覆盖配置
    for key, value in override_config.items():
        if hasattr(merged_config, key):
            if key == "adapter_specific_config":
                # 深度合并特定配置
                merged_config.adapter_specific_config.update(value)
            else:
                setattr(merged_config, key, value)
        else:
            # 未知配置项添加到特定配置中
            merged_config.adapter_specific_config[key] = value
    
    return merged_config


def extract_adapter_info_from_path(adapter_path: str) -> Dict[str, Any]:
    """从路径提取适配器信息"""
    from pathlib import Path
    import json
    import os
    
    path = Path(adapter_path)
    info = {
        "name": path.name,
        "path": str(path.absolute()),
        "exists": path.exists(),
        "is_directory": path.is_dir() if path.exists() else False,
        "size_bytes": None,
        "files": []
    }
    
    if path.exists():
        if path.is_dir():
            # 目录形式的适配器
            info["files"] = [f.name for f in path.iterdir() if f.is_file()]
            
            # 查找配置文件
            config_files = ["adapter_config.json", "config.json", "adapter_model.safetensors"]
            for config_file in config_files:
                config_path = path / config_file
                if config_path.exists():
                    info["config_file"] = config_file
                    break
            
            # 计算总大小
            total_size = sum(f.stat().st_size for f in path.rglob('*') if f.is_file())
            info["size_bytes"] = total_size
            
        else:
            # 单文件适配器
            info["size_bytes"] = path.stat().st_size
    
    return info


def generate_adapter_id(name: str, version: str = "1.0.0") -> str:
    """生成适配器ID"""
    import hashlib
    import time
    
    # 使用名称、版本和时间戳生成唯一ID
    content = f"{name}_{version}_{int(time.time())}"
    return hashlib.md5(content.encode()).hexdigest()[:16]


def create_adapter_operation(
    adapter_id: str,
    operation_type: str,
    **kwargs
) -> AdapterOperation:
    """创建适配器操作记录"""
    import uuid
    
    return AdapterOperation(
        operation_id=str(uuid.uuid4()),
        adapter_id=adapter_id,
        operation_type=operation_type,
        status="pending",
        **kwargs
    )


# 验证和错误处理
class AdapterValidationError(Exception):
    """适配器验证错误"""
    def __init__(self, message: str, errors: List[str] = None, adapter_id: str = None):
        super().__init__(message)
        self.message = message
        self.errors = errors or []
        self.adapter_id = adapter_id


class AdapterLoadError(Exception):
    """适配器加载错误"""
    def __init__(self, message: str, adapter_id: str = None, cause: Exception = None):
        super().__init__(message)
        self.message = message
        self.adapter_id = adapter_id
        self.cause = cause


class AdapterConfigError(Exception):
    """适配器配置错误"""
    def __init__(self, message: str, config_key: str = None, adapter_id: str = None):
        super().__init__(message)
        self.message = message
        self.config_key = config_key
        self.adapter_id = adapter_id


class AdapterCompatibilityError(Exception):
    """适配器兼容性错误"""
    def __init__(self, message: str, adapter_id: str = None, base_model: str = None):
        super().__init__(message)
        self.message = message
        self.adapter_id = adapter_id
        self.base_model = base_model


def validate_adapter_metadata(metadata: AdapterMetadata) -> AdapterValidationResult:
    """验证适配器元数据"""
    errors = []
    warnings = []
    start_time = datetime.now()
    
    # 基本字段验证
    if not metadata.id or not metadata.id.strip():
        errors.append("适配器ID不能为空")
    
    if not metadata.name or not metadata.name.strip():
        errors.append("适配器名称不能为空")
    
    if not metadata.version or not metadata.version.strip():
        errors.append("适配器版本不能为空")
    
    # 版本格式验证
    if metadata.version:
        import re
        version_pattern = r'^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$'
        if not re.match(version_pattern, metadata.version):
            warnings.append("版本号格式建议使用语义化版本(如1.0.0)")
    
    # 能力验证
    for capability in metadata.capabilities:
        if not capability.name or not capability.name.strip():
            errors.append("能力名称不能为空")
        if not capability.version or not capability.version.strip():
            errors.append("能力版本不能为空")
    
    # 资源需求验证
    if metadata.resource_requirements.min_memory_mb and metadata.resource_requirements.recommended_memory_mb:
        if metadata.resource_requirements.min_memory_mb > metadata.resource_requirements.recommended_memory_mb:
            errors.append("最小内存需求不能大于推荐内存需求")
    
    # 兼容性验证
    if not metadata.compatibility.base_models:
        warnings.append("未指定兼容的基础模型")
    
    validation_time = (datetime.now() - start_time).total_seconds()
    
    return AdapterValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        validation_time=validation_time,
        file_integrity=True,  # 这里需要实际的文件检查
        metadata_valid=len(errors) == 0,
        config_valid=True,  # 这里需要实际的配置检查
        compatibility_check=True  # 这里需要实际的兼容性检查
    )


def validate_adapter_config(config: AdapterConfig, adapter_type: AdapterType) -> AdapterValidationResult:
    """验证适配器配置"""
    errors = []
    warnings = []
    start_time = datetime.now()
    
    # 基本配置验证
    if config.max_memory_usage_mb and config.max_memory_usage_mb <= 0:
        errors.append("最大内存使用必须大于0")
    
    if config.cache_size and config.cache_size <= 0:
        errors.append("缓存大小必须大于0")
    
    if config.batch_size and config.batch_size <= 0:
        errors.append("批处理大小必须大于0")
    
    # 设备验证
    if config.device:
        valid_devices = ['cpu', 'cuda', 'auto']
        if config.device not in valid_devices and not config.device.startswith('cuda:'):
            errors.append(f"无效的设备设置: {config.device}")
    
    # 特定适配器配置验证
    if adapter_type in [AdapterType.LORA, AdapterType.QLORA]:
        _validate_lora_config(config.adapter_specific_config, errors, warnings)
    elif adapter_type == AdapterType.PREFIX_TUNING:
        _validate_prefix_tuning_config(config.adapter_specific_config, errors, warnings)
    elif adapter_type == AdapterType.PROMPT_TUNING:
        _validate_prompt_tuning_config(config.adapter_specific_config, errors, warnings)
    
    validation_time = (datetime.now() - start_time).total_seconds()
    
    return AdapterValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        validation_time=validation_time,
        file_integrity=True,
        metadata_valid=True,
        config_valid=len(errors) == 0,
        compatibility_check=True
    )


def _validate_lora_config(config: Dict[str, Any], errors: List[str], warnings: List[str]):
    """验证LoRA配置"""
    if 'r' in config:
        r = config['r']
        if not isinstance(r, int) or r <= 0:
            errors.append("LoRA秩(r)必须是正整数")
        elif r > 512:
            warnings.append("LoRA秩过大可能影响性能")
    
    if 'alpha' in config:
        alpha = config['alpha']
        if not isinstance(alpha, int) or alpha <= 0:
            errors.append("LoRA缩放因子(alpha)必须是正整数")
    
    if 'dropout' in config:
        dropout = config['dropout']
        if not isinstance(dropout, (int, float)) or dropout < 0 or dropout > 1:
            errors.append("LoRA dropout必须在0-1之间")
    
    if 'target_modules' in config:
        target_modules = config['target_modules']
        if not isinstance(target_modules, list) or not target_modules:
            errors.append("目标模块必须是非空列表")


def _validate_prefix_tuning_config(config: Dict[str, Any], errors: List[str], warnings: List[str]):
    """验证Prefix Tuning配置"""
    if 'num_virtual_tokens' in config:
        num_tokens = config['num_virtual_tokens']
        if not isinstance(num_tokens, int) or num_tokens <= 0:
            errors.append("虚拟token数量必须是正整数")
        elif num_tokens > 100:
            warnings.append("虚拟token数量过多可能影响性能")


def _validate_prompt_tuning_config(config: Dict[str, Any], errors: List[str], warnings: List[str]):
    """验证Prompt Tuning配置"""
    if 'num_virtual_tokens' in config:
        num_tokens = config['num_virtual_tokens']
        if not isinstance(num_tokens, int) or num_tokens <= 0:
            errors.append("虚拟token数量必须是正整数")
    
    if 'prompt_tuning_init' in config:
        init_method = config['prompt_tuning_init']
        if init_method not in ['random', 'text']:
            errors.append("初始化方式必须是'random'或'text'")
        
        if init_method == 'text' and 'prompt_tuning_init_text' not in config:
            errors.append("使用文本初始化时必须提供初始化文本")


def validate_adapter_file_integrity(adapter_path: str) -> AdapterValidationResult:
    """验证适配器文件完整性"""
    from pathlib import Path
    import json
    
    errors = []
    warnings = []
    start_time = datetime.now()
    
    path = Path(adapter_path)
    
    # 检查路径是否存在
    if not path.exists():
        errors.append(f"适配器路径不存在: {adapter_path}")
        return AdapterValidationResult(
            is_valid=False,
            errors=errors,
            warnings=warnings,
            validation_time=(datetime.now() - start_time).total_seconds(),
            file_integrity=False,
            metadata_valid=False,
            config_valid=False,
            compatibility_check=False
        )
    
    # 检查必需文件
    required_files = []
    optional_files = []
    
    if path.is_dir():
        # 目录形式的适配器
        required_files = ['adapter_config.json']
        optional_files = ['adapter_model.safetensors', 'pytorch_model.bin', 'model.safetensors']
        
        # 检查必需文件
        for required_file in required_files:
            if not (path / required_file).exists():
                errors.append(f"缺少必需文件: {required_file}")
        
        # 检查至少有一个模型文件
        model_files_exist = any((path / f).exists() for f in optional_files)
        if not model_files_exist:
            warnings.append("未找到模型文件，可能是配置文件适配器")
        
        # 验证配置文件格式
        config_path = path / 'adapter_config.json'
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"配置文件格式错误: {e}")
            except Exception as e:
                errors.append(f"读取配置文件失败: {e}")
    
    else:
        # 单文件适配器
        if not path.suffix in ['.bin', '.safetensors', '.pt', '.pth']:
            warnings.append("文件扩展名不是常见的模型文件格式")
    
    validation_time = (datetime.now() - start_time).total_seconds()
    
    return AdapterValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        validation_time=validation_time,
        file_integrity=len(errors) == 0,
        metadata_valid=True,
        config_valid=True,
        compatibility_check=True
    )


def create_error_response(
    error: Exception,
    operation_id: str = None,
    adapter_id: str = None
) -> Dict[str, Any]:
    """创建错误响应"""
    import traceback
    import uuid
    
    error_response = {
        "success": False,
        "operation_id": operation_id or str(uuid.uuid4()),
        "adapter_id": adapter_id or "unknown",
        "operation_type": "error",
        "message": str(error),
        "execution_time": 0.0,
        "details": {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exc() if hasattr(error, '__traceback__') else None
        },
        "warnings": []
    }
    
    # 添加特定错误类型的详细信息
    if isinstance(error, AdapterValidationError):
        error_response["details"]["validation_errors"] = error.errors
    elif isinstance(error, AdapterLoadError):
        error_response["details"]["cause"] = str(error.cause) if error.cause else None
    elif isinstance(error, AdapterConfigError):
        error_response["details"]["config_key"] = error.config_key
    elif isinstance(error, AdapterCompatibilityError):
        error_response["details"]["base_model"] = error.base_model
    
    return error_response


# 导出所有模型类
__all__ = [
    # 基础枚举和模型
    'AdapterType',
    'AdapterStatus', 
    'AdapterPriority',
    'AdapterCapability',
    'AdapterResourceRequirements',
    'AdapterCompatibility',
    'AdapterMetadata',
    'AdapterConfig',
    'AdapterInfo',
    'AdapterValidationResult',
    'AdapterOperation',
    
    # 特定适配器配置
    'LoRAConfig',
    'QLoRAConfig',
    'AdaLoRAConfig',
    'LoHaConfig',
    'LoKrConfig',
    'PrefixTuningConfig',
    'PromptTuningConfig',
    'PTuningV2Config',
    'ADAPTER_CONFIG_MAPPING',
    'get_adapter_config_class',
    
    # 请求模型
    'AdapterLoadRequest',
    'AdapterUnloadRequest',
    'AdapterSwitchRequest',
    'AdapterListRequest',
    'AdapterRegistrationRequest',
    'AdapterUpdateRequest',
    'AdapterBatchOperationRequest',
    
    # 响应模型
    'AdapterOperationResponse',
    'AdapterListResponse',
    'AdapterValidationResponse',
    'AdapterMonitoringData',
    'AdapterBatchOperationResponse',
    
    # 工具函数
    'create_adapter_metadata',
    'create_default_adapter_config',
    'validate_adapter_compatibility',
    'merge_adapter_configs',
    'extract_adapter_info_from_path',
    'generate_adapter_id',
    'create_adapter_operation',
    
    # 验证函数
    'validate_adapter_metadata',
    'validate_adapter_config',
    'validate_adapter_file_integrity',
    'create_error_response',
    
    # 异常类
    'AdapterValidationError',
    'AdapterLoadError',
    'AdapterConfigError',
    'AdapterCompatibilityError'
]
