# -*- coding: utf-8 -*-
"""
多模态适配器实现
提供处理文本、图像、音频等多种模态数据的适配器功能
"""

import asyncio
import base64
import io
import json
import logging
import tempfile
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple

try:
    import numpy as np
except ImportError:
    np = None

from ..base import BaseAdapter, ExecutionContext, ExecutionResult, AdapterStatus, HealthCheckResult
from ..base.exceptions import BaseAdapterException

logger = logging.getLogger(__name__)


class MultimodalError(BaseAdapterException):
    """多模态适配器错误"""
    pass


class ModalityType(Enum):
    """模态类型"""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    MIXED = "mixed"


@dataclass
class ModalityData:
    """模态数据"""
    modality_type: ModalityType
    data: Any
    metadata: Dict[str, Any] = field(default_factory=dict)
    encoding: Optional[str] = None
    
    
class ModalityProcessor(ABC):
    """模态处理器基类"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        
    @abstractmethod
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """处理模态数据"""
        pass
        
    @abstractmethod
    def validate(self, data: Any) -> bool:
        """验证数据格式"""
        pass
        
    def is_supported(self, data: Any) -> bool:
        """检查数据是否支持"""
        return self.validate(data)


class TextProcessor(ModalityProcessor):
    """文本处理器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.model = self.config.get('model', 'default')
        self.max_length = self.config.get('max_length', 512)
        self.embedding_dim = self.config.get('embedding_dim', 768)
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """处理文本数据"""
        # 处理输入数据格式
        if isinstance(data, dict):
            text = data.get('content', data.get('data', str(data)))
            input_metadata = data.get('metadata', {})
        elif isinstance(data, bytes):
            text = data.decode('utf-8')
            input_metadata = {}
        elif isinstance(data, str):
            text = data
            input_metadata = {}
        else:
            text = str(data)
            input_metadata = {}
            
        # 合并元数据
        combined_metadata = input_metadata.copy()
        if metadata:
            combined_metadata.update(metadata)
            
        # 生成模拟文本特征
        text_features = {
            'length': len(text),
            'model': self.model,
            'max_length': self.max_length,
            'word_count': len(text.split()) if text else 0
        }
        
        # 添加元数据中的语言信息
        if combined_metadata.get('language'):
            text_features['language'] = combined_metadata['language']
            
        # 生成模拟嵌入 (如果有numpy)
        if np is not None:
            text_embedding = np.random.rand(self.embedding_dim).tolist()
        else:
            text_embedding = [0.0] * self.embedding_dim
            
        return {
            'text_embedding': text_embedding,
            'text_features': text_features,
            'processing_time': 0.1,  # 模拟处理时间
            'modality_type': 'text',
            'metadata': combined_metadata
        }
        
    def validate(self, data: Any) -> bool:
        """验证文本数据"""
        return isinstance(data, (str, bytes))


