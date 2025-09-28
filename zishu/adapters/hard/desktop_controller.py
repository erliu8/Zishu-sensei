"""
桌面操作控制器
"""

import os
import sys
import time
import asyncio
import threading
import subprocess
import platform
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from contextlib import asynccontextmanager
import logging
import weakref
from collections import defaultdict, deque
import json
import base64
import io

# 第三方依赖检查和导入
try:
    import pyautogui
    import pynput
    from pynput import mouse, keyboard
    from pynput.mouse import Button, Listener as MouseListener
    from pynput.keyboard import Key, Listener as KeyboardListener
    PYNPUT_AVAILABLE = True
except ImportError as e:
    PYNPUT_AVAILABLE = False
    logging.warning(f"pynput not available: {e}")

try:
    import PIL
    from PIL import Image, ImageDraw, ImageFont, ImageOps
    PIL_AVAILABLE = True
except ImportError as e:
    PIL_AVAILABLE = False
    logging.warning(f"PIL not available: {e}")

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError as e:
    CV2_AVAILABLE = False
    logging.warning(f"OpenCV not available: {e}")

# 平台特定设置
if platform.system() == "Linux":
    if 'pyautogui' in locals():
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1

# 项目内部模块导入
from ..base.adapter import BaseAdapter, ExecutionContext, ExecutionResult, HealthCheckResult
from ..base.exceptions import (
    DesktopControlError, PermissionDeniedError, AdapterExecutionError,
    SecurityViolationError, ErrorCode, ExceptionSeverity,
    handle_adapter_exceptions
)
from ..base.metadata import (
    AdapterMetadata, AdapterType, AdapterStatus, AdapterCapability,
    CapabilityCategory, SecurityLevel, AdapterVersion, AdapterPermissions,
    create_capability, create_dependency, create_configuration
)

# 安全审计模块（可选）
try:
    from ..security.audit import audit_adapter_operation
    AUDIT_AVAILABLE = True
except ImportError:
    # 创建空装饰器作为备选
    def audit_adapter_operation(operation_name):
        def decorator(func):
            return func
        return decorator
    AUDIT_AVAILABLE = False


# ================================
# 核心数据结构定义
# ================================

@dataclass
class Point:
    """二维坐标点"""
    x: int
    y: int
    
    def __iter__(self):
        yield self.x
        yield self.y
    
    def to_tuple(self) -> Tuple[int, int]:
        return (self.x, self.y)
    
    def distance_to(self, other: 'Point') -> float:
        """计算到另一个点的欧几里得距离"""
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5


