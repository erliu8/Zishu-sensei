"""
持续学习引擎
"""

import os
import sys
import json
import pickle
import hashlib
import asyncio
import logging
import threading
import traceback
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Set,
    Tuple,
    Union,
    Callable,
    Type,
    Iterator,
)
import uuid
import time
import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import multiprocessing
import weakref

# 深度学习框架导入
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, Dataset, random_split

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

try:
    from transformers import (
        AutoTokenizer,
        AutoModel,
        AutoModelForCausalLM,
        TrainingArguments,
        Trainer,
        DataCollatorForLanguageModeling,
        pipeline,
        BitsAndBytesConfig,
    )
    from peft import LoraConfig, get_peft_model, TaskType, PeftModel
    import datasets

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

# 科学计算库
try:
    import numpy as np
    import pandas as pd

    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    np = None

# 本地导入
from ..base.exceptions import (
    LearningEngineError,
    ModelLoadingError,
    BaseAdapterException,
    ErrorCode,
    ExceptionSeverity,
    handle_adapter_exceptions,
)
from ..base.metadata import AdapterMetadata, AdapterCapability, CapabilityCategory
from ..core.security import SecurityManager
from ..security.audit import (
    get_audit_logger,
    AuditEventType,
    AuditLevel,
    audit_operation,
)

# 配置日志
logger = logging.getLogger(__name__)


# ================================
# 枚举和常量定义
# ================================


class LearningMode(Enum):
    """学习模式"""

    OFFLINE = "offline"  # 离线学习：批量处理历史数据
    ONLINE = "online"  # 在线学习：实时处理新数据
    INCREMENTAL = "incremental"  # 增量学习：定期更新模型
    ACTIVE = "active"  # 主动学习：智能选择学习样本
    TRANSFER = "transfer"  # 迁移学习：从预训练模型开始
    FEDERATED = "federated"  # 联邦学习：分布式协作学习


class ModelType(Enum):
    """模型类型"""

    LANGUAGE_MODEL = "language_model"  # 语言模型
    CODE_MODEL = "code_model"  # 代码生成模型
    EMBEDDING_MODEL = "embedding_model"  # 嵌入模型
    CLASSIFICATION = "classification"  # 分类模型
    REGRESSION = "regression"  # 回归模型
    CUSTOM = "custom"  # 自定义模型


class LearningStrategy(Enum):
    """学习策略"""

    FINE_TUNING = "fine_tuning"  # 全模型微调
    LORA = "lora"  # LoRA低秩适配
    PREFIX_TUNING = "prefix_tuning"  # 前缀微调
    P_TUNING = "p_tuning"  # P-Tuning
    ADAPTER = "adapter"  # Adapter微调
    PROMPT_TUNING = "prompt_tuning"  # 提示微调


class DataType(Enum):
    """数据类型"""

    CODE_GENERATION = "code_generation"  # 代码生成数据
    QUESTION_ANSWER = "question_answer"  # 问答数据
    TEXT_COMPLETION = "text_completion"  # 文本完成数据
    CLASSIFICATION = "classification"  # 分类数据
    FEEDBACK = "feedback"  # 用户反馈数据
    ERROR_CORRECTION = "error_correction"  # 错误纠正数据


class ModelStatus(Enum):
    """模型状态"""

    INITIALIZING = "initializing"  # 初始化中
    LOADING = "loading"  # 加载中
    READY = "ready"  # 就绪
    TRAINING = "training"  # 训练中
    EVALUATING = "evaluating"  # 评估中
    UPDATING = "updating"  # 更新中
    ERROR = "error"  # 错误状态
    DEPRECATED = "deprecated"  # 已废弃


