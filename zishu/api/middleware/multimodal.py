"""
多模态处理中间件
支持音频、图像、动画等多模态输入输出处理
集成情绪系统和角色配置，提供全面的多模态体验
"""

import asyncio
import base64
import hashlib
import json
import logging
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, Tuple, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum

# 核心依赖
from fastapi import HTTPException, Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field, field_validator

# 可选依赖
try:
    import aiofiles
    AIOFILES_AVAILABLE = True
except ImportError:
    AIOFILES_AVAILABLE = False
    
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

try:
    import PIL
    from PIL import Image, ImageFilter, ImageEnhance
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

# 设置日志
logger = logging.getLogger(__name__)

class MediaType(str, Enum):
    """媒体类型枚举"""
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"
    TEXT = "text"
    ANIMATION = "animation"

class ProcessingStatus(str, Enum):
    """处理状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CACHED = "cached"

class EmotionState(str, Enum):
    """情绪状态枚举"""
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    SURPRISED = "surprised"
    NEUTRAL = "neutral"
    EXCITED = "excited"
    CONFUSED = "confused"

@dataclass
class MediaFile:
    """媒体文件数据类"""
    content: bytes
    filename: str
    content_type: str
    size: int
    media_type: MediaType
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class ProcessingResult:
    """处理结果数据类"""
    success: bool
    data: Any = None
    error: Optional[str] = None
    processing_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class CharacterConfig:
    """角色配置数据类"""
    character_id: str
    name: str
    voice_settings: Dict[str, Any] = field(default_factory=dict)
    emotion_mapping: Dict[str, str] = field(default_factory=dict)
    animation_settings: Dict[str, Any] = field(default_factory=dict)
    personality_traits: List[str] = field(default_factory=list)

class MultimodalConfig(BaseModel):
    """多模态配置模型"""
    
    # 音频配置
    audio_enabled: bool = True
    supported_audio_formats: List[str] = ["wav", "mp3", "flac", "ogg"]
    max_audio_duration: float = 300.0  # 5分钟
    max_audio_size: int = 52428800  # 50MB
    
    # 图像配置
    image_enabled: bool = True
    supported_image_formats: List[str] = ["jpeg", "png", "webp", "gif"]
    max_image_width: int = 2048
    max_image_height: int = 2048
    max_image_size: int = 10485760  # 10MB
    
    # 动画配置
    animation_enabled: bool = True
    animation_fps: int = 30
    max_animation_duration: float = 30.0
    
    # 缓存配置
    cache_enabled: bool = True
    cache_ttl: int = 3600  # 1小时
    max_cache_size: int = 1000
    
    # 异步处理配置
    async_processing: bool = True
    max_concurrent_tasks: int = 5
    task_timeout: float = 60.0
    
    # 错误处理配置
    retry_attempts: int = 3
    retry_delay: float = 1.0
    
    # API配置
    openai_api_key: Optional[str] = None
    azure_api_key: Optional[str] = None
    baidu_api_key: Optional[str] = None

class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path
        self.config = MultimodalConfig()
        self._load_config()
    
    def _load_config(self):
        """加载配置"""
        if not self.config_path:
            return
            
        config_file = Path(self.config_path)
        if not config_file.exists():
            logger.warning(f"配置文件不存在: {self.config_path}")
            return
        
        try:
            if YAML_AVAILABLE and config_file.suffix in ['.yaml', '.yml']:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config_data = yaml.safe_load(f)
            else:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
            
            # 更新配置
            if 'multimodal' in config_data:
                config_data = config_data['multimodal']
            
            for key, value in config_data.items():
                if hasattr(self.config, key):
                    setattr(self.config, key, value)
                    
        except Exception as e:
            logger.error(f"加载配置文件失败: {e}")

class CacheManager:
    """缓存管理器"""
    
    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        self.max_size = max_size
        self.ttl = ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._access_times: Dict[str, float] = {}
    
    def _generate_key(self, data: bytes, metadata: Dict[str, Any] = None) -> str:
        """生成缓存键"""
        hasher = hashlib.md5()
        hasher.update(data)
        if metadata:
            hasher.update(json.dumps(metadata, sort_keys=True).encode())
        return hasher.hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存项"""
        if key not in self._cache:
            return None
        
        # 检查是否过期
        cache_item = self._cache[key]
        if time.time() - cache_item['timestamp'] > self.ttl:
            self.remove(key)
            return None
        
        # 更新访问时间
        self._access_times[key] = time.time()
        return cache_item['data']
    
    def set(self, key: str, data: Any) -> None:
        """设置缓存项"""
        # 检查缓存大小限制
        if len(self._cache) >= self.max_size:
            self._evict_oldest()
        
        self._cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
        self._access_times[key] = time.time()
    
    def remove(self, key: str) -> None:
        """移除缓存项"""
        self._cache.pop(key, None)
        self._access_times.pop(key, None)
    
    def _evict_oldest(self) -> None:
        """淘汰最旧的缓存项"""
        if not self._access_times:
            return
        
        oldest_key = min(self._access_times.keys(), key=lambda k: self._access_times[k])
        self.remove(oldest_key)
    
    def clear(self) -> None:
        """清空缓存"""
        self._cache.clear()
        self._access_times.clear()

