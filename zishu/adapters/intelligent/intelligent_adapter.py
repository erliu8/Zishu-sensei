"""
智能硬适配器基类
提供智能代码生成、安全执行和持续学习能力的硬适配器基础框架
"""

import os
import sys
import json
import asyncio
import logging
import threading
import traceback
import uuid
import time
import hashlib
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union, Callable, Type, Iterator
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import weakref
from collections import defaultdict, deque

# 本地导入
from ..base.exceptions import (
    BaseAdapterException, AdapterExecutionError, AdapterValidationError,
    AdapterConfigurationError, ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)
from ..base.metadata import (
    AdapterMetadata, AdapterCapability, CapabilityCategory, AdapterType,
    AdapterStatus, SecurityLevel
)
from ..core.security import SecurityManager
from ..security.audit import get_audit_logger, AuditEventType, AuditLevel, audit_operation
from .safe_executor import SafeCodeExecutor, ExecutionResult, ExecutionEnvironment, SecurityLevel as ExecSecurityLevel
from .code_generator import IntelligentCodeGenerator, CodeGenerationRequest, GenerationResult
from .learning_engine import ContinuousLearningEngine, LearningMode, ModelType

# 可选导入
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# 配置日志
logger = logging.getLogger(__name__)


# ================================
# 核心枚举和常量定义
# ================================

class AdapterMode(Enum):
    """适配器工作模式"""
    MANUAL = "manual"                    # 手动模式：需要明确指令
    SEMI_AUTOMATIC = "semi_automatic"    # 半自动：智能建议+用户确认
    AUTOMATIC = "automatic"              # 自动模式：完全智能决策
    LEARNING = "learning"                # 学习模式：边学习边适配