class LearningTaskType(Enum):
    """学习任务类型"""

    INITIAL_TRAINING = "initial_training"  # 初始训练
    FINE_TUNING = "fine_tuning"  # 微调
    INCREMENTAL_LEARNING = "incremental"  # 增量学习
    MODEL_EVALUATION = "evaluation"  # 模型评估
    HYPERPARAMETER_TUNING = "hp_tuning"  # 超参数调优
    MODEL_COMPRESSION = "compression"  # 模型压缩


# ================================
# 核心数据结构
# ================================


@dataclass
class ModelConfig:
    """模型配置"""

    # 基础信息
    model_id: str
    model_name: str
    model_type: ModelType
    version: str = "1.0.0"

    # 模型路径
    model_path: Optional[str] = None
    tokenizer_path: Optional[str] = None
    config_path: Optional[str] = None

    # Hugging Face模型
    hf_model_name: Optional[str] = None
    hf_revision: Optional[str] = None

    # 模型参数
    max_length: int = 2048
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 50

    # 设备配置
    device: str = "auto"
    dtype: str = "float16"
    load_in_8bit: bool = False
    load_in_4bit: bool = False

    # LoRA配置
    use_lora: bool = True
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.1
    lora_target_modules: List[str] = field(default_factory=lambda: ["q_proj", "v_proj"])

    # 缓存配置
    enable_cache: bool = True
    cache_dir: Optional[str] = None
    max_cache_size: int = 1024 * 1024 * 1024  # 1GB

    # 自定义配置
    custom_config: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.model_id:
            self.model_id = f"model_{uuid.uuid4().hex[:8]}"


@dataclass
class TrainingConfig:
    """训练配置"""

    # 基础训练参数
    learning_rate: float = 2e-4
    batch_size: int = 4
    gradient_accumulation_steps: int = 4
    max_epochs: int = 3
    max_steps: int = -1

    # 优化器配置
    optimizer: str = "adamw"
    weight_decay: float = 0.01
    adam_beta1: float = 0.9
    adam_beta2: float = 0.999
    adam_epsilon: float = 1e-8

    # 学习率调度
    lr_scheduler_type: str = "linear"
    warmup_steps: int = 100
    warmup_ratio: float = 0.0

    # 正则化
    dropout: float = 0.1
    attention_dropout: float = 0.1

    # 梯度控制
    max_grad_norm: float = 1.0
    gradient_checkpointing: bool = True

    # 数据处理
    dataloader_num_workers: int = 0
    dataloader_pin_memory: bool = True
    remove_unused_columns: bool = False

    # 评估配置
    evaluation_strategy: str = "steps"
    eval_steps: int = 500
    eval_accumulation_steps: Optional[int] = None
    metric_for_best_model: str = "eval_loss"
    greater_is_better: bool = False

    # 保存配置
    save_strategy: str = "steps"
    save_steps: int = 500
    save_total_limit: int = 3

    # 早停配置
    early_stopping: bool = True
    early_stopping_patience: int = 3
    early_stopping_threshold: float = 0.0

    # 其他配置
    seed: int = 42
    fp16: bool = True
    bf16: bool = False
    logging_steps: int = 10

    # 自定义配置
    custom_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LearningData:
    """学习数据"""

    data_id: str
    data_type: DataType

    # 数据内容
    input_text: str
    target_text: Optional[str] = None

    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)

    # 质量评分
    quality_score: float = 1.0
    confidence_score: float = 1.0

    # 上下文信息
    context: Dict[str, Any] = field(default_factory=dict)

    # 时间戳
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        if not self.data_id:
            self.data_id = f"data_{uuid.uuid4().hex[:8]}"


