# -*- coding: utf-8 -*-
"""
多模态适配器模块
提供处理文本、图像、音频等多种模态数据的适配器功能
"""

from .multimodal_adapter import (
    MultimodalAdapter,
    ModalityProcessor,
    TextProcessor,
    ImageProcessor,
    AudioProcessor,
    VideoProcessor,
    ModalityFusion,
    MultimodalError
)

__all__ = [
    'MultimodalAdapter',
    'ModalityProcessor', 
    'TextProcessor',
    'ImageProcessor',
    'AudioProcessor',
    'VideoProcessor',
    'ModalityFusion',
    'MultimodalError'
]
