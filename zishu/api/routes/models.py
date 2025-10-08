from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import Dict, Any, List, Optional
import asyncio
import time
import os
import gc
import psutil
from datetime import datetime, timezone
from enum import Enum
import json
from pathlib import Path
import logging

from ..dependencies import get_model_manager, get_config, get_logger
from ..schemas.request import (
    ModelLoadRequest,
    ModelUnloadRequest,
    ModelSwitchRequest,
    ModelManagementRequest,
)
from ..schemas.responses import (
    AdapterInfo,
    ModelListResponse,
    ErrorResponse,
    create_error_response,
    create_success_response,
)

router = APIRouter(
    prefix="/models",
    tags=["model-management"],
)


class AdapterStatus(str, Enum):
    LOADED = "loaded"
    UNLOADED = "unloaded"
    LOADING = "loading"
    UNLOADING = "unloading"
    ERROR = "error"
    UNKNOWN = "unknown"
    MAINTENANCE = "maintenance"


class ModelOperationType(str, Enum):
    LOAD = "load"
    UNLOAD = "unload"
    SWITCH = "switch"
    REFRESH = "refresh"
    LIST = "list"
    INFO = "info"
    STATUS = "status"


async def validate_adapter_name(adapter_name: str) -> bool:
    """验证适配器名称"""
    if not adapter_name or len(adapter_name) < 1:
        return False
    if len(adapter_name) > 100:  # 防止过长的名称
        return False
    # 允许字母、数字、连字符、下划线和点号
    allowed_chars = set(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
    )
    if not all(c in allowed_chars for c in adapter_name):
        return False
    # 不允许以特殊字符开头或结尾
    if adapter_name[0] in "-_." or adapter_name[-1] in "-_.":
        return False
    return True


async def get_adapter_file_info(adapter_path: str) -> Dict[str, Any]:
    """获取适配器文件信息"""
    try:
        path_obj = Path(adapter_path)
        if not path_obj.exists():
            return {"exists": False}

        stat_info = path_obj.stat()
        return {
            "exists": True,
            "size": stat_info.st_size,
            "size_mb": round(stat_info.st_size / 1024 / 1024, 2),
            "modified_time": datetime.fromtimestamp(
                stat_info.st_mtime, tz=timezone.utc
            ),
            "created_time": datetime.fromtimestamp(stat_info.st_ctime, tz=timezone.utc),
            "readable": os.access(adapter_path, os.R_OK),
            "writable": os.access(adapter_path, os.W_OK),
            "is_file": path_obj.is_file(),
            "is_directory": path_obj.is_dir(),
        }
    except Exception as e:
        return {"exists": False, "error": str(e)}


async def cleanup_memory_task(logger):
    """后台内存清理任务"""
    try:
        logger.info("Starting memory cleanup task")

        # Python垃圾回收
        collected = gc.collect()
        logger.info(f"Python GC collected {collected} objects")

        # 如果有torch，清理CUDA缓存
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("CUDA cache cleared")
        except ImportError:
            pass

        logger.info("Memory cleanup task completed")
    except Exception as e:
        logger.error(f"Memory cleanup task failed: {e}")


