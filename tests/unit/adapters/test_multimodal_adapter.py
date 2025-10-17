# -*- coding: utf-8 -*-
"""
多模态适配器测试

测试处理文本、图像、音频等多种模态数据的适配器功能
"""

import pytest
import asyncio
import tempfile
import base64
import json
import io
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
import numpy as np

from zishu.adapters.multimodal.multimodal_adapter import (
    MultimodalAdapter, ModalityProcessor, TextProcessor, ImageProcessor,
    AudioProcessor, VideoProcessor, ModalityFusion, MultimodalError
)
from zishu.adapters.base import (
    AdapterStatus, AdapterCapability, ExecutionContext,
    ExecutionResult, HealthCheckResult, AdapterType
)

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestMultimodalAdapter:
    """多模态适配器测试类"""

    @pytest.fixture
    def multimodal_config(self):
        """创建多模态适配器配置"""
        return {
            "adapter_id": "test-multimodal-adapter",
            "name": "测试多模态适配器",
            "version": "1.0.0",
            "adapter_type": AdapterType.INTELLIGENT,
            "description": "测试多模态数据处理适配器",
            "supported_modalities": ["text", "image", "audio"],
            "fusion_strategy": "early_fusion",
            "processors": {
                "text": {
                    "model": "text-processor-v1",
                    "max_length": 1000,
                    "embedding_dim": 768
                },
                "image": {
                    "model": "vision-transformer-v1",
                    "input_size": [224, 224],
                    "embedding_dim": 768
                },
                "audio": {
                    "model": "audio-encoder-v1",
                    "sample_rate": 16000,
                    "embedding_dim": 768
                }
            },
            "fusion": {
                "method": "attention",
                "output_dim": 1536,
                "num_heads": 8
            }
        }

    @pytest.fixture
    def mock_text_processor(self):
        """模拟文本处理器"""
        processor = Mock()
        processor.process = AsyncMock(return_value={
            "text_embedding": np.random.rand(768),
            "text_features": {
                "length": 50,
                "sentiment": "positive",
                "language": "en"
            },
            "processing_time": 0.1
        })
        processor.is_supported = Mock(return_value=True)
        return processor

    @pytest.fixture
    def mock_image_processor(self):
        """模拟图像处理器"""
        processor = Mock()
        processor.process = AsyncMock(return_value={
            "image_embedding": np.random.rand(768),
            "image_features": {
                "width": 224,
                "height": 224,
                "objects": ["person", "car"],
                "scene": "outdoor"
            },
            "processing_time": 0.2
        })
        processor.is_supported = Mock(return_value=True)
        return processor

    @pytest.fixture
    def mock_audio_processor(self):
        """模拟音频处理器"""
        processor = Mock()
        processor.process = AsyncMock(return_value={
            "audio_embedding": np.random.rand(768),
            "audio_features": {
                "duration": 5.0,
                "sample_rate": 16000,
                "transcription": "Hello world",
                "speaker_count": 1
            },
            "processing_time": 0.3
        })
        processor.is_supported = Mock(return_value=True)
        return processor

    @pytest.fixture
    def mock_fusion_module(self):
        """模拟融合模块"""
        fusion = Mock()
        fusion.fuse = AsyncMock(return_value={
            "fused_embedding": np.random.rand(1536),
            "attention_weights": {
                "text": 0.4,
                "image": 0.4,
                "audio": 0.2
            },
            "fusion_confidence": 0.92
        })
        return fusion

    @pytest.fixture
    def multimodal_adapter(self, multimodal_config, mock_text_processor,
                          mock_image_processor, mock_audio_processor, mock_fusion_module):
        """创建多模态适配器实例"""
        adapter = MultimodalAdapter(multimodal_config)
        adapter._text_processor = mock_text_processor
        adapter._image_processor = mock_image_processor
        adapter._audio_processor = mock_audio_processor
        adapter._fusion_module = mock_fusion_module
        return adapter

    @pytest.mark.asyncio
    async def test_adapter_initialization(self, multimodal_adapter):
        """测试多模态适配器初始化"""
        # Act
        await multimodal_adapter.initialize()
        
        # Assert
        assert multimodal_adapter.status == AdapterStatus.READY
        assert AdapterCapability.MULTIMODAL_PROCESSING in multimodal_adapter.capabilities
        assert len(multimodal_adapter.supported_modalities) == 3
        assert "text" in multimodal_adapter.supported_modalities
        assert "image" in multimodal_adapter.supported_modalities
        assert "audio" in multimodal_adapter.supported_modalities

    @pytest.mark.asyncio
    async def test_single_modality_processing(self, multimodal_adapter):
        """测试单模态处理"""
        await multimodal_adapter.initialize()
        
        # Arrange - Text only
        input_data = {
            "modalities": {
                "text": {
                    "content": "This is a test sentence for processing.",
                    "metadata": {"language": "en"}
                }
            }
        }
        context = ExecutionContext(request_id="single-modal-001")
        
        # Act
        result = await multimodal_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "text_embedding" in result.data
        assert "processed_modalities" in result.data
        assert result.data["processed_modalities"] == ["text"]
        multimodal_adapter._text_processor.process.assert_called_once()

    @pytest.mark.asyncio
    async def test_multimodal_processing(self, multimodal_adapter):
        """测试多模态处理"""
        await multimodal_adapter.initialize()
        
        # Arrange - Text + Image
        input_data = {
            "modalities": {
                "text": {
                    "content": "A beautiful sunset over the mountains.",
                    "metadata": {"language": "en"}
                },
                "image": {
                    "data": create_mock_image_data(),
                    "format": "base64",
                    "metadata": {"source": "camera"}
                }
            },
            "fusion_required": True
        }
        context = ExecutionContext(request_id="multi-modal-001")
        
        # Act
        result = await multimodal_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "fused_embedding" in result.data
        assert "attention_weights" in result.data
        assert len(result.data["processed_modalities"]) == 2
        
        # Verify all processors were called
        multimodal_adapter._text_processor.process.assert_called_once()
        multimodal_adapter._image_processor.process.assert_called_once()
        multimodal_adapter._fusion_module.fuse.assert_called_once()

    @pytest.mark.asyncio
    async def test_three_modality_processing(self, multimodal_adapter):
        """测试三模态处理"""
        await multimodal_adapter.initialize()
        
        # Arrange - Text + Image + Audio
        input_data = {
            "modalities": {
                "text": {
                    "content": "Please analyze this audio and image",
                    "metadata": {"language": "en"}
                },
                "image": {
                    "data": create_mock_image_data(),
                    "format": "base64"
                },
                "audio": {
                    "data": create_mock_audio_data(),
                    "format": "wav",
                    "metadata": {"duration": 5.0}
                }
            },
            "fusion_required": True
        }
        context = ExecutionContext(request_id="three-modal-001")
        
        # Act
        result = await multimodal_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "success"
        assert "fused_embedding" in result.data
        assert len(result.data["processed_modalities"]) == 3
        
        # Check attention weights sum to 1
        attention_weights = result.data["attention_weights"]
        total_weight = sum(attention_weights.values())
        assert abs(total_weight - 1.0) < 0.01

    @pytest.mark.asyncio
    async def test_modality_validation(self, multimodal_adapter):
        """测试模态验证"""
        await multimodal_adapter.initialize()
        
        # Arrange - Invalid modality
        input_data = {
            "modalities": {
                "video": {  # Not supported
                    "data": "video_data",
                    "format": "mp4"
                }
            }
        }
        context = ExecutionContext(request_id="validation-001")
        
        # Act
        result = await multimodal_adapter.process(input_data, context)
        
        # Assert
        assert result.status == "error"
        assert "unsupported modality" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_fusion_strategies(self, multimodal_adapter):
        """测试不同的融合策略"""
        await multimodal_adapter.initialize()
        
        # Test early fusion
        multimodal_adapter.config["fusion_strategy"] = "early_fusion"
        
        input_data = {
            "modalities": {
                "text": {"content": "Early fusion test"},
                "image": {"data": create_mock_image_data(), "format": "base64"}
            },
            "fusion_required": True
        }
        context = ExecutionContext(request_id="early-fusion-001")
        
        result = await multimodal_adapter.process(input_data, context)
        
        assert result.status == "success"
        assert result.data["fusion_strategy"] == "early_fusion"
    
    @pytest.mark.asyncio
    async def test_late_fusion_strategy(self, multimodal_adapter):
        """测试后期融合策略"""
        # Configure for late fusion
        multimodal_adapter.config["fusion_strategy"] = "late_fusion"
        multimodal_adapter._fusion_module.fuse = AsyncMock(return_value={
            "fused_embedding": np.random.rand(1536),
            "individual_predictions": {
                "text": {"sentiment": "positive", "confidence": 0.9},
                "image": {"objects": ["person"], "confidence": 0.8}
            },
            "final_prediction": {"category": "positive_person", "confidence": 0.85}
        })
        
        await multimodal_adapter.initialize()
        
        input_data = {
            "modalities": {
                "text": {"content": "Happy person"},
                "image": {"data": create_mock_image_data(), "format": "base64"}
            },
            "fusion_required": True
        }
        context = ExecutionContext(request_id="late-fusion-001")
        
        result = await multimodal_adapter.process(input_data, context)
        
        assert result.status == "success"
        assert "individual_predictions" in result.data
        assert "final_prediction" in result.data

    @pytest.mark.asyncio
    async def test_cross_modal_attention(self, multimodal_adapter):
        """测试跨模态注意力机制"""
        # Configure attention-based fusion
        multimodal_adapter._fusion_module.fuse = AsyncMock(return_value={
            "fused_embedding": np.random.rand(1536),
            "cross_attention_scores": {
                "text_to_image": 0.7,
                "image_to_text": 0.6,
                "text_to_audio": 0.4,
                "audio_to_text": 0.5
            },
            "attention_visualization": "base64_encoded_heatmap"
        })
        
        await multimodal_adapter.initialize()
        
        input_data = {
            "modalities": {
                "text": {"content": "A cat is sleeping"},
                "image": {"data": create_mock_image_data(), "format": "base64"},
                "audio": {"data": create_mock_audio_data(), "format": "wav"}
            },
            "fusion_required": True,
            "return_attention": True
        }
        context = ExecutionContext(request_id="attention-001")
        
        result = await multimodal_adapter.process(input_data, context)
        
        assert result.status == "success"
        assert "cross_attention_scores" in result.data
        assert "attention_visualization" in result.data

    @pytest.mark.asyncio
    async def test_modality_alignment(self, multimodal_adapter):
        """测试模态对齐"""
        # Mock alignment functionality
        multimodal_adapter._align_modalities = AsyncMock(return_value={
            "alignment_score": 0.85,
            "temporal_alignment": True,
            "semantic_alignment": 0.9
        })
        
        await multimodal_adapter.initialize()
        
        input_data = {
            "modalities": {
                "text": {"content": "Person speaking", "timestamp": 0.0},
                "audio": {"data": create_mock_audio_data(), "timestamp": 0.0},
                "image": {"data": create_mock_image_data(), "timestamp": 0.1}
            },
            "alignment_required": True
        }
        context = ExecutionContext(request_id="alignment-001")
        
        result = await multimodal_adapter.process(input_data, context)
        
        assert result.status == "success"
        assert result.data["alignment_score"] == 0.85

    @pytest.mark.asyncio
    async def test_missing_modality_handling(self, multimodal_adapter):
        """测试缺失模态处理"""
        await multimodal_adapter.initialize()
        
        # Configure to handle missing modalities
        multimodal_adapter.config["handle_missing_modalities"] = True
        
        input_data = {
            "modalities": {
                "text": {"content": "Only text available"},
                # Image and audio are missing
            },
            "expected_modalities": ["text", "image", "audio"]
        }
        context = ExecutionContext(request_id="missing-modal-001")
        
        result = await multimodal_adapter.process(input_data, context)
        
        assert result.status == "success"
        assert "missing_modalities" in result.metadata
        assert result.metadata["missing_modalities"] == ["image", "audio"]

    @pytest.mark.asyncio
    async def test_batch_multimodal_processing(self, multimodal_adapter):
        """测试批量多模态处理"""
        await multimodal_adapter.initialize()
        
        # Arrange batch data
        batch_data = []
        for i in range(5):
            batch_data.append({
                "modalities": {
                    "text": {"content": f"Batch item {i}"},
                    "image": {"data": create_mock_image_data(), "format": "base64"}
                },
                "fusion_required": True
            })
        
        context = ExecutionContext(request_id="batch-multi-001")
        
        # Act
        results = []
        for data in batch_data:
            result = await multimodal_adapter.process(data, context)
            results.append(result)
        
        # Assert
        assert len(results) == 5
        assert all(result.status == "success" for result in results)
        assert all("fused_embedding" in result.data for result in results)

    @pytest.mark.asyncio
    async def test_health_check(self, multimodal_adapter):
        """测试健康检查"""
        await multimodal_adapter.initialize()
        
        # Act
        health = await multimodal_adapter.health_check()
        
        # Assert
        assert isinstance(health, HealthCheckResult)
        assert health.is_healthy is True
        assert "supported_modalities" in health.metrics
        assert "processor_status" in health.metrics


