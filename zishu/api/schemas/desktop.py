from typing import Dict, Any, List, Optional, Union, Literal, Tuple
from pydantic import BaseModel, Field, validator, root_validator
from enum import Enum
import json
from datetime import datetime

# ============================================================================
# 基础枚举类型
# ============================================================================

class DesktopOperationType(str, Enum):
    """桌面操作类型"""
    WINDOW_MANAGEMENT = "window_management"      # 窗口管理
    FILE_OPERATION = "file_operation"            # 文件操作
    SYSTEM_INTERACTION = "system_interaction"    # 系统交互
    APPLICATION_CONTROL = "application_control"  # 应用控制
    SCREEN_CAPTURE = "screen_capture"           # 屏幕捕获
    AUTOMATION = "automation"                   # 自动化
    DESKTOP_INTERACTION = "desktop_interaction"  # 桌面交互
    
class WindowState(str, Enum):
    """窗口状态"""
    NORMAL = "normal"
    MAXIMIZED = "maximized"
    MINIMIZED = "minimized"
    FULLSCREEN = "fullscreen"
    HIDDEN = "hidden"
    CLOSED = "closed"
 
class FileOperationType(str, Enum):
    """文件操作类型"""
    CREATE = "create"
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    RENAME = "rename"
    MOVE = "move"
    COPY = "copy"
    SEARCH = "search"
    LIST = "list"
    WATCH = "watch"
    COMPRESS = "compress"
    EXTRACT = "extract"

class AdapterType(str, Enum):
    """适配器类型"""
    SOFT = "soft"
    HARD = "hard"
    INTELLIGENT = "intelligent"

class ApplicationState(str, Enum):
    """应用程序状态"""
    RUNNING = "running"
    STOPPED = "stopped"
    SUSPENDED = "suspended"
    STARTING = "starting"
    STOPPING = "stopping"
    ERROR = "error"

class SystemInteractionType(str, Enum):
    """系统交互类型"""
    PROCESS_CONTROL = "process_control"
    SERVICE_CONTROL = "service_control" 
    REGISTRY_ACCESS = "registry_access"
    ENVIRONMENT_ACCESS = "environment_access"
    HARDWARE_CONTROL = "hardware_control"
    NETWORK_CONTROL = "network_control"

class ScreenCaptureType(str, Enum):
    """屏幕捕获类型"""
    FULL_SCREEN = "full_screen"
    WINDOW = "window"
    REGION = "region"
    ELEMENT = "element"
    VIDEO = "video"

class AutomationType(str, Enum):
    """自动化类型"""
    MOUSE_ACTION = "mouse_action"
    KEYBOARD_ACTION = "keyboard_action"
    CLICK = "click"
    DRAG_DROP = "drag_drop"
    TEXT_INPUT = "text_input"
    HOTKEY = "hotkey"
    MACRO = "macro"

class PermissionLevel(str, Enum):
    """权限级别"""
    READ_ONLY = "read_only"
    WRITE = "write"
    EXECUTE = "execute"
    ADMIN = "admin"
    FULL_CONTROL = "full_control"

#窗口管理模型
class WindowInfo(BaseModel):
    """窗口信息"""
    window_id: str = Field(..., description="窗口唯一标识")
    title: str = Field(..., description="窗口标题")
    process_name: str = Field(..., description="进程名称")
    process_id: int = Field(..., description="进程ID")
    position: Dict[str, int] = Field(..., description="窗口位置{x,y}")
    size: Dict[str, int] = Field(..., description="窗口大小{width,height}")
    state: WindowState = Field(..., description="窗口状态")
    is_active: bool = Field(..., description="是否激活")
    is_visible: bool = Field(..., description="是否可见")
    
    class Config:
        schema_extra = {
            "example": {
                "window_id": "win_12345",
                "title": "VS Code - desktop.py",
                "process_name": "Code.exe",
                "process_id": 8888,
                "position": {"x": 100, "y": 100},
                "size": {"width": 1200, "height": 900},
                "state": "normal",
                "is_active": True,
                "is_visible": True,
            }
        }

