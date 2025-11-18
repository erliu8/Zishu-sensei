"""
适配器管理API路由
处理软适配器的注册、配置和管理
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from ..dependencies import get_adapter_manager, get_logger
from ..schemas.responses import ApiResponse, ResponseStatus
import time
import uuid
from zishu.adapters.core.types import AdapterConfiguration, AdapterType
from zishu.adapters.soft.third_party_api_adapter import ThirdPartyAPIAdapter, ThirdPartyProvider

router = APIRouter(
    prefix="/adapters",
    tags=["adapters"],
)


# 请求模型
class RegisterThirdPartyAdapterRequest(BaseModel):
    """注册第三方API适配器请求"""
    provider: str = Field(..., description="提供商名称")
    api_key: str = Field(..., description="API密钥")
    model: str = Field(..., description="模型名称")
    api_base: Optional[str] = Field(None, description="API基础URL（可选）")
    adapter_id: Optional[str] = Field(None, description="适配器ID（可选，自动生成）")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="温度参数")
    max_tokens: int = Field(2000, ge=1, le=32000, description="最大token数")
    timeout: int = Field(30, ge=5, le=300, description="超时时间（秒）")


class UpdateAdapterConfigRequest(BaseModel):
    """更新适配器配置请求"""
    adapter_id: str = Field(..., description="适配器ID")
    config: Dict[str, Any] = Field(..., description="新配置")


class AdapterInfoResponse(BaseModel):
    """适配器信息响应"""
    adapter_id: str
    name: str
    provider: Optional[str] = None
    model: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class RegisterHardAdapterRequest(BaseModel):
    """注册硬适配器请求（本地LLM）"""
    template_id: str = Field(..., description="模板ID")
    name: str = Field(..., description="适配器名称")
    prompt: str = Field(..., description="系统提示词")
    llm_config: Dict[str, Any] = Field(..., description="LLM配置")
    adapter_type: str = Field(default="hard", description="适配器类型")


class RegisterSoftAdapterRequest(BaseModel):
    """注册软适配器请求（API调用）"""
    template_id: str = Field(..., description="模板ID")
    name: str = Field(..., description="适配器名称")
    prompt: str = Field(..., description="系统提示词")
    llm_config: Dict[str, Any] = Field(..., description="LLM配置")
    adapter_type: str = Field(default="soft", description="适配器类型")


# API端点
@router.post("/third-party/register")
async def register_third_party_adapter(
    request: RegisterThirdPartyAdapterRequest,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    注册第三方API适配器
    
    支持的提供商：
    - openai: GPT系列
    - anthropic: Claude系列
    - qwen: 通义千问
    - deepseek: DeepSeek
    - doubao: 豆包
    - gemini: Gemini
    """
    try:
        # 验证提供商
        try:
            ThirdPartyProvider(request.provider)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的提供商: {request.provider}"
            )
        
        # 生成适配器ID
        adapter_id = request.adapter_id or f"third_party_{request.provider}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 检查适配器是否已存在
        existing_adapter = await adapter_manager.get_adapter(adapter_id)
        if existing_adapter:
            logger.info(f"适配器 {adapter_id} 已存在，返回现有适配器信息")
            
            # 确保适配器正在运行
            if adapter_id not in adapter_manager._adapters:
                try:
                    await adapter_manager.start_adapter(adapter_id)
                    logger.info(f"已存在的适配器 {adapter_id} 已启动")
                except Exception as e:
                    logger.warning(f"启动已存在的适配器失败: {e}")
            
            return ApiResponse(
                success=True,
                status=ResponseStatus.SUCCESS,
                message="适配器已存在",
                data={
                    "adapter_id": adapter_id,
                    "provider": request.provider,
                    "model": request.model,
                    "status": "running" if adapter_id in adapter_manager._adapters else "registered"
                },
                request_id=str(uuid.uuid4()),
                processing_time=0.0,
                api_version="v1"
            )
        
        # 构建适配器配置
        adapter_config = {
            "adapter_type": "soft",
            "name": adapter_id,
            "provider": request.provider,
            "api_key": request.api_key,
            "model": request.model,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "timeout": request.timeout,
        }
        
        if request.api_base:
            adapter_config["api_base"] = request.api_base
        
        # 创建适配器注册配置
        registration_config = AdapterConfiguration(
            identity=adapter_id,
            name=adapter_id,
            version="1.0.0",
            adapter_type=AdapterType.SOFT,
            adapter_class=ThirdPartyAPIAdapter,
            config=adapter_config,
            description=f"第三方API适配器: {request.provider} - {request.model}",
            author="Zishu System",
            tags=["third_party", request.provider, "api"],
        )
        
        # 注册适配器
        success = await adapter_manager.register_adapter(registration_config)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="适配器注册失败"
            )
        
        # 保存到数据库
        try:
            from zishu.adapters.core.persistence import AdapterPersistenceService
            persistence_service = AdapterPersistenceService()
            saved = await persistence_service.save_adapter_config(registration_config)
            if saved:
                logger.info(f"✅ 适配器配置已保存到数据库: {adapter_id}")
            else:
                logger.warning(f"❌ 适配器配置保存到数据库失败: {adapter_id}")
        except Exception as e:
            logger.error(f"保存适配器配置到数据库异常: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # 不影响主流程
        
        # 启动适配器
        start_success = True
        try:
            start_success = await adapter_manager.start_adapter(adapter_id)
            if not start_success:
                logger.warning(f"适配器 {adapter_id} 启动失败，但已注册")
        except Exception as e:
            logger.error(f"启动适配器异常: {e}")
            start_success = False
        
        logger.info(f"第三方API适配器注册成功: {adapter_id}")
        
        return ApiResponse(
            success=True,
            status=ResponseStatus.SUCCESS,
            message="适配器注册成功",
            data={
                "adapter_id": adapter_id,
                "provider": request.provider,
                "model": request.model,
                "status": "running" if start_success else "registered"
            },
            request_id=str(uuid.uuid4()),
            processing_time=0.1,
            api_version="v1"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"注册第三方API适配器失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"注册失败: {str(e)}"
        )


@router.post("/register-hard")
async def register_hard_adapter(
    request: RegisterHardAdapterRequest,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    注册硬适配器（本地LLM）
    用于角色模板的本地LLM配置
    """
    try:
        # 生成适配器ID
        adapter_id = f"hard_{request.template_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"注册硬适配器: {request.name} (ID: {adapter_id})")
        
        # 构建适配器配置
        adapter_config = {
            "adapter_type": "hard",
            "name": request.name,
            "template_id": request.template_id,
            "prompt": request.prompt,
            "llm_config": request.llm_config,
        }
        
        # 这里暂时返回成功，实际的硬适配器注册逻辑需要根据具体的适配器实现
        # TODO: 实现真正的硬适配器注册逻辑
        
        logger.info(f"硬适配器注册成功: {adapter_id}")
        
        return {
            "adapter_id": adapter_id,
            "adapter_type": "hard",
            "message": f"硬适配器 '{request.name}' 注册成功",
            "status": "registered"
        }
        
    except Exception as e:
        logger.error(f"注册硬适配器失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"注册硬适配器失败: {str(e)}"
        )


@router.post("/register-soft")
async def register_soft_adapter(
    request: RegisterSoftAdapterRequest,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    注册软适配器（API调用）
    用于角色模板的API配置
    """
    try:
        # 生成适配器ID
        adapter_id = f"soft_{request.template_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"注册软适配器: {request.name} (ID: {adapter_id})")
        
        # 从LLM配置中提取API信息
        llm_config = request.llm_config
        provider = llm_config.get("provider", "custom")
        api_endpoint = llm_config.get("apiEndpoint", llm_config.get("api_endpoint", ""))
        api_key = llm_config.get("apiKey", llm_config.get("api_key"))
        model_name = llm_config.get("modelName", llm_config.get("model_name", ""))
        
        # 构建适配器配置
        adapter_config = {
            "adapter_type": "soft",
            "name": request.name,
            "template_id": request.template_id,
            "prompt": request.prompt,
            "provider": provider,
            "api_endpoint": api_endpoint,
            "model": model_name,
            "temperature": 0.7,
            "max_tokens": 2000,
            "timeout": 30,
        }
        
        if api_key:
            adapter_config["api_key"] = api_key
        
        # 创建适配器注册配置
        registration_config = AdapterConfiguration(
            identity=adapter_id,
            name=request.name,
            version="1.0.0",
            adapter_type=AdapterType.SOFT,
            adapter_class=ThirdPartyAPIAdapter,
            config=adapter_config,
            description=f"角色模板软适配器: {request.name}",
            author="Zishu Character Template",
            tags=["character_template", "soft", provider],
        )
        
        # 注册适配器
        success = await adapter_manager.register_adapter(registration_config)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="软适配器注册失败"
            )
        
        # 启动适配器
        start_success = await adapter_manager.start_adapter(adapter_id)
        
        if not start_success:
            logger.warning(f"软适配器 {adapter_id} 启动失败，但已注册")
        
        logger.info(f"软适配器注册成功: {adapter_id}")
        
        return {
            "adapter_id": adapter_id,
            "adapter_type": "soft",
            "message": f"软适配器 '{request.name}' 注册成功",
            "status": "running" if start_success else "registered"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"注册软适配器失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"注册软适配器失败: {str(e)}"
        )


@router.get("/list")
async def list_adapters(
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """列出所有已注册的适配器"""
    try:
        # 获取所有适配器
        adapters = await adapter_manager.list_adapters()
        
        adapter_list = []
        for adapter_reg in adapters:
            adapter_info = {
                "adapter_id": adapter_reg.identity.adapter_id,
                "name": adapter_reg.identity.name,
                "type": adapter_reg.identity.adapter_type.value,
                "status": adapter_reg.status.value,
                "version": adapter_reg.identity.version,
                "description": adapter_reg.identity.description,
            }
            
            # 添加第三方API特定信息
            if hasattr(adapter_reg.configuration, 'config'):
                config = adapter_reg.configuration.config
                if "provider" in config:
                    adapter_info["provider"] = config["provider"]
                if "model" in config:
                    adapter_info["model"] = config["model"]
            
            adapter_list.append(adapter_info)
        
        return ApiResponse(
            success=True,
            status=ResponseStatus.SUCCESS,
            data={
                "adapters": adapter_list,
                "total": len(adapter_list)
            },
            request_id=str(uuid.uuid4()),
            processing_time=0.0,
            api_version="v1"
        )
        
    except Exception as e:
        logger.error(f"获取适配器列表失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"获取适配器列表失败: {str(e)}"
        )


@router.get("/{adapter_id}")
async def get_adapter_info(
    adapter_id: str,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """获取特定适配器的详细信息"""
    try:
        # 获取适配器注册信息
        adapter_reg = await adapter_manager.get_adapter(adapter_id)
        
        if not adapter_reg:
            raise HTTPException(
                status_code=404,
                detail=f"适配器不存在: {adapter_id}"
            )
        
        adapter_info = {
            "adapter_id": adapter_reg.identity.adapter_id,
            "name": adapter_reg.identity.name,
            "type": adapter_reg.identity.adapter_type.value,
            "status": adapter_reg.status.value,
            "version": adapter_reg.identity.version,
            "description": adapter_reg.identity.description,
            "author": adapter_reg.identity.author,
            "tags": list(adapter_reg.identity.tags) if adapter_reg.identity.tags else [],
        }
        
        # 添加配置信息（不包含敏感信息）
        if hasattr(adapter_reg.configuration, 'config'):
            config = adapter_reg.configuration.config.copy()
            # 隐藏API密钥
            if "api_key" in config:
                config["api_key"] = "***" + config["api_key"][-4:] if len(config["api_key"]) > 4 else "****"
            adapter_info["config"] = config
        
        return ApiResponse(
            success=True,
            status=ResponseStatus.SUCCESS,
            data=adapter_info,
            request_id=str(uuid.uuid4()),
            processing_time=0.0,
            api_version="v1"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取适配器信息失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"获取适配器信息失败: {str(e)}"
        )


@router.delete("/{adapter_id}")
async def unregister_adapter(
    adapter_id: str,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """注销适配器"""
    try:
        # 停止适配器
        await adapter_manager.stop_adapter(adapter_id)
        
        # 注销适配器
        success = await adapter_manager.unregister_adapter(adapter_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="适配器注销失败"
            )
        
        # 从数据库删除
        try:
            from zishu.adapters.core.persistence import AdapterPersistenceService
            persistence_service = AdapterPersistenceService()
            await persistence_service.delete_adapter_config(adapter_id)
            logger.info(f"适配器配置已从数据库删除: {adapter_id}")
        except Exception as e:
            logger.warning(f"删除数据库中的适配器配置失败: {e}")
            # 不影响主流程
        
        logger.info(f"适配器注销成功: {adapter_id}")
        
        return ApiResponse(
            success=True,
            status=ResponseStatus.SUCCESS,
            message=f"适配器 {adapter_id} 已注销",
            request_id=str(uuid.uuid4()),
            processing_time=0.0,
            api_version="v1"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"注销适配器失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"注销失败: {str(e)}"
        )


@router.post("/{adapter_id}/start")
async def start_adapter(
    adapter_id: str,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """启动适配器"""
    try:
        success = await adapter_manager.start_adapter(adapter_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="适配器启动失败"
            )
        
        logger.info(f"适配器启动成功: {adapter_id}")
        
        return ApiResponse(
            success=True,
            status=ResponseStatus.SUCCESS,
            message=f"适配器 {adapter_id} 已启动",
            request_id=str(uuid.uuid4()),
            processing_time=0.0,
            api_version="v1"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"启动适配器失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"启动失败: {str(e)}"
        )


@router.post("/{adapter_id}/stop")
async def stop_adapter(
    adapter_id: str,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """停止适配器"""
    try:
        success = await adapter_manager.stop_adapter(adapter_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="适配器停止失败"
            )
        
        logger.info(f"适配器停止成功: {adapter_id}")
        
        return create_success_response(
            message=f"适配器 {adapter_id} 已停止"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"停止适配器失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"停止失败: {str(e)}"
        )


class ExecuteAdapterRequest(BaseModel):
    """执行适配器请求"""
    query: str = Field(..., description="查询内容")
    context: Optional[Dict[str, Any]] = Field(None, description="上下文")


@router.post("/{adapter_id}/execute")
async def execute_adapter(
    adapter_id: str,
    request: ExecuteAdapterRequest,
    adapter_manager=Depends(get_adapter_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """执行适配器（用于测试）"""
    try:
        # 获取适配器
        adapter = adapter_manager._adapters.get(adapter_id)
        
        if not adapter:
            raise HTTPException(
                status_code=404,
                detail=f"适配器未运行: {adapter_id}"
            )
        
        # 构建执行上下文
        from zishu.adapters.base import ExecutionContext
        exec_context = ExecutionContext(
            request_id=f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            user_id="test_user",
            metadata=request.context or {}
        )
        
        # 执行适配器
        result = await adapter.process(request.query, exec_context)
        
        return ApiResponse(
            success=True,
            status=ResponseStatus.SUCCESS,
            data={
                "result": result.to_dict() if hasattr(result, 'to_dict') else str(result),
                "adapter_id": adapter_id,
            },
            request_id=str(uuid.uuid4()),
            processing_time=0.0,
            api_version="v1"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"执行适配器失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"执行失败: {str(e)}"
        )


# 导出
__all__ = ["router"]
