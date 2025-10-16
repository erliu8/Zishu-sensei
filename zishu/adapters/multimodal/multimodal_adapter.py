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
    
    @abstractmethod
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> ModalityData:
        """处理模态数据"""
        pass
        
    @abstractmethod
    def validate(self, data: Any) -> bool:
        """验证数据格式"""
        pass


class TextProcessor(ModalityProcessor):
    """文本处理器"""
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> ModalityData:
        """处理文本数据"""
        if isinstance(data, bytes):
            text = data.decode('utf-8')
        elif isinstance(data, str):
            text = data
        else:
            text = str(data)
            
        return ModalityData(
            modality_type=ModalityType.TEXT,
            data=text,
            metadata=metadata or {},
            encoding='utf-8'
        )
        
    def validate(self, data: Any) -> bool:
        """验证文本数据"""
        return isinstance(data, (str, bytes))


class ImageProcessor(ModalityProcessor):
    """图像处理器"""
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> ModalityData:
        """处理图像数据"""
        if isinstance(data, str):
            # 假设是base64编码
            try:
                image_data = base64.b64decode(data)
            except Exception:
                raise MultimodalError(f"Invalid base64 image data")
        elif isinstance(data, bytes):
            image_data = data
        else:
            raise MultimodalError(f"Unsupported image data type: {type(data)}")
            
        return ModalityData(
            modality_type=ModalityType.IMAGE,
            data=image_data,
            metadata=metadata or {},
            encoding='binary'
        )
        
    def validate(self, data: Any) -> bool:
        """验证图像数据"""
        return isinstance(data, (str, bytes))


class AudioProcessor(ModalityProcessor):
    """音频处理器"""
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> ModalityData:
        """处理音频数据"""
        if isinstance(data, str):
            # 假设是base64编码
            try:
                audio_data = base64.b64decode(data)
            except Exception:
                raise MultimodalError(f"Invalid base64 audio data")
        elif isinstance(data, bytes):
            audio_data = data
        else:
            raise MultimodalError(f"Unsupported audio data type: {type(data)}")
            
        return ModalityData(
            modality_type=ModalityType.AUDIO,
            data=audio_data,
            metadata=metadata or {},
            encoding='binary'
        )
        
    def validate(self, data: Any) -> bool:
        """验证音频数据"""
        return isinstance(data, (str, bytes))


class VideoProcessor(ModalityProcessor):
    """视频处理器"""
    
    async def process(self, data: Any, metadata: Dict[str, Any] = None) -> ModalityData:
        """处理视频数据"""
        if isinstance(data, str):
            # 假设是base64编码
            try:
                video_data = base64.b64decode(data)
            except Exception:
                raise MultimodalError(f"Invalid base64 video data")
        elif isinstance(data, bytes):
            video_data = data
        else:
            raise MultimodalError(f"Unsupported video data type: {type(data)}")
            
        return ModalityData(
            modality_type=ModalityType.VIDEO,
            data=video_data,
            metadata=metadata or {},
            encoding='binary'
        )
        
    def validate(self, data: Any) -> bool:
        """验证视频数据"""
        return isinstance(data, (str, bytes))


class ModalityFusion:
    """模态融合器"""
    
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
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.processors = {
            ModalityType.TEXT: TextProcessor(),
            ModalityType.IMAGE: ImageProcessor(),
            ModalityType.AUDIO: AudioProcessor(),
            ModalityType.VIDEO: VideoProcessor()
        }
        
    async def execute(self, context: ExecutionContext) -> ExecutionResult:
        """执行多模态处理"""
        try:
            start_time = datetime.now(timezone.utc)
            
            # 获取输入数据
            input_data = context.data.get('input_data')
            modality_type = context.data.get('modality_type', 'text')
            
            if not input_data:
                raise MultimodalError("No input data provided")
                
            # 确定模态类型
            if isinstance(modality_type, str):
                modality_type = ModalityType(modality_type.lower())
            elif not isinstance(modality_type, ModalityType):
                modality_type = ModalityType.TEXT
                
            # 处理单一模态或多模态数据
            if isinstance(input_data, dict) and 'modalities' in input_data:
                # 多模态数据
                processed_modalities = []
                for mod_data in input_data['modalities']:
                    mod_type = ModalityType(mod_data['type'])
                    processor = self.processors.get(mod_type)
                    if processor:
                        processed = await processor.process(
                            mod_data['data'], 
                            mod_data.get('metadata', {})
                        )
                        processed_modalities.append(processed)
                        
                result_data = ModalityFusion.combine_modalities(processed_modalities)
            else:
                # 单一模态数据
                processor = self.processors.get(modality_type)
                if not processor:
                    raise MultimodalError(f"Unsupported modality type: {modality_type}")
                    
                result_data = await processor.process(input_data, context.data.get('metadata', {}))
                
            end_time = datetime.now(timezone.utc)
            execution_time = (end_time - start_time).total_seconds()
            
            return ExecutionResult(
                adapter_id=self.get_id(),
                success=True,
                data={
                    'processed_data': result_data.data,
                    'modality_type': result_data.modality_type.value,
                    'encoding': result_data.encoding,
                    'metadata': result_data.metadata
                },
                metadata={'execution_time': execution_time},
                started_at=start_time,
                finished_at=end_time
            )
            
        except Exception as e:
            logger.error(f"Multimodal adapter execution failed: {e}")
            return ExecutionResult(
                adapter_id=self.get_id(),
                success=False,
                error_message=str(e),
                started_at=datetime.now(timezone.utc),
                finished_at=datetime.now(timezone.utc)
            )
            
    async def health_check(self) -> HealthCheckResult:
        """健康检查"""
        try:
            # 测试基本功能
            test_context = ExecutionContext(data={'input_data': 'test', 'modality_type': 'text'})
            result = await self.execute(test_context)
            
            return HealthCheckResult(
                adapter_id=self.get_id(),
                healthy=result.success,
                message="Multimodal adapter is healthy" if result.success else "Health check failed",
                details={'processors': list(self.processors.keys())},
                checked_at=datetime.now(timezone.utc)
            )
            
        except Exception as e:
            return HealthCheckResult(
                adapter_id=self.get_id(),
                healthy=False,
                message=f"Health check error: {e}",
                checked_at=datetime.now(timezone.utc)
            )