class AudioProcessor:
    """音频处理器"""
    
    def __init__(self, config: MultimodalConfig):
        self.config = config
        self.whisper_model = None
        self._init_models()
    
    def _init_models(self):
        """初始化模型"""
        if WHISPER_AVAILABLE and self.config.audio_enabled:
            try:
                self.whisper_model = whisper.load_model("base")
                logger.info("Whisper模型加载成功")
            except Exception as e:
                logger.error(f"Whisper模型加载失败: {e}")
    
    async def process_audio(self, audio_file: MediaFile) -> ProcessingResult:
        """处理音频文件"""
        start_time = time.time()
        
        try:
            # 验证音频文件
            if not self._validate_audio(audio_file):
                return ProcessingResult(
                    success=False,
                    error="音频文件验证失败"
                )
            
            # 语音识别
            transcript = await self._speech_to_text(audio_file)
            
            # 情绪分析
            emotion = await self._analyze_audio_emotion(audio_file)
            
            processing_time = time.time() - start_time
            
            return ProcessingResult(
                success=True,
                data={
                    'transcript': transcript,
                    'emotion': emotion,
                    'duration': audio_file.metadata.get('duration', 0),
                    'sample_rate': audio_file.metadata.get('sample_rate', 0)
                },
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"音频处理失败: {e}")
            return ProcessingResult(
                success=False,
                error=str(e),
                processing_time=time.time() - start_time
            )
    
    def _validate_audio(self, audio_file: MediaFile) -> bool:
        """验证音频文件"""
        # 检查文件大小
        if audio_file.size > self.config.max_audio_size:
            logger.error(f"音频文件过大: {audio_file.size} > {self.config.max_audio_size}")
            return False
        
        # 检查文件格式
        file_ext = Path(audio_file.filename).suffix.lower().lstrip('.')
        if file_ext not in self.config.supported_audio_formats:
            logger.error(f"不支持的音频格式: {file_ext}")
            return False
        
        return True
    
    async def _speech_to_text(self, audio_file: MediaFile) -> str:
        """语音转文字"""
        if not self.whisper_model:
            return ""
        
        try:
            # 将音频数据保存到临时文件
            temp_path = f"/tmp/audio_{int(time.time())}.wav"
            with open(temp_path, 'wb') as f:
                f.write(audio_file.content)
            
            # 使用Whisper进行识别
            result = self.whisper_model.transcribe(temp_path)
            
            # 清理临时文件
            Path(temp_path).unlink(missing_ok=True)
            
            return result.get('text', '')
            
        except Exception as e:
            logger.error(f"语音识别失败: {e}")
            return ""
    
    async def _analyze_audio_emotion(self, audio_file: MediaFile) -> str:
        """分析音频情绪"""
        # 这里可以集成音频情绪识别模型
        # 目前返回中性情绪
        return EmotionState.NEUTRAL.value
    
    async def text_to_speech(self, text: str, voice_settings: Dict[str, Any] = None) -> Optional[bytes]:
        """文本转语音"""
        if not EDGE_TTS_AVAILABLE:
            logger.warning("edge-tts不可用，无法进行文本转语音")
            return None
        
        try:
            voice = voice_settings.get('voice', 'zh-CN-XiaoxiaoNeural') if voice_settings else 'zh-CN-XiaoxiaoNeural'
            rate = voice_settings.get('rate', '+0%') if voice_settings else '+0%'
            
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            audio_data = b""
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            
            return audio_data
            
        except Exception as e:
            logger.error(f"文本转语音失败: {e}")
            return None