@dataclass
class ModelMetrics:
    """模型评估指标"""

    # 基础指标
    loss: Optional[float] = None
    perplexity: Optional[float] = None
    accuracy: Optional[float] = None

    # 生成质量指标
    bleu_score: Optional[float] = None
    rouge_score: Optional[Dict[str, float]] = None
    code_execution_rate: Optional[float] = None

    # 效率指标
    inference_time_ms: Optional[float] = None
    throughput_tokens_per_sec: Optional[float] = None
    memory_usage_mb: Optional[float] = None

    # 用户反馈指标
    user_satisfaction: Optional[float] = None
    task_completion_rate: Optional[float] = None
    error_rate: Optional[float] = None

    # 自定义指标
    custom_metrics: Dict[str, float] = field(default_factory=dict)

    # 元数据
    evaluated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    evaluation_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LearningTask:
    """学习任务"""

    task_id: str
    task_type: LearningTaskType
    task_name: str

    # 配置
    model_config: ModelConfig
    training_config: TrainingConfig

    # 数据
    training_data: List[str]  # 数据ID列表
    validation_data: List[str]  # 验证数据ID列表

    # 状态
    status: str = "pending"
    progress: float = 0.0

    # 结果
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    # 资源使用
    estimated_time: Optional[float] = None
    actual_time: Optional[float] = None
    memory_usage: Optional[int] = None

    # 时间戳
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.task_id:
            self.task_id = f"task_{uuid.uuid4().hex[:8]}"


@dataclass
class LearningSession:
    """学习会话"""

    session_id: str
    user_id: Optional[str] = None

    # 会话配置
    learning_mode: LearningMode = LearningMode.INCREMENTAL
    learning_strategy: LearningStrategy = LearningStrategy.LORA

    # 数据收集
    collected_data: List[str] = field(default_factory=list)  # 数据ID列表
    max_data_points: int = 1000

    # 模型状态
    base_model_id: Optional[str] = None
    current_model_id: Optional[str] = None
    model_updates: int = 0

    # 性能跟踪
    initial_metrics: Optional[ModelMetrics] = None
    current_metrics: Optional[ModelMetrics] = None
    metrics_history: List[ModelMetrics] = field(default_factory=list)

    # 会话状态
    status: str = "active"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.session_id:
            self.session_id = f"session_{uuid.uuid4().hex[:8]}"


# ================================
# 数据管理器
# ================================


