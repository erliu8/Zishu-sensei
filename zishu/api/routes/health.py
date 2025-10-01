from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
import asyncio
import time
import psutil
import torch
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel

from ..dependencies import get_model_manager, get_config, get_logger
from ..schemas.responses import HealthResponse, ErrorResponse

router = APIRouter(
    prefix="/health",
    tags=["health-check"],
)

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    
class CheckResult(BaseModel):
    name: str
    status: HealthStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    duration_ms: float
    timestamp: datetime
    
class DeepHealthResponse(BaseModel):
    status: HealthStatus
    timestamp: datetime
    uptime_seconds: float
    checks: List[CheckResult]
    summary: Dict[str, Any]
    
class HealthChecker:
    """健康检查器基类
    提供健康检查的基类和默认实现，支持扩展
    """
    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        
    async def check(self)->CheckResult:
        """执行健康检查"""
        start_time = time.time()
        try:
            result = await asyncio.wait_for(self._do_check(), 
                                            timeout=self.timeout)
            duration_ms = (time.time() - start_time) * 1000
            return CheckResult(
                name=self.__class__.__name__.replace("Checker",""),
                status=HealthStatus.HEALTHY,
                message=result.get("message","OK"),
                details=result.get("details"),
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc)
            )
        except asyncio.TimeoutError:
            duration_ms = (time.time() - start_time) * 1000
            return CheckResult(
                name=self.__class__.__name__.replace("Checker",""),
                status=HealthStatus.UNHEALTHY,
                message=f"Check timed out after {self.timeout}s",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc)
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return CheckResult(
                name=self.__class__.__name__.replace("Checker",""),
                status=HealthStatus.UNHEALTHY,
                message=f"Check failed: {str(e)}",
                duration_ms=duration_ms,
                timestamp=datetime.now(timezone.utc)
            )
    
    async def _do_check(self)->Dict[str,Any]:
        """子类必须实现具体健康检查"""
        raise NotImplementedError("Subclasses must implement this method")
    
class DatabaseChecker(HealthChecker):
    """数据库健康检查"""

#TODO: 实现数据库健康检查

class RedisChecker(HealthChecker):
    """Redis健康检查"""

#TODO: 实现Redis健康检查

class ModelChecker(HealthChecker):
    """模型健康检查"""

    def __init__(self, timeout: float = 10.0):
        super().__init__(timeout)
        
    async def _do_check(self)->Dict[str,Any]:
        """执行模型健康检查"""
        try:
            #检查GPU可用性
            gpu_available = torch.cuda.is_available()
            gpu_count = torch.cuda.device_count() if gpu_available else 0
            
            details = {
                "gpu_available": gpu_available,
                "gpu_count": gpu_count
            }
            
            if gpu_available:
                #检查GPU内存
                for i in range(gpu_count):
                    memory_allocated = torch.cuda.memory_allocated(i)
                    memory_reserved = torch.cuda.memory_reserved(i)
                    total_memory = torch.cuda.get_device_properties(i).total_memory
                    
                    details[f"gpu_{i}"] = {
                        "name": torch.cuda.get_device_name(i),
                        "memory_allocated_mb": memory_allocated // 1024 // 1024,
                        "memory_reserved_mb": memory_reserved // 1024 // 1024,
                        "total_memory_mb": total_memory // 1024 // 1024,
                        "memory_usage_percent": round((memory_allocated / total_memory) * 100, 2)
                    } 
                    
            return {
                "message": "Model check successful",
                "details": details
            }
        except Exception as e:
            return {
                "message": f"Model check failed: {str(e)}",
                "details": {"error": str(e)}
            }

class AdapterChecker(HealthChecker):
    """Adapter健康检查"""

    def __init__(self, model_manager, timeout: float = 5.0):
        super().__init__(timeout)
        self.model_manager = model_manager
        
    async def _do_check(self)->Dict[str,Any]:
        """执行Adapter健康检查"""
        try:
            if hasattr(self.model_manager,"get_adapter_status"):
                adapter_status = self.model_manager.get_adapter_status()
                return {
                    "message": "Adapter check successful",
                    "details": adapter_status
                }
            else:
                return {
                    "message": "Adapter is not initialized",
                    "details": {"status": "not initialized"}
                }
        except Exception as e:
            return {
                "message": f"Adapter check failed: {str(e)}",
                "details": {"error": str(e)}
            }
            
class SystemChecker(HealthChecker):
    """系统健康检查"""

    def __init__(self, timeout: float = 5.0):
        super().__init__(timeout)
        
    async def _do_check(self)->Dict[str,Any]:
        try:
            #CPU使用率
            cpu_percentage = psutil.cpu_percent(interval=1)
            
            #内存使用情况
            memory = psutil.virtual_memory()
            
            #磁盘使用情况
            disk = psutil.disk_usage("/")
            
            details = {
                "cpu":{
                    "usage_percent": cpu_percentage,
                    "count": psutil.cpu_count()
                },
                "memory":{
                    "total_mb": memory.total // 1024 // 1024,
                    "used_mb": memory.used // 1024 // 1024,
                    "free_mb": memory.available // 1024 // 1024,
                    "usage_percent": memory.percent
                },
                "disk":{
                    "total_mb": disk.total // 1024 // 1024,
                    "used_mb": disk.used // 1024 // 1024,
                    "free_mb": disk.free // 1024 // 1024,
                    "usage_percent": round((disk.used / disk.total) * 100, 2)
                }
            }
            
            #判断系统状态
            status_issues = []
            if cpu_percentage > 90:
                status_issues.append("High CPU usage")
                
            if memory.percent > 90:
                status_issues.append("High memory usage")
                
            if details["disk"]["usage_percent"] > 90:
                status_issues.append("High disk usage")
                
            message = "System is healthy" if not status_issues else f"System is degraded: {', '.join(status_issues)}"
            return {
                "message": message,
                "details": details
            }
        except Exception as e:
            return {
                "message": f"System check failed: {str(e)}",
                "details": {"error": str(e)}
            }
            