class ImageProcessor:
    """图像处理器"""
    
    def __init__(self, config: MultimodalConfig):
        self.config = config
    
    async def process_image(self, image_file: MediaFile) -> ProcessingResult:
        """处理图像文件"""
        start_time = time.time()
        
        try:
            # 验证图像文件
            if not self._validate_image(image_file):
                return ProcessingResult(
                    success=False,
                    error="图像文件验证失败"
                )
            
            # 图像分析
            analysis = await self._analyze_image(image_file)
            
            # 情绪识别
            emotion = await self._detect_emotion(image_file)
            
            # 图像增强
            enhanced_image = await self._enhance_image(image_file)
            
            processing_time = time.time() - start_time
            
            return ProcessingResult(
                success=True,
                data={
                    'analysis': analysis,
                    'emotion': emotion,
                    'enhanced_image': enhanced_image,
                    'dimensions': image_file.metadata.get('dimensions', (0, 0))
                },
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"图像处理失败: {e}")
            return ProcessingResult(
                success=False,
                error=str(e),
                processing_time=time.time() - start_time
            )
    
    def _validate_image(self, image_file: MediaFile) -> bool:
        """验证图像文件"""
        # 检查文件大小
        if image_file.size > self.config.max_image_size:
            logger.error(f"图像文件过大: {image_file.size} > {self.config.max_image_size}")
            return False
        
        # 检查文件格式
        file_ext = Path(image_file.filename).suffix.lower().lstrip('.')
        if file_ext not in self.config.supported_image_formats:
            logger.error(f"不支持的图像格式: {file_ext}")
            return False
        
        return True
    
    async def _analyze_image(self, image_file: MediaFile) -> Dict[str, Any]:
        """分析图像内容"""
        if not PIL_AVAILABLE:
            return {'description': '图像分析不可用'}
        
        try:
            # 使用PIL分析图像基本信息
            image = Image.open(BytesIO(image_file.content))
            
            analysis = {
                'format': image.format,
                'mode': image.mode,
                'size': image.size,
                'has_transparency': image.mode in ('RGBA', 'LA') or 'transparency' in image.info,
                'description': '这是一张图像'  # 可以集成图像描述AI模型
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"图像分析失败: {e}")
            return {'description': '图像分析失败'}
    
    async def _detect_emotion(self, image_file: MediaFile) -> str:
        """检测图像中的情绪"""
        # 这里可以集成人脸情绪识别模型
        # 目前返回中性情绪
        return EmotionState.NEUTRAL.value
    
    async def _enhance_image(self, image_file: MediaFile) -> Optional[str]:
        """图像增强"""
        if not PIL_AVAILABLE:
            return None
        
        try:
            image = Image.open(BytesIO(image_file.content))
            
            # 简单的图像增强：调整对比度和锐度
            enhancer = ImageEnhance.Contrast(image)
            enhanced = enhancer.enhance(1.1)
            
            enhancer = ImageEnhance.Sharpness(enhanced)
            enhanced = enhancer.enhance(1.1)
            
            # 转换为base64
            buffer = BytesIO()
            enhanced.save(buffer, format='PNG')
            enhanced_data = base64.b64encode(buffer.getvalue()).decode()
            
            return f"data:image/png;base64,{enhanced_data}"
            
        except Exception as e:
            logger.error(f"图像增强失败: {e}")
            return None