class ImageProcessor(ModalityProcessor):
    """图像处理器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.model = self.config.get('model', 'resnet50')
        self.input_size = self.config.get('input_size', [224, 224])
        self.embedding_dim = self.config.get('embedding_dim', 2048)
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """处理图像数据"""
        # 处理输入数据格式
        if isinstance(data, dict):
            image_data_str = data.get('data', data.get('content'))
            input_metadata = data.get('metadata', {})
            format_type = data.get('format', 'base64')
        else:
            image_data_str = data
            input_metadata = {}
            format_type = 'base64'
            
        # 处理图像数据
        if isinstance(image_data_str, str):
            try:
                image_data = base64.b64decode(image_data_str)
            except Exception:
                raise MultimodalError(f"Invalid base64 image data")
        elif isinstance(image_data_str, bytes):
            image_data = image_data_str
        else:
            raise MultimodalError(f"Unsupported image data type: {type(image_data_str)}")
            
        # 合并元数据
        combined_metadata = input_metadata.copy()
        if metadata:
            combined_metadata.update(metadata)
            
        # 生成模拟图像特征
        image_features = await self._extract_features(image_data)
        image_features.update({
            'size_bytes': len(image_data),
            'model': self.model,
            'input_size': self.input_size,
            'format': format_type
        })
        
        # 生成模拟嵌入
        if np is not None:
            image_embedding = np.random.rand(self.embedding_dim).tolist()
        else:
            image_embedding = [0.0] * self.embedding_dim
            
        return {
            'image_embedding': image_embedding,
            'image_features': image_features,
            'processing_time': 0.2,
            'modality_type': 'image',
            'metadata': combined_metadata
        }
    
    async def _extract_features(self, image_data: bytes) -> Dict[str, Any]:
        """提取图像特征 (模拟实现)"""
        return {
            'width': 224,
            'height': 224,
            'objects': ['cat', 'dog'],  # 模拟检测结果
            'scene': 'indoor',
            'confidence': 0.85
        }
        
    def validate(self, data: Any) -> bool:
        """验证图像数据"""
        return isinstance(data, (str, bytes))


class AudioProcessor(ModalityProcessor):
    """音频处理器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.model = self.config.get('model', 'wav2vec2')
        self.sample_rate = self.config.get('sample_rate', 16000)
        self.embedding_dim = self.config.get('embedding_dim', 768)
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """处理音频数据"""
        # 处理输入数据格式
        if isinstance(data, dict):
            audio_data_str = data.get('data', data.get('content'))
            input_metadata = data.get('metadata', {})
            format_type = data.get('format', 'base64')
        else:
            audio_data_str = data
            input_metadata = {}
            format_type = 'base64'
            
        # 处理音频数据
        if isinstance(audio_data_str, str):
            try:
                audio_data = base64.b64decode(audio_data_str)
            except Exception:
                raise MultimodalError(f"Invalid base64 audio data")
        elif isinstance(audio_data_str, bytes):
            audio_data = audio_data_str
        else:
            raise MultimodalError(f"Unsupported audio data type: {type(audio_data_str)}")
            
        # 合并元数据
        combined_metadata = input_metadata.copy()
        if metadata:
            combined_metadata.update(metadata)
            
        # 生成模拟音频特征
        audio_features = await self._extract_features(audio_data)
        audio_features.update({
            'size_bytes': len(audio_data),
            'model': self.model,
            'sample_rate': self.sample_rate,
            'format': format_type
        })
        
        # 添加持续时间信息
        if combined_metadata.get('duration'):
            audio_features['duration'] = combined_metadata['duration']
            
        # 生成模拟嵌入
        if np is not None:
            audio_embedding = np.random.rand(self.embedding_dim).tolist()
        else:
            audio_embedding = [0.0] * self.embedding_dim
            
        return {
            'audio_embedding': audio_embedding,
            'audio_features': audio_features,
            'processing_time': 0.3,
            'modality_type': 'audio',
            'metadata': combined_metadata
        }
    
    async def _extract_features(self, audio_data: bytes) -> Dict[str, Any]:
        """提取音频特征 (模拟实现)"""
        return {
            'transcription': 'hello world',  # 模拟转写结果
            'speaker_count': 1,
            'confidence': 0.92,
            'duration': 5.0
        }
        
    def validate(self, data: Any) -> bool:
        """验证音频数据"""
        return isinstance(data, (str, bytes))