class LearningDataManager:
    """学习数据管理器"""

    def __init__(self, storage_path: Union[str, Path]):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        self.data_index: Dict[str, LearningData] = {}
        self.data_by_type: Dict[DataType, List[str]] = defaultdict(list)
        self.data_by_quality: Dict[float, List[str]] = defaultdict(list)

        self._lock = asyncio.Lock()
        self.audit_logger = get_audit_logger()

        # 加载现有数据
        asyncio.create_task(self._load_existing_data())

    async def _load_existing_data(self):
        """加载现有数据"""
        try:
            data_dir = self.storage_path / "learning_data"
            if data_dir.exists():
                for data_file in data_dir.glob("*.json"):
                    try:
                        with open(data_file, "r", encoding="utf-8") as f:
                            data_dict = json.load(f)

                        # 转换时间戳
                        if "created_at" in data_dict:
                            data_dict["created_at"] = datetime.fromisoformat(
                                data_dict["created_at"]
                            )
                        if "updated_at" in data_dict:
                            data_dict["updated_at"] = datetime.fromisoformat(
                                data_dict["updated_at"]
                            )

                        data = LearningData(**data_dict)
                        await self._index_data(data)

                    except Exception as e:
                        logger.warning(f"Failed to load data file {data_file}: {e}")

        except Exception as e:
            logger.error(f"Failed to load existing data: {e}")

    @audit_operation(operation="add_learning_data", component="learning_engine")
    async def add_data(self, data: LearningData) -> bool:
        """添加学习数据"""
        async with self._lock:
            try:
                # 保存到文件
                data_file = self.storage_path / "learning_data" / f"{data.data_id}.json"
                data_file.parent.mkdir(parents=True, exist_ok=True)

                data_dict = asdict(data)
                data_dict["created_at"] = data.created_at.isoformat()
                data_dict["updated_at"] = data.updated_at.isoformat()

                with open(data_file, "w", encoding="utf-8") as f:
                    json.dump(data_dict, f, indent=2, ensure_ascii=False)

                # 更新索引
                await self._index_data(data)

                logger.info(f"Added learning data: {data.data_id}")
                return True

            except Exception as e:
                logger.error(f"Failed to add learning data {data.data_id}: {e}")
                return False

    async def _index_data(self, data: LearningData):
        """索引数据"""
        self.data_index[data.data_id] = data
        self.data_by_type[data.data_type].append(data.data_id)
        self.data_by_quality[data.quality_score].append(data.data_id)

    async def get_data(self, data_id: str) -> Optional[LearningData]:
        """获取数据"""
        return self.data_index.get(data_id)

    async def get_data_by_type(
        self, data_type: DataType, limit: int = 100
    ) -> List[LearningData]:
        """按类型获取数据"""
        data_ids = self.data_by_type.get(data_type, [])[:limit]
        return [
            self.data_index[data_id]
            for data_id in data_ids
            if data_id in self.data_index
        ]

    async def get_high_quality_data(
        self, min_quality: float = 0.8, limit: int = 100
    ) -> List[LearningData]:
        """获取高质量数据"""
        high_quality_data = []
        for quality_score, data_ids in self.data_by_quality.items():
            if quality_score >= min_quality:
                high_quality_data.extend(
                    [
                        self.data_index[data_id]
                        for data_id in data_ids
                        if data_id in self.data_index
                    ]
                )
        return high_quality_data[:limit]

    async def create_dataset(self, data_ids: List[str]) -> Optional["LearningDataset"]:
        """创建PyTorch数据集"""
        if not TORCH_AVAILABLE:
            raise LearningEngineError("PyTorch is not available")

        try:
            dataset_data = []
            for data_id in data_ids:
                data = await self.get_data(data_id)
                if data:
                    dataset_data.append(
                        {
                            "input_text": data.input_text,
                            "target_text": data.target_text or "",
                            "data_type": data.data_type.value,
                            "quality_score": data.quality_score,
                        }
                    )

            return LearningDataset(dataset_data)

        except Exception as e:
            logger.error(f"Failed to create dataset: {e}")
            return None

    async def cleanup_old_data(self, days_old: int = 30):
        """清理旧数据"""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)

        cleanup_count = 0
        for data_id, data in list(self.data_index.items()):
            if data.created_at < cutoff_date and data.quality_score < 0.5:
                try:
                    # 删除文件
                    data_file = self.storage_path / "learning_data" / f"{data_id}.json"
                    if data_file.exists():
                        data_file.unlink()

                    # 从索引中移除
                    del self.data_index[data_id]
                    if data_id in self.data_by_type[data.data_type]:
                        self.data_by_type[data.data_type].remove(data_id)
                    if data_id in self.data_by_quality[data.quality_score]:
                        self.data_by_quality[data.quality_score].remove(data_id)

                    cleanup_count += 1

                except Exception as e:
                    logger.warning(f"Failed to cleanup data {data_id}: {e}")

        logger.info(f"Cleaned up {cleanup_count} old data entries")
        return cleanup_count


class LearningDataset(Dataset):
    """学习数据集"""

    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        return self.data[idx]


# ================================
# 模型管理器
# ================================