class AnimationGenerator:
    """动画生成器"""
    
    def __init__(self, config: MultimodalConfig):
        self.config = config
    
    async def generate_animation(self, character_config: CharacterConfig, 
                               emotion: str, text: str = "") -> ProcessingResult:
        """生成角色动画"""
        start_time = time.time()
        
        try:
            # 生成动画数据
            animation_data = await self._create_animation(character_config, emotion, text)
            
            processing_time = time.time() - start_time
            
            return ProcessingResult(
                success=True,
                data={
                    'animation_data': animation_data,
                    'duration': self.config.max_animation_duration,
                    'fps': self.config.animation_fps,
                    'character_id': character_config.character_id
                },
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"动画生成失败: {e}")
            return ProcessingResult(
                success=False,
                error=str(e),
                processing_time=time.time() - start_time
            )
    
    async def _create_animation(self, character_config: CharacterConfig, 
                              emotion: str, text: str) -> Dict[str, Any]:
        """创建动画数据"""
        # 这里可以集成实际的动画生成系统
        # 目前返回模拟数据
        
        animation_data = {
            'character_id': character_config.character_id,
            'emotion': emotion,
            'text': text,
            'keyframes': [
                {'time': 0.0, 'expression': emotion, 'pose': 'neutral'},
                {'time': 1.0, 'expression': emotion, 'pose': 'speaking'},
                {'time': 2.0, 'expression': emotion, 'pose': 'neutral'}
            ],
            'audio_sync': text != "",
            'lip_sync_data': self._generate_lip_sync(text) if text else None
        }
        
        return animation_data
    
    def _generate_lip_sync(self, text: str) -> List[Dict[str, Any]]:
        """生成唇同步数据"""
        # 简单的唇同步数据生成
        words = text.split()
        lip_sync = []
        
        time_per_word = 0.5  # 每个词0.5秒
        
        for i, word in enumerate(words):
            lip_sync.append({
                'word': word,
                'start_time': i * time_per_word,
                'end_time': (i + 1) * time_per_word,
                'mouth_shape': 'open' if len(word) > 3 else 'closed'
            })
        
        return lip_sync