class TestModalityProcessors:
    """模态处理器测试类"""
    
    @pytest.mark.asyncio
    async def test_text_processor(self):
        """测试文本处理器"""
        config = {
            "model": "bert-base-uncased",
            "max_length": 512,
            "embedding_dim": 768
        }
        processor = TextProcessor(config)
        
        # Act
        result = await processor.process({
            "content": "This is a test sentence.",
            "metadata": {"language": "en"}
        })
        
        # Assert
        assert "text_embedding" in result
        assert "text_features" in result
        assert result["text_features"]["length"] > 0
    
    @pytest.mark.asyncio
    async def test_image_processor(self):
        """测试图像处理器"""
        config = {
            "model": "resnet50",
            "input_size": [224, 224],
            "embedding_dim": 2048
        }
        processor = ImageProcessor(config)
        
        # Mock image processing
        with patch.object(processor, '_extract_features', 
                         return_value={"objects": ["cat"], "scene": "indoor"}):
            result = await processor.process({
                "data": create_mock_image_data(),
                "format": "base64"
            })
        
        # Assert
        assert "image_embedding" in result
        assert "image_features" in result
        assert "objects" in result["image_features"]
    
    @pytest.mark.asyncio
    async def test_audio_processor(self):
        """测试音频处理器"""
        config = {
            "model": "wav2vec2",
            "sample_rate": 16000,
            "embedding_dim": 768
        }
        processor = AudioProcessor(config)
        
        # Mock audio processing
        with patch.object(processor, '_extract_features',
                         return_value={"transcription": "hello", "speaker_count": 1}):
            result = await processor.process({
                "data": create_mock_audio_data(),
                "format": "wav"
            })
        
        # Assert
        assert "audio_embedding" in result
        assert "audio_features" in result
        assert "transcription" in result["audio_features"]