#启动时间记录
_startup_time = time.time()

def get_uptime() -> float:
    """获取系统启动时间/秒"""
    return time.time() - _startup_time

async def get_health_status(
    model_manager = None,
    include_system: bool = True,
    include_model: bool = True,
    include_adapter: bool = True,
    include_database: bool = True,
    include_redis: bool = True) -> DeepHealthResponse:
    """获取健康检查状态"""
    
    checkers = []
    #基础检查(总是执行)
    if include_system:
        checkers.append(SystemChecker())
        
    #模型检查
    if include_model:
        checkers.append(ModelChecker())
        
    #Adapter检查
    if include_adapter:
        checkers.append(AdapterChecker(model_manager))
        
    #数据库检查
    if include_database:
        checkers.append(DatabaseChecker())
        
    #Redis检查
    if include_redis:
        checkers.append(RedisChecker())
        
    #并行执行检查
    check_task = [checker.check() for checker in checkers]
    check_results = await asyncio.gather(*check_task,return_exceptions=True)
    
    #处理异常结果
    final_results = []
    for result in check_results:
        if isinstance(result,Exception):
            final_results.append(CheckResult(
                name="UnknownCheck",
                status=HealthStatus.UNHEALTHY,
                message=f"Check failed: {str(result)}",
                duration_ms=0.0,
                timestamp=datetime.now(timezone.utc)
            ))
        else:
            final_results.append(result)
            
    #计算整体状态
    overall_status = HealthStatus.HEALTHY
    unhealthy_count = sum(1 for result in final_results if result.status == HealthStatus.UNHEALTHY)
    degraded_count = sum(1 for result in final_results if result.status == HealthStatus.DEGRADED)
    
    if unhealthy_count > 0:
        overall_status = HealthStatus.UNHEALTHY
    elif degraded_count > 0:
        overall_status = HealthStatus.DEGRADED
        
    #生成摘要
    summary = {
        "total_checks": len(final_results),
        "healthy_count": sum(1 for result in final_results if result.status == HealthStatus.HEALTHY),
        "unhealthy_count": unhealthy_count,
        "degraded_count": degraded_count,
        "avg_response_time_ms":round(
            sum(r.duration_ms for r in final_results) / len(final_results), 2
        ) if final_results else 0
    }
    
    return DeepHealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=get_uptime(),
        checks=final_results,
        summary=summary
    )

@router.get("/", response_model=DeepHealthResponse)
async def health_check():
    """
    健康检查端点
    用于负载均衡和监控系统
    """
    return DeepHealthResponse(
        status=HealthStatus.HEALTHY,
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=get_uptime(),
        checks=[],
        summary={"message": "Basic health check"}
    )

@router.get("/ping")
async def ping():
    """
    ping端点
    """
    return {"message": "pong","timestamp": datetime.now(timezone.utc)}

@router.get("/deep", response_model=DeepHealthResponse)
async def deep_health_check(
    model_manager = Depends(get_model_manager),
    logger = Depends(get_logger)):
    """
    深度健康检查端点
    包含系统资源、模型状态、Adapter状态、数据库状态、Redis状态等
    """
    try:
        logger.info("Starting deep health check")
        result = await get_health_status(
            model_manager=model_manager,
            include_system=True,
            include_model=True,
            include_adapter=True,
            include_database=True,
            include_redis=True
        )
        logger.info(f"Deep health check completed successfully,status: %s",result.status)
        return result
    except Exception as e:
        logger.error(f"Deep health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "health check failed",
                "message": f"Deep health check failed: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

@router.get("/readiness")
async def readiness_check(
    model_manager = Depends(get_model_manager)):
    """
    就绪性检查
    
    检查服务是否准备好处理请求
    """
    try:
        #检查关键组件是否就绪
        ready = True
        issues = []
        
        #检查模型管理器
        if not model_manager:
            ready = False
            issues.append("Model manager is not initialized")
            
        if ready:
            return{
                "ready": True,
                "message": "Service is ready to handle requests",
                "timestamp": datetime.now(timezone.utc)
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "ready": False,
                    "message": f"Service is not ready: {', '.join(issues)}",
                    "issues": issues,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "ready": False,
                "message": f"Readiness check failed: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        
@router.get("/liveness")
async def liveness_check():
    """
    存活性检查
    
    检查服务是否存活
    """
    return {
        "alive": True,
        "pid": psutil.Process().pid,
        "uptime_seconds": get_uptime(),
        "timestamp": datetime.now(timezone.utc)
    }
    
    
    
    






    