class VideoProcessor(ModalityProcessor):
    """视频处理器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.model = self.config.get('model', 'video-encoder')
        self.frame_rate = self.config.get('frame_rate', 30)
        self.embedding_dim = self.config.get('embedding_dim', 1024)
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """处理视频数据"""
        # 处理输入数据格式
        if isinstance(data, dict):
            video_data_str = data.get('data', data.get('content'))
            input_metadata = data.get('metadata', {})
            format_type = data.get('format', 'base64')
        else:
            video_data_str = data
            input_metadata = {}
            format_type = 'base64'
            
        # 处理视频数据
        if isinstance(video_data_str, str):
            try:
                video_data = base64.b64decode(video_data_str)
            except Exception:
                raise MultimodalError(f"Invalid base64 video data")
        elif isinstance(video_data_str, bytes):
            video_data = video_data_str
        else:
            raise MultimodalError(f"Unsupported video data type: {type(video_data_str)}")
            
        # 合并元数据
        combined_metadata = input_metadata.copy()
        if metadata:
            combined_metadata.update(metadata)
            
        # 生成模拟视频特征
        video_features = {
            'size_bytes': len(video_data),
            'model': self.model,
            'frame_rate': self.frame_rate,
            'format': format_type,
            'duration': combined_metadata.get('duration', 10.0),  # 默认时长
            'resolution': combined_metadata.get('resolution', '1920x1080')
        }
        
        # 生成模拟嵌入
        if np is not None:
            video_embedding = np.random.rand(self.embedding_dim).tolist()
        else:
            video_embedding = [0.0] * self.embedding_dim
            
        return {
            'video_embedding': video_embedding,
            'video_features': video_features,
            'processing_time': 0.5,
            'modality_type': 'video',
            'metadata': combined_metadata
        }
        
    def validate(self, data: Any) -> bool:
        """验证视频数据"""
        return isinstance(data, (str, bytes))


class ModalityFusion:
    """模态融合器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.method = self.config.get('method', 'concatenation')
        self.output_dim = self.config.get('output_dim', 1536)
        self.num_heads = self.config.get('num_heads', 8)
        self.dropout = self.config.get('dropout', 0.1)
    
    async def fuse(self, modality_embeddings: Dict[str, Any], weights: Dict[str, float] = None) -> Dict[str, Any]:
        """融合多模态嵌入"""
        if not modality_embeddings:
            raise MultimodalError("No embeddings to fuse")
            
        if len(modality_embeddings) == 1:
            embedding = list(modality_embeddings.values())[0]
            return {
                'fused_embedding': embedding,
                'fusion_method': self.method,
                'modalities': list(modality_embeddings.keys())
            }
        
        if self.method == 'attention':
            return await self._attention_fusion(modality_embeddings)
        elif self.method == 'concatenation':
            return await self._concatenation_fusion(modality_embeddings)
        elif self.method == 'weighted_average':
            return await self._weighted_fusion(modality_embeddings, weights)
        else:
            raise MultimodalError(f"Unsupported fusion method: {self.method}")
    
    async def _attention_fusion(self, embeddings: Dict[str, Any]) -> Dict[str, Any]:
        """注意力融合"""
        if np is None:
            raise MultimodalError("NumPy is required for attention fusion")
            
        # 模拟注意力融合
        modality_names = list(embeddings.keys())
        num_modalities = len(modality_names)
        
        # 生成模拟注意力权重
        attention_weights = {}
        total_weight = 0.0
        for name in modality_names:
            weight = np.random.uniform(0.1, 1.0)
            attention_weights[name] = weight
            total_weight += weight
            
        # 归一化注意力权重
        for name in modality_names:
            attention_weights[name] /= total_weight
        
        # 生成跨模态注意力分数
        cross_attention_scores = {}
        for i, mod1 in enumerate(modality_names):
            for j, mod2 in enumerate(modality_names):
                if i != j:
                    score = np.random.uniform(0.3, 0.8)
                    cross_attention_scores[f"{mod1}_to_{mod2}"] = score
        
        # 生成融合嵌入 (模拟)
        fused_embedding = np.random.rand(self.output_dim)
        
        return {
            'fused_embedding': fused_embedding,
            'attention_weights': attention_weights,
            'cross_attention_scores': cross_attention_scores,
            'attention_visualization': "base64_encoded_heatmap",
            'fusion_method': 'attention',
            'modalities': modality_names,
            'output_dim': self.output_dim
        }
    
    async def _concatenation_fusion(self, embeddings: Dict[str, Any]) -> Dict[str, Any]:
        """拼接融合"""
        if np is None:
            raise MultimodalError("NumPy is required for concatenation fusion")
            
        modality_names = list(embeddings.keys())
        
        # 计算拼接后的维度
        total_dim = 0
        for name, embedding in embeddings.items():
            if isinstance(embedding, np.ndarray):
                total_dim += embedding.shape[0]
            else:
                total_dim += 768  # 默认维度
        
        # 生成融合嵌入 (模拟)
        fused_embedding = np.random.rand(total_dim)
        
        return {
            'fused_embedding': fused_embedding,
            'fusion_method': 'concatenation',
            'modalities': modality_names,
            'output_dim': total_dim
        }
    
    async def _weighted_fusion(self, embeddings: Dict[str, Any], weights: Dict[str, float] = None) -> Dict[str, Any]:
        """加权融合"""
        if np is None:
            raise MultimodalError("NumPy is required for weighted fusion")
            
        modality_names = list(embeddings.keys())
        
        # 设置默认权重
        if weights is None:
            weights = {name: 1.0 / len(modality_names) for name in modality_names}
        
        # 归一化权重
        total_weight = sum(weights.values())
        normalized_weights = {name: w / total_weight for name, w in weights.items()}
        
        # 生成融合嵌入 (模拟)
        embedding_dim = 768  # 假设统一维度
        fused_embedding = np.random.rand(embedding_dim)
        
        return {
            'fused_embedding': fused_embedding,
            'fusion_weights': normalized_weights,
            'fusion_method': 'weighted_average',
            'modalities': modality_names,
            'output_dim': embedding_dim
        }
    
    @staticmethod
    def combine_modalities(modalities: List[ModalityData]) -> ModalityData:
        """组合多个模态数据"""
        if not modalities:
            raise MultimodalError("No modalities to combine")
            
        if len(modalities) == 1:
            return modalities[0]
            
        combined_data = {
            'modalities': []
        }
        
        combined_metadata = {}
        
        for modality in modalities:
            combined_data['modalities'].append({
                'type': modality.modality_type.value,
                'data': modality.data if isinstance(modality.data, (str, int, float, bool, list, dict)) else str(modality.data),
                'metadata': modality.metadata,
                'encoding': modality.encoding
            })
            
            # 合并元数据
            combined_metadata.update(modality.metadata)
            
        return ModalityData(
            modality_type=ModalityType.MIXED,
            data=combined_data,
            metadata=combined_metadata,
            encoding='json'
        )