async def get_system_info() -> Dict[str, Any]:
    """获取系统信息"""
    try:
        memory = psutil.virtual_memory()
        system_info = {
            "memory": {
                "total_mb": memory.total // 1024 // 1024,
                "available_mb": memory.available // 1024 // 1024,
                "used_mb": memory.used // 1024 // 1024,
                "usage_percent": memory.percent,
            },
            "gpu": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # GPU信息
        try:
            import torch

            if torch.cuda.is_available():
                for i in range(torch.cuda.device_count()):
                    device_props = torch.cuda.get_device_properties(i)
                    system_info["gpu"][f"cuda:{i}"] = {
                        "name": torch.cuda.get_device_name(i),
                        "memory_allocated_mb": torch.cuda.memory_allocated(i)
                        // 1024
                        // 1024,
                        "memory_reserved_mb": torch.cuda.memory_reserved(i)
                        // 1024
                        // 1024,
                        "total_memory_mb": device_props.total_memory // 1024 // 1024,
                        "compute_capability": f"{device_props.major}.{device_props.minor}",
                    }
        except ImportError:
            system_info["gpu"]["status"] = "torch_not_available"

        return system_info
    except Exception as e:
        return {"error": str(e)}


async def validate_adapter_path(adapter_path: str, config) -> bool:
    """验证适配器路径的安全性"""
    try:
        adapter_dir = getattr(config, "ADAPTERS_DIR", "./adapters")
        adapter_dir = Path(adapter_dir).resolve()
        target_path = Path(adapter_path).resolve()

        # 确保路径在适配器目录内（防止路径遍历攻击）
        return adapter_dir in target_path.parents or adapter_dir == target_path
    except Exception:
        return False


@router.get("/", response_model=List[AdapterInfo])
async def list_adapters(
    include_unloaded: bool = True,
    include_details: bool = False,
    model_manager=Depends(get_model_manager),
    config=Depends(get_config),
    logger=Depends(get_logger),
):
    """列出所有适配器"""
    try:
        logger.info("Listing available adapters and models")

        adapters = []

        # 获取已加载的适配器
        if hasattr(model_manager, "get_loaded_adapters"):
            loaded_adapters = model_manager.get_loaded_adapters()
            for adapter_name, adapter_info in loaded_adapters.items():
                adapters.append(
                    AdapterInfo(
                        name=adapter_name,
                        path=adapter_info.get("path", ""),
                        size=adapter_info.get("size"),
                        version=adapter_info.get("version"),
                        description=adapter_info.get("description"),
                        status=AdapterStatus.LOADED,
                        load_time=adapter_info.get("load_time"),
                        memory_usage=adapter_info.get("memory_usage"),
                        config=adapter_info.get("config", {})
                        if include_details
                        else {},
                    )
                )

        # 获取可用但未加载的适配器
        if include_unloaded:
            adapter_dir = getattr(config, "ADAPTERS_DIR", "./adapters")
            if os.path.exists(adapter_dir):
                for item in os.listdir(adapter_dir):
                    item_path = os.path.join(adapter_dir, item)
                    # 检查是否为适配器文件或目录
                    valid_extensions = (
                        ".tar.gz",
                        ".zip",
                        ".7z",
                        ".rar",
                        ".gz",
                        ".tar",
                        ".safetensors",
                        ".bin",
                    )
                    if os.path.isdir(item_path) or any(
                        item.endswith(ext) for ext in valid_extensions
                    ):
                        # 检查是否已在加载列表中
                        if not any(adapter.name == item for adapter in adapters):
                            file_info = (
                                await get_adapter_file_info(item_path)
                                if include_details
                                else {}
                            )
                            adapters.append(
                                AdapterInfo(
                                    name=item,
                                    path=item_path,
                                    size=file_info.get("size"),
                                    status=AdapterStatus.UNLOADED,
                                    config={},
                                )
                            )

        logger.info(f"Found {len(adapters)} adapters")
        return adapters
    except Exception as e:
        logger.error(f"Failed to list adapters: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=create_error_response(
                error_type="MODEL_LIST_ERROR",
                error_code="E001",  # MODEL_LIST_ERROR
                message=f"Failed to list adapters: {str(e)}",
            ).dict(),
        )