class WindowOperation(BaseModel):
    """窗口操作"""
    operation: Literal["list", "focus", "close", "minimize", "maximize", "move", "resize"] = Field(..., description="操作类型")
    window_id: Optional[str] = Field(None, description="目标窗口标识")
    window_title: Optional[str] = Field(None, description="窗口标题(用于查找)")
    process_name: Optional[str] = Field(None, description="进程名称(用于查找)")
    position: Optional[Dict[str, int]] = Field(None, description="新位置{x,y}")
    size: Optional[Dict[str, int]] = Field(None, description="新大小{width,height}")
    
    @validator("operation")
    def validate_operation_params(cls, v, values):
        if v in ['focus', 'close', 'minimize', 'maximize'] and not any([
            values.get('window_id') or values.get('window_title') or values.get('process_name')
        ]):
            raise ValueError("需要指定窗口ID、标题或进程名称")
        
        return v
    
class WindowOperationResponse(BaseModel):
    """窗口操作响应"""
    success: bool = Field(..., description="操作是否成功")
    operation: str = Field(..., description="操作类型")
    affected_windows: List[WindowInfo] = Field([], description="受影响的窗口信息")
    message: str = Field(..., description="操作结果描述")
    execution_time: float = Field(..., description="操作执行时间")

#文件操作类型
class FileInfo(BaseModel):
    path: str = Field(..., description="文件路径")
    name: str = Field(..., description="文件名称")
    size: int = Field(..., description="文件大小(Byte)")
    type: str = Field(..., description="文件类型")
    created_time: datetime = Field(..., description="创建时间")
    modified_time: datetime = Field(..., description="修改时间")
    permissions: str = Field(..., description="文件权限")
    is_directory: bool = Field(..., description="是否是目录")
    
    class Config:
        schema_extra = {
            "example": {
                "path": "/home/user/documents/report.pdf",
                "name": "report.pdf", 
                "size": 1048576,
                "type": "application/pdf",
                "created_time": "2024-01-01T12:00:00",
                "modified_time": "2024-01-01T15:30:00",
                "permissions": "rw-r--r--",
                "is_directory": False
            }
        }

# ============================================================================
# 文件操作模型
# ============================================================================

class FileOperation(BaseModel):
    """文件操作请求"""
    operation: FileOperationType = Field(..., description="操作类型")
    source_path: str = Field(..., description="源文件路径")
    target_path: Optional[str] = Field(None, description="目标路径(用于移动、复制、重命名)")
    content: Optional[str] = Field(None, description="文件内容(用于写入操作)")
    encoding: Optional[str] = Field("utf-8", description="文件编码")
    recursive: bool = Field(False, description="是否递归处理目录")
    overwrite: bool = Field(False, description="是否覆盖现有文件")
    create_directories: bool = Field(True, description="是否自动创建目录")
    
    @validator('target_path')
    def validate_target_path(cls, v, values):
        operation = values.get('operation')
        if operation in [FileOperationType.MOVE, FileOperationType.COPY, FileOperationType.RENAME]:
            if not v:
                raise ValueError(f"{operation} 操作需要指定目标路径")
        return v

class FileSearchCriteria(BaseModel):
    """文件搜索条件"""
    base_path: str = Field(..., description="搜索基础路径")
    name_pattern: Optional[str] = Field(None, description="文件名模式(支持通配符)")
    extension: Optional[str] = Field(None, description="文件扩展名")
    min_size: Optional[int] = Field(None, description="最小文件大小(字节)")
    max_size: Optional[int] = Field(None, description="最大文件大小(字节)")
    modified_after: Optional[datetime] = Field(None, description="修改时间晚于")
    modified_before: Optional[datetime] = Field(None, description="修改时间早于")
    content_pattern: Optional[str] = Field(None, description="文件内容包含")
    recursive: bool = Field(True, description="是否递归搜索子目录")
    max_results: int = Field(100, description="最大返回结果数")

class FileOperationResponse(BaseModel):
    """文件操作响应"""
    success: bool = Field(..., description="操作是否成功")
    operation: FileOperationType = Field(..., description="执行的操作类型")
    source_path: str = Field(..., description="源文件路径")
    target_path: Optional[str] = Field(None, description="目标路径")
    affected_files: List[FileInfo] = Field([], description="受影响的文件列表")
    content: Optional[str] = Field(None, description="文件内容(用于读取操作)")
    message: str = Field(..., description="操作结果描述")
    execution_time: float = Field(..., description="操作执行时间(秒)")
    error_details: Optional[str] = Field(None, description="错误详情")