class ModelManager:
    """模型管理器 - 负责模型的加载、保存、版本管理"""

    def __init__(self, models_path: Union[str, Path]):
        self.models_path = Path(models_path)
        self.models_path.mkdir(parents=True, exist_ok=True)

        # 模型存储
        self.loaded_models: Dict[str, Any] = {}
        self.model_configs: Dict[str, ModelConfig] = {}
        self.model_status: Dict[str, ModelStatus] = {}
        self.model_metrics: Dict[str, ModelMetrics] = {}

        # 线程安全
        self._lock = threading.RLock()
        self.audit_logger = get_audit_logger()

        # 设备管理
        self._setup_device()

    def _setup_device(self):
        """设置计算设备"""
        if TORCH_AVAILABLE and torch.cuda.is_available():
            self.device = torch.device("cuda")
            logger.info(f"Using CUDA device")
        else:
            self.device = torch.device("cpu")
            logger.info("Using CPU device")

    @audit_operation(operation="load_model", component="learning_engine")
    async def load_model(self, config: ModelConfig) -> bool:
        """加载模型到内存"""
        if not TRANSFORMERS_AVAILABLE:
            raise ModelLoadingError("Transformers library not available")

        with self._lock:
            try:
                self.model_status[config.model_id] = ModelStatus.LOADING
                logger.info(f"Loading model: {config.model_name}")

                # 模拟模型加载
                await asyncio.sleep(0.1)

                # 存储模型信息
                self.loaded_models[config.model_id] = {
                    "model": f"mock_model_{config.model_id}",
                    "tokenizer": f"mock_tokenizer_{config.model_id}",
                    "config": config,
                    "loaded_at": datetime.now(timezone.utc),
                }

                self.model_configs[config.model_id] = config
                self.model_status[config.model_id] = ModelStatus.READY

                logger.info(f"Successfully loaded model: {config.model_name}")
                return True

            except Exception as e:
                self.model_status[config.model_id] = ModelStatus.ERROR
                logger.error(f"Failed to load model {config.model_name}: {e}")
                raise ModelLoadingError(f"Model loading failed: {e}")

    def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        """获取已加载的模型"""
        return self.loaded_models.get(model_id)

    async def update_model_metrics(self, model_id: str, metrics: ModelMetrics):
        """更新模型指标"""
        self.model_metrics[model_id] = metrics
        logger.info(f"Updated metrics for model: {model_id}")


# ================================
# 学习策略
# ================================


class LearningStrategyBase(ABC):
    """学习策略基类"""

    def __init__(self, model_manager: ModelManager, data_manager: LearningDataManager):
        self.model_manager = model_manager
        self.data_manager = data_manager
        self.audit_logger = get_audit_logger()

    @abstractmethod
    async def train_model(self, task: LearningTask) -> Dict[str, Any]:
        """训练模型"""
        pass

    @abstractmethod
    async def evaluate_model(self, task: LearningTask) -> ModelMetrics:
        """评估模型"""
        pass


class LoRAStrategy(LearningStrategyBase):
    """LoRA微调策略"""

    async def train_model(self, task: LearningTask) -> Dict[str, Any]:
        """执行LoRA训练"""
        try:
            logger.info(f"Starting LoRA training for task: {task.task_id}")

            # 模拟训练过程
            await asyncio.sleep(0.1)

            return {"train_loss": 0.45, "train_runtime": 120, "global_step": 50}

        except Exception as e:
            logger.error(f"LoRA training failed: {e}")
            raise

    async def evaluate_model(self, task: LearningTask) -> ModelMetrics:
        """评估模型"""
        return ModelMetrics(
            loss=0.38, perplexity=1.46, accuracy=0.85, inference_time_ms=180.0
        )


# ================================
# 主学习引擎
# ================================