@router.post("/load", response_model=ModelListResponse)
async def load_adapter(
    request: ModelManagementRequest,
    background_tasks: BackgroundTasks,
    model_manager=Depends(get_model_manager),
    logger=Depends(get_logger),
):
    """加载指定适配器"""
    try:
        if not await validate_adapter_name(request.adapter_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=create_error_response(
                    error_type="VALIDATION_ERROR",
                    error_code="E002",  # VALIDATION_ERROR
                    message=f"Invalid adapter name: {request.adapter_name}",
                ).dict(),
            )

        logger.info(f"Loading adapter: {request.adapter_name}")
        start_time = time.time()

        # 检查适配器是否已加载
        if hasattr(model_manager, "is_adapter_loaded"):
            if (
                model_manager.is_adapter_loaded(request.adapter_name)
                and not request.force_reload
            ):
                return ModelListResponse(
                    success=True,
                    operation=ModelOperationType.LOAD,
                    adapter_name=request.adapter_name,
                    message=f"Adapter {request.adapter_name} is already loaded",
                    execution_time=time.time() - start_time,
                )

        # 执行加载操作
        if hasattr(model_manager, "load_adapter"):
            # 异步加载适配器
            load_config = {
                "device": request.device,
                "torch_dtype": request.torch_dtype,
                "low_memory": request.low_memory,
                **(request.load_config or {}),
            }

            result = await model_manager.load_adapter(
                adapter_path=request.adapter_path,
                adapter_name=request.adapter_name,
                config=load_config,
            )

            execution_time = time.time() - start_time

            if result.get("success", True):
                return ModelListResponse(
                    success=True,
                    operation=ModelOperationType.LOAD,
                    adapter_name=request.adapter_name,
                    message=f"Adapter {request.adapter_name} loaded successfully",
                    execution_time=execution_time,
                    memory_usage=result.get("memory_usage"),
                )
            else:
                raise Exception(result.get("error", "Unknown loading error"))

        else:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=create_error_response(
                    error_type="NOT_IMPLEMENTED",
                    error_code="E003",  # NOT_IMPLEMENTED
                    message=f"Model manager does not support load_adapter method",
                ).dict(),
            )
    except HTTPException:
        raise
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"Failed to load adapter: {request.adapter_name} - {str(e)}")

        return ModelListResponse(
            success=False,
            operation=ModelOperationType.LOAD,
            adapter_name=request.adapter_name,
            message=f"Failed to load adapter: {request.adapter_name} - {str(e)}",
            execution_time=execution_time,
            error_code="E004",  # LOAD_ADAPTER_ERROR
            error_details=str(e),
        )


@router.post("/unload", response_model=ModelListResponse)
async def unload_adapter(
    request: ModelUnloadRequest,
    background_tasks: BackgroundTasks,
    model_manager=Depends(get_model_manager),
    logger=Depends(get_logger),
):
    """卸载指定适配器"""
    try:
        if not await validate_adapter_name(request.adapter_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=create_error_response(
                    error_type="VALIDATION_ERROR",
                    error_code="E005",  # VALIDATION_ERROR
                    message=f"Invalid adapter name: {request.adapter_name}",
                ).dict(),
            )

        logger.info(f"Unloading adapter: {request.adapter_name}")
        start_time = time.time()

        # 检查适配器是否已加载
        if hasattr(model_manager, "is_adapter_loaded"):
            if not model_manager.is_adapter_loaded(request.adapter_name):
                return ModelListResponse(
                    success=True,
                    operation=ModelOperationType.UNLOAD,
                    adapter_name=request.adapter_name,
                    message=f"Adapter {request.adapter_name} is not loaded",
                    execution_time=time.time() - start_time,
                )

        # 执行卸载操作
        if hasattr(model_manager, "unload_adapter"):
            result = await model_manager.unload_adapter(
                adapter_name=request.adapter_name, force=request.force_unload
            )

            execution_time = time.time() - start_time

            if result.get("success", True):
                logger.info(
                    f"Successfully unloaded adapter: {request.adapter_name} in {execution_time:.2f} seconds"
                )

                # 后台任务：清理内存
                background_tasks.add_task(cleanup_memory_task, logger)

                return ModelListResponse(
                    success=True,
                    operation=ModelOperationType.UNLOAD,
                    adapter_name=request.adapter_name,
                    message=f"Adapter {request.adapter_name} unloaded successfully",
                    execution_time=execution_time,
                )
            else:
                raise Exception(result.get("error", "Unknown unloading error"))

        else:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=create_error_response(
                    error_type="NOT_IMPLEMENTED",
                    error_code="E006",  # NOT_IMPLEMENTED
                    message=f"Model manager does not support unload_adapter method",
                ).dict(),
            )
    except HTTPException:
        raise
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"Failed to unload adapter: {request.adapter_name} - {str(e)}")

        return ModelListResponse(
            success=False,
            operation=ModelOperationType.UNLOAD,
            adapter_name=request.adapter_name,
            message=f"Failed to unload adapter: {request.adapter_name} - {str(e)}",
            execution_time=execution_time,
            error_code="E007",  # UNLOAD_ADAPTER_ERROR
            error_details=str(e),
        )