class TestModalityFusion:
    """模态融合测试类"""
    
    @pytest.fixture
    def fusion_config(self):
        """创建融合配置"""
        return {
            "method": "attention",
            "output_dim": 1536,
            "num_heads": 8,
            "dropout": 0.1
        }
    
    @pytest.fixture
    def fusion_module(self, fusion_config):
        """创建融合模块"""
        return ModalityFusion(fusion_config)
    
    @pytest.mark.asyncio
    async def test_attention_fusion(self, fusion_module):
        """测试注意力融合"""
        # Arrange
        modality_embeddings = {
            "text": np.random.rand(768),
            "image": np.random.rand(768),
            "audio": np.random.rand(768)
        }
        
        # Act
        result = await fusion_module.fuse(modality_embeddings)
        
        # Assert
        assert "fused_embedding" in result
        assert result["fused_embedding"].shape[0] == 1536
        assert "attention_weights" in result
        assert len(result["attention_weights"]) == 3
    
    @pytest.mark.asyncio
    async def test_concatenation_fusion(self, fusion_config):
        """测试拼接融合"""
        fusion_config["method"] = "concatenation"
        fusion_module = ModalityFusion(fusion_config)
        
        modality_embeddings = {
            "text": np.random.rand(768),
            "image": np.random.rand(768)
        }
        
        result = await fusion_module.fuse(modality_embeddings)
        
        assert "fused_embedding" in result
        # Concatenation should result in sum of input dimensions
        expected_dim = 768 + 768
        assert result["fused_embedding"].shape[0] == expected_dim
    
    @pytest.mark.asyncio
    async def test_weighted_fusion(self, fusion_config):
        """测试加权融合"""
        fusion_config["method"] = "weighted_average"
        fusion_module = ModalityFusion(fusion_config)
        
        modality_embeddings = {
            "text": np.random.rand(768),
            "image": np.random.rand(768),
            "audio": np.random.rand(768)
        }
        weights = {"text": 0.5, "image": 0.3, "audio": 0.2}
        
        result = await fusion_module.fuse(modality_embeddings, weights=weights)
        
        assert "fused_embedding" in result
        assert result["fused_embedding"].shape[0] == 768  # Same as input dim
        assert "fusion_weights" in result