@dataclass
class Rectangle:
    """矩形区域定义"""
    x: int
    y: int  
    width: int
    height: int
    
    @property
    def center(self) -> Point:
        return Point(self.x + self.width // 2, self.y + self.height // 2)
    
    def contains(self, point: Point) -> bool:
        """检查点是否在矩形区域内"""
        return (self.x <= point.x <= self.x + self.width and 
                self.y <= point.y <= self.y + self.height)
    
    def to_tuple(self) -> Tuple[int, int, int, int]:
        return (self.x, self.y, self.width, self.height)


@dataclass
class WindowInfo:
    """窗口信息数据结构"""
    title: str
    handle: Optional[int] = None
    pid: Optional[int] = None
    position: Optional[Rectangle] = None
    is_visible: bool = True
    is_minimized: bool = False
    is_maximized: bool = False
    class_name: Optional[str] = None
    process_name: Optional[str] = None


@dataclass
class DesktopOperation:
    """桌面操作记录"""
    operation_type: str
    parameters: Dict[str, Any]
    timestamp: datetime
    duration_ms: float
    success: bool
    error_message: Optional[str] = None
    user_id: Optional[str] = None


# ================================
# 鼠标控制器
# ================================

class MouseController:
    """
    鼠标控制器 - 提供全面的鼠标操作功能
    
    功能特性：
    - 精确的鼠标移动和定位
    - 多种点击模式（左键、右键、中键、双击）
    - 拖拽操作支持
    - 滚轮控制
    - 点击历史记录
    - 安全防护机制
    """
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self._last_position = Point(0, 0)
        self._click_history = deque(maxlen=100)
        self._operation_count = 0
        
        # 安全设置
        self._max_move_distance = 2000  # 单次移动最大距离
        self._min_click_interval = 0.01  # 最小点击间隔
        self._last_click_time = 0
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Mouse move operation failed"
    )
    def move_to(self, x: int, y: int, duration: float = 0.0) -> bool:
        """移动鼠标到指定坐标"""
        try:
            # 安全检查
            if not self._validate_coordinates(x, y):
                raise DesktopControlError(f"Invalid coordinates: ({x}, {y})")
            
            # 执行移动
            pyautogui.moveTo(x, y, duration=duration)
            self._last_position = Point(x, y)
            self._operation_count += 1
            
            self.logger.debug(f"Mouse moved to ({x}, {y})")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to move mouse: {e}")
            raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Mouse click operation failed"
    )
    def click(self, x: Optional[int] = None, y: Optional[int] = None, 
              button: str = 'left', clicks: int = 1, interval: float = 0.0) -> bool:
        """执行鼠标点击操作"""
        try:
            # 防抖保护
            current_time = time.time()
            if current_time - self._last_click_time < self._min_click_interval:
                time.sleep(self._min_click_interval)
            
            # 移动到目标位置
            if x is not None and y is not None:
                self.move_to(x, y)
                click_pos = Point(x, y)
            else:
                click_pos = self._get_current_position()
            
            # 验证按键类型
            valid_buttons = ['left', 'right', 'middle']
            if button not in valid_buttons:
                raise DesktopControlError(f"Invalid button: {button}")
            
            # 记录点击历史
            click_record = {
                'position': click_pos.to_tuple(),
                'button': button,
                'clicks': clicks,
                'timestamp': datetime.now(timezone.utc)
            }
            self._click_history.append(click_record)
            
            # 执行点击
            pyautogui.click(x, y, clicks=clicks, interval=interval, button=button)
            self._last_click_time = time.time()
            self._operation_count += 1
            
            self.logger.debug(f"Mouse clicked at {click_pos} with {button} button")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to click mouse: {e}")
            raise
    
    def double_click(self, x: Optional[int] = None, y: Optional[int] = None) -> bool:
        """双击操作"""
        return self.click(x, y, clicks=2, interval=0.1)
    
    def right_click(self, x: Optional[int] = None, y: Optional[int] = None) -> bool:
        """右键点击"""
        return self.click(x, y, button='right')
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Mouse drag operation failed"
    )
    def drag(self, start_x: int, start_y: int, end_x: int, end_y: int, 
             duration: float = 1.0, button: str = 'left') -> bool:
        """执行鼠标拖拽操作"""
        try:
            # 验证坐标
            if not (self._validate_coordinates(start_x, start_y) and 
                    self._validate_coordinates(end_x, end_y)):
                raise DesktopControlError("Invalid drag coordinates")
            
            # 移动到起始位置
            self.move_to(start_x, start_y)
            
            # 执行拖拽
            pyautogui.drag(end_x - start_x, end_y - start_y, 
                          duration=duration, button=button)
            
            self._operation_count += 1
            self.logger.debug(f"Mouse dragged from ({start_x}, {start_y}) to ({end_x}, {end_y})")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to drag mouse: {e}")
            raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Mouse scroll operation failed"
    )
    def scroll(self, x: int, y: int, clicks: int) -> bool:
        """执行鼠标滚轮操作"""
        try:
            if not self._validate_coordinates(x, y):
                raise DesktopControlError(f"Invalid scroll coordinates: ({x}, {y})")
            
            pyautogui.scroll(clicks, x=x, y=y)
            self._operation_count += 1
            
            direction = "up" if clicks > 0 else "down"
            self.logger.debug(f"Mouse scrolled {abs(clicks)} clicks {direction}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to scroll mouse: {e}")
            raise
    
    def get_position(self) -> Point:
        """获取当前鼠标位置"""
        try:
            x, y = pyautogui.position()
            return Point(x, y)
        except Exception as e:
            self.logger.warning(f"Failed to get mouse position: {e}")
            return self._last_position
    
    def _get_current_position(self) -> Point:
        """内部方法：获取当前位置"""
        return self.get_position()
    
    def _validate_coordinates(self, x: int, y: int) -> bool:
        """验证坐标是否有效"""
        try:
            screen_width, screen_height = pyautogui.size()
            return 0 <= x <= screen_width and 0 <= y <= screen_height
        except Exception:
            return True  # 如果无法获取屏幕尺寸，假设坐标有效
    
    def get_click_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取点击历史记录"""
        return list(self._click_history)[-limit:]


# ================================
# 键盘控制器
# ================================

class KeyboardController:
    """
    键盘控制器 - 提供全面的键盘操作功能
    
    功能特性：
    - 按键模拟和组合键
    - 文本输入和特殊字符
    - 热键监听和处理
    - 按键历史记录
    - 输入法兼容性
    """
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self._key_history = deque(maxlen=100)
        self._operation_count = 0
        self._hotkey_listeners = {}
        self._input_buffer = []
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Key press operation failed"
    )
    def press_key(self, key: str, duration: float = 0.0) -> bool:
        """按下指定按键"""
        try:
            if duration > 0:
                pyautogui.keyDown(key)
                time.sleep(duration)
                pyautogui.keyUp(key)
            else:
                pyautogui.press(key)
            
            # 记录按键历史
            key_record = {
                'key': key,
                'duration': duration,
                'timestamp': datetime.now(timezone.utc),
                'type': 'press'
            }
            self._key_history.append(key_record)
            
            self._operation_count += 1
            self.logger.debug(f"Key pressed: {key}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to press key {key}: {e}")
            raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Key combination operation failed"
    )
    def press_combination(self, *keys: str) -> bool:
        """按下组合键"""
        try:
            pyautogui.hotkey(*keys)
            
            # 记录组合键历史
            combo_record = {
                'keys': keys,
                'timestamp': datetime.now(timezone.utc),
                'type': 'combination'
            }
            self._key_history.append(combo_record)
            
            self._operation_count += 1
            self.logger.debug(f"Key combination pressed: {'+'.join(keys)}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to press key combination {keys}: {e}")
            raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Text input operation failed"
    )
    def type_text(self, text: str, interval: float = 0.0) -> bool:
        """输入文本"""
        try:
            pyautogui.write(text, interval=interval)
            
            # 记录文本输入
            text_record = {
                'text': text[:50] + '...' if len(text) > 50 else text,  # 截断长文本
                'length': len(text),
                'interval': interval,
                'timestamp': datetime.now(timezone.utc),
                'type': 'text'
            }
            self._key_history.append(text_record)
            
            self._operation_count += 1
            self.logger.debug(f"Text typed: {len(text)} characters")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to type text: {e}")
            raise
    
    def press_enter(self) -> bool:
        """按回车键"""
        return self.press_key('enter')
    
    def press_escape(self) -> bool:
        """按ESC键"""
        return self.press_key('escape')
    
    def press_tab(self) -> bool:
        """按Tab键"""
        return self.press_key('tab')
    
    def copy(self) -> bool:
        """复制操作 (Ctrl+C)"""
        return self.press_combination('ctrl', 'c')
    
    def paste(self) -> bool:
        """粘贴操作 (Ctrl+V)"""
        return self.press_combination('ctrl', 'v')
    
    def cut(self) -> bool:
        """剪切操作 (Ctrl+X)"""
        return self.press_combination('ctrl', 'x')
    
    def select_all(self) -> bool:
        """全选操作 (Ctrl+A)"""
        return self.press_combination('ctrl', 'a')
    
    def undo(self) -> bool:
        """撤销操作 (Ctrl+Z)"""
        return self.press_combination('ctrl', 'z')
    
    def redo(self) -> bool:
        """重做操作 (Ctrl+Y)"""
        return self.press_combination('ctrl', 'y')
    
    def get_key_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取按键历史记录"""
        return list(self._key_history)[-limit:]