@router.post("/switch", response_model=ModelListResponse)
async def switch_adapter(
    request: ModelSwitchRequest,
    background_tasks: BackgroundTasks,
    model_manager=Depends(get_model_manager),
    logger=Depends(get_logger),
):
    """切换适配器"""
    try:
        logger.info(
            f"Switching adapter: {request.from_adapter} -> {request.to_adapter}"
        )
        start_time = time.time()

        if hasattr(model_manager, "switch_adapter"):
            result = await model_manager.switch_adapter(
                from_adapter_id=request.from_adapter,
                to_adapter_id=request.to_adapter,
                unload_previous=request.keep_cache,
            )

            execution_time = time.time() - start_time

            if result.get("success", True):
                logger.info(
                    f"Successfully switched adapter: {request.from_adapter} -> {request.to_adapter} in {execution_time:.2f} seconds"
                )

                return ModelListResponse(
                    success=True,
                    operation=ModelOperationType.SWITCH,
                    adapter_name=request.to_adapter,
                    message=f"Adapter {request.to_adapter} switched successfully",
                    execution_time=execution_time,
                    memory_usage=result.get("memory_usage"),
                )
            else:
                raise Exception(result.get("error", "Unknown switching error"))
        else:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=create_error_response(
                    error_type="NOT_IMPLEMENTED",
                    error_code="E008",  # NOT_IMPLEMENTED
                    message=f"Model manager does not support switch_adapter method",
                ).dict(),
            )
    except HTTPException:
        raise
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(
            f"Failed to switch adapter: {request.from_adapter} -> {request.to_adapter} - {str(e)}"
        )

        return ModelListResponse(
            success=False,
            operation=ModelOperationType.SWITCH,
            adapter_name=request.to_adapter or "unknown",
            message=f"Failed to switch adapter: {request.from_adapter} -> {request.to_adapter} - {str(e)}",
            execution_time=execution_time,
            error_code="E009",  # SWITCH_ADAPTER_ERROR
            error_details=str(e),
        )


@router.get("/status", response_model=Dict[str, Any])
async def get_model_status(
    adapter_name: Optional[str] = None,
    include_system_info: bool = True,
    model_manager=Depends(get_model_manager),
    logger=Depends(get_logger),
):
    """获取指定模型状态"""
    try:
        logger.info(f"Getting model status for: {adapter_name or 'all adapters'}")
        start_time = time.time()

        status_info = {"timestamp": datetime.now(timezone.utc), "adapters": []}

        if hasattr(model_manager, "get_status"):
            if adapter_name:
                # 获取特定适配器状态
                adapter_status = model_manager.get_status(adapter_name)
                status_info["adapters"] = {adapter_name: adapter_status}

            else:
                # 获取所有适配器状态
                all_status = model_manager.get_status()
                status_info["adapters"] = all_status

        # 添加系统信息
        system_info = await get_system_info()
        status_info["system"] = system_info
        return status_info
    except Exception as e:
        logger.error(f"Failed to get model status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=create_error_response(
                error_type="STATUS_ERROR",
                error_code="E010",  # STATUS_ERROR
                message=f"Failed to get model status: {str(e)}",
            ).dict(),
        )


