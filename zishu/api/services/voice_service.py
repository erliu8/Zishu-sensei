"""
语音服务
提供 STT（语音转文本）和 TTS（文本转语音）功能
"""
import asyncio
import io
import logging
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Optional, Dict, Any

logger = logging.getLogger(__name__)

# 尝试导入 Whisper（STT）
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logger.warning("Whisper 不可用，STT 功能将受限")

# 尝试导入 Edge TTS
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    logger.warning("Edge TTS 不可用，TTS 功能将受限")


class STTService:
    """语音转文本服务"""
    
    def __init__(self, model_name: str = "base", language: str = "zh"):
        self.model_name = model_name
        self.language = language
        self.model = None
        
    async def initialize(self):
        """初始化 Whisper 模型"""
        if not WHISPER_AVAILABLE:
            raise RuntimeError("Whisper 不可用，请安装: pip install openai-whisper")
        
        try:
            # 在线程池中加载模型（避免阻塞）
            loop = asyncio.get_event_loop()
            self.model = await loop.run_in_executor(
                None,
                whisper.load_model,
                self.model_name
            )
            logger.info(f"Whisper 模型加载成功: {self.model_name}")
        except Exception as e:
            logger.error(f"加载 Whisper 模型失败: {e}")
            raise
    
    async def transcribe(
        self,
        audio_data: bytes,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        转录音频
        
        Args:
            audio_data: 音频数据（支持多种格式）
            language: 语言代码（如 'zh', 'en'）
            
        Returns:
            包含文本和其他信息的字典
        """
        if not self.model:
            await self.initialize()
        
        lang = language or self.language
        
        try:
            # 将音频数据保存到临时文件
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name
            
            try:
                # 在线程池中执行转录（避免阻塞）
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    lambda: self.model.transcribe(
                        tmp_path,
                        language=lang,
                        fp16=False
                    )
                )
                
                return {
                    "text": result["text"].strip(),
                    "language": result.get("language"),
                    "segments": result.get("segments", [])
                }
            finally:
                # 清理临时文件
                Path(tmp_path).unlink(missing_ok=True)
                
        except Exception as e:
            logger.error(f"转录失败: {e}", exc_info=True)
            raise
    
    async def transcribe_stream(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        language: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式转录音频
        
        Args:
            audio_stream: 音频数据流
            language: 语言代码
            
        Yields:
            转录结果字典
        """
        buffer = bytearray()
        chunk_size = 16000 * 2 * 3  # 3秒的音频数据（假设 16kHz, 16-bit）
        
        async for chunk in audio_stream:
            buffer.extend(chunk)
            
            # 当缓冲区达到一定大小时进行转录
            if len(buffer) >= chunk_size:
                audio_data = bytes(buffer[:chunk_size])
                buffer = buffer[chunk_size:]
                
                try:
                    result = await self.transcribe(audio_data, language)
                    if result["text"]:
                        yield result
                except Exception as e:
                    logger.error(f"流式转录失败: {e}")
        
        # 处理剩余的音频数据
        if buffer:
            try:
                result = await self.transcribe(bytes(buffer), language)
                if result["text"]:
                    yield result
            except Exception as e:
                logger.error(f"处理剩余音频失败: {e}")


class TTSService:
    """文本转语音服务"""
    
    def __init__(
        self,
        voice: str = "zh-CN-XiaoxiaoNeural",
        rate: str = "+0%",
        volume: str = "+0%",
        pitch: str = "+0Hz"
    ):
        self.voice = voice
        self.rate = rate
        self.volume = volume
        self.pitch = pitch
    
    async def synthesize(
        self,
        text: str,
        output_format: str = "audio-24khz-48kbitrate-mono-mp3"
    ) -> bytes:
        """
        合成语音
        
        Args:
            text: 要合成的文本
            output_format: 输出音频格式
            
        Returns:
            音频数据
        """
        if not EDGE_TTS_AVAILABLE:
            raise RuntimeError("Edge TTS 不可用，请安装: pip install edge-tts")
        
        try:
            communicate = edge_tts.Communicate(
                text,
                self.voice,
                rate=self.rate,
                volume=self.volume,
                pitch=self.pitch
            )
            
            # 收集所有音频块
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])
            
            return bytes(audio_data)
            
        except Exception as e:
            logger.error(f"语音合成失败: {e}", exc_info=True)
            raise
    
    async def synthesize_stream(
        self,
        text: str,
        output_format: str = "audio-24khz-48kbitrate-mono-mp3"
    ) -> AsyncGenerator[bytes, None]:
        """
        流式合成语音
        
        Args:
            text: 要合成的文本
            output_format: 输出音频格式
            
        Yields:
            音频数据块
        """
        if not EDGE_TTS_AVAILABLE:
            raise RuntimeError("Edge TTS 不可用，请安装: pip install edge-tts")
        
        try:
            communicate = edge_tts.Communicate(
                text,
                self.voice,
                rate=self.rate,
                volume=self.volume,
                pitch=self.pitch
            )
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
                    
        except Exception as e:
            logger.error(f"流式语音合成失败: {e}", exc_info=True)
            raise


# 全局服务实例
_stt_service: Optional[STTService] = None
_tts_service: Optional[TTSService] = None


async def get_stt_service(config: Optional[Dict[str, Any]] = None) -> STTService:
    """获取 STT 服务实例"""
    global _stt_service
    
    if _stt_service is None:
        model_name = "base"
        language = "zh"
        
        if config:
            model_name = config.get("model", "base")
            language = config.get("language", "zh")
        
        _stt_service = STTService(model_name=model_name, language=language)
        await _stt_service.initialize()
    
    return _stt_service


async def get_tts_service(config: Optional[Dict[str, Any]] = None) -> TTSService:
    """获取 TTS 服务实例"""
    global _tts_service
    
    if _tts_service is None:
        voice = "zh-CN-XiaoxiaoNeural"
        rate = "+0%"
        volume = "+0%"
        pitch = "+0Hz"
        
        if config:
            voice = config.get("voice", voice)
            rate = config.get("rate", rate)
            volume = config.get("volume", volume)
            pitch = config.get("pitch", pitch)
        
        _tts_service = TTSService(
            voice=voice,
            rate=rate,
            volume=volume,
            pitch=pitch
        )
    
    return _tts_service