class TaskPriority(Enum):
    """任务优先级"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    URGENT = 4
    CRITICAL = 5


class AdapterCapabilityLevel(Enum):
    """适配器能力等级"""
    BASIC = "basic"          # 基础：简单代码生成和执行
    INTERMEDIATE = "intermediate"  # 中级：复杂逻辑处理
    ADVANCED = "advanced"    # 高级：智能推理和优化
    EXPERT = "expert"        # 专家级：自主学习和创新


# ================================
# 核心数据结构
# ================================

@dataclass
class AdapterConfiguration:
    """适配器配置"""
    # 基础配置
    name: str
    version: str = "1.0.0"
    description: str = ""
    
    # 工作模式配置
    mode: AdapterMode = AdapterMode.SEMI_AUTOMATIC
    capability_level: AdapterCapabilityLevel = AdapterCapabilityLevel.INTERMEDIATE
    
    # 安全配置
    security_level: SecurityLevel = SecurityLevel.INTERNAL
    execution_security: ExecSecurityLevel = ExecSecurityLevel.STANDARD
    execution_environment: ExecutionEnvironment = ExecutionEnvironment.SANDBOX
    
    # 性能配置
    max_concurrent_tasks: int = 5
    task_timeout: int = 300  # 秒
    max_memory_usage: int = 1024 * 1024 * 1024  # 1GB
    
    # 学习配置
    learning_enabled: bool = True
    learning_mode: LearningMode = LearningMode.INCREMENTAL
    model_update_interval: int = 3600  # 秒
    
    # 日志和监控
    log_level: str = "INFO"
    audit_enabled: bool = True
    metrics_enabled: bool = True
    
    # 扩展配置
    custom_settings: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskContext:
    """任务执行上下文"""
    task_id: str
    task_type: str
    priority: TaskPriority
    created_at: datetime
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    parent_task_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AdapterMetrics:
    """适配器性能指标"""
    # 执行统计
    total_tasks: int = 0
    successful_tasks: int = 0
    failed_tasks: int = 0
    average_execution_time: float = 0.0
    
    # 资源使用
    current_memory_usage: int = 0
    peak_memory_usage: int = 0
    cpu_usage_percent: float = 0.0
    
    # 学习统计
    learning_iterations: int = 0
    model_accuracy: float = 0.0
    last_model_update: Optional[datetime] = None
    
    # 时间戳
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ================================
# 智能硬适配器基类
# ================================

class IntelligentHardAdapter(ABC):
    """
    智能硬适配器基类
    
    提供以下核心功能：
    1. 智能代码生成和执行
    2. 持续学习和自我优化
    3. 安全沙盒执行环境
    4. 任务调度和资源管理
    5. 监控、审计和错误处理
    """
    
    def __init__(
        self,
        config: AdapterConfiguration,
        metadata: Optional[AdapterMetadata] = None
    ):
        """初始化智能硬适配器"""
        self._config = config
        self._metadata = metadata or self._create_default_metadata()
        self._adapter_id = str(uuid.uuid4())
        self._status = AdapterStatus.REGISTERED
        
        # 初始化核心组件
        self._executor = None
        self._code_generator = None
        self._learning_engine = None
        
        # 初始化状态管理
        self._tasks = {}  # 活跃任务
        self._task_queue = deque()  # 任务队列
        self._metrics = AdapterMetrics()
        
        # 初始化线程和锁
        self._lock = threading.RLock()
        self._executor_pool = None
        self._shutdown_event = threading.Event()
        
        # 初始化日志和审计
        self._setup_logging()
        self._audit_logger = get_audit_logger()
        
        logger.info(f"智能硬适配器初始化完成: {self._adapter_id}")
    
    @property
    def adapter_id(self) -> str:
        """获取适配器ID"""
        return self._adapter_id
    
    @property
    def config(self) -> AdapterConfiguration:
        """获取配置"""
        return self._config
    
    @property
    def metadata(self) -> AdapterMetadata:
        """获取元数据"""
        return self._metadata
    
    @property
    def status(self) -> AdapterStatus:
        """获取状态"""
        return self._status
    
    @property
    def metrics(self) -> AdapterMetrics:
        """获取性能指标"""
        with self._lock:
            return AdapterMetrics(**asdict(self._metrics))
    
    def _create_default_metadata(self) -> AdapterMetadata:
        """创建默认元数据"""
        return AdapterMetadata(
            name=self._config.name,
            version=self._config.version,
            description=self._config.description or "智能硬适配器",
            adapter_type=AdapterType.INTELLIGENT,
            capabilities=[
                AdapterCapability(
                    name="code_generation",
                    category=CapabilityCategory.CODE_GENERATION,
                    description="智能代码生成"
                ),
                AdapterCapability(
                    name="safe_execution",
                    category=CapabilityCategory.SYSTEM_CONTROL,
                    description="安全代码执行"
                ),
                AdapterCapability(
                    name="continuous_learning",
                    category=CapabilityCategory.MACHINE_LEARNING,
                    description="持续学习优化"
                )
            ],
            security_level=self._config.security_level
        )
    
    def _setup_logging(self):
        """设置日志"""
        log_level = getattr(logging, self._config.log_level.upper(), logging.INFO)
        logger.setLevel(log_level)
        
        # 添加适配器特定的日志格式
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                f'%(asctime)s - {self._adapter_id[:8]} - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
    
    # ================================
    # 生命周期管理方法
    # ================================
    
    async def initialize(self) -> None:
        """初始化适配器组件"""
        try:
            with self._lock:
                if self._status != AdapterStatus.REGISTERED:
                    raise AdapterConfigurationError(
                        f"适配器状态错误，无法初始化: {self._status}",
                        ErrorCode.INITIALIZATION_ERROR
                    )
                
                self._status = AdapterStatus.LOADING
            
            logger.info(f"开始初始化适配器组件: {self._adapter_id}")
            
            # 初始化线程池
            self._executor_pool = ThreadPoolExecutor(
                max_workers=self._config.max_concurrent_tasks,
                thread_name_prefix=f"adapter-{self._adapter_id[:8]}"
            )
            
            # 初始化核心组件
            await self._initialize_components()
            
            # 启动后台任务
            await self._start_background_tasks()
            
            with self._lock:
                self._status = AdapterStatus.LOADED
            
            logger.info(f"适配器初始化完成: {self._adapter_id}")
            
            if self._config.audit_enabled:
                self._audit_logger.info(
                    "适配器初始化完成",
                    extra={
                        "adapter_id": self._adapter_id,
                        "event_type": AuditEventType.ADAPTER_LIFECYCLE,
                        "level": AuditLevel.INFO
                    }
                )
        
        except Exception as e:
            with self._lock:
                self._status = AdapterStatus.ERROR
            logger.error(f"适配器初始化失败: {e}", exc_info=True)
            raise AdapterConfigurationError(
                f"适配器初始化失败: {str(e)}",
                ErrorCode.INITIALIZATION_ERROR,
                ExceptionSeverity.HIGH
            ) from e
    
    async def _initialize_components(self) -> None:
        """初始化核心组件"""
        # 初始化安全执行器
        self._executor = SafeCodeExecutor(
            security_level=self._config.execution_security,
            environment=self._config.execution_environment,
            timeout=self._config.task_timeout,
            memory_limit=self._config.max_memory_usage
        )
        await self._executor.initialize()
        
        # 初始化代码生成器
        self._code_generator = IntelligentCodeGenerator(
            capability_level=self._config.capability_level
        )
        await self._code_generator.initialize()
        
        # 初始化学习引擎（如果启用）
        if self._config.learning_enabled:
            self._learning_engine = ContinuousLearningEngine(
                mode=self._config.learning_mode,
                update_interval=self._config.model_update_interval
            )
            await self._learning_engine.initialize()
    
    async def _start_background_tasks(self) -> None:
        """启动后台任务"""
        # 启动任务处理循环
        asyncio.create_task(self._task_processing_loop())
        
        # 启动指标更新任务
        if self._config.metrics_enabled:
            asyncio.create_task(self._metrics_update_loop())
        
        # 启动学习引擎（如果启用）
        if self._config.learning_enabled and self._learning_engine:
            asyncio.create_task(self._learning_loop())
    
    async def shutdown(self) -> None:
        """关闭适配器"""
        try:
            logger.info(f"开始关闭适配器: {self._adapter_id}")
            
            # 设置关闭标志
            self._shutdown_event.set()
            
            # 等待所有任务完成
            await self._wait_for_tasks_completion()
            
            # 关闭核心组件
            await self._shutdown_components()
            
            # 关闭线程池
            if self._executor_pool:
                self._executor_pool.shutdown(wait=True)
            
            with self._lock:
                self._status = AdapterStatus.UNREGISTERED
            
            logger.info(f"适配器关闭完成: {self._adapter_id}")
            
        except Exception as e:
            logger.error(f"适配器关闭时发生错误: {e}", exc_info=True)
    
    async def _shutdown_components(self) -> None:
        """关闭核心组件"""
        if self._executor:
            await self._executor.shutdown()
        
        if self._code_generator:
            await self._code_generator.shutdown()
        
        if self._learning_engine:
            await self._learning_engine.shutdown()
    
    async def _wait_for_tasks_completion(self, timeout: int = 30) -> None:
        """等待所有任务完成"""
        start_time = time.time()
        while self._tasks and (time.time() - start_time) < timeout:
            await asyncio.sleep(0.1)
        
        if self._tasks:
            logger.warning(f"关闭时仍有 {len(self._tasks)} 个任务未完成")
    
    # ================================
    # 核心执行方法
    # ================================
    
    async def execute_task(
        self,
        task_request: Dict[str, Any],
        context: Optional[TaskContext] = None
    ) -> Dict[str, Any]:
        """
        执行任务的主要入口点
        
        Args:
            task_request: 任务请求，包含任务类型、参数等
            context: 任务上下文信息
            
        Returns:
            任务执行结果
        """
        task_id = str(uuid.uuid4())
        start_time = time.time()
        
        try:
            # 创建任务上下文
            if context is None:
                context = TaskContext(
                    task_id=task_id,
                    task_type=task_request.get('type', 'unknown'),
                    priority=TaskPriority(task_request.get('priority', TaskPriority.MEDIUM.value)),
                    created_at=datetime.now(timezone.utc)
                )
            
            # 验证任务请求
            await self._validate_task_request(task_request, context)
            
            # 记录任务开始
            with self._lock:
                self._tasks[task_id] = context
                self._metrics.total_tasks += 1
            
            logger.info(f"开始执行任务: {task_id} - {context.task_type}")
            
            # 执行任务
            result = await self._execute_task_internal(task_request, context)
            
            # 记录成功
            with self._lock:
                self._metrics.successful_tasks += 1
                execution_time = time.time() - start_time
                self._update_average_execution_time(execution_time)
            
            logger.info(f"任务执行完成: {task_id} - 耗时: {execution_time:.2f}s")
            
            return {
                'task_id': task_id,
                'status': 'success',
                'result': result,
                'execution_time': execution_time,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            # 记录失败
            with self._lock:
                self._metrics.failed_tasks += 1
            
            logger.error(f"任务执行失败: {task_id} - {str(e)}", exc_info=True)
            
            # 审计日志
            if self._config.audit_enabled:
                self._audit_logger.error(
                    f"任务执行失败: {str(e)}",
                    extra={
                        "adapter_id": self._adapter_id,
                        "task_id": task_id,
                        "event_type": AuditEventType.TASK_EXECUTION,
                        "level": AuditLevel.ERROR
                    }
                )
            
            return {
                'task_id': task_id,
                'status': 'error',
                'error': str(e),
                'error_type': type(e).__name__,
                'execution_time': time.time() - start_time,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        finally:
            # 清理任务记录
            with self._lock:
                self._tasks.pop(task_id, None)
    
    async def _execute_task_internal(
        self,
        task_request: Dict[str, Any],
        context: TaskContext
    ) -> Any:
        """内部任务执行逻辑"""
        task_type = task_request.get('type')
        
        if task_type == 'code_generation':
            return await self._handle_code_generation(task_request, context)
        elif task_type == 'code_execution':
            return await self._handle_code_execution(task_request, context)
        elif task_type == 'intelligent_adaptation':
            return await self._handle_intelligent_adaptation(task_request, context)
        elif task_type == 'learning_task':
            return await self._handle_learning_task(task_request, context)
        else:
            # 调用子类实现的自定义任务处理
            return await self.handle_custom_task(task_request, context)
    
    @abstractmethod
    async def handle_custom_task(
        self,
        task_request: Dict[str, Any],
        context: TaskContext
    ) -> Any:
        """
        处理自定义任务类型
        
        子类必须实现此方法来处理特定的任务类型
        """
        pass
    
    async def _validate_task_request(
        self,
        task_request: Dict[str, Any],
        context: TaskContext
    ) -> None:
        """验证任务请求"""
        if not isinstance(task_request, dict):
            raise AdapterValidationError(
                "任务请求必须是字典类型",
                ErrorCode.ADAPTER_INPUT_INVALID
            )
        
        if 'type' not in task_request:
            raise AdapterValidationError(
                "任务请求缺少类型字段",
                ErrorCode.ADAPTER_INPUT_INVALID
            )
        
        # 检查适配器状态
        if self._status not in [AdapterStatus.LOADED, AdapterStatus.RUNNING]:
            raise AdapterExecutionError(
                f"适配器状态不正确，无法执行任务: {self._status}",
                ErrorCode.ADAPTER_EXECUTION_FAILED
            )
        
        # 检查并发限制
        with self._lock:
            if len(self._tasks) >= self._config.max_concurrent_tasks:
                raise AdapterExecutionError(
                    f"已达到最大并发任务数限制: {self._config.max_concurrent_tasks}",
                    ErrorCode.RESOURCE_EXHAUSTED
                )
    
    def _update_average_execution_time(self, execution_time: float) -> None:
        """更新平均执行时间"""
        if self._metrics.successful_tasks == 1:
            self._metrics.average_execution_time = execution_time
        else:
            # 使用移动平均算法
            alpha = 0.1  # 平滑因子
            self._metrics.average_execution_time = (
                alpha * execution_time + 
                (1 - alpha) * self._metrics.average_execution_time
            )
    
    # ================================
    # 具体任务处理方法
    # ================================
    
    async def _handle_code_generation(
        self,
        task_request: Dict[str, Any],
        context: TaskContext
    ) -> Dict[str, Any]:
        """处理代码生成任务"""
        try:
            generation_request = CodeGenerationRequest(
                description=task_request.get('description', ''),
                language=task_request.get('language', 'python'),
                context=task_request.get('context', {}),
                requirements=task_request.get('requirements', []),
                constraints=task_request.get('constraints', {}),
                examples=task_request.get('examples', [])
            )
            
            logger.info(f"开始代码生成: {context.task_id}")
            
            # 调用代码生成器
            result = await self._code_generator.generate_code(generation_request)
            
            # 如果启用学习，记录生成结果用于后续优化
            if self._config.learning_enabled and self._learning_engine:
                await self._learning_engine.record_generation_result(
                    generation_request, result
                )
            
            return {
                'generated_code': result.code,
                'language': result.language,
                'confidence': result.confidence,
                'explanation': result.explanation,
                'dependencies': result.dependencies,
                'metadata': result.metadata
            }
            
        except Exception as e:
            logger.error(f"代码生成失败: {str(e)}", exc_info=True)
            raise AdapterExecutionError(
                f"代码生成失败: {str(e)}",
                ErrorCode.CODE_GENERATION_FAILED,
                ExceptionSeverity.MEDIUM
            ) from e
    
    async def _handle_code_execution(
        self,
        task_request: Dict[str, Any],
        context: TaskContext
    ) -> Dict[str, Any]:
        """处理代码执行任务"""
        try:
            code = task_request.get('code')
            if not code:
                raise AdapterValidationError(
                    "代码执行任务缺少代码内容",
                    ErrorCode.ADAPTER_INPUT_INVALID
                )
            
            language = task_request.get('language', 'python')
            inputs = task_request.get('inputs', {})
            environment_vars = task_request.get('environment', {})
            
            logger.info(f"开始执行代码: {context.task_id}")
            
            # 调用安全执行器
            result = await self._executor.execute_code(
                code=code,
                language=language,
                inputs=inputs,
                environment=environment_vars,
                context=context.metadata
            )
            
            # 记录执行结果用于学习
            if self._config.learning_enabled and self._learning_engine:
                await self._learning_engine.record_execution_result(
                    code, result, context
                )
            
            return {
                'output': result.output,
                'error_output': result.error_output,
                'return_code': result.return_code,
                'execution_time': result.execution_time,
                'memory_usage': result.memory_usage,
                'success': result.success,
                'metadata': result.metadata
            }
            
        except Exception as e:
            logger.error(f"代码执行失败: {str(e)}", exc_info=True)
            raise AdapterExecutionError(
                f"代码执行失败: {str(e)}",
                ErrorCode.CODE_EXECUTION_FAILED,
                ExceptionSeverity.MEDIUM
            ) from e
    
    async def _handle_intelligent_adaptation(
        self,
        task_request: Dict[str, Any],
        context: TaskContext
    ) -> Dict[str, Any]:
        """处理智能适配任务"""
        try:
            problem_description = task_request.get('problem')
            if not problem_description:
                raise AdapterValidationError(
                    "智能适配任务缺少问题描述",
                    ErrorCode.ADAPTER_INPUT_INVALID
                )
            
            target_environment = task_request.get('target_environment', {})
            constraints = task_request.get('constraints', {})
            preferences = task_request.get('preferences', {})
            
            logger.info(f"开始智能适配: {context.task_id}")
            
            # 分析问题并生成解决方案
            analysis_result = await self._analyze_problem(
                problem_description, target_environment, constraints
            )
            
            # 生成适配代码
            adaptation_code = await self._generate_adaptation_code(
                analysis_result, preferences
            )
            
            # 验证适配代码
            validation_result = await self._validate_adaptation(
                adaptation_code, target_environment
            )
            
            # 如果需要，执行适配代码
            execution_result = None
            if task_request.get('execute', False):
                execution_result = await self._executor.execute_code(
                    code=adaptation_code['code'],
                    language=adaptation_code['language'],
                    inputs=task_request.get('inputs', {}),
                    environment=target_environment,
                    context=context.metadata
                )
            
            return {
                'analysis': analysis_result,
                'adaptation_code': adaptation_code,
                'validation': validation_result,
                'execution_result': execution_result,
                'recommendations': await self._generate_recommendations(
                    analysis_result, validation_result
                )
            }
            
        except Exception as e:
            logger.error(f"智能适配失败: {str(e)}", exc_info=True)
            raise AdapterExecutionError(
                f"智能适配失败: {str(e)}",
                ErrorCode.ADAPTER_EXECUTION_FAILED,
                ExceptionSeverity.HIGH
            ) from e
    
    async def _handle_learning_task(
        self,
        task_request: Dict[str, Any],
        context: TaskContext
    ) -> Dict[str, Any]:
        """处理学习任务"""
        if not self._config.learning_enabled or not self._learning_engine:
            raise AdapterConfigurationError(
                "学习功能未启用",
                ErrorCode.LEARNING_ENGINE_ERROR
            )
        
        try:
            learning_type = task_request.get('learning_type', 'incremental')
            training_data = task_request.get('training_data', [])
            learning_parameters = task_request.get('parameters', {})
            
            logger.info(f"开始学习任务: {context.task_id} - {learning_type}")
            
            # 执行学习任务
            result = await self._learning_engine.learn(
                learning_type=learning_type,
                training_data=training_data,
                parameters=learning_parameters,
                context=context
            )
            
            # 更新指标
            with self._lock:
                self._metrics.learning_iterations += 1
                self._metrics.model_accuracy = result.get('accuracy', 0.0)
                self._metrics.last_model_update = datetime.now(timezone.utc)
            
            return {
                'learning_type': learning_type,
                'training_samples': len(training_data),
                'accuracy': result.get('accuracy'),
                'loss': result.get('loss'),
                'iterations': result.get('iterations'),
                'model_version': result.get('model_version'),
                'metadata': result.get('metadata', {})
            }
            
        except Exception as e:
            logger.error(f"学习任务失败: {str(e)}", exc_info=True)
            raise AdapterExecutionError(
                f"学习任务失败: {str(e)}",
                ErrorCode.LEARNING_ENGINE_ERROR,
                ExceptionSeverity.MEDIUM
            ) from e
    
    # ================================
    # 智能适配辅助方法
    # ================================
    
    async def _analyze_problem(
        self,
        problem_description: str,
        target_environment: Dict[str, Any],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """分析问题并生成解决策略"""
        # 这里可以集成更复杂的问题分析逻辑
        # 包括NLP处理、模式识别、历史案例匹配等
        
        analysis = {
            'problem_type': await self._classify_problem(problem_description),
            'complexity_level': await self._assess_complexity(problem_description),
            'required_capabilities': await self._identify_capabilities(problem_description),
            'environment_compatibility': await self._check_environment_compatibility(
                target_environment
            ),
            'constraint_analysis': await self._analyze_constraints(constraints),
            'similar_cases': await self._find_similar_cases(problem_description)
        }
        
        return analysis
    
    async def _generate_adaptation_code(
        self,
        analysis: Dict[str, Any],
        preferences: Dict[str, Any]
    ) -> Dict[str, Any]:
        """基于分析结果生成适配代码"""
        # 构建代码生成请求
        generation_request = CodeGenerationRequest(
            description=f"解决问题: {analysis['problem_type']}",
            language=preferences.get('language', 'python'),
            context={
                'analysis': analysis,
                'preferences': preferences
            },
            requirements=analysis.get('required_capabilities', []),
            constraints=analysis.get('constraint_analysis', {}),
            examples=analysis.get('similar_cases', [])
        )
        
        # 生成代码
        result = await self._code_generator.generate_code(generation_request)
        
        return {
            'code': result.code,
            'language': result.language,
            'explanation': result.explanation,
            'dependencies': result.dependencies,
            'confidence': result.confidence
        }
    
    async def _validate_adaptation(
        self,
        adaptation_code: Dict[str, Any],
        target_environment: Dict[str, Any]
    ) -> Dict[str, Any]:
        """验证适配代码的正确性和安全性"""
        validation_result = {
            'syntax_valid': False,
            'security_check': False,
            'compatibility_check': False,
            'performance_estimate': {},
            'warnings': [],
            'recommendations': []
        }
        
        try:
            # 语法检查
            validation_result['syntax_valid'] = await self._check_syntax(
                adaptation_code['code'], adaptation_code['language']
            )
            
            # 安全检查
            validation_result['security_check'] = await self._check_security(
                adaptation_code['code']
            )
            
            # 兼容性检查
            validation_result['compatibility_check'] = await self._check_compatibility(
                adaptation_code, target_environment
            )
            
            # 性能评估
            validation_result['performance_estimate'] = await self._estimate_performance(
                adaptation_code['code']
            )
            
        except Exception as e:
            validation_result['warnings'].append(f"验证过程出错: {str(e)}")
        
        return validation_result
    
    async def _generate_recommendations(
        self,
        analysis: Dict[str, Any],
        validation: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """生成改进建议"""
        recommendations = []
        
        # 基于分析结果的建议
        if analysis.get('complexity_level', 0) > 0.8:
            recommendations.append({
                'type': 'complexity',
                'level': 'warning',
                'message': '问题复杂度较高，建议分步骤实施',
                'actions': ['分解任务', '增加测试', '逐步部署']
            })
        
        # 基于验证结果的建议
        if not validation.get('security_check', True):
            recommendations.append({
                'type': 'security',
                'level': 'error',
                'message': '代码存在安全风险',
                'actions': ['安全审查', '权限限制', '沙盒执行']
            })
        
        return recommendations
    
    # ================================
    # 后台任务和监控循环
    # ================================
    
    async def _task_processing_loop(self) -> None:
        """任务处理循环"""
        logger.info("任务处理循环已启动")
        
        while not self._shutdown_event.is_set():
            try:
                # 处理队列中的任务
                if self._task_queue:
                    with self._lock:
                        if len(self._tasks) < self._config.max_concurrent_tasks and self._task_queue:
                            task_info = self._task_queue.popleft()
                            # 这里可以添加任务优先级排序逻辑
                    
                    if 'task_info' in locals():
                        # 异步执行任务
                        asyncio.create_task(
                            self._process_queued_task(task_info)
                        )
                
                await asyncio.sleep(0.1)  # 避免忙等待
                
            except Exception as e:
                logger.error(f"任务处理循环出错: {e}", exc_info=True)
                await asyncio.sleep(1)  # 错误时稍长的等待
    
    async def _process_queued_task(self, task_info: Dict[str, Any]) -> None:
        """处理队列中的任务"""
        try:
            result = await self.execute_task(
                task_info['request'],
                task_info.get('context')
            )
            
            # 如果有回调函数，调用它
            if 'callback' in task_info:
                await task_info['callback'](result)
                
        except Exception as e:
            logger.error(f"队列任务处理失败: {e}", exc_info=True)
    
    async def _metrics_update_loop(self) -> None:
        """指标更新循环"""
        logger.info("指标更新循环已启动")
        
        while not self._shutdown_event.is_set():
            try:
                await self._update_system_metrics()
                await asyncio.sleep(10)  # 每10秒更新一次指标
                
            except Exception as e:
                logger.error(f"指标更新失败: {e}", exc_info=True)
                await asyncio.sleep(30)  # 错误时延长等待时间
    
    async def _learning_loop(self) -> None:
        """学习循环"""
        if not self._learning_engine:
            return
        
        logger.info("学习循环已启动")
        
        while not self._shutdown_event.is_set():
            try:
                # 检查是否需要更新模型
                if await self._should_update_model():
                    await self._learning_engine.update_model()
                    
                    with self._lock:
                        self._metrics.last_model_update = datetime.now(timezone.utc)
                
                # 等待下次检查
                await asyncio.sleep(self._config.model_update_interval)
                
            except Exception as e:
                logger.error(f"学习循环出错: {e}", exc_info=True)
                await asyncio.sleep(60)  # 错误时延长等待时间
    
    async def _update_system_metrics(self) -> None:
        """更新系统指标"""
        try:
            if PSUTIL_AVAILABLE:
                # 更新内存使用情况
                process = psutil.Process()
                memory_info = process.memory_info()
                
                with self._lock:
                    self._metrics.current_memory_usage = memory_info.rss
                    self._metrics.peak_memory_usage = max(
                        self._metrics.peak_memory_usage,
                        memory_info.rss
                    )
                    self._metrics.cpu_usage_percent = process.cpu_percent()
                    self._metrics.last_updated = datetime.now(timezone.utc)
            else:
                # 使用基础的系统指标
                with self._lock:
                    self._metrics.last_updated = datetime.now(timezone.utc)
                    
        except Exception as e:
            logger.error(f"更新系统指标失败: {e}")
    
    async def _should_update_model(self) -> bool:
        """检查是否应该更新模型"""
        if not self._learning_engine:
            return False
        
        # 检查学习数据是否足够
        if self._metrics.learning_iterations < 10:
            return False
        
        # 检查上次更新时间
        if self._metrics.last_model_update:
            time_since_update = (
                datetime.now(timezone.utc) - self._metrics.last_model_update
            ).total_seconds()
            if time_since_update < self._config.model_update_interval:
                return False
        
        # 检查模型性能是否需要改进
        return await self._learning_engine.should_update_model()
    
    # ================================
    # 分析和验证辅助方法
    # ================================
    
    async def _classify_problem(self, description: str) -> str:
        """分类问题类型"""
        # 简化的问题分类逻辑
        # 实际实现中可以使用NLP模型进行更精确的分类
        
        description_lower = description.lower()
        
        if any(keyword in description_lower for keyword in ['file', 'directory', 'folder', 'path']):
            return 'file_operations'
        elif any(keyword in description_lower for keyword in ['data', 'analysis', 'process', 'transform']):
            return 'data_processing'
        elif any(keyword in description_lower for keyword in ['web', 'http', 'api', 'request']):
            return 'web_operations'
        elif any(keyword in description_lower for keyword in ['system', 'command', 'execute', 'run']):
            return 'system_operations'
        elif any(keyword in description_lower for keyword in ['text', 'string', 'parse', 'format']):
            return 'text_processing'
        else:
            return 'general'
    
    async def _assess_complexity(self, description: str) -> float:
        """评估问题复杂度 (0-1)"""
        # 简化的复杂度评估
        complexity_indicators = [
            'multiple', 'complex', 'advanced', 'sophisticated',
            'integrate', 'optimize', 'machine learning', 'ai',
            'parallel', 'concurrent', 'distributed'
        ]
        
        description_lower = description.lower()
        matches = sum(1 for indicator in complexity_indicators if indicator in description_lower)
        
        # 基于描述长度和关键词匹配计算复杂度
        length_factor = min(len(description) / 500, 1.0)  # 长度因子
        keyword_factor = min(matches / len(complexity_indicators), 1.0)  # 关键词因子
        
        return (length_factor + keyword_factor) / 2
    
    async def _identify_capabilities(self, description: str) -> List[str]:
        """识别所需能力"""
        capabilities = []
        description_lower = description.lower()
        
        capability_keywords = {
            'file_operations': ['file', 'directory', 'folder', 'path', 'read', 'write'],
            'data_analysis': ['data', 'analysis', 'statistics', 'chart', 'graph'],
            'web_operations': ['web', 'http', 'api', 'request', 'scraping'],
            'system_control': ['system', 'command', 'execute', 'process'],
            'text_processing': ['text', 'string', 'parse', 'regex', 'nlp'],
            'image_processing': ['image', 'picture', 'photo', 'visual'],
            'machine_learning': ['ml', 'ai', 'model', 'predict', 'learn']
        }
        
        for capability, keywords in capability_keywords.items():
            if any(keyword in description_lower for keyword in keywords):
                capabilities.append(capability)
        
        return capabilities
    
    async def _check_environment_compatibility(
        self, 
        environment: Dict[str, Any]
    ) -> Dict[str, Any]:
        """检查环境兼容性"""
        compatibility = {
            'os_compatible': True,
            'python_version_ok': True,
            'dependencies_available': True,
            'permissions_sufficient': True,
            'warnings': []
        }
        
        # 检查操作系统
        if 'os' in environment:
            required_os = environment['os']
            current_os = os.name
            if required_os != current_os:
                compatibility['os_compatible'] = False
                compatibility['warnings'].append(f"OS不匹配: 需要{required_os}, 当前{current_os}")
        
        # 检查Python版本
        if 'python_version' in environment:
            required_version = environment['python_version']
            current_version = f"{sys.version_info.major}.{sys.version_info.minor}"
            if required_version != current_version:
                compatibility['python_version_ok'] = False
                compatibility['warnings'].append(f"Python版本不匹配: 需要{required_version}, 当前{current_version}")
        
        return compatibility
    
    async def _analyze_constraints(self, constraints: Dict[str, Any]) -> Dict[str, Any]:
        """分析约束条件"""
        analysis = {
            'time_constraints': {},
            'resource_constraints': {},
            'security_constraints': {},
            'functional_constraints': {},
            'feasible': True,
            'warnings': []
        }
        
        # 分析时间约束
        if 'timeout' in constraints:
            timeout = constraints['timeout']
            analysis['time_constraints']['timeout'] = timeout
            if timeout < 1:
                analysis['feasible'] = False
                analysis['warnings'].append("超时时间过短")
        
        # 分析资源约束
        if 'memory_limit' in constraints:
            memory_limit = constraints['memory_limit']
            analysis['resource_constraints']['memory_limit'] = memory_limit
            if memory_limit < 100 * 1024 * 1024:  # 100MB
                analysis['warnings'].append("内存限制可能过低")
        
        # 分析安全约束
        if 'security_level' in constraints:
            security_level = constraints['security_level']
            analysis['security_constraints']['level'] = security_level
            if security_level == 'classified':
                analysis['warnings'].append("需要最高安全级别")
        
        return analysis
    
    async def _find_similar_cases(self, description: str) -> List[Dict[str, Any]]:
        """查找相似案例"""
        # 这里可以集成案例库或历史记录搜索
        # 简化实现返回空列表
        return []
    
    async def _check_syntax(self, code: str, language: str) -> bool:
        """检查代码语法"""
        try:
            if language.lower() == 'python':
                compile(code, '<string>', 'exec')
                return True
            else:
                # 其他语言的语法检查需要相应的解析器
                logger.warning(f"暂不支持{language}语法检查")
                return True
        except SyntaxError:
            return False
        except Exception:
            return False
    
    async def _check_security(self, code: str) -> bool:
        """检查代码安全性"""
        # 简化的安全检查
        dangerous_patterns = [
            'import os', 'import sys', 'import subprocess',
            'eval(', 'exec(', '__import__',
            'open(', 'file(', 'input(',
            'rm ', 'del ', 'format(',
        ]
        
        code_lower = code.lower()
        for pattern in dangerous_patterns:
            if pattern in code_lower:
                logger.warning(f"检测到潜在危险代码模式: {pattern}")
                return False
        
        return True
    
    async def _check_compatibility(
        self, 
        adaptation_code: Dict[str, Any], 
        target_environment: Dict[str, Any]
    ) -> bool:
        """检查兼容性"""
        # 检查语言兼容性
        language = adaptation_code.get('language', 'python')
        supported_languages = target_environment.get('supported_languages', ['python'])
        
        if language not in supported_languages:
            logger.warning(f"语言{language}在目标环境中不受支持")
            return False
        
        # 检查依赖兼容性
        dependencies = adaptation_code.get('dependencies', [])
        available_packages = target_environment.get('available_packages', [])
        
        for dep in dependencies:
            if dep not in available_packages:
                logger.warning(f"依赖{dep}在目标环境中不可用")
                return False
        
        return True
    
    async def _estimate_performance(self, code: str) -> Dict[str, Any]:
        """估算代码性能"""
        # 简化的性能估算
        estimate = {
            'time_complexity': 'O(n)',
            'space_complexity': 'O(1)',
            'estimated_runtime': 1.0,  # 秒
            'memory_usage': 1024 * 1024,  # 字节
            'cpu_intensive': False,
            'io_intensive': False
        }
        
        code_lower = code.lower()
        
        # 检查循环复杂度
        loop_count = code_lower.count('for ') + code_lower.count('while ')
        if loop_count > 2:
            estimate['time_complexity'] = 'O(n²)'
            estimate['estimated_runtime'] *= loop_count
        
        # 检查是否CPU密集
        cpu_patterns = ['sort', 'calculate', 'compute', 'algorithm']
        if any(pattern in code_lower for pattern in cpu_patterns):
            estimate['cpu_intensive'] = True
            estimate['estimated_runtime'] *= 2
        
        # 检查是否IO密集
        io_patterns = ['read', 'write', 'request', 'download', 'upload']
        if any(pattern in code_lower for pattern in io_patterns):
            estimate['io_intensive'] = True
            estimate['estimated_runtime'] *= 1.5
        
        return estimate
    
    # ================================
    # 公共接口方法
    # ================================
    
    def queue_task(
        self,
        task_request: Dict[str, Any],
        priority: TaskPriority = TaskPriority.MEDIUM,
        callback: Optional[Callable] = None
    ) -> str:
        """将任务加入队列"""
        task_id = str(uuid.uuid4())
        
        task_info = {
            'id': task_id,
            'request': task_request,
            'priority': priority,
            'queued_at': datetime.now(timezone.utc),
            'callback': callback
        }
        
        with self._lock:
            # 按优先级插入任务
            inserted = False
            for i, existing_task in enumerate(self._task_queue):
                if priority.value > existing_task['priority'].value:
                    self._task_queue.insert(i, task_info)
                    inserted = True
                    break
            
            if not inserted:
                self._task_queue.append(task_info)
        
        logger.info(f"任务已加入队列: {task_id} - 优先级: {priority.name}")
        return task_id
    
    def get_queue_status(self) -> Dict[str, Any]:
        """获取队列状态"""
        with self._lock:
            return {
                'queue_length': len(self._task_queue),
                'active_tasks': len(self._tasks),
                'max_concurrent': self._config.max_concurrent_tasks,
                'queue_tasks': [
                    {
                        'id': task['id'],
                        'priority': task['priority'].name,
                        'queued_at': task['queued_at'].isoformat()
                    }
                    for task in list(self._task_queue)[:10]  # 只返回前10个
                ]
            }
    
    def update_configuration(self, new_config: Dict[str, Any]) -> None:
        """更新配置"""
        with self._lock:
            for key, value in new_config.items():
                if hasattr(self._config, key):
                    setattr(self._config, key, value)
                    logger.info(f"配置已更新: {key} = {value}")
                else:
                    logger.warning(f"未知配置项: {key}")
    
    def get_health_status(self) -> Dict[str, Any]:
        """获取健康状态"""
        with self._lock:
            return {
                'adapter_id': self._adapter_id,
                'status': self._status.value,
                'uptime': (datetime.now(timezone.utc) - self._metrics.last_updated).total_seconds(),
                'metrics': asdict(self._metrics),
                'active_tasks': len(self._tasks),
                'queue_length': len(self._task_queue),
                'components_status': {
                    'executor': self._executor is not None and hasattr(self._executor, 'is_healthy') and self._executor.is_healthy(),
                    'code_generator': self._code_generator is not None,
                    'learning_engine': self._learning_engine is not None
                }
            }