# Helper functions
def create_mock_image_data():
    """创建模拟图像数据"""
    # Create a small image (RGB, 32x32)
    image_array = np.random.randint(0, 255, (32, 32, 3), dtype=np.uint8)
    # Convert to base64 string (simplified)
    return base64.b64encode(image_array.tobytes()).decode('utf-8')


def create_mock_audio_data():
    """创建模拟音频数据"""
    # Create mock audio samples
    duration_seconds = 1.0
    sample_rate = 16000
    samples = np.random.randn(int(duration_seconds * sample_rate))
    # Convert to base64 string (simplified)
    return base64.b64encode(samples.tobytes()).decode('utf-8')


@pytest.mark.performance
class TestMultimodalPerformance(TestMultimodalAdapter):
    """多模态性能测试"""
    
    @pytest.mark.asyncio
    async def test_multimodal_processing_performance(self, multimodal_adapter):
        """测试多模态处理性能"""
        await multimodal_adapter.initialize()
        
        # Prepare test data
        input_data = {
            "modalities": {
                "text": {"content": "Performance test content"},
                "image": {"data": create_mock_image_data(), "format": "base64"}
            },
            "fusion_required": True
        }
        context = ExecutionContext(request_id="perf-001")
        
        # Measure processing time
        start_time = asyncio.get_event_loop().time()
        
        for i in range(10):
            await multimodal_adapter.process(input_data, context)
        
        end_time = asyncio.get_event_loop().time()
        total_time = end_time - start_time
        
        # Assert performance requirements
        assert total_time < 5.0  # 10 multimodal processes in less than 5 seconds
        avg_time = total_time / 10
        assert avg_time < 0.5  # Average processing time less than 500ms
    
    @pytest.mark.asyncio
    async def test_concurrent_multimodal_processing(self, multimodal_adapter):
        """测试并发多模态处理"""
        await multimodal_adapter.initialize()
        
        # Create concurrent tasks
        tasks = []
        for i in range(5):
            input_data = {
                "modalities": {
                    "text": {"content": f"Concurrent test {i}"},
                    "image": {"data": create_mock_image_data(), "format": "base64"}
                },
                "fusion_required": True
            }
            context = ExecutionContext(request_id=f"concurrent-{i}")
            task = multimodal_adapter.process(input_data, context)
            tasks.append(task)
        
        # Measure concurrent execution
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = asyncio.get_event_loop().time()
        
        total_time = end_time - start_time
        
        # Assert
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) >= 4  # Allow one failure
        assert total_time < 2.0  # Concurrent processing should be faster