# ============================================================================
# 应用程序控制模型
# ============================================================================

class ApplicationInfo(BaseModel):
    """应用程序信息"""
    app_id: str = Field(..., description="应用程序唯一标识")
    name: str = Field(..., description="应用程序名称")
    path: str = Field(..., description="应用程序路径")
    process_id: Optional[int] = Field(None, description="进程ID")
    state: ApplicationState = Field(..., description="应用程序状态")
    version: Optional[str] = Field(None, description="版本信息")
    icon_path: Optional[str] = Field(None, description="图标路径")
    description: Optional[str] = Field(None, description="应用程序描述")
    start_time: Optional[datetime] = Field(None, description="启动时间")
    cpu_usage: Optional[float] = Field(None, description="CPU使用率(%)")
    memory_usage: Optional[int] = Field(None, description="内存使用量(MB)")
    
    class Config:
        schema_extra = {
            "example": {
                "app_id": "app_chrome_12345",
                "name": "Google Chrome",
                "path": "/usr/bin/google-chrome",
                "process_id": 1234,
                "state": "running",
                "version": "120.0.6099.109",
                "start_time": "2024-01-01T10:00:00",
                "cpu_usage": 15.5,
                "memory_usage": 256
            }
        }

class ApplicationOperation(BaseModel):
    """应用程序操作"""
    operation: Literal["start", "stop", "restart", "kill", "suspend", "resume", "list"] = Field(..., description="操作类型")
    app_identifier: Optional[str] = Field(None, description="应用标识(名称、路径或进程ID)")
    app_path: Optional[str] = Field(None, description="应用程序路径")
    arguments: Optional[List[str]] = Field([], description="启动参数")
    working_directory: Optional[str] = Field(None, description="工作目录")
    environment: Optional[Dict[str, str]] = Field({}, description="环境变量")
    timeout: int = Field(30, description="操作超时时间(秒)")
    force: bool = Field(False, description="是否强制执行")
    
    @validator('app_identifier')
    def validate_app_identifier(cls, v, values):
        operation = values.get('operation')
        if operation in ['stop', 'restart', 'kill', 'suspend', 'resume'] and not v:
            raise ValueError(f"{operation} 操作需要指定应用程序标识")
        return v

class ApplicationOperationResponse(BaseModel):
    """应用程序操作响应"""
    success: bool = Field(..., description="操作是否成功")
    operation: str = Field(..., description="操作类型")
    app_info: Optional[ApplicationInfo] = Field(None, description="应用程序信息")
    applications: List[ApplicationInfo] = Field([], description="应用程序列表(用于list操作)")
    message: str = Field(..., description="操作结果描述")
    execution_time: float = Field(..., description="操作执行时间")
    error_details: Optional[str] = Field(None, description="错误详情")

# ============================================================================
# 系统交互模型
# ============================================================================

class ProcessInfo(BaseModel):
    """进程信息"""
    pid: int = Field(..., description="进程ID")
    name: str = Field(..., description="进程名称")
    executable: str = Field(..., description="可执行文件路径")
    command_line: str = Field(..., description="命令行")
    parent_pid: Optional[int] = Field(None, description="父进程ID")
    state: str = Field(..., description="进程状态")
    cpu_usage: float = Field(..., description="CPU使用率(%)")
    memory_usage: int = Field(..., description="内存使用量(MB)")
    start_time: datetime = Field(..., description="启动时间")
    user: Optional[str] = Field(None, description="运行用户")

class SystemOperation(BaseModel):
    """系统操作"""
    operation_type: SystemInteractionType = Field(..., description="操作类型")
    operation: str = Field(..., description="具体操作")
    target: Optional[str] = Field(None, description="操作目标")
    parameters: Dict[str, Any] = Field({}, description="操作参数")
    timeout: int = Field(60, description="操作超时时间(秒)")
    require_admin: bool = Field(False, description="是否需要管理员权限")