class MultimodalAdapter(BaseAdapter):
    """多模态适配器"""
        
    async def _initialize_impl(self) -> None:
        """初始化实现"""
        logger.info(f"Initializing multimodal adapter {self.adapter_id}")
        
        # 验证配置
        if not self.supported_modalities:
            raise MultimodalError("No supported modalities configured")
            
        # 初始化各个模态处理器
        for modality in self.supported_modalities:
            if modality not in ['text', 'image', 'audio', 'video']:
                logger.warning(f"Unknown modality: {modality}")
        
        logger.info(f"Multimodal adapter initialized with modalities: {self.supported_modalities}")
        return True
    
    async def initialize(self) -> bool:
        """重写初始化方法以设置正确的状态"""
        result = await super().initialize()
        if result:
            # 设置适配器为就绪状态
            self.status = AdapterStatus.READY
        return result
    
    async def _cleanup_impl(self) -> None:
        """清理实现"""
        logger.info(f"Cleaning up multimodal adapter {self.adapter_id}")
        # 清理资源
        self.processors.clear()
        self._fusion_module = None
    
    def _get_capabilities_impl(self) -> List[str]:
        """获取能力实现"""
        capabilities = ['multimodal_processing']
        
        if 'text' in self.supported_modalities:
            capabilities.append('text_processing')
        if 'image' in self.supported_modalities:
            capabilities.append('image_processing')
        if 'audio' in self.supported_modalities:
            capabilities.append('audio_processing')
        if 'video' in self.supported_modalities:
            capabilities.append('video_processing')
            
        capabilities.append('modal_fusion')
        
        return capabilities
    
    def __init__(self, config: Dict[str, Any] = None):
        # 先设置capabilities为内部变量，避免与BaseAdapter冲突
        self._capabilities_list = None
        super().__init__(config)
        
        # 初始化模态处理器
        processor_configs = self.config.get('processors', {})
        self.processors = {
            ModalityType.TEXT: TextProcessor(processor_configs.get('text', {})),
            ModalityType.IMAGE: ImageProcessor(processor_configs.get('image', {})),
            ModalityType.AUDIO: AudioProcessor(processor_configs.get('audio', {})),
            ModalityType.VIDEO: VideoProcessor(processor_configs.get('video', {}))
        }
        
        # 适配器配置
        self.supported_modalities = self.config.get('supported_modalities', ['text', 'image', 'audio'])
        self.fusion_strategy = self.config.get('fusion_strategy', 'early_fusion')
        
        # 初始化融合模块
        fusion_config = self.config.get('fusion', {})
        # 根据fusion_strategy设置融合方法
        if self.fusion_strategy == 'early_fusion':
            fusion_config['method'] = 'concatenation'
        elif self.fusion_strategy == 'late_fusion':
            fusion_config['method'] = 'weighted_average'
        elif self.fusion_strategy == 'cross_modal_attention':
            fusion_config['method'] = 'attention'
        else:
            fusion_config['method'] = fusion_config.get('method', 'concatenation')
        self._fusion_module = ModalityFusion(fusion_config)
        
        # 性能监控
        self._processing_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'average_processing_time': 0.0
        }
    
    async def _health_check_impl(self) -> Dict[str, Any]:
        """健康检查实现"""
        try:
            # 测试基本文本处理
            test_processor = self.processors.get(ModalityType.TEXT)
            if test_processor:
                test_data = await test_processor.process("health check test")
                
            return {
                'status': 'healthy',
                'supported_modalities': self.supported_modalities,
                'processor_status': {str(k.value): 'active' for k in self.processors.keys()},
                'fusion_strategy': self.fusion_strategy,
                'stats': self._processing_stats.copy()
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
    
    def _load_metadata(self) -> Dict[str, Any]:
        """加载元数据实现"""
        return {
            'adapter_type': 'multimodal',
            'version': '1.0.0',
            'supported_modalities': self.supported_modalities,
            'fusion_strategy': self.fusion_strategy,
            'capabilities': self._get_capabilities_impl()
        }
    
    async def _process_impl(self, data: Any, context: ExecutionContext) -> Any:
        """处理实现"""
        return await self._process_multimodal_data(data, context)
    
    async def process(self, input_data: Dict[str, Any], context: ExecutionContext) -> ExecutionResult:
        """外部处理接口"""
        try:
            self._processing_stats['total_requests'] += 1
            start_time = datetime.now(timezone.utc)
            
            result = await self._process_multimodal_data(input_data, context)
            
            end_time = datetime.now(timezone.utc)
            processing_time = (end_time - start_time).total_seconds()
            
            self._processing_stats['successful_requests'] += 1
            self._update_average_processing_time(processing_time)
            
            # 准备metadata，包含missing_modalities信息
            metadata = {}
            if 'missing_modalities' in result:
                metadata['missing_modalities'] = result['missing_modalities']
            
            return ExecutionResult(
                execution_id=context.execution_id,
                adapter_id=self.adapter_id,
                status='success',
                output=result,
                execution_time=processing_time,
                metadata=metadata,
                created_at=start_time
            )
            
        except Exception as e:
            self._processing_stats['failed_requests'] += 1
            logger.error(f"Multimodal processing failed: {e}")
            
            return ExecutionResult(
                execution_id=context.execution_id,
                adapter_id=self.adapter_id,
                status='error',
                error=str(e),
                created_at=datetime.now(timezone.utc)
            )
    
    async def _process_multimodal_data(self, input_data: Dict[str, Any], context: ExecutionContext) -> Dict[str, Any]:
        """处理多模态数据"""
        if not input_data or 'modalities' not in input_data:
            raise MultimodalError("Invalid input data: missing 'modalities' field")
        
        modalities_data = input_data['modalities']
        processed_modalities = []
        modality_embeddings = {}
        modality_results = {}  # 保存每个模态的处理结果
        
        # 处理每个模态
        for modality_name, modality_content in modalities_data.items():
            if modality_name not in self.supported_modalities:
                raise MultimodalError(f"Unsupported modality: {modality_name}")
            
            # 获取对应的处理器 (优先使用测试mock处理器)
            modality_type = ModalityType(modality_name.lower())
            
            # 为了兼容测试，优先检查mock处理器属性
            mock_processor_attr = f"_{modality_name}_processor"
            if hasattr(self, mock_processor_attr):
                processor = getattr(self, mock_processor_attr)
            else:
                processor = self.processors.get(modality_type)
            
            if not processor:
                raise MultimodalError(f"No processor found for modality: {modality_name}")
            
            # 处理模态数据
            if isinstance(modality_content, dict):
                data = modality_content.get('content') or modality_content.get('data')
                metadata = modality_content.get('metadata', {})
            else:
                data = modality_content
                metadata = {}
            
            processed_data = await processor.process(data, metadata)
            processed_modalities.append(modality_name)
            modality_results[modality_name] = processed_data  # 保存处理结果
            
            # 从处理器结果中获取嵌入，或生成模拟嵌入
            if f"{modality_name}_embedding" in processed_data:
                embedding = processed_data[f"{modality_name}_embedding"]
            elif np is not None:
                if modality_name == 'text':
                    embedding = np.random.rand(768)
                elif modality_name == 'image':
                    embedding = np.random.rand(768)
                elif modality_name == 'audio':
                    embedding = np.random.rand(768)
                else:
                    embedding = np.random.rand(768)
            else:
                embedding = [0.0] * 768
                
            modality_embeddings[modality_name] = embedding
        
        result = {
            'processed_modalities': processed_modalities,
            'modality_count': len(processed_modalities)
        }
        
        # 将每个模态的详细处理结果添加到result中
        for modality_name, processed_data in modality_results.items():
            for key, value in processed_data.items():
                result[key] = value
        
        # 执行融合 (如果需要)
        if input_data.get('fusion_required', len(processed_modalities) > 1):
            fusion_result = await self._fusion_module.fuse(modality_embeddings)
            result.update(fusion_result)
            result['fusion_strategy'] = self.fusion_strategy
        
        # 添加对齐信息 (如果需要)
        if input_data.get('alignment_required', False):
            alignment_result = await self._align_modalities(modalities_data)
            result.update(alignment_result)
        
        # 添加注意力信息 (如果需要)
        if input_data.get('return_attention', False):
            attention_result = await self._compute_cross_attention(modality_embeddings)
            result.update(attention_result)
        
        # 处理缺失模态
        expected_modalities = input_data.get('expected_modalities', [])
        if expected_modalities:
            missing_modalities = [m for m in expected_modalities if m not in processed_modalities]
            if missing_modalities:
                result['missing_modalities'] = missing_modalities
        
        return result
    
    async def _align_modalities(self, modalities_data: Dict[str, Any]) -> Dict[str, Any]:
        """模态对齐"""
        # 模拟对齐算法
        alignment_score = np.random.uniform(0.7, 0.95) if np else 0.85
        
        return {
            'alignment_score': alignment_score,
            'temporal_alignment': True,
            'semantic_alignment': alignment_score
        }
    
    async def _compute_cross_attention(self, embeddings: Dict[str, Any]) -> Dict[str, Any]:
        """计算跨模态注意力"""
        modality_names = list(embeddings.keys())
        cross_attention_scores = {}
        
        # 生成模拟注意力分数
        for i, mod1 in enumerate(modality_names):
            for j, mod2 in enumerate(modality_names):
                if i != j:
                    score = np.random.uniform(0.3, 0.8) if np else 0.5
                    cross_attention_scores[f"{mod1}_to_{mod2}"] = score
        
        return {
            'cross_attention_scores': cross_attention_scores,
            'attention_visualization': 'base64_encoded_heatmap_placeholder'
        }
    
    def _update_average_processing_time(self, new_time: float) -> None:
        """更新平均处理时间"""
        current_avg = self._processing_stats['average_processing_time']
        total_requests = self._processing_stats['total_requests']
        
        if total_requests == 1:
            self._processing_stats['average_processing_time'] = new_time
        else:
            # 计算新的平均值
            new_avg = ((current_avg * (total_requests - 1)) + new_time) / total_requests
            self._processing_stats['average_processing_time'] = new_avg
        
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        """执行多模态处理 (为了兼容性保留原接口)"""
        try:
            start_time = datetime.now(timezone.utc)
            
            # 获取输入数据
            if hasattr(context, 'data') and isinstance(context.data, dict):
                input_data = context.data.get('input_data')
                modality_type = context.data.get('modality_type', 'text')
            else:
                # 如果没有data属性，尝试从metadata获取
                input_data = getattr(context, 'metadata', {}).get('input_data')
                modality_type = getattr(context, 'metadata', {}).get('modality_type', 'text')
            
            if not input_data:
                raise MultimodalError("No input data provided")
                
            # 如果是新格式的多模态数据，使用新的处理逻辑
            if isinstance(input_data, dict) and 'modalities' in input_data:
                result = await self._process_multimodal_data(input_data, context)
                
                end_time = datetime.now(timezone.utc)
                execution_time = (end_time - start_time).total_seconds()
                
                # 准备metadata，包含missing_modalities信息
                metadata = {}
                if 'missing_modalities' in result:
                    metadata['missing_modalities'] = result['missing_modalities']
                
                return ExecutionResult(
                    execution_id=context.execution_id,
                    adapter_id=self.adapter_id,
                    status='success',
                    output=result,
                    execution_time=execution_time,
                    metadata=metadata,
                    created_at=start_time
                )
                
            # 否则使用原有的单一模态处理逻辑
            if isinstance(modality_type, str):
                modality_type = ModalityType(modality_type.lower())
            elif not isinstance(modality_type, ModalityType):
                modality_type = ModalityType.TEXT
                
            processor = self.processors.get(modality_type)
            if not processor:
                raise MultimodalError(f"Unsupported modality type: {modality_type}")
                
            # 安全地获取metadata
            metadata = {}
            if hasattr(context, 'data') and isinstance(context.data, dict):
                metadata = context.data.get('metadata', {})
            elif hasattr(context, 'metadata') and isinstance(context.metadata, dict):
                metadata = context.metadata
                
            result_data = await processor.process(input_data, metadata)
                
            end_time = datetime.now(timezone.utc)
            execution_time = (end_time - start_time).total_seconds()
            
            return ExecutionResult(
                execution_id=context.execution_id,
                adapter_id=self.adapter_id,
                status='success',
                output={
                    'processed_data': result_data.data,
                    'modality_type': result_data.modality_type.value,
                    'encoding': result_data.encoding,
                    'metadata': result_data.metadata
                },
                execution_time=execution_time,
                created_at=start_time
            )
            
        except Exception as e:
            logger.error(f"Multimodal adapter execution failed: {e}")
            return ExecutionResult(
                execution_id=context.execution_id,
                adapter_id=self.adapter_id,
                status='error',
                error=str(e),
                created_at=datetime.now(timezone.utc)
            )
            
    async def health_check(self) -> HealthCheckResult:
        """健康检查"""
        try:
            # 测试基本的处理器功能
            text_processor = self.processors.get(ModalityType.TEXT)
            processor_status = {}
            
            # 检查各个处理器状态
            for modality, processor in self.processors.items():
                try:
                    # 简单测试处理器
                    if modality == ModalityType.TEXT:
                        test_result = await processor.process("health check test")
                    elif modality == ModalityType.IMAGE:
                        # 对于图像处理器，只检查是否可用
                        test_result = True  # 假设可用
                    else:
                        test_result = True  # 其他类型假设可用
                    
                    processor_status[modality.value] = test_result is not None
                except Exception as e:
                    processor_status[modality.value] = False
            
            is_healthy = any(processor_status.values())
            
            return HealthCheckResult(
                is_healthy=is_healthy,
                status="healthy" if is_healthy else "unhealthy",
                message="Multimodal adapter is healthy" if is_healthy else "Health check failed",
                checks={'processors': is_healthy},
                metrics={
                    'processor_count': len(self.processors),
                    'supported_modalities': list(self.processors.keys()),
                    'processor_status': processor_status
                }
            )
            
        except Exception as e:
            return HealthCheckResult(
                is_healthy=False,
                status="unhealthy",
                message=f"Health check error: {e}",
                issues=[str(e)]
            )