@router.get("/adapter/{adapter_name}/info", response_model=AdapterInfo)
async def get_adapter_info(
    adapter_name: str,
    model_manager=Depends(get_model_manager),
    config=Depends(get_config),
    logger=Depends(get_logger),
):
    """获取指定适配器信息"""
    try:
        if not await validate_adapter_name(adapter_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=create_error_response(
                    error_type="VALIDATION_ERROR",
                    error_code="E011",  # VALIDATION_ERROR
                    message=f"Invalid adapter name: {adapter_name}",
                ).dict(),
            )

        logger.info(f"Getting adapter info for: {adapter_name}")

        # 尝试从已加载的适配器获取信息
        if hasattr(model_manager, "get_adapter_info"):
            adapter_info = model_manager.get_adapter_info(adapter_name)
            if adapter_info:
                return AdapterInfo(**adapter_info)

        # 从文件系统中获取信息
        adapter_dir = getattr(config, "ADAPTERS_DIR", "./adapters")
        adapter_path = os.path.join(adapter_dir, adapter_name)

        file_info = await get_adapter_file_info(adapter_path)

        if not file_info.get("exists", False):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=create_error_response(
                    error_type="NOT_FOUND",
                    error_code="E012",  # NOT_FOUND
                    message=f"Adapter '{adapter_name}' not found",
                ).dict(),
            )

        return AdapterInfo(
            name=adapter_name,
            path=adapter_path,
            size=file_info.get("size"),
            status=AdapterStatus.UNLOADED,
            config={},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get adapter info for {adapter_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=create_error_response(
                error_type="ADAPTER_INFO_ERROR",
                error_code="E013",  # ADAPTER_INFO_ERROR
                message=f"Failed to get adapter info: {str(e)}",
            ).dict(),
        )


# 新增的辅助端点


@router.get("/health", response_model=Dict[str, Any])
async def health_check(
    model_manager=Depends(get_model_manager), logger=Depends(get_logger)
):
    """健康检查端点"""
    try:
        system_info = await get_system_info()

        # 基本健康状态
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "system": system_info,
            "model_manager": {
                "available": model_manager is not None,
                "methods": [
                    method
                    for method in [
                        "load_adapter",
                        "unload_adapter",
                        "switch_adapter",
                        "get_loaded_adapters",
                        "get_status",
                        "is_adapter_loaded",
                    ]
                    if hasattr(model_manager, method)
                ]
                if model_manager
                else [],
            },
        }

        # 检查内存使用情况
        if system_info.get("memory", {}).get("usage_percent", 0) > 90:
            health_status["status"] = "warning"
            health_status["warnings"] = ["High memory usage detected"]

        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
        }


@router.post("/maintenance", response_model=Dict[str, Any])
async def maintenance_mode(
    enable: bool = True,
    background_tasks: BackgroundTasks = None,
    model_manager=Depends(get_model_manager),
    logger=Depends(get_logger),
):
    """启用/禁用维护模式"""
    try:
        logger.info(f"{'Enabling' if enable else 'Disabling'} maintenance mode")

        if enable:
            # 进入维护模式 - 可以添加清理逻辑
            if background_tasks:
                background_tasks.add_task(cleanup_memory_task, logger)

        return {
            "success": True,
            "maintenance_mode": enable,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": f"Maintenance mode {'enabled' if enable else 'disabled'}",
        }
    except Exception as e:
        logger.error(f"Failed to set maintenance mode: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=create_error_response(
                error_type="MAINTENANCE_ERROR",
                error_code="E014",  # MAINTENANCE_ERROR
                message=f"Failed to set maintenance mode: {str(e)}",
            ).dict(),
        )


@router.get("/metrics", response_model=Dict[str, Any])
async def get_metrics(
    model_manager=Depends(get_model_manager), logger=Depends(get_logger)
):
    """获取系统和模型指标"""
    try:
        system_info = await get_system_info()

        metrics = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "system": system_info,
            "adapters": {
                "total_loaded": 0,
                "total_available": 0,
                "memory_usage_total": 0,
            },
        }

        # 获取适配器指标
        if hasattr(model_manager, "get_loaded_adapters"):
            loaded_adapters = model_manager.get_loaded_adapters()
            metrics["adapters"]["total_loaded"] = len(loaded_adapters)

            # 计算总内存使用
            for adapter_info in loaded_adapters.values():
                memory_usage = adapter_info.get("memory_usage", 0)
                if isinstance(memory_usage, (int, float)):
                    metrics["adapters"]["memory_usage_total"] += memory_usage

        return metrics
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=create_error_response(
                error_type="METRICS_ERROR",
                error_code="E015",  # METRICS_ERROR
                message=f"Failed to get metrics: {str(e)}",
            ).dict(),
        )
