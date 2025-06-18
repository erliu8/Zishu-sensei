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
        
        def load_character_config(self,config_path:str)->bool:
            """加载角色配置"""
            try:
                with open(config_path,"r",encoding="utf-8") as f:
                    self._character_config = json.load(f)
                
                self._logger.info(f"角色配置加载成功: {config_path}")
                return True
            except Exception as e:
                self._logger.error(f"角色配置加载失败: {config_path} - {str(e)}")
                return False
            
        def load_desktop_config(self,config_path:str)->bool:
            """加载桌面配置"""
            try:
                with open(config_path,"r",encoding="utf-8") as f:
                    self._desktop_config = json.load(f)
                    
                self._logger.info(f"桌面配置加载成功: {config_path}")
                return True
            except Exception as e:
                self._logger.error(f"桌面配置加载失败: {config_path} - {str(e)}")
                return False
            
        def _update_from_configs(self) ->None:
            """从配置中更新模型设置"""
            if self._character_config:
                appearance = self._character_config.get("appearance",{})
                if appearance:
                    if "model_path" in appearance and not self.config.model_path:
                        self.config.model_path = appearance.get("model_path")
                    self.config.scale = appearance.get("scale",self.config.scale)
                    self.config.enable_physics = appearance.get("enable_physics",self.config.enable_physics)
                    self.config.enable_breath = appearance.get("enable_breath",self.config.enable_breath)
                    self.config.enable_eye_blink = appearance.get("enable_eye_blink",self.config.enable_eye_blink)
                    self.config.default_expression = appearance.get("default_expression",self.config.default_expression)
                    self.config.accessory_settings = appearance.get("accessory_settings",self.config.accessory_settings)

            #从桌面配置更新
            if self._desktop_config:
                window = self._desktop_config.get("window",{})
                if window:
                    self.config_opacity = window.get("transparent",self.config.opacity)
                    
                animation = self._desktop_config.get("animation",{})
                if animation:
                    self.config.motion_fade_duration = animation.get("transition_time",self.config.motion_fade_duration)
                    
                interaction = self._desktop_config.get("interaction",{})
                if interaction:
                    self.config.interaction_config = interaction
                    
        @property
        def name(self)->str:
            """获取角色名称"""
            return self.config.name
        
        @property
        def position(self)->t.Tuple[int,int]:
            """获取模型位置"""
            return self.config.position_x,self.config.position_y
        
        @position.setter
        def position(self,pos:t.Tuple[int,int]):
            """设置模型位置"""
            self.config.position_x,self.config.position_y = pos
            if self._is_initialized:
                self._send_command("setPosition",{"x":pos[0],"y":pos[1]})
                
        @property
        def scale(self)->float:
            """获取模型缩放比例"""
            return self.config.scale
        
        @scale.setter
        def scale(self,value:float):
            self.config.scale = max(0.1,min(value,5.0))
            if self._is_initialized:
                self._send_command("setScale",{"scale":self.config.scale})
                
        @property
        def opacity(self)->float:
            """获取模型透明度"""
            return self.config.opacity
        
        @opacity.setter
        def opacity(self,value:float):
            self.config.opacity = max(0.0,min(value,1.0))
            if self._is_initialized:
                self._send_command("setOpacity",{"opacity":self.config.opacity})
                
        @property
        def is_visible(self)->bool:
            """获取模型可见性"""
            return self._is_visible

        @property
        def is_initialized(self)->bool:
            """获取模型初始化状态"""
            return self._is_initialized
        
        def show(self)->None:
            """显示模型"""
            if not self._is_visible:
                self._is_visible = True
                self._logger.info(f"Live2D模型{self.name}显示")
                if self._is_initialized:
                    self._send_command("show")
                    
        def hide(self)->None:
            """隐藏模型"""
            if self._is_visible:
                self._is_visible = False
                self._logger.info(f"Live2D模型{self.name}隐藏")
                if self._is_initialized:
                    self._send_command("hide")
                    
        def initialize(self,view_instance:t.Any = None)->bool:
            """初始化模型"""
            if self._is_initialized:
                return True
            
            try:
                self._logger.info(f"Live2D模型{self.name}初始化开始")
                
                #保存视图引用
                self._view = view_instance
                
                #验证模型文件是否存在
                model_path = Path(self.config.model_path)
                if not model_path.exists() and not model_path.is_absolute():
                    #尝试相对路径
                    base_path = ["./assets/live2d_models","../assets/live2d_models"]
                    for base in base_path:
                        test_path = Path(base) / model_path
                        if test_path.exists():
                            self.config.model_path = str(test_path)
                            break
                            
                #发送初始化命令
                init_params = {
                    "modelPath":self.config.model_path,
                    "scale":self.config.scale,
                    "opacity":self.config.opacity,
                    "position":{
                        "x":self.config.position_x,
                        "y":self.config.position_y
                    },
                    "enablePhysics":self.config.enable_physics,
                    "enableBreath":self.config.enable_breath,
                    "enableEyeBlink":self.config.enable_eye_blink,
                    "motionFadeDuration":self.config.motion_fade_duration,
                    "sessionId":self._session_id,
                }
                
                self._send_command("initialize",init_params)
                
                #设置默认表情
                if self.config.default_expression:
                    self.set_expression(self.config.default_expression)
                    
                #设置配件
                if self.config.accessory_settings:
                    for accessory,enabled in self.config.accessory_settings.items():
                        self.set_accessory(accessory,enabled)
                        
                self._is_initialized = True
                
                #如果需要显示问候动画
                if self._desktop_config.get("startup",{}).get("greeting_on_startup",True):
                    self.paly_motion(Live2DMotionType.GREETING)
                    
                #启用更新线程
                self._start_update_loop()
                
                return True
            except Exception as e:
                self._logger.error(f"Live2D模型{self.name}初始化失败: {str(e)}")
                return False
            
        def _start_update_loop(self)->None:
            """启动更新循环"""
            if self._update_task_id:
                return
            
            #使用线程工厂创建更新线程
            self._update_task_id = self._thread_factory.submit(self._update_loop)
            self._logger.debug(f"启用更新循环线程，任务ID: {self._update_task_id}")
            
            #启用空闲动作线程
            idle_interval = self._desktop_config.get("animation",{}).get("idle_interval",5)
            self._idle_task_id = self._thread_factory.submit_task(self._idle_motion_loop,idle_interval)
            self._logger.debug(f"启用空闲动作线程，任务ID: {self._idle_task_id}")
            
            def _update_loop(self)->None:
                """模型更新循环"""
                self._is_running = True
                fps = self._desktop_config.get("animation",{}).get("fps",30)
                frame_time = 1.0 /fps
                
                self._logger.debug(f"Live2D模型{self.name}更新循环启动，FPS: {fps}")
                
                last_time = time.time()
                while self._is_running and self._is_initialized:
                    current_time = time.time()
                    delta_time = current_time - last_time
                    last_time = current_time
                    
                    #更新模型
                    try:
                        #处理命令队列
                        self._notify_view_new_commands()
                    except Exception as e:
                        self._logger.error(f"Live2D模型{self.name}更新循环异常: {str(e)}")
                        
                    #控制帧率
                    sleep_time = frame_time - (time.time() - current_time)
                    if sleep_time > 0:
                        time.sleep(sleep_time)
                        
                self._logger.debug(f"Live2D模型{self.name}更新循环结束")
                        
            def _idle_motion_loop(self,idle_interval:float)->None:
                """空闲动作循环"""
                self._logger.info(f"Live2D模型{self.name}空闲动作循环启动，间隔: {idle_interval}秒")
                
                while self._is_running and self._is_initialized:
                    time.sleep(idle_interval)
                    
                    while self._is_running and self._is_initialized:
                        time.sleep(idle_interval)
                        if not self._is_running or not self._is_initialized:
                            break
                        
                    #播放空闲动作
                    try:
                        self.play_random_motion()
                    except Exception as e:
                        self._logger.error(f"Live2D模型{self.name}空闲动作循环异常: {str(e)}")
                        
                self._logger.info(f"Live2D模型{self.name}空闲动作循环结束")
                
            def _send_command(self,command:str,params:t.Dict = None)->None:
                """发送命令到渲染器"""
                if not self.view:
                    self._logger.warning(f"无法发送命令{command}，视图未初始化")
                    return
                
                message = {
                    "command":command,
                    "sessionId":self._session_id,
                }
                
                if params:
                    message["params"] = params
                    
                try:
                    with self._message_lock:
                        self._message_queue.append(message)
                    
                    #通知视图有新命令
                    self._notify_view_new_command()
                    
                except Exception as e:
                    self._logger.error(f"Live2D模型{self.name}发送命令{command}失败: {str(e)}")
                    
            def _notify_view_new_commands(self)->None:
                """通知视图有新命令"""
                if not self._view:
                    return
                
                if hasattr(self._view,"process_live2d_command"):
                    self._view.process_live2d_command()
                elif hasattr(self._view,"runJavaScript"):
                    js_command = self._get_next_command_as_js()
                    if js_command:
                        self._view.runJavaScript(js_command)
                        
            def _get_next_command_as_js(self)->str:
                """获取下一个命令的JS代码"""
                with self._message_lock:
                    if not self._message_queue:
                        return ""

                    command = self._message_queue.pop(0)
                    
                #转换为JS
                js_code = f"""
                    (function(){{
                        const cmd = {json.dumps(command)};
                        if(window.live2dBridge && typeof window.live2dBridge.processCommand === 'function'){{
                            window.live2dBridge.processCommand(cmd);
                        }}else{{
                            console.error('Live2D模型{self.name}未找到Live2D桥接对象');
                        }}
                    }})()
                """
                return js_code
                
            def _notify_view_new_command(self)->None:
                """通知视图有新命令"""
                if not self._view:
                    return
                
                if hasattr(self._view,"process_live2d_command"):
                    self._view.process_live2d_command()
                elif hasattr(self._view,"runJavaScript"):
                    js_command = self._get_next_command_as_js()
                    if js_command:
                        self._view.runJavaScript(js_command)
                        
            def _get_next_command_as_js(self)->str:
                """获取下一个命令的JS代码"""
                with self._message_lock:
                    if not self._message_queue:
                        return ""
                    
                    command = self._message_queue.pop(0)
                    
                    #转换为JS
                    js_code = f"""
                    (function(){{
                        const cmd = {json.dumps(command)};
                        if(window.live2dBridge && typeof window.live2dBridge.processCommand === 'function'){{
                            window.live2dBridge.processCommand(cmd);
                        }}else{{
                            console.error('Live2D模型{self.name}未找到Live2D桥接对象');
                        }}
                    }})()
                """
                return js_code
                
            def get_pending_commands(self)->t.List[t.Dict]:
                """获取待处理的命令"""
                with self._message_lock:
                    commands = self._message_queue.copy()
                    self._message_queue.clear()
                    return commands
                
            def update(self,delta_time:float = None)->None:
                """手动更新Live2D模型状态(当不使用自动更新线程时)"""
                if not self._is_visible and not self._is_initialized:
                    return
                
                current_time = time.time()
                if delta_time is None:
                    delta_time = current_time - self._last_update_time
                    
                self._last_update_time = current_time
                
                #更新命令队列
                self._notify_view_new_commands()
                
            def cleanup(self)->None:
                """清理Live2D模型资源"""
                if not self._is_initialized:
                    return
                
                try:
                    self._logger.info(f"Live2D模型{self.name}清理开始")
                    
                    #停止更新循环
                    self._is_running = False
                    
                    #取消线程任务
                    if self._update_task_id:
                        self._thread_factory.cancel_task(self._update_task_id)
                        self._update_task_id = None
                        
                    if self._idle_task_id:
                        self._thread_factory.cancel_task(self._idle_task_id)
                        self._idle_task_id = None
                        
                    #发送清理命令
                    self._send_command("cleanup")
                    
                    #等待命令队列处理完成
                    time.sleep(0.1)
                    
                    self._is_initialized = False
                    self._view = None
                    
                    self._logger.info(f"Live2D模型{self.name}清理完成")
                    
                except Exception as e:
                    self._logger.error(f"Live2D模型{self.name}清理失败: {str(e)}")
            
            def handle_interaction(self,event:str,event_data:t.Dict[str,t.Any])->bool:
                """处理用户与Live2D模型的交互事件"""
                if not self._is_initialized or self._is_initialized:
                    return False
                
                
        
        
        
        
        