class SystemOperationResponse(BaseModel):
    """系统操作响应"""
    success: bool = Field(..., description="操作是否成功")
    operation_type: SystemInteractionType = Field(..., description="操作类型")
    operation: str = Field(..., description="具体操作")
    result: Optional[Any] = Field(None, description="操作结果")
    processes: List[ProcessInfo] = Field([], description="进程信息列表")
    message: str = Field(..., description="操作结果描述")
    execution_time: float = Field(..., description="操作执行时间")
    error_details: Optional[str] = Field(None, description="错误详情")

# ============================================================================
# 屏幕捕获模型
# ============================================================================

class ScreenRegion(BaseModel):
    """屏幕区域"""
    x: int = Field(..., description="起始X坐标")
    y: int = Field(..., description="起始Y坐标")
    width: int = Field(..., description="宽度")
    height: int = Field(..., description="高度")

class ScreenCaptureRequest(BaseModel):
    """屏幕捕获请求"""
    capture_type: ScreenCaptureType = Field(..., description="捕获类型")
    window_id: Optional[str] = Field(None, description="窗口ID(用于窗口捕获)")
    region: Optional[ScreenRegion] = Field(None, description="捕获区域(用于区域捕获)")
    element_selector: Optional[str] = Field(None, description="元素选择器(用于元素捕获)")
    output_format: Literal["png", "jpg", "bmp", "gif"] = Field("png", description="输出格式")
    quality: int = Field(95, description="图片质量(1-100)")
    include_cursor: bool = Field(True, description="是否包含鼠标光标")
    save_path: Optional[str] = Field(None, description="保存路径")
    
    @validator('region')
    def validate_region(cls, v, values):
        if values.get('capture_type') == ScreenCaptureType.REGION and not v:
            raise ValueError("区域捕获需要指定捕获区域")
        return v

class ScreenCaptureResponse(BaseModel):
    """屏幕捕获响应"""
    success: bool = Field(..., description="捕获是否成功")
    capture_type: ScreenCaptureType = Field(..., description="捕获类型")
    image_data: Optional[str] = Field(None, description="Base64编码的图片数据")
    image_path: Optional[str] = Field(None, description="保存的图片路径")
    image_size: Optional[Tuple[int, int]] = Field(None, description="图片尺寸(宽,高)")
    file_size: Optional[int] = Field(None, description="文件大小(字节)")
    message: str = Field(..., description="捕获结果描述")
    execution_time: float = Field(..., description="捕获执行时间")
    error_details: Optional[str] = Field(None, description="错误详情")

# ============================================================================
# 自动化操作模型
# ============================================================================

class MouseAction(BaseModel):
    """鼠标操作"""
    action_type: Literal["click", "double_click", "right_click", "drag", "move", "scroll"] = Field(..., description="操作类型")
    x: int = Field(..., description="X坐标")
    y: int = Field(..., description="Y坐标")
    button: Literal["left", "right", "middle"] = Field("left", description="鼠标按钮")
    clicks: int = Field(1, description="点击次数")
    delay: float = Field(0.1, description="操作延迟(秒)")
    # 拖拽操作的目标坐标
    target_x: Optional[int] = Field(None, description="拖拽目标X坐标")
    target_y: Optional[int] = Field(None, description="拖拽目标Y坐标")
    # 滚动操作的参数
    scroll_direction: Optional[Literal["up", "down", "left", "right"]] = Field(None, description="滚动方向")
    scroll_amount: Optional[int] = Field(3, description="滚动量")

class KeyboardAction(BaseModel):
    """键盘操作"""
    action_type: Literal["type", "key_press", "key_combination", "hotkey"] = Field(..., description="操作类型")
    text: Optional[str] = Field(None, description="输入文本")
    keys: Optional[List[str]] = Field(None, description="按键列表")
    modifiers: List[Literal["ctrl", "alt", "shift", "cmd", "win"]] = Field([], description="修饰键")
    delay: float = Field(0.05, description="按键间延迟(秒)")
    
    @validator('text')
    def validate_text_input(cls, v, values):
        if values.get('action_type') == 'type' and not v:
            raise ValueError("文本输入操作需要指定输入内容")
        return v