class MultimodalProcessor:
    """多模态处理器主类"""
    
    def __init__(self, config: MultimodalConfig = None):
        self.config = config or MultimodalConfig()
        self.cache = CacheManager(
            max_size=self.config.max_cache_size,
            ttl=self.config.cache_ttl
        ) if self.config.cache_enabled else None
        
        # 初始化处理器
        self.audio_processor = AudioProcessor(self.config)
        self.image_processor = ImageProcessor(self.config)
        self.animation_generator = AnimationGenerator(self.config)
        
        # 线程池
        self.executor = ThreadPoolExecutor(max_workers=self.config.max_concurrent_tasks)
        
        logger.info("多模态处理器初始化完成")
    
    async def process_media(self, media_file: MediaFile, 
                          character_config: Optional[CharacterConfig] = None) -> ProcessingResult:
        """处理媒体文件"""
        
        # 检查缓存
        if self.cache:
            cache_key = self.cache._generate_key(
                media_file.content, 
                {'type': media_file.media_type, 'filename': media_file.filename}
            )
            cached_result = self.cache.get(cache_key)
            if cached_result:
                logger.info(f"使用缓存结果: {cache_key}")
                cached_result.metadata['from_cache'] = True
                return cached_result
        
        # 根据媒体类型选择处理器
        if media_file.media_type == MediaType.AUDIO:
            result = await self.audio_processor.process_audio(media_file)
        elif media_file.media_type == MediaType.IMAGE:
            result = await self.image_processor.process_image(media_file)
        else:
            result = ProcessingResult(
                success=False,
                error=f"不支持的媒体类型: {media_file.media_type}"
            )
        
        # 缓存结果
        if self.cache and result.success:
            self.cache.set(cache_key, result)
        
        return result
    
    async def generate_response(self, input_data: Dict[str, Any], 
                              character_config: Optional[CharacterConfig] = None) -> Dict[str, Any]:
        """生成多模态响应"""
        
        response = {
            'text': input_data.get('text', ''),
            'audio': None,
            'animation': None,
            'emotion': EmotionState.NEUTRAL.value,
            'processing_info': {}
        }
        
        try:
            # 情绪检测
            emotion = input_data.get('emotion', EmotionState.NEUTRAL.value)
            response['emotion'] = emotion
            
            # 生成语音
            if self.config.audio_enabled and response['text']:
                voice_settings = character_config.voice_settings if character_config else {}
                audio_data = await self.audio_processor.text_to_speech(
                    response['text'], voice_settings
                )
                if audio_data:
                    response['audio'] = base64.b64encode(audio_data).decode()
            
            # 生成动画
            if self.config.animation_enabled and character_config:
                animation_result = await self.animation_generator.generate_animation(
                    character_config, emotion, response['text']
                )
                if animation_result.success:
                    response['animation'] = animation_result.data
            
            response['processing_info'] = {
                'timestamp': datetime.now().isoformat(),
                'character_id': character_config.character_id if character_config else None,
                'capabilities': {
                    'audio': self.config.audio_enabled,
                    'image': self.config.image_enabled,
                    'animation': self.config.animation_enabled
                }
            }
            
        except Exception as e:
            logger.error(f"响应生成失败: {e}")
            response['error'] = str(e)
        
        return response
    
    def get_health_status(self) -> Dict[str, Any]:
        """获取健康状态"""
        return {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'config': {
                'audio_enabled': self.config.audio_enabled,
                'image_enabled': self.config.image_enabled,
                'animation_enabled': self.config.animation_enabled,
                'cache_enabled': self.config.cache_enabled
            },
            'dependencies': {
                'aiofiles': AIOFILES_AVAILABLE,
                'httpx': HTTPX_AVAILABLE,
                'PIL': PIL_AVAILABLE,
                'opencv': OPENCV_AVAILABLE,
                'whisper': WHISPER_AVAILABLE,
                'edge_tts': EDGE_TTS_AVAILABLE,
                'yaml': YAML_AVAILABLE
            },
            'cache_stats': {
                'size': len(self.cache._cache) if self.cache else 0,
                'max_size': self.config.max_cache_size
            } if self.cache else None
        }
    
    async def cleanup(self):
        """清理资源"""
        if self.cache:
            self.cache.clear()
        
        if self.executor:
            self.executor.shutdown(wait=True)
        
        logger.info("多模态处理器资源清理完成")