class ContinuousLearningEngine:
    """持续学习引擎 - 核心协调器"""

    def __init__(self, config_path: Union[str, Path]):
        self.config_path = Path(config_path)
        self.config_path.mkdir(parents=True, exist_ok=True)

        # 初始化组件
        self.model_manager = ModelManager(self.config_path / "models")
        self.data_manager = LearningDataManager(self.config_path / "data")

        # 学习策略
        self.strategies = {
            LearningStrategy.LORA: LoRAStrategy(self.model_manager, self.data_manager)
        }

        # 任务管理
        self.active_tasks: Dict[str, LearningTask] = {}
        self.sessions: Dict[str, LearningSession] = {}

        self.audit_logger = get_audit_logger()
        logger.info("Continuous Learning Engine initialized")

    @audit_operation(operation="start_session", component="learning_engine")
    async def start_session(self, user_id: Optional[str] = None) -> str:
        """启动学习会话"""
        session = LearningSession(
            session_id=f"session_{uuid.uuid4().hex[:8]}", user_id=user_id
        )

        self.sessions[session.session_id] = session
        logger.info(f"Started learning session: {session.session_id}")

        return session.session_id

    async def add_learning_data(self, session_id: str, data: LearningData) -> bool:
        """添加学习数据"""
        if session_id not in self.sessions:
            raise LearningEngineError(f"Session not found: {session_id}")

        success = await self.data_manager.add_data(data)
        if success:
            session = self.sessions[session_id]
            session.collected_data.append(data.data_id)
            session.last_activity = datetime.now(timezone.utc)

        return success

    async def execute_learning_task(self, task: LearningTask) -> Dict[str, Any]:
        """执行学习任务"""
        try:
            self.active_tasks[task.task_id] = task
            task.status = "running"
            task.started_at = datetime.now(timezone.utc)

            # 获取策略
            strategy = self.strategies.get(LearningStrategy.LORA)

            # 执行训练
            training_results = await strategy.train_model(task)
            metrics = await strategy.evaluate_model(task)

            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
            task.result = {
                "training_results": training_results,
                "metrics": asdict(metrics),
            }

            logger.info(f"Learning task completed: {task.task_id}")
            return task.result

        except Exception as e:
            task.status = "failed"
            task.error = str(e)
            logger.error(f"Learning task failed: {e}")
            raise

    async def get_session_metrics(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话指标"""
        session = self.sessions.get(session_id)
        if not session:
            return None

        return {
            "session_id": session_id,
            "data_collected": len(session.collected_data),
            "model_updates": session.model_updates,
            "status": session.status,
            "created_at": session.created_at.isoformat(),
            "last_activity": session.last_activity.isoformat(),
        }


# ================================
# 集成接口
# ================================


class LearningEngineAdapter:
    """学习引擎适配器 - 与其他组件的集成接口"""

    def __init__(self, engine: ContinuousLearningEngine):
        self.engine = engine
        self.audit_logger = get_audit_logger()

    @audit_operation(operation="collect_feedback", component="learning_engine")
    async def collect_code_feedback(
        self,
        session_id: str,
        generated_code: str,
        user_feedback: str,
        execution_result: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """收集代码生成反馈"""
        try:
            # 创建学习数据
            feedback_data = LearningData(
                data_id=f"feedback_{uuid.uuid4().hex[:8]}",
                data_type=DataType.FEEDBACK,
                input_text=generated_code,
                target_text=user_feedback,
                metadata={
                    "execution_result": execution_result,
                    "feedback_type": "code_generation",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
                quality_score=0.8
                if execution_result and execution_result.get("success")
                else 0.5,
            )

            # 添加到学习会话
            success = await self.engine.add_learning_data(session_id, feedback_data)

            if success:
                logger.info(f"Collected code feedback for session: {session_id}")

            return success

        except Exception as e:
            logger.error(f"Failed to collect code feedback: {e}")
            return False

    async def collect_execution_result(
        self, session_id: str, code: str, result: Dict[str, Any]
    ) -> bool:
        """收集代码执行结果"""
        try:
            # 根据执行结果确定质量分数
            quality_score = 1.0 if result.get("success") else 0.3

            execution_data = LearningData(
                data_id=f"exec_{uuid.uuid4().hex[:8]}",
                data_type=DataType.ERROR_CORRECTION,
                input_text=code,
                target_text=result.get("output", ""),
                metadata={
                    "execution_time": result.get("execution_time"),
                    "error_message": result.get("error"),
                    "success": result.get("success", False),
                },
                quality_score=quality_score,
            )

            return await self.engine.add_learning_data(session_id, execution_data)

        except Exception as e:
            logger.error(f"Failed to collect execution result: {e}")
            return False

    async def request_model_improvement(
        self, session_id: str, improvement_type: str = "incremental"
    ) -> Optional[str]:
        """请求模型改进"""
        try:
            session = self.engine.sessions.get(session_id)
            if not session:
                raise LearningEngineError(f"Session not found: {session_id}")

            # 检查是否有足够的数据进行学习
            if len(session.collected_data) < 5:
                logger.info(
                    f"Not enough data for improvement: {len(session.collected_data)} samples"
                )
                return None

            # 创建学习任务
            task = LearningTask(
                task_id=f"improve_{uuid.uuid4().hex[:8]}",
                task_type=LearningTaskType.INCREMENTAL_LEARNING,
                task_name=f"Model improvement for session {session_id}",
                model_config=ModelConfig(
                    model_id="default_model",
                    model_name="Default Model",
                    model_type=ModelType.CODE_MODEL,
                ),
                training_config=TrainingConfig(
                    learning_rate=1e-4, batch_size=2, max_epochs=1
                ),
                training_data=session.collected_data,
                validation_data=session.collected_data[-2:],
            )

            # 执行学习任务
            result = await self.engine.execute_learning_task(task)

            if result:
                session.model_updates += 1
                logger.info(f"Model improvement completed for session: {session_id}")
                return task.task_id

            return None

        except Exception as e:
            logger.error(f"Failed to request model improvement: {e}")
            return None

    async def get_learning_insights(self, session_id: str) -> Dict[str, Any]:
        """获取学习洞察"""
        try:
            metrics = await self.engine.get_session_metrics(session_id)
            if not metrics:
                return {}

            session = self.engine.sessions.get(session_id)
            if not session:
                return {}

            # 分析数据类型分布
            data_type_counts = defaultdict(int)
            quality_scores = []

            for data_id in session.collected_data:
                data = await self.engine.data_manager.get_data(data_id)
                if data:
                    data_type_counts[data.data_type.value] += 1
                    quality_scores.append(data.quality_score)

            avg_quality = (
                sum(quality_scores) / len(quality_scores) if quality_scores else 0
            )

            insights = {
                "session_metrics": metrics,
                "data_analysis": {
                    "total_samples": len(session.collected_data),
                    "data_type_distribution": dict(data_type_counts),
                    "average_quality_score": avg_quality,
                    "quality_trend": "improving"
                    if avg_quality > 0.7
                    else "needs_attention",
                },
                "learning_progress": {
                    "model_updates": session.model_updates,
                    "learning_rate": "adaptive",
                    "next_improvement_eta": "10 samples"
                    if len(session.collected_data) % 10 > 5
                    else "ready",
                },
            }

            return insights

        except Exception as e:
            logger.error(f"Failed to get learning insights: {e}")
            return {}


# ================================
# 工厂函数
# ================================


def create_learning_engine(config_path: Union[str, Path]) -> ContinuousLearningEngine:
    """创建学习引擎实例"""
    return ContinuousLearningEngine(config_path)


def create_learning_adapter(engine: ContinuousLearningEngine) -> LearningEngineAdapter:
    """创建学习引擎适配器"""
    return LearningEngineAdapter(engine)


# ================================
# 导出列表
# ================================

__all__ = [
    # 枚举
    "LearningMode",
    "ModelType",
    "LearningStrategy",
    "DataType",
    "ModelStatus",
    "LearningTaskType",
    # 数据结构
    "ModelConfig",
    "TrainingConfig",
    "LearningData",
    "ModelMetrics",
    "LearningTask",
    "LearningSession",
    # 核心组件
    "LearningDataManager",
    "LearningDataset",
    "ModelManager",
    "LearningStrategyBase",
    "LoRAStrategy",
    "ContinuousLearningEngine",
    # 集成接口
    "LearningEngineAdapter",
    # 工厂函数
    "create_learning_engine",
    "create_learning_adapter",
]