class AutomationSequence(BaseModel):
    """自动化操作序列"""
    sequence_id: str = Field(..., description="序列唯一标识")
    name: str = Field(..., description="序列名称")
    description: Optional[str] = Field(None, description="序列描述")
    mouse_actions: List[MouseAction] = Field([], description="鼠标操作列表")
    keyboard_actions: List[KeyboardAction] = Field([], description="键盘操作列表")
    mixed_actions: List[Dict[str, Any]] = Field([], description="混合操作列表(按执行顺序)")
    repeat_count: int = Field(1, description="重复执行次数")
    repeat_delay: float = Field(1.0, description="重复间隔(秒)")
    stop_on_error: bool = Field(True, description="遇到错误是否停止")

class AutomationExecutionRequest(BaseModel):
    """自动化执行请求"""
    automation_type: AutomationType = Field(..., description="自动化类型")
    mouse_action: Optional[MouseAction] = Field(None, description="鼠标操作")
    keyboard_action: Optional[KeyboardAction] = Field(None, description="键盘操作")
    sequence: Optional[AutomationSequence] = Field(None, description="操作序列")
    target_window: Optional[str] = Field(None, description="目标窗口ID")
    screenshot_before: bool = Field(False, description="执行前截图")
    screenshot_after: bool = Field(False, description="执行后截图")
    timeout: int = Field(30, description="执行超时时间(秒)")

class AutomationExecutionResponse(BaseModel):
    """自动化执行响应"""
    success: bool = Field(..., description="执行是否成功")
    automation_type: AutomationType = Field(..., description="自动化类型")
    executed_actions: List[Dict[str, Any]] = Field([], description="已执行的操作列表")
    failed_actions: List[Dict[str, Any]] = Field([], description="失败的操作列表")
    screenshot_before: Optional[str] = Field(None, description="执行前截图(Base64)")
    screenshot_after: Optional[str] = Field(None, description="执行后截图(Base64)")
    message: str = Field(..., description="执行结果描述")
    execution_time: float = Field(..., description="执行时间(秒)")
    error_details: Optional[str] = Field(None, description="错误详情")

# ============================================================================
# 适配器集成模型
# ============================================================================

class AdapterConfig(BaseModel):
    """适配器配置"""
    adapter_id: str = Field(..., description="适配器唯一标识")
    adapter_type: AdapterType = Field(..., description="适配器类型")
    name: str = Field(..., description="适配器名称")
    version: str = Field(..., description="适配器版本")
    description: Optional[str] = Field(None, description="适配器描述")
    enabled: bool = Field(True, description="是否启用")
    priority: int = Field(100, description="优先级(数值越大优先级越高)")
    permissions: List[PermissionLevel] = Field([], description="所需权限列表")
    supported_operations: List[DesktopOperationType] = Field([], description="支持的操作类型")
    configuration: Dict[str, Any] = Field({}, description="适配器特定配置")
    metadata: Dict[str, Any] = Field({}, description="元数据")