# ================================
# 窗口管理器
# ================================

class WindowManager:
    """
    窗口管理器 - 提供窗口操作功能
    
    功能特性：
    - 窗口查找和激活
    - 窗口状态控制（最大化、最小化、关闭）
    - 窗口信息获取
    - 多显示器支持
    """
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self._window_cache = {}
        self._operation_count = 0
    
    def find_windows(self, title_pattern: str = None, 
                    class_name: str = None) -> List[WindowInfo]:
        """查找匹配条件的窗口"""
        windows = []
        try:
            if platform.system() == "Windows":
                windows = self._find_windows_windows(title_pattern, class_name)
            elif platform.system() == "Linux":
                windows = self._find_windows_linux(title_pattern, class_name)
            elif platform.system() == "Darwin":  # macOS
                windows = self._find_windows_macos(title_pattern, class_name)
            
            self.logger.debug(f"Found {len(windows)} windows")
            return windows
            
        except Exception as e:
            self.logger.error(f"Failed to find windows: {e}")
            return []
    
    def _find_windows_linux(self, title_pattern: str = None, 
                           class_name: str = None) -> List[WindowInfo]:
        """Linux系统窗口查找"""
        windows = []
        try:
            # 使用wmctrl命令获取窗口列表
            result = subprocess.run(['wmctrl', '-l'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line:
                        parts = line.split(None, 3)
                        if len(parts) >= 4:
                            window_id = parts[0]
                            title = parts[3]
                            
                            if title_pattern and title_pattern not in title:
                                continue
                            
                            window_info = WindowInfo(
                                title=title,
                                handle=int(window_id, 16) if window_id.startswith('0x') else None
                            )
                            windows.append(window_info)
            
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self.logger.warning("wmctrl not available, using fallback method")
        
        return windows
    
    def _find_windows_windows(self, title_pattern: str = None,
                             class_name: str = None) -> List[WindowInfo]:
        """Windows系统窗口查找（需要pywin32）"""
        windows = []
        # 这里需要实现Windows特定的窗口查找逻辑
        # 由于没有pywin32依赖，暂时返回空列表
        return windows
    
    def _find_windows_macos(self, title_pattern: str = None,
                           class_name: str = None) -> List[WindowInfo]:
        """macOS系统窗口查找"""
        windows = []
        # 这里需要实现macOS特定的窗口查找逻辑
        return windows
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Window activation failed"
    )
    def activate_window(self, window: WindowInfo) -> bool:
        """激活指定窗口"""
        try:
            if platform.system() == "Linux" and window.handle:
                subprocess.run(['wmctrl', '-i', '-a', hex(window.handle)], 
                             timeout=5, check=False)
                self.logger.debug(f"Activated window: {window.title}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to activate window: {e}")
            raise
    
    def get_active_window(self) -> Optional[WindowInfo]:
        """获取当前活动窗口"""
        try:
            if platform.system() == "Linux":
                result = subprocess.run(['xdotool', 'getactivewindow', 'getwindowname'],
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    title = result.stdout.strip()
                    return WindowInfo(title=title)
            
            return None
            
        except Exception as e:
            self.logger.warning(f"Failed to get active window: {e}")
            return None


# ================================
# 屏幕操作器
# ================================

class ScreenController:
    """
    屏幕操作器 - 提供屏幕相关功能
    
    功能特性：
    - 屏幕截图和区域截图
    - 图像识别和匹配
    - 文本识别（OCR）
    - 颜色和像素检测
    """
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self._screenshot_count = 0
        self._last_screenshot = None
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=DesktopControlError,
        message="Screenshot operation failed"
    )
    def take_screenshot(self, region: Optional[Rectangle] = None) -> Optional['Image.Image']:
        """截取屏幕截图"""
        try:
            if region:
                screenshot = pyautogui.screenshot(region=region.to_tuple())
            else:
                screenshot = pyautogui.screenshot()
            
            self._last_screenshot = screenshot
            self._screenshot_count += 1
            
            self.logger.debug(f"Screenshot taken: {screenshot.size}")
            return screenshot
            
        except Exception as e:
            self.logger.error(f"Failed to take screenshot: {e}")
            raise
    
    def save_screenshot(self, filepath: str, region: Optional[Rectangle] = None) -> bool:
        """保存截图到文件"""
        try:
            screenshot = self.take_screenshot(region)
            if screenshot:
                screenshot.save(filepath)
                self.logger.debug(f"Screenshot saved to: {filepath}")
                return True
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to save screenshot: {e}")
            return False
    
    def find_image_on_screen(self, template_path: str, 
                            confidence: float = 0.8) -> Optional[Point]:
        """在屏幕上查找图像"""
        try:
            location = pyautogui.locateOnScreen(template_path, confidence=confidence)
            if location:
                center = pyautogui.center(location)
                return Point(center.x, center.y)
            return None
            
        except Exception as e:
            self.logger.warning(f"Image not found on screen: {e}")
            return None
    
    def get_pixel_color(self, x: int, y: int) -> Tuple[int, int, int]:
        """获取指定位置的像素颜色"""
        try:
            screenshot = pyautogui.screenshot()
            color = screenshot.getpixel((x, y))
            return color
            
        except Exception as e:
            self.logger.error(f"Failed to get pixel color: {e}")
            return (0, 0, 0)
    
    def get_screen_size(self) -> Tuple[int, int]:
        """获取屏幕尺寸"""
        try:
            return pyautogui.size()
        except Exception as e:
            self.logger.error(f"Failed to get screen size: {e}")
            return (1920, 1080)  # 默认值


# ================================
# 主桌面控制器
# ================================

class DesktopController(BaseAdapter):
    """
    桌面控制器
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        
        # 初始化各个控制器
        self.mouse = MouseController(self.logger)
        self.keyboard = KeyboardController(self.logger)
        self.window = WindowManager(self.logger)
        self.screen = ScreenController(self.logger)
        
        # 操作历史和统计
        self._operation_history = deque(maxlen=1000)
        self._operation_stats = {
            'total_operations': 0,
            'mouse_operations': 0,
            'keyboard_operations': 0,
            'window_operations': 0,
            'screen_operations': 0,
            'errors': 0
        }
        
        # 安全配置
        self._safety_enabled = config.get('safety_enabled', True) if config else True
        self._max_operations_per_minute = config.get('max_operations_per_minute', 1000) if config else 1000
        self._operation_timestamps = deque(maxlen=self._max_operations_per_minute)
        
        # 初始化PyAutoGUI安全设置
        pyautogui.FAILSAFE = True  # 移动鼠标到左上角停止
        pyautogui.PAUSE = 0.1      # 操作间默认延迟
        
        self.logger.info("Desktop controller initialized")
    
    def get_adapter_info(self) -> Dict[str, Any]:
        """获取适配器信息"""
        return {
            'name': 'DesktopController',
            'version': '1.0.0',
            'description': 'Desktop automation adapter for Zishu-sensei',
            'capabilities': [
                'mouse_control',
                'keyboard_control', 
                'window_management',
                'screen_capture',
                'image_recognition'
            ],
            'platform': platform.system(),
            'screen_size': self.screen.get_screen_size(),
            'safety_enabled': self._safety_enabled,
            'operation_stats': self._operation_stats.copy()
        }
    
    def validate_config(self, config: Dict[str, Any]) -> bool:
        """验证配置"""
        required_keys = []  # 桌面控制器没有必需的配置项
        
        for key in required_keys:
            if key not in config:
                self.logger.error(f"Missing required config key: {key}")
                return False
        
        return True
    
    def test_connection(self) -> bool:
        """测试桌面控制功能"""
        try:
            # 测试屏幕访问
            screen_size = self.screen.get_screen_size()
            if screen_size == (0, 0):
                return False
            
            # 测试鼠标位置获取
            mouse_pos = self.mouse.get_position()
            if mouse_pos is None:
                return False
            
            self.logger.info("Desktop controller connection test passed")
            return True
            
        except Exception as e:
            self.logger.error(f"Desktop controller connection test failed: {e}")
            return False
    
    def _record_operation(self, operation_type: str, parameters: Dict[str, Any], 
                         success: bool, duration_ms: float, 
                         error_message: Optional[str] = None):
        """记录操作历史"""
        operation = DesktopOperation(
            operation_type=operation_type,
            parameters=parameters,
            timestamp=datetime.now(timezone.utc),
            duration_ms=duration_ms,
            success=success,
            error_message=error_message,
            user_id=self.config.get('user_id') if self.config else None
        )
        
        self._operation_history.append(operation)
        
        # 更新统计
        self._operation_stats['total_operations'] += 1
        if not success:
            self._operation_stats['errors'] += 1
        
        # 根据操作类型更新统计
        if operation_type.startswith('mouse_'):
            self._operation_stats['mouse_operations'] += 1
        elif operation_type.startswith('keyboard_'):
            self._operation_stats['keyboard_operations'] += 1
        elif operation_type.startswith('window_'):
            self._operation_stats['window_operations'] += 1
        elif operation_type.startswith('screen_'):
            self._operation_stats['screen_operations'] += 1
    
    def _check_rate_limit(self) -> bool:
        """检查操作频率限制"""
        if not self._safety_enabled:
            return True
        
        current_time = time.time()
        
        # 清理过期的时间戳
        while (self._operation_timestamps and 
               current_time - self._operation_timestamps[0] > 60):
            self._operation_timestamps.popleft()
        
        # 检查是否超过频率限制
        if len(self._operation_timestamps) >= self._max_operations_per_minute:
            self.logger.warning("Rate limit exceeded")
            return False
        
        self._operation_timestamps.append(current_time)
        return True
    
    # ================================
    # 鼠标操作接口
    # ================================
    
    def click(self, x: int, y: int, button: str = 'left', clicks: int = 1) -> bool:
        """点击鼠标"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {'x': x, 'y': y, 'button': button, 'clicks': clicks}
        
        try:
            result = self.mouse.click(x, y, button, clicks)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_click', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_click', parameters, False, duration_ms, str(e))
            raise
    
    def move_mouse(self, x: int, y: int, duration: float = 0.0) -> bool:
        """移动鼠标"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {'x': x, 'y': y, 'duration': duration}
        
        try:
            result = self.mouse.move_to(x, y, duration)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_move', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_move', parameters, False, duration_ms, str(e))
            raise
    
    def drag_mouse(self, start_x: int, start_y: int, end_x: int, end_y: int, 
                   duration: float = 1.0) -> bool:
        """拖拽鼠标"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {
            'start_x': start_x, 'start_y': start_y,
            'end_x': end_x, 'end_y': end_y, 'duration': duration
        }
        
        try:
            result = self.mouse.drag(start_x, start_y, end_x, end_y, duration)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_drag', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_drag', parameters, False, duration_ms, str(e))
            raise
    
    def scroll(self, x: int, y: int, clicks: int) -> bool:
        """滚轮操作"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {'x': x, 'y': y, 'clicks': clicks}
        
        try:
            result = self.mouse.scroll(x, y, clicks)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_scroll', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('mouse_scroll', parameters, False, duration_ms, str(e))
            raise
    
    # ================================
    # 键盘操作接口
    # ================================
    
    def press_key(self, key: str, duration: float = 0.0) -> bool:
        """按键操作"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {'key': key, 'duration': duration}
        
        try:
            result = self.keyboard.press_key(key, duration)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('keyboard_press', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('keyboard_press', parameters, False, duration_ms, str(e))
            raise
    
    def press_keys(self, *keys: str) -> bool:
        """组合键操作"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {'keys': keys}
        
        try:
            result = self.keyboard.press_combination(*keys)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('keyboard_combination', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('keyboard_combination', parameters, False, duration_ms, str(e))
            raise
    
    def type_text(self, text: str, interval: float = 0.0) -> bool:
        """文本输入"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {'text_length': len(text), 'interval': interval}
        
        try:
            result = self.keyboard.type_text(text, interval)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('keyboard_type', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('keyboard_type', parameters, False, duration_ms, str(e))
            raise
    
    # ================================
    # 窗口操作接口
    # ================================
    
    def find_windows(self, title_pattern: str = None) -> List[WindowInfo]:
        """查找窗口"""
        start_time = time.time()
        parameters = {'title_pattern': title_pattern}
        
        try:
            result = self.window.find_windows(title_pattern)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('window_find', parameters, True, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('window_find', parameters, False, duration_ms, str(e))
            raise
    
    def activate_window(self, window: WindowInfo) -> bool:
        """激活窗口"""
        if not self._check_rate_limit():
            return False
        
        start_time = time.time()
        parameters = {'window_title': window.title}
        
        try:
            result = self.window.activate_window(window)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('window_activate', parameters, result, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('window_activate', parameters, False, duration_ms, str(e))
            raise
    
    # ================================
    # 屏幕操作接口
    # ================================
    
    def take_screenshot(self, region: Optional[Rectangle] = None) -> Optional['Image.Image']:
        """截屏操作"""
        start_time = time.time()
        parameters = {'region': region.to_dict() if region else None}
        
        try:
            result = self.screen.take_screenshot(region)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('screen_capture', parameters, result is not None, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('screen_capture', parameters, False, duration_ms, str(e))
            raise
    
    def find_image(self, template_path: str, confidence: float = 0.8) -> Optional[Point]:
        """图像识别"""
        start_time = time.time()
        parameters = {'template_path': template_path, 'confidence': confidence}
        
        try:
            result = self.screen.find_image_on_screen(template_path, confidence)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('image_find', parameters, result is not None, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('image_find', parameters, False, duration_ms, str(e))
            raise
    
    def get_pixel_color(self, x: int, y: int) -> Tuple[int, int, int]:
        """获取像素颜色"""
        start_time = time.time()
        parameters = {'x': x, 'y': y}
        
        try:
            result = self.screen.get_pixel_color(x, y)
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('pixel_color', parameters, True, duration_ms)
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            self._record_operation('pixel_color', parameters, False, duration_ms, str(e))
            raise
    
    # ================================
    # 便捷操作方法
    # ================================
    
    def double_click(self, x: int, y: int) -> bool:
        """双击操作"""
        return self.click(x, y, clicks=2)
    
    def right_click(self, x: int, y: int) -> bool:
        """右键点击"""
        return self.click(x, y, button='right')
    
    def copy(self) -> bool:
        """复制操作"""
        return self.press_keys('ctrl', 'c')
    
    def paste(self) -> bool:
        """粘贴操作"""
        return self.press_keys('ctrl', 'v')
    
    def cut(self) -> bool:
        """剪切操作"""
        return self.press_keys('ctrl', 'x')
    
    def select_all(self) -> bool:
        """全选操作"""
        return self.press_keys('ctrl', 'a')
    
    def save(self) -> bool:
        """保存操作"""
        return self.press_keys('ctrl', 's')
    
    def undo(self) -> bool:
        """撤销操作"""
        return self.press_keys('ctrl', 'z')
    
    def redo(self) -> bool:
        """重做操作"""
        return self.press_keys('ctrl', 'y')
    
    # ================================
    # 监控和管理方法
    # ================================
    
    def get_operation_stats(self) -> Dict[str, Any]:
        """获取操作统计"""
        return self._operation_stats.copy()
    
    def get_operation_history(self, limit: int = 10) -> List[DesktopOperation]:
        """获取操作历史"""
        return list(self._operation_history)[-limit:]
    
    def clear_history(self):
        """清空操作历史"""
        self._operation_history.clear()
        self.logger.info("Operation history cleared")
    
    def set_safety_mode(self, enabled: bool):
        """设置安全模式"""
        self._safety_enabled = enabled
        self.logger.info(f"Safety mode {'enabled' if enabled else 'disabled'}")
    
    def get_current_state(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            'mouse_position': self.mouse.get_position().to_dict(),
            'screen_size': self.screen.get_screen_size(),
            'active_window': self.window.get_active_window(),
            'operation_stats': self.get_operation_stats(),
            'safety_enabled': self._safety_enabled
        }


# ================================
# 模块导出
# ================================

__all__ = [
    # 异常类
    'DesktopControlError',
    
    # 数据类
    'Point',
    'Rectangle', 
    'WindowInfo',
    'DesktopOperation',
    
    # 控制器类
    'MouseController',
    'KeyboardController',
    'WindowManager',
    'ScreenController',
    'DesktopController'
]


# ================================
# 示例用法
# ================================

def example_usage():
    """桌面控制器使用示例"""
    
    # 基础配置
    config = {
        'safety_enabled': True,
        'max_operations_per_minute': 500,
        'user_id': 'demo_user'
    }
    
    # 创建桌面控制器
    desktop = DesktopController(config)
    
    try:
        # 测试连接
        if not desktop.test_connection():
            print("桌面控制器连接失败")
            return
        
        print("=== 桌面控制器示例 ===")
        
        # 获取适配器信息
        info = desktop.get_adapter_info()
        print(f"适配器: {info['name']} v{info['version']}")
        print(f"平台: {info['platform']}")
        print(f"屏幕尺寸: {info['screen_size']}")
        
        # 鼠标操作示例
        print("\n--- 鼠标操作 ---")
        
        # 获取当前鼠标位置
        current_pos = desktop.mouse.get_position()
        print(f"当前鼠标位置: {current_pos}")
        
        # 移动鼠标（相对安全的位置）
        desktop.move_mouse(100, 100, duration=0.5)
        print("鼠标已移动到 (100, 100)")
        
        # 点击操作
        desktop.click(100, 100)
        print("执行了左键点击")
        
        # 键盘操作示例
        print("\n--- 键盘操作 ---")
        
        # 文本输入
        desktop.type_text("Hello, Zishu-sensei!")
        print("输入了测试文本")
        
        # 组合键操作
        desktop.press_keys('ctrl', 'a')  # 全选
        print("执行了全选操作")
        
        # 屏幕操作示例
        print("\n--- 屏幕操作 ---")
        
        # 截图
        screenshot = desktop.take_screenshot()
        if screenshot:
            print(f"截图成功，尺寸: {screenshot.size}")
        
        # 获取像素颜色
        color = desktop.get_pixel_color(50, 50)
        print(f"位置 (50, 50) 的颜色: RGB{color}")
        
        # 窗口操作示例
        print("\n--- 窗口操作 ---")
        
        # 查找窗口
        windows = desktop.find_windows()
        print(f"找到 {len(windows)} 个窗口")
        
        for i, window in enumerate(windows[:3]):  # 只显示前3个
            print(f"  {i+1}. {window.title}")
        
        # 获取操作统计
        print("\n--- 操作统计 ---")
        stats = desktop.get_operation_stats()
        print(f"总操作数: {stats['total_operations']}")
        print(f"鼠标操作: {stats['mouse_operations']}")
        print(f"键盘操作: {stats['keyboard_operations']}")
        print(f"错误次数: {stats['errors']}")
        
        # 获取当前状态
        print("\n--- 当前状态 ---")
        state = desktop.get_current_state()
        print(f"鼠标位置: {state['mouse_position']}")
        print(f"安全模式: {state['safety_enabled']}")
        
    except Exception as e:
        print(f"示例执行出错: {e}")
    
    finally:
        # 清理
        desktop.clear_history()
        print("\n桌面控制器示例完成")


if __name__ == "__main__":
    # 运行示例
    example_usage()