class MultimodalMiddleware(BaseHTTPMiddleware):
    """多模态中间件"""
    
    def __init__(self, app, config_path: Optional[str] = None):
        super().__init__(app)
        
        # 初始化配置
        self.config_manager = ConfigManager(config_path)
        self.processor = MultimodalProcessor(self.config_manager.config)
        
        logger.info("多模态中间件初始化完成")
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """处理请求"""
        start_time = time.time()
        
        try:
            # 检查是否为多模态请求
            if self._is_multimodal_request(request):
                # 预处理多模态数据
                await self._preprocess_multimodal_data(request)
            
            # 继续处理请求
            response = await call_next(request)
            
            # 后处理响应
            if self._should_enhance_response(request, response):
                response = await self._enhance_response(request, response)
            
            # 添加处理时间头
            processing_time = time.time() - start_time
            response.headers["X-Multimodal-Processing-Time"] = str(processing_time)
            
            return response
            
        except Exception as e:
            logger.error(f"多模态中间件处理失败: {e}")
            return await self._create_error_response(e, time.time() - start_time)
    
    def _is_multimodal_request(self, request: Request) -> bool:
        """检查是否为多模态请求"""
        content_type = request.headers.get("content-type", "")
        return (
            content_type.startswith("multipart/form-data") or
            "/multimodal" in str(request.url) or
            "X-Multimodal-Request" in request.headers
        )
    
    async def _preprocess_multimodal_data(self, request: Request):
        """预处理多模态数据"""
        # 这里可以添加请求预处理逻辑
        # 比如验证文件格式、大小等
        pass
    
    def _should_enhance_response(self, request: Request, response: Response) -> bool:
        """检查是否需要增强响应"""
        return (
            response.status_code == 200 and
            "application/json" in response.headers.get("content-type", "")
        )
    
    async def _enhance_response(self, request: Request, response: Response) -> Response:
        """增强响应"""
        # 这里可以添加响应增强逻辑
        # 比如添加多模态元数据等
        return response
    
    async def _create_error_response(self, error: Exception, processing_time: float) -> Response:
        """创建错误响应"""
        if isinstance(error, HTTPException):
            status_code = error.status_code
            error_message = error.detail
        else:
            status_code = 500
            error_message = str(error)
        
        error_data = {
            "success": False,
            "message": f"多模态处理失败: {error_message}",
            "error_code": status_code,
            "processing_time": processing_time,
            "timestamp": datetime.now().isoformat()
        }
        
        return Response(
            content=json.dumps(error_data, ensure_ascii=False),
            status_code=status_code,
            headers={"content-type": "application/json; charset=utf-8"}
        )

def get_character_config_from_request(character_id: Optional[str] = None) -> Optional[CharacterConfig]:
    """从请求中获取角色配置"""
    if not character_id:
        return None
    
    # 这里可以从数据库或配置文件中加载角色配置
    # 目前返回默认配置
    return CharacterConfig(
        character_id=character_id,
        name=f"Character_{character_id}",
        voice_settings={
            'voice': 'zh-CN-XiaoxiaoNeural',
            'rate': '+0%',
            'pitch': '+0%'
        },
        emotion_mapping={
            'happy': 'smile',
            'sad': 'frown',
            'neutral': 'normal'
        },
        animation_settings={
            'style': 'anime',
            'quality': 'medium'
        },
        personality_traits=['friendly', 'helpful']
    )

# 全局处理器实例
_global_processor: Optional[MultimodalProcessor] = None

def get_multimodal_processor() -> MultimodalProcessor:
    """获取全局多模态处理器实例"""
    global _global_processor
    if _global_processor is None:
        _global_processor = MultimodalProcessor()
    return _global_processor

async def process_multimodal_input(
    media_files: List[MediaFile],
    character_id: Optional[str] = None
) -> List[ProcessingResult]:
    """处理多模态输入的便捷函数"""
    processor = get_multimodal_processor()
    character_config = get_character_config_from_request(character_id)
    
    results = []
    for media_file in media_files:
        result = await processor.process_media(media_file, character_config)
        results.append(result)
    
    return results

async def generate_multimodal_response(
    input_data: Dict[str, Any],
    character_id: Optional[str] = None
) -> Dict[str, Any]:
    """生成多模态响应的便捷函数"""
    processor = get_multimodal_processor()
    character_config = get_character_config_from_request(character_id)
    
    return await processor.generate_response(input_data, character_config)

# 健康检查端点
def get_multimodal_health() -> Dict[str, Any]:
    """获取多模态系统健康状态"""
    processor = get_multimodal_processor()
    return processor.get_health_status()