class AdapterExecutionContext(BaseModel):
    """适配器执行上下文"""
    session_id: str = Field(..., description="会话ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    workspace_path: Optional[str] = Field(None, description="工作空间路径")
    environment_variables: Dict[str, str] = Field({}, description="环境变量")
    security_context: Dict[str, Any] = Field({}, description="安全上下文")
    execution_timeout: int = Field(300, description="执行超时时间(秒)")
    max_memory: Optional[int] = Field(None, description="最大内存使用(MB)")
    debug_mode: bool = Field(False, description="调试模式")

class DesktopAdapterRequest(BaseModel):
    """桌面适配器执行请求"""
    adapter_id: str = Field(..., description="适配器ID")
    operation_type: DesktopOperationType = Field(..., description="操作类型")
    operation_data: Dict[str, Any] = Field({}, description="操作数据")
    context: AdapterExecutionContext = Field(..., description="执行上下文")
    validation_rules: List[str] = Field([], description="验证规则")
    rollback_enabled: bool = Field(True, description="是否启用回滚")
    async_execution: bool = Field(False, description="是否异步执行")

class DesktopAdapterResponse(BaseModel):
    """桌面适配器执行响应"""
    success: bool = Field(..., description="执行是否成功")
    adapter_id: str = Field(..., description="适配器ID")
    operation_type: DesktopOperationType = Field(..., description="操作类型")
    result: Dict[str, Any] = Field({}, description="执行结果")
    artifacts: List[str] = Field([], description="生成的文件或资源列表")
    logs: List[str] = Field([], description="执行日志")
    metrics: Dict[str, float] = Field({}, description="性能指标")
    execution_time: float = Field(..., description="执行时间(秒)")
    memory_usage: Optional[float] = Field(None, description="内存使用(MB)")
    warnings: List[str] = Field([], description="警告信息")
    error_details: Optional[str] = Field(None, description="错误详情")

# ============================================================================
# 权限和安全模型
# ============================================================================

class SecurityPolicy(BaseModel):
    """安全策略"""
    policy_id: str = Field(..., description="策略ID")
    name: str = Field(..., description="策略名称")
    description: Optional[str] = Field(None, description="策略描述")
    allowed_operations: List[DesktopOperationType] = Field([], description="允许的操作类型")
    blocked_paths: List[str] = Field([], description="禁止访问的路径")
    allowed_paths: List[str] = Field([], description="允许访问的路径")
    max_file_size: Optional[int] = Field(None, description="最大文件大小(MB)")
    max_execution_time: int = Field(300, description="最大执行时间(秒)")
    require_confirmation: bool = Field(False, description="是否需要用户确认")
    audit_required: bool = Field(True, description="是否需要审计")

class PermissionRequest(BaseModel):
    """权限请求"""
    resource: str = Field(..., description="资源标识")
    action: str = Field(..., description="操作类型")
    context: Dict[str, Any] = Field({}, description="操作上下文")
    justification: Optional[str] = Field(None, description="权限申请理由")

class PermissionResponse(BaseModel):
    """权限响应"""
    granted: bool = Field(..., description="是否授权")
    reason: Optional[str] = Field(None, description="拒绝理由")
    conditions: List[str] = Field([], description="授权条件")
    expires_at: Optional[datetime] = Field(None, description="权限过期时间")

# ============================================================================
# 统一桌面操作接口
# ============================================================================

class UnifiedDesktopRequest(BaseModel):
    """统一桌面操作请求"""
    request_id: str = Field(..., description="请求ID")
    operation_type: DesktopOperationType = Field(..., description="操作类型")
    
    # 窗口操作相关
    window_operation: Optional[WindowOperation] = Field(None, description="窗口操作")
    
    # 文件操作相关
    file_operation: Optional[FileOperation] = Field(None, description="文件操作")
    file_search: Optional[FileSearchCriteria] = Field(None, description="文件搜索")
    
    # 应用程序操作相关
    application_operation: Optional[ApplicationOperation] = Field(None, description="应用程序操作")
    
    # 系统操作相关
    system_operation: Optional[SystemOperation] = Field(None, description="系统操作")
    
    # 屏幕捕获相关
    screen_capture: Optional[ScreenCaptureRequest] = Field(None, description="屏幕捕获")
    
    # 自动化操作相关
    automation_execution: Optional[AutomationExecutionRequest] = Field(None, description="自动化执行")
    
    # 适配器执行相关
    adapter_request: Optional[DesktopAdapterRequest] = Field(None, description="适配器请求")
    
    # 通用配置
    execution_options: Dict[str, Any] = Field({}, description="执行选项")
    callback_url: Optional[str] = Field(None, description="回调URL")

class UnifiedDesktopResponse(BaseModel):
    """统一桌面操作响应"""
    request_id: str = Field(..., description="请求ID")
    success: bool = Field(..., description="操作是否成功")
    operation_type: DesktopOperationType = Field(..., description="操作类型")
    
    # 各类型操作的响应
    window_response: Optional[WindowOperationResponse] = Field(None, description="窗口操作响应")
    file_response: Optional[FileOperationResponse] = Field(None, description="文件操作响应")
    application_response: Optional[ApplicationOperationResponse] = Field(None, description="应用程序操作响应")
    system_response: Optional[SystemOperationResponse] = Field(None, description="系统操作响应")
    screen_capture_response: Optional[ScreenCaptureResponse] = Field(None, description="屏幕捕获响应")
    automation_response: Optional[AutomationExecutionResponse] = Field(None, description="自动化执行响应")
    adapter_response: Optional[DesktopAdapterResponse] = Field(None, description="适配器响应")
    
    # 通用响应信息
    message: str = Field(..., description="响应消息")
    execution_time: float = Field(..., description="执行时间(秒)")
    timestamp: datetime = Field(..., description="响应时间戳")
    warnings: List[str] = Field([], description="警告信息")
    error_details: Optional[str] = Field(None, description="错误详情")

# ============================================================================
# 模型导出和工厂类
# ============================================================================

class DesktopModelFactory:
    """桌面模型工厂类"""
    
    @staticmethod
    def create_operation_request(operation_type: DesktopOperationType, **kwargs) -> UnifiedDesktopRequest:
        """创建操作请求"""
        request_data = {
            "request_id": kwargs.get("request_id", f"req_{operation_type.value}_{int(datetime.now().timestamp())}"),
            "operation_type": operation_type,
            "execution_options": kwargs.get("execution_options", {})
        }
        
        # 根据操作类型设置相应的操作数据
        if operation_type == DesktopOperationType.WINDOW_MANAGEMENT:
            if "window_operation" in kwargs:
                request_data["window_operation"] = kwargs["window_operation"]
        elif operation_type == DesktopOperationType.FILE_OPERATION:
            if "file_operation" in kwargs:
                request_data["file_operation"] = kwargs["file_operation"]
            if "file_search" in kwargs:
                request_data["file_search"] = kwargs["file_search"]
        elif operation_type == DesktopOperationType.APPLICATION_CONTROL:
            if "application_operation" in kwargs:
                request_data["application_operation"] = kwargs["application_operation"]
        elif operation_type == DesktopOperationType.SYSTEM_INTERACTION:
            if "system_operation" in kwargs:
                request_data["system_operation"] = kwargs["system_operation"]
        elif operation_type == DesktopOperationType.SCREEN_CAPTURE:
            if "screen_capture" in kwargs:
                request_data["screen_capture"] = kwargs["screen_capture"]
        elif operation_type == DesktopOperationType.AUTOMATION:
            if "automation_execution" in kwargs:
                request_data["automation_execution"] = kwargs["automation_execution"]
        
        return UnifiedDesktopRequest(**request_data)
    
    @staticmethod
    def create_adapter_config(adapter_type: AdapterType, **kwargs) -> AdapterConfig:
        """创建适配器配置"""
        return AdapterConfig(
            adapter_type=adapter_type,
            **kwargs
        )

# 导出所有模型类
__all__ = [
    # 枚举类型
    "DesktopOperationType", "WindowState", "FileOperationType", "AdapterType",
    "ApplicationState", "SystemInteractionType", "ScreenCaptureType", 
    "AutomationType", "PermissionLevel",
    
    # 窗口管理模型
    "WindowInfo", "WindowOperation", "WindowOperationResponse",
    
    # 文件操作模型
    "FileInfo", "FileOperation", "FileSearchCriteria", "FileOperationResponse",
    
    # 应用程序控制模型
    "ApplicationInfo", "ApplicationOperation", "ApplicationOperationResponse",
    
    # 系统交互模型
    "ProcessInfo", "SystemOperation", "SystemOperationResponse",
    
    # 屏幕捕获模型
    "ScreenRegion", "ScreenCaptureRequest", "ScreenCaptureResponse",
    
    # 自动化操作模型
    "MouseAction", "KeyboardAction", "AutomationSequence", 
    "AutomationExecutionRequest", "AutomationExecutionResponse",
    
    # 适配器集成模型
    "AdapterConfig", "AdapterExecutionContext", 
    "DesktopAdapterRequest", "DesktopAdapterResponse",
    
    # 权限和安全模型
    "SecurityPolicy", "PermissionRequest", "PermissionResponse",
    
    # 统一接口模型
    "UnifiedDesktopRequest", "UnifiedDesktopResponse",
    
    # 工厂类
    "DesktopModelFactory"
]
