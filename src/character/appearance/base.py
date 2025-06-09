import typing as t
from dataclasses import dataclass
import json
import os
import time
from enum import Enum,auto
from pathlib import Path
import uuid
import threading
import websocket

from src.utils.thread_factory import get_thread_factory,ThreadFactory
from src.utils.logger import setup_logger

class Live2DMotionType(Enum):
    """Live2D动作类型"""
    IDLE = auto()
    TAP_BODY = auto()
    TAP_HEAD = auto()
    TAP_SPECIAL = auto()
    TALKING = auto()
    THINKING = auto()
    GREETING = auto()
    SURPRISED = auto()
    CUSTOM = auto()
    
@dataclass
class Live2DAppearanceConfig:
    """Live2D模型外观配置"""
    name:str
    model_path:str = "hiyori_vts/hiyori.model3.json"
    scale:float = 1.0
    opacity:float = 1.0
    position_x:int = 0
    position_y:int = 0
    enable_physics:bool = True
    enable_breath:bool = True
    enable_eye_blink:bool = True
    enable_lip_sync:bool = True
    enable_tracking:bool = True
    motion_fade_duration:float = 0.5
    idle_motion_group:str = "idle"
    default_expression:str = None
    accessory_settings:t.Dict[str,bool] = None
    interaction_config:t.Dict[str,t.Any] = None
    
class Live2DAppearance:
    """Live2D模型基础外观类 - 与HTML渲染器交互"""
    
    def __init__(self,
                 config:Live2DAppearanceConfig = None,
                 character_config_path:str = None,
                 desktop_config_path:str = None,
                 log_level = None,
                 log_file = None):
        """
        初始化Live2D外观类
        
        Args:
            config: Live2D模型配置
            character_config_path: 角色配置文件路径
            desktop_config_path: 桌面配置文件路径
            log_level: 日志级别
            log_file: 日志文件路径
        """
        self.config = config or Live2DAppearanceConfig(name="default",model_path="hiyori_vts/hiyori.model3.json")
        self._character_config = {}
        self._desktop_config = {}
        
        self._logger = setup_logger(f"live2d.{self.config.name}",level = log_level or "INFO",log_file = log_file)
        
        self._is_visible = True
        self._is_initialized = False
        self._is_running = False
        self._last_update_time = time.time()
        self._view = None # 渲染器视图
        self._message_queue = [] # 消息队列
        self._message_lock = threading.Lock()
        self._callbacks = {}
        self._session_id = str(uuid.uuid4())
        
        #获取线程工厂实例
        self._thread_factory = get_thread_factory()
        self._update_task_id = None
        self._idle_task_id = None
        
        #加载配置
        if character_config_path:
            self._load_character_config(character_config_path)
        if desktop_config_path:
            self._load_desktop_config(desktop_config_path)
            
        #从配置种更新模型设置
        self._update_from_configs()
        self._logger.info(f"Live2D基础外观: {self.config.name} 初始化完成")
        
        
        
        